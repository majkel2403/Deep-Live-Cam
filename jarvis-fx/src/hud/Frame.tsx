import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import {
  createFrame,
  createFrameCircleSettings,
  createFrameCornersSettings,
  createFrameHeaderSettings,
  createFrameKranoxSettings,
  createFrameLinesSettings,
  createFrameNefrexSettings,
  createFrameNeroSettings,
  createFrameOctagonSettings,
  createFrameUnderlineSettings,
} from '@arwes/frames'

export type FrameKind =
  | 'octagon'
  | 'corners'
  | 'lines'
  | 'underline'
  | 'nefrex'
  | 'kranox'
  | 'header'
  | 'nero'
  | 'circle'

export const FRAME_KINDS: FrameKind[] = ['octagon', 'corners', 'lines', 'underline', 'nefrex', 'kranox', 'header', 'nero', 'circle']

function settingsFor(kind: FrameKind, opts: { padding?: number; size?: number; stroke?: number }) {
  const common = { styled: true, animated: false, padding: opts.padding ?? 0 }
  const size = opts.size
  switch (kind) {
    case 'octagon':
      return createFrameOctagonSettings({ ...common, squareSize: size ?? 14, strokeWidth: opts.stroke ?? 1 })
    case 'corners':
      return createFrameCornersSettings({ ...common, cornerLength: size ?? 16, strokeWidth: opts.stroke ?? 2 })
    case 'lines':
      return createFrameLinesSettings({ ...common, smallLineLength: size ?? 16 })
    case 'underline':
      return createFrameUnderlineSettings({ ...common, squareSize: size ?? 14, strokeWidth: opts.stroke ?? 1 })
    case 'nefrex':
      return createFrameNefrexSettings({ ...common, squareSize: size ?? 16, strokeWidth: opts.stroke ?? 1, leftTop: true, rightBottom: true })
    case 'kranox':
      return createFrameKranoxSettings({ ...common, squareSize: size ?? 12, strokeWidth: opts.stroke ?? 1 })
    case 'header':
      return createFrameHeaderSettings({ ...common, strokeWidth: opts.stroke ?? 1, contentLength: size ?? 80 })
    case 'nero':
      return createFrameNeroSettings({ ...common, cornerLength: size ?? 14 })
    case 'circle':
      return createFrameCircleSettings({ ...common, strokeWidth: opts.stroke ?? 1 })
  }
}

export interface FrameProps {
  kind?: FrameKind
  padding?: number
  size?: number
  stroke?: number
  /** play a short "assemble" entrance (stroke draw + fade) */
  enter?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * ARWES SVG frame rendered behind its parent's content.
 * Parent must have class `jx-frame-host` (position: relative; isolation: isolate).
 */
export function Frame({ kind = 'octagon', padding, size, stroke, enter = true, className, style }: FrameProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const frame = createFrame(svg, settingsFor(kind, { padding, size, stroke }))
    if (enter && !document.documentElement.matches('[data-motion="reduced"]')) {
      const paths = svg.querySelectorAll<SVGPathElement>('path')
      paths.forEach((p) => {
        const isBg = p.getAttribute('data-name') === 'bg'
        const anim = isBg
          ? p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out', fill: 'backwards' })
          : (() => {
              let len = 1000
              try {
                len = Math.max(10, p.getTotalLength())
              } catch {
                /* not rendered yet */
              }
              return p.animate(
                [
                  { strokeDasharray: `${len}`, strokeDashoffset: `${len}` },
                  { strokeDasharray: `${len}`, strokeDashoffset: '0' },
                ],
                { duration: 700, easing: 'cubic-bezier(.6,0,.2,1)' },
              )
            })()
        anim.onfinish = () => anim.cancel()
      })
    }
    return () => frame.remove()
  }, [kind, padding, size, stroke, enter])

  return <svg ref={ref} data-jx-frame={kind} className={className} style={style} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" />
}

/** Convenience: a box with an ARWES frame behind children. */
export function FrameBox({
  kind = 'octagon',
  children,
  className = '',
  style,
  frameProps,
}: {
  kind?: FrameKind
  children?: ReactNode
  className?: string
  style?: CSSProperties
  frameProps?: Omit<FrameProps, 'kind'>
}) {
  return (
    <div className={`jx-frame-host ${className}`} style={style}>
      <Frame kind={kind} {...frameProps} />
      {children}
    </div>
  )
}
