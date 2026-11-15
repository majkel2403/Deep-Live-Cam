import type { BackgroundDrawContext, ISourceOptions } from '@tsparticles/engine'
import type { Quality } from '@/lib/store'
import { hexToRgb01 } from '../bg-kit/color'

/** Particle budget multiplier per quality tier (gallery cards always run 'low'). */
export function budget(quality: Quality, stage: boolean): number {
  if (!stage) return 0.35
  return quality === 'high' ? 1 : quality === 'med' ? 0.7 : 0.45
}

/**
 * Motion-blur trails for `clear: false` containers: instead of clearing, every frame paints a
 * translucent veil of the backdrop colour, so moving particles leave fading streaks.
 */
export function trailVeil(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb01(hex).map((v) => Math.round(v * 255))
  const fill = `rgba(${r}, ${g}, ${b}, ${alpha})`
  return (ctx: BackgroundDrawContext) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
  }
}

/** Options every container shares: fills its parent, no auto-pause on blur (FxHost drives `paused`). */
export function baseOptions(quality: Quality, stage: boolean): ISourceOptions {
  return {
    fullScreen: { enable: false },
    detectRetina: quality !== 'low',
    fpsLimit: stage ? 60 : 30,
    pauseOnBlur: false,
    pauseOnOutsideViewport: true,
    background: { color: 'transparent' },
  }
}
