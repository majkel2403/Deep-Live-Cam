import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-uikit-panel',
  title: 'Panel uikit 3D',
  category: 'webgl',
  description:
    'Panel diagnostyczny zbudowany w WebGL z @react-three/uikit: flexbox Yoga i tekst MSDF z polskimi znakami (atlas wygenerowany z fontu Chakra Petch). Pochyla się ku kursorowi i pokazuje prawdziwe pomiary klatek oraz przeglądarki.',
  tech: ['R3F', '@react-three/uikit', 'Yoga', 'MSDF', 'postprocessing'],
  license: 'MIT · font: SIL OFL 1.1',
  source: { label: 'pmndrs/uikit', url: 'https://github.com/pmndrs/uikit' },
  webgl: true,
  cost: 2,
  order: 7,
  tags: ['panel', 'ui', 'uikit', 'flexbox', 'fps', 'diagnostyka', 'tilt'],
}
