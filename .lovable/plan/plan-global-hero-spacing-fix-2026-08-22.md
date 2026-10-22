# Plan: Global Hero Spacing Fix

Fix the hero section spacing to ensure the eyebrow tag is never clipped by the fixed navbar across all screen sizes (Mobile, Tablet, Desktop, Large Desktop).

## Proposed Changes

### 1. `src/components/solar/SolarHero.tsx`
- **Root Container**: Add `pt-16` (64px) to the parent `div` for all breakpoints to provide a consistent base clearance for the fixed `h-16` navbar.
- **Content Wrapper**: 
    - Change `pt-20 lg:pt-0` to a more robust responsive spacing: `pt-12 md:pt-16 lg:pt-20`.
    - Maintain `flex-1` and vertical centering, but ensure the "safe area" starts below the navbar.
    - Tighten vertical spacing between the eyebrow, headline, and description to keep the layout compact and vertically balanced.
- **Vertical Balance**: Use `justify-center` or `items-center` on the content grid to keep it centered within the remaining viewport height.

## Verification Plan

### Automated Verification
1. **Playwright Screenshots**: Capture screenshots at the following widths:
    - 390px (Mobile)
    - 430px (Large Mobile)
    - 768px (Tablet)
    - 1024px (Desktop)
    - 1440px (Large Desktop)
    - 2560px (Ultra-wide)
2. **Visual Check**: Confirm the "AMERICA'S AI-POWERED..." eyebrow tag is fully visible and has at least 20px of clear space below the navbar in all screenshots.
3. **Scroll Check**: Ensure the hero section fits comfortably within the viewport without excessive empty space.

### Manual Verification
- Verify that animations (house appear, sun rays, cards) still function correctly and are not offset incorrectly by the new padding.
- Confirm the CTA button is easily reachable and visible without scrolling on most standard viewports.
