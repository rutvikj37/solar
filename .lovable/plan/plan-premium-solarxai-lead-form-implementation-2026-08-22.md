# Plan - Premium SolarXAI Lead Form Implementation

Create a premium 4-step, mobile-first lead form for SolarXAI that replaces the generic lead capture flow. The form will be designed for high conversion, brand consistency, and a personalized assessment feel.

## Proposed Changes

### 1. New Components
- **`src/components/solar/LeadForm/LeadForm.tsx`**: The main orchestrator for the multi-step form.
- **`src/components/solar/LeadForm/Step1AboutYou.tsx`**: Personal details (Name, Email, Mobile).
- **`src/components/solar/LeadForm/Step2Property.tsx`**: Address with Google Autocomplete, compact map, and ownership status.
- **`src/components/solar/LeadForm/Step3Home.tsx`**: Roof details (Type, Age, Shade) using visual chips.
- **`src/components/solar/LeadForm/Step4Solar.tsx`**: Energy needs (Bill, Existing Solar, Timeline, Goal).
- **`src/components/solar/LeadForm/FormHeader.tsx`**: Eyebrow, Heading, Subheading, and Step Progress Indicator.

### 2. Styling
- **`src/styles.css`**: Add specific utility classes for the lead form (e.g., `glass-form-container`, `selection-chip-active`, etc.).

### 3. Integration
- **`src/routes/index.tsx`**: Integrate the `LeadForm` section. I'll need to decide where to place it; usually, it replaces the CTA-driven hero goal or appears as a dedicated section. The prompt says "CREATE THE SOLARXAI LEAD FORM... Do not change the rest of the landing page." I will add it as a new section or a modal/overlay triggered by the hero buttons, or replace a placeholder if one exists.
- **`src/components/solar/SolarHero.tsx`**: Update the "Calculate My Solar Savings" button to scroll to or open the lead form.

## Technical Details
- **Framework**: React 19, TanStack Start.
- **State Management**: React `useState` for form data and current step.
- **Animations**: `framer-motion` for horizontal slides and fades (250-350ms).
- **Validation**: Zod or simple custom validation with inline error messages.
- **Map**: Use `lucide-react` for icons and a simplified map UI if Google Maps API isn't immediately configured, but structured for easy integration. I'll implement a functional mock for the map pin dragging if necessary.
- **Responsive**: Mobile-first design (390px/430px) with 16px horizontal padding and 44px minimum touch targets.

## User Review Required
- **Map Integration**: Do you have a Google Maps API key ready, or should I implement the UI with a placeholder map for now?
- **Form Placement**: Should the form be a dedicated section below the hero, or should it open in a full-screen mobile-optimized modal when the hero CTA is clicked?
