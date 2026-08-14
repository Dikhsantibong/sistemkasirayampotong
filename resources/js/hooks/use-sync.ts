import { useSyncExternalStore } from 'react';
import {
    getSyncState,
    startSyncEngine,
    subscribeToSync,
    synchronise,
} from '@/offline/sync';
import type { SyncState } from '@/offline/sync';

/**
 * Live view of the replication queue: connectivity, in-flight state and how
 * many local writes are still waiting for the server.
 */
export function useSync(): SyncState & { synchronise: () => Promise<void> } {
    const state = useSyncExternalStore(
        (onStoreChange) => subscribeToSync(() => onStoreChange()),
        getSyncState,
        getSyncState,
    );

    return { ...state, synchronise };
}

export { startSyncEngine };
