# CONFESS — School Edition

Platform confession anonim untuk lingkungan sekolah (<1.000 pengguna). Next.js
(App Router) + TypeScript + Tailwind, **Firebase Authentication** dan
**Firebase Realtime Database (RTDB)** sebagai satu-satunya database. Seluruh
operasi tulis lewat API routes (Admin SDK); browser hanya membaca data publik
secara realtime (`onValue`).

## Instalasi

```bash
npm install
cp .env.example .env.local   # isi semua nilai (lihat Environment Variables)
npm run dev                  # http://localhost:3000
```

Build produksi: `npm run build && npm start`.

## Setup Firebase

1. Buat project di https://console.firebase.google.com, daftarkan **Web app**.
2. **Authentication → Sign-in method:** aktifkan **Email/Password** dan **Anonymous**.
   Tambahkan domain Vercel-mu di Authentication → Settings → Authorized domains.
3. **Build → Realtime Database → Create database.** Salin **URL lengkap**-nya
   (mis. `https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app`) ke
   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`. URL yang sama dipakai Web SDK dan Admin SDK.
4. **Rules:** tab Rules → tempel isi `database.rules.json` → Publish.
   (Jangan pernah memakai `".read": true, ".write": true` di root.)
5. **Project settings → Service accounts → Generate new private key** untuk
   `FIREBASE_ADMIN_*`.

## Struktur database

```
users/{uid}            displayName, email, role, status, isBlocked, createdAt, updatedAt
confessions/{id}       PRIVAT: message, messageLower, category, authorUid, status,
                       likesCount, commentsCount, createdAt, updatedAt
comments/{id}          PRIVAT: confessionId, authorUid, message, status, createdAt
public/confessions/{id}        proyeksi publik confession berstatus PUBLISHED (tanpa authorUid)
public/comments/{confId}/{id}  komentar VISIBLE (tanpa authorUid)
reactions/{confId}/{uid}       type, createdAt   (hanya pemilik yang bisa baca)
reports/{id}           confessionId, reporterUid, reason, detail, status, createdAt
settings/general       websiteName, announcement, maintenanceMode, allowComments,
                       allowConfessions, maxConfessionLength, dailySubmissionLimit
