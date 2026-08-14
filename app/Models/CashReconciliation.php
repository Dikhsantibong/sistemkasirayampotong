<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\CashReconciliationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Decimal-cast columns come back as numeric strings, not floats.
 *
 * @property string $id
 * @property string $daily_session_id
 * @property string $uang_tunai_fisik
 * @property string $uang_catatan_piutang
 * @property string $uang_lebih_kurang
 * @property string|null $lain_lain
 * @property string|null $catatan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class CashReconciliation extends Model
{
    /** @use HasFactory<CashReconciliationFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'uang_tunai_fisik' => 'decimal:2',
            'uang_catatan_piutang' => 'decimal:2',
            'uang_lebih_kurang' => 'decimal:2',
            'lain_lain' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<DailySession, $this>
     */
    public function dailySession(): BelongsTo
    {
        return $this->belongsTo(DailySession::class);
    }
}
