# 12. KIẾN TRÚC HỆ THỐNG

- Mô tả: Kiến trúc tổng thể, kiến trúc thành phần, cấu trúc thư mục, ràng buộc kỹ thuật.
- Phiên bản: 2.9
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); CONG_VIEC_05 (2026-11-10): mini app Kho `apps/web-inventory`, thành phần phụ trợ của MODULE_03 (mục 3a, 3b); CONG_VIEC_06 (2026-11-10): mini app Khách hàng và Đối tác `apps/web-crm`, thành phần phụ trợ của MODULE_07 (mục 3a, 3c); CONG_VIEC_07 (2026-11-10): mini app Mua hàng `apps/web-purchasing`, thành phần phụ trợ của MODULE_04 (mục 3a, 3d, 6); CONG_VIEC_08 (2026-11-10): mini app Bán hàng `apps/web-sales`, thành phần phụ trợ của MODULE_05 (mục 3a, 3e, 6); CONG_VIEC_09 (2026-11-10): thành phần phụ trợ giao dịch nội bộ của MODULE_05 phần 2 (mục 3f); CONG_VIEC_12 (2026-11-10): thành phần phụ trợ khuyến mãi của MODULE_05 phần 3 (mục 3g); CONG_VIEC_13 (2026-11-10): mini app Tài chính – Kế toán `apps/web-finance`, schema `finance`, thành phần phụ trợ của MODULE_06 phần 1 (mục 3a, 3h, 6); CONG_VIEC_14 (2026-11-10): schema `accounting`, thành phần phụ trợ kế toán tổng hợp của MODULE_06 phần 2 (mục 3i, 6); CONG_VIEC_15 (2026-11-10): thành phần phụ trợ báo cáo tài chính của MODULE_06 phần 3 (mục 3j); CONG_VIEC_16 (2026-11-10): module `apps/api/src/einvoice`, lớp kết nối nhà cung cấp hóa đơn điện tử, tác vụ nền `einvoice-send`, `einvoice-overdue` của MODULE_06 phần 4 (mục 3k, 6); CONG_VIEC_17 (2026-11-10): module `apps/api/src/commission`, móc nối `DebtsService.allocatedHooks`, gán nhân viên hưởng khi gửi đơn, bút toán bảng hoa hồng của MODULE_06 phần 5 (mục 3l, 6); CONG_VIEC_18 (2026-11-10): module `apps/api/src/bank`, webhook công khai, móc nối `PaymentsService.postedHooks` của MODULE_06 phần 6 (mục 3m, 6); CONG_VIEC_19 (2026-11-10): module `apps/api/src/collection`, đọc tệp Excel đối soát, bút toán bảng đối soát, hoa hồng tính khoản giảm nợ của bảng đối soát của MODULE_06 phần 7 (mục 3n, 6); CONG_VIEC_20 (2026-11-10): module `apps/api/src/consolidation`, tách phần đọc số liệu của báo cáo tài chính dùng chung cho báo cáo hợp nhất của MODULE_06 phần 8 (mục 3o, 6); CONG_VIEC_21 (2026-11-10), THAY_DOI_12: điều kiện phạm vi xem khách hàng dùng chung `apps/api/src/crm/customer-scope.ts` cho đối tác và đơn bán, `CustomerAssignmentsService` phiếu giao khách của MODULE_07 phần 2 (mục 3p); CONG_VIEC_24 (2026-11-11): thành phần đặt hàng trên VComm (mục 3q): khung đơn vị vận chuyển, kết nối GHN, webhook, việc nền tự hoàn tất đơn; CONG_VIEC_25 (2026-11-11): thành phần thanh toán đơn người mua (mục 3r): khung cổng thanh toán, kết nối VNPAY, IPN, việc nền hủy đơn quá hạn thanh toán, hoàn tiền, bút toán; CONG_VIEC_43 (2026-11-11), THAY_DOI_18: thành phần phiếu dịch vụ, loại sản phẩm, đơn bán tay chỉ dịch vụ (mục 3s); mục 3l (CONG_VIEC_17) đã bỏ, thư mục `apps/api/src/commission` đã xóa; mục 3p (CONG_VIEC_21) đã tắt; mục 3n bỏ móc nối hoa hồng

Đã rà soát theo tài liệu `10`, `11` của MODULE_01 ngày 2026-11-09.

## 1. Kiến trúc tổng thể

```
Ứng dụng người dùng cuối          Trang nhà bán      Cửa hàng liên kết     Mini app quản trị doanh nghiệp
(iOS, Android, web)               (web)              (web, máy tính bảng)  (web) + ứng dụng kho + ứng dụng kinh doanh
        │                            │                    │                         │
        └────────────────────────────┴─────────┬──────────┴─────────────────────────┘
                                               ▼
                          Cổng API: xác thực, phân quyền, giới hạn tần suất
                                               ▼
              Backend NestJS – một ứng dụng chia module (modular monolith)
   core │ catalog │ inventory │ purchasing │ sales │ finance │ crm │ hr │ (sau: marketplace, community, loyalty)
                                               ▼
     PostgreSQL (Aurora) │ Redis │ OpenSearch │ S3 + CloudFront │ SQS/SNS (sự kiện từ outbox)
                                               ▼
     Bên ngoài: cổng thanh toán │ đơn vị vận chuyển │ hóa đơn điện tử │ ngân hàng hoặc ví đối tác │ Google, Microsoft, Zalo (đăng nhập) │ tổ chức cung cấp dịch vụ xác thực điện tử (VNeID)
```

## 2. Quyết định kiến trúc

1. **Một ngôn ngữ TypeScript** cho backend, web và di động.
2. **Monorepo** quản lý bằng pnpm và Turborepo.
3. **Mini app:** mỗi phân hệ quản trị doanh nghiệp là một ứng dụng web riêng, triển khai riêng, dùng chung đăng nhập một lần (SSO), hệ thống thiết kế và một cơ sở dữ liệu. Người dùng vào từ trang chủ mini app và chỉ thấy mini app mình có quyền.
4. **Một cơ sở dữ liệu PostgreSQL, mỗi module một schema:** `core`, `catalog`, `inventory`, `purchasing`, `sales`, `finance`, `crm`, `hr`; sau này `marketplace`, `community`, `loyalty`.
   - Khóa ngoại chỉ được trỏ vào `core` và vào schema của module đứng trước trong thứ tự phụ thuộc; không tạo vòng.
   - Module chỉ ghi vào schema của mình; thay đổi dữ liệu module khác qua service của module đó hoặc qua sự kiện.
5. **Backend một ứng dụng chia module.** Điểm thưởng và tìm kiếm là ứng viên tách thành dịch vụ riêng khi tải tăng.
6. **Đa pháp nhân từ ngày đầu:** mọi bảng nghiệp vụ có `company_id`; mọi truy vấn lọc theo phạm vi quyền ngay trong câu truy vấn.
7. **Không xóa cứng dữ liệu nghiệp vụ, không sửa chứng từ đã duyệt:** dùng trạng thái và chứng từ đảo.
8. **Sự kiện giữa module qua outbox:** ghi sự kiện trong cùng giao dịch với dữ liệu, tiến trình nền đẩy sang SQS/SNS.
9. **Hạ tầng AWS vùng Singapore:** ECS Fargate, Aurora PostgreSQL, ElastiCache Redis, OpenSearch, S3, CloudFront; hạ tầng viết bằng mã (Terraform hoặc CDK).

## 3. Thành phần phụ trợ cho MODULE_01

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Tác vụ nền | BullMQ trên Redis, chạy trong tiến trình riêng của `apps/api` | CHUC_NANG_18 (nhắc, chuyển duyệt quá hạn mỗi 15 phút), CHUC_NANG_21 (lấy tỷ giá mỗi sáng), đẩy sự kiện outbox |
| Lưu đệm quyền, mã OTP, giới hạn số lần thử | Redis | CHUC_NANG_06, CHUC_NANG_08, CHUC_NANG_13, yêu cầu phi chức năng hiệu năng |
| Gửi email | Amazon SES | CHUC_NANG_04, CHUC_NANG_06, CHUC_NANG_09 |
| Gửi mã OTP, đường dẫn qua điện thoại | Zalo ZNS trước, SMS thương hiệu dự phòng; **CHƯA XÁC ĐỊNH:** nhà cung cấp SMS | CHUC_NANG_04, CHUC_NANG_08, CHUC_NANG_09 |
| Đăng nhập liên kết | Google, Microsoft qua OpenID Connect; Zalo qua OAuth 2.0 của Zalo for Developers | CHUC_NANG_07, CHUC_NANG_24 |
| Xác thực nhà bán qua VNeID | Tổ chức cung cấp dịch vụ xác thực điện tử (**CHƯA XÁC ĐỊNH**), theo Nghị định 69/2024/NĐ-CP sửa đổi bởi Nghị định 320/2026/NĐ-CP | MODULE_02 (THAY_DOI_02) |
| Khóa bí mật, mã hóa | AWS Secrets Manager, AWS KMS | Tài liệu `22` mục 5 |

## 3a. Mini app web và cách vào chung tên miền

Mini app Nền tảng (`apps/web-platform`) là cửa vào chung: chuyển tiếp (rewrite của Next.js) đường dẫn của mini app khác sang ứng dụng web riêng của mini app đó, để mọi mini app dùng chung tên miền, cookie phiên HttpOnly và CSRF. Mỗi mini app đặt `basePath` bằng đường dẫn của mình và tự chuyển tiếp `/api/v1` sang backend (`API_ORIGIN`, mặc định `http://localhost:4000`).

| Mini app | Thư mục | Đường dẫn | Cổng phát triển | Biến môi trường ở `web-platform` (mặc định) |
|---|---|---|---|---|
| Nền tảng, trang chủ mini app | `apps/web-platform` | `/` | 3000 | Không áp dụng |
| Sản phẩm (CONG_VIEC_04) | `apps/web-catalog` | `/catalog` | 3001 | `CATALOG_ORIGIN` (`http://localhost:3001`) |
| Kho (CONG_VIEC_05) | `apps/web-inventory` | `/inventory` | 3002 | `INVENTORY_ORIGIN` (`http://localhost:3002`) |
| Khách hàng và Đối tác (CONG_VIEC_06) | `apps/web-crm` | `/crm` | 3003 | `CRM_ORIGIN` (`http://localhost:3003`) |
| Mua hàng (CONG_VIEC_07) | `apps/web-purchasing` | `/purchasing` | 3004 | `PURCHASING_ORIGIN` (`http://localhost:3004`) |
| Bán hàng (CONG_VIEC_08) | `apps/web-sales` | `/sales` | 3005 | `SALES_ORIGIN` (`http://localhost:3005`) |
| Tài chính – Kế toán (CONG_VIEC_13) | `apps/web-finance` | `/finance` | 3006 | `FINANCE_ORIGIN` (`http://localhost:3006`) |
| Nhân sự (CONG_VIEC_46) | `apps/web-hr` | `/hr` | 3007 | `HR_ORIGIN` (`http://localhost:3007`) |
| Báo cáo quản trị (CONG_VIEC_50) | `apps/web-analytics` | `/analytics` | 3009 | `ANALYTICS_ORIGIN` (`http://localhost:3009`) |

