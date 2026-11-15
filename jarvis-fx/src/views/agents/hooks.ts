import { useEffect, useRef, useState, type RefObject } from 'react'

/** Observe an element's content box (ResizeObserver, disconnected on unmount). */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const width = Math.floor(r.width)
      const height = Math.floor(r.height)
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

/**
 * Run `dispose` only on a REAL unmount. StrictMode's dev-only mount → unmount → mount
 * cycle re-runs effects synchronously, so we defer and check whether we came back.
 */
export function useDisposeOnUnmount(dispose: () => void) {
  const alive = useRef(false)
  const fn = useRef(dispose)
  useEffect(() => {
    fn.current = dispose
  }, [dispose])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      setTimeout(() => {
        if (!alive.current) fn.current()
      }, 0)
    }
  }, [])
}

let webglCache: boolean | undefined
/** Is WebGL available at all? (some locked-down browsers / VMs have none). Probe once, release the context. */
export function hasWebGL(): boolean {
  if (webglCache !== undefined) return webglCache
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webglCache = !!gl
  } catch {
    webglCache = false
  }
  return webglCache
}

/** `#rrggbb` + alpha → `rgba()` string (force-graph parses alpha from colour strings). */
export function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
