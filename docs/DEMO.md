# Demo environment

Demo data is **fictional** and lives in its **own database** (`expenvia_demo`). It never touches real records.

## Safety rules (enforced by `scripts/seed-demo.ts`)

- Refuses when `NODE_ENV=production` or `ALLOW_DEMO_SEED` ≠ `true`.
- Refuses on any database that already contains non-demo branches.
- Every record is recognizable: branch codes `DEMO-*`, emails `@demo.expenvia.test`, names suffixed `(Demo)`,
  document numbers `EXP-INV-DEMO-*` / `EXP-EXP-DEMO-*`.
- No known passwords: a random password is generated per seed and written only to `.demo-credentials.txt` (gitignored, mode 600).

## Reset & run

```bash
# .env: DEMO_DATABASE_URL=postgresql://…/expenvia_demo   (name must contain "demo")
docker exec expenvia-db psql -U expenvia -d expenvia -c "CREATE DATABASE expenvia_demo;"   # first time only
npm run db:reset-demo          # drops demo schema, migrates, seeds fresh fictional data
npm run dev:demo -- 3002       # app at http://localhost:3002 against the demo DB
```

`.demo-credentials.txt` lists the Super Admin, 8 employees and 5 vendors (one shared demo password).
Delete the file after the presentation.

## What the demo contains

5 branches · 8 employees · 5 vendors with different branch coverage · ~180 expenses over 12 months (approved,
pending, rejected, revision requested, drafts) · ~40 invoices with line items (paid, partially paid, outstanding,
under review, rejected) · payments · audit history · one pending vendor registration · admin notifications.
