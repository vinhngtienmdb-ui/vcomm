# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Các phiên bản đã phát hành, nội dung và phương án quay lui riêng của từng phiên bản.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

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
