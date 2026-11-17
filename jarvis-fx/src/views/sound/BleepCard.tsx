import { useEffect, useRef, useState } from 'react'
import IconPlayerPlayFilled from '@tabler/icons-react/icons/IconPlayerPlayFilled'
import { onBleep, playBleep, resolveBackend, useSoundEngine, type BleepName } from '@/lib/sound'
import { BACKEND_INFO, BLEEP_INFO, fmtDb } from './labels'
import { loadWave, type Wave } from './wave'
import { POLICY_MS, WaveCanvas } from './WaveCanvas'

/** One bleep: real waveform of the source that will play, measurements, audition button. */
export function BleepCard({ name, index, accent, reduced }: { name: BleepName; index: number; accent: string; reduced: boolean }) {
  const pref = useSoundEngine((s) => s.pref)
  const packs = useSoundEngine((s) => s.packs)
  const backend = resolveBackend(name, pref)
  const url = backend === 'synth' ? undefined : packs[backend].bleeps[name]?.urls[0]
  const [wave, setWave] = useState<Wave | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const durRef = useRef(0)

  useEffect(() => {
    let alive = true
    void loadWave(name, backend, url).then((w) => {
      if (alive) setWave(w)
    })
    return () => {
      alive = false
    }
  }, [name, backend, url])

  const dur = wave?.durationMs ?? 0
  useEffect(() => {
    durRef.current = dur
  }, [dur])
  const windowMs = Math.max(250, Math.ceil((dur + 20) / 50) * 50)
  const info = BLEEP_INFO[name]
  const over = dur > POLICY_MS

  // visualise every playback of this bleep, wherever it was triggered from
  useEffect(() => {
    const off = onBleep((e) => {
      if (e.name !== name) return
      const card = cardRef.current
      card?.setAttribute('data-hot', '')
      window.setTimeout(() => card?.removeAttribute('data-hot'), Math.max(180, durRef.current))
      const head = headRef.current
      if (!head || reduced || !durRef.current) return
      const end = (durRef.current / windowMs) * 100
      head.getAnimations().forEach((a) => a.cancel())
      head.animate(
        [
          { left: '0%', opacity: 1 },
          { left: `${end}%`, opacity: 1 },
        ],
        { duration: durRef.current, easing: 'linear' },
      )
    })
    return off
  }, [name, windowMs, reduced])

  return (
    <article
      ref={cardRef}
      data-augmented-ui="tl-clip br-clip border"
      className="jxs-card group flex flex-col min-w-0"
      aria-label={`${info.label} (${name})`}
    >
      <header className="flex items-center gap-2 px-2.5 pt-2">
        <span className="text-jx-accent [&>svg]:size-4 shrink-0" aria-hidden="true">
          {info.icon}
        </span>
        <span className="font-head font-semibold uppercase tracking-wider text-[0.78rem] leading-tight truncate">{info.label}</span>
        <span className="jx-num text-[0.625rem] text-jx-dim">{name}</span>
        <span className="flex-1" />
        <span className="jx-num text-[0.625rem] text-jx-dim">{String(index + 1).padStart(2, '0')}</span>
      </header>
      <p className="px-2.5 min-h-[2.4em] text-[0.7rem] leading-snug text-jx-dim line-clamp-2" title={info.desc}>
        {info.desc}
      </p>
      <div className="relative mx-2.5 mt-1.5 h-14 border border-jx-line/40 bg-black/25 overflow-hidden">
        <WaveCanvas wave={wave} windowMs={windowMs} accent={accent} />
        <div ref={headRef} className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_6px_white] opacity-0 pointer-events-none" style={{ left: 0 }} />
        <span className="absolute right-1 top-0.5 jx-num text-[0.625rem] text-jx-dim">{windowMs} ms</span>
      </div>
      <footer className="flex items-center gap-2 px-2.5 pt-1.5 pb-2">
        <dl className="flex gap-3 min-w-0 text-[0.625rem] leading-tight">
          <div>
            <dt className="jx-label text-[0.625rem]">Czas</dt>
            <dd className={`jx-num ${over ? 'text-jx-warn' : 'text-jx-text'}`}>{wave ? `${Math.round(dur)} ms` : '…'}</dd>
          </div>
          <div>
            <dt className="jx-label text-[0.625rem]">Szczyt</dt>
            <dd className="jx-num text-jx-text">{wave ? fmtDb(wave.peak) : '…'}</dd>
          </div>
        </dl>
        <span className="flex-1" />
        <span className={`jx-num text-[0.625rem] px-1 border ${BACKEND_INFO[backend].tone}`} title={BACKEND_INFO[backend].label}>
          {BACKEND_INFO[backend].short}
        </span>
        <button
          type="button"
          className="jxs-play grid place-items-center size-8 shrink-0 cursor-pointer"
          data-augmented-ui="tl-clip br-clip border"
          aria-label={`Odtwórz: ${info.label} (${name})`}
          onClick={() => playBleep(name)}
        >
          <IconPlayerPlayFilled className="size-3.5" aria-hidden="true" />
        </button>
      </footer>
    </article>
  )
}
