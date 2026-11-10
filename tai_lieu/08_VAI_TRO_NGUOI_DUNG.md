# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò mặc định, trách nhiệm và quyền hạn.
- Phiên bản: 1.4
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_05 (2026-11-10): thêm vai trò Thủ kho, Quản lý kho của MODULE_03 (mục 4, 5); CONG_VIEC_06 (2026-11-10): thêm vai trò Quản lý đối tác của MODULE_07, Thủ kho có thêm `crm.partner.view` (mục 4, 6, 7); CONG_VIEC_07 (2026-11-10): thêm vai trò Nhân viên mua hàng của MODULE_04, Thủ kho có thêm quyền nhập mua, lập đề nghị mua, xem đơn mua (mục 4, 8, 9); CONG_VIEC_08 (2026-11-10): thêm vai trò Nhân viên bán hàng của MODULE_05, Thủ kho có thêm quyền xuất giao hàng, nhận hàng trả lại, xem đơn bán (mục 4, 10, 11)

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
| Thủ kho | `warehouse_keeper` | Chi nhánh hoặc công ty | Lập phiếu nhập khác, xuất khác, điều chỉnh, chuyển kho; xác nhận xuất, nhận chuyển kho; xem tồn, thẻ kho; in tem | `inventory.access`, `inventory.stock.view`, `inventory.document.manage`; `crm.partner.view` (xem đối tác, CONG_VIEC_06); `inventory.purchase.receive`, `purchasing.access`, `purchasing.requisition.create`, `purchasing.order.view` (nhập mua, trả hàng nhà cung cấp, lập đề nghị mua, xem đơn mua, CONG_VIEC_07); `inventory.sales.issue`, `sales.access`, `sales.order.view` (xuất giao hàng, nhận hàng trả lại, xem đơn bán, CONG_VIEC_08) | Không |
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

## 6. Vai trò hệ thống của MODULE_07 Khách hàng và Đối tác (CONG_VIEC_06)

Đối tác dùng chung tập đoàn: người có quyền ở bất kỳ công ty nào thấy, sửa cùng một danh mục (QUYTAC_NGHIEPVU_57); hồ sơ đối tác chỉ của công ty đang chọn (QUYTAC_NGHIEPVU_60). Quản trị tập đoàn, quản trị công ty có sẵn mọi quyền `crm.*` (gồm `crm.partner.identity.view`, `crm.profile.manage`).

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Quản lý đối tác | `partner_manager` | Công ty | Thêm, sửa thông tin chung, người liên hệ, tài khoản ngân hàng của đối tác; ngừng giao dịch, cho giao dịch lại | `crm.access`, `crm.partner.view`, `crm.partner.manage` | Không |

Quyền của MODULE_07:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `crm.access` | Truy cập mini app Khách hàng và Đối tác | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác |
| `crm.partner.view` | Xem đối tác | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác, Thủ kho |
| `crm.partner.manage` | Thêm, sửa đối tác dùng chung | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác |
| `crm.partner.identity.view` | Xem số Căn cước công dân của đối tác | Công ty | Có | Quản trị tập đoàn, quản trị công ty |
| `crm.profile.manage` | Quản lý hồ sơ đối tác của công ty (hạn mức công nợ) | Công ty | Có | Quản trị tập đoàn, quản trị công ty |

## 7. Ma trận vai trò – thao tác của MODULE_07

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Quản lý đối tác | Thủ kho |
|---|---|---|---|---|
| Xem danh sách, chi tiết đối tác (số Căn cước công dân che) | Có | Có | Có | Có |
| Thêm, sửa, ngừng giao dịch đối tác bên ngoài | Có | Có | Có | Không |
| Sửa đối tác nội bộ | Ở màn hình Công ty | Không | Không | Không |
| Xem đầy đủ số Căn cước công dân (ghi nhật ký) | Có | Có | Không | Không |
| Lập, sửa hồ sơ đối tác của công ty | Có | Trong công ty mình | Không | Không |

## 8. Vai trò hệ thống của MODULE_04 Mua hàng (phần 1, CONG_VIEC_07)

