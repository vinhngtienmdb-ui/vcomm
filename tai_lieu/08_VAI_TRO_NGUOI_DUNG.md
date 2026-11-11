# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò mặc định, trách nhiệm và quyền hạn.
- Phiên bản: 2.12
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_05 (2026-11-10): thêm vai trò Thủ kho, Quản lý kho của MODULE_03 (mục 4, 5); CONG_VIEC_06 (2026-11-10): thêm vai trò Quản lý đối tác của MODULE_07, Thủ kho có thêm `crm.partner.view` (mục 4, 6, 7); CONG_VIEC_07 (2026-11-10): thêm vai trò Nhân viên mua hàng của MODULE_04, Thủ kho có thêm quyền nhập mua, lập đề nghị mua, xem đơn mua (mục 4, 8, 9); CONG_VIEC_08 (2026-11-10): thêm vai trò Nhân viên bán hàng của MODULE_05, Thủ kho có thêm quyền xuất giao hàng, nhận hàng trả lại, xem đơn bán (mục 4, 10, 11); CONG_VIEC_09 (2026-11-10): giao dịch nội bộ dùng quyền đã có, không thêm quyền, vai trò (mục 12); CONG_VIEC_12 (2026-11-10): thêm quyền `sales.promotion.view`, `sales.promotion.manage`, loại chứng từ duyệt `sales.promotion`; Nhân viên bán hàng có thêm `sales.promotion.view` (mục 10, 13); CONG_VIEC_13 (2026-11-10): thêm vai trò Kế toán, quyền `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, loại chứng từ `finance.receipt`, `finance.payment` của MODULE_06 (mục 14, 15); CONG_VIEC_14 (2026-11-10): thêm vai trò Kế toán trưởng, quyền `finance.ledger.view`, `finance.ledger.setup`, `finance.journal.manage`, `finance.period.close`, loại chứng từ `accounting.journal`; Kế toán có thêm `finance.ledger.view`, `finance.journal.manage` (mục 16, 17); CONG_VIEC_15 (2026-11-10): báo cáo tài chính dùng quyền đã có `finance.ledger.view`, `finance.ledger.setup`, không thêm quyền, vai trò (mục 18); CONG_VIEC_16 (2026-11-10): thêm quyền `finance.einvoice.view`, `finance.einvoice.manage`, `finance.einvoice.setup` (nhạy cảm); Kế toán có thêm `finance.einvoice.view`, `finance.einvoice.manage`; Kế toán trưởng có thêm cả ba (mục 19, 20); CONG_VIEC_17 (2026-11-10): thêm quyền `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup` (nhạy cảm); Kế toán có thêm `finance.commission.view`, `finance.commission.manage`; Kế toán trưởng có thêm cả ba (mục 21, 22); CONG_VIEC_18 (2026-11-10): thêm quyền `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup` (nhạy cảm); Kế toán có thêm `finance.bank.view`, `finance.bank.manage`; Kế toán trưởng có thêm cả ba (mục 23, 24); CONG_VIEC_19 (2026-11-10): thêm quyền `finance.collection.view`, `finance.collection.manage`, `finance.collection.setup` (nhạy cảm); Kế toán có thêm `finance.collection.view`, `finance.collection.manage`; Kế toán trưởng có thêm cả ba (mục 25, 26); CONG_VIEC_20 (2026-11-10): thêm quyền `finance.consolidation.view`, `finance.consolidation.manage` (nhạy cảm) chỉ hiệu lực ở phạm vi tập đoàn; Kế toán trưởng có thêm cả hai (mục 27, 28); CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm quyền `crm.customer.view_all`, `crm.customer.assign`; Nhân viên bán hàng chỉ xem khách mình (và nhân viên phòng mình quản lý) phụ trách, đơn bán của các khách đó; mọi vai trò hệ thống khác đang xem đối tác hoặc đơn bán có thêm `crm.customer.view_all`; trưởng phòng giao khách trong phòng mình (mục 7, 10, 11, 29, 30); CONG_VIEC_23 (2026-11-10): thêm quyền `marketplace.buyer.view`, `marketplace.buyer.manage` (nhạy cảm); người mua (tài khoản không thuộc công ty), nhân viên kinh doanh là người mua được đánh dấu (THAY_DOI_14); CONG_VIEC_27 (2026-11-10): chức danh đội kinh doanh, ma trận vai trò – thao tác của đội kinh doanh; CONG_VIEC_24 (2026-11-11): thêm quyền đơn VComm, người mua thử, ma trận đặt hàng của MODULE_09 (mục 34, 35); CONG_VIEC_25 (2026-11-11): thêm quyền `marketplace.payment.manage` (nhạy cảm); Kế toán, Kế toán trưởng có thêm `marketplace.order.view`, `marketplace.payment.manage`; ma trận thanh toán, hoàn tiền của MODULE_09 (mục 36, 37); CONG_VIEC_26 (2026-11-11), THAY_DOI_17: hoa hồng theo đơn, ví, rút tiền, phí rút tiền dùng quyền đã có, không thêm quyền, vai trò (mục 38); CONG_VIEC_43 (2026-11-11), THAY_DOI_18: Nhân viên bán hàng bỏ `sales.order.manage`; Kế toán, Kế toán trưởng thêm `sales.access`, `sales.order.view`, `sales.order.manage`; bỏ quyền, loại chứng từ hoa hồng đội kinh doanh cũ (mục 21, 22 đã bỏ) và giao khách (mục 29, 30 đã tắt); phạm vi xem trở về toàn công ty (mục 39); CONG_VIEC_44 (2026-11-11): thêm quyền `inventory.stocktake.count`, Thủ kho có thêm quyền này; ứng dụng kho dùng quyền kho đã có (mục 40)
- Thay đổi theo: CONG_VIEC_05 (2026-11-10): thêm vai trò Thủ kho, Quản lý kho của MODULE_03 (mục 4, 5); CONG_VIEC_06 (2026-11-10): thêm vai trò Quản lý đối tác của MODULE_07, Thủ kho có thêm `crm.partner.view` (mục 4, 6, 7); CONG_VIEC_07 (2026-11-10): thêm vai trò Nhân viên mua hàng của MODULE_04, Thủ kho có thêm quyền nhập mua, lập đề nghị mua, xem đơn mua (mục 4, 8, 9); CONG_VIEC_08 (2026-11-10): thêm vai trò Nhân viên bán hàng của MODULE_05, Thủ kho có thêm quyền xuất giao hàng, nhận hàng trả lại, xem đơn bán (mục 4, 10, 11); CONG_VIEC_09 (2026-11-10): giao dịch nội bộ dùng quyền đã có, không thêm quyền, vai trò (mục 12); CONG_VIEC_12 (2026-11-10): thêm quyền `sales.promotion.view`, `sales.promotion.manage`, loại chứng từ duyệt `sales.promotion`; Nhân viên bán hàng có thêm `sales.promotion.view` (mục 10, 13); CONG_VIEC_13 (2026-11-10): thêm vai trò Kế toán, quyền `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, loại chứng từ `finance.receipt`, `finance.payment` của MODULE_06 (mục 14, 15); CONG_VIEC_14 (2026-11-10): thêm vai trò Kế toán trưởng, quyền `finance.ledger.view`, `finance.ledger.setup`, `finance.journal.manage`, `finance.period.close`, loại chứng từ `accounting.journal`; Kế toán có thêm `finance.ledger.view`, `finance.journal.manage` (mục 16, 17); CONG_VIEC_15 (2026-11-10): báo cáo tài chính dùng quyền đã có `finance.ledger.view`, `finance.ledger.setup`, không thêm quyền, vai trò (mục 18); CONG_VIEC_16 (2026-11-10): thêm quyền `finance.einvoice.view`, `finance.einvoice.manage`, `finance.einvoice.setup` (nhạy cảm); Kế toán có thêm `finance.einvoice.view`, `finance.einvoice.manage`; Kế toán trưởng có thêm cả ba (mục 19, 20); CONG_VIEC_17 (2026-11-10): thêm quyền `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup` (nhạy cảm); Kế toán có thêm `finance.commission.view`, `finance.commission.manage`; Kế toán trưởng có thêm cả ba (mục 21, 22); CONG_VIEC_18 (2026-11-10): thêm quyền `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup` (nhạy cảm); Kế toán có thêm `finance.bank.view`, `finance.bank.manage`; Kế toán trưởng có thêm cả ba (mục 23, 24); CONG_VIEC_19 (2026-11-10): thêm quyền `finance.collection.view`, `finance.collection.manage`, `finance.collection.setup` (nhạy cảm); Kế toán có thêm `finance.collection.view`, `finance.collection.manage`; Kế toán trưởng có thêm cả ba (mục 25, 26); CONG_VIEC_20 (2026-11-10): thêm quyền `finance.consolidation.view`, `finance.consolidation.manage` (nhạy cảm) chỉ hiệu lực ở phạm vi tập đoàn; Kế toán trưởng có thêm cả hai (mục 27, 28); CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm quyền `crm.customer.view_all`, `crm.customer.assign`; Nhân viên bán hàng chỉ xem khách mình (và nhân viên phòng mình quản lý) phụ trách, đơn bán của các khách đó; mọi vai trò hệ thống khác đang xem đối tác hoặc đơn bán có thêm `crm.customer.view_all`; trưởng phòng giao khách trong phòng mình (mục 7, 10, 11, 29, 30); CONG_VIEC_23 (2026-11-10): thêm quyền `marketplace.buyer.view`, `marketplace.buyer.manage` (nhạy cảm); người mua (tài khoản không thuộc công ty), nhân viên kinh doanh là người mua được đánh dấu (THAY_DOI_14); CONG_VIEC_27 (2026-11-10): chức danh đội kinh doanh, ma trận vai trò – thao tác của đội kinh doanh; CONG_VIEC_24 (2026-11-11): thêm quyền đơn VComm, người mua thử, ma trận đặt hàng của MODULE_09 (mục 34, 35); CONG_VIEC_25 (2026-11-11): thêm quyền `marketplace.payment.manage` (nhạy cảm); Kế toán, Kế toán trưởng có thêm `marketplace.order.view`, `marketplace.payment.manage`; ma trận thanh toán, hoàn tiền của MODULE_09 (mục 36, 37); CONG_VIEC_26 (2026-11-11), THAY_DOI_17: hoa hồng theo đơn, ví, rút tiền, phí rút tiền dùng quyền đã có, không thêm quyền, vai trò (mục 38); CONG_VIEC_43 (2026-11-11), THAY_DOI_18: Nhân viên bán hàng bỏ `sales.order.manage`; Kế toán, Kế toán trưởng thêm `sales.access`, `sales.order.view`, `sales.order.manage`; bỏ quyền, loại chứng từ hoa hồng đội kinh doanh cũ (mục 21, 22 đã bỏ) và giao khách (mục 29, 30 đã tắt); phạm vi xem trở về toàn công ty (mục 39); CONG_VIEC_50 (2026-11-11): thêm năm quyền báo cáo quản trị `analytics.*` của MODULE_15, Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng có cả năm quyền, Kế toán có thêm quyền báo cáo công nợ, hoa hồng và ví, Quản lý kho có thêm quyền báo cáo tồn kho (mục 40, 41)

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
| Thủ kho | `warehouse_keeper` | Chi nhánh hoặc công ty | Lập phiếu nhập khác, xuất khác, điều chỉnh, chuyển kho; xác nhận xuất, nhận chuyển kho; xem tồn, thẻ kho; in tem | `inventory.access`, `inventory.stock.view`, `inventory.document.manage`; `crm.partner.view` (xem đối tác, CONG_VIEC_06); `inventory.purchase.receive`, `purchasing.access`, `purchasing.requisition.create`, `purchasing.order.view` (nhập mua, trả hàng nhà cung cấp, lập đề nghị mua, xem đơn mua, CONG_VIEC_07); `inventory.sales.issue`, `sales.access`, `sales.order.view` (xuất giao hàng, nhận hàng trả lại, xem đơn bán, CONG_VIEC_08); `inventory.stocktake.count` (đếm kiểm kê, CONG_VIEC_44) | Không |
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

