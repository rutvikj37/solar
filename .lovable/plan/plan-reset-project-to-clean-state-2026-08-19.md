# Plan - Reset Project to Clean State

The user has requested to remove all visual modifications and features previously implemented (Solar Intelligence theme). I will reset the application to a clean landing page.

## Proposed Changes

### Clean up Content
- **src/routes/index.tsx**: Remove the `SolarHero` component and replace it with a simple, neutral landing page structure.
- **src/styles.css**: Remove custom solar-related animations (`energy-flow`, `panel-glint`), utility classes, and custom theme colors (`--color-solar-energy`, `--color-solar-sun`).

### Delete Components
- Remove `src/components/solar/SolarHero.tsx`
- Remove `src/components/solar/DataCard.tsx`
- Remove `src/components/solar/HouseIllustration.tsx`

## Verification Plan

### Automated Checks
- Run `bun run build` to ensure the project still compiles without the deleted files.
- Verify no linting errors are introduced by the changes.

### Manual Verification
- Check the preview to ensure a neutral landing page is rendered.
- Verify that the console is free of "Module not found" errors.
