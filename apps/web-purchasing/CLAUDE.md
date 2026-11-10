# apps/web-purchasing

Mini app Mua hàng (MODULE_04), đường dẫn `/purchasing` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/purchasing` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện bảng giá mua, đề nghị mua, đơn mua; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/purchasing`):

- Chạy phát triển: `pnpm --filter web-purchasing dev` (cổng 3004)
- Build: `pnpm --filter web-purchasing build`
- Kiểm tra kiểu: `pnpm --filter web-purchasing typecheck`
