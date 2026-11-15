import { createRafDriver, getProject, type IProject } from '@theatre/core'

/**
 * Inline Theatre.js project state (no @theatre/studio — that package is AGPL).
 * The camera path is authored here as keyframe tables and converted into the
 * on-disk state format Theatre core understands (definitionVersion 0.4.0).
 *
 * The city repeats every CITY_PERIOD units along −z and the camera travels exactly one
 * period, with matching first/last keyframes, so `iterationCount: Infinity` loops seamlessly.
 */
export const CITY_PERIOD = 64
export const SEQ_LENGTH = 16 // seconds at rate 1
export const SHEET_ID = 'Przelot'
export const OBJECT_KEY = 'Kamera'

export const CAMERA_DEFAULTS = { x: 0, y: 2.2, z: 6, lx: 0, ly: -0.25, roll: 0, fov: 56 }
type Prop = keyof typeof CAMERA_DEFAULTS

type Ease = 'ease' | 'linear' | 'soft'
const HANDLES: Record<Ease, [number, number, number, number]> = {
  ease: [0.5, 1, 0.5, 0], // theatre default ease-in-out
  soft: [0.62, 0.62, 0.38, 0.38], // gentle, keeps some velocity through the key
  linear: [1, 1, 0, 0],
}

const S = SEQ_LENGTH
const Z0 = CAMERA_DEFAULTS.z
// [time (s), value][] per animated prop
const KEYS: Record<Prop, { ease: Ease; keys: [number, number][] }> = {
  z: { ease: 'linear', keys: [[0, Z0], [S, Z0 - CITY_PERIOD]] },
  x: { ease: 'ease', keys: [[0, 0], [2.6, 1.1], [5.4, -1.2], [8.6, 0.4], [12, -0.8], [S, 0]] },
  y: { ease: 'soft', keys: [[0, 2.2], [3, 1.5], [6, 3.6], [9.2, 10.5], [12.4, 5.2], [S, 2.2]] },
  lx: { ease: 'ease', keys: [[0, 0], [2.6, -0.6], [5.4, 0.7], [9, 0], [12, 0.5], [S, 0]] },
  ly: { ease: 'soft', keys: [[0, -0.25], [3, 0.2], [6.2, 0.1], [9.2, -2.6], [12.4, -0.9], [S, -0.25]] },
  roll: { ease: 'ease', keys: [[0, 0], [2.6, -0.07], [5.4, 0.09], [8.6, -0.02], [12, 0.06], [S, 0]] },
  fov: { ease: 'ease', keys: [[0, 56], [6, 62], [9.2, 50], [S, 56]] },
}

function buildState() {
  const trackData: Record<string, unknown> = {}
  const trackIdByPropPath: Record<string, string> = {}
  for (const [prop, { ease, keys }] of Object.entries(KEYS)) {
    const trackId = `trk_${prop}`
    trackIdByPropPath[JSON.stringify([prop])] = trackId
    trackData[trackId] = {
      type: 'BasicKeyframedTrack',
      __debugName: `${OBJECT_KEY}:${JSON.stringify([prop])}`,
      keyframes: keys.map(([t, v], i) => ({
        id: `kf_${prop}_${i}`,
        position: t,
        value: v,
        handles: HANDLES[ease],
        connectedRight: i < keys.length - 1,
        type: 'bezier',
      })),
    }
  }
  return {
    sheetsById: {
      [SHEET_ID]: {
        staticOverrides: { byObject: {} },
        sequence: {
          type: 'PositionalSequence',
          length: SEQ_LENGTH,
          subUnitsPerUnit: 30,
          tracksByObject: { [OBJECT_KEY]: { trackData, trackIdByPropPath } },
        },
      },
    },
    definitionVersion: '0.4.0',
    revisionHistory: ['jx-flythrough-1'],
  }
}

// One project per page (theatre keeps a global registry; survive HMR re-evaluation).
const g = globalThis as typeof globalThis & { __jxTheatreProject?: IProject }
export function getFlythroughProject(): IProject {
  g.__jxTheatreProject ??= getProject('JARVIS · Przelot', { state: buildState() })
  return g.__jxTheatreProject
}

export { createRafDriver }
