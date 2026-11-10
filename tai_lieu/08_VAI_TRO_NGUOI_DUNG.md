# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò mặc định, trách nhiệm và quyền hạn.
- Phiên bản: 1.9
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_05 (2026-11-10): thêm vai trò Thủ kho, Quản lý kho của MODULE_03 (mục 4, 5); CONG_VIEC_06 (2026-11-10): thêm vai trò Quản lý đối tác của MODULE_07, Thủ kho có thêm `crm.partner.view` (mục 4, 6, 7); CONG_VIEC_07 (2026-11-10): thêm vai trò Nhân viên mua hàng của MODULE_04, Thủ kho có thêm quyền nhập mua, lập đề nghị mua, xem đơn mua (mục 4, 8, 9); CONG_VIEC_08 (2026-11-10): thêm vai trò Nhân viên bán hàng của MODULE_05, Thủ kho có thêm quyền xuất giao hàng, nhận hàng trả lại, xem đơn bán (mục 4, 10, 11); CONG_VIEC_09 (2026-11-10): giao dịch nội bộ dùng quyền đã có, không thêm quyền, vai trò (mục 12); CONG_VIEC_12 (2026-11-10): thêm quyền `sales.promotion.view`, `sales.promotion.manage`, loại chứng từ duyệt `sales.promotion`; Nhân viên bán hàng có thêm `sales.promotion.view` (mục 10, 13); CONG_VIEC_13 (2026-11-10): thêm vai trò Kế toán, quyền `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, loại chứng từ `finance.receipt`, `finance.payment` của MODULE_06 (mục 14, 15); CONG_VIEC_14 (2026-11-10): thêm vai trò Kế toán trưởng, quyền `finance.ledger.view`, `finance.ledger.setup`, `finance.journal.manage`, `finance.period.close`, loại chứng từ `accounting.journal`; Kế toán có thêm `finance.ledger.view`, `finance.journal.manage` (mục 16, 17); CONG_VIEC_15 (2026-11-10): báo cáo tài chính dùng quyền đã có `finance.ledger.view`, `finance.ledger.setup`, không thêm quyền, vai trò (mục 18)

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
| Nhân viên bán hàng | `salesperson` | Công ty | Lập, sửa, gửi, rút, hủy, đóng đơn bán; xem giá bán; xem chương trình khuyến mãi (CONG_VIEC_12); thêm, sửa khách hàng | `sales.access`, `sales.order.view`, `sales.order.manage`, `sales.promotion.view`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view` | Không |

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

## 12. Phân quyền giao dịch nội bộ (MODULE_05 phần 2, CONG_VIEC_09)

Không thêm quyền, vai trò. Mỗi bên dùng quyền của mình tại công ty mình; người dùng chỉ thấy chứng từ của công ty đang chọn, chứng từ đối ứng chỉ hiện tên công ty bên kia, số, trạng thái.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Nhân viên mua hàng | Thủ kho | Quản lý kho |
|---|---|---|---|---|---|---|---|
| Xác nhận (chọn kho xuất), từ chối đơn bán đối ứng | `sales.order.manage` tại công ty bán | Có | Trong công ty mình | Có | Không | Không | Không |
| Xác nhận (chọn kho nhận), từ chối đơn mua đối ứng | `purchasing.order.manage` tại công ty mua | Có | Trong công ty mình | Không | Có | Không | Không |
| Nhận hàng nội bộ theo phiếu nhập "Chờ nhận" | `inventory.purchase.receive` tại kho nhận | Có | Kho của công ty mình | Không | Không | Kho trong phạm vi gán | Kho trong phạm vi gán |
| Xem, xử lý biên bản chênh lệch nội bộ | `inventory.sales.issue` tại kho xuất của công ty bán | Có | Kho của công ty mình | Không | Không | Kho trong phạm vi gán | Kho trong phạm vi gán |
| Xem giá trị biên bản chênh lệch | `inventory.cost.view` tại kho xuất hoặc công ty bán | Có | Trong công ty mình | Không | Không | Không | Có |

## 13. Phân quyền khuyến mãi (MODULE_05 phần 3, CONG_VIEC_12)

