/* Installation: datamodel, kredsløb og beregning.
   Nettet regnes som et kredsløb med komplekse tal (knudepunktsanalyse), én gang for 50 Hz og én gang
   for hver harmonisk orden. Brugsgenstande er faste impedanser ved 230 V; ikke-lineære apparater
   (SMPS, LED m.fl.) sender desuden harmoniske strømme ud i nettet. */
(function () {
'use strict';
const SQ2 = Math.SQRT2;
const HARM = [1, 3, 5, 7, 9, 11, 13, 15];
const PH = ['L1', 'L2', 'L3'];
const U_NOM = 230;
const E_SRC = 233;               // transformerens tomgangsspænding pr. fase
const ZT = {R: 0.005, X: 0.015}; // 400 kVA, uk ≈ 4 %
const RB = 2;                    // driftsjord ved transformeren [Ω]
const LEAK = 1e-9;               // lille afledning fra alle knuder, så en isoleret knude ikke giver en singulær matrix
const BOND = 1e-4;               // PEN-opdelingen i en TN-C-S-hovedtavle
const R_HEALTHY = 2e9;           // sund isolation pr. gruppe [Ω]
const BURN_T = 0.5;              // et apparat over tålegrænsen når at brænde af efter ca. ½ s
const R_ARC_S = 0.5;             // løs forbindelse med serielysbue [Ω]
const R_ARC_P = 3.5;             // lysbue mellem fase og nul [Ω]

/* R og X i Ω/km pr. leder. Iz er en vejledende strømværdi i A for et kabel med tre belastede ledere. */
const CABLES = {
  'Cu1.5': {mat: 'Cu', mm2: 1.5, R: 12.1, X: 0.105, Iz: 15},
  'Cu2.5': {mat: 'Cu', mm2: 2.5, R: 7.41, X: 0.100, Iz: 20},
  Cu4: {mat: 'Cu', mm2: 4, R: 4.61, X: 0.095, Iz: 27},
  Cu6: {mat: 'Cu', mm2: 6, R: 3.08, X: 0.090, Iz: 34},
  Cu10: {mat: 'Cu', mm2: 10, R: 1.83, X: 0.085, Iz: 46},
  Cu16: {mat: 'Cu', mm2: 16, R: 1.15, X: 0.082, Iz: 61},
  Cu25: {mat: 'Cu', mm2: 25, R: 0.727, X: 0.080, Iz: 80},
  Cu35: {mat: 'Cu', mm2: 35, R: 0.524, X: 0.078, Iz: 99},
  Cu50: {mat: 'Cu', mm2: 50, R: 0.387, X: 0.077, Iz: 119},
  Cu70: {mat: 'Cu', mm2: 70, R: 0.268, X: 0.075, Iz: 151},
  Cu95: {mat: 'Cu', mm2: 95, R: 0.193, X: 0.074, Iz: 182},
  Cu120: {mat: 'Cu', mm2: 120, R: 0.153, X: 0.073, Iz: 210},
  Cu150: {mat: 'Cu', mm2: 150, R: 0.124, X: 0.072, Iz: 240},
  Cu185: {mat: 'Cu', mm2: 185, R: 0.0991, X: 0.071, Iz: 273},
  Cu240: {mat: 'Cu', mm2: 240, R: 0.0754, X: 0.070, Iz: 321},
  Al16: {mat: 'Al', mm2: 16, R: 1.91, X: 0.082, Iz: 48},
  Al25: {mat: 'Al', mm2: 25, R: 1.20, X: 0.082, Iz: 63},
  Al35: {mat: 'Al', mm2: 35, R: 0.868, X: 0.080, Iz: 77},
  Al50: {mat: 'Al', mm2: 50, R: 0.641, X: 0.078, Iz: 93},
  Al70: {mat: 'Al', mm2: 70, R: 0.443, X: 0.076, Iz: 118},
  Al95: {mat: 'Al', mm2: 95, R: 0.320, X: 0.075, Iz: 142},
  Al120: {mat: 'Al', mm2: 120, R: 0.253, X: 0.074, Iz: 164},
  Al150: {mat: 'Al', mm2: 150, R: 0.206, X: 0.072, Iz: 189},
  Al185: {mat: 'Al', mm2: 185, R: 0.164, X: 0.071, Iz: 215},
  Al240: {mat: 'Al', mm2: 240, R: 0.125, X: 0.070, Iz: 252},
};
const ROLE_CABLES = {
  feeder: ['Al240', 'Al150', 'Al95'],
  stik: ['Al95', 'Al50', 'Al25', 'Al16', 'Cu25', 'Cu16', 'Cu10', 'Cu6'],
  stige: ['Cu25', 'Cu16', 'Cu10', 'Cu6'],
  group: ['Cu6', 'Cu4', 'Cu2.5', 'Cu1.5'],
};

/* Harmoniske strømme i procent af grundtonen */
const HP = {
  none: {name: 'Ingen (lineær belastning)', h: {}},
  smps: {name: 'SMPS uden PFC', h: {3: .85, 5: .62, 7: .38, 9: .18, 11: .08, 13: .06, 15: .05}},
  led: {name: 'LED-driver', h: {3: .88, 5: .68, 7: .45, 9: .25, 11: .12, 13: .08, 15: .06}},
  pfc: {name: 'SMPS med aktiv PFC', h: {3: .06, 5: .04, 7: .03, 9: .02}},
  motor: {name: 'Motor', h: {3: .05, 5: .03, 7: .02}},
  mikro: {name: 'Transformer og ensretter', h: {3: .30, 5: .12, 7: .06, 9: .03}},
  induk: {name: 'Ensretter med filter', h: {3: .18, 5: .09, 7: .05}},
  vfd: {name: 'Frekvensomformer (6-puls)', h: {5: .40, 7: .22, 11: .08, 13: .05}},
};
// Ensrettere trækker strøm i pulser ved spændingens top: 3., 7., 11. og 15. harmoniske ligger i modfase
const RECT = new Set(['smps', 'led', 'mikro', 'induk']);

const APPL = [
  {id: 'koleskab', name: 'Køleskab', cat: 'Køkken', P: 120, cos: .8, harm: 'motor', vMin: 195, vMax: 280, info: 'Kompressormotor. Ved underspænding kan motoren ikke starte og bliver varm.'},
  {id: 'fryser', name: 'Fryser', cat: 'Køkken', P: 100, cos: .8, harm: 'motor', vMin: 195, vMax: 280, info: 'Kompressormotor. Ved underspænding kan motoren ikke starte og bliver varm.'},
  {id: 'ovn', name: 'Ovn', cat: 'Køkken', P: 2500, cos: 1, harm: 'none', vMax: 320, info: 'Varmelegemer (ohmsk). Effekten følger U²: ved 400 V er den tre gange så stor.'},
  {id: 'mikro', name: 'Mikrobølgeovn', cat: 'Køkken', P: 1200, cos: .95, harm: 'mikro', vMin: 190, vMax: 270, info: 'Transformer, ensretter og magnetron. Følsom over for overspænding.'},
  {id: 'elkedel', name: 'Elkedel', cat: 'Køkken', P: 2000, cos: 1, harm: 'none', vMax: 300, info: 'Ohmsk varmelegeme.'},
  {id: 'kaffe', name: 'Kaffemaskine', cat: 'Køkken', P: 1000, cos: 1, harm: 'none', vMax: 300, info: 'Ohmsk varmelegeme.'},
  {id: 'opvask', name: 'Opvaskemaskine', cat: 'Køkken', P: 2000, cos: .98, harm: 'motor', vMin: 195, vMax: 290, info: 'Varmelegeme, pumpe og styreelektronik.'},
  {id: 'emhaette', name: 'Emhætte', cat: 'Køkken', P: 150, cos: .9, harm: 'motor', vMin: 195, vMax: 280, info: 'Lille motor.'},
  {id: 'tv', name: 'TV', cat: 'Stue og kontor', P: 100, cos: .98, harm: 'smps', vMin: 90, vMax: 285, info: 'Strømforsyning (SMPS). Trækker strøm i korte pulser nær spændingens top.'},
  {id: 'laptop', name: 'Bærbar-oplader', cat: 'Stue og kontor', P: 65, cos: .98, harm: 'smps', vMin: 90, vMax: 285, info: 'SMPS uden PFC til 100–240 V. Over ca. 280 V bryder indgangskondensatoren sammen.'},
  {id: 'mobil', name: 'Mobiloplader', cat: 'Stue og kontor', P: 15, cos: .98, harm: 'smps', vMin: 90, vMax: 285, info: 'Lille SMPS til 100–240 V. Over ca. 280 V bryder den sammen.'},
  {id: 'router', name: 'Router / internet', cat: 'Stue og kontor', P: 12, cos: .98, harm: 'smps', vMin: 90, vMax: 280, info: 'Lille SMPS med varistor. Tåler sjældent meget over 260–280 V.'},
  {id: 'pc', name: 'Stationær computer', cat: 'Stue og kontor', P: 250, cos: .99, harm: 'pfc', vMin: 90, vMax: 285, info: 'SMPS med aktiv PFC. Strømmen er næsten sinusformet.'},
  {id: 'konsol', name: 'Spillekonsol', cat: 'Stue og kontor', P: 150, cos: .99, harm: 'pfc', vMin: 90, vMax: 285, info: 'SMPS med aktiv PFC.'},
  {id: 'hifi', name: 'Musikanlæg', cat: 'Stue og kontor', P: 60, cos: .95, harm: 'smps', vMin: 90, vMax: 280, info: 'Strømforsyning (SMPS).'},
  {id: 'led', name: 'LED-lyskilder (10 stk.)', cat: 'Belysning', P: 70, cos: .95, harm: 'led', vMin: 150, vMax: 290, info: 'LED-drivere. Strømmen har en stor 3. harmonisk.'},
  {id: 'gloede', name: 'Glødepære 60 W', cat: 'Belysning', P: 60, cos: 1, harm: 'none', vMax: 265, info: 'Glødetråd. Brænder hurtigt over ved overspænding.'},
  {id: 'halogen', name: 'Halogenspots (6 stk.)', cat: 'Belysning', P: 210, cos: 1, harm: 'none', vMax: 270, info: 'Glødetråd. Brænder hurtigt over ved overspænding.'},
  {id: 'vask', name: 'Vaskemaskine', cat: 'Bad og bryggers', P: 2000, cos: .95, harm: 'motor', vMin: 195, vMax: 290, info: 'Motor, varmelegeme og styreelektronik.'},
  {id: 'tumbler', name: 'Tørretumbler', cat: 'Bad og bryggers', P: 2500, cos: .97, harm: 'motor', vMin: 195, vMax: 290, info: 'Motor og varmelegeme.'},
  {id: 'harfoen', name: 'Hårtørrer', cat: 'Bad og bryggers', P: 1800, cos: 1, harm: 'none', vMax: 290, info: 'Varmelegeme og lille motor.'},
  {id: 'stovsuger', name: 'Støvsuger', cat: 'Bad og bryggers', P: 1200, cos: .95, harm: 'motor', vMin: 195, vMax: 280, info: 'Universalmotor.'},
  {id: 'elpanel', name: 'Elradiator', cat: 'Varme', P: 1000, cos: 1, harm: 'none', vMax: 320, info: 'Ohmsk varmelegeme.'},
  {id: 'vvb', name: 'Varmtvandsbeholder', cat: 'Varme', P: 3000, cos: 1, harm: 'none', vMax: 320, info: 'Ohmsk varmelegeme.'},
  {id: 'gulvvarme', name: 'Elgulvvarme', cat: 'Varme', P: 600, cos: 1, harm: 'none', vMax: 320, info: 'Ohmsk varmelegeme.'},
  {id: 'vvb400', name: 'Varmtvandsbeholder 400 V', cat: '400 V', U: 400, P: 3000, cos: 1, harm: 'none', vMax: 460, info: 'Varmelegeme til 400 V mellem to faser eller 3 × 400 V. Bruger ikke nul, så manglende nul rammer den ikke.'},
  {id: 'radiator400', name: 'Elradiator 400 V', cat: '400 V', U: 400, P: 2000, cos: 1, harm: 'none', vMax: 460, info: 'Varmelegeme til 400 V mellem to faser. Bruger ikke nul.'},
  {id: 'sauna', name: 'Saunaaggregat', cat: '400 V', U: 400, P: 6000, cos: 1, harm: 'none', vMax: 460, info: 'Varmelegemer til 3 × 400 V i trekant, eller 400 V mellem to faser. Bruger ikke nul.'},
  {id: 'gennem', name: 'Gennemstrømningsvandvarmer', cat: '400 V', U: 400, P: 11000, cos: 1, harm: 'none', vMax: 460, info: 'Varmelegemer til 3 × 400 V i trekant. Stor effekt, så den kræver tre faser.'},
  {id: 'komfur', name: 'Komfur (plader og ovn)', cat: '3-faset', three: true, neutral: true, perPhase: [2000, 1800, 2500], cos: 1, harm: 'none', vMax: 320, info: '3-faset med nul. Pladerne sidder mellem hver fase og nul, så de rammes af manglende nul.'},
  {id: 'induktion', name: 'Induktionskogeplade', cat: '3-faset', three: true, neutral: true, perPhase: [3700, 3700, 0], cos: .98, harm: 'induk', vMin: 180, vMax: 285, info: '2-faset med nul. Elektronik med ensretter.'},
  {id: 'varmepumpe', name: 'Varmepumpe', cat: '3-faset', three: true, neutral: false, perPhase: [1200, 1200, 1200], cos: .95, harm: 'vfd', vMin: 195, vMax: 280, info: '3-faset uden nul, så manglende nul rammer den ikke. Ved fasebrud kører den på to faser og bliver varm.'},
  {id: 'elbil', name: 'Elbillader 11 kW', cat: '3-faset', three: true, neutral: false, perPhase: [3680, 3680, 3680], cos: .99, harm: 'pfc', vMin: 195, vMax: 280, info: '3-faset uden nul, med aktiv PFC.'},
];
// Typisk lækstrøm til PE i normal drift [mA] for apparater i beskyttelsesklasse I (klasse II-apparater har ingen PE).
// Varmelegemer lækker gennem isolationen (resistivt), elektronik gennem EMC-filtrenes kondensatorer (kapacitivt).
const LEAK_MA = {koleskab: .3, fryser: .3, ovn: 1.5, mikro: .5, elkedel: .3, kaffe: .3, opvask: 1, emhaette: .2, pc: 1, led: .1,
  vask: 1.5, tumbler: 1, elpanel: .5, vvb: 1.5, gulvvarme: .5, komfur: 1.5, induktion: 1.5, varmepumpe: 3.5, elbil: 1,
  vvb400: 1.5, radiator400: .5, sauna: 1, gennem: 1};
const LEAK_RES = new Set(['ovn', 'elkedel', 'kaffe', 'opvask', 'vask', 'tumbler', 'elpanel', 'vvb', 'gulvvarme', 'komfur', 'vvb400', 'radiator400', 'sauna', 'gennem']);
// Apparater med elektronik, der kan give glat DC-fejlstrøm
const DC_CAP = new Set(['varmepumpe', 'elbil']);
// kind: LN = 230 V fase–nul, LL = 400 V mellem faser (eller 3 × 400 V), YN = flere faser med nul (komfur), 3W = 3-faset uden nul
APPL.forEach(a => {
  Object.assign(a, {leak: LEAK_MA[a.id] || 0, leakRes: LEAK_RES.has(a.id), dcCap: DC_CAP.has(a.id), U: a.U || U_NOM});
  a.kind = a.U === 400 ? 'LL' : a.three ? (a.neutral ? 'YN' : '3W') : 'LN';
});
const APPL_BY_ID = Object.fromEntries(APPL.map(a => [a.id, a]));
const defTotal = d => d.three ? d.perPhase.reduce((s, p) => s + p, 0) : d.P;

/* ---------- Tilslutning af brugsgenstande ---------- */
const toPhases = x => Array.isArray(x) ? PH.filter(p => x.includes(p)) : x === '3' ? PH.slice() : [x];
// De tilslutninger, et apparat kan få med de faser, der er til rådighed
function connOptions(def, ph) {
  if (def.kind === 'LN') return ph.slice();
  if (def.kind === 'LL') {
    const o = [];
    for (let i = 0; i < ph.length; i++) for (let j = i + 1; j < ph.length; j++) o.push(`${ph[i]}-${ph[j]}`);
    if (ph.length === 3) o.push('3D');
    return o;
  }
  if (def.kind === 'YN') {
    const o = [];
    for (let m = (1 << ph.length) - 1; m > 0; m--) o.push(ph.filter((_, i) => m & (1 << i)).join('+'));
    return o.sort((x, y) => y.length - x.length);
  }
  return ph.length === 3 ? ['3'] : [];
}
function normConn(def, conn, ph) {
  const o = connOptions(def, ph);
  if (o.includes(conn)) return conn;
  if (def.kind === 'LL' && o.includes('3D') && def.P >= 6000) return '3D';
  return o[0] || null;
}
const connLabel = c => !c ? 'kan ikke tilsluttes' : c === '3D' ? '3 × 400 V (trekant)' : c === '3' ? '3-faset uden nul'
  : c.includes('-') ? `${c.replace('-', '–')} (400 V)` : c.includes('+') ? `${c.split('+').join(', ')} og nul` : `${c}–N (230 V)`;

/* ---------- Beskyttelse ---------- */
const protOf = g => g.prot || (g.cable.type === 'Cu1.5' ? 'B13' : 'B16');
// Forenklet B/C-karakteristik: termisk udløsning over 1,13·In, magnetisk ved 5·In (B) eller 10·In (C)
function mcbTime(prot, x) {
  const k = prot[0] === 'B' ? 5 : 10;
  if (x >= k) return 0.01;
  if (x <= 1.13) return Infinity;
  return 60 / (x * x - 1);
}
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// Hver HPFI får sin egen faste udløsestrøm og -tid inden for normens grænser
function rcdParams(id, rcd) {
  const IdN = rcd === '300' ? 0.3 : 0.03, h = hash(id), thr = IdN * (19 + h % 6) / 30;
  return {IdN, thr, thrDC: thr * 1.4, t1: (17 + h % 14) / 1000, t5: (9 + h % 5) / 1000};
}
// HPFI-typer. dcLim er den glatte DC-fejlstrøm, typen tåler uden at miste følsomhed.
const RCD_TYPES = {
  AC: {name: 'Type AC', dcLim: 0.002, dc: false, info: 'Kun sinusformet vekselstrøm. Selv lidt DC kan gøre den blind.'},
  A: {name: 'Type A', dcLim: 0.006, dc: false, info: 'Vekselstrøm og pulserende DC. Tåler op til 6 mA glat DC.'},
  F: {name: 'Type F', dcLim: 0.010, dc: false, info: 'Som type A, plus blandede frekvenser. Tåler op til 10 mA glat DC.'},
  B: {name: 'Type B', dcLim: Infinity, dc: true, info: 'Alle former for fejlstrøm, også glat DC.'},
};
// Glat DC mætter kernen: over dcLim stiger udløsestrømmen, over 2·dcLim udløser HPFI'en slet ikke
function rcdSens(type, P, dc) {
  const T = RCD_TYPES[type] || RCD_TYPES.A;
  if (dc <= T.dcLim) return {thr: P.thr, status: 'ok'};
  if (dc > 2 * T.dcLim) return {thr: Infinity, status: 'blind'};
  return {thr: P.thr * (1 + 3 * (dc - T.dcLim) / T.dcLim), status: 'nedsat'};
}
// AFDD-udløsetider for serielysbuer (IEC 62606): 1 s ved 2,5 A ned til 0,12 s ved 32 A
const AFDD_T = [[2.5, 1], [5, 0.5], [10, 0.25], [16, 0.15], [32, 0.12]];
function afddTime(I) {
  if (I < 2.5) return Infinity;
  for (let i = 1; i < AFDD_T.length; i++) {
    if (I <= AFDD_T[i][0]) { const [i0, t0] = AFDD_T[i - 1], [i1, t1] = AFDD_T[i]; return t0 + (t1 - t0) * (I - i0) / (i1 - i0); }
  }
  return 0.12;
}
// Elbilladerens 6 mA DC-overvågning (RDC-DD): 10 s ved 6 mA, 0,3 s ved 60 mA, 0,1 s ved 200 mA
const rdcddTime = mA => mA < 6 ? Infinity : mA >= 200 ? 0.1 : mA >= 60 ? 0.3 : Math.pow(10, 1 - 1.523 * Math.log10(mA / 6));

/* ---------- Datamodel ---------- */
let uid = 0;
const nid = p => `${p}${++uid}`;
const cable = (type, len) => ({type, len, broken: {}});
const app = type => ({id: nid('a'), type, on: true, burned: false, P: defTotal(APPL_BY_ID[type]), dc: 0, dcTripped: false, rdcdd: type === 'elbil'});
const group = (name, phase, apps, cab, prot) => {
  const phases = toPhases(phase);
  return {id: nid('g'), name, phases, cable: cab || cable(phases.length > 1 ? 'Cu2.5' : 'Cu1.5', 15), apps: apps.map(app), prot, fault: null, tripped: false, afdd: false};
};
const tavle = {rcd: '30', rcdType: 'A', rcdTripped: false};
const house = (name, earthing, groups, cab, RA = 25) => Object.assign({id: nid('b'), kind: 'hus', name, earthing, RA, earthBroken: false, split: 'main', cable: cab || cable('Al50', 25), groups, units: []}, tavle);
// split: 'main' = PEN deles i hovedtavlen, 'local' = PEN fortsætter op i stigeledningerne med lokal nulling i lejlighederne
const etage = (name, earthing, groups, units, cab, RA = 25, split = 'main') => Object.assign({id: nid('b'), kind: 'etage', name, earthing, RA, earthBroken: false, split, cable: cab || cable('Al95', 20), groups, units}, tavle);
// feed: 'main' = egen stigeledning fra hovedtavlen, ellers id på lejligheden nedenunder på samme stigeledning
// cable.phases er stigeledningens faseledere. Lejligheden bruger phases, som kan være færre (fx 5G10 med to faser i brug).
const unit = (name, supply, groups, cab, feed = 'main') => {
  const phases = toPhases(supply), c = cab || cable(phases.length === 3 ? 'Cu16' : 'Cu10', 15);
  if (!c.phases) c.phases = phases.slice();
  return Object.assign({id: nid('u'), name, phases, feed, cable: c, groups}, tavle);
};
const ks = (name, cab, buildings) => ({id: nid('k'), name, cable: cab, buildings});

const SCENARIOS = {
  standard: {name: 'To huse og en etageejendom', make: () => [
    ks('Kabelskab 1', cable('Al150', 150), [
      house('Hus 1', 'TNCS', [
        group('Lys', 'L1', ['led', 'router', 'mobil']),
        group('Stue', 'L2', ['tv', 'laptop', 'konsol']),
        group('Køkken', 'L3', ['koleskab', 'elkedel', 'mikro']),
        group('Komfur', '3', ['komfur']),
      ]),
      house('Hus 2', 'TT', [
        group('Bryggers', 'L1', ['vask']),
        group('Stue', 'L2', ['led', 'tv', 'router']),
        group('Køkken', 'L3', ['koleskab', 'fryser']),
        group('Varmepumpe', '3', ['varmepumpe']),
      ], cable('Al25', 30), 30),
    ]),
    ks('Kabelskab 2', cable('Al95', 100), [
      etage('Etageejendom', 'TNCS', [group('Trappelys', 'L1', ['led'])], [
        unit('Lejlighed 1', '3', [
          group('Køkken', 'L1', ['elkedel', 'kaffe']),
          group('Stue', 'L2', ['router', 'laptop', 'led']),
          group('Soveværelse', 'L3', ['tv', 'mobil', 'koleskab']),
        ], cable('Cu16', 12)),
        unit('Lejlighed 2', 'L2', [group('Alle rum', 'L2', ['router', 'mobil', 'led', 'tv', 'koleskab', 'mikro'])], cable('Cu10', 18)),
      ]),
    ]),
  ]},
  tohuse: {name: 'To huse på samme kabel', make: () => [
    ks('Kabelskab 1', cable('Al150', 120), [
      house('Hus 1', 'TNCS', [
        group('Køkken', 'L1', ['elkedel', 'koleskab']),
        group('Ovn', 'L1', ['ovn'], cable('Cu2.5', 12)),
        group('Stue', 'L2', ['tv', 'router', 'led']),
        group('Kontor', 'L3', ['laptop', 'mobil', 'pc']),
      ]),
      house('Hus 2', 'TNCS', [
        group('Stue', 'L1', ['tv', 'router', 'hifi']),
        group('Vaskemaskine', 'L2', ['vask']),
        group('Tørretumbler', 'L3', ['tumbler'], cable('Cu2.5', 10)),
        group('Køkken', 'L3', ['koleskab', 'led']),
      ]),
    ]),
  ]},
  harm: {name: 'Kontor med mange SMPS', make: () => [
    ks('Kabelskab 1', cable('Al150', 100), [
      etage('Kontorhus', 'TNCS', [], [
        unit('Kontor', '3', ['L1', 'L2', 'L3'].map((L, i) => group(`Arbejdspladser ${i + 1}`, L, ['laptop', 'laptop', 'laptop', 'tv', 'led', 'led', 'router', 'mobil'])), cable('Cu16', 25)),
      ]),
    ]),
  ]},
  etage4: {name: 'Etageejendom med fire lejligheder', make: () => [
    ks('Kabelskab 1', cable('Al150', 120), [
      etage('Etageejendom', 'TNCS', [group('Trappelys', 'L2', ['led'])], [
        unit('Lejlighed 1', '3', [
          group('Køkken', 'L1', ['elkedel', 'mikro']),
          group('Stue', 'L2', ['tv', 'router']),
          group('Værelse', 'L3', ['laptop', 'led']),
        ], cable('Cu16', 8)),
        unit('Lejlighed 2', 'L1', [group('Alle rum', 'L1', ['router', 'tv', 'koleskab', 'led'])], cable('Cu10', 11)),
        unit('Lejlighed 3', 'L2', [group('Alle rum', 'L2', ['elkedel', 'koleskab', 'led'])], cable('Cu10', 14)),
        unit('Lejlighed 4', 'L3', [group('Alle rum', 'L3', ['router', 'laptop', 'mobil', 'led'])], cable('Cu10', 17)),
      ]),
    ]),
  ]},
  opgang: {name: 'Opgang med stigeledninger (2 faser)', make: () => {
    // Stuen har tre faser. Herover går to faser og nul op i to stigeledninger: L1+L3 i venstre side og L1+L2 i højre side.
    const chain = (list) => { list.forEach((u, i) => { if (i) u.feed = list[i - 1].id; }); return list; };
    const left = chain([
      unit('1. tv', ['L1', 'L3'], [group('Køkken', 'L1', ['elkedel', 'koleskab']), group('Stue', 'L3', ['tv', 'router', 'led']), group('Bad', ['L1', 'L3'], ['vvb400'], cable('Cu2.5', 10))], cable('Cu10', 9)),
      unit('2. tv', ['L1', 'L3'], [group('Køkken', 'L3', ['kaffe', 'koleskab', 'mikro']), group('Stue', 'L1', ['tv', 'laptop', 'led', 'router'])], cable('Cu10', 3)),
      unit('3. tv', ['L1', 'L3'], [group('Køkken', 'L1', ['koleskab', 'elkedel']), group('Stue', 'L3', ['tv', 'router', 'mobil'])], cable('Cu10', 3)),
      unit('4. tv', ['L1', 'L3'], [group('Køkken', 'L3', ['koleskab', 'mikro']), group('Stue', 'L1', ['tv', 'router', 'led'])], cable('Cu10', 3)),
    ]);
    const right = chain([
      unit('1. th', ['L1', 'L2'], [group('Køkken', 'L1', ['elkedel', 'koleskab']), group('Stue', 'L2', ['tv', 'router', 'led']), group('Kogeplade', ['L1', 'L2'], ['induktion'], cable('Cu2.5', 10))], cable('Cu10', 9)),
      unit('2. th', ['L1', 'L2'], [group('Køkken', 'L2', ['koleskab', 'mikro']), group('Stue', 'L1', ['tv', 'router', 'laptop', 'led'])], cable('Cu10', 3)),
      unit('3. th', ['L1', 'L2'], [group('Køkken', 'L1', ['elkedel', 'kaffe']), group('Stue', 'L2', ['router', 'tv', 'mobil']), group('Bad', ['L1', 'L2'], ['vvb400'], cable('Cu2.5', 10))], cable('Cu10', 3)),
      unit('4. th', ['L1', 'L2'], [group('Køkken', 'L1', ['koleskab', 'elkedel']), group('Stue', 'L2', ['tv', 'router', 'mobil'])], cable('Cu10', 3)),
    ]);
    return [ks('Kabelskab 1', cable('Al150', 80), [
      etage('Opgang', 'TNCS', [group('Trappelys', 'L1', ['led'])], [
        unit('St. tv', '3', [group('Køkken', 'L1', ['elkedel', 'koleskab']), group('Stue', 'L2', ['tv', 'router']), group('Værelse', 'L3', ['laptop', 'led']), group('Komfur', '3', ['komfur'])], cable('Cu16', 6)),
        unit('St. th', '3', [group('Køkken', 'L2', ['koleskab', 'mikro']), group('Stue', 'L3', ['tv', 'konsol', 'router']), group('Bad', 'L1', ['vask']), group('Sauna', '3', ['sauna'])], cable('Cu16', 6)),
        ...left, ...right,
      ], cable('Al95', 15), 25, 'local'),
    ])];
  }},
  landsby: {name: 'Område uden nulling (jordspyd)', nulling: false, make: () => [
    ks('Kabelskab 1', cable('Al95', 250), [
      house('Gården', 'TT', [group('Køkken', 'L1', ['elkedel', 'koleskab']), group('Stue', 'L2', ['tv', 'router', 'led']), group('Værksted', '3', ['sauna'], cable('Cu2.5', 25)), group('Varmepumpe', '3', ['varmepumpe'])], cable('Al50', 40), 60),
      house('Huset ved vejen', 'TT', [group('Køkken', 'L3', ['kaffe', 'koleskab', 'mikro']), group('Stue', 'L1', ['tv', 'laptop', 'led']), group('Bad', ['L1', 'L2'], ['vvb400'], cable('Cu2.5', 10))], cable('Al25', 30), 120),
    ]),
  ]},
  hus: {name: 'Ét hus', make: () => [
    ks('Kabelskab 1', cable('Al150', 80), [
      house('Hus 1', 'TNCS', [
        group('Lys', 'L1', ['led', 'gloede']),
        group('Stue', 'L2', ['tv', 'router', 'konsol']),
        group('Køkken', 'L3', ['koleskab', 'mikro', 'kaffe']),
        group('Komfur', '3', ['komfur']),
      ]),
    ]),
  ]},
};

/* ---------- Komplekse tal ---------- */
const cabs = c => Math.hypot(c.re, c.im);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return {re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d}; };

/* ---------- Kredsløb ---------- */
// Lejlighederne i en rækkefølge, hvor den forsynende lejlighed altid kommer før dem, den forsyner
function unitOrder(units) {
  const done = new Set(), out = [], rest = units.slice();
  while (rest.length) {
    let i = rest.findIndex(u => u.feed === 'main' || done.has(u.feed) || !units.some(v => v.id === u.feed));
    if (i < 0) i = 0;
    const u = rest.splice(i, 1)[0];
    out.push(u); done.add(u.id);
  }
  return out;
}
function build(feeders, nulling = true) {
  const nodes = [], br = [], inj = [], elems = [], prot = [], rcds = [];
  const boards = {}, cables = {}, appEl = {}, earth = {}, used = {};
  const node = l => { nodes.push(l); return nodes.length - 1; };
  const addZ = (a, b, R, X, meta) => { br.push(Object.assign({a, b, R, X}, meta)); return br.length - 1; };
  const zOf = cab => { const s = CABLES[cab.type]; return [s.R * cab.len / 1000, s.X * cab.len / 1000]; };

  // off: afbryderen er udløst, så alle strømførende ledere er åbne. extra: ekstra modstand i en leder (løs forbindelse).
  function connect(P, C, cab, conds, owner, role, off, extra) {
    const [R, X] = zOf(cab);
    const c = cables[owner] = {conds, br: {}, role, R, X, off: !!off};
    for (const k of conds) {
      if (!off && !cab.broken[k] && P[k] !== undefined && C[k] !== undefined) c.br[k] = addZ(P[k], C[k], R + (extra && extra[k] || 0) + jointR(cab, k), X, {kind: 'cable', owner, cond: k});
    }
  }
  // Dårlig samling: en overgangsmodstand i én leder
  function jointR(cab, k) { return cab.joint && cab.joint.cond === k ? cab.joint.R : 0; }
  function addApp(G, a) {
    const def = APPL_BY_ID[a.type];
    const active = a.on && !a.burned && !a.dcTripped;
    const list = appEl[a.id] = [];
    const scale = a.P / defTotal(def);
    const mk = (na, nb, P, lbl, Un, star) => {
      const Q = P * Math.tan(Math.acos(def.cos)), s2 = P * P + Q * Q;
      const e = {a: na, b: nb, R: Un * Un * P / s2, X: Un * Un * Q / s2, P, k: PH.indexOf(lbl.slice(0, 2)), lbl, Un, def, app: a, active, star,
        nonlinear: Object.keys(HP[def.harm].h).length > 0, inj: {}};
      list.push(e); elems.push(e);
      // Lækstrøm fra fasen til PE: en modstand (varmelegemer) eller en lille kapacitet (EMC-filtre)
      if (active && def.leak && G.PE !== undefined) {
        const I = def.leak / 1000 * P / a.P;
        e.leak = def.leakRes ? addZ(na, G.PE, U_NOM / I, 0, {kind: 'leak', app: a.id})
          : addZ(na, G.PE, 0, -U_NOM / I, {kind: 'leak', cap: true, app: a.id});
      }
    };
    const conn = normConn(def, a.conn, PH.filter(p => G[p] !== undefined));
    if (!conn) return;
    if (def.kind === 'LN') mk(G[conn], G.N, a.P, conn, U_NOM, false);
    else if (def.kind === 'LL') {
      const pairs = conn === '3D' ? [['L1', 'L2'], ['L2', 'L3'], ['L3', 'L1']] : [conn.split('-')];
      for (const [p, q] of pairs) mk(G[p], G[q], a.P / pairs.length, `${p}–${q}`, 400, false);
    } else if (def.kind === 'YN') {
      // Elementerne fordeles på de valgte faser: element nr. i kommer på fase nr. i mod antallet af faser
      const ch = conn.split('+');
      def.perPhase.forEach((P, i) => { if (P > 0) mk(G[ch[i % ch.length]], G.N, P * scale, ch[i % ch.length], U_NOM, false); });
    } else {
      const star = node(a.id + '.Y');
      def.perPhase.forEach((P, i) => { if (P > 0) mk(G[PH[i]], star, P * scale, PH[i], U_NOM, true); });
    }
  }
  function addGroups(Tv, groups, owner, allowed = PH) {
    for (const g of groups) {
      const phases = g.phases.filter(p => Tv[p] !== undefined && allowed.includes(p));
      const G = {N: node(g.id + '.N')};
      for (const p of phases) G[p] = node(g.id + '.' + p);
      const arc = g.fault && g.fault.pair.startsWith('ARC') ? g.fault.pair : null;
      connect(Tv, G, g.cable, [...phases, 'N'], g.id, 'group', g.tripped || owner.rcdTripped, arc === 'ARC-S' ? {[phases[0]]: R_ARC_S} : null);
      if (arc === 'ARC-P' && phases.length) addZ(G[phases[0]], G.N, R_ARC_P, 0, {kind: 'arc', owner: g.id});
      if (Tv.PE !== undefined) {
        const [R, X] = zOf(g.cable);
        G.PE = node(g.id + '.PE');
        if (!g.cable.broken.PE) cables[g.id].pe = addZ(Tv.PE, G.PE, R + jointR(g.cable, 'PE'), X, {kind: 'pe', owner: g.id});
      }
      // Isolationsfejl i gruppen (L er gruppens første fase)
      if (g.fault && G.PE !== undefined) {
        const L = phases.length ? G[phases[0]] : undefined, ends = {'L-PE': [L, G.PE], 'N-PE': [G.N, G.PE], 'L-N': [L, G.N]}[g.fault.pair];
        if (ends && ends[0] !== undefined) addZ(ends[0], ends[1], g.fault.R, 0, {kind: 'ins', owner: g.id});
      }
      boards[g.id] = G;
      prot.push({g, owner});
      for (const a of g.apps) addApp(G, a);
    }
    rcds.push({owner, groups});
  }

  // Transformer: Norton-ækvivalent pr. fase mellem fasen og stjernepunktet
  const T = {N: node('T.N')};
  for (let k = 0; k < 3; k++) {
    const L = 'L' + (k + 1);
    T[L] = node('T.' + L);
    addZ(T[L], T.N, ZT.R, ZT.X, {kind: 'src'});
    const I = cdiv({re: E_SRC * Math.cos(-2 * Math.PI * k / 3), im: E_SRC * Math.sin(-2 * Math.PI * k / 3)}, {re: ZT.R, im: ZT.X});
    inj.push({n: T[L], re: I.re, im: I.im}, {n: T.N, re: -I.re, im: -I.im});
  }
  earth.trafo = addZ(T.N, -1, RB, 0, {kind: 'earth'});
  boards.trafo = T;

  let prev = T;
  for (const f of feeders) {
    const K = {N: node(f.id + '.N')};
    for (const L of ['L1', 'L2', 'L3']) K[L] = node(f.id + '.' + L);
    connect(prev, K, f.cable, ['L1', 'L2', 'L3', 'N'], f.id, 'feeder');
    boards[f.id] = K;
    for (const b of f.buildings) {
      const B = {N: node(b.id + '.N'), PE: node(b.id + '.PE')};
      for (const L of ['L1', 'L2', 'L3']) B[L] = node(b.id + '.' + L);
      connect(K, B, b.cable, ['L1', 'L2', 'L3', 'N'], b.id, 'stik');
      // Nulling (TN) kræver, at transformerkredsen er udlagt til det. Ellers er alle installationer TT med jordspyd.
      const tn = nulling && b.earthing === 'TNCS', local = tn && b.split === 'local';
      if (tn) addZ(B.N, B.PE, BOND, 0, {kind: 'bond'});
      if (!b.earthBroken) earth[b.id] = addZ(B.PE, -1, b.RA, 0, {kind: 'earth'});
      boards[b.id] = B;
      addGroups(B, b.groups, b);
      for (const u of unitOrder(b.units)) {
        // Forsynes fra hovedtavlen eller fra lejligheden nedenunder på samme stigeledning
        const Pn = u.feed !== 'main' && boards[u.feed] ? boards[u.feed] : B;
        // Stigeledningens faser føres videre op, også dem lejligheden ikke selv bruger
        const rp = PH.filter(p => (u.cable.phases || u.phases).includes(p) || u.phases.includes(p));
        const U = {N: node(u.id + '.N'), PE: node(u.id + '.PE')};
        for (const L of rp) U[L] = node(u.id + '.' + L);
        connect(Pn, U, u.cable, [...rp, 'N'], u.id, 'stige');
        if (local) addZ(U.N, U.PE, BOND, 0, {kind: 'bond'});      // lokal nulling: PE forbindes til PEN i lejligheden
        else {
          const [R, X] = zOf(u.cable);
          if (!u.cable.broken.PE) cables[u.id].pe = addZ(Pn.PE, U.PE, R + jointR(u.cable, 'PE'), X, {kind: 'pe', owner: u.id});
        }
        boards[u.id] = U;
        used[u.id] = u.phases;
        addGroups(U, u.groups, u, u.phases);
      }
    }
    prev = K;
  }
  return {nodes, br, inj, elems, boards, cables, appEl, earth, prot, rcds, used};
}

/* Kompleks Gauss-elimination med delvis pivotering. A er n×n (række for række), b er højresiden. */
function gauss(n, Ar, Ai, br, bi) {
  for (let c = 0; c < n; c++) {
    let p = c, best = 0;
    for (let r = c; r < n; r++) { const m = Ar[r * n + c] ** 2 + Ai[r * n + c] ** 2; if (m > best) { best = m; p = r; } }
    if (best === 0) continue;
    if (p !== c) {
      for (let j = c; j < n; j++) {
        let t = Ar[c * n + j]; Ar[c * n + j] = Ar[p * n + j]; Ar[p * n + j] = t;
        t = Ai[c * n + j]; Ai[c * n + j] = Ai[p * n + j]; Ai[p * n + j] = t;
      }
      let t = br[c]; br[c] = br[p]; br[p] = t;
      t = bi[c]; bi[c] = bi[p]; bi[p] = t;
    }
    const pr = Ar[c * n + c], pi = Ai[c * n + c], pd = pr * pr + pi * pi, ir = pr / pd, ii = -pi / pd;
    for (let r = c + 1; r < n; r++) {
      const ar = Ar[r * n + c], ai = Ai[r * n + c];
      if (ar === 0 && ai === 0) continue;
      const fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for (let j = c; j < n; j++) {
        const cr = Ar[c * n + j], ci = Ai[c * n + j];
        if (cr === 0 && ci === 0) continue;
        Ar[r * n + j] -= fr * cr - fi * ci;
        Ai[r * n + j] -= fr * ci + fi * cr;
      }
      br[r] -= fr * br[c] - fi * bi[c];
      bi[r] -= fr * bi[c] + fi * br[c];
    }
  }
  const xr = new Float64Array(n), xi = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r], si = bi[r];
    for (let j = r + 1; j < n; j++) {
      const ar = Ar[r * n + j], ai = Ai[r * n + j];
      if (ar === 0 && ai === 0) continue;
      sr -= ar * xr[j] - ai * xi[j];
      si -= ar * xi[j] + ai * xr[j];
    }
    const pr = Ar[r * n + r], pi = Ai[r * n + r], pd = pr * pr + pi * pi;
    if (pd === 0) continue;
    xr[r] = (sr * pr + si * pi) / pd;
    xi[r] = (si * pr - sr * pi) / pd;
  }
  return {re: xr, im: xi};
}

