# apps/web-affiliate

Cổng cửa hàng liên kết (MODULE_12, CONG_VIEC_55), đường dẫn `/merchant` (tài liệu `12`, `14`). Mini app Nền tảng chuyển tiếp `/merchant` sang ứng dụng này nên hai ứng dụng dùng chung tên miền, cookie phiên. Người dùng là chủ cửa hàng, thu ngân của cửa hàng ngoài tập đoàn, không phải nhân viên công ty.

Làm: đăng nhập bằng số điện thoại và OTP, kích hoạt lời mời; quầy tích đổi điểm, voucher, báo cáo và đối soát, cửa hàng của tôi; gọi API `/merchant-portal/*` qua `src/lib/portal-api.ts` (gửi cửa hàng đang chọn bằng header `x-merchant-id`).
Không làm: truy cập cơ sở dữ liệu; tính điểm, tiền thay cho backend; kiểm tra quyền thay cho backend; giá trị giao diện ngoài `packages/ui/src/styles.css`; chuỗi hiển thị ngoài `packages/i18n`.

Lệnh (chạy tại gốc dự án; API cổng 4000, mini app Nền tảng cổng 3000 để vào qua `http://localhost:3000/merchant`):

- Chạy phát triển: `pnpm --filter web-affiliate dev` (cổng 3013)
- Build: `pnpm --filter web-affiliate build`
- Kiểm tra kiểu: `pnpm --filter web-affiliate typecheck`
