# Financial policy

## Arithmetic

- All money is `NUMERIC` in PostgreSQL and `decimal.js` in code. JavaScript floats are never used for amounts.
- Currency precision: 2 decimals (configurable per currency in `CURRENCY_PRECISION`).
- Rounding: **ROUND_HALF_UP**, applied per line at each stage.

## Invoice line

```
line subtotal = round(quantity × unit price)
taxable       = line subtotal − line discount        (discount is absolute, applied BEFORE tax, ≤ subtotal)
line tax      = round(taxable × tax rate / 100)
line total    = taxable + line tax
```

## Invoice totals

```
subtotal       = Σ line subtotal
discount total = Σ line discount
tax total      = Σ line tax
grand total    = subtotal − discount total + tax total   (= Σ line totals)
```

Totals are always recomputed on the server; client-submitted totals are never accepted.
A submitted invoice stores an immutable snapshot of its header, lines and totals (one entry per submitted version).

## Payments

- Only APPROVED or PARTIALLY_PAID invoices accept payments. **Approval is not payment.**
- `outstanding = grand total − Σ payment entries`. A payment greater than the outstanding balance is rejected.
- Payment rows are immutable. A correction is a new negative `CORRECTION` entry that reverses one payment.
- Status follows the balance: 0 paid → APPROVED, partly paid → PARTIALLY_PAID, fully paid → PAID.

## Reporting aggregation (what "approved spending" means)

```
approved spending (period) =
    Σ employee expenses with status APPROVED, by expense date,
      EXCLUDING expenses actively reconciled as DUPLICATE_OF a vendor invoice
  + Σ vendor invoices with status APPROVED / PARTIALLY_PAID / PAID (grand total), by invoice date
```

- Drafts, SUBMITTED, UNDER_REVIEW, REJECTED and REVISION_REQUESTED records are never in approved totals.
- "Pending" = SUBMITTED + UNDER_REVIEW. "Outstanding" = Σ (grand total − paid) of APPROVED/PARTIALLY_PAID invoices.
- Reporting currency is PKR; records in other currencies are excluded from PKR totals, never converted silently.
- Period comparisons are shown only when the previous period has data ("No previous-period data" otherwise).

## Avoiding double counting

An employee may record a purchase that a vendor also invoices. A Super Admin links them from the invoice page:

- `DUPLICATE_OF` — the expense is excluded from approved totals (the invoice counts).
- `RELATED` — informational only, both count.

Links are audited and can be removed (soft-unlinked, history kept).
