import { db } from './db';
import type {
    CashOut,
    DailySession,
    DeadChicken,
    EmployeeOvertime,
    PriceTier,
    SalesTransaction,
    StatusBayar,
    StockIntake,
    UkuranAyam,
} from './types';
import { UKURAN_AYAM } from './types';

/** Local date in `YYYY-MM-DD`, matching the server's `tanggal` column. */
export function todayIso(): string {
    const now = new Date();
    const offsetMinutes = now.getTimezoneOffset();

    return new Date(now.getTime() - offsetMinutes * 60_000)
        .toISOString()
        .slice(0, 10);
}

export async function findSessionForToday(): Promise<DailySession | undefined> {
    return db.daily_sessions.where('tanggal').equals(todayIso()).first();
}

export async function findPriceTiers(sessionId: string): Promise<PriceTier[]> {
    const tiers = await db.price_tiers
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();

    return tiers.sort((a, b) => a.urutan - b.urutan || a.harga - b.harga);
}

export async function findStockIntakes(
    sessionId: string,
): Promise<StockIntake[]> {
    return db.stock_intakes
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();
}

/**
 * Transactions for a session, newest first. Cancelled rows are included so the
 * cashier can see what was voided; filter with `dibatalkan_pada` when summing.
 */
export async function findTransactions(
    sessionId: string,
): Promise<SalesTransaction[]> {
    const transactions = await db.sales_transactions
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();

    return transactions.sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
    );
}

export async function findCashOuts(sessionId: string): Promise<CashOut[]> {
    const rows = await db.cash_outs
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();

    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function findDeadChickens(
    sessionId: string,
): Promise<DeadChicken[]> {
    const rows = await db.dead_chickens
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();

    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function findOvertimes(
    sessionId: string,
): Promise<EmployeeOvertime[]> {
    const rows = await db.employee_overtimes
        .where('daily_session_id')
        .equals(sessionId)
        .toArray();

    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export type TierSummary = {
    tier: PriceTier;
    jumlahEkor: number;
    jumlahTransaksi: number;
    total: number;
};

export type UkuranSummary = {
    ukuran: UkuranAyam;
    masuk: number;
    terjual: number;
    mati: number;
    sisa: number;
};

export type SessionSummary = {
    totalPenjualan: number;
    totalEkorTerjual: number;
    totalTunai: number;
    totalPiutang: number;
    totalBelumBayar: number;
    totalUangKeluar: number;
    totalAyamMati: number;
    kasSeharusnya: number;
    perTingkatanHarga: TierSummary[];
    perUkuran: UkuranSummary[];
};

function sumBy<T>(rows: T[], pick: (row: T) => number): number {
    return rows.reduce((total, row) => total + pick(row), 0);
}

/**
 * The same arithmetic the server's report performs, run against local data so
 * the closing screen still shows real numbers while offline.
 */
export function summarise(
    tiers: PriceTier[],
    intakes: StockIntake[],
    transactions: SalesTransaction[],
    cashOuts: CashOut[],
    deadChickens: DeadChicken[],
): SessionSummary {
    const aktif = transactions.filter(
        (transaction) => transaction.dibatalkan_pada === null,
    );
    const withStatus = (status: StatusBayar) =>
        aktif.filter((transaction) => transaction.status_bayar === status);

    const totalTunai = sumBy(withStatus('lunas_tunai'), (t) => t.subtotal);
    const totalUangKeluar = sumBy(cashOuts, (row) => row.jumlah);

    return {
        totalPenjualan: sumBy(aktif, (t) => t.subtotal),
        totalEkorTerjual: sumBy(aktif, (t) => t.jumlah_ekor),
        totalTunai,
        totalPiutang: sumBy(withStatus('utang'), (t) => t.subtotal),
        totalBelumBayar: sumBy(withStatus('belum_bayar'), (t) => t.subtotal),
        totalUangKeluar,
        totalAyamMati: sumBy(deadChickens, (row) => row.jumlah_ekor),
        kasSeharusnya: totalTunai - totalUangKeluar,
        perTingkatanHarga: tiers.map((tier) => {
            const rows = aktif.filter(
                (transaction) => transaction.price_tier_id === tier.id,
            );

            return {
                tier,
                jumlahEkor: sumBy(rows, (t) => t.jumlah_ekor),
                jumlahTransaksi: rows.length,
                total: sumBy(rows, (t) => t.subtotal),
            };
        }),
        perUkuran: UKURAN_AYAM.map((ukuran) => {
            const masuk = sumBy(
                intakes.filter((row) => row.ukuran === ukuran),
                (row) => row.jumlah_ekor,
            );
            const terjual = sumBy(
                aktif.filter((row) => row.ukuran === ukuran),
                (row) => row.jumlah_ekor,
            );
            const mati = sumBy(
                deadChickens.filter((row) => row.ukuran === ukuran),
                (row) => row.jumlah_ekor,
            );

            return {
                ukuran,
                masuk,
                terjual,
                mati,
                sisa: masuk - terjual - mati,
            };
        }),
    };
}
