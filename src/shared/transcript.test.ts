import { describe, expect, it } from "vitest";
import type { SessionSnapshot } from "@earendil-works/pi-protocol";
import {
  applyTranscriptProgress,
  applyTranscriptSnapshot,
  createTranscriptState,
  selectTranscript,
} from "./transcript";

const snapshot: SessionSnapshot = {
  id: "s1",
  cwd: "/workspace",
  createdAt: 1,
  updatedAt: 1,
  phase: "turn",
  model: { provider: "anthropic", id: "claude" },
  thinkingLevel: "off",
  attached: true,
  locked: false,
  revision: 1,
  transcript: [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "text", text: "Hel" }],
      model: { provider: "anthropic", id: "claude" },
      timestamp: 1,
      status: "streaming",
    },
  ],
  queuedSteer: [],
  queuedSteerCount: 0,
};

describe("applyTranscriptProgress", () => {
  it("appends assistant_delta text without replacing the snapshot", () => {
    const state = createTranscriptState(snapshot);
    const next = applyTranscriptProgress(state, {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 0,
      kind: "text",
      delta: "lo",
    });
    expect(next.snapshot.transcript[0]).toMatchObject({
      content: [{ type: "text", text: "Hel" }],
    });
    const visible = selectTranscript(next);
    expect(visible[0]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
    });
  });

  it("does not invent an empty toolCall stub when a tool delta arrives before the part exists", () => {
    const next = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 1,
      kind: "toolCall",
      delta: '{"command":"ls"}',
    });
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [{ type: "text", text: "Hel" }],
    });
  });

  it("applies toolCall deltas onto an existing named tool part", () => {
    const started = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "item_updated",
      item: {
        id: "a1",
        role: "assistant",
        content: [
          { type: "text", text: "Hel" },
          { type: "toolCall", toolCallId: "c1", toolName: "bash", input: {} },
        ],
        model: { provider: "anthropic", id: "claude" },
        timestamp: 1,
        status: "streaming",
      },
    });
    const next = applyTranscriptProgress(started, {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 1,
      kind: "toolCall",
      delta: '{"command":"ls"}',
    });
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [
        { type: "text", text: "Hel" },
        { type: "toolCall", toolCallId: "c1", toolName: "bash", input: { command: "ls" } },
      ],
    });
  });

  it("grows an empty assistant item when the first delta arrives", () => {
    const empty: SessionSnapshot = {
      ...snapshot,
      transcript: [
        {
          id: "a1",
          role: "assistant",
          content: [],
          model: { provider: "anthropic", id: "claude" },
          timestamp: 1,
          status: "streaming",
        },
      ],
    };
    const next = applyTranscriptProgress(createTranscriptState(empty), {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 0,
      kind: "text",
      delta: "Hi",
    });
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [{ type: "text", text: "Hi" }],
    });
  });
});

describe("applyTranscriptSnapshot", () => {
  it("keeps in-flight deltas that are ahead of a lagging snapshot", () => {
    const streamed = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 0,
      kind: "text",
      delta: "lo world",
    });
    const lagging: SessionSnapshot = {
      ...snapshot,
      revision: 2,
      transcript: [
        {
          id: "a1",
          role: "assistant",
          content: [{ type: "text", text: "Hel" }],
          model: { provider: "anthropic", id: "claude" },
          timestamp: 1,
          status: "streaming",
        },
      ],
    };
    const next = applyTranscriptSnapshot(streamed, lagging);
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [{ type: "text", text: "Hello world" }],
    });
  });

  it("drops progress that invented empty tool stubs once the snapshot has named tools", () => {
    const stubbed = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "item_updated",
      item: {
        id: "a1",
        role: "assistant",
        content: [
          { type: "text", text: "Hello world extra" },
          { type: "toolCall", toolCallId: "", toolName: "", input: "" },
        ],
        model: { provider: "anthropic", id: "claude" },
        timestamp: 1,
        status: "streaming",
      },
    });
    const named: SessionSnapshot = {
      ...snapshot,
      revision: 2,
      transcript: [
        {
          id: "a1",
          role: "assistant",
          content: [
            { type: "text", text: "Hel" },
            { type: "toolCall", toolCallId: "c1", toolName: "bash", input: { command: "ls" } },
          ],
          model: { provider: "anthropic", id: "claude" },
          timestamp: 1,
          status: "streaming",
        },
      ],
    };
    const next = applyTranscriptSnapshot(stubbed, named);
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [
        { type: "text", text: "Hel" },
        { type: "toolCall", toolCallId: "c1", toolName: "bash", input: { command: "ls" } },
      ],
    });
  });

  it("keeps named in-flight tools when a lagging snapshot still has text only", () => {
    const withTool = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "item_updated",
      item: {
        id: "a1",
        role: "assistant",
        content: [
          { type: "text", text: "Hel" },
          { type: "toolCall", toolCallId: "c1", toolName: "bash", input: { command: "ls" } },
        ],
        model: { provider: "anthropic", id: "claude" },
        timestamp: 1,
        status: "streaming",
      },
    });
    const lagging: SessionSnapshot = {
      ...snapshot,
      revision: 2,
      transcript: [
        {
          id: "a1",
          role: "assistant",
          content: [{ type: "text", text: "Hel" }],
          model: { provider: "anthropic", id: "claude" },
          timestamp: 1,
          status: "streaming",
        },
      ],
    };
    const next = applyTranscriptSnapshot(withTool, lagging);
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [
        { type: "text", text: "Hel" },
        { type: "toolCall", toolCallId: "c1", toolName: "bash", input: { command: "ls" } },
      ],
    });
  });

  it("drops progress once the snapshot catches up", () => {
    const streamed = applyTranscriptProgress(createTranscriptState(snapshot), {
      type: "assistant_delta",
      messageId: "a1",
      contentIndex: 0,
      kind: "text",
      delta: "lo",
    });
    const caughtUp: SessionSnapshot = {
      ...snapshot,
      revision: 2,
      phase: "idle",
      transcript: [
        {
          id: "a1",
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          model: { provider: "anthropic", id: "claude" },
          timestamp: 1,
          status: "complete",
          stopReason: "stop",
        },
      ],
    };
    const next = applyTranscriptSnapshot(streamed, caughtUp);
    expect(next.progressItems.size).toBe(0);
    expect(selectTranscript(next)[0]).toMatchObject({
      content: [{ type: "text", text: "Hello" }],
    });
  });
});
