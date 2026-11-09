# apps/web-platform

Mini app nền tảng Next.js: đăng nhập (MAN_HINH_01), trang chủ mini app (MAN_HINH_05) và các màn hình quản trị hệ thống (tài liệu `14`).

Làm: giao diện, gọi API qua `src/lib/api.ts` (cookie phiên, CSRF, công ty đang chọn).
Không làm: truy cập cơ sở dữ liệu; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css` (tài liệu `15`); chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API phải chạy ở cổng 4000 hoặc đặt `API_ORIGIN`):

- Chạy phát triển: `pnpm --filter web-platform dev` (cổng 3000)
- Build: `pnpm --filter web-platform build`
- Kiểm tra kiểu: `pnpm --filter web-platform typecheck`
