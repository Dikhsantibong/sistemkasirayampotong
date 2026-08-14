<?php

namespace App\Enums;

enum UkuranAyam: string
{
    case Jumbo = 'jumbo';
    case Sedang = 'sedang';
    case Kecil = 'kecil';
    case SisaKemarin = 'sisa_kemarin';

    /**
     * Human readable label used in the UI and printed reports.
     */
    public function label(): string
    {
        return match ($this) {
            self::Jumbo => 'Jumbo',
            self::Sedang => 'Sedang',
            self::Kecil => 'Kecil',
            self::SisaKemarin => 'Sisa Kemarin',
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
