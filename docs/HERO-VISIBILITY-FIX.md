# Focused hero visibility fix

13 November 2026 — http://localhost:3001

Only the hero heading and financial preview visibility were changed.

- English heading: desktop 60.5px/600 → 72px/700 at 1440px. Responsive clamps preserve the established three balanced lines. Urdu receives a modest size increase while retaining its existing Naskh/Nastaliq font system, supported 600 weight and generous line height.
- The heading and all financial preview panels retain opacity 1 throughout their entrance; their existing small vertical entrance remains. Previously the wrapper started at opacity 0.5.
- Preview panels use solid theme surfaces, clearer emerald borders and restrained depth. Dark panels use the existing elevated-surface token. Labels have stronger contrast. Chart bars now use full opacity instead of the prior 0.55–0.95 range.
- Desktop hero height remains 744px at 1440×1000. The grid, panel positions, background, navbar, CTA structure and chart values/heights remain unchanged. Mobile grows naturally with the slightly larger text.

Validation: typecheck passed; 36 English/Urdu, light/dark combinations passed at 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px. No overflow, text clipping, column collision or chart clipping was found. English retained exactly three headline lines at every width. Eighty live entrance samples verified opacity 1 for the heading and all four preview panels. Reduced motion and ten preserved-file fingerprints passed. Existing landing/Urdu/reduced-motion browser regression results are recorded below.

All three relevant existing browser regressions passed: landing branding, live Urdu switching and reduced-motion behavior. Before/after screenshots were captured and visually reviewed in both themes, including mobile Urdu. Sources and evidence are under `screenshots/executive-hero-before` and `screenshots/executive-hero-after`; verification is repeatable with `scripts/hero-visibility-check.mjs`.

| Hero | Before | After |
| --- | --- | --- |
| Light desktop | [Before](../screenshots/executive-hero-before/en-light-1440-hero.png) | [After](../screenshots/executive-hero-after/en-light-1440-hero.png) |
| Dark desktop | [Before](../screenshots/executive-hero-before/en-dark-1440-hero.png) | [After](../screenshots/executive-hero-after/en-dark-1440-hero.png) |
| Light mobile | [Before](../screenshots/executive-hero-before/en-light-390-hero.png) | [After](../screenshots/executive-hero-after/en-light-390-hero.png) |
| Urdu mobile | [Before](../screenshots/executive-hero-before/ur-light-390-hero.png) | [After](../screenshots/executive-hero-after/ur-light-390-hero.png) |

The navbar, logos, shared Urdu stylesheet, background geometry/styles, capability cards, workflow and branches were fingerprinted unchanged. Business logic, authentication, data, localization actions and email code were not edited. No production build was rerun for this limited CSS/entrance-opacity change; typecheck and browser verification cover the changed behavior. Verification used Chromium, not physical-device or cross-browser certification.
