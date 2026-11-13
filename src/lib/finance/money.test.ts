import { describe, expect, it } from "vitest";
import {
  assertPaymentAllowed,
  calculateInvoice,
  calculateLine,
  MoneyError,
  outstandingBalance,
  sum,
  toFixedString,
} from "./money";

describe("calculateLine", () => {
  it("multiplies without floating-point drift", () => {
    // 0.1 * 3 is 0.30000000000000004 in binary floating point
    const r = calculateLine({ quantity: "3", unitPrice: "0.10" });
    expect(r.lineSubtotal.toFixed(2)).toBe("0.30");
    expect(r.lineTotal.toFixed(2)).toBe("0.30");
  });

  it("applies discount before tax and rounds half-up", () => {
    // subtotal 3 × 333.335 = 1000.005 → 1000.01; less 100.01 → 900.00; tax 17% = 153.00
    const r = calculateLine({ quantity: "3", unitPrice: "333.335", discount: "100.01", taxRate: "17" });
    expect(r.lineSubtotal.toFixed(2)).toBe("1000.01");
    expect(r.lineTax.toFixed(2)).toBe("153.00");
    expect(r.lineTotal.toFixed(2)).toBe("1053.00");
  });

  it("rounds tax half-up at the cent", () => {
    // 10.05 × 5% = 0.5025 → 0.50 ; 10.10 × 5% = 0.505 → 0.51
    expect(calculateLine({ quantity: 1, unitPrice: "10.05", taxRate: 5 }).lineTax.toFixed(2)).toBe("0.50");
    expect(calculateLine({ quantity: 1, unitPrice: "10.10", taxRate: 5 }).lineTax.toFixed(2)).toBe("0.51");
  });

  it("rejects invalid input", () => {
    expect(() => calculateLine({ quantity: 0, unitPrice: 1 })).toThrow(MoneyError);
    expect(() => calculateLine({ quantity: 1, unitPrice: -1 })).toThrow(MoneyError);
    expect(() => calculateLine({ quantity: 1, unitPrice: 10, discount: 11 })).toThrow(MoneyError);
    expect(() => calculateLine({ quantity: 1, unitPrice: 10, taxRate: 101 })).toThrow(MoneyError);
    expect(() => calculateLine({ quantity: "abc", unitPrice: 10 })).toThrow(MoneyError);
    expect(() => calculateLine({ quantity: "1e5", unitPrice: 10 })).toThrow(MoneyError);
  });
});

describe("calculateInvoice", () => {
  it("totals equal the sum of printed lines", () => {
    const t = calculateInvoice([
      { quantity: "2", unitPrice: "1500", taxRate: "17", discount: "100" },
      { quantity: "12.5", unitPrice: "48.40", taxRate: "0" },
      { quantity: "1", unitPrice: "9999.99", taxRate: "5" },
    ]);
    expect(t.subtotal.toFixed(2)).toBe("13604.99"); // 3000 + 605 + 9999.99
    expect(t.discountTotal.toFixed(2)).toBe("100.00");
    expect(t.taxTotal.toFixed(2)).toBe("993.00"); // 493.00 + 0 + 500.00
    expect(t.grandTotal.toFixed(2)).toBe("14497.99");
    expect(sum(t.lines.map((l) => l.lineTotal)).toFixed(2)).toBe(t.grandTotal.toFixed(2));
  });
});

describe("payments", () => {
  it("tracks partial payments and corrections", () => {
    expect(outstandingBalance("1000.00", ["400.00", "100.00"]).toFixed(2)).toBe("500.00");
    // a correction entry of −100 reverses an earlier mistaken payment
    expect(outstandingBalance("1000.00", ["400.00", "100.00", "-100.00"]).toFixed(2)).toBe("600.00");
  });

  it("prevents overpayment", () => {
    expect(assertPaymentAllowed("1000", ["600"], "400").toFixed(2)).toBe("0.00");
    expect(() => assertPaymentAllowed("1000", ["600"], "400.01")).toThrow(MoneyError);
    expect(() => assertPaymentAllowed("1000", [], "0")).toThrow(MoneyError);
  });

  it("formats fixed strings for storage", () => {
    expect(toFixedString("12.345")).toBe("12.35");
    expect(toFixedString("7")).toBe("7.00");
  });
});
