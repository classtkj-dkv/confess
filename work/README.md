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
users/{uid}            SEMUA akun Auth (email + anonim): email, displayName, role, isAnonymous,
                       status, isBlocked, createdAt, registeredAt, lastLoginAt, updatedAt
confessions/{id}       PRIVAT: message, messageLower, category, authorUid, status,
                       likesCount, commentsCount, createdAt, updatedAt
comments/{id}          PRIVAT: confessionId, authorUid, message, status, createdAt
public/confessions/{id}        proyeksi publik confession berstatus PUBLISHED (tanpa authorUid)
public/comments/{confId}/{id}  komentar VISIBLE (tanpa authorUid)
reactions/{confId}/{uid}       type, createdAt   (hanya pemilik yang bisa baca)
reports/{id}           confessionId, reporterUid, reason, detail, status, createdAt
settings/general       websiteName, announcement, maintenanceMode, allowComments,
                       allowConfessions, maxConfessionLength, dailySubmissionLimit
audit_logs/{id}        tindakan staff: actorUid, action, target, timestamp
activity_logs/{id}     aktivitas pengguna: register, login, anonymous_session, user_created,
                       confession_submitted, comment_created, like/unlike, report_created
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

- Role = field `users/{uid}/role` di RTDB (satu-satunya sumber kebenaran). Server
  membacanya di **setiap request** dan Security Rules memeriksa field yang sama,
  jadi naik/turun role langsung berlaku tanpa login ulang. Klien tidak bisa menulis
  ke `users/*`, sehingga tidak ada yang bisa menaikkan role-nya sendiri.
- **Daftar → otomatis `user`:** akun yang mendaftar lewat panel di `/admin` dibuat
  server dengan `role: "user"`.
- **Naikkan role manual (cara termudah):** Firebase Console → Realtime Database →
  Data → `users` → pilih akun (cocokkan field `email`) → ubah `role` menjadi
  `moderator`, `admin`, atau `owner` → Enter. Dashboard terbuka otomatis (realtime).
- Alternatif: Dashboard → **Users** (khusus owner) → `POST /api/admin/roles`.
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
- Rules + server sama-sama membaca role dari `users/{uid}/role`.

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

## AI terpisah dua tugas: moderasi & musik

Dua tugas AI berjalan terpisah, masing-masing dengan **key, model, dan kuota sendiri** supaya
limit/kredit yang satu tidak mengganggu tugas lain:

| Tugas | Prefiks env | Kerjaannya |
| --- | --- | --- |
| **AI moderasi (acc)** | `OPENROUTER_*` | Menilai setiap confession: approve / revise / manual |
| **AI musik (lirik)** | `MUSIC_AI_*` | Merapikan & menyusun lirik + menaksir titik mulai preview 30 detik |

## Moderasi AI (acc)

Isi API key (prefiks `OPENROUTER_`) di Vercel untuk mengaktifkan. Rotasi key didukung: `OPENROUTER_API_KEYS="sk-or-1,sk-or-2,sk-or-3"`
atau `OPENROUTER_API_KEY_1..3` (gaya `OPENROUTER_API_KEY` tunggal tetap jalan). Key yang limit/kreditnya habis
otomatis digantikan key berikutnya. Alurnya:

1. Confession dinilai AI (paham bahasa gaul Indonesia). Hasilnya: **approve** (sopan & aman → langsung tayang),
   **revise** (pengirim diminta merevisi, isi tidak hilang), atau **manual** (sensitif/ragu → moderator).
2. AI hanya boleh menyetujui **10 confession per jam** (`AI_APPROVALS_PER_HOUR`, jendela per jam). Setelah penuh,
   kiriman masuk antrean moderator seperti biasa.
3. Anti-penyalahgunaan: tiap pengguna maksimal 4 pengecekan AI per jam; yang kuota hariannya habis tidak memakai AI;
   permintaan revisi tidak mengurangi kuota harian atau kuota persetujuan AI.
4. AI gagal / timeout / tidak ada key → otomatis moderasi manual (tidak pernah memblokir pengirim).
5. Admin bisa mematikan lewat toggle **Moderasi AI** di panel pengaturan.

### AI musik pasang lirik saat pilih lagu (form)
Tugas AI ini pakai **key sendiri** (prefiks `MUSIC_AI_`) — bukan key moderasi:
- Saat lagu dipilih di form confession, lirik dari LRCLIB dirapikan & disusun oleh AI dulu
  (typo dibenahi, baris terpotong digabung, label seperti `[Verse]` dibuang, bagian instrumental ditandai
  `music: true`) sebelum form dilanjutkan.
- AI musik juga menaksir **titik mulai preview** potongan Deezer 30 detik supaya lirik tidak muncul mendahului
  musik ("terlalu cepet"). Tombol **Tes putar** di pemilih lagu membuka pemutar beserta lirik hasil AI:
  cek sinkronnya di situ; penyesuaian offset manual per perangkat tetap diingat seperti sebelumnya.
- **Auto-align otomatis (tanpa AI, tanpa kalibrasi manual)**: pemutar (`src/lib/songs/align.ts`) menganalisa
  audio preview sendiri di browser — energi band vokal (200 Hz–3,6 kHz) → memilih offset yang membuat baris
  dinyanyikan jatuh di bagian "hidup vokal" dan penanda musik di bagian tenang. Dipakai bila keyakinannya ≥ 0,45;
  estimasi AI dipakai sebagai batas pencarian (±25 dtk) supaya reff serupa tidak menipu. Hasil per lagu di-cache
  (`confess:lyric-align:{id}`) dan pengguna yang sudah kalibrasi manual tidak pernah ditimpa.
- Hasil perapian lirik di-cache per lagu (6 jam) dan dibatasi 30 kali per pengguna / 10 menit (`songLyricAi` di `rateLimit.ts`).
- Bila `MUSIC_AI_*` tidak diisi, pemutar tetap sinkron via **auto-align** — hanya merapian teks lirik yang
  melewati LRCLIB mentah. Bawaan model musik: `openai/gpt-4.1-mini` (murah, cukup untuk menyusun lirik).

Keputusan AI tersimpan di data privat (`confessions/{id}/moderation`). Komentar belum dimoderasi AI.

### Memastikan AI benar-benar bekerja
- Panel admin → Pengaturan → **Tes koneksi AI**: mengirim dua contoh pesan (satu sopan, satu menghina + data pribadi) dan
  menampilkan keputusan AI, waktu respons, serta alasan jelas bila gagal (key salah, kredit habis, model tidak ada, dll).
- Hasil tes juga menampilkan status **AI musik** dan jumlah key aktif masing-masing tugas (dua-duanya terpisah).
- Setiap kegagalan AI juga dicatat di log server (cari `[ai-moderation]` di Vercel Logs).
- Di daftar confession admin, kiriman yang diputuskan AI diberi lencana "AI: menyetujui" atau "AI: serahkan ke moderator".
- Pengirim diberi tahu bila pesannya dicek moderator karena kuota AI jam itu penuh.

