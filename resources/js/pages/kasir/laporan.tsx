import { Head } from '@inertiajs/react';
import { FileDown } from 'lucide-react';
import {
    KasirCard,
    KasirEmpty,
    KasirPage,
} from '@/components/kasir/kasir-page';
import { Button } from '@/components/ui/button';
import { jam, rupiah, tanggalPanjang } from '@/lib/kasir/format';
import { cn } from '@/lib/utils';
import kasir from '@/routes/kasir';

type Laporan = {
    sesi: {
        id: string;
        tanggal: string;
        status: 'buka' | 'ditutup';
        dibuka_oleh: string;
        ditutup_oleh: string | null;
        catatan_penutupan: string | null;
    };
    total_penjualan: number;
    total_ekor_terjual: number;
    per_tingkatan_harga: {
        price_tier_id: string;
        harga: number;
        jumlah_ekor: number;
        jumlah_transaksi: number;
        total: number;
    }[];
    per_ukuran: {
        ukuran: string;
        label: string;
        masuk: number;
        terjual: number;
        mati: number;
        sisa: number;
    }[];
    total_tunai: number;
    total_piutang: number;
    total_belum_bayar: number;
    total_uang_keluar: number;
    total_ayam_mati: number;
    kas_seharusnya: number;
    rekonsiliasi: {
        uang_tunai_fisik: number;
        uang_catatan_piutang: number;
        uang_lebih_kurang: number;
        lain_lain: number | null;
        catatan: string | null;
    } | null;
    lembur: {
        nama_karyawan: string;
        jam_mulai: string;
        jam_selesai: string;
        keterangan: string | null;
    }[];
    uang_keluar: {
        jumlah: number;
        keterangan: string;
        created_at: string | null;
    }[];
    piutang: {
        nama_pembeli: string | null;
        jumlah_ekor: number;
        subtotal: number;
        created_at: string | null;
    }[];
};

