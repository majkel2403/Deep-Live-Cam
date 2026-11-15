// SHOT LIST + PALETTE SPEC + EVENT TIMELINE — single source of truth for picture and sound.
// "Combat Artist Field Sketch, Pen & Wash, 2D" · 1920x1080 · 30fps · 2.5 s of story played at 1.1x
(function () {
  const node = typeof require !== 'undefined';
  const U = node ? require('./engine/util') : globalThis.U;
  const MU = node ? require('./engine/music') : globalThis.MUSIC;
  const { makeClock } = MU;

  const FPS = 30;
  const FORMAT = U.pickFormat('16:9');
  const [W, H] = U.formatSize(FORMAT);
  const SAFE = U.safeArea(W, H);
  const SPEED = 1.1; // playback speed: authored story seconds per real second
  const clock = makeClock({ bpm: 132, offset: 0 });
  const { T, BEAT } = clock;

  // real-time frame counts, snapped to frames (22 + 22 + 24 = 68 frames = 2.267 s real = 2.49 s authored)
  const FRAMES = [22, 22, 24];
  const cut1 = FRAMES[0] / FPS, cut2 = (FRAMES[0] + FRAMES[1]) / FPS;
  const DURATION = (FRAMES[0] + FRAMES[1] + FRAMES[2]) / FPS;

  const SPEC = {
    style: 'Combat Artist Field Sketch, Pen & Wash, 2D',
    palette: { paper: '#F2ECDE', pen: '#231A14', olive: '#70783E', ochre: '#CEA054', smoke: '#706C70', hot: '#F0822E', skin: 'ochre, diluted' },
    pen: { widthFrac: 1 / 600, flick: true, overshoot: true, hatch: 'quick hatching + zigzags' },
    wash: { coverage: 0.7, offsetPx: [2, 4], softEdge: true, blooms: true, granulation: true },
    note: { heightFrac: 1 / 40, lang: 'en' },
    shots: [
      { id: '01', dur: 0.8, what: 'lateral track, patrol through elephant grass, Clawd standing among soldiers filing past' },
      { id: '02', dur: 0.8, what: 'hard cut: down from Huey door, burning LZ, flattened grass, heli shadow, Clawd tiny, slow pull-out' },
      { id: '03', dur: 0.9, what: 'hard cut: close on Clawd pulling back to poster; arms fling to V and sag; napalm sky; soldiers run past; Huey lifts away' },
    ],
  };

  const ev = { cut1, cut2, end: DURATION, fling: cut2 + 0.02 };
  const S = { shot1: [0, cut1], shot2: [cut1, cut2], shot3: [cut2, DURATION] };
  const markers = {
    cut1: { t: cut1, sync: 'av' }, // page turn: paper flip + rotor thump + fire
    cut2: { t: cut2, sync: 'av' }, // page turn: timpani + sub boom + brass, the V pose
    fling: ev.fling,
    end: ev.end,
  };
  // pencil notes (place, time, weather) one per page
  const notes = ['Elephant-grass trail, 0540. Hot haze, no wind.', 'LZ Falcon burning, 0612. Smoke and rotor-wash.', 'Lift-out, 0618. Sky the colour of napalm.'];

  const SCORE = { FPS, FORMAT, W, H, SAFE, SPEED, DURATION, FRAMES, clock, T, BEAT, S, ev, markers, SPEC, notes };
  if (node) module.exports = SCORE; else globalThis.SCORE = SCORE;
})();
