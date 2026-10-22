# Plan: Brand CTA Style Update

Update the "Get My Free Report" CTA buttons throughout the app to use the brand blue (cyan-500) color with consistent hover effects.

## Proposed Changes

### `src/components/solar/Navbar.tsx`
- Update the "Get My Free Report" button classes:
  - Change `bg-white/5 border border-white/10` to `bg-cyan-500 text-navy-dark border-transparent`.
  - Update hover states: `hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]`.

### `src/components/solar/Footer.tsx`
- Update the "Check Your Solar Potential" link in the CTA section:
  - Add `bg-cyan-500 text-navy-dark px-6 py-2.5 rounded-full` to make it look like a button rather than just text.
  - Apply brand hover effects.

### `src/components/solar/AboutPage.tsx` & `src/components/solar/ContactPage.tsx`
- Both already use `bg-cyan-500` for the final CTA button, but I will ensure the classes and hover effects are consistent with the new Navbar button style.

## Verification Plan

### Automated Tests
- Use Playwright to:
  - Navigate to the home page.
  - Verify the Navbar CTA has the `bg-cyan-500` class.
  - Verify the Footer CTA has consistent styling.
  - Check the About and Contact pages for CTA consistency.

### Manual Verification
- Visually confirm the button looks "brand blue" (cyan) and has the expected hover expansion/glow.
