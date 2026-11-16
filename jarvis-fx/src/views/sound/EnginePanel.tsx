/**
 * Sound engine status & controls: backend preference, pack status (real load results), live
 * AudioContext figures, volume / mute (global useSettings, persisted).
 */
import { useEffect, useRef, useState } from 'react'
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { IconPlaylist } from '@tabler/icons-react'
import { HudButton, Readout, StatusDot } from '@/hud'
import { useSettings } from '@/lib/store'
import { BLEEPS, getAudio, playBleep, resolveBackend, useSoundEngine, type BackendPref, type PackInfo, type PackStatus } from '@/lib/sound'
import { BACKEND_INFO, CTX_STATE_PL } from './labels'

const PREFS: { id: BackendPref; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'synth', label: 'Synteza' },
  { id: 'wav', label: 'WAV' },
  { id: 'kenney', label: 'Kenney' },
]

const STATUS_PL: Record<PackStatus, { text: string; tone: 'ok' | 'warn' | 'danger' | 'dim' | 'accent' }> = {
  idle: { text: 'czeka', tone: 'dim' },
  loading: { text: 'ładowanie', tone: 'accent' },
  ready: { text: 'gotowe', tone: 'ok' },
  partial: { text: 'częściowo', tone: 'warn' },
  error: { text: 'błąd', tone: 'danger' },
  absent: { text: 'nie zainstalowano', tone: 'dim' },
}

function useAudioStats() {
  const [s, set] = useState({ state: 'none', rate: 0, latency: 0 })
  useEffect(() => {
    const read = () => {
      const a = getAudio(false)
      set({ state: a?.ctx.state ?? 'none', rate: a?.ctx.sampleRate ?? 0, latency: ((a?.ctx as AudioContext | undefined)?.baseLatency ?? 0) * 1000 })
    }
    read()
    const t = window.setInterval(read, 1000)
    return () => window.clearInterval(t)
  }, [])
  return s
}

function packCounts(p: PackInfo) {
  const list = Object.values(p.bleeps)
  const files = list.reduce((n, b) => n + (b?.urls.length ?? 0), 0)
  const loaded = list.reduce((n, b) => n + (b?.loaded ?? 0), 0)
  const bytes = list.reduce((n, b) => n + (b?.bytes ?? 0), 0)
  return { bleeps: list.length, files, loaded, bytes }
}

