/**
 * NumberTicker ported/adapted from Magic UI "Number Ticker"
 *   https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/number-ticker.tsx
 *   License: MIT · Copyright (c) Magic UI
 * Changes: re-targets on every value change (not only once), configurable spring, Polish number
 * formatting, reduced-motion jump, HUD styling. The surrounding telemetry wall is original.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge, LiveBadge } from '../motion-kit/kit'

function NumberTicker({ value, decimals = 0, stiffness, damping, reduced, className }: { value: number; decimals?: number; stiffness: number; damping: number; reduced: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness, damping })
  const isInView = useInView(ref, { once: true, margin: '0px' })
  const fmt = useMemo(() => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }), [decimals])

  useEffect(() => {
    if (!isInView) return
    if (reduced) spring.jump(value)
    motionValue.set(value)
  }, [motionValue, spring, isInView, value, reduced])

  useEffect(
    () =>
      spring.on('change', (latest) => {
        if (ref.current) ref.current.textContent = fmt.format(Number(latest.toFixed(decimals)))
      }),
    [spring, fmt, decimals],
  )

  return (
    <span ref={ref} className={`inline-block tabular-nums ${className ?? ''}`}>
      {fmt.format(0)}
    </span>
  )
}

interface Metric {
  id: string
  label: string
  unit: string
  decimals: number
  live: boolean
  hint: string
  /** higher is better → colours the trend arrow */
  goodUp?: boolean
}

const METRICS: Metric[] = [
  { id: 'fps', label: 'Klatki / s', unit: 'fps', decimals: 0, live: true, hint: 'Liczone z requestAnimationFrame w tej karcie', goodUp: true },
  { id: 'lag', label: 'Opóźnienie pętli', unit: 'ms', decimals: 1, live: true, hint: 'Dryf setInterval względem zegara – obciążenie wątku głównego', goodUp: false },
  { id: 'dom', label: 'Węzły DOM', unit: '', decimals: 0, live: true, hint: 'document.getElementsByTagName("*").length' },
  { id: 'heap', label: 'Sterta JS', unit: 'MB', decimals: 1, live: true, hint: 'performance.memory.usedJSHeapSize (tylko Chromium)' },
  { id: 'session', label: 'Czas sesji', unit: 's', decimals: 0, live: true, hint: 'performance.now() od załadowania strony', goodUp: true },
  { id: 'mpx', label: 'Piksele okna', unit: 'Mpx', decimals: 2, live: true, hint: 'innerWidth × innerHeight × devicePixelRatio²' },
  { id: 'reactor', label: 'Moc reaktora', unit: 'GW', decimals: 2, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: true },
  { id: 'core', label: 'Temp. rdzenia', unit: '°C', decimals: 1, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: false },
  { id: 'packets', label: 'Pakiety / s', unit: '', decimals: 0, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: true },
  { id: 'sats', label: 'Satelity w zasięgu', unit: '', decimals: 0, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: true },
  { id: 'armor', label: 'Integralność pancerza', unit: '%', decimals: 1, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: true },
  { id: 'shield', label: 'Ładunek tarczy', unit: 'kJ', decimals: 0, live: false, hint: 'Wartość syntetyczna (błądzenie losowe)', goodUp: true },
]
const CARD_IDS = ['fps', 'dom', 'session', 'reactor', 'packets', 'armor']

type Values = Record<string, number>
const HIST = 24

