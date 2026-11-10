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
