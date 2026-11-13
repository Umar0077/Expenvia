# Phase 12 development report

Date: 12 November 2026

Implemented and locally verified. Real SMTP delivery remains unverified because no production SMTP credentials or sending-domain access were supplied. Local messages are explicitly recorded as PREVIEWED, never SENT.

## A. Features implemented

- Durable transactional email outbox, SMTP provider adapter, private development previews and a separate background worker.
- Email verification, password reset and password-change alerts. Normal registration now requires verification followed by administrator approval. Public signup/reset responses do not reveal whether an account exists.
- Employee/vendor registration receipts, administrator review notifications, approval/rejection/information-request messages, suspension/reactivation and branch assignment/removal notifications.
- Expense submission, approval, rejection and revision notifications; invoice submission confirmation, administrator review, approval/rejection/revision, payment-record and payment-correction notifications. Payment wording distinguishes recorded bookkeeping from receipt of money.
- Twenty-five templates in English and Urdu, each with HTML and plain-text versions, escaped dynamic values, authenticated links, Expenvia branding and RTL presentation. Stored recipient language is used when rendering.
- Independent email preference categories for expenses, invoices, branches and activity, using the existing settings toggles. Security and essential account messages remain mandatory.
- Super Admin Email Delivery Center at `/admin/email-delivery`: status counts, event/status/date/recipient filters, pagination, masked addresses, safe metadata, failure categories, bounded retry and automatic refresh. Message payloads and security links are excluded.

## B. Existing functionality reused

Integrated the existing authentication/token/session services, registration approval service, organization/branch service, expense and invoice workflows, payment records, notification dispatcher, audit log and PostgreSQL rate limiter. Existing in-app notifications remain independent of email preferences. Financial calculations and PDF behavior were not replaced. The delivery center reuses the app shell, role authorization, typography, colors, themes and translations.

The earlier navigation-error regression is covered by browser testing, and the Next.js development badge remains disabled.

## C. Database changes

Additive migration: `prisma/migrations/20261112190000_email_outbox/migration.sql`.

- Added `EmailStatus` and `email_outbox`, with recipient/event metadata, encrypted payload, idempotency key, attempts, leases, timestamps, provider reference and safe failure category.
- Added four email preference columns with default-true values.
- Added indexes and the recipient-user relationship; regenerated Prisma client.

No database reset was performed. Counts immediately before and after applying the migration were unchanged:

| Local database | Users | Expenses | Invoices | Payments |
| --- | ---: | ---: | ---: | ---: |
| Application | 9 | 1 | 0 | 0 |
| Demo | 15 | 182 | 43 | 39 |
| Integration test | 540 | 84 | 79 | 28 |

Subsequent automated tests create fictional records in demo/test databases. These counts describe migration preservation, not final post-test totals. Production deployment should take a backup first. Rollback means stopping workers and reverting code while retaining the additive schema, backlog and encryption key; do not drop queued data. See `EMAIL.md` for the full procedure.

## D. Email architecture

Business services enqueue within their database transaction. Transport work happens only in the independent worker, so an SMTP outage cannot undo an already committed expense, invoice or payment. Unique event/recipient keys and existing business idempotency prevent duplicate enqueueing.

Claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, a claim identifier and a 120-second lease. The bounded send transaction holds the row lock so another worker cannot send the same row concurrently. Stale claims recover after crashes. Temporary failures use exponential retry; permanent failures stop; five automatic attempts and at most two administrator retry extensions bound processing. Administrative retries exclude authentication links.

The provider abstraction currently supports Nodemailer SMTP and local private files. SMTP acceptance yields SENT; it does not prove inbox delivery. Development files yield PREVIEWED. Successful/cancelled jobs purge encrypted payloads. Metadata remains available for operations.

SMTP has an unavoidable acceptance/commit crash window: recovery can duplicate a message after the remote server accepted it but local state did not commit. Stable Message-ID helps investigation but is not an exactly-once guarantee.

## E. Security

- Authentication tables store token hashes; reset links expire after one hour and verification links after 24 hours. Token consumption and corresponding account changes are transactional.
- Delivery payloads use AES-256-GCM encryption. Production requires an explicit shared encryption key. Administrators cannot view raw tokens or decrypted bodies in the delivery center.
- Password reset revokes all sessions; a signed-in password change revokes other sessions. Verification does not approve an account or grant a role.
- Existing database-backed abuse limits remain in place; verification adds an IP limit, resends add a cooldown, and administrator retry is rate limited and audited.
- Worker processing rechecks recipient eligibility, preferences and relevant record ownership. Public rejection explanations are kept separate from internal notes.
- Trusted application origin validation, HTTPS in production, escaped content, header-injection rejection, TLS certificate verification and disabled remote/file attachment access protect delivery.
- Logs contain safe categories/IDs, not SMTP credentials or raw auth links. Next.js development argument/request logging is disabled to avoid logging passwords and token query strings. Reverse proxies/APM still require equivalent production redaction.
- Queue creation, terminal failures, administrator retry and non-secret configuration changes are audited. Secrets are never included in configuration audit entries.

