# Hero Section Conversion Refinement Plan

Update the Hero section to focus on U.S. homeowner savings and AI-powered intelligence, while maintaining the existing high-end visual style and animations.

## Proposed Changes

### 1. Hero Messaging and CTA
- **Location:** `src/components/solar/SolarHero.tsx`
- **Left Side Copy:**
    - Update Eyebrow: "AI-POWERED SOLAR INTELLIGENCE"
    - Update Headline: "Stop Overpaying for Electricity." (Largest text, "Overpaying" or "Electricity" in cyan gradient).
    - Update Description: "Find out how much you could save with solar on your home — with a free AI-powered solar analysis."
- **CTA Button:**
    - Label: "Calculate My Solar Savings →"
    - Subtext: "Free • Personalized to Your Home • No Obligation"
    - Hover Animation: Add lift, cyan glow, and arrow movement.

### 2. Right-Side AI Data Cards
- **Location:** `src/components/solar/SolarHero.tsx`
- **Updated Card Contents:**
    1. **Solar Potential:** `92 / 100` (Excellent)
    2. **Est. Annual Savings:** `$2,180 / YEAR` (With savings indicator)
    3. **20-Year Potential Savings:** `$43,600*` (Most prominent card visually)
- **Disclaimer:** Add tiny disclaimer text near the savings cards.
- **Timing:** Keep sequence (Sun → Rays → Panels → Scan → Cards) but update reveal to highlight savings outcomes.

### 3. Component Updates
- **`src/components/solar/DataCard.tsx`:**
    - Enhance "savings" visual prominence (perhaps a slightly different glass effect or icon treatment for the big savings card).
    - Support the "upward savings indicator" visual.
    - Ensure readability on dark glass.

### 4. Styles
- **`src/styles.css`:**
    - Add utility for CTA hover animations (lift, glow, arrow slide).
    - Define specific colors or styles for the "best match" or "high savings" highlighted state if needed.

## Verification Plan

### Automated Tests
- `lovable-exec`: Check build status.
- `playwright`: Verify the new text exists, CTA hover effects work, and animation timing remains consistent.

### Manual Verification
- Confirm headline gradient is correctly applied.
- Verify single-frame fit on desktop.
- Check mobile responsiveness and readability.
