# Plan: Redesign Section 2 - Simple 3-Step Process

I will redesign Section 2 to be a clean, premium, scroll-driven journey that explains the SolarXAI process in 3 simple steps. I will replace the existing complex components with a streamlined two-column sticky layout.

## 1. Clean Up Existing Components
*   Remove `JourneyText.tsx` and `JourneyVisuals.tsx`.
*   Consolidate logic into `JourneySection.tsx` to simplify the structure and maintain fine-grained scroll control without WAAPI issues.

## 2. Redesign `JourneySection.tsx`
*   **Layout**: 250vh-300vh tall container with a `100vh` sticky inner wrapper.
*   **Two-Column Split**: Left side for text content and step navigation; Right side for the cinematic visual journey.
*   **Step Navigation**: Vertically stacked indicators (01, 02, 03) with active states (cyan number, white title, vertical accent).
*   **Visual Journey (Right Side)**:
    *   **Step 1**: Aerial neighborhood view with location marker and "Property Found" address card.
    *   **Step 2**: Zoomed-in roof view with AI scan overlays and 3 simple data points (Sun Exposure, Roof Potential, Solar Potential).
    *   **Step 3**: Match confirmation UI showing "Matched for your project" with a qualified installer.

## 3. Styling & Animations
*   **Scroll-Driven**: Use `useScroll` and `useTransform` (manually mapped to state to avoid WAAPI range errors) to control opacity, scale, and transitions.
*   **Visual Style**: Deep navy background, white typography, cyan accents, and realistic imagery.
*   **Mobile Support**: Stack the content vertically, ensuring animations still respond to scroll and text remains legible.

## 4. Final Polish
*   Add a minimal progress indicator at the bottom (01 — 02 — 03).
*   Ensure all data cards and overlays use a refined "glass" aesthetic matching the hero section.

## Verification Plan
*   **Desktop**: Check that the sticky container holds for the duration of the 3-step sequence and transitions are smooth.
*   **Mobile**: Verify the vertical flow and responsiveness.
*   **Performance**: Ensure manual scroll mapping remains performant and doesn't trigger console errors.
