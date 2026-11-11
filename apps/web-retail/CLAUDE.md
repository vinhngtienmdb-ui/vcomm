# apps/web-retail

Mini app Bán lẻ tại quầy (MODULE_14, CONG_VIEC_53), đường dẫn `/retail` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/retail` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên.

Làm: giao diện bán hàng tại quầy, ca thu ngân, hóa đơn bán lẻ, trả hàng, cài đặt cửa hàng; gọi API qua `ui/lib/api`.
Không làm: truy cập cơ sở dữ liệu; tính giá, khuyến mãi, tổng tiền thay cho backend; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/retail`):

- Chạy phát triển: `pnpm --filter web-retail dev` (cổng 3012)
- Build: `pnpm --filter web-retail build`
- Kiểm tra kiểu: `pnpm --filter web-retail typecheck`
