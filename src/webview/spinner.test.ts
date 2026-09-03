import { describe, expect, it } from "vitest";
import { SPINNER_FRAMES, spinnerFrameAt } from "./spinner";

describe("spinnerFrameAt", () => {
  it("cycles the OpenCode spinner frames", () => {
    expect(SPINNER_FRAMES).toEqual(["\\", "|", "/", "-"]);
    expect(spinnerFrameAt(0)).toBe("\\");
    expect(spinnerFrameAt(1)).toBe("|");
    expect(spinnerFrameAt(4)).toBe("\\");
  });
});
