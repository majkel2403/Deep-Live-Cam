/**
 * Ambient declarations for Vanta.js (MIT, https://github.com/tengbao/vanta) and the three@0.134
 * copy it runs on. Vanta ships untyped UMD bundles; only the surface used by
 * src/fx/effects/bg-kit/useVanta.ts is described here.
 */

declare module 'vanta/dist/*' {
  export interface VantaOptions {
    el: HTMLElement
    /** a three.js namespace (we pass three@0.134 from the `three-vanta` alias) */
    THREE?: unknown
    mouseControls?: boolean
    touchControls?: boolean
    gyroControls?: boolean
    minHeight?: number
    minWidth?: number
    scale?: number
    scaleMobile?: number
    forceAnimate?: boolean
    backgroundColor?: number
    backgroundAlpha?: number
    color?: number
    color2?: number
    speed?: number
    [option: string]: unknown
  }

  /** Subset of three's WebGLRenderer that we touch on teardown. */
  export interface VantaRenderer {
    domElement: HTMLCanvasElement
    dispose(): void
    forceContextLoss(): void
  }

  export interface VantaEffect {
    options: VantaOptions
    renderer: VantaRenderer | null
    /** rAF id of Vanta's own loop */
    req: number
    prevNow?: number
    /** bound per instance in the constructor; renders one frame and schedules the next */
    animationLoop: () => number
    setOptions(options: Partial<VantaOptions>): void
    resize(): void
    destroy(): void
    [member: string]: unknown
  }

  export type VantaFactory = (options: VantaOptions) => VantaEffect
  const factory: VantaFactory
  export default factory
}

declare module 'three-vanta' {
  /** three@0.134 installed under an alias (Vanta needs RGBFormat & friends removed in later releases). */
  export const REVISION: string
  export const WebGLRenderer: new (...args: unknown[]) => unknown
  /** constructed loosely: only used to add overlay meshes to Vanta's own scene */
  export const Mesh: new (geometry: unknown, material: unknown) => unknown
  export const MeshBasicMaterial: new (parameters?: Record<string, unknown>) => unknown
  /** prototype is patched once (NaN guard), see bg-kit/useVanta.ts */
  export const BufferGeometry: { prototype: Record<string, unknown> }
}
