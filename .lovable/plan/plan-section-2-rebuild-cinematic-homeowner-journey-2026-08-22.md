# Plan: Section 2 Rebuild — Cinematic Homeowner Journey

I will rebuild Section 2 to match the "SolarXAI" visual blueprint exactly, replacing the generic "How It Works" with three premium, high-density story panels stacked vertically.

## User Review Required

> [!IMPORTANT]
> - I will use the photorealistic `/roof-aerial.jpg` for Step 02 as requested.
> - I will implement the exact navy-dark, glass-morphism aesthetic from the reference mockup.
> - Step 03 will focus on the "Qualified Match" single-installer selection logic.

- **Step 01**: Large smartphone mockup with 3-step form progress.
- **Step 02**: Realistic suburban aerial scan with SVG overlays and 3 floating data chips.
- **Step 03**: Installer matching UI with AI-driven filtering and a single "SolarPro Solutions" highlight.
- **Physics**: Vertical stacking with subtle "01 -> 02 -> 03" connectors.

## Proposed Changes

### Section 2 Components
#### [NEW] `src/components/solar/HowItWorks.tsx` (Rewrite)
- **Header**: Large typography, "Right Solar Installer." in cyan, subtitle.
- **Panel 01 (Form)**:
  - Left: "01", Title, Text, Bullet points.
  - Right: Realistic phone mock (STEP 1 OF 3, address/type/roof inputs, CTA).
  - Animation: Phone slides in, fields fade in.
- **Panel 02 (AI Analysis)**:
  - Left: "02", Title, Text.
  - Right: Satellite property image, zoom effect, SVG scan line, 3 floating data cards (Sun Exposure, Roof Suitability, Solar Potential).
  - Animation: Sweep scan, zoom, data card sequence.
- **Panel 03 (Matching)**:
  - Left: "03", Title, Text.
  - Right: Matching visualization (5-7 installers), filtering animation, "QUALIFIED MATCH" highlight.
  - Animation: Pulse match, installer highlight.

### Styling & Integration
#### `src/styles.css`
- Ensure `.glass-card` and navy tokens are properly defined for high-density visual panels.

#### `src/routes/index.tsx`
- Ensure it renders the new `HowItWorks` component correctly.

## Verification Plan

### Automated Tests
- Run Playwright to check:
  - Desktop: Each panel has 40/60 split, visuals are dominant.
  - Mobile: Panels stack correctly, 16px margins, visuals remain legible.
  - Animations: Verify scan lines and highlight logic triggers in viewport.

### Manual Verification
- Check visual fidelity against the requested "premium dark navy" aesthetic.
- Verify "Qualified Match" logic message matches the request.
