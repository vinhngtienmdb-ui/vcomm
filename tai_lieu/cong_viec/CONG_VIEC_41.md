# CONG_VIEC_41: Cổng Apple Pay qua ZaloPay (MODULE_09)

- Mô tả: Người mua trả bằng thẻ trong Apple Wallet trên ứng dụng VComm (iOS, Safari web) qua trang thanh toán ZaloPay, kết nối vào khung nhiều cổng của CONG_VIEC_32.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11. Đã làm xong, chờ nghiệm thu.
- Nguồn: người dùng yêu cầu 2026-11-11 "mở thêm phiên để tích hợp google pay và apple pay"; CONG_VIEC_25, CONG_VIEC_32.

## 1. Mục tiêu

Người mua dùng iPhone, iPad, Mac trả tiền đơn VComm bằng Apple Pay; VComm ghi nhận tiền theo đúng khung thanh toán hiện có.

## 2. Phạm vi

Quyết định của người dùng ngày 2026-11-11:
- Đơn vị xử lý: ZaloPay (trang thanh toán ZaloPay có Apple Pay). Phương án trình kèm: MoMo, OnePay (cũng qua trang thanh toán); 2C2P, Mastercard Gateway, Cybersource (bảng Apple Pay native, gửi token). Chọn ZaloPay vì có tài liệu công khai cho cả Apple Pay và Google Pay, dùng chung được với CONG_VIEC_40.
- VComm chưa có tài khoản Apple Developer; hướng qua trang thanh toán ZaloPay không cần Apple Merchant ID, chứng chỉ xử lý thanh toán, xác minh tên miền phía VComm (ZaloPay đảm nhận). Phát hành ứng dụng iOS vẫn cần tài khoản Apple Developer (việc riêng, ngoài công việc này).
- VComm chưa có hợp đồng ZaloPay; mã làm theo tài liệu công khai, kiểm thử bằng máy chủ giả lập. Cần thử với tài khoản môi trường thử nghiệm ZaloPay trước khi phát hành.
- Ẩn phương thức Apple Pay trên ứng dụng Android.

Trong phạm vi:
- Lớp kết nối `apps/api/src/marketplace/payments/gateways/apple-pay-gateway.ts` (mã cổng `apple_pay`): tạo đơn ZaloPay, chuyển người mua sang trang ZaloPay, kiểm kết quả gửi về, kiểm trang trả về.
- Phương thức `apple_pay_wallet` (database migration 0059, mặc định tắt).
- Màn hình đặt hàng (MAN_HINH_93) ẩn phương thức của cổng `apple_pay` trên Android.

Ngoài phạm vi:
- Bảng Apple Pay native trong ứng dụng, kiểu hướng dẫn nhận token từ ứng dụng (`wallet_token`): không cần với hướng đã chọn; không thêm vào khung.
- Chủ động hỏi trạng thái đơn ZaloPay (Order Query API) khi không nhận được kết quả gửi về; hoàn tiền tự động qua ZaloPay.

## 3. Yêu cầu nghiệp vụ và chức năng

- CHUC_NANG_155: Thanh toán đơn VComm bằng Apple Pay qua trang thanh toán ZaloPay (thuộc YCAU_NGHIEPVU_51, theo khung CHUC_NANG_121).

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_265: Mở thanh toán Apple Pay tạo đơn ZaloPay (`POST /v2/create`): `app_trans_id` = ngày yymmdd theo giờ Việt Nam + `_` + số tham chiếu của lần thanh toán; `amount` bằng số tiền lần thanh toán; `app_user` là "vcomm" (không gửi thông tin người mua); thời hạn đơn theo hạn thanh toán của đơn VComm (300 đến 2592000 giây); `callback_url` là `/api/v1/public/payments/apple_pay/notify`, `redirecturl` là `/api/v1/public/payments/apple_pay/return`; ký `mac` = HMAC-SHA256(key1, `app_id|app_trans_id|app_user|amount|app_time|embed_data|item`). ZaloPay từ chối thì báo lỗi, không ghi lần thanh toán.
- QUYTAC_NGHIEPVU_266: Kết quả ZaloPay gửi về chỉ nhận khi là POST, `mac` = HMAC-SHA256(key2, `data`) (so sánh an toàn thời gian), `app_id` đúng, `type` là đơn (1); sau đó xử lý như QUYTAC_NGHIEPVU_166, 221 (số tiền, một lần, việc chờ hoàn). ZaloPay chỉ gửi khi đã thu tiền.
- QUYTAC_NGHIEPVU_267: Trả lời ZaloPay HTTP 200 kèm `return_code`: 1 khi ghi nhận thành công hoặc đã ghi nhận trước đó; 2 khi không có lần thanh toán hoặc sai số tiền; -1 khi sai chữ ký; 0 khi lỗi máy chủ (ZaloPay gửi lại).
- QUYTAC_NGHIEPVU_268: Phương thức Apple Pay không hiện trên ứng dụng Android; trên iOS và web người mua được chuyển sang trang ZaloPay để chọn Apple Pay.
- QUYTAC_NGHIEPVU_269: Trang trả về kiểm `checksum` = HMAC-SHA256(key2, `appid|apptransid|pmcid|bankcode|amount|discountamount|status`), `status` = 1 là thành công; chỉ hiển thị, không ghi nhận tiền.

