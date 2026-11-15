import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-comet-trails',
  title: 'Ogony komet',
  category: 'webgl',
  description:
    'Komety na eliptycznych, nachylonych orbitach wokół jasnego rdzenia — przyspieszają w peryhelium jak w prawie Keplera. Ogony z drei Trail, pył z Sparkles, aberracja chromatyczna i bloom.',
  tech: ['R3F', 'drei Trail', 'drei Sparkles', 'postprocessing'],
  license: 'MIT',
  source: { label: 'drei · Trail', url: 'https://github.com/pmndrs/drei#trail' },
  webgl: true,
  cost: 2,
  order: 5,
  tags: ['komety', 'orbity', 'trail', 'kepler', 'aberracja', 'bloom'],
}
