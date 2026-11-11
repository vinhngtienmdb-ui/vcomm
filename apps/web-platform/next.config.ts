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
    const inventoryOrigin = process.env.INVENTORY_ORIGIN ?? "http://localhost:3002";
    const crmOrigin = process.env.CRM_ORIGIN ?? "http://localhost:3003";
    const purchasingOrigin = process.env.PURCHASING_ORIGIN ?? "http://localhost:3004";
    const salesOrigin = process.env.SALES_ORIGIN ?? "http://localhost:3005";
    const financeOrigin = process.env.FINANCE_ORIGIN ?? "http://localhost:3006";
    const hrOrigin = process.env.HR_ORIGIN ?? "http://localhost:3007";
    const analyticsOrigin = process.env.ANALYTICS_ORIGIN ?? "http://localhost:3009";
    const officeOrigin = process.env.OFFICE_ORIGIN ?? "http://localhost:3011";
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/catalog", destination: `${catalogOrigin}/catalog` },
      { source: "/catalog/:path*", destination: `${catalogOrigin}/catalog/:path*` },
      { source: "/inventory", destination: `${inventoryOrigin}/inventory` },
      { source: "/inventory/:path*", destination: `${inventoryOrigin}/inventory/:path*` },
      { source: "/crm", destination: `${crmOrigin}/crm` },
      { source: "/crm/:path*", destination: `${crmOrigin}/crm/:path*` },
      { source: "/purchasing", destination: `${purchasingOrigin}/purchasing` },
      { source: "/purchasing/:path*", destination: `${purchasingOrigin}/purchasing/:path*` },
      { source: "/sales", destination: `${salesOrigin}/sales` },
      { source: "/sales/:path*", destination: `${salesOrigin}/sales/:path*` },
      { source: "/finance", destination: `${financeOrigin}/finance` },
      { source: "/finance/:path*", destination: `${financeOrigin}/finance/:path*` },
      { source: "/hr", destination: `${hrOrigin}/hr` },
      { source: "/hr/:path*", destination: `${hrOrigin}/hr/:path*` },
      { source: "/analytics", destination: `${analyticsOrigin}/analytics` },
      { source: "/analytics/:path*", destination: `${analyticsOrigin}/analytics/:path*` },
      { source: "/office", destination: `${officeOrigin}/office` },
      { source: "/office/:path*", destination: `${officeOrigin}/office/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
