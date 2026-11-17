import { useLayoutEffect, useRef, useState } from 'react'
import IconCopy from '@tabler/icons-react/icons/IconCopy'
import IconRotate from '@tabler/icons-react/icons/IconRotate'
import { HudButton, SegBar, StatusDot } from '@/hud'
import { DEFAULT_SETTINGS, useAccent, useSettings } from '@/lib/store'
import { playBleep } from '@/lib/sound'
import { SectionHead } from './common'

/** Design tokens from src/styles/tokens.css with their Tailwind bridge utility (global.css @theme). */
const TOKENS: { v: string; tw?: string; desc: string; group: 'surface' | 'accent' | 'text' | 'semantic' }[] = [
  { v: '--jx-bg', tw: 'bg-jx-bg', desc: 'Tło aplikacji', group: 'surface' },
  { v: '--jx-bg-2', tw: 'bg-jx-bg-2', desc: 'Tło drugiego planu', group: 'surface' },
  { v: '--jx-panel', tw: 'bg-jx-panel', desc: 'Panel (półprzezroczysty)', group: 'surface' },
  { v: '--jx-panel-solid', tw: 'bg-jx-panel-solid', desc: 'Panel pełny', group: 'surface' },
  { v: '--jx-panel-hi', desc: 'Panel podświetlony', group: 'surface' },
  { v: '--jx-accent', tw: 'text-jx-accent', desc: 'Akcent główny (z --jx-hue)', group: 'accent' },
  { v: '--jx-accent-2', tw: 'text-jx-accent-2', desc: 'Akcent drugi (+24°)', group: 'accent' },
  { v: '--jx-accent-dim', tw: 'bg-jx-accent-dim', desc: 'Akcent przygaszony', group: 'accent' },
  { v: '--jx-accent-faint', desc: 'Poświata tła, siatka', group: 'accent' },
  { v: '--jx-line', tw: 'border-jx-line', desc: 'Linie i obramowania', group: 'accent' },
  { v: '--jx-line-strong', desc: 'Obramowania aktywne', group: 'accent' },
  { v: '--jx-text', tw: 'text-jx-text', desc: 'Tekst', group: 'text' },
  { v: '--jx-text-dim', tw: 'text-jx-dim', desc: 'Tekst pomocniczy', group: 'text' },
  { v: '--jx-ok', tw: 'text-jx-ok', desc: 'Stan OK', group: 'semantic' },
  { v: '--jx-warn', tw: 'text-jx-warn', desc: 'Ostrzeżenie', group: 'semantic' },
  { v: '--jx-danger', tw: 'text-jx-danger', desc: 'Błąd / zagrożenie', group: 'semantic' },
  { v: '--jx-violet', desc: 'Kolor pomocniczy (referencje)', group: 'semantic' },
]

const PRESETS = [
  { hue: 188, label: 'Cyjan' },
  { hue: 200, label: 'Lazur' },
  { hue: 160, label: 'Szmaragd' },
  { hue: 28, label: 'Bursztyn' },
  { hue: 350, label: 'Karmazyn' },
  { hue: 265, label: 'Fiolet' },
]

type RGBA = [number, number, number, number]

