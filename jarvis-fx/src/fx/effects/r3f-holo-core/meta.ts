import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-holo-core',
  title: 'Holo-rdzeń',
  category: 'webgl',
  description:
    'Rdzeń JARVIS w React Three Fiber: emisyjna kula w powłoce Fresnela, żyroskopowe pierścienie orbit, obrotowa tarcza HUD ze skalą, drei Sparkles/Stars i pełny łańcuch postprocessingu (Bloom, aberracja, skanlinie, szum, winieta).',
  tech: ['R3F', 'drei', 'GLSL', 'postprocessing'],
  license: 'MIT',
  source: { label: 'pmndrs/react-postprocessing', url: 'https://github.com/pmndrs/react-postprocessing' },
  webgl: true,
  cost: 2,
  order: 1,
  tags: ['orb', 'bloom', 'core', 'arc reactor'],
}
