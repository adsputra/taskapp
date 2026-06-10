### 🔧 Perbaikan Fitur

| Fitur | Sekarang | Seharusnya |
|-------|----------|------------|
| **PeopleCell** | Input text manual | Dropdown/search real user dari database |
| **Assign** | 1 orang (string) | Multiple assignees (array of user IDs) |
| **Invite Team** | Console.log doang | Bikin record di `invitations`, kirim email via Supabase Edge Function |
| **Share Board** | Tidak ada | Modal share → tambah user ke `board_members` |
| **RLS** | Owner only | Juga allow board_members |

### 📋 Prioritas Pengembangan

1. **Database dulu** — tambah tabel `board_members` + update RLS
2. **PeopleCell jadi real** — pilih user dari database, bukan ketik manual
3. **Invite beneran** — kirim undangan + simpan di DB
4. **Share Board** — modal share di board header
5. **Multi-user RLS** — allow akses untuk member board


Oke, ini gambaran **flow sharing board** yang logis dan maturity-nya kayak Monday/Jira/Notion. Saya jelasin dari atas ke bawah ya.

---

## 🧠 Alur Sharing Board Ideal

### 1. Flow Utama

Kamu (Owner) → Invite teman via email → Teman daftar/login → Muncul board di dashboard dia

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   KAMU       │     │  DATABASE    │     │   TEMAN      │
│  (Owner)     │     │  (Supabase)  │     │  (Member)    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       │ 1. Klik "Share"    │                     │
       │    di Board Header  │                     │
       │──────┐             │                     │
       │      │ Masukin     │                     │
       │      │ email       │                     │
       │      │ teman:      │                     │
       │      │ "budi@      │                     │
       │      │  email.com" │                     │
       │<─────┘             │                     │
       │                    │                     │
       │ 2. Submit invite   │                     │
       │───────────────────>│                     │
       │                    │ INSERT ke tabel      │
       │                    │ board_members:       │
       │                    │ - board_id: X        │
       │                    │ - email: budi@...    │
       │                    │ - role: 'editor'     │
       │                    │ - status: 'pending'  │
       │                    │                     │
       │ 3. Kirim email     │                     │
       │    undangan (via   │                     │
       │    Supabase Edge   │                     │
       │    Function)       │                     │
       │                    │                     │
       │                    │                     │ 4. Budi buka email
       │                    │                     │    klik link:
       │                    │                     │    app.com/join?token=xxx
       │                    │                     │<──────────┘
       │                    │                     │
       │                    │ 5. Budi login/signup│
       │                    │<────────────────────│
       │                    │                     │
       │                    │ 6. UPDATE            │
       │                    │    board_members     │
       │                    │    SET user_id =     │
       │                    │    budi.id,          │
       │                    │    status='active'   │
       │                    │                     │
       │ 7. Di dashboard    │                     │
       │    Budi, board X   │                     │
       │    muncul otomatis │                     │
       │<──────────────────────────────────────────│
       │                    │                     │
       │ 8. Budi bisa       │                     │
       │    akses board,    │                     │
       │    edit item, dll  │                     │
       │──────────────────────────────────────────>│
```

---

### 2. Cara Kerja di Database

**Tabel baru `board_members`:**

| board_id | user_id (nullable) | email         | role   | status  |
|----------|-------------------|---------------|--------|---------|
| abc-123  | uuid-budi         | budi@email.com | editor | active  |
| abc-123  | null              | sari@email.com | viewer | pending |
| xyz-456  | uuid-adi          | adi@email.com  | admin  | active  |

Kenapa `user_id` nullable? Karena **undangan bisa ke orang yang belum punya akun**. Jadi:
- **Pending** — user_id = null, status = 'pending'
- **Active** — user_id terisi, status = 'active'

**RLS diubah jadi:**
```sql
-- Bukan cek "auth.uid() = user_id" lagi
CREATE POLICY "select board" ON boards FOR SELECT
  USING (
    auth.uid() = user_id                    -- owner
    OR auth.uid() IN (                       -- member
      SELECT user_id FROM board_members
      WHERE board_id = boards.id AND status = 'active'
    )
  );
```

---

### 3. Cara Kerja di Frontend

**Dashboard — query boards yang di-share:**
```
boards saya = boards WHERE user_id = aku
           ∪ boards WHERE id IN (board_members aku)
```

Kodenya:
```jsx
// Dashboard ambil semua boards yang bisa diakses user
async function getMyBoards() {
  const { data: owned } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', user.id);

  const { data: shared } = await supabase
    .from('board_members')
    .select('board:board_id(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  return [...owned, ...shared.map(s => s.board)];
}
```

**Di BoardCard muncul badge "Shared" atau avatar teman:**

| Board Saya (owned) | Shared with me |
|--------------------|----------------|
| 📋 Project A       | 📋 Project B (milik Budi) |
| 📋 TO DO Kantor    |                    |

---

### 4. Flow Undangan untuk Orang yang BELUM Punya Akun

Ini bagian kritis. Undangan harus nyampe ke email, dan link-nya handle 2 kasus:

```
Email: "Budi, kamu diundang ke Project X"

Link: https://app.com/join?token=abc123

  ├── Sudah login? → langsung accept, redirect ke board
  │
  └── Belum punya akun? → halaman signup + auto-accept setelah register
```

Cara kerja:
1. Saat invite, generate `token` unik dan simpan di `board_members`
2. Email dikirim dengan link `app.com/join?token=xxx`
3. Halaman `/join`:
   ```jsx
   // /app/join/page.jsx
   const token = searchParams.get('token');
   const { data: invite } = await supabase
     .from('board_members')
     .select('*')
     .eq('token', token)
     .single();

   if (!user) redirect(`/auth/signup?redirect=/join?token=${token}`);
   
   // Auto-accept
   await supabase.from('board_members')
     .update({ user_id: user.id, status: 'active' })
     .eq('id', invite.id);
   ```

---

### 5. Share Button di Board Header

Secara visual:

```
┌────────────────────────────────────────────────────────┐
│  [Project X]  [Table] [Kanban] [Calendar]  [… Share] │
│                                            ┌──────────┐│
│                                            │ Share     ││
│                                            │ Board     ││
│                                            │           ││
│                                            │ Email: ___││
│                                            │ [Invite]  ││
│                                            │           ││
│                                            │ Member:   ││
│                                            │ 👤 Budi   ││
│                                            │ 👤 Sari   ││
│                                            └──────────┘│
└────────────────────────────────────────────────────────┘
```

---

### 6. Ringkasan Perubahan yang Dibutuhkan

| Area | Yang Harus Dibuat |
|------|------------------|
| **Database** | Tabel `board_members` + update RLS |
| **Backend API** | `boardsApi.share()`, `boardsApi.acceptInvite()` |
| **Email** | Supabase Edge Function kirim email via Resend/SendGrid |
| **UI Share Modal** | Modal input email, daftar member yang sudah accept |
| **Dashboard** | Pisah board "Owned" vs "Shared with me" |
| **PeopleCell** | Ganti input text → dropdown real user dari board_members |

-