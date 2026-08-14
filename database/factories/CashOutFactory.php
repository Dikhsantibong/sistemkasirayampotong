<?php

namespace Database\Factories;

use App\Models\CashOut;
use App\Models\DailySession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashOut>
 */
class CashOutFactory extends Factory
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
            'jumlah' => fake()->numberBetween(10000, 500000),
            'keterangan' => fake()->sentence(3),
        ];
    }
}
