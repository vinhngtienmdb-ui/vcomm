# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò mặc định, trách nhiệm và quyền hạn.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Chờ phê duyệt

## 1. Nguyên tắc

- Vai trò là nhóm quyền. Quản trị tự tạo thêm vai trò; bảng dưới là các vai trò hệ thống có sẵn, không xóa được.
- "Người duyệt" không phải vai trò: một nhân viên là người duyệt khi được chỉ định trong một cấp duyệt (QUYTAC_NGHIEPVU_20).
- Vai trò của các module sau được bổ sung vào tài liệu này khi phân tích module đó.

## 2. Vai trò hệ thống của MODULE_01

| Vai trò | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|
| Quản trị tập đoàn | Tập đoàn | Tạo công ty, vai trò dùng chung, xem nhật ký toàn tập đoàn | Mọi quyền của `platform` | Có |
| Quản trị công ty | Công ty | Quản lý chi nhánh, phòng ban, nhân viên, vai trò riêng, chính sách duyệt, dãy số chứng từ của công ty | Quyền `platform` trong công ty, trừ tạo công ty và vai trò dùng chung | Có |
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
