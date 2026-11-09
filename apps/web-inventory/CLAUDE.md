# apps/web-inventory

Mini app Kho (MODULE_03), đường dẫn `/inventory` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/inventory` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện kho, tồn kho, phiếu kho, kiểm kê, giữ hàng; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/inventory`):

- Chạy phát triển: `pnpm --filter web-inventory dev` (cổng 3002)
- Build: `pnpm --filter web-inventory build`
- Kiểm tra kiểu: `pnpm --filter web-inventory typecheck`
