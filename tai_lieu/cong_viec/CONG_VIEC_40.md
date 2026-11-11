# CONG_VIEC_40: Cổng Google Pay (MODULE_09)

- Mô tả: Người mua trên ứng dụng VComm (Expo, Android và web) trả bằng thẻ đã lưu trong Google Pay. Google Pay không tự thu tiền; đơn vị xử lý thẻ là ZaloPay, Google Pay hiện trên trang thanh toán của ZaloPay.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng chọn ZaloPay qua trang thanh toán và xác nhận thiết kế ngày 2026-11-11. Chưa có tài khoản người bán (ZaloPay, Google Pay), sẽ đăng ký; mã kiểm thử bằng máy chủ giả lập. Chờ nghiệm thu.
- Mức: Vừa.
- Nguồn: người dùng yêu cầu 2026-11-11 "mở thêm phiên để tích hợp google pay và apple pay"; khung CONG_VIEC_32.

## 1. Mục tiêu

Thêm phương thức "Thẻ trong Google Pay" vào khung nhiều cổng thanh toán mà không sửa hành vi hiện có.

## 2. Phạm vi và quyết định

Đơn vị xử lý thẻ: người dùng chọn phương án 1 trong các phương án đã trình ngày 2026-11-11.

| Phương án | Cách kết nối | Tài liệu công khai | Kết luận |
|---|---|---|---|
| 1. ZaloPay (`zalopay` trong bảng cổng của Google Pay) | Trang thanh toán ZaloPay có nút Google Pay | Có (docs.zalopay.vn) | Chọn |
| 2. 9Pay (`ninepay`) | Ứng dụng gửi token Google Pay | Không tìm thấy API nhận token | Không chọn |
| 3. Payoo (`payoo`) | Ứng dụng gửi token Google Pay | Tài liệu PDF tạm duyệt, không truy cập được | Không chọn |
| 4. Adyen, Checkout.com, Cybersource | Ứng dụng gửi token Google Pay | Có | Cần hợp đồng quốc tế, không chọn |

Hệ quả của phương án 1:
- Không cần thư viện native cho Expo, không ảnh hưởng bản dựng; ứng dụng mở trang ZaloPay như VNPAY (Android và web). Google Pay không hiện trên iOS, macOS (theo tài liệu ZaloPay).
- Khung CONG_VIEC_32 đủ dùng (kiểu hướng dẫn `redirect`); không thêm kiểu hướng dẫn, không thêm controller, API.
- VComm không nhận, không lưu token thẻ. Tài khoản người bán Google Pay (Google Pay & Wallet Console) không cần riêng; VComm cần hợp đồng ZaloPay có mở Google Pay, chấp nhận điều khoản Google Pay API (Acceptable Use Policy, Terms of Service).
- Ngoài phạm vi: tra cứu trạng thái đơn ZaloPay định kỳ khi lỡ kết quả gửi về (người dùng chọn làm sau, xem mục 9); hoàn tiền qua API ZaloPay (hoàn tiền vẫn do kế toán theo CONG_VIEC_25).

