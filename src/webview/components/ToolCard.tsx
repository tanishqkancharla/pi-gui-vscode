import { Match, Show, Switch, createSignal, type JSX } from "solid-js";
import {
  IconChevronDown,
  IconFile,
  IconFileDiff,
  IconTerminal,
  IconTool,
} from "../icons";
import {
  diffStats,
  errorFooterText,
  genericTitle,
  isToolError,
  isToolPending,
  lineRange,
  splitFilePath,
  toRelativePath,
  toolCommand,
  toolPath,
} from "../toolCall";

export function ToolCard(props: {
  name: string;
  input: unknown;
  output?: string;
  status?: string;
  cwd?: string;
  onOpen?: (path: string) => void;
}) {
  const kind = () => {
    switch (props.name) {
      case "read":
        return "read" as const;
      case "edit":
      case "write":
        return "edit" as const;
      case "bash":
        return "bash" as const;
      default:
        return "generic" as const;
    }
  };

  const absolutePath = () => toolPath(props.input);
  const relativePath = () => {
    const value = absolutePath();
    return value ? toRelativePath(value, props.cwd) : undefined;
  };
  const output = () => props.output?.trim() || undefined;
  const stats = () => (kind() === "edit" ? diffStats(output()) : undefined);

  return (
    <ToolCallFrame
      pending={isToolPending(props.status)}
      defaultOpen={kind() === "bash" || kind() === "edit"}
      output={output()}
      outputClass={kind() === "bash" ? "tool-output tool-output--bash" : "tool-output"}
      error={isToolError(props.status) ? errorFooterText(output()) : undefined}
      icon={
        <Switch>
          <Match when={kind() === "read"}>
            <IconFile size={18} />
          </Match>
          <Match when={kind() === "edit"}>
            <IconFileDiff size={18} />
          </Match>
          <Match when={kind() === "bash"}>
            <IconTerminal size={18} />
          </Match>
          <Match when={true}>
            <IconTool size={18} />
          </Match>
        </Switch>
      }
      header={
        <span class="tool-header-text">
          <span class="tool-header-title">
            <Switch>
              <Match when={kind() === "bash"}>
                <span class="tool-text tool-text--bash">{toolCommand(props.input) || "Running command"}</span>
              </Match>
              <Match when={kind() === "generic"}>
                <span class="tool-text">{genericTitle(props.name)}</span>
              </Match>
              <Match when={true}>
                <FilePathHeader
                  path={relativePath() || (kind() === "read" ? "Reading file" : props.name === "write" ? "Writing file" : "Editing file")}
                  openable={Boolean(absolutePath())}
                  onOpen={() => {
                    const target = absolutePath();
                    if (target) props.onOpen?.(target);
                  }}
                />
              </Match>
            </Switch>
          </span>
          <Show when={kind() === "read" && lineRange(props.input)}>
            <span class="tool-sub-text">{lineRange(props.input)}</span>
          </Show>
          <Show when={stats()}>
            {(value) => (
              <span class="tool-diff-stats">
                <Show when={value().additions > 0}>
                  <span class="tool-diff-stats__additions">+{value().additions}</span>
                </Show>
                <Show when={value().deletions > 0}>
                  <span class="tool-diff-stats__deletions">-{value().deletions}</span>
                </Show>
              </span>
            )}
          </Show>
        </span>
      }
    />
  );
}

function FilePathHeader(props: {
  path: string;
  openable: boolean;
  onOpen: () => void;
}) {
  const parts = () => splitFilePath(props.path);
  return (
    <Show
      when={props.openable}
      fallback={
        <span class="tool-text tool-file-path">
          <span class="tool-file-dir">{parts().dirPath}</span>
          <span class="tool-file-slash">{parts().slash}</span>
          <span class="tool-file-name">{parts().fileName}</span>
        </span>
      }
    >
      <button
        type="button"
        class="tool-text tool-file-path"
        onClick={(event) => {
          event.stopPropagation();
          props.onOpen();
        }}
      >
        <span class="tool-file-dir">{parts().dirPath}</span>
        <span class="tool-file-slash">{parts().slash}</span>
        <span class="tool-file-name">{parts().fileName}</span>
      </button>
    </Show>
  );
}

function ToolCallFrame(props: {
  icon: JSX.Element;
  header: JSX.Element;
  pending: boolean;
  defaultOpen: boolean;
  output?: string;
  outputClass: string;
  error?: string;
}) {
  const [open, setOpen] = createSignal(props.defaultOpen);
  const hasOutput = () => Boolean(props.output);

  return (
    <div class="tool-call" classList={{ "tool-call--pending": props.pending }}>
      <div
        class="tool-header"
        style={{ cursor: hasOutput() ? "pointer" : "default" }}
        onClick={() => hasOutput() && setOpen(!open())}
      >
        <span class="tool-icon">{props.icon}</span>
        {props.header}
        <Show when={hasOutput()}>
          <span class="tool-icon">
            <IconChevronDown
              size={18}
              class={open() ? "tool-icon__chevron is-open" : "tool-icon__chevron"}
            />
          </span>
        </Show>
      </div>
      <Show when={open() && props.output}>
        <div class="tool-output-container">
          <pre class={props.outputClass}>{props.output}</pre>
        </div>
      </Show>
      <Show when={props.error}>
        <div class="tool-footer tool-footer--error">{props.error}</div>
      </Show>
    </div>
  );
}
