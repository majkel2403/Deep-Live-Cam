import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { useGSAP } from '@gsap/react'
import { Decipher, Frame, Glitch, StatusDot } from '@/hud'
import type { OrchestrationSnapshot } from '@/lib/agents'
import type { Quality } from '@/lib/store'
import { useDocumentVisible } from '@/lib/telemetry'
import { MODES, STATUS_META, agentDepth, fmtCompact, fmtElapsed, type CoreMode } from './model'
import type { BridgeState } from './useBridgeState'
import type { CoreFeed } from './CoreCanvas'
import { RadialHud, type RadialAgent } from './RadialHud'
import { Sparkline } from './Sparkline'

gsap.registerPlugin(ScrambleTextPlugin, useGSAP)

// three.js + R3F live in their own chunk so the dashboard chrome paints first
const CoreCanvas = lazy(() => import('./CoreCanvas'))

const MODE_COLOR: Record<CoreMode, string> = {
  standby: 'var(--jx-accent)',
  analyze: 'var(--jx-violet)',
  act: 'var(--jx-accent-2)',
  alarm: 'var(--jx-danger)',
}

const MODE_LINE: Record<CoreMode, string> = {
  standby: 'Wszystkie podsystemy w gotowości',
  analyze: 'Przetwarzam kontekst i planuję kroki',
  act: 'Wykonuję zadania przez agentów',
  alarm: 'Wykryto błąd – wymagana uwaga',
}

/** WebGL failures (no context, lost GPU) degrade to the SVG HUD only. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    console.warn('[bridge] core canvas disabled:', error.message)
  }
  render() {
    if (this.state.failed)
      return (
        <div className="absolute inset-0 grid place-items-center">
          <p className="jx-label text-[0.625rem] text-jx-warn mt-40">WebGL niedostępny · rdzeń w trybie 2D</p>
        </div>
      )
    return this.props.children
  }
}

function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

/** Measured cadence of incoming snapshots (client-side, real). */
function useFeedCadence(snapshot: OrchestrationSnapshot | null) {
  const [state, setState] = useState({ intervalMs: null as number | null, packets: 0 })
  const last = useRef(0)
  useEffect(() => {
    if (!snapshot) return
    const now = performance.now()
    const dt = last.current ? now - last.current : null
    last.current = now
    setState((s) => ({
      packets: s.packets + 1,
      intervalMs: dt === null ? s.intervalMs : s.intervalMs === null ? dt : s.intervalMs + (dt - s.intervalMs) * 0.25,
    }))
  }, [snapshot])
  return state
}

/** GSAP ScrambleText readout: the span's text is owned by GSAP, never by React. */
function ScrambleLabel({ text, reducedMotion, className, style }: { text: string; reducedMotion: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      if (reducedMotion || !el.textContent) {
        el.textContent = text
        return
      }
      gsap.to(el, { duration: 0.9, ease: 'none', scrambleText: { text, chars: '▮▯01#/+', revealDelay: 0.2, speed: 0.5 } })
    },
    { dependencies: [text, reducedMotion] },
  )
  return <span ref={ref} className={className} style={style} />
}

function Corner({ pos, children, className = '' }: { pos: 'tl' | 'tr' | 'bl' | 'br'; children: ReactNode; className?: string }) {
  const place = { tl: 'top-3 left-3.5', tr: 'top-3 right-3.5 text-right items-end', bl: 'bottom-3 left-3.5', br: 'bottom-3 right-3.5 text-right items-end' }[pos]
  // corners would collide with the rings in the narrow centre column (1024–1279 px): hidden there
  return (
    <div data-pos={pos} className={`bx-corner absolute ${place} hidden sm:flex lg:hidden xl:flex flex-col gap-0.5 z-10 ${className}`}>
      {children}
    </div>
  )
}

