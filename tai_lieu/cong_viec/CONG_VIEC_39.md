# CONG_VIEC_39: Cổng thanh toán G-Pay (MODULE_09)

- Mô tả: Kết nối cổng thanh toán G-Pay (g-pay.vn) vào khung nhiều cổng của CONG_VIEC_32: ba phương thức thẻ ATM hoặc tài khoản nội địa, thẻ quốc tế, tài khoản ảo; chuyển người mua tới trang thanh toán G-Pay; nhận kết quả đã ký.
- Mức: Vừa.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (cổng G-Pay theo developers.g-pay.vn; chọn ba phương thức riêng; đối chiếu số tiền qua `embed_data`). Đã nghiệm thu, chờ phát hành (người dùng nghiệm thu 2026-11-11); trước khi phát hành phải thử với tài khoản thử nghiệm của nhà cung cấp (G-Pay), xem mục 7.
- Nguồn: người dùng yêu cầu ngày 2026-11-11 (tích hợp GPay); CONG_VIEC_32 (khung nhiều cổng); CONG_VIEC_25 (thanh toán đơn người mua).

## 1. Mục tiêu

Người mua đơn VComm trả tiền qua cổng G-Pay. VComm chỉ ghi nhận tiền khi kết quả có chữ ký hợp lệ của G-Pay, đúng số tiền, mỗi lần thanh toán một lần.

## 2. Phạm vi

- Trong phạm vi: lớp kết nối `apps/api/src/marketplace/payments/gateways/gpay-gateway.ts`; database migration `0057_payment_gpay.sql`; mã phương thức, mã cổng trong `packages/contracts`; tên phương thức trong `packages/i18n`; biến môi trường trong `.env.example`; kiểm thử `apps/api/test/c39-payment-gpay.test.ts`.
- Ngoài phạm vi: chi hộ, tài khoản ảo cố định, tách mã VietQR, lưu thẻ, hoàn tiền tự động qua G-Pay (hoàn tiền vẫn do kế toán chuyển khoản theo CONG_VIEC_25).

## 3. Nguồn tài liệu của cổng

- Trang tài liệu `https://developers.g-pay.vn/` và tệp đặc tả `https://g-pay.vn/payment-gateway/download` chặn truy cập tự động (Cloudflare, HTTP 403). Không tìm cách vượt chặn.
- Định dạng lấy theo mã mẫu chính thức của G-Pay trên GitHub: `https://github.com/gpay86/devportal` (java_sample, golang_sample; commit ngày 2026-05-04). VComm tự viết mã, không chép mã mẫu.

## 4. Yêu cầu chức năng

- CHUC_NANG_153: Thanh toán đơn VComm qua cổng G-Pay: mở trang thanh toán G-Pay theo phương thức người mua chọn, nhận kết quả G-Pay gửi về, trang trả về hiển thị kết quả.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_255: Cổng G-Pay (mã `gpay`) có ba phương thức, mặc định tắt: `gpay_atm` (G-Pay `BANK_ATM`, thẻ ATM hoặc tài khoản nội địa), `gpay_international` (`BANK_INTERNATIONAL`, thẻ quốc tế), `gpay_va` (`VA`, chuyển khoản tài khoản ảo). Thứ tự 70, 71, 72. Thiếu một biến môi trường hoặc khóa không đọc được thì cổng chưa có thông tin kết nối, không bật được.
- QUYTAC_NGHIEPVU_256: Mở thanh toán tạo đơn G-Pay (`POST /payments/gateway/init-order`, `payment_type` = `IMMEDIATE`): `request_id` là số tham chiếu của lần thanh toán, `amount` là số tiền đồng, `embed_data` = `<số tham chiếu>|<số tiền>`; có thông tin người mua thì gửi `customer_name`, `phone`, `email`. G-Pay trả `bill_url`, người mua được chuyển tới đó. G-Pay không trả lời hoặc báo lỗi thì người mua nhận lỗi "Phương thức thanh toán này hiện không dùng được", không tạo lần thanh toán.
- QUYTAC_NGHIEPVU_257: Kết quả G-Pay gửi về (`POST /api/v1/public/payments/gpay/notify`, JSON) phải có chữ ký SHA256withRSA (base64) của G-Pay trên chuỗi `merchant_order_id=…&gpay_trans_id=…&gpay_bill_id=…&status=…&embed_data=…&user_payment_method=…`, kiểm bằng khóa công khai của G-Pay. `embed_data` phải trùng mã đơn; số tiền trong `embed_data` phải bằng số tiền lần thanh toán. `ORDER_SUCCESS` là thành công; trạng thái có `FAIL`, `CANCEL`, `EXPIRE`, `REJECT` là thất bại; trạng thái khác là đang xử lý, không đổi trạng thái lần thanh toán (khung `pending` của CONG_VIEC_33). Trả lời: 200 khi đã ghi nhận, đã ghi nhận trước đó hoặc đang xử lý; 400 khi không có đơn, sai số tiền; 401 khi sai chữ ký; 500 khi lỗi máy chủ để G-Pay gửi lại.
- QUYTAC_NGHIEPVU_258: Mọi yêu cầu VComm gửi G-Pay kèm mã truy cập (`POST /auth/token` bằng `client_id`, `client_secret`; dùng lại tới 30 giây trước khi hết hạn; bị 401 thì lấy lại một lần) và các tiêu đề `x-timestamp`, `x-requests-id`, `x-certificate` (chứng thư công khai của VComm, base64), `signature` (SHA256withRSA bằng khóa riêng của VComm trên `x-timestamp + x-requests-id + nội dung JSON`).
- QUYTAC_NGHIEPVU_259: Trang trả về (`/api/v1/public/payments/gpay/return`) không tin tham số trên đường dẫn. Trang lấy `merchant_order_id` (hoặc `request_id`) để tra cứu đơn với G-Pay (`POST /payments/gateway/query-order`), chỉ để hiển thị. Tiền chỉ ghi nhận qua kết quả gửi về (QUYTAC_NGHIEPVU_166).

