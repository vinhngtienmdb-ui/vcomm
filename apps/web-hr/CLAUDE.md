# apps/web-hr

Mini app Nhân sự (MODULE_08), đường dẫn `/hr` (tài liệu `12`, `14`; CONG_VIEC_46). Mini app Nền tảng chuyển tiếp `/hr` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện hồ sơ nhân sự, giấy tờ, người phụ thuộc, quá trình công tác, hợp đồng lao động, hồ sơ của tôi; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; lưu số giấy tờ ở trình duyệt; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/hr`):

- Chạy phát triển: `pnpm --filter web-hr dev` (cổng 3007)
- Build: `pnpm --filter web-hr build`
- Kiểm tra kiểu: `pnpm --filter web-hr typecheck`
