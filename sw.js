/* Service worker: gør værktøjet installerbart og brugbart uden net.
   Med forbindelse hentes filerne altid fra nettet, så en ny version slår igennem med det samme. Uden forbindelse,
   eller hvis nettet er for langsomt, bruges den seneste kopi. Skrifttyperne ændrer sig aldrig og hentes fra kopien. */
const CACHE = 'trefase-v1';
const FILES = ['./', 'index.html', 'install.css', 'install-model.js', 'install-charts.js', 'install-view.js', 'install-inspector.js',
  'install-tasks.js', 'install-docs.js', 'oscilloskop.webp', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (req, res) => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
const fallback = req => caches.match(req, {ignoreSearch: true}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res))));
    return;
  }
  if (url.origin !== location.origin && url.hostname !== 'fonts.googleapis.com') return;
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = p => { if (!done) { done = true; resolve(p); } };
    // Svarer nettet ikke inden for 4 s, bruges kopien. Svaret fra nettet gemmes stadig, når det kommer.
    const timer = setTimeout(() => fallback(req).then(hit => { if (hit && hit.type !== 'error') finish(hit); }), 4000);
    fetch(req).then(res => { clearTimeout(timer); finish(save(req, res)); })
      .catch(() => { clearTimeout(timer); finish(fallback(req)); });
  }));
});
