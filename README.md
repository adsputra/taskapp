# TaskApp

Aplikasi manajemen proyek dan tugas berbasis web (terinspirasi Monday.com / Asana / Trello) untuk mengatur alur kerja, melacak progres, dan berkolaborasi dalam tim. Aplikasi dapat menampilkan tugas dalam beberapa tampilan: **Table, Kanban, Calendar, Timeline, dan Sprint**.

Stack utama: **Next.js 16 (App Router) + React 19 + Supabase (PostgreSQL, Auth, Storage, Realtime) + Tailwind CSS v4**.

---

## Fitur

- **Board & task** — board dengan kolom kustom (status, priority, people, tags, checkbox, angka/budget), group, sub-task, assignee, due date, deskripsi, estimasi, dan story points.
- **Multi-view** — Table (kolom task tetap terlihat saat digeser, nyaman di layar ponsel), Kanban (drag & drop via `@hello-pangea/dnd`), Calendar, Timeline, dan Sprint.
- **Kolaborasi** — komentar dengan **@mention**, activity log, file attachment, time tracking.
- **Notifikasi** — saat di-assign, dikomentari, di-mention, undangan diterima, dan dari automations. Klik notifikasi langsung membuka task-nya (`/boards/<id>?task=<id>`).
- **Automations** (per board, diatur admin) — beri tahu assignee saat status berubah, beri tahu owner saat task selesai, tutup parent saat semua subtask selesai, assign task baru ke pembuatnya, dan pengingat due date (butuh `pg_cron`).
- **Board sharing** — undang lewat email (Resend, opsional) atau link bertoken dengan role **admin / editor / viewer**. Editor bisa membuat dan mengubah task; admin juga bisa menghapus task serta mengubah kolom, group, dan automations.
- **Pencarian global** — command palette `Ctrl/⌘ + K` untuk mencari board & task dan berpindah halaman.
- **Dashboard & analytics** — ringkasan board, status task, dan statistik.
- **Auth** — email/password, lupa password, Google/GitHub (opsional), dan **verifikasi dua langkah (TOTP)**.
- **Tema** — Light / Dark / System dengan transisi halus (View Transitions API). Semua warna lewat token semantik di `src/app/globals.css`.

---

## Struktur Proyek

```
src/
├── app/
│   ├── (app)/                  # Halaman privat (dashboard, boards, my-tasks, profile, analytics)
│   ├── actions/                # Server Actions (auth, password, email undangan)
│   ├── api/                    # Health check + metrics endpoint
│   ├── auth/                   # login, signup, forgot/reset password, mfa, callback
│   ├── join/                   # Halaman menerima undangan board
│   └── layout.jsx
├── components/
│   ├── auth/                   # Kerangka halaman auth + tombol OAuth
│   ├── board/                  # View board, drawer task, automations, sharing, notifikasi
│   ├── profile/                # Tampilan, password, MFA
│   ├── CommandPalette.jsx      # Ctrl/⌘+K
│   └── ui/                     # Komponen UI (shadcn-style)
├── hooks/                      # useBoardState (React Query + URL state), useBoardPeople
├── lib/
│   ├── api/                    # Data-access layer ke Supabase (per domain)
│   ├── supabase/               # Browser & server Supabase client
│   ├── csp.js                  # Content-Security-Policy ber-nonce
│   ├── mentions.js             # Parsing @mention
│   ├── invite-email.js         # Template email undangan (HTML ter-escape)
│   ├── logger.js               # Structured logging + redaksi PII
│   ├── rate-limit.js           # Rate limiter (Upstash Redis / in-memory)
│   └── validation.js           # Validasi input (pure functions)
└── proxy.js                    # Middleware: sesi, CSP nonce, MFA step-up, rate limit, fail-closed
supabase/
├── schema.sql                  # Seluruh database: tabel, RLS, trigger, RPC, storage, realtime, cron
├── config.toml                 # Stack Supabase lokal (port 554xx)
└── tests/database/             # Test pgTAP untuk RLS, trigger, RPC, MFA, storage
e2e/                            # Test end-to-end Playwright
tests/                          # Unit test (node:test)
```

---

## Prasyarat

- Node.js 20.9+ (disarankan 22/24) dan npm
- Project Supabase (cloud atau self-hosted), atau Docker untuk stack lokal

---

## Setup Lokal

1. **Install dependency**

   ```bash
   npm install
   ```

