import IconTopologyStar3 from '@tabler/icons-react/icons/IconTopologyStar3'
import { Decipher, Readout } from '@/hud'
import type { OrchestrationSnapshot } from '@/lib/agents'
import { fmtInt, summarize } from './model'
import { SourceControl, type SourceInfo } from './SourceControl'

/** Top strip: view title, fleet KPIs and the data-source indicator / switcher. */
export function StatusStrip({ snapshot, source }: { snapshot: OrchestrationSnapshot | null; source: SourceInfo }) {
  const k = snapshot ? summarize(snapshot) : null
  const dash = '—'
  return (
    <section data-augmented-ui="tl-clip br-clip tr-rect-x border" className="ag-strip jx-aug flex flex-wrap md:flex-nowrap items-center gap-x-5 gap-y-2 px-4 py-2 shrink-0 min-w-0" aria-label="Stan floty agentów">
      <div className="flex items-center gap-2.5 min-w-0 max-md:basis-full">
        <span className="ag-strip-icon" aria-hidden="true">
          <IconTopologyStar3 className="size-5" />
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <Decipher as="h1" text="Orkiestracja agentów" className="jx-display font-cmd tracking-[0.1em] sm:tracking-[0.16em] text-[0.78rem] sm:text-[0.86rem] text-jx-accent jx-glow-text whitespace-nowrap" />
          <span className="jx-label text-[0.625rem]">Agenci · topologia · telemetria</span>
        </div>
      </div>
      <span className="w-px self-stretch bg-jx-line max-md:hidden" aria-hidden="true" />
      {/* lower-priority KPIs drop out on narrower screens instead of being clipped */}
      <div className="flex gap-x-5 min-w-0 overflow-hidden">
        <div className="shrink-0">
          <Readout label="Agenci" value={k ? fmtInt(k.total) : dash} />
        </div>
        <div className="shrink-0">
          <Readout label="Aktywni" value={k ? fmtInt(k.active) : dash} tone="ok" />
        </div>
        <div className="hidden sm:block shrink-0">
          <Readout label="Błędy" value={k ? fmtInt(k.errors) : dash} tone={k && k.errors ? 'danger' : 'dim'} />
        </div>
        <div className="hidden xl:block shrink-0">
          <Readout label="Ruch" value={k ? fmtInt(k.traffic) : dash} unit="wiad./min" />
        </div>
        <div className="hidden xl:block shrink-0">
          <Readout label="Śr. latencja" value={k ? fmtInt(k.avgLatency) : dash} unit="ms" tone={k && k.avgLatency > 600 ? 'warn' : 'accent'} />
        </div>
        <div className="hidden xl:block shrink-0">
          <Readout label="Tokeny" value={k ? fmtInt(k.tokens) : dash} unit="/min" />
        </div>
        <div className="hidden min-[1520px]:block shrink-0">
          <Readout label="Zadania" value={k ? `${k.tasksActive}/${k.tasksQueued}` : dash} unit="akt./kol." />
        </div>
      </div>
      <span className="flex-1" />
      <div className="shrink-0 max-md:basis-full max-md:flex max-md:justify-end">
        <SourceControl info={source} />
      </div>
    </section>
  )
}
