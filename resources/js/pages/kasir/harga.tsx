import { Head } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
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
import { angka, rupiah } from '@/lib/kasir/format';
import { forget, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import kasir from '@/routes/kasir';

/** Prices commonly used at the stall, offered as one-tap shortcuts. */
const HARGA_CEPAT = [55000, 65000, 70000, 75000];

export default function Harga() {
    const { session, priceTiers, summary, loading } = useKasirSession();
    const [harga, setHarga] = useState('');
    const [saving, setSaving] = useState(false);

    async function tambah(nominal: number) {
        if (!session || !Number.isFinite(nominal) || nominal <= 0) {
            toast.error('Isi nominal harga lebih dari 0.');

            return;
        }

        if (priceTiers.some((tier) => tier.harga === nominal)) {
            toast.error(`Harga ${rupiah(nominal)} sudah ada di daftar.`);

            return;
        }

        setSaving(true);

        try {
            await persist('price_tiers', {
                daily_session_id: session.id,
                harga: nominal,
                urutan: priceTiers.length,
            });
            await refreshPendingCount();
            setHarga('');
            toast.success(`Harga ${rupiah(nominal)} ditambahkan.`);
        } finally {
            setSaving(false);
        }
    }

    async function hapus(id: string) {
        const terpakai = (summary?.perTingkatanHarga ?? []).find(
            (baris) => baris.tier.id === id,
        );

        if (terpakai && terpakai.jumlahTransaksi > 0) {
            toast.error(
                'Harga ini sudah dipakai di transaksi hari ini, jadi tidak bisa dihapus.',
            );

            return;
        }

        await forget('price_tiers', id);
        await refreshPendingCount();
        toast.success('Tingkatan harga dihapus.');
    }

    if (loading) {
        return (
            <KasirPage title="Tingkatan Harga">
                <Head title="Tingkatan Harga" />
                <KasirCard>
                    <div className="h-32 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Tingkatan Harga">
                <Head title="Tingkatan Harga" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Tingkatan Harga"
            description="Harga per ekor yang berlaku hari ini. Bisa ditambah kapan saja selama sesi masih buka."
        >
            <Head title="Tingkatan Harga" />

            <KasirCard title="Tambah Harga">
                <div className="flex flex-wrap gap-2">
                    {HARGA_CEPAT.map((nominal) => (
                        <Button
                            key={nominal}
                            type="button"
                            variant="outline"
                            onClick={() => void tambah(nominal)}
                            disabled={
                                saving ||
                                priceTiers.some(
                                    (tier) => tier.harga === nominal,
                                )
                            }
                            className="tabular h-12 border-kasir-line bg-kasir-primary-soft px-4 text-base text-kasir-primary-dark hover:bg-kasir-primary hover:text-white"
                        >
                            {angka(nominal)}
                        </Button>
                    ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <Label htmlFor="harga">Harga lain (per ekor)</Label>
                        <Input
                            id="harga"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={500}
                            value={harga}
                            onChange={(event) => setHarga(event.target.value)}
                            className="tabular mt-1 h-12 text-lg"
                            placeholder="mis. 62000"
                        />
                    </div>
                    <Button
                        onClick={() => void tambah(Number(harga))}
                        disabled={saving}
                        className="h-12 bg-kasir-primary px-8 text-base font-semibold hover:bg-kasir-primary-dark"
                    >
                        Tambah
                    </Button>
                </div>
            </KasirCard>

            <KasirCard title={`Harga Aktif (${priceTiers.length})`}>
                {priceTiers.length === 0 ? (
                    <KasirEmpty>
                        Belum ada tingkatan harga. Tambahkan minimal satu
                        sebelum mulai jualan.
                    </KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {priceTiers.map((tier) => {
                            const ringkasan = (
                                summary?.perTingkatanHarga ?? []
                            ).find((baris) => baris.tier.id === tier.id);

                            return (
                                <li
                                    key={tier.id}
                                    className="flex items-center gap-3 py-3"
                                >
                                    <span className="tabular text-xl text-kasir-primary-dark">
                                        {rupiah(tier.harga)}
                                    </span>
                                    <span className="text-sm text-kasir-text-muted">
                                        {ringkasan?.jumlahEkor ?? 0} ekor
                                        terjual ·{' '}
                                        {rupiah(ringkasan?.total ?? 0)}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void hapus(tier.id)}
                                        className="ml-auto text-kasir-danger"
                                        aria-label="Hapus tingkatan harga"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </KasirCard>
        </KasirPage>
    );
}

Harga.layout = {
    breadcrumbs: [{ title: 'Tingkatan Harga', href: kasir.harga() }],
};
