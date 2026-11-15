import { useEffect } from 'react'
import { create } from 'zustand'
import { useSettings } from '../store'
import { createDemoSource } from './demo'
import { createRemoteSource } from './remote'
import type { AgentSource, OrchestrationSnapshot } from './types'

export * from './types'

interface AgentsState {
  snapshot: OrchestrationSnapshot | null
  status: 'connecting' | 'live' | 'error'
  detail?: string
  source: Pick<AgentSource, 'label' | 'kind' | 'synthetic'>
}

export const useAgentsStore = create<AgentsState>(() => ({
  snapshot: null,
  status: 'connecting',
  source: { label: 'DEMO · symulator', kind: 'demo', synthetic: true },
}))

function makeSource(spec: string): AgentSource {
  if (!spec || spec === 'demo') return createDemoSource()
  return createRemoteSource(spec)
}

let refCount = 0
let stop: (() => void) | null = null
let currentSpec = ''

function connect(spec: string) {
  stop?.()
  currentSpec = spec
  const src = makeSource(spec)
  useAgentsStore.setState({ source: { label: src.label, kind: src.kind, synthetic: src.synthetic }, status: 'connecting', snapshot: null })
  stop = src.subscribe(
    (snapshot) => useAgentsStore.setState({ snapshot }),
    (status, detail) => useAgentsStore.setState({ status, detail }),
  )
}

/** Mount in any view that needs orchestration data. Shared, ref-counted connection. */
export function useAgents(): AgentsState {
  const spec = useSettings((s) => s.agentSource)
  useEffect(() => {
    refCount++
    if (!stop || currentSpec !== spec) connect(spec)
    return () => {
      refCount--
      if (refCount === 0) {
        stop?.()
        stop = null
      }
    }
  }, [spec])
  return useAgentsStore()
}
