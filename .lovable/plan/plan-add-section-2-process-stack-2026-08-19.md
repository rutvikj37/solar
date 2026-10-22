# Plan: Add Section 2 (Process Stack)

I will re-implement the "Process Stack" (Section 2) for SolarXAI. This section features a horizontal card-stack interaction that reveals the 4-step journey: Your Home, AI Analysis, Solar Report, and Qualified Installer.

## Technical Details

- **Component**: `src/components/solar/ProcessStack.tsx`
- **Interaction**: 
    - 260svh container with sticky 100svh viewport.
    - Scroll progress (0-1) maps to active card index (0-3).
    - 3D Physics: Active card is focused, previous card shifts left and back, next card shifts right and back.
- **Visuals**:
    - **Step 1 (Your Home)**: Aerial neighborhood view with pulsing target.
    - **Step 2 (AI Analysis)**: Roof scan with data overlays.
    - **Step 3 (Report)**: Glass-style solar report with ROI and production charts.
    - **Step 4 (Installer)**: Marketplace matching visualization.
- **Assets**: Reuses `neighborhood-aerial.jpg` and `roof-aerial.jpg`.

## Files to Modify

1.  `src/components/solar/ProcessStack.tsx` (Create): The main component for Section 2.
2.  `src/routes/index.tsx` (Update): Import and render `ProcessStack` below `SolarHero`.
