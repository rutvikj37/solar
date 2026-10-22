# Plan - SolarXAI Post-Submit Experience

Implement a premium AI property scan loader and a personalized solar report that appears after the lead form is submitted.

## Proposed Changes

### Lead Form Orchestration
- **src/components/solar/LeadForm/LeadForm.tsx**
    - Add new states: `isAnalyzing` and `showReport`.
    - Update `onSubmit` handler in `Step4Solar` to trigger the analysis sequence.
    - Conditionally render the `AnalysisLoader` and `SolarReport` components.

### New Components
- **src/components/solar/LeadForm/AnalysisLoader.tsx**
    - Create a cinematic 2-3 second full-screen sequence.
    - Animation phases: Satellite view -> U.S. city -> Neighborhood zoom -> Property identification -> Roof scan.
    - Dynamic text labels: "Analyzing Your Home", "Locating Your Property", etc.
    - Reuse realistic satellite assets/concepts from Step 2 if applicable.

- **src/components/solar/LeadForm/SolarReport.tsx**
    - Create a premium, scrollable property report.
    - **Section 01: Solar Score** - Calculate a dynamic score (e.g., based on roof type, bill amount, location data).
    - **Section 02: Property AI Analysis** - Display a mock aerial view with scanning overlays.
    - **Section 03: Solar Potential** - Estimated system size, panels, and annual production.
    - **Section 04: Electricity & Savings** - Financial breakdown based on the user's monthly bill.
    - **Section 05-07**: Insights, local info, and cost of waiting comparison.
    - **Final CTA**: "GET MATCHED WITH A QUALIFIED SOLAR INSTALLER".

### Styles
- **src/styles.css**
    - Add specific animations for the report (fade-ins, bar charts, scanning pulses).
    - Ensure premium glass-navy styling for the report sections.

## Technical Details
- Use `framer-motion` for all transitions and cinematic effects.
- Ensure the report is fully responsive (mobile-first).
- Use props from `formData` to personalize the values (address, bill, ownership).
- Implement logical "empty states" or estimates if specific data is missing.

## Verification Plan
- Manually test the form submission flow.
- Verify the 3s loader sequence timing and visuals.
- Check the report's layout and calculation logic for different bill amounts.
- Test responsiveness on mobile viewports.
