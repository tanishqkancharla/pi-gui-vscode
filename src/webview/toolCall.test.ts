import { describe, expect, it } from "vitest";
import {
  diffStats,
  errorFooterText,
  genericTitle,
  isToolPending,
  lineRange,
  splitFilePath,
  toRelativePath,
  assistantToolCallIds,
  indexToolResults,
  isRenderableToolCall,
  resolvedToolStatus,
  toolCommand,
  toolPath,
} from "./toolCall";

describe("tool call helpers", () => {
  it("extracts path and command from Pi tool input", () => {
    expect(toolPath({ path: "src/app.ts" })).toBe("src/app.ts");
    expect(toolPath({ file_path: "/tmp/x" })).toBe("/tmp/x");
    expect(toolPath({ filePath: "a.ts" })).toBe("a.ts");
    expect(toolCommand({ command: "ls -la" })).toBe("ls -la");
    expect(toolCommand('{"command":"ls"}')).toBe("ls");
    expect(toolPath('{"path":"src/app.ts"}')).toBe("src/app.ts");
    expect(toolPath({ command: "ls" })).toBeUndefined();
  });

  it("hides tool cards that have no name or id yet", () => {
    expect(isRenderableToolCall({ type: "toolCall", toolName: "bash", toolCallId: "c1" })).toBe(true);
    expect(isRenderableToolCall({ type: "toolCall", toolName: "bash" })).toBe(true);
    expect(isRenderableToolCall({ type: "toolCall", toolCallId: "c1" })).toBe(true);
    expect(isRenderableToolCall({ type: "toolCall", toolName: "", toolCallId: "" })).toBe(false);
    expect(isRenderableToolCall({ type: "text" })).toBe(false);
  });

  it("splits and relativizes file paths like OpenCode GUI", () => {
    expect(splitFilePath("src/webview/App.tsx")).toEqual({
      dirPath: "src/webview",
      fileName: "App.tsx",
      slash: "/",
    });
    expect(splitFilePath("README.md")).toEqual({
      dirPath: "",
      fileName: "README.md",
      slash: "",
    });
    expect(toRelativePath("/workspace/src/a.ts", "/workspace")).toBe("src/a.ts");
    expect(toRelativePath("/workspace", "/workspace")).toBe(".");
    expect(toRelativePath("/other/a.ts", "/workspace")).toBe("/other/a.ts");
  });

  it("formats read ranges, generic titles, and pending/error states", () => {
    expect(lineRange({ offset: 0, limit: 10 })).toBe("L1-10");
    expect(lineRange({ offset: 20 })).toBe("L21+");
    expect(genericTitle("web_search")).toBe("Web searching");
    expect(genericTitle("bash")).toBe("Bashing");
    expect(isToolPending("running")).toBe(true);
    expect(isToolPending("pending")).toBe(true);
    expect(isToolPending("complete")).toBe(false);
    expect(isToolPending("called")).toBe(false);
    expect(isToolPending("streaming")).toBe(false);
    expect(errorFooterText("Interrupted by user")).toBe("Interrupted");
    expect(errorFooterText("ENOENT\nmore")).toBe("ENOENT");
  });

  it("counts unified-diff +/- lines", () => {
    expect(
      diffStats("--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new\n+extra\n"),
    ).toEqual({ additions: 2, deletions: 1 });
    expect(diffStats("ok")).toBeUndefined();
  });

  it("resolves assistant tool stubs against later results", () => {
    expect(resolvedToolStatus(undefined)).toBe("running");
    expect(resolvedToolStatus({ status: "complete" })).toBe("complete");
    const items = [
      {
        role: "assistant",
        content: [{ type: "toolCall", toolCallId: "c1" }],
      },
      { role: "tool", toolCallId: "c1", status: "complete", output: "ok" },
      { role: "tool", toolCallId: "orphan", status: "complete", output: "x" },
    ];
    expect(assistantToolCallIds(items)).toEqual(new Set(["c1"]));
    expect(indexToolResults(items).get("c1")).toMatchObject({
      status: "complete",
      output: "ok",
    });
  });
});
