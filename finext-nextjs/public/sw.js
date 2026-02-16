// Finext Service Worker
// Minimal service worker with fetch handler for PWA installability.
// Chrome requires a service worker with a fetch handler to trigger
// the automatic install prompt (beforeinstallprompt event).

const CACHE_NAME = 'finext-v1';

// Install event - service worker is being installed
self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - service worker takes control
self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Clean up old caches
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event - network-first strategy (pass-through)
// This handler is required for Chrome to show the install prompt.
// It uses a network-first approach: try network, fall back to cache if available.
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip non-HTTP(S) requests (e.g., chrome-extension://)
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If we got a valid response, optionally cache it
                if (response.ok && event.request.url.startsWith(self.location.origin)) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        // Only cache same-origin, non-API requests
                        if (!event.request.url.includes('/api/')) {
                            cache.put(event.request, responseClone);
                        }
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request);
            })
    );
});
