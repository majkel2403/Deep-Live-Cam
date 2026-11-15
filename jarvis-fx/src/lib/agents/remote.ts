import type { AgentSource, OrchestrationSnapshot } from './types'

/**
 * Real source adapter. Expects the backend to push full `OrchestrationSnapshot` JSON objects:
 *   ws://host:port/path        → WebSocket, one JSON snapshot per message
 *   http(s)://host/path        → Server-Sent Events (EventSource), one JSON snapshot per `data:`
 * Reconnects with exponential backoff.
 */
export function createRemoteSource(url: string): AgentSource {
  const isWs = /^wss?:\/\//i.test(url)
  return {
    label: url,
    kind: isWs ? 'ws' : 'sse',
    synthetic: false,
    subscribe(cb, onStatus) {
      let closed = false
      let retry = 0
      let ws: WebSocket | null = null
      let es: EventSource | null = null
      let timer: ReturnType<typeof setTimeout> | undefined

      const handle = (raw: string) => {
        try {
          const snap = JSON.parse(raw) as OrchestrationSnapshot
          if (Array.isArray(snap.agents)) {
            retry = 0
            onStatus?.('live')
            cb(snap)
          }
        } catch (e) {
          onStatus?.('error', `Niepoprawny JSON: ${(e as Error).message}`)
        }
      }
      const schedule = () => {
        if (closed) return
        const delay = Math.min(15000, 500 * 2 ** retry++)
        onStatus?.('error', `Brak połączenia – ponowienie za ${Math.round(delay / 1000)} s`)
        timer = setTimeout(open, delay)
      }
      const open = () => {
        if (closed) return
        onStatus?.('connecting')
        try {
          if (isWs) {
            ws = new WebSocket(url)
            ws.onmessage = (e) => handle(String(e.data))
            ws.onclose = schedule
            ws.onerror = () => ws?.close()
          } else {
            es = new EventSource(url)
            es.onmessage = (e) => handle(e.data)
            es.onerror = () => {
              es?.close()
              schedule()
            }
          }
        } catch (e) {
          onStatus?.('error', (e as Error).message)
          schedule()
        }
      }
      open()
      return () => {
        closed = true
        clearTimeout(timer)
        ws?.close()
        es?.close()
      }
    },
  }
}
