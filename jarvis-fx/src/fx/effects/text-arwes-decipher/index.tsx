import { useCallback, useEffect, useRef, useState } from 'react'
import { animateTextDecipher, animateTextSequence, getAnimationTextDuration } from '@arwes/text'
import { IconBroadcast, IconLock, IconShieldHalfFilled } from '@tabler/icons-react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { Decipher, Frame, StatusDot } from '@/hud'
import { playBleep } from '@/lib/sound'
import { DemoBadge } from '../motion-kit/kit'

type Mode = 'decipher' | 'sequence'
interface Line {
  key: string
  value: string
  tone?: 'warn' | 'ok'
}

/** Fictional mission briefing (scripted copy for the effect, labelled as a scenario). */
const BRIEF: Line[] = [
  { key: 'Kryptonim', value: 'ŻURAW-7' },
  { key: 'Klasyfikacja', value: 'Poufne · poziom dostępu 4' },
  { key: 'Cel', value: 'Zabezpieczyć przekaźnik łączności w sektorze Ł-7' },
  { key: 'Zagrożenie', value: 'Niezidentyfikowane drony zwiadowcze, trajektorie nieregularne' },
  { key: 'Zasoby', value: 'Zespół Mark VII, wsparcie orbitalne w gotowości' },
  { key: 'Okno czasowe', value: '04:12 – 04:57 czasu pokładowego' },
]
const NOTE =
  'Utrzymać ciszę radiową do potwierdzenia celu. Po zabezpieczeniu przekaźnika przesłać pakiet telemetrii i wycofać się korytarzem północnym. Kontakt awaryjny wyłącznie kanałem szyfrowanym.'
const STATUS = 'Oczekiwanie na autoryzację dowódcy'

const PHASES = [
  { name: 'Infiltracja', t: 'T+00:00' },
  { name: 'Zabezpieczenie', t: 'T+00:14' },
  { name: 'Transmisja', t: 'T+00:31' },
  { name: 'Odwrót', t: 'T+00:45' },
]

const CHANNELS = ['Orbita niska', 'Przekaźnik Ł-7', 'Zespół Mark VII', 'Dowództwo', 'Satelita meteo', 'Kanał awaryjny']

const CHARSETS = {
  ARWES: '    ----____abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  polskie: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
  bloki: '█▓▒░▚▞',
  cyfry: '0123456789',
} as const

const MODES = { mieszany: 'mixed', 'tylko sekwencja': 'sequence', 'tylko deszyfracja': 'decipher' } as const

interface Slot {
  root: HTMLElement | null
  content: HTMLElement | null
}

/** Decorative sector map for the scenario: hex grid, target sector Ł-7 and a route drawn with progress. */
function SectorMap({ progress, cycle }: { progress: number; cycle: number }) {
  const hexes: { x: number; y: number; id: string }[] = []
  const cols = 7
  const rowsN = 4
  const r = 16
  for (let row = 0; row < rowsN; row++)
    for (let col = 0; col < cols; col++) {
      const x = 24 + col * r * 1.75 + (row % 2) * r * 0.875
      const y = 22 + row * r * 1.52
      hexes.push({ x, y, id: `${['J', 'K', 'L', 'Ł'][row]}-${col + 1}` })
    }
  const target = hexes.find((h) => h.id === 'Ł-7') ?? hexes[hexes.length - 1]
  const hexPath = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6
      return `${(cx + Math.cos(a) * (r - 1.5)).toFixed(1)},${(cy + Math.sin(a) * (r - 1.5)).toFixed(1)}`
    }).join(' ')
  const route = `M${hexes[0].x},${hexes[0].y} L${hexes[9].x},${hexes[9].y} L${hexes[17].x},${hexes[17].y} L${target.x},${target.y}`
  return (
    <figure className="m-0 flex flex-col gap-1" aria-label="Mapa sektora (ilustracja scenariusza)">
      <figcaption className="jx-label flex items-center gap-2">
        Mapa sektora <span className="flex-1" />
        <span className="jx-num text-[0.65rem] text-jx-dim normal-case">siatka 7×4</span>
      </figcaption>
      <svg viewBox="0 0 250 132" className="w-full h-auto" aria-hidden="true">
        {hexes.map((h) => (
          <polygon key={h.id} points={hexPath(h.x, h.y)} fill={h === target ? 'hsl(var(--jx-hue) 100% 50% / 0.18)' : 'none'} stroke={h === target ? 'var(--jx-warn)' : 'var(--jx-line)'} strokeWidth={h === target ? 1.5 : 0.8} />
        ))}
        <path key={cycle} d={route} fill="none" stroke="var(--jx-accent)" strokeWidth={1.5} pathLength={1} style={{ strokeDasharray: `${progress} 1`, transition: 'stroke-dasharray .4s' }} />
        <circle cx={target.x} cy={target.y} r={4} fill="var(--jx-warn)" className="ad-ping" />
        <text x={target.x} y={target.y - 20} textAnchor="middle" className="jx-num" fontSize={8} fill="var(--jx-warn)">
          Ł-7
        </text>
        <circle cx={hexes[0].x} cy={hexes[0].y} r={3} fill="var(--jx-accent)" />
      </svg>
      <style>{`.ad-ping{transform-box:fill-box;transform-origin:center;animation:jx-pulse 1.4s ease-in-out infinite}`}</style>
    </figure>
  )
}

