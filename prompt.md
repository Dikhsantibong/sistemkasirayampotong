# Kasir Penjualan Ayam Potong (PWA) — Status Implementasi

> **Status: sudah dibangun.** Dokumen ini semula berisi prompt spesifikasi. Setelah
> implementasi selesai, isinya diperbarui menjadi catatan tentang apa yang benar-benar
> ada di repo ini, keputusan arsitektur yang diambil, dan apa yang masih tersisa.
>
> Terakhir diperbarui: 13 Agustus 2026 — peran Pemilik vs Kasir (§2b), harga kini bisa
> diatur kasir maupun pemilik, dan Dashboard analitik lengkap (§8b).

---

## 1. Ringkasan Aplikasi

Aplikasi kasir untuk toko/lapak penjualan ayam potong harian:

- Harga jual **berubah setiap hari** tergantung stok ayam yang masuk (bukan harga tetap per produk).
- Ayam dikategorikan per **ukuran**: Jumbo, Sedang, Kecil, Sisa Kemarin.
- Setiap hari kasir menentukan **daftar tingkatan harga aktif** (mis. 55rb, 65rb, 70rb, 75rb) — jumlah tingkatan dan nominalnya fleksibel, bisa beda tiap hari.
- Setiap transaksi jual dicatat masuk ke salah satu tingkatan harga tersebut, sehingga di akhir hari sistem tahu persis: harga 55rb terjual berapa ekor, harga 65rb berapa ekor, dst.
- **Bisa dipakai offline** — transaksi tetap bisa diinput, baru sinkron ke server saat online kembali.
- **Cetak struk via printer thermal Bluetooth** (58mm/80mm) tiap transaksi.
- Responsive, dipakai baik di HP/tablet kasir maupun komputer/laptop toko.

---

## 2. Keputusan Arsitektur — dibangun di atas Inertia, bukan SPA terpisah

Spesifikasi awal meminta **React + Vite PWA terpisah** dengan **Laravel API + Sanctum**.
Repo ini ternyata sudah berupa **Laravel React Starter Kit berbasis Inertia v3 + Fortify**,
dan `CLAUDE.md` mewajibkan konvensi Inertia.

Yang diambil adalah jalan tengah yang memang sudah diantisipasi di spesifikasi awal:

| Aspek | Rencana awal | Yang dibangun | Alasan |
|---|---|---|---|
| Shell & routing | SPA React+Vite murni | Inertia v3 + React 19 | Repo sudah Inertia; membuang starter kit berarti membuang auth, layout, dan komponen UI yang sudah ada |
| Auth | Sanctum token | Fortify (session cookie) | Sudah terpasang lengkap (login, 2FA, passkey). Endpoint sync ikut session guard yang sama |
| Data layar kasir | Dexie | **Dexie (tidak berubah)** | Ini inti syarat offline — tetap dipenuhi penuh |
| Halaman laporan | Client-side | Server-rendered Inertia | Laporan lintas hari memang butuh server; tidak perlu offline |

**Konsekuensi yang perlu diketahui:** semua layar kasir menulis ke Dexie lebih dulu dan
tidak pernah menunggu server, jadi tetap jalan penuh saat offline. Halaman
**Riwayat Laporan** dan **Laporan Harian** membaca dari server, jadi **butuh koneksi** —
ini disengaja, karena laporan hari-hari lampau memang bukan data yang ada di perangkat.

### Dependensi yang ditambahkan

Diperlukan oleh spesifikasi, di luar starter kit bawaan:

- `dexie` + `dexie-react-hooks` — penyimpanan offline
- `vite-plugin-pwa` — service worker + manifest

---

## 2b. Peran & Hak Akses

Ada dua peran, disimpan di kolom `users.role` (enum `pemilik` / `kasir`):

- **Kasir** — karyawan yang menjaga meja kasir. Hanya **mencatat**.
- **Pemilik** — pemilik/supervisor. Akses penuh, termasuk seluruh laporan keuangan.

### Pembagian kewenangan

