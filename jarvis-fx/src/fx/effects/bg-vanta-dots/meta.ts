import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'bg-vanta-dots',
  title: 'Pole sensorów',
  category: 'background',
  description:
    'Falująca płaszczyzna punktów Vanta.js widziana z lotu ptaka, z wirującym kłębem promieni nad nią — jak mapa czujników pod skanerem. Kolory i rozmiar punktów zmieniają się na żywo.',
  tech: ['Vanta.js', 'three@0.134'],
  license: 'MIT',
  source: { label: 'tengbao/vanta', url: 'https://github.com/tengbao/vanta' },
  webgl: true,
  cost: 2,
  order: 14,
  tags: ['vanta', 'dots', 'kropki', 'grid', 'points', 'three'],
}
