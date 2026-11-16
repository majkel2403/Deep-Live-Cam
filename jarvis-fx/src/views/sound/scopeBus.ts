/** Tiny bus so players that bypass playBleep (the use-sound demo) can wake the live scope. */
export const wakers = new Set<() => void>()

export function wakeScope() {
  wakers.forEach((w) => w())
}
