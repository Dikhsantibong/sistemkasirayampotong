<?php

namespace App\Actions\Kasir;

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use App\Models\CashOut;
use App\Models\DailySession;
use App\Models\DeadChicken;
use App\Models\SalesTransaction;
use App\Models\StockIntake;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use stdClass;

/**
 * Aggregates every session in a period into the numbers the dashboard plots.
 *
 * Everything is summed in SQL rather than by loading rows, so a shop with a
 * year of trading still renders from a handful of grouped queries.
 *
 * Cancelled transactions are excluded throughout, matching BuildDailyReport.
 */
class BuildDashboardStats
{
    /** Periods the dashboard offers, in days. `0` means every session on record. */
    public const PERIODES = [30, 90, 365, 0];

    /**
     * @return array{
     *     periode: array{hari: int, dari: string|null, sampai: string, label: string},
     *     kpi: array<string, float|int>,
     *     harian: array<int, array{tanggal: string, omzet: float, ekor: int, tunai: float, piutang: float, uang_keluar: float, kumulatif: float}>,
     *     per_harga: array<int, array{harga: float, ekor: int, total: float, jumlah_transaksi: int}>,
     *     per_ukuran: array<int, array{ukuran: string, label: string, masuk: int, terjual: int, mati: int, sisa: int}>,
     *     status_bayar: array<int, array{status: string, label: string, total: float, jumlah: int}>,
     *     sesi_terakhir: array<int, array{id: string, tanggal: string, status: string, omzet: float, ekor: int, ditutup_oleh: string|null}>
     * }
     */
    public function handle(int $hari = 90): array
    {
        $dari = $hari > 0 ? today()->subDays($hari - 1) : null;

        $sesi = DailySession::query()
            ->when($dari, fn ($query) => $query->whereDate('tanggal', '>=', $dari))
            ->orderBy('tanggal')
            ->get();

        $idSesi = $sesi->pluck('id')->all();

        $penjualanHarian = $this->penjualanPerSesi($idSesi);
        $uangKeluarHarian = $this->uangKeluarPerSesi($idSesi);
        $harian = $this->deretHarian($sesi, $penjualanHarian, $uangKeluarHarian);
        $statusBayar = $this->totalPerStatusBayar($idSesi);

        $totalOmzet = round(array_sum(array_column($harian, 'omzet')), 2);
        $totalTunai = round(array_sum(array_column($harian, 'tunai')), 2);
        $totalUangKeluar = round(array_sum(array_column($harian, 'uang_keluar')), 2);
        $hariBerjualan = count(array_filter($harian, static fn (array $baris): bool => $baris['omzet'] > 0));

        return [
            'periode' => [
                'hari' => $hari,
                'dari' => $dari?->toDateString(),
                'sampai' => today()->toDateString(),
                'label' => $this->labelPeriode($hari),
            ],
            'kpi' => [
                'total_omzet' => $totalOmzet,
                'total_ekor' => (int) array_sum(array_column($harian, 'ekor')),
                'total_tunai' => $totalTunai,
                'total_piutang' => $this->totalStatus($statusBayar, StatusBayar::Utang),
                'total_belum_bayar' => $this->totalStatus($statusBayar, StatusBayar::BelumBayar),
                'total_uang_keluar' => $totalUangKeluar,
                'kas_bersih' => round($totalTunai - $totalUangKeluar, 2),
                'total_ayam_mati' => $this->totalAyamMati($idSesi),
                'jumlah_sesi' => $sesi->count(),
                'hari_berjualan' => $hariBerjualan,
                'rata_omzet_per_hari' => $hariBerjualan > 0 ? round($totalOmzet / $hariBerjualan, 2) : 0.0,
                'omzet_tertinggi' => round((float) max([0, ...array_column($harian, 'omzet')]), 2),
            ],
            'harian' => $harian,
            'per_harga' => $this->penjualanPerHarga($idSesi),
            'per_ukuran' => $this->rekapPerUkuran($idSesi),
            'status_bayar' => $statusBayar,
            'sesi_terakhir' => $this->sesiTerakhir($sesi, $penjualanHarian),
        ];
    }

