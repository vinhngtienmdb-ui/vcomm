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

## Hướng dẫn chung cho phiên con CONG_VIEC_33 đến 39

### Bắt buộc trước khi làm
- Đọc `CLAUDE.md`, `.claude/skills/vibecoding-flow/SKILL.md`, `tai_lieu/index.md`, tài liệu `01`, `03`, `18`, `19`, đặc tả `tai_lieu/cong_viec/CONG_VIEC_25.md` (thanh toán đơn người mua) và `tai_lieu/cong_viec/CONG_VIEC_32.md` (khung nhiều cổng).
- Đọc mã khung: `apps/api/src/marketplace/payments/payment-gateway.ts` (giao diện `PaymentGatewayAdapter`), `payment-gateway-registry.ts`, `gateways/vnpay-gateway.ts` + `vnpay.ts` (mẫu), `payments.service.ts`, `payments.controller.ts`; kiểm thử `apps/api/test/c25-vnpay-payments.test.ts`, `apps/api/test/c32-payment-gateway-framework.test.ts` (cổng chuyển khoản giả lập), `apps/api/test/marketplace-fixture.ts`.

### Nhánh
- Tách nhánh `chuc-nang/CONG_VIEC_<số>-cong-<tên> (theo tài liệu 03)` từ `origin/chuc-nang/CONG_VIEC_32-khung-nhieu-cong-thanh-toan`. Pull request dạng nháp, base là `chuc-nang/CONG_VIEC_32-khung-nhieu-cong-thanh-toan`. Người dùng tự hợp nhất.

### Phạm vi
- Lớp kết nối `apps/api/src/marketplace/payments/gateways/<tên tệp>-gateway.ts` cài đặt `PaymentGatewayAdapter`: `configured()` theo biến môi trường (thêm vào `.env.example`, không commit giá trị thật), `start()` (trang cổng hoặc hướng dẫn chuyển khoản kèm chuỗi mã QR chuẩn VietQR/ảnh QR), `verify()` kiểm chữ ký hoặc khóa xác thực đúng theo tài liệu của cổng, so sánh an toàn thời gian (`timingSafeEqual`), `reply()` đúng định dạng cổng yêu cầu, `verifyReturn()` nếu cổng có trang trả về.
- Kết quả cổng gửi về qua đường dẫn chung `/api/v1/public/payments/<mã cổng>/notify`; trang trả về `/api/v1/public/payments/<mã cổng>/return`. Không thêm controller mới trừ khi cổng bắt buộc.
- Số tiền, số tham chiếu (`reference`) phải khớp lần thanh toán; mỗi lần thanh toán ghi nhận một lần (khung đã xử lý).
- Kiểm thử tự động `apps/api/test/c<số>-payment-<tên tệp>.test.ts` dùng máy chủ giả lập theo đặc tả công khai của cổng (ký đúng, sai chữ ký, sai số tiền, nhận trùng, thất bại). Không gọi máy chủ thật.
- Tìm tài liệu API công khai (WebSearch, WebFetch). Trang bị chặn truy cập tự động thì không tìm cách vượt chặn; ghi rõ chỗ chưa xác minh trong đặc tả và nhắc người dùng thử với tài khoản môi trường thử nghiệm trước khi phát hành. Nếu cổng không có tài liệu công khai (cần hợp đồng, tài liệu riêng), dừng, mô tả cho người dùng, đưa phương án và chờ quyết định; không đoán định dạng ký.

### Tránh xung đột với các phiên song song (CONG_VIEC_33 đến 39) và phiên chính
- Database migration duy nhất: `database/migrations/<số database migration>_payment_<tên tệp>.sql`: chỉ `INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES (...) ON CONFLICT (code) DO NOTHING;` các phương thức của cổng (mã bắt đầu bằng `<mã cổng>_`, ví dụ `<mã cổng>_wallet`; sort_order từ <đầu dải> đến <cuối dải>; is_enabled false).
- `packages/contracts/src/index.ts`: chỉ thêm mã của mình trên dòng riêng vào cuối mảng `paymentMethodCodes` và `paymentGatewayCodes` (không sắp xếp lại, không chạy prettier trên tệp này).
- `payment-gateway-registry.ts`: chỉ thêm một dòng `new ...Gateway(),` vào cuối mảng `paymentGateways` và một dòng import (không chạy prettier trên tệp này).
- `packages/i18n/src/vi.json`, `en.json`: thêm tên phương thức vào nhóm `paymentMethods` (`<mã phương thức>`, `gateway_<mã cổng>`).
- Mã định danh dành riêng (không dùng mã ngoài dải): theo dòng của công việc trong tài liệu 03. Không cấp mã MAN_HINH, API mới.
- Không sửa sổ dùng chung (tài liệu `02`, `03`, `24`, `25`) và không sửa các tài liệu đánh số `06` đến `27`; chỉ viết đặc tả `tai_lieu/cong_viec/CONG_VIEC_<số>.md` theo mẫu, ghi trong đặc tả các dòng cần thêm vào tài liệu `07`, `10`, `11`, `13`, `16`, `17`, `21`, `22`, `25`, `27` (phiên chính cập nhật khi hợp nhất). Không sửa mã CONG_VIEC_26 (hoa hồng).

### Quy tắc dự án (tóm tắt, chi tiết trong tài liệu 18, 19)
- Không viết tắt trong mã, tên biến tiếng Anh đầy đủ. Không thêm thư viện mới khi `fetch`, `node:crypto` làm được.
- Commit: `<loại>(CONG_VIEC_<số>): mô tả` + các dòng Lý do, Thay đổi, Kiểm thử. Trước mỗi commit: `git checkout apps/web-platform/next-env.d.ts; rm -f apps/*/AGENTS.md dump.rdb`. Prettier `--print-width 200` chỉ trên tệp đã sửa (trừ các tệp nêu trên).
- Khóa giả trong kiểm thử: đặt tên biến không có chữ secret/key/token, hoặc ghép chuỗi lúc chạy, để công cụ quét bí mật (gitleaks trong CI) không báo nhầm.
- Không commit khóa bí mật, `.env`; không force push.
- Môi trường: `(service postgresql start; service redis-server start); redis-cli config set save ""`; database migration: `set -a; . ./.env; set +a; pnpm --filter api build && pnpm --filter api db:migrate`. Kiểm thử: chạy một vitest mỗi lần; chạy toàn bộ `pnpm --filter api test` (kiểm thử hồi quy) trước khi trình.
- Thiết kế: trình người dùng thiết kế ngắn (phương thức, biến môi trường, cách xác thực kết quả, điểm chưa xác minh) và chờ xác nhận trước khi viết mã; câu hỏi nghiệp vụ hỏi người dùng trong phiên này.
- Xong: tự rà soát mã, quét khóa bí mật trên commit, ghi kết quả kiểm thử trong đặc tả, đẩy nhánh, mở pull request nháp, theo dõi CI tới khi xanh, trình người dùng nghiệm thu.