audit_logs/{id}        actorUid, action, target, timestamp
stats                  snapshot ringkasan (diperbarui saat dashboard dibuka)
meta/adminTick         sinyal realtime dashboard (dinaikkan server di tiap mutasi)
rateLimits/*           hanya server
```

**Kenapa ada `public/*`?** RTDB tidak bisa menyembunyikan satu field (`authorUid`)
dari pembaca node. Karena itu data yang boleh dilihat pengunjung disalin server
ke `public/*` hanya saat disetujui; node privat hanya terbaca staff.
Status memakai `PUBLISHED` (bukan "APPROVED") agar kompatibel dengan data lama.
`announcements/` disiapkan di rules tetapi pengumuman aktif saat ini satu
teks di `settings/general.announcement`.

## Role & otorisasi

Ladder: **owner > admin > moderator > user**.

| Role | Akses |
| --- | --- |
| `owner` | Semua fitur admin + mengubah role akun lain |
| `admin` | Moderasi, pengguna & blokir, pengaturan situs, pengumuman, audit log |
| `moderator` | Moderasi confession/komentar/laporan + lihat statistik |
| `user` | Confession, komentar, reaksi, laporan (default pendaftar baru) |

- Otorisasi memakai **Firebase Custom Claim `role`** (diset server via Admin SDK).
  Role efektif = claim **yang juga sama** dengan `users/{uid}/role` di RTDB;
  kalau berbeda → diperlakukan `user`. Jadi: mengedit role di database **tidak**
  bisa menaikkan hak akses (hanya bisa mencabutnya), dan role yang dicabut
  langsung berlaku di endpoint server **dan** Security Rules.
- Ubah role: Dashboard → **Users** (khusus owner) → `POST /api/admin/roles`:
  verifikasi owner → set claim → (turun role: `revokeRefreshTokens`) → update
  `users/{uid}/role` → tulis `audit_logs`. Dashboard & klien target berubah realtime.
- **Owner pertama:** isi `ADMIN_SETUP_SECRET` di Vercel, daftar/masuk di `/admin`
  dengan email, lalu pakai panel "Aktifkan owner pertama". Hanya berfungsi selama
  belum ada owner.

## Realtime

Listener `onValue` (selalu di-unsubscribe saat unmount, tanpa listener ganda):
beranda, feed (halaman pertama), trending, detail confession + komentar + jumlah
like, status like milik user, settings/maintenance/pengumuman (satu listener
bersama via `useSettings`), dan role akun sendiri. Dashboard admin memuat ulang
tab aktif setiap `meta/adminTick` berubah (confession baru, aksi moderasi,
perubahan role, pengaturan).

Maintenance mode: semua halaman publik langsung berganti halaman perawatan
(staff dan `/admin` tetap bisa diakses).

## Migrasi dari Firestore (sekali jalan)

```bash
npm run migrate:firestore -- --dry-run   # hitung & validasi, tanpa menulis
npm run migrate:firestore                # backup JSON → tulis RTDB → verifikasi jumlah
```

Script `scripts/migrate-firestore-to-rtdb.mjs`: mempertahankan ID dokumen,
mengubah Timestamp → Unix ms, membangun `public/*`, memindahkan `settings/app`
→ `settings/general`, menyetel Custom Claim untuk akun admin/owner lama, dan
membandingkan jumlah data sebelum/sesudah (exit code 1 bila tidak cocok).
**Firestore tidak dihapus** — hapus manual setelah kamu yakin. Setelah
terverifikasi, hapus file script ini (satu-satunya yang masih menyentuh Firestore).

## Environment Variables

| Variabel | Sifat | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | klien | Firebase Web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | klien + server | URL lengkap Realtime Database (wajib) |
| `FIREBASE_ADMIN_PROJECT_ID` | rahasia | Service account `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | rahasia | Service account `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | rahasia | Service account `private_key` (escape `\n` di Vercel) |
| `ADMIN_SETUP_SECRET` | rahasia | Kunci bootstrap owner pertama (≥16 karakter) |
| `NEXT_PUBLIC_SITE_URL` | klien | domain publik untuk metadata SEO |

Jangan commit `.env.local` atau service account JSON ke GitHub.

## Deployment Vercel

1. Push repo ke GitHub (tanpa credential).
2. Vercel → New Project → import repo; isi semua Environment Variables di atas.
3. Deploy, publish `database.rules.json`, lalu cek: `/` memuat feed, `/confess`
   mengirim confession (status PENDING), `/admin` terbuka untuk staff,
   `/api/settings` mengembalikan JSON.

## Keamanan

- Semua tulis lewat `src/app/api/**` (Admin SDK); Security Rules menolak semua
  tulis dari browser, sehingga `likesCount`/`commentsCount`/role tidak bisa dimanipulasi.
- Pengunjung hanya membaca `public/*` dan `settings/general`; data privat
  (`authorUid`, laporan, audit, users) hanya terbaca staff/admin sesuai role.
- Rate limit server (transaction RTDB): confession per hari (default 5, bisa
  diatur di settings), 10 komentar/jam, 10 laporan/hari, 1 like per (uid, confession).
- Input disanitasi (`src/lib/security/sanitize.ts`) dan divalidasi
  (`src/lib/validations`). Tanpa `dangerouslySetInnerHTML`.
- Rules + server sama-sama mensyaratkan claim `role` cocok dengan `users/{uid}/role`.

## Struktur

```
src/app/           halaman publik + admin + API routes
src/components/    layout, feed, forms, admin, ui
src/lib/           firebase (client/admin/feed/settings), auth, security, validations
src/types/         tipe domain
scripts/           migrasi sekali jalan
database.rules.json  Security Rules RTDB
```

## Perintah

```bash
npm run dev        # dev server
npm run build      # build produksi
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```
