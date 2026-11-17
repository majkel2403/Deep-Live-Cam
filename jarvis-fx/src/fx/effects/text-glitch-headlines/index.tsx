import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { useGlitch } from 'react-powerglitch'
import type { PowerGlitchOptions, RecursivePartial } from 'powerglitch'
import IconAlertTriangle from '@tabler/icons-react/icons/IconAlertTriangle'
import IconAntennaBars5 from '@tabler/icons-react/icons/IconAntennaBars5'
import IconBolt from '@tabler/icons-react/icons/IconBolt'
import IconPointer from '@tabler/icons-react/icons/IconPointer'
import IconRefresh from '@tabler/icons-react/icons/IconRefresh'
import IconWaveSine from '@tabler/icons-react/icons/IconWaveSine'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import '../motion-kit/kit.css'
import { playBleep } from '@/lib/sound'

type Opts = RecursivePartial<PowerGlitchOptions>
type Mode = 'always' | 'hover' | 'click'
type Tone = 'accent' | 'danger' | 'warn'

interface Variant {
  id: string
  kicker: string
  text: string
  mode: Mode
  tone: Tone
  icon: ReactNode
  font: string
  caption: string
  /** builds PowerGlitch options from the global controls */
  build: (k: { intensity: number; hue: boolean; period: number; slices: number }) => Opts
  code: (k: { intensity: number; period: number; slices: number }) => string
}

const r2 = (n: number) => Math.round(n * 100) / 100

const VARIANTS: Variant[] = [
  {
    id: 'breach',
    kicker: 'Alarm · sektor 7',
    text: 'Naruszenie perymetru',
    mode: 'always',
    tone: 'danger',
    icon: <IconAlertTriangle />,
    font: 'var(--jx-font-cmd)',
    caption: 'Ciągłe cięcia poziome z wstrząsem – czytelne, ale niepokojące.',
    build: ({ intensity, hue, period, slices }) => ({
      timing: { duration: period, iterations: Infinity },
      glitchTimeSpan: { start: 0.45, end: 0.85 },
      shake: { velocity: 15, amplitudeX: 0.05 * intensity, amplitudeY: 0.08 * intensity },
      slice: { count: slices + 2, velocity: 18, minHeight: 0.02, maxHeight: 0.16, hueRotate: hue },
    }),
    code: ({ period, slices }) => `always · ${period} ms · slice ×${slices + 2}`,
  },
  {
    id: 'signal',
    kicker: 'Łącze · kanał 3',
    text: 'Sygnał zakłócony',
    mode: 'always',
    tone: 'accent',
    icon: <IconAntennaBars5 />,
    font: 'var(--jx-font-head)',
    caption: 'Tylko wstrząs, bez cięć – drgający odbiornik.',
    build: ({ intensity, period }) => ({
      timing: { duration: period * 0.7, iterations: Infinity },
      glitchTimeSpan: { start: 0.2, end: 0.95 },
      shake: { velocity: 22, amplitudeX: 0.12 * intensity, amplitudeY: 0.04 * intensity },
      slice: { count: 1, velocity: 8, minHeight: 0.01, maxHeight: 0.04, hueRotate: false },
    }),
    code: ({ intensity, period }) => `always · ${Math.round(period * 0.7)} ms · shake.x ${r2(0.12 * intensity)}`,
  },
  {
    id: 'intercept',
    kicker: 'Wywiad · priorytet',
    text: 'Transmisja przechwycona',
    mode: 'always',
    tone: 'accent',
    icon: <IconWaveSine />,
    font: 'var(--jx-font-audiowide)',
    caption: 'Puls skali z przesunięciem barwy – echo przechwyconego pakietu.',
    build: ({ intensity, hue, period, slices }) => ({
      timing: { duration: period * 1.1, iterations: Infinity },
      glitchTimeSpan: { start: 0.6, end: 0.9 },
      pulse: { scale: 1 + 0.5 * intensity },
      shake: { velocity: 10, amplitudeX: 0.03 * intensity, amplitudeY: 0.03 * intensity },
      slice: { count: Math.max(2, slices - 1), velocity: 12, minHeight: 0.03, maxHeight: 0.2, hueRotate: hue },
    }),
    code: ({ intensity }) => `always · pulse.scale ${r2(1 + 0.5 * intensity)}`,
  },
  {
    id: 'core',
    kicker: 'Reaktor · odczyt',
    text: 'Rdzeń niestabilny',
    mode: 'always',
    tone: 'warn',
    icon: <IconBolt />,
    font: 'var(--jx-font-cmd)',
    caption: 'Rzadki, gwałtowny „atak” – długa cisza, krótka eksplozja grubych cięć.',
    build: ({ intensity, hue, period, slices }) => ({
      timing: { duration: period * 1.8, iterations: Infinity },
      glitchTimeSpan: { start: 0.86, end: 0.98 },
      shake: { velocity: 30, amplitudeX: 0.1 * intensity, amplitudeY: 0.18 * intensity },
      slice: { count: slices + 4, velocity: 30, minHeight: 0.05, maxHeight: 0.36, hueRotate: hue },
    }),
    code: ({ period, slices }) => `always · ${Math.round(period * 1.8)} ms · okno 86–98%, slice ×${slices + 4}`,
  },
  {
    id: 'scan',
    kicker: 'Interakcja · najechanie',
    text: 'Najedź, aby skanować',
    mode: 'hover',
    tone: 'accent',
    icon: <IconPointer />,
    font: 'var(--jx-font-head)',
    caption: 'Zakłócenie trwa, dopóki kursor (lub fokus klawiatury) jest nad nagłówkiem.',
    build: ({ intensity, hue, slices }) => ({
      timing: { duration: 650, iterations: Infinity },
      glitchTimeSpan: false,
      shake: { velocity: 18, amplitudeX: 0.04 * intensity, amplitudeY: 0.05 * intensity },
      slice: { count: slices, velocity: 16, minHeight: 0.02, maxHeight: 0.14, hueRotate: hue },
    }),
    code: ({ slices }) => `hover · 650 ms · slice ×${slices}`,
  },
  {
    id: 'reboot',
    kicker: 'Interakcja · kliknięcie',
    text: 'Restart systemu',
    mode: 'click',
    tone: 'danger',
    icon: <IconRefresh />,
    font: 'var(--jx-font-cmd)',
    caption: 'Jednorazowy impuls po kliknięciu lub Enter / Spacji.',
    build: ({ intensity, hue, slices }) => ({
      timing: { duration: 520, iterations: 1 },
      glitchTimeSpan: { start: 0, end: 1 },
      shake: { velocity: 24, amplitudeX: 0.08 * intensity, amplitudeY: 0.12 * intensity },
      slice: { count: slices + 3, velocity: 24, minHeight: 0.03, maxHeight: 0.24, hueRotate: hue },
    }),
    code: ({ slices }) => `click · 520 ms ×1 · slice ×${slices + 3}`,
  },
]