| Aksi | Kasir | Pemilik |
|---|:--:|:--:|
| Input transaksi penjualan + cetak struk | ✅ | ✅ |
| Buka sesi harian | ✅ | ✅ |
| Catat stok masuk | ✅ | ✅ |
| **Atur tingkatan harga hari ini** | ✅ | ✅ |
| Hapus tingkatan harga yang belum terpakai | ✅ | ✅ |
| Catat uang keluar / ayam mati / lembur | ✅ | ✅ |
| Atur printer | ✅ | ✅ |
| **Batalkan transaksi** | ❌ | ✅ |
| **Hapus catatan selain tingkatan harga** | ❌ | ✅ |
| **Tutup sesi + rekonsiliasi kas** | ❌ | ✅ |
| **Dashboard, riwayat & laporan keuangan** | ❌ | ✅ |
| **Lihat total omzet & uang keluar hari ini** | ❌ | ✅ |

**Harga sengaja dibuka untuk kasir.** Harga ayam ditentukan tiap pagi dari harga kulakan
hari itu, dan yang membuka lapak sama seringnya kasir maupun pemilik — mengunci harga di
pemilik saja berarti kasir tidak bisa mulai jualan sebelum pemilik datang. Kasir juga
boleh menghapus tingkatan harga **yang belum dipakai transaksi**, supaya salah ketik bisa
dibetulkan sendiri.

Kasir tetap melihat *jumlah ekor terjual* hari ini dan daftar transaksinya sendiri
(termasuk nominal per transaksi — dia yang memegang uangnya), tapi **tidak** melihat
angka agregat omzet.

### ⚠️ Di mana penegakannya — dan kenapa bukan di UI

Layar kasir menulis ke Dexie lalu push belakangan, jadi **menyembunyikan tombol di React
tidak mengamankan apa pun** — browser kasir tetap bisa POST apa saja ke
`/kasir/sync/push`. Karena itu ada tiga lapis, dan hanya dua yang pertama yang
benar-benar mengamankan:

| Lapis | Berkas | Sifat |
|---|---|---|
| **1. Endpoint sync** | `app/Actions/Kasir/SyncPermissions.php` | **Batas keamanan sebenarnya.** Setiap mutasi dicek per tabel + operasi + isi payload |
| **2. Middleware route** | `app/Http/Middleware/EnsureUserIsPemilik.php`, alias `pemilik` | Melindungi halaman server-rendered (harga, tutup sesi, laporan) → 403 |
| **3. UI** | `resources/js/hooks/use-peran.ts` | **Kenyamanan saja**, bukan keamanan — menu & tombol disembunyikan |

Dua aturan bersifat **per-field**, bukan per-tabel, karena baris yang sama ditulis kedua
peran di saat berbeda:

- `daily_sessions` boleh ditulis kasir, **kecuali** kalau `status = ditutup`
- `sales_transactions` boleh ditulis kasir, **kecuali** kalau `dibatalkan_pada` diisi

Keduanya adalah momen uang bisa hilang diam-diam, jadi keduanya khusus pemilik.

### Pull juga dibatasi

`GET /kasir/sync/pull` untuk kasir **hanya mengembalikan sesi hari ini** beserta
turunannya. Tanpa ini, perangkat kasir akan menyimpan omzet seluruh hari lampau di
IndexedDB, tidak peduli apa yang disembunyikan UI. Pemilik menarik seluruh riwayat.

### Kalau satu mutasi ditolak

Server membalas `forbidden`. Klien membuang entri itu dari antrean (mencoba ulang tidak
akan mengubah peran), lalu pull berikutnya menimpa baris lokal dengan versi server —
jadi perangkat kembali sinkron dengan pembukuan, dan kasir melihat toast berisi alasannya.
Mutasi lain dalam batch yang sama tetap diproses normal.

### Akun bawaan

Akun baru **default-nya `kasir`** (least privilege) — termasuk yang mendaftar sendiri
lewat `/register`, jadi orang asing tidak bisa langsung membaca pembukuan.

| Email | Password | Peran |
|---|---|---|
| `pemilik@example.com` | `password` | Pemilik |
| `kasir@example.com` | `password` | Kasir |
| `test@example.com` | `password` | Pemilik |

> Ganti/hapus akun-akun ini sebelum dipakai di lapak sungguhan.

### Batas yang gampang digeser

Kalau pembagiannya kurang pas dengan cara kerja toko, tiap batas ini satu baris saja:

- **Kasir tidak bisa tutup sesi** → kalau kasir yang biasa tutup toko, longgarkan di
  `SyncPermissions::allows()` + keluarkan route dari grup `pemilik`.
- **Kasir tidak bisa membatalkan transaksi** → longgarkan di `SyncPermissions::allows()`.
- **Kasir tidak lihat total omzet** → longgarkan di `pos.tsx` / `sesi.tsx`.

---

