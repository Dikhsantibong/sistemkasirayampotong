<?php

namespace App\Http\Controllers\Kasir;

use App\Actions\Kasir\BuildDashboardStats;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show the owner's overview of every session on record.
     */
    public function __invoke(Request $request, BuildDashboardStats $buildStats): Response
    {
        $hari = BuildDashboardStats::periodeValid($request->query('hari'));

        return Inertia::render('dashboard', [
            'statistik' => $buildStats->handle($hari),
            'periodeTersedia' => BuildDashboardStats::PERIODES,
        ]);
    }
}
