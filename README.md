# TaskApp

Aplikasi manajemen proyek dan tugas berbasis web (terinspirasi Monday.com / Asana / Trello) untuk mengatur alur kerja, melacak progres, dan berkolaborasi dalam tim. Aplikasi dapat menampilkan tugas dalam beberapa tampilan: **Table, Kanban, Calendar, Timeline, dan Sprint**.

Stack utama: **Next.js 16 (App Router) + React 19 + Supabase (PostgreSQL, Auth, Storage) + Tailwind CSS v4**.

---

## Fitur

- **Board & task** — board dengan kolom kustom (status, priority, tags, checkbox, angka/budget), group, sub-task, assignee, due date, deskripsi, estimasi, dan story points.
- **Multi-view** — Table, Kanban (drag & drop via `@hello-pangea/dnd`), Calendar, Timeline, dan Sprint.
- **Kolaborasi** — komentar, activity log (perubahan field), file attachment, time tracking, dan notifikasi in-app.
- **Board sharing** — undang anggota via link bertoken dengan role **admin / editor / viewer**.
- **Dashboard & analytics** — ringkasan board, status task, dan statistik.
- **Auth** — email/password via Supabase Auth, sesi berbasis cookie (SSR-friendly).
- **Dark mode** — `next-themes`.

---

## Struktur Proyek

```
src/
├── app/
│   ├── (app)/                  # Halaman privat (dashboard, boards, my-tasks, profile, analytics)
│   ├── actions/                # Server Actions (auth, profile)
│   ├── api/                    # Health check + metrics endpoint
│   ├── auth/                   # Halaman login/signup + callback OAuth/email
│   ├── join/                   # Halaman menerima undangan board
│   └── layout.jsx
├── components/
│   ├── board/                  # View board, drawer task, filter, sharing, notification
│   └── ui/                     # Komponen UI (shadcn-style)
├── hooks/useBoardState.js      # State board (React Query + URL state)
├── lib/
│   ├── api/                    # Data-access layer ke Supabase (per domain)
│   ├── supabase/               # Browser & server Supabase client
│   ├── logger.js               # Structured logging + redaksi PII
│   ├── rate-limit.js           # In-memory rate limiter
│   └── validation.js           # Validasi input (pure functions)
└── proxy.js                    # Middleware: refresh sesi, proteksi route, rate limit, fail-closed
supabase/migrations/            # Migrasi SQL (schema, RLS, RPC)
tests/                          # Unit test (node:test)
```

---

## Prasyarat

- Node.js 20.9+ (disarankan 22/24) dan npm
- Project Supabase (cloud atau self-hosted)

---

## Setup Lokal

1. **Install dependency**

   ```bash
   npm install
   ```

2. **Konfigurasi environment**

   Salin template lalu isi nilainya:

   ```bash
   cp .env.example .env.local
   ```

   | Variabel | Wajib | Keterangan |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | Anon/public key (aman untuk browser) |
   | `SUPABASE_SERVICE_ROLE_KEY` | tidak | Server-only, dipakai untuk repair profil legacy. **Jangan pernah** diekspos ke client |
   | `LOG_LEVEL` | tidak | `debug` \| `info` \| `warn` \| `error` (default `info`) |
   | `UPSTASH_REDIS_REST_URL` | tidak | Rate limiting lintas instance; tanpa ini fallback ke in-memory |
   | `UPSTASH_REDIS_REST_TOKEN` | tidak | Token Upstash Redis REST |
   | `METRICS_TOKEN` | tidak | Bearer token untuk `GET /api/metrics`; bila kosong endpoint 404 |

3. **Jalankan migrasi database**

   Repository ini belum menyertakan `supabase/config.toml`, jadi cara termudah adalah membuka **Supabase Dashboard → SQL Editor** dan menjalankan file di `supabase/migrations/` **secara berurutan**:

   ```
   001_schema.sql
   002_board_sharing.sql
   003_full_rebuild.sql
   003_restrict_editor_insert.sql
   004_jira_features.sql
   005_fix_profiles_rls.sql
   006_auth_trigger.sql
   007_security_hardening.sql   ← wajib; mengaktifkan RLS board_members + RPC undangan
   008_private_attachments.sql  ← bucket task-attachments jadi private + Storage RLS
   009_analytics_rpc.sql        ← RPC agregasi analytics
   ```

   Alternatif dengan Supabase CLI: jalankan `supabase init` terlebih dahulu, lalu `supabase db push`.

4. **Attachment storage** (opsional, sudah diurus migrasi)

   Migrasi `008_private_attachments.sql` membuat bucket **private** `task-attachments` beserta policy Storage-nya (hanya owner/member board yang bisa baca; admin/editor bisa menulis) plus limit ukuran 10 MB dan whitelist MIME di level Storage. Tidak perlu setup manual.

