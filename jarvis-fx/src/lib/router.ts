import { useSyncExternalStore } from 'react'
import type { ViewId } from './store'

/**
 * Tiny hash router:  #/bridge  #/gallery  #/gallery/<fxId>  #/agents  #/sound  #/arsenal  #/boot
 * Solo mode (screenshots / embedding a single effect):  ?fx=<fxId>   (optionally &chrome=0)
 */
export interface Route {
  view: ViewId
  fxId?: string
  solo?: string
}

const VIEWS: ViewId[] = ['bridge', 'gallery', 'agents', 'sound', 'arsenal', 'boot']

function parse(): Route {
  const params = new URLSearchParams(window.location.search)
  const solo = params.get('fx') ?? undefined
  const [, view, sub] = window.location.hash.replace(/^#/, '').split('/')
  const v = VIEWS.includes(view as ViewId) ? (view as ViewId) : 'bridge'
  return { view: v, fxId: v === 'gallery' && sub ? decodeURIComponent(sub) : undefined, solo }
}

let current = typeof window !== 'undefined' ? parse() : { view: 'bridge' as ViewId }
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse()
    listeners.forEach((l) => l())
  })
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export function navigate(view: ViewId, sub?: string) {
  const hash = `#/${view}${sub ? `/${encodeURIComponent(sub)}` : ''}`
  if (window.location.hash !== hash) window.location.hash = hash
}
