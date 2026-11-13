# Expenvia Emerald Atelier — implementation report

13 November 2026 · Existing application, additive branch integration and visual evolution

## 1. Company branches

Five branches were created in the regular local application database (`expenvia`). A second import matched the same IDs and created no duplicates. The separate demo database retains its five demo offices; no demo transactions were moved into the real offices.

| Office | Code | City | Result |
| --- | --- | --- | --- |
| Shamsabad Office | SHAMSABAD | Rawalpindi | Created; supplied address, both phones, email and schedule retained |
| Islamabad Office | ISB-I93 | Islamabad | Created; supplied address, phone, email and schedule retained |
| Commercial Office | COMMERCIAL | Rawalpindi | Created; supplied address, both phones, email and schedule retained |
| Iran Road Office | IRAN-ROAD | Rawalpindi | Created; supplied address, both phones, email and schedule retained |
| I-9/2 Office | ISB-I92 | Islamabad | Created; country and timezone retained, unsupported details left unconfirmed |

All five use Asia/Karachi. The first four show Monday–Friday, 18:00–04:00 with an explicit “next day” label. I-9/2's full street address, phone, email and working schedule remain awaiting confirmation. No details were borrowed from another office. Existing Lahore Head Office was retained unchanged.

The offices start with zero expenses, invoices and employee/vendor assignments. Administrators can find them in branch management, dashboard/expense/report filters, branch comparison, employee/vendor assignment menus and global search. Vendors gain invoice-selection access only after an authorized assignment; import does not grant access. Existing role checks and owner-scoped employee queries remain intact.

## 2. Safe import and migration

Migration `20261113090000_branch_office_details` adds nullable secondary phone, working days, opening/closing time and timezone columns. Existing fields and records are retained. The admin editor supports the new details with phone/time/timezone validation and English/Urdu labels.

`src/server/services/branch-import.ts` uses the same branch validation schema as normal branch management, checks the actor against an active Super Admin database record, and imports within one transaction. An advisory transaction lock serializes imports. Code/name/city matching detects existing records; ambiguous or conflicting identities abort the transaction. Only explicitly supplied fields are updated, preserving existing codes, status, creator and unconfirmed details. Changes produce administrative audit records; unchanged reimports do not add duplicate audit events.

Local execution:

```sh
npm run db:deploy
npm run db:generate
node --conditions=react-server --import tsx scripts/import-company-branches.ts
```

The import helper intentionally accepts only the local application database, not demo/test or remote production. Restart the web process after generating a new Prisma client. Production rollout requires its normal backup/deploy procedure and an explicitly selected administrator. Rollback should revert code while retaining the additive columns and branch records; deleting branches would discard administrative history and is unnecessary.

Migration checks showed these counts unchanged before/after:

| Database | Users | Expenses | Invoices | Payments |
| --- | ---: | ---: | ---: | ---: |
| Application | 9 | 1 | 0 | 0 |
| Demo | 20 | 182 | 43 | 39 |
| Integration test | 780 | 118 | 123 | 44 |

The application import additionally preserved its 2 employee-assignment records and 1 vendor-assignment record. Subsequent tests create fictional records in their isolated databases; the table describes migration-time counts.

## 3. Visual system

- Shared layered surfaces use an interior highlight, fine emerald-tinted boundary and restrained directional shadow. Three elevation tokens distinguish ordinary surfaces, interactive cards and modal/drawer overlays.
- `AtelierCard` supplies reusable surface/branch/vendor/chart variants and spring hover lift. It changes position without resizing. `AtelierBentoGrid` and `AtelierChartPanel` establish a wide spending chart beside a narrower category panel.
- Financial metric cards have contextual edge accents, stronger values and separated contextual notes. The executive dashboard places two major monetary cards above four operational summaries. The period sparkline uses real monthly employee/vendor totals; the existing valid-baseline comparison logic is retained.
- Branch cards now have a monogram, geometric identity header, readable address, phone/email links, overnight schedule, status, genuine financial/assignment summary and existing detail/edit controls.
- Administrator vendor cards use a business identity layout, full names, status, invoice count, outstanding amount, branch coverage and the existing management drawer.
- Mobile invoice and expense records have stacked amount hierarchy, readable metadata and status. Invoice cards show actual payment progress and outstanding balance; expense records include category/branch and receipt indicators. Desktop tables retain their data-dense behavior and local horizontal scrolling where needed.
- Shared card headers, settings, reports, email center and landing surfaces receive the same material language. Existing Expenvia logos, favicon and type scales remain.

## 4. Fluid Aurora Canvas

`FluidAuroraCanvas` replaces the blob-based ambient component while retaining its existing page-intensity interface. It combines original curved SVG ribbons, emerald depth gradients, a copper seam, fine static grain, mesh-like conic lighting and a vignette. No stock/generated office photos or borrowed brand artwork are used.

Hero pages use two spring-smoothed pointer layers and a scroll-linked light-field rotation. Pointer movement uses Motion values rather than React state and is limited to fine mouse pointers. The pointer layer returns toward its resting position on leave. Auth pages use moderate intensity; dashboards use slow, low-intensity motion; forms and detail pages remain static. Reports keep the subdued header treatment.

