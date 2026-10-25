/* Installation: formatering og små SVG-grafer (viserdiagram, oscilloskop, spektrum) */
(function () {
'use strict';
const M = window.Inst;
const NF = [0, 1, 2, 3].map(d => new Intl.NumberFormat('da-DK', {minimumFractionDigits: d, maximumFractionDigits: d}));
function fmt(v, d = 1, sign = false) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < 0.5 * 10 ** -d) v = 0;
  return (v < 0 ? '−' : sign && v > 0 ? '+' : '') + NF[d].format(Math.abs(v));
}
const fmtS = v => fmt(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
// Antal decimaler efter størrelsen, som på et instrument
const fmtA = v => fmt(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const sub = s => esc(s).replace(/_(\w+)/g, '<sub>$1</sub>');
const PHC = ['var(--l1)', 'var(--l2)', 'var(--l3)'];
const r1 = v => Math.round(v * 10) / 10;

function niceMax(m) {
  if (m <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(m)), f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/* Viserdiagram for en tavle: fasepunkterne, nulpunktet N og PE, målt mod fjern jord */
/* Viserdiagram for en tavle: trekanten L1–L2–L3, tavlens nulpunkt N med spændingerne som pile og det ideelle nulpunkt.
   o.trail er nulpunktets tidligere positioner (ældste først). Forskydningen tegnes som en stiplet blå pil. */
function phasorSVG(o) {
  const pts = [...o.corners.map(c => c.p), o.n, o.ideal].concat(o.pe ? [o.pe] : []);
  const ext = Math.max(260, ...pts.map(p => Math.hypot(p.re, p.im) * 1.12));
  const S = 118 / ext, cx = 150, cy = 146;
  const X = p => r1(cx + p.re * S), Y = p => r1(cy - p.im * S);
  let s = `<svg viewBox="0 0 300 292" class="phasor" role="img" aria-label="Viserdiagram for spændingerne i tavlen">`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r1(M.U_NOM * S)}" fill="none" stroke="var(--grid)" stroke-dasharray="3 4"/>`;
  if (o.corners.length === 3) s += `<polygon points="${o.corners.map(c => `${X(c.p)},${Y(c.p)}`).join(' ')}" fill="var(--panel-2)" stroke="var(--line)"/>`;
  // Nulpunktets spor: nyere stykker er tydeligere
  if (o.trail && o.trail.length) {
    const tr = o.trail.concat([o.n]), m = tr.length - 1;
    for (let i = 1; i <= m; i++) {
      const a = tr[i - 1], b = tr[i];
      if (Math.hypot(X(a) - X(b), Y(a) - Y(b)) < 0.3) continue;
      s += `<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="var(--n)" stroke-width="1.6" stroke-linecap="round" stroke-opacity="${r1(0.15 + 0.55 * i / m)}"/>`;
    }
    o.trail.forEach((p, i) => { if (p.dot) s += `<circle cx="${X(p)}" cy="${Y(p)}" r="2.6" fill="var(--n)" fill-opacity="${r1(0.25 + 0.5 * (i + 1) / tr.length)}"/>`; });
  }
  // ideelt nulpunkt
  s += `<circle cx="${X(o.ideal)}" cy="${Y(o.ideal)}" r="5" fill="none" stroke="var(--muted)" stroke-dasharray="2 2"/>`;
  // Forskydningen fra det ideelle nulpunkt til N
  const dx = X(o.n) - X(o.ideal), dy = Y(o.n) - Y(o.ideal), dl = Math.hypot(dx, dy);
  if (dl > 14) {
    const ux = dx / dl, uy = dy / dl, x1 = X(o.n) - ux * 7, y1 = Y(o.n) - uy * 7;
    s += `<line x1="${X(o.ideal)}" y1="${Y(o.ideal)}" x2="${r1(x1)}" y2="${r1(y1)}" stroke="var(--n)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    s += `<polygon points="${r1(x1 + ux * 2)},${r1(y1 + uy * 2)} ${r1(x1 - ux * 6 - uy * 3.5)},${r1(y1 - uy * 6 + ux * 3.5)} ${r1(x1 - ux * 6 + uy * 3.5)},${r1(y1 - uy * 6 - ux * 3.5)}" fill="var(--n)"/>`;
  }
  for (const c of o.corners) {
    const x0 = X(o.n), y0 = Y(o.n), x1 = X(c.p), y1 = Y(c.p), L = Math.hypot(x1 - x0, y1 - y0);
    if (L > 4) {
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = 9, hw = 4.5;
      s += `<line x1="${x0}" y1="${y0}" x2="${r1(x1 - ux * hl * .8)}" y2="${r1(y1 - uy * hl * .8)}" stroke="${PHC[c.k]}" stroke-width="2.6" stroke-linecap="round"/>`;
      s += `<polygon points="${x1},${y1} ${r1(x1 - ux * hl - uy * hw)},${r1(y1 - uy * hl + ux * hw)} ${r1(x1 - ux * hl + uy * hw)},${r1(y1 - uy * hl - ux * hw)}" fill="${PHC[c.k]}"/>`;
    }
    // Navnet står uden for trekanten, i retning væk fra midten
    const ox = x1 - cx, oy = y1 - cy, ol = Math.hypot(ox, oy) || 1;
    const lx = r1(x1 + ox / ol * 22), ly = r1(y1 + oy / ol * 14);
    s += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" class="ph-lbl" fill="${PHC[c.k]}">L${c.k + 1} ${fmt(c.v, 0)} V</text>`;
  }
  if (o.pe) {
    s += `<line x1="${cx - 7}" y1="${cy}" x2="${cx + 7}" y2="${cy}" stroke="var(--muted)" stroke-width="1.5"/><line x1="${cx - 4}" y1="${cy + 3}" x2="${cx + 4}" y2="${cy + 3}" stroke="var(--muted)" stroke-width="1.5"/>`;
    s += `<circle cx="${X(o.pe)}" cy="${Y(o.pe)}" r="4.5" fill="var(--pe-g)" stroke="var(--panel)" stroke-width="1.5"/>`;
    if (Math.hypot(o.pe.re - o.n.re, o.pe.im - o.n.im) > 3) s += `<text x="${X(o.pe) + 8}" y="${Y(o.pe) + 10}" class="ph-lbl" fill="var(--pe-g)">PE</text>`;
  }
  s += `<circle cx="${X(o.n)}" cy="${Y(o.n)}" r="5.5" fill="var(--n)" stroke="var(--panel)" stroke-width="1.5"/>`;
  s += `<text x="${X(o.n) + 8}" y="${Y(o.n) - 8}" class="ph-lbl" fill="var(--n)">N</text>`;
  return s + '</svg>';
}

/* Én periode (20 ms) af en eller flere kurver. Hver kurve er {label, color, s: serie, dash} */
function scopeSVG(curves, unit, title) {
  const W = 320, H = 150, L = 40, R = 312, T = 12, B = 128;
  const N = 120, samples = curves.map(c => { const a = []; for (let i = 0; i <= N; i++) a.push(M.wave(c.s, i / N * 360)); return a; });
  const m = niceMax(Math.max(1e-6, ...samples.flat().map(Math.abs)) * 1.05);
  const X = i => r1(L + i / N * (R - L)), Y = v => r1((T + B) / 2 - v / m * (B - T) / 2);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="scope" role="img" aria-label="${esc(title || 'Kurveform')}">`;
  for (const q of [0, 90, 180, 270, 360]) { const x = r1(L + q / 360 * (R - L)); s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${B}" stroke="var(--grid)"/>`; }
  for (const v of [m, m / 2, 0, -m / 2, -m]) s += `<line x1="${L}" y1="${Y(v)}" x2="${R}" y2="${Y(v)}" stroke="${v === 0 ? 'var(--axis)' : 'var(--grid)'}"/>`;
  for (const v of [m, 0, -m]) s += `<text x="${L - 5}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle" class="sc-lbl">${v ? fmtA(v) : '0'}${v === m ? ` ${unit}` : ''}</text>`;
  for (const [q, t] of [[0, '0'], [180, '10'], [360, '20 ms']]) s += `<text x="${r1(L + q / 360 * (R - L))}" y="${H - 6}" text-anchor="${q === 360 ? 'end' : q ? 'middle' : 'start'}" class="sc-lbl">${t}</text>`;
  curves.forEach((c, j) => {
    const d = samples[j].map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join('');
    s += `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="${c.w || 2}" stroke-linejoin="round"${c.dash ? ` stroke-dasharray="${c.dash}"` : ''}/>`;
  });
  s += '</svg>';
  const legend = curves.map(c => `<span><i style="--c:${c.color}"></i>${sub(c.label)}</span>`).join('');
  return `<figure class="scope-fig">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}${s}<div class="sc-legend">${legend}</div></figure>`;
}

/* Søjler for grundtone og harmoniske */
function spectrumSVG(series, unit, color, title) {
  const W = 320, H = 130, L = 10, R = 310, T = 18, B = 104;
  const vals = series.map(x => ({h: x.h, v: Math.hypot(x.re, x.im)}));
  const m = Math.max(1e-9, ...vals.map(x => x.v));
  const bw = (R - L) / vals.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="spectrum" role="img" aria-label="${esc(title || 'Harmoniske')}">`;
  s += `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="var(--axis)"/>`;
  vals.forEach((x, i) => {
    const hgt = x.v / m * (B - T), xx = r1(L + i * bw + bw * 0.2), w = r1(bw * 0.6);
    s += `<rect x="${xx}" y="${r1(B - hgt)}" width="${w}" height="${r1(Math.max(hgt, 0.5))}" rx="2" fill="${color}" opacity="${x.h === 1 ? 1 : 0.8}"/>`;
    if (x.v / m > 0.004) s += `<text x="${r1(xx + w / 2)}" y="${r1(B - hgt - 4)}" text-anchor="middle" class="sc-lbl">${fmtA(x.v)}</text>`;
    s += `<text x="${r1(xx + w / 2)}" y="${B + 12}" text-anchor="middle" class="sc-lbl">${x.h}.</text>`;
    s += `<text x="${r1(xx + w / 2)}" y="${B + 23}" text-anchor="middle" class="sc-lbl sc-dim">${x.h * 50}</text>`;
  });
  s += '</svg>';
  return `<figure class="scope-fig">${title ? `<figcaption>${esc(title)} <span class="muted">(${unit}, orden og Hz)</span></figcaption>` : ''}${s}</figure>`;
}

/* Tid-strøm-kurve for en gruppeafbryder (log-log) med markerede driftspunkter {I, label, color} */
function tcSVG(prot, points) {
  const In = +prot.slice(1), k = prot[0] === 'B' ? 5 : 10;
  const W = 320, H = 214, L = 46, R = 310, T = 10, B = 172;
  const lx = x => r1(L + Math.log10(Math.min(Math.max(x, 1), 100)) / 2 * (R - L));
  const ly = t => r1(T + (4 - Math.log10(Math.min(Math.max(t, 0.005), 10000))) / (4 - Math.log10(0.005)) * (B - T));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="tc" role="img" aria-label="Tid-strøm-kurve for ${prot}">`;
  for (const t of [0.01, 0.1, 1, 10, 100, 1000, 10000]) {
    s += `<line x1="${L}" y1="${ly(t)}" x2="${R}" y2="${ly(t)}" stroke="var(--grid)"/>`;
    s += `<text x="${L - 5}" y="${ly(t)}" text-anchor="end" dominant-baseline="middle" class="sc-lbl">${t >= 1 ? fmt(t, 0) : fmt(t, t >= 0.1 ? 1 : 2)} s</text>`;
  }
  for (const x of [1, 2, 5, 10, 20, 50, 100]) {
    s += `<line x1="${lx(x)}" y1="${T}" x2="${lx(x)}" y2="${B}" stroke="var(--grid)"/>`;
    s += `<text x="${lx(x)}" y="${B + 12}" text-anchor="middle" class="sc-lbl">${x}×</text>`;
    s += `<text x="${lx(x)}" y="${B + 23}" text-anchor="middle" class="sc-lbl sc-dim">${fmtS(x * In)} A</text>`;
  }
  s += `<text x="${R}" y="${H - 2}" text-anchor="end" class="sc-lbl">I / I<tspan baseline-shift="sub" font-size="7">n</tspan></text>`;
  // Kurven: termisk del, magnetisk lodret fald, momentan del
  const pts = [];
  for (let i = 0; i <= 40; i++) { const x = 1.14 * Math.pow((k - 0.001) / 1.14, i / 40); pts.push(`${lx(x)},${ly(M.mcbTime(prot, x))}`); }
  pts.push(`${lx(k)},${ly(0.01)}`, `${lx(100)},${ly(0.01)}`);
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += `<line x1="${lx(1.13)}" y1="${T}" x2="${lx(1.13)}" y2="${B}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
  s += `<text x="${lx(1.13) + 4}" y="${T + 9}" class="sc-lbl">udløser ikke under 1,13 · I<tspan baseline-shift="sub" font-size="7">n</tspan></text>`;
  for (const p of points) {
    const x = p.I / In, t = M.mcbTime(prot, x), y = isFinite(t) ? ly(t) : T + 38;
    s += `<line x1="${lx(x)}" y1="${B}" x2="${lx(x)}" y2="${y}" stroke="${p.color}" stroke-dasharray="2 2"/>`;
    s += `<circle cx="${lx(x)}" cy="${y}" r="4.5" fill="${p.color}" stroke="var(--panel)" stroke-width="1.5"/>`;
    const right = lx(x) < R - 110;
    s += `<text x="${lx(x) + (right ? 7 : -7)}" y="${y - 7}" text-anchor="${right ? 'start' : 'end'}" class="tc-lbl" fill="${p.color}">${esc(p.label)}</text>`;
  }
  return s + '</svg>';
}

/* Lækstrømmene fra hver fase som visere i mA og deres sum, som HPFI'en ser.
   o.ph: [{k, I}] med komplekse strømme, o.other: fejlstrøm, der ikke er lækstrøm fra apparater (fx en isolationsfejl).
   Viserne tegnes fra midten og desuden i forlængelse af hinanden (stiplet), så man kan se, hvordan de ophæver hinanden. */
function arrowSVG(x0, y0, x1, y1, color, w, dash) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 3) return '';
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(9, L * 0.45), hw = hl / 2;
  return `<line x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(x1 - ux * hl * .8)}" y2="${r1(y1 - uy * hl * .8)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}" stroke-opacity=".75"` : ''}/>` +
    `<polygon points="${r1(x1)},${r1(y1)} ${r1(x1 - ux * hl - uy * hw)},${r1(y1 - uy * hl + ux * hw)} ${r1(x1 - ux * hl + uy * hw)},${r1(y1 - uy * hl - ux * hw)}" fill="${color}"${dash ? ' fill-opacity=".75"' : ''}/>`;
}
function leakSVG(o) {
  const parts = o.ph.filter(p => Math.hypot(p.I.re, p.I.im) > 1e-4).map(p => ({c: PHC[p.k], I: p.I, t: `L${p.k + 1} ${fmt(Math.hypot(p.I.re, p.I.im), 1)} mA`}));
  if (o.other && Math.hypot(o.other.re, o.other.im) > 0.05) parts.push({c: 'var(--warn)', I: o.other, t: `fejl ${fmt(Math.hypot(o.other.re, o.other.im), 1)} mA`});
  const sum = parts.reduce((a, p) => ({re: a.re + p.I.re, im: a.im + p.I.im}), {re: 0, im: 0}), cum = [];
  parts.reduce((a, p) => { const b = {re: a.re + p.I.re, im: a.im + p.I.im}; cum.push(b); return b; }, {re: 0, im: 0});
  const ext = Math.max(0.5, ...parts.map(p => Math.hypot(p.I.re, p.I.im)), ...cum.map(p => Math.hypot(p.re, p.im))) * 1.18;
  const cx = 150, cy = 118, S = 92 / ext, X = p => cx + p.re * S, Y = p => cy - p.im * S;
  let s = `<svg viewBox="0 0 300 236" class="leak-svg" role="img" aria-label="Lækstrømmene fra faserne som visere og deres sum">`;
  s += `<line x1="${cx - 104}" y1="${cy}" x2="${cx + 104}" y2="${cy}" stroke="var(--grid)"/><line x1="${cx}" y1="${cy - 104}" x2="${cx}" y2="${cy + 104}" stroke="var(--grid)"/>`;
  // I forlængelse af hinanden
  let a = {re: 0, im: 0};
  if (parts.length > 1) parts.forEach((p, i) => { const b = cum[i]; s += arrowSVG(X(a), Y(a), X(b), Y(b), p.c, 1.6, '4 3'); a = b; });
  // Fra midten, med navn og størrelse uden for spidsen
  for (const p of parts) {
    const tip = {re: p.I.re, im: p.I.im}, x1 = X(tip), y1 = Y(tip), ox = x1 - cx, oy = y1 - cy, ol = Math.hypot(ox, oy) || 1;
    s += arrowSVG(cx, cy, x1, y1, p.c, 2.4);
    s += `<text x="${r1(Math.min(262, Math.max(38, x1 + ox / ol * 30)))}" y="${r1(y1 + oy / ol * 13)}" text-anchor="middle" dominant-baseline="middle" class="ph-lbl" fill="${p.c}">${p.t}</text>`;
  }
  const sm = Math.hypot(sum.re, sum.im);
  if (sm * S > 4) s += arrowSVG(cx, cy, X(sum), Y(sum), 'var(--combo)', 3.4);
  s += `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/>`;
  s += `<text x="150" y="230" text-anchor="middle" class="ph-lbl" fill="var(--combo)">I<tspan baseline-shift="sub" font-size="8">Δ</tspan> = ${fmt(sm, sm < 10 ? 1 : 0)} mA${parts.length > 1 ? ' (summen af viserne)' : ''}</text>`;
  return s + '</svg>';
}
/* Lækstrømmen i forhold til HPFI'ens I_ΔN: I orden under 30 %, for høj til 50 %, kan udløse fra 50 % */
function rcdGaugeSVG(mA, IdN, surge) {
  const L = 14, R = 306, T = 26, H = 12, X = v => r1(L + Math.min(v / IdN, 1.04) / 1.04 * (R - L));
  let s = `<svg viewBox="0 0 320 70" class="gauge" role="img" aria-label="Lækstrøm ${fmt(mA, 1)} mA af ${fmt(IdN, 0)} mA">`;
  [[0, .3, 'var(--good)'], [.3, .5, 'var(--warn)'], [.5, 1, 'var(--bad)']].forEach(([a, b, c]) => { s += `<rect x="${X(a * IdN)}" y="${T}" width="${r1(X(b * IdN) - X(a * IdN))}" height="${H}" fill="${c}" fill-opacity=".22"/>`; });
  s += `<rect x="${L}" y="${T}" width="${r1(X(IdN) - L)}" height="${H}" fill="none" stroke="var(--line)" rx="2"/>`;
  for (const f of [0, .3, .5, 1]) s += `<line x1="${X(f * IdN)}" y1="${T}" x2="${X(f * IdN)}" y2="${T + H + 4}" stroke="var(--axis)"/><text x="${X(f * IdN)}" y="${T + H + 14}" text-anchor="${f === 1 ? 'end' : f ? 'middle' : 'start'}" class="sc-lbl">${f === 1 ? `${fmt(IdN, 0)} mA` : f ? `${fmt(f * IdN, IdN * f % 1 ? 1 : 0)}` : '0'}</text>`;
  if (surge > 0) {
    const xs = X(mA + surge);
    s += `<line x1="${X(mA)}" y1="${T + H / 2}" x2="${xs}" y2="${T + H / 2}" stroke="var(--ink)" stroke-dasharray="2 2"/><circle cx="${xs}" cy="${T + H / 2}" r="4" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5"/>`;
  }
  const xm = X(mA);
  s += `<polygon points="${xm},${T - 1} ${r1(xm - 5)},${T - 9} ${r1(xm + 5)},${T - 9}" fill="var(--ink)"/>`;
  s += `<text x="${Math.min(R, Math.max(L, xm))}" y="${T - 13}" text-anchor="${xm > R - 30 ? 'end' : xm < L + 30 ? 'start' : 'middle'}" class="tc-lbl" fill="var(--ink)">${fmt(mA, 1)} mA</text>`;
  return s + '</svg>';
}

window.InstUI = {fmt, fmtS, fmtA, esc, sub, PHC, phasorSVG, scopeSVG, spectrumSVG, tcSVG, leakSVG, rcdGaugeSVG};
})();
