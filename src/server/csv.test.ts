import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes, escapes and adds a BOM", () => {
    const out = toCsv(["a", "b"], [["x,y", 'he said "hi"']]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('"x,y","he said ""hi"""');
  });
  it("neutralizes spreadsheet formulas but keeps negative numbers", () => {
    const out = toCsv(["v"], [["=HYPERLINK(\"x\")"], ["-12.50"], ["@cmd"]]);
    expect(out).toContain("'=HYPERLINK");
    expect(out).toContain("\r\n-12.50\r\n");
    expect(out).toContain("'@cmd");
  });
  it("keeps Urdu text intact", () => {
    expect(toCsv(["نام"], [["دفتری سامان"]])).toContain("دفتری سامان");
  });
});