/* ---------- Kortslutningsstrømme (forenklet efter IEC 60909) ----------
   Nettet uden belastning. Ik,max: c = 1,10 og ledere ved 20 °C. Ik,min: c = 0,95 og ledere ved 80 °C (R × 1,24). */
const C_MAX = 1.10, C_MIN = 0.95, R80 = 1 + 0.004 * 60;
// Gauss-elimination med mange højresider på én gang (samme net, mange målepunkter)
function gaussMulti(n, Ar, Ai, m, Br, Bi) {
  for (let c = 0; c < n; c++) {
    let p = c, best = 0;
    for (let r = c; r < n; r++) { const v = Ar[r * n + c] ** 2 + Ai[r * n + c] ** 2; if (v > best) { best = v; p = r; } }
    if (best === 0) continue;
    if (p !== c) {
      for (let j = c; j < n; j++) { let t = Ar[c * n + j]; Ar[c * n + j] = Ar[p * n + j]; Ar[p * n + j] = t; t = Ai[c * n + j]; Ai[c * n + j] = Ai[p * n + j]; Ai[p * n + j] = t; }
      for (let j = 0; j < m; j++) { let t = Br[c * m + j]; Br[c * m + j] = Br[p * m + j]; Br[p * m + j] = t; t = Bi[c * m + j]; Bi[c * m + j] = Bi[p * m + j]; Bi[p * m + j] = t; }
    }
    const pr = Ar[c * n + c], pi = Ai[c * n + c], pd = pr * pr + pi * pi, ir = pr / pd, ii = -pi / pd;
    for (let r = c + 1; r < n; r++) {
      const ar = Ar[r * n + c], ai = Ai[r * n + c];
      if (ar === 0 && ai === 0) continue;
      const fr = ar * ir - ai * ii, fi = ar * ii + ai * ir;
      for (let j = c; j < n; j++) {
        const cr = Ar[c * n + j], ci = Ai[c * n + j];
        if (cr === 0 && ci === 0) continue;
        Ar[r * n + j] -= fr * cr - fi * ci; Ai[r * n + j] -= fr * ci + fi * cr;
      }
      for (let j = 0; j < m; j++) {
        const cr = Br[c * m + j], ci = Bi[c * m + j];
        if (cr === 0 && ci === 0) continue;
        Br[r * m + j] -= fr * cr - fi * ci; Bi[r * m + j] -= fr * ci + fi * cr;
      }
    }
  }
  const Xr = new Float64Array(n * m), Xi = new Float64Array(n * m);
  for (let j = 0; j < m; j++) {
    for (let r = n - 1; r >= 0; r--) {
      let sr = Br[r * m + j], si = Bi[r * m + j];
      for (let k = r + 1; k < n; k++) {
        const ar = Ar[r * n + k], ai = Ai[r * n + k];
        if (ar === 0 && ai === 0) continue;
        sr -= ar * Xr[k * m + j] - ai * Xi[k * m + j]; si -= ar * Xi[k * m + j] + ai * Xr[k * m + j];
      }
      const pr = Ar[r * n + r], pi = Ai[r * n + r], pd = pr * pr + pi * pi;
      if (pd) { Xr[r * m + j] = (sr * pr + si * pi) / pd; Xi[r * m + j] = (si * pr - sr * pi) / pd; }
    }
  }
  return {Xr, Xi};
}
// Impedanser mellem knudepar i nettet uden belastning. rf skalerer ledermodstanden (temperatur).
function netZ(ckt, rf, pairs) {
  const n = ckt.nodes.length, m = pairs.length;
  if (!m) return [];
  const Ar = new Float64Array(n * n), Ai = new Float64Array(n * n);
  const stamp = (a, b, R, X) => {
    const d = R * R + X * X, yr = R / d, yi = -X / d;
    if (a >= 0) { Ar[a * n + a] += yr; Ai[a * n + a] += yi; }
    if (b >= 0) { Ar[b * n + b] += yr; Ai[b * n + b] += yi; }
    if (a >= 0 && b >= 0) { Ar[a * n + b] -= yr; Ai[a * n + b] -= yi; Ar[b * n + a] -= yr; Ai[b * n + a] -= yi; }
  };
  for (const b of ckt.br) {
    if (b.kind === 'leak' || b.kind === 'ins' || b.kind === 'arc' || b.kind === 'fault') continue;
    stamp(b.a, b.b, b.kind === 'cable' || b.kind === 'pe' ? b.R * rf : b.R, b.X);
  }
  for (let i = 0; i < n; i++) Ar[i * n + i] += LEAK;
  const Br = new Float64Array(n * m), Bi = new Float64Array(n * m);
  pairs.forEach(([a, b], j) => { if (a >= 0) Br[a * m + j] += 1; if (b >= 0) Br[b * m + j] -= 1; });
  const {Xr, Xi} = gaussMulti(n, Ar, Ai, m, Br, Bi);
  const at = (i, j) => i < 0 ? {re: 0, im: 0} : {re: Xr[i * m + j], im: Xi[i * m + j]};
  return pairs.map(([a, b], j) => { const p = at(a, j), q = at(b, j); return {re: p.re - q.re, im: p.im - q.im}; });
}
// Ik for alle tavler og gruppeudtag på én gang
function shortCircuit(ckt) {
  const T = ckt.boards.trafo, pts = [], p20 = [], p80 = [];
  for (const [id, B] of Object.entries(ckt.boards)) {
    const ph = (ckt.used[id] || PH).filter(L => B[L] !== undefined), p = {id, B, ph, i3: [], n20: [], n80: [], e80: []};
    for (const L of ph) {
      p.i3.push(p20.push([B[L], T.N]) - 1);
      p.n20.push(p20.push([B[L], B.N]) - 1);
      p.n80.push(p80.push([B[L], B.N]) - 1);
      if (B.PE !== undefined) p.e80.push(p80.push([B[L], B.PE]) - 1);
    }
    pts.push(p);
  }
  const Z20 = netZ(ckt, 1, p20), Z80 = netZ(ckt, R80, p80), out = {};
  const mx = (Z, idx) => idx.length ? Math.max(...idx.map(i => cabs(Z[i]))) : null;
  const mn = (Z, idx) => idx.length ? Math.min(...idx.map(i => cabs(Z[i]))) : null;
  for (const p of pts) {
    if (!p.ph.length) continue;
    const z3 = mn(Z20, p.i3), zn20 = mn(Z20, p.n20), zn = mx(Z80, p.n80), ze = mx(Z80, p.e80);
    out[p.id] = {
      ik3max: p.ph.length === 3 ? C_MAX * 400 / Math.sqrt(3) / z3 : null,   // 3-faset, til brydeevne
      ik1max: C_MAX * U_NOM / zn20,                                         // 1-faset L–N, største
      ik1n: C_MIN * U_NOM / zn,                                             // Ik,min L–N
      ik1pe: ze ? C_MIN * U_NOM / ze : null,                                // Ik,min L–PE (jordfejl)
      zn20, zn, ze, z3,
    };
  }
  return out;
}

