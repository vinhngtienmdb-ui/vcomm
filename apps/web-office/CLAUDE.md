# apps/web-office

Mini app Văn phòng số (MODULE_13), đường dẫn `/office` (tài liệu `12`, `14`; đặc tả `tai_lieu/cong_viec/CONG_VIEC_52.md`). Mini app Nền tảng chuyển tiếp `/office` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện công việc, quy trình, công văn đến, đi, bảng tin nội bộ; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/office`):

- Chạy phát triển: `pnpm --filter web-office dev` (cổng 3011)
- Build: `pnpm --filter web-office build`
- Kiểm tra kiểu: `pnpm --filter web-office typecheck`
