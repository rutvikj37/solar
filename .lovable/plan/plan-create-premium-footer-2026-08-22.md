# Plan - Create Premium Footer

I will create a premium, minimal dark footer for the SolarXAI website that matches the existing theme and provides essential links and disclaimers.

## Proposed Changes

### New Component: `src/components/solar/Footer.tsx`
- Implement a responsive footer with:
    - **Left section**: Logo, tagline, and descriptive text.
    - **Center section**: "Quick Links" (Home, How It Works, Solar Report, FAQs).
    - **Right section**: "Company" links (About SolarXAI, Contact, Privacy Policy, Terms & Conditions) and a "Check Your Solar Potential" CTA.
    - **Bottom section**: Copyright notice and informational disclaimer.
- Use the dark navy theme with cyan hover effects and a subtle top glow/border.

### `src/routes/index.tsx`
- Import and add the `Footer` component at the bottom of the `main` layout.

## Verification Plan

### Automated Tests
- Run a Playwright script to verify:
    - The footer is present at the bottom of the page.
    - All required text (tagline, disclaimer, copyright) is visible.
    - All links exist and have the correct text.
    - Responsive layout (links stack correctly on mobile).
    - No build errors.
