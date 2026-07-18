# Product Requirements Document (PRD) - TaskApp

## 1. Informasi Proyek
- **Nama Produk**: TaskApp
- **Versi**: 1.0.0
- **Platform**: Web Application (Responsif)
- **Tech Stack Utama**: Next.js 16 (App Router), React 19, Supabase, Tailwind CSS v4.

## 2. Ringkasan Produk
TaskApp adalah aplikasi manajemen proyek dan tugas yang komprehensif (terinspirasi dari platform seperti Monday.com, Asana, atau Trello). Aplikasi ini memungkinkan tim atau individu untuk mengatur alur kerja, melacak progres proyek, berkolaborasi dalam waktu nyata, dan memvisualisasikan tugas melalui berbagai macam tampilan seperti Table, Kanban, Calendar, Timeline, dan Sprint.

## 3. Tujuan Produk
- Menyediakan platform manajemen tugas yang terpusat dan mudah digunakan.
- Meningkatkan produktivitas tim melalui visualisasi alur kerja yang jelas.
- Memfasilitasi kolaborasi dengan fitur berbagi *board* dan manajemen peran (role-based access).

## 4. Target Pengguna
- **Individu/Freelancer**: Untuk melacak proyek dan tugas pribadi.
- **Tim Kecil hingga Menengah**: Untuk kolaborasi proyek, sprint planning, dan pelacakan *milestone*.
- **Manajer Proyek**: Untuk memantau progres, beban kerja anggota tim, dan analitik proyek.

## 5. Fitur Utama (Key Features)

### 5.1. Autentikasi & Akun
- **Sign Up / Sign In**: Menggunakan Supabase Auth (Dukungan untuk email/password atau OAuth jika dikonfigurasi).
- **Profil Pengguna**: Menampilkan dan mengelola data pengguna (nama, email, avatar).

### 5.2. Dashboard Utama
- **Greeting Personal**: Sapaan berdasarkan waktu lokal dan nama pengguna.
- **Stats Overview**: Ringkasan jumlah *boards*, tugas selesai, dan tugas tertunda (*pending tasks*).
- **Recent Boards**: Akses cepat ke *boards* yang sering atau baru saja diakses, dipisahkan antara *Owned* (milik sendiri) dan *Shared* (dibagikan oleh orang lain).
- **Activity Feed**: Lini masa aktivitas terbaru dari tugas-tugas.
- **Quick Actions**: Tombol pintas untuk membuat *board* atau tugas baru.

### 5.3. Manajemen Boards (Proyek)
- **Daftar Boards**: Menampilkan semua *board* dengan opsi tampilan *Grid* atau *List*.
- **CRUD Board**: Membuat, melihat, mengubah, dan menghapus *board*.
- **Filter & Pencarian**: Mencari *board* berdasarkan nama.

### 5.4. Visualisasi & Tampilan Board
Aplikasi mendukung multi-tampilan untuk setiap *board* agar sesuai dengan kebutuhan pengguna:
- **Table View (Default)**: Tampilan spreadsheet interaktif. Mendukung grup (*Group Section*), kolom kustom, dan agregasi data.
- **Kanban View**: Tampilan papan (drag-and-drop) berbasis status (Menggunakan `@hello-pangea/dnd`).
- **Calendar View**: Visualisasi tugas berdasarkan tenggat waktu (*deadline*) dalam format kalender bulanan/mingguan.
- **Timeline View**: Visualisasi gaya Gantt-chart untuk perencanaan jangka panjang.
- **Sprint View**: Tampilan khusus untuk metodologi Agile/Scrum.

### 5.5. Manajemen Tugas (Items)
- **Hierarki Tugas**: Mendukung *Task* utama dan *Subtasks* (berdasarkan `parent_id`).
- **Atribut Kustom (Columns)**: Status, Prioritas, Assignee (Orang), Tanggal, Teks, dll.
- **Task Detail Drawer**: Panel laci (*drawer*) untuk melihat detail tugas, meninggalkan komentar, dan mengubah properti tugas secara mendalam.
- **Operasi Massal**: Memilih beberapa tugas (*selectedItems*) untuk tindakan massal.

### 5.6. Manipulasi Data Board
- **Filter**: Menyaring tugas berdasarkan Assignee (Person), Status, atau Prioritas.
- **Sort**: Mengurutkan tugas berdasarkan kolom tertentu (Ascending/Descending).
- **Group By**: Mengelompokkan tugas berdasarkan kriteria tertentu (misal: Status, Assignee).
- **Hide Columns**: Menyembunyikan atau menampilkan kolom tertentu untuk fokus pada data yang relevan.

### 5.7. Kolaborasi & Kontrol Akses
- **Share Board**: Membagikan *board* ke pengguna lain (via email/ID).
- **User Roles**: Mendukung peran `admin` (bisa edit/hapus/tambah struktur) dan peran lain (misal: hanya melihat atau update tugas).
- **Member Avatars**: Indikator visual siapa saja yang memiliki akses ke *board* tersebut.

### 5.8. Fitur Lanjutan (Advanced Panels)
- **Analytics Panel**: Metrik dan grafik terkait progres *board* dan kinerja tim.
- **Automations Panel**: (Potensial) Aturan otomatisasi alur kerja (misal: Jika status "Done", beri tahu Assignee).
- **Integrations Panel**: (Potensial) Penghubung ke aplikasi pihak ketiga.

## 6. Arsitektur & Teknologi (Tech Stack)

### Frontend
- **Framework**: Next.js v16.2.9 (App Router, Server Components).
- **Library UI**: React v19, Radix UI Primitives, Lucide React (Ikon).
- **Styling**: Tailwind CSS v4, `clsx`, `tailwind-merge`.
- **Animasi**: Framer Motion, `tailwindcss-animate`.
- **Drag & Drop**: `@hello-pangea/dnd`.

### State Management & Data Fetching
- **Server State**: `@tanstack/react-query` v5 (Caching, sinkronisasi data real-time, optimistic updates).
- **Client State**: React Hooks (`useState`, context/custom hooks seperti `useBoardState`).

### Backend & Database (BaaS)
- **Layanan**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- **Fitur yang digunakan**: PostgreSQL Database, Authentication, Row Level Security (RLS) untuk membatasi data berdasarkan pengguna.

## 7. Rencana Pengembangan Lanjutan (Future Enhancements)
- **Real-time Collaboration**: Memanfaatkan fitur *Subscriptions* / WebSockets dari Supabase agar perubahan terlihat seketika oleh pengguna lain tanpa perlu *refresh*.
- **Notifikasi Push / Email**: Peringatan untuk tenggat waktu (*deadline*) atau sebutan (*mentions*) di komentar tugas.
- **Templates**: Template *board* bawaan (misal: CRM, Software Development, Marketing Campaign) untuk mempercepat pembuatan proyek.
- **Dark Mode Penuh**: Optimalisasi palet warna untuk mode gelap (saat ini sudah didukung parsial menggunakan `next-themes` dan *Tailwind dark class*).