## 3. Tech Stack Aktual

- **Laravel 13** (PHP 8.4), MySQL. Auth lewat **Fortify**.
- **Inertia v3 + React 19 + TypeScript**, Vite 8, Tailwind v4, komponen shadcn yang sudah ada.
- **Wayfinder** untuk route helper bertipe (`@/routes/kasir`).
- **Dexie.js** sebagai sumber kebenaran di sisi klien.
- **vite-plugin-pwa** (Workbox) — `generateSW`, manifest `id`/`start_url: /kasir/pos`.
- **Web Bluetooth + ESC/POS** untuk struk.
- **PHPUnit** untuk tes, **Pint** untuk format, **PHPStan/Larastan level 7**.

> ⚠️ **Batasan Web Bluetooth:** hanya didukung Chrome/Edge di Android, Windows, macOS, dan
> Linux — **tidak didukung di iPhone/iPad sama sekali** (batasan platform Apple, bukan
> batasan kode). Kalau kasir memakai iOS, cetak Bluetooth langsung **tidak akan berfungsi**.
> Aplikasi menampilkan peringatan eksplisit soal ini di halaman Pengaturan Printer.

---

## 4. Peta File

### Backend

| Berkas | Isi |
|---|---|
| `app/Enums/{UkuranAyam,StatusSesi,StatusBayar,PeranPengguna}.php` | Enum terbacking string, punya `label()` untuk UI/struk |
| `app/Models/*.php` | 8 model, semuanya `HasUuids` (id dibuat klien saat offline) |
| `database/migrations/2026_08_12_1913*` | 8 tabel, UUID PK, FK cascade |
| `database/migrations/2026_08_13_020336_*` | Kolom `role` di `users`, default `kasir` |
| `database/factories/*.php` | Factory + state (`pemilik()`, `ditutup()`, `hariIni()`, `utang()`, `dibatalkan()`) |
| `app/Actions/Kasir/SyncSchema.php` | Allowlist tabel + urutan dependensi + aturan validasi per tabel |
| `app/Actions/Kasir/SyncPermissions.php` | **Batas keamanan peran** — apa yang boleh ditulis tiap peran |
| `app/Actions/Kasir/ApplySyncMutations.php` | Terapkan batch mutasi, cek izin, last-write-wins |
| `app/Actions/Kasir/BuildDailyReport.php` | Hitung seluruh angka laporan penutupan |
| `app/Actions/Kasir/BuildDashboardStats.php` | Agregasi lintas sesi untuk dashboard (§8b) |
| `app/Http/Middleware/EnsureUserIsPemilik.php` | Middleware alias `pemilik` untuk halaman server-rendered |
| `app/Http/Controllers/Kasir/SyncController.php` | `push` / `pull` (pull dibatasi hari ini untuk kasir) |
| `app/Http/Controllers/Kasir/ReportController.php` | Halaman riwayat + laporan harian |
| `app/Http/Controllers/Kasir/DashboardController.php` | Halaman dashboard + filter periode |
| `app/Http/Requests/Kasir/SyncPushRequest.php` | Validasi amplop batch |
| `routes/kasir.php` | Semua route `kasir.*`, grup `pemilik` terpisah |
| `routes/web.php` | `/dashboard` di balik gerbang `pemilik` |

### Frontend

| Berkas | Isi |
|---|---|
| `resources/js/offline/types.ts` | Tipe baris yang direplikasi, identik dengan server |
| `resources/js/offline/db.ts` | Skema Dexie + `sync_queue` + `sync_meta` |
| `resources/js/offline/mutations.ts` | `persist()` / `amend()` / `forget()` — tulis lokal + antre sinkron dalam satu transaksi |
| `resources/js/offline/queries.ts` | Query Dexie + `summarise()` (aritmatika laporan versi offline) |
| `resources/js/offline/sync.ts` | Mesin sinkron: push, pull, deteksi online, retry |
| `resources/js/offline/service-worker.ts` | Registrasi SW (produksi saja) |
| `resources/js/lib/kasir/escpos.ts` | `generateReceiptBytes()` + `renderReceiptText()` |
| `resources/js/lib/kasir/printer.ts` | Web Bluetooth, pengaturan printer (localStorage) |
| `resources/js/lib/kasir/format.ts` | Format rupiah, tanggal, jam |
| `resources/js/hooks/use-kasir-session.ts` | Semua data sesi hari ini, live dari Dexie |
| `resources/js/hooks/use-sync.ts` | Status koneksi + jumlah data pending |
| `resources/js/hooks/use-peran.ts` | Peran user aktif — untuk menyembunyikan UI (bukan keamanan) |
| `resources/js/components/kasir/charts.tsx` | Grafik SVG buatan sendiri: kurva S, bar harian, ramp harga, stack ukuran & status |
| `resources/js/components/kasir/*` | Indikator sinkron, frame halaman, badge status bayar |
| `resources/js/pages/kasir/*.tsx` | 11 halaman kasir |
| `resources/js/pages/dashboard.tsx` | Dashboard analitik pemilik |

