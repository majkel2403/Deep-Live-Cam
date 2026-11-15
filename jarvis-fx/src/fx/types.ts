import type { ComponentType } from 'react'
import type { Quality } from '@/lib/store'

export type FxCategory =
  | 'webgl' // 3D scenes: R3F / drei / postprocessing / spring / uikit / theatre
  | 'background' // full-bleed backdrops: Vanta, React Bits, shader planes, ARWES bgs
  | 'particles' // tsParticles presets, point clouds
  | 'hud' // reticles, radars, gauges, frames, HUD widgets
  | 'loader' // spinners / scanning loaders / progress
  | 'text' // decipher, glitch, split-text, terminal
  | 'data' // charts / graphs as visual effects
  | 'motion' // Motion / GSAP / anime.js choreography

export const FX_CATEGORIES: { id: FxCategory; label: string }[] = [
  { id: 'webgl', label: 'Sceny 3D' },
  { id: 'background', label: 'Tła' },
  { id: 'particles', label: 'Cząsteczki' },
  { id: 'hud', label: 'Elementy HUD' },
  { id: 'loader', label: 'Loadery' },
  { id: 'text', label: 'Tekst' },
  { id: 'data', label: 'Dane' },
  { id: 'motion', label: 'Choreografia' },
]

/**
 * Lives in   src/fx/effects/<id>/meta.ts   (eager, tiny)
 * Component  src/fx/effects/<id>/index.tsx (lazy chunk, default export)
 */
export interface FxMeta {
  /** must equal the folder name */
  id: string
  /** Polish UI title */
  title: string
  category: FxCategory
  /** one or two sentences, Polish */
  description: string
  /** libraries used, e.g. ['R3F', 'drei', 'postprocessing'] */
  tech: string[]
  /** license(s) of the libraries/assets the effect relies on, e.g. 'MIT' or 'MIT + Commons Clause' */
  license: string
  /** attribution / origin (port, inspiration, docs) */
  source?: { label: string; url: string }
  /** true when the effect creates a WebGL context (pooled in the gallery) */
  webgl?: boolean
  /** relative GPU/CPU cost 1 (cheap) … 3 (heavy) */
  cost?: 1 | 2 | 3
  tags?: string[]
  /** sort order inside its category (lower first) */
  order?: number
}

export interface FxProps {
  /** accent colour as hex (#00e5ff) and hue */
  accent: string
  accent2: string
  hue: number
  quality: Quality
  reducedMotion: boolean
  /** true when rendered in the big stage (vs. a gallery card thumbnail) */
  stage: boolean
  /** pause animation loops (card scrolled away, tab hidden) */
  paused: boolean
}

export type FxComponent = ComponentType<FxProps>

export interface FxEntry extends FxMeta {
  load: () => Promise<{ default: FxComponent }>
}
