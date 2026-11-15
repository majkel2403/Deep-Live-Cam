import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'bg-vanta-halo',
  title: 'Halo reaktora',
  category: 'background',
  description:
    'Shaderowy pierścień energii Vanta.js ze sprzężeniem zwrotnym bufora — rozmyte smugi rozchodzą się od rdzenia jak pole siłowe. Kolor bazowy pochodzi z akcentu, środek podąża za kursorem.',
  tech: ['Vanta.js', 'three@0.134', 'GLSL'],
  license: 'MIT',
  source: { label: 'tengbao/vanta', url: 'https://github.com/tengbao/vanta' },
  webgl: true,
  cost: 3,
  order: 12,
  tags: ['vanta', 'halo', 'shader', 'feedback', 'reactor', 'ring'],
}
