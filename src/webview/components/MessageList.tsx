import { For, Show } from "solid-js";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import { marked } from "marked";
import {
  assistantToolCallIds,
  indexToolResults,
  resolvedToolStatus,
  type ToolResultItem,
} from "../toolCall";
import { ToolCard } from "./ToolCard";

marked.setOptions({ gfm: true, breaks: true });

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
    <div class="messages-container">
      <Show when={props.items.length === 0}>
        <div class="empty-state">Start a session to talk to Pi</div>
      </Show>
      <div class="messages-content">
        <For each={props.items}>
          {(item) => (
            <MessageItem
              item={item}
              streaming={Boolean(props.busy) && item === props.items.at(-1)}
              cwd={props.cwd}
              results={results()}
              inlined={inlined()}
              onOpenFile={props.onOpenFile}
            />
          )}
        </For>
      </div>
    </div>
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
            item={props.item as Extract<TranscriptItem, { role: "assistant" }>}
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
  item: Extract<TranscriptItem, { role: "assistant" }>;
  streaming?: boolean;
  cwd?: string;
  results: Map<string, ToolResultItem>;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div class="message message--assistant">
      <div class="message-content">
        <For each={props.item.content}>
          {(part) => (
            <Show
              when={part.type === "text"}
              fallback={
                <Show
                  when={part.type === "thinking"}
                  fallback={
                    <Show when={part.type === "toolCall"}>
                      <AssistantToolCall
                        part={part as Extract<(typeof props.item.content)[number], { type: "toolCall" }>}
                        result={props.results.get(
                          (part as { toolCallId: string }).toolCallId,
                        )}
                        cwd={props.cwd}
                        onOpen={props.onOpenFile}
                      />
                    </Show>
                  }
                >
                  <div class="thinking-block">
                    {(part as { thinking: string }).thinking}
                  </div>
                </Show>
              }
            >
              <Show
                when={props.streaming || props.item.status === "streaming"}
                fallback={
                  <div
                    class="markdown"
                    innerHTML={marked.parse((part as { text: string }).text) as string}
                  />
                }
              >
                <div class="markdown markdown--streaming">
                  {(part as { text: string }).text}
                </div>
              </Show>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

function AssistantToolCall(props: {
  part: { toolName: string; input: unknown; toolCallId: string };
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
