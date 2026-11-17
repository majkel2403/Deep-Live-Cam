import { useMemo, useState } from 'react'
import IconFilterOff from '@tabler/icons-react/icons/IconFilterOff'
import IconScale from '@tabler/icons-react/icons/IconScale'
import IconSearch from '@tabler/icons-react/icons/IconSearch'
import IconShieldCheck from '@tabler/icons-react/icons/IconShieldCheck'
import IconListDetails from '@tabler/icons-react/icons/IconListDetails'
import { Decipher, Frame, HudButton, Panel, SegBar } from '@/hud'
import { FX } from '@/fx/registry'
import { playBleep } from '@/lib/sound'
import {
  CATEGORY_LABELS,
  FLAG_INFO,
  RESOURCES,
  USAGE_INFO,
  type LicenseFlag,
  type Resource,
  type ResourceCategory,
  type Usage,
} from '@/data/resources'
import { ExtLink, FlagTag, SectionHead, Tag, UsageTag, WhereChips } from './common'
import { hostOf, linkedEffects } from './utils'

const CATS = Object.keys(CATEGORY_LABELS) as ResourceCategory[]
const FLAGS: LicenseFlag[] = ['ok', 'care', 'avoid']
const USAGES: Usage[] = ['code', 'reference', 'excluded']

function fold(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
}

/** Key caveats surfaced in the legend (Polish). */
const CAVEATS: { title: string; text: string; tone: 'warn' | 'danger' | 'accent' }[] = [
  { title: 'React Bits', text: 'MIT + Commons Clause: porty wolno używać w produkcie, nie wolno sprzedawać samych komponentów.', tone: 'warn' },
  { title: 'game-icons.net', text: 'CC BY 3.0 – podpis autorów przy ikonach i w LICENSES.md jest obowiązkowy.', tone: 'warn' },
  { title: 'GSAP', text: 'Licencja standardowa Webflow: darmowa (z wtyczkami), ale nie open source.', tone: 'warn' },
  { title: 'Vanta.js', text: 'Działa tylko ze starym three@0.134 – osobna kopia pod aliasem three-vanta.', tone: 'accent' },
  { title: 'ARWES', text: 'Nieutrzymywany, React 18 – tylko pakiety vanilla + alias motion@10.', tone: 'accent' },
  { title: 'Theatre.js', text: 'Używamy tylko core (Apache-2.0); studio jest na AGPL-3.0.', tone: 'accent' },
  { title: 'LYGIA · Shadertoy · eDEX-UI', text: 'Licencje niekomercyjne lub GPL – zero kopiowanego kodu.', tone: 'danger' },
]

function StatTile({ label, value, sub, tone = 'text-jx-accent' }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div data-augmented-ui="tl-clip br-clip border" className="jx-aug px-3 py-2 min-w-0 [will-change:transform]">
      <div className="jx-label text-[0.625rem] truncate">{label}</div>
      <div className={`jx-num text-2xl leading-tight jx-glow-text ${tone}`}>{value}</div>
      {sub && <div className="text-[0.66rem] text-jx-dim truncate">{sub}</div>}
    </div>
  )
}

