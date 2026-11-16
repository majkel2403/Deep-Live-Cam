/**
 * "Rozruch" view: replays the boot sequence inline, explains each layer on a timeline chart
 * (driven by the same numbers as the GSAP timeline) and lets you scrub, slow down or launch the
 * real full-screen overlay.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { IconMaximize, IconPlayerPause, IconPlayerPlay, IconPower, IconRefresh, IconStack2, IconAccessible, IconVolume } from '@tabler/icons-react'
import { HudButton, Panel, StatusDot } from '@/hud'
import { useReducedMotion, useSettings } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { BootStage, type BootStageApi } from './BootStage'
import { BootSequence } from './BootSequence'
import { BOOT_LAYERS, BOOT_MAIN_END, BOOT_TOTAL } from './layers'

const SPEEDS = [0.5, 1] as const

/** Panel header titles are `leading-none truncate`; a taller inline box keeps Ś/Ć/Ź accents unclipped. */
const PanelTitle = ({ children }: { children: ReactNode }) => <span className="inline-block leading-[1.25]">{children}</span>
const fmt = (s: number) => s.toFixed(2).replace('.', ',')

export default function BootView() {
  const [run, setRun] = useState(0)
  const [speed, setSpeed] = useState<number>(1)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [overlay, setOverlay] = useState(false)
  const [previewReduced, setPreviewReduced] = useState(false)
  const reducedPref = useReducedMotion()
  const bootSeen = useSettings((s) => s.bootSeen)
  const setSettings = useSettings((s) => s.set)

  const api = useRef<BootStageApi>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const scrubRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef('')

  const onProgress = useCallback((t: number) => {
    chartRef.current?.style.setProperty('--jxb-t', String(Math.min(1, t / BOOT_TOTAL)))
    const scrub = scrubRef.current
    if (scrub && document.activeElement !== scrub) scrub.value = String(t)
    if (timeRef.current) timeRef.current.textContent = fmt(t)
    // highlight layers that are running at t (DOM writes only when the set changes)
    const active = BOOT_LAYERS.filter((l) => !l.overlayOnly && t >= l.at && t < l.at + l.dur)
      .map((l) => l.id)
      .join(',')
    if (active === activeRef.current) return
    activeRef.current = active
    const on = new Set(active.split(','))
    for (const host of [chartRef.current, listRef.current]) {
      host?.querySelectorAll<HTMLElement>('[data-layer]').forEach((el) => {
        if (on.has(el.dataset.layer!)) el.setAttribute('data-active', '')
        else el.removeAttribute('data-active')
      })
    }
  }, [])

  const replay = () => {
    activeRef.current = ''
    setFinished(false)
    setPaused(false)
    setRun((r) => r + 1)
  }

  useEffect(() => {
    onProgress(0)
  }, [run, onProgress])

  const reducedNow = previewReduced || reducedPref

  return (
    <div className="h-full min-h-0 overflow-y-auto xl:overflow-hidden grid gap-3 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Panel
        title="Sekwencja rozruchu"
        icon={<IconPower />}
        code={<span className="hidden md:inline">BOOT · GSAP 3</span>}
        className="min-h-[640px] xl:min-h-0"
        bodyClassName="flex flex-col"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <HudButton size="sm" icon={<IconRefresh />} onClick={replay} aria-label="Odtwórz ponownie">
              <span className="hidden sm:inline">Od nowa</span>
            </HudButton>
            <HudButton
              size="sm"
              icon={paused || finished ? <IconPlayerPlay /> : <IconPlayerPause />}
              disabled={reducedNow}
              onClick={() => {
                if (finished) return replay()
                if (paused) api.current?.play()
                else api.current?.pause()
              }}
              aria-label={paused || finished ? 'Wznów' : 'Wstrzymaj'}
            />
            <span className="hidden sm:contents">
              {SPEEDS.map((s) => (
                <HudButton key={s} size="sm" active={speed === s} onClick={() => setSpeed(s)} aria-label={`Tempo ${s}×`}>
                  <span className="jx-num">{String(s).replace('.', ',')}×</span>
                </HudButton>
              ))}
            </span>
            <HudButton
              size="sm"
              icon={<IconMaximize />}
              onClick={() => {
                playBleep('open')
                setOverlay(true)
              }}
            >
              <span className="hidden sm:inline">Pełny ekran</span>
            </HudButton>
          </div>
        }
      >
        <div className="relative flex-1 min-h-[340px] m-2 mb-0 border border-jx-line/60 overflow-hidden">
          <BootStage
            key={`${run}-${previewReduced}`}
            mode="inline"
            speed={speed}
            reduced={previewReduced ? true : undefined}
            apiRef={api}
            onProgress={onProgress}
            onPausedChange={setPaused}
            onDone={() => setFinished(true)}
          />
        </div>

        <Timeline
          chartRef={chartRef}
          scrubRef={scrubRef}
          timeRef={timeRef}
          disabled={reducedNow}
          onScrub={(t) => api.current?.seek(t)}
          state={
            <span className="inline-flex items-center gap-1.5" role="status">
              <StatusDot tone={finished ? 'ok' : paused ? 'warn' : 'accent'} pulse={!finished && !paused} />
              <span className="jx-label text-[0.62rem] hidden sm:inline">{finished ? 'Zakończono' : paused ? 'Wstrzymano' : reducedNow ? 'Ograniczony ruch' : 'Odtwarzanie'}</span>
            </span>
          }
        />
      </Panel>

      <div className="flex flex-col gap-3 min-h-0">
        <Panel title="Warstwy" icon={<IconStack2 />} code={`${BOOT_LAYERS.length} · ${fmt(BOOT_TOTAL)} s`} className="xl:flex-1 xl:min-h-0" bodyClassName="overflow-y-auto">
          <ol ref={listRef} className="flex flex-col p-2 gap-1" aria-label="Warstwy sekwencji rozruchu">
            {BOOT_LAYERS.map((l, i) => (
              <li
                key={l.id}
                data-layer={l.id}
                className="group relative pl-3 pr-2 py-1.5 border-l-2 border-jx-line/40 data-[active]:border-jx-accent data-[active]:bg-jx-accent/10"
              >
                <div className="flex items-baseline gap-2">
                  <span className="jx-num text-[0.65rem] text-jx-dim">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-head font-semibold uppercase tracking-wider text-[0.8rem] text-jx-text group-data-[active]:text-jx-accent">{l.name}</span>
                  <span className="flex-1" />
                  <span className="jx-num text-[0.65rem] text-jx-dim">
                    {fmt(l.at)}–{fmt(l.at + l.dur)} s
                  </span>
                </div>
                <p className="text-[0.74rem] leading-snug text-jx-dim mt-0.5">{l.desc}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {l.tech.map((t) => (
                    <span key={t} className="jx-num text-[0.6rem] px-1.5 py-px border border-jx-line/70 text-jx-accent">
                      {t}
                    </span>
                  ))}
                  {l.sound && (
                    <span className="jx-num text-[0.6rem] px-1.5 py-px border border-jx-ok/40 text-jx-ok inline-flex items-center gap-1">
                      <IconVolume className="size-3" aria-hidden="true" />
                      {l.sound}
                    </span>
                  )}
                  {l.overlayOnly && <span className="jx-num text-[0.6rem] px-1.5 py-px border border-jx-warn/40 text-jx-warn">tylko pełny ekran</span>}
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={<PanelTitle>Zachowanie i dostępność</PanelTitle>} icon={<IconAccessible />} className="shrink-0" bodyClassName="p-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            <HudButton size="sm" active={!bootSeen} onClick={() => setSettings({ bootSeen: !bootSeen })}>
              Rozruch przy starcie: {bootSeen ? 'wył.' : 'wł.'}
            </HudButton>
            <HudButton size="sm" active={previewReduced} onClick={() => setPreviewReduced((v) => !v)}>
              Podgląd: ograniczony ruch
            </HudButton>
          </div>
          <ul className="text-[0.76rem] leading-snug text-jx-dim flex flex-col gap-1 list-none">
            <li>
              <b className="text-jx-text font-semibold">Pominięcie:</b> przycisk „Pomiń”, <kbd className="jx-num text-jx-accent">Esc</kbd>, <kbd className="jx-num text-jx-accent">Enter</kbd>, spacja lub kliknięcie w dowolnym miejscu.
            </li>
            <li>
              <b className="text-jx-text font-semibold">Ograniczony ruch:</b> bez choreografii — ostatnia klatka i krótkie wygaszenie (ok. 1,3 s).
              {reducedPref && <span className="text-jx-warn"> Aktywny teraz (ustawienie systemu lub aplikacji).</span>}
            </li>
            <li>
              <b className="text-jx-text font-semibold">Dźwięk:</b> <span className="jx-num">boot</span>, <span className="jx-num">type</span>, <span className="jx-num">success</span> przez <span className="jx-num">playBleep()</span> — respektują wyciszenie; przed pierwszą interakcją przeglądarka może je zablokować.
            </li>
            <li>
              <b className="text-jx-text font-semibold">Bezpieczeństwo:</b> moduł GSAP ładuje się leniwie, a bezpiecznik kończy nakładkę najpóźniej po {fmt(BOOT_TOTAL + 6)} s, nawet w uśpionej karcie.
            </li>
          </ul>
        </Panel>
      </div>

      {overlay && <BootSequence onDone={() => setOverlay(false)} />}
    </div>
  )
}

function Timeline({
  chartRef,
  scrubRef,
  timeRef,
  disabled,
  onScrub,
  state,
}: {
  chartRef: RefObject<HTMLDivElement | null>
  scrubRef: RefObject<HTMLInputElement | null>
  timeRef: RefObject<HTMLSpanElement | null>
  disabled: boolean
  onScrub: (t: number) => void
  state: ReactNode
}) {
  const ticks = Array.from({ length: Math.floor(BOOT_TOTAL) + 1 }, (_, i) => i)
  return (
    <div className="px-2 pt-2 pb-2 shrink-0">
      <div ref={chartRef} className="relative" style={{ ['--jxb-t' as string]: '0' }} role="img" aria-label="Oś czasu warstw sekwencji rozruchu">
        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-2">
          {BOOT_LAYERS.map((l) => (
            <div key={l.id} className="contents">
              <span data-layer={l.id} className="jx-label text-[0.62rem] leading-[18px] truncate data-[active]:text-jx-accent">
                {l.name}
              </span>
              <div className="relative h-[18px] border-b border-jx-line/20">
                <div
                  data-layer={l.id}
                  className={`absolute top-[3px] bottom-[3px] flex items-center px-1.5 overflow-hidden border ${
                    l.overlayOnly
                      ? 'border-jx-warn/50 bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_srgb,var(--jx-warn)_25%,transparent)_4px_6px)]'
                      : 'border-jx-accent/60 bg-jx-accent/15 data-[active]:bg-jx-accent/45 data-[active]:shadow-[0_0_10px_var(--jx-accent)]'
                  }`}
                  style={{ left: `${(l.at / BOOT_TOTAL) * 100}%`, width: `${(l.dur / BOOT_TOTAL) * 100}%` }}
                >
                  <span className="jx-num text-[0.58rem] text-jx-text/80 truncate">{l.tech[0]}</span>
                </div>
              </div>
            </div>
          ))}
          <span />
          <div className="relative h-4">
            {ticks.map((s) => (
              <span key={s} className="absolute top-0 jx-num text-[0.58rem] text-jx-dim -translate-x-1/2" style={{ left: `${(s / BOOT_TOTAL) * 100}%` }}>
                {s} s
              </span>
            ))}
          </div>
        </div>
        {/* playhead (position from --jxb-t, written by BootStage progress callbacks) */}
        <div className="pointer-events-none absolute top-0 bottom-4 left-[120px] right-0">
          <div className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_8px_var(--jx-accent)]" style={{ left: 'calc(var(--jxb-t) * 100%)' }} />
        </div>
      </div>
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-2 items-center mt-1">
        <span className="jx-label text-[0.62rem]">
          T+<span ref={timeRef} className="jx-num text-jx-accent">0,00</span> s
        </span>
        <div className="relative flex items-center min-w-0">
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={BOOT_MAIN_END}
          step={0.01}
          defaultValue={0}
          disabled={disabled}
          aria-label="Przewijanie osi czasu sekwencji (wstrzymuje odtwarzanie)"
          className="w-full accent-[var(--jx-accent)] disabled:opacity-40"
          style={{ width: `${(BOOT_MAIN_END / BOOT_TOTAL) * 100}%` }}
          onInput={(e) => onScrub(Number((e.target as HTMLInputElement).value))}
        />
        <span className="absolute right-0">{state}</span>
        </div>
      </div>
    </div>
  )
}
