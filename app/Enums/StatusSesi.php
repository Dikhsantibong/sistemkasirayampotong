<?php

namespace App\Enums;

enum StatusSesi: string
{
    case Buka = 'buka';
    case Ditutup = 'ditutup';

    /**
     * Human readable label used in the UI and printed reports.
     */
    public function label(): string
    {
        return match ($this) {
            self::Buka => 'Buka',
            self::Ditutup => 'Ditutup',
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
