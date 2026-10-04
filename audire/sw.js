// Service worker do Audire: guarda o app para funcionar offline
// e recebe áudios enviados pelo "Compartilhar" do Android (WhatsApp, gravador, arquivos).
// Ao atualizar o index.html, aumente a versão abaixo para o celular baixar a nova versão.
const CACHE = 'audire-v4';
const SHARE = 'audire-share';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('audire-v') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Áudio compartilhado: guarda os arquivos e abre o app, que os anexa
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('audio').filter(f => f && typeof f !== 'string');
        const cache = await caches.open(SHARE);
        let i = 0;
        for (const f of files) {
          await cache.put(new Request('./shared/' + Date.now() + '-' + (i++)), new Response(f, {
            headers: { 'content-type': f.type || '', 'x-name': encodeURIComponent(f.name || 'audio') }
          }));
        }
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Rede primeiro (pega atualizações quando online), cache como reserva (offline)
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
