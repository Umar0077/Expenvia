# Living Aurora 2.0 and Urdu/brand refinement

Historical implementation report: the Living Aurora background and hero changes were subsequently rolled back at the user's request. Logo sizing and Urdu typography were retained. See `AURORA-ROLLBACK.md` for the current state.

Implemented 13 November 2026. Local preview: http://localhost:3001. Verification uses the separate demo application on port 3002 for authenticated screens.

## 1. Hero layout

The desktop hero now occupies approximately 90svh including the 64px navigation, with a larger illustrative financial preview. Mobile and tablet use natural content height. The existing headline, calls to action and destinations are preserved. Copy enters in a coordinated sequence; the chart, invoice and branch panels have distinct depth. All preview data is explicitly marked illustrative.

## 2. Background architecture

`LivingAurora` owns one fixed, non-interactive canvas for the entire landing page. Two SVG ribbon groups use sculpted Bézier silhouettes, restrained edge highlights and emerald/pearl/copper gradients. A static grain texture and reading veil keep text clear. Translucent section treatments allow the same scene to continue through the workflow, capabilities, branch, security and closing sections.

Motion values and springs drive pointer and scroll depth without React state updates on pointer movement. Pointer and visibility listeners are removed on unmount. No canvas/WebGL renderer, external animation library or generated raster asset was added. Existing Signature Contour Cards and the financial workflow remain in place.

## 3. Light mode

An ivory base, sage folds, pearl edges and warm copper ribbons replace the isolated background treatment. Card surfaces retain sufficient opacity for readable content while the continuous scene remains visible around them.

## 4. Dark mode

Deep emerald and charcoal support softly lit green folds and copper edges. The hero has stronger depth without animated blur or heavy glow. Section overlays preserve continuity, including the previously opaque workflow section.

## 5. Animation and accessibility

- Ambient ribbon/light cycles run at 16, 23 and 18 seconds. Mobile uses a simpler 22-second primary ribbon and disables the secondary ribbon and light drift.
- Fine mouse pointers drive restrained spring parallax; scroll changes scene position, scale and lighting.
- Hero copy and bars reveal once. Invoice and branch panels float by only a few pixels.
- Offscreen preview animation pauses; background animation pauses while the document is hidden.
- Both operating-system and in-app reduced motion preserve the complete static composition and disable decorative movement.
- Decoration is hidden from accessibility APIs and cannot intercept clicks. RTL affects content alignment while identifier/chart runs retain LTR direction.

## 6. Performance findings

The implementation primarily animates transforms and opacity, avoids animated blur, reduces mobile layers, and shares pointer motion values between background and preview.

A five-second local Chromium development sample with pointer and scroll input recorded 149 animation-frame intervals: median 33.3ms and p95 66.6ms. CDP recorded 0.110 seconds of script time and 0.404 seconds of task time, with 193 layouts and 199 style recalculations. These measurements do **not** establish 60fps performance; this development/browser-automation environment is not a target-device production benchmark.

Initial-load CLS measured **0** for English and Urdu through font readiness and a further 2.5 seconds. After garbage collection, listener counts stayed at **733** across six client navigation cycles. The earlier short navigation probe included transient listeners; the repeated settled probe is saved separately. Fonts continue through the existing optimized Next.js font pipeline; unused Nastaliq weight 700 was removed.

Evidence: `screenshots/aurora-after/motion-profile.json` and `loading-profile.json`.

## 7. Responsive and branding results

The original light/dark wordmarks, mark and favicon remain unchanged. Alpha-bound inspection found only six-pixel artwork margins, so no destructive crop was needed. Wordmark widths are 166px desktop navigation, 149px tablet, 132px mobile (122px at 320px), 158px sidebar, 190px auth (180px mobile), and 151px footer. Explicit image dimensions reserve aspect ratio.

