import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled SVG charts.
 *
 * Deliberately not a charting library: the dashboard needs five fixed forms,
 * and pulling in a dependency for that would cost more bundle than the whole
 * offline layer. Every mark follows the house spec — 2px lines, ≤24px bars with
 * a 4px rounded data-end, hairline solid gridlines, and a 2px surface gap
 * between touching fills so nothing needs a border drawn round it.
 */

/** Categorical slots, used in fixed order and never cycled. */
export const SERIES = {
    satu: '#2a78d6',
    dua: '#eb6834',
    tiga: '#1baf7a',
} as const;

/** Reserved status colours — only ever used where the colour *means* the state. */
export const STATUS_WARNA: Record<string, string> = {
    lunas_tunai: '#0ca30c',
    utang: '#fab219',
    belum_bayar: '#d03b3b',
};

const GRID = '#e2e8f0';
const AXIS_TEXT = '#64748b';
const SURFACE = '#ffffff';

function niceCeiling(value: number): number {
    if (value <= 0) {
        return 1;
    }

    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalised = value / magnitude;
    const step =
        normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

    return step * magnitude;
}

function ringkasAngka(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)} M`;
    }

    if (Math.abs(value) >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)} jt`;
    }

    if (Math.abs(value) >= 1_000) {
        return `${Math.round(value / 1_000)} rb`;
    }

    return String(Math.round(value));
}

function tanggalPendek(iso: string): string {
    const date = new Date(iso);

    return `${date.getDate()}/${date.getMonth() + 1}`;
}

export function ChartKosong({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-kasir-line text-sm text-kasir-text-muted">
            {children}
        </div>
    );
}

type TitikHarian = {
    tanggal: string;
    omzet: number;
    kumulatif: number;
    ekor: number;
};

/**
 * The S-curve: revenue accumulated over the period.
 *
 * A flat stretch is a day with no trading; a steepening slope is the shop
 * speeding up. Plotted as a single series, so it carries no legend — the card
 * title says what it is.
 */