## 3. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_260: Phương thức `google_pay_card` thuộc cổng `google_pay`, mặc định tắt; chỉ bật được khi có đủ biến môi trường `GOOGLE_PAY_ZALOPAY_APP_ID`, `GOOGLE_PAY_ZALOPAY_MAC_KEY`, `GOOGLE_PAY_ZALOPAY_CALLBACK_KEY`, `GOOGLE_PAY_PUBLIC_API_URL`.
- QUYTAC_NGHIEPVU_261: Mở thanh toán tạo đơn ZaloPay (`POST {GOOGLE_PAY_ZALOPAY_API_URL}/create`): `app_trans_id` = ngày theo giờ Việt Nam `yymmdd` + `_` + số tham chiếu; `mac` = HMAC-SHA256(key1, `app_id|app_trans_id|app_user|amount|app_time|embed_data|item`); `embed_data` gồm `preferred_payment_method` (mặc định `international_card`) và `redirecturl` về trang trả về; `callback_url` về đường dẫn nhận kết quả chung; hạn đơn ZaloPay theo hạn thanh toán của đơn (300 giây đến 30 ngày). ZaloPay không trả `return_code` 1 kèm `order_url` https thì báo lỗi, không ghi lần thanh toán.
- QUYTAC_NGHIEPVU_262: Kết quả ZaloPay gửi về `/api/v1/public/payments/google_pay/notify` (POST JSON `data`, `mac`, `type`) chỉ nhận khi `mac` = HMAC-SHA256(key2, `data`) (so sánh an toàn thời gian), `app_id` khớp, `app_trans_id` đúng định dạng; số tiền `amount`, số tham chiếu khớp lần thanh toán, ghi nhận một lần (QUYTAC_NGHIEPVU_166, 221). ZaloPay chỉ gửi khi thanh toán thành công.
- QUYTAC_NGHIEPVU_263: Trả lời ZaloPay luôn HTTP 200: `return_code` 1 khi ghi nhận hoặc đã ghi nhận trước đó; 2 khi sai chữ ký, không có lần thanh toán, sai số tiền; 0 khi lỗi ghi nhận để ZaloPay gửi lại.
- QUYTAC_NGHIEPVU_264: Trang trả về `/api/v1/public/payments/google_pay/return` kiểm `checksum` = HMAC-SHA256(key2, `appid|apptransid|pmcid|bankcode|amount|discountamount|status`), `status` 1 là thành công; chỉ hiển thị, không ghi nhận tiền.

## 4. Chức năng

- CHUC_NANG_154: Thanh toán đơn VComm bằng thẻ trong Google Pay qua trang thanh toán ZaloPay (lớp kết nối `google_pay`).

## 5. Dữ liệu, API, cấu hình

- Database migration `database/migrations/0058_payment_google_pay.sql`: thêm phương thức `google_pay_card` (cổng `google_pay`, sort_order 80, tắt).
- API: dùng API_131 (trả `paymentUrl`), API_132 (đường dẫn chung). Không có API mới.
- Biến môi trường (`.env.example`, để trống): `GOOGLE_PAY_ZALOPAY_APP_ID`, `GOOGLE_PAY_ZALOPAY_MAC_KEY` (key1), `GOOGLE_PAY_ZALOPAY_CALLBACK_KEY` (key2), `GOOGLE_PAY_ZALOPAY_API_URL` (mặc định `https://sb-openapi.zalopay.vn/v2`; môi trường thật `https://openapi.zalopay.vn/v2`), `GOOGLE_PAY_ZALOPAY_PREFERRED_METHOD` (mặc định `international_card`), `GOOGLE_PAY_PUBLIC_API_URL` (địa chỉ công khai của API, không kèm `/api/v1`).
- Mã: `apps/api/src/marketplace/payments/gateways/google-pay-gateway.ts`; thêm một dòng vào `payment-gateway-registry.ts`; `packages/contracts/src/index.ts` (`google_pay_card`, `google_pay`); `packages/i18n/src/vi.json`, `en.json` (nhóm `paymentMethods`).
- Sửa kiểm thử hồi quy `apps/api/test/c25-payment-methods.test.ts`: chỉ so 4 phương thức đầu danh sách (danh mục có thêm phương thức của cổng mới).

