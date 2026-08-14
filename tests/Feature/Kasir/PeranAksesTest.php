<?php

namespace Tests\Feature\Kasir;

use App\Enums\StatusSesi;
use App\Models\CashOut;
use App\Models\DailySession;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The cashier app queues writes offline and pushes them later, so hiding a
 * button in React proves nothing. These tests exercise the boundary that
 * actually holds: `/kasir/sync/push` and the `pemilik` route middleware.
 */
class PeranAksesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{string}>
     */
    public static function ruteKhususPemilik(): array
    {
        return [
            'tutup sesi' => ['kasir.tutup-sesi'],
            'riwayat laporan' => ['kasir.riwayat'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function ruteTerbukaUntukKasir(): array
    {
        return [
            'pos' => ['kasir.pos'],
            'sesi' => ['kasir.sesi'],
            'stok' => ['kasir.stok'],
            'tingkatan harga' => ['kasir.harga'],
            'uang keluar' => ['kasir.uang-keluar'],
            'ayam mati' => ['kasir.ayam-mati'],
            'lembur' => ['kasir.lembur'],
            'printer' => ['kasir.printer'],
        ];
    }

    #[DataProvider('ruteKhususPemilik')]
    public function test_kasir_ditolak_di_halaman_khusus_pemilik(string $routeName): void
    {
        $this->actingAs(User::factory()->create());

        $this->get(route($routeName))->assertForbidden();
    }

    #[DataProvider('ruteKhususPemilik')]
    public function test_pemilik_boleh_membuka_halaman_khusus_pemilik(string $routeName): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->get(route($routeName))->assertOk();
    }

    #[DataProvider('ruteTerbukaUntukKasir')]
    public function test_kasir_boleh_membuka_layar_operasional(string $routeName): void
    {
        $this->actingAs(User::factory()->create());

        $this->get(route($routeName))->assertOk();
    }

    public function test_kasir_ditolak_membuka_laporan_harian(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get(route('kasir.laporan', DailySession::factory()->create()))
            ->assertForbidden();
    }

    public function test_kasir_boleh_mencatat_transaksi_penjualan(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $id = (string) Str::uuid7();

        $this->pushSatu([
            'id' => $id,
            'table' => 'sales_transactions',
            'payload' => $this->payloadTransaksi($session, $tier),
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseHas('sales_transactions', ['id' => $id]);
    }

    public function test_kasir_tidak_boleh_membatalkan_transaksi(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $transaksi = SalesTransaction::factory()->for($session)->for($tier)->create();

        $response = $this->pushSatu([
            'id' => $transaksi->id,
            'table' => 'sales_transactions',
            'payload' => [
                ...$this->payloadTransaksi($session, $tier),
                'dibatalkan_pada' => '2026-08-13T09:00:00+00:00',
                'alasan_pembatalan' => 'iseng',
            ],
        ]);

        $response->assertJsonPath('results.0.status', 'forbidden');
        $this->assertNull($transaksi->fresh()->dibatalkan_pada);
    }

    public function test_pemilik_boleh_membatalkan_transaksi(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $transaksi = SalesTransaction::factory()->for($session)->for($tier)->create();

        $this->pushSatu([
            'id' => $transaksi->id,
            'table' => 'sales_transactions',
            'payload' => [
                ...$this->payloadTransaksi($session, $tier),
                'dibatalkan_pada' => '2026-08-13T09:00:00+00:00',
                'alasan_pembatalan' => 'salah input',
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertNotNull($transaksi->fresh()->dibatalkan_pada);
    }

    public function test_kasir_boleh_mengatur_tingkatan_harga(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();
        $id = (string) Str::uuid7();

        $this->pushSatu([
            'id' => $id,
            'table' => 'price_tiers',
            'payload' => [
                'daily_session_id' => $session->id,
                'harga' => 65000,
                'urutan' => 0,
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseHas('price_tiers', ['id' => $id]);
    }

    public function test_kasir_boleh_menghapus_tingkatan_harga_yang_belum_terpakai(): void
    {
        $this->actingAs(User::factory()->create());

        $tier = PriceTier::factory()->create();

        $this->pushSatu([
            'id' => $tier->id,
            'table' => 'price_tiers',
            'operation' => 'delete',
            'payload' => [],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseMissing('price_tiers', ['id' => $tier->id]);
    }

    /**
     * Deleting a tier used to cascade its sales away, taking the takings for
     * that price out of the books with no trace.
     */
    public function test_tingkatan_harga_yang_sudah_dipakai_tidak_bisa_dihapus_siapa_pun(): void
    {
        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $transaksi = SalesTransaction::factory()->for($session)->for($tier)->create();

        foreach ([User::factory()->create(), User::factory()->pemilik()->create()] as $user) {
            $this->actingAs($user);

            $this->pushSatu([
                'id' => $tier->id,
                'table' => 'price_tiers',
                'operation' => 'delete',
                'payload' => [],
            ])->assertJsonPath('results.0.status', 'rejected');
        }

        $this->assertDatabaseHas('price_tiers', ['id' => $tier->id]);
        $this->assertDatabaseHas('sales_transactions', ['id' => $transaksi->id]);
    }

    /**
     * Removing a whole day is still meant to remove that day's rows with it,
     * even though the price tier link now restricts deletion.
     */
    public function test_pemilik_masih_bisa_menghapus_seluruh_sesi(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        SalesTransaction::factory()->for($session)->for($tier)->create();

        $this->pushSatu([
            'id' => $session->id,
            'table' => 'daily_sessions',
            'operation' => 'delete',
            'payload' => [],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseMissing('daily_sessions', ['id' => $session->id]);
        $this->assertDatabaseCount('sales_transactions', 0);
        $this->assertDatabaseCount('price_tiers', 0);
    }

    public function test_kasir_tidak_boleh_menutup_sesi(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();

        $this->pushSatu([
            'id' => $session->id,
            'table' => 'daily_sessions',
            'payload' => [
                'tanggal' => $session->tanggal->toDateString(),
                'status' => StatusSesi::Ditutup->value,
                'dibuka_oleh' => $session->dibuka_oleh,
                'ditutup_oleh' => 'Kasir Nakal',
                'catatan_penutupan' => null,
                'ditutup_pada' => '2026-08-13T12:00:00+00:00',
            ],
        ])->assertJsonPath('results.0.status', 'forbidden');

        $this->assertSame(StatusSesi::Buka, $session->fresh()->status);
    }

    public function test_kasir_masih_boleh_membuka_sesi(): void
    {
        $this->actingAs(User::factory()->create());

        $id = (string) Str::uuid7();

        $this->pushSatu([
            'id' => $id,
            'table' => 'daily_sessions',
            'payload' => [
                'tanggal' => '2026-08-13',
                'status' => StatusSesi::Buka->value,
                'dibuka_oleh' => 'Rina',
                'ditutup_oleh' => null,
                'catatan_penutupan' => null,
                'ditutup_pada' => null,
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseHas('daily_sessions', ['id' => $id]);
    }

    public function test_kasir_tidak_boleh_mengisi_rekonsiliasi_kas(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();

        $this->pushSatu([
            'id' => (string) Str::uuid7(),
            'table' => 'cash_reconciliations',
            'payload' => [
                'daily_session_id' => $session->id,
                'uang_tunai_fisik' => 100,
                'uang_catatan_piutang' => 0,
                'uang_lebih_kurang' => 0,
                'lain_lain' => null,
                'catatan' => null,
            ],
        ])->assertJsonPath('results.0.status', 'forbidden');

        $this->assertDatabaseCount('cash_reconciliations', 0);
    }

    public function test_kasir_boleh_mencatat_tapi_tidak_menghapus_uang_keluar(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();
        $cashOut = CashOut::factory()->for($session)->create();

        $this->pushSatu([
            'id' => (string) Str::uuid7(),
            'table' => 'cash_outs',
            'payload' => [
                'daily_session_id' => $session->id,
                'jumlah' => 25000,
                'keterangan' => 'beli es batu',
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->pushSatu([
            'id' => $cashOut->id,
            'table' => 'cash_outs',
            'operation' => 'delete',
            'payload' => [],
        ])->assertJsonPath('results.0.status', 'forbidden');

        $this->assertDatabaseHas('cash_outs', ['id' => $cashOut->id]);
    }

    public function test_satu_mutasi_yang_ditolak_tidak_menggagalkan_sisa_batch(): void
    {
        $this->actingAs(User::factory()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $idTransaksi = (string) Str::uuid7();

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                $this->mutasi([
                    'id' => (string) Str::uuid7(),
                    'table' => 'cash_reconciliations',
                    'payload' => [
                        'daily_session_id' => $session->id,
                        'uang_tunai_fisik' => 100,
                        'uang_catatan_piutang' => 0,
                        'uang_lebih_kurang' => 0,
                        'lain_lain' => null,
                        'catatan' => null,
                    ],
                ]),
                $this->mutasi([
                    'id' => $idTransaksi,
                    'table' => 'sales_transactions',
                    'payload' => $this->payloadTransaksi($session, $tier),
                ]),
            ],
        ]);

        $response->assertOk();

        $hasil = collect($response->json('results'))->keyBy('table');

        $this->assertSame('forbidden', $hasil['cash_reconciliations']['status']);
        $this->assertSame('applied', $hasil['sales_transactions']['status']);
        $this->assertDatabaseHas('sales_transactions', ['id' => $idTransaksi]);
    }

    public function test_kasir_hanya_menarik_data_sesi_hari_ini(): void
    {
        $this->actingAs(User::factory()->create());

        $hariIni = DailySession::factory()->hariIni()->create();
        $kemarin = DailySession::factory()->create(['tanggal' => today()->subDay()]);
        CashOut::factory()->for($kemarin)->create();

        $response = $this->getJson(route('kasir.sync.pull'));

        $response->assertOk();

        $idSesi = array_column($response->json('tables.daily_sessions'), 'id');

        $this->assertSame([$hariIni->id], $idSesi);
        $this->assertSame([], $response->json('tables.cash_outs'));
    }

    public function test_pemilik_menarik_seluruh_riwayat(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        DailySession::factory()->hariIni()->create();
        $kemarin = DailySession::factory()->create(['tanggal' => today()->subDay()]);
        CashOut::factory()->for($kemarin)->create();

        $response = $this->getJson(route('kasir.sync.pull'));

        $response->assertOk();
        $this->assertCount(2, $response->json('tables.daily_sessions'));
        $this->assertCount(1, $response->json('tables.cash_outs'));
    }

    public function test_akun_baru_berperan_kasir_secara_bawaan(): void
    {
        $this->assertFalse(User::factory()->create()->isPemilik());
    }

    /**
     * @param  array{id: string, table: string, operation?: string, payload: array<string, mixed>}  $mutation
     * @return array<string, mixed>
     */
    private function mutasi(array $mutation): array
    {
        return [
            'id' => $mutation['id'],
            'table' => $mutation['table'],
            'operation' => $mutation['operation'] ?? 'upsert',
            'payload' => $mutation['payload'],
            'created_at' => '2026-08-13T08:00:00+00:00',
            'updated_at' => '2026-08-13T08:00:00+00:00',
        ];
    }

    /**
     * @param  array{id: string, table: string, operation?: string, payload: array<string, mixed>}  $mutation
     */
    private function pushSatu(array $mutation): TestResponse
    {
        return $this->postJson(route('kasir.sync.push'), [
            'mutations' => [$this->mutasi($mutation)],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadTransaksi(DailySession $session, PriceTier $tier): array
    {
        return [
            'daily_session_id' => $session->id,
            'price_tier_id' => $tier->id,
            'ukuran' => null,
            'jumlah_ekor' => 1,
            'subtotal' => 55000,
            'status_bayar' => 'lunas_tunai',
            'nama_pembeli' => null,
            'catatan' => null,
            'dibatalkan_pada' => null,
            'alasan_pembatalan' => null,
        ];
    }
}
