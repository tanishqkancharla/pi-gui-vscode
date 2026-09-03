import type { SessionMeta } from "./messages";

export function shouldOpenSession(
  currentId: string | undefined,
  selectedId: string,
): boolean {
  return selectedId.length > 0 && selectedId !== currentId;
}

export function sessionSortTime(session: {
  createdAt: number;
  updatedAt?: number;
}): number {
  return session.updatedAt ?? session.createdAt;
}

export function sortSessionsNewestFirst<T extends { createdAt: number; updatedAt?: number }>(
  sessions: readonly T[],
): T[] {
  return [...sessions].sort((a, b) => {
    const delta = sessionSortTime(b) - sessionSortTime(a);
    if (delta !== 0) return delta;
    return b.createdAt - a.createdAt;
  });
}

export function overlayCurrentSession(
  sessions: readonly SessionMeta[],
  current?: { id: string; name?: string; updatedAt?: number },
): SessionMeta[] {
  if (!current?.id) return [...sessions];
  let found = false;
  const next = sessions.map((session) => {
    if (session.id !== current.id) return session;
    found = true;
    const name = current.name?.trim();
    return {
      ...session,
      sessionName: name || session.sessionName,
      updatedAt: current.updatedAt ?? session.updatedAt,
    };
  });
  if (!found) {
    next.push({
      id: current.id,
      createdAt: current.updatedAt ?? Date.now(),
      updatedAt: current.updatedAt,
      sessionName: current.name?.trim() || undefined,
    });
  }
  return next;
}
