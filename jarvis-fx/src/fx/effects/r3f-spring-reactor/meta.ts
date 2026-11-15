import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-spring-reactor',
  title: 'Reaktor łukowy',
  category: 'webgl',
  description:
    'Reaktor łukowy złożony z metalowych cewek, świecących segmentów i przesłony irysowej. Każdy element animuje fizyczna sprężyna @react-spring/three w cyklu: zamknięcie → otwarcie → impuls → domknięcie.',
  tech: ['R3F', 'react-spring', 'drei', 'postprocessing'],
  license: 'MIT',
  source: { label: 'pmndrs/react-spring · three', url: 'https://github.com/pmndrs/react-spring' },
  webgl: true,
  cost: 2,
  order: 8,
  tags: ['reaktor', 'arc reactor', 'sprężyna', 'spring', 'cykl', 'bloom'],
}
