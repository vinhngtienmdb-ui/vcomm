import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["contracts", "i18n", "ui"],
  poweredByHeader: false,
  // Gọi API qua cùng tên miền để cookie phiên HttpOnly và CSRF hoạt động (tài liệu 17 mục 1).
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";
    // Mini app khác chạy ứng dụng web riêng; chuyển tiếp để dùng chung tên miền, cookie phiên (tài liệu 12 mục 2).
    const catalogOrigin = process.env.CATALOG_ORIGIN ?? "http://localhost:3001";
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/catalog", destination: `${catalogOrigin}/catalog` },
      { source: "/catalog/:path*", destination: `${catalogOrigin}/catalog/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
