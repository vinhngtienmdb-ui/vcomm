# CONG_VIEC_32: Khung nhiều cổng thanh toán (MODULE_09)

- Mô tả: Mở rộng khung cổng thanh toán của CONG_VIEC_25 để thêm cổng mới không sửa chồng: danh mục phương thức là nguồn duy nhất, lớp kết nối cổng chung, đường dẫn nhận kết quả chung, hướng dẫn chuyển khoản (VietQR) trên ứng dụng.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đang thực hiện (chuẩn bị cho CONG_VIEC_33 đến 39 do phiên con làm).
- Nguồn: người dùng yêu cầu 2026-11-11 tích hợp MoMo, SePay, PayOS, chuyển khoản, VietQR, BIDV, Ecopay, GPay; CONG_VIEC_25.

## Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_220: Mỗi cổng có mã cổng, lớp kết nối riêng (`apps/api/src/marketplace/payments/gateways/<mã>-gateway.ts`) cài đặt `PaymentGatewayAdapter`: kiểm tra thông tin kết nối (biến môi trường), mở thanh toán (chuyển trang hoặc hướng dẫn chuyển khoản kèm mã QR), kiểm chữ ký kết quả gửi về, câu trả lời cho cổng. Phương thức thuộc cổng thêm vào danh mục `marketplace.payment_methods` bằng database migration của cổng.
- QUYTAC_NGHIEPVU_221: Kết quả mọi cổng nhận qua `/api/v1/public/payments/{cổng}/notify` (mọi phương thức HTTP); trang trả về `/api/v1/public/payments/{cổng}/return`. Sai chữ ký thì đếm theo địa chỉ IP, ghi lại không kèm số tham chiếu; đúng chữ ký thì xử lý như QUYTAC_NGHIEPVU_166 (số tiền, một lần, việc chờ hoàn).
- QUYTAC_NGHIEPVU_222: Cổng chuyển khoản trả hướng dẫn: ngân hàng, số tài khoản, tên, số tiền, nội dung (số tham chiếu), chuỗi mã QR chuẩn VietQR hoặc ảnh mã QR; ứng dụng hiện để người mua chuyển.

## Dữ liệu, API

- Database migration 0050: bỏ ràng buộc mã cố định; mã phương thức, mã cổng theo định dạng; đơn, lần thanh toán tham chiếu danh mục phương thức.
- API_131 trả `paymentUrl` hoặc `transfer`; API_132 thêm đường dẫn chung (giữ `/public/payments/vnpay/ipn` đã đăng ký với VNPAY).

## Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_231 | Phương thức của cổng mới hiện cho người mua, đặt được | Bắt buộc | KICHBAN_KIEMTHU_376 |
| TIEUCHI_NGHIEMTHU_232 | Mở thanh toán trả hướng dẫn chuyển khoản; ứng dụng hiện thông tin chuyển khoản | Bắt buộc | KICHBAN_KIEMTHU_377 |
| TIEUCHI_NGHIEMTHU_233 | Đường dẫn chung xác thực, ghi nhận một lần, cổng không có trả 404; VNPAY chạy như cũ | Bắt buộc | KICHBAN_KIEMTHU_378 |

Kiểm thử: `apps/api/test/c32-payment-gateway-framework.test.ts` (cổng giả lập), hồi quy `c25-*`.
