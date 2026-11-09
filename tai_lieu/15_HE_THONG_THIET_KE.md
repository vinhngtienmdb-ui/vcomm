# 15. HỆ THỐNG THIẾT KẾ

- Mô tả: Quy tắc thiết kế giao diện thống nhất: màu, chữ, khoảng cách, bo góc, đổ bóng, điểm ngắt, thành phần dùng chung.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt 2026-11-09

Mã giao diện chỉ dùng các biến dưới đây (nguyên tắc tại mục 15 của skill). Cần giá trị mới thì đề xuất bổ sung tài liệu này trước.

## 1. Nhận diện thương hiệu

- Logo: chưa có logo chính thức; tạm dùng chữ "VComm" phông Nunito Sans, đậm 800.
- Phương án đã chọn: phương án C "Thân thiện" (xanh lục bảo, phông Nunito Sans, góc bo lớn) – người dùng chọn ngày 2026-11-09. So sánh ba phương án: trang "Phương án thương hiệu VComm".

## 2. Bảng màu

Tương phản tính theo công thức WCAG 2.1.

| Tên biến | Giá trị | Mục đích | Tương phản với nền |
|---|---|---|---|
| mau-chinh | #047857 | Nút chính, liên kết, mục đang chọn | Chữ trắng trên màu 5,48:1; trên mau-nen 5,21:1; trên mau-chinh-nhat 4,93:1 |
| mau-chinh-dam | #065F46 | Nút chính khi di chuột, khi nhấn | Chữ trắng 7,68:1 |
| mau-chinh-nhat | #E8F6F0 | Nền mục đang chọn trong menu, dòng đang chọn | Nền |
| mau-phu | #7C3AED | Điểm nhấn phụ: huy hiệu số việc chờ, biểu đồ | Chữ trắng 5,70:1 |
| mau-thanh-tren | #064E3B | Nền thanh trên cùng | Chữ trắng 9,72:1 |
| mau-nen | #F6FAF8 | Nền trang | Nền |
| mau-be-mat | #FFFFFF | Nền thẻ, bảng, ngăn kéo, hộp thoại | Nền |
| mau-vien | #E2E8F0 | Đường kẻ bảng, viền thẻ | Trang trí |
| mau-vien-o-nhap | #64748B | Viền ô nhập, ô chọn | 4,76:1 trên mau-be-mat (yêu cầu tối thiểu 3:1) |
| mau-chu | #0F172A | Chữ chính | 16,96:1 trên mau-nen |
| mau-chu-phu | #475569 | Chữ phụ, nhãn cột, chú thích | 7,20:1 trên mau-nen |
| mau-thanh-cong / mau-thanh-cong-nen | #14532D / #E9F7EE | Thông báo thành công | 8,24:1 |
| mau-canh-bao / mau-canh-bao-nen | #7A4A05 / #FDF6E3 | Cảnh báo, quá hạn sắp tới | 6,93:1 |
| mau-loi / mau-loi-nen | #B91C1C / #FDECEC | Lỗi, quá hạn, từ chối | 5,66:1 |
| mau-thong-tin / mau-thong-tin-nen | #1E40AF / #EEF3FF | Thông tin | 7,85:1 |
| mau-canh-bao-vien / mau-loi-vien / mau-thong-tin-vien | #F1D38A / #F5B5B5 / #BFD0FA | Viền KhoiCanhBao (bổ sung khi dựng bản mẫu, đã duyệt 2026-11-09) | Trang trí |

Quy tắc phân biệt: mau-chinh và màu thành công đều là xanh lục. Thông báo thành công luôn có biểu tượng dấu tích và viền; nút chính không bao giờ dùng màu thành công.

## 3. Kiểu chữ

- Phông chữ: Nunito Sans (Google Fonts, giấy phép SIL Open Font License); dự phòng `system-ui, "Segoe UI", Roboto, Arial, sans-serif`. Đã kiểm tra có bộ ký tự tiếng Việt ngày 2026-11-09.
- Số trong bảng dùng chữ số đều độ rộng (`tabular-nums`).

| Tên biến | Cỡ chữ | Độ đậm | Chiều cao dòng | Dùng cho |
|---|---|---|---|---|
| chu-tieu-de-1 | 24px | 800 | 32px | Tiêu đề trang |
| chu-tieu-de-2 | 20px | 700 | 28px | Tiêu đề khối, ngăn kéo, hộp thoại |
| chu-tieu-de-3 | 16px | 700 | 24px | Tiêu đề thẻ, nhóm trường |
| chu-than | 14px | 400 | 22px | Nội dung, ô nhập, bảng |
| chu-nhan | 12px | 700 | 16px | Nhãn cột bảng (in hoa, giãn chữ 0,4px), huy hiệu |
| chu-chu-thich | 12px | 400 | 16px | Chú thích, lỗi dưới ô nhập |

