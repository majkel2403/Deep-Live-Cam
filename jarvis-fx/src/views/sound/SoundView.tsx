/**
 * "Dźwięk" — Sound Lab. Every number on this page is measured from the real audio path:
 * waveforms are rendered/decoded from the actual sources, the scope taps the shared analyser,
 * pack status comes from howler load results.
 */
import { useEffect, useState } from 'react'
import IconHistory from '@tabler/icons-react/icons/IconHistory'
import IconLicense from '@tabler/icons-react/icons/IconLicense'
import IconMusic from '@tabler/icons-react/icons/IconMusic'
import IconShieldCheck from '@tabler/icons-react/icons/IconShieldCheck'
import IconWaveSine from '@tabler/icons-react/icons/IconWaveSine'
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform'
import { HudButton, Panel } from '@/hud'
import { useAccent, useReducedMotion, useSettings } from '@/lib/store'
import { BLEEPS, initFileBackends, onBleep, type BleepEvent } from '@/lib/sound'
import { BleepCard } from './BleepCard'
import { EnginePanel } from './EnginePanel'
import { BACKEND_INFO, BLEEP_INFO } from './labels'
import { PanelTitle } from './PanelTitle'
import { LiveScope } from './LiveScope'
import { LicenseTable, PolicyPanel } from './PolicyPanels'
import { UseSoundDemo } from './UseSoundDemo'
import './sound.css'

export default function SoundView() {
  const { hex } = useAccent()
  const reduced = useReducedMotion()
  const soundOn = useSettings((s) => s.soundOn)
  const volume = useSettings((s) => s.volume)
  const set = useSettings((s) => s.set)

  // the lab needs pack status even before the first sound (idempotent; also started app-wide)
  useEffect(() => {
    void initFileBackends()
  }, [])

  const muted = !soundOn || volume <= 0

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-12 pb-2">
        <Panel title={<PanelTitle>Oscyloskop wyjścia</PanelTitle>} icon={<Waveform weight="duotone" />} code="ANALYSER · 2048" className="xl:col-span-8 min-h-[250px]" bodyClassName="p-2">
          <LiveScope accent={hex} muted={muted} reduced={reduced} />
        </Panel>

        <Panel title={<PanelTitle>Silnik dźwięku</PanelTitle>} icon={<IconWaveSine />} code="HOWLER · WEBAUDIO" className="xl:col-span-4">
          <EnginePanel />
        </Panel>

        <Panel
          title={<PanelTitle>Bleepy interfejsu</PanelTitle>}
          icon={<IconMusic />}
          code={<span className="hidden sm:inline">{BLEEPS.length} · CC0</span>}
          className="xl:col-span-8"
          actions={
            muted ? (
              <HudButton size="sm" onClick={() => set({ soundOn: true, volume: volume > 0 ? volume : 0.35 })} aria-label="Włącz dźwięk, aby odsłuchać bleepy">
                Włącz dźwięk
              </HudButton>
            ) : undefined
          }
          bodyClassName="p-2"
        >
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {BLEEPS.map((n, i) => (
              <BleepCard key={n} name={n} index={i} accent={hex} reduced={reduced} />
            ))}
          </div>
          <p className="px-1 pt-2 text-[0.68rem] text-jx-dim leading-snug">
            Przebieg pokazuje źródło, które zagra w tej chwili (wg preferencji i stanu wczytania), w skali czasu ≥ 250 ms; przerywana linia = limit 150 ms. Szczyt mierzony przy głośności 100%.
          </p>
        </Panel>

        <div className="xl:col-span-4 flex flex-col gap-3 min-w-0">
          <Panel title={<PanelTitle>Hook use-sound</PanelTitle>} icon={<IconWaveSine />} code="MIT">
            <UseSoundDemo />
          </Panel>
          <Panel title={<PanelTitle>Ostatnie odtworzenia</PanelTitle>} icon={<IconHistory />} className="flex-1 min-h-[180px]" bodyClassName="overflow-y-auto">
            <RecentEvents />
          </Panel>
        </div>

        <Panel title={<PanelTitle>Polityka dźwięku</PanelTitle>} icon={<IconShieldCheck />} className="xl:col-span-5">
          <PolicyPanel />
        </Panel>

        <Panel title={<PanelTitle>Źródła i licencje</PanelTitle>} icon={<IconLicense />} className="xl:col-span-7">
          <LicenseTable />
        </Panel>
      </div>
    </div>
  )
}

function RecentEvents() {
  const [events, setEvents] = useState<(BleepEvent & { wall: number })[]>([])
  useEffect(
    () =>
      onBleep((e) => {
        setEvents((list) => [{ ...e, wall: Date.now() }, ...list].slice(0, 12))
      }),
    [],
  )
  if (!events.length) {
    return <p className="p-3 text-[0.74rem] leading-snug text-jx-dim">Brak zdarzeń. Każdy odtworzony bleep — także z innych widoków, dopóki ta strona jest otwarta — pojawi się tutaj ze znacznikiem czasu i źródłem.</p>
  }
  return (
    <ol className="p-2 flex flex-col" aria-label="Ostatnio odtworzone dźwięki">
      {events.map((e, i) => {
        const t = new Date(e.wall)
        const ts = `${t.toLocaleTimeString('pl-PL', { hour12: false })},${String(t.getMilliseconds()).padStart(3, '0')}`
        return (
          <li key={`${e.at}-${i}`} className="grid grid-cols-[auto_1fr_auto] gap-2 items-baseline px-1 py-0.5 border-b border-jx-line/15 text-[0.72rem]">
            <span className="jx-num text-[0.66rem] text-jx-dim">{ts}</span>
            <span className="truncate">
              {BLEEP_INFO[e.name].label} <span className="jx-num text-jx-dim text-[0.64rem]">{e.name}</span>
            </span>
            <span className={`jx-num text-[0.625rem] px-1 border ${e.backend === 'external' ? 'text-jx-dim border-jx-line' : BACKEND_INFO[e.backend].tone}`}>
              {e.backend === 'external' ? 'ZEWN.' : BACKEND_INFO[e.backend].short}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
