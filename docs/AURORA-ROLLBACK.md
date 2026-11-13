# Living Aurora 2.0 background and hero rollback

13 November 2026. Preview: http://localhost:3001.

## Recovery and scope

There is no Git checkout in this workspace. The exact previous hero component and the original page-edit diff were recovered from local Codex edit history, rather than approximated from screenshots. Before editing, the affected current files were copied into `screenshots/aurora-rollback/source-backup` with `.bak` extensions. Nine protected files were fingerprinted and verified unchanged.

Only the Living Aurora background/hero changes were reversed:

- Removed `src/components/ambient/living-aurora.tsx` and `living-aurora.css`, including the fixed full-page canvas, oversized SVG ribbons, new pointer/scroll parallax, new animation timing, veils, grain, section-opacity overrides and stacking rules.
- Selectively reverted background and hero hunks in `src/app/page.tsx`. The original section-local `AmbientBackground` is again used in the hero and closing panel. Original workflow, capability, branch, security and footer backgrounds are no longer overridden.
- Restored `src/components/landing/hero-visual.tsx` from its exact pre-redesign source. Restored the former dashboard dimensions, placement, metric panels, bars, invoice chip, branch panel, pending badge and original motion.
- Removed the redesign-only `hero-copy.tsx` and `hero-visual.css`. Removed its unused `heroChartCaption` translations.
- Restored the old hero grid spacing, padding, alignment and natural height; removed the 90svh sizing and coordinated redesign entrance. The original Reveal/Magnetic behavior remains.
- Updated the existing reduced-motion browser regression to target the restored `.aurora-wave` selectors. No test coverage was removed.

## What was preserved

Larger navigation/footer/sidebar/auth logos, the Urdu type system and optimized font loading, RTL menu/navigation improvements, responsive filters, Emerald Atelier styling, all six Signature Contour Cards, the separate workflow journey and branch names remain. The page keeps the semantic hero text classes solely so the retained Urdu typography still applies.

Authentication, permissions, database records, financial calculations, invoices, email infrastructure, theme switching and other business logic were not changed. No reset, migration or data deletion was run.

Hash comparisons confirmed the logo component, Urdu stylesheet, root layout, application shell, workflow component/CSS, landing refinement CSS, Atelier CSS and original ambient-background component were unchanged during this rollback.

## Restoration fidelity

Source comparisons against the recovered checkpoint confirm exact matches for the original ambient SVG component, Atelier background/animation CSS and HeroVisual component. The page's background and hero layout changes were selectively reversed using the original diff. Existing section styles are active again.

The entire page is intentionally not pixel-identical to the older screenshots: the requested larger logos and improved Urdu typography are retained. Their text metrics can change Urdu line wrapping and natural section height. No replacement palette, geometry or new animation was introduced.

## Verification

- TypeScript typecheck passed.
- 11 existing browser regressions passed, including landing branding, Urdu switching, reduced motion, invoice-editor hydration, authentication, role permissions and mobile role layouts.
- 36 responsive combinations passed: English/Urdu, light/dark and widths 320/360/390/430/768/1024/1280/1440/1920. No page overflow or browser errors; hero heading/dashboard remain inside the hero bounds. Logo sizing and Urdu tokens were verified.
- Final desktop and mobile screenshots were opened and inspected. Section captures cover workflow, capabilities, branches, security and closing. The new full-page layers are absent.
- All 49 workflow verification groups passed on the isolated rerun, including forward/reverse scroll progress, particle alignment, responsive paths, keyboard interaction and reduced motion. The first run failed one fixed-delay Urdu/tablet scroll assertion while multiple browser suites ran concurrently; the unchanged script passed when run alone. No workflow source changes were made.

The restored original miniature dashboard intentionally truncates some labels on narrow phones and hides its floating branch panel below the small-screen breakpoint. Those pre-existing behaviors were retained to honor the request to restore the old design. Desktop financial values and the main headline remain readable. Checks used Chromium; no cross-browser certification or new production build was requested for this rollback.

## Evidence

| View | Before Living Aurora 2.0 | Restored |
| --- | --- | --- |
| Light desktop | [Earlier](../screenshots/aurora-before/en-light-landing.png) | [Restored](../screenshots/aurora-rollback/en-light-1440-final.png) |
| Dark desktop | [Earlier](../screenshots/aurora-before/en-dark-landing.png) | [Restored](../screenshots/aurora-rollback/en-dark-1440-final.png) |
| Urdu light mobile | [Earlier](../screenshots/aurora-before/ur-light-mobile-nav.png) | [Restored hero](../screenshots/aurora-rollback/ur-light-390-hero.png) |
| Urdu dark mobile | [Earlier](../screenshots/aurora-before/ur-dark-mobile-nav.png) | [Restored hero](../screenshots/aurora-rollback/ur-dark-390-hero.png) |

Earlier screenshots caught some dashboard entrance animations mid-transition. The final rollback captures wait for those animations to finish. Machine-readable responsive and preservation results are in `screenshots/aurora-rollback/checks.json`.
