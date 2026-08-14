import { cn } from '@/lib/utils';
import { STATUS_BAYAR_LABEL } from '@/offline/types';
import type { StatusBayar } from '@/offline/types';

/**
 * Solid colour, not just text: the cashier scans the history table for unpaid
 * rows rather than reading it line by line.
 */
const TONE: Record<StatusBayar, string> = {
    lunas_tunai: 'bg-kasir-success text-white',
    utang: 'bg-kasir-warning text-white',
    belum_bayar: 'bg-kasir-danger text-white',
};

export function StatusBayarBadge({
    status,
    className,
}: {
    status: StatusBayar;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                TONE[status],
                className,
            )}
        >
            {STATUS_BAYAR_LABEL[status]}
        </span>
    );
}
