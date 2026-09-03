import { Show, onCleanup, createSignal } from "solid-js";
import { SPINNER_FRAMES, SPINNER_TICK_MS, spinnerFrameAt } from "../spinner";

export function LoadingIndicator(props: { compact?: boolean }) {
  const [frame, setFrame] = createSignal(0);
  const timer = setInterval(() => {
    setFrame((index) => (index + 1) % SPINNER_FRAMES.length);
  }, SPINNER_TICK_MS);
  onCleanup(() => clearInterval(timer));

  const glyph = () => spinnerFrameAt(frame());
  return (
    <Show
      when={props.compact}
      fallback={
        <div class="loading-indicator" role="status" aria-label="Working">
          {glyph()}
        </div>
      }
    >
      <span class="loading-indicator session-status-indicator" aria-hidden="true">
        {glyph()}
      </span>
    </Show>
  );
}
