# 25. KẾT QUẢ KIỂM THỬ

- Mô tả: Kết quả từng lần kiểm thử và danh sách lỗi.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

## Lần kiểm thử 2026-11-09 – CONG_VIEC_02

- Phạm vi: mini app Nền tảng, các lát L1 đến L5, L7, L8 (MAN_HINH_01 đến 18; API_01, API_06 đến API_48 trừ phần của lát L6). Lát L6 (đăng nhập Google, Microsoft, Zalo, số điện thoại) bị chặn nên ngoài phạm vi lần này. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test` xóa sạch mỗi lần chạy; Node.js 22; CI GitHub Actions trên từng commit của nhánh `chuc-nang/CONG_VIEC_02-mini-app-nen-tang`.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm --filter api test`; CI: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm audit --audit-level=high`, gitleaks; rà soát tiếng Anh 24 màn hình và hộp thoại bằng Playwright; đo tải sơ bộ bằng kịch bản Node (KICHBAN_KIEMTHU_111).
- Kết quả: 119 đạt / 0 không đạt / 119 kịch bản tự động (8 tệp `apps/api/test/*.test.ts`). CI đạt trên commit `e795e07`.
- Tiêu chí nghiệm thu:
  - TIEUCHI_NGHIEMTHU_01 đến 12, 15 đến 44 – Đạt (42 tiêu chí bắt buộc). TIEUCHI_NGHIEMTHU_26 rà soát mã và màn hình: không có chức năng đăng nhập thay. TIEUCHI_NGHIEMTHU_42 rà soát tiếng Anh: chỉ còn dữ liệu người dùng nhập (tên người, công ty, chi nhánh, phòng ban) và tên ngôn ngữ "Tiếng Việt" trong ô chọn ngôn ngữ.
  - TIEUCHI_NGHIEMTHU_13, 14, 46, 47 – Chưa kiểm thử: thuộc lát L6 bị chặn.
  - TIEUCHI_NGHIEMTHU_45 (Mong muốn) – Không đạt sơ bộ: xem LOI_01.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết.
  - C2 gitleaks trong CI trên mọi commit của công việc: không có phát hiện.
  - C3 phân quyền: Đạt – kiểm thử gọi API khi chưa đăng nhập, sai vai trò, ngoài công ty, ngoài chi nhánh ở các tệp l2 đến l8.
  - C4 dữ liệu độc hại: Đạt – `security.test.ts` (KICHBAN_KIEMTHU_118): chuỗi chèn mã lưu nguyên văn, giao diện không dùng `dangerouslySetInnerHTML`; chuỗi chèn truy vấn không đổi kết quả; chuỗi quá dài, trường thừa nhận `400`; tệp Excel sai mẫu, quá lớn bị từ chối (l4).
  - C5 phiên: Đạt một phần – cookie HttpOnly, SameSite=Lax (Secure khi chạy môi trường thật); dùng lại token làm mới thu hồi cả chuỗi; thiếu CSRF bị từ chối; đăng xuất làm cookie cũ hết hiệu lực; khóa tài khoản sau 5 lần sai mật khẩu; 5 lần sai mã xác thực hai lớp thu hồi phiên. Chưa có giới hạn số yêu cầu theo địa chỉ IP: xem LOI_02.
  - C6 OWASP Top 10: đã kiểm A01 phân quyền, A02 băm argon2id và mã hóa khóa TOTP, A03 chèn mã và truy vấn, A04 thiết kế (khóa, bàn giao, nhật ký chỉ thêm), A05 cấu hình (cookie, CSRF, lỗi không lộ chi tiết), A06 thư viện (C1), A07 xác thực, A08 toàn vẹn (outbox trong cùng giao dịch, gitleaks), A09 nhật ký (ghi cả lần đăng nhập thất bại, không ghi mật khẩu, mã OTP, token). A10 SSRF: chỉ gọi ra một địa chỉ Vietcombank cố định, không nhận địa chỉ từ người dùng.
- Tự rà soát mã và dọn dẹp: Đạt. Không còn mã gỡ lỗi, TODO, tệp sao lưu; `console.log` còn lại là đầu ra có chủ ý của lệnh `db:migrate`, `db:seed`, kiểm tra tệp dịch. Còn giữ: tệp bí mật TOTP của tài khoản thử trong `tam_thoi/CONG_VIEC_02/` (đã bỏ qua khỏi Git) để đăng nhập máy phát triển; dữ liệu thử trong cơ sở dữ liệu phát triển `vcomm`. 200 tài khoản đo tải đã xóa.
- Ghi chú hiệu năng: danh sách nhật ký thao tác lọc theo công ty chưa có chỉ mục `(company_id, occurred_at)`; cần thêm khi dữ liệu lớn (thay đổi tài liệu `16`).

### Danh sách lỗi

| Mã lỗi | Mô tả | Mức độ | Kịch bản liên quan | Quyết định xử lý | Trạng thái |
|---|---|---|---|---|---|
| LOI_01 | Đo sơ bộ trên máy phát triển 4 CPU, 200 người dùng ảo nghỉ 1 giây giữa thao tác: API_14 phân vị 95 là 10 ms, API_24 là 12 ms (đạt); API_01 đăng nhập phân vị 95 là 411 ms (mốc 200 ms) do băm mật khẩu argon2id; 0 lỗi. Gọi liên tục không nghỉ thì chậm hơn nhiều. Công cụ và môi trường kiểm thử tải trong tài liệu `20` chưa xác định | Trung bình | KICHBAN_KIEMTHU_111 | Chờ người dùng quyết định | Mở |
| LOI_02 | Chưa giới hạn số yêu cầu theo địa chỉ IP cho API không cần đăng nhập (đăng nhập, quên mật khẩu, kích hoạt). Giảm thiểu hiện có: khóa tài khoản sau 5 lần sai mật khẩu, đường dẫn đặt lại hết hạn sau 1 giờ | Trung bình | KICHBAN_KIEMTHU_120 | Sửa ngay bằng Redis (người dùng quyết định 2026-11-09) | Đã sửa trên nhánh `sua-loi/LOI_02-gioi-han-yeu-cau-theo-ip`, chờ nghiệm thu |

- Kết luận cổng kiểm thử: Đạt (không còn lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt; LOI_01, LOI_02 mức Trung bình chờ người dùng quyết định).

## Lần kiểm thử 2026-11-09 – LOI_02

- Phạm vi: giới hạn số yêu cầu theo địa chỉ IP cho API không cần đăng nhập; hồi quy toàn bộ.
- Môi trường: máy phát triển; PostgreSQL 16 `vcomm_test`; Redis 7 cho phép thử trên máy phát triển.
- Lệnh đã chạy: `pnpm --filter api typecheck`, `pnpm --filter api test`; gọi thử API_12 21 lần trên API phát triển có Redis.
- Kết quả: 120 đạt / 0 không đạt / 120 kịch bản. KICHBAN_KIEMTHU_120 đạt: 20 lần đầu `204`, lần 21 `429 RATE_LIMITED` kèm `Retry-After`, phút sau gọi lại được.
- Tiêu chí nghiệm thu: không có tiêu chí riêng; kết quả mong đợi là KICHBAN_KIEMTHU_120 – Đạt.
- Kiểm tra bảo mật phần B, C: C1, C2 chạy trong CI của pull request; C5 giới hạn số lần thử: Đạt; C3, C4, C6: Không áp dụng – không đổi phân quyền, dữ liệu đầu vào.
- Tự rà soát mã và dọn dẹp: Đạt.
- Kết luận cổng kiểm thử: Đạt.