Từ CONG_VIEC_21 (THAY_DOI_12): người không có quyền `crm.customer.view_all` (Nhân viên bán hàng) chỉ xem đối tác có hồ sơ khách hàng do mình hoặc nhân viên phòng mình quản lý phụ trách; nhân viên phụ trách đã có chỉ đổi bằng phiếu giao khách (mục 29, 30). Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): người có `crm.partner.view` xem mọi đối tác của công ty; nhân viên phụ trách sửa bằng tay trên hồ sơ (mục 39).

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
| Nhân viên bán hàng | `salesperson` | Công ty | Lập, sửa, gửi, rút, hủy, đóng đơn bán; xem giá bán; xem chương trình khuyến mãi (CONG_VIEC_12); thêm, sửa khách hàng. Từ CONG_VIEC_21 (THAY_DOI_12) chỉ trong phạm vi khách mình phụ trách (mục 29). Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): bỏ `sales.order.manage`; chỉ xem đơn bán, không lập đơn bán; xem mọi đối tác, đơn bán của công ty (mục 39) | `sales.access`, `sales.order.view`, `sales.order.manage`, `sales.promotion.view`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view` | Không |

Quyền của MODULE_05 phần 1:

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `sales.access` | Truy cập mini app Bán hàng (đã có) | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho; Kế toán, Kế toán trưởng (CONG_VIEC_43) |
| `sales.order.view` | Xem đơn bán | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho; Kế toán, Kế toán trưởng (CONG_VIEC_43) |
| `sales.order.manage` | Lập, sửa, gửi, hủy, đóng đơn bán | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng; Kế toán, Kế toán trưởng (CONG_VIEC_43). Nhân viên bán hàng bỏ theo THAY_DOI_18 (CONG_VIEC_43) |
| `sales.settings.manage` | Cài đặt bán hàng (chiết khấu tay tối đa); từ CONG_VIEC_43 gồm cả cho phép lập đơn bán tay có hàng hóa | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.sales.issue` | Xuất giao hàng, nhận hàng trả lại | Chi nhánh sở hữu kho, công ty | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

## 11. Ma trận vai trò – thao tác của MODULE_05 (phần 1)

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): Nhân viên bán hàng không lập, sửa, gửi, rút, hủy, đóng đơn bán; Kế toán, Kế toán trưởng làm được như Nhân viên bán hàng trước đây; xem mọi đơn bán của công ty. Ma trận mới ở mục 39.

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho |
|---|---|---|---|---|---|
| Xem đơn bán, cài đặt bán hàng | Có | Trong công ty mình | Có; đơn bán chỉ trong phạm vi khách mình phụ trách từ CONG_VIEC_21 (mục 29) | Có (kể cả khi gán ở chi nhánh) | Không |
| Tra giá dòng, lập, sửa, gửi, hủy, đóng đơn bán | Có | Trong công ty mình | Có (đơn, khách trong phạm vi từ CONG_VIEC_21) | Không | Không |
| Rút đơn bán đang chờ duyệt | Đơn của mình | Đơn của mình | Đơn của mình | Không | Không |
| Cài đặt chiết khấu tay tối đa | Có | Trong công ty mình | Không | Không | Không |
| Lập, gửi phiếu xuất giao hàng; lập, gửi phiếu nhận hàng trả lại | Có | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán |
| Duyệt đơn bán có ngoại lệ | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định |

## 12. Phân quyền giao dịch nội bộ (MODULE_05 phần 2, CONG_VIEC_09)

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): xác nhận, từ chối đơn bán đối ứng cần `sales.order.manage`, nay là Kế toán, Kế toán trưởng (không còn Nhân viên bán hàng); giao dịch nội bộ chỉ gồm dịch vụ, không cần thủ kho nhận hàng, trừ khi công ty bán bật cài đặt cho phép lập đơn bán tay có hàng hóa.

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

## 19. Quyền hóa đơn điện tử (MODULE_06 phần 4, CONG_VIEC_16)