    /**
     * Revenue, chicken count and cash split for each session, keyed by session id.
     *
     * These queries drop to the base builder with `toBase()`: the rows are
     * aggregates, not transactions, so hydrating them into models would hand
     * back a `SalesTransaction` whose columns are sums — a type that lies.
     *
     * @param  array<int, string>  $idSesi
     * @return Collection<int|string, stdClass>
     */
    protected function penjualanPerSesi(array $idSesi): Collection
    {
        if ($idSesi === []) {
            return collect();
        }

        return SalesTransaction::query()
            ->whereNull('dibatalkan_pada')
            ->whereIn('daily_session_id', $idSesi)
            ->groupBy('daily_session_id')
            ->selectRaw('daily_session_id')
            ->selectRaw('SUM(subtotal) AS omzet')
            ->selectRaw('SUM(jumlah_ekor) AS ekor')
            ->selectRaw('SUM(CASE WHEN status_bayar = ? THEN subtotal ELSE 0 END) AS tunai', [StatusBayar::LunasTunai->value])
            ->selectRaw('SUM(CASE WHEN status_bayar = ? THEN subtotal ELSE 0 END) AS piutang', [StatusBayar::Utang->value])
            ->toBase()
            ->get()
            ->keyBy('daily_session_id');
    }

    /**
     * @param  array<int, string>  $idSesi
     * @return Collection<int|string, stdClass>
     */
    protected function uangKeluarPerSesi(array $idSesi): Collection
    {
        if ($idSesi === []) {
            return collect();
        }

        return CashOut::query()
            ->whereIn('daily_session_id', $idSesi)
            ->groupBy('daily_session_id')
            ->selectRaw('daily_session_id, SUM(jumlah) AS total')
            ->toBase()
            ->get()
            ->keyBy('daily_session_id');
    }

    /**
     * One row per session, in date order, carrying the running total.
     *
     * The cumulative column is what the S-curve plots: a flat stretch means
     * days with no trading, a steepening slope means the shop speeding up.
     *
     * @param  Collection<int, DailySession>  $sesi
     * @param  Collection<int|string, stdClass>  $penjualan
     * @param  Collection<int|string, stdClass>  $uangKeluar
     * @return array<int, array{tanggal: string, omzet: float, ekor: int, tunai: float, piutang: float, uang_keluar: float, kumulatif: float}>
     */
    protected function deretHarian(Collection $sesi, Collection $penjualan, Collection $uangKeluar): array
    {
        $kumulatif = 0.0;

        return $sesi->map(function (DailySession $baris) use ($penjualan, $uangKeluar, &$kumulatif): array {
            $jual = $penjualan->get($baris->id);
            $omzet = round((float) ($jual->omzet ?? 0), 2);
            $kumulatif = round($kumulatif + $omzet, 2);

            return [
                'tanggal' => $baris->tanggal->toDateString(),
                'omzet' => $omzet,
                'ekor' => (int) ($jual->ekor ?? 0),
                'tunai' => round((float) ($jual->tunai ?? 0), 2),
                'piutang' => round((float) ($jual->piutang ?? 0), 2),
                'uang_keluar' => round((float) ($uangKeluar->get($baris->id)->total ?? 0), 2),
                'kumulatif' => $kumulatif,
            ];
        })->values()->all();
    }

    /**
     * Sales grouped by the price itself, not by tier row.
     *
     * Tier ids are recreated every day, so grouping by `harga` is what answers
     * the question the shop actually asks: at 65rb, how many chickens went out?
     *
     * @param  array<int, string>  $idSesi
     * @return array<int, array{harga: float, ekor: int, total: float, jumlah_transaksi: int}>
     */
    protected function penjualanPerHarga(array $idSesi): array
    {
        if ($idSesi === []) {
            return [];
        }

        return SalesTransaction::query()
            ->join('price_tiers', 'price_tiers.id', '=', 'sales_transactions.price_tier_id')
            ->whereNull('sales_transactions.dibatalkan_pada')
            ->whereIn('sales_transactions.daily_session_id', $idSesi)
            ->groupBy('price_tiers.harga')
            ->orderBy('price_tiers.harga')
            ->selectRaw('price_tiers.harga')
            ->selectRaw('SUM(sales_transactions.jumlah_ekor) AS ekor')
            ->selectRaw('SUM(sales_transactions.subtotal) AS total')
            ->selectRaw('COUNT(*) AS jumlah_transaksi')
            ->toBase()
            ->get()
            ->map(static fn (object $baris): array => [
                'harga' => round((float) $baris->harga, 2),
                'ekor' => (int) $baris->ekor,
                'total' => round((float) $baris->total, 2),
                'jumlah_transaksi' => (int) $baris->jumlah_transaksi,
            ])
            ->all();
    }

