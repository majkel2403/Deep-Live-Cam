import { useMemo, useState, type KeyboardEvent } from 'react'
import IconArrowDown from '@tabler/icons-react/icons/IconArrowDown'
import IconArrowUp from '@tabler/icons-react/icons/IconArrowUp'
import IconArrowsSort from '@tabler/icons-react/icons/IconArrowsSort'
import IconUsersGroup from '@tabler/icons-react/icons/IconUsersGroup'
import { Decipher, Panel, StatusDot } from '@/hud'
import type { Agent } from '@/lib/agents'
import { STATUS_META, fmtInt, fmtPct, fmtPct1, sortAgents, statusHex, type SortKey, type SortState } from './model'

/** `narrow` columns are dropped on phones (< 640 px) instead of forcing a sideways scroll */
const COLUMNS: { key: SortKey; label: string; title: string; align: 'left' | 'right'; className?: string; narrow?: false }[] = [
  { key: 'name', label: 'Agent', title: 'Nazwa i rola', align: 'left', className: 'w-[36%] sm:w-[30%]' },
  { key: 'status', label: 'Status', title: 'Stan bieżący (błędy na górze)', align: 'left', className: 'w-[22%] sm:w-auto' },
  { key: 'load', label: 'Obciąż.', title: 'Wykorzystanie 0–100%', align: 'left', className: 'w-[26%] sm:w-[18%]' },
  { key: 'latencyMs', label: 'Lat. ms', title: 'Latencja odpowiedzi', align: 'right', narrow: false },
  { key: 'tokensPerMin', label: 'Tok/min', title: 'Przepustowość tokenów', align: 'right', narrow: false },
  { key: 'successRate', label: 'Skut.', title: 'Odsetek udanych kroków', align: 'right' },
  { key: 'queue', label: 'Kol.', title: 'Zadania w kolejce', align: 'right', narrow: false },
]
const hideNarrow = (c: { narrow?: false }) => (c.narrow === false ? 'max-sm:hidden' : '')

const DOT_TONE = { running: 'ok', thinking: 'accent', waiting: 'warn', idle: 'accent', error: 'danger', offline: 'dim' } as const

export interface RosterTableProps {
  agents: Agent[]
  selectedId: string | null
  onSelect: (id: string) => void
  accent: string
  reduced: boolean
  /** shown instead of "no agents" while there is no snapshot at all (connecting / link error) */
  emptyHint?: string
  className?: string
}

/**
 * Sortable roster of every agent; rows are keyboard-selectable (Enter / Space, ↑ ↓).
 * Roving tabindex: the table is a single Tab stop (the selected row), arrows move between rows.
 */
export function RosterTable({ agents, selectedId, onSelect, accent, reduced, emptyHint, className = '' }: RosterTableProps) {
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
      <table className="ag-table w-full sm:min-w-[620px] text-left" aria-label="Rejestr agentów – kliknij wiersz, aby wybrać">
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key
              const Icon = !active ? IconArrowsSort : sort.dir === 'asc' ? IconArrowUp : IconArrowDown
              return (
                <th key={c.key} scope="col" className={`${c.className ?? ''} ${hideNarrow(c)}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
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
            const tabStop = selectedId && rows.some((r) => r.id === selectedId) ? sel : i === 0
            const st = STATUS_META[a.status]
            const col = statusHex(a.status, accent)
            return (
              <tr
                key={a.id}
                data-agent={a.id}
                tabIndex={tabStop ? 0 : -1}
                aria-current={sel ? 'true' : undefined}
                data-selected={sel || undefined}
                onClick={() => onSelect(a.id)}
                onKeyDown={(e) => onRowKey(e, i, a.id)}
              >
                <td>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="ag-row-mark" style={{ background: col, color: col }} aria-hidden="true" />
                    <span className="ag-name font-head font-semibold tracking-wider text-[0.78rem] text-jx-text shrink-0">{a.name}</span>
                    <span className="jx-label text-[0.625rem] normal-case tracking-wide truncate min-w-0">{a.role}</span>
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 jx-label text-[0.625rem]" style={{ color: st.css }}>
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
                <td className={`max-sm:hidden text-right jx-num ${a.latencyMs >= 800 ? 'text-jx-danger' : a.latencyMs >= 500 ? 'text-jx-warn' : ''}`}>{fmtInt(a.latencyMs)}</td>
                <td className="max-sm:hidden text-right jx-num">{fmtInt(a.tokensPerMin)}</td>
                <td className={`text-right jx-num ${a.successRate < 0.85 ? 'text-jx-danger' : a.successRate < 0.95 ? 'text-jx-warn' : 'text-jx-ok'}`}>{fmtPct1(a.successRate)}</td>
                <td className={`max-sm:hidden text-right jx-num ${a.queue >= 3 ? 'text-jx-warn' : ''}`}>{a.queue}</td>
              </tr>
            )
          })}
          {!rows.length && (
            <tr>
              <td colSpan={COLUMNS.length} className="text-center py-6">
                <span className="jx-label jx-caret">{emptyHint ?? 'Brak agentów w migawce'}</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  )
}
