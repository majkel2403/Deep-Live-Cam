/**
 * Small shared helpers for the text-* / motion-* effects (not an effect itself: no meta.ts).
 */
import './kit.css'

/** Honest marker for synthetic / scripted content. Never a button (cards are <button>s). */
export function DemoBadge({ label = 'DEMO', title = 'Dane syntetyczne – pokaz efektu, nie odczyt z systemu', className = '' }: { label?: string; title?: string; className?: string }) {
  return (
    <span
      title={title}
      aria-label={`${label}: ${title}`}
      className={`jx-num inline-flex items-center gap-1 text-[0.625rem] font-bold tracking-[0.22em] px-1.5 py-px border border-jx-warn/70 text-jx-warn bg-jx-warn/10 leading-none ${className}`}
    >
      <span className="inline-block size-1 bg-jx-warn" />
      {label}
    </span>
  )
}

/** Marker for values read from the real browser (honest counterpart of DemoBadge). */
export function LiveBadge({ label = 'NA ŻYWO', title = 'Prawdziwy odczyt z przeglądarki', className = '' }: { label?: string; title?: string; className?: string }) {
  return (
    <span
      title={title}
      aria-label={`${label}: ${title}`}
      className={`jx-num inline-flex items-center gap-1 text-[0.625rem] font-bold tracking-[0.22em] px-1.5 py-px border border-jx-ok/70 text-jx-ok bg-jx-ok/10 leading-none ${className}`}
    >
      <span className="jx-dot size-1!" />
      {label}
    </span>
  )
}

/** Four HUD corner brackets (decorative, pointer-transparent). */
export function CornerBrackets({ size = 14, inset = 8, className = '' }: { size?: number; inset?: number; className?: string }) {
  const common = 'absolute border-jx-accent/70 pointer-events-none'
  const s = { width: size, height: size }
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden="true">
      <span className={`${common} border-t border-l`} style={{ ...s, top: inset, left: inset }} />
      <span className={`${common} border-t border-r`} style={{ ...s, top: inset, right: inset }} />
      <span className={`${common} border-b border-l`} style={{ ...s, bottom: inset, left: inset }} />
      <span className={`${common} border-b border-r`} style={{ ...s, bottom: inset, right: inset }} />
    </div>
  )
}
