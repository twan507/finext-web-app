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
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip non-HTTP(S) requests (e.g., chrome-extension://)
    if (!event.request.url.startsWith('http')) return;

    // *** CRITICAL: Skip SSE/streaming requests entirely ***
    // SSE (Server-Sent Events) requires persistent connections.
    // Intercepting them with respondWith() breaks the stream.
    const url = new URL(event.request.url);
    if (url.pathname.includes('/sse/') || url.pathname.includes('/stream')) {
        return; // Let the browser handle SSE natively
    }

    // Skip requests that explicitly accept event-stream (SSE)
    const acceptHeader = event.request.headers.get('Accept') || '';
    if (acceptHeader.includes('text/event-stream')) {
        return; // Let the browser handle SSE natively
    }

    // Skip API requests entirely — don't cache or intercept them
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Skip Next.js RSC (React Server Component) requests
    if (url.searchParams.has('_rsc') || url.pathname.includes('_rsc')) {
        return;
    }

    // For remaining requests (static assets, pages), use network-first
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request);
            })
    );
});
