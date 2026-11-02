# CONFESS — School Edition

Platform confession anonim untuk lingkungan sekolah (<1.000 pengguna). Dibangun
dengan Next.js (App Router), TypeScript, Tailwind CSS, Firebase Auth
(anonymous), Firestore, dan Firebase Admin SDK. Server memvalidasi seluruh
operasi tulis — klien tidak pernah berhak menulis langsung ke Firestore.

## Instalasi project

```bash
npm install
cp .env.example .env.local   # isi semua nilai, lihat bagian Environment Variables
npm run dev                  # http://localhost:3000
```

Build production: `npm run build && npm start`.

## Setup Firebase

1. Buka https://console.firebase.google.com dan buat project (mis. `confess-sekolah`).
2. Daftarkan dua aplikasi:
   - **Web app** untuk klien (Authentication + Firestore combine via satu config).
   - **Service account** untuk Admin SDK (bumper di bagian bawah).
3. Aktifkan **Authentication → Sign-in method → Anonymous**.
4. Aktifkan **Firestore Database** (mode production).
5. (Opsional) aktifkan **Firestore → TTL policy** pada field `expiresAt`
   collection `rateLimits` agar jendela rate-limit terhapus otomatis.

## Setup Firestore

Collection yang dipakai: `confessions`, `comments`, `reactions`, `reports`,
`users`, `settings` (doc id `app`), `rateLimits`. Struktur field mengikuti
spesifikasi di prompt.txt — server men-set field `status`, counters
(`likesCount`, `commentsCount`), dan `messageLower` untuk pencarian prefix.

## Setup Authentication

- **Daftar manual (email + password)** tersedia di halaman `/admin` (panel
  "Daftar akun") dan bisa dipakai siapa pun. Setiap akun baru otomatis
  ber-role **user** biasa — tidak bisa memilih role saat mendaftar.
- Anonymous Authentication juga diaktifkan sebagai fallback akses anonim:
  pengunjung yang tidak mendaftar tetap bisa confession via akun anonim yang
  dibuat otomatis. Bila pengunjung anonim kemudian mendaftar, kredensial email
  di-link ke akun anonim tersebut (confession lama tetap miliknya).
- Identitas muka pengguna tidak pernah tampil publik — UID hanya dipakai
  server untuk rate limiting, dedup like, dan pelaporan.

### Role ladder: owner > admin > user

| Role | Akses |
| --- | --- |
| `owner` | Sama seperti admin (tingkat tertinggi, tidak bisa diblokir) |
| `admin` | Moderasi confession/komentar, tangani laporan, blokir `user` |
| `user` | Confession, komentar, reaksi, laporan (default pendaftar baru) |

### Cara kerja role (diatur lewat Realtime Database)

- Daftar di website → akun otomatis dicatat di **Realtime Database**
  `users/{uid}` dengan `role: "user"` (plus `email`, `displayName`,
  `createdAt`, `isBlocked`).
- **Satu-satunya sumber role = `users/{uid}/role`.** Tidak ada custom claim,
  endpoint `/api/admin/roles`, maupun `/api/admin/setup`.
- Untuk meng-acc / mengubah role: **Firebase Console → Realtime Database →
  Data → `users` →** pilih akun (cocokkan lewat `email`) **→ ubah `role`**
  jadi `user`, `admin`, atau `owner`. Berlaku seketika, tanpa logout/login.
- Nilai role salah ketik / kosong dianggap `user`.
- **Wajib** pasang rules dari `database.rules.json` (tab Rules → Publish).
  Rules itu melarang semua tulis dari browser, jadi user tidak bisa menaikkan
  role sendiri; server (Admin SDK) tetap bisa menulis.
- Dashboard `/admin → Users` hanya menampilkan role (read-only) + blokir akun.

## Setup Admin (owner/admin pertama)

1. Isi `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (URL lengkap Realtime Database) di
   Vercel, lalu redeploy.
2. Publish `database.rules.json` di Realtime Database → Rules.
3. Buka `/admin` → **Daftar akun** (email + password). Akun ber-role `user`.
4. Realtime Database → Data → `users` → akunmu → ubah `role` jadi `owner`.
5. Refresh `/admin` — dashboard terbuka.

## Setup Firebase Security Rules

1. Deploy rules: `npx firebase-tools deploy --only firestore:rules` atau paste
   isi `firestore.rules` di console → Firestore → Rules.
2. Deploy composite index: `npx firebase-tools deploy --only firestore:indexes`
   (file `firestore.indexes.json`).

## Environment Variables

Isi `.env.local` untuk pengembangan; untuk produksi isi di Vercel →
Settings → Environment Variables (Production + Preview + Development).

| Variabel | Sifat | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | klien | Firebase Web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | klien | Web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | klien | Web config |
| `FIREBASE_ADMIN_PROJECT_ID` | rahasia | Service account `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | rahasia | Service account `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | rahasia | Service account `private_key` (escape `\n` saat di Vercel) |
| `NEXT_PUBLIC_SITE_URL` | klien | domain publik untuk metadata SEO |

## Deployment Vercel

1. Push repo ke GitHub (jangan commit `.env.local` — sudah di-`.gitignore`).
2. Vercel → New Project → Import repo. Framework otomatis Next.js.
3. Add semua Environment Variables di atas (pastikan persis, tanpa
   pembungkus `export`).
4. Deploy. Set konfigurasi domain di bagian footer khusus (`NEXT_PUBLIC_SITE_URL`).
5. Sanity check post-deploy:
   - `/` memuat feed (pull dari Firestore, public)
   - `/confess` (POST kini terlarang — harus tembus via envelope server)
   - `/admin` hanya membuka halaman `overview` untuk akun ber-role admin/owner di database.
   - `/api/settings` → JSON `{"maintenanceMode":false,...}`.

## Catatan keamanan

- Semua operasi tulis via API routes `src/app/api/**` yang memakai Admin SDK,
  bukan Firestore client SDK.
- Rate limit server: 5 confession/hari, 10 komentar/jam, 1 like
  per (uid, confession), laporan unik per (uid, confession), maks 10
  laporan/hari.
- Input disanitasi (`src/lib/security/sanitize.ts`) dan divalidasi via
  `src/lib/validations`. React escape default + output tulisan sebagai teks
  biasa — tanpa `dangerouslySetInnerHTML`.
- Role dibaca server dari `users/{uid}/role` (Firestore) di setiap request;
  client tidak punya izin menulis ke koleksi `users`.
- Report mensupport 6 alasan, antar lain bullying, harassment, pemerasan,
  privasi, dan konten tidak pantas.

## Struktur

```
src/app/           halaman publik + admin + API routes
src/components/    layout, feed, forms, admin, ui
src/lib/           firebase, auth, security, validations
src/hooks/         (diperuntukkan fitur tambahan)
src/types/         tipe domain
src/utils/         helper format
public/            ikon & gambar statis
```

## Perintah

```bash
npm run dev        # dev server
npm run build      # build produksi
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```
