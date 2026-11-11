# CONG_VIEC_37: Cổng BIDV, thu hộ qua tài khoản định danh (MODULE_09)

- Mô tả: Kết nối BIDV vào khung nhiều cổng thanh toán (CONG_VIEC_32) theo sản phẩm "Thu hộ qua tài khoản định danh cho khách hàng doanh nghiệp": người mua chuyển khoản vào tài khoản định danh của lần thanh toán bằng mã VietQR, BIDV vấn tin rồi gạch nợ qua API của VComm.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Chờ nghiệm thu.
- Mức: Vừa.
- Nguồn: người dùng yêu cầu 2026-11-11 (CONG_VIEC_32); tài liệu BIDV người dùng cung cấp 2026-11-11: "Tài liệu hướng dẫn đối tác xây dựng đặc tả kỹ thuật thu hộ qua tài khoản định danh cho KHDN, gen VietQR, đối soát" (V2 23.10.25), phiếu khảo sát kết nối Paygate v1.0.2, giấy đăng ký dịch vụ thu hộ qua Virtual Account (VA-01/BIDV-LUCKY). Quyết định của người dùng 2026-11-11: tự sinh VietQR, thêm cột mã cổng, thêm hai đường dẫn getbill/paybill, checksum theo tài liệu ghép liền.

## 1. Mục tiêu

Người mua trên sàn VComm trả tiền đơn bằng chuyển khoản tới tài khoản định danh BIDV; VComm biết ngay tiền đã về, đúng số tiền, đúng đơn, không cần kế toán ghép tay.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_151.

Ngoài phạm vi:
- Gọi Open API BIDV (tạo/sửa/hủy tài khoản định danh, API gen VietQR, API đối soát có mã hóa JWE, ký JWS): tài liệu BIDV chưa ghi đường dẫn, thuật toán; làm khi BIDV bổ sung.
- Đối soát cuối ngày với BIDV (tệp giao dịch): kế toán làm theo quy trình thủ công trong giấy đăng ký dịch vụ; sau này có thể làm qua API đối soát.
- Thanh toán thiếu, thừa, nhiều lần cho một đơn; hoàn tiền tự động qua BIDV (việc chờ hoàn tiền của khung CONG_VIEC_25 vẫn áp dụng).
- Tài liệu "Dịch vụ thanh toán qua mã QR cho ĐVCNTT" (APG v0.9.1) là dịch vụ của NAPAS, không thuộc công việc này.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_151 | Thanh toán đơn VComm qua tài khoản định danh BIDV: hướng dẫn chuyển khoản kèm VietQR; BIDV vấn tin số tiền, gạch nợ; ghi nhận một lần | YCAU_NGHIEPVU của CONG_VIEC_32 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_245: Mỗi lần thanh toán BIDV có mã 12 chữ số ngẫu nhiên, duy nhất trong cổng (lưu `gateway_reference`); số tài khoản định danh = mã đầu BIDV cấp (tối đa 7 ký tự chữ, số) + mã này (tổng tối đa 19 ký tự theo giấy đăng ký dịch vụ; mã khách hàng tối đa 13 ký tự theo tài liệu BIDV). Hướng dẫn chuyển khoản gồm ngân hàng BIDV, số tài khoản định danh, tên chủ tài khoản (biến môi trường), số tiền, nội dung `VCOMM <số đơn>`, chuỗi VietQR (EMVCo NAPAS: BIN 970418, dịch vụ QRIBFTTA, QR động có số tiền, CRC-16/CCITT-FALSE) do VComm tự sinh.
- QUYTAC_NGHIEPVU_246: Vấn tin (`POST /api/v1/public/payments/bidv/getbill`): checksum = Base64(SHA256(mã bí mật + serviceId + customerId)); serviceId gửi lên phải trùng cấu hình. Mã khách hàng nhận được có hoặc không kèm mã đầu. Chỉ trả số tiền khi lần thanh toán đang chờ, đơn đang chờ thanh toán, còn hạn; trả `type` = 1 (chỉ gạch nợ đúng số tiền), một hóa đơn duy nhất, tên người nhận hàng bỏ dấu. Không ghi nhận tiền.
- QUYTAC_NGHIEPVU_247: Gạch nợ (`POST /api/v1/public/payments/bidv/paybill`): checksum = Base64(SHA256(mã bí mật + transId + amount)); BIDV chỉ gọi khi đã hạch toán thành công nên đúng checksum là thanh toán thành công. Đúng số tiền thì ghi nhận theo QUYTAC_NGHIEPVU_166 (một lần, việc chờ hoàn khi đơn đã hủy hoặc đã thu); mã giao dịch BIDV (transId) lưu làm mã giao dịch cổng.
- QUYTAC_NGHIEPVU_248: Trả lời BIDV luôn HTTP 200 với `result_code` theo bảng mã của BIDV: 000 thành công, 004 sai checksum (cả địa chỉ IP không được phép, sai mã dịch vụ), 011 mã không tồn tại, 012 không có hóa đơn (đã thu, đã hủy, quá hạn), 022 sai số tiền, 023 đã gạch nợ, 031 lỗi hệ thống (thiếu cấu hình, cơ sở dữ liệu lỗi). Sai checksum đếm theo IP như QUYTAC_NGHIEPVU_221. Mọi lời gọi ghi `marketplace.payment_notifications` (vấn tin có tiền tố `inquiry_`).
- QUYTAC_NGHIEPVU_249: Thông tin kết nối chỉ ở biến môi trường: `BIDV_SERVICE_ID`, `BIDV_VA_PREFIX`, `BIDV_ACCOUNT_NAME`, `BIDV_CHECKSUM_SECRET` (bắt buộc), `BIDV_ALLOWED_IPS` (không bắt buộc, danh sách IP của BIDV). Thiếu biến bắt buộc hoặc mã đầu sai định dạng thì phương thức không bật được, không mở thanh toán. Đường dẫn gốc đăng ký với BIDV: `<địa chỉ công khai API>/api/v1/public/payments/bidv`.