// Reaktans ved h. harmoniske: induktiv vokser med frekvensen, kapacitiv (lækstrøm) falder
const bx = (b, h) => b.cap ? b.X / h : b.X * h;
function solve(ckt, h, inj) {
  const n = ckt.nodes.length;
  const Ar = new Float64Array(n * n), Ai = new Float64Array(n * n), br = new Float64Array(n), bi = new Float64Array(n);
  const stamp = (a, b, R, X) => {
    const d = R * R + X * X, yr = R / d, yi = -X / d;
    if (a >= 0) { Ar[a * n + a] += yr; Ai[a * n + a] += yi; }
    if (b >= 0) { Ar[b * n + b] += yr; Ai[b * n + b] += yi; }
    if (a >= 0 && b >= 0) { Ar[a * n + b] -= yr; Ai[a * n + b] -= yi; Ar[b * n + a] -= yr; Ai[b * n + a] -= yi; }
  };
  for (const b of ckt.br) stamp(b.a, b.b, b.R, bx(b, h));
  // Alle apparater har deres impedans ved alle frekvenser (Norton-model), så en flydende nul ikke giver urealistiske spændinger
  for (const e of ckt.elems) if (e.active) stamp(e.a, e.b, e.R, h * e.X);
  for (let i = 0; i < n; i++) Ar[i * n + i] += LEAK;
  for (const s of inj) { br[s.n] += s.re; bi[s.n] += s.im; }
  return gauss(n, Ar, Ai, br, bi);
}

