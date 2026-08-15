<?php

use App\Http\Controllers\Kasir\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('login');
})->name('home');

/**
 * The dashboard is the shop's books at a glance, so it sits behind the same
 * `pemilik` gate as the reports rather than the plain auth group.
 */
Route::middleware(['auth', 'verified', 'pemilik'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
});

Route::inertia('/install', 'install')->name('install');

require __DIR__.'/kasir.php';
require __DIR__.'/settings.php';
