import { useEffect, useMemo, useRef, useState } from 'react'
import { Lottie, type LottieHandle } from 'lottie-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudChrome } from '../hud-kit/HudChrome'
import { hexToRgb } from '../hud-kit/color'
import { LBL } from '../hud-kit/ui'
import { buildOrb } from './orb'

/**
 * An original, hand-written Lottie animation (see ./orb.ts) played with lottie-react.
 * Because the JSON is generated, it is recoloured to the runtime accent (lottie-react reloads
 * when the content changes). Paused / reduced-motion states go through the imperative handle.
 */

const rgb01 = (hex: string) => hexToRgb(hex).map((v) => v / 255) as [number, number, number]

const PHRASES = ['Synteza odpowiedzi', 'Przeszukiwanie pamięci', 'Kalibracja modelu', 'Łączenie z rdzeniem']

export default function LottieOrb({ accent, accent2, reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 1, min: 0.25, max: 3, step: 0.05, label: 'prędkość' },
    recolor: { value: true, label: 'akcent' },
    caption: { value: true, label: 'podpis' },
  })
  const data = useMemo(() => (c.recolor ? buildOrb(rgb01(accent), rgb01(accent2)) : buildOrb([0, 0.9, 1], [0.35, 0.95, 1])), [accent, accent2, c.recolor])
  const lottieRef = useRef<LottieHandle>(null)

  useEffect(() => {
    const h = lottieRef.current
    if (!h) return
    if (paused || reducedMotion) h.pause()
    else h.play()
  }, [paused, reducedMotion, data])

  // status phrase changes once per two loops
  const [pi, setPi] = useState(0)
  useEffect(() => {
    if (paused || reducedMotion) return
    const id = setInterval(() => setPi((i) => (i + 1) % PHRASES.length), 4000 / c.speed)
    return () => clearInterval(id)
  }, [paused, reducedMotion, c.speed])
  const phrase = PHRASES[pi]

  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,var(--jx-accent-faint),transparent_60%)]">
      <div className="relative flex flex-col items-center" style={{ gap: stage ? 18 : 4 }}>
        <Lottie
          src={data}
          loop
          autoplay={!paused && !reducedMotion}
          speed={c.speed}
          lottieRef={lottieRef}
          className={stage ? 'h-[min(58vh,460px)] w-[min(58vh,460px)]' : 'h-[118px] w-[118px]'}
          role="img"
          aria-label="Animowany orb sztucznej inteligencji (Lottie)"
          subscriptions={{ ready: () => (paused || reducedMotion) && lottieRef.current?.seek(18) }}
        />
        {c.caption && (
          <div className="flex flex-col items-center gap-1" role="status" aria-live="polite">
            <span className={`${LBL} jx-caret ${stage ? 'text-[0.8rem] text-jx-accent' : 'text-[0.625rem] text-jx-accent'}`}>{phrase}</span>
            {stage && <span className="jx-num text-[0.625rem] text-jx-dim">lottie · 400×400 · 30 kl/s · 60 klatek · 8 warstw</span>}
          </div>
        )}
      </div>
      <HudChrome code="LDR-LT · LOTTIE" title="Orb AI · animacja własna" stage={stage} corners={stage} footer={stage ? <span className={`${LBL} text-[0.625rem]`}>JSON Bodymovin napisany ręcznie · przebarwiany na żywo ({c.recolor ? 'akcent HUD' : 'cyjan bazowy'})</span> : undefined} />
    </div>
  )
}
