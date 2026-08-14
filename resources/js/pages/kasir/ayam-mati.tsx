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
import { jam } from '@/lib/kasir/format';
import { cn } from '@/lib/utils';
import { forget, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import { UKURAN_AYAM, UKURAN_LABEL } from '@/offline/types';
import type { UkuranAyam } from '@/offline/types';
import kasir from '@/routes/kasir';

export default function AyamMati() {
    const { session, deadChickens, summary, loading } = useKasirSession();
    const { isPemilik } = usePeran();
    const [ukuran, setUkuran] = useState<UkuranAyam>('jumbo');
    const [jumlah, setJumlah] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [saving, setSaving] = useState(false);

    async function tambah() {
        const jumlahEkor = Number(jumlah);

        if (!session || !Number.isFinite(jumlahEkor) || jumlahEkor <= 0) {
            toast.error('Isi jumlah ekor lebih dari 0.');

            return;
        }

        setSaving(true);

        try {
            await persist('dead_chickens', {
                daily_session_id: session.id,
                ukuran,
                jumlah_ekor: jumlahEkor,
                keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
            });
            await refreshPendingCount();
            setJumlah('');
            setKeterangan('');
            toast.success('Ayam mati dicatat.');
        } finally {
            setSaving(false);
        }
    }

    async function hapus(id: string) {
        await forget('dead_chickens', id);
        await refreshPendingCount();
        toast.success('Catatan dihapus.');
    }

    if (loading) {
        return (
            <KasirPage title="Ayam Mati">
                <Head title="Ayam Mati" />
                <KasirCard>
                    <div className="h-32 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Ayam Mati">
                <Head title="Ayam Mati" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Ayam Mati"
            description={`Total hari ini ${summary?.totalAyamMati ?? 0} ekor — ikut mengurangi sisa stok.`}
        >
            <Head title="Ayam Mati" />

            <KasirCard title="Catat Ayam Mati">
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
                        <Label htmlFor="keterangan">
                            Keterangan (opsional)
                        </Label>
                        <Input
                            id="keterangan"
                            value={keterangan}
                            onChange={(event) =>
                                setKeterangan(event.target.value)
                            }
                            className="mt-1 h-12"
                            placeholder="mis. mati saat bongkar muat"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => void tambah()}
                    disabled={saving}
                    className="mt-4 h-12 w-full bg-kasir-danger text-base font-semibold hover:bg-kasir-danger/90 sm:w-auto sm:px-8"
                >
                    Catat Ayam Mati
                </Button>
            </KasirCard>

            <KasirCard title={`Riwayat (${deadChickens.length})`}>
                {deadChickens.length === 0 ? (
                    <KasirEmpty>
                        Belum ada ayam mati dicatat hari ini.
                    </KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {deadChickens.map((row) => (
                            <li
                                key={row.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <span className="text-xs text-kasir-text-muted">
                                    {jam(row.created_at)}
                                </span>
                                <span className="font-semibold">
                                    {UKURAN_LABEL[row.ukuran]}
                                </span>
                                <span className="tabular text-base text-kasir-danger">
                                    {row.jumlah_ekor} ekor
                                </span>
                                {row.keterangan && (
                                    <span className="text-sm text-kasir-text-muted">
                                        {row.keterangan}
                                    </span>
                                )}
                                {isPemilik && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void hapus(row.id)}
                                        className="ml-auto text-kasir-danger"
                                        aria-label="Hapus catatan ayam mati"
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

AyamMati.layout = {
    breadcrumbs: [{ title: 'Ayam Mati', href: kasir.ayamMati() }],
};
