<?php

namespace Tests\Feature\Kasir;

use App\Models\DailySession;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class KasirPagesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Every cashier screen, regardless of which role may open it.
     *
     * Who is allowed where is covered by PeranAksesTest; these tests only
     * assert the pages render, so they sign in as the owner.
     *
     * @return array<string, array{string}>
     */
    public static function offlineRoutes(): array
    {
        return [
            'pos' => ['kasir.pos'],
            'sesi' => ['kasir.sesi'],
            'stok' => ['kasir.stok'],
            'harga' => ['kasir.harga'],
            'uang keluar' => ['kasir.uang-keluar'],
            'ayam mati' => ['kasir.ayam-mati'],
            'lembur' => ['kasir.lembur'],
            'tutup sesi' => ['kasir.tutup-sesi'],
            'printer' => ['kasir.printer'],
        ];
    }

    #[DataProvider('offlineRoutes')]
    public function test_guests_are_redirected_from_kasir_screens(string $routeName): void
    {
        $this->get(route($routeName))->assertRedirect(route('login'));
    }

    #[DataProvider('offlineRoutes')]
    public function test_authenticated_users_can_open_kasir_screens(string $routeName): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route($routeName))->assertOk();
    }

    public function test_the_history_page_lists_sessions_with_their_totals(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create(['tanggal' => '2026-08-13']);
        $tier = PriceTier::factory()->for($session)->create();

        SalesTransaction::factory()->for($session)->for($tier)->create(['subtotal' => 120000]);
        SalesTransaction::factory()->for($session)->for($tier)->create(['subtotal' => 80000]);
        SalesTransaction::factory()->for($session)->for($tier)->dibatalkan()->create([
            'subtotal' => 999000,
        ]);

        $this->get(route('kasir.riwayat'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('kasir/riwayat')
                ->has('sesi', 1)
                ->where('sesi.0.jumlah_transaksi', 2)
                /** Whole floats lose their `.0` once serialised to JSON. */
                ->where('sesi.0.total_penjualan', 200000));
    }

    public function test_the_report_page_renders_the_computed_report(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 65000]);

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'jumlah_ekor' => 2,
            'subtotal' => 130000,
        ]);

        $this->get(route('kasir.laporan', $session))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('kasir/laporan')
                ->where('laporan.total_penjualan', 130000)
                ->where('laporan.total_ekor_terjual', 2)
                ->has('laporan.per_ukuran', 4));
    }

    public function test_an_unknown_session_returns_not_found(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route('kasir.laporan', '0198c0de-dead-7000-8000-000000000000'))
            ->assertNotFound();
    }
}
