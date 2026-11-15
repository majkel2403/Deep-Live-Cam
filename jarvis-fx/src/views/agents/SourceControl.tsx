import { useId, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import { IconPlugConnected, IconX } from '@tabler/icons-react'
import { Decipher, FrameBox, HudButton, StatusDot } from '@/hud'
import { useSettings } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { validateSourceSpec } from './model'

type LinkStatus = 'connecting' | 'live' | 'error'

export interface SourceInfo {
  label: string
  kind: 'demo' | 'ws' | 'sse'
  synthetic: boolean
  status: LinkStatus
  detail?: string
}

const STATUS_TEXT: Record<LinkStatus, string> = { live: 'na żywo', connecting: 'łączenie', error: 'błąd łącza' }
const STATUS_TONE = { live: 'ok', connecting: 'warn', error: 'danger' } as const
const KIND_TEXT = { demo: 'Symulator', ws: 'WebSocket', sse: 'SSE (EventSource)' } as const

/** Loud, honest marker for synthetic data (Radix Tooltip explains what it means). */
export function DemoBadge() {
  return (
    <Tooltip.Root delayDuration={120}>
      <Tooltip.Trigger asChild>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="ag-demo jx-num" aria-label="DEMO – dane syntetyczne z symulatora">
          DEMO
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="bottom" sideOffset={6} className="ag-tip z-[70] max-w-72 px-3 py-2 text-[0.75rem] leading-snug">
          Dane agentów są <b className="text-jx-warn">syntetyczne</b> – generuje je wbudowany symulator. Podłącz własne źródło WS/SSE przyciskiem „Źródło”.
          <Tooltip.Arrow className="fill-[var(--jx-line-strong)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

/** Compact source / link-status indicator + button opening the source form. */
export function SourceControl({ info }: { info: SourceInfo }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex flex-col items-end min-w-0 leading-tight">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="jx-label text-[0.56rem]">Źródło · {KIND_TEXT[info.kind]}</span>
          <StatusDot tone={STATUS_TONE[info.status]} pulse={info.status !== 'live'} />
          <span className="jx-label text-[0.56rem] text-jx-text" aria-live="polite">
            {STATUS_TEXT[info.status]}
          </span>
        </span>
        <span className="font-mono text-[0.7rem] text-jx-text truncate max-w-[14rem]" title={info.detail ? `${info.label} – ${info.detail}` : info.label}>
          {info.label}
        </span>
      </div>
      {info.synthetic && <DemoBadge />}
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          playBleep(o ? 'open' : 'close')
        }}
      >
        <Dialog.Trigger asChild>
          <HudButton size="sm" icon={<IconPlugConnected />} title="Zmień źródło danych agentów">
            Źródło
          </HudButton>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="ag-overlay fixed inset-0 z-[80]" />
          <Dialog.Content className="fixed z-[81] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-y-auto" aria-describedby={undefined}>
            <SourceForm info={info} onDone={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

const PRESETS = [
  { label: 'DEMO', value: 'demo' },
  { label: 'WS lokalny', value: 'ws://localhost:8651/agents' },
  { label: 'SSE lokalny', value: 'http://localhost:8651/agents/stream' },
]

const SAMPLE = `{
  "ts": 1731700000000,
  "agents": [{
    "id": "hermes", "name": "Hermes", "role": "Planista",
    "model": "hermes-4", "status": "running",
    "load": 0.62, "latencyMs": 240, "tokensPerMin": 1800,
    "successRate": 0.97, "queue": 1, "parentId": "jarvis",
    "skills": { "plan": 0.95, "code": 0.8, "search": 0.7,
                "memory": 0.6, "voice": 0.3, "vision": 0.4 },
    "history": [0.31, 0.44, 0.62],
    "uptime": [true, true, false, true]
  }],
  "links": [{ "source": "jarvis", "target": "hermes",
              "kind": "delegates", "traffic": 24 }],
  "events": [{ "id": "e1", "ts": 1731700000000,
               "agentId": "hermes", "level": "info",
               "text": "przyjął zadanie" }],
  "tasks": [{ "id": "t1", "title": "Raport dnia",
              "ownerId": "hermes", "progress": 0.4,
              "state": "active", "startedAt": 1731699990000 }]
}`

function SourceForm({ info, onDone }: { info: SourceInfo; onDone: () => void }) {
  const current = useSettings((s) => s.agentSource)
  const set = useSettings((s) => s.set)
  // the dialog content unmounts when closed, so the field re-seeds from settings on each open
  const [value, setValue] = useState(current)
  const [touched, setTouched] = useState(false)
  const inputId = useId()
  const errId = useId()
  const error = validateSourceSpec(value)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) {
      playBleep('error')
      return
    }
    const v = value.trim()
    set({ agentSource: v.toLowerCase() === 'demo' ? 'demo' : v })
    playBleep('success')
    onDone()
  }

  return (
    <FrameBox kind="octagon" className="p-5 flex flex-col gap-4" frameProps={{ size: 18 }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Dialog.Title asChild>
            <h2 className="jx-title text-base">
              <Decipher text="Źródło danych agentów" />
            </h2>
          </Dialog.Title>
          <p className="text-[0.8rem] text-jx-dim mt-1">
            Widok przyjmuje pełne migawki stanu orkiestracji. Wpisz <code className="ag-code">demo</code>, adres WebSocket albo adres strumienia SSE.
          </p>
        </div>
        <Dialog.Close asChild>
          <HudButton size="sm" icon={<IconX />} aria-label="Zamknij" />
        </Dialog.Close>
      </div>

      <div className="ag-subframe px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem]">
        <span className="jx-label text-[0.6rem]">Teraz</span>
        <span className="font-mono text-jx-text break-all">{info.label}</span>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={STATUS_TONE[info.status]} pulse={info.status !== 'live'} />
          <span className="jx-label text-[0.6rem]">{STATUS_TEXT[info.status]}</span>
        </span>
        {info.synthetic && <span className="jx-label text-[0.6rem] text-jx-warn">dane syntetyczne</span>}
        {info.detail && <span className="w-full text-jx-warn text-[0.72rem]">{info.detail}</span>}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <label htmlFor={inputId} className="jx-label">
          Adres źródła
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            className="ag-input flex-1 min-w-0"
            value={value}
            spellCheck={false}
            autoComplete="off"
            placeholder="demo · ws://host:port/ścieżka · https://host/stream"
            aria-invalid={touched && !!error}
            aria-describedby={errId}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <HudButton type="submit" icon={<IconPlugConnected />}>
            Połącz
          </HudButton>
        </div>
        <p id={errId} className={`text-[0.72rem] min-h-[1.1em] ${touched && error ? 'text-jx-danger' : 'text-jx-dim'}`} role={touched && error ? 'alert' : undefined}>
          {touched && error ? error : 'ws:// lub wss:// → WebSocket (1 migawka JSON na wiadomość) · http(s):// → Server-Sent Events (1 migawka na „data:”)'}
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Szybki wybór">
          {PRESETS.map((p) => (
            <HudButton key={p.value} size="sm" active={value === p.value} onClick={() => setValue(p.value)} title={p.value}>
              {p.label}
            </HudButton>
          ))}
        </div>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="jx-label">Oczekiwany format · OrchestrationSnapshot</span>
        <ul className="text-[0.74rem] text-jx-dim leading-snug list-none flex flex-col gap-0.5">
          <li>
            <code className="ag-code">agents[]</code> – <code className="ag-code">status</code>: idle | thinking | running | waiting | error | offline; <code className="ag-code">load</code>,{' '}
            <code className="ag-code">successRate</code> i <code className="ag-code">skills.*</code> w zakresie 0–1
          </li>
          <li>
            <code className="ag-code">links[]</code> – <code className="ag-code">kind</code>: delegates | reports | tool; <code className="ag-code">traffic</code> = wiadomości/min
          </li>
          <li>
            <code className="ag-code">events[]</code> – najnowsze na końcu (≈200); <code className="ag-code">level</code>: info | ok | warn | error
          </li>
          <li>
            <code className="ag-code">history[]</code> – próbki obciążenia (od najstarszej), <code className="ag-code">uptime[]</code> – true = sprawny, false = incydent
          </li>
        </ul>
        <pre className="ag-pre" aria-label="Przykładowa migawka JSON">
          {SAMPLE}
        </pre>
        <p className="text-[0.7rem] text-jx-dim">Brakujące lub błędne pola są bezpiecznie normalizowane. Po zerwaniu łącza klient ponawia połączenie z rosnącym opóźnieniem (do 15 s).</p>
      </div>
    </FrameBox>
  )
}
