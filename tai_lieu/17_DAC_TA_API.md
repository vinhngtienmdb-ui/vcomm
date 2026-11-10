# 17. ĐẶC TẢ API

- Mô tả: Hợp đồng API: endpoint, phương thức, dữ liệu gửi lên, dữ liệu trả về, xác thực, phân quyền, kiểm tra dữ liệu, lỗi, phân trang.
- Phiên bản: 1.9
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09): thêm API_49 đến API_54; bổ sung API_02 đến API_05; CONG_VIEC_04 (2026-11-09): thêm API_55 đến API_62 của MODULE_02 (mục 2a, 3a); CONG_VIEC_05 (2026-11-10): thêm API_63 đến API_70 của MODULE_03 (mục 2b, 3b); CONG_VIEC_06 (2026-11-10): thêm API_71, API_72 của MODULE_07 (mục 2c, 3c); CONG_VIEC_07 (2026-11-10): thêm API_73 đến API_76 của MODULE_04 (mục 2d, 3d); bổ sung API_55, API_65; CONG_VIEC_08 (2026-11-10): thêm API_77 đến API_79 của MODULE_05 (mục 2e, 3e); bổ sung API_65; CONG_VIEC_09 (2026-11-10): thêm API_80 đến API_82 giao dịch nội bộ (mục 2f, 3f); bổ sung API_65, API_73, API_75, API_76, API_77, API_79; CONG_VIEC_12 (2026-11-10): thêm API_83 khuyến mãi (mục 2g, 3g); bổ sung API_77; CONG_VIEC_13 (2026-11-10): thêm API_84 đến API_86 của MODULE_06 phần 1 (mục 2h, 3h); sửa API_77 kiểm hạn mức theo dư nợ thật

Phạm vi hiện tại: MODULE_01 Nền tảng; MODULE_02 phần Sản phẩm (CONG_VIEC_04); MODULE_03 Kho phần web (CONG_VIEC_05); MODULE_07 Khách hàng và Đối tác phần tối thiểu (CONG_VIEC_06); MODULE_04 Mua hàng phần 1 (CONG_VIEC_07); MODULE_05 Bán hàng phần 1 (CONG_VIEC_08); MODULE_05 phần 2 Giao dịch nội bộ (CONG_VIEC_09); MODULE_05 phần 3 Khuyến mãi (CONG_VIEC_12); MODULE_06 Tài chính – Kế toán phần 1 (CONG_VIEC_13).

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

### API_72 Hồ sơ đối tác của công ty
Gửi lên (`PUT /crm/partners/{id}/profile`):
```json
{ "isCustomer": true, "isSupplier": false, "paymentTermDays": 30, "creditLimit": "50000000", "customerGroupId": "01J...", "ownerUserId": "01J...", "note": "Giao buổi sáng", "version": 0 }
```
- Hồ sơ: `{ companyId, isCustomer, isSupplier, paymentTermDays, creditLimit, creditLimitHidden, currency, customerGroupId, customerGroupName, ownerUserId, ownerUserName, note, status, version }`; `creditLimit` trả dạng chuỗi bỏ số 0 thừa, `null` là không giới hạn; người xem không có quyền `crm.profile.manage` nhận `creditLimit: null`, `creditLimitHidden: true`. `currency` là tiền tệ của công ty (`core.companies.base_currency`). Chi tiết đối tác đọc từ công ty khác trả `profile: null`.
- `PUT` (`200`) lập mới (khi `version` 0) hoặc ghi đè hồ sơ của công ty đang làm việc; nhật ký `partner_profile.save` (loại đối tượng `partner_profile`) có `beforeData`, `afterData`.
- `partner-profile-options`: nhóm khách hàng đang dùng của công ty đang làm việc; nhân viên đang làm ở công ty, sắp theo tên.
- Lỗi: `400` tại `isCustomer` "Giá trị không hợp lệ." (không chọn khách hàng, nhà cung cấp); tại `paymentTermDays`, `creditLimit` (âm, quá 4 chữ số lẻ); tại `customerGroupId` "Giá trị không hợp lệ." (nhóm khách hàng của công ty khác hoặc ngừng dùng); tại `ownerUserId` "Giá trị không hợp lệ." (không làm ở công ty); tại `partnerId` "Không lập hồ sơ đối tác cho chính công ty đang chọn."; `403`; `404`; `409 CONFLICT_VERSION`.

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

### API_78 Cài đặt bán hàng
- `GET` trả `{ "maxManualDiscountPercent": "5", "version": 1 }` (chưa có: `"0"`, `0`); `PUT` (`200`) với `version` hiện tại; `maxManualDiscountPercent` 0 đến 100, tối đa 2 chữ số lẻ; nhật ký `sales_settings.update` (có `beforeData`).
- Lỗi: `400` tại `maxManualDiscountPercent` "Giá trị không hợp lệ."; `403`; `409 CONFLICT_VERSION`.

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
- `GET /finance/debts/partners/{partnerId}` (`200`): `{ partner, side, currency, balance, advance, ageing, items[] ({ id, direction, sourceType (`opening`, `sales_issue`, `sales_return`, `purchase_receipt`, `purchase_return`, `payment`, `internal_write_off`), sourceId, paymentKind, documentNo, documentDate, dueDate, amount, openAmount, overdueDays, note, canDelete, allocations[] ({ itemId, documentNo, sourceType, amount, date }) }), canManageOpening, canManagePayments }`; mới trước, tối đa 1.000. Đối tác không có hồ sơ và không có công nợ ở công ty đang chọn: `404`.
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
