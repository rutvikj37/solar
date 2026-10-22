# Plan - Remove "Do you currently have solar panels?" from Step 4

Remove the "Do you currently have solar panels?" question and its associated validation from Step 4 of the lead form.

## Proposed Changes

### 1. `src/components/solar/LeadForm/Step4Solar.tsx`
- Remove the `existingSolarOptions` constant.
- Remove the JSX block (lines 43-56) that renders the "Do you currently have solar panels?" question.
- Update the `disabled` condition on the final CTA (line 92) to no longer require `data.hasSolar`.

## Technical Details
- Minimal logic change to Step 4 component.
- No changes to other steps or files.

## Verification Plan
- Verify Step 4 no longer shows the solar panels question.
- Verify the "GET MY FREE SOLAR REPORT" button enables correctly based on the remaining questions (Timeline and Goal).
