import { useState } from 'react'
import IconAlertTriangle from '@tabler/icons-react/icons/IconAlertTriangle'
import IconCircleCheck from '@tabler/icons-react/icons/IconCircleCheck'
import { FONT_ROLES } from '@/styles/fonts'
import { HudButton } from '@/hud'
import { SectionHead, Tag } from './common'

/**
 * Weights actually imported in src/styles/fonts.ts and Polish (latin-ext) coverage, read from the
 * Fontsource subsets in node_modules (`files/*-latin-ext-*`). Orbitron and Share Tech Mono ship
 * only the "latin" subset, so ą ę ł ó ś ż ź ć ń fall back to the next font in the stack.
 */
const FONT_INFO: Record<string, { weights: number[] | [number, number]; variable?: boolean; pl: boolean; mono?: boolean }> = {
  Orbitron: { weights: [500, 700, 900], pl: false },
  Michroma: { weights: [400], pl: true },
  Oxanium: { weights: [400, 600, 700], pl: true },
  Rajdhani: { weights: [500, 600, 700], pl: true },
  'Chakra Petch': { weights: [400, 500, 600], pl: true },
  'Exo 2': { weights: [100, 900], variable: true, pl: true },
  Audiowide: { weights: [400], pl: true },
  'Share Tech Mono': { weights: [400], pl: false, mono: true },
  'JetBrains Mono': { weights: [400, 600], pl: true, mono: true },
  'IBM Plex Mono': { weights: [400, 600], pl: true, mono: true },
  'Space Grotesk': { weights: [300, 700], variable: true, pl: true },
  'Space Mono': { weights: [400], pl: true, mono: true },
}

const DEFAULT_SAMPLE = 'Zażółć gęślą jaźń · 0427'

export function TypeTab() {
  const [sample, setSample] = useState(DEFAULT_SAMPLE)
  const [size, setSize] = useState(30)
  const [upper, setUpper] = useState(false)

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[14rem] max-w-xl">
          <span className="jx-label text-[0.625rem]">Tekst próbki</span>
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="bg-jx-accent/5 border border-jx-line/70 focus:border-jx-accent outline-none px-2.5 py-1.5 font-ui text-sm text-jx-text"
            aria-label="Tekst próbki fontów"
          />
        </label>
        <label className="flex flex-col gap-1 w-44">
          <span className="jx-label text-[0.625rem]">
            Rozmiar · <span className="jx-num text-jx-accent">{size}px</span>
          </span>
          <input type="range" min={14} max={64} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-[var(--jx-accent)]" aria-label="Rozmiar próbki" />
        </label>
        <HudButton size="sm" active={upper} onClick={() => setUpper(!upper)}>
          Wersaliki
        </HudButton>
        <HudButton size="sm" onClick={() => setSample(DEFAULT_SAMPLE)}>
          Pangram PL
        </HudButton>
        <span className="flex-1" />
        <p className="text-[0.72rem] text-jx-dim max-w-sm leading-snug">
          12 krojów SIL OFL 1.1, hostowanych lokalnie przez Fontsource – bez zapytań do Google Fonts.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))] pb-4">
          {FONT_ROLES.map((f) => {
            const info = FONT_INFO[f.family]
            const stack = `var(${f.cssVar})`
            const weights = info?.variable ? [info.weights[0], 400, info.weights[1]] : (info?.weights ?? [400])
            return (
              <article key={f.family} data-augmented-ui="tl-clip br-clip border" className="jx-aug p-3 flex flex-col gap-2 min-w-0 [will-change:transform]" aria-label={`Font ${f.family}`}>
                <header className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-jx-accent text-lg leading-tight truncate" style={{ fontFamily: stack, fontWeight: weights[weights.length - 1] }}>
                      {f.family}
                    </h4>
                    <p className="text-[0.72rem] text-jx-dim">{f.role}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Tag className="text-jx-ok border-jx-ok/60">{f.license}</Tag>
                    {info?.pl ? (
                      <Tag className="text-jx-ok/90 border-jx-line" title="Fontsource zawiera podzbiór latin-ext">
                        <IconCircleCheck className="size-3" aria-hidden="true" />
                        PL
                      </Tag>
                    ) : (
                      <Tag className="text-jx-warn border-jx-warn/60" title="Tylko podzbiór latin – polskie litery pochodzą z fontu zastępczego">
                        <IconAlertTriangle className="size-3" aria-hidden="true" />
                        brak PL
                      </Tag>
                    )}
                  </div>
                </header>
                <p
                  className="text-jx-text leading-[1.15] break-words min-h-[1.2em]"
                  style={{ fontFamily: stack, fontSize: size, fontWeight: weights[Math.min(1, weights.length - 1)], textTransform: upper ? 'uppercase' : 'none', letterSpacing: info?.mono ? 0 : '0.02em' }}
                >
                  {sample || ' '}
                </p>
                <div className="flex flex-col gap-0.5 border-t border-jx-line/40 pt-1.5">
                  {weights.map((w) => (
                    <div key={w} className="flex items-baseline gap-2 min-w-0">
                      <span className="jx-num text-[0.625rem] text-jx-dim w-8 shrink-0">{w}</span>
                      <span className="truncate text-jx-text/90 text-[0.95rem]" style={{ fontFamily: stack, fontWeight: w }}>
                        AaĄą ĘęŁł ŚśŻż 0123456789
                      </span>
                    </div>
                  ))}
                </div>
                <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 jx-num text-[0.625rem] text-jx-dim">
                  <span className="text-jx-accent/80">{f.cssVar}</span>
                  <span>{info?.variable ? `zmienny ${info.weights[0]}–${info.weights[1]}` : `${weights.length} ${weights.length === 1 ? 'grubość' : 'grubości'}`}</span>
                  {!info?.pl && <span className="text-jx-warn normal-case">Polski tekst: Michroma / Chakra Petch / JetBrains Mono</span>}
                </footer>
              </article>
            )
          })}
        </div>
        <SectionHead>Role w interfejsie</SectionHead>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 pb-6 text-[0.78rem]">
          <div className="border border-jx-line/50 p-2">
            <div className="jx-label text-[0.625rem]">.jx-display</div>
            <div className="jx-display text-jx-accent jx-glow-text">J.A.R.V.I.S</div>
          </div>
          <div className="border border-jx-line/50 p-2">
            <div className="jx-label text-[0.625rem]">.jx-title</div>
            <div className="jx-title">Rejestr zasobów</div>
          </div>
          <div className="border border-jx-line/50 p-2">
            <div className="jx-label text-[0.625rem]">.jx-label</div>
            <div className="jx-label">Moc reaktora · stabilna</div>
          </div>
          <div className="border border-jx-line/50 p-2">
            <div className="jx-label text-[0.625rem]">.jx-num</div>
            <div className="jx-num text-jx-accent">T+00:42:17.093</div>
          </div>
        </div>
      </div>
    </div>
  )
}
