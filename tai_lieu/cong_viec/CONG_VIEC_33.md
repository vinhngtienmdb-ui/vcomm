# CONG_VIEC_33: Cổng thanh toán MoMo (MODULE_09)

- Mô tả: Kết nối MoMo vào khung nhiều cổng thanh toán (CONG_VIEC_32): ví MoMo (ứng dụng, mã QR MoMo), thẻ ATM nội địa qua MoMo, thẻ quốc tế qua MoMo.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11. Đã lập trình, kiểm thử tự động bằng máy chủ MoMo giả lập; chờ nghiệm thu.
- Nguồn: người dùng yêu cầu 2026-11-11 tích hợp MoMo; CONG_VIEC_25, CONG_VIEC_32.
- Mức: Vừa (một module; thêm phương thức, biến môi trường; sửa nhỏ khung dùng chung, không đổi API).

## 1. Mục tiêu

Người mua VComm trả tiền đơn bằng ví MoMo, thẻ ATM nội địa hoặc thẻ quốc tế qua cổng MoMo; VComm ghi nhận đúng tiền thu như cổng VNPAY.

## 2. Phạm vi

Trong phạm vi:
- Phương thức `momo_wallet` (`captureWallet`), `momo_atm` (`payWithATM`), `momo_card` (`payWithCC`), mặc định tắt.
- Tạo thanh toán qua API MoMo, chuyển người mua tới trang MoMo (`payUrl`); trên điện thoại trang MoMo mở ứng dụng MoMo, trên máy tính hiện mã QR MoMo.
- Nhận kết quả qua đường dẫn chung `/api/v1/public/payments/momo/notify` (IPN), trang trả về `/api/v1/public/payments/momo/return`.
- Sửa khung dùng chung của CONG_VIEC_32 (người dùng đồng ý ngày 2026-11-11): trạng thái đang xử lý, thông tin người mua khi mở thanh toán, câu trả lời có chữ ký.

Ngoài phạm vi: hoàn tiền tự động qua API hoàn tiền của MoMo (hoàn tiền vẫn do kế toán chuyển khoản theo QUYTAC_NGHIEPVU_168); tra cứu trạng thái giao dịch chủ động; mã QR MoMo vẽ trên ứng dụng VComm (`qrCodeUrl`, `deeplink` cần MoMo cấp quyền trên môi trường thật).

## 3. Yêu cầu chức năng

- CHUC_NANG_147: Thanh toán đơn VComm qua cổng MoMo (ví MoMo, thẻ ATM nội địa, thẻ quốc tế).

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_225: Cổng `momo` có ba phương thức `momo_wallet`, `momo_atm`, `momo_card`. Cổng có thông tin kết nối khi đủ biến môi trường `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_IPN_URL`, `MOMO_RETURN_URL` (`MOMO_ENDPOINT` để trống là môi trường thử nghiệm). Mở thanh toán gửi MoMo số tham chiếu của lần thanh toán làm `orderId` và `requestId`, ký HMAC SHA256.
- QUYTAC_NGHIEPVU_226: Hạn mức số tiền một lần thanh toán: ví MoMo 1.000 đến 50.000.000 đồng; thẻ ATM 10.000 đến 50.000.000 đồng; thẻ quốc tế 1.000 đến 10.000.000 đồng. Ngoài hạn mức thì báo người mua chọn phương thức khác, không gọi MoMo. Thẻ quốc tế cần email người mua (MoMo bắt buộc); người mua chưa có email thì báo, không gọi MoMo. MoMo từ chối hoặc không trả lời thì báo lỗi, không giữ lần thanh toán.
- QUYTAC_NGHIEPVU_227: Kết quả MoMo gửi về chỉ nhận khi đúng chữ ký và đúng mã đối tác; xử lý theo QUYTAC_NGHIEPVU_166. `resultCode` 0 hoặc 9000 là thành công; 1000, 7000, 7002 là đang xử lý (trả lời đã nhận, không đổi trạng thái lần thanh toán); mã khác là thất bại. Trả lời MoMo: ví, ATM HTTP 204; thẻ quốc tế HTTP 200 kèm JSON có chữ ký; sai chữ ký HTTP 400; lỗi phía VComm (ví, ATM) HTTP 500. Không lưu `callbackToken` vào nhật ký kết quả cổng.

## 5. Thay đổi khung dùng chung (CONG_VIEC_32)

