import { describe, expect, it } from "vitest";
import {
  overlayCurrentSession,
  shouldOpenSession,
  sortSessionsNewestFirst,
} from "./sessions";

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

describe("sortSessionsNewestFirst", () => {
  it("orders by updatedAt descending", () => {
    const sessions = [
      { id: "old", createdAt: 1, updatedAt: 10, sessionName: "Old" },
      { id: "new", createdAt: 2, updatedAt: 20, sessionName: "New" },
    ];
    expect(sortSessionsNewestFirst(sessions).map((session) => session.id)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("overlayCurrentSession", () => {
  it("replaces the list title with the live session name", () => {
    const sessions = [
      { id: "s1", createdAt: 1, updatedAt: 1, sessionName: "Explain this repo" },
    ];
    expect(
      overlayCurrentSession(sessions, {
        id: "s1",
        name: "Repo walkthrough",
        updatedAt: 99,
      }),
    ).toEqual([
      {
        id: "s1",
        createdAt: 1,
        updatedAt: 99,
        sessionName: "Repo walkthrough",
      },
    ]);
  });
});
