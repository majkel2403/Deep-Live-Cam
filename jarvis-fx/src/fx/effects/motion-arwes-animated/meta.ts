import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'motion-arwes-animated',
  title: 'Montaż modułów – Arwes',
  category: 'motion',
  description:
    'Choreografia montażu HUD na createAnimatedElement z @arwes/animated: pierścień i podziałki rysują się, łącza wyrastają z rdzenia, moduły wjeżdżają ze skanem, a słupki telemetrii się napełniają. Wartości są syntetyczne.',
  tech: ['@arwes/animated', '@arwes/animator', 'motion v10 (alias)', 'React 19'],
  license: 'MIT',
  source: { label: 'arwes.dev – Animated', url: 'https://arwes.dev' },
  cost: 2,
  order: 7,
  tags: ['arwes', 'animated', 'choreografia', 'montaż', 'hud', 'timeline', 'stagger'],
}