Không thêm vai trò. Ba quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (như mục 16). Quản trị tập đoàn, quản trị công ty có sẵn ba quyền mới. Hóa đơn gốc lập tự động khi Thủ kho ghi sổ phiếu xuất giao hàng; việc chờ xử lý hóa đơn trả hàng tạo khi ghi sổ phiếu nhận hàng trả lại; không cần quyền hóa đơn. API của hóa đơn điện tử trước hết cần `finance.access` hoặc `finance.einvoice.view` trong công ty đang chọn.

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.einvoice.view` | Xem hóa đơn điện tử | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.einvoice.manage` | Gửi lại, điều chỉnh, thay thế hóa đơn điện tử | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.einvoice.setup` | Cài đặt hóa đơn điện tử | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Kế toán | `accountant` | `finance.einvoice.view`, `finance.einvoice.manage` |
| Kế toán trưởng | `chief_accountant` | `finance.einvoice.view`, `finance.einvoice.manage`, `finance.einvoice.setup` |

## 20. Ma trận vai trò – thao tác của MODULE_06 (phần 4)

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem cài đặt hóa đơn điện tử | `finance.einvoice.view` hoặc `finance.einvoice.setup` | Có | Trong công ty mình | Có | Có (qua API; không có mục menu) | Không | Không |
| Sửa cài đặt, kiểm tra kết nối | `finance.einvoice.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem danh sách, chi tiết hóa đơn; tải PDF, XML; xem việc chờ xử lý trả hàng | `finance.einvoice.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Gửi lại hóa đơn; lập hóa đơn điều chỉnh giảm; ghi hóa đơn trả hàng của người mua; lập hóa đơn thay thế | `finance.einvoice.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Nhận thông báo hóa đơn quá hạn | `finance.einvoice.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Lập hóa đơn gốc khi ghi sổ phiếu xuất giao hàng; tạo việc chờ khi ghi sổ phiếu nhận hàng trả lại | Quyền ghi sổ phiếu kho (mục 10) | Có | Trong công ty mình | Không | Không | Không | Kho trong phạm vi gán |

## 21. Quyền hoa hồng đội kinh doanh (MODULE_06 phần 5, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): database migration 0061 gỡ các quyền `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup`, `finance.commission.view_own` khỏi mọi vai trò (kể cả vai trò công ty tự tạo) rồi xóa quyền; xóa loại chứng từ `finance.commission` cùng yêu cầu duyệt, chính sách duyệt, dãy số của loại này. Hoa hồng theo đơn VComm dùng quyền ở mục 38. Nội dung dưới đây giữ để tra cứu.

Không thêm vai trò. Ba quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (như mục 16). Quản trị tập đoàn, quản trị công ty có sẵn ba quyền mới. Nhân viên hưởng hoa hồng gán khi Nhân viên bán hàng gửi đơn; phát sinh ghi khi trừ nợ (ghi sổ phiếu thu chi, phiếu kho tự trừ khoản trả trước) và khi ghi sổ phiếu kho của đơn không có khách; không cần quyền hoa hồng. Nhân viên bán hàng chưa xem được hoa hồng của mình (ngoài phạm vi). API của hoa hồng trước hết cần `finance.access` hoặc `finance.commission.view` trong công ty đang chọn. Loại chứng từ mới `finance.commission` (Bảng hoa hồng, cần duyệt, dãy số `HH`).

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.commission.view` | Xem hoa hồng | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.commission.manage` | Lập, gửi bảng hoa hồng | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.commission.setup` | Cài đặt hoa hồng, chỉ tiêu | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Kế toán | `accountant` | `finance.commission.view`, `finance.commission.manage` |
| Kế toán trưởng | `chief_accountant` | `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup` |

## 22. Ma trận vai trò – thao tác của MODULE_06 (phần 5)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); giữ để tra cứu.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem cài đặt hoa hồng, chỉ tiêu | `finance.commission.view` hoặc `finance.commission.setup` | Có | Trong công ty mình | Có | Có (không có mục menu; mở đường dẫn thì chỉ xem) | Không | Không |
| Sửa cài đặt, mức, hệ số kênh, bậc, chỉ tiêu | `finance.commission.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem phát sinh, bảng hoa hồng | `finance.commission.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Lập, bỏ bảng nháp, gửi bảng hoa hồng | `finance.commission.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Rút bảng hoa hồng chờ duyệt | `finance.commission.manage`, người lập | Của mình | Của mình | Của mình | Của mình | Không | Không |
| Duyệt, từ chối bảng hoa hồng | Người duyệt theo chính sách duyệt loại `finance.commission` | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách | Không | Không |
| Gán nhân viên hưởng hoa hồng khi gửi đơn | Quyền gửi đơn bán (mục 10) | Có | Trong công ty mình | Không | Không | Có | Không |
| Ghi phát sinh khi trừ nợ, ghi sổ phiếu kho của đơn không có khách | Quyền ghi sổ phiếu thu chi (mục 14), phiếu kho (mục 10) | Có | Trong công ty mình | Có | Có | Không | Kho trong phạm vi gán |

## 23. Quyền đối soát ngân hàng (MODULE_06 phần 6, CONG_VIEC_18)

Không thêm vai trò. Ba quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (như mục 16). Quản trị tập đoàn, quản trị công ty có sẵn ba quyền mới. Webhook của dịch vụ trung gian không dùng tài khoản người dùng, xác thực bằng khóa của kết nối (QUYTAC_NGHIEPVU_113). Xác nhận lập phiếu thu từ gợi ý cần thêm quyền `finance.payment.manage` (mục 14).

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.bank.view` | Xem giao dịch ngân hàng, đối chiếu | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.bank.manage` | Ghép, bỏ qua giao dịch ngân hàng, lập phiếu thu từ gợi ý | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.bank.setup` | Cài đặt kết nối ngân hàng | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Kế toán | `accountant` | `finance.bank.view`, `finance.bank.manage` |
| Kế toán trưởng | `chief_accountant` | `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup` |

## 24. Ma trận vai trò – thao tác của MODULE_06 (phần 6)

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem quỹ ngân hàng, kết nối | `finance.bank.view` hoặc `finance.bank.setup` | Có | Trong công ty mình | Có | Có (không có mục menu; mở đường dẫn thì chỉ xem) | Không | Không |
| Tạo, sửa kết nối, đổi khóa; gửi giao dịch thử (bộ giả lập) | `finance.bank.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem giao dịch ngân hàng, đối chiếu | `finance.bank.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Ghép tay, bỏ qua, bỏ ghép, thôi bỏ qua | `finance.bank.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Xác nhận lập phiếu thu từ gợi ý | `finance.bank.manage` và `finance.payment.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Tự ghép khi phiếu thu chi ghi sổ | Quyền ghi sổ phiếu thu chi (mục 15) | Có | Trong công ty mình | Có | Có | Không | Không |

## 25. Quyền đối soát thu hộ (MODULE_06 phần 7, CONG_VIEC_19)

Không thêm vai trò. Ba quyền mới chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (như mục 16). Quản trị tập đoàn, quản trị công ty có sẵn ba quyền mới. Loại chứng từ mới `finance.collection_statement` (Bảng đối soát thu hộ, cần duyệt khi có chính sách); người duyệt theo chính sách duyệt của công ty.

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.collection.view` | Xem bảng đối soát thu hộ | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.collection.manage` | Nhập, gửi bảng đối soát thu hộ | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Kế toán, Kế toán trưởng |
| `finance.collection.setup` | Khai đơn vị thu hộ | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Kế toán trưởng |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Kế toán | `accountant` | `finance.collection.view`, `finance.collection.manage` |
| Kế toán trưởng | `chief_accountant` | `finance.collection.view`, `finance.collection.manage`, `finance.collection.setup` |

