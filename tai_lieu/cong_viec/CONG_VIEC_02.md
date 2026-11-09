# CONG_VIEC_02: Xây dựng mini app Nền tảng

- Module: MODULE_01 Nền tảng
- Mức quy mô: Lớn (module mới, dự án mới)
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt kế hoạch lát ngày 2026-11-09. Lát L6 bị chặn đến khi có Zalo Official Account, mã ứng dụng Google, Microsoft, Zalo và nhà cung cấp SMS.
- Nội dung nghiệp vụ đã được tách vào tài liệu `06` đến `11` và `27` ngày 2026-11-09. Khi hai nơi khác nhau, tài liệu đánh số là chuẩn.

## 1. Mục tiêu

Cung cấp nền chung cho mọi mini app: biết ai đang dùng, thuộc công ty nào, được làm gì, ai duyệt chứng từ.

## 2. Phạm vi

| Trong phạm vi | Ngoài phạm vi (thuộc module khác) |
|---|---|
| Công ty, chi nhánh, phòng ban | Hồ sơ nhân sự, hợp đồng, lương (MODULE_08) |
| Người dùng, đăng nhập, xác thực hai lớp, phiên | Khách hàng, nhà cung cấp, nhà bán (MODULE_07, MODULE_02) |
| Vai trò, quyền, gán vai trò theo phạm vi | Kho, vị trí kệ (MODULE_03) |
| Trang chủ mini app | Hệ thống tài khoản kế toán (MODULE_06) |
| Duyệt chứng từ theo hạn mức, hộp duyệt | Nội dung chứng từ được duyệt |
| Đánh số chứng từ, tiền tệ, tỷ giá | Hạch toán chênh lệch tỷ giá (MODULE_06) |
| Nhật ký thao tác, outbox sự kiện | |

## 3. Yêu cầu nghiệp vụ

1. Tập đoàn quản lý nhiều công ty con dạng cây; mỗi công ty có mã số thuế, tiền tệ hạch toán (mặc định VND), chế độ kế toán (Thông tư 99/2025), tháng bắt đầu năm tài chính.
2. Chi nhánh thuộc một công ty, có loại: trụ sở, văn phòng, kho, cửa hàng. Mã chi nhánh duy nhất trong công ty.
3. Phòng ban dạng cây trong một công ty, có trưởng phòng.
4. Một người dùng đăng nhập được bằng nhiều cách: tên đăng nhập hoặc email kèm mật khẩu; Google Workspace hoặc Microsoft 365; số điện thoại kèm mã OTP gửi qua SMS.
5. Một người dùng thuộc được nhiều công ty, có một công ty mặc định, chuyển công ty không phải đăng nhập lại.
6. Admin mời người dùng; người dùng kích hoạt qua đường dẫn gửi bằng email hoặc SMS.
7. Phân quyền theo vai trò, gán trong phạm vi tập đoàn, công ty hoặc chi nhánh; có thể có thời hạn để ủy quyền khi nghỉ phép.
8. Trang chủ hiện các mini app người dùng có quyền truy cập trong công ty đang chọn, kèm số việc chờ xử lý.
9. Chứng từ của các mini app được duyệt theo hạn mức cấu hình cho từng công ty và loại chứng từ.
10. Hộp duyệt chung hiện mọi chứng từ đang chờ người dùng duyệt, dùng được trên điện thoại.
11. Chứng từ được đánh số tự động theo công ty, loại chứng từ, kỳ.
12. Quản lý tiền tệ và tỷ giá theo ngày.
13. Ghi nhật ký mọi thao tác ghi dữ liệu.
14. Giao diện tiếng Việt và tiếng Anh, mỗi người tự chọn.

## 4. Quy tắc nghiệp vụ

