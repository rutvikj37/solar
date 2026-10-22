# Plan - Update Steps 3 and 4 of Lead Form

Update the existing 4-step lead form to refine the property and solar needs questions.

## Proposed Changes

### 1. `src/components/solar/LeadForm/Step3Home.tsx`
- Replace current home questions with:
    1. "Do you own this home?" (Yes/No chips).
    2. "What type of roof do you have?" (Visual selection cards for 8 options: Asphalt Shingle, Metal, Tile, Flat, Wood Shake, Slate, Other, Not Sure).
- Improve visual styling of roof cards for premium look and mobile tapability.

### 2. `src/components/solar/LeadForm/Step4Solar.tsx`
- Replace the monthly bill dropdown with a premium interactive slider.
- Range: $50 to $1000+ in $50 increments.
- Prominent display of selected amount (e.g., "$250 / month").
- Maintain other Step 4 questions (Existing Solar, Timeline, Main Goal) as per the overall feature request logic (though current file was a stub, I will expand it to match the requested state while adding the slider).

## Technical Details
- Use `framer-motion` for slider interactions or a custom styled `<input type="range">`.
- Ensure dark navy background and cyan accents are consistent.
- Mobile-first spacing and touch targets (44px min).

## Verification Plan
- Verify Step 3 displays the two new questions with correct options.
- Verify Step 4 shows the interactive slider and correctly updates the state.
- Check responsive behavior at 390px.