Chạy riêng mini app Kho: `pnpm --filter web-inventory dev` (cổng 3002), vào qua `http://localhost:3000/inventory` khi mini app Nền tảng và backend đang chạy.

Chạy riêng mini app Khách hàng và Đối tác: `pnpm --filter web-crm dev` (cổng 3003), vào qua `http://localhost:3000/crm` khi mini app Nền tảng và backend đang chạy.

Chạy riêng mini app Mua hàng: `pnpm --filter web-purchasing dev` (cổng 3004), vào qua `http://localhost:3000/purchasing` khi mini app Nền tảng và backend đang chạy. Phiếu nhập mua, phiếu trả hàng nhà cung cấp làm ở mini app Kho.

Chạy riêng mini app Bán hàng: `pnpm --filter web-sales dev` (cổng 3005), vào qua `http://localhost:3000/sales` khi mini app Nền tảng và backend đang chạy. Phiếu xuất giao hàng, phiếu nhận hàng trả lại làm ở mini app Kho.

Chạy riêng mini app Tài chính – Kế toán: `pnpm --filter web-finance dev` (cổng 3006), vào qua `http://localhost:3000/finance` khi mini app Nền tảng và backend đang chạy. Công nợ tự phát sinh khi ghi sổ phiếu kho ở mini app Kho.

Chạy riêng mini app Báo cáo quản trị: `pnpm --filter web-analytics dev` (cổng 3009), vào qua `http://localhost:3000/analytics` khi mini app Nền tảng và backend đang chạy. Báo cáo chỉ đọc dữ liệu của các module khác.

## 3b. Thành phần phụ trợ cho MODULE_03 Kho (CONG_VIEC_05)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Sổ kho | Dịch vụ `StockLedgerService` (`apps/api/src/inventory/stock-ledger.service.ts`), chạy trong giao dịch của phiếu; MODULE_04, MODULE_05 gọi khi nhập, xuất kho | CHUC_NANG_40, CHUC_NANG_41, CHUC_NANG_42 |
| Giữ hàng | Dịch vụ `ReservationsService`, gọi trong giao dịch của bên giữ; MODULE_05 dùng cho đơn bán | CHUC_NANG_43 |
| Tác vụ nền | BullMQ: `inventory-reservation-expiry` mỗi 5 phút nhả hàng giữ hết hạn; `inventory-stock-alerts` lúc 7 giờ sáng giờ Việt Nam (`Asia/Ho_Chi_Minh`) gửi thông báo cảnh báo tồn an toàn | CHUC_NANG_43, CHUC_NANG_44 |
| Duyệt phiếu kho | Dịch vụ duyệt của MODULE_01 (CHUC_NANG_16); nghe sự kiện `core.approval.completed` qua outbox để ghi sổ hoặc nhả hàng giữ | CHUC_NANG_40, CHUC_NANG_41, CHUC_NANG_42 |
| Tem PDF | `pdfmake` (đã có), mã vạch Code 128 vẽ bằng mã trong `apps/api/src/inventory/code128.ts`, không thêm thư viện | CHUC_NANG_45 |

## 3c. Thành phần phụ trợ cho MODULE_07 Khách hàng và Đối tác (CONG_VIEC_06)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Đồng bộ đối tác nội bộ | Hàm `syncInternalPartners` của `PartnersService` (`apps/api/src/crm/partners.service.ts`), chạy mỗi lần đọc danh sách đối tác; đọc `core.companies`, ghi `crm.partners`; công ty con có mã số thuế trùng đối tác khác được bỏ qua, ghi cảnh báo vào log. Chưa có sự kiện `core.company.changed` nên chưa đồng bộ theo sự kiện | CHUC_NANG_47 |
| Đọc nhóm khách hàng | Truy vấn đọc `catalog.customer_groups` (không đặt khóa ngoại từ `crm` sang `catalog`) | CHUC_NANG_48 |
| Danh mục đối tác cho module sau | Bảng `crm.partners`, `crm.partner_profiles`; MODULE_04 Mua hàng, MODULE_05 Bán hàng, MODULE_06 Tài chính – Kế toán chọn đối tác đang giao dịch | CHUC_NANG_46, CHUC_NANG_48 |

## 3d. Thành phần phụ trợ cho MODULE_04 Mua hàng (phần 1, CONG_VIEC_07)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Bảng giá mua, đề nghị mua, đơn mua | Dịch vụ `SupplierPricesService`, `RequisitionsService`, `PurchaseOrdersService` (`apps/api/src/purchasing/`); ghi schema `purchasing`; đọc `crm.partners`, `crm.partner_profiles` (nhà cung cấp), `inventory.warehouses` (kho nhận), `catalog` (mặt hàng, đơn vị, thuế suất) | CHUC_NANG_49, CHUC_NANG_50, CHUC_NANG_51 |
| Duyệt đề nghị mua, đơn mua | Dịch vụ duyệt của MODULE_01 (CHUC_NANG_16) gọi trong giao dịch gửi; nghe `core.approval.completed` qua outbox (loại `purchasing.requisition`, `purchasing.order`) | CHUC_NANG_50, CHUC_NANG_51 |
| Phiếu nhập mua, kiểm tra chất lượng, trả hàng | `PurchaseReceiptsService` (`apps/api/src/inventory/purchase-receipts.service.ts`) của module Kho, dùng lại `StockDocumentsService` (kiểm, ghi dòng, ghi sổ) và `StockLedgerService`; đọc `purchasing.orders`, `purchasing.order_lines`, `purchasing.settings`; gọi `PurchaseOrdersService.refreshReceived` trong giao dịch ghi sổ để chuyển đơn "Đã nhận đủ" | CHUC_NANG_52, CHUC_NANG_53 |
| Xuất kho theo giá trị cho trước | `StockLedgerService`: dòng giảm có tổng giá trị thì xuất đúng giá trị đó; xuất hết tồn thì lấy toàn bộ giá trị còn lại; không vượt giá trị tồn | CHUC_NANG_53 |
| Tìm mặt hàng dùng chung | Hàm `searchVariantOptions` (`apps/api/src/catalog/variant-search.ts`), dùng cho mini app Kho, Mua hàng, Bán hàng | CHUC_NANG_40, CHUC_NANG_49, CHUC_NANG_50, CHUC_NANG_51, CHUC_NANG_54 |

## 3e. Thành phần phụ trợ cho MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Đơn bán, cài đặt bán hàng | Dịch vụ `SalesOrdersService` (`apps/api/src/sales/sales-orders.service.ts`), bộ điều khiển `SalesController` (`apps/api/src/sales/sales.controller.ts`), quyền dùng chung `apps/api/src/sales/sales-context.ts`; ghi schema `sales`; đọc `crm.partners`, `crm.partner_profiles` (khách hàng, nhóm khách, hạn mức, số ngày được nợ), `catalog` (mặt hàng, đơn vị, thuế suất, kênh bán), `inventory.warehouses` (kho xuất), `inventory.costs` (giá vốn bình quân), `inventory.settings` (thời hạn giữ hàng) | CHUC_NANG_54, CHUC_NANG_55 |
| Tra giá bán | Hàm dùng chung `lookupPrice` (`apps/api/src/catalog/price-lists.service.ts`), tách từ API_61 để đơn bán dùng lại, không kiểm quyền | CHUC_NANG_36, CHUC_NANG_54 |
| Duyệt đơn bán có ngoại lệ | Dịch vụ duyệt của MODULE_01 (CHUC_NANG_16) gọi trong giao dịch gửi; nghe `core.approval.completed` qua outbox (loại `sales.order`) | CHUC_NANG_54 |
| Giữ hàng theo đơn bán | `ReservationsService` của module Kho (nguồn `sales.order`): giữ khi gửi; `closeBySource` nhả khi từ chối, rút, hủy, đóng; `consumeFromSource` giảm phần giữ khi giao | CHUC_NANG_54, CHUC_NANG_56 |
| Phiếu xuất giao hàng, nhận hàng trả lại | `SalesDeliveriesService` (`apps/api/src/inventory/sales-deliveries.service.ts`) của module Kho, dùng lại `StockDocumentsService` (kiểm, ghi dòng, ghi sổ; kiểm hàng khả dụng đọc trong giao dịch gửi) và `StockLedgerService`; đọc `sales.orders`, `sales.order_lines`; gọi `SalesOrdersService.refreshDelivered` trong giao dịch ghi sổ để chuyển đơn "Đã giao đủ" | CHUC_NANG_56, CHUC_NANG_57 |

