import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type {
    CashOut,
    CashReconciliation,
    DailySession,
    DeadChicken,
    EmployeeOvertime,
    PriceTier,
    SalesTransaction,
    StockIntake,
    SyncMeta,
    SyncMutation,
} from './types';

/**
 * The cashier device's source of truth. Every screen reads from here so the
 * UI stays instant and fully usable with no connection; `sync.ts` replicates
 * these tables to Laravel whenever the network comes back.
 */
export class KasirDatabase extends Dexie {
    daily_sessions!: EntityTable<DailySession, 'id'>;
    price_tiers!: EntityTable<PriceTier, 'id'>;
    stock_intakes!: EntityTable<StockIntake, 'id'>;
    sales_transactions!: EntityTable<SalesTransaction, 'id'>;
    cash_outs!: EntityTable<CashOut, 'id'>;
    dead_chickens!: EntityTable<DeadChicken, 'id'>;
    employee_overtimes!: EntityTable<EmployeeOvertime, 'id'>;
    cash_reconciliations!: EntityTable<CashReconciliation, 'id'>;
    sync_queue!: EntityTable<SyncMutation, 'queue_id'>;
    sync_meta!: EntityTable<SyncMeta, 'key'>;

    constructor() {
        super('kasir-ayam-potong');

        this.version(1).stores({
            daily_sessions: 'id, tanggal, status',
            price_tiers: 'id, daily_session_id, urutan',
            stock_intakes: 'id, daily_session_id, ukuran',
            sales_transactions:
                'id, daily_session_id, price_tier_id, status_bayar, created_at, dibatalkan_pada',
            cash_outs: 'id, daily_session_id, created_at',
            dead_chickens: 'id, daily_session_id, ukuran',
            employee_overtimes: 'id, daily_session_id, nama_karyawan',
            cash_reconciliations: 'id, daily_session_id',
            sync_queue: '++queue_id, id, table, updated_at',
            sync_meta: 'key',
        });
    }
}

export const db = new KasirDatabase();

/** Key under which the last successful pull cursor is stored. */
export const LAST_PULL_KEY = 'last_pulled_at';

export async function readMeta(key: string): Promise<string | null> {
    return (await db.sync_meta.get(key))?.value ?? null;
}

export async function writeMeta(
    key: string,
    value: string | null,
): Promise<void> {
    await db.sync_meta.put({ key, value });
}
