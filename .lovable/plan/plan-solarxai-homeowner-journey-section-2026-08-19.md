# Plan: SolarXAI Homeowner Journey Section

Create a cinematic, scroll-driven interactive section ("Section 2") that explains the SolarXAI process in three steps: Your Home, AI Analysis, and Qualified Installer Match.

## Visual Direction
- **Style**: Premium, cinematic, deep navy background, cyan accents, glass UI components.
- **Visuals**: Realistic aerial/satellite imagery of U.S. neighborhoods and houses with sophisticated AI overlays.
- **Interaction**: 300vh scroll container with a 100vh sticky viewport. Animations are strictly driven by the user's scroll position.

## Proposed Changes

### Styles
#### [src/styles.css]
- Add utilities for the journey section:
  - `.journey-sticky-container`: 100vh viewport height.
  - `.step-indicator`: Vertical indicator for 01, 02, 03.
  - `.search-highlight-pulse`: For the property search effect.
  - `.ai-scan-overlay`: Refined scan lines and segmentation effects.

### Components
#### [src/components/solar/journey/JourneySection.tsx] (New)
- Main orchestrator for Section 2.
- Uses `framer-motion`'s `useScroll` and `useTransform` to bind scroll progress to animation states.
- Grid layout: 40% (Text/UI) | 60% (Visuals).

#### [src/components/solar/journey/JourneyVisuals.tsx] (New)
- Handles the realistic imagery and AI overlays.
- Manages the "camera" zoom from neighborhood to house to roof.
- Implements the AI scanning sequence and the installer match interface.

#### [src/components/solar/journey/JourneyText.tsx] (New)
- Manages the step titles, descriptions, and supporting UI (Address search, AI data labels).

### Integration
#### [src/routes/index.tsx]
- Import and mount `JourneySection` below `SolarHero`.

## Technical Details
- **Scroll Binding**: Progress mapping (0-0.33: Step 1, 0.33-0.66: Step 2, 0.66-1.0: Step 3) using interpolated values for smooth transitions.
- **Imagery**: Use high-quality realistic aerial placeholder images for U.S. neighborhoods and houses.
- **AI Scanning**: SVG-based scanning effects (lines, segments, data points) overlaid on top of the house image.
- **Performance**: Use hardware-accelerated transforms and opacities. Lazy load images if necessary.