## F. Actual validation results

| Check | Result |
| --- | --- |
| TypeScript | Passed standalone typecheck and production build typecheck |
| Unit and integration tests | 136 passed across 11 files |
| Complete Playwright regression suite | 17 passed; final run 1.7 minutes |
| Synthetic email viewport checks | 100 passed: 50 localized templates at 375px and 1024px |
| Production build | Webpack passed; all 44 pages generated, using Node 24 |
| Running application | HTTP 200 from `http://localhost:3001/login` |

Integration coverage includes transaction rollback, duplicate enqueue protection, preferences, recipient eligibility, encrypted tokens, used/expired links, session revocation, concurrent claims and processing, stale claims, retry limits, public/private rejection content, employee/vendor account decisions, branch changes, expense decisions, invoice decisions and partial-payment idempotency. Provider success/failure behavior was tested with controlled adapters, not a real external SMTP mailbox.

Browser coverage includes signup → private email preview → verification, password reset, preference persistence, protected admin delivery metadata, navigation without the reported React error, existing role isolation, English/Urdu, light/dark themes and mobile overflow checks. Representative desktop/mobile templates and delivery-center screenshots were visually inspected. Screenshots are in `screenshots/phase12-*.png` and `screenshots/email-*.png`.

Initial browser runs exposed cold-compilation/timeouts under parallel workers and a strict preference-label selector. Tests now run sequentially against the isolated demo server, clear demo-only rate-limit buckets, and use the corrected accessible selector. The final complete run passed.

Turbopack production compilation repeatedly crashed while spawning its CSS processing worker on this Windows environment, including with supported Node 24. Webpack completed successfully. `npm run build` now explicitly uses `next build --webpack`; the Turbopack failure itself is not claimed fixed. System Node 23 is outside the project's supported engines; use Node 24 LTS (or another supported engine).

## G. Configuration and local operation

The application is available on port **3001**. The delivery center is available to a signed-in Super Admin at `http://localhost:3001/admin/email-delivery`. The regular local worker is running with development previews; restart it with `npm run email:worker` when needed. The browser-test server uses port 3002 and the separate demo database.

Required production settings:

| Variable | Required value |
| --- | --- |
| `DATABASE_URL` | Same target PostgreSQL database for web and worker |
| `EMAIL_PROVIDER` | `smtp` |
| `APP_PUBLIC_URL` | Public HTTPS application origin |
| `EMAIL_FROM_NAME` | Sender display name |
| `EMAIL_FROM_ADDRESS` | Provider-approved sender address |
| `SMTP_HOST`, `SMTP_PORT` | Provider endpoint and port |
| `SMTP_SECURE` | Correct implicit TLS / STARTTLS setting for that endpoint |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP credentials, supplied through secret management |
| `EMAIL_ENCRYPTION_KEY` | Shared 64-character hex key for web and worker |
| `STORAGE_DIR` | Private, non-public directory for local development files |

Commands: `npm run db:deploy`, `npm run db:generate`, `npm run build`, and a separately supervised `npm run email:worker`. To inspect fictional templates, run `npm run email:preview`, then `node scripts/check-email-previews.mjs`. Do not publish private authentication previews.

## H. Pending external work and limitations

1. Supply SMTP credentials, verify sender/domain ownership and configure SPF, DKIM and DMARC with the chosen provider.
2. Configure the production public URL and shared encryption key; deploy and supervise web/worker processes with the documented shutdown grace period.
3. Perform a controlled live send and inspect actual provider acceptance, inbox/spam placement, links and rendering in target email clients. No real delivery, DNS validation, Gmail/Outlook rendering or deliverability has been claimed.
4. Define operational retention for failed encrypted payloads and private previews, monitoring/alerts and encryption-key backup/rotation. Automatic retention cleanup and bounce/webhook processing are not implemented.
5. SMTP acceptance is not proof of delivery. Exactly-once delivery across SMTP and database commits is not guaranteed.

Operational details, deployment/rollback guidance and troubleshooting: `docs/EMAIL.md`.
