# Plan: Refine Step 2 Animation Loop

Modify the Step 2 "Satellite AI Scan" animation in `src/components/solar/HowItWorks.tsx` to be a continuous loop triggered by viewport visibility.

## User Review Required

> [!NOTE]
> The animation will now start automatically when the "How It Works" Step 2 section is 50% visible in the viewport. It will loop continuously (City -> Neighborhood -> Home -> Scan -> Results -> Reset) as long as it remains visible.

## Technical Details

### `src/components/solar/HowItWorks.tsx`

- **Update `SatelliteVisual` intersection observer**:
    - Change `useInView` configuration to `{ once: false, amount: 0.5 }`.
- **Implement Looping Logic**:
    - Refactor the `useEffect` hook to use an `async` loop that runs as long as `isInView` is true.
    - Add safety checks (`isActive` flag) to prevent memory leaks and ensure the loop stops when the component unmounts or leaves the viewport.
    - Ensure `stage` resets to `0` when leaving the viewport or finishing a cycle.
- **Animation Sequence Retiming**:
    - Adjust the `sequence` function to handle a full cycle and then reset smoothly.
    - Ensure `AnimatePresence` and `motion` components handle the transition from stage 6 back to stage 0 appropriately.
    - Specifically, ensure the "Final Results" cards are visible for a reasonable duration (e.g., 3-4 seconds) before the loop restarts.

## Verification Plan

- **Automated Tests**:
    - Use Playwright to scroll to Step 2.
    - Verify that the animation starts (stage 1+).
    - Verify that after the sequence finishes (reaching results), it eventually resets back to the initial city view (stage 0).
    - Verify that scrolling away stops the animation and resets the stage.
- **Manual Verification**:
    - Observe the "smoothness" of the reset transition.
    - Confirm the 50% visibility trigger feels natural.