---

## 5. Skema Data

Skema identik antara Dexie (offline) dan MySQL (server). Semua PK **UUID** karena baris
dibuat di perangkat saat offline — server tidak boleh yang menentukan id.

### `daily_sessions`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | dibuat di klien |
| tanggal | date, **unique** | satu sesi per hari |
| status | enum | `buka`, `ditutup` |
| dibuka_oleh | string | |
| ditutup_oleh | string, nullable | |
| catatan_penutupan | text, nullable | |
| ditutup_pada | timestamp, nullable | *(tambahan di luar spesifikasi awal — dipakai untuk audit)* |

### `price_tiers`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| daily_session_id | FK cascade | |
| harga | decimal(12,2) | mis. 55000, 65000 |
| urutan | int | urutan tombol di layar kasir |

### `stock_intakes`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| daily_session_id | FK cascade | |
| ukuran | enum | `jumbo`, `sedang`, `kecil`, `sisa_kemarin` |
| jumlah_ekor | int | |
| catatan | string, nullable | |

### `sales_transactions`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| daily_session_id | FK cascade | |
| price_tier_id | FK **restrict** | menentukan harga per ekor saat itu |
| ukuran | enum, nullable | opsional |
| jumlah_ekor | int | |
| subtotal | decimal(12,2) | auto-calc, override manual diperbolehkan |
| status_bayar | enum | `lunas_tunai`, `utang`, `belum_bayar` |
| nama_pembeli | string, nullable | **wajib** jika status `utang` (divalidasi di server) |
| catatan | text, nullable | |
| dibatalkan_pada | timestamp, nullable | *(pengganti hard delete)* |
| alasan_pembatalan | string, nullable | *(log alasan pembatalan)* |

> Pembatalan transaksi **tidak menghapus baris** — ditandai `dibatalkan_pada` supaya jejak
> audit tetap ada, dan seluruh perhitungan laporan mengabaikan baris yang dibatalkan.

> **Bug yang diperbaiki:** `price_tier_id` semula `cascadeOnDelete`, sehingga menghapus
> satu tingkatan harga **ikut menghapus seluruh transaksi** di harga itu — omzetnya hilang
> dari pembukuan tanpa jejak. Sekarang `restrictOnDelete`, ditambah penolakan eksplisit di
> `ApplySyncMutations` agar kasir mendapat kalimat yang bisa ditindaklanjuti, bukan error
> constraint. Menghapus **seluruh sesi** tetap bisa: transaksinya dibersihkan lebih dulu
> secara berurutan, karena kalau dibiarkan cascade sendiri, MySQL tersandung foreign
> key-nya sendiri (ini benar-benar terjadi saat diuji).

> Kolom `synced` di spesifikasi awal **tidak dipakai**. Status sinkron hidup di tabel
> `sync_queue` Dexie, bukan menempel di tiap baris — satu baris bisa punya beberapa
> perubahan yang belum terkirim, jadi flag boolean tidak cukup.

### `cash_outs`, `dead_chickens`, `employee_overtimes`, `cash_reconciliations`
Sesuai spesifikasi awal. `cash_reconciliations.daily_session_id` **unique** (satu
rekonsiliasi per sesi). Nama tabel dijamakkan mengikuti konvensi Laravel
(`cash_out` → `cash_outs`, `dead_chickens`, `employee_overtimes`).

---

## 6. Cara Kerja Sinkronisasi