## 3f. Thành phần phụ trợ cho giao dịch nội bộ (MODULE_05 phần 2, CONG_VIEC_09)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Nối hai phía | `InternalTradeService` (`apps/api/src/sales/internal-trade.service.ts`) đăng ký móc nối (`internalHooks`) vào `SalesOrdersService` và `PurchaseOrdersService` khi khởi động: đơn bán xác nhận thì gọi `PurchaseOrdersService.createCounterpart`, đơn mua duyệt thì gọi `SalesOrdersService.createCounterpart`; một bên kết thúc thì gọi `endByCounterpart` của bên kia; mọi việc trong cùng giao dịch, mỗi module chỉ ghi schema của mình | CHUC_NANG_58, CHUC_NANG_59 |
| Quy tắc nội bộ dùng chung | `apps/api/src/sales/internal-trade-rules.ts` (chỉ đọc): kênh `NOI_BO`, điều kiện đơn bán, đơn mua nội bộ, giá nội bộ (dùng lại `lookupPrice`); `linkedVariant` (`apps/api/src/catalog/variant-links.service.ts`) đọc liên kết hai chiều; `internalCompanyOf`, `internalPartnerOf` (`apps/api/src/crm/partners.service.ts`) | CHUC_NANG_58, CHUC_NANG_59 |
| Xác nhận, từ chối đơn đối ứng | `SalesOrdersService.confirmCounterpart`, `rejectCounterpart` (gửi như đơn thường, dùng lại giữ hàng, ngoại lệ, duyệt); `PurchaseOrdersService.confirmCounterpart`, `rejectCounterpart` (dùng lại luồng duyệt đơn mua); tra giá nội bộ qua `SupplierPricesService.lookupFor` | CHUC_NANG_58, CHUC_NANG_59 |
| Rút yêu cầu duyệt bên kia | `ApprovalRequestsService.cancelWithin` (`apps/api/src/approvals/approval-requests.service.ts`) rút yêu cầu còn chờ trong giao dịch, không phát sự kiện hoàn tất | CHUC_NANG_58, CHUC_NANG_59 |
| Phiếu nhập chờ nhận | `SalesDeliveriesService.createInternalReceipt` sinh phiếu nhập mua `in_transit` khi ghi sổ phiếu xuất giao hàng nội bộ; `requireInternalReady` chặn giao khi đơn mua đối ứng chưa duyệt; `PurchaseReceiptsService` chặn nhập mua thường đơn nội bộ | CHUC_NANG_60 |
| Nhận hàng nội bộ, biên bản chênh lệch | `InternalReceiptsService` (`apps/api/src/inventory/internal-receipts.service.ts`): dùng lại `StockDocumentsService` (kiểm, ghi dòng, ghi sổ), `PurchaseOrdersService.refreshReceived`; nhập lại kho dùng lại `SalesDeliveriesService.createReturn`, `submit` | CHUC_NANG_60, CHUC_NANG_61 |
| Giao diện | `CounterpartPanel` ở `apps/web-sales`, `apps/web-purchasing` (chi tiết đơn); `InternalReceiveForm` ở chi tiết phiếu kho, trang `/internal-discrepancies` ở `apps/web-inventory` | CHUC_NANG_58 đến CHUC_NANG_61 |

## 3g. Thành phần phụ trợ cho khuyến mãi (MODULE_05 phần 3, CONG_VIEC_12)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Chương trình khuyến mãi | `PromotionsService` (`apps/api/src/sales/promotions.service.ts`), đường dẫn trong `SalesController`; ghi `sales.promotions`, `sales.promotion_items`, `sales.promotion_channels`, `sales.promotion_customer_groups`; dùng lại dãy số chứng từ (`NumberSequencesService`, `ensureSequence`), luồng duyệt (`ApprovalRequestsService.submitWithin`, `withdraw`; nghe `core.approval.completed` qua outbox, loại `sales.promotion`) | CHUC_NANG_62 |
| Đã dùng của chương trình | Biểu thức SQL `promotionUsage`, `promotionGiftUsage` (cùng tệp) cộng từ `sales.order_lines` của đơn chờ duyệt, đã xác nhận, đã giao đủ, đã đóng; bỏ được một đơn (đơn đang lưu, đang gửi) | CHUC_NANG_64 |
| Áp khuyến mãi vào đơn bán | Hàm `applyPromotions`, `lineAmounts` (`apps/api/src/sales/promotion-pricing.ts`, chỉ đọc chương trình) gọi từ `SalesOrdersService.prepare` sau `priceLines`, cùng giao dịch lưu; giới hạn suất tặng theo tồn khả dụng của hàng tặng tại kho xuất (đọc `inventory.costs`, `inventory.reservations`), trả suất thiếu ghi vào `sales.orders.gift_shortages`; `writeLines` ghi trường khuyến mãi của dòng | CHUC_NANG_63 |
| Kiểm giới hạn khi gửi, ngoại lệ | `SalesOrdersService.checkPromotionLimits` (khóa chương trình `FOR UPDATE` theo thứ tự mã, kiểm ngân sách, số suất) trong `submitWithin`; `exceptions` so giá vốn với giá trước khuyến mãi, bỏ qua dòng tặng; giữ hàng dòng tặng qua `ReservationsService` như dòng thường | CHUC_NANG_63, CHUC_NANG_64 |
| Giao diện | Trang `/promotions`, `/promotions/new`, `/promotions/[id]` ở `apps/web-sales`; `PromotionEditor`, `PromotionStatusBadge`; menu `SalesShell` thêm "Khuyến mãi"; `SalesOrderEditor` bỏ dòng tặng khỏi biểu mẫu sửa; chi tiết đơn bán hiện khuyến mãi từng dòng | CHUC_NANG_62, CHUC_NANG_63 |

## 3h. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 1, CONG_VIEC_13)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Quỹ | `FundsService` (`apps/api/src/finance/funds.service.ts`), bộ điều khiển `FinanceController` (`apps/api/src/finance/finance.controller.ts`), quyền, nhật ký dùng chung `apps/api/src/finance/finance-context.ts` (`requireFinancePermission` kiểm quyền bao trùm công ty); ghi `finance.funds`; số dư tính bằng biểu thức `fundBalance` từ `finance.payments` đã ghi sổ | CHUC_NANG_65 |
| Sổ công nợ | `DebtsService` (`apps/api/src/finance/debts.service.ts`): ghi `finance.debt_items`, `finance.debt_allocations`; khóa công nợ theo công ty, phía, đối tác bằng `pg_advisory_xact_lock`; trừ nợ `matchCredit`, `matchDebit`; tuổi nợ; số dư đầu kỳ; đọc `crm.partners`, `crm.partner_profiles` (khách hàng, nhà cung cấp, số ngày được nợ) | CHUC_NANG_66 |
| Móc nối ghi sổ phiếu kho, ghi tổn thất nội bộ | `StockDocumentsService.postedHooks` (`apps/api/src/inventory/stock-documents.service.ts`): danh sách hàm gọi cuối giao dịch ghi sổ phiếu kho; `DebtsService.onModuleInit` đăng ký `recordInventoryDocument`. `InternalReceiptsService.writtenOffHooks` (`apps/api/src/inventory/internal-receipts.service.ts`): gọi trong cùng giao dịch khi biên bản chênh lệch nội bộ được ghi tổn thất; `DebtsService` đăng ký `recordInternalWriteOff`. Module Kho không phụ thuộc module Tài chính. Giá trị công nợ tính bằng hàm `finance.inventory_debt_amount` (database migration `0010_finance.sql`, đọc `inventory.documents`, `inventory.document_lines`, `sales.order_lines`, `purchasing.order_lines`) | CHUC_NANG_66 |
| Phiếu thu, phiếu chi | `PaymentsService` (`apps/api/src/finance/payments.service.ts`): ghi `finance.payments`, `finance.payment_lines`; dùng lại dãy số chứng từ (`NumberSequencesService`, `ensureSequence`; tiền tố `PT`, `PC`), luồng duyệt (`ApprovalRequestsService.submitWithin`, `withdraw`; nghe `core.approval.completed` qua outbox, loại `finance.payment`); ghi sổ gọi `DebtsService` trong cùng giao dịch | CHUC_NANG_67 |
| Dư nợ cho đơn bán | Biểu thức SQL `receivableBalance` (`apps/api/src/finance/receivable-balance.ts`, tách riêng để không nhập vòng giữa module; chỉ đọc `finance.debt_items`) dùng trong `SalesOrdersService` khi tính ngoại lệ vượt hạn mức | CHUC_NANG_68 |
| Giao diện | `apps/web-finance`: trang `/debts`, `/debts/[partnerId]`, `/payments`, `/payments/new`, `/payments/[id]`, `/funds`, `/funds/[id]`; `FinanceShell` (menu), `FundEditor`, `PaymentEditor`, `PartnerPicker`, `PaymentStatusBadge`; mini app Nền tảng chuyển tiếp `/finance` theo `FINANCE_ORIGIN` (`apps/web-platform/next.config.ts`) | CHUC_NANG_65 đến CHUC_NANG_67 |

## 3i. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 2, CONG_VIEC_14)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Khởi tạo, tài khoản, định khoản | `LedgerService` (`apps/api/src/accounting/ledger.service.ts`), bộ điều khiển `LedgerController` (`apps/api/src/accounting/ledger.controller.ts`), quyền dùng chung `requireFinancePermission` (`apps/api/src/finance/finance-context.ts`); danh mục tài khoản, định khoản mặc định hai chế độ khai báo trong `apps/api/src/accounting/charts.ts`; ghi `accounting.settings`, `accounting.accounts`, `accounting.posting_rules`; chế độ đọc từ `core.companies.accounting_regime` | CHUC_NANG_69, CHUC_NANG_70 |
| Bút toán tự sinh | `apps/api/src/accounting/postings.ts` (`inventoryDraft`, `paymentDraft`, `writeOffDraft`: tính số tiền theo vai trò; tiền phiếu kho lấy từ hàm `finance.inventory_amounts` dùng chung với công nợ, làm tròn theo `core.currencies.minor_units`, THAY_DOI_10); `LedgerService.record` đổi vai trò sang tài khoản, kiểm cân, ghi `accounting.journals`, `accounting.journal_lines`. Móc nối đăng ký trong `LedgerService.onModuleInit`: `StockDocumentsService.postedHooks` (ghi sổ phiếu kho), `PaymentsService.postedHooks` (thêm ở CONG_VIEC_14, `apps/api/src/finance/payments.service.ts`, gọi cuối giao dịch ghi sổ phiếu thu chi), `InternalReceiptsService.writtenOffHooks` (ghi tổn thất biên bản nội bộ). Kiểm khóa sổ dùng chung `assertOpenPeriod` (`apps/api/src/accounting/period-guard.ts`, tách riêng để không nhập vòng): đọc `accounting.settings` với `FOR SHARE` (chưa khởi tạo thì khóa chia sẻ dòng công ty); module Kho gọi khi gửi phiếu kho. Module Kho, Tài chính không phụ thuộc service kế toán | CHUC_NANG_71 |
| Đổi chế độ kế toán | `beforeRegimeChange` (`apps/api/src/accounting/regime-guard.ts`, tách riêng để không nhập vòng) gọi trong giao dịch sửa công ty của `CompaniesService` (`apps/api/src/organization/companies.service.ts`) khi `accountingRegime` đổi: có bút toán thì từ chối; không có thì xóa định khoản, tài khoản, cài đặt | CHUC_NANG_69, CHUC_NANG_01 |
| Phiếu kế toán, khóa sổ | `JournalsService` (`apps/api/src/accounting/journals.service.ts`): phiếu kế toán dùng lại dãy số chứng từ (`NumberSequencesService`, `ensureSequence`, tiền tố `PKT`), luồng duyệt (`ApprovalRequestsService.submitWithin`, `withdraw`; nghe `core.approval.completed` qua outbox, loại `accounting.journal`); khóa sổ, mở lại khóa `accounting.settings` bằng `FOR UPDATE`, tạo, xóa bút toán kết chuyển `closing` | CHUC_NANG_72, CHUC_NANG_73 |
| Sổ sách | `LedgerReportsService` (`apps/api/src/accounting/ledger-reports.service.ts`): bảng cân đối số phát sinh (cộng dồn lên tài khoản cha trong mã), sổ cái (cây tài khoản bằng truy vấn đệ quy) | CHUC_NANG_73 |
| Giao diện | `apps/web-finance`: trang `/accounts`, `/journals`, `/journals/new`, `/journals/[id]`, `/books`; `FinanceShell` thêm ba mục menu; `JournalEditor`, `JournalStatusBadge` | CHUC_NANG_69 đến CHUC_NANG_73 |

