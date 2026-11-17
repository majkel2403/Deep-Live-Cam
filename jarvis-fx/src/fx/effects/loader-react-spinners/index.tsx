import './spinners.css'
import type { CSSProperties, ReactNode } from 'react'
import { ClockLoader, GridLoader, HashLoader, MoonLoader, PropagateLoader, PuffLoader, RingLoader, ScaleLoader } from 'react-spinners'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudChrome } from '../hud-kit/HudChrome'
import { hexA } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'

/** react-spinners (MIT, David Hu) gallery: every spinner gets the runtime accent colour. */

interface Spec {
  code: string
  name: string
  lib: string
  render: (p: { color: string; color2: string; s: number; speed: number }) => ReactNode
}

const SPECS: Spec[] = [
  { code: 'SPN-01', name: 'Puls rdzenia', lib: 'PuffLoader', render: ({ color, s, speed }) => <PuffLoader color={color} size={60 * s} speedMultiplier={speed} aria-label="PuffLoader" /> },
  { code: 'SPN-02', name: 'Equalizer', lib: 'ScaleLoader', render: ({ color, s, speed }) => <ScaleLoader color={color} height={34 * s} width={4 * s} radius={0} margin={2 * s} speedMultiplier={speed} aria-label="ScaleLoader" /> },
  { code: 'SPN-03', name: 'Żyroskop', lib: 'RingLoader', render: ({ color, s, speed }) => <RingLoader color={color} size={58 * s} speedMultiplier={speed} aria-label="RingLoader" /> },
  { code: 'SPN-04', name: 'Macierz', lib: 'GridLoader', render: ({ color, s, speed }) => <GridLoader color={color} size={11 * s} margin={2 * s} speedMultiplier={speed} aria-label="GridLoader" /> },
  { code: 'SPN-05', name: 'Krzyżówka', lib: 'HashLoader', render: ({ color2, s, speed }) => <HashLoader color={color2} size={46 * s} speedMultiplier={speed} aria-label="HashLoader" /> },
  { code: 'SPN-06', name: 'Chronometr', lib: 'ClockLoader', render: ({ color, s, speed }) => <ClockLoader color={color} size={56 * s} speedMultiplier={speed} aria-label="ClockLoader" /> },
  { code: 'SPN-07', name: 'Orbita', lib: 'MoonLoader', render: ({ color2, s, speed }) => <MoonLoader color={color2} size={50 * s} speedMultiplier={speed} aria-label="MoonLoader" /> },
  { code: 'SPN-08', name: 'Propagacja', lib: 'PropagateLoader', render: ({ color, s, speed }) => <PropagateLoader color={color} size={12 * s} speedMultiplier={speed} aria-label="PropagateLoader" /> },
]

export default function ReactSpinners({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0.2, max: 3, step: 0.05, label: 'prędkość' },
    scale: { value: 1.6, min: 0.6, max: 2.2, step: 0.05, label: 'skala' },
    glow: { value: true, label: 'poświata' },
    twoTone: { value: true, label: 'akcent 2' },
  })
  const [ref, size] = useSize<HTMLDivElement>()
  const cols = stage ? (size.width > 1000 ? 4 : 3) : 4
  const s = stage ? c.scale * Math.min(1.4, Math.max(0.6, size.width / 1300)) : 0.45
  const speed = c.speed * (reducedMotion ? 0.35 : 1)
  const color2 = c.twoTone ? accent2 : accent

  return (
    <div
      ref={ref}
      className="rsp-root absolute inset-0 overflow-hidden"
      data-paused={paused ? 'true' : undefined}
      data-glow={c.glow ? 'true' : undefined}
      style={{ '--rsp-glow': hexA(accent, 0.7) } as CSSProperties}
    >
      <div
        className="absolute grid"
        style={{ left: stage ? 32 : 6, right: stage ? 32 : 6, top: stage ? 52 : 18, bottom: stage ? 40 : 4, gap: stage ? 14 : 4, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}
      >
        {SPECS.map((sp) => (
          <div key={sp.code} className="jx-frame-host relative flex min-h-0 flex-col">
            {stage && (
              <>
                <span className="absolute left-0 top-0 h-3 w-3 border-l border-t" style={{ borderColor: 'var(--jx-line-strong)' }} />
                <span className="absolute right-0 top-0 h-3 w-3 border-r border-t" style={{ borderColor: 'var(--jx-line-strong)' }} />
                <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l" style={{ borderColor: 'var(--jx-line-strong)' }} />
                <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r" style={{ borderColor: 'var(--jx-line-strong)' }} />
              </>
            )}
            <div className="rsp-cell grid flex-1 place-items-center bg-[radial-gradient(circle_at_center,var(--jx-accent-faint),transparent_62%)]" role="progressbar" aria-busy="true" aria-label={`${sp.name} (${sp.lib})`}>
              {/* several spinners use `display: inherit` on their wrapper – give them a flex parent */}
              <div className="flex items-center justify-center">{sp.render({ color: accent, color2, s, speed })}</div>
            </div>
            {stage && (
              <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap px-3 pb-2">
                <span className="jx-num shrink-0 text-[0.625rem] text-jx-accent">{sp.code}</span>
                <span className={`${LBL} min-w-0 truncate text-[0.7rem] text-jx-text`}>{sp.name}</span>
                <span className="flex-1" />
                <span className="jx-num min-w-0 truncate text-[0.625rem] text-jx-dim" title={`<${sp.lib} />`}>{`<${sp.lib} />`}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <HudChrome code="LDR-RS · REACT-SPINNERS" title="Osiem wskaźników · MIT" stage={stage} corners={stage} footer={stage ? <span className={`${LBL} text-[0.625rem]`}>{c.twoTone ? 'Kolor = akcent HUD, dwutonowe = akcent 2' : 'Kolor = akcent HUD'} (zmień odcień w ustawieniach) · mnożnik prędkości {speed.toFixed(2)}×</span> : undefined} />
    </div>
  )
}