## 26. Ma trận vai trò – thao tác của MODULE_06 (phần 7)

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem đơn vị thu hộ | `finance.collection.view` hoặc `finance.collection.setup` | Có | Trong công ty mình | Có | Có | Không | Không |
| Thêm, sửa, ngừng dùng đơn vị thu hộ | `finance.collection.setup` | Có | Trong công ty mình | Có | Không | Không | Không |
| Xem bảng đối soát | `finance.collection.view` | Có | Trong công ty mình | Có | Có | Không | Không |
| Tải tệp mẫu | `finance.access`, `finance.collection.view` hoặc `finance.collection.setup` (không kiểm quyền chi tiết) | Có | Trong công ty mình | Có | Có | Không | Không |
| Nhập tệp, nhập lại, bỏ dòng, bỏ bảng nháp, gửi | `finance.collection.manage` | Có | Trong công ty mình | Có | Có | Không | Không |
| Rút bảng chờ duyệt | `finance.collection.manage`, người gửi bảng | Bảng mình gửi | Bảng mình gửi | Bảng mình gửi | Bảng mình gửi | Không | Không |
| Duyệt, từ chối bảng đối soát | Người duyệt theo chính sách duyệt loại `finance.collection_statement` | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách | Không | Không |
| Lập phiếu thu tiền đơn vị thu hộ chuyển về | Quyền phiếu thu chi (mục 14) | Có | Trong công ty mình | Có | Có | Không | Không |

## 27. Quyền báo cáo tài chính hợp nhất (MODULE_06 phần 8, CONG_VIEC_20)

Không thêm vai trò. Hai quyền mới chỉ có hiệu lực khi gán ở phạm vi tập đoàn: vai trò gán ở phạm vi công ty, chi nhánh không mở được báo cáo hợp nhất dù có quyền. Quản trị tập đoàn có sẵn hai quyền; quản trị công ty không có. Loại chứng từ mới `finance.consolidation` (Bảng hợp nhất, cần duyệt khi có chính sách); người duyệt theo chính sách duyệt của công ty gốc.

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `finance.consolidation.view` | Xem báo cáo hợp nhất (phạm vi tập đoàn) | Tập đoàn | Không | Quản trị tập đoàn, Kế toán trưởng |
| `finance.consolidation.manage` | Lập, gửi bảng hợp nhất (phạm vi tập đoàn) | Tập đoàn | Có | Quản trị tập đoàn, Kế toán trưởng |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Kế toán trưởng | `chief_accountant` | `finance.consolidation.view`, `finance.consolidation.manage` (chỉ hiệu lực khi vai trò gán ở phạm vi tập đoàn) |

## 28. Ma trận vai trò – thao tác của MODULE_06 (phần 8)

"Kế toán trưởng (tập đoàn)": vai trò Kế toán trưởng gán ở phạm vi tập đoàn; "Kế toán trưởng (công ty)": gán ở phạm vi công ty.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng (tập đoàn) | Kế toán trưởng (công ty) | Kế toán | Nhân viên bán hàng, Thủ kho |
|---|---|---|---|---|---|---|---|
| Xem phạm vi thành viên, xem nhanh cộng gộp, danh sách, chi tiết bảng hợp nhất, xuất Excel, PDF | `finance.consolidation.view` hoặc `finance.consolidation.manage` ở phạm vi tập đoàn | Có | Không | Có | Không | Không | Không |
| Lập, tính lại, sửa lãi chưa thực hiện, thêm, xóa điều chỉnh tay, bỏ bảng nháp, gửi | `finance.consolidation.manage` ở phạm vi tập đoàn | Có | Không | Có | Không | Không | Không |
| Rút bảng chờ duyệt | `finance.consolidation.manage` ở phạm vi tập đoàn, người gửi bảng | Bảng mình gửi | Không | Bảng mình gửi | Không | Không | Không |
| Duyệt, từ chối bảng hợp nhất | Người duyệt theo chính sách duyệt loại `finance.consolidation` của công ty gốc | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách | Không |

## 29. Quyền gán khách hàng cho nhân viên kinh doanh (MODULE_07 phần 2, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): database migration 0062 gỡ `crm.customer.view_all`, `crm.customer.assign` khỏi mọi vai trò rồi xóa quyền; xóa loại chứng từ `crm.customer_assignment` cùng yêu cầu duyệt, chính sách duyệt, dãy số của loại này. Phạm vi xem trở về toàn công ty; trưởng phòng không còn quyền riêng. Kiểm thử cũ thay bước chuẩn bị `salespersonSeesAllCustomers` bằng `grantSalesOrderManage`, `allowManualGoodsOrders`. Nội dung dưới đây giữ để tra cứu.

Không thêm vai trò. Theo THAY_DOI_12, vai trò Nhân viên bán hàng đổi phạm vi xem ngay khi phát hành: chỉ xem đối tác có hồ sơ khách hàng tại công ty do mình hoặc nhân viên phòng mình quản lý phụ trách, đơn bán của các khách đó, đơn mình (hoặc nhân viên đó) lập, đơn mình (hoặc nhân viên đó) hưởng hoa hồng (QUYTAC_NGHIEPVU_129, QUYTAC_NGHIEPVU_130). `crm.customer.view_all` gán ở bất kỳ phạm vi nào trong công ty (tập đoàn, công ty, chi nhánh) cũng có hiệu lực trong công ty đó; `crm.customer.assign` chỉ có hiệu lực khi gán ở phạm vi công ty hoặc tập đoàn. Loại chứng từ mới `crm.customer_assignment` (Phiếu giao khách, cần duyệt khi có chính sách).

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `crm.customer.view_all` | Xem mọi khách hàng, đơn bán của công ty | Tập đoàn, công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Nhân viên mua hàng, Kế toán, Kế toán trưởng, Quản lý đối tác (mọi vai trò hệ thống đang có `crm.partner.view` hoặc `sales.order.view`, trừ Nhân viên bán hàng) |
| `crm.customer.assign` | Giao, chuyển khách hàng cho nhân viên | Tập đoàn, công ty | Không | Quản trị tập đoàn, quản trị công ty |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Thủ kho | `warehouse_keeper` | `crm.customer.view_all` |
| Nhân viên mua hàng | `purchaser` | `crm.customer.view_all` |
| Kế toán | `accountant` | `crm.customer.view_all` |
| Kế toán trưởng | `chief_accountant` | `crm.customer.view_all` |
| Quản lý đối tác | `partner_manager` | `crm.customer.view_all` |
| Vai trò tự tạo đang có `crm.partner.view` hoặc `sales.order.view` | – | `crm.customer.view_all` (database migration 0021 thêm, để không đổi hành vi) |

Vai trò hệ thống nhận `crm.customer.view_all` khi đồng bộ danh mục quyền lúc khởi động (`apps/api/src/permissions/permission-catalog.ts`); vai trò tự tạo nhận qua database migration 0021.

Trưởng phòng: không cần quyền riêng. Người đang là trưởng phòng của ít nhất một phòng đang hoạt động của công ty được lập, sửa, gửi phiếu giao khách cho khách do nhân viên phòng mình quản lý (gồm phòng con các cấp, kể cả mình) phụ trách, nhân viên nhận trong phòng mình quản lý (QUYTAC_NGHIEPVU_131); xem khách, đơn bán của nhân viên các phòng đó (QUYTAC_NGHIEPVU_130). Để tìm khách, trưởng phòng cần quyền xem đối tác (`crm.partner.view`, vai trò Nhân viên bán hàng có sẵn). Kiểm thử viết trước CONG_VIEC_21 của CONG_VIEC_08, 12, 13, 14, 15, 16, 17, 19 thêm bước chuẩn bị `salespersonSeesAllCustomers` (cho vai trò Nhân viên bán hàng quyền xem mọi khách như trước; người dùng cho phép ngày 2026-11-10).

## 30. Ma trận vai trò – thao tác của MODULE_07 (phần 2)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); giữ để tra cứu. Ma trận mới ở mục 39.

