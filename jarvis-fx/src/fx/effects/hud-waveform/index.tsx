import { useEffect, useRef, useState } from 'react'
import { IconMicrophone, IconMicrophoneOff } from '@tabler/icons-react'
import { HudButton } from '@/hud'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA, SEM } from '../hud-kit/color'
import { useCanvas2D, type Frame2D } from '../hud-kit/useCanvas2D'
import { spectrumDb, synthBlock, SYNTH_RATE } from './dsp'

/**
 * Oscilloscope + spectrum analyser (original Canvas 2D code).
 * Source A (default): synthetic voice-like test signal → own FFT. Clearly labelled DEMO.
 * Source B: the user's microphone through a WebAudio AnalyserNode – permission is requested
 * only after clicking "Mikrofon"; tracks are stopped and the AudioContext closed on toggle/unmount.
 */

const N = 2048
const DB_MIN = -96
const DB_MAX = -12

interface Mic {
  ctx: AudioContext
  analyser: AnalyserNode
  stream: MediaStream
}

export default function Waveform({ accent, accent2, quality, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    gain: { value: 1.6, min: 0.25, max: 6, step: 0.05, label: 'wzmocnienie' },
    bars: { value: 56, min: 16, max: 128, step: 4, label: 'pasma' },
    smoothing: { value: 0.82, min: 0, max: 0.97, step: 0.01, label: 'wygładzanie' },
    timebase: { value: 20, min: 5, max: 40, step: 1, label: 'podstawa czasu (ms)' },
    mirror: { value: false, label: 'widmo lustrzane' },
  })

  const [mic, setMic] = useState<Mic | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [stats, setStats] = useState({ rms: -Infinity, peakHz: 0 })
  const micRef = useRef<Mic | null>(null)
  useEffect(() => {
    micRef.current = mic
  }, [mic])

  // DSP buffers live for the lifetime of the effect
  const [dspState] = useState(() => ({
    block: new Float32Array(N),
    re: new Float32Array(N),
    im: new Float32Array(N),
    db: new Float32Array(N / 2),
    bars: new Float32Array(128),
    peaks: new Float32Array(128),
    rms: -Infinity,
    peakHz: 0,
  }))
  const buf = useRef(dspState)

  const stopMic = (m: Mic | null) => {
    if (!m) return
    m.stream.getTracks().forEach((tr) => tr.stop())
    void m.ctx.close().catch(() => {})
  }
  // always release the microphone on unmount
  useEffect(() => () => stopMic(micRef.current), [])

  const toggleMic = async () => {
    if (mic) {
      stopMic(mic)
      setMic(null)
      return
    }
    setMicError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Przeglądarka nie udostępnia mikrofonu (wymagany HTTPS lub localhost).')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = N
      analyser.smoothingTimeConstant = 0
      src.connect(analyser) // analyser only – never routed to the speakers
      setMic({ ctx, analyser, stream })
    } catch (e) {
      setMicError(e instanceof Error && e.name === 'NotAllowedError' ? 'Odmówiono dostępu do mikrofonu.' : e instanceof Error ? e.message : 'Nie udało się uruchomić mikrofonu.')
    }
  }

  const draw = ({ ctx, w, h, t, dt }: Frame2D) => {
    const b = buf.current
    const m = micRef.current
    const rate = m ? m.ctx.sampleRate : SYNTH_RATE
    if (dt > 0 || t === 0) {
      if (m) {
        m.analyser.getFloatTimeDomainData(b.block)
        for (let i = 0; i < N; i++) b.block[i] *= c.gain
        spectrumDb(b.block, b.re, b.im, b.db)
      } else {
        synthBlock(b.block, t, c.gain)
        spectrumDb(b.block, b.re, b.im, b.db)
      }
    }

    ctx.clearRect(0, 0, w, h)
    const pad = stage ? 28 : 10
    const top = stage ? 52 : 26
    const split = Math.round(h * (stage ? 0.52 : 0.5))
    const scope = { x: pad, y: top, w: w - pad * 2, h: split - top - (stage ? 18 : 8) }
    const spec = { x: pad, y: split + (stage ? 14 : 6), w: w - pad * 2, h: h - split - (stage ? 54 : 20) }

    // ---------- oscilloscope ----------
    ctx.strokeStyle = hexA(accent, 0.1)
    ctx.lineWidth = 1
    const divX = 10
    const divY = 8
    ctx.beginPath()
    for (let i = 0; i <= divX; i++) {
      const x = scope.x + (scope.w * i) / divX
      ctx.moveTo(x, scope.y)
      ctx.lineTo(x, scope.y + scope.h)
    }
    for (let i = 0; i <= divY; i++) {
      const y = scope.y + (scope.h * i) / divY
      ctx.moveTo(scope.x, y)
      ctx.lineTo(scope.x + scope.w, y)
    }
    ctx.stroke()
    ctx.strokeStyle = hexA(accent, 0.28)
    ctx.beginPath()
    ctx.moveTo(scope.x, scope.y + scope.h / 2)
    ctx.lineTo(scope.x + scope.w, scope.y + scope.h / 2)
    ctx.stroke()
    // minor ticks on the centre axis
    ctx.beginPath()
    for (let i = 0; i <= divX * 5; i++) {
      const x = scope.x + (scope.w * i) / (divX * 5)
      ctx.moveTo(x, scope.y + scope.h / 2 - 2)
      ctx.lineTo(x, scope.y + scope.h / 2 + 2)
    }
    ctx.stroke()

    // rising-edge trigger for a stable trace
    const view = Math.min(N - 1, Math.round((c.timebase / 1000) * rate))
    let start = 0
    for (let i = 1; i < N - view; i++) {
      if (b.block[i - 1] < 0 && b.block[i] >= 0) {
        start = i
        break
      }
    }
    const pts = Math.min(view, Math.round(scope.w * (quality === 'low' ? 1 : 2)))
    const yMid = scope.y + scope.h / 2
    const amp = scope.h / 2 - 2
    const trace = () => {
      ctx.beginPath()
      for (let p = 0; p <= pts; p++) {
        const s = b.block[start + Math.floor((p / pts) * view)]
        const x = scope.x + (p / pts) * scope.w
        const y = yMid - Math.max(-1, Math.min(1, s)) * amp
        if (p === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.strokeStyle = hexA(accent, 0.22)
    ctx.lineWidth = stage ? 6 : 4
    trace()
    ctx.shadowColor = accent
    ctx.shadowBlur = quality === 'low' ? 0 : 8
    ctx.strokeStyle = hexA(accent2, 0.95)
    ctx.lineWidth = 1.4
    trace()
    ctx.restore()
    if (stage) {
      ctx.font = '500 9px "JetBrains Mono", monospace'
      ctx.fillStyle = hexA(accent, 0.6)
      ctx.textAlign = 'left'
      ctx.fillText(`${(c.timebase / divX).toFixed(1)} ms/dz`, scope.x + 4, scope.y + 11)
      ctx.textAlign = 'right'
      ctx.fillText('TRIG ↑ 0.0', scope.x + scope.w - 4, scope.y + 11)
    }

    // ---------- spectrum ----------
    const B = Math.min(128, c.bars)
    const fMin = 40
    const fMax = Math.min(16000, rate / 2)
    const binHz = rate / N
    let rmsAcc = 0
    for (let i = 0; i < N; i++) rmsAcc += b.block[i] * b.block[i]
    b.rms = 10 * Math.log10(rmsAcc / N + 1e-12)
    let best = -Infinity
    for (let i = 2; i < N / 2; i++)
      if (b.db[i] > best) {
        best = b.db[i]
        b.peakHz = i * binHz
      }

    const gap = B > 80 ? 1 : 2
    const bw = (spec.w - gap * (B - 1)) / B
    const grad = ctx.createLinearGradient(0, spec.y + spec.h, 0, spec.y)
    grad.addColorStop(0, hexA(accent, 0.85))
    grad.addColorStop(0.7, hexA(accent2, 0.95))
    grad.addColorStop(1, hexA(SEM.text, 1))
    const base = c.mirror ? spec.y + spec.h / 2 : spec.y + spec.h
    const fullH = c.mirror ? spec.h / 2 : spec.h
    for (let k = 0; k < B; k++) {
      const lo = fMin * Math.pow(fMax / fMin, k / B)
      const hi = fMin * Math.pow(fMax / fMin, (k + 1) / B)
      const i0 = Math.max(1, Math.floor(lo / binHz))
      const i1 = Math.max(i0, Math.min(N / 2 - 1, Math.ceil(hi / binHz)))
      let v = -Infinity
      for (let i = i0; i <= i1; i++) v = Math.max(v, b.db[i])
      const norm = Math.max(0, Math.min(1, (v - DB_MIN) / (DB_MAX - DB_MIN)))
      if (dt > 0) {
        b.bars[k] = norm > b.bars[k] ? norm : b.bars[k] * c.smoothing + norm * (1 - c.smoothing)
        b.peaks[k] = Math.max(b.peaks[k] - dt * 0.35, b.bars[k])
      } else if (t === 0) b.bars[k] = norm
      const x = spec.x + k * (bw + gap)
      const bh = b.bars[k] * fullH
      ctx.fillStyle = grad
      ctx.fillRect(x, base - bh, bw, bh)
      if (c.mirror) {
        ctx.fillStyle = hexA(accent, 0.35)
        ctx.fillRect(x, base, bw, bh)
      }
      // peak-hold cap
      ctx.fillStyle = hexA(accent2, 0.9)
      ctx.fillRect(x, base - b.peaks[k] * fullH - 2, bw, 1.5)
    }
    // frequency axis
    if (stage) {
      ctx.font = '500 9px "JetBrains Mono", monospace'
      ctx.fillStyle = hexA(accent, 0.65)
      ctx.textAlign = 'center'
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        if (f > fMax) continue
        const x = spec.x + (Math.log(f / fMin) / Math.log(fMax / fMin)) * spec.w
        ctx.fillRect(x, spec.y + spec.h + 3, 1, 4)
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, spec.y + spec.h + 16)
      }
      ctx.textAlign = 'left'
      ctx.fillText('Hz', spec.x + spec.w - 10, spec.y + spec.h + 16)
    }
    // baseline
    ctx.fillStyle = hexA(accent, 0.4)
    ctx.fillRect(spec.x, base, spec.w, 1)
  }

  const canvasRef = useCanvas2D(draw, { paused, quality, maxFps: stage ? 60 : 24, timeScale: reducedMotion ? 0.3 : 1 })

  // numeric readouts at 4 Hz (React state, not per frame)
  useEffect(() => {
    if (!stage || paused) return
    const id = setInterval(() => setStats({ rms: buf.current.rms, peakHz: buf.current.peakHz }), 250)
    return () => clearInterval(id)
  }, [stage, paused])

  const live = !!mic
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--jx-accent-faint),transparent_45%,var(--jx-accent-faint))]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label={live ? 'Oscyloskop i widmo sygnału z mikrofonu' : 'Oscyloskop i widmo syntetycznego sygnału testowego'} />
      <HudChrome
        code="AUD-02 · OSC/FFT"
        title={live ? 'Mikrofon – sygnał na żywo' : 'Sygnał syntetyczny'}
        stage={stage}
        badges={
          live ? (
            <span className="jx-label inline-flex items-center gap-1.5 text-[0.62rem] text-jx-ok">
              <span className="jx-dot" data-pulse="true" /> Na żywo · mikrofon
            </span>
          ) : (
            <DemoBadge label={stage ? 'DEMO · SYGNAŁ SYNTETYCZNY' : 'DEMO'} title="Sygnał testowy generowany lokalnie (harmoniczne + formanty) – nie pochodzi z mikrofonu" />
          )
        }
        footer={
          stage ? (
            <>
              <span className="jx-label text-[0.62rem]">
                RMS <span className="jx-num text-jx-accent">{Number.isFinite(stats.rms) ? `${stats.rms.toFixed(1)} dBFS` : '—'}</span>
              </span>
              <span className="jx-label text-[0.62rem]">
                Szczyt <span className="jx-num text-jx-accent">{stats.peakHz ? `${Math.round(stats.peakHz)} Hz` : '—'}</span>
              </span>
              <span className="jx-label text-[0.62rem]">
                FFT <span className="jx-num text-jx-accent">{N}</span>
              </span>
              <span className="flex-1" />
              {micError && <span className="jx-label text-[0.62rem] text-jx-danger" role="alert">{micError}</span>}
            </>
          ) : undefined
        }
      />
      {stage && (
        <div className="absolute right-5 top-11 z-20">
          <HudButton size="sm" active={live} onClick={() => void toggleMic()} icon={live ? <IconMicrophoneOff /> : <IconMicrophone />} aria-label={live ? 'Wyłącz mikrofon' : 'Włącz mikrofon (prośba o zgodę)'}>
            {live ? 'Wyłącz mikrofon' : 'Mikrofon'}
          </HudButton>
        </div>
      )}
    </div>
  )
}
