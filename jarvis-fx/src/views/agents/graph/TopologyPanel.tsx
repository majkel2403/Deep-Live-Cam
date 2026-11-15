import { lazy, Suspense, useCallback, useState } from 'react'
import { IconCube, IconFocusCentered, IconRotate360, IconSquare } from '@tabler/icons-react'
import { ScaleLoader } from 'react-spinners'
import { Decipher, HudButton, Panel } from '@/hud'
import type { OrchestrationSnapshot } from '@/lib/agents'
import type { Quality } from '@/lib/store'
import { hasWebGL, useElementSize } from '../hooks'
import { LINK_META, SEMANTIC, STATUS_META, fmtInt } from '../model'

const Graph3D = lazy(() => import('./Graph3D'))
const Graph2D = lazy(() => import('./Graph2D'))

type Mode = '3d' | '2d'
const MODE_KEY = 'jx-agents-graph-mode'

function readMode(): Mode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === '2d' || v === '3d') return v
  } catch {
    /* storage blocked – fall back to default */
  }
  return '3d'
}

function writeMode(m: Mode) {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    /* ignore */
  }
}

export interface TopologyPanelProps {
  snapshot: OrchestrationSnapshot | null
  selectedId: string | null
  onSelect: (id: string) => void
  accent: string
  accent2: string
  reduced: boolean
  quality: Quality
  /** shown while there is no snapshot (connection state / error detail) */
  waitHint?: string
  /** synthetic (demo) data → extra in-viewport DEMO marker */
  synthetic?: boolean
  className?: string
}

/** Panel hosting the agent topology (3D by default, 2D canvas fallback) with HUD overlays. */
export function TopologyPanel({ snapshot, selectedId, onSelect, accent, accent2, reduced, quality, waitHint = 'Oczekiwanie na migawkę', synthetic = false, className = '' }: TopologyPanelProps) {
  const [webgl] = useState(hasWebGL)
  const [pref, setPref] = useState<Mode>(readMode)
  const mode: Mode = webgl ? pref : '2d'
  const [autoRotate, setAutoRotate] = useState(true)
  const [fitSignal, setFitSignal] = useState(0)
  const [hostRef, size] = useElementSize<HTMLDivElement>()

  const choose = useCallback((m: Mode) => {
    setPref(m)
    writeMode(m)
  }, [])

  const nodes = snapshot?.agents.length ?? 0
  const links = snapshot?.links.length ?? 0
  const traffic = snapshot ? snapshot.links.reduce((s, l) => s + l.traffic, 0) : 0
  const Graph = mode === '3d' ? Graph3D : Graph2D

  const actions = (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Widok topologii">
      <HudButton size="sm" active={mode === '3d'} disabled={!webgl} onClick={() => choose('3d')} icon={<IconCube />} title={webgl ? 'Topologia 3D (WebGL)' : 'WebGL niedostępny w tej przeglądarce'}>
        3D
      </HudButton>
      <HudButton size="sm" active={mode === '2d'} onClick={() => choose('2d')} icon={<IconSquare />} title="Schemat 2D (canvas) – lżejszy tryb awaryjny">
        2D
      </HudButton>
      <span className="w-px h-4 bg-jx-line mx-1" aria-hidden="true" />
      <HudButton
        size="sm"
        active={autoRotate && !reduced}
        disabled={mode !== '3d' || reduced}
        onClick={() => setAutoRotate((v) => !v)}
        icon={<IconRotate360 />}
        aria-label="Automatyczny obrót kamery"
        title={reduced ? 'Obrót wyłączony – ograniczony ruch' : 'Automatyczny obrót kamery'}
      />
      <HudButton size="sm" onClick={() => setFitSignal((n) => n + 1)} icon={<IconFocusCentered />} aria-label="Dopasuj widok do węzłów" title="Dopasuj widok" />
    </div>
  )

  return (
    <Panel
      skin="nefrex"
      className={className}
      title={<Decipher text="Topologia orkiestracji" />}
      code={mode === '3d' ? 'TOPO-3D' : 'TOPO-2D'}
      actions={actions}
      bodyClassName="relative p-1.5"
    >
      <div ref={hostRef} className="ag-graph absolute inset-1.5 overflow-hidden jx-grid-bg" aria-label="Interaktywny graf agentów – kliknij węzeł, aby go wybrać" role="application">
        {snapshot && size.width > 0 && size.height > 0 ? (
          <Suspense fallback={<GraphLoader accent={accent} />}>
            <Graph
              key={`${mode}-${quality}`}
              snapshot={snapshot}
              selectedId={selectedId}
              onSelect={onSelect}
              width={size.width}
              height={size.height}
              accent={accent}
              accent2={accent2}
              reduced={reduced}
              quality={quality}
              autoRotate={autoRotate}
              fitSignal={fitSignal}
            />
          </Suspense>
        ) : (
          <GraphLoader accent={accent} label={waitHint} />
        )}

        {/* HUD overlays (pointer-transparent) */}
        <div className="ag-reticle" aria-hidden="true" />
        <div className="absolute left-4 top-3 pointer-events-none flex flex-col gap-0.5">
          <span className="jx-label text-[0.6rem]">Węzły / łącza</span>
          <span className="jx-num text-sm text-jx-accent jx-glow-text">
            {fmtInt(nodes)} <span className="text-jx-dim">/</span> {fmtInt(links)}
          </span>
          <span className="jx-label text-[0.6rem] mt-1">Ruch</span>
          <span className="jx-num text-sm text-jx-accent jx-glow-text">
            {fmtInt(traffic)} <span className="text-[0.7em] text-jx-dim">wiad./min</span>
          </span>
          {synthetic && <span className="ag-demo-tag mt-1.5">DEMO · dane syntetyczne</span>}
        </div>
        <Legend accent={accent} accent2={accent2} dashedTools={mode === '2d'} />
        <p className="absolute right-4 top-3 jx-label text-[0.56rem] pointer-events-none text-right leading-tight hidden md:block">
          {mode === '3d' ? 'LPM: obrót · PPM: przesuw · kółko: zoom' : 'przeciągnij: przesuw · kółko: zoom'}
          <br />
          klik w węzeł: wybór agenta
        </p>
      </div>
    </Panel>
  )
}

