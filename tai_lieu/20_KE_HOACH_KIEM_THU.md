# 20. KẾ HOẠCH KIỂM THỬ

- Mô tả: Phạm vi, loại kiểm thử, môi trường, dữ liệu, tiêu chí bắt đầu và kết thúc kiểm thử, kiểm thử theo lát của MODULE_01 Nền tảng.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Chờ phê duyệt

## 1. Phạm vi kiểm thử

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| MODULE_01 Nền tảng, công việc CONG_VIEC_02: CHUC_NANG_01 đến CHUC_NANG_24, yêu cầu phi chức năng của MODULE_01 | Nội dung chứng từ của mini app khác (dùng loại chứng từ thử `platform.test_document`) |
| TIEUCHI_NGHIEMTHU_01 đến TIEUCHI_NGHIEMTHU_47; kịch bản trong tài liệu `21` | Dữ liệu kho thật của MODULE_03, chứng từ kế toán của MODULE_06 |
| API_01 đến API_48 (tài liệu `17`), MAN_HINH_01 đến MAN_HINH_18 (tài liệu `14`) | Ứng dụng kho, ứng dụng kinh doanh trên điện thoại |
| Kiểm tra bảo mật phần C cho phần thay đổi của CONG_VIEC_02 | Kiểm tra bảo mật phần D (thuộc lần triển khai) |

Tiêu chí bắt buộc: mọi tiêu chí trừ TIEUCHI_NGHIEMTHU_45. TIEUCHI_NGHIEMTHU_45 là tiêu chí mong muốn: không chặn cổng nhưng phải có kết quả.

## 2. Loại kiểm thử áp dụng

| Loại | Công cụ | Lệnh chạy | Áp dụng cho |
|---|---|---|---|
| Kiểm thử đơn vị | Vitest 5.1.0 | `pnpm test` | Xử lý nghiệp vụ thuần: chọn cấp duyệt theo ngưỡng, quy đổi tỷ giá, định dạng số chứng từ, kiểm tra cây không tạo vòng, tính hiệu lực lần gán vai trò, lược đồ zod trong `packages/contracts`, tệp dịch đủ khóa |
| Kiểm thử tích hợp | Vitest 5.1.0 với PostgreSQL 16 và Redis thật chạy bằng Docker | `docker compose up -d`, `pnpm test` | Truy vấn Drizzle, ràng buộc cơ sở dữ liệu, giao dịch, cấp số chứng từ song song, lọc dữ liệu theo phạm vi trong truy vấn, lưu đệm quyền trong Redis, tác vụ nền BullMQ, outbox |
| Kiểm thử API | Vitest gọi `apps/api` qua HTTP, PostgreSQL và Redis thật | `pnpm test` | API_01 đến API_48: dữ liệu trả về, mã lỗi theo tài liệu `17` mục 1, sự kiện outbox, dòng nhật ký thao tác |
| Kiểm thử giao diện (đầu cuối) | Playwright 1.65.0 | **CHƯA XÁC ĐỊNH:** lệnh chạy riêng, tạo ở lát L1 và ghi vào tài liệu `18` mục 5 | Luồng chính trên MAN_HINH_01 đến MAN_HINH_18; khung nhìn 360 điểm ảnh; tiếng Anh |
| Kiểm thử phân quyền theo từng vai trò | Vitest kiểm thử API | `pnpm test` | Mỗi API gọi bằng: chưa đăng nhập, quản trị tập đoàn, quản trị công ty (công ty mình, công ty khác), quản lý tỷ giá, nhân viên, thủ kho phạm vi chi nhánh; đối chiếu ma trận tài liệu `22` mục 4 |
| Kiểm tra bảo mật (mục 17) | C1: `pnpm audit`. C2: gitleaks (chưa có, đề xuất cài, chờ người dùng đồng ý). C3 đến C5: kiểm thử API. C6: đối chiếu OWASP Top 10 bằng danh sách | `pnpm audit`; `gitleaks detect` trên mã hiện tại và các commit của công việc; `pnpm test` | Phần C trong `.claude/skills/vibecoding-flow/KIEM_TRA_BAO_MAT.md`; kết quả ghi tài liệu `25` |
| Kiểm thử hồi quy | Vitest và Playwright | `pnpm test` và lệnh Playwright | Toàn bộ bộ kiểm thử của dự án, chạy trước mỗi điểm xem trước và trước khi trình nghiệm thu |
| Kiểm thử hiệu năng | **CHƯA XÁC ĐỊNH:** công cụ kiểm thử tải chưa có trong tài liệu `13`, cần người dùng duyệt | **CHƯA XÁC ĐỊNH** | TIEUCHI_NGHIEMTHU_45. **CHƯA XÁC ĐỊNH:** chạy trên máy phát triển hay môi trường thử nghiệm |
| Kiểm thử thủ công | Người dùng cùng AI tại điểm xem trước | Không áp dụng | Nhà cung cấp đăng nhập thật (lát L6), điện thoại thật, rà soát màn hình, rà soát câu chữ tiếng Anh |

