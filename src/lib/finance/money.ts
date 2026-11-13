/**
 * Exact decimal money arithmetic. Never use JS `number` for money.
 *
 * Rounding policy (documented in docs/financial-policy.md):
 *  - Currency precision defaults to 2 decimal places (configurable per currency).
 *  - Rounding mode: ROUND_HALF_UP ("commercial rounding").
 *  - Rounding happens per line at each stage: line subtotal, line tax.
 *    Invoice totals are sums of already-rounded line values, so the printed
 *    lines always add up to the printed totals.
 *  - Discount is an absolute amount per line, applied BEFORE tax.
 *  - Tax rate is a percentage applied to (line subtotal − line discount).
 */
import Decimal from "decimal.js";

const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof MoneyDecimal>;
export type DecimalInput = string | number | Dec | { toString(): string };

export const CURRENCY_PRECISION: Record<string, number> = {
  PKR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SAR: 2,
};

export function precisionFor(currency: string): number {
  return CURRENCY_PRECISION[currency.toUpperCase()] ?? 2;
}

export function dec(value: DecimalInput): Dec {
  if (value instanceof MoneyDecimal) return value;
  const str = typeof value === "number" ? String(value) : value.toString();
  const trimmed = str.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError(`Invalid decimal value: "${str}"`);
  }
  return new MoneyDecimal(trimmed);
}

export function roundMoney(value: DecimalInput, currency = "PKR"): Dec {
  return dec(value).toDecimalPlaces(precisionFor(currency), MoneyDecimal.ROUND_HALF_UP);
}

export function sum(values: DecimalInput[]): Dec {
  return values.reduce<Dec>((acc, v) => acc.plus(dec(v)), new MoneyDecimal(0));
}

/** Fixed-point string for DB writes / transport, e.g. "1250.00". */
export function toFixedString(value: DecimalInput, currency = "PKR"): string {
  return roundMoney(value, currency).toFixed(precisionFor(currency));
}

export class MoneyError extends Error {
  override name = "MoneyError";
}

export interface LineInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  taxRate?: DecimalInput; // percent
  discount?: DecimalInput; // absolute
}

export interface LineResult {
  lineSubtotal: Dec;
  discount: Dec;
  lineTax: Dec;
  lineTotal: Dec;
}

export function calculateLine(line: LineInput, currency = "PKR"): LineResult {
  const quantity = dec(line.quantity);
  const unitPrice = dec(line.unitPrice);
  const taxRate = dec(line.taxRate ?? 0);
  const discount = roundMoney(line.discount ?? 0, currency);

  if (quantity.lte(0)) throw new MoneyError("Quantity must be greater than zero");
  if (unitPrice.lt(0)) throw new MoneyError("Unit price cannot be negative");
  if (taxRate.lt(0) || taxRate.gt(100)) throw new MoneyError("Tax rate must be between 0 and 100");
  if (discount.lt(0)) throw new MoneyError("Discount cannot be negative");

  const lineSubtotal = roundMoney(quantity.times(unitPrice), currency);
  if (discount.gt(lineSubtotal)) throw new MoneyError("Discount cannot exceed the line subtotal");

  const taxable = lineSubtotal.minus(discount);
  const lineTax = roundMoney(taxable.times(taxRate).dividedBy(100), currency);
  const lineTotal = taxable.plus(lineTax);

  return { lineSubtotal, discount, lineTax, lineTotal };
}

export interface InvoiceTotals {
  lines: LineResult[];
  subtotal: Dec;
  discountTotal: Dec;
  taxTotal: Dec;
  grandTotal: Dec;
}

/** grandTotal = subtotal − discounts + taxes */
export function calculateInvoice(lines: LineInput[], currency = "PKR"): InvoiceTotals {
  const results = lines.map((l) => calculateLine(l, currency));
  const subtotal = sum(results.map((r) => r.lineSubtotal));
  const discountTotal = sum(results.map((r) => r.discount));
  const taxTotal = sum(results.map((r) => r.lineTax));
  const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);
  return { lines: results, subtotal, discountTotal, taxTotal, grandTotal };
}

/** Outstanding = approved grand total − Σ recorded payment entries (incl. corrections). */
export function outstandingBalance(grandTotal: DecimalInput, paymentEntries: DecimalInput[]): Dec {
  return dec(grandTotal).minus(sum(paymentEntries));
}

/** Throws if recording `amount` would overpay the invoice. */
export function assertPaymentAllowed(
  grandTotal: DecimalInput,
  existingEntries: DecimalInput[],
  amount: DecimalInput,
): Dec {
  const amt = dec(amount);
  if (amt.lte(0)) throw new MoneyError("Payment amount must be greater than zero");
  const outstanding = outstandingBalance(grandTotal, existingEntries);
  if (amt.gt(outstanding)) throw new MoneyError("Payment exceeds the outstanding balance");
  return outstanding.minus(amt);
}
