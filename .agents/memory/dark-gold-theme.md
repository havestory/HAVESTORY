---
name: Dark Gold Theme
description: HAVESTORY intentional design language — deep dark base + rich gold accent; do not revert to light/warm-ivory palette
---

# HAVESTORY Dark Gold Design System

The user explicitly requested a "dark and gold look — traditional and smart blend" overhaul.

## Palette (CSS variables in index.css)
- `--background`: `30 14% 6%` → #0F0D0A (near-black warm dark)
- `--foreground`: `40 28% 90%` → #EDE6D8 (warm ivory text)
- `--secondary` (gold accent): `43 62% 50%` → #C9A84C
- `--accent` (hover gold): `43 70% 58%` → #D4B55E
- `--card`: `30 12% 9%` → #181410
- `--muted`: `30 10% 12%` → #1E1A14
- `--border`: `30 10% 16%` → #2A2418
- `--sidebar` (admin): `30 16% 5%` → #0C0A07

**Why:** User confirmed this direction; previous Warm Ivory/Walnut palette was pre-approval and is now superseded.

**How to apply:** All new pages and components must use these tokens. Use `text-[#C9A84C]` / `border-[#C9A84C]` for gold accents. Use `bg-[hsl(var(--background))]` for page backgrounds. Glassmorphism uses `rgba(20,17,9,0.72)` base.

## Typography
- Serif headlines: Cormorant Garamond (Google Fonts, already in index.css)
- Body: DM Sans
- Border-radius: `0.15rem` (near-square, artisan feel)

## Hero Slider
- 5 Unsplash slides defined in `Home.tsx` constant `HERO_SLIDES`
- Auto-advance 5.5s, pauses on hover, prev/next arrows, dot indicators, play/pause button
- Slide counter shown bottom-right

## Custom Cursor
- `CustomCursor.tsx` renders `.cursor-dot` (6px gold) + `.cursor-ring` (30px gold border)
- Ring uses RAF lerp (factor 0.12) for smooth trailing
- Expands on hover over links/buttons
- Mounted globally in `App.tsx`
