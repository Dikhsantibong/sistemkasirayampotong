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
import { jam, rupiah } from '@/lib/kasir/format';
import { forget, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import kasir from '@/routes/kasir';

export default function UangKeluar() {
    const { session, cashOuts, summary, loading } = useKasirSession();
    const { isPemilik } = usePeran();
    const [jumlah, setJumlah] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [saving, setSaving] = useState(false);

    async function tambah() {
        const nominal = Number(jumlah);

        if (!session || !Number.isFinite(nominal) || nominal <= 0) {
            toast.error('Isi jumlah uang keluar lebih dari 0.');

            return;
        }

        if (keterangan.trim() === '') {
            toast.error('Keterangan wajib diisi supaya kas bisa ditelusuri.');

            return;
        }

        setSaving(true);

        try {
            await persist('cash_outs', {
                daily_session_id: session.id,
                jumlah: nominal,
                keterangan: keterangan.trim(),
            });
            await refreshPendingCount();
            setJumlah('');
            setKeterangan('');
            toast.success('Uang keluar dicatat.');
        } finally {
            setSaving(false);
        }
    }

    async function hapus(id: string) {
        await forget('cash_outs', id);
        await refreshPendingCount();
        toast.success('Catatan uang keluar dihapus.');
    }

    if (loading) {
        return (
            <KasirPage title="Uang Keluar">
                <Head title="Uang Keluar" />
                <KasirCard>
                    <div className="h-32 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Uang Keluar">
                <Head title="Uang Keluar" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Uang Keluar"
            description={`Total hari ini ${rupiah(summary?.totalUangKeluar ?? 0)}`}
        >
            <Head title="Uang Keluar" />

            <KasirCard title="Catat Pengeluaran">
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <Label htmlFor="jumlah">Jumlah</Label>
                        <Input
                            id="jumlah"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={jumlah}
                            onChange={(event) => setJumlah(event.target.value)}
                            className="tabular mt-1 h-12 text-lg"
                        />
                    </div>
                    <div>
                        <Label htmlFor="keterangan">Keterangan</Label>
                        <Input
                            id="keterangan"
                            value={keterangan}
                            onChange={(event) =>
                                setKeterangan(event.target.value)
                            }
                            className="mt-1 h-12"
                            placeholder="mis. beli es batu"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => void tambah()}
                    disabled={saving}
                    className="mt-4 h-12 w-full bg-kasir-primary text-base font-semibold hover:bg-kasir-primary-dark sm:w-auto sm:px-8"
                >
                    Catat Uang Keluar
                </Button>
            </KasirCard>

            <KasirCard title={`Riwayat (${cashOuts.length})`}>
                {cashOuts.length === 0 ? (
                    <KasirEmpty>Belum ada uang keluar hari ini.</KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {cashOuts.map((row) => (
                            <li
                                key={row.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <span className="text-xs text-kasir-text-muted">
                                    {jam(row.created_at)}
                                </span>
                                <span className="tabular text-base text-kasir-danger">
                                    {rupiah(row.jumlah)}
                                </span>
                                <span className="text-sm text-kasir-text-muted">
                                    {row.keterangan}
                                </span>
                                {isPemilik && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void hapus(row.id)}
                                        className="ml-auto text-kasir-danger"
                                        aria-label="Hapus catatan uang keluar"
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

UangKeluar.layout = {
    breadcrumbs: [{ title: 'Uang Keluar', href: kasir.uangKeluar() }],
};
