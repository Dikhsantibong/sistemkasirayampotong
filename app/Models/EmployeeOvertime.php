<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\EmployeeOvertimeFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $daily_session_id
 * @property string $nama_karyawan
 * @property string $jam_mulai
 * @property string $jam_selesai
 * @property string|null $keterangan
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class EmployeeOvertime extends Model
{
    /** @use HasFactory<EmployeeOvertimeFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return BelongsTo<DailySession, $this>
     */
    public function dailySession(): BelongsTo
    {
        return $this->belongsTo(DailySession::class);
    }
}
