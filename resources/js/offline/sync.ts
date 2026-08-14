import type { Table } from 'dexie';
import { LAST_PULL_KEY, db, readMeta, writeMeta } from './db';
import { SYNC_TABLES } from './types';
import type { PushResult, SyncMutation, SyncTable } from './types';

const PUSH_URL = '/kasir/sync/push';
const PULL_URL = '/kasir/sync/pull';
const BATCH_SIZE = 200;

/** A mutation that keeps failing is parked so it can't block the whole queue. */
const MAX_ATTEMPTS = 10;

export type SyncState = {
    online: boolean;
    syncing: boolean;
    pending: number;
    lastSyncedAt: string | null;
    lastError: string | null;
    /** Server refused a write because of the user's role. */
    lastRefusal: string | null;
};

type Listener = (state: SyncState) => void;

let state: SyncState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
    pending: 0,
    lastSyncedAt: null,
    lastError: null,
    lastRefusal: null,
};

const listeners = new Set<Listener>();

function emit(patch: Partial<SyncState>): void {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
}

export function getSyncState(): SyncState {
    return state;
}

export function subscribeToSync(listener: Listener): () => void {
    listeners.add(listener);
    listener(state);

    return () => {
        listeners.delete(listener);
    };
}

function readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));

    return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Laravel accepts the decrypted XSRF cookie echoed back in this header, which
 * keeps the sync calls working on pages served long before the request.
 */
function syncHeaders(): HeadersInit {
    const token = readCookie('XSRF-TOKEN');

    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { 'X-XSRF-TOKEN': token } : {}),
    };
}

export async function countPending(): Promise<number> {
    return db.sync_queue.count();
}

/**
 * Send queued mutations to the server, oldest first, parents before children.
 */
async function pushPending(): Promise<void> {
    const queued = await db.sync_queue.toArray();
    const sendable = queued
        .filter((mutation) => mutation.attempts < MAX_ATTEMPTS)
        .sort((a, b) => {
            const byTable =
                SYNC_TABLES.indexOf(a.table) - SYNC_TABLES.indexOf(b.table);

            return byTable !== 0
                ? byTable
                : (a.queue_id ?? 0) - (b.queue_id ?? 0);
        });

    for (let index = 0; index < sendable.length; index += BATCH_SIZE) {
        const batch = sendable.slice(index, index + BATCH_SIZE);

        const response = await fetch(PUSH_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: syncHeaders(),
            body: JSON.stringify({
                mutations: batch.map((mutation) => ({
                    id: mutation.id,
                    table: mutation.table,
                    operation: mutation.operation,
                    payload: mutation.payload,
                    created_at: mutation.created_at,
                    updated_at: mutation.updated_at,
                })),
            }),
        });

        if (!response.ok) {
            throw new Error(`Push gagal (HTTP ${response.status}).`);
        }

        const { results } = (await response.json()) as {
            results: PushResult[];
        };

        await resolveBatch(batch, results);
    }
}

/**
 * Drop confirmed mutations from the queue; keep the ones the server could not
 * apply yet (usually a parent row that has not landed) so they retry later.
 *
 * A `forbidden` result is dropped rather than retried — the role will not
 * change by trying again. The local row is left stale on purpose: the pull
 * that runs straight after this overwrites it with the server's version, so
 * the device ends up agreeing with the books rather than with itself.
 */
async function resolveBatch(
    batch: SyncMutation[],
    results: PushResult[],
): Promise<void> {
    const byId = new Map(
        results.map((result) => [`${result.table}:${result.id}`, result]),
    );

    let refusal: string | null = null;

    await db.transaction('rw', db.sync_queue, async () => {
        for (const mutation of batch) {
            const result = byId.get(`${mutation.table}:${mutation.id}`);

            if (!result) {
                continue;
            }

            if (result.status === 'failed') {
                await db.sync_queue.update(mutation.queue_id as number, {
                    attempts: mutation.attempts + 1,
                    last_error: result.message ?? 'Gagal disinkronkan.',
                });

                continue;
            }

            if (result.status === 'forbidden') {
                refusal =
                    result.message ??
                    'Perubahan ditolak: peran Anda tidak berwenang.';
            }

            await db.sync_queue.delete(mutation.queue_id as number);
        }
    });

    if (refusal !== null) {
        emit({ lastRefusal: refusal });
    }
}

/**
 * Merge server-side changes into the local database.
 *
 * Rows written straight from a pull are never re-queued: they already exist
 * on the server, so echoing them back would be a pointless round trip.
 */
async function pullChanges(): Promise<void> {
    const since = await readMeta(LAST_PULL_KEY);
    const url = since
        ? `${PULL_URL}?since=${encodeURIComponent(since)}`
        : PULL_URL;

    const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: syncHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Pull gagal (HTTP ${response.status}).`);
    }

    const { tables, server_time: serverTime } = (await response.json()) as {
        tables: Record<SyncTable, Record<string, unknown>[]>;
        server_time: string;
    };

    /** A row still waiting to be pushed is newer locally — don't overwrite it. */
    const queuedIds = new Set(
        (await db.sync_queue.toArray()).map(
            (mutation) => `${mutation.table}:${mutation.id}`,
        ),
    );

    for (const table of SYNC_TABLES) {
        const rows = (tables[table] ?? []).filter(
            (row) => !queuedIds.has(`${table}:${row.id as string}`),
        );

        if (rows.length > 0) {
            /* Each table resolves to a differently-typed EntityTable, so the
               union of their bulkPut overloads is not directly callable. */
            await (db[table] as Table).bulkPut(rows);
        }
    }

    await writeMeta(LAST_PULL_KEY, serverTime);
}

let inFlight: Promise<void> | null = null;

/**
 * Push then pull. Concurrent callers share the same run.
 */
export function synchronise(): Promise<void> {
    if (inFlight) {
        return inFlight;
    }

    inFlight = (async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            emit({ online: false, pending: await countPending() });

            return;
        }

        emit({ syncing: true, lastError: null, lastRefusal: null });

        try {
            await pushPending();
            await pullChanges();

            emit({
                online: true,
                lastSyncedAt: new Date().toISOString(),
                pending: await countPending(),
            });
        } catch (error) {
            emit({
                lastError:
                    error instanceof Error
                        ? error.message
                        : 'Sinkronisasi gagal.',
                pending: await countPending(),
            });
        } finally {
            emit({ syncing: false });
        }
    })().finally(() => {
        inFlight = null;
    });

    return inFlight;
}

let started = false;

/**
 * Wire up connectivity listeners and a slow poll. Safe to call repeatedly.
 */
export function startSyncEngine(intervalMs = 30_000): void {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;

    const goOnline = () => {
        emit({ online: true });
        void synchronise();
    };

    const goOffline = () => emit({ online: false });

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.setInterval(() => void synchronise(), intervalMs);

    void countPending().then((pending) => emit({ pending }));
    void synchronise();
}

/**
 * Keep the pending badge honest after a local write.
 */
export async function refreshPendingCount(): Promise<void> {
    emit({ pending: await countPending() });
}
