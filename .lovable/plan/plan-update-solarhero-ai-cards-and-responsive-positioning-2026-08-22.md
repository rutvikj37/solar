# Plan: Update SolarHero AI Cards and Responsive Positioning

I will update the three data cards in the hero section with the new requested content and redesign their mobile positioning to be more compact and non-obstructive.

## Proposed Changes

### 1. `src/components/solar/DataCard.tsx`
- Update the default "AI Analysis" label to allow for more flexibility or keep it if it fits.
- Ensure the card is compact enough for the new content.
- Add support for a "subtext" or custom unit placement if needed to match "Excellent Potential", etc.

### 2. `src/components/solar/SolarHero.tsx`
- **Content Updates**:
  1. Card 1: `label="SOLAR POTENTIAL"`, `value="92 / 100"`, `unit="Excellent Potential"`
  2. Card 2: `label="EST. ANNUAL SAVINGS"`, `value="$2,180"`, `unit="/ YEAR"`, plus subtext "Potential Savings"
  3. Card 3: `label="ROOF SUITABILITY"`, `value="High"`, `unit="Well Suited for Solar"`
- **Responsive Positioning**:
  - Adjust the absolute positioning classes for mobile (`sm:` prefix for desktop values).
  - Use a vertical stack or staggered layout on mobile that avoids covering the center of the roof/panels.
  - Ensure all cards are within the viewport (no clipping).
  - Reduce card width/scale on mobile.

## Verification Plan

### Automated Tests
- Build verification: Ensure no syntax errors.
- Visual check: Use Playwright to capture screenshots at 390px, 430px, and 1280px widths to verify positioning and readability.

### Manual Verification
- Confirm the new text is correct in the preview.
- Ensure the house visual (sun, rays, scan) remains clearly visible behind/around the cards on mobile.