function GraphLoader({ accent, label = 'Inicjalizacja grafu' }: { accent: string; label?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <ScaleLoader color={accent} height={22} width={3} margin={2} aria-hidden="true" />
        <span className="jx-label jx-caret">{label}</span>
      </div>
    </div>
  )
}

function Legend({ accent, accent2, dashedTools }: { accent: string; accent2: string; dashedTools: boolean }) {
  const statuses = ['running', 'thinking', 'waiting', 'idle', 'error'] as const
  const kinds = [
    { k: 'delegates' as const, c: accent, dash: false },
    { k: 'reports' as const, c: accent2, dash: false },
    { k: 'tool' as const, c: SEMANTIC.violet, dash: dashedTools },
  ]
  return (
    <div className="ag-legend absolute left-4 bottom-3 pointer-events-none flex flex-col gap-1 px-2 py-1.5" aria-label="Legenda">
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {statuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 jx-label text-[0.56rem]">
            <span className="jx-dot !size-[6px]" style={{ color: STATUS_META[s].css }} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {kinds.map(({ k, c, dash }) => (
          <span key={k} className="inline-flex items-center gap-1 jx-label text-[0.56rem]" title={LINK_META[k].hint}>
            <svg width="16" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="16" y2="2" stroke={c} strokeWidth="2" strokeDasharray={dash ? '3 2' : undefined} />
            </svg>
            {LINK_META[k].label}
          </span>
        ))}
        <span className="jx-label text-[0.56rem] text-jx-dim">· rozmiar = obciążenie · cząstki = ruch</span>
      </div>
    </div>
  )
}
