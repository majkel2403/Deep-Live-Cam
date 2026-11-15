import { useEffect, useLayoutEffect, useRef } from 'react'
import { animate } from 'animejs'
import { useReducedMotion } from '@/lib/store'

/**
 * Number "roll" driven by anime.js v4 (MIT). The span's text is owned by this component
 * (React never renders children into it), so anime can write textContent every frame.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 700,
  className,
}: {
  value: number | null
  format?: (v: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const state = useRef({ v: value ?? 0 })
  const fmt = useRef(format)
  fmt.current = format
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = value === null ? 'n/d' : fmt.current(state.current.v)
    // initial paint only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value === null) {
      el.textContent = 'n/d'
      return
    }
    if (reduced || !Number.isFinite(value)) {
      state.current.v = value
      el.textContent = fmt.current(value)
      return
    }
    const anim = animate(state.current, {
      v: value,
      duration,
      ease: 'outExpo',
      onUpdate: () => {
        el.textContent = fmt.current(state.current.v)
      },
    })
    return () => {
      anim.pause()
    }
  }, [value, duration, reduced])

  return <span ref={ref} className={className} />
}
