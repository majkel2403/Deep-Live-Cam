/**
 * "Polityka dźwięku" (checked against the real rendered/decoded audio) and the licence table of
 * every sound source the app uses or documents.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { DEFAULT_SETTINGS, useSettings } from '@/lib/store'
import { BLEEPS, audioState, resolveBackend, useSoundEngine, type BleepName } from '@/lib/sound'
import { BLEEP_INFO, CTX_STATE_PL, fmtDb } from './labels'
import { loadWave, type Wave } from './wave'
import { POLICY_MS } from './WaveCanvas'

const EXCEPTIONS: Partial<Record<BleepName, string>> = {
  boot: 'tylko sekwencja rozruchu',
  error: 'podwójny sygnał',
  alert: 'podwójny sygnał',
}

function useAllWaves() {
  const pref = useSoundEngine((s) => s.pref)
  const packs = useSoundEngine((s) => s.packs)
  const [waves, setWaves] = useState<Partial<Record<BleepName, Wave>>>({})
  useEffect(() => {
    let alive = true
    void Promise.all(
      BLEEPS.map(async (n) => {
        const b = resolveBackend(n, pref)
        const url = b === 'synth' ? undefined : packs[b].bleeps[n]?.urls[0]
        return [n, await loadWave(n, b, url)] as const
      }),
    ).then((list) => {
      if (!alive) return
      const out: Partial<Record<BleepName, Wave>> = {}
      for (const [n, w] of list) if (w) out[n] = w
      setWaves(out)
    })
    return () => {
      alive = false
    }
  }, [pref, packs])
  return waves
}

function Rule({ ok, title, children }: { ok: boolean | null; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 shrink-0 [&>svg]:size-4 ${ok === null ? 'text-jx-dim' : ok ? 'text-jx-ok' : 'text-jx-warn'}`} aria-hidden="true">
        {ok === false ? <IconAlertTriangle /> : <IconCheck />}
      </span>
      <div className="min-w-0">
        <div className="font-head font-semibold uppercase tracking-wider text-[0.76rem] text-jx-text">{title}</div>
        <div className="text-[0.74rem] leading-snug text-jx-dim">{children}</div>
      </div>
    </li>
  )
}

export function PolicyPanel() {
  const waves = useAllWaves()
  const soundOn = useSettings((s) => s.soundOn)
  const volume = useSettings((s) => s.volume)
  const measured = BLEEPS.filter((n) => waves[n])
  const over = measured.filter((n) => (waves[n]?.durationMs ?? 0) > POLICY_MS)
  const unexpected = over.filter((n) => !EXCEPTIONS[n])
  const loudest = measured.reduce<BleepName | null>((a, n) => (!a || (waves[n]?.peak ?? 0) > (waves[a]?.peak ?? 0) ? n : a), null)
  const loudPeak = loudest ? (waves[loudest]?.peak ?? 0) : 0

  return (
    <div className="p-3 flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        <Rule ok={measured.length ? unexpected.length === 0 : null} title="Krótko: poniżej 150 ms">
          {measured.length ? (
            <>
              Zmierzone na prawdziwym sygnale: <b className="text-jx-text jx-num">{measured.length - over.length}/{measured.length}</b> bleepów mieści się w limicie.
              {over.length > 0 && (
                <>
                  {' '}
                  Wyjątki:{' '}
                  {over.map((n, i) => (
                    <span key={n}>
                      {i > 0 && ', '}
                      <span className="jx-num text-jx-text">{n}</span> {Math.round(waves[n]!.durationMs)} ms{EXCEPTIONS[n] ? ` (${EXCEPTIONS[n]})` : ' — do skrócenia'}
                    </span>
                  ))}
                  .
                </>
              )}
            </>
          ) : (
            'Pomiar w toku…'
          )}
        </Rule>
        <Rule ok={loudest ? loudPeak <= 0.5 : null} title="Cicho">
          Domyślna głośność <b className="text-jx-text jx-num">{Math.round(DEFAULT_SETTINGS.volume * 100)}%</b>. Najgłośniejszy szczyt przy 100%: {loudest ? <span className="jx-num text-jx-text">{BLEEP_INFO[loudest].label.toLowerCase()} {fmtDb(loudPeak)}</span> : '…'}
          {loudest && soundOn && volume > 0 && (
            <>
              , przy obecnych {Math.round(volume * 100)}%: <span className="jx-num text-jx-text">{fmtDb(loudPeak * volume)}</span>
            </>
          )}
          .
        </Rule>
        <Rule ok title="Pod kontrolą użytkownika">
          Wyciszenie w nagłówku i tutaj, suwak głośności; zapamiętane w przeglądarce. Teraz: <b className={soundOn ? 'text-jx-ok' : 'text-jx-warn'}>{soundOn ? 'włączony' : 'wyciszony'}</b>.
        </Rule>
        <Rule ok title="Bez autoodtwarzania">
          Kontekst audio rusza dopiero po pierwszej interakcji (polityka przeglądarek). Stan teraz: <span className="jx-num text-jx-text">{CTX_STATE_PL[audioState()] ?? audioState()}</span>.
        </Rule>
        <Rule ok title="Bez kanonady">
          Powtórzenia są dławione: <span className="jx-num">type</span> co ≥ 30 ms, <span className="jx-num">hover</span> co ≥ 60 ms, pozostałe co ≥ 25 ms.
        </Rule>
      </ul>
    </div>
  )
}

type Row = { source: string; href?: string; license: string; licenseHref?: string; terms: string; status: ReactNode }

export function LicenseTable() {
  const packs = useSoundEngine((s) => s.packs)
  const wavBytes = Object.values(packs.wav.bleeps).reduce((n, b) => n + (b?.bytes ?? 0), 0)
  const wavFiles = Object.values(packs.wav.bleeps).reduce((n, b) => n + (b?.urls.length ?? 0), 0)
  const kenney = packs.kenney.status
  const rows: Row[] = [
    { source: 'Synteza WebAudio (src/lib/sound/synth.ts)', license: 'CC0 1.0 — własne', licenseHref: 'https://creativecommons.org/publicdomain/zero/1.0/', terms: 'brak wymogów', status: <span className="text-jx-ok">zawsze dostępna</span> },
    {
      source: 'WAV z scripts/render-sounds.mjs',
      license: 'CC0 1.0 — własne',
      licenseHref: 'https://creativecommons.org/publicdomain/zero/1.0/',
      terms: 'brak wymogów',
      status: <span className="text-jx-ok">dołączone{wavFiles ? `: ${wavFiles} plików, ${(wavBytes / 1024).toFixed(0)} KB` : ''}</span>,
    },
    {
      source: 'Kenney — Interface Sounds, Sci-fi Sounds',
      href: 'https://kenney.nl/assets/interface-sounds',
      license: 'CC0 1.0',
      licenseHref: 'https://kenney.nl/support',
      terms: 'atrybucja mile widziana, niewymagana',
      status: kenney === 'ready' || kenney === 'partial' ? <span className="text-jx-ok">zainstalowane lokalnie</span> : <span>opcjonalne — skrypt fetch-kenney.mjs</span>,
    },
    { source: 'Mixkit', href: 'https://mixkit.co/free-sound-effects/', license: 'Mixkit Sound Effects Free License', licenseHref: 'https://mixkit.co/license/', terms: 'bez atrybucji; nie wolno redystrybuować samych plików', status: 'nieużywane' },
    { source: 'Freesound', href: 'https://freesound.org', license: 'per plik: CC0 / CC BY 4.0 / CC BY-NC 4.0', terms: 'CC BY → atrybucja; CC BY-NC → tylko niekomercyjnie (unikamy)', status: 'nieużywane' },
    { source: 'ZapSplat', href: 'https://www.zapsplat.com', license: 'ZapSplat Standard License', licenseHref: 'https://www.zapsplat.com/license-type/standard-license/', terms: 'wymagana atrybucja: „Sound effects obtained from https://www.zapsplat.com”', status: 'nieużywane' },
    { source: 'howler.js', href: 'https://github.com/goldfire/howler.js', license: 'MIT', terms: 'zachować notę licencyjną', status: 'biblioteka' },
    { source: 'use-sound', href: 'https://github.com/joshwcomeau/use-sound', license: 'MIT', terms: 'zachować notę licencyjną', status: 'biblioteka' },
  ]
  const link = (text: string, href?: string) =>
    href ? (
      <a href={href} target="_blank" rel="noreferrer noopener" className="underline decoration-jx-line underline-offset-2 hover:text-jx-accent">
        {text}
      </a>
    ) : (
      text
    )
  return (
    <div className="overflow-x-auto p-2">
      <table className="jxs-table w-full min-w-[620px] border-collapse">
        <caption className="sr-only">Źródła dźwięków i ich licencje</caption>
        <thead>
          <tr>
            <th scope="col">Źródło</th>
            <th scope="col">Licencja</th>
            <th scope="col">Wymogi</th>
            <th scope="col">W projekcie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source}>
              <td className="text-jx-text">{link(r.source, r.href)}</td>
              <td className="jx-num text-[0.7rem] text-jx-accent">{link(r.license, r.licenseHref)}</td>
              <td className="text-jx-dim">{r.terms}</td>
              <td className="text-jx-dim">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2 pt-2 text-[0.7rem] text-jx-dim leading-snug">
        Zasada: do repozytorium trafiają wyłącznie dźwięki CC0 lub własne. Szczegóły i format manifestu: <span className="jx-num text-jx-accent">public/sounds/README.md</span>.
      </p>
    </div>
  )
}
