/** Bleep vocabulary (ARWES naming). Re-exported from '@/lib/sound'. */
export const BLEEPS = [
  'click', // button press
  'hover', // pointer over interactive element (very quiet)
  'open', // panel / dialog open
  'close', // panel / dialog close
  'type', // decipher text tick
  'success',
  'error',
  'alert', // attention / warning
  'scan', // radar sweep / scanning
  'boot', // power-up swell
  'toggle',
] as const

export type BleepName = (typeof BLEEPS)[number]

export function isBleepName(x: unknown): x is BleepName {
  return typeof x === 'string' && (BLEEPS as readonly string[]).includes(x)
}
