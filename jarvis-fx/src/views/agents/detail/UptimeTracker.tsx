/**
 * Uptime tracker bar.
 * Ported/adapted from Tremor "Tracker" [v1.0.0] – https://github.com/tremorlabs/tremor
 * (raw.githubusercontent.com/tremorlabs/tremor/main/src/components/Tracker/Tracker.tsx),
 * Copyright Tremor Labs, Apache License 2.0.
 * Changes: Radix HoverCard → Radix Tooltip (already in the stack), HUD colours/glow instead of
 * Tailwind palette classes, keyboard focus on blocks, Polish copy, summary readout.
 */
import { memo } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { fmtPct1 } from '../model'

export interface TrackerBlock {
  key: string | number
  ok: boolean
  tooltip: string
}

const Block = memo(function Block({ ok, tooltip }: { ok: boolean; tooltip: string }) {
  return (
    <Tooltip.Root delayDuration={0} disableHoverableContent>
      <Tooltip.Trigger asChild>
        <span className="ag-track-cell" tabIndex={-1} role="img" aria-label={tooltip}>
          <span className="ag-track-block" data-ok={ok ? 'true' : 'false'} />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={8} align="center" avoidCollisions className="ag-tip z-[70] px-2 py-1 text-[0.72rem] leading-tight">
          {tooltip}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
})

export function UptimeTracker({ uptime, label = 'Dostępność' }: { uptime: boolean[]; label?: string }) {
  const n = uptime.length
  const okCount = uptime.filter(Boolean).length
  const ratio = n ? okCount / n : 1
  const incidents = n - okCount
  const blocks: TrackerBlock[] = uptime.map((ok, i) => ({
    key: i,
    ok,
    tooltip: `Próbka ${i + 1}/${n} · ${n - 1 - i === 0 ? 'najnowsza' : `${n - 1 - i} wstecz`} · ${ok ? 'sprawny' : 'incydent'}`,
  }))
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-baseline gap-3">
        <span className="jx-label">{label}</span>
        <span className="flex-1" />
        <span className="jx-label text-[0.625rem]">
          incydenty <span className={`jx-num ${incidents ? 'text-jx-danger' : 'text-jx-text'}`}>{incidents}</span>
        </span>
        <span className={`jx-num text-sm jx-glow-text ${ratio >= 0.97 ? 'text-jx-ok' : ratio >= 0.9 ? 'text-jx-warn' : 'text-jx-danger'}`}>{fmtPct1(ratio)}</span>
      </div>
      {n ? (
        <div className="ag-track" role="img" aria-label={`${label}: ${fmtPct1(ratio)} z ${n} próbek, incydentów: ${incidents}`}>
          {blocks.map((b) => (
            <Block key={b.key} ok={b.ok} tooltip={b.tooltip} />
          ))}
        </div>
      ) : (
        <div className="ag-track grid place-items-center jx-label text-[0.625rem]">brak próbek</div>
      )}
      <div className="flex justify-between jx-label text-[0.625rem] text-jx-dim" aria-hidden="true">
        <span>starsze</span>
        <span>teraz</span>
      </div>
    </div>
  )
}