export function CoreStage({
  snapshot,
  status = 'live',
  bridge,
  accent,
  accent2,
  quality,
  reducedMotion,
}: {
  snapshot: OrchestrationSnapshot | null
  /** link state of the agent source – without data the core must not claim "all systems ready" */
  status?: 'connecting' | 'live' | 'error'
  bridge: BridgeState
  accent: string
  accent2: string
  quality: Quality
  reducedMotion: boolean
}) {
  const host = useRef<HTMLElement>(null)
  const visible = useDocumentVisible()
  const inView = useInView(host)
  const running = visible && inView
  const { agg, mode, eventSeq, errorSeq } = bridge
  const cadence = useFeedCadence(snapshot)

  // ---- feed for the 3D scene (mutable ref → no scene re-render per tick) ---------------------
  const feed = useRef<CoreFeed>({ mode: 'standby', load: 0, rootLoad: 0.3, agents: [], eventSeq: 0, errorSeq: 0, version: 0 })
  const [version, setVersion] = useState(0)
  const agents = snapshot?.agents
  const root = useMemo(() => agents?.find((a) => !a.parentId) ?? agents?.[0], [agents])
  useEffect(() => {
    const list = agents ?? []
    const byId = new Map(list.map((a) => [a.id, a]))
    feed.current = {
      mode,
      load: agg.avgLoad,
      rootLoad: root?.load ?? 0.3,
      agents: list.map((a) => ({ id: a.id, status: a.status, load: a.load, depth: agentDepth(a, byId) })),
      eventSeq,
      errorSeq,
      version: feed.current.version + 1,
    }
    setVersion(feed.current.version)
  }, [agents, root, mode, agg.avgLoad, eventSeq, errorSeq])

  // ---- mode timing --------------------------------------------------------------------------
  // mode start on the data clock (snapshot.ts): derived during render, no effect round-trip
  const [modeClock, setModeClock] = useState(() => ({ mode, since: snapshot?.ts ?? 0 }))
  if (modeClock.mode !== mode) setModeClock({ mode, since: snapshot?.ts ?? 0 })
  const now = snapshot?.ts ?? modeClock.since
  const modeSince = modeClock.since || now

  // ---- per-second event flow, last 30 s (from the snapshot's event buffer) -----------------
  const flow = useMemo(() => {
    const out = Array.from({ length: 30 }, () => 0)
    if (!snapshot) return out
    const t0 = snapshot.ts - 30_000
    for (const e of snapshot.events) {
      if (e.ts <= t0) continue
      const i = Math.min(29, Math.floor((e.ts - t0) / 1000))
      out[i]++
    }
    return out
  }, [snapshot])

  const radialAgents = useMemo<RadialAgent[]>(() => (agents ?? []).map((a) => ({ id: a.id, name: a.name, status: a.status, load: a.load })), [agents])
  const modeMeta = MODES.find((m) => m.id === mode)!
  const lastEvent = agg.lastEvent
  const subline =
    status === 'error' && !snapshot ? 'Brak łącza ze źródłem agentów – czekam na dane' : status === 'connecting' && !snapshot ? 'Łączenie ze źródłem agentów' : lastEvent ? lastEvent.text : MODE_LINE[mode]
  const rootMeta = root ? STATUS_META[root.status] : null
  const demandVersion = reducedMotion || !running ? version : 0

  return (
    <section ref={host} className="bx-core jx-frame-host relative overflow-hidden min-h-0" aria-label="Rdzeń J.A.R.V.I.S – wizualizacja stanu orkiestracji">
      <Frame kind="corners" size={22} stroke={2} />

      {/* 3D core + radial HUD share one square-fitted coordinate space */}
      <div className="absolute inset-x-2 top-2 bottom-[4.6rem]">
        <div className="absolute inset-0 bx-boot bx-core-mask" aria-hidden="true" />
        <div className="absolute inset-0 bx-core-mask">
          <CanvasBoundary>
            <Suspense fallback={<p className="absolute inset-0 grid place-items-center jx-label text-[0.625rem] jx-caret">Rozruch rdzenia</p>}>
              <CoreCanvas feed={feed} accent={accent} hot={accent2} bg="#02060c" quality={quality} reducedMotion={reducedMotion} running={running} version={demandVersion} />
            </Suspense>
          </CanvasBoundary>
        </div>
        <RadialHud mode={mode} agents={radialAgents} load={agg.avgLoad} success={agg.total ? agg.successRate : null} reducedMotion={reducedMotion} paused={!running} />
      </div>

      {/* corner readouts */}
      <Corner pos="tl">
        <span className="jx-label text-[0.625rem]">Rdzeń · {root?.model ?? '—'}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-cmd text-[0.78rem] tracking-[0.2em] text-jx-accent jx-glow-text">{root?.name ?? 'J.A.R.V.I.S'}</span>
          {rootMeta && <StatusDot tone={rootMeta.tone === 'violet' ? 'accent' : rootMeta.tone} pulse={rootMeta.pulse} />}
        </span>
        <span className="jx-num text-[0.625rem] text-jx-dim">
          obc. <span className="text-jx-text">{root ? `${Math.round(root.load * 100)}%` : '—'}</span> · lat. <span className="text-jx-text">{root ? `${Math.round(root.latencyMs)} ms` : '—'}</span>
        </span>
      </Corner>
      <Corner pos="tr">
        <ScrambleLabel text={`TRYB ${modeMeta.code} · ${modeMeta.seg.toUpperCase()}`} reducedMotion={reducedMotion} className="jx-num text-[0.68rem] tracking-[0.18em]" style={{ color: MODE_COLOR[mode] }} />
        <span className="jx-num text-[0.625rem] text-jx-dim">
          w trybie <span className="text-jx-text">{fmtElapsed(now - modeSince)}</span>
        </span>
        <span className="jx-num text-[0.625rem] text-jx-dim">
          tokeny <span className="text-jx-text">{fmtCompact(agg.tokensPerMin)}</span>/min
        </span>
      </Corner>
      <Corner pos="bl" className="bottom-[4.9rem]!">
        <span className="jx-label text-[0.625rem]">Przepływ zdarzeń · 30 s</span>
        <div className="w-28">
          <Sparkline data={flow} min={0} max={Math.max(3, ...flow)} capacity={30} height={20} ariaLabel="Liczba zdarzeń na sekundę w ostatnich 30 sekundach" />
        </div>
        <span className="jx-num text-[0.625rem] text-jx-dim">
          <span className="text-jx-text">{agg.eventsPerMin}</span> zdarzeń/min
        </span>
      </Corner>
      <Corner pos="br" className="bottom-[4.9rem]!">
        <span className="jx-label text-[0.625rem]">Takt źródła</span>
        <span className="jx-num text-[0.78rem] text-jx-accent jx-glow-text">{cadence.intervalMs === null ? '—' : `${(cadence.intervalMs / 1000).toFixed(2)} s`}</span>
        <span className="jx-num text-[0.625rem] text-jx-dim">
          pakiety <span className="text-jx-text">{cadence.packets}</span>
          {!running && <span className="text-jx-warn"> · 3D wstrzymane</span>}
        </span>
      </Corner>

      {/* state label */}
      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-0.5 pointer-events-none px-4 text-center">
        <div className="flex items-center gap-2 jx-label text-[0.625rem]">
          <span className="h-px w-12 bg-gradient-to-l from-[var(--jx-line-strong)] to-transparent" />
          Stan rdzenia · {modeMeta.code}
          <span className="h-px w-12 bg-gradient-to-r from-[var(--jx-line-strong)] to-transparent" />
        </div>
        <motion.div key={mode} initial={reducedMotion ? false : { opacity: 0, scale: 1.15, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.45 }}>
          <Glitch mode="once" trigger={errorSeq || undefined}>
            <Decipher text={modeMeta.label} duration={0.7} className="bx-core-label text-[1.45rem] leading-none" style={{ color: MODE_COLOR[mode] }} />
          </Glitch>
        </motion.div>
        <Decipher text={subline} duration={0.5} className="font-mono text-[0.72rem] text-jx-dim max-w-full truncate" />
      </div>
    </section>
  )
}
