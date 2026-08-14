import { Head, Link, router } from '@inertiajs/react';
import {
    BarHarga,
    BarHarian,
    KurvaS,
    StackStatusBayar,
    StackUkuran,
} from '@/components/kasir/charts';
import {
    KasirCard,
    KasirEmpty,
    KasirPage,
} from '@/components/kasir/kasir-page';
import { rupiah, tanggalPanjang } from '@/lib/kasir/format';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import kasir from '@/routes/kasir';

type Statistik = {
    periode: {
        hari: number;
        dari: string | null;
        sampai: string;
        label: string;
    };
    kpi: {
        total_omzet: number;
        total_ekor: number;
        total_tunai: number;
        total_piutang: number;
        total_belum_bayar: number;
        total_uang_keluar: number;
        kas_bersih: number;
        total_ayam_mati: number;
        jumlah_sesi: number;
        hari_berjualan: number;
        rata_omzet_per_hari: number;
        omzet_tertinggi: number;
    };
    harian: {
        tanggal: string;
        omzet: number;
        ekor: number;
        tunai: number;
        piutang: number;
        uang_keluar: number;
        kumulatif: number;
    }[];
    per_harga: {
        harga: number;
        ekor: number;
        total: number;
        jumlah_transaksi: number;
    }[];
    per_ukuran: {
        ukuran: string;
        label: string;
        masuk: number;
        terjual: number;
        mati: number;
        sisa: number;
    }[];
    status_bayar: {
        status: string;
        label: string;
        total: number;
        jumlah: number;
    }[];
    sesi_terakhir: {
        id: string;
        tanggal: string;
        status: string;
        omzet: number;
        ekor: number;
        ditutup_oleh: string | null;
    }[];
};

const LABEL_PERIODE: Record<number, string> = {
    30: '30 hari',
    90: '90 hari',
    365: '1 tahun',
    0: 'Semua',
};

