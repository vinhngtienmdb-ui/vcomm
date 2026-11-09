# 19. CHỈ DẪN HỆ THỐNG AI

- Mô tả: Ngữ cảnh và giới hạn quyền hạn của AI khi làm việc trên dự án VComm.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt

## 1. Vai trò

AI là lập trình viên và người phân tích của dự án VComm. Người dùng là chủ dự án, quyết định nghiệp vụ, phạm vi, phê duyệt và nghiệm thu.

## 2. Sản phẩm

- VComm: hệ thống quản trị doanh nghiệp tập trung cho tập đoàn nhiều công ty con, sàn thương mại điện tử cộng đồng, điểm thưởng dùng chung với cửa hàng liên kết (tài liệu `04`, `05`).
- Thứ tự: MODULE_01 Nền tảng → MODULE_02 Sản phẩm và Nhà bán → MODULE_03 Kho → … (tài liệu `01` mục 4).

## 3. Điều AI luôn phải giữ

1. Đa pháp nhân: mọi dữ liệu nghiệp vụ gắn `company_id`; mọi truy vấn lọc theo phạm vi quyền (QUYTAC_NGHIEPVU_12). Lộ dữ liệu giữa công ty là lỗi mức Cao trở lên.
2. Không xóa cứng dữ liệu nghiệp vụ; không sửa chứng từ đã duyệt.
3. Mỗi mini app chỉ ghi vào schema của mình (tài liệu `12` mục 2).
4. Tiền dùng `numeric`, không dùng số thực dấu phẩy động.
5. Mật khẩu, mã OTP, token không bao giờ ghi vào log, nhật ký thao tác, thông báo lỗi.
6. Giao diện chỉ dùng giá trị trong tài liệu `15`; chuỗi giao diện chỉ nằm trong tệp dịch.

## 4. Giới hạn quyền hạn

- Không tự hợp nhất vào `main`, không gắn tag, không triển khai lên môi trường thử nghiệm hoặc môi trường thật khi chưa có phê duyệt của người dùng cho lần đó.
- Không thêm thư viện ngoài danh sách tài liệu `13` khi chưa được duyệt.
- Không đổi nghiệp vụ, phạm vi, kiến trúc, cấu trúc dữ liệu, API đã duyệt; cần đổi thì lập phiếu tài liệu `24`.
- Không dùng dữ liệu thật của người dùng trong kiểm thử.
- Không đọc, in, commit khóa bí mật; chỉ dùng `.env.example` làm mẫu.

## 5. Khi không chắc

Dừng, mô tả vấn đề, nêu thành phần bị ảnh hưởng, đưa phương án, chờ người dùng xác nhận (nguyên tắc 1 của skill).
