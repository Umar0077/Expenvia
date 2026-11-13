# Expenvia — Cinematic Flow Journey

The landing page's receipt-to-reconciliation section now uses four staggered milestone panels connected by a continuous SVG Bézier path. Desktop presents a wide wave, tablet folds into a two-row journey, and mobile uses a winding vertical timeline. An ivory/sage or charcoal/emerald canvas carries fine contour ribbons and restrained copper accents.

## Implementation

- `src/components/landing/workflow-journey.tsx`: WorkflowJourney, WorkflowPath, WorkflowParticle, WorkflowMilestone and WorkflowStepCard. Receipt, invoice, review and chart illustrations use lightweight HTML/SVG.
- `src/components/landing/workflow-journey.css`: section-specific surfaces, responsive placement, fine interior borders and accessible focus treatment.
- `messages/en.json` and `messages/ur.json`: the requested milestone descriptions, miniature labels and accessible control labels.
- `src/app/page.tsx`: replaces only the old workflow section with WorkflowJourney.

A ResizeObserver measures the untransformed marker centers. The base line, reveal line, nearby hover segments, milestone thresholds and moving token all use that geometry. The token samples the actual SVG path with `getPointAtLength`. Urdu uses the real RTL layout coordinates rather than reflecting the enhanced SVG.

Motion's scroll value passes through a spring and a clamped transform. Milestone activation uses cumulative segment lengths and advances or reverses with scroll. Motion values update the particle without React renders on every animation frame. React state changes only at milestone boundaries or on interaction. No scroll hijacking, pinned section or looping particles are used. References: [Motion useScroll](https://motion.dev/docs/react-use-scroll) and [useMotionValueEvent](https://motion.dev/docs/react-use-motion-value-event).

Hover and focus emphasize the card and adjacent path segments without changing scroll progress. The full card is an accessible button target: Enter/Space or a mobile tap pins a selection; a second activation or Escape clears the pinned state. Text remains stable throughout.

Reduced motion shows the complete path and all milestones, hides the token and stops card, illustration and marker transforms immediately. Off-screen particles are unmounted and miniature chart transitions are disabled. Server-rendered cards and responsive static SVG connectors remain visible with JavaScript disabled.

Authentication, roles, branches, invoices, calculations, payment tracking, audit logs, email and database code were not changed. The capability contour cards and other landing sections retain their existing implementation.

## Verification

- TypeScript check passed.
- Existing landing branding and Urdu navigation tests: 2 passed.
- Production webpack build passed on Node 24; all 44 generated pages completed. Build output is isolated in `.next-journey-build`.
- Browser geometry matrix: English/Urdu, light/dark, widths 320, 360, 390, 430, 768, 900, 1199, 1200, 1440 and 1920px. Checks cover overflow, card overlap, text fit, marker connections and path intersections with card content.
- Browser interaction verification: forward/reverse sequence, particle position on the curve, hover, focus, Enter/Escape/Tab, touch selection, both motion preference sources and no-JavaScript layouts.
- All 49 browser verification groups passed with no console or page errors. Desktop, tablet, mobile and RTL screenshots were visually inspected, including the static fallback.
- Reproducible browser verification: `node scripts/journey-check.mjs`. Results: `screenshots/journey-after/checks.json`.
- Screenshot capture: `node scripts/journey-capture.mjs before` or `after`. These use reduced motion for stable matched comparisons at a 1000px viewport height. The original before captures are preserved.

## Matched screenshots

| Language / theme / width | Before | After |
| --- | --- | --- |
| English · light · desktop 1440 | [Before](../screenshots/journey-before/en-light-1440.png) | [After](../screenshots/journey-after/en-light-1440.png) |
| English · dark · desktop 1440 | [Before](../screenshots/journey-before/en-dark-1440.png) | [After](../screenshots/journey-after/en-dark-1440.png) |
| English · light · tablet 900 | [Before](../screenshots/journey-before/en-light-900.png) | [After](../screenshots/journey-after/en-light-900.png) |
| English · dark · tablet 900 | [Before](../screenshots/journey-before/en-dark-900.png) | [After](../screenshots/journey-after/en-dark-900.png) |
| English · light · mobile 390 | [Before](../screenshots/journey-before/en-light-390.png) | [After](../screenshots/journey-after/en-light-390.png) |
| English · dark · mobile 390 | [Before](../screenshots/journey-before/en-dark-390.png) | [After](../screenshots/journey-after/en-dark-390.png) |
| Urdu · light · desktop 1440 | [Before](../screenshots/journey-before/ur-light-1440.png) | [After](../screenshots/journey-after/ur-light-1440.png) |
| Urdu · dark · desktop 1440 | [Before](../screenshots/journey-before/ur-dark-1440.png) | [After](../screenshots/journey-after/ur-dark-1440.png) |
| Urdu · light · tablet 900 | [Before](../screenshots/journey-before/ur-light-900.png) | [After](../screenshots/journey-after/ur-light-900.png) |
| Urdu · dark · tablet 900 | [Before](../screenshots/journey-before/ur-dark-900.png) | [After](../screenshots/journey-after/ur-dark-900.png) |
| Urdu · light · mobile 390 | [Before](../screenshots/journey-before/ur-light-390.png) | [After](../screenshots/journey-after/ur-light-390.png) |
| Urdu · dark · mobile 390 | [Before](../screenshots/journey-before/ur-dark-390.png) | [After](../screenshots/journey-after/ur-dark-390.png) |

Local preview: [Expenvia workflow — port 3001](http://localhost:3001/#workflow).