## 3j. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 3, CONG_VIEC_15)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Mẫu báo cáo | `apps/api/src/accounting/statement-templates.ts`: mẫu B01-DN, B02-DN (Thông tư 99/2025), B01a-DNN, B01b-DNN, B02-DNN (Thông tư 133) khai báo trong mã; mỗi chỉ tiêu có mã số, tên, cấp, công thức (số dư Nợ, Có, theo đối tác, bù trừ; phát sinh có, loại tài khoản đối ứng; tổng, hiệu), `longTermOf` (chỉ tiêu dài hạn của chỉ tiêu ngắn hạn), ghi chú; nguồn văn bản của từng chế độ | CHUC_NANG_74, CHUC_NANG_75 |
| Tính báo cáo | `StatementsService` (`apps/api/src/accounting/statements.service.ts`): kiểm quyền bằng `requireFinancePermission`; đọc `core.companies` (chế độ, tháng bắt đầu năm tài chính, tiền tệ), `accounting.accounts` (`is_long_term`, cây tài khoản), tài khoản của vai trò `retained_earnings`; số dư cuối ngày, phát sinh trong kỳ (trừ bút toán `closing`) bằng truy vấn tổng hợp `accounting.journal_lines`; tính chỉ tiêu theo thứ tự phụ thuộc; làm tròn theo `finance.company_minor_units` | CHUC_NANG_74, CHUC_NANG_75 |
| Xuất tệp | `apps/api/src/accounting/statement-export.ts`: Excel bằng `write-excel-file`, PDF bằng `pdfmake` (phông Roboto đi kèm, chặn tải tài nguyên theo URL, chỉ đọc thư mục phông); `LedgerController.statement` (`apps/api/src/accounting/ledger.controller.ts`) trả `StreamableFile` kèm `content-type`, `content-disposition` | CHUC_NANG_75 |
| Tài khoản dài hạn | Cột `accounting.accounts.is_long_term` (database migration `0012_financial_statements.sql`); `LedgerService.updateAccount` nhận `isLongTerm`, từ chối tài khoản hệ thống | CHUC_NANG_75, CHUC_NANG_69 |
| Giao diện | `apps/web-finance`: trang `/statements`; `FinanceShell` thêm mục menu "Báo cáo tài chính"; trang `/accounts` thêm ô "Dài hạn", nhãn "Dài hạn"; tải tệp bằng `apiDownload` (`packages/ui/src/lib/api.ts`) | CHUC_NANG_74, CHUC_NANG_75 |

## 3k. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 4, CONG_VIEC_16)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Cài đặt | `EinvoiceSettingsService` (`apps/api/src/einvoice/einvoice-settings.service.ts`): ghi `finance.einvoice_settings`, `finance.einvoice_series`; mã hóa, giải mã mật khẩu bằng `encryptSecret`, `decryptSecret` (`apps/api/src/common/secret-box.ts`, AES-256-GCM); `simulatorAllowed` (bộ giả lập chỉ khi `NODE_ENV` khác `production`); `providerConfig` dựng cấu hình gọi nhà cung cấp | CHUC_NANG_76 |
| Lập, gửi hóa đơn | `EinvoicesService` (`apps/api/src/einvoice/einvoices.service.ts`): `onModuleInit` đăng ký `StockDocumentsService.postedHooks` (phiếu xuất giao hàng lập hóa đơn; phiếu nhận hàng trả lại tạo việc chờ) trong giao dịch ghi sổ; `insertInvoice`, `documentItems` (dòng theo `finance.line_share`, đơn giá làm tròn theo `finance.company_minor_units`); `sendDue` (lỗi một hóa đơn ghi log, không dừng cả lượt), `process` (giữ chỗ bằng `FOR UPDATE SKIP LOCKED`, ghi `finance.einvoice_attempts` trước khi gọi, gọi ngoài giao dịch, thời gian chờ 30 giây cho mỗi lần gọi và lần tải tệp; lần đầu phát hành, mọi lần sau tra trạng thái trước; chỉ ghi kết quả khi lần gửi là lần mới nhất và hóa đơn chưa phát hành; gửi lại 1, 5, 15, 60 phút; hóa đơn thay thế phát hành thì ghi `replaced_by_id` cho hóa đơn bị thay thế); `resend` (từ chối khi có lần gửi chưa xong dưới 10 phút; giữ nội dung hoặc lấy lại cài đặt; hóa đơn bị từ chối nhận mã tham chiếu mới); `notifyOverdue` (một giao dịch, ngày Việt Nam; thông báo `einvoice_overdue` qua `apps/api/src/common/notifications.ts`); `nextWorkingDay` (bỏ thứ Bảy, Chủ nhật); số tiền bằng chữ `apps/api/src/einvoice/amount-in-words.ts` | CHUC_NANG_77 |
| Trả hàng, thay thế | `EinvoiceCorrectionsService` (`apps/api/src/einvoice/einvoice-corrections.service.ts`): việc chờ `finance.einvoice_return_tasks`; hóa đơn gốc hiện hành theo chuỗi `replaced_by_id`; lập hóa đơn điều chỉnh, thay thế bằng `insertInvoice` rồi gửi ngay bằng `EinvoicesService.process` | CHUC_NANG_78, CHUC_NANG_79 |
| Bộ điều khiển | `EinvoicesController` (`apps/api/src/einvoice/einvoices.controller.ts`): API_91, API_92; kiểm `finance.access` hoặc `finance.einvoice.view` bằng `PermissionService.authorize`, quyền chi tiết kiểm trong service bằng `requireFinancePermission`; tệp trả `StreamableFile` kèm `content-type`, `content-disposition` | CHUC_NANG_76 đến CHUC_NANG_79 |
| Lớp kết nối nhà cung cấp | Giao diện `EinvoiceProviderAdapter` (`apps/api/src/einvoice/providers/provider.ts`): `testConnection`, `publish`, `status` (theo mã tham chiếu), `download` (PDF, XML); kết quả chuẩn hóa `issued`, `awaiting_code`, `rejected`, `temporary_error`, `data_error`, `unknown`, `not_found`. Thêm nhà cung cấp là thêm một bộ chuyển đổi | CHUC_NANG_76, CHUC_NANG_77 |
| Bộ giả lập | `SimulatorProvider` (`apps/api/src/einvoice/providers/simulator.ts`): cấp số liên tục theo ký hiệu (số lớn nhất đã lưu cộng số đã cấp trong bộ nhớ), mã của cơ quan thuế giả, cùng mã tham chiếu trả lại hóa đơn đã lập; tình huống lỗi theo cài đặt `simulation`; PDF ghi "BẢN GIẢ LẬP – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ" tạo bằng `apps/api/src/einvoice/invoice-pdf.ts`; XML rút gọn. Hóa đơn đã nhận giữ trong bộ nhớ tiến trình | CHUC_NANG_77 |
| MISA meInvoice | `MisaProvider` (`apps/api/src/einvoice/providers/misa.ts`): REST JSON bằng `fetch` của Node.js, mỗi yêu cầu chờ tối đa 20 giây; địa chỉ `https://testapi.meinvoice.vn/api/integration` (thử nghiệm), `https://api.meinvoice.vn/api/integration` (chính thức), kiểm thử đổi bằng biến `MISA_EINVOICE_BASE_URL`; `/auth/token` lấy mã truy cập (giữ trong bộ nhớ 12 giờ theo khóa băm SHA-256 của công ty, môi trường và thông tin kết nối, đổi cài đặt thì lấy mã mới; lỗi xác thực thì lấy lại và gọi lại một lần); `/invoice` phát hành ký số từ xa đồng bộ (`SignType` 2), hóa đơn điều chỉnh (`ReferenceType` 2), thay thế (`ReferenceType` 1) kèm thông tin hóa đơn gốc; `/invoice/status` tra theo mã tham chiếu; `/invoice/Download` tải PDF, XML theo mã giao dịch; `/invoice/templates` dùng khi kiểm tra kết nối. HTTP 401 là lỗi xác thực; 5xx, 429, lỗi mạng là lỗi tạm thời; hết thời gian chờ, mã lỗi trùng mã tham chiếu (chứa `duplicate` hoặc `exist`) là không rõ kết quả. `SendTaxStatus` chưa được dùng (cơ quan thuế từ chối qua MISA chưa nhận ra). Đường dẫn, tên trường theo nguồn thứ cấp, chưa đối chiếu tài liệu chính thức | CHUC_NANG_76, CHUC_NANG_77 |
| Tạo PDF dùng chung | `apps/api/src/common/pdf.ts` (`renderPdf`): `pdfmake` với phông Roboto đi kèm, chặn tải tài nguyên theo URL, chỉ đọc thư mục phông; dùng chung với xuất báo cáo tài chính (`apps/api/src/accounting/statement-export.ts`) | CHUC_NANG_77, CHUC_NANG_75 |
| Tác vụ nền | `apps/api/src/jobs/background-jobs.ts` (BullMQ): hàng đợi riêng `hoa-don-dien-tu`, một tác vụ chạy một lúc, tách khỏi hàng đợi `nen-tang` để gọi nhà cung cấp chậm không làm chậm tác vụ khác; `einvoice-send` mỗi 30 giây gọi `EinvoicesService.sendDue` (tối đa 20 hóa đơn mỗi lần); `einvoice-overdue` mỗi giờ gọi `notifyOverdue` | CHUC_NANG_77 |
| Giao diện | `apps/web-finance`: trang `/einvoices` (thẻ "Hóa đơn", "Chờ xử lý trả hàng"), `/einvoices/[id]`, `/einvoice-settings`; `EinvoiceReturns`, `EinvoiceStatusBadge`; `FinanceShell` thêm mục menu "Hóa đơn điện tử", "Cài đặt hóa đơn điện tử"; tải tệp bằng `apiDownload` | CHUC_NANG_76 đến CHUC_NANG_79 |

