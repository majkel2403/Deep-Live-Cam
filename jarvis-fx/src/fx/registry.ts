import { lazy, type LazyExoticComponent } from 'react'
import { FX_CATEGORIES, type FxComponent, type FxEntry, type FxMeta } from './types'

/**
 * Auto-discovered effect registry. Adding an effect = adding a folder:
 *   src/fx/effects/<id>/meta.ts    → `export const meta: FxMeta = {...}`
 *   src/fx/effects/<id>/index.tsx  → `export default function Fx(props: FxProps) {...}`
 * No shared file needs editing, so effects can be developed in parallel.
 */
const metas = import.meta.glob<FxMeta>('./effects/*/meta.ts', { eager: true, import: 'meta' })
const loaders = import.meta.glob<{ default: FxComponent }>('./effects/*/index.tsx')

const catOrder = new Map(FX_CATEGORIES.map((c, i) => [c.id, i]))

export const FX: FxEntry[] = Object.entries(metas)
  .map(([path, meta]) => {
    const dir = path.replace('./effects/', '').replace('/meta.ts', '')
    const load = loaders[`./effects/${dir}/index.tsx`]
    if (!load) {
      console.warn(`[fx] ${dir}: meta.ts without index.tsx`)
      return null
    }
    if (meta.id !== dir) console.warn(`[fx] meta.id "${meta.id}" ≠ folder "${dir}"`)
    return { ...meta, id: dir, load }
  })
  .filter((e): e is FxEntry => e !== null)
  .sort((a, b) => (catOrder.get(a.category) ?? 99) - (catOrder.get(b.category) ?? 99) || (a.order ?? 50) - (b.order ?? 50) || a.title.localeCompare(b.title, 'pl'))

export const FX_BY_ID = new Map(FX.map((f) => [f.id, f]))

const lazyCache = new Map<string, LazyExoticComponent<FxComponent>>()
export function lazyFx(id: string): LazyExoticComponent<FxComponent> | null {
  const entry = FX_BY_ID.get(id)
  if (!entry) return null
  let c = lazyCache.get(id)
  if (!c) {
    c = lazy(entry.load)
    lazyCache.set(id, c)
  }
  return c
}
