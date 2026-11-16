/**
 * Floor grid ported/adapted from Magic UI "Retro Grid" (CSS variant)
 *   https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/retro-grid.tsx
 *   License: MIT · Copyright (c) Magic UI
 * Changes: hue-driven line colour + optional neon glow pass, vanishing line pinned to a horizon,
 * one-cell seamless scroll with live speed / pause. Sun, mountains, stars and title are original.
 */
import { useMemo, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { useElementSize } from '../motion-kit/useElementSize'
import '../motion-kit/kit.css'
import './retro.css'

/** Deterministic PRNG so stars / ridges do not jump between renders. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function ridge(seed: number, peaks: number, amp: number) {
  const r = rng(seed)
  const pts: [number, number][] = [[0, 100]]
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * 1000
    // flatter in the middle so the sun stays visible
    const mid = 1 - Math.exp(-(((x - 500) / 260) ** 2)) * 0.85
    pts.push([x, 100 - (20 + r() * 80) * amp * mid])
  }
  pts.push([1000, 100])
  return pts
}

/** Sun gradient hues: complementary to the accent, but steered away from the (muddy) green band. */
function sunHues(hue: number) {
  const green = (x: number) => x > 70 && x < 170
  let a = (hue + 222) % 360
  let b = (hue + 150) % 360
  if (green(a)) a = 46
  if (green(b)) b = 335
  return { a, b }
}

export default function RetroGrid({ stage, reducedMotion, paused, quality, hue }: FxProps) {
  const c = useFxControls({
    angle: { value: 65, min: 35, max: 84, step: 1, label: 'kąt siatki (°)' },
    cell: { value: 60, min: 24, max: 140, step: 2, label: 'rozmiar komórki' },
    speed: { value: 1, min: 0.1, max: 4, step: 0.05, label: 'prędkość' },
    horizon: { value: 0.56, min: 0.4, max: 0.7, step: 0.01, label: 'linia horyzontu' },
    sun: { value: true, label: 'słońce i góry' },
    scan: { value: true, label: 'linie skanowania' },
  })
  const [ref, { w, h }] = useElementSize<HTMLDivElement>()

  const cell = stage ? c.cell : Math.max(14, c.cell * 0.38)
  const skyH = h * c.horizon
  const sun = Math.min(w * 0.34, skyH * 0.9)
  const glow = stage && quality !== 'low'

  const stars = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: stage ? 90 : 28 }, () => ({ x: r() * 100, y: r() * 88, s: r() < 0.85 ? 1 : 2, d: r() * 3.2 }))
  }, [stage])
  const far = useMemo(() => ridge(11, 22, 0.55), [])
  const near = useMemo(() => ridge(29, 14, 0.9), [])
  const toPts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  const vars = {
    '--rg-angle': `${c.angle}deg`,
    '--rg-po': `${(200 / Math.tan((c.angle * Math.PI) / 180)).toFixed(1)}px`,
    '--rg-cell': `${cell}px`,
    '--rg-dur': `${(1.1 / c.speed).toFixed(3)}s`,
    '--rg-line': 'hsl(var(--jx-hue) 100% 62% / 0.75)',
    // complementary warm sun relative to the accent hue (cyan → amber/pink)
    '--rg-sun-a': `hsl(${sunHues(hue).a} 100% 66%)`,
    '--rg-sun-b': `hsl(${sunHues(hue).b} 100% 58%)`,
  } as CSSProperties

  return (
    <div ref={ref} className="rg-root absolute inset-0 overflow-hidden bg-[#020309]" style={vars} data-paused={paused || reducedMotion || undefined}>
      {/* sky */}
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: skyH }}>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#020309_0%,hsl(calc(var(--jx-hue)+150)_70%_8%)_55%,hsl(calc(var(--jx-hue)+150)_80%_18%)_100%)]" aria-hidden="true" />
        {stars.map((s, i) => (
          <span key={i} className="rg-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${-s.d}s` }} aria-hidden="true" />
        ))}
        {c.sun && w > 0 && (
          <>
            <div className="rg-sun-glow absolute left-1/2" style={{ width: sun * 1.9, height: sun * 1.9, marginLeft: -sun * 0.95, bottom: -sun * 0.95 + sun * 0.45 }} aria-hidden="true" />
            <motion.div
              className="rg-sun absolute left-1/2"
              style={{ width: sun, height: sun, marginLeft: -sun / 2, bottom: -sun * 0.12 }}
              initial={reducedMotion ? false : { y: sun * 0.5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            />
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full" style={{ height: skyH * 0.26 }} aria-hidden="true">
              <polygon points={toPts(far)} fill="#03040c" stroke="hsl(calc(var(--jx-hue) + 150) 90% 60% / 0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full" style={{ height: skyH * 0.17 }} aria-hidden="true">
              <polygon points={toPts(near)} fill="#020309" stroke="var(--jx-accent)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 3px var(--jx-accent))' }} />
            </svg>
          </>
        )}
      </div>

      {/* floor (Magic UI retro grid) */}
      <div className="rg-floor absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: skyH }} aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,hsl(calc(var(--jx-hue)+150)_80%_10%)_0%,#020309_45%)]" />
        <div className="rg-plane">
          {glow && <div className="rg-lines rg-lines--glow" />}
          <div className="rg-lines" />
        </div>
        {/* haze at the horizon hides moiré where cells shrink below a pixel */}
        <div className="absolute inset-x-0 top-0 h-[38%] bg-[linear-gradient(to_bottom,#020309_0%,hsl(calc(var(--jx-hue)+150)_70%_10%/0.75)_25%,transparent_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,transparent_40%,rgb(0_0_0/0.55))]" />
      </div>

      {/* horizon line */}
      <div className="absolute inset-x-0 h-px" style={{ top: skyH, background: 'linear-gradient(90deg, transparent, var(--jx-accent) 20%, #fff 50%, var(--jx-accent) 80%, transparent)', boxShadow: '0 0 12px var(--jx-accent), 0 0 30px var(--jx-accent)' }} aria-hidden="true" />

      {stage && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: Math.max(24, skyH * 0.07) }}
          initial={reducedMotion ? false : { opacity: 0, y: -16, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.28em' }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        >
          <h2 className="m-0 rg-chrome text-[clamp(2.2rem,6vw,5.2rem)] leading-none" style={{ fontFamily: 'var(--jx-font-audiowide)', letterSpacing: 'inherit' }}>
            J.A.R.V.I.S.
          </h2>
          <span className="jx-label mt-3 tracking-[0.5em]! text-white! bg-black/60 border border-jx-line px-3 py-1 backdrop-blur-sm">Neonowy horyzont</span>
        </motion.div>
      )}

      {c.scan && <div className="rg-scan absolute inset-0 pointer-events-none" aria-hidden="true" />}
    </div>
  )
}
