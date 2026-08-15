import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';

// Extend Window interface for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export default function Install() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone
        ) {
            setIsInstalled(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Update UI notify the user they can install the PWA
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        const handleAppInstalled = () => {
            // Log install to analytics
            console.log('INSTALL: Success');
            setIsInstallable(false);
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener(
                'beforeinstallprompt',
                handleBeforeInstallPrompt,
            );
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    return (
        <AuthLayout
            title="Instal Aplikasi"
            description="Tambahkan Kasir Ayam ke layar utama perangkat Anda untuk akses cepat dan fitur offline."
        >
            <Head title="Install App" />

            <div className="flex flex-col items-center justify-center gap-6 py-4 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-kasir-primary/10 p-4">
                    <img
                        src="/pwa-icon-192.png"
                        alt="App Icon"
                        className="h-full w-full object-contain"
                    />
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-kasir-text">
                        Kasir Ayam Potong
                    </h2>
                    <p className="text-sm text-kasir-text-muted">
                        Aplikasi kasir yang bisa diakses secara offline. Instal
                        sekarang untuk pengalaman terbaik.
                    </p>
                </div>

                {isInstalled ? (
                    <div className="w-full rounded-lg border border-kasir-success/20 bg-kasir-success/10 p-4 text-kasir-success-dark">
                        <p className="font-semibold">
                            Aplikasi sudah terinstal!
                        </p>
                        <p className="mt-1 text-sm">
                            Silakan buka aplikasi Kasir Ayam dari layar utama
                            perangkat Anda.
                        </p>
                    </div>
                ) : isInstallable ? (
                    <Button
                        onClick={handleInstallClick}
                        className="w-full bg-kasir-primary text-white hover:bg-kasir-primary-dark"
                        size="lg"
                    >
                        Instal Aplikasi
                    </Button>
                ) : (
                    <div className="w-full rounded-lg border border-kasir-line bg-kasir-surface-alt p-4">
                        <p className="text-sm font-semibold text-kasir-text">
                            Perangkat Anda mungkin tidak mendukung instalasi
                            langsung, atau aplikasi sudah terinstal.
                        </p>
                        <ul className="mt-2 text-left text-xs text-kasir-text-muted">
                            <li className="mb-1">
                                <strong>iOS/Safari:</strong> Tap tombol Share{' '}
                                <span className="inline-block px-1 border rounded bg-white text-black">
                                    ↑
                                </span>{' '}
                                lalu pilih "Add to Home Screen".
                            </li>
                            <li>
                                <strong>Android/Chrome:</strong> Tap menu titik
                                tiga lalu pilih "Install app" atau "Add to Home
                                screen".
                            </li>
                        </ul>
                    </div>
                )}

                <div className="mt-4">
                    <Link
                        href="/"
                        className="text-sm font-medium text-kasir-primary hover:underline"
                    >
                        Kembali ke Halaman Utama
                    </Link>
                </div>
            </div>
        </AuthLayout>
    );
}
