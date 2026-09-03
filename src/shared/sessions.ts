export function shouldOpenSession(
  currentId: string | undefined,
  selectedId: string,
): boolean {
  return selectedId.length > 0 && selectedId !== currentId;
}
