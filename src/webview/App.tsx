import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { SessionSnapshot, TranscriptProgress } from "@earendil-works/pi-protocol";
import {
  parseHostMessage,
  type ConnectionStatus,
  type ModelMeta,
  type SessionMeta,
  type ThinkingLevel,
} from "../shared/messages";
import {
  applyTranscriptProgress,
  applyTranscriptSnapshot,
  createTranscriptState,
  selectTranscript,
  type TranscriptState,
} from "../shared/transcript";
import { overlayCurrentSession, sortSessionsNewestFirst } from "../shared/sessions";
import { vscode } from "./vscode";
import { TopBar } from "./components/TopBar";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
import { StatusBanner } from "./components/Pickers";

export function App() {
  const [status, setStatus] = createSignal<ConnectionStatus>("connecting");
  const [error, setError] = createSignal<string>();
  const [sessions, setSessions] = createSignal<SessionMeta[]>([]);
  const [models, setModels] = createSignal<ModelMeta[]>([]);
  const [transcript, setTranscript] = createSignal<TranscriptState>();
  const [draft, setDraft] = createSignal("");
  const [mentions, setMentions] = createSignal<string[]>([]);
  let mentionQuery = "";

  const snapshot = createMemo(() => transcript()?.snapshot);
  const items = createMemo(() => {
    const state = transcript();
    return state ? selectTranscript(state) : [];
  });
  const title = createMemo(() => snapshot()?.name || "New Session");
  const pickerSessions = createMemo(() => {
    const current = snapshot();
    return sortSessionsNewestFirst(
      overlayCurrentSession(
        sessions(),
        current
          ? { id: current.id, name: current.name, updatedAt: current.updatedAt }
          : undefined,
      ),
    );
  });
  const busy = createMemo(() => snapshot()?.phase === "turn" || snapshot()?.phase === "retry");
  const queued = createMemo(() =>
    (snapshot()?.queuedSteer ?? []).map((item) =>
      item.content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join(" "),
    ),
  );

  const applySnapshot = (next: SessionSnapshot) => {
    setTranscript((current) =>
      current ? applyTranscriptSnapshot(current, next) : createTranscriptState(next),
    );
  };

  onMount(() => {
    const onMessage = (event: MessageEvent) => {
      const message = parseHostMessage(event.data);
      if (!message) return;
      if (message.type === "status") {
        setStatus(message.status);
        if (message.status === "connected") setError(undefined);
      }
      if (message.type === "error") setError(message.message);
      if (message.type === "server-snapshot") {
        setSessions(sortSessionsNewestFirst(message.sessions));
        setModels(message.models);
      }
      if (message.type === "session-snapshot") {
        applySnapshot(message.snapshot as SessionSnapshot);
      }
      if (message.type === "session-progress") {
        setTranscript((current) =>
          current
            ? applyTranscriptProgress(current, message.progress as TranscriptProgress)
            : current,
        );
      }
      if (message.type === "search-files-result") setMentions(message.files);
      if (message.type === "editor-selection") {
        const range =
          message.startLine && message.endLine
            ? `@${message.filePath}#L${message.startLine}-${message.endLine}`
            : `@${message.filePath}`;
        setDraft((value) => (value ? `${value} ${range} ` : `${range} `));
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    onCleanup(() => window.removeEventListener("message", onMessage));
  });

  createEffect(() => {
    items();
    const container = document.querySelector(".messages-container");
    if (container) container.scrollTop = container.scrollHeight;
  });

  const submit = () => {
    const text = draft().trim();
    if (!text) return;
    vscode.postMessage({ type: busy() ? "steer" : "prompt", text });
    setDraft("");
  };

  const pickMention = (path: string) => {
    setDraft((value) => value.replace(/(?:^|\s)@[^\s]*$/, ` @${path} `));
    setMentions([]);
  };

  const currentModel = createMemo(() =>
    models().find(
      (model) =>
        model.provider === snapshot()?.model.provider && model.id === snapshot()?.model.id,
    ),
  );

  return (
    <div class="app">
      <TopBar
        sessions={pickerSessions()}
        currentId={snapshot()?.id}
        currentTitle={title()}
        busyId={busy() ? snapshot()?.id : undefined}
        onSelect={(id) => vscode.postMessage({ type: "open-session", sessionId: id })}
        onNew={() => vscode.postMessage({ type: "new-session" })}
      />
      <StatusBanner status={status()} error={error()} />
      <MessageList
        items={items()}
        busy={busy()}
        cwd={snapshot()?.cwd}
        onOpenFile={(path) => vscode.postMessage({ type: "open-file", path })}
      />
      <InputBar
        value={draft()}
        onInput={setDraft}
        onSubmit={submit}
        onAbort={() => vscode.postMessage({ type: "abort" })}
        busy={busy()}
        models={models()}
        modelProvider={snapshot()?.model.provider}
        modelId={snapshot()?.model.id}
        thinking={(snapshot()?.thinkingLevel ?? "off") as ThinkingLevel}
        thinkingLevels={currentModel()?.supportedThinkingLevels}
        onModel={(provider, id) => vscode.postMessage({ type: "set-model", provider, id })}
        onThinking={(level) => vscode.postMessage({ type: "set-thinking", level })}
        queued={queued()}
        mentions={mentions()}
        onMentionQuery={(query) => {
          if (query === mentionQuery) return;
          mentionQuery = query;
          vscode.postMessage({ type: "search-files", query });
        }}
        onPickMention={pickMention}
      />
    </div>
  );
}
