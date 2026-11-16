import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, motionValue, useAnimationFrame, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { playBleep } from '@/lib/sound'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { rng, SEM } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

/**
 * Multi-target tracker (original). One rAF (Motion's useAnimationFrame) advances a shared clock and
 * writes every object's position into plain MotionValues; each target box follows its object
 * through useSpring, so it lags and overshoots like a real gimbal tracker. Lock-on uses
 * Motion's declarative enter animation. All targets are synthetic → DEMO badge.
 */

interface Track {
  id: string
  /** Lissajous parameters (fractions of the viewport) */
  ax: number
  ay: number
  wx: number
  wy: number
  px: number
  py: number
  wz: number
  pz: number
  x: MotionValue<number>
  y: MotionValue<number>
  d: MotionValue<number>
  hdg: MotionValue<number>
}

function makeTracks(n: number): Track[] {
  const r = rng(4242)
  return Array.from({ length: n }, (_, i) => ({
    id: `T-${String(i + 1).padStart(2, '0')}`,
    ax: 0.18 + r() * 0.24,
    ay: 0.12 + r() * 0.22,
    wx: 0.12 + r() * 0.22,
    wy: 0.1 + r() * 0.3,
    px: r() * Math.PI * 2,
    py: r() * Math.PI * 2,
    wz: 0.08 + r() * 0.15,
    pz: r() * Math.PI * 2,
    x: motionValue(0),
    y: motionValue(0),
    d: motionValue(500),
    hdg: motionValue(0),
  }))
}

function place(tr: Track, t: number, w: number, h: number) {
  const x = w / 2 + Math.sin(t * tr.wx + tr.px) * tr.ax * w + Math.sin(t * tr.wx * 2.3 + tr.py) * 0.04 * w
  const y = h * 0.47 + Math.sin(t * tr.wy + tr.py) * tr.ay * h * 1.2
  const d = 260 + 1100 * (0.5 + 0.5 * Math.sin(t * tr.wz + tr.pz))
  return { x, y, d }
}

function Brackets({ color, thick = 1.5, len = '28%' }: { color: string; thick?: number; len?: string }) {
  const s = { borderColor: color, width: len, height: len, filter: `drop-shadow(0 0 3px ${color})` }
  return (
    <>
      <span className="absolute left-0 top-0 border-l border-t" style={{ ...s, borderLeftWidth: thick, borderTopWidth: thick }} />
      <span className="absolute right-0 top-0 border-r border-t" style={{ ...s, borderRightWidth: thick, borderTopWidth: thick }} />
      <span className="absolute left-0 bottom-0 border-l border-b" style={{ ...s, borderLeftWidth: thick, borderBottomWidth: thick }} />
      <span className="absolute right-0 bottom-0 border-r border-b" style={{ ...s, borderRightWidth: thick, borderBottomWidth: thick }} />
    </>
  )
}

