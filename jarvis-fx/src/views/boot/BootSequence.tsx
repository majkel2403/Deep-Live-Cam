// STUB – owned by the "boot/sound" builder. Contract: full-screen overlay, calls onDone() when finished or skipped.
import { useEffect } from 'react'
export function BootSequence({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 300)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className="fixed inset-0 z-[70] bg-jx-bg" />
}
