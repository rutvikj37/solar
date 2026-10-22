# Plan: Contact Us Page

Create a premium, responsive "Contact Us" page for SolarXAI following the dark navy brand aesthetic.

## User Review Required

> [!IMPORTANT]
> The contact form will be a client-side simulation. "Sending" a message will show a success state but won't send a real email unless an email provider is connected.

## Proposed Changes

### Components & Routes

#### [NEW] `src/components/solar/ContactPage.tsx`
- Hero section with the specified eyebrow, headline, and subtext.
- Two-column layout on desktop:
  - **Left**: Contact details (Email, Phone, Address, Hours) with icons and premium cards.
  - **Right**: Contact form with the requested fields and a submission success state.
- Final CTA section linking to the lead form.
- Use `framer-motion` for smooth reveal animations.

#### [NEW] `src/routes/contact.tsx`
- New route to host the `ContactPage` component.
- Includes SEO metadata (head).

### Navigation Updates

#### `src/components/solar/Navbar.tsx`
- Update the desktop navigation array to include "Contact Us" linking to `/contact`.
- Ensure anchor links remain absolute (e.g., `/#faq`) to work from the contact page.

#### `src/components/solar/Footer.tsx`
- Link the "Contact" text in the Company column to `/contact`.

## Verification Plan

### Automated Tests
- Run Playwright to:
  - Verify `/contact` route loads.
  - Check visibility of hero text and contact cards.
  - Test form interaction: Fill fields and verify the "Success" message appears after clicking send.
  - Confirm Navbar and Footer links lead to the contact page and back to home.

### Manual Verification
- Check responsiveness on mobile (stacked layout).
- Verify the "Success" message styling and placement.
