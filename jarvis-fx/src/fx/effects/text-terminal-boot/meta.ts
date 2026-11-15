import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'text-terminal-boot',
  title: 'Terminal rozruchowy',
  category: 'text',
  description:
    'Terminal Share Tech Mono wypisujący log startu z migającym kursorem, statusami [ OK ] / [WARN] / [FAIL], paskami postępu i autoprzewijaniem. Wiersze z ◆ to prawdziwe odczyty z przeglądarki, reszta to symulacja.',
  tech: ['React 19', 'requestAnimationFrame', 'Share Tech Mono'],
  license: 'MIT · OFL-1.1 (font)',
  cost: 1,
  order: 3,
  tags: ['terminal', 'boot', 'log', 'typewriter', 'crt', 'konsola'],
}
