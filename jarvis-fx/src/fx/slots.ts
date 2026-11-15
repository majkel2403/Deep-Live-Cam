import { useEffect, useId, useState, useSyncExternalStore } from 'react'

/**
 * Browsers cap live WebGL contexts (~16) and Vanta's own docs warn against more than one or two
 * heavy effects per page. Gallery cards that use WebGL must hold a slot to render live.
 */
let max = 4
const holders: string[] = [] // oldest first
const wanting = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

function refill() {
  for (const id of wanting) {
    if (holders.length >= max) break
    if (!holders.includes(id)) holders.push(id)
  }
}

export function setWebglSlotLimit(n: number) {
  max = Math.max(1, n)
  while (holders.length > max) holders.shift()
  refill()
  emit()
}

function request(id: string, force: boolean) {
  wanting.add(id)
  if (holders.includes(id)) return
  if (holders.length < max) holders.push(id)
  else if (force) {
    holders.shift()
    holders.push(id)
  }
  emit()
}

function release(id: string) {
  wanting.delete(id)
  const i = holders.indexOf(id)
  if (i >= 0) holders.splice(i, 1)
  refill()
  emit()
}

/** Returns [hasSlot, forceAcquire]. `want` = card visible. Non-WebGL cards always get true. */
export function useWebglSlot(webgl: boolean, want: boolean): [boolean, () => void] {
  const id = useId()
  const [forced, setForced] = useState(0)
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
  useEffect(() => {
    if (!webgl) return
    if (want) request(id, forced > 0)
    else release(id)
    return () => release(id)
  }, [webgl, want, id, forced])
  if (!webgl) return [true, () => {}]
  return [holders.includes(id), () => setForced((f) => f + 1)]
}
