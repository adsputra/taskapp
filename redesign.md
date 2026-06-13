# Tuesday.com Redesign Guide

> Pilih kombinasi yang kamu suka dari setiap kategori. Jawab aja pilihannya (e.g. "A1, B2, C3...") nanti aku implementasiin.

---

## A. Design Vibe — Nuansa Keseluruhan

| # | Vibe | Description |
|---|------|-------------|
| **A1** | **Clean Professional** | Apple-like, very minimal, lots of whitespace, subtle shadows, high contrast typography. Biasa dipake buat B2B/professional tools. |
| **A2** | **Modern Playful** | Notion + Linear hybrid. Lebih bold di warna accent, rounded corners gede, micro-interactions halus, typography berani. |
| **A3** | **Elegant Premium** | Stripe / Linear style. Dark mode-ready, refined typography, judicious use of color, opacity/glassmorphism halus. |
| **A4** | **Energetic Productive** | Monday.com / Asana style. Warna accent vibrant, hierarchy jelas, spacing padat. Fokus ke readability & speed. |
| **A5** | **Soft Minimal** | Calm, approachable. Pastel accents, extra rounded, shadows lembut, banyak breathing room. |

---

## B. Font — Tipografi

| # | Font | Pairing | Vibe |
|---|------|---------|------|
| **B1** | **Inter** (headings) + **Inter** (body) | Same font, weight play | Clean & aman, default shadcn |
| **B2** | **Plus Jakarta Sans** (headings) + **Inter** (body) | Rounded geometric + neutral | Modern, playful, hangat |
| **B3** | **Space Grotesk** (headings) + **Inter** (body) | Slightly funky + clean | Tech-forward, edgy |
| **B4** | **Cabinet Grotesk** (headings) + **Satoshi** (body) | Premium geometric pair | Elegant, premium, refined |
| **B5** | **DM Sans** (headings) + **DM Sans** (body) | Same font, versatile | Friendly, approachable |
| **B6** | **Plus Jakarta Sans** (headings) + **Plus Jakarta Sans** (body) | The same rounded modern | All-round, modern, consistent |

---

## C. Color — Warna (white background tetap)

### C1 — Primary / Accent (warna utama)
| # | Color | Hex | Vibe |
|---|-------|-----|------|
| **C1a** | Blue | `#2563EB` | Trustworthy, professional (default) |
| **C1b** | Indigo | `#6366F1` | Creative, modern (Linear-like) |
| **C1c** | Violet | `#7C3AED` | Bold, premium |
| **C1d** | Emerald | `#059669` | Fresh, growth-oriented |
| **C1e** | Slate/Dark | `#0F172A` + accent accent color | Minimal, typography-forward |

### C2 — Surface / Card (white bg)
| # | Card bg | Border | Vibe |
|---|---------|--------|------|
| **C2a** | Pure white `#FFF` | `#E2E8F0` | Classic, high contrast |
| **C2b** | Pure white `#FFF` | `#F1F5F9` (very subtle) | Clean, border nyaris ga keliatan |
| **C2c** | `#F8FAFC` (slight warm) | `#E2E8F0` | Soft, warm |
| **C2d** | Pure white `#FFF` | Transparent (isolated shadow) | Floating card look (Stripe-style) |

### C3 — Page Background
| # | Color | Vibe |
|---|-------|------|
| **C3a** | `#F8FAFC` (slate-50) | Classic dashboard look |
| **C3b** | `#FFFFFF` | Pure white, minimal, modern |
| **C3c** | `#FAFAFA` (neutral-50) | Warm neutral |
| **C3d** | `#F4F6F8` | Slight cool gray |

### C4 — Text Hierarchy
| # | Heading | Body | Muted |
|---|---------|------|-------|
| **C4a** | `#0F172A` | `#334155` | `#94A3B8` |
| **C4b** | `#111827` | `#374151` | `#9CA3AF` |
| **C4c** | `#1E293B` | `#475569` | `#A0AEC0` |

---

## D. Card Style

| # | Style | Border Radius | Shadow | Border | 
|---|-------|--------------|--------|--------|
| **D1** | **Standard shadcn** | `rounded-xl` (12px) | `shadow-sm` hover → `shadow-md` | `border` solid tipis |
| **D2** | **Floating** | `rounded-2xl` (16px) | `shadow-md` hover → `shadow-lg` | No border, rely on shadow |
| **D3** | **Elevated** | `rounded-lg` (8px) | `shadow-sm` hover → `shadow-lg` | No border or very subtle |
| **D4** | **Bordered clean** | `rounded-lg` (8px) | No shadow | `border` solid, hover thicker |
| **D5** | **Soft rounded** | `rounded-3xl` (20px) | `shadow-sm` + soft glow | Very subtle border |

