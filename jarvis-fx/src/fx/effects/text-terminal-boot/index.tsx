import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import IconTerminal2 from '@tabler/icons-react/icons/IconTerminal2'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { DemoBadge } from '../motion-kit/kit'
import './terminal.css'

type Status = 'ok' | 'warn' | 'fail' | 'info'

interface Step {
  text: string
  status: Status
  /** animated ASCII progress bar before the status */
  progress?: boolean
  /** true = value read from the real browser */
  real?: boolean
  note?: string
}

interface Row {
  text: string
  status?: Status
  pct?: number
  spin?: number
  ts: number
  real?: boolean
  note?: string
  final?: boolean
}

/** Real browser facts (honest: these are actual readings, marked with ◆). */
function browserSteps(): Step[] {
  if (typeof navigator === 'undefined') return []
  const out: Step[] = []
  out.push({ text: `Wątki procesora: ${navigator.hardwareConcurrency || '?'}`, status: 'ok', real: true })
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem) out.push({ text: `Pamięć urządzenia (przybliżona): ${mem} GB`, status: 'ok', real: true })
  out.push({ text: `Ekran: ${screen.width}×${screen.height} @${(window.devicePixelRatio || 1).toFixed(2).replace(/\.?0+$/, '')}x`, status: 'ok', real: true })
  out.push({ text: `Język interfejsu: ${navigator.language}`, status: 'info', real: true })
  out.push({ text: `API WebGL2: ${typeof WebGL2RenderingContext !== 'undefined' ? 'obecne' : 'brak'}`, status: typeof WebGL2RenderingContext !== 'undefined' ? 'ok' : 'warn', real: true })
  return out
}

/** Scripted part of the boot log (simulation). */
const SCRIPT_HEAD: Step[] = [
  { text: 'J.A.R.V.I.S. BIOS v7.4.1 (mk85) – rozruch', status: 'info' },
  { text: 'Test pamięci operacyjnej', status: 'ok', progress: true },
]
const SCRIPT_TAIL: Step[] = [
  { text: 'Montowanie /dev/arc0 (reaktor łukowy)', status: 'ok' },
  { text: 'Ładowanie modułów jądra: hud, głos, nawigacja', status: 'ok' },
  { text: 'Kalibracja czujników HUD (12/12)', status: 'ok' },
  { text: 'Synchronizacja zegara z satelitą', status: 'warn', note: 'dryf 3 ms' },
  { text: 'Dekompresja modeli rozpoznawania mowy', status: 'ok', progress: true },
  { text: 'Uzgadnianie kluczy z serwerem kwatery', status: 'ok' },
  { text: 'Moduł pogodowy: brak odpowiedzi', status: 'fail', note: 'ponowienie' },
  { text: 'Moduł pogodowy: tryb pamięci podręcznej', status: 'warn' },
  { text: 'Uruchamianie interfejsu głosowego', status: 'ok' },
  { text: 'Wszystkie krytyczne systemy sprawne', status: 'ok' },
]
const FINAL = 'J.A.R.V.I.S. gotowy. Witaj z powrotem.'
/* block-letter banner (original, drawn with box-drawing characters) */
const BANNER = [
  '     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗',
  '     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝',
  '     ██║███████║██████╔╝██║   ██║██║███████╗',
  '██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║',
  '╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║',
  ' ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝',
  '  Wirtualny asystent pokładowy · terminal tty0',
]
const PROMPT = 'jarvis@stark-core:~$ '

const STATUS_LABEL: Record<Status, string> = { ok: ' OK ', warn: 'WARN', fail: 'FAIL', info: 'INFO' }
const STATUS_CLS: Record<Status, string> = { ok: 'text-jx-ok', warn: 'text-jx-warn', fail: 'text-jx-danger', info: 'text-jx-accent' }
const SPIN = ['|', '/', '–', '\\']
const CURSORS = { blok: 'block', podkreślenie: 'under', pionowa: 'bar' } as const

type Phase = 'type' | 'spin' | 'progress' | 'status' | 'final' | 'prompt' | 'hold'

