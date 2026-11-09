# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò mặc định, trách nhiệm và quyền hạn.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_05 (2026-11-10): thêm vai trò Thủ kho, Quản lý kho của MODULE_03 (mục 4, 5)

## 1. Nguyên tắc

- Vai trò là nhóm quyền. Quản trị tự tạo thêm vai trò; bảng dưới là các vai trò hệ thống có sẵn, không xóa được.
- "Người duyệt" không phải vai trò: một nhân viên là người duyệt khi được chỉ định trong một cấp duyệt (QUYTAC_NGHIEPVU_20).
- Vai trò của các module sau được bổ sung vào tài liệu này khi phân tích module đó.

## 2. Vai trò hệ thống của MODULE_01

| Vai trò | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|
| Quản trị tập đoàn | Tập đoàn | Tạo công ty, vai trò dùng chung, xem nhật ký toàn tập đoàn | Mọi quyền của `platform` | Có |
| Quản trị công ty | Công ty | Quản lý chi nhánh, phòng ban, nhân viên, vai trò riêng, chính sách duyệt, dãy số chứng từ của công ty | Quyền `platform` trong công ty, trừ tạo công ty và vai trò dùng chung; quyền truy cập mọi mini app (THAY_DOI_06) | Có |
| Quản lý tỷ giá | Tập đoàn hoặc công ty | Nhập, sửa tỷ giá | `platform.exchange_rate.*` | Có |
| Nhân viên | Công ty | Đăng nhập, quản lý hồ sơ cá nhân, chuyển công ty, duyệt chứng từ được giao | `platform.access`, `platform.profile.*`, `platform.approval.decide` | Không |

## 3. Ma trận vai trò – thao tác

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Quản lý tỷ giá | Nhân viên |
|---|---|---|---|---|
| Tạo, sửa công ty | Có | Không | Không | Không |
| Tạo, sửa chi nhánh, phòng ban | Có | Trong công ty mình | Không | Không |
| Mời, khóa, vô hiệu hóa nhân viên | Có | Trong công ty mình | Không | Không |
| Tạo vai trò dùng chung tập đoàn | Có | Không | Không | Không |
| Tạo vai trò riêng công ty | Có | Trong công ty mình | Không | Không |
| Gán vai trò | Mọi phạm vi | Phạm vi công ty mình, chi nhánh của công ty | Không | Không |
| Cấu hình chính sách duyệt | Có | Trong công ty mình | Không | Không |
| Cấu hình dãy số chứng từ | Có | Trong công ty mình | Không | Không |
| Nhập, sửa tỷ giá | Có | Không | Có | Không |
| Xem nhật ký thao tác | Toàn tập đoàn | Trong công ty mình | Không | Không |
| Duyệt chứng từ | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |
| Hồ sơ cá nhân, đổi mật khẩu, xác thực hai lớp | Có | Có | Có | Có |

## 4. Vai trò hệ thống của MODULE_03 Kho (CONG_VIEC_05)

Quyền kho gán ở phạm vi chi nhánh áp dụng cho kho thuộc chi nhánh đó; gán ở phạm vi công ty áp dụng cho mọi kho của công ty sở hữu kho (QUYTAC_NGHIEPVU_46). Quản trị tập đoàn, quản trị công ty có sẵn mọi quyền `inventory.*`.

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Thủ kho | `warehouse_keeper` | Chi nhánh hoặc công ty | Lập phiếu nhập khác, xuất khác, điều chỉnh, chuyển kho; xác nhận xuất, nhận chuyển kho; xem tồn, thẻ kho; in tem | `inventory.access`, `inventory.stock.view`, `inventory.document.manage` | Không |
| Quản lý kho | `warehouse_manager` | Chi nhánh hoặc công ty | Như Thủ kho; quản lý kho, vị trí, cài đặt giữ hàng (khi gán ở phạm vi công ty); kiểm kê; giữ hàng, tồn an toàn; xem giá vốn | Mọi quyền `inventory.*` | Có (`inventory.cost.view`) |

## 5. Ma trận vai trò – thao tác của MODULE_03

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Quản lý kho | Thủ kho | Nhân viên công ty chủ hàng có quyền xem tồn |
|---|---|---|---|---|---|
| Thêm kho, sửa cài đặt giữ hàng | Có | Trong công ty mình | Khi gán ở phạm vi công ty | Không | Không |
| Sửa kho, vị trí, ngừng dùng | Có | Kho của công ty mình | Kho trong phạm vi gán | Không | Không |
| Xem tồn, thẻ kho, phiếu kho | Có | Kho của công ty mình (mọi chủ hàng) và hàng của công ty mình ở kho công ty khác | Kho trong phạm vi gán (mọi chủ hàng) | Kho trong phạm vi gán (mọi chủ hàng) | Chỉ hàng của công ty mình |
| Xem giá vốn, giá trị tồn | Có | Có | Có | Không | Khi có `inventory.cost.view` ở công ty mình |
| Lập, gửi, rút phiếu kho; xác nhận xuất, nhận chuyển kho | Có | Kho của công ty mình | Kho trong phạm vi gán | Kho trong phạm vi gán | Không |
| Kiểm kê | Có | Kho của công ty mình | Kho trong phạm vi gán | Không | Không |
| Giữ hàng, gia hạn, nhả; tồn an toàn | Có | Kho của công ty mình | Kho trong phạm vi gán | Không | Không |
| In tem sản phẩm, tem vị trí | Có | Có | Có | Có | Không |
| Duyệt phiếu kho | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |
