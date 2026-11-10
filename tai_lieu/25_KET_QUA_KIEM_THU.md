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
| LOI_01 | Đo sơ bộ trên máy phát triển 4 CPU, 200 người dùng ảo nghỉ 1 giây giữa thao tác: API_14 phân vị 95 là 10 ms, API_24 là 12 ms (đạt); API_01 đăng nhập phân vị 95 là 411 ms (mốc 200 ms) do băm mật khẩu argon2id; 0 lỗi. Gọi liên tục không nghỉ thì chậm hơn nhiều. Công cụ và môi trường kiểm thử tải trong tài liệu `20` chưa xác định | Trung bình | KICHBAN_KIEMTHU_111 | Giữ mức băm hiện tại; đo lại trên môi trường thử nghiệm khi chọn được công cụ kiểm thử tải (người dùng quyết định 2026-11-09) | Mở |
| LOI_02 | Chưa giới hạn số yêu cầu theo địa chỉ IP cho API không cần đăng nhập (đăng nhập, quên mật khẩu, kích hoạt). Giảm thiểu hiện có: khóa tài khoản sau 5 lần sai mật khẩu, đường dẫn đặt lại hết hạn sau 1 giờ | Trung bình | KICHBAN_KIEMTHU_120 | Sửa ngay bằng Redis (người dùng quyết định 2026-11-09) | Đã đóng: người dùng nghiệm thu, hợp nhất vào `main` (commit `69b2ee0`), kiểm thử 120/120 đạt trên commit hợp nhất |

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

## Lần kiểm thử 2026-11-09 – CONG_VIEC_03

- Phạm vi: lát L6 (Cài đặt tích hợp, đăng nhập số điện thoại, Google, Microsoft, Zalo), L9 (Zalo ZNS cho thông báo duyệt), L10 (mẫu đề xuất, đề xuất, tệp đính kèm, in PDF); MAN_HINH_01, 03, 06, 08, 19, 20, 21; API_02 đến API_05, API_49 đến API_54. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22. Nhà cung cấp eSMS, Google, Microsoft, Zalo và S3 được thay bằng bản giả lập trong kiểm thử (`apps/api/test/setup-database.ts`) vì chưa có mã ứng dụng, khóa thật.
- Lệnh đã chạy: `pnpm --filter api typecheck`, `pnpm --filter web-platform typecheck`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --audit-level=high`; thử trên trình duyệt bằng Playwright luồng quản trị thêm 3 mẫu có sẵn, nhân viên lập phiếu đề nghị chi, đính kèm tệp, gửi duyệt, người duyệt xem nội dung, tệp và PDF (máy tính và điện thoại).
- Kết quả: 155 đạt / 0 không đạt / 155 kịch bản tự động (12 tệp; phần mới: `c3-integrations` 4, `c3-login` 15, `c3-zns` 5, `c3-proposals` 11). Khớp khóa dịch tiếng Việt, tiếng Anh: 776 khóa.
- Tiêu chí nghiệm thu:
  - TIEUCHI_NGHIEMTHU_13, 14, 46, 47, 48 đến 55 – Đạt trên bản giả lập nhà cung cấp.
  - Chưa kiểm với nhà cung cấp thật: gửi SMS, ZNS qua eSMS.vn; đăng nhập Google, Microsoft, Zalo; lưu tệp trên S3. Cần người dùng nhập khóa ở MAN_HINH_19 và thử lại trên môi trường thử nghiệm.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết. Thư viện mới: pdfmake 0.3.12, @aws-sdk/client-s3 3.1156.0.
  - C2 gitleaks trong CI trên các commit của công việc: không có phát hiện. Không có khóa thật trong mã, tài liệu, `.env.example`.
  - C3 phân quyền: Đạt – Cài đặt tích hợp chỉ quản trị tập đoàn; mẫu đề xuất chỉ người có quyền quản lý mẫu; đề xuất chỉ người lập, người duyệt, quản trị công ty xem được, người khác nhận `404`; tệp đính kèm, PDF theo cùng quy tắc.
  - C4 dữ liệu độc hại: Đạt – tệp kiểm cả phần mở rộng và chữ ký đầu tệp, tên tệp loại ký tự điều khiển; giá trị đề xuất kiểm theo kiểu trường, tiền không có nhiều chữ số lẻ hơn tiền tệ; PDF không tải tài nguyên ngoài.
  - C5 phiên và xác thực: Đạt – OAuth dùng PKCE và cookie trạng thái ký, hết hạn 10 phút; mã OTP băm, hiệu lực 5 phút, sai 5 lần thì hủy, tối đa 5 lần gửi mỗi giờ, hai lần xác minh đồng thời chỉ một lần đạt; số chưa gắn tài khoản vẫn trả "Đã gửi mã".
  - C6 OWASP Top 10: A02 khóa tích hợp mã hóa AES-256-GCM, không trả về giao diện; A10 SSRF: chỉ gọi ra địa chỉ cố định của eSMS, Google, Microsoft, Zalo, S3.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát toàn nhánh tìm 9 điểm, sửa 8 (nháp trùng khi gửi lỗi, dùng lại mã OTP đồng thời, tệp không bị xóa khỏi nơi lưu, kiểm tiền tệ khi sửa mẫu, vượt 10 tệp khi tải đồng thời, tenant Microsoft dạng tên miền, kiểu thông báo lỗi, danh tính số điện thoại khi đổi người giữ số), thêm 4 kiểm thử; giữ lại 1 điểm hiệu năng nhỏ (kiểm quyền xem đề xuất đọc cả yêu cầu duyệt). Đối chiếu tài liệu với mã sửa thêm 3 lỗi (danh sách mẫu ngừng dùng, thông báo tệp quá lớn, thư mục lưu tệp mặc định).
- Kết luận cổng kiểm thử: Đạt trên bản giả lập (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Kiểm với nhà cung cấp thật làm khi người dùng có khóa.
- Bổ sung khi nghiệm thu (2026-11-09): nút gửi thử tin (KICHBAN_KIEMTHU_123 bước 8 đến 10), đếm ngược gửi lại mã, lời thông báo Zalo theo đặc tả. Kiểm thử lại 156/156 đạt trên nhánh và trên commit hợp nhất `5f4eb6c` vào `main`; CI đạt.
- Kết luận: Người dùng nghiệm thu, đã hợp nhất vào `main`.

## Lần kiểm thử 2026-11-09 – CONG_VIEC_04

- Phạm vi: lát L0 đến L4 (mini app Sản phẩm; ngành hàng, đơn vị tính; sản phẩm, biến thể, mã vạch, ảnh; nhập Excel; liên kết, sao chép giữa công ty; kênh bán, nhóm khách hàng, bảng giá, phiếu điều chỉnh giá); MAN_HINH_22 đến 27; API_55 đến API_62. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22. Lưu ảnh dùng bản giả lập lưu trữ tệp như CONG_VIEC_03.
- Lệnh đã chạy: `pnpm --filter api typecheck`, `pnpm --filter web-catalog typecheck`, `pnpm --filter web-platform typecheck`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --audit-level=high`; thử trên trình duyệt bằng Playwright: nhập Excel sản phẩm, sao chép sang công ty khác, thêm kênh có sẵn, tạo bảng giá (trùng bị từ chối), lập phiếu điều chỉnh giá chọn biến thể, gửi, xem giá hiện hành và lịch sử, phần Giá bán ở chi tiết sản phẩm (máy tính và điện thoại).
- Kết quả: 173 đạt / 0 không đạt / 173 kịch bản tự động (16 tệp; phần mới: `c4-categories` 4, `c4-products` 5, `c4-import-links` 3, `c4-prices` 5). Khớp khóa dịch tiếng Việt, tiếng Anh: 1108 khóa.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_56 đến 63 (bắt buộc) – Đạt; TIEUCHI_NGHIEMTHU_64 (mong muốn) – Đạt (tìm không dấu; 10.000 sản phẩm trả trang đầu dưới 500 ms trong kiểm thử).
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc: không có phát hiện.
  - C3 phân quyền: Đạt – ngành hàng, đơn vị tính chỉ người có quyền phạm vi tập đoàn sửa; sản phẩm, bảng giá của công ty khác trả `404`; liên kết, sao chép cần quyền quản lý sản phẩm ở cả hai công ty; giá chỉ đổi qua phiếu điều chỉnh giá.
  - C4 dữ liệu độc hại: Đạt – ảnh kiểm chữ ký đầu tệp, tối đa 5 MB, 10 ảnh; tệp Excel tối đa 5 MB, 2.000 dòng, sai mẫu bị từ chối cả tệp; truy vấn tìm kiếm thoát ký tự đặc biệt của LIKE.
  - C6 OWASP Top 10: A01 kiểm quyền theo công ty trong từng service; A04 hai người lưu cùng lúc trùng mã, trùng bảng giá nhận lỗi kiểm tra, không lỗi hệ thống.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát lát L4 tìm 10 điểm, sửa 9, giữ 1 (kích thước giao diện ghi thẳng như các trang L2, chưa có biến trong tài liệu `15`); đối chiếu tài liệu với mã sửa thêm 3 lỗi.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu; hợp nhất vào `main` (commit `65a7975`), kiểm thử lại 173/173 đạt trên commit hợp nhất; CI đạt.

## Lần kiểm thử 2026-11-10 – CONG_VIEC_05

- Phạm vi: lát L0 đến L4 (kho, vị trí, chủ hàng; phiếu nhập khác, xuất khác, điều chỉnh; tồn, lô, serial, giá vốn, thẻ kho; chuyển kho; kiểm kê; giữ hàng; tồn an toàn; in tem); MAN_HINH_28 đến 35; API_63 đến API_70. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm --filter api typecheck`, `pnpm --filter web-inventory typecheck`, `pnpm --filter web-platform typecheck`, `pnpm --filter web-catalog typecheck`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --audit-level=high`; thử trên trình duyệt bằng Playwright: lập kho, vị trí; lập phiếu nhập có serial bằng ô quét mã; xem tồn, thẻ kho; chuyển kho xuất, nhận; kiểm kê bắt đầu; giữ hàng, tồn an toàn; tải tem PDF (máy tính và điện thoại).
- Kết quả: 186 đạt / 0 không đạt / 186 kịch bản tự động (21 tệp; phần mới: `c5-warehouses` 1, `c5-documents` 6, `c5-transfers` 1, `c5-stocktakes` 2, `c5-reservations` 3). Khớp khóa dịch tiếng Việt, tiếng Anh.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_65 đến 72 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_73 (mong muốn) – Đạt phần tự động (cấu trúc mã Code 128, số trang, khổ tem); chưa quét thử bằng máy quét thật. TIEUCHI_NGHIEMTHU_74 (mong muốn) – Đạt (phiếu 200 dòng ghi sổ dưới 2 giây; 50.000 dòng tồn trả trang đầu dưới 500 ms).
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc: không có phát hiện.
  - C3 phân quyền: Đạt – thao tác kho theo chi nhánh sở hữu kho; công ty chủ hàng chỉ xem tồn của mình; giá vốn chỉ hiện với người có quyền xem giá vốn; tìm mặt hàng chỉ với công ty chủ hàng được gửi vào kho người dùng thao tác.
  - C4 toàn vẹn dữ liệu: Đạt – khóa dòng giá vốn, dòng tồn theo thứ tự cố định; hai phiếu đồng thời xuất món hàng cuối chỉ một phiếu ghi sổ; ràng buộc không âm; thẻ kho chặn sửa, xóa bằng trigger; kiểm kê khóa mặt hàng đang đếm.
  - C6 OWASP Top 10: A01 kiểm quyền tại kho trong từng service; A04 serial đang vận chuyển không bị phiếu khác lấy.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát toàn nhánh tìm 10 điểm, sửa 9, giữ 1 (lô và serial không bật cùng lúc nên không xảy ra); đối chiếu tài liệu với mã sửa thêm 6 lỗi.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu; hợp nhất vào `main` (commit `9c3d7c8`), kiểm thử lại 186/186 đạt trên commit hợp nhất; CI đạt.

## Lần kiểm thử 2026-11-10 – CONG_VIEC_06

- Phạm vi: lát L0, L1 (đối tác dùng chung tập đoàn, người liên hệ, tài khoản ngân hàng, đối tác nội bộ, che số Căn cước công dân; hồ sơ đối tác của công ty); MAN_HINH_36, 37; API_71, API_72. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter i18n test`, `pnpm audit --audit-level=high`; thử trên trình duyệt bằng Playwright: danh sách đối tác, thêm tổ chức có người liên hệ và tài khoản ngân hàng, cảnh báo trùng mã số thuế khi gõ, lập hồ sơ của công ty, thêm cá nhân che số và xem đầy đủ (máy tính và điện thoại).
- Kết quả: 191 đạt / 0 không đạt / 191 kịch bản tự động (22 tệp; phần mới: `c6-partners` 5). Khớp khóa dịch tiếng Việt, tiếng Anh: 1527 khóa.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_75 đến 79 (bắt buộc) – Đạt. Vế "đối tác ngừng giao dịch không chọn được trên chứng từ mới" của QUYTAC_NGHIEPVU_57 kiểm khi làm MODULE_04, MODULE_05.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 39): không có phát hiện.
  - C3 phân quyền: Đạt – thêm, sửa đối tác cần `crm.partner.manage`; xem số Căn cước công dân đầy đủ, hạn mức công nợ, lưu hồ sơ cần quyền nhạy cảm; tra theo số Căn cước công dân cần quyền quản lý đối tác; hồ sơ công ty khác không đọc được; đối tác nội bộ không sửa được ở mini app Đối tác.
  - C4 dữ liệu cá nhân: Đạt – danh sách, chi tiết, kết quả thêm, sửa, nhật ký chỉ có 3 số cuối Căn cước công dân; mỗi lần xem đầy đủ ghi nhật ký.
  - C6 OWASP Top 10: A01 kiểm quyền trong từng service; A04 hai người lưu cùng lúc trùng mã số thuế, số Căn cước công dân nhận lỗi đúng trường, không lỗi hệ thống.
- Tự rà soát mã và dọn dẹp: Đạt. Tự rà soát sửa 3 điểm (tra theo số Căn cước công dân, lỗi trùng đồng thời, đồng bộ gặp mã số thuế trùng); đối chiếu tài liệu với mã sửa thêm 5 điểm (ẩn hạn mức công nợ, tiền tệ công ty, đồng bộ khi khởi động và khi xem chi tiết, nhật ký đồng bộ, nhật ký xem số khi không có số).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu 2026-11-10; chờ người dùng hợp nhất pull request số 39.

## Lần kiểm thử 2026-11-10 – CONG_VIEC_07

- Phạm vi: lát L0 đến L2 (bảng giá mua; đề nghị mua, đơn mua, duyệt lại, đóng đơn, dung sai nhận vượt; phiếu nhập mua, kiểm tra chất lượng, trả hàng nhà cung cấp; ô cần kiểm tra chất lượng ở ngành hàng); MAN_HINH_38 đến 41, sửa MAN_HINH_22, 31, 32; API_73 đến API_76. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter i18n test`, `pnpm audit --audit-level=high`; thử trên trình duyệt bằng Playwright: thêm giá mua, lập đơn mua có giá gợi ý, gửi (duyệt ngay khi chưa có chính sách), nhập mua hàng serial có vị trí kệ, trả hàng nhà cung cấp theo serial, xem đơn mua sau nhập (máy tính và điện thoại).
- Kết quả: 198 đạt / 0 không đạt / 198 kịch bản tự động (23 tệp; phần mới: `c7-purchasing` 7, KICHBAN_KIEMTHU_165 đến 171).
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_80 đến 86 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --audit-level=high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 42): không có phát hiện.
  - C3 phân quyền: Đạt – đơn mua, giá mua của công ty khác trả `404`; nhập mua, trả hàng chỉ ở kho thuộc chi nhánh được gán quyền nhập mua; thủ kho không lập đơn mua; phiếu nhập mua không lập được bằng màn hình phiếu kho thường.
  - C4 toàn vẹn dữ liệu: Đạt – gửi phiếu nhập khóa đơn mua để hai phiếu đồng thời không nhận vượt dung sai; trả hàng khóa dòng phiếu nhập gốc; giá trị trả không vượt giá trị tồn.
  - C6 OWASP Top 10: A01 kiểm quyền trong từng service; A04 sửa đơn đã nhận không giảm dưới số đã nhận, không đổi kho nhận.
- Tự rà soát mã và dọn dẹp: Đạt. Tự rà soát sửa 1 điểm (mảng PostgreSQL); đối chiếu tài liệu với mã tìm 11 điểm, sửa 9, giữ 2 có lý do (đề nghị mua nhận vào kho bất kỳ của công ty vì là chứng từ cấp công ty; đơn mua nháp vẫn tính vào số đã đặt của đề nghị cho đến khi bị từ chối, rút).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu 2026-11-10; chờ người dùng hợp nhất pull request số 42 (sau số 39).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_08

- Phạm vi: lát L0, L1 (đơn bán giá theo bảng giá kênh, nhóm khách; ngoại lệ chiết khấu tay, dưới giá vốn, vượt hạn mức công nợ qua luồng duyệt; giữ hàng khi xác nhận; phiếu xuất giao hàng theo đơn, giao nhiều lần; phiếu nhận hàng trả lại theo phiếu xuất gốc); MAN_HINH_42, 43, sửa MAN_HINH_31, 32; API_77 đến API_79. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; thử trên trình duyệt bằng Playwright: lập đơn bán người mua không lấy hóa đơn, gửi (xác nhận ngay khi không ngoại lệ), lập phiếu xuất giao hàng serial có vị trí kệ, nhận hàng trả lại theo serial, xem đơn sau giao (máy tính và điện thoại).
- Kết quả: 203 đạt / 0 không đạt / 203 kịch bản tự động (24 tệp; phần mới: `c8-sales` 5, KICHBAN_KIEMTHU_172 đến 175, 183). Một lần chạy toàn bộ giữa chừng có 1 tệp lỗi, không tái hiện trong 4 lần chạy sau; không xác định được tệp lỗi (đầu ra đã bị lọc).
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_87 đến 92 (bắt buộc) – Đạt theo kiểm thử tự động và thử trên trình duyệt; KICHBAN_KIEMTHU_176 đến 182 (thủ công) phần chính đã thử trên trình duyệt, phần biên đã có kiểm thử tự động tương ứng.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 43): không có phát hiện.
  - C3 phân quyền: Đạt – đơn bán công ty khác trả `404`; thủ kho chi nhánh khác không giao được; hạn mức công nợ, giá vốn trong diễn giải ngoại lệ chỉ hiện cho người có `crm.profile.manage`, `inventory.cost.view`; kho chỉ xem đơn đã xác nhận trở đi.
  - C4 toàn vẹn dữ liệu: Đạt – gửi đơn khóa hồ sơ khách; gửi phiếu xuất khóa đơn bán; gửi phiếu trả khóa dòng phiếu xuất bằng câu lệnh riêng (KICHBAN_KIEMTHU_183 thất bại khi bỏ khóa, đạt khi có); giữ hàng theo thứ tự mặt hàng tránh khóa chéo.
  - C6 OWASP Top 10: A01 kiểm quyền trong từng service; A04 đơn đã giao không hủy, chỉ đóng.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 4 lỗi mức Trung bình (lộ hạn mức công nợ, giá vốn; trả vượt khi gửi đồng thời; không trả một phần theo đơn vị quy đổi; lỗi thiếu hàng không báo dòng) và 6 lỗi Thấp; đã sửa 4 lỗi Trung bình và 4 lỗi Thấp. Đối chiếu tài liệu với mã: dư nợ tạm tính cộng cả đơn chờ duyệt, lệch quyết định của người dùng, đã sửa. Giữ lại: khi sửa đơn không đổi được đơn vị của dòng đã có (xóa dòng, thêm lại); màn trả hàng chưa trừ số đã trả (chặn khi gửi).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu 2026-11-10. Sau nghiệm thu thêm trừ hàng khách trả khỏi dư nợ tạm tính theo quyết định của người dùng: 204 đạt / 0 không đạt (KICHBAN_KIEMTHU_184). Chờ người dùng hợp nhất pull request số 43 (sau số 42).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_09

- Phạm vi: lát L0, L1 (đơn bán nội bộ sinh đơn mua đối ứng và ngược lại; xác nhận, từ chối, rút, hủy, đóng lan hai bên; giá nội bộ theo bảng giá kênh Nội bộ; phiếu xuất nội bộ sinh phiếu nhập chờ nhận; nhận theo số thực nhận; biên bản chênh lệch, nhập lại kho, ghi tổn thất); MAN_HINH_44, sửa MAN_HINH_31, 32, 40, 41, 43; API_80 đến API_82. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; thử trên trình duyệt bằng Playwright (Quản trị tập đoàn chuyển công ty VCR, VCT): đơn bán nội bộ, đơn mua đối ứng chọn kho và xác nhận, phiếu xuất sinh phiếu nhập, nhận thiếu có lý do, biên bản nhập lại kho, đơn mua nội bộ khóa giá (máy tính và điện thoại).
- Kết quả: 210 đạt / 0 không đạt / 210 kịch bản tự động (25 tệp; phần mới: `c9-internal-trade` 6, KICHBAN_KIEMTHU_185 đến 190). KICHBAN_KIEMTHU_191, 192 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_93 đến 98 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 44): không có phát hiện.
  - C3 phân quyền: Đạt – xác nhận, từ chối chứng từ đối ứng chỉ người có quyền quản lý đơn của công ty đó; công ty bán không xem đơn mua của công ty mua (`404`); nhận hàng cần quyền nhập mua tại kho nhận; biên bản chỉ của công ty bán tại kho được xuất giao hàng, giá trị chỉ hiện cho người xem được giá vốn.
  - C4 toàn vẹn dữ liệu: Đạt – đơn mua nội bộ không nhận bằng phiếu nhập thường; nhận hàng khóa theo phiên bản; biên bản duy nhất theo phiếu nhập và dòng xuất, xử lý giữ trước rồi mở lại khi lỗi; một bên kết thúc thì rút yêu cầu duyệt còn chờ của bên kia.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 1 lỗi Cao (đơn mua nội bộ lập được phiếu nhập thường), 4 lỗi Trung bình (yêu cầu duyệt treo, đơn đối ứng bị rút kẹt, đổi bảng giá lúc chờ duyệt làm treo đơn, lỗi xác nhận không hiện), 4 lỗi Thấp; đã sửa lỗi Cao, 4 lỗi Trung bình, 2 lỗi Thấp. Giữ lại (ghi tài liệu 22): hai bên hủy, đóng cùng lúc có thể khóa chéo (một giao dịch bị hủy, dữ liệu không hỏng); đơn giá đơn mua đối ứng làm tròn 4 chữ số có thể lệch vài đồng lẻ. Ghi nhận ngoài phạm vi: đổi bộ lọc nhanh trên danh sách có thể hiện kết quả của bộ lọc trước (hook `useApi` dùng chung không bỏ phản hồi cũ).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt). Chờ người dùng nghiệm thu.
