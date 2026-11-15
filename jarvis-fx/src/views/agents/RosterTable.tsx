import { useMemo, useState, type KeyboardEvent } from 'react'
import { IconArrowDown, IconArrowUp, IconArrowsSort, IconUsersGroup } from '@tabler/icons-react'
import { Decipher, Panel, StatusDot } from '@/hud'
import type { Agent } from '@/lib/agents'
import { STATUS_META, fmtInt, fmtPct, fmtPct1, sortAgents, statusHex, type SortKey, type SortState } from './model'

const COLUMNS: { key: SortKey; label: string; title: string; align: 'left' | 'right'; className?: string }[] = [
  { key: 'name', label: 'Agent', title: 'Nazwa i rola', align: 'left', className: 'w-[30%]' },
  { key: 'status', label: 'Status', title: 'Stan bieżący (błędy na górze)', align: 'left' },
  { key: 'load', label: 'Obciąż.', title: 'Wykorzystanie 0–100%', align: 'left', className: 'w-[18%]' },
  { key: 'latencyMs', label: 'Lat. ms', title: 'Latencja odpowiedzi', align: 'right' },
  { key: 'tokensPerMin', label: 'Tok/min', title: 'Przepustowość tokenów', align: 'right' },
  { key: 'successRate', label: 'Skut.', title: 'Odsetek udanych kroków', align: 'right' },
  { key: 'queue', label: 'Kol.', title: 'Zadania w kolejce', align: 'right' },
]

const DOT_TONE = { running: 'ok', thinking: 'accent', waiting: 'warn', idle: 'accent', error: 'danger', offline: 'dim' } as const

export interface RosterTableProps {
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string) => void
  accent: string
  reduced: boolean
  className?: string
}

/** Sortable roster of every agent; rows are keyboard-selectable (Enter / Space, ↑ ↓). */
export function RosterTable({ agents, selectedId, onSelect, accent, reduced, className = '' }: RosterTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'load', dir: 'desc' })
  const rows = useMemo(() => sortAgents(agents, sort), [agents, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'status' ? 'asc' : 'desc' }))

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, idx: number, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = rows[idx + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) (e.currentTarget.parentElement?.querySelector(`[data-agent="${CSS.escape(next.id)}"]`) as HTMLElement | null)?.focus()
    }
  }

  return (
    <Panel
      className={className}
      icon={<IconUsersGroup />}
      title={<Decipher text="Rejestr agentów" />}
      code={`${rows.length} AGT`}
      bodyClassName="overflow-auto"
    >
      <table className="ag-table w-full text-left" aria-label="Rejestr agentów – kliknij wiersz, aby wybrać">
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key
              const Icon = !active ? IconArrowsSort : sort.dir === 'asc' ? IconArrowUp : IconArrowDown
              return (
                <th key={c.key} scope="col" className={c.className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className={`ag-th-btn ${c.align === 'right' ? 'justify-end' : ''}`} data-active={active || undefined} onClick={() => toggle(c.key)} title={`Sortuj: ${c.title}`}>
                    {c.label}
                    <Icon className="size-3 shrink-0" aria-hidden="true" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => {
            const sel = a.id === selectedId
            const st = STATUS_META[a.status]
            const col = statusHex(a.status, accent)
            return (
              <tr
                key={a.id}
                data-agent={a.id}
                tabIndex={0}
                aria-selected={sel}
                data-selected={sel || undefined}
                onClick={() => onSelect(a.id)}
                onKeyDown={(e) => onRowKey(e, i, a.id)}
              >
                <td>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="ag-row-mark" style={{ background: col, color: col }} aria-hidden="true" />
                    <span className="ag-name font-head font-semibold tracking-wider text-[0.78rem] text-jx-text shrink-0">{a.name}</span>
                    <span className="jx-label text-[0.56rem] normal-case tracking-wide truncate min-w-0">{a.role}</span>
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 jx-label text-[0.6rem]" style={{ color: st.css }}>
                    <StatusDot tone={DOT_TONE[a.status]} pulse={st.pulse && !reduced} />
                    {st.short}
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="ag-loadbar flex-1" aria-hidden="true">
                      <span style={{ width: `${Math.round(a.load * 100)}%`, background: col, color: col }} />
                    </span>
                    <span className="jx-num text-[0.7rem] w-8 text-right">{fmtPct(a.load)}</span>
                  </span>
                </td>
                <td className={`text-right jx-num ${a.latencyMs >= 800 ? 'text-jx-danger' : a.latencyMs >= 500 ? 'text-jx-warn' : ''}`}>{fmtInt(a.latencyMs)}</td>
                <td className="text-right jx-num">{fmtInt(a.tokensPerMin)}</td>
                <td className={`text-right jx-num ${a.successRate < 0.85 ? 'text-jx-danger' : a.successRate < 0.95 ? 'text-jx-warn' : 'text-jx-ok'}`}>{fmtPct1(a.successRate)}</td>
                <td className={`text-right jx-num ${a.queue >= 3 ? 'text-jx-warn' : ''}`}>{a.queue}</td>
              </tr>
            )
          })}
          {!rows.length && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-6">
                <span className="jx-label jx-caret">Brak agentów w migawce</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  )
}
