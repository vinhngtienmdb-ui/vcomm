# apps/mobile-ipos

Ứng dụng bán hàng iPOS cho cửa hàng liên kết trên máy tính bảng Android và máy bán hàng Sunmi (Expo; CONG_VIEC_74; tài liệu `12`, `14` MAN_HINH_283 đến 292).

Làm: ghép thiết bị với quầy, đăng nhập thu ngân (OTP lần đầu, mã PIN), mở và đóng ca, bán hàng, thanh toán, in hóa đơn, trả hàng; gọi API iPOS của `apps/api` (gốc `/api/v1/ipos/pos`).
Không làm: quản lý hàng hóa, tồn kho, quầy, thu ngân, báo cáo (làm trên cổng cửa hàng `apps/web-affiliate`); bán khi mất mạng (bắt buộc có mạng); ứng dụng iOS.

Trạng thái: lát L3 có mở ca, bán tiền mặt, giảm giá, giỏ treo, hóa đơn trong ca, thu chi, đóng ca, cài đặt thiết bị, in (Sunmi gắn sẵn, máy in mạng LAN, máy in Bluetooth chưa kiểm thử trên máy thật). Thư viện máy in có mã gốc nên chạy trên máy thật cần bản dựng phát triển (`expo prebuild`, không dùng Expo Go); bản web chỉ hiện bản xem trước hóa đơn (`src/lib/printer-driver.ts`, bản Android là `printer-driver.native.ts`).

Lệnh (tại gốc dự án):

- Xem trước bản web: `pnpm --filter mobile-ipos web` (cổng 8085; API mặc định `http://localhost:4000/api/v1`, đổi bằng `EXPO_PUBLIC_API_URL`)
- Kiểm tra kiểu: `pnpm --filter mobile-ipos typecheck`
