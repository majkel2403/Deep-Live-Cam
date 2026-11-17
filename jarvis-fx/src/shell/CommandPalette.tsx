import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command, defaultFilter } from 'cmdk'
import IconBooks from '@tabler/icons-react/icons/IconBooks'
import IconBrightnessHalf from '@tabler/icons-react/icons/IconBrightnessHalf'
import IconCommand from '@tabler/icons-react/icons/IconCommand'
import IconLayoutDashboard from '@tabler/icons-react/icons/IconLayoutDashboard'
import IconPalette from '@tabler/icons-react/icons/IconPalette'
import IconPower from '@tabler/icons-react/icons/IconPower'
import IconSearch from '@tabler/icons-react/icons/IconSearch'
import IconSparkles from '@tabler/icons-react/icons/IconSparkles'
import IconTopologyStar3 from '@tabler/icons-react/icons/IconTopologyStar3'
import IconVolume from '@tabler/icons-react/icons/IconVolume'
import IconVolumeOff from '@tabler/icons-react/icons/IconVolumeOff'
import IconWaveSine from '@tabler/icons-react/icons/IconWaveSine'
import IconWalk from '@tabler/icons-react/icons/IconWalk'
import IconLineScan from '@tabler/icons-react/icons/IconLineScan'
import IconCube from '@tabler/icons-react/icons/IconCube'
import IconPhoto from '@tabler/icons-react/icons/IconPhoto'
import IconAtom2 from '@tabler/icons-react/icons/IconAtom2'
import IconCrosshair from '@tabler/icons-react/icons/IconCrosshair'
import IconLoader2 from '@tabler/icons-react/icons/IconLoader2'
import IconTypography from '@tabler/icons-react/icons/IconTypography'
import IconChartDonut3 from '@tabler/icons-react/icons/IconChartDonut3'
import IconTimeline from '@tabler/icons-react/icons/IconTimeline'
import IconGauge from '@tabler/icons-react/icons/IconGauge'
import { FX } from '@/fx/registry'
import { FX_CATEGORIES, type FxCategory } from '@/fx/types'
import { navigate } from '@/lib/router'
import { useSettings, type MotionPref, type QualityPref, type ViewId } from '@/lib/store'
import { playBleep } from '@/lib/sound'

/*
 * Command palette (Ctrl+K): cmdk list inside a Radix Dialog, skinned as an augmented-ui HUD panel.
 * The Command-in-Dialog composition follows the pattern popularised by shadcn/ui (MIT) but is
 * written from scratch here. Contract (used by App.tsx): <CommandPalette open onOpenChange />.
 */

const VIEW_ITEMS: { id: ViewId; label: string; icon: ReactNode; keywords: string[] }[] = [
  { id: 'bridge', label: 'Mostek', icon: <IconLayoutDashboard />, keywords: ['bridge', 'dashboard', 'telemetria', 'start'] },
  { id: 'gallery', label: 'Galeria FX', icon: <IconSparkles />, keywords: ['gallery', 'efekty', 'effects'] },
  { id: 'agents', label: 'Agenci', icon: <IconTopologyStar3 />, keywords: ['agents', 'topologia', 'graf'] },
  { id: 'sound', label: 'Dźwięk', icon: <IconWaveSine />, keywords: ['sound', 'audio', 'bleepy', 'laboratorium'] },
  { id: 'arsenal', label: 'Arsenał', icon: <IconBooks />, keywords: ['arsenal', 'licencje', 'zasoby', 'fonty', 'ikony'] },
  { id: 'boot', label: 'Rozruch', icon: <IconPower />, keywords: ['boot', 'sekwencja', 'start'] },
]

const HUE_PRESETS: { hue: number; label: string }[] = [
  { hue: 188, label: 'Cyjan JARVIS' },
  { hue: 200, label: 'Lazur' },
  { hue: 160, label: 'Szmaragd' },
  { hue: 28, label: 'Bursztyn' },
  { hue: 350, label: 'Karmazyn' },
  { hue: 265, label: 'Fiolet' },
]

const CAT_ICON: Record<FxCategory, ReactNode> = {
  webgl: <IconCube />,
  background: <IconPhoto />,
  particles: <IconAtom2 />,
  hud: <IconCrosshair />,
  loader: <IconLoader2 />,
  text: <IconTypography />,
  data: <IconChartDonut3 />,
  motion: <IconTimeline />,
}

/** Diacritic-insensitive fuzzy match: "czasteczki" finds "Cząsteczki", "lad" finds "Ładowanie". */
function fold(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
}
function plFilter(value: string, search: string, keywords?: string[]) {
  return defaultFilter(fold(value), fold(search), keywords?.map(fold))
}

