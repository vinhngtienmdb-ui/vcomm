# CONG_VIEC_34: Cổng thanh toán SePay (MODULE_09)

- Mô tả: Kết nối SePay vào khung nhiều cổng thanh toán (CONG_VIEC_32). Người mua chuyển khoản vào tài khoản ngân hàng của VComm theo hướng dẫn kèm mã VietQR. SePay gửi webhook biến động số dư; hệ thống đối chiếu số tham chiếu trong nội dung chuyển khoản và số tiền.
- Mức: Vừa.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11. Đã lập trình; kiểm thử hồi quy còn một kiểm thử c25 chờ quyết định.
- Nguồn: người dùng yêu cầu 2026-11-11 tích hợp MoMo, SePay, PayOS, chuyển khoản, VietQR, BIDV, Ecopay, GPay; CONG_VIEC_32; CONG_VIEC_18 (đọc webhook SePay).

## 1. Mục tiêu

Người mua trả tiền đơn VComm bằng chuyển khoản ngân hàng, được ghi nhận tự động không cần kế toán đối chiếu tay.

## 2. Phạm vi

- Trong phạm vi: phương thức `sepay_bank_transfer` (cổng `sepay`); hướng dẫn chuyển khoản kèm ảnh mã QR VietQR của SePay; nhận webhook qua đường dẫn chung `/api/v1/public/payments/sepay/notify`; kiểm thử tự động.
- Ngoài phạm vi: chuỗi mã QR VietQR (EMVCo) tự tạo (`qrData` để trống); tài khoản ảo theo đơn của SePay; cổng thanh toán (trang thanh toán) của SePay; ký HMAC-SHA256 (cần giữ nội dung thô của yêu cầu, phải sửa khung); tự lập việc chờ hoàn khi chuyển sai số tiền hoặc chuyển hai lần cùng số tham chiếu (sửa khung CONG_VIEC_32).

## 3. Quyết định của người dùng (2026-11-11)

1. Chuyển sai số tiền: giữ như khung, không ghi nhận; lưu lại trong `marketplace.payment_notifications`, kế toán xử lý tay qua đối chiếu ngân hàng (CONG_VIEC_18).
2. Chuyển hai lần cùng số tham chiếu: lần sau không ghi nhận, xử lý tay như mục 1.
3. Tiền tố nội dung (ví dụ `SEVQR` cho một số ngân hàng): chưa thêm, xem lại sau khi thử tài khoản thật.
4. Thời hạn thanh toán: giữ 15 phút như các cổng khác; tiền về sau khi đơn tự hủy thì khung lập việc chờ hoàn (`paid_after_cancel`).

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_230: Cổng SePay chỉ được coi là đã cấu hình khi đủ năm biến môi trường `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`. Mở thanh toán trả hướng dẫn: ngân hàng, số tài khoản, tên chủ tài khoản, số tiền, nội dung là số tham chiếu của lần thanh toán, ảnh mã QR `https://qr.sepay.vn/img?acc=&bank=&amount=&des=`.
- QUYTAC_NGHIEPVU_231: Số tham chiếu lấy từ trường `code` của webhook (mã thanh toán SePay tách sẵn) nếu đúng dạng; nếu không thì tách nội dung chuyển khoản theo ký tự không phải chữ và số, lấy từ đầu tiên đúng dạng số tham chiếu (chữ và số, kết thúc bằng `T` và hai chữ số), không phân biệt chữ hoa, thường.
- QUYTAC_NGHIEPVU_232: Webhook chỉ được nhận khi tiêu đề `Authorization: Apikey <khóa>` đúng (so sánh an toàn thời gian), dữ liệu đúng định dạng SePay, số tài khoản (nếu có) trùng `SEPAY_ACCOUNT_NUMBER`; sai thì xử lý như sai chữ ký (QUYTAC_NGHIEPVU_221). Giao dịch tiền ra hoặc không có số tham chiếu: coi là không tìm thấy lần thanh toán.
- QUYTAC_NGHIEPVU_233: Trả SePay HTTP 200 `{"success": true}` khi ghi nhận, đã ghi nhận trước đó, không tìm thấy, sai số tiền; 401 khi sai khóa; 500 khi lỗi ghi nhận để SePay gửi lại.
- QUYTAC_NGHIEPVU_234: Chuyển sai số tiền hoặc chuyển thêm lần nữa cùng số tham chiếu không được ghi nhận tự động; kết quả lưu trong `marketplace.payment_notifications` để kế toán xử lý tay (quyết định 1, 2).

## 5. Chức năng

- CHUC_NANG_148: Thanh toán đơn VComm bằng chuyển khoản qua SePay (QUYTAC_NGHIEPVU_230 đến 234).

## 6. Dữ liệu và API

