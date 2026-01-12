const CACHE_NAME = 'digianchorz-v1';
const ASSETS = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js'
];

// Install Event
self.addEventListener('install', (e) => {
    // console.log('[Service Worker] Installed');
});

// Activate Event
self.addEventListener('activate', (e) => {
    // console.log('[Service Worker] Activated');
});

// Fetch Event - Basic Network First Strategy
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
