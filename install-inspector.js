/* Installation: inspektøren (detaljer for det valgte) og den simulerede installationstester */
(function () {
'use strict';
const M = window.Inst, U = window.InstUI, app = window.InstApp;
const {fmt, fmtS, fmtA, esc, sub} = U;
const $ = s => document.querySelector(s);
const LS = ['L1', 'L2', 'L3'];
const PROTS = ['B6', 'B10', 'B13', 'B16', 'B20', 'C10', 'C13', 'C16', 'C20'];
const ZERO = M.HARM.map(h => ({h, re: 0, im: 0}));

const head = (k, title) => `<div class="insp-h"><span class="insp-k">${k}</span><h2>${esc(title)}</h2></div>`;
const more = (id, label = 'Læs mere') => `<button type="button" class="link more" data-doc="${id}">${label}</button>`;
const intro = (text, id) => `<section class="insp-sec"><p class="intro">${text} ${more(id)}</p></section>`;
const INTRO = {
  trafo: 'Transformeren omsætter 10 kV til 400/230 V. Stjernepunktet er jordet med driftsjorden R<sub>B</sub>, og fordelingskablet starter her.',
  ks: 'Kabelskabet er et fordelingspunkt i vejen. Stikledningerne til bygningerne er tilsluttet her, og fordelingskablet fortsætter til det næste kabelskab.',
  TNCS: 'Hovedtavlen er bygningens første tavle. Bygningen er TN-C-S: PEN fra stikledningen deles her i N og PE, så PE følger nullen, hvis PEN brydes.',
  TT: 'Hovedtavlen er bygningens første tavle. Bygningen er TT: PE er kun forbundet til bygningens egen jordelektrode og følger ikke nullen.',
  unit: 'Undertavlen forsynes af en stigeledning, enten direkte fra hovedtavlen eller fra lejligheden nedenunder. Her vælger du, hvilke faser lejligheden har. Den har sin egen HPFI.',
  nullet: 'Lejligheden er nullet: PE er forbundet til PEN her i undertavlen. Brydes PEN i stigeledningen, får PE og alle kabinetter spænding.',
  local: 'Hovedtavlen er ejendommens første tavle. PEN fortsætter op i stigeledningerne, og i hver lejlighed er PE forbundet til PEN (lokal nulling).',
  feeder: 'Fordelingskablet fører L1, L2, L3 og PEN fra transformeren gennem kabelskabene. Et brud her rammer alle bygninger længere ude.',
  stik: 'Stikledningen går fra kabelskabet til bygningens hovedtavle. Brydes nullen her, mangler nullen for hele bygningen.',
  stige: 'Stigeledningen går fra hovedtavlen til lejlighedens undertavle. Brydes nullen her, mangler nullen kun i den lejlighed.',
  group: 'Gruppeledningen går fra tavlen til gruppens stikkontakter og udtag. Ved at afbryde PE her kan du se, hvordan en manglende beskyttelsesleder opdages.',
  grp: 'En gruppe er en strømkreds med sin egen gruppeafbryder. Installationstesteren måler ved gruppens stikkontakt, altså for enden af gruppeledningen.',
};
const DOC_OF = {feeder: 'doc-net', stik: 'doc-nul', stige: 'doc-nul', group: 'doc-pe'};
const METER_DOC = {
  U: 'Spændingen mellem alle ledere og fasefølgen. Kontrollerer, at der er korrekt spænding, og at N–PE er tæt på 0 V.',
  RISO: 'Isolationsmodstanden med 500 V DC på en spændingsløs installation. Afslører dårlig isolation, før den bliver til en jordfejl. Krav: mindst 1,0 MΩ.',
  RLOW: 'Modstanden i PE fra målepunktet til hovedjordklemmen. Afslører afbrudte eller dårlige PE-forbindelser.',
  ZL: 'Impedansen fase–nul og den mulige kortslutningsstrøm I<sub>PSC</sub>. Høj Z line kan betyde en dårlig forbindelse eller en afbrudt nul.',
  ZS: 'Impedansen i fejlsløjfen fase–PE og fejlstrømmen I<sub>PFC</sub>. I TN skal fejlstrømmen være stor nok til, at gruppeafbryderen udløser momentant.',
  RCD: 'Tester HPFI\'en: berøringsspændingen U<sub>c</sub>, udløsetider ved 1 og 5 · I<sub>ΔN</sub> og udløsestrømmen.',
  LEAK: 'Lækstrømmen målt med en tang om fase og nul. Viser, hvor meget af HPFI\'ens udløsestrøm lækstrømmene allerede bruger. Bør højst være 30 % af I<sub>ΔN</sub>.',
  RE: 'Jordelektrodens modstand til jord. I TT afgør den, om HPFI\'en kan beskytte: R<sub>E</sub> · I<sub>ΔN</sub> ≤ 50 V.',
  FAULT: 'En simuleret jordfejl her: fejlstrøm, berøringsspænding U<sub>B</sub>, spænding på PE i andre tavler, og hvad der afbryder.',
};
const row = (label, value, st) => `<tr${st ? ` class="st-${st}"` : ''}><th scope="row">${label}</th><td class="num">${value}</td></tr>`;
const table = rows => `<table class="kv">${rows.join('')}</table>`;
const sec = (title, body) => `<section class="insp-sec">${title ? `<h3>${title}</h3>` : ''}${body}</section>`;
const btn = (label, act, id, extra = '', cls = 'ghost') => `<button type="button" class="${cls}" data-iact="${act}" data-id="${id}" ${extra}>${label}</button>`;
const v1 = (i) => { const s = app.res.vSeries(i, -1)[0]; return {re: s.re, im: s.im}; };
const protOf = M.protOf;
const bldgOf = id => { const e = app.find(id); return e.type === 'bldg' ? e.obj : e.bldg; };
const earthingOf = id => { const b = bldgOf(id); return b ? app.earthingOf(b) : 'TNCS'; };
const earthLabel = id => { const b = bldgOf(id); return !b ? 'TN-C-S' : app.isLocal(b) ? 'TN-C med lokal nulling' : app.earthingOf(b) === 'TNCS' ? 'TN-C-S' : 'TT'; };
const tavleOf = id => { const e = app.find(id); return e.type === 'group' ? e.owner : e.obj; };
const groupLoad = g => {
  const c = app.res.ckt.cables[g.id];
  return Math.max(0, ...['L1', 'L2', 'L3'].filter(k => c.br[k] !== undefined).map(k => M.h1(app.res.brSeries(c.br[k]))));
};

/* ---------- Tavler ---------- */
function voltTable(owner) {
  const r = app.res, B = r.ckt.boards[owner], ph = app.usedPhases(owner), rows = [];
  for (const L of ph) { const v = M.rms(r.vSeries(B[L], B.N)); rows.push(row(`${L}–N`, `${fmt(v, 1)} V`, app.vStatus(v))); }
  for (let i = 0; i < ph.length; i++) for (let j = i + 1; j < ph.length; j++) {
    rows.push(row(`${ph[i]}–${ph[j]}`, `${fmt(M.rms(r.vSeries(B[ph[i]], B[ph[j]])), 1)} V`));
  }
  if (B.PE !== undefined) {
    const npe = M.rms(r.vSeries(B.N, B.PE)), pe = M.rms(r.vSeries(B.PE, -1));
    rows.push(row('N–PE', `${fmt(npe, 1)} V`, npe > 50 ? 'burn' : npe > 10 ? 'tol' : ''));
    rows.push(row('PE–jord (U<sub>B</sub>)', `${fmt(pe, 1)} V`, pe >= 50 ? 'burn' : pe >= 25 ? 'tol' : ''));
  }
  return table(rows);
}
function phasor(owner) {
  const r = app.res, B = r.ckt.boards[owner], T = r.ckt.boards.trafo;
  const corners = app.usedPhases(owner).map(L => ({k: +L[1] - 1, p: v1(B[L]), v: M.rms(r.vSeries(B[L], B.N))}));
  const n = v1(B.N), pe = B.PE !== undefined ? v1(B.PE) : null;
  const ideal = corners.length === 3
    ? {re: corners.reduce((a, c) => a + c.p.re, 0) / 3, im: corners.reduce((a, c) => a + c.p.im, 0) / 3}
    : v1(T.N);
  const shift = Math.hypot(n.re - ideal.re, n.im - ideal.im);
  const txt = shift > 15
    ? 'Nullederen holder ikke længere stjernepunktet på plads. Den fase, der er mindst belastet, får den højeste spænding.'
    : 'Nulpunktet ligger, hvor det skal.';
  return `<div class="phasor-wrap">${U.phasorSVG({corners, n, pe, ideal})}<p class="cap">Nulpunktsforskydning <b class="num">${fmt(shift, 0)} V</b>. ${txt} Den blå prik er N, den stiplede cirkel er det ideelle nulpunkt, og pilene er spændingerne mod N. ${more('doc-nul')}</p></div>`;
}
function voltScope(owner) {
  const r = app.res, B = r.ckt.boards[owner];
  const curves = app.usedPhases(owner).map(L => ({label: `u_${L[1]}N`, color: `var(--l${L[1]})`, s: r.vSeries(B[L], B.N)}));
  return U.scopeSVG(curves, 'V', 'Spænding mod N');
}
function currentRows(id) {
  const r = app.res, c = r.ckt.cables[id], rows = [];
  for (const k of c.conds) {
    const bi = c.br[k], s = bi !== undefined ? r.brSeries(bi) : ZERO;
    const name = k === 'N' && app.isPEN(id) ? 'PEN' : k;
    if (bi === undefined) { rows.push(`<tr class="st-burn"><th scope="row">${name}</th><td colspan="4">afbrudt</td></tr>`); continue; }
    rows.push(`<tr><th scope="row"><i class="wdot w-${k}"></i>${name}</th><td class="num">${fmtA(M.rms(s))} A</td><td class="num">${fmtA(M.h1(s))}</td><td class="num">${fmtA(M.hn(s, 3))}</td><td class="num">${fmt(M.thd(s) * 100, 0)} %</td></tr>`);
  }
  if (c.role === 'stige' || c.role === 'group') {
    if (c.pe === undefined) rows.push('<tr class="st-burn"><th scope="row">PE</th><td colspan="4">afbrudt</td></tr>');
    else { const s = r.brSeries(c.pe); rows.push(`<tr><th scope="row"><i class="wdot w-PE"></i>PE</th><td class="num">${fmtA(M.rms(s))} A</td><td class="num">${fmtA(M.h1(s))}</td><td class="num">${fmtA(M.hn(s, 3))}</td><td class="num">${fmt(M.thd(s) * 100, 0)} %</td></tr>`); }
  }
  if (c.off) rows.length = 0, rows.push('<tr><td colspan="5">Afbryderen er udløst, så lederne er strømløse.</td></tr>');
  return `<table class="grid-t"><thead><tr><th>Leder</th><th>RMS</th><th>50 Hz</th><th>150 Hz</th><th>THD</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function currentScope(id, title) {
  const r = app.res, c = r.ckt.cables[id];
  const curves = c.conds.filter(k => c.br[k] !== undefined).map(k => ({label: k === 'N' ? 'i_N' : `i_${k[1]}`, color: k === 'N' ? 'var(--n)' : `var(--l${k[1]})`, s: r.brSeries(c.br[k]), dash: k === 'N' ? '6 4' : null}));
  return U.scopeSVG(curves, 'A', title || 'Strøm i lederne');
}

/* ---------- Installationstester ---------- */
const FNS = [['U', 'Spænding'], ['RISO', 'R ISO'], ['RLOW', 'R LOW'], ['ZL', 'Z line'], ['ZS', 'Z loop'], ['RCD', 'HPFI'], ['LEAK', 'Lækstrøm'], ['RE', 'R E'], ['FAULT', 'Jordfejl']];
// Den HPFI, der beskytter målepunktet, og hvad den ser lige nu
function rcdNow(id) {
  const tav = tavleOf(id), p = M.rcdParams(tav.name, tav.rcd), rs = app.res.residual(tav.groups);
  return {tav, p, rs, sens: M.rcdSens(tav.rcdType, p, rs.dc), T: M.RCD_TYPES[tav.rcdType] || M.RCD_TYPES.A};
}
const ok = (pass, txt) => `<span class="verdict-pill ${pass ? 'pass' : 'fail'}">${pass ? '✓' : '✗'} ${txt}</span>`;
const big = (label, val, unit) => `<div class="m-big"><span>${label}</span><b class="num">${val}</b><small>${unit}</small></div>`;
const small = (label, val) => `<div class="m-row"><span>${label}</span><b class="num">${val}</b></div>`;

function meter(id, kind) {
  const r = app.res, P = r.ckt.boards[id], m = app.meter;
  const ph = app.usedPhases(id);
  if (!ph.includes(m.phase)) m.phase = ph[0];
  const e = app.find(id), earthing = earthingOf(id);
  const bldg = e.type === 'bldg' ? e.obj : e.bldg;
  const L = m.phase;
  let out = '';
  const needPh = ['ZL', 'ZS', 'FAULT'].includes(m.fn);
  if (m.fn === 'U') {
    for (const p of ph) out += small(`U ${p}–N`, `${fmt(M.rms(r.vSeries(P[p], P.N)), 1)} V`);
    for (const p of ph) out += small(`U ${p}–PE`, `${fmt(M.rms(r.vSeries(P[p], P.PE)), 1)} V`);
    out += small('U N–PE', `${fmt(M.rms(r.vSeries(P.N, P.PE)), 1)} V`);
    out += small('Frekvens', '50,0 Hz');
    const live = ph.length === 3 && ph.every(p => M.rms(r.vSeries(P[p], P.PE)) > 100);
    out += small('Fasefølge', ph.length < 3 ? (ph.length === 2 ? `2-faset (${ph.join(' og ')})` : '1-faset') : live ? '1.2.3 (højre)' : '— (mangler fase)');
  } else if (m.fn === 'ZL') {
    const b = m.ll && ph.length > 1 ? P[ph[(ph.indexOf(L) + 1) % ph.length]] : P.N;
    const z = r.zIn(P[L], b), Z = M.cabs(z), Un = m.ll && ph.length > 1 ? 400 : 230;
    out += big('Z line', Z > 1999 ? '>1999' : fmtA(Z), 'Ω');
    out += small('R / X', `${fmtA(z.re)} / ${fmtA(z.im)} Ω`);
    out += small('I<sub>PSC</sub>', Z > 1999 ? '—' : `${fmtS(Un / Z)} A`);
    if (!m.ll && Z > 5) out += `<p class="m-note">Z line er unormalt høj. Det tyder på en afbrudt nul.</p>`;
  } else if (m.fn === 'ZS') {
    const z = r.zIn(P[L], P.PE), Z = M.cabs(z), I = 230 / Z;
    out += big('Z loop', Z > 1999 ? '>1999' : fmtA(Z), 'Ω');
    out += small('R / X', `${fmtA(z.re)} / ${fmtA(z.im)} Ω`);
    out += small('I<sub>PFC</sub>', `${fmtS(I)} A`);
    if (kind === 'group') {
      const g = e.obj, pr = protOf(g), In = +pr.slice(1), k = pr[0] === 'B' ? 5 : 10, zmax = 230 / (k * In);
      if (earthing === 'TT') out += `<p class="m-note">TT: fejlstrømmen løber gennem jord og er for lille til at udløse ${pr}. Beskyttelsen sker med HPFI (se HPFI-målingen).</p>`;
      else out += small(`Krav for ${pr} (I<sub>a</sub> = ${k}·I<sub>n</sub>)`, `Z<sub>s</sub> ≤ ${fmtA(zmax)} Ω`) + ok(Z <= zmax, Z <= zmax ? 'Afbryder inden for 0,4 s' : 'Z loop for høj');
    }
  } else if (m.fn === 'RISO') {
    const groups = e.type === 'group' ? [e.obj] : e.type === 'unit' ? e.obj.groups : [...e.obj.groups, ...e.obj.units.flatMap(u => u.groups)];
    let G = 0;
    for (const g of groups) {
      G += 1 / M.R_HEALTHY;
      if (g.fault && (m.iso === 'L-N' ? g.fault.pair === 'L-N' : g.fault.pair !== 'L-N')) G += 1 / g.fault.R;
    }
    const MO = 1 / G / 1e6;
    out += big('R ISO', MO > 999 ? '>999' : fmt(MO, MO < 10 ? 3 : 1), 'MΩ');
    out += small('Prøvespænding', '500 V DC');
    out += small('Mellem', m.iso === 'L-N' ? 'L og N' : 'L+N og PE');
    out += ok(MO >= 1, MO >= 1 ? 'R ISO ≥ 1,0 MΩ' : 'Under kravet på 1,0 MΩ');
    out += `<p class="m-note">Målingen forudsætter, at installationen er spændingsløs, og at brugsgenstande er frakoblet. Simulatoren regner, som om de er.${groups.length > 1 ? ` Her måles ${groups.length} grupper på én gang. Mål på grupperne hver for sig for at finde fejlen.` : ''}</p>`;
  } else if (m.fn === 'RCD') {
    const tav = tavleOf(id), rpe = M.cabs(r.zIn(P.PE, -1));
    if (tav.rcd === 'none') out += `<p class="m-note">Der er ingen HPFI i ${esc(tav.name)}.</p>`;
    else {
      const p = M.rcdParams(tav.name, tav.rcd), Uc = p.IdN * rpe, mA = fmt(p.IdN * 1000, 0);
      out += big('U<sub>c</sub>', Uc > 999 ? '>999' : fmt(Uc, 1), 'V');
      out += small(`Ved I<sub>ΔN</sub> = ${mA} mA`, `R<sub>PE</sub> ≈ ${rpe > 1e4 ? '>10 kΩ' : `${fmtA(rpe)} Ω`}`);
      out += ok(Uc <= 50, Uc <= 50 ? 'U<sub>c</sub> ≤ 50 V' : 'U<sub>c</sub> over 50 V');
      const {sens, rs, T} = rcdNow(id);
      if (tav.rcdTripped) out += `<p class="m-note">HPFI'en er udløst. Slå den til igen for at teste den.</p>`;
      else if (rpe > 1e4) out += `<p class="m-note">Ingen udløsning: prøvestrømmen kan ikke løbe, fordi PE ikke har forbindelse til jord.</p>`;
      else if (sens.status === 'blind') {
        out += small('1 × I<sub>ΔN</sub>', 'udløser ikke') + small('5 × I<sub>ΔN</sub>', 'udløser ikke');
        out += ok(false, `Blind: ${fmt(rs.dc * 1000, 0)} mA glat DC`);
      } else {
        const thr = sens.thr, x1 = p.IdN >= thr, x5 = 5 * p.IdN >= thr;
        out += small('½ × I<sub>ΔN</sub>', p.IdN / 2 >= thr ? 'udløser' : 'udløser ikke');
        out += small('1 × I<sub>ΔN</sub>', x1 ? app.fmtT(p.t1) : 'udløser ikke');
        out += small('5 × I<sub>ΔN</sub>', x5 ? app.fmtT(p.t5) : 'udløser ikke');
        out += small('Rampe I<sub>Δ</sub>', `${fmt(thr * 1000, 0)} mA`);
        out += ok(x1 && x5 && p.t1 <= 0.3 && p.t5 <= 0.04, x1 ? 'Udløsetider overholdt' : 'Udløser ikke ved I<sub>ΔN</sub>');
        if (sens.status === 'nedsat') out += `<p class="m-note">Glat DC på ${fmt(rs.dc * 1000, 0)} mA har nedsat følsomheden.</p>`;
      }
      out += `<p class="m-note">Simuleret HPFI, ${T.name}, ${mA} mA i ${esc(tav.name)}. Krav: ≤ 300 ms ved 1 × I<sub>ΔN</sub> og ≤ 40 ms ved 5 × I<sub>ΔN</sub>.</p>`;
    }
  } else if (m.fn === 'RLOW') {
    if (e.type === 'bldg') out += `<p class="m-note">Målepunktet er hovedjordklemmen. Vælg en gruppe eller en undertavle for at måle PE-lederens kontinuitet derfra.</p>`;
    else {
      const R = r.zIn(P.PE, r.ckt.boards[bldg.id].PE).re;
      out += big('R LOW', R > 1999 ? '>1999' : fmtA(R), 'Ω');
      out += small('Mellem', `PE her og hovedjordklemmen i ${esc(bldg.name)}`);
      out += ok(R < 2, R < 2 ? 'Gennemgående PE' : 'Høj modstand');
    }
  } else if (m.fn === 'LEAK') {
    const groups = e.type === 'group' ? [e.obj] : tavleOf(id).groups, rs = app.res.residual(groups);
    const tav = tavleOf(id), IdN = tav.rcd === '300' ? 0.3 : 0.03, pct = rs.ac / IdN * 100;
    out += rs.ac >= 1 ? big('I<sub>Δ</sub>', fmtA(rs.ac), 'A') : big('I<sub>Δ</sub>', fmt(rs.ac * 1000, 2), 'mA');
    out += small('Glat DC', `${fmt(rs.dc * 1000, 1)} mA`);
    out += small('Målt om', e.type === 'group' ? `gruppens fase- og nulleder` : `alle grupper under HPFI'en i ${esc(tav.name)}`);
    if (tav.rcd !== 'none') out += small('Andel af I<sub>ΔN</sub>', `${fmt(pct, 0)} %`) + ok(pct <= 30, pct <= 30 ? 'Under 30 % af I<sub>ΔN</sub>' : 'Over 30 % af I<sub>ΔN</sub>');
    out += `<p class="m-note">Tangen omslutter både fase- og nullederne, så den måler forskellen: strømmen, der løber ud gennem PE. Lækstrømme på samme fase lægges sammen, mens lækstrømme på forskellige faser delvist ophæver hinanden.</p>`;
  } else if (m.fn === 'RE') {
    out += big('R<sub>E</sub>', fmtS(bldg.RA), 'Ω');
    out += small('Jordelektrode', esc(bldg.name));
    if (earthing === 'TT') out += small('Krav ved HPFI 30 mA', 'R<sub>E</sub> · 30 mA ≤ 50 V') + ok(bldg.RA * 0.03 <= 50, `${fmt(bldg.RA * 0.03, 1)} V`);
    else out += `<p class="m-note">TN-C-S: PE er forbundet til PEN i hovedtavlen. Jordelektroden er en ekstra sikkerhed, hvis PEN brydes.</p>`;
  } else if (m.fn === 'FAULT') {
    const f = r.fault(P[L], P.PE, m.rf), If = M.cabs(f.I), Ub = M.cabs(f.v(P.PE, -1));
    out += big('U<sub>B</sub>', fmt(Ub, 0), 'V');
    out += small('Fejlstrøm I<sub>f</sub>', `${fmtS(If)} A`);
    const tav = tavleOf(id);
    let tM = Infinity, tR = Infinity, pr = '';
    if (kind === 'group') { pr = protOf(e.obj); tM = M.mcbTime(pr, If / +pr.slice(1)); }
    if (tav.rcd !== 'none' && !tav.rcdTripped) { const {p, sens} = rcdNow(id); if (If >= sens.thr) tR = If >= 5 * p.IdN ? p.t5 : p.t1; }
    const trip = !isFinite(Math.min(tM, tR)) ? '<b class="m-bad">Ingen afbrydelse. Fejlen bliver stående.</b>'
      : tM <= tR ? `${pr} efter ${app.fmtT(tM)}` : `HPFI efter ${app.fmtT(tR)}`;
    out += small('Afbrydelse', trip);
    const others = [];
    for (const [oid, x] of Object.entries(app.idx)) {
      if ((x.type !== 'bldg' && x.type !== 'unit') || oid === id) continue;
      const B = r.ckt.boards[oid], u = M.cabs(f.v(B.PE, -1));
      if (u >= 5) others.push(`${esc(x.obj.name)} ${fmt(u, 0)} V`);
    }
    if (others.length) out += small('PE i andre tavler', others.join(' · '));
    out += `<p class="m-note">Fejl ${L}–PE med ${fmt(m.rf, 2)} Ω. U<sub>B</sub> er spændingen mellem udsatte dele og fjern jord, før beskyttelsen afbryder.</p>`;
    if (kind === 'group') out += `<button type="button" class="ghost m-btn" data-iact="faultInsert" data-id="${id}">Indsæt fejlen i installationen</button>`;
  }
  const fnBtns = FNS.map(([k, t]) => `<button type="button" data-mset="fn" data-v="${k}" aria-pressed="${m.fn === k}">${t}</button>`).join('');
  const phBtns = needPh && ph.length > 1 ? `<div class="seg" role="group" aria-label="Fase">${ph.map(p => `<button type="button" data-mset="phase" data-v="${p}" aria-pressed="${p === L}">${p}</button>`).join('')}</div>` : '';
  const llBtn = m.fn === 'ZL' && ph.length > 1 ? `<div class="seg" role="group" aria-label="Måling"><button type="button" data-mset="ll" data-v="0" aria-pressed="${!m.ll}">L–N</button><button type="button" data-mset="ll" data-v="1" aria-pressed="${m.ll}">L–L</button></div>` : '';
  const isoBtn = m.fn === 'RISO' ? `<div class="seg" role="group" aria-label="Måling"><button type="button" data-mset="iso" data-v="LN-PE" aria-pressed="${m.iso !== 'L-N'}">L+N–PE</button><button type="button" data-mset="iso" data-v="L-N" aria-pressed="${m.iso === 'L-N'}">L–N</button></div>` : '';
  const rfSel = m.fn === 'FAULT' ? `<label class="sel">Fejlmodstand <select data-mset="rf">${[0.01, 1, 10, 100].map(v => `<option value="${v}"${v === m.rf ? ' selected' : ''}>${fmt(v, v < 1 ? 2 : 0)} Ω</option>`).join('')}</select></label>` : '';
  return sec('Installationstester', `<div class="meter">
    <div class="m-fns" role="group" aria-label="Målefunktion">${fnBtns}</div>
    ${phBtns || llBtn || rfSel || isoBtn ? `<div class="m-opts">${phBtns}${llBtn}${isoBtn}${rfSel}</div>` : ''}
    <div class="m-screen"><div class="m-point">Målepunkt: ${esc(kind === 'group' ? `${app.where(id)} (stikkontakt)` : e.obj.name)} · ${earthLabel(id)}</div>${out}</div>
    <p class="m-doc">${METER_DOC[m.fn]} ${more(`doc-m-${m.fn}`, 'Om målingen')}</p>
  </div>`);
}

