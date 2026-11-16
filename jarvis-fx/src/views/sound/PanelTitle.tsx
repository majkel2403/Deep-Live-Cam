import type { ReactNode } from 'react'

/** Panel headers are `leading-none truncate`; a taller inline box keeps Ś/Ź/Ć accents unclipped. */
export function PanelTitle({ children }: { children: ReactNode }) {
  return <span className="inline-block leading-[1.25]">{children}</span>
}
