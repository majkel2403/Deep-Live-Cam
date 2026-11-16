import { useMemo, useState } from 'react'
import type { Agent, AgentLink, OrchestrationSnapshot } from '@/lib/agents'
import type { Quality } from '@/lib/store'

/**
 * Force-graph data model with STABLE object identity.
 *
 * d3-force mutates node objects (x/y/z/vx…) and replaces link.source/target with node refs.
 * Handing the graph fresh objects every second would reset the layout, so we keep one pool
 * per graph instance: fields are patched in place on every snapshot, and a new `data`
 * object is only produced when the topology (set of agents / links) actually changes.
 */
export interface GNode {
  id: string
  agent: Agent
  x?: number
  y?: number
  z?: number
  /** fixed y (3D view stacks delegation tiers); d3-force keeps the node on this plane */
  fy?: number
}

export interface GLink {
  key: string
  source: string | GNode
  target: string | GNode
  kind: AgentLink['kind']
  traffic: number
}

export interface GraphData {
  nodes: GNode[]
  links: GLink[]
}

export interface GraphModel {
  data: GraphData
  /** changes whenever any link's particle count changes (used to re-digest particles) */
  particleSig: string
  maxParticles: number
}

interface Pool {
  nodes: Map<string, GNode>
  links: Map<string, GLink>
  topo: string
  data: GraphData
}

const linkKey = (l: AgentLink) => `${l.source}>${l.target}:${l.kind}`

/** Number of particles travelling along a link – grows with its traffic (messages / min). */
export function particleCount(traffic: number, max: number): number {
  if (traffic < 1) return 0
  return Math.min(max, Math.max(1, Math.round(traffic / 7)))
}

/** Particle speed (fraction of the link per frame) – busier links flow faster. */
export function particleSpeed(traffic: number, reduced: boolean): number {
  if (reduced) return 0
  return 0.0022 + Math.min(60, traffic) * 0.00026
}

export const endpointId = (e: string | GNode) => (typeof e === 'string' ? e : e.id)

/** Patch the pool in place from a snapshot; returns the (possibly new) graph data object. */
function syncPool(pool: Pool, agents: Agent[], links: AgentLink[]): GraphData {
  const topo = `${agents.map((a) => a.id).join(',')}|${links.map(linkKey).join(',')}`

  for (const a of agents) {
    const n = pool.nodes.get(a.id)
    if (n) n.agent = a
    else {
      // seed new nodes next to their parent so they "bud" out of it instead of flying in
      const parent = a.parentId ? pool.nodes.get(a.parentId) : undefined
      const jitter = () => (Math.random() - 0.5) * 20
      pool.nodes.set(a.id, parent?.x !== undefined ? { id: a.id, agent: a, x: parent.x + jitter(), y: (parent.y ?? 0) + jitter(), z: (parent.z ?? 0) + jitter() } : { id: a.id, agent: a })
    }
  }

  if (topo !== pool.topo) {
    const ids = new Set(agents.map((a) => a.id))
    for (const id of [...pool.nodes.keys()]) if (!ids.has(id)) pool.nodes.delete(id)
    const keys = new Set<string>()
    const nextLinks: GLink[] = []
    for (const l of links) {
      const key = linkKey(l)
      if (keys.has(key) || !ids.has(l.source) || !ids.has(l.target)) continue
      keys.add(key)
      let gl = pool.links.get(key)
      if (!gl) {
        gl = { key, source: l.source, target: l.target, kind: l.kind, traffic: l.traffic }
        pool.links.set(key, gl)
      }
      gl.traffic = l.traffic
      nextLinks.push(gl)
    }
    for (const k of [...pool.links.keys()]) if (!keys.has(k)) pool.links.delete(k)
    pool.topo = topo
    pool.data = { nodes: agents.map((a) => pool.nodes.get(a.id)!), links: nextLinks }
  } else {
    for (const l of links) {
      const gl = pool.links.get(linkKey(l))
      if (gl) gl.traffic = l.traffic
    }
  }
  return pool.data
}

const createPool = (): Pool => ({ nodes: new Map(), links: new Map(), topo: '', data: { nodes: [], links: [] } })

export function useGraphModel(snap: OrchestrationSnapshot | null, quality: Quality): GraphModel {
  // one mutable pool per graph instance (see note above) – lives as long as the component
  const [pool] = useState(createPool)
  const maxParticles = quality === 'low' ? 3 : quality === 'med' ? 5 : 6

  return useMemo(() => {
    const data = syncPool(pool, snap?.agents ?? [], snap?.links ?? [])
    const particleSig = data.links.map((l) => particleCount(l.traffic, maxParticles)).join('')
    return { data, particleSig, maxParticles }
  }, [pool, snap, maxParticles])
}
