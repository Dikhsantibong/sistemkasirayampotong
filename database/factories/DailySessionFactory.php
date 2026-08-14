<?php

namespace Database\Factories;

use App\Enums\StatusSesi;
use App\Models\DailySession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailySession>
 */
class DailySessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tanggal' => fake()->unique()->date(),
            'status' => StatusSesi::Buka,
            'dibuka_oleh' => fake()->name(),
            'ditutup_oleh' => null,
            'catatan_penutupan' => null,
            'ditutup_pada' => null,
        ];
    }

    /**
     * A session that has already been closed for the day.
     */
    public function ditutup(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => StatusSesi::Ditutup,
            'ditutup_oleh' => fake()->name(),
            'ditutup_pada' => now(),
        ]);
    }

    /**
     * The session for today's date.
     */
    public function hariIni(): static
    {
        return $this->state(fn (array $attributes): array => [
            'tanggal' => today(),
        ]);
    }
}
