<?php

namespace App\Actions\Kasir;

use App\Models\SalesTransaction;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Applies a batch of offline mutations pushed by a cashier device.
 *
 * Conflicts are resolved last-write-wins: an incoming row is only written
 * when its `updated_at` is newer than the one already stored on the server.
 * Every mutation is reported back individually so the client knows exactly
 * which queue entries it may drop and which it must retry.
 *
 * Authorisation happens here rather than in the UI: the device queues writes
 * offline and pushes them later, so this endpoint is the only place a role
 * restriction can actually be enforced.
 */
class ApplySyncMutations
{
    public function __construct(protected SyncPermissions $permissions) {}

    /**
     * @param  array<int, array{id: string, table: string, operation: string, payload: array<string, mixed>, updated_at: string, created_at?: string|null}>  $mutations
     * @return array<int, array{id: string, table: string, status: string, message?: string, errors?: array<string, array<int, string>>}>
     */
    public function handle(array $mutations, User $user): array
    {
        usort($mutations, static fn (array $a, array $b): int => SyncSchema::priority($a['table']) <=> SyncSchema::priority($b['table']));

        return array_map(fn (array $mutation): array => $this->applyOne($mutation, $user), $mutations);
    }

    /**
     * @param  array{id: string, table: string, operation: string, payload: array<string, mixed>, updated_at: string, created_at?: string|null}  $mutation
     * @return array{id: string, table: string, status: string, message?: string, errors?: array<string, array<int, string>>}
     */
    protected function applyOne(array $mutation, User $user): array
    {
        $modelClass = SyncSchema::modelFor($mutation['table']);

        if ($modelClass === null) {
            return $this->result($mutation, 'rejected', 'Tabel tidak dikenali.');
        }

        if (! $this->permissions->allows($user, $mutation['table'], $mutation['operation'], $mutation['payload'])) {
            return $this->result(
                $mutation,
                'forbidden',
                $this->permissions->reason($mutation['table'], $mutation['operation'], $mutation['payload']),
            );
        }

        try {
            if ($mutation['operation'] === 'delete') {
                return $this->applyDelete($mutation, $modelClass);
            }

            $validator = Validator::make($mutation['payload'], SyncSchema::rulesFor($mutation['table']));

            if ($validator->fails()) {
                return [
                    ...$this->result($mutation, 'rejected', 'Data tidak lolos validasi.'),
                    'errors' => $validator->errors()->toArray(),
                ];
            }

            $incomingUpdatedAt = Carbon::parse($mutation['updated_at']);
            $existing = $modelClass::query()->whereKey($mutation['id'])->first();

            /* The table is only known at runtime, so timestamps are read
               through the attribute bag rather than as declared properties.
               The app runs on CarbonImmutable, hence the interface check. */
            $storedUpdatedAt = $existing?->getAttribute('updated_at');

            if ($storedUpdatedAt instanceof CarbonInterface && $storedUpdatedAt->greaterThan($incomingUpdatedAt)) {
                return $this->result($mutation, 'skipped', 'Server memiliki versi yang lebih baru.');
            }

            $storedCreatedAt = $existing?->getAttribute('created_at');

            $model = $existing ?? new $modelClass;
            $model->timestamps = false;
            $model->forceFill([
                ...$validator->validated(),
                $model->getKeyName() => $mutation['id'],
                'created_at' => $storedCreatedAt instanceof CarbonInterface
                    ? $storedCreatedAt
                    : Carbon::parse($mutation['created_at'] ?? $mutation['updated_at']),
                'updated_at' => $incomingUpdatedAt,
            ])->save();

            return $this->result($mutation, 'applied');
        } catch (Throwable $exception) {
            /** Kept in the client queue so a missing parent row can be retried after the next batch. */
            return $this->result($mutation, 'failed', $exception->getMessage());
        }
    }

    /**
     * Remove a replicated row, refusing deletions that would take takings with them.
     *
     * @param  array{id: string, table: string, operation: string, payload: array<string, mixed>, updated_at: string, created_at?: string|null}  $mutation
     * @param  class-string<Model>  $modelClass
     * @return array{id: string, table: string, status: string, message?: string}
     */
    protected function applyDelete(array $mutation, string $modelClass): array
    {
        /*
         * A price tier that already carries sales must stay: removing it would
         * leave those transactions without the price they were rung up at.
         * The database refuses this too, but catching it here gives the cashier
         * a sentence they can act on instead of a constraint violation.
         */
        if ($mutation['table'] === 'price_tiers'
            && SalesTransaction::query()->where('price_tier_id', $mutation['id'])->exists()) {
            return $this->result(
                $mutation,
                'rejected',
                'Tingkatan harga ini sudah dipakai transaksi, jadi tidak bisa dihapus.',
            );
        }

        /*
         * Sales are cleared first when a whole day is removed. Their price tier
         * link restricts deletion, so letting the database cascade on its own
         * would trip over its own foreign keys.
         */
        if ($mutation['table'] === 'daily_sessions') {
            SalesTransaction::query()->where('daily_session_id', $mutation['id'])->delete();
        }

        $modelClass::query()->whereKey($mutation['id'])->delete();

        return $this->result($mutation, 'applied');
    }

    /**
     * @param  array{id: string, table: string, operation: string, payload: array<string, mixed>, updated_at: string, created_at?: string|null}  $mutation
     * @return array{id: string, table: string, status: string, message?: string}
     */
    protected function result(array $mutation, string $status, ?string $message = null): array
    {
        return array_filter([
            'id' => $mutation['id'],
            'table' => $mutation['table'],
            'status' => $status,
            'message' => $message,
        ], static fn (mixed $value): bool => $value !== null);
    }
}
