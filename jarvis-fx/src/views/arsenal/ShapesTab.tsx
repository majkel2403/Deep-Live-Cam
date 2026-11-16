import { useState, type CSSProperties } from 'react'
import { IconPlayerPlay } from '@tabler/icons-react'
import { FRAME_KINDS, Frame, HudButton, type FrameKind } from '@/hud'
import { playBleep } from '@/lib/sound'
import { SectionHead, Tag } from './common'

/** augmented-ui (BSD-2-Clause) mixin samples – pure CSS clip-paths driven by data-augmented-ui. */
const AUG_SAMPLES: { aug: string; label: string }[] = [
  { aug: 'tl-clip br-clip tr-clip-x border', label: 'Panel standardowy' },
  { aug: 'tl-clip tr-clip br-clip bl-clip border', label: 'Ośmiokąt' },
  { aug: 'tl-clip-x br-clip-x border inlay', label: 'Klin z wkładką' },
  { aug: 'tl-round br-round tr-clip bl-clip border', label: 'Zaokrąglone + ścięte' },
  { aug: 'tl-scoop tr-scoop br-scoop bl-scoop border', label: 'Wklęsłe narożniki' },
  { aug: 'tl-rect-x br-rect-x t-clip-x b-clip-x border', label: 'Wcięcia prostokątne' },
  { aug: 'tl-step-inset br-step-inset border', label: 'Schodki wewnętrzne' },
  { aug: 'l-clip-y r-clip-y border', label: 'Boczne kliny' },
  { aug: 'b-clip-x t-rect-x border inlay', label: 'Zakładka nagłówka' },
  { aug: 'all-hex border', label: 'Sześciokąt' },
  { aug: 'all-hexangle-up border', label: 'Hexangle' },
  { aug: 'all-triangle-up border', label: 'Trójkąt' },
]

const ALL_SHAPE_STYLE = { '--aug-all-height': '112px', background: 'hsl(var(--jx-hue) 90% 30% / 0.35)' } as CSSProperties
const CLIP_SHAPE_STYLE = {
  '--aug-tl': '16px',
  '--aug-br': '16px',
  '--aug-tr': '12px',
  '--aug-bl': '12px',
  '--aug-t': '14px',
  '--aug-b': '14px',
  '--aug-l': '14px',
  '--aug-r': '14px',
  '--aug-inlay-all': '5px',
  '--aug-inlay-bg': 'hsl(var(--jx-hue) 100% 50% / 0.08)',
} as CSSProperties

const FRAME_DESC: Record<FrameKind, string> = {
  octagon: 'Ośmiokąt z wypełnieniem – domyślna ramka paneli',
  corners: 'Same narożniki – celowniki i podglądy',
  lines: 'Linie poziome – listy i logi',
  underline: 'Podkreślenie ze ściętym rogiem – pola wyszukiwania',
  nefrex: 'Asymetryczne ścięcia – karty akcji',
  kranox: 'Profil przemysłowy – ostrzeżenia',
  header: 'Nagłówek z belką – sekcje',
  nero: 'Narożniki z kwadratami – kafelki danych',
  circle: 'Okrąg – wskaźniki i przyciski okrągłe',
}

export function ShapesTab() {
  const [replay, setReplay] = useState(0)

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <SectionHead meta="BSD-2-Clause · czysty CSS">augmented-ui · mixiny</SectionHead>
      <p className="text-[0.76rem] text-jx-dim mb-3 max-w-3xl leading-snug">
        Kształty powstają z atrybutu <code className="jx-num text-jx-accent">data-augmented-ui</code> (clip-path + zmienne --aug-*). Obramowanie i wkładka biorą kolor z tokenów, więc reagują na odcień akcentu.
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))] mb-6">
        {AUG_SAMPLES.map((s) => (
          <figure key={s.aug} className="flex flex-col gap-1.5 min-w-0">
            <div
              data-augmented-ui={s.aug}
              // all-* mixins size the element themselves from --aug-all-height (width follows the ratio)
              className={`jx-aug grid place-items-center [will-change:transform] ${s.aug.startsWith('all-') ? 'mx-auto' : 'h-28'}`}
              style={
                s.aug.startsWith('all-') ? ALL_SHAPE_STYLE : CLIP_SHAPE_STYLE
              }
            >
              <span className={`jx-label text-[0.62rem] text-jx-accent ${s.aug.startsWith('all-triangle') ? 'pt-8' : ''}`}>{s.label}</span>
            </div>
            <figcaption className="jx-num text-[0.6rem] text-jx-dim break-words leading-snug">{s.aug}</figcaption>
          </figure>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-2">
        <SectionHead meta="MIT · @arwes/frames (vanilla)">ARWES · ramki SVG</SectionHead>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-[0.76rem] text-jx-dim max-w-3xl leading-snug flex-1 min-w-[16rem]">
          Ramki rysuje <code className="jx-num text-jx-accent">createFrame()</code> z pakietu @arwes/frames; komponent <code className="jx-num text-jx-accent">&lt;Frame&gt;</code> dodaje animację montażu (rysowanie kreski + wygaszenie tła). Kolory czytane są ze zmiennych --arwes-frames-*.
        </p>
        <HudButton
          size="sm"
          icon={<IconPlayerPlay />}
          onClick={() => {
            playBleep('scan')
            setReplay((n) => n + 1)
          }}
        >
          Odtwórz montaż
        </HudButton>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))] pb-6">
        {FRAME_KINDS.map((k) => (
          <figure key={k} className="flex flex-col gap-1.5 min-w-0">
            <div className={`jx-frame-host grid place-items-center ${k === 'circle' ? 'aspect-square max-h-36 mx-auto w-36' : 'h-32'}`}>
              <Frame key={`${k}-${replay}`} kind={k} />
              <span className="jx-label text-[0.65rem] text-jx-accent">{k}</span>
            </div>
            <figcaption className="flex items-start gap-1.5">
              <Tag className="text-jx-accent border-jx-line">{k}</Tag>
              <span className="text-[0.7rem] text-jx-dim leading-snug">{FRAME_DESC[k]}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
