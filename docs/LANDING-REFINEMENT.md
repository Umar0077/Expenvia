# Landing page refinement

13 November 2026

## Changes

1. **Light atmosphere:** the hero now has a warm ivory/sage base, stronger emerald ribbons, copper highlights, directional mesh lighting and the existing fine grain. The overlay no longer washes out the composition. These overrides are scoped to the public landing page; dark-mode hero styling is retained.
2. **Capabilities:** replaced plain panels with larger layered cards, directional corner geometry, emerald/copper edge accents, tinted icon tiles, numbered details, stronger headings and balanced spacing. Existing translated descriptions are retained. Scroll stagger/reveal is reused; hover now adds restrained lift, tilt, icon movement and edge emphasis without resizing the cards.
3. **Branch design:** selected a hybrid finance-hub and office-card panel. A compact connector motif sits above five readable cards on a section-specific sage/emerald background with fine diagonal geometry and copper light.
4. **Office names:** Shamsabad Office, Islamabad Office, Commercial Office, Iran Road Office and I-9/2 Office are shown with their supplied cities. Urdu displays localized names alongside the official English names. These are public presentation constants, not a database query exposing internal financial or assignment information.
5. **Motion:** retained spring-driven hero pointer response and slow aurora movement; added card hover lift and office-card staggered reveal. Reduced-motion fallbacks remain in place. No WebGL, new media dependency or financial/business change was introduced.
6. **Responsive layout:** capabilities collapse from three to two to one column; office cards become single-column on phones. Full office names wrap naturally. Padding, icon sizes and the hub heading adapt on small screens. Nine widths were checked: 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px.

## Evidence and validation

- Before: `screenshots/landing-before/hero-en-light.png`, `capabilities-en-light.png`, `branches-en-light.png`.
- After: corresponding files in `screenshots/landing-after`, plus all three sections in dark mode and Urdu, and `branches-mobile-ur.png`.
- Images were opened and reviewed, including the before/after capabilities comparison, the new light hero, the office panel, dark cards and mobile Urdu.
- Responsive scan: 36 width/theme/language combinations passed with no document overflow or browser errors; reduced-motion check passed.
- Existing landing-render and live Urdu-toggle browser tests: 2 passed.
- TypeScript: passed.
- Production build: passed using Node 24 and Webpack; all 44 pages generated.
- Live theme-toggle, sign-in/request-access links and all five office-name checks passed. Results are saved in `screenshots/landing-after/checks.json`.

The mobile section screenshot hides the sticky navigation only during image capture so it does not obscure the long section image; the live page retains its navigation. Existing logos, authentication links, theme/language controls and page structure remain. Dashboard components, database records, permissions, invoice calculations and email infrastructure were not changed.

No known unresolved visual defect was found in the reviewed Chromium views. Cross-browser/device performance certification was not performed. The hero dashboard mockup remains explicitly illustrative; the five-office panel uses real supplied office names.
