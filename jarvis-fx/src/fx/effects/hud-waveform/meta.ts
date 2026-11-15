import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'hud-waveform',
  title: 'Oscyloskop i widmo',
  category: 'hud',
  description: 'Oscyloskop z wyzwalaniem na zboczu i analizator widma (FFT, skala logarytmiczna, szczyty). Domyślnie sygnał syntetyczny (DEMO); przycisk „Mikrofon” przełącza na prawdziwy AnalyserNode z WebAudio.',
  tech: ['Canvas 2D', 'WebAudio', 'FFT'],
  license: 'MIT (kod własny)',
  cost: 1,
  order: 11,
  tags: ['audio', 'oscilloscope', 'spectrum', 'fft', 'microphone'],
}
