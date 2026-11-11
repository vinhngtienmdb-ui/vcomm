# apps/web-sales

Mini app Bán hàng (MODULE_05), đường dẫn `/sales` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/sales` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện đơn bán; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/sales`):

- Chạy phát triển: `pnpm --filter web-sales dev` (cổng 3005)
- Build: `pnpm --filter web-sales build`
- Kiểm tra kiểu: `pnpm --filter web-sales typecheck`
