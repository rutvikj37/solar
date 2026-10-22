# Plan: SolarXAI Hero Refinement

Refining the hero section to improve font scaling, component sizing, and overall composition to ensure all elements fit perfectly in a single desktop frame while maintaining premium readability.

## Proposed Changes

### Styling & Typography
- **`src/styles.css`**: 
    - Adjust fluid typography scales for hero elements.
    - Reduce base font sizes for the "glass-card" component.
    - Add utilities for compact layouts if needed.

### Component Refinement
- **`src/components/solar/DataCard.tsx`**:
    - Reduce card width and padding to make them more compact.
    - Scale down icons and text sizes.
- **`src/components/solar/SolarHero.tsx`**:
    - Scale down the main headline (H1) and description font sizes.
    - Adjust the layout grid and spacing to be more compact.
    - Reposition floating data cards to ensure they stay well within the viewport.
    - Reduce vertical padding in the content section.
- **`src/components/solar/Navbar.tsx`**:
    - Slightly reduce vertical padding for a tighter top navigation.

### Technical Details
- Use `text-4xl lg:text-6xl` instead of `text-5xl lg:text-7xl` for the H1.
- Reduce description font size from `text-xl` to `text-lg`.
- Change `DataCard` width from `w-52` to `w-44`.
- Adjust absolute positioning of cards in `SolarHero.tsx` to use percentages that prevent overflow on smaller desktop screens.
- Implement more responsive vertical padding (`py-12` instead of `py-20`).