## 5. Vai trò và quyền

Như CONG_VIEC_25: người mua mở thanh toán đơn của mình; quản trị bật tắt phương thức ở cài đặt bán hàng VComm (chỉ bật được khi có đủ biến môi trường ZaloPay).

## 6. Luồng nghiệp vụ

Người mua chọn Apple Pay → đặt đơn (Chờ thanh toán) → mở thanh toán → API tạo đơn ZaloPay, trả `paymentUrl` → ứng dụng mở trang ZaloPay (Safari) → người mua chọn Apple Pay, xác thực Face ID / Touch ID → ZaloPay gửi kết quả về `/apple_pay/notify` → đơn Chờ giao → ZaloPay chuyển người mua về `/apple_pay/return` → liên kết mở lại đơn trên ứng dụng.

## 7. Màn hình

Không thêm màn hình. MAN_HINH_93 Đặt hàng: lọc phương thức `apple_pay*` khi `Platform.OS` là Android. MAN_HINH đơn hàng giữ cách mở `paymentUrl` hiện có.

## 8. Dữ liệu và API

- Database migration `0059_payment_apple_pay.sql`: `apple_pay_wallet` (cổng `apple_pay`, sort_order 90, tắt).
- Không thêm API; dùng API_131 (trả `paymentUrl`) và đường dẫn chung của API_132.
- Biến môi trường (`.env.example`): `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT` (trống là `https://sb-openapi.zalopay.vn`), `ZALOPAY_PUBLIC_API_URL`, `ZALOPAY_APPLE_PAY_PREFERRED_METHODS`. Bốn biến đầu đặt tên chung cho mọi phương thức đi qua ZaloPay (CONG_VIEC_40 Google Pay có thể dùng lại).

## 9. Điều kiện đặc biệt và điểm chưa xác minh

