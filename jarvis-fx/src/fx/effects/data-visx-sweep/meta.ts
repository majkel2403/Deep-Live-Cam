import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'data-visx-sweep',
  title: 'Radialny skaner kanałów',
  category: 'data',
  description: 'Radialny wykres słupkowy z visx (scaleBand + scaleRadial + Arc) z obracającą się wiązką, która podświetla mijane kanały i odczytuje ich wartość. Dane syntetyczne, wolno dryfujące (DEMO).',
  tech: ['visx', 'd3-scale', 'SVG'],
  license: 'MIT',
  source: { label: 'airbnb.io/visx', url: 'https://airbnb.io/visx/gallery' },
  cost: 1,
  order: 33,
  tags: ['radial', 'bar chart', 'visx', 'sweep', 'svg'],
}
