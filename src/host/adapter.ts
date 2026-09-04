import { join, resolve } from "node:path";
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
import { sortSessionsNewestFirst } from "../shared/sessions";
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

function sessionDirFor(cwd: string, agentDir: string): string {
  const resolvedCwd = resolve(cwd);
  const encoded = `--${resolvedCwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return join(agentDir, "sessions", encoded);
}

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

function toStreamingAssistantItem(
  sessionId: string,
  sessionMessages: readonly Message[],
  message: AssistantMessage,
): TranscriptItem {
  const list = sessionMessages.includes(message) ? [...sessionMessages] : [...sessionMessages, message];
  const index = list.indexOf(message);
  const id = messageId(sessionId, index, "assistant", message.timestamp);
  try {
    return toProtocolAssistantMessage(message, { id });
  } catch {
    const item: TranscriptItem = {
      id,
      role: "assistant",
      content: message.content.flatMap((part, partIndex) => {
        if (part.type === "text") return [{ type: "text" as const, text: part.text ?? "" }];
        if (part.type === "thinking") {
          return [{ type: "thinking" as const, thinking: part.thinking ?? "" }];
        }
        if (part.type === "toolCall") {
          return [
            {
              type: "toolCall" as const,
              toolCallId: part.id || `pending:${partIndex}`,
              toolName: part.name?.trim() ?? "",
              input: part.arguments ?? {},
            },
          ];
        }
        return [];
      }),
      model: {
        provider: message.provider || "none",
        id: message.model || "none",
      },
      timestamp: Number.isSafeInteger(message.timestamp) ? message.timestamp : Date.now(),
      status: "streaming",
    };
    return item;
  }
}

function toTranscript(sessionId: string, messages: readonly Message[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const calls = new Map<string, ToolCall>();
  messages.forEach((message, index) => {
    const id = messageId(sessionId, index, message.role, message.timestamp);
    if (message.role === "user") {
      try {
        items.push(toProtocolUserMessage(message as UserMessage, { id }));
      } catch {
        items.push({
          id,
          role: "user",
          content: [{ type: "text", text: String((message as UserMessage).content ?? "") }],
          timestamp: Number.isSafeInteger(message.timestamp) ? message.timestamp : Date.now(),
        });
      }
      return;
    }
    if (message.role === "assistant") {
      const assistant = message as AssistantMessage;
      items.push(toStreamingAssistantItem(sessionId, messages, assistant));
      for (const part of assistant.content) {
        if (part.type === "toolCall" && part.id) calls.set(part.id, part);
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
    const current = this.session.model;
    if (current && current.provider === model.provider && current.id === model.id) {
      return;
    }
    const resolved = this.modelRuntime.getModel(model.provider, model.id);
    if (!resolved) {
      throw new PiServerError("invalid_request", `Unknown model ${model.provider}/${model.id}`);
    }
    if (!this.modelRuntime.hasConfiguredAuth(model.provider)) {
      throw new PiServerError(
        "invalid_request",
        `No API key for ${model.provider}/${model.id}`,
      );
    }
    try {
      await this.runExclusive(() => this.session.setModel(resolved));
    } catch (error) {
      if (error instanceof PiServerError) throw error;
      throw new PiServerError(
        "invalid_request",
        error instanceof Error ? error.message : String(error),
      );
    }
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
      const item = toStreamingAssistantItem(
        this.protocolId,
        this.session.messages as Message[],
        event.message as AssistantMessage,
      );
      if (item) {
        this.streamingMessageId = item.id;
        this.emit({ type: "progress", progress: { type: "item_started", item } });
      }
    }
    if (event.type === "message_update" && event.message.role === "assistant") {
      const assistantEvent = event.assistantMessageEvent;
      const id = this.streamingMessageId ?? this.latestAssistantItem()?.id;
      if (
        id &&
        (assistantEvent.type === "text_delta" || assistantEvent.type === "thinking_delta")
      ) {
        const progress = progressFromAssistantEvent(id, assistantEvent);
        if (progress) this.emit({ type: "progress", progress });
        return;
      }
      const item = toStreamingAssistantItem(
        this.protocolId,
        this.session.messages as Message[],
        event.message as AssistantMessage,
      );
      if (item) {
        this.streamingMessageId = item.id;
        this.emit({ type: "progress", progress: { type: "item_updated", item } });
      }
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      const item = toStreamingAssistantItem(
        this.protocolId,
        this.session.messages as Message[],
        event.message as AssistantMessage,
      );
      this.streamingMessageId = item.id;
      this.emit({ type: "progress", progress: { type: "item_finished", item } });
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
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
    });
    return new CodingAgentServerService(options.cwd, agentDir, modelRuntime);
  }

  private sessionDir(cwd = this.cwd): string {
    return sessionDirFor(cwd, this.agentDir);
  }

  async listSessions(): Promise<SessionMetadata[]> {
    const sessions = await SessionManager.list(this.cwd, this.sessionDir());
    return sortSessionsNewestFirst(
      sessions.map((session) => ({
        id: session.id,
        createdAt: session.created.getTime(),
        updatedAt: session.modified.getTime(),
        sessionName: session.name || session.firstMessage || undefined,
        cwd: session.cwd || this.cwd,
      })),
    );
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
    const sessionManager = SessionManager.create(cwd, this.sessionDir(cwd), { id: options.id });
    return this.openWithManager(options.id, cwd, sessionManager, options);
  }

  async openSession(sessionId: string): Promise<PiSessionRuntime> {
    const sessions = await SessionManager.list(this.cwd, this.sessionDir());
    const info = sessions.find((session) => session.id === sessionId);
    if (!info) throw new SessionNotFoundError(`Unknown session: ${sessionId}`);
    const sessionManager = SessionManager.open(
      info.path,
      this.sessionDir(info.cwd || this.cwd),
      info.cwd || this.cwd,
    );
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
