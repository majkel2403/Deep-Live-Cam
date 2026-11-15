/**
 * Thin, framework-agnostic adapters around the vanilla ARWES packages
 * (@arwes/frames, @arwes/bgs, @arwes/text – MIT). We deliberately do NOT use @arwes/react:
 * it is React 18-only, breaks under StrictMode and the project is self-declared unmaintained.
 * Vendoring the vanilla primitives keeps the look while staying on React 19.
 */

export type ArwesNodeState = 'entering' | 'entered' | 'exiting' | 'exited'

export interface ArwesAnimatorShim {
  state: ArwesNodeState
  settings: { duration: { enter: number; exit: number; interval: number } }
  subscribe: (cb: (node: ArwesAnimatorShim) => void) => () => void
  /** Drive state transitions manually (enter/exit). */
  transition: (to: 'enter' | 'exit') => void
}

/**
 * Minimal stand-in for an ARWES AnimatorNode: enough for @arwes/bgs, which only reads
 * `state`, `settings.duration.{enter,exit,interval}` and `subscribe()`.
 */
export function createAnimatorShim(opts: { enter?: number; exit?: number; interval?: number; startEntered?: boolean } = {}): ArwesAnimatorShim {
  const subs = new Set<(n: ArwesAnimatorShim) => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const node: ArwesAnimatorShim = {
    state: opts.startEntered ? 'entered' : 'exited',
    settings: { duration: { enter: opts.enter ?? 0.6, exit: opts.exit ?? 0.4, interval: opts.interval ?? 10 } },
    subscribe(cb) {
      subs.add(cb)
      cb(node)
      return () => subs.delete(cb)
    },
    transition(to) {
      clearTimeout(timer)
      const set = (s: ArwesNodeState) => {
        node.state = s
        subs.forEach((cb) => cb(node))
      }
      if (to === 'enter') {
        set('entering')
        timer = setTimeout(() => set('entered'), node.settings.duration.enter * 1000)
      } else {
        set('exiting')
        timer = setTimeout(() => set('exited'), node.settings.duration.exit * 1000)
      }
    },
  }
  return node
}
