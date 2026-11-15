import type { FxMeta } from '@/fx/types'

export const meta: FxMeta = {
  id: 'r3f-glass-shard',
  title: 'Szklany odłamek',
  category: 'webgl',
  description:
    'Holograficzny kryształ z MeshTransmissionMaterial (załamanie, dyspersja, anizotropia) obraca się w pierścieniach światła. Oświetlenie wyłącznie z Lightformerów — bez pobierania map HDR.',
  tech: ['R3F', 'drei', 'MeshTransmissionMaterial', 'Lightformer', 'postprocessing'],
  license: 'MIT',
  source: { label: 'drei · MeshTransmissionMaterial', url: 'https://github.com/pmndrs/drei#meshtransmissionmaterial' },
  webgl: true,
  cost: 3,
  order: 4,
  tags: ['szkło', 'kryształ', 'refrakcja', 'transmisja', 'pierścienie', 'bloom'],
}
