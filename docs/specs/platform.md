# Đặc tả mini app Nền tảng (`platform`)

Trạng thái: **Bản nháp, chờ duyệt**. Mô hình dữ liệu: [`../data-model/core.sql`](../data-model/core.sql).

Nền tảng là mini app đầu tiên của ERP VComm. Mọi mini app khác (Sản phẩm, Kho, Mua hàng, Kế toán, Nhân sự…) đều dựa vào nó để biết **ai đang dùng, thuộc công ty nào, được làm gì, và ai duyệt chứng từ**. Không có tính năng bán hàng hay kho nào ở đây.

## 1. Phạm vi

| Có trong Nền tảng | Không có (thuộc mini app khác) |
| --- | --- |
| Công ty, chi nhánh, phòng ban | Hồ sơ nhân sự, hợp đồng, lương (`hr`) |
| Người dùng, đăng nhập, OTP, phiên | Khách hàng, nhà cung cấp, seller (`crm`, `catalog`) |
| Vai trò, quyền, gán vai trò theo phạm vi | Kho, vị trí kệ (`inventory`) |
| Trang chủ mini app (app launcher) | Hệ thống tài khoản kế toán (`finance`) |
| Hạn mức duyệt chứng từ, hộp duyệt | Nội dung chứng từ được duyệt |
| Đánh số chứng từ, tiền tệ, tỷ giá | Hạch toán chênh lệch tỷ giá (`finance`) |
| Nhật ký thao tác, outbox sự kiện | |

## 2. Người dùng của mini app

| Vai trò | Làm gì |
| --- | --- |
| Quản trị tập đoàn (super admin) | Tạo công ty, cấu hình chung, xem nhật ký toàn tập đoàn |
| Quản trị công ty | Quản lý chi nhánh, phòng ban, người dùng, vai trò, hạn mức duyệt trong công ty mình |
| Mọi nhân viên | Đăng nhập, đổi mật khẩu, bật OTP, chọn ngôn ngữ, chuyển công ty, duyệt chứng từ được giao |

## 3. Tính năng

### 3.1 Tổ chức

- **Công ty (pháp nhân):** dạng cây, công ty mẹ ở gốc. Mỗi công ty có mã số thuế, tiền tệ hạch toán (mặc định VND), chế độ kế toán (TT200), tháng bắt đầu năm tài chính.
- **Chi nhánh:** thuộc một công ty. Có loại: trụ sở, văn phòng, kho, cửa hàng. Mã chi nhánh duy nhất trong công ty.
- **Phòng ban:** dạng cây trong một công ty, có trưởng phòng (dùng cho cấp duyệt "trưởng phòng").
- Không xóa công ty/chi nhánh/phòng ban đã có dữ liệu, chỉ chuyển sang `inactive`.

### 3.2 Người dùng và đăng nhập

- Một người dùng có thể có **nhiều cách đăng nhập** cùng lúc (bảng `user_identities`):
  - tên đăng nhập hoặc email + mật khẩu;
  - Google Workspace / Microsoft 365 (OpenID Connect);
  - số điện thoại + OTP SMS, cho nhân viên kho/cửa hàng không có email công ty.
- **OTP 2 lớp** (ứng dụng xác thực TOTP, hoặc SMS/email). Bắt buộc khi người dùng có bất kỳ quyền nào đánh dấu `is_sensitive` (ví dụ: quyền kế toán, quản trị). Hệ thống tự bật `mfa_required` khi gán vai trò đó.
- **Mật khẩu:** băm bằng argon2id; tối thiểu 10 ký tự; khóa tạm 15 phút sau 5 lần sai liên tiếp.
- **Phiên:** access token sống 15 phút, refresh token 30 ngày (web) và 90 ngày (app kho, app kinh doanh). Chỉ lưu bản băm của refresh token. Admin thu hồi được từng phiên hoặc mọi phiên của một người.
- **Mời người dùng:** admin tạo tài khoản ở trạng thái `invited`, hệ thống gửi link kích hoạt (email hoặc SMS) có hạn 72 giờ.
- **Nhiều công ty:** một người có thể thuộc nhiều công ty (`user_company_memberships`), có một công ty mặc định. Chuyển công ty ở thanh trên cùng, không phải đăng nhập lại.
- **Ngôn ngữ:** tiếng Việt và tiếng Anh, mỗi người tự chọn.

