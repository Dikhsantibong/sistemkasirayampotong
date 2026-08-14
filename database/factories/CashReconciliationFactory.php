<?php

namespace Database\Factories;

use App\Models\CashReconciliation;
use App\Models\DailySession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashReconciliation>
 */
class CashReconciliationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'daily_session_id' => DailySession::factory(),
            'uang_tunai_fisik' => fake()->numberBetween(1000000, 5000000),
            'uang_catatan_piutang' => 0,
            'uang_lebih_kurang' => 0,
            'lain_lain' => null,
            'catatan' => null,
        ];
    }
}
