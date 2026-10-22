# FAQ Section Implementation Plan

Add a premium FAQ section with 5 interactive accordion items between the "How It Works" and "Lead Form" sections.

## Proposed Changes

### 1. Component Creation
- **File**: `src/components/solar/FAQ.tsx`
- **Content**: A new functional component that renders the FAQ section.
- **Features**:
  - Heading: "Questions? We've Got Answers."
  - Subheading: "Everything you need to know about SolarXAI and your free solar analysis."
  - 5 Accordion items as specified in the requirements.
  - Interactive logic to allow only one expanded item at a time.
  - Premium dark theme design using existing `glass-card` and `navy-dark` tokens.
  - Cyan accent for active questions.
  - Smooth animations using Framer Motion.
  - Mobile-first responsive layout.

### 2. Integration
- **File**: `src/routes/index.tsx`
- **Action**: Import `FAQ` and place it between `<HowItWorks />` and `<LeadForm />`.

## Verification Plan

### Automated Tests
- **Check**: Use Playwright to verify that only one FAQ item can be expanded at a time.
- **Visual**: Verify the cyan accent appears on the active item.
- **Responsive**: Check mobile and desktop layouts.

### Manual Checks
- Verify syntax and imports.
- Confirm build succeeds.
- Ensure no regressions in Hero or HowItWorks sections.
