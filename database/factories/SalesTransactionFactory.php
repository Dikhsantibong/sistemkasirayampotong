<?php

namespace Database\Factories;

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use App\Models\DailySession;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesTransaction>
 */
class SalesTransactionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $jumlahEkor = fake()->numberBetween(1, 5);
        $harga = fake()->randomElement([55000, 65000, 70000, 75000]);

        return [
            'daily_session_id' => DailySession::factory(),
            'price_tier_id' => PriceTier::factory(),
            'ukuran' => fake()->randomElement(UkuranAyam::cases()),
            'jumlah_ekor' => $jumlahEkor,
            'subtotal' => $harga * $jumlahEkor,
            'status_bayar' => StatusBayar::LunasTunai,
            'nama_pembeli' => null,
            'catatan' => null,
        ];
    }

    /**
     * An unpaid transaction recorded against a named buyer.
     */
    public function utang(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status_bayar' => StatusBayar::Utang,
            'nama_pembeli' => fake()->name(),
        ]);
    }

    /**
     * A transaction voided by the cashier.
     */
    public function dibatalkan(): static
    {
        return $this->state(fn (array $attributes): array => [
            'dibatalkan_pada' => now(),
            'alasan_pembatalan' => fake()->sentence(),
        ]);
    }
}
