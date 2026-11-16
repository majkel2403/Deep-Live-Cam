import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'motion-anime-stagger',
  title: 'Matryca impulsów',
  category: 'motion',
  description:
    'Siatka punktów animowana przez anime.js v4: stagger({ grid, from }) rozchodzi falę od miejsca kliknięcia, kursora klawiatury lub środka, a createTimeline łączy impuls z przemiataniem osi.',
  tech: ['anime.js v4', 'stagger grid', 'createTimeline'],
  license: 'MIT',
  source: { label: 'animejs.com – stagger', url: 'https://animejs.com/documentation/utilities/stagger' },
  cost: 2,
  order: 3,
  tags: ['anime.js', 'stagger', 'grid', 'ripple', 'fala', 'kropki'],
}