Quy ước viết kiểm thử tự động:
- Tên mỗi kiểm thử chứa mã kịch bản, ví dụ `KICHBAN_KIEMTHU_23`.
- Khi viết xong, đường dẫn tệp kiểm thử ghi vào trường "Kiểm thử tự động" của kịch bản trong tài liệu `21` và cột "Kiểm thử tự động" của tài liệu `27`.
- Kịch bản có thao tác ghi kiểm tra thêm dòng nhật ký thao tác bằng một hàm kiểm tra dùng chung (KICHBAN_KIEMTHU_108).

## 3. Môi trường và dữ liệu kiểm thử

**Môi trường**

| Thành phần | Cấu hình |
|---|---|
| Cơ sở dữ liệu | PostgreSQL 16 trong Docker (`docker compose up -d`); database migration chạy từ `database/migrations` trước mỗi lần chạy; mỗi tệp kiểm thử dùng dữ liệu riêng, dọn sau khi chạy |
| Bộ nhớ đệm, hàng đợi | Redis trong Docker; xóa dữ liệu giữa các tệp kiểm thử |
| Email, SMS | `EMAIL_DRIVER=log`, `SMS_DRIVER=log`; kiểm thử đọc đường dẫn kích hoạt, mã OTP từ log |
| Google, Microsoft, Zalo | Máy chủ OpenID Connect và OAuth 2.0 giả lập trong kiểm thử tự động; nhà cung cấp thật chỉ dùng ở kiểm thử thủ công khi có mã ứng dụng (lát L6 đang bị chặn) |
| Khóa bí mật | Tệp `.env` không commit, giá trị chỉ dùng cho máy phát triển; mã hóa bí mật TOTP dùng khóa thử thay AWS KMS |
| Trình duyệt | Playwright với Chromium; khung nhìn máy tính và khung nhìn 360 × 780 điểm ảnh |

**Đồng hồ giả lập**

- Dùng cho tiêu chí về thời gian: TIEUCHI_NGHIEMTHU_07 (72 giờ), TIEUCHI_NGHIEMTHU_10 (15 phút), TIEUCHI_NGHIEMTHU_12 (1 giờ), TIEUCHI_NGHIEMTHU_14 (5 phút, 1 giờ), TIEUCHI_NGHIEMTHU_24 (ngày kết thúc), TIEUCHI_NGHIEMTHU_31 (ngày lập), TIEUCHI_NGHIEMTHU_36 (4 giờ, 8 giờ), TIEUCHI_NGHIEMTHU_39 (đặt lại theo kỳ).
- Mã ứng dụng lấy thời điểm hiện tại qua một nguồn thời gian thay được trong kiểm thử; kiểm thử đặt thời điểm cụ thể, không chờ thật.
- Ngày tính theo giờ Việt Nam (UTC+7). Mốc mặc định: 2026-11-09.
- Tác vụ nền (nhắc, chuyển duyệt quá hạn) được gọi trực tiếp sau khi đặt đồng hồ, không chờ chu kỳ 15 phút.
- Kiểm thử đặt đồng hồ sang tháng chưa có partition `audit_events` thì tạo partition đó trước khi chạy.

**Dữ liệu giả**

Không dùng dữ liệu thật của người dùng. Tổ chức: tập đoàn VCG (mã số thuế `0100000000`); công ty VCR (`0100000001`), VCT (`0100000002`); chi nhánh VCR-HCM, VCR-BD (kho Bình Dương), VCT-HN, VCT-DN. Số điện thoại dạng `+849000000xx`. Mã định danh Zalo dạng `zalo-thu-xxxx`. Mật khẩu chung `MatKhauThu@2026`.

