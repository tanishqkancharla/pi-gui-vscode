import { For, Show, createEffect, createSignal } from "solid-js";
import type { ModelMeta, ThinkingLevel } from "../../shared/messages";
import { ComposerSettings } from "./Pickers";

export function InputBar(props: {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  busy: boolean;
  models: ModelMeta[];
  modelProvider?: string;
  modelId?: string;
  thinking: ThinkingLevel;
  thinkingLevels?: ThinkingLevel[];
  onModel: (provider: string, id: string) => void;
  onThinking: (level: ThinkingLevel) => void;
  queued: string[];
  mentions: string[];
  onMentionQuery: (query: string) => void;
  onPickMention: (path: string) => void;
}) {
  const [mentionOpen, setMentionOpen] = createSignal(false);
  let textarea: HTMLTextAreaElement | undefined;

  createEffect(() => {
    const match = props.value.match(/(?:^|\s)@([^\s]*)$/);
    if (match) {
      setMentionOpen(true);
      props.onMentionQuery(match[1] ?? "");
    } else {
      setMentionOpen(false);
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <div class="input-bar-wrapper">
      <Show when={props.queued.length > 0}>
        <div class="queued-messages">
          <For each={props.queued}>
            {(text) => (
              <div class="queued-message">
                <span class="queued-message__text">{text}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
      <form
        class="input-container"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <textarea
          ref={textarea}
          class="prompt-input"
          placeholder={props.busy ? "Steer with a follow-up…" : "Message Pi"}
          value={props.value}
          rows={2}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <Show when={mentionOpen() && props.mentions.length > 0}>
          <div class="mention-dropdown">
            <For each={props.mentions}>
              {(path) => (
                <button
                  type="button"
                  class="mention-item"
                  onClick={() => props.onPickMention(path)}
                >
                  {path}
                </button>
              )}
            </For>
          </div>
        </Show>
        <div class="input-divider" />
        <div class="input-buttons">
          <ComposerSettings
            models={props.models}
            modelProvider={props.modelProvider}
            modelId={props.modelId}
            thinking={props.thinking}
            thinkingLevels={props.thinkingLevels}
            onModel={props.onModel}
            onThinking={props.onThinking}
          />
          <div style={{ flex: "1" }} />
          <Show
            when={props.busy && !props.value.trim()}
            fallback={
              <button type="submit" class="shortcut-button shortcut-button--secondary">
                {props.busy ? "Steer" : "Send"}
              </button>
            }
          >
            <button
              type="button"
              class="shortcut-button shortcut-button--stop"
              onClick={props.onAbort}
              aria-label="Stop"
            >
              Stop
            </button>
          </Show>
        </div>
      </form>
    </div>
  );
}
