# Plan - Fix Mobile Hero Spacing

Fix the mobile hero section spacing to ensure the eyebrow/tag is fully visible below the fixed navbar.

## Proposed Changes

### Solar Components

#### [src/components/solar/SolarHero.tsx](src/components/solar/SolarHero.tsx)
- Add `pt-20` (top padding) to the main content container on mobile to clear the `h-16` fixed navbar.
- Ensure proper spacing between the navbar and the hero content without creating excessive empty space.

## Technical Details
- The navbar is `fixed` with `h-16` (64px).
- Adding `pt-20` (80px) on mobile should provide enough clearance (64px + 16px buffer).
- I will use responsive classes like `pt-20 lg:pt-0` (if `items-center` handles it on desktop) or adjust the `flex-1` container.

## Verification Plan

### Automated Tests
- Run Playwright script to capture screenshots at 390px and 430px widths.
- Verify that the eyebrow tag is fully visible and not clipped by the navbar.

### Manual Verification
- Inspect the layout in the preview at various mobile widths.
