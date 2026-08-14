import { Head, Link, usePage } from '@inertiajs/react';
import { Minus, Plus, Printer as PrinterIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    KasirCard,
    KasirEmpty,
    KasirPage,
    SesiBelumDibuka,
} from '@/components/kasir/kasir-page';
import { StatusBayarBadge } from '@/components/kasir/status-bayar-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKasirSession } from '@/hooks/use-kasir-session';
import { usePeran } from '@/hooks/use-peran';
import { generateReceiptBytes } from '@/lib/kasir/escpos';
import { angka, jam, rupiah } from '@/lib/kasir/format';
import {
    isBluetoothSupported,
    isPrinterConnected,
    printBytes,
    readPrinterSettings,
} from '@/lib/kasir/printer';
import { cn } from '@/lib/utils';
import { amend, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import {
    STATUS_BAYAR,
    STATUS_BAYAR_LABEL,
    UKURAN_AYAM,
    UKURAN_LABEL,
} from '@/offline/types';
import type {
    PriceTier,
    SalesTransaction,
    StatusBayar,
    UkuranAyam,
} from '@/offline/types';
import kasir from '@/routes/kasir';

export default function Pos() {
    const { auth } = usePage().props;
    const { isPemilik } = usePeran();
    const { session, priceTiers, transactions, summary, loading } =
        useKasirSession();

    const [tierId, setTierId] = useState<string | null>(null);
    const [jumlahEkor, setJumlahEkor] = useState(1);
    const [ukuran, setUkuran] = useState<UkuranAyam | null>(null);
    const [statusBayar, setStatusBayar] = useState<StatusBayar>('lunas_tunai');
    const [namaPembeli, setNamaPembeli] = useState('');
    const [subtotalOverride, setSubtotalOverride] = useState('');
    const [saving, setSaving] = useState(false);

    const tier =
        priceTiers.find((candidate) => candidate.id === tierId) ?? null;
    const subtotalOtomatis = (tier?.harga ?? 0) * jumlahEkor;
    const subtotal =
        subtotalOverride.trim() === ''
            ? subtotalOtomatis
            : Number(subtotalOverride);

    function reset() {
        setJumlahEkor(1);
        setUkuran(null);
        setStatusBayar('lunas_tunai');
        setNamaPembeli('');
        setSubtotalOverride('');
    }

    async function simpan() {
        if (!session || !tier) {
            toast.error('Pilih tingkatan harga dulu.');

            return;
        }

        if (jumlahEkor < 1) {
            toast.error('Jumlah ekor minimal 1.');

            return;
        }

        if (!Number.isFinite(subtotal) || subtotal < 0) {
            toast.error('Subtotal tidak valid.');

            return;
        }

        if (statusBayar === 'utang' && namaPembeli.trim() === '') {
            toast.error('Transaksi utang wajib mencantumkan nama pembeli.');

            return;
        }

        setSaving(true);

        try {
            const transaction = await persist('sales_transactions', {
                daily_session_id: session.id,
                price_tier_id: tier.id,
                ukuran,
                jumlah_ekor: jumlahEkor,
                subtotal,
                status_bayar: statusBayar,
                nama_pembeli:
                    statusBayar === 'utang' ? namaPembeli.trim() : null,
                catatan: null,
                dibatalkan_pada: null,
                alasan_pembatalan: null,
            });

            await refreshPendingCount();
            toast.success(`Transaksi ${rupiah(subtotal)} tersimpan.`);
            reset();

            await cetakStruk(
                transaction,
                tier.harga,
                auth.user?.name ?? 'Kasir',
                true,
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <KasirPage title="Layar Kasir">
                <Head title="Layar Kasir" />
                <KasirCard>
                    <div className="h-40 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Layar Kasir">
                <Head title="Layar Kasir" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    if (session.status === 'ditutup') {
        return (
            <KasirPage title="Layar Kasir">
                <Head title="Layar Kasir" />
                <KasirCard className="text-center">
                    <p className="text-base font-semibold">
                        Sesi hari ini sudah ditutup.
                    </p>
                    <p className="mt-1 text-sm text-kasir-text-muted">
                        {isPemilik
                            ? 'Laporan sudah dikunci. Buka riwayat untuk melihat hasilnya.'
                            : 'Laporan hari ini sudah dikunci oleh pemilik.'}
                    </p>
                    {isPemilik && (
                        <Button asChild variant="outline" className="mt-4 h-11">
                            <Link href={kasir.riwayat()}>
                                Lihat Riwayat Laporan
                            </Link>
                        </Button>
                    )}
                </KasirCard>
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Layar Kasir"
            /* A kasir sees how many chickens moved, but not the takings —
               revenue figures belong to the owner. */
            description={
                isPemilik
                    ? `Total hari ini ${rupiah(summary?.totalPenjualan ?? 0)} · ${summary?.totalEkorTerjual ?? 0} ekor`
                    : `${summary?.totalEkorTerjual ?? 0} ekor terjual hari ini`
            }
        >
            <Head title="Layar Kasir" />

            <KasirCard title="Tingkatan Harga">
                {priceTiers.length === 0 ? (
                    <KasirEmpty>
                        Belum ada tingkatan harga hari ini.{' '}
                        <Link
                            href={kasir.harga()}
                            className="font-semibold text-kasir-primary hover:underline"
                        >
                            Atur harga dulu
                        </Link>
                        .
                    </KasirEmpty>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {priceTiers.map((candidate) => (
                            <TombolHarga
                                key={candidate.id}
                                tier={candidate}
                                selected={candidate.id === tierId}
                                onSelect={() => setTierId(candidate.id)}
                            />
                        ))}
                    </div>
                )}
            </KasirCard>

            <KasirCard title="Detail Transaksi">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label>Jumlah ekor</Label>
                        <div className="mt-1 flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setJumlahEkor((value) =>
                                        Math.max(1, value - 1),
                                    )
                                }
                                className="size-12 shrink-0 border-kasir-line"
                                aria-label="Kurangi jumlah ekor"
                            >
                                <Minus className="size-5" />
                            </Button>
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={jumlahEkor}
                                onChange={(event) =>
                                    setJumlahEkor(
                                        Math.max(
                                            1,
                                            Number(event.target.value) || 1,
                                        ),
                                    )
                                }
                                className="tabular h-12 text-center text-lg"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setJumlahEkor((value) => value + 1)
                                }
                                className="size-12 shrink-0 border-kasir-line"
                                aria-label="Tambah jumlah ekor"
                            >
                                <Plus className="size-5" />
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label>Ukuran (opsional)</Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {UKURAN_AYAM.map((candidate) => (
                                <button
                                    key={candidate}
                                    type="button"
                                    onClick={() =>
                                        setUkuran((current) =>
                                            current === candidate
                                                ? null
                                                : candidate,
                                        )
                                    }
                                    className={cn(
                                        'h-12 rounded-lg border px-3 text-sm font-semibold',
                                        ukuran === candidate
                                            ? 'border-kasir-primary bg-kasir-primary text-white'
                                            : 'border-kasir-line bg-kasir-surface text-kasir-text',
                                    )}
                                >
                                    {UKURAN_LABEL[candidate]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Status bayar</Label>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            {STATUS_BAYAR.map((candidate) => (
                                <button
                                    key={candidate}
                                    type="button"
                                    onClick={() => setStatusBayar(candidate)}
                                    className={cn(
                                        'h-12 rounded-lg border px-2 text-sm font-semibold',
                                        statusBayar === candidate
                                            ? 'border-kasir-primary bg-kasir-primary text-white'
                                            : 'border-kasir-line bg-kasir-surface text-kasir-text',
                                    )}
                                >
                                    {STATUS_BAYAR_LABEL[candidate]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="subtotal">
                            Subtotal (kosongkan untuk otomatis)
                        </Label>
                        <Input
                            id="subtotal"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={subtotalOverride}
                            onChange={(event) =>
                                setSubtotalOverride(event.target.value)
                            }
                            placeholder={angka(subtotalOtomatis)}
                            className="tabular mt-1 h-12 text-lg"
                        />
                    </div>

                    {statusBayar === 'utang' && (
                        <div className="md:col-span-2">
                            <Label htmlFor="nama_pembeli">
                                Nama pembeli (wajib untuk utang)
                            </Label>
                            <Input
                                id="nama_pembeli"
                                value={namaPembeli}
                                onChange={(event) =>
                                    setNamaPembeli(event.target.value)
                                }
                                className="mt-1 h-12"
                                placeholder="Nama pembeli"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-kasir-line pt-4">
                    <div>
                        <p className="text-sm text-kasir-text-muted">
                            Subtotal
                        </p>
                        <p className="tabular text-2xl text-kasir-primary-dark">
                            {rupiah(Number.isFinite(subtotal) ? subtotal : 0)}
                        </p>
                    </div>
                    <Button
                        onClick={() => void simpan()}
                        disabled={saving || !tier}
                        className="h-14 min-w-44 bg-kasir-primary px-8 text-lg font-bold hover:bg-kasir-primary-dark"
                    >
                        Simpan & Cetak
                    </Button>
                </div>
            </KasirCard>

            <RiwayatHariIni
                transactions={transactions}
                priceTiers={priceTiers}
                kasirName={auth.user?.name ?? 'Kasir'}
                bolehBatalkan={isPemilik}
            />
        </KasirPage>
    );
}

function TombolHarga({
    tier,
    selected,
    onSelect,
}: {
    tier: PriceTier;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'flex min-h-22 flex-col items-center justify-center rounded-xl border px-2 py-3 transition-colors',
                selected
                    ? 'border-kasir-primary bg-kasir-primary text-white'
                    : 'border-kasir-line bg-kasir-primary-soft text-kasir-primary-dark',
            )}
        >
            <span className="text-xs opacity-80">Rp</span>
            <span className="tabular text-2xl leading-tight">
                {angka(tier.harga)}
            </span>
            <span className="text-xs opacity-80">per ekor</span>
        </button>
    );
}

/**
 * Sends a receipt to the paired thermal printer.
 *
 * `silent` keeps a missing or unsupported printer from interrupting the sale —
 * the transaction is already saved, and the cashier can reprint from the
 * history list once the printer is sorted out.
 */
async function cetakStruk(
    transaction: SalesTransaction,
    harga: number,
    kasirName: string,
    silent = false,
): Promise<void> {
    const settings = readPrinterSettings();

    if (silent && !settings.autoPrint) {
        return;
    }

    if (!isBluetoothSupported()) {
        if (!silent) {
            toast.error(
                'Perangkat ini tidak mendukung cetak Bluetooth (iPhone/iPad tidak didukung).',
            );
        }

        return;
    }

    if (!isPrinterConnected()) {
        if (!silent) {
            toast.error('Printer belum tersambung. Buka Pengaturan Printer.');
        }

        return;
    }

    try {
        await printBytes(
            generateReceiptBytes({
                transaction,
                harga,
                kasir: kasirName,
                toko: settings.toko,
                paper: settings.paper,
            }),
        );

        if (!silent) {
            toast.success('Struk dikirim ke printer.');
        }
    } catch (error) {
        toast.error(
            error instanceof Error ? error.message : 'Gagal mencetak struk.',
        );
    }
}

function RiwayatHariIni({
    transactions,
    priceTiers,
    kasirName,
    bolehBatalkan,
}: {
    transactions: SalesTransaction[];
    priceTiers: PriceTier[];
    kasirName: string;
    /** Voiding a sale is owner-only; the server refuses it either way. */
    bolehBatalkan: boolean;
}) {
    async function batalkan(transaction: SalesTransaction) {
        const alasan = window.prompt('Alasan pembatalan transaksi ini?');

        if (alasan === null || alasan.trim() === '') {
            return;
        }

        await amend('sales_transactions', transaction.id, {
            dibatalkan_pada: new Date().toISOString(),
            alasan_pembatalan: alasan.trim(),
        });
        await refreshPendingCount();
        toast.success('Transaksi dibatalkan.');
    }

    return (
        <KasirCard title={`Transaksi Hari Ini (${transactions.length})`}>
            {transactions.length === 0 ? (
                <KasirEmpty>Belum ada transaksi hari ini.</KasirEmpty>
            ) : (
                <ul className="divide-y divide-kasir-line">
                    {transactions.map((transaction) => {
                        const harga =
                            priceTiers.find(
                                (tier) => tier.id === transaction.price_tier_id,
                            )?.harga ?? 0;
                        const dibatalkan = transaction.dibatalkan_pada !== null;

                        return (
                            <li
                                key={transaction.id}
                                className={cn(
                                    'flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5',
                                    dibatalkan && 'opacity-50',
                                )}
                            >
                                <span className="text-xs text-kasir-text-muted">
                                    {jam(transaction.created_at)}
                                </span>
                                <span
                                    className={cn(
                                        'tabular text-base',
                                        dibatalkan && 'line-through',
                                    )}
                                >
                                    {rupiah(transaction.subtotal)}
                                </span>
                                <span className="text-sm text-kasir-text-muted">
                                    {transaction.jumlah_ekor} ekor @{' '}
                                    {rupiah(harga)}
                                    {transaction.ukuran &&
                                        ` · ${UKURAN_LABEL[transaction.ukuran]}`}
                                </span>
                                <StatusBayarBadge
                                    status={transaction.status_bayar}
                                />
                                {transaction.nama_pembeli && (
                                    <span className="text-sm text-kasir-text-muted">
                                        a.n. {transaction.nama_pembeli}
                                    </span>
                                )}

                                <span className="ml-auto flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            void cetakStruk(
                                                transaction,
                                                harga,
                                                kasirName,
                                            )
                                        }
                                        className="text-kasir-primary"
                                        aria-label="Cetak ulang struk"
                                    >
                                        <PrinterIcon className="size-4" />
                                    </Button>
                                    {bolehBatalkan && !dibatalkan && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                void batalkan(transaction)
                                            }
                                            className="text-kasir-danger"
                                        >
                                            Batalkan
                                        </Button>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </KasirCard>
    );
}

Pos.layout = {
    breadcrumbs: [{ title: 'Layar Kasir', href: kasir.pos() }],
};
