/* Service worker — Controle de Plantão (PWA) */
const CACHE = 'plantao-v1';
const ASSETS = [
  './', './index.html', './app.css', './app.js', './manifest.json', './icon.svg',
  './rotacao.js', './store.js', './db.js', './sync.js', './foto.js',
  './telas/calendario.js', './telas/escala.js', './telas/ferias.js', './telas/permuta.js',
  './telas/eventos.js', './telas/banco.js', './telas/meu-cadastro.js',
  './telas/funcionarios.js', './telas/config.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // API do Supabase e config local: sempre rede
  if (url.includes('supabase.co/rest') || url.includes('supabase.co/auth') || url.endsWith('/config.js')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Demais: rede primeiro (pega a versão mais nova), cache como fallback offline
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
