<?php

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
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
        Schema::create('sales_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('price_tier_id')->constrained()->cascadeOnDelete();
            $table->enum('ukuran', UkuranAyam::values())->nullable();
            $table->unsignedInteger('jumlah_ekor');
            $table->decimal('subtotal', 12, 2);
            $table->enum('status_bayar', StatusBayar::values());
            $table->string('nama_pembeli')->nullable();
            $table->text('catatan')->nullable();
            $table->timestamp('dibatalkan_pada')->nullable();
            $table->string('alasan_pembatalan')->nullable();
            $table->timestamps();

            $table->index(['daily_session_id', 'created_at']);
            $table->index(['daily_session_id', 'price_tier_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales_transactions');
    }
};
