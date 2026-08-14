import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null,
            filename: 'sw.js',
            manifestFilename: 'manifest.webmanifest',
            /*
             * The stall's connection drops constantly, so the shell has to be
             * cached aggressively. Data never comes from the cache — it lives
             * in Dexie and reaches the server through /kasir/sync/*, which is
             * explicitly excluded below.
             */
            workbox: {
                globPatterns: ['**/*.{js,css,woff2,png,svg,ico}'],
                navigateFallback: '/kasir/pos',
                navigateFallbackDenylist: [/^\/kasir\/sync/, /^\/kasir\/riwayat/],
                runtimeCaching: [
                    {
                        urlPattern: /^\/kasir\/(pos|sesi|stok|harga|uang-keluar|ayam-mati|lembur|tutup-sesi|printer)$/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'kasir-shell',
                            networkTimeoutSeconds: 3,
                        },
                    },
                ],
            },
            manifest: {
                name: 'Kasir Ayam Potong',
                short_name: 'Kasir Ayam',
                description:
                    'Kasir penjualan ayam potong harian — bisa dipakai tanpa koneksi internet.',
                lang: 'id',
                start_url: '/kasir/pos',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#ffffff',
                theme_color: '#1d4ed8',
                icons: [
                    {
                        src: '/pwa-icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/pwa-icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/pwa-icon-512-maskable.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
});