- Kết luận: Người dùng nghiệm thu 2026-11-10; chờ người dùng hợp nhất pull request số 44 (sau số 43).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_12

- Phạm vi: lát L0, L1 (chương trình giảm theo sản phẩm, giảm theo đơn, mua X tặng Y; điều kiện kênh, nhóm khách, thời gian; gửi duyệt, rút, dừng; ngân sách, số suất; tự áp dụng vào đơn bán, tặng theo tồn còn lại tại kho xuất); MAN_HINH_45, sửa MAN_HINH_42, 43; API_83, sửa API_77. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm audit --prod --audit-level high`; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): danh sách, lập chương trình thiếu mặt hàng, giảm theo sản phẩm có ngân sách, mua X tặng Y có số suất, đơn bán tự áp khuyến mãi và hàng tặng, cảnh báo thiếu suất tặng, sửa đơn không có dòng tặng, dừng chương trình, lọc theo trạng thái (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang).
- Kết quả: 216 đạt / 0 không đạt / 216 kịch bản tự động (26 tệp; phần mới: `c12-promotions` 6, KICHBAN_KIEMTHU_193 đến 198). KICHBAN_KIEMTHU_199, 200 (thủ công trên trình duyệt) đạt, trừ bước 5 của KICHBAN_KIEMTHU_199 (Nhân viên bán hàng xem chương trình) chưa chạy trên trình duyệt vì máy phát triển chưa có tài khoản Nhân viên bán hàng; phân quyền này đã có kiểm thử tự động KICHBAN_KIEMTHU_193.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_99 đến 104 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 47): không có phát hiện.
  - C3 phân quyền: Đạt – lập, sửa, gửi, rút, dừng chương trình cần quyền quản lý khuyến mãi; Nhân viên bán hàng chỉ xem; chỉ người lập rút được chương trình chờ duyệt.
  - C4 toàn vẹn dữ liệu: Đạt – gửi đơn khóa các chương trình đã áp và từ chối khi vượt ngân sách hoặc số suất; suất tặng không vượt tồn khả dụng tại kho xuất; chương trình sửa theo phiên bản.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập đã sửa các lỗi tìm được (commit `fix` 2c92a77). Rà soát bảo mật tài liệu 22 sửa thêm 2 điểm: rút chương trình không ghi nhật ký; số suất tặng quá lớn trả lỗi máy chủ (commit 57bbcd0). Giữ lại (ghi tài liệu 22): chương trình không có ngân sách gửi duyệt với giá trị 0, chính sách duyệt chỉ có cấp từ mức lớn hơn 0 sẽ không áp (người dùng quyết định giữ, công ty đặt cấp từ 0 đồng).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10; chờ người dùng hợp nhất pull request số 47 (sau số 44).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_21

- Phạm vi: lát L0, L1 (phạm vi xem khách hàng, đơn bán theo nhân viên phụ trách và phòng ban quản lý; quyền `crm.customer.view_all`, `crm.customer.assign`; nhân viên thêm đối tác mới hoặc nhận đối tác có sẵn thì tự phụ trách; hồ sơ chỉ đặt nhân viên phụ trách khi chưa có; phiếu giao khách theo chính sách duyệt, áp dụng có kiểm nhân viên phụ trách lúc gửi, báo nhân viên; lịch sử phụ trách); MAN_HINH_64, 65; sửa MAN_HINH_36, 37; API_110, API_111; THAY_DOI_12. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod`; database migration 0021 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright: nhân viên bán hàng chỉ thấy khách của mình; quản trị công ty lọc khách của tôi, lập và gửi phiếu giao khách, xem lịch sử phụ trách (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi).
- Kết quả: 290 đạt / 0 không đạt / 290 kịch bản tự động (36 tệp; phần mới: `c21-customer-assignment` 9, KICHBAN_KIEMTHU_278 đến 284, 286). KICHBAN_KIEMTHU_285 (thủ công trên trình duyệt) đạt.
- Kiểm thử đã duyệt được sửa: tám tệp kiểm thử của CONG_VIEC_08, 12, 13, 14, 15, 16, 17, 19 dùng vai trò Nhân viên bán hàng lập đơn cho khách chưa có nhân viên phụ trách; theo THAY_DOI_12 các kiểm thử này bị chặn. Người dùng cho phép (2026-11-10) thêm bước chuẩn bị `salespersonSeesAllCustomers` (người bán thử có quyền xem mọi khách như hành vi cũ), không đổi phần kiểm tra; 59/59 đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_151 đến 155 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_156 (mong muốn) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 56) chưa chạy được do tài khoản GitHub lỗi thanh toán; đã rà các dòng thêm mới không có khóa bí mật.
  - C3 phân quyền: Đạt – nhân viên không có quyền xem mọi khách nhận 404 với khách, đơn ngoài phạm vi (chi tiết, sửa, gửi, rút, hủy, đóng, đơn đối ứng, số Căn cước công dân, lịch sử, hồ sơ); giá gợi ý không dùng nhóm khách ngoài phạm vi; chỉ trưởng phòng hoặc người có quyền giao khách lập phiếu; chỉ người gửi rút.
  - C4 toàn vẹn dữ liệu: Đạt – gửi và áp dụng phiếu khóa hồ sơ khách theo thứ tự rồi mới kiểm; khách đổi nhân viên hoặc nhân viên nhận ngừng làm việc trong lúc chờ duyệt thì phiếu bị từ chối; một dòng lịch sử mở cho mỗi khách (chỉ mục duy nhất); truy vấn tham số ràng buộc.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập không thấy lỗi Nghiêm trọng; tìm 2 lỗi Cao (hai phiếu cùng khách áp dụng song song ghi đè nhau; nhân viên không nhận được đối tác đã có trong tập đoàn), 6 mục Trung bình (kiểm phạm vi ngoài giao dịch khi gửi; khóa không theo thứ tự; không kiểm nhân viên nhận khi áp dụng; người lập không sửa được đơn nháp khi khách đã chuyển; trưởng phòng cần quyền xem đối tác; lý do từ chối là chuỗi cố định), 7 mục Thấp; đã sửa các mục, mục quyền của trưởng phòng và bảng vai trò sửa trong đặc tả. Tài khoản thử trên dữ liệu phát triển ghi trong `tam_thoi/CONG_VIEC_02/da_tao.md`.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận các giới hạn đã biết (đặc tả mục 16); chờ người dùng hợp nhất pull request số 56 (sau số 55).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_20