export default function Dashboard({
    statistik,
    periodeTersedia,
}: {
    statistik: Statistik;
    periodeTersedia: number[];
}) {
    const { kpi, harian, periode } = statistik;
    const belumAdaData = kpi.jumlah_sesi === 0;

    return (
        <KasirPage
            title="Dashboard"
            description={`${periode.label} · ${kpi.jumlah_sesi} sesi tercatat`}
            action={
                <div className="flex flex-wrap gap-1 rounded-lg border border-kasir-line bg-kasir-surface p-1">
                    {periodeTersedia.map((hari) => (
                        <button
                            key={hari}
                            type="button"
                            onClick={() =>
                                router.get(
                                    dashboard().url,
                                    { hari },
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                    },
                                )
                            }
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                                periode.hari === hari
                                    ? 'bg-kasir-primary text-white'
                                    : 'text-kasir-text-muted hover:bg-kasir-primary-soft',
                            )}
                        >
                            {LABEL_PERIODE[hari] ?? `${hari} hari`}
                        </button>
                    ))}
                </div>
            }
        >
            <Head title="Dashboard" />

            {belumAdaData ? (
                <KasirCard className="text-center">
                    <p className="text-base font-semibold text-kasir-text">
                        Belum ada sesi tercatat di server.
                    </p>
                    <p className="mt-1 text-sm text-kasir-text-muted">
                        Dashboard terisi setelah sesi harian dibuka dan datanya
                        tersinkron.
                    </p>
                </KasirCard>
            ) : (
                <>
                    {/* Hero figure: the one number the page leads with. */}
                    <KasirCard>
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-sm text-kasir-text-muted">
                                    Total omzet — {periode.label}
                                </p>
                                <p className="tabular mt-1 text-4xl leading-none text-kasir-primary-dark sm:text-5xl">
                                    {rupiah(kpi.total_omzet)}
                                </p>
                                <p className="mt-2 text-sm text-kasir-text-muted">
                                    {kpi.total_ekor.toLocaleString('id-ID')}{' '}
                                    ekor terjual dalam {kpi.hari_berjualan} hari
                                    berjualan
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-kasir-text-muted">
                                    Rata-rata per hari
                                </p>
                                <p className="tabular text-2xl text-kasir-text">
                                    {rupiah(kpi.rata_omzet_per_hari)}
                                </p>
                                <p className="mt-1 text-xs text-kasir-text-muted">
                                    tertinggi {rupiah(kpi.omzet_tertinggi)}
                                </p>
                            </div>
                        </div>
                    </KasirCard>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Kpi
                            label="Tunai diterima"
                            value={rupiah(kpi.total_tunai)}
                            tone="success"
                        />
                        <Kpi
                            label="Uang keluar"
                            value={rupiah(kpi.total_uang_keluar)}
                            tone="danger"
                        />
                        <Kpi
                            label="Kas bersih"
                            value={rupiah(kpi.kas_bersih)}
                        />
                        <Kpi
                            label="Piutang belum tertagih"
                            value={rupiah(kpi.total_piutang)}
                            tone="warning"
                        />
                        <Kpi
                            label="Belum bayar"
                            value={rupiah(kpi.total_belum_bayar)}
                            tone="danger"
                        />
                        <Kpi
                            label="Ayam mati"
                            value={`${kpi.total_ayam_mati} ekor`}
                            tone="danger"
                        />
                        <Kpi
                            label="Sesi tercatat"
                            value={String(kpi.jumlah_sesi)}
                        />
                        <Kpi
                            label="Ekor terjual"
                            value={kpi.total_ekor.toLocaleString('id-ID')}
                        />
                    </div>

                    <KasirCard title="Kurva S — Omzet Kumulatif">
                        <KurvaS data={harian} />
                    </KasirCard>

                    <KasirCard title="Omzet Harian">
                        <BarHarian data={harian} />
                    </KasirCard>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <KasirCard title="Penjualan Per Tingkatan Harga">
                            <BarHarga data={statistik.per_harga} />
                        </KasirCard>

                        <KasirCard title="Komposisi Status Bayar">
                            <StackStatusBayar data={statistik.status_bayar} />
                        </KasirCard>
                    </div>

                    <KasirCard title="Perjalanan Stok Per Ukuran">
                        <StackUkuran data={statistik.per_ukuran} />
                    </KasirCard>

                    <KasirCard title="Sesi Terakhir">
                        {statistik.sesi_terakhir.length === 0 ? (
                            <KasirEmpty>Belum ada sesi.</KasirEmpty>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-kasir-line text-left text-xs text-kasir-text-muted uppercase">
                                            <th className="py-2 font-semibold">
                                                Tanggal
                                            </th>
                                            <th className="py-2 font-semibold">
                                                Status
                                            </th>
                                            <th className="py-2 text-right font-semibold">
                                                Ekor
                                            </th>
                                            <th className="py-2 text-right font-semibold">
                                                Omzet
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-kasir-line">
                                        {statistik.sesi_terakhir.map((sesi) => (
                                            <tr key={sesi.id}>
                                                <td className="py-2">
                                                    <Link
                                                        href={kasir.laporan(
                                                            sesi.id,
                                                        )}
                                                        className="font-semibold text-kasir-primary hover:underline"
                                                    >
                                                        {tanggalPanjang(
                                                            sesi.tanggal,
                                                        )}
                                                    </Link>
                                                </td>
                                                <td className="py-2">
                                                    <span
                                                        className={cn(
                                                            'rounded-md px-2 py-0.5 text-xs font-semibold',
                                                            sesi.status ===
                                                                'ditutup'
                                                                ? 'bg-kasir-primary-soft text-kasir-primary-dark'
                                                                : 'bg-kasir-success text-white',
                                                        )}
                                                    >
                                                        {sesi.status ===
                                                        'ditutup'
                                                            ? 'Ditutup'
                                                            : 'Buka'}
                                                    </span>
                                                </td>
                                                <td className="tabular py-2 text-right">
                                                    {sesi.ekor}
                                                </td>
                                                <td className="tabular py-2 text-right">
                                                    {rupiah(sesi.omzet)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </KasirCard>
                </>
            )}
        </KasirPage>
    );
}

function Kpi({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: 'success' | 'warning' | 'danger';
}) {
    return (
        <KasirCard>
            <p className="text-sm text-kasir-text-muted">{label}</p>
            <p
                className={cn(
                    'tabular mt-1 text-xl',
                    tone === 'success' && 'text-kasir-success',
                    tone === 'warning' && 'text-kasir-warning',
                    tone === 'danger' && 'text-kasir-danger',
                    !tone && 'text-kasir-text',
                )}
            >
                {value}
            </p>
        </KasirCard>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
