# Plan - Remove "What is your main goal?" from Step 4

Remove the "What is your main goal?" question and its associated validation from Step 4 of the lead form.

## Proposed Changes

### 1. `src/components/solar/LeadForm/Step4Solar.tsx`
- Remove the `goalOptions` constant.
- Remove the JSX block (lines 59-72) that renders the "What is your main goal?" question.
- Update the `disabled` condition on the final CTA (line 78) to no longer require `data.goal`.

## Technical Details
- Minimal logic change to Step 4 component.
- No changes to other steps or files.

## Verification Plan
- Verify Step 4 no longer shows the goal question.
- Verify the "GET MY FREE SOLAR REPORT" button enables correctly based on the remaining question (Timeline).
