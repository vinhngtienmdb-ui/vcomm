# 17. ĐẶC TẢ API

- Mô tả: Hợp đồng API: endpoint, phương thức, dữ liệu gửi lên, dữ liệu trả về, xác thực, phân quyền, kiểm tra dữ liệu, lỗi, phân trang.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt

Phạm vi hiện tại: MODULE_01 Nền tảng.

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
| API_01 | `POST /auth/login` | CHUC_NANG_06 | Công khai | `identifier`, `password` | Đặt cookie phiên; `{ mfaRequired, user }` |
| API_02 | `POST /auth/otp/send` | CHUC_NANG_08 | Công khai | `phone` | `204` (luôn thành công, QUYTAC_NGHIEPVU_05) |
| API_03 | `POST /auth/otp/verify` | CHUC_NANG_08 | Công khai | `phone`, `code` | Như API_01 |
| API_04 | `GET /auth/oauth/{provider}/start` | CHUC_NANG_07, CHUC_NANG_24 | Công khai | `provider` = `google`, `microsoft`, `zalo`; `mode` = `login`, `link` | Chuyển hướng tới nhà cung cấp |
| API_05 | `GET /auth/oauth/{provider}/callback` | CHUC_NANG_07, CHUC_NANG_24 | Công khai | `code`, `state` | Đăng nhập hoặc liên kết; chuyển hướng về MAN_HINH_05 hoặc MAN_HINH_06 |
| API_06 | `POST /auth/mfa/verify` | CHUC_NANG_09 | Đã qua bước một | `code` hoặc `backupCode` | Phiên đánh dấu đã xác thực hai lớp |
| API_07 | `POST /auth/mfa/enroll` | CHUC_NANG_09 | Đã đăng nhập | `factorType` | `{ otpauthUrl, secretForManualEntry }` |
| API_08 | `POST /auth/mfa/enroll/confirm` | CHUC_NANG_09 | Đã đăng nhập | `code` | `{ backupCodes: [10 mã] }` (chỉ trả một lần) |
| API_09 | `POST /auth/refresh` | Phiên | Cookie làm mới | Không | Token mới; đổi token làm mới |
| API_10 | `POST /auth/logout` | Phiên | Đã đăng nhập | Không | `204`; thu hồi phiên |
| API_11 | `POST /auth/activation` | CHUC_NANG_04 | Công khai | `token`, `password` | `204` |
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
| API_27 | `POST /users/imports` | CHUC_NANG_05 | `user.invite` | Tệp `.xlsx` (multipart, tối đa 5 MB, 1.000 dòng) | `{ invited, failed, errorFileUrl }` |
| API_28 | `GET /users/imports/template` | CHUC_NANG_05 | `user.invite` | Không | Tệp mẫu `.xlsx` |
| API_29 | `GET /users/{id}`, `PATCH /users/{id}` | CHUC_NANG_19 | `user.view`, `user.manage` | Trường nhân viên, `version` | Chi tiết nhân viên, công ty, vai trò, phiên |
| API_30 | `POST /users/{id}/lock`, `POST /users/{id}/unlock` | CHUC_NANG_19 | `user.manage` | `reason` | Nhân viên; thu hồi phiên khi khóa |
| API_31 | `GET /users/{id}/handover` | CHUC_NANG_19 | `user.manage` | Không | `{ pendingApprovalSteps: [...], managedDepartments: [...] }` |
| API_32 | `POST /users/{id}/deactivate` | CHUC_NANG_19 | `user.manage` | `reason`, `handover: [{ kind, itemId, toUserId }]` | Nhân viên; `409 BUSINESS_RULE` nếu thiếu bàn giao |
| API_33 | `POST /users/{id}/mfa/reset` | CHUC_NANG_09 | `user.reset_mfa` | Không | `204` |
| API_34 | `POST /users/{id}/role-assignments`, `DELETE /users/{id}/role-assignments/{assignmentId}` | CHUC_NANG_13 | `role.assign` | `roleId`, `scopeType`, `branchId`, `validFrom`, `validTo` | Lần gán vai trò |
| API_35 | `GET /permissions` | CHUC_NANG_12 | `role.manage` | Không | Quyền nhóm theo mini app, kèm `grantableByMe` |
| API_36 | `GET/POST /roles`, `PATCH /roles/{id}`, `PUT /roles/{id}/permissions` | CHUC_NANG_12 | `role.manage` | `code`, `nameVi`, `nameEn`, `description`, `permissionCodes[]`, `version` | Vai trò |
| API_37 | `GET /approval-policies`, `POST /approval-policies` | CHUC_NANG_15 | `approval_policy.manage` | `documentTypeCode`, `currency`, `effectiveFrom`, `levels[]` (`levelNo`, `minAmount`, `approver`, `substitute`, `dueHours`) | Chính sách; chính sách cũ kết thúc ngày trước `effectiveFrom` |
| API_38 | `POST /approval-requests` | CHUC_NANG_16 | Nội bộ (mini app sở hữu chứng từ gọi qua service) | `documentTypeCode`, `documentId`, `documentNo`, `amount`, `currency`, `documentDate` | Yêu cầu duyệt kèm các bước |
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

## 4. Sự kiện phát ra (outbox)

| Sự kiện | Khi nào | Dữ liệu |
|---|---|---|
| `core.user.created` | Mời nhân viên | `userId`, `companyId` |
| `core.user.disabled` | Vô hiệu hóa | `userId`, `companyId` |
| `core.company.created` | Tạo công ty | `companyId` |
| `core.branch.created` | Tạo chi nhánh | `branchId`, `companyId` |
| `core.role_assignment.changed` | Gán, gỡ vai trò | `userId`, `companyId` |
| `core.approval.completed` | Yêu cầu duyệt kết thúc | `requestId`, `documentTypeCode`, `documentId`, `status` |
