import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createAnimatedElement, type AnimatedProp, type AnimatedSettings } from '@arwes/animated'
import type { AnimatorNode } from '@arwes/animator'
import IconAntenna from '@tabler/icons-react/icons/IconAntenna'
import IconAtom2 from '@tabler/icons-react/icons/IconAtom2'
import IconBolt from '@tabler/icons-react/icons/IconBolt'
import IconCompass from '@tabler/icons-react/icons/IconCompass'
import IconRefresh from '@tabler/icons-react/icons/IconRefresh'
import IconShield from '@tabler/icons-react/icons/IconShield'
import IconTarget from '@tabler/icons-react/icons/IconTarget'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { createAnimatorShim, type ArwesAnimatorShim } from '@/hud/arwes'
import { HudButton, StatusDot } from '@/hud'
import { DemoBadge } from '../motion-kit/kit'
import './assembly.css'

/*
 * Choreography built on @arwes/animated. Every element is wired with createAnimatedElement(), which
 * subscribes to an animator node (here the project's createAnimatorShim, the same shim Backdrop uses)
 * and runs per-state transitions. Motion comes from the arwes-side alias (motion v10), so the
 * definitions below use Motion 10 option names (easing, delay), not Motion 14's (ease).
 * The assembly is scripted: module values are synthetic and labelled SCENARIUSZ.
 */

type Shim = ArwesAnimatorShim
type Dir = 'enter' | 'exit'

/** Board coordinate system (viewBox units). The board is scaled to fit, so every size is relative. */
const BOARD_W = 1000
const BOARD_H = 640
const CX = 500
const CY = 320
const RING_R = 200

/** Layout per mode: stage = 2 × 3 grid, gallery card = the 2 × 2 subset of it. */
interface Layout {
  w: number
  x: readonly number[]
  y: readonly number[]
  coreR: number
}
const LAYOUT: Record<'stage' | 'card', Layout> = {
  stage: { w: 230, x: [170, 830], y: [100, 320, 540], coreR: 110 },
  card: { w: 300, x: [165, 835], y: [180, 460], coreR: 130 },
}

const PHASES = ['Szkielet', 'Łącza', 'Moduły', 'Telemetria', 'Gotowość', 'Demontaż'] as const
const PHASE_READY = 4

/** Scripted timeline (ms from the start of a cycle). */
const T = { ring: 0, ticks: 180, core: 450, conn: 720, connStep: 110, mod: 1050, modStep: 160, modExitStep: 90 }

interface Part {
  name: string
  v: number
}
interface Mod {
  id: string
  code: string
  name: string
  icon: ReactNode
  tone: 'ok' | 'warn'
  col: 0 | 1
  /** stage row 0..2; the gallery card uses rows 0 and 2 only */
  row: 0 | 1 | 2
  card: boolean
  parts: Part[]
}

/** Synthetic subsystem values (labelled SCENARIUSZ / DEMO in the UI). */
const MODULES: Mod[] = [
  { id: 'reaktor', code: 'MOD-01', name: 'Reaktor', icon: <IconAtom2 />, tone: 'ok', col: 0, row: 0, card: true, parts: [{ name: 'Rdzeń', v: 0.72 }, { name: 'Chłodzenie', v: 0.54 }, { name: 'Osłona', v: 0.91 }] },
  { id: 'zasilanie', code: 'MOD-02', name: 'Zasilanie', icon: <IconBolt />, tone: 'warn', col: 1, row: 0, card: true, parts: [{ name: 'Bateria', v: 0.84 }, { name: 'Obwód A', v: 0.61 }, { name: 'Obwód B', v: 0.38 }] },
  { id: 'nawigacja', code: 'MOD-03', name: 'Nawigacja', icon: <IconCompass />, tone: 'ok', col: 0, row: 1, card: false, parts: [{ name: 'IMU', v: 0.81 }, { name: 'GNSS', v: 0.66 }, { name: 'Mapa', v: 0.73 }] },
  { id: 'lacznosc', code: 'MOD-04', name: 'Łączność', icon: <IconAntenna />, tone: 'ok', col: 1, row: 1, card: false, parts: [{ name: 'Nadajnik', v: 0.62 }, { name: 'Szyfr', v: 0.97 }, { name: 'Antena', v: 0.7 }] },
  { id: 'sensory', code: 'MOD-05', name: 'Sensory', icon: <IconTarget />, tone: 'ok', col: 0, row: 2, card: true, parts: [{ name: 'Optyka', v: 0.58 }, { name: 'Radar', v: 0.77 }, { name: 'Lidar', v: 0.42 }] },
  { id: 'oslony', code: 'MOD-06', name: 'Osłony', icon: <IconShield />, tone: 'ok', col: 1, row: 2, card: true, parts: [{ name: 'Pole', v: 0.88 }, { name: 'Ramię', v: 0.46 }, { name: 'Hełm', v: 0.79 }] },
]

