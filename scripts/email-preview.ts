import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { emailCopy, renderEmail, type EmailEvent } from "../src/server/email/templates";
if (process.env.NODE_ENV === "production") throw new Error("Local template previews only");
const dir = resolve("storage/email/template-previews");
mkdirSync(dir, { recursive: true, mode: 0o700 });
for (const event of Object.keys(emailCopy) as EmailEvent[]) for (const locale of ["en", "ur"] as const) {
  const message = renderEmail(event, locale, {name:"Ayesha Khan",path:"/login",details:{number:"EXP-INV-2026-000001",vendor:"Al-Noor Supplies",branch:"Lahore",amount:"PKR 12500.50",balance:"PKR 2500.50",status:"PARTIALLY_PAID"}});
  writeFileSync(resolve(dir, `${event}-${locale}.html`), message.html);
  writeFileSync(resolve(dir, `${event}-${locale}.txt`), message.text);
}
console.info(`Synthetic templates only: ${dir}`);
