import { STATUS_BAYAR_LABEL, UKURAN_LABEL } from '@/offline/types';
import type { SalesTransaction } from '@/offline/types';
import { angka, tanggalJam } from './format';

/** Characters per line for the two thermal paper widths in circulation. */
export const PAPER_WIDTHS = {
    '58mm': 32,
    '80mm': 48,
} as const;

export type PaperWidth = keyof typeof PAPER_WIDTHS;

export type ReceiptShopInfo = {
    nama: string;
    alamat?: string | null;
    telepon?: string | null;
};

export type ReceiptInput = {
    transaction: SalesTransaction;
    /** Per-chicken price of the tier the transaction was rung up under. */
    harga: number;
    kasir: string;
    toko: ReceiptShopInfo;
    paper?: PaperWidth;
};

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Lays out `label` and `value` on one line, right-aligning the value and
 * truncating the label if the pair would overflow the paper.
 */
function pair(label: string, value: string, width: number): string {
    const gap = width - label.length - value.length;

    if (gap >= 1) {
        return label + ' '.repeat(gap) + value;
    }

    const room = Math.max(0, width - value.length - 1);

    return `${label.slice(0, room)} ${value}`;
}

function centre(text: string, width: number): string {
    if (text.length >= width) {
        return text.slice(0, width);
    }

    return ' '.repeat(Math.floor((width - text.length) / 2)) + text;
}

/**
 * Renders the receipt as plain text. Kept separate from the byte encoder so
 * the layout can be asserted in tests and previewed on screen without a
 * printer attached.
 */
export function renderReceiptText({
    transaction,
    harga,
    kasir,
    toko,
    paper = '58mm',
}: ReceiptInput): string {
    const width = PAPER_WIDTHS[paper];
    const rule = '-'.repeat(width);
    const lines: string[] = [];

    lines.push(centre(`TOKO AYAM POTONG ${toko.nama}`.toUpperCase(), width));

    if (toko.alamat) {
        lines.push(centre(toko.alamat, width));
    }

    if (toko.telepon) {
        lines.push(centre(toko.telepon, width));
    }

    lines.push(rule);
    lines.push(pair('Tanggal', tanggalJam(transaction.created_at), width));
    lines.push(pair('Kasir', kasir, width));
    lines.push(rule);

    if (transaction.ukuran) {
        lines.push(pair('Ukuran', UKURAN_LABEL[transaction.ukuran], width));
    }

    lines.push(pair('Harga/ekor', `Rp ${angka(harga)}`, width));
    lines.push(pair('Jumlah', `${transaction.jumlah_ekor} ekor`, width));
    lines.push(pair('Subtotal', `Rp ${angka(transaction.subtotal)}`, width));
    lines.push(rule);

    const status =
        transaction.status_bayar === 'utang' && transaction.nama_pembeli
            ? `Utang (a.n. ${transaction.nama_pembeli})`
            : STATUS_BAYAR_LABEL[transaction.status_bayar];

    lines.push(pair('Status', status, width));

    if (transaction.catatan) {
        lines.push(rule);
        lines.push(transaction.catatan);
    }

    lines.push(rule);
    lines.push(centre('Terima kasih!', width));

    return lines.join('\n');
}

/**
 * Builds the ESC/POS byte stream for one transaction.
 *
 * Exported on its own — with no Bluetooth involved — so receipt layout can be
 * verified in tests and previewed in the UI without a printer connected.
 */
export function generateReceiptBytes(input: ReceiptInput): Uint8Array {
    const body = renderReceiptText(input);
    const encoder = new TextEncoder();

    const bytes: number[] = [
        ESC,
        0x40, // initialise
        ESC,
        0x74,
        0x00, // code page 437, matches the ASCII we emit
        ESC,
        0x61,
        0x00, // left align; the text itself is pre-centred
    ];

    bytes.push(...encoder.encode(`${body}\n`));
    bytes.push(0x0a, 0x0a, 0x0a); // feed clear of the tear bar
    bytes.push(GS, 0x56, 0x42, 0x00); // partial cut, ignored by printers without a cutter

    return new Uint8Array(bytes);
}

/**
 * A short fixed receipt used by the "test print" button on the printer page.
 */
export function generateTestPrintBytes(paper: PaperWidth = '58mm'): Uint8Array {
    const width = PAPER_WIDTHS[paper];
    const encoder = new TextEncoder();
    const body = [
        centre('KASIR AYAM POTONG', width),
        centre('Tes Cetak', width),
        '-'.repeat(width),
        pair('Lebar kertas', paper, width),
        pair('Karakter/baris', String(width), width),
        pair('Waktu', tanggalJam(new Date().toISOString()), width),
        '-'.repeat(width),
        centre('Printer siap dipakai.', width),
    ].join('\n');

    return new Uint8Array([
        ESC,
        0x40,
        ...encoder.encode(`${body}\n`),
        0x0a,
        0x0a,
        0x0a,
        GS,
        0x56,
        0x42,
        0x00,
    ]);
}
