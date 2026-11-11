# CONG_VIEC_42: Cổng thanh toán ZaloPay (MODULE_09)

- Mô tả: Kết nối cổng ZaloPay vào khung nhiều cổng thanh toán của CONG_VIEC_32: ví ZaloPay (ứng dụng ZaloPay, mã QR), thẻ ATM và tài khoản ngân hàng, thẻ quốc tế; tạo đơn, nhận kết quả ký HMAC, trang trả về, hàm tra cứu trạng thái.
- Mức: Vừa.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (tra cứu trạng thái viết hàm riêng chưa gắn vào luồng; không thêm VietQR qua ZaloPay; nội dung "VComm - Thanh toan don <số đơn>", app_user "VComm"). Chờ nghiệm thu.
- Nguồn: người dùng yêu cầu 2026-11-11 "Bổ sung thêm cổng zalopay"; tài liệu `05` (phạm vi có ZaloPay); CONG_VIEC_25, CONG_VIEC_32.

## 1. Mục tiêu

Người mua VComm trả tiền đơn qua ZaloPay; VComm chỉ ghi nhận tiền khi kết quả ZaloPay gửi về đúng chữ ký, đúng số tiền, mỗi lần thanh toán một lần.

## 2. Phạm vi

- Làm: lớp kết nối `apps/api/src/marketplace/payments/gateways/zalopay-gateway.ts` và phần ZaloPay dùng chung `zalopay-client.ts` (cấu hình, ký, kiểm chữ ký, tạo đơn, tra cứu; cùng biến `ZALOPAY_*` và kiểu cấu hình với CONG_VIEC_41 để phiên chính gộp lớp Apple Pay về đây); database migration `0060_payment_zalopay.sql` (3 phương thức, mặc định tắt); mã phương thức, mã cổng trong `contracts`; tên phương thức trong i18n; biến môi trường trong `.env.example`; kiểm thử `apps/api/test/c42-payment-zalopay.test.ts`.
- Không làm: gắn tra cứu trạng thái vào luồng ghi nhận tiền (khung chung chưa có chỗ; phiên chính bổ sung khi hợp nhất các cổng); hoàn tiền qua API ZaloPay (hoàn tiền vẫn do kế toán chuyển khoản theo CONG_VIEC_25); VietQR, trả sau qua ZaloPay; mô hình AppToApp (`zp_trans_token`).
- Sửa kiểm thử `c25-payment-methods.test.ts`: chỉ so các phương thức của COD, VNPAY (danh mục có thêm phương thức của cổng mới).

## 3. Chức năng

- CHUC_NANG_156: Thanh toán đơn VComm qua ZaloPay: người mua chọn phương thức ZaloPay, VComm tạo đơn trên ZaloPay và mở trang thanh toán của phương thức đã chọn; ZaloPay báo kết quả về VComm.

