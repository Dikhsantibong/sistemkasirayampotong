<?php

namespace App\Actions\Kasir;

use App\Enums\StatusBayar;
use App\Enums\UkuranAyam;
use App\Models\DailySession;
use App\Models\SalesTransaction;
use Illuminate\Support\Collection;

/**
 * Computes the end-of-day figures for a session.
 *
 * Cancelled transactions are excluded from every money and headcount figure;
 * they are kept in the database purely as an audit trail.
 */
class BuildDailyReport
{
    /**
     * @return array{
     *     sesi: array{id: string, tanggal: string, status: string, dibuka_oleh: string, ditutup_oleh: string|null, catatan_penutupan: string|null},
     *     total_penjualan: float,
     *     total_ekor_terjual: int,
     *     per_tingkatan_harga: array<int, array{price_tier_id: string, harga: float, jumlah_ekor: int, jumlah_transaksi: int, total: float}>,
     *     per_ukuran: array<int, array{ukuran: string, label: string, masuk: int, terjual: int, mati: int, sisa: int}>,
     *     total_tunai: float,
     *     total_piutang: float,
     *     total_belum_bayar: float,
     *     total_uang_keluar: float,
     *     total_ayam_mati: int,
     *     kas_seharusnya: float,
     *     rekonsiliasi: array{uang_tunai_fisik: float, uang_catatan_piutang: float, uang_lebih_kurang: float, lain_lain: float|null, catatan: string|null}|null,
     *     lembur: array<int, array{nama_karyawan: string, jam_mulai: string, jam_selesai: string, keterangan: string|null}>,
     *     uang_keluar: array<int, array{jumlah: float, keterangan: string, created_at: string|null}>,
     *     piutang: array<int, array{nama_pembeli: string|null, jumlah_ekor: int, subtotal: float, created_at: string|null}>
     * }
     */
    public function handle(DailySession $session): array
    {
        $session->loadMissing([
            'priceTiers',
            'stockIntakes',
            'salesTransactions',
            'cashOuts',
            'deadChickens',
            'employeeOvertimes',
            'cashReconciliation',
        ]);

        $transaksiAktif = $session->salesTransactions->whereNull('dibatalkan_pada');

        $totalTunai = $this->sumSubtotal($transaksiAktif->where('status_bayar', StatusBayar::LunasTunai));
        $totalPiutang = $this->sumSubtotal($transaksiAktif->where('status_bayar', StatusBayar::Utang));
        $totalBelumBayar = $this->sumSubtotal($transaksiAktif->where('status_bayar', StatusBayar::BelumBayar));
        $totalUangKeluar = (float) $session->cashOuts->sum(static fn ($cashOut): float => (float) $cashOut->jumlah);
        $rekonsiliasi = $session->cashReconciliation;

        return [
            'sesi' => [
                'id' => $session->id,
                'tanggal' => $session->tanggal->toDateString(),
                'status' => $session->status->value,
                'dibuka_oleh' => $session->dibuka_oleh,
                'ditutup_oleh' => $session->ditutup_oleh,
                'catatan_penutupan' => $session->catatan_penutupan,
            ],
            'total_penjualan' => $this->sumSubtotal($transaksiAktif),
            'total_ekor_terjual' => (int) $transaksiAktif->sum('jumlah_ekor'),
            'per_tingkatan_harga' => $this->perTingkatanHarga($session, $transaksiAktif),
            'per_ukuran' => $this->perUkuran($session, $transaksiAktif),
            'total_tunai' => $totalTunai,
            'total_piutang' => $totalPiutang,
            'total_belum_bayar' => $totalBelumBayar,
            'total_uang_keluar' => $totalUangKeluar,
            'total_ayam_mati' => (int) $session->deadChickens->sum('jumlah_ekor'),
            'kas_seharusnya' => round($totalTunai - $totalUangKeluar, 2),
            'rekonsiliasi' => $rekonsiliasi === null ? null : [
                'uang_tunai_fisik' => (float) $rekonsiliasi->uang_tunai_fisik,
                'uang_catatan_piutang' => (float) $rekonsiliasi->uang_catatan_piutang,
                'uang_lebih_kurang' => (float) $rekonsiliasi->uang_lebih_kurang,
                'lain_lain' => $rekonsiliasi->lain_lain === null ? null : (float) $rekonsiliasi->lain_lain,
                'catatan' => $rekonsiliasi->catatan,
            ],
            'lembur' => $session->employeeOvertimes->map(static fn ($lembur): array => [
                'nama_karyawan' => $lembur->nama_karyawan,
                'jam_mulai' => $lembur->jam_mulai,
                'jam_selesai' => $lembur->jam_selesai,
                'keterangan' => $lembur->keterangan,
            ])->values()->all(),
            'uang_keluar' => $session->cashOuts->map(static fn ($cashOut): array => [
                'jumlah' => (float) $cashOut->jumlah,
                'keterangan' => $cashOut->keterangan,
                'created_at' => $cashOut->created_at?->toIso8601String(),
            ])->values()->all(),
            'piutang' => $transaksiAktif->where('status_bayar', StatusBayar::Utang)
                ->map(static fn ($transaksi): array => [
                    'nama_pembeli' => $transaksi->nama_pembeli,
                    'jumlah_ekor' => $transaksi->jumlah_ekor,
                    'subtotal' => (float) $transaksi->subtotal,
                    'created_at' => $transaksi->created_at?->toIso8601String(),
                ])->values()->all(),
        ];
    }

