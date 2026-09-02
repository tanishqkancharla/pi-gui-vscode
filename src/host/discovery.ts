import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { unlink } from "node:fs/promises";

export const DEFAULT_SOCKET_NAME = "gui.sock";

export function defaultSocketPath(): string {
  return join(homedir(), ".pi", "agent", DEFAULT_SOCKET_NAME);
}

export function resolveSocketPath(configured?: string): string {
  const trimmed = configured?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : defaultSocketPath();
}

export function isSocketListening(
  path: string,
  timeoutMs = 250,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ path });
    const finish = (listening: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(listening);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      finish(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

export async function removeStaleSocket(path: string): Promise<void> {
  if (await isSocketListening(path)) return;
  try {
    await unlink(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}
