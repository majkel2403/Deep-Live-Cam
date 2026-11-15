import { useEffect, useState } from 'react'

/** Real page frame rate measured with rAF (a genuine browser metric, not synthetic data). */
export function useFps(active: boolean): number | null {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let frames = 0
    let since = performance.now()
    const tick = (now: number) => {
      frames++
      const dt = now - since
      if (dt >= 600) {
        setFps(Math.round((frames * 1000) / dt))
        frames = 0
        since = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return active ? fps : null
}