export default function ArwesDecipher({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    cps: { value: 70, min: 15, max: 220, step: 5, label: 'znaki / s' },
    mode: { value: MODES.mieszany as string, options: MODES, label: 'tryb' },
    charset: { value: CHARSETS.ARWES as string, options: CHARSETS, label: 'alfabet szyfru' },
    replay: { value: 4, min: 1, max: 15, step: 0.5, label: 'powtórka (s)' },
    sound: { value: false, label: 'dźwięk pisania' },
  })

  // ordered animation slots: [key0, value0, key1, value1, …, note, status]
  const slots = useRef<Slot[]>([])
  const setSlot = useCallback(
    (i: number, part: keyof Slot) => (el: HTMLElement | null) => {
      slots.current[i] = { ...(slots.current[i] ?? { root: null, content: null }), [part]: el }
    },
    [],
  )
  const [cycle, setCycle] = useState(0)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [chPulse, setChPulse] = useState<number[]>(() => CHANNELS.map(() => 0))

  const rows = stage ? BRIEF : BRIEF.slice(0, 4)
  const total = rows.length * 2 + (stage ? 2 : 1)

  useEffect(() => {
    const items = slots.current.slice(0, total)
    const contents = items.map((s) => s?.content).filter(Boolean) as HTMLElement[]
    if (reducedMotion || paused) {
      contents.forEach((el) => (el.style.visibility = ''))
      return
    }
    const anims: { cancel: () => void }[] = []
    const timers: number[] = []
    let tick: number | undefined
    contents.forEach((el) => (el.style.visibility = 'hidden'))
    timers.push(window.setTimeout(() => setProgress({ done: 0, total }), 0))

    let at = 0.25
    items.forEach((s, i) => {
      if (!s?.root || !s.content) return
      const len = s.content.textContent?.length ?? 0
      const isKey = i < rows.length * 2 && i % 2 === 0
      const mode: Mode = c.mode === 'mixed' ? (isKey ? 'decipher' : 'sequence') : (c.mode as Mode)
      const dur = mode === 'decipher' ? Math.max(0.35, getAnimationTextDuration({ length: len, charactersPerSecond: c.cps * 0.6, maxDuration: 1.2 })) : getAnimationTextDuration({ length: len, charactersPerSecond: c.cps, maxDuration: 4 })
      const start = at
      timers.push(
        window.setTimeout(() => {
          const root = s.root!
          const content = s.content!
          const a =
            mode === 'decipher'
              ? animateTextDecipher({ rootElement: root, contentElement: content, duration: dur, characters: c.charset, hideOnExited: false })
              : animateTextSequence({ rootElement: root, contentElement: content, duration: dur, blink: true, blinkDuration: 0.12, hideOnExited: false })
          anims.push(a)
          timers.push(window.setTimeout(() => setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) })), dur * 1000))
        }, start * 1000),
      )
      // keys overlap a bit with their value, values run sequentially
      at += isKey ? dur * 0.55 : dur + 0.12
    })
    if (c.sound) {
      const end = performance.now() + at * 1000
      tick = window.setInterval(() => {
        if (performance.now() > end) window.clearInterval(tick)
        else playBleep('type')
      }, 55)
    }
    // loop: hold, then restart the whole briefing
    timers.push(window.setTimeout(() => setCycle((n) => n + 1), (at + c.replay) * 1000))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      window.clearInterval(tick)
      anims.forEach((a) => a.cancel())
      contents.forEach((el) => (el.style.visibility = ''))
    }
  }, [cycle, c.cps, c.mode, c.charset, c.replay, c.sound, reducedMotion, paused, rows.length, total])

  // ambient: a random channel label re-deciphers every ~1.4 s
  useEffect(() => {
    if (!stage || reducedMotion || paused) return
    const t = window.setInterval(() => {
      const i = Math.floor(Math.random() * CHANNELS.length)
      setChPulse((p) => p.map((v, k) => (k === i ? v + 1 : v)))
    }, 1400)
    return () => window.clearInterval(t)
  }, [stage, reducedMotion, paused])

  const txt = stage ? 'text-[1.05rem]' : 'text-[0.52rem]'
  // static (reduced motion / paused) → everything is shown, so the briefing counts as fully deciphered
  const shown = reducedMotion || paused ? { done: total, total } : progress
  const pct = shown.total ? shown.done / shown.total : 0
  const phaseIdx = Math.min(PHASES.length - 1, Math.floor(pct * PHASES.length))

  const body = (
    <section className={`jx-frame-host flex flex-col min-h-0 ${stage ? 'p-6 gap-4' : 'p-2 gap-1'} h-full`} aria-label="Briefing operacyjny (scenariusz demonstracyjny)">
      <Frame kind="nefrex" size={stage ? 18 : 10} key={`f-${cycle}`} />
      <header className="flex items-center gap-2">
        <IconLock className="text-jx-accent shrink-0" size={stage ? 20 : 10} />
        <h2 className={`m-0 jx-title ${stage ? 'text-xl' : 'text-[0.6rem]'}`}>
          <Decipher text="Briefing operacyjny" replayKey={cycle} duration={0.9} />
        </h2>
        <span className="flex-1" />
        <DemoBadge label="SCENARIUSZ" title="Fikcyjny briefing – tekst pokazowy efektu, nie prawdziwa operacja" className={stage ? '' : 'scale-75 origin-right'} />
        {stage && <span className="jx-num text-xs text-jx-dim tracking-widest">OPS-417</span>}
      </header>

      <dl className={`grid grid-cols-[auto_1fr] ${stage ? 'gap-x-6 gap-y-2.5' : 'gap-x-2 gap-y-0.5'} m-0`}>
        {rows.map((r, i) => (
          <div key={r.key} className="contents">
            <dt className={`jx-label text-jx-accent/90! ${stage ? 'text-[0.8rem]!' : 'text-[0.45rem]! tracking-[0.06em]!'} self-start pt-[0.1em]`}>
              <span ref={setSlot(i * 2, 'root')} className="relative block">
                <span ref={setSlot(i * 2, 'content')}>{r.key}</span>
              </span>
            </dt>
            <dd className={`m-0 font-ui ${txt} text-jx-text leading-snug`}>
              <span ref={setSlot(i * 2 + 1, 'root')} className="relative block">
                <span ref={setSlot(i * 2 + 1, 'content')}>{r.value}</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {stage && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] gap-6 items-start">
          <div className="border-l-2 border-jx-accent/50 pl-4 py-1">
            <div className="jx-label mb-1">Uwagi dowódcy</div>
            <p className={`m-0 font-term ${txt} text-jx-text/85 leading-relaxed`}>
              <span ref={setSlot(rows.length * 2, 'root')} className="relative block">
                <span ref={setSlot(rows.length * 2, 'content')}>{NOTE}</span>
              </span>
            </p>
          </div>
          <SectorMap progress={pct} cycle={cycle} />
        </div>
      )}

      {stage && (
        <ol className="m-0 p-0 list-none grid grid-cols-4 gap-3 mt-auto" aria-label="Fazy operacji">
          {PHASES.map((ph, i) => {
            const state = i < phaseIdx ? 'done' : i === phaseIdx ? 'active' : 'todo'
            return (
              <li key={ph.name} className={`relative flex flex-col gap-1 border-t-2 pt-2 ${state === 'todo' ? 'border-jx-line/50' : 'border-jx-accent'}`}>
                <span className={`jx-num text-[0.7rem] ${state === 'todo' ? 'text-jx-dim' : 'text-jx-accent'}`}>
                  {String(i + 1).padStart(2, '0')} · {ph.t}
                </span>
                <Decipher text={ph.name} replayKey={`${cycle}-${state}`} className={`font-head uppercase tracking-wider text-sm ${state === 'active' ? 'text-white jx-glow-text' : state === 'done' ? 'text-jx-text/80' : 'text-jx-dim'}`} duration={0.5} />
                {state === 'active' && <span className="absolute -top-[5px] left-0 size-2 bg-jx-accent shadow-[0_0_8px_var(--jx-accent)]" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      )}

      <div className={`${stage ? '' : 'mt-auto'} flex items-center ${stage ? 'gap-3' : 'gap-1.5'}`}>
        <StatusDot tone="warn" pulse />
        <span className={`font-head uppercase tracking-wider text-jx-warn ${stage ? 'text-sm' : 'text-[0.48rem]'} flex-1 min-w-0`}>
          <span ref={setSlot(rows.length * 2 + (stage ? 1 : 0), 'root')} className="relative block truncate">
            <span ref={setSlot(rows.length * 2 + (stage ? 1 : 0), 'content')}>{STATUS}</span>
          </span>
        </span>
        <span className={`jx-num text-jx-dim ${stage ? 'text-xs' : 'text-[0.45rem]'}`}>
          {shown.done}/{shown.total}
        </span>
      </div>
      <div className="h-[3px] bg-jx-accent-dim/25 relative overflow-hidden" role="progressbar" aria-label="Postęp odszyfrowania" aria-valuemin={0} aria-valuemax={shown.total} aria-valuenow={shown.done}>
        <div className="absolute inset-y-0 left-0 bg-jx-accent shadow-[0_0_6px_var(--jx-accent)] transition-[width] duration-300" style={{ width: `${pct * 100}%` }} />
      </div>
    </section>
  )

  if (!stage) return <div className="absolute inset-0 bg-jx-bg jx-grid-bg p-1.5">{body}</div>

  return (
    <div className="absolute inset-0 bg-jx-bg overflow-hidden">
      <div className="absolute inset-0 jx-grid-bg opacity-50" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,hsl(var(--jx-hue)_90%_28%/0.25),transparent_60%)]" aria-hidden="true" />
      <div className="relative h-full grid grid-cols-[minmax(0,1fr)_17rem] gap-6 p-8 max-w-[78rem] mx-auto">
        {body}
        <aside className="jx-frame-host flex flex-col gap-3 p-5 min-h-0" aria-label="Kanały łączności (scenariusz)">
          <Frame kind="octagon" size={12} />
          <div className="flex items-center gap-2">
            <IconBroadcast size={18} className="text-jx-accent" />
            <h3 className="m-0 jx-title text-sm">
              <Decipher text="Kanały" replayKey={cycle} />
            </h3>
          </div>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {CHANNELS.map((ch, i) => (
              <li key={ch} className="flex items-center gap-2 border-b border-jx-line/40 pb-1.5">
                <span className="jx-num text-[0.7rem] text-jx-dim w-7">{String(i + 1).padStart(2, '0')}</span>
                <Decipher text={ch} replayKey={`${cycle}-${chPulse[i]}`} className="font-head text-sm uppercase tracking-wider text-jx-text flex-1" duration={0.6} />
                <StatusDot tone={i === 5 ? 'warn' : 'ok'} pulse={i === 5} />
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <IconShieldHalfFilled size={16} className="text-jx-accent" />
              <span className="jx-label">Tempo animacji</span>
              <span className="flex-1" />
              <span className="jx-num text-xs text-jx-accent">{c.cps} zn/s</span>
            </div>
            <p className="m-0 text-[0.7rem] text-jx-dim leading-snug">
              Klucze: <code className="text-jx-text/80">animateTextDecipher()</code>, wartości: <code className="text-jx-text/80">animateTextSequence()</code>, czas: <code className="text-jx-text/80">getAnimationTextDuration()</code>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
