import type { PaperWidth, ReceiptShopInfo } from './escpos';

/**
 * Serial-over-GATT service exposed by essentially every cheap ESC/POS thermal
 * printer. `optionalServices` also lists the two other UUIDs seen in the wild
 * so pairing does not fail on a printer that advertises a different one.
 */
const PRINTER_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC = '00002af1-0000-1000-8000-00805f9b34fb';
const FALLBACK_SERVICES = [
    PRINTER_SERVICE,
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

/** GATT writes cap out around 512 bytes; 180 is safe on low-end printers. */
const CHUNK_SIZE = 180;

export type PrinterSettings = {
    paper: PaperWidth;
    toko: ReceiptShopInfo;
    /** Name of the last paired device, shown so the cashier knows what to pick. */
    lastDeviceName: string | null;
    /** Whether a receipt should be sent automatically after each sale. */
    autoPrint: boolean;
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
    paper: '58mm',
    toko: { nama: 'Ayam Potong', alamat: null, telepon: null },
    lastDeviceName: null,
    autoPrint: true,
};

const SETTINGS_KEY = 'kasir.printer.settings';

export function readPrinterSettings(): PrinterSettings {
    if (typeof localStorage === 'undefined') {
        return DEFAULT_PRINTER_SETTINGS;
    }

    try {
        const raw = localStorage.getItem(SETTINGS_KEY);

        return raw
            ? {
                  ...DEFAULT_PRINTER_SETTINGS,
                  ...(JSON.parse(raw) as Partial<PrinterSettings>),
              }
            : DEFAULT_PRINTER_SETTINGS;
    } catch {
        return DEFAULT_PRINTER_SETTINGS;
    }
}

export function writePrinterSettings(settings: PrinterSettings): void {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Web Bluetooth is Chromium-only and is not implemented on iOS at all — not
 * even in Chrome for iOS, which is Safari underneath. Callers use this to show
 * the cashier why the print button is unavailable instead of failing silently.
 */
export function isBluetoothSupported(): boolean {
    return (
        typeof navigator !== 'undefined' && navigator.bluetooth !== undefined
    );
}

export class PrinterUnsupportedError extends Error {
    constructor() {
        super(
            'Perangkat ini tidak mendukung Web Bluetooth. Cetak Bluetooth langsung hanya jalan di Chrome/Edge pada Android, Windows, macOS, atau Linux — tidak di iPhone/iPad.',
        );
        this.name = 'PrinterUnsupportedError';
    }
}

export class PrinterNotConnectedError extends Error {
    constructor() {
        super(
            'Printer belum terhubung. Buka Pengaturan Printer lalu sambungkan dulu.',
        );
        this.name = 'PrinterNotConnectedError';
    }
}

let device: BluetoothDevice | null = null;
let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

export function connectedPrinterName(): string | null {
    return device?.gatt?.connected ? (device.name ?? 'Printer') : null;
}

export function isPrinterConnected(): boolean {
    return characteristic !== null && device?.gatt?.connected === true;
}

/**
 * Opens the browser's device chooser and connects to the selected printer.
 * Must be called from a user gesture — that is a Web Bluetooth requirement,
 * which is also why the connection cannot be restored silently on page load.
 */
export async function connectPrinter(): Promise<string> {
    if (!isBluetoothSupported()) {
        throw new PrinterUnsupportedError();
    }

    const selected = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: FALLBACK_SERVICES,
    });

    const server = await selected.gatt?.connect();

    if (!server) {
        throw new Error('Tidak bisa membuka koneksi GATT ke printer.');
    }

    characteristic = await resolveWritableCharacteristic(server);
    device = selected;

    selected.addEventListener('gattserverdisconnected', () => {
        characteristic = null;
    });

    return selected.name ?? 'Printer';
}

/**
 * Finds a characteristic that accepts writes, trying the standard printer
 * service first and then scanning whatever the device does advertise.
 */
async function resolveWritableCharacteristic(
    server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
    try {
        const service = await server.getPrimaryService(PRINTER_SERVICE);

        return await service.getCharacteristic(PRINTER_CHARACTERISTIC);
    } catch {
        const services = await server.getPrimaryServices();

        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            const writable = characteristics.find(
                (candidate) =>
                    typeof candidate.writeValue === 'function' ||
                    typeof candidate.writeValueWithoutResponse === 'function',
            );

            if (writable) {
                return writable;
            }
        }
    }

    throw new Error('Printer tidak punya karakteristik tulis yang dikenali.');
}

export function disconnectPrinter(): void {
    device?.gatt?.disconnect();
    device = null;
    characteristic = null;
}

/**
 * Streams an ESC/POS payload to the connected printer in small chunks, which
 * these printers need — a single large write silently drops bytes.
 */
export async function printBytes(bytes: Uint8Array): Promise<void> {
    if (!isBluetoothSupported()) {
        throw new PrinterUnsupportedError();
    }

    if (!characteristic || device?.gatt?.connected !== true) {
        throw new PrinterNotConnectedError();
    }

    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.slice(offset, offset + CHUNK_SIZE);

        if (characteristic.writeValueWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
        } else {
            await characteristic.writeValue(chunk);
        }

        /* Give the print head time to drain its buffer before the next chunk. */
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}
