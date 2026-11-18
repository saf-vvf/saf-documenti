// Service worker di SAFe – Supporto Operatore: rende l'app utilizzabile senza rete.
const SHELL_CACHE = 'saf-shell-v7';
const PDF_CACHE = 'saf-pdf';
const SHELL = [
  './', 'index.html', 'viewer.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
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
  // Pagine dell'app: prima la rete (versione aggiornata), la memoria solo se si e' senza rete
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.webmanifest')) {
    e.respondWith(caches.open(SHELL_CACHE).then(async c => {
      try {
        const res = await fetch(req, {cache: 'no-cache'});
        if (res.ok) c.put(url.origin + url.pathname, res.clone());
        return res;
      } catch (err) {
        return (await c.match(url.origin + url.pathname)) || (await c.match(req, {ignoreSearch: true})) || (await c.match('index.html'));
      }
    }));
    return;
  }
  // Librerie e icone: dalla memoria, aggiornate in background
  e.respondWith(caches.open(SHELL_CACHE).then(async c => {
    const hit = await c.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'cacheAll') return;
  const files = e.data.files || [];
  const client = e.source;
  e.waitUntil((async () => {
    const c = await caches.open(PDF_CACHE);
    let done = 0, failed = 0;
    for (const f of files) {
      const u = new URL(f, self.registration.scope).href;
      try {
        if (!(await c.match(u))) {
          const res = await fetch(u);
          if (res.ok) await c.put(u, res); else failed++;
        }
      } catch (err) { failed++; }
      done++;
      client && client.postMessage({type: 'progress', done, total: files.length, failed});
    }
  })());
});
