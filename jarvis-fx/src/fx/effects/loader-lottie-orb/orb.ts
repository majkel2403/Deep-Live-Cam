/**
 * Hand-authored Lottie (Bodymovin 5.x schema) – an original "AI orb" loader, 400×400, 30 fps,
 * 60 frames (2 s seamless loop). Generated as an object so it can be recoloured to the HUD accent.
 * No external assets, no expressions.
 */
type RGB = [number, number, number]

const FR = 30
const OP = 60
const C = 200 // canvas centre

const st = <T>(k: T) => ({ a: 0, k })
const LINEAR = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } }
const EASE = { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } }

/** animated property from [frame, value[]] pairs */
function anim(kfs: [number, number[]][], ease = LINEAR) {
  return {
    a: 1,
    k: kfs.map(([t, s], i) => (i < kfs.length - 1 ? { t, s, ...ease } : { t, s })),
  }
}

const tr = (extra: Record<string, unknown> = {}) => ({
  ty: 'tr',
  p: st([0, 0]),
  a: st([0, 0]),
  s: st([100, 100]),
  r: st(0),
  o: st(100),
  sk: st(0),
  sa: st(0),
  nm: 'Transform',
  ...extra,
})

const ellipse = (d: number) => ({ ty: 'el', d: 1, s: st([d, d]), p: st([0, 0]), nm: 'Ellipse' })
const fill = (c: RGB, o = 100) => ({ ty: 'fl', c: st([...c, 1]), o: st(o), r: 1, nm: 'Fill' })
const stroke = (c: RGB, w: number, o = 100, dash?: [number, number], cap: 1 | 2 = 1) => ({
  ty: 'st',
  c: st([...c, 1]),
  o: st(o),
  w: st(w),
  lc: cap,
  lj: 2,
  ml: 4,
  nm: 'Stroke',
  ...(dash
    ? {
        d: [
          { n: 'd', nm: 'dash', v: st(dash[0]) },
          { n: 'g', nm: 'gap', v: st(dash[1]) },
          { n: 'o', nm: 'offset', v: st(0) },
        ],
      }
    : {}),
})
/** radial gradient fill: colour stops then opacity stops (lottie gradient encoding) */
const radial = (radius: number, c0: RGB, c1: RGB, a0: number, a1: number) => ({
  ty: 'gf',
  nm: 'Radial',
  o: st(100),
  r: 1,
  t: 2,
  s: st([0, 0]),
  e: st([radius, 0]),
  h: st(0),
  a: st(0),
  g: { p: 2, k: st([0, ...c0, 1, ...c1, 0, a0, 1, a1]) },
})

let ind = 0
function layer(nm: string, shapes: unknown[], ks: Record<string, unknown> = {}) {
  ind += 1
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ao: 0,
    bm: 0,
    ip: 0,
    op: OP,
    st: 0,
    ks: { o: st(100), r: st(0), p: st([C, C, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]), ...ks },
    shapes,
  }
}

/** dashes that tile a circle exactly n times, so rotating by k·360/n degrees loops seamlessly */
function dashFor(d: number, n: number, duty: number): [number, number] {
  const period = (Math.PI * d) / n
  return [period * duty, period * (1 - duty)]
}

export function buildOrb(accent: RGB, accent2: RGB, hot: RGB = [0.92, 0.99, 1]) {
  ind = 0
  const ticks = {
    ty: 'gr',
    nm: 'Ticks',
    it: [
      { ty: 'rc', d: 1, s: st([3, 12]), p: st([0, -168]), r: st(0), nm: 'Tick' },
      fill(accent, 85),
      { ty: 'rp', nm: 'Repeater', c: st(36), o: st(0), m: 1, tr: { ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(10), so: st(100), eo: st(100), nm: 'Repeater Transform' } },
      tr(),
    ],
  }
  const layers = [
    // highlight core (top-most)
    layer('core-hot', [{ ty: 'gr', nm: 'g', it: [ellipse(34), radial(17, hot, accent2, 1, 0.2), tr()] }], {
      s: anim(
        [
          [0, [92, 92, 100]],
          [30, [118, 118, 100]],
          [60, [92, 92, 100]],
        ],
        EASE,
      ),
    }),
    // core orb
    layer('core', [{ ty: 'gr', nm: 'g', it: [ellipse(104), radial(52, accent2, accent, 0.95, 0.04), tr()] }, { ty: 'gr', nm: 'rim', it: [ellipse(104), stroke(accent2, 1.2, 55, dashFor(104, 16, 0.7)), tr()] }], {
      s: anim(
        [
          [0, [100, 100, 100]],
          [30, [110, 110, 100]],
          [60, [100, 100, 100]],
        ],
        EASE,
      ),
    }),
    // trim-path arc chasing around the core
    layer(
      'arc',
      [
        {
          ty: 'gr',
          nm: 'g',
          it: [
            ellipse(212),
            {
              ty: 'tm',
              nm: 'Trim',
              m: 1,
              s: anim(
                [
                  [0, [0]],
                  [30, [32]],
                  [60, [0]],
                ],
                EASE,
              ),
              e: anim(
                [
                  [0, [18]],
                  [30, [78]],
                  [60, [18]],
                ],
                EASE,
              ),
              o: anim([
                [0, [0]],
                [60, [360]],
              ]),
            },
            stroke(hot, 4, 100, undefined, 2),
            tr(),
          ],
        },
      ],
      {},
    ),
    // dashed ring A (clockwise, 24 dashes → rotate 60° per loop)
    layer('ring-a', [{ ty: 'gr', nm: 'g', it: [ellipse(262), stroke(accent, 3, 90, dashFor(262, 24, 0.62)), tr()] }], {
      r: anim([
        [0, [0]],
        [60, [60]],
      ]),
    }),
    // fine ring B (counter-clockwise, 60 dashes → rotate −30°)
    layer('ring-b', [{ ty: 'gr', nm: 'g', it: [ellipse(306), stroke(accent2, 1.5, 70, dashFor(306, 60, 0.35)), tr()] }], {
      r: anim([
        [0, [0]],
        [60, [-30]],
      ]),
    }),
    // tick crown (36 ticks via repeater → rotate −20° = two ticks per loop)
    layer('ticks', [ticks], {
      r: anim([
        [0, [0]],
        [60, [-20]],
      ]),
    }),
    // sonar ping
    layer('ping', [{ ty: 'gr', nm: 'g', it: [ellipse(200), stroke(accent, 2, 100), tr()] }], {
      s: anim([
        [0, [55, 55, 100]],
        [60, [175, 175, 100]],
      ]),
      o: anim([
        [0, [85]],
        [60, [0]],
      ]),
    }),
    // halo (bottom-most)
    layer('halo', [{ ty: 'gr', nm: 'g', it: [ellipse(300), radial(150, accent, accent, 0.42, 0), tr()] }], {
      s: anim(
        [
          [0, [94, 94, 100]],
          [30, [106, 106, 100]],
          [60, [94, 94, 100]],
        ],
        EASE,
      ),
    }),
  ]
  return { v: '5.7.4', fr: FR, ip: 0, op: OP, w: 400, h: 400, nm: 'jarvis-ai-orb', ddd: 0, assets: [], layers }
}
