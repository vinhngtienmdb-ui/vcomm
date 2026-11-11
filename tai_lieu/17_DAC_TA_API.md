# 17. ĐẶC TẢ API

- Mô tả: Hợp đồng API: endpoint, phương thức, dữ liệu gửi lên, dữ liệu trả về, xác thực, phân quyền, kiểm tra dữ liệu, lỗi, phân trang.
- Phiên bản: 2.14
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09): thêm API_49 đến API_54; bổ sung API_02 đến API_05; CONG_VIEC_04 (2026-11-09): thêm API_55 đến API_62 của MODULE_02 (mục 2a, 3a); CONG_VIEC_05 (2026-11-10): thêm API_63 đến API_70 của MODULE_03 (mục 2b, 3b); CONG_VIEC_06 (2026-11-10): thêm API_71, API_72 của MODULE_07 (mục 2c, 3c); CONG_VIEC_07 (2026-11-10): thêm API_73 đến API_76 của MODULE_04 (mục 2d, 3d); bổ sung API_55, API_65; CONG_VIEC_08 (2026-11-10): thêm API_77 đến API_79 của MODULE_05 (mục 2e, 3e); bổ sung API_65; CONG_VIEC_09 (2026-11-10): thêm API_80 đến API_82 giao dịch nội bộ (mục 2f, 3f); bổ sung API_65, API_73, API_75, API_76, API_77, API_79; CONG_VIEC_12 (2026-11-10): thêm API_83 khuyến mãi (mục 2g, 3g); bổ sung API_77; CONG_VIEC_13 (2026-11-10): thêm API_84 đến API_86 của MODULE_06 phần 1 (mục 2h, 3h); sửa API_77 kiểm hạn mức theo dư nợ thật; CONG_VIEC_14 (2026-11-10): thêm API_87 đến API_89 của MODULE_06 phần 2 (mục 2i, 3i); bổ sung API_20 (từ chối đổi chế độ kế toán khi đã có bút toán); ghi sổ chứng từ kiểm kỳ khóa sổ; CONG_VIEC_15 (2026-11-10): thêm API_90 báo cáo tài chính của MODULE_06 phần 3 (mục 2j, 3j); bổ sung API_87 (`isLongTerm`); CONG_VIEC_16 (2026-11-10): thêm API_91, API_92 hóa đơn điện tử của MODULE_06 phần 4 (mục 2k, 3k); bổ sung ghi sổ phiếu xuất giao hàng, phiếu nhận hàng trả lại (API_65); CONG_VIEC_17 (2026-11-10): thêm API_93, API_94 hoa hồng đội kinh doanh của MODULE_06 phần 5 (mục 2l, 3l); bổ sung gửi đơn bán (API_77), ghi sổ phiếu thu chi, phiếu kho (API_65, API_86), vai trò định khoản (API_87); CONG_VIEC_18 (2026-11-10): thêm API_95 đến API_101 đối soát ngân hàng của MODULE_06 phần 6 (mục 2m, 3m); bổ sung ghi sổ phiếu thu chi (API_86); CONG_VIEC_19 (2026-11-10): thêm API_102 đến API_105 đối soát thu hộ của MODULE_06 phần 7 (mục 2n, 3n); bổ sung công nợ (API_85), định khoản, khởi tạo kế toán (API_87), bút toán (API_88: lọc nguồn `commission`, `collection_statement`); CONG_VIEC_20 (2026-11-10): thêm API_106 đến API_109 báo cáo tài chính hợp nhất của MODULE_06 phần 8 (mục 2o, 3o); bổ sung báo cáo tài chính (API_90) dùng chung phần đọc số liệu, hợp đồng không đổi; sửa sau rà soát: trả trước nội bộ, chốt số khi gửi, `companyId`, `partnerId` của điều chỉnh tay, `accountOptions[].byPartner`, `memberOptions`, `partnerOptions`; CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm API_110, API_111 gán khách hàng cho nhân viên kinh doanh của MODULE_07 phần 2 (mục 2p, 3p); sửa API_71 (lọc `owner`, `ownerUserName`, `canClaim`, phạm vi xem), API_72 (nhân viên phụ trách chỉ đặt khi chưa có), API_77, API_80 (phạm vi xem đơn bán, ngoài phạm vi trả `404`); CONG_VIEC_23 (2026-11-10): thêm API_116 đến API_119 (đăng ký, đăng nhập, tài khoản người mua; quản trị người mua); API_112 làm mới nhận mọi phiên ứng dụng di động; nhóm giới hạn số lần gọi chung cho đăng nhập; CONG_VIEC_27 (2026-11-10): thêm API_120 đến API_122 (đội kinh doanh); CONG_VIEC_24 (2026-11-11): thêm API_123 đến API_129 của MODULE_09 (đặt hàng trên VComm; mục 3s); `GET /marketplace/buyers/{id}` thêm `isTestBuyer`; CONG_VIEC_25 (2026-11-11): thêm API_130 đến API_133 của MODULE_09 (thanh toán đơn người mua; mục 3t); API_123 thêm `orderingOpen`, `paymentMethods`; API_126 thêm `paymentMethods`, `paymentMethod`, trường thanh toán của chi tiết đơn; API_127 thêm `payments`, `canRecordCod`, trạng thái `awaiting_payment`; CONG_VIEC_26 (2026-11-11): thêm API_134 đến API_136 của MODULE_09 (hoa hồng theo đơn và ví hoa hồng, phí rút tiền theo THAY_DOI_17; mục 3u); API_123 thêm `commissionSettings`, danh sách đăng bán thêm `commission`; API_127 thêm `commissions`; API_122 thêm `creditedCommission`, `pendingCommission`; CONG_VIEC_43 (2026-11-11), THAY_DOI_18: bỏ API_93, API_94 (CONG_VIEC_17) và `GET /finance/my-commissions`; tắt API_110, API_111 (CONG_VIEC_21); thêm `GET /crm/visit-options`; API_56 thêm `kind`; API_78 thêm `allowManualGoodsOrders`; API_77 bỏ `commissionUserName`, kiểm đơn bán tay chỉ dịch vụ; API_65 thêm `isService`; API_71 bỏ lọc `owner`, `canClaim`; lỗi mới `manualOrderServicesOnly`, `internalServicesOnly`, `serviceNotStocked`, `serviceNoTracking`, `productKindLocked` (mục 3v); CONG_VIEC_44 (2026-11-11): thêm API_137 đến API_139 (ứng dụng kho; mục 3w); API_67 đếm mù, thêm `canCount`; `GET /inventory/sales-orders` thêm `warehouseId`
- Thay đổi theo: THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09): thêm API_49 đến API_54; bổ sung API_02 đến API_05; CONG_VIEC_04 (2026-11-09): thêm API_55 đến API_62 của MODULE_02 (mục 2a, 3a); CONG_VIEC_05 (2026-11-10): thêm API_63 đến API_70 của MODULE_03 (mục 2b, 3b); CONG_VIEC_06 (2026-11-10): thêm API_71, API_72 của MODULE_07 (mục 2c, 3c); CONG_VIEC_07 (2026-11-10): thêm API_73 đến API_76 của MODULE_04 (mục 2d, 3d); bổ sung API_55, API_65; CONG_VIEC_08 (2026-11-10): thêm API_77 đến API_79 của MODULE_05 (mục 2e, 3e); bổ sung API_65; CONG_VIEC_09 (2026-11-10): thêm API_80 đến API_82 giao dịch nội bộ (mục 2f, 3f); bổ sung API_65, API_73, API_75, API_76, API_77, API_79; CONG_VIEC_12 (2026-11-10): thêm API_83 khuyến mãi (mục 2g, 3g); bổ sung API_77; CONG_VIEC_13 (2026-11-10): thêm API_84 đến API_86 của MODULE_06 phần 1 (mục 2h, 3h); sửa API_77 kiểm hạn mức theo dư nợ thật; CONG_VIEC_14 (2026-11-10): thêm API_87 đến API_89 của MODULE_06 phần 2 (mục 2i, 3i); bổ sung API_20 (từ chối đổi chế độ kế toán khi đã có bút toán); ghi sổ chứng từ kiểm kỳ khóa sổ; CONG_VIEC_15 (2026-11-10): thêm API_90 báo cáo tài chính của MODULE_06 phần 3 (mục 2j, 3j); bổ sung API_87 (`isLongTerm`); CONG_VIEC_16 (2026-11-10): thêm API_91, API_92 hóa đơn điện tử của MODULE_06 phần 4 (mục 2k, 3k); bổ sung ghi sổ phiếu xuất giao hàng, phiếu nhận hàng trả lại (API_65); CONG_VIEC_17 (2026-11-10): thêm API_93, API_94 hoa hồng đội kinh doanh của MODULE_06 phần 5 (mục 2l, 3l); bổ sung gửi đơn bán (API_77), ghi sổ phiếu thu chi, phiếu kho (API_65, API_86), vai trò định khoản (API_87); CONG_VIEC_18 (2026-11-10): thêm API_95 đến API_101 đối soát ngân hàng của MODULE_06 phần 6 (mục 2m, 3m); bổ sung ghi sổ phiếu thu chi (API_86); CONG_VIEC_19 (2026-11-10): thêm API_102 đến API_105 đối soát thu hộ của MODULE_06 phần 7 (mục 2n, 3n); bổ sung công nợ (API_85), định khoản, khởi tạo kế toán (API_87), bút toán (API_88: lọc nguồn `commission`, `collection_statement`); CONG_VIEC_20 (2026-11-10): thêm API_106 đến API_109 báo cáo tài chính hợp nhất của MODULE_06 phần 8 (mục 2o, 3o); bổ sung báo cáo tài chính (API_90) dùng chung phần đọc số liệu, hợp đồng không đổi; sửa sau rà soát: trả trước nội bộ, chốt số khi gửi, `companyId`, `partnerId` của điều chỉnh tay, `accountOptions[].byPartner`, `memberOptions`, `partnerOptions`; CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm API_110, API_111 gán khách hàng cho nhân viên kinh doanh của MODULE_07 phần 2 (mục 2p, 3p); sửa API_71 (lọc `owner`, `ownerUserName`, `canClaim`, phạm vi xem), API_72 (nhân viên phụ trách chỉ đặt khi chưa có), API_77, API_80 (phạm vi xem đơn bán, ngoài phạm vi trả `404`); CONG_VIEC_23 (2026-11-10): thêm API_116 đến API_119 (đăng ký, đăng nhập, tài khoản người mua; quản trị người mua); API_112 làm mới nhận mọi phiên ứng dụng di động; nhóm giới hạn số lần gọi chung cho đăng nhập; CONG_VIEC_27 (2026-11-10): thêm API_120 đến API_122 (đội kinh doanh); CONG_VIEC_24 (2026-11-11): thêm API_123 đến API_129 của MODULE_09 (đặt hàng trên VComm; mục 3s); `GET /marketplace/buyers/{id}` thêm `isTestBuyer`; CONG_VIEC_25 (2026-11-11): thêm API_130 đến API_133 của MODULE_09 (thanh toán đơn người mua; mục 3t); API_123 thêm `orderingOpen`, `paymentMethods`; API_126 thêm `paymentMethods`, `paymentMethod`, trường thanh toán của chi tiết đơn; API_127 thêm `payments`, `canRecordCod`, trạng thái `awaiting_payment`; CONG_VIEC_26 (2026-11-11): thêm API_134 đến API_136 của MODULE_09 (hoa hồng theo đơn và ví hoa hồng, phí rút tiền theo THAY_DOI_17; mục 3u); API_123 thêm `commissionSettings`, danh sách đăng bán thêm `commission`; API_127 thêm `commissions`; API_122 thêm `creditedCommission`, `pendingCommission`; CONG_VIEC_43 (2026-11-11), THAY_DOI_18: bỏ API_93, API_94 (CONG_VIEC_17) và `GET /finance/my-commissions`; tắt API_110, API_111 (CONG_VIEC_21); thêm `GET /crm/visit-options`; API_56 thêm `kind`; API_78 thêm `allowManualGoodsOrders`; API_77 bỏ `commissionUserName`, kiểm đơn bán tay chỉ dịch vụ; API_65 thêm `isService`; API_71 bỏ lọc `owner`, `canClaim`; lỗi mới `manualOrderServicesOnly`, `internalServicesOnly`, `serviceNotStocked`, `serviceNoTracking`, `productKindLocked` (mục 3v); CONG_VIEC_50 (2026-11-11): thêm API_170 đến API_175 của MODULE_15 (báo cáo quản trị; mục 2q, 3w); lỗi mới `analyticsPeriodReversed`, `analyticsPeriodTooLong`, `analyticsExportTooLarge`

Phạm vi hiện tại: MODULE_01 Nền tảng; MODULE_02 phần Sản phẩm (CONG_VIEC_04); MODULE_03 Kho phần web (CONG_VIEC_05); MODULE_07 Khách hàng và Đối tác phần tối thiểu (CONG_VIEC_06); MODULE_04 Mua hàng phần 1 (CONG_VIEC_07); MODULE_05 Bán hàng phần 1 (CONG_VIEC_08); MODULE_05 phần 2 Giao dịch nội bộ (CONG_VIEC_09); MODULE_05 phần 3 Khuyến mãi (CONG_VIEC_12); MODULE_06 Tài chính – Kế toán phần 1 (CONG_VIEC_13); MODULE_06 phần 2 Kế toán tổng hợp (CONG_VIEC_14); MODULE_06 phần 3 Báo cáo tài chính (CONG_VIEC_15); MODULE_06 phần 4 Hóa đơn điện tử (CONG_VIEC_16); MODULE_06 phần 5 Hoa hồng đội kinh doanh (CONG_VIEC_17); MODULE_06 phần 6 Đối soát ngân hàng (CONG_VIEC_18); MODULE_06 phần 7 Đối soát thu hộ (CONG_VIEC_19); MODULE_06 phần 8 Báo cáo tài chính hợp nhất (CONG_VIEC_20); MODULE_07 phần 2 Gán khách hàng cho nhân viên kinh doanh (CONG_VIEC_21); MODULE_15 phần 1 Báo cáo quản trị (CONG_VIEC_50).

## 1. Quy ước chung

- Địa chỉ gốc: `/api/v1`. Đổi phiên bản (`/api/v2`) khi phá vỡ tương thích; phiên bản cũ giữ tối thiểu 6 tháng.
- Định dạng JSON, mã hóa UTF-8. Tên trường dạng `camelCase` tiếng Anh (từ chuyên môn). Thời điểm theo ISO 8601 có múi giờ; ngày dạng `YYYY-MM-DD`; tiền dạng chuỗi số thập phân (`"80000000.0000"`) để không sai số.
- Xác thực: cookie phiên `HttpOnly` (web) hoặc header `Authorization: Bearer <token truy cập>` (ứng dụng di động). Thao tác ghi trên web kèm header `X-CSRF-Token`.
- Công ty đang làm việc: header `X-Company-Id`. Máy chủ kiểm tra nhân viên thuộc công ty đó; thiếu header thì dùng công ty mặc định.
- Phân quyền: mỗi endpoint ghi quyền cần có; kiểm tra theo QUYTAC_NGHIEPVU_12 và lọc dữ liệu theo phạm vi ngay trong truy vấn.
- Kiểm tra dữ liệu đầu vào: lược đồ zod dùng chung trong `packages/contracts`; trường thừa bị từ chối.
- Khóa lạc quan: thao tác sửa gửi kèm `version`; khác phiên bản hiện tại thì trả `409 CONFLICT_VERSION`.
- Chống gửi lặp: thao tác tạo, gửi duyệt, quyết định duyệt nhận header `Idempotency-Key` (UUID); gửi lại cùng khóa trong 24 giờ trả kết quả lần đầu.
- Ngôn ngữ thông báo lỗi: theo hồ sơ nhân viên hoặc header `Accept-Language` (`vi`, `en`).

### Phân trang, lọc, sắp xếp

- Truy vấn: `?page=1&pageSize=20&sort=-createdAt&q=<từ khóa>&<trường lọc>=<giá trị>`. `pageSize` tối đa 100.
- Kết quả danh sách:

```json
{ "data": [ ... ], "page": 1, "pageSize": 20, "total": 134 }
```

### Mô hình lỗi

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Mã chi nhánh đã tồn tại trong công ty.", "fields": { "code": "Mã chi nhánh đã tồn tại trong công ty." }, "requestId": "01J..." } }
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Dữ liệu sai kiểu, độ dài, định dạng; vi phạm quy tắc nghiệp vụ gắn với một trường |
| 401 | `UNAUTHENTICATED` | Chưa đăng nhập, phiên hết hạn |
| 401 | `MFA_REQUIRED` | Cần nhập mã xác thực hai lớp |
| 403 | `FORBIDDEN` | Không có quyền ("Bạn không có quyền thực hiện thao tác này.") |
| 404 | `NOT_FOUND` | Không tồn tại hoặc nằm ngoài phạm vi quyền (không phân biệt hai trường hợp) |
| 409 | `CONFLICT_VERSION` | Dữ liệu đã bị người khác sửa |
| 409 | `BUSINESS_RULE` | Vi phạm quy tắc nghiệp vụ không gắn với trường (ví dụ "Công ty còn chi nhánh đang hoạt động.") |
| 423 | `ACCOUNT_LOCKED` | Tài khoản tạm khóa sau 5 lần sai |
| 429 | `RATE_LIMITED` | Vượt giới hạn số lần thử |
| 500 | `INTERNAL` | Lỗi hệ thống; không trả chi tiết kỹ thuật |

## 2. Danh sách endpoint MODULE_01

Quyền viết tắt theo tiền tố `platform.`. "Công khai" = không cần đăng nhập.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_01 | `POST /auth/login` | CHUC_NANG_06 | Công khai | `identifier`, `password` | Đặt cookie phiên; `{ mfaRequired, mfaEnrolled, user }`; phiên chưa nhập mã thì API khác trả `401 MFA_REQUIRED` |
| API_02 | `POST /auth/otp/send` | CHUC_NANG_08 | Công khai | `phone` | `204` (luôn thành công, QUYTAC_NGHIEPVU_05) |
| API_03 | `POST /auth/otp/verify` | CHUC_NANG_08 | Công khai | `phone`, `code` | Như API_01 |
| API_04 | `GET /auth/oauth/{provider}/start` | CHUC_NANG_07, CHUC_NANG_24 | Công khai | `provider` = `google`, `microsoft`, `zalo`; `mode` = `login`, `link`, `activate` (kèm `token` kích hoạt, CONG_VIEC_03) | Chuyển hướng tới nhà cung cấp |
| API_05 | `GET /auth/oauth/{provider}/callback` | CHUC_NANG_07, CHUC_NANG_24 | Công khai | `code`, `state` | Đăng nhập hoặc liên kết; chuyển hướng về MAN_HINH_05 hoặc MAN_HINH_06 |
| API_06 | `POST /auth/mfa/verify` | CHUC_NANG_09 | Đã qua bước một | `code` hoặc `backupCode` | Phiên đánh dấu đã xác thực hai lớp |
| API_07 | `POST /auth/mfa/enroll` | CHUC_NANG_09 | Đã đăng nhập | `factorType` | `{ otpauthUrl, secretForManualEntry }` |
| API_08 | `POST /auth/mfa/enroll/confirm`; `POST /me/mfa/disable` (tắt, cần `code`); `POST /me/mfa/backup-codes` (tạo lại mã dự phòng, cần `code`) | CHUC_NANG_09, CHUC_NANG_10 | Đã đăng nhập | `code` | `{ backupCodes: [10 mã] }` (chỉ trả một lần); tắt bị từ chối khi đang bắt buộc |
| API_09 | `POST /auth/refresh` | Phiên | Cookie làm mới | Không | Token mới; đổi token làm mới |
| API_10 | `POST /auth/logout` | Phiên | Đã đăng nhập | Không | `204`; thu hồi phiên |
| API_11 | `POST /auth/activation`; `GET /auth/activation/{token}` (thông tin cho MAN_HINH_03) | CHUC_NANG_04 | Công khai | `token`, `password` | `204`; `{ fullName, companyName, loginIdentifier }` |
| API_12 | `POST /auth/password/forgot` | CHUC_NANG_06 | Công khai | `identifier` | `204` (luôn thành công) |
| API_13 | `POST /auth/password/reset` | CHUC_NANG_06 | Công khai | `token`, `password` | `204`; thu hồi mọi phiên |
| API_14 | `GET /me` | CHUC_NANG_10, CHUC_NANG_11 | Đã đăng nhập | Không | Hồ sơ, công ty thuộc về, công ty đang chọn, quyền trong công ty đang chọn |
| API_15 | `PATCH /me` | CHUC_NANG_10, CHUC_NANG_22 | Đã đăng nhập | `fullName`, `locale`, `defaultCompanyId`, `version` | Hồ sơ |
| API_16 | `POST /me/password` | CHUC_NANG_10 | Đã đăng nhập | `currentPassword`, `newPassword` | `204`; thu hồi phiên khác |
| API_17 | `GET /me/identities`, `DELETE /me/identities/{id}` | CHUC_NANG_10, CHUC_NANG_24 | Đã đăng nhập | Không | Danh sách cách đăng nhập; hủy liên kết (không cho xóa cách cuối cùng) |
| API_18 | `GET /me/sessions`, `DELETE /me/sessions/{id}` | CHUC_NANG_10 | Đã đăng nhập | Không | Danh sách phiên; thu hồi phiên |
| API_19 | `GET /home` | CHUC_NANG_14 | Đã đăng nhập | Không | `{ apps: [{ code, name, url, icon, pendingCount }], pendingApprovals: [5 yêu cầu mới nhất] }` |
| API_20 | `GET /companies`, `POST /companies`, `PATCH /companies/{id}` | CHUC_NANG_01 | `company.manage` (tập đoàn) | Trường theo tài liệu `16` bảng `companies` | Cây công ty; công ty |
| API_21 | `POST /companies/{id}/deactivate` | CHUC_NANG_01 | `company.manage` | `version` | Công ty; `409 BUSINESS_RULE` nếu còn chi nhánh hoạt động |
| API_22 | `GET/POST /branches`, `PATCH /branches/{id}`, `POST /branches/{id}/deactivate` | CHUC_NANG_02 | `branch.manage` | Trường bảng `branches` | Danh sách, chi nhánh |
| API_23 | `GET/POST /departments`, `PATCH /departments/{id}`, `POST /departments/{id}/deactivate` | CHUC_NANG_03 | `department.manage` | Trường bảng `departments` | Cây phòng ban, phòng ban |
| API_24 | `GET /users` | CHUC_NANG_04, CHUC_NANG_19 | `user.view` | Lọc `branchId`, `departmentId`, `roleId`, `status`, `q` | Danh sách nhân viên trong công ty đang chọn |
| API_25 | `POST /users/invitations` | CHUC_NANG_04 | `user.invite` | `fullName`, `email`, `phone`, `username`, `defaultBranchId`, `departmentId`, `jobTitle`, `roleAssignments[]` | Nhân viên "Đã mời" |
| API_26 | `POST /users/{id}/invitations/resend` | CHUC_NANG_04 | `user.invite` | Không | `204` |
| API_27 | `POST /users/imports` | CHUC_NANG_05 | `user.invite` | Tệp `.xlsx` (multipart, tối đa 5 MB, 1.000 dòng) | `{ invited, failed, errors, errorFileUrl }` (tệp lỗi dạng data URL, không lưu trên máy chủ) |
| API_28 | `GET /users/imports/template` | CHUC_NANG_05 | `user.invite` | Không | Tệp mẫu `.xlsx` |
| API_29 | `GET /users/{id}`, `PATCH /users/{id}` | CHUC_NANG_19 | `user.view`, `user.manage` | Trường nhân viên, `version` | Chi tiết nhân viên, công ty, vai trò, phiên |
| API_30 | `POST /users/{id}/lock`, `POST /users/{id}/unlock` | CHUC_NANG_19 | `user.manage` | `reason` | Nhân viên; thu hồi phiên khi khóa |
| API_31 | `GET /users/{id}/handover` | CHUC_NANG_19 | `user.manage` | Không | `{ pendingApprovalSteps: [...], managedDepartments: [...] }` |
| API_32 | `POST /users/{id}/deactivate` | CHUC_NANG_19 | `user.manage` | `reason`, `handover: [{ kind, itemId, toUserId }]` | Nhân viên; `409 BUSINESS_RULE` nếu thiếu bàn giao |
| API_33 | `POST /users/{id}/mfa/reset` | CHUC_NANG_09 | `user.reset_mfa` | Không | `204` |
| API_34 | `POST /users/{id}/role-assignments`, `DELETE /users/{id}/role-assignments/{assignmentId}` | CHUC_NANG_13 | `role.assign` | `roleId`, `scopeType`, `branchId`, `validFrom`, `validTo` | Lần gán vai trò |
| API_35 | `GET /permissions` | CHUC_NANG_12 | `role.manage` | Không | Quyền nhóm theo mini app, kèm `grantableByMe` |
| API_36 | `GET/POST /roles`, `PATCH /roles/{id}`, `PUT /roles/{id}/permissions` | CHUC_NANG_12 | `role.manage`; riêng `GET /roles` cho cả `role.assign` (THAY_DOI_05) | `code`, `nameVi`, `nameEn`, `description`, `permissionCodes[]`, `version` | Vai trò, kèm `hasSensitive` |
| API_37 | `GET /approval-policies`, `POST /approval-policies` | CHUC_NANG_15 | `approval_policy.manage` | `documentTypeCode`, `currency`, `effectiveFrom`, `levels[]` (`levelNo`, `minAmount`, `approver`, `substitute`, `dueHours`) | Chính sách; chính sách cũ kết thúc ngày trước `effectiveFrom` |
| API_38 | `POST /approval-requests` | CHUC_NANG_16 | Nội bộ (mini app sở hữu chứng từ gọi qua service); qua HTTP chỉ cho loại chứng từ thử `platform.*` ngoài môi trường thật. `GET /document-types` liệt kê loại chứng từ cần duyệt cho MAN_HINH_15 | `documentTypeCode`, `documentId`, `documentNo`, `amount`, `currency`, `documentDate` | Yêu cầu duyệt kèm các bước |
| API_39 | `GET /approval-requests/inbox` | CHUC_NANG_17 | Đã đăng nhập | Lọc `companyId`, `appCode`, `documentTypeCode`, `overdue` | Yêu cầu chờ nhân viên ở mọi công ty |
| API_40 | `GET /approval-requests/{id}` | CHUC_NANG_16 | Người lập hoặc người duyệt của yêu cầu | Không | Yêu cầu, các bước, quyết định |
| API_41 | `POST /approval-requests/{id}/decisions` | CHUC_NANG_16 | Người duyệt cấp hiện tại | `decision` (`approved`, `rejected`), `comment` | Yêu cầu sau quyết định |
| API_42 | `POST /approval-requests/{id}/withdraw` | CHUC_NANG_16 | Người lập | Không | Yêu cầu "Đã rút"; `409 BUSINESS_RULE` nếu cấp 1 đã quyết định |
| API_43 | `GET /number-sequences`, `PATCH /number-sequences/{documentTypeCode}` | CHUC_NANG_20 | `number_sequence.manage` | `prefix`, `resetPeriod`, `padding` | Dãy số, số kế tiếp |
| API_44 | Không có endpoint; hàm nội bộ `NumberSequenceService.next(companyId, documentTypeCode, transaction)` | CHUC_NANG_20 | Nội bộ | | Số chứng từ |
| API_45 | `GET /exchange-rates`, `POST /exchange-rates`, `PATCH /exchange-rates/{id}` | CHUC_NANG_21 | Xem: đã đăng nhập; sửa: `exchange_rate.manage` | `rateDate`, `fromCurrency`, `toCurrency`, `rateType`, `source`, `rate` | Tỷ giá |
| API_46 | `GET /currencies` | CHUC_NANG_21 | Đã đăng nhập | Không | Danh mục tiền tệ |
| API_47 | `GET /audit-events`, `GET /audit-events/{id}` | CHUC_NANG_23 | `audit.view` | Lọc `actorUserId`, `appCode`, `entityType`, `entityId`, `action`, `from`, `to` | Nhật ký; chi tiết trước và sau. Không có endpoint sửa, xóa |
| API_48 | `GET /notifications`, `POST /notifications/{id}/read` | Thanh trên cùng | Đã đăng nhập | Không | Thông báo của chính mình |
| API_49 | `GET /integration-settings`, `PUT /integration-settings`, `POST /integration-settings/test`, `POST /integration-settings/test-message`, `GET /integration-settings/deliveries` | CHUC_NANG_25, CHUC_NANG_26 | `integration.manage` phạm vi tập đoàn | `values` (khóa cài đặt → giá trị), `clear[]` | Cài đặt (khóa bí mật chỉ 4 ký tự cuối) kèm đường dẫn chuyển hướng; kết quả kiểm tra eSMS; 50 tin gửi gần nhất |
| API_50 | `GET /proposal-templates` (`?all=true` kèm mẫu ngừng dùng), `POST /proposal-templates`, `POST /proposal-templates/defaults`, `PATCH /proposal-templates/{id}` | CHUC_NANG_27 | Xem: `proposal.create` hoặc `proposal_template.manage`; sửa: `proposal_template.manage` | `code`, `name`, `nameEn`, `description`, `currency`, `fields[]`, `amountField`; sửa thêm `status`, `version` | Mẫu kèm `documentTypeCode`, `hasPolicy` |
| API_51 | `GET/POST /proposals`, `GET/PATCH/DELETE /proposals/{id}`, `POST /proposals/{id}/submit`, `POST /proposals/{id}/withdraw` | CHUC_NANG_28 | Lập, sửa, xóa, gửi, rút: `proposal.create` (chỉ người lập); xem chi tiết: `access` và QUYTAC_NGHIEPVU_36; danh sách `scope=company`: `proposal_template.manage` | `templateId`, `title`, `values`, `version`; lọc `scope` (`mine`, `company`), `status` | Đề xuất kèm bản chụp mẫu, tệp đính kèm, `canEdit`, `canWithdraw` |
| API_52 | `POST /proposals/{id}/attachments` (multipart, trường `file`), `GET /attachments/{id}`, `DELETE /attachments/{id}` | CHUC_NANG_28 | Thêm, xóa: `proposal.create`, người lập, đề xuất Nháp; tải: QUYTAC_NGHIEPVU_36 | Một tệp mỗi lần; tối đa 10 tệp, 10 MB; `pdf`, `jpg`, `jpeg`, `png`, `xlsx`, `docx` | Tệp đính kèm; nội dung tệp kèm tên tệp UTF-8 |
| API_53 | `GET /proposals/{id}/pdf` | CHUC_NANG_29 | `access` và QUYTAC_NGHIEPVU_36 | Không | Tệp PDF (`inline`) |
| API_54 | `GET /auth/methods` | CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08, CHUC_NANG_24 | Công khai | Không | `{ password, phone, google, microsoft, zalo }` cho MAN_HINH_01, MAN_HINH_03, MAN_HINH_06 |

## 2a. Danh sách endpoint MODULE_02 (phần Sản phẩm, CONG_VIEC_04)

Mọi đường dẫn có tiền tố `/api/v1`. Quyền viết đầy đủ. Mọi endpoint trước hết cần `catalog.access` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`; quyền chi tiết kiểm tra trong service. Dữ liệu của công ty khác trả `404 NOT_FOUND`. Đường dẫn có `{id}` không phải UUID trả `400`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_55 | `GET /catalog/categories`, `POST /catalog/categories`, `PATCH /catalog/categories/{id}`, `POST /catalog/categories/{id}/deactivate`, `POST /catalog/categories/{id}/activate`; `GET /catalog/units`, `POST /catalog/units`, `PATCH /catalog/units/{id}`, `POST /catalog/units/{id}/deactivate`, `POST /catalog/units/{id}/activate` | CHUC_NANG_30 | Xem: `catalog.access`; sửa: `catalog.category.manage` gán ở phạm vi tập đoàn | Ngành hàng: `parentId`, `code`, `nameVi`, `nameEn`, `tracksLots`, `tracksSerials`, `warrantyMonths`; sửa thêm `version`. Đơn vị: `code`, `nameVi`, `nameEn`; sửa chỉ `nameVi`, `nameEn`, `version`. Ngừng, dùng lại: `version` | Ngành hàng kèm `level`, `productCount`, `childCount`; đơn vị tính. Không có endpoint xóa |
| API_56 | `GET /catalog/products`, `POST /catalog/products`, `GET /catalog/products/{id}`, `PATCH /catalog/products/{id}`, `POST /catalog/products/{id}/deactivate`, `POST /catalog/products/{id}/activate` | CHUC_NANG_31, CHUC_NANG_32 | Xem: `catalog.product.view`; sửa: `catalog.product.manage` | Lọc `search`, `categoryId`, `status`, `page`, `pageSize` (tối đa 100, mặc định 20). Sản phẩm kèm `options`, `units`, `variants` (mục 3a) | Trang sản phẩm; chi tiết kèm đơn vị, biến thể, mã vạch, ảnh |
| API_57 | `POST /catalog/products/{id}/images` (multipart, trường `file`), `GET /catalog/product-images/{id}` (nhận thêm `?companyId=` cho thẻ ảnh), `POST /catalog/product-images/{id}/primary`, `DELETE /catalog/product-images/{id}` | CHUC_NANG_31 | Tải về: `catalog.product.view`; thêm, đặt ảnh đại diện, xóa: `catalog.product.manage` | Một tệp mỗi lần; `jpg`, `jpeg`, `png`, `webp`; tối đa 5 MB, 10 ảnh | `201` ảnh (`id`, `fileName`, `contentType`, `sizeBytes`); nội dung ảnh; `204` |
| API_58 | `GET /catalog/product-imports/template`, `POST /catalog/product-imports` (multipart, trường `file`) | CHUC_NANG_33 | `catalog.access` (tệp mẫu); `catalog.product.manage` (nhập) | Tệp `.xlsx` tối đa 2.000 dòng, 5 MB | Tệp mẫu `mau-nhap-san-pham.xlsx`; `{ createdProducts, createdVariants, failedRows, errors: [{ row, message }], errorFileUrl }` |
| API_59 | `GET /catalog/products/{id}/links`, `GET /catalog/products/{id}/link-suggestions?targetCompanyId=`, `POST /catalog/variant-links`, `DELETE /catalog/variant-links/{id}`, `POST /catalog/products/{id}/copy` | CHUC_NANG_34 | Xem liên kết: `catalog.product.view`; gợi ý: `catalog.product.view` ở cả hai công ty; liên kết, bỏ liên kết, sao chép: `catalog.product.manage` ở cả hai công ty | Liên kết: `variantId`, `linkedVariantId`, `factor` (mặc định `"1"`). Sao chép: `targetCompanyId` | Liên kết đọc từ phía công ty đang làm việc; gợi ý theo mã vạch trùng; `201 { productId }` |
| API_60 | `GET`, `POST /catalog/sales-channels`; `PATCH /catalog/sales-channels/{id}`; `POST /catalog/sales-channels/{id}/deactivate`, `/activate`; `POST /catalog/sales-channels/defaults`; cùng các đường dẫn với `/catalog/customer-groups` (trừ `defaults`) | CHUC_NANG_35 | Xem: `catalog.price.view`; sửa: `catalog.price.manage` | `code`, `name`; sửa chỉ `name`, `version`; ngừng, dùng lại: `version` | Kênh hoặc nhóm khách (`id`, `code`, `name`, `status`, `version`); `defaults` trả danh sách kênh sau khi thêm |
| API_61 | `GET /catalog/price-lists`, `POST /catalog/price-lists`, `PATCH /catalog/price-lists/{id}`, `POST /catalog/price-lists/{id}/deactivate`, `/activate`, `GET /catalog/price-lists/{id}/prices`, `GET /catalog/price-lists/{id}/history`, `GET /catalog/prices/lookup` | CHUC_NANG_36 | Xem, tra giá: `catalog.price.view`; sửa: `catalog.price.manage` | Bảng giá: `code`, `name`, `channelId`, `customerGroupId`, `currency` (mặc định `VND`), `includesVat`; sửa chỉ `name`, `includesVat`, `version`. `prices`: `date`, `search`, `page`, `pageSize` (mặc định 50). `history`: `variantId`, `unitId`. `lookup`: `variantId`, `unitId`, `channelId`, `customerGroupId`, `currency`, `date` | Bảng giá; trang giá hiện hành; lịch sử giá kèm số phiếu; kết quả tra giá (mục 3a) |
| API_62 | `GET /catalog/price-changes`, `POST /catalog/price-changes`, `GET /catalog/price-changes/{id}`, `PATCH /catalog/price-changes/{id}`, `DELETE /catalog/price-changes/{id}`, `POST /catalog/price-changes/{id}/submit`, `POST /catalog/price-changes/{id}/withdraw`, `GET /catalog/price-changes/import-template`, `POST /catalog/price-changes/import-lines?priceListId=` (multipart) | CHUC_NANG_37 | Xem: `catalog.price.view`; lập, sửa, xóa, gửi, rút, nhập dòng: `catalog.price.manage`, sửa, xóa, gửi, rút chỉ người lập | `priceListId`, `effectiveFrom`, `note`, `lines[]` (`variantId`, `unitId`, `price`; 1 đến 5.000 dòng), `version`. Lọc `status`, `page`, `pageSize` | Phiếu kèm dòng, `canEdit`, `canWithdraw`; `204` khi xóa; nhập dòng trả `{ lines, errors }`, không lưu |

## 2b. Danh sách endpoint MODULE_03 (Kho, CONG_VIEC_05)

Mọi đường dẫn có tiền tố `/api/v1`, nằm trong `apps/api/src/inventory/inventory.controller.ts`. Mọi endpoint trước hết cần `inventory.access` hoặc `inventory.stock.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm tra trong service tại kho: lần gán ở tập đoàn, ở công ty sở hữu kho hoặc ở chi nhánh của kho ("tại kho"). Kho không có `inventory.access` tại kho và không nhận hàng của công ty đang làm việc trả `404 NOT_FOUND`; có `inventory.access` nhưng thiếu quyền chi tiết trả `403`. Mã định danh trong đường dẫn không phải UUID trả `400`. `POST` thành công trả `201`, `DELETE` trả `204`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_63 | `GET`, `POST /inventory/warehouses`; `GET`, `PATCH /inventory/warehouses/{id}`; `POST /inventory/warehouses/{id}/deactivate`, `/activate`; `GET /inventory/warehouse-options`; `GET`, `POST /inventory/warehouses/{id}/locations`; `PATCH /inventory/warehouses/{id}/locations/{locationId}`; `POST /inventory/warehouses/{id}/locations/{locationId}/deactivate`, `/activate`; `GET`, `PUT /inventory/settings` | CHUC_NANG_38 | Xem: quyền kho tại kho hoặc `inventory.stock.view` ở công ty chủ hàng. Thêm kho, `warehouse-options`, sửa cài đặt: `inventory.warehouse.manage` ở phạm vi công ty. Sửa kho, vị trí, ngừng dùng: `inventory.warehouse.manage` tại kho | Kho: `branchId`, `code`, `name`, `address`, `usesLocations`, `ownerCompanyIds`; sửa không có `branchId`, `code`, thêm `version`. Vị trí: `locations[]` (`code`, `name`; 1 đến 500); sửa `name`, `version`. Ngừng, dùng lại: `version`. Cài đặt: `reservationHours`, `version` | Kho kèm `owners`, `locationCount`, `canOperate`, `canManage`; danh sách vị trí sau khi đổi; `{ branches, companies }`; `{ reservationHours, version }` (chưa cài: `72`, `0`) |
| API_64 | `GET /inventory/stock`, `GET /inventory/stock/{variantId}/details`, `GET /inventory/stock-card` | CHUC_NANG_39 | Như xem kho; giá vốn, giá trị cần `inventory.cost.view` (mục 3b) | `stock`: `warehouseId`, `companyId`, `categoryId`, `search`, `onlyInStock` (mặc định `true`), `page`, `pageSize` (tối đa 100, mặc định 50). `details`: `warehouseId`, `companyId`. `stock-card`: `warehouseId`, `companyId`, `variantId`, `from`, `to` | Trang dòng tồn; `{ balances, serials, reservations }`; `{ sku, productName, baseUnitName, opening, movements, closing }` |
| API_65 | `GET`, `POST /inventory/documents`; `GET`, `PATCH`, `DELETE /inventory/documents/{id}`; `POST /inventory/documents/{id}/submit`, `/withdraw`; `GET /inventory/documents/lot-suggestions`; `GET /inventory/items` | CHUC_NANG_40 | Xem: như xem kho. Lập, sửa, xóa, gửi, rút, gợi ý lô: `inventory.document.manage` tại kho; sửa, xóa, gửi, rút chỉ người lập. Tìm mặt hàng: `inventory.access` tại một kho nhận hàng của công ty chủ hàng | Phiếu: `type`, `warehouseId`, `companyId`, `destinationWarehouseId`, `documentDate`, `reasonCode`, `reason`, `note`, `lines[]` (1 đến 1.000), `version` (khi sửa). Lọc `type`, `status`, `warehouseId`, `page`, `pageSize` (mặc định 20). Gợi ý lô: `warehouseId`, `companyId`, `variantId`, `locationId`, `includeExpired`. Tìm: `companyId`, `search` | Trang phiếu; phiếu kèm dòng, `discrepancies`, `canEdit`, `canWithdraw`, `canShip`, `canReceive`; danh sách lô gợi ý; tối đa 10 mặt hàng kèm đơn vị, `matchedUnitId` |
| API_66 | `GET /inventory/transfer-destinations?companyId=`, `POST /inventory/documents/{id}/ship`, `POST /inventory/documents/{id}/receive` | CHUC_NANG_41 | Kho đích: `inventory.access` tại một kho. Xuất: `inventory.document.manage` tại kho nguồn. Nhận: `inventory.document.manage` tại kho đích | Nhận: `lines[]` (`lineId`, `receivedQuantity` theo đơn vị cơ sở, `destinationLocationId`, `serials`; đủ mọi dòng), `note` | Kho nhận hàng của công ty chủ hàng (`id`, `code`, `name`, `companyName`, `usesLocations`); phiếu sau khi xuất, nhận |
| API_67 | `GET`, `POST /inventory/stocktakes`; `GET /inventory/stocktake-options?warehouseId=`; `GET /inventory/stocktakes/{id}`; `POST /inventory/stocktakes/{id}/start`; `PUT /inventory/stocktakes/{id}/counts`; `POST /inventory/stocktakes/{id}/finish`, `/cancel` | CHUC_NANG_42 | Xem: `inventory.access` tại kho. Lập, `stocktake-options`, bắt đầu, đếm, kết thúc, hủy: `inventory.stocktake.manage` tại kho | Lập: `warehouseId`, `companyId`, `scopeType`, `scopeIds` (tối đa 5.000; trống khi toàn kho), `note`. Đếm: `counts[]` (`lineId` hoặc `variantId`, `lotId`, `locationId`; `countedQuantity`; `serials`; 1 đến 5.000). Kết thúc: `responsibilities[]` (`lineId`, `responsibleUserId`, `compensationAmount`), `version` | Danh sách (tối đa 200, mới trước); kiểm kê kèm dòng, `adjustmentDocumentId`, `adjustmentDocumentNo`, `canManage`; `{ categories, users }` |
| API_68 | `GET`, `POST /inventory/reservations`; `POST /inventory/reservations/{id}/extend`, `/release` | CHUC_NANG_43 | Xem: `inventory.access` tại kho. Giữ, gia hạn, nhả: `inventory.reservation.manage` tại kho | Giữ: `warehouseId`, `companyId`, `variantId`, `quantity`, `note`. Gia hạn: `hours` (1 đến 720), `version`. Nhả: `version`. Lọc `warehouseId`, `status` (mặc định `active`), `page`, `pageSize` (mặc định 50) | Trang hàng giữ; hàng giữ sau khi đổi |
| API_69 | `GET`, `PUT /inventory/stock-levels`; `DELETE /inventory/stock-levels/{warehouseId}/{companyId}/{variantId}`; `GET /inventory/stock-alerts` | CHUC_NANG_44 | Xem: `inventory.access` tại kho. Đặt, xóa: `inventory.reservation.manage` tại kho | `warehouseId`, `companyId`, `variantId`, `minimum`, `maximum`. Lọc `warehouseId`, `onlyAlerts` | Dòng tồn an toàn kèm `available`, `incoming`, `belowMinimum`, `suggestedQuantity`; `stock-alerts` chỉ dòng dưới tối thiểu |
| API_70 | `GET /inventory/labels/products?companyId=&variantIds=&copies=`, `GET /inventory/labels/locations?warehouseId=` | CHUC_NANG_45 | Tem sản phẩm: `inventory.access` tại một kho nhận hàng của công ty chủ hàng. Tem vị trí: `inventory.access` tại kho | `variantIds` cách nhau dấu phẩy; `copies` 1 đến 500 (mặc định 1) | Tệp PDF (`inline`) `tem-san-pham.pdf`, `tem-vi-tri.pdf` |

## 2c. Danh sách endpoint MODULE_07 (Khách hàng và Đối tác, phần tối thiểu, CONG_VIEC_06)

Mọi đường dẫn có tiền tố `/api/v1`, nằm trong `apps/api/src/crm/crm.controller.ts`. Mọi endpoint trước hết cần `crm.access` hoặc `crm.partner.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm tra trong service ở phạm vi công ty đang làm việc (lần gán ở tập đoàn hoặc công ty đó). Đối tác dùng chung tập đoàn nên không lọc theo công ty; hồ sơ, cờ khách hàng, nhà cung cấp lấy theo công ty đang làm việc. Mã định danh trong đường dẫn không phải UUID trả `400`. `POST` thành công trả `201`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_71 | `GET`, `POST /crm/partners`; `GET`, `PATCH /crm/partners/{id}`; `POST /crm/partners/{id}/deactivate`, `/activate`; `GET /crm/partners/{id}/identity`; `GET /crm/partners/lookup?taxCode=&citizenId=` | CHUC_NANG_46, CHUC_NANG_47 | Xem, tìm, kiểm trùng theo `taxCode`: `crm.partner.view`. Kiểm trùng theo `citizenId`, thêm, sửa, ngừng giao dịch, giao dịch lại: `crm.partner.manage`. Xem số Căn cước công dân: `crm.partner.identity.view` (nhạy cảm) | Đối tác: `kind`, `name`, `shortName`, `taxCode`, `citizenId`, `address`, `phone`, `email`, `contacts[]` (tối đa 50), `bankAccounts[]` (tối đa 20), `version` (khi sửa). Ngừng, giao dịch lại: `version`. Lọc `search`, `kind`, `role` (`customer`, `supplier`, `internal`), `status`, `page`, `pageSize` (tối đa 100, mặc định 20) | Trang đối tác (`PartnerListItem`); đối tác kèm `contacts`, `bankAccounts`, `profile` của công ty đang làm việc, `version`, `canManage`, `canViewIdentity`, `canManageProfile`; `{ citizenId }`; `{ partner: { id, code, name } }` (không có: `partner` là `null`) |
| API_72 | `PUT /crm/partners/{id}/profile`; `GET /crm/partner-profile-options` | CHUC_NANG_48 | Xem hồ sơ (trong chi tiết đối tác của API_71): `crm.partner.view`. Lưu hồ sơ, danh sách chọn: `crm.profile.manage` (nhạy cảm) | `isCustomer`, `isSupplier`, `paymentTermDays` (0 đến 365), `creditLimit` (chuỗi hoặc số, không âm, 4 chữ số lẻ; trống: không giới hạn), `customerGroupId`, `ownerUserId`, `note` (tối đa 1.000 ký tự), `status` (mặc định `active`), `version` (0 khi lập mới) | Đối tác (như chi tiết của API_71) kèm hồ sơ sau khi lưu; `{ customerGroups: [{ id, name }], users: [{ id, fullName }] }` |

## 2d. Danh sách endpoint MODULE_04 (Mua hàng phần 1, CONG_VIEC_07)

Mọi đường dẫn có tiền tố `/api/v1`. API_73 đến API_75 nằm trong `apps/api/src/purchasing/purchasing.controller.ts`: mọi endpoint trước hết cần `purchasing.access`, `purchasing.order.view` hoặc `purchasing.requisition.create` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm tra trong service: `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh nào của công ty cũng dùng được; quyền khác cần lần gán ở tập đoàn hoặc công ty đó. Dữ liệu lọc theo công ty đang làm việc; mã của công ty khác trả `404`. API_76 nằm trong `apps/api/src/inventory/inventory.controller.ts`, cần quyền vào mini app Kho như API_65 và `inventory.purchase.receive` tại kho (QUYTAC_NGHIEPVU_46). Mã định danh trong đường dẫn không phải UUID trả `400`. `POST` thành công trả `201`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_73 | `GET`, `POST /purchasing/supplier-prices`; `PATCH /purchasing/supplier-prices/{id}`; `POST /purchasing/supplier-prices/{id}/deactivate`, `/activate`; `GET /purchasing/supplier-prices/lookup?supplierId=&variantId=&unitId=&quantity=&date=`; `GET /purchasing/options`; `GET /purchasing/items?search=` | CHUC_NANG_49 | Xem, tra giá, danh sách chọn, tìm mặt hàng: một trong `purchasing.price.manage`, `purchasing.requisition.create`, `purchasing.order.view`, `purchasing.order.manage`. Thêm, sửa, ngừng dùng, dùng lại: `purchasing.price.manage` | Giá: `supplierId`, `variantId`, `unitId`, `minQuantity` (mặc định 0), `unitPrice`, `supplierSku`, `validFrom`, `validTo`, `version` (khi sửa). Ngừng, dùng lại: `version`. Lọc `supplierId`, `search`, `status`, `page`, `pageSize` (tối đa 100, mặc định 20) | Trang giá (`SupplierPriceResponse`); `{ unitPrice, priceId }`; `{ suppliers, warehouses, currency }`; tối đa 10 mặt hàng (`StockItemOption`) |
| API_74 | `GET`, `POST /purchasing/requisitions`; `GET`, `PATCH /purchasing/requisitions/{id}`; `POST /purchasing/requisitions/{id}/submit`, `/withdraw`, `/close` | CHUC_NANG_50 | Xem: `purchasing.requisition.create` hoặc `purchasing.order.manage`. Lập, sửa, gửi: `purchasing.requisition.create`; sửa, gửi, rút chỉ người lập. Đóng: `purchasing.order.manage` | `warehouseId`, `neededBy`, `reason`, `lines[]` (1 đến 200: `variantId`, `unitId`, `quantity`, `estimatedUnitPrice`, `suggestedSupplierId`, `note`), `version` (khi sửa). Đóng: `version`. Lọc `status`, `openOnly`, `search`, `page`, `pageSize` | Trang đề nghị (`RequisitionListItem`); đề nghị kèm `lines` (`orderedBaseQuantity`), `version`, `canEdit`, `canWithdraw`, `canOrder` |
| API_75 | `GET`, `POST /purchasing/orders`; `GET`, `PATCH /purchasing/orders/{id}`; `POST /purchasing/orders/{id}/submit`, `/withdraw`, `/close`; `GET`, `PUT /purchasing/settings` | CHUC_NANG_51 | Xem: `purchasing.order.view` hoặc `purchasing.order.manage`. Lập, sửa, gửi, đóng: `purchasing.order.manage`. Rút: người lập. Xem cài đặt: như xem API_73; sửa cài đặt: `purchasing.settings.manage` | Đơn: `supplierId`, `warehouseId`, `orderDate`, `expectedDate`, `note`, `lines[]` (1 đến 200: `id` khi giữ dòng cũ, `variantId`, `unitId`, `quantity`, `unitPrice`, `vatRate`, `requisitionLineId`), `version` (khi sửa). Đóng: `reason`, `version`. Cài đặt: `overReceiptTolerancePercent`, `version`. Lọc `status`, `supplierId`, `search`, `openOnly`, `page`, `pageSize` | Trang đơn (`PurchaseOrderListItem`); đơn kèm `lines`, `receipts`, `version`, `canEdit`, `canSubmit`, `canWithdraw`, `canClose`; `{ overReceiptTolerancePercent, version }` |
| API_76 | `GET /inventory/purchase-orders?search=`, `GET /inventory/purchase-orders/{id}`; `POST /inventory/purchase-receipts`, `PATCH /inventory/purchase-receipts/{id}`; `POST /inventory/purchase-returns`, `PATCH /inventory/purchase-returns/{id}`; `POST /inventory/documents/{id}/submit` (phiếu loại `purchase_receipt`, `purchase_return`); `POST /inventory/documents/{id}/quality-check`; xem, xóa nháp qua API_65 | CHUC_NANG_52, CHUC_NANG_53 | `inventory.purchase.receive` tại kho nhận của đơn mua hoặc kho của phiếu nhập gốc; sửa, gửi chỉ người lập; xóa nháp theo API_65 (`inventory.document.manage`, người lập) | Phiếu nhập: `orderId`, `documentDate`, `note`, `lines[]` (1 đến 200: `orderLineId`, `quantity`, `lotNo`, `manufacturedOn`, `expiresOn`, `locationId`, `serials`), `version` (khi sửa). Kiểm tra: `lines[]` (`lineId`, `rejectedQuantity`, `rejectedSerials`, `rejectionReason`), `version`. Phiếu trả: `receiptId`, `documentDate`, `reason`, `note`, `lines[]` (1 đến 200: `receiptLineId`, `quantity`, `serials`), `version` (khi sửa) | Đơn mua cần nhận `{ id, documentNo, supplierName, warehouseId, warehouseName, companyName }[]`; dòng đơn kèm `receivableQuantity`, `requiresQualityCheck`; phiếu kho (`StockDocumentResponse`) |

Bổ sung API_55: ngành hàng nhận `requiresQualityCheck` (tùy chọn; thêm mới không gửi là `false`, sửa không gửi thì giữ nguyên) và trả về trong ngành hàng. Bổ sung API_65: loại phiếu `purchase_receipt`, `purchase_return`, trạng thái `quality_check`, lý do `purchase`, `purchase_return`; `POST /inventory/documents` từ chối hai loại phiếu mua tại `type` ("Giá trị không hợp lệ."); `PATCH` phiếu loại đó trả lỗi `type` "Không đổi loại phiếu, kho, công ty chủ hàng của phiếu đã lập."; `submit` phiếu loại đó chạy theo API_76; chi tiết phiếu thêm `partnerId`, `partnerName`, `sourceId`, `sourceNo`, `canQualityCheck`, `canReturn`, dòng thêm `sourceLineId`, `rejectedBaseQuantity`, `rejectionReason`, `requiresQualityCheck`; `canEdit` luôn `false` với phiếu mua.

## 2e. Danh sách endpoint MODULE_05 (Bán hàng phần 1, CONG_VIEC_08)

Mọi đường dẫn có tiền tố `/api/v1`. API_77, API_78 nằm trong `apps/api/src/sales/sales.controller.ts`: mọi endpoint trước hết cần `sales.access` hoặc `sales.order.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm tra trong service (`apps/api/src/sales/sales-context.ts`): `sales.order.view` gán ở chi nhánh nào của công ty cũng dùng được; quyền khác cần lần gán ở tập đoàn hoặc công ty đó. Dữ liệu lọc theo công ty đang làm việc; mã của công ty khác trả `404`. API_79 nằm trong `apps/api/src/inventory/inventory.controller.ts`, cần quyền vào mini app Kho như API_65 và `inventory.sales.issue` tại kho (QUYTAC_NGHIEPVU_46). Mã định danh trong đường dẫn không phải UUID trả `400`. `POST` thành công trả `201`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_77 | `GET`, `POST /sales/orders`; `GET`, `PATCH /sales/orders/{id}`; `POST /sales/orders/{id}/submit`, `/withdraw`, `/cancel`, `/close`; `GET /sales/price?variantId=&unitId=&channelId=&customerId=&date=`; `GET /sales/options`; `GET /sales/items?search=` | CHUC_NANG_54 | Xem danh sách, chi tiết, danh sách chọn: `sales.order.view` hoặc `sales.order.manage`. Tra giá, tìm mặt hàng, lập, sửa, gửi, hủy, đóng: `sales.order.manage`. Rút: người lập, có `sales.order.manage` | Đơn: `customerId` (trống: người mua không lấy hóa đơn), `buyerName`, `channelId`, `warehouseId`, `orderDate`, `deliveryAddress`, `note`, `lines[]` (1 đến 200: `variantId`, `unitId`, `quantity`, `discountPercent`), `version` (khi sửa). Hủy: `version`. Đóng: `reason`, `version`. Lọc `status`, `customerId`, `search`, `page`, `pageSize` (tối đa 100, mặc định 20) | Trang đơn (`SalesOrderListItem`); đơn (`SalesOrderResponse`) kèm `lines`, `exceptions`, `documents`, `version`, `canEdit`, `canSubmit`, `canWithdraw`, `canCancel`, `canClose`; `{ price, priceListCode, includesVat, vatRate }`; `{ customers, channels, warehouses, currency }`; tối đa 10 mặt hàng (`StockItemOption`) |
| API_78 | `GET`, `PUT /sales/settings` | CHUC_NANG_55 | Xem: `sales.order.view`, `sales.order.manage` hoặc `sales.settings.manage`. Sửa: `sales.settings.manage` | `maxManualDiscountPercent`, `version` (0 khi chưa có) | `{ maxManualDiscountPercent, version }` |
| API_79 | `GET /inventory/sales-orders?search=`, `GET /inventory/sales-orders/{id}`; `POST /inventory/sales-issues`; `POST /inventory/sales-returns`; `POST /inventory/documents/{id}/submit` (phiếu loại `sales_issue`, `sales_return`); xem, xóa nháp qua API_65 | CHUC_NANG_56, CHUC_NANG_57 | `inventory.sales.issue` tại kho xuất của đơn bán hoặc kho của phiếu xuất gốc; gửi, xóa nháp chỉ người lập | Phiếu xuất: `orderId`, `documentDate`, `note`, `lines[]` (1 đến 200: `orderLineId`, `quantity`, `lotId`, `lotOverrideReason`, `locationId`, `serials`). Phiếu trả: `issueId`, `documentDate`, `reason`, `note`, `lines[]` (1 đến 200: `issueLineId`, `quantity` theo đơn vị cơ sở, `serials`) | Đơn bán cần giao `{ id, documentNo, customerName, warehouseName }[]`; dòng đơn kèm `orderedQuantity`, `remainingQuantity`, `tracksLots`, `tracksSerials`; phiếu kho (`StockDocumentResponse`) |

Bổ sung API_65 (CONG_VIEC_08): loại phiếu `sales_issue`, `sales_return`, lý do `sale`, `sales_return`; `POST /inventory/documents` từ chối hai loại phiếu này tại `type` ("Giá trị không hợp lệ."); `PATCH` phiếu loại đó trả lỗi `type` "Không đổi loại phiếu, kho, công ty chủ hàng của phiếu đã lập."; `submit`, `DELETE` phiếu loại đó chạy theo API_79 (xóa nháp chỉ cần `inventory.sales.issue` tại kho và là người lập); chi tiết phiếu: `partnerName` là khách hàng, `sourceNo` là số đơn bán (phiếu xuất) hoặc số phiếu xuất gốc (phiếu trả), `canReturn` đúng với phiếu xuất đã ghi sổ khi người xem có `inventory.sales.issue` tại kho; `canEdit` luôn `false`.

## 2f. Danh sách endpoint giao dịch nội bộ (MODULE_05 phần 2, CONG_VIEC_09)

API_80 nằm trong `apps/api/src/sales/sales.controller.ts`, API_81 trong `apps/api/src/purchasing/purchasing.controller.ts`, API_82 trong `apps/api/src/inventory/inventory.controller.ts`; kiểm quyền vào mini app như API_77, API_75, API_65. Không thêm quyền. Chứng từ của công ty khác trả `404`. Tra giá nội bộ không có endpoint riêng: dùng `GET /purchasing/supplier-prices/lookup` (API_73).

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_80 | `POST /sales/orders/{id}/counterpart-confirm`, `POST /sales/orders/{id}/counterpart-reject` | CHUC_NANG_59 | `sales.order.manage` ở công ty bán | Xác nhận: `warehouseId` (kho xuất), `version`. Từ chối: `reason` (1 đến 500 ký tự), `version` | Đơn bán (`SalesOrderResponse`) |
| API_81 | `POST /purchasing/orders/{id}/counterpart-confirm`, `POST /purchasing/orders/{id}/counterpart-reject`; tra giá nội bộ qua `GET /purchasing/supplier-prices/lookup` (API_73) | CHUC_NANG_58, CHUC_NANG_59 | `purchasing.order.manage` ở công ty mua; tra giá như API_73 | Xác nhận: `warehouseId` (kho nhận), `version`. Từ chối: `reason`, `version` | Đơn mua (`PurchaseOrderResponse`); tra giá `{ unitPrice, priceId: null, internal: { vatRate } }` khi nhà cung cấp nội bộ |
| API_82 | `POST /inventory/internal-receipts/{id}/receive`; `GET /inventory/internal-discrepancies?status=`; `POST /inventory/internal-discrepancies/{id}/resolve` | CHUC_NANG_60, CHUC_NANG_61 | Nhận: `inventory.purchase.receive` tại kho nhận. Biên bản: `inventory.sales.issue` tại kho xuất | Nhận: `lines[]` (1 đến 200: `lineId`, `receivedQuantity`, `locationId`, `serials`), `shortageReason`, `version`. Xử lý: `action` (`return`, `write_off`), `note`, `version`. Lọc `status` (`open`, `returned`, `written_off`) | Phiếu kho (`StockDocumentResponse`); danh sách biên bản (`InternalDiscrepancyItem[]`) |

Bổ sung API_73, API_75, API_77, API_65, API_76, API_79 (CONG_VIEC_09): trạng thái `counterpart_pending` ở đơn bán, đơn mua (`warehouseId` `null` khi chưa xác nhận); `SalesOrderResponse`, `PurchaseOrderResponse` thêm `isInternal`, `isCounterpart`, `counterpart` (`{ companyName, documentNo, status }` hoặc `null`), `counterpartRejectedReason`, `canConfirmCounterpart`; `canEdit` `false` với đơn đối ứng và đơn mua nội bộ đã có đơn đối ứng; `PATCH` các đơn đó trả `409`. Lưu, gửi đơn nội bộ kiểm điều kiện QUYTAC_NGHIEPVU_73; đơn mua nội bộ lấy giá, thuế suất theo bảng giá Nội bộ, bỏ giá gửi lên. `StockDocumentResponse` thêm `internalReceipt` (`{ issueDocumentNo, sellerCompanyName, lines[] }`, dòng `{ lineId, shippedBaseQuantity, shippedSerials }` khi chờ nhận; `null` với phiếu thường) và `canReceiveInternal`. Lập phiếu xuất giao hàng, gửi phiếu xuất theo đơn bán nội bộ khi đơn mua đối ứng chưa duyệt trả `409`; ghi sổ phiếu xuất sinh phiếu nhập `in_transit` ở công ty mua. `GET /inventory/purchase-orders` không trả đơn mua nội bộ; `POST /inventory/purchase-receipts` với đơn mua nội bộ trả `409`.

## 2g. Danh sách endpoint khuyến mãi (MODULE_05 phần 3, CONG_VIEC_12)

API_83 nằm trong `apps/api/src/sales/sales.controller.ts`, gọi `PromotionsService`; mọi endpoint trước hết cần `sales.access` hoặc `sales.order.view` như API_77; quyền chi tiết kiểm trong service. Chương trình của công ty khác trả `404`. `POST` thành công trả `201`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_83 | `GET /sales/promotions/options`; `GET /sales/promotions?status=`; `GET /sales/promotions/{id}`; `POST /sales/promotions`; `PATCH /sales/promotions/{id}`; `POST /sales/promotions/{id}/submit`, `/withdraw`, `/stop` | CHUC_NANG_62, CHUC_NANG_64 | Lựa chọn, danh sách, chi tiết: `sales.promotion.view` hoặc `sales.promotion.manage`. Lập, sửa, gửi, rút, dừng: `sales.promotion.manage`; rút: người lập, cấp duyệt đầu chưa quyết định | Lập, sửa: `name`, `kind`, `validFrom`, `validTo`, `channelIds`, `customerGroupIds`, `items[]` (`variantId`, `discountPercent`), `minOrderAmount`, `orderDiscountPercent`, `maxOrderDiscount`, `buyVariantId`, `buyQuantity`, `giftVariantId`, `giftQuantity`, `budgetAmount`, `maxGiftSets`, `note`, `version` (khi sửa). Dừng: `reason`, `version`. Lọc `status` | `{ channels, customerGroups, currency }`; danh sách `PromotionListItem[]`; chương trình `PromotionResponse` |

Bổ sung API_77 (CONG_VIEC_12): `GET /sales/items` cần `sales.order.manage` hoặc `sales.promotion.manage` (trước chỉ `sales.order.manage`), để soạn chương trình khuyến mãi tìm được mặt hàng. Lập, sửa đơn bán tự áp khuyến mãi (CHUC_NANG_63); dòng gửi lên không có trường khuyến mãi, dòng hàng tặng do hệ thống thêm. Dòng `SalesOrderResponse.lines[]` thêm `isGift`, `promotionName` (chương trình giảm theo sản phẩm, hoặc chương trình tặng của dòng tặng; `null` nếu không có), `promotionPercent`, `orderPromotionName`, `orderDiscountAmount` (gồm thuế); `SalesOrderResponse` thêm `giftShortages` (`[{ promotionName, missingSets }]`, suất tặng thiếu do kho xuất không đủ hàng tặng lúc lưu; rỗng khi đủ). `submit` kiểm giới hạn khuyến mãi: vượt ngân sách hoặc số suất trả `409 BUSINESS_RULE` "Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi.".

## 2h. Danh sách endpoint công nợ (MODULE_06 phần 1, CONG_VIEC_13)

Mọi đường dẫn có tiền tố `/api/v1`. API_84 đến API_86 nằm trong `apps/api/src/finance/finance.controller.ts`: mọi endpoint trước hết cần `finance.access` hoặc `finance.debt.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm trong service (`requireFinancePermission`, `apps/api/src/finance/finance-context.ts`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201`. Mã trong đường dẫn phải là UUID.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_84 | `GET /finance/funds`; `GET /finance/funds/{id}`; `GET /finance/funds/{id}/ledger?from=&to=`; `POST /finance/funds`; `PATCH /finance/funds/{id}` | CHUC_NANG_65 | Danh sách: `finance.debt.view`, `finance.fund.manage` hoặc `finance.payment.manage`. Chi tiết, sổ quỹ: `finance.debt.view` hoặc `finance.fund.manage`. Thêm, sửa: `finance.fund.manage` | `code`, `name`, `kind`, `bankName`, `accountNo`, `accountHolder`, `openingBalance`, `status`, `version` (khi sửa). Sổ quỹ: `from`, `to` | `FundResponse[]`; `FundResponse`; `FundLedgerResponse` |
| API_85 | `GET /finance/partners?side=&search=`; `GET /finance/debts?side=&search=&overdueOnly=`; `GET /finance/debts/open?side=&partnerId=`; `GET /finance/debts/partners/{partnerId}?side=`; `POST /finance/debts/opening`; `DELETE /finance/debts/opening/{id}` | CHUC_NANG_66 | Chọn đối tác: `finance.debt.view`, `finance.payment.manage` hoặc `finance.debt.manage`. Danh sách, chi tiết đối tác: `finance.debt.view`. Chứng từ còn nợ: `finance.debt.view` hoặc `finance.payment.manage`. Số dư đầu kỳ: `finance.debt.manage` | Số dư đầu kỳ: `partnerId`, `side`, `direction`, `documentNo`, `documentDate`, `dueDate`, `amount`, `note` | `FinancePartnerOption[]`; `DebtSummaryResponse`; `OpenDebtsResponse`; `DebtPartnerResponse` |
| API_86 | `GET /finance/payments/options`; `GET /finance/payments?kind=&status=&partnerId=`; `GET /finance/payments/{id}`; `POST /finance/payments`; `PATCH /finance/payments/{id}`; `POST /finance/payments/{id}/submit`, `/withdraw` | CHUC_NANG_67 | Tùy chọn, danh sách, chi tiết: `finance.debt.view` hoặc `finance.payment.manage`. Lập, sửa, gửi: `finance.payment.manage`. Rút: `finance.payment.manage`, người lập, phiếu chờ duyệt | Lập, sửa: `kind`, `partnerId`, `fundId`, `paymentDate`, `amount`, `note`, `lines[]` (`debitItemId`, `amount`), `version` (khi sửa). Gửi: `version` | `PaymentOptionsResponse`; `PaymentListItem[]`; `PaymentResponse` |

Sửa API_77 (CONG_VIEC_13, THAY_DOI_09): `submit` tính ngoại lệ `credit_limit` theo dư nợ thật (QUYTAC_NGHIEPVU_92): số dư công nợ phải thu của khách ở công ty (biểu thức `receivableBalance`, trả trước làm giảm) cộng giá trị gồm thuế phần chưa giao của các đơn khác đã xác nhận; thay dư nợ tạm tính (QUYTAC_NGHIEPVU_69). Hợp đồng không đổi; `detail` vẫn là "<dư nợ sau đơn> > <hạn mức>", chỉ trả cho người có `crm.profile.manage`.

Bổ sung API_82 (CONG_VIEC_13): `resolve` với `action` `write_off` đóng biên bản và tạo khoản giảm phải thu `internal_write_off` của công ty mua (giá đơn bán của phần thiếu, trừ trước vào phiếu xuất gốc) trong cùng giao dịch; hợp đồng không đổi.

## 2i. Danh sách endpoint kế toán tổng hợp (MODULE_06 phần 2, CONG_VIEC_14)

Mọi đường dẫn có tiền tố `/api/v1`. API_87 đến API_89 nằm trong `apps/api/src/accounting/ledger.controller.ts`: mọi endpoint trước hết cần `finance.access` hoặc `finance.ledger.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm trong service (`requireFinancePermission`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201`. Mã trong đường dẫn phải là UUID (trừ `role`).

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_87 | `GET /finance/ledger/setup`; `POST /finance/ledger/setup`; `GET /finance/accounts`; `POST /finance/accounts`; `PATCH /finance/accounts/{id}`; `GET /finance/posting-rules`; `PUT /finance/posting-rules/{role}` | CHUC_NANG_69, CHUC_NANG_70 | Trạng thái: `finance.ledger.view` hoặc `finance.ledger.setup`. Danh sách tài khoản: `finance.ledger.view`, `finance.ledger.setup` hoặc `finance.journal.manage`. Định khoản: `finance.ledger.view` hoặc `finance.ledger.setup`. Khởi tạo, thêm, sửa tài khoản, đổi định khoản: `finance.ledger.setup` | Khởi tạo: không có. Thêm tài khoản: `parentId`, `code`, `name`. Sửa: `name`, `status`, `version`. Đổi định khoản: `accountId` | `LedgerSetupResponse`; `AccountResponse[]`; `PostingRuleResponse[]` |
| API_88 | `GET /finance/journals?sourceType=&status=&from=&to=`; `GET /finance/journals/{id}`; `POST /finance/journals`; `PATCH /finance/journals/{id}`; `POST /finance/journals/{id}/submit`, `/withdraw` | CHUC_NANG_71, CHUC_NANG_72 | Danh sách, chi tiết: `finance.ledger.view` hoặc `finance.journal.manage`. Lập, sửa, gửi: `finance.journal.manage`. Rút: `finance.journal.manage`, người lập, phiếu chờ duyệt | Lập, sửa: `journalDate`, `description`, `lines[]` (`accountId`, `partnerId`, `debit`, `credit`, `description`), `version` (khi sửa). Gửi: `version` | `JournalListItem[]`; `JournalResponse` |
| API_89 | `GET /finance/ledger/periods`; `POST /finance/ledger/periods/close`; `POST /finance/ledger/periods/reopen`; `GET /finance/ledger/trial-balance?from=&to=`; `GET /finance/ledger/accounts/{id}?from=&to=` | CHUC_NANG_73 | Kỳ: `finance.ledger.view` hoặc `finance.period.close`. Khóa, mở lại: `finance.period.close`. Bảng cân đối, sổ cái: `finance.ledger.view` | Khóa sổ: `month` (`YYYY-MM`). Mở lại: không có. Bảng cân đối, sổ cái: `from`, `to` | `LedgerPeriodsResponse`; `TrialBalanceResponse`; `AccountLedgerResponse` |

Bổ sung API_20 (CONG_VIEC_14): `PATCH /companies/{id}` đổi `accountingRegime` khác giá trị hiện tại thì trong cùng giao dịch gọi `beforeRegimeChange`: công ty đã có bút toán thì `400 VALIDATION_FAILED` tại `accountingRegime` "Công ty đã có bút toán, không đổi được chế độ kế toán."; đã khởi tạo kế toán nhưng chưa có bút toán thì xóa định khoản, tài khoản, cài đặt kế toán rồi lưu.

Bổ sung ghi sổ chứng từ (CONG_VIEC_14): công ty đã khởi tạo kế toán thì ghi sổ phiếu kho (API_65, API_76, API_79; trừ chuyển kho), phiếu thu chi (API_86), ghi tổn thất biên bản nội bộ (API_82) sinh bút toán trong cùng giao dịch. Ngày chứng từ (ghi tổn thất: hôm nay) thuộc kỳ đã khóa: gửi phiếu kho (mọi loại, kể cả chuyển kho, API_65, API_66, API_76, API_79) hoặc ghi sổ trả `409 BUSINESS_RULE` "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.", cả lần không thực hiện; phiếu chi duyệt xong rơi vào kỳ khóa thì `rejected`, `postError` `periodLocked`; phiếu kho duyệt xong rơi vào kỳ khóa thì `rejected` (ghi chú thêm lý do), nhả hàng giữ. Ghi tổn thất (API_82) sinh bút toán Nợ giảm trừ doanh thu, Nợ thuế đầu ra / Có phải thu.

Bổ sung API_85, API_86 (CONG_VIEC_14, THAY_DOI_10): `amount` của số dư đầu kỳ, phiếu thu chi, `lines[].amount` lẻ hơn đơn vị tiền tệ công ty thì `400` "Giá trị không hợp lệ." tại đúng trường. Công nợ phiếu kho, ghi tổn thất làm tròn đến đơn vị tiền tệ theo lũy kế từng dòng đơn (`finance.inventory_amounts`). Hợp đồng không đổi.

## 2j. Danh sách endpoint báo cáo tài chính (MODULE_06 phần 3, CONG_VIEC_15)

Như mục 2i: API_90 nằm trong `apps/api/src/accounting/ledger.controller.ts`, trước hết cần `finance.access` hoặc `finance.ledger.view` trong công ty đang làm việc; quyền chi tiết kiểm trong `StatementsService`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_90 | `GET /finance/statements?kind=&from=&to=&form=&format=` | CHUC_NANG_74, CHUC_NANG_75 | `finance.ledger.view` | Tham số truy vấn: `kind` (`balance_sheet`, `income_statement`), `from`, `to`, `form`, `format` (`xlsx`, `pdf`) | `StatementResponse`; tệp Excel hoặc PDF khi có `format` |

Bổ sung API_87 (CONG_VIEC_15): `PATCH /finance/accounts/{id}` nhận thêm `isLongTerm` (không bắt buộc; không gửi thì giữ giá trị cũ); `true` với tài khoản hệ thống thì `400 VALIDATION_FAILED` tại `isLongTerm` "Chỉ đánh dấu dài hạn cho tài khoản chi tiết do kế toán mở." (khóa `accountSystemLongTerm`). `GET /finance/accounts` trả thêm `isLongTerm`.

## 2k. Danh sách endpoint hóa đơn điện tử (MODULE_06 phần 4, CONG_VIEC_16)

Mọi đường dẫn có tiền tố `/api/v1`. API_91, API_92 nằm trong `apps/api/src/einvoice/einvoices.controller.ts`: mọi endpoint trước hết cần `finance.access` hoặc `finance.einvoice.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm trong service (`requireFinancePermission`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_91 | `GET /finance/einvoices?status=&overdue=&from=&to=&search=&page=&pageSize=`; `GET /finance/einvoices/{id}`; `POST /finance/einvoices/{id}/resend`; `GET /finance/einvoices/{id}/file/{format}`; `POST /finance/einvoices/{id}/replace`; `GET /finance/einvoice-returns?status=`; `POST /finance/einvoice-returns/{id}/adjust`; `POST /finance/einvoice-returns/{id}/buyer-invoice` | CHUC_NANG_77, CHUC_NANG_78, CHUC_NANG_79 | Danh sách, chi tiết, tệp, việc trả hàng: `finance.einvoice.view`. Gửi lại, thay thế, điều chỉnh giảm, hóa đơn của người mua: `finance.einvoice.manage` | Gửi lại, điều chỉnh: `version`. Thay thế: `buyerName`, `buyerTaxCode`, `buyerAddress`, `reason`, `version`. Hóa đơn của người mua: `series`, `invoiceNo`, `invoiceDate`, `version` | `PageResponse<EinvoiceListItem>`; `EinvoiceResponse`; tệp PDF, XML; `EinvoiceReturnTask[]` |
| API_92 | `GET /finance/einvoice-settings`; `PUT /finance/einvoice-settings`; `POST /finance/einvoice-settings/test` | CHUC_NANG_76 | Xem: `finance.einvoice.view` hoặc `finance.einvoice.setup`. Sửa, kiểm tra kết nối: `finance.einvoice.setup` | Sửa: `UpdateEinvoiceSettingsRequest`. Kiểm tra: không có | `EinvoiceSettingsResponse`; `{ ok, message }` |

Bổ sung API_65 (CONG_VIEC_16): ghi sổ phiếu xuất giao hàng (gửi phiếu, hoặc duyệt xong) của công ty đang bật hóa đơn điện tử, ngày phiếu không trước ngày bắt đầu, lập hóa đơn gốc `pending` (hoặc `setup_error`) trong cùng giao dịch; ghi sổ phiếu nhận hàng trả lại mà phiếu xuất gốc có hóa đơn gốc tạo việc chờ xử lý hóa đơn. Hợp đồng không đổi; lỗi nhà cung cấp không ảnh hưởng ghi sổ.

## 2l. Danh sách endpoint hoa hồng đội kinh doanh (MODULE_06 phần 5, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): API_93, API_94 không còn (trả `404`); `apps/api/src/commission` đã xóa. Nội dung dưới đây giữ để tra cứu; mã đã cấp không dùng lại.

Mọi đường dẫn có tiền tố `/api/v1`. API_93, API_94 nằm trong `apps/api/src/commission/commissions.controller.ts`: mọi endpoint trước hết cần `finance.access` hoặc `finance.commission.view` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`. Quyền chi tiết kiểm trong service (`requireFinancePermission`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201`; `DELETE` trả `200`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_93 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11). `GET`, `PUT /finance/commission-settings`; `GET /finance/commission-targets?month=`; `PUT /finance/commission-targets` | CHUC_NANG_80 | Xem: `finance.commission.view` hoặc `finance.commission.setup`. Sửa: `finance.commission.setup` | Cài đặt: `UpdateCommissionSettingsRequest`. Chỉ tiêu: `month`, `targets[]` (`userId`, `amount`) | `CommissionSettingsResponse`; `CommissionTargetsResponse` |
| API_94 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11). `GET /finance/commissions/events?userId=&from=&to=&page=&pageSize=`; `GET`, `POST /finance/commissions/statements`; `GET /finance/commissions/statements/{id}`; `POST /finance/commissions/statements/{id}/submit`, `/withdraw`; `DELETE /finance/commissions/statements/{id}` | CHUC_NANG_82, CHUC_NANG_83 | Xem: `finance.commission.view`. Lập, gửi, rút, bỏ bảng nháp: `finance.commission.manage`; rút: người lập | Lập: `month`. Gửi: `version`. Rút, bỏ: không có | `PageResponse<CommissionEventItem>`; `CommissionStatementsResponse`; `CommissionStatementResponse` |

Bổ sung (CONG_VIEC_17), hợp đồng không đổi: gửi đơn bán (API_77 `submit`) gán nhân viên hưởng hoa hồng trong cùng giao dịch; chi tiết đơn bán (API_77) trả thêm `commissionUserName` (tên nhân viên hưởng, trống khi chưa gán); ghi sổ phiếu thu chi (API_86), phiếu kho (API_65) ghi phát sinh hoa hồng trong cùng giao dịch trừ nợ; trừ nợ với số dư đầu kỳ (API_85) không phát sinh; ghi sổ phiếu kho của đơn không có khách ghi phát sinh bán lẻ. Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): không còn gán nhân viên hưởng, không còn `commissionUserName`, không còn ghi phát sinh.

## 2m. Danh sách endpoint đối soát ngân hàng (MODULE_06 phần 6, CONG_VIEC_18)

Mọi đường dẫn có tiền tố `/api/v1`. API_95 đến API_101 nằm trong `apps/api/src/bank/bank-reconciliation.controller.ts`. Trừ API_98, mọi endpoint trước hết cần `finance.access`, `finance.bank.view` hoặc `finance.bank.setup` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`; quyền chi tiết kiểm trong service (`requireFinancePermission`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201` (trừ API_98); `PUT` trả `200`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`. API_98 không cần đăng nhập, xác thực bằng khóa của kết nối; đúng khóa không giới hạn tần suất, chỉ đếm lần sai khóa theo địa chỉ IP (20 lần mỗi phút, vượt trả `429 RATE_LIMITED`) (quyết định của người dùng ngày 2026-11-10).

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_95 | `GET /finance/bank-connections` | CHUC_NANG_84 | `finance.bank.view` hoặc `finance.bank.setup` | Không có | `BankConnectionsResponse` |
| API_96 | `PUT /finance/bank-connections/{fundId}` | CHUC_NANG_84 | `finance.bank.setup` | `provider`, `enabled`, `rotateSecret`, `version` | `SaveBankConnectionResponse` |
| API_97 | `POST /finance/bank-connections/{fundId}/simulate` | CHUC_NANG_84 | `finance.bank.setup`; ngoài môi trường thật | `direction`, `amount`, `content`, `transactionDate` | `BankTransactionItem` |
| API_98 | `POST /public/bank-webhooks/{connectionId}` | CHUC_NANG_85 | Không cần đăng nhập; tiêu đề `Authorization: Apikey <khóa>` | Định dạng SePay | `{ "success": true }` |
| API_99 | `GET /finance/bank-transactions?fundId=&status=&direction=&from=&to=&search=&page=&pageSize=` | CHUC_NANG_85 | `finance.bank.view` | Không có | `BankTransactionsResponse` |
| API_100 | `GET /finance/bank-transactions/{id}/candidates`; `POST /finance/bank-transactions/{id}/confirm-receipt`, `/match`, `/ignore`, `/reopen` | CHUC_NANG_86 | `finance.bank.manage`; lập phiếu thu cần thêm `finance.payment.manage` | Lập phiếu thu: `partnerId`, `version`. Ghép: `paymentId`, `version`. Bỏ qua: `reason`, `version`. Bỏ ghép, thôi bỏ qua: `version` | `BankPaymentCandidate[]`; `BankTransactionItem` |
| API_101 | `GET /finance/bank-reconciliation?fundId=&from=&to=` | CHUC_NANG_87 | `finance.bank.view` | Không có | `BankReconciliationResponse` |

Bổ sung API_86 (CONG_VIEC_18), hợp đồng không đổi: ghi sổ phiếu thu chi (gửi phiếu, hoặc duyệt xong) của quỹ có kết nối ngân hàng thử ghép phiếu với giao dịch ngân hàng chưa ghép trong cùng giao dịch ghi sổ (QUYTAC_NGHIEPVU_115); phiếu thu lập từ gợi ý ghép đúng giao dịch của nó.

## 2n. Danh sách endpoint đối soát thu hộ (MODULE_06 phần 7, CONG_VIEC_19)

Mọi đường dẫn có tiền tố `/api/v1`. API_102 đến API_105 nằm trong `apps/api/src/collection/collection-statements.controller.ts`: mọi endpoint trước hết cần `finance.access`, `finance.collection.view` hoặc `finance.collection.setup` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`; quyền chi tiết kiểm trong service (`requireFinancePermission`): quyền phải gán ở phạm vi tập đoàn hoặc công ty đang làm việc. Dữ liệu công ty khác trả `404`. `POST` thành công trả `201` (trừ bỏ bảng nháp `204`); `PUT`, `DELETE` trả `200`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_102 | `GET`, `POST /finance/collectors`; `PUT /finance/collectors/{id}` | CHUC_NANG_88 | Xem: `finance.collection.view` hoặc `finance.collection.setup`. Thêm, sửa: `finance.collection.setup` | `partnerId`, `kind`, `status`, `version` | `CollectorsResponse`; `CollectorItem` |
| API_103 | `GET /finance/collection-statements?collectorId=&status=&from=&to=&page=&pageSize=`; `POST /finance/collection-statements` (multipart) | CHUC_NANG_89, CHUC_NANG_91 | Xem: `finance.collection.view`. Nhập, nhập lại: `finance.collection.manage` | `collectorId`, `statementNo`, `statementDate`, `file`; nhập lại thêm `statementId`, `version` | `CollectionStatementsResponse`; `CollectionStatementResponse` |
| API_104 | `GET /finance/collection-statements/{id}`; `DELETE /finance/collection-statements/{id}/lines/{lineId}?version=`; `POST /finance/collection-statements/{id}/discard`, `/submit`, `/withdraw` | CHUC_NANG_89, CHUC_NANG_90, CHUC_NANG_91 | Xem: `finance.collection.view`. Bỏ dòng, bỏ bảng nháp, gửi, rút: `finance.collection.manage` | Bỏ bảng nháp, gửi: `version`. Rút: không có | `CollectionStatementResponse`; bỏ bảng nháp: không có |
| API_105 | `GET /finance/collection-statements/template` | CHUC_NANG_89 | Như điều kiện chung (không kiểm quyền chi tiết) | Không có | Tệp `mau-doi-soat-thu-ho.xlsx` |

Bổ sung (CONG_VIEC_19, gồm sửa lỗi rà soát commit 0480edc), hợp đồng không đổi: công nợ (API_85) có thêm nguồn `collection_statement`; khởi tạo kế toán (API_87) lập bút toán cho bảng đối soát đã ghi sổ trước khi khởi tạo; định khoản (API_87) có thêm vai trò `collector_receivable`, `collection_fee`; danh sách bút toán (API_88) lọc được `commission`, `collection_statement`; ghi sổ phiếu thu chi (API_86): phiếu thu khách hàng, phiếu chi hoàn tiền cho khách hàng có đối tác là đơn vị thu hộ hạch toán `collector_receivable` (1388) thay vì `receivable` (131); lần trừ nợ giữa khoản giảm nợ nguồn `collection_statement` và khoản phải thu của phiếu xuất giao hàng ghi phát sinh hoa hồng như phiếu thu khách hàng.

## 2o. Danh sách endpoint báo cáo tài chính hợp nhất (MODULE_06 phần 8, CONG_VIEC_20)

Mọi đường dẫn có tiền tố `/api/v1`. API_106 đến API_109 nằm trong `apps/api/src/consolidation/consolidation.controller.ts` (đường dẫn gốc `/finance/consolidation`): mọi endpoint trước hết cần `finance.access`, `finance.consolidation.view` hoặc `finance.consolidation.manage` trong công ty đang làm việc (header `X-Company-Id`), không có thì `403 FORBIDDEN`; sau đó service kiểm quyền hợp nhất gán ở phạm vi tập đoàn (`requireGroupPermission`), quyền gán ở phạm vi công ty, chi nhánh không tính (`403 FORBIDDEN`). Tập đoàn là công ty gốc của công ty đang làm việc; bảng của tập đoàn khác trả `404`. `POST` thành công trả `201` (trừ bỏ bảng nháp `204`); `PUT`, `DELETE` trả `200`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_106 | `GET /finance/consolidation/scope`; `GET /finance/consolidation/preview?kind=&from=&to=`; `GET`, `POST /finance/consolidation` | CHUC_NANG_92, CHUC_NANG_93 | Xem: `finance.consolidation.view` hoặc `finance.consolidation.manage`. Lập: `finance.consolidation.manage` | Lập: `from`, `to` | `ConsolidationScopeResponse`; `ConsolidatedStatementResponse`; `ConsolidationsResponse`; `ConsolidationResponse` |
| API_107 | `GET /finance/consolidation/{id}`; `POST /finance/consolidation/{id}/recalculate`, `/discard` | CHUC_NANG_93, CHUC_NANG_95 | Xem: `finance.consolidation.view` hoặc `finance.consolidation.manage`. Tính lại, bỏ bảng nháp: `finance.consolidation.manage` | `version` | `ConsolidationResponse`; bỏ bảng nháp: không có |
| API_108 | `PUT /finance/consolidation/{id}/profit-lines/{lineId}`; `POST /finance/consolidation/{id}/entries`; `DELETE /finance/consolidation/{id}/entries/{entryNo}?version=` | CHUC_NANG_94 | `finance.consolidation.manage` | Sửa lãi: `amount`, `reason`, `version`. Điều chỉnh tay: `description`, `lines` (`accountCode`, `companyId`, `partnerId`, `debit`, `credit`), `version` | `ConsolidationResponse` |
| API_109 | `POST /finance/consolidation/{id}/submit`, `/withdraw`; `GET /finance/consolidation/{id}/export?kind=&format=` | CHUC_NANG_95 | Gửi, rút: `finance.consolidation.manage`. Xuất: `finance.consolidation.view` hoặc `finance.consolidation.manage` | Gửi: `version`. Rút: không có | `ConsolidationResponse`; tệp `.xlsx` hoặc `.pdf` |

Bổ sung (CONG_VIEC_20), hợp đồng không đổi: báo cáo tài chính (API_90) dùng chung phần đọc số liệu mới của `StatementsService` (`ledger`, `compute`) với báo cáo hợp nhất; với một công ty, không ghép mã, không dòng bổ sung, chỉ tiêu dư Nợ, dư Có tính theo từng công ty (chỉ một công ty) nên kết quả như trước; với nhiều công ty số dư ngược chiều giữa các công ty không bù trừ.

## 2p. Danh sách endpoint gán khách hàng cho nhân viên kinh doanh (MODULE_07 phần 2, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): API_110, API_111 không còn (trả `404`); tùy chọn nhân viên cho màn hình Ghé thăm thay bằng `GET /crm/visit-options` (mục 3v). Nội dung dưới đây giữ để tra cứu; mã đã cấp không dùng lại.

Mọi đường dẫn có tiền tố `/api/v1`, nằm trong `apps/api/src/crm/crm.controller.ts` (gọi `CustomerAssignmentsService`, `PartnersService`): mọi endpoint trước hết cần `crm.access` hoặc `crm.partner.view` trong công ty đang làm việc (header `X-Company-Id`) như mục 2c, không có thì `403 FORBIDDEN`. Quyền giao khách (`crm.customer.assign` gán ở phạm vi công ty hoặc tập đoàn) hoặc là trưởng phòng kiểm trong service (`403 FORBIDDEN`); phạm vi xem theo `crm.customer.view_all` (QUYTAC_NGHIEPVU_129). Phiếu, đối tác ngoài phạm vi trả `404`. `POST` thành công trả `201` (trừ bỏ phiếu nháp `204`); `PATCH` trả `200`. Mã trong đường dẫn phải là UUID. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE`.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_110 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11). `GET`, `POST /crm/customer-assignments`; `GET /crm/customer-assignment-options`; `GET`, `PATCH /crm/customer-assignments/{id}`; `POST /crm/customer-assignments/{id}/discard`, `/submit`, `/withdraw` | CHUC_NANG_97 | Xem: mọi người dùng mini app (phạm vi theo `crm.customer.assign`, QUYTAC_NGHIEPVU_132). Tùy chọn, lập, sửa, bỏ, gửi: `crm.customer.assign` hoặc là trưởng phòng. Rút: người gửi | Lập, sửa: `targetUserId`, `reason`, `partnerIds`, `version` (khi sửa). Bỏ, gửi: `version`. Rút: không có. Lọc `status`, `page`, `pageSize` (tối đa 100, mặc định 20) | Trang phiếu (`CustomerAssignmentListItem`); `CustomerAssignmentOptionsResponse`; `CustomerAssignmentResponse`; bỏ phiếu nháp: không có |
| API_111 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11). `GET /crm/partners/{id}/owner-history`; `POST /crm/partners/{id}/claim` | CHUC_NANG_98 | Lịch sử: `crm.partner.view`, khách trong phạm vi xem. Nhận: `crm.partner.manage`, không có `crm.customer.view_all` | Nhận: không có | `PartnerOwnerHistoryItem[]`; đối tác (như chi tiết của API_71) |
| API_116 | `POST /buyer/register/otp`; `POST /buyer/register` | CHUC_NANG_104 | Không cần đăng nhập; giới hạn số lần gọi theo địa chỉ IP |
| API_117 | `POST /buyer/login`; `POST /buyer/login/otp`, `/buyer/login/otp/verify`; `POST /buyer/password-reset/otp`, `/buyer/password-reset` | CHUC_NANG_105 | Không cần đăng nhập; đăng nhập dùng chung bộ đếm với `/auth/login`, `/auth/app/login` |
| API_118 | `GET /buyer/me`; `GET /buyer/referrals`; `POST /buyer/referrer`; `GET /buyer/sales/customers` | CHUC_NANG_106, CHUC_NANG_108 | Đăng nhập; không dùng `X-Company-Id`; khách phụ trách chỉ nhân viên kinh doanh |
| API_119 | `GET /marketplace/settings`; `PUT /marketplace/operator-company`; `GET /marketplace/buyers`, `/marketplace/buyers/{id}`; `POST /marketplace/buyers/{id}/referrer`; `POST`, `DELETE /marketplace/buyers/{id}/sales-flag` | CHUC_NANG_107, CHUC_NANG_108 | `marketplace.buyer.view` (xem), `marketplace.buyer.manage` (thao tác) tại công ty vận hành sàn; chọn công ty vận hành sàn cần `marketplace.buyer.manage` phạm vi tập đoàn |
| API_120 | `GET /marketplace/sales-team`; `PUT /marketplace/sales-units/{id}`; `PUT /marketplace/sales-units/{id}/manager`; `POST /marketplace/buyers/{id}/sales-move` | CHUC_NANG_109, CHUC_NANG_110 | `marketplace.buyer.view` (xem), `marketplace.buyer.manage` (thao tác) tại công ty vận hành sàn |
| API_121 | `GET /buyer/sales/proposal-options`; `GET`, `POST /buyer/sales/proposals`; `POST /buyer/sales/proposals/{id}/withdraw`; `GET /marketplace/sales-proposals`; `POST /marketplace/sales-proposals/{id}/approve`, `/reject` | CHUC_NANG_112 | Người quản lý trong đội (API người mua); quản trị như API_120 |
| API_122 | `GET /buyer/sales/team`; `GET /buyer/sales/members/{userId}/customers`; `GET /buyer/me` thêm `salesTitle`, `salesUnitName` | CHUC_NANG_111 | Thành viên đội; khách của cấp dưới chỉ trong nhánh (ngoài nhánh `404`) |
| API_123 | `GET`, `PUT /marketplace/store-settings`; `PUT /marketplace/carriers/{code}`; `GET /marketplace/listings`; `PUT /marketplace/listings/{productId}`; `PUT /marketplace/buyers/{id}/test-buyer` | CHUC_NANG_113 | `marketplace.order.view` (xem), `marketplace.order.manage` (thao tác) tại công ty vận hành sàn |
| API_124 | `GET /buyer/shop/products`, `/buyer/shop/products/{id}`; `GET /buyer/shop/images/{id}`; `GET /buyer/cart`; `PUT /buyer/cart/lines`; `DELETE /buyer/cart/lines/{variantId}` | CHUC_NANG_115 | Đăng nhập (API người mua); ảnh sản phẩm đang bán không cần đăng nhập |
| API_125 | `GET /buyer/regions/provinces`, `/buyer/regions/provinces/{code}/wards`; `GET`, `POST /buyer/addresses`; `PUT`, `DELETE /buyer/addresses/{id}`; `POST /buyer/addresses/{id}/default` | CHUC_NANG_114 | Đăng nhập; chỉ địa chỉ của mình |
| API_126 | `POST /buyer/orders/preview`; `POST /buyer/orders`; `GET /buyer/orders`, `/buyer/orders/{id}`; `POST /buyer/orders/{id}/cancel` | CHUC_NANG_116 | Đăng nhập; đặt hàng chỉ người mua thử (chưa mở đặt hàng); đơn của người khác `404` |
| API_127 | `GET /marketplace/orders`, `/marketplace/orders/{id}`; `POST /marketplace/orders/{id}/ship`, `/refresh-shipment`, `/cancel` | CHUC_NANG_116, CHUC_NANG_117 | Như API_123; giao đơn cần thêm quyền xuất giao hàng tại kho xuất |
| API_128 | `POST /public/carriers/{code}/webhook/{key}` | CHUC_NANG_117 | Không cần đăng nhập; khóa trên đường dẫn; sai khóa `403`, đếm theo địa chỉ IP, quá giới hạn `429` |
| API_130 | `PUT /marketplace/payment-methods/{code}`; `PUT /marketplace/ordering-open` | CHUC_NANG_120 | `marketplace.order.manage` tại công ty vận hành sàn |
| API_131 | `POST /buyer/orders/{id}/payments` | CHUC_NANG_121 | Đăng nhập (API người mua); đơn của người khác `404` |
| API_132 | `GET /public/payments/vnpay/ipn`; `GET /public/payments/vnpay/return` | CHUC_NANG_121 | Không cần đăng nhập; kiểm chữ ký HMAC SHA512; sai chữ ký IPN đếm theo địa chỉ IP, quá giới hạn `429`; trang trả về giới hạn theo địa chỉ IP |
| API_133 | `GET`, `PUT /buyer/bank-account`; `GET /marketplace/refunds`; `POST /marketplace/refunds/{id}/complete`; `POST /marketplace/orders/{id}/cod-collected` | CHUC_NANG_122, CHUC_NANG_124 | Người mua (tài khoản của mình); quản trị `marketplace.payment.manage` tại công ty vận hành sàn |
| API_134 | `PUT /marketplace/listings/{productId}/commission`; `PUT /marketplace/commission-settings` | CHUC_NANG_134 | `marketplace.order.manage` tại công ty vận hành sàn |
| API_135 | `GET /buyer/wallet` | CHUC_NANG_136 | Đăng nhập (API người mua); chỉ ví của mình |
| API_136 | `POST /buyer/withdrawals`; `POST /buyer/withdrawals/{id}/cancel`; `GET /marketplace/withdrawals`; `GET /marketplace/withdrawals/tax-report`; `POST /marketplace/withdrawals/{id}/approve`, `/reject`, `/pay` | CHUC_NANG_137 | Người dùng (yêu cầu của mình; của người khác `404`); quản trị `marketplace.payment.manage` tại công ty vận hành sàn, không xử lý yêu cầu của chính mình |
| API_137 | `POST /auth/warehouse-app/login` | CHUC_NANG_159 | Không cần đăng nhập; chung giới hạn số lần gọi với đăng nhập; tài khoản phải có `inventory.access` ở ít nhất một công ty |
| API_138 | `POST /inventory/stocktakes/{id}/count-additions` | CHUC_NANG_159 | `inventory.stocktake.count` hoặc `inventory.stocktake.manage` tại kho của đợt; kho ngoài phạm vi `404` |
| API_139 | `GET /inventory/stocktakes/{id}/count-entries?mine=` | CHUC_NANG_159 | Như API_138 |
| API_129 | `POST /buyer/return-requests/images` (multipart `file`); `GET /buyer/return-requests/images/{id}`; `POST /buyer/orders/{id}/return-requests`; `POST /buyer/return-requests/{id}/withdraw`; `GET /marketplace/return-requests`, `/marketplace/return-requests/{id}`, `/marketplace/return-requests/images/{id}`; `POST /marketplace/return-requests/{id}/approve`, `/reject`, `/receive`, `/not-received` | CHUC_NANG_118 | Người mua (yêu cầu, ảnh của mình); quản trị như API_123 |
| API_184 | `GET /office/people`; `GET`, `POST /office/tasks`; `GET`, `PATCH /office/tasks/{id}`; `POST /office/tasks/{id}/transition`, `/progress`; `GET /office/tasks/{id}/history` | CHUC_NANG_182 | `office.access`; thẻ `company` cần `office.task.view_all`; thao tác theo vai trò trên việc |
| API_185 | `GET`, `POST /office/tasks/{id}/comments`; `PATCH`, `DELETE /office/tasks/{id}/comments/{commentId}`; `GET`, `POST` (multipart `file`) `/office/tasks/{id}/files`; `GET`, `DELETE /office/tasks/{id}/files/{fileId}` | CHUC_NANG_182 | `office.access`; người xem được việc (QUYTAC_NGHIEPVU_357), sửa, xóa của mình |
| API_186 | `GET /office/workflow-design-options`; `GET`, `POST /office/workflow-templates`; `GET`, `PATCH /office/workflow-templates/{id}`; `POST /office/workflow-templates/{id}/activate`, `/deactivate` | CHUC_NANG_183 | `office.workflow.manage` |
| API_187 | `GET /office/workflow-start-options`; `GET`, `POST /office/workflow-runs`; `GET /office/workflow-runs/{id}`; `POST /office/workflow-runs/{id}/assign`, `/cancel` | CHUC_NANG_183 | `office.access`; xem phiên: người khởi tạo, người làm bước, `office.task.view_all`, `office.workflow.manage`; chỉ định, hủy: người khởi tạo hoặc `office.workflow.manage` |
| API_188 | `GET`, `POST /office/incoming`; `GET`, `PATCH /office/incoming/{id}`; `POST /office/incoming/{id}/files`, `/accept`, `/submit`, `/direct`, `/void`; `GET /office/incoming/{id}/files/{fileId}` | CHUC_NANG_184 | Vào sổ, sửa, hủy, nhận liên công ty: `office.document.clerk`; chỉ đạo: lãnh đạo được trình có `office.document.direct`; xem: văn thư, `office.document.view_all`, lãnh đạo, người được chuyển, người tham gia việc xử lý |
| API_189 | `GET`, `POST /office/outgoing`; `GET`, `PATCH /office/outgoing/{id}`; `GET /office/outgoing/{id}/render?format=pdf\|docx`; `POST /office/outgoing/{id}/files`, `/submit`, `/withdraw`, `/decide`, `/cancel`, `/number`, `/issue`; `GET /office/outgoing/{id}/files/{fileId}` | CHUC_NANG_184 | Soạn, trình, rút: `office.document.draft`, người soạn; quyết định: người ký (khi không có chính sách duyệt); cấp số, phát hành: `office.document.clerk`; xem: người soạn, người ký, người duyệt, nơi nhận đã phát hành, văn thư |
| API_190 | `GET /office/document-options`; `GET`, `PUT /office/document-settings`; `GET`, `POST /office/registers`; `PATCH /office/registers/{id}`; `GET /office/registers/{id}/export?year=`; `GET`, `POST /office/document-types`; `PATCH /office/document-types/{id}` | CHUC_NANG_184 | Tùy chọn, xem loại văn bản: `office.access`; còn lại `office.document.clerk` |
| API_191 | `GET /office/post-options`; `GET`, `POST /office/posts`; `GET`, `PATCH /office/posts/{id}`; `POST /office/posts/{id}/revoke`, `/acknowledge`; `GET /office/posts/{id}/readers`; `POST`, `PATCH`, `DELETE /office/posts/{id}/comments[/{commentId}]`; `POST /office/posts/{id}/files`; `GET`, `DELETE /office/posts/{id}/files/{fileId}` | CHUC_NANG_185 | `office.access`; đăng: `office.bulletin.post` ở công ty (toàn tập đoàn: ở phạm vi tập đoàn); sửa, thu hồi, tệp: người đăng; danh sách đã đọc: người đăng, người có quyền đăng cùng phạm vi; xem, xác nhận, bình luận: người nhận |

Sửa API_71, API_72, API_77 (CONG_VIEC_21, THAY_DOI_12), hợp đồng thêm trường, không bỏ trường:
- API_71 danh sách: thêm lọc `owner` (`mine` hoặc UUID nhân viên; lọc hồ sơ của công ty đang làm việc có `owner_user_id` tương ứng); dòng danh sách, chi tiết thêm `ownerUserName` (nhân viên phụ trách tại công ty đang làm việc, `null` khi không có). Người không có `crm.customer.view_all`: danh sách, chi tiết, `identity` chỉ gồm đối tác có hồ sơ khách hàng do mình hoặc nhân viên phòng mình quản lý phụ trách; khác thì `404`. `lookup` vẫn tìm toàn danh mục, chỉ trả mã, tên; có đối tác thì trả thêm `canClaim` (người dùng không có `crm.customer.view_all`, có `crm.partner.manage`; đối tác đang giao dịch, không phải công ty trong tập đoàn, chưa có hồ sơ tại công ty). `POST /crm/partners` của người không có `crm.customer.view_all`: tự lập hồ sơ khách hàng (`isCustomer` đúng, `paymentTermDays` 0, `creditLimit` 0, `ownerUserId` là người gọi), mở dòng lịch sử phụ trách.
- API_72 `PUT /crm/partners/{id}/profile`: đối tác ngoài phạm vi trả `404`; hồ sơ đã có `ownerUserId` mà gửi giá trị khác (kể cả `null`) trả `400` tại `ownerUserId` `ownerNeedsAssignment`; đặt `ownerUserId` khi hồ sơ chưa có thì mở dòng lịch sử phụ trách.
- API_77 đơn bán: người không có `crm.customer.view_all` chỉ thấy đơn trong phạm vi (khách thuộc phạm vi, hoặc `created_by`, `commission_user_id` là mình hoặc nhân viên phòng mình quản lý). `options` chỉ trả khách trong phạm vi; `price` với `customerId` ngoài phạm vi tra như không có khách (không lấy nhóm khách); danh sách lọc theo phạm vi; `GET /sales/orders/{id}`, `PATCH`, `submit`, `withdraw`, `cancel`, `close`, `counterpart-confirm`, `counterpart-reject` (API_80) với đơn ngoài phạm vi trả `404`. Lập, sửa đơn với `customerId` ngoài phạm vi trả `400` tại `customerId` "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty."; sửa đơn giữ được khách đang có trên đơn dù khách đã chuyển cho người khác.

## 2q. Danh sách endpoint báo cáo quản trị (MODULE_15 phần 1, CONG_VIEC_50)

Mọi đường dẫn có tiền tố `/api/v1`. API_170 đến API_175 nằm trong `apps/api/src/analytics/analytics.controller.ts` (đường dẫn gốc `/analytics`): mọi endpoint trước hết cần `analytics.access` trong công ty đang làm việc (`X-Company-Id`), rồi quyền của nhóm báo cáo xét trong service (`AnalyticsScopeService`). Quyền gán ở phạm vi tập đoàn: mọi công ty của tập đoàn; phạm vi công ty: công ty đang làm việc; phạm vi chi nhánh: không có hiệu lực (QUYTAC_NGHIEPVU_336). Chỉ đọc; không ghi dữ liệu nghiệp vụ, không phát sự kiện.

| Mã | Phương thức, đường dẫn | Chức năng | Quyền | Dữ liệu gửi lên | Kết quả |
|---|---|---|---|---|---|
| API_170 | `GET /analytics/scope` | CHUC_NANG_175 | `analytics.access` | Không có | `AnalyticsScopeResponse`: tập đoàn, hôm nay, công ty được xem, công ty theo từng nhóm báo cáo |
| API_171 | `GET /analytics/sales?companyIds=&from=&to=&groupBy=&channelId=&marketplaceOnly=&format=` | CHUC_NANG_175, CHUC_NANG_176 | `analytics.access`, `analytics.sales.view` | Tham số truy vấn | `AnalyticsSalesResponse` hoặc tệp `.xlsx` |
| API_172 | `GET /analytics/inventory?companyIds=&warehouseId=&from=&to=&groupBy=&format=` | CHUC_NANG_175, CHUC_NANG_176 | `analytics.access`, `analytics.inventory.view` | Tham số truy vấn | `AnalyticsInventoryResponse` hoặc tệp `.xlsx` |
| API_173 | `GET /analytics/debts?companyIds=&side=&groupBy=&format=` | CHUC_NANG_175, CHUC_NANG_177 | `analytics.access`, `analytics.debt.view` | Tham số truy vấn | `AnalyticsDebtResponse` hoặc tệp `.xlsx` |
| API_174 | `GET /analytics/commissions?companyIds=&from=&to=&groupBy=&format=` | CHUC_NANG_175, CHUC_NANG_177 | `analytics.access`, `analytics.commission.view` | Tham số truy vấn | `AnalyticsCommissionResponse` hoặc tệp `.xlsx` |
| API_175 | `GET /analytics/overview?companyIds=&from=&to=` | CHUC_NANG_175 | `analytics.access`; từng nhóm chỉ tiêu theo quyền nhóm đó | Tham số truy vấn | `AnalyticsOverviewResponse` |

## 3. Hợp đồng chi tiết

### API_01 `POST /auth/login`

Gửi lên:
```json
{ "identifier": "nhung.nguyen@vcomm.vn", "password": "••••••••••" }
```
Kết quả `200`:
```json
{ "mfaRequired": true, "user": { "id": "01J...", "fullName": "Nguyễn Thị Hồng Nhung", "locale": "vi" } }
```
Lỗi: `400 VALIDATION_FAILED` (thiếu trường); `401 UNAUTHENTICATED` "Thông tin đăng nhập không đúng." (cùng thông báo cho sai tên và sai mật khẩu); `423 ACCOUNT_LOCKED` kèm `retryAfterSeconds`; `429 RATE_LIMITED`.

### API_38 `POST /approval-requests` (nội bộ)

Gửi lên:
```json
{ "documentTypeCode": "purchasing.purchase_order", "documentId": "01J...", "documentNo": "DM-VCR-2026-000231",
  "amount": "2000.0000", "currency": "USD", "documentDate": "2026-11-09" }
```
Xử lý: tìm chính sách hiệu lực (QUYTAC_NGHIEPVU_17); quy đổi theo tỷ giá hạch toán ngày lập (QUYTAC_NGHIEPVU_19); tạo bước cho mọi cấp có ngưỡng nhỏ hơn hoặc bằng giá trị đã quy đổi (QUYTAC_NGHIEPVU_18); thay người duyệt là người lập bằng người thay thế (QUYTAC_NGHIEPVU_20); gửi thông báo cấp 1; ghi sự kiện outbox.

Kết quả `201`:
```json
{ "id": "01J...", "status": "pending", "currentLevelNo": 1, "amountInPolicyCurrency": "52600000.0000", "exchangeRate": "26300.00000000",
  "steps": [ { "levelNo": 1, "assignedUserId": "01J...", "isSubstitute": false, "dueAt": "2026-11-09T13:12:00+07:00" },
             { "levelNo": 2, "assignedRoleId": "01J...", "isSubstitute": false, "dueAt": null } ] }
```
Lỗi: `409 BUSINESS_RULE` "Chưa có chính sách duyệt cho loại chứng từ này.", "Chưa có tỷ giá hạch toán ngày lập chứng từ.", "Chứng từ đang chờ duyệt."

### API_41 `POST /approval-requests/{id}/decisions`

Gửi lên:
```json
{ "decision": "rejected", "comment": "Giá cao hơn báo giá quý III 12%." }
```
Kết quả `200`: yêu cầu kèm các bước (cấu trúc như API_38). Khi yêu cầu kết thúc, phát sự kiện `core.approval.completed` `{ requestId, documentTypeCode, documentId, status }`.

Lỗi: `400 VALIDATION_FAILED` "Vui lòng nhập lý do từ chối."; `403 FORBIDDEN` khi không phải người duyệt cấp hiện tại hoặc là người lập; `409 BUSINESS_RULE` khi yêu cầu không còn chờ duyệt.

### API_32 `POST /users/{id}/deactivate`

Gửi lên:
```json
{ "reason": "Nghỉ việc từ 30/11/2026",
  "handover": [ { "kind": "approval_step", "itemId": "01J...", "toUserId": "01J..." },
                { "kind": "department_manager", "itemId": "01J...", "toUserId": "01J..." } ] }
```
Xử lý: kiểm tra mọi mục trong API_31 đều có người nhận (QUYTAC_NGHIEPVU_27); chuyển việc; gỡ khỏi công ty đang chọn; còn thuộc công ty khác thì giữ tài khoản, ngược lại chuyển "Đã vô hiệu hóa" và thu hồi mọi phiên (QUYTAC_NGHIEPVU_26). Tất cả trong một giao dịch.

Lỗi: `409 BUSINESS_RULE` "Cần chọn người nhận bàn giao trước khi vô hiệu hóa."; `403 FORBIDDEN` "Bạn không thể khóa tài khoản của chính mình."

### API_31, API_32 (bổ sung lát L8)

- API_31 chỉ liệt kê bước duyệt giao đích danh cho nhân viên (chưa quyết định, yêu cầu còn chờ) và phòng ban nhân viên đang làm trưởng phòng, trong công ty đang chọn. Bước giao theo vai trò không cần bàn giao vì người khác cùng vai trò vẫn duyệt được.
- API_32 trả `{ id, status, remainingCompanies }`. Người nhận phải đang hoạt động trong công ty, khác người nghỉ, không phải người lập chứng từ; sai thì `400` tại trường `handover.<thứ tự>.toUserId`. Vai trò của nhân viên trong công ty bị gỡ hết hiệu lực từ hôm qua (lần gán bắt đầu từ hôm nay trở đi bị xóa); gỡ khỏi công ty cuối cùng thì kết thúc cả vai trò phạm vi tập đoàn.
- API_29 trả thêm `mfaEnabled` để MAN_HINH_13 chỉ hiện nút đặt lại xác thực hai lớp khi nhân viên đã bật. API_33 trả `409` "Chưa bật xác thực hai lớp." khi chưa bật; thu hồi mọi phiên của nhân viên.

### API_43, API_44 (bổ sung lát L8)

- Kỳ trong số chứng từ: theo năm `2026`; theo tháng `202611`; không đặt lại thì bỏ phần kỳ. Ví dụ `PN-VCR-202611-000001`, `PN-VCR-000001`.
- `GET` trả mọi loại chứng từ; loại chưa cấu hình có `configured: false`, `nextNumber: null`. API_44 với loại chưa cấu hình trả `409` "Chưa cấu hình dãy số cho loại chứng từ này.".
- Số cấp trong giao dịch lưu chứng từ, khóa dòng của kỳ đến hết giao dịch.

### API_45 (bổ sung lát L8)

`GET /exchange-rates?date=2026-11-09` (mặc định hôm nay theo giờ Việt Nam) trả:
```json
{ "date": "2026-11-09", "baseCurrency": "VND", "canManage": false, "missingAccounting": ["CNY"],
  "data": [ { "id": "01J...", "rateDate": "2026-11-09", "fromCurrency": "USD", "toCurrency": "VND", "rateType": "accounting", "source": "vietcombank", "rate": "26300" } ] }
```
`source` nhận `manual` hoặc `vietcombank`. `PATCH` chỉ sửa `rate`. Quyền sửa xét ở công ty đang chọn hoặc phạm vi tập đoàn.

Lấy tự động (luồng 8 tài liệu 09): tác vụ nền chạy 8:30 sáng giờ Việt Nam, đọc bảng tỷ giá công khai của Vietcombank (`portal.vietcombank.com.vn`, giới hạn một lần mỗi 5 phút), ghi tỷ giá mua, chuyển khoản, bán và hạch toán (bằng tỷ giá chuyển khoản) sang VND cho các tiền tệ đang dùng, nguồn `vietcombank`. Tỷ giá đã có giữ nguyên. Nguồn lỗi thì thông báo `exchange_rate.fetch_failed` tới người có quyền `platform.exchange_rate.manage`. Khi quy đổi chứng từ gửi duyệt (API_38), tỷ giá hạch toán nhập tay được ưu tiên hơn tỷ giá lấy tự động. Máy chủ API cần được phép gọi ra tên miền này.

### API_47, API_48 (bổ sung lát L8)

- Mỗi dòng nhật ký có `entityLabel` (họ tên, tên công ty, số chứng từ, tên loại chứng từ...) để hiển thị. Đăng nhập thất bại ghi hành động `login.failed`, không có công ty, nên chỉ quản trị tập đoàn thấy.
- API_48 trả `{ unreadCount, data: [ { id, kind, title, link, payload, readAt, createdAt } ] }`, 30 thông báo mới nhất. Giao diện dựng nội dung theo `kind` và `payload.documentNo` bằng ngôn ngữ đang chọn; `title` tiếng Việt chỉ dùng khi loại chưa có bản dịch.

### API_02 đến API_05 (bổ sung CONG_VIEC_03)

- API_02 `POST /auth/otp/send` `{ "phone": "0901234567" }`: số được chuẩn hóa về `+84...`; sai định dạng trả `400`. Luôn trả `204`; số chưa gắn tài khoản đang hoạt động thì không gửi. Mã 6 chữ số, hiệu lực 5 phút, gửi mã mới thì mã cũ hết hiệu lực. Gửi qua eSMS.vn: đã cài mã Zalo OA và mẫu tin `esms.template.login_otp` thì gửi đa kênh Zalo ZNS rồi SMS, ngược lại gửi SMS (QUYTAC_NGHIEPVU_32). Lần gửi thứ 6 trong một giờ cho một số trả `429 RATE_LIMITED` "Bạn đã yêu cầu quá nhiều mã, thử lại sau.".
- API_03 `POST /auth/otp/verify` `{ "phone": "0901234567", "code": "123456" }`: đúng thì như API_01 (đặt cookie phiên, `mfaRequired`), lần đầu thêm cách đăng nhập `phone_otp`. Sai, hết hạn, đã dùng trả `401 UNAUTHENTICATED` "Mã không đúng hoặc đã hết hạn."; sai 5 lần thì mã hết hiệu lực.
- API_04: nhà cung cấp chưa cài đủ ở API_49 thì chuyển về trang lỗi. Tạo `state`, `code_verifier` (PKCE S256), lưu trong cookie `vc_oauth` (`HttpOnly`, `SameSite=Lax`, đường dẫn `/api/v1/auth/oauth`, ký bằng khóa máy chủ, hết hạn 10 phút). `mode=link` cần phiên đăng nhập đang hiệu lực. `mode=activate` chỉ cho Google, Microsoft, cần đường dẫn kích hoạt còn hiệu lực. Microsoft dùng tenant cài ở API_49, để trống là `organizations`.
- API_05: kiểm tra `state` khớp cookie, đổi mã lấy token trực tiếp với nhà cung cấp qua máy chủ (gửi `code_verifier`). Google, Microsoft lấy email đã xác minh từ token; Microsoft chỉ tin email khi cài tenant cụ thể của công ty. Zalo lấy mã định danh từ `graph.zalo.me`. Kết quả: đăng nhập về `/` hoặc `/xac-thuc` (MAN_HINH_02) khi bắt buộc xác thực hai lớp; liên kết về `/ho-so?lienKet=<provider>`; kích hoạt về `/dang-nhap?kichHoat=<provider>`.
- Lỗi của API_04, API_05 trả bằng chuyển hướng kèm tham số `loi` về `/dang-nhap` (đăng nhập), `/ho-so` (liên kết) hoặc `/kich-hoat?token=...` (kích hoạt): `oauthNotConfigured` "Cách đăng nhập này chưa được cài đặt. Liên hệ quản trị."; `notFound` (nhà cung cấp lạ); `oauthFailed` "Không đăng nhập được qua nhà cung cấp. Vui lòng thử lại." (sai `state`, hết hạn, nhà cung cấp lỗi); `emailNotInvited` "Email này chưa được cấp quyền truy cập. Liên hệ quản trị."; `providerNotLinked` "Tài khoản này chưa được liên kết. Đăng nhập bằng cách khác rồi liên kết trong hồ sơ cá nhân."; `identityLinkedElsewhere` "Tài khoản này đã được liên kết với tài khoản khác."; `unauthenticated` (liên kết khi chưa đăng nhập); `activationInvalid`; `activationEmailMismatch` "Email của tài khoản nhà cung cấp phải trùng email được mời.".

### API_49 Cài đặt tích hợp

Chỉ người có quyền `platform.integration.manage` ở phạm vi tập đoàn; người khác nhận `403 FORBIDDEN`. Cài đặt đọc từ cơ sở dữ liệu mỗi lần dùng nên lưu xong có hiệu lực ngay, không cần khởi động lại.

Khóa cài đặt: `google.client_id`, `google.client_secret`, `microsoft.client_id`, `microsoft.client_secret`, `microsoft.tenant`, `zalo.app_id`, `zalo.app_secret`, `esms.api_key`, `esms.secret_key`, `esms.brandname`, `esms.oa_id`, `esms.sandbox` (`true` là chế độ thử), `esms.template.login_otp`, `esms.template.approval_assigned`, `esms.template.approval_reminder`, `esms.template.approval_completed`. Khóa bí mật: `google.client_secret`, `microsoft.client_secret`, `zalo.app_secret`, `esms.api_key`, `esms.secret_key`.

`GET` trả:
```json
{ "settings": [ { "key": "google.client_secret", "secret": true, "configured": true, "value": null, "lastFour": "9876", "updatedAt": "2026-11-09T07:12:00.000Z" },
                { "key": "google.client_id", "secret": false, "configured": true, "value": "123.apps.googleusercontent.com", "lastFour": null, "updatedAt": "..." } ],
  "callbackUrls": { "google": "https://<tên miền>/api/v1/auth/oauth/google/callback", "microsoft": "...", "zalo": "..." } }
```
`PUT` gửi `{ "values": { "google.client_secret": "" }, "clear": ["zalo.app_secret"] }`: khóa bí mật để trống thì giữ giá trị cũ; giá trị thường để trống thì xóa; `clear` xóa hẳn. Giá trị tối đa 2.000 ký tự; khóa lạ trả `400 VALIDATION_FAILED`. Trả như `GET`. Nhật ký thao tác `integration_settings.update` chỉ ghi `••••<4 ký tự cuối>` với khóa bí mật.

`POST /integration-settings/test` (`200`): `{ "ok": true, "message": "esmsConnected", "officialAccounts": [ { "id": "4097311281936189049", "name": "VComm" } ] }`; chưa nhập khóa thì `ok: false`, `message: "esmsMissing"`; eSMS từ chối thì `ok: false`, `message` là lỗi nhà cung cấp.

`POST /integration-settings/test-message` nhận `{ "phone": "0909000111" }`, gửi một tin theo mẫu mã OTP đã đăng ký với mã ngẫu nhiên (không dùng đăng nhập được), ghi nhật ký gửi tin mục đích `test`. Trả `{ "ok": true, "message": "testSent", "officialAccounts": [] }`; chưa cài API key, Secret key, Brandname thì `message: "esmsMissing"`; eSMS từ chối thì `ok: false`, `message: "testFailed"`, lỗi xem ở nhật ký gửi tin. Số sai định dạng nhận `400`.

`GET /integration-settings/deliveries`: `[ { "id", "channel": "zns" | "zns_sms" | "sms", "purpose", "phoneMasked": "+8490***4567", "status": "sent" | "failed" | "skipped", "error", "createdAt" } ]`.

### API_50 Mẫu đề xuất

Trường của mẫu: `key` (chữ thường, số, gạch dưới, bắt đầu bằng chữ, tối đa 40 ký tự), `label`, `type` (`text`, `textarea`, `number`, `money`, `date`, `select`, `lines`), `required`, `options` (với `select`, tối đa 30), `columns` (với `lines`, tối đa 10 cột kiểu `text`, `number`, `money`; cột `amount` là thành tiền). Mẫu có 1 đến 30 trường. `code` gồm chữ in hoa và số, tối đa 10 ký tự. `amountField` là mã một trường `money`; để trống thì giá trị duyệt là tổng cột `amount` của các bảng chi tiết.

Tạo mẫu tạo kèm loại chứng từ `platform.proposal_<mã công ty>_<mã mẫu>` (cần duyệt) và dãy số chứng từ (tiền tố là mã mẫu, đặt lại theo năm, 6 chữ số). `POST /proposal-templates/defaults` tạo các mẫu PC, TU, MS còn thiếu và trả danh sách mẫu (`200`).

Lỗi: `400 VALIDATION_FAILED` chỉ ra trường, ví dụ `{ "fields.1.key": ..., "fields.1.options": ..., "amountField": ... }`, `code` "Mã mẫu đã có trong công ty."; `403 FORBIDDEN`; `409 CONFLICT_VERSION`.

### API_51 Đề xuất

Gửi lên:
```json
{ "templateId": "01J...", "title": "Chi tiếp khách quý IV",
  "values": { "recipient": "Nhà hàng Sen", "reason": "Tiếp đối tác", "amount": "12500000", "payment_method": "Chuyển khoản" } }
```
Bảng chi tiết: `"items": [ { "name": "Máy in laser", "quantity": "2", "unit": "cái", "amount": "8000000" } ]`. Tiền, số dạng chuỗi số thập phân; tiền VND không có phần lẻ; ngày dạng `YYYY-MM-DD`; `select` phải thuộc danh sách lựa chọn.

- `POST /proposals` (`201`), `PATCH /proposals/{id}`: lưu nháp, chỉ kiểm tra kiểu; trả đề xuất `status: "draft"`, `proposalNo: null`.
- `POST /proposals/{id}/submit` (`200`): kiểm tra thêm trường bắt buộc; cấp số từ dãy số chứng từ (ví dụ `PC-VCR-2026-000001`) và gửi yêu cầu duyệt như API_38 với `amount` là giá trị duyệt, trong cùng một giao dịch; trả `status: "pending"`, `approvalRequestId`.
- `POST /proposals/{id}/withdraw` (`200`): rút yêu cầu duyệt như API_42; trả `status: "withdrawn"`.
- Khi yêu cầu duyệt kết thúc (sự kiện `core.approval.completed`), đề xuất đổi sang `approved`, `rejected` hoặc `withdrawn`.
- `GET /proposals?scope=mine|company&status=&page=&pageSize=`: phân trang; `scope=company` cần `proposal_template.manage`, không có thì `403`.
- `DELETE /proposals/{id}` (`204`): xóa nháp cùng tệp đính kèm.

Kết quả chi tiết:
```json
{ "id": "01J...", "proposalNo": "PC-VCR-2026-000001", "title": "Chi tiếp khách quý IV", "templateName": "Phiếu đề nghị chi", "amount": "12500000", "currency": "VND",
  "status": "pending", "requestedByName": "Trịnh Thị Đề Xuất", "createdAt": "...", "submittedAt": "...", "templateId": "01J...",
  "template": { "name": "Phiếu đề nghị chi", "fields": [ ... ], "amountField": "amount" }, "values": { ... }, "approvalRequestId": "01J...",
  "attachments": [ { "id": "01J...", "fileName": "Hóa đơn GTGT số 123.pdf", "contentType": "application/pdf", "sizeBytes": 48211, "createdAt": "..." } ],
  "version": 2, "canEdit": false, "canWithdraw": true }
```
Lỗi: `400 VALIDATION_FAILED` tại `values.<mã trường>` ("Giá trị không hợp lệ.", "Vui lòng nhập thông tin này."); `403 FORBIDDEN` khi không phải người lập; `404 NOT_FOUND` khi không xem được (QUYTAC_NGHIEPVU_36); `409 BUSINESS_RULE` "Chỉ sửa được đề xuất đang ở trạng thái nháp.", "Chưa có chính sách duyệt cho loại chứng từ này." (đề xuất giữ Nháp, số không bị dùng); `409 CONFLICT_VERSION`.

### API_52 Tệp đính kèm

- Kiểm tra: đề xuất Nháp của chính người gọi; đuôi tệp thuộc `pdf`, `jpg`, `jpeg`, `png`, `xlsx`, `docx` và chữ ký đầu tệp khớp loại (`%PDF`; `FF D8 FF`; `89 50 4E 47`; `50 4B 03 04` cho XLSX, DOCX); kích thước tối đa 10 MB; tối đa 10 tệp mỗi đề xuất (khóa dòng đề xuất khi đếm). Loại nội dung lưu theo đuôi tệp đã kiểm, không theo trình duyệt gửi.
- Nội dung lưu S3 hoặc thư mục cục bộ theo khóa `proposals/<công ty>/<đề xuất>/<mã ngẫu nhiên>`; tên tệp gốc chỉ lưu trong cơ sở dữ liệu.
- `GET /attachments/{id}` trả nội dung với `Content-Disposition: attachment` (tên tệp UTF-8 theo RFC 5987) và `X-Content-Type-Options: nosniff`.
- Lỗi: `400 VALIDATION_FAILED` tại `file` "Chỉ nhận tệp PDF, JPG, PNG, XLSX, DOCX.", "Tệp vượt quá 10 MB."; `409 BUSINESS_RULE` "Mỗi đề xuất có tối đa 10 tệp đính kèm.", "Chỉ sửa được đề xuất đang ở trạng thái nháp."; `404 NOT_FOUND` khi không xem được đề xuất.

### API_53 In đề xuất PDF

Trả `application/pdf`, `Content-Disposition: inline`. Nội dung: tên công ty, tên mẫu, số đề xuất (nháp: "(chưa gửi)"), ngày, trạng thái, các trường, bảng chi tiết, giá trị duyệt, các cấp duyệt (người duyệt, quyết định, ý kiến, thời điểm). Dựng bằng `pdfmake`; chỉ đọc phông trong gói, không tải tài nguyên ngoài. Lỗi: `404 NOT_FOUND` khi không xem được.

### API_54 `GET /auth/methods`

Công khai, chịu giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP như API không cần đăng nhập khác. `phone` là `true` khi đã cài `esms.api_key`, `esms.secret_key`, `esms.brandname`; `google`, `microsoft`, `zalo` là `true` khi đã cài đủ mã ứng dụng và khóa bí mật của nhà cung cấp đó.

## 3a. Hợp đồng chi tiết MODULE_02 (CONG_VIEC_04)

### API_55 Ngành hàng, đơn vị tính
- Mã ngành hàng, mã đơn vị đổi thành chữ in hoa trước khi kiểm tra. Ngành hàng tối đa 4 cấp (tính cả nhánh con khi đổi ngành hàng cha); đổi ngành hàng cha thì cấp của cả nhánh được tính lại.
- Lỗi: `400 VALIDATION_FAILED` tại `code` "Mã ngành hàng đã có.", "Ngành hàng đã có sản phẩm, không đổi được mã.", "Mã đơn vị tính đã có."; tại `parentId` "Ngành hàng tối đa 4 cấp.", "Không chọn được ngành hàng con của chính nó làm ngành hàng cha.", "Ngành hàng này đã có sản phẩm nên không thêm được ngành hàng con.", "Giá trị không hợp lệ."; tại `tracksSerials` "Không theo dõi đồng thời lô và serial."; `403 FORBIDDEN` khi không có quyền ở phạm vi tập đoàn; `409 CONFLICT_VERSION`.

### API_56 Sản phẩm
Gửi lên:
```json
{ "categoryId": "01J...", "code": "", "name": "Điện thoại VPhone X", "brand": "VPhone", "vatRate": "10", "tracksLots": false, "tracksSerials": true, "warrantyMonths": 12,
  "baseUnitId": "01J...", "weightKg": "0,25", "volumeM3": null,
  "options": [ { "name": "Màu", "values": ["Đen", "Trắng"] }, { "name": "Dung lượng", "values": ["128GB", "256GB"] } ],
  "specifications": [ { "name": "Màn hình", "value": "6,1 inch" } ],
  "units": [ { "unitId": "01J...", "factor": "1" } ],
  "variants": [ { "id": "01J...", "sku": "", "optionValues": ["Đen", "128GB"], "status": "active", "barcodes": [ { "unitId": "01J...", "barcode": "8930000000011" } ] } ],
  "version": 1 }
```
- Giới hạn: `options` tối đa 3, mỗi thuộc tính 1 đến 30 giá trị; `variants` 1 đến 200; `units` tối đa 5; mã vạch tối đa 20 mỗi biến thể, dạng `^[0-9A-Za-z\-.]{4,40}$`; mã sản phẩm, mã hàng dạng `^[A-Z0-9\-_.]{1,40}$` (để trống thì tự sinh); `specifications` tối đa 50. Số thập phân nhận dấu phẩy hoặc dấu chấm; `version` bắt buộc khi sửa.
- `code` trống thì sinh `<mã ngành hàng>-<5 chữ số>`; mã hàng biến thể trống thì `<mã sản phẩm>-<2 chữ số>` (không phân loại thì bằng mã sản phẩm); biến thể đã có giữ mã cũ. Biến thể có `id` không còn trong danh sách chuyển `inactive`.
- `GET /catalog/products?search=`: tìm không dấu trong `search_text` (tên, mã, thương hiệu), hoặc đúng mã hàng, đúng mã vạch của công ty; chỉ sản phẩm của công ty, không gồm sản phẩm nhà bán.
- Lỗi: `400 VALIDATION_FAILED` chỉ đúng trường, đúng dòng: `categoryId` "Chỉ chọn ngành hàng cuối cùng (không có ngành hàng con).", `code` "Mã sản phẩm đã có trong công ty.", `variants.<n>.sku` "Mã hàng đã có trong công ty.", `variants.<n>.barcodes.<m>.barcode` "Mã vạch đã có trong công ty.", `variants.<n>.optionValues` "Biến thể không khớp thuộc tính phân loại." hoặc "Biến thể bị trùng.", `units.<n>.unitId` "Đơn vị tính không hợp lệ hoặc bị trùng.", `units.<n>.factor` "Giá trị không hợp lệ."; `403`; `404` sản phẩm công ty khác; `409 CONFLICT_VERSION`.

### API_57 Ảnh sản phẩm
- Kiểm tra: đuôi `jpg`, `jpeg`, `png`, `webp` và chữ ký đầu tệp khớp (`FF D8 FF`; `89 50 4E 47`; `RIFF....WEBP`); tối đa 5 MB (multer cắt ở 10 MB); tối đa 10 ảnh mỗi sản phẩm (khóa dòng sản phẩm khi đếm). Loại nội dung lưu theo loại đã kiểm. Tên tệp thay `\`, `/`, xuống dòng, dấu nháy kép bằng `_`, giữ tối đa 200 ký tự cuối.
- Tải về trả nội dung kèm `Cache-Control: private, max-age=3600`, `X-Content-Type-Options: nosniff`.
- Lỗi: `400` tại `file` "Chỉ nhận ảnh JPG, PNG, WEBP.", "Ảnh vượt quá 5 MB."; `409 BUSINESS_RULE` "Mỗi sản phẩm tối đa 10 ảnh."; `404` ảnh của công ty khác.

### API_58 Nhập sản phẩm từ Excel
- Cột theo `productImportColumns` (`packages/contracts`). Dòng cùng mã sản phẩm (hoặc cùng tên khi để trống mã) gộp thành một sản phẩm; mỗi sản phẩm lưu trong giao dịch riêng; sản phẩm lỗi thì mọi dòng của nó vào danh sách lỗi.
- `errorFileUrl` là tệp `.xlsx` dạng `data:` (base64) gồm cột "Dòng", các cột gốc, "Lý do"; `null` khi không có lỗi.
- Lỗi cả tệp: `400` tại `file` "Tệp không đúng mẫu.", "Tệp vượt quá 5 MB.", quá 2.000 dòng (thông báo hiện "Tệp vượt quá 1.000 dòng.").

### API_59 Liên kết, sao chép
- Kết quả liên kết: `{ id, variantId, sku, linkedVariantId, linkedSku, linkedProductId, linkedProductName, linkedCompanyId, linkedCompanyName, factor }`; đọc từ phía bên kia thì `factor` là nghịch đảo (ví dụ `"2"` thành `"0.5"`).
- Sao chép: sản phẩm mới ở công ty đích gồm biến thể đang bán, đơn vị, mã vạch chưa có ở công ty đích; mã sản phẩm, mã hàng đã có thì hệ thống sinh mã khác; liên kết từng biến thể hệ số 1; một giao dịch.
- Lỗi: `400` tại `linkedVariantId` hoặc `targetCompanyId` "Chọn công ty khác công ty đang làm việc."; `403` thiếu quyền ở công ty kia; `404` biến thể không thuộc công ty đang làm việc; `409 BUSINESS_RULE` "Biến thể đã liên kết với một biến thể của công ty đó.".

### API_60 Kênh bán, nhóm khách hàng
- `POST /catalog/sales-channels/defaults` thêm các kênh `BAN_SI` "Bán sỉ", `BAN_LE` "Bán lẻ", `SAN_VCOMM` "Sàn VComm", `NOI_BO` "Nội bộ" còn thiếu; trả `201` kèm danh sách kênh.
- Lỗi: `400` tại `code` "Mã đã có trong công ty."; `403`; `409 CONFLICT_VERSION`.

### API_61 Bảng giá, giá
- Tạo bảng giá kiểm tra kênh, nhóm khách đang dùng của công ty, tiền tệ đang dùng; trùng bảng giá đang dùng trả `400` tại `channelId` "Đã có bảng giá đang dùng cùng kênh, nhóm khách hàng, tiền tệ."; dùng lại bảng giá đã ngừng khi trùng trả `409 BUSINESS_RULE` cùng thông báo. Ngừng dùng bảng giá còn phiếu điều chỉnh giá chờ duyệt trả `409 BUSINESS_RULE` (khóa lỗi `priceListHasPendingChanges`) "Bảng giá còn phiếu điều chỉnh giá chờ duyệt; duyệt xong hoặc rút phiếu trước khi ngừng dùng." (QUYTAC_NGHIEPVU_44).
- `prices`: mỗi biến thể, đơn vị có giá trong bảng một dòng `{ variantId, sku, productName, optionValues, unitId, unitName, price, effectiveFrom }`, giá hiện hành tại `date` (mặc định hôm nay theo giờ Việt Nam).
- `history`: `[ { price, effectiveFrom, priceChangeId, changeNo, createdAt } ]`, mới trước.
- `lookup` trả `{ priceListId, priceListCode, includesVat, price, effectiveFrom, fromBaseUnit }`. Thứ tự bảng giá theo QUYTAC_NGHIEPVU_42; bảng chưa có giá thì xét bảng kế tiếp; đơn vị không có giá riêng thì giá đơn vị cơ sở nhân hệ số (`fromBaseUnit: true`). Không có giá: `404 NOT_FOUND` "Chưa có giá cho mặt hàng này.". Dùng cho MODULE_05.

### API_62 Phiếu điều chỉnh giá
- `POST`, `PATCH` lưu nháp; mỗi dòng lưu kèm `currentPrice` (giá hiện hành tại ngày hiệu lực). Kiểm tra bảng giá đang dùng của công ty; biến thể của công ty; đơn vị là đơn vị cơ sở hoặc đơn vị quy đổi của sản phẩm; không lặp biến thể và đơn vị.
- `submit` (`201`): ngày hiệu lực không trước hôm nay; công ty chưa có dãy số `catalog.price_change` thì tạo tiền tố `DCG`, đặt lại theo năm, 6 chữ số; cấp số (ví dụ `DCG-VCR-2026-000001`) và gửi yêu cầu duyệt như API_38 với `amount` = `0` trong cùng giao dịch. Chưa có chính sách duyệt thì `status: "approved"`, `approvalRequestId: null`, giá ghi ngay. Có thì `status: "pending"`.
- Khi nhận sự kiện `core.approval.completed` của loại chứng từ `catalog.price_change`: `approved` thì ghi các dòng vào lịch sử giá với ngày hiệu lực là ngày lớn hơn giữa ngày hiệu lực của phiếu và ngày duyệt; `rejected`, `withdrawn` chỉ đổi trạng thái.
- `withdraw` (`201`): rút yêu cầu duyệt như API_42; trả `status: "withdrawn"`.
- `import-lines`: tệp 3 cột "Mã hàng", "Mã đơn vị", "Giá", tối đa 2.000 dòng, 5 MB; trả `{ lines, errors: [{ row, message }] }`, có `priceListId` thì kèm giá hiện hành hôm nay.
- Lỗi: `400` tại `effectiveFrom` "Ngày hiệu lực không được trước hôm nay.", `lines.<n>.unitId` "Mặt hàng và đơn vị bị lặp.", `lines.<n>.variantId` hoặc `priceListId` "Giá trị không hợp lệ."; `403` khi không phải người lập; `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp."; rút khi cấp 1 đã quyết định nhận `409 BUSINESS_RULE` như API_42; `409 CONFLICT_VERSION`.

## 3b. Hợp đồng chi tiết MODULE_03 (CONG_VIEC_05)

### API_63 Kho, vị trí, cài đặt
- Mã kho, mã vị trí đổi thành chữ in hoa trước khi kiểm tra. Danh sách kho gồm kho của công ty đang làm việc mà nhân viên có quyền kho tại kho (`canOperate: true`) và kho nhận hàng của công ty đang làm việc khi nhân viên có `inventory.stock.view` ở công ty (`canOperate: false`, chỉ xem tồn). `ownerCompanyIds` luôn được thêm công ty sở hữu kho.
- Lỗi: `400` tại `code` "Mã kho đã có trong công ty."; tại `branchId`, `ownerCompanyIds` "Giá trị không hợp lệ."; tại `ownerCompanyIds` "Công ty chủ hàng còn tồn trong kho, không bỏ được."; tại `usesLocations` "Kho còn tồn, không đổi được cài đặt vị trí kệ."; tại `locations.<n>.code` "Mã vị trí đã có trong kho."; `409 BUSINESS_RULE` "Kho còn tồn, không ngừng dùng được.", "Vị trí còn tồn, không ngừng dùng được."; `403`; `404`; `409 CONFLICT_VERSION`.

### API_64 Tồn kho, thẻ kho
- Dòng tồn: `{ warehouseId, warehouseName, companyId, companyName, variantId, sku, productName, optionValues, baseUnitName, onHand, reserved, available, incoming, averageCost, value, minimum, belowMinimum }`. Phạm vi: kho thao tác được (mọi chủ hàng) và kho chỉ xem (chỉ hàng của công ty đang làm việc). `search` tìm tên không dấu, đúng mã hàng, đúng mã vạch.
- Giá vốn: `averageCost`, `value`, giá vốn serial, giá trị thẻ kho là `null` khi nhân viên không có `inventory.cost.view` tại kho, hoặc ở công ty đang làm việc cho hàng của công ty đó.
- Thẻ kho: ngày theo giờ Việt Nam; `from` sau `to` trả `400` tại `to`; tối đa 5.000 biến động. Kho, chủ hàng ngoài phạm vi trả `404`.

### API_65 Phiếu nhập khác, xuất khác, điều chỉnh
Gửi lên:
```json
{ "type": "issue_other", "warehouseId": "01J...", "companyId": "01J...", "documentDate": "2026-11-10", "reasonCode": "gift", "reason": "Tặng khách",
  "lines": [ { "variantId": "01J...", "unitId": "01J...", "quantity": "2", "lotId": "01J...", "lotOverrideReason": "Khách yêu cầu hạn dài", "locationId": null, "serials": [] } ] }
```
- `quantity` khác 0, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, nhận dấu phẩy; âm chỉ ở `adjustment`. `unitCost` theo đơn vị của dòng, bắt buộc ở `receipt_other`. `reasonCode` theo loại phiếu (`stockReasonCodes` trong `packages/contracts`). Dòng nhập hàng theo lô có `lotNo`, `expiresOn` (bắt buộc), `manufacturedOn`; dòng xuất có `lotId`. Serial tối đa 5.000 mỗi dòng.
- `submit`: kiểm tra theo CHUC_NANG_40; tạo dãy số nếu chưa có; cấp số dạng `NK-VCR-2026-000001`; giữ hàng; gửi yêu cầu duyệt như API_38 với `documentTypeCode` = `inventory.<loại>`, `amount` theo QUYTAC_NGHIEPVU_50, `currency` `VND`. Chưa có chính sách duyệt thì trả `status: "posted"` (phiếu chuyển kho: `posted` là đã duyệt, chờ xuất), `approvalRequestId: null`. Có thì `status: "pending"`.
- Khi nhận sự kiện `core.approval.completed` của loại chứng từ `inventory.*`: `approved` thì ghi sổ (phiếu chuyển kho sang `posted`); ghi sổ lỗi thì sự kiện được xử lý lại lần sau; `rejected`, `withdrawn` thì đổi trạng thái và nhả hàng giữ.
- `withdraw`: rút yêu cầu duyệt như API_42, phiếu `withdrawn`, nhả hàng giữ.
- Lỗi: `400` chỉ đúng trường, đúng dòng: `companyId` "Kho không nhận hàng của công ty này."; `lines.<n>.variantId` "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán."; `lines.<n>.quantity` "Không đủ hàng trong kho.", "Không đủ hàng khả dụng (một phần đang được giữ)."; `lines.<n>.lotId` "Lô đã hết hạn dùng."; `lines.<n>.lotOverrideReason` "Chọn lô khác lô gợi ý phải ghi lý do."; `lines.<n>.expiresOn` "Lô đã có với hạn dùng khác."; `lines.<n>.lotNo` "Sản phẩm không theo dõi lô."; `lines.<n>.serials` "Số serial phải bằng số lượng theo đơn vị cơ sở.", "Serial bị lặp.", "Serial đã có trong kho.", "Serial không có trong kho, vị trí này.", "Sản phẩm không theo dõi serial."; `lines.<n>.locationId` "Vui lòng nhập thông tin này."; `type` "Không đổi loại phiếu, kho, công ty chủ hàng của phiếu đã lập.". `403` khi không phải người lập. `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp.", "Không đủ hàng khả dụng (một phần đang được giữ)." (hai phiếu đồng thời), "Mặt hàng đang kiểm kê, chưa ghi sổ được."; `409 CONFLICT_VERSION`.

### API_66 Chuyển kho
- `ship` (`201`): phiếu phải ở `posted`; ghi sổ giảm kho nguồn theo thứ tự khóa của sổ kho; serial sang `in_transit`; lưu `costValue` từng dòng; phiếu `in_transit`. Người không có quyền tại kho nguồn nhận `403`, hoặc `404` khi không có `inventory.access` tại kho nguồn.
- `receive` (`201`): phiếu phải ở `in_transit`; ghi sổ tăng kho đích theo `receivedQuantity` với giá vốn lúc xuất; dòng nhận khác số xuất ghi `transfer_discrepancies`; phiếu `received`. Biên bản trả trong `discrepancies` (`difference` âm là thiếu; `value` là `null` khi không có quyền xem giá vốn).
- Lỗi: `400` tại `destinationWarehouseId` "Kho không nhận hàng của công ty này." hoặc "Giá trị không hợp lệ."; tại `lines.<n>.receivedQuantity` "Vui lòng nhập thông tin này." (thiếu dòng); `lines.<n>.destinationLocationId`; `lines.<n>.serials` "Số serial phải bằng số lượng theo đơn vị cơ sở.", "Serial không có trong phiếu chuyển kho."; `409 BUSINESS_RULE` "Phiếu chuyển kho chưa được duyệt hoặc đã xuất.", "Phiếu chuyển kho không ở trạng thái đang vận chuyển.".

### API_67 Kiểm kê
- `start`: tạo dãy `KK` nếu chưa có, cấp số, khóa dòng giá vốn của mặt hàng trong phạm vi rồi chụp tồn sổ sách; `status: "counting"`.
- `counts`: ghi đè số đếm theo dòng; dòng mới (không có `lineId`) cần `variantId`, `locationId` khi kho có vị trí, `lotId` khi hàng theo lô và số đếm lớn hơn 0.
- `finish`: `version` phải bằng phiên bản hiện tại; sinh phiếu điều chỉnh (lý do `stocktake`, `stocktakeId` gắn kiểm kê) rồi gửi như `submit` của API_65; gửi lỗi thì xóa phiếu vừa sinh, kiểm kê về `counting` và trả lỗi của bước gửi.
- Lỗi: `400` tại `companyId` "Kho không nhận hàng của công ty này."; `scopeIds`, `scopeType` "Giá trị không hợp lệ." hoặc "Vui lòng nhập thông tin này."; `counts.<n>.serials` "Số serial phải bằng số lượng theo đơn vị cơ sở.", "Serial bị lặp."; `counts.<n>.lotId`, `counts.<n>.countedQuantity` "Hàng theo lô: ghi số đếm theo lô đã có; lô mới nhập bằng phiếu nhập khác."; `409 BUSINESS_RULE` "Kiểm kê đã bắt đầu.", "Kiểm kê không ở trạng thái đang đếm.", "Còn dòng chưa có số đếm."; `409 CONFLICT_VERSION`.

### API_68 Giữ hàng
- Hàng giữ: `{ id, warehouseId, warehouseName, companyId, companyName, variantId, sku, productName, quantity, baseUnitName, sourceType, sourceNo, expiresAt, status, createdByName, createdAt, version }`. Giữ thủ công có `sourceType` `inventory.manual`, `sourceNo` là ghi chú, hạn theo cài đặt của công ty chủ hàng.
- Dịch vụ trong API cho MODULE_05: `ReservationsService.reserve(transaction, { warehouseId, companyId, variantId, quantity, sourceType, sourceId, sourceNo, expiresAt, userId })`, `closeBySource(transaction, sourceType, sourceId, "released" | "consumed")`, `available(...)`; gọi trong giao dịch của bên giữ.
- Lỗi: `409 BUSINESS_RULE` "Không đủ hàng khả dụng (một phần đang được giữ).", "Hàng giữ cho phiếu kho chỉ nhả khi phiếu bị từ chối hoặc rút."; `400` tại `companyId`, `variantId`; `409 CONFLICT_VERSION` (cả khi gia hạn hàng giữ không có hạn).

### API_69 Tồn an toàn
- `PUT` thêm hoặc thay mức của kho, công ty chủ hàng, biến thể; trả dòng kèm số gợi ý.
- Lỗi: `400` tại `maximum` "Giá trị không hợp lệ." khi tối đa nhỏ hơn tối thiểu; tại `companyId`, `variantId`; `403`.

### API_70 Tem PDF
- Trả `application/pdf`, `Content-Disposition: inline`. Mỗi tem một trang 50 × 30 mm (`MediaBox` 141,73 × 85,03 điểm), mã Code 128 bộ B. Tem sản phẩm: số trang = số biến thể × `copies`.
- Lỗi: `400` tại `variantIds` "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán." (có biến thể không thuộc công ty), mã không phải UUID; `403`; `409 BUSINESS_RULE` "Kho chưa có vị trí đang dùng để in tem.".

## 3c. Hợp đồng chi tiết MODULE_07 (CONG_VIEC_06)

### API_71 Đối tác dùng chung
Gửi lên (`POST /crm/partners`):
```json
{ "kind": "organization", "name": "Công ty TNHH Bao Bì Xanh", "shortName": "Bao Bì Xanh", "taxCode": "0301234567", "address": "12 Nguyễn Huệ, Quận 1", "phone": "0281234567", "email": "lienhe@baobixanh.test",
  "contacts": [ { "fullName": "Trần Thị Mai", "position": "Kế toán", "phone": "0901234567", "isPrimary": true } ],
  "bankAccounts": [ { "bankName": "Vietcombank", "accountNo": "0071000123456", "accountHolder": "CONG TY TNHH BAO BI XANH", "isDefault": true } ] }
```
- Dòng danh sách: `{ id, code, kind, name, shortName, taxCode, citizenIdMasked, phone, internalCompanyId, isCustomer, isSupplier, status }`. `citizenIdMasked` dạng `*********345`; số đầy đủ không có trong danh sách, chi tiết. Sắp `status` (đang giao dịch trước) rồi `name`. Mỗi lần đọc danh sách đồng bộ đối tác nội bộ trước (CHUC_NANG_47); công ty con có mã số thuế trùng đối tác khác được bỏ qua, ghi cảnh báo vào log.
- `search` tìm không dấu trong tên, tên ngắn, mã số thuế, điện thoại; khớp đúng mã đối tác (không phân biệt hoa thường), đúng mã số thuế, đúng điện thoại. `role` lọc theo hồ sơ của công ty đang làm việc; `internal` lọc đối tác nội bộ.
- Kiểm tra: chuỗi trống của trường tùy chọn coi như `null`; `taxCode` dạng `^[0-9]{10}(-[0-9]{3})?$`; `citizenId` dạng `^[0-9]{12}$`; `email` đúng định dạng; `accountNo` 4 đến 30 ký tự chữ, số, `-`; trường lạ bị từ chối.
- `POST` (`201`) sinh `code` dạng `DT000001`; nhật ký `partner.create` (`afterData`, số Căn cước công dân chỉ còn 3 số cuối). `PATCH` (`200`): `version` phải bằng phiên bản hiện tại; thay toàn bộ `contacts`, `bankAccounts`; cá nhân gửi `citizenId` trống thì giữ số đã lưu; nhật ký `partner.update` có `beforeData` (chi tiết trước khi sửa, số đã che), `afterData`. `deactivate`, `activate` (`201`): nhật ký `partner.deactivate`, `partner.activate`.
- `identity` (`200`): trả `{ "citizenId": "079090012345" }` (`null` khi đối tác không có số); mỗi lần gọi trả số ghi nhật ký `partner.view_identity` (không ghi số vào nhật ký); đối tác không có số thì không ghi nhật ký.
- `lookup`: trả đối tác có đúng `taxCode` hoặc `citizenId`; không gửi tham số nào thì `{ "partner": null }`. Gửi `citizenId` mà không có `crm.partner.manage` trả `403` (tránh dò tìm danh tính).
- Lỗi: `400` tại `taxCode` "Vui lòng nhập thông tin này.", "Giá trị không hợp lệ.", "Mã số thuế đã có ở đối tác khác trong tập đoàn."; tại `citizenId` "Vui lòng nhập thông tin này.", "Giá trị không hợp lệ." (sai định dạng, hoặc gửi kèm cho tổ chức, hộ kinh doanh), "Số Căn cước công dân đã có ở đối tác khác trong tập đoàn." (cả khi hai người lưu đồng thời, theo ràng buộc duy nhất bị vi phạm); `403`; `404` khi không có đối tác; `409 BUSINESS_RULE` "Đối tác nội bộ lấy thông tin từ công ty, sửa ở màn hình Công ty." (sửa, ngừng giao dịch, giao dịch lại đối tác nội bộ); `409 CONFLICT_VERSION`.
- Bổ sung CONG_VIEC_21: lọc `owner`, trường `ownerUserName`, `canClaim` trong `lookup`, phạm vi xem theo nhân viên phụ trách, tự lập hồ sơ khi thêm (mục 2p).
- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): bỏ lọc `owner`, bỏ `canClaim` trong `lookup`; không còn phạm vi xem theo nhân viên phụ trách, không tự lập hồ sơ khi thêm; vẫn trả `ownerUserName`.

### API_72 Hồ sơ đối tác của công ty
Gửi lên (`PUT /crm/partners/{id}/profile`):
```json
{ "isCustomer": true, "isSupplier": false, "paymentTermDays": 30, "creditLimit": "50000000", "customerGroupId": "01J...", "ownerUserId": "01J...", "note": "Giao buổi sáng", "version": 0 }
```
- Hồ sơ: `{ companyId, isCustomer, isSupplier, paymentTermDays, creditLimit, creditLimitHidden, currency, customerGroupId, customerGroupName, ownerUserId, ownerUserName, note, status, version }`; `creditLimit` trả dạng chuỗi bỏ số 0 thừa, `null` là không giới hạn; người xem không có quyền `crm.profile.manage` nhận `creditLimit: null`, `creditLimitHidden: true`. `currency` là tiền tệ của công ty (`core.companies.base_currency`). Chi tiết đối tác đọc từ công ty khác trả `profile: null`.
- `PUT` (`200`) lập mới (khi `version` 0) hoặc ghi đè hồ sơ của công ty đang làm việc; nhật ký `partner_profile.save` (loại đối tượng `partner_profile`) có `beforeData`, `afterData`.
- `partner-profile-options`: nhóm khách hàng đang dùng của công ty đang làm việc; nhân viên đang làm ở công ty, sắp theo tên.
- Lỗi: `400` tại `isCustomer` "Giá trị không hợp lệ." (không chọn khách hàng, nhà cung cấp); tại `paymentTermDays`, `creditLimit` (âm, quá 4 chữ số lẻ); tại `customerGroupId` "Giá trị không hợp lệ." (nhóm khách hàng của công ty khác hoặc ngừng dùng); tại `ownerUserId` "Giá trị không hợp lệ." (không làm ở công ty); tại `partnerId` "Không lập hồ sơ đối tác cho chính công ty đang chọn."; `403`; `404`; `409 CONFLICT_VERSION`.
- Bổ sung CONG_VIEC_21: `400` tại `ownerUserId` "Khách đã có nhân viên phụ trách; đổi nhân viên bằng phiếu giao khách." (`ownerNeedsAssignment`) khi đổi, bỏ nhân viên phụ trách đã có; đặt khi chưa có thì ghi lịch sử phụ trách (API_111); đối tác ngoài phạm vi xem `404` (mục 2p).
- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): bỏ lỗi `ownerNeedsAssignment`; đặt, đổi, bỏ nhân viên phụ trách bằng tay (chỉ kiểm nhân viên mới là thành viên đang làm việc); không ghi lịch sử phụ trách.

## 3d. Hợp đồng chi tiết MODULE_04 (CONG_VIEC_07)

### API_73 Bảng giá mua
Gửi lên (`POST /purchasing/supplier-prices`):
```json
{ "supplierId": "01J...", "variantId": "01J...", "unitId": "01J...", "minQuantity": "10", "unitPrice": "90000", "supplierSku": "NS-24", "validFrom": "2026-01-01", "validTo": null }
```
- Giá: `{ id, supplierId, supplierCode, supplierName, variantId, sku, productName, optionValues, unitId, unitName, minQuantity, unitPrice, supplierSku, validFrom, validTo, status, version }`; số trả dạng chuỗi bỏ số 0 thừa. Sắp `status` (đang dùng trước), tên nhà cung cấp, mã hàng, `minQuantity`, `validFrom` mới trước.
- `search`: đúng mã hàng (không phân biệt hoa thường), tên không dấu chứa từ khóa (ký tự `%`, `_`, `\` được thoát), đúng mã hàng nhà cung cấp.
- Kiểm tra: `minQuantity` tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, trống là 0; `unitPrice` tối đa 16 chữ số phần nguyên, 4 chữ số lẻ, chấp nhận dấu phẩy thập phân; `supplierSku` tối đa 50 ký tự; `validTo` không trước `validFrom`; trường lạ bị từ chối.
- `POST` (`201`), `PATCH` (`200`, `version` phải bằng phiên bản hiện tại), `deactivate`, `activate` (`201`): nhật ký `supplier_price.create`, `supplier_price.update` (có `beforeData`), `supplier_price.deactivate`, `supplier_price.activate`. `activate` kiểm lại chồng hiệu lực.
- `lookup`: giá đang dùng có hiệu lực tại `date` (mặc định hôm nay), `minQuantity` lớn nhất không vượt `quantity` (không gửi hoặc sai định dạng: 0); trả `{ "unitPrice": "96000", "priceId": "01J..." }` hoặc `{ "unitPrice": null, "priceId": null }`.
- `options`: nhà cung cấp (đối tác đang giao dịch có hồ sơ nhà cung cấp đang dùng ở công ty), kho đang dùng nhận hàng của công ty, `currency` của công ty. `items`: `search` 1 đến 100 ký tự; tìm đúng mã vạch, đúng mã hàng hoặc tên không dấu trong mặt hàng đang bán của công ty.
- Lỗi: `400` tại `supplierId` "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty."; tại `unitId` "Giá trị không hợp lệ." (mặt hàng, đơn vị không thuộc sản phẩm đang bán của công ty); tại `validFrom` "Đã có giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu trùng thời gian hiệu lực."; tại `minQuantity`, `unitPrice`, `validTo` "Giá trị không hợp lệ."; `403`; `404` (giá của công ty khác); `409 CONFLICT_VERSION`.

### API_74 Đề nghị mua
Gửi lên (`POST /purchasing/requisitions`):
```json
{ "warehouseId": "01J...", "neededBy": "2026-11-20", "reason": "Bổ sung hàng bán Tết",
  "lines": [ { "variantId": "01J...", "unitId": "01J...", "quantity": "10", "estimatedUnitPrice": "96000", "suggestedSupplierId": "01J..." } ] }
```
- Dòng danh sách: `{ id, documentNo, warehouseName, neededBy, reason, status, lineCount, estimatedTotal, createdByName, createdAt }`; mới lập trước. `openOnly=true`: đề nghị đã duyệt còn dòng chưa đặt hết. `search`: đúng số hoặc lý do chứa từ khóa.
- Chi tiết thêm `warehouseId`, `approvalRequestId`, `lines[]` (`{ id, variantId, sku, productName, optionValues, unitId, unitName, quantity, baseQuantity, estimatedUnitPrice, suggestedSupplierId, suggestedSupplierName, note, orderedBaseQuantity }`), `version`, `canEdit` (người lập, nháp, bị từ chối, đã rút), `canWithdraw` (người lập, chờ duyệt, cấp 1 chưa quyết định), `canOrder` (có `purchasing.order.manage`, đã duyệt, còn dòng chưa đặt hết).
- `POST` (`201`, nháp); `PATCH` (`200`): thay toàn bộ dòng, về nháp, bỏ yêu cầu duyệt cũ. `submit` (`201`): cấp số (`DNM` + năm + 6 số khi dãy tự tạo), gửi duyệt với `estimatedTotal`, tiền tệ công ty; chưa có chính sách duyệt thì `status` `approved`, `approvalRequestId` `null`. `withdraw` (`201`): rút yêu cầu duyệt, `status` `withdrawn`. `close` (`201`): đề nghị đã duyệt chuyển `closed`. Nhật ký `requisition.create`, `requisition.update`, `requisition.submit`, `requisition.close`.
- Lỗi: `400` tại `warehouseId`, `lines.{i}.unitId` "Giá trị không hợp lệ."; tại `lines.{i}.suggestedSupplierId` "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty."; `403` (không có quyền; gửi, rút đề nghị của người khác); `404`; `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (sửa khi không được sửa, gửi khi không ở nháp); `409 CONFLICT_VERSION` (sai phiên bản; đóng đề nghị không ở trạng thái đã duyệt).

### API_75 Đơn mua, cài đặt mua hàng
Gửi lên (`POST /purchasing/orders`):
```json
{ "supplierId": "01J...", "warehouseId": "01J...", "orderDate": "2026-11-10", "expectedDate": "2026-11-15", "note": "Giao trong tuần",
  "lines": [ { "variantId": "01J...", "unitId": "01J...", "quantity": "6", "unitPrice": "95000", "vatRate": "10", "requisitionLineId": "01J..." } ] }
```
- Dòng danh sách: `{ id, documentNo, supplierId, supplierName, warehouseName, orderDate, expectedDate, currency, totalAmount, taxAmount, status, createdByName }`; mới lập trước. `openOnly=true`: chỉ đơn đã duyệt. `search`: đúng số hoặc tên nhà cung cấp chứa từ khóa.
- Chi tiết thêm `warehouseId`, `note`, `approvalRequestId`, `closedReason`, `lines[]` (`{ id, lineNo, variantId, sku, productName, optionValues, unitId, unitName, factor, quantity, baseQuantity, unitPrice, vatRate, amount, requisitionLineId, receivedBaseQuantity, returnedBaseQuantity, receivableBaseQuantity }`), `receipts[]` (`{ id, documentNo, type, status, documentDate }` của phiếu nhập mua theo đơn và phiếu trả từ các phiếu nhập đó), `version`, `canEdit` (có `purchasing.order.manage`; nháp, bị từ chối, đã rút, đã duyệt), `canSubmit` (nháp), `canWithdraw` (người lập, chờ duyệt, cấp 1 chưa quyết định), `canClose` (đã duyệt). `receivedBaseQuantity` = phần đạt đã ghi sổ; `receivableBaseQuantity` = số đặt × (1 + dung sai/100) − đã nhận − đang chờ kiểm (chỉ khi đơn đã duyệt, không âm).
- `POST` (`201`, nháp; `currency` là tiền tệ công ty; `amount` = `quantity` × `unitPrice`; `taxAmount` theo `vatRate`). `PATCH` (`200`): đơn nháp, bị từ chối, đã rút về nháp; đơn đã duyệt giữ trạng thái, tăng `totalAmount` so với lần duyệt gần nhất hoặc đổi `supplierId` thì gửi duyệt lại trong cùng giao dịch (nhật ký `afterData.reapprove`). `submit` (`201`): cấp số (`DMH` khi dãy tự tạo) ở lần gửi đầu; miễn duyệt khi mọi dòng có `requisitionLineId` và tổng không vượt giá trị ước tính; còn lại gửi duyệt, chưa có chính sách thì duyệt ngay (`approvalRequestId` `null`). `withdraw` (`201`). `close` (`201`): `status` `closed`, lưu lý do, người, thời điểm. Nhật ký `purchase_order.create`, `purchase_order.update`, `purchase_order.submit` (`afterData.exempt`), `purchase_order.close`.
- Cài đặt: `GET` trả `{ "overReceiptTolerancePercent": "5", "version": 1 }` (chưa có: `"0"`, `0`); `PUT` (`200`) với `version` hiện tại; `overReceiptTolerancePercent` 0 đến 100, tối đa 2 chữ số lẻ; nhật ký `purchasing_settings.update`.
- Lỗi: `400` tại `supplierId` "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty."; tại `warehouseId`, `lines.{i}.unitId`, `lines.{i}.id` "Giá trị không hợp lệ."; tại `lines.{i}.requisitionLineId` "Giá trị không hợp lệ." (đề nghị chưa duyệt, đã đóng, của công ty khác hoặc khác mặt hàng); tại `lines.{i}.quantity` "Vượt số lượng còn lại của dòng đề nghị mua.", "Số lượng nhỏ hơn số đã nhận."; tại `lines.{i}.variantId`, `lines` "Dòng đã có phiếu nhập, không bỏ hoặc đổi mặt hàng, đơn vị được."; tại `overReceiptTolerancePercent` "Giá trị không hợp lệ."; `403`; `404`; `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp.", "Đơn mua còn phiếu nhập nháp hoặc chờ kiểm tra, chưa đóng được."; `409 CONFLICT_VERSION` (sai phiên bản; đóng đơn không ở trạng thái đã duyệt hoặc của công ty khác).

### API_76 Phiếu nhập mua, kiểm tra chất lượng, phiếu trả hàng nhà cung cấp
Gửi lên (`POST /inventory/purchase-receipts`):
```json
{ "orderId": "01J...", "documentDate": "2026-11-10", "note": null,
  "lines": [ { "orderLineId": "01J...", "quantity": "100", "lotNo": "L-SUA-01", "expiresOn": "2099-01-01", "serials": [] } ] }
```
Gửi lên (`POST /inventory/documents/{id}/quality-check`):
```json
{ "lines": [ { "lineId": "01J...", "rejectedQuantity": "10", "rejectedSerials": [], "rejectionReason": "Hộp móp, rò rỉ" } ], "version": 2 }
```
Gửi lên (`POST /inventory/purchase-returns`):
```json
{ "receiptId": "01J...", "documentDate": "2026-11-10", "reason": "Hàng lỗi", "lines": [ { "receiptLineId": "01J...", "quantity": "1", "serials": [] } ] }
```
- `purchase-orders`: đơn đã duyệt có kho nhận người dùng có `inventory.purchase.receive`, tối đa 50, ngày giao dự kiến sớm trước; `search` tìm trong số đơn, tên nhà cung cấp. `purchase-orders/{id}`: `{ id, documentNo, warehouseId, companyId, lines[] }`, dòng `{ orderLineId, variantId, sku, productName, optionValues, unitId, unitName, factor, orderedQuantity, receivableQuantity, tracksLots, tracksSerials, requiresQualityCheck }` (số theo đơn vị của dòng đơn).
- Phiếu nhập (`201`, `PATCH` `200`): phiếu nháp loại `purchase_receipt`, công ty chủ hàng, kho, nhà cung cấp theo đơn; `sourceType` `purchasing.order`; lý do `purchase`, diễn giải "Nhập mua theo đơn <số>"; mặt hàng, đơn vị, đơn giá lấy từ dòng đơn. Lập nháp kiểm sớm số còn nhận được. `PATCH` không đổi `orderId`.
- Phiếu trả (`201`, `PATCH` `200`): phiếu nháp loại `purchase_return` từ phiếu nhập đã ghi sổ; `sourceType` `inventory.document`; lý do `purchase_return`; mặt hàng, đơn vị, lô, vị trí theo dòng gốc; đơn giá = giá trị đã ghi sổ của dòng gốc / số đã nhập phần đạt × hệ số. `PATCH` không đổi `receiptId`.
- `submit` (`201`): khóa phiếu; phiếu nhập khóa đơn mua, kiểm đơn đã duyệt và dung sai; phiếu trả khóa các dòng gốc (theo thứ tự mã) rồi mới tính số đã trả, kiểm tổng trả không vượt số đã nhập phần đạt; kiểm như gửi phiếu kho (đủ hàng, lô, hạn, serial, vị trí); cấp số dãy `inventory.purchase_receipt` (`NM`), `inventory.purchase_return` (`TNCC`); không gửi duyệt. Phiếu nhập có dòng cần kiểm tra: `status` `quality_check`, chưa ghi sổ; còn lại ghi sổ (`posted`) và cập nhật đơn "Đã nhận đủ" khi đủ. Nhật ký `stock_document.submit` (`afterData.qualityCheck`).
- `quality-check` (`201`): dòng không gửi coi như đạt hết; hàng serial tính số không đạt bằng số serial; ghi `rejectedBaseQuantity`, `rejectionReason`, bỏ serial không đạt khỏi dòng; ghi sổ phần đạt với giá trị theo tỷ lệ; cập nhật trạng thái đơn; nhật ký `stock_document.quality_check`.
- Lỗi: `400` tại `lines.{i}.orderLineId`, `lines.{i}.receiptLineId` "Giá trị không hợp lệ."; tại `lines.{i}.quantity` "Vượt số còn nhận được của đơn mua (đã tính dung sai).", "Vượt số đã nhập còn trả được của phiếu nhập gốc."; tại `lines.{i}.serials`, `lines.{i}.rejectedSerials` "Serial không có trong kho, vị trí này."; tại `lines.{i}.rejectedQuantity` "Giá trị không hợp lệ." (vượt số nhận); tại `lines.{i}.rejectionReason` "Vui lòng nhập thông tin này."; tại `orderId`, `receiptId` "Không đổi loại phiếu, kho, công ty chủ hàng của phiếu đã lập."; lỗi kiểm phiếu của API_65; `403`; `404`; `409 BUSINESS_RULE` "Đơn mua chưa duyệt hoặc đã đóng, không nhận hàng được.", "Chỉ trả hàng từ phiếu nhập mua đã ghi sổ.", "Phiếu không ở trạng thái chờ kiểm tra chất lượng.", "Chỉ sửa được chứng từ đang ở trạng thái nháp."; `409 CONFLICT_VERSION`.

## 3e. Hợp đồng chi tiết MODULE_05 (CONG_VIEC_08)

### API_77 Đơn bán
Gửi lên (`POST /sales/orders`):
```json
{ "customerId": null, "buyerName": "Anh Tuấn", "channelId": "01J...", "warehouseId": "01J...", "orderDate": "2026-11-10", "deliveryAddress": null, "note": null,
  "lines": [ { "variantId": "01J...", "unitId": "01J...", "quantity": "2", "discountPercent": "5" } ] }
```
- Kiểm tra: `buyerName` tối đa 200, `deliveryAddress` 500, `note` 1.000 ký tự (chuỗi trống thành `null`); `quantity` lớn hơn 0, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, chấp nhận dấu phẩy thập phân; `discountPercent` 0 đến 100, tối đa 2 chữ số lẻ, trống là 0; trường lạ bị từ chối.
- Dòng danh sách: `{ id, documentNo, customerId, customerName, buyerName, channelName, warehouseName, orderDate, currency, netAmount, taxAmount, totalAmount, status, createdByName }`; mới lập trước. `search`: đúng số đơn (không phân biệt hoa thường), tên khách hoặc tên người mua chứa từ khóa (ký tự `%`, `_`, `\` được thoát); tối đa 100 ký tự.
- Chi tiết thêm `channelId`, `warehouseId`, `deliveryAddress`, `note`, `approvalRequestId`, `exceptions[]` (`{ kind, lineNo, detail }`, `kind` là `discount`, `below_cost`, `credit_limit`; `lineNo` `null` với hạn mức; `detail` của `credit_limit` (dư nợ sau đơn > hạn mức) chỉ trả khi người xem có `crm.profile.manage`, của `below_cost` (giá chưa thuế một đơn vị cơ sở < giá vốn bình quân) chỉ khi có `inventory.cost.view`, còn lại là chuỗi trống), `closedReason`, `lines[]` (`{ id, lineNo, variantId, sku, productName, optionValues, unitId, unitName, quantity, baseQuantity, priceListCode, listPrice, priceIncludesVat, discountPercent, unitPrice, vatRate, netAmount, taxAmount, totalAmount, deliveredBaseQuantity, returnedBaseQuantity }`), `documents[]` (`{ id, documentNo, type, status, documentDate }` của phiếu xuất giao hàng theo đơn và phiếu nhận hàng trả lại từ các phiếu đó), `version`, `canEdit` (có `sales.order.manage`; nháp, bị từ chối, đã rút), `canSubmit` (nháp), `canWithdraw` (người lập, chờ duyệt, cấp 1 chưa quyết định), `canCancel` (nháp, bị từ chối, đã rút; hoặc đã xác nhận chưa có phiếu xuất), `canClose` (đã xác nhận, đã có phiếu xuất, không còn phiếu xuất nháp). Số trả dạng chuỗi bỏ số 0 thừa.
- `POST` (`201`, nháp; `currency` là tiền tệ công ty; giá dòng tra theo kênh, nhóm khách, `orderDate`). `PATCH` (`200`): đơn nháp, bị từ chối, đã rút về nháp, thay toàn bộ dòng, bỏ yêu cầu duyệt cũ, xóa `exceptions`. `submit` (`201`): cấp số (`DBH` + năm + 6 số khi dãy tự tạo) ở lần gửi đầu; giữ hàng; tính `exceptions`; có ngoại lệ thì gửi duyệt với `totalAmount`, `status` `pending`; không ngoại lệ hoặc chưa có chính sách duyệt thì `confirmed`, `approvalRequestId` `null`. `withdraw` (`201`): rút yêu cầu duyệt, `status` `withdrawn`, nhả hàng giữ. `cancel` (`201`): `status` `cancelled`, nhả hàng giữ. `close` (`201`): đơn đã xác nhận, `status` `closed`, lưu lý do (1 đến 500 ký tự), người, thời điểm; nhả hàng giữ. Nhật ký `sales_order.create`, `sales_order.update` (có `beforeData`), `sales_order.submit` (`afterData` gồm số, ngoại lệ, mã yêu cầu duyệt), `sales_order.cancel`, `sales_order.close`.
- `price`: `{ "price": "158400", "priceListCode": "CHUNG", "includesVat": true, "vatRate": "10" }`; không có giá: `price`, `priceListCode` `null`, `includesVat` `false`. `date` mặc định hôm nay; `customerId` lấy nhóm khách của hồ sơ.
- `options`: khách (đối tác đang giao dịch có hồ sơ khách hàng đang dùng ở công ty, kèm `customerGroupId`), kênh đang dùng của công ty, kho đang dùng nhận hàng của công ty, `currency`. `items`: `search` 1 đến 100 ký tự; tìm đúng mã vạch, đúng mã hàng hoặc tên không dấu trong mặt hàng đang bán của công ty.
- Lỗi: `400` tại `customerId` "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty."; tại `channelId`, `warehouseId`, `lines.{i}.unitId` "Giá trị không hợp lệ."; tại `lines.{i}.variantId` "Chưa có giá cho mặt hàng này."; tại `lines.{i}.quantity` (dòng đầu của mặt hàng) "Không đủ hàng khả dụng (một phần đang được giữ)." khi gửi; `403` (không có quyền; rút đơn của người khác hoặc không ở chờ duyệt); `404` (đơn của công ty khác; `price` với mặt hàng, đơn vị không hợp lệ); `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (sửa khi không được sửa, gửi khi không ở nháp), "Đơn bán đã có phiếu xuất giao hàng hoặc không ở trạng thái hủy được; hãy đóng đơn.", "Đơn bán còn phiếu xuất giao hàng nháp, chưa đóng được."; `409 CONFLICT_VERSION` (sai phiên bản; đóng đơn không ở trạng thái đã xác nhận hoặc của công ty khác).

- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): `create`, `update`, `submit` cần `sales.order.manage` (Nhân viên bán hàng không còn, nhận `403`; Kế toán, Kế toán trưởng có). Đơn lập tay có mặt hàng hàng hóa (kể cả hàng tặng) khi `allowManualGoodsOrders` tắt: `409 BUSINESS_RULE` `manualOrderServicesOnly` "Đơn bán lập tay chỉ gồm mặt hàng dịch vụ. Hàng hóa bán qua sàn VComm." (kiểm khi lưu và khi gửi; đơn đối ứng nội bộ không kiểm lại khi gửi). Dòng dịch vụ không giữ hàng. Đơn xác nhận thì lập phiếu xuất dịch vụ trong cùng giao dịch, đơn có thể chuyển `delivered` ngay. Chi tiết bỏ `commissionUserName`. Danh sách, chi tiết, `options` không còn lọc theo phạm vi xem.

### API_78 Cài đặt bán hàng
- `GET` trả `{ "maxManualDiscountPercent": "5", "version": 1 }` (chưa có: `"0"`, `0`); `PUT` (`200`) với `version` hiện tại; `maxManualDiscountPercent` 0 đến 100, tối đa 2 chữ số lẻ; nhật ký `sales_settings.update` (có `beforeData`).
- Lỗi: `400` tại `maxManualDiscountPercent` "Giá trị không hợp lệ."; `403`; `409 CONFLICT_VERSION`.

- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): thêm `allowManualGoodsOrders` (`boolean`, mặc định `false`): `GET` trả, `PUT` nhận (tùy chọn; không gửi thì giữ giá trị cũ).

### API_79 Đơn bán chờ giao, phiếu xuất giao hàng, phiếu nhận hàng trả lại
Gửi lên (`POST /inventory/sales-issues`):
```json
{ "orderId": "01J...", "documentDate": "2026-11-10", "note": null,
  "lines": [ { "orderLineId": "01J...", "quantity": "1", "lotId": null, "locationId": null, "serials": [] } ] }
```
Gửi lên (`POST /inventory/sales-returns`):
```json
{ "issueId": "01J...", "documentDate": "2026-11-10", "reason": "Lỗi màn hình", "lines": [ { "issueLineId": "01J...", "quantity": "1", "serials": ["IMEI-B2"] } ] }
```
- `sales-orders`: đơn đã xác nhận có kho xuất người dùng có `inventory.sales.issue`, tối đa 50, ngày đơn sớm trước; `search` (tối đa 100 ký tự) tìm trong số đơn, tên khách, tên người mua; `customerName` là tên khách hoặc tên người mua. `sales-orders/{id}`: `{ id, documentNo, warehouseId, companyId, lines[] }`, dòng `{ orderLineId, variantId, sku, productName, optionValues, unitId, unitName, orderedQuantity, remainingQuantity, tracksLots, tracksSerials }` (số theo đơn vị của dòng đơn; còn phải giao = số đặt − đã giao phiếu đã ghi sổ).
- Phiếu xuất (`201`): đơn phải `confirmed`; phiếu nháp loại `sales_issue`, công ty chủ hàng, kho, khách theo đơn; `sourceType` `sales.order`; lý do `sale`, diễn giải "Giao hàng theo đơn <số>"; mặt hàng, đơn vị lấy từ dòng đơn; kiểm như phiếu kho và kiểm sớm số còn phải giao. Không có `PATCH`.
- Phiếu trả (`201`): phiếu nháp loại `sales_return` từ phiếu xuất đã ghi sổ người dùng xem được; `sourceType` `inventory.document`; lý do `sales_return`; mặt hàng, lô, vị trí theo dòng gốc; đơn vị là đơn vị cơ sở, `quantity` theo đơn vị cơ sở; đơn giá = giá trị đã ghi sổ của dòng gốc / số đã giao theo đơn vị cơ sở; serial phải thuộc dòng gốc. Không có `PATCH`.
- `submit` (`201`): khóa phiếu; phiếu xuất khóa đơn bán, kiểm đơn còn `confirmed` và tổng đã giao không vượt số đặt, dùng phần giữ của đơn (`consumeFromSource`, theo thứ tự mã mặt hàng); phiếu trả khóa dòng gốc, kiểm tổng trả không vượt số đã giao trừ đã trả; kiểm như gửi phiếu kho (đủ hàng khả dụng, lô, hạn, serial, vị trí) trong giao dịch; cấp số dãy `inventory.sales_issue` (`XBH`), `inventory.sales_return` (`NTL`); không gửi duyệt; ghi sổ (`posted`); phiếu xuất làm mọi dòng đủ số đặt thì đơn `delivered`. Nhật ký `stock_document.create`, `stock_document.submit`, `stock_document.delete`.
- Lỗi: `400` tại `lines.{i}.orderLineId`, `lines.{i}.issueLineId` "Giá trị không hợp lệ."; tại `lines.{i}.quantity` "Vượt số còn phải giao của đơn bán.", "Vượt số đã giao còn trả được của phiếu xuất gốc.", "Không đủ hàng khả dụng (một phần đang được giữ)."; tại `lines.{i}.serials` "Serial không có trong kho, vị trí này."; lỗi kiểm phiếu của API_65; `403`; `404`; `409 BUSINESS_RULE` "Đơn bán chưa xác nhận hoặc đã đóng, không giao hàng được.", "Chỉ nhận hàng trả lại từ phiếu xuất giao hàng đã ghi sổ.", "Chỉ sửa được chứng từ đang ở trạng thái nháp."; `409 CONFLICT_VERSION`.

- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): `sales-orders` chỉ gồm đơn có ít nhất một dòng hàng hóa; `sales-orders/{id}` chỉ trả dòng hàng hóa. Dòng dịch vụ trong phiếu: `400` tại `lines.{i}.variantId` `serviceNotStocked`.

## 3f. Hợp đồng chi tiết giao dịch nội bộ (MODULE_05 phần 2, CONG_VIEC_09)

### API_80, API_81 Xác nhận, từ chối chứng từ đối ứng
Gửi lên (`counterpart-confirm`):
```json
{ "warehouseId": "01J...", "version": 1 }
```
Gửi lên (`counterpart-reject`):
```json
{ "reason": "Hết hàng", "version": 1 }
```
- Kiểm tra: `warehouseId` là UUID; `reason` 1 đến 500 ký tự sau khi bỏ khoảng trắng; `version` số nguyên dương; trường lạ bị từ chối.
- Đơn đối ứng sinh tự động trong giao dịch xác nhận đơn bán (API_77 `submit` hoặc duyệt xong) hoặc duyệt đơn mua (API_75 `submit` hoặc duyệt xong): `status` `counterpart_pending`, `isCounterpart` `true`, `warehouseId` `null`, `documentNo` `null`, `canEdit` `false`, `canConfirmCounterpart` `true` với người có quyền quản lý.
- `counterpart-confirm` (`201`): khóa đơn ở `counterpart_pending` đúng phiên bản; kiểm kho đang dùng nhận hàng của công ty; ghi kho, người lập là người gọi, về `draft`; rồi gửi trong cùng giao dịch: đơn bán như API_77 `submit` (cấp số `DBH`, giữ hàng, ngoại lệ, `confirmed` hoặc `pending`); đơn mua như API_75 `submit` (cấp số `DMH`, `approved` hoặc `pending`). Nhật ký `sales_order.counterpart_confirm`, `purchase_order.counterpart_confirm` (`afterData` là dữ liệu gửi lên).
- `counterpart-reject` (`201`): đơn bán `cancelled`, đơn mua `closed` (`closedReason` bằng lý do), lưu `counterpartRejectedReason`; chứng từ khởi tạo bên kia kết thúc với lý do "Bên bán từ chối: <lý do>" hoặc "Bên mua từ chối: <lý do>". Nhật ký `sales_order.counterpart_reject`, `purchase_order.counterpart_reject`.
- Kết thúc hai bên (API_75 `withdraw`, `close`; API_77 `withdraw`, `cancel`, `close`; duyệt bị từ chối, rút): bên kia kết thúc trong cùng giao dịch, `closedReason` ví dụ "Bên bán hủy đơn bán đối ứng", "Bên mua đóng đơn mua đối ứng: <lý do>", "Bên mua rút đơn mua đối ứng", "Đơn bán đối ứng không được duyệt"; yêu cầu duyệt còn chờ của bên kia chuyển `withdrawn`, không phát `core.approval.completed`.
- Lỗi: `400` tại `warehouseId` "Giá trị không hợp lệ."; tại `customerId`, `supplierId`, `channelId`, `lines.{i}.variantId`, `lines.{i}.quantity` theo QUYTAC_NGHIEPVU_73, API_77 (ví dụ "Không đủ hàng khả dụng (một phần đang được giữ)."); `403`; `404`; `409 CONFLICT_VERSION` (sai phiên bản hoặc đơn không ở `counterpart_pending`); `409 BUSINESS_RULE` "Đơn bán còn phiếu xuất giao hàng nháp, chưa đóng được." khi kết thúc bên kia còn phiếu xuất nháp.

- Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): đơn bán, đơn mua nội bộ có mặt hàng hàng hóa khi công ty bán tắt `allowManualGoodsOrders`: `400` tại `lines.{i}.variantId` "Giao dịch nội bộ chỉ gồm mặt hàng dịch vụ." (`internalServicesOnly`). Đơn bán đã xác nhận và đơn mua đối ứng đã duyệt thì lập phiếu xuất, phiếu nhập dịch vụ cùng lúc; API_82 không áp dụng cho dịch vụ.

Tra giá nội bộ (`GET /purchasing/supplier-prices/lookup?supplierId=<đối tác nội bộ>&variantId=&unitId=&date=`): `{ "unitPrice": "120000.0000", "priceId": null, "internal": { "vatRate": "10" } }`; không có giá: `unitPrice` `null`, `internal.vatRate` `"10"`.

### API_82 Nhận hàng nội bộ, biên bản chênh lệch
Gửi lên (`POST /inventory/internal-receipts/{id}/receive`):
```json
{ "lines": [ { "lineId": "01J...", "receivedQuantity": "1", "locationId": null, "serials": [] } ], "shortageReason": "Rách thùng", "version": 1 }
```
Gửi lên (`POST /inventory/internal-discrepancies/{id}/resolve`):
```json
{ "action": "return", "note": "Hàng về lại kho", "version": 1 }
```
- Kiểm tra: `receivedQuantity` từ 0, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, chấp nhận dấu phẩy thập phân; `serials` tối đa 5.000, mỗi serial 1 đến 100 ký tự; `shortageReason`, `note` tối đa 500 ký tự (chuỗi trống thành `null`); trường lạ bị từ chối.
- `receive` (`201`): phiếu phải là phiếu nhập mua `in_transit` sinh từ phiếu xuất; mọi dòng phải có số nhận; số nhận không vượt số xuất; serial thuộc serial đã xuất; thiếu thì bắt buộc `shortageReason`; bỏ dòng nhận 0, kiểm như phiếu kho; khóa phiếu đúng phiên bản; cấp số dãy `inventory.purchase_receipt` của công ty mua (chưa có thì tự tạo tiền tố `NM`); ghi sổ (`posted`), ngày phiếu là hôm nay; cập nhật đơn mua; dòng thiếu sinh biên bản. Nhật ký `stock_document.receive_internal`. Trả chi tiết phiếu.
- `internal-discrepancies` (`200`): biên bản của công ty đang làm việc tại kho người gọi có `inventory.sales.issue`, mới trước, tối đa 500: `{ id, warehouseName, issueId, issueDocumentNo, receiptId, receiptDocumentNo, buyerCompanyName, sku, productName, baseUnitName, shortageBaseQuantity, value, currency, serials, reason, status, returnDocumentId, resolutionNote, resolvedByName, createdAt, version, canResolve }`; `value` `null` khi người gọi không có `inventory.cost.view` tại kho hoặc công ty.
- `resolve` (`201`): giữ biên bản (`open`, đúng phiên bản), ghi `returned` hoặc `written_off`, ghi chú, người, thời điểm; `return` lập và gửi phiếu nhận hàng trả lại theo API_79 (số thiếu, serial chưa nhận, lý do "Hàng thiếu khi giao nội bộ: <lý do>"), lưu `returnDocumentId`; lỗi thì xóa phiếu nháp, trả biên bản về `open` và trả lỗi đó. Nhật ký `internal_discrepancy.resolve`. Trả danh sách biên bản (mọi trạng thái).
- Lỗi: `400` tại `lines.{i}.receivedQuantity` "Số nhận vượt số đã xuất.", "Phải nhập số nhận cho mọi dòng của phiếu."; tại `lines.{i}.serials` "Serial không có trong phiếu xuất gốc."; tại `shortageReason` "Nhận thiếu phải ghi lý do."; lỗi kiểm phiếu của API_65 theo vị trí dòng xuất; `403`; `404`; `409 BUSINESS_RULE` "Phiếu nhập nội bộ không ở trạng thái chờ nhận."; `409 CONFLICT_VERSION`.

## 3g. Hợp đồng chi tiết khuyến mãi (MODULE_05 phần 3, CONG_VIEC_12)

### API_83 Chương trình khuyến mãi
Gửi lên (`POST /sales/promotions`, giảm theo sản phẩm):
```json
{ "name": "Bánh 10%", "kind": "product_discount", "validFrom": "2026-11-10", "validTo": "2026-12-31", "channelIds": [], "customerGroupIds": [],
  "items": [ { "variantId": "01J...", "discountPercent": "10" } ], "budgetAmount": "1000000", "note": null }
```
Giảm theo đơn: `"kind": "order_discount", "minOrderAmount": "200000", "orderDiscountPercent": "10", "maxOrderDiscount": "15000"`. Mua X tặng Y: `"kind": "buy_get", "buyVariantId": "01J...", "buyQuantity": "3", "giftVariantId": "01J...", "giftQuantity": "1", "maxGiftSets": 100`.
Gửi lên (`POST /sales/promotions/{id}/stop`):
```json
{ "reason": "Đổi kế hoạch", "version": 3 }
```
- Kiểm tra: `name` 1 đến 200 ký tự; `kind` một trong ba loại; `validFrom`, `validTo` dạng `YYYY-MM-DD`, `validTo` không trước `validFrom`; `channelIds`, `customerGroupIds` tối đa 50 UUID (mặc định rỗng); `items` tối đa 500, không trùng mặt hàng, `discountPercent` lớn hơn 0 đến 100 (2 chữ số lẻ); giảm theo sản phẩm phải có ít nhất 1 mặt hàng; giảm theo đơn bắt buộc `minOrderAmount`, `orderDiscountPercent` (lớn hơn 0 đến 100); mua X tặng Y bắt buộc `buyVariantId`, `buyQuantity`, `giftVariantId`, `giftQuantity`; số tiền, số lượng lớn hơn 0, chuỗi trống thành `null`; `maxGiftSets` số nguyên dương; `note` tối đa 1.000 ký tự; `reason` 1 đến 500 ký tự; trường lạ bị từ chối. Phía máy chủ: mặt hàng đang bán của công ty, kênh đang dùng của công ty không phải `NOI_BO`, nhóm khách đang dùng của công ty; `kind` `buy_get` có `budgetAmount` thì lỗi; trường của loại khác bị bỏ khi ghi.
- `GET /sales/promotions/options` (`200`): `{ channels: [{ id, code, name }], customerGroups: [{ id, code, name }], currency }` (kênh đang dùng trừ Nội bộ).
- `GET /sales/promotions` (`200`): tối đa 500, mới lập trước: `{ id, documentNo, name, kind, validFrom, validTo, status, usedAmount, usedGiftSets, budgetAmount, maxGiftSets, createdByName }`.
- `GET /sales/promotions/{id}` (`200`): thêm `channels`, `customerGroups` (`{ id, name }`), `items` (`{ variantId, sku, productName, discountPercent }`), `minOrderAmount`, `orderDiscountPercent`, `maxOrderDiscount`, `buy`, `gift` (`{ variantId, sku, productName, quantity, baseUnitName }` hoặc `null`), `note`, `approvalRequestId`, `stoppedReason`, `currency`, `version`, `canEdit`, `canSubmit`, `canWithdraw`, `canStop`.
- `POST` (`201`): lưu `draft`. Nhật ký `promotion.create`.
- `PATCH` (`200`): chương trình `draft`, `rejected`, `withdrawn`, đúng phiên bản; về `draft`, bỏ `approvalRequestId`. Nhật ký `promotion.update` (kèm dữ liệu trước).
- `submit` (`201`): chương trình `draft`, `rejected`, `withdrawn`; cấp số dãy `sales.promotion` (chưa cấu hình thì tự tạo tiền tố `KM`, đặt lại theo năm, 6 chữ số) ở lần gửi đầu; gửi luồng duyệt loại `sales.promotion` với giá trị là `budgetAmount` (trống thì 0); chưa có chính sách thì `active`, có thì `pending`. Nhật ký `promotion.submit`.
- `withdraw` (`201`): người lập, `pending`, cấp duyệt đầu chưa quyết định; rút yêu cầu duyệt (API duyệt), chương trình `withdrawn`.
- `stop` (`201`): chương trình `active` đúng phiên bản; `stopped`, ghi lý do, người, thời điểm. Nhật ký `promotion.stop`.
- Lỗi: `400` tại `items`, `minOrderAmount`, `orderDiscountPercent`, `buyVariantId`, `buyQuantity`, `giftVariantId`, `giftQuantity` "Vui lòng nhập thông tin này."; tại `validTo`, `items`, `items.{i}.variantId`, `items.{i}.discountPercent`, `channelIds`, `customerGroupIds`, `buyVariantId`, `giftVariantId`, `budgetAmount` "Giá trị không hợp lệ."; `403` (thiếu quyền; rút không phải người lập); `404`; `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (sửa, gửi chương trình đang chờ duyệt, đang chạy, đã dừng); `409 CONFLICT_VERSION` (sai phiên bản; dừng chương trình không đang chạy).

## 3h. Hợp đồng chi tiết công nợ (MODULE_06 phần 1, CONG_VIEC_13)

Quy ước: tiền dạng chuỗi số không âm hoặc dương tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, chấp nhận dấu phẩy thập phân; số trả về dạng chuỗi bỏ số 0 thừa; ngày `YYYY-MM-DD`; trường lạ bị từ chối; chuỗi trống của trường không bắt buộc thành `null`.

### API_84 Quỹ
Gửi lên (`POST /finance/funds`):
```json
{ "code": "NH", "name": "Ngân hàng A", "kind": "bank", "bankName": "Ngân hàng A", "accountNo": "0123456789", "accountHolder": "VComm Bán lẻ", "openingBalance": "500000", "status": "active" }
```
- Kiểm tra: `code` 1 đến 20 ký tự, `name` 1 đến 200, `bankName` tối đa 200, `accountNo` tối đa 50, `accountHolder` tối đa 200; `openingBalance` không âm (mặc định `"0"`); `status` `active`, `inactive` (mặc định `active`); `version` số nguyên dương khi sửa. Phía máy chủ: `bank` phải có `bankName`, `accountNo`; mã không trùng trong công ty (không phân biệt hoa thường); loại `cash` bỏ thông tin ngân hàng.
- Kết quả quỹ: `{ id, code, name, kind, bankName, accountNo, accountHolder, openingBalance, balance, status, hasPostings, currency, version, canManage }`; danh sách quỹ đang dùng trước, theo mã.
- `POST` (`201`): nhật ký `fund.create`. `PATCH` (`200`): khóa quỹ, đúng phiên bản; quỹ có phiếu `pending` hoặc `posted` thì không đổi `openingBalance`. Nhật ký `fund.update` (kèm dữ liệu trước).
- `ledger` (`200`): `{ fund, from, to, openingBalance, entries[] ({ paymentId, date, documentNo, kind, partnerName, receipt, payment, balance }), closingBalance }`; chỉ phiếu `posted`, theo ngày rồi thời điểm ghi sổ, tối đa 5.000 dòng.
- Lỗi: `400` tại `bankName`, `accountNo` "Vui lòng nhập thông tin này."; tại `code` "Mã quỹ đã có trong công ty."; tại `openingBalance` "Quỹ đã có phiếu thu chi, không sửa được số dư đầu."; `403`; `404`; `409 CONFLICT_VERSION`.

### API_85 Công nợ
Gửi lên (`POST /finance/debts/opening`):
```json
{ "partnerId": "01J...", "side": "receivable", "direction": "debit", "documentNo": "HD-CU-01", "documentDate": "2026-01-01", "dueDate": "2026-02-01", "amount": "50000", "note": null }
```
- Kiểm tra: `side` `receivable`, `payable`; `direction` `debit` (còn nợ), `credit` (trả trước); `documentNo` 1 đến 50 ký tự; `dueDate` bắt buộc với `debit`, không trước `documentDate`; `amount` lớn hơn 0; `note` tối đa 500; `search` tối đa 100 ký tự; `overdueOnly` `true`, `false`. Phía máy chủ: đối tác có hồ sơ khách hàng (`receivable`) hoặc nhà cung cấp (`payable`) ở công ty.
- `GET /finance/partners` (`200`): tối đa 20 `{ id, code, name }` là khách hàng hoặc nhà cung cấp của công ty theo `side`, tìm theo tên không dấu hoặc mã.
- `GET /finance/debts` (`200`): `{ side, currency, partners[] ({ partnerId, partnerCode, partnerName, balance, advance, notDue, overdue1To30, overdue31To60, overdue61To90, overdueOver90 }), totals }`; đối tác có khoản còn số còn lại, số dư giảm dần, tối đa 1.000; `overdueOnly=true` chỉ đối tác có khoản tăng quá hạn.
- `GET /finance/debts/partners/{partnerId}` (`200`): `{ partner, side, currency, balance, advance, ageing, items[] ({ id, direction, sourceType (`opening`, `sales_issue`, `sales_return`, `purchase_receipt`, `purchase_return`, `payment`, `internal_write_off`, `collection_statement`), sourceId, paymentKind, documentNo, documentDate, dueDate, amount, openAmount, overdueDays, note, canDelete, allocations[] ({ itemId, documentNo, sourceType, amount, date }) }), canManageOpening, canManagePayments }`; mới trước, tối đa 1.000. Đối tác không có hồ sơ và không có công nợ ở công ty đang chọn: `404`.
- `GET /finance/debts/open` (`200`): `{ advance, items[] ({ id, documentNo, sourceType, documentDate, dueDate, amount, openAmount, overdueDays }) }`; khoản tăng còn lại, cũ nhất trước.
- `POST /finance/debts/opening` (`201`): khóa công nợ của đối tác; tạo khoản `opening`, tự trừ (QUYTAC_NGHIEPVU_90); nhật ký `debt.opening.create`; trả chi tiết đối tác. `DELETE /finance/debts/opening/{id}` (`200`): chỉ khoản `opening` chưa trừ nợ, chưa được chọn trên phiếu thu chi; nhật ký `debt.opening.delete` (kèm dữ liệu trước); trả chi tiết đối tác.
- Lỗi: `400` tại `partnerId` "Đối tác không phải khách hàng của công ty." hoặc "Đối tác không phải nhà cung cấp của công ty."; tại `dueDate` "Vui lòng nhập thông tin này." hoặc "Giá trị không hợp lệ."; `403`; `404` (khoản không phải số dư đầu kỳ, của công ty khác); `409 BUSINESS_RULE` "Khoản số dư đầu kỳ đã được trừ nợ hoặc đang được chọn trên phiếu thu chi, không xóa được.".

### API_86 Phiếu thu, phiếu chi
Gửi lên (`POST /finance/payments`):
```json
{ "kind": "customer_receipt", "partnerId": "01J...", "fundId": "01J...", "paymentDate": "2026-11-10", "amount": "20000", "note": "Thu tiền hàng",
  "lines": [ { "debitItemId": "01J...", "amount": "10000" } ] }
```
Gửi lên (`POST /finance/payments/{id}/submit`): `{ "version": 1 }`.
- Kiểm tra: `kind` `customer_receipt`, `supplier_payment`, `customer_refund`, `supplier_refund`; `amount`, `lines[].amount` lớn hơn 0; `lines` tối đa 500 (mặc định rỗng; bỏ qua với hoàn tiền); `note` tối đa 500. Phía máy chủ: đối tác đúng phía theo loại (khách hàng với `customer_*`, nhà cung cấp với `supplier_*`); quỹ của công ty, đang dùng; mỗi dòng là khoản tăng còn nợ của đối tác ở phía đó, không trùng, không vượt số còn lại; tổng dòng không vượt `amount`; hoàn tiền không vượt trả trước đang còn.
- `options` (`200`): `{ funds[] ({ id, code, name, kind, balance }), currency }` (quỹ đang dùng).
- Danh sách (`200`): `{ id, documentNo, kind, paymentDate, partnerName, fundName, amount, status }`, ngày mới trước, tối đa 500.
- Chi tiết (`200`): `{ id, documentNo, kind, partner, fund, paymentDate, amount, currency, note, status, approvalRequestId, postError, lines[] ({ id, documentNo, sourceType, documentDate, dueDate, amount, openAmount, overdueDays, allocated }), unallocated, createdByName, postedAt, version, canEdit, canSubmit, canWithdraw }`. `lines`: chưa ghi sổ là chứng từ đã chọn kèm số trừ; đã ghi sổ là khoản tăng thực trừ. `unallocated`: phần thành trả trước. `postError`: khóa thông báo lỗi (nhóm `errors`, ví dụ `insufficientFundBalance`) chỉ khi `status` `rejected` do không ghi sổ được; giao diện dịch theo ngôn ngữ. `canWithdraw`: người lập, `pending`, cấp duyệt đầu chưa quyết định.
- `POST` (`201`): lưu `draft`; nhật ký `payment.create`. `PATCH` (`200`): phiếu `draft`, `rejected`, `withdrawn`, đúng phiên bản; về `draft`, xóa `postError`, thay toàn bộ dòng; phiếu đã có số không đổi được giữa loại phiếu thu (`customer_receipt`, `supplier_refund`) và phiếu chi (`supplier_payment`, `customer_refund`). Nhật ký `payment.update` (kèm dữ liệu trước).
- `submit` (`201`): phiếu `draft`, `rejected`, `withdrawn`, đúng phiên bản; cấp số theo dãy `finance.receipt` (tự tạo tiền tố `PT`) hoặc `finance.payment` (`PC`) ở lần gửi đầu, đặt lại theo năm. Phiếu chi gửi luồng duyệt với `amount`; có chính sách thì `pending`; chưa có chính sách, hoặc phiếu thu, thì ghi sổ ngay trong cùng giao dịch (`posted`). Ghi sổ: khóa công nợ của đối tác, khóa quỹ, tính số dư quỹ sau khi khóa; kiểm quỹ đang dùng, số dư quỹ (phiếu chi), số còn lại từng dòng, trả trước (hoàn tiền); tạo khoản công nợ `payment`, trừ nợ (không chọn dòng thì cũ nhất trước). Ghi sổ lỗi thì cả lần gửi không thực hiện, phiếu giữ trạng thái cũ, trả lỗi. Nhật ký `payment.submit` (số, mã yêu cầu duyệt).
- `withdraw` (`201`): người lập, `pending`; rút yêu cầu duyệt (API duyệt), phiếu `withdrawn`. Nhật ký `payment.withdraw`.
- Nghe `core.approval.completed` loại `finance.payment`: `approved` thì ghi sổ; lỗi nghiệp vụ thì phiếu `rejected`, `postError` là khóa lỗi; `rejected`, `withdrawn` thì chuyển tương ứng.
- Lỗi: `400` tại `partnerId` "Đối tác không phải khách hàng của công ty." hoặc "Đối tác không phải nhà cung cấp của công ty."; tại `fundId` "Giá trị không hợp lệ." hoặc "Quỹ đã ngừng dùng."; tại `lines.{i}.debitItemId` "Giá trị không hợp lệ."; tại `lines.{i}.amount` "Số trừ vượt số còn nợ của chứng từ."; tại `amount` "Tổng số trừ vượt số tiền phiếu." hoặc "Số tiền hoàn vượt tiền trả trước đang còn."; tại `kind` "Giá trị không hợp lệ." (đổi giữa phiếu thu và phiếu chi sau khi cấp số); `403` (thiếu quyền; rút phiếu của người khác hoặc không chờ duyệt); `404`; `409 BUSINESS_RULE` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (gửi phiếu không ở nháp, bị từ chối, đã rút), "Số dư quỹ không đủ.", "Quỹ đã ngừng dùng.", "Số trừ vượt số còn nợ của chứng từ.", "Số tiền hoàn vượt tiền trả trước đang còn." (khi ghi sổ ngay); `409 CONFLICT_VERSION`.

## 3i. Hợp đồng chi tiết kế toán tổng hợp (MODULE_06 phần 2, CONG_VIEC_14)

Quy ước: như mục 3h; số tiền dòng phiếu kế toán dạng chuỗi tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, máy chủ từ chối số lẻ hơn đơn vị tiền tệ công ty; tháng `YYYY-MM`. Công ty chưa khởi tạo kế toán: thao tác cần cài đặt trả `409 BUSINESS_RULE` "Công ty chưa khởi tạo kế toán.".

### API_87 Khởi tạo, tài khoản, định khoản
Gửi lên (`POST /finance/accounts`):
```json
{ "parentId": "01J...", "code": "1311", "name": "Phải thu khách hàng trong nước" }
```
- Kiểm tra: `code` 3 đến 20 chữ số hoặc chữ cái; `name` 1 đến 200 ký tự; `status` `active`, `inactive`; `version` số nguyên dương; `accountId` là UUID; `role` thuộc 22 vai trò (18 vai trò của CONG_VIEC_14, `commission_expense`, `staff_payable` của CONG_VIEC_17, `collector_receivable`, `collection_fee` của CONG_VIEC_19; khác thì `404`). Phía máy chủ: tài khoản cha thuộc công ty, đang dùng; `code` bắt đầu bằng số hiệu cha, dài hơn, chưa có trong công ty; tài khoản của định khoản đang dùng, không có con đang dùng.
- `GET /finance/ledger/setup` (`200`): `{ initialized, regime, regimeName, lockedThrough, canSetup }`; `regime` lấy từ công ty.
- `POST /finance/ledger/setup` (`201`): khóa công ty; đã khởi tạo thì `409`; ghi `settings`, nạp tài khoản của chế độ, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ (không kiểm khóa sổ); nhật ký `ledger.setup` (chế độ); trả trạng thái.
- `GET /finance/accounts` (`200`): `{ id, code, name, parentId, nature, isSystem, status, postable, hasLines, version, canEdit }[]`, theo số hiệu.
- `POST /finance/accounts` (`201`): tính chất theo cha; định khoản đang dùng tài khoản cha chuyển sang tài khoản mới; nhật ký `account.create`; trả danh sách tài khoản.
- `PATCH /finance/accounts/{id}` (`200`): khóa tài khoản, đúng phiên bản; `inactive` chỉ với tài khoản không phải hệ thống, không trong định khoản, không có con đang dùng; nhật ký `account.update` (kèm dữ liệu trước); trả danh sách tài khoản.
- `GET /finance/posting-rules` (`200`): `{ role, description, accountId, accountCode, accountName, canEdit }[]` theo thứ tự vai trò.
- `PUT /finance/posting-rules/{role}` (`200`): nhật ký `posting_rule.update`; trả danh sách định khoản.
- Lỗi: `400` tại `parentId` "Giá trị không hợp lệ."; tại `code` "Số hiệu tài khoản chi tiết phải bắt đầu bằng số hiệu tài khoản cha và dài hơn." hoặc "Số hiệu tài khoản đã có trong công ty."; tại `status` "Tài khoản của chế độ kế toán không ngừng dùng được.", "Tài khoản đang dùng trong định khoản mặc định." hoặc "Tài khoản còn tài khoản chi tiết đang dùng."; tại `accountId` "Tài khoản không nhận bút toán (đã ngừng dùng hoặc có tài khoản chi tiết)."; `403`; `404`; `409 BUSINESS_RULE` "Công ty đã khởi tạo kế toán.", "Công ty chưa khởi tạo kế toán."; `409 CONFLICT_VERSION`.

### API_88 Bút toán, phiếu kế toán
Gửi lên (`POST /finance/journals`):
```json
{ "journalDate": "2026-10-01", "description": "Số dư đầu kỳ",
  "lines": [ { "accountId": "01J...", "debit": "5000000", "credit": "0" }, { "accountId": "01J...", "partnerId": null, "debit": "0", "credit": "5000000", "description": "Vốn góp" } ] }
```
Gửi lên (`POST /finance/journals/{id}/submit`): `{ "version": 1 }`.
- Kiểm tra: `description` 1 đến 500 ký tự; `lines` 2 đến 200; `debit`, `credit` mặc định `"0"`; `lines[].description` tối đa 300; lọc `sourceType` (`manual`, `inventory_document`, `payment`, `internal_write_off`, `closing`, `commission`, `collection_statement`; `commission` nhận từ CONG_VIEC_19, trước đó lọc theo `commission` bị từ chối), `status` (`draft`, `pending`, `posted`, `rejected`, `withdrawn`), `from`, `to`. Phía máy chủ: công ty đã khởi tạo; ngày không thuộc kỳ đã khóa; mỗi dòng đúng một bên lớn hơn 0, không lẻ hơn đơn vị tiền tệ; tài khoản thuộc công ty, nhận bút toán được; đối tác có hồ sơ ở công ty, bắt buộc với tài khoản bắt đầu bằng 131, 331; tổng Nợ bằng tổng Có.
- Danh sách (`200`): `{ id, journalNo, journalDate, sourceType, description, totalAmount, status }`, ngày mới trước, tối đa 500.
- Chi tiết (`200`): danh sách thêm `{ sourceId, currency, lines[] ({ lineNo, accountId, accountCode, accountName, partnerId, partnerName, debit, credit, description }), approvalRequestId, postError, createdByName, version, canEdit, canSubmit, canWithdraw }`. `postError`: khóa thông báo lỗi chỉ khi `rejected` do không ghi sổ được. `canEdit`, `canSubmit`: phiếu `manual` ở `draft`, `rejected`, `withdrawn`, người có `finance.journal.manage`. `canWithdraw`: người lập, `pending`, cấp duyệt đầu chưa quyết định.
- `POST` (`201`): lưu `draft`, `manual`; nhật ký `journal.create`. `PATCH` (`200`): phiếu `manual` ở `draft`, `rejected`, `withdrawn`, đúng phiên bản (khác thì `409 CONFLICT_VERSION`); về `draft`, xóa `postError`, thay toàn bộ dòng; nhật ký `journal.update`.
- `submit` (`201`): phiếu `manual` ở `draft`, `rejected`, `withdrawn`, đúng phiên bản; kiểm lại kỳ; cấp số theo dãy `accounting.journal` (tự tạo tiền tố `PKT`) ở lần gửi đầu; gửi luồng duyệt với `totalAmount`; có chính sách thì `pending`; chưa có thì ghi sổ ngay trong cùng giao dịch (`posted`). Nhật ký `journal.submit` (số, mã yêu cầu duyệt).
- `withdraw` (`201`): người lập, `pending`; rút yêu cầu duyệt, phiếu `withdrawn`; nhật ký `journal.withdraw`.
- Ghi sổ (gửi khi chưa có chính sách, hoặc sau duyệt): kiểm lại kỳ và mọi tài khoản dòng còn nhận bút toán (khác thì `409 BUSINESS_RULE` "Tài khoản không nhận bút toán (đã ngừng dùng hoặc có tài khoản chi tiết).").
- Nghe `core.approval.completed` loại `accounting.journal`: `approved` thì ghi sổ; lỗi nghiệp vụ thì `rejected`, `postError` là khóa lỗi (ví dụ `periodLocked`); `rejected`, `withdrawn` thì chuyển tương ứng.
- Lỗi: `400` tại `lines.{i}.debit` "Mỗi dòng ghi một bên Nợ hoặc Có, lớn hơn 0." hoặc "Giá trị không hợp lệ." (số lẻ); tại `lines.{i}.accountId` "Tài khoản không nhận bút toán (đã ngừng dùng hoặc có tài khoản chi tiết)."; tại `lines.{i}.partnerId` "Giá trị không hợp lệ." hoặc "Vui lòng nhập thông tin này." (tài khoản 131, 331); tại `lines` "Tổng Nợ phải bằng tổng Có."; `403` (thiếu quyền; rút phiếu của người khác hoặc không chờ duyệt); `404`; `409 BUSINESS_RULE` "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.", "Công ty chưa khởi tạo kế toán.", "Chỉ sửa được chứng từ đang ở trạng thái nháp." (gửi bút toán không phải phiếu kế toán nháp, bị từ chối, đã rút); `409 CONFLICT_VERSION`.

### API_89 Kỳ khóa sổ, bảng cân đối số phát sinh, sổ cái
Gửi lên (`POST /finance/ledger/periods/close`): `{ "month": "2026-10" }`.
- `GET /finance/ledger/periods` (`200`): `{ lockedThrough, nextMonth, lastClosedMonth, canClose, canReopen }`. `nextMonth`: tháng sau `lockedThrough`; chưa khóa thì tháng của bút toán `posted` sớm nhất (không có thì `null`). `canClose`: có `finance.period.close`, có `nextMonth`, ngày cuối tháng trước hôm nay. `canReopen`: có `finance.period.close`, đã khóa.
- `close` (`201`): `month` phải bằng `nextMonth` và `canClose`; khóa `settings` (`FOR UPDATE`), ngày khóa chưa đổi; không còn phiếu kế toán `pending`, phiếu kho (trừ chuyển kho) `pending`, `quality_check`, `in_transit`, phiếu chi `pending` có ngày đến hết tháng; tạo bút toán `closing` số `KC-YYYY-MM` ngày cuối tháng: số dư lũy kế tài khoản bắt đầu 521 kết chuyển sang tài khoản của vai trò `revenue`; số dư từng tài khoản có số hiệu bắt đầu 5 đến 8 còn lại (trừ tài khoản của vai trò `income_summary`) kết chuyển sang tài khoản đó, số dư của nó sang tài khoản của vai trò `retained_earnings`; ghi `locked_through`; nhật ký `period.close`; trả kỳ.
- `reopen` (`201`): khóa `settings`; đã khóa; xóa bút toán `closing` ngày bằng `locked_through`; `locked_through` lùi về ngày của bút toán `closing` gần nhất trước đó (không có thì `null`); nhật ký `period.reopen`; trả kỳ.
- `trial-balance` (`200`): `{ from, to, currency, rows[] ({ accountId, code, name, depth, openingDebit, openingCredit, debit, credit, closingDebit, closingCredit }), totals }`; chỉ bút toán `posted` đến `to`; tài khoản `both` có đối tác tách theo đối tác; cộng dồn lên cha; chỉ tài khoản có số; `totals` cộng các tài khoản cấp cao nhất.
- `accounts/{id}` (`200`): `{ account ({ id, code, name, nature }), from, to, currency, openingBalance, entries[] ({ journalId, journalNo, journalDate, description, accountCode, counterAccounts[], partnerName, debit, credit, balance }), totalDebit, totalCredit, closingBalance }`; gồm tài khoản chi tiết; số dư theo bên Nợ (âm là dư Có); theo ngày, thời điểm tạo, số dòng; danh sách tối đa 10.000 dòng; `totalDebit`, `totalCredit`, `closingBalance` tính bằng SQL trên toàn khoảng ngày.
- Lỗi: `400` tại `to` "Ngày kết thúc phải sau ngày bắt đầu."; `403`; `404` (tài khoản của công ty khác); `409 BUSINESS_RULE` "Không khóa được tháng này (khóa lần lượt từng tháng đã kết thúc).", "Còn phiếu kế toán chờ duyệt trong kỳ.", "Còn phiếu kho hoặc phiếu chi đang chờ (duyệt, kiểm tra chất lượng, nhận hàng nội bộ) có ngày trong kỳ.", "Công ty chưa khởi tạo kế toán."; `409 CONFLICT_VERSION`.

## 3j. Hợp đồng chi tiết báo cáo tài chính (MODULE_06 phần 3, CONG_VIEC_15)

### API_90 Báo cáo tài chính
Ví dụ: `GET /finance/statements?kind=balance_sheet&to=2026-11-10&form=B01b-DNN`; `GET /finance/statements?kind=income_statement&from=2026-01-01&to=2026-11-10&format=pdf`.
- Kiểm tra (lược đồ `statementQuerySchema` trong `packages/contracts/src/index.ts`, trường thừa bị từ chối): `kind` bắt buộc, `balance_sheet` hoặc `income_statement`; `to` bắt buộc, ngày `YYYY-MM-DD`; `from` ngày, bắt buộc với `income_statement` (lược đồ `refine`; thiếu thì lỗi tại `from` "Giá trị không hợp lệ."), `balance_sheet` không dùng (thiếu thì bằng `to`); `form` tối đa 20 ký tự; `format` `xlsx` hoặc `pdf`. Phía máy chủ: có `finance.ledger.view`; công ty đã khởi tạo kế toán; `from` không sau `to`.
- Mẫu: theo chế độ kế toán của công ty. `TT99_2025`: `balance_sheet` B01-DN, `income_statement` B02-DN. `TT133`: `balance_sheet` B01a-DNN, hoặc B01b-DNN khi `form=B01b-DNN`; `income_statement` B02-DNN. `balance_sheet` với `form` không phải mẫu của chế độ thì `400 VALIDATION_FAILED` tại `form` "Giá trị không hợp lệ."; `income_statement` bỏ qua `form`.
- Không có `format` (`200`), `StatementResponse`:
```json
{ "kind": "balance_sheet", "form": "B01-DN", "name": "Báo cáo tình hình tài chính", "forms": ["B01-DN"], "regime": "TT99_2025",
  "company": { "name": "Công ty ...", "taxCode": "0300000000", "address": "..." }, "currency": "VND",
  "columns": [ { "label": "endOfPeriod", "from": null, "to": "2026-11-10" }, { "label": "startOfYear", "from": null, "to": "2025-12-31" } ],
  "lines": [ { "code": "131", "name": "1. Phải thu ngắn hạn của khách hàng", "level": 2, "note": "Mặc định toàn bộ là ngắn hạn (xem 211).", "current": "44000", "previous": "0" } ] }
```
- `columns`: `balance_sheet` có `endOfPeriod` (tại `to`), `startOfYear` (ngày trước ngày đầu năm tài chính chứa `to`, theo `core.companies.fiscal_year_start`); `income_statement` có `currentPeriod` (`from` đến `to`), `previousPeriod` (lùi một năm; ngày cuối tháng thành ngày cuối tháng đó của năm trước: 2025-02-28 thành 2024-02-29, 2024-02-29 thành 2023-02-28). `forms`: các mẫu chọn được của loại báo cáo. `lines` theo thứ tự của mẫu; `level` 0 là dòng tổng; `note` là cách lấy số liệu khi có; `current`, `previous` dạng chuỗi, làm tròn theo tiền tệ công ty, bỏ số 0 thừa.
- Cách tính: chỉ bút toán `posted` của công ty; tình hình tài chính lấy số dư đến hết ngày, số dư tài khoản loại 5 đến 9 cộng vào tài khoản của vai trò `retained_earnings`; kết quả kinh doanh lấy phát sinh trong khoảng ngày, không tính bút toán `closing` và bút toán có dòng trên tài khoản của vai trò `income_summary` hoặc tài khoản chi tiết của nó (kết chuyển thủ công qua 911). Chỉ tiêu lấy trực tiếp từ sổ làm tròn theo đơn vị tiền tệ công ty trước khi cộng vào chỉ tiêu tổng, nên tổng khớp các dòng (CHUC_NANG_74, CHUC_NANG_75).
- `format=xlsx` (`200`): `content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `content-disposition: attachment; filename="<form>-<to>.xlsx"`; thân là tệp nhị phân.
- `format=pdf` (`200`): `content-type: application/pdf`, `content-disposition: inline; filename="<form>-<to>.pdf"`; thân là tệp nhị phân.
- Lỗi: `400 VALIDATION_FAILED` tại `to` "Ngày kết thúc phải sau ngày bắt đầu."; tại `from` "Giá trị không hợp lệ." (kết quả kinh doanh thiếu từ ngày); tại `form` "Giá trị không hợp lệ." (mẫu không thuộc chế độ); tham số sai "Giá trị không hợp lệ." (thiếu `kind`, `to`: "Vui lòng nhập thông tin này."); `403`; `409 BUSINESS_RULE` "Công ty chưa khởi tạo kế toán.". Lỗi trả JSON như mục 1, kể cả khi có `format`.

## 3k. Hợp đồng chi tiết hóa đơn điện tử (MODULE_06 phần 4, CONG_VIEC_16)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_16); trường thừa bị từ chối. Tiền trả về dạng chuỗi, bỏ số 0 thừa. Ngày `YYYY-MM-DD`. `status` của hóa đơn: `pending` (Chờ gửi), `retrying` (Chờ gửi lại), `awaiting_code` (Chờ cấp mã), `issued` (Đã phát hành), `failed` (Lỗi), `rejected` (Bị từ chối), `setup_error` (Lỗi cài đặt). `kind`: `original`, `adjustment`, `replacement`.

### API_91 Hóa đơn điện tử
- `GET /finance/einvoices` (`200`), lược đồ `einvoiceListQuerySchema`: `status` (một trạng thái), `overdue` (`true`, `false`), `from`, `to` (ngày hóa đơn), `search` (tối đa 100 ký tự; tìm trong tên, mã số thuế người mua, số hóa đơn, số phiếu kho, không phân biệt hoa thường), `page` (từ 1, mặc định 1), `pageSize` (1 đến 100, mặc định 20). Trả `{ data: EinvoiceListItem[], page, pageSize, total }`, theo ngày hóa đơn giảm dần, rồi thời điểm lập giảm dần.
```json
{ "id": "…", "kind": "original", "invoiceDate": "2026-11-10", "series": "C26TAA", "invoiceNo": "1", "buyerName": "Khách công nợ",
  "totalAmount": "33000", "currency": "VND", "status": "issued", "overdue": false, "replaced": false, "sourceDocumentNo": "PXK…" }
```
- `overdue`: `status` khác `issued` và `dueDate` trước hôm nay (giờ Việt Nam). `replaced`: đã có hóa đơn thay thế.
- `GET /finance/einvoices/{id}` (`200`), `EinvoiceResponse`: các trường của `EinvoiceListItem` và `provider`, `templateCode`, `withTaxCode`, `taxAuthorityCode`, `referenceId`, `seller` (`{ name, taxCode, address }`), `buyer` (`{ partnerId, name, taxCode, address, anonymous }`), `netAmount`, `taxAmount`, `note`, `lastError` (khóa thông báo `einvoice…` hoặc câu chữ của nhà cung cấp), `dueDate`, `issuedAt`, `sourceDocumentId`, `related[]` (`{ id, kind, series, invoiceNo, invoiceDate, relation }`, `relation` là `original`, `replaced_by`, `adjusted_by`), `lines[]` (`{ lineNo, itemCode, itemName, unitName, quantity, unitPrice, vatRate, netAmount, taxAmount, totalAmount, isPromotion }`, `vatRate` là `0`, `5`, `8`, `10`, `exempt`, `not_declared`), `taxSummary[]` (`{ vatRate, netAmount, taxAmount }`), `attempts[]` (50 lần gần nhất: `{ operation, startedAt, finishedAt, outcome, errorCode, message }`), `hasPdf`, `hasXml`, `canManage`, `version`.
- `POST /finance/einvoices/{id}/resend` (`201`): `{ "version": 3 }`. Chỉ `failed`, `setup_error`, `retrying`, `rejected`; có lần gửi chưa xong bắt đầu chưa quá 10 phút thì `409 BUSINESS_RULE` `einvoiceSending`. Chuyển `pending`: hóa đơn đã có số hoặc lần gửi gần nhất `temporary_error`, `unknown` thì giữ nguyên nội dung; `rejected` thì cấp `referenceId` mới, xóa số, mã của cơ quan thuế, mã giao dịch, lấy lại cài đặt; còn lại lấy lại nhà cung cấp, ký hiệu của năm, loại, mẫu số, người bán theo cài đặt và công ty hiện tại. Gửi ngay (tra trạng thái trước nếu đã từng gửi) rồi trả `EinvoiceResponse`. Ghi nhật ký `einvoice.resend`.
- `GET /finance/einvoices/{id}/file/{format}` (`200`), `format` là `pdf` hoặc `xml` (khác thì `404`): PDF `content-type: application/pdf`, `content-disposition: inline; filename="<ký hiệu>-<số>.pdf"`; XML `application/xml`, `attachment; filename="<ký hiệu>-<số>.xml"`; thân là tệp nhị phân.
- `POST /finance/einvoices/{id}/replace` (`201`), lược đồ `replaceEinvoiceSchema`: `buyerName` (1 đến 300 ký tự), `buyerTaxCode` (10 chữ số hoặc `10 chữ số-3 chữ số`; chuỗi rỗng, `null` hoặc không gửi là không có), `buyerAddress` (tối đa 500, chuỗi rỗng là không có), `reason` (1 đến 500), `version`. Lập hóa đơn `replacement` ngày hôm nay, cùng dòng, `note` là lý do, `related_invoice_id` là hóa đơn bị thay thế; gửi ngay rồi trả `EinvoiceResponse` của hóa đơn mới. Hóa đơn bị thay thế chỉ có `replaced` `true` khi hóa đơn thay thế `issued`; đang có hóa đơn thay thế khác không ở `failed`, `rejected` thì `409 BUSINESS_RULE` `einvoiceReplacementPending`. Ghi nhật ký `einvoice.replace`.
- `GET /finance/einvoice-returns` (`200`), lược đồ `einvoiceReturnQuerySchema`: `status` (`open`, `adjusted`, `buyer_invoice`; không gửi là tất cả). Trả tối đa 500 việc, mới nhất trước, `EinvoiceReturnTask[]`:
```json
[ { "id": "…", "status": "open", "returnDocumentId": "…", "returnDocumentNo": "PNT…", "returnDate": "2026-11-10", "buyerName": "Khách công nợ", "buyerTaxCode": "0320001601",
    "returnAmount": "11000", "currency": "VND", "original": { "id": "…", "series": "C26TAC", "invoiceNo": "1", "invoiceDate": "2026-11-10", "status": "issued" },
    "adjustmentInvoiceId": null, "buyerInvoice": null, "canResolve": true, "version": 0 } ]
```
- `original` là hóa đơn gốc hiện hành (theo chuỗi thay thế). `canResolve`: việc `open`, hóa đơn gốc hiện hành `issued`, người gọi có `finance.einvoice.manage`.
- `POST /finance/einvoice-returns/{id}/adjust` (`201`): `{ "version": 0 }`. Lập hóa đơn `adjustment` ngày hôm nay, nguồn là phiếu nhận hàng trả lại, dòng, tổng ghi âm, `note` "Điều chỉnh giảm do trả lại hàng", tham chiếu hóa đơn gốc hiện hành; việc chuyển `adjusted`; gửi ngay rồi trả `EinvoiceResponse` của hóa đơn điều chỉnh. Ghi nhật ký `einvoice.adjust_return`.
- `POST /finance/einvoice-returns/{id}/buyer-invoice` (`201`), lược đồ `recordBuyerInvoiceSchema`: `series` (tối đa 20 ký tự, không bắt buộc), `invoiceNo` (1 đến 20), `invoiceDate`, `version`. Việc chuyển `buyer_invoice`; trả toàn bộ `EinvoiceReturnTask[]`. Ghi nhật ký `einvoice.buyer_return_invoice`.
- Lỗi: `400 VALIDATION_FAILED` tại trường ("Giá trị không hợp lệ.", "Vui lòng nhập thông tin này."); `403`; `404` (hóa đơn, việc của công ty khác; `format` sai); `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` với khóa thông báo: `einvoiceNotResendable` "Chỉ gửi lại được hóa đơn lỗi, lỗi cài đặt, đang chờ gửi lại hoặc bị từ chối.", `einvoiceSending` "Hóa đơn đang được gửi; thử lại sau ít phút.", `einvoiceNotConfigured` "Công ty chưa cài đặt hóa đơn điện tử.", `einvoiceSeriesMissing` "Chưa khai ký hiệu hóa đơn cho năm của hóa đơn.", `einvoiceFileUnavailable` "Chưa có tệp của hóa đơn này.", `einvoiceReturnResolved` "Việc trả hàng này đã được xử lý.", `einvoiceOriginalNotIssued` "Hóa đơn gốc chưa phát hành; chờ hóa đơn gốc phát hành rồi xử lý.", `einvoiceBuyerInvoiceNeedsTaxCode` "Chỉ ghi hóa đơn trả hàng của người mua là tổ chức có mã số thuế.", `einvoiceAdjustmentNotReplaceable` "Không thay thế hóa đơn điều chỉnh.", `einvoiceNotIssued` "Hóa đơn chưa phát hành.", `einvoiceAlreadyReplaced` "Hóa đơn đã bị thay thế; thay thế hóa đơn thay thế.", `einvoiceAlreadyAdjusted` "Hóa đơn đã có hóa đơn điều chỉnh; lần sau xử lý bằng điều chỉnh.", `einvoiceReplacementPending` "Hóa đơn đang có hóa đơn thay thế chưa phát hành.".

### API_92 Cài đặt hóa đơn điện tử
- `GET /finance/einvoice-settings` (`200`), `EinvoiceSettingsResponse`:
```json
{ "enabled": true, "startDate": "2026-01-01", "provider": "misa", "environment": "test", "withTaxCode": true, "templateCode": "1",
  "appId": "APP-1", "taxCode": "0312345678", "username": "ketoan", "passwordLastFour": "isa9", "simulation": "normal",
  "series": [ { "year": 2026, "series": "C26TMS" } ], "simulatorAllowed": true, "canSetup": true, "version": 3 }
```
- Chưa lưu cài đặt: `enabled` `false`, `provider` `simulator` (môi trường thật: `misa`), `environment` `test`, `withTaxCode` `true`, `templateCode` `1`, `simulation` `normal`, `version` `0`. Mật khẩu không trả về; `passwordLastFour` là 4 ký tự cuối, chỉ trả cho người có `finance.einvoice.setup` (người chỉ có `finance.einvoice.view` nhận `null`). `simulatorAllowed` `false` khi `NODE_ENV=production`.
- `PUT /finance/einvoice-settings` (`200`), lược đồ `updateEinvoiceSettingsSchema`: `enabled`, `startDate` (ngày hoặc `null`), `provider` (`simulator`, `misa`), `environment` (`test`, `production`), `withTaxCode`, `templateCode` (`1`, `2`), `appId` (tối đa 100), `taxCode` (tối đa 20), `username` (tối đa 100) (chuỗi rỗng là `null`), `password` (tối đa 200, không gửi hoặc rỗng là giữ mật khẩu cũ), `simulation` (mặc định `normal`), `series` (tối đa 20 dòng `{ year: 2000–2099, series }`, ký hiệu được cắt khoảng trắng, đổi chữ in hoa, khớp `^[CK][0-9]{2}T[A-Z]{2}$`; mặc định rỗng), `version`. Phía máy chủ: `400 VALIDATION_FAILED` tại `provider` (`einvoiceSimulatorNotAllowed`), `startDate` (`required` khi bật), `series.<i>.year` (`einvoiceSeriesDuplicate`), `series.<i>.series` (`einvoiceSeriesYear`, `einvoiceSeriesKind`), `series` (`einvoiceSeriesMissingStart`), `appId`, `taxCode`, `username`, `password` (`required` khi chọn `misa`, mật khẩu chỉ khi chưa lưu). Lưu xong thay toàn bộ ký hiệu, chuyển hóa đơn `setup_error` chưa có ký hiệu mà năm đã có ký hiệu sang `pending`; trả `EinvoiceSettingsResponse`. Ghi nhật ký `einvoice_settings.update` (mật khẩu che, chỉ ghi `passwordChanged`).
- `POST /finance/einvoice-settings/test` (`201`): kiểm tra theo cài đặt đã lưu; `{ "ok": true, "message": null }` hoặc `{ "ok": false, "message": "einvoiceProviderAuthentication" }` (khóa thông báo hoặc mã lỗi của nhà cung cấp). Ghi nhật ký `einvoice_settings.test`.
- Lỗi: `400 VALIDATION_FAILED`; `403`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` `einvoiceNotConfigured` "Công ty chưa cài đặt hóa đơn điện tử.", `einvoiceProviderNotAvailable` "Nhà cung cấp hóa đơn điện tử chưa sẵn sàng hoặc đã đổi trong cài đặt." (kiểm tra kết nối).

## 3l. Hợp đồng chi tiết hoa hồng đội kinh doanh (MODULE_06 phần 5, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); giữ để tra cứu.

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_17); trường thừa bị từ chối. Tiền, phần trăm, hệ số trả về dạng chuỗi, bỏ số 0 thừa. Ngày `YYYY-MM-DD`, tháng `YYYY-MM`. `status` của bảng: `draft` (Nháp), `pending` (Chờ duyệt), `posted` (Đã ghi sổ), `rejected` (Bị từ chối), `withdrawn` (Đã rút).

### API_93 Cài đặt hoa hồng, chỉ tiêu
- Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).
- `GET /finance/commission-settings` (`200`), `CommissionSettingsResponse`:
```json
{ "enabled": true, "startDate": "2026-01-01", "assignment": "order_creator", "combination": "matrix", "defaultPercent": "2",
  "tiers": [ { "fromPercent": "0", "multiplier": "0.5" }, { "fromPercent": "100", "multiplier": "1.2" } ],
  "rates": [ { "categoryId": "…", "channelId": "…", "percent": "3" }, { "categoryId": "…", "channelId": null, "percent": "5" } ],
  "channelFactors": [ { "channelId": "…", "factor": "0.5" } ],
  "categories": [ { "id": "…", "parentId": null, "code": "HHT", "name": "HHT" } ], "channels": [ { "id": "…", "code": "BAN_LE", "name": "Bán lẻ" } ],
  "canSetup": true, "version": 3 }
```
- Chưa lưu cài đặt: `enabled` `false`, `startDate` `null`, `assignment` `customer_owner`, `combination` `matrix`, `defaultPercent` `0`, `tiers` một bậc từ `0` hệ số `1`, `version` `0`. `categories`: ngành hàng đang dùng (dùng chung tập đoàn) theo mã; `channels`: kênh đang dùng của công ty theo mã.
- `PUT /finance/commission-settings` (`200`), lược đồ `updateCommissionSettingsSchema`: `enabled`, `startDate` (ngày hoặc `null`), `assignment` (`customer_owner`, `order_creator`), `combination` (`matrix`, `channel_factor`), `defaultPercent` (chuỗi 0 đến 100, tối đa 3 chữ số phần nguyên, 4 chữ số lẻ), `tiers` (1 đến 20 dòng `{ fromPercent, multiplier }`: `fromPercent` tối đa 4 chữ số phần nguyên, 2 chữ số lẻ; `multiplier` 0 đến 10, tối đa 4 chữ số lẻ), `rates` (tối đa 2.000 dòng `{ categoryId, channelId (UUID hoặc null), percent }`, mặc định rỗng), `channelFactors` (tối đa 200 dòng `{ channelId, factor }`, mặc định rỗng), `version`. Phía máy chủ: `400 VALIDATION_FAILED` tại `startDate` (`required` khi bật), `tiers` (`commissionTierStart` khi bậc nhỏ nhất khác 0, `commissionTierDuplicate`), `rates.<i>.categoryId` (`commissionRateDuplicate` khi trùng ngành hàng và kênh; `invalidValue` khi ngành hàng không tồn tại), `rates.<i>.channelId`, `channelFactors.<i>.channelId` (`invalidValue` khi kênh không thuộc công ty). Bậc lưu theo thứ tự tăng dần. Lưu xong thay toàn bộ mức, hệ số kênh; trả `CommissionSettingsResponse`. Ghi nhật ký `commission_settings.update`.
- `GET /finance/commission-targets?month=2026-09` (`200`), lược đồ `commissionTargetsQuerySchema` (`month` bắt buộc): `{ "month": "2026-09", "staff": [ { "userId": "…", "fullName": "…", "amount": "100000" } ], "canSetup": true }`; `staff` là nhân viên đang làm việc của công ty theo họ tên, `amount` `null` khi không có chỉ tiêu. Quyền như xem cài đặt.
- `PUT /finance/commission-targets` (`200`), lược đồ `saveCommissionTargetsSchema`: `month`, `targets` (tối đa 500 dòng `{ userId, amount }`; `amount` tối đa 16 chữ số phần nguyên, 4 chữ số lẻ, `null` là xóa chỉ tiêu). Phía máy chủ: `400` tại `targets.<i>.userId` (không phải thành viên đang làm việc của công ty), `targets.<i>.amount` (không lớn hơn 0). Trả `CommissionTargetsResponse`. Ghi nhật ký `commission_targets.update`.
- Lỗi: `400 VALIDATION_FAILED` tại trường ("Vui lòng nhập thông tin này.", "Giá trị không hợp lệ.", "Bậc đầu tiên phải bắt đầu từ 0%.", "Hai bậc trùng phần trăm bắt đầu.", "Ngành hàng và kênh này đã có mức."); `403`; `409 CONFLICT_VERSION` (cài đặt).

### API_94 Phát sinh, bảng hoa hồng
- Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).
- `GET /finance/commissions/events` (`200`), lược đồ `commissionEventsQuerySchema`: `userId`, `from`, `to` (ngày phát sinh), `page` (từ 1, mặc định 1), `pageSize` (1 đến 100, mặc định 50). Trả `{ data: CommissionEventItem[], page, pageSize, total }`, theo ngày phát sinh giảm dần, rồi thời điểm ghi giảm dần:
```json
{ "id": "…", "eventDate": "2026-11-10", "userId": "…", "userName": "…", "sourceType": "receipt", "sourceNo": "PT…", "orderId": "…", "orderNo": "DBH…",
  "itemName": "Hàng công nợ A", "baseAmount": "20000", "percent": "3", "amount": "600", "statementNo": null }
```
- `sourceType`: `receipt` (thu tiền), `refund` (hoàn tiền trả hàng), `retail_delivery`, `retail_return` (đơn không có khách). `sourceNo`: số phiếu thu chi với `receipt`, `refund`; số phiếu kho với bán lẻ. `baseAmount`, `amount` âm với hoàn tiền, trả hàng. `statementNo`: số bảng hoa hồng chứa phát sinh, `null` khi chưa vào bảng hoặc bảng chưa có số.
- `GET /finance/commissions/statements` (`200`), `CommissionStatementsResponse`:
```json
{ "statements": [ { "id": "…", "month": "2026-09", "documentNo": "HH…", "status": "posted", "totalAmount": "1500", "postError": null } ],
  "nextMonth": "2026-10", "canCreate": true, "canManage": true, "currency": "VND" }
```
- `statements`: 120 bảng mới nhất theo tháng giảm dần. `nextMonth`: tháng lập được (QUYTAC_NGHIEPVU_111), `null` khi đang có bảng `draft`, `pending` hoặc không có tháng đã kết thúc có phát sinh chưa vào bảng. `canCreate`: có `finance.commission.manage`, không có bảng `draft`, `pending`, có `nextMonth`. `postError`: khóa thông báo khi duyệt xong không ghi sổ được.
- `POST /finance/commissions/statements` (`201`), lược đồ `createCommissionStatementSchema`: `{ "month": "2026-09" }`. Khóa cài đặt của công ty; gắn phát sinh chưa vào bảng có ngày đến hết tháng; tính dòng theo nhân viên; trả `CommissionStatementResponse` của bảng `draft`. Ghi nhật ký `commission_statement.create`.
- `GET /finance/commissions/statements/{id}` (`200`), `CommissionStatementResponse`: các trường của dòng danh sách và `lines[]` (`{ userId, fullName, baseAmount, commissionBefore, targetAmount, achievedPercent, multiplier, amount }`, `targetAmount`, `achievedPercent` `null` khi không có chỉ tiêu; theo họ tên), `eventCount`, `currency`, `canManage`, `canWithdraw` (bảng `pending` có yêu cầu duyệt, người gọi là người lập), `version`.
- `POST /finance/commissions/statements/{id}/submit` (`201`): `{ "version": 0 }`. Tạo dãy số `HH` nếu công ty chưa có (đặt lại theo năm, 6 chữ số); cấp số; tạo yêu cầu duyệt loại `finance.commission` (giá trị là trị tuyệt đối của `totalAmount`, tiền tệ công ty, ngày chứng từ là ngày cuối tháng); chuyển `pending`. Chưa có chính sách duyệt thì ghi sổ ngay, trả `posted`. Ghi sổ: công ty đã khởi tạo kế toán thì lập bút toán `commission` (QUYTAC_NGHIEPVU_112). Ghi nhật ký `commission_statement.submit`.
- `POST /finance/commissions/statements/{id}/withdraw` (`201`): không có thân. Chỉ người lập, bảng `pending` có yêu cầu duyệt (khác thì `403`); rút yêu cầu duyệt, chuyển `withdrawn`, trả phát sinh về chưa vào bảng; trả `CommissionStatementResponse`. Ghi nhật ký `commission_statement.withdraw`.
- `DELETE /finance/commissions/statements/{id}` (`200`): chỉ bảng `draft` của công ty (khác hoặc không tồn tại thì `409 BUSINESS_RULE` `documentNotDraft`); xóa bảng, dòng; phát sinh trả về chưa vào bảng; trả `CommissionStatementsResponse`. Ghi nhật ký `commission_statement.discard`.
- Duyệt xong (nghe `core.approval.completed`): ghi sổ, chuyển `posted`; lỗi quy tắc khi ghi sổ thì `rejected` kèm `postError`, trả phát sinh. Từ chối, rút: `rejected`, `withdrawn`, trả phát sinh.
- Lỗi: `400 VALIDATION_FAILED` (`month` sai định dạng, `version`, bộ lọc); `403`; `404` (bảng của công ty khác, không tồn tại; trừ `DELETE`); `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` với khóa thông báo: `commissionStatementOpen` "Đang có bảng hoa hồng nháp hoặc chờ duyệt; xử lý bảng đó trước.", `commissionMonthNotNext` "Chỉ lập được bảng của tháng tiếp theo đã kết thúc.", `documentNotDraft` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (gửi, bỏ bảng không phải nháp), `postingRuleMissing` "Chưa có định khoản cho chi phí hoa hồng hoặc phải trả người lao động; kế toán trưởng khai ở Hệ thống tài khoản."; lỗi luồng duyệt như chứng từ khác.

## 3m. Hợp đồng chi tiết đối soát ngân hàng (MODULE_06 phần 6, CONG_VIEC_18)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_18); trường thừa bị từ chối. Tiền trả về dạng chuỗi, bỏ số 0 thừa. Ngày `YYYY-MM-DD`; thời điểm ISO 8601. `status` của giao dịch: `unmatched` (Chưa ghép), `matched` (Đã ghép), `ignored` (Bỏ qua). `direction`: `in` (Tiền vào), `out` (Tiền ra).

### API_95 đến API_97 Kết nối ngân hàng
- `GET /finance/bank-connections` (`200`), `BankConnectionsResponse`:
```json
{ "funds": [ { "fundId": "…", "fundCode": "VCB", "fundName": "Vietcombank", "bankName": "Vietcombank", "accountNo": "0071 000 123 456",
    "connection": { "id": "…", "provider": "sepay", "enabled": true, "secretHint": "Ab3x", "webhookPath": "/api/v1/public/bank-webhooks/…", "lastReceivedAt": null, "version": 0 } } ],
  "canSetup": true, "simulatorAllowed": true }
```
- `funds`: quỹ ngân hàng đang dùng của công ty và quỹ ngừng dùng đã có kết nối, theo mã quỹ; `connection` `null` khi chưa kết nối. Không bao giờ trả khóa.
- `PUT /finance/bank-connections/{fundId}` (`200`), lược đồ `saveBankConnectionSchema`: `{ "provider": "sepay", "enabled": true, "rotateSecret": false, "version": null }`; `version` `null` khi tạo, số khi sửa. Tạo: quỹ ngân hàng của công ty (khác thì `404`), đang dùng; sinh khóa. Sửa: so `version`; `rotateSecret` `true` thì sinh khóa mới. Trả `{ "item": BankConnectionItem, "secret": "…" }`; `secret` chỉ có khi tạo hoặc đổi khóa, khác thì `null`. Ghi nhật ký `bank_connection.create` hoặc `bank_connection.update` (dịch vụ, bật tắt, `secretChanged`; không ghi khóa).
- `POST /finance/bank-connections/{fundId}/simulate` (`201`), lược đồ `simulateBankTransactionSchema`: `{ "direction": "in", "amount": "270000", "content": "DBH thu thu", "transactionDate": "2026-11-10" }` (`amount` lớn hơn 0, tối đa 16 chữ số phần nguyên, 4 chữ số lẻ; `content` tối đa 500 ký tự, mặc định rỗng; `transactionDate` trống là hôm nay). Chỉ ngoài môi trường thật, quỹ có kết nối bộ giả lập. Lưu như webhook (mã `SIM-…`, mã tham chiếu `SIM…`, không có số dư; giờ giao dịch là giờ hiện tại theo giờ Việt Nam), tự ghép, gợi ý; trả `BankTransactionItem`.
- Lỗi: `400 VALIDATION_FAILED`; `403`; `404`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` với khóa thông báo: `bankFundInactive` "Quỹ đã ngừng dùng, không tạo được kết nối.", `bankSimulatorNotAllowed` "Không dùng được bộ giả lập trên môi trường thật.", `bankSimulatorNotConnected` "Quỹ chưa kết nối bộ giả lập.".

### API_98 Webhook nhận giao dịch
- `POST /public/bank-webhooks/{connectionId}` (`200`), tiêu đề `Authorization: Apikey <khóa>` (kiểu chứng thực API Key của SePay). Thân theo định dạng SePay (https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook):
```json
{ "id": 92704, "gateway": "Vietcombank", "transactionDate": "2026-11-10 10:15:00", "accountNumber": "0071000123456", "code": null,
  "content": "CK THANH TOAN DBHVCR2026009001", "transferType": "in", "transferAmount": 410000, "accumulated": 50000000,
  "subAccount": null, "referenceCode": "FT26314…", "description": "" }
```
- Kiểm tra: `id` số nguyên hoặc chuỗi 1 đến 100 ký tự; `transactionDate` dạng `YYYY-MM-DD HH:mm:ss`, hiểu theo giờ Việt Nam; `transferType` `in`, `out`; `transferAmount` số hoặc chuỗi số lớn hơn 0, viết ra dạng thập phân tối đa 16 chữ số phần nguyên, 4 chữ số lẻ (số như `0.00001`, `1e16` bị từ chối); `accumulated` như trên, được âm, có thể trống; `content` tối đa 1.000 ký tự (trống thì lấy `description`, tối đa 2.000 ký tự); `referenceCode` tối đa 100 ký tự; `accountNumber` tối đa 50 ký tự; ký tự rỗng (`\u0000`) trong các trường chữ và trong dữ liệu gốc bị bỏ. Trường khác được bỏ qua.
- Xử lý: kết nối không có, đang tắt hoặc khóa sai trả `401 UNAUTHENTICATED` `bankWebhookUnauthorized` "Khóa xác thực webhook không đúng hoặc kết nối đã tắt."; dữ liệu sai `400 VALIDATION_FAILED` `bankWebhookInvalid` "Dữ liệu giao dịch ngân hàng không hợp lệ."; `accountNumber` có và khác số tài khoản của quỹ (so phần chữ số) `409 BUSINESS_RULE` `bankAccountMismatch` "Số tài khoản trong giao dịch khác số tài khoản của quỹ.". Hợp lệ: lưu giao dịch và thân gốc (trùng `id` trên cùng kết nối thì không lưu lại), cập nhật lần nhận cuối, tự ghép, gợi ý khách; trả `{ "success": true }`.
- Giới hạn tần suất: yêu cầu đúng khóa không bị giới hạn. Lần sai khóa (kể cả kết nối không có, đang tắt) đếm theo địa chỉ IP, chung cho mọi kết nối; quá 20 lần mỗi phút trả `429 RATE_LIMITED` kèm `retryAfterSeconds` thay cho `401`.

### API_99 Danh sách giao dịch ngân hàng
- `GET /finance/bank-transactions` (`200`), lược đồ `bankTransactionListQuerySchema`: `fundId`, `status`, `direction`, `from`, `to` (ngày giao dịch), `search` (tối đa 100 ký tự; tìm trong nội dung, mã tham chiếu, số tiền), `page` (từ 1, mặc định 1), `pageSize` (1 đến 100, mặc định 20). Trả `{ data: BankTransactionItem[], page, pageSize, total, canManage, currency }`, theo thời điểm giao dịch giảm dần:
```json
{ "id": "…", "fundId": "…", "fundName": "Vietcombank", "transactionAt": "2026-11-10T03:15:00.000Z", "transactionDate": "2026-11-10", "direction": "in", "amount": "700000",
  "content": "Chuyen tien 3", "referenceCode": "FT3", "balanceAfter": "50000000", "status": "matched",
  "payment": { "id": "…", "documentNo": "PT…", "kind": "customer_receipt", "partnerName": "Khách ngân hàng", "paymentDate": "2026-11-07" }, "autoMatched": true,
  "suggestion": null, "receipt": null, "ignoreReason": null, "version": 1 }
```
- `autoMatched`: đã ghép và người ghép trống. `suggestion`: `{ partnerId, partnerName, reason }` (`sales_order`, `partner_code`, `tax_code`). `receipt`: phiếu thu lập từ gợi ý chưa ghép (`{ id, documentNo, status }`). `canManage`: có `finance.bank.manage`.

### API_100 Xử lý giao dịch chưa ghép
- `GET /finance/bank-transactions/{id}/candidates` (`200`): tối đa 20 phiếu `BankPaymentCandidate` (`{ id, documentNo, kind, partnerName, paymentDate, amount, note }`) đã ghi sổ, cùng quỹ, cùng chiều, cùng số tiền, chưa ghép giao dịch nào; ngày gần ngày giao dịch trước, rồi ngày mới trước.
- `POST /finance/bank-transactions/{id}/confirm-receipt` (`201`), lược đồ `confirmBankReceiptSchema`: `{ "partnerId": "…", "version": 0 }`. Giao dịch phải `unmatched`, `in`, chưa có phiếu thu lập từ gợi ý ở trạng thái chờ duyệt hoặc đã ghi sổ. Lập phiếu thu `customer_receipt` (quỹ, ngày, số tiền của giao dịch; ghi chú là nội dung, tối đa 500 ký tự) ; còn phiếu nháp của lần trước thì đặt lại phiếu nháp theo giao dịch và `partnerId` vừa gửi. Lần xác nhận song song không gắn được phiếu (giao dịch đã đổi `version`) thì xóa phiếu nháp vừa lập, trả `409 CONFLICT_VERSION`. Gửi theo luồng duyệt phiếu thu; phiếu ghi sổ thì giao dịch `matched` nếu phiếu còn khớp quỹ, số tiền, loại, ngày lệch tối đa 3 ngày (không khớp thì bỏ liên kết). Cần thêm `finance.payment.manage`. Ghi nhật ký `bank_transaction.confirm_receipt`. Trả `BankTransactionItem`.
- `POST /finance/bank-transactions/{id}/match` (`201`), lược đồ `matchBankTransactionSchema`: `{ "paymentId": "…", "version": 0 }`. Giao dịch `unmatched`; phiếu thuộc công ty, đã ghi sổ, cùng quỹ, cùng chiều, cùng số tiền, chưa ghép. Ghi nhật ký `bank_transaction.match`.
- `POST /finance/bank-transactions/{id}/ignore` (`201`), lược đồ `ignoreBankTransactionSchema`: `{ "reason": "Chuyển khoản nội bộ", "version": 0 }` (`reason` 1 đến 500 ký tự sau khi bỏ khoảng trắng). Giao dịch `unmatched`, không có phiếu thu lập từ gợi ý đang chờ duyệt. Ghi nhật ký `bank_transaction.ignore`.
- `POST /finance/bank-transactions/{id}/reopen` (`201`), lược đồ `bankVersionSchema`: `{ "version": 2 }`. Giao dịch `matched` hoặc `ignored` về `unmatched`; bỏ phiếu đã ghép, lý do; phiếu không đổi. Ghi nhật ký `bank_transaction.reopen` (trạng thái, phiếu trước đó).
- Lỗi: `400 VALIDATION_FAILED` (`reason` trống, mã không phải UUID); `403`; `404` (giao dịch công ty khác, không tồn tại); `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` với khóa thông báo: `bankTransactionNotOpen` "Giao dịch không còn ở trạng thái chưa ghép.", `bankTransactionAlreadyOpen` "Giao dịch đang ở trạng thái chưa ghép.", `bankReceiptOnlyIncoming` "Chỉ lập phiếu thu cho tiền vào.", `bankReceiptPending` "Giao dịch đã có phiếu thu đang chờ duyệt hoặc đã ghi sổ.", `bankPaymentNotMatchable` "Phiếu không ghép được: phải đã ghi sổ, cùng quỹ, cùng chiều tiền, cùng số tiền và chưa ghép giao dịch khác."; lỗi của API_86 khi lập, gửi phiếu thu.

### API_101 Đối chiếu quỹ ngân hàng
- `GET /finance/bank-reconciliation?fundId=&from=&to=` (`200`), lược đồ `bankReconciliationQuerySchema` (cả ba bắt buộc), `BankReconciliationResponse`:
```json
{ "fundId": "…", "from": "2026-10-31", "to": "2026-11-10", "bookBalance": "1230000", "bankBalance": "50000000", "bankBalanceAt": "2026-11-10T03:15:00.000Z",
  "difference": "48770000", "unmatchedIn": { "count": 5, "amount": "2150000" }, "unmatchedOut": { "count": 2, "amount": "710000" }, "ignoredCount": 1,
  "unmatchedPayments": [ { "id": "…", "documentNo": "PT…", "kind": "customer_receipt", "partnerName": "Khách ngân hàng", "paymentDate": "2026-11-06", "amount": "280000", "note": null } ],
  "unmatchedPaymentCount": 1, "currency": "VND" }
```
- `bookBalance`: số dư đầu của quỹ cộng phiếu đã ghi sổ đến hết `to`. `bankBalance`, `bankBalanceAt`: số dư sau giao dịch của giao dịch gần nhất có số dư, ngày không sau `to`; `null` khi không có. `difference` = `bankBalance` − `bookBalance`, `null` khi không có số dư ngân hàng. `unmatchedIn`, `unmatchedOut`, `ignoredCount`: giao dịch trong khoảng ngày. `unmatchedPayments`: tối đa 100 phiếu đã ghi sổ của quỹ trong khoảng ngày chưa ghép giao dịch, theo ngày, số phiếu; `unmatchedPaymentCount`: tổng số.
- Lỗi: `400 VALIDATION_FAILED` (`from` sau `to`: tại `from`); `403`; `404` (quỹ không phải quỹ ngân hàng của công ty).

## 3n. Hợp đồng chi tiết đối soát thu hộ (MODULE_06 phần 7, CONG_VIEC_19)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_19); trường thừa bị từ chối. Tiền trả về dạng chuỗi, bỏ số 0 thừa. Ngày `YYYY-MM-DD`. `status` của bảng: `draft` (Nháp), `pending` (Chờ duyệt), `posted` (Đã ghi sổ), `rejected` (Bị từ chối), `withdrawn` (Đã rút). `kind` của đơn vị: `cod` (Thu COD), `gateway` (Cổng thanh toán).

### API_102 Đơn vị thu hộ
- `GET /finance/collectors` (`200`), `CollectorsResponse`:
```json
{ "collectors": [ { "id": "…", "partnerId": "…", "partnerCode": "KH…", "partnerName": "Giao hàng nhanh thử", "kind": "cod", "status": "active", "version": 0 } ],
  "canSetup": false, "canManage": true }
```
- `collectors`: đơn vị của công ty, đang dùng trước, theo tên đối tác. `canSetup`: có `finance.collection.setup`; `canManage`: có `finance.collection.manage`.
- `POST /finance/collectors` (`201`), `PUT /finance/collectors/{id}` (`200`), lược đồ `saveCollectorSchema`: `{ "partnerId": "…", "kind": "cod", "status": "active", "version": null }` (`status` mặc định `active`; `version` `null` khi thêm, số khi sửa). Thêm: đối tác có hồ sơ khách hàng đang dùng của công ty, chưa là đơn vị thu hộ. Sửa: `partnerId` phải là đối tác của đơn vị, so `version` (sai thì `409 CONFLICT_VERSION`). Trả `CollectorItem`. Ghi nhật ký `collector.create` hoặc `collector.update`.
- Lỗi: `400 VALIDATION_FAILED` tại `partnerId`: `partnerNotCustomer` "Đối tác không phải khách hàng của công ty.", `customerNotActive` "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty.", `collectorDuplicate` "Đối tác đã là đơn vị thu hộ."; `403`; `409 CONFLICT_VERSION`.

### API_103 Danh sách, nhập bảng đối soát
- `GET /finance/collection-statements` (`200`), lược đồ `collectionStatementListQuerySchema`: `collectorId`, `status`, `from`, `to` (ngày bảng), `page` (từ 1, mặc định 1), `pageSize` (1 đến 100, mặc định 20). Trả `{ data: CollectionStatementListItem[], page, pageSize, total, canManage, currency }`, theo ngày bảng giảm dần, rồi thời điểm lập giảm dần:
```json
{ "id": "…", "collectorName": "Giao hàng nhanh thử", "collectorKind": "cod", "statementNo": "GHN-2026-11-01", "documentNo": "DST…", "statementDate": "2026-11-10",
  "status": "posted", "totalCollected": "165000", "totalFee": "33000", "netAmount": "132000", "lineCount": 2, "errorCount": 0, "postError": null }
```
- `netAmount` = `totalCollected` − `totalFee` (có thể âm). `errorCount`: số dòng lỗi (bảng `posted` là 0). `postError`: khóa thông báo khi duyệt xong không ghi sổ được.
- `POST /finance/collection-statements` (`201`), multipart, lược đồ `importCollectionStatementSchema` cho các trường: `collectorId` (UUID), `statementNo` (1 đến 100 ký tự sau khi bỏ khoảng trắng), `statementDate` (`YYYY-MM-DD`), `statementId`, `version` (nhập lại); tệp ở trường `file` (một tệp). Tệp lớn hơn 5 MB: `fileTooLarge`; lớn hơn 10 MB bị bộ nhận tệp từ chối trước khi đọc. Đọc trang đầu (chỉ giá trị ô), kiểm tiêu đề, từng ô (QUYTAC_NGHIEPVU_118); đơn vị phải đang dùng; số bảng không trùng bảng khác (trừ `rejected`, `withdrawn`) của cùng đơn vị. Không có `statementId`: tạo bảng `draft`. Có `statementId`: bảng `draft`, `rejected` hoặc `withdrawn` của công ty, đúng `version` (khác thì `409 CONFLICT_VERSION`); cập nhật đơn vị, số bảng, ngày; thay toàn bộ dòng. Khóa theo đơn vị thu hộ; nhập lại xóa `postError`. Ghép đơn theo QUYTAC_NGHIEPVU_119; tính tổng. Ghi nhật ký `collection_statement.import` hoặc `collection_statement.reimport`. Trả `CollectionStatementResponse`.
- Lỗi: `400 VALIDATION_FAILED` với `fields`: `file` (`required`, `fileTooLarge` "Tệp vượt quá 5 MB.", `fileInvalidTemplate` "Tệp không đúng mẫu." (sai tiêu đề hoặc không đọc được), `fileEmpty` "Tệp không có dòng dữ liệu.", `collectionTooManyRows` "Tệp vượt quá 5.000 dòng."); `rows.<dòng>.<cột>` với cột `reference`, `orderNo`, `collected`, `fee`, `collectedDate` (`required` hoặc `invalidValue`); `collectorId` `invalidValue` (đơn vị không có hoặc ngừng dùng); `statementNo` `collectionStatementDuplicate` "Số bảng đối soát đã có với đơn vị thu hộ này."; `403`; `409 CONFLICT_VERSION`.

### API_104 Chi tiết, bỏ dòng, bỏ bảng nháp, gửi, rút
- `GET /finance/collection-statements/{id}` (`200`), `CollectionStatementResponse`: các trường của dòng danh sách và `collectorId`, `partnerId` (đối tác của đơn vị), `lines[]`, `warningCount`, `canManage`, `canWithdraw` (có `finance.collection.manage`, bảng `pending` có yêu cầu duyệt, người gọi là người gửi lần gần nhất), `currency`, `version`. Dòng, theo thứ tự trong tệp:
```json
{ "id": "…", "lineNo": 3, "reference": "V2", "orderNo": "DBH-VCR-2026-000002", "orderId": "…", "customerName": "Khách công nợ", "collectedAmount": "50000", "feeAmount": "16500",
  "collectedDate": null, "orderOpenAmount": "55000", "error": null, "amountDiffers": true }
```
- `orderId` `null`: không tìm thấy đơn. `customerName` `null`: đơn không có khách hoặc không tìm thấy đơn. `orderOpenAmount`: số khách còn nợ hiện tại trên các phiếu xuất giao hàng của đơn; `null` khi bảng `posted` hoặc dòng không có khách. `error`: `order_not_found`, `order_cancelled`, `duplicate_reference`, `reference_used` (mã có trong bảng `pending`, `posted` khác của cùng đơn vị) hoặc `null` (bảng `posted` luôn `null`). `amountDiffers`: dòng có khách, không lỗi, tiền thu hộ khác `orderOpenAmount`. `warningCount`: số dòng `amountDiffers`.
- `DELETE /finance/collection-statements/{id}/lines/{lineId}?version=` (`200`): bảng `draft`, `rejected` hoặc `withdrawn`, đúng `version` (khác thì `409 CONFLICT_VERSION`); dòng của bảng (không có thì `404`); không bỏ được dòng cuối. Tính lại tổng. Ghi nhật ký `collection_statement.remove_line`. Trả `CollectionStatementResponse`.
- `POST /finance/collection-statements/{id}/discard` (`204`): `{ "version": 0 }`. Chỉ bảng `draft` chưa có `documentNo` của công ty, đúng `version` (khác, không tồn tại thì `409 CONFLICT_VERSION`); xóa bảng, dòng. Ghi nhật ký `collection_statement.discard`.
- `POST /finance/collection-statements/{id}/submit` (`201`): `{ "version": 0 }`. Khóa theo đơn vị thu hộ, khóa bảng; so `version`; bảng phải `draft`, `rejected` hoặc `withdrawn`; không còn dòng lỗi. Tạo dãy số `DST` nếu công ty chưa có; cấp số lần đầu (gửi lại giữ số); tạo yêu cầu duyệt loại `finance.collection_statement` (giá trị là `totalCollected`, tiền tệ công ty, ngày chứng từ là ngày bảng); chuyển `pending`, ghi người gửi, xóa `postError`. Chưa có chính sách duyệt thì ghi sổ ngay, trả `posted`. Ghi sổ theo QUYTAC_NGHIEPVU_120, QUYTAC_NGHIEPVU_121. Ghi nhật ký `collection_statement.submit` (số, mã yêu cầu duyệt).
- `POST /finance/collection-statements/{id}/withdraw` (`201`): không có thân. Chỉ người gửi lần gần nhất (`submitted_by`), bảng `pending` có yêu cầu duyệt (khác thì `403`); rút yêu cầu duyệt, chuyển `withdrawn`. Ghi nhật ký `collection_statement.withdraw`. Trả `CollectionStatementResponse`.
- Duyệt xong (nghe `core.approval.completed` loại `finance.collection_statement`): ghi sổ, chuyển `posted`; lỗi quy tắc khi ghi sổ (dòng lỗi, kỳ đã khóa, thiếu định khoản) thì `rejected` kèm `postError`. Từ chối, rút: `rejected`, `withdrawn`.
- Lỗi: `400 VALIDATION_FAILED` (`version`, mã không phải UUID); `403`; `404` (bảng công ty khác, không tồn tại); `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` với khóa thông báo: `collectionLastLine` "Không bỏ được dòng cuối; hãy bỏ bảng nháp hoặc nhập lại tệp.", `collectionStatementHasErrors` "Bảng đối soát còn dòng lỗi; bỏ dòng hoặc nhập lại tệp.", `documentNotDraft` "Chỉ sửa được chứng từ đang ở trạng thái nháp." (gửi bảng không sửa được), `periodLocked` "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.", `collectionPostingRuleMissing` "Chưa khai định khoản phải thu đơn vị thu hộ, phí thu hộ hoặc phải thu khách hàng (Hệ thống tài khoản)."; lỗi của luồng duyệt.

### API_105 Tệp mẫu
- `GET /finance/collection-statements/template` (`200`): tệp `.xlsx` (`content-type` `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, tên `mau-doi-soat-thu-ho.xlsx`), trang "Đối soát": dòng tiêu đề (chữ đậm) "Mã vận đơn hoặc mã giao dịch", "Số đơn bán", "Tiền thu hộ", "Phí", "Ngày thu" và hai dòng ví dụ.

## 3o. Hợp đồng chi tiết báo cáo tài chính hợp nhất (MODULE_06 phần 8, CONG_VIEC_20)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_20); trường thừa bị từ chối. Tiền trả về dạng chuỗi, bỏ số 0 thừa; số báo cáo làm tròn theo số lẻ tiền tệ của công ty gốc. Ngày `YYYY-MM-DD`. `status` của bảng: `draft` (Nháp), `pending` (Chờ duyệt), `posted` (đã chốt số, nhãn "Đã ghi sổ"), `rejected` (Bị từ chối), `withdrawn` (Đã rút). `kind` của bút toán: `intercompany_balance` (Công nợ nội bộ; gồm cả bút toán "Loại trừ trả trước nội bộ"), `internal_sales` (Doanh thu, giá vốn nội bộ), `unrealized_profit` (Lãi chưa thực hiện, chỉ trả về, không lưu), `manual` (Điều chỉnh tay).

### API_106 Phạm vi, xem nhanh cộng gộp, danh sách, lập bảng
- `GET /finance/consolidation/scope` (`200`), `ConsolidationScopeResponse`:
```json
{ "group": { "id": "…", "name": "VComm" }, "currency": "VND", "canManage": true,
  "members": [ { "companyId": "…", "code": "VCT", "name": "VComm Thương mại", "regime": "TT133", "currency": "VND", "isRoot": false, "excludedReason": null } ] }
```
- `members`: công ty gốc trước, rồi theo mã. `excludedReason`: `other_currency` (khác đồng tiền công ty gốc), `ledger_not_initialized` (chưa khởi tạo kế toán) hoặc `null`. `canManage`: có `finance.consolidation.manage` ở phạm vi tập đoàn.
- `GET /finance/consolidation/preview` (`200`), lược đồ `consolidationPreviewQuerySchema`: `kind` (`balance_sheet`, `income_statement`), `from`, `to`. Cộng gộp sổ cái các thành viên được hợp nhất, mẫu B01-DN hoặc B02-DN Thông tư 99 (QUYTAC_NGHIEPVU_124); chưa có bút toán loại trừ. Trả `ConsolidatedStatementResponse`:
```json
{ "kind": "balance_sheet", "form": "B01-DN", "name": "Báo cáo tình hình tài chính", "group": { "id": "…", "name": "VComm" }, "currency": "VND",
  "columns": [ { "label": "endOfPeriod", "from": null, "to": "2026-10-31" }, { "label": "startOfYear", "from": null, "to": "2025-12-31" } ],
  "memberNames": ["VComm Bán lẻ Miền Nam", "VComm Thương mại"],
  "lines": [ { "code": "110", "name": "I. Tiền và các khoản tương đương tiền", "level": 1, "note": null, "combined": "1430000", "eliminations": "0", "consolidated": "1430000", "previous": "0" } ] }
```
- `combined`: cộng gộp kỳ này; `consolidated`: hợp nhất kỳ này (có bút toán loại trừ, điều chỉnh tay, lãi chưa thực hiện); `eliminations` = `consolidated` − `combined`; `previous`: cột so sánh (số đầu năm hoặc cùng kỳ năm trước), chỉ cộng gộp. `columns` của B02-DN: `currentPeriod`, `previousPeriod`.
- `GET /finance/consolidation` (`200`): `{ data: ConsolidationListItem[], canManage }`, theo đến ngày giảm dần, rồi thời điểm lập giảm dần, tối đa 200 bảng. `ConsolidationListItem`: `id`, `fromDate`, `toDate`, `documentNo`, `status`, `calculatedAt`, `postError` (khóa thông báo khi duyệt xong không chốt được).
- `POST /finance/consolidation` (`201`), lược đồ `createConsolidationSchema`: `{ "from": "2026-11-01", "to": "2026-11-30" }`. Kỳ chưa có bảng của tập đoàn không ở `rejected`, `withdrawn` (kể cả khi hai yêu cầu lập cùng lúc: chỉ mục duy nhất, lần sau báo `consolidationPeriodExists`); tạo bảng `draft` và tính ngay trong cùng giao dịch (QUYTAC_NGHIEPVU_125 đến QUYTAC_NGHIEPVU_128). Ghi nhật ký `consolidation.create`. Trả `ConsolidationResponse`.
- Lỗi: `400 VALIDATION_FAILED` (`to`: `endBeforeStart` "Ngày kết thúc phải sau ngày bắt đầu."; tham số sai); `403`; `409 BUSINESS_RULE`: `consolidationPeriodExists` "Kỳ này đã có bảng hợp nhất đang dùng.", `consolidationNoMembers` "Tập đoàn chưa có công ty nào hợp nhất được (cùng đồng tiền, đã khởi tạo kế toán).", `consolidationPostingRuleMissing` "Công ty thành viên chưa khai định khoản doanh thu, giá vốn hoặc hàng hóa (Hệ thống tài khoản).".

### API_107 Chi tiết, tính lại, bỏ bảng nháp
- `GET /finance/consolidation/{id}` (`200`), `ConsolidationResponse`: các trường của dòng danh sách và `memberNames` (thành viên đã chốt ở lần tính gần nhất), `warnings[]`, `entries[]`, `profitLines[]`, `balanceSheet`, `incomeStatement` (`ConsolidatedStatementResponse`; bảng `pending`, `posted` trả số đã lưu lúc gửi), `accountOptions[]` (`code`, `name`, `byPartner`: tài khoản B01-DN lấy số dư theo đối tác, điều chỉnh tay bắt buộc đối tác), `memberOptions[]` (`companyId`, `name` của thành viên), `partnerOptions[]` (`partnerId`, `name` của đối tác thuộc các thành viên, theo tên), `canManage`, `canEdit` (có quyền lập và bảng `draft`, `rejected`, `withdrawn`), `canWithdraw` (có quyền lập, bảng `pending` có yêu cầu duyệt, người gọi là người gửi lần gần nhất), `currency`, `version`:
```json
{ "warnings": [ { "receivableCompany": "VComm Bán lẻ Miền Nam", "payableCompany": "VComm Thương mại", "receivable": "264000", "payable": "164000", "difference": "100000" } ],
  "entries": [ { "entryNo": 1, "kind": "intercompany_balance", "description": "Loại trừ công nợ nội bộ VComm Bán lẻ Miền Nam – VComm Thương mại",
                 "lines": [ { "companyName": "VComm Thương mại", "accountCode": "331", "partnerName": "VComm Bán lẻ Miền Nam", "debit": "164000", "credit": "0" } ] } ],
  "profitLines": [ { "id": "…", "buyerName": "VComm Thương mại", "sellerName": "VComm Bán lẻ Miền Nam", "itemName": "<tên sản phẩm> · <mã hàng>", "internalQuantity": "2", "endingQuantity": "2",
                     "unitMargin": "48000", "estimatedAmount": "96000", "overrideAmount": null, "overrideReason": null, "effectiveAmount": "96000" } ] }
```
- `warnings`: mỗi cặp công ty tối đa hai dòng: công nợ và trả trước (`receivable` là số dư Có phải thu, `payable` là số dư Nợ phải trả); số dương.
- `entries`: theo số bút toán; `accountCode` là mã đã ghép theo Thông tư 99; trả trước nội bộ: Nợ phải thu (bên nhận trước) / Có phải trả (bên trả trước), diễn giải "Loại trừ trả trước nội bộ <A> – <B>". Có dòng lãi với `effectiveAmount` lớn hơn 0 thì thêm cuối một bút toán `unrealized_profit` số 0, Nợ 632 / Có 156 tổng `effectiveAmount` (`companyName` rỗng).
- `POST /finance/consolidation/{id}/recalculate` (`201`): `{ "version": 0 }`. Khóa bảng, so `version` (khác thì `409 CONFLICT_VERSION`); bảng `draft`, `rejected` hoặc `withdrawn`; tính lại theo QUYTAC_NGHIEPVU_128. Ghi nhật ký `consolidation.recalculate`. Trả `ConsolidationResponse`.
- `POST /finance/consolidation/{id}/discard` (`204`): `{ "version": 0 }`. Chỉ bảng `draft` chưa có `documentNo` của tập đoàn, đúng `version` (khác, không tồn tại thì `409 CONFLICT_VERSION`); xóa bảng, bút toán, dòng lãi. Ghi nhật ký `consolidation.discard`.
- Lỗi: `400 VALIDATION_FAILED`; `403`; `404`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE`: `documentNotDraft` "Chỉ sửa được chứng từ đang ở trạng thái nháp.", `consolidationNoMembers`, `consolidationPostingRuleMissing`.

### API_108 Sửa lãi chưa thực hiện, điều chỉnh tay
- `PUT /finance/consolidation/{id}/profit-lines/{lineId}` (`200`), lược đồ `saveConsolidationProfitSchema`: `{ "amount": "90000", "reason": "Giảm giá hàng tồn", "version": 3 }`. `amount` không âm, tối đa 16 chữ số phần nguyên, 4 số lẻ, hoặc `null` (dùng số ước tính, xóa lý do); `reason` tối đa 500 ký tự, bắt buộc khi `amount` khác `null`. Bảng `draft`, `rejected` hoặc `withdrawn`, đúng `version`; dòng của bảng (không có thì `404`). Ghi nhật ký `consolidation.profit_override`. Trả `ConsolidationResponse`.
- `POST /finance/consolidation/{id}/entries` (`201`), lược đồ `consolidationManualEntrySchema`: `{ "description": "Loại trừ đầu tư vào công ty con", "lines": [ { "accountCode": "411", "companyId": "…", "partnerId": null, "debit": "1000000", "credit": "0" }, { "accountCode": "221", "companyId": null, "partnerId": null, "debit": "0", "credit": "1000000" } ], "version": 3 }`. `description` 1 đến 500 ký tự; `lines` 2 đến 20, `accountCode` 3 đến 10 ký tự, `companyId`, `partnerId` là UUID hoặc `null` (mặc định `null`), `debit`, `credit` không âm, tối đa 16 chữ số phần nguyên, 4 số lẻ. Mỗi dòng đúng một bên lớn hơn 0; tổng Nợ bằng tổng Có; `companyId` (nếu có) là thành viên; `accountCode` khớp mã đã ghép theo Thông tư 99 của tài khoản thuộc `companyId`, không có `companyId` thì của thành viên đứng đầu trước; `partnerId` (nếu có) phải tồn tại; tài khoản có `byPartner` bắt buộc `partnerId`. Lưu một bút toán `manual`, đối tác từng dòng. Ghi nhật ký `consolidation.manual_entry`. Trả `ConsolidationResponse`.
- `DELETE /finance/consolidation/{id}/entries/{entryNo}?version=` (`200`): xóa bút toán `manual` có số đó (không có thì `404`). Ghi nhật ký `consolidation.remove_manual_entry`. Trả `ConsolidationResponse`.
- Lỗi: `400 VALIDATION_FAILED` với `fields`: `reason` (`required`), `lines` (`journalUnbalanced` "Tổng Nợ phải bằng tổng Có."), `lines.<số dòng>.debit`, `lines.<số dòng>.accountCode`, `lines.<số dòng>.companyId`, `lines.<số dòng>.partnerId` (`invalidValue`), `lines.<số dòng>.partnerId` (`required`); `403`; `404`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE` `documentNotDraft`.

### API_109 Gửi, rút, xuất
- `POST /finance/consolidation/{id}/submit` (`201`): `{ "version": 0 }`. Tạo dãy số `HN` của công ty gốc nếu chưa có; khóa bảng, so `version`; bảng `draft`, `rejected` hoặc `withdrawn`; tính lại theo sổ hiện tại (như `recalculate`); cấp số lần đầu (gửi lại giữ số); tính báo cáo, lưu vào `report`; tạo yêu cầu duyệt loại `finance.consolidation` của công ty gốc (giá trị là tổng tài sản hợp nhất, chỉ tiêu 280, giá trị tuyệt đối; tiền tệ công ty gốc; ngày chứng từ là `toDate`); chuyển `pending`, ghi người gửi, xóa `postError`; kỳ đã có bảng khác không ở `rejected`, `withdrawn` (gửi lại bảng bị từ chối, đã rút) thì `409 BUSINESS_RULE` `consolidationPeriodExists`. Chưa có chính sách duyệt thì chốt số ngay, trả `posted`. Chốt số: chuyển `posted` với số đã lưu lúc gửi (bảng chưa có số lưu thì tính lúc chốt). Ghi nhật ký `consolidation.submit` (số, mã yêu cầu duyệt) theo công ty gốc.
- `POST /finance/consolidation/{id}/withdraw` (`201`): không có thân. Chỉ người gửi lần gần nhất, bảng `pending` có yêu cầu duyệt (khác thì `403`); rút yêu cầu duyệt, chuyển `withdrawn`. Ghi nhật ký `consolidation.withdraw`. Trả `ConsolidationResponse`.
- Duyệt xong (nghe `core.approval.completed` loại `finance.consolidation`): chốt số đã lưu lúc gửi, chuyển `posted`; lỗi quy tắc khi chốt thì `rejected` kèm `postError`. Từ chối, rút: `rejected`, `withdrawn`.
- `GET /finance/consolidation/{id}/export?kind=&format=` (`200`): `kind` (`balance_sheet`, `income_statement`), `format` (`xlsx`, `pdf`); mọi trạng thái (bảng `posted` xuất số đã chốt). Tệp theo khuôn báo cáo tài chính (`statementXlsx`, `statementPdf`): tên "<tên báo cáo> hợp nhất", đơn vị "<tập đoàn> (hợp nhất: <thành viên>)", mã số thuế công ty gốc; cột "Hợp nhất – số cuối kỳ" (hoặc "Hợp nhất – kỳ này"), "Cộng gộp – số đầu năm" (hoặc "Cộng gộp – cùng kỳ năm trước"). `content-type` Excel hoặc `application/pdf`; `content-disposition` `attachment` (Excel), `inline` (PDF), tên `HN-<mẫu>-<đến ngày>.<đuôi>`.
- Lỗi: `400 VALIDATION_FAILED`; `403`; `404`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE`: `documentNotDraft`, `consolidationPeriodExists`, `consolidationNoMembers`, `consolidationPostingRuleMissing`; lỗi của luồng duyệt.

## 3p. Hợp đồng chi tiết gán khách hàng cho nhân viên kinh doanh (MODULE_07 phần 2, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); giữ để tra cứu.

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_21); trường thừa bị từ chối. Thời điểm trả dạng ISO 8601. `status` của phiếu: `draft` (Nháp), `pending` (Chờ duyệt), `applied` (Đã áp dụng), `rejected` (Bị từ chối), `withdrawn` (Đã rút).

### API_110 Phiếu giao khách
- Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).
Gửi lên (`POST /crm/customer-assignments`):
```json
{ "targetUserId": "01J...", "reason": "Chia lại địa bàn quận 7", "partnerIds": ["01J...", "01J..."] }
```
- Kiểm tra: `targetUserId` UUID; `reason` 1 đến 500 ký tự (cắt khoảng trắng); `partnerIds` 1 đến 500 UUID, không trùng; `version` số nguyên dương (khi sửa).
- Dòng danh sách: `{ id, documentNo, status, targetUserName, reason, customerCount, createdByName, createdAt }`; mới lập trước. Người có quyền giao khách thấy mọi phiếu của công ty; người khác thấy phiếu mình lập, mình gửi hoặc giao cho mình.
- Chi tiết thêm `targetUserId`, `lines[]` (`{ partnerId, code, name, currentOwnerName, previousOwnerName }`, theo tên; `previousOwnerName` là nhân viên phụ trách lúc gửi), `applyError` (khóa thông báo `assignmentOwnersChanged`, `assignmentTargetInactive`), `applyErrorDetail` (tên các khách đã đổi, cách nhau dấu phẩy), `submittedAt`, `appliedAt`, `version`, `canEdit`, `canSubmit` (là trưởng phòng hoặc có quyền giao khách; người lập hoặc có quyền giao khách; `draft`, `rejected`, `withdrawn`), `canWithdraw` (`pending`, người gửi, có yêu cầu duyệt), `canDiscard` (như `canEdit`, `draft`, chưa có số).
- `customer-assignment-options`: `{ users: [{ id, fullName }], canAssignAll }`; `users` là thành viên đang hoạt động của công ty (có quyền giao khách) hoặc nhân viên phòng mình quản lý, theo tên. Không phải trưởng phòng, không có quyền giao khách: `403`.
- `POST` (`201`, nháp); `PATCH` (`200`): phiếu `draft`, `rejected`, `withdrawn`, đúng `version`; thay toàn bộ khách, về `draft`, xóa lý do không áp dụng được. `discard` (`204`): `{ "version": 1 }`, phiếu nháp chưa có số; xóa phiếu. Nhật ký `customer_assignment.create`, `customer_assignment.update` (có `beforeData`), `customer_assignment.discard`.
- `submit` (`201`): `{ "version": 1 }`. Tạo dãy số `GK` nếu chưa có; khóa phiếu đúng `version`; khóa hồ sơ các khách theo thứ tự `partner_id`; kiểm lại như khi lưu; ghi `previous_user_id` từng khách; cấp số lần đầu (gửi lại giữ số); tạo yêu cầu duyệt loại `crm.customer_assignment` (giá trị `0`, tiền tệ công ty, ngày chứng từ là hôm nay); chuyển `pending`, ghi người gửi, thời điểm gửi. Chưa có chính sách duyệt: áp dụng ngay trong cùng giao dịch, trả `applied`; áp dụng không được thì `409 BUSINESS_RULE` với khóa lý do, phiếu không đổi. Nhật ký `customer_assignment.submit` (số, mã yêu cầu duyệt).
- Áp dụng: khóa phiếu, hồ sơ các khách; nhân viên nhận còn là thành viên đang hoạt động, tài khoản đang hoạt động; mỗi khách có hồ sơ khách hàng đang dùng, đối tác đang giao dịch, `owner_user_id` bằng `previous_user_id`; đạt thì đặt `owner_user_id` là nhân viên nhận (tăng `version` hồ sơ), đóng dòng lịch sử đang mở, mở dòng mới có `assignment_id`; `status` `applied`, `appliedAt`; thông báo `crm.customer_assignment.received` cho nhân viên nhận ("Bạn được giao <số> khách hàng theo phiếu <số phiếu>"), `crm.customer_assignment.removed` cho từng nhân viên cũ khác nhân viên nhận ("<số> khách hàng của bạn đã chuyển cho nhân viên khác theo phiếu <số phiếu>"), liên kết `/crm/customer-assignments/<mã>`.
- `withdraw` (`201`): không có thân. Chỉ người gửi, phiếu `pending` có yêu cầu duyệt (khác thì `403`); rút yêu cầu duyệt, chuyển `withdrawn`. Nhật ký `customer_assignment.withdraw`.
- Duyệt xong (nghe `core.approval.completed` loại `crm.customer_assignment`): áp dụng; không áp dụng được thì `rejected` kèm `applyError`, `applyErrorDetail`. Từ chối, rút: `rejected`, `withdrawn`.
- Lỗi: `400 VALIDATION_FAILED` tại `reason` "Vui lòng nhập thông tin này."; tại `targetUserId`, `partnerIds` "Giá trị không hợp lệ."; tại `partnerIds.{i}` `assignmentCustomerInvalid`, `assignmentSameOwner`; `403`; `404`; `409 CONFLICT_VERSION`; `409 BUSINESS_RULE`: `documentNotDraft`, `assignmentOwnersChanged`, `assignmentTargetInactive`; lỗi của luồng duyệt.

### API_111 Lịch sử phụ trách, nhận đối tác làm khách của mình
- Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).
- `GET /crm/partners/{id}/owner-history` (`200`): `[{ userName, validFrom, validTo, assignmentId, documentNo }]` của khách tại công ty đang làm việc, `validFrom` giảm dần; `validTo` `null` là đang phụ trách; `assignmentId`, `documentNo` `null` khi không qua phiếu. Khách ngoài phạm vi xem: `404`.
- `POST /crm/partners/{id}/claim` (`201`): không có thân. Cần `crm.partner.manage`; người gọi không có `crm.customer.view_all`; đối tác đang giao dịch, không phải công ty trong tập đoàn, công ty chưa có hồ sơ. Lập hồ sơ `{ isCustomer: true, isSupplier: false, paymentTermDays: 0, creditLimit: "0", ownerUserId: <người gọi>, status: "active" }`, mở dòng lịch sử; hai người nhận cùng lúc thì người sau nhận lỗi. Nhật ký `partner_profile.claim` (loại đối tượng `partner_profile`). Trả chi tiết đối tác như API_71.
- Lỗi: `403`; `404`; `409 BUSINESS_RULE` `partnerNotClaimable`.

## 3q. Hợp đồng chi tiết tài khoản người mua VComm (MODULE_09 phần lõi 1, CONG_VIEC_23)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_23); trường thừa bị từ chối. Số điện thoại gửi lên dạng `0912345678` hoặc `+84912345678`, chỉ nhận số Việt Nam; trả về dạng `0…`. Thời điểm dạng ISO 8601.

### API_116 Đăng ký
- `POST /buyer/register/otp` (`204`): `{ "phone": "0912345678" }`. Số đã có tài khoản: `400` tại `phone` "Số điện thoại đã có tài khoản. Hãy đăng nhập."; quá 5 lần gửi mỗi giờ (mọi mục đích): `429` `otpTooMany`.
- `POST /buyer/register` (`200`): `{ "phone": "0912345678", "code": "123456", "fullName": "Nguyễn Văn A", "password": "…", "referralCode": "0987654321" }` (`referralCode` không bắt buộc, tối đa 20 ký tự). Kiểm thứ tự: số chưa có tài khoản, mật khẩu ≥ 10 ký tự, mã giới thiệu (`referralCodeInvalid`), rồi mới dùng mã OTP (`otpInvalid` tại `code`). Trả `{ mfaRequired, mfaEnrolled, user: { id, fullName, locale }, tokens: { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } }`, phiên `vcomm_app` 90 ngày. Nhật ký `buyer.register`.

### API_117 Đăng nhập, quên mật khẩu
- `POST /buyer/login` (`200`): `{ phone, password }`; sai: `401` "Thông tin đăng nhập không đúng."; khóa: `423`. Trả như API_116.
- `POST /buyer/login/otp` (`204`): `{ phone }`, luôn `204` (không lộ số có tài khoản). `POST /buyer/login/otp/verify` (`200`): `{ phone, code }`; sai `401` `otpInvalid`.
- `POST /buyer/password-reset/otp` (`204`): luôn `204`. `POST /buyer/password-reset` (`204`): `{ phone, code, password }`; mã sai `400` tại `code`; xong thu hồi mọi phiên, bỏ khóa đăng nhập; nhật ký `password.reset`.
- Làm mới, đăng xuất: API_112 (`POST /auth/app/refresh` nhận mọi phiên ứng dụng di động, không nhận phiên web; hai yêu cầu cùng token thì một yêu cầu `401` và cả chuỗi bị thu hồi).

### API_118 Tài khoản người mua
- `GET /buyer/me`: `{ id, fullName, phone, referralCode, registeredAt, referrer: { fullName, maskedPhone } | null, canSetReferrer, isSalesStaff }`.
- `GET /buyer/referrals`: `[{ fullName, maskedPhone, registeredAt }]`, mới đăng ký trước, tối đa 500.
- `POST /buyer/referrer` (`200`): `{ "referralCode": "0987654321" }`; trả như `/buyer/me`. Đã có người giới thiệu hoặc đã từng tự nhập: `409` `referrerAlreadySet`; tự giới thiệu `referralSelf`; chọn người mình đã giới thiệu `referralCycle` (tại `referralCode`).
- `GET /buyer/sales/customers`: `[{ id, fullName, phone, registeredAt }]` (khách mà người gọi là người giới thiệu hiện tại); không phải nhân viên kinh doanh: `403`.

### API_119 Quản trị người mua
- `GET /marketplace/settings`: `{ operatorCompany: { id, shortName } | null, canSetOperator, companies: [{ id, shortName }] (chỉ khi canSetOperator), canManage, departments: [{ id, name }] (phòng ban đang hoạt động của công ty vận hành sàn, khi canManage) }`; không có quyền nào: `403`.
- `PUT /marketplace/operator-company` (`200`): `{ companyId }`; còn nhân viên kinh doanh được đánh dấu ở công ty khác: `409` `marketplaceOperatorHasSalesStaff`. Nhật ký `marketplace.operator.set`.
- `GET /marketplace/buyers?search=&salesStaff=true|false&page=&pageSize=`: trang `{ data: [{ id, fullName, phone, status, registeredAt, referrerName, referrerPhone, isSalesStaff, referralCount }], page, pageSize, total }`; tìm theo tên hoặc dãy số (từ 3 chữ số). Chưa chọn công ty vận hành sàn: `409` `marketplaceOperatorNotSet`.
- `GET /marketplace/buyers/{id}`: thêm `version`, `referrerId`, `salesDepartmentId`, `salesDepartmentName`, `referrerHistory[]`, `salesFlagHistory[]`, `referrals[]`.
- `POST /marketplace/buyers/{id}/referrer` (`200`): `{ referralCode: string | null, reason (1 đến 500), version }`; không đổi: `409` `referrerUnchanged`; sai phiên bản `409 CONFLICT_VERSION`. Nhật ký `buyer.referrer.change`.
- `POST /marketplace/buyers/{id}/sales-flag` (`200`): `{ departmentId, version }`; phòng ban không thuộc công ty vận hành sàn: `400` tại `departmentId`; tài khoản không hoạt động: `409` `buyerInactive`. `DELETE /marketplace/buyers/{id}/sales-flag` (`200`): `{ version }`; chưa đánh dấu: `409` `buyerNotSalesStaff`. Nhật ký `buyer.sales.flag`, `buyer.sales.unflag`.

## 3r. Hợp đồng chi tiết đội kinh doanh (MODULE_09 phần lõi 1b, CONG_VIEC_27)

Chức danh: `director` (Giám đốc Kinh doanh), `regional_director` (Giám đốc Vùng), `team_head` (Trưởng phòng kinh doanh), `staff` (Nhân viên kinh doanh). Loại đơn vị: `division`, `region`, `team`.

- API_120 `GET /marketplace/sales-team`: `{ units: [{ id, parentId, code, name, type, managerUserId, managerName }], members: [{ userId, fullName, phone, departmentId, title, customerCount, version }] }` (mọi phòng ban đang hoạt động của công ty vận hành sàn). `PUT /marketplace/sales-units/{id}` `{ "type": "region" | null }`: sai thứ bậc `409 salesUnitOrderInvalid`; đổi, bỏ loại khi còn thành viên `409 salesUnitHasMembers`. `PUT .../manager` `{ "userId": "…" | null }`: người không thuộc đơn vị `409 salesManagerNotInUnit`; đang quản lý đơn vị khác `409 salesManagerOfOtherUnit`. `POST /marketplace/buyers/{id}/sales-move` `{ departmentId, version }`: trả chi tiết người mua. Chi tiết người mua (API_119) thêm `salesTitle`, `salesChain: [{ userId, fullName, title }]`. Đánh dấu chỉ vào đơn vị kinh doanh (khác: `400` tại `departmentId`).
- API_121 `POST /buyer/sales/proposals` (`201`): `{ kind, targetPhone (add), targetUserId (move, appoint, remove), departmentId (add, move, appoint), reason }`. Lỗi: không quản lý đơn vị nào `403`; `400` tại `targetPhone` (`salesProposalTargetNotFound`, `salesProposalAlreadyMember`), `targetUserId`, `departmentId` (ngoài nhánh, sai đơn vị); đã có đề xuất chờ `409 salesProposalPendingExists`. Dòng: `{ id, kind, status, proposerName, targetUserId, targetName, targetPhone, departmentId, departmentName, reason, decidedByName, decidedAt, decisionNote, createdAt }`. `proposal-options`: `{ units: [{ id, name, type }], members: [{ userId, fullName, departmentId, title }] }`. Duyệt `200`: kiểm lại như khi lập (lỗi trả như khi lập, đề xuất vẫn chờ); không chờ `409 salesProposalNotPending`. Từ chối `{ note }` (1 đến 500 ký tự). Thông báo `sales_proposal.approved`, `sales_proposal.rejected` cho người đề xuất.
- API_122 `GET /buyer/sales/team`: `{ title, unitName, members: [{ userId, fullName, title, unitName, customerCount }] }`; không là thành viên đội `403`. `GET /buyer/sales/members/{userId}/customers`: như khách tôi phụ trách.

## 3s. Hợp đồng chi tiết đặt hàng trên VComm (MODULE_09 phần lõi 2, CONG_VIEC_24)

Tiền là chuỗi số thập phân; tiền hàng, phí, tổng của đơn làm tròn đến đồng. Các API quản trị dùng phiên web, xét quyền tại công ty vận hành sàn (chưa chọn công ty vận hành sàn: `409` `marketplaceOperatorNotSet`); API người mua dùng token ứng dụng, không dùng `X-Company-Id`.

- API_123 `GET /marketplace/store-settings`: `{ companyName, channelId, warehouseId, shippingFee, freeShippingThreshold, packageLengthCm, packageWidthCm, packageHeightCm, minimumWeightGrams, version (0: chưa lưu), canManage, channels, warehouses, carriers: [{ code, name, isEnabled, isConfigured }] }`. `PUT`: các trường trên trừ danh sách, kèm `version`; lỗi `400` tại `channelId`, `warehouseId` (`invalidValue`, `warehouseUsesLocations`), `409` sai phiên bản. `PUT /marketplace/carriers/{code}` `{ isEnabled }`: mã không có `404`; bật khi chưa có kết nối `409` `carrierNotConfigured`. `GET /marketplace/listings?search&published=all|published|unpublished&page&pageSize`: `{ data: [{ productId, name, categoryName, imageUrl, isPublished, description, priceFrom, available, blockers: [storeNotReady, notApproved, inactive, lotOrSerial, noPrice] }], page, pageSize, total }`. `PUT /marketplace/listings/{productId}` `{ isPublished, description }` → `204`. `PUT /marketplace/buyers/{id}/test-buyer` `{ isTestBuyer }` → chi tiết người mua (thêm `isTestBuyer`).
- API_124 `GET /buyer/shop/products?search&page&pageSize`: `{ data: [{ id, name, imageUrl, priceFrom, inStock }], … }`. `GET /buyer/shop/products/{id}`: `{ id, name, description, unitName, images, options: [{ name, values }], variants: [{ id, sku, optionValues, price, available }], currency }`; không đang bán `404`. `GET /buyer/cart`: `{ lines: [{ variantId, productId, productName, variantLabel, imageUrl, quantity, price (null: ngừng bán), available }], currency }`. `PUT /buyer/cart/lines` `{ variantId, quantity 1..999 }` → giỏ; lỗi `409` `productNotSellable`, `cartFull`.
- API_125 tỉnh, xã: `[{ code, name }]`. Địa chỉ: `{ recipientName, phone, provinceCode, wardCode, streetAddress, isDefault }`; trả về cả sổ `[{ id, recipientName, phone, provinceCode, provinceName, wardCode, wardName, streetAddress, isDefault }]`; xã không thuộc tỉnh `400` tại `wardCode`; đủ 10 `409` `addressBookFull`; địa chỉ của người khác `404`.
- API_126 `POST /buyer/orders/preview` `{ addressId|null, lines: [{ variantId, quantity }] }` → `{ lines: [{ variantId, productName, variantLabel, imageUrl, quantity, unitPrice, promotionDiscount, total, isGift, orderLineId }], goodsAmount, shippingFee, total, currency, canOrder }`. `POST /buyer/orders` `{ addressId, lines, expectedTotal }` (`201`) → chi tiết đơn; lỗi `409`: `orderingNotOpen`, `storeNotReady`, `productNotSellable`, `dailyOrderLimit`, `orderPriceChanged`, `orderOutOfStock`, `marketplaceOrderNeedsReview`; địa chỉ không phải của mình `400` tại `addressId`. Chi tiết đơn: `{ id, documentNo, status, createdAt, total, itemCount, firstProductName, imageUrl, recipientName, recipientPhone, address, lines, goodsAmount, shippingFee, paymentMethod: cod, carrierName, trackingCode, deliveredAt, returnDeadline, completedAt, completedAmount, cancelReason, events: [{ status, note, at }], canCancel, returnRequests, canRequestReturn, version }`. `POST /buyer/orders/{id}/cancel` `{ reason 1..500, version }`; lỗi `409` `orderNotCancellable`, `carrierCancelRejected`, sai phiên bản.
- API_127 `GET /marketplace/orders?status&search&page&pageSize` (tìm số đơn đúng, hoặc từ 6 chữ số điện thoại người mua, người nhận): thêm `buyerName`, `buyerPhone`, `recipientName`, `carrierStatus`. Chi tiết: thêm `buyerId`, `buyerName`, `buyerPhone`, `salesOrderId`, `shipments: [{ carrierCode, carrierName, trackingCode, carrierStatus, fee, isActive, createdAt, syncedAt }]`, `canShip`, `canRefreshShipment`, `carriers`. `POST …/ship` `{ carrierCode, version }`: lỗi `409` `orderNotShippable`, `carrierDisabled`, `carrierNotConfigured`, `warehouseUsesLocations`, `carrierRejected`, `carrierUnavailable`, sai phiên bản. `POST …/refresh-shipment`: tra lại, áp trạng thái. `POST …/cancel` như API_126.
- API_128 `POST /public/carriers/ghn/webhook/{key}`: nhận nội dung webhook của GHN (đọc `OrderCode`), luôn tra lại vận đơn từ GHN; trả `{ result: applied | ignored }`; sai khóa `403`; mã đơn vị không có `404`.
- API_129 ảnh: `201` `{ id }`; quá 5 MB `400` (`imageTooLarge`), không phải JPEG, PNG `400` (`returnImageType`), quá 20 ảnh chưa gửi mỗi ngày `409` `returnImageLimit`. `POST /buyer/orders/{id}/return-requests` `{ reason, description, lines: [{ orderLineId, quantity }], imageIds (≤ 5) }` (`201`) → danh sách yêu cầu của đơn `[{ id, orderId, documentNo, status, reason, description, lines, images, decisionNote, createdAt, decidedAt, closedAt, canWithdraw, version }]`; lỗi `409` `returnWindowClosed`, `returnRequestOpen`; `400` `returnQuantityExceeded`. Rút `{ version }`. Quản trị: danh sách, chi tiết thêm `buyerName`, `buyerPhone`, `canDecide`, `canClose`; `approve`, `receive` `{ note|null, version }`; `reject`, `not-received` `{ note 1..500, version }`; sai trạng thái `409` `returnRequestNotOpen`.

## 3t. Hợp đồng chi tiết thanh toán đơn người mua (MODULE_09 phần lõi 3, CONG_VIEC_25)

Tiền là chuỗi số thập phân, làm tròn đến đồng. Mã phương thức: `cod`, `vnpay_qr`, `vnpay_atm`, `vnpay_card`; mã cổng: `cod`, `vnpay`. Trạng thái thanh toán của đơn `paymentStatus`: `unpaid`, `paid`, `refund_pending`, `partially_refunded`, `refunded`.

- API_123 (bổ sung) `GET /marketplace/store-settings` thêm `orderingOpen`, `paymentMethods: [{ code, gatewayCode, isEnabled, isConfigured }]` (theo thứ tự hiển thị).
- API_130 `PUT /marketplace/payment-methods/{code}` `{ isEnabled }` → cài đặt bán hàng như API_123; mã không có `404`; bật khi cổng chưa có kết nối `409` `paymentGatewayNotConfigured`; tắt phương thức đang bật cuối cùng khi đang mở đặt hàng `409` `paymentMethodRequired`. `PUT /marketplace/ordering-open` `{ orderingOpen }` → cài đặt bán hàng; chưa lưu cài đặt bán hàng `409` `storeNotReady`; mở khi không có phương thức dùng được `409` `paymentMethodRequired`. Ghi nhật ký kiểm tra `marketplace.payment_method.update`, `marketplace.ordering_open.update`.
- API_126 (bổ sung) `POST /buyer/orders/preview` thêm `paymentMethods` (phương thức đang bật, cổng có kết nối); `canOrder` đúng khi (đã mở đặt hàng hoặc là người mua thử) và có phương thức. `POST /buyer/orders` thêm `paymentMethod` (mặc định `cod`); phương thức không dùng được `409` `paymentMethodUnavailable`; phương thức trực tuyến: đơn `awaiting_payment`, `paymentDeadline` sau 15 phút, tiền thu hộ 0. Chi tiết đơn: `paymentMethod`, `paymentStatus`, `paidAmount`, `refundedAmount`, `paymentDeadline` (chỉ khi Chờ thanh toán), `canPay`, `refunds: [{ amount, reason, status, refundedOn }]`, `needsBankAccount`; `total` là tiền hàng + phí giao hàng. Hủy đơn nhận cả trạng thái `awaiting_payment`.
- API_127 (bổ sung) lọc `status=awaiting_payment`; chi tiết thêm `payments: [{ reference, method, amount, status: pending|succeeded|failed, responseCode, transactionNo, createdAt, completedAt }]`, `canRecordCod`.
- API_131 `POST /buyer/orders/{id}/payments` (không có nội dung) → `{ paymentUrl, deadline }`: tạo lần thanh toán mới (số tham chiếu duy nhất), đường dẫn VNPAY phiên bản 2.1.0 ký `vnp_SecureHash`, `vnp_ExpireDate` bằng hạn thanh toán, `vnp_BankCode` theo phương thức (`VNPAYQR`, `VNBANK`, `INTCARD`). Lỗi: cổng chưa có kết nối `409` `paymentGatewayNotConfigured`; đơn không Chờ thanh toán, quá hạn hoặc phương thức `cod` `409` `orderNotAwaitingPayment`; quá 10 lần `409` `paymentAttemptLimit`; đơn không có hoặc của người khác `404`.
- API_132 `GET /public/payments/vnpay/ipn?vnp_…` → `{ RspCode, Message }` theo quy ước VNPAY: `00` ghi nhận thành công (`Confirm Success`; kết quả không thành công cũng trả `00` sau khi ghi lần thanh toán không thành công), `01` không tìm thấy số tham chiếu, `02` lần thanh toán đã xác nhận, `04` sai số tiền, `97` sai chữ ký hoặc sai mã website, `99` máy chủ chưa có kết nối hoặc lỗi khi ghi nhận (VNPAY gửi lại). Sai chữ ký đếm theo địa chỉ IP (`vnpay-ipn-invalid`), quá giới hạn `429` không ghi lại. Mọi lần nhận ghi vào `marketplace.payment_notifications`. `GET /public/payments/vnpay/return?vnp_…` → trang HTML (`Cache-Control: no-store`) chỉ hiển thị kết quả (thành công, không thành công, đang chờ, không xác nhận được) và liên kết `<VCOMM_APP_LINK_BASE>don-hang/<id>`; không ghi nhận tiền; giới hạn theo địa chỉ IP (`vnpay-return`), quá giới hạn hiện "không xác nhận được".
- API_133 `GET /buyer/bank-account` → `{ bankAccount: { bankName, accountNumber, accountHolder } | null }`; `PUT` `{ bankName 2..100, accountNumber 6..20 chữ số, accountHolder 2..100 }` → `{ bankAccount }`; sai `400`. `GET /marketplace/refunds?status=pending|completed&page&pageSize` → `{ data: [{ id, orderId, documentNo, buyerName, buyerPhone, reason, amount, status, bankAccount|null, bankTransactionNo, refundedOn, note, createdAt, completedAt, version }], page, pageSize, total }` (chờ hoàn xếp theo lập lúc, đã hoàn theo thời điểm hoàn mới nhất). `POST /marketplace/refunds/{id}/complete` `{ bankTransactionNo 1..100, refundedOn, note ≤ 500|null, version }` → việc hoàn tiền; ngày sau hôm nay `400` tại `refundedOn`; không còn chờ `409` `refundNotPending`; sai phiên bản `409`; việc của công ty khác `404`; ghi nhật ký `marketplace.refund.complete`, bút toán hoàn tiền, thông báo người mua `marketplace_refund.completed`. `POST /marketplace/orders/{id}/cod-collected` `{ collectedOn, reference 1..100, version }` → chi tiết đơn như API_127; đơn không ghi được `409` `codNotRecordable`; ngày sau hôm nay `400` tại `collectedOn`; sai phiên bản `409`; ghi nhật ký `marketplace.order.cod_collected`.

## 3u. Hợp đồng chi tiết hoa hồng theo đơn và ví hoa hồng (MODULE_09 phần lõi 4, CONG_VIEC_26)

Tiền là chuỗi số thập phân, làm tròn đến đồng. Cách tính `calculation`: `percent`, `fixed`. Phần `share`: `referral`, `staff`, `team_head`, `regional_director`, `director`. Loại giao dịch ví `kind`: `commission`, `withdrawal`, `withdrawal_reversal`. Trạng thái yêu cầu rút tiền `status`: `pending`, `approved`, `rejected`, `cancelled`, `paid`. Bảng phí rút tiền `withdrawalFees` (THAY_DOI_17): `{ byCount: [{ fromCount 1..1000, fee }], byAmount: [{ fromAmount, fixedFee, percent 0..100, minimumFee, maximumFee|null }] }`, mỗi bảng tối đa 20 mức, không trùng mốc, `maximumFee` không nhỏ hơn `minimumFee`.

- API_123 (bổ sung) `GET /marketplace/store-settings` thêm `commissionSettings: { taxThreshold, taxRate, minimumWithdrawal, withdrawalFees, version (0: chưa lưu) }`. `GET /marketplace/listings` mỗi dòng thêm `commission: { calculation, referral, staff, teamHead, regionalDirector, director, version } | null`.
- API_134 `PUT /marketplace/listings/{productId}/commission` `{ calculation, referral, staff, teamHead, regionalDirector, director, version (0: lần đầu) }` → `{ calculation, referral, staff, teamHead, regionalDirector, director, version }`. Lỗi: sản phẩm không thuộc công ty vận hành sàn `404`; số sai `400`; phần trăm tổng quá 100 `409` `commissionPercentOver`; số tiền cố định khi sản phẩm chưa có giá `409` `commissionNeedsPrice`; tổng vượt giá bán gồm thuế thấp nhất `409` `commissionFixedOverPrice`; sai phiên bản `409`. Ghi nhật ký `marketplace.product_commission.update`. `PUT /marketplace/commission-settings` `{ taxThreshold, taxRate (tối đa 2 chữ số thập phân, ≤ 100), minimumWithdrawal (> 0), withdrawalFees (không gửi: giữ bảng đang có), version }` → cài đặt bán hàng như API_123; sai `400`; sai phiên bản `409`. Ghi nhật ký `marketplace.commission_settings.update`.
- API_127 (bổ sung) chi tiết đơn thêm `commissions: [{ beneficiaryName, beneficiaryPhone, share, amount, credited }]` (đã cộng ví: số thực; chưa hoàn tất: ước tính theo hàng hiện tại; đơn hủy: mảng rỗng).
- API_122 (bổ sung) `GET /buyer/sales/team` mỗi thành viên thêm `creditedCommission`, `pendingCommission`.
- API_135 `GET /buyer/wallet?page&pageSize (≤ 50)` → `{ balance, pendingAmount, transactions: { data: [{ id, kind, amount (trừ thì âm), balanceAfter, orderId, orderDocumentNo, note, createdAt }], page, pageSize, total }, withdrawal: { minimumWithdrawal, taxThreshold, taxRate, withdrawalFees, withdrawalsThisMonth, approvedThisMonth, bankAccount|null, open: <yêu cầu rút tiền>|null } }`. Chưa có ví thì số dư 0. Lịch sử mới nhất trước. `withdrawalsThisMonth`: số yêu cầu đã gửi trong tháng này theo giờ Việt Nam (không tính bị từ chối, đã rút lại); yêu cầu mới là lần thứ `withdrawalsThisMonth + 1`. `approvedThisMonth`: tổng số tiền các yêu cầu đã duyệt, đã chi của người dùng có ngày duyệt trong tháng này theo giờ Việt Nam; thuế dự kiến xét ngưỡng trên `approvedThisMonth + số tiền rút` (THAY_DOI_19).
- API_136 Yêu cầu rút tiền: `{ id, userName, userPhone, amount, taxAmount, feeAmount, netAmount, bankAccount: { bankName, accountNumber, accountHolder }, status, rejectReason, bankTransactionNo, paidOn, createdAt, decidedAt, version }`; chưa duyệt thì thuế, phí, thực nhận là dự kiến theo cài đặt hiện tại, đã duyệt là số chốt. `POST /buyer/withdrawals` `{ amount (số đồng nguyên, chuỗi 1 đến 13 chữ số) }` (`201`) → yêu cầu; lỗi `400` tại `amount` (`withdrawalBelowMinimum`, `withdrawalOverBalance`, `withdrawalFeeOverAmount`); chưa có tài khoản ngân hàng `409` `withdrawalNeedsBankAccount`; đã có yêu cầu đang chờ `409` `withdrawalAlreadyOpen`; chưa có công ty vận hành sàn `409` `storeNotReady`. `POST /buyer/withdrawals/{id}/cancel` `{ version }` → yêu cầu; của người khác `404`; không còn chờ duyệt `409` `withdrawalNotPending`; sai phiên bản `409`. `GET /marketplace/withdrawals?status (mặc định pending)&page&pageSize` → `{ data: [yêu cầu], page, pageSize, total }` (chờ duyệt, đã duyệt xếp theo gửi lúc; khác xếp theo lần xử lý mới nhất). `POST …/{id}/approve` `{ version }` → yêu cầu (chốt thuế, phí, thực nhận theo cài đặt lúc duyệt); thực nhận không lớn hơn 0 `409` `withdrawalFeeOverAmount`. `POST …/{id}/reject` `{ reason 1..500, version }` → yêu cầu (cộng lại ví). `POST …/{id}/pay` `{ bankTransactionNo 1..100, paidOn, version }` → yêu cầu; ngày chi sau hôm nay hoặc trước ngày duyệt `400` tại `paidOn`; bút toán chi trả. Lỗi chung của duyệt, từ chối, ghi đã chi: yêu cầu của công ty khác `404`; yêu cầu của chính mình `409` `withdrawalSelfDecision`; sai trạng thái `409` `withdrawalNotPending` (duyệt, từ chối) hoặc `withdrawalNotApproved` (ghi đã chi); sai phiên bản `409`. Ghi nhật ký `marketplace.withdrawal.approve`, `.reject`, `.pay`; thông báo người dùng `marketplace_withdrawal.approve`, `.reject`, `.pay`. `GET /marketplace/withdrawals/tax-report?month=YYYY-MM` → `{ month, rows: [{ userName, userPhone, amount, taxAmount, feeAmount, netAmount, paidOn, bankTransactionNo }], totalAmount, totalTax }` (yêu cầu đã chi có thuế, theo tháng của ngày chi).

## 3v. Hợp đồng sửa theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

Lược đồ, kiểu trong `packages/contracts/src/index.ts`. Không thêm mã API mới; endpoint mới `GET /crm/visit-options` thuộc nhóm ghé thăm khách (API_114 của CONG_VIEC_22).

| Thay đổi | Endpoint | Nội dung |
|---|---|---|
| Bỏ | API_93, API_94 (`/finance/commission-settings`, `/finance/commission-targets`, `/finance/commissions/...`); `GET /finance/my-commissions` (API_115 của CONG_VIEC_22) | Trả `404`; quyền `finance.commission.*` đã xóa |
| Tắt | API_110 (`/crm/customer-assignments...`, `/crm/customer-assignment-options`), API_111 (`/crm/partners/{id}/owner-history`, `/crm/partners/{id}/claim`) | Trả `404`; quyền `crm.customer.view_all`, `crm.customer.assign` đã xóa |
| Thêm | `GET /crm/visit-options` | Cần `crm.access` hoặc `crm.partner.view` như mục 2c. Trả `VisitStaffOptionsResponse` `{ "users": [ { "id": "…", "fullName": "…" } ] }`: nhân viên đang làm việc (thành viên, tài khoản đang hoạt động) của công ty đang làm việc, sắp theo tên. Thay `GET /crm/customer-assignment-options` cho lọc nhân viên ở màn hình Ghé thăm |
| Sửa | API_56 | Gửi lên, trả về thêm `kind` (`goods`, `service`; mặc định `goods`) |
| Sửa | API_65 | Chi tiết phiếu thêm `isService` (phiếu dịch vụ tự lập, chỉ xem) |
| Sửa | API_71, API_72, API_77, API_78, API_79, API_80, API_81 | Như các dòng "Sửa theo THAY_DOI_18" ở mục 3c, 3e, 3f |
| Sửa | `GET /crm/partners/{id}/summary` (API_113), `/crm/visits` (API_114) | Không còn lọc theo phạm vi xem; người có quyền xem mọi khách, mọi lượt của công ty |

Lỗi mới:

| Khóa | Mã HTTP | Nơi trả | Thông báo |
|---|---|---|---|
| `manualOrderServicesOnly` | `409 BUSINESS_RULE` | API_77 lưu, gửi đơn bán lập tay | "Đơn bán lập tay chỉ gồm mặt hàng dịch vụ. Hàng hóa bán qua sàn VComm." |
| `internalServicesOnly` | `400` tại `lines.{i}.variantId` | API_77, API_75 đơn nội bộ | "Giao dịch nội bộ chỉ gồm mặt hàng dịch vụ." |
| `serviceNotStocked` | `400` tại `lines.{i}.variantId` (phiếu kho), tại `scopeIds` (kiểm kê theo danh sách mặt hàng); `409 BUSINESS_RULE` (giữ hàng, thẻ kho) | API_65, API_67, API_68, API_76, API_79 | "Mặt hàng dịch vụ không theo dõi tồn kho: không lập phiếu kho, giữ hàng, kiểm kê." |
| `serviceNoTracking` | `400` tại `tracksLots`, `tracksSerials` | API_56 | "Dịch vụ không theo dõi lô, số serial." |
| `productKindLocked` | `409 BUSINESS_RULE` | API_56 `PATCH` đổi `kind` | "Sản phẩm đã phát sinh tồn kho, chứng từ kho; không đổi loại được." |

Sự kiện: không phát, không nghe sự kiện outbox mới. Phiếu dịch vụ lập qua móc nối `SalesOrdersService.confirmedHooks`, `PurchaseOrdersService.approvedHooks` trong giao dịch xác nhận, duyệt đơn.

## 3w. Hợp đồng chi tiết Nhân sự phần 1 (MODULE_08, CONG_VIEC_46)

Mọi đường dẫn dưới `/api/v1/hr`, cần đăng nhập, công ty đang chọn qua `x-company-id`; trừ `/hr/me*`, mọi đường dẫn cần `hr.access`. Lược đồ zod trong `packages/contracts` (mục CONG_VIEC_46). Lỗi theo mục 1.

| Mã | Phương thức, đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| API_144 | `GET /hr/employee-options`; `GET /hr/employees`; `GET /hr/employees/{id}`; `POST /hr/employees`; `PATCH /hr/employees/{id}`; `POST /hr/employees/{id}/reveal`; `POST /hr/employees/{id}/terminate` | Xem: `hr.employee.view`; ghi, nghỉ việc: `hr.employee.manage`; hiện số: `hr.identity.view` | Tùy chọn (phòng ban, chi nhánh, thành viên chưa có hồ sơ), danh sách phân trang (tìm, lọc phòng ban, chi nhánh, trạng thái), chi tiết (số che), lập, sửa (trường mã hóa bỏ trống là giữ), hiện một trường (`{field}` → `{value}`, ghi nhật ký), nghỉ việc (`204`) |
| API_145 | `GET`, `POST /hr/employees/{id}/documents` (multipart `file`, `kind`, `consentDate`); `GET /hr/documents/{id}` | Xem danh sách: `hr.employee.view`; tải lên: `hr.employee.manage`; tải xuống: `hr.identity.view` | PDF, JPG, PNG tối đa 10 MB, kiểm chữ ký đầu tệp; tải xuống `cache-control: no-store`, ghi nhật ký |
| API_146 | `GET`, `POST /hr/employees/{id}/dependents`; `PATCH /hr/employees/{id}/dependents/{dependentId}`; `GET`, `POST /hr/employees/{id}/work-events`; `PATCH`, `DELETE /hr/employees/{id}/work-events/{eventId}` | Xem: `hr.employee.view`; ghi: `hr.employee.manage` | Người phụ thuộc (tháng giảm trừ là ngày 01); quyết định công tác (sửa, xóa khi chưa hiệu lực và nhập tay) |
| API_147 | `GET /hr/contracts` (`employeeId`, `search`, `kind`, `status`, `expiring`, phân trang); `GET /hr/contracts/{id}`; `POST /hr/contracts`; `PATCH /hr/contracts/{id}`; `POST /hr/contracts/{id}/submit`, `/withdraw`, `/sign` (multipart `signDate`, `file`), `/cancel` (`reason`), `/terminate` (`terminationDate`, `reason`, `note`); `GET /hr/contracts/{id}/signed-file` | Xem: `hr.employee.view` (không có lương); ghi, xem lương: `hr.contract.manage`; tải bản đã ký: `hr.identity.view` | Trả giá trị gốc, giá trị hiện hành sau phụ lục, tình trạng hiệu lực, số ngày đến hạn, nhãn quá 30 ngày |
| API_148 | `POST /hr/contracts/{id}/appendices`; `PATCH /hr/contracts/{id}/appendices/{appendixId}`; `POST .../{appendixId}/submit`, `/withdraw`, `/sign`, `/cancel`; `GET .../{appendixId}/signed-file` | `hr.contract.manage`; tải: `hr.identity.view` | Phụ lục không có trường thời hạn; trả lại hợp đồng đầy đủ |
| API_149 | `GET /hr/me`; `POST /hr/me/reveal`; `GET /hr/me/contracts`; `GET /hr/me/contracts/{id}/signed-file?appendixId=` | Thành viên công ty có hồ sơ liên kết | Hồ sơ, quá trình công tác, hợp đồng và phụ lục đã ký của chính mình (kèm lương); không có hồ sơ trả `404` |

Sự kiện: không phát sự kiện mới; nghe `core.approval.completed` (loại `hr.contract`, `hr.contract_appendix`). Thông báo mới: `hr.employee.terminated`, `hr.contract.expiring`.

## 3x. Hợp đồng chi tiết Nhân sự phần 2 (MODULE_08, CONG_VIEC_47)

Mọi đường dẫn dưới `/api/v1/hr`, cần đăng nhập, công ty đang chọn qua `x-company-id`. "Phạm vi xem" = quyền `hr.attendance.view` (hoặc quyền chấm công khác) bao trùm công ty, hoặc trưởng phòng với phòng mình và phòng con. Lược đồ zod trong `packages/contracts` (mục CONG_VIEC_47). Lỗi theo mục 1.

| Mã | Phương thức, đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| API_150 | `GET`, `PUT /hr/attendance/settings`; `GET`, `POST /hr/attendance/shifts`, `PATCH .../shifts/{id}`; `GET`, `POST /hr/attendance/schedules`, `PATCH .../schedules/{id}`, `POST .../schedules/{id}/assignments`; `GET`, `PUT /hr/attendance/roster`; `GET`, `POST /hr/attendance/holidays`, `POST .../holidays/generate`, `DELETE .../holidays/{id}`; `GET`, `POST /hr/attendance/locations`, `PATCH .../locations/{id}`, `GET .../locations/{id}/qr` | Xem: phạm vi xem; ghi: `hr.attendance.manage` (ngày lễ chung: gán ở tập đoàn); xếp ca: thêm trưởng phòng | Cài đặt có `version`; xếp ca kiểm 48 (40) giờ tuần, cảnh báo 12 giờ nghỉ; mã QR trả mã, hạn, đường dẫn |
| API_151 | `GET /hr/attendance/grid?month=`; `GET /hr/attendance/days/{employeeId}/{date}`; `POST /hr/attendance/punches`, `POST .../punches/{id}/delete`; `PUT /hr/attendance/codes/{employeeId}`; `POST /hr/attendance/recalculate`; `GET /hr/attendance/imports`, `GET .../imports/template`, `POST /hr/attendance/imports` (multipart `file`, `confirm`) | Xem: phạm vi xem; ghi: `hr.attendance.manage` | Nhập tệp xem trước rồi xác nhận; lỗi theo số dòng của tệp; kỳ đã chốt trả `409 timesheetClosed` |
| API_152 | `GET /hr/me/attendance`; `POST /hr/me/attendance/punch` (`latitude`, `longitude`, `accuracyMeters` hoặc `locationId`, `qrToken`); `GET /hr/me/attendance/month`, `/week`; `GET`, `POST /hr/me/attendance/corrections` (multipart), `POST .../corrections/{id}/withdraw`; `GET /hr/attendance/corrections`, `GET .../corrections/{id}/attachment` | Người có hồ sơ liên kết; danh sách đơn: phạm vi xem | Ưu tiên mã QR → mạng công ty → GPS (độ chính xác ≤ 100 m); tệp PDF, JPG, PNG ≤ 5 MB |
| API_153 | `GET`, `POST /hr/leave/types`, `PATCH .../types/{id}`; `GET /hr/leave/balances`, `GET .../balances/{employeeId}`; `PUT /hr/leave/policies/{employeeId}`; `POST /hr/leave/adjustments`; `GET /hr/leave/requests`, `POST /hr/leave/preview`, `POST /hr/leave/requests` (multipart), `POST .../requests/{id}/cancel`, `GET .../requests/{id}/attachment`; `GET /hr/me/leave`, `/hr/me/leave/ledger`, `POST /hr/me/leave/preview`, `POST /hr/me/leave/requests`, `POST .../{id}/withdraw`, `/cancel` | Xem: phạm vi xem; ghi nhận, sổ phép, loại: `hr.leave.manage`; `/hr/me/*`: chính mình | Xem trước trả số ngày theo lịch, số dư |
| API_154 | `GET /hr/overtime?month=&status=`; `GET /hr/overtime/totals?month=`; `POST /hr/overtime/preview`; `POST /hr/overtime` (JSON hoặc multipart `file` văn bản đồng ý); `POST /hr/overtime/{id}/cancel`; `GET /hr/me/overtime`; `POST /hr/me/overtime/preview`, `POST /hr/me/overtime`, `POST .../{id}/consent` (`agree`), `/withdraw`, `/cancel` | Xem, lập: phạm vi xem (trưởng phòng hoặc `hr.attendance.manage`); tệp, hủy sau giờ bắt đầu: `hr.attendance.manage`; `/hr/me/*`: chính mình | Xem trước trả loại ngày, giờ, giờ đêm, giới hạn ngày, tháng, năm và danh sách vi phạm; vi phạm trả `409` |
| API_155 | `GET /hr/timesheets/{YYYY-MM}`; `POST .../open-confirmation` (`deadline`); `POST .../lines/{employeeId}/reply` (`reply`); `POST .../close`; `POST .../reopen` (`reason`); `GET .../export` (xlsx); `GET /hr/me/timesheets/{YYYY-MM}`, `POST .../confirm`, `POST .../dispute` (`note`) | Xem, xuất: phạm vi xem; thao tác: `hr.timesheet.manage`; `/hr/me/*`: chính mình | Lỗi `timesheetMonthNotEnded`, `timesheetHasDisputes`, `timesheetNotClosed`, `timesheetPayrollLocked`, `timesheetNotConfirming` |

Sự kiện mới: `hr.timesheet.closed`, `hr.timesheet.reopened` (`periodId`, `companyId`, `year`, `month`). Nghe `core.approval.completed` (loại `hr.leave_request`, `hr.overtime_request`, `hr.attendance_correction`). Thông báo mới: `hr.overtime.consent`, `hr.timesheet.confirm`, `hr.timesheet.reply`, `hr.timesheet.changed`, nhắc vượt 200 giờ tăng ca.
## 3x. Hợp đồng chi tiết Nhân sự phần 3 – Lương (MODULE_08, CONG_VIEC_48)

Mọi đường dẫn dưới `/api/v1/hr`, cần đăng nhập, công ty đang chọn qua `x-company-id`; trừ `/hr/me/payslips*`, mọi đường dẫn cần `hr.access`. Lược đồ zod trong `packages/contracts` (mục CONG_VIEC_48). Lỗi theo mục 1.

| Mã | Phương thức, đường dẫn | Quyền | Nội dung |
|---|---|---|---|
| API_156 | `GET /hr/payroll-settings`; `POST /hr/payroll-parameters`; `PATCH`, `DELETE /hr/payroll-parameters/{id}`; `PUT /hr/payroll-settings/company`, `/branches`, `/departments` | Xem: `hr.payroll.view`, `hr.payroll.manage` hoặc `hr.payroll.setup`; sửa: `hr.payroll.setup` (tham số pháp luật: gán ở phạm vi tập đoàn) | Tham số pháp luật theo ngày hiệu lực (bộ đã dùng: `409` payrollParametersUsed), thiết lập công ty, vùng chi nhánh, nhóm chi phí phòng ban |
| API_157 | `GET`, `POST /hr/allowance-types`; `PATCH /hr/allowance-types/{id}` | Xem: quyền lương hoặc `hr.contract.manage`; sửa: `hr.payroll.setup` | Loại phụ cấp. Thay đổi API_147, API_148: dòng phụ cấp có `allowanceTypeId` (bắt buộc khi lưu), phản hồi thêm `allowanceTypeName` |
| API_158 | `GET`, `PUT /hr/employees/{id}/payroll-profile`; `POST /hr/employees/{id}/insurance-salaries`; `DELETE /hr/employees/{id}/insurance-salaries/{salaryId}`; `POST /hr/employees/{id}/tax-commitments` (multipart `file`, `year`); `GET /hr/employees/{id}/tax-commitments/{commitmentId}`; `GET /hr/payroll-profiles/missing-insurance` | `hr.payroll.manage` | Lương đóng bảo hiểm, miễn đóng, cách tính thuế, cam kết 08/CK-TNCN |
| API_159 | `GET /hr/payrolls` (`year`, `status`); `POST /hr/payrolls` (`month`); `GET /hr/payrolls/{id}` (`departmentId`, `warningsOnly`); `GET /hr/payrolls/{id}/lines/{lineId}`; `GET /hr/payrolls/{id}/export`; `POST /hr/payrolls/{id}/recalculate` | Xem: `hr.payroll.view`; lập, tính lại: `hr.payroll.manage` | Bảng lương tháng, dòng lương và giải trình, xuất Excel |
| API_160 | `POST`, `PATCH`, `DELETE /hr/payrolls/{id}/adjustments[/{adjustmentId}]`; `POST /hr/payrolls/{id}/submit`, `/withdraw`, `/cancel` (`reason`), `/pay` (`paymentDate`, `fundId`), `/send-payslips` | `hr.payroll.manage`; rút: người gửi | Khoản nhập tay, luồng duyệt, hủy, ghi đã trả lương, gửi lại email phiếu lương. Lỗi: timesheetNotClosed, payrollBlockingWarnings, ledgerNotInitialized, periodLocked, payrollNotApproved |
| API_161 | `GET /hr/me/payslips`; `GET /hr/me/payslips/{lineId}` | Thành viên công ty có hồ sơ liên kết | Phiếu lương của chính mình (bảng lương đã duyệt, đã trả); phiếu của người khác `404` |

Sự kiện: không phát sự kiện mới; nghe `core.approval.completed` (loại `hr.payroll`). Thông báo mới: `hr.payslip.issued`. Email phiếu lương gửi tới email cá nhân của hồ sơ.
## 3w. Hợp đồng ứng dụng kho (MODULE_03, CONG_VIEC_44)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (`addStocktakeCountsSchema`, `stocktakeCountEntryQuerySchema`, `StocktakeCountEntry`, `StocktakeResponse`).

- API_137 `POST /auth/warehouse-app/login` (`200`): thân như API_01 (`identifier`, `password`); trả `AppLoginResponse` như API_112 (token trong thân, không đặt cookie); phiên `client_type` `warehouse_app`, token làm mới 90 ngày. Làm mới `POST /auth/app/refresh`; xác thực hai lớp `POST /auth/mfa/verify`; đăng xuất API_10, đều bằng header Authorization. Sai thông tin như API_01 (`401`). Không có `inventory.access` ở công ty nào: thu hồi phiên vừa tạo, `403 FORBIDDEN` khóa `warehouseAppNoAccess`.
- API_138 `POST /inventory/stocktakes/{id}/count-additions` (`200`): thân `{ "additions": [ { "variantId", "lotId" (mặc định null), "locationId" (mặc định null), "quantity" (số có dấu theo đơn vị cơ sở, 4 chữ số lẻ; hàng serial bỏ qua), "serials" (thêm), "removedSerials" (bỏ) } ] }`, 1 đến 500 phần tử. Kiểm như API_67 lưu số đếm (mặt hàng của chủ hàng, vị trí theo kho, lô của mặt hàng; hàng theo lô phải có lô); hàng không serial: `quantity` khác 0, không gửi serial; hàng serial: có serial thêm hoặc bỏ, không lặp. Một giao dịch khóa đợt (`FOR UPDATE`), tìm hoặc thêm dòng (tồn sổ sách 0, giá vốn bình quân hiện hành), cộng số đếm, ghi `inventory.stocktake_count_entries`, tăng `version`. Trả `StocktakeResponse` theo quyền người gọi.
- API_139 `GET /inventory/stocktakes/{id}/count-entries?mine=true|false` (`200`): `StocktakeCountEntry[]` mới nhất trước, tối đa 200: `id`, `lineId`, `variantId`, `sku`, `productName`, `lotNo`, `locationCode`, `quantity`, `addedSerials`, `removedSerials`, `countedById`, `countedByName`, `countedAt`.
- Sửa API_67 `GET /inventory/stocktakes/{id}`: thêm `canCount`; người không có `inventory.stocktake.manage` tại kho nhận `systemQuantity`, `difference`, `differenceValue` là `null`, chỉ nhận dòng đã có số đếm (QUYTAC_NGHIEPVU_283). `systemQuantity` đổi kiểu thành `string | null`.
- Sửa `GET /inventory/sales-orders` (đơn bán chờ xuất, CONG_VIEC_08): mỗi dòng thêm `warehouseId`.

Lỗi mới:

| Khóa | Mã HTTP | Nơi trả | Thông báo |
|---|---|---|---|
| `warehouseAppNoAccess` | `403 FORBIDDEN` | API_137 | "Tài khoản không có quyền dùng ứng dụng kho." |
| `stocktakeCountNegative` | `400` tại `additions.{i}.quantity` | API_138 | "Số đếm sau khi cộng không được âm." |
| `stocktakeSerialCounted` | `400` tại `additions.{i}.serials` | API_138 | "Serial đã được đếm ở dòng khác của đợt kiểm kê." |

Sự kiện: không phát, không nghe sự kiện outbox mới.
## 3w. Hợp đồng chi tiết báo cáo quản trị (MODULE_15 phần 1, CONG_VIEC_50)

Lược đồ, kiểu trong `packages/contracts/src/index.ts` (phần CONG_VIEC_50); tham số thừa bị từ chối (`400`). Tiền, số lượng trả về dạng chuỗi số thập phân, bỏ số 0 thừa, làm tròn theo số lẻ của đồng tiền; tiền của từng dòng theo đồng tiền hạch toán của công ty (`currency`), `inTotal` cho biết dòng có cộng vào dòng tổng hay không (chỉ công ty cùng đồng tiền với công ty gốc, QUYTAC_NGHIEPVU_339); `currency` của báo cáo là đồng tiền công ty gốc. Ngày `YYYY-MM-DD`.

Tham số chung:
- `companyIds`: danh sách UUID cách nhau bằng dấu phẩy, tối đa 100, không bắt buộc; bỏ trống là mọi công ty được xem của nhóm báo cáo. Có công ty ngoài phạm vi thì từ chối cả yêu cầu (`403`), không trả số liệu một phần (QUYTAC_NGHIEPVU_336).
- `from`, `to`: bắt buộc ở API_171, API_172, API_174, API_175; `from` không sau `to`; tối đa 366 ngày (QUYTAC_NGHIEPVU_343).
- `format`: `json` (mặc định) hoặc `xlsx`. `xlsx` trả tệp Excel cùng bộ lọc, đúng số của `json` nhưng không cắt 500 dòng; `content-type` Excel, `content-disposition` `attachment`; tổng số dòng các bảng quá 20.000 thì `409`. Mỗi lần xuất ghi nhật ký thao tác `analytics.<sales|inventory|debt|commission>.export` (đối tượng `analytics_report`, bộ lọc, số dòng).
- Bảng chi tiết `json` hiện tối đa 500 dòng xếp theo số tiền giảm dần; `totalRows` là số dòng có dữ liệu khi bị cắt, `null` khi hiện đủ; dòng tổng luôn tính trên toàn bộ dữ liệu.

### API_170 Phạm vi xem
- `GET /analytics/scope` (`200`), `AnalyticsScopeResponse`:
```json
{ "group": { "id": "…", "name": "VComm", "currency": "VND" }, "today": "2026-11-11",
  "companies": [ { "id": "…", "code": "VCR", "name": "VComm Bán lẻ", "currency": "VND", "inTotal": true } ],
  "reports": { "sales": ["…"], "inventory": ["…"], "debt": [], "commission": [] } }
```
- `companies`: công ty được xem ở ít nhất một nhóm, công ty gốc trước rồi theo mã. `reports`: công ty được xem theo từng nhóm; mảng rỗng khi không có quyền nhóm đó.

### API_171 Báo cáo bán hàng
- `GET /analytics/sales` (`200`), lược đồ `analyticsSalesQuerySchema`: `companyIds`, `from`, `to`, `groupBy` (`company` mặc định, `channel`, `product`, `day`, `month`), `channelId` (UUID, không bắt buộc), `marketplaceOnly` (`true`, `false` mặc định), `format`. Tính theo QUYTAC_NGHIEPVU_337, QUYTAC_NGHIEPVU_338. Trả `AnalyticsSalesResponse`:
```json
{ "from": "2026-11-01", "to": "2026-11-11", "groupBy": "company", "currency": "VND", "companies": [ … ], "channels": [ { "id": "…", "label": "VComm" } ],
  "rows": [ { "key": "…", "label": "VCR · VComm Bán lẻ", "currency": "VND", "inTotal": true, "quantity": "5", "revenue": "509091", "cost": "300000", "grossProfit": "209091", "internalRevenue": "0" } ],
  "totals": { "quantity": "5", "revenue": "509091", "cost": "300000", "grossProfit": "209091", "internalRevenue": "0", "revenueExcludingInternal": "509091" },
  "totalRows": null }
```
- `revenue`: doanh số chưa thuế; `internalRevenue`: trong đó bán nội bộ; `revenueExcludingInternal`: tổng loại trừ nội bộ (trừ phần bán cho mọi công ty thuộc tập đoàn, kể cả công ty không nằm trong bộ lọc). Tên tệp Excel `bao-cao-ban-hang-<from>-<to>.xlsx`.

### API_172 Báo cáo tồn kho và luân chuyển
- `GET /analytics/inventory` (`200`), lược đồ `analyticsInventoryQuerySchema`: `companyIds`, `warehouseId` (UUID, không bắt buộc; kho phải thuộc công ty được xem, khác thì `403`), `from`, `to`, `groupBy` (`company`, `warehouse` mặc định, `product`), `format`. Tính theo QUYTAC_NGHIEPVU_340. Trả `AnalyticsInventoryResponse`: `from`, `to`, `days` (số ngày của kỳ), `groupBy`, `currency`, `companies`, `warehouses[]` (`id`, `label`), `rows[]` (`key`, `label`, `currency`, `inTotal`, `openingQuantity`, `openingValue`, `inQuantity`, `inValue`, `outQuantity`, `outValue`, `closingQuantity`, `closingValue`, `costOfSales`, `turnover`, `daysOfInventory`), `totals` (chỉ giá trị: `openingValue`, `inValue`, `outValue`, `closingValue`, `costOfSales`, `turnover`, `daysOfInventory`; số lượng không cộng vì khác đơn vị), `totalRows`.
- `turnover`, `daysOfInventory` là `null` khi tồn bình quân hoặc giá vốn bằng 0. Tên tệp Excel `bao-cao-ton-kho-<from>-<to>.xlsx`.

### API_173 Công nợ theo tuổi nợ
- `GET /analytics/debts` (`200`), lược đồ `analyticsDebtQuerySchema`: `companyIds`, `side` (`receivable` mặc định, `payable`), `groupBy` (`company` mặc định, `partner`), `format`; không có khoảng ngày (tính tại hôm nay, QUYTAC_NGHIEPVU_341). Trả `AnalyticsDebtResponse`: `today`, `side`, `groupBy`, `currency`, `companies`, `summary` (`receivable`, `payable`: `balance`, `overdue` của các công ty cùng đồng tiền với công ty gốc), `rows[]` (`key`, `label`, `currency`, `inTotal`, `balance`, `notDue`, `overdue1To30`, `overdue31To60`, `overdue61To90`, `overdueOver90`, `advance`, `internalBalance`), `totals` (các số trên và `balanceExcludingInternal`), `totalRows`.
- Tuổi nợ dùng hàm dùng chung với sổ công nợ (API_85), cùng kết quả. Tên tệp Excel `bao-cao-cong-no-phai-thu-<hôm nay>.xlsx` hoặc `bao-cao-cong-no-phai-tra-<hôm nay>.xlsx`.

### API_174 Hoa hồng và ví
- `GET /analytics/commissions` (`200`), lược đồ `analyticsCommissionQuerySchema`: `companyIds`, `from`, `to`, `groupBy` (`share` mặc định, `beneficiary`), `format`. Tính theo QUYTAC_NGHIEPVU_342. Trả `AnalyticsCommissionResponse`:
```json
{ "from": "2026-11-01", "to": "2026-11-11", "groupBy": "share", "currency": "VND", "companies": [ … ],
  "summary": { "credited": "22727", "creditedLines": 1, "pending": "11364",
               "paid": { "count": 1, "amount": "200000", "taxAmount": "0", "feeAmount": "5000", "netAmount": "195000" },
               "pendingWithdrawals": { "count": 1, "amount": "100000" }, "walletBalance": "150000" },
  "rows": [ { "key": "referral", "label": "Giới thiệu", "lines": 1, "amount": "22727" } ],
  "withdrawals": [ { "id": "…", "userName": "Nguyễn Văn A", "paidOn": "2026-11-10", "amount": "200000", "taxAmount": "0", "feeAmount": "5000", "netAmount": "195000" } ],
  "totalRows": null }
```
- `rows[].key`: loại phần hưởng (`referral`, `staff`, `team_head`, `regional_director`, `director`) hoặc mã người hưởng. `walletBalance`: `null` khi công ty vận hành VComm không nằm trong các công ty đã chọn. Người hưởng chỉ có họ tên, không trả số điện thoại, tài khoản ngân hàng. Tệp Excel gồm bảng hoa hồng và bảng rút tiền đã chi, tên `bao-cao-hoa-hong-<from>-<to>.xlsx`.

### API_175 Tổng quan
- `GET /analytics/overview` (`200`), lược đồ `analyticsOverviewQuerySchema`: `companyIds`, `from`, `to`. Với mỗi nhóm, chỉ tính trên công ty đã chọn được xem ở nhóm đó. Trả `AnalyticsOverviewResponse`: `from`, `to`, `currency`, `sales` (`rows` theo công ty, `totals` như API_171), `inventory` (`totals` như API_172), `debt` (`summary` như API_173), `commission` (`credited`, `pending`, `walletBalance` như API_174); nhóm không có quyền hoặc không có công ty đã chọn được xem là `null`.

Lỗi chung API_170 đến API_175:

| Khóa | Mã HTTP | Nơi trả | Thông báo |
|---|---|---|---|
| `required` | `400 VALIDATION_FAILED` tại `from`, `to` | API_171, API_172, API_174, API_175 | "Vui lòng nhập thông tin này." |
| `analyticsPeriodReversed` | `400 VALIDATION_FAILED` tại `to` | API_171, API_172, API_174, API_175 | "Từ ngày không được sau đến ngày." |
| `analyticsPeriodTooLong` | `400 VALIDATION_FAILED` tại `to` | API_171, API_172, API_174, API_175 | "Khoảng ngày tối đa 366 ngày. Hãy thu hẹp khoảng ngày." |
| `invalidValue` | `400 VALIDATION_FAILED` | Mọi API (tham số sai kiểu, tham số thừa, `companyIds` không phải UUID) | "Giá trị không hợp lệ." |
| `forbidden` | `403 FORBIDDEN` | Mọi API (không có `analytics.access` hoặc quyền nhóm báo cáo; `companyIds` chứa công ty ngoài phạm vi; `warehouseId` ngoài phạm vi) | "Bạn không có quyền thực hiện thao tác này." |
| `analyticsExportTooLarge` | `409 BUSINESS_RULE` | API_171 đến API_174 với `format=xlsx` | "Quá 20.000 dòng. Hãy thu hẹp bộ lọc rồi xuất lại." |

Sự kiện: không phát, không nghe sự kiện outbox.
## 3y. Hợp đồng chi tiết Văn phòng số (MODULE_13 phần 1, CONG_VIEC_52)

Lược đồ, kiểu trong `packages/contracts/src/office.ts`. Mọi endpoint cần `office.access` ở công ty đang chọn; người tham gia việc ở công ty khác trong tập đoàn gọi với công ty của mình. Việc không xem được trả `404`.

| Endpoint | Gửi lên | Trả về, quy tắc |
|---|---|---|
| `GET /office/people?search=` | `search` 1 đến 100 ký tự | Tối đa 20 `OfficePerson` (`id`, `fullName`, `companyId`, `companyName`, `departmentName`): người đang hoạt động, thành viên công ty trong tập đoàn; tìm theo họ tên, email nhưng không trả email |
| `GET /office/tasks` | `view` (`mine`, `assigned`, `following`, `company`), `status` (trạng thái, `open`, `all`; mặc định `open`), `due` (`overdue`, `today`, `week`), `priority`, `search`, `page`, `pageSize` | Trang `OfficeTaskListItem`; `mine` gồm việc chủ trì, phối hợp ở mọi công ty; `company` cần `office.task.view_all` bao trùm công ty (không thì `403`) |
| `POST /office/tasks` | `title`, `description`, `ownerUserId`, `collaboratorIds`, `followerIds` (tối đa 20), `startDate`, `dueAt` (ISO 8601 có múi giờ), `priority`, `parentId` | `201 OfficeTaskResponse` (thêm `allowedActions`). Lỗi: `400` tại trường khi người ngoài tập đoàn (`officeParticipantOutsideGroup`), hạn trước ngày bắt đầu (`officeDueBeforeStart`), việc con hạn sau việc cha (`officeSubtaskDueAfterParent`); `400 officeParticipantDuplicate`; `409 officeSubtaskDepth`, `officeTaskClosed` |
| `PATCH /office/tasks/{id}` | Như lập, bỏ `parentId`, thêm `version` | Chỉ người giao (`403`); việc xong, hủy `409 officeTaskClosed`; sai phiên bản `409 CONFLICT_VERSION`; đổi hạn thì nhắc lại từ đầu |
| `POST /office/tasks/{id}/transition` | `action` (`start`, `report_done`, `confirm`, `return`, `cancel`), `reason` (bắt buộc với `return`, `cancel`), `version` | QUYTAC_NGHIEPVU_356, 358; thao tác không hợp lệ với người giao, chủ trì `409 officeTaskActionInvalid`, người khác `403`; còn việc con chưa xong `409 officeSubtasksOpen` |
| `POST /office/tasks/{id}/progress` | `progress` 0 đến 100, `version` | Chỉ chủ trì khi việc mới hoặc đang làm |
| `GET /office/tasks/{id}/history` | | `OfficeTaskEvent[]` mới nhất trước |
| `…/comments` | `body` 1 đến 5.000 ký tự | `OfficeTaskComment[]`; xóa trả bình luận `deleted`, `body` rỗng |
| `…/files` | multipart `file` tối đa 20 MB; PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, TXT, ZIP (kiểm chữ ký đầu tệp) | `OfficeFileItem[]`; lỗi `400` tại `file` (`officeFileTooLarge`, `officeFileTypeInvalid`); tải xuống `content-disposition: attachment`, `x-content-type-options: nosniff` |

| `POST /office/tasks/{id}/transition` (việc của bước quy trình) | `action` thêm `claim` (người giữ vai trò ứng viên nhận việc); `report_done` bắt buộc `outcome` là một kết quả của bước | Báo xong là hoàn thành ngay, xét quy tắc chuyển trong cùng giao dịch; việc của bước không sửa, không hủy riêng; thiếu hoặc sai kết quả `400` tại `outcome` |
| `GET /office/workflow-design-options` | | `WorkflowDesignOptions`: vai trò dùng được ở công ty, phòng ban đang dùng |
| `POST /office/workflow-templates`, `PATCH /office/workflow-templates/{id}` | `name`, `description`, `definition` (`WorkflowDefinition`: `fields`, `steps`, `firstStepKey`, `starterDepartmentIds`), `version` khi sửa | `WorkflowTemplateResponse` kèm `issues` (lỗi kiểm tra hợp lệ theo bước). Mẫu đang dùng chưa có nháp thì sửa tạo phiên bản nháp mới |
| `POST /office/workflow-templates/{id}/activate` | | Bản nháp còn lỗi `409 workflowInvalid`; không có nháp và không ngừng dùng `409 workflowNothingToActivate`; bản đang dùng cũ chuyển `retired` |
| `POST /office/workflow-templates/{id}/deactivate` | | Chỉ khi đang dùng (`409 workflowNotActive`); phiên đang chạy chạy tiếp |
| `GET /office/workflow-start-options` | | Mẫu đang dùng mà người dùng được khởi tạo (không giới hạn phòng ban hoặc phòng ban của mình trong danh sách) |
| `POST /office/workflow-runs` | `templateId`, `title`, `values` | `201 WorkflowRunResponse`; lỗi biểu mẫu `400` tại `values.<khóa>`; mẫu không được khởi tạo `404` |
| `GET /office/workflow-runs` | `scope` (`mine`, `involved`, `company`), `status`, `page`, `pageSize` | `company` cần `office.task.view_all` hoặc `office.workflow.manage` (`403`) |
| `POST /office/workflow-runs/{id}/assign` | `stepInstanceId`, `userId`, `version` | Lượt bị chặn do không có người thực hiện; chặn do quá 100 bước `409 workflowStepLimit` |
| `POST /office/workflow-runs/{id}/cancel` | `reason`, `version` | Hủy các việc đang mở; phiên đã kết thúc `409 workflowRunClosed` |

Thông báo trong ứng dụng (`core.notifications`, đường dẫn `/office/tasks/{id}`): `office_task_assigned`, `office_task_status`, `office_task_comment`, `office_task_due_soon`, `office_task_overdue`; quy trình (đường dẫn `/office/workflow-runs/{id}`): `office_workflow_blocked`, `office_workflow_completed`. Không phát, không nghe sự kiện outbox mới. Tác vụ nền `office-task-reminders` mỗi 15 phút.

Công văn (lát L2, Nghị định 30/2020/NĐ-CP):

| Endpoint | Gửi lên | Trả về, quy tắc |
|---|---|---|
| `GET /office/document-options` | | `DocumentOptions`: sổ, loại văn bản, phòng ban, công ty khác trong tập đoàn, lãnh đạo có `office.document.direct`, thể thức, `canClerk`; lần đầu tạo sổ mặc định, 29 loại văn bản, thể thức mặc định |
| `PUT /office/document-settings` | `DocumentSettings` (tên cơ quan chủ quản, tên cơ quan ban hành, chữ viết tắt `^[A-ZĐ0-9]{1,20}$`, địa danh, cỡ chữ 13 hoặc 14, lề trang mm), `version` | Lỗi khoảng lề `400` tại ô |
| `POST /office/registers`, `PATCH /office/registers/{id}` | `name`, `direction`; sửa: `name`, `status`, `version` | Trùng tên `409 officeRegisterDuplicate`; ngừng sổ mặc định `409 officeDefaultRegister` |
| `GET /office/registers/{id}/export?year=` | | Tệp Excel sổ công văn của năm (cột theo Nghị định 30) |
| `POST /office/document-types` | `name`, `abbreviation` | Trùng `409 officeDocumentTypeDuplicate` |
| `POST /office/incoming` | multipart: `data` (JSON `registerIncomingSchema`: sổ, ngày đến, nơi gửi, số ký hiệu, ngày văn bản, loại, trích yếu, độ khẩn, hạn, hình thức nhận), `files` (bản quét PDF, JPG, PNG, bắt buộc) | `201 IncomingResponse`, số đến tiếp theo của sổ trong năm; sai loại tệp `400 officeScanTypeInvalid`; trả kèm `duplicateOf` khi trùng nơi gửi, số ký hiệu, ngày văn bản |
| `GET /office/incoming` | `registerId`, `year`, `status` (thêm `awaiting_registration` cho bản liên công ty), `urgency`, `search`, `page`, `pageSize` | Trang `IncomingListItem`; văn thư, `office.document.view_all` xem tất cả; người khác chỉ công văn mình là lãnh đạo, người được chuyển, người tham gia việc xử lý |
| `PATCH /office/incoming/{id}` | Như vào sổ bỏ `registerId`, thêm `version` | Chỉ khi đã vào sổ, chưa trình (`409 officeIncomingLocked`) |
| `POST /office/incoming/{id}/accept` | `registerId`, `receivedOn`, `version` | Vào sổ bản chờ (gửi từ công ty khác trong tập đoàn) |
| `POST /office/incoming/{id}/submit` | `leaderUserId`, `note`, `version` | Lãnh đạo phải có `office.document.direct` (`400 officeNotLeader`); thông báo lãnh đạo |
| `POST /office/incoming/{id}/direct` | `action` (`assign`: `ownerUserId`, `collaboratorIds`, `dueAt`; `forward`: `leaderUserId`; `archive`), `note`, `version` | Chỉ lãnh đạo đang được trình; `assign` tạo công việc gắn `incoming_document_id`, công việc hoàn thành thì công văn `processed`, công việc hủy thì quay lại `awaiting_direction` |
| `POST /office/incoming/{id}/void` | `reason`, `version` | Số đến giữ nguyên, không dùng lại |
| `POST /office/outgoing`, `PATCH /office/outgoing/{id}` | `saveOutgoingSchema`: sổ, loại văn bản, đơn vị soạn, trích yếu, độ khẩn, `composeMode` (`compose`, `upload`), `recipientLine` (công văn), `body` (đoạn, gạch đầu dòng), người ký, thẩm quyền ký (`TM.`, `KT.`, `TL.`, `TUQ.`, `Q.`), chức vụ, nơi nhận ngoài, nơi nhận trong tập đoàn, số bản, ký hiệu người soạn, `replyToIncomingId`, `version` khi sửa | Sửa khi nháp, bị từ chối, đã rút (`409 officeOutgoingLocked`); người ký không thuộc công ty `400 officeSignerInvalid` |
| `POST /office/outgoing/{id}/submit` | `version` | Có chính sách duyệt loại `office.outgoing_document` thì trình qua luồng duyệt chung (`approvalMode` `policy`); không có thì người ký quyết định (`signer`); tải dự thảo thì cần tệp dự thảo |
| `POST /office/outgoing/{id}/decide` | `decision`, `note` (bắt buộc khi từ chối), `version` | Chỉ người ký ở chế độ `signer` |
| `POST /office/outgoing/{id}/number` | `version` | Văn thư cấp số sau duyệt: số tiếp theo của sổ trong năm, ký hiệu `<số>/<viết tắt loại>-<viết tắt cơ quan>` (công văn: `<số>/<viết tắt cơ quan>-<mã đơn vị soạn>`, không chọn đơn vị thì bỏ phần đơn vị), số dưới 10 thêm số 0, ngày ban hành là ngày cấp số |
| `POST /office/outgoing/{id}/issue` | multipart `file` (bản đã ký, đóng dấu), `version` | Thông báo người, phòng ban nhận; công ty khác trong tập đoàn nhận bản công văn đến chờ vào sổ kèm tệp |
| `GET /office/outgoing/{id}/render?format=pdf\|docx` | | Văn bản theo thể thức (quốc hiệu, tiêu ngữ, tên cơ quan, số ký hiệu, địa danh ngày tháng, V/v, Kính gửi, nội dung, thẩm quyền ký, nơi nhận); chưa cấp số ghi “DỰ THẢO”; PDF phông Liberation Serif, Word phông Times New Roman |

Thông báo công văn dùng loại `office_document` (trình lãnh đạo, chuyển, trình người ký, quyết định, chờ cấp số, phát hành), đường dẫn `/office/incoming/{id}` hoặc `/office/outgoing/{id}`; giao xử lý dùng `office_task_assigned` của công việc.

Bảng tin (lát L3, QUYTAC_NGHIEPVU_367):

| Endpoint | Gửi lên | Trả về, quy tắc |
|---|---|---|
| `GET /office/post-options` | | `PostOptions`: chi nhánh, phòng ban đang dùng của công ty, `canPost`, `canPostGroup`, số tin đang ghim |
| `GET /office/posts` | `view` (`feed`: tin mình nhận; `manage`: tin của công ty, kể cả hẹn giờ, hết hạn, thu hồi), `unread`, `search`, `page`, `pageSize` | Trang `PostListItem`; tin ghim còn hiệu lực lên đầu, rồi mới nhất trước; `isRead`, `acknowledgedAt` của người xem |
| `POST /office/posts`, `PATCH /office/posts/{id}` | `savePostSchema`: `title`, `body` (đánh dấu `**đậm**`, `*nghiêng*`, `[chữ](https://…)`, dòng `- `; đường dẫn chỉ http, https), `audienceType` (`company`, `units` với `branchIds`, `departmentIds`, `group`), `pinned`, `publishAt` (không gửi là đăng ngay), `expiresAt`, `requiresAcknowledgement`, `allowComments`, `version` khi sửa | Không có quyền `403`; toàn tập đoàn khi không có quyền phạm vi tập đoàn `400` tại `audienceType`; đối tượng trống hoặc không thuộc công ty `400`; hết hạn không sau giờ đăng `400` tại `expiresAt`; quá 5 tin ghim `409 officePostPinLimit`; sửa: chỉ người đăng, tin đã đăng giữ giờ đăng và hiện “đã sửa” |
| `GET /office/posts/{id}` | | `PostResponse`; người nhận mở lần đầu ghi đã đọc; không thuộc đối tượng, tin hẹn giờ, hết hạn, thu hồi với người nhận `404` |
| `POST /office/posts/{id}/revoke` | `version` | Chỉ người đăng; tin ẩn với người nhận, bỏ ghim |
| `POST /office/posts/{id}/acknowledge` | | Người nhận tin cần xác nhận; không cần xác nhận `409 officePostNotAcknowledgeable` |
| `GET /office/posts/{id}/readers` | | `PostReader[]` người nhận hiện tại (trừ người đăng), chưa đọc trước; người nhận khác `403` |
| `…/comments` | `body` 1 đến 5.000 ký tự | Tin không cho bình luận `409 officePostCommentsClosed`; người đăng xóa được bình luận bất kỳ; người đăng nhận thông báo `office_post_comment` |

Việc nền `office-post-publish` mỗi phút: tin cần xác nhận đọc đến giờ đăng thì gửi thông báo `office_post` (đường dẫn `/office/bulletin/{id}`) cho người nhận, mỗi tin một lần; tin thường không gửi thông báo.

## 4. Sự kiện phát ra (outbox)

| Sự kiện | Khi nào | Dữ liệu |
|---|---|---|
| `core.user.created` | Mời nhân viên | `userId`, `companyId` |
| `core.user.disabled` | Vô hiệu hóa | `userId`, `companyId` |
| `core.company.created` | Tạo công ty | `companyId` |
| `core.branch.created` | Tạo chi nhánh | `branchId`, `companyId` |
| `core.role_assignment.changed` | Gán, gỡ vai trò | `userId`, `companyId` |
| `core.approval.completed` | Yêu cầu duyệt kết thúc | `requestId`, `documentTypeCode`, `documentId`, `status` |
| `core.notification.created` | Ghi thông báo trong ứng dụng; CHUC_NANG_26 nghe sự kiện này để gửi Zalo ZNS (CONG_VIEC_03) | `notificationId`, `kind` |

MODULE_02 phần Sản phẩm (CONG_VIEC_04) không phát sự kiện mới; mini app Sản phẩm nghe `core.approval.completed` của loại chứng từ `catalog.price_change` để cập nhật phiếu điều chỉnh giá (API_62).

MODULE_03 Kho (CONG_VIEC_05) không phát sự kiện mới; mini app Kho nghe `core.approval.completed` của loại chứng từ `inventory.receipt_other`, `inventory.issue_other`, `inventory.adjustment`, `inventory.transfer` để ghi sổ hoặc nhả hàng giữ (API_65, API_66). Thông báo trong ứng dụng loại `inventory_stock_alert` ghi qua `core.notifications`.

MODULE_07 phần tối thiểu (CONG_VIEC_06) không phát, không nghe sự kiện; đối tác nội bộ đồng bộ khi khởi động API và khi đọc danh sách, chi tiết, kiểm trùng (API_71); mỗi thay đổi do đồng bộ ghi nhật ký `partner.sync`, người làm là hệ thống.

MODULE_04 phần 1 (CONG_VIEC_07) không phát sự kiện mới; mini app Mua hàng nghe `core.approval.completed` của loại chứng từ `purchasing.requisition`, `purchasing.order` để chuyển trạng thái đề nghị mua, đơn mua (API_74, API_75). Phiếu nhập mua, phiếu trả hàng không đi luồng duyệt; trạng thái "Đã nhận đủ" của đơn mua cập nhật trong cùng giao dịch ghi sổ (API_76).

MODULE_05 phần 1 (CONG_VIEC_08) không phát sự kiện mới; mini app Bán hàng nghe `core.approval.completed` của loại chứng từ `sales.order` để chuyển đơn bán đã xác nhận, bị từ chối, đã rút (từ chối, rút thì nhả hàng giữ) (API_77). Phiếu xuất giao hàng, phiếu nhận hàng trả lại không đi luồng duyệt; trạng thái "Đã giao đủ" của đơn bán cập nhật trong cùng giao dịch ghi sổ (API_79).

MODULE_05 phần 2 (CONG_VIEC_09) không phát sự kiện mới; dùng lại việc nghe `core.approval.completed` của `sales.order`, `purchasing.order`: duyệt xong thì sinh chứng từ đối ứng, từ chối hoặc rút đơn đối ứng thì kết thúc hai bên trong cùng giao dịch xử lý sự kiện. Yêu cầu duyệt bị rút do bên kia kết thúc không phát sự kiện.

MODULE_05 phần 3 (CONG_VIEC_12) không phát sự kiện mới; mini app Bán hàng nghe `core.approval.completed` của loại chứng từ `sales.promotion` để chuyển chương trình `pending` sang `active` (duyệt xong), `rejected`, `withdrawn` (API_83).

MODULE_06 phần 1 (CONG_VIEC_13) không phát sự kiện mới; mini app Tài chính – Kế toán nghe `core.approval.completed` của loại chứng từ `finance.payment` để ghi sổ phiếu chi duyệt xong (không ghi sổ được thì `rejected` kèm `postError`), chuyển `rejected`, `withdrawn` (API_86). Công nợ tự phát sinh không qua sự kiện mà qua móc nối `postedHooks` trong giao dịch ghi sổ phiếu kho và `writtenOffHooks` trong giao dịch ghi tổn thất biên bản chênh lệch nội bộ (API_82).

MODULE_06 phần 2 (CONG_VIEC_14) không phát sự kiện mới; mini app Tài chính – Kế toán nghe `core.approval.completed` của loại chứng từ `accounting.journal` để ghi sổ phiếu kế toán duyệt xong (kỳ đã khóa thì `rejected` kèm `postError`), chuyển `rejected`, `withdrawn` (API_88). Bút toán tự sinh không qua sự kiện mà qua móc nối `postedHooks` (phiếu kho, phiếu thu chi), `writtenOffHooks` (ghi tổn thất biên bản nội bộ) trong cùng giao dịch ghi sổ.

MODULE_06 phần 3 (CONG_VIEC_15) không phát, không nghe sự kiện; API_90 chỉ đọc.

MODULE_06 phần 4 (CONG_VIEC_16) không phát, không nghe sự kiện outbox. Hóa đơn gốc lập và việc chờ trả hàng tạo qua móc nối `postedHooks` trong giao dịch ghi sổ phiếu kho; gửi nhà cung cấp chạy bằng tác vụ nền `einvoice-send`, báo quá hạn bằng `einvoice-overdue` (thông báo `einvoice_overdue`), cả hai trên hàng đợi BullMQ riêng `hoa-don-dien-tu`.

MODULE_06 phần 5 (CONG_VIEC_17) không phát sự kiện mới; mini app Tài chính – Kế toán nghe `core.approval.completed` của loại chứng từ `finance.commission` để ghi sổ bảng hoa hồng duyệt xong (không ghi sổ được thì `rejected` kèm `postError`), chuyển `rejected`, `withdrawn` (API_94). Phát sinh hoa hồng không qua sự kiện mà qua móc nối `allocatedHooks` trong giao dịch trừ nợ và `postedHooks` trong giao dịch ghi sổ phiếu kho; gán nhân viên hưởng trong giao dịch gửi đơn bán. Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).

MODULE_06 phần 6 (CONG_VIEC_18) không phát, không nghe sự kiện outbox. Thử ghép lại khi phiếu thu chi ghi sổ qua móc nối `PaymentsService.postedHooks` trong giao dịch ghi sổ; giao dịch ngân hàng nhận qua webhook (API_98).

MODULE_06 phần 7 (CONG_VIEC_19) không phát sự kiện mới; mini app Tài chính – Kế toán nghe `core.approval.completed` của loại chứng từ `finance.collection_statement` để ghi sổ bảng đối soát duyệt xong (không ghi sổ được thì `rejected` kèm `postError`), chuyển `rejected`, `withdrawn` khi bị từ chối, rút.

MODULE_06 phần 8 (CONG_VIEC_20) không phát sự kiện mới; mini app Tài chính – Kế toán nghe `core.approval.completed` của loại chứng từ `finance.consolidation` để chốt số bảng hợp nhất duyệt xong (không chốt được thì `rejected` kèm `postError`), chuyển `rejected`, `withdrawn` khi bị từ chối, rút.

MODULE_07 phần 2 (CONG_VIEC_21) không phát sự kiện mới; mini app Khách hàng và Đối tác nghe `core.approval.completed` của loại chứng từ `crm.customer_assignment` để áp dụng phiếu giao khách duyệt xong (không áp dụng được thì `rejected` kèm `applyError`), chuyển `rejected`, `withdrawn` khi bị từ chối, rút. Thông báo trong ứng dụng loại `crm.customer_assignment.received`, `crm.customer_assignment.removed` ghi qua `core.notifications`. Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11).
