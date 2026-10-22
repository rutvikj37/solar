# Plan: Highlight "Solar" in Hero Headline

I will update the hero headline to wrap the word "Solar" in a span with the brand's cyan/blue color gradient, matching the existing design aesthetic.

## Proposed Changes

### 1. `src/components/solar/SolarHero.tsx`
- Locate the `h1` headline.
- Wrap the word "Solar" in a span with classes: `text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200`.

## Verification Plan

### Automated Tests
- Build verification: Ensure the project compiles correctly.
- Visual check: Use Playwright to confirm the word "Solar" is rendered with the expected classes and color.

### Manual Verification
- Verify in the preview that the text looks correct and the color matches the brand identity.
