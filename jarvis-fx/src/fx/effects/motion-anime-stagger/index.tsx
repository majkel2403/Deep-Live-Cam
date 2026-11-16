import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { animate, createTimeline, stagger, type JSAnimation, type Timeline } from 'animejs'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { playBleep } from '@/lib/sound'
import { useElementSize } from '../motion-kit/useElementSize'
import '../motion-kit/kit.css'

type Pattern = 'wave' | 'lift' | 'spin' | 'color' | 'sweep'
const PATTERNS = { fala: 'wave', uniesienie: 'lift', obrót: 'spin', barwa: 'color', przemiatanie: 'sweep' } as const
const PATTERN_PL: Record<Pattern, string> = { wave: 'fala', lift: 'uniesienie', spin: 'obrót', color: 'barwa', sweep: 'przemiatanie' }
const MAX_DOTS = 1500

export default function AnimeStagger({ stage, reducedMotion, paused, accent, accent2 }: FxProps) {
  const c = useFxControls({
    pattern: { value: PATTERNS.fala as string, options: PATTERNS, label: 'wzór' },
    step: { value: 32, min: 8, max: 120, step: 2, label: 'krok staggera (ms)' },
    cell: { value: 26, min: 14, max: 48, step: 2, label: 'rozmiar komórki' },
    auto: { value: true, label: 'impulsy automatyczne' },
    every: { value: 2, min: 0.8, max: 8, step: 0.2, label: 'co ile (s)' },
  })
  const [ref, { w, h }] = useElementSize<HTMLDivElement>()
  const gridRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const anims = useRef(new Set<JSAnimation | Timeline>())
  const [last, setLast] = useState<{ col: number; row: number } | null>(null)
  const [count, setCount] = useState(0)
  const [cursor, setCursor] = useState<number | null>(null)
  const hoverIdx = useRef(-1)

  // grid geometry: requested cell size, enlarged if needed to cap the element count
  const geo = useMemo(() => {
    if (!w || !h) return { cols: 0, rows: 0, cell: 0 }
    let cell = stage ? c.cell : Math.max(11, c.cell * 0.5)
    cell = Math.max(cell, Math.sqrt((w * h) / MAX_DOTS))
    return { cols: Math.max(4, Math.floor(w / cell)), rows: Math.max(3, Math.floor(h / cell)), cell }
  }, [w, h, c.cell, stage])
  const total = geo.cols * geo.rows

  const track = useCallback(<T extends JSAnimation | Timeline>(a: T) => {
    anims.current.add(a)
    a.then(() => anims.current.delete(a))
    return a
  }, [])

  const ripple = useCallback(
    (from: number, pattern: Pattern = c.pattern as Pattern) => {
      const grid = gridRef.current
      if (!grid || !total || reducedMotion) return
      const dots = grid.children
      const g = [geo.cols, geo.rows]
      const delay = stagger(c.step, { grid: g, from })
      const col = from % geo.cols
      const row = Math.floor(from / geo.cols)
      setLast({ col, row })
      setCount((n) => n + 1)
      // shockwave ring at the origin cell
      const ringEl = ringRef.current
      if (ringEl) {
        ringEl.style.left = `calc(50% - ${(geo.cols * geo.cell) / 2}px + ${(col + 0.5) * geo.cell}px)`
        ringEl.style.top = `calc(50% - ${(geo.rows * geo.cell) / 2}px + ${(row + 0.5) * geo.cell}px)`
        track(animate(ringEl, { scale: [0.2, Math.max(geo.cols, geo.rows) * 0.9], opacity: [{ to: 0.9, duration: 80 }, { to: 0, duration: 1500 }], duration: 1600, ease: 'outCubic' }))
      }
      switch (pattern) {
        case 'wave':
          track(
            animate(dots, {
              scale: [{ to: 2.4, duration: 220, ease: 'outSine' }, { to: 1, duration: 700, ease: 'inOutQuad' }],
              opacity: [{ to: 1, duration: 220 }, { to: 0.32, duration: 900 }],
              delay,
            }),
          )
          break
        case 'lift':
          track(
            animate(dots, {
              translateY: [{ to: -geo.cell * 0.45, duration: 260, ease: 'outCubic' }, { to: 0, duration: 900, ease: 'outElastic(1, .45)' }],
              opacity: [{ to: 1, duration: 200 }, { to: 0.32, duration: 900 }],
              delay,
            }),
          )
          break
        case 'spin':
          track(
            animate(dots, {
              rotate: [{ to: 135, duration: 420, ease: 'inOutQuart' }, { to: 0, duration: 0 }],
              scale: [{ to: 1.9, duration: 260, ease: 'outSine' }, { to: 1, duration: 520, ease: 'inSine' }],
              borderRadius: [{ to: '0%', duration: 180 }, { to: '50%', duration: 600, ease: 'inQuad' }],
              opacity: [{ to: 1, duration: 200 }, { to: 0.32, duration: 800 }],
              delay,
            }),
          )
          break
        case 'color':
          track(
            animate(dots, {
              backgroundColor: [{ to: '#ffffff', duration: 160 }, { to: accent2, duration: 360 }, { to: accent, duration: 700 }],
              scale: [{ to: 1.7, duration: 200 }, { to: 1, duration: 800, ease: 'outQuad' }],
              opacity: [{ to: 1, duration: 160 }, { to: 0.32, duration: 1000 }],
              delay,
            }),
          )
          break
        case 'sweep': {
          // timeline: horizontal sweep from the origin column, then a vertical echo
          const tl = createTimeline({ defaults: { ease: 'outSine' } })
          tl.add(dots, {
            scaleY: [{ to: 3.2, duration: 200 }, { to: 1, duration: 500 }],
            opacity: [{ to: 1, duration: 200 }, { to: 0.32, duration: 700 }],
            delay: stagger(c.step * 0.8, { grid: g, from, axis: 'x' }),
          }).add(
            dots,
            {
              scaleX: [{ to: 3.2, duration: 200 }, { to: 1, duration: 500 }],
              opacity: [{ to: 0.9, duration: 200 }, { to: 0.32, duration: 700 }],
              delay: stagger(c.step * 0.8, { grid: g, from, axis: 'y' }),
            },
            '-=600',
          )
          track(tl)
          break
        }
      }
    },
    [c.pattern, c.step, geo, total, reducedMotion, accent, accent2, track],
  )

  // reset styles when the grid is rebuilt or the pattern changes (and on unmount)
  useEffect(() => {
    const set = anims.current
    return () => {
      set.forEach((a) => a.revert())
      set.clear()
    }
  }, [geo, c.pattern])

  // automatic pulses: centre first, then random origins
  useEffect(() => {
    if (!c.auto || paused || reducedMotion || !total) return
    let n = 0
    const fire = () => {
      const idx = n === 0 ? Math.floor(geo.rows / 2) * geo.cols + Math.floor(geo.cols / 2) : Math.floor(Math.random() * total)
      n++
      ripple(idx)
    }
    const first = window.setTimeout(fire, 400)
    const t = window.setInterval(fire, c.every * 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(t)
    }
  }, [c.auto, c.every, paused, reducedMotion, total, geo, ripple])

  // pause / resume running animations
  useEffect(() => {
    anims.current.forEach((a) => (paused ? a.pause() : a.resume()))
  }, [paused])

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const col = Math.min(geo.cols - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * geo.cols)))
    const row = Math.min(geo.rows - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * geo.rows)))
    return row * geo.cols + col
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!stage) return
    playBleep('scan')
    ripple(indexAt(e))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!stage || reducedMotion || paused) return
    const i = indexAt(e)
    if (i === hoverIdx.current) return
    hoverIdx.current = i
    const el = gridRef.current?.children[i]
    if (el) track(animate(el, { scale: [{ to: 2.2, duration: 120 }, { to: 1, duration: 600, ease: 'outQuad' }], opacity: [{ to: 1, duration: 120 }, { to: 0.32, duration: 700 }], composition: 'blend' }))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = cursor ?? Math.floor(geo.rows / 2) * geo.cols + Math.floor(geo.cols / 2)
    let col = cur % geo.cols
    let row = Math.floor(cur / geo.cols)
    if (e.key === 'ArrowLeft') col = Math.max(0, col - 1)
    else if (e.key === 'ArrowRight') col = Math.min(geo.cols - 1, col + 1)
    else if (e.key === 'ArrowUp') row = Math.max(0, row - 1)
    else if (e.key === 'ArrowDown') row = Math.min(geo.rows - 1, row + 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      playBleep('scan')
      ripple(cur)
      return
    } else return
    e.preventDefault()
    e.stopPropagation()
    setCursor(row * geo.cols + col)
  }

  const dotSize = Math.max(2, Math.round(geo.cell * (stage ? 0.2 : 0.24)))
  const cursorPos = cursor !== null ? { col: cursor % geo.cols, row: Math.floor(cursor / geo.cols) } : null

  return (
    <div ref={ref} className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--jx-hue)_90%_25%/0.25),transparent_70%)]" aria-hidden="true" />
      {total > 0 && (
        <div
          className={`absolute inset-0 grid place-content-center ${stage ? 'cursor-crosshair outline-none focus-visible:ring-1 focus-visible:ring-jx-accent' : ''}`}
          tabIndex={stage ? 0 : undefined}
          role={stage ? 'application' : undefined}
          aria-label={stage ? 'Matryca impulsów: kliknij lub użyj strzałek i Enter, aby wysłać falę' : undefined}
          aria-hidden={stage ? undefined : true}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={stage ? onKeyDown : undefined}
          style={{ gridTemplateColumns: `repeat(${geo.cols}, ${geo.cell}px)`, gridAutoRows: `${geo.cell}px` }}
        >
          <div ref={gridRef} className="contents">
            {Array.from({ length: total }, (_, i) => {
              const col = i % geo.cols
              const row = Math.floor(i / geo.cols)
              // reduced motion: a static radial falloff instead of motion
              const d = Math.hypot(col - geo.cols / 2, row - geo.rows / 2) / Math.hypot(geo.cols / 2, geo.rows / 2)
              return (
                <span
                  key={`${geo.cols}x${geo.rows}-${i}`}
                  className="place-self-center rounded-full bg-jx-accent"
                  style={{ width: dotSize, height: dotSize, opacity: reducedMotion ? Math.max(0.15, 0.9 - d) : 0.36, boxShadow: '0 0 4px var(--jx-accent)' }}
                />
              )
            })}
          </div>
          <span
            ref={ringRef}
            aria-hidden="true"
            className="absolute rounded-full border border-jx-accent pointer-events-none shadow-[0_0_10px_var(--jx-accent),inset_0_0_10px_var(--jx-accent)]"
            style={{ width: geo.cell, height: geo.cell, marginLeft: -geo.cell / 2, marginTop: -geo.cell / 2, opacity: 0, left: '50%', top: '50%' }}
          />
          {cursorPos && stage && (
            <span
              aria-hidden="true"
              className="absolute border border-jx-accent pointer-events-none shadow-[0_0_8px_var(--jx-accent)]"
              style={{
                width: geo.cell,
                height: geo.cell,
                left: `calc(50% - ${(geo.cols * geo.cell) / 2}px + ${cursorPos.col * geo.cell}px)`,
                top: `calc(50% - ${(geo.rows * geo.cell) / 2}px + ${cursorPos.row * geo.cell}px)`,
              }}
            />
          )}
        </div>
      )}

      {stage && (
        <>
          <div className="absolute left-6 top-6 pointer-events-none">
            <div className="jx-aug flex flex-col gap-1 p-4 min-w-56" data-augmented-ui="tl-clip br-clip border">
              <span className="jx-title text-sm">Matryca impulsów</span>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                <dt className="jx-label">Komórki</dt>
                <dd className="m-0 jx-num text-right text-jx-text">
                  {geo.cols}×{geo.rows} = {total.toLocaleString('pl-PL')}
                </dd>
                <dt className="jx-label">Wzór</dt>
                <dd className="m-0 jx-num text-right text-jx-accent">{PATTERN_PL[c.pattern as Pattern]}</dd>
                <dt className="jx-label">Impulsy</dt>
                <dd className="m-0 jx-num text-right text-jx-text">{count}</dd>
                <dt className="jx-label">Źródło</dt>
                <dd className="m-0 jx-num text-right text-jx-text">{last ? `${String(last.col).padStart(2, '0')} : ${String(last.row).padStart(2, '0')}` : '—'}</dd>
              </dl>
            </div>
          </div>
          <p className="absolute bottom-5 inset-x-0 text-center jx-label text-[0.65rem]! pointer-events-none">
            {reducedMotion ? 'Ograniczony ruch: matryca statyczna' : 'Kliknij siatkę · Tab, strzałki i Enter · stagger({ grid, from })'}
          </p>
        </>
      )}
    </div>
  )
}