function vdiff(V, a, b) {
  const re = (a >= 0 ? V.re[a] : 0) - (b >= 0 ? V.re[b] : 0);
  const im = (a >= 0 ? V.im[a] : 0) - (b >= 0 ? V.im[b] : 0);
  return {re, im};
}

const brCur = (ckt, V, bi) => { const b = ckt.br[bi]; return cdiv(vdiff(V, b.a, b.b), {re: b.R, im: b.X}); };
const maxPhaseI = (ckt, V, c) => Math.max(0, ...['L1', 'L2', 'L3'].filter(k => c.br[k] !== undefined).map(k => cabs(brCur(ckt, V, c.br[k]))));
// Fejlstrøm, som en HPFI over grupperne ser: vektorsummen af fase- og nulstrømmene (AC) plus glat DC fra apparaterne
function residualOf(ckt, V, groups) {
  let re = 0, im = 0, dc = 0;
  for (const g of groups) {
    const c = ckt.cables[g.id];
    for (const k of ['L1', 'L2', 'L3', 'N']) if (c.br[k] !== undefined) { const I = brCur(ckt, V, c.br[k]); re += I.re; im += I.im; }
    if (!c.off && c.pe !== undefined) for (const a of g.apps) if (a.on && !a.burned && !a.dcTripped && a.dc) dc += a.dc / 1000;
  }
  return {ac: Math.hypot(re, im), dc};
}