---

## E. Komponen Spesifik — Mau diapain?

### E1 — NavBar
| # | Style |
|---|-------|
| **E1a** | Transparent bg, border-bottom tipis |
| **E1b** | White bg dengan subtle shadow |
| **E1c** | Glass/blur effect (backdrop-blur) |
| **E1d** | Sidebar-style (desktop) |

### E2 — Buttons
| # | Style |
|---|-------|
| **E2a** | Default shadcn (rounded-md) |
| **E2b** | More rounded (`rounded-lg` or `rounded-xl`) |
| **E2c** | Pill-shaped (`rounded-full`) |
| **E2d** | Minimal (ghost-style, underline on hover) |

### E3 — Stat Cards (Dashboard)
| # | Style |
|---|-------|
| **E3a** | Current style — icon + number + label |
| **E3b** | Mini chart sparkline di samping angka |
| **E3c** | Large number, no icon, super minimal |
| **E3d** | Card dengan subtle gradient bg per item |

### E4 — Board Cards
| # | Style |
|---|-------|
| **E4a** | Current style — color bar top + folder icon |
| **E4b** | Full color cover (gradient bg based on board color) |
| **E4c** | Clean white card, board color as a small dot/badge |
| **E4d** | List item style with color strip on left |

### E5 — Greeting Section (Dashboard)
| # | Style |
|---|-------|
| **E5a** | Current gradient hero |
| **E5b** | Minimal — just text, no background/hero |
| **E5c** | Subtle gradient/pattern |
| **E5d** | Clean white card with border accent left |

### E6 — Search Input
| # | Style |
|---|-------|
| **E6a** | Default input with border |
| **E6b** | Rounded-xl with subtle shadow |
| **E6c** | Ghost/minimal — no border until focus |
| **E6d** | Pill-shaped with icon inside |

### E7 — Modals
| # | Style |
|---|-------|
| **E7a** | Default Radix dialog |
| **E7b** | Centered, rounded-2xl, no border, shadow-xl |
| **E7c** | Slide-in sheet dari kanan |

### E8 — Avatars (User)
| # | Style |
|---|-------|
| **E8a** | Current gradient avatar |
| **E8b** | Solid color bg with letter |
| **E8c** | Border ring (2px white ring) |

---

## F. Layout & Spacing

| # | Spacing scale | Max-width | Vibe |
|---|--------------|-----------|------|
| **F1** | Compact (py-4, gap-4) | `max-w-6xl` | Dense, data-heavy |
| **F2** | Comfortable (py-6, gap-6) | `max-w-7xl` | Balanced (current) |
| **F3** | Generous (py-8, gap-8) | `max-w-7xl` | Airy, premium |

---

## G. Animasi & Micro-interactions

| # | Style |
|---|-------|
| **G1** | Subtle (fade + slight y-slide, 0.2s) |
| **G2** | Bouncy (spring physics, framer-motion spring) |
| **G3** | Staggered (items fade in one by one) |
| **G4** | None / minimal (reduce motion) |

---

## H. Icon Style

| # | Style |
|---|-------|
| **H1** | Lucide default (current) |
| **H2** | Lucide but all stroke-width 1.5 (thinner) |
| **H3** | Lucide but all filled style where possible |

---

## Quick Combinations — Recommended Bundles

### ✦ Modern Clean (Recommended)
> A2 + B2 + C1b + C2b + C3a + D2 + E1c + E2b + E3a + E4c + E5b + E6b + G1 + H2

### ✦ Premium Elegant
> A3 + B4 + C1c + C2d + C3b + D3 + E1a + E2d + E3c + E4c + E5c + E6c + G1 + H2

### ✦ Professional Productivity
> A4 + B1 + C1a + C2a + C3a + D4 + E1b + E2a + E3a + E4a + E5a + E6a + G3 + H1

### ✦ Soft & Friendly
> A5 + B5 + C1d + C2c + C3c + D5 + E1b + E2b + E3d + E4d + E5c + E6b + G2 + H2

---

## Cara Pakai

1. Pilih **satu opsi per kategori** (A, B, C, D, E, F, G, H) — atau pilih salah satu bundle yang sudah dikombinasikan.
2. Jawab dengan format: `A2, B2, C1b, C2b, C3a, C4a, D2, E1c, E2b, E3a, E4c, E5b, E6b, E7a, E8a, F2, G1, H2`
3. Kalau mau custom campur aduk (e.g. pilih A2 tapi font B4), juga boleh.
4. Bilang aja "ini bundle Modern Clean tapi ganti font B4" — bebas.
