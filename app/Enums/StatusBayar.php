<?php

namespace App\Enums;

enum StatusBayar: string
{
    case LunasTunai = 'lunas_tunai';
    case Utang = 'utang';
    case BelumBayar = 'belum_bayar';

    /**
     * Human readable label used in the UI and printed receipts.
     */
    public function label(): string
    {
        return match ($this) {
            self::LunasTunai => 'Lunas Tunai',
            self::Utang => 'Utang',
            self::BelumBayar => 'Belum Bayar',
        };
    }

    /**
     * Whether the transaction has already been settled in cash.
     */
    public function isSettled(): bool
    {
        return $this === self::LunasTunai;
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
