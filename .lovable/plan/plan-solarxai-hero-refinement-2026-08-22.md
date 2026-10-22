# Plan: SolarXAI Hero Refinement

Refine the existing hero section with a realistic sunlight-to-data animation sequence and improved responsive UX.

## Proposed Changes

### 1. `src/components/solar/SolarHero.tsx`
- **Animation Sequence**: Implement a 6-stage automatic animation on page load (5-6 seconds total).
  - Stage 0: House/Panels appear (0-1s)
  - Stage 1: Sun brightness increase (1-2s)
  - Stage 2: Sunlight rays travel from sun to panels (2-3.5s)
  - Stage 3: Reflection sweep + Panel brightening (3.5-4s)
  - Stage 4: AI roof scan activation (4-5s)
  - Stage 5: Reveal 3 AI data cards one by one (5-6s)
- **Data Cards**: Reduce to exactly 3 cards (Sun Exposure, Solar Potential, Est. System Size) with updated labels/values.
- **Layout**: 
  - Desktop: Ensure full fit in `100svh` without scrolling. Use `clamp()` for font sizes and spacing.
  - Mobile: Genuine mobile responsive layout (Stacked: headline → desc → CTA → visual → cards).
  - Position cards relative to the hero visual using percentages to avoid viewport clipping.

### 2. `src/components/solar/HouseVisual.tsx`
- **Sunlight**: Enhance the sun ray animation to look like realistic sunlight from the upper right.
- **AI Scan**: Refine the cyan roof outline and scanning line animation.
- **Reflection**: Implement a realistic light sweep across the panels triggered when rays hit.

### 3. `src/components/solar/DataCard.tsx`
- **Styling**: Ensure high readability with 32% transparency glass effect.
- **Animation**: Add subtle fade + upward movement + cyan glow on reveal.

### 4. `src/styles.css`
- **Utilities**: Adjust `.glass-card` and add specific animation keyframes if needed for the refined sequence.

## Technical Details
- Use `useState` and `useEffect` in `SolarHero.tsx` for precise timing control.
- Leverage Framer Motion or pure CSS transitions for performance-heavy animations.
- Use `100svh` on the main container to guarantee single-viewport fit.

## Verification Plan
- **Desktop**: Check 100svh fit, 6s animation sequence, card positioning, and zero clipping.
- **Mobile**: Verify stacked layout, readable cards, and correct animation flow.
- **Performance**: Ensure animations are smooth and stop after the sequence.
