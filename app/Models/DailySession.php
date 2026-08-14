<?php

namespace App\Models;

use App\Enums\StatusSesi;
use Carbon\CarbonInterface;
use Database\Factories\DailySessionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property CarbonInterface $tanggal
 * @property StatusSesi $status
 * @property string $dibuka_oleh
 * @property string|null $ditutup_oleh
 * @property string|null $catatan_penutupan
 * @property CarbonInterface|null $ditutup_pada
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class DailySession extends Model
{
    /** @use HasFactory<DailySessionFactory> */
    use HasFactory;

    use HasUuids;

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status' => StatusSesi::class,
            'ditutup_pada' => 'datetime',
        ];
    }

    /**
     * @return HasMany<PriceTier, $this>
     */
    public function priceTiers(): HasMany
    {
        return $this->hasMany(PriceTier::class)->orderBy('urutan');
    }

    /**
     * @return HasMany<StockIntake, $this>
     */
    public function stockIntakes(): HasMany
    {
        return $this->hasMany(StockIntake::class);
    }

    /**
     * @return HasMany<SalesTransaction, $this>
     */
    public function salesTransactions(): HasMany
    {
        return $this->hasMany(SalesTransaction::class);
    }

    /**
     * @return HasMany<CashOut, $this>
     */
    public function cashOuts(): HasMany
    {
        return $this->hasMany(CashOut::class);
    }

    /**
     * @return HasMany<DeadChicken, $this>
     */
    public function deadChickens(): HasMany
    {
        return $this->hasMany(DeadChicken::class);
    }

    /**
     * @return HasMany<EmployeeOvertime, $this>
     */
    public function employeeOvertimes(): HasMany
    {
        return $this->hasMany(EmployeeOvertime::class);
    }

    /**
     * @return HasOne<CashReconciliation, $this>
     */
    public function cashReconciliation(): HasOne
    {
        return $this->hasOne(CashReconciliation::class);
    }

    /**
     * Whether the session still accepts new transactions.
     */
    public function isOpen(): bool
    {
        return $this->status === StatusSesi::Buka;
    }
}