## 3l. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 5, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): đã xóa thư mục `apps/api/src/commission`, `DebtsService.allocatedHooks`, hàm `commissionDraft`, vai trò định khoản `staff_payable`, trang `/commissions`, `/commission-settings` của `apps/web-finance`. Bảng dưới đây giữ để tra cứu.

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Cài đặt, chỉ tiêu, phát sinh | `CommissionsService` (`apps/api/src/commission/commissions.service.ts`): ghi `finance.commission_settings`, `commission_rates`, `commission_channel_factors`, `commission_targets`; `onModuleInit` đăng ký `DebtsService.allocatedHooks` (`recordAllocation`: phiếu thu trừ nợ phiếu xuất, phiếu chi trừ phiếu trả) và `StockDocumentsService.postedHooks` (`recordRetail`: phiếu kho của đơn không có khách); `lineShares` (tiền gồm thuế, chưa thuế từng dòng đơn trên phiếu theo `finance.line_share`, cộng các dòng phiếu cùng dòng đơn); `record` (chia theo phần còn phải thu của từng dòng, ghi `finance.commission_events`); danh sách phát sinh | CHUC_NANG_80, CHUC_NANG_82 |
| Quy tắc dùng chung | `apps/api/src/commission/commission-rules.ts`, không phụ thuộc dịch vụ khác: `assignCommissionUser` (gọi trong giao dịch gửi đơn của `SalesOrdersService`, `apps/api/src/sales/sales-orders.service.ts`), `loadRateSettings`, `commissionPercent` (ngành hàng cha gần nhất, hai cách kết hợp), `tierMultiplier` | CHUC_NANG_80 đến CHUC_NANG_83 |
| Móc nối trừ nợ | `DebtsService.allocatedHooks` (`apps/api/src/finance/debts.service.ts`, thêm ở CONG_VIEC_17): danh sách hàm gọi trong cùng giao dịch sau mỗi lần ghi `finance.debt_allocations` (phiếu thu chi ghi sổ, phiếu kho tự trừ khoản đối ứng). Module Công nợ không phụ thuộc module hoa hồng | CHUC_NANG_82 |
| Bảng hoa hồng | `CommissionStatementsService` (`apps/api/src/commission/commission-statements.service.ts`): lập (khóa `finance.commission_settings` bằng `FOR UPDATE`), bỏ, gửi, rút; dãy số `ensureSequence` tiền tố `HH`; luồng duyệt `ApprovalRequestsService.submitWithin`, `withdraw`; nghe `core.approval.completed` qua outbox, loại `finance.commission`; ghi sổ bằng `commissionDraft` (`apps/api/src/accounting/postings.ts`) và `LedgerService.record`; ngày bút toán theo `ledgerSettings` (`apps/api/src/accounting/period-guard.ts`). `LedgerService` khi khởi tạo kế toán lập bút toán cho bảng đã ghi sổ trước đó | CHUC_NANG_83 |
| Định khoản | `apps/api/src/accounting/charts.ts`, `postings.ts`: vai trò `commission_expense` (6411 Thông tư 99/2025, 6421 Thông tư 133), `staff_payable` (334); nguồn bút toán `commission` | CHUC_NANG_83 |
| Bộ điều khiển | `CommissionsController` (`apps/api/src/commission/commissions.controller.ts`): API_93, API_94; kiểm `finance.access` hoặc `finance.commission.view` bằng `PermissionService.authorize`, quyền chi tiết kiểm trong service bằng `requireFinancePermission` | CHUC_NANG_80 đến CHUC_NANG_83 |
| Giao diện | `apps/web-finance`: trang `/commissions` (thẻ "Bảng hoa hồng", "Phát sinh"), `/commission-settings` (thẻ "Cài đặt", "Chỉ tiêu"); `CommissionStatements`; `FinanceShell` thêm mục menu "Hoa hồng", "Cài đặt hoa hồng" | CHUC_NANG_80, CHUC_NANG_82, CHUC_NANG_83 |

## 3m. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 6, CONG_VIEC_18)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Đọc webhook | `apps/api/src/bank/bank-webhook.ts`, không phụ thuộc dịch vụ khác: `parseWebhook` (lược đồ zod định dạng SePay, ngày giờ không múi giờ hiểu theo giờ Việt Nam), `authorized` (tiêu đề `Authorization: Apikey <khóa>`, so sánh bằng `timingSafeEqual`), `accountDigits` | CHUC_NANG_85 |
| Kết nối, giao dịch, ghép, đối chiếu | `BankReconciliationService` (`apps/api/src/bank/bank-reconciliation.service.ts`): ghi `finance.bank_connections`, `finance.bank_transactions`; khóa sinh bằng `randomBytes`, mã hóa bằng `encryptSecret` (`apps/api/src/common/secret-box.ts`); bộ giả lập chỉ khi `simulatorAllowed()` (`NODE_ENV` khác `production`, dùng chung với hóa đơn điện tử); lưu, ghép trong giao dịch cơ sở dữ liệu có khóa theo quỹ; `onModuleInit` đăng ký `PaymentsService.postedHooks` (`matchPayment`: phiếu ghi sổ thì thử ghép lại trong cùng giao dịch); lập phiếu thu từ gợi ý qua `PaymentsService.create`, `submit`; số dư sổ dùng `signedPaymentAmount` (`apps/api/src/finance/funds.service.ts`) | CHUC_NANG_84 đến CHUC_NANG_87 |
| Bộ điều khiển | `BankReconciliationController` (`apps/api/src/bank/bank-reconciliation.controller.ts`): API_95 đến API_101; kiểm `finance.access`, `finance.bank.view` hoặc `finance.bank.setup` bằng `PermissionService.authorize`, quyền chi tiết kiểm trong service bằng `requireFinancePermission`; webhook (API_98) đánh dấu `@Public()` và `@OwnRateLimit()` (`apps/api/src/auth/auth.guard.ts`) nên `AuthGuard` không giới hạn chung; service chỉ đếm lần sai khóa theo địa chỉ IP bằng `RateLimiter` (`apps/api/src/common/rate-limiter.ts`, khóa `bank-webhook-unauthorized`) | CHUC_NANG_84 đến CHUC_NANG_87 |
| Giao diện | `apps/web-finance`: trang `/bank-transactions` (MAN_HINH_58), `/bank-connections` (MAN_HINH_59); `BankTransactionActions` (lập phiếu thu, ghép tay, bỏ qua, bỏ ghép), `BankReconciliationPanel` (ô đối chiếu), dùng lại `PartnerPicker`; `FinanceShell` thêm mục menu "Giao dịch ngân hàng", "Kết nối ngân hàng" | CHUC_NANG_84 đến CHUC_NANG_87 |

## 3n. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 7, CONG_VIEC_19)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Đơn vị thu hộ, tệp mẫu, nhập tệp, ghép đơn | `CollectionStatementsService` (`apps/api/src/collection/collection-statements.service.ts`): ghi `finance.collectors`, `finance.collection_statements`, `finance.collection_statement_lines`; kiểm đối tác qua `DebtsService.requirePartnerOnSide`; tệp mẫu bằng `write-excel-file`, đọc tệp bằng `readSheet` của `read-excel-file` (thư viện đang dùng cho nhập sản phẩm, chỉ đọc giá trị ô); nhận tệp qua `FileInterceptor` (multer, bộ nhớ); nhập, gửi, ghi sổ khóa theo đơn vị thu hộ (`pg_advisory_xact_lock`); ghép đơn bằng một câu lệnh chèn theo lô 500 dòng; lỗi dòng tính bằng biểu thức SQL `lineErrorSql`, số khách còn nợ bằng `orderOpenSql` | CHUC_NANG_88, CHUC_NANG_89, CHUC_NANG_91 |
| Gửi, duyệt, ghi sổ | Cùng service: dãy số `ensureSequence` tiền tố `DST`; duyệt qua `ApprovalRequestsService.submitWithin`; `onModuleInit` nghe `core.approval.completed` qua `OutboxService` (loại `finance.collection_statement`); ghi sổ: khóa công nợ khách, đơn vị (`DebtsService.lockPartner`), khoản công nợ nguồn `collection_statement`, trừ nợ qua `DebtsService.matchCredit`, `matchDebit`; bút toán qua `LedgerService.record` với `collectionDraft` | CHUC_NANG_90 |
| Định khoản | `apps/api/src/accounting/charts.ts`, `postings.ts`: vai trò `collector_receivable` (1388), `collection_fee` (6418 Thông tư 99/2025, 6421 Thông tư 133); nguồn bút toán `collection_statement`; `LedgerService` lập bút toán cho bảng đã ghi sổ khi khởi tạo kế toán; `paymentDraft` hạch toán phiếu thu khách hàng, phiếu chi hoàn tiền của đối tác là đơn vị thu hộ vào `collector_receivable` | CHUC_NANG_90 |
| Hoa hồng | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11). `CommissionsService` (`apps/api/src/commission/commissions.service.ts`): móc nối `DebtsService.allocatedHooks` tính lần trừ nợ của khoản giảm nợ nguồn `collection_statement` vào phiếu xuất giao hàng như phiếu thu khách hàng | CHUC_NANG_90 |
| Bộ điều khiển | `CollectionStatementsController` (`apps/api/src/collection/collection-statements.controller.ts`): API_102 đến API_105; kiểm `finance.access`, `finance.collection.view` hoặc `finance.collection.setup` bằng `PermissionService.authorize`, quyền chi tiết kiểm trong service bằng `requireFinancePermission` | CHUC_NANG_88 đến CHUC_NANG_91 |
| Giao diện | `apps/web-finance`: trang `/collection-statements` (MAN_HINH_60, thẻ "Bảng đối soát", "Đơn vị thu hộ"), `/collection-statements/[id]` (MAN_HINH_61); `CollectionImportDrawer` (nhập, nhập lại, tải mẫu), `CollectionStatusBadge`; dùng lại `PartnerPicker`; `FinanceShell` thêm mục menu "Đối soát thu hộ" | CHUC_NANG_88 đến CHUC_NANG_91 |

