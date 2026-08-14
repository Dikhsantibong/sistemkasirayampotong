<?php

use App\Http\Controllers\Kasir\ReportController;
use App\Http\Controllers\Kasir\SyncController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('kasir')->name('kasir.')->group(function () {
    /**
     * Offline-first screens open to both roles. Every one of these reads and
     * writes Dexie in the browser, so the server only hands over the page
     * shell — what a kasir may actually save is decided when the queue is
     * pushed, in `SyncPermissions`.
     */
    Route::inertia('pos', 'kasir/pos')->name('pos');
    Route::inertia('sesi', 'kasir/sesi')->name('sesi');
    Route::inertia('stok', 'kasir/stok')->name('stok');
    /** Whoever opens the stall sets the day's prices — kasir or owner. */
    Route::inertia('harga', 'kasir/harga')->name('harga');
    Route::inertia('uang-keluar', 'kasir/uang-keluar')->name('uang-keluar');
    Route::inertia('ayam-mati', 'kasir/ayam-mati')->name('ayam-mati');
    Route::inertia('lembur', 'kasir/lembur')->name('lembur');
    Route::inertia('printer', 'kasir/printer')->name('printer');

    /**
     * Owner-only. Closing the session sets the cash variance, and the reports
     * are the shop's books — neither belongs to the employee working the till.
     */
    Route::middleware('pemilik')->group(function () {
        Route::inertia('tutup-sesi', 'kasir/tutup-sesi')->name('tutup-sesi');

        Route::get('riwayat', [ReportController::class, 'index'])->name('riwayat');
        Route::get('riwayat/{dailySession}', [ReportController::class, 'show'])->name('laporan');
    });

    /** Replication endpoints used by the client sync queue. */
    Route::post('sync/push', [SyncController::class, 'push'])->name('sync.push');
    Route::get('sync/pull', [SyncController::class, 'pull'])->name('sync.pull');
});
