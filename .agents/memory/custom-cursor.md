---
name: Custom Cursor
description: Gold dot + ring follower cursor — implementation details and gotchas
---

# Custom Cursor Implementation

## Files
- Component: `artifacts/havestory/src/components/CustomCursor.tsx`
- CSS classes: `.cursor-dot`, `.cursor-ring`, `.cursor-ring.hovering`, `.cursor-dot.hovering` in `index.css`
- Mounted in `App.tsx` (outside Router, inside WouterRouter)

## How it works
- `* { cursor: none !important }` on all elements in CSS
- `input, textarea, select { cursor: text !important }` restores usable cursor on inputs
- Dot: snaps immediately to `e.clientX / e.clientY` via direct style mutation
- Ring: uses `requestAnimationFrame` + lerp factor `0.12` for smooth trail
- Hover detection: checks if `mouseover` target or closest ancestor is `a, button, [role="button"], [tabindex]`

## Accessibility
- Both elements are `display: none` under `prefers-reduced-motion: reduce`
- `cursor: auto !important` also restored in that media query

**Why:** User requested "mouse point animation" — gold dot + trailing ring is the standard luxury-site pattern.