export default function TerminalBoot({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    speed: { value: 140, min: 20, max: 400, step: 10, label: 'znaki / s' },
    timestamps: { value: true, label: 'znaczniki czasu' },
    cursor: { value: CURSORS.blok as string, options: CURSORS, label: 'kursor' },
    crt: { value: true, label: 'efekt CRT' },
    hold: { value: 3.5, min: 1, max: 12, step: 0.5, label: 'pauza po starcie (s)' },
  })

  const steps = useMemo(() => [...SCRIPT_HEAD, ...browserSteps(), ...SCRIPT_TAIL], [])
  const [rows, setRows] = useState<Row[]>([])
  const [phase, setPhase] = useState<Phase>('type')
  const [prompt, setPrompt] = useState(false)
  const [boot, setBoot] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const speedRef = useRef(c.speed)
  const holdRef = useRef(c.hold)
  useEffect(() => {
    speedRef.current = c.speed
    holdRef.current = c.hold
  }, [c.speed, c.hold])

  // machine state lives in a ref so pausing resumes exactly where it stopped
  const m = useRef({ line: 0, char: 0, phase: 'type' as Phase, t: 0, acc: 0, bootT: 0, rows: [] as Row[] })

  // reduced motion: the finished log, rendered statically
  const staticRows = useMemo(() => {
    if (!reducedMotion) return null
    const all: Row[] = steps.map((s, i) => ({ text: s.text, status: s.status, pct: s.progress ? 100 : undefined, ts: 0.137 * (i + 1), real: s.real, note: s.note }))
    all.push({ text: FINAL, ts: 0.137 * (steps.length + 1), final: true })
    return all
  }, [reducedMotion, steps])

  useEffect(() => {
    if (reducedMotion || paused) return
    let raf = 0
    let last = performance.now()
    const st = m.current
    const push = () => setRows(st.rows.slice())

    const frame = (now: number) => {
      // rAF timestamps can precede the performance.now() taken at effect start → clamp at 0
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000))
      last = now
      st.t += dt
      st.bootT += dt
      const step = steps[st.line]
      switch (st.phase) {
        case 'type': {
          if (!step) {
            st.phase = 'final'
            st.char = 0
            st.rows.push({ text: '', ts: st.bootT, final: true })
            break
          }
          if (st.char === 0 && (st.rows.length === 0 || st.rows[st.rows.length - 1].status !== undefined || st.rows[st.rows.length - 1].final)) {
            st.rows.push({ text: '', ts: st.bootT, real: step.real, note: step.note })
          }
          st.acc += dt * speedRef.current
          const n = Math.floor(st.acc)
          if (n > 0) {
            st.acc -= n
            st.char = Math.min(step.text.length, st.char + n)
            const r = st.rows[st.rows.length - 1]
            st.rows[st.rows.length - 1] = { ...r, text: step.text.slice(0, st.char) }
            push()
          }
          if (st.char >= step.text.length) {
            st.phase = step.progress ? 'progress' : 'spin'
            st.t = 0
          }
          break
        }
        case 'spin': {
          const dur = 0.18 + ((st.line * 37) % 7) * 0.06
          const r = st.rows[st.rows.length - 1]
          const spin = Math.floor(st.t / 0.07) % SPIN.length
          if (r.spin !== spin) {
            st.rows[st.rows.length - 1] = { ...r, spin }
            push()
          }
          if (st.t > dur) st.phase = 'status'
          break
        }
        case 'progress': {
          const dur = 1.3
          const pct = Math.min(100, Math.round((st.t / dur) * 100))
          const r = st.rows[st.rows.length - 1]
          if (r.pct !== pct) {
            st.rows[st.rows.length - 1] = { ...r, pct }
            push()
          }
          if (st.t > dur) st.phase = 'status'
          break
        }
        case 'status': {
          const r = st.rows[st.rows.length - 1]
          st.rows[st.rows.length - 1] = { ...r, spin: undefined, status: step.status }
          push()
          st.line++
          st.char = 0
          st.acc = 0
          st.phase = 'type'
          break
        }
        case 'final': {
          st.acc += dt * speedRef.current * 0.45
          const n = Math.floor(st.acc)
          if (n > 0) {
            st.acc -= n
            st.char = Math.min(FINAL.length, st.char + n)
            const r = st.rows[st.rows.length - 1]
            st.rows[st.rows.length - 1] = { ...r, text: FINAL.slice(0, st.char) }
            push()
          }
          if (st.char >= FINAL.length) {
            st.phase = 'prompt'
            st.t = 0
            setPrompt(true)
          }
          break
        }
        case 'prompt': {
          if (st.t > holdRef.current) {
            st.phase = 'hold'
            st.t = 0
          }
          break
        }
        case 'hold': {
          // clear screen and reboot
          st.rows = []
          st.line = 0
          st.char = 0
          st.acc = 0
          st.bootT = 0
          st.phase = 'type'
          setPrompt(false)
          setBoot((b) => b + 1)
          push()
          break
        }
      }
      setPhase(st.phase)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [paused, reducedMotion, steps])

  const shownRows = staticRows ?? rows
  const showPrompt = !!staticRows || prompt

  // auto-scroll to the newest line
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shownRows, showPrompt])

  const fs = stage ? 'text-[clamp(0.9rem,1.25vw,1.2rem)]' : 'text-[0.625rem]'
  const typingIdx = !staticRows && (phase === 'type' || phase === 'final') ? rows.length - 1 : -1
  const caretCls = `tb-caret tb-caret--${c.cursor}`

  return (
    <div data-paused={paused || undefined} className={`fxk-noblur absolute inset-0 bg-[#010509] overflow-hidden ${c.crt ? 'tb-crt' : ''}`}>
      <div className={`absolute ${stage ? 'inset-6' : 'inset-1.5'} flex flex-col`}>
        <header
          data-augmented-ui="tl-clip tr-clip-x border"
          className={`jx-aug flex items-center gap-2 ${stage ? 'px-4 py-2' : 'px-2 py-0.5'} shrink-0`}
          style={{ ['--aug-tl' as string]: stage ? '10px' : '5px' }}
        >
          <IconTerminal2 size={stage ? 16 : 9} className="text-jx-accent shrink-0" />
          <span className={`font-plex text-jx-accent ${stage ? 'text-sm' : 'text-[0.625rem]'} truncate`}>tty0 · jarvis@stark-core</span>
          <span className="flex-1" />
          {stage && <span className="jx-label text-[0.625rem]! hidden md:inline">◆ = odczyt z przeglądarki</span>}
          <DemoBadge label="SYMULACJA" title="Log rozruchu jest symulowany; wiersze z ◆ to prawdziwe odczyty z przeglądarki" className={stage ? '' : 'scale-75 origin-right'} />
        </header>
        <div
          ref={scroller}
          role="log"
          aria-label="Log rozruchu systemu (symulacja)"
          aria-live="off"
          className={`relative flex-1 min-h-0 overflow-hidden border-x border-b border-jx-line/50 bg-black/40 ${stage ? 'px-5 py-4' : 'px-1.5 py-1'} font-plex ${fs} leading-[1.55]`}
        >
          {stage && (
            <pre key={boot} className="tb-banner m-0 mb-3 font-mono text-jx-accent tb-glow leading-[1.05] text-[clamp(0.45rem,0.75vw,0.72rem)]" aria-hidden="true">
              {BANNER.map((l, i) => (
                <span key={i} className="block" style={{ animationDelay: `${i * 70}ms` }}>
                  {l}
                </span>
              ))}
            </pre>
          )}
          {shownRows.map((r, i) => (
            <div key={i} className={`flex items-baseline gap-[0.6em] whitespace-pre min-w-0 ${r.final ? 'text-jx-accent tb-glow mt-[0.4em]' : 'text-jx-text/85'}`}>
              {c.timestamps && <span className="text-jx-dim/80 shrink-0">[{r.ts.toFixed(3).padStart(8, ' ')}]</span>}
              {r.real && <span className="text-jx-accent shrink-0" aria-label="prawdziwy odczyt">◆</span>}
              <span className={`min-w-0 truncate ${r.real ? 'text-jx-text' : ''}`}>
                {r.text}
                {i === typingIdx && <span className={caretCls} aria-hidden="true" />}
              </span>
              {!r.final && (r.pct !== undefined || r.spin !== undefined || r.status) && <span className="flex-1 border-b border-dotted border-jx-line/40 translate-y-[-0.3em] min-w-[1ch]" aria-hidden="true" />}
              {r.pct !== undefined && (
                <span className="text-jx-accent shrink-0">
                  [{'#'.repeat(Math.round(r.pct / 10)).padEnd(10, '.')}] {String(r.pct).padStart(3, ' ')}%
                </span>
              )}
              {r.spin !== undefined && !r.status && <span className="text-jx-accent shrink-0">{SPIN[r.spin]}</span>}
              {r.note && r.status && stage && <span className="text-jx-dim shrink-0">{r.note}</span>}
              {r.status && <span className={`shrink-0 ${STATUS_CLS[r.status]} tb-glow`}>[{STATUS_LABEL[r.status]}]</span>}
            </div>
          ))}
          {showPrompt && (
            <div className="whitespace-pre text-jx-ok mt-[0.3em]">
              {PROMPT}
              <span className={caretCls} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
      {c.crt && <div className="tb-scan absolute inset-0 pointer-events-none" aria-hidden="true" />}
    </div>
  )
}