```
[Tulis lokal]
  persist('sales_transactions', {...})
    → satu transaksi Dexie: tulis baris + tambah entri sync_queue
    → UI langsung ter-update (dexie-react-hooks)

[Push]  POST /kasir/sync/push
  → antrean diurutkan: parent dulu (sesi → harga → transaksi), lalu FIFO
  → batch maksimal 200 mutasi per request
  → server balas per mutasi:
      applied  → entri antrean dihapus
      skipped  → server punya versi lebih baru; entri dihapus juga
      rejected → gagal validasi; entri dihapus (tidak akan pernah lolos)
      failed   → mis. parent belum sampai; entri DITAHAN untuk dicoba lagi

[Pull]  GET /kasir/sync/pull?since=<iso>
  → server kirim semua baris yang berubah setelah cursor
  → baris yang masih ada di antrean lokal TIDAK ditimpa (versi lokal lebih baru)
  → cursor disimpan di sync_meta

[Pemicu]  event `online`, polling 30 detik, dan tombol di indikator header
```

**Resolusi konflik** — last-write-wins berdasarkan `updated_at`. Mutasi masuk hanya
ditulis kalau `updated_at`-nya lebih baru dari yang tersimpan di server. `created_at`
dari klien dipertahankan supaya waktu transaksi di struk dan laporan tetap benar.

---

## 7. Alur Kerja Harian

```
[Buka Sesi] — /kasir/sesi
  → buka daily_session untuk hari ini (nama kasir terisi otomatis dari akun)
  → input stok ayam masuk per ukuran           — /kasir/stok
  → tentukan tingkatan harga aktif hari ini    — /kasir/harga
     (bisa tambah/kurang kapan saja selama sesi masih buka; harga yang sudah
      dipakai transaksi tidak bisa dihapus)

[Transaksi Jual] — /kasir/pos
  → pilih tombol harga → atur jumlah ekor (tombol +/− besar)
  → ukuran opsional, status bayar wajib
  → subtotal otomatis, bisa di-override manual untuk nego harga
  → Simpan → masuk Dexie seketika (walau offline) → struk dicetak otomatis
  → riwayat hari ini tampil di bawah, bisa cetak ulang & batalkan

[Sepanjang hari]
  → Uang Keluar   — /kasir/uang-keluar
  → Ayam Mati     — /kasir/ayam-mati
  → Lembur        — /kasir/lembur

[Tutup Sesi] — /kasir/tutup-sesi
  → ringkasan lengkap dihitung dari data lokal (tetap akurat saat offline)
  → input uang tunai fisik → selisih lebih/kurang dihitung otomatis
  → tutup sesi → layar kasir berhenti menerima transaksi baru

[Laporan] — /kasir/riwayat, /kasir/riwayat/{sesi}
  → dihitung ulang di server oleh BuildDailyReport
  → Export PDF lewat print-to-PDF browser (ada @media print khusus)
```

---

## 8. Halaman yang Tersedia

| Route | Halaman | Offline? | Peran |
|---|---|---|---|
| `/kasir/pos` | Layar Kasir (POS utama) | ✅ | semua |
| `/kasir/sesi` | Buka sesi + ringkasan hari ini | ✅ | semua |
| `/kasir/stok` | Stok masuk per ukuran | ✅ | semua |
| `/kasir/harga` | Kelola tingkatan harga | ✅ | semua |
| `/kasir/uang-keluar` | Uang keluar | ✅ | semua |
| `/kasir/ayam-mati` | Ayam mati | ✅ | semua |
| `/kasir/lembur` | Lembur karyawan | ✅ | semua |
| `/kasir/printer` | Pairing Bluetooth, tes cetak, 58/80mm | ✅ | semua |
| `/dashboard` | Dashboard analitik (§8b) | ❌ butuh koneksi | **pemilik** |
| `/kasir/tutup-sesi` | Rekonsiliasi kas + preview laporan | ✅ | **pemilik** |
| `/kasir/riwayat` | Daftar sesi lampau | ❌ butuh koneksi | **pemilik** |
| `/kasir/riwayat/{sesi}` | Laporan harian + Export PDF | ❌ butuh koneksi | **pemilik** |

Route bertanda **pemilik** membalas **403** untuk kasir, dan menunya disembunyikan di
sidebar supaya tidak ada tautan yang mengarah ke dinding buntu.

Indikator status sinkronisasi ada permanen di header aplikasi (hijau tersinkron /
biru ada X pending / oranye offline), bisa diketuk untuk memaksa sinkron.

### Urutan menu sidebar

Menu diurutkan mengikuti alur kerja masing-masing peran, bukan urutan teknis:

