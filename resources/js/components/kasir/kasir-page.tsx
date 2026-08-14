import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import kasir from '@/routes/kasir';

/**
 * Shared frame for every cashier screen.
 *
 * Locks the page to the blue/white palette regardless of the app's light/dark
 * setting: the stall is often in direct sun and the cashier should never have
 * the price grid change brightness between screens mid-shift.
 */
export function KasirPage({
    title,
    description,
    action,
    children,
    className,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'min-h-full bg-kasir-surface-alt p-4 text-kasir-text',
                className,
            )}
        >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-kasir-primary-dark">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-0.5 text-sm text-kasir-text-muted">
                                {description}
                            </p>
                        )}
                    </div>
                    {action}
                </div>

                {children}
            </div>
        </div>
    );
}

/** A plain white card with a hairline border — no drop shadows, by design. */
export function KasirCard({
    title,
    children,
    className,
}: {
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'rounded-xl border border-kasir-line bg-kasir-surface p-4',
                className,
            )}
        >
            {title && (
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-kasir-text-muted uppercase">
                    {title}
                </h2>
            )}
            {children}
        </section>
    );
}

/**
 * Shown on any screen that needs an open session before it can do anything.
 */
export function SesiBelumDibuka({ children }: { children?: ReactNode }) {
    return (
        <KasirCard className="text-center">
            <p className="text-base font-semibold text-kasir-text">
                Belum ada sesi yang dibuka hari ini.
            </p>
            <p className="mt-1 text-sm text-kasir-text-muted">
                Buka sesi harian dulu untuk mulai mencatat stok, harga, dan
                transaksi.
            </p>
            <Button
                asChild
                className="mt-4 h-11 bg-kasir-primary px-6 text-base font-semibold hover:bg-kasir-primary-dark"
            >
                <Link href={kasir.sesi()}>Buka Sesi Hari Ini</Link>
            </Button>
            {children}
        </KasirCard>
    );
}

export function KasirEmpty({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-kasir-line px-4 py-6 text-center text-sm text-kasir-text-muted">
            {children}
        </p>
    );
}
