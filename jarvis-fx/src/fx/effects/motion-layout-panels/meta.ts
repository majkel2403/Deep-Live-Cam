import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'motion-layout-panels',
  title: 'Panele układu',
  category: 'motion',
  description:
    'Animacje układu Motion 14: panele HUD przetasowują się i sortują z animacją `layout`, a kliknięcie rozwija panel współdzielonym `layoutId` w szczegółowy widok (AnimatePresence, Esc zamyka).',
  tech: ['Motion 14', 'layout', 'layoutId', 'AnimatePresence', 'LayoutGroup'],
  license: 'MIT',
  source: { label: 'motion.dev – Layout animations', url: 'https://motion.dev/docs/react-layout-animations' },
  cost: 1,
  order: 5,
  tags: ['layout', 'shared element', 'panele', 'reorder', 'expand', 'motion'],
}