/** Pre-computed SVG geometry: ring, tick marks and the connector to each module's inner edge. */
const RING_D = `M${CX - RING_R},${CY} A${RING_R},${RING_R} 0 1,0 ${CX + RING_R},${CY} A${RING_R},${RING_R} 0 1,0 ${CX - RING_R},${CY}`
const TICKS_D = (() => {
  let d = ''
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const r1 = RING_R - (i % 6 === 0 ? 18 : 8)
    d += `M${(CX + Math.cos(a) * r1).toFixed(1)},${(CY + Math.sin(a) * r1).toFixed(1)} L${(CX + Math.cos(a) * RING_R).toFixed(1)},${(CY + Math.sin(a) * RING_R).toFixed(1)} `
  }
  return d
})()

/** Simple, typed definitions (no function transitions): every transition is plain Motion-10 keyframes. */
function drawSettings(path: SVGPathElement, initial: boolean): AnimatedSettings {
  const len = path.getTotalLength()
  return {
    initialStyle: initial ? { strokeDasharray: `${len}`, strokeDashoffset: `${len}` } : undefined,
    transitions: {
      entering: { strokeDashoffset: [len, 0], easing: 'outCubic' },
      exiting: { strokeDashoffset: [0, len], easing: 'inCubic' },
    },
  }
}

function moduleSettings(dx: number, initial: boolean): AnimatedSettings {
  return {
    initialStyle: initial ? { opacity: 0 } : undefined,
    transitions: {
      entering: { opacity: [0, 1], x: [dx, 0], filter: ['blur(8px)', 'blur(0px)'], easing: 'outCubic' },
      exiting: { opacity: [1, 0], x: [0, dx * 0.5], filter: ['blur(0px)', 'blur(6px)'], easing: 'inCubic' },
    },
  }
}

/** A scan line that sweeps across the module face and fades out as the module comes in. Always hidden at rest, also in the static state. */
function scanSettings(): AnimatedSettings {
  return {
    initialStyle: { opacity: 0, transform: 'scaleX(0)' },
    transitions: { entering: { scaleX: [0, 1], opacity: [0.9, 0], easing: 'inOutCubic' } },
  }
}

function barSettings(index: number, initial: boolean): AnimatedSettings {
  return {
    initialStyle: initial ? { transform: 'scaleX(0)' } : undefined,
    transitions: { entering: { scaleX: [0, 1], delay: 0.25 + index * 0.1, easing: 'outCubic' } },
  }
}

function coreSettings(initial: boolean): AnimatedSettings {
  return {
    initialStyle: initial ? { opacity: 0, transform: 'scale(0.85)' } : undefined,
    transitions: {
      entering: { opacity: [0, 1], scale: [0.85, 1], easing: 'outBack' },
      exiting: { opacity: [1, 0], scale: [1, 0.92], easing: 'inCubic' },
    },
  }
}

interface Groups {
  ring: Shim[]
  ticks: Shim[]
  core: Shim[]
  conn: Shim[][]
  mods: Shim[][]
}

