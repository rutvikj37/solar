# Plan: SolarXAI Hero Redesign & Visual Polish

Redesign the SolarXAI hero section to achieve a premium, professionally art-directed visual style with seamless image blending, a cause-and-effect sunlight animation, and refined UI components.

## Proposed Changes

### 1. Global Styles & Design Tokens (`src/styles.css`)
- Refine `oklch` tokens for navy and cyan to match a premium palette.
- Update `.glass-card` and `.glass-navy` for better contrast (85-92% opacity as requested).
- Add new animation keyframes for realistic sunlight sweeps and AI scanning effects.
- Add utility for the complex gradient mask to blend the house image into the navy background.

### 2. UI Components Redesign
- **Navbar (`src/components/solar/Navbar.tsx`)**: Refine height, spacing, and glass effect.
- **Data Cards (`src/components/solar/DataCard.tsx`)**:
  - Increase background opacity for readability.
  - Refine typography hierarchy (small uppercase labels, large bold values).
  - Add icons and "AI ANALYSIS" technical labels.
  - Implement sequential activation logic with "Analyzing..." states.
- **Installer Match Card**: Redesign as a compact dark glass card with a shield icon.

### 3. Visual & Animation Overhaul (`src/components/solar/HouseVisual.tsx`)
- **Image Blending**: Apply a multi-directional gradient mask so the house image fades naturally into the navy environment on the left and bottom.
- **Sunlight Animation**:
  - Implement a warm sunlight glow appearing from the upper-right.
  - Add realistic light rays moving toward the solar panels.
  - Synchronize panel brightness and glint with the arrival of sunlight.
- **AI Roof Scan**:
  - Create a sophisticated computer-vision overlay aligned with the roof geometry.
  - Add scanning beams, technical markers, and boundary pulses.
- **Connection Lines**: Implement thin, elegant technical lines that illuminate as their corresponding cards activate.

### 4. Hero Orchestration (`src/components/solar/SolarHero.tsx`)
- Adjust layout to 42%/58% split.
- Ensure 100vh height and generous padding.
- Synchronize the 6-stage cause-and-effect sequence:
  1. Home Appears
  2. Sunlight Glow
  3. Rays & Reflection
  4. AI Activation
  5. Energy Flow & Data Initialization
  6. Final Data Results
- Maintain subtle ambient animations (floating cards, slow sun movement) after the initial sequence.

### 5. Responsive Optimization
- Ensure the house remains large on mobile, stacking content vertically.
- Reposition data cards for mobile to avoid overlap, placing them below the image if necessary.

## Technical Details
- **Framer Motion**: Used for all complex sequencing and state-based transitions.
- **Tailwind CSS v4**: Used for layout, glass effects, and gradient masking.
- **SVG Overlays**: Used for precise AI detection markers and energy lines to ensure they scale perfectly with the photorealistic image.
