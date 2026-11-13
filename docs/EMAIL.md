# Email operations — Phase 12

## Architecture

The existing auth, registration, organization, expense, invoice and payment services persist email events inside their database transactions. `notifyUsers` retains in-app preference behavior and independently evaluates email preferences. Business services never contact SMTP. Outbox persistence failure prevents a partial commit; transport failure after commit cannot undo financial work.

`src/server/email/service.ts` batches recipient snapshots, saved language, event metadata and AES-256-GCM encrypted message payloads into `email_outbox`. Each event/recipient has a unique idempotency key. Business state transitions and payment idempotency prevent duplicate event creation. New submissions/revisions and distinct payments intentionally produce new events.

`provider.ts` defines the adapter contract. Nodemailer is the SMTP adapter; development writes private HTML/text previews and records **PREVIEWED**, never SENT. **SENT means SMTP accepted the message**, not inbox delivery or proof that someone read it. There is no bounce/webhook integration yet.

## Configuration

| Variable | Purpose |
| --- | --- |
| `EMAIL_PROVIDER` | `development` (default outside production) or `smtp` |
| `APP_PUBLIC_URL` | Trusted origin for links and public brand assets; HTTPS required in production. `APP_URL` is a legacy fallback. Match the local server port. |
| `EMAIL_FROM_NAME` | Sender display name (default Expenvia) |
| `EMAIL_FROM_ADDRESS` | SMTP-verified sender address |
| `SMTP_HOST`, `SMTP_PORT` | SMTP endpoint; usually port 587 |
| `SMTP_SECURE` | `true` for implicit TLS (typically 465); `false` for STARTTLS (typically 587) |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider credentials; secret manager/environment only |
| `EMAIL_ENCRYPTION_KEY` | Exactly 64 hex characters (32 cryptographically random bytes); same value on web and workers |
| `STORAGE_DIR` | Private filesystem storage; default `storage` |

Production refuses the development provider, missing SMTP credentials, missing encryption key, insecure URLs and invalid sender headers. SMTP requires TLS and verifies certificates. Never enable Nodemailer debug logging in production. Configuration changes to provider/from/origin are audited without storing credentials. Credential rotations are operational secret-manager events; values are never audited in the app.

Next.js development server-function argument logging and incoming-request logging are disabled in `next.config.ts`: arguments may contain passwords and auth-link query strings contain tokens. Configure production reverse proxies/APM to redact these query strings and request bodies as well. Do not enable request-body capture on auth routes.

