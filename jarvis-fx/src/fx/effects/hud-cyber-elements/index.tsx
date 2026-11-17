import './cyber.css'
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { playBleep } from '@/lib/sound'
import { DemoBadge, HudChrome } from '../hud-kit/HudChrome'
import { hexA } from '../hud-kit/color'
import { LBL } from '../hud-kit/ui'
import { CyberButtonShape, CyberFrameShape, CyberInputShape } from './cyber'

// Ported elements (see cyber.tsx for the MIT notice). Everything here is local UI state: nothing is sent anywhere.
const BUTTONS = [
  { id: 'uzbroj', label: 'Uzbrój' },
  { id: 'skan', label: 'Skan' },
  { id: 'alarm', label: 'Alarm' },
] as const

const METER_BARS = 26

/** Deterministic heights so every mount looks identical. */
function meterHeight(i: number): number {
  return 30 + ((i * 37) % 61)
}

const CAPTION = `${LBL} text-[0.625rem] leading-tight`

/**
 * Gallery cards are themselves `<button>` elements, and interactive content may not nest inside a
 * button. So on a card the controls are drawn as static look-alikes; only the stage gets live ones.
 */
function Interactive({ live, children, className, style, ...rest }: { live: boolean; children: ReactNode; className: string; style?: CSSProperties; 'aria-pressed'?: boolean; 'aria-describedby'?: string; onClick?: () => void }) {
  if (live) return <button type="button" className={className} style={style} {...rest}>{children}</button>
  return <span className={className} style={style} aria-hidden="true">{children}</span>
}

