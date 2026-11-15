import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-holo-globe',
  title: 'Holo-glob',
  category: 'webgl',
  description:
    'Heksagonalne punkty lądów (Natural Earth, domena publiczna) na obracającym się globie z siatką równoleżników, łukami wielkich kół i pulsującymi miastami. Połączenia między miastami są demonstracyjne.',
  tech: ['R3F', 'drei', 'GLSL', 'postprocessing'],
  license: 'MIT · dane: domena publiczna',
  source: { label: 'Natural Earth 1:110m', url: 'https://github.com/nvkelso/natural-earth-vector' },
  webgl: true,
  cost: 2,
  order: 3,
  tags: ['glob', 'mapa', 'łuki', 'miasta', 'sieć', 'bloom', 'demo'],
}
