# Expenvia

Multi-branch enterprise expense, vendor-invoice and approval platform — English + اردو (RTL), light + dark.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Radix primitives · Motion · Recharts ·
PostgreSQL 17 + Prisma 7 · next-intl · Argon2id · Playwright (E2E + PDF rendering) · Vitest.

## Quick start (local)

Requires **Node 20.19+, 22.12+ or 24+** and Docker.

```bash
cp .env.example .env            # then edit values
npm install                     # also generates the Prisma client
npm run db:up                   # Postgres on localhost:5433
npm run db:deploy               # apply migrations
npx playwright install chromium # needed for PDF invoices
```

Create the one and only bootstrap Super Admin (sign-up can never request this role):

```bash
# set BOOTSTRAP_ADMIN_EMAIL / _NAME / _PASSWORD in .env first, then remove them afterwards
npm run db:bootstrap-admin
npm run dev
```

## Demo environment (fictional data, separate database)

See [docs/DEMO.md](docs/DEMO.md). In short: `npm run db:reset-demo` then `npm run dev:demo -- 3002`.
Credentials are written to `.demo-credentials.txt` (gitignored) — never printed or hardcoded.

## Quick test accounts (local development)

Set `ALLOW_DEV_ACCOUNTS="true"` in `.env`, then run `npm run dev` (or `npm run dev:demo -- 3002` for the populated demo).
Open `/dev-access`, also linked from login and sign-up. Enter any valid email, a name, and a password of at least 6 characters.
Choose **Super Admin** to enter `/admin/dashboard` immediately, without email verification or approval.
Employee and Vendor accounts open their own workspaces. Use a different email for each account; existing accounts can sign in at `/login` with the password you chose.
This shortcut is disabled in production, even when the flag is set. Normal sign-up still requires verification and approval.

## Tests

| Command | What it covers |
|---|---|
| `npm run test` | Unit (money math, authorization policy, CSV) + integration against an isolated `expenvia_test` DB |
| `npm run db:test:migrate` | Prepares the test database (run once / after migrations) |
| `npm run test:e2e` | Playwright against the running demo server (role isolation, RTL, mobile overflow) |
| `npm run typecheck` / `npm run build` | Strict TypeScript and production build |

## Documentation

- [Architecture & security](docs/ARCHITECTURE.md)
- [Email outbox, worker, SMTP and local previews](docs/EMAIL.md)
- [Financial policy (rounding, aggregation, double counting)](docs/FINANCIAL-POLICY.md)
- [Demo environment](docs/DEMO.md)
- [Deployment & production readiness checklist](docs/DEPLOYMENT.md)
