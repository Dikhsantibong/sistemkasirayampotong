<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\CashOutFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $daily_session_id
 * @property string $jumlah decimal cast, so a numeric string
 * @property string $keterangan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class CashOut extends Model
{
    /** @use HasFactory<CashOutFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'jumlah' => 'decimal:2',
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