Người dùng đồng ý ngày 2026-11-11. Tham số mới đều tùy chọn; hành vi VNPAY không đổi.

| Tệp | Thay đổi |
|---|---|
| `apps/api/src/marketplace/payments/payment-gateway.ts` | `PaymentStartInput.buyer` (tên, số điện thoại, email); `GatewayNotification.pending`, `replyContext`; `NotificationOutcome` thêm `pending`; `reply(outcome, notification?)` |
| `apps/api/src/marketplace/payments/payments.service.ts` | Mở thanh toán đọc tên, số điện thoại, email người mua; kết quả đang xử lý trả `pending`, không ghi nhận; truyền kết quả đã xác thực cho `reply()`; trang trả về hiện "đang chờ" khi đang xử lý; nhật ký kết quả bỏ tham số có chữ `token` |
| `apps/api/src/marketplace/payments/gateways/vnpay-gateway.ts` | Thêm câu trả lời cho `pending` (VNPAY không gửi trạng thái này) |
| `apps/api/test/c25-payment-methods.test.ts` | Chỉ so phương thức của cổng `cod`, `vnpay` (người dùng duyệt ngày 2026-11-11); các cổng CONG_VIEC_34 đến 39 không phải sửa kiểm thử này nữa |

Các phiên CONG_VIEC_34 đến 39 có thể dùng `pending`, `buyer`, `replyContext`. Nếu phiên khác cũng sửa `c25-payment-methods.test.ts` thì khi hợp nhất giữ bản lọc theo cổng.

## 6. Dữ liệu và API

- Database migration `0051_payment_momo.sql`: thêm `momo_wallet` (sort_order 10), `momo_atm` (11), `momo_card` (12), tắt.
- API: không thêm. API_131 trả `paymentUrl` là trang MoMo; API_132 đường dẫn chung với mã cổng `momo`.
- Lỗi mới (tệp dịch, nhóm `errors`): `paymentAmountOutOfRange`, `paymentEmailRequired`, `paymentGatewayStartFailed`.
- Tên phương thức (nhóm `paymentMethods`): `momo_wallet`, `momo_atm`, `momo_card`, `gateway_momo`.

## 7. Điều kiện đặc biệt

- Tài liệu MoMo: trang `developers.momo.vn` chặn truy cập tự động (403). Định dạng lấy từ SDK chính thức `github.com/momo-wallet/java` (địa chỉ máy chủ, `requestType`, chuỗi ký tạo thanh toán), kho mẫu `github.com/momo-wallet/payment` (chuỗi ký IPN, trang trả về) và bản chép tài liệu MoMo phiên bản 3 trên GitHub `Gnourt812005/docsearch` (hạn mức, mã kết quả, IPN 204, thẻ quốc tế).
- Không lưu thông tin thẻ; người mua nhập thẻ trên trang MoMo.
- Không thêm thư viện (`fetch`, `node:crypto`).

Điểm chưa xác minh (phải thử với tài khoản môi trường thử nghiệm MoMo do người dùng cấp trước khi phát hành):
1. Thẻ quốc tế: tài liệu trang thẻ quốc tế có chuỗi ký IPN gồm `callbackToken`, `partnerClientId` và câu trả lời có chữ ký, có thể lẫn với luồng lưu thẻ; tên trường ghi cả `partnerClientid` và `partnerClientId` (mã nhận cả hai); định dạng `responseTime` trong câu trả lời theo tài liệu là `YYYY-MM-DD HH:mm:ss` giờ Việt Nam. Mã kết quả gửi lại MoMo (0, 21, 42, 99) do VComm chọn theo bảng mã MoMo.
2. MoMo có gửi lại IPN khi VComm trả HTTP 500 hay không.
3. MoMo có gửi IPN với mã đang xử lý hay không (mã xử lý được cả hai trường hợp).
4. `transId` gửi dạng số; giá trị vượt 2^53 sẽ không kiểm được chữ ký (hiện khoảng 4 tỷ).
5. Hạn của trang MoMo không gắn với hạn 15 phút của đơn; người mua trả sau khi đơn tự hủy thì khung lập việc chờ hoàn tiền (QUYTAC_NGHIEPVU_165).

