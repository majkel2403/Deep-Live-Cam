import { FX, FX_BY_ID } from '@/fx/registry'
import type { FxEntry } from '@/fx/types'
import type { Resource } from '@/data/resources'

/** Effects from the live registry whose meta mentions the resource, plus explicit fx: tokens. */
export function linkedEffects(r: Resource): FxEntry[] {
  const out = new Map<string, FxEntry>()
  for (const w of r.where) {
    if (w.startsWith('fx:')) {
      const fx = FX_BY_ID.get(w.slice(3))
      if (fx) out.set(fx.id, fx)
    }
  }
  if (r.fxMatch) {
    for (const fx of FX) {
      const hay = [...fx.tech, fx.license, fx.source?.label ?? '', fx.source?.url ?? ''].join(' | ')
      if (r.fxMatch.test(hay)) out.set(fx.id, fx)
    }
  }
  return [...out.values()]
}

export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}