5. **Jalankan aplikasi**

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000`.

---

## Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Build production |
| `npm start` | Menjalankan hasil build |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | Unit test (`node:test`) |

---

## Arsitektur & Keamanan

### Autentikasi

- Sesi disimpan di cookie dan di-refresh oleh `src/proxy.js` pada setiap request.
- Route privat otomatis redirect ke `/auth/login?redirect=<path>`. `redirect` divalidasi terhadap origin sebelum dipakai.
- Server Actions (`src/app/actions/auth.js`) memvalidasi email/password dan membatasi percobaan login/signup (rate limit per IP dan per akun).

### Otorisasi (RLS)

Semua tabel memakai **Row Level Security**. Aturan utamanya:

- Pemilik board (`boards.user_id`) punya akses penuh.
- Anggota aktif (`board_members.status = 'active'`) dapat membaca; `admin`/`editor` dapat mengubah; `admin` dapat menghapus.
- Helper `SECURITY DEFINER` (`is_board_owner`, `is_board_member`, `can_view_profile`) memutus circular dependency antar policy.
- `profiles` hanya dapat dibaca oleh diri sendiri dan orang yang berbagi board.

### Undangan Board

- Token undangan dibuat dengan `crypto.randomUUID` (bukan `Math.random`), disimpan di `board_members`, **tidak bisa dibaca langsung** lewat `SELECT` (RLS), dan otomatis dihapus saat undangan diterima.
- Lookup dan penerimaan undangan melalui RPC `get_board_invitation` / `accept_board_invitation` (SECURITY DEFINER, hanya untuk user terautentikasi, token kedaluwarsa 14 hari).

### Lapisan API

Semua akses data dari client melewati `src/lib/api/*`:

- Validasi ID, enum, email, panjang string, ukuran/tipe file.
- Pagination dengan default dan batas maksimum (`clampLimit`) — tidak ada list yang tak terbatas.
- Filter server-side (contoh: `listMyTasks` tidak mengunduh seluruh tabel).
- Operasi batch atomik lewat RPC (`reorder_board_items`, `set_items_sprint`).
- Pesan error yang ditampilkan ke user bersifat generik; detail hanya masuk console/log.

### Operasional

- **Rate limiting**: login/signup (per IP & per akun) dan request POST ke `/auth` di proxy. Memakai **Upstash Redis** bila `UPSTASH_REDIS_REST_*` diset (aman untuk banyak instance); bila tidak, otomatis fallback ke in-memory per proses.
- **Attachment private**: bucket `task-attachments` tidak public. `attachmentsApi` menukar object key menjadi **signed URL** berumur 1 jam saat membaca, dan Storage RLS menolak akses lintas board.
- **Analytics agregasi SQL**: halaman analytics memanggil RPC `get_analytics` — database yang menghitung total/status/overdue/per-board, tanpa mengirim ribuan task ke browser.
- **Health check**: `GET /api/health` — memeriksa konektivitas ke Supabase Auth (503 bila down).
- **Metrics**: `GET /api/metrics` (Prometheus text) berisi counter request, rate-limit block, error server, dan histogram latensi auth-check. Dilindungi `METRICS_TOKEN`; tanpa token endpoint mengembalikan 404.
- **Correlation ID**: `src/proxy.js` menerima/membuat `x-request-id`, meneruskannya ke server dan mengembalikannya di response; log server actions & error instrumentation menyertakan ID ini.
- **Security headers**: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (lihat `next.config.mjs`).
- **Logging** terstruktur JSON dengan redaksi field sensitif (`logger.js`).
- **Fail closed**: di production, aplikasi menolak melayani request (503) bila environment Supabase tidak diset.

---

## Testing

```bash
npm test        # 21 unit test (validation, rate limiter + Redis store, metrics)
npm run lint    # 0 errors (warning React Compiler dibiarkan terlihat)
npm run build   # verifikasi build production
```

---

## Checklist Deploy

1. Set environment variable di platform hosting (`NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_*`, `METRICS_TOKEN`).
2. Pastikan seluruh migrasi sudah dijalankan (terutama `007`, `008`, `009`).
3. Pastikan `SUPABASE_SERVICE_ROLE_KEY` hanya tersedia di server (jangan pakai prefix `NEXT_PUBLIC_`).
4. Arahkan health check load balancer ke `/api/health`.
5. Scrape `/api/metrics` dengan header `Authorization: Bearer $METRICS_TOKEN` (Prometheus/VictoriaMetrics/Grafana Agent).

---

## Catatan & Batasan yang Diketahui

- Metrics disimpan in-memory per instance. Counter request dari `proxy` bisa berada di instance terpisah dari route handler pada platform yang menjalankan proxy sebagai runtime sendiri; metrics auth/error/health tetap berada di Node runtime. Untuk agregasi lintas instance, scrape tiap instance atau kirim ke push-gateway/collector.
- UI login baru menyediakan email/password (Google/GitHub via Supabase Auth belum dipasangkan tombolnya).
- Belum ada dokumentasi OpenAPI (API utama adalah Server Actions + Supabase langsung).
- Agregasi analytics membaca tabel `board_items` langsung; untuk dataset sangat besar, tambahkan materialized view/rollup bila diperlukan.
