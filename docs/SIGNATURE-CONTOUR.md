# Expenvia Signature Contour Cards

The six landing capability cards now share a sculpted upper-start corner, a chamfered upper-end corner with an inset signature seam, a soft lower-end corner and a restrained lower-start corner. Fine SVG contours retain a consistent stroke weight as the surface scales. Emerald is the default accent; the existing vendor invoicing and no double counting copper variants remain.

`src/components/landing/signature-contour-card.tsx` owns the reusable decorative surface and Motion variants. Only the six capability wrappers and icon wrappers in `src/app/page.tsx` use it. Styles are scoped to the public landing page in `src/app/landing-refinement.css`. Text, icons, typography, padding, grid spacing and content alignment remain unchanged. The shape mirrors in Urdu RTL. Only decorative artwork is clipped, leaving content and focus indicators unrestricted.

Hover uses a 4px spring lift, 2px icon lift, one gentle border-highlight pass and a soft shadow/inset transition. OS and in-app reduced-motion preferences disable movement. No tilt or looping border animation is used.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Existing Playwright landing branding and Urdu language-switch tests: 2 passed.
- `node scripts/contour-check.mjs after`: 36 responsive checks across English/Urdu, light/dark and widths 320–1920px; no horizontal overflow or browser page errors.
- Browser hover checks verified lift, icon movement, changing border highlight and shadow, unchanged card dimensions, and no movement under OS or in-app reduced motion.
- Desktop and mobile screenshots visually inspected for silhouette, alignment, readability and RTL mirroring.

## Before and after

| View | Before | After |
| --- | --- | --- |
| Light desktop | [Before](../screenshots/contour-before/en-light-1440.png) | [After](../screenshots/contour-after/en-light-1440.png) |
| Dark desktop | [Before](../screenshots/contour-before/en-dark-1440.png) | [After](../screenshots/contour-after/en-dark-1440.png) |
| Light mobile | [Before](../screenshots/contour-before/en-light-390.png) | [After](../screenshots/contour-after/en-light-390.png) |
| Dark mobile | [Before](../screenshots/contour-before/en-dark-390.png) | [After](../screenshots/contour-after/en-dark-390.png) |
| Urdu light desktop | — | [After](../screenshots/contour-after/ur-light-1440.png) |
| Urdu dark desktop | — | [After](../screenshots/contour-after/ur-dark-1440.png) |
| Urdu light mobile | — | [After](../screenshots/contour-after/ur-light-390.png) |
| Urdu dark mobile | — | [After](../screenshots/contour-after/ur-dark-390.png) |

Live local preview: http://localhost:3001/#capabilities
