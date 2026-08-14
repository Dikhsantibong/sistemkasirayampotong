<?php

namespace App\Http\Controllers\Kasir;

use App\Actions\Kasir\BuildDailyReport;
use App\Http\Controllers\Controller;
use App\Models\DailySession;
use Illuminate\Database\Eloquent\Builder;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    /**
     * List past daily sessions so a cashier can reopen any day's report.
     */
    public function index(): Response
    {
        return Inertia::render('kasir/riwayat', [
            'sesi' => DailySession::query()
                ->withCount([
                    'salesTransactions as jumlah_transaksi' => static fn (Builder $query): Builder => $query->whereNull('dibatalkan_pada'),
                ])
                ->withSum([
                    'salesTransactions as total_penjualan' => static fn (Builder $query): Builder => $query->whereNull('dibatalkan_pada'),
                ], 'subtotal')
                ->orderByDesc('tanggal')
                ->limit(90)
                ->get()
                /* The two aggregates are query-time aliases, so they are read
                   from the attribute bag rather than as model properties. */
                ->map(static fn (DailySession $session): array => [
                    'id' => $session->id,
                    'tanggal' => $session->tanggal->toDateString(),
                    'status' => $session->status->value,
                    'dibuka_oleh' => $session->dibuka_oleh,
                    'ditutup_oleh' => $session->ditutup_oleh,
                    'jumlah_transaksi' => (int) $session->getAttribute('jumlah_transaksi'),
                    'total_penjualan' => (float) ($session->getAttribute('total_penjualan') ?? 0),
                ])
                ->all(),
        ]);
    }

    /**
     * Show the computed end-of-day report for a single session.
     */
    public function show(DailySession $dailySession, BuildDailyReport $buildReport): Response
    {
        return Inertia::render('kasir/laporan', [
            'laporan' => $buildReport->handle($dailySession),
        ]);
    }
}
