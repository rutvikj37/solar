# Plan - Create "About Us" Page

I will create a premium "About Us" page for SolarXAI, following the existing visual style, and update the navigation in the header and footer to link to this new page.

## Proposed Changes

### New Component: `src/components/solar/AboutPage.tsx`
- Implement the "About Us" page content:
    - **Hero Section**: Eyebrow "ABOUT SOLARXAI", headline "Smarter Solar Starts With Knowing Your Home.", and subtext.
    - **Mission Section**: "Make Solar Decisions Simpler." with descriptive text.
    - **How We Help Section**: 3 compact cards (Analyze, Understand, Connect).
    - **Final CTA**: "Discover What Your Home Could Do With Solar." with "Get My Free Solar Report →" button.
- Use Framer Motion for subtle scroll animations.

### New Route: `src/routes/about.tsx`
- Create a new route for the "About Us" page.
- Integrate `Navbar`, `AboutPage`, and `Footer`.

### Navigation Updates
- **`src/components/solar/Navbar.tsx`**: Update the "About Us" link to point to `/about`.
- **`src/components/solar/Footer.tsx`**: Update the "About SolarXAI" link to point to `/about` and "Home" to point to `/`.

## Verification Plan

### Automated Tests
- Run a Playwright script to verify:
    - The new `/about` route loads correctly.
    - All sections (Hero, Mission, How We Help, CTA) are visible with correct text.
    - The "About Us" link in the navbar navigates to the About page.
    - The "About SolarXAI" link in the footer navigates to the About page.
    - Responsive layout (cards stack on mobile).
    - No build errors.
