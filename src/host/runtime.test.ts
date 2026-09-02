import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TestServerService } from "@earendil-works/pi-server/testing";
import { createUnixServer } from "@earendil-works/pi-server/unix";
import { createPiRuntime, type PiRuntime } from "./runtime";

describe("createPiRuntime", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    const pending = cleanups.splice(0).reverse();
    for (const cleanup of pending) await cleanup();
  });

  it(
    "connects to an already-listening socket and does not start a second server",
    { timeout: 30_000 },
    async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-gui-runtime-"));
    const socketPath = join(dir, "gui.sock");
    const service = new TestServerService();
    service.seed("existing-session", "From CLI");
    const server = createUnixServer(service, { path: socketPath });
    await server.start();
    cleanups.push(() => server.close());

    const runtime = await createPiRuntime({
      cwd: dir,
      configuredSocket: socketPath,
      agentDir: join(dir, "agent"),
    });
    cleanups.push(() => runtime.dispose());

    expect(runtime.startedServer).toBe(false);
    expect(runtime.socketPath).toBe(socketPath);
    expect(runtime.client.connected).toBe(true);
    expect(
      runtime.client.snapshot?.sessions.some((session) => session.id === "existing-session"),
    ).toBe(true);
    },
  );

  it(
    "starts a bundled PiServer when the socket is free",
    { timeout: 60_000 },
    async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-gui-bundled-"));
    const socketPath = join(dir, "gui.sock");
    const runtime: PiRuntime = await createPiRuntime({
      cwd: dir,
      configuredSocket: socketPath,
      agentDir: join(dir, "agent"),
    });
    cleanups.push(() => runtime.dispose());

    expect(runtime.startedServer).toBe(true);
    expect(runtime.client.connected).toBe(true);

    const handle = await runtime.client.createSession({ cwd: dir });
    expect(handle.id.length).toBeGreaterThan(0);
    await handle.dispose();
    },
  );
});