/* ---------- Kortslutningsniveau ---------- */
function ikSection(id, kind) {
  const x = app.res.ik()[id];
  if (!x) return '';
  const fI = app.fmtI, rows = [
    row('Ik,max 3-faset <span class="muted">(c 1,10, 20 °C)</span>', x.ik3max ? fI(x.ik3max) : '— (ikke tre faser)'),
    row('Ik,max 1-faset L–N', fI(x.ik1max)),
    row('Ik,min L–N <span class="muted">(c 0,95, 80 °C)</span>', fI(x.ik1n)),
  ];
  if (x.ik1pe != null) rows.push(row('Ik,min L–PE (jordfejl)', fI(x.ik1pe), x.ik1pe < 100 ? 'tol' : ''));
  rows.push(row('Z L–N ved 80 °C', `${fmtA(x.zn)} Ω`));
  let s = table(rows);
  const ikMax = Math.max(x.ik3max || 0, x.ik1max || 0);
  if (kind !== 'trafo') {
    s += ikMax > 6000
      ? `<p class="note">Ik,max er ${fI(ikMax)}. Afbrydere her skal have en brydeevne på mindst 10 kA, eller være forsikret af en sikring foran.</p>`
      : `<p class="hint">Ik,max er under 6 kA, så afbrydere med en brydeevne på 6 kA er nok.</p>`;
  }
  if (kind === 'group') {
    const g = app.find(id).obj, pr = protOf(g), Ia = (pr[0] === 'B' ? 5 : 10) * +pr.slice(1);
    s += ok(x.ik1n >= Ia, `Kortslutning: Ik,min ${fI(x.ik1n)} ${x.ik1n >= Ia ? '≥' : '<'} I<sub>a</sub> = ${Ia} A for ${pr}`);
    if (x.ik1pe != null) {
      s += earthingOf(id) === 'TT'
        ? `<p class="hint">TT: fejlstrømmen ved jordfejl er kun ${fI(x.ik1pe)}, så det er HPFI'en, der beskytter.</p>`
        : ok(x.ik1pe >= Ia, `Jordfejl: Ik,min ${fI(x.ik1pe)} ${x.ik1pe >= Ia ? '≥' : '<'} I<sub>a</sub> = ${Ia} A`);
    }
  }
  // Belastningens betydning: samme fejl med og uden apparaterne tilsluttet
  const B = app.res.ckt.boards[id], ph = app.usedPhases(id);
  if (ph.length) {
    const L = ph[0], cmp = app.res.ikLoadCompare(B[L], B.N), u = M.rms(app.res.vSeries(B[L], B.N));
    s += `<p class="hint">Belastningens betydning (${L}–N, ${M.E_SRC} V i tomgang): uden belastning ${fI(cmp.noLoad)}, med den aktuelle belastning ${fI(cmp.withLoad)}. Spændingen er nu ${fmt(u, 1)} V. Flere apparater sænker spændingen, men ændrer næsten ikke kortslutningsstrømmen.</p>`;
  }
  return sec('Kortslutningsniveau', s + `<p class="hint">Forenklet efter IEC 60909. Belastning regnes ikke med i Ik,max og Ik,min. ${more('doc-ik')}</p>`);
}