Urdu uses Naskh for application UI and Nastaliq for expressive landing/auth headings. Semantic sizes are 18px body, 17px controls/navigation/card copy, 16px labels/table headers, 15px captions and 21px card headings. Urdu line heights and wrapping accommodate the script. Numeric values and identifiers retain their Latin type scale. Sidebar labels wrap, small-screen filter controls form readable rows, and the account menu explicitly receives RTL direction.

Checks cover widths **320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px**, in both themes:

- 702 responsive checks: six public/auth routes in both languages plus 27 authenticated admin/user/vendor routes in Urdu. No overflow or clipped-label findings; no captured browser errors.
- 180 additional Urdu status and branch/invoice/expense detail checks passed.
- Eight Urdu control groups passed at 320/390/768/1440px in both themes: dialog bounds, required-field validation, RTL account menu and mobile navigation. No business records were created by the validation check.

## 8. Validation and screenshot evidence

- TypeScript check passed.
- 139 unit/integration tests passed across 12 files.
- 12 existing browser tests passed across security/UX, Atelier and dashboard navigation suites. Dashboard navigation passed again after the responsive filter refinement.
- Live animation checks passed: changing ribbon transforms, invoice float, pointer springs, scroll atmosphere, single shared canvas, offscreen pause, both reduced-motion controls and mobile layer reduction.
- Production webpack build passed using the supported Node 24 runtime, generating 44 pages in the isolated `.next-aurora-build` directory.
- Existing test coverage was retained; the ambient reduced-motion test was updated to the new ribbon selectors.

Twenty-four matching before/after images were captured at identical viewports: desktop 1440×1000 and mobile 390×844. Both themes include English/Urdu landing and dashboard views, mobile navigation, and landing section captures. Screenshots intentionally use reduced motion for stable comparison; separate browser checks verify live movement.

| View | Before | After |
| --- | --- | --- |
| Light English hero | [Before](../screenshots/aurora-before/en-light-landing.png) | [After](../screenshots/aurora-after/en-light-landing.png) |
| Dark English hero | [Before](../screenshots/aurora-before/en-dark-landing.png) | [After](../screenshots/aurora-after/en-dark-landing.png) |
| Light Urdu landing | [Before](../screenshots/aurora-before/ur-light-landing.png) | [After](../screenshots/aurora-after/ur-light-landing.png) |
| Dark Urdu mobile | [Before](../screenshots/aurora-before/ur-dark-mobile-nav.png) | [After](../screenshots/aurora-after/ur-dark-mobile-nav.png) |
| Light Urdu dashboard | [Before](../screenshots/aurora-before/ur-light-dashboard.png) | [After](../screenshots/aurora-after/ur-light-dashboard.png) |
| Dark workflow | [Before](../screenshots/aurora-before/dark-workflow.png) | [After](../screenshots/aurora-after/dark-workflow.png) |
| Light capabilities | [Before](../screenshots/aurora-before/light-capabilities.png) | [After](../screenshots/aurora-after/light-capabilities.png) |
| Dark branches | [Before](../screenshots/aurora-before/dark-branches.png) | [After](../screenshots/aurora-after/dark-branches.png) |
| Light closing | [Before](../screenshots/aurora-before/light-mainsectionlastchild.png) | [After](../screenshots/aurora-after/light-mainsectionlastchild.png) |

Repeatable checks are in `scripts/aurora-capture.mjs`, `aurora-audit.mjs`, `aurora-detail-check.mjs`, `aurora-motion-check.mjs`, `aurora-loading-check.mjs` and `urdu-controls-check.mjs`. Authenticated scripts read local fictional demo credentials without printing passwords.

## 9. Remaining limitations and scope

Browser verification used local Chromium and emulated viewport sizes. Real mobile GPU/thermal behavior, Safari and Firefox were not profiled. The measured frame intervals warrant target-device production profiling before promising sustained 60fps. Automated label/overflow checks supplement visual inspection; they do not prove every possible translated or user-entered string will fit.

Application logic for authentication, registration approvals, calculations, database access, invoicing, expenses, emails, assignments, audit trails and permissions was not changed. The production build and the relevant existing business/security tests passed; this is not an exhaustive certification of all workflows.
