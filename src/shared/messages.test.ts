import { describe, expect, it } from "vitest";
import { parseHostMessage, parseWebviewMessage } from "./messages";

describe("parseWebviewMessage", () => {
  it("accepts ready, prompt, steer, abort, and session commands", () => {
    expect(parseWebviewMessage({ type: "ready" })).toEqual({ type: "ready" });
    expect(parseWebviewMessage({ type: "prompt", text: "hi" })).toEqual({
      type: "prompt",
      text: "hi",
    });
    expect(parseWebviewMessage({ type: "steer", text: "instead" })).toEqual({
      type: "steer",
      text: "instead",
    });
    expect(parseWebviewMessage({ type: "abort" })).toEqual({ type: "abort" });
    expect(parseWebviewMessage({ type: "new-session" })).toEqual({
      type: "new-session",
    });
    expect(
      parseWebviewMessage({ type: "open-session", sessionId: "abc" }),
    ).toEqual({ type: "open-session", sessionId: "abc" });
    expect(
      parseWebviewMessage({
        type: "set-model",
        provider: "anthropic",
        id: "claude-opus-4-5",
      }),
    ).toEqual({
      type: "set-model",
      provider: "anthropic",
      id: "claude-opus-4-5",
    });
    expect(
      parseWebviewMessage({ type: "search-files", query: "src/" }),
    ).toEqual({ type: "search-files", query: "src/" });
  });

  it("rejects unknown and malformed messages", () => {
    expect(parseWebviewMessage({ type: "proxyFetch" })).toBeNull();
    expect(parseWebviewMessage({ type: "prompt" })).toBeNull();
    expect(parseWebviewMessage(null)).toBeNull();
  });
});

describe("parseHostMessage", () => {
  it("accepts status, error, and snapshot envelopes", () => {
    expect(
      parseHostMessage({ type: "status", status: "connecting" }),
    ).toMatchObject({ type: "status", status: "connecting" });
    expect(
      parseHostMessage({
        type: "error",
        code: "missing-key",
        message: "No API key",
      }),
    ).toMatchObject({ code: "missing-key" });
    expect(
      parseHostMessage({
        type: "server-snapshot",
        sessions: [],
        models: [],
      }),
    ).toMatchObject({ type: "server-snapshot" });
  });

  it("rejects unknown host messages", () => {
    expect(parseHostMessage({ type: "sseEvent" })).toBeNull();
  });
});
