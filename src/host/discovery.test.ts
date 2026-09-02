import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServer } from "node:net";
import {
  defaultSocketPath,
  isSocketListening,
  resolveSocketPath,
} from "./discovery";

describe("resolveSocketPath", () => {
  it("uses ~/.pi/agent/gui.sock by default", () => {
    expect(resolveSocketPath()).toBe(defaultSocketPath());
    expect(resolveSocketPath("")).toBe(defaultSocketPath());
    expect(resolveSocketPath("   ")).toBe(defaultSocketPath());
  });

  it("uses a configured path when set", () => {
    expect(resolveSocketPath("/tmp/custom.sock")).toBe("/tmp/custom.sock");
  });
});

describe("isSocketListening", () => {
  it("returns true only while a unix server is accepting connections", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-gui-"));
    const path = join(dir, "gui.sock");
    await writeFile(path, "");
    expect(await isSocketListening(path)).toBe(false);

    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(path, () => resolve());
    });
    try {
      expect(await isSocketListening(path)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