function Target({ tr, locked, accent, stage, stiffness, reduced, minPx, maxPx }: { tr: Track; locked: boolean; accent: string; stage: boolean; stiffness: number; reduced: boolean; minPx: number; maxPx: number }) {
  const spring = reduced ? { stiffness: 900, damping: 80 } : { stiffness, damping: 14, mass: 0.6 }
  const sx = useSpring(tr.x, spring)
  const sy = useSpring(tr.y, spring)
  const size = useTransform(tr.d, (d) => maxPx - ((d - 260) / 1100) * (maxPx - minPx))
  const left = useTransform(() => sx.get() - size.get() / 2)
  const top = useTransform(() => sy.get() - size.get() / 2)
  const dist = useTransform(tr.d, (d) => `${Math.round(d)} m`)
  const glyphRot = useTransform(tr.hdg, (a) => `rotate(${a}deg)`)
  const col = locked ? SEM.danger : accent

  return (
    <>
      {/* the tracked object itself */}
      <motion.div className="absolute left-0 top-0" style={{ x: tr.x, y: tr.y }} aria-hidden="true">
        <motion.svg width="18" height="18" viewBox="-9 -9 18 18" className="-translate-x-1/2 -translate-y-1/2" style={{ transform: glyphRot }}>
          <path d="M8 0 L-6 -6 L-3 0 L-6 6 Z" fill={locked ? SEM.danger : '#cfefff'} opacity={0.9} />
        </motion.svg>
      </motion.div>

      {/* tracking box */}
      <motion.div className="absolute left-0 top-0" style={{ x: left, y: top, width: size, height: size }}>
        <Brackets color={col} thick={locked ? 2 : 1.5} />
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
        <div className="absolute -top-5 left-0 flex items-baseline gap-1.5 whitespace-nowrap">
          <span className={`${LBL} ${stage ? 'text-[0.68rem]' : 'text-[0.5rem]'}`} style={{ color: col }}>
            {tr.id}
          </span>
          {stage && <motion.span className="jx-num text-[0.62rem] text-jx-text/80">{dist}</motion.span>}
        </div>
        <AnimatePresence>
          {locked && (
            <motion.div
              key="lock"
              className="absolute -inset-3"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: 45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 220, damping: 18 }}
            >
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <motion.circle
                  cx="50"
                  cy="50"
                  r="49"
                  fill="none"
                  stroke={SEM.danger}
                  strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="0 1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: 'easeInOut' }}
                />
                {[0, 90, 180, 270].map((a) => (
                  <line key={a} x1="50" y1="-6" x2="50" y2="6" stroke={SEM.danger} strokeWidth="1.5" vectorEffect="non-scaling-stroke" transform={`rotate(${a} 50 50)`} />
                ))}
              </svg>
              <motion.span
                className={`${LBL} absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap ${stage ? 'text-[0.66rem]' : 'text-[0.5rem]'}`}
                style={{ color: SEM.danger, textShadow: `0 0 8px ${SEM.danger}` }}
                initial={{ opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 0.35, 1] }}
                transition={{ delay: reduced ? 0 : 0.7, duration: 0.6 }}
              >
                ◆ Namierzono
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

export default function Targeting({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    targets: { value: 5, min: 1, max: 8, step: 1, label: 'cele' },
    speed: { value: 1, min: 0.2, max: 3, step: 0.1, label: 'prędkość' },
    lockEvery: { value: 3.5, min: 1.5, max: 10, step: 0.5, label: 'zmiana celu (s)' },
    stiffness: { value: 90, min: 20, max: 400, step: 10, label: 'sztywność śledzenia' },
    sound: { value: false, label: 'dźwięk namierzania' },
  })
  const count = stage ? c.targets : Math.min(3, c.targets)
  const tracks = useMemo(() => makeTracks(count), [count])
  const [ref, size] = useSize<HTMLDivElement>()
  const clock = useMotionValue(0)
  // the gun-sight ring turns with the shared clock, so pausing freezes it too
  const sightRot = useTransform(clock, (t) => t * 9)
  const [locked, setLocked] = useState(0)
  const [lockInfo, setLockInfo] = useState({ d: 0, brg: 0 })

  useAnimationFrame((_, delta) => {
    if (paused || !size.width) return
    const t = clock.get() + (Math.min(delta, 100) / 1000) * c.speed * (reducedMotion ? 0.25 : 1)
    clock.set(t)
    for (const tr of tracks) {
      const p = place(tr, t, size.width, size.height)
      const q = place(tr, t + 0.05, size.width, size.height)
      tr.x.set(p.x)
      tr.y.set(p.y)
      tr.d.set(p.d)
      tr.hdg.set((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI)
    }
  })

  // initial placement so the first paint (and paused cards) shows targets in place
  useEffect(() => {
    if (!size.width) return
    for (const tr of tracks) {
      const p = place(tr, clock.get(), size.width, size.height)
      tr.x.jump(p.x)
      tr.y.jump(p.y)
      tr.d.jump(p.d)
    }
  }, [tracks, size.width, size.height, clock])

  // cycle the locked target
  useEffect(() => {
    if (paused || tracks.length < 2) return
    const id = setInterval(() => setLocked((l) => (l + 1) % tracks.length), c.lockEvery * 1000)
    return () => clearInterval(id)
  }, [paused, tracks.length, c.lockEvery])
  const lockedIdx = locked % Math.max(1, tracks.length)

  useEffect(() => {
    if (c.sound && stage && !paused) playBleep('alert')
  }, [lockedIdx, c.sound, stage, paused])

  // locked-target readout (4 Hz)
  useEffect(() => {
    if (!stage || paused) return
    const id = setInterval(() => {
      const tr = tracks[lockedIdx]
      if (!tr || !size.width) return
      const brg = ((Math.atan2(tr.x.get() - size.width / 2, size.height / 2 - tr.y.get()) * 180) / Math.PI + 360) % 360
      setLockInfo({ d: tr.d.get(), brg })
    }, 250)
    return () => clearInterval(id)
  }, [stage, paused, tracks, lockedIdx, size.width, size.height])

  const lt = tracks[lockedIdx]
  const minPx = stage ? 46 : 22
  const maxPx = stage ? 120 : 48

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,var(--jx-accent-faint),transparent_70%)]">
      {/* backdrop: horizon + perspective grid + pitch ladder */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="tg-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0" />
            <stop offset="1" stopColor={accent} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {size.width > 0 && (
          <g>
            <line x1="0" x2={size.width} y1={size.height * 0.62} y2={size.height * 0.62} stroke={accent} strokeOpacity="0.35" />
            {Array.from({ length: 13 }, (_, i) => {
              const x = (i / 12) * size.width
              return <line key={i} x1={size.width / 2 + (x - size.width / 2) * 0.12} y1={size.height * 0.62} x2={x + (x - size.width / 2) * 1.4} y2={size.height} stroke="url(#tg-fade)" />
            })}
            {Array.from({ length: 6 }, (_, i) => {
              const y = size.height * 0.62 + Math.pow((i + 1) / 6, 2) * size.height * 0.38
              return <line key={i} x1="0" x2={size.width} y1={y} y2={y} stroke={accent} strokeOpacity={0.06 + i * 0.03} />
            })}
          </g>
        )}
      </svg>

      {/* central gun-sight */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        <motion.svg width={stage ? 220 : 90} height={stage ? 220 : 90} viewBox="-110 -110 220 220" style={{ rotate: sightRot }}>
          <circle r="100" fill="none" stroke={accent} strokeOpacity="0.35" strokeDasharray="2 6" />
          <circle r="70" fill="none" stroke={accent} strokeOpacity="0.5" strokeDasharray="40 14" />
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1="0" y1={-100} x2="0" y2={i % 9 === 0 ? -86 : -94} stroke={accent} strokeOpacity={i % 9 === 0 ? 0.9 : 0.4} transform={`rotate(${i * 10})`} />
          ))}
        </motion.svg>
        <svg className="absolute inset-0 m-auto" width="40" height="40" viewBox="-20 -20 40 40">
          <path d="M-18 0 H-6 M6 0 H18 M0 -18 V-6 M0 6 V18" stroke={accent2} strokeWidth="1.4" />
          <circle r="2" fill={accent2} />
        </svg>
      </div>

      {/* line from the sight to the locked target */}
      {lt && size.width > 0 && <LockLine key={lt.id} tr={lt} cx={size.width / 2} cy={size.height / 2} />}

      {tracks.map((tr, i) => (
        <Target key={tr.id} tr={tr} locked={i === lockedIdx} accent={accent} stage={stage} stiffness={c.stiffness} reduced={reducedMotion} minPx={minPx} maxPx={maxPx} />
      ))}

      {stage && size.width > 0 && <Tapes clock={clock} accent={accent} accent2={accent2} h={size.height} />}

      <HudChrome
        code="TGT-03 · ŚLEDZENIE"
        title="System namierzania"
        stage={stage}
        badges={<DemoBadge title="Cele i odległości są syntetyczne – symulacja lokalna" />}
        footer={
          stage ? (
            <>
              <span className={`${LBL} text-[0.62rem]`}>
                Śledzone <span className="jx-num text-jx-accent">{tracks.length}</span>
              </span>
              <span className={`${LBL} text-[0.62rem]`}>
                Cel <span className="jx-num text-jx-danger">{lt?.id ?? '—'}</span>
              </span>
              <span className={`${LBL} text-[0.62rem]`}>
                Odległość <span className="jx-num text-jx-accent">{lockInfo.d ? `${Math.round(lockInfo.d)} m` : '—'}</span>
              </span>
              <span className={`${LBL} text-[0.62rem]`}>
                Namiar <span className="jx-num text-jx-accent">{String(Math.round(lockInfo.brg) % 360).padStart(3, '0')}°</span>
              </span>
            </>
          ) : undefined
        }
      />
    </div>
  )
}

