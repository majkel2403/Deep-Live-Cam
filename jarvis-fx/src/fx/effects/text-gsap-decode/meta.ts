import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'text-gsap-decode',
  title: 'Dekoder nagłówków GSAP',
  category: 'text',
  description:
    'Filmowe odsłonięcie tytułu: SplitText tnie napis na znaki, ScrambleTextPlugin przepuszcza je przez szyfr, a oś czasu GSAP zapętla trzy sekwencje komunikatów po polsku.',
  tech: ['GSAP 3', 'SplitText', 'ScrambleTextPlugin', '@gsap/react'],
  license: 'GSAP Standard License (bezpłatna)',
  source: { label: 'gsap.com/docs – SplitText', url: 'https://gsap.com/docs/v3/Plugins/SplitText/' },
  cost: 1,
  order: 1,
  tags: ['gsap', 'split text', 'scramble', 'tytuł', 'decode', 'reveal'],
}
