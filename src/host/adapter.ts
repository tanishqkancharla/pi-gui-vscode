import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type {
  AssistantMessageEvent,
  AssistantMessage,
  Message,
  Model,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";
import {
  PiServerError,
  SessionBusyError,
  SessionNotFoundError,
  toProtocolAssistantMessage,
  toProtocolModelMetadata,
  toProtocolToolResultMessage,
  toProtocolUserMessage,
  type CreateSessionOptions,
  type PiServerService,
  type PiSessionRuntime,
  type PiSessionRuntimeEvent,
  type PromptInput,
  type SteerInput,
} from "@earendil-works/pi-server";
import type {
  ModelMetadata,
  ModelRef,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
  TranscriptItem,
  TranscriptProgress,
} from "@earendil-works/pi-protocol";

function messageId(sessionId: string, index: number, role: string, timestamp: number): string {
  return `${sessionId}:${index}:${role}:${timestamp}`;
}

function queuedUserItem(sessionId: string, text: string, index: number): TranscriptItem {
  return {
    id: `${sessionId}:steer:${index}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
}

function toTranscript(sessionId: string, messages: readonly Message[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const calls = new Map<string, ToolCall>();
  messages.forEach((message, index) => {
    const id = messageId(sessionId, index, message.role, message.timestamp);
    if (message.role === "user") {
      items.push(toProtocolUserMessage(message as UserMessage, { id }));
      return;
    }
    if (message.role === "assistant") {
      const assistant = message as AssistantMessage;
      items.push(toProtocolAssistantMessage(assistant, { id }));
      for (const part of assistant.content) {
        if (part.type === "toolCall") calls.set(part.id, part);
      }
      return;
    }
    if (message.role === "toolResult") {
      const result = message as ToolResultMessage;
      const call = calls.get(result.toolCallId);
      if (!call) return;
      try {
        items.push(toProtocolToolResultMessage(result, { id, call }));
      } catch {
        // Skip protocol-incompatible custom tool payloads.
      }
    }
  });
  return items;
}

function progressFromAssistantEvent(
  messageIdValue: string,
  event: AssistantMessageEvent,
): TranscriptProgress | undefined {
  if (event.type === "text_delta") {
    return {
      type: "assistant_delta",
      messageId: messageIdValue,
      contentIndex: event.contentIndex,
      kind: "text",
      delta: event.delta,
    };
  }
  if (event.type === "thinking_delta") {
    return {
      type: "assistant_delta",
      messageId: messageIdValue,
      contentIndex: event.contentIndex,
      kind: "thinking",
      delta: event.delta,
    };
  }
  if (event.type === "toolcall_delta") {
    return {
      type: "assistant_delta",
      messageId: messageIdValue,
      contentIndex: event.contentIndex,
      kind: "toolCall",
      delta: event.delta,
    };
  }
  return undefined;
}

class AgentSessionRuntime implements PiSessionRuntime {
  private revision = 0;
  private readonly listeners = new Set<(event: PiSessionRuntimeEvent) => void>();
  private unsubscribe?: () => void;
  private streamingMessageId?: string;
  private operation: Promise<void> | undefined;

  constructor(
    private readonly protocolId: string,
    private readonly session: AgentSession,
    private readonly cwd: string,
    private readonly modelRuntime: ModelRuntime,
    createdAt: number,
  ) {
    this.createdAt = createdAt;
    this.unsubscribe = session.subscribe((event) => this.onAgentEvent(event));
  }

  readonly createdAt: number;

  snapshot(): SessionSnapshot {
    return this.buildSnapshot();
  }

  getPhase(): SessionPhase {
    if (this.session.isCompacting) return "compaction";
    if (this.session.retryAttempt > 0) return "retry";
    if (this.session.isStreaming) return "turn";
    return "idle";
  }

  async prompt(input: PromptInput): Promise<void> {
    await this.runExclusive(() => this.session.prompt(input.text));
  }

  async steer(input: SteerInput): Promise<void> {
    await this.runExclusive(() => this.session.steer(input.text));
  }

  async abort(): Promise<void> {
    await this.session.abort();
  }

  async setModel(model: ModelRef): Promise<void> {
    const resolved = this.modelRuntime.getModel(model.provider, model.id);
    if (!resolved) {
      throw new PiServerError("invalid_request", `Unknown model ${model.provider}/${model.id}`);
    }
    await this.runExclusive(() => this.session.setModel(resolved));
  }

  async setThinking(thinkingLevel: ThinkingLevel): Promise<void> {
    this.session.setThinkingLevel(thinkingLevel);
    this.emitSnapshot();
  }

  subscribe(listener: (event: PiSessionRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.session.dispose();
    this.listeners.clear();
  }

  private async runExclusive(run: () => Promise<void>): Promise<void> {
    if (this.operation) throw new SessionBusyError();
    const pending = run();
    this.operation = pending;
    try {
      await pending;
    } finally {
      if (this.operation === pending) this.operation = undefined;
      this.emitSnapshot();
    }
  }

  private onAgentEvent(event: AgentSessionEvent): void {
    if (event.type === "message_start" && event.message.role === "assistant") {
      const item = this.latestAssistantItem();
      if (item) {
        this.streamingMessageId = item.id;
        this.emit({ type: "progress", progress: { type: "item_started", item } });
      }
    }
    if (event.type === "message_update" && event.message.role === "assistant") {
      const id = this.streamingMessageId ?? this.latestAssistantItem()?.id;
      if (id) {
        const progress = progressFromAssistantEvent(id, event.assistantMessageEvent);
        if (progress) this.emit({ type: "progress", progress });
      }
    }
    if (
      event.type === "message_end" ||
      event.type === "agent_end" ||
      event.type === "agent_settled" ||
      event.type === "queue_update" ||
      event.type === "session_info_changed" ||
      event.type === "thinking_level_changed"
    ) {
      this.emitSnapshot();
    }
  }

  private latestAssistantItem(): TranscriptItem | undefined {
    const items = toTranscript(this.protocolId, this.session.messages as Message[]);
    return [...items].reverse().find((item) => item.role === "assistant");
  }

  private buildSnapshot(): SessionSnapshot {
    const model = this.session.model;
    const queuedSteer = this.readQueuedSteer();
    return {
      id: this.protocolId,
      name: this.session.sessionName,
      cwd: this.cwd,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      phase: this.getPhase(),
      model: model
        ? { provider: model.provider, id: model.id }
        : { provider: "none", id: "none" },
      thinkingLevel: this.session.thinkingLevel,
      attached: true,
      locked: Boolean(this.operation),
      revision: ++this.revision,
      transcript: toTranscript(this.protocolId, this.session.messages as Message[]),
      queuedSteer,
      queuedSteerCount: queuedSteer.length,
    };
  }

  private readQueuedSteer(): TranscriptItem[] {
    return this.session
      .getSteeringMessages()
      .map((text, index) => queuedUserItem(this.protocolId, text, index));
  }

  private emitSnapshot(): void {
    this.emit({ type: "snapshot" });
  }

  private emit(event: PiSessionRuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class CodingAgentServerService implements PiServerService {
  private constructor(
    readonly cwd: string,
    readonly agentDir: string,
    readonly modelRuntime: ModelRuntime,
  ) {}

  static async create(options: { cwd: string; agentDir?: string }): Promise<CodingAgentServerService> {
    const agentDir = options.agentDir ?? getAgentDir();
    const modelRuntime = await ModelRuntime.create({
      authPath: `${agentDir}/auth.json`,
      modelsPath: `${agentDir}/models.json`,
    });
    return new CodingAgentServerService(options.cwd, agentDir, modelRuntime);
  }

  async listSessions(): Promise<SessionMetadata[]> {
    const sessions = await SessionManager.list(this.cwd);
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.created.getTime(),
      updatedAt: session.modified.getTime(),
      sessionName: session.name || session.firstMessage || undefined,
      cwd: session.cwd || this.cwd,
    }));
  }

  async listModels(): Promise<ModelMetadata[]> {
    const available = await this.modelRuntime.getAvailable();
    const availableIds = new Set(available.map((model) => `${model.provider}/${model.id}`));
    return this.modelRuntime.getModels().map((model) =>
      toProtocolModelMetadata(model as Model, availableIds.has(`${model.provider}/${model.id}`)),
    );
  }

  async createSession(options: CreateSessionOptions): Promise<PiSessionRuntime> {
    const cwd = options.cwd?.trim() || this.cwd;
    const sessionManager = SessionManager.create(cwd, undefined, { id: options.id });
    return this.openWithManager(options.id, cwd, sessionManager, options);
  }

  async openSession(sessionId: string): Promise<PiSessionRuntime> {
    const sessions = await SessionManager.list(this.cwd);
    const info = sessions.find((session) => session.id === sessionId);
    if (!info) throw new SessionNotFoundError(`Unknown session: ${sessionId}`);
    const sessionManager = SessionManager.open(info.path, undefined, this.cwd);
    return this.openWithManager(sessionId, info.cwd || this.cwd, sessionManager);
  }

  hasAuthenticatedModel(): boolean {
    return this.modelRuntime.getAvailableSnapshot().length > 0;
  }

  private async openWithManager(
    protocolId: string,
    cwd: string,
    sessionManager: SessionManager,
    options?: CreateSessionOptions,
  ): Promise<PiSessionRuntime> {
    let model: Model | undefined;
    if (options?.model) {
      model = this.modelRuntime.getModel(options.model.provider, options.model.id);
    }
    const { session } = await createAgentSession({
      cwd,
      agentDir: this.agentDir,
      modelRuntime: this.modelRuntime,
      sessionManager,
      model,
      thinkingLevel: options?.thinkingLevel,
    });
    if (options?.name) {
      session.setSessionName(options.name);
    }
    const header = sessionManager.getHeader();
    const createdAt = header?.timestamp ? Date.parse(header.timestamp) : Date.now();
    return new AgentSessionRuntime(protocolId, session, cwd, this.modelRuntime, createdAt);
  }
}