export function LedgerTab() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ResourceCategory | 'all'>('all')
  const [flag, setFlag] = useState<LicenseFlag | 'all'>('all')
  const [usage, setUsage] = useState<Usage | 'all'>('all')
  const [selId, setSelId] = useState<string>('arwes')

  const effectsById = useMemo(() => new Map(RESOURCES.map((r) => [r.id, linkedEffects(r)])), [])

  const stats = useMemo(() => {
    const by = <K extends string>(key: (r: Resource) => K) => RESOURCES.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<K, number>())
    const usedFx = new Set<string>()
    effectsById.forEach((list) => list.forEach((f) => usedFx.add(f.id)))
    return {
      usage: by((r) => r.usage),
      flag: by((r) => r.licenseFlag),
      cat: by((r) => r.category),
      report: RESOURCES.filter((r) => !r.extra).length,
      extra: RESOURCES.filter((r) => r.extra).length,
      fxCovered: usedFx.size,
    }
  }, [effectsById])

  const list = useMemo(() => {
    const needle = fold(q.trim())
    return RESOURCES.filter(
      (r) =>
        (cat === 'all' || r.category === cat) &&
        (flag === 'all' || r.licenseFlag === flag) &&
        (usage === 'all' || r.usage === usage) &&
        (!needle || fold([r.name, r.license, r.note, r.url, ...(r.pkg ?? []), CATEGORY_LABELS[r.category]].join(' ')).includes(needle)),
    )
  }, [q, cat, flag, usage])

  const sel = RESOURCES.find((r) => r.id === selId) ?? RESOURCES[0]
  const selFx = effectsById.get(sel.id) ?? []
  const filtered = q || cat !== 'all' || flag !== 'all' || usage !== 'all'
  const total = RESOURCES.length

  const pick = (id: string) => {
    playBleep('click')
    setSelId(id)
  }

  return (
    // below xl the whole tab scrolls (table gets a fixed viewport height); on xl it is a fixed two-column layout
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-y-auto xl:overflow-visible">
      {/* counters */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={USAGE_INFO.code.label} value={stats.usage.get('code') ?? 0} sub="pakiet lub port w aplikacji" />
        <StatTile label={USAGE_INFO.reference.label} value={stats.usage.get('reference') ?? 0} sub="inspiracja, bez kodu" tone="text-[var(--jx-violet)]" />
        <StatTile label={USAGE_INFO.excluded.label} value={stats.usage.get('excluded') ?? 0} sub="świadomie pominięte" tone="text-jx-dim" />
        <StatTile label="Efekty powiązane" value={`${stats.fxCovered}/${FX.length}`} sub="z meta.ts w galerii" />
        <div data-augmented-ui="tl-clip br-clip border" className="jx-aug px-3 py-2 col-span-2 flex flex-col justify-between gap-1 [will-change:transform]">
          <div className="flex items-center justify-between">
            <span className="jx-label text-[0.625rem]">Flagi licencji</span>
            <span className="jx-num text-[0.625rem] text-jx-dim">
              raport {stats.report} · dodatkowe {stats.extra}
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden border border-jx-line/50" role="img" aria-label={`Licencje: ${stats.flag.get('ok') ?? 0} bezpiecznych, ${stats.flag.get('care') ?? 0} z warunkami, ${stats.flag.get('avoid') ?? 0} do unikania`}>
            <span className="bg-jx-ok/80" style={{ width: `${((stats.flag.get('ok') ?? 0) / total) * 100}%` }} />
            <span className="bg-jx-warn/80" style={{ width: `${((stats.flag.get('care') ?? 0) / total) * 100}%` }} />
            <span className="bg-jx-danger/80" style={{ width: `${((stats.flag.get('avoid') ?? 0) / total) * 100}%` }} />
          </div>
          <div className="flex gap-3 jx-num text-[0.68rem]">
            <span className="text-jx-ok">OK {stats.flag.get('ok') ?? 0}</span>
            <span className="text-jx-warn">UWAGA {stats.flag.get('care') ?? 0}</span>
            <span className="text-jx-danger">STOP {stats.flag.get('avoid') ?? 0}</span>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="jx-frame-host flex items-center gap-2 px-3 py-1.5 w-full sm:w-72">
            <Frame kind="underline" enter={false} />
            <IconSearch size={14} className="text-jx-accent shrink-0" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj: MIT, shader, ikony…"
              className="bg-transparent text-sm flex-1 min-w-0 placeholder:text-jx-dim"
              aria-label="Szukaj zasobu"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtr flagi licencji">
            {FLAGS.map((f) => (
              <HudButton key={f} size="sm" active={flag === f} onClick={() => setFlag(flag === f ? 'all' : f)} title={FLAG_INFO[f].text}>
                <span className={FLAG_INFO[f].tone.split(' ')[0]}>●</span> {FLAG_INFO[f].label} <span className="jx-num text-jx-dim">{stats.flag.get(f) ?? 0}</span>
              </HudButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtr sposobu użycia">
            {USAGES.map((u) => (
              <HudButton key={u} size="sm" active={usage === u} onClick={() => setUsage(usage === u ? 'all' : u)} title={USAGE_INFO[u].text}>
                {USAGE_INFO[u].label} <span className="jx-num text-jx-dim">{stats.usage.get(u) ?? 0}</span>
              </HudButton>
            ))}
          </div>
          <span className="flex-1" />
          {filtered && (
            <HudButton
              size="sm"
              icon={<IconFilterOff />}
              onClick={() => {
                setQ('')
                setCat('all')
                setFlag('all')
                setUsage('all')
              }}
            >
              Wyczyść
            </HudButton>
          )}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtr kategorii">
          <HudButton size="sm" active={cat === 'all'} onClick={() => setCat('all')}>
            Wszystkie <span className="jx-num text-jx-dim">{total}</span>
          </HudButton>
          {CATS.filter((c) => stats.cat.get(c)).map((c) => (
            <HudButton key={c} size="sm" className="shrink-0" active={cat === c} onClick={() => setCat(cat === c ? 'all' : c)}>
              {CATEGORY_LABELS[c]} <span className="jx-num text-jx-dim">{stats.cat.get(c)}</span>
            </HudButton>
          ))}
        </div>
      </div>

      {/* table + details */}
      <div className="grid gap-3 shrink-0 xl:shrink xl:flex-1 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Rejestr zasobów" icon={<IconListDetails />} code={`${list.length}/${total}`} className="h-[72vh] min-h-[320px] xl:h-auto xl:min-h-0" bodyClassName="overflow-auto">
          <table className="w-full text-left border-collapse text-[0.8rem]">
            <caption className="sr-only">Zasoby z raportu badawczego: licencja, flaga i sposób użycia w aplikacji</caption>
            <thead className="sticky top-0 z-10 bg-jx-panel-solid/95">
              <tr className="jx-label text-[0.625rem] [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold border-b border-jx-line/60">
                <th scope="col">Zasób</th>
                <th scope="col" className="hidden lg:table-cell">
                  Kategoria
                </th>
                <th scope="col">Licencja</th>
                <th scope="col">Użycie</th>
                <th scope="col" className="hidden md:table-cell">
                  Gdzie
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const fx = effectsById.get(r.id) ?? []
                const selected = r.id === sel.id
                return (
                  <tr
                    key={r.id}
                    data-selected={selected ? 'true' : undefined}
                    className={`border-b border-jx-line/25 align-top transition-colors ${selected ? 'bg-jx-accent/12 shadow-[inset_2px_0_0_var(--jx-accent)]' : 'hover:bg-jx-accent/5'}`}
                    onClick={() => pick(r.id)}
                  >
                    <td className="px-2 py-1.5 min-w-[11rem]">
                      <button type="button" className="text-left cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-jx-accent" onClick={(e) => {
                          e.stopPropagation()
                          pick(r.id)
                        }}
                        aria-current={selected ? 'true' : undefined}
                        aria-label={`Szczegóły: ${r.name}`}
                      >
                        <span className={`font-head font-semibold tracking-wide ${selected ? 'text-white' : 'text-jx-text'}`}>{r.name}</span>
                        {r.extra && <span className="ml-1.5 jx-num text-[0.625rem] text-jx-dim align-middle">+DOD.</span>}
                        <span className="block jx-num text-[0.625rem] text-jx-dim truncate max-w-[16rem]">{hostOf(r.url)}</span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5 hidden lg:table-cell text-jx-dim text-[0.74rem] whitespace-nowrap">{CATEGORY_LABELS[r.category]}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5 items-start">
                        <FlagTag flag={r.licenseFlag} />
                        <span className="text-[0.72rem] text-jx-text/90 leading-tight max-w-[14rem]">{r.license}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <UsageTag usage={r.usage} />
                    </td>
                    <td className="px-2 py-1.5 hidden md:table-cell max-w-[20rem]">
                      {r.where.some((w) => !w.startsWith('code:')) || fx.length ? <WhereChips r={r} effects={fx} compact /> : <span className="text-jx-dim text-[0.7rem]">{r.usage === 'code' ? 'infrastruktura' : '—'}</span>}
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center jx-label">
                    Brak zasobów dla tych filtrów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <div className="min-h-0 flex flex-col gap-3 xl:overflow-y-auto">
          <Panel title="Szczegóły" icon={<IconScale />} code={sel.id.toUpperCase().slice(0, 14)} className="shrink-0" bodyClassName="p-3 flex flex-col gap-2.5">
            <div className="flex flex-col items-start gap-0.5">
              <Decipher as="h4" text={sel.name} replayKey={sel.id} className="text-[0.95rem] leading-tight text-jx-accent jx-glow-text tracking-[0.12em] uppercase font-[family-name:var(--jx-font-cmd)]" />
              <ExtLink href={sel.url} className="jx-num text-[0.68rem] text-jx-dim break-all">
                {sel.url.replace(/^https?:\/\//, '')}
              </ExtLink>
            </div>
            <div className="flex flex-wrap gap-1">
              <FlagTag flag={sel.licenseFlag} />
              <UsageTag usage={sel.usage} />
              <Tag className="text-jx-dim border-jx-line">{CATEGORY_LABELS[sel.category]}</Tag>
              {sel.extra && <Tag className="text-jx-dim border-jx-line border-dashed">spoza raportu</Tag>}
            </div>
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5 text-[0.78rem]">
              <dt className="jx-label text-[0.625rem] pt-0.5">Licencja</dt>
              <dd className="text-jx-text">{sel.license}</dd>
              {sel.verified && (
                <>
                  <dt className="jx-label text-[0.625rem] pt-0.5">Weryfikacja</dt>
                  <dd className="text-jx-ok/90 text-[0.72rem] flex gap-1">
                    <IconShieldCheck className="size-3.5 shrink-0 mt-px" aria-hidden="true" />
                    {sel.verified}
                  </dd>
                </>
              )}
              {sel.pkg && (
                <>
                  <dt className="jx-label text-[0.625rem] pt-0.5">Pakiety</dt>
                  <dd className="flex flex-wrap gap-1">
                    {sel.pkg.map((p) => (
                      <code key={p} className="jx-num text-[0.64rem] text-jx-accent bg-jx-accent/8 px-1">
                        {p}
                      </code>
                    ))}
                  </dd>
                </>
              )}
              <dt className="jx-label text-[0.625rem] pt-0.5">Notatka</dt>
              <dd className="text-jx-text/90 leading-snug">{sel.note}</dd>
            </dl>
            {(sel.where.length > 0 || selFx.length > 0) && (
              <div>
                <SectionHead meta={selFx.length ? `${selFx.length} FX` : undefined}>Gdzie w aplikacji</SectionHead>
                <WhereChips r={sel} effects={selFx} />
              </div>
            )}
          </Panel>

          <Panel title="Legenda" code="LIC" className="shrink-0" bodyClassName="p-3 flex flex-col gap-2.5 text-[0.76rem]">
            <ul className="flex flex-col gap-1.5">
              {FLAGS.map((f) => (
                <li key={f} className="grid grid-cols-[5.6rem_1fr] gap-2 items-start">
                  <FlagTag flag={f} />
                  <span className="text-jx-text/85 leading-snug">{FLAG_INFO[f].text}</span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-1.5 border-t border-jx-line/40 pt-2">
              {USAGES.map((u) => (
                <li key={u} className="grid grid-cols-[5.6rem_1fr] gap-2 items-start">
                  <UsageTag usage={u} />
                  <span className="text-jx-text/85 leading-snug">{USAGE_INFO[u].text}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-jx-line/40 pt-2">
              <SectionHead>Zastrzeżenia</SectionHead>
              <ul className="flex flex-col gap-1.5">
                {CAVEATS.map((c) => (
                  <li key={c.title} className="leading-snug">
                    <span className={`font-head font-semibold ${c.tone === 'warn' ? 'text-jx-warn' : c.tone === 'danger' ? 'text-jx-danger' : 'text-jx-accent'}`}>{c.title}:</span> <span className="text-jx-text/85">{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-jx-line/40 pt-2">
              <div className="jx-label text-[0.625rem] mb-1">Udział zasobów w kodzie</div>
              <SegBar value={(stats.usage.get('code') ?? 0) / total} segments={24} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
