/**
 * Boot sequence choreography — the single source of truth for timings.
 * BootStage builds its GSAP timeline from these numbers and BootView draws its layer chart
 * from them, so the explanation can never drift from what actually plays.
 */
import type { BleepName } from '@/lib/sound'

export type BootLayerId = 'power' | 'reactor' | 'core' | 'log' | 'title' | 'status' | 'flash' | 'exit'

export interface BootLayer {
  id: BootLayerId
  /** start, seconds at 1× speed */
  at: number
  /** duration, seconds at 1× speed */
  dur: number
  name: string
  tech: string[]
  desc: string
  sound?: BleepName
  /** only played by the full-screen overlay */
  overlayOnly?: boolean
}

export const BOOT_LAYERS: BootLayer[] = [
  {
    id: 'power',
    at: 0,
    dur: 0.7,
    name: 'Zasilanie',
    tech: ['GSAP timeline'],
    desc: 'Siatka i linia skanu rozjaśniają ekran, rusza narastający dźwięk rozruchu.',
    sound: 'boot',
  },
  {
    id: 'reactor',
    at: 0.2,
    dur: 1.9,
    name: 'Reaktor',
    tech: ['DrawSVGPlugin'],
    desc: 'Pierścienie, łuki, podziałka i cewki reaktora są rysowane kreską — od środka na zewnątrz.',
  },
  {
    id: 'core',
    at: 1.3,
    dur: 1.4,
    name: 'Rdzeń',
    tech: ['MorphSVGPlugin', 'DrawSVGPlugin'],
    desc: 'Rdzeń przechodzi z trójkąta w sześciokąt, a potem w okrąg; rośnie poświata.',
  },
  {
    id: 'log',
    at: 0.5,
    dur: 3.6,
    name: 'Dziennik rozruchu',
    tech: ['GSAP', 'ScrambleTextPlugin'],
    desc: 'Moduły zgłaszają gotowość z prawdziwymi parametrami tej przeglądarki; licznik i pasek postępu.',
    sound: 'type',
  },
  {
    id: 'title',
    at: 2.4,
    dur: 1.3,
    name: 'Nazwa',
    tech: ['SplitText', 'ScrambleTextPlugin'],
    desc: '„J.A.R.V.I.S” składa się z pojedynczych znaków, podpis rozszyfrowuje się losowymi glifami.',
  },
  {
    id: 'status',
    at: 3.2,
    dur: 1.2,
    name: 'Status',
    tech: ['ARWES Decipher'],
    desc: 'Linie statusu odszyfrowane efektem animateTextDecipher z @arwes/text.',
    sound: 'type',
  },
  {
    id: 'flash',
    at: 4.4,
    dur: 0.6,
    name: 'Błysk',
    tech: ['PowerGlitch', 'GSAP'],
    desc: 'Zakłócenie obrazu i rozbłysk potwierdzają gotowość systemu.',
    sound: 'success',
  },
  {
    id: 'exit',
    at: 5.0,
    dur: 0.6,
    name: 'Wyjście',
    tech: ['GSAP', 'onDone()'],
    desc: 'Nakładka gaśnie i oddaje sterowanie aplikacji (tylko tryb pełnoekranowy).',
    overlayOnly: true,
  },
]

export const BOOT_LAYER = Object.fromEntries(BOOT_LAYERS.map((l) => [l.id, l])) as Record<BootLayerId, BootLayer>

/** End of the main timeline (before the overlay exit fade). */
export const BOOT_MAIN_END = BOOT_LAYER.exit.at
/** Full overlay length including the exit fade. */
export const BOOT_TOTAL = BOOT_LAYER.exit.at + BOOT_LAYER.exit.dur
