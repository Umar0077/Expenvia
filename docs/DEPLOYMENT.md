# Deployment

## Requirements

- Node 20.19+ / 22.12+ / 24+ · PostgreSQL 15+ · Chromium for PDFs (`npx playwright install --with-deps chromium`)
- Persistent private storage for `STORAGE_DIR` (or replace `src/server/storage.ts` with object storage)

## Steps

```bash
npm ci
npx prisma migrate deploy          # never `migrate dev` in production
npx playwright install --with-deps chromium
npm run build
NODE_ENV=production npm start      # behind HTTPS
```

Bootstrap the first Super Admin once with `npm run db:bootstrap-admin`, then remove the `BOOTSTRAP_*` variables.

## Environment

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Least-privilege app role (no superuser; owner of the schema only for migrations) |
| `APP_URL` | Public HTTPS origin used in email links |
| `SESSION_TTL_HOURS` | Session lifetime (default 12) |
| `STORAGE_DIR` | Private directory, not web-served, backed up |
| `EMAIL_PROVIDER` | Empty = no email is sent (UI says so). Implement `deliver` in `src/server/mail.ts` |
| `ALLOW_DEMO_SEED` | Must be `false` in production |

## Production readiness checklist

Done in code:

- [x] Argon2id hashing, hashed session tokens, HTTP-only `SameSite=Lax` cookies, `Secure` in production
- [x] Server-side authorization on every page, action, file and export route; DENIED attempts audited
- [x] Rate limiting (Postgres-backed) on sign-in, sign-up, verification resend, password reset/change
- [x] Server Actions' built-in Origin check (CSRF) for all mutations; GET routes are read-only
- [x] Security headers: CSP, HSTS (prod), `nosniff`, `X-Frame-Options: DENY`, Referrer- and Permissions-Policy
- [x] Append-only audit log, payments and status histories enforced by database triggers
- [x] Upload allowlist by magic bytes, size limits, private storage, authorized downloads
- [x] CSV export formula-injection protection; exports audited
- [x] No secrets in client bundles; `.env` gitignored; demo data isolated

Before going live:

- [ ] Serve only over HTTPS; set `APP_URL` to the HTTPS origin
- [ ] Configure an email provider (verification & password reset currently log links in development only)
- [ ] Replace local storage with object storage + malware scanning (hook in `storeUpload`)
- [ ] Nonce-based CSP to remove `'unsafe-inline'` for scripts
- [ ] Automated, encrypted PostgreSQL backups with restore drills
- [ ] Restrict DB network access; separate migration role from runtime role
- [ ] Central log shipping/alerting for `DENIED` audit events and 5xx errors
- [ ] Run `npm run test`, `npm run test:e2e` and `npm run build` in CI on every change