Tài khoản thử theo tài liệu `18` mục 5 (nạp bằng `pnpm --filter api db:seed`):

| Tài khoản | Vai trò | Phạm vi |
|---|---|---|
| `quantri.tapdoan@vcomm.test` | Quản trị tập đoàn | Tập đoàn VCG |
| `quantri.vcr@vcomm.test` | Quản trị công ty | Công ty VCR |
| `tygia@vcomm.test` | Quản lý tỷ giá | Tập đoàn VCG |
| `phuc.le@vcomm.test` | Nhân viên, trưởng phòng Mua hàng | Công ty VCR |
| `thukho.bd@vcomm.test` | Nhân viên, thủ kho | Chi nhánh VCR-BD |

Tài khoản bổ sung, chỉ tạo trong dữ liệu chuẩn bị của kiểm thử:

| Tài khoản | Vai trò, đặc điểm | Phạm vi | Dùng cho |
|---|---|---|---|
| `quantri.vct@vcomm.test` | Quản trị công ty | Công ty VCT | TIEUCHI_NGHIEMTHU_08 |
| `nhanvien.haicongty@vcomm.test` | "Kế toán thử" ở VCR, "Chỉ xem thử" ở VCT | VCR (mặc định), VCT | TIEUCHI_NGHIEMTHU_19, 20, 25, 27, 38 |
| `nguoilap.vcr@vcomm.test` | Nhân viên phòng Mua hàng, trưởng phòng là `phuc.le` | Công ty VCR | TIEUCHI_NGHIEMTHU_15, 29 đến 34 |
| `giamdoc.vcr@vcomm.test` | Người duyệt cấp 2 | Công ty VCR | TIEUCHI_NGHIEMTHU_29 đến 34, 37 |
| `tonggiamdoc.vcr@vcomm.test` | Người duyệt cấp 3 | Công ty VCR | TIEUCHI_NGHIEMTHU_30 |
| `thaythe.vcr@vcomm.test` | Người duyệt thay thế mọi cấp | Công ty VCR | TIEUCHI_NGHIEMTHU_32, 36, 37 |
| `duyet.haicongty@vcomm.test` | Người duyệt cấp 1 ở cả hai công ty | VCR, VCT | TIEUCHI_NGHIEMTHU_35 |
| `khongquyen.vcr@vcomm.test` | Vai trò không có quyền `<app>.access` nào | Công ty VCR | TIEUCHI_NGHIEMTHU_27 |
| `chizalo.vcr@vcomm.test` | Chỉ có cách đăng nhập Zalo | Công ty VCR | TIEUCHI_NGHIEMTHU_47 |
| `vohieuhoa@vcomm.test` | Tài khoản đã vô hiệu hóa | Công ty VCR | TIEUCHI_NGHIEMTHU_13 |
| `moi.nhanvienxx@vcomm.test`, `nhap.nvxx@vcomm.test` | Tạo trong kịch bản mời, nhập Excel | Công ty VCR | TIEUCHI_NGHIEMTHU_06 đến 09 |
| `tai.nv001@vcomm.test` đến `tai.nv200@vcomm.test` | Nhân viên, không bắt buộc xác thực hai lớp | Công ty VCR | TIEUCHI_NGHIEMTHU_45 |

Dữ liệu nghiệp vụ thử:
- Chính sách duyệt thử: loại `platform.test_document`, công ty VCR, tiền tệ VND, hiệu lực từ 2026-11-01. Cấp 1 ngưỡng 0, người duyệt là trưởng phòng của người lập. Cấp 2 ngưỡng 50.000.000, `giamdoc.vcr`. Cấp 3 ngưỡng 500.000.000, `tonggiamdoc.vcr`. Người thay thế mọi cấp `thaythe.vcr`. Thời hạn mỗi cấp 4 giờ. Chính sách tương tự cho VCT với `duyet.haicongty` ở cấp 1.
- Tỷ giá thử: USD sang VND, loại hạch toán, ngày 2026-11-09, 26.300.
- Dãy số thử: `platform.test_document`, tiền tố `TD`, 6 chữ số, đặt lại theo năm.
- Bộ nhận sự kiện thử đóng vai mini app sở hữu `platform.test_document`.
- Bản ghi kho thử theo chi nhánh cho TIEUCHI_NGHIEMTHU_23. **CHƯA XÁC ĐỊNH:** đối tượng dữ liệu và mã quyền đọc, chốt ở lát L2 vì MODULE_03 chưa có.

