import type { PiSessionHandle } from "@earendil-works/pi-client";

export function isLiveSession(
  handle: PiSessionHandle | undefined,
): handle is PiSessionHandle {
  return Boolean(handle?.active && handle.attached);
}

/** Prompt when idle, steer during a turn — same choice RemoteSession.submit used to make. */
export async function submitToSession(
  handle: PiSessionHandle,
  text: string,
): Promise<void> {
  const normalized = text.trim();
  if (!normalized) return;
  const phase = handle.snapshot?.phase;
  if (phase !== "idle" && phase !== "turn") {
    throw new Error(`Session cannot accept input during ${phase ?? "unknown"} phase`);
  }
  if (phase === "idle") {
    await handle.prompt(normalized);
    return;
  }
  await handle.steer(normalized);
}
