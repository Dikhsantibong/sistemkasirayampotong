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
        Schema::create('price_tiers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->constrained()->cascadeOnDelete();
            $table->decimal('harga', 12, 2);
            $table->unsignedInteger('urutan')->default(0);
            $table->timestamps();

            $table->index(['daily_session_id', 'urutan']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('price_tiers');
    }
};