1. Không xóa công ty, chi nhánh, phòng ban đã có dữ liệu; chỉ chuyển sang ngừng hoạt động.
2. Quyền có dạng `<app>.<đối tượng>.<hành động>`, do mã nguồn khai báo; admin chỉ chọn, không tạo tay.
3. Mỗi mini app có quyền `<app>.access`; không có quyền này thì mini app không hiện trên trang chủ.
4. Một thao tác trên dữ liệu của công ty C, chi nhánh B được phép khi người dùng có quyền đó qua một lần gán vai trò còn hiệu lực có phạm vi: tập đoàn; hoặc công ty C; hoặc chi nhánh B.
5. Người dùng có bất kỳ quyền nào được đánh dấu nhạy cảm (ví dụ kế toán, quản trị) bắt buộc xác thực hai lớp; hệ thống tự bật khi gán vai trò.
6. Mật khẩu tối thiểu 10 ký tự; khóa đăng nhập 15 phút sau 5 lần sai liên tiếp.
7. Đường dẫn kích hoạt hết hạn sau 72 giờ.
8. Chứng từ phải qua lần lượt mọi cấp duyệt có ngưỡng nhỏ hơn hoặc bằng giá trị chứng từ. Ví dụ với các cấp 0 đồng, 50 triệu đồng, 500 triệu đồng: đơn mua 80 triệu đồng qua cấp 1 rồi cấp 2.
9. Chứng từ bằng ngoại tệ quy đổi theo tỷ giá hạch toán ngày lập để so với ngưỡng.
10. Một cấp từ chối thì cả yêu cầu bị từ chối; người lập sửa và gửi lại thành yêu cầu mới.
11. Người lập không được duyệt chứng từ của chính mình, kể cả khi có vai trò duyệt.
12. Số chứng từ có dạng `<tiền tố>-<mã công ty>-<kỳ>-<số thứ tự>`, ví dụ `PN-VCR-2026-000123`; đặt lại theo năm, theo tháng hoặc không bao giờ; không trùng, không nhảy số khi lỗi.
13. Nhật ký thao tác chỉ thêm, không sửa, không xóa; giữ tối thiểu 10 năm cho dữ liệu kế toán.

## 5. Dữ liệu liên quan

Schema `core` trong tài liệu `16`.

## 6. Giao diện liên quan

| Màn hình | Người dùng |
|---|---|
| Đăng nhập (mật khẩu, Google, Microsoft, số điện thoại), nhập mã OTP | Mọi người |
| Kích hoạt tài khoản, quên mật khẩu | Mọi người |
| Trang chủ mini app | Mọi người |
| Hồ sơ cá nhân: ngôn ngữ, mật khẩu, xác thực hai lớp, phiên đang đăng nhập | Mọi người |
| Hộp duyệt | Người duyệt |
| Cây công ty, chi nhánh, phòng ban | Quản trị |
| Danh sách người dùng: lọc, mời, khóa, thu hồi phiên, nhập Excel | Quản trị |
| Chi tiết người dùng: công ty, vai trò theo phạm vi | Quản trị |
| Vai trò: danh sách, ma trận quyền theo mini app | Quản trị |
| Chính sách duyệt theo loại chứng từ | Quản trị |
| Dãy số chứng từ | Quản trị |
| Tiền tệ, tỷ giá | Quản trị, kế toán |
| Nhật ký thao tác | Quản trị |

Mã màn hình `MAN_HINH_<số>` cấp ở giai đoạn 06.

## 7. API liên quan

Chưa thiết kế; lập ở giai đoạn 07 trong tài liệu `17`.

## 8. Phân quyền

| Vai trò | Được làm |
|---|---|
| Quản trị tập đoàn | Tạo công ty, cấu hình chung, xem nhật ký toàn tập đoàn |
| Quản trị công ty | Quản lý chi nhánh, phòng ban, người dùng, vai trò, chính sách duyệt trong công ty mình |
| Mọi nhân viên | Đăng nhập, đổi mật khẩu, bật xác thực hai lớp, chọn ngôn ngữ, chuyển công ty, duyệt chứng từ được giao |

