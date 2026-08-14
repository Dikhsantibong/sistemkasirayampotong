import { db } from './db';
import type { SyncTable, SyncTableRow } from './types';

/**
 * Client-generated identity. Rows are created offline, so the device — not
 * the database — has to mint the primary key.
 */
export function newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === 'x' ? random : (random & 0x3) | 0x8;

        return value.toString(16);
    });
}

export function nowIso(): string {
    return new Date().toISOString();
}

type NewRow<T extends SyncTable> = Omit<
    SyncTableRow[T],
    'id' | 'created_at' | 'updated_at'
> &
    Partial<Pick<SyncTableRow[T], 'id' | 'created_at' | 'updated_at'>>;

/**
 * Write a row locally and queue it for replication in one transaction, so a
 * crash can never leave a saved row without its pending mutation.
 */
export async function persist<T extends SyncTable>(
    table: T,
    row: NewRow<T>,
): Promise<SyncTableRow[T]> {
    const timestamp = nowIso();
    const complete = {
        ...row,
        id: row.id ?? newId(),
        created_at: row.created_at ?? timestamp,
        updated_at: timestamp,
    } as SyncTableRow[T];

    await db.transaction('rw', db[table], db.sync_queue, async () => {
        await db[table].put(complete as never);
        await db.sync_queue.add({
            id: complete.id,
            table,
            operation: 'upsert',
            payload: complete as unknown as Record<string, unknown>,
            created_at: complete.created_at,
            updated_at: complete.updated_at,
            attempts: 0,
            last_error: null,
        });
    });

    return complete;
}

/**
 * Apply a partial edit to an existing local row and queue the new version.
 */
export async function amend<T extends SyncTable>(
    table: T,
    id: string,
    changes: Partial<SyncTableRow[T]>,
): Promise<SyncTableRow[T] | undefined> {
    const existing = (await db[table].get(id)) as SyncTableRow[T] | undefined;

    if (!existing) {
        return undefined;
    }

    return persist(table, { ...existing, ...changes } as never);
}

/**
 * Remove a row locally and queue the deletion.
 */
export async function forget(table: SyncTable, id: string): Promise<void> {
    await db.transaction('rw', db[table], db.sync_queue, async () => {
        await db[table].delete(id);
        await db.sync_queue.add({
            id,
            table,
            operation: 'delete',
            payload: {},
            created_at: nowIso(),
            updated_at: nowIso(),
            attempts: 0,
            last_error: null,
        });
    });
}
