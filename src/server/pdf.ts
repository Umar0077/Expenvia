import "server-only";
import type { Browser } from "playwright";

/**
 * HTML → PDF with headless Chromium (correct Arabic-script shaping, bidi,
 * embedded fonts, multi-page tables with repeated headers). One shared
 * browser per server process; each render uses an isolated, offline page.
 */
const g = globalThis as unknown as { __expenviaBrowser?: Promise<Browser> };

async function browser(): Promise<Browser> {
  if (!g.__expenviaBrowser) {
    g.__expenviaBrowser = import("playwright").then(({ chromium }) => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
    g.__expenviaBrowser.catch(() => (g.__expenviaBrowser = undefined));
  }
  const b = await g.__expenviaBrowser;
  if (!b.isConnected()) {
    g.__expenviaBrowser = undefined;
    return browser();
  }
  return b;
}

export async function htmlToPdf(html: string, footerLabel: string): Promise<Buffer> {
  const ctx = await (await browser()).newContext({ javaScriptEnabled: false, offline: true });
  try {
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:7pt;color:#7b8781;padding:0 14mm;text-align:right;font-family:sans-serif">${footerLabel} <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await ctx.close();
  }
}
