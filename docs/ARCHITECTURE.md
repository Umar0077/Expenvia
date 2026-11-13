# Architecture

## Layers

| Layer | Location | Notes |
|---|---|---|
| Routes / pages | `src/app` | Server Components. Every protected page calls `requireActor(role)` itself. |
| Server Actions | `src/server/actions` | Thin: validate (Zod) → call service → revalidate. `runAction` maps domain errors to translation keys. |
| Services | `src/server/services` | Business logic, transactions, auditing, notifications. Framework-free → integration-tested. |
| Authorization | `src/server/authz/policy.ts` | Pure deny-by-default policy functions (unit-tested). `loadSubject` loads branch/vendor facts. |
| Financial math | `src/lib/finance/money.ts` | decimal.js only — never JS floats. Shared by client (live totals) and server (authoritative). |
| Validation | `src/lib/validation` | Shared Zod schemas; messages are translation keys. |
| UI | `src/components` | Design system (`ui/`), feature components, charts. |
| Motion | `src/lib/motion.ts` | Single source of durations/springs ("Expenvia Fluid Motion"). |
| i18n | `src/i18n`, `messages/<locale>[/area].json` | Cookie-based locale, no URL prefix → stable URLs. |

## Request security model

1. `src/proxy.ts` only does an *optimistic* redirect when no session cookie exists and tags requests with `x-request-id`.
2. `getSessionState()` resolves the session (SHA-256 token hash lookup, expiry, revocation, account status).
3. Pages/actions call `requireActor(role)`; resource access uses `policy.*` with facts loaded server-side
   (ownership, branch assignment, vendor assignment). IDs from URLs/bodies are never trusted.
4. Denials raise `AccessDenied`; `withDenialAudit` records a `DENIED` audit row **after** the transaction rolls back.
5. Missing and forbidden records return the same 404 so IDs can't be probed.

Hidden navigation is UX only; it is never relied on for security.

## Data integrity guarantees (enforced by PostgreSQL)

Defined in `prisma/migrations/*_init/migration.sql`:

- `audit_logs`, `invoice_payments`, `expense_status_history`, `invoice_status_history` are **append-only** (UPDATE/DELETE/TRUNCATE raise).
- Invoice line items cannot change once the invoice leaves DRAFT/REVISION_REQUESTED.
- One active branch per employee; one active assignment per vendor/branch (partial unique indexes).
- Invoice/expense numbers come from Postgres sequences (concurrency-safe).
- CHECK constraints: positive amounts/quantities, tax 0–100, discount ≤ line subtotal, `amount_paid ≤ grand_total`.

## Concurrency

- Status transitions use conditional `UPDATE … WHERE status IN (…)`; only one concurrent approval can win.
- Payments lock the invoice row (`SELECT … FOR UPDATE`) before checking the balance; tested with 5 parallel payments.
- Payments are idempotent by `idempotencyKey` (one key per dialog session in the UI).
- Drafts use optimistic `version` checks → `staleRecord` on conflicting edits.

## Files

Private storage under `STORAGE_DIR` (outside `/public`), generated keys, type detection by magic bytes
(PDF/JPEG/PNG/WEBP), 5 MB limit, authorized download route with `nosniff` + sandboxing CSP.
Swap `src/server/storage.ts` for S3/Azure/GCS in production. Malware scanning: hook point in `storeUpload` (not bundled).

## Invoice documents & PDF

`src/server/invoice-document.ts` renders one self-contained HTML document (embedded fonts, escaped vendor text,
`<bdi>` isolation for mixed scripts). It is used for both the in-app preview and the PDF, which headless Chromium
(`src/server/pdf.ts`) prints on A4 with repeated table headers and page numbers. Vendor-provided descriptions are
never translated or rewritten; only labels are localized.

## Localization

Locale lives in the `NEXT_LOCALE` cookie (and `user_preferences`). Switching calls a server action and
`router.refresh()` — no full reload. Urdu sets `lang="ur" dir="rtl"`; layout uses logical CSS properties;
Latin data (emails, IDs, money) is isolated with `.ltr-data` / `dir="ltr"`. Urdu uses Noto Naskh Arabic for UI and
Noto Nastaliq Urdu for headings; digits stay Latin (`ur-PK-u-nu-latn`) so amounts read unambiguously.