function LockLine({ tr, cx, cy }: { tr: Track; cx: number; cy: number }) {
  const x2 = useSpring(tr.x, { stiffness: 120, damping: 20 })
  const y2 = useSpring(tr.y, { stiffness: 120, damping: 20 })
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <motion.line x1={cx} y1={cy} x2={x2} y2={y2} stroke={SEM.danger} strokeOpacity="0.55" strokeDasharray="4 6" />
    </svg>
  )
}

/** Heading tape (top) and speed / altitude tapes (sides) driven by the shared clock. */
function Tapes({ clock, accent, accent2, h }: { clock: MotionValue<number>; accent: string; accent2: string; h: number }) {
  const PX_PER_DEG = 4
  const heading = useTransform(clock, (t) => (((t * 7) % 360) + 360) % 360)
  const tapeX = useTransform(heading, (hd) => -hd * PX_PER_DEG)
  const hdgText = useTransform(heading, (hd) => String(Math.round(hd) % 360).padStart(3, '0'))
  const alt = useTransform(clock, (t) => 4200 + Math.sin(t * 0.21) * 380 + Math.sin(t * 0.9) * 40)
  const spd = useTransform(clock, (t) => 310 + Math.sin(t * 0.33 + 1) * 45)
  const altY = useTransform(alt, (a) => (a % 100) * 0.8)
  const spdY = useTransform(spd, (v) => (v % 10) * 3)
  const altText = useTransform(alt, (a) => `${Math.round(a)}`)
  const spdText = useTransform(spd, (v) => `${Math.round(v)}`)
  const tapeH = Math.min(320, h * 0.5)
  const ticks = []
  for (let d = -180; d <= 540; d += 5) ticks.push(d)
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* heading tape */}
      <div className="absolute left-1/2 top-12 h-9 w-[360px] -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_20%,#000_80%,transparent)]">
        <motion.svg className="absolute left-[180px] top-0 overflow-visible" width={720 * PX_PER_DEG} height="36" style={{ x: tapeX }}>
          {ticks.map((d) => {
            const x = d * PX_PER_DEG
            const major = d % 30 === 0
            const norm = ((d % 360) + 360) % 360
            return (
              <g key={d}>
                <line x1={x} x2={x} y1={major ? 0 : 0} y2={major ? 12 : d % 10 === 0 ? 8 : 4} stroke={accent} strokeOpacity={major ? 0.9 : 0.45} />
                {major && (
                  <text x={x} y="26" fill={accent} fillOpacity="0.85" fontSize="10" textAnchor="middle" fontFamily="Rajdhani, sans-serif" fontWeight="600">
                    {norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0')}
                  </text>
                )}
              </g>
            )
          })}
        </motion.svg>
      </div>
      <div className="absolute left-1/2 top-[5.6rem] -translate-x-1/2 border px-1.5 jx-num text-[0.7rem]" style={{ borderColor: accent2, color: accent2 }}>
        <motion.span>{hdgText}</motion.span>°
      </div>

      {/* speed (left) and altitude (right) tapes */}
      {(
        [
          { side: 'left-8', y: spdY, text: spdText, label: 'PRĘDK. km/h', step: 30 },
          { side: 'right-8', y: altY, text: altText, label: 'WYS. m', step: 80 },
        ] as const
      ).map((tp) => (
        <div key={tp.side} className={`absolute ${tp.side} top-1/2 w-16 -translate-y-1/2 overflow-hidden`} style={{ height: tapeH }}>
          <motion.div className="absolute inset-x-0 -top-10 -bottom-10" style={{ y: tp.y }}>
            {Array.from({ length: Math.ceil((tapeH + 80) / 8) }, (_, i) => (
              <span key={i} className="absolute h-px" style={{ top: i * 8, width: i % 5 === 0 ? 18 : 8, background: accent, opacity: i % 5 === 0 ? 0.8 : 0.35, [tp.side.startsWith('left') ? 'right' : 'left']: 0 }} />
            ))}
          </motion.div>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border bg-black/60 py-0.5 text-center jx-num text-[0.75rem]" style={{ borderColor: accent2, color: accent2 }}>
            <motion.span>{tp.text}</motion.span>
          </div>
          <span className={`${LBL} absolute inset-x-0 top-0 text-center text-[0.55rem]`}>{tp.label}</span>
        </div>
      ))}
    </div>
  )
}
