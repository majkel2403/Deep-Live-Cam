/*
 * Tileable value-noise texture for bg-reactbits-eye (ported from React Bits "Evil Eye", MIT + Commons Clause,
 * https://github.com/DavidHDev/react-bits). Generated once per page load and shared by every mount.
 */

const SIZE = 256
const OCTAVES = 8

let cache: Uint8Array | null = null

function hash(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 1274126177
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Periodic value noise: the lattice wraps every `freq` cells, so the texture tiles seamlessly. */
function noise(px: number, py: number, freq: number, seed: number): number {
  const fx = (px / SIZE) * freq
  const fy = (py / SIZE) * freq
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const w = freq | 0
  const wrap = (v: number) => ((v % w) + w) % w
  const x0 = wrap(ix)
  const x1 = wrap(ix + 1)
  const y0 = wrap(iy)
  const y1 = wrap(iy + 1)
  const v00 = hash(x0, y0, seed)
  const v10 = hash(x1, y0, seed)
  const v01 = hash(x0, y1, seed)
  const v11 = hash(x1, y1, seed)
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
}

/** Greyscale RGBA bytes (R = G = B) with eight octaves of fractal noise, contrast-stretched. */
function generate(): Uint8Array {
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let v = 0
      let amp = 0.4
      let total = 0
      for (let o = 0; o < OCTAVES; o++) {
        const freq = 32 * (1 << o)
        v += amp * noise(x, y, freq, o * 31)
        total += amp
        amp *= 0.65
      }
      v = (v / total - 0.5) * 2.2 + 0.5
      const val = Math.round(Math.max(0, Math.min(1, v)) * 255)
      const i = (y * SIZE + x) * 4
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
  }
  return data
}

export const EYE_NOISE_SIZE = SIZE

export function eyeNoise(): Uint8Array {
  cache ??= generate()
  return cache
}
