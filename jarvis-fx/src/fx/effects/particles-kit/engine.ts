import { useEffect, useState } from 'react'
import { tsParticles, type Engine, type IShapeDrawData, type IShapeDrawer, type Particle } from '@tsparticles/engine'
import { loadSlim } from '@tsparticles/slim'

/**
 * Shared tsParticles (MIT) bootstrap for every particle effect.
 *
 * @tsparticles/react v4 replaced `initParticlesEngine()` with <ParticlesProvider init>, whose `init`
 * must be one stable function for the whole app and runs once. `jxParticlesInit` is that function:
 * it loads the slim bundle and registers our own `jx-glyph` shape (monospace data glyphs drawn with
 * the particle's fill colour – the stock emoji shape caches black text and ignores colour).
 * Any other module mounting a ParticlesProvider should import and reuse this init.
 */

export const GLYPH_SHAPE = 'jx-glyph'
export const DATA_GLYPHS = '01アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/\\|=+*#'

let glyphRegistered = false
/** false when tsParticles was initialised elsewhere first (registration closes after first load). */
export const hasGlyphShape = () => glyphRegistered

interface GlyphState {
  ch: string
  next: number
}
interface GlyphShapeOptions {
  glyphs?: string
  /** mean seconds between glyph swaps; 0 = static */
  flicker?: number
}

class GlyphDrawer implements IShapeDrawer {
  private state = new WeakMap<Particle, GlyphState>()

  private pick(p: Particle) {
    const opts = (p.shapeData ?? {}) as GlyphShapeOptions
    const set = opts.glyphs || DATA_GLYPHS
    return set[Math.floor(Math.random() * set.length)] ?? '0'
  }

  particleInit(_container: unknown, particle: Particle) {
    this.state.set(particle, { ch: this.pick(particle), next: 0 })
  }

  particleDestroy(particle: Particle) {
    this.state.delete(particle)
  }

  draw(data: IShapeDrawData) {
    const { context, particle, radius } = data
    let st = this.state.get(particle)
    if (!st) {
      st = { ch: this.pick(particle), next: 0 }
      this.state.set(particle, st)
    }
    const flicker = ((particle.shapeData ?? {}) as GlyphShapeOptions).flicker ?? 0.6
    const now = performance.now()
    if (flicker > 0 && now > st.next) {
      st.ch = this.pick(particle)
      st.next = now + flicker * 1000 * (0.4 + Math.random() * 1.2)
    }
    const size = Math.max(6, radius * 2)
    context.font = `600 ${size}px "Share Tech Mono", "JetBrains Mono", ui-monospace, monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    // fillStyle (with opacity) is already set by the engine for this particle
    context.fillText(st.ch, 0, 0)
  }
}

let initPromise: Promise<void> | null = null

export function jxParticlesInit(engine: Engine): Promise<void> {
  initPromise ??= (async () => {
    await loadSlim(engine)
    try {
      await engine.pluginManager.register((e: Engine) => {
        e.pluginManager.addShape([GLYPH_SHAPE], () => Promise.resolve(new GlyphDrawer()))
      })
      glyphRegistered = true
    } catch {
      // registration is closed once any container has loaded – effects fall back to stock shapes
      glyphRegistered = false
    }
  })()
  return initPromise
}

/**
 * True once the shared engine is initialised (or initialisation failed because another module got
 * there first). Lets an effect pick shape types that depend on what was registered.
 */
export function useParticlesReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    jxParticlesInit(tsParticles)
      .catch(() => undefined)
      .then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}