## 3o. Thành phần phụ trợ cho MODULE_06 Tài chính – Kế toán (phần 8, CONG_VIEC_20)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Phần đọc số liệu báo cáo dùng chung | `StatementsService` (`apps/api/src/accounting/statements.service.ts`) tách phần đọc số liệu: `ledger(companies, consolidated)` trả `Ledger` (danh sách công ty, tài khoản, tài khoản lợi nhuận chưa phân phối của công ty đứng đầu, tài khoản xác định kết quả của các công ty, dòng bổ sung `extras`); `compute(ledger, template, …, withExtras)` tính cột kỳ này, cột so sánh; `templateOf`; tài khoản mang `companyId`, chỉ tiêu dư Nợ, dư Có tính theo từng công ty rồi cộng (không bù trừ số dư ngược chiều giữa các công ty); số dư, phát sinh, phát sinh đối ứng lọc `company_id IN (…)`; dòng bổ sung chỉ cộng vào cột kỳ này khi `withExtras`. `consolidatedCode` ghép mã Thông tư 133 sang Thông tư 99 (6421→641, 6422→642, 3385→3386, 3386→344, 1386→244, 2281→222). Báo cáo tài chính từng công ty (API_90) gọi `ledger` với một công ty, không ghép mã, không dòng bổ sung: kết quả như trước (kiểm thử tự động KICHBAN_KIEMTHU_218 đến KICHBAN_KIEMTHU_221 vẫn đạt, theo commit 545553d) | CHUC_NANG_74, CHUC_NANG_75, CHUC_NANG_93, CHUC_NANG_95 |
| Thành viên, bảng hợp nhất, loại trừ | `ConsolidationService` (`apps/api/src/consolidation/consolidation.service.ts`): thành viên bằng truy vấn đệ quy `core.companies` (lên công ty gốc, xuống mọi công ty con); quyền bằng `PermissionService.permissionsCovering` với phạm vi `group`; ghi `finance.consolidations`, `finance.consolidation_entries`, `finance.consolidation_profit_lines`; loại trừ công nợ đọc `accounting.journal_lines` theo đối tác có `crm.partners.company_id` là thành viên; doanh thu nội bộ đọc bút toán phiếu kho theo `accounting.posting_rules`; lãi chưa thực hiện đọc phiếu nhập mua đối ứng (`counterpart_line_id`), dòng đơn bán, `inventory.movements`; đưa bút toán vào báo cáo qua `Ledger.extras` | CHUC_NANG_92 đến CHUC_NANG_94 |
| Gửi, duyệt, chốt số, xuất | Cùng service: dãy số `ensureSequence` tiền tố `HN` của công ty gốc; duyệt qua `ApprovalRequestsService.submitWithin`; `onModuleInit` nghe `core.approval.completed` qua `OutboxService` (loại `finance.consolidation`); gửi tính lại rồi lưu báo cáo vào cột `report` (JSON), chốt số dùng số đã lưu; lập bảng, gửi đổi lỗi trùng chỉ mục duy nhất (`isUniqueViolation`) thành `consolidationPeriodExists`; xuất bằng `statementXlsx`, `statementPdf` (`apps/api/src/accounting/statement-export.ts`) | CHUC_NANG_95 |
| Bộ điều khiển | `ConsolidationController` (`apps/api/src/consolidation/consolidation.controller.ts`, đường dẫn `/finance/consolidation`): API_106 đến API_109; kiểm `finance.access`, `finance.consolidation.view` hoặc `finance.consolidation.manage` bằng `PermissionService.authorize`, quyền ở phạm vi tập đoàn kiểm trong service bằng `requireGroupPermission` | CHUC_NANG_92 đến CHUC_NANG_95 |
| Giao diện | `apps/web-finance`: trang `/consolidation` (MAN_HINH_62, thẻ "Bảng hợp nhất", "Xem nhanh cộng gộp"), `/consolidation/[id]` (MAN_HINH_63); `ConsolidatedStatementTable` (cột cộng gộp, loại trừ, hợp nhất, so sánh); dùng lại `CollectionStatusBadge` cho nhãn trạng thái; `FinanceShell` thêm mục menu "Báo cáo hợp nhất" | CHUC_NANG_92 đến CHUC_NANG_95 |

## 3p. Thành phần phụ trợ cho MODULE_07 Khách hàng và Đối tác (phần 2, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): đã xóa `apps/api/src/crm/customer-scope.ts`, `CustomerAssignmentsService`, đường dẫn API_110, API_111, nhận đối tác, trang `/customer-assignments` của `apps/web-crm`; vòng lặp thêm `crm.customer.view_all` trong `permission-catalog.ts` đã bỏ. Bảng `crm.customer_assignments`, `crm.customer_assignment_lines`, `crm.partner_owner_history` giữ trong cơ sở dữ liệu, không còn mã dùng. Bảng dưới đây giữ để tra cứu.

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Phạm vi xem dùng chung | `apps/api/src/crm/customer-scope.ts`: `customerScope` (có `crm.customer.view_all` trong công ty qua `PermissionService.permissionsInCompany` thì `all`, không thì `owned` với danh sách nhân viên), `managedUsers` (truy vấn đệ quy `core.departments` theo `manager_user_id`, `parent_id`, lấy thành viên đang hoạt động của các phòng, gồm chính mình), `ownedCustomer` (biểu thức SQL `EXISTS` trên `crm.partner_profiles` theo công ty, khách, `is_customer`, `owner_user_id`), `visibleOrder` (khách thuộc phạm vi hoặc `created_by`, `commission_user_id` trong danh sách), `recordOwner` (đóng dòng lịch sử đang mở, mở dòng mới trong `crm.partner_owner_history`). Một điều kiện SQL dùng chung, đặt trong câu truy vấn của `PartnersService` (danh sách, chi tiết, số Căn cước công dân, sửa hồ sơ, thêm đối tác, nhận đối tác) và `SalesOrdersService` (tùy chọn, tra giá, danh sách, chi tiết, `prepare` khi lập, sửa; `ensureVisible` trước gửi, rút, hủy, đóng, xác nhận, từ chối đơn đối ứng) | CHUC_NANG_96, CHUC_NANG_98 |
| Phiếu giao khách | `CustomerAssignmentsService` (`apps/api/src/crm/customer-assignments.service.ts`): ghi `crm.customer_assignments`, `crm.customer_assignment_lines`; quyền giao khách bằng `PermissionService.permissionsCovering` với phạm vi `company` (gồm quyền gán ở tập đoàn), trưởng phòng theo `core.departments.manager_user_id`; dãy số `ensureSequence` tiền tố `GK`; duyệt qua `ApprovalRequestsService.submitWithin` (giá trị 0; lỗi `policyNotFound` thì áp dụng ngay); `onModuleInit` nghe `core.approval.completed` qua `OutboxService` (loại `crm.customer_assignment`); gửi, áp dụng khóa hồ sơ các khách theo thứ tự `partner_id` (`FOR UPDATE`); áp dụng đổi `crm.partner_profiles.owner_user_id`, ghi lịch sử bằng `recordOwner`, gửi thông báo bằng `notify` (`apps/api/src/common/notifications.ts`); lịch sử phụ trách (API_111) | CHUC_NANG_97, CHUC_NANG_98 |
| Quyền, loại chứng từ | `apps/api/src/permissions/permission-catalog.ts`: quyền `crm.customer.view_all`, `crm.customer.assign`; vòng lặp thêm `crm.customer.view_all` cho vai trò hệ thống đang có `crm.partner.view` hoặc `sales.order.view` (trừ `salesperson`); loại chứng từ `crm.customer_assignment` | CHUC_NANG_96, CHUC_NANG_97 |
| Bộ điều khiển | `CrmController` (`apps/api/src/crm/crm.controller.ts`): API_110, API_111, nhận đối tác; kiểm `crm.access`, `crm.partner.view` bằng `PermissionService.authorize`; quyền giao khách, phạm vi kiểm trong service | CHUC_NANG_96 đến CHUC_NANG_98 |
| Giao diện | `apps/web-crm`: trang `/customer-assignments` (MAN_HINH_64), `/customer-assignments/new`, `/customer-assignments/[id]` (MAN_HINH_65); `AssignmentForm`, `AssignmentStatusBadge`; `/partners` (MAN_HINH_36) thêm lọc "Khách của tôi", cột nhân viên phụ trách; `/partners/[id]` (MAN_HINH_37) thêm thẻ lịch sử phụ trách, khóa ô nhân viên phụ trách khi đã có; `PartnerDrawer` thêm nút "Nhận làm khách của tôi"; `CrmShell` thêm mục menu "Giao khách hàng" | CHUC_NANG_96 đến CHUC_NANG_98 |

## 3q. Thành phần đặt hàng trên VComm (MODULE_09 phần lõi 2, CONG_VIEC_24)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Cửa hàng, giỏ hàng, sổ địa chỉ | `StoreService`, `ShopService` (`apps/api/src/marketplace/store.service.ts`, `shop.service.ts`): giá theo `lookupPrice` của bảng giá kênh VComm, số có thể bán từ tồn trừ giữ hàng | CHUC_NANG_113 đến CHUC_NANG_115 |
| Đơn VComm | `MarketplaceOrdersService` (`marketplace-orders.service.ts`) dùng `SalesOrdersService` (`quoteMarketplace`, `placeMarketplaceWithin`, `cancelMarketplaceWithin`): đơn người mua là đơn bán của công ty vận hành sàn, giữ hàng không thời hạn | CHUC_NANG_116 |
| Khung đơn vị vận chuyển | Giao diện `CarrierAdapter` (`marketplace/carriers/carrier.ts`): tạo, hủy, tra vận đơn, đọc mã từ webhook, phân loại trạng thái; `carrier-registry.ts` đọc thông tin kết nối từ biến môi trường; `GhnCarrier` (`ghn-carrier.ts`) gọi REST GHN bằng `fetch`, chờ tối đa 15 giây, địa chỉ hai cấp (`to_ward_name`, `to_province_name`, `is_new_to_address`) | CHUC_NANG_117 |
| Giao, webhook | `ShipmentsService` (`shipments.service.ts`), `CarrierWebhookController` (`carrier-webhook.controller.ts`): giao đơn lập phiếu xuất nháp và vận đơn; webhook kiểm khóa, tra lại trạng thái, ghi sổ phiếu xuất, phiếu nhận hàng trả lại qua `SalesDeliveriesService.postDraftAsSystem`, `returnAsSystem` | CHUC_NANG_117 |
| Trả hàng | `ReturnRequestsService` (`return-requests.service.ts`): ảnh lưu kho tệp, nhận hàng trả qua `returnAsSystem`, thông báo trong ứng dụng | CHUC_NANG_118 |
| Tác vụ nền | `apps/api/src/jobs/background-jobs.ts`: `marketplace-order-completion` mỗi giờ trên hàng đợi `nen-tang` gọi `MarketplaceOrdersService.completeDue` | CHUC_NANG_119 |
| Giao diện | `apps/mobile-vcomm`: thẻ Cửa hàng, Đơn hàng; màn hình sản phẩm, giỏ, đặt hàng, sổ địa chỉ, chi tiết đơn, trả hàng; `apps/web-crm`: `/store-settings`, `/listings`, `/orders`, `/return-requests` | MAN_HINH_86 đến MAN_HINH_97 |

