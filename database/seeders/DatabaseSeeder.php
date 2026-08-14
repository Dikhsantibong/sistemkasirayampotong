<?php

namespace Database\Seeders;

use App\Enums\PeranPengguna;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * One account per role so the permission split can be tried out straight
     * away. Written with updateOrCreate so re-seeding an existing database
     * refreshes the roles instead of failing on the unique email.
     */
    public function run(): void
    {
        $accounts = [
            ['name' => 'Pemilik Toko', 'email' => 'pemilik@example.com', 'role' => PeranPengguna::Pemilik],
            ['name' => 'Kasir Toko', 'email' => 'kasir@example.com', 'role' => PeranPengguna::Kasir],
            /** Akun bawaan starter kit, dipertahankan sebagai pemilik. */
            ['name' => 'Test User', 'email' => 'test@example.com', 'role' => PeranPengguna::Pemilik],
        ];

        foreach ($accounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'role' => $account['role'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