Tài liệu công khai: [Create Order](https://docs.zalopay.vn/docs/specs/order-create), [Callback](https://docs.zalopay.vn/docs/developer-tools/knowledge-base/callback), [Payment Gateway, trang trả về](https://docs.zalopay.vn/docs/guides/payment-acceptance/payment-gateway/intro), [Apple Pay](https://docs.zalopay.vn/docs/guides/payment-acceptance/applepay/intro). Cần hỏi ZaloPay khi ký hợp đồng, thử trên môi trường thử nghiệm trước khi phát hành:
- Giá trị `preferred_payment_method` mở thẳng Apple Pay chưa công bố (trang Quickstart Apple Pay trống). Mặc định gửi `[]` (trang ZaloPay hiện mọi phương thức theo hợp đồng, có Apple Pay); có giá trị thì điền `ZALOPAY_APPLE_PAY_PREFERRED_METHODS`, không sửa mã.
- Ý nghĩa đầy đủ của `return_code` 2 khi trả lời ZaloPay (tài liệu chỉ ghi 1 thành công, 2 thất bại; mẫu mã: -1 sai mac, 0 gửi lại tối đa 3 lần).
- ZaloPay không gửi kết quả cho giao dịch thất bại: lần thanh toán chờ tới khi đơn quá hạn (khung tự hủy); người mua mở thanh toán lại được.
- Mã kênh (`channel`, `pmcid`) của Apple Pay chưa công bố; lưu vào `bank_code` của lần thanh toán để tra soát, không dùng để lọc.
- Người mua có thể chọn phương thức khác trên trang ZaloPay khi chưa đặt `preferred_payment_method`; tiền vẫn ghi nhận vào lần thanh toán của phương thức `apple_pay_wallet`.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_266 | Phương thức Apple Pay hiện cho người mua (trừ Android), mở thanh toán chuyển sang trang ZaloPay với đơn ký đúng | Bắt buộc | KICHBAN_KIEMTHU_411 |
| TIEUCHI_NGHIEMTHU_267 | Kết quả ZaloPay gửi về: sai chữ ký, sai số tiền bị từ chối; đúng thì ghi đã thu một lần, đơn Chờ giao | Bắt buộc | KICHBAN_KIEMTHU_412 |
| TIEUCHI_NGHIEMTHU_268 | Trang trả về kiểm checksum, chỉ hiển thị kết quả | Bắt buộc | KICHBAN_KIEMTHU_413 |
| TIEUCHI_NGHIEMTHU_269 | Thiếu thông tin kết nối ZaloPay thì không bật, không mở được thanh toán Apple Pay | Bắt buộc | KICHBAN_KIEMTHU_414 |

## 11. Kịch bản kiểm thử

Tệp `apps/api/test/c41-payment-apple-pay.test.ts` (máy chủ ZaloPay giả lập trên máy, không gọi máy chủ thật):
- KICHBAN_KIEMTHU_411: cài đặt bán hàng có `apple_pay_wallet` đã bật, có thông tin kết nối; ZaloPay từ chối tạo đơn thì lỗi, không có lần thanh toán; tạo đơn thành công: `mac` đúng, `app_trans_id` = yymmdd_số tham chiếu, `callback_url`, `redirecturl` đúng, trả `paymentUrl` là `order_url`.
- KICHBAN_KIEMTHU_412: sai mac → -1 (ghi lại không kèm số tham chiếu); GET → -1; sai số tiền → 2; không có lần thanh toán → 2; đúng → 1, đơn Chờ giao, ghi `zp_trans_id`, kênh; gửi lại → 1, không ghi thêm.
- KICHBAN_KIEMTHU_413: checksum sai → không xác nhận; status 1 nhưng chưa có kết quả gửi về → đang chờ, chưa thu tiền; status khác 1 → không thành công; sau khi nhận kết quả → thành công, liên kết mở đơn.
- KICHBAN_KIEMTHU_414: thiếu `ZALOPAY_KEY2` → phương thức báo chưa có thông tin kết nối, mở thanh toán 409, kết quả gửi về trả 0; ngày trong `app_trans_id` theo giờ Việt Nam.

Ẩn trên Android (QUYTAC_NGHIEPVU_268): kiểm tra kiểu ứng dụng, xem trước trên thiết bị khi nghiệm thu (chưa có kiểm thử tự động cho ứng dụng di động).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện (dùng `fetch`, `node:crypto`). Không thêm thư viện native cho Expo, không cần bản dựng riêng.

## 13. Thành phần không được thay đổi

Hành vi khung CONG_VIEC_32 và VNPAY giữ nguyên; chỉ thêm dòng vào `paymentGateways`, `paymentMethodCodes`, `paymentGatewayCodes`, nhóm dịch `paymentMethods`.

## 14. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_265 đến 269 (mục 4).
- `10`: CHUC_NANG_155 (mục 3).
- `11`: TIEUCHI_NGHIEMTHU_266 đến 269 (mục 10).
- `13`: ZaloPay Gateway (Apple Pay trên trang thanh toán ZaloPay), không thêm thư viện; phương án đã xét ở mục 2.
- `16`: phương thức `apple_pay_wallet`, cổng `apple_pay` trong `marketplace.payment_methods` (database migration 0059).
- `17`: API_132 thêm cổng `apple_pay` (`/public/payments/apple_pay/notify` POST JSON `{data, mac, type}`, trả `{return_code, return_message}`; `/public/payments/apple_pay/return`).
- `21`: KICHBAN_KIEMTHU_411 đến 414 (mục 11).
- `22`: khóa `ZALOPAY_KEY1`, `ZALOPAY_KEY2` chỉ ở biến môi trường; kết quả gửi về kiểm HMAC-SHA256 bằng `timingSafeEqual`; không gửi thông tin người mua sang ZaloPay.
- `25`: kết quả kiểm thử ở mục 15.
- `27`: YCAU_NGHIEPVU_51 → CHUC_NANG_155 → TIEUCHI_NGHIEMTHU_266 đến 269 → KICHBAN_KIEMTHU_411 đến 414 → `apple-pay-gateway.ts`, `c41-payment-apple-pay.test.ts`, `dat-hang.tsx`.
- Gộp với CONG_VIEC_40 (Google Pay): nếu cũng dùng ZaloPay, tách phần chung (cấu hình `zalopayConfiguration`, `zalopayMac`, `zalopayTransactionId`, tạo đơn) thành `gateways/zalopay.ts` khi hợp nhất.

## 15. Kết quả thực hiện

Ngày 2026-11-11:
- `c41-payment-apple-pay.test.ts`: 4/4 kịch bản đạt.
- Kiểm thử hồi quy `pnpm --filter api test` lần 1: 336/337 đạt; `c25-payment-methods` (KICHBAN_KIEMTHU_321) so cả danh mục phương thức nên lệch khi thêm `apple_pay_wallet`, sửa để chỉ xét phương thức của COD, VNPAY (cổng thêm sau cũng không làm vỡ kiểm thử); chạy lại tệp đạt. Lần 2: 47 tệp, 337/337 đạt.
- Gộp nhánh nền sau khi CONG_VIEC_33 (MoMo) hợp nhất: giữ cả hai cổng; `c25-payment-methods` lấy bản trên nhánh nền (phương án A, người dùng duyệt); thêm câu trả lời `pending` (kiểu kết quả mới của khung, ZaloPay không gửi trạng thái này). c25-*, c32, c33, c41: đạt.
- `pnpm typecheck` (13 gói), `pnpm lint`: đạt.
