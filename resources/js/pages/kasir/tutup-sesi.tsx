import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    KasirCard,
    KasirEmpty,
    KasirPage,
    SesiBelumDibuka,
} from '@/components/kasir/kasir-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKasirSession } from '@/hooks/use-kasir-session';
import { useSync } from '@/hooks/use-sync';
import { rupiah, tanggalPanjang } from '@/lib/kasir/format';
import { cn } from '@/lib/utils';
import { amend, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import { UKURAN_LABEL } from '@/offline/types';
import kasir from '@/routes/kasir';

export default function TutupSesi() {
    const { auth } = usePage().props;
    const { session, summary, overtimes, loading } = useKasirSession();
    const { pending, online, synchronise } = useSync();

    const [uangTunaiFisik, setUangTunaiFisik] = useState('');
    const [lainLain, setLainLain] = useState('');
    const [catatan, setCatatan] = useState('');
    const [saving, setSaving] = useState(false);

    const kasSeharusnya = summary?.kasSeharusnya ?? 0;
    const fisik = Number(uangTunaiFisik);
    const selisih =
        Number.isFinite(fisik) && uangTunaiFisik !== ''
            ? fisik - kasSeharusnya
            : 0;

    async function tutup() {
        if (!session) {
            return;
        }

        if (uangTunaiFisik.trim() === '' || !Number.isFinite(fisik)) {
            toast.error('Isi hasil hitung uang tunai fisik dulu.');

            return;
        }

        if (
            !window.confirm(
                'Tutup sesi hari ini? Setelah ditutup, layar kasir tidak bisa menerima transaksi baru.',
            )
        ) {
            return;
        }

        setSaving(true);

        try {
            await persist('cash_reconciliations', {
                daily_session_id: session.id,
                uang_tunai_fisik: fisik,
                uang_catatan_piutang: summary?.totalPiutang ?? 0,
                uang_lebih_kurang: selisih,
                lain_lain: lainLain.trim() === '' ? null : Number(lainLain),
                catatan: catatan.trim() === '' ? null : catatan.trim(),
            });

            await amend('daily_sessions', session.id, {
                status: 'ditutup',
                ditutup_oleh: auth.user?.name ?? 'Kasir',
                catatan_penutupan:
                    catatan.trim() === '' ? null : catatan.trim(),
                ditutup_pada: new Date().toISOString(),
            });

            await refreshPendingCount();
            toast.success('Sesi ditutup. Laporan hari ini terkunci.');

            if (online) {
                await synchronise();
            }
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <KasirPage title="Tutup Sesi">
                <Head title="Tutup Sesi" />
                <KasirCard>
                    <div className="h-40 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Tutup Sesi">
                <Head title="Tutup Sesi" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Tutup Sesi & Rekonsiliasi Kas"
            description={tanggalPanjang(session.tanggal)}
        >
            <Head title="Tutup Sesi" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Angka
                    label="Total penjualan"
                    value={rupiah(summary?.totalPenjualan ?? 0)}
                />
                <Angka
                    label="Tunai diterima"
                    value={rupiah(summary?.totalTunai ?? 0)}
                    tone="success"
                />
                <Angka
                    label="Uang catatan (piutang)"
                    value={rupiah(summary?.totalPiutang ?? 0)}
                    tone="warning"
                />
                <Angka
                    label="Uang keluar"
                    value={rupiah(summary?.totalUangKeluar ?? 0)}
                    tone="danger"
                />
            </div>

            <KasirCard title="Rincian Per Tingkatan Harga">
                {(summary?.perTingkatanHarga ?? []).length === 0 ? (
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
                            {(summary?.perTingkatanHarga ?? []).map((baris) => (
                                <tr key={baris.tier.id}>
                                    <td className="tabular py-2">
                                        {rupiah(baris.tier.harga)}
                                    </td>
                                    <td className="tabular py-2 text-right">
                                        {baris.jumlahEkor}
                                    </td>
                                    <td className="tabular py-2 text-right">
                                        {baris.jumlahTransaksi}
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
                        {(summary?.perUkuran ?? []).map((baris) => (
                            <tr key={baris.ukuran}>
                                <td className="py-2">
                                    {UKURAN_LABEL[baris.ukuran]}
                                </td>
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
                <p className="mt-2 text-xs text-kasir-text-muted">
                    Sisa negatif berarti ada transaksi tanpa ukuran atau stok
                    masuk yang belum dicatat.
                </p>
            </KasirCard>

            {overtimes.length > 0 && (
                <KasirCard title={`Lembur Karyawan (${overtimes.length})`}>
                    <ul className="divide-y divide-kasir-line text-sm">
                        {overtimes.map((row) => (
                            <li key={row.id} className="flex gap-3 py-2">
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

            {session.status === 'ditutup' ? (
                <KasirCard className="text-center">
                    <p className="text-base font-semibold text-kasir-success">
                        Sesi ini sudah ditutup oleh{' '}
                        {session.ditutup_oleh ?? 'kasir'}.
                    </p>
                    {pending > 0 && (
                        <p className="mt-1 text-sm text-kasir-warning">
                            Masih ada {pending} data menunggu sinkronisasi ke
                            server.
                        </p>
                    )}
                    <Button asChild variant="outline" className="mt-4 h-11">
                        <Link href={kasir.riwayat()}>
                            Lihat Riwayat Laporan
                        </Link>
                    </Button>
                </KasirCard>
            ) : (
                <KasirCard title="Rekonsiliasi Kas">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <Label htmlFor="uang_tunai_fisik">
                                Uang tunai fisik (hasil hitung)
                            </Label>
                            <Input
                                id="uang_tunai_fisik"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={uangTunaiFisik}
                                onChange={(event) =>
                                    setUangTunaiFisik(event.target.value)
                                }
                                className="tabular mt-1 h-12 text-lg"
                            />
                        </div>

                        <div>
                            <Label htmlFor="lain_lain">
                                Lain-lain (opsional, boleh negatif)
                            </Label>
                            <Input
                                id="lain_lain"
                                type="number"
                                inputMode="numeric"
                                value={lainLain}
                                onChange={(event) =>
                                    setLainLain(event.target.value)
                                }
                                className="tabular mt-1 h-12 text-lg"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label htmlFor="catatan">
                                Catatan penutupan (opsional)
                            </Label>
                            <Input
                                id="catatan"
                                value={catatan}
                                onChange={(event) =>
                                    setCatatan(event.target.value)
                                }
                                className="mt-1 h-12"
                            />
                        </div>
                    </div>

                    <dl className="mt-4 space-y-1.5 border-t border-kasir-line pt-4 text-sm">
                        <Baris
                            label="Kas seharusnya (tunai − uang keluar)"
                            value={rupiah(kasSeharusnya)}
                        />
                        <Baris
                            label="Uang catatan / piutang"
                            value={rupiah(summary?.totalPiutang ?? 0)}
                        />
                        <Baris
                            label="Belum bayar"
                            value={rupiah(summary?.totalBelumBayar ?? 0)}
                        />
                        <Baris
                            label="Uang lebih / kurang"
                            value={`${selisih >= 0 ? '+' : '−'} ${rupiah(Math.abs(selisih))}`}
                            tone={
                                selisih === 0
                                    ? undefined
                                    : selisih > 0
                                      ? 'success'
                                      : 'danger'
                            }
                        />
                    </dl>

                    {pending > 0 && (
                        <p className="mt-3 rounded-lg bg-kasir-primary-soft px-3 py-2 text-sm text-kasir-primary-dark">
                            {pending} data belum tersinkron. Sesi tetap bisa
                            ditutup sekarang — data terkirim otomatis saat
                            koneksi kembali.
                        </p>
                    )}

                    <Button
                        onClick={() => void tutup()}
                        disabled={saving}
                        className="mt-4 h-14 w-full bg-kasir-primary text-lg font-bold hover:bg-kasir-primary-dark"
                    >
                        Tutup Sesi Hari Ini
                    </Button>
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

TutupSesi.layout = {
    breadcrumbs: [{ title: 'Tutup Sesi', href: kasir.tutupSesi() }],
};
