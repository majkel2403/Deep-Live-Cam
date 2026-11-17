import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'motion-number-ticker',
  title: 'Ściana liczników',
  category: 'motion',
  description:
    'Port „Number Ticker” z Magic UI na sprężynach Motion 14: ściana liczników telemetrii z mini-wykresami. Kafelki NA ŻYWO pokazują prawdziwe odczyty przeglądarki (FPS, DOM, sterta, opóźnienie pętli), kafelki DEMO – wartości syntetyczne.',
  tech: ['Motion 14', 'useSpring', 'useInView', 'Intl.NumberFormat'],
  license: 'MIT',
  source: { label: 'Magic UI – Number Ticker (MIT)', url: 'https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/number-ticker.tsx' },
  cost: 1,
  order: 4,
  tags: ['liczniki', 'telemetria', 'spring', 'magic ui', 'kpi', 'fps'],
}
