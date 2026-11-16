import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, type Transition } from 'motion/react'
import { IconAntenna, IconArrowsShuffle, IconAtom2, IconCompass, IconHeartbeat, IconShield, IconSortDescending, IconTarget, IconX } from '@tabler/icons-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { HudButton, SegBar, StatusDot } from '@/hud'
import { playBleep } from '@/lib/sound'
import { DemoBadge } from '../motion-kit/kit'

type Tone = 'ok' | 'warn' | 'danger'
interface Sys {
  id: string
  code: string
  name: string
  icon: ReactElement
  status: Tone
  load: number
  summary: string
  detail: string
  parts: { name: string; v: number }[]
}

/** Synthetic subsystem data (labelled DEMO in the UI). */
const SYSTEMS: Sys[] = [
  {
    id: 'reactor',
    code: 'SYS-01',
    name: 'Reaktor',
    icon: <IconAtom2 />,
    status: 'ok',
    load: 0.72,
    summary: 'Moc 3,1 GW · stabilny',
    detail: 'Rdzeń łukowy pracuje w zakresie nominalnym. Chłodzenie obiegu pierwotnego z zapasem 18%.',
    parts: [
      { name: 'Rdzeń', v: 0.72 },
      { name: 'Chłodzenie', v: 0.54 },
      { name: 'Osłona', v: 0.91 },
    ],
  },
  {
    id: 'armor',
    code: 'SYS-02',
    name: 'Pancerz',
    icon: <IconShield />,
    status: 'warn',
    load: 0.46,
    summary: 'Segment L-4 osłabiony',
    detail: 'Mikropęknięcia w segmencie lewego przedramienia. Zalecana rekalibracja pola przed kolejnym lotem.',
    parts: [
      { name: 'Tors', v: 0.94 },
      { name: 'Ramię L', v: 0.38 },
      { name: 'Hełm', v: 0.88 },
    ],
  },
  {
    id: 'nav',
    code: 'SYS-03',
    name: 'Nawigacja',
    icon: <IconCompass />,
    status: 'ok',
    load: 0.33,
    summary: 'Kurs 047° · 12 satelitów',
    detail: 'Fuzja danych inercyjnych i satelitarnych. Błąd pozycji poniżej 40 cm.',
    parts: [
      { name: 'IMU', v: 0.81 },
      { name: 'GNSS', v: 0.66 },
      { name: 'Mapa', v: 0.73 },
    ],
  },
  {
    id: 'comms',
    code: 'SYS-04',
    name: 'Łączność',
    icon: <IconAntenna />,
    status: 'ok',
    load: 0.58,
    summary: 'Łącze szyfrowane aktywne',
    detail: 'Kanał główny i zapasowy zsynchronizowane. Opóźnienie do bazy w normie.',
    parts: [
      { name: 'Nadajnik', v: 0.62 },
      { name: 'Szyfr', v: 0.97 },
      { name: 'Antena', v: 0.7 },
    ],
  },
  {
    id: 'weapons',
    code: 'SYS-05',
    name: 'Uzbrojenie',
    icon: <IconTarget />,
    status: 'danger',
    load: 0.88,
    summary: 'Repulsor P przegrzany',
    detail: 'Prawy repulsor przekroczył próg temperatury. Tryb ograniczonej mocy do czasu schłodzenia.',
    parts: [
      { name: 'Repulsor L', v: 0.64 },
      { name: 'Repulsor P', v: 0.97 },
      { name: 'Celownik', v: 0.52 },
    ],
  },
  {
    id: 'med',
    code: 'SYS-06',
    name: 'Medyczny',
    icon: <IconHeartbeat />,
    status: 'ok',
    load: 0.21,
    summary: 'Parametry pilota w normie',
    detail: 'Tętno, saturacja i temperatura w normie. Brak zaleceń.',
    parts: [
      { name: 'Tętno', v: 0.48 },
      { name: 'SpO₂', v: 0.98 },
      { name: 'Stres', v: 0.24 },
    ],
  },
]