2. **Konfigurasi environment**

   ```bash
   cp .env.example .env.local
   ```

   | Variabel | Wajib | Keterangan |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | Anon/public key (aman untuk browser) |
   | `NEXT_PUBLIC_SITE_URL` | produksi | Origin publik aplikasi, untuk link di email undangan & redirect auth |
   | `NEXT_PUBLIC_AUTH_PROVIDERS` | tidak | Tombol login sosial yang ditampilkan, mis. `google,github` (provider harus diaktifkan juga di Supabase) |
   | `RESEND_API_KEY`, `INVITE_EMAIL_FROM` | tidak | Kirim email undangan via Resend; tanpa ini UI menampilkan link untuk disalin |
   | `LOG_LEVEL` | tidak | `debug` \| `info` \| `warn` \| `error` (default `info`) |
   | `TRUSTED_IP_HEADER` | disarankan | Header IP klien yang **selalu ditimpa** edge (Vercel: `x-vercel-forwarded-for`, Cloudflare: `cf-connecting-ip`). Kosong = entri paling kanan `X-Forwarded-For` |
   | `UPSTASH_REDIS_REST_URL` / `_TOKEN` | tidak | Rate limiting lintas instance; tanpa ini fallback ke in-memory |
   | `METRICS_TOKEN` | tidak | Bearer token untuk `GET /api/metrics`; bila kosong endpoint 404 |

3. **Siapkan database**

   Seluruh database ada di satu file: `supabase/schema.sql`. Buka **Supabase Dashboard → SQL Editor**, tempel isi file, lalu **Run**. File ini idempotent: aman untuk project baru **dan** untuk database lama (migrasi `001`–`013` sudah dilebur ke dalamnya). Jalankan ulang setiap kali `schema.sql` berubah.

   Pengaturan di dashboard Supabase:
   - **Authentication → Multi-Factor**: aktifkan **TOTP** (enroll + verify).
   - **Authentication → URL Configuration**: tambahkan `https://<domain>/auth/callback` ke Redirect URLs (dipakai reset password & OAuth).
   - **Authentication → Providers**: aktifkan Google/GitHub bila dipakai, lalu set `NEXT_PUBLIC_AUTH_PROVIDERS`.
   - **Database → Extensions**: aktifkan **pg_cron** untuk automation pengingat due date, lalu jalankan ulang `schema.sql` (job dijadwalkan per jam). `schema.sql` juga mencoba mengaktifkannya sendiri.