Chương trình khuyến mãi thuộc công ty đang chọn; quyền gán ở phạm vi tập đoàn hoặc công ty. Quản trị tập đoàn, quản trị công ty có sẵn hai quyền mới. Chương trình đi luồng duyệt với loại chứng từ `sales.promotion` (Chương trình khuyến mãi). Áp khuyến mãi vào đơn bán không cần quyền riêng: tự áp khi người có `sales.order.manage` lưu đơn.

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `sales.promotion.view` | Xem chương trình khuyến mãi | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.promotion.manage` | Lập, gửi duyệt, dừng chương trình khuyến mãi | Công ty | Không | Quản trị tập đoàn, quản trị công ty |

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho |
|---|---|---|---|---|---|---|
| Xem danh sách, chi tiết chương trình, đã dùng | `sales.promotion.view` hoặc `sales.promotion.manage` | Có | Trong công ty mình | Có | Không | Không |
| Lập, sửa, gửi duyệt, dừng chương trình | `sales.promotion.manage` | Có | Trong công ty mình | Không | Không | Không |
| Rút chương trình đang chờ duyệt | `sales.promotion.manage`, người lập, cấp duyệt đầu chưa quyết định | Chương trình của mình | Chương trình của mình | Không | Không | Không |
| Tìm mặt hàng `/sales/items` | `sales.order.manage` hoặc `sales.promotion.manage` | Có | Trong công ty mình | Có | Không | Không |
| Duyệt chương trình khuyến mãi | Theo chính sách duyệt `sales.promotion` | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |

## 14. Vai trò hệ thống của MODULE_06 Tài chính – Kế toán (phần 1, CONG_VIEC_13)

Quỹ, công nợ, phiếu thu chi thuộc công ty đang chọn. Bốn quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty; gán ở chi nhánh không có tác dụng. Quản trị tập đoàn, quản trị công ty có sẵn mọi quyền `finance.*`. Phiếu thu dùng loại chứng từ `finance.receipt` (Phiếu thu, không duyệt); phiếu chi (trả tiền nhà cung cấp, hoàn tiền cho khách hàng) dùng loại chứng từ `finance.payment` (Phiếu chi, cần duyệt). Công nợ tự phát sinh khi Thủ kho ghi sổ phiếu kho, không cần quyền tài chính.

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Kế toán | `accountant` | Công ty | Quản lý quỹ; nhập số dư đầu kỳ công nợ; lập, sửa, gửi, rút phiếu thu, phiếu chi; theo dõi công nợ, tuổi nợ; xem đối tác | `finance.access`, `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, `crm.access`, `crm.partner.view` | Không |

Quyền của MODULE_06 phần 1:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.access` | Truy cập mini app Tài chính – Kế toán (đã có) | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán |
| `finance.debt.view` | Xem quỹ, công nợ, phiếu thu chi | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán |
| `finance.fund.manage` | Quản lý quỹ | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán |
| `finance.debt.manage` | Nhập số dư đầu kỳ công nợ | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán |
| `finance.payment.manage` | Lập, gửi phiếu thu, phiếu chi | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán |

Loại chứng từ của MODULE_06 phần 1:

| Mã | Tên | Cần duyệt | Dãy số | Giá trị duyệt |
|---|---|---|---|---|
| `finance.receipt` | Phiếu thu | Không (ghi sổ ngay khi gửi) | `PT` | Không áp dụng |
| `finance.payment` | Phiếu chi | Có (chưa có chính sách duyệt thì ghi sổ ngay) | `PC` | Số tiền phiếu |

## 15. Ma trận vai trò – thao tác của MODULE_06 (phần 1)

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|
| Vào mini app Tài chính – Kế toán, xem công nợ, chi tiết đối tác, phiếu thu chi | `finance.debt.view` (danh sách, chi tiết phiếu thu chi: hoặc `finance.payment.manage`) | Có | Trong công ty mình | Có | Không | Không |
| Xem danh sách quỹ | `finance.debt.view`, `finance.fund.manage` hoặc `finance.payment.manage` | Có | Trong công ty mình | Có | Không | Không |
| Xem chi tiết quỹ, sổ quỹ | `finance.debt.view` hoặc `finance.fund.manage` | Có | Trong công ty mình | Có | Không | Không |
| Thêm, sửa, ngừng dùng quỹ | `finance.fund.manage` | Có | Trong công ty mình | Có | Không | Không |
| Nhập, xóa số dư đầu kỳ công nợ | `finance.debt.manage` | Có | Trong công ty mình | Có | Không | Không |
| Lập, sửa, gửi phiếu thu, phiếu chi | `finance.payment.manage` | Có | Trong công ty mình | Có | Không | Không |
| Rút phiếu chi đang chờ duyệt | `finance.payment.manage`, người lập, cấp duyệt đầu chưa quyết định | Phiếu của mình | Phiếu của mình | Phiếu của mình | Không | Không |
| Duyệt phiếu chi | Theo chính sách duyệt `finance.payment` | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |
| Phát sinh công nợ khi ghi sổ phiếu kho | Quyền ghi sổ phiếu kho tương ứng (mục 4, 8, 10) | Có | Kho của công ty mình | Không | Không | Kho trong phạm vi gán |

## 16. Vai trò hệ thống của MODULE_06 Tài chính – Kế toán (phần 2, CONG_VIEC_14)

Tài khoản, bút toán, kỳ khóa sổ thuộc công ty đang chọn. Bốn quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty. Quản trị tập đoàn, quản trị công ty có sẵn bốn quyền mới. Phiếu kế toán dùng loại chứng từ `accounting.journal` (Phiếu kế toán, cần duyệt). Bút toán tự sinh khi ghi sổ phiếu kho, phiếu thu chi, ghi tổn thất hàng thiếu nội bộ, không cần quyền kế toán. Chế độ kế toán của công ty đổi ở quản lý công ty với quyền `platform.company.manage` (MODULE_01).

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Kế toán (bổ sung) | `accountant` | Công ty | Như mục 14; thêm: xem tài khoản, bút toán, sổ sách; lập, sửa, gửi, rút phiếu kế toán | Quyền ở mục 14 và `finance.ledger.view`, `finance.journal.manage` | Không |
| Kế toán trưởng | `chief_accountant` | Công ty | Mọi việc của Kế toán; khởi tạo kế toán, thêm, sửa tài khoản, đổi định khoản mặc định; khóa sổ, mở lại sổ | `finance.access`, `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, `finance.ledger.view`, `finance.ledger.setup`, `finance.journal.manage`, `finance.period.close`, `crm.access`, `crm.partner.view` | Có (`finance.period.close`) |

