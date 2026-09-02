import { describe, expect, it } from "vitest";
import type { SessionSnapshot } from "@earendil-works/pi-protocol";
import {
  applyTranscriptProgress,
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
});