/* Beregn hele nettet. Efter hver beregning findes det, der sker hurtigst: en gruppeafbryder udløser, en HPFI
   udløser, eller det værst ramte apparat brænder af. Det udføres, og nettet regnes igen (kaskade). */
function compute(feeders, opts) {
  const events = [];
  let ckt, V1, now = 0;
  for (let it = 0; it < 400; it++) {
    ckt = build(feeders, opts.nulling !== false);
    V1 = solve(ckt, 1, ckt.inj);
    const cand = [];
    if (opts.burn) {
      let worst = null;
      for (const e of ckt.elems) {
        if (!e.active) continue;
        const v = cabs(vdiff(V1, e.a, e.b)), r = v / e.def.vMax;
        if (r >= 1 && (!worst || r > worst.r)) worst = {e, v, r};
      }
      if (worst) cand.push({type: 'burn', t: BURN_T, app: worst.e.app, v: worst.v, k: worst.e.k, lbl: worst.e.lbl});
    }
    if (opts.prot) {
      for (const p of ckt.prot) {
        const c = ckt.cables[p.g.id];
        if (c.off) continue;
        const I = maxPhaseI(ckt, V1, c), pr = protOf(p.g), t = mcbTime(pr, I / +pr.slice(1));
        if (isFinite(t)) cand.push({type: 'mcb', t, g: p.g, owner: p.owner, I, prot: pr});
        // AFDD: ser lysbuer, som hverken gruppeafbryder eller HPFI reagerer på
        const arc = p.g.fault && p.g.fault.pair.startsWith('ARC') && p.g.fault.pair;
        if (arc && p.g.afdd) {
          const ta = arc === 'ARC-P' ? (I >= 2.5 ? 0.12 : Infinity) : afddTime(I);
          if (isFinite(ta)) cand.push({type: 'afdd', t: ta, g: p.g, owner: p.owner, I, kind: arc});
        }
        // Elbilladerens egen DC-overvågning
        for (const a of p.g.apps) {
          if (!a.rdcdd || !a.dc || !a.on || a.burned || a.dcTripped || c.pe === undefined) continue;
          const td = rdcddTime(a.dc);
          if (isFinite(td)) cand.push({type: 'rdcdd', t: td, app: a, g: p.g, owner: p.owner, I: a.dc / 1000});
        }
      }
      for (const r of ckt.rcds) {
        if (r.owner.rcd === 'none' || r.owner.rcdTripped) continue;
        const res = residualOf(ckt, V1, r.groups), P = rcdParams(r.owner.name, r.owner.rcd), T = RCD_TYPES[r.owner.rcdType] || RCD_TYPES.A;
        if (T.dc && res.dc >= P.thrDC) { cand.push({type: 'rcd', t: P.t1, owner: r.owner, I: res.dc, dc: true}); continue; }
        const s = rcdSens(r.owner.rcdType, P, res.dc);
        if (res.ac >= s.thr) cand.push({type: 'rcd', t: res.ac >= 5 * P.IdN ? P.t5 : P.t1, owner: r.owner, I: res.ac});
      }
    }
    if (!cand.length) break;
    const ev = cand.reduce((a, b) => b.t < a.t ? b : a);
    if (ev.type === 'burn') Object.assign(ev.app, {burned: true, burnV: ev.v, burnK: ev.k, burnLbl: ev.lbl});
    else if (ev.type === 'mcb' || ev.type === 'afdd') ev.g.tripped = true;
    else if (ev.type === 'rdcdd') ev.app.dcTripped = true;
    else ev.owner.rcdTripped = true;
    now += ev.t;
    ev.at = now;
    events.push(ev);
  }
  const V = {1: V1};
  for (const e of ckt.elems) {
    if (!e.active) continue;
    e.V1 = vdiff(V1, e.a, e.b);
    e.I1 = cdiv(e.V1, {re: e.R, im: e.X});
  }
  for (const h of HARM) {
    if (h === 1) continue;
    const inj = [];
    for (const e of ckt.elems) {
      const k = e.active && HP[e.def.harm].h[h];
      if (!k) continue;
      const ang = h * Math.atan2(e.V1.im, e.V1.re) + (RECT.has(e.def.harm) && h % 4 === 3 ? Math.PI : 0);
      const mag = cabs(e.I1) * k, I = {re: mag * Math.cos(ang), im: mag * Math.sin(ang)};
      e.inj[h] = I;
      inj.push({n: e.a, re: -I.re, im: -I.im}, {n: e.b, re: I.re, im: I.im});
    }
    V[h] = inj.length ? solve(ckt, h, inj) : null;
  }
  return result(ckt, V, events);
}

