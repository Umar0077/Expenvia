import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

// Next.js injects inline bootstrapping scripts; 'unsafe-inline' for scripts is
// kept until nonce-based CSP is wired through middleware (tracked in docs/production-checklist.md).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Separate build output lets a demo/test server coexist with the user's app.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  // Auth action arguments and security-link query strings must never enter dev logs.
  logging: { serverFunctions: false, incomingRequests: false, browserToTerminal: false },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@node-rs/argon2", "playwright", "playwright-core"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        // The invoice document route sets its own stricter CSP (and allows same-origin framing for preview).
        source: "/:path((?!api/invoices/[^/]+/document).*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
