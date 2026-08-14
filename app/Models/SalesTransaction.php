<?php

namespace App\Models;

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use Carbon\CarbonInterface;
use Database\Factories\SalesTransactionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $daily_session_id
 * @property string $price_tier_id
 * @property UkuranAyam|null $ukuran
 * @property int $jumlah_ekor
 * @property string $subtotal decimal cast, so a numeric string
 * @property StatusBayar $status_bayar
 * @property string|null $nama_pembeli
 * @property string|null $catatan
 * @property CarbonInterface|null $dibatalkan_pada
 * @property string|null $alasan_pembatalan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class SalesTransaction extends Model
{
    /** @use HasFactory<SalesTransactionFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ukuran' => UkuranAyam::class,
            'status_bayar' => StatusBayar::class,
            'jumlah_ekor' => 'integer',
            'subtotal' => 'decimal:2',
            'dibatalkan_pada' => 'datetime',
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
     * @return BelongsTo<PriceTier, $this>
     */
    public function priceTier(): BelongsTo
    {
        return $this->belongsTo(PriceTier::class);
    }

    /**
     * Only transactions that still count towards the daily totals.
     *
     * @param  Builder<$this>  $query
     */
    public function scopeAktif(Builder $query): void
    {
        $query->whereNull('dibatalkan_pada');
    }
}
