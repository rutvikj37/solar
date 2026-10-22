# Plan: Rebuild Section 2 — Cinematic Horizontal Card Stack

I will rebuild Section 2 (Process Stack) from scratch to strictly follow the new "Cinematic Horizontal Card Stack" requirements. The existing placeholder `ProcessStack.tsx` will be completely replaced with a high-fidelity implementation featuring photorealistic imagery, AI overlays, and 3D stack physics.

## Technical Details

-   **Component**: `src/components/solar/ProcessStack.tsx` (Complete rewrite)
-   **Structure**:
    -   **Section Heading**: Eyebrow ("HOW IT WORKS"), Main ("From Your Home to the Right Solar Installer."), Sub ("One simple process. Powered by SolarXAI.").
    -   **Sticky Viewport**: 100vh sticky container within a 140vh scrollable section.
    -   **Card Physics**:
        -   Active: `scale: 1, opacity: 1, rotate: 0deg`
        -   Previous: `scale: 0.82, opacity: 0.45, rotate: -4deg, x: -100%`
        -   Next: `scale: 0.82, opacity: 0.45, rotate: 4deg, x: 100%`
-   **Card Contents**:
    -   **Card 01 (Your Home)**: Photorealistic U.S. neighborhood aerial view, pulsing location marker, "PROPERTY FOUND" chip.
    -   **Card 02 (AI Analysis)**: Photorealistic roof view with AI scan lines, technical markers, and "Solar Potential" data labels.
    -   **Card 03 (Solar Report)**: Glass report UI with ROI, System Size (9.4 kW), and score counters.
    -   **Card 04 (Qualified Installer)**: Marketplace matching visualization with profile chips and a "Best Fit" selection animation.
-   **Footer**: Minimal progress dots (01-04) and a final CTA.

## Files to Modify

1.  `src/components/solar/ProcessStack.tsx`: Complete rewrite with new logic and visuals.
2.  `src/routes/index.tsx`: (Already imports `ProcessStack`, no changes needed unless layout adjustments are required).
