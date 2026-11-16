/**
 * Procedural low-poly "bust" (head + neck + shoulders) as polylines in model space
 * (y up, roughly −0.6…0.9). Original geometry – no external assets.
 */
export type V3 = [number, number, number]
export type Polyline = V3[]

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function buildBust(density = 1): { lines: Polyline[]; verts: V3[] } {
  const lines: Polyline[] = []
  const verts: V3[] = []
  const rings = Math.round(13 * density)
  const merid = Math.round(20 * density)
  const seg = Math.round(36 * density)

  // head: ellipsoid with a tapered jaw and a slight brow
  const head = (u: number, v: number): V3 => {
    const jaw = 1 - 0.3 * smooth(0.55, 1, v / Math.PI)
    const brow = 1 + 0.05 * Math.exp(-(((v / Math.PI - 0.38) / 0.06) ** 2)) * Math.max(0, Math.sin(u))
    const nose = 0.07 * Math.exp(-(((v / Math.PI - 0.55) / 0.07) ** 2)) * Math.exp(-(((u - Math.PI / 2) / 0.22) ** 2))
    const rx = 0.205 * jaw
    const rz = 0.24 * jaw * brow + nose
    return [Math.sin(v) * Math.cos(u) * rx, 0.59 + Math.cos(v) * 0.27, Math.sin(v) * Math.sin(u) * rz]
  }
  for (let i = 1; i < rings; i++) {
    const v = (i / rings) * Math.PI
    const pl: Polyline = []
    for (let k = 0; k <= seg; k++) pl.push(head((k / seg) * Math.PI * 2, v))
    lines.push(pl)
  }
  for (let j = 0; j < merid; j++) {
    const u = (j / merid) * Math.PI * 2
    const pl: Polyline = []
    for (let k = 0; k <= seg / 2; k++) pl.push(head(u, (k / (seg / 2)) * Math.PI))
    lines.push(pl)
    for (let i = 1; i < rings; i++) verts.push(head(u, (i / rings) * Math.PI))
  }

  // neck
  const neckM = Math.round(12 * density)
  for (let r = 0; r <= 3; r++) {
    const y = 0.38 - (r / 3) * 0.24
    const nr = 0.1 + (r / 3) * 0.025
    const pl: Polyline = []
    for (let k = 0; k <= seg; k++) {
      const u = (k / seg) * Math.PI * 2
      pl.push([Math.cos(u) * nr, y, Math.sin(u) * nr * 1.05])
    }
    lines.push(pl)
  }
  for (let j = 0; j < neckM; j++) {
    const u = (j / neckM) * Math.PI * 2
    lines.push([
      [Math.cos(u) * 0.1, 0.38, Math.sin(u) * 0.105],
      [Math.cos(u) * 0.125, 0.14, Math.sin(u) * 0.13],
    ])
  }

  // shoulders / chest: horizontal superellipse slices growing in width
  // front-view width / depth profile keyed by height: neck base → trapezius → shoulders → chest
  const KEYS: [number, number, number][] = [
    [0.14, 0.13, 0.13],
    [0.09, 0.3, 0.15],
    [0.04, 0.46, 0.17],
    [-0.04, 0.53, 0.19],
    [-0.18, 0.52, 0.2],
    [-0.36, 0.47, 0.2],
    [-0.56, 0.44, 0.19],
  ]
  const profile = (y: number): [number, number] => {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [y0, x0, z0] = KEYS[i]
      const [y1, x1, z1] = KEYS[i + 1]
      if (y <= y0 && y >= y1) {
        const t = smooth(y0, y1, y)
        return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]
      }
    }
    return y > KEYS[0][0] ? [KEYS[0][1], KEYS[0][2]] : [KEYS[KEYS.length - 1][1], KEYS[KEYS.length - 1][2]]
  }
  const torso = (u: number, y: number): V3 => {
    const [rx, rz] = profile(y)
    const cu = Math.cos(u)
    const su = Math.sin(u)
    const p = 0.7 // superellipse exponent → rounder deltoids, flatter chest
    return [Math.sign(cu) * Math.pow(Math.abs(cu), p) * rx, y, Math.sign(su) * Math.pow(Math.abs(su), p) * rz]
  }
  const slices = Math.round(11 * density)
  for (let r = 0; r <= slices; r++) {
    const y = 0.14 - (r / slices) * 0.7
    const pl: Polyline = []
    for (let k = 0; k <= seg; k++) pl.push(torso((k / seg) * Math.PI * 2, y))
    lines.push(pl)
  }
  const tm = Math.round(24 * density)
  for (let j = 0; j < tm; j++) {
    const u = (j / tm) * Math.PI * 2
    const pl: Polyline = []
    for (let r = 0; r <= slices * 3; r++) pl.push(torso(u, 0.14 - (r / (slices * 3)) * 0.7))
    lines.push(pl)
    for (let r = 0; r <= slices; r += 2) verts.push(torso(u, 0.14 - (r / slices) * 0.7))
  }
  return { lines, verts }
}
