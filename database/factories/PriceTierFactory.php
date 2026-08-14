<?php

namespace Database\Factories;

use App\Models\DailySession;
use App\Models\PriceTier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PriceTier>
 */
class PriceTierFactory extends Factory
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
            'harga' => fake()->randomElement([55000, 65000, 70000, 75000]),
            'urutan' => fake()->numberBetween(0, 3),
        ];
    }
}
