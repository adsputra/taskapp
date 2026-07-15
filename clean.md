# Production Hardening & Refactor Guidelines untuk AI


## 1. Cara AI Bekerja di Project yang Sudah Ada
Urutan wajib — **jangan lompat langsung ke ubah-ubah kode**:

1. **Audit dulu, jangan langsung refactor.** AI harus membaca struktur project, memetakan alur data (frontend → API → database), dan membuat daftar temuan (bug, duplikasi, celah security) sebelum menyentuh kode.
2. **Prioritaskan berdasarkan risiko**: celah security kritis (kebocoran secret, tidak ada validasi input, auth lemah) > bug fungsional > duplikasi kode > rapi-rapi kosmetik (penamaan, format).
3. **Ubah bertahap per area**, bukan sekaligus seluruh project — supaya kalau ada yang rusak, mudah dilacak penyebabnya.
4. **Jangan ubah logic bisnis yang sudah benar** hanya demi "rapi" — fokus ke struktur, keamanan, dan keterbacaan, bukan menulis ulang semua dari nol.
5. **Setiap perubahan harus tetap bisa di-run** — AI harus memastikan tidak ada breaking change di fitur yang sudah jalan.
6. **Laporkan sebelum dan sesudah**: apa yang ditemukan, apa yang diubah, dan kenapa.

---

## 2. Security Checklist — Production Grade

### Autentikasi & Session
- Token (JWT) disimpan di **httpOnly cookie**, bukan `localStorage`, untuk mencegah pencurian lewat XSS.
- Terapkan **access token umur pendek + refresh token** — jangan pakai token yang berlaku selamanya.
- Refresh token disimpan aman dan bisa di-revoke (misal saat logout/ganti password).
- Password minimal punya aturan panjang & kompleksitas dasar, dan selalu di-hash (bcrypt/argon2) dengan salt otomatis.
- Sediakan mekanisme lockout/delay setelah beberapa kali percobaan login gagal.

### Otorisasi
- Setiap endpoint sensitif memverifikasi **role/permission**, bukan hanya "sudah login atau belum".
- Terapkan prinsip **least privilege** — user/service hanya diberi akses seperlunya.
- Cek ulang object-level authorization (misal user A tidak bisa akses data user B lewat ID di URL — celah umum bernama **IDOR**).

### Validasi & Sanitasi Input
- Validasi di **backend**, bukan hanya di frontend (frontend gampang dilewati).
- Gunakan schema validation (misal Zod/Yup/Joi) di setiap endpoint yang menerima data.
- Sanitasi input yang akan ditampilkan kembali ke user (mencegah XSS) dan yang masuk ke query database (mencegah SQL/NoSQL injection).
- Gunakan **parameterized query / ORM** — jangan pernah menyusun query dengan string concatenation dari input user.

### Keamanan API
- Rate limiting per endpoint, lebih ketat di endpoint login/register/reset password.
- Versi API jelas (`/api/v1/...`) agar perubahan besar tidak merusak client lama.
- Response error tidak boleh membocorkan detail internal (stack trace, nama library, query database).
- Konsisten pakai HTTPS, redirect otomatis dari HTTP.

### Secrets & Environment
- Semua credential (DB, API key, JWT secret) hanya ada di environment variable, tidak pernah di-commit ke Git.
- Pastikan `.env` sudah ada di `.gitignore` sejak awal — cek juga riwayat commit lama, siapa tahu pernah ke-push.
- Environment dipisah jelas: development, staging, production — jangan pakai secret yang sama di semua environment.
- Rotasi secret secara berkala, terutama jika pernah ada indikasi bocor.

### HTTP Security Headers
- Gunakan `helmet` (Node/Express) atau setara untuk header seperti `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.
- CORS diatur ke domain frontend spesifik, jangan `origin: "*"` di production.
- Cookie diberi flag `Secure`, `HttpOnly`, dan `SameSite` yang sesuai.

### Upload File (jika ada)
- Batasi tipe file dan ukuran maksimum.
- Jangan simpan file upload langsung bisa dieksekusi (validasi ekstensi & konten, bukan hanya nama file).
- Simpan di storage terpisah (S3/Cloud Storage) daripada langsung di server aplikasi jika memungkinkan.

### Logging & Monitoring
- Log aktivitas penting (login, error, perubahan data sensitif) tapi **jangan log data sensitif** (password, token, data pribadi lengkap).
- Siapkan alert dasar untuk error rate tinggi atau lonjakan request mencurigakan.

### Dependency & Supply Chain
- Jalankan `npm audit` (atau setara) secara berkala, terutama sebelum deploy besar.
- Hindari dependency yang sudah lama tidak di-maintain untuk fungsi kritis (auth, crypto).
- Kunci versi dependency (`package-lock.json` ikut di-commit).

### Deployment
- Secret/env di-set lewat platform hosting (Vercel/Railway/dll), bukan ditulis di kode.
- Matikan mode debug/verbose error di production.
- Pastikan database production tidak bisa diakses publik tanpa autentikasi.

---

## 3. Clean Code & Refactor Standards (Lanjutan)

### Code Smell yang Wajib Dicari & Diperbaiki
- **Duplikasi logic** di beberapa file — satukan jadi function/hook/service.
- **God function/component** — satu function/komponen yang melakukan terlalu banyak hal, pecah jadi lebih kecil.
- **Deep nesting** (if/else atau callback bersarang banyak level) — sederhanakan dengan early return atau memecah function.
- **Magic number/string** — ganti dengan konstanta bernama jelas.
- **Dead code** — function, import, variable, atau file yang tidak lagi dipakai, dihapus.
- **Inconsistent naming** — satukan gaya penamaan sesuai konvensi di `ai-project-guidelines.md`.

### Prinsip Tambahan
- **DRY** (Don't Repeat Yourself) — hindari menyalin-tempel logic yang sama.
- **Single Responsibility** — satu file/function fokus satu tugas.
- **Fail Fast** — validasi/precondition dicek di awal function, bukan di tengah logic.
- Komentar hanya untuk menjelaskan **kenapa**, bukan **apa** (nama variabel/function seharusnya sudah menjelaskan "apa").

### Testing (jika belum ada, pertimbangkan ditambahkan bertahap)
- Prioritaskan test untuk logic kritis: autentikasi, pembayaran, perhitungan penting.
- Test API endpoint minimal untuk skenario sukses dan skenario gagal/invalid input.

---

## 4. Checklist Kesiapan Production
- [ ] Semua endpoint sensitif sudah divalidasi & diberi otorisasi
- [ ] Tidak ada secret di kode maupun riwayat Git
- [ ] Password & token disimpan/dikirim dengan aman (hashing, httpOnly cookie)
- [ ] Rate limiting aktif di endpoint kritis
- [ ] Security header & CORS sudah diatur spesifik
- [ ] Error response tidak membocorkan detail internal
- [ ] Logging tidak menyimpan data sensitif
- [ ] Dependency sudah di-audit, tidak ada kerentanan kritis
- [ ] Tidak ada duplikasi logic besar antar file
- [ ] Struktur folder & penamaan konsisten sesuai konvensi project
- [ ] Fitur utama sudah dicoba ulang (regression check) setelah refactor
- [ ] Environment variable production terpisah dari development

---

*Gunakan bersama `ai-project-guidelines.md` (fundamental struktur & konvensi) — dokumen ini fokus pada audit, hardening keamanan, dan kesiapan production untuk project yang sudah berjalan.*