const hasHeap = () => typeof performance !== 'undefined' && !!(performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
const heapMB = () => ((performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1048576

function walk(prev: number, lo: number, hi: number, step: number) {
  return Math.min(hi, Math.max(lo, prev + (Math.random() - 0.5) * 2 * step))
}

const statFmt = new Map<number, Intl.NumberFormat>()
function fmtStat(v: number, d: number) {
  let f = statFmt.get(d)
  if (!f) statFmt.set(d, (f = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d })))
  return f.format(v)
}

function Sparkline({ data, live }: { data: number[]; live: boolean }) {
  const grid = (
    <g stroke="var(--jx-line)" strokeOpacity={0.35} strokeDasharray="1 3" vectorEffect="non-scaling-stroke">
      {[8, 15, 22].map((y) => (
        <line key={y} x1={0} x2={100} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
  if (data.length < 2)
    return (
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
        {grid}
      </svg>
    )
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const span = hi - lo || 1
  const pts = data.map((v, i) => `${((i / (HIST - 1)) * 100).toFixed(2)},${(28 - ((v - lo) / span) * 24 - 2).toFixed(2)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full overflow-visible" aria-hidden="true">
      {grid}
      <polyline points={`0,30 ${pts} ${(((data.length - 1) / (HIST - 1)) * 100).toFixed(2)},30`} fill={live ? 'hsl(var(--jx-hue) 100% 55% / 0.12)' : 'rgb(255 176 0 / 0.08)'} stroke="none" />
      <polyline points={pts} fill="none" stroke={live ? 'var(--jx-accent)' : 'var(--jx-warn)'} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function NumberTickerWall({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    stiffness: { value: 100, min: 20, max: 400, step: 5, label: 'sztywność sprężyny' },
    damping: { value: 60, min: 5, max: 120, step: 1, label: 'tłumienie' },
    interval: { value: 1.5, min: 0.5, max: 5, step: 0.1, label: 'odświeżanie (s)' },
    spark: { value: true, label: 'mini-wykresy' },
  })

  const metrics = useMemo(() => {
    const base = METRICS.filter((m) => m.id !== 'heap' || hasHeap())
    return stage ? base : base.filter((m) => CARD_IDS.includes(m.id))
  }, [stage])

  const [values, setValues] = useState<Values>({})
  const [prev, setPrev] = useState<Values>({})
  const [hist, setHist] = useState<Record<string, number[]>>({})
  const current = useRef<Values>({})
  const fps = useRef(0)
  const lag = useRef(0)
  const demo = useRef<Values>({ reactor: 3.12, core: 412, packets: 18400, sats: 23, armor: 97.4, shield: 840 })

  // real FPS (rAF) and event-loop drift; both stop while paused
  useEffect(() => {
    if (paused) return
    let raf = 0
    let frames = 0
    let t0 = performance.now()
    const loop = (now: number) => {
      frames++
      if (now - t0 >= 500) {
        fps.current = (frames * 1000) / (now - t0)
        frames = 0
        t0 = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    let expected = performance.now() + 250
    const drift = window.setInterval(() => {
      const now = performance.now()
      lag.current = lag.current * 0.6 + Math.max(0, now - expected) * 0.4
      expected = now + 250
    }, 250)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(drift)
    }
  }, [paused])

  useEffect(() => {
    if (paused) return
    const sample = () => {
      const d = demo.current
      d.reactor = walk(d.reactor, 2.6, 3.6, 0.08)
      d.core = walk(d.core, 380, 470, 6)
      d.packets = walk(d.packets, 12000, 26000, 1400)
      d.sats = Math.round(walk(d.sats, 18, 31, 1.2))
      d.armor = walk(d.armor, 91, 100, 0.6)
      d.shield = walk(d.shield, 600, 1000, 35)
      const next: Values = {
        fps: fps.current,
        lag: lag.current,
        dom: document.getElementsByTagName('*').length,
        heap: heapMB(),
        session: performance.now() / 1000,
        mpx: (window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1) ** 2) / 1e6,
        ...d,
      }
      setPrev(current.current)
      current.current = next
      setValues(next)
      setHist((hs) => {
        const out: Record<string, number[]> = {}
        for (const k of Object.keys(next)) out[k] = [...(hs[k] ?? []), next[k]].slice(-HIST)
        return out
      })
    }
    const first = window.setTimeout(sample, 300)
    const t = window.setInterval(sample, c.interval * 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(t)
    }
  }, [paused, c.interval])

  const cols = stage ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-3'

  return (
    <div className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg flex flex-col">
      <div className="absolute inset-0 jx-grid-bg opacity-35 pointer-events-none" aria-hidden="true" />
      {stage && (
        <header className="relative flex flex-wrap items-center gap-3 px-8 pt-6">
          <h2 className="m-0 jx-display text-jx-accent jx-glow-text text-lg">Ściana telemetrii</h2>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-2 text-xs text-jx-dim">
            <LiveBadge /> prawdziwy odczyt przeglądarki
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-jx-dim">
            <DemoBadge /> wartość syntetyczna
          </span>
        </header>
      )}
      <div className={`relative flex-1 min-h-0 grid ${cols} auto-rows-fr ${stage ? 'gap-4 p-8 pt-5' : 'gap-1 p-1.5'}`}>
        {metrics.map((m) => {
          const v = values[m.id]
          const p = prev[m.id]
          const diff = v !== undefined && p !== undefined ? v - p : 0
          const eps = 10 ** -m.decimals / 2
          const dir = Math.abs(diff) < eps ? 0 : diff > 0 ? 1 : -1
          const good = m.goodUp === undefined ? null : (dir > 0) === m.goodUp
          const trendCls = dir === 0 || good === null ? 'text-jx-dim' : good ? 'text-jx-ok' : 'text-jx-warn'
          return (
            <div key={m.id} className="relative min-h-0 min-w-0" title={m.hint}>
              <div
                className={`jx-aug h-full flex flex-col min-h-0 ${stage ? 'p-4 gap-1' : 'px-1.5 py-1 gap-0'}`}
                data-augmented-ui="tl-clip br-clip border"
                style={m.live ? undefined : { ['--aug-border-bg' as string]: 'color-mix(in srgb, var(--jx-warn) 45%, transparent)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`jx-label truncate ${stage ? '' : 'text-[0.42rem]! tracking-[0.08em]!'}`}>{m.label}</span>
                  <span className="flex-1" />
                  {stage && (m.live ? <LiveBadge /> : <DemoBadge />)}
                  {!stage && <span className={`size-1 shrink-0 ${m.live ? 'bg-jx-ok' : 'bg-jx-warn'}`} aria-label={m.live ? 'na żywo' : 'demo'} />}
                </div>
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <NumberTicker
                    value={v ?? 0}
                    decimals={m.decimals}
                    stiffness={c.stiffness}
                    damping={c.damping}
                    reduced={reducedMotion}
                    className={`jx-num jx-glow-text leading-none ${m.live ? 'text-jx-accent' : 'text-jx-warn'} ${stage ? 'text-[clamp(1.6rem,2.6vw,2.6rem)]' : 'text-[0.82rem]'}`}
                  />
                  {m.unit && <span className={`jx-num text-jx-dim ${stage ? 'text-sm' : 'text-[0.45rem]'}`}>{m.unit}</span>}
                  <span className="flex-1" />
                  {stage && (
                    <span className={`inline-flex items-center ${trendCls}`} aria-label={dir > 0 ? 'wzrost' : dir < 0 ? 'spadek' : 'bez zmian'}>
                      {dir > 0 ? <IconArrowUpRight size={18} /> : dir < 0 ? <IconArrowDownRight size={18} /> : <IconMinus size={18} />}
                    </span>
                  )}
                </div>
                {c.spark && (
                  <div className={`flex-1 min-h-0 ${stage ? 'mt-3' : 'mt-0.5 max-h-5'}`}>
                    <Sparkline data={hist[m.id] ?? []} live={m.live} />
                  </div>
                )}
                {stage && (
                  <div className="flex items-center gap-3 jx-num text-[0.65rem] text-jx-dim mt-1">
                    <span>min {hist[m.id]?.length ? fmtStat(Math.min(...hist[m.id]), m.decimals) : '—'}</span>
                    <span>maks {hist[m.id]?.length ? fmtStat(Math.max(...hist[m.id]), m.decimals) : '—'}</span>
                    <span className="flex-1" />
                    <span>
                      {hist[m.id]?.length ?? 0}/{HIST} próbek
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