- Phạm vi: lát L0 đến L2 (phạm vi tập đoàn, quyền chỉ hiệu lực ở phạm vi tập đoàn; cộng gộp B01-DN, B02-DN theo mã Thông tư 99, công ty Thông tư 133 ghép mã; số dư theo từng công ty không bù trừ ngược chiều; bảng hợp nhất theo kỳ; loại trừ công nợ và trả trước nội bộ kèm cảnh báo chênh lệch; loại trừ doanh thu, giá vốn bán nội bộ; lãi chưa thực hiện ước tính theo phần bên mua thực nhận, sửa tay có lý do; điều chỉnh tay theo công ty, đối tác; gửi duyệt tính lại và chốt số; rút, gửi lại; xuất Excel, PDF); MAN_HINH_62, 63; API_106 đến API_109. Báo cáo tài chính từng công ty (API_90) dùng chung phần đọc số liệu mới. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm audit --prod`; database migration 0020 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị tập đoàn): phạm vi, xem nhanh cộng gộp, lập bảng, điều chỉnh tay (thiếu đối tác báo lỗi tại ô, chọn công ty, đối tác), gửi chốt số (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi ngoài lỗi kiểm tra cố ý).
- Kết quả: 281 đạt / 0 không đạt / 281 kịch bản tự động (35 tệp; phần mới: `c20-consolidation` 3, `c20-consolidation-eliminations` 4; KICHBAN_KIEMTHU_270 đến 275, 277). KICHBAN_KIEMTHU_276 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_145 đến 149 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_150 (mong muốn) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 55) chưa chạy được do tài khoản GitHub lỗi thanh toán; đã rà các dòng thêm mới không có khóa bí mật.
  - C3 phân quyền: Đạt – mọi thao tác cần quyền gán ở phạm vi tập đoàn; Kế toán trưởng phạm vi công ty nhận 403; `finance.consolidation.manage` là quyền nhạy cảm; chỉ người gửi được rút.
  - C4 toàn vẹn dữ liệu: Đạt – chỉ đọc sổ các công ty, không ghi bút toán vào sổ công ty; số chốt lúc gửi, bảng đã chốt không tính lại; một bảng đang dùng mỗi kỳ (chỉ mục duy nhất, lỗi nghiệp vụ khi trùng); điều chỉnh tay kiểm công ty thuộc thành viên, đối tác tồn tại, cân Nợ Có; truy vấn tham số ràng buộc.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 2 lỗi Cao (thiếu loại trừ trả trước nội bộ; gửi duyệt không chốt số nên người duyệt thấy số khác số ghi), các mục Trung bình (số dư ngược chiều giữa công ty bị bù trừ; lãi mỗi đơn vị sai khi giao thiếu; tồn cuối không chia khi nhiều bên bán; điều chỉnh tay thiếu công ty, đối tác; gửi lại trùng kỳ lỗi 500; thiếu chỉ mục), các mục Thấp (lỗi ghi sổ hiện khóa thô; câu thiếu định khoản nói về hoa hồng; xem nhanh tải khi chưa mở thẻ); đã sửa tất cả. Khi thử trên trình duyệt phát hiện ô Nợ, Có bị tách hai hàng trong ngăn kéo điều chỉnh tay, đã sửa. Bảng nháp thử trên dữ liệu phát triển đã xóa.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận các giới hạn đã biết (đặc tả mục 16); chờ người dùng hợp nhất pull request số 55 (sau số 54).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_19

- Phạm vi: lát L0, L1 (đơn vị thu hộ; nhập bảng đối soát từ tệp Excel mẫu chung, ghép đơn bán, lỗi chặn, cảnh báo chênh lệch, bỏ dòng, nhập lại, bỏ bảng nháp; gửi theo chính sách duyệt, rút; ghi sổ: trừ nợ khách theo đơn, trả trước, nợ đơn vị thu hộ bằng thực nhận, bút toán 1388, 131, 6418/6421; hoa hồng theo tiền thu hộ; phiếu thu của đơn vị thu hộ hạch toán 1388); MAN_HINH_60, 61; API_102 đến API_105. Sửa nhãn nguồn bút toán hoa hồng trên MAN_HINH_51. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22. Chưa có tệp đối soát thật của nhà vận chuyển, cổng thanh toán.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0019 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): khai đơn vị, nhập tệp có dòng lỗi, bỏ dòng, gửi, ghi sổ, xem bút toán (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi).
- Kết quả: 274 đạt / 0 không đạt / 274 kịch bản tự động (33 tệp; phần mới: `c19-collection-statements` 8, KICHBAN_KIEMTHU_261 đến 267, 269). KICHBAN_KIEMTHU_268 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_139 đến 143 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_144 (mong muốn) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 54).
  - C3 phân quyền: Đạt – xem, nhập gửi, khai đơn vị cần phạm vi công ty; khai đơn vị là quyền nhạy cảm; nhân viên bán hàng nhận 403; chỉ người gửi được rút.
  - C4 toàn vẹn dữ liệu: Đạt – tệp tối đa 5 MB, 5.000 dòng, chỉ đọc giá trị ô; ghép đơn trong công ty, bỏ đơn đối ứng; khóa theo đơn vị thu hộ khi nhập, gửi, ghi sổ; khóa công nợ khách, đơn vị khi ghi sổ; kiểm lại lỗi khi ghi sổ sau duyệt; bút toán cân Nợ Có; truy vấn tham số ràng buộc.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 1 lỗi Cao (phiếu thu của đơn vị thu hộ ghi Có 131 trong khi nợ đơn vị nằm ở 1388, sổ cái lệch sổ công nợ), 4 mục Trung bình (bảng nháp trùng mã làm bảng đã duyệt bị từ chối; hai bảng cùng mã gửi đồng thời cùng ghi sổ; thiếu khóa công nợ khi ghi sổ; người gửi khác người lập không rút được), 4 mục Thấp (đọc số tiền có dấu chấm khi tiền tệ có số lẻ; mã dạng số dài bị làm tròn; lý do lỗi hiện mã thô; giải nén toàn bộ tệp trước khi đếm dòng); đã sửa 8 mục, giữ lại mục giải nén tệp (rủi ro chung với nhập sản phẩm, ghi đặc tả mục 16). Khi cập nhật tài liệu phát hiện 2 câu thông báo sai ngữ cảnh (1.000 dòng, thiếu định khoản nói về hoa hồng), đã sửa. Khi thử trên trình duyệt phát hiện nhãn nguồn bút toán hoa hồng (CONG_VIEC_17) hiện mã thô, đã sửa.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận các giới hạn đã biết (đặc tả mục 16); chờ người dùng hợp nhất pull request số 54 (sau số 53).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_18

- Phạm vi: lát L0, L1 (kết nối quỹ ngân hàng với dịch vụ trung gian: bộ giả lập, SePay; webhook công khai có khóa Apikey, chống trùng, lưu nội dung gốc; tự ghép với phiếu thu chi đã ghi sổ; gợi ý khách, xác nhận lập phiếu thu; ghép tay, bỏ qua, bỏ ghép; đối chiếu số dư); MAN_HINH_58, 59; API_95 đến API_101. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22. SePay thử bằng dữ liệu theo tài liệu công khai, chưa thử với tài khoản thật.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0018 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): kết nối bộ giả lập, khóa hiện một lần, gửi thử tự ghép, gợi ý khách theo số đơn bán, lập phiếu thu, ghép tay, bỏ qua, ô đối chiếu (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi).
- Kết quả: 266 đạt / 0 không đạt / 266 kịch bản tự động (32 tệp; phần mới: `c18-bank-reconciliation` 15, KICHBAN_KIEMTHU_246 đến 255, 257 đến 260). KICHBAN_KIEMTHU_256 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_132 đến 137 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_138 (mong muốn) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 53).
  - C3 phân quyền: Đạt – xem, xử lý, cài đặt cần phạm vi công ty; cài đặt là quyền nhạy cảm; nhân viên bán hàng nhận 403; webhook xác thực bằng khóa riêng từng kết nối, so sánh thời gian cố định, cùng một lỗi 401 cho không có kết nối, kết nối tắt, sai khóa.
  - C4 toàn vẹn dữ liệu: Đạt – khóa sinh ngẫu nhiên 192 bit, lưu mã hóa AES-256-GCM, chỉ trả về một lần; chống trùng theo mã giao dịch của dịch vụ; khóa dòng quỹ cùng thứ tự với ghi sổ phiếu; một phiếu ghép tối đa một giao dịch (chỉ mục duy nhất); mọi truy vấn lọc theo công ty, tham số ràng buộc.
- Tự rà soát mã và dọn dẹp: Đạt. Tự rà soát sửa 2 mục (tạo được kết nối cho quỹ ngừng dùng; cột dữ liệu gốc lưu dữ liệu đã xử lý). Rà soát độc lập tìm 1 lỗi Nghiêm trọng (giới hạn 20 yêu cầu mỗi phút theo IP dùng chung cho mọi công ty, có thể mất giao dịch), 2 lỗi Cao (phiếu thu từ gợi ý bị sửa vẫn được ghép; xác nhận lại bỏ qua khách vừa chọn), 4 mục Trung bình (khóa chết giữa webhook và ghi sổ phiếu; ghép song song với bỏ qua gây lỗi; xác nhận song song có thể lập hai phiếu; chỉ mục theo công ty), 6 mục Thấp; đã sửa cả 13 mục trừ 1 mục Thấp (kết nối bộ giả lập còn lại trên môi trường thật không sửa được, không xảy ra vì không tạo được bộ giả lập trên môi trường thật). Lỗi Nghiêm trọng sửa theo quyết định của người dùng: webhook đúng khóa không giới hạn, chỉ đếm lần sai khóa (KICHBAN_KIEMTHU_260).
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận các giới hạn đã biết (đặc tả mục 16); chờ người dùng hợp nhất pull request số 53 (sau số 52). Trước khi phát hành: thử với tài khoản SePay thật (cách gửi khóa, định dạng ngày giờ).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_17

- Phạm vi: lát L0, L1 (cài đặt hoa hồng theo công ty, bảng mức theo ngành hàng và kênh, hệ số kênh, bậc hệ số, chỉ tiêu tháng; gán nhân viên hưởng khi gửi đơn; phát sinh khi phiếu thu trừ nợ phiếu xuất, hoàn tiền trả hàng ghi âm, bán lẻ khi giao, khi trả; bảng hoa hồng tháng qua luồng duyệt, bút toán Nợ chi phí hoa hồng / Có 334); MAN_HINH_56, 57, bổ sung MAN_HINH_43; API_93, 94, sửa API_77. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0015 đến 0017 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): cài đặt, chỉ tiêu, lập bảng tháng 10 từ một phát sinh mẫu thêm vào dữ liệu phát triển, gửi, ghi sổ (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi).
- Kết quả: 251 đạt / 0 không đạt / 251 kịch bản tự động (31 tệp; phần mới: `c17-commissions` 10, KICHBAN_KIEMTHU_234 đến 242, 245). KICHBAN_KIEMTHU_243, 244 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_127 đến 131 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 52).
  - C3 phân quyền: Đạt – xem, quản lý, cài đặt hoa hồng cần phạm vi công ty; cài đặt là quyền nhạy cảm; nhân viên bán hàng không xem được phát sinh, bảng.
  - C4 toàn vẹn dữ liệu: Đạt – phát sinh ghi cùng giao dịch trừ nợ hoặc ghi sổ phiếu kho, khóa duy nhất theo nguồn và dòng đơn; lập bảng tuần tự theo khóa cài đặt; bị từ chối, rút, bỏ bảng nháp trả phát sinh.
- Tự rà soát mã và dọn dẹp: Đạt. Khi kiểm thử phát hiện bảng có tổng âm treo ở chờ duyệt (không có cấp duyệt), đã sửa (giá trị duyệt là trị tuyệt đối). Rà soát độc lập tìm 2 lỗi Cao (một dòng đơn tách nhiều dòng phiếu mất hoa hồng; hàng trả trừ vào phần chưa thu vẫn được tính khi thu nốt), 3 mục Trung bình (tháng đã khóa sổ chặn các tháng sau; bảng ghi sổ trước khi khởi tạo kế toán không có bút toán; hoàn tiền có thể trừ vào tiền trả trước), 6 mục Thấp; đã sửa 2 lỗi Cao, 2 mục Trung bình, 3 mục Thấp. Giữ lại, chờ người dùng quyết (tài liệu 22): hoàn tiền trừ vào khoản có cũ nhất; bán lẻ chỉ có người hưởng khi gán theo người lập đơn; đơn nội bộ được tính hoa hồng; số dư đầu kỳ không phát sinh hoa hồng.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10; quyết định thêm: đơn không có khách gán cho người lập đơn, đơn nội bộ không tính hoa hồng (đã sửa, KICHBAN_KIEMTHU_245), hoàn tiền giữ cách trừ nợ hiện có; chờ người dùng hợp nhất pull request số 52 (sau số 51).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_16

- Phạm vi: lát L0 đến L2 (cài đặt hóa đơn điện tử theo công ty; lập hóa đơn khi phiếu xuất giao hàng ghi sổ, kể cả đơn không có khách (THAY_DOI_11) và bán nội bộ; gửi nền qua bộ giả lập, MISA meInvoice; gửi lại, tra trạng thái, báo quá hạn; trả hàng: hóa đơn điều chỉnh giảm, hóa đơn trả hàng của người mua; hóa đơn thay thế); MAN_HINH_54, 55; API_91, 92. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22. MISA meInvoice thử bằng máy chủ giả trong kiểm thử, chưa thử với tài khoản thật.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0013, 0014 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): cài đặt, giao hàng sinh hóa đơn, tác vụ nền gửi qua bộ giả lập nhận số và mã, chi tiết, tải PDF, thẻ "Chờ xử lý trả hàng", lập hóa đơn điều chỉnh giảm (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi). Hóa đơn thay thế chưa thử trên trình duyệt (dữ liệu phát triển thiếu tồn kho), có kiểm thử tự động KICHBAN_KIEMTHU_230.
- Kết quả: 241 đạt / 0 không đạt / 241 kịch bản tự động (30 tệp; phần mới: `c16-einvoices` 8, KICHBAN_KIEMTHU_224 đến 231). KICHBAN_KIEMTHU_232, 233 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_121 đến 125 (bắt buộc) – Đạt. TIEUCHI_NGHIEMTHU_126 (bắt buộc) – Đạt với máy chủ giả MISA; thử với tài khoản thử MISA là việc trước khi phát hành.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 51).
  - C3 phân quyền: Đạt – xem, quản lý, cài đặt hóa đơn điện tử cần phạm vi công ty; cài đặt là quyền nhạy cảm; nhân viên bán hàng nhận 403; 4 ký tự cuối mật khẩu chỉ cho người có quyền cài đặt.
  - C4 toàn vẹn dữ liệu: Đạt – hóa đơn lập cùng giao dịch ghi sổ; gọi nhà cung cấp ngoài giao dịch, ghi lần gửi trước khi gọi, mã tham chiếu chống lập trùng, tra trạng thái trước khi gửi lại; chỉ kết quả lần gửi mới nhất được ghi; mật khẩu mã hóa AES-256-GCM, không trả về, không ghi nhật ký.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 2 lỗi Cao (gửi lại không tra trạng thái có thể lập trùng; gửi chồng, kết quả cũ ghi đè), 5 mục Trung bình (gửi lại lần đầu sau 5 phút thay vì 1; mã truy cập MISA không đổi khi đổi cài đặt; hóa đơn bị từ chối không xử lý tiếp được; tác vụ hóa đơn chặn tác vụ nền khác; đánh dấu thay thế trước khi hóa đơn thay thế phát hành), 6 mục Thấp; đã sửa cả 7 mục Cao, Trung bình và 2 mục Thấp. Giữ lại (ghi tài liệu 22, đặc tả mục 16): trạng thái gửi cơ quan thuế của MISA chưa ánh xạ nên cơ quan thuế từ chối qua MISA hiện "Chờ cấp mã"; tệp tải lỗi không tự tải lại; ngày làm việc tiếp theo chưa tính ngày nghỉ lễ.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận 4 giới hạn đã biết; chờ người dùng hợp nhất pull request số 51 (sau số 50). Trước khi phát hành: đối chiếu tài liệu API MISA chính thức, thử với tài khoản thử MISA (chữ ký số từ xa); kế toán trưởng đối chiếu Nghị định 254/2026, Thông tư 91/2026.

## Lần kiểm thử 2026-11-10 – CONG_VIEC_15

- Phạm vi: lát L0, L1 (báo cáo tình hình tài chính B01-DN theo Thông tư 99/2025, B01a-DNN, B01b-DNN theo Thông tư 133/2016; báo cáo kết quả hoạt động kinh doanh B02-DN, B02-DNN; lập được khi kỳ chưa khóa sổ; số đầu năm, cùng kỳ năm trước; đánh dấu tài khoản chi tiết dài hạn; xuất Excel, PDF); MAN_HINH_53, ô Dài hạn trên MAN_HINH_50; API_90, sửa API_87. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0012 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): báo cáo tình hình tài chính (tổng tài sản 17.804.000 bằng tổng nguồn vốn), kết quả kinh doanh, tải Excel (tệp xlsx hợp lệ), mở PDF thẻ mới, đánh dấu tài khoản chi tiết dài hạn (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang, không có yêu cầu lỗi).
- Kết quả: 233 đạt / 0 không đạt / 233 kịch bản tự động (29 tệp; phần mới: `c15-statements` 4, KICHBAN_KIEMTHU_218 đến 221). KICHBAN_KIEMTHU_222, 223 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_117 đến 120 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 50).
  - C3 phân quyền: Đạt – xem, xuất báo cáo cần quyền `finance.ledger.view` trong phạm vi công ty; nhân viên bán hàng nhận 403; đánh dấu dài hạn cần `finance.ledger.setup`, tài khoản hệ thống không đánh dấu được.
  - C4 toàn vẹn dữ liệu: Đạt – báo cáo chỉ đọc; mọi truy vấn lọc theo công ty; tham số truy vấn ràng buộc, không ghép chuỗi.
- Tự rà soát mã và dọn dẹp: Đạt. Khi thử trên trình duyệt phát hiện tệp Excel, PDF tải về hỏng (máy chủ trả nội dung dạng JSON), đã sửa và thêm kiểm tra chữ ký tệp. Rà soát độc lập không có lỗi chặn; tìm 2 mục Trung bình, 4 mục Thấp. Đã sửa: phiếu kế toán kết chuyển thủ công qua 911 làm sai kết quả kinh doanh, cùng kỳ năm trước bỏ sót ngày 29/02, tổng có thể lệch 1 đồng so với các dòng, thiếu từ ngày hoặc mẫu sai không báo lỗi. Giữ lại (ghi đặc tả mục 16): lợi nhuận chưa kết chuyển mọi năm vào 4212 như khi khóa sổ thật; chỉ tiêu theo tài khoản đối ứng không chia bút toán nhiều đối ứng; "Từ ngày" mặc định 01/01.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận ba giới hạn đã biết; trước khi phát hành: kế toán trưởng so Phụ lục IV Thông tư 99/2025 (biểu mẫu, cách lập) với bản gốc; chờ người dùng hợp nhất pull request số 50 (sau số 49).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_14

- Phạm vi: lát L0, L1 (khởi tạo kế toán theo chế độ của công ty, hệ thống tài khoản Thông tư 99/2025 và Thông tư 133/2016, tài khoản chi tiết, định khoản mặc định; bút toán tự sinh từ phiếu kho, phiếu thu chi, ghi tổn thất hàng thiếu nội bộ; phiếu kế toán qua luồng duyệt; khóa sổ, kết chuyển, mở lại; bảng cân đối số phát sinh, sổ cái; làm tròn chung công nợ và bút toán theo THAY_DOI_10); MAN_HINH_50 đến 52; API_87 đến 89, sửa API_20. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0011 trên cơ sở dữ liệu phát triển; thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): khởi tạo kế toán tạo bút toán cho chứng từ cũ, định khoản mặc định, danh sách và chi tiết bút toán, lập phiếu kế toán số dư đầu kỳ, bảng cân đối số phát sinh (cân ở mọi cột, số tiền làm tròn đến đồng), sổ cái, khóa sổ (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang).
- Kết quả: 229 đạt / 0 không đạt / 229 kịch bản tự động (28 tệp; phần mới: `c14-ledger` 6, KICHBAN_KIEMTHU_210 đến 214, 217). KICHBAN_KIEMTHU_215, 216 (thủ công trên trình duyệt) đạt.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_111 đến 116 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 49): không có phát hiện.
  - C3 phân quyền: Đạt – quyền kế toán cần phạm vi công ty; khóa sổ là quyền nhạy cảm; nhân viên bán hàng không xem, không lập được.
  - C4 toàn vẹn dữ liệu: Đạt – bút toán sinh cùng giao dịch ghi sổ chứng từ, kiểm cân Nợ Có; kỳ đã khóa chặn mọi đường ghi sổ có bút toán; khóa sổ và ghi sổ loại trừ nhau.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 1 lỗi Cao (khởi tạo tạo bút toán cho phiếu nhập nội bộ chưa nhận làm không nhận hàng được), 6 mục Trung bình, 7 mục Thấp; đã sửa lỗi Cao, các mục Trung bình (làm tròn theo quyết định người dùng) và 4 mục Thấp. Giữ lại (ghi tài liệu 22): danh mục tài khoản Thông tư 99/2025 lập từ bản chép Phụ lục II, phải so bản gốc trước khi phát hành; chuyển kho trong kỳ đã khóa chưa bị chặn (không sinh bút toán); 3388 là tài khoản tạm đối ứng nhập tồn đầu kỳ.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận định khoản mặc định và các điểm AI tự quyết; so danh mục Thông tư 99/2025 với bản gốc là việc trước khi phát hành; chờ người dùng hợp nhất pull request số 49 (sau số 48).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_13

- Phạm vi: lát L0, L1 (quỹ, sổ quỹ; công nợ tự phát sinh từ phiếu xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp; tính lại phiếu cũ khi chạy database migration; số dư đầu kỳ; tuổi nợ; phiếu thu, phiếu chi trừ theo chứng từ, trả trước, hoàn tiền, phiếu chi qua luồng duyệt; ghi tổn thất hàng thiếu nội bộ giảm phải thu; đơn bán kiểm hạn mức theo dư nợ thật theo THAY_DOI_09); mini app `apps/web-finance`, MAN_HINH_46 đến 49; API_84 đến 86, sửa API_77. Hồi quy: toàn bộ kiểm thử tự động của dự án.
- Môi trường: máy phát triển trong container; PostgreSQL 16, cơ sở dữ liệu `vcomm_test`; Redis 7; Node.js 22.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter i18n test`, `pnpm audit --prod --audit-level high`; database migration 0010 trên cơ sở dữ liệu phát triển (tính lại 11 khoản công nợ của phiếu cũ, trả hàng trừ đúng phiếu gốc); thử trên trình duyệt bằng Playwright (Quản trị công ty VCR): công nợ phải thu, phải trả, tuổi nợ, nhập số dư đầu kỳ, quỹ, sổ quỹ, lập phiếu thu chia từ cũ nhất, phiếu chi (máy tính và điện thoại 375 điểm ảnh, không cuộn ngang).
- Kết quả: 223 đạt / 0 không đạt / 223 kịch bản tự động (27 tệp; phần mới: `c13-debts` 6, KICHBAN_KIEMTHU_201 đến 206; KICHBAN_KIEMTHU_209 trong `c9-internal-trade`). KICHBAN_KIEMTHU_207, 208 (thủ công trên trình duyệt) đạt. KICHBAN_KIEMTHU_183, 184 vẫn đạt với dư nợ thật.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_105 đến 110 (bắt buộc) – Đạt.
- Kiểm tra bảo mật phần B, C:
  - C1 `pnpm audit --prod --audit-level high`: không có lỗ hổng đã biết. Không thêm thư viện.
  - C2 gitleaks trong CI trên các commit của công việc (pull request số 48): không có phát hiện.
  - C3 phân quyền: Đạt – quyền tài chính cần phạm vi công ty; nhân viên bán hàng không xem, không lập được; chi tiết công nợ chỉ cho đối tác có quan hệ với công ty.
  - C4 toàn vẹn dữ liệu: Đạt – công nợ tạo cùng giao dịch ghi sổ phiếu kho; trừ nợ tuần tự theo khóa đối tác, không vượt số còn lại; ghi sổ phiếu chi khóa quỹ rồi mới tính số dư.
