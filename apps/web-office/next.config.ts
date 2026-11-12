import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Mini app Văn phòng số (MODULE_13) chạy dưới đường dẫn /office, cùng tên miền với mini app Nền tảng (tài liệu 12 mục 2).
const nextConfig: NextConfig = {
  basePath: "/office",
  transpilePackages: ["contracts", "i18n", "ui"],
  poweredByHeader: false,
  // Gọi API qua cùng tên miền để cookie phiên HttpOnly và CSRF hoạt động (tài liệu 17 mục 1); không gắn tiền tố /office.
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
        basePath: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
