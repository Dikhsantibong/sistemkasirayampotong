<?php

namespace Database\Factories;

use App\Enums\UkuranAyam;
use App\Models\DailySession;
use App\Models\DeadChicken;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeadChicken>
 */
class DeadChickenFactory extends Factory
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
            'ukuran' => fake()->randomElement(UkuranAyam::cases()),
            'jumlah_ekor' => fake()->numberBetween(1, 5),
            'keterangan' => null,
        ];
    }
}
