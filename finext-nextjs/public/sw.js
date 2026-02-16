// Finext Service Worker v2
// Minimal service worker for PWA installability.
// Chrome requires a service worker with a fetch event listener
// to trigger the install prompt (beforeinstallprompt event).
//
// IMPORTANT: This SW intentionally does NOT call event.respondWith()
// so it never intercepts any requests. All requests pass through
// to the network natively. This avoids breaking SSE streams,
// API calls, and Next.js RSC requests.

const CACHE_NAME = 'finext-v2';

// Install event
self.addEventListener('install', () => {
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.map((name) => caches.delete(name)))
        )
    );
    self.clients.claim();
});

// Fetch event — PASSIVE handler (never intercepts)
// The mere presence of this listener satisfies Chrome's
// PWA installability requirement. By not calling
// event.respondWith(), all requests go to the network normally.
self.addEventListener('fetch', () => {
    // Intentionally empty — do not call event.respondWith()
    return;
});
