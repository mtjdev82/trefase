/* Installation: tilstand, diagram over nettet og redigering. Inspektøren ligger i install-inspector.js. */
(function () {
'use strict';
const M = window.Inst, U = window.InstUI;
const {fmt, esc} = U;
const $ = s => document.querySelector(s);

const app = window.InstApp = {
  net: M.SCENARIOS.standard.make(),
  opts: {burn: true, prot: true, nulling: true},
  res: null,
  sel: null,
  idx: {},
  eventLog: [],
  meter: {fn: 'U', phase: 'L1', ll: false, rf: 0.01},
};

/* ---------- Opslag ---------- */
function reindex() {
  const idx = {trafo: {type: 'trafo', obj: {id: 'trafo', name: 'Transformer'}}};
  const addGroups = (owner, bldg) => owner.groups.forEach(g => {
    idx[g.id] = {type: 'group', obj: g, owner, bldg};
    g.apps.forEach(a => { idx[a.id] = {type: 'app', obj: a, group: g, owner, bldg}; });
  });
  for (const f of app.net) {
    idx[f.id] = {type: 'ks', obj: f};
    for (const b of f.buildings) {
      idx[b.id] = {type: 'bldg', obj: b, ks: f};
      addGroups(b, b);
      for (const u of b.units) { idx[u.id] = {type: 'unit', obj: u, bldg: b}; addGroups(u, b); }
    }
  }
  app.idx = idx;
}
app.find = id => app.idx[id];
app.supplyOf = owner => owner.phases || M.PH;
// Lokal nulling: PEN fortsætter op i stigeledningerne, og PE forbindes til PEN i hver lejlighed
app.isLocal = b => !!b && app.opts.nulling && b.earthing === 'TNCS' && b.split === 'local';
app.earthingOf = b => app.opts.nulling && b.earthing === 'TNCS' ? 'TNCS' : 'TT';
// De faser, en lejlighed kan få: dem, der findes i den stigeledning eller tavle, den forsynes fra
app.feedPhases = u => {
  const b = app.idx[u.id] && app.idx[u.id].bldg, f = b && u.feed !== 'main' ? b.units.find(v => v.id === u.feed) : null;
  return f ? (f.cable.phases || f.phases) : M.PH;
};
// De faser, der skal vises for en tavle. En lejlighed viser kun dem, den bruger, ikke dem stigeledningen fører videre.
app.usedPhases = id => {
  const e = app.idx[id], B = app.res.ckt.boards[id], all = M.PH.filter(L => B && B[L] !== undefined);
  return e && e.type === 'unit' ? all.filter(L => e.obj.phases.includes(L)) : all;
};
// Hold faserne konsistente: en lejlighed kan kun have de faser, den forsynes med, og en gruppe kun tavlens faser
app.fixPhases = () => {
  for (const f of app.net) for (const b of f.buildings) {
    const fix = (g, allowed) => { g.phases = g.phases.filter(p => allowed.includes(p)); if (!g.phases.length) g.phases = [allowed[0]]; };
    b.groups.forEach(g => fix(g, M.PH));
    const done = {};
    for (const u of M.unitOrder(b.units)) {
      const allowed = u.feed !== 'main' && done[u.feed] ? done[u.feed] : M.PH;
      if (!u.cable.phases) u.cable.phases = u.phases.slice();
      fix(u.cable, allowed);           // stigeledningens faser
      fix(u, u.cable.phases);          // de faser, lejligheden bruger
      done[u.id] = u.cable.phases;
      u.groups.forEach(g => fix(g, u.phases));
    }
  }
};
// Tilslutningen, apparatet faktisk har med gruppens faser
app.connOf = a => {
  const e = app.idx[a.id], ph = e.group.phases.filter(p => app.supplyOf(e.owner).includes(p));
  return M.normConn(M.APPL_BY_ID[a.type], a.conn, ph);
};
app.where = id => {
  const e = app.idx[id];
  if (!e) return '';
  if (e.type === 'app' || e.type === 'group') return `${e.owner.name} · ${e.group ? e.group.name : e.obj.name}`;
  return e.obj.name;
};

/* ---------- Status for spændinger ---------- */
const RANK = {ok: 0, tol: 1, low: 2, burn: 3};
app.vStatus = (v, def) => {
  const Un = def ? def.U : 230;
  if (v < 20) return 'off';
  if (v >= (def ? def.vMax : 280)) return 'burn';
  if (def && def.vMin && v < def.vMin) return 'low';
  if (v < 0.9 * Un || v > 1.1 * Un) return 'tol';
  return 'ok';
};
app.appInfo = a => {
  const def = M.APPL_BY_ID[a.type], els = (app.res.ckt.appEl[a.id] || []);
  const parts = els.map(e => {
    const v = M.rms(app.res.elVSeries(e));
    return {e, k: e.k, v, st: app.vStatus(v, def)};
  });
  if (a.burned) return {st: 'burned', v: a.burnV || 0, parts, def};
  if (a.dcTripped) return {st: 'dcstop', v: 0, parts, def};
  if (!a.on) return {st: 'slukket', v: 0, parts, def};
  if (!parts.length) return {st: 'off', v: 0, parts, def};
  const live = parts.filter(p => p.st !== 'off');
  if (!live.length) return {st: 'off', v: 0, parts, def};
  let worst = live[0];
  for (const p of live) if (RANK[p.st] > RANK[worst.st] || (RANK[p.st] === RANK[worst.st] && Math.abs(p.v - p.e.Un) > Math.abs(worst.v - worst.e.Un))) worst = p;
  const st = live.length < parts.length && RANK[worst.st] < RANK.low ? 'low' : worst.st;
  return {st, v: worst.v, parts, def};
};
app.boardV = (owner, L) => {
  const B = app.res.ckt.boards[owner];
  return B && B[L] !== undefined ? M.rms(app.res.vSeries(B[L], B.N)) : null;
};
app.touchV = owner => {
  const B = app.res.ckt.boards[owner];
  return B && B.PE !== undefined ? M.rms(app.res.vSeries(B.PE, -1)) : null;
};

/* ---------- Beregning ---------- */
app.recompute = () => {
  reindex();
  app.fixPhases();
  app.res = M.compute(app.net, app.opts);
  for (const e of app.res.events) {
    const t = e.at;
    if (e.type === 'burn') app.eventLog.push({type: 'burn', id: e.app.id, sel: `app:${e.app.id}`, t, name: M.APPL_BY_ID[e.app.type].name, text: `brændte af (${app.where(e.app.id)}, ${e.lbl}, ${fmt(e.v, 0)} V)`});
    else if (e.type === 'mcb') app.eventLog.push({type: 'mcb', id: e.g.id, I: e.I, sel: `group:${e.g.id}`, t, name: `${e.prot} i ${e.owner.name} · ${e.g.name}`, text: `udløste (${U.fmtS(e.I)} A)`});
    else if (e.type === 'afdd') app.eventLog.push({type: 'afdd', id: e.g.id, sel: `group:${e.g.id}`, t, name: `AFDD i ${e.owner.name} · ${e.g.name}`, text: `udløste (${e.kind === 'ARC-S' ? 'serielysbue' : 'parallel lysbue'}, ${U.fmtS(e.I)} A)`});
    else if (e.type === 'rdcdd') app.eventLog.push({type: 'rdcdd', id: e.app.id, sel: `app:${e.app.id}`, t, name: `${M.APPL_BY_ID[e.app.type].name} i ${e.owner.name}`, text: `stoppede på DC-overvågningen (${fmt(e.I * 1000, 0)} mA glat DC)`});
    else app.eventLog.push({type: 'rcd', id: e.owner.id, sel: `${app.idx[e.owner.id].type}:${e.owner.id}`, t, name: `HPFI i ${e.owner.name}`, text: `udløste (${e.dc ? 'glat DC' : 'fejlstrøm'} ${fmt(e.I * 1000, 0)} mA)`});
  }
  app.render();
};
app.fmtT = t => t < 1 ? `${fmt(t * 1000, 0)} ms` : `${fmt(t, 1)} s`;
app.fmtI = v => v == null || !isFinite(v) ? '—' : v >= 1000 ? `${fmt(v / 1000, 2)} kA` : `${fmt(v, 0)} A`;
app.showIk = true;
const ikLine = id => {
  if (!app.showIk) return '';
  const x = app.res.ik()[id];
  return x ? `<span class="ik-l">Ik,min ${app.fmtI(x.ik1n)}</span>` : '';
};
app.render = () => {
  if (app.sel && !app.idx[app.sel.id] && app.sel.type !== 'cable') app.sel = null;
  if (app.sel && app.sel.type === 'cable' && !app.idx[app.sel.id]) app.sel = null;
  renderSummary();
  renderNet();
  if (app.renderInspector) app.renderInspector();
};
app.select = (type, id, reveal) => { app.sel = {type, id}; app.render(); if (reveal) app.reveal(); };
// Rul diagrammet vandret, så det valgte er synligt
app.reveal = () => {
  const wrap = $('#instNet'), el = wrap.querySelector('.sel');
  if (!el) return;
  const w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.left < w.left || r.right > w.right) wrap.scrollLeft += (r.left + r.width / 2) - (w.left + w.width / 2);
};

/* ---------- Diagram ---------- */
const mm = s => String(M.CABLES[s].mm2).replace('.', ',');
app.cableConds = (role, owner) => {
  if (role === 'feeder' || role === 'stik') return ['L1', 'L2', 'L3', 'N'];
  if (role === 'stige') {
    const rp = owner.cable.phases || owner.phases;
    return app.isLocal(app.idx[owner.id] && app.idx[owner.id].bldg) ? [...rp, 'N'] : [...rp, 'N', 'PE'];
  }
  return [...owner.phases, 'N', 'PE'];
};
app.cableName = (role, owner) => {
  const s = M.CABLES[owner.cable.type], c = app.cableConds(role, owner);
  return c.includes('PE') ? `${c.length}G${mm(owner.cable.type)} ${s.mat}` : `${c.length}×${mm(owner.cable.type)} ${s.mat}`;
};
app.roleOf = id => {
  const e = app.idx[id];
  return !e ? null : e.type === 'ks' ? 'feeder' : e.type === 'bldg' ? 'stik' : e.type === 'unit' ? 'stige' : e.type === 'group' ? 'group' : null;
};
app.isPEN = id => {
  const e = app.idx[id];
  return !!e && ((e.type === 'ks' && app.opts.nulling) || (e.type === 'bldg' && app.earthingOf(e.obj) === 'TNCS') || (e.type === 'unit' && app.isLocal(e.bldg)));
};

const isSel = (type, id) => app.sel && app.sel.type === type && app.sel.id === id ? ' sel' : '';
function wires(id, role, owner) {
  const pen = app.isPEN(id), br = owner.cable.broken;
  return app.cableConds(role, owner).map(c => `<span class="w w-${c}${c === 'N' && pen ? ' pen' : ''}${br[c] ? ' cut' : ''}"></span>`).join('');
}
function cutText(owner, id) {
  const cut = Object.keys(owner.cable.broken).filter(c => owner.cable.broken[c]), j = owner.cable.joint;
  let s = cut.length ? `<span class="cut-t">${cut.map(c => c === 'N' && app.isPEN(id) ? 'PEN' : c).join(', ')} afbrudt</span>` : '';
  if (j) s += `<span class="joint-t">dårlig samling i ${j.cond === 'N' && app.isPEN(id) ? 'PEN' : j.cond} (${fmt(j.R, j.R < 1 ? 2 : 0)} Ω)</span>`;
  return s;
}
function cableH(f) {
  return `<button type="button" class="cable h${isSel('cable', f.id)}" data-sel="cable:${f.id}" aria-label="Fordelingskabel til ${esc(f.name)}">
    <span class="wires">${wires(f.id, 'feeder', f)}</span>
    <span class="cable-l">${app.cableName('feeder', f)} · ${f.cable.len} m${cutText(f, f.id)}</span></button>`;
}
function cableV(o, role) {
  let title = role === 'stik' ? 'Stikledning' : 'Stigeledning';
  if (role === 'stige') { const f = o.feed !== 'main' && app.find(o.feed); title += f ? ` fra ${esc(f.obj.name)}` : ' fra hovedtavlen'; }
  return `<button type="button" class="cable v${isSel('cable', o.id)}" data-sel="cable:${o.id}" aria-label="${title} til ${esc(o.name)}">
    <span class="wires">${wires(o.id, role, o)}</span>
    <span class="cable-l"><b>${title}</b>${app.cableName(role, o)} · ${o.cable.len} m${cutText(o, o.id)}</span></button>`;
}
function voltRow(owner) {
  const B = app.res.ckt.boards[owner];
  if (!B) return '';
  return '<span class="vrow">' + app.usedPhases(owner).map(L => {
    const v = app.boardV(owner, L);
    return `<span class="vr st-${app.vStatus(v)}"><i style="--c:var(--l${L[1]})"></i>${fmt(v, 0)}</span>`;
  }).join('') + '<span class="vr-u">V</span></span>';
}
function tavle(kind, o) {
  const pe = app.touchV(o.id), broken = !!o.cable.broken.N;
  const tag = kind === 'bldg' ? (app.earthingOf(o) === 'TNCS' ? (app.isLocal(o) ? 'TN-C · nulling i lejl.' : 'TN-C-S') : 'TT · jordspyd')
    : (o.phases.length === 3 ? '3-faset' : o.phases.join('+')) + (app.isLocal(app.idx[o.id] && app.idx[o.id].bldg) ? ' · nullet' : '');
  let peTxt = pe !== null && pe >= 5 ? `<span class="pe-w${pe >= 50 ? ' danger' : ''}">PE ${fmt(pe, 0)} V mod jord</span>` : '';
  let sens = null;
  if (o.rcd !== 'none' && !o.rcdTripped) { const rs = app.res.residual(o.groups); sens = M.rcdSens(o.rcdType, M.rcdParams(o.name, o.rcd), rs.dc).status; }
  const badges = [o.rcd === 'none' ? '<span class="badge-s">ingen HPFI</span>' : o.rcdTripped ? '<span class="badge-s trip">HPFI udløst</span>'
    : sens === 'blind' ? '<span class="badge-s trip">HPFI blind</span>' : sens === 'nedsat' ? '<span class="badge-s warn">HPFI nedsat</span>' : '',
    o.earthBroken ? '<span class="badge-s trip">jordledning afbrudt</span>' : ''].join('');
  if (badges) peTxt += `<span class="badges">${badges}</span>`;
  return `<div class="tavle${isSel(kind, o.id)}">
    <button type="button" class="tavle-main" data-sel="${kind}:${o.id}">
      <span class="tv-h"><b>${esc(o.name)}</b><span class="tag">${tag}</span></span>
      <span class="box-k">${kind === 'bldg' ? 'Hovedtavle' : 'Undertavle'}</span>
      ${voltRow(o.id)}${ikLine(o.id)}${peTxt}
    </button>
    <button type="button" class="nbreak" data-act="breakN" data-id="${o.id}" aria-pressed="${broken}">${broken ? 'Nul afbrudt' : 'Manglende nul'}</button>
  </div>`;
}
function appChip(a) {
  const info = app.appInfo(a), def = info.def;
  const v = info.st === 'burned' ? 'brændt' : info.st === 'slukket' ? 'slukket' : info.st === 'dcstop' ? 'DC-stop' : info.st === 'off' ? '0 V' : `${fmt(info.v, 0)} V`;
  const g = app.idx[a.id].group, c = app.connOf(a);
  const tag = g.phases.length > 1 || def.kind !== 'LN' ? `<span class="app-ph">${!c ? '—' : c === '3D' ? '3×400' : c === '3' ? '3~' : c.replace('-', '–')}</span>` : '';
  return `<button type="button" class="app st-${info.st}${isSel('app', a.id)}" data-sel="app:${a.id}" title="${esc(def.name)}: ${M.connLabel(c)}, ${v}"><span class="st-dot"></span>${tag}<span class="app-n">${esc(def.name)}</span><span class="app-v">${v}</span></button>`;
}
// Etage og side ud fra navnet, fx "St. tv", "1. th", "4. mf"
const parseFloor = name => {
  const m = /^\s*(st|kl|\d+)\.?\s*(tv|mf|th)\b/i.exec(name);
  return m ? {floor: /^st/i.test(m[1]) ? 0 : /^kl/i.test(m[1]) ? -1 : +m[1], side: m[2].toLowerCase()} : null;
};
// Lejlighederne i kolonner. Hedder de alle "etage side", stilles de op som i bygningen: én kolonne pr. side,
// stuen øverst. Ellers én kolonne pr. stigeledning i den rækkefølge, lejlighederne forsynes.
function riserColumns(b) {
  const parsed = b.units.map(u => parseFloor(u.name));
  if (b.units.length && parsed.every(Boolean)) {
    return ['tv', 'mf', 'th'].map(side => b.units.filter((u, i) => parsed[i].side === side)
      .sort((x, y) => parseFloor(x.name).floor - parseFloor(y.name).floor)).filter(c => c.length);
  }
  return chainColumns(b);
}
function chainColumns(b) {
  const ids = new Set(b.units.map(u => u.id)), kids = {}, roots = [], seen = new Set(), cols = [];
  for (const u of b.units) { if (u.feed !== 'main' && ids.has(u.feed) && u.feed !== u.id) (kids[u.feed] = kids[u.feed] || []).push(u); else roots.push(u); }
  const walk = (u, col) => { if (seen.has(u.id)) return; seen.add(u.id); col.push(u); (kids[u.id] || []).forEach(k => walk(k, col)); };
  for (const r of roots) { const col = []; walk(r, col); cols.push(col); }
  for (const u of b.units) if (!seen.has(u.id)) cols.push([u]);
  return cols;
}
// Ik,min ved gruppens udtag. Rød, hvis den er for lille til, at gruppeafbryderen udløser momentant.
function groupIk(g) {
  if (!app.showIk) return '';
  const x = app.res.ik()[g.id];
  if (!x) return '';
  const pr = M.protOf(g), Ia = (pr[0] === 'B' ? 5 : 10) * +pr.slice(1);
  return `<span class="ik-g${x.ik1n < Ia ? ' bad' : ''}" title="Ik,min ved udtaget. ${pr} kræver mindst ${Ia} A.">Ik,min ${app.fmtI(x.ik1n)}</span>`;
}
function groups(o) {
  return `<div class="grps">${o.groups.map((g, i) => `<div class="grp${isSel('group', g.id) || isSel('cable', g.id)}">
      <button type="button" class="cable g${isSel('cable', g.id)}" data-sel="cable:${g.id}" aria-label="Gruppeledning ${esc(g.name)}"><span class="wires">${wires(g.id, 'group', g)}</span></button>
      <div class="grp-b">
        <button type="button" class="grp-h" data-sel="group:${g.id}"><span class="ph" style="--c:${g.phases.length > 1 ? 'var(--ink)' : `var(--l${g.phases[0][1]})`}">${g.phases.length === 3 ? '3~' : g.phases.join('+')}</span>G${i + 1} ${esc(g.name)}${cutText(g, g.id)}${g.tripped ? '<span class="badge-s trip">udløst</span>' : ''}${g.fault ? (g.fault.pair.startsWith('ARC') ? '<span class="badge-s trip">lysbue</span>' : '<span class="badge-s warn">isolationsfejl</span>') : ''}${g.afdd ? '<span class="badge-s">AFDD</span>' : ''}${groupIk(g)}</button>
        <div class="apps">${g.apps.map(appChip).join('')}<button type="button" class="app-add" data-sel="group:${g.id}" aria-label="Tilføj apparat i ${esc(g.name)}">+</button></div>
      </div></div>`).join('')}
    <button type="button" class="mini-add" data-act="addGroup" data-id="${o.id}">+ Gruppe</button></div>`;
}
function building(b) {
  let h = `<div class="bld">${cableV(b, 'stik')}<div class="bld-frame ${b.kind}">${tavle('bldg', b)}${groups(b)}`;
  if (b.kind === 'etage') {
    h += `<div class="units">${riserColumns(b).map(col => `<div class="riser">${col.map(u => `<div class="unit">${cableV(u, 'stige')}<div class="unit-frame">${tavle('unit', u)}${groups(u)}</div></div>`).join('')}</div>`).join('')}
      <div class="riser riser-add"><button type="button" class="mini-add" data-act="addUnit" data-id="${b.id}">+ Lejlighed</button></div></div>`;
  }
  return h + '</div></div>';
}
function renderNet() {
  let h = `<div class="net"><div class="col"><button type="button" class="box trafo${isSel('trafo', 'trafo')}" data-sel="trafo:trafo">
    <span class="box-k">Transformer · ${app.opts.nulling ? 'udlagt til nulling' : 'kun TT (jordspyd)'}</span><span class="box-t">10/0,4 kV · 400 kVA</span>${voltRow('trafo')}${ikLine('trafo')}</button></div>`;
  for (const f of app.net) {
    // Kablet strækkes, så lederne går helt hen til kabelskabet
    h += `<div class="col ks-col"><div class="ks-top">${cableH(f)}<button type="button" class="box ks${isSel('ks', f.id)}" data-sel="ks:${f.id}"><span class="box-k">Kabelskab</span><span class="box-t">${esc(f.name)}</span>${voltRow(f.id)}${ikLine(f.id)}</button></div>
      <div class="kids">${f.buildings.map(building).join('')}
        <div class="kid-add"><button type="button" class="mini-add" data-act="addHus" data-id="${f.id}">+ Hus</button><button type="button" class="mini-add" data-act="addEtage" data-id="${f.id}">+ Etageejendom</button></div>
      </div></div>`;
  }
  h += `<div class="col"><button type="button" class="mini-add ks-add" data-act="addKs">+ Kabelskab</button></div></div>`;
  const wrap = $('#instNet'), sx = wrap.scrollLeft;
  wrap.innerHTML = h;
  wrap.scrollLeft = sx;
}

function renderSummary() {
  let cuts = 0;
  const each = o => { cuts += Object.values(o.cable.broken).filter(Boolean).length; if (o.cable.joint) faults++; };
  let maxV = {v: 0}, maxPE = {v: 0}, burned = 0, trips = 0, faults = 0;
  for (const f of app.net) {
    each(f);
    for (const b of f.buildings) for (const o of [b, ...b.units]) {
      each(o);
      if (o.rcdTripped) trips++;
      if (o.earthBroken) faults++;
      o.groups.forEach(g => { each(g); burned += g.apps.filter(a => a.burned).length; if (g.tripped) trips++; if (g.fault) faults++; });
      for (const L of app.usedPhases(o.id)) { const v = app.boardV(o.id, L); if (v !== null && v > maxV.v) maxV = {v, where: `${o.name}, ${L}`}; }
      const pe = app.touchV(o.id);
      if (pe !== null && pe > maxPE.v) maxPE = {v: pe, where: o.name};
    }
  }
  const chip = (label, val, st) => `<span class="sum-chip${st ? ' st-' + st : ''}"><span>${label}</span><b>${val}</b></span>`;
  let h = chip('Afbrudte ledere', cuts, cuts ? 'tol' : '') +
    chip('Andre fejl', faults, faults ? 'tol' : '') +
    chip('Udløste afbrydere', trips, trips ? 'tol' : '') +
    chip('Brændt af', burned, burned ? 'burn' : '') +
    chip('Højeste spænding L–N', `${fmt(maxV.v, 0)} V <small>${esc(maxV.where || '')}</small>`, app.vStatus(maxV.v)) +
    chip('Højeste spænding på PE', `${fmt(maxPE.v, 0)} V <small>${esc(maxPE.where || '')}</small>`, maxPE.v >= 50 ? 'burn' : maxPE.v >= 25 ? 'tol' : '');
  $('#instSummary').innerHTML = h;
  $('#instLog').innerHTML = app.eventLog.length
    ? `<b>Hændelser i den rækkefølge, de skete:</b> <ol>${app.eventLog.map(e => `<li class="ev-${e.type}"><span class="num ev-t">${app.fmtT(e.t)}</span> <button type="button" class="link" data-sel="${e.sel}">${esc(e.name)}</button> <span class="muted">${esc(e.text)}</span></li>`).join('')}</ol>`
    : '';
  $('#instLog').hidden = !app.eventLog.length;
}

/* ---------- Redigering ---------- */
let n = {h: 2, e: 1, k: 2, u: 2};
const ACTS = {
  breakN: id => { const o = app.idx[id].obj; o.cable.broken.N = !o.cable.broken.N; },
  addKs: () => { const f = M.ks(`Kabelskab ${app.net.length + 1}`, M.cable('Al95', 100), []); app.net.push(f); app.sel = {type: 'ks', id: f.id}; },
  addHus: id => {
    const b = M.house(`Hus ${++n.h + 1}`, app.opts.nulling ? 'TNCS' : 'TT', [M.group('Lys', 'L1', ['led', 'router']), M.group('Stue', 'L2', ['tv']), M.group('Køkken', 'L3', ['koleskab', 'elkedel'])]);
    app.idx[id].obj.buildings.push(b); app.sel = {type: 'bldg', id: b.id};
  },
  addEtage: id => {
    const b = M.etage(`Etageejendom ${++n.e}`, app.opts.nulling ? 'TNCS' : 'TT', [], [M.unit('Lejlighed 1', '3', [M.group('Køkken', 'L1', ['elkedel']), M.group('Stue', 'L2', ['tv', 'router']), M.group('Værelse', 'L3', ['laptop'])])]);
    app.idx[id].obj.buildings.push(b); app.sel = {type: 'bldg', id: b.id};
  },
  // En ny lejlighed sættes øverst på den sidst tilføjede stigeledning med de samme faser
  addUnit: id => {
    const b = app.idx[id].obj, last = b.units[b.units.length - 1];
    const ph = last ? last.phases : M.PH;
    const u = M.unit(`Lejlighed ${b.units.length + 1}`, ph, [M.group('Køkken', ph[0], ['koleskab', 'elkedel']), M.group('Stue', ph[ph.length - 1], ['tv', 'router', 'led'])], M.cable(ph.length === 3 ? 'Cu16' : 'Cu10', last ? 3 : 10), last ? last.id : 'main');
    b.units.push(u); app.sel = {type: 'unit', id: u.id};
  },
  addGroup: id => {
    const o = app.idx[id].obj, ph = app.supplyOf(o);
    const g = M.group(`Gruppe ${o.groups.length + 1}`, ph[o.groups.length % ph.length], []);
    o.groups.push(g); app.sel = {type: 'group', id: g.id};
  },
};
app.act = (name, id) => { ACTS[name](id); app.recompute(); };
const tavler = () => app.net.flatMap(f => f.buildings.flatMap(b => [b, ...b.units]));
app.clearFaults = () => {
  app.net.forEach(f => { f.cable.broken = {}; f.cable.joint = null; });
  tavler().forEach(o => {
    Object.assign(o.cable, {broken: {}, joint: null});
    o.earthBroken = false;
    o.groups.forEach(g => { Object.assign(g.cable, {broken: {}, joint: null}); g.fault = null; g.apps.forEach(a => { a.dc = 0; }); });
  });
};
app.resetTrips = () => {
  tavler().forEach(o => { o.rcdTripped = false; o.groups.forEach(g => { g.tripped = false; g.apps.forEach(a => { a.dcTripped = false; }); }); });
  app.eventLog = app.eventLog.filter(e => e.type === 'burn');
};
app.load = (net, nulling = true) => { app.net = net; app.opts.nulling = nulling; app.eventLog = []; app.sel = null; };
// Er transformerkredsen ikke udlagt til nulling, skal alle installationer være TT med jordspyd
app.setNulling = on => {
  app.opts.nulling = on;
  if (!on) app.net.forEach(f => f.buildings.forEach(b => { b.earthing = 'TT'; }));
};

function onClick(e) {
  const a = e.target.closest('[data-act]');
  if (a) { app.act(a.dataset.act, a.dataset.id); return; }
  const s = e.target.closest('[data-sel]');
  if (s) { const [type, id] = s.dataset.sel.split(':'); app.select(type, id, !!e.target.closest('#instLog')); }
}

/* ---------- Faner ---------- */
const LEADS = {
  theory: 'Tre faser forskudt 120°. Sæt to punkter på kurvernes toppe og se, hvorfor spændingen mellem to faser er 400 V og ikke 460 V.',
  install: 'Fra transformer til stikkontakt. Afbryd en nul eller en fase hvor som helst, og se hvad der sker med spændingen og med udstyret i alle installationer.',
  docs: 'Sådan bruger du værktøjet, teorien bag, installationstesterens målinger og modellen, simulatoren regner med.',
};
const TABS = {theory: ['#viewTheory', '#tabTheory', 'grundteori'], install: ['#viewInstall', '#tabInstall', 'installation'], docs: ['#viewDocs', '#tabDocs', 'vejledning']};
function showTab(t) {
  for (const [k, [view, tab]] of Object.entries(TABS)) {
    $(view).hidden = k !== t;
    $(tab).setAttribute('aria-selected', k === t);
  }
  $('#modeSeg').hidden = t !== 'theory';
  $('.lead').textContent = LEADS[t];
  try { history.replaceState(null, '', '#' + TABS[t][2]); } catch (err) { /* ok */ }
  if (t === 'install' && !app.res) { app.recompute(); app.reveal(); }
}
app.showTab = showTab;
app.openDoc = id => {
  showTab('docs');
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({block: 'start'}); el.focus({preventScroll: true}); }
};