function result(ckt, V, events) {
  const zero = {re: 0, im: 0};
  let ikCache = null;
  const vab = (a, b, h) => V[h] ? vdiff(V[h], a, b) : zero;
  const brI = (bi, h) => { const b = ckt.br[bi]; return cdiv(vab(b.a, b.b, h), {re: b.R, im: bx(b, h)}); };
  const elI = (e, h) => {
    if (!e.active) return zero;
    const I = cdiv(vab(e.a, e.b, h), {re: e.R, im: h * e.X});
    const s = e.inj[h];
    return s ? {re: I.re + s.re, im: I.im + s.im} : I;
  };
  const ser = f => HARM.map(h => Object.assign({h}, f(h)));
  return {
    ckt, events,
    residual: groups => residualOf(ckt, V[1], groups),
    // Kortslutningsstrømme for alle punkter; regnes første gang de bruges
    ik: () => ikCache || (ikCache = shortCircuit(ckt)),
    // Impedansen L–N uden belastning ved 20 °C og den simulerede kortslutningsstrøm med den aktuelle belastning
    ikLoadCompare: (a, b) => {
      const z = netZ(ckt, 1, [[a, b]])[0];
      ckt.br.push({a, b, R: 1e-4, X: 0, kind: 'fault'});
      const S = solve(ckt, 1, ckt.inj);
      ckt.br.pop();
      return {noLoad: E_SRC / cabs(z), withLoad: cabs(cdiv(vdiff(S, a, b), {re: 1e-4, im: 0}))};
    },
    // Indre impedans mellem to knuder (som et installationsinstrument måler den): 1 A ind i a og ud af b, kilderne kortsluttet
    zIn: (a, b) => {
      const S = solve(ckt, 1, [{n: a, re: 1, im: 0}, {n: b, re: -1, im: 0}].filter(s => s.n >= 0));
      return vdiff(S, a, b);
    },
    // Fejl med modstanden Rf mellem a og b, fx fase mod PE. Giver fejlstrøm og potentialer i hele nettet.
    fault: (a, b, Rf) => {
      ckt.br.push({a, b, R: Rf, X: 0, kind: 'fault'});
      const S = solve(ckt, 1, ckt.inj);
      ckt.br.pop();
      return {I: cdiv(vdiff(S, a, b), {re: Rf, im: 0}), v: (x, y) => vdiff(S, x, y)};
    },
    vSeries: (a, b) => ser(h => vab(a, b, h)),
    brSeries: bi => ser(h => brI(bi, h)),
    elVSeries: e => ser(h => vab(e.a, e.b, h)),
    elISeries: e => ser(h => elI(e, h)),
  };
}

