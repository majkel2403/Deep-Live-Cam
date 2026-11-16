import 'material-symbols/outlined.css'
import './matrix.css'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, stagger, type JSAnimation } from 'animejs'
import { addCollection, Icon } from '@iconify/react/offline'
import { IconAntenna, IconAtom, IconBolt, IconBrain, IconCpu, IconDrone, IconRadar2, IconRocket, IconSatellite, IconScan, IconShieldBolt, IconTarget, IconTopologyStar3 } from '@tabler/icons-react'
import { Aperture, Atom, Brain, Broadcast, Cpu, Crosshair, Fingerprint, Graph, Lightning, Planet, ShieldChevron, Waveform } from '@phosphor-icons/react'
import { Activity, Brain as LBrain, Cpu as LCpu, Crosshair as LCrosshair, Orbit, Radar, Radio, Satellite, ScanEye, Shield, Zap } from 'lucide-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudChrome } from '../hud-kit/HudChrome'
import { rng } from '../hud-kit/color'
import { useSize } from '../hud-kit/useSize'
import { LBL } from '../hud-kit/ui'
import { GAME_ICON_NAMES, GAME_ICONS_SUBSET } from './gameIcons'

/**
 * Icon wall mixing five icon families. The activation wave is anime.js v4 `stagger()` with the
 * `grid` option, animating a CSS custom property (--lit) that the tile CSS turns into colour,
 * border, glow and scale. Game Icons are registered offline from a bundled subset (no API calls).
 */

// offline registration (idempotent)
addCollection(GAME_ICONS_SUBSET)

type Family = 'tabler' | 'ph-thin' | 'ph-duo' | 'lucide' | 'material' | 'game'
const FAMILIES: { id: Family; label: string; short: string; license: string }[] = [
  { id: 'tabler', label: 'Tabler', short: 'TB', license: 'MIT' },
  { id: 'ph-thin', label: 'Phosphor thin', short: 'PH·T', license: 'MIT' },
  { id: 'ph-duo', label: 'Phosphor duotone', short: 'PH·D', license: 'MIT' },
  { id: 'lucide', label: 'Lucide', short: 'LC', license: 'ISC' },
  { id: 'material', label: 'Material Symbols 100', short: 'MS', license: 'Apache-2.0' },
  { id: 'game', label: 'Game Icons', short: 'GI', license: 'CC BY 3.0' },
]

const TABLER = [IconRadar2, IconCpu, IconSatellite, IconShieldBolt, IconAtom, IconRocket, IconDrone, IconTarget, IconBolt, IconAntenna, IconBrain, IconTopologyStar3, IconScan]
const PHOSPHOR = [Cpu, Atom, Planet, Lightning, ShieldChevron, Graph, Brain, Waveform, Fingerprint, Crosshair, Broadcast, Aperture]
const LUCIDE = [Radar, LCpu, Orbit, Satellite, ScanEye, Shield, Activity, LBrain, Radio, Zap, LCrosshair]
const MATERIAL = ['radar', 'memory', 'satellite_alt', 'shield', 'neurology', 'deployed_code', 'bolt', 'hub', 'sensors', 'rocket_launch', 'fingerprint', 'network_intelligence', 'orbit', 'biotech']

interface Tile {
  fam: Family
  idx: number
  /** bumps when the tile flips to a new glyph */
  rev: number
}

function pick(r: () => number): Tile {
  const fam = FAMILIES[Math.floor(r() * FAMILIES.length)].id
  const pool = fam === 'tabler' ? TABLER.length : fam === 'ph-thin' || fam === 'ph-duo' ? PHOSPHOR.length : fam === 'lucide' ? LUCIDE.length : fam === 'material' ? MATERIAL.length : GAME_ICON_NAMES.length
  return { fam, idx: Math.floor(r() * pool), rev: 0 }
}

function Glyph({ tile, size }: { tile: Tile; size: number }): ReactNode {
  switch (tile.fam) {
    case 'tabler': {
      const C = TABLER[tile.idx % TABLER.length]
      return <C size={size} stroke={1.25} />
    }
    case 'ph-thin': {
      const C = PHOSPHOR[tile.idx % PHOSPHOR.length]
      return <C size={size} weight="thin" />
    }
    case 'ph-duo': {
      const C = PHOSPHOR[tile.idx % PHOSPHOR.length]
      return <C size={size} weight="duotone" />
    }
    case 'lucide': {
      const C = LUCIDE[tile.idx % LUCIDE.length]
      return <C size={size} strokeWidth={1} absoluteStrokeWidth />
    }
    case 'material':
      return (
        <span className="material-symbols-outlined hx-ms" style={{ fontSize: size }} aria-hidden="true">
          {MATERIAL[tile.idx % MATERIAL.length]}
        </span>
      )
    case 'game':
      return <Icon icon={`game-icons:${GAME_ICON_NAMES[tile.idx % GAME_ICON_NAMES.length]}`} width={size} height={size} />
  }
}

const TileView = memo(function TileView({ tile, size, caption }: { tile: Tile; size: number; caption: boolean }) {
  const fam = FAMILIES.find((f) => f.id === tile.fam)!
  return (
    <div className="hx-tile" data-flip={tile.rev > 0 ? 'true' : undefined} title={fam.label}>
      <span className="hx-lit" />
      <span className="hx-glyph">
        <span key={tile.rev} className="grid place-items-center">
          <Glyph tile={tile} size={size} />
        </span>
      </span>
      {caption && <span className="jx-num absolute bottom-0.5 right-1.5 text-[0.5rem] leading-none text-jx-dim">{fam.short}</span>}
    </div>
  )
})