## 6. Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `GPAY_API_URL` | Địa chỉ OpenAPI kèm `/v1`; trống thì dùng môi trường thử nghiệm `https://openapi.sandbox.g-pay.vn/v1` |
| `GPAY_CLIENT_ID`, `GPAY_CLIENT_SECRET` | Thông tin trên trang nhà phát triển G-Pay |
| `GPAY_MERCHANT_PRIVATE_KEY` | Khóa riêng RSA của VComm (PEM, PKCS#1 hoặc PKCS#8; viết một dòng thì dùng `\n`) |
| `GPAY_MERCHANT_CERTIFICATE` | Chứng thư công khai của VComm đã gửi G-Pay (PEM hoặc base64) |
| `GPAY_PUBLIC_KEY` | Khóa công khai hoặc chứng thư X.509 của G-Pay (PEM) |
| `GPAY_WEBHOOK_URL`, `GPAY_RETURN_URL` | Địa chỉ công khai của API + `/api/v1/public/payments/gpay/notify` và `/return` |

Tạo khóa theo hướng dẫn G-Pay: `openssl genrsa -out khoa_rieng.pem 2048`, `openssl req -new -x509 -key khoa_rieng.pem -out chung_thu.pem -days 3650`; gửi `chung_thu.pem` cho G-Pay. Không commit giá trị thật.

## 7. Điểm chưa xác minh (thử với tài khoản môi trường thử nghiệm trước khi phát hành)

1. Đường dẫn lấy mã truy cập: mã mẫu gọi `/auth/token`, nhưng danh sách đường dẫn trong mẫu Java còn có `/authentication/token/create`.
2. Tham số G-Pay gắn vào `callback_url` khi chuyển người mua về (đang đọc `merchant_order_id` hoặc `request_id`, `gpay_bill_id` hoặc `bill_id`).
3. Các trường bắt buộc của tạo đơn: mẫu có thêm `customer_id`, `address`; VComm chưa gửi (đã gửi `customer_name`, `phone`, `email` khi có).
4. Định dạng `x-certificate`: mẫu Java gửi base64 không kèm dòng BEGIN, END; mẫu Go gửi nguyên tệp. VComm gửi theo mẫu Java.
5. Số lần G-Pay gửi lại kết quả, nội dung trả lời G-Pay cần; danh sách đầy đủ các trạng thái ngoài `ORDER_SUCCESS`, `ORDER_FAILED`.
6. Kiểu dữ liệu `meta.code` (chuỗi hoặc số); VComm chấp nhận cả hai.

## 8. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_258 | Ba phương thức G-Pay chỉ bật được khi có đủ thông tin kết nối; người mua thấy theo thứ tự | Bắt buộc | KICHBAN_KIEMTHU_403 |
| TIEUCHI_NGHIEMTHU_259 | Mở thanh toán gọi G-Pay đúng chữ ký, chuyển tới trang G-Pay; kết quả sai chữ ký, sai số tiền bị từ chối; thành công ghi nhận một lần | Bắt buộc | KICHBAN_KIEMTHU_404 |
| TIEUCHI_NGHIEMTHU_260 | Kết quả thất bại ghi lần thanh toán thất bại, đơn vẫn chờ thanh toán; trạng thái chưa kết thúc không ghi nhận; đúng phương thức G-Pay theo phương thức VComm | Bắt buộc | KICHBAN_KIEMTHU_405 |
| TIEUCHI_NGHIEMTHU_261 | Trang trả về tra cứu G-Pay, không tin đường dẫn; G-Pay lỗi khi mở thanh toán thì báo lỗi, không tạo lần thanh toán | Bắt buộc | KICHBAN_KIEMTHU_406 |

## 9. Kịch bản kiểm thử

`apps/api/test/c39-payment-gpay.test.ts`, máy chủ G-Pay giả lập theo mã mẫu; cặp khóa RSA sinh lúc chạy; không gọi máy chủ thật.

- KICHBAN_KIEMTHU_403: chưa có biến môi trường hoặc khóa sai thì bật bị từ chối; đủ thì bật cả ba, người mua thấy `cod, gpay_atm, gpay_international, gpay_va`.
- KICHBAN_KIEMTHU_404: kiểm chữ ký yêu cầu tạo đơn, mã truy cập, chứng thư, nội dung; kết quả ký bằng khóa khác, bị sửa sau khi ký, không có chữ ký thì 401; sai số tiền 400; không có đơn 400; thành công 200, đơn Chờ giao, ghi chú `GPAY <mã giao dịch>`; nhận trùng 200 không ghi lại; mã truy cập lấy một lần.
- KICHBAN_KIEMTHU_405: `ORDER_FAILED` thì lần thanh toán thất bại, đơn vẫn chờ thanh toán; `ORDER_PROCESSING` trả 200, ghi lại kết quả `pending`, lần thanh toán vẫn chờ; `gpay_international`, `gpay_va` gửi `BANK_INTERNATIONAL`, `VA`.
- KICHBAN_KIEMTHU_406: đường dẫn ghi thành công nhưng G-Pay đang xử lý thì trang hiện "đang chờ"; G-Pay báo thất bại thì hiện thất bại; mã đơn không có hoặc thiếu thì "không xác nhận được"; G-Pay không trả lời khi mở thanh toán thì 409, không thêm lần thanh toán.

Hồi quy: `c25-*`, `c32-*`, `c33-*` (giữ bản `c25-payment-methods.test.ts` của nhánh nền, người dùng duyệt phương án A: chỉ so phương thức cổng cod, vnpay).

## 10. Thành phần không được thay đổi

Khung `payment-gateway.ts`, `payments.service.ts`, `payments.controller.ts` (CONG_VIEC_32); mã hoa hồng CONG_VIEC_26; các tài liệu đánh số `02`, `03`, `06` đến `27`.

## 11. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `03`: dòng CONG_VIEC_39 (Vừa, nhánh `chuc-nang/CONG_VIEC_39-cong-gpay`, mã dành riêng QUYTAC_NGHIEPVU_255 đến 259, CHUC_NANG_153, TIEUCHI_NGHIEMTHU_258 đến 261, KICHBAN_KIEMTHU_403 đến 406; đã dùng 255 đến 259, 153, 258 đến 261, 403 đến 406).
- `07`: CHUC_NANG_153.
- `10`: QUYTAC_NGHIEPVU_255 đến 259.
- `11`: danh mục `marketplace.payment_methods` thêm `gpay_atm`, `gpay_international`, `gpay_va` (cổng `gpay`); database migration 0057.
- `13`: API_131 với cổng `gpay` trả `paymentUrl` là `bill_url` của G-Pay; API_132 nhận `POST /public/payments/gpay/notify` (JSON, chữ ký RSA), `GET /public/payments/gpay/return`.
- `16`: TIEUCHI_NGHIEMTHU_258 đến 261, KICHBAN_KIEMTHU_403 đến 406.
- `17`: biến môi trường `GPAY_*` (mục 6).
- `21`, `22`: thêm kết nối G-Pay vào danh sách dịch vụ ngoài; khóa riêng, `GPAY_CLIENT_SECRET` là bí mật, chỉ ở biến môi trường máy chủ.
- `25`: ghi nhận nguồn tham khảo `github.com/gpay86/devportal` (mã mẫu của G-Pay, chỉ đọc).
- `27`: các điểm chưa xác minh ở mục 7 cần thử với tài khoản thử nghiệm trước khi phát hành.

## 12. Kết quả thực hiện

- Kiểm tra kiểu toàn dự án (`pnpm typecheck`), `pnpm lint`: đạt.
- `c39-payment-gpay.test.ts`: 4/4 đạt.
- Kiểm thử hồi quy `pnpm --filter api test`: 47 tệp, 337 kiểm thử đạt (2026-11-11, trước khi hợp nhất CONG_VIEC_33).
- Sau khi merge nhánh nền có CONG_VIEC_33 (MoMo): theo khung mới dùng `pending` cho trạng thái chưa kết thúc và gửi thông tin người mua; `c39`, `c25-*`, `c32`, `c33` đạt; kiểm thử hồi quy toàn bộ 48 tệp, 340 kiểm thử đạt.
