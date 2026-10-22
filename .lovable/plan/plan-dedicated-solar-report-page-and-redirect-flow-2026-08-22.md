# Plan: Dedicated Solar Report Page and Redirect Flow

I will implement a dedicated report page at `/solar-report` and update the `LeadForm` submission flow to navigate to this new page after the AI analysis loader finishes.

## Proposed Changes

### 1. Create `src/lib/report-store.ts`
- Implement a simple state store to persist `formData` between navigation. Since this is a client-side only app and the data doesn't need to persist across sessions, a simple module-level variable with an exporter/importer or a custom hook will suffice.

### 2. Create `src/routes/solar-report.tsx`
- Define the `/solar-report` route.
- Retrieve the data from the store.
- Render the `SolarReport` component (or its refined version).
- Implement the "← Back to Home" button that navigates back to `/`.
- Add SEO head metadata.

### 3. Update `src/components/solar/LeadForm/LeadForm.tsx`
- Import `useNavigate` from `@tanstack/react-router`.
- Update `onComplete` in `AnalysisLoader` to save the `formData` to the store and then navigate to `/solar-report`.
- Remove the local `showReport` state and its conditional rendering.

### 4. Update `src/components/solar/LeadForm/SolarReport.tsx`
- Remove existing CTAs at the bottom.
- Add the "← Back to Home" button.
- Ensure the header exactly matches the request: "YOUR SOLARXAI PROPERTY REPORT", "[Property Address]", "[Main Solar Score]".

## Verification Plan

### Automated Tests
- Run build verification.
- Use Playwright to:
  1. Fill out the form.
  2. Verify the `AnalysisLoader` appears.
  3. Verify the redirection to `/solar-report` happens.
  4. Verify the report page contains the correct data and the "Back to Home" button.
  5. Verify "Back to Home" returns the user to the landing page.

### Manual Verification
- Test the full flow in the preview browser.
- Check responsiveness on mobile viewport.
