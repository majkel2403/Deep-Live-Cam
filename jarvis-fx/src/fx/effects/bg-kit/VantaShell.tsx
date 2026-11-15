import type { ReactNode, RefObject } from 'react'
import { BgHud, type BgHudStat } from './BgHud'
import type { VantaStatus } from './useVanta'

/**
 * Layout shell for Vanta effects: the host element Vanta mounts its canvas into (must stay
 * childless – Vanta re-styles children), a status line while loading / on failure, and the HUD overlay.
 */
export function VantaShell({
  hostRef,
  status,
  background,
  code,
  hint,
  stats,
  stage,
  paused,
  children,
}: {
  hostRef: RefObject<HTMLDivElement | null>
  status: VantaStatus
  background: string
  code: string
  hint?: ReactNode
  stats?: BgHudStat[]
  stage: boolean
  paused: boolean
  children?: ReactNode
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background }}>
      <div ref={hostRef} className="absolute inset-0" />
      {status !== 'ready' && (
        <div className="absolute inset-0 z-20 grid place-items-center">
          {status === 'loading' ? (
            <span className="jx-label text-jx-accent jx-caret">Inicjalizacja WebGL</span>
          ) : (
            <span className="jx-label text-jx-danger">Vanta: brak kontekstu WebGL</span>
          )}
        </div>
      )}
      {children}
      <BgHud code={code} stage={stage} paused={paused} hint={hint} stats={stats} />
    </div>
  )
}