    /**
     * Breakdown of how many chickens were sold at each of today's price tiers.
     *
     * @param  Collection<int, SalesTransaction>  $transaksiAktif
     * @return array<int, array{price_tier_id: string, harga: float, jumlah_ekor: int, jumlah_transaksi: int, total: float}>
     */
    protected function perTingkatanHarga(DailySession $session, Collection $transaksiAktif): array
    {
        return $session->priceTiers->map(function ($tier) use ($transaksiAktif): array {
            $transaksi = $transaksiAktif->where('price_tier_id', $tier->id);

            return [
                'price_tier_id' => $tier->id,
                'harga' => (float) $tier->harga,
                'jumlah_ekor' => (int) $transaksi->sum('jumlah_ekor'),
                'jumlah_transaksi' => $transaksi->count(),
                'total' => $this->sumSubtotal($transaksi),
            ];
        })->values()->all();
    }

    /**
     * Remaining stock per size: intake minus sold minus dead.
     *
     * @param  Collection<int, SalesTransaction>  $transaksiAktif
     * @return array<int, array{ukuran: string, label: string, masuk: int, terjual: int, mati: int, sisa: int}>
     */
    protected function perUkuran(DailySession $session, Collection $transaksiAktif): array
    {
        return array_map(function (UkuranAyam $ukuran) use ($session, $transaksiAktif): array {
            $masuk = (int) $session->stockIntakes->where('ukuran', $ukuran)->sum('jumlah_ekor');
            $terjual = (int) $transaksiAktif->where('ukuran', $ukuran)->sum('jumlah_ekor');
            $mati = (int) $session->deadChickens->where('ukuran', $ukuran)->sum('jumlah_ekor');

            return [
                'ukuran' => $ukuran->value,
                'label' => $ukuran->label(),
                'masuk' => $masuk,
                'terjual' => $terjual,
                'mati' => $mati,
                'sisa' => $masuk - $terjual - $mati,
            ];
        }, UkuranAyam::cases());
    }

    /**
     * @param  Collection<int, SalesTransaction>  $transaksi
     */
    protected function sumSubtotal(Collection $transaksi): float
    {
        return round((float) $transaksi->sum(static fn ($item): float => (float) $item->subtotal), 2);
    }
}
