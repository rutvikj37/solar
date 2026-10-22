# Plan - Solar Energy Visualization Hero

Create a premium, cause-and-effect solar animation sequence that visualizes the flow of energy from sunlight to data analysis.

## User Interface & Design

### Visual Direction
- **Premium Realism**: Clean, professional visualization using `oklch` colors.
- **Color Palette**: 
  - Sunlight: Warm golden/white (`oklch(0.9 0.05 80)`)
  - Energy: Subtle cyan/blue (`oklch(0.7 0.15 200)`)
  - Backgrounds/Cards: Using existing shadcn tokens.
- **Layout**: 
  - Left/Center: Realistic 3D-feeling house illustration (SVG) with solar panels.
  - Right/Floating: Data cards (HUD style) connected by thin energy lines.

### Animation Sequence (Total ~5 seconds)
1. **0-1s (Daylight & Sun)**: Scene loads in normal daylight. A realistic sun element appears top-right.
2. **1-2s (Sunlight Flow)**: Rays/glow travel from sun to the roof solar panels.
3. **2-3s (Panel Activation)**: 
   - Light sweep reflection across panels.
   - Panels brighten slightly.
   - Roof boundary glow.
4. **2.5-4.5s (Energy & Analysis)**:
   - Thin cyan energy lines travel from panels to data cards sequentially.
   - Cards transition from "Analyzing..." to final values.
5. **5s+ (Steady State)**: Subtle ongoing sunlight movement and panel glints.

## Technical Details

### Components
- `SolarHero`: Main container.
- `HouseIllustration`: SVG-based house with defined paths for "panels", "roof", and "energy paths".
- `DataCard`: Reusable component with "Analyzing" and "Final" states + glow effects.
- `EnergyLines`: SVG paths with `stroke-dashoffset` animations.

### Animation Tools
- **Framer Motion**: For complex sequencing and state-driven animations.
- **Tailwind CSS**: For basic transitions and `oklch` color management.

## File Changes

1.  **`src/styles.css`**: Define custom animations (glint, pulse, flow) and `oklch` utility variables.
2.  **`src/components/solar/DataCard.tsx`**: New component for the animated HUD cards.
3.  **`src/components/solar/HouseIllustration.tsx`**: New component for the SVG house/panels.
4.  **`src/components/solar/SolarHero.tsx`**: Main orchestration component.
5.  **`src/routes/index.tsx`**: Replace placeholder with the new `SolarHero` component.

## Verification Plan

### Automated Checks
- `bun run build`: Ensure no syntax errors or missing dependencies.
- `tsgo`: Type check the new components.

### Manual Verification (via Playwright)
- Verify animation sequence timing (Sun -> Panel -> Data).
- Confirm "Analyzing..." states transition to final values.
- Check responsive layout (Desktop/Mobile).
- Ensure no "sci-fi" or "cartoonish" artifacts.
