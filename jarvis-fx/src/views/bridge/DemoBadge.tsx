import * as Tooltip from '@radix-ui/react-tooltip'
import { StatusDot } from '@/hud'

/**
 * Honest data-source marker. When the agent source is synthetic, a loud "DEMO" badge is shown
 * with an explanatory tooltip (Radix Tooltip, MIT – keyboard focusable).
 */
export function DemoBadge({
  synthetic,
  label,
  status,
  compact = false,
  focusable = true,
}: {
  synthetic: boolean
  label: string
  status: 'connecting' | 'live' | 'error'
  compact?: boolean
  /** repeated badges (panel footers) stay out of the Tab order – the status strip one is the keyboard stop */
  focusable?: boolean
}) {
  const statusText = status === 'live' ? 'na żywo' : status === 'connecting' ? 'łączenie' : 'błąd łącza'
  const tone = status === 'live' ? 'ok' : status === 'connecting' ? 'warn' : 'danger'
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {!compact && (
        <span className="jx-label text-[0.625rem] truncate max-w-[16rem]" title={label}>
          <span className="text-jx-dim">Źródło:</span> <span className="text-jx-text normal-case tracking-wider font-mono">{label}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1" aria-label={`Status źródła: ${statusText}`}>
        <StatusDot tone={tone} pulse={status !== 'live'} />
        {!compact && <span className="jx-label text-[0.625rem]">{statusText}</span>}
      </span>
      {synthetic && (
        <Tooltip.Root delayDuration={150}>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              tabIndex={focusable ? undefined : -1}
              className="bx-demo jx-num text-[0.625rem] font-bold tracking-[0.25em] px-2 py-[1px] cursor-help"
              aria-label="DEMO – dane syntetyczne z symulatora"
            >
              DEMO
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="bottom" sideOffset={6} className="bx-tip z-[70] max-w-72 px-3 py-2 text-[0.75rem] leading-snug">
              Dane agentów są <b className="text-jx-warn">syntetyczne</b> (symulator demo). Podłącz prawdziwe źródło WS/SSE w Ustawieniach → Źródło agentów.
              <Tooltip.Arrow className="fill-[var(--jx-line-strong)]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      )}
    </span>
  )
}

/** Small green marker for metrics measured live in this browser. */
export function LiveBadge({ title = 'Pomiar na żywo w tej przeglądarce' }: { title?: string }) {
  return (
    <span className="bx-live inline-flex items-center gap-1 px-1.5 py-[1px] jx-label text-[0.625rem] text-jx-ok whitespace-nowrap shrink-0" title={title}>
      <StatusDot tone="ok" pulse />
      Na żywo
    </span>
  )
}
