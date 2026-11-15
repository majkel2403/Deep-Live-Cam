import type { ReactNode } from 'react'
import { IconActivityHeartbeat, IconBattery2, IconBatteryCharging, IconCpu, IconWifi, IconWifiOff, IconClockHour4, IconPlugConnected } from '@tabler/icons-react'
import { Panel, SegBar, StatusDot } from '@/hud'
import { useAccent } from '@/lib/store'
import { ND, fmtDuration, useTelemetry, type TelemetrySnapshot } from '@/lib/telemetry'
import { EGauge } from './EGauge'
import { Sparkline } from './Sparkline'
import { LiveBadge } from './DemoBadge'

const WARN = '#ffb000'
const DANGER = '#ff3b5c'

function Row({ k, v, tone, title }: { k: ReactNode; v: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'dim'; title?: string }) {
  const color = tone ? { ok: 'text-jx-ok', warn: 'text-jx-warn', danger: 'text-jx-danger', dim: 'text-jx-dim' }[tone] : 'text-jx-text'
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0 py-[1px]" title={title}>
      <dt className="jx-label text-[0.6rem] tracking-[0.12em] truncate">{k}</dt>
      <dd className={`jx-num text-[0.72rem] ${color} truncate text-right`}>{v}</dd>
    </div>
  )
}

function Section({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-1.5 mb-0.5 text-jx-accent [&>svg]:size-3.5">
        {icon}
        <span className="jx-label text-[0.62rem] text-jx-accent">{title}</span>
        <span className="flex-1 h-px bg-gradient-to-r from-[var(--jx-line)] to-transparent" />
        {aside}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3">{children}</dl>
    </section>
  )
}

const nd = <span className="text-jx-dim">{ND}</span>

function stats(arr: (number | null)[]) {
  const v = arr.filter((x): x is number => x !== null)
  if (!v.length) return null
  return { min: Math.min(...v), max: Math.max(...v), avg: v.reduce((s, x) => s + x, 0) / v.length }
}

function fmtSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