## 4. Tiêu chí bắt đầu và kết thúc kiểm thử

**Bắt đầu** (mỗi lát):
- Tài liệu `20`, `21` đã được người dùng phê duyệt.
- Điều kiện trước lát L1 trong CONG_VIEC_02 mục 14 đã đạt.
- PostgreSQL, Redis chạy bằng Docker; database migration và dữ liệu thử nạp không lỗi.
- Mã của lát chạy được từ giao diện tới cơ sở dữ liệu.

**Kết thúc** (công việc CONG_VIEC_02):
- Đạt cổng kiểm thử tại [SKILL.md mục 7](../.claude/skills/vibecoding-flow/SKILL.md#7-kiểm-thử) và cổng bảo mật tại [SKILL.md mục 17](../.claude/skills/vibecoding-flow/SKILL.md#17-kiểm-tra-bảo-mật).
- Mỗi tiêu chí trong phạm vi có kịch bản với kết quả Đạt mới nhất; TIEUCHI_NGHIEMTHU_45 có kết quả.
- Kết quả ghi trong tài liệu `25`; tài liệu `27` cập nhật cột kịch bản, kiểm thử tự động, kết quả.

Một lát chỉ chuyển sang điểm xem trước khi toàn bộ bộ kiểm thử hiện có (hồi quy) đạt.

## 5. Kiểm thử theo lát

Lát theo CONG_VIEC_02 mục 14. Kiểm thử của lát nào viết trong lát đó và chạy lại ở mọi lát sau.

| Lát | Tiêu chí nghiệm thu | Kịch bản (tài liệu `21`) | Nhóm kiểm thử viết trong lát |
|---|---|---|---|
| L1 | TIEUCHI_NGHIEMTHU_10, 11, 27, 42 (phần tệp dịch) | KICHBAN_KIEMTHU_23 đến 26, 66 đến 68, 107, 116, 119, 120 | Khung kiểm thử Vitest, Playwright; dữ liệu chuẩn bị; đồng hồ giả lập; hàm kiểm tra nhật ký dùng chung; đăng nhập, khóa, phiên; trang chủ; bảo mật phiên và giới hạn số yêu cầu |
| L2 | TIEUCHI_NGHIEMTHU_19 đến 26, 27 (theo công ty) | KICHBAN_KIEMTHU_47 đến 64, 69, 117 | Phân quyền theo phạm vi, lưu đệm quyền, gán vai trò có thời hạn, chuyển công ty, rà soát endpoint, ma trận phân quyền |
| L3 | TIEUCHI_NGHIEMTHU_01 đến 05 | KICHBAN_KIEMTHU_01 đến 11, 118 | Công ty, chi nhánh, phòng ban; dữ liệu đầu vào độc hại |
| L4 | TIEUCHI_NGHIEMTHU_06 đến 09 | KICHBAN_KIEMTHU_12 đến 22 | Mời, kích hoạt, nhập Excel, tải tệp lên |
| L5 | TIEUCHI_NGHIEMTHU_11 (quên mật khẩu), 12, 15 đến 18 | KICHBAN_KIEMTHU_27 đến 30, 37 đến 46 | Xác thực hai lớp, đặt lại mật khẩu, hồ sơ cá nhân, thu hồi phiên |
| L6 | TIEUCHI_NGHIEMTHU_13, 14, 46, 47 | KICHBAN_KIEMTHU_31 đến 36, 112 đến 115 | Đăng nhập liên kết với máy chủ giả lập, mã OTP qua SMS; kiểm thử thủ công khi hết bị chặn |
| L7 | TIEUCHI_NGHIEMTHU_28 đến 36 | KICHBAN_KIEMTHU_70 đến 92 | Chính sách duyệt, gửi duyệt, quyết định, rút lại, sự kiện, hộp duyệt, tác vụ nền quá hạn |
| L8 | TIEUCHI_NGHIEMTHU_26 (màn hình), 37 đến 45 | KICHBAN_KIEMTHU_65, 93 đến 106, 108 đến 111 | Vô hiệu hóa, bàn giao, dãy số song song, tỷ giá, tiếng Anh trên mọi màn hình, nhật ký thao tác, kiểm thử tải |
