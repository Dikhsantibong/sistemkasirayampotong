<?php

namespace App\Http\Controllers\Kasir;

use App\Actions\Kasir\ApplySyncMutations;
use App\Actions\Kasir\SyncSchema;
use App\Http\Controllers\Controller;
use App\Http\Requests\Kasir\SyncPushRequest;
use App\Models\DailySession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SyncController extends Controller
{
    /**
     * Apply a batch of mutations queued by an offline cashier device.
     *
     * Each mutation is authorised individually against the acting user's role,
     * so one refused write never blocks the rest of the batch.
     */
    public function push(SyncPushRequest $request, ApplySyncMutations $applyMutations): JsonResponse
    {
        return response()->json([
            'results' => $applyMutations->handle($request->mutations(), $request->user()),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Return every replicated row touched since the client's last pull.
     *
     * Without a `since` cursor the client receives the last 14 days so a
     * freshly installed device can rebuild its local database.
     *
     * A kasir only ever receives today's session. Past days are the shop's
     * books, and the POS has no need for them — without this scope, a cashier
     * device would hold every day's takings in IndexedDB regardless of what
     * the UI chooses to show.
     */
    public function pull(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'since' => ['nullable', 'date'],
        ]);

        $since = isset($validated['since'])
            ? Carbon::parse($validated['since'])
            : now()->subDays(14);

        $terbatasHariIni = ! $request->user()->isPemilik();
        $idSesiHariIni = $terbatasHariIni
            ? DailySession::query()->whereDate('tanggal', today())->pluck('id')->all()
            : [];

        $tables = [];

        foreach (SyncSchema::tables() as $table => $modelClass) {
            $tables[$table] = $modelClass::query()
                ->where('updated_at', '>', $since)
                ->when($terbatasHariIni, fn (Builder $query): Builder => $table === 'daily_sessions'
                    ? $query->whereKey($idSesiHariIni)
                    : $query->whereIn('daily_session_id', $idSesiHariIni))
                ->orderBy('updated_at')
                ->limit(2000)
                ->get()
                ->toArray();
        }

        return response()->json([
            'tables' => $tables,
            'server_time' => now()->toIso8601String(),
        ]);
    }
}
