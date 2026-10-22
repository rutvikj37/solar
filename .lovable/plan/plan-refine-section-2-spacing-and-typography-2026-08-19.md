# Plan: Refine Section 2 Spacing and Typography

I will fix the spacing, heading alignment, and content layout in Section 2 (`ProcessStack.tsx`) to ensure a more premium and balanced aesthetic.

## Proposed Changes

### 1. `src/components/solar/ProcessStack.tsx`
- **Heading Refinement**: Tighten the spacing between the "How It Works" label, the main heading, and the sub-heading.
- **Card Spacing**: Increase the vertical space between the top heading and the card stack to prevent overcrowding on smaller screens.
- **Card Internal Spacing**: Standardize internal padding in `CardHeader` and card shells for better readability.
- **Bottom Layout**: Clean up the bottom progress indicator and call-to-action (CTA) area spacing.

## Verification Plan

### 1. Visual Verification (Playwright)
- Capture screenshots of Section 2 at different viewport sizes (Desktop, Tablet, Mobile) to ensure the spacing looks intentional and balanced.
- Verify that the card stack transitions smoothly without overlapping the header or footer elements.

### 2. Code Quality
- Run `bun tsgo` to ensure no type errors are introduced.
- Verify syntax and accessibility (ARIA labels).