## 3r. Thành phần thanh toán đơn người mua (MODULE_09 phần lõi 3, CONG_VIEC_25)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Khung cổng thanh toán | `payment-gateway-registry.ts` (`apps/api/src/marketplace/payments/`): đọc thông tin kết nối từ biến môi trường, cổng của phương thức; `StoreService.setPaymentMethod`, `setOrderingOpen` | CHUC_NANG_120 |
| Kết nối VNPAY | `vnpay.ts`: đường dẫn thanh toán phiên bản 2.1.0, ký và kiểm chữ ký HMAC SHA512 bằng `node:crypto` (`timingSafeEqual`); không thêm thư viện | CHUC_NANG_121 |
| Thanh toán, IPN | `MarketplacePaymentsService` (`payments.service.ts`), `PaymentsController` (`payments.controller.ts`): tạo lần thanh toán, nhận IPN, trang trả về chỉ hiển thị, lưu kết quả cổng gửi về | CHUC_NANG_121 |
| Hoàn tiền | `RefundsService`, `RefundsController` (`refunds.service.ts`, `refunds.controller.ts`); `refund-amounts.ts` lập việc hoàn khi nhận hàng trả; `refundRemainingPaid` (`marketplace-orders.service.ts`) khi hủy đơn đã thu | CHUC_NANG_122 |
| Đối soát COD | `CarrierAdapter.shipmentInfo` (GHN: `cod_collect_date` của API chi tiết đơn) áp trong `ShipmentsService`; `MarketplaceOrdersService.recordCodCollected` ghi tay | CHUC_NANG_124 |
| Bút toán, hóa đơn | `marketplacePaymentDraft`, `marketplaceRefundDraft`, dòng phí giao hàng trong `inventoryDraft` (`apps/api/src/accounting/postings.ts`); `EinvoicesService` thêm dòng "Phí giao hàng" | CHUC_NANG_123 |
| Tác vụ nền | `background-jobs.ts`: `marketplace-payment-expiry` mỗi phút trên hàng đợi `nen-tang` gọi `MarketplacePaymentsService.expireDue` | CHUC_NANG_121 |
| Giao diện | `apps/mobile-vcomm`: chọn phương thức ở `dat-hang.tsx`, khối thanh toán ở `don-hang/[id].tsx`, `tai-khoan-hoan-tien.tsx`; `apps/web-crm`: `/store-settings`, `/orders/[id]`, `/refunds` | MAN_HINH_86, MAN_HINH_88, MAN_HINH_93, MAN_HINH_96, MAN_HINH_98 đến MAN_HINH_100 |

## 3s. Thành phần sửa theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Loại sản phẩm | `ProductsService` (`apps/api/src/catalog/products.service.ts`): cột `kind`; dịch vụ không theo dõi lô, serial; `requireKindChangeable` đọc tồn, dòng phiếu kho, giữ hàng, dòng kiểm kê (chỉ đọc bảng của Kho) | CHUC_NANG_157 |
| Chặn dịch vụ ở kho | `requireStockedVariant` (`apps/api/src/inventory/inventory-context.ts`) gọi ở `ReservationsService.reserve` và `StockLedgerService` (chốt chặn cuối); `StockDocumentsService` báo lỗi theo dòng; `StocktakesService` chặn kiểm kê danh sách có dịch vụ; `SalesDeliveriesService` bỏ đơn, dòng dịch vụ | CHUC_NANG_157 |
| Đơn bán tay, giao dịch nội bộ | `goodsVariants`, `allowsManualGoodsOrders`, `requireManualOrderLines` (`apps/api/src/sales/sales-context.ts`); `internal-trade-rules.ts` thêm lỗi `internalServicesOnly` theo dòng; `SalesOrdersService` bỏ dịch vụ khỏi giữ hàng | CHUC_NANG_157, CHUC_NANG_158 |
| Phiếu dịch vụ | `ServiceDocumentsService` (`apps/api/src/inventory/service-documents.service.ts`) đăng ký `SalesOrdersService.confirmedHooks`, `PurchaseOrdersService.approvedHooks`; gọi `StockDocumentsService.postServiceDocument` (cấp số, ghi sổ ngay với `is_service`, không ghi thẻ kho, chạy `postedHooks`: công nợ, hóa đơn điện tử, bút toán) | CHUC_NANG_157 |
| Định khoản | `inventoryDraft` (`apps/api/src/accounting/postings.ts`): phiếu xuất dịch vụ Nợ `receivable` / Có `service_revenue` / Có `vat_output`; phiếu nhập dịch vụ Nợ `service_expense` / Nợ `vat_input` / Có `payable`; vai trò `service_expense` (6427 Thông tư 99, 6422 Thông tư 133) trong `charts.ts` | CHUC_NANG_157 |
| Phạm vi xem, ghé thăm | `PartnersService`, `SalesOrdersService`, `VisitsService` bỏ điều kiện phạm vi; `VisitsService.staffOptions` cho `GET /crm/visit-options` | CHUC_NANG_158 |
| Giao diện | `apps/web-catalog`: chọn loại ở chi tiết sản phẩm; `apps/web-sales`: công tắc cài đặt, bỏ người hưởng hoa hồng; `apps/web-inventory`: nhãn "Phiếu dịch vụ"; `apps/web-crm`: bỏ giao khách, lọc người phụ trách, nhận khách, lịch sử phụ trách; `apps/web-finance`: bỏ Hoa hồng, Cài đặt hoa hồng | CHUC_NANG_157, CHUC_NANG_158 |

## 4. Kiến trúc triển khai

| Môi trường | Mục đích | Hạ tầng |
|---|---|---|
| Phát triển | Máy lập trình viên và phiên AI | Docker Compose: PostgreSQL 16, Redis; gửi email, SMS giả lập ghi ra log |
| Thử nghiệm (staging) | Người dùng nghiệm thu trước khi lên môi trường thật | AWS, cấu hình nhỏ, Aurora Serverless v2 tự dừng, không NAT, tắt ngoài giờ làm việc, dữ liệu giả |
| Thật | Vận hành | AWS vùng Singapore, ECS Fargate chip Arm tối thiểu 2 bản chạy song song mỗi dịch vụ, Aurora PostgreSQL nhiều vùng sẵn sàng (giai đoạn 1: 2×db.t4g.medium, 1 NAT gateway) |

- Mọi môi trường AWS dựng bằng AWS CDK; khóa bí mật mỗi môi trường khác nhau.
- Database migration chạy một lần trước khi bật phiên bản mới, cùng thứ tự ở mọi môi trường.

## 3w. Thành phần phụ trợ cho MODULE_08 Nhân sự (phần 1, CONG_VIEC_46)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Hồ sơ, giấy tờ, người phụ thuộc | `EmployeesService` (`apps/api/src/hr/employees.service.ts`); ghi schema `hr`; mã hóa cột bằng `apps/api/src/common/secret-box.ts` (thêm `blindIndex` HMAC-SHA256 để kiểm trùng); tệp qua `FILE_STORAGE` khóa `hr/<công ty>/employees/<hồ sơ>/<mã ngẫu nhiên>` | CHUC_NANG_162 |
| Quá trình công tác | `WorkEventsService` (`apps/api/src/hr/work-events.service.ts`); cập nhật `core.user_company_memberships` qua `updateMembershipPlacement` (`apps/api/src/users/membership-placement.ts`) trong giao dịch của Nhân sự; việc nền `hr-work-events` lúc 0 giờ 5 phút | CHUC_NANG_162 |
| Hợp đồng, phụ lục, nghỉ việc | `ContractsService` (`apps/api/src/hr/contracts.service.ts`); luồng duyệt chung (`submitWithin`, `withdraw`, `cancelWithin`; nghe `core.approval.completed`, loại `hr.contract`, `hr.contract_appendix`); dãy số `hr.contract`; thông báo quản trị khi nghỉ việc | CHUC_NANG_163 |
| Nhắc hết hạn | `ContractRemindersService` (`apps/api/src/hr/contract-reminders.service.ts`); việc nền `hr-contract-reminders` lúc 7 giờ; bảng `hr.contract_reminders` giữ mốc đã gửi | CHUC_NANG_164 |
| Giao diện | Mini app `apps/web-hr`: trang `/employees`, `/employees/new`, `/employees/[id]`, `/employees/[id]/edit`, `/contracts`, `/contracts/new`, `/contracts/[id]`, `/me` | CHUC_NANG_162 đến CHUC_NANG_164 |

## 3x. Thành phần phụ trợ cho MODULE_08 Nhân sự (phần 2, CONG_VIEC_47)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Thiết lập chấm công | `AttendanceSetupService` (`apps/api/src/hr/attendance-setup.service.ts`): cài đặt, ca, lịch tuần, gán lịch, xếp ca, ngày lễ | CHUC_NANG_165 |
| Lượt chấm, công ngày | `AttendanceService`, `AttendanceDaysService`, hàm thuần `attendance-calculator.ts` (tính công, giờ đêm, tăng ca); đọc CSV tự viết, Excel bằng `read-excel-file`; việc nền `hr-attendance-recalculate` lúc 1 giờ | CHUC_NANG_165 |
| Chấm công ứng dụng | `AttendanceLocationsService` (mã QR ký HMAC-SHA256 bằng khóa dẫn xuất từ `MFA_SECRET_KEY`, khung 30 giây, nhận khung liền trước; khoảng cách theo công thức haversine; so dải CIDR), `MyAttendanceService`; trình duyệt dùng API định vị, `qrcode-generator` vẽ mã | CHUC_NANG_165 |
| Quyền theo phạm vi | `attendance-access.ts`: quyền bao trùm công ty hoặc trưởng phòng (phòng ban đệ quy theo `core.departments.manager_user_id`) | CHUC_NANG_165 đến CHUC_NANG_167 |
| Nghỉ phép | `LeaveService` (luồng duyệt `hr.leave_request`, sổ phép); việc nền `hr-leave-accrual` lúc 0 giờ 15 phút (cộng phép tháng, hết hạn phép tồn) | CHUC_NANG_166 |
| Tăng ca | `OvertimeService` (luồng duyệt `hr.overtime_request`, kiểm giới hạn, thông báo đồng ý, nhắc vượt 200 giờ) | CHUC_NANG_167 |
| Bảng công tháng | `TimesheetsService` (tổng hợp dòng, xác nhận, chốt, mở lại, xuất Excel `write-excel-file`; phát `hr.timesheet.closed`, `hr.timesheet.reopened`); việc nền `hr-timesheet-confirmation` lúc 0 giờ 30 phút | CHUC_NANG_167 |
| Giao diện | `apps/web-hr`: `/attendance`, `/work-schedules`, `/work-schedules/qr/[id]`, `/my-attendance`, `/leave`, `/overtime`, `/timesheets` | CHUC_NANG_165 đến CHUC_NANG_167 |

