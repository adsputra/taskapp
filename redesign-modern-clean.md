# Modern Clean — Redesign Specification

---

## 1. Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Headings | **Plus Jakarta Sans** | 600–700 | text-xl → text-3xl |
| Body | **Inter** | 400–500 | text-sm → text-base |
| Muted / Meta | **Inter** | 400 | text-xs → text-sm |

### Implementation
```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}

h1, h2, h3, h4, h5, h6,
.font-heading {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

---

## 2. Color Palette

### Tokens (globals.css)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `210 40% 98%` (`#F8FAFC`) | Page bg |
| `--foreground` | `222 47% 11%` (`#0F172A`) | Main text |
| `--card` | `0 0% 100%` (`#FFF`) | Card bg |
| `--card-foreground` | `222 47% 11%` | Card text |
| `--primary` | `239 84% 67%` (`#6366F1`) | Indigo accent |
| `--primary-foreground` | `0 0% 100%` | Text on primary |
| `--secondary` | `210 40% 96%` (`#F1F5F9`) | Secondary bg |
| `--secondary-foreground` | `222 47% 11%` | Text on secondary |
| `--muted` | `210 40% 96%` | Muted bg |
| `--muted-foreground` | `215 16% 47%` (`#64748B`) | Secondary text |
| `--accent` | `210 40% 96%` | Accent bg |
| `--accent-foreground` | `222 47% 11%` | Text on accent |
| `--border` | `214 32% 91%` (`#E2E8F0`) | Borders |
| `--input` | `214 32% 91%` | Input borders |
| `--ring` | `239 84% 67%` | Focus ring (indigo) |
| `--radius` | `1rem` | Default radius (16px) |
| `--chart-1` | `239 84% 67%` | Indigo |
| `--chart-2` | `173 80% 40%` | Teal |
| `--chart-3` | `262 83% 58%` | Purple |
| `--chart-4` | `35 92% 65%` | Amber |
| `--chart-5` | `0 72% 51%` | Red |

### Component Colors

| Element | Background | Border | Shadow |
|---------|-----------|--------|--------|
| Card | White | None (0) | `shadow-md` (hover → `shadow-lg`) |
| NavBar | `rgba(255,255,255,0.8)` blur | `border-b border-slate-200/50` | None |
| Page section cards | White | none | `shadow-sm` |
| Buttons primary | Indigo `#6366F1` | — | `shadow-sm` |
| Buttons ghost/outline | Transparent | `border-slate-200` | none |

---

## 3. Card Style

- **Border radius**: `rounded-2xl` (16px) — via `--radius`
- **Border**: none (remove `border`)
- **Shadow**: `shadow-md` with hover → `shadow-lg`
- **Transition**: `transition-all duration-200`

```jsx
// Card component
className={cn(
  "rounded-2xl bg-card text-card-foreground shadow-md hover:shadow-lg transition-all duration-200",
  className
)}
```

---

## 4. Specific Components

### E1c — NavBar (Glass)
- `bg-white/80 backdrop-blur-xl border-b border-slate-200/50`
- No hard shadow
- Sticky top

### E2b — Buttons (More Rounded)
- `rounded-xl` (12px) instead of `rounded-md`
- Primary: indigo bg, white text, `shadow-sm`
- Ghost: hover with `bg-slate-100`

### E3a — Stat Cards
- Same structure as current
- Update colors: indigo icon, emerald for completed, amber for pending, violet for rate
- Card style per D2 (floating, no border)

### E4c — Board Cards
- Clean white card
- Board color as **small dot/badge** instead of full top bar
- No border, shadow-md
- Title in Jakarta Sans
- Metadata in Inter muted

### E5b — Greeting (No Hero)
- Just text: "Good morning, [name]!"
- Subtle accent line or dot
- No gradient background, no blobs
- Clean spacing, rely on type hierarchy

### E6b — Search Input
- `rounded-xl` with subtle shadow
- Border: `border-slate-200`
- Focus: ring indigo

### E7b — Modals
- `rounded-2xl`
- No border
- `shadow-xl`
- Clean padding

### E8b — Avatars
- Solid color bg with letter
- No gradient
- Text white, bold

---

## 5. Shadows

| Level | Shadow |
|-------|--------|
| Card default | `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)` |
| Card hover | `0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)` |
| Modal | `0 25px 50px -12px rgb(0 0 0 / 0.15)` |
| Button | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |

---

## 6. Animation (G1 — Subtle)

All animations: `fade + y-slide 8px`
- Duration: `0.2s` to `0.35s`
- Framer motion: `{ opacity: 0, y: 8 }` → `{ opacity: 1, y: 0 }`
- Stagger delay base: `0.04s` per item
- Easing: `ease-out`

---

## 7. Icon (H2 — Thinner)

Lucide dengan `strokeWidth={1.5}` secara global:
```jsx
// Di layout provider atau _app
<IconContext.Provider value={{ strokeWidth: 1.5 }}>
  {children}
</IconContext.Provider>
```

Atau ubah default via CSS:
```css
.lucide {
  stroke-width: 1.5;
}
```

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/app/globals.css` | All color tokens → indigo palette, Jakarta Sans head, new radius, shadows |
| `src/components/ui/card.jsx` | Remove border, update radius, use shadow-md |
| `src/components/ui/button.jsx` | rounded-xl, update variants |
| `src/components/NavBar.jsx` | Glass effect, indigo active state |
| `src/screens/Dashboard.jsx` | Remove gradient hero, simplify greeting |
| `src/screens/Boards.jsx` | Update styling to match |
| `src/components/boards/BoardCard.jsx` | Floating card, color dot instead of bar |
| `src/components/dashboard/StatsOverview.jsx` | Update colors to indigo palette |
| `src/screens/Analytics.jsx` | Apply new card/shadow tokens |
| `src/app/layout.jsx` | Add Jakarta Sans font loading |

---

> Konfirmasi: ini yang mau diterapin? Kalau ok, aku bakal implement semua perubahan file satu per satu.
