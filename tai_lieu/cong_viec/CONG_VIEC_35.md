# CONG_VIEC_35: Cổng thanh toán PayOS (MODULE_09)

- Mô tả: Kết nối PayOS vào khung nhiều cổng thanh toán (CONG_VIEC_32): tạo link thanh toán PayOS, hiện thông tin chuyển khoản và chuỗi VietQR do PayOS cấp trong ứng dụng, nhận kết quả qua webhook ký HMAC-SHA256.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Chờ nghiệm thu (phiên con, pull request nháp vào nhánh CONG_VIEC_32).
- Mức: Vừa.
- Nguồn: người dùng yêu cầu 2026-11-11 tích hợp PayOS; CONG_VIEC_25, CONG_VIEC_32. Thiết kế được người dùng xác nhận 2026-11-11 (thêm cột đối chiếu mã đơn PayOS; chỉ mở phương thức `payos_vietqr`).
- Tài liệu cổng: tài liệu công khai payos.vn/docs, gồm API tạo link thanh toán (`POST /v2/payment-requests`), dữ liệu webhook, kiểm tra dữ liệu với signature, dữ liệu trả về returnUrl. Tra cứu 2026-11-11.

## Thiết kế

| Mục | Nội dung |
|---|---|
| Mã cổng | `payos` |
| Phương thức | `payos_vietqr` (sort_order 30, is_enabled false): người mua thấy ngay trong ứng dụng thông tin chuyển khoản (ngân hàng, số tài khoản, tên, số tiền, nội dung) và chuỗi VietQR EMVCo của PayOS. Chưa mở phương thức chuyển sang trang `checkoutUrl` của PayOS (người dùng chọn 2026-11-11). |
| Biến môi trường | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_RETURN_URL` (bắt buộc); `PAYOS_BANK_NAME` (tên ngân hàng hiện cho người mua, vì PayOS chỉ trả mã BIN), `PAYOS_API_URL` (mặc định `https://api-merchant.payos.vn`) |
| Tạo link | `POST {PAYOS_API_URL}/v2/payment-requests`, tiêu đề `x-client-id`, `x-api-key`; nội dung `orderCode`, `amount`, `description` (9 ký tự cuối của số tham chiếu), `returnUrl` = `cancelUrl` = `PAYOS_RETURN_URL`, `expiredAt` (hạn thanh toán của đơn, giây Unix), `signature` = HMAC-SHA256 hex của `amount=…&cancelUrl=…&description=…&orderCode=…&returnUrl=…` bằng khóa checksum. PayOS báo lỗi (mã khác `00`, số tiền hoặc mã đơn trả về không khớp) thì không lưu lần thanh toán, người mua nhận lỗi hệ thống và thử lại. |
| Mã đơn PayOS | PayOS chỉ nhận `orderCode` số nguyên. Khung cấp mã riêng cho cổng (`createOrderCode`): mili giây × 1000 + số ngẫu nhiên 0 đến 999, lưu ở `marketplace.payments.gateway_order_code`. Chỉ mục duy nhất (gateway_code, gateway_order_code) chặn trùng. |
| Webhook | `POST /api/v1/public/payments/payos/notify`. Chữ ký là HMAC-SHA256 hex trên đối tượng `data`: khóa xếp theo chữ cái, null thành chuỗi rỗng, mảng thành JSON, nối dạng `key=value&…`. So sánh bằng `timingSafeEqual`. Thành công khi `code` và `data.code` đều là `00`. Mã giao dịch lấy từ `data.reference`, ngân hàng người trả từ `data.counterAccountBankId`. |
| Trả lời PayOS | Ghi nhận thành công, không có đơn, đã ghi nhận, sai số tiền: HTTP 200 (bản thử khi đăng ký webhook có mã đơn 123 cũng phải nhận 200). Sai chữ ký: 400. VComm lỗi hoặc chưa cấu hình: 500 để PayOS gửi lại. |
| Trang trả về | `GET /api/v1/public/payments/payos/return`, PayOS gắn `code`, `id`, `cancel`, `status`, `orderCode` và không có chữ ký. Trang chỉ dùng `orderCode` để tìm lần thanh toán. "Thành công" chỉ hiện khi cơ sở dữ liệu đã ghi nhận; `cancel=true` hoặc `CANCELLED` thì báo không thành công. |

