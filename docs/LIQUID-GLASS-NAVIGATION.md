# Expenvia Liquid Glass Navigation

The landing navigation now uses a floating frosted capsule with a centered inner navigation pill, theme-aware reflections, thin edge lighting, and a solid emerald Request Access action. The existing logo artwork and its corrected size are retained.

## Scope

- `src/components/landing/executive-app-bar.tsx`: shared-layout hover/focus indicator, independent active-section state, spring-smoothed scroll and pointer values, logo/CTA feedback, and animated accessible mobile dialog.
- `src/components/landing/liquid-glass-navigation.css`: scoped glass materials, capsule geometry, theme variants, responsive controls, and reduced-motion treatment.
- `scripts/glass-navigation-capture.mjs` and `scripts/glass-navigation-check.mjs`: visual evidence and browser verification.

The bar compresses by 8px while the reserved header space stays fixed. Blur remains constant. Pointer lighting uses MotionValues rather than React state updates, and is disabled for touch and reduced motion. The mobile dialog preserves focus trapping, Escape dismissal, focus return, section-heading focus after navigation, and page scroll locking.

No hero typography, preview opacity, background, card, workflow, logo asset, Urdu typography, translations, authentication, financial, email, permission, or database implementation was changed. Thirteen protected landing and preference files are compared with SHA-256 fingerprints saved before editing.

## Verification

- TypeScript: `tsc --noEmit` passed.
- Production build: Next.js webpack build passed on Node 24.22.1 using isolated `.next-glass-build` output. Temporary generated TypeScript configuration changes were restored.
- Existing browser regressions: 3 passed (landing branding, live Urdu switching, branch-card and motion behavior).
- Custom browser verification: all 36 combinations passed at 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px in English/Urdu and light/dark themes, with no browser errors. Checks include control clipping/overlap, page overflow, centered desktop links, fixed blur, header compression without hero movement, menu focus/scroll handling, navigation destinations, live preferences, hover versus active state, pointer light, and OS/app reduced-motion settings. All 13 protected file fingerprints matched.
- Screenshots were visually inspected at desktop and mobile widths, including the 320px Urdu menu. Verification uses Chromium; physical-device performance and other browser engines were not measured.

Detailed custom check results are saved in `screenshots/glass-navigation-after/checks.json`.

## Before and after screenshots

All evidence is under `screenshots/glass-navigation-before` and `screenshots/glass-navigation-after`. Each contains English and Urdu variants in both themes: top, cropped navbar, scrolled, hover, mobile, and open mobile menu. The after folder also includes 320px menus.

| View | Before | After |
| --- | --- | --- |
| Light navbar | [Before](../screenshots/glass-navigation-before/en-light-bar.png) | [After](../screenshots/glass-navigation-after/en-light-bar.png) |
| Dark navbar | [Before](../screenshots/glass-navigation-before/en-dark-bar.png) | [After](../screenshots/glass-navigation-after/en-dark-bar.png) |
| Light scrolled | [Before](../screenshots/glass-navigation-before/en-light-scrolled.png) | [After](../screenshots/glass-navigation-after/en-light-scrolled.png) |
| Dark scrolled | [Before](../screenshots/glass-navigation-before/en-dark-scrolled.png) | [After](../screenshots/glass-navigation-after/en-dark-scrolled.png) |
| Hover | [Before](../screenshots/glass-navigation-before/en-light-hover.png) | [After](../screenshots/glass-navigation-after/en-light-hover.png) |
| Mobile menu | [Before](../screenshots/glass-navigation-before/en-dark-mobile-menu.png) | [After](../screenshots/glass-navigation-after/en-dark-mobile-menu.png) |
| Urdu RTL | [Before](../screenshots/glass-navigation-before/ur-light-bar.png) | [After](../screenshots/glass-navigation-after/ur-light-bar.png) |

The app is available at http://localhost:3001. Browser regressions use the separate demo app on port 3002.
