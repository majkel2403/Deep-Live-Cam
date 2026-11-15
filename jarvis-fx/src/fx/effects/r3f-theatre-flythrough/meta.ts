import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-theatre-flythrough',
  title: 'Przelot nad miastem',
  category: 'webgl',
  description:
    'Kamera przelatuje nad proceduralnym neonowym miastem po ścieżce z klatkami kluczowymi @theatre/core (stan sekwencji zapisany w kodzie, bez studia). Miasto jest okresowe, więc pętla zamyka się bez cięcia.',
  tech: ['R3F', '@theatre/core', 'GLSL', 'instancing', 'postprocessing'],
  license: 'MIT · Theatre.js core: Apache-2.0',
  source: { label: 'theatre-js/theatre · core', url: 'https://github.com/theatre-js/theatre' },
  webgl: true,
  cost: 3,
  order: 9,
  tags: ['miasto', 'przelot', 'kamera', 'theatre', 'neon', 'tron', 'sekwencja'],
}
