# apps/web-crm

Mini app Khách hàng và Đối tác (MODULE_07), đường dẫn `/crm` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/crm` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện danh mục đối tác, hồ sơ đối tác của công ty; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/crm`):

- Chạy phát triển: `pnpm --filter web-crm dev` (cổng 3003)
- Build: `pnpm --filter web-crm build`
- Kiểm tra kiểu: `pnpm --filter web-crm typecheck`