const TONE = {
  accent: { text: 'text-jx-accent', border: 'var(--jx-line-strong)', glow: 'hsl(var(--jx-hue) 100% 55% / 0.7)' },
  danger: { text: 'text-jx-danger', border: 'color-mix(in srgb, var(--jx-danger) 75%, transparent)', glow: 'rgb(255 59 92 / 0.7)' },
  warn: { text: 'text-jx-warn', border: 'color-mix(in srgb, var(--jx-warn) 75%, transparent)', glow: 'rgb(255 176 0 / 0.65)' },
} as const

/**
 * One glitched headline. PowerGlitch re-parents the glitched node into its own containers, so the node is
 * always the only child of a React-owned wrapper (React never has to remove it directly), and the whole
 * wrapper is re-keyed when options change.
 */
function GlitchLine({ options, mode, paused, reduced, children, className, style, handle }: { options: Opts; mode: Mode; paused: boolean; reduced: boolean; children: ReactNode; className?: string; style?: CSSProperties; handle?: (h: { start: () => void; stop: () => void }) => void }) {
  const g = useGlitch({ ...options, playMode: mode === 'always' ? 'always' : 'manual', hideOverflow: false, optimizeSeo: false })
  const wasPaused = useRef(false)
  useEffect(() => {
    handle?.({ start: g.startGlitch, stop: g.stopGlitch })
  }, [g.startGlitch, g.stopGlitch, handle])
  useEffect(() => {
    if (mode !== 'always') return
    if (paused) g.stopGlitch()
    else if (wasPaused.current) g.startGlitch()
    wasPaused.current = paused
  }, [paused, mode, g])
  return (
    <span className="block">
      <span ref={reduced ? undefined : g.ref} className={className} style={{ display: 'inline-block', ...style }}>
        {children}
      </span>
    </span>
  )
}

