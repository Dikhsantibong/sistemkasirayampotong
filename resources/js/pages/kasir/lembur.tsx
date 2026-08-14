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
import { forget, persist } from '@/offline/mutations';
import { refreshPendingCount } from '@/offline/sync';
import kasir from '@/routes/kasir';

export default function Lembur() {
    const { session, overtimes, loading } = useKasirSession();
    const { isPemilik } = usePeran();
    const [nama, setNama] = useState('');
    const [jamMulai, setJamMulai] = useState('17:00');
    const [jamSelesai, setJamSelesai] = useState('20:00');
    const [keterangan, setKeterangan] = useState('');
    const [saving, setSaving] = useState(false);

    async function tambah() {
        if (!session || nama.trim() === '') {
            toast.error('Isi dulu nama karyawan.');

            return;
        }

        if (jamMulai === '' || jamSelesai === '') {
            toast.error('Isi jam mulai dan jam selesai.');

            return;
        }

        setSaving(true);

        try {
            await persist('employee_overtimes', {
                daily_session_id: session.id,
                nama_karyawan: nama.trim(),
                jam_mulai: jamMulai,
                jam_selesai: jamSelesai,
                keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
            });
            await refreshPendingCount();
            setNama('');
            setKeterangan('');
            toast.success('Lembur dicatat.');
        } finally {
            setSaving(false);
        }
    }

    async function hapus(id: string) {
        await forget('employee_overtimes', id);
        await refreshPendingCount();
        toast.success('Catatan lembur dihapus.');
    }

    if (loading) {
        return (
            <KasirPage title="Lembur Karyawan">
                <Head title="Lembur Karyawan" />
                <KasirCard>
                    <div className="h-32 animate-pulse rounded-lg bg-kasir-surface-alt" />
                </KasirCard>
            </KasirPage>
        );
    }

    if (!session) {
        return (
            <KasirPage title="Lembur Karyawan">
                <Head title="Lembur Karyawan" />
                <SesiBelumDibuka />
            </KasirPage>
        );
    }

    return (
        <KasirPage
            title="Lembur Karyawan"
            description="Tercatat di laporan penutupan hari ini."
        >
            <Head title="Lembur Karyawan" />

            <KasirCard title="Catat Lembur">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <Label htmlFor="nama">Nama karyawan</Label>
                        <Input
                            id="nama"
                            value={nama}
                            onChange={(event) => setNama(event.target.value)}
                            className="mt-1 h-12"
                            placeholder="Nama karyawan"
                        />
                    </div>

                    <div>
                        <Label htmlFor="jam_mulai">Jam mulai</Label>
                        <Input
                            id="jam_mulai"
                            type="time"
                            value={jamMulai}
                            onChange={(event) =>
                                setJamMulai(event.target.value)
                            }
                            className="tabular mt-1 h-12 text-lg"
                        />
                    </div>

                    <div>
                        <Label htmlFor="jam_selesai">Jam selesai</Label>
                        <Input
                            id="jam_selesai"
                            type="time"
                            value={jamSelesai}
                            onChange={(event) =>
                                setJamSelesai(event.target.value)
                            }
                            className="tabular mt-1 h-12 text-lg"
                        />
                    </div>

                    <div className="md:col-span-2">
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
                            placeholder="mis. bantu bersih-bersih"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => void tambah()}
                    disabled={saving}
                    className="mt-4 h-12 w-full bg-kasir-primary text-base font-semibold hover:bg-kasir-primary-dark sm:w-auto sm:px-8"
                >
                    Catat Lembur
                </Button>
            </KasirCard>

            <KasirCard title={`Lembur Hari Ini (${overtimes.length})`}>
                {overtimes.length === 0 ? (
                    <KasirEmpty>Belum ada lembur dicatat hari ini.</KasirEmpty>
                ) : (
                    <ul className="divide-y divide-kasir-line">
                        {overtimes.map((row) => (
                            <li
                                key={row.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <span className="font-semibold">
                                    {row.nama_karyawan}
                                </span>
                                <span className="tabular text-sm">
                                    {row.jam_mulai.slice(0, 5)} –{' '}
                                    {row.jam_selesai.slice(0, 5)}
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
                                        aria-label="Hapus catatan lembur"
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

Lembur.layout = {
    breadcrumbs: [{ title: 'Lembur Karyawan', href: kasir.lembur() }],
};
