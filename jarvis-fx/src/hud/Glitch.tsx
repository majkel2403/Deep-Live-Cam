import { useEffect, useMemo, type ReactNode } from 'react'
import { useGlitch } from 'react-powerglitch'
import type { PowerGlitchOptions, RecursivePartial } from 'powerglitch'
import { useReducedMotion } from '@/lib/store'

type GlitchPartialOptions = RecursivePartial<PowerGlitchOptions>

/**
 * PowerGlitch (MIT, <2 KB): CSS-animation glitch on any element.
 * mode: 'always' (looping), 'hover', 'click', 'once' (plays when `trigger` changes).
 */
export function Glitch({
  children,
  mode = 'hover',
  trigger,
  options,
  className,
}: {
  children: ReactNode
  mode?: 'always' | 'hover' | 'click' | 'once'
  trigger?: unknown
  options?: GlitchPartialOptions
  className?: string
}) {
  const reduced = useReducedMotion()
  const playMode = reduced || mode === 'once' ? 'manual' : mode
  const opts = useMemo<GlitchPartialOptions>(
    () => ({
      playMode,
      hideOverflow: false,
      timing: mode === 'always' ? { duration: 2400, iterations: Infinity } : { duration: 420, iterations: 1 },
      glitchTimeSpan: mode === 'always' ? { start: 0.82, end: 0.95 } : { start: 0, end: 1 },
      shake: { velocity: 12, amplitudeX: 0.04, amplitudeY: 0.06 },
      slice: { count: 5, velocity: 14, minHeight: 0.02, maxHeight: 0.18, hueRotate: true },
      ...options,
    }),
    // `options` is usually an inline literal; only the mode/motion switch should re-initialise
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playMode, mode],
  )
  const glitch = useGlitch(opts)
  const { setOptions, stopGlitch } = glitch

  // Re-initialise PowerGlitch when reduced motion is toggled at runtime ('manual' = never auto-plays).
  useEffect(() => {
    if (reduced) stopGlitch()
    setOptions(opts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts])

  useEffect(() => {
    if (mode === 'once' && trigger !== undefined && !reduced) glitch.startGlitch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  // PowerGlitch wraps/re-parents the element it is attached to, so it gets an inner span;
  // the outer span stays a stable node for React's reconciler (safe unmount inside lists).
  // The markup is identical with reduced motion (the glitch just never plays), so toggling
  // the motion setting at runtime never makes React remove a node PowerGlitch has moved.
  return (
    <span className={className} style={{ display: 'inline-block' }}>
      <span ref={glitch.ref} style={{ display: 'inline-block' }}>
        {children}
      </span>
    </span>
  )
}
