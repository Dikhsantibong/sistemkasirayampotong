import { Link } from '@inertiajs/react';
import {
    Banknote,
    CalendarCheck,
    ClipboardList,
    Clock,
    History,
    LayoutGrid,
    PackagePlus,
    Printer,
    ShoppingCart,
    Skull,
    Tags,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { usePeran } from '@/hooks/use-peran';
import { dashboard } from '@/routes';
import kasir from '@/routes/kasir';
import type { NavItem } from '@/types';

/**
 * The owner's overview. First in their sidebar because it is where they start
 * the day; a kasir never sees it, so their list opens on Layar Kasir instead.
 */
const ikhtisarNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

/** The screens used while serving a queue of buyers — kept first and short. */
const kasirNavItems: NavItem[] = [
    {
        title: 'Layar Kasir',
        href: kasir.pos(),
        icon: ShoppingCart,
    },
    {
        title: 'Sesi Hari Ini',
        href: kasir.sesi(),
        icon: CalendarCheck,
    },
    {
        title: 'Stok Masuk',
        href: kasir.stok(),
        icon: PackagePlus,
    },
    {
        /** Whoever opens the stall sets the day's prices — kasir or owner. */
        title: 'Tingkatan Harga',
        href: kasir.harga(),
        icon: Tags,
    },
];

/** Things recorded as they happen through the day. */
const catatanNavItems: NavItem[] = [
    {
        title: 'Uang Keluar',
        href: kasir.uangKeluar(),
        icon: Banknote,
    },
    {
        title: 'Ayam Mati',
        href: kasir.ayamMati(),
        icon: Skull,
    },
    {
        title: 'Lembur Karyawan',
        href: kasir.lembur(),
        icon: Clock,
    },
];

/**
 * Owner-only destinations. Hidden from a kasir so the menu matches what they
 * can actually open — the routes themselves are behind `pemilik` middleware.
 */
const pemilikNavItems: NavItem[] = [
    {
        title: 'Tutup Sesi',
        href: kasir.tutupSesi(),
        icon: ClipboardList,
    },
    {
        title: 'Riwayat Laporan',
        href: kasir.riwayat(),
        icon: History,
    },
];

const alatNavItems: NavItem[] = [
    {
        title: 'Pengaturan Printer',
        href: kasir.printer(),
        icon: Printer,
    },
];

export function AppSidebar() {
    const { isPemilik } = usePeran();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={kasir.pos()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {isPemilik && (
                    <NavMain items={ikhtisarNavItems} label="Ikhtisar" />
                )}
                <NavMain items={kasirNavItems} label="Kasir" />
                <NavMain items={catatanNavItems} label="Catatan Harian" />
                {isPemilik && (
                    <NavMain items={pemilikNavItems} label="Pemilik" />
                )}
                <NavMain items={alatNavItems} label="Alat" />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
