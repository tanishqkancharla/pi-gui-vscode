export function asRecord(input: unknown): Record<string, unknown> | undefined {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (!input || typeof input !== "object") return undefined;
  return input as Record<string, unknown>;
}

export function toolPath(input: unknown): string | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const value = record.path ?? record.file_path ?? record.filePath;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function toolCommand(input: unknown): string | undefined {
  const value = asRecord(input)?.command;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function toRelativePath(absolutePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) return absolutePath;
  const normalizedAbsolute = absolutePath.replace(/\\/g, "/");
  const normalizedRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (normalizedAbsolute === normalizedRoot) return ".";
  if (normalizedAbsolute.startsWith(`${normalizedRoot}/`)) {
    return normalizedAbsolute.slice(normalizedRoot.length + 1);
  }
  return absolutePath;
}

export function splitFilePath(filePath: string): {
  dirPath: string;
  fileName: string;
  slash: string;
} {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastSlash === -1) {
    return { dirPath: "", fileName: filePath, slash: "" };
  }
  const dirPath = filePath.substring(0, lastSlash);
  return {
    dirPath,
    fileName: filePath.substring(lastSlash + 1),
    slash: dirPath ? "/" : "",
  };
}

export function lineRange(input: unknown): string | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const offset = typeof record.offset === "number" ? record.offset : undefined;
  const limit = typeof record.limit === "number" ? record.limit : undefined;
  if (offset === undefined && limit === undefined) return undefined;
  const start = (offset ?? 0) + 1;
  return limit !== undefined ? `L${start}-${start + limit - 1}` : `L${start}+`;
}

export function genericTitle(name: string): string {
  const words = name.split(/[_-]+/).filter(Boolean);
  if (!words.length) return name;
  const labeled = words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
  return labeled.endsWith("ing") ? labeled : `${labeled}ing`;
}

export function isToolPending(status?: string): boolean {
  return status === "running" || status === "pending";
}

export type ToolResultItem = {
  toolCallId: string;
  status: string;
  output?: string;
};

export function indexToolResults(
  items: readonly { role: string; toolCallId?: string; status?: string; output?: string }[],
): Map<string, ToolResultItem> {
  const map = new Map<string, ToolResultItem>();
  for (const item of items) {
    if (item.role !== "tool" || !item.toolCallId) continue;
    map.set(item.toolCallId, {
      toolCallId: item.toolCallId,
      status: item.status ?? "complete",
      output: item.output,
    });
  }
  return map;
}

export function isRenderableToolCall(part: {
  type: string;
  toolName?: string;
  toolCallId?: string;
}): boolean {
  return part.type === "toolCall" && Boolean(part.toolName || part.toolCallId);
}

export function assistantToolCallIds(
  items: readonly {
    role: string;
    content?: readonly { type: string; toolCallId?: string }[];
  }[],
): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.role !== "assistant") continue;
    for (const part of item.content ?? []) {
      if (part.type === "toolCall" && part.toolCallId) ids.add(part.toolCallId);
    }
  }
  return ids;
}

export function resolvedToolStatus(result?: { status: string }): string {
  return result?.status ?? "running";
}

export function isToolError(status?: string): boolean {
  return status === "error";
}

export function errorFooterText(output?: string): string {
  if (!output?.trim()) return "Error";
  if (output.toLowerCase().includes("interrupted")) return "Interrupted";
  return output.trim().split("\n")[0] ?? "Error";
}

export function diffStats(output?: string): { additions: number; deletions: number } | undefined {
  if (!output) return undefined;
  let additions = 0;
  let deletions = 0;
  for (const line of output.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (line.startsWith("+")) additions += 1;
    else if (line.startsWith("-")) deletions += 1;
  }
  if (!additions && !deletions) return undefined;
  return { additions, deletions };
}

export function stringifyInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
