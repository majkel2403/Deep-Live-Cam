import { useEffect, useRef, useState, type RefObject } from 'react'

/** Element size via ResizeObserver (content box, CSS pixels). Observer is disconnected on unmount. */
export function useSize<T extends HTMLElement = HTMLDivElement>(): [RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (w: number, h: number) => setSize((s) => (Math.abs(s.width - w) < 0.5 && Math.abs(s.height - h) < 0.5 ? s : { width: w, height: h }))
    apply(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}
