import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three-vanta'
import type { VantaEffect, VantaFactory, VantaOptions } from 'vanta/dist/vanta.net.min'
import type { Quality } from '@/lib/store'
import { dprFor } from './color'

/**
 * React adapter for Vanta.js (MIT, https://github.com/tengbao/vanta).
 *
 *  - runs Vanta on three@0.134 (`three-vanta` alias) via the THREE option – Vanta breaks on three 0.187;
 *  - live options (colours, distances) go through effect.setOptions() + an optional `apply` hook for
 *    materials Vanta only reads at init; structural options rebuild the effect (debounced);
 *  - pause / reduced motion gate Vanta's own rAF loop (it has no pause API);
 *  - teardown: render targets, geometries, materials, renderer and the WebGL context are released.
 *
 * Not ported on purpose: TOPOLOGY and TRUNK run on p5.js (LGPL, not a project dependency).
 */

type Loader = () => Promise<unknown>
export type VantaStatus = 'loading' | 'ready' | 'error'

export interface UseVantaArgs {
  load: Loader
  /** applied live through setOptions (must be JSON-serialisable) */
  options: Omit<VantaOptions, 'el' | 'THREE'>
  /** changing it destroys and recreates the effect (point counts, spacing, toggles…) */
  rebuildKey: string
  /** per-effect live tweaks Vanta ignores after init (material colours, ring speeds…) */
  apply?: (fx: VantaEffect) => void
  paused: boolean
  reducedMotion: boolean
  quality: Quality
}

interface Disposable {
  dispose?: () => void
}
interface SceneNode {
  geometry?: Disposable
  material?: Disposable | Disposable[]
  traverse?: (cb: (o: SceneNode) => void) => void
}

/**
 * Vanta RINGS occasionally extrudes a degenerate arc (coincident contour points) whose bevel vectors
 * come out NaN; three then logs "computeBoundingSphere(): Computed radius is NaN" on first render.
 * Zeroing NaN coordinates in the Vanta-only three copy fixes the data at its source (the sliver
 * collapses to a degenerate triangle). Vanta computes bounding spheres once per geometry, so it is cheap.
 */
function installNaNGuard() {
  const proto = THREE.BufferGeometry.prototype as {
    computeBoundingSphere: (this: { attributes?: { position?: { array?: ArrayLike<number> & { [i: number]: number } } } }) => void
    jxNaNGuard?: boolean
  }
  if (proto.jxNaNGuard) return
  const original = proto.computeBoundingSphere
  proto.computeBoundingSphere = function () {
    const a = this.attributes?.position?.array
    if (a) for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) a[i] = 0
    return original.call(this)
  }
  proto.jxNaNGuard = true
}
installNaNGuard()

/** Settle time before a reduced-motion effect freezes (lets Vanta's own deferred resize pass first). */
const SETTLE_MS = 450

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * A few Vanta effects (DOTS) never read the THREE option and capture `window.THREE` when their
 * module is evaluated. Expose three@0.134 globally only for the duration of that first import.
 */
export async function importWithGlobalThree<T>(importer: () => Promise<T>): Promise<T> {
  const w = window as unknown as { THREE?: unknown }
  const had = 'THREE' in w
  const prev = w.THREE
  w.THREE = THREE
  try {
    return await importer()
  } finally {
    if (had) w.THREE = prev
    else delete w.THREE
  }
}

/** UMD bundles come through CJS interop: the factory may sit under one or two `default` keys. */
function pickFactory(mod: unknown): VantaFactory | null {
  let m = mod
  for (let i = 0; i < 3 && m; i++) {
    if (typeof m === 'function') return m as VantaFactory
    m = (m as { default?: unknown }).default
  }
  return null
}

