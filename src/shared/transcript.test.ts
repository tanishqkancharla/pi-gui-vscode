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
