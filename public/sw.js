/**
 * Service Worker: Distribuidora Coronado - Sistema de Control Administrativo y Financiero
 * Estrategia: Network-First con fallback a caché para recursos estáticos y UI Shell.
 * Los datos financieros y transaccionales siempre priorizan la red en tiempo real.
 */

const CACHE_NAME = 'coronado-pwa-v1';

// Recursos estáticos esenciales a pre-cachear durante la instalación
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/css/custom.css',
  '/js/main.js',
  '/js/pwa.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/icon.svg'
];

// Pantalla de contingencia cuando no hay conexión y se solicita un documento HTML
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="es" class="h-full bg-slate-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin Conexión | Distribuidora Coronado</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 1.25rem; max-width: 440px; width: 100%; padding: 2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; }
    .badge { display: inline-flex; align-items: center; justify-content: center; width: 3.5rem; height: 3.5rem; border-radius: 1rem; background: #0f172a; color: white; font-size: 1.5rem; font-weight: bold; margin-bottom: 1.25rem; }
    h1 { font-size: 1.25rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.025em; }
    p { font-size: 0.875rem; color: #64748b; line-height: 1.5; margin: 0 0 1.5rem 0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 3rem; background: #0f172a; color: white; border: none; border-radius: 0.75rem; font-weight: 700; font-size: 0.875rem; cursor: pointer; text-decoration: none; }
    .btn:hover { background: #1e293b; }
    .tag { font-size: 0.75rem; color: #94a3b8; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">C</div>
    <h1>Sin Conexión a Internet</h1>
    <p>
      Al tratarse de una plataforma administrativa y contable en tiempo real, se requiere conexión activa para cotizar, liquidar ventas y consultar saldos financieros.
    </p>
    <button class="btn" onclick="window.location.reload()">Reintentar Conexión</button>
    <div class="tag">Distribuidora Coronado • Modo Seguro PWA</div>
  </div>
</body>
</html>`;

// 1. EVENTO INSTALL: Pre-cacheo de assets de interfaz
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW Install Warning]:', err);
        return self.skipWaiting();
      })
  );
});

// 2. EVENTO ACTIVATE: Limpieza de versiones obsoletas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché obsoleta:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. EVENTO FETCH: Estrategia Network-First con fallback a Caché
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo procesar peticiones HTTP/HTTPS con método GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Excluir esquemas de extensiones u orígenes no controlados
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Si la respuesta es válida, cachear recursos estáticos identificados
        if (networkResponse && networkResponse.status === 200) {
          const isStatic = 
            url.pathname.startsWith('/css/') ||
            url.pathname.startsWith('/js/') ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.svg') ||
            url.pathname === '/manifest.json' ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com') ||
            url.hostname.includes('cdn.tailwindcss.com');

          if (isStatic) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback cuando la red no está disponible (Offline)
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si es una petición de navegación HTML, mostrar la pantalla de contingencia offline
        const isHtmlNavigation = 
          request.mode === 'navigate' ||
          (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

        if (isHtmlNavigation) {
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        // Respuesta genérica de error para otros recursos
        return new Response('Recurso no disponible en modo desconectado', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
