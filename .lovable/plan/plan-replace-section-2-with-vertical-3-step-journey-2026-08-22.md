# Plan - Replace Section 2 with Vertical 3-Step Journey

Replace the existing horizontal card stack with a premium vertical 3-step section titled "HOW IT WORKS".

## Proposed Changes

### 1. `src/components/solar/HowItWorks.tsx`
- Create a new component for the 3-step journey.
- **Section Heading**: Eyebrow "HOW IT WORKS", Main "From Your Home to the Right Solar Installer." (cyan highlight), Subheading "One simple process. Powered by SolarXAI."
- **Step 1: Fill a Simple Form**
    - Text: "Tell us about your home and where you live. It takes less than a minute."
    - Points: Address, home details, contact info.
    - Visual: Smartphone mock with "Step 1 of 3" form.
- **Step 2: AI Analysis**
    - Text: "SolarXAI analyzes your property, roof, sunlight exposure and solar potential..."
    - Visual: Satellite property image (`/roof-aerial.jpg`) with scan line and data points (Sun Exposure: Excellent, Roof Suitability: High, Solar Potential: 92/100).
- **Step 3: Qualified Installer**
    - Text: "Our system evaluates qualified installers serving your area..."
    - Visual: Matching interface with profiles and a "Qualified Match" highlight.
- **Final CTA**: "See What Your Home Could Do With Solar." with button "GET MY FREE SOLAR REPORT →".

### 2. `src/routes/index.tsx`
- Import `HowItWorks` instead of `ProcessStack`.
- Replace `<ProcessStack />` with `<HowItWorks />`.

### 3. `src/components/solar/ProcessStack.tsx`
- Delete this file as it is being replaced.

## Verification Plan

### Automated Tests
- Run `bun tsgo` to verify TypeScript syntax.
- Run a Playwright script to:
    - Verify the "HOW IT WORKS" heading is present.
    - Check for the 3 step cards.
    - Verify the final CTA button is visible.
    - Confirm the layout is vertical (no horizontal scroll).

### Manual Verification
- Inspect the layout on mobile and desktop.
- Verify animations (reveal on scroll).
