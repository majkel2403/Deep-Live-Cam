import { hueToHex } from '@/lib/store'

/** '#00e5ff' → 0x00e5ff (Vanta / three expect numeric colours). */
export function hexToNum(hex: string): number {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16)
  return Number.isNaN(n) ? 0xffffff : n
}

/** '#00e5ff' → [0, 0.898, 1] (raw WebGL uniforms). */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = hexToNum(hex)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Deep, hue-tinted backdrop colour so every background sits on the same "night ops" base. */
export function deepBg(hue: number, lightness = 3.2, saturation = 70): string {
  return hueToHex(hue, saturation, lightness)
}

/** Accent variants used by multi-colour effects (rings, globe…), always derived from the runtime hue. */
export function accentPalette(hue: number): string[] {
  return [
    hueToHex(hue, 100, 52),
    hueToHex((hue + 24) % 360, 100, 64),
    hueToHex(hue, 100, 78),
    hueToHex((hue + 340) % 360, 90, 42),
    hueToHex(hue, 60, 30),
    hueToHex(hue, 30, 88),
  ]
}

/** Device-pixel-ratio cap by quality tier (cards always render 'low'). */
export function dprFor(quality: 'low' | 'med' | 'high'): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.min(dpr, quality === 'high' ? 2 : quality === 'med' ? 1.5 : 1)
}

/**
 * True for software rasterisers (SwiftShader / llvmpipe – headless CI, GPU-blocklisted machines).
 * Heavy fragment shaders scale their resolution down there instead of stalling the page.
 */
export function isSoftwareGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer)
  } catch {
    return false
  }
}
