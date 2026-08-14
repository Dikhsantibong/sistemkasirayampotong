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
        Schema::create('cash_reconciliations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('uang_tunai_fisik', 12, 2)->default(0);
            $table->decimal('uang_catatan_piutang', 12, 2)->default(0);
            $table->decimal('uang_lebih_kurang', 12, 2)->default(0);
            $table->decimal('lain_lain', 12, 2)->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_reconciliations');
    }
};
