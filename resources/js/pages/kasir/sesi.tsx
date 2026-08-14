import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { KasirCard, KasirPage } from '@/components/kasir/kasir-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKasirSession } from '@/hooks/use-kasir-session';
import { usePeran } from '@/hooks/use-peran';
import { rupiah, tanggalPanjang } from '@/lib/kasir/format';
import { persist } from '@/offline/mutations';
import { todayIso } from '@/offline/queries';
import { refreshPendingCount } from '@/offline/sync';
import kasir from '@/routes/kasir';

export default function Sesi() {
    const { auth } = usePage().props;
    const { isPemilik } = usePeran();
    const { session, priceTiers, stockIntakes, summary, loading } =
        useKasirSession();
    const [dibukaOleh, setDibukaOleh] = useState(auth.user?.name ?? '');
    const [saving, setSaving] = useState(false);

    async function bukaSesi() {
        if (dibukaOleh.trim() === '') {
            toast.error('Isi dulu nama kasir yang membuka sesi.');

            return;
        }

        setSaving(true);

        try {
            await persist('daily_sessions', {
                tanggal: todayIso(),
                status: 'buka',
                dibuka_oleh: dibukaOleh.trim(),
                ditutup_oleh: null,
                catatan_penutupan: null,
                ditutup_pada: null,
            });
            await refreshPendingCount();
            toast.success('Sesi hari ini dibuka.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <KasirPage title="Sesi Harian" description={tanggalPanjang(todayIso())}>
            <Head title="Sesi Harian" />

            {loading && (
                <KasirCard>
                    <div className="h-20 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            )}

            {!loading && !session && (
                <KasirCard title="Buka Sesi">
                    <p className="mb-4 text-sm text-kasir-text-muted">
                        Sesi menampung stok masuk, tingkatan harga, dan semua
                        transaksi hari ini. Sesi tersimpan di perangkat lebih
                        dulu, jadi bisa dibuka walau sedang tidak ada sinyal.
                    </p>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Label htmlFor="dibuka_oleh">Dibuka oleh</Label>
                            <Input
                                id="dibuka_oleh"
                                value={dibukaOleh}
                                onChange={(event) =>
                                    setDibukaOleh(event.target.value)
                                }
                                placeholder="Nama kasir"
                                className="mt-1 h-11"
                            />
                        </div>
                        <Button
                            onClick={() => void bukaSesi()}
                            disabled={saving}
                            className="h-11 bg-kasir-primary px-6 text-base font-semibold hover:bg-kasir-primary-dark"
                        >
                            Buka Sesi
                        </Button>
                    </div>
                </KasirCard>
            )}

            {session && (
                <>
                    <KasirCard>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm text-kasir-text-muted">
                                    Status sesi
                                </p>
                                <p className="text-lg font-bold text-kasir-primary-dark">
                                    {session.status === 'buka'
                                        ? 'Buka'
                                        : 'Ditutup'}
                                </p>
                                <p className="mt-1 text-sm text-kasir-text-muted">
                                    Dibuka oleh {session.dibuka_oleh}
                                    {session.ditutup_oleh &&
                                        ` · ditutup oleh ${session.ditutup_oleh}`}
                                </p>
                            </div>

                            {session.status === 'buka' && (
                                <Button
                                    asChild
                                    className="h-11 bg-kasir-primary px-6 text-base font-semibold hover:bg-kasir-primary-dark"
                                >
                                    <Link href={kasir.pos()}>
                                        Ke Layar Kasir
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </KasirCard>

                    {/* Money totals are the owner's business; a kasir only
                        needs to know how much stock has moved. */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        {isPemilik && (
                            <Ringkasan
                                label="Total penjualan"
                                value={rupiah(summary?.totalPenjualan ?? 0)}
                            />
                        )}
                        <Ringkasan
                            label="Ekor terjual"
                            value={`${summary?.totalEkorTerjual ?? 0} ekor`}
                        />
                        {isPemilik && (
                            <Ringkasan
                                label="Uang keluar"
                                value={rupiah(summary?.totalUangKeluar ?? 0)}
                            />
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <KasirCard title="Persiapan">
                            <ul className="space-y-2 text-sm">
                                <Persiapan
                                    done={stockIntakes.length > 0}
                                    href={kasir.stok().url}
                                    label={`Stok masuk (${stockIntakes.length} catatan)`}
                                />
                                <Persiapan
                                    done={priceTiers.length > 0}
                                    href={kasir.harga().url}
                                    label={`Tingkatan harga (${priceTiers.length} harga aktif)`}
                                />
                            </ul>
                        </KasirCard>

                        {isPemilik ? (
                            <KasirCard title="Penutupan">
                                <p className="text-sm text-kasir-text-muted">
                                    Setelah jualan selesai, hitung uang tunai
                                    fisik dan tutup sesi untuk mengunci laporan
                                    hari ini.
                                </p>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="mt-3 h-11 w-full border-kasir-primary text-base font-semibold text-kasir-primary hover:bg-kasir-primary-soft"
                                >
                                    <Link href={kasir.tutupSesi()}>
                                        Tutup Sesi & Rekonsiliasi
                                    </Link>
                                </Button>
                            </KasirCard>
                        ) : (
                            <KasirCard title="Penutupan">
                                <p className="text-sm text-kasir-text-muted">
                                    Penutupan sesi dan penghitungan kas
                                    dikerjakan oleh pemilik. Terus catat
                                    transaksi seperti biasa sampai sesi ditutup.
                                </p>
                            </KasirCard>
                        )}
                    </div>
                </>
            )}
        </KasirPage>
    );
}

function Ringkasan({ label, value }: { label: string; value: string }) {
    return (
        <KasirCard>
            <p className="text-sm text-kasir-text-muted">{label}</p>
            <p className="tabular mt-1 text-xl text-kasir-text">{value}</p>
        </KasirCard>
    );
}

function Persiapan({
    done,
    href,
    label,
}: {
    done: boolean;
    /** Null when the current role may not open the settings page. */
    href: string | null;
    label: string;
}) {
    return (
        <li className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
                <span
                    className={
                        done
                            ? 'inline-block size-2.5 rounded-full bg-kasir-success'
                            : 'inline-block size-2.5 rounded-full bg-kasir-line'
                    }
                />
                {label}
            </span>
            {href && (
                <Link
                    href={href}
                    className="font-semibold text-kasir-primary hover:underline"
                >
                    Atur
                </Link>
            )}
        </li>
    );
}

Sesi.layout = {
    breadcrumbs: [{ title: 'Sesi Harian', href: kasir.sesi() }],
};