## 9. Điều kiện đặc biệt

- Phiên: token truy cập sống 15 phút; token làm mới sống 30 ngày (web) và 90 ngày (ứng dụng kho, ứng dụng kinh doanh); chỉ lưu bản băm token làm mới; admin thu hồi được từng phiên hoặc mọi phiên của một người.
- Cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`.
- Đăng nhập và kiểm tra quyền trả lời dưới 200 mili giây ở phân vị 95; quyền được lưu đệm trong Redis, xóa khi đổi vai trò.
- Giao diện dùng được trên điện thoại từ 360 điểm ảnh.
- Khi duyệt xong, Nền tảng phát sự kiện `core.approval.completed`; mini app sở hữu chứng từ tự cập nhật trạng thái chứng từ.
- Sự kiện của Nền tảng: `core.user.created`, `core.user.disabled`, `core.company.created`, `core.branch.created`, `core.role_assignment.changed`, `core.approval.completed`.
- Tỷ giá nhập tay hoặc tự lấy từ ngân hàng mỗi sáng.

## 10. Tiêu chí nghiệm thu

| Nội dung | Loại |
|---|---|
| Tạo được tập đoàn với 2 công ty con, mỗi công ty 2 chi nhánh | Bắt buộc |
| Một người dùng thuộc 2 công ty chuyển qua lại không phải đăng nhập lại | Bắt buộc |
| Cùng một tài khoản đăng nhập được bằng mật khẩu, Google và số điện thoại | Bắt buộc |
| Gán vai trò có quyền nhạy cảm thì lần đăng nhập sau bắt buộc mã OTP | Bắt buộc |
| Thủ kho chi nhánh A không xem được dữ liệu chi nhánh B qua API (có kiểm thử tự động) | Bắt buộc |
| Đơn mua 80 triệu đồng đi qua đúng cấp 1 và cấp 2; người lập không tự duyệt được | Bắt buộc |
| Hai người tạo chứng từ cùng lúc nhận hai số liên tiếp, không trùng | Bắt buộc |
| Mọi thao tác trên có dòng trong nhật ký thao tác | Bắt buộc |
| Toàn bộ giao diện chuyển được sang tiếng Anh | Bắt buộc |

## 11. Kịch bản kiểm thử

Lập ở tài liệu `21` sau giai đoạn 04.

## 12. Ràng buộc kỹ thuật

Tài liệu `12`, `13`. Băm mật khẩu bằng argon2id; bí mật xác thực hai lớp mã hóa bằng AWS KMS.

## 13. Thành phần không được thay đổi

Không áp dụng (chưa có mã nguồn).

## 14. Các lát và điểm xem trước

Người dùng duyệt ngày 2026-11-09. Mỗi lát chạy được từ giao diện tới cơ sở dữ liệu, có kiểm thử tự động. Sau mỗi lát, AI dừng ở điểm xem trước. Thứ tự ưu tiên điều dễ hiểu sai nhất: đăng nhập và phân quyền theo phạm vi trước.

| Lát | Nội dung | Màn hình, API | Tiêu chí nghiệm thu | Điểm xem trước: người dùng xem gì, thử gì |
|---|---|---|---|---|
| L1 | Dựng `apps/api` (NestJS), `apps/web-platform` (Next.js), `packages/ui` (biến từ tài liệu `15`), `packages/i18n`, `packages/contracts`. Database migration schema `core`, dữ liệu thử. Đăng nhập bằng mật khẩu, phiên, trang chủ mini app | MAN_HINH_01, MAN_HINH_05; API_01, API_09, API_10, API_14, API_19 | TIEUCHI_NGHIEMTHU_10, 11, 27 | Đăng nhập bằng 2 tài khoản thử khác vai trò, thấy trang chủ khác nhau; nhập sai 5 lần bị khóa |
| L2 | Vai trò, quyền, gán vai trò theo phạm vi; lọc dữ liệu theo phạm vi trong truy vấn; chuyển công ty | MAN_HINH_13 (thẻ Vai trò), MAN_HINH_14; API_14, API_34, API_35, API_36 | TIEUCHI_NGHIEMTHU_19 đến 26 | Gán vai trò có thời hạn; thủ kho chi nhánh A không xem được dữ liệu chi nhánh B |
| L3 | Công ty, chi nhánh, phòng ban | MAN_HINH_09, 10, 11; API_20 đến 23 | TIEUCHI_NGHIEMTHU_01 đến 05 | Tạo tập đoàn 2 công ty con, mỗi công ty 2 chi nhánh |
| L4 | Mời, kích hoạt, nhập Excel, khóa nhân viên (email, SMS ghi ra log) | MAN_HINH_03, 12, 13; API_11, API_24 đến 30 | TIEUCHI_NGHIEMTHU_06 đến 09 | Mời một nhân viên, mở đường dẫn kích hoạt từ log; nhập tệp Excel có dòng lỗi |
| L5 | Xác thực hai lớp, quên mật khẩu, hồ sơ cá nhân, phiên đăng nhập | MAN_HINH_02, 04, 06; API_06, 07, 08, 12, 13, 15 đến 18 | TIEUCHI_NGHIEMTHU_12, 15 đến 18 | Bật xác thực hai lớp bằng ứng dụng điện thoại; thu hồi một phiên |
| L6 | Đăng nhập Google, Microsoft, Zalo, số điện thoại | MAN_HINH_01, 06; API_02 đến 05, API_17 | TIEUCHI_NGHIEMTHU_13, 14, 46, 47 | Liên kết và đăng nhập bằng từng cách. **Bị chặn** đến khi có mã ứng dụng Google, Microsoft, Zalo và nhà cung cấp SMS |
| L7 | Chính sách duyệt, gửi duyệt, hộp duyệt, chi tiết, rút lại, nhắc và chuyển quá hạn (tác vụ nền). Dùng loại chứng từ thử `platform.test_document` vì chưa có module khác | MAN_HINH_07, 08, 15; API_37 đến 42 | TIEUCHI_NGHIEMTHU_28 đến 36 | Gửi chứng từ thử 80 triệu đồng, duyệt qua 2 cấp; tự duyệt bị chặn; chỉnh đồng hồ thử để thấy nhắc và chuyển |
| L8 | Dãy số chứng từ, tỷ giá, nhật ký thao tác, thông báo, vô hiệu hóa và bàn giao | MAN_HINH_16, 17, 18; API_31, 32, 33, 43 đến 48 | TIEUCHI_NGHIEMTHU_37 đến 44 | 2 người lưu chứng từ cùng lúc nhận số liên tiếp; xem nhật ký trước và sau; vô hiệu hóa kèm bàn giao |

Tiêu chí TIEUCHI_NGHIEMTHU_42 (tiếng Anh) và TIEUCHI_NGHIEMTHU_45 (hiệu năng) kiểm tra ở lát cuối trên toàn bộ màn hình.

Điều kiện trước khi bắt đầu L1:
- Giai đoạn 08 được duyệt (tài liệu `18`, `19`).
- Chốt phiên bản TypeScript (tài liệu `18` mục 3).
- Duyệt hoặc từ chối THAY_DOI_03 (chế độ kế toán), vì ảnh hưởng database migration bảng `core.companies`.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.

## 16. Câu hỏi còn mở

- **CHƯA XÁC ĐỊNH:** có dùng SMS brandname riêng cho mã OTP không, nhà cung cấp nào.
- **CHƯA XÁC ĐỊNH:** nguồn tỷ giá tự động: Vietcombank hay ngân hàng đối tác.
- **CHƯA XÁC ĐỊNH:** thời gian lưu nhật ký thao tác ngoài dữ liệu kế toán.