## 4. Khoảng cách, bo góc, đổ bóng

- Thang khoảng cách: 4, 8, 12, 16, 24, 32 (biến khoang-1 đến khoang-6).
- Bo góc: bo-nho 6px (ô nhập, ô chọn); bo-vua 10px (nút, thẻ, ngăn kéo, hộp thoại); bo-tron 999px (huy hiệu, nhãn trạng thái, ảnh đại diện).
- Đổ bóng: bong-nhe `0 1px 2px rgba(15, 23, 42, 0.06)` cho thẻ; bong-noi `0 8px 24px rgba(15, 23, 42, 0.12)` cho ngăn kéo, hộp thoại, thông báo nổi.
- Viền phần tử đang được chọn bằng bàn phím: 2px mau-chinh, cách 2px.

## 5. Điểm ngắt responsive

| Tên | Độ rộng | Thay đổi chính |
|---|---|---|
| dien-thoai | dưới 768px | Ẩn menu trái, mở bằng nút; bảng thành danh sách thẻ hoặc cuộn ngang trong khung; ngăn kéo thành trang riêng; lưới mini app 2 cột |
| may-tinh-bang | 768px đến 1199px | Menu trái thu gọn chỉ còn biểu tượng; lưới mini app 3 cột |
| may-tinh | từ 1200px | Bố cục đầy đủ; lưới mini app 4 cột |

## 6. Thành phần dùng chung

| Thành phần | Biến thể | Trạng thái | Ghi chú sử dụng |
|---|---|---|---|
| ThanhTrenCung | Một biến thể | Có, không có số việc chờ | Logo, trang chủ, chọn công ty, hộp duyệt, thông báo, ảnh đại diện |
| MenuMiniApp | Đầy đủ, thu gọn | Mục thường, đang chọn, di chuột | Chỉ hiện mục có quyền |
| Nut | chinh, phu, nguy-hiem, chu | thường, di chuột, đang chọn bằng bàn phím, vô hiệu, đang xử lý | Đang xử lý: vòng quay, khóa bấm lặp |
| ONhap | chữ, mật khẩu, số, ngày, mã OTP | thường, đang chọn, lỗi, vô hiệu | Luôn có nhãn; lỗi hiện dưới ô |
| OChon | đơn, nhiều, tìm kiếm | thường, mở, lỗi, vô hiệu | Chọn công ty, nhân viên, vai trò |
| BangDuLieu | thường, có chọn dòng | có dữ liệu, rỗng, đang tải, lỗi | Phân trang 20 dòng; điện thoại: danh sách thẻ |
| BoLoc | Một biến thể | Có, không có bộ lọc đang áp dụng | Ô tìm kiếm và các ô chọn |
| NhanTrangThai | thanh-cong, canh-bao, loi, thong-tin, trung-tinh | | Kèm chữ, không chỉ dựa vào màu |
| ThongBaoNoi | thanh-cong, loi, thong-tin | | Góc trên phải, tự ẩn sau 5 giây |
| KhoiCanhBao | canh-bao, loi, thong-tin | | Nằm trong trang |
| NganKeo | Một biến thể | mở, đóng | Thêm, sửa; điện thoại thành trang riêng |
| HopThoaiXacNhan | thường, nguy-hiem | | Bắt buộc với ngừng hoạt động, khóa, vô hiệu hóa, thu hồi phiên, từ chối |
| TrangThaiRong | Một biến thể | | Hình minh họa, câu giải thích, nút thao tác chính |
| TrangThaiDangTai | Theo bố cục | | Khung xám nhấp nháy, tôn trọng `prefers-reduced-motion` |
| TrangThaiLoi | Một biến thể | | Thông báo kèm nút Thử lại |
| TrangThaiKhongCoQuyen | Một biến thể | | Câu giải thích, nút về trang chủ |
| CayDuLieu | Một biến thể | mở, đóng, đang chọn | Công ty, phòng ban |
| DongThoiGian | Một biến thể | đã xong, đang chờ, từ chối | Các cấp duyệt |
| MaTranQuyen | Một biến thể | chọn, bỏ chọn, vô hiệu | Vai trò |
| OMiniApp | Một biến thể | có, không có số việc chờ | Trang chủ |
| NutDangNhapLienKet | google, microsoft, zalo | thường, đang xử lý | Màn hình đăng nhập |
