# 17. ĐẶC TẢ API

- Mô tả: Hợp đồng API: endpoint, phương thức, dữ liệu gửi lên, dữ liệu trả về, xác thực, phân quyền, kiểm tra dữ liệu, lỗi, phân trang.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09): thêm API_49 đến API_54; bổ sung API_02 đến API_05

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
