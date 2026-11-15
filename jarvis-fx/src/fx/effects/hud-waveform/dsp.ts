/**
 * Tiny DSP helpers for the waveform effect (original code):
 *  - a synthetic, voice-like test signal (harmonic series shaped by moving formants)
 *  - an in-place radix-2 FFT
 */

export const SYNTH_RATE = 48000

/** Fill `out` with a synthetic signal at time t (seconds). Deterministic, no randomness per sample except cheap noise. */
export function synthBlock(out: Float32Array, t: number, gain: number) {
  const n = out.length
  // slow prosody: pitch glides, syllable envelope and two moving formants
  const f0 = 118 + 42 * Math.sin(t * 0.9) + 18 * Math.sin(t * 2.7 + 1.3)
  const env = 0.28 + 0.72 * Math.pow(0.5 + 0.5 * Math.sin(t * 5.3) * Math.sin(t * 1.7 + 0.4), 1.4)
  const fm1 = 650 + 250 * Math.sin(t * 1.3)
  const fm2 = 1700 + 600 * Math.sin(t * 0.8 + 2)
  out.fill(0)
  const harmonics = 24
  for (let k = 1; k <= harmonics; k++) {
    const f = f0 * k
    if (f > SYNTH_RATE / 2.2) break
    // formant weighting (two resonances + 1/k roll-off)
    const w = (1 / k) * (0.25 + Math.exp(-(((f - fm1) / 260) ** 2)) * 1.6 + Math.exp(-(((f - fm2) / 380) ** 2)) * 0.9)
    const step = (2 * Math.PI * f) / SYNTH_RATE
    const cs = Math.cos(step)
    const sn = Math.sin(step)
    // start phase so consecutive blocks are not identical
    const p0 = (t * f * 2 * Math.PI) % (2 * Math.PI)
    let re = Math.cos(p0)
    let im = Math.sin(p0)
    for (let i = 0; i < n; i++) {
      out[i] += im * w
      const r2 = re * cs - im * sn
      im = re * sn + im * cs
      re = r2
    }
  }
  // breath noise (xorshift)
  let s = (Math.floor(t * 1000) * 2654435761) >>> 0 || 1
  for (let i = 0; i < n; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    out[i] = (out[i] * 0.42 + ((s >>> 0) / 4294967296 - 0.5) * 0.05) * env * gain
  }
}

/** In-place iterative radix-2 FFT. re/im length must be a power of two. */
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let tmp = re[i]
      re[i] = re[j]
      re[j] = tmp
      tmp = im[i]
      im[i] = im[j]
      im[j] = tmp
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const a = i + j
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** Magnitude spectrum in dBFS of a real block (Hann window). Writes n/2 bins into `db`. */
export function spectrumDb(block: Float32Array, re: Float32Array, im: Float32Array, db: Float32Array) {
  const n = block.length
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
    re[i] = block[i] * w
    im[i] = 0
  }
  fft(re, im)
  const norm = 4 / n
  for (let i = 0; i < n / 2; i++) {
    const mag = Math.hypot(re[i], im[i]) * norm
    db[i] = 20 * Math.log10(mag + 1e-9)
  }
}