function Item({
  value,
  keywords,
  icon,
  label,
  hint,
  onSelect,
}: {
  value: string
  keywords?: string[]
  icon?: ReactNode
  label: ReactNode
  hint?: ReactNode
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="relative flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer select-none text-[0.84rem] text-jx-text font-ui border-l-2 border-transparent data-[selected=true]:border-jx-accent data-[selected=true]:bg-jx-accent/15 data-[selected=true]:text-white data-[disabled=true]:opacity-40"
    >
      {icon && <span className="text-jx-accent shrink-0 [&>svg]:size-4 grid place-items-center">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {hint && <span className="jx-num text-[0.625rem] text-jx-dim tracking-wider shrink-0">{hint}</span>}
    </Command.Item>
  )
}

function GroupHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <span className="flex items-center gap-2 px-2 pt-2.5 pb-1">
      <span className="jx-label text-[0.64rem] text-jx-accent/80">{children}</span>
      <span className="flex-1 h-px bg-jx-line/60" />
      {count !== undefined && <span className="jx-num text-[0.625rem] text-jx-dim">{count}</span>}
    </span>
  )
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  // bleep on open/close (playBleep de-duplicates the App's own Ctrl+K bleep)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    playBleep(open ? 'open' : 'close')
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 left-1/2 top-[8vh] -translate-x-1/2 w-[min(680px,calc(100vw-1.5rem))] outline-none"
        >
          {/* Radix unmounts the content on close, so the search state below resets every time */}
          <PaletteBody close={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PaletteBody({ close }: { close: () => void }) {
  const [search, setSearch] = useState('')
  const soundOn = useSettings((s) => s.soundOn)
  const scanlines = useSettings((s) => s.scanlines)
  const hue = useSettings((s) => s.hue)
  const motion = useSettings((s) => s.motion)
  const quality = useSettings((s) => s.quality)
  const set = useSettings((s) => s.set)
  const listRef = useRef<HTMLDivElement>(null)

  const fxGroups = useMemo(
    () =>
      FX_CATEGORIES.map((c) => ({ ...c, items: FX.filter((f) => f.category === c.id) })).filter((g) => g.items.length > 0),
    [],
  )

  const run = (fn: () => void, sound: 'click' | 'toggle' | 'success' = 'click') => {
    fn()
    playBleep(sound)
    close()
  }

  const motionLabels: Record<MotionPref, string> = { auto: 'systemowy', full: 'pełny', reduced: 'ograniczony' }
  const qualityLabels: Record<QualityPref, string> = { auto: 'automatyczna', low: 'niska', med: 'średnia', high: 'wysoka' }

  return (
    <Command
      label="Paleta poleceń"
      filter={plFilter}
      loop
      data-augmented-ui="tl-clip br-clip tr-clip-x border"
      className="jx-aug flex flex-col max-h-[min(78vh,640px)] shadow-[0_0_60px_hsl(var(--jx-hue)_100%_40%/0.18)]"
    >
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-jx-line/60">
        <IconCommand className="size-4 text-jx-accent" aria-hidden="true" />
        <Dialog.Title className="jx-title text-[0.78rem] leading-none">Paleta poleceń</Dialog.Title>
        <span className="flex-1" />
        <span className="jx-num text-[0.625rem] text-jx-dim tracking-widest">CMD · {FX.length} FX</span>
      </header>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-jx-line/40 bg-jx-accent/5">
        <IconSearch className="size-4 text-jx-accent shrink-0" aria-hidden="true" />
        <Command.Input
          value={search}
          onValueChange={(v) => {
            setSearch(v)
            playBleep('type')
            listRef.current?.scrollTo({ top: 0 })
          }}
          placeholder="Widok, efekt, technologia lub polecenie…"
          aria-label="Szukaj polecenia"
          className="flex-1 min-w-0 bg-transparent text-[0.95rem] font-ui text-jx-text placeholder:text-jx-dim/80"
        />
        <kbd className="jx-num text-[0.625rem] text-jx-dim border border-jx-line/70 px-1.5 py-0.5">ESC</kbd>
      </div>

      <Command.List ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1.5 pb-2 scroll-pt-8">
        <Command.Empty className="px-3 py-8 text-center">
          <p className="jx-label text-jx-warn">Brak dopasowań</p>
          <p className="text-sm text-jx-dim mt-1">Spróbuj nazwy biblioteki, np. „GSAP”, „shader” albo „radar”.</p>
        </Command.Empty>

        <Command.Group heading={<GroupHeading>Nawigacja</GroupHeading>}>
          {VIEW_ITEMS.map((v, i) => (
            <Item key={v.id} value={`widok ${v.label} ${v.id}`} keywords={v.keywords} icon={v.icon} label={`Przejdź: ${v.label}`} hint={`ALT+${i + 1}`} onSelect={() => run(() => navigate(v.id))} />
          ))}
        </Command.Group>

        <Command.Group heading={<GroupHeading>System</GroupHeading>}>
          <Item
            value="system dźwięk"
            keywords={['sound', 'mute', 'wycisz', 'audio', 'glosnosc']}
            icon={soundOn ? <IconVolumeOff /> : <IconVolume />}
            label={soundOn ? 'Wycisz dźwięki interfejsu' : 'Włącz dźwięki interfejsu'}
            hint={soundOn ? 'WŁ.' : 'WYŁ.'}
            onSelect={() => run(() => set({ soundOn: !soundOn }), 'toggle')}
          />
          <Item
            value="system linie skanowania"
            keywords={['scanlines', 'crt', 'nakładka', 'overlay']}
            icon={<IconLineScan />}
            label={scanlines ? 'Wyłącz linie skanowania' : 'Włącz linie skanowania'}
            hint={scanlines ? 'WŁ.' : 'WYŁ.'}
            onSelect={() => run(() => set({ scanlines: !scanlines }), 'toggle')}
          />
          {(['auto', 'full', 'reduced'] as MotionPref[])
            .filter((m) => m !== motion)
            .map((m) => (
              <Item
                key={m}
                value={`system ruch ${motionLabels[m]}`}
                keywords={['motion', 'animacje', 'reduced motion', 'dostępność']}
                icon={<IconWalk />}
                label={`Tryb ruchu: ${motionLabels[m]}`}
                hint={`TERAZ: ${motionLabels[motion].toUpperCase()}`}
                onSelect={() => run(() => set({ motion: m }), 'toggle')}
              />
            ))}
          {(['auto', 'low', 'med', 'high'] as QualityPref[])
            .filter((q) => q !== quality)
            .map((q) => (
              <Item
                key={q}
                value={`system jakość ${qualityLabels[q]}`}
                keywords={['quality', 'wydajność', 'gpu', 'performance']}
                icon={<IconGauge />}
                label={`Jakość efektów: ${qualityLabels[q]}`}
                onSelect={() => run(() => set({ quality: q }), 'toggle')}
              />
            ))}
          <Item
            value="system powtórz rozruch"
            keywords={['boot', 'replay', 'restart', 'intro', 'sekwencja']}
            icon={<IconPower />}
            label="Odtwórz sekwencję rozruchu"
            hint="PRZEŁADUJE"
            onSelect={() =>
              run(() => {
                set({ bootSeen: false })
                // give the persist middleware a tick to write localStorage before reloading
                setTimeout(() => window.location.reload(), 60)
              }, 'success')
            }
          />
        </Command.Group>

        <Command.Group heading={<GroupHeading>Odcień akcentu</GroupHeading>}>
          {HUE_PRESETS.map((p) => (
            <Item
              key={p.hue}
              value={`odcień ${p.label} ${p.hue}`}
              keywords={['hue', 'kolor', 'akcent', 'motyw', 'theme', 'color']}
              icon={<span className="size-3.5 border border-white/30 shadow-[0_0_8px_currentColor]" style={{ background: `hsl(${p.hue} 100% 52%)`, color: `hsl(${p.hue} 100% 52%)` }} />}
              label={
                <>
                  Akcent: {p.label} {p.hue === hue && <span className="text-jx-dim">(aktywny)</span>}
                </>
              }
              hint={`${p.hue}°`}
              onSelect={() => run(() => set({ hue: p.hue }), 'toggle')}
            />
          ))}
          <Item
            value="odcień losowy"
            keywords={['random', 'losuj', 'kolor', 'hue']}
            icon={<IconPalette />}
            label="Akcent: losowy odcień"
            onSelect={() => run(() => set({ hue: Math.floor(Math.random() * 360) }), 'toggle')}
          />
          <Item
            value="odcień paleta tokenów"
            keywords={['tokens', 'paleta', 'design', 'kolory']}
            icon={<IconBrightnessHalf />}
            label="Pokaż paletę tokenów (Arsenał)"
            onSelect={() => run(() => navigate('arsenal'))}
          />
        </Command.Group>

        {fxGroups.map((g) => (
          <Command.Group key={g.id} heading={<GroupHeading count={g.items.length}>Efekty · {g.label}</GroupHeading>}>
            {g.items.map((f) => (
              <Item
                key={f.id}
                value={`efekt ${f.title} ${f.id}`}
                keywords={[...f.tech, ...(f.tags ?? []), g.label, f.license]}
                icon={CAT_ICON[f.category]}
                label={
                  <>
                    {f.title}
                    <span className="ml-2 text-[0.7rem] text-jx-dim">{f.tech.slice(0, 3).join(' · ')}</span>
                  </>
                }
                hint={f.webgl ? 'WEBGL' : undefined}
                onSelect={() => run(() => navigate('gallery', f.id))}
              />
            ))}
          </Command.Group>
        ))}
      </Command.List>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-t border-jx-line/50 jx-label text-[0.625rem]">
        <span>
          <kbd className="jx-num text-jx-accent">↑↓</kbd> wybór
        </span>
        <span>
          <kbd className="jx-num text-jx-accent">↵</kbd> wykonaj
        </span>
        <span>
          <kbd className="jx-num text-jx-accent">ESC</kbd> zamknij
        </span>
        <span className="flex-1" />
        <span className="normal-case tracking-normal">wyszukiwanie ignoruje polskie znaki</span>
      </footer>
    </Command>
  )
}