| Grup | Isi | Terlihat oleh |
|---|---|---|
| **Ikhtisar** | Dashboard | pemilik |
| **Kasir** | Layar Kasir, Sesi Hari Ini, Stok Masuk, Tingkatan Harga | semua |
| **Catatan Harian** | Uang Keluar, Ayam Mati, Lembur | semua |
| **Pemilik** | Tutup Sesi, Riwayat Laporan | pemilik |
| **Alat** | Pengaturan Printer | semua |

Dashboard ada **paling atas untuk pemilik** — itu layar pertama yang dibuka tiap pagi.
Kasir tidak melihatnya sama sekali, jadi menu pertama mereka adalah Layar Kasir, yang
memang tempat mereka bekerja.

---

## 8b. Dashboard Analitik

Halaman `/dashboard` (khusus pemilik) merangkum **seluruh sesi yang tersimpan di server**,
bukan hanya hari ini. Ada penyaring periode: **30 hari / 90 hari / 1 tahun / semua**
(bawaan 90 hari).

### Isinya

| Bagian | Bentuk | Menjawab |
|---|---|---|
| Angka utama | Hero figure | Total omzet periode ini, rata-rata & tertinggi per hari |
| 8 kartu KPI | Stat tile | Tunai, uang keluar, kas bersih, piutang, belum bayar, ayam mati, jumlah sesi, ekor terjual |
| **Kurva S** | Area + garis kumulatif | Seberapa cepat omzet menumpuk; datar = hari tanpa jualan, curam = lagi ramai |
| Omzet Harian | Kolom | Hari mana yang ramai dan mana yang sepi |
| Per Tingkatan Harga | Bar horizontal | Di harga 65rb terjual berapa ekor — lintas hari, digabung per nominal harga |
| Komposisi Status Bayar | Stacked bar | Berapa yang benar-benar tunai vs masih piutang |
| Perjalanan Stok Per Ukuran | Stacked bar | Dari yang masuk, berapa terjual / sisa / mati |
| Sesi Terakhir | Tabel | 10 sesi terbaru, tiap baris tertaut ke laporan hariannya |

### Catatan teknis

- **Tanpa dependensi grafik baru.** Semua grafik digambar sebagai SVG di
  `resources/js/components/kasir/charts.tsx`. Menambah pustaka chart akan memakan bundle
  lebih besar daripada seluruh lapisan offline, padahal yang dibutuhkan hanya lima bentuk
  tetap.
- **Agregasi dikerjakan SQL**, bukan dengan memuat baris — beberapa query `GROUP BY`
  dengan `toBase()` supaya baris agregat tidak dihidrasi jadi model (kolomnya berisi
  jumlah, bukan atribut transaksi).
- **Harga dikelompokkan per nominal, bukan per baris `price_tiers`.** Id tingkatan harga
  dibuat ulang tiap hari, jadi mengelompokkan per `harga` yang menjawab pertanyaan
  toko: di 65rb, berapa ekor keluar?
- **Transaksi yang dibatalkan dikecualikan** di semua angka, sama seperti laporan harian.
- **Warna mengikuti aturan visualisasi:** deret tunggal memakai satu warna (bukan
  gradasi per tinggi batang), tingkatan harga memakai ramp satu warna karena harga itu
  skala berurutan, dan status bayar memakai palet status khusus (hijau/kuning/merah)
  karena warnanya memang berarti keadaan, bukan identitas seri.

---

## 9. Format Struk (ESC/POS)

`generateReceiptBytes(input)` di `resources/js/lib/kasir/escpos.ts` adalah fungsi murni —
tidak menyentuh Bluetooth sama sekali, jadi bisa diuji dan dipratinjau tanpa printer fisik.
`renderReceiptText()` memisahkan tata letak teks dari encoding byte.

```
      TOKO AYAM POTONG [NAMA]
   [Alamat/No. Telp opsional]
--------------------------------
Tanggal        : dd/mm/yyyy HH:mm
Kasir          : [nama]
--------------------------------
Ukuran         : [jika diisi]
Harga/ekor     : Rp [harga]
Jumlah         : [n] ekor
Subtotal       : Rp [subtotal]
--------------------------------
Status         : Lunas / Utang (a.n. ...) / Belum Bayar
--------------------------------
      Terima kasih!
```

Lebar baris menyesuaikan kertas: 32 karakter (58mm) atau 48 karakter (80mm).
Byte dikirim per potongan 180 byte dengan jeda 20ms — printer murah kehilangan
data kalau dikirim sekaligus.

---

## 10. Tema Visual — Biru & Putih