- Tự rà soát mã và dọn dẹp: Đạt. Rà soát độc lập tìm 1 lỗi Cao (hai phiếu chi đồng thời làm quỹ âm), 1 lỗi Trung bình (xóa số dư đầu kỳ đang được chọn lỗi máy chủ), 3 lỗi Thấp; đã sửa cả. Rà soát bảo mật tài liệu 22 sửa thêm 2 điểm Thấp. Giữ lại (ghi tài liệu 22): so sánh tiền dùng số thực với sai số 0,00005 (giá trị rất lớn có thể lệch chữ số lẻ cuối, dữ liệu lưu đúng); ghi sổ phiếu chi sau duyệt không ghi dòng nhật ký riêng; phiếu chi ghi ngày quá khứ chỉ kiểm số dư quỹ hiện tại.
- Kết luận cổng kiểm thử: Đạt (không có lỗi Nghiêm trọng, Cao chưa xử lý; mọi tiêu chí bắt buộc trong phạm vi đạt).
- Kết luận: Người dùng nghiệm thu 2026-11-10, chấp nhận các điểm AI tự quyết; chờ người dùng hợp nhất pull request số 48 (sau số 47).

## Lần kiểm thử 2026-11-10 – CONG_VIEC_10 (LOI_04)

- Phạm vi: hàm tải dữ liệu dùng chung `useApi` (packages/ui). Hồi quy: kiểm tra kiểu, lint toàn dự án.
- Lệnh đã chạy: `pnpm typecheck`, `pnpm lint`; Playwright trên MAN_HINH_35: làm chậm phản hồi bộ lọc mặc định 3 giây rồi đổi bộ lọc ngay.
- Kết quả: trước khi sửa, danh sách hiện kết quả bộ lọc cũ (1 dòng thay vì 0); sau khi sửa, hiện đúng kết quả bộ lọc mới (0 dòng). Kết quả mong đợi trong tài liệu 03 – Đạt.
- Kiểm tra bảo mật phần B, C: không thêm thư viện; gitleaks trong CI trên pull request số 45. Thay đổi chỉ ở giao diện, không đổi phân quyền, dữ liệu.
- Tự rà soát mã và dọn dẹp: Đạt.
- Kết luận cổng kiểm thử: Đạt. Chờ người dùng nghiệm thu.

