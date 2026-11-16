import 'material-symbols/outlined.css'
import { useState, type ReactNode } from 'react'
import {
  IconActivityHeartbeat,
  IconAtom,
  IconBolt,
  IconBrain,
  IconCpu,
  IconFingerprint,
  IconRadar2,
  IconRocket,
  IconSatellite,
  IconShieldBolt,
  IconTarget,
  IconWifi,
  type Icon as TablerIcon,
} from '@tabler/icons-react'
import { Activity, Atom as LAtom, BrainCircuit, Cpu as LCpu, Crosshair as LCrosshair, Orbit, Radar, Rocket as LRocket, Satellite, ScanFace, ShieldCheck as LShield, Zap, type LucideIcon } from 'lucide-react'
import {
  Atom as PAtom,
  Brain as PBrain,
  Broadcast,
  Cpu as PCpu,
  Crosshair as PCrosshair,
  Fingerprint as PFingerprint,
  Lightning,
  Planet,
  Pulse,
  Rocket as PRocket,
  ShieldCheck as PShield,
  Target as PTarget,
  type IconWeight,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { addCollection, Icon as IconifyIcon } from '@iconify/react/offline'
import { ARSENAL_GAME_ICONS, ARSENAL_GAME_ICONS_SUBSET } from '@/data/gameIconsArsenal'
import { HudButton } from '@/hud'
import { ExtLink, SectionHead, Tag } from './common'

addCollection(ARSENAL_GAME_ICONS_SUBSET)

const TABLER: [string, TablerIcon][] = [
  ['radar-2', IconRadar2],
  ['cpu', IconCpu],
  ['shield-bolt', IconShieldBolt],
  ['satellite', IconSatellite],
  ['rocket', IconRocket],
  ['target', IconTarget],
  ['atom', IconAtom],
  ['bolt', IconBolt],
  ['brain', IconBrain],
  ['activity-heartbeat', IconActivityHeartbeat],
  ['wifi', IconWifi],
  ['fingerprint', IconFingerprint],
]
const LUCIDE: [string, LucideIcon][] = [
  ['radar', Radar],
  ['cpu', LCpu],
  ['shield-check', LShield],
  ['satellite', Satellite],
  ['rocket', LRocket],
  ['crosshair', LCrosshair],
  ['atom', LAtom],
  ['zap', Zap],
  ['brain-circuit', BrainCircuit],
  ['activity', Activity],
  ['orbit', Orbit],
  ['scan-face', ScanFace],
]
const PHOSPHOR: [string, PhosphorIcon][] = [
  ['Planet', Planet],
  ['Cpu', PCpu],
  ['ShieldCheck', PShield],
  ['Broadcast', Broadcast],
  ['Rocket', PRocket],
  ['Crosshair', PCrosshair],
  ['Atom', PAtom],
  ['Lightning', Lightning],
  ['Brain', PBrain],
  ['Pulse', Pulse],
  ['Target', PTarget],
  ['Fingerprint', PFingerprint],
]
const PH_WEIGHTS: IconWeight[] = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone']
const MATERIAL = ['radar', 'memory', 'shield', 'satellite_alt', 'rocket_launch', 'my_location', 'bolt', 'neurology', 'monitor_heart', 'hub', 'fingerprint', 'deployed_code']

function Cell({ name, children }: { name: string; children: ReactNode }) {
  return (
    <figure className="group flex flex-col items-center justify-center gap-1 p-2 border border-jx-line/30 hover:border-jx-accent/70 hover:bg-jx-accent/8 transition-colors min-w-0" title={name}>
      <span className="text-jx-accent grid place-items-center drop-shadow-[0_0_6px_hsl(var(--jx-hue)_100%_55%/0.5)]">{children}</span>
      <figcaption className="jx-num text-[0.55rem] text-jx-dim truncate max-w-full group-hover:text-jx-text">{name}</figcaption>
    </figure>
  )
}

function Family({ title, license, pkg, href, note, children }: { title: string; license: ReactNode; pkg: string; href: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="jx-aug p-3 flex flex-col gap-2 min-w-0 [will-change:transform]" aria-label={`Ikony ${title}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="jx-title text-[0.85rem]">{title}</h4>
        {license}
        <code className="jx-num text-[0.62rem] text-jx-dim">{pkg}</code>
        <span className="flex-1" />
        <ExtLink href={href} className="jx-num text-[0.62rem] text-jx-dim">
          {href.replace(/^https?:\/\//, '')}
        </ExtLink>
      </header>
      {children}
      {note && <p className="text-[0.7rem] text-jx-dim leading-snug">{note}</p>}
    </section>
  )
}

const grid = 'grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(4.6rem,1fr))]'

export function IconsTab() {
  const [size, setSize] = useState(28)
  const [stroke, setStroke] = useState(1.5)
  const [fill, setFill] = useState(false)
  const [wght, setWght] = useState(300)
  const ok = 'text-jx-ok border-jx-ok/60'

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 w-44">
          <span className="jx-label text-[0.62rem]">
            Rozmiar · <span className="jx-num text-jx-accent">{size}px</span>
          </span>
          <input type="range" min={16} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-[var(--jx-accent)]" aria-label="Rozmiar ikon" />
        </label>
        <label className="flex flex-col gap-1 w-44">
          <span className="jx-label text-[0.62rem]">
            Kreska (Tabler, Lucide) · <span className="jx-num text-jx-accent">{stroke.toFixed(2)}</span>
          </span>
          <input type="range" min={0.75} max={2.5} step={0.25} value={stroke} onChange={(e) => setStroke(Number(e.target.value))} className="accent-[var(--jx-accent)]" aria-label="Grubość kreski" />
        </label>
        <label className="flex flex-col gap-1 w-44">
          <span className="jx-label text-[0.62rem]">
            Material wght · <span className="jx-num text-jx-accent">{wght}</span>
          </span>
          <input type="range" min={100} max={700} step={100} value={wght} onChange={(e) => setWght(Number(e.target.value))} className="accent-[var(--jx-accent)]" aria-label="Grubość Material Symbols" />
        </label>
        <HudButton size="sm" active={fill} onClick={() => setFill(!fill)}>
          Material FILL
        </HudButton>
        <span className="flex-1" />
        <p className="text-[0.72rem] text-jx-dim max-w-sm leading-snug">Wszystkie ikony renderowane offline z pakietów npm – bez zapytań do CDN i API Iconify.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-3 xl:grid-cols-2 pb-4">
          <Family title="Tabler Icons" license={<Tag className={ok}>MIT</Tag>} pkg="@tabler/icons-react" href="https://tabler.io/icons" note="Główny zestaw interfejsu – nawigacja, przyciski, nagłówki paneli.">
            <div className={grid}>
              {TABLER.map(([n, I]) => (
                <Cell key={n} name={n}>
                  <I size={size} stroke={stroke} aria-hidden="true" />
                </Cell>
              ))}
            </div>
          </Family>

          <Family title="Lucide" license={<Tag className={ok}>ISC</Tag>} pkg="lucide-react" href="https://lucide.dev">
            <div className={grid}>
              {LUCIDE.map(([n, I]) => (
                <Cell key={n} name={n}>
                  <I size={size} strokeWidth={stroke} aria-hidden="true" />
                </Cell>
              ))}
            </div>
          </Family>

          <Family title="Phosphor" license={<Tag className={ok}>MIT</Tag>} pkg="@phosphor-icons/react" href="https://phosphoricons.com" note="Sześć grubości tej samej ikony – od thin do duotone.">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">
                      Ikona
                    </th>
                    {PH_WEIGHTS.map((w) => (
                      <th key={w} scope="col" className="jx-num text-[0.55rem] text-jx-dim font-normal pb-1">
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PHOSPHOR.slice(0, 4).map(([n, I]) => (
                    <tr key={n}>
                      <th scope="row" className="jx-num text-[0.58rem] text-jx-dim font-normal text-left pr-2">
                        {n}
                      </th>
                      {PH_WEIGHTS.map((w) => (
                        <td key={w} className="text-center py-1 text-jx-accent">
                          <I size={size} weight={w} className="inline-block" aria-hidden="true" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={grid}>
              {PHOSPHOR.slice(4).map(([n, I]) => (
                <Cell key={n} name={n}>
                  <I size={size} weight="duotone" aria-hidden="true" />
                </Cell>
              ))}
            </div>
          </Family>

          <Family
            title="Material Symbols"
            license={<Tag className={ok}>Apache-2.0</Tag>}
            pkg="material-symbols"
            href="https://fonts.google.com/icons"
            note="Font zmienny – osie FILL, wght, GRAD i opsz sterowane przez font-variation-settings (ligatury nazw)."
          >
            <div className={grid}>
              {MATERIAL.map((n) => (
                <Cell key={n} name={n}>
                  <span
                    className="material-symbols-outlined leading-none"
                    style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${wght}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}` }}
                    aria-hidden="true"
                  >
                    {n}
                  </span>
                </Cell>
              ))}
            </div>
          </Family>

          <div className="xl:col-span-2">
            <Family
              title="Game-icons.net"
              license={<Tag className="text-jx-warn border-jx-warn/60">CC BY 3.0</Tag>}
              pkg="@iconify/react + @iconify-json/game-icons"
              href="https://game-icons.net"
              note={
                <>
                  <strong className="text-jx-warn font-semibold">Atrybucja (wymagana):</strong> Icons by Lorc, Delapouite &amp; contributors – game-icons.net, licencja{' '}
                  <a className="underline hover:text-white" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer noopener">
                    CC BY 3.0
                  </a>
                  . Do paczki trafia tylko {ARSENAL_GAME_ICONS.length} ikon wyciągniętych offline z @iconify-json.
                </>
              }
            >
              <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(5.4rem,1fr))]">
                {ARSENAL_GAME_ICONS.map((n) => (
                  <Cell key={n} name={n}>
                    <IconifyIcon icon={`game-icons:${n}`} width={size + 4} height={size + 4} aria-hidden="true" />
                  </Cell>
                ))}
              </div>
            </Family>
          </div>
        </div>
        <SectionHead meta="każda ikona z pakietu npm">Zasada</SectionHead>
        <p className="text-[0.78rem] text-jx-text/85 pb-6 max-w-3xl leading-relaxed">
          Ikony interfejsu dziedziczą kolor przez <code className="jx-num text-jx-accent">currentColor</code>, więc automatycznie podążają za odcieniem akcentu. Zestawy MIT, ISC i Apache-2.0 nie wymagają podpisu w
          interfejsie; game-icons (CC BY 3.0) – tak, dlatego atrybucja stoi przy każdym miejscu ich użycia.
        </p>
      </div>
    </div>
  )
}
