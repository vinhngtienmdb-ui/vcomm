# CONG_VIEC_38: Cổng thanh toán Ecopay (MODULE_09)

- Mô tả: Kết nối ví điện tử Ecopay của Công ty Finviet vào khung nhiều cổng thanh toán của CONG_VIEC_32. Người mua trả bằng ví Ecopay hoặc thẻ ATM nội địa trên trang thanh toán Ecopay.
- Mức: Vừa.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã nghiệm thu, chờ phát hành (người dùng nghiệm thu 2026-11-11); trước khi phát hành phải thử với tài khoản thử nghiệm của nhà cung cấp (Finviet Ecopay).
- Nguồn: người dùng yêu cầu 2026-11-11, tích hợp nhiều cổng thanh toán, trong đó có Ecopay; người dùng xác nhận 2026-11-11: làm theo nguồn tìm được trên GitHub, kèm hỏi lại trạng thái giao dịch; phương thức ví và thẻ ATM nội địa, chưa làm mã QR.

## Nguồn đặc tả cổng và điểm chưa xác minh

- Chưa tìm thấy tài liệu tích hợp công khai của Finviet. Định dạng lấy từ hai SDK mã nguồn mở độc lập trên GitHub, hai nguồn khớp nhau về địa chỉ máy chủ, đường dẫn API và cách ký:
  - `tonleGit/ecopay-sdk` (2023);
  - `shinxz12/finviet-ecopay` (2026, giấy phép MIT, ghi "theo tài liệu chính thức").
- Máy chủ: thử nghiệm `https://mgw-test.finviet.com.vn:6868`, thật `https://mgw.finviet.com.vn:6868`.
  - Mở thanh toán: `POST /api/v1/payment/init`.
  - Hỏi trạng thái giao dịch: `POST /api/v1/payment/checktrans`.
- Chữ ký: bỏ trường `signature` và giá trị rỗng, sắp tên trường theo thứ tự chữ cái, nối các giá trị liền nhau, HMAC SHA256 với khóa bí mật, dạng hex chữ thường.
- Điểm chưa xác minh (phải thử với tài khoản môi trường thử nghiệm Finviet trước khi phát hành):
  1. Cách ký trường dạng đối tượng (`extra_data`). Một SDK bỏ qua trường này, SDK kia ghép chuỗi JSON. VComm chấp nhận chữ ký đúng theo một trong hai cách.
  2. Mã trả lời kết quả gửi về: SDK chỉ ví dụ `{ "result_code": "00" }` khi nhận thành công. Mã cho các trường hợp lỗi do VComm tự đặt.
  3. Nơi khai đường dẫn nhận kết quả (IPN): SDK không có trường này khi mở thanh toán, có thể khai trong trang quản trị Finviet. Đường dẫn của VComm: `<địa chỉ API>/api/v1/public/payments/ecopay/notify`.
  4. Ý nghĩa trạng thái `paid`, `paid_processing`: chưa rõ, nên VComm coi là đang chờ, chưa ghi nhận tiền. Chưa rõ Ecopay có gửi lại kết quả cuối sau khi nhận `00` cho trạng thái đang chờ hay không.
  5. Kênh mã QR (`qrcode`): hai SDK yêu cầu các trường khác nhau, để đợt sau.

## Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_250: Cổng `ecopay` có hai phương thức:
  - `ecopay_wallet`: ví Ecopay, kênh `eco`, thứ tự 60.
  - `ecopay_atm`: thẻ ATM nội địa, kênh `atm`, `bank_type` là `domestic`, thứ tự 61.

  Cả hai mặc định tắt. Thông tin kết nối chỉ ở biến môi trường: `ECOPAY_MERCHANT_CODE`, `ECOPAY_SECRET_KEY`, `ECOPAY_STORE_CODE`, `ECOPAY_TERMINAL_CODE`, `ECOPAY_RETURN_URL`; `ECOPAY_API_URL` trống thì dùng máy chủ thử nghiệm. Thiếu một biến bắt buộc thì cổng chưa sẵn sàng.
