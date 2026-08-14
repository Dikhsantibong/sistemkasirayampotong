<?php

namespace App\Actions\Kasir;

use App\Enums\StatusBayar;
use App\Enums\StatusSesi;
use App\Enums\UkuranAyam;
use App\Models\CashOut;
use App\Models\CashReconciliation;
use App\Models\DailySession;
use App\Models\DeadChicken;
use App\Models\EmployeeOvertime;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\StockIntake;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

/**
 * Single source of truth for which tables the offline client may replicate,
 * in which order they must be applied, and how each row is validated.
 *
 * The order of the map matters: a batch is applied top-down so parent rows
 * (sessions, price tiers) always land before the rows that reference them.
 */
class SyncSchema
{
    /**
     * Tables the client may push and pull, in dependency order.
     *
     * @return array<string, class-string<Model>>
     */
    public static function tables(): array
    {
        return [
            'daily_sessions' => DailySession::class,
            'price_tiers' => PriceTier::class,
            'stock_intakes' => StockIntake::class,
            'sales_transactions' => SalesTransaction::class,
            'cash_outs' => CashOut::class,
            'dead_chickens' => DeadChicken::class,
            'employee_overtimes' => EmployeeOvertime::class,
            'cash_reconciliations' => CashReconciliation::class,
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function tableNames(): array
    {
        return array_keys(self::tables());
    }

    /**
     * Resolve the model class backing a replicated table.
     *
     * @return class-string<Model>|null
     */
    public static function modelFor(string $table): ?string
    {
        return self::tables()[$table] ?? null;
    }

    /**
     * Position of a table in the dependency order, used to sort a push batch.
     */
    public static function priority(string $table): int
    {
        $position = array_search($table, self::tableNames(), true);

        return $position === false ? PHP_INT_MAX : $position;
    }

    /**
     * Validation rules for a single row of the given table.
     *
     * Rules are intentionally permissive about foreign keys existing yet —
     * a referenced parent may arrive in the same batch, so existence is
     * enforced by the database once the batch is applied in order.
     *
     * @return array<string, mixed>
     */
    public static function rulesFor(string $table): array
    {
        return match ($table) {
            'daily_sessions' => [
                'tanggal' => ['required', 'date'],
                'status' => ['required', Rule::enum(StatusSesi::class)],
                'dibuka_oleh' => ['required', 'string', 'max:255'],
                'ditutup_oleh' => ['nullable', 'string', 'max:255'],
                'catatan_penutupan' => ['nullable', 'string'],
                'ditutup_pada' => ['nullable', 'date'],
            ],
            'price_tiers' => [
                'daily_session_id' => ['required', 'uuid'],
                'harga' => ['required', 'numeric', 'min:0'],
                'urutan' => ['required', 'integer', 'min:0'],
            ],
            'stock_intakes' => [
                'daily_session_id' => ['required', 'uuid'],
                'ukuran' => ['required', Rule::enum(UkuranAyam::class)],
                'jumlah_ekor' => ['required', 'integer', 'min:0'],
                'catatan' => ['nullable', 'string', 'max:255'],
            ],
            'sales_transactions' => [
                'daily_session_id' => ['required', 'uuid'],
                'price_tier_id' => ['required', 'uuid'],
                'ukuran' => ['nullable', Rule::enum(UkuranAyam::class)],
                'jumlah_ekor' => ['required', 'integer', 'min:1'],
                'subtotal' => ['required', 'numeric', 'min:0'],
                'status_bayar' => ['required', Rule::enum(StatusBayar::class)],
                'nama_pembeli' => ['nullable', 'string', 'max:255', 'required_if:status_bayar,'.StatusBayar::Utang->value],
                'catatan' => ['nullable', 'string'],
                'dibatalkan_pada' => ['nullable', 'date'],
                'alasan_pembatalan' => ['nullable', 'string', 'max:255'],
            ],
            'cash_outs' => [
                'daily_session_id' => ['required', 'uuid'],
                'jumlah' => ['required', 'numeric', 'min:0'],
                'keterangan' => ['required', 'string', 'max:255'],
            ],
            'dead_chickens' => [
                'daily_session_id' => ['required', 'uuid'],
                'ukuran' => ['required', Rule::enum(UkuranAyam::class)],
                'jumlah_ekor' => ['required', 'integer', 'min:1'],
                'keterangan' => ['nullable', 'string', 'max:255'],
            ],
            'employee_overtimes' => [
                'daily_session_id' => ['required', 'uuid'],
                'nama_karyawan' => ['required', 'string', 'max:255'],
                'jam_mulai' => ['required', 'date_format:H:i,H:i:s'],
                'jam_selesai' => ['required', 'date_format:H:i,H:i:s'],
                'keterangan' => ['nullable', 'string', 'max:255'],
            ],
            'cash_reconciliations' => [
                'daily_session_id' => ['required', 'uuid'],
                'uang_tunai_fisik' => ['required', 'numeric'],
                'uang_catatan_piutang' => ['required', 'numeric'],
                'uang_lebih_kurang' => ['required', 'numeric'],
                'lain_lain' => ['nullable', 'numeric'],
                'catatan' => ['nullable', 'string'],
            ],
            default => [],
        };
    }
}