| Mã phương thức | Thứ tự | Tên | `preferred_payment_method` |
|---|---|---|---|
| `zalopay_wallet` | 100 | Ví ZaloPay (ứng dụng ZaloPay, mã QR) | `["zalopay_wallet"]` |
| `zalopay_atm` | 101 | Thẻ ATM, tài khoản ngân hàng qua ZaloPay | `["domestic_card","account"]` |
| `zalopay_card` | 102 | Thẻ quốc tế Visa, Mastercard, JCB qua ZaloPay | `["international_card"]` |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_270: Cổng `zalopay` chỉ dùng được khi có đủ `ZALOPAY_APP_ID` (số), `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_PUBLIC_API_URL` (địa chỉ công khai của API; kết quả gửi về, trang trả về theo đường dẫn chung của mã cổng); một bộ biến cho mọi cổng đi qua cùng tài khoản ZaloPay (CONG_VIEC_40, 41); `ZALOPAY_ENDPOINT` trống thì dùng máy chủ thử nghiệm `https://sb-openapi.zalopay.vn` (chạy thật: `https://openapi.zalopay.vn`). Phương thức mặc định tắt.
- QUYTAC_NGHIEPVU_271: Tạo đơn (`POST /v2/create`, dạng form): mã giao dịch `app_trans_id` = ngày `yymmdd` theo giờ Việt Nam + `_` + số tham chiếu của lần thanh toán; `mac` = HMAC SHA256 bằng key1 trên `app_id|app_trans_id|app_user|amount|app_time|embed_data|item`; `embed_data` gồm `redirecturl` và `preferred_payment_method`; `expire_duration_seconds` theo hạn thanh toán của đơn, trong khoảng 300 giây đến 30 ngày. ZaloPay trả `return_code` khác 1, không trả lời trong 10 giây hoặc `order_url` không phải https thì báo "Phương thức thanh toán này hiện không dùng được" và không tính lần thanh toán.
- QUYTAC_NGHIEPVU_272: Kết quả ZaloPay gửi về (`POST /api/v1/public/payments/zalopay/notify`, JSON `{data, mac, type}`): chỉ nhận khi `mac` = HMAC SHA256 bằng key2 trên chuỗi `data` nguyên bản (so bằng `timingSafeEqual`), `type` là 1 (đơn), `app_id` đúng, `app_trans_id` đúng định dạng; số tiền, ghi nhận một lần, việc chờ hoàn theo QUYTAC_NGHIEPVU_166, 221. ZaloPay chỉ gửi khi thanh toán thành công. Trả lời luôn HTTP 200: `return_code` 1 thành công hoặc đã ghi nhận trước đó (thống nhất với CONG_VIEC_41); 2 không có lần thanh toán, sai số tiền; -1 sai chữ ký; 0 lỗi phía VComm để ZaloPay gửi lại (tối đa 3 lần).
- QUYTAC_NGHIEPVU_273: Trang trả về (`GET /api/v1/public/payments/zalopay/return`): kiểm `checksum` = HMAC SHA256 bằng key2 trên `appid|apptransid|pmcid|bankcode|amount|discountamount|status`; `status` 1 là thành công; chỉ hiển thị, không ghi nhận tiền.
- QUYTAC_NGHIEPVU_274: Tra cứu trạng thái (`POST /v2/query`, `mac` = HMAC key1 trên `app_id|app_trans_id|key1`): `return_code` 1 thành công (kèm số tiền, `zp_trans_id`), 2 thất bại, 3 đang xử lý, còn lại không rõ. Hàm `queryZalopayOrder` (`zalopay-client.ts`) có sẵn, chưa gắn vào luồng ghi nhận tiền.

## 5. Vai trò và quyền

Như CONG_VIEC_25: quản trị VComm bật tắt phương thức; người mua mở thanh toán đơn của mình; đường dẫn kết quả, trang trả về công khai, xác thực bằng chữ ký.

## 6. Dữ liệu và API

- Database migration 0060: thêm 3 phương thức vào `marketplace.payment_methods` (gateway `zalopay`, sort_order 100 đến 102, tắt).
- Không thêm API, màn hình: dùng API_131, API_132 và đường dẫn chung của CONG_VIEC_32.
- Lần thanh toán: `response_code` = "1" khi thành công; `gateway_transaction_no` = `zp_trans_id`; `bank_code` = kênh thanh toán (`channel`).

## 7. Điểm chưa xác minh (phải thử với tài khoản thử nghiệm của ZaloPay trước khi phát hành)

- Thuật toán HMAC mặc định SHA256 nếu cửa hàng không đăng ký thuật toán khác với ZaloPay.
- Ý nghĩa `return_code` -1, 0 khi trả lời ZaloPay chỉ thấy trong mã mẫu, bảng chính thức chỉ ghi 1, 2.
- Địa chỉ máy chủ thử nghiệm, chính thức lấy theo tệp PDF tích hợp của ZaloPay; trang tài liệu chính không ghi.
- Kiểu dữ liệu của `channel` trong kết quả gửi về và `amount` có phải số tiền đơn (trước giảm giá) hay không; VComm so với số tiền lần thanh toán.
- Thẻ quốc tế chỉ dùng được khi hợp đồng của cửa hàng với ZaloPay có mở.
- Nguồn: docs.zalopay.vn (specs/order-create, order-query, knowledge-base/callback, status-codes, guides/payment-acceptance/payment-gateway/intro, security/secure-data-transmission), ZaloPay-APIs-Integration-Document.pdf.

