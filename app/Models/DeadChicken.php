<?php

namespace App\Models;

use App\Enums\UkuranAyam;
use Carbon\CarbonInterface;
use Database\Factories\DeadChickenFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $daily_session_id
 * @property UkuranAyam $ukuran
 * @property int $jumlah_ekor
 * @property string|null $keterangan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class DeadChicken extends Model
{
    /** @use HasFactory<DeadChickenFactory> */
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
            'jumlah_ekor' => 'integer',
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