Prioritas desain: **kontras tinggi, target sentuh besar, status terbaca sekilas**.
Token didefinisikan di `resources/css/app.css` sebagai `--color-kasir-*`, dipakai lewat
utility Tailwind (`bg-kasir-primary`, `text-kasir-danger`, dst.).

| Token | Hex | Pemakaian |
|---|---|---|
| `--color-kasir-primary` | `#1D4ED8` | Tombol utama, harga terpilih |
| `--color-kasir-primary-dark` | `#1E3A8A` | Hover/pressed, judul |
| `--color-kasir-primary-soft` | `#DBEAFE` | Kartu tingkatan harga, badge netral |
| `--color-kasir-surface` | `#FFFFFF` | Background kartu |
| `--color-kasir-surface-alt` | `#F8FAFC` | Background halaman |
| `--color-kasir-success` | `#16A34A` | Lunas Tunai, tersinkron |
| `--color-kasir-warning` | `#D97706` | Utang, offline |
| `--color-kasir-danger` | `#DC2626` | Belum Bayar, ayam mati, hapus |
| `--color-kasir-text` | `#0F172A` | Teks utama |
| `--color-kasir-text-muted` | `#64748B` | Label sekunder |
| `--color-kasir-line` | `#E2E8F0` | Border pemisah 1px |

Catatan penerapan:
- Halaman kasir **selalu terang** apa pun setelan light/dark aplikasi — layar tidak boleh
  berubah kecerahan di tengah shift, apalagi di lapak semi-outdoor.
- Tombol harga minimal 88px tinggi, angka pakai `.tabular` (`tabular-nums`, weight 600).
- Badge status bayar pakai warna solid, bukan cuma teks.
- Pemisah pakai border 1px, bukan drop-shadow.

---

## 11. Status Verifikasi

Semua dijalankan dan lulus pada 13 Agustus 2026:

| Cek | Perintah | Hasil |
|---|---|---|
| Tes | `php artisan test --compact` | **120 lulus**, 457 assertion |
| Analisis statis PHP | `vendor/bin/phpstan analyse --memory-limit=1G` | **0 error** (level 7) |
| Format PHP | `vendor/bin/pint` | bersih |
| Tipe TS | `npm run types:check` | bersih |
| Lint JS | `npm run lint:check` | bersih |
| Build produksi | `vite build` | sukses, SW precache 73 entri |

Tes yang ditulis (`tests/Feature/Kasir/`):

- **SyncPushTest** (10) — batch acak diurutkan parent-dulu, last-write-wins skip & apply,
  `created_at` klien dipertahankan, utang tanpa nama ditolak, tabel di luar allowlist ditolak,
  parent hilang → `failed` (tetap diantre), delete, akses tamu.
- **SyncPullTest** (5) — cursor `since`, semua tabel, cursor invalid.
- **DailyReportTest** (7) — total per tingkatan harga, transaksi batal dikecualikan,
  pisah per status bayar, sisa stok per ukuran, kas seharusnya, lembur, sesi kosong.
- **KasirPagesTest** (21) — semua route kasir (tamu ditolak / user bisa buka),
  riwayat & laporan, sesi tidak dikenal → 404.
- **PeranAksesTest** (28) — kasir ditolak 403 di halaman pemilik; kasir ditolak lewat
  endpoint sync saat membatalkan transaksi, menutup sesi, mengisi rekonsiliasi, dan
  menghapus catatan; kasir **boleh** mengatur harga, menghapus tingkatan harga yang belum
  terpakai, mencatat transaksi, membuka sesi, dan mencatat uang keluar; tingkatan harga
  yang sudah dipakai transaksi tidak bisa dihapus siapa pun; pemilik tetap bisa menghapus
  seluruh sesi; satu mutasi ditolak tidak menggagalkan sisa batch; pull kasir hanya berisi
  sesi hari ini sedangkan pemilik menarik seluruh riwayat; akun baru default `kasir`.
- **DashboardTest** (12) — tamu diarahkan ke login, kasir ditolak 403, pemilik lolos;
  render tanpa sesi sama sekali; akumulasi lintas sesi; kolom kumulatif kurva S naik
  berurutan menurut tanggal; transaksi batal dikecualikan; penggabungan per nominal harga
  lintas hari; pemisahan per status bayar dan kas bersih; perjalanan stok sampai sisa;
  filter periode memotong sesi lama; periode ngawur jatuh ke bawaan.

