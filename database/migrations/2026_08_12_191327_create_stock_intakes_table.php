<?php

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
        Schema::create('stock_intakes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->constrained()->cascadeOnDelete();
            $table->enum('ukuran', UkuranAyam::values());
            $table->unsignedInteger('jumlah_ekor');
            $table->string('catatan')->nullable();
            $table->timestamps();

            $table->index(['daily_session_id', 'ukuran']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_intakes');
    }
};
