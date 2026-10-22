# Mobile View and Sticky CTA Plan

Fix the mobile view issues across the entire landing page and implement a persistent, high-conversion sticky CTA at the bottom for mobile users.

## Proposed Changes

### 1. Global Layout (Sticky CTA)
- **Location:** `src/routes/__root.tsx` or a new component.
- **Action:** Add a `MobileStickyCTA` component that appears only on small screens.
- **Design:** Dark glass background, cyan gradient button "Calculate My Savings", and a small "100% Free" badge.

### 2. Hero Section Mobile Refinement
- **Location:** `src/components/solar/SolarHero.tsx`
- **Action:** 
    - Adjust `min-h-[100svh]` handling to account for mobile browser chrome.
    - Ensure typography doesn't overlap with the house visual on small screens.
    - Adjust the absolute positioning of `DataCard` elements for better fit on 390px widths.

### 3. "How It Works" Mobile Refinement
- **Location:** `src/components/solar/HowItWorks.tsx`
- **Action:**
    - Fix the `InstallerVisual` grid (currently `grid-cols-3` is too cramped on mobile). Change to a slider or vertical stack.
    - Tighten padding and margins for `StepPanel` on mobile.
    - Ensure the phone mockup and satellite scan visuals don't cause horizontal overflow.

### 4. Styles
- **Location:** `src/styles.css`
- **Action:**
    - Add utility for `safe-bottom-padding` to prevent content being hidden behind the sticky CTA.
    - Add the sticky CTA animation and glass style.

## Verification Plan

### Automated Tests
- `playwright`: Run mobile emulation (iPhone 12/13) and verify:
    - No horizontal overflow.
    - Sticky CTA is visible and clickable.
    - Hero cards are legible.
    - "How It Works" steps are correctly formatted.

### Manual Verification
- Verify the sticky CTA doesn't overlap important content like the "Get My Free Report" button in the form step.
- Check the layout on different screen sizes (375px to 428px).