## 8. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_270 | Chưa có thông tin kết nối thì không bật được; có thì bật được 3 phương thức ZaloPay, người mua chọn được | Bắt buộc | KICHBAN_KIEMTHU_415 |
| TIEUCHI_NGHIEMTHU_271 | Mở thanh toán tạo đơn trên ZaloPay ký đúng, mở trang của phương thức đã chọn; ZaloPay từ chối thì báo lỗi, không tính lần thanh toán | Bắt buộc | KICHBAN_KIEMTHU_415 |
| TIEUCHI_NGHIEMTHU_272 | Kết quả gửi về sai chữ ký, sai số tiền, không có lần thanh toán bị từ chối; đúng thì ghi nhận một lần, nhận trùng không ghi thêm; trang trả về chỉ hiển thị | Bắt buộc | KICHBAN_KIEMTHU_416, 417 |
| TIEUCHI_NGHIEMTHU_273 | Tra cứu trạng thái ký đúng, đọc đúng thành công, thất bại, đang xử lý, không kết nối được | Bắt buộc | KICHBAN_KIEMTHU_418 |

## 9. Kịch bản kiểm thử

Tệp `apps/api/test/c42-payment-zalopay.test.ts`, máy chủ ZaloPay giả lập (kiểm `mac` của yêu cầu), không gọi máy chủ thật.

- KICHBAN_KIEMTHU_415: bật phương thức khi chưa, đã có thông tin kết nối; tạo đơn ký đúng, tham số gửi ZaloPay; ZaloPay từ chối; lần thứ hai số tham chiếu mới.
- KICHBAN_KIEMTHU_416: kết quả gửi về sai chữ ký, sửa `data`, gửi bằng GET, sai `app_id`, sai số tiền, không có lần thanh toán, đúng, nhận trùng; nhật ký kết quả.
- KICHBAN_KIEMTHU_417: trang trả về trước và sau khi ghi nhận, sai `checksum`, `status` khác 1.
- KICHBAN_KIEMTHU_418: tra cứu trạng thái 1, 2, 3, không kết nối được; ngày trong mã giao dịch theo giờ Việt Nam.

## 10. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `03`: CONG_VIEC_42 dùng QUYTAC_NGHIEPVU_270 đến 274, CHUC_NANG_156, TIEUCHI_NGHIEMTHU_270 đến 273, KICHBAN_KIEMTHU_415 đến 418.
- `07` (chức năng): CHUC_NANG_156 Thanh toán đơn VComm qua ZaloPay (MODULE_09).
- `10` (quy tắc nghiệp vụ): QUYTAC_NGHIEPVU_270 đến 274 như mục 4.
- `11` (dữ liệu): database migration 0060, 3 dòng `marketplace.payment_methods`.
- `13` (API): API_131 với phương thức `zalopay_*` trả `paymentUrl` là `order_url` của ZaloPay; API_132 đường dẫn chung `zalopay/notify`, `zalopay/return`.
- `16` (bảo mật): khóa key1, key2 chỉ ở biến môi trường; kiểm HMAC SHA256 bằng `timingSafeEqual`; sai chữ ký đếm theo IP.
- `17` (lỗi): mở thanh toán khi ZaloPay từ chối dùng `paymentMethodUnavailable`.
- `21` (cấu hình): biến `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT`, `ZALOPAY_PUBLIC_API_URL` (chung với CONG_VIEC_41); khi gộp `.env.example` chỉ giữ một khối ZaloPay.
- `22` (kiểm thử), `25` (truy vết), `27` (nghiệm thu): TIEUCHI_NGHIEMTHU_270 đến 273, KICHBAN_KIEMTHU_415 đến 418 như mục 8, 9.
- Việc tiếp theo cho phiên chính: thêm phương thức không bắt buộc tra cứu trạng thái vào `PaymentGatewayAdapter` và việc nền tra cứu lần thanh toán chờ quá 15 phút (ZaloPay khuyên), gắn `queryZalopayOrder`.
- Khi gộp CONG_VIEC_41: lớp Apple Pay dùng `zalopay-client.ts` (cấu hình, `zalopayMac`, mã giao dịch, kiểm kết quả, trả lời) thay vì bản riêng trong `apple-pay-gateway.ts`.

## 11. Kết quả thực hiện

- 2026-11-11: `c42-payment-zalopay.test.ts` 3/3 đạt; hồi quy `pnpm --filter api test` 47 tệp, 336 kiểm thử đạt. Sau khi gộp nhánh nền (có MoMo) và đổi sang biến chung `ZALOPAY_*`: 48 tệp, 339 kiểm thử đạt; `pnpm --filter api typecheck` đạt.
- Chưa thử với môi trường thử nghiệm của ZaloPay (cần tài khoản cửa hàng thử nghiệm).
