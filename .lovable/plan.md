# Plan: Mobile Header and Sticky CTA

Fix mobile view header by adding a hamburger menu, moving the "Get My Free Report" CTA to a sticky bottom bar on mobile, and including all navigation options (including the CTA) within the hamburger menu.

## User Review Required

> [!IMPORTANT]
> - The header CTA button will be hidden on mobile screens and replaced by a hamburger icon.
> - A sticky bottom bar will appear on mobile to keep the "Get My Free Report" CTA accessible.
> - The hamburger menu will provide access to "How It Works", "About Us", "FAQ", "Contact Us", and "Get My Free Report".

## Proposed Changes

### Navigation Components

#### [src/components/solar/Navbar.tsx]
- Add state for mobile menu toggle.
- Add `Menu` and `X` icons from `lucide-react`.
- Hide the desktop CTA button on mobile (`hidden md:flex`).
- Add a hamburger button visible only on mobile.
- Implement a slide-down mobile menu containing all links.
- Create a sticky bottom CTA bar visible only on mobile screens.

## Technical Details
- Use `framer-motion` for the mobile menu animation to ensure a premium feel.
- Ensure the sticky bottom bar has a `glass-navy` effect to match the site's aesthetic.
- Add padding to the bottom of the body (via the root or a wrapper) on mobile to prevent the sticky bar from covering content.

## Verification Plan
- **Manual Verification**:
    - Open the site in mobile view.
    - Confirm the header CTA is gone and replaced by a hamburger icon.
    - Confirm a sticky "Get My Free Report" button appears at the bottom.
    - Open the hamburger menu and verify all links (including the CTA) are present and functional.
    - Verify desktop view remains unchanged (except for the brand blue button updates already performed).
- **Automated Verification**:
    - Use Playwright to check visibility of elements at different breakpoints (`width: 375` for mobile, `width: 1280` for desktop).
