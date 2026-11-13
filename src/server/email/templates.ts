import { z } from "zod";
import { publicUrl } from "./config";

// Each event has a subject/headline and an explicit, localized explanation.
export const emailCopy = {
  verification: ["Verify your email", "Confirm your email address. This link expires in 24 hours. Verification does not approve your account.", "ای میل کی تصدیق کریں", "اپنے ای میل پتے کی تصدیق کریں۔ یہ لنک 24 گھنٹے میں ختم ہو جائے گا۔ تصدیق سے اکاؤنٹ منظور نہیں ہوتا۔"],
  password_reset: ["Reset your password", "Use this link within one hour to choose a new password. If you did not request this, ignore this email.", "پاس ورڈ تبدیل کریں", "ایک گھنٹے کے اندر اس لنک سے نیا پاس ورڈ منتخب کریں۔ اگر آپ نے درخواست نہیں کی تو اس ای میل کو نظر انداز کریں۔"],
  password_changed: ["Password changed", "Your password has been changed. Contact your administrator immediately if this was not you.", "پاس ورڈ تبدیل ہو گیا", "آپ کا پاس ورڈ تبدیل کر دیا گیا ہے۔ اگر آپ نے یہ تبدیلی نہیں کی تو فوراً منتظم سے رابطہ کریں۔"],
  registration_received: ["Registration received", "We received your employee registration. Verify your email first; administrator approval is required before access becomes active.", "رجسٹریشن موصول ہو گئی", "آپ کی ملازم رجسٹریشن موصول ہو گئی ہے۔ پہلے ای میل کی تصدیق کریں؛ رسائی فعال ہونے سے پہلے منتظم کی منظوری ضروری ہے۔"],
  vendor_registration_received: ["Vendor registration received", "We received your business registration. After email verification, an administrator will review your application.", "وینڈر رجسٹریشن موصول ہو گئی", "آپ کی کاروباری رجسٹریشن موصول ہو گئی ہے۔ ای میل کی تصدیق کے بعد منتظم درخواست کا جائزہ لے گا۔"],
  registration_pending: ["Registration ready for review", "A verified registration is awaiting your review.", "رجسٹریشن جائزے کے لیے تیار ہے", "تصدیق شدہ رجسٹریشن آپ کے جائزے کی منتظر ہے۔"],
  account_approved: ["Account approved", "Your account is approved and access is active. Sign in with your existing password.", "اکاؤنٹ منظور ہو گیا", "آپ کا اکاؤنٹ منظور اور رسائی فعال ہے۔ اپنے موجودہ پاس ورڈ سے سائن ان کریں۔"],
  account_rejected: ["Registration decision", "Your application was not approved. Contact your administrator if you need further information.", "رجسٹریشن کا فیصلہ", "آپ کی درخواست منظور نہیں ہوئی۔ مزید معلومات کے لیے منتظم سے رابطہ کریں۔"],
  account_suspended: ["Account suspended", "Your account has been suspended and active sessions have been revoked. Contact your administrator.", "اکاؤنٹ معطل", "آپ کا اکاؤنٹ معطل اور فعال سیشن ختم کر دیے گئے ہیں۔ منتظم سے رابطہ کریں۔"],
  account_reactivated: ["Account reactivated", "Your account access has been restored.", "اکاؤنٹ بحال", "آپ کے اکاؤنٹ کی رسائی بحال کر دی گئی ہے۔"],
  account_infoRequested: ["More information needed", "Please sign in to read the request for additional registration information.", "مزید معلومات درکار ہیں", "رجسٹریشن کے لیے اضافی معلومات کی درخواست پڑھنے کے لیے سائن ان کریں۔"],
  branch_assigned: ["Branch assignment updated", "Your employee branch assignment is now active for the branch below.", "برانچ کی تفویض تبدیل ہو گئی", "ذیل کی برانچ کے لیے آپ کی ملازم تفویض اب فعال ہے۔"],
  vendor_branchAssigned: ["Vendor branch assigned", "Your business now has access to the branch below.", "وینڈر کو برانچ تفویض", "آپ کے کاروبار کو اب ذیل کی برانچ تک رسائی حاصل ہے۔"],
  vendor_branchRemoved: ["Vendor branch access updated", "Your assignment to the branch below has ended. Historical records remain available according to your permissions.", "وینڈر کی برانچ رسائی تبدیل", "ذیل کی برانچ کے لیے آپ کی تفویض ختم ہو گئی ہے۔ سابقہ ریکارڈ آپ کی اجازت کے مطابق دستیاب ہیں۔"],
  expense_submitted: ["Expense submitted for review", "An employee expense is ready for your review.", "خرچ جائزے کے لیے جمع", "ملازم کا خرچ آپ کے جائزے کے لیے تیار ہے۔"],
  expense_approved: ["Expense approved", "Your expense has been approved.", "خرچ منظور", "آپ کا خرچ منظور ہو گیا ہے۔"],
  expense_rejected: ["Expense rejected", "Your expense was rejected. Review the explanation and details in Expenvia.", "خرچ مسترد", "آپ کا خرچ مسترد کر دیا گیا ہے۔ Expenvia میں وضاحت اور تفصیلات دیکھیں۔"],
  expense_revisionRequested: ["Expense revision requested", "Please update the requested details and resubmit your expense.", "خرچ میں ترمیم درکار", "براہ کرم مطلوبہ تفصیلات درست کر کے خرچ دوبارہ جمع کریں۔"],
  invoice_submitted: ["Invoice submitted for review", "A vendor invoice is awaiting your review.", "انوائس جائزے کے لیے جمع", "وینڈر کی انوائس آپ کے جائزے کی منتظر ہے۔"],
  invoice_submissionConfirmed: ["Invoice submission confirmed", "Your invoice was submitted successfully and is awaiting review.", "انوائس جمع ہونے کی تصدیق", "آپ کی انوائس کامیابی سے جمع ہو گئی ہے اور جائزے کی منتظر ہے۔"],
  invoice_approved: ["Invoice approved", "Your invoice has been approved. Approval does not mean payment has been made.", "انوائس منظور", "آپ کی انوائس منظور ہو گئی ہے۔ منظوری کا مطلب ادائیگی ہونا نہیں ہے۔"],
  invoice_rejected: ["Invoice rejected", "Your invoice was rejected. Review the explanation in Expenvia.", "انوائس مسترد", "آپ کی انوائس مسترد ہو گئی ہے۔ Expenvia میں وضاحت دیکھیں۔"],
  invoice_revisionRequested: ["Invoice revision requested", "Please revise the requested details and resubmit your invoice.", "انوائس میں ترمیم درکار", "براہ کرم مطلوبہ تفصیلات درست کر کے انوائس دوبارہ جمع کریں۔"],
  invoice_paymentRecorded: ["Payment recorded", "An administrator recorded a payment against your invoice. This is a bookkeeping update, not confirmation that funds reached your account.", "ادائیگی درج ہو گئی", "منتظم نے آپ کی انوائس کے لیے ادائیگی درج کی ہے۔ یہ حسابی ریکارڈ کی تبدیلی ہے، آپ کے اکاؤنٹ میں رقم پہنچنے کی تصدیق نہیں۔"],
  invoice_paymentCorrected: ["Payment record corrected", "An administrator corrected a payment entry. Review the updated balance in Expenvia.", "ادائیگی کا ریکارڈ درست", "منتظم نے ادائیگی کے اندراج کی تصحیح کی ہے۔ Expenvia میں تازہ بقایا دیکھیں۔"],
} as const;
export type EmailEvent = keyof typeof emailCopy;
export const payloadSchema = z.object({ name: z.string(), path: z.string(), details: z.record(z.string(), z.string()) });
export type EmailPayload = z.infer<typeof payloadSchema>;
export function isEmailEvent(event: string): event is EmailEvent { return Object.hasOwn(emailCopy, event); }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const labels: Record<string, [string, string]> = {
  number: ["Reference", "حوالہ"], branch: ["Branch", "برانچ"], name: ["Employee", "ملازم"], vendor: ["Business", "کاروبار"],
  amount: ["Amount", "رقم"], total: ["Total", "کل رقم"], balance: ["Remaining balance", "باقی رقم"], date: ["Date", "تاریخ"],
  submittedAt: ["Submitted", "جمع ہونے کی تاریخ"], status: ["Status", "حیثیت"], reason: ["Explanation", "وضاحت"], role: ["Role", "کردار"],
};
const statuses: Record<string, [string,string]> = {
  ACTIVE: ["Active", "فعال"], SUBMITTED: ["Submitted", "جمع شدہ"], UNDER_REVIEW: ["Under review", "زیرِ جائزہ"], APPROVED: ["Approved", "منظور شدہ"], REJECTED: ["Rejected", "مسترد"], REVISION_REQUESTED: ["Revision requested", "ترمیم درکار"], PARTIALLY_PAID: ["Partially paid (recorded)", "جزوی ادائیگی درج"], PAID: ["Paid (recorded)", "ادائیگی درج"], USER: ["Employee", "ملازم"], VENDOR: ["Vendor", "وینڈر"], SUPER_ADMIN: ["Super Admin", "سپر ایڈمن"],
};
export function renderEmail(event: EmailEvent, language: "en" | "ur", input: EmailPayload) {
  const p = payloadSchema.parse(input), ur = language === "ur", i = ur ? 1 : 0;
  const copy = emailCopy[event], subject = copy[ur ? 2 : 0], message = copy[ur ? 3 : 1];
  const url = publicUrl(p.path), logo = publicUrl("/brand/expenvia-logo-light.png");
  const greeting = ur ? `السلام علیکم ${p.name}،` : `Hello ${p.name},`;
  const action = event === "verification" ? (ur ? "ای میل کی تصدیق کریں" : "Verify email") : event === "password_reset" ? (ur ? "پاس ورڈ تبدیل کریں" : "Reset password") : (ur ? "Expenvia کھولیں" : "Open Expenvia");
  const footer = ur ? "یہ Expenvia کی خودکار اطلاع ہے۔ اپنے پاس ورڈ یا حفاظتی لنکس کسی کے ساتھ شیئر نہ کریں۔" : "An automated notification from Expenvia. Never share your password or security links.";
  const details = Object.entries(p.details).filter(([key]) => labels[key]).map(([key, value]) => {
    let display = statuses[value]?.[i] ?? value;
    if (["amount", "total", "balance"].includes(key)) {
      const match = /^([A-Z]{3}) (-?\d+(?:\.\d+)?)$/.exec(value);
      if (match) display = new Intl.NumberFormat(ur ? "ur-PK" : "en-PK", { style: "currency", currency: match[1] }).format(Number(match[2]));
    }
    return [labels[key]![i], display];
  });
  const rows = details.map(([label, value]) => `<tr><td style="padding:10px;border-bottom:1px solid #E8EDE6;color:#26342F">${escapeHtml(label!)}</td><td style="padding:10px;border-bottom:1px solid #E8EDE6"><bdi>${escapeHtml(value!)}</bdi></td></tr>`).join("");
  const html = `<!doctype html><html lang="${language}" dir="${ur ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#FAF9F6;color:#26342F;font-family:Tahoma,Arial,sans-serif;line-height:1.8"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="width:100%;max-width:600px;background:white;border-top:5px solid #176B53" cellpadding="0" cellspacing="0"><tr><td style="padding:28px"><img src="${escapeHtml(logo)}" width="196" alt="Expenvia" style="max-width:100%;height:auto"><h1 style="font-size:24px;color:#176B53">${escapeHtml(subject)}</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(message)}</p><table width="100%" style="border-collapse:collapse;font-size:15px">${rows}</table><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;background:#176B53;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">${escapeHtml(action)}</a></p><p style="font-size:12px;overflow-wrap:anywhere"><a href="${escapeHtml(url)}" style="color:#176B53">${escapeHtml(url)}</a></p></td></tr><tr><td style="padding:20px 28px;background:#E8EDE6;font-size:13px;border-top:3px solid #C47B56">Expenvia<br>${escapeHtml(footer)}</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text: [subject, greeting, message, ...details.map(([k,v]) => `${k}: ${v}`), `${action}: ${url}`, footer].join("\n\n") };
}
