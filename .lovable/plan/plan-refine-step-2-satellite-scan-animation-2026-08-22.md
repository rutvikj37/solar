# Plan - Refine Step 2 Satellite Scan Animation

Update ONLY the Step 2 visual and animation in `src/components/solar/HowItWorks.tsx` to feature a cinematic, orbital-to-home zoom sequence with realistic satellite imagery and AI scanning effects.

## Proposed Changes

### 1. `src/components/solar/HowItWorks.tsx`
- Rewrite the `SatelliteVisual` component to handle a multi-stage animation sequence.
- **Stage 1: Orbit/Space** - Show a realistic satellite firing a beam over a wide city aerial view.
- **Stage 2: City Scan** - The beam moves across the city imagery.
- **Stage 3: Cinematic Zoom** - Use layered imagery and `framer-motion` to smoothly zoom from City -> Neighborhood -> Selected Home.
- **Stage 4: Property Identification** - Reveal a "PROPERTY DETECTED" cyan marker.
- **Stage 5: Roof AI Scan** - Implement detailed roof boundary detection, segmentation, and scan lines using SVG overlays.
- **Stage 6: Result Reveal** - Stagger the appearance of the existing three data cards.
- Add a dedicated `Satellite` SVG component for realistic representation.
- Ensure all transitions are smooth and professional (not jumpy).
- Maintain responsiveness for mobile view.

### 2. Assets
- Use existing `neighborhood-aerial.jpg` and `roof-aerial.jpg`.
- Incorporate a realistic wide city view (e.g., from a high-quality source or simulating it with a scaled-down neighborhood view if no city asset is available, but I will look for one).

## Technical Details
- **Animation Engine**: `framer-motion` for sequence control (`AnimatePresence`, `useInView`, and variants).
- **Zoom Effect**: Layered images with increasing `scale` and decreasing `opacity` of the upper layer to create a "bottomless zoom" feel.
- **Scanning Overlays**: SVG paths for the roof boundary and scanning beams with gradient fills and glow filters.
- **Performance**: Optimize images and use CSS transforms for smooth 60fps animations.

## Verification Plan
- **Automated Tests**: Use Playwright to verify the 6-stage animation sequence timing and ensure all data cards eventually appear.
- **Visual Check**: Manually verify the zoom smoothness and realistic feel in the preview.
- **Mobile Check**: Verify the visual fits within the card on small screens and doesn't introduce horizontal scroll.
