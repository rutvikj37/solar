# Plan - Remove Solar Report Menu Item

I will remove the "Solar Report" link from the header navigation menu while keeping the "Get My Free Report" CTA button intact.

## Proposed Changes

### `src/components/solar/Navbar.tsx`
- Remove the `"Solar Report"` item from the desktop navigation array.

## Verification Plan

### Automated Tests
- Run a Playwright script to verify:
  - The "Solar Report" link is no longer present in the navigation bar.
  - "How It Works", "About Us", and "FAQ" remain visible.
  - The "Get My Free Report" button remains functional and visible.
  - The build is successful.
