/**
 * Rupiah with no decimals — stall prices are always whole thousands, and the
 * extra ",00" only makes the number slower to read at a glance.
 */
export function rupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(value);
}

/** Plain grouped number, for use next to a separate "Rp" label. */
export function angka(value: number): string {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        value,
    );
}

export function tanggalPanjang(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function jam(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function tanggalJam(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
