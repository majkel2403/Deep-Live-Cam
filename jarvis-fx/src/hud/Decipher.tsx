import { useEffect, useRef, type CSSProperties, type ElementType } from 'react'
import { animateTextDecipher } from '@arwes/text'
import { playBleep } from '@/lib/sound'

export interface DecipherProps {
  text: string
  /** seconds; default scales with length */
  duration?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
  sound?: boolean
  /** re-run when this key changes (defaults to text) */
  replayKey?: string | number
  delay?: number
}

/**
 * ARWES "decipher" text effect (@arwes/text animateTextDecipher, MIT): random glyphs
 * resolve into the final string. Falls back to static text with reduced motion.
 */
export function Decipher({ text, duration, as: Tag = 'span', className, style, sound = false, replayKey, delay = 0 }: DecipherProps) {
  const root = useRef<HTMLElement>(null)
  const content = useRef<HTMLElement>(null)

  useEffect(() => {
    const rootEl = root.current
    const contentEl = content.current
    if (!rootEl || !contentEl) return
    if (document.documentElement.matches('[data-motion="reduced"]')) return
    const d = duration ?? Math.min(1.6, 0.25 + text.length * 0.025)
    let anim: { cancel: () => void } | undefined
    let tick: ReturnType<typeof setInterval> | undefined
    const t = setTimeout(() => {
      anim = animateTextDecipher({ rootElement: rootEl, contentElement: contentEl, duration: d, hideOnExited: false })
      if (sound) {
        tick = setInterval(() => playBleep('type'), 45)
        setTimeout(() => clearInterval(tick), d * 1000)
      }
    }, delay * 1000)
    return () => {
      clearTimeout(t)
      clearInterval(tick)
      anim?.cancel()
    }
  }, [text, duration, sound, replayKey, delay])

  return (
    <Tag ref={root} className={className} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <span ref={content}>{text}</span>
    </Tag>
  )
}
