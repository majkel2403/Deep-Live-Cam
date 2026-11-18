import type { CSSProperties, ReactNode } from 'react'
import { Frame, type FrameKind } from './Frame'

export interface PanelProps {
  title?: ReactNode
  /** small right-aligned readout in the header, e.g. "SYS-04" */
  code?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  style?: CSSProperties
  /**
   * Skin:
   *  - 'aug'   → augmented-ui clipped panel (BSD-2, pure CSS; data-augmented-ui)
   *  - an ARWES frame kind → SVG frame drawn behind content
   */
  skin?: 'aug' | FrameKind
  /** augmented-ui mixins when skin='aug' */
  aug?: string
}

/** The standard HUD panel used across views. */
export function Panel({ title, code, icon, actions, children, className = '', bodyClassName = '', style, skin = 'aug', aug = 'tl-clip br-clip tr-clip-x border' }: PanelProps) {
  const header = (title || code || actions) && (
    <header className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-jx-line/60">
      {icon && <span className="text-jx-accent shrink-0 [&>svg]:size-4">{icon}</span>}
      {title && <h2 className="jx-title text-[0.8rem] leading-[1.3] truncate">{title}</h2>}
      <span className="flex-1" />
      {actions}
      {code && <span className="jx-num text-[0.65rem] text-jx-dim tracking-widest">{code}</span>}
    </header>
  )

  // a scrolling body must be reachable from the keyboard and have a name
  const scrollable = bodyClassName.includes('overflow-y-auto')
  const bodyProps = scrollable ? { tabIndex: 0, role: 'region', 'aria-label': typeof title === 'string' ? title : undefined } : {}

  if (skin === 'aug') {
    return (
      <section data-augmented-ui={aug} className={`jx-aug flex flex-col min-h-0 ${className}`} style={style}>
        {header}
        <div className={`flex-1 min-h-0 ${bodyClassName}`} {...bodyProps}>{children}</div>
      </section>
    )
  }
  return (
    <section className={`jx-frame-host flex flex-col min-h-0 ${className}`} style={style}>
      <Frame kind={skin} />
      {header}
      <div className={`flex-1 min-h-0 ${bodyClassName}`} {...bodyProps}>{children}</div>
    </section>
  )
}
