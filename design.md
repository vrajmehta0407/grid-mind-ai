# GridMind AI: Design System (design.md)

**Direction:** Light, colourful, glassy, Pinterest-style masonry. Not dark theme. Not a template look. It should feel like a living energy "aurora" with frosted cards floating over it.

---

## 1. Two-Colour Palette (strict)
Only two brand colours. Everything else is neutral.

| Role | Name | Hex |
|---|---|---|
| Brand 1 | **Electric Violet** | `#6D4AFF` |
| Brand 2 | **Volt Lime** | `#B8F13B` |
| Ink (text) | Deep Ink | `#14112B` |
| Surface | Frost White | `#FFFFFF` |
| Page tint | Mist | `#F4F2FF` (a violet-tinted white, not cream) |

**Rules**
- Violet = actions, charts, navigation, headings accents.
- Lime = highlights, savings, positive values, key badges, CTA glow.
- Never use cream, beige or yellow-beige anywhere.
- Tints are derived by opacity of the two colours only (violet 8/16/32%, lime 20/40%).
- Alerts reuse the two colours: waste = violet solid with lime dot; savings = lime fill with ink text. No red/green traffic lights.

## 2. Background
Animated **mesh-aurora**: 3-4 large blurred blobs (violet and lime at 25-35% opacity, `blur(90px)`) drifting slowly (30-45 s loops) over `#F4F2FF`. Add a subtle noise overlay at 3% opacity.

## 3. Glass Surfaces
```css
.glass {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 8px 32px rgba(109,74,255,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
  border-radius: 24px;
}
.glass-strong { background: rgba(255,255,255,0.75); }
.glass-violet { background: rgba(109,74,255,0.12); border-color: rgba(109,74,255,0.25); }
.glass-lime   { background: rgba(184,241,59,0.28); border-color: rgba(184,241,59,0.6); }
```
Fallback when `backdrop-filter` unsupported: solid `rgba(255,255,255,0.9)`.

## 4. Typography
- Display: **Clash Display** or **Cabinet Grotesk** (700), tight tracking -0.02em
- Body: **Inter** or **General Sans** (400/500)
- Numbers/data: **JetBrains Mono** or Inter tabular-nums
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96 px. Hero numbers go huge (96px), the key signature element.

## 5. Layout: Pinterest Masonry
- Dashboard is a **masonry grid** of variable-height glass cards (CSS columns or `grid-template-rows: masonry` with JS fallback).
- 4 columns desktop, 2 tablet, 1 mobile. Gap 20px.
- Card types: Hero Number, Sparkline, Donut, Slab Ladder, Forecast Band, Waste Item, Tip Card, Appliance Tile, Streak Badge.
- Cards have mixed heights (tall chart cards, short stat cards) so the board feels curated, like a mood board.

## 6. Signature Components
1. **Bill Ring:** big radial gauge, violet arc with lime end-cap, amount counting up in centre.
2. **Slab Ladder:** vertical stair of tariff slabs; the user's position glows lime.
3. **Forecast Ribbon:** line with a violet gradient confidence band that fans out.
4. **Waste Bubbles:** floating circles sized by Rs. wasted, drifting gently; click to expand into a card.
5. **What-if Sliders:** chunky pill sliders with lime thumbs, charts re-animating live.
6. **Savings Sticker:** lime sticker-style badge, slightly rotated (-4deg), with a hover wiggle.
7. **Appliance Tiles:** icon on a glass tile with a mini-bar of share of bill.

## 7. Motion (2026 feel)
- Library: **Framer Motion / Motion One** + **GSAP ScrollTrigger**; optional **Lenis** smooth scroll.
- Page entry: staggered card reveal (translateY 24px, blur 8px to 0, 60ms stagger).
- Numbers: count-up with easing `cubic-bezier(.22,1,.36,1)` over 1.2 s.
- Cards: hover lifts 6px, tilts up to 4deg following the cursor (parallax), a specular highlight follows the pointer.
- Scroll: landing page uses pinned sections, horizontal scroll gallery, and marquee text.
- Cursor: soft violet blob follower with lime ring on interactive elements (desktop only).
- Chart draw-on: SVG stroke-dashoffset animation.
- `prefers-reduced-motion`: disable parallax, drift and count-ups.

## 8. Shape and Spacing
- Radii: 12 (chips), 20 (inputs), 28 (cards), 999 (pills)
- 8px spacing grid. Section padding 96px desktop, 56px mobile.
- Icons: Phosphor or Lucide duotone, 1.75 stroke.

## 9. Landing Page Sections
1. Hero: giant headline "Know every unit." with floating glass bill card and drifting lime bolt
2. Marquee strip of savings facts
3. Bento/masonry feature board
4. Interactive demo: drag a slider, watch the bill change
5. How it works (3 pinned steps)
6. Testimonials as Pinterest pins with mixed heights
7. CTA with aurora background

## 10. Accessibility
- Text on glass must hit 4.5:1: use Deep Ink `#14112B` on glass; white text only on solid violet.
- Lime is never used for text on white; only as fill with ink text on top.
- Visible focus ring: 3px violet with 2px white offset.
- All charts have table fallbacks and aria labels.

## 11. Tokens (Tailwind)
```js
colors: {
  violet: { DEFAULT: '#6D4AFF', 50:'#F1EDFF', 100:'#E3DBFF', 500:'#6D4AFF', 700:'#4B2FD1' },
  lime:   { DEFAULT: '#B8F13B', 100:'#EDFBC6', 500:'#B8F13B', 700:'#8CC215' },
  ink: '#14112B', mist: '#F4F2FF'
}
```

## 12. Do / Don't
| Do | Don't |
|---|---|
| Huge numbers, generous whitespace | Cram widgets in uniform grids |
| Layered translucency with soft shadows | Heavy black drop shadows |
| Two colours + neutrals | Rainbow gradients, cream tones |
| Playful sticker accents | Stock-icon corporate look |
