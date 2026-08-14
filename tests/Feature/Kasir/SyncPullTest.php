<?php

namespace Tests\Feature\Kasir;

use App\Models\DailySession;
use App\Models\PriceTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncPullTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_pull_changes(): void
    {
        $this->getJson(route('kasir.sync.pull'))->assertUnauthorized();
    }

    public function test_it_returns_every_replicated_table(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $response = $this->getJson(route('kasir.sync.pull'));

        $response->assertOk();
        $response->assertJsonStructure([
            'tables' => [
                'daily_sessions',
                'price_tiers',
                'stock_intakes',
                'sales_transactions',
                'cash_outs',
                'dead_chickens',
                'employee_overtimes',
                'cash_reconciliations',
            ],
            'server_time',
        ]);
    }

    public function test_it_only_returns_rows_changed_after_the_cursor(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $lama = DailySession::factory()->create(['updated_at' => '2026-08-01 08:00:00']);
        $baru = DailySession::factory()->create(['updated_at' => '2026-08-13 08:00:00']);

        $response = $this->getJson(
            route('kasir.sync.pull', ['since' => '2026-08-10T00:00:00+00:00']),
        );

        $response->assertOk();

        $ids = array_column($response->json('tables.daily_sessions'), 'id');

        $this->assertContains($baru->id, $ids);
        $this->assertNotContains($lama->id, $ids);
    }

    public function test_it_returns_recent_rows_when_no_cursor_is_given(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $session = DailySession::factory()->create(['updated_at' => now()]);
        PriceTier::factory()->for($session)->create(['updated_at' => now()]);

        $response = $this->getJson(route('kasir.sync.pull'));

        $response->assertOk();
        $this->assertCount(1, $response->json('tables.daily_sessions'));
        $this->assertCount(1, $response->json('tables.price_tiers'));
    }

    public function test_it_rejects_an_invalid_cursor(): void
    {
        $this->actingAs(User::factory()->pemilik()->create());

        $this->getJson(route('kasir.sync.pull', ['since' => 'bukan-tanggal']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('since');
    }
}