"Trưởng phòng": người dùng đang là trưởng phòng (vai trò nào cũng được) và không có `crm.customer.assign`.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Trưởng phòng | Nhân viên bán hàng | Kế toán, Kế toán trưởng, Thủ kho, Nhân viên mua hàng, Quản lý đối tác |
|---|---|---|---|---|---|---|
| Xem đối tác, đơn bán của công ty | `crm.partner.view`, `sales.order.view`; phạm vi theo `crm.customer.view_all` | Mọi khách, mọi đơn | Mọi khách, mọi đơn trong công ty mình | Khách, đơn của nhân viên phòng mình quản lý | Khách mình phụ trách, đơn của khách đó, đơn mình lập, đơn mình hưởng hoa hồng | Mọi khách, mọi đơn (theo quyền có sẵn) |
| Lọc "Khách của tôi", lọc theo nhân viên phụ trách | `crm.partner.view` | Có | Có | Có | Có | Có |
| Thêm đối tác mới, nhận đối tác có sẵn làm khách của mình | `crm.partner.manage` | Thêm (không tự lập hồ sơ) | Thêm (không tự lập hồ sơ) | Theo quyền | Có, tự lập hồ sơ khách hàng do mình phụ trách | Quản lý đối tác: thêm (không tự lập hồ sơ) |
| Đặt nhân viên phụ trách cho khách chưa có | `crm.profile.manage` | Có | Trong công ty mình | Theo quyền | Không | Không |
| Xem lịch sử phụ trách | `crm.partner.view`, khách trong phạm vi | Có | Trong công ty mình | Khách trong phạm vi | Khách trong phạm vi | Có |
| Lập, sửa, gửi, bỏ phiếu giao khách | `crm.access`, `crm.partner.view`; `crm.customer.assign` hoặc là trưởng phòng | Mọi khách, mọi nhân viên | Mọi khách, mọi nhân viên trong công ty mình | Khách, nhân viên phòng mình quản lý; phiếu mình lập | Không (trừ khi là trưởng phòng) | Không |
| Xem danh sách, chi tiết phiếu giao khách | `crm.access`, `crm.partner.view`; phạm vi theo `crm.customer.assign` | Mọi phiếu | Mọi phiếu trong công ty mình | Phiếu mình lập, mình gửi, giao cho mình | Phiếu giao cho mình | Phiếu giao cho mình |
| Rút phiếu chờ duyệt | Người gửi phiếu | Phiếu mình gửi | Phiếu mình gửi | Phiếu mình gửi | Không | Không |
| Duyệt, từ chối phiếu giao khách | Người duyệt theo chính sách duyệt loại `crm.customer_assignment` | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách | Theo chính sách |

## 31. Người mua và quyền quản trị người mua (MODULE_09 phần lõi 1, CONG_VIEC_23)

- Người mua: tài khoản tự đăng ký trên ứng dụng VComm, không thuộc công ty nào, không có vai trò; chỉ dùng API dành cho người mua (tài khoản của mình, người mình giới thiệu, nhập mã người giới thiệu một lần).
- Nhân viên kinh doanh: người mua được đánh dấu; là thành viên công ty vận hành sàn với một phòng ban, không có vai trò Nhân viên bán hàng (không bán B2B, không lập đơn hộ; THAY_DOI_15) (căn cứ hoa hồng nhiều cấp theo cơ cấu tổ chức, CONG_VIEC_26); thấy thêm phần Kinh doanh trên ứng dụng.

| Quyền | Nội dung | Vai trò hệ thống có sẵn |
|---|---|---|
| `marketplace.buyer.view` | Xem tài khoản người mua, lịch sử | Quản trị tập đoàn, Quản trị công ty |
| `marketplace.buyer.manage` (nhạy cảm) | Đổi người giới thiệu, đánh dấu nhân viên kinh doanh; ở phạm vi tập đoàn thì chọn công ty vận hành sàn | Quản trị tập đoàn, Quản trị công ty |

## 32. Ma trận vai trò – thao tác của MODULE_09 (phần lõi 1)

| Thao tác | Điều kiện | Quản trị tập đoàn | Quản trị công ty vận hành sàn | Quản trị công ty khác | Nhân viên kinh doanh | Người mua |
|---|---|---|---|---|---|---|
| Đăng ký, đăng nhập, quên mật khẩu trên ứng dụng | Số điện thoại | Có | Có | Có | Có | Có |
| Xem mã, đường dẫn giới thiệu, người mình giới thiệu (số che) | Đăng nhập | Có | Có | Có | Có | Có |
| Tự nhập mã người giới thiệu | Chưa có người giới thiệu, chưa từng tự nhập | Có | Có | Có | Có | Có |
| Xem khách mình phụ trách (số đầy đủ) | Đang được đánh dấu | Không | Không | Không | Có | Không |
| Chọn công ty vận hành sàn | `marketplace.buyer.manage` phạm vi tập đoàn | Có | Không | Không | Không | Không |
| Xem danh sách, chi tiết người mua | `marketplace.buyer.view` tại công ty vận hành sàn | Có | Có | Không | Không | Không |
| Đổi người giới thiệu; đánh dấu, bỏ đánh dấu nhân viên kinh doanh | `marketplace.buyer.manage` tại công ty vận hành sàn | Có | Có | Không | Không | Không |

## 33. Chức danh đội kinh doanh (MODULE_09 phần lõi 1b, CONG_VIEC_27)

Chức danh suy ra từ vị trí trong cây đơn vị kinh doanh của công ty vận hành sàn (QUYTAC_NGHIEPVU_149): quản lý Khối là Giám đốc Kinh doanh, quản lý Vùng là Giám đốc Vùng, quản lý Phòng là Trưởng phòng kinh doanh, thành viên khác là Nhân viên kinh doanh. Không thêm quyền; quản trị dùng `marketplace.buyer.view`, `marketplace.buyer.manage`.

| Thao tác | Nhân viên kinh doanh | Trưởng phòng, Giám đốc Vùng, Giám đốc Kinh doanh | Quản trị công ty vận hành sàn |
|---|---|---|---|
| Xem chức danh, đơn vị, khách mình phụ trách | Có | Có | Không áp dụng |
| Xem cấp dưới, khách của cấp dưới (thông tin đầy đủ) | Không | Trong nhánh mình quản lý | Xem mọi người mua |
| Lập, rút đề xuất thay đổi đội | Không | Trong nhánh mình quản lý | Không áp dụng |
| Gắn loại đơn vị, đánh dấu, chuyển đơn vị, bổ nhiệm, bỏ quản lý, duyệt, từ chối đề xuất | Không | Không | Có |

## 34. Quyền đơn VComm và người mua thử (MODULE_09 phần lõi 2, CONG_VIEC_24)

- Không thêm vai trò. Hai quyền mới chỉ xét tại công ty vận hành sàn (hoặc phạm vi tập đoàn); giao cho nhân viên qua vai trò tùy chỉnh.
- Quyền xem được thay bằng quyền quản lý cùng nhóm (`marketplace.order.manage` xem được mọi thứ `marketplace.order.view` xem).
- Người mua thử: người mua được quản trị (`marketplace.order.manage`) đánh dấu; đặt được hàng khi VComm chưa mở đặt hàng (QUYTAC_NGHIEPVU_158).
- Giao cho đơn vị vận chuyển lập phiếu xuất giao hàng nháp nên người giao đơn cần thêm quyền xuất giao hàng tại kho xuất (`inventory.sales.issue`); quản trị công ty có sẵn. Ghi sổ phiếu xuất khi lấy hàng, phiếu nhận hàng trả lại khi hoàn hàng hoặc nhận hàng trả là chứng từ hệ thống, không xét quyền kho.

| Quyền | Nội dung | Vai trò hệ thống có sẵn |
|---|---|---|
| `marketplace.order.view` | Xem cài đặt bán hàng VComm, đăng bán, đơn VComm, yêu cầu trả hàng | Quản trị tập đoàn, Quản trị công ty |
| `marketplace.order.manage` (nhạy cảm) | Cài đặt bán hàng, bật tắt đơn vị vận chuyển, đăng bán, đánh dấu người mua thử, giao cho đơn vị vận chuyển, tra lại vận đơn, hủy đơn, duyệt, từ chối, nhận hàng trả | Quản trị tập đoàn, Quản trị công ty |

## 35. Ma trận vai trò – thao tác của MODULE_09 (phần lõi 2)

