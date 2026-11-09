# apps/web-catalog

Mini app Sản phẩm và Nhà bán (MODULE_02), đường dẫn `/catalog` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/catalog` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện ngành hàng, sản phẩm, bảng giá; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/catalog`):

- Chạy phát triển: `pnpm --filter web-catalog dev` (cổng 3001)
- Build: `pnpm --filter web-catalog build`
- Kiểm tra kiểu: `pnpm --filter web-catalog typecheck`
