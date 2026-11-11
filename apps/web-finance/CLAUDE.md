# apps/web-finance

Mini app Tài chính – Kế toán (MODULE_06), đường dẫn `/finance` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/finance` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện quỹ, công nợ, phiếu thu chi; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/finance`):

- Chạy phát triển: `pnpm --filter web-finance dev` (cổng 3006)
- Build: `pnpm --filter web-finance build`
- Kiểm tra kiểu: `pnpm --filter web-finance typecheck`
