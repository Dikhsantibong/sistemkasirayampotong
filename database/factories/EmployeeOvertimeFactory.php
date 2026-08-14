<?php

namespace Database\Factories;

use App\Models\DailySession;
use App\Models\EmployeeOvertime;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmployeeOvertime>
 */
class EmployeeOvertimeFactory extends Factory
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
            'nama_karyawan' => fake()->name(),
            'jam_mulai' => '17:00',
            'jam_selesai' => '20:00',
            'keterangan' => null,
        ];
    }
}