## 5. Dữ liệu, API

- Database migration `0055_payment_bidv.sql`: thêm cột `marketplace.payments.gateway_reference` (chữ, số, tối đa 30 ký tự; chỉ mục duy nhất theo cổng khi có giá trị); phương thức `bidv_va_qr` (cổng `bidv`, sort_order 50, tắt).
- Khung: `PaymentGatewayAdapter` thêm hàm tùy chọn `gatewayReference()`, `inquire()`, `inquiryReply()`; `PaymentStartInput.gatewayReference`; `GatewayRequest.ip`. Kết quả cổng gửi về tìm lần thanh toán theo mã cổng nếu có, không thì theo số tham chiếu chung. `MarketplacePaymentsService.inquire()`.
- API_132 thêm `POST /public/payments/bidv/getbill`, `POST /public/payments/bidv/paybill` (BIDV gọi theo đường dẫn gốc + tên hàm; không dùng `/notify` chung). Không cấp mã API mới (theo hướng dẫn CONG_VIEC_32).
- Mã phương thức `bidv_va_qr`, mã cổng `bidv` thêm vào `packages/contracts`; tên trong `packages/i18n` nhóm `paymentMethods`.

## 6. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_250 | Mở thanh toán BIDV trả số tài khoản định danh (mã đầu + 12 chữ số) và chuỗi VietQR đúng chuẩn, lưu mã cổng | Bắt buộc | KICHBAN_KIEMTHU_395 |
| TIEUCHI_NGHIEMTHU_251 | Vấn tin đúng checksum trả số tiền, `type` 1; sai checksum, sai mã dịch vụ, IP lạ, mã không tồn tại bị từ chối đúng mã | Bắt buộc | KICHBAN_KIEMTHU_396 |
| TIEUCHI_NGHIEMTHU_252 | Gạch nợ sai checksum, sai số tiền bị từ chối; đúng thì ghi nhận một lần, đơn Chờ giao; gửi lại trả 023; vấn tin sau đó trả 012 | Bắt buộc | KICHBAN_KIEMTHU_397 |
| TIEUCHI_NGHIEMTHU_253 | Đơn quá hạn không vấn tin được; thiếu cấu hình thì không có phương thức, BIDV nhận 031 | Bắt buộc | KICHBAN_KIEMTHU_398 |

## 7. Điểm chưa xác minh (thử với BIDV môi trường UAT trước khi phát hành)

- Công thức checksum: tài liệu ghi `{secret_code}+{service_id}+{customer_id}` và `{secret_code}+|{trans_id}+{ amount}`; đã hiểu "+" là ghép liền, bỏ ký tự "|" (người dùng chọn). Cần BIDV xác nhận; nếu khác chỉ sửa `bidvChecksum` trong lớp kết nối.
- Chuyển khoản liên ngân hàng bằng VietQR tự sinh tới số tài khoản định danh BIDV: thử một giao dịch thật số tiền nhỏ từ ứng dụng ngân hàng khác và từ BIDV SmartBanking.
- `amount` BIDV gửi dạng chuỗi hay số: lớp kết nối nhận cả hai, checksum tính trên chuỗi số nguyên.
- BIDV có gửi `serviceId` trong vấn tin không: không gửi thì dùng mã cấu hình.
- Địa chỉ IP của BIDV để điền `BIDV_ALLOWED_IPS`; khi API đứng sau proxy cần cấu hình Express `trust proxy` để lấy đúng IP.
- Mã 12 chữ số trùng (xác suất rất nhỏ) làm lần mở thanh toán lỗi, người mua mở lại.

## 8. Dòng cần thêm vào tài liệu chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_245 đến 249 (mục 4).
- `10`: CHUC_NANG_151 thuộc MODULE_09.
- `11`: API_132 thêm hai đường dẫn `/public/payments/bidv/getbill`, `/paybill`.
- `13`: không thêm thư viện (dùng `node:crypto`).
- `16`: cột `marketplace.payments.gateway_reference`; phương thức `bidv_va_qr`.
- `17`: lớp kết nối `gateways/bidv-gateway.ts`; hàm tùy chọn mới của `PaymentGatewayAdapter`.
- `21`: KICHBAN_KIEMTHU_395 đến 398 (`apps/api/test/c37-payment-bidv.test.ts`).
- `22`: TIEUCHI_NGHIEMTHU_250 đến 253.
- `25`: CONG_VIEC_37 dùng các mã trên.
- `27`: biến môi trường BIDV (mục 4, QUYTAC_NGHIEPVU_249); đăng ký đường dẫn gốc với BIDV; điền IP BIDV.

## 9. Kết quả kiểm thử

- `apps/api/test/c37-payment-bidv.test.ts`: 4/4 đạt (giả lập BIDV gọi getbill, paybill ký checksum).
- Hồi quy toàn bộ `pnpm --filter api test` (2026-11-11, trước khi hợp nhất MoMo): 47 tệp, 337 kiểm thử đạt.
- Sau khi hợp nhất nhánh nền có CONG_VIEC_33 (MoMo): giữ bản sửa `c25-payment-methods.test.ts` của nhánh nền (chỉ so phương thức cổng cod, vnpay); `gatewayReference` của `PaymentStartInput` chuyển thành tùy chọn; BIDV trả 031 cho kết quả `pending` (không phát sinh). Đạt: c25-* (5 tệp), c32, c33, c37.