### 3.3 Phân quyền

Mô hình: **quyền → vai trò → gán vai trò cho người dùng trong một phạm vi**.

- **Quyền** có dạng `<app>.<đối tượng>.<hành động>`, ví dụ `inventory.stock_receipt.approve`. Quyền do code khai báo và tự đồng bộ vào bảng khi triển khai; admin chỉ chọn, không tạo tay.
- Mỗi mini app có một quyền `<app>.access`. Không có quyền này thì app không hiện trên trang chủ.
- **Vai trò** là nhóm quyền do admin đặt tên. Có vai trò dùng chung toàn tập đoàn và vai trò riêng một công ty.
- **Gán vai trò theo phạm vi:**

| Phạm vi | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `group` | Toàn tập đoàn, mọi công ty | Kiểm toán nội bộ xem được mọi công ty |
| `company` | Một công ty, mọi chi nhánh của nó | Kế toán trưởng VComm Retail |
| `branch` | Một chi nhánh | Thủ kho kho Bình Dương |

- Gán vai trò có thể có thời hạn (`valid_from`, `valid_to`), dùng khi ủy quyền lúc nghỉ phép.
- **Cách kiểm tra quyền:** một thao tác trên dữ liệu của công ty C, chi nhánh B được phép khi người dùng có quyền đó qua một trong các lần gán: phạm vi `group`; phạm vi `company` = C; hoặc phạm vi `branch` = B.
- Mọi API phải lọc dữ liệu theo phạm vi ngay ở truy vấn, không lọc sau khi đã tải về.

### 3.4 Trang chủ mini app

- Sau khi đăng nhập, người dùng thấy lưới các mini app mình có quyền `<app>.access` trong công ty đang chọn.
- Mỗi ô có biểu tượng, tên (theo ngôn ngữ), và số việc chờ xử lý (ví dụ: 3 chứng từ chờ duyệt).
- Thanh trên cùng dùng chung mọi mini app: logo, chuyển app, chuyển công ty, chuông thông báo, hộp duyệt, hồ sơ cá nhân.

### 3.5 Duyệt chứng từ theo hạn mức

- Mỗi mini app đăng ký **loại chứng từ** cần duyệt, ví dụ `purchasing.purchase_order`, `finance.payment`.
- Với mỗi công ty × loại chứng từ, admin cấu hình **chính sách duyệt** có hiệu lực theo ngày, gồm các cấp:

| Cấp | Áp dụng khi giá trị ≥ | Người duyệt |
| --- | --- | --- |
| 1 | 0 đ | Trưởng phòng của người lập |
| 2 | 50.000.000 đ | Vai trò "Giám đốc công ty" |
| 3 | 500.000.000 đ | Người cụ thể: Tổng giám đốc |

  (Số tiền trong bảng là ví dụ, admin tự đặt.)
- Chứng từ phải qua **lần lượt mọi cấp có ngưỡng ≤ giá trị chứng từ**. Ví dụ đơn mua 80 triệu qua cấp 1 rồi cấp 2.
- Chứng từ bằng ngoại tệ được quy đổi theo tỷ giá hạch toán ngày lập để so với ngưỡng.
- Một cấp từ chối thì cả yêu cầu bị từ chối; người lập sửa và gửi lại, tạo yêu cầu mới.
- Người lập không được tự duyệt chứng từ của mình, kể cả khi có vai trò duyệt.
- **Hộp duyệt** chung hiện mọi chứng từ đang chờ mình, từ mọi mini app, duyệt được trên điện thoại.
- Nền tảng chỉ quản lý luồng duyệt. Khi duyệt xong, Nền tảng phát sự kiện `core.approval.completed`, mini app sở hữu chứng từ tự cập nhật trạng thái của nó.

### 3.6 Đánh số chứng từ

- Số chứng từ có dạng `<tiền tố>-<mã công ty>-<kỳ>-<số thứ tự>`, ví dụ `PN-VCR-2026-000123`.
- Mỗi công ty × loại chứng từ có một dãy số, đặt lại theo năm, theo tháng, hoặc không bao giờ.
- Lấy số trong cùng giao dịch với việc tạo chứng từ, không bị trùng và không bị nhảy số khi lỗi.

### 3.7 Tiền tệ và tỷ giá

