import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'particles-network',
  title: 'Sieć węzłów',
  category: 'particles',
  description:
    'Dryfujące węzły połączone liniami i trójkątami zależnie od odległości. Kursor chwyta pobliskie węzły świetlnymi wiązkami (grab + bubble), kliknięcie dosypuje nowe.',
  tech: ['tsParticles 4', '@tsparticles/react', '@tsparticles/slim'],
  license: 'MIT',
  source: { label: 'tsparticles/tsparticles', url: 'https://github.com/tsparticles/tsparticles' },
  cost: 2,
  order: 10,
  tags: ['particles', 'network', 'links', 'grab', 'plexus', 'sieć'],
}