export default function CyberElements({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const { replayEvery, glow } = useFxControls({
    replayEvery: { value: 8, min: 3, max: 30, step: 1, label: 'odtwórz (s)' },
    glow: { value: true, label: 'poświata' },
  })
  // `k` re-keys the reveal wrapper so the frame wipes in again; no timer runs while paused or reduced
  const [k, setK] = useState(0)
  useEffect(() => {
    if (reducedMotion || paused) return
    const t = setInterval(() => setK((x) => x + 1), replayEvery * 1000)
    return () => clearInterval(t)
  }, [replayEvery, reducedMotion, paused])

  const [armed, setArmed] = useState<Record<string, boolean>>({ uzbroj: false, skan: true, alarm: false })
  const [code, setCode] = useState('')
  const hintId = useId()
  const armedCount = Object.values(armed).filter(Boolean).length

  const toggle = (id: string) => {
    setArmed((s) => ({ ...s, [id]: !s[id] }))
    playBleep('toggle')
  }

  const frameStyle: CSSProperties = { color: accent, filter: glow ? `drop-shadow(0 0 6px ${hexA(accent, 0.55)})` : undefined }
  // the gallery tile is about 250 px tall including its title, so the card layout drops the meter and status line
  const frameW = stage ? 'w-full max-w-[640px]' : 'w-[42%] max-w-[124px]'

  return (
    <div className="cy-root absolute inset-0 overflow-hidden" data-paused={paused ? 'true' : undefined} data-reduced={reducedMotion ? 'true' : undefined}>
      <div className={`absolute inset-0 flex items-center justify-center ${stage ? 'px-6 pb-12 pt-16' : 'px-3 pb-3 pt-9'}`}>
        <div className={stage ? 'grid w-full max-w-[1240px] items-center gap-12 lg:grid-cols-[1.15fr_1fr]' : 'flex w-full flex-col items-center gap-2'}>
          {/* panel: ported frame with a sweep and a level meter */}
          <figure className={`m-0 flex flex-col items-center gap-3 ${stage ? '' : 'w-full'}`}>
            {stage && <figcaption className={`${CAPTION} self-start text-jx-accent`}>RAM-01 · ramka panelu</figcaption>}
            <div key={k} className={`cy-reveal relative overflow-hidden ${frameW}`} style={frameStyle}>
              <CyberFrameShape className="block h-auto w-full" />
              <span className="cy-scan" aria-hidden="true" />
            </div>
            {stage && (
            <div className="flex h-10 w-full max-w-[640px] items-end gap-[3px]" aria-hidden="true">
              {Array.from({ length: METER_BARS }, (_, i) => (
                <span
                  key={i}
                  className="cy-bar block min-w-0 flex-1 rounded-[1px]"
                  style={{
                    height: `${meterHeight(i)}%`,
                    background: i % 6 === 5 ? accent2 : accent,
                    opacity: i % 6 === 5 ? 0.9 : 0.65,
                    animationDelay: `${-((i * 0.19) % 1.6)}s`,
                  }}
                />
              ))}
            </div>
            )}
          </figure>

          {/* controls: ported button states and input */}
          <div className={`flex flex-col ${stage ? 'gap-7' : 'w-full items-center gap-2'}`}>
            <section aria-label="Przyciski" className={`flex flex-col gap-2 ${stage ? '' : 'items-center'}`}>
              {stage && <h2 className={`${CAPTION} m-0 font-normal text-jx-accent`}>PRZ-02 · przyciski</h2>}
              <div className={`flex flex-wrap ${stage ? 'gap-2.5' : 'justify-center gap-1.5'}`}>
                {BUTTONS.map((b) => {
                  const on = !!armed[b.id]
                  return (
                    <Interactive
                      key={b.id}
                      live={stage}
                      aria-pressed={on}
                      aria-describedby={hintId}
                      onClick={() => toggle(b.id)}
                      className={`group relative isolate ${stage ? 'h-12 w-44 cursor-pointer text-sm' : 'h-7 w-[76px] text-[0.625rem]'} select-none font-label font-semibold uppercase tracking-[0.14em] outline-none transition-[opacity,filter] duration-200 text-jx-text opacity-75 hover:opacity-100 hover:[filter:brightness(1.25)] aria-pressed:text-jx-bg aria-pressed:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jx-accent`}
                    >
                      <CyberButtonShape className="absolute inset-0 -z-10 h-full w-full" style={{ color: accent }} />
                      {/* pressed state: the chamfered body fills with the accent so the dark label stays readable */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-[3px] -z-10 opacity-0 transition-opacity duration-200 group-aria-pressed:opacity-100"
                        style={{ background: hexA(accent, 0.9), clipPath: 'polygon(10% 0, 100% 0, 100% 74%, 90% 100%, 0 100%, 0 28%)' }}
                      />
                      <span className="relative">{b.label}</span>
                    </Interactive>
                  )
                })}
              </div>
              {stage && (
                <p id={hintId} className={`${CAPTION} m-0 text-jx-dim`}>
                  Stan: uzbrojone {armedCount}/{BUTTONS.length} · demonstracja lokalna
                </p>
              )}
            </section>

            <section aria-label="Pole kodu" className={`flex flex-col gap-2 ${stage ? '' : 'w-full items-center'}`}>
              {stage && <h2 className={`${CAPTION} m-0 font-normal text-jx-accent`}>WEJ-03 · pole kodu</h2>}
              {stage ? (
                <label
                  className="group relative block h-12 w-full max-w-[460px] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-jx-accent"
                  style={{ filter: glow ? `drop-shadow(0 0 4px ${hexA(accent, 0.35)})` : undefined }}
                >
                  <CyberInputShape className="absolute inset-0 h-full w-full" style={{ color: accent }} />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.slice(0, 12))}
                    placeholder="wpisz kod…"
                    aria-label="Kod dostępu (demonstracja)"
                    aria-describedby={hintId}
                    autoComplete="off"
                    spellCheck={false}
                    className="relative z-10 h-full w-full bg-transparent px-4 font-mono text-sm tracking-[0.2em] text-jx-text outline-none placeholder:text-jx-dim"
                  />
                </label>
              ) : (
                <div className="relative block h-8 w-[92%]" aria-hidden="true" style={{ filter: glow ? `drop-shadow(0 0 4px ${hexA(accent, 0.35)})` : undefined }}>
                  <CyberInputShape className="absolute inset-0 h-full w-full" style={{ color: accent }} />
                  <span className="relative z-10 flex h-full items-center px-3 font-mono text-[0.6875rem] tracking-[0.2em] text-jx-dim">wpisz kod…</span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <HudChrome
        code="CYB-01 · CYBER ELEMENTS"
        title="Port react-cyber-elements · MIT"
        stage={stage}
        corners={stage}
        badges={<DemoBadge title="Przyciski i pole są lokalne – nic nie jest wysyłane ani zapisywane" />}
        footer={stage ? <span className={`${CAPTION} text-jx-dim`}>react-cyber-elements · MIT © 2022 Mau Joost · kształty przestylowane na tokeny JARVIS · odtwarzanie co {replayEvery} s</span> : undefined}
      />
    </div>
  )
}
