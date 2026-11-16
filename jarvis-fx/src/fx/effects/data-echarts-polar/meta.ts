import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'data-echarts-polar',
  title: 'Wykres orbitalny',
  category: 'data',
  description: 'Biegunowy „plot orbitalny” w ECharts: satelity na orbitach ze smugami, pulsujące echa (effectScatter) i morfująca rozeta – serie aktualizowane klatka po klatce przez API instancji. Dane syntetyczne (DEMO).',
  tech: ['ECharts 6', 'echarts-for-react', 'polar'],
  license: 'Apache-2.0 · MIT',
  source: { label: 'echarts.apache.org', url: 'https://echarts.apache.org/en/option.html#polar' },
  cost: 2,
  order: 31,
  tags: ['polar', 'orbit', 'echarts', 'radar', 'animation'],
}
