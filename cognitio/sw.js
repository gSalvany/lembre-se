// Service worker do Cognitio: guarda o app para funcionar offline.
// Ao atualizar o index.html, aumente a versão abaixo (v2 -> v3) para o celular baixar a nova versão.
const CACHE = 'cognitio-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
// Leitor de PDF (pdf.js), baixado na primeira vez que você abre um PDF e guardado para uso offline.
const PDFJS_HOST = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('cognitio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // pdf.js: cache primeiro (não muda dentro da mesma versão)
  if (url.startsWith(PDFJS_HOST)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  if (new URL(url).origin !== location.origin) return;
  // Rede primeiro (pega atualizações quando online), cache como reserva (offline).
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
