# Animation Updates for Section 2 (How It Works)

I will enhance the animations in Section 2 to be more cinematic and conversion-focused, following the exact sequences requested while maintaining the current design, layout, and copy.

## Proposed Changes

### 1. `src/components/solar/HowItWorks.tsx`

#### Step 1: PhoneVisual Typing Animation
- Implement a `useInView` triggered typing sequence.
- **Sequence**:
  1. Typing "1042 Cedar Ridge Dr, Phoenix, AZ" in the address field (with blinking cursor).
  2. "Single Family Home" appearing in Property Type.
  3. "Shingle" appearing in Roof Type.
- Add a subtle cyan glow effect to the "Get My Free Report" button once fields are filled.

#### Step 2: SatelliteVisual AI Analysis Animation
- Add a subtle orbital/satellite indicator at the top of the visual.
- Add scanning rays that travel from the satellite toward the roof.
- When the scan reaches the roof:
  - Activate the roof boundary with detection points.
  - Run an AI scan line across the roof surface.
- Update data chips to reveal in this sequence:
  1. "Roof Detected"
  2. "Sun Exposure Analyzed"
  3. "Roof Suitability"
  4. "Solar Potential" (final value: 92/100).

#### Step 3: InstallerVisual Matching Animation
- Implement a fast cycling animation that simulates searching through 10+ profiles.
- After ~1.5 seconds of cycling, stop and highlight "SolarPro Solutions" as the best match.
- Apply a cyan/emerald glow to the selected installer card.
- Add a "✓ QUALIFIED MATCH" label to the highlighted installer.
- Mute (reduce opacity) of other installers once the match is found.

### 2. `src/styles.css` (Optional)
- Add any necessary CSS keyframes for the blinking cursor or specific glow effects if Framer Motion isn't sufficient.

## Constraints Check
- **Layout**: NO changes.
- **Card sizes**: NO changes.
- **Typography/Colors/Images**: NO changes.
- **CTA/Text/Spacing**: NO changes.
- **Animations**: Will be automatic, smooth, premium, and non-looping.
