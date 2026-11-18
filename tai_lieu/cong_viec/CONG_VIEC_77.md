# CONG_VIEC_77: Gửi email thật qua SMTP của hộp thư doanh nghiệp (MODULE_01)

- Mô tả: Thay trình gửi chỉ ghi log (`LogOutboundMessages`) bằng trình gửi SMTP khi cấu hình `EMAIL_DRIVER=smtp`. Môi trường thật bắt buộc SMTP, không ghi token, đường dẫn kích hoạt, mật khẩu, nội dung thư vào log.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-18
- Trạng thái: Đang thực hiện (phiên con), chờ nghiệm thu.
- Mức: Vừa (đổi nhà cung cấp gửi email đã ghi trong tài liệu `12`, `13`; thêm thư viện; không đổi cấu trúc dữ liệu, API, giao diện, quyền).
- Nhánh: `chuc-nang/CONG_VIEC_77-email-smtp`.
- Phiếu thay đổi: THAY_DOI_41 (đổi nhà cung cấp gửi email từ Amazon SES sang SMTP hộp thư doanh nghiệp, người dùng chọn 2026-11-18).
- Nguồn: điểm chặn 1 của CONG_VIEC_76 (đặc tả mục 26.3); người dùng chọn SMTP hộp thư doanh nghiệp có sẵn, duyệt ngày 2026-11-18; phát hành trong 0.14.1.

## 1. Mục tiêu

Tạo nhân viên (thư kích hoạt), quên mật khẩu, thư mời phỏng vấn, đề nghị nhận việc, phiếu lương, ký số tới được hộp thư người nhận trên môi trường thật.

## 2. Phạm vi

- Trong: trình gửi SMTP (`nodemailer`), đọc và kiểm tra cấu hình, từ chối khởi động ở môi trường thật khi thiếu cấu hình, không ghi nội dung thư vào log, quên mật khẩu không lộ lỗi gửi.
- Ngoài: gửi SMS cho người dùng không có email (vẫn chưa có nhà cung cấp ở trình gửi này; trình gửi SMTP chỉ ghi cảnh báo không kèm nội dung); mẫu thư HTML; hàng đợi gửi lại.

## 3. Thiết kế

| Thành phần | Nội dung |
|---|---|
| `apps/api/src/common/outbound-messages.ts` | `readEmailConfig` đọc `EMAIL_DRIVER` (`log`, `smtp`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (tên khớp CONG_VIEC_76 tài liệu `26` mục 1.3), `SMTP_SECURE` không bắt buộc; `smtpTransport`; `SmtpOutboundMessages`; `createOutboundMessages` |
| `apps/api/src/app.module.ts` | `OUTBOUND_MESSAGES` dùng `createOutboundMessages` thay `LogOutboundMessages` |
| `apps/api/src/auth/password.service.ts` | Quên mật khẩu bắt lỗi gửi, ghi log không có đường dẫn, vẫn trả `204` |

Quy tắc cấu hình:
1. `NODE_ENV=production`: chỉ nhận `EMAIL_DRIVER=smtp`; để trống hoặc `log` thì lỗi, API không khởi động.
2. Môi trường khác: để trống là `log`.
3. `smtp`: thiếu biến nào, `SMTP_PORT` ngoài 1 đến 65535, `SMTP_SECURE` đặt khác `true`/`false` thì lỗi nêu đủ tên biến, không in giá trị.
4. `SMTP_SECURE=true` (mặc định khi cổng 465): TLS ngay khi kết nối; `false` (mặc định cổng khác): bắt buộc STARTTLS, không gửi mật khẩu trên kết nối chưa mã hóa.
5. Tin kênh SMS qua trình gửi SMTP: không gửi, ghi cảnh báo kèm số điện thoại che và tiêu đề.
6. Lỗi gửi ném lại cho nơi gọi (giữ hành vi phiếu lương ghi lỗi), trừ quên mật khẩu.

## 4. Dùng lại mã đã có

Giao diện `OutboundMessages`, `OUTBOUND_MESSAGES` và mọi nơi gọi giữ nguyên; kiểm thử hiện có vẫn thay `OUTBOUND_MESSAGES` bằng bộ giữ thư (`test/setup-database.ts`).

## 5. Phân tích giải pháp có sẵn

Tài liệu `13` mục 15: `nodemailer` 10.3.1 (MIT-0, không phụ thuộc). Người dùng duyệt ngày 2026-11-18.

## 6. Tiêu chí nghiệm thu (TIEUCHI_NGHIEMTHU_602 đến 608 theo thứ tự, tài liệu `11`)

1. Cấu hình `EMAIL_DRIVER=smtp` đủ biến: thư kích hoạt, đặt lại mật khẩu tới máy chủ SMTP, có xác thực, đúng người gửi `SMTP_FROM`, giữ tệp đính kèm.
2. Môi trường thật thiếu cấu hình hoặc `EMAIL_DRIVER=log`: API từ chối khởi động, lỗi nêu tên biến, không in mật khẩu.
3. Ở chế độ SMTP, log không chứa nội dung thư, đường dẫn kích hoạt, địa chỉ nhận đầy đủ.
4. `SMTP_SECURE=false` và máy chủ không hỗ trợ STARTTLS: không gửi mật khẩu, không gửi thư.
5. Quên mật khẩu khi máy chủ thư lỗi: trả `204` như tài khoản không tồn tại.
6. Máy phát triển, kiểm thử không đặt biến: ghi log như trước; toàn bộ kiểm thử hiện có đạt.

## 7. Kịch bản kiểm thử

Kiểm thử tự động `apps/api/test/c77-email-smtp.test.ts` (máy chủ SMTP giả chạy cục bộ, không gọi máy chủ thư bên ngoài): đúng (gửi kèm tệp, chọn trình gửi), sai (thiếu biến, `EMAIL_DRIVER` sai, môi trường thật dùng `log`, máy chủ từ chối người nhận, không có STARTTLS), biên (cổng 0, 65535, 65536, giá trị `SMTP_SECURE` sai), bảo mật (log không chứa token, địa chỉ; lỗi không chứa mật khẩu; quên mật khẩu không lộ lỗi). Kịch bản KICHBAN_KIEMTHU_827 đến 833 (tài liệu `21`).

## 8. Việc người dùng làm trước khi triển khai

- Tạo hộp thư gửi (ví dụ `thongbao@<tên miền>`) và mật khẩu ứng dụng riêng của hộp thư; lấy máy chủ, cổng SMTP của nhà cung cấp hộp thư.
- Khai SPF, DKIM của nhà cung cấp hộp thư cho tên miền gửi để thư không vào thư rác.
- Đặt biến ở dịch vụ `api`: `EMAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (bí mật), `SMTP_FROM`; `SMTP_SECURE` chỉ khi khác mặc định theo cổng.
- Kiểm tra giới hạn số thư mỗi ngày của hộp thư (gửi phiếu lương hàng loạt).

## 9. Thành phần không được thay đổi

Nội dung thư, nơi gọi gửi thư, API, cấu trúc dữ liệu, giao diện.