| Thao tác | Điều kiện | Quản trị tập đoàn, quản trị công ty vận hành sàn | Nhân viên có `marketplace.order.view` | Người mua | Người mua thử |
|---|---|---|---|---|---|
| Xem cửa hàng, chi tiết sản phẩm, giỏ hàng, sổ địa chỉ, xem trước đơn | Đăng nhập ứng dụng | Có | Có | Có | Có |
| Đặt hàng | Chưa mở đặt hàng (CONG_VIEC_25) | Chỉ khi là người mua thử | Chỉ khi là người mua thử | Không | Có |
| Xem, hủy đơn của mình; gửi, rút yêu cầu trả hàng | Đơn của chính mình | Có | Có | Có | Có |
| Xem cài đặt, đăng bán, đơn VComm, yêu cầu trả hàng | `marketplace.order.view` | Có | Có | Không | Không |
| Cài đặt, đăng bán, người mua thử, giao, tra lại vận đơn, hủy đơn, xử lý trả hàng | `marketplace.order.manage` | Có | Không | Không | Không |

## 36. Quyền thanh toán, hoàn tiền đơn VComm (MODULE_09 phần lõi 3, CONG_VIEC_25)

- Không thêm vai trò. Quyền chỉ xét tại công ty vận hành sàn (hoặc phạm vi tập đoàn).
- Bật tắt phương thức thanh toán, mở đặt hàng dùng quyền đã có `marketplace.order.manage`.
- Kế toán (`accountant`), Kế toán trưởng (`chief_accountant`) có thêm `marketplace.order.view` (xem đơn VComm, sổ thanh toán) và `marketplace.payment.manage`.
- Tài khoản nhận hoàn tiền của người mua chỉ hiện cho người có `marketplace.payment.manage` (màn hình Hoàn tiền).
- Người mua thanh toán, nhập tài khoản nhận hoàn tiền cho chính mình, không cần quyền.

| Quyền | Nội dung | Vai trò hệ thống có sẵn |
|---|---|---|
| `marketplace.payment.manage` (nhạy cảm) | Xem việc hoàn tiền kèm tài khoản ngân hàng người mua, ghi "Đã hoàn tiền", ghi "Đã thu COD" | Quản trị tập đoàn, Quản trị công ty, Kế toán, Kế toán trưởng |
| `marketplace.order.view` (bổ sung vai trò) | Xem đơn VComm gồm trạng thái thanh toán, lần thanh toán | Quản trị tập đoàn, Quản trị công ty, Kế toán, Kế toán trưởng |

## 37. Ma trận vai trò – thao tác của MODULE_09 (phần lõi 3)

| Thao tác | Điều kiện | Quản trị tập đoàn, quản trị công ty vận hành sàn | Kế toán, Kế toán trưởng | Nhân viên có `marketplace.order.view` | Người mua |
|---|---|---|---|---|---|
| Chọn phương thức khi đặt, thanh toán, thanh toán lại, hủy đơn Chờ thanh toán | Đơn của chính mình | Có | Có | Có | Có |
| Nhập, sửa tài khoản nhận hoàn tiền | Tài khoản của chính mình | Có | Có | Có | Có |
| Bật tắt phương thức thanh toán, mở đặt hàng | `marketplace.order.manage` | Có | Không | Không | Không |
| Xem trạng thái thanh toán, lần thanh toán của đơn | `marketplace.order.view` | Có | Có | Có | Không |
| Xem việc hoàn tiền, tài khoản người mua; ghi "Đã hoàn tiền", "Đã thu COD" | `marketplace.payment.manage` | Có | Có | Không | Không |

## 38. Hoa hồng, ví, rút tiền (MODULE_09 phần lõi 4, CONG_VIEC_26)

Không thêm quyền, vai trò. Dùng quyền đã có:

| Thao tác | Quyền | Quản trị tập đoàn, công ty | Kế toán, Kế toán trưởng | Người mua, nhân viên kinh doanh |
|---|---|---|---|---|
| Thiết lập hoa hồng sản phẩm, cài đặt hoa hồng chung, bảng phí rút tiền | `marketplace.order.manage` | Có | Không | Không |
| Danh sách rút tiền, duyệt, từ chối, ghi đã chi, bảng kê thuế | `marketplace.payment.manage` | Có | Có | Không |
| Xem ví của mình, gửi, rút lại yêu cầu rút tiền | Tài khoản đăng nhập ứng dụng | Không áp dụng | Không áp dụng | Có |
| Xem hoa hồng đã nhận, đang chờ của cấp dưới | Người quản lý trong đội kinh doanh (mục 33) | Không áp dụng | Không áp dụng | Chỉ người quản lý, trong nhánh của mình |

- Người có `marketplace.payment.manage` không tự duyệt, từ chối, ghi đã chi yêu cầu rút tiền của chính mình.
- Người dùng chỉ xem ví của mình; không ai sửa, xóa giao dịch ví.

## 39. Sửa quyền theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

Không thêm quyền, vai trò. Đổi quyền của vai trò hệ thống (đồng bộ danh mục quyền lúc khởi động và database migration 0062; vai trò công ty tự tạo giữ nguyên quyền Bán hàng):

| Vai trò | Mã | Bỏ | Thêm |
|---|---|---|---|
| Nhân viên bán hàng | `salesperson` | `sales.order.manage` (vẫn xem đơn bán) | – |
| Kế toán | `accountant` | `finance.commission.view`, `finance.commission.manage` (quyền đã xóa) | `sales.access`, `sales.order.view`, `sales.order.manage` |
| Kế toán trưởng | `chief_accountant` | `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup` (quyền đã xóa) | `sales.access`, `sales.order.view`, `sales.order.manage` |
| Quản trị tập đoàn, quản trị công ty, vai trò công ty tự tạo | – | `finance.commission.*`, `crm.customer.view_all`, `crm.customer.assign` (quyền đã xóa) | – |

Quyền đã xóa: `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup`, `finance.commission.view_own`, `crm.customer.view_all`, `crm.customer.assign`. Loại chứng từ đã xóa: `finance.commission`, `crm.customer_assignment`.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán, Kế toán trưởng | Nhân viên bán hàng | Thủ kho |
|---|---|---|---|---|---|---|
| Xem đối tác, đơn bán, lượt ghé thăm | `crm.partner.view`, `sales.order.view` | Mọi đối tác, đơn trong công ty | Mọi đối tác, đơn trong công ty mình | Mọi đối tác, đơn trong công ty | Mọi đối tác, đơn trong công ty | Như trước |
| Lập, sửa, gửi, rút, hủy, đóng đơn bán; xác nhận, từ chối đơn bán đối ứng | `sales.order.manage` | Có | Trong công ty mình | Có | Không | Không |
| Bật, tắt "Cho phép lập đơn bán tay có hàng hóa" | `sales.settings.manage` | Có | Trong công ty mình | Không | Không | Không |
| Đặt, đổi, bỏ nhân viên phụ trách trên hồ sơ đối tác | `crm.profile.manage` | Có | Trong công ty mình | Không | Không | Không |
| Chọn loại sản phẩm Hàng hóa, Dịch vụ | Quyền sửa sản phẩm (CONG_VIEC_04) | Có | Trong công ty mình | Theo quyền | Không | Không |
| Phiếu xuất, phiếu nhập dịch vụ | Hệ thống tự lập khi đơn xác nhận; không ai lập tay | – | – | – | – | – |

## 40. Vai trò hệ thống của MODULE_08 Nhân sự (phần 1, CONG_VIEC_46)

Quyền nhân sự gán ở phạm vi tập đoàn hoặc công ty (gán ở chi nhánh không dùng được). Quản trị tập đoàn, quản trị công ty có mọi quyền mới. Mọi quyền mới là nhạy cảm (dữ liệu cá nhân), người được gán bắt buộc xác thực hai lớp.

| Vai trò | Mã | Phạm vi gán | Trách nhiệm | Quyền chính | Nhạy cảm |
|---|---|---|---|---|---|
| Quản lý nhân sự | `hr_manager` | Công ty | Hồ sơ, giấy tờ (xem số đầy đủ, tải tệp), hợp đồng, nghỉ việc | `hr.access`, `hr.employee.view`, `hr.employee.manage`, `hr.identity.view`, `hr.contract.manage`, `platform.proposal.create` | Có |
| Nhân viên nhân sự | `hr_staff` | Công ty | Hồ sơ, hợp đồng; không xem số giấy tờ đầy đủ, không tải tệp giấy tờ | `hr.access`, `hr.employee.view`, `hr.employee.manage`, `hr.contract.manage` | Có |

