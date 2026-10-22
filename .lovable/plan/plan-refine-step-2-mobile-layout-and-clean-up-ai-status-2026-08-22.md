# Plan: Refine Step 2 Mobile Layout and Clean up AI Status

Modify the Step 2 "Satellite AI Scan" visual in `src/components/solar/HowItWorks.tsx` to optimize for mobile view and remove unnecessary status text.

## User Review Required

> [!IMPORTANT]
> - AI Data Chips on mobile will be smaller and positioned at the corners (top-right, bottom-right, bottom-left) to keep the roof visual clear.
> - The AI status list ("Boundary Detection", etc.) will be removed from both mobile and desktop views to simplify the UI.

## Technical Details

### `src/components/solar/HowItWorks.tsx`

- **Remove AI Status Text block**:
    - Delete lines ~542-557 (the `motion.div` containing "Boundary Detection", "Azimuth Calculation", and "Obstruction Mapping").
- **Refactor Data Chips for Mobile**:
    - Change the container of the data chips (stage 6) from a centered grid to a full-size absolute container.
    - Apply conditional positioning for mobile:
        - **Sun Exposure**: `top-4 right-4`
        - **Roof Suitability**: `bottom-4 right-4`
        - **Solar Potential**: `bottom-4 left-4`
    - Keep the existing `sm:grid sm:grid-cols-3` behavior for desktop (tablet and up).
    - Reduce internal padding, icon sizes, and font sizes specifically for mobile screens.
- **Visual Polish**:
    - Ensure `z-index` management keeps the chips above the scan visuals but not interfering with the overall feel.

## Verification Plan

- **Automated Tests**:
    - Use Playwright to check Step 2 at 390px (iPhone 12/13) and 430px (iPhone 14/15 Pro Max) widths.
    - Verify that "Boundary Detection" is NOT visible in the DOM.
    - Verify that the three data chips are present and positioned as requested (check `top`, `bottom`, `left`, `right` properties via `boundingBox`).
    - Take screenshots of the mobile results stage to ensure the roof center is clear.
- **Manual Verification**:
    - Check the transition from desktop to mobile in the preview.
