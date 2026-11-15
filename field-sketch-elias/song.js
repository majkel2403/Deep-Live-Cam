// THE SCORE, SOUNDS — synthesized from score.js events: grass hiss, boots, rotor chop, fire, paper page-turns,
// timpani + brass. Everything is real time (the film is already at 1.1x).
const path = require('path');
const { SR, Bus, reverb } = require('./engine/audio/dsp');
const I = require('./engine/audio/instruments');
const MIX = require('./engine/audio/mix');
const sc = require('./score');
const { DURATION, ev } = sc;
const { m } = require('./engine/music');
const N = Math.ceil(DURATION * SR);
const bus = () => new Bus(N);
const pad = bus(), perc = bus(), fx = bus(), brass = bus(), chop = bus(), verb = bus();
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// rotor chop: low-passed noise amplitude-modulated at the blade rate, plus a thump per blade
function rotor(len, f0, f1, seed) {
  const n = Math.round(len * SR), out = new Float32Array(n), r = mulberry(seed);
  let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 + (f1 - f0) * (t / len); ph += f / SR;
    const blade = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 3);
    lp += 0.12 * ((r() * 2 - 1) - lp);
    out[i] = (lp * 2.4 * blade + 0.55 * blade * Math.sin(2 * Math.PI * 58 * t)) * Math.min(1, t * 20) * Math.min(1, (len - t) * 10);
  }
  return out;
}
const stepsT = []; for (let t = 0.04; t < ev.cut1 - 0.02; t += 0.105) stepsT.push(t);

// ---- shot 1: low drone, grass hiss, boots ----
for (const n of ['D2', 'A2', 'D3', 'F3']) { const { L, R } = I.padNote(m(n), DURATION - 0.05, { cutoff: 700, attack: 0.5, release: 0.5 }); pad.addStereo(L, R, 0, 0.12); }
fx.addMono(I.noiseSweep(ev.cut1, 1800, 900, { q: 0.6, pink: true }), 0, 0.16); // wind in the grass
stepsT.forEach((t, i) => { fx.addMono(I.thud(70, 0.05), t, 0.16, i % 2 ? -0.3 : 0.3); fx.addMono(I.noiseSweep(0.07, 2600, 900, { q: 0.8, pink: true }), t, 0.12, i % 2 ? 0.4 : -0.4); });
chop.addMono(rotor(ev.cut1 - 0.35, 6, 9, 11), 0.35, 0.05); // far-off rotor, barely
// ---- cut 1: page turn, rotor close, fire ----
fx.addMono(I.paperFwip(1.0, 31), ev.cut1 - 0.045, 0.5);
fx.addMono(I.thud(60, 0.12), ev.cut1, 0.9);
perc.addMono(I.timpani(m('D2'), { decay: 0.8 }), ev.cut1, 0.5);
chop.addMono(rotor(ev.cut2 - ev.cut1, 10.5, 11.5, 21), ev.cut1, 0.55);
fx.addMono(I.vinyl(ev.cut2 - ev.cut1, { crackle: 14, hiss: 0.6, seed: 5 }), ev.cut1, 1.0); // burning grass crackle
fx.addMono(I.noiseSweep(ev.cut2 - ev.cut1 - 0.02, 300, 2600, { q: 0.8, shape: (x) => x * x, pink: true }), ev.cut1, 0.3);
for (const n of ['D3', 'F3', 'A3']) { const b = I.brassNote(m(n), 0.65, { bright: 0.35 }); brass.addStereo(b.L, b.R, ev.cut1 + 0.05, 0.09); }
// ---- cut 2: page turn, the V, the lift ----
fx.addMono(I.paperFwip(0.9, 32), ev.cut2 - 0.045, 0.5);
fx.addMono(I.subBoom(1.6), ev.cut2, 0.8);
perc.addMono(I.timpani(m('D2'), { decay: 1.2 }), ev.cut2, 0.75);
perc.addMono(I.timpani(m('A2'), { decay: 1.0 }), ev.cut2 + 0.005, 0.5);
fx.addMono(I.noiseSweep(0.22, 600, 4200, { q: 0.9, pink: true }), ev.fling, 0.35); // arms fling up
for (const [n, g] of [['D3', 0.34], ['A3', 0.28], ['D4', 0.3], ['F4', 0.24], ['A4', 0.2]]) { const b = I.brassNote(m(n), DURATION - ev.cut2 - 0.05, { bright: 0.5 }); brass.addStereo(b.L, b.R, ev.cut2 + 0.02, g); verb.addStereo(b.L, b.R, ev.cut2 + 0.02, g * 0.4); }
chop.addMono(rotor(DURATION - ev.cut2, 11, 8, 41), ev.cut2, 0.5); // the Huey lifting away: blades slow, fade
const stems = { pad, perc, fx, brass, chop, verb: reverb(verb, { room: 0.8, damp: 0.4 }) };
const GAIN = { pad: 1.8, perc: 1, fx: 1, brass: 1.5, chop: 1.6, verb: 1 };
const out = path.join(__dirname, 'out');
const mix = MIX.mixdown(stems, GAIN, { stemDir: process.env.STEMS ? out : null });
MIX.highpass(mix, 25);
MIX.fadeOut(mix, DURATION - 0.35, DURATION);
const M = MIX.master(mix, parseFloat(process.env.DRIVE || '0.8'), undefined, { lufs: process.env.LUFS ? parseFloat(process.env.LUFS) : null });
MIX.writeWav(path.join(out, 'music.wav'), mix);
console.log(`wrote out/music.wav (${DURATION.toFixed(2)}s${M.lufs !== undefined ? `, ${M.lufs.toFixed(1)} LUFS` : ''})`);
