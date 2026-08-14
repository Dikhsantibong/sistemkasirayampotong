export const UKURAN_AYAM = [
    'jumbo',
    'sedang',
    'kecil',
    'sisa_kemarin',
] as const;

export type UkuranAyam = (typeof UKURAN_AYAM)[number];

export const UKURAN_LABEL: Record<UkuranAyam, string> = {
    jumbo: 'Jumbo',
    sedang: 'Sedang',
    kecil: 'Kecil',
    sisa_kemarin: 'Sisa Kemarin',
};

export const STATUS_BAYAR = ['lunas_tunai', 'utang', 'belum_bayar'] as const;

export type StatusBayar = (typeof STATUS_BAYAR)[number];

export const STATUS_BAYAR_LABEL: Record<StatusBayar, string> = {
    lunas_tunai: 'Lunas Tunai',
    utang: 'Utang',
    belum_bayar: 'Belum Bayar',
};

export type StatusSesi = 'buka' | 'ditutup';

/**
 * Every replicated row carries these. `updated_at` is what the server uses to
 * settle last-write-wins conflicts, so it must be bumped on every local edit.
 */
type Replicated = {
    id: string;
    created_at: string;
    updated_at: string;
};

export type DailySession = Replicated & {
    tanggal: string;
    status: StatusSesi;
    dibuka_oleh: string;
    ditutup_oleh: string | null;
    catatan_penutupan: string | null;
    ditutup_pada: string | null;
};

export type PriceTier = Replicated & {
    daily_session_id: string;
    harga: number;
    urutan: number;
};

export type StockIntake = Replicated & {
    daily_session_id: string;
    ukuran: UkuranAyam;
    jumlah_ekor: number;
    catatan: string | null;
};

export type SalesTransaction = Replicated & {
    daily_session_id: string;
    price_tier_id: string;
    ukuran: UkuranAyam | null;
    jumlah_ekor: number;
    subtotal: number;
    status_bayar: StatusBayar;
    nama_pembeli: string | null;
    catatan: string | null;
    dibatalkan_pada: string | null;
    alasan_pembatalan: string | null;
};

export type CashOut = Replicated & {
    daily_session_id: string;
    jumlah: number;
    keterangan: string;
};

export type DeadChicken = Replicated & {
    daily_session_id: string;
    ukuran: UkuranAyam;
    jumlah_ekor: number;
    keterangan: string | null;
};

export type EmployeeOvertime = Replicated & {
    daily_session_id: string;
    nama_karyawan: string;
    jam_mulai: string;
    jam_selesai: string;
    keterangan: string | null;
};

export type CashReconciliation = Replicated & {
    daily_session_id: string;
    uang_tunai_fisik: number;
    uang_catatan_piutang: number;
    uang_lebih_kurang: number;
    lain_lain: number | null;
    catatan: string | null;
};

/**
 * Table names shared verbatim with the Laravel sync endpoints.
 * The order matters — a batch is pushed in this order so parent rows land
 * before the rows referencing them.
 */
export const SYNC_TABLES = [
    'daily_sessions',
    'price_tiers',
    'stock_intakes',
    'sales_transactions',
    'cash_outs',
    'dead_chickens',
    'employee_overtimes',
    'cash_reconciliations',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export type SyncTableRow = {
    daily_sessions: DailySession;
    price_tiers: PriceTier;
    stock_intakes: StockIntake;
    sales_transactions: SalesTransaction;
    cash_outs: CashOut;
    dead_chickens: DeadChicken;
    employee_overtimes: EmployeeOvertime;
    cash_reconciliations: CashReconciliation;
};

/**
 * One pending replication of a local write. Kept until the server confirms it.
 */
export type SyncMutation = {
    /** Auto-incremented queue position, not the row id. */
    queue_id?: number;
    id: string;
    table: SyncTable;
    operation: 'upsert' | 'delete';
    payload: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    attempts: number;
    last_error: string | null;
};

export type SyncMeta = {
    key: string;
    value: string | null;
};

export type PushResult = {
    id: string;
    /** `forbidden` means the role may not make this write — retrying is futile. */
    status: 'applied' | 'skipped' | 'rejected' | 'forbidden' | 'failed';
    table: SyncTable;
    message?: string;
    errors?: Record<string, string[]>;
};

export const PERAN_PENGGUNA = ['pemilik', 'kasir'] as const;

export type PeranPengguna = (typeof PERAN_PENGGUNA)[number];

export const PERAN_LABEL: Record<PeranPengguna, string> = {
    pemilik: 'Pemilik',
    kasir: 'Kasir',
};