export function EnginePanel() {
  const soundOn = useSettings((s) => s.soundOn)
  const volume = useSettings((s) => s.volume)
  const set = useSettings((s) => s.set)
  const pref = useSoundEngine((s) => s.pref)
  const setPref = useSoundEngine((s) => s.setPref)
  const packs = useSoundEngine((s) => s.packs)
  const howler = useSoundEngine((s) => s.howler)
  const stats = useAudioStats()
  const seqRef = useRef<number[]>([])

  useEffect(() => () => seqRef.current.forEach((t) => window.clearTimeout(t)), [])

  // which backend actually serves each bleep right now
  const mix = BLEEPS.reduce<Record<string, number>>((m, n) => {
    const b = resolveBackend(n, pref)
    m[b] = (m[b] ?? 0) + 1
    return m
  }, {})
  const mixText = Object.entries(mix)
    .map(([b, n]) => `${BACKEND_INFO[b as keyof typeof BACKEND_INFO].short}${n < BLEEPS.length ? ` ×${n}` : ''}`)
    .join(' + ')

  const kenneyAbsent = packs.kenney.status === 'absent'
  const playAll = () => {
    seqRef.current.forEach((t) => window.clearTimeout(t))
    seqRef.current = BLEEPS.filter((n) => n !== 'boot').map((n, i) => window.setTimeout(() => playBleep(n), i * 260))
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Readout label="Aktywne źródło" value={<span className="text-[0.8em]">{mixText}</span>} hint="Backend wybrany dla każdego bleepa po uwzględnieniu preferencji i tego, co się wczytało" />
        <Readout label="AudioContext" value={<span className="text-[0.8em]">{CTX_STATE_PL[stats.state] ?? stats.state}</span>} tone={stats.state === 'running' ? 'ok' : stats.state === 'suspended' ? 'warn' : 'dim'} />
        <Readout label="Próbkowanie" value={stats.rate ? (stats.rate / 1000).toFixed(1).replace('.', ',') : '—'} unit={stats.rate ? 'kHz' : undefined} tone="dim" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="jx-label text-[0.62rem]" id="jxs-pref-label">
          Preferowane źródło
        </span>
        <div
          className="jxs-seg self-start"
          role="radiogroup"
          aria-labelledby="jxs-pref-label"
          onKeyDown={(e) => {
            // WAI-ARIA radio group: arrows move the selection between enabled options
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
            e.preventDefault()
            const enabled = PREFS.filter((p) => !(p.id === 'kenney' && kenneyAbsent))
            const i = enabled.findIndex((p) => p.id === pref)
            const next = enabled[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + enabled.length) % enabled.length]
            setPref(next.id)
            playBleep('toggle')
            e.currentTarget.querySelector<HTMLButtonElement>(`[data-pref="${next.id}"]`)?.focus()
          }}
        >
          {PREFS.map((p) => {
            const disabled = p.id === 'kenney' && kenneyAbsent
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                data-pref={p.id}
                tabIndex={pref === p.id ? 0 : -1}
                aria-checked={pref === p.id}
                aria-disabled={disabled || undefined}
                title={disabled ? 'Paczki Kenney nie są zainstalowane — uruchom node scripts/fetch-kenney.mjs' : undefined}
                onClick={() => {
                  if (disabled) return
                  setPref(p.id)
                  playBleep('toggle')
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-[0.74rem]" aria-label="Paczki dźwięków">
        {(['kenney', 'wav'] as const).map((id) => {
          const p = packs[id]
          const st = STATUS_PL[p.status]
          const c = packCounts(p)
          return (
            <li key={id} className="flex items-start gap-2 border-l-2 border-jx-line/50 pl-2">
              <StatusDot tone={st.tone} pulse={p.status === 'loading'} />
              <div className="min-w-0 flex-1 -mt-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-head font-semibold uppercase tracking-wider text-[0.74rem]">{BACKEND_INFO[id].label}</span>
                  <span className={`jx-label text-[0.58rem] ${st.tone === 'ok' ? 'text-jx-ok' : st.tone === 'warn' ? 'text-jx-warn' : st.tone === 'danger' ? 'text-jx-danger' : ''}`}>{st.text}</span>
                </div>
                {p.status === 'absent' && id === 'kenney' ? (
                  <p className="text-jx-dim leading-snug">
                    Opcjonalne paczki CC0. Lokalnie: <code className="jx-num text-jx-accent text-[0.68rem]">node scripts/fetch-kenney.mjs</code>
                  </p>
                ) : (
                  <p className="text-jx-dim leading-snug jx-num text-[0.66rem]">
                    {c.loaded}/{c.files} plików · {c.bleeps}/{BLEEPS.length} bleepów{c.bytes ? ` · ${(c.bytes / 1024).toFixed(0)} KB` : ''}
                    {p.license ? ` · ${p.license}` : ''}
                  </p>
                )}
              </div>
            </li>
          )
        })}
        <li className="flex items-start gap-2 border-l-2 border-jx-line/50 pl-2">
          <StatusDot tone="ok" />
          <div className="min-w-0 flex-1 -mt-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-head font-semibold uppercase tracking-wider text-[0.74rem]">{BACKEND_INFO.synth.label}</span>
              <span className="jx-label text-[0.58rem] text-jx-ok">zawsze</span>
            </div>
            <p className="text-jx-dim leading-snug jx-num text-[0.66rem]">oscylatory + obwiednie · fallback · howler: {howler === 'ready' ? 'wczytany' : howler === 'loading' ? 'ładowanie' : howler === 'error' ? 'błąd' : 'nieaktywny'}</p>
          </div>
        </li>
      </ul>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="jxs-volume" className="jx-label text-[0.62rem]">
            Głośność
          </label>
          <span className="flex-1" />
          <span className="jx-num text-[0.74rem] text-jx-accent">{Math.round(volume * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <HudButton
            size="sm"
            active={soundOn}
            onClick={() => set({ soundOn: !soundOn })}
            aria-label={soundOn ? 'Wycisz dźwięk' : 'Włącz dźwięk'}
            icon={soundOn ? <SpeakerHigh weight="duotone" /> : <SpeakerSlash weight="duotone" />}
          >
            {soundOn ? 'Wł.' : 'Wył.'}
          </HudButton>
          <input
            id="jxs-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            className="jxs-range"
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playBleep('click')}
            onKeyUp={(e) => (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' ? playBleep('click') : undefined)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <HudButton size="sm" icon={<IconPlaylist />} onClick={playAll} disabled={!soundOn}>
          Zagraj wszystkie
        </HudButton>
        {stats.state === 'suspended' && soundOn && (
          <HudButton size="sm" onClick={() => void getAudio()?.ctx.resume()}>
            Odblokuj audio
          </HudButton>
        )}
      </div>
    </div>
  )
}
