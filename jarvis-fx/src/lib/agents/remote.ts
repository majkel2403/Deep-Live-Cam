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
      // last status reported – a 1 Hz stream should not re-announce 'live' on every message
      let reported: 'connecting' | 'live' | 'error' | null = null
      const status = (s: 'connecting' | 'live' | 'error', detail?: string) => {
        if (s === reported && s === 'live') return
        reported = s
        onStatus?.(s, detail)
      }
      let ws: WebSocket | null = null
      let es: EventSource | null = null
      let timer: ReturnType<typeof setTimeout> | undefined

      const handle = (raw: string) => {
        try {
          const snap = JSON.parse(raw) as OrchestrationSnapshot
          if (Array.isArray(snap.agents)) {
            retry = 0
            status('live')
            cb(snap)
          }
        } catch (e) {
          status('error', `Niepoprawny JSON: ${(e as Error).message}`)
        }
      }
      const schedule = () => {
        if (closed) return
        const delay = Math.min(15000, 500 * 2 ** retry++)
        status('error', `Brak połączenia – ponowienie za ${Math.max(1, Math.round(delay / 1000))} s`)
        timer = setTimeout(open, delay)
      }
      const open = () => {
        if (closed) return
        status('connecting')
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
          status('error', (e as Error).message)
          schedule()
        }
      }
      open()
      return () => {
        closed = true
        clearTimeout(timer)
        if (ws) {
          const sock = ws
          sock.onmessage = sock.onerror = sock.onclose = null
          // closing during the handshake makes the browser log a warning: close right after it opens instead
          if (sock.readyState === WebSocket.CONNECTING) sock.onopen = () => sock.close()
          else sock.close()
        }
        es?.close()
      }
    },
  }
}