- QUYTAC_NGHIEPVU_251: Mở thanh toán:
  - Gửi Ecopay yêu cầu có ký: mã đơn vị, cửa hàng, quầy, mã đơn (số tham chiếu của lần thanh toán), số tiền đồng, `VND`, địa chỉ trả về, thời điểm gửi.
  - Ecopay báo thành công và chữ ký phần `data` đúng thì chuyển người mua tới `payment_url`.
  - Lỗi kết nối, Ecopay báo lỗi hoặc sai chữ ký thì báo "phương thức tạm không dùng được" và không tạo lần thanh toán.
- QUYTAC_NGHIEPVU_252: Kết quả Ecopay gửi về là nội dung JSON. VComm kiểm theo thứ tự:
  1. Chữ ký, so sánh an toàn thời gian.
  2. Mã đơn vị phải trùng.
  3. Hỏi lại trạng thái giao dịch qua `checktrans` (có ký, phản hồi kiểm chữ ký). Mã đơn, số tiền, trạng thái phải khớp kết quả gửi về.

  Sau khi kiểm, xử lý theo trạng thái:
  - `success`: ghi nhận tiền.
  - `failed`, `cancelled`, `timeout`: ghi lần thanh toán thất bại.
  - Trạng thái khác (đang xử lý): báo đang chờ (`pending` của khung, CONG_VIEC_33), không đổi lần thanh toán.

  Không đạt một bước nào thì xử lý như sai chữ ký (QUYTAC_NGHIEPVU_221).
- QUYTAC_NGHIEPVU_253: Trả lời Ecopay:
  - Đã nhận, kể cả nhận trùng hoặc đang chờ: HTTP 200, `result_code` `00`.
  - Không thấy đơn: HTTP 200, `01`.
  - Sai số tiền: HTTP 200, `02`.
  - Sai chữ ký: HTTP 400, `97`.
  - Lỗi máy chủ: HTTP 500, `99`, để Ecopay gửi lại.
- QUYTAC_NGHIEPVU_254: Trang trả về kiểm chữ ký các tham số `order_id`, `fv_payment_transid`, `status`, `ts` (chữ ký ở `Signature`). Trang chỉ hiển thị, không ghi nhận tiền.

## Chức năng

- CHUC_NANG_152: Thanh toán qua cổng Ecopay (ví Ecopay, thẻ ATM nội địa) trong khung nhiều cổng thanh toán. Không có màn hình, API mới: dùng API_131, API_132 của CONG_VIEC_25, CONG_VIEC_32.

## Dữ liệu, mã nguồn

- Database migration `0056_payment_ecopay.sql`: thêm `ecopay_wallet`, `ecopay_atm` vào `marketplace.payment_methods`.
- Lớp kết nối `apps/api/src/marketplace/payments/gateways/ecopay-gateway.ts`. Đăng ký thêm ở danh sách cổng, `paymentMethodCodes`, `paymentGatewayCodes`, i18n (nhóm `paymentMethods`) và `.env.example`.

## Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_254 | Có đủ biến môi trường thì phương thức Ecopay sẵn sàng. Mở thanh toán gửi yêu cầu có ký và trả trang Ecopay; phản hồi sai chữ ký thì không mở, không tạo lần thanh toán | Bắt buộc | KICHBAN_KIEMTHU_399 |
| TIEUCHI_NGHIEMTHU_255 | Kết quả gửi về sai chữ ký, chưa khớp trạng thái trên Ecopay hoặc sai số tiền bị từ chối; đúng thì ghi nhận một lần, đơn chuyển chờ giao | Bắt buộc | KICHBAN_KIEMTHU_400 |
| TIEUCHI_NGHIEMTHU_256 | Thẻ ATM nội địa gửi đúng kênh. Giao dịch thất bại thì ghi lần thanh toán thất bại, đơn vẫn chờ thanh toán; trạng thái đang xử lý thì báo đang chờ, chưa ghi nhận | Bắt buộc | KICHBAN_KIEMTHU_401 |
| TIEUCHI_NGHIEMTHU_257 | Trang trả về kiểm chữ ký, chỉ hiển thị. Thiếu thông tin kết nối thì phương thức chưa sẵn sàng | Bắt buộc | KICHBAN_KIEMTHU_402 |