## 8. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_234 | Phương thức MoMo bật được khi có thông tin kết nối, người mua chọn được; mở thanh toán gửi MoMo yêu cầu ký đúng, trả trang MoMo; ngoài hạn mức, thẻ quốc tế thiếu email, MoMo từ chối đều báo lỗi rõ, không giữ lần thanh toán | Bắt buộc | KICHBAN_KIEMTHU_379 |
| TIEUCHI_NGHIEMTHU_235 | IPN ví, ATM (giả lập): sai chữ ký, sai mã đối tác, sai số tiền bị từ chối; đang xử lý không ghi nhận; thành công ghi đã thu một lần, đơn Chờ giao; thất bại ghi thất bại; trang trả về kiểm chữ ký | Bắt buộc | KICHBAN_KIEMTHU_380 |
| TIEUCHI_NGHIEMTHU_236 | IPN thẻ quốc tế (giả lập): kiểm chữ ký có `callbackToken`, trả lời HTTP 200 có chữ ký đúng; không lưu `callbackToken` | Bắt buộc | KICHBAN_KIEMTHU_381 |

## 9. Kịch bản kiểm thử

KICHBAN_KIEMTHU_379 đến 381: tự động, `apps/api/test/c33-payment-momo.test.ts` (máy chủ MoMo giả lập trên máy, không gọi máy chủ thật).

## 10. Thành phần không được thay đổi

Luồng VNPAY, thanh toán khi nhận hàng, hoàn tiền, bút toán của CONG_VIEC_25; mã hoa hồng CONG_VIEC_26.

## 11. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- Tài liệu `07`: QUYTAC_NGHIEPVU_225, 226, 227 (mục 4).
- Tài liệu `10`: CHUC_NANG_147 (mục 3), thuộc MODULE_09.
- Tài liệu `11`: TIEUCHI_NGHIEMTHU_234, 235, 236 (mục 8).
- Tài liệu `13`: cổng MoMo, API v2 `/v2/gateway/api/create`, HMAC SHA256, không thêm thư viện.
- Tài liệu `16`: database migration 0051, ba dòng `marketplace.payment_methods` của cổng `momo`.
- Tài liệu `17`: API_131 trả `paymentUrl` trang MoMo; API_132 đường dẫn chung cho cổng `momo` (IPN POST JSON, trả 204; thẻ quốc tế trả 200 JSON có chữ ký); lỗi `paymentAmountOutOfRange`, `paymentEmailRequired`, `paymentGatewayStartFailed`.
- Tài liệu `21`: KICHBAN_KIEMTHU_379, 380, 381 (mục 9).
- Tài liệu `22`: biến môi trường bí mật `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`; điểm tiếp nhận `/public/payments/momo/notify`, `/public/payments/momo/return` xác thực bằng HMAC SHA256 so sánh an toàn thời gian, giới hạn sai chữ ký theo địa chỉ IP; gửi MoMo tên, số điện thoại, email người mua chỉ khi thanh toán thẻ quốc tế; không lưu `callbackToken`.
- Tài liệu `25`: kết quả kiểm thử mục 12.
- Tài liệu `27`: CHUC_NANG_147 → QUYTAC_NGHIEPVU_225 đến 227 → TIEUCHI_NGHIEMTHU_234 đến 236 → KICHBAN_KIEMTHU_379 đến 381 → `apps/api/src/marketplace/payments/gateways/momo-gateway.ts`, `apps/api/test/c33-payment-momo.test.ts`.

Mã dành riêng chưa dùng: QUYTAC_NGHIEPVU_228, 229; TIEUCHI_NGHIEMTHU_237; KICHBAN_KIEMTHU_382.

## 12. Kết quả thực hiện

Tệp chính: `database/migrations/0051_payment_momo.sql`; `apps/api/src/marketplace/payments/gateways/momo-gateway.ts`, `payment-gateway-registry.ts`, `payment-gateway.ts`, `payments.service.ts`, `gateways/vnpay-gateway.ts`; `packages/contracts/src/index.ts`; `packages/i18n/src/vi.json`, `en.json`; `.env.example`.

| Kịch bản | Tệp | Kết quả |
|---|---|---|
| KICHBAN_KIEMTHU_379, 380, 381 | `apps/api/test/c33-payment-momo.test.ts` | KET_QUA_C33 |
| Kiểm thử hồi quy | `pnpm --filter api test` | KET_QUA_HOI_QUY |

Kiểm tra kiểu (`pnpm typecheck`), kiểm tra mã (`pnpm lint`): đạt.

Giới hạn đã biết: chưa thử với tài khoản môi trường thử nghiệm MoMo (người dùng chưa có); các điểm chưa xác minh ở mục 7.
