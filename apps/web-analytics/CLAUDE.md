# apps/web-analytics

Mini app Báo cáo quản trị (MODULE_15), đường dẫn `/analytics` (tài liệu `12`, `14`; CONG_VIEC_50). Mini app Nền tảng chuyển tiếp `/analytics` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện báo cáo chỉ đọc (bán hàng, tồn kho, công nợ, hoa hồng và ví), bộ lọc công ty theo phạm vi quyền, xuất Excel; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; tính số liệu thay cho backend; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/analytics`):

- Chạy phát triển: `pnpm --filter web-analytics dev` (cổng 3009)
- Build: `pnpm --filter web-analytics build`
- Kiểm tra kiểu: `pnpm --filter web-analytics typecheck`
