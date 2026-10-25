/* Installation: opgaver, der stiller simulatoren op til et bestemt scenarie */
(function () {
'use strict';
const M = window.Inst, app = window.InstApp;
const $ = s => document.querySelector(s);

const std = () => app.load(M.SCENARIOS.standard.make(), true);
const bld = name => app.net.flatMap(f => f.buildings).find(b => b.name === name);
const unit = name => app.net.flatMap(f => f.buildings.flatMap(b => b.units)).find(u => u.name === name);
const grp = (owner, name) => owner.groups.find(g => g.name === name);

const TASKS = [
  {title: 'Manglende nul i en undertavle',
    text: 'Nullen i stigeledningen til Lejlighed 1 er afbrudt. Hvorfor får L1 meget lav spænding, mens L2 og L3 får næsten 400 V? Hvilke apparater brænder af først?',
    answer: 'L1 er hårdt belastet af elkedel og kaffemaskine (lav impedans), mens L2 og L3 kun har små apparater (høj impedans). Uden nul flytter stjernepunktet sig mod L1, så L2 og L3 får tæt på hovedspændingen. Små SMPS-apparater som router og opladere har den laveste tålegrænse og brænder af først. Derefter fordeler spændingen sig på ny, og flere brænder af.',
    setup: () => { std(); const u = unit('Lejlighed 1'); u.cable.broken.N = true; return {sel: ['unit', u.id]}; }},
  {title: 'Flyt nulpunktet med belastningen',
    text: 'Nullen i stikledningen til Hus 2 (TT) er afbrudt, og tavlens apparater er slukket. Brug skyderne under viserdiagrammet i hovedtavlens panel: 1) Sæt 2 kW på L1 alene. 2) Sæt i stedet 2 kW på L2 og 2 kW på L3, og intet på L1. 3) Sæt 2 kW på alle tre faser. Hvor lander nulpunktet N hver gang, og hvilke spændinger får faserne?',
    answer: '1) N lander i hjørnet L1. L1 får 0 V, og L2 og L3 får hele hovedspændingen, ca. 400 V. 2) N lander midt på linjen mellem L2 og L3. L2 og L3 får ca. 200 V hver, og L1 får ca. 346 V (400 V · √3/2). 3) N ligger i midten igen, og alle faser får 230 V, selvom nullen er afbrudt. En symmetrisk belastning behøver ikke nul. Belastningen trækker nulpunktet mod sig, så den mest belastede fase får den laveste spænding. Prøv også at genetablere nullen: så står N stille, uanset hvor du trækker.',
    setup: () => { std(); const b = bld('Hus 2'); b.cable.broken.N = true; b.groups.forEach(g => g.apps.forEach(a => { a.on = false; })); return {sel: ['bldg', b.id]}; }},
  {title: 'Manglende nul før hovedtavlen (PEN-brud)',
    text: 'PEN-lederen i stikledningen til Hus 1 (TN-C-S) er afbrudt. Hvilken spænding får PE i Hus 1? Hvorfor er det farligt, og hvorfor sker det ikke i Hus 2?',
    answer: 'I TN-C-S er PE forbundet med nul i hovedtavlen. Når PEN brydes, flyder nul og PE sammen, og kun jordelektroden holder igen. PE får derfor omkring 70 V mod jord, og alle udsatte dele, fx køleskabets kabinet, bliver spændingsførende. Hverken afbryder eller HPFI reagerer, fordi der ikke løber nogen fejlstrøm. Hus 2 er TT med egen jordelektrode, så dets PE følger ikke nullen.',
    setup: () => { std(); const b = bld('Hus 1'); b.cable.broken.N = true; return {sel: ['bldg', b.id]}; }},
  {title: 'Nul brudt i kablet mellem kabelskabe',
    text: 'Nullen i fordelingskablet til Kabelskab 1 er brudt. Hvor mange installationer bliver ramt, og hvorfor påvirker husene hinanden?',
    answer: 'Alle. Kabelskab 2 forsynes gennem Kabelskab 1, så alle huse og lejligheder efter bruddet mister forbindelsen til transformerens nul. Nullen holdes kun delvist på plads af jordelektroderne i TN-C-S-bygningerne. Derfor bestemmer summen af alle husenes belastning, hvor stjernepunktet ender.',
    setup: () => { std(); const f = app.net[0]; f.cable.broken.N = true; return {sel: ['cable', f.id]}; }},
  {title: 'Harmoniske i nullederen',
    text: 'I kontoret er belastningen fordelt helt ens på de tre faser, men det er næsten kun SMPS og LED. Se på stigeledningen: hvorfor er strømmen i nullederen større end i faserne?',
    answer: 'SMPS og LED trækker strøm i korte pulser, som giver en stor 3. harmonisk (150 Hz). Den 3. harmoniske fra de tre faser er i fase og lægges sammen i nul i stedet for at ophæve hinanden. Derfor kan nullederen få mere strøm end faselederne, selvom belastningen er symmetrisk. Se spektret for nullederen.',
    scenario: 'harm',
    setup: () => { app.load(M.SCENARIOS.harm.make()); const u = unit('Kontor'); return {sel: ['cable', u.id]}; }},
  {title: 'Z loop og valg af afbryder',
    text: 'Gruppen "Garage" i Hus 1 er 80 m 1,5 mm² og beskyttet af en C13. Mål Z loop ved gruppens ende. Er kravet overholdt? Hvad sker der, hvis du skifter til B13?',
    answer: 'Z loop er ca. 2,0 Ω. En C13 skal have 10 × 13 = 130 A for at udløse momentant, så kravet er Z<sub>s</sub> ≤ 230 V / 130 A ≈ 1,77 Ω. Det er ikke overholdt. En B13 udløser momentant ved 65 A (Z<sub>s</sub> ≤ 3,54 Ω), så den overholder kravet. Et større tværsnit er den anden løsning.',
    setup: () => { std(); const g = M.group('Garage', 'L1', ['elpanel'], M.cable('Cu1.5', 80), 'C13'); bld('Hus 1').groups.push(g); return {sel: ['group', g.id], meter: 'ZS'}; }},
  {title: 'Afbrudt PE og jordfejl',
    text: 'PE-lederen til gruppen "Køkken" i Hus 2 er afbrudt. Mål R LOW og HPFI. Simulér derefter en jordfejl. Hvad bliver U<sub>B</sub>, og afbryder noget?',
    answer: 'R LOW viser over 1999 Ω, og HPFI-testen kan ikke udløse, fordi prøvestrømmen ikke kan løbe. Ved en jordfejl kommer kabinettet op på ca. 230 V, men der løber ingen fejlstrøm, så hverken afbryder eller HPFI reagerer. Fejlen er livsfarlig og bliver kun fundet ved måling.',
    setup: () => { std(); const g = grp(bld('Hus 2'), 'Køkken'); g.cable.broken.PE = true; return {sel: ['group', g.id], meter: 'RLOW'}; }},
  {title: 'Nul–PE-fejl får HPFI til at udløse',
    text: 'Der er en fejl mellem nul og PE i gruppen "Stue" i Hus 1. Hvorfor udløser HPFI, selvom der ikke er forbindelse mellem fase og jord? Prøv at slukke apparaterne i gruppen og slå HPFI til igen.',
    answer: 'En del af strømmen i nullen løber tilbage gennem PE. HPFI ser en forskel mellem det, der går ud i fasen, og det, der kommer tilbage i nullen, og udløser. Uden belastning på gruppen løber der ingen nulstrøm, og så bliver HPFI inde. Fejlen findes med R ISO mellem L+N og PE.',
    setup: () => { std(); const b = bld('Hus 1'), g = grp(b, 'Stue'); g.fault = {pair: 'N-PE', R: 0.1}; return {sel: ['bldg', b.id]}; }},
  {title: 'Find isolationsfejlen',
    text: 'En af grupperne i Lejlighed 1 har en isolationsfejl på 300 kΩ. Der udløser ikke noget. Find gruppen med R ISO-målingen.',
    answer: 'Mål først på undertavlen: R ISO er under 1 MΩ. Mål derefter på grupperne én ad gangen. Gruppen med fejlen (Soveværelse) viser ca. 0,3 MΩ, og de andre viser over 999 MΩ. Kravet er mindst 1,0 MΩ ved 500 V DC.',
    setup: () => { std(); const u = unit('Lejlighed 1'); grp(u, 'Soveværelse').fault = {pair: 'L-PE', R: 3e5}; return {sel: ['unit', u.id], meter: 'RISO'}; }},
  {title: 'Jordelektrode i TT',
    text: 'Jordelektroden i Hus 2 (TT) er blevet dårlig, så R<sub>E</sub> er 2000 Ω. Mål HPFI. Er kravet til U<sub>c</sub> overholdt? Hvad sker der, hvis jordledningen afbrydes helt?',
    answer: 'U<sub>c</sub> = 30 mA × 2000 Ω = 60 V, som er over 50 V. Kravet er R<sub>E</sub> · I<sub>ΔN</sub> ≤ 50 V, altså højst ca. 1667 Ω ved 30 mA. Med afbrudt jordledning har PE ingen forbindelse til jord. HPFI-testen kan ikke udløse, og en jordfejl giver fuld fasespænding på kabinettet, uden at noget afbryder.',
    setup: () => { std(); const b = bld('Hus 2'); b.RA = 2000; return {sel: ['bldg', b.id], meter: 'RCD'}; }},
  {title: 'Overbelastning af en gruppe',
    text: 'Der sættes en ovn på 2500 W i gruppen "Køkken" i Hus 1, hvor der i forvejen er køleskab, elkedel og mikrobølgeovn. Hvad sker der, og hvor lang tid går der?',
    answer: 'Strømmen bliver ca. 24 A på en B13, altså knap 2 × I<sub>n</sub>. Det er i det termiske område, så afbryderen udløser ikke med det samme, men efter ca. 20–25 s med den forenklede kurve. Se hændelsesloggen og punktet på tid-strøm-kurven.',
    setup: () => { std(); const g = grp(bld('Hus 1'), 'Køkken'); g.apps.push(M.app('ovn')); return {sel: ['group', g.id]}; }},
  {title: 'Lækstrømme får HPFI til at udløse',
    text: 'I Hus 2 er alle de store apparater lagt på L1 under samme HPFI. Mål lækstrømmen på hovedtavlen. Indsæt derefter en fugtfejl på 15 kΩ fase–PE i gruppen "Varmtvand". Hvorfor udløser HPFI\'en, når ingen af de to strømme alene er over udløsestrømmen?',
    answer: 'Lækstrømmen fra apparaterne er ca. 8 mA, lige under anbefalingen på højst 30 % af I<sub>ΔN</sub> (9 mA). Fugtfejlen giver alene ca. 15 mA. HPFI\'en ser summen af alle fejlstrømme på samme fase, ca. 22 mA, og det er over dens udløsestrøm. Løsningen er at fordele grupperne på flere HPFI\'er og på flere faser, så lækstrømmene ikke samles ét sted.',
    setup: () => {
      std();
      const b = bld('Hus 2');
      b.groups.push(M.group('Tørretumbler', 'L1', ['tumbler'], M.cable('Cu2.5', 10)), M.group('Opvask', 'L1', ['opvask']),
        M.group('Ovn', 'L1', ['ovn'], M.cable('Cu2.5', 10)), M.group('Varmtvand', 'L1', ['vvb'], M.cable('Cu2.5', 10)),
        M.group('Kontor', 'L1', ['pc', 'pc', 'pc', 'pc']), M.group('Værelser', 'L1', ['elpanel', 'elpanel', 'elpanel']));
      return {sel: ['bldg', b.id], meter: 'LEAK'};
    }},
  {title: 'Elbilladeren gør HPFI\'en blind',
    text: 'Hus 2 (TT) har fået en elbillader, der sender 20 mA glat DC ud i PE, og laderens egen DC-overvågning er slået fra. HPFI\'en er type A. Der er samtidig en jordfejl på 10 Ω i gruppen "Køkken". Hvad sker der? Prøv derefter at slå laderens DC-overvågning til, eller at skifte til en HPFI type B.',
    answer: 'Den glatte DC mætter kernen i type A-HPFI\'en, så den bliver blind. Jordfejlen giver ca. 5 A, som er alt for lidt til gruppeafbryderen i TT, så intet afbryder, og PE ligger på ca. 160 V. Med laderens 6 mA DC-overvågning (RDC-DD) stopper laderen efter ca. 1,6 s, og så udløser HPFI\'en. En type B ser glat DC og bliver ikke blind, så den udløser med det samme.',
    setup: () => {
      std();
      const b = bld('Hus 2'), g = M.group('Elbillader', '3', ['elbil'], M.cable('Cu6', 20), 'B16');
      b.groups.push(g);
      Object.assign(g.apps[0], {dc: 20, rdcdd: false});
      grp(b, 'Køkken').fault = {pair: 'L-PE', R: 10};
      return {sel: ['bldg', b.id], meter: 'RCD'};
    }},
  {title: 'Løs forbindelse og AFDD',
    text: 'Gruppen "Køkken 2" i Hus 1 har en løs forbindelse i fasen, mens elkedlen er tændt. Hvor meget effekt afsættes i forbindelsen, og hvorfor reagerer hverken gruppeafbryder eller HPFI? Monter derefter en AFDD på gruppen.',
    answer: 'Strømmen er den normale belastningsstrøm, ca. 8,5 A, så gruppeafbryderen ser ingen overstrøm. Strømmen går ud og tilbage i fase og nul, så HPFI\'en ser heller ingen fejlstrøm. Alligevel afsættes ca. 36 W i den løse klemme, og lysbuen kan starte en brand. En AFDD genkender lysbuens karakteristiske strømform og udløser efter ca. 0,3 s.',
    setup: () => {
      std();
      const g = M.group('Køkken 2', 'L2', ['elkedel']);
      g.fault = {pair: 'ARC-S'};
      bld('Hus 1').groups.push(g);
      return {sel: ['group', g.id]};
    }},
  {title: 'PEN-brud i en stigeledning med lokal nulling',
    text: 'I opgangen fortsætter PEN op i stigeledningerne, og lejlighederne er nullet. PEN er brudt i stigeledningen mellem 1. th og 2. th. Hvilke lejligheder rammes, og hvorfor er det farligt? Skift derefter ejendommen til "PEN deles i hovedtavlen", og sammenlign.',
    answer: 'Bruddet rammer 2. th, 3. th og 4. th, som forsynes gennem stykket med bruddet. De har kun L1 og L2, så apparaterne på de to faser kommer i serie over 400 V. L1 er mest belastet og falder til ca. 100 V, mens L2 stiger til ca. 307 V. Fordi lejlighederne er nullet, er PE forbundet til den afbrudte PEN, så PE og alle kabinetter får ca. 145 V mod jord. Derefter brænder apparaterne på L2 af ét efter ét, og til sidst ligger nul og PE på fuld fasespænding, 230 V mod jord. Med PEN delt i hovedtavlen går PE som en separat leder op i stigeledningen. Spændingerne flytter sig på samme måde, men PE bliver på jordpotentiale.',
    scenario: 'opgang',
    setup: () => { app.load(M.SCENARIOS.opgang.make()); const u = unit('2. th'); u.cable.broken.N = true; return {sel: ['unit', u.id]}; }},
  {title: '400 V-apparater og manglende nul',
    text: 'Nullen er brudt i stigeledningen til 1. th, så 1.–4. th mister nul. Hvorfor virker varmtvandsbeholderen til 400 V i 3. th stadig korrekt, mens apparaterne til 230 V får forkert spænding? Hvad sker der med induktionskogepladen i 1. th? Følg hændelsesloggen.',
    answer: 'Varmtvandsbeholderen er tilsluttet mellem L1 og L2 og bruger ikke nul, så den får stadig ca. 400 V. Apparater til 230 V sidder mellem en fase og nul, og nullen flyder: L1 falder til ca. 136 V, og L2 stiger til ca. 267 V. Induktionskogepladen bruger L1, L2 og nul. Halvdelen på L2 trækker ca. 19 A, og B16-afbryderen udløser termisk efter ca. 2½ minut. Så bliver L2 endnu mindre belastet, spændingen stiger over 300 V, og apparaterne på L2 brænder af ét efter ét.',
    scenario: 'opgang',
    setup: () => {
      app.load(M.SCENARIOS.opgang.make());
      app.net[0].buildings[0].split = 'main';
      const u = unit('1. th'); u.cable.broken.N = true;
      return {sel: ['unit', unit('3. th').id]};
    }},
  {title: 'To faser og strømmen i nul',
    text: '4. th har kun L1 og L2, og stigeledningen til 4. th fører kun den lejligheds strøm. Nu er der ca. 9 A i L1, 1 A i L2 og 8,6 A i nul. Tilføj en elkedel i gruppen "Stue" (L2), så belastningen på de to faser bliver omtrent lige stor. Bliver strømmen i nullen så nul?',
    answer: 'Nej. To strømme, der er 120° forskudt, ophæver ikke hinanden. Er de lige store, er strømmen i nullen lige så stor som strømmen i hver fase, her ca. 9 A i L1, L2 og nul. Nulstrømmen blev altså ikke mindre, selvom belastningen blev fordelt. Strømmen i nul bliver kun nul, når alle tre faser er lige belastet. En lejlighed med to faser belaster derfor altid nullen i stigeledningen.',
    scenario: 'opgang',
    setup: () => { app.load(M.SCENARIOS.opgang.make()); return {sel: ['cable', unit('4. th').id]}; }},
  {title: 'Dårlig samling i stigeledningens nul',
    text: 'I opgangen er der en dårlig samling på 2 Ω på PEN i stigeledningsklemmen til 2. th. Hvor meget effekt afsættes i klemmen? Hvad sker der med spændingerne og med PE i 2.–4. th? Tryk derefter på "Lad samlingen brænde over".',
    answer: 'PEN fører nulstrømmen fra 2., 3. og 4. th, ca. 15 A, så der afsættes ca. 430 W i klemmen, som bliver glødende varm. Spændingsfaldet i samlingen flytter nulpunktet: L1, som er mest belastet, falder til ca. 200 V, og L2 stiger til ca. 240 V. Fordi lejlighederne er nullet, får PE ca. 31 V mod jord. Hverken gruppeafbryder eller HPFI reagerer. Når samlingen brænder over, bliver det et helt PEN-brud: L1 falder til ca. 100 V, L2 stiger til over 300 V, PE får ca. 145 V, og apparaterne på L2 begynder at brænde af.',
    scenario: 'opgang',
    setup: () => { app.load(M.SCENARIOS.opgang.make()); const u = unit('2. th'); u.cable.joint = {cond: 'N', R: 2}; return {sel: ['cable', u.id]}; }},
  {title: 'Område uden nulling',
    text: 'Transformerkredsen er ikke udlagt til nulling, så husene har jordspyd (TT). Mål Z loop ved stikkontakten i køkkenet i "Huset ved vejen". Kan gruppeafbryderen beskytte mod en jordfejl? Hvad beskytter så?',
    answer: 'Fejlsløjfen går gennem jordspyddet (120 Ω), jorden og driftsjorden ved transformeren. Z loop bliver derfor over 100 Ω, og fejlstrømmen kun ca. 2 A, langt fra de 65 A, en B13 skal have. Beskyttelsen sker med HPFI: U<sub>c</sub> = 30 mA × 120 Ω ≈ 3,6 V, som er under 50 V. Bliver jordspyddet dårligere end ca. 1667 Ω, er kravet ikke længere opfyldt.',
    scenario: 'landsby',
    setup: () => { app.load(M.SCENARIOS.landsby.make(), false); const g = grp(bld('Huset ved vejen'), 'Køkken'); return {sel: ['group', g.id], meter: 'ZS'}; }},
  {title: 'Samme hus med og uden nulling',
    text: 'Huset er forsynet fra en transformer, der er udlagt til nulling, og PEN i stikledningen er afbrudt. Aflæs spændingerne og PE i hovedtavlen, og se hvor N og PE ligger i viserdiagrammet. Vælg derefter eksemplet "Hus uden nulling (TT, jordspyd)", og afbryd nullen i stikledningen der. Sammenlign også Ik,min L–PE for gruppen Køkken i de to huse. Hvad er forskellen, og hvad betyder den for beskyttelsen?',
    answer: 'Med nulling bliver spændingerne skæve (ca. 261, 273 og 175 V), og PE får ca. 55 V mod jord, fordi PE er forbundet med N i hovedtavlen. I viserdiagrammet følger den grønne PE-prik med N. Uden nulling bliver spændingerne lige så skæve (ca. 269, 282 og 162 V), men PE bliver på 0 V, fordi PE kun er forbundet til husets egen jordelektrode. Til gengæld er Ik,min L–PE ved Køkken ca. 400 A med nulling, så gruppeafbryderen udløser momentant ved en jordfejl. I TT er den kun ca. 5 A, fordi fejlstrømmen skal gennem jordspyddet og jorden. Det kan gruppeafbryderen ikke se, så her er det HPFI\'en, der skal afbryde.',
    scenario: 'hus',
    setup: () => { app.loadScenario('hus'); const b = bld('Hus 1'); b.cable.broken.N = true; return {sel: ['bldg', b.id]}; }},
  {title: 'Bliver nettet stivere med mere udstyr?',
    text: 'Notér Ik,min og spændingen L1–N i hovedtavlen i Hus 1. Tilføj derefter flere store apparater på L1, fx tre ovne i nye grupper. Hvad sker der med spændingen, og hvad sker der med kortslutningsstrømmen?',
    answer: 'Spændingen falder, fordi belastningsstrømmen giver spændingsfald i transformer og kabler. Med 10 ovne ekstra falder den fra ca. 231 V til ca. 221 V. Kortslutningsstrømmen ændrer sig derimod ikke: Ik,min er stadig ca. 1,7 kA. Den bestemmes af impedansen fra transformeren til fejlstedet, og apparaterne kortsluttes sammen med fejlen. Nettet bliver stivere med en større transformer, et større tværsnit eller kortere kabler, ikke med flere apparater.',
    setup: () => { std(); return {sel: ['bldg', bld('Hus 1').id]}; }},
  {title: 'Brydeevne tæt på transformeren',
    text: 'Huset ligger tæt på transformeren: 10 m fordelingskabel og 5 m stikledning. Hvor stor er Ik,max i hovedtavlen? Er gruppeafbrydere med en brydeevne på 6 kA nok? Gør derefter fordelingskablet 150 m langt, og se hvad der sker med Ik,max og Ik,min.',
    answer: 'Ik,max er ca. 13 kA, så afbrydere med en brydeevne på 6 kA er ikke nok. Der skal bruges afbrydere med større brydeevne, eller en forsikring foran, der begrænser strømmen. Med 150 m fordelingskabel stiger impedansen, og Ik,max falder til omkring 5 kA. Ik,min falder tilsvarende, så det langt ude i nettet i stedet er udløsningen, man skal holde øje med.',
    scenario: 'hus',
    setup: () => { app.load(M.SCENARIOS.hus.make(), true); app.net[0].cable.len = 10; const b = bld('Hus 1'); b.cable.len = 5; return {sel: ['bldg', b.id]}; }},
];

function run(i) {
  const t = TASKS[i];
  app.opts.burn = true; app.opts.prot = true;
  $('#instBurn').checked = true; $('#instProt').checked = true;
  const r = t.setup();
  $('#instScenario').value = t.scenario || 'standard';
  app.meter.fn = r.meter || 'U';
  app.sel = {type: r.sel[0], id: r.sel[1]};
  app.recompute();
  app.reveal();
  $('#instSummary').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
}

$('#instTasks').innerHTML = `<h2>Opgaver</h2><p class="hint">Hver opgave stiller simulatoren op med en fejl. Undersøg den med diagrammet og installationstesteren, og se svaret bagefter.</p>
  <ol class="task-list">${TASKS.map((t, i) => `<li><p><b>${t.title}.</b> ${t.text}</p>
    <div class="task-actions"><button type="button" class="ghost" data-itask="${i}">Vis i simulatoren</button>
    <details><summary>Svar</summary><p>${t.answer}</p></details></div></li>`).join('')}</ol>`;
$('#instTasks').addEventListener('click', e => { const b = e.target.closest('[data-itask]'); if (b) run(+b.dataset.itask); });
})();
