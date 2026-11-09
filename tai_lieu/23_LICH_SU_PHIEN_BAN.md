# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Các phiên bản đã phát hành, nội dung và phương án quay lui riêng của từng phiên bản.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

## Phiên bản 0.2.0 – 2026-11-09 – Đã phát hành

- Chức năng mới (CONG_VIEC_03, hoàn thiện MODULE_01):
  - Cài đặt tích hợp (MAN_HINH_19): nhập mã ứng dụng Google, Microsoft, Zalo và khóa eSMS.vn trên giao diện, khóa bí mật mã hóa, kiểm tra kết nối, gửi thử tin, nhật ký gửi tin;
  - đăng nhập bằng số điện thoại (mã OTP qua Zalo ZNS, không được thì SMS), Google, Microsoft, Zalo; liên kết, hủy liên kết ở hồ sơ; kích hoạt tài khoản bằng Google, Microsoft;
  - Zalo ZNS cho chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt;
  - mẫu đề xuất do quản trị công ty tạo, 3 mẫu có sẵn (phiếu đề nghị chi, đề nghị tạm ứng, đề nghị mua sắm) (MAN_HINH_20);
  - đề xuất theo mẫu, gửi duyệt qua luồng duyệt có sẵn, tệp đính kèm (tối đa 10 tệp, 10 MB), in PDF (MAN_HINH_21); người duyệt xem nội dung đề xuất ở MAN_HINH_08.
- Lỗi đã sửa: không có lỗi đã cấp mã.
- Thay đổi dữ liệu: database migration `database/migrations/0002_cong_viec_03.sql` thêm 6 bảng (`integration_settings`, `otp_codes`, `message_deliveries`, `proposal_templates`, `proposals`, `attachments`), không sửa bảng cũ. Khi khởi động, API đồng bộ thêm 3 quyền (`platform.integration.manage`, `platform.proposal_template.manage`, `platform.proposal.create`) vào vai trò có sẵn.
- Thay đổi API: thêm API_02 đến API_05, API_49 đến API_54 (tài liệu `17`); API cũ giữ nguyên.
- Thư viện mới: pdfmake 0.3.12 (MIT), @aws-sdk/client-s3 3.1156.0 (Apache-2.0).
- Biến môi trường mới: `STORAGE_DRIVER` (`local` hoặc `s3`), `STORAGE_DIRECTORY`, `S3_BUCKET`, `AWS_REGION`. Bỏ `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, `ZALO_APP_*`, `SMS_DRIVER` (chuyển sang Cài đặt tích hợp).
- Rủi ro:
  - Chưa thử với eSMS, Google, Microsoft, Zalo, S3 thật; chỉ thử trên bản giả lập. Phải nhập khóa và thử trên môi trường thử nghiệm trước môi trường thật.
  - Khóa trong Cài đặt tích hợp mã hóa bằng `MFA_SECRET_KEY`; đổi khóa này thì phải nhập lại mọi khóa tích hợp và đăng ký lại xác thực hai lớp.
  - Môi trường thật phải đặt `STORAGE_DRIVER=s3`; để `local` thì tệp đính kèm mất khi thay máy chủ.
  - Chưa có tác vụ dọn bảng `otp_codes`, `message_deliveries`.
  - LOI_01 còn mở.
- Khả năng tương thích: tương thích ngược với 0.1.0; dữ liệu, API cũ không đổi.
- Công việc gộp trong phiên bản: CONG_VIEC_03.
- Tag: `v0.2.0` trên commit hợp nhất nhánh `phat-hanh/v0.2.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.1.0`.
  - Database migration `0002_cong_viec_03.sql`: bản 0.1.0 không đọc các bảng mới nên có thể giữ nguyên khi quay lui mã. Chỉ xóa khi cần: sao lưu, rồi `DROP TABLE core.attachments, core.proposals, core.proposal_templates, core.message_deliveries, core.otp_codes, core.integration_settings;` và xóa dòng `0002_cong_viec_03.sql` khỏi `public.schema_migrations`.
  - Dữ liệu cần sao lưu thêm: thư mục hoặc bucket lưu tệp đính kèm; các dòng loại chứng từ `platform.proposal_*` và dãy số, chính sách duyệt của chúng do mẫu đề xuất tạo ra (giữ lại không ảnh hưởng 0.1.0).

## Phiên bản 0.1.0 – 2026-11-09 – Đã phát hành

- Chức năng mới: mini app Nền tảng (MODULE_01) trừ phần đăng nhập Google, Microsoft, Zalo, số điện thoại:
  - đăng nhập mật khẩu, phiên, xác thực hai lớp TOTP và mã dự phòng, quên và đặt lại mật khẩu, hồ sơ cá nhân;
  - công ty, chi nhánh, phòng ban; mời, kích hoạt, nhập Excel, khóa, vô hiệu hóa kèm bàn giao nhân viên;
  - vai trò, ma trận quyền, gán vai trò theo tập đoàn, công ty, chi nhánh;
  - chính sách duyệt theo hạn mức, hộp duyệt, nhắc và chuyển duyệt quá hạn;
  - dãy số chứng từ, tiền tệ và tỷ giá (lấy tự động từ Vietcombank lúc 8:30 sáng), nhật ký thao tác, thông báo trong ứng dụng;
  - giao diện tiếng Việt, tiếng Anh (MAN_HINH_01 đến 18).
- Lỗi đã sửa: LOI_02 (giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập).
- Thay đổi dữ liệu: database migration `database/migrations/0001_core.sql` tạo schema `core` (29 bảng, partition nhật ký thao tác tháng 11, 12/2026) và dữ liệu khởi tạo (tiền tệ, mini app). API tự tạo trước partition nhật ký 3 tháng khi khởi động và mỗi ngày.
- Thay đổi API: API_01, API_06 đến API_48 dưới `/api/v1` (tài liệu `17`). API_02 đến API_05 chưa có.
- Rủi ro:
  - LOI_01 còn mở: đăng nhập dưới tải 200 người dùng đồng thời chưa đạt mốc 200 ms trên máy phát triển; cần đo lại trên môi trường thử nghiệm.
  - Cần Redis cho tác vụ nền và giới hạn số yêu cầu; không có Redis thì tác vụ nền không chạy, giới hạn đếm riêng từng tiến trình.
  - Máy chủ API cần gọi ra `portal.vietcombank.com.vn`; không gọi được thì quản lý tỷ giá nhận thông báo và nhập tay.
  - Khóa `MFA_SECRET_KEY`, `ACCESS_TOKEN_SECRET` của môi trường thật phải tạo mới, khác máy phát triển.
- Khả năng tương thích: phiên bản đầu tiên, không có phiên bản trước.
- Công việc gộp trong phiên bản: CONG_VIEC_01, CONG_VIEC_02, LOI_02.
- Tag: `v0.1.0` trên commit hợp nhất nhánh `phat-hanh/v0.1.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: phiên bản đầu tiên nên quay lui là gỡ bản triển khai (dừng API, web), không có phiên bản cũ để chạy lại.
  - Database migration `0001_core.sql`: sao lưu toàn bộ cơ sở dữ liệu ngay trước khi chạy; quay lui bằng `DROP SCHEMA core CASCADE` và xóa dòng `0001_core.sql` khỏi `public.schema_migrations`, chỉ làm khi chưa có dữ liệu thật hoặc đã sao lưu và người dùng đồng ý.
  - Dữ liệu cần sao lưu thêm: không có.
