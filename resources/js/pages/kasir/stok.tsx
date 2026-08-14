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
import { usePeran } from '@/hooks/use-peran';
import { cn } from '@/lib/utils';
import { forget, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import { UKURAN_AYAM, UKURAN_LABEL } from '@/offline/types';
import type { UkuranAyam } from '@/offline/types';
import kasir from '@/routes/kasir';

export default function Stok() {
    const { session, stockIntakes, summary, loading } = useKasirSession();
    const { isPemilik } = usePeran();
    const [ukuran, setUkuran] = useState<UkuranAyam>('jumbo');
    const [jumlah, setJumlah] = useState('');
    const [catatan, setCatatan] = useState('');
    const [saving, setSaving] = useState(false);

    async function tambah() {
        const jumlahEkor = Number(jumlah);

        if (!session || !Number.isFinite(jumlahEkor) || jumlahEkor <= 0) {
            toast.error('Isi jumlah ekor lebih dari 0.');

            return;
        }

        setSaving(true);

        try {
            await persist('stock_intakes', {
                daily_session_id: session.id,
                ukuran,
                jumlah_ekor: jumlahEkor,
                catatan: catatan.trim() === '' ? null : catatan.trim(),
            });
            await refreshPendingCount();
            setJumlah('');
            setCatatan('');
            toast.success('Stok masuk dicatat.');
        } finally {
            setSaving(false);
        }
    }

    async function hapus(id: string) {
        await forget('stock_intakes', id);
        await refreshPendingCount();
        toast.success('Catatan stok dihapus.');
    }

    if (loading) {
        return (
            <KasirPage title="Stok Masuk">
                <Head title="Stok Masuk" />
                <KasirCard>
                    <div className="h-32 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Stok Masuk">
                <Head title="Stok Masuk" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Stok Masuk"
            description="Ayam yang masuk hari ini, dikelompokkan per ukuran."
        >
            <Head title="Stok Masuk" />

            <KasirCard title="Sisa Per Ukuran">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(summary?.perUkuran ?? []).map((baris) => (
                        <div
                            key={baris.ukuran}
                            className="rounded-lg border border-kasir-line bg-kasir-surface-alt p-3"
                        >
                            <p className="text-xs font-semibold text-kasir-text-muted uppercase">
                                {UKURAN_LABEL[baris.ukuran]}
                            </p>
                            <p className="tabular text-2xl text-kasir-primary-dark">
                                {baris.sisa}
                            </p>
                            <p className="mt-1 text-xs text-kasir-text-muted">
                                masuk {baris.masuk} · jual {baris.terjual} ·
                                mati {baris.mati}
                            </p>
                        </div>
                    ))}
                </div>
            </KasirCard>

            <KasirCard title="Catat Stok Masuk">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <Label>Ukuran</Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {UKURAN_AYAM.map((candidate) => (
                                <button
                                    key={candidate}
                                    type="button"
                                    onClick={() => setUkuran(candidate)}
                                    className={cn(
                                        'h-12 rounded-lg border px-4 text-sm font-semibold',
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
                        <Label htmlFor="jumlah">Jumlah ekor</Label>
                        <Input
                            id="jumlah"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={jumlah}
                            onChange={(event) => setJumlah(event.target.value)}
                            className="tabular mt-1 h-12 text-lg"
                        />
                    </div>

                    <div>
                        <Label htmlFor="catatan">Catatan (opsional)</Label>
                        <Input
                            id="catatan"
                            value={catatan}
                            onChange={(event) => setCatatan(event.target.value)}
                            className="mt-1 h-12"
                            placeholder="mis. dari pemasok A"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => void tambah()}
                    disabled={saving}
                    className="mt-4 h-12 w-full bg-kasir-primary text-base font-semibold hover:bg-kasir-primary-dark sm:w-auto sm:px-8"
                >
                    Tambah Stok
                </Button>
            </KasirCard>

            <KasirCard title={`Riwayat Stok Masuk (${stockIntakes.length})`}>
                {stockIntakes.length === 0 ? (
                    <KasirEmpty>
                        Belum ada stok masuk dicatat hari ini.
                    </KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {stockIntakes.map((intake) => (
                            <li
                                key={intake.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <span className="font-semibold">
                                    {UKURAN_LABEL[intake.ukuran]}
                                </span>
                                <span className="tabular text-base">
                                    {intake.jumlah_ekor} ekor
                                </span>
                                {intake.catatan && (
                                    <span className="text-sm text-kasir-text-muted">
                                        {intake.catatan}
                                    </span>
                                )}
                                {isPemilik && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void hapus(intake.id)}
                                        className="ml-auto text-kasir-danger"
                                        aria-label="Hapus catatan stok"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </KasirCard>
        </KasirPage>
    );
}

Stok.layout = {
    breadcrumbs: [{ title: 'Stok Masuk', href: kasir.stok() }],
};
