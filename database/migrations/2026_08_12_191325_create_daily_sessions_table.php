<?php

use App\Enums\StatusSesi;
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
        Schema::create('daily_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('tanggal')->unique();
            $table->enum('status', StatusSesi::values())->default(StatusSesi::Buka->value);
            $table->string('dibuka_oleh');
            $table->string('ditutup_oleh')->nullable();
            $table->text('catatan_penutupan')->nullable();
            $table->timestamp('ditutup_pada')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_sessions');
    }
};
