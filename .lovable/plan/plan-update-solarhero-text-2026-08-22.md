# Plan: Update SolarHero Text

I will update the hero section's copy to the new provided text while maintaining the existing design and animation logic.

## Proposed Changes

### 1. `src/components/solar/SolarHero.tsx`
- Replace the eyebrow text: "AI-POWERED SOLAR INTELLIGENCE" → "AMERICA'S AI-POWERED SOLAR PROPERTY INTELLIGENCE"
- Replace the headline text: "Stop Overpaying for Electricity." → "See How Much Your Home Could Save With Solar."
- Replace the subtext: "Find out how much you could save with solar on your home — with a free AI-powered solar analysis." → "We analyze your home from above to uncover its solar potential, estimate your energy savings, and help you find qualified installers."

## Verification Plan

### Automated Tests
- Build verification: Run `npm run build` or rely on the dev server to ensure no syntax errors.
- Visual check: Use Playwright to confirm the new text is rendered correctly in the hero section.

### Manual Verification
- Check the preview to ensure the typography and layout still look premium with the new, slightly longer text.
