import { afterEach, describe, expect, it, vi } from "vitest";
import { emailCopy, renderEmail, type EmailEvent } from "./templates";
import { emailConfig, publicUrl, safeAddress } from "./config";
import { decryptPayload, encryptPayload } from "./crypto";
import { classifyError, DeliveryError } from "./provider";

afterEach(() => vi.unstubAllEnvs());
describe("email templates and security", () => {
  for (const event of Object.keys(emailCopy) as EmailEvent[]) for (const language of ["en","ur"] as const) {
    it(`${event} renders in ${language} with escaped data and stable references`, () => {
      const m = renderEmail(event, language, { name:'<script>alert("x")</script>', path:"/login", details:{number:"EXP-INV-2026-001",vendor:"Al-Noor & Sons",amount:"PKR 1250.50",status:"APPROVED"} });
      expect(m.html).toContain(`dir="${language === "ur" ? "rtl" : "ltr"}"`);
      expect(m.html).not.toContain("<script>");
      expect(m.html).toContain("&lt;script&gt;");
      expect(m.text).toContain("EXP-INV-2026-001");
      expect(m.text).toContain("Al-Noor & Sons");
      expect(m.text).toContain("1,250.50");
      expect(m.subject).toBeTruthy();
    });
  }
  it("requires HTTPS in production and rejects foreign links and headers", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_PUBLIC_URL","http://example.com");
    expect(() => publicUrl()).toThrow();
    vi.stubEnv("APP_PUBLIC_URL","https://example.com");
    for (const path of ["//evil.test", "https://evil.test", "/\\evil.test", "/\nLocation: evil"]) expect(() => publicUrl(path)).toThrow();
    expect(publicUrl("/login")).toBe("https://example.com/login");
    expect(() => safeAddress("user@example.com\r\nBcc: attacker@example.com")).toThrow();
    vi.stubEnv("EMAIL_PROVIDER", "development"); expect(() => emailConfig()).toThrow();
  });
  it("encrypts security links and rejects altered ciphertext", () => {
    vi.stubEnv("EMAIL_ENCRYPTION_KEY","a".repeat(64));
    const value = { token:"private-verification-token" }, ciphertext = encryptPayload(value);
    expect(ciphertext).not.toContain(value.token);
    expect(decryptPayload(ciphertext)).toEqual(value);
    const altered = Buffer.from(ciphertext,"base64"); altered[30] = altered[30]! ^ 1;
    expect(() => decryptPayload(altered.toString("base64"))).toThrow();
  });
  it("categorizes errors without retaining SMTP secrets", () => {
    expect(classifyError({code:"EAUTH",message:"password=secret"})).toMatchObject({category:"AUTHENTICATION",temporary:false});
    expect(classifyError({responseCode:451}).temporary).toBe(true);
    expect(classifyError({responseCode:550}).temporary).toBe(false);
    expect(classifyError(new DeliveryError("INVALID_HEADER",false)).temporary).toBe(false);
  });
});
