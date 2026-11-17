import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-hologram-shader',
  title: 'Shader hologramu',
  category: 'webgl',
  description:
    'Autorski materiał GLSL: obwódka Fresnela, przesuwające się linie skanowania, migotanie i cyfrowy glitch wierzchołków na proceduralnym popiersiu lub węźle torusa — z projektorem, stożkiem światła i własnym efektem rozrywania linii w postprocessingu.',
  tech: ['R3F', 'GLSL', 'postprocessing', 'drei'],
  license: 'MIT',
  source: { label: 'pmndrs/postprocessing · Effect API', url: 'https://github.com/pmndrs/postprocessing' },
  webgl: true,
  cost: 2,
  order: 6,
  tags: ['hologram', 'shader', 'glsl', 'fresnel', 'skanlinie', 'glitch', 'popiersie'],
}
