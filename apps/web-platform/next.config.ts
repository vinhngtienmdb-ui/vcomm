import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["contracts", "i18n"],
  poweredByHeader: false,
  // Gọi API qua cùng tên miền để cookie phiên HttpOnly và CSRF hoạt động (tài liệu 17 mục 1).
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