- Database migration `0052_payment_sepay.sql`: thêm phương thức `sepay_bank_transfer`, cổng `sepay`, sort_order 20, mặc định tắt.
- Không thêm bảng, API mới. API_131 trả `transfer`; API_132 đường dẫn chung `/public/payments/sepay/notify`. SePay không có trang trả về.
- Mã nguồn: `apps/api/src/marketplace/payments/gateways/sepay-gateway.ts`; dùng lại `parseWebhook`, `authorized`, `accountDigits` của `apps/api/src/bank/bank-webhook.ts`.
- Biến môi trường mới trong `.env.example`: `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`.

## 7. Điều kiện đặc biệt, điểm chưa xác minh

- Theo tài liệu công khai: https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook, https://developer.sepay.vn/en/sepay-webhooks/xac-thuc, https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code.
- Phải thử với tài khoản SePay trước khi phát hành: khai báo webhook kiểu chứng thực API Key, địa chỉ `<địa chỉ công khai API>/api/v1/public/payments/sepay/notify`; ngân hàng có giữ nguyên số tham chiếu trong nội dung không (một số ngân hàng như VietinBank tài khoản cá nhân yêu cầu tiền tố `SEVQR`); có thể cấu hình "Cấu trúc mã thanh toán" của SePay để trường `code` được tách sẵn.
- Nếu tài khoản ngân hàng này cũng kết nối đối chiếu ngân hàng (CONG_VIEC_18), khai báo hai webhook trên SePay; mỗi webhook dùng khóa riêng.
- Chưa giới hạn địa chỉ IP của SePay.

## 8. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_238 | Thiếu biến môi trường thì phương thức SePay chưa cấu hình, không bật được; đủ thì bật được, người mua thấy và đặt được | Bắt buộc | KICHBAN_KIEMTHU_383 |
| TIEUCHI_NGHIEMTHU_239 | Mở thanh toán trả hướng dẫn chuyển khoản đúng tài khoản, số tiền, nội dung là số tham chiếu, ảnh mã QR | Bắt buộc | KICHBAN_KIEMTHU_384 |
| TIEUCHI_NGHIEMTHU_240 | Webhook sai khóa, sai số tài khoản, sai định dạng bị từ chối (401); sai số tiền, tiền ra, không có số tham chiếu không ghi nhận, trả thành công; đúng thì ghi nhận một lần kể cả khi nội dung bị ngân hàng chèn thêm chữ | Bắt buộc | KICHBAN_KIEMTHU_385 |
| TIEUCHI_NGHIEMTHU_241 | Mã thanh toán SePay tách sẵn được ưu tiên; tiền về sau khi đơn quá hạn tự hủy thì lập việc chờ hoàn | Bắt buộc | KICHBAN_KIEMTHU_386 |

## 9. Kịch bản kiểm thử

KICHBAN_KIEMTHU_383 đến 386: tự động, tệp `apps/api/test/c34-payment-sepay.test.ts` (webhook giả lập theo định dạng công khai của SePay).

## 10. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- Tài liệu `07`: QUYTAC_NGHIEPVU_230 đến 234 (mục 4).
- Tài liệu `10`: CHUC_NANG_148 (mục 5).
- Tài liệu `11`: TIEUCHI_NGHIEMTHU_238 đến 241 (mục 8).
- Tài liệu `13`: không thêm thư viện; ảnh mã QR dùng dịch vụ `qr.sepay.vn`.
- Tài liệu `16`: dòng `sepay_bank_transfer` (cổng `sepay`, sort_order 20) trong `marketplace.payment_methods`, database migration 0052.
- Tài liệu `17`: API_132 thêm cổng `sepay`: tiêu đề `Authorization: Apikey <khóa>`, thân theo định dạng SePay, trả lời theo QUYTAC_NGHIEPVU_233.
- Tài liệu `21`: KICHBAN_KIEMTHU_383 đến 386 (mục 9).
- Tài liệu `22`: điểm tiếp nhận công khai `/public/payments/sepay/notify` xác thực bằng khóa API so sánh an toàn thời gian; khóa chỉ ở biến môi trường `SEPAY_WEBHOOK_API_KEY`; lần sai khóa đếm theo địa chỉ IP (khung).
- Tài liệu `25`: kết quả kiểm thử ở mục 11.
- Tài liệu `27`: CHUC_NANG_148 → TIEUCHI_NGHIEMTHU_238 đến 241 → KICHBAN_KIEMTHU_383 đến 386 → `sepay-gateway.ts`, `c34-payment-sepay.test.ts`.

## 11. Kết quả thực hiện

- 2026-11-11: `c34-payment-sepay.test.ts` 4/4 đạt (KICHBAN_KIEMTHU_383 đến 386). Kiểm tra kiểu, lint toàn dự án đạt.
- Kiểm thử hồi quy `pnpm --filter api test`: 336/337 đạt. Thất bại: `c25-payment-methods.test.ts` KICHBAN_KIEMTHU_321 so sánh đúng nguyên danh sách phương thức, nay có thêm `sepay_bank_transfer` (chưa cấu hình, tắt). Chờ người dùng quyết định cách sửa kiểm thử.
