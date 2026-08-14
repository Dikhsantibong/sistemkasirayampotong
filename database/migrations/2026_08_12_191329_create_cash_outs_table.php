<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cash_outs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->constrained()->cascadeOnDelete();
            $table->decimal('jumlah', 12, 2);
            $table->string('keterangan');
            $table->timestamps();

            $table->index(['daily_session_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_outs');
    }
};
