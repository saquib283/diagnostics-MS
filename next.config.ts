import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(!isDev
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com"
        : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.razorpay.com",
      "font-src 'self' data:",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      isDev
        ? "connect-src 'self' ws: wss: https://api.razorpay.com https://lumberjack.razorpay.com"
        : "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pdfkit", "exceljs"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

