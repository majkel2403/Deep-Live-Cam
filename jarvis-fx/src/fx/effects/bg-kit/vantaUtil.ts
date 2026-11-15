/** Loose structural view of three@0.134 objects living inside a Vanta scene. */
export interface V3Object {
  material?: { color?: { set: (c: number | string) => void }; size?: number; opacity?: number; transparent?: boolean; needsUpdate?: boolean }
  geometry?: unknown
  visible?: boolean
  [k: string]: unknown
}

/** Set a material colour on a Vanta scene object if it has one. */
export function setColor(obj: unknown, color: number | undefined) {
  if (color === undefined || !obj) return
  ;(obj as V3Object).material?.color?.set(color)
}
