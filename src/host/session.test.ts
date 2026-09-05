import { describe, expect, it, vi } from "vitest";
import type { PiSessionHandle } from "@earendil-works/pi-client";
import { isLiveSession, submitToSession } from "./session";

function handle(partial: Partial<PiSessionHandle>): PiSessionHandle {
  return {
    id: "s1",
    active: true,
    attached: true,
    snapshot: undefined,
    subscribe: () => () => {},
    onEvent: () => () => {},
    detach: async () => {},
    dispose: async () => {},
    prompt: async () => undefined as never,
    steer: async () => undefined as never,
    abort: async () => undefined as never,
    setModel: async () => undefined as never,
    setThinking: async () => undefined as never,
    ...partial,
  } as PiSessionHandle;
}

describe("isLiveSession", () => {
  it("requires an attached active handle", () => {
    expect(isLiveSession(undefined)).toBe(false);
    expect(isLiveSession(handle({ active: false }))).toBe(false);
    expect(isLiveSession(handle({ attached: false }))).toBe(false);
    expect(isLiveSession(handle({}))).toBe(true);
  });
});

describe("submitToSession", () => {
  it("ignores blank text", async () => {
    const prompt = vi.fn();
    await submitToSession(handle({ prompt }), "   ");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("prompts when idle and steers during a turn", async () => {
    const prompt = vi.fn(async () => undefined as never);
    const steer = vi.fn(async () => undefined as never);
    await submitToSession(
      handle({ prompt, steer, snapshot: { phase: "idle" } as PiSessionHandle["snapshot"] }),
      "hello",
    );
    expect(prompt).toHaveBeenCalledWith("hello");
    expect(steer).not.toHaveBeenCalled();

    await submitToSession(
      handle({ prompt, steer, snapshot: { phase: "turn" } as PiSessionHandle["snapshot"] }),
      "keep going",
    );
    expect(steer).toHaveBeenCalledWith("keep going");
  });

  it("rejects input during compaction", async () => {
    await expect(
      submitToSession(
        handle({ snapshot: { phase: "compaction" } as PiSessionHandle["snapshot"] }),
        "wait",
      ),
    ).rejects.toThrow(/compaction/);
  });
});
