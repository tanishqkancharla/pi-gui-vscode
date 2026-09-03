export const SPINNER_FRAMES = ["\\", "|", "/", "-"] as const;
export const SPINNER_TICK_MS = 150;

export function spinnerFrameAt(index: number): string {
  return SPINNER_FRAMES[
    ((index % SPINNER_FRAMES.length) + SPINNER_FRAMES.length) % SPINNER_FRAMES.length
  ];
}
