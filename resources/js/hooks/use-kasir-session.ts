import { useLiveQuery } from 'dexie-react-hooks';
import {
    findCashOuts,
    findDeadChickens,
    findOvertimes,
    findPriceTiers,
    findSessionForToday,
    findStockIntakes,
    findTransactions,
    summarise,
} from '@/offline/queries';
import type { SessionSummary } from '@/offline/queries';
import type {
    CashOut,
    DailySession,
    DeadChicken,
    EmployeeOvertime,
    PriceTier,
    SalesTransaction,
    StockIntake,
} from '@/offline/types';

export type KasirSession = {
    /** Undefined until Dexie has answered; null once we know there is none. */
    session: DailySession | null | undefined;
    priceTiers: PriceTier[];
    stockIntakes: StockIntake[];
    transactions: SalesTransaction[];
    cashOuts: CashOut[];
    deadChickens: DeadChicken[];
    overtimes: EmployeeOvertime[];
    summary: SessionSummary | null;
    loading: boolean;
};

const EMPTY: Omit<KasirSession, 'session' | 'loading' | 'summary'> = {
    priceTiers: [],
    stockIntakes: [],
    transactions: [],
    cashOuts: [],
    deadChickens: [],
    overtimes: [],
};

/**
 * Everything the kasir screens need about today, read straight from Dexie and
 * re-rendered automatically on every local write.
 */
export function useKasirSession(): KasirSession {
    const session = useLiveQuery(
        async () => (await findSessionForToday()) ?? null,
        [],
    );

    const data = useLiveQuery(async () => {
        if (!session) {
            return null;
        }

        const [
            priceTiers,
            stockIntakes,
            transactions,
            cashOuts,
            deadChickens,
            overtimes,
        ] = await Promise.all([
            findPriceTiers(session.id),
            findStockIntakes(session.id),
            findTransactions(session.id),
            findCashOuts(session.id),
            findDeadChickens(session.id),
            findOvertimes(session.id),
        ]);

        return {
            priceTiers,
            stockIntakes,
            transactions,
            cashOuts,
            deadChickens,
            overtimes,
        };
    }, [session?.id]);

    if (!data) {
        return {
            ...EMPTY,
            session,
            summary: null,
            loading:
                session === undefined ||
                (session !== null && data === undefined),
        };
    }

    return {
        ...data,
        session,
        summary: summarise(
            data.priceTiers,
            data.stockIntakes,
            data.transactions,
            data.cashOuts,
            data.deadChickens,
        ),
        loading: false,
    };
}
