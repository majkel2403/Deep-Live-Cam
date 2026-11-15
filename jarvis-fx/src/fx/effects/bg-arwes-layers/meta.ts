import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'bg-arwes-layers',
  title: 'Warstwy tła ARWES',
  category: 'background',
  description:
    'Interaktywny przegląd @arwes/bgs: siatka, kropki, ruchome linie i obłoki na osobnych płótnach, sterowane lekkim zamiennikiem animatora ARWES. Warstwy włączasz w panelu Leva, wejście/wyjście odtwarzasz przyciskiem.',
  tech: ['@arwes/bgs', 'animator shim', 'Canvas 2D'],
  license: 'MIT',
  source: { label: 'arwes.dev', url: 'https://arwes.dev' },
  cost: 1,
  order: 1,
  tags: ['arwes', 'grid', 'dots', 'lines', 'puffs', 'siatka', 'sci-fi'],
}