function Headline({ v, k, stage, paused, reduced, hue }: { v: Variant; k: { intensity: number; hue: boolean; period: number; slices: number }; stage: boolean; paused: boolean; reduced: boolean; hue: number }) {
  const opts = useMemo(() => v.build(k), [v, k])
  const key = useMemo(() => JSON.stringify(opts), [opts])
  const ctl = useRef<{ start: () => void; stop: () => void } | null>(null)
  const tone = TONE[v.tone]
  const interactive = stage && v.mode !== 'always'
  const setHandle = useMemo(() => (h: { start: () => void; stop: () => void }) => (ctl.current = h), [])

  const headline = (
    <GlitchLine
      key={key}
      options={opts}
      mode={stage ? v.mode : 'always'}
      paused={paused}
      reduced={reduced}
      handle={setHandle}
      className={`${tone.text} uppercase leading-tight`}
      style={{ fontFamily: v.font, letterSpacing: '0.12em', textShadow: `0 0 14px ${tone.glow}`, fontSize: stage ? 'clamp(1.15rem, 1.9vw, 2rem)' : '0.72rem', fontWeight: 700 }}
    >
      {v.text}
    </GlitchLine>
  )

  const shell = `relative flex flex-col ${stage ? 'gap-3 p-5' : 'gap-1 p-2'} min-w-0 min-h-0 text-left`
  const augStyle = { ['--aug-border-bg' as string]: tone.border, ['--aug-tl' as string]: stage ? '14px' : '7px', ['--aug-br' as string]: stage ? '14px' : '7px' }
  const inner = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`${tone.text} [&>svg]:size-full shrink-0 ${stage ? 'size-5' : 'size-2.5'}`} aria-hidden="true">
          {v.icon}
        </span>
        <span className={`jx-label truncate ${stage ? '' : 'text-[0.625rem]! tracking-[0.08em]!'}`}>{v.kicker}</span>
        <span className="flex-1" />
        {stage && (
          <span className={`jx-num text-[0.625rem] px-1.5 py-px border ${v.mode === 'always' ? 'border-jx-line text-jx-dim' : 'border-jx-accent text-jx-accent'}`}>
            {v.mode === 'always' ? 'ZAWSZE' : v.mode === 'hover' ? 'NAJECHANIE' : 'KLIKNIĘCIE'}
          </span>
        )}
      </div>
      <div className={`flex-1 grid place-items-center text-center ${stage ? 'min-h-24' : ''}`}>{headline}</div>
      {stage && (
        <>
          <p className="m-0 text-[0.8rem] text-jx-text/75 leading-snug">{v.caption}</p>
          <code className="jx-num text-[0.66rem] text-jx-dim border-t border-jx-line/50 pt-2 truncate">{v.code(k)}</code>
        </>
      )}
      <span className="absolute inset-x-4 top-1/2 h-px pointer-events-none opacity-30" style={{ background: `linear-gradient(90deg, transparent, hsl(${v.tone === 'accent' ? hue : v.tone === 'danger' ? 350 : 41} 100% 60%), transparent)` }} aria-hidden="true" />
    </>
  )

  if (!interactive)
    return (
      <div data-augmented-ui="tl-clip br-clip border" className={`jx-aug ${shell}`} style={augStyle}>
        {inner}
      </div>
    )

  if (v.mode === 'hover')
    return (
      <div
        data-augmented-ui="tl-clip br-clip border"
        className={`jx-aug ${shell} cursor-crosshair focus-visible:[--aug-border-bg:var(--jx-accent)]`}
        style={augStyle}
        tabIndex={0}
        role="group"
        aria-label={`${v.text} – zakłócenie po najechaniu`}
        onMouseEnter={() => {
          playBleep('scan')
          ctl.current?.start()
        }}
        onMouseLeave={() => ctl.current?.stop()}
        onFocus={() => ctl.current?.start()}
        onBlur={() => ctl.current?.stop()}
      >
        {inner}
      </div>
    )

  return (
    <button
      type="button"
      data-augmented-ui="tl-clip br-clip border"
      className={`jx-aug ${shell} cursor-pointer hover:[--aug-border-bg:var(--jx-danger)]`}
      style={augStyle}
      aria-label={`${v.text} – kliknij, aby wywołać zakłócenie`}
      onClick={() => {
        playBleep('alert')
        ctl.current?.stop()
        ctl.current?.start()
      }}
    >
      {inner}
    </button>
  )
}

export default function GlitchHeadlines({ stage, reducedMotion, paused, hue }: FxProps) {
  const c = useFxControls({
    intensity: { value: 1, min: 0.2, max: 2.5, step: 0.05, label: 'intensywność' },
    period: { value: 2400, min: 800, max: 6000, step: 100, label: 'okres pętli (ms)' },
    slices: { value: 5, min: 1, max: 12, step: 1, label: 'liczba cięć' },
    hue: { value: true, label: 'obrót barwy' },
  })
  const k = useMemo(() => ({ intensity: c.intensity, hue: c.hue, period: c.period, slices: c.slices }), [c.intensity, c.hue, c.period, c.slices])
  const list = stage ? VARIANTS : [VARIANTS[0], VARIANTS[3]]

  return (
    <div className="fxk-noblur absolute inset-0 overflow-hidden bg-jx-bg">
      <div className="absolute inset-0 jx-grid-bg opacity-40" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_59_92/0.10),transparent_55%)]" aria-hidden="true" />
      <div className={`relative h-full grid ${stage ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr gap-5 p-8 max-w-[90rem] mx-auto content-center' : 'grid-rows-2 gap-1.5 p-2'}`}>
        {list.map((v) => (
          <Headline key={v.id} v={v} k={k} stage={stage} paused={paused} reduced={reducedMotion} hue={hue} />
        ))}
      </div>
      {reducedMotion && stage && <p className="absolute bottom-3 inset-x-0 text-center jx-label text-[0.625rem]!">Ograniczony ruch: zakłócenia wyłączone</p>}
    </div>
  )
}