4. **Jalankan aplikasi**

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000`.

### Supabase lokal (opsional)

`supabase/config.toml` menyiapkan stack lokal di port **554xx** (agar bisa berdampingan dengan project Supabase lain). `schema.sql` dipakai sebagai seed, jadi `supabase db reset` membangun ulang seluruh database.

```bash
npx supabase start -x studio,logflare,vector,edge-runtime,imgproxy,supavisor,postgres-meta
# API http://127.0.0.1:55421 · email (Mailpit) http://127.0.0.1:55424
npx supabase status        # anon key untuk .env.local
npx supabase stop
```

---

## Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Build production |
| `npm start` | Menjalankan hasil build |
| `npm run lint` | ESLint (`eslint-config-next`, termasuk aturan React Compiler) |
| `npm test` | Unit test (`node:test`) |
| `npm run test:db` | Test pgTAP database di container Docker sekali pakai |
| `npm run test:e2e` | Test end-to-end Playwright |

---

## Arsitektur & Keamanan

### Autentikasi

- Sesi disimpan di cookie dan di-refresh oleh `src/proxy.js` pada setiap request. Semua halaman aplikasi (termasuk dashboard `/`) butuh sesi; yang belum login diarahkan ke `/auth/login?redirect=<path>` (divalidasi agar tetap same-origin).
- Login/signup/reset/ganti password adalah Server Actions dengan rate limit per IP dan per akun. Ganti password memverifikasi password lama di server.
- **MFA (TOTP)**: setelah authenticator terverifikasi, sesi aal1 (baru memasukkan password) ditolak oleh **database** lewat policy `RESTRICTIVE` + `mfa_satisfied()` di setiap tabel, storage, dan RPC `SECURITY DEFINER`. Proxy mengarahkan sesi seperti itu ke `/auth/mfa`.

### Otorisasi (RLS)

Semua tabel memakai **Row Level Security**:

- Pemilik board (`boards.user_id`) punya akses penuh. Anggota aktif: `viewer` membaca, `editor` membuat & mengubah task, `admin` juga menghapus task serta mengubah board, kolom, group, member, dan automations.
- Column privileges mencegah kolom identitas/kepemilikan (`*.user_id`, `board_id`, `boards.visibility`, …) diubah lewat API.
- Trigger `board_items_check_refs` menolak `parent_id`/`sprint_id` yang menunjuk ke board lain (foreign key tidak tunduk RLS).
- Helper `SECURITY DEFINER` (`is_board_owner`, `is_board_member`, `can_view_profile`, …) memutus circular dependency antar policy. Helper internal (`notify_users`, `log_activity`, …) tidak bisa dipanggil lewat API.

### Ditulis oleh database, bukan oleh browser

- **Audit trail** (`task_activity`): trigger mencatat pembuatan task, setiap perubahan field (nilai lama → baru), komentar, dan lampiran. Role API tidak punya hak `INSERT/UPDATE/DELETE`, sehingga riwayat tidak bisa dipalsukan atau dilewati.
- **Notifikasi** untuk user lain dibuat trigger, hanya untuk orang yang memang bisa membaca board tersebut.
- **`boards.visibility`** diturunkan dari `board_members` (`shared` selama ada yang diundang, selain itu `private`).
- **Kolom & group** diubah lewat RPC atomik `board_patch_list` (row lock), sehingga dua orang yang menambah kolom bersamaan tidak saling menimpa.

### Undangan Board

- Token dibuat dengan `crypto.randomUUID`, tidak bisa dibaca lewat `SELECT` oleh non-admin, kedaluwarsa 14 hari, dan hanya bisa diterima oleh akun dengan email yang diundang (`accept_board_invitation`).
- Email undangan dikirim server action (`sendBoardInviteEmail`) dengan sesi pengundang — RLS memastikan hanya admin board yang bisa mengirimnya; dibatasi 30/jam per user; semua nilai dari user di-escape.

### Lapisan API

- Validasi ID, enum, email, panjang string, ukuran/tipe file; pagination dengan batas maksimum; operasi batch lewat RPC.
- Pesan error ke user selalu generik; detail database hanya masuk log.

### Operasional

- **Content-Security-Policy ber-nonce**: `src/proxy.js` membuat nonce per request; script hanya boleh jalan dengan nonce tersebut (`'strict-dynamic'`, tanpa `'unsafe-inline'`). Header lain: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Attachment private**: bucket `task-attachments` tidak public, signed URL 1 jam. Upload hanya ke task yang ada di board itu; file hanya bisa dihapus pengunggahnya atau admin. SVG ditolak (bisa membawa script); SVG lama dilayani sebagai download.
- **Rate limiting**: auth (per IP & akun) dan email undangan, via Upstash Redis atau fallback in-memory.
- **Analytics agregasi SQL** (`get_analytics`), **pencarian** (`search_workspace`, indeks trigram), **health check** `GET /api/health`, **metrics** `GET /api/metrics` (Prometheus, dilindungi `METRICS_TOKEN`), **correlation ID** `x-request-id`, **logging** JSON dengan redaksi.
- **Fail closed**: di production, aplikasi menolak melayani request (503) bila environment Supabase tidak diset.

---

## Testing

```bash
npm test            # unit test: validasi, redirect aman, rate limiter, metrics, CSP, mention, email, kontras warna
npm run lint        # 0 error, 0 warning
npm run test:db     # pgTAP: RLS per role, audit trail, notifikasi, automations, RPC atomik, MFA, storage
npm run build       # verifikasi build production
```

`npm run test:db` menjalankan `supabase/schema.sql` **dua kali** (harus idempotent) pada container `supabase/postgres` sekali pakai, lalu semua file di `supabase/tests/database/`. Dengan stack lokal, `npx supabase test db` menjalankan suite yang sama.

**End-to-end** (Playwright) butuh Supabase yang berjalan dan aplikasi yang di-build terhadapnya:

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key dari `supabase status`>
export NEXT_PUBLIC_SITE_URL=http://localhost:3100
export E2E_MAILPIT_URL=http://127.0.0.1:55424   # untuk test reset password
npm run build && npm run test:e2e
```

Skenario: header CSP & redirect, signup/login/logout, alur lupa password lewat email, undangan → editor bergabung → @mention → notifikasi owner, MFA (termasuk database menolak sesi aal1), tema, command palette, dan tampilan tabel di layar ponsel.

---

## Checklist Deploy

1. Set environment variable di platform hosting (`NEXT_PUBLIC_*`, `TRUSTED_IP_HEADER`, `UPSTASH_REDIS_REST_*`, `METRICS_TOKEN`, dan `RESEND_API_KEY`/`INVITE_EMAIL_FROM` bila memakai email undangan).
2. Jalankan `supabase/schema.sql` terbaru di SQL Editor.
3. Di Supabase: aktifkan TOTP MFA, tambahkan `/auth/callback` ke Redirect URLs, konfigurasikan SMTP (email reset password), aktifkan pg_cron.
4. Aplikasi tidak memakai `SUPABASE_SERVICE_ROLE_KEY` — hapus dari environment hosting.
5. Arahkan health check load balancer ke `/api/health`; scrape `/api/metrics` dengan header `Authorization: Bearer $METRICS_TOKEN`.

---

## Catatan & Batasan yang Diketahui

- Semua halaman dirender dinamis (wajib untuk CSP ber-nonce).
- Metrics disimpan in-memory per instance. Untuk agregasi lintas instance, scrape tiap instance atau kirim ke push-gateway/collector.
- Pengingat due date memakai kolom bertipe `date` pertama di board dan dijalankan per jam oleh pg_cron.
- Agregasi analytics membaca tabel `board_items` langsung; untuk dataset sangat besar, tambahkan materialized view/rollup bila diperlukan.