| Thao tác | Quản trị tập đoàn, công ty | Quản lý nhân sự | Nhân viên nhân sự | Người có `hr.employee.view` | Nhân viên có hồ sơ liên kết |
|---|---|---|---|---|---|
| Xem hồ sơ đang làm (số che) | Có | Có | Có | Có | Chỉ hồ sơ của mình |
| Xem hồ sơ đã nghỉ | Có | Có | Có | Không | Không |
| Lập, sửa hồ sơ, giấy tờ, người phụ thuộc, quá trình công tác, nghỉ việc | Có | Có | Có | Không | Không |
| Hiện số giấy tờ đầy đủ, tải tệp giấy tờ, bản hợp đồng đã ký | Có | Có | Không | Không | Của chính mình |
| Lập, gửi, ký, chấm dứt hợp đồng, phụ lục; xem lương | Có | Có | Có | Không (không thấy lương) | Xem hợp đồng đã ký của mình kèm lương |
| Nhận nhắc hết hạn hợp đồng | Có | Có | Có | Không | Trưởng phòng của phòng ban trên hợp đồng |

## 41. Quyền chấm công, nghỉ phép, tăng ca, bảng công (MODULE_08 phần 2, CONG_VIEC_47)

Quyền mới gán ở phạm vi tập đoàn hoặc công ty như mục 40; vai trò Quản lý nhân sự (`hr_manager`), Nhân viên nhân sự (`hr_staff`) có thêm cả bốn quyền. Quản trị tập đoàn, quản trị công ty có mọi quyền mới. Trưởng phòng (người quản lý phòng ban trong cơ cấu) không cần quyền thêm, phạm vi là phòng mình và phòng con.

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `hr.attendance.view` | Xem chấm công, công ngày, đơn nghỉ, phiếu tăng ca, bảng công của công ty | Không |
| `hr.attendance.manage` | Ca, lịch, xếp ca, ngày nghỉ riêng, cài đặt và địa điểm chấm công, mã chấm công, nhập tệp, ghi thủ công, màn hình mã QR, ghi nhận tăng ca kèm văn bản, hủy phiếu; ở tập đoàn: ngày lễ chung | Có |
| `hr.leave.manage` | Loại nghỉ, chế độ phép, điều chỉnh sổ phép, ghi nhận nghỉ thay, hủy đơn đã duyệt | Có |
| `hr.timesheet.manage` | Mở xác nhận, trả lời giải trình, chốt, mở lại bảng công | Có |

| Thao tác | Quản trị, nhân sự có quyền | Người chỉ có `hr.attendance.view` | Trưởng phòng | Người có hồ sơ liên kết |
|---|---|---|---|---|
| Xem lưới công, đơn nghỉ, phiếu tăng ca, bảng công | Cả công ty | Cả công ty | Phòng mình | Của chính mình (MAN_HINH_122) |
| Ca, lịch, ngày lễ, cài đặt, địa điểm | `hr.attendance.manage` | Không | Xếp ca phòng mình | Xem lịch ca của mình |
| Ghi thủ công, nhập tệp máy chấm công | `hr.attendance.manage` | Không | Không | Chấm trên ứng dụng, đơn giải trình |
| Đơn nghỉ | Ghi nhận thay, hủy (`hr.leave.manage`) | Không | Duyệt theo chính sách duyệt | Lập, rút, hủy trước ngày bắt đầu |
| Phiếu tăng ca | Lập; kèm văn bản đồng ý, hủy (`hr.attendance.manage`) | Không | Lập cho phòng mình (chờ người lao động đồng ý), duyệt | Lập (là đồng ý), đồng ý hoặc không, rút, hủy trước giờ bắt đầu |
| Bảng công tháng | Mở xác nhận, trả lời, chốt, mở lại (`hr.timesheet.manage`); xuất Excel | Xem, xuất Excel | Xem phòng mình | Xác nhận hoặc giải trình dòng của mình |

Loại chứng từ mới: `hr.leave_request` (Đơn nghỉ, giá trị duyệt là số ngày), `hr.overtime_request` (Phiếu tăng ca, số giờ), `hr.attendance_correction` (Đơn giải trình công, 1).
## 41. Quyền lương của MODULE_08 Nhân sự (phần 3, CONG_VIEC_48)

Quyền mới (nhạy cảm, gán ở phạm vi tập đoàn hoặc công ty): `hr.payroll.view` (xem bảng lương, phiếu lương), `hr.payroll.manage` (lập, tính, gửi, ghi đã trả bảng lương; hồ sơ lương), `hr.payroll.setup` (thiết lập lương, loại phụ cấp; tham số pháp luật khi gán ở phạm vi tập đoàn). Vai trò `hr_manager` thêm cả ba quyền; `hr_staff` thêm `hr.payroll.view`, `hr.payroll.manage`; `chief_accountant` thêm `hr.access`, `hr.payroll.view`. Quản trị tập đoàn, quản trị công ty có mọi quyền mới.

| Thao tác | Quản trị tập đoàn | Quản trị công ty, Quản lý nhân sự | Nhân viên nhân sự | Kế toán trưởng | Nhân viên có hồ sơ liên kết |
|---|---|---|---|---|---|
| Sửa tham số pháp luật | Có | Không | Không | Không | Không |
| Thiết lập công ty, vùng, nhóm chi phí, loại phụ cấp | Có | Có | Không | Không | Không |
| Hồ sơ lương nhân viên | Có | Có | Có | Không | Không |
| Lập, tính, khoản nhập tay, gửi, rút, hủy, ghi đã trả bảng lương | Có | Có | Có | Không | Không |
| Xem bảng lương, xuất Excel | Có | Có | Có | Có | Không |
| Duyệt bảng lương | Theo chính sách duyệt loại `hr.payroll` | | | | |
| Xem phiếu lương | Có | Có | Có | Có | Chỉ phiếu của mình |
## 40. Ứng dụng kho (MODULE_03, CONG_VIEC_44)

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `inventory.stocktake.count` | Đếm kiểm kê | Công ty, chi nhánh | Không | Thủ kho; Quản lý kho, quản trị tập đoàn, quản trị công ty (qua danh sách `inventory.*`) |

| Thao tác | Quản trị tập đoàn | Quản trị công ty | Quản lý kho | Thủ kho | Nhân viên không có quyền kho |
|---|---|---|---|---|---|
| Đăng nhập ứng dụng kho | Được | Được | Được | Được | Không |
| Tra tồn, phiếu, nhận, xuất trên ứng dụng | Như web | Như web | Như web | Như web | Không |
| Cộng số đếm kiểm kê, xem lịch sử đếm | Được | Kho của công ty mình | Kho trong phạm vi gán | Kho trong phạm vi gán | Không |
| Xem tồn sổ sách, chênh lệch kiểm kê | Được | Được | Được | Không (đếm mù) | Không |
| Lập, bắt đầu, sửa số tuyệt đối, kết thúc, hủy kiểm kê | Được | Kho của công ty mình | Kho trong phạm vi gán | Không | Không |
## 40. Quyền báo cáo quản trị (MODULE_15 phần 1, CONG_VIEC_50)

Không thêm vai trò. Năm quyền mới của mini app Báo cáo quản trị (`analytics`); quyền xét riêng từng nhóm báo cáo trong công ty đang chọn. Gán ở phạm vi tập đoàn: xem mọi công ty của tập đoàn; gán ở phạm vi công ty: chỉ xem công ty đó; gán ở phạm vi chi nhánh: không có hiệu lực với báo cáo quản trị (QUYTAC_NGHIEPVU_336). Vai trò hệ thống chỉ thêm quyền, không bớt quyền cũ (đồng bộ danh mục quyền lúc khởi động); các vai trò khác không có sẵn, quản trị gán thêm bằng vai trò tự tạo.