Ribbon motion uses transforms; no SVG path is recomputed per frame, no animated full-screen blur and no WebGL dependency were introduced. Intersection/visibility handling pauses optional ribbon movement off-screen and in hidden tabs. OS and application reduced-motion settings produce a static composition. Native scrolling is preserved; existing landing section reveals and network illustration are reused.

## 5. Research and design decisions

The supplied images informed emerald/copper material depth and layered financial hierarchy, not a copy of the reference brand or sample values.

- [Figma's 2026 web design trends](https://www.figma.com/resource-library/web-design-trends/): selected stronger typography, dark-mode parity and restrained motion. Rejected experimental navigation and maximalism for everyday financial work.
- [Linear product interface](https://linear.app/features) and [SaaSUI's pattern library](https://www.saasui.design/): informed the decision to keep compact navigation and put high-priority information ahead of decorative surfaces. This is an original application of the references, not a reproduced template.
- [Stripe dashboard guidance](https://docs.stripe.com/dashboard/basics): retained clear separation between overview, records, filters and actions, with exact financial values and explicit statuses.
- [Apple material guidance](https://developer.apple.com/design/human-interface-guidelines/materials): used bounded depth and highlights to separate surfaces while keeping text on solid, readable backgrounds.
- [Motion useScroll](https://motion.dev/docs/react-use-scroll) and [useSpring](https://motion.dev/docs/react-use-spring): used motion values for scroll/pointer response without render-per-pointer-event state updates.

## 6. Verification and responsive fixes

| Verification | Actual result |
| --- | --- |
| Unit/integration suite | 139 passed across 12 files |
| Existing browser regression suite | 17 passed |
| New Atelier browser regressions | 2 passed |
| Responsive scan | 648 checks passed across 18 routes, 9 widths, 2 languages and 2 themes |
| TypeScript | Passed |
| Production build | Passed using supported Node 24 and `next build --webpack` |
| Live branch verification | Passed: 5 records, no fabricated history, contact editor, admin filters, assignment menus, search, email center and role isolation |

Widths: 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px. Routes include landing/auth, all three dashboards, branch/vendor management, invoices, expense entry, reports, settings and the Email Delivery Center. No document-level horizontal overflow or clipped metric amounts were detected. Financial tables may scroll inside their own containers.

Specific improvements include wrapping full branch/vendor names, stacking mobile record amounts instead of squeezing them beside titles, single-column mobile bento layout, preserving LTR financial data inside Urdu pages and keeping critical controls stable on hover. The vendor dashboard's invoice panel now fits its content instead of stretching into a large empty area beside the activity column. The new browser tests check unchanged card dimensions on hover and both reduced-motion modes.

Visual review caught a branded landing panel losing text contrast under the new shared surface gradient; it now has an explicit emerald material. A live console check also exposed random invoice-row DOM IDs; these now use stable React IDs for label association, with no financial calculation changes. One new test initially used the wrong translated field label and passed after correcting its selector.

The first post-import screenshots revealed an old Prisma client cached by the long-running dev servers. Both project servers were restarted; the second phones and office hours were then verified in the live UI. Screenshot capture also initially hid input carets before hydration, producing a test-induced warning; capture now preserves caret styles. Final live checks produced no such warnings.

## 7. Before/after evidence

Matched 1440px desktop and 390px mobile captures are under `screenshots/atelier-before` and `screenshots/atelier-after`: landing light/dark, executive dashboard light/dark, branch management light/dark, employee/vendor dashboards, invoice list, mobile dashboard and Urdu RTL dashboard. Initial full-page before images capture the original above-fold state; their off-screen reveal sections may be hidden. Final after captures scroll through the page so all reveals are visible. Compare the same above-fold regions for the visual transformation.

Additional live application screenshots show the actual company offices:

- `screenshots/atelier-after/company-branches-light.png`
- `screenshots/atelier-after/company-branches-dark.png`
- `screenshots/atelier-after/company-branches-mobile.png`

Representative landing, executive, branch and Urdu views were opened and visually inspected, not merely generated. Machine-readable responsive results are in `screenshots/atelier-responsive.json`.

## 8. Preserved behavior and remaining limits

Authentication, registration approval, employee ownership restrictions, vendor assignment restrictions, financial calculations, invoice PDF generation, payment tracking, reconciliation, audit history, email infrastructure, preferences and localization remain in place. No database was reset and no real-office financial transactions were invented.

The application runs at **http://localhost:3001**. The isolated demo/test UI uses port 3002. Sign in as Super Admin and open `/admin/branches` to see the five imported offices.

I-9/2's missing details still require confirmation. Employees/vendors remain unassigned to the new branches until an administrator deliberately assigns them. Validation used Chromium/Playwright on this Windows environment; a cross-browser/device performance certification is not claimed. The previously documented SMTP/domain prerequisites remain: local email previews are not real delivery. The project continues to use its working Webpack production build configuration.
