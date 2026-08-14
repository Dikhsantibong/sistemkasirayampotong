<?php

namespace Tests\Feature;

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use App\Models\CashOut;
use App\Models\DailySession;
use App\Models\DeadChicken;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\StockIntake;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    /**
     * The dashboard is the shop's books at a glance, so it sits behind the
     * same gate as the reports.
     */
    public function test_kasir_cannot_visit_the_dashboard(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('dashboard'))->assertForbidden();
    }

    public function test_pemilik_can_visit_the_dashboard(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route('dashboard'))->assertOk();
    }

    public function test_it_renders_without_any_sessions(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('dashboard')
                ->where('statistik.kpi.jumlah_sesi', 0)
                ->where('statistik.kpi.total_omzet', 0)
                ->where('statistik.harian', [])
                ->has('statistik.per_ukuran', 4));
    }

    public function test_it_accumulates_totals_across_sessions(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->sesiDengan(today()->subDays(2), 100000, 2);
        $this->sesiDengan(today()->subDay(), 250000, 5);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.kpi.total_omzet', 350000)
                ->where('statistik.kpi.total_ekor', 7)
                ->where('statistik.kpi.jumlah_sesi', 2)
                ->where('statistik.kpi.hari_berjualan', 2)
                ->where('statistik.kpi.rata_omzet_per_hari', 175000)
                ->where('statistik.kpi.omzet_tertinggi', 250000)
                ->has('statistik.harian', 2));
    }

    /**
     * The S-curve reads the running total, so it has to step up in date order.
     */
    public function test_the_daily_series_carries_a_running_total_in_date_order(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->sesiDengan(today()->subDays(2), 100000, 1);
        $this->sesiDengan(today()->subDay(), 50000, 1);
        $this->sesiDengan(today(), 25000, 1);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.harian.0.kumulatif', 100000)
                ->where('statistik.harian.1.kumulatif', 150000)
                ->where('statistik.harian.2.kumulatif', 175000));
    }

    public function test_cancelled_transactions_are_excluded(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->hariIni()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 60000]);

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'subtotal' => 60000,
            'jumlah_ekor' => 1,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->dibatalkan()->create([
            'subtotal' => 999000,
            'jumlah_ekor' => 9,
        ]);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.kpi.total_omzet', 60000)
                ->where('statistik.kpi.total_ekor', 1));
    }

    public function test_it_groups_sales_by_price_across_days(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        /** The same price on two different days is one row in the breakdown. */
        foreach ([today()->subDay(), today()] as $tanggal) {
            $session = DailySession::factory()->create(['tanggal' => $tanggal]);
            $tier = PriceTier::factory()->for($session)->create(['harga' => 65000]);

            SalesTransaction::factory()->for($session)->for($tier)->create([
                'subtotal' => 130000,
                'jumlah_ekor' => 2,
            ]);
        }

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('statistik.per_harga', 1)
                ->where('statistik.per_harga.0.harga', 65000)
                ->where('statistik.per_harga.0.ekor', 4)
                ->where('statistik.per_harga.0.total', 260000));
    }

    public function test_it_splits_revenue_by_payment_status(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->hariIni()->create();
        $tier = PriceTier::factory()->for($session)->create();

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'status_bayar' => StatusBayar::LunasTunai,
            'subtotal' => 100000,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->utang()->create([
            'subtotal' => 40000,
        ]);
        CashOut::factory()->for($session)->create(['jumlah' => 25000]);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.kpi.total_tunai', 100000)
                ->where('statistik.kpi.total_piutang', 40000)
                ->where('statistik.kpi.total_uang_keluar', 25000)
                ->where('statistik.kpi.kas_bersih', 75000)
                ->has('statistik.status_bayar', 3));
    }

    public function test_it_tracks_stock_through_to_leftovers(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->hariIni()->create();
        $tier = PriceTier::factory()->for($session)->create();

        StockIntake::factory()->for($session)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 40,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 30,
        ]);
        DeadChicken::factory()->for($session)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 2,
        ]);

        $this->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) {
                $jumbo = collect($page->toArray()['props']['statistik']['per_ukuran'])
                    ->firstWhere('ukuran', 'jumbo');

                $this->assertSame(40, $jumbo['masuk']);
                $this->assertSame(30, $jumbo['terjual']);
                $this->assertSame(2, $jumbo['mati']);
                $this->assertSame(8, $jumbo['sisa']);
            });
    }

    public function test_the_period_filter_excludes_older_sessions(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->sesiDengan(today()->subDays(200), 500000, 5);
        $this->sesiDengan(today(), 100000, 1);

        $this->get(route('dashboard', ['hari' => 30]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.periode.hari', 30)
                ->where('statistik.kpi.total_omzet', 100000)
                ->where('statistik.kpi.jumlah_sesi', 1));

        $this->get(route('dashboard', ['hari' => 0]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.kpi.total_omzet', 600000)
                ->where('statistik.kpi.jumlah_sesi', 2));
    }

    public function test_an_unsupported_period_falls_back_to_the_default(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route('dashboard', ['hari' => 'sembarang']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('statistik.periode.hari', 90));
    }

    /**
     * Build a session on a given date with one sale of the given size.
     */
    private function sesiDengan(mixed $tanggal, float $subtotal, int $ekor): DailySession
    {
        $session = DailySession::factory()->create(['tanggal' => $tanggal]);
        $tier = PriceTier::factory()->for($session)->create();

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'subtotal' => $subtotal,
            'jumlah_ekor' => $ekor,
            'status_bayar' => StatusBayar::LunasTunai,
        ]);

        return $session;
    }
}