- Danh mục tiền tệ (VND, USD, CNY, EUR…).
- Tỷ giá theo ngày, theo loại (mua, bán, chuyển khoản, hạch toán) và theo nguồn. Nhập tay hoặc tự lấy từ ngân hàng mỗi sáng (job nền).
- Mini app Kế toán dùng dữ liệu này để hạch toán chênh lệch tỷ giá.

### 3.8 Nhật ký thao tác

- Mọi thao tác ghi dữ liệu (tạo, sửa, duyệt, đăng nhập, đổi quyền…) ghi một dòng vào `audit_events`, kèm dữ liệu trước và sau.
- Chỉ thêm, không sửa, không xóa. Chia partition theo tháng; giữ tối thiểu 10 năm cho dữ liệu kế toán.
- Admin tra cứu được theo người, theo đối tượng, theo khoảng thời gian.

### 3.9 Sự kiện giữa các mini app (outbox)

- Thay đổi quan trọng ghi một sự kiện vào `outbox_events` **trong cùng giao dịch** với dữ liệu.
- Một worker đẩy sự kiện sang SQS/SNS và đánh dấu đã gửi; gửi lại nếu lỗi.
- Sự kiện của Nền tảng: `core.user.created`, `core.user.disabled`, `core.company.created`, `core.branch.created`, `core.role_assignment.changed`, `core.approval.completed`.

## 4. Màn hình

| # | Màn hình | Ai dùng |
| --- | --- | --- |
| 1 | Đăng nhập (mật khẩu / Google / Microsoft / số điện thoại), nhập OTP | Mọi người |
| 2 | Kích hoạt tài khoản, quên mật khẩu | Mọi người |
| 3 | Trang chủ mini app | Mọi người |
| 4 | Hồ sơ cá nhân: ngôn ngữ, mật khẩu, OTP, phiên đang đăng nhập | Mọi người |
| 5 | Hộp duyệt | Người duyệt |
| 6 | Cây công ty → chi nhánh → phòng ban | Quản trị |
| 7 | Danh sách người dùng: lọc, mời, khóa, thu hồi phiên, nhập Excel | Quản trị |
| 8 | Chi tiết người dùng: công ty, vai trò theo phạm vi | Quản trị |
| 9 | Vai trò: danh sách, ma trận quyền theo mini app | Quản trị |
| 10 | Chính sách duyệt theo loại chứng từ | Quản trị |
| 11 | Dãy số chứng từ | Quản trị |
| 12 | Tiền tệ, tỷ giá | Quản trị, kế toán |
| 13 | Nhật ký thao tác | Quản trị |

## 5. Yêu cầu phi chức năng

- Đăng nhập và kiểm tra quyền trả lời dưới 200 ms ở phân vị 95. Quyền của người dùng được cache trong Redis và xóa cache khi đổi vai trò.
- Mọi API qua HTTPS. Cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`.
- Bí mật OTP mã hóa bằng AWS KMS.
- Mọi chuỗi giao diện nằm trong file dịch `vi` và `en`, không viết cứng trong code.
- Giao diện dùng được trên điện thoại (từ 360 px).

## 6. Tiêu chí nghiệm thu

- [ ] Tạo được tập đoàn với 2 công ty con, mỗi công ty 2 chi nhánh.
- [ ] Một người dùng thuộc 2 công ty, chuyển qua lại không phải đăng nhập lại.
- [ ] Đăng nhập được bằng mật khẩu, Google và số điện thoại với cùng một tài khoản.
- [ ] Gán vai trò kế toán (quyền nhạy cảm) → lần đăng nhập sau bắt buộc OTP.
- [ ] Thủ kho chi nhánh A không xem được dữ liệu chi nhánh B qua API (có test tự động).
- [ ] Đơn mua 80 triệu đi qua đúng cấp 1 và cấp 2; người lập không tự duyệt được.
- [ ] Hai người tạo chứng từ cùng lúc nhận hai số liên tiếp, không trùng.
- [ ] Mọi thao tác trên đều có dòng trong nhật ký thao tác.
- [ ] Toàn bộ giao diện chuyển được sang tiếng Anh.

## 7. Câu hỏi còn mở

- [ ] Có dùng SMS brandname riêng cho OTP không, nhà cung cấp nào?
- [ ] Nguồn tỷ giá tự động: Vietcombank hay ngân hàng đối tác?
- [ ] Thời gian lưu nhật ký thao tác ngoài 10 năm cho dữ liệu kế toán?