/* ---------- Måleværdier ud fra en serie {h, re, im} med RMS-visere ---------- */
const rms = s => Math.sqrt(s.reduce((a, x) => a + x.re * x.re + x.im * x.im, 0));
const h1 = s => cabs(s[0]);
const hn = (s, h) => { const x = s.find(y => y.h === h); return x ? cabs(x) : 0; };
const thd = s => { const f = h1(s); return f < 1e-9 ? 0 : Math.sqrt(s.slice(1).reduce((a, x) => a + x.re * x.re + x.im * x.im, 0)) / f; };
const wave = (s, deg) => { const t = deg * Math.PI / 180; return s.reduce((a, x) => a + SQ2 * (x.re * Math.sin(x.h * t) + x.im * Math.cos(x.h * t)), 0); };
const sumSeries = list => HARM.map((h, i) => ({h, re: list.reduce((a, s) => a + s[i].re, 0), im: list.reduce((a, s) => a + s[i].im, 0)}));

window.Inst = {
  HARM, U_NOM, E_SRC, ZT, RB, R_HEALTHY, CABLES, ROLE_CABLES, HP, APPL, APPL_BY_ID, SCENARIOS, defTotal,
  protOf, mcbTime, rcdParams, RCD_TYPES, rcdSens, afddTime, rdcddTime, R_ARC_S, R_ARC_P,
  PH, toPhases, connOptions, normConn, connLabel, unitOrder, C_MAX, C_MIN, R80,
  nid, cable, app, group, house, etage, unit, ks, compute,
  rms, h1, hn, thd, wave, sumSeries, cabs,
};
})();