## Lỗi phát hiện 2026-11-10

| Mã lỗi | Mô tả | Mức độ | Kịch bản liên quan | Quyết định xử lý | Trạng thái |
|---|---|---|---|---|---|
| LOI_03 | KICHBAN_KIEMTHU_149 (CONG_VIEC_05) lỗi không đều trên CI: hai phiếu xuất đồng thời tranh món hàng cuối, phiếu thua nhận `400` khi bị chặn ở bước kiểm tra trước, nhận `409` khi bị chặn trong khóa giữ hàng. Dữ liệu đúng trong cả hai trường hợp (chỉ một phiếu giữ hàng); kiểm thử chờ cố định `409` nên thất bại theo thời điểm, kéo theo KICHBAN_KIEMTHU_152 | Thấp | KICHBAN_KIEMTHU_149 | Thống nhất trả `400` "Không đủ hàng khả dụng (một phần đang được giữ)." gắn vào dòng hàng, sửa kiểm thử chờ `400` (người dùng quyết định 2026-11-10) | Mở |
| LOI_04 | Hàm tải dữ liệu dùng chung của giao diện (`useApi`) không bỏ phản hồi cũ: đổi bộ lọc nhanh trên danh sách thì phản hồi của bộ lọc trước về sau ghi đè kết quả mới (thấy khi thử MAN_HINH_44, có ở mọi mini app) | Thấp | KICHBAN_KIEMTHU_192 | Sửa hàm tải dữ liệu: chỉ nhận phản hồi của lần gọi mới nhất (người dùng quyết định 2026-11-10) | Đã sửa (pull request số 45), chờ nghiệm thu |
| LOI_05 | Bước chuẩn bị của tệp kiểm thử API (dựng lại cơ sở dữ liệu thử, chạy toàn bộ database migration) đôi khi vượt giới hạn mặc định 10 giây trên CI, cả tệp bị bỏ qua (`l8-settings` trên pull request số 40, commit chỉ có tài liệu; một lần ở máy phát triển khi làm CONG_VIEC_08) | Thấp | Toàn bộ kiểm thử tự động | Nâng giới hạn thời gian bước chuẩn bị lên 60 giây, không đổi nội dung kiểm thử; đã sửa (pull request số 46, 186/186 đạt), chờ nghiệm thu | Đã sửa |