export default function MotionArwesAnimated({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    hold: { value: 3.2, min: 0.5, max: 10, step: 0.1, label: 'pauza w pełnym stanie (s)' },
    arcs: { value: true, label: 'obracające się łuki' },
  })
  const root = useRef<HTMLDivElement>(null)
  const groups = useRef<Groups | null>(null)
  const [phase, setPhase] = useState<number>(PHASE_READY)
  const [run, setRun] = useState(0)

  const motionOn = !reducedMotion && !paused
  /** static (reduced / paused) → the assembled, ready state is shown */
  const shownPhase = motionOn ? phase : PHASE_READY
  const L = stage ? LAYOUT.stage : LAYOUT.card
  const mods = useMemo(() => MODULES.filter((m) => stage || m.card), [stage])
  /** modules with their board positions and the connector anchor on their inner edge */
  const placed = useMemo(
    () =>
      mods.map((m) => {
        const yIdx = stage ? m.row : m.row === 0 ? 0 : 1
        const x = L.x[m.col] ?? 0
        const y = L.y[yIdx] ?? 0
        const ax = m.col === 0 ? x + L.w / 2 : x - L.w / 2
        return { mod: m, x, y, ax, ay: y }
      }),
    [mods, stage, L],
  )
  const connD = useMemo(
    () =>
      placed.map((p) => {
        const dx = p.ax - CX
        const dy = p.ay - CY
        const len = Math.hypot(dx, dy)
        const sx = CX + (dx / len) * L.coreR
        const sy = CY + (dy / len) * L.coreR
        return `M${sx.toFixed(1)},${sy.toFixed(1)} L${p.ax},${p.ay}`
      }),
    [placed, L],
  )

  // build: DOM nodes → animator shims + createAnimatedElement wiring
  useEffect(() => {
    const host = root.current
    if (!host) return
    const entered = !motionOn
    const cancels: Array<() => void> = []
    const attach = (el: Element | null | undefined, enter: number, exit: number, animated: AnimatedProp): Shim | undefined => {
      if (!el) return undefined
      const shim = createAnimatorShim({ enter, exit, interval: 10, startEntered: entered })
      const handle = createAnimatedElement({
        element: el as SVGElement,
        animator: shim as unknown as AnimatorNode,
        settingsRef: { current: { animated, hideOnExited: true } },
      })
      cancels.push(handle.cancel)
      return shim
    }
    const keep = (list: (Shim | undefined)[]) => list.filter((s): s is Shim => s !== undefined)

    const ringEl = host.querySelector<SVGPathElement>('[data-ring]')
    const ticksEl = host.querySelector<SVGPathElement>('[data-ticks]')
    const coreEl = host.querySelector<HTMLElement>('[data-core]')
    const connEls = Array.from(host.querySelectorAll<SVGPathElement>('[data-conn]'))
    const modEls = Array.from(host.querySelectorAll<HTMLElement>('[data-mod]'))

    const next: Groups = {
      ring: keep([attach(ringEl, 1.4, 0.7, ringEl ? drawSettings(ringEl, !entered) : undefined)]),
      ticks: keep([attach(ticksEl, 1.2, 0.5, ticksEl ? drawSettings(ticksEl, !entered) : undefined)]),
      core: keep([attach(coreEl, 0.9, 0.5, coreSettings(!entered))]),
      conn: connEls.map((el) => keep([attach(el, 0.7, 0.4, drawSettings(el, !entered))])),
      mods: modEls.map((el, i) => {
        const dx = placed[i]?.mod.col === 0 ? -40 : 40
        const wipe = el.querySelector<HTMLElement>('[data-wipe]')
        const bars = Array.from(el.querySelectorAll<HTMLElement>('[data-fill]'))
        return keep([
          attach(el, 0.8, 0.45, moduleSettings(dx, !entered)),
          attach(wipe, 0.8, 0.45, scanSettings()),
          ...bars.map((b, j) => attach(b, 0.8, 0.45, barSettings(j, !entered))),
        ])
      }),
    }
    groups.current = next
    return () => {
      cancels.forEach((f) => f())
      groups.current = null
    }
  }, [motionOn, placed, run])

  // sequencer: one scripted cycle (assemble → hold → disassemble), looped; stops when paused
  useEffect(() => {
    const g = groups.current
    if (!motionOn || !g) return
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms))
    }
    const fire = (list: Shim[], dir: Dir) => list.forEach((s) => s.transition(dir))

    const cycle = () => {
      const N = g.mods.length
      const lastMod = T.mod + (N - 1) * T.modStep
      const ready = lastMod + 1100
      const ex = ready + c.hold * 1000
      const end = Math.max(ex + 1300, ex + (N - 1) * T.modExitStep + 700)

      at(0, () => {
        setPhase(0)
        fire(g.ring, 'enter')
      })
      at(T.ticks, () => fire(g.ticks, 'enter'))
      at(T.core, () => fire(g.core, 'enter'))
      at(T.conn, () => setPhase(1))
      g.conn.forEach((list, i) => at(T.conn + i * T.connStep, () => fire(list, 'enter')))
      at(T.mod, () => setPhase(2))
      g.mods.forEach((list, i) => at(T.mod + i * T.modStep, () => fire(list, 'enter')))
      at(lastMod + 600, () => setPhase(3))
      at(ready, () => setPhase(PHASE_READY))

      at(ex, () => setPhase(5))
      g.mods.forEach((list, i) => at(ex + (N - 1 - i) * T.modExitStep, () => fire(list, 'exit')))
      at(ex + 120, () => g.conn.forEach((list) => fire(list, 'exit')))
      at(ex + 360, () => fire(g.core, 'exit'))
      at(ex + 460, () => fire(g.ticks, 'exit'))
      at(ex + 560, () => fire(g.ring, 'exit'))
      at(end, cycle)
    }
    cycle()
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [motionOn, placed, c.hold, run])

  const arcClass = c.arcs && !reducedMotion ? 'ma-spin' : undefined
  const boardW = stage ? 'min(86cqw, calc((100cqh - 140px) * 1.5625))' : 'min(100cqw, calc(100cqh * 1.5625))'

  return (
    <div ref={root} data-paused={paused || undefined} className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg" style={{ containerType: 'size' }}>
      <div className="absolute inset-0 jx-grid-bg opacity-40" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,hsl(var(--jx-hue)_90%_26%/0.22),transparent_62%)]" aria-hidden="true" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: boardW, aspectRatio: `${BOARD_W} / ${BOARD_H}` }}>
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <g className={arcClass}>
            <circle cx={CX} cy={CY} r={236} fill="none" stroke="var(--jx-accent)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="180 40 60 220" />
            <circle cx={CX} cy={CY} r={168} fill="none" stroke="var(--jx-accent)" strokeOpacity={0.22} strokeWidth={1} strokeDasharray="40 30 90 160" />
          </g>
          <line x1={0} x2={BOARD_W} y1={CY} y2={CY} stroke="var(--jx-line)" strokeDasharray="2 8" />
          <line x1={CX} x2={CX} y1={0} y2={BOARD_H} stroke="var(--jx-line)" strokeDasharray="2 8" />
          <path data-ticks d={TICKS_D} fill="none" stroke="var(--jx-accent)" strokeOpacity={0.6} strokeWidth={1.5} />
          <path data-ring d={RING_D} fill="none" stroke="var(--jx-accent)" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px var(--jx-accent))' }} />
          {connD.map((d, i) => (
            <path key={placed[i].mod.id} data-conn d={d} fill="none" stroke="var(--jx-accent)" strokeOpacity={0.75} strokeWidth={1.5} />
          ))}
        </svg>

        {/* core */}
        <div data-core className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${(L.coreR * 2) / 10}%`, aspectRatio: '1' }}>
          <div className="size-full rounded-full border border-jx-accent/70 bg-jx-bg/95 shadow-[0_0_28px_var(--jx-accent)] flex flex-col items-center justify-center gap-1">
            {stage && <span className="jx-label text-[0.625rem]! text-jx-accent!">{PHASES[shownPhase]}</span>}
            <span className={`jx-display text-jx-text leading-none ${stage ? 'text-[clamp(0.8rem,1.5vw,1.3rem)]' : 'text-[0.625rem]'}`}>J.A.R.V.I.S.</span>
            {stage && <span className="jx-num text-[0.65rem] text-jx-dim">{mods.length} modułów</span>}
          </div>
        </div>

        {/* modules */}
        {placed.map(({ mod: m, x, y }) => {
          const avg = Math.round((m.parts.reduce((s, p) => s + p.v, 0) / m.parts.length) * 100)
          return (
            <div key={m.id} className="absolute" style={{ left: `${x / 10}%`, top: `${y / 6.4}%`, width: `${L.w / 10}%`, transform: 'translate(-50%,-50%)' }}>
              <div data-mod className="relative size-full">
                <div
                  data-augmented-ui="tl-clip br-clip border"
                  className={`jx-aug relative size-full overflow-hidden flex flex-col ${stage ? 'gap-2 p-3' : 'gap-1 p-1.5'}`}
                  style={{ ['--aug-border-bg' as string]: m.tone === 'warn' ? 'var(--jx-warn)' : undefined }}
                >
                  <span data-wipe className="absolute inset-0 origin-left bg-jx-accent/35 pointer-events-none" aria-hidden="true" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-jx-accent shrink-0 [&>svg]:size-full ${stage ? 'size-4' : 'size-2.5'}`} aria-hidden="true">
                      {m.icon}
                    </span>
                    <span className={`jx-label truncate ${stage ? '' : 'text-[0.625rem]! tracking-[0.06em]!'}`}>{m.code}</span>
                    <span className="flex-1" />
                    <StatusDot tone={m.tone} pulse={m.tone !== 'ok'} />
                  </div>
                  <div className="flex items-end justify-between gap-2 min-w-0">
                    <span className={`font-head uppercase tracking-wider text-jx-text truncate ${stage ? 'text-base' : 'text-[0.625rem]'}`}>{m.name}</span>
                    <span className={`jx-num text-jx-accent jx-glow-text leading-none ${stage ? 'text-2xl' : 'text-[0.625rem]'}`}>{avg}%</span>
                  </div>
                  {(stage ? m.parts : m.parts.slice(0, 1)).map((p) => (
                    <div key={p.name} className="flex items-center gap-2 min-w-0">
                      {stage && <span className="jx-label w-20 truncate">{p.name}</span>}
                      <span className={`relative flex-1 bg-jx-accent-dim/25 overflow-hidden ${stage ? 'h-1' : 'h-[3px]'}`}>
                        <span data-fill className="absolute inset-y-0 left-0 origin-left bg-jx-accent shadow-[0_0_6px_var(--jx-accent)]" style={{ width: `${p.v * 100}%` }} />
                      </span>
                      {stage && <span className="jx-num text-[0.7rem] text-jx-text/80 w-8 text-right">{Math.round(p.v * 100)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {stage && (
        <header className="absolute left-6 right-6 top-5 flex items-start gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="m-0 font-cmd uppercase tracking-[0.2em] text-jx-accent jx-glow-text text-lg">Montaż modułów</h2>
            <p className="m-0 jx-label">Choreografia · @arwes/animated</p>
          </div>
          <span className="flex-1" />
          <DemoBadge label="SCENARIUSZ" title="Scenariusz montażu – wartości modułów są syntetyczne" />
        </header>
      )}

      {stage && (
        <footer className="absolute left-6 right-6 bottom-4 flex items-center gap-4">
          <ol aria-label="Fazy montażu" className="m-0 p-0 list-none flex flex-1 gap-2 min-w-0">
            {PHASES.map((name, i) => {
              const state = i < shownPhase ? 'done' : i === shownPhase ? 'active' : 'todo'
              return (
                <li
                  key={name}
                  aria-current={i === shownPhase ? 'step' : undefined}
                  className={`flex-1 min-w-0 border-t-2 pt-1.5 truncate jx-label ${state === 'todo' ? 'border-jx-line/50 text-jx-dim' : state === 'active' ? 'border-jx-accent text-jx-accent jx-glow-text' : 'border-jx-accent/60 text-jx-text/80'}`}
                >
                  {String(i + 1).padStart(2, '0')} · {name}
                </li>
              )
            })}
          </ol>
          {!reducedMotion && (
            <HudButton size="sm" icon={<IconRefresh />} onClick={() => setRun((r) => r + 1)}>
              Odtwórz montaż
            </HudButton>
          )}
        </footer>
      )}

      {!stage && <DemoBadge className="absolute right-1.5 top-1.5 scale-75 origin-right" />}
    </div>
  )
}
