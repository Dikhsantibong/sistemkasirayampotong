<?php

namespace Tests\Feature\Kasir;

use App\Enums\StatusBayar;
use App\Models\DailySession;
use App\Models\PriceTier;
use App\Models\SalesTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SyncPushTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_push_mutations(): void
    {
        $response = $this->postJson(route('kasir.sync.push'), ['mutations' => []]);

        $response->assertUnauthorized();
    }

    public function test_it_applies_a_client_generated_session(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $id = (string) Str::uuid7();

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $id,
                    'table' => 'daily_sessions',
                    'operation' => 'upsert',
                    'payload' => [
                        'tanggal' => '2026-08-13',
                        'status' => 'buka',
                        'dibuka_oleh' => 'Rina',
                        'ditutup_oleh' => null,
                        'catatan_penutupan' => null,
                        'ditutup_pada' => null,
                    ],
                    'created_at' => '2026-08-13T01:00:00+00:00',
                    'updated_at' => '2026-08-13T01:00:00+00:00',
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseHas('daily_sessions', [
            'id' => $id,
            'dibuka_oleh' => 'Rina',
        ]);
    }

    public function test_it_applies_a_batch_out_of_order_by_walking_parents_first(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $sessionId = (string) Str::uuid7();
        $tierId = (string) Str::uuid7();
        $transactionId = (string) Str::uuid7();

        /** The transaction is listed before the rows it depends on. */
        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $transactionId,
                    'table' => 'sales_transactions',
                    'operation' => 'upsert',
                    'payload' => [
                        'daily_session_id' => $sessionId,
                        'price_tier_id' => $tierId,
                        'ukuran' => 'jumbo',
                        'jumlah_ekor' => 2,
                        'subtotal' => 130000,
                        'status_bayar' => 'lunas_tunai',
                        'nama_pembeli' => null,
                        'catatan' => null,
                        'dibatalkan_pada' => null,
                        'alasan_pembatalan' => null,
                    ],
                    'created_at' => '2026-08-13T02:00:00+00:00',
                    'updated_at' => '2026-08-13T02:00:00+00:00',
                ],
                [
                    'id' => $tierId,
                    'table' => 'price_tiers',
                    'operation' => 'upsert',
                    'payload' => [
                        'daily_session_id' => $sessionId,
                        'harga' => 65000,
                        'urutan' => 0,
                    ],
                    'created_at' => '2026-08-13T01:30:00+00:00',
                    'updated_at' => '2026-08-13T01:30:00+00:00',
                ],
                [
                    'id' => $sessionId,
                    'table' => 'daily_sessions',
                    'operation' => 'upsert',
                    'payload' => [
                        'tanggal' => '2026-08-13',
                        'status' => 'buka',
                        'dibuka_oleh' => 'Rina',
                        'ditutup_oleh' => null,
                        'catatan_penutupan' => null,
                        'ditutup_pada' => null,
                    ],
                    'created_at' => '2026-08-13T01:00:00+00:00',
                    'updated_at' => '2026-08-13T01:00:00+00:00',
                ],
            ],
        ]);

        $response->assertOk();

        foreach ($response->json('results') as $result) {
            $this->assertSame('applied', $result['status'], "Mutation for {$result['table']} was not applied.");
        }

        $this->assertDatabaseHas('sales_transactions', [
            'id' => $transactionId,
            'price_tier_id' => $tierId,
            'daily_session_id' => $sessionId,
        ]);
    }

    public function test_it_preserves_the_client_transaction_timestamp(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();
        $id = (string) Str::uuid7();

        $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $id,
                    'table' => 'sales_transactions',
                    'operation' => 'upsert',
                    'payload' => [
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
                    ],
                    'created_at' => '2026-08-13T04:15:00+00:00',
                    'updated_at' => '2026-08-13T04:15:00+00:00',
                ],
            ],
        ])->assertOk();

        $this->assertSame(
            '2026-08-13 04:15:00',
            SalesTransaction::findOrFail($id)->created_at->utc()->toDateTimeString(),
        );
    }

    public function test_it_skips_a_mutation_older_than_the_stored_row(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create([
            'dibuka_oleh' => 'Versi Server',
            'updated_at' => '2026-08-13 10:00:00',
        ]);

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $session->id,
                    'table' => 'daily_sessions',
                    'operation' => 'upsert',
                    'payload' => [
                        'tanggal' => $session->tanggal->toDateString(),
                        'status' => 'buka',
                        'dibuka_oleh' => 'Versi Lama',
                        'ditutup_oleh' => null,
                        'catatan_penutupan' => null,
                        'ditutup_pada' => null,
                    ],
                    'created_at' => '2026-08-13T08:00:00+00:00',
                    'updated_at' => '2026-08-13T08:00:00+00:00',
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('results.0.status', 'skipped');

        $this->assertSame('Versi Server', $session->fresh()->dibuka_oleh);
    }

    public function test_it_applies_a_mutation_newer_than_the_stored_row(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create([
            'dibuka_oleh' => 'Versi Server',
            'updated_at' => '2026-08-13 10:00:00',
        ]);

        $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $session->id,
                    'table' => 'daily_sessions',
                    'operation' => 'upsert',
                    'payload' => [
                        'tanggal' => $session->tanggal->toDateString(),
                        'status' => 'ditutup',
                        'dibuka_oleh' => 'Versi Server',
                        'ditutup_oleh' => 'Rina',
                        'catatan_penutupan' => 'Selesai',
                        'ditutup_pada' => '2026-08-13T12:00:00+00:00',
                    ],
                    'created_at' => '2026-08-13T08:00:00+00:00',
                    'updated_at' => '2026-08-13T12:00:00+00:00',
                ],
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertSame('Rina', $session->fresh()->ditutup_oleh);
    }

    public function test_it_rejects_an_utang_transaction_without_a_buyer_name(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => (string) Str::uuid7(),
                    'table' => 'sales_transactions',
                    'operation' => 'upsert',
                    'payload' => [
                        'daily_session_id' => $session->id,
                        'price_tier_id' => $tier->id,
                        'ukuran' => null,
                        'jumlah_ekor' => 1,
                        'subtotal' => 55000,
                        'status_bayar' => StatusBayar::Utang->value,
                        'nama_pembeli' => null,
                        'catatan' => null,
                        'dibatalkan_pada' => null,
                        'alasan_pembatalan' => null,
                    ],
                    'created_at' => '2026-08-13T04:15:00+00:00',
                    'updated_at' => '2026-08-13T04:15:00+00:00',
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('results.0.status', 'rejected');

        $this->assertDatabaseCount('sales_transactions', 0);
    }

    public function test_it_applies_a_delete_mutation(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create();
        $tier = PriceTier::factory()->for($session)->create();

        $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => $tier->id,
                    'table' => 'price_tiers',
                    'operation' => 'delete',
                    'payload' => [],
                    'created_at' => '2026-08-13T04:15:00+00:00',
                    'updated_at' => '2026-08-13T04:15:00+00:00',
                ],
            ],
        ])->assertJsonPath('results.0.status', 'applied');

        $this->assertDatabaseMissing('price_tiers', ['id' => $tier->id]);
    }

    public function test_it_rejects_an_unknown_table(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => (string) Str::uuid7(),
                    'table' => 'users',
                    'operation' => 'upsert',
                    'payload' => ['name' => 'Penyusup'],
                    'created_at' => '2026-08-13T04:15:00+00:00',
                    'updated_at' => '2026-08-13T04:15:00+00:00',
                ],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('mutations.0.table');
    }

    public function test_it_reports_a_failure_when_the_parent_row_is_missing(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $response = $this->postJson(route('kasir.sync.push'), [
            'mutations' => [
                [
                    'id' => (string) Str::uuid7(),
                    'table' => 'price_tiers',
                    'operation' => 'upsert',
                    'payload' => [
                        'daily_session_id' => (string) Str::uuid7(),
                        'harga' => 65000,
                        'urutan' => 0,
                    ],
                    'created_at' => '2026-08-13T04:15:00+00:00',
                    'updated_at' => '2026-08-13T04:15:00+00:00',
                ],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('results.0.status', 'failed');
    }
}
