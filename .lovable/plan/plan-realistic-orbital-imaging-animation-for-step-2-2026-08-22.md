# Plan: Realistic Orbital Imaging Animation for Step 2

We will replace the cartoonish satellite visual in Section 2 Step 2 with a realistic, cinematic orbital imaging sequence.

## Proposed Changes

### 1. `src/components/solar/HowItWorks.tsx`
- **SatelliteVisual Component**:
    - Overhaul the animation sequence to match the 6 stages:
        1. **Space Start**: Realistic satellite far above Earth.
        2. **Earth Approach**: Smooth orbital imaging motion.
        3. **City View**: Transition to high-altitude aerial view (`city-aerial-wide.jpg`).
        4. **Neighborhood Scan**: Zoom into `neighborhood-aerial.jpg` with a subtle search beam.
        5. **Property Detection**: Identify target home (`roof-aerial.jpg`) with a "PROPERTY DETECTED" marker.
        6. **AI Roof Scan**: Detailed AI analysis (existing cyan overlays).
    - Refine `stage` timing and transitions for cinematic feel.
    - Adjust `motion.div` layers for seamless zoom/travel effect.
- **SatelliteSVG Component**:
    - Replace the current SVG with a more realistic, photorealistic-style satellite representation.
    - Use metallic gradients, realistic solar panels, and natural lighting.
- **UI Elements**:
    - Update "Orbital Scan Active" / "Target Acquisition" badges to be more subtle and professional.
    - Refine the "Property Detected" marker.

## Verification Plan

### 1. Visual Inspection (Manual)
- Check that the satellite looks realistic and metallic.
- Verify the zoom transitions are smooth and feel like a single camera movement.
- Ensure the property scan remains clear on both desktop and mobile.

### 2. Automated Tests (Playwright)
- `check_step2_animation.py`:
    - Launch browser.
    - Scroll to Step 2.
    - Capture screenshots at intervals representing each stage (Space, City, Neighborhood, Property, Scan).
    - Verify no layout breakages or overlapping elements.
