import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodingAgentServerService } from "./adapter";

describe("CodingAgentServerService", () => {
  const runtimes: Array<{ dispose(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  });

  it(
    "lists sessions from a shared agent dir and creates a protocol runtime",
    { timeout: 60_000 },
    async () => {
      const root = await mkdtemp(join(tmpdir(), "pi-gui-adapter-"));
      const cwd = join(root, "project");
      const agentDir = join(root, "agent");
      await mkdir(cwd, { recursive: true });
      await mkdir(agentDir, { recursive: true });
      const service = await CodingAgentServerService.create({ cwd, agentDir });

    expect(await service.listSessions()).toEqual([]);

    const models = await service.listModels();
    expect(Array.isArray(models)).toBe(true);

    const runtime = await service.createSession({
      id: "11111111-1111-4111-8111-111111111111",
      cwd,
      name: "Adapter test",
    });
    runtimes.push(runtime);

    const snapshot = await runtime.snapshot();
    expect(snapshot.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(snapshot.cwd).toBe(cwd);
    expect(snapshot.phase).toBe("idle");
    expect(snapshot.name).toBe("Adapter test");
    expect(snapshot.transcript).toEqual([]);

    const listed = await service.listSessions();
    expect(listed.some((session) => session.id === snapshot.id)).toBe(true);
    },
  );
});
