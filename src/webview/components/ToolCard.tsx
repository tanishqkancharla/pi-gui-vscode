import { Show } from "solid-js";

function summarize(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  if (typeof input !== "object") return String(input);
  const record = input as Record<string, unknown>;
  const path = record.path ?? record.file_path ?? record.filePath;
  const command = record.command;
  if (typeof path === "string") return path;
  if (typeof command === "string") return command;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function ToolCard(props: {
  name: string;
  input: unknown;
  output?: string;
  status?: string;
  onOpen?: (path: string) => void;
}) {
  const title = () => {
    switch (props.name) {
      case "read":
        return "Read";
      case "edit":
        return "Edit";
      case "write":
        return "Write";
      case "bash":
        return "Bash";
      default:
        return props.name;
    }
  };
  const summary = () => summarize(props.input);
  const path = () => {
    if (!props.input || typeof props.input !== "object") return undefined;
    const record = props.input as Record<string, unknown>;
    const value = record.path ?? record.file_path ?? record.filePath;
    return typeof value === "string" ? value : undefined;
  };

  return (
    <div class="tool-card">
      <div class="tool-card__header">
        <span class="tool-card__name">{title()}</span>
        <Show when={props.status}>
          <span class="tool-card__status">{props.status}</span>
        </Show>
      </div>
      <Show when={path()} fallback={<div class="tool-card__summary">{summary()}</div>}>
        {(file) => (
          <button
            type="button"
            class="tool-card__path"
            onClick={() => props.onOpen?.(file())}
          >
            {file()}
          </button>
        )}
      </Show>
      <Show when={props.output}>
        <pre class="tool-card__output">{props.output}</pre>
      </Show>
    </div>
  );
}
