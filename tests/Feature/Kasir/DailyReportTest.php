<?php

namespace Tests\Feature\Kasir;

use App\Actions\Kasir\BuildDailyReport;
use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use App\Models\CashOut;
use App\Models\DailySession;
use App\Models\DeadChicken;
use App\Models\EmployeeOvertime;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\StockIntake;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DailyReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_totals_sales_per_price_tier(): void
    {
        $session = DailySession::factory()->create();
        $murah = PriceTier::factory()->for($session)->create(['harga' => 55000, 'urutan' => 0]);
        $mahal = PriceTier::factory()->for($session)->create(['harga' => 75000, 'urutan' => 1]);

        SalesTransaction::factory()->for($session)->for($murah)->create([
            'jumlah_ekor' => 3,
            'subtotal' => 165000,
        ]);
        SalesTransaction::factory()->for($session)->for($murah)->create([
            'jumlah_ekor' => 1,
            'subtotal' => 55000,
        ]);
        SalesTransaction::factory()->for($session)->for($mahal)->create([
            'jumlah_ekor' => 2,
            'subtotal' => 150000,
        ]);

        $report = app(BuildDailyReport::class)->handle($session);

        $this->assertSame(370000.0, $report['total_penjualan']);
        $this->assertSame(6, $report['total_ekor_terjual']);

        $perTier = collect($report['per_tingkatan_harga'])->keyBy('price_tier_id');

        $this->assertSame(4, $perTier[$murah->id]['jumlah_ekor']);
        $this->assertSame(2, $perTier[$murah->id]['jumlah_transaksi']);
        $this->assertSame(220000.0, $perTier[$murah->id]['total']);
        $this->assertSame(2, $perTier[$mahal->id]['jumlah_ekor']);
        $this->assertSame(150000.0, $perTier[$mahal->id]['total']);
    }

    public function test_it_excludes_cancelled_transactions_from_every_total(): void
    {
        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 60000]);

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'jumlah_ekor' => 1,
            'subtotal' => 60000,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->dibatalkan()->create([
            'jumlah_ekor' => 5,
            'subtotal' => 300000,
        ]);

        $report = app(BuildDailyReport::class)->handle($session);

        $this->assertSame(60000.0, $report['total_penjualan']);
        $this->assertSame(1, $report['total_ekor_terjual']);
        $this->assertSame(1, $report['per_tingkatan_harga'][0]['jumlah_transaksi']);
    }

    public function test_it_splits_totals_by_payment_status(): void
    {
        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 60000]);

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'status_bayar' => StatusBayar::LunasTunai,
            'subtotal' => 100000,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->utang()->create([
            'subtotal' => 60000,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->create([
            'status_bayar' => StatusBayar::BelumBayar,
            'subtotal' => 40000,
        ]);

        $report = app(BuildDailyReport::class)->handle($session);

        $this->assertSame(100000.0, $report['total_tunai']);
        $this->assertSame(60000.0, $report['total_piutang']);
        $this->assertSame(40000.0, $report['total_belum_bayar']);
        $this->assertCount(1, $report['piutang']);
    }

    public function test_it_computes_remaining_stock_per_size(): void
    {
        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 60000]);

        StockIntake::factory()->for($session)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 50,
        ]);
        SalesTransaction::factory()->for($session)->for($tier)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 12,
        ]);
        DeadChicken::factory()->for($session)->create([
            'ukuran' => UkuranAyam::Jumbo,
            'jumlah_ekor' => 3,
        ]);

        $report = app(BuildDailyReport::class)->handle($session);

        $jumbo = collect($report['per_ukuran'])->firstWhere('ukuran', 'jumbo');

        $this->assertSame(50, $jumbo['masuk']);
        $this->assertSame(12, $jumbo['terjual']);
        $this->assertSame(3, $jumbo['mati']);
        $this->assertSame(35, $jumbo['sisa']);
        $this->assertSame(3, $report['total_ayam_mati']);
    }

    public function test_expected_cash_subtracts_cash_out_from_cash_taken(): void
    {
        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create(['harga' => 60000]);

        SalesTransaction::factory()->for($session)->for($tier)->create([
            'status_bayar' => StatusBayar::LunasTunai,
            'subtotal' => 500000,
        ]);
        CashOut::factory()->for($session)->create(['jumlah' => 125000]);

        $report = app(BuildDailyReport::class)->handle($session);

        $this->assertSame(125000.0, $report['total_uang_keluar']);
        $this->assertSame(375000.0, $report['kas_seharusnya']);
    }

    public function test_it_lists_overtime_for_the_day(): void
    {
        $session = DailySession::factory()->create();

        EmployeeOvertime::factory()->for($session)->create([
            'nama_karyawan' => 'Budi',
            'jam_mulai' => '17:00',
            'jam_selesai' => '21:00',
        ]);

        $report = app(BuildDailyReport::class)->handle($session);

        $this->assertCount(1, $report['lembur']);
        $this->assertSame('Budi', $report['lembur'][0]['nama_karyawan']);
    }

    public function test_it_reports_an_empty_session_without_errors(): void
    {
        $report = app(BuildDailyReport::class)->handle(DailySession::factory()->create());

        $this->assertSame(0.0, $report['total_penjualan']);
        $this->assertSame(0, $report['total_ekor_terjual']);
        $this->assertSame(0.0, $report['kas_seharusnya']);
        $this->assertNull($report['rekonsiliasi']);
        $this->assertCount(4, $report['per_ukuran']);
        $this->assertSame([], $report['per_tingkatan_harga']);
    }
}
