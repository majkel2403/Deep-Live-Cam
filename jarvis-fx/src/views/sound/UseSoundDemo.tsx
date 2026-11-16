/**
 * use-sound (Josh W. Comeau, MIT) demo: the hook wraps howler and returns [play, { stop }].
 * Plays our own CC0 WAVs; honours the global mute and volume.
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import useSound from 'use-sound'
import { IconStairsUp, IconRadar2, IconCircleCheck } from '@tabler/icons-react'
import { useSettings } from '@/lib/store'
import { soundUrl } from '@/lib/sound'
import { wakeScope } from './scopeBus'

const RATE_MIN = 0.75
const RATE_MAX = 2

export function UseSoundDemo() {
  const soundOn = useSettings((s) => s.soundOn)
  const volume = useSettings((s) => s.volume)
  const enabled = soundOn && volume > 0
  const [rate, setRate] = useState(RATE_MIN)
  const reset = useRef<number | undefined>(undefined)

  const [playClick] = useSound(soundUrl('synth/click.wav'), { volume, soundEnabled: enabled, playbackRate: rate })
  const [playScan, { stop: stopScan }] = useSound(soundUrl('synth/scan.wav'), { volume, soundEnabled: enabled })
  const [playSuccess] = useSound(soundUrl('synth/success.wav'), { volume, soundEnabled: enabled, interrupt: true })

  useEffect(() => () => window.clearTimeout(reset.current), [])

  const ladder = () => {
    playClick()
    wakeScope()
    setRate((r) => Math.min(RATE_MAX, +(r + 0.125).toFixed(3)))
    window.clearTimeout(reset.current)
    reset.current = window.setTimeout(() => setRate(RATE_MIN), 900)
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <p className="text-[0.74rem] leading-snug text-jx-dim">
        Hook <span className="jx-num text-jx-accent">useSound()</span> tworzy własną instancję howlera dla pliku i zwraca funkcję <span className="jx-num">play</span>. Poniżej te same pliki WAV co w Laboratorium.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <DemoButton icon={<IconStairsUp />} onClick={ladder} disabled={!enabled}>
          Drabina tonów
        </DemoButton>
        <span className="jx-num text-[0.7rem] text-jx-accent min-w-[4.5ch]" aria-live="polite" aria-label={`Prędkość odtwarzania ${rate.toFixed(2)}`}>
          ×{rate.toFixed(2).replace('.', ',')}
        </span>
        <DemoButton
          icon={<IconRadar2 />}
          disabled={!enabled}
          onPointerEnter={() => {
            playScan()
            wakeScope()
          }}
          onPointerLeave={() => stopScan()}
          onFocus={() => {
            playScan()
            wakeScope()
          }}
          onBlur={() => stopScan()}
        >
          Najedź: skan
        </DemoButton>
        <DemoButton
          icon={<IconCircleCheck />}
          disabled={!enabled}
          onClick={() => {
            playSuccess()
            wakeScope()
          }}
        >
          Sukces
        </DemoButton>
      </div>
      <pre className="jxs-code" aria-label="Przykład kodu use-sound">
        <span className="k">const</span> [play] = <span className="k">useSound</span>(<span className="s">'/sounds/synth/click.wav'</span>, {'{'}
        {'\n'}  volume, soundEnabled, playbackRate, <span className="c">// ×0,75 → ×2</span>
        {'\n'}
        {'}'})
      </pre>
      {!enabled && <p className="jx-label text-[0.6rem] text-jx-warn">Dźwięk wyciszony — przyciski demo są nieaktywne.</p>}
    </div>
  )
}

/** HUD-styled button WITHOUT the global UI bleeps, so only the use-sound demo sound is heard. */
function DemoButton({ icon, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button type="button" data-augmented-ui="tl-clip br-clip border" className={`jx-aug-btn inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.68rem] ${className}`} {...rest}>
      {icon && <span className="[&>svg]:size-[1.1em] shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
