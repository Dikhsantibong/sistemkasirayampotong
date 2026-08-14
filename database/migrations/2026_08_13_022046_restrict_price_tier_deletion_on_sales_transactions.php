<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The original foreign key cascaded, so deleting a price tier silently
     * deleted every sale rung up under it — the takings for that price would
     * vanish from the books with no trace. Deleting a tier that carries sales
     * is now refused by the database as well as by the sync layer.
     *
     * The session cascade is deliberately left alone: removing a whole day is
     * meant to remove that day's rows with it.
     */
    public function up(): void
    {
        Schema::table('sales_transactions', function (Blueprint $table) {
            $table->dropForeign(['price_tier_id']);
            $table->foreign('price_tier_id')->references('id')->on('price_tiers')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_transactions', function (Blueprint $table) {
            $table->dropForeign(['price_tier_id']);
            $table->foreign('price_tier_id')->references('id')->on('price_tiers')->cascadeOnDelete();
        });
    }
};