### Điểm chưa xác minh (phải thử trước khi phát hành)

- PayOS không có môi trường thử nghiệm riêng. Cần thử bằng kênh thanh toán thật với số tiền nhỏ: tạo link, quét VietQR, nhận webhook, trang trả về.
- Giới hạn của `orderCode` theo tài liệu là số nguyên; VComm giữ mã dưới 2^53 − 1 (16 chữ số).
- Nội dung chuyển khoản lấy từ `data.description` PayOS trả về. Tài liệu không nói rõ PayOS có thêm tiền tố hay không; ứng dụng hiện đúng chuỗi PayOS trả về.
- Không kiểm chữ ký trên phản hồi tạo link, vì tài liệu không nêu các trường được ký. Thay vào đó, VComm đối chiếu số tiền và mã đơn trong phản hồi.
- Kiểu dữ liệu các trường trong `data` của webhook suy ra từ ví dụ trong tài liệu. Ví dụ JS của PayOS không mã hóa JSON đối tượng lồng nhau; webhook thanh toán không có trường lồng nhau.
- Đăng ký webhook trên my.payos.vn: địa chỉ công khai của API + `/api/v1/public/payments/payos/notify`.

## Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_235: Cổng chỉ nhận mã đơn dạng số (PayOS) thì lớp kết nối cấp mã đơn riêng (`createOrderCode`). Mã này lưu cùng lần thanh toán (`gateway_order_code`, duy nhất theo cổng). Kết quả gửi về và trang trả về tìm lần thanh toán theo số tham chiếu hoặc theo mã đơn riêng của cổng.
- QUYTAC_NGHIEPVU_236: Kết quả PayOS chỉ được nhận khi chữ ký HMAC-SHA256 trên `data` (khóa checksum) đúng, so sánh an toàn thời gian. Sửa bất kỳ trường nào trong `data` thì bị từ chối.
- QUYTAC_NGHIEPVU_237: VComm trả PayOS HTTP 200 với mọi kết quả đã xử lý (kể cả không có đơn, sai số tiền, nhận trùng), 400 khi sai chữ ký, 500 khi VComm lỗi để PayOS gửi lại.
- QUYTAC_NGHIEPVU_238: Mở thanh toán PayOS tạo link với hạn bằng hạn thanh toán của đơn, hiện thông tin chuyển khoản và chuỗi VietQR. PayOS báo lỗi thì không lưu lần thanh toán và không tính vào giới hạn 10 lần.
- QUYTAC_NGHIEPVU_239: Trang trả về PayOS không có chữ ký, nên chỉ hiển thị. Trạng thái đã thu lấy từ cơ sở dữ liệu, tham số giả mạo không làm đơn thành đã thu.

## Chức năng

- CHUC_NANG_149: Thanh toán đơn VComm qua PayOS (chuyển khoản VietQR), nhận kết quả tự động.

## Dữ liệu, API

- Database migration 0053 (`database/migrations/0053_payment_payos.sql`): thêm cột `marketplace.payments.gateway_order_code text`, chỉ mục duy nhất `payments_gateway_order_code_key (gateway_code, gateway_order_code) WHERE gateway_order_code IS NOT NULL`, phương thức `payos_vietqr`. Đây là thay đổi cấu trúc dữ liệu ngoài phạm vi "chỉ INSERT" của hướng dẫn chung, người dùng đã đồng ý 2026-11-11.
- Khung (CONG_VIEC_32) mở rộng không phá vỡ: `PaymentGatewayAdapter.createOrderCode?()`, `PaymentStartInput.gatewayOrderCode`, `GatewayNotification.reference` có thể null kèm `gatewayOrderCode`. VNPAY không đổi.
- Không thêm API mới; dùng API_131, API_132 (đường dẫn chung).

## Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_242 | Mở thanh toán PayOS tạo link ký đúng, hạn bằng hạn đơn; ứng dụng nhận thông tin chuyển khoản và chuỗi VietQR | Bắt buộc | KICHBAN_KIEMTHU_387 |
| TIEUCHI_NGHIEMTHU_243 | Webhook sai chữ ký hoặc bị sửa dữ liệu bị từ chối; sai số tiền, mã đơn lạ không ghi nhận; đúng thì ghi đã thu một lần, nhận trùng không ghi thêm | Bắt buộc | KICHBAN_KIEMTHU_388 |
| TIEUCHI_NGHIEMTHU_244 | Trang trả về chỉ hiển thị theo cơ sở dữ liệu; tham số giả mạo không ghi nhận tiền | Bắt buộc | KICHBAN_KIEMTHU_389 |
| TIEUCHI_NGHIEMTHU_245 | PayOS lỗi khi tạo link không tính lần thanh toán; giao dịch thất bại giữ đơn chờ thanh toán, mở lại với mã mới; thiếu cấu hình không mở được, webhook trả 500 | Bắt buộc | KICHBAN_KIEMTHU_390 |

## Kịch bản kiểm thử

Tệp `apps/api/test/c35-payment-payos.test.ts`, chạy với máy chủ PayOS giả lập theo tài liệu công khai, không gọi máy chủ thật.

| Mã | Kịch bản |
|---|---|
| KICHBAN_KIEMTHU_387 | Bật `payos_vietqr`, đặt đơn, mở thanh toán: kiểm tiêu đề, chữ ký, `expiredAt` gửi PayOS; kết quả có thông tin chuyển khoản, chuỗi VietQR; mã đơn số được lưu |
| KICHBAN_KIEMTHU_388 | Webhook ký sai khóa (400), sửa số tiền sau khi ký (400), sai số tiền (200, không ghi nhận), mã đơn 123 (200), đúng (đã thu, đơn chờ giao, ghi chú `PAYOS <mã giao dịch>`), nhận trùng (không ghi thêm); nhật ký kết quả |
| KICHBAN_KIEMTHU_389 | Trang trả về `status=PAID` khi chưa có webhook: đang chờ; `cancel=true`: không thành công; mã đơn lạ hoặc không phải số: không xác nhận; sau webhook: thành công, liên kết mở đơn |
| KICHBAN_KIEMTHU_390 | PayOS báo lỗi khi tạo link: 500, không có lần thanh toán; webhook `code` khác `00`: lần thanh toán thất bại, đơn vẫn chờ, mở lại `T02` với mã đơn mới; thiếu khóa checksum: không mở được, webhook 500 |

## Kết quả kiểm thử (2026-11-11)

- `c35-payment-payos.test.ts`: 4/4 đạt.
- Hồi quy `pnpm --filter api test`: 47 tệp, 337 kiểm thử đạt. Riêng `c25-payment-methods.test.ts` được sửa để chỉ so 4 phương thức đầu (cod, VNPAY), vì cổng mới thêm phương thức vào danh mục.
- `pnpm turbo run typecheck lint`: đạt.

## Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_235 đến 239 (nội dung ở mục Quy tắc nghiệp vụ).
- `10`: CHUC_NANG_149.
- `11`: TIEUCHI_NGHIEMTHU_242 đến 245.
- `13`: không thêm thư viện (dùng `fetch`, `node:crypto`). Thêm dòng dịch vụ ngoài: PayOS, API `api-merchant.payos.vn`.
- `16`: `marketplace.payments.gateway_order_code` (text, null; duy nhất theo `gateway_code`). `marketplace.payment_methods` thêm `payos_vietqr`.
- `17`: API_131 với cổng `payos` trả `transfer`. API_132 đường dẫn chung với cổng `payos`: webhook POST JSON, trả 200/400/500 như QUYTAC_NGHIEPVU_237.
- `21`: KICHBAN_KIEMTHU_387 đến 390.
- `22`: khóa checksum PayOS chỉ ở biến môi trường; webhook kiểm HMAC-SHA256 bằng so sánh an toàn thời gian; trang trả về không tin tham số.
- `24`: phiếu thay đổi cấu trúc dữ liệu (thêm cột `gateway_order_code`, mở rộng giao diện lớp kết nối), người dùng đồng ý 2026-11-11.
- `25`: kết quả kiểm thử ở mục trên.
- `27`: CHUC_NANG_149 → QUYTAC_NGHIEPVU_235 đến 239 → TIEUCHI_NGHIEMTHU_242 đến 245 → KICHBAN_KIEMTHU_387 đến 390 → `payos-gateway.ts`, `c35-payment-payos.test.ts`.
- `28`: hướng dẫn đăng ký PayOS: tạo kênh thanh toán trên my.payos.vn, lấy Client ID, API Key, Checksum Key, đăng ký webhook.
