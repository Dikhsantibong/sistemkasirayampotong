import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { startSyncEngine, useSync } from '@/hooks/use-sync';
import { cn } from '@/lib/utils';

/**
 * Always-visible connection and replication status.
 *
 * Lives in the app header so the cashier can tell at a glance whether today's
 * takings have reached the server, without leaving the POS screen.
 */
export function SyncIndicator({ className }: { className?: string }) {
    const { online, syncing, pending, lastError, lastRefusal, synchronise } =
        useSync();

    useEffect(() => {
        startSyncEngine();
    }, []);

    /* A write the role may not make is dropped server-side and the local row
       is reverted by the pull that follows, so the cashier is told why their
       change disappeared instead of watching it silently revert. */
    useEffect(() => {
        if (lastRefusal !== null) {
            toast.error(lastRefusal);
        }
    }, [lastRefusal]);

    const tone = !online
        ? 'bg-kasir-warning text-white'
        : pending > 0
          ? 'bg-kasir-primary-soft text-kasir-primary-dark'
          : 'bg-kasir-success text-white';

    const label = !online
        ? 'Offline'
        : pending > 0
          ? `${pending} belum tersinkron`
          : 'Tersinkron';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void synchronise()}
                    disabled={syncing || !online}
                    className={cn(
                        'h-8 gap-1.5 rounded-full px-3 text-xs font-semibold',
                        tone,
                        className,
                    )}
                >
                    {!online ? (
                        <CloudOff className="size-3.5" />
                    ) : syncing ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                        <Wifi className="size-3.5" />
                    )}
                    <span>{label}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {lastError
                    ? `Sinkronisasi terakhir gagal: ${lastError}`
                    : online
                      ? 'Ketuk untuk sinkronkan sekarang.'
                      : 'Transaksi tetap tersimpan di perangkat dan dikirim saat online.'}
            </TooltipContent>
        </Tooltip>
    );
}