Bảng giá mua, đề nghị mua, đơn mua thuộc công ty đang chọn. `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh nào của công ty cũng dùng được trong công ty đó (thủ kho thường gán theo chi nhánh); quyền Mua hàng khác cần gán ở phạm vi tập đoàn hoặc công ty. `inventory.purchase.receive` tính theo kho như quyền kho khác (QUYTAC_NGHIEPVU_46). Quản trị tập đoàn, quản trị công ty có sẵn mọi quyền `purchasing.*` và `inventory.purchase.receive`; Quản lý kho có `inventory.purchase.receive` (mọi quyền `inventory.*`).

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Nhân viên mua hàng | `purchaser` | Công ty | Quản lý bảng giá mua; lập đề nghị mua; lập, sửa, gửi, đóng đơn mua; thêm, sửa nhà cung cấp | `purchasing.access`, `purchasing.price.manage`, `purchasing.requisition.create`, `purchasing.order.view`, `purchasing.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage` | Không |

Quyền của MODULE_04 phần 1:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `purchasing.access` | Truy cập mini app Mua hàng (đã có) | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.price.manage` | Quản lý bảng giá mua | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.requisition.create` | Lập đề nghị mua | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.view` | Xem đơn mua | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.manage` | Lập, sửa, đóng đơn mua | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.settings.manage` | Cài đặt mua hàng (dung sai nhận vượt) | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.purchase.receive` | Nhập mua, trả hàng nhà cung cấp | Chi nhánh sở hữu kho, công ty | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

## 9. Ma trận vai trò – thao tác của MODULE_04 (phần 1)

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Nhân viên mua hàng | Thủ kho | Quản lý kho |
|---|---|---|---|---|---|
| Xem bảng giá mua, giá gợi ý | Có | Trong công ty mình | Có | Có | Không |
| Thêm, sửa, ngừng dùng giá mua | Có | Trong công ty mình | Có | Không | Không |
| Lập, sửa, gửi duyệt, rút đề nghị mua của mình | Có | Trong công ty mình | Có | Có (kể cả khi gán ở chi nhánh) | Không |
| Đóng đề nghị mua, lập đơn từ đề nghị | Có | Trong công ty mình | Có | Không | Không |
| Xem đơn mua | Có | Trong công ty mình | Có | Có (kể cả khi gán ở chi nhánh) | Không |
| Lập, sửa, gửi, đóng đơn mua | Có | Trong công ty mình | Có | Không | Không |
| Cài đặt dung sai nhận vượt | Có | Trong công ty mình | Không | Không | Không |
| Lập, gửi phiếu nhập mua; ghi kết quả kiểm tra chất lượng; lập, gửi phiếu trả hàng nhà cung cấp | Có | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán |
| Duyệt đề nghị mua, đơn mua | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |

## 10. Vai trò hệ thống của MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

Đơn bán, cài đặt bán hàng thuộc công ty đang chọn. `sales.order.view` gán ở chi nhánh nào của công ty cũng dùng được trong công ty đó (thủ kho thường gán theo chi nhánh); quyền Bán hàng khác cần gán ở phạm vi tập đoàn hoặc công ty. `inventory.sales.issue` tính theo kho như quyền kho khác (QUYTAC_NGHIEPVU_46). Quản trị tập đoàn, quản trị công ty có sẵn mọi quyền `sales.*` và `inventory.sales.issue`; Quản lý kho có `inventory.sales.issue` (mọi quyền `inventory.*`).

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Nhân viên bán hàng | `salesperson` | Công ty | Lập, sửa, gửi, rút, hủy, đóng đơn bán; xem giá bán; thêm, sửa khách hàng | `sales.access`, `sales.order.view`, `sales.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view` | Không |

Quyền của MODULE_05 phần 1:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `sales.access` | Truy cập mini app Bán hàng (đã có) | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho |
| `sales.order.view` | Xem đơn bán | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho |
| `sales.order.manage` | Lập, sửa, gửi, hủy, đóng đơn bán | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.settings.manage` | Cài đặt bán hàng (chiết khấu tay tối đa) | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.sales.issue` | Xuất giao hàng, nhận hàng trả lại | Chi nhánh sở hữu kho, công ty | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

## 11. Ma trận vai trò – thao tác của MODULE_05 (phần 1)

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho |
|---|---|---|---|---|---|
| Xem đơn bán, cài đặt bán hàng | Có | Trong công ty mình | Có | Có (kể cả khi gán ở chi nhánh) | Không |
| Tra giá dòng, lập, sửa, gửi, hủy, đóng đơn bán | Có | Trong công ty mình | Có | Không | Không |
| Rút đơn bán đang chờ duyệt | Đơn của mình | Đơn của mình | Đơn của mình | Không | Không |
| Cài đặt chiết khấu tay tối đa | Có | Trong công ty mình | Không | Không | Không |
| Lập, gửi phiếu xuất giao hàng; lập, gửi phiếu nhận hàng trả lại | Có | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán |
| Duyệt đơn bán có ngoại lệ | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |
