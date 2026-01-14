const CACHE_NAME = 'digianchorz-v1';
const ASSETS = [
    '/static/css/style.css',
    '/static/images/company_icon.jpg',
    '/static/images/logo_final.jpg'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching files');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Fetch Event - Network First, Fallback to Cache
self.addEventListener('fetch', (e) => {
    // Only handle GET requests
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request)
            .then((res) => {
                // Optional: Dynamic caching of successful network responses
                // const resClone = res.clone();
                // caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
                return res;
            })
            .catch(() => {
                // If offline, try cache
                return caches.match(e.request).then((cachedRes) => {
                    if (cachedRes) return cachedRes;
                    // Optional: Return a specific offline.html page here if navigation
                    return new Response("You are offline.", { status: 503, headers: { 'Content-Type': 'text/plain' } });
                });
            })
    );
});
