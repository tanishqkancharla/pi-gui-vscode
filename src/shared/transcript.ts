import type {
  SessionSnapshot,
  TranscriptItem,
  TranscriptProgress,
} from "@earendil-works/pi-protocol";

export interface TranscriptState {
  readonly snapshot: SessionSnapshot;
  readonly progressItems: ReadonlyMap<string, TranscriptItem>;
  readonly progressOrder: readonly string[];
  readonly toolCallBuffers: ReadonlyMap<string, string>;
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function parsePartialToolInput(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isJsonValue(parsed)) return parsed;
  } catch {
    // Incomplete JSON while a tool call streams.
  }
  return value;
}

function setProgressItem(state: TranscriptState, item: TranscriptItem): TranscriptState {
  const progressItems = new Map(state.progressItems);
  progressItems.set(item.id, structuredClone(item));
  const progressOrder = state.progressOrder.includes(item.id)
    ? state.progressOrder
    : [...state.progressOrder, item.id];
  return { ...state, progressItems, progressOrder };
}

function streamedLength(item: TranscriptItem): number {
  if (item.role !== "assistant") return 0;
  return item.content.reduce((sum, part) => {
    if (part.type === "text") return sum + part.text.length;
    if (part.type === "thinking") return sum + part.thinking.length;
    if (part.type === "toolCall") return sum + JSON.stringify(part.input ?? "").length;
    return sum;
  }, 0);
}

function emptyDeltaPart(
  kind: "text" | "thinking" | "toolCall",
): Extract<TranscriptItem, { role: "assistant" }>["content"][number] {
  if (kind === "thinking") return { type: "thinking", thinking: "" };
  if (kind === "toolCall") return { type: "toolCall", toolCallId: "", toolName: "", input: "" };
  return { type: "text", text: "" };
}

function preserveAheadProgress(
  snapshotState: TranscriptState,
  previous: TranscriptState,
): TranscriptState {
  if (previous.progressItems.size === 0) return snapshotState;
  const progressItems = new Map<string, TranscriptItem>();
  const progressOrder: string[] = [];
  for (const id of previous.progressOrder) {
    const progress = previous.progressItems.get(id);
    if (!progress) continue;
    const committed = snapshotState.snapshot.transcript.find((item) => item.id === id);
    if (!committed || streamedLength(progress) > streamedLength(committed)) {
      progressItems.set(id, progress);
      progressOrder.push(id);
    }
  }
  if (progressItems.size === 0) return snapshotState;
  return {
    ...snapshotState,
    progressItems,
    progressOrder,
    toolCallBuffers: new Map(previous.toolCallBuffers),
  };
}

export function createTranscriptState(snapshot: SessionSnapshot): TranscriptState {
  return {
    snapshot: structuredClone(snapshot),
    progressItems: new Map(),
    progressOrder: [],
    toolCallBuffers: new Map(),
  };
}

export function applyTranscriptSnapshot(
  state: TranscriptState,
  snapshot: SessionSnapshot,
): TranscriptState {
  if (state.snapshot.id === snapshot.id && snapshot.revision < state.snapshot.revision) {
    return state;
  }
  const next = createTranscriptState(snapshot);
  if (state.snapshot.id !== snapshot.id) return next;
  return preserveAheadProgress(next, state);
}

export function applyTranscriptProgress(
  state: TranscriptState,
  progress: TranscriptProgress,
): TranscriptState {
  if (progress.type === "item_started" || progress.type === "item_updated") {
    return setProgressItem(state, progress.item);
  }
  if (progress.type === "item_finished") {
    const toolCallBuffers = new Map(state.toolCallBuffers);
    for (const key of toolCallBuffers.keys()) {
      if (key.startsWith(`${progress.item.id}:`)) toolCallBuffers.delete(key);
    }
    return setProgressItem({ ...state, toolCallBuffers }, progress.item);
  }

  const item =
    state.progressItems.get(progress.messageId) ??
    state.snapshot.transcript.find(({ id }) => id === progress.messageId);
  if (!item || item.role !== "assistant") return state;

  let toolCallBuffers = state.toolCallBuffers;
  const content = item.content.map((part) => structuredClone(part));
  while (content.length <= progress.contentIndex) {
    content.push(emptyDeltaPart(progress.kind));
  }
  const part = content[progress.contentIndex];
  if (progress.kind === "text") {
    content[progress.contentIndex] =
      part.type === "text" ? { ...part, text: part.text + progress.delta } : { type: "text", text: progress.delta };
  } else if (progress.kind === "thinking") {
    content[progress.contentIndex] =
      part.type === "thinking"
        ? { ...part, thinking: part.thinking + progress.delta }
        : { type: "thinking", thinking: progress.delta };
  } else if (progress.kind === "toolCall") {
    const key = `${progress.messageId}:${progress.contentIndex}`;
    const existing =
      state.toolCallBuffers.get(key) ??
      (part.type === "toolCall" && typeof part.input === "string" ? part.input : "");
    const buffer = existing + progress.delta;
    toolCallBuffers = new Map(state.toolCallBuffers).set(key, buffer);
    content[progress.contentIndex] =
      part.type === "toolCall"
        ? { ...part, input: parsePartialToolInput(buffer) }
        : { type: "toolCall", toolCallId: "", toolName: "", input: parsePartialToolInput(buffer) };
  }
  return setProgressItem({ ...state, toolCallBuffers }, { ...item, content });
}

export function selectTranscript(state: TranscriptState): readonly TranscriptItem[] {
  const transcript = state.snapshot.transcript.map(
    (item) => state.progressItems.get(item.id) ?? item,
  );
  const ids = new Set(transcript.map((item) => item.id));
  for (const id of state.progressOrder) {
    if (ids.has(id)) continue;
    const item = state.progressItems.get(id);
    if (item) transcript.push(item);
  }
  return transcript;
}