export function TelemetryPanel({ reducedMotion }: { reducedMotion: boolean }) {
  const t = useTelemetry()
  const { hex } = useAccent()

  const fpsStats = stats(t.history.fps)
  const fpsMax = fpsStats && fpsStats.max > 70 ? 144 : 60
  const fpsColor = t.fps === null ? undefined : t.fps < 24 ? DANGER : t.fps < 45 ? WARN : undefined
  const heapPct = t.heap ? t.heap.usedMB / t.heap.limitMB : null
  const busy = t.longTasks.supported ? t.longTasks.busy : null
  const busyColor = busy === null ? undefined : busy > 0.25 ? DANGER : busy > 0.08 ? WARN : undefined

  return (
    <Panel
      title="Telemetria systemu"
      icon={<IconActivityHeartbeat />}
      className="h-full"
      bodyClassName="overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2 flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between gap-2 shrink-0 -mb-1">
        <span className="jx-label text-[0.56rem] truncate" title="Wszystkie wartości mierzone na żywo w tej przeglądarce, próbkowanie 1 Hz">Pomiar lokalny · 1 Hz</span>
        <LiveBadge />
      </div>
      {/* gauges */}
      <div className="grid grid-cols-3 gap-1 shrink-0">
        {[
          {
            key: 'fps',
            label: 'Klatki',
            node: (
              <EGauge
                value={t.fps}
                max={fpsMax}
                display={t.fps === null ? ND : String(Math.round(t.fps))}
                unit="FPS"
                accent={hex}
                color={fpsColor}
                reducedMotion={reducedMotion}
                ariaLabel="Klatki na sekundę (pomiar requestAnimationFrame)"
              />
            ),
          },
          {
            key: 'heap',
            label: 'Sterta JS',
            node: (
              <EGauge
                value={heapPct === null ? null : heapPct * 100}
                max={100}
                display={t.heap ? `${Math.round(t.heap.usedMB)}` : ND}
                unit="MB"
                accent={hex}
                color={heapPct !== null && heapPct > 0.8 ? DANGER : heapPct !== null && heapPct > 0.6 ? WARN : undefined}
                reducedMotion={reducedMotion}
                ariaLabel="Zajętość sterty JavaScript względem limitu (performance.memory)"
              />
            ),
          },
          {
            key: 'busy',
            label: 'Blokada',
            node: (
              <EGauge
                value={busy === null ? null : busy * 100}
                max={100}
                display={busy === null ? ND : `${(busy * 100).toFixed(busy < 0.1 ? 1 : 0)}`}
                unit="% / 10 s"
                accent={hex}
                color={busyColor}
                reducedMotion={reducedMotion}
                ariaLabel="Udział długich zadań (>50 ms) w czasie wątku głównego w ostatnich 10 sekundach"
              />
            ),
          },
        ].map((g) => (
          <figure key={g.key} className="flex flex-col items-center min-w-0 m-0">
            <div className="w-full aspect-square max-h-[104px]">{g.node}</div>
            <figcaption className="jx-label text-[0.56rem] -mt-1 truncate max-w-full text-center">{g.label}</figcaption>
          </figure>
        ))}
      </div>

      {/* FPS history */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="jx-label text-[0.6rem]">Klatki · 60 s</span>
          <span className="jx-num text-[0.62rem] text-jx-dim">
            {fpsStats ? (
              <>
                min <span className="text-jx-text">{Math.round(fpsStats.min)}</span> · śr <span className="text-jx-text">{Math.round(fpsStats.avg)}</span> · maks{' '}
                <span className="text-jx-text">{Math.round(fpsStats.max)}</span>
              </>
            ) : (
              'zbieranie…'
            )}
          </span>
        </div>
        <Sparkline data={t.history.fps} min={0} max={fpsMax} threshold={30} height={26} ariaLabel="Historia FPS z ostatniej minuty" />
        <div className="flex justify-between jx-num text-[0.6rem] text-jx-dim">
          <span>
            klatka <span className="text-jx-text">{t.frameMs === null ? ND : `${t.frameMs.toFixed(1)} ms`}</span>
          </span>
          <span>
            najgorsza <span className={t.worstFrameMs !== null && t.worstFrameMs > 50 ? 'text-jx-warn' : 'text-jx-text'}>{t.worstFrameMs === null ? ND : `${Math.round(t.worstFrameMs)} ms`}</span>
          </span>
        </div>
      </div>

      {/* heap history */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="jx-label text-[0.6rem]">Sterta JS · 60 s</span>
          <span className="jx-num text-[0.62rem] text-jx-dim">
            {t.heap ? (
              <>
                <span className="text-jx-text">{t.heap.usedMB.toFixed(1)}</span> / {Math.round(t.heap.totalMB)} MB · limit {Math.round(t.heap.limitMB)}
              </>
            ) : (
              'performance.memory: n/d'
            )}
          </span>
        </div>
        {t.heap ? (
          <Sparkline data={t.history.heapMB} height={22} color="var(--jx-accent-2)" ariaLabel="Historia zajętości sterty JS" />
        ) : (
          <p className="jx-label text-[0.58rem] normal-case tracking-normal">API dostępne tylko w przeglądarkach opartych na Chromium.</p>
        )}
      </div>

      <NetworkSection t={t} />
      <PowerSection t={t} />
      <DeviceSection t={t} />
      <SessionSection t={t} />
      <ApiSection t={t} />
    </Panel>
  )
}

function NetworkSection({ t }: { t: TelemetrySnapshot }) {
  const c = t.connection
  return (
    <Section
      title="Sieć"
      icon={t.online ? <IconWifi /> : <IconWifiOff />}
      aside={
        <span className="inline-flex items-center gap-1 jx-label text-[0.58rem]">
          <StatusDot tone={t.online ? 'ok' : 'danger'} pulse={!t.online} />
          {t.online ? 'online' : 'offline'}
        </span>
      }
    >
      <Row k="Typ efekt." v={c?.effectiveType ? c.effectiveType.toUpperCase() : nd} title="navigator.connection.effectiveType" />
      <Row k="Przepływ" v={c?.downlinkMbps != null ? `${c.downlinkMbps} Mb/s` : nd} title="navigator.connection.downlink (szacunek przeglądarki)" />
      <Row k="RTT" v={c?.rttMs != null ? `${c.rttMs} ms` : nd} title="navigator.connection.rtt (szacunek przeglądarki)" />
      <Row k="Oszczędz." v={c?.saveData == null ? nd : c.saveData ? 'TAK' : 'NIE'} title="navigator.connection.saveData" />
    </Section>
  )
}

function PowerSection({ t }: { t: TelemetrySnapshot }) {
  const b = t.battery
  return (
    <Section title="Zasilanie" icon={b?.charging ? <IconBatteryCharging /> : <IconBattery2 />}>
      {b === undefined ? (
        <Row k="Bateria" v="odczyt…" tone="dim" />
      ) : b === null ? (
        <>
          <Row k="Bateria" v={nd} title="Battery Status API niedostępne w tej przeglądarce" />
          <Row k="Stan" v={nd} />
        </>
      ) : (
        <>
          <div className="col-span-2 flex items-center gap-2 py-0.5">
            <div className="flex-1">
              <SegBar value={b.level} segments={20} tone={b.level < 0.15 ? 'danger' : b.level < 0.3 ? 'warn' : 'ok'} />
            </div>
            <span className="jx-num text-[0.72rem] text-jx-text w-10 text-right">{Math.round(b.level * 100)}%</span>
          </div>
          <Row k="Stan" v={b.charging ? 'ładowanie' : 'na baterii'} tone={b.charging ? 'ok' : undefined} />
          <Row k={b.charging ? 'Do pełna' : 'Pozostało'} v={fmtSeconds(b.charging ? b.chargingTime : b.dischargingTime)} />
        </>
      )}
    </Section>
  )
}

function DeviceSection({ t }: { t: TelemetrySnapshot }) {
  return (
    <Section title="Urządzenie" icon={<IconCpu />}>
      <Row k="Wątki CPU" v={t.cores ?? nd} title="navigator.hardwareConcurrency" />
      <Row k="Pamięć" v={t.deviceMemoryGB === null ? nd : `${t.deviceMemoryGB >= 8 ? '≥' : '~'}${t.deviceMemoryGB} GB`} title="navigator.deviceMemory (zaokrąglone przez przeglądarkę)" />
      <Row k="Ekran" v={t.screen ? `${t.screen.w}×${t.screen.h}` : nd} />
      <Row k="Okno" v={`${t.viewport.w}×${t.viewport.h}`} />
      <Row k="DPR" v={`${Number(t.dpr.toFixed(2))}×`} title="window.devicePixelRatio" />
      <Row k="Język" v={t.language ?? nd} />
    </Section>
  )
}

function SessionSection({ t }: { t: TelemetrySnapshot }) {
  const lt = t.longTasks
  const st = t.storage
  return (
    <Section title="Sesja" icon={<IconClockHour4 />}>
      <Row k="Czas pracy" v={fmtDuration(t.uptimeMs)} title="Czas od załadowania strony (performance.now)" />
      <Row k="Karta" v={t.visibility === 'visible' ? 'widoczna' : 'ukryta'} tone={t.visibility === 'visible' ? 'ok' : 'warn'} title="document.visibilityState" />
      <Row k="Dł. zadania" v={lt.supported ? lt.count : nd} tone={lt.count > 20 ? 'warn' : undefined} title="Liczba długich zadań (>50 ms) – PerformanceObserver('longtask')" />
      <Row k="Najdłuższe" v={lt.supported ? (lt.count ? `${Math.round(lt.maxMs)} ms` : '—') : nd} />
      <Row
        k="Magazyn"
        v={st === undefined ? '…' : st === null ? nd : `${st.usageMB < 10 ? st.usageMB.toFixed(1) : Math.round(st.usageMB)} MB`}
        title={st ? `navigator.storage.estimate(): limit ${Math.round(st.quotaMB)} MB` : 'navigator.storage.estimate()'}
      />
      <Row k="Strefa" v={t.timeZone ?? nd} />
    </Section>
  )
}

/** Honest support matrix: which Web APIs actually answered in this browser. */
function ApiSection({ t }: { t: TelemetrySnapshot }) {
  const apis: { k: string; ok: boolean | null; title: string }[] = [
    { k: 'Sterta', ok: t.heap !== null, title: 'performance.memory (niestandardowe, Chromium)' },
    { k: 'Sieć', ok: t.connection !== null, title: 'Network Information API – navigator.connection' },
    { k: 'Bateria', ok: t.battery === undefined ? null : t.battery !== null, title: 'Battery Status API – navigator.getBattery()' },
    { k: 'Dł. zadania', ok: t.longTasks.supported, title: "PerformanceObserver({ type: 'longtask' })" },
    { k: 'Magazyn', ok: t.storage === undefined ? null : t.storage !== null, title: 'StorageManager.estimate()' },
    { k: 'Pamięć urz.', ok: t.deviceMemoryGB !== null, title: 'navigator.deviceMemory' },
  ]
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-1.5 mb-1 text-jx-accent [&>svg]:size-3.5">
        <IconPlugConnected />
        <span className="jx-label text-[0.62rem] text-jx-accent">Interfejsy przeglądarki</span>
        <span className="flex-1 h-px bg-gradient-to-r from-[var(--jx-line)] to-transparent" />
      </h3>
      <ul className="grid grid-cols-3 gap-1 m-0 p-0 list-none">
        {apis.map((a) => (
          <li
            key={a.k}
            title={a.title}
            className={`flex items-center gap-1 px-1.5 py-[2px] border text-[0.56rem] jx-label tracking-[0.08em] truncate ${a.ok ? 'border-[color-mix(in_srgb,var(--jx-ok)_45%,transparent)] text-jx-ok' : 'border-jx-line/40 text-jx-dim'}`}
          >
            <span aria-hidden="true">{a.ok === null ? '…' : a.ok ? '✓' : '×'}</span>
            <span className="truncate">{a.k}</span>
            <span className="bx-sr-only">{a.ok === null ? 'sprawdzanie' : a.ok ? 'dostępne' : 'niedostępne'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
