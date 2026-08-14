import { Head, Link } from '@inertiajs/react';
import {
    KasirCard,
    KasirEmpty,
    KasirPage,
} from '@/components/kasir/kasir-page';
import { rupiah, tanggalPanjang } from '@/lib/kasir/format';
import { cn } from '@/lib/utils';
import kasir from '@/routes/kasir';

type SesiRingkas = {
    id: string;
    tanggal: string;
    status: 'buka' | 'ditutup';
    dibuka_oleh: string;
    ditutup_oleh: string | null;
    jumlah_transaksi: number;
    total_penjualan: number;
};

export default function Riwayat({ sesi }: { sesi: SesiRingkas[] }) {
    return (
        <KasirPage
            title="Riwayat Laporan Harian"
            description="Laporan diambil dari server, jadi halaman ini butuh koneksi."
        >
            <Head title="Riwayat Laporan" />

            <KasirCard>
                {sesi.length === 0 ? (
                    <KasirEmpty>
                        Belum ada sesi tersimpan di server. Sesi muncul di sini
                        setelah data perangkat tersinkron.
                    </KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {sesi.map((row) => (
                            <li key={row.id}>
                                <Link
                                    href={kasir.laporan(row.id)}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-kasir-surface-alt"
                                >
                                    <span className="font-semibold text-kasir-primary-dark">
                                        {tanggalPanjang(row.tanggal)}
                                    </span>
                                    <span
                                        className={cn(
                                            'rounded-md px-2 py-0.5 text-xs font-semibold',
                                            row.status === 'ditutup'
                                                ? 'bg-kasir-primary-soft text-kasir-primary-dark'
                                                : 'bg-kasir-success text-white',
                                        )}
                                    >
                                        {row.status === 'ditutup'
                                            ? 'Ditutup'
                                            : 'Buka'}
                                    </span>
                                    <span className="text-sm text-kasir-text-muted">
                                        {row.jumlah_transaksi} transaksi
                                    </span>
                                    <span className="tabular ml-auto text-base">
                                        {rupiah(row.total_penjualan)}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </KasirCard>
        </KasirPage>
    );
}

Riwayat.layout = {
    breadcrumbs: [{ title: 'Riwayat Laporan', href: kasir.riwayat() }],
};
