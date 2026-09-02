/* SmileFlow — Service Worker v174 */
const CACHE = 'smileflow-v174';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página puede pedir activación inmediata de la versión nueva
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Solo tocar peticiones de NUESTRO dominio; Google/CDNs van directo al navegador
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Documento principal (index.html): caché primero para que abra AL INSTANTE sin
  // gastar datos en cada visita. En segundo plano se revalida con el servidor usando
  // petición condicional (ETag) — si no cambió nada, el servidor responde "304 sin
  // cambios" y casi no pesa; si sí cambió, se baja completo y se actualiza el caché
  // para la próxima vez. La detección de versión nueva y el recargo automático siguen
  // corriendo aparte (ver updatefound en index.html) — esto no lo toca.
  const esDocumentoPrincipal = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (esDocumentoPrincipal) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const revalidar = fetch(e.request, { cache: 'no-cache' }).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
          return res;
        }).catch(() => cached || Response.error());
        return cached || revalidar;
      })
    );
    return;
  }

  // Resto de archivos (manifest, íconos): red primero como antes, son livianos.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(() =>
      caches.match(e.request).then(r => {
        if (r) return r;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
    )
  );
});
