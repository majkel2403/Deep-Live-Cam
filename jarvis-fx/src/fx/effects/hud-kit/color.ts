/** Small colour helpers for canvas / SVG / ECharts code (they need concrete colour strings). */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return [0, 229, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** '#00e5ff', 0.4 → 'rgba(0, 229, 255, 0.4)' */
export function hexA(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`
}

/** Linear mix of two hex colours → rgba string. */
export function mixA(a: string, b: string, t: number, alpha = 1): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  const m = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t)
  return `rgba(${m(0)}, ${m(1)}, ${m(2)}, ${alpha})`
}

/** Semantic HUD colours (mirror tokens.css; canvas cannot read CSS vars cheaply every frame). */
export const SEM = {
  ok: '#3dffa8',
  warn: '#ffb000',
  danger: '#ff3b5c',
  violet: '#8a7dff',
  text: '#d7f6ff',
} as const

/** Deterministic PRNG (mulberry32) so synthetic scenes look the same on every mount. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
