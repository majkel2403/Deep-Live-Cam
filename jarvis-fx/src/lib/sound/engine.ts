/**
 * One shared AudioContext for every sound backend.
 *
 *   synth voices ─┐
 *                 ├─► bus (GainNode) ─► destination
 *   howler master ┘          └────────► analyser (tap for visualisers)
 *
 * Howler normally creates its own context; `adoptHowler` hands it ours (or adopts its one if it
 * got there first) so the live analyser in the Sound Lab sees both synth and file playback.
 */
type HowlerInternals = {
  ctx?: AudioContext | null
  masterGain?: GainNode | null
  usingWebAudio?: boolean
  _muted?: boolean
  _volume?: number
  _setup?: () => void
}

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let analyser: AnalyserNode | null = null

function wire(ac: AudioContext) {
  bus = ac.createGain()
  analyser = ac.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.55
  bus.connect(ac.destination)
  bus.connect(analyser)
}

function construct(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    return new AC()
  } catch {
    return null
  }
}

/** Shared context + bus. Creates it on first use and nudges a suspended context to resume. */
export function getAudio(create = true): { ctx: AudioContext; bus: AudioNode } | null {
  if (!ctx) {
    if (!create) return null
    ctx = construct()
    if (!ctx) return null
    wire(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return { ctx, bus: bus! }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser
}

export function audioState(): AudioContextState | 'none' {
  return ctx?.state ?? 'none'
}

/** Route howler through our bus. Safe to call more than once. */
export function adoptHowler(howlerGlobal: unknown) {
  const h = howlerGlobal as HowlerInternals
  if (!h || h.usingWebAudio === false) return
  if (h.ctx) {
    if (h.ctx === ctx) return
    if (!ctx) {
      // howler (e.g. via use-sound) created its context first: make it the shared one
      ctx = h.ctx
      wire(ctx)
      if (h.masterGain) {
        try {
          h.masterGain.disconnect()
        } catch {
          /* not connected */
        }
        h.masterGain.connect(bus!)
      }
    }
    // two different contexts (rare): leave howler alone, only the synth is visualised
    return
  }
  const a = getAudio()
  if (!a) return
  const master = a.ctx.createGain()
  master.gain.setValueAtTime(h._muted ? 0 : (h._volume ?? 1), a.ctx.currentTime)
  master.connect(a.bus)
  h.ctx = a.ctx
  h.masterGain = master
  h._setup?.()
}
