import { CanvasTexture, SRGBColorSpace, type WebGLRenderer } from 'three'

/** One holographic card: a real browser / GPU fact (never synthetic numbers). */
export interface CardFact {
  code: string
  title: string
  value: string
  sub: string
}

export const CARD_W = 512
export const CARD_H = 320

/** Collects real facts about this browser session. Everything here is read from live APIs. */
export function collectFacts(gl: WebGLRenderer, hue: number): CardFact[] {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string }
  }
  const ctx = gl.getContext()
  let gpu = 'niedostępny'
  try {
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    gpu = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
    // "ANGLE (Vendor, Model Direct3D…, …)" → keep the model part only
    const m = /ANGLE \(([^,]+),\s*([^,(]+)/.exec(gpu)
    if (m) gpu = m[2].trim()
  } catch {
    /* keep fallback */
  }
  const maxTex = Number(ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) || 0
  const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—'
  const off = -new Date().getTimezoneOffset()
  const offTxt = `UTC${off >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`
  const now = new Date()
  const mem = nav.deviceMemory
  return [
    { code: 'CPU-01', title: 'Procesor', value: String(nav.hardwareConcurrency || '—'), sub: 'rdzeni logicznych · hardwareConcurrency' },
    { code: 'MEM-02', title: 'Pamięć RAM', value: mem ? `${mem} GB` : '—', sub: mem ? 'deviceMemory · wartość przybliżona' : 'API niedostępne w tej przeglądarce' },
    { code: 'DSP-03', title: 'Ekran', value: `${screen.width}×${screen.height}`, sub: `głębia koloru ${screen.colorDepth} bit` },
    { code: 'DPR-04', title: 'Gęstość pikseli', value: `${window.devicePixelRatio.toFixed(2)}×`, sub: 'devicePixelRatio' },
    { code: 'GPU-05', title: 'Procesor grafiki', value: gpu, sub: 'WEBGL_debug_renderer_info' },
    { code: 'TEX-06', title: 'Maks. tekstura', value: `${maxTex} px`, sub: 'MAX_TEXTURE_SIZE' },
    { code: 'TZ-07', title: 'Strefa czasowa', value: tz.split('/').pop()?.replace(/_/g, ' ') ?? tz, sub: `${tz} · ${offTxt}` },
    { code: 'LNG-08', title: 'Język', value: navigator.language, sub: `${navigator.languages?.length ?? 1} preferowane języki` },
    { code: 'NET-09', title: 'Sieć', value: navigator.onLine ? 'Online' : 'Offline', sub: nav.connection?.effectiveType ? `typ łącza: ${nav.connection.effectiveType}` : 'navigator.onLine' },
    { code: 'GL-10', title: 'Kontekst', value: isGl2 ? 'WebGL 2' : 'WebGL 1', sub: 'kontekst renderowania sceny' },
    { code: 'HUE-11', title: 'Akcent HUD', value: `${Math.round(hue)}°`, sub: 'odcień motywu interfejsu' },
    { code: 'CLK-12', title: 'Start sesji', value: now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }), sub: now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) },
  ]
}

// Orbitron has no Polish glyphs (Fontsource latin subset): values fall back to Oxanium per glyph.
const FONTS = ['600 30px "Chakra Petch"', '700 60px "Orbitron"', '700 60px "Oxanium"', '500 22px "Rajdhani"', '400 18px "JetBrains Mono"']

/** Resolves once the HUD fonts are usable in canvas (falls back silently after 2 s). */
export function loadCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  const all = Promise.all(FONTS.map((f) => document.fonts.load(f, 'ĄĘŁÓŚŻŹĆŃ0123456789'))).then(() => undefined)
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, 2000))])
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Near-white "ink" tinted by the accent (keeps text neutral but on-hue for any --jx-hue). */
function inkOf(accent: string) {
  const [r, g, b] = hexToRgb(accent)
  return (mix: number, al: number) => `rgba(${Math.round(r + (255 - r) * mix)},${Math.round(g + (255 - g) * mix)},${Math.round(b + (255 - b) * mix)},${al})`
}

function chamfer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w - c * 2.4, y)
  ctx.lineTo(x + w - c * 1.6, y + c * 0.8)
  ctx.lineTo(x + w, y + c * 0.8)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number) {
  let px = start
  ctx.font = font(px)
  while (px > 14 && ctx.measureText(text).width > maxW) {
    px -= 2
    ctx.font = font(px)
  }
  return px
}

