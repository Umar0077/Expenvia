# Executive landing refinement

13 November 2026. Local preview: http://localhost:3001.

## 1. Hero layout

The restored public landing design is retained. The hero now has more vertical breathing room, a balanced two-column composition and the same three-part English headline. Urdu continues to wrap naturally using its existing typography. The original dashboard concept and illustrative values remain: three metrics, six bars, invoice chip, branch panel and pending badge.

The dashboard now uses content-driven sizing instead of a fixed aspect-ratio clipping box. Its invoice chip clears the dashboard header, labels wrap instead of truncating, and mobile metrics use two columns with a full-width third metric. The complete chart remains visible on phones. The branch float is hidden on narrow phones, as before. This is presentation-only data.

## 2. Amount of enlargement

Desktop uses `min-height: calc(84svh - 96px)` for the hero, with a stable 96px header allocation. This is a minimum, not a fixed height: content can grow on shorter screens.

At 1440×1000, the English hero grew from **615.8px to 744px**, approximately **128px / 21%**. Urdu grew from **631.8px to 744px**, approximately **112px / 18%**. Header plus hero is **840px / 84svh**. English headline size at this viewport increased from 57.6px to 60.5px.

Below 1024px, the hero has natural height. At 390px, English is 997px and Urdu 1073px: taller than the prior clipped illustration because its labels and chart are now fully contained. No viewport-height constraint is imposed on mobile.

## 3. Light background

The existing section-local ambient component, SVG paths and 32/44-second animation settings are unchanged. Only public light-hero overrides adjust its sage field, ribbon opacity (0.65 → 0.78), reading veil and mesh definition. Ivory, emerald and copper remain the established palette.

There is no fixed full-page background, replacement ribbon geometry or revived Living Aurora 2.0 canvas. Dark hero background settings and the independent workflow, capability, branch, security and closing-section treatments remain unchanged. The hero's lower fade still connects to the following section.

## 4. Executive Floating App Bar

A bounded floating surface replaces the full-width flat bar: restrained asymmetrical corners, a fine emerald/copper top edge, grouped preferences, clearer account-action hierarchy and preserved full-size wordmark. Links and controls have larger hit areas, with visible keyboard focus.

At 1280px and above, section links appear inline. Below that width, a Radix dialog supplies the section navigation. Language and sign-in controls move into that menu below 1024px; request access also moves into the menu below 640px. Every requested action remains available. The menu supports Escape, focus trapping/restoration, RTL and focus transfer to the selected section heading. The existing language/theme actions are reused unchanged.

## 5. Animation

Hero text and preview use short, staggered 12px entrances. Server-rendered content starts readable. Chart bars reveal with scale transforms instead of height animation. Financial panels float by only 4px on seven/eight-second cycles and pause when offscreen or when the document is hidden.

Nav links have a restrained hover underline and a spring-driven active-section pill. Request access lifts 2px with small arrow movement. Existing language/theme micro-interactions remain. Both operating-system and in-app reduced-motion preferences stop decorative floating and header movement. No new package was added.

## 6. Scroll behavior

Motion values smooth the first 160px of scrolling. The bar moves upward by at most 6px and becomes more opaque (0.84 → 0.98), with a stronger light-theme shadow. Its reserved layout space remains constant, preventing the hero from jumping. An IntersectionObserver tracks the section in the reading band and updates `aria-current` and the active pill. Reduced motion keeps the bar stationary.

## 7. Responsive and visual verification

All **36 language/theme/width combinations** passed at 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px. Checks cover page overflow, header controls staying inside the bar, logo width, untruncated hero/metric text, full chart bounds, invoice/header separation and preview containment. Mobile menu bounds, all actions, RTL direction and Escape focus restoration passed.

Actual browser checks also passed for active nav states, hover lift without resizing, scroll transformation/opacity, keyboard menu activation, section-heading focus, live Urdu switching, live theme switching and both reduced-motion settings. No page errors were captured.

Twenty-four matching before/after captures cover both languages, both themes, desktop/mobile hero views and app bars. Desktop, mobile and 320px menu images were visually opened and reviewed. The stronger light ribbons, increased desktop hero height and floating bar are clearly visible in those comparisons.

| View | Before | After |
| --- | --- | --- |
| Light desktop | [Before](../screenshots/executive-before/en-light-1440.png) | [After](../screenshots/executive-after/en-light-1440.png) |
| Dark desktop | [Before](../screenshots/executive-before/en-dark-1440.png) | [After](../screenshots/executive-after/en-dark-1440.png) |
| Light app bar | [Before](../screenshots/executive-before/en-light-1440-header.png) | [After](../screenshots/executive-after/en-light-1440-header.png) |
| Urdu dark desktop | [Before](../screenshots/executive-before/ur-dark-1440.png) | [After](../screenshots/executive-after/ur-dark-1440.png) |
| English mobile hero | [Before](../screenshots/executive-before/en-light-390-hero.png) | [After](../screenshots/executive-after/en-light-390-hero.png) |
| Urdu mobile hero | [Before](../screenshots/executive-before/ur-light-390-hero.png) | [After](../screenshots/executive-after/ur-light-390-hero.png) |
| Small-screen Urdu menu | — | [320px menu](../screenshots/executive-after/ur-light-320-menu.png) |

## 8. Tests, typecheck and production build

- TypeScript passed after restoring the normal development generated-type references.
- Production webpack build passed on Node 24.22.1, generating 44 pages in isolated `.next-executive-build` output.
- All **11 existing browser regressions** passed: Atelier, landing branding, Urdu switching, authentication, permissions, invoice hydration and mobile role layouts.
- The full unit/integration suite on Node 24 produced **89 passed / 50 failed** out of 139. All 50 failures are unchanged email-template assertions expecting two PKR decimal places.
- Diagnosis: Node 23.10.0 / ICU 76.1 defaults PKR formatting to `Rs 1,250.50`; Node 24.22.1 / ICU 78.3 defaults it to rounded `Rs 1,251`. The existing email formatter relies on that default. Running the same unchanged email test file on Node 23 passed **all 53 tests**. Email code and test expectations were not edited because this task explicitly excludes email and financial/localization logic.

The first UI audit queried focus immediately after Escape and caught Radix's asynchronous restoration. The audit now waits for dialog removal and restored focus, then passes; application focus behavior was not weakened to satisfy the check.

## 9. Limitations and preservation

The Node 24 email-formatting discrepancy remains a separate existing compatibility issue. The landing implementation and production build pass; the full Node 24 test suite is not green. Browser validation used Chromium with emulated sizes, not physical-device/Safari/Firefox performance certification. No sustained-frame-rate claim is made. The header uses a bounded backdrop blur and background/shadow changes, so these are not exclusively compositor-only effects.

Fingerprint checks confirmed that logo assets/component behavior, Urdu typography, Signature Contour Cards, workflow component/styles, branch presentation, original ambient geometry, Atelier CSS and shared language/theme controls were unchanged. No authentication, branch records, calculations, email systems, localization actions, permissions or database schema changes were made.

Implementation: `src/components/landing/executive-app-bar.tsx`, `hero-entrance.tsx`, `executive-landing.css`, the focused `hero-visual.tsx` refinement and landing integration in `src/app/page.tsx`. Repeatable capture/audit scripts: `scripts/executive-capture.mjs` and `scripts/executive-check.mjs`. Results and measured dimensions are saved under `screenshots/executive-before` and `screenshots/executive-after`.
