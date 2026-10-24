/* Vejledning: dokumentation af værktøjet, teorien, målingerne og modellen. Tabeller genereres fra modellens data. */
(function () {
'use strict';
const M = window.Inst, U = window.InstUI, app = window.InstApp;
const {fmt, fmtS, esc} = U;
const $ = s => document.querySelector(s);

/* ---------- Skitser af jordingssystemerne ---------- */
function earthSym(x, y, label) {
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 18}" stroke="var(--pe-g)" stroke-width="2"/>
    <line x1="${x - 12}" y1="${y + 18}" x2="${x + 12}" y2="${y + 18}" stroke="var(--muted)" stroke-width="2"/>
    <line x1="${x - 8}" y1="${y + 23}" x2="${x + 8}" y2="${y + 23}" stroke="var(--muted)" stroke-width="2"/>
    <line x1="${x - 4}" y1="${y + 28}" x2="${x + 4}" y2="${y + 28}" stroke="var(--muted)" stroke-width="2"/>
    <rect x="${x - 6}" y="${y - 22}" width="12" height="20" fill="var(--panel)" stroke="var(--ink)"/>
    <text x="${x + 12}" y="${y - 8}" class="dg-t">${label}</text>`;
}
const pe = (d) => `<path d="${d}" fill="none" stroke="var(--pe-g)" stroke-width="3"/><path d="${d}" fill="none" stroke="var(--pe-y)" stroke-width="3" stroke-dasharray="7 7"/>`;
function systemSVG(kind) {
  const tn = kind === 'TNCS';
  let s = `<svg viewBox="0 0 620 270" class="dg" role="img" aria-label="Skitse af ${tn ? 'TN-C-S' : 'TT'}-systemet med fejlstrømmens vej">`;
  s += `<rect x="20" y="28" width="96" height="120" rx="8" fill="var(--panel-2)" stroke="var(--ink)"/><text x="68" y="20" text-anchor="middle" class="dg-h">Transformer</text>`;
  s += `<rect x="370" y="28" width="96" height="140" rx="8" fill="var(--panel-2)" stroke="var(--ink)"/><text x="418" y="20" text-anchor="middle" class="dg-h">Hovedtavle</text>`;
  s += `<rect x="520" y="44" width="82" height="80" rx="8" fill="var(--panel-2)" stroke="var(--ink)"/><text x="561" y="36" text-anchor="middle" class="dg-h">Apparat</text><text x="561" y="114" text-anchor="middle" class="dg-t">kabinet på PE</text>`;
  [['L1', 52, 'var(--l1)'], ['L2', 72, 'var(--l2)'], ['L3', 92, 'var(--l3)']].forEach(([n, y, c]) => {
    s += `<line x1="116" y1="${y}" x2="370" y2="${y}" stroke="${c}" stroke-width="3"/><text x="124" y="${y - 4}" class="dg-t">${n}</text>`;
  });
  // fjerde leder: PEN eller N
  if (tn) s += `<line x1="116" y1="118" x2="370" y2="118" stroke="var(--n)" stroke-width="3"/><line x1="116" y1="118" x2="370" y2="118" stroke="var(--pe-g)" stroke-width="3" stroke-dasharray="4 14"/><text x="124" y="112" class="dg-t">PEN</text>`;
  else s += `<line x1="116" y1="118" x2="370" y2="118" stroke="var(--n)" stroke-width="3"/><text x="124" y="112" class="dg-t">N</text>`;
  s += `<circle cx="68" cy="118" r="4" fill="var(--ink)"/><line x1="68" y1="118" x2="116" y2="118" stroke="var(--n)" stroke-width="3"/><text x="40" y="112" class="dg-t">stjernepunkt</text>`;
  s += pe('M68 118 V176') + earthSym(68, 196, 'R<tspan baseline-shift="sub" font-size="9">B</tspan>');
  // i hovedtavlen
  s += `<line x1="370" y1="52" x2="520" y2="52" stroke="var(--l1)" stroke-width="3"/>`;
  s += `<path d="M370 118 H400 V88 H520" fill="none" stroke="var(--n)" stroke-width="3"/><text x="476" y="83" class="dg-t">N</text>`;
  s += pe('M418 150 H561 V124') + `<text x="476" y="164" class="dg-t">PE</text>`;
  s += `<circle cx="418" cy="150" r="4" fill="var(--pe-g)"/><text x="412" y="186" text-anchor="end" class="dg-t">hovedjordklemme</text>`;
  if (tn) s += pe('M400 118 V150 H418') + `<circle cx="400" cy="118" r="4" fill="var(--ink)"/><text x="408" y="111" class="dg-t">PEN deles</text>`;
  s += pe('M418 150 V196') + earthSym(418, 216, 'R<tspan baseline-shift="sub" font-size="9">E</tspan>');
  // fejl og fejlstrømmens vej
  s += `<path d="M540 52 L548 64 L540 70 L552 84" fill="none" stroke="var(--bad)" stroke-width="2.5"/><text x="556" y="76" class="dg-t bad">fejl</text>`;
  const path = tn ? 'M561 124 V145 H404 V123 H120' : 'M561 124 V145 H430 V250 H74 V206';
  s += `<path d="${path}" fill="none" stroke="var(--bad)" stroke-width="2" stroke-dasharray="6 4" opacity=".9"/>`;
  if (!tn) s += `<text x="245" y="244" text-anchor="middle" class="dg-t bad">fejlstrømmen løber gennem jorden</text>`;
  else s += `<text x="245" y="134" text-anchor="middle" class="dg-t bad">fejlstrømmen løber tilbage i PEN</text>`;
  return s + '</svg>';
}

/* ---------- Tabeller fra modellen ---------- */
const mm = v => String(v).replace('.', ',');
function cableTable() {
  const roles = {feeder: 'fordelingskabel', stik: 'stikledning', stige: 'stigeledning', group: 'gruppeledning'};
  const use = t => Object.entries(M.ROLE_CABLES).filter(([, l]) => l.includes(t)).map(([r]) => roles[r]).join(', ');
  return `<div class="doc-tw"><table class="doc-t"><thead><tr><th>Leder</th><th>R [Ω/km]</th><th>X [Ω/km]</th><th>Bruges som</th></tr></thead><tbody>${
    Object.entries(M.CABLES).map(([t, c]) => `<tr><td>${mm(c.mm2)} mm² ${c.mat}</td><td class="num">${fmt(c.R, 3)}</td><td class="num">${fmt(c.X, 3)}</td><td>${use(t)}</td></tr>`).join('')}</tbody></table></div>`;
}
function applTable() {
  return `<div class="doc-tw"><table class="doc-t"><thead><tr><th>Brugsgenstand</th><th>Effekt</th><th>cos φ</th><th>Tilslutning</th><th>Harmoniske</th><th>Tålegrænse</th><th>Underspænding</th><th>Lækstrøm</th><th>Glat DC</th></tr></thead><tbody>${
    M.APPL.map(a => `<tr><td>${esc(a.name)}</td><td class="num">${fmtS(M.defTotal(a))} W</td><td class="num">${fmt(a.cos, 2)}</td><td>${a.three ? (a.neutral ? '3-faset + N' : '3-faset uden N') : '1-faset'}</td><td>${esc(M.HP[a.harm].name)}</td><td class="num">${a.vMax} V</td><td class="num">${a.vMin ? `${a.vMin} V` : '—'}</td><td class="num">${a.leak ? `${fmt(a.leak, 1)} mA ${a.leakRes ? 'R' : 'C'}` : '—'}</td><td>${a.dcCap ? 'kan forekomme' : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Lækstrøm: R = resistiv (varmelegemer), C = kapacitiv (EMC-filtre). Klasse II-apparater har ingen lækstrøm til PE.</p>`;
}
function harmTable() {
  const hs = M.HARM.slice(1);
  return `<div class="doc-tw"><table class="doc-t"><thead><tr><th>Profil</th>${hs.map(h => `<th>${h}.</th>`).join('')}</tr></thead><tbody>${
    Object.values(M.HP).filter(p => Object.keys(p.h).length).map(p => `<tr><td>${esc(p.name)}</td>${hs.map(h => `<td class="num">${p.h[h] ? `${fmt(p.h[h] * 100, 0)} %` : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- Indhold ---------- */
const doc = (title, d) => `<div class="m-doc-b"><h4>${title}</h4>${d}</div>`;
const meas = (id, title, what, how, req, sim) => `<section class="doc-sub" id="doc-m-${id}"><h3>${title}</h3>
  <div class="m-doc-grid">${doc('Hvad måles', what)}${doc('I praksis', how)}${doc('Krav', req)}${doc('I simulatoren', sim)}</div></section>`;

const SECTIONS = [
  ['doc-start', 'Kom i gang', `
    <p>Værktøjet har tre faner. <b>Grundteori</b> forklarer trefaset vekselstrøm med visere og kurver. <b>Installation</b> er en simulator af hele forsyningen fra transformer til stikkontakt. <b>Vejledning</b> er det, du læser nu.</p>
    <h3>Grundteori</h3>
    <ul>
      <li>Venstre side viser de tre roterende visere, højre side kurverne over tid. Den lodrette projektion af en viser er kurvens øjebliksværdi.</li>
      <li>Klik på en top (○) i kurverne for at sætte punkt A og B. Panelet viser forskellen på den naive regning og den rigtige spænding mellem to faser.</li>
      <li>Træk i kurverne, brug piletasterne eller tidslinjen for at flytte tidsmarkøren. Mellemrum afspiller og pauser.</li>
      <li>Skift til <b>Strøm I</b> for at give hver fase sin egen belastning og faseforskydning og se strømmen i nullederen.</li>
    </ul>
    <h3>Installation</h3>
    <ul>
      <li>Diagrammet viser transformer, fordelingskabel, kabelskabe, stikledninger, tavler, grupper og brugsgenstande. Spændingen står ved hver tavle og hvert apparat.</li>
      <li>Klik på hvad som helst for at se detaljer i panelet til højre (under diagrammet på en smal skærm).</li>
      <li><b>Manglende nul</b> på en tavle afbryder nullen lige før tavlen. Klik på et kabel for at afbryde L1, L2, L3, N eller PE.</li>
      <li>Under en gruppe kan du indsætte en isolationsfejl, skifte gruppeafbryder, vælge gruppens faser og tilføje brugsgenstande. I et apparats panel vælger du, hvilke faser det er tilsluttet.</li>
      <li>For en lejlighed vælger du, hvilke faser den har, og om den forsynes fra hovedtavlen eller fra lejligheden nedenunder på samme stigeledning. På transformeren vælger du, om kredsen er udlagt til nulling.</li>
      <li>Installationstesteren i panelet måler i den valgte tavle eller ved gruppens stikkontakt.</li>
      <li>Hændelsesloggen viser, hvad der skete og hvornår: afbrydere, der udløser, og udstyr, der brænder af.</li>
      <li>Opgaverne under diagrammet stiller simulatoren op med en bestemt fejl.</li>
    </ul>
    <h3>Knapperne over diagrammet</h3>
    <ul>
      <li><b>Eksempel</b> indlæser en færdig installation.</li>
      <li><b>Udstyr kan brænde af</b> og <b>Afbrydere og HPFI virker</b> slår kaskaden og beskyttelsen til og fra. Slå dem fra for at se, hvilke spændinger fejlen ville give uden at noget ændrer sig.</li>
      <li><b>Fjern alle fejl</b> genetablerer alle ledere og fjerner isolationsfejl. Brændt udstyr og udløste afbrydere bliver som de er.</li>
      <li><b>Slå afbrydere til igen</b> og <b>Reparer brændt udstyr</b> nulstiller dem. Er fejlen der stadig, sker det samme igen, ligesom i virkeligheden.</li>
    </ul>
    <h3>Visning</h3>
    <p><b>Farver</b> skifter mellem ledningsfarver (L1 brun, L2 sort, L3 grå, N blå) og kontrastfarver. <b>Projektor</b> gør tekst og grafer større. Temaet kan skiftes mellem lyst og mørkt.</p>`],

  ['doc-trefase', 'Trefaset vekselstrøm', `
    <p>Transformeren har tre viklinger, der er forskudt 120° fra hinanden. Spændingerne mod nul er derfor tre sinuskurver, der er forskudt en tredjedel periode (6,67 ms ved 50 Hz).</p>
    <div class="eq"><span>u<sub>1</sub> = Û · sin(ωt), u<sub>2</sub> = Û · sin(ωt − 120°), u<sub>3</sub> = Û · sin(ωt − 240°)</span><span>ω = 2π · 50 Hz ≈ 314 rad/s</span></div>
    <h3>Effektivværdi, spidsværdi og spids-spids</h3>
    <p>230 V er effektivværdien (RMS): den jævnspænding, der giver samme varme i en modstand. Spidsværdien er √2 gange større, og kurven svinger fra +Û til −Û.</p>
    <div class="eq"><span>Û = √2 · 230 V ≈ 325 V</span><span>U<sub>pp</sub> = 2 · Û ≈ 650 V</span></div>
    <h3>Spændingen mellem to faser</h3>
    <p>Spændingen mellem L1 og L2 er forskellen i samme øjeblik, u<sub>12</sub> = u<sub>1</sub> − u<sub>2</sub>. Toppene kommer ikke på samme tid, så man kan ikke lægge 230 V og 230 V sammen. Med visere er U<sub>12</sub> = U<sub>1</sub> − U<sub>2</sub>, og fordi viserne står 120° fra hinanden, bliver længden 2 · U · sin 60° = √3 · U.</p>
    <div class="eq"><span>U<sub>12</sub> = √3 · 230 V ≈ 400 V, Û<sub>12</sub> ≈ 563 V, U<sub>12,pp</sub> ≈ 1127 V</span></div>
    <p>Summen af de tre spændinger (og af tre lige store strømme med samme cos φ) er nul i hvert øjeblik. Derfor løber der ingen strøm i nullederen ved symmetrisk belastning.</p>`],

  ['doc-net', 'Fra transformer til stikkontakt', `
    <dl class="doc-dl">
      <dt>Transformer</dt><dd>Omsætter 10 kV til 0,4 kV. Sekundærsiden er stjernekoblet, og stjernepunktet er jordet med driftsjorden R<sub>B</sub>. I simulatoren: 400 kVA, u<sub>k</sub> ≈ 4 %, 233 V i tomgang og R<sub>B</sub> = 2 Ω.</dd>
      <dt>Fordelingskabel</dt><dd>Firelederkabel (L1, L2, L3 og PEN) i aluminium fra transformeren ud gennem kabelskabene. Kablet til det næste kabelskab forsynes gennem det forrige, så en fejl tidligt i kæden rammer alle længere ude.</dd>
      <dt>Kabelskab</dt><dd>Fordelingspunkt i vejen, hvor stikledningerne til bygningerne er tilsluttet.</dd>
      <dt>Stikledning</dt><dd>Kablet fra kabelskabet til bygningens hovedtavle. I TN-C-S er fjerde leder en PEN-leder, i TT en nulleder.</dd>
      <dt>Hovedtavle</dt><dd>Bygningens første tavle med hovedjordklemmen, hvor PE fra jordelektroden samles. I TN-C-S deles PEN her i N og PE.</dd>
      <dt>Stigeledning / hovedledning</dt><dd>Kablet fra hovedtavlen op i opgangen til lejlighedernes undertavler. Én stigeledning kan forsyne flere lejligheder over hinanden. Den kan have en, to eller tre faser, nul og enten en separat PE eller en PEN (lokal nulling).</dd>
      <dt>Undertavle / gruppetavle</dt><dd>Tavlen i lejligheden med gruppeafbrydere og HPFI.</dd>
      <dt>Gruppe og gruppeledning</dt><dd>En gruppe er en strømkreds med egen gruppeafbryder, fx "Køkken". Gruppeledningen går fra tavlen til stikkontakter og faste udtag.</dd>
    </dl>
    <h3>Ledningsfarver</h3>
    <p>L1 er brun, L2 sort og L3 grå. N er blå, og PE er grøn/gul. En PEN-leder er grøn/gul med blå markering i enderne (eller blå med grøn/gul markering). Diagrammet bruger de samme farver på lederne i kablerne.</p>`],

  ['doc-jording', 'Jordingssystemer: TT og TN-C-S', `
    <p>Jordingssystemet bestemmer, hvilken vej fejlstrømmen tager, når en fase får forbindelse til et kabinet. Det afgør, hvor stor fejlstrømmen bliver, og hvad der skal afbryde.</p>
    <div class="dg-pair">
      <figure><figcaption><b>TN-C-S</b>: PEN deles i N og PE i hovedtavlen</figcaption>${systemSVG('TNCS')}</figure>
      <figure><figcaption><b>TT</b>: PE har sin egen jordelektrode</figcaption>${systemSVG('TT')}</figure>
    </div>
    <h3>TN-C-S</h3>
    <p>Fejlstrømmen løber tilbage gennem PE og PEN til transformeren. Sløjfen består kun af metal, så strømmen bliver flere hundrede ampere, og gruppeafbryderen udløser momentant. Kravet er, at Z<sub>s</sub> er lille nok (se Z loop).</p>
    <p>Svagheden er PEN-lederen. Brydes den før hovedtavlen, flyder nul, og fordi PE er forbundet med nul, får PE og alle udsatte dele spænding mod jord. Kun jordelektroden R<sub>E</sub> holder igen. Hverken gruppeafbryder eller HPFI reagerer, fordi der ikke løber nogen fejlstrøm.</p>
    <h3>TT</h3>
    <p>PE er kun forbundet til bygningens egen jordelektrode. Fejlstrømmen skal gennem R<sub>E</sub>, jorden og R<sub>B</sub>, så den bliver typisk få ampere. Det er for lidt til gruppeafbryderen, så beskyttelsen sker med HPFI. Kravet er R<sub>E</sub> · I<sub>ΔN</sub> ≤ 50 V, altså højst ca. 1667 Ω ved 30 mA.</p>
    <p>Fordelen er, at PE ikke følger nullen. Brydes nullen i stikledningen, ændrer spændingerne mellem fase og nul sig, men PE bliver i ro.</p>
    <h3>Hvornår må man bruge nulling?</h3>
    <p>Det er ikke alle steder i Danmark, at nulling (TN) er tilladt. Det afhænger af, om netselskabet har udlagt transformerkredsen til nulling. Er den ikke det, skal installationerne have jordspyd (TT) og beskyttes med HPFI. I simulatoren vælges det på transformeren: står "Udlagt til nulling" til nej, bliver alle bygninger TT, og TN-C-S og lokal nulling kan ikke vælges. Eksemplet "Område uden nulling" viser det.</p>`],

  ['doc-stige', 'Stigeledninger, faser og lokal nulling', `
    <p>I en etageejendom fordeles strømmen fra hovedtavlen op i opgangen med stigeledninger. Mange ældre ejendomme har ikke tre faser i alle lejligheder. Ofte har lejlighederne i stuen tre faser, mens en stigeledning med to faser og nul går op gennem hver side af opgangen. Lejlighederne på den ene side kan fx have L1 og L2, og på den anden side L1 og L3.</p>
    <h3>Stigeledningen forsyner flere lejligheder</h3>
    <p>En stigeledning går fra hovedtavlen op forbi alle etager, og hver lejlighed er tilsluttet på sin etage. I simulatoren vælger du for hver lejlighed, om den forsynes direkte fra hovedtavlen eller fra lejligheden nedenunder på samme stigeledning. Diagrammet viser hver stigeledning som en kolonne.</p>
    <p>Stigeledningen og lejligheden behøver ikke have de samme faser. En stigeledning i 5G10 Cu har alle tre faser, men lejligheden kan bruge to af dem, fx L1 og L2. Den tredje fase føres videre op, så lejligheden ovenover fx kan bruge L2 og L3. Stigeledningens faseledere vælges i stigeledningens panel, og lejlighedens faser i lejlighedens panel. Kablets betegnelse følger antallet af ledere: 4G10 med to faser, nul og PE, 5G10 med tre faser, nul og PE, og 3 × 10 eller 4 × 10 med PEN.</p>
    <p>Brydes nullen et sted i stigeledningen, rammer det alle lejligheder over bruddet. Har de kun to faser, kommer apparaterne på de to faser i serie over 400 V. Den fase med mest belastning får den laveste spænding.</p>
    <h3>PEN deles i hovedtavlen eller lokal nulling</h3>
    <ul>
      <li><b>PEN deles i hovedtavlen:</b> stigeledningerne har faser, nul og en separat PE (fx 4G10 med to faser). Brydes nullen i stigeledningen, flytter spændingerne sig, men PE bliver på jordpotentiale.</li>
      <li><b>Lokal nulling:</b> PEN fortsætter op i stigeledningerne (fx 3 × 10 med to faser og PEN), og i hver lejlighed er PE forbundet til PEN. Det er almindeligt i ældre ejendomme. Brydes PEN i stigeledningen, får PE i alle lejligheder over bruddet samme spænding som den flydende nul. Alle kabinetter på apparater i beskyttelsesklasse I bliver spændingsførende, og der er ingen jordelektrode i lejligheden, der holder igen.</li>
    </ul>
    <p>Nulling kræver, at transformerkredsen er udlagt til det (se jordingssystemer).</p>
    <h3>Brugsgenstande på faserne</h3>
    <ul>
      <li><b>230 V-apparater</b> sidder mellem en fase og nul. Du vælger fasen blandt gruppens faser.</li>
      <li><b>400 V-apparater</b>, fx en varmtvandsbeholder til 400 V, sidder mellem to faser og bruger ikke nul. Med tre faser kan de også tilsluttes som 3 × 400 V i trekant. Manglende nul rammer dem ikke.</li>
      <li><b>Komfur og induktionskogeplade</b> har elementer mellem fase og nul og kan fordeles på de faser, der er til rådighed.</li>
      <li><b>3-fasede apparater uden nul</b>, fx en varmepumpe, kræver alle tre faser.</li>
    </ul>
    <p>En gruppe kan føre en eller flere faser. Tilslutningen vælges i apparatets panel, og et lille mærke på apparatet i diagrammet viser den.</p>
    <h3>Strømmen i nul med to faser</h3>
    <p>To strømme, der er 120° forskudt, ophæver ikke hinanden. Er belastningen på L1 og L2 lige stor, er strømmen i nul lige så stor som i hver fase. En lejlighed med to faser belaster derfor altid nullen i stigeledningen.</p>`],

  ['doc-nul', 'Manglende nul og nulpunktsforskydning', `
    <p>Med en hel nulleder holder nullen stjernepunktet fast på transformerens nul. Hver fase giver 230 V til sine apparater, uanset hvad der sker på de andre faser.</p>
    <p>Når nullen brydes, er apparaterne på de tre faser i stedet koblet i stjerne med et flydende stjernepunkt. Stjernepunktet lægger sig, hvor strømmene fra de tre faser går i nul, og det bestemmes af apparaternes impedanser:</p>
    <div class="eq"><span>U<sub>N</sub> = (Y<sub>1</sub>·U<sub>1</sub> + Y<sub>2</sub>·U<sub>2</sub> + Y<sub>3</sub>·U<sub>3</sub>) / (Y<sub>1</sub> + Y<sub>2</sub> + Y<sub>3</sub>)</span><span>Y = 1/Z for belastningen på hver fase (Millmans sætning)</span></div>
    <p>Stjernepunktet trækkes mod den fase, der er mest belastet (lavest impedans). Den fase får lav spænding, mens de let belastede faser nærmer sig hovedspændingen på 400 V. Viserdiagrammet i tavlens panel viser det direkte: den blå prik N flytter sig væk fra midten af trekanten.</p>
    <h3>Eksempel: Lejlighed 1</h3>
    <p>L1 har elkedel og kaffemaskine (3 kW, ca. 18 Ω). L2 og L3 har kun router, oplader, LED og TV (ca. 100–150 W hver, flere hundrede ohm). Når nullen i stigeledningen brydes, falder L1 til under 50 V, mens L2 og L3 stiger til 360–380 V.</p>
    <h3>Hvorfor udstyr brænder af</h3>
    <ul>
      <li>En SMPS til 100–240 V har en indgangskondensator til ca. 400 V DC. Over ca. 280 V RMS bliver spidsspændingen for høj, og kondensatoren eller varistoren bryder sammen.</li>
      <li>Et ohmsk varmelegeme får effekten P = U²/R. Ved 400 V er effekten tre gange så stor som ved 230 V.</li>
      <li>En motor på den lave fase kan ikke starte, trækker stor strøm og bliver varm.</li>
    </ul>
    <p>Når det første apparat brænder af, falder det ud, og impedanserne ændrer sig. Stjernepunktet flytter sig igen, og flere apparater kan brænde af. Simulatoren viser denne kaskade i hændelsesloggen.</p>
    <h3>Hvor nullen kan mangle</h3>
    <ul>
      <li><b>Før en undertavle</b> (stigeledningen): rammer kun den lejlighed. Er lejligheden 1-faset, er det de andre lejligheder på samme stigeledning, der deler nullen.</li>
      <li><b>Før hovedtavlen</b> (stikledningen): rammer hele bygningen. I TN-C-S er det et PEN-brud, så PE får også spænding.</li>
      <li><b>I kablet mellem kabelskabe</b>: rammer alle bygninger længere ude. Husene påvirker hinanden, og kun jordelektroderne i TN-C-S-bygningerne holder delvist nullen på plads.</li>
    </ul>
    <p>Hverken gruppeafbryder eller HPFI beskytter mod manglende nul.</p>`],

  ['doc-samling', 'Dårlige samlinger', `
    <p>En løs, korroderet eller dårligt spændt klemme, fx en stigeledningsklemme eller en klemme i kabelskabet, har en overgangsmodstand. Lederen er ikke afbrudt, men forbindelsen er dårlig. Det giver tre problemer:</p>
    <ul>
      <li><b>Varme.</b> Strømmen afsætter effekten P = I² · R i samlingen. 10 A gennem 1 Ω er 100 W samlet i en lille klemme. Klemmen bliver varm, oxiderer, og modstanden stiger yderligere, indtil samlingen brænder over eller starter en brand.</li>
      <li><b>Spændingsfald.</b> Over samlingen falder spændingen U = I · R.</li>
      <li><b>Nulpunktsforskydning.</b> En dårlig samling i nullen er et "halvt" nulbrud. Strømmen i nullen giver et spændingsfald, som flytter nulpunktet. Den mest belastede fase får lavere spænding, og de andre højere. Med lokal nulling er PE forbundet til nullen, så PE og kabinetterne får spændingen I<sub>N</sub> · R mod jord.</li>
    </ul>
    <p>Gruppeafbrydere og HPFI reagerer ikke på en dårlig samling, fordi strømmen er normal. Fejlen findes ved termografi, ved at Z line er større end forventet, eller ved at måle N–PE-spændingen under belastning. Brænder samlingen helt over, bliver det et rigtigt nulbrud (se manglende nul).</p>
    <p>I simulatoren vælges en dårlig samling i et kabels panel: leder og overgangsmodstand. Panelet viser strøm, spændingsfald og effekt i samlingen. Knappen "Lad samlingen brænde over" afbryder lederen helt.</p>`],

  ['doc-fase', 'Fasebrud', `
    <p>Brydes en fase, bliver 1-fasede apparater på den fase strømløse. 3-fasede apparater uden nul, fx en varmepumpe, kører videre på to faser. En motor, der kører på to faser, trækker større strøm og bliver varm. Simulatoren markerer det som underspænding.</p>
    <p>Et 3-faset apparat med nul, fx et komfur, kan sende spænding tilbage på den afbrudte fase gennem sine elementer. Det er grunden til, at en "død" fase ikke altid er spændingsløs.</p>`],

  ['doc-pe', 'PE, jordfejl og berøringsspænding', `
    <p>PE forbinder alle udsatte dele, fx kabinettet på et køleskab, med jord. Får en fase forbindelse til kabinettet (jordfejl), løber fejlstrømmen gennem PE, og beskyttelsen skal afbryde, før berøringsspændingen bliver farlig.</p>
    <p><b>Berøringsspændingen U<sub>B</sub></b> er spændingen mellem kabinettet og jord under fejlen. I TN-C-S er den typisk ca. halvdelen af fasespændingen, men den varer kun indtil gruppeafbryderen udløser (få millisekunder). Spænding over 50 V AC regnes for farlig, hvis den står på.</p>
    <h3>Når PE er afbrudt</h3>
    <p>Er PE-lederen til en gruppe afbrudt, er der ingen vej for fejlstrømmen. Ved en jordfejl kommer kabinettet op på fuld fasespænding, men der løber ingen strøm, så hverken afbryder eller HPFI reagerer. Fejlen opdages kun ved måling (R LOW), og den er livsfarlig.</p>
    <p>Det samme gælder i TT, hvis jordledningen til jordelektroden er afbrudt: PE har ingen forbindelse til jord, HPFI-testen kan ikke udløse, og en jordfejl giver spænding på alle kabinetter.</p>`],

  ['doc-iso', 'Isolationsfejl', `
    <p>Isolationen mellem lederne kan blive dårlig, fx på grund af fugt, varme eller en skruet søm. Simulatoren har tre typer fejl:</p>
    <ul>
      <li><b>Fase–PE</b>: en lækstrøm til jord. Ved høj modstand mærkes den kun ved R ISO-måling. Ved lav modstand er det en jordfejl, og afbryder eller HPFI udløser.</li>
      <li><b>Nul–PE</b>: nul og PE er forbundet efter tavlen. En del af nulstrømmen løber så tilbage i PE, og HPFI ser en forskel og udløser. Det sker kun, når gruppen er belastet, så fejlen viser sig ofte som "HPFI'en slår fra, når vi tænder vaskemaskinen".</li>
      <li><b>Fase–nul</b>: ved lav modstand er det en kortslutning, og gruppeafbryderen udløser momentant. HPFI reagerer ikke, fordi strømmen går ud og tilbage i de strømførende ledere.</li>
    </ul>
    <p>Isolationsfejl findes med R ISO-målingen. Mål først på tavlen, og derefter på grupperne én ad gangen, indtil du finder gruppen med lav værdi.</p>`],

  ['doc-laek', 'Lækstrømme', `
    <p>Alle apparater i beskyttelsesklasse I leder en lille strøm til PE i normal drift. Elektronik har EMC-filtre med kondensatorer mellem fase og PE, og varmelegemer lækker lidt gennem isolationen, især når de er fugtige. Det er typisk under 1–2 mA pr. apparat, men HPFI'en ser summen af lækstrømmene i alle sine grupper.</p>
    <ul>
      <li><b>Samme fase:</b> lækstrømmene lægges sammen.</li>
      <li><b>Forskellige faser:</b> de er forskudt 120° og ophæver delvist hinanden.</li>
      <li><b>Kapacitiv og resistiv:</b> en kapacitiv lækstrøm (EMC-filter) er forskudt 90° i forhold til en resistiv (fugt, isolationsfejl). De lægges sammen som visere, så 6 mA og 8 mA giver 10 mA og ikke 14 mA.</li>
    </ul>
    <p>En 30 mA HPFI udløser et sted mellem 15 og 30 mA. Bruger lækstrømmene allerede en stor del af det, skal der kun en lille ekstra fejl til, før den udløser. Tommelfingerreglen er, at lækstrømmen højst bør være 30 % af I<sub>ΔN</sub>, altså 9 mA for en 30 mA HPFI. Det løses ved at fordele grupperne på flere HPFI'er og flere faser.</p>
    <p>Lækstrømmen måles med en lækstrømstang omkring alle strømførende ledere. Tangen måler forskellen, altså det, der løber ud gennem PE. I simulatoren er det målefunktionen <b>Lækstrøm</b>, og tavlens panel viser lækstrømmen gennem HPFI'en.</p>
    <p>Klasse II-apparater (dobbeltisolerede, uden PE), fx de fleste opladere og fjernsyn, har ingen lækstrøm til PE.</p>`],

  ['doc-harm', 'Harmoniske strømme', `
    <p>Ikke-lineære apparater som SMPS-strømforsyninger, LED-drivere og frekvensomformere trækker ikke en sinusformet strøm. En SMPS uden PFC lader sin kondensator op i korte pulser nær spændingens top. Pulserne kan skrives som en sum af sinuskurver med 50 Hz (grundtonen) og hele multipla: 150 Hz (3.), 250 Hz (5.), 350 Hz (7.) osv.</p>
    <div class="eq"><span>THD = √(I<sub>3</sub>² + I<sub>5</sub>² + I<sub>7</sub>² + …) / I<sub>1</sub></span><span>I<sub>RMS</sub> = √(I<sub>1</sub>² + I<sub>3</sub>² + I<sub>5</sub>² + …)</span></div>
    <h3>Hvorfor den 3. harmoniske samles i nullederen</h3>
    <p>Grundtonerne fra de tre faser er forskudt 120° og ophæver hinanden i nul. Den 3. harmoniske svinger tre gange så hurtigt, så forskydningen bliver 3 · 120° = 360°. De tre faser er dermed i fase og lægges sammen i nul. Det samme gælder 9., 15. osv. Ved symmetrisk SMPS-belastning kan nullederen derfor få mere strøm end faselederne, op til ca. √3 gange, når belastningen kun består af ensrettere.</p>
    <p>Det belaster nullederen og transformeren, og det kan ikke ses på et almindeligt amperemeter, der ikke måler sand RMS. Apparater med aktiv PFC (fx computere over 75 W) trækker næsten sinusformet strøm.</p>
    <p>I simulatoren kan du se spektret for hver leder og hvert apparat. Opgaven "Harmoniske i nullederen" viser et kontor, hvor nullen har mere strøm end faserne.</p>`],

  ['doc-beskyttelse', 'Beskyttelse: gruppeafbryder og HPFI', `
    <h3>Gruppeafbryder (automatsikring)</h3>
    <p>En gruppeafbryder har to udløsere. Den termiske udløser beskytter mod overbelastning og udløser langsommere, jo mindre overstrømmen er. Den magnetiske udløser beskytter mod kortslutning og jordfejl og udløser momentant, når strømmen bliver stor nok:</p>
    <div class="eq"><span>B-karakteristik: momentant ved 3–5 · I<sub>n</sub> (simulatoren bruger 5 · I<sub>n</sub>)</span><span>C-karakteristik: momentant ved 5–10 · I<sub>n</sub> (simulatoren bruger 10 · I<sub>n</sub>)</span></div>
    <p>For at gruppen er beskyttet mod jordfejl i TN, skal fejlstrømmen mindst være udløsestrømmen I<sub>a</sub>, så afbryderen kobler fra inden for 0,4 s. Det giver kravet Z<sub>s</sub> ≤ U<sub>0</sub> / I<sub>a</sub>. En B13 kræver Z<sub>s</sub> ≤ 230 V / 65 A ≈ 3,54 Ω, en C13 kun 1,77 Ω.</p>
    <p>Simulatorens termiske kurve er forenklet: ingen udløsning under 1,13 · I<sub>n</sub>, og derover t = 60 s / ((I/I<sub>n</sub>)² − 1). Tid-strøm-kurven i gruppens panel viser kurven og strømmene.</p>
    <h3>HPFI (fejlstrømsafbryder)</h3>
    <p>HPFI'en sammenligner strømmen ud i faserne med strømmen tilbage i nullen. Er forskellen (fejlstrømmen) over udløsestrømmen, kobler den fra. En 30 mA HPFI beskytter mennesker, fordi den udløser, før strømmen gennem kroppen bliver farlig.</p>
    <ul>
      <li>Udløsestrømmen ligger mellem 0,5 og 1,0 · I<sub>ΔN</sub> (15–30 mA ved 30 mA).</li>
      <li>Udløsetiden må højst være 300 ms ved 1 · I<sub>ΔN</sub> og 40 ms ved 5 · I<sub>ΔN</sub>.</li>
      <li>Den beskytter ikke mod overbelastning, kortslutning mellem fase og nul eller manglende nul.</li>
    </ul>
    <p>I simulatoren sidder der én HPFI i hver tavle, som beskytter tavlens grupper. Hver HPFI har sin egen faste udløsestrøm og -tid inden for grænserne. Typen (AC, A, F eller B) vælges i tavlens indstillinger. Se også <button type="button" class="link" data-doc="doc-rcdtype">HPFI-typer og glat DC</button>, <button type="button" class="link" data-doc="doc-laek">Lækstrømme</button> og <button type="button" class="link" data-doc="doc-afdd">AFDD</button>.</p>`],

  ['doc-ik', 'Kortslutningsstrøm: Ik,max og Ik,min', `
    <p>Kortslutningsstrømmen Ik er den strøm, der løber, hvis to ledere kortsluttes i et punkt. Den bestemmes af spændingen og af impedansen fra transformeren hen til fejlstedet: transformerens kortslutningsimpedans og alle kablerne på vejen. Jo lavere impedans, jo større Ik, og jo stivere er nettet i det punkt.</p>
    <div class="eq"><span>Ik3 = c · U<sub>n</sub> / (√3 · |Z<sub>1</sub>|)</span><span>Ik1 = c · U<sub>0</sub> / |Z<sub>L</sub> + Z<sub>N</sub>| eller c · U<sub>0</sub> / |Z<sub>L</sub> + Z<sub>PE</sub>|</span></div>
    <h3>To værdier til to formål</h3>
    <ul>
      <li><b>Ik,max</b> er den største strøm, typisk en 3-faset kortslutning tæt på transformeren. Den regnes med c = 1,10 og kolde ledere (20 °C) og bruges til at kontrollere, at afbrydere og sikringer kan bryde strømmen. Almindelige gruppeafbrydere har en brydeevne på 6 kA eller 10 kA.</li>
      <li><b>Ik,min</b> er den mindste strøm, typisk en 1-faset fejl fase–nul eller fase–PE i det fjerneste punkt. Den regnes med c = 0,95 og varme ledere (80 °C, R × 1,24) og bruges til at kontrollere, at beskyttelsen udløser hurtigt nok: Ik,min skal være mindst afbryderens udløsestrøm I<sub>a</sub>, fx 5 · I<sub>n</sub> for en B-afbryder.</li>
    </ul>
    <p>Netselskabet oplyser Ik,max og Ik,min i leveringspunktet. Inde i installationen falder Ik for hver meter kabel, især i små tværsnit.</p>
    <h3>Bliver nettet stivere, når der kommer mere udstyr på?</h3>
    <p>Nej. Et apparat er en stor impedans (en elkedel på 2 kW er ca. 26 Ω), mens netimpedansen kun er nogle hundrede milliohm. Ved en kortslutning bliver apparaterne kortsluttet sammen med fejlen, så de ændrer næsten ikke kortslutningsstrømmen. Til gengæld giver belastningsstrømmen spændingsfald i kabler og transformer, så spændingen falder, jo mere der er tændt.</p>
    <p>Nettet bliver stivere med en større transformer eller lavere u<sub>k</sub>, et større tværsnit, kortere kabler eller flere parallelle forsyningsveje. Roterende motorer giver et kort bidrag til kortslutningsstrømmen de første millisekunder, og invertere fra fx solceller giver højst lidt mere end deres mærkestrøm.</p>
    <h3>I simulatoren</h3>
    <p>Diagrammet viser Ik,min ved transformeren, kabelskabene, tavlerne og ved hver gruppes udtag. Er Ik,min ved et udtag mindre end gruppeafbryderens I<sub>a</sub>, vises den med rødt. Panelet viser Ik,max, Ik,min L–N og L–PE, om brydeevnen er nok, og en sammenligning af kortslutningsstrømmen med og uden den aktuelle belastning. Beregningen er forenklet efter IEC 60909: nettet regnes uden belastning, og transformerens nulsystemimpedans sættes lig med plusimpedansen.</p>`],

  ['doc-rcdtype', 'HPFI-typer og glat DC', `
    <p>En HPFI måler fejlstrømmen med en ringkerne omkring fase- og nullederne. Hvilke former for fejlstrøm den kan se, afhænger af typen:</p>
    <div class="doc-tw"><table class="doc-t"><thead><tr><th>Type</th><th>Ser</th><th>Tåler glat DC</th><th>Typisk brug</th></tr></thead><tbody>
      <tr><td>AC</td><td>Sinusformet vekselstrøm</td><td>Næsten intet</td><td>Ældre type. Type A er i dag standard i boliger.</td></tr>
      <tr><td>A</td><td>Vekselstrøm og pulserende DC</td><td>6 mA</td><td>Almindelige grupper i boliger.</td></tr>
      <tr><td>F</td><td>Som A, plus blandede frekvenser op til 1 kHz</td><td>10 mA</td><td>1-fasede apparater med frekvensomformer, fx vaskemaskiner.</td></tr>
      <tr><td>B</td><td>Alle former, også glat DC</td><td>Ser DC og udløser</td><td>3-fasede frekvensomformere, elbilladere uden DC-overvågning, solcelleinvertere.</td></tr>
    </tbody></table></div>
    <h3>Mættede og blinde HPFI'er</h3>
    <p>Glat DC (jævnstrøm uden pulser) magnetiserer HPFI'ens kerne hele tiden. Kernen bliver mættet og kan ikke længere omsætte en vekselstrømsfejl til nok signal til udløseren. HPFI'en bliver mindre følsom, og ved nok DC bliver den helt blind: den udløser ikke, selvom der er en farlig jordfejl. Udefra ser den helt normal ud.</p>
    <p>Glat DC kommer fra 3-fasede ensrettere og frekvensomformere, elbilladere og solcelleinvertere uden transformer. En fejl i ét apparat kan derfor sætte HPFI'en ud af drift for hele tavlen, også for grupper, der intet har med apparatet at gøre.</p>
    <h3>Elbilladere og RDC-DD</h3>
    <p>En elbillader kan give glat DC-fejlstrøm. Den skal derfor enten beskyttes af en type B, eller have en indbygget 6 mA DC-overvågning (RDC-DD), som afbryder laderen ved 6 mA glat DC. Så er en type A nok foran.</p>
    <p>I simulatoren tåler type AC 2 mA, A 6 mA og F 10 mA glat DC. Over grænsen stiger udløsestrømmen, og over det dobbelte er HPFI'en blind. Type B udløser på glat DC ved ca. 1,4 gange sin udløsestrøm. RDC-DD stopper laderen efter 10 s ved 6 mA og efter 0,3 s ved 60 mA. Glat DC kan indstilles på elbilladeren og varmepumpen.</p>`],

  ['doc-afdd', 'AFDD: lysbuedetektor', `
    <p>En lysbue opstår, når strømmen springer over et lille luftgab, fx i en løs klemme, et klemt kabel eller en beskadiget ledning. Lysbuen er meget varm og kan antænde omgivelserne.</p>
    <ul>
      <li><b>Serielysbue</b> i en løs forbindelse i fase eller nul. Strømmen er den normale belastningsstrøm, så gruppeafbryderen reagerer ikke. Strømmen går ud og tilbage gennem HPFI'en, så den reagerer heller ikke.</li>
      <li><b>Parallel lysbue mellem fase og nul.</b> Lysbuen begrænser strømmen, så den ofte er for lille til momentan udløsning. I virkeligheden er buen ustabil, og gruppeafbryderen udløser tit slet ikke.</li>
      <li><b>Parallel lysbue mellem fase og PE.</b> Det er en fejlstrøm til jord, som HPFI'en ser.</li>
    </ul>
    <p>En AFDD (Arc Fault Detection Device) analyserer strømmens form. En lysbue giver højfrekvent støj og et karakteristisk mønster omkring nulgennemgangen, som AFDD'en genkender. Den skal udløse inden for 1 s ved 2,5 A og hurtigere ved større strøm (IEC 62606). Den er ofte bygget sammen med gruppeafbryderen og eventuelt HPFI'en. En installationstester kan ikke teste den. Den har sin egen testknap.</p>
    <p>I simulatoren giver en løs forbindelse en ekstra modstand på ${fmt(M.R_ARC_S, 1)} Ω i fasen, og effekten i forbindelsen er P = I² · R. En lysbue mellem fase og nul er en modstand på ${fmt(M.R_ARC_P, 1)} Ω. AFDD'en udløser efter tiderne i IEC 62606 ved mindst 2,5 A og efter 0,12 s ved en parallel lysbue.</p>`],

  ['doc-maaling', 'Installationstesteren', `
    <p>Installationstesteren efterligner funktionerne i en multifunktionstester, fx Metrel Eurotest. Den måler i den valgte tavle eller ved en gruppes stikkontakt. Den er en forenkling og ikke en brugsanvisning til et bestemt instrument. Krav og grænser følger principperne i installationsbekendtgørelsen og DS/HD 60364.</p>
    ${meas('U', 'Spænding, frekvens og fasefølge',
      'Spændingen mellem alle ledere i målepunktet: L–N, L–PE, N–PE og L–L, samt frekvens og fasefølge.',
      'Det første, man måler. Kontrollerer, at der er spænding, at fasefølgen er højre (1.2.3), og at N–PE er tæt på 0 V.',
      '230 V ± 10 %, 400 V mellem faser. Høj N–PE-spænding tyder på fejl i nul eller PE.',
      'Spændingerne regnes i det aktuelle net, inklusive fejl og harmoniske.')}
    ${meas('RISO', 'R ISO: isolationsmodstand',
      'Isolationsmodstanden mellem L+N og PE eller mellem L og N, målt med 500 V DC.',
      'Installationen skal være spændingsløs, og brugsgenstande skal være frakoblet. Mål først på tavlen og derefter på grupperne for at finde en fejl.',
      'Mindst 1,0 MΩ ved 500 V DC.',
      `Hver gruppe har en sund isolation på ${fmt(M.R_HEALTHY / 1e6, 0)} MΩ. En isolationsfejl kobles parallelt. Målt på en tavle er alle dens grupper parallelle.`)}
    ${meas('RLOW', 'R LOW: kontinuitet i PE',
      'Modstanden i beskyttelseslederen fra målepunktet til hovedjordklemmen.',
      'Måles med mindst 200 mA og vendt polaritet. Resultatet sammenlignes med den forventede ledermodstand R = ρ · l / A.',
      'Ingen fast grænse, men værdien skal passe til kablets længde og tværsnit. Høj eller uendelig værdi betyder en afbrudt eller dårlig PE.',
      'Modstanden i PE-lederne fra målepunktet til hovedtavlen. Afbrudt PE giver over 1999 Ω.')}
    ${meas('ZL', 'Z line og I<sub>PSC</sub>',
      'Impedansen i sløjfen fase–nul (eller fase–fase) og den mulige kortslutningsstrøm I<sub>PSC</sub> = U / Z.',
      'Instrumentet belaster kort og måler spændingsfaldet. Bruges til at kontrollere afbrydernes brydeevne (fx 6 kA) og spændingsfald.',
      'I<sub>PSC</sub> må ikke overstige afbryderens brydeevne. Høj Z line tyder på en dårlig forbindelse eller en afbrudt nul.',
      'Den indre impedans mellem fase og nul i nettet, med transformer, kabler og tilsluttede apparater.')}
    ${meas('ZS', 'Z loop og I<sub>PFC</sub>',
      'Impedansen i fejlsløjfen fase–PE og fejlstrømmen I<sub>PFC</sub> = 230 V / Z<sub>s</sub>.',
      'Måles ved stikkontakten. Viser, om en jordfejl vil give nok strøm til, at gruppeafbryderen udløser momentant.',
      'I TN: Z<sub>s</sub> ≤ U<sub>0</sub> / I<sub>a</sub>, fx 3,54 Ω for B13 og 1,77 Ω for C13. I TT er sløjfen for stor, og beskyttelsen sker med HPFI.',
      'Den indre impedans mellem fase og PE. I TT går sløjfen gennem R<sub>E</sub>, jorden og R<sub>B</sub>.')}
    ${meas('RCD', 'HPFI: U<sub>c</sub>, udløsetid og udløsestrøm',
      'Berøringsspændingen U<sub>c</sub> ved mærkefejlstrømmen, udløsetider ved ½, 1 og 5 · I<sub>ΔN</sub> og udløsestrømmen med en stigende rampe.',
      'Testeren sender en kontrolleret fejlstrøm fra fase til PE og måler, hvor hurtigt HPFI\'en kobler fra.',
      'U<sub>c</sub> ≤ 50 V. Ingen udløsning ved ½ · I<sub>ΔN</sub>, ≤ 300 ms ved 1 · I<sub>ΔN</sub>, ≤ 40 ms ved 5 · I<sub>ΔN</sub>, udløsestrøm mellem 0,5 og 1,0 · I<sub>ΔN</sub>.',
      'U<sub>c</sub> = I<sub>ΔN</sub> · modstanden fra PE til jord. Tider og udløsestrøm er faste værdier for hver HPFI. Uden forbindelse fra PE til jord kan testen ikke udløse.')}
    ${meas('LEAK', 'Lækstrøm med tang',
      'Den samlede lækstrøm til PE i en gruppe eller under en HPFI.',
      'En lækstrømstang lægges om alle strømførende ledere. Kun forskellen, altså strømmen der løber ud i PE, giver udslag.',
      'Ingen fast grænse, men højst ca. 30 % af I<sub>ΔN</sub> (9 mA ved 30 mA) for at undgå, at HPFI\'en udløser uden en egentlig fejl.',
      'Vektorsummen af strømmene i gruppeledningernes fase- og nulledere ved 50 Hz, plus glat DC fra apparaterne.')}
    ${meas('RE', 'R<sub>E</sub>: jordelektrode',
      'Modstanden fra jordelektroden til jord.',
      'Måles med en 3-polet metode med to hjælpespyd, eller med en tang-metode.',
      'I TT med 30 mA HPFI: R<sub>E</sub> · I<sub>ΔN</sub> ≤ 50 V, altså højst ca. 1667 Ω. I TN-C-S er elektroden en ekstra sikkerhed ved PEN-brud.',
      'Viser den værdi, der er indstillet for bygningen.')}
    ${meas('FAULT', 'Jordfejl og berøringsspænding U<sub>B</sub>',
      'Ikke en måling, men en simulering: hvad sker der, hvis fasen får forbindelse til PE i målepunktet?',
      'Svarer til en rigtig jordfejl, fx en defekt ledning i et apparat.',
      'Beskyttelsen skal afbryde inden for 0,4 s (TN, grupper til og med 32 A), eller berøringsspændingen må ikke overstige 50 V.',
      'Fejlen indsættes med den valgte modstand. Panelet viser fejlstrøm, U<sub>B</sub>, spændingen på PE i andre tavler, og om gruppeafbryder eller HPFI afbryder. Knappen "Indsæt fejlen i installationen" gør fejlen permanent, så du kan se hændelserne.')}`],

  ['doc-model', 'Modellen bag simulatoren', `
    <p>Simulatoren regner nettet som et elektrisk kredsløb med komplekse tal (knudepunktsanalyse). Hver leder i hvert kabel er en impedans R + jX. Transformeren er en spændingskilde bag sin kortslutningsimpedans, og jordelektroderne er modstande til en fælles "fjern jord".</p>
    <ul>
      <li><b>Brugsgenstande</b> er faste impedanser beregnet ud fra mærkeeffekt og cos φ ved 230 V. Et apparat på 2000 W er altså en modstand på 26,5 Ω, også når spændingen ændrer sig.</li>
      <li><b>Ikke-lineære apparater</b> sender desuden harmoniske strømme ud med et typisk spektrum. Hver harmonisk orden regnes for sig (150 Hz, 250 Hz …), og kablernes reaktans skaleres med frekvensen.</li>
      <li><b>Hændelser</b>: efter hver beregning findes det, der sker først. Det kan være en gruppeafbryder (momentant 10 ms eller termisk), en HPFI (typisk 10–30 ms) eller det værst ramte apparat, der brænder af efter ca. 0,5 s. Hændelsen udføres, og nettet regnes igen, indtil der ikke sker mere.</li>
      <li><b>Isolation</b>: hver gruppe har sund isolation, og en isolationsfejl indgår både i R ISO-målingen og i selve nettet.</li>
      <li><b>Lækstrøm</b>: hvert klasse I-apparat har en modstand (varmelegemer) eller en kapacitet (EMC-filter) fra fasen til PE, som giver dets typiske lækstrøm ved 230 V. Kapaciteten leder mere ved højere frekvenser.</li>
      <li><b>Glat DC</b> indgår ikke i vekselstrømsberegningen, men lægges sammen for hver HPFI og bruges til at afgøre, om den er mættet. DC kan kun løbe, hvis apparatets PE er forbundet.</li>
      <li><b>Lysbuer</b> er modstande: en løs forbindelse i fasen eller en lysbue mellem fase og nul. AFDD-tiderne følger IEC 62606.</li>
    </ul>
    <h3>Begrænsninger</h3>
    <ul>
      <li>Værdierne er typiske værdier til undervisning, ikke data for bestemte produkter. Tålegrænser, harmoniske og HPFI-tider varierer meget i virkeligheden.</li>
      <li>Apparater regulerer ikke deres effekt. En SMPS trækker i virkeligheden mere strøm, når spændingen falder.</li>
      <li>Der er ingen gensidig induktans mellem lederne, ingen opvarmning af kabler og ingen dynamik. Termiske udløsetider regnes ud fra den stationære strøm.</li>
      <li>Fordelingsnettet har kun driftsjord ved transformeren. Der er ingen jordelektroder i kabelskabene og ingen forbindelse via vandrør eller andre bygninger.</li>
      <li>Én HPFI pr. tavle og én isolationsfejl pr. gruppe.</li>
    </ul>
    <h3>Kabeldata</h3>${cableTable()}
    <h3>Brugsgenstande</h3>${applTable()}
    <h3>Harmoniske profiler (procent af grundtonen)</h3>${harmTable()}`],

  ['doc-ord', 'Ordliste', `
    <dl class="doc-dl gloss">
      <dt>RMS / effektivværdi</dt><dd>Den jævnspænding eller jævnstrøm, der giver samme varme. 230 V er en effektivværdi.</dd>
      <dt>Û, spidsværdi</dt><dd>Kurvens højeste værdi. Û = √2 · U for en sinus.</dd>
      <dt>U<sub>pp</sub>, spids-spids</dt><dd>Afstanden fra top til bund, 2 · Û.</dd>
      <dt>Fasespænding</dt><dd>Spændingen mellem en fase og nul, 230 V.</dd>
      <dt>Hovedspænding</dt><dd>Spændingen mellem to faser, 400 V.</dd>
      <dt>Viser</dt><dd>En pil, der roterer med 50 Hz. Længden er spidsværdien, og den lodrette projektion er øjebliksværdien.</dd>
      <dt>cos φ</dt><dd>Cosinus til faseforskydningen mellem spænding og strøm. 1 for ohmsk belastning, mindre for motorer.</dd>
      <dt>Nulpunktsforskydning</dt><dd>Hvor langt stjernepunktet (N) er flyttet fra midten af spændingstrekanten, typisk fordi nullen mangler.</dd>
      <dt>N</dt><dd>Nulleder. Fører belastningsstrømmen tilbage.</dd>
      <dt>PE</dt><dd>Beskyttelsesleder. Forbinder udsatte dele med jord og fører kun strøm ved fejl.</dd>
      <dt>PEN</dt><dd>Kombineret nul- og beskyttelsesleder i fordelingsnettet og i stikledningen i TN-C-S.</dd>
      <dt>TT</dt><dd>Jordingssystem, hvor installationens PE har egen jordelektrode (jordspyd).</dd>
      <dt>Nulling</dt><dd>Beskyttelse, hvor PE er forbundet til nul/PEN, så en jordfejl bliver en kortslutning, der udløser gruppeafbryderen. Kræver, at transformerkredsen er udlagt til nulling.</dd>
      <dt>Ik,max og Ik,min</dt><dd>Den største og mindste kortslutningsstrøm i et punkt. Ik,max bruges til brydeevne, Ik,min til at kontrollere, at beskyttelsen udløser.</dd>
      <dt>Stift net</dt><dd>Et net med lav impedans og dermed høj kortslutningsstrøm og lille spændingsfald.</dd>
      <dt>Brydeevne</dt><dd>Den største kortslutningsstrøm, en afbryder eller sikring kan bryde sikkert, fx 6 kA.</dd>
      <dt>Overgangsmodstand</dt><dd>Modstanden i en samling eller klemme. En dårlig samling har høj overgangsmodstand og bliver varm.</dd>
      <dt>Lokal nulling</dt><dd>PEN fortsætter op i stigeledningen, og PE forbindes til PEN i hver lejlighed.</dd>
      <dt>TN-C-S</dt><dd>Jordingssystem, hvor PEN deles i N og PE i hovedtavlen.</dd>
      <dt>R<sub>B</sub></dt><dd>Driftsjord ved transformerens stjernepunkt.</dd>
      <dt>R<sub>E</sub> (R<sub>A</sub>)</dt><dd>Installationens jordelektrode.</dd>
      <dt>Z<sub>line</sub></dt><dd>Impedansen i sløjfen fase–nul.</dd>
      <dt>Z<sub>loop</sub> / Z<sub>s</sub></dt><dd>Impedansen i fejlsløjfen fase–PE.</dd>
      <dt>I<sub>PSC</sub></dt><dd>Mulig kortslutningsstrøm mellem fase og nul (prospective short-circuit current).</dd>
      <dt>I<sub>PFC</sub></dt><dd>Mulig fejlstrøm mellem fase og PE (prospective fault current).</dd>
      <dt>I<sub>a</sub></dt><dd>Den strøm, der får afbryderen til at udløse inden for den krævede tid.</dd>
      <dt>I<sub>ΔN</sub></dt><dd>HPFI'ens mærkefejlstrøm, fx 30 mA.</dd>
      <dt>U<sub>c</sub></dt><dd>Berøringsspænding ved mærkefejlstrømmen, målt ved HPFI-test.</dd>
      <dt>U<sub>B</sub></dt><dd>Berøringsspænding under en fejl: spændingen mellem udsatte dele og jord.</dd>
      <dt>R ISO</dt><dd>Isolationsmodstand, målt med jævnspænding.</dd>
      <dt>R LOW</dt><dd>Lavohmsmåling af kontinuiteten i beskyttelseslederne.</dd>
      <dt>HPFI</dt><dd>Fejlstrømsafbryder (RCD), der udløser ved forskel mellem udgående og returnerende strøm.</dd>
      <dt>SMPS</dt><dd>Switch mode-strømforsyning, fx en oplader. Trækker strøm i pulser og giver harmoniske.</dd>
      <dt>PFC</dt><dd>Power factor correction. Gør en SMPS' strøm næsten sinusformet.</dd>
      <dt>THD</dt><dd>Total harmonisk forvrængning: de harmoniskes samlede størrelse i forhold til grundtonen.</dd>
      <dt>Lækstrøm</dt><dd>Den strøm, et apparat i normal drift leder til PE gennem EMC-filtre og isolation.</dd>
      <dt>Glat DC</dt><dd>Jævnstrøm uden pulser, fx fra en 3-faset ensretter. Kan mætte en HPFI af type AC, A eller F.</dd>
      <dt>Pulserende DC</dt><dd>Halvbølger af en ensrettet strøm, fx fra en 1-faset ensretter. Type A ser den.</dd>
      <dt>HPFI type AC, A, F, B</dt><dd>Angiver, hvilke former for fejlstrøm HPFI'en kan se: AC kun vekselstrøm, A også pulserende DC, F også blandede frekvenser, B også glat DC.</dd>
      <dt>RDC-DD</dt><dd>6 mA DC-overvågning i en elbillader. Afbryder laderen ved glat DC-fejlstrøm, så en type A kan bruges foran.</dd>
      <dt>AFDD</dt><dd>Lysbuedetektor (Arc Fault Detection Device). Udløser ved lysbuer i løse forbindelser og beskadigede kabler.</dd>
      <dt>Serielysbue</dt><dd>Lysbue i en løs forbindelse i én leder. Strømmen er normal, så kun en AFDD kan se den.</dd>
      <dt>Kaskade</dt><dd>Når ét apparat brænder af og falder ud, flytter spændingerne sig, og flere kan brænde af.</dd>
    </dl>`],
];

$('#viewDocs').innerHTML = `<div class="docs">
  <nav class="doc-toc" aria-label="Indhold"><h2>Indhold</h2><ol>${SECTIONS.map(([id, t]) => `<li><a href="#${id}" data-doc="${id}">${t}</a></li>`).join('')}</ol></nav>
  <div class="doc-body">${SECTIONS.map(([id, t, body]) => `<section class="doc-sec" id="${id}" tabindex="-1"><h2>${t}</h2>${body}</section>`).join('')}</div>
</div>`;

/* Links med data-doc åbner vejledningen ved det rigtige afsnit, også fra de andre faner */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-doc]');
  if (!a) return;
  e.preventDefault();
  app.openDoc(a.dataset.doc);
});
})();
