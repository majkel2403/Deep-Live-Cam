import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'bg-reactbits-faulty-terminal',
  title: 'Wadliwy terminal',
  category: 'background',
  description:
    'Ekran CRT z siatką migoczących glifów: szum fbm, linie skanowania, krzywizna kineskopu, aberracja i poświata luminoforu w kolorze akcentu. Kliknięcie wywołuje zakłócenie lub rozmagnesowanie.',
  tech: ['WebGL2', 'GLSL', 'MRT', 'React Bits'],
  license: 'MIT + Commons Clause',
  source: { label: 'React Bits · Faulty Terminal', url: 'https://reactbits.dev/backgrounds/faulty-terminal' },
  webgl: true,
  cost: 3,
  order: 21,
  tags: ['reactbits', 'terminal', 'crt', 'glitch', 'matrix', 'scanlines', 'shader'],
}