function parseRgb(s: string): RGBA | null {
  // computed colours come back as rgb()/rgba() or color(srgb r g b / a)
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  const c = s.match(/color\(srgb\s+([^)]+)\)/)
  if (c) {
    const p = c[1].split(/[\s/]+/).filter(Boolean).map(Number)
    return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]
  }
  return null
}
const toHex = ([r, g, b]: RGBA) => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`
function lum([r, g, b]: RGBA) {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a: RGBA, b: RGBA) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Resolve every token to a concrete colour by painting it on a probe element (follows --jx-hue). */
function useResolvedTokens(hue: number) {
  const probe = useRef<HTMLSpanElement>(null)
  const [values, setValues] = useState<Record<string, RGBA | null>>({})
  useLayoutEffect(() => {
    const el = probe.current
    if (!el) return
    // wait one frame so App's effect has written the new --jx-hue to :root
    const raf = requestAnimationFrame(() => {
      const out: Record<string, RGBA | null> = {}
      for (const t of TOKENS) {
        el.style.color = `var(${t.v})`
        out[t.v] = parseRgb(getComputedStyle(el).color)
      }
      setValues(out)
    })
    return () => cancelAnimationFrame(raf)
  }, [hue])
  return { probe, values }
}

function ContrastRow({ label, fg, bg }: { label: string; fg?: RGBA | null; bg?: RGBA | null }) {
  if (!fg || !bg) return null
  const r = contrast(fg, bg)
  const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA duży' : 'poniżej AA'
  const tone = r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'danger'
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[0.76rem] py-1 border-b border-jx-line/25">
      <span className="text-jx-text/90">{label}</span>
      <span className="jx-num text-jx-accent">{r.toFixed(2)}:1</span>
      <span className={`flex items-center gap-1.5 jx-num text-[0.625rem] uppercase ${tone === 'ok' ? 'text-jx-ok' : tone === 'warn' ? 'text-jx-warn' : 'text-jx-danger'}`}>
        <StatusDot tone={tone} />
        {grade}
      </span>
    </div>
  )
}

export function PaletteTab() {
  const hue = useSettings((s) => s.hue)
  const set = useSettings((s) => s.set)
  const accent = useAccent()
  const { probe, values } = useResolvedTokens(hue)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(text)
        playBleep('success')
        setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200)
      },
      () => playBleep('error'),
    )
  }

  const bg = values['--jx-bg']
  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <span ref={probe} className="sr-only" aria-hidden="true" />
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] mb-5 [&>*]:min-w-0">
        {/* hue control */}
        <section data-augmented-ui="tl-clip br-clip border" className="jx-aug p-4 flex flex-col gap-3 [will-change:transform]" aria-labelledby="hue-head">
          <SectionHead id="hue-head" meta="--jx-hue">
            Odcień akcentu na żywo
          </SectionHead>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative size-24 shrink-0 rounded-full border border-jx-line grid place-items-center" style={{ background: 'conic-gradient(from 0deg, hsl(0 100% 52%), hsl(60 100% 52%), hsl(120 100% 52%), hsl(180 100% 52%), hsl(240 100% 52%), hsl(300 100% 52%), hsl(360 100% 52%))' }}>
              <span className="absolute inset-[6px] rounded-full bg-jx-bg" />
              <span className="absolute inset-0" style={{ transform: `rotate(${hue}deg)` }} aria-hidden="true">
                <span className="absolute left-1/2 top-0 -translate-x-1/2 w-[3px] h-4 bg-white shadow-[0_0_6px_white]" />
              </span>
              <span className="relative jx-num text-xl text-jx-accent jx-glow-text">{hue}°</span>
            </div>
            <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={359}
                value={hue}
                onChange={(e) => set({ hue: Number(e.target.value) })}
                className="w-full accent-[var(--jx-accent)]"
                aria-label="Odcień akcentu w stopniach"
                style={{ background: 'transparent' }}
              />
              <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, hsl(0 100% 52%), hsl(60 100% 52%), hsl(120 100% 52%), hsl(180 100% 52%), hsl(240 100% 52%), hsl(300 100% 52%), hsl(360 100% 52%))' }} aria-hidden="true" />
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <HudButton key={p.hue} size="sm" active={p.hue === hue} onClick={() => set({ hue: p.hue })} aria-label={`Odcień ${p.label} ${p.hue}°`}>
                    <span className="size-2.5 inline-block" style={{ background: `hsl(${p.hue} 100% 52%)` }} />
                    {p.label}
                  </HudButton>
                ))}
                <HudButton size="sm" icon={<IconRotate />} onClick={() => set({ hue: DEFAULT_SETTINGS.hue })}>
                  Domyślny
                </HudButton>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 [&>*]:min-w-0">
            {[
              { k: 'useAccent().hex', v: accent.hex },
              { k: 'hex2', v: accent.hex2 },
              { k: 'dim', v: accent.dim },
            ].map((c) => (
              <button key={c.k} type="button" onClick={() => copy(c.v)} className="flex items-center gap-2 border border-jx-line/50 p-1.5 hover:border-jx-accent cursor-pointer text-left min-w-0" aria-label={`Kopiuj ${c.v}`}>
                <span className="size-6 shrink-0 border border-white/20" style={{ background: c.v, boxShadow: `0 0 10px ${c.v}` }} />
                <span className="min-w-0">
                  <span className="block jx-num text-[0.625rem] text-jx-dim truncate">{c.k}</span>
                  <span className="block jx-num text-[0.72rem] text-jx-text">{copied === c.v ? 'skopiowano' : c.v}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[0.7rem] text-jx-dim leading-snug">
            Zmiana zapisuje się w ustawieniach i od razu przebarwia cały interfejs: tokeny CSS, ramki ARWES, augmented-ui, a przez <code className="jx-num text-jx-accent">useAccent()</code> i FxProps.accent także sceny three.js, ECharts i kanwy.
          </p>
        </section>

        {/* contrast + glow samples */}
        <section data-augmented-ui="tl-clip br-clip border" className="jx-aug p-4 flex flex-col gap-3 [will-change:transform]" aria-labelledby="contrast-head">
          <SectionHead id="contrast-head" meta="WCAG 2.2 · liczone na żywo">
            Kontrast względem --jx-bg
          </SectionHead>
          <div>
            <ContrastRow label="Tekst (--jx-text)" fg={values['--jx-text']} bg={bg} />
            <ContrastRow label="Tekst pomocniczy (--jx-text-dim)" fg={values['--jx-text-dim']} bg={bg} />
            <ContrastRow label="Akcent (--jx-accent)" fg={values['--jx-accent']} bg={bg} />
            <ContrastRow label="Akcent 2 (--jx-accent-2)" fg={values['--jx-accent-2']} bg={bg} />
            <ContrastRow label="OK (--jx-ok)" fg={values['--jx-ok']} bg={bg} />
            <ContrastRow label="Ostrzeżenie (--jx-warn)" fg={values['--jx-warn']} bg={bg} />
            <ContrastRow label="Błąd (--jx-danger)" fg={values['--jx-danger']} bg={bg} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            <div className="border border-jx-line/50 p-2 grid place-items-center gap-1">
              <span className="jx-display text-jx-accent jx-glow-text text-sm">GLOW</span>
              <span className="jx-num text-[0.625rem] text-jx-dim">.jx-glow-text</span>
            </div>
            <div className="border border-jx-line/50 p-2 grid place-items-center gap-1">
              <span className="size-5 rounded-full bg-jx-accent shadow-[var(--jx-glow)]" />
              <span className="jx-num text-[0.625rem] text-jx-dim">--jx-glow</span>
            </div>
            <div className="border border-jx-line/50 p-2 grid place-items-center gap-1 jx-grid-bg">
              <span className="jx-label text-[0.625rem] text-jx-accent">siatka</span>
              <span className="jx-num text-[0.625rem] text-jx-dim">.jx-grid-bg</span>
            </div>
            <div className="border border-jx-line/50 p-2 flex flex-col justify-center gap-1">
              <SegBar value={0.62} segments={12} />
              <span className="jx-num text-[0.625rem] text-jx-dim text-center">SegBar</span>
            </div>
          </div>
        </section>
      </div>

      {(['surface', 'accent', 'text', 'semantic'] as const).map((g) => (
        <div key={g} className="mb-5">
          <SectionHead meta={g === 'accent' ? 'zależne od --jx-hue' : g === 'semantic' ? 'stałe' : undefined}>
            {{ surface: 'Powierzchnie', accent: 'Akcent i linie', text: 'Tekst', semantic: 'Semantyczne' }[g]}
          </SectionHead>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
            {TOKENS.filter((t) => t.group === g).map((t) => {
              const rgba = values[t.v]
              const hex = rgba ? toHex(rgba) : '…'
              const alpha = rgba && rgba[3] < 1 ? ` · α ${rgba[3].toFixed(2)}` : ''
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => copy(`var(${t.v})`)}
                  className="group flex items-stretch gap-0 border border-jx-line/40 hover:border-jx-accent text-left cursor-pointer min-w-0 bg-jx-bg/40"
                  aria-label={`Kopiuj var(${t.v})`}
                >
                  <span className="w-14 shrink-0 relative overflow-hidden border-r border-jx-line/40" style={{ background: 'repeating-conic-gradient(#0d1a24 0 25%, #050b11 0 50%) 0 0 / 10px 10px' }}>
                    <span className="absolute inset-0" style={{ background: `var(${t.v})` }} />
                  </span>
                  <span className="flex-1 min-w-0 px-2 py-1.5">
                    <span className="flex items-center gap-1">
                      <span className="jx-num text-[0.68rem] text-jx-accent truncate">{t.v}</span>
                      <IconCopy className="size-3 text-jx-dim opacity-0 group-hover:opacity-100 shrink-0" aria-hidden="true" />
                    </span>
                    <span className="block text-[0.7rem] text-jx-text/85 truncate">{copied === `var(${t.v})` ? 'skopiowano do schowka' : t.desc}</span>
                    <span className="block jx-num text-[0.625rem] text-jx-dim truncate">
                      {hex}
                      {alpha}
                      {t.tw && <span className="text-jx-accent/70"> · {t.tw}</span>}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