function release(fx: VantaEffect) {
  window.cancelAnimationFrame(fx.req)
  const renderer = fx.renderer
  // Feedback buffers (HALO) and any other render targets Vanta keeps as instance fields.
  for (const key of Object.keys(fx)) {
    const v = fx[key] as (Disposable & { isWebGLRenderTarget?: boolean }) | null
    if (v && typeof v === 'object' && v.isWebGLRenderTarget) v.dispose?.()
  }
  // Vanta's clearThree misses detached meshes (e.g. NET removes linesMesh before clearing).
  const scene = fx.scene as SceneNode | undefined
  scene?.traverse?.((o) => {
    o.geometry?.dispose?.()
    const m = o.material
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.())
    else m?.dispose?.()
  })
  try {
    fx.destroy()
  } catch {
    /* already torn down */
  }
  renderer?.dispose()
  renderer?.forceContextLoss()
}

export function useVanta(args: UseVantaArgs) {
  const hostRef = useRef<HTMLDivElement>(null)
  const fxRef = useRef<VantaEffect | null>(null)
  const live = useRef(args)
  const gate = useRef({ run: true, settleUntil: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 })
  const [status, setStatus] = useState<VantaStatus>('loading')
  const rebuildKey = useDebounced(args.rebuildKey, 220)
  const { load } = args

  useEffect(() => {
    live.current = args
  })

  /** Render exactly one frame while the loop is gated (keeps a still image after resizes). */
  const renderOnce = () => {
    const fx = fxRef.current
    if (!fx || gate.current.run) return
    gate.current.run = true
    fx.animationLoop()
    gate.current.run = false
    window.cancelAnimationFrame(fx.req)
    fx.req = 0
  }

  const syncRun = () => {
    const fx = fxRef.current
    if (!fx) return
    const g = gate.current
    const { paused, reducedMotion } = live.current
    if (g.timer) clearTimeout(g.timer)
    g.timer = 0
    if (!paused && !reducedMotion) {
      if (!g.run) {
        g.run = true
        if (!fx.req) {
          fx.prevNow = performance.now()
          fx.animationLoop()
        }
      }
      return
    }
    const wait = g.settleUntil - performance.now()
    if (!paused && wait > 0) {
      // reduced motion: let the first frames (and Vanta's deferred resize) land, then freeze
      g.timer = setTimeout(syncRun, wait)
      return
    }
    g.run = false
    window.cancelAnimationFrame(fx.req)
    fx.req = 0
  }

  useEffect(() => {
    const el = hostRef.current
    const g = gate.current
    if (!el) return
    let cancelled = false
    let fx: VantaEffect | null = null
    let ro: ResizeObserver | null = null
    setStatus('loading')
    load()
      .then((mod) => {
        if (cancelled || !el.isConnected) return
        const factory = pickFactory(mod)
        if (!factory) throw new Error('Vanta module has no factory export')
        const { options, quality } = live.current
        const dpr = window.devicePixelRatio || 1
        // Vanta renders at devicePixelRatio / scale → cap the backing store per quality tier
        const scale = dpr / dprFor(quality)
        g.run = true
        g.settleUntil = performance.now() + SETTLE_MS
        fx = factory({
          el,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 40,
          minWidth: 40,
          scale,
          scaleMobile: scale,
          ...options,
        })
        if (!fx || !fx.renderer) {
          setStatus('error')
          return
        }
        const inst = fx
        const loop = inst.animationLoop
        // Vanta re-reads this.animationLoop on every rAF → wrapping it gates the whole loop.
        inst.animationLoop = () => {
          if (!g.run) {
            inst.req = 0
            return 0
          }
          return loop()
        }
        fxRef.current = inst
        live.current.apply?.(inst)
        ro = new ResizeObserver(() => {
          inst.resize()
          renderOnce()
        })
        ro.observe(el)
        syncRun()
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.warn('[fx] Vanta failed to start', err)
        setStatus('error')
      })
    return () => {
      cancelled = true
      ro?.disconnect()
      if (g.timer) clearTimeout(g.timer)
      if (fx) release(fx)
      fxRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey, load])

  const optionsKey = JSON.stringify(args.options)
  useEffect(() => {
    const fx = fxRef.current
    if (!fx) return
    fx.setOptions(live.current.options)
    live.current.apply?.(fx)
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, args.apply])

  useEffect(() => {
    syncRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.paused, args.reducedMotion, status])

  return { hostRef, status }
}
