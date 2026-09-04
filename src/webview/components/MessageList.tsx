import { For, Index, Match, Show, Switch, createMemo, type Accessor } from "solid-js";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import { marked } from "marked";
import {
  assistantToolCallIds,
  indexToolResults,
  isRenderableToolCall,
  resolvedToolStatus,
  type ToolResultItem,
} from "../toolCall";
import { ToolCard } from "./ToolCard";
import { LoadingIndicator } from "./LoadingIndicator";

marked.setOptions({ gfm: true, breaks: true });

type AssistantItem = Extract<TranscriptItem, { role: "assistant" }>;
type AssistantPart = AssistantItem["content"][number];
type ToolCallPart = Extract<AssistantPart, { type: "toolCall" }>;

function userText(item: Extract<TranscriptItem, { role: "user" }>): string {
  return item.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function toolOutput(item: Extract<TranscriptItem, { role: "tool" }>): string {
  return item.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function MessageList(props: {
  items: readonly TranscriptItem[];
  busy?: boolean;
  cwd?: string;
  onOpenFile: (path: string) => void;
}) {
  const results = () =>
    indexToolResults(
      props.items.flatMap((item) => {
        if (item.role !== "tool") return [];
        return [
          {
            role: "tool",
            toolCallId: item.toolCallId,
            status: item.status,
            output: toolOutput(item),
          },
        ];
      }),
    );
  const inlined = () => assistantToolCallIds(props.items);

  return (
    <div class="messages-container" aria-busy={props.busy ? "true" : "false"}>
      <Show when={props.items.length === 0 && !props.busy}>
        <div class="empty-state">Start a session to talk to Pi</div>
      </Show>
      <div class="messages-content">
        <For each={props.items.map((item) => item.id)}>
          {(id) => (
            <MessageById
              id={id}
              items={props.items}
              busy={props.busy}
              cwd={props.cwd}
              results={results()}
              inlined={inlined()}
              onOpenFile={props.onOpenFile}
            />
          )}
        </For>
        <Show when={props.busy}>
          <LoadingIndicator />
        </Show>
      </div>
    </div>
  );
}

function MessageById(props: {
  id: string;
  items: readonly TranscriptItem[];
  busy?: boolean;
  cwd?: string;
  results: Map<string, ToolResultItem>;
  inlined: Set<string>;
  onOpenFile: (path: string) => void;
}) {
  const item = createMemo(() => props.items.find((entry) => entry.id === props.id));
  return (
    <Show when={item() !== undefined}>
      <MessageItem
        item={item()!}
        streaming={Boolean(props.busy) && props.id === props.items.at(-1)?.id}
        cwd={props.cwd}
        results={props.results}
        inlined={props.inlined}
        onOpenFile={props.onOpenFile}
      />
    </Show>
  );
}

function MessageItem(props: {
  item: TranscriptItem;
  streaming?: boolean;
  cwd?: string;
  results: Map<string, ToolResultItem>;
  inlined: Set<string>;
  onOpenFile: (path: string) => void;
}) {
  return (
    <Show
      when={props.item.role === "user"}
      fallback={
        <Show
          when={props.item.role === "assistant"}
          fallback={
            <Show
              when={
                props.item.role === "tool" &&
                !props.inlined.has(
                  (props.item as Extract<TranscriptItem, { role: "tool" }>).toolCallId,
                )
              }
            >
              <div class="message message--tool">
                <ToolCard
                  name={(props.item as Extract<TranscriptItem, { role: "tool" }>).toolName}
                  input={(props.item as Extract<TranscriptItem, { role: "tool" }>).input}
                  output={toolOutput(props.item as Extract<TranscriptItem, { role: "tool" }>)}
                  status={(props.item as Extract<TranscriptItem, { role: "tool" }>).status}
                  cwd={props.cwd}
                  onOpen={props.onOpenFile}
                />
              </div>
            </Show>
          }
        >
          <AssistantMessage
            item={props.item as AssistantItem}
            streaming={props.streaming}
            cwd={props.cwd}
            results={props.results}
            onOpenFile={props.onOpenFile}
          />
        </Show>
      }
    >
      <div class="message message--user">
        <div class="message-content">{userText(props.item as Extract<TranscriptItem, { role: "user" }>)}</div>
      </div>
    </Show>
  );
}

function AssistantMessage(props: {
  item: AssistantItem;
  streaming?: boolean;
  cwd?: string;
  results: Map<string, ToolResultItem>;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div class="message message--assistant">
      <div class="message-content">
        <Index each={props.item.content}>
          {(part) => (
            <AssistantContentPart
              part={part}
              item={props.item}
              streaming={props.streaming}
              cwd={props.cwd}
              results={props.results}
              onOpenFile={props.onOpenFile}
            />
          )}
        </Index>
      </div>
    </div>
  );
}

function AssistantContentPart(props: {
  part: Accessor<AssistantPart>;
  item: AssistantItem;
  streaming?: boolean;
  cwd?: string;
  results: Map<string, ToolResultItem>;
  onOpenFile: (path: string) => void;
}) {
  const current = () => props.part();
  const text = () => {
    const part = current();
    return part.type === "text" ? part.text : "";
  };
  const thinking = () => {
    const part = current();
    return part.type === "thinking" ? part.thinking : "";
  };
  const tool = () => {
    const part = current();
    return part.type === "toolCall" && isRenderableToolCall(part) ? part : undefined;
  };

  return (
    <Switch>
      <Match when={text().length > 0}>
        <Show
          when={props.streaming || props.item.status === "streaming"}
          fallback={<div class="markdown" innerHTML={marked.parse(text()) as string} />}
        >
          <div class="markdown markdown--streaming">{text()}</div>
        </Show>
      </Match>
      <Match when={thinking().length > 0}>
        <div class="thinking-block">{thinking()}</div>
      </Match>
      <Match when={tool() !== undefined}>
        <AssistantToolCall
          part={tool()!}
          result={props.results.get(tool()!.toolCallId)}
          cwd={props.cwd}
          onOpen={props.onOpenFile}
        />
      </Match>
    </Switch>
  );
}

function AssistantToolCall(props: {
  part: ToolCallPart;
  result?: ToolResultItem;
  cwd?: string;
  onOpen?: (path: string) => void;
}) {
  return (
    <ToolCard
      name={props.part.toolName}
      input={props.part.input}
      output={props.result?.output}
      status={resolvedToolStatus(props.result)}
      cwd={props.cwd}
      onOpen={props.onOpen}
    />
  );
}
