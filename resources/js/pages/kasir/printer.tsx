import { Head } from '@inertiajs/react';
import { Bluetooth, BluetoothOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { KasirCard, KasirPage } from '@/components/kasir/kasir-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAPER_WIDTHS, generateTestPrintBytes } from '@/lib/kasir/escpos';
import type { PaperWidth } from '@/lib/kasir/escpos';
import {
    connectPrinter,
    connectedPrinterName,
    disconnectPrinter,
    isBluetoothSupported,
    printBytes,
    readPrinterSettings,
    writePrinterSettings,
} from '@/lib/kasir/printer';
import type { PrinterSettings } from '@/lib/kasir/printer';
import { cn } from '@/lib/utils';
import kasir from '@/routes/kasir';

export default function Printer() {
    const [settings, setSettings] =
        useState<PrinterSettings>(readPrinterSettings);
    /* The connection lives in the printer module, not in React, so it is read
       once as the initial value rather than synced in via an effect. */
    const [deviceName, setDeviceName] = useState<string | null>(
        connectedPrinterName,
    );
    const [busy, setBusy] = useState(false);
    const supported = isBluetoothSupported();

    function update(patch: Partial<PrinterSettings>) {
        const next = { ...settings, ...patch };
        setSettings(next);
        writePrinterSettings(next);
    }

    function updateToko(patch: Partial<PrinterSettings['toko']>) {
        update({ toko: { ...settings.toko, ...patch } });
    }

    async function sambungkan() {
        setBusy(true);

        try {
            const name = await connectPrinter();
            setDeviceName(name);
            update({ lastDeviceName: name });
            toast.success(`Terhubung ke ${name}.`);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Gagal menyambung ke printer.',
            );
        } finally {
            setBusy(false);
        }
    }

    function putuskan() {
        disconnectPrinter();
        setDeviceName(null);
        toast.success('Koneksi printer diputus.');
    }

    async function tesCetak() {
        setBusy(true);

        try {
            await printBytes(generateTestPrintBytes(settings.paper));
            toast.success('Tes cetak dikirim ke printer.');
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal mencetak.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <KasirPage
            title="Pengaturan Printer"
            description="Printer thermal Bluetooth 58mm / 80mm dengan perintah ESC/POS."
        >
            <Head title="Pengaturan Printer" />

            {!supported && (
                <KasirCard className="border-kasir-warning bg-kasir-warning/5">
                    <p className="flex items-start gap-2 text-sm">
                        <BluetoothOff className="mt-0.5 size-4 shrink-0 text-kasir-warning" />
                        <span>
                            <strong className="font-semibold">
                                Perangkat ini tidak mendukung Web Bluetooth.
                            </strong>{' '}
                            Cetak langsung dari aplikasi hanya jalan di Chrome
                            atau Edge pada Android, Windows, macOS, dan Linux.{' '}
                            <strong className="font-semibold">
                                iPhone dan iPad tidak didukung
                            </strong>{' '}
                            — ini batasan Apple, bukan batasan aplikasi. Pakai
                            perangkat Android atau komputer untuk kasir yang
                            perlu mencetak struk.
                        </span>
                    </p>
                </KasirCard>
            )}

            <KasirCard title="Koneksi Printer">
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                            deviceName
                                ? 'bg-kasir-success text-white'
                                : 'bg-kasir-primary-soft text-kasir-primary-dark',
                        )}
                    >
                        <Bluetooth className="size-3.5" />
                        {deviceName
                            ? `Terhubung: ${deviceName}`
                            : 'Belum terhubung'}
                    </span>

                    <Button
                        onClick={() => void sambungkan()}
                        disabled={!supported || busy}
                        className="h-11 bg-kasir-primary px-6 font-semibold hover:bg-kasir-primary-dark"
                    >
                        {deviceName ? 'Ganti Printer' : 'Sambungkan Printer'}
                    </Button>

                    {deviceName && (
                        <>
                            <Button
                                onClick={() => void tesCetak()}
                                disabled={busy}
                                variant="outline"
                                className="h-11 border-kasir-primary px-6 font-semibold text-kasir-primary hover:bg-kasir-primary-soft"
                            >
                                Tes Cetak
                            </Button>
                            <Button
                                onClick={putuskan}
                                variant="ghost"
                                className="h-11 text-kasir-danger"
                            >
                                Putuskan
                            </Button>
                        </>
                    )}
                </div>

                <p className="mt-3 text-xs text-kasir-text-muted">
                    Browser mewajibkan pemilihan printer lewat ketukan pengguna,
                    jadi koneksi perlu disambungkan ulang setiap kali aplikasi
                    dibuka dari awal.
                    {settings.lastDeviceName &&
                        ` Printer terakhir yang dipakai: ${settings.lastDeviceName}.`}
                </p>
            </KasirCard>

            <KasirCard title="Ukuran Kertas">
                <div className="flex gap-2">
                    {(Object.keys(PAPER_WIDTHS) as PaperWidth[]).map(
                        (paper) => (
                            <button
                                key={paper}
                                type="button"
                                onClick={() => update({ paper })}
                                className={cn(
                                    'h-12 rounded-lg border px-6 text-sm font-semibold',
                                    settings.paper === paper
                                        ? 'border-kasir-primary bg-kasir-primary text-white'
                                        : 'border-kasir-line bg-kasir-surface text-kasir-text',
                                )}
                            >
                                {paper}
                                <span className="ml-1.5 text-xs opacity-75">
                                    ({PAPER_WIDTHS[paper]} karakter)
                                </span>
                            </button>
                        ),
                    )}
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={settings.autoPrint}
                        onChange={(event) =>
                            update({ autoPrint: event.target.checked })
                        }
                        className="size-4 accent-kasir-primary"
                    />
                    Cetak struk otomatis setiap transaksi disimpan
                </label>
            </KasirCard>

            <KasirCard title="Identitas Toko di Struk">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <Label htmlFor="nama_toko">Nama toko</Label>
                        <Input
                            id="nama_toko"
                            value={settings.toko.nama}
                            onChange={(event) =>
                                updateToko({ nama: event.target.value })
                            }
                            className="mt-1 h-12"
                            placeholder="Ayam Potong Barokah"
                        />
                    </div>
                    <div>
                        <Label htmlFor="alamat_toko">Alamat (opsional)</Label>
                        <Input
                            id="alamat_toko"
                            value={settings.toko.alamat ?? ''}
                            onChange={(event) =>
                                updateToko({
                                    alamat:
                                        event.target.value === ''
                                            ? null
                                            : event.target.value,
                                })
                            }
                            className="mt-1 h-12"
                        />
                    </div>
                    <div>
                        <Label htmlFor="telepon_toko">
                            No. telepon (opsional)
                        </Label>
                        <Input
                            id="telepon_toko"
                            value={settings.toko.telepon ?? ''}
                            onChange={(event) =>
                                updateToko({
                                    telepon:
                                        event.target.value === ''
                                            ? null
                                            : event.target.value,
                                })
                            }
                            className="mt-1 h-12"
                        />
                    </div>
                </div>

                <p className="mt-3 text-xs text-kasir-text-muted">
                    Pengaturan printer disimpan di perangkat ini saja, tidak
                    ikut disinkronkan.
                </p>
            </KasirCard>
        </KasirPage>
    );
}

Printer.layout = {
    breadcrumbs: [{ title: 'Pengaturan Printer', href: kasir.printer() }],
};
