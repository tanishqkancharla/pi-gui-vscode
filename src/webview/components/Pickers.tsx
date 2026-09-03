import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import type { ModelMeta, ThinkingLevel } from "../../shared/messages";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from "../icons";
import {
  effortLabel,
  groupModels,
  isFastThinking,
  modelHint,
  nextFastThinking,
  triggerLabel,
} from "../picker";

const DEFAULT_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

type Panel = "root" | "effort" | "model";

export function ComposerSettings(props: {
  models: ModelMeta[];
  modelProvider?: string;
  modelId?: string;
  thinking: ThinkingLevel;
  thinkingLevels?: ThinkingLevel[];
  onModel: (provider: string, id: string) => void;
  onThinking: (level: ThinkingLevel) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [panel, setPanel] = createSignal<Panel>("root");
  const [query, setQuery] = createSignal("");
  let root: HTMLDivElement | undefined;

  const levels = () =>
    props.thinkingLevels?.length ? props.thinkingLevels : DEFAULT_LEVELS;
  const currentModel = () =>
    props.models.find(
      (model) => model.provider === props.modelProvider && model.id === props.modelId,
    );
  const modelName = () => currentModel()?.name ?? "Model";
  const groups = () => groupModels(props.models, query());
  const fast = () => isFastThinking(props.thinking);

  const close = () => {
    setOpen(false);
    setPanel("root");
    setQuery("");
  };

  const toggle = () => {
    if (open()) close();
    else setOpen(true);
  };

  onMount(() => {
    const onPointer = (event: MouseEvent) => {
      if (!root?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panel() !== "root") setPanel("root");
      else close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <div class="composer-settings" ref={root}>
      <button
        type="button"
        class="composer-settings__trigger"
        classList={{ open: open() }}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={toggle}
      >
        <span>{triggerLabel(props.thinking)}</span>
        <IconChevronDownTrigger />
      </button>
      <Show when={open()}>
        <div class="settings-popover" role="menu">
          <Show when={panel() === "root"}>
            <button
              type="button"
              class="settings-row"
              role="switch"
              aria-checked={fast()}
              aria-label="Fast"
              onClick={() => props.onThinking(nextFastThinking(props.thinking, levels()))}
            >
              <span class="settings-row__label">Fast</span>
              <span class="switch" classList={{ on: fast() }} aria-hidden="true">
                <span class="switch__thumb" />
              </span>
            </button>
            <button
              type="button"
              class="settings-row settings-row--action"
              onClick={() => setPanel("effort")}
            >
              <span class="settings-row__label">Effort</span>
              <span class="settings-row__value">
                {effortLabel(props.thinking)}
                <IconChevronRight size={14} />
              </span>
            </button>
            <button
              type="button"
              class="settings-row settings-row--action"
              onClick={() => setPanel("model")}
            >
              <span class="settings-row__label">Model</span>
              <span class="settings-row__value">
                <span class="settings-row__value-text">{modelName()}</span>
                <IconChevronRight size={14} />
              </span>
            </button>
          </Show>
          <Show when={panel() === "effort"}>
            <button
              type="button"
              class="settings-back"
              onClick={() => setPanel("root")}
            >
              <IconChevronLeft size={14} />
              Effort
            </button>
            <div class="settings-list">
              <For each={levels()}>
                {(level) => (
                  <button
                    type="button"
                    class="settings-item"
                    classList={{ selected: level === props.thinking }}
                    onClick={() => {
                      if (level !== props.thinking) props.onThinking(level);
                      setPanel("root");
                    }}
                  >
                    <span>{effortLabel(level)}</span>
                    <Show when={level === props.thinking}>
                      <IconCheck size={14} />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={panel() === "model"}>
            <button
              type="button"
              class="settings-back"
              onClick={() => {
                setPanel("root");
                setQuery("");
              }}
            >
              <IconChevronLeft size={14} />
              Model
            </button>
            <label class="settings-search">
              <IconSearch size={14} />
              <input
                type="search"
                placeholder="Search models"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <div class="settings-list settings-list--models">
              <Show when={groups().length === 0}>
                <div class="settings-empty">No matching models</div>
              </Show>
              <For each={groups()}>
                {(group) => (
                  <div class="settings-group">
                    <div class="settings-group__label">{group.label}</div>
                    <For each={group.models}>
                      {(model) => {
                        const selected =
                          model.provider === props.modelProvider &&
                          model.id === props.modelId;
                        const hint = modelHint(model);
                        return (
                          <button
                            type="button"
                            class="settings-item"
                            classList={{
                              selected,
                              muted: !model.authenticated,
                            }}
                            onClick={() => {
                              if (selected) {
                                close();
                                return;
                              }
                              props.onModel(model.provider, model.id);
                              close();
                            }}
                          >
                            <span class="settings-item__main">
                              <span>{model.name}</span>
                              <Show when={hint}>
                                <span class="settings-item__hint">{hint}</span>
                              </Show>
                            </span>
                            <Show when={selected}>
                              <IconCheck size={14} />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function IconChevronDownTrigger() {
  return (
    <svg
      class="composer-settings__chevron"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      aria-hidden="true"
    >
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M15.25 10.75L12 14.25L8.75 10.75"
      />
    </svg>
  );
}

export function StatusBanner(props: {
  status: string;
  error?: string;
}) {
  return (
    <Show when={props.status !== "connected" || props.error}>
      <div
        class="status-banner"
        classList={{ error: Boolean(props.error) }}
      >
        {props.error ||
          (props.status === "connecting"
            ? "Connecting to Pi…"
            : "Disconnected from Pi server")}
      </div>
    </Show>
  );
}