const TONE_TEXT: Record<Tone, string> = { ok: 'text-jx-ok', warn: 'text-jx-warn', danger: 'text-jx-danger' }
const TONE_PL: Record<Tone, string> = { ok: 'Sprawny', warn: 'Uwaga', danger: 'Alarm' }
const RANK: Record<Tone, number> = { danger: 0, warn: 1, ok: 2 }

function shuffle<T>(a: T[]): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  // guarantee a visible change
  return b.every((x, i) => x === a[i]) ? [...b.slice(1), b[0]] : b
}

/** Ring gauge (SVG) for the panel face. */
function Gauge({ value, tone }: { value: number; tone: Tone }) {
  const r = 38
  const len = 2 * Math.PI * r
  const color = tone === 'ok' ? 'var(--jx-accent)' : tone === 'warn' ? 'var(--jx-warn)' : 'var(--jx-danger)'
  return (
    <svg viewBox="-50 -50 100 100" className="size-[clamp(4.5rem,8vw,7rem)] shrink-0 overflow-visible" aria-hidden="true">
      <circle r={r} fill="none" stroke="var(--jx-line)" strokeWidth={6} />
      <circle r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${len * value} ${len}`} transform="rotate(-90)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1={0} y1={-46} x2={0} y2={i % 6 ? -44 : -41} stroke="var(--jx-accent)" strokeOpacity={0.5} transform={`rotate(${i * 15})`} />
      ))}
      <text y={6} textAnchor="middle" className="jx-num" fontSize={18} fill="var(--jx-text)">
        {Math.round(value * 100)}
      </text>
      <text y={20} textAnchor="middle" className="jx-label" fontSize={7} fill="var(--jx-text-dim)">
        %
      </text>
    </svg>
  )
}

function PanelFace({ s, stage, expanded }: { s: Sys; stage: boolean; expanded?: boolean }) {
  const big = stage && expanded
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <motion.span layoutId={`icon-${s.id}`} className={`text-jx-accent shrink-0 [&>svg]:size-full ${big ? 'size-9' : stage ? 'size-6' : 'size-3'}`}>
          {s.icon}
        </motion.span>
        <motion.h3 layoutId={`title-${s.id}`} className={`m-0 jx-title truncate ${big ? 'text-3xl' : stage ? 'text-base' : 'text-[0.5rem]'}`}>
          {s.name}
        </motion.h3>
        <span className="flex-1" />
        {stage && <span className="jx-num text-[0.65rem] text-jx-dim tracking-widest">{s.code}</span>}
        <StatusDot tone={s.status} pulse={s.status !== 'ok'} />
      </div>
      {stage && (
        <motion.p layout="position" className={`m-0 font-ui ${big ? 'text-lg' : 'text-sm'} ${TONE_TEXT[s.status]}`}>
          {TONE_PL[s.status]} · <span className="text-jx-text/85">{s.summary}</span>
        </motion.p>
      )}
      {stage && !expanded && (
        <motion.div layout="position" className="flex-1 min-h-0 flex items-center gap-5 py-1">
          <Gauge value={s.load} tone={s.status} />
          <ul className="m-0 p-0 list-none flex-1 min-w-0 flex flex-col gap-2">
            {s.parts.map((p) => (
              <li key={p.name} className="flex items-center gap-2 min-w-0">
                <span className="jx-label w-20 truncate">{p.name}</span>
                <span className="flex-1 h-1 bg-jx-accent-dim/25 relative overflow-hidden">
                  <span className="absolute inset-y-0 left-0 bg-jx-accent/80" style={{ width: `${p.v * 100}%` }} />
                </span>
                <span className="jx-num text-[0.7rem] text-jx-text/80 w-9 text-right">{Math.round(p.v * 100)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
      <motion.div layout="position" className={`flex flex-col ${stage ? 'gap-1.5 mt-auto' : 'gap-0.5 mt-auto'}`}>
        <div className="flex items-center gap-2">
          {stage && <span className="jx-label w-20">Obciążenie</span>}
          <div className="flex-1">
            <SegBar value={s.load} segments={stage ? 20 : 10} tone={s.status === 'ok' ? 'accent' : s.status} />
          </div>
          <span className={`jx-num text-jx-text ${stage ? 'text-xs w-10 text-right' : 'text-[0.42rem]'}`}>{Math.round(s.load * 100)}%</span>
        </div>
      </motion.div>
    </>
  )
}

export default function LayoutPanels({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    auto: { value: true, label: 'auto-tasowanie' },
    every: { value: 3.2, min: 1, max: 10, step: 0.2, label: 'co ile (s)' },
    bounce: { value: 0.22, min: 0, max: 0.6, step: 0.01, label: 'sprężystość' },
    duration: { value: 0.6, min: 0.2, max: 1.6, step: 0.05, label: 'czas przejścia (s)' },
  })
  const [order, setOrder] = useState(() => SYSTEMS.map((s) => s.id))
  const [open, setOpen] = useState<string | null>(null)
  const byId = useMemo(() => new Map(SYSTEMS.map((s) => [s.id, s])), [])
  const transition: Transition = { type: 'spring', bounce: c.bounce, duration: c.duration }

  // auto choreography: shuffle; in the small card also open/close a panel to show the shared transition
  useEffect(() => {
    if (!c.auto || paused || reducedMotion || (open && stage)) return
    let n = 0
    const t = window.setInterval(() => {
      n++
      if (!stage && n % 3 === 0) {
        setOpen((o) => (o ? null : SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)].id))
        return
      }
      if (!stage) setOpen(null)
      setOrder((o) => shuffle(o))
    }, c.every * 1000)
    return () => window.clearInterval(t)
  }, [c.auto, c.every, paused, reducedMotion, open, stage])

  useEffect(() => {
    if (!open || !stage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        playBleep('close')
        setOpen(null)
      }
    }
    // capture phase so the gallery stage does not also close
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, stage])

  const sel = open ? byId.get(open) : undefined
  const sortBy = (k: 'status' | 'load') => setOrder((o) => [...o].sort((a, b) => (k === 'status' ? RANK[byId.get(a)!.status] - RANK[byId.get(b)!.status] : byId.get(b)!.load - byId.get(a)!.load)))

  return (
    <MotionConfig transition={transition} reducedMotion={reducedMotion ? 'always' : 'never'}>
      <div className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg flex flex-col">
        <div className="absolute inset-0 jx-grid-bg opacity-35 pointer-events-none" aria-hidden="true" />
        {stage && (
          <header className="relative flex flex-wrap items-center gap-2 px-8 pt-6">
            <h2 className="m-0 jx-display text-jx-accent jx-glow-text text-lg mr-3">Moduły pokładowe</h2>
            <HudButton size="sm" icon={<IconArrowsShuffle />} onClick={() => setOrder((o) => shuffle(o))}>
              Przetasuj
            </HudButton>
            <HudButton size="sm" icon={<IconSortDescending />} onClick={() => sortBy('status')}>
              Wg statusu
            </HudButton>
            <HudButton size="sm" icon={<IconSortDescending />} onClick={() => sortBy('load')}>
              Wg obciążenia
            </HudButton>
            <span className="flex-1" />
            <DemoBadge title="Stany modułów są syntetyczne – pokaz animacji układu" />
          </header>
        )}

        <LayoutGroup>
          <div className={`relative flex-1 min-h-0 grid grid-cols-3 auto-rows-fr ${stage ? 'gap-4 p-8 pt-5' : 'gap-1 p-1.5'}`}>
            {order.map((id) => {
              const s = byId.get(id)!
              const shell = `jx-aug h-full flex flex-col text-left ${stage ? 'p-4 gap-2' : 'p-1 gap-0.5'}`
              const augStyle = { ['--aug-border-bg' as string]: s.status === 'ok' ? undefined : s.status === 'warn' ? 'var(--jx-warn)' : 'var(--jx-danger)' }
              return (
                <motion.div key={id} layout className="relative min-h-0 min-w-0">
                  {open === id ? (
                    <div className="h-full border border-dashed border-jx-line/50" aria-hidden="true" />
                  ) : (
                    <motion.div layoutId={`panel-${id}`} className="h-full" style={{ borderRadius: 0 }}>
                      {stage ? (
                        <button
                          type="button"
                          data-augmented-ui="tl-clip br-clip border"
                          className={`${shell} w-full cursor-pointer hover:[--aug-border-bg:var(--jx-accent)] focus-visible:[--aug-border-bg:var(--jx-accent)]`}
                          style={augStyle}
                          aria-label={`${s.name}: ${TONE_PL[s.status]}. Rozwiń szczegóły`}
                          onClick={() => {
                            playBleep('open')
                            setOpen(id)
                          }}
                        >
                          <PanelFace s={s} stage />
                        </button>
                      ) : (
                        <div data-augmented-ui="tl-clip br-clip border" className={shell} style={augStyle}>
                          <PanelFace s={s} stage={false} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <AnimatePresence>
            {sel && (
              <motion.div
                key="backdrop"
                className="absolute inset-0 z-10 bg-black/65"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!stage) return
                  playBleep('close')
                  setOpen(null)
                }}
                aria-hidden="true"
              />
            )}
            {sel && (
              <div key="detail" className={`absolute inset-0 z-20 grid place-items-center pointer-events-none ${stage ? 'p-16' : 'p-3'}`}>
                <motion.div layoutId={`panel-${sel.id}`} className={`pointer-events-auto w-full ${stage ? 'max-w-3xl' : 'h-full'}`} style={{ borderRadius: 0 }}>
                  <div
                    data-augmented-ui="tl-clip br-clip tr-clip-x border"
                    className={`jx-aug flex flex-col ${stage ? 'p-8 gap-4' : 'p-2 gap-1 h-full'}`}
                    role={stage ? 'dialog' : undefined}
                    aria-modal={stage ? true : undefined}
                    aria-label={stage ? `${sel.name} – szczegóły` : undefined}
                  >
                    <PanelFace s={sel} stage={stage} expanded />
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-3">
                      {stage && <p className="m-0 text-jx-text/85 leading-relaxed">{sel.detail}</p>}
                      <div className={`grid grid-cols-3 ${stage ? 'gap-4' : 'gap-1'}`}>
                        {sel.parts.map((p) => (
                          <div key={p.name} className={`border border-jx-line/60 ${stage ? 'p-3' : 'p-0.5'} flex flex-col gap-1`}>
                            <span className={`jx-label ${stage ? '' : 'text-[0.38rem]! tracking-[0.06em]!'}`}>{p.name}</span>
                            <span className={`jx-num text-jx-accent jx-glow-text ${stage ? 'text-2xl' : 'text-[0.55rem]'}`}>{Math.round(p.v * 100)}%</span>
                            {stage && <SegBar value={p.v} segments={14} tone={p.v > 0.9 && sel.status === 'danger' ? 'danger' : 'accent'} />}
                          </div>
                        ))}
                      </div>
                      {stage && (
                        <div className="flex items-center gap-2">
                          <DemoBadge />
                          <span className="flex-1" />
                          <HudButton
                            size="sm"
                            icon={<IconX />}
                            onClick={() => {
                              playBleep('close')
                              setOpen(null)
                            }}
                            autoFocus
                          >
                            Zamknij (Esc)
                          </HudButton>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </MotionConfig>
  )
}
