import { For, Show, createSignal } from "solid-js";
import type { SessionMeta } from "../../shared/messages";

export function TopBar(props: {
  sessions: SessionMeta[];
  currentId: string | undefined;
  currentTitle: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  const title = (session: SessionMeta) =>
    session.sessionName?.trim() || `Session ${session.id.slice(0, 8)}`;

  return (
    <div class="top-bar">
      <div class="session-switcher">
        <button
          type="button"
          class="session-switcher-button"
          classList={{ active: open() }}
          onClick={() => setOpen(!open())}
        >
          <span class="session-title">{props.currentTitle}</span>
          <span class="dropdown-arrow">▾</span>
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
        +
      </button>
    </div>
  );
}
