# apps/mobile-warehouse

Ứng dụng kho trên điện thoại, máy quét cầm tay Android (Expo; CONG_VIEC_44; tài liệu `12`, `14` MAN_HINH_105 đến 109).

Làm: đăng nhập nhân viên (API_137), chọn công ty và kho, quét mã (máy quét chế độ bàn phím, camera), tra tồn, phiếu kho, nhận hàng, xuất giao hàng, chuyển kho, đếm kiểm kê; gọi API kho có sẵn.
Không làm: duyệt phiếu, lập và kết thúc kiểm kê, cài đặt kho (làm trên web); lưu dữ liệu ngoại tuyến (bắt buộc có mạng).

Lệnh (tại gốc dự án):

- Xem trước bản web: `pnpm --filter mobile-warehouse web` (cổng 8084; API mặc định `http://localhost:4000/api/v1`, đổi bằng `EXPO_PUBLIC_API_URL`)
- Kiểm tra kiểu: `pnpm --filter mobile-warehouse typecheck`
- Kiểm thử phần tra mã quét: `pnpm --filter mobile-warehouse test`