| Quyền | Tên | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|---|
| `analytics.access` | Truy cập mini app Báo cáo quản trị | Tập đoàn hoặc công ty | Không | Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng, Kế toán, Quản lý kho |
| `analytics.sales.view` | Xem báo cáo bán hàng | Tập đoàn hoặc công ty | Không | Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng |
| `analytics.inventory.view` | Xem báo cáo tồn kho và luân chuyển | Tập đoàn hoặc công ty | Không | Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng, Quản lý kho |
| `analytics.debt.view` | Xem báo cáo công nợ | Tập đoàn hoặc công ty | Có | Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng, Kế toán |
| `analytics.commission.view` | Xem báo cáo hoa hồng và ví | Tập đoàn hoặc công ty | Có | Quản trị tập đoàn, Quản trị công ty, Kế toán trưởng, Kế toán |

| Vai trò | Mã | Quyền thêm |
|---|---|---|
| Quản trị tập đoàn | `group_admin` | Cả năm quyền |
| Quản trị công ty | `company_admin` | Cả năm quyền (gán ở phạm vi công ty nên chỉ xem công ty mình) |
| Kế toán trưởng | `chief_accountant` | Cả năm quyền |
| Kế toán | `accountant` | `analytics.access`, `analytics.debt.view`, `analytics.commission.view` |
| Quản lý kho | `warehouse_manager` | `analytics.access`, `analytics.inventory.view` |

## 41. Ma trận vai trò – thao tác của MODULE_15 (phần 1)

"(tập đoàn)": vai trò gán ở phạm vi tập đoàn, xem mọi công ty của tập đoàn; "(công ty)": gán ở phạm vi công ty, chỉ xem công ty đó.

| Thao tác | Quyền dùng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Quản lý kho | Nhân viên bán hàng, Thủ kho |
|---|---|---|---|---|---|---|---|
| Mở mini app, xem phạm vi công ty, trang tổng quan (chỉ tiêu theo quyền từng nhóm) | `analytics.access` | Mọi công ty của tập đoàn | Công ty mình | Theo phạm vi gán | Theo phạm vi gán | Theo phạm vi gán | Không |
| Xem, xuất Excel báo cáo bán hàng | `analytics.sales.view` | Có | Công ty mình | Có | Không | Không | Không |
| Xem, xuất Excel báo cáo tồn kho và luân chuyển | `analytics.inventory.view` | Có | Công ty mình | Có | Không | Có (phạm vi công ty, không phải chi nhánh) | Không |
| Xem, xuất Excel báo cáo công nợ theo tuổi nợ | `analytics.debt.view` | Có | Công ty mình | Có | Có | Không | Không |
| Xem, xuất Excel báo cáo hoa hồng và ví | `analytics.commission.view` | Có | Công ty mình | Có | Có | Không | Không |

- Báo cáo chỉ đọc; không thao tác nào ghi dữ liệu nghiệp vụ. Mỗi lần xuất Excel ghi nhật ký thao tác (QUYTAC_NGHIEPVU_343).
- Chọn công ty ngoài phạm vi của nhóm báo cáo bị từ chối (lỗi không có quyền), không trả số liệu một phần (QUYTAC_NGHIEPVU_336).
## 42. Vai trò của MODULE_08 Nhân sự phần 4: tuyển dụng, đánh giá hiệu suất (CONG_VIEC_54)

Thêm quyền `hr.recruitment.request` (không nhạy cảm), `hr.recruitment.manage`, `hr.review.manage` (nhạy cảm, người được gán bắt buộc xác thực hai lớp); gán ở phạm vi tập đoàn hoặc công ty như mục 40. Loại chứng từ mới cần duyệt: `hr.recruitment_request` (Nhu cầu tuyển dụng), `hr.job_offer` (Đề nghị nhận việc). Không tạo vai trò mới.

| Vai trò | Mã | Quyền thêm | Ghi chú |
|---|---|---|---|
| Quản lý nhân sự | `hr_manager` | `hr.recruitment.request`, `hr.recruitment.manage`, `hr.review.manage` | |
| Nhân viên nhân sự | `hr_staff` | `hr.recruitment.request`, `hr.recruitment.manage`, `hr.review.manage` | Có thêm `hr.recruitment.request` để menu "Tuyển dụng" hiện (CONG_VIEC_54 mục 18) |
| Quản trị tập đoàn, Quản trị công ty | | Mọi quyền mới | |
| Trưởng phòng (vai trò tùy chỉnh do quản trị lập) | | `hr.access`, `hr.recruitment.request` | Cần `hr.access` để vào mini app Nhân sự |

| Thao tác | Quản trị tập đoàn, công ty | Quản lý nhân sự, Nhân viên nhân sự | Người có `hr.recruitment.request` | Người phỏng vấn được giao | Người chấm được giao | Nhân viên có hồ sơ liên kết | Người tìm việc (không đăng nhập) |
|---|---|---|---|---|---|---|---|
| Lập, sửa, gửi, rút, hủy nhu cầu tuyển dụng | Có | Có | Nhu cầu của mình | Không | Không | Không | Không |
| Xem mọi nhu cầu, đóng nhu cầu; tin tuyển dụng | Có | Có | Không (chỉ nhu cầu của mình, số đã tuyển) | Không | Không | Không | Không |
| Xem, nộp hồ sơ ở trang tuyển dụng công khai | – | – | – | – | – | – | Có |
| Ứng viên, hồ sơ ứng tuyển, vòng phỏng vấn, email, đề nghị nhận việc (có mức lương), tải tệp, yêu cầu xóa, cài đặt lưu giữ | Có | Có | Không | Không | Không | Không | Không |
| Lập hồ sơ nhân sự từ ứng viên | Có | Có (kèm `hr.employee.manage`) | Không | Không | Không | Không | Không |
| Xem ứng viên được giao (rút gọn, không email, điện thoại), tải sơ yếu lý lịch, ghi phiếu đánh giá phỏng vấn ("Phỏng vấn của tôi") | Như người phỏng vấn | Như người phỏng vấn | Như người phỏng vấn | Có, vòng chưa hủy | Không | Không | Không |
| Trả lời đề nghị nhận việc qua liên kết riêng | – | Ghi thay ứng viên | – | – | – | – | Ứng viên có liên kết, một lần |
| Mẫu đánh giá, kỳ đánh giá, mọi phiếu, gán người chấm, hiệu chỉnh, chốt, công bố | Có | Có | Không | Không | Không | Không | Không |
| Đặt, chốt mục tiêu, chấm phiếu ("Đánh giá của tôi") | Như người chấm | Như người chấm | Không | Không | Phiếu được giao | Không | Không |
| Lập mục tiêu, tự đánh giá; xem kết quả sau công bố, xác nhận đã xem, ghi ý kiến | Phiếu của mình | Phiếu của mình | Phiếu của mình | Phiếu của mình | Phiếu của mình | Phiếu của mình | Không |

Người phỏng vấn, người chấm, nhân viên xem phiếu của mình không cần quyền nhân sự, chỉ cần là thành viên công ty đang chọn (menu "Phỏng vấn của tôi", "Đánh giá của tôi" dùng `platform.access`). Chi tiết: `tai_lieu/cong_viec/CONG_VIEC_54.md` mục 6, 18.

## MODULE_11 Điểm thưởng (CONG_VIEC_51)

- Quyền xét tại công ty vận hành sàn. Quản trị tập đoàn, Quản trị công ty có sẵn hai quyền; giao cho nhân viên qua vai trò tùy chỉnh.
- Duyệt phiếu điều chỉnh theo chính sách duyệt loại chứng từ `loyalty.adjustment` của công ty vận hành sàn; người lập không tự duyệt.
- Người mua chỉ xem ví điểm, lịch sử điểm, hạng của chính mình.

| Quyền | Thao tác | Vai trò có sẵn |
|---|---|---|
| `loyalty.view` | Xem chương trình điểm, ví điểm, sổ cái điểm, phiếu điều chỉnh, cảnh báo, nghĩa vụ điểm | Quản trị tập đoàn, Quản trị công ty |
| `loyalty.manage` (nhạy cảm) | Cài giai đoạn, bảng hạng; khóa, mở ví điểm; lập, sửa, gửi duyệt, rút phiếu điều chỉnh | Quản trị tập đoàn, Quản trị công ty |