app.start = () => {
  const sc = $('#instScenario');
  sc.innerHTML = Object.entries(M.SCENARIOS).map(([k, s]) => `<option value="${k}">${esc(s.name)}</option>`).join('');
  sc.addEventListener('change', () => { const s = M.SCENARIOS[sc.value]; app.load(s.make(), s.nulling !== false); app.recompute(); });
  $('#instBurn').addEventListener('change', e => { app.opts.burn = e.target.checked; app.recompute(); });
  $('#instProt').addEventListener('change', e => { app.opts.prot = e.target.checked; app.recompute(); });
  $('#instIk').addEventListener('change', e => { app.showIk = e.target.checked; app.render(); });
  $('#instRestore').addEventListener('click', () => { app.clearFaults(); app.recompute(); });
  $('#instReset').addEventListener('click', () => { app.resetTrips(); app.recompute(); });
  $('#instRepair').addEventListener('click', () => {
    Object.values(app.idx).forEach(x => { if (x.type === 'app') x.obj.burned = false; });
    app.eventLog = app.eventLog.filter(e => e.type !== 'burn');
    app.recompute();
  });
  $('#instNet').addEventListener('click', onClick);
  $('#instLog').addEventListener('click', onClick);
  for (const [k, [, tab]] of Object.entries(TABS)) $(tab).addEventListener('click', () => showTab(k));
  app.sel = {type: 'unit', id: app.net[1].buildings[0].units[0].id};
  const fromHash = Object.keys(TABS).find(k => '#' + TABS[k][2] === location.hash);
  showTab(fromHash || 'theory');
};
})();
