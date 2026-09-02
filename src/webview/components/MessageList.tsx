import { For, Show } from "solid-js";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import { marked } from "marked";
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
  onOpenFile: (path: string) => void;
}) {
  return (
    <div class="messages-container">
      <Show when={props.items.length === 0}>
        <div class="empty-state">Start a session to talk to Pi</div>
      </Show>
      <div class="messages-content">
        <For each={props.items}>
          {(item) => <MessageItem item={item} onOpenFile={props.onOpenFile} />}
        </For>
      </div>
    </div>
  );
}

function MessageItem(props: {
  item: TranscriptItem;
  onOpenFile: (path: string) => void;
}) {
  return (
    <Show
      when={props.item.role === "user"}
      fallback={
        <Show
          when={props.item.role === "assistant"}
          fallback={
            <Show when={props.item.role === "tool"}>
              <div class="message message--tool">
                <ToolCard
                  name={(props.item as Extract<TranscriptItem, { role: "tool" }>).toolName}
                  input={(props.item as Extract<TranscriptItem, { role: "tool" }>).input}
                  output={toolOutput(props.item as Extract<TranscriptItem, { role: "tool" }>)}
                  status={(props.item as Extract<TranscriptItem, { role: "tool" }>).status}
                  onOpen={props.onOpenFile}
                />
              </div>
            </Show>
          }
        >
          <AssistantMessage
            item={props.item as Extract<TranscriptItem, { role: "assistant" }>}
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
                      <ToolCard
                        name={(part as { toolName: string }).toolName}
                        input={(part as { input: unknown }).input}
                        status={props.item.status === "streaming" ? "running" : "called"}
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
              <div
                class="markdown"
                innerHTML={marked.parse((part as { text: string }).text) as string}
              />
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