export function KurvaS({ data }: { data: TitikHarian[] }) {
    const gradientId = useId();
    const [aktif, setAktif] = useState<number | null>(null);

    if (data.length < 2) {
        return (
            <ChartKosong>
                Butuh minimal 2 hari data untuk menggambar kurva.
            </ChartKosong>
        );
    }

    const width = 760;
    const height = 260;
    const pad = { atas: 16, kanan: 16, bawah: 34, kiri: 62 };
    const plotW = width - pad.kiri - pad.kanan;
    const plotH = height - pad.atas - pad.bawah;

    const maks = niceCeiling(Math.max(...data.map((d) => d.kumulatif)));
    const x = (index: number) => pad.kiri + (index / (data.length - 1)) * plotW;
    const y = (value: number) => pad.atas + plotH - (value / maks) * plotH;

    const garis = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.kumulatif)}`)
        .join(' ');
    const area = `${garis} L ${x(data.length - 1)} ${pad.atas + plotH} L ${x(0)} ${pad.atas + plotH} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maks);
    const terakhir = data[data.length - 1];
    const titik = aktif === null ? null : data[aktif];

    return (
        <figure className="m-0">
            <div className="overflow-x-auto">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-64 w-full min-w-[520px]"
                    role="img"
                    aria-label={`Kurva S omzet kumulatif, mencapai ${ringkasAngka(terakhir.kumulatif)} rupiah`}
                    onMouseLeave={() => setAktif(null)}
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={SERIES.satu}
                                stopOpacity="0.18"
                            />
                            <stop
                                offset="100%"
                                stopColor={SERIES.satu}
                                stopOpacity="0.02"
                            />
                        </linearGradient>
                    </defs>

                    {ticks.map((nilai) => (
                        <g key={nilai}>
                            <line
                                x1={pad.kiri}
                                x2={width - pad.kanan}
                                y1={y(nilai)}
                                y2={y(nilai)}
                                stroke={GRID}
                                strokeWidth="1"
                            />
                            <text
                                x={pad.kiri - 8}
                                y={y(nilai) + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill={AXIS_TEXT}
                            >
                                {ringkasAngka(nilai)}
                            </text>
                        </g>
                    ))}

                    <path d={area} fill={`url(#${gradientId})`} />
                    <path
                        d={garis}
                        fill="none"
                        stroke={SERIES.satu}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {/* Endpoint carries the only direct label — the running total. */}
                    <circle
                        cx={x(data.length - 1)}
                        cy={y(terakhir.kumulatif)}
                        r="5"
                        fill={SERIES.satu}
                        stroke={SURFACE}
                        strokeWidth="2"
                    />

                    {titik && aktif !== null && (
                        <g>
                            <line
                                x1={x(aktif)}
                                x2={x(aktif)}
                                y1={pad.atas}
                                y2={pad.atas + plotH}
                                stroke={AXIS_TEXT}
                                strokeWidth="1"
                            />
                            <circle
                                cx={x(aktif)}
                                cy={y(titik.kumulatif)}
                                r="5"
                                fill={SERIES.satu}
                                stroke={SURFACE}
                                strokeWidth="2"
                            />
                        </g>
                    )}

                    {data.map((d, i) => (
                        <rect
                            key={d.tanggal}
                            x={x(i) - plotW / data.length / 2}
                            y={pad.atas}
                            width={Math.max(plotW / data.length, 6)}
                            height={plotH}
                            fill="transparent"
                            onMouseEnter={() => setAktif(i)}
                        />
                    ))}

                    {[
                        0,
                        Math.floor((data.length - 1) / 2),
                        data.length - 1,
                    ].map((i) => (
                        <text
                            key={i}
                            x={x(i)}
                            y={height - 12}
                            textAnchor={
                                i === 0
                                    ? 'start'
                                    : i === data.length - 1
                                      ? 'end'
                                      : 'middle'
                            }
                            fontSize="11"
                            fill={AXIS_TEXT}
                        >
                            {tanggalPendek(data[i].tanggal)}
                        </text>
                    ))}
                </svg>
            </div>

            <figcaption className="mt-2 text-sm text-kasir-text-muted">
                {titik ? (
                    <>
                        <span className="font-semibold text-kasir-text">
                            {tanggalPendek(titik.tanggal)}
                        </span>{' '}
                        — kumulatif Rp {ringkasAngka(titik.kumulatif)}, hari itu
                        Rp {ringkasAngka(titik.omzet)}
                    </>
                ) : (
                    <>
                        Total terkumpul{' '}
                        <span className="tabular text-kasir-text">
                            Rp {ringkasAngka(terakhir.kumulatif)}
                        </span>{' '}
                        selama {data.length} sesi. Arahkan kursor untuk detail
                        per hari.
                    </>
                )}
            </figcaption>
        </figure>
    );
}

/**
 * Daily revenue as columns. One series, so slot 1 for every bar — colouring
 * each column by its own height would spend the identity channel re-encoding
 * what the height already shows.
 */