export default function IconMatrix({ reducedMotion, stage, paused }: FxProps) {
  const c = useFxControls({
    tile: { value: 74, min: 48, max: 120, step: 2, label: 'rozmiar kafla' },
    stagger: { value: 90, min: 20, max: 200, step: 5, label: 'opóźnienie fali (ms)' },
    origin: { value: 'losowe', options: ['losowe', 'środek', 'pierwszy', 'ostatni'], label: 'źródło fali' },
    flips: { value: true, label: 'podmiana ikon' },
    captions: { value: true, label: 'podpisy zestawów' },
  })
  const [ref, size] = useSize<HTMLDivElement>()
  const gridRef = useRef<HTMLDivElement>(null)
  const tilePx = stage ? c.tile : 34
  const footerPx = stage ? 64 : 26
  const headPx = stage ? 46 : 22
  const cols = Math.max(3, Math.floor((size.width - (stage ? 48 : 16)) / (tilePx + 6)))
  const rows = Math.max(2, Math.floor((size.height - footerPx - headPx) / (tilePx + 6)))
  const count = size.width ? cols * rows : 0

  const [tiles, setTiles] = useState<Tile[]>([])
  useEffect(() => {
    const r = rng(77)
    setTiles(Array.from({ length: count }, () => pick(r)))
  }, [count])

  // occasional glyph swap
  useEffect(() => {
    if (!c.flips || paused || reducedMotion || !count) return
    const r = rng(Date.now() & 0xffff)
    const id = setInterval(() => {
      setTiles((ts) => {
        if (!ts.length) return ts
        const i = Math.floor(r() * ts.length)
        const next = ts.slice()
        next[i] = { ...pick(r), rev: ts[i].rev + 1 }
        return next
      })
    }, stage ? 650 : 1400)
    return () => clearInterval(id)
  }, [c.flips, paused, reducedMotion, count, stage])

  // anime.js activation wave – restarted from a new origin after every pass
  const animRef = useRef<JSAnimation[] | null>(null)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || !tiles.length) return
    const lits = grid.querySelectorAll<HTMLElement>('.hx-lit')
    const glyphs = grid.querySelectorAll<HTMLElement>('.hx-glyph')
    if (reducedMotion) {
      lits.forEach((el) => (el.style.opacity = '0.3'))
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    let alive = true
    const r = rng(9)
    const run = () => {
      if (!alive) return
      const from =
        c.origin === 'środek' ? 'center' : c.origin === 'pierwszy' ? 'first' : c.origin === 'ostatni' ? 'last' : Math.floor(r() * lits.length)
      const delay = stagger(stage ? c.stagger : c.stagger * 1.6, { grid: [cols, Math.ceil(lits.length / cols)], from })
      const wave = animate(lits, {
        opacity: [
          { to: 1, duration: 120, ease: 'outQuad' },
          { to: 0, duration: 460, ease: 'inQuad' },
        ],
        delay,
        onComplete: () => {
          timer = setTimeout(run, 500)
        },
      })
      const pop = animate(glyphs, {
        scale: [
          { to: 1.18, duration: 160, ease: 'outQuad' },
          { to: 1, duration: 600, ease: 'inOutSine' },
        ],
        delay,
      })
      animRef.current = [wave, pop]
    }
    run()
    return () => {
      alive = false
      clearTimeout(timer)
      animRef.current?.forEach((a) => a.revert())
      animRef.current = null
    }
    // the wave only needs restarting when the grid geometry or wave params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.length, cols, c.stagger, c.origin, reducedMotion, stage])

  useEffect(() => {
    animRef.current?.forEach((a) => (paused ? a.pause() : a.resume()))
  }, [paused])

  const glyphPx = Math.round(tilePx * 0.48)
  const counts = useMemo(() => {
    const m = new Map<Family, number>()
    for (const t of tiles) m.set(t.fam, (m.get(t.fam) ?? 0) + 1)
    return m
  }, [tiles])

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden jx-grid-bg">
      <div
        ref={gridRef}
        className="absolute left-1/2 -translate-x-1/2 grid"
        style={{ top: headPx + Math.max(0, (size.height - footerPx - headPx - (rows * (tilePx + 6) - 6)) / 2), gridTemplateColumns: `repeat(${cols}, ${tilePx}px)`, gridAutoRows: `${tilePx}px`, gap: 6 }}
        role="img"
        aria-label={`Matryca ${tiles.length} ikon z zestawów Tabler, Phosphor, Lucide, Material Symbols i Game Icons`}
      >
        {tiles.map((t, i) => (
          <TileView key={i} tile={t} size={stage ? glyphPx : 16} caption={stage && c.captions} />
        ))}
      </div>
      <HudChrome
        code="ICN-04 · MATRYCA"
        title="Pięć zestawów ikon"
        stage={stage}
        footer={
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5">
            {stage &&
              FAMILIES.map((f) => (
                <span key={f.id} className={`${LBL} text-[0.6rem]`}>
                  <span className="jx-num text-jx-accent">{f.short}</span> {f.label} <span className="jx-num">×{counts.get(f.id) ?? 0}</span> <span className="normal-case tracking-normal text-jx-dim/70">({f.license})</span>
                </span>
              ))}
            <span className="flex-1" />
            <span className={`pointer-events-auto font-mono text-jx-text/80 ${stage ? 'text-[0.62rem]' : 'text-[0.5rem]'}`}>
              Ikony GI: game-icons.net (CC BY 3.0)
            </span>
          </div>
        }
      />
    </div>
  )
}
