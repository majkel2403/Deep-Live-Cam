// ART — the pen-and-wash toolkit: fast flicked pen lines, hatching, transparent washes with wet edges,
// blooms and granulation (offset a few px from the line), plus Clawd and the soldiers.
(function () {
  const U = globalThis.U, G = globalThis.G, Ch = globalThis.Ch;
  const W = 1920, H = 1080;
  const { clamp, lerp } = U;
  const C = { paper: '#F2ECDE', pen: '#231A14', olive: '#70783E', ochre: '#CEA054', smoke: '#706C70', hot: '#F0822E' };
  const rnd = (...a) => G.rnd(...a);
  const nz = (x, seed) => { const i = Math.floor(x), f = x - i, a = rnd(seed, i), b = rnd(seed, i + 1), u = f * f * (3 - 2 * f); return a + (b - a) * u; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a, k = 0) => { const v = hex(h).map((x) => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k))); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
  const PEN_W = W / 600; // ~1/600 of frame width

  let SC = null, PIG = null;
  function init() {
    SC = G.makeCanvas(2100, 1300);
    const N = 256, c = G.makeCanvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N);
    const grids = [[5, 0.5, 71], [12, 0.3, 72], [40, 0.2, 73]].map(([g, w, sd]) => ({ g, w, a: Array.from({ length: g * g }, (_, i) => rnd(sd, i)) }));
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      let v = 0;
      for (const { g, w, a } of grids) {
        const fx = (px / N) * g, fy = (py / N) * g, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const A = a[(iy % g) * g + (ix % g)], B = a[(iy % g) * g + ((ix + 1) % g)], Cc = a[(((iy + 1) % g)) * g + (ix % g)], D = a[(((iy + 1) % g)) * g + ((ix + 1) % g)];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        v += w * (A + (B - A) * sx + (Cc - A) * sy + (A - B - Cc + D) * sx * sy);
      }
      const i = (py * N + px) * 4; img.data[i + 3] = clamp((v - 0.42) * 2.2) * 150;
    }
    x.putImageData(img, 0, 0);
    PIG = c;
  }

  // ---------- geometry ----------
  const dens = (p, seg = 70) => { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / seg)); for (let j = 0; j < n; j++) o.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]); } return o; };
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const ellPts = (cx, cy, rx, ry, n = 10, seed = 1, amp = 0.08, rot = 0) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = 1 + (rnd(seed, i) - 0.5) * 2 * amp, x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  const capsule = (a, b, w0, w1) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; return [[a[0] + nx * w0 / 2, a[1] + ny * w0 / 2], [b[0] + nx * w1 / 2, b[1] + ny * w1 / 2], [b[0] - nx * w1 / 2, b[1] - ny * w1 / 2], [a[0] - nx * w0 / 2, a[1] - ny * w0 / 2]]; };
  const inPoly = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  function smoothPath(x, p) {
    const n = p.length; if (n < 3) return;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(p[n - 1], p[0]); x.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(p[i], p[(i + 1) % n]); x.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]); }
    x.closePath();
  }

  // ---------- WASH: transparent, soft wet edge, darker pooled rim, blooms, granulation, brush gaps ----------
  function wash(ctx, polys, color, o = {}) {
    if (!Array.isArray(polys[0][0])) polys = [polys];
    const A = o.a ?? 0.6, seed = o.seed ?? 1, pad = 14, wob = o.wob ?? 2.5;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    x0 = Math.max(x0, -60); y0 = Math.max(y0, -60); x1 = Math.min(x1, W + 60); y1 = Math.min(y1, H + 60);
    const w = Math.ceil(x1 - x0) + pad * 2, h = Math.ceil(y1 - y0) + pad * 2;
    if (x1 - x0 < 1 || y1 - y0 < 1 || w > SC.width || h > SC.height) return;
    const sx = SC.getContext('2d');
    sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over'; sx.filter = 'none';
    sx.clearRect(0, 0, w, h); sx.translate(pad - x0, pad - y0);
    const paths = polys.map((p, pi) => dens(p, o.seg ?? 70).map((q, i) => [q[0] + (rnd(seed, pi * 211 + i, 1) - 0.5) * 2 * wob, q[1] + (rnd(seed, pi * 211 + i, 2) - 0.5) * 2 * wob]));
    const mk = () => { sx.beginPath(); paths.forEach((p) => smoothPath(sx, p)); };
    sx.fillStyle = color; mk(); sx.fill();
    sx.globalCompositeOperation = 'source-atop'; sx.strokeStyle = rgba(color, o.edge ?? 0.5, -0.3); sx.lineWidth = o.edgeW ?? 7; sx.lineJoin = 'round'; mk(); sx.stroke();
    const bw = x1 - x0, bh = y1 - y0, big = Math.max(bw, bh);
    for (let k = 0; k < (o.pool ?? 2); k++) { // darker pooled pigment
      const cx = x0 + rnd(seed, k, 3) * bw, cy = y0 + rnd(seed, k, 4) * bh, r = big * (0.1 + 0.14 * rnd(seed, k, 5)) + 12;
      const g = sx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(color, 0.3, -0.35)); g.addColorStop(1, rgba(color, 0, -0.35));
      sx.fillStyle = g; sx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    sx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < (o.bloom ?? 2); k++) { // blooms: water pushes pigment away, paper shows through
      const cx = x0 + rnd(seed, k, 6) * bw, cy = y0 + rnd(seed, k, 7) * bh, r = big * (0.08 + 0.16 * rnd(seed, k, 8)) + 10;
      const g = sx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.7, 'rgba(0,0,0,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      sx.fillStyle = g; sx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const pat = sx.createPattern(PIG, 'repeat'); // uneven pigment
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.floor(rnd(seed, 9) * 256), Math.floor(rnd(seed, 10) * 256)]));
    sx.fillStyle = pat; sx.fillRect(x0 - pad, y0 - pad, w, h);
    sx.strokeStyle = 'rgba(0,0,0,0.6)'; // dry-brush gaps
    for (let k = 0; k < (o.dry ?? 0); k++) {
      const yy = y0 + rnd(seed, k, 11) * bh, xx = x0 + rnd(seed, k, 12) * bw * 0.9, L = 60 + rnd(seed, k, 13) * Math.min(260, bw * 0.4);
      sx.lineWidth = 1.2 + rnd(seed, k, 14) * 2.6; sx.beginPath(); sx.moveTo(xx, yy); sx.lineTo(xx + L, yy + (rnd(seed, k, 15) - 0.5) * 6); sx.stroke();
    }
    sx.restore();
    const ox = o.ox ?? 2 + 2 * rnd(seed, 20), oy = o.oy ?? 2 + 2 * rnd(seed, 21); // offset 2-4 px from the pen line
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = A; ctx.filter = `blur(${o.blur ?? 1.2}px)`;
    ctx.drawImage(SC, 0, 0, w, h, x0 - pad + ox, y0 - pad + oy, w, h);
    ctx.globalAlpha = A * 0.2; ctx.filter = 'blur(7px)';
    ctx.drawImage(SC, 0, 0, w, h, x0 - pad + ox, y0 - pad + oy, w, h);
    ctx.restore();
  }

  // lifted pigment: a soft paper-coloured patch (blotted out wash) so bright washes stay clean over dark ones
  function lift(ctx, polys, a = 0.6, o = {}) {
    if (!Array.isArray(polys[0][0])) polys = [polys];
    ctx.save(); ctx.fillStyle = '#EEDDB0'; ctx.globalAlpha = a * 0.55; ctx.filter = `blur(${o.blur ?? 7}px)`;
    ctx.beginPath(); polys.forEach((p) => smoothPath(ctx, dens(p, 60))); ctx.fill(); ctx.restore();
  }

  // ---------- PEN: fast confident line, taper in, flick out ----------
  function cr(pts, step) {
    const out = [], n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t, f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([f(0), f(1)]);
      }
    }
    out.push(pts[n - 1]); return out;
  }
  const sub = (pts, step) => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let j = 0; j < n; j++) o.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]); } o.push(pts[pts.length - 1]); return o; };
  function pen(ctx, pts, o = {}) {
    if (pts.length < 2) return;
    const lw = o.lw ?? PEN_W, seed = o.seed ?? 1, amp = o.amp ?? 0.8, B = G.boil;
    let P = o.smooth === false || pts.length < 3 ? sub(pts, 14) : cr(pts, 9);
    P = P.map((p, i) => [p[0] + (nz(i * 0.3 + B * 5.3, seed * 7 + 1) - 0.5) * 2 * amp, p[1] + (nz(i * 0.3 + B * 5.3 + 50, seed * 7 + 2) - 0.5) * 2 * amp]);
    if (o.flick !== false) {
      const a = P[P.length - 2], b = P[P.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, f = (o.flickLen ?? 7) + lw * 2 + rnd(seed, 5) * 5, r = (rnd(seed, 6) - 0.5) * 0.5;
      const ux = (dx * Math.cos(r) - dy * Math.sin(r)) / l, uy = (dx * Math.sin(r) + dy * Math.cos(r)) / l;
      P.push([b[0] + ux * f * 0.5, b[1] + uy * f * 0.5], [b[0] + ux * f, b[1] + uy * f]);
    }
    ctx.save(); ctx.strokeStyle = o.color ?? C.pen; ctx.globalAlpha *= o.alpha ?? 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const n = P.length - 1;
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1);
      ctx.lineWidth = lw * (u < 0.1 ? 0.6 + 4 * u : u > 0.8 ? lerp(1, 0.25, (u - 0.8) / 0.2) : 1 + 0.2 * Math.sin(i * 0.9 + seed));
      ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[i + 1][0], P[i + 1][1]); ctx.stroke();
    }
    ctx.restore();
  }
  // edges drawn as separate strokes that overshoot their corners
  function penPoly(ctx, pts, o = {}) {
    const n = pts.length, closed = o.closed !== false, over = o.over ?? 5, skip = o.skip || [], sd = o.seed ?? 1;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      if (skip.includes(i)) continue;
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const oa = over * (0.4 + rnd(sd, i, 1)), ob = over * (0.4 + rnd(sd, i, 2)), bow = (rnd(sd, i, 3) - 0.5) * Math.min(3, l * 0.05);
      pen(ctx, [[a[0] - ux * oa, a[1] - uy * oa], [(a[0] + b[0]) / 2 - uy * bow, (a[1] + b[1]) / 2 + ux * bow], [b[0] + ux * ob, b[1] + uy * ob]], { ...o, seed: sd * 31 + i });
    }
  }
  function penEll(ctx, cx, cy, rx, ry, o = {}) {
    const a0 = o.a0 ?? rnd(o.seed ?? 1, 77) * 6.28, span = o.span ?? 6.5, n = Math.max(6, Math.round(span * 3)), rot = o.rot ?? 0, pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * span, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
    pen(ctx, pts, o);
  }
  // quick hatching / zigzags confined to a polygon, ends flicked
  function hatch(ctx, poly, o = {}) {
    const ang = o.angle ?? -0.9, gap = o.gap ?? 9, sd = o.seed ?? 1, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
    let idx = 0;
    for (let k = -R; k < R; k += gap * (0.8 + 0.4 * rnd(sd, idx++))) {
      const bx = cx + nx * k, by = cy + ny * k; let run = null;
      const flush = () => { if (run && run[1] - run[0] > 8) { const ta = run[0] + rnd(sd, idx, 5) * 0.2 * (run[1] - run[0]), tb = run[1] - rnd(sd, idx, 6) * 0.15 * (run[1] - run[0]); const pts = []; if (o.zig) { let s = 1; for (let t = ta; t <= tb; t += gap * 0.9) { pts.push([bx + dx * t + nx * s * gap * 0.45, by + dy * t + ny * s * gap * 0.45]); s = -s; } } else pts.push([bx + dx * ta, by + dy * ta], [bx + dx * tb, by + dy * tb]); if (pts.length > 1) pen(ctx, pts, { lw: o.lw ?? PEN_W * 0.7, seed: sd * 13 + idx, smooth: false, color: o.color, alpha: o.alpha }); } run = null; };
      for (let t = -R; t <= R; t += 5) { if (inPoly(poly, bx + dx * t, by + dy * t)) { if (!run) run = [t, t]; run[1] = t; } else flush(); }
      flush();
    }
  }

  // ---------- CLAWD as Elias: boonie hat, dog tags ----------
  function clawd(ctx, X, Y, s, o = {}) {
    const bw = 210, bh = 145, legH = 46, top = -legH - bh, mid = -legH - bh / 2, seed = o.seed ?? 5, detail = s > 0.6, tiny = s < 0.45;
    const rot = o.rot ?? 0, cs = Math.cos(rot), sn = Math.sin(rot), SX = o.sx ?? 1, SY = o.sy ?? 1;
    const Q = (x, y) => [X + (x * cs - y * sn) * s * SX, Y + (x * sn + y * cs) * s * SY];
    const poly = (arr) => arr.map((p) => Q(p[0], p[1]));
    const aL = o.armL ?? -1, aR = o.armR ?? -1, armLen = o.armLen ?? 78, sw = o.swing ?? 0;
    const arm = (side, a) => { const b = [side * (bw / 2 - 8), mid + 4], d = [side * Math.cos(a), -Math.sin(a)]; return capsule(Q(b[0], b[1]), Q(b[0] + d[0] * armLen, b[1] + d[1] * armLen), (o.armW ?? 40) * s, (o.armW ?? 40) * 0.85 * s); };
    const armsP = [arm(-1, aL), arm(1, aR)];
    const body = poly([[-bw / 2 + 8, top], [bw / 2 - 8, top], [bw / 2, top + 8], [bw / 2, -legH - 8], [bw / 2 - 8, -legH], [-bw / 2 + 8, -legH], [-bw / 2, -legH - 8], [-bw / 2, top + 8]]);
    const legs = [-82, -54, 54, 82].map((lx) => poly([[lx - 9, -legH - 6], [lx + 9, -legH - 6], [lx + 9 + (lx > 0 ? sw : -sw) * 0, 0], [lx - 9, 0]]));
    if (o.shadow !== false) wash(ctx, ellPts(X + (o.shX ?? 0) * s, Y + 3 * s, 120 * s * SX, 15 * s, 10, seed + 1, 0.05), C.smoke, { a: 0.32, seed: seed + 2, bloom: 0, pool: 0, wob: 1 });
    wash(ctx, [...legs, ...armsP, body], C.ochre, { a: o.bodyA ?? 0.66, seed: seed + 3, bloom: 2, pool: 2, wob: 1.8, edgeW: 6 }); // skin: diluted ochre
    if (o.rim) { const sd = o.rim > 0 ? 1 : -1; wash(ctx, [poly([[sd * (bw / 2 - 38), top], [sd * bw / 2, top], [sd * bw / 2, -legH], [sd * (bw / 2 - 38), -legH]]), armsP[sd > 0 ? 1 : 0]], C.hot, { a: Math.abs(o.rim) * 0.55, seed: seed + 4, bloom: 1, pool: 0, wob: 1 }); } // hot light from the sky
    wash(ctx, ellPts(...Q(0, mid + 10), 100 * s, 64 * s, 8, seed + 5, 0.1), C.ochre, { a: 0.28, seed: seed + 6, bloom: 1, pool: 0, wob: 1 }); // second glaze on the face
    // hat: boonie, drooping brim
    const brim = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 6.283; return Q(Math.cos(a) * (150 + (rnd(seed, i) - 0.5) * 6), top + 10 + Math.sin(a) * 30 + Math.cos(a) ** 2 * 14); });
    const crown = poly([[-84, top + 10], [-80, top - 38], [-52, top - 68], [0, top - 76], [52, top - 68], [80, top - 38], [84, top + 10], [0, top + 22]]);
    wash(ctx, [brim], C.olive, { a: 0.7, seed: seed + 7, bloom: 1, pool: 1, wob: 1.5 });
    wash(ctx, [crown], C.olive, { a: 0.5, seed: seed + 8, bloom: 1, pool: 1, wob: 1.5 });
    // dog tags
    const tagC = Q(0, -62);
    wash(ctx, [poly([[-16, -74], [4, -76], [6, -46], [-14, -44]]), poly([[2, -70], [24, -66], [22, -36], [2, -40]])], C.smoke, { a: 0.7, seed: seed + 9, bloom: 0, pool: 0, wob: 0.8, edgeW: 4 });
    // ---- pen ----
    const L = PEN_W, lwS = tiny ? L * 0.75 : L;
    penPoly(ctx, poly([[-bw / 2, top], [bw / 2, top], [bw / 2, -legH], [-bw / 2, -legH]]), { seed: seed * 3, over: tiny ? 3 : 8, lw: L * 1.1 });
    for (const lx of [-82, -54, 54, 82]) penPoly(ctx, poly([[lx - 9, -legH], [lx + 9, -legH], [lx + 9, 0], [lx - 9, 0]]), { seed: seed + lx, over: 4, lw: lwS, skip: [0] });
    for (const a of armsP) penPoly(ctx, a, { seed: seed + 40 + a[0][0] | 0, over: 4, lw: lwS, skip: [1, 3] }), pen(ctx, [a[1], a[2]], { seed: seed + 41, lw: lwS, smooth: false });
    if (!tiny) { // brim and crown linework
      penPoly(ctx, brim, { seed: seed + 50, over: 6, lw: L * 1.05 });
      pen(ctx, [Q(-84, top + 4), Q(-40, top - 2), Q(0, top - 1), Q(40, top - 2), Q(84, top + 4)], { seed: seed + 51, lw: L });
      penPoly(ctx, crown.slice(0, 7), { seed: seed + 52, over: 5, closed: false, lw: L });
      if (detail) { penEll(ctx, ...Q(0, top + 12), 126 * s, 24 * s, { seed: seed + 53, lw: L * 0.7, span: 4.2, a0: 0.4, alpha: 0.8 }); penEll(ctx, ...Q(0, top + 12), 108 * s, 20 * s, { seed: seed + 54, lw: L * 0.6, span: 3.6, a0: 0.7, alpha: 0.7 }); }
      // chain + tags
      pen(ctx, [Q(-92, top + 18), Q(-70, -122), Q(-40, -84), Q(0, -70), Q(40, -84), Q(70, -122), Q(92, top + 18)], { seed: seed + 60, lw: L * 0.75, flick: false });
      for (const tg of [[[-16, -74], [4, -76], [6, -46], [-14, -44]], [[2, -70], [24, -66], [22, -36], [2, -40]]]) penPoly(ctx, poly(tg), { seed: seed + 61 + tg[0][0], over: 2, lw: L * 0.8 });
      pen(ctx, [Q(-9, -68), Q(-9, -54)], { seed: seed + 62, lw: L * 0.5, color: '#FFFFFF', alpha: o.rim ? 0.9 : 0.5 });
    } else { pen(ctx, [Q(-84, top + 4), Q(0, top - 2), Q(84, top + 4)], { seed: seed + 51, lw: lwS }); pen(ctx, [Q(-84, top + 4), Q(-70, top - 50), Q(0, top - 74), Q(70, top - 50), Q(84, top + 4)], { seed: seed + 52, lw: lwS }); }
    // eyes + mouth
    const ex = 50, ey = mid - 12, eyes = o.eyes ?? 'calm', lk = (o.look ?? 0) * 8;
    ctx.save(); ctx.fillStyle = C.pen;
    for (const sd of [-1, 1]) {
      const cx = sd * ex + lk;
      if (eyes === 'squint') pen(ctx, [Q(cx - 14, ey - 4 * sd), Q(cx + 14, ey + 4 * sd)], { seed: seed + 70 + sd, lw: L * 1.8, flick: false });
      else { const w = eyes === 'wide' ? 32 : 22, h = eyes === 'wide' ? 50 : 38; ctx.beginPath(); smoothPath(ctx, dens(poly([[cx - w / 2, ey - h / 2], [cx + w / 2, ey - h / 2], [cx + w / 2, ey + h / 2], [cx - w / 2, ey + h / 2]]), 8)); ctx.fill(); if (!tiny) pen(ctx, [Q(cx - w / 2 + 6, ey - h / 2 + 8), Q(cx - w / 2 + 6, ey - h / 2 + 18)], { seed: seed + 72 + sd, lw: L * 1.2, color: '#F2ECDE', flick: false }); }
    }
    ctx.restore();
    if (o.mouth === 'open') {
      const m = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); m.push(Q(Math.cos(a) * 34 + lk, mid + 20 + Math.sin(a) * 38 * (o.mouthOpen ?? 1))); }
      ctx.save(); ctx.fillStyle = C.pen; ctx.beginPath(); m.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.restore();
      wash(ctx, ellPts(...Q(lk, mid + 54), 20 * s, 10 * s, 7, seed + 80, 0.05), C.hot, { a: 0.55, seed: seed + 81, bloom: 0, pool: 0, wob: 0.5, blur: 0.6 });
      pen(ctx, m, { seed: seed + 82, lw: L, smooth: true });
    } else if (!tiny) pen(ctx, [Q(-12 + lk, mid + 26), Q(lk, mid + 30), Q(12 + lk, mid + 26)], { seed: seed + 83, lw: L });
    if (detail) { // hatching: shadow side, under the brim, under the arms
      hatch(ctx, poly([[bw / 2 - 52, top + 16], [bw / 2 - 4, top + 16], [bw / 2 - 4, -legH - 4], [bw / 2 - 52, -legH - 4]]), { seed: seed + 90, gap: 8.5, angle: -0.95, zig: true });
      hatch(ctx, poly([[-bw / 2 + 6, top + 24], [-bw / 2 + 36, top + 24], [-bw / 2 + 36, top + 50], [-bw / 2 + 6, top + 50]]), { seed: seed + 91, gap: 8, angle: -0.8 });
      hatch(ctx, poly([[-100, -legH - 24], [100, -legH - 24], [100, -legH - 4], [-100, -legH - 4]]), { seed: seed + 92, gap: 9, angle: -1.0 });
      hatch(ctx, brim.slice(4, 9), { seed: seed + 93, gap: 8, angle: -0.7 });
    }
  }

  // ---------- SOLDIERS: profile figures, walking or running ----------
  function soldier(ctx, X, Y, s, o = {}) {
    const d = o.dir ?? 1, run = o.run ? 1 : 0, ph = o.phase ?? 0, seed = o.seed ?? 1, tone = o.tone ?? C.olive, aMul = o.fade ?? 1, detail = s > 0.6;
    const lean = run ? 34 : 10, hipL = [0, -158], shL = [lean, -262];
    const legs = [0, 1].map((i) => {
      const q = ph + i * Math.PI, th = Math.sin(q) * (run ? 0.85 : 0.5), flex = Math.max(0, Math.cos(q + 0.5)) * (run ? 1.15 : 0.6) + 0.05;
      const knee = [hipL[0] + Math.sin(th) * 80, hipL[1] + Math.cos(th) * 80], sa = th - flex, foot = [knee[0] + Math.sin(sa) * 78, knee[1] + Math.cos(sa) * 78];
      return { knee, foot };
    });
    const dy = -Math.max(legs[0].foot[1], legs[1].foot[1]) + (run ? -Math.abs(Math.sin(ph)) * 12 : 0);
    const P = (p) => [X + p[0] * d * s, Y + (p[1] + dy) * s];
    const hip = P(hipL), sh = P(shL), tl = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]) || 1, nx = -(sh[1] - hip[1]) / tl, ny = (sh[0] - hip[0]) / tl;
    const torso = [[sh[0] + nx * 24 * s, sh[1] + ny * 24 * s], [sh[0] - nx * 24 * s, sh[1] - ny * 24 * s], [hip[0] - nx * 21 * s, hip[1] - ny * 21 * s], [hip[0] + nx * 21 * s, hip[1] + ny * 21 * s]];
    const Qd = (dx, dyy) => P([shL[0] + dx, shL[1] + dyy]);
    const pack = [Qd(-46, -4), Qd(-14, -14), Qd(-10, 86), Qd(-44, 92)];
    const hc = Qd(10, -36);
    const helmet = [Qd(-22, -30), Qd(-16, -52), Qd(6, -62), Qd(28, -54), Qd(38, -34), Qd(48, -27), Qd(-22, -22)];
    const face = ellPts(hc[0] + 6 * d * s, hc[1] + 8 * s, 15 * s, 19 * s, 8, seed, 0.05);
    const sho = Qd(2, 8);
    const hands = [Qd(44, run ? 36 : 58), run ? Qd(-24 + Math.sin(ph) * 18, 40) : Qd(8 + Math.sin(ph) * 36, 92)];
    const arms = hands.map((h, i) => { const ik = Ch.ik(sho, h, 62 * s, 58 * s, d); return [capsule(sho, ik.E, 22 * s, 19 * s), capsule(ik.E, ik.H, 19 * s, 15 * s)]; });
    const legP = legs.map((l, i) => [capsule(hip, P(l.knee), 28 * s, 22 * s), capsule(P(l.knee), P(l.foot), 21 * s, 16 * s)]);
    const boots = legs.map((l) => { const f = l.foot; return [P([f[0] - 10, f[1] - 18]), P([f[0] + 16, f[1] - 12]), P([f[0] + 28, f[1] + 6]), P([f[0] - 12, f[1] + 6])]; });
    const rifle = capsule(Qd(-34, 74), Qd(78, 42), 10 * s, 8 * s);
    wash(ctx, [torso, ...legP.flat(), ...arms.flat()], tone, { a: 0.62 * aMul, seed: seed + 1, bloom: 1, pool: 1, wob: 1.2, edgeW: 5 });
    wash(ctx, [pack, ...boots, rifle], C.smoke, { a: 0.58 * aMul, seed: seed + 2, bloom: 0, pool: 1, wob: 1, edgeW: 4 });
    wash(ctx, [helmet], tone, { a: 0.78 * aMul, seed: seed + 3, bloom: 0, pool: 1, wob: 1, edgeW: 4 });
    wash(ctx, [face, ellPts(...hands[0], 9 * s, 9 * s, 6, seed, 0.05)], C.ochre, { a: 0.5 * aMul, seed: seed + 4, bloom: 0, pool: 0, wob: 0.6, edgeW: 3 });
    const lw = PEN_W * (s < 0.5 ? 0.8 : 1);
    penPoly(ctx, torso, { seed: seed + 10, over: 2, lw }); penPoly(ctx, pack, { seed: seed + 11, over: 2, lw });
    for (const [a, b] of legP) { penPoly(ctx, a, { seed: seed + 12, over: 1.5, lw, skip: [1, 3] }); penPoly(ctx, b, { seed: seed + 13, over: 1.5, lw, skip: [1, 3] }); }
    for (const [a, b] of arms) { penPoly(ctx, a, { seed: seed + 14, over: 1.5, lw, skip: [1, 3] }); penPoly(ctx, b, { seed: seed + 15, over: 1.5, lw, skip: [1, 3] }); }
    for (const b of boots) penPoly(ctx, b, { seed: seed + 16, over: 1.5, lw });
    penPoly(ctx, helmet, { seed: seed + 17, over: 4, lw: lw * 1.1 });
    pen(ctx, [Qd(-34, 74), Qd(30, 58), Qd(78, 42)], { seed: seed + 18, lw: lw * 1.5 });
    if (detail) {
      pen(ctx, [Qd(24, -22), Qd(27, -18)], { seed: seed + 19, lw: lw * 1.3, flick: false });
      pen(ctx, [Qd(36, -14), Qd(42, -10), Qd(36, -8)], { seed: seed + 20, lw: lw * 0.8 });
      hatch(ctx, [torso[0], torso[3], hip, [(sh[0] + hip[0]) / 2, (sh[1] + hip[1]) / 2]], { seed: seed + 21, gap: 11, angle: -0.95 });
    }
  }

  function tinySoldier(ctx, x, y, s, o = {}) {
    const d = o.dir ?? 1, ph = o.phase ?? 0, sd = o.seed ?? 1, k = 330 * s;
    wash(ctx, [ellPts(x, y - k * 0.5, k * 0.17, k * 0.3, 7, sd, 0.1, d * 0.3)], C.olive, { a: 0.8, seed: sd, bloom: 0, pool: 0, wob: 0.5, blur: 0.8, edge: 0.2 });
    ctx.save(); ctx.fillStyle = C.pen; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x + d * k * 0.06, y - k * 0.88, k * 0.1, 0, 6.283); ctx.fill(); ctx.restore();
    const st = Math.sin(ph) * k * 0.2;
    pen(ctx, [[x, y - k * 0.25], [x + st, y]], { seed: sd + 1, lw: PEN_W * 0.9, smooth: false }); pen(ctx, [[x, y - k * 0.25], [x - st, y]], { seed: sd + 2, lw: PEN_W * 0.9, smooth: false });
    pen(ctx, [[x - d * k * 0.1, y - k * 0.7], [x + d * k * 0.4, y - k * 0.5]], { seed: sd + 3, lw: PEN_W * 0.8, smooth: false });
  }

  // ---------- grass: flicked blades, seen from the side ----------
  function blades(ctx, o) {
    const { skip, x0, x1, y, hMin, hMax, step, seed, scroll = 0, lean = 0, color = C.pen, lw = PEN_W * 0.85, brush = 0, brushCol = C.olive, tw = 0, alpha = 1 } = o;
    const i0 = Math.floor((scroll + x0) / step) - 2, i1 = Math.ceil((scroll + x1) / step) + 2;
    for (let i = i0; i <= i1; i++) {
      const wx = i * step + rnd(seed, i, 1) * step, x = wx - scroll, by = y + (rnd(seed, i, 2) - 0.5) * (o.spread ?? 40), h = lerp(hMin, hMax, rnd(seed, i, 3));
      if (skip && x > skip[0] && x < skip[1]) continue;
      const lf = lean + (rnd(seed, i, 4) - 0.5) * 40 + Math.sin(tw * 5 + wx * 0.011) * 8;
      const pts = [[x, by], [x + lf * 0.25, by - h * 0.5], [x + lf * 0.7, by - h * 0.85], [x + lf + (lean > 0 ? 6 : -6), by - h]];
      if (brush) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; pen(ctx, pts.map((p) => [p[0] + 3, p[1] + 2]), { seed: seed + i, lw: brush * (0.7 + rnd(seed, i, 6) * 0.6), color: brushCol, alpha: 0.4 * alpha, flick: false, amp: 0.4 }); ctx.restore(); }
      pen(ctx, pts, { seed: seed * 5 + i, lw: lw * (0.8 + rnd(seed, i, 5) * 0.5), color, alpha, amp: 0.5 });
    }
  }

  // ---------- page ----------
  function pageClip(ctx, page) {
    const L = 14 + rnd(page, 1) * 8, R = 14 + rnd(page, 2) * 8, T = 14 + rnd(page, 3) * 8, B = 40 + rnd(page, 4) * 10, pts = [];
    const j = (k, i) => (rnd(page, k, i) - 0.5) * 5;
    for (let x = L; x <= W - R; x += 60) pts.push([x, T + j(5, x)]);
    for (let y = T; y <= H - B; y += 60) pts.push([W - R + j(6, y), y]);
    for (let x = W - R; x >= L; x -= 60) pts.push([x, H - B + j(7, x)]);
    for (let y = H - B; y >= T; y -= 60) pts.push([L + j(8, y), y]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.clip();
  }
  function pencilNote(ctx, text) {
    const size = H / 40; // 1/40 of frame height
    ctx.save(); ctx.font = G.font(size, 'Caveat', 700); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(72,68,66,0.88)';
    ctx.fillText(text, 44, H - 14); ctx.fillStyle = 'rgba(72,68,66,0.3)'; ctx.fillText(text, 44.8, H - 13.4);
    pen(ctx, [[40, H - 8], [420, H - 7.4]], { seed: 3, lw: 1.1, color: 'rgba(72,68,66,0.4)', alpha: 0.5, flick: false, smooth: false });
    ctx.restore();
  }

  globalThis.Art = { C, W, H, rnd, nz, init, wash, lift, tinySoldier, pen, penPoly, penEll, hatch, clawd, soldier, blades, rect, ellPts, capsule, dens, pageClip, pencilNote, rgba, PEN_W };
})();