Generate a production key with a secure secret-manager generator or `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in a private terminal. Never commit the output. Back up the key with the database. To rotate, drain the queue first or retain the old key until queued messages have completed. Changing keys before draining makes existing payloads undecryptable; failed metadata remains available.

## Worker

```sh
npm run db:deploy
npm run db:generate
npm run email:worker
# Drain currently due jobs and exit (future retries require another invocation):
npm run email:worker -- --once
```

Use the same DATABASE_URL, APP_PUBLIC_URL, encryption key and SMTP config as the web process. For the demo database, explicitly set DATABASE_URL to DEMO_DATABASE_URL before starting the worker. Never run a development worker against production data.

Supervise the worker as a separate systemd/container process with restart-on-failure and SIGTERM grace of at least 100 seconds. It finishes the current bounded send before exit and stops claiming new work. One worker sends sequentially; scale by adding processes, sized against PostgreSQL connection capacity. Do not attach this loop to a web request or serverless route. Poll interval is two seconds.

Claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, a claim UUID and a 120-second lease. The send transaction holds a row lock; recovering workers also skip locked rows, preventing concurrent delivery even if a lease expires while a provider is slow. SMTP connection/greeting/socket timeouts are bounded; the transaction has a 90-second limit. Worker crashes release locks, and stale claims become recoverable after the lease. A stale claimant cannot send after another worker has acquired the job.

Retries start at 30 seconds and double up to one hour. Five attempts are allowed automatically. Permanent authentication/recipient-policy failures stop immediately. Admin retry can add five attempts at most twice, retains history, and is audited/rate-limited. Authentication links cannot be retried administratively: use the user's resend/reset flow to generate a fresh token. Expired/used links, changed recipient emails, disabled optional preferences and unauthorized recipients are cancelled before sending.

SMTP cannot guarantee exactly once: if a provider accepts a message but the connection or subsequent database commit fails, recovery may send it again. Stable Message-ID reduces ambiguity but does not guarantee provider deduplication. Row locks prevent intentional concurrent sends, not this crash window.

## Local development and template previews

No SMTP credentials are needed for local development. `EMAIL_PROVIDER=development` creates private `storage/email/previews/<message-id>.html` and `.txt` files when the worker processes a job. Logs print only the message ID and “NOT delivered”. Open the files directly on the development machine to follow auth links. Do not share these files: they can contain active security links. They are never routed through the website, even to administrators.

`npm run email:preview` renders every English and Urdu template with fictional values into `storage/email/template-previews`. It does not create accounts, queue jobs or contact SMTP. Check the static HTML at mobile and desktop widths; previews contain HTML and text alternatives, safe escaping, table layout, the public light logo, localized statuses/currency and RTL support.

## Delivery center and preferences

`/admin/email-delivery` requires an active Super Admin on the server. It shows global status counts, masked recipients, event/date/status/search filters, paginated metadata, safe failure categories and eligible retry actions. It refreshes every 15 seconds while visible. It never selects payloads or authentication tokens. Records carry the original recipient locale so a queued email remains consistent with its event.

Settings retain the existing JellyToggle controls. Expense, invoice, branch and activity email preferences are independent of in-app preferences and are checked again at send time. Verification, reset, password-change, registration receipt and essential account-status messages cannot be disabled.

## Authentication and authorization

Auth tables store only token hashes, with one-hour reset / 24-hour verification lifetimes. The outbox stores the delivery link only within authenticated encrypted ciphertext; successful/cancelled jobs purge this payload. Verification/reset consumption and state changes occur atomically. New registrations require verification and separate admin approval; verification never grants a role. Signup/reset public confirmations do not disclose whether an email exists. Existing PostgreSQL rate limits cover login, signup, resend and reset; resend adds a 60-second cooldown. Verification uses an explicit POST so email scanners do not consume links.

Password reset revokes all sessions; a signed-in password change retains the current session and revokes the others. Both queue a security notice. Rejections include only public explanations. Financial email events include minimal record details and authenticated deep links, not documents or attachments. Payment emails say “Payment Recorded”, distinguish partial balances, and never assert receipt of funds. Worker authorization rechecks active admin status and expense/invoice ownership.

## Migration and rollback

`20261112190000_email_outbox` adds one enum, one outbox table with indexes/FK, and four default-true preference columns. It does not reset or modify financial records. `scripts/migrate-phase12.mjs` deploys to configured local databases and verifies users/expenses/invoices/payments counts before and after. Normal deployment uses `prisma migrate deploy`.

Before production deployment take a database backup and deploy the migration before new application code. On rollback stop workers and revert application code; retain the additive table/columns and encrypted backlog. Do not drop the outbox to “roll back”: doing so loses queued messages and audit context. Re-enable processing only after resolving code/configuration compatibility. Retain the encryption key. Expired security messages cancel naturally on processing. Failed payloads need an organization-defined retention period; do not expose database backups or preview directories publicly.

## Troubleshooting and go-live

The production build script uses `next build --webpack`. Turbopack's CSS worker crashed locally on Windows even under supported Node 24; Webpack completed the production build. Use a supported Node version listed in `package.json`. See `PHASE12-REPORT.md` for verification results.

- Pending queue: check worker process, matching database, next-attempt time and database access.
- PREVIEWED: no message was emailed. Configure SMTP and create a new event; previews are not silently resent.
- AUTHENTICATION: verify SMTP credentials, sender permissions and TLS/port pairing.
- RECIPIENT_OR_POLICY: check the provider's own restricted logs, verified sending domain and recipient validity. App logs intentionally omit raw SMTP error text.
- PAYLOAD_OR_CONFIGURATION: confirm shared encryption key and trusted public URL. Do not discard old keys with queued messages.
- CANCELLED: security link expired/used, recipient changed, optional category disabled, or recipient lost access.
- Configure SPF, DKIM and DMARC with the selected email provider and domain administrator. Verify a sender/domain, confirm DNS, and perform a controlled live send before claiming production delivery. Production credentials/domain access are external prerequisites.

Reference: [Nodemailer SMTP transport](https://nodemailer.com/smtp) and [PostgreSQL SELECT locking](https://www.postgresql.org/docs/current/sql-select.html).
