import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'hud-targeting',
  title: 'System namierzania',
  category: 'hud',
  description: 'Ramki celownicze z narożnikami podążają sprężyście (Motion useSpring) za ruchomymi obiektami, pokazują odległość i cyklicznie „namierzają” cel animacją lock-on. Cele są syntetyczne (DEMO).',
  tech: ['Motion', 'SVG', 'React'],
  license: 'MIT',
  source: { label: 'motion.dev', url: 'https://motion.dev' },
  cost: 1,
  order: 12,
  tags: ['targeting', 'reticle', 'lock-on', 'tracking', 'motion'],
}
