/** Reactor geometry helpers. */
const RAD = Math.PI / 180
/** angle in degrees, 0 = 12 o'clock, clockwise */
export function pt(r: number, deg: number): [number, number] {
  const a = (deg - 90) * RAD
  return [+(r * Math.cos(a)).toFixed(2), +(r * Math.sin(a)).toFixed(2)]
}

export function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r, a0)
  const [x1, y1] = pt(r, a1)
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`
}

export function polygonPath(r: number, n: number, rot = 0): string {
  const p = Array.from({ length: n }, (_, i) => pt(r, rot + (360 / n) * i))
  return `M${p.map(([x, y]) => `${x},${y}`).join(' L')} Z`
}

export function circlePath(r: number): string {
  return `M0,${-r} A${r},${r} 0 1 1 0,${r} A${r},${r} 0 1 1 0,${-r} Z`
}

/** Core morph targets (MorphSVG interpolates between these path strings). */
export const CORE_SHAPES = {
  triangle: polygonPath(54, 3, 180),
  hexagon: polygonPath(47, 6, 0),
  circle: circlePath(39),
}

