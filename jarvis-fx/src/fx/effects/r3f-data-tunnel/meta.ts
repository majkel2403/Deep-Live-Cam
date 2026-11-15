import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-data-tunnel',
  title: 'Tunel danych',
  category: 'webgl',
  description:
    'Hiperprzestrzenny tunel z instancjonowanych pierścieni, smug i pakietów lecących ku kamerze. Cała geometria porusza się w shaderze wierzchołków, więc setki obiektów kosztują kilka wywołań rysowania.',
  tech: ['R3F', 'GLSL', 'instancing', 'postprocessing'],
  license: 'MIT',
  webgl: true,
  cost: 2,
  order: 10,
  tags: ['tunel', 'hiperprzestrzeń', 'warp', 'pierścienie', 'smugi', 'prędkość', 'aberracja'],
}
