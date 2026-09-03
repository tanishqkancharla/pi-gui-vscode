import { describe, expect, it } from "vitest";
import { shouldOpenSession } from "./sessions";

describe("shouldOpenSession", () => {
  it("skips the already-open session", () => {
    expect(shouldOpenSession("abc", "abc")).toBe(false);
  });

  it("opens a different session", () => {
    expect(shouldOpenSession("abc", "def")).toBe(true);
  });

  it("opens when nothing is current yet", () => {
    expect(shouldOpenSession(undefined, "abc")).toBe(true);
  });
});