/** Draws the front face of a card. */
export function drawCard(fact: CardFact, index: number, total: number, accent: string, accent2: string): CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = CARD_W
  cv.height = CARD_H
  const ctx = cv.getContext('2d')!
  const [r, g, b] = hexToRgb(accent)
  const a = (al: number) => `rgba(${r},${g},${b},${al})`
  const ink = inkOf(accent)
  const P = 10

  // glass body
  chamfer(ctx, P, P, CARD_W - P * 2, CARD_H - P * 2, 26)
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  grad.addColorStop(0, a(0.2))
  grad.addColorStop(0.55, a(0.07))
  grad.addColorStop(1, a(0.14))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.save()
  ctx.clip()
  // scanlines
  ctx.fillStyle = a(0.05)
  for (let y = 0; y < CARD_H; y += 4) ctx.fillRect(0, y, CARD_W, 1)
  // faint hex grid in the corner
  ctx.strokeStyle = a(0.1)
  ctx.lineWidth = 1
  for (let gx = 0; gx < 6; gx++)
    for (let gy = 0; gy < 4; gy++) {
      const cx = CARD_W - 150 + gx * 24 + (gy % 2) * 12
      const cy = 120 + gy * 21
      ctx.beginPath()
      for (let k = 0; k < 6; k++) {
        const an = (Math.PI / 3) * k + Math.PI / 6
        const px = cx + Math.cos(an) * 12
        const py = cy + Math.sin(an) * 12
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  ctx.restore()

  // frame
  chamfer(ctx, P, P, CARD_W - P * 2, CARD_H - P * 2, 26)
  ctx.strokeStyle = a(0.75)
  ctx.lineWidth = 2
  ctx.shadowColor = accent
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.shadowBlur = 0
  // corner brackets
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(P + 2, CARD_H - P - 34)
  ctx.lineTo(P + 2, CARD_H - P - 2)
  ctx.lineTo(P + 34, CARD_H - P - 2)
  ctx.stroke()

  // header
  ctx.fillStyle = a(0.9)
  ctx.font = '400 18px "JetBrains Mono", monospace'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(fact.code, P + 30, P + 40)
  ctx.textAlign = 'right'
  ctx.fillStyle = ink(0.82, 0.75)
  ctx.fillText(`${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`, CARD_W - P - 24, P + 50)
  ctx.textAlign = 'left'
  // live dot
  ctx.fillStyle = '#3dffa8'
  ctx.beginPath()
  ctx.arc(P + 140, P + 34, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '500 18px "Rajdhani", sans-serif'
  ctx.fillText('NA ŻYWO', P + 152, P + 40)

  // title
  ctx.fillStyle = ink(0.9, 0.95)
  ctx.font = '600 30px "Chakra Petch", sans-serif'
  ctx.fillText(fact.title.toUpperCase(), P + 30, P + 92)
  ctx.fillStyle = a(0.8)
  ctx.fillRect(P + 30, P + 104, 60, 3)
  ctx.fillStyle = a(0.3)
  ctx.fillRect(P + 94, P + 104, 200, 1)

  // value
  const vf = (px: number) => `700 ${px}px "Orbitron", "Oxanium", sans-serif`
  fitText(ctx, fact.value, vf, 58, CARD_W - P * 2 - 70)
  const vg = ctx.createLinearGradient(0, P + 140, 0, P + 196)
  vg.addColorStop(0, ink(0.94, 1))
  vg.addColorStop(1, accent2)
  ctx.fillStyle = vg
  ctx.shadowColor = accent
  ctx.shadowBlur = 16
  ctx.fillText(fact.value, P + 30, P + 190)
  ctx.shadowBlur = 0

  // sub
  const sf = (px: number) => `500 ${px}px "Rajdhani", sans-serif`
  fitText(ctx, fact.sub, sf, 22, CARD_W - P * 2 - 70)
  ctx.fillStyle = ink(0.7, 0.8)
  ctx.fillText(fact.sub, P + 30, P + 228)

  // decorative ruler (no data)
  ctx.fillStyle = a(0.55)
  for (let i = 0; i < 40; i++) {
    const h = i % 5 === 0 ? 14 : 7
    ctx.fillRect(P + 30 + i * 10, CARD_H - P - 30 - h, 2, h)
  }
  ctx.font = '400 14px "JetBrains Mono", monospace'
  ctx.fillStyle = a(0.75)
  ctx.textAlign = 'right'
  ctx.fillText('ŹRÓDŁO: PRZEGLĄDARKA', CARD_W - P - 26, CARD_H - P - 30)
  ctx.textAlign = 'left'

  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Back face: frame + barcode only (the card faces away from the viewer). */
export function drawBack(accent: string): CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = CARD_W / 2
  cv.height = CARD_H / 2
  const ctx = cv.getContext('2d')!
  const [r, g, b] = hexToRgb(accent)
  const a = (al: number) => `rgba(${r},${g},${b},${al})`
  chamfer(ctx, 5, 5, cv.width - 10, cv.height - 10, 13)
  ctx.fillStyle = a(0.06)
  ctx.fill()
  ctx.strokeStyle = a(0.45)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = a(0.35)
  let x = 24
  let s = 7
  while (x < cv.width - 24) {
    s = (s * 9301 + 49297) % 233280
    const w = 1 + (s % 4)
    ctx.fillRect(x, cv.height - 44, w, 22)
    x += w + 2 + (s % 3)
  }
  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  return tex
}
