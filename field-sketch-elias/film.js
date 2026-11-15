// THE FILM — three pages of a combat artist's sketchbook. Pure function of t; hard cuts between pages.
(function () {
  const U = globalThis.U, G = globalThis.G, S = globalThis.SCORE, Studio = globalThis.Studio, A = globalThis.Art;
  const { C, W, H, rnd, nz, wash, lift, tinySoldier, pen, penPoly, penEll, hatch, clawd, soldier, blades, rect, ellPts, capsule } = A;
  const { clamp, lerp, ease } = U;
  const SP = S.SPEED;

  // ridge polygon: top edge noise-driven (scrolls with parallax), closed down to `bottom`
  const ridge = (base, amp, freq, seed, scroll, bottom, step = 80) => { const pts = []; for (let x = -80; x <= W + 80; x += step) pts.push([x, base - nz((x + scroll) * freq, seed) * amp]); pts.push([W + 80, bottom], [-80, bottom]); return pts; };
  const tufts = (ctx, base, amp, freq, seed, scroll, step, len, lw, color) => { for (let x = -40; x <= W + 40; x += step) { const y = base - nz((x + scroll) * freq, seed) * amp; for (let k = 0; k < 2; k++) pen(ctx, [[x + k * 9, y + 6], [x + k * 9 + (rnd(seed, x | 0, k) - 0.5) * 14, y - len * (0.5 + rnd(seed, x | 0, k + 5))]], { seed: seed + x + k, lw, color, smooth: false, alpha: 0.9 }); } };

  function flames(ctx, x, y, w, h, seed, a = 0.85) {
    const B = G.boil, pts = [];
    const n = 7;
    for (let i = 0; i <= n * 2; i++) { const f = i / (n * 2), xx = x - w / 2 + f * w, tip = i % 2 === 1, hh = tip ? h * (0.45 + 0.55 * rnd(seed, i, B % 7) ) * Math.sin(Math.PI * f) ** 0.6 : 0; pts.push([xx, y - hh]); }
    pts.push([x + w / 2, y + 14], [x - w / 2, y + 14]);
    lift(ctx, [ellPts(x, y - h * 0.25, w * 0.62, h * 0.7, 10, seed, 0.1)], 0.85, { blur: 9 });
    wash(ctx, [pts], C.hot, { a, seed, bloom: 1, pool: 1, wob: 2, dry: 0, edgeW: 5 });
    wash(ctx, [pts.map((p) => [x + (p[0] - x) * 0.55, y + (p[1] - y) * 0.6])], C.ochre, { a: 0.5, seed: seed + 1, bloom: 0, pool: 0, wob: 1.5 });
    for (let k = 0; k < 4; k++) { const fx = x - w * 0.35 + (k / 3) * w * 0.7, hh = h * (0.5 + 0.5 * rnd(seed, k, B % 5 + 9)); pen(ctx, [[fx, y + 4], [fx - 8, y - hh * 0.4], [fx + 6, y - hh * 0.7], [fx - 2, y - hh]], { seed: seed + k * 3, lw: A.PEN_W * 0.9 }); }
  }
  function plume(ctx, x, y, seed, tau, k = 1, n = 6, a = 0.3, rise = 70) {
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), px = x + Math.sin(tau * 1.5 + i) * 18 * k + f * 60 * k, py = y - (f * rise * n * 0.35 + tau * 26) * k, r = (46 + f * 78) * k;
      wash(ctx, ellPts(px, py, r * 1.15, r * 0.85, 9, seed + i, 0.15), C.smoke, { a: a * (1 - f * 0.4), seed: seed + i, bloom: 1, pool: 0, wob: 4, blur: 2.5 });
    }
  }
  function embers(ctx, seed, n, tau, x0, x1, yBase, rise) {
    ctx.save();
    for (let i = 0; i < n; i++) { const x = lerp(x0, x1, rnd(seed, i, 1)) + Math.sin(tau * 3 + i) * 14, y = yBase - ((rnd(seed, i, 2) * 500 + tau * rise) % 520), r = 1.6 + rnd(seed, i, 3) * 2.6; ctx.fillStyle = rnd(seed, i, 4) > 0.5 ? C.hot : C.ochre; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }

  // ============================== SHOT 1 ==============================
  function shot1(ctx, tau) {
    const cam = tau * 400;
    ctx.save(); ctx.translate(nz(tau * 14, 1) * 2 - 1, nz(tau * 14, 2) * 2 - 1);
    // sky: smoke grey above, hot dawn glow low, a light source
    wash(ctx, rect(-30, -30, W + 60, 420), C.smoke, { a: 0.3, seed: 11, bloom: 2, dry: 5 });
    wash(ctx, [[-30, 210], [W + 30, 190], [W + 30, 540], [-30, 560]], C.hot, { a: 0.58, seed: 12, bloom: 3, pool: 2, dry: 6 });
    lift(ctx, [ellPts(1380 - cam * 0.04, 340, 118, 110, 10, 13, 0.05)], 0.8);
    wash(ctx, ellPts(1380 - cam * 0.04, 340, 120, 112, 10, 13, 0.05), C.hot, { a: 0.55, seed: 13, bloom: 1, pool: 0, wob: 2 });
    penEll(ctx, 1380 - cam * 0.04, 340, 92, 88, { seed: 14, span: 4.4, lw: A.PEN_W * 0.9, alpha: 0.8 });
    for (let k = 0; k < 3; k++) wash(ctx, ellPts(300 + k * 620 - cam * 0.06, 150 + k * 55, 280, 26, 9, 20 + k, 0.1), C.smoke, { a: 0.3, seed: 20 + k, bloom: 1, pool: 0, wob: 5, dry: 2 });
    // far ridge + treeline
    wash(ctx, ridge(470, 120, 0.004, 31, cam * 0.12, 640), C.smoke, { a: 0.5, seed: 31, bloom: 2, dry: 3 });
    tufts(ctx, 470, 120, 0.004, 31, cam * 0.12, 60, 20, A.PEN_W * 0.7, '#4A4448');
    wash(ctx, ridge(540, 70, 0.007, 32, cam * 0.28, 700), C.olive, { a: 0.58, seed: 32, bloom: 2, pool: 2, dry: 3 });
    tufts(ctx, 540, 70, 0.007, 32, cam * 0.28, 44, 26, A.PEN_W * 0.8, '#3A3F1E');
    // mid elephant grass
    wash(ctx, ridge(610, 70, 0.012, 33, cam * 0.5, 840, 60), C.olive, { a: 0.4, seed: 33, bloom: 3, pool: 3, dry: 5 });
    wash(ctx, ridge(690, 40, 0.01, 34, cam * 0.55, 860), C.ochre, { a: 0.4, seed: 34, bloom: 2, pool: 1, dry: 4 });
    blades(ctx, { x0: -60, x1: W + 60, y: 760, hMin: 120, hMax: 230, step: 38, seed: 41, scroll: cam * 0.55, lean: 26, spread: 70, tw: tau, brush: 8, brushCol: C.olive, color: '#4A4F26', alpha: 0.7, lw: A.PEN_W * 0.7 });
    // trail + near grass band
    wash(ctx, [[-30, 800], [W + 30, 790], [W + 30, 930], [-30, 950]], C.ochre, { a: 0.5, seed: 35, bloom: 2, pool: 2, dry: 5 });
    wash(ctx, ridge(900, 36, 0.008, 36, cam * 1.0, 1110), C.olive, { a: 0.55, seed: 36, bloom: 3, pool: 3, dry: 6 });
    // figures, sorted by depth
    const far = [1900, 1560, 1200, 880, 560, 230, -100].map((x0, i) => ({ y: 665, x: x0 - tau * 380, s: 0.52, seed: 200 + i, far: true }));
    const near = [[2050, 862], [1500, 790], [1230, 778], [860, 792], [560, 868], [250, 800]].map(([x0, y], i) => ({ y, x: x0 - tau * 520, s: 0.98, seed: 300 + i }));
    const cl = { y: 850, clawd: true };
    const all = [...far, ...near, cl].sort((a, b) => a.y - b.y);
    for (const f of all) {
      if (f.clawd) { clawd(ctx, 1050, 850 + Math.sin(tau * 9) * 1.5, 1.45, { seed: 7, armL: -1.05, armR: -1.0, eyes: 'calm', look: -0.6, rim: 0.3, shX: 0 }); continue; }
      soldier(ctx, f.x, f.y, f.s, { dir: -1, phase: tau * 11.5 + f.seed * 1.7, seed: f.seed, tone: f.far ? C.smoke : (f.seed % 2 ? '#5B6232' : '#66602F'), fade: f.far ? 0.85 : 1 });
    }
    // foreground blades whipping past
    blades(ctx, { x0: -60, x1: W + 60, y: 1090, hMin: 260, hMax: 420, step: 120, seed: 51, scroll: cam * 1.9, lean: 40, spread: 20, tw: tau, brush: 14, brushCol: C.olive, lw: A.PEN_W * 1.1, color: '#3A3F1E', alpha: 0.85, skip: [700, 1400] });
    blades(ctx, { x0: -60, x1: W + 60, y: 1000, hMin: 90, hMax: 180, step: 70, seed: 52, scroll: cam * 1.3, lean: 22, spread: 60, tw: tau, brush: 9, brushCol: C.ochre, color: '#4A4F26', alpha: 0.7, skip: [760, 1340] });
    ctx.restore();
  }

  // ============================== SHOT 2 ==============================
  function shot2(ctx, tau, u) {
    const z = lerp(1.5, 1.0, ease.outQuad(u)), pv = [1130, 610];
    const g = (x, y) => [pv[0] + (x - pv[0]) * z, pv[1] + (y - pv[1]) * z];
    const gp = (pts) => pts.map((p) => g(p[0], p[1]));
    const sh = nz(tau * 20, 5) * 3 - 1.5;
    ctx.save(); ctx.translate(sh, nz(tau * 20, 6) * 3 - 1.5);
    // ground: elephant grass seen from above
    wash(ctx, rect(-300, -300, W + 600, H + 600).map((p) => g(p[0], p[1])), C.olive, { a: 0.62, seed: 61, bloom: 4, pool: 4, dry: 8 });
    for (let k = 0; k < 9; k++) wash(ctx, gp(ellPts(rnd(62, k) * W, rnd(63, k) * H, 260 + rnd(64, k) * 200, 140 + rnd(65, k) * 120, 9, 66 + k, 0.2)), k % 2 ? C.ochre : '#5E6634', { a: k % 2 ? 0.36 : 0.3, seed: 70 + k, bloom: 1, pool: 1, wob: 8, dry: 2 });
    // outside the clearing: standing grass as short tick marks
    const cx = 1130, cy = 620, rx = 560, ry = 340;
    for (let i = 0; i < 520; i++) {
      const x = rnd(80, i, 1) * (W + 200) - 100, y = rnd(80, i, 2) * (H + 200) - 100, q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (q < 1.15) continue;
      const a = g(x, y), L = 14 + rnd(80, i, 3) * 16 * z;
      pen(ctx, [a, [a[0] + (rnd(80, i, 4) - 0.5) * 8, a[1] - L]], { seed: i, lw: A.PEN_W * 0.75, smooth: false, flick: false, alpha: 0.75 });
    }
    // flattened clearing + rotor-wash swirl
    lift(ctx, gp(ellPts(cx, cy, rx, ry, 14, 90, 0.07, -0.08)), 0.55, { blur: 12 });
    wash(ctx, gp(ellPts(cx, cy, rx, ry, 14, 90, 0.07, -0.08)), C.ochre, { a: 0.7, seed: 90, bloom: 3, pool: 2, wob: 6, dry: 4 });
    wash(ctx, gp(ellPts(cx, cy, rx * 0.62, ry * 0.62, 12, 91, 0.08)), '#E2C27C', { a: 0.4, seed: 91, bloom: 2, pool: 1, wob: 6 });
    for (let i = 0; i < 44; i++) {
      const th0 = (i / 44) * 6.283 + tau * 0.9 + rnd(92, i) * 0.2, r0 = 0.12 + rnd(92, i, 2) * 0.5, pts = [];
      for (let j = 0; j < 5; j++) { const r = r0 + j * 0.13 * (0.6 + rnd(92, i, 3)), th = th0 + j * 0.16; pts.push(g(cx + Math.cos(th) * rx * r, cy + Math.sin(th) * ry * r)); }
      if (r0 > 0.9) continue; pen(ctx, pts, { seed: 300 + i, lw: A.PEN_W * 0.8, alpha: 0.85, flickLen: 10 });
    }
    // fires + burnt rings + smoke
    const fires = [[420, 330, 1.0], [1560, 300, 1.2], [1740, 760, 0.9], [330, 800, 1.1], [1000, 150, 0.8]];
    fires.forEach(([fx, fy, k], i) => { const p = g(fx, fy); wash(ctx, ellPts(p[0], p[1] + 10, 230 * k * z, 120 * k * z, 10, 110 + i, 0.15), C.smoke, { a: 0.3, seed: 110 + i, bloom: 1, pool: 1, wob: 6, dry: 2 }); });
    fires.forEach(([fx, fy, k], i) => { const p = g(fx, fy); flames(ctx, p[0], p[1] + 14, 250 * k * z, 150 * k * z, 120 + i * 7); });
    fires.forEach(([fx, fy, k], i) => { const p = g(fx, fy); plume(ctx, p[0] + 30 * z, p[1] - 80 * z, 140 + i * 9, tau, k * z, 5, 0.26, 80); });
    // Huey shadow sliding toward the clearing
    const sp = ease.inOutQuad(clamp(tau / 0.8)), sxp = lerp(520, 960, sp), syp = lerp(300, 540, sp), c = g(sxp, syp), k = z * lerp(0.9, 1.1, sp), rot = 0.3;
    const R = (px, py) => [c[0] + (px * Math.cos(rot) - py * Math.sin(rot)) * k, c[1] + (px * Math.sin(rot) + py * Math.cos(rot)) * k];
    wash(ctx, ellPts(c[0], c[1], 340 * k, 84 * k, 14, 130, 0.03, rot), C.smoke, { a: 0.26, seed: 130, bloom: 0, pool: 0, wob: 2, blur: 6, edge: 0 }); // rotor disc, faint
    wash(ctx, [ellPts(...R(0, 0), 120 * k, 30 * k, 10, 131, 0.05, rot), [R(110, -6), R(330, -14), R(332, 2), R(112, 12)], [R(320, -34), R(340, -34), R(338, 28), R(318, 28)], [R(-20, -40), R(-120, -30), R(-120, -26), R(-20, -34)]], '#4A4448', { a: 0.82, seed: 132, bloom: 0, pool: 2, wob: 1.2, blur: 1.6 });
    penPoly(ctx, [R(-110, 8), R(110, 8), R(130, -20), R(-100, -26)], { seed: 133, over: 6, lw: A.PEN_W, closed: false });
    pen(ctx, [R(-300, -60), R(300, 60)], { seed: 134, lw: A.PEN_W * 0.9, alpha: 0.7, flickLen: 14 }); pen(ctx, [R(-310, 50), R(300, -50)], { seed: 135, lw: A.PEN_W * 0.9, alpha: 0.6 });
    hatch(ctx, ellPts(...R(0, 0), 100 * k, 24 * k, 8, 136, 0, rot), { seed: 137, gap: 7, zig: true, angle: -0.5, alpha: 0.7 });
    // tiny soldiers scattering, tiny Clawd in the clearing
    for (let i = 0; i < 7; i++) { const a = 1.2 + i * 0.9, r = (0.45 + rnd(140, i) * 0.5), p = g(cx + Math.cos(a) * rx * r * 0.8, cy + Math.sin(a) * ry * r * 0.8 + 20); tinySoldier(ctx, p[0], p[1], 0.16 * z, { dir: i % 2 ? 1 : -1, phase: tau * 12 + i, seed: 400 + i }); }
    clawd(ctx, pv[0], pv[1] + 26 * z, 0.27 * z, { seed: 9, armL: 0.9, armR: 1.1, eyes: 'wide', rim: 0.5, shX: 70 });
    ctx.restore();
    // door of the Huey (fixed to the camera, not the ground)
    const dx = nz(tau * 25, 8) * 2.5, dy = nz(tau * 25, 9) * 2.5;
    ctx.save(); ctx.translate(dx, dy);
    wash(ctx, [[-60, -60], [W + 60, -60], [W + 60, 70], [900, 84], [-60, 104]], C.smoke, { a: 0.86, seed: 150, bloom: 1, pool: 2, wob: 2, dry: 1 });
    wash(ctx, [[-60, -60], [44, -60], [62, H + 60], [-60, H + 60]], C.smoke, { a: 0.7, seed: 151, bloom: 1, pool: 2, wob: 2 });
    wash(ctx, capsule([1480, 92], [1960, 190], 26, 22), '#4A4448', { a: 0.88, seed: 152, bloom: 0, pool: 1, wob: 1, edgeW: 4 });
    wash(ctx, capsule([1640, 120], [1690, 40], 14, 12), '#4A4448', { a: 0.85, seed: 153, bloom: 0, pool: 0, wob: 1, edgeW: 3 });
    wash(ctx, [capsule([330, -10], [340, 150], 62, 46), capsule([470, -10], [466, 140], 58, 44)], C.olive, { a: 0.72, seed: 154, bloom: 0, pool: 1, wob: 1.5 });
    wash(ctx, [[[300, 140], [372, 140], [386, 204], [296, 206]], [[438, 130], [504, 132], [512, 196], [430, 198]]], '#3A3235', { a: 0.82, seed: 155, bloom: 0, pool: 0, wob: 1 });
    penPoly(ctx, [[-30, 100], [900, 82], [1400, 76]], { closed: false, seed: 156, over: 12, lw: A.PEN_W * 1.3 });
    penPoly(ctx, [[44, 0], [62, H]], { closed: false, seed: 157, over: 8, lw: A.PEN_W * 1.3 });
    penPoly(ctx, capsule([1480, 92], [1960, 190], 26, 22), { seed: 158, over: 8, lw: A.PEN_W * 1.1, skip: [1, 3] });
    for (const bx of [330, 470]) penPoly(ctx, [[bx - 28, -4], [bx - 20, 148], [bx + 22, 146], [bx + 28, -4]], { closed: false, seed: bx, over: 6, lw: A.PEN_W });
    penPoly(ctx, [[296, 146], [384, 142], [392, 206], [292, 208]], { seed: 159, over: 4, lw: A.PEN_W });
    penPoly(ctx, [[430, 136], [512, 134], [516, 198], [428, 202]], { seed: 160, over: 4, lw: A.PEN_W });
    hatch(ctx, [[-20, 0], [900, 0], [900, 70], [-20, 90]], { seed: 161, gap: 12, angle: -0.6, zig: true, alpha: 0.8 });
    ctx.restore();
  }

  // ============================== SHOT 3 ==============================
  function heli(ctx, cx, cy, s, rot, ph) {
    const R = (x, y) => [cx + (x * Math.cos(rot) - y * Math.sin(rot)) * s, cy + (x * Math.sin(rot) + y * Math.cos(rot)) * s];
    const body = [R(-140, -6), R(-120, -52), R(-50, -64), R(30, -58), R(70, -34), R(86, -2), R(40, 22), R(-90, 26)];
    const boom = [R(70, -30), R(300, -22), R(304, -6), R(74, 0)], fin = [R(284, -22), R(318, -62), R(330, -58), R(310, -6)];
    wash(ctx, ellPts(...R(-10, -78), 360 * s, 14 * s, 14, 171, 0.02, rot), C.smoke, { a: 0.3, seed: 171, bloom: 0, pool: 0, wob: 1, blur: 4, edge: 0 }); // rotor blur
    wash(ctx, [body, boom, fin, capsule(R(-8, -64), R(-8, -80), 14 * s, 12 * s)], '#3E383C', { a: 0.9, seed: 172, bloom: 0, pool: 1, wob: 1, edgeW: 4 });
    wash(ctx, [[R(-132, -10), R(-118, -46), R(-84, -52), R(-86, -8)]], C.ochre, { a: 0.35, seed: 173, bloom: 0, pool: 0, wob: 0.5 }); // glass catching light
    penPoly(ctx, body, { seed: 174, over: 6, lw: A.PEN_W * 1.1 }); penPoly(ctx, boom, { seed: 175, over: 5, lw: A.PEN_W, skip: [3] });
    penPoly(ctx, fin, { seed: 176, over: 4, lw: A.PEN_W * 0.9 });
    pen(ctx, [R(-120, -78), R(-8, -82), R(110, -78)], { seed: 177, lw: A.PEN_W * 1.1 }); pen(ctx, [R(-330, -92), R(-8, -80), R(330, -70)], { seed: 178 + (ph | 0), lw: A.PEN_W * 0.9, alpha: 0.7, flickLen: 16 });
    pen(ctx, [R(-120, 44), R(60, 40)], { seed: 179, lw: A.PEN_W * 1.1 }); pen(ctx, [R(-70, 26), R(-76, 44)], { seed: 180, lw: A.PEN_W, smooth: false }); pen(ctx, [R(10, 26), R(6, 42)], { seed: 181, lw: A.PEN_W, smooth: false });
    penEll(ctx, ...R(318, -34), 30 * s, 30 * s, { seed: 182, lw: A.PEN_W * 0.8, alpha: 0.7, span: 5 });
    hatch(ctx, body, { seed: 183, gap: 9, zig: true, angle: -0.9, color: '#F2ECDE', alpha: 0.25 });
  }

  function shot3(ctx, tau, u) {
    const z = lerp(1.6, 1.0, ease.outCubic(u)), pv = [960, 640];
    const g = (x, y) => [pv[0] + (x - pv[0]) * z, pv[1] + (y - pv[1]) * z];
    const gp = (pts) => pts.map((p) => g(p[0], p[1]));
    ctx.save(); ctx.translate(nz(tau * 18, 11) * 2 - 1, nz(tau * 18, 12) * 2 - 1);
    // napalm sky
    wash(ctx, rect(-60, -60, W + 120, 800), C.hot, { a: 0.78, seed: 201, bloom: 3, pool: 3, dry: 8, edgeW: 9 });
    lift(ctx, gp(ellPts(960, 520, 640, 330, 12, 203, 0.1)), 0.55, { blur: 16 });
    wash(ctx, [[-60, 400], [W + 60, 420], [W + 60, 780], [-60, 780]], C.ochre, { a: 0.3, seed: 202, bloom: 3, pool: 2, dry: 5 });
    wash(ctx, gp(ellPts(960, 560, 520, 330, 12, 203, 0.1)), C.ochre, { a: 0.45, seed: 203, bloom: 2, pool: 1, wob: 8, dry: 3 }); // glow behind the figure
    wash(ctx, gp(ellPts(520, 110, 520, 80, 10, 204, 0.12)), C.smoke, { a: 0.32, seed: 204, bloom: 1, pool: 1, wob: 8, dry: 2 });
    wash(ctx, gp(ellPts(1700, 70, 460, 70, 10, 205, 0.12)), C.smoke, { a: 0.34, seed: 205, bloom: 1, pool: 1, wob: 8, dry: 2 });
    // smoke columns rising off the horizon
    for (const [bx, k, sd] of [[230, 1, 210], [1540, 0.85, 215], [800, 0.6, 220]]) {
      const base = g(bx, 700), col = [[base[0] - 70 * k * z, base[1]], [base[0] - 130 * k * z - tau * 8, base[1] - 300 * z], [base[0] - 40 * k * z, base[1] - 640 * z], [base[0] + 90 * k * z, base[1] - 640 * z], [base[0] + 150 * k * z + tau * 8, base[1] - 280 * z], [base[0] + 70 * k * z, base[1]]];
      wash(ctx, col, C.smoke, { a: 0.4, seed: sd, bloom: 2, pool: 2, wob: 10, dry: 3, blur: 2.5 });
      hatch(ctx, col, { seed: sd + 1, gap: 24, angle: -1.35, alpha: 0.5 });
    }
    // flaming treeline
    wash(ctx, gp(ridge(690, 56, 0.012, 230, 0, 800)), C.smoke, { a: 0.66, seed: 230, bloom: 1, pool: 2, dry: 2 });
    for (const [fx, k, sd] of [[340, 1.3, 240], [650, 0.9, 241], [1250, 1.0, 242], [1620, 1.4, 243]]) { const p = g(fx, 700); flames(ctx, p[0], p[1], 240 * k * z, 190 * k * z, sd); }
    const rp = gp([[-40, 700]])[0]; void rp;
    for (let x = -40; x <= W + 40; x += 32) { const pp = g(x, 690 - nz(x * 0.012, 230) * 56); pen(ctx, [[pp[0], pp[1] + 6], [pp[0] + (rnd(231, x | 0) - 0.5) * 12, pp[1] - 26 * z * (0.5 + rnd(232, x | 0))]], { seed: x, lw: A.PEN_W * 0.9, smooth: false, alpha: 0.9 }); }
    embers(ctx, 250, 34, tau, 100, 1800, 720, 120);
    // ground
    wash(ctx, gp([[-80, 742], [W + 80, 730], [W + 80, 1200], [-80, 1200]]), C.olive, { a: 0.64, seed: 250, bloom: 3, pool: 3, dry: 6 });
    wash(ctx, gp([[-80, 860], [W + 80, 850], [W + 80, 1200], [-80, 1200]]), C.ochre, { a: 0.32, seed: 251, bloom: 3, pool: 2, dry: 5 });
    // helicopter climbing away, rotor wash pushing the grass out
    const hu = ease.inOutQuad(u), hx = lerp(1450, 1700, hu), hy = lerp(340, 170, hu), hs = lerp(0.95, 0.6, hu);
    heli(ctx, ...g(hx, hy), hs * z, -0.1 - hu * 0.05, tau * 9);
    blades(ctx, { x0: -60, x1: W + 60, y: 800 * z - 640 * (z - 1) + 40, hMin: 90, hMax: 170, step: 40, seed: 261, scroll: 0, lean: 0, spread: 40, tw: tau, brush: 8, brushCol: C.olive, color: '#4A4F26', alpha: 0.7, lw: A.PEN_W * 0.7 });
    // soldiers run past on both sides (far rank behind Clawd)
    const run = (x, y, s, dir, seed) => soldier(ctx, ...g(x, y), s * z, { dir, run: true, phase: tau * 13 + seed, seed, tone: '#4C5228' });
    const sp = (v, x0) => x0 + v * tau;
    run(sp(560, 80), 806, 0.62, 1, 501); run(sp(-540, 1860), 800, 0.62, -1, 502); run(sp(-480, 1420), 790, 0.52, -1, 503); run(sp(520, 380), 792, 0.52, 1, 504);
    // Clawd: arms fling up into the V, then sag as the Huey climbs
    const ts = tau, a = ts < 0.14 ? lerp(-0.4, 1.4, ease.outQuad(ts / 0.14)) : ts < 0.46 ? lerp(1.4, 0.98, ease.inOutQuad((ts - 0.14) / 0.32)) : lerp(0.98, 0.82, clamp((ts - 0.46) / 0.42));
    const jump = Math.sin(clamp(ts / 0.3) * Math.PI) * 26, sag = 1 - 0.02 * clamp((ts - 0.4) / 0.4);
    const cp = g(960, 962 - jump);
    clawd(ctx, cp[0], cp[1], 2.1 * z, { seed: 11, armL: a - 0.04 * Math.sin(ts * 30), armR: a + 0.03, armLen: 175, armW: 46, eyes: 'wide', mouth: 'open', mouthOpen: lerp(1, 0.6, clamp(ts / 0.9)), rim: 0.6, bodyA: 0.85, sy: sag, look: 0, shX: 40 });
    // foreground: the near soldiers pounding past left and right, and whipped grass
    run(sp(520, -240), 1030, 1.5, 1, 511); run(sp(-520, 2200), 1040, 1.45, -1, 512);
    blades(ctx, { x0: -60, x1: W + 60, y: 1120, hMin: 160, hMax: 300, step: 110, seed: 271, scroll: 0, lean: 0, spread: 20, tw: tau, brush: 14, brushCol: C.olive, lw: A.PEN_W * 1.1, color: '#3A3F1E', alpha: 0.85, skip: [640, 1300] });
    ctx.restore();
  }

  Studio.film({
    duration: S.DURATION,
    fadeOut: 0,
    init: () => A.init(),
    post: { paper: 0.3, vignette: 0.1, grain: 0.05 },
    draw(ctx, t) {
      const f = Math.floor(t * S.FPS + 1e-6), shot = f < S.FRAMES[0] ? 0 : f < S.FRAMES[0] + S.FRAMES[1] ? 1 : 2;
      const start = [0, S.FRAMES[0], S.FRAMES[0] + S.FRAMES[1]][shot], tau = ((f - start) / S.FPS) * SP, u = (f - start) / (S.FRAMES[shot] - 1);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
      ctx.save(); A.pageClip(ctx, shot + 1);
      [shot1, shot2, shot3][shot](ctx, tau, u);
      ctx.restore();
      A.pencilNote(ctx, S.notes[shot]);
    },
  });
})();