> Penegakan peran diuji lewat **HTTP request langsung ke endpoint sync**, bukan lewat UI —
> persis jalur yang dipakai kalau ada yang mencoba menembus tampilan.

### Yang belum tertutup tes

`generateReceiptBytes()` **tidak punya tes otomatis**. Fungsinya sudah dipisah sebagai
fungsi murni supaya mudah diuji, tapi proyek ini belum punya test runner JavaScript
(hanya PHPUnit). Menambah Vitest berarti menambah dependensi lagi — **butuh persetujuan**
sebelum dikerjakan.

---

## 12. Menjalankan

```bash
composer run dev
```

Untuk menguji PWA/offline sungguhan, service worker hanya aktif di build produksi:

```bash
npm run build
```

> **Catatan Windows:** hentikan dulu dev server Vite yang sedang jalan sebelum
> `npm run build` — kalau tidak, Vite gagal mengosongkan `public/build` dengan error
> `EPERM: operation not permitted`.

> **Drive C: harus punya ruang kosong.** Saat verifikasi 13 Agustus 2026, drive C:
> tercatat **0 byte tersisa**, dan itu membuat Pint, PHPUnit, serta PHPStan gagal dengan
> error yang menyesatkan (`No space left on device`, `phar error: Cannot open temporary
> file`, `sf_proc_00.out.lock`). Semuanya menulis file sementara ke `%TEMP%` di C:.
> Kosongkan C: sebelum menyalahkan kode.

Ikon PWA (`public/pwa-icon-*.png`) saat ini masih placeholder biru bertuliskan "A",
digenerate lewat GD. Ganti dengan logo toko sebelum rilis.

---

## 13. Yang Belum Dikerjakan

1. **Halaman kelola pengguna belum ada.** Peran sudah jalan, tapi menambah karyawan atau
   mengubah peran seseorang masih lewat seeder / tinker. Untuk toko dengan pergantian
   karyawan, perlu halaman CRUD user khusus pemilik.

   ```bash
   php artisan tinker --execute 'App\Models\User::factory()->create(["name" => "Rina", "email" => "rina@toko.test"]);'
   ```

   Perintah di atas membuat akun **kasir** (password `password`). Tambahkan
   `->pemilik()` sebelum `->create()` untuk membuat akun pemilik.
2. **Jejak audit belum mencatat siapa.** `dibuka_oleh` / `ditutup_oleh` hanya menyimpan
   nama sebagai teks, dan `sales_transactions` tidak punya `user_id`. Jadi kalau ada dua
   kasir bergantian, laporan tidak bisa memastikan transaksi mana milik siapa.
   Perlu kolom `user_id` di tabel-tabel transaksi.
3. **Grafik dashboard belum punya tes otomatis.** Angka yang disuplai ke grafik sudah
   diuji lewat `DashboardTest`, tapi komponen SVG-nya sendiri belum — sama seperti
   generator ESC/POS, butuh test runner JavaScript.
4. **Tes untuk generator ESC/POS** — butuh Vitest (dependensi baru, perlu persetujuan).
5. **Ikon PWA** masih placeholder.
6. **Export PDF** memakai print-to-PDF browser, bukan generator PDF di server. Cukup untuk
   kebutuhan sekarang; kalau perlu PDF yang dikirim otomatis (mis. ke WhatsApp pemilik),
   butuh paket PDF di sisi Laravel.
7. **Multi-perangkat bersamaan** belum diuji. Strategi last-write-wins memang dirancang
   untuk satu perangkat per sesi kasir seperti di spesifikasi; kalau nanti dua kasir
   menginput bersamaan di hari yang sama, konflik pada baris yang sama akan menang-yang-terakhir.
8. **Retensi data Dexie** — belum ada pembersihan otomatis. Data lama menumpuk di IndexedDB
   perangkat; perlu kebijakan hapus baris di atas N hari. Catatan: kasir kini hanya menarik
   sesi hari ini, jadi penumpukan terbesar ada di perangkat pemilik.
9. **Perangkat bekas kasir yang naik peran.** Kalau satu perangkat dipakai login kasir lalu
   login pemilik (atau sebaliknya), Dexie tidak dikosongkan saat ganti akun. Data lama masih
   tersimpan lokal sampai browser dibersihkan — perlu wipe Dexie saat logout.
10. **Dashboard tidak punya pembanding periode.** Angkanya absolut — belum ada "naik/turun
    X% dibanding periode sebelumnya", yang biasanya jadi pertanyaan pertama pemilik.
