// Service worker della versione di prova: non salva nulla, tutto passa dalla rete.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
