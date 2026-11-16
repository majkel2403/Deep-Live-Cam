/**
 * Start-up overlay. Contract (App.tsx): full-screen overlay at z-[70], calls onDone() exactly once
 * when the sequence ends or is skipped (button, Esc / Enter / Space, click anywhere). ≤ ~6 s.
 *
 * The choreography (GSAP + plugins) lives in a lazy chunk so the main bundle stays lean; while
 * it loads, a plain backdrop is shown. If the chunk fails or anything throws, the overlay gets out
 * of the way instead of blocking the app, and a watchdog guarantees onDone() even if the
 * timeline is throttled (background tab).
 */
import { Component, lazy, Suspense, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { BOOT_TOTAL } from './layers'

const BootStage = lazy(() => import('./BootStage').then((m) => ({ default: m.BootStage })))

class BootGuard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function BootSequence({ onDone }: { onDone: () => void }) {
  const fired = useRef(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  const finish = useCallback(() => {
    if (fired.current) return
    fired.current = true
    onDoneRef.current()
  }, [])

  // watchdog: lazy load + full sequence + margin
  useEffect(() => {
    const t = window.setTimeout(finish, (BOOT_TOTAL + 6) * 1000)
    return () => window.clearTimeout(t)
  }, [finish])

  return (
    <BootGuard onError={finish}>
      <Suspense fallback={<div className="fixed inset-0 z-[70] bg-jx-bg" aria-busy="true" aria-label="Ładowanie sekwencji rozruchu" />}>
        <BootStage mode="overlay" onDone={finish} />
      </Suspense>
    </BootGuard>
  )
}
