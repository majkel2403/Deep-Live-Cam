import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-orbit-gallery',
  title: 'Galeria orbitalna',
  category: 'webgl',
  description:
    'Holograficzne karty HUD krążą wokół rdzenia z paralaksą kursora; najechana karta rośnie na sprężynie @react-spring/three. Karty pokazują prawdziwe parametry Twojej przeglądarki i GPU.',
  tech: ['R3F', 'drei', 'react-spring', 'postprocessing', 'Canvas 2D'],
  license: 'MIT',
  source: { label: 'pmndrs/react-spring', url: 'https://github.com/pmndrs/react-spring' },
  webgl: true,
  cost: 2,
  order: 2,
  tags: ['karuzela', 'orbita', 'paralaksa', 'karty', 'hover', 'spring', 'bloom'],
}
