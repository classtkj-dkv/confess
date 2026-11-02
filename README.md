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

- Anonymous Authentication diaktifkan; setiap pengunjung otomatis jadi akun
  anonim ketika pertama kali mengirim confession, komentar, reaksi, atau
  laporan — tanpa email, tanpa signup manual.
- Identitas anonim tidak pernah ditampilkan publik. UID hanya dipakai server
  untuk rate limiting, like dedup, ownership komentar, dan pelaporan.

## Setup Firebase Security Rules

1. Deploy rules: `npx firebase-tools deploy --only firestore:rules` atau paste
   isi `firestore.rules` di console → Firestore → Rules.
2. Deploy composite index: `npx firebase-tools deploy --only firestore:indexes`
   (file `firestore.indexes.json`).

## Setup Admin

Admin diverifikasi lewat **Firebase Auth custom claim** + mirror dokumen
`users/{uid}.role == "admin"`. Tidak ada UI untuk mengangkat admin.

1. Buka aplikasi sekali sehingga akun anonimmu terbuat. Ambil UID dari Profil
   (dev tools `localStorage`/cookie, atau console Firebase → Authentication →
   Users → salin Anonymous uid).
2. Set `ADMIN_SETUP_SECRET` di env.
3. POST ke endpoint bootstrap:

```bash
curl -X POST https://<vercel-domain>/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"secret":"<ADMIN_SETUP_SECRET>","uid":"<UID_ANONIM>"}'
```

4. Setelah selesai, hapus/kosongkan `ADMIN_SETUP_SECRET` di Vercel agar
   endpoint terkunci (503).
5. Ganti dokumen override: claim tersimpan token; bila perlu akses admin
   tambahan, ulangi langkah 3 untuk UID lain saat secret masih tersedia.

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
| `ADMIN_SETUP_SECRET` | rahasia | Kunci endpoint bootstrap admin |
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
   - `/admin` hanya membuka halaman `overview` untuk admin claim.
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
- Custom claim `admin` hanya dapat diset dari server (Admin SDK) — tidak bisa
  dipalsukan dari browser.
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