/* ---------- Inspektør pr. type ---------- */
function inspTrafo() {
  const f = app.net[0];
  return head('Forsyning', 'Transformer 10/0,4 kV') + intro(INTRO.trafo, 'doc-net') +
    sec('Transformerkreds', `<label class="field">Udlagt til nulling (TN) <select data-field="nulling" data-id="trafo"><option value="1"${app.opts.nulling ? ' selected' : ''}>Ja</option><option value="0"${app.opts.nulling ? '' : ' selected'}>Nej, kun TT (jordspyd)</option></select></label>
      <p class="hint">Netselskabet bestemmer, om transformerkredsen er udlagt til nulling. Er den ikke det, skal alle installationer have jordspyd (TT) og beskyttes med HPFI. ${more('doc-jording')}</p>`) +
    sec('', table([row('Mærkeeffekt', '400 kVA'), row('Kortslutningsspænding u<sub>k</sub>', '≈ 4 %'), row('Tomgangsspænding', `${M.E_SRC} V`), row('Driftsjord R<sub>B</sub>', `${M.RB} Ω`)])) +
    sec('Spændinger', voltTable('trafo')) + sec('', phasor('trafo')) + ikSection('trafo', 'trafo') +
    (f ? sec('Strøm ud i fordelingskablet', currentRows(f.id) + currentScope(f.id)) : '');
}
function inspKs(f) {
  return head('Kabelskab', f.name) + intro(INTRO.ks, 'doc-net') +
    sec('', `<div class="fields"><label class="field">Navn <input type="text" data-field="name" data-id="${f.id}" value="${esc(f.name)}"></label>${cableFields(f.id, 'Fordelingskabel')}</div>`) +
    sec('Spændinger', voltTable(f.id)) + sec('', phasor(f.id)) + ikSection(f.id, 'ks') +
    sec('Strøm i kablet hertil', currentRows(f.id)) +
    sec('', `<div class="btns">${btn('+ Hus', 'addHus', f.id)}${btn('+ Etageejendom', 'addEtage', f.id)}${app.net.length > 1 ? btn('Slet kabelskab', 'delKs', f.id, '', 'ghost danger') : ''}</div>`);
}
function nButton(o, isBldg) {
  const on = !!o.cable.broken.N, pen = app.isPEN(o.id);
  return `<button type="button" class="nbreak big" data-iact="cut" data-id="${o.id}" data-c="N" aria-pressed="${on}">${on ? (pen ? 'PEN afbrudt: klik for at genetablere' : 'Nul afbrudt: klik for at genetablere') : (pen ? `Afbryd PEN i ${isBldg ? 'stikledningen' : 'stigeledningen'}` : 'Manglende nul: afbryd nul før tavlen')}</button>`;
}
function inspBoard(o, kind) {
  const isB = kind === 'bldg';
  let set = `<label class="field">Navn <input type="text" data-field="name" data-id="${o.id}" value="${esc(o.name)}"></label>`;
  if (isB) {
    const tnOk = app.opts.nulling, eff = app.earthingOf(o);
    set += `<label class="field">Jordingssystem <select data-field="earthing" data-id="${o.id}"><option value="TNCS"${eff === 'TNCS' ? ' selected' : ''}${tnOk ? '' : ' disabled'}>TN-C-S (nulling)</option><option value="TT"${eff === 'TT' ? ' selected' : ''}>TT (jordspyd)</option></select></label>`;
    if (!tnOk) set += `<p class="hint">Transformerkredsen er ikke udlagt til nulling, så kun TT kan vælges. Det ændres på transformeren.</p>`;
    if (o.kind === 'etage' && eff === 'TNCS') set += `<label class="field">PEN <select data-field="split" data-id="${o.id}"><option value="main"${o.split !== 'local' ? ' selected' : ''}>Deles i hovedtavlen (N og PE op i opgangen)</option><option value="local"${o.split === 'local' ? ' selected' : ''}>Fortsætter op (lokal nulling i lejlighederne)</option></select></label>`;
    set += `<label class="field">Jordelektrode R<sub>E</sub> <span><input type="number" min="0.5" max="2000" step="0.5" data-field="RA" data-id="${o.id}" value="${o.RA}"> Ω</span></label>`;
  } else {
    const allowed = o.cable.phases || app.feedPhases(o), bl = app.find(o.id).bldg;
    const below = u => { let x = u, n = 0; while (x && x.feed !== 'main' && n++ < 50) { if (x.feed === o.id) return true; x = bl.units.find(v => v.id === x.feed); } return false; };
    set += `<div class="field"><span>Faser i lejligheden</span><span class="seg">${M.PH.map(p => `<button type="button" data-iact="uphase" data-id="${o.id}" data-c="${p}" aria-pressed="${o.phases.includes(p)}"${allowed.includes(p) ? '' : ' disabled'}>${p}</button>`).join('')}</span></div>`;
    set += `<label class="field">Forsynes fra <select data-field="feed" data-id="${o.id}"><option value="main"${o.feed === 'main' ? ' selected' : ''}>Hovedtavlen (egen stigeledning)</option>${bl.units.filter(u => u.id !== o.id && !below(u)).map(u => `<option value="${u.id}"${o.feed === u.id ? ' selected' : ''}>${esc(u.name)} (samme stigeledning)</option>`).join('')}</select></label>`;
    if (allowed.length < 3) set += `<p class="hint">Stigeledningen hertil har kun ${allowed.join(' og ')}. Har kablet flere faseledere, fx 5G10, vælges de i stigeledningens panel.</p>`;
  }
  set += cableFields(o.id, isB ? 'Stikledning' : 'Stigeledning');
  set += `<label class="field">HPFI <select data-field="rcd" data-id="${o.id}">${[['30', '30 mA'], ['300', '300 mA'], ['none', 'Ingen HPFI']].map(([v, t]) => `<option value="${v}"${o.rcd === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const pe = app.touchV(o.id);
  const peWarn = pe >= 50 ? `<p class="alert">PE har ${fmt(pe, 0)} V mod jord. Udsatte dele, fx køleskabets kabinet, er livsfarlige at røre. ${more('doc-jording')}</p>` : '';
  const earthBtn = isB ? `<button type="button" class="cut-btn" data-iact="earth" data-id="${o.id}" aria-pressed="${!!o.earthBroken}">${o.earthBroken ? 'Jordledning afbrudt: klik for at genetablere' : 'Afbryd jordledningen til jordelektroden'}</button>` : '';
  set += `<label class="field">HPFI-type <select data-field="rcdType" data-id="${o.id}">${Object.entries(M.RCD_TYPES).map(([k, t]) => `<option value="${k}"${o.rcdType === k ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label>`;
  let rcdRow = `<div class="prot-row"><span>HPFI: <b>${o.rcd === 'none' ? 'ingen' : `${M.RCD_TYPES[o.rcdType].name}, ${o.rcd} mA`}</b>${o.rcd === 'none' ? '' : o.rcdTripped ? ' · <b class="txt-bad">udløst</b>' : ' · slået til'}</span>${o.rcdTripped ? btn('Slå til igen', 'rcdReset', o.id, '', 'btn-primary') : ''}</div>`;
  if (o.rcd !== 'none' && !o.rcdTripped) {
    const rs = app.res.residual(o.groups), IdN = o.rcd === '300' ? 0.3 : 0.03, pct = rs.ac / IdN * 100;
    const sens = M.rcdSens(o.rcdType, M.rcdParams(o.name, o.rcd), rs.dc);
    const big = rs.ac > IdN;
    rcdRow += `<p class="leak-row">${big ? 'Fejlstrøm' : 'Lækstrøm'} gennem HPFI'en: <b class="num">${big ? `${fmtA(rs.ac)} A` : `${fmt(rs.ac * 1000, 1)} mA`}</b>${big ? '' : ` (${fmt(pct, 0)} % af I<sub>ΔN</sub>)`}${rs.dc ? ` · glat DC <b class="num">${fmt(rs.dc * 1000, 1)} mA</b>` : ''} ${more('doc-laek')}</p>`;
    if (pct > 30 && !big) rcdRow += `<p class="note">Lækstrømmen er over 30 % af I<sub>ΔN</sub>. Der er risiko for, at HPFI'en udløser, uden at der er en egentlig fejl.</p>`;
    if (sens.status !== 'ok') rcdRow += `<p class="alert">${sens.status === 'blind'
      ? `Glat DC på ${fmt(rs.dc * 1000, 0)} mA har mættet HPFI'en. Den er blind og udløser ikke ved en jordfejl.`
      : `Glat DC på ${fmt(rs.dc * 1000, 0)} mA har nedsat HPFI'ens følsomhed. Den udløser først ved ca. ${fmt(sens.thr * 1000, 0)} mA.`} ${more('doc-rcdtype')}</p>`;
  }
  const acts = btn('+ Gruppe', 'addGroup', o.id) + (isB && o.kind === 'etage' ? btn('+ Lejlighed', 'addUnit', o.id) : '') + btn(isB ? 'Slet bygning' : 'Slet lejlighed', isB ? 'delBldg' : 'delUnit', o.id, '', 'ghost danger');
  return head(isB ? (o.kind === 'hus' ? 'Hus · hovedtavle' : 'Etageejendom · hovedtavle') : 'Lejlighed · undertavle', o.name) +
    intro(isB ? (app.isLocal(o) ? INTRO.local : INTRO[app.earthingOf(o)]) : INTRO.unit + (app.isLocal(app.find(o.id).bldg) ? ' ' + INTRO.nullet : ''), isB ? 'doc-jording' : 'doc-stige') +
    sec('', nButton(o, isB) + earthBtn + rcdRow + peWarn) +
    sec('Spændinger', voltTable(o.id)) + sec('', phasor(o.id)) + sec('', voltScope(o.id)) + ikSection(o.id, kind) +
    meter(o.id, kind) +
    sec('Indstillinger', `<div class="fields">${set}</div>`) +
    sec('', `<div class="btns">${btn(isB ? 'Vis stikledning' : 'Vis stigeledning', 'selCable', o.id)}${acts}</div>`);
}
function inspCable(id) {
  const e = app.find(id), o = e.obj, role = app.roleOf(id), c = app.res.ckt.cables[id];
  const titles = {feeder: 'Fordelingskabel', stik: 'Stikledning', stige: 'Stigeledning', group: 'Gruppeledning'};
  const to = role === 'group' ? app.where(id) : o.name;
  const cuts = app.cableConds(role, o).map(k => {
    const name = k === 'N' && app.isPEN(id) ? 'PEN' : k, on = !!o.cable.broken[k];
    return `<button type="button" class="cut-btn" data-iact="cut" data-id="${id}" data-c="${k}" aria-pressed="${on}"><i class="wdot w-${k}"></i>${on ? `${name} afbrudt` : `Afbryd ${name}`}</button>`;
  }).join('');
  const rN = c.br.N !== undefined ? app.res.brSeries(c.br.N) : null;
  const triplen = rN && M.hn(rN, 3) > 0.3 * Math.max(M.h1(rN), 0.01);
  // Stigeledningens faseledere kan være flere end dem, lejligheden bruger (fx 5G10 med to faser i brug)
  const riser = role === 'stige' ? sec('Faser i stigeledningen', `<div class="field"><span>Faseledere</span><span class="seg">${M.PH.map(p => `<button type="button" data-iact="rphase" data-id="${id}" data-c="${p}" aria-pressed="${(o.cable.phases || o.phases).includes(p)}"${app.feedPhases(o).includes(p) ? '' : ' disabled'}>${p}</button>`).join('')}</span></div>
    <p class="hint">Lejligheden bruger ${o.phases.join(' og ')}. Faser i stigeledningen, som lejligheden ikke bruger, føres videre op til lejlighederne ovenover.</p>`) : '';
  // Dårlig samling: overgangsmodstand i én leder
  const j = o.cable.joint, jc = j ? j.cond : '', jr = j ? j.R : 1;
  let jInfo = '';
  if (j) {
    const bi = jc === 'PE' ? c.pe : c.br[jc];
    if (bi !== undefined) {
      const I = M.rms(app.res.brSeries(bi)), P = I * I * jr;
      jInfo = `<p class="${P >= 50 ? 'alert' : P >= 10 ? 'note' : 'hint'}">Strøm gennem samlingen <b class="num">${fmtA(I)} A</b>, spændingsfald <b class="num">${fmt(I * jr, 1)} V</b>, effekt i samlingen <b class="num">${fmtS(P)} W</b>. ${P >= 50 ? 'Klemmen bliver meget varm og kan brænde over, så lederen bliver helt afbrudt.' : P >= 10 ? 'Klemmen bliver varm.' : ''}</p>`;
    }
    jInfo += `<div class="btns">${btn('Lad samlingen brænde over', 'burnJoint', id, '', 'ghost danger')}</div>`;
  }
  const jointSec = sec('Dårlig samling', `<div class="fields">
      <label class="field">Leder <select data-field="jointCond" data-id="${id}"><option value="">Ingen</option>${app.cableConds(role, o).map(k => `<option value="${k}"${k === jc ? ' selected' : ''}>${k === 'N' && app.isPEN(id) ? 'PEN' : k}</option>`).join('')}</select></label>
      <label class="field">Overgangsmodstand <select data-field="jointR" data-id="${id}"${j ? '' : ' disabled'}>${[0.05, 0.2, 0.5, 1, 2, 5, 10, 50].map(v => `<option value="${v}"${v === jr ? ' selected' : ''}>${fmt(v, v < 1 ? 2 : 0)} Ω</option>`).join('')}</select></label></div>
    ${jInfo}<p class="hint">En løs eller korroderet klemme giver en overgangsmodstand. Strømmen afsætter varme i samlingen, P = I² · R. ${more('doc-samling')}</p>`);
  return head(titles[role], `${app.cableName(role, o)} til ${to}`) + intro(INTRO[role], DOC_OF[role]) +
    sec('Kabel', `<div class="fields">${cableFields(id, titles[role])}</div>${cableAnalysis(id)}`) + riser +
    sec('Afbryd en leder', `<div class="cuts">${cuts}</div>`) + jointSec +
    sec('Strøm', currentRows(id) + (triplen ? `<p class="note">Den 3. harmoniske (150 Hz) fra de tre faser er i fase og lægges sammen i nullederen i stedet for at ophæve hinanden. ${more('doc-harm')}</p>` : '')) +
    sec('', currentScope(id)) +
    (rN ? sec('', U.spectrumSVG(rN, 'A', 'var(--n)', 'Harmoniske i nullederen')) : '');
}
/* ---------- Tværsnit og længde på alle kabler ---------- */
const cableOpts = cur => ['Cu', 'Al'].map(mat => `<optgroup label="${mat === 'Cu' ? 'Kobber' : 'Aluminium'}">${Object.entries(M.CABLES)
  .filter(([, c]) => c.mat === mat).sort((a, b) => a[1].mm2 - b[1].mm2)
  .map(([t, c]) => `<option value="${t}"${t === cur ? ' selected' : ''}>${String(c.mm2).replace('.', ',')} mm² ${c.mat}</option>`).join('')}</optgroup>`).join('');
function cableFields(id, name) {
  const o = app.find(id).obj;
  return `<label class="field">${name}, tværsnit <select data-field="cableType" data-id="${id}">${cableOpts(o.cable.type)}</select></label>
    <label class="field">${name}, længde <span><input type="number" min="1" max="5000" step="1" data-field="cableLen" data-id="${id}" value="${o.cable.len}"> m</span></label>`;
}
// Tavlen, kablet kommer fra
function parentOf(id) {
  const e = app.find(id), role = app.roleOf(id);
  if (role === 'feeder') { const i = app.net.findIndex(f => f.id === id); return i > 0 ? app.net[i - 1].id : 'trafo'; }
  if (role === 'stik') return e.ks.id;
  if (role === 'stige') return e.obj.feed !== 'main' && app.find(e.obj.feed) ? e.obj.feed : e.bldg.id;
  return e.owner.id;
}
// Belastning, spændingsfald og beskyttelse af kablet
function cableAnalysis(id) {
  const o = app.find(id).obj, role = app.roleOf(id), r = app.res, c = r.ckt.cables[id], spec = M.CABLES[o.cable.type];
  const ph = c.conds.filter(k => k[0] === 'L' && c.br[k] !== undefined);
  const Imax = Math.max(0, ...ph.map(k => M.rms(r.brSeries(c.br[k]))));
  const P = r.ckt.boards[parentOf(id)], C = r.ckt.boards[id];
  let dU = 0;
  for (const k of ph) if (P && C && P[k] !== undefined && C[k] !== undefined) dU = Math.max(dU, M.rms(r.vSeries(P[k], P.N)) - M.rms(r.vSeries(C[k], C.N)));
  const load = Imax / spec.Iz * 100, size = `${String(spec.mm2).replace('.', ',')} mm²`;
  let s = table([
    row('R og X pr. leder', `${fmt(c.R * 1000, 1)} mΩ og ${fmt(c.X * 1000, 1)} mΩ`),
    row('Største strøm i en fase', `${fmtA(Imax)} A`),
    row('Vejledende strømværdi I<sub>z</sub>', `${spec.Iz} A`),
    row('Belastning', `${fmt(load, 0)} %`, load > 100 ? 'burn' : load > 80 ? 'tol' : ''),
    row('Spændingsfald i kablet', `${fmt(dU, 1)} V (${fmt(dU / 230 * 100, 1)} %)`, dU / 230 > 0.04 ? 'tol' : ''),
  ]);
  if (load > 100) s += `<p class="alert">Kablet er overbelastet: ${fmtA(Imax)} A mod en strømværdi på ca. ${spec.Iz} A. Vælg et større tværsnit.</p>`;
  if (role === 'group') {
    const pr = protOf(o), In = +pr.slice(1);
    s += In > spec.Iz ? `<p class="alert">${pr} beskytter ikke ${size} mod overbelastning, fordi I<sub>n</sub> = ${In} A er større end strømværdien på ca. ${spec.Iz} A.</p>`
      : `<p class="hint">${pr} beskytter kablet mod overbelastning, fordi I<sub>n</sub> ≤ I<sub>z</sub>.</p>`;
  }
  return s + `<p class="hint">Strømværdien er vejledende for et kabel med tre belastede ledere og afhænger af installationsmetode, temperatur og samlet fremføring. Et større tværsnit eller et kortere kabel giver mindre spændingsfald og lavere Z line og Z loop.</p>`;
}
function inspGroup(g) {
  const e = app.find(g.id), owner = e.owner, sup = app.supplyOf(owner), gph = g.phases.filter(p => sup.includes(p));
  const cats = {};
  M.APPL.filter(a => M.connOptions(a, gph).length).forEach(a => { (cats[a.cat] = cats[a.cat] || []).push(a); });
  const opts = Object.entries(cats).map(([c, list]) => `<optgroup label="${esc(c)}">${list.map(a => `<option value="${a.id}">${esc(a.name)} (${fmtS(M.defTotal(a))} W)</option>`).join('')}</optgroup>`).join('');
  const apps = g.apps.map(a => { const i = app.appInfo(a); return `<li><button type="button" class="link st-${i.st}" data-isel="app:${a.id}">${esc(M.APPL_BY_ID[a.type].name)}</button> <span class="muted">${M.connLabel(app.connOf(a))}</span> <span class="muted num">${i.st === 'burned' ? 'brændt' : i.st === 'slukket' ? 'slukket' : `${fmt(i.v, 0)} V`}</span></li>`; }).join('');
  const pr = protOf(g), load = groupLoad(g), G = app.res.ckt.boards[g.id], Lg = ['L1', 'L2', 'L3'].find(k => G[k] !== undefined);
  const pts = [];
  if (load > 0.05) pts.push({I: load, label: `Belastning ${fmtS(load)} A`, color: 'var(--good)'});
  const lastTrip = g.tripped && [...app.eventLog].reverse().find(x => x.type === 'mcb' && x.id === g.id);
  if (lastTrip) pts.push({I: lastTrip.I, label: `Udløste ved ${fmtS(lastTrip.I)} A`, color: 'var(--warn)'});
  if (Lg && G.PE !== undefined && !g.tripped && !owner.rcdTripped) {
    const If = M.cabs(app.res.fault(G[Lg], G.PE, 0.01).I);
    if (If > 1) pts.push({I: If, label: `Jordfejl ${fmtS(If)} A`, color: 'var(--bad)'});
  }
  const protSec = sec('Gruppeafbryder', `<div class="prot-row"><span><b>${pr}</b> · ${g.tripped ? '<b class="txt-bad">udløst</b>' : owner.rcdTripped ? 'HPFI i tavlen er udløst' : 'slået til'}</span>${g.tripped ? btn('Slå til igen', 'untrip', g.id, '', 'btn-primary') : btn('Slå fra', 'trip', g.id)}</div>
    <div class="prot-row"><span>AFDD (lysbuedetektor): <b>${g.afdd ? 'monteret' : 'ingen'}</b></span>${btn(g.afdd ? 'Fjern AFDD' : 'Monter AFDD', 'afdd', g.id)}</div>
    <p class="leak-row">Lækstrøm i gruppen: <b class="num">${fmt(app.res.residual([g]).ac * 1000, 2)} mA</b> ${more('doc-laek')}</p>
    ${U.tcSVG(pr, pts)}<p class="hint">Forenklet ${pr[0]}-karakteristik: termisk udløsning over 1,13 · I<sub>n</sub>, momentan udløsning ved ${pr[0] === 'B' ? 5 : 10} · I<sub>n</sub>. Fejlstrømmen er beregnet for en jordfejl ved gruppens ende. ${more('doc-beskyttelse')}</p>`);
  const fp = g.fault ? g.fault.pair : '', fr = g.fault ? g.fault.R : 3e5, isArc = fp.startsWith('ARC');
  let arcTxt = '';
  if (fp === 'ARC-S' && !g.tripped && load > 0.05) arcTxt = `<p class="alert">Der afsættes ca. ${fmtS(load * load * M.R_ARC_S)} W i den løse forbindelse. Strømmen er normal, så hverken gruppeafbryder eller HPFI reagerer. Det kan starte en brand. ${more('doc-afdd')}</p>`;
  if (fp === 'ARC-P' && !g.tripped) arcTxt = `<p class="alert">Lysbuen mellem fase og nul trækker ca. ${fmtS(load)} A. Det er for lidt til momentan udløsning af ${pr}. ${more('doc-afdd')}</p>`;
  const faultSec = sec('Fejl i gruppen', `<div class="fields">
      <label class="field">Fejl <select data-field="faultPair" data-id="${g.id}">${[['', 'Ingen'], ['L-PE', 'Isolationsfejl fase–PE'], ['N-PE', 'Isolationsfejl nul–PE'], ['L-N', 'Isolationsfejl fase–nul'], ['ARC-S', 'Løs forbindelse (serielysbue)'], ['ARC-P', 'Lysbue fase–nul']].map(([v, t]) => `<option value="${v}"${v === fp ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Fejlmodstand <select data-field="faultR" data-id="${g.id}"${g.fault && !isArc ? '' : ' disabled'}>${[[0.1, '0,1 Ω'], [10, '10 Ω'], [1e3, '1 kΩ'], [1e4, '10 kΩ'], [1.5e4, '15 kΩ'], [2e4, '20 kΩ'], [3e4, '30 kΩ'], [1e5, '100 kΩ'], [3e5, '300 kΩ'], [8e5, '800 kΩ']].map(([v, t]) => `<option value="${v}"${v === fr ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    ${arcTxt}<p class="hint">En isolationsfejl med høj modstand mærkes kun ved R ISO-måling. Med lav modstand får den afbryder eller HPFI til at udløse. En lysbue kan kun opdages af en AFDD. ${more('doc-iso')}</p>`);
  return head('Gruppe', `${g.name} · ${owner.name}`) + intro(INTRO.grp, 'doc-beskyttelse') + protSec + ikSection(g.id, 'group') +
    sec('Tilføj brugsgenstand', `<div class="add-app"><select id="addAppSel" aria-label="Vælg brugsgenstand">${opts}</select>${btn('Tilføj', 'addApp', g.id, '', 'btn-primary')}</div>`) +
    (apps ? sec('Brugsgenstande', `<ul class="app-list">${apps}</ul>`) : '') +
    meter(g.id, 'group') + faultSec +
    sec('Indstillinger', `<div class="fields"><label class="field">Navn <input type="text" data-field="name" data-id="${g.id}" value="${esc(g.name)}"></label>
      <div class="field"><span>Faser i gruppen</span><span class="seg">${sup.map(p => `<button type="button" data-iact="gphase" data-id="${g.id}" data-c="${p}" aria-pressed="${g.phases.includes(p)}">${p}</button>`).join('')}</span></div>
      <label class="field">Gruppeafbryder <select data-field="prot" data-id="${g.id}">${PROTS.map(p => `<option${p === protOf(g) ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
      ${cableFields(g.id, 'Gruppeledning')}</div>`) +
    sec('', `<div class="btns">${btn('Vis gruppeledning', 'selCable', g.id)}${btn('Slet gruppe', 'delGroup', g.id, '', 'ghost danger')}</div>`);
}
const ST_LABEL = {ok: 'I orden', tol: 'Uden for tolerance', low: 'Underspænding', burn: 'Over tålegrænsen', burned: 'Brændt af', off: 'Ingen spænding', slukket: 'Slukket', dcstop: 'Stoppet af DC-overvågning'};
function stText(st, info, a) {
  const d = info.def;
  if (st === 'ok') return 'Spændingen er inden for 230 V ± 10 %.';
  if (st === 'tol') return 'Spændingen er uden for 230 V ± 10 %. Apparatet virker, men kan tage skade over tid.';
  if (st === 'low') return info.parts.some(p => p.st === 'off') ? 'En fase mangler. En motor kører på to faser og bliver varm.'
    : (d.harm === 'motor' || d.harm === 'vfd' ? 'Underspænding. Motoren kan gå i stå og blive varm.' : 'For lav spænding. Apparatet slukker eller fungerer dårligt.');
  if (st === 'burn') return `Spændingen er over tålegrænsen på ${d.vMax} V. Apparatet ville brænde af, hvis "Udstyr kan brænde af" var slået til.`;
  if (st === 'burned') return `Brændt af ved ${fmt(a.burnV || 0, 0)} V. Det virker ikke igen, selvom fejlen rettes.`;
  if (st === 'off') return 'Ingen spænding. Apparatet er uden forsyning.';
  if (st === 'dcstop') return 'Laderens 6 mA DC-overvågning har afbrudt, fordi den målte glat DC-fejlstrøm. Det forhindrer, at HPFI\'en i tavlen bliver blind.';
  return 'Apparatet er slukket.';
}
function inspApp(a) {
  const info = app.appInfo(a), d = info.def, r = app.res, e = app.find(a.id);
  const connOpts = M.connOptions(d, e.group.phases.filter(p => app.supplyOf(e.owner).includes(p))), curConn = app.connOf(a);
  let meas = '';
  if (info.parts.some(p => p.e.active)) {
    let P = 0;
    const rows = info.parts.map(p => {
      const vs = r.elVSeries(p.e), is = r.elISeries(p.e);
      P += vs.reduce((s, x, i) => s + x.re * is[i].re + x.im * is[i].im, 0);
      return {k: p.k, lbl: p.e.lbl, v: M.rms(vs), i: M.rms(is), thd: M.thd(is), st: p.st, is, vs};
    });
    const tr = rows.map(x => row(`${x.lbl}: U / I`, `${fmt(x.v, 1)} V / ${fmtA(x.i)} A`, x.st === 'ok' ? '' : x.st)).join('');
    meas = sec('Målt', table([tr, row('Effekt nu', `${fmtS(P)} W <span class="muted">(${fmt(P / a.P * 100, 0)} % af mærkeeffekten)</span>`), row('THD i strømmen', `${fmt(rows[0].thd * 100, 0)} %`)]));
    const x = rows[0];
    meas += sec('', U.scopeSVG([{label: 'u', color: 'var(--muted)', s: x.vs, w: 1.5}], 'V', rows.length > 1 ? `Spænding over elementet ${x.lbl}` : `Spænding over apparatet (${x.lbl})`));
    meas += sec('', U.scopeSVG([{label: 'i', color: 'var(--combo)', s: x.is}], 'A', 'Strøm i apparatet'));
    if (Object.keys(M.HP[d.harm].h).length) meas += sec('', U.spectrumSVG(x.is, 'A', 'var(--combo)', 'Harmoniske strømme'));
  }
  const facts = table([
    row('Mærkeeffekt', `<input type="number" min="1" max="22000" step="1" data-field="appP" data-id="${a.id}" value="${Math.round(a.P)}"> W`),
    row('Tilslutning', connOpts.length ? `<select data-field="conn" data-id="${a.id}">${connOpts.map(c => `<option value="${c}"${c === curConn ? ' selected' : ''}>${M.connLabel(c)}</option>`).join('')}</select>` : 'kan ikke tilsluttes med gruppens faser'),
    row('cos φ', fmt(d.cos, 2)),
    row('Harmoniske', esc(M.HP[d.harm].name)),
    row('Tålegrænse', `${d.vMax} V${d.vMin ? ` · underspænding under ${d.vMin} V` : ''}`),
    row('Lækstrøm til PE', d.leak ? `${fmt(d.leak, 1)} mA (${d.leakRes ? 'resistiv' : 'kapacitiv'})` : 'ingen (klasse II)'),
  ]);
  const dcSec = d.dcCap ? sec('DC-fejlstrøm', `<div class="fields">
      <label class="field">Glat DC-fejlstrøm <select data-field="appDC" data-id="${a.id}">${[0, 3, 6, 10, 20, 50].map(v => `<option value="${v}"${v === (a.dc || 0) ? ' selected' : ''}>${v} mA</option>`).join('')}</select></label>
      ${a.type === 'elbil' ? `<label class="field">6 mA DC-overvågning (RDC-DD) <select data-field="rdcdd" data-id="${a.id}"><option value="1"${a.rdcdd ? ' selected' : ''}>Til</option><option value="0"${a.rdcdd ? '' : ' selected'}>Fra</option></select></label>` : ''}</div>
    <p class="hint">En fejl i apparatets elektronik kan sende glat DC ud i PE. Det kan mætte en HPFI af type AC, A eller F, så den bliver blind. ${more('doc-rcdtype')}</p>`) : '';
  return head(`Brugsgenstand · ${esc(d.cat)}`, d.name) +
    sec('', `<p class="where">${esc(app.where(a.id))}</p><div class="status st-${info.st}"><b>${ST_LABEL[info.st]}</b>${info.st !== 'slukket' && info.st !== 'burned' && info.st !== 'off' ? ` <span class="num">${fmt(info.v, 0)} V</span>` : ''}<p>${stText(info.st, info, a)}</p></div><p class="hint">${esc(d.info)} ${more(['smps', 'led', 'mikro', 'induk', 'vfd'].includes(d.harm) ? 'doc-harm' : 'doc-nul')}</p>`) +
    sec('', `<div class="btns">${a.burned ? btn('Reparer', 'repair', a.id, '', 'btn-primary') : ''}${a.dcTripped ? btn('Nulstil laderen', 'dcReset', a.id, '', 'btn-primary') : ''}${btn(a.on ? 'Sluk' : 'Tænd', 'toggleOn', a.id)}${btn('Vis gruppe', 'selGroup', e.group.id)}${btn('Slet', 'delApp', a.id, '', 'ghost danger')}</div>`) +
    dcSec + meas + sec('Data', facts);
}

app.renderInspector = () => {
  const el = $('#instInsp'), s = app.sel;
  let h = '';
  if (!s) h = `<div class="insp-empty"><h2>Klik på noget i diagrammet</h2><p>Vælg en tavle, et kabel, en gruppe eller en brugsgenstand for at se spændinger, strømme og harmoniske. Afbryd en leder for at se, hvad der sker.</p></div>`;
  else if (s.type === 'trafo') h = inspTrafo();
  else if (s.type === 'cable') h = app.roleOf(s.id) ? inspCable(s.id) : '';
  else {
    const e = app.find(s.id);
    h = s.type === 'ks' ? inspKs(e.obj) : s.type === 'bldg' ? inspBoard(e.obj, 'bldg') : s.type === 'unit' ? inspBoard(e.obj, 'unit')
      : s.type === 'group' ? inspGroup(e.obj) : inspApp(e.obj);
  }
  el.innerHTML = h;
};

/* ---------- Handlinger i inspektøren ---------- */
const IACT = {
  delKs: id => { app.net = app.net.filter(f => f.id !== id); app.sel = null; },
  delBldg: id => { const e = app.find(id); e.ks.buildings = e.ks.buildings.filter(b => b.id !== id); app.sel = null; },
  delUnit: id => { const e = app.find(id); e.bldg.units = e.bldg.units.filter(u => u.id !== id); app.sel = null; },
  delGroup: id => { const e = app.find(id); e.owner.groups = e.owner.groups.filter(g => g.id !== id); app.sel = null; },
  delApp: id => { const e = app.find(id); e.group.apps = e.group.apps.filter(a => a.id !== id); app.sel = {type: 'group', id: e.group.id}; },
  toggleOn: id => { const a = app.find(id).obj; a.on = !a.on; },
  repair: id => { app.find(id).obj.burned = false; app.eventLog = app.eventLog.filter(x => x.id !== id); },
  untrip: id => { app.find(id).obj.tripped = false; app.eventLog = app.eventLog.filter(x => x.id !== id); },
  trip: id => { app.find(id).obj.tripped = true; },
  rcdReset: id => { app.find(id).obj.rcdTripped = false; app.eventLog = app.eventLog.filter(x => x.id !== id); },
  earth: id => { const b = app.find(id).obj; b.earthBroken = !b.earthBroken; },
  faultInsert: id => { app.find(id).obj.fault = {pair: 'L-PE', R: app.meter.rf}; },
  afdd: id => { const g = app.find(id).obj; g.afdd = !g.afdd; },
  // Slå en fase til eller fra i en lejlighed eller gruppe. Der skal altid være mindst én.
  uphase: (id, c) => togglePhase(app.find(id).obj, c),
  rphase: (id, c) => { const o = app.find(id).obj; if (!o.cable.phases) o.cable.phases = o.phases.slice(); togglePhase(o.cable, c); },
  burnJoint: id => { const cab = app.find(id).obj.cable; if (cab.joint) { cab.broken[cab.joint.cond] = true; cab.joint = null; } },
  gphase: (id, c) => togglePhase(app.find(id).obj, c),
  dcReset: id => { app.find(id).obj.dcTripped = false; app.eventLog = app.eventLog.filter(x => x.id !== id); },
  cut: (id, c) => { const o = app.find(id).obj; o.cable.broken[c] = !o.cable.broken[c]; },
  addApp: id => { const g = app.find(id).obj, a = M.app($('#addAppSel').value); g.apps.push(a); },
  addGroup: id => app.act('addGroup', id),
  addUnit: id => app.act('addUnit', id),
  addHus: id => app.act('addHus', id),
  addEtage: id => app.act('addEtage', id),
};
function togglePhase(o, c) {
  if (o.phases.includes(c)) { if (o.phases.length > 1) o.phases = o.phases.filter(p => p !== c); }
  else o.phases = M.PH.filter(p => o.phases.includes(p) || p === c);
}
const SELECT = {selCable: id => app.select('cable', id, true), selGroup: id => app.select('group', id, true)};
const FIELDS = {
  name: (o, v) => { o.name = v.trim() || o.name; },
  earthing: (o, v) => { o.earthing = app.opts.nulling ? v : 'TT'; },
  RA: (o, v) => { const x = parseFloat(v); if (x > 0) o.RA = x; },
  conn: (o, v) => { o.conn = v; },
  jointCond: (o, v) => { o.cable.joint = v ? {cond: v, R: o.cable.joint ? o.cable.joint.R : 1} : null; },
  jointR: (o, v) => { if (o.cable.joint) o.cable.joint.R = +v; },
  split: (o, v) => { o.split = v; },
  feed: (o, v) => { o.feed = v; },
  nulling: (o, v) => { app.setNulling(v === '1'); },
  prot: (o, v) => { o.prot = v; },
  cableType: (o, v) => { o.cable.type = v; },
  cableLen: (o, v) => { const x = parseFloat(v); if (x > 0) o.cable.len = x; },
  appP: (o, v) => { const x = parseFloat(v); if (x > 0) o.P = x; },
  rcd: (o, v) => { o.rcd = v; o.rcdTripped = false; },
  rcdType: (o, v) => { o.rcdType = v; o.rcdTripped = false; },
  appDC: (o, v) => { o.dc = +v; o.dcTripped = false; },
  rdcdd: (o, v) => { o.rdcdd = v === '1'; o.dcTripped = false; },
  faultPair: (o, v) => { o.fault = v ? {pair: v, R: o.fault ? o.fault.R : 3e5} : null; },
  faultR: (o, v) => { if (o.fault) o.fault.R = +v; },
};

const insp = $('#instInsp');
insp.addEventListener('click', ev => {
  const s = ev.target.closest('[data-isel]');
  if (s) { const [t, id] = s.dataset.isel.split(':'); app.select(t, id, true); return; }
  const ms = ev.target.closest('button[data-mset]');
  if (ms) {
    const k = ms.dataset.mset;
    app.meter[k] = k === 'll' ? ms.dataset.v === '1' : ms.dataset.v;
    app.renderInspector();
    return;
  }
  const b = ev.target.closest('[data-iact]');
  if (!b) return;
  const name = b.dataset.iact, id = b.dataset.id;
  if (SELECT[name]) { SELECT[name](id); return; }
  if (['addGroup', 'addUnit', 'addHus', 'addEtage'].includes(name)) { IACT[name](id); return; }
  IACT[name](id, b.dataset.c);
  app.recompute();
});
insp.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.mset === 'rf') { app.meter.rf = +t.value; app.renderInspector(); return; }
  const f = t.dataset.field;
  if (!f) return;
  FIELDS[f](app.find(t.dataset.id).obj, t.value);
  app.recompute();
});

app.start();
})();
