/**
 * Registers the Workbox service worker emitted by vite-plugin-pwa.
 *
 * The worker only ships with a production build, so a bare `npm run dev`
 * session simply skips registration rather than logging a 404 on every load.
 */
export function registerServiceWorker(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    if (import.meta.env.DEV) {
        return;
    }

    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/build/sw.js', { scope: '/' });
    });
}
