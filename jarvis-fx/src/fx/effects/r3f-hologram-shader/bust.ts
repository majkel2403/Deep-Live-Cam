import { LatheGeometry, SphereGeometry, Vector2, type BufferGeometry } from 'three'

/**
 * Original procedural "mannequin" bust: a sphere sculpted with a handful of
 * gaussian bumps (nose, brow, sockets, lips, ears, chin) + a lathed neck/shoulder piece.
 * Units: head height ≈ 2.
 */
const g = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s))
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function makeHead(detail = 1): BufferGeometry {
  const geo = new SphereGeometry(1, Math.round(96 * detail), Math.round(72 * detail))
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const front = smooth(0.1, 0.6, z)
    // base proportions
    x *= 0.74
    z *= 0.86
    y *= 1.04
    // jaw + chin taper
    const low = smooth(0.05, -0.95, y)
    x *= 1 - 0.36 * low
    z *= 1 - 0.12 * low
    if (z < 0) z *= 1.1 + 0.08 * smooth(0, 0.6, y) // occiput
    // temples slightly flatter
    x *= 1 - 0.06 * g(y - 0.35, 0.18)
    // brow ridge
    z += 0.05 * front * g(y - 0.26, 0.05) * g(x, 0.42)
    // eye sockets
    z -= 0.07 * front * g(Math.abs(x) - 0.27, 0.09) * g(y - 0.12, 0.07)
    // cheekbones
    z += 0.03 * front * g(Math.abs(x) - 0.38, 0.1) * g(y + 0.06, 0.08)
    // nose: ridge + tip
    const nose = g(x, 0.07 + 0.05 * smooth(0.15, -0.2, y)) * (g(y + 0.05, 0.14) * 0.16 + g(y + 0.17, 0.05) * 0.08)
    z += nose * front
    // lips and mouth groove
    z += 0.035 * front * g(y + 0.36, 0.04) * g(x, 0.14)
    z -= 0.02 * front * g(y + 0.42, 0.012) * g(x, 0.16)
    // chin
    z += 0.05 * front * g(y + 0.66, 0.07) * g(x, 0.16)
    // ears
    const side = Math.abs(x)
    if (side > 0.45) x += Math.sign(x) * 0.09 * g(z + 0.02, 0.1) * g(y - 0.02, 0.13)
    pos.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()
  return geo
}

export function makeShoulders(detail = 1): BufferGeometry {
  const prof = [
    new Vector2(0.001, -0.62),
    new Vector2(0.3, -0.62),
    new Vector2(0.31, -0.9),
    new Vector2(0.36, -1.1),
    new Vector2(0.6, -1.26),
    new Vector2(1.08, -1.36),
    new Vector2(1.36, -1.52),
    new Vector2(1.5, -1.78),
    new Vector2(1.52, -2.25),
    new Vector2(0.001, -2.25),
  ]
  const geo = new LatheGeometry(prof, Math.round(72 * detail))
  // flatten front-to-back so it reads as a chest, not a bell
  geo.scale(1, 1, 0.52)
  geo.computeVertexNormals()
  return geo
}
