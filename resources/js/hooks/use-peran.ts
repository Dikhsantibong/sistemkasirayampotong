import { usePage } from '@inertiajs/react';
import type { PeranPengguna } from '@/offline/types';

/**
 * The signed-in user's role.
 *
 * Used to hide what a kasir cannot do. This is convenience only, never
 * security — every restricted write is refused server-side in
 * `SyncPermissions`, and the owner-only pages are behind the `pemilik`
 * middleware.
 */
export function usePeran(): {
    peran: PeranPengguna;
    isPemilik: boolean;
    nama: string;
} {
    const { auth } = usePage().props;
    const peran = (auth.user?.role ?? 'kasir') as PeranPengguna;

    return {
        peran,
        isPemilik: peran === 'pemilik',
        nama: auth.user?.name ?? 'Kasir',
    };
}
