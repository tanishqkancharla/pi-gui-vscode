import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import type { SessionMeta } from "../../shared/messages";
import { shouldOpenSession } from "../../shared/sessions";
import { IconChevronDown, IconPlus } from "../icons";

export function TopBar(props: {
  sessions: SessionMeta[];
  currentId: string | undefined;
  currentTitle: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  const title = (session: SessionMeta) =>
    session.sessionName?.trim() || `Session ${session.id.slice(0, 8)}`;

  onMount(() => {
    const onPointer = (event: MouseEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <div class="top-bar">
      <div class="session-switcher" ref={root}>
        <button
          type="button"
          class="session-switcher-button"
          classList={{ active: open() }}
          onClick={() => setOpen(!open())}
        >
          <span class="session-title">{props.currentTitle}</span>
          <IconChevronDown size={14} class="dropdown-arrow" />
        </button>
        <Show when={open()}>
          <div class="session-dropdown">
            <Show when={props.sessions.length === 0}>
              <div class="session-loading">No saved sessions</div>
            </Show>
            <For each={props.sessions}>
              {(session) => (
                <button
                  type="button"
                  class="session-item"
                  classList={{ current: session.id === props.currentId }}
                  onClick={() => {
                    setOpen(false);
                    if (!shouldOpenSession(props.currentId, session.id)) return;
                    props.onSelect(session.id);
                  }}
                >
                  <span class="session-item-title">{title(session)}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <button
        type="button"
        class="new-session-button"
        aria-label="New session"
        onClick={props.onNew}
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}
