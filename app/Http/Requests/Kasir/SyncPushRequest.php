<?php

namespace App\Http\Requests\Kasir;

use App\Actions\Kasir\SyncSchema;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncPushRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * The row payload itself is validated per-table while the batch is
     * applied, so this only guards the envelope.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'mutations' => ['required', 'array', 'min:1', 'max:500'],
            'mutations.*.id' => ['required', 'uuid'],
            'mutations.*.table' => ['required', 'string', Rule::in(SyncSchema::tableNames())],
            'mutations.*.operation' => ['required', Rule::in(['upsert', 'delete'])],
            'mutations.*.payload' => ['required_if:mutations.*.operation,upsert', 'array'],
            'mutations.*.created_at' => ['nullable', 'date'],
            'mutations.*.updated_at' => ['required', 'date'],
        ];
    }

    /**
     * The mutations to apply, normalised to the shape the action expects.
     *
     * @return array<int, array{id: string, table: string, operation: string, payload: array<string, mixed>, updated_at: string, created_at: string|null}>
     */
    public function mutations(): array
    {
        return array_map(static fn (array $mutation): array => [
            'id' => $mutation['id'],
            'table' => $mutation['table'],
            'operation' => $mutation['operation'],
            'payload' => $mutation['payload'] ?? [],
            'created_at' => $mutation['created_at'] ?? null,
            'updated_at' => $mutation['updated_at'],
        ], $this->validated('mutations'));
    }
}