## Kịch bản kiểm thử

Tệp `apps/api/test/c38-payment-ecopay.test.ts`. Máy chủ Ecopay giả lập chạy cục bộ, ký theo định dạng trên; không gọi máy chủ thật.

- KICHBAN_KIEMTHU_399: Cài đặt bán hàng báo `ecopay_wallet` sẵn sàng. Mở thanh toán:
  - Yêu cầu gửi đi có đủ trường, máy chủ giả lập kiểm chữ ký đúng.
  - Trả `paymentUrl` của Ecopay.
  - Phản hồi sai chữ ký thì trả lỗi nghiệp vụ (HTTP 409), không có lần thanh toán.
- KICHBAN_KIEMTHU_400:
  - Sai chữ ký: HTTP 400, `97`.
  - Đúng chữ ký nhưng Ecopay còn `initial`: từ chối.
  - Sai số tiền: `02`.
  - Đúng: `00`, đơn đã thu 74.000 đồng, sự kiện ghi `ECOPAY <mã giao dịch>`.
  - Gửi lại (ký kiểu ghép JSON): `00`, nhận trùng.
  - Nhật ký ghi đủ 5 lần.
- KICHBAN_KIEMTHU_401: `ecopay_atm` gửi kênh `atm`, `bank_type` là `domestic`.
  - `processing`: trả `00` (đang chờ), lần thanh toán vẫn chờ.
  - `failed`: lần thanh toán thất bại, đơn vẫn chờ thanh toán, đã thu 0.
- KICHBAN_KIEMTHU_402:
  - Trang trả về đúng chữ ký hiện "Thanh toán thành công".
  - Tham số bị sửa hiện "Không xác nhận được kết quả thanh toán".
  - Bỏ khóa bí mật thì phương thức báo chưa sẵn sàng.

## Kết quả kiểm thử

- 2026-11-11: `c38-payment-ecopay.test.ts` đạt 4/4. Kiểm tra kiểu, lint đạt.
- Hồi quy `pnpm --filter api test`: 46/47 tệp đạt; `c25-payment-methods.test.ts` so khớp đúng toàn bộ danh sách phương thức nên lệch khi thêm phương thức Ecopay. Sau khi hợp nhất nhánh nền (đã có cổng MoMo), dùng bản sửa của nhánh nền theo phương án A người dùng duyệt (chỉ so phương thức cổng cod, vnpay); chạy lại c25-*, c33, c38 đạt.

## Các dòng phiên chính cập nhật khi hợp nhất

- Tài liệu 07: QUYTAC_NGHIEPVU_250 đến 254 như trên.
- Tài liệu 10: CHUC_NANG_152.
- Tài liệu 11: TIEUCHI_NGHIEMTHU_254 đến 257.
- Tài liệu 13: Ecopay (Finviet), kết nối bằng `fetch` và `node:crypto`, không thêm thư viện.
- Tài liệu 16: database migration 0056 (dữ liệu danh mục `marketplace.payment_methods`).
- Tài liệu 17: API_132 nhận thêm cổng `ecopay` qua đường dẫn chung.
- Tài liệu 21: KICHBAN_KIEMTHU_399 đến 402.
- Tài liệu 22: khóa bí mật Ecopay chỉ ở biến môi trường. Kết quả gửi về kiểm chữ ký an toàn thời gian, rồi hỏi lại trạng thái giao dịch trước khi ghi nhận tiền.
- Tài liệu 25: kết quả kiểm thử như trên.
- Tài liệu 27: CHUC_NANG_152 → QUYTAC_NGHIEPVU_250 đến 254 → TIEUCHI_NGHIEMTHU_254 đến 257 → KICHBAN_KIEMTHU_399 đến 402.
- Tài liệu 28: đăng ký tài khoản đơn vị Ecopay với Finviet, lấy mã đơn vị, cửa hàng, quầy, khóa bí mật; khai đường dẫn nhận kết quả.
