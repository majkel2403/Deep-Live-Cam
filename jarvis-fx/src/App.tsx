import { lazy, Suspense, useEffect, useState } from 'react'
import { Leva } from 'leva'
import * as Tooltip from '@radix-ui/react-tooltip'
import IconLayoutDashboard from '@tabler/icons-react/icons/IconLayoutDashboard'
import IconSparkles from '@tabler/icons-react/icons/IconSparkles'
import IconTopologyStar3 from '@tabler/icons-react/icons/IconTopologyStar3'
import IconWaveSine from '@tabler/icons-react/icons/IconWaveSine'
import IconBooks from '@tabler/icons-react/icons/IconBooks'
import IconPower from '@tabler/icons-react/icons/IconPower'
import IconVolume from '@tabler/icons-react/icons/IconVolume'
import IconVolumeOff from '@tabler/icons-react/icons/IconVolumeOff'
import IconCommand from '@tabler/icons-react/icons/IconCommand'
import { Backdrop, ErrorBoundary, Glitch, HudButton, StatusDot } from '@/hud'
import { navigate, useRoute } from '@/lib/router'
import { useSettings, type ViewId } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { FxStage } from '@/fx/FxStage'
import { FX } from '@/fx/registry'
import { CommandPalette } from '@/shell/CommandPalette'
import { SettingsMenu } from '@/shell/SettingsMenu'
import { BootSequence } from '@/views/boot/BootSequence'

const VIEWS: Record<Exclude<ViewId, 'boot'> | 'boot', { label: string; icon: React.ReactNode; Comp: React.LazyExoticComponent<React.ComponentType> }> = {
  bridge: { label: 'Mostek', icon: <IconLayoutDashboard />, Comp: lazy(() => import('@/views/bridge/BridgeView')) },
  gallery: { label: 'Galeria FX', icon: <IconSparkles />, Comp: lazy(() => import('@/views/gallery/GalleryView')) },
  agents: { label: 'Agenci', icon: <IconTopologyStar3 />, Comp: lazy(() => import('@/views/agents/AgentsView')) },
  sound: { label: 'Dźwięk', icon: <IconWaveSine />, Comp: lazy(() => import('@/views/sound/SoundView')) },
  arsenal: { label: 'Arsenał', icon: <IconBooks />, Comp: lazy(() => import('@/views/arsenal/ArsenalView')) },
  boot: { label: 'Rozruch', icon: <IconPower />, Comp: lazy(() => import('@/views/boot/BootView')) },
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <time className="jx-num text-sm text-jx-accent jx-glow-text" dateTime={now.toISOString()}>
      {now.toLocaleTimeString('pl-PL', { hour12: false })}
    </time>
  )
}

function useApplyGlobalSettings() {
  const hue = useSettings((s) => s.hue)
  const motion = useSettings((s) => s.motion)
  useEffect(() => {
    document.documentElement.style.setProperty('--jx-hue', String(hue))
  }, [hue])
  useEffect(() => {
    const root = document.documentElement
    if (motion === 'auto') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      const apply = () => root.setAttribute('data-motion', mq.matches ? 'reduced' : 'full')
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    root.setAttribute('data-motion', motion)
  }, [motion])
}

export default function App() {
  useApplyGlobalSettings()
  const route = useRoute()
  const soundOn = useSettings((s) => s.soundOn)
  const scanlines = useSettings((s) => s.scanlines)
  const bootSeen = useSettings((s) => s.bootSeen)
  const set = useSettings((s) => s.set)
  const [booting, setBooting] = useState(() => !bootSeen && !route.solo && !navigator.webdriver)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        playBleep('open')
      }
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        const v = (Object.keys(VIEWS) as ViewId[])[Number(e.key) - 1]
        if (v) navigate(v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ?fx=<id> → render a single effect full-screen (used by screenshots/embeds)
  if (route.solo) {
    return (
      <>
        <Leva hidden />
        <FxStage id={route.solo} ids={FX.map((f) => f.id)} solo />
      </>
    )
  }

  const View = VIEWS[route.view].Comp

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={150}>
    <div className="h-full flex flex-col">
      <Leva hidden />
      <Backdrop />
      {scanlines && <div className="jx-scanlines" aria-hidden="true" />}

      <header className="flex items-center gap-1 min-[360px]:gap-2 sm:gap-3 px-1 min-[360px]:px-2 sm:px-4 h-14 shrink-0 min-w-0 border-b border-jx-line/50 bg-jx-bg/60 backdrop-blur">
        <button className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('bridge')} title="Strona główna">
          <span className="size-7 rounded-full border border-jx-accent shadow-[var(--jx-glow)] grid place-items-center">
            <span className="size-2.5 rounded-full bg-jx-accent shadow-[var(--jx-glow)]" />
          </span>
          <span className="hidden sm:inline-block">
            <Glitch mode="always">
              <span className="jx-logo text-base font-bold text-jx-accent jx-glow-text">J.A.R.V.I.S</span>
            </Glitch>
          </span>
          <span className="jx-label hidden md:inline">Mission Control · FX</span>
        </button>

        <nav className="flex items-center gap-0.5 min-[360px]:gap-1 ml-1 sm:ml-4 min-w-0 overflow-x-auto" aria-label="Widoki">
          {(Object.keys(VIEWS) as ViewId[]).map((id, i) => (
            <HudButton
              key={id}
              size="sm"
              active={route.view === id}
              aria-label={VIEWS[id].label.toUpperCase()}
              aria-current={route.view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
              icon={VIEWS[id].icon}
              title={`${VIEWS[id].label} (Alt+${i + 1})`}
              className="shrink-0 max-[359px]:px-1.5"
            >
              <span className="hidden xl:inline">{VIEWS[id].label}</span>
            </HudButton>
          ))}
        </nav>

        <span className="flex-1 min-w-0" />
        <span className="hidden sm:inline-flex">
          <HudButton size="sm" aria-label="Ctrl K – paleta poleceń" onClick={() => setPaletteOpen(true)} icon={<IconCommand />} title="Paleta poleceń (Ctrl+K)">
            <span className="hidden md:inline jx-num normal-case">Ctrl K</span>
          </HudButton>
        </span>
        <HudButton size="sm" aria-label={soundOn ? 'Wycisz' : 'Włącz dźwięk'} active={soundOn} onClick={() => set({ soundOn: !soundOn })} icon={soundOn ? <IconVolume /> : <IconVolumeOff />} />
        <SettingsMenu onOpenPalette={() => setPaletteOpen(true)} />
        <span className="hidden sm:flex items-center gap-2 pl-2 border-l border-jx-line/50">
          <StatusDot tone="ok" pulse />
          <Clock />
        </span>
      </header>
      {/* Phones: nav buttons are icon-only, so name the current view on its own line. */}
      <div className="sm:hidden flex items-center gap-2 px-3 h-7 shrink-0 border-b border-jx-line/40 bg-jx-bg/40 jx-label text-jx-accent min-w-0">
        <span aria-hidden="true" className="shrink-0">▸</span>
        <span className="truncate" aria-live="polite">{VIEWS[route.view].label}</span>
      </div>

      <main className="flex-1 min-h-0 p-3 md:p-4">
        <ErrorBoundary label={route.view} key={route.view}>
          <Suspense fallback={<div className="jx-label p-6 jx-caret">Inicjalizacja widoku</div>}>
            <View />
          </Suspense>
        </ErrorBoundary>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {booting && (
        <BootSequence
          onDone={() => {
            setBooting(false)
            set({ bootSeen: true })
          }}
        />
      )}
    </div>
    </Tooltip.Provider>
  )
}
