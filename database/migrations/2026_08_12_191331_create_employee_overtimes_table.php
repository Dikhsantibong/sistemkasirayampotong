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
        Schema::create('employee_overtimes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('daily_session_id')->constrained()->cascadeOnDelete();
            $table->string('nama_karyawan');
            $table->time('jam_mulai');
            $table->time('jam_selesai');
            $table->string('keterangan')->nullable();
            $table->timestamps();

            $table->index(['daily_session_id', 'nama_karyawan']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_overtimes');
    }
};