export function BarHarian({ data }: { data: TitikHarian[] }) {
    const [aktif, setAktif] = useState<number | null>(null);

    if (data.length === 0) {
        return <ChartKosong>Belum ada sesi pada periode ini.</ChartKosong>;
    }

    const width = 760;
    const height = 240;
    const pad = { atas: 16, kanan: 16, bawah: 34, kiri: 62 };
    const plotW = width - pad.kiri - pad.kanan;
    const plotH = height - pad.atas - pad.bawah;

    const maks = niceCeiling(Math.max(...data.map((d) => d.omzet), 1));
    const slot = plotW / data.length;
    const lebar = Math.min(24, Math.max(2, slot - 2));
    const ticks = [0, 0.5, 1].map((f) => f * maks);
    const titik = aktif === null ? null : data[aktif];

    return (
        <figure className="m-0">
            <div className="overflow-x-auto">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-60 w-full min-w-[520px]"
                    role="img"
                    aria-label="Omzet per hari"
                    onMouseLeave={() => setAktif(null)}
                >
                    {ticks.map((nilai) => (
                        <g key={nilai}>
                            <line
                                x1={pad.kiri}
                                x2={width - pad.kanan}
                                y1={pad.atas + plotH - (nilai / maks) * plotH}
                                y2={pad.atas + plotH - (nilai / maks) * plotH}
                                stroke={GRID}
                                strokeWidth="1"
                            />
                            <text
                                x={pad.kiri - 8}
                                y={
                                    pad.atas +
                                    plotH -
                                    (nilai / maks) * plotH +
                                    4
                                }
                                textAnchor="end"
                                fontSize="11"
                                fill={AXIS_TEXT}
                            >
                                {ringkasAngka(nilai)}
                            </text>
                        </g>
                    ))}

                    {data.map((d, i) => {
                        const tinggi = (d.omzet / maks) * plotH;

                        return (
                            <g key={d.tanggal} onMouseEnter={() => setAktif(i)}>
                                <rect
                                    x={pad.kiri + i * slot}
                                    y={pad.atas}
                                    width={slot}
                                    height={plotH}
                                    fill="transparent"
                                />
                                <rect
                                    x={pad.kiri + i * slot + (slot - lebar) / 2}
                                    y={pad.atas + plotH - tinggi}
                                    width={lebar}
                                    height={Math.max(
                                        tinggi,
                                        d.omzet > 0 ? 2 : 0,
                                    )}
                                    rx="2"
                                    fill={SERIES.satu}
                                    opacity={
                                        aktif === null || aktif === i ? 1 : 0.45
                                    }
                                />
                            </g>
                        );
                    })}

                    <line
                        x1={pad.kiri}
                        x2={width - pad.kanan}
                        y1={pad.atas + plotH}
                        y2={pad.atas + plotH}
                        stroke={GRID}
                        strokeWidth="1"
                    />

                    {[
                        0,
                        Math.floor((data.length - 1) / 2),
                        data.length - 1,
                    ].map((i) => (
                        <text
                            key={i}
                            x={pad.kiri + i * slot + slot / 2}
                            y={height - 12}
                            textAnchor="middle"
                            fontSize="11"
                            fill={AXIS_TEXT}
                        >
                            {tanggalPendek(data[i].tanggal)}
                        </text>
                    ))}
                </svg>
            </div>

            <figcaption className="mt-2 text-sm text-kasir-text-muted">
                {titik ? (
                    <>
                        <span className="font-semibold text-kasir-text">
                            {tanggalPendek(titik.tanggal)}
                        </span>{' '}
                        — Rp {ringkasAngka(titik.omzet)} · {titik.ekor} ekor
                    </>
                ) : (
                    'Arahkan kursor pada batang untuk melihat omzet per hari.'
                )}
            </figcaption>
        </figure>
    );
}

/**
 * Horizontal bars for sales per price level.
 *
 * Price is an ordered scale, so the bars take one hue stepping darker as the
 * price rises — the reader sees the order in the colour, not just the position.
 */
