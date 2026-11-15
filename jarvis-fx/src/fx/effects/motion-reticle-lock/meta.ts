import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'motion-reticle-lock',
  title: 'Celownik – namierzanie',
  category: 'motion',
  description:
    'Celownik HUD rysowany przez DrawSVGPlugin, którego rdzeń przechodzi MorphSVGPlugin kwadrat → okrąg → romb, a cała sekwencja GSAP skanuje, goni i blokuje poruszający się obiekt (symulacja).',
  tech: ['GSAP 3', 'DrawSVGPlugin', 'MorphSVGPlugin', 'gsap.ticker', 'SVG'],
  license: 'GSAP Standard License (bezpłatna)',
  source: { label: 'gsap.com/docs – MorphSVG', url: 'https://gsap.com/docs/v3/Plugins/MorphSVGPlugin/' },
  cost: 1,
  order: 1,
  tags: ['reticle', 'celownik', 'lock-on', 'morph', 'draw svg', 'targeting'],
}
