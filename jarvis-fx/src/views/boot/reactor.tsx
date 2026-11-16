/**
 * Arc-reactor reticle (original artwork, drawn in code). Pure markup — BootStage animates it
 * through the data-* hooks:
 *   data-ring   circles drawn from the middle out (DrawSVG "50% 50%")
 *   data-arc    arc segments drawn start → end (DrawSVG 0 → 100%)
 *   data-tick   podziałka (72 ticks, staggered fade)
 *   data-coil   10 reactor coils (scale in)
 *   data-cross  crosshair strokes
 *   data-tri    triangle outline (DrawSVG), data-core morphing core (MorphSVG), data-glow core light
 *   data-spin-a / data-spin-b / data-spin-c   groups rotated by ambient loops
 */
import { memo } from 'react'
import { arcPath, CORE_SHAPES, pt } from './geometry'

const OUTER_ARCS: [number, number][] = [
  [6, 84],
  [96, 174],
  [186, 264],
  [276, 354],
]
const BAND_ARCS: [number, number][] = [
  [12, 108],
  [132, 228],
  [252, 348],
]
const INNER_ARCS: [number, number][] = [
  [70, 110],
  [190, 230],
  [310, 350],
]
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5)
const COILS = Array.from({ length: 10 }, (_, i) => i * 36 + 18)
const CARDINAL = [0, 90, 180, 270]

const VB = '-220 -220 440 440'

/**
 * Stacked SVG layers: the rotating rings are separate elements rotated with CSS transforms on
 * their own compositing layers, so ambient rotation never re-rasterises the artwork.
 */
export const Reactor = memo(function Reactor({ gid, className }: { gid: string; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {/* static base: halo, crosshair, inner rings, coils, core */}
      <svg className="jxb-layer" viewBox={VB} focusable="false">
        <defs>
          <radialGradient id={`${gid}-glow`}>
            <stop offset="0%" style={{ stopColor: '#fff', stopOpacity: 0.95 }} />
            <stop offset="32%" style={{ stopColor: 'var(--jx-accent)', stopOpacity: 0.85 }} />
            <stop offset="100%" style={{ stopColor: 'var(--jx-accent)', stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id={`${gid}-halo`}>
            <stop offset="55%" style={{ stopColor: 'var(--jx-accent)', stopOpacity: 0 }} />
            <stop offset="78%" style={{ stopColor: 'var(--jx-accent)', stopOpacity: 0.12 }} />
            <stop offset="100%" style={{ stopColor: 'var(--jx-accent)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        <circle data-halo r="214" fill={`url(#${gid}-halo)`} />

        {CARDINAL.map((a) => {
          const [x0, y0] = pt(198, a)
          const [x1, y1] = pt(216, a)
          return <line key={`c${a}`} data-cross className="jxb-s-acc" x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={1.5} />
        })}

        <circle data-ring className="jxb-s-acc" r="126" strokeWidth={1.2} />

        {COILS.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect data-coil className="jxb-coil" x={-10} y={-119} width={20} height={26} rx={2.5} />
            <line data-coil className="jxb-s-acc" x1={-6} y1={-106} x2={6} y2={-106} strokeWidth={1} />
          </g>
        ))}

        <circle data-ring className="jxb-s-acc" r="88" strokeWidth={2} />
        <circle data-ring className="jxb-s-line" r="72" strokeWidth={1} />

        <circle data-glow r="58" fill={`url(#${gid}-glow)`} />
        <path data-tri className="jxb-s-acc" d={CORE_SHAPES.triangle} strokeWidth={1.4} />
        <path data-core className="jxb-core" d={CORE_SHAPES.triangle} strokeWidth={2.2} />
      </svg>

      {/* outer ring, slow clockwise */}
      <div className="jxb-layer" data-spin-a>
        <svg viewBox={VB} focusable="false">
          <circle data-ring className="jxb-s-line" r="192" strokeWidth={0.8} />
          {OUTER_ARCS.map(([a0, a1]) => (
            <path key={a0} data-arc className="jxb-s-acc" d={arcPath(180, a0, a1)} strokeWidth={1.6} />
          ))}
          {CARDINAL.map((a) => {
            const [x, y] = pt(186, a + 45)
            return <rect key={`m${a}`} data-coil className="jxb-f-acc" x={x - 2.5} y={y - 2.5} width={5} height={5} transform={`rotate(${a + 45} ${x} ${y})`} />
          })}
        </svg>
      </div>

      {/* podziałka, very slow */}
      <div className="jxb-layer" data-spin-c>
        <svg viewBox={VB} focusable="false">
          {TICKS.map((a) => {
            const long = a % 30 === 0
            const [x0, y0] = pt(long ? 156 : 160, a)
            const [x1, y1] = pt(long ? 170 : 166, a)
            return <line key={a} data-tick className={long ? 'jxb-s-acc' : 'jxb-s-line'} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={long ? 1.6 : 1} />
          })}
        </svg>
      </div>

      {/* thick band, counter-clockwise */}
      <div className="jxb-layer" data-spin-b>
        <svg viewBox={VB} focusable="false">
          {BAND_ARCS.map(([a0, a1]) => (
            <path key={a0} data-arc className="jxb-s-band" d={arcPath(145, a0, a1)} strokeWidth={8} />
          ))}
          {INNER_ARCS.map(([a0, a1]) => (
            <path key={`i${a0}`} data-arc className="jxb-s-acc" d={arcPath(134, a0, a1)} strokeWidth={1.2} />
          ))}
        </svg>
      </div>
    </div>
  )
})