## 6. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_262 | Phương thức Google Pay chỉ bật được khi có thông tin kết nối; bật thì người mua thấy và đặt được | Bắt buộc | KICHBAN_KIEMTHU_407 |
| TIEUCHI_NGHIEMTHU_263 | Mở thanh toán tạo đơn ZaloPay đúng chữ ký, trả trang thanh toán; ZaloPay từ chối thì báo lỗi, không ghi lần thanh toán | Bắt buộc | KICHBAN_KIEMTHU_408 |
| TIEUCHI_NGHIEMTHU_264 | Kết quả gửi về: sai chữ ký, sai mã ứng dụng, sai số tiền, không có lần thanh toán bị từ chối; đúng thì ghi nhận một lần, trả lời đúng định dạng ZaloPay | Bắt buộc | KICHBAN_KIEMTHU_409 |
| TIEUCHI_NGHIEMTHU_265 | Trang trả về kiểm checksum, chỉ hiển thị, không ghi nhận tiền | Bắt buộc | KICHBAN_KIEMTHU_410 |

## 7. Kịch bản kiểm thử

KICHBAN_KIEMTHU_407 đến 410: tự động, `apps/api/test/c40-payment-google-pay.test.ts` (máy chủ ZaloPay giả lập theo đặc tả công khai, không gọi máy chủ thật).

## 8. Điểm chưa xác minh (thử bằng tài khoản thử nghiệm ZaloPay trước khi phát hành)

- Tài liệu ZaloPay không nêu giá trị `preferred_payment_method` riêng cho Google Pay; giả định nút Google Pay nằm trong nhóm thẻ quốc tế (`international_card`). Đổi được bằng `GOOGLE_PAY_ZALOPAY_PREFERRED_METHOD` theo giá trị ZaloPay cung cấp.
- Địa chỉ API `sb-openapi.zalopay.vn/v2`, `openapi.zalopay.vn/v2` theo mã mẫu công khai của ZaloPay; trang đặc tả không ghi.
- Ý nghĩa `return_code` trả lời kết quả gửi về chưa thống nhất giữa các trang tài liệu (trang đặc tả: 1 thành công, 2 không hợp lệ; mã mẫu: 0 để gửi lại). Thuật toán ký mặc định HmacSHA256, có thể khác nếu đăng ký khác với ZaloPay.
- Trang ZaloPay bắt buộc mở Google Pay trong hợp đồng; Google Pay chỉ nhận thẻ Visa, Mastercard (DPAN).

## 9. Đề xuất làm sau

Tra cứu trạng thái đơn ZaloPay (`POST /v2/query`, `mac` = HMAC(key1, `app_id|app_trans_id|key1`)) cho lần thanh toán chờ lâu không nhận được kết quả: cần thêm hàm tùy chọn trên giao diện cổng và việc nền trong khung (theo cách cộng thêm). Người dùng chọn làm sau ngày 2026-11-11.

## 10. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_260 đến 264 (mục 3).
- `10`: CHUC_NANG_154.
- `11`: TIEUCHI_NGHIEMTHU_262 đến 265.
- `13`: ZaloPay (trang thanh toán, Google Pay) là đơn vị xử lý thẻ cho Google Pay; không thêm thư viện (`fetch`, `node:crypto`).
- `16`: database migration 0058, phương thức `google_pay_card`.
- `17`: API_131 trả `paymentUrl` trang ZaloPay cho cổng `google_pay`; API_132 nhận POST JSON của ZaloPay tại `/public/payments/google_pay/notify`.
- `21`: KICHBAN_KIEMTHU_407 đến 410.
- `22`: key1, key2 ZaloPay chỉ ở biến môi trường; kết quả gửi về kiểm HMAC-SHA256 so sánh an toàn thời gian; VComm không nhận token thẻ.
- `25`: kết quả kiểm thử mục 11.
- `27`: CHUC_NANG_154 → TIEUCHI_NGHIEMTHU_262 đến 265 → KICHBAN_KIEMTHU_407 đến 410 → `google-pay-gateway.ts`.

## 11. Kết quả thực hiện

- Kiểm thử ngày 2026-11-11: `c40-payment-google-pay.test.ts` 4/4 đạt; hồi quy `pnpm --filter api test` 47 tệp, 337 kiểm thử đạt; `pnpm typecheck`, `pnpm lint` đạt.
