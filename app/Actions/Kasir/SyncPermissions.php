<?php

namespace App\Actions\Kasir;

use App\Enums\StatusSesi;
use App\Models\User;

/**
 * Decides which replicated writes a role is allowed to make.
 *
 * This is the real authorisation boundary of the cashier app. Every kasir
 * screen writes to Dexie first and pushes later, so hiding a button in React
 * proves nothing — the browser can post whatever it likes to
 * `/kasir/sync/push`. Anything that must be denied has to be denied here.
 *
 * Two rules are field-sensitive rather than table-wide, because the same row
 * is written by both roles at different points of its life:
 *
 *  - closing a session   → `daily_sessions.status = ditutup`
 *  - voiding a sale      → `sales_transactions.dibatalkan_pada` is set
 *
 * Both are the moments money can quietly disappear, so both are pemilik-only
 * even though the underlying table is writable by a kasir.
 */
class SyncPermissions
{
    /**
     * Tables a kasir may create or update rows in at all.
     *
     * Prices are included: whoever opens the stall sets the day's tiers from
     * what the chickens cost that morning, and that is as often the kasir as
     * the owner. Cash reconciliation stays out — it is the closing count.
     *
     * @var array<int, string>
     */
    private const KASIR_WRITABLE_TABLES = [
        'daily_sessions',
        'price_tiers',
        'stock_intakes',
        'sales_transactions',
        'cash_outs',
        'dead_chickens',
        'employee_overtimes',
    ];

    /**
     * Tables a kasir may also delete from.
     *
     * Only price tiers: a kasir who can add a tier has to be able to take back
     * one they mistyped. Everything else is evidence — removing it is the
     * owner's call. A tier that already carries sales cannot be deleted by
     * anyone; that is enforced in `ApplySyncMutations`.
     *
     * @var array<int, string>
     */
    private const KASIR_DELETABLE_TABLES = [
        'price_tiers',
    ];

    /**
     * Whether the user may apply this mutation.
     *
     * @param  array<string, mixed>  $payload
     */
    public function allows(User $user, string $table, string $operation, array $payload): bool
    {
        if ($user->isPemilik()) {
            return true;
        }

        if ($operation === 'delete') {
            return in_array($table, self::KASIR_DELETABLE_TABLES, true);
        }

        if (! in_array($table, self::KASIR_WRITABLE_TABLES, true)) {
            return false;
        }

        return match ($table) {
            'daily_sessions' => ($payload['status'] ?? null) !== StatusSesi::Ditutup->value,
            'sales_transactions' => ($payload['dibatalkan_pada'] ?? null) === null,
            default => true,
        };
    }

    /**
     * Why a mutation was refused, shown to the cashier as a toast.
     *
     * @param  array<string, mixed>  $payload
     */
    public function reason(string $table, string $operation, array $payload): string
    {
        if ($operation === 'delete') {
            return 'Hanya pemilik yang boleh menghapus catatan.';
        }

        return match (true) {
            $table === 'daily_sessions' && ($payload['status'] ?? null) === StatusSesi::Ditutup->value => 'Hanya pemilik yang boleh menutup sesi dan menghitung selisih kas.',
            $table === 'sales_transactions' && ($payload['dibatalkan_pada'] ?? null) !== null => 'Hanya pemilik yang boleh membatalkan transaksi.',
            $table === 'cash_reconciliations' => 'Hanya pemilik yang boleh mengisi rekonsiliasi kas.',
            default => 'Peran Anda tidak berwenang mengubah data ini.',
        };
    }
}