export default function LaporanHarian({ laporan }: { laporan: Laporan }) {
    return (
        <KasirPage
            title="Laporan Harian"
            description={tanggalPanjang(laporan.sesi.tanggal)}
            action={
                <Button
                    type="button"
                    onClick={() => window.print()}
                    variant="outline"
                    className="h-11 gap-2 border-kasir-primary font-semibold text-kasir-primary hover:bg-kasir-primary-soft print:hidden"
                >
                    <FileDown className="size-4" />
                    Export PDF
                </Button>
            }
        >
            <Head title={`Laporan ${laporan.sesi.tanggal}`} />

            <KasirCard>
                <p className="text-sm text-kasir-text-muted">
                    Dibuka oleh {laporan.sesi.dibuka_oleh}
                    {laporan.sesi.ditutup_oleh &&
                        ` · ditutup oleh ${laporan.sesi.ditutup_oleh}`}
                    {laporan.sesi.status === 'buka' && ' · sesi masih berjalan'}
                </p>
                {laporan.sesi.catatan_penutupan && (
                    <p className="mt-2 text-sm">
                        {laporan.sesi.catatan_penutupan}
                    </p>
                )}
            </KasirCard>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Angka
                    label="Total penjualan"
                    value={rupiah(laporan.total_penjualan)}
                />
                <Angka
                    label="Ekor terjual"
                    value={`${laporan.total_ekor_terjual} ekor`}
                />
                <Angka
                    label="Tunai diterima"
                    value={rupiah(laporan.total_tunai)}
                    tone="success"
                />
                <Angka
                    label="Uang keluar"
                    value={rupiah(laporan.total_uang_keluar)}
                    tone="danger"
                />
                <Angka
                    label="Piutang / utang"
                    value={rupiah(laporan.total_piutang)}
                    tone="warning"
                />
                <Angka
                    label="Belum bayar"
                    value={rupiah(laporan.total_belum_bayar)}
                    tone="danger"
                />
                <Angka
                    label="Ayam mati"
                    value={`${laporan.total_ayam_mati} ekor`}
                    tone="danger"
                />
                <Angka
                    label="Kas seharusnya"
                    value={rupiah(laporan.kas_seharusnya)}
                />
            </div>

            <KasirCard title="Rincian Per Tingkatan Harga">
                {laporan.per_tingkatan_harga.length === 0 ? (
                    <KasirEmpty>
                        Tidak ada tingkatan harga di sesi ini.
                    </KasirEmpty>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-kasir-line text-left text-xs text-kasir-text-muted uppercase">
                                <th className="py-2 font-semibold">
                                    Harga / ekor
                                </th>
                                <th className="py-2 text-right font-semibold">
                                    Ekor
                                </th>
                                <th className="py-2 text-right font-semibold">
                                    Transaksi
                                </th>
                                <th className="py-2 text-right font-semibold">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-kasir-line">
                            {laporan.per_tingkatan_harga.map((baris) => (
                                <tr key={baris.price_tier_id}>
                                    <td className="tabular py-2">
                                        {rupiah(baris.harga)}
                                    </td>
                                    <td className="tabular py-2 text-right">
                                        {baris.jumlah_ekor}
                                    </td>
                                    <td className="tabular py-2 text-right">
                                        {baris.jumlah_transaksi}
                                    </td>
                                    <td className="tabular py-2 text-right">
                                        {rupiah(baris.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </KasirCard>

            <KasirCard title="Sisa Ayam Per Ukuran">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-kasir-line text-left text-xs text-kasir-text-muted uppercase">
                            <th className="py-2 font-semibold">Ukuran</th>
                            <th className="py-2 text-right font-semibold">
                                Masuk
                            </th>
                            <th className="py-2 text-right font-semibold">
                                Terjual
                            </th>
                            <th className="py-2 text-right font-semibold">
                                Mati
                            </th>
                            <th className="py-2 text-right font-semibold">
                                Sisa
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-kasir-line">
                        {laporan.per_ukuran.map((baris) => (
                            <tr key={baris.ukuran}>
                                <td className="py-2">{baris.label}</td>
                                <td className="tabular py-2 text-right">
                                    {baris.masuk}
                                </td>
                                <td className="tabular py-2 text-right">
                                    {baris.terjual}
                                </td>
                                <td className="tabular py-2 text-right">
                                    {baris.mati}
                                </td>
                                <td
                                    className={cn(
                                        'tabular py-2 text-right',
                                        baris.sisa < 0 && 'text-kasir-danger',
                                    )}
                                >
                                    {baris.sisa}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </KasirCard>

            {laporan.rekonsiliasi && (
                <KasirCard title="Rekonsiliasi Kas">
                    <dl className="space-y-1.5 text-sm">
                        <Baris
                            label="Uang tunai fisik"
                            value={rupiah(
                                laporan.rekonsiliasi.uang_tunai_fisik,
                            )}
                        />
                        <Baris
                            label="Uang catatan / piutang"
                            value={rupiah(
                                laporan.rekonsiliasi.uang_catatan_piutang,
                            )}
                        />
                        <Baris
                            label="Uang lebih / kurang"
                            value={`${laporan.rekonsiliasi.uang_lebih_kurang >= 0 ? '+' : '−'} ${rupiah(Math.abs(laporan.rekonsiliasi.uang_lebih_kurang))}`}
                            tone={
                                laporan.rekonsiliasi.uang_lebih_kurang === 0
                                    ? undefined
                                    : laporan.rekonsiliasi.uang_lebih_kurang > 0
                                      ? 'success'
                                      : 'danger'
                            }
                        />
                        {laporan.rekonsiliasi.lain_lain !== null && (
                            <Baris
                                label="Lain-lain"
                                value={rupiah(laporan.rekonsiliasi.lain_lain)}
                            />
                        )}
                    </dl>
                    {laporan.rekonsiliasi.catatan && (
                        <p className="mt-3 text-sm text-kasir-text-muted">
                            {laporan.rekonsiliasi.catatan}
                        </p>
                    )}
                </KasirCard>
            )}

            {laporan.piutang.length > 0 && (
                <KasirCard title={`Daftar Piutang (${laporan.piutang.length})`}>
                    <ul className="divide-y divide-kasir-line text-sm">
                        {laporan.piutang.map((row, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 py-2"
                            >
                                <span className="font-semibold">
                                    {row.nama_pembeli ?? 'Tanpa nama'}
                                </span>
                                <span className="text-kasir-text-muted">
                                    {row.jumlah_ekor} ekor
                                </span>
                                <span className="tabular ml-auto text-kasir-warning">
                                    {rupiah(row.subtotal)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </KasirCard>
            )}

            {laporan.uang_keluar.length > 0 && (
                <KasirCard
                    title={`Uang Keluar (${laporan.uang_keluar.length})`}
                >
                    <ul className="divide-y divide-kasir-line text-sm">
                        {laporan.uang_keluar.map((row, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 py-2"
                            >
                                {row.created_at && (
                                    <span className="text-xs text-kasir-text-muted">
                                        {jam(row.created_at)}
                                    </span>
                                )}
                                <span>{row.keterangan}</span>
                                <span className="tabular ml-auto text-kasir-danger">
                                    {rupiah(row.jumlah)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </KasirCard>
            )}

            {laporan.lembur.length > 0 && (
                <KasirCard title={`Lembur Karyawan (${laporan.lembur.length})`}>
                    <ul className="divide-y divide-kasir-line text-sm">
                        {laporan.lembur.map((row, index) => (
                            <li key={index} className="flex gap-3 py-2">
                                <span className="font-semibold">
                                    {row.nama_karyawan}
                                </span>
                                <span className="tabular">
                                    {row.jam_mulai.slice(0, 5)} –{' '}
                                    {row.jam_selesai.slice(0, 5)}
                                </span>
                                {row.keterangan && (
                                    <span className="text-kasir-text-muted">
                                        {row.keterangan}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </KasirCard>
            )}
        </KasirPage>
    );
}

function Angka({
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

function Baris({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: 'success' | 'danger';
}) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-kasir-text-muted">{label}</dt>
            <dd
                className={cn(
                    'tabular',
                    tone === 'success' && 'text-kasir-success',
                    tone === 'danger' && 'text-kasir-danger',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

LaporanHarian.layout = {
    breadcrumbs: [
        { title: 'Riwayat Laporan', href: kasir.riwayat() },
        { title: 'Laporan Harian', href: kasir.riwayat() },
    ],
};