CONG_VIEC_48 (lương) đọc `hr.timesheet_lines` của kỳ đã chốt, ghi `hr.timesheet_periods.payroll_locked_at` khi chốt lương; nghe `hr.timesheet.closed`, `hr.timesheet.reopened`.
## 5. Sao lưu, phục hồi, ghi log, giám sát

- Sao lưu: Aurora tự sao lưu hằng ngày, giữ 35 ngày, phục hồi về một thời điểm bất kỳ trong khoảng đó; sao lưu được mã hóa.
- Phục hồi: diễn tập phục hồi vào môi trường thử nghiệm mỗi quý.
- Ghi log: log có cấu trúc (JSON) đẩy về CloudWatch, mỗi yêu cầu có mã yêu cầu; không ghi mật khẩu, mã OTP, token.
- Giám sát: Sentry cho lỗi ứng dụng; cảnh báo CloudWatch khi tỷ lệ lỗi, độ trễ, đăng nhập thất bại tăng bất thường.

## 6. Cấu trúc thư mục

Chia theo phần chạy riêng của hệ thống, bên trong chia theo module. Chỉ tạo thư mục khi có mã cần đặt vào.

```
apps/
  api/                  Backend NestJS. Mỗi module một thư mục: src/core, src/catalog, src/inventory, src/crm, src/purchasing, src/sales, src/finance, src/accounting, src/einvoice, src/bank, src/collection, src/consolidation...
                        Không chứa mã giao diện.
  web-platform/         Mini app Nền tảng và trang chủ mini app.
  web-<module>/         Mỗi mini app quản trị doanh nghiệp một thư mục (web-catalog, web-inventory, web-crm, web-purchasing, web-sales, web-finance...).
                        Chỉ gọi API, không truy cập cơ sở dữ liệu.
  mobile-warehouse/     Ứng dụng kho (Expo).
  mobile-vcomm/         Ứng dụng VComm cho người mua, có phần kinh doanh cho nhân viên kinh doanh (Expo; CONG_VIEC_23).
packages/
  ui/                   Thành phần giao diện dùng chung, sinh từ tài liệu 15.
  auth/                 Đăng nhập một lần và kiểm tra quyền phía giao diện.
  i18n/                 Tệp dịch tiếng Việt, tiếng Anh.
  contracts/            Kiểu dữ liệu và lược đồ API dùng chung giữa backend và giao diện.
database/
  migrations/           Database migration theo thứ tự, mỗi tệp thuộc một schema.
tai_lieu/               Bộ tài liệu dự án.
```

## 7. Ràng buộc kỹ thuật

- Phải có kiểm thử tự động cho phân quyền theo phạm vi ngay từ MODULE_01, vì lỗi ở đây làm lộ dữ liệu giữa các công ty.
- Ranh giới schema phải được giữ nghiêm để có thể tách dịch vụ sau này.
- **CHƯA XÁC ĐỊNH:** yêu cầu lưu trữ dữ liệu cá nhân trong nước có áp dụng hay không (chờ ý kiến luật sư). Không chặn MODULE_01 vì dữ liệu cá nhân chỉ gồm thông tin nhân viên; chặn trước giai đoạn 2.

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| Mục 4 | Có môi trường thử nghiệm (staging) riêng; môi trường thật chạy tối thiểu 2 bản mỗi dịch vụ, Aurora nhiều vùng sẵn sàng |
| Mục 5 | Giữ sao lưu 35 ngày; diễn tập phục hồi mỗi quý |

## 3x. Thành phần phụ trợ cho MODULE_08 Nhân sự (phần 3, CONG_VIEC_48)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Thiết lập lương | `PayrollSetupService` (`apps/api/src/hr/payroll-setup.service.ts`); bảng tham số dùng chung tập đoàn trong schema `hr` | CHUC_NANG_168 |
| Tính lương | Hàm thuần `calculateLine` (`apps/api/src/hr/payroll-calculation.ts`), tiền bằng `bigint` | CHUC_NANG_169 |
| Bảng lương | `PayrollsService` (`apps/api/src/hr/payrolls.service.ts`); luồng duyệt chung (loại `hr.payroll`, nghe `core.approval.completed`); dãy số `BL`; xuất Excel bằng `write-excel-file` | CHUC_NANG_169 |
| Đọc bảng công | `PayrollTimesheetReader` (`apps/api/src/hr/payroll-timesheet.ts`), token `PAYROLL_TIMESHEET`; đọc bảng công tháng của CONG_VIEC_47 | CHUC_NANG_169 |
| Bút toán lương | `payrollDraft`, `payrollPaymentDraft` (`apps/api/src/accounting/postings.ts`) ghi qua `LedgerService.record`; vai trò định khoản mới theo Thông tư 99/2025, Thông tư 133 | CHUC_NANG_170 |
| Phiếu lương | Thông báo chuông (`notify`), email qua `OUTBOUND_MESSAGES` sau khi giao dịch duyệt xong | CHUC_NANG_170 |
| Giao diện | Mini app `apps/web-hr`: `/payrolls`, `/payrolls/[id]`, `/payroll-settings`, thẻ "Lương, thuế" của `/employees/[id]`, thẻ "Phiếu lương" của `/me` | CHUC_NANG_168 đến CHUC_NANG_170 |

## 3y. Thành phần phụ trợ cho MODULE_08 Nhân sự (phần 4: tuyển dụng, đánh giá hiệu suất, CONG_VIEC_54)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Nhu cầu, tin tuyển dụng | `RecruitmentService` (`apps/api/src/hr/recruitment.service.ts`), bộ điều khiển `RecruitmentController` (`apps/api/src/hr/recruitment.controller.ts`, API_200 đến API_203, kiểm `hr.access` rồi quyền chi tiết trong service); luồng duyệt chung (`submitWithin`, `withdraw`, `cancelWithin`; nghe `core.approval.completed`, loại `hr.recruitment_request`); dãy số `hr.recruitment_request` (mặc định `TD`) | CHUC_NANG_190 |
| Trang tuyển dụng công khai | `CareersController` (`apps/api/src/hr/careers.controller.ts`, API_204) đánh dấu `@Public()` và `@NoRateLimit()` (`apps/api/src/auth/auth.guard.ts`): không đăng nhập, không giới hạn theo IP (THAY_DOI_23); giao diện `apps/web-hr/src/app/careers` ở đường dẫn `/hr/careers`, khung `CareersFrame` thay khung mini app (`HrShell` bỏ qua đường dẫn `/careers`) | CHUC_NANG_190 |
| Ứng viên, đồng ý, lưu giữ, xóa | `CandidatesService` (`apps/api/src/hr/candidates.service.ts`); tệp qua `FILE_STORAGE` khóa `hr/<công ty>/candidates/<mã ngẫu nhiên>`; kiểm chữ ký đầu tệp PDF, DOCX, JPG, PNG; việc nền `hr-candidate-erasure` lúc 1 giờ (xóa tệp trước, khử nhận dạng trong giao dịch; ứng viên lỗi không chặn ứng viên khác) | CHUC_NANG_191 |
| Vòng phỏng vấn, email ứng viên | `InterviewsService` (`apps/api/src/hr/interviews.service.ts`); `InterviewerController` (`apps/api/src/hr/interviewer.controller.ts`, `/hr/my-interviews`, chỉ cần là thành viên công ty); mẫu email, tệp lịch iCalendar `invite.ics` (`apps/api/src/hr/recruitment-emails.ts`, SEQUENCE tăng khi đổi giờ, METHOD:CANCEL khi hủy); gửi qua `OUTBOUND_MESSAGES` của Nền tảng, mở rộng tệp đính kèm không bắt buộc (trình ghi log chỉ ghi tên tệp) | CHUC_NANG_191 |
| Đề nghị nhận việc, lập hồ sơ nhân sự | `JobOffersService` (`apps/api/src/hr/job-offers.service.ts`); luồng duyệt chung loại `hr.job_offer`, dãy số `DNNV`; liên kết trả lời: mã 32 byte ngẫu nhiên (`randomBytes`), chỉ lưu mã băm SHA-256; `OfferAnswersController` (`apps/api/src/hr/offer-answers.controller.ts`, `/job-offer-responses/{mã}`) `@Public()` giữ giới hạn 20 yêu cầu mỗi phút mỗi IP; lập hồ sơ qua `EmployeesService.create` với tham số `afterCreate` (cùng giao dịch: liên kết hồ sơ ứng tuyển, chép sơ yếu lý lịch, khóa nhu cầu `FOR UPDATE` tăng số đã tuyển); việc nền `hr-recruitment-daily` lúc 0 giờ 10 phút (đóng tin quá hạn, đề nghị hết hạn) | CHUC_NANG_190, CHUC_NANG_191 |
| Đánh giá hiệu suất | `ReviewsService` (`apps/api/src/hr/reviews.service.ts`), `ReviewsController` (`apps/api/src/hr/reviews.controller.ts`, API_205; quyền `hr.review.manage`, người chấm, nhân viên kiểm trong service); việc nền `hr-review-reminders` lúc 8 giờ, bảng `hr.review_reminders` giữ lần đã nhắc | CHUC_NANG_192 |
| Giao diện | Mini app `apps/web-hr`: trang `/recruitment`, `/recruitment/[id]`, `/recruitment/postings/[id]`, `/candidates`, `/candidates/[id]`, `/candidates/[id]/hire`, `/interviews`, `/interviews/[id]`, `/careers`, `/careers/[id]`, `/careers/offers/[token]`, `/reviews`, `/reviews/[id]`, `/my-reviews`, `/my-reviews/[id]`; menu `HrShell` thêm Tuyển dụng, Ứng viên, Phỏng vấn của tôi, Đánh giá hiệu suất, Đánh giá của tôi | CHUC_NANG_190 đến CHUC_NANG_192 |

Việc nền mới đăng ký trong `apps/api/src/jobs/background-jobs.ts` (BullMQ, múi giờ `Asia/Ho_Chi_Minh`): `hr-recruitment-daily` (`10 0 * * *`), `hr-candidate-erasure` (`0 1 * * *`), `hr-review-reminders` (`0 8 * * *`). Module chỉ ghi schema `hr`; không thêm thư viện.