    /**
     * Intake against what became sales, losses and leftovers, per size.
     *
     * @param  array<int, string>  $idSesi
     * @return array<int, array{ukuran: string, label: string, masuk: int, terjual: int, mati: int, sisa: int}>
     */
    protected function rekapPerUkuran(array $idSesi): array
    {
        $masuk = $this->jumlahEkorPerUkuran(StockIntake::query(), $idSesi);
        $mati = $this->jumlahEkorPerUkuran(DeadChicken::query(), $idSesi);
        $terjual = $idSesi === [] ? collect() : SalesTransaction::query()
            ->whereNull('dibatalkan_pada')
            ->whereIn('daily_session_id', $idSesi)
            ->whereNotNull('ukuran')
            ->groupBy('ukuran')
            ->selectRaw('ukuran, SUM(jumlah_ekor) AS jumlah')
            ->pluck('jumlah', 'ukuran');

        return array_map(static function (UkuranAyam $ukuran) use ($masuk, $terjual, $mati): array {
            $jumlahMasuk = (int) ($masuk[$ukuran->value] ?? 0);
            $jumlahTerjual = (int) ($terjual[$ukuran->value] ?? 0);
            $jumlahMati = (int) ($mati[$ukuran->value] ?? 0);

            return [
                'ukuran' => $ukuran->value,
                'label' => $ukuran->label(),
                'masuk' => $jumlahMasuk,
                'terjual' => $jumlahTerjual,
                'mati' => $jumlahMati,
                'sisa' => $jumlahMasuk - $jumlahTerjual - $jumlahMati,
            ];
        }, UkuranAyam::cases());
    }

    /**
     * @param  Builder<covariant \Illuminate\Database\Eloquent\Model>  $query
     * @param  array<int, string>  $idSesi
     * @return Collection<string, int>
     */
    protected function jumlahEkorPerUkuran($query, array $idSesi): Collection
    {
        if ($idSesi === []) {
            return collect();
        }

        return $query
            ->whereIn('daily_session_id', $idSesi)
            ->groupBy('ukuran')
            ->selectRaw('ukuran, SUM(jumlah_ekor) AS jumlah')
            ->pluck('jumlah', 'ukuran');
    }

    /**
     * @param  array<int, string>  $idSesi
     * @return array<int, array{status: string, label: string, total: float, jumlah: int}>
     */
    protected function totalPerStatusBayar(array $idSesi): array
    {
        $rekap = $idSesi === [] ? collect() : SalesTransaction::query()
            ->whereNull('dibatalkan_pada')
            ->whereIn('daily_session_id', $idSesi)
            ->groupBy('status_bayar')
            ->selectRaw('status_bayar, SUM(subtotal) AS total, COUNT(*) AS jumlah')
            ->get()
            ->keyBy('status_bayar');

        return array_map(static fn (StatusBayar $status): array => [
            'status' => $status->value,
            'label' => $status->label(),
            'total' => round((float) ($rekap->get($status->value)->total ?? 0), 2),
            'jumlah' => (int) ($rekap->get($status->value)->jumlah ?? 0),
        ], StatusBayar::cases());
    }

    /**
     * @param  array<int, array{status: string, label: string, total: float, jumlah: int}>  $statusBayar
     */
    protected function totalStatus(array $statusBayar, StatusBayar $status): float
    {
        foreach ($statusBayar as $baris) {
            if ($baris['status'] === $status->value) {
                return $baris['total'];
            }
        }

        return 0.0;
    }

    /**
     * @param  array<int, string>  $idSesi
     */
    protected function totalAyamMati(array $idSesi): int
    {
        if ($idSesi === []) {
            return 0;
        }

        return (int) DeadChicken::query()->whereIn('daily_session_id', $idSesi)->sum('jumlah_ekor');
    }

    /**
     * @param  Collection<int, DailySession>  $sesi
     * @param  Collection<int|string, stdClass>  $penjualan
     * @return array<int, array{id: string, tanggal: string, status: string, omzet: float, ekor: int, ditutup_oleh: string|null}>
     */
    protected function sesiTerakhir(Collection $sesi, Collection $penjualan): array
    {
        return $sesi->sortByDesc('tanggal')->take(10)->map(static function (DailySession $baris) use ($penjualan): array {
            $jual = $penjualan->get($baris->id);

            return [
                'id' => $baris->id,
                'tanggal' => $baris->tanggal->toDateString(),
                'status' => $baris->status->value,
                'omzet' => round((float) ($jual->omzet ?? 0), 2),
                'ekor' => (int) ($jual->ekor ?? 0),
                'ditutup_oleh' => $baris->ditutup_oleh,
            ];
        })->values()->all();
    }

    protected function labelPeriode(int $hari): string
    {
        return match ($hari) {
            30 => '30 hari terakhir',
            90 => '90 hari terakhir',
            365 => '1 tahun terakhir',
            default => 'Seluruh riwayat',
        };
    }

    /**
     * Guard against an arbitrary `?hari=` from the query string.
     */
    public static function periodeValid(mixed $hari): int
    {
        $angka = is_numeric($hari) ? (int) $hari : 90;

        return in_array($angka, self::PERIODES, true) ? $angka : 90;
    }
}
