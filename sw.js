// Service worker di SAF Supporto Operatore: rende l'app utilizzabile senza rete.
const SHELL_CACHE = 'saf-shell-v2';
const PDF_CACHE = 'saf-pdf';
const SHELL = [
  './', 'index.html', 'viewer.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== SHELL_CACHE && k !== PDF_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.pdf')) {
    // PDF: dalla memoria se gia' scaricato, altrimenti dalla rete e poi salvato
    e.respondWith(caches.open(PDF_CACHE).then(async c => {
      const hit = await c.match(url.href, {ignoreSearch: true});
      if (hit) return hit;
      const res = await fetch(url.href);
      if (res.ok && res.status === 200) c.put(url.href, res.clone());
      return res;
    }));
    return;
  }
  // App e librerie: risposta immediata dalla memoria, aggiornamento in background
  e.respondWith(caches.open(SHELL_CACHE).then(async c => {