Quyền của MODULE_06 phần 2:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.ledger.view` | Xem tài khoản, bút toán, sổ cái | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.ledger.setup` | Khởi tạo kế toán, sửa tài khoản, định khoản | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |
| `finance.journal.manage` | Lập, gửi phiếu kế toán | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.period.close` | Khóa sổ, mở lại sổ | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |

Loại chứng từ của MODULE_06 phần 2:

| Mã | Tên | Cần duyệt | Dãy số | Giá trị duyệt |
|---|---|---|---|---|
| `accounting.journal` | Phiếu kế toán | Có (chưa có chính sách duyệt thì ghi sổ ngay) | `PKT` | Tổng Nợ |

## 17. Ma trận vai trò – thao tác của MODULE_06 (phần 2)

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem trạng thái khởi tạo | `finance.ledger.view` hoặc `finance.ledger.setup` | Có | Trong công ty mình | Có | Có | Không | Không |
| Khởi tạo kế toán; thêm, sửa, ngừng dùng tài khoản chi tiết; đổi định khoản mặc định | `finance.ledger.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem hệ thống tài khoản | `finance.ledger.view`, `finance.ledger.setup` hoặc `finance.journal.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Xem định khoản mặc định | `finance.ledger.view` hoặc `finance.ledger.setup` | Có | Trong công ty mình | Có | Có | Không | Không |
| Xem danh sách, chi tiết bút toán | `finance.ledger.view` hoặc `finance.journal.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Lập, sửa, gửi phiếu kế toán | `finance.journal.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Rút phiếu kế toán đang chờ duyệt | `finance.journal.manage`, người lập, cấp duyệt đầu chưa quyết định | Phiếu của mình | Phiếu của mình | Phiếu của mình | Phiếu của mình | Không | Không |
| Duyệt phiếu kế toán | Theo chính sách duyệt `accounting.journal` | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |
| Xem kỳ khóa sổ | `finance.ledger.view` hoặc `finance.period.close` | Có | Trong công ty mình | Có | Có | Không | Không |
| Khóa sổ, mở lại sổ | `finance.period.close` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem bảng cân đối số phát sinh, sổ cái | `finance.ledger.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Bút toán tự sinh khi ghi sổ phiếu kho, phiếu thu chi | Quyền ghi sổ chứng từ tương ứng (mục 4, 8, 10, 14) | Có | Trong công ty mình | Có (phiếu thu chi) | Có (phiếu thu chi) | Không | Kho trong phạm vi gán |
| Đổi chế độ kế toán của công ty | `platform.company.manage` (mục 2, 3) | Có | Không | Không | Không | Không | Không |

## 18. Phân quyền báo cáo tài chính (MODULE_06 phần 3, CONG_VIEC_15)

Không thêm quyền, vai trò. Báo cáo lập từ bút toán của công ty đang chọn; quyền phải gán ở phạm vi tập đoàn hoặc công ty (mục 16).

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem báo cáo tình hình tài chính, kết quả hoạt động kinh doanh; xuất Excel, PDF | `finance.ledger.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Đánh dấu tài khoản chi tiết dài hạn | `finance.ledger.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
