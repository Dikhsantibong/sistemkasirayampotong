<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\PriceTierFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $daily_session_id
 * @property string $harga decimal cast, so a numeric string
 * @property int $urutan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class PriceTier extends Model
{
    /** @use HasFactory<PriceTierFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'harga' => 'decimal:2',
            'urutan' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<DailySession, $this>
     */
    public function dailySession(): BelongsTo
    {
        return $this->belongsTo(DailySession::class);
    }

    /**
     * @return HasMany<SalesTransaction, $this>
     */
    public function salesTransactions(): HasMany
    {
        return $this->hasMany(SalesTransaction::class);
    }
}
