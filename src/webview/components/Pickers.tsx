import { For, Show } from "solid-js";
import type { ModelMeta, ThinkingLevel } from "../../shared/messages";

const LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function ModelPicker(props: {
  models: ModelMeta[];
  provider?: string;
  id?: string;
  onChange: (provider: string, id: string) => void;
}) {
  const value = () =>
    props.provider && props.id ? `${props.provider}/${props.id}` : "";
  return (
    <select
      class="picker"
      value={value()}
      onChange={(event) => {
        const [provider, ...rest] = event.currentTarget.value.split("/");
        const id = rest.join("/");
        if (provider && id) props.onChange(provider, id);
      }}
    >
      <option value="">Model</option>
      <For each={props.models}>
        {(model) => (
          <option value={`${model.provider}/${model.id}`}>
            {model.name}
            {model.authenticated ? "" : " (no key)"}
          </option>
        )}
      </For>
    </select>
  );
}

export function ThinkingPicker(props: {
  level: ThinkingLevel;
  allowed?: ThinkingLevel[];
  onChange: (level: ThinkingLevel) => void;
}) {
  const options = () => props.allowed?.length ? props.allowed : LEVELS;
  return (
    <select
      class="picker"
      value={props.level}
      onChange={(event) => props.onChange(event.currentTarget.value as ThinkingLevel)}
    >
      <For each={options()}>
        {(level) => <option value={level}>{level}</option>}
      </For>
    </select>
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