export function BarHarga({
    data,
}: {
    data: { harga: number; ekor: number; total: number }[];
}) {
    if (data.length === 0) {
        return <ChartKosong>Belum ada penjualan pada periode ini.</ChartKosong>;
    }

    const maks = Math.max(...data.map((d) => d.ekor), 1);
    /** Ordinal ramp, light → dark, from the documented blue scale. */
    const ramp = [
        '#86b6ef',
        '#6da7ec',
        '#3987e5',
        '#2a78d6',
        '#1c5cab',
        '#184f95',
    ];

    return (
        <ul className="space-y-3">
            {data.map((baris, index) => (
                <li key={baris.harga}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="tabular text-kasir-text">
                            Rp {ringkasAngka(baris.harga)}
                        </span>
                        <span className="text-kasir-text-muted">
                            <span className="tabular text-kasir-text">
                                {baris.ekor}
                            </span>{' '}
                            ekor · Rp {ringkasAngka(baris.total)}
                        </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-kasir-surface-alt">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.max((baris.ekor / maks) * 100, 2)}%`,
                                backgroundColor:
                                    ramp[Math.min(index, ramp.length - 1)],
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

type BarisUkuran = {
    ukuran: string;
    label: string;
    masuk: number;
    terjual: number;
    mati: number;
    sisa: number;
};

/**
 * Stacked bars showing what became of each size's intake.
 *
 * Part-to-whole: terjual + sisa + mati adds back up to what came in, so a
 * stack answers "where did the stock go" in one read. Segments are separated
 * by a 2px surface gap rather than a stroke.
 */
export function StackUkuran({ data }: { data: BarisUkuran[] }) {
    const terpakai = data.filter(
        (baris) => baris.masuk > 0 || baris.terjual > 0,
    );

    if (terpakai.length === 0) {
        return (
            <ChartKosong>Belum ada stok masuk pada periode ini.</ChartKosong>
        );
    }

    const maks = Math.max(
        ...terpakai.map((d) => Math.max(d.masuk, d.terjual + d.mati)),
        1,
    );

    const segmen = [
        { kunci: 'terjual' as const, label: 'Terjual', warna: SERIES.satu },
        { kunci: 'sisa' as const, label: 'Sisa', warna: SERIES.tiga },
        { kunci: 'mati' as const, label: 'Mati', warna: SERIES.dua },
    ];

    return (
        <div>
            <ul className="space-y-3">
                {terpakai.map((baris) => (
                    <li key={baris.ukuran}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-semibold text-kasir-text">
                                {baris.label}
                            </span>
                            <span className="text-kasir-text-muted">
                                masuk{' '}
                                <span className="tabular text-kasir-text">
                                    {baris.masuk}
                                </span>{' '}
                                ekor
                            </span>
                        </div>
                        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-kasir-surface-alt">
                            {segmen.map((s) => {
                                const nilai = Math.max(baris[s.kunci], 0);

                                return nilai === 0 ? null : (
                                    <div
                                        key={s.kunci}
                                        title={`${s.label}: ${nilai} ekor`}
                                        style={{
                                            width: `${(nilai / maks) * 100}%`,
                                            backgroundColor: s.warna,
                                        }}
                                    />
                                );
                            })}
                        </div>
                        <p className="mt-1 text-xs text-kasir-text-muted">
                            terjual {baris.terjual} · sisa {baris.sisa} · mati{' '}
                            {baris.mati}
                        </p>
                    </li>
                ))}
            </ul>

            <Legenda
                items={segmen.map((s) => ({ label: s.label, warna: s.warna }))}
                className="mt-4"
            />
        </div>
    );
}

/**
 * Payment mix. Uses the reserved status palette because the colour here means
 * a state — settled, owed, unpaid — not a series identity.
 */
export function StackStatusBayar({
    data,
}: {
    data: { status: string; label: string; total: number; jumlah: number }[];
}) {
    const total = data.reduce((sum, baris) => sum + baris.total, 0);

    if (total <= 0) {
        return <ChartKosong>Belum ada transaksi pada periode ini.</ChartKosong>;
    }

    return (
        <div>
            <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-kasir-surface-alt">
                {data.map((baris) =>
                    baris.total === 0 ? null : (
                        <div
                            key={baris.status}
                            title={`${baris.label}: ${ringkasAngka(baris.total)}`}
                            style={{
                                width: `${(baris.total / total) * 100}%`,
                                backgroundColor: STATUS_WARNA[baris.status],
                            }}
                        />
                    ),
                )}
            </div>

            <ul className="mt-4 space-y-2 text-sm">
                {data.map((baris) => (
                    <li key={baris.status} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{
                                backgroundColor: STATUS_WARNA[baris.status],
                            }}
                        />
                        <span className="text-kasir-text">{baris.label}</span>
                        <span className="ml-auto text-kasir-text-muted">
                            {baris.jumlah} transaksi
                        </span>
                        <span className="tabular w-24 text-right text-kasir-text">
                            Rp {ringkasAngka(baris.total)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function Legenda({
    items,
    className,
}: {
    items: { label: string; warna: string }[];
    className?: string;
}) {
    return (
        <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs', className)}>
            {items.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: item.warna }}
                    />
                    <span className="text-kasir-text-muted">{item.label}</span>
                </li>
            ))}
        </ul>
    );
}

export { ringkasAngka, tanggalPendek };
