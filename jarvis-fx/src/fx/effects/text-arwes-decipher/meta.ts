import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'text-arwes-decipher',
  title: 'Briefing – deszyfracja ARWES',
  category: 'text',
  description:
    'Wielowierszowy briefing odsłaniany przez @arwes/text: klucze się deszyfrują, wartości pojawiają się kolejno z migającym kursorem, a kanały w tle odczytują się losowo.',
  tech: ['@arwes/text', '@arwes/frames', 'React 19'],
  license: 'MIT',
  source: { label: 'arwes.dev – Text', url: 'https://arwes.dev' },
  cost: 1,
  order: 2,
  tags: ['arwes', 'decipher', 'sequence', 'typewriter', 'briefing'],
}
