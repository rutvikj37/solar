# SolarXAI Hero Redesign Plan

Redesign the hero section to meet premium U.S. tech startup standards (AI + clean energy) with a photorealistic house visual and a 6-stage cause-and-effect animation sequence.

## 1. Design System & Assets
- Use existing `src/assets/solar-home-hero.jpg` (photorealistic house).
- Define premium `oklch` tokens in `src/styles.css` for deep navy (left side) and cyan/blue accents (AI overlays).
- Add custom utility classes for "glass" effects and refined animations.

## 2. Component Architecture
- `src/components/solar/SolarHero.tsx`: Main orchestrator using Framer Motion for the 6-stage sequence.
- `src/components/solar/Navbar.tsx`: Sticky transparent navy glass navbar.
- `src/components/solar/DataCard.tsx`: Reusable floating "intelligence annotation" card with "Analyzing..." states.
- `src/components/solar/HouseVisual.tsx`: Manages the photorealistic image, SVG overlays (AI roof detection), and lighting effects (sunlight sweep, panel reflections).

## 3. Animation Sequence (4-6s)
1. **Home Appears**: Fade/slide house (0-1s).
2. **Sunlight**: Realistic warm sweep towards the roof (1-2s).
3. **Panel Reflection**: Diagonal glare across solar panels (2-3s).
4. **AI Activation**: Cyan roof boundary and scan line appear (3-4s).
5. **Energy Flow**: Thin data lines from panels to HUD (4-5s).
6. **Results**: Data cards activate sequentially (5-6s).

## 4. Implementation Steps
1. **Styles**: Update `src/styles.css` with navy/cyan tokens and glint/flow animations.
2. **Components**: Build `Navbar`, `DataCard`, and `HouseVisual`.
3. **Hero**: Assemble in `SolarHero` with Framer Motion state management.
4. **Route**: Update `src/routes/index.tsx` to mount the new hero.
5. **Verification**: Run Playwright to confirm the 6-stage sequence timing and layout.
