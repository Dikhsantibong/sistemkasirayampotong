<?php

namespace App\Enums;

enum PeranPengguna: string
{
    /** Pemilik/supervisor toko — akses penuh, termasuk seluruh laporan keuangan. */
    case Pemilik = 'pemilik';

    /** Karyawan yang menjaga kasir — hanya mencatat, tidak melihat laporan. */
    case Kasir = 'kasir';

    /**
     * Human readable label used in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pemilik => 'Pemilik',
            self::Kasir => 'Kasir',
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
