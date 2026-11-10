# 21. KỊCH BẢN KIỂM THỬ

- Mô tả: Kịch bản kiểm thử cho từng tiêu chí nghiệm thu của MODULE_01 Nền tảng, MODULE_02 phần Sản phẩm, MODULE_03 Kho phần web, MODULE_07 Khách hàng và Đối tác phần tối thiểu, MODULE_04 Mua hàng phần 1, MODULE_05 Bán hàng phần 1, phần 2 (Giao dịch nội bộ), phần 3 (Khuyến mãi), MODULE_06 Tài chính – Kế toán phần 1 (Công nợ), phần 2 (Kế toán tổng hợp): đúng, sai, giá trị biên, từng vai trò.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-10
- Trạng thái: Chờ phê duyệt
- Thay đổi theo: CONG_VIEC_03 (2026-11-09): thêm KICHBAN_KIEMTHU_121 đến KICHBAN_KIEMTHU_132; CONG_VIEC_04 (2026-11-09): thêm KICHBAN_KIEMTHU_133 đến KICHBAN_KIEMTHU_146 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm KICHBAN_KIEMTHU_147 đến KICHBAN_KIEMTHU_159 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm KICHBAN_KIEMTHU_160 đến KICHBAN_KIEMTHU_164 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm KICHBAN_KIEMTHU_165 đến KICHBAN_KIEMTHU_171 của MODULE_04; CONG_VIEC_08 (2026-11-10): thêm KICHBAN_KIEMTHU_172 đến KICHBAN_KIEMTHU_184 của MODULE_05 (172 đến 175, 183, 184 tự động; 176 đến 182 thủ công); CONG_VIEC_09 (2026-11-10): thêm KICHBAN_KIEMTHU_185 đến KICHBAN_KIEMTHU_192 của giao dịch nội bộ (185 đến 190 tự động; 191, 192 thủ công); CONG_VIEC_12 (2026-11-10): thêm KICHBAN_KIEMTHU_193 đến KICHBAN_KIEMTHU_200 của khuyến mãi (193 đến 198 tự động; 199, 200 thủ công); CONG_VIEC_13 (2026-11-10): thêm KICHBAN_KIEMTHU_201 đến KICHBAN_KIEMTHU_209 của công nợ (201 đến 206, 209 tự động; 207, 208 thủ công); ghi chú dư nợ theo THAY_DOI_09 ở KICHBAN_KIEMTHU_183, KICHBAN_KIEMTHU_184; CONG_VIEC_14 (2026-11-10): thêm KICHBAN_KIEMTHU_210 đến KICHBAN_KIEMTHU_217 của kế toán tổng hợp (210 đến 214, 217 tự động; 215, 216 thủ công)

Dữ liệu giả, tài khoản thử, chính sách duyệt thử, tỷ giá thử và đồng hồ giả lập: tài liệu `20` mục 3. Mật khẩu chung của tài khoản thử: `MatKhauThu@2026`. Công ty đang làm việc chọn bằng header `X-Company-Id`. Mỗi kịch bản có thao tác ghi đều kiểm tra thêm dòng nhật ký thao tác (KICHBAN_KIEMTHU_108).

## CHUC_NANG_01: Quản lý công ty

### KICHBAN_KIEMTHU_01: Tạo hai công ty con dưới tập đoàn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_01
- Chức năng: CHUC_NANG_01
- Loại: Đúng
- Vai trò thực hiện: Quản trị tập đoàn (`quantri.tapdoan@vcomm.test`)
- Điều kiện ban đầu và dữ liệu: Cơ sở dữ liệu chỉ có tập đoàn VCG. Dữ liệu VCR (mã số thuế `0100000001`), VCT (mã số thuế `0100000002`).
- Các bước: (1) Gọi API_20 `POST /companies` tạo VCR, cha là VCG. (2) Tạo VCT, cha là VCG. (3) Gọi API_20 `GET /companies`.
- Kết quả mong đợi: Hai lần tạo trả `201`. Cây có đúng 3 công ty: VCG gốc, VCR và VCT là con. Bảng `outbox_events` có 2 sự kiện `core.company.created`.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_02: Từ chối công ty trùng mã số thuế hoặc trùng mã
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_02
- Chức năng: CHUC_NANG_01
- Loại: Sai
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Đã có VCR, VCT.
- Các bước: (1) Tạo công ty mã `VCX`, mã số thuế `0100000001`. (2) Tạo công ty mã `VCR`, mã số thuế `0100000009`.
- Kết quả mong đợi: Cả hai trả `400 VALIDATION_FAILED`, có thông báo tại trường bị trùng. Số công ty không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_03: Trùng mã số thuế với công ty đã ngừng hoạt động
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_02
- Chức năng: CHUC_NANG_01
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Công ty `VCZ` mã số thuế `0100000003` đã ngừng hoạt động, không còn chi nhánh hoạt động.
- Các bước: (1) Tạo công ty mới mã `VCY`, mã số thuế `0100000003`.
- Kết quả mong đợi: Bị từ chối `400 VALIDATION_FAILED` vì mã số thuế duy nhất trong toàn tập đoàn (QUYTAC_NGHIEPVU_02).
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_04: Vai trò khác quản trị tập đoàn gọi API tạo công ty
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_03
- Chức năng: CHUC_NANG_01
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty (`quantri.vcr@vcomm.test`); quản lý tỷ giá (`tygia@vcomm.test`); nhân viên (`phuc.le@vcomm.test`); chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Dữ liệu công ty mới `VCK`, mã số thuế `0100000004`.
- Các bước: (1) Mỗi vai trò gọi API_20 `POST /companies`. (2) Chưa đăng nhập gọi cùng API.
- Kết quả mong đợi: Ba vai trò nhận `403 FORBIDDEN`. Chưa đăng nhập nhận `401 UNAUTHENTICATED`. Không có công ty `VCK`.
- Kiểm thử tự động: Tự động API
- Lát: L3

## CHUC_NANG_02: Quản lý chi nhánh

### KICHBAN_KIEMTHU_05: Quản trị VCR tạo chi nhánh cho VCT
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_04
- Chức năng: CHUC_NANG_02
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chi nhánh mới mã `VCT-CT`, loại cửa hàng.
- Các bước: (1) Gọi API_22 `POST /branches` với `X-Company-Id` là VCT. (2) Gọi lại với `companyId` của VCT trong dữ liệu gửi lên, `X-Company-Id` là VCR.
- Kết quả mong đợi: Cả hai bị từ chối (`403`). Không có chi nhánh `VCT-CT`.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_06: Quản trị VCR tạo chi nhánh cho VCR
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_04
- Chức năng: CHUC_NANG_02
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chi nhánh mới mã `VCR-HN`, loại văn phòng.
- Các bước: (1) Gọi API_22 `POST /branches` với `X-Company-Id` là VCR.
- Kết quả mong đợi: `201`, chi nhánh thuộc VCR. Có sự kiện `core.branch.created`.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_07: Mã chi nhánh duy nhất trong một công ty
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_04
- Chức năng: CHUC_NANG_02
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: VCR đã có chi nhánh mã `KHO-01`.
- Các bước: (1) Tạo chi nhánh mã `KHO-01` ở VCR. (2) Tạo chi nhánh mã `KHO-01` ở VCT.
- Kết quả mong đợi: Bước 1 bị từ chối `400 VALIDATION_FAILED`. Bước 2 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_08: Dựng tập đoàn hai công ty, mỗi công ty hai chi nhánh trên giao diện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_01, TIEUCHI_NGHIEMTHU_04
- Chức năng: CHUC_NANG_01, CHUC_NANG_02
- Loại: Đúng
- Vai trò thực hiện: Quản trị tập đoàn; quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chỉ có VCG. Chi nhánh VCR-HCM, VCR-BD, VCT-HN, VCT-DN.
- Các bước: (1) Quản trị tập đoàn tạo VCR, VCT trên MAN_HINH_09. (2) Tạo hai chi nhánh cho mỗi công ty trên MAN_HINH_10. (3) Quản trị VCR mở MAN_HINH_10.
- Kết quả mong đợi: MAN_HINH_09 hiện cây 3 công ty. Quản trị VCR chỉ thấy VCR-HCM, VCR-BD.
- Kiểm thử tự động: Tự động giao diện
- Lát: L3

## CHUC_NANG_03: Quản lý phòng ban

### KICHBAN_KIEMTHU_09: Chọn phòng ban con làm phòng ban cha
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_05
- Chức năng: CHUC_NANG_03
- Loại: Sai
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Phòng ban A (`PB-A`), B (`PB-B`) là con của A, trong VCR.
- Các bước: (1) Gọi API_23 `PATCH /departments/{A}` đặt cha là B.
- Kết quả mong đợi: Bị từ chối `400 VALIDATION_FAILED`. Cây phòng ban không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_10: Vòng qua chính nó và qua nhiều cấp
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_05
- Chức năng: CHUC_NANG_03
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: A là cha của B, B là cha của C.
- Các bước: (1) Đặt cha của A là A. (2) Đặt cha của A là C. (3) Đặt cha của C là A (hợp lệ, chỉ đổi cấp).
- Kết quả mong đợi: Bước 1, 2 bị từ chối. Bước 3 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_11: Quản trị VCR sửa phòng ban của VCT
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_05
- Chức năng: CHUC_NANG_03
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Phòng ban `PB-T1` thuộc VCT.
- Các bước: (1) Quản trị VCR gọi `PATCH /departments/{PB-T1}`. (2) Nhân viên gọi `POST /departments` trong VCR.
- Kết quả mong đợi: Bước 1 nhận `404 NOT_FOUND`. Bước 2 nhận `403 FORBIDDEN`. Dữ liệu không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L3

## CHUC_NANG_04: Mời và kích hoạt nhân viên

### KICHBAN_KIEMTHU_12: Mời, kích hoạt rồi đăng nhập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_06
- Chức năng: CHUC_NANG_04
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên được mời
- Điều kiện ban đầu và dữ liệu: Email `moi.nhanvien01@vcomm.test` chưa có tài khoản. `EMAIL_DRIVER=log`.
- Các bước: (1) Gọi API_25 mời vào VCR, chi nhánh VCR-HCM. (2) Lấy đường dẫn kích hoạt từ log email. (3) Gọi API_11 với token và mật khẩu `MatKhauMoi@01`. (4) Gọi API_01 đăng nhập.
- Kết quả mong đợi: Bước 1: trạng thái "Đã mời", có sự kiện `core.user.created`. Bước 3: `204`, trạng thái "Đang hoạt động". Bước 4: `200`, có cookie phiên.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_13: Mời và kích hoạt trên giao diện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_06
- Chức năng: CHUC_NANG_04
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên được mời
- Điều kiện ban đầu và dữ liệu: Email `moi.nhanvien02@vcomm.test`.
- Các bước: (1) Mời qua hộp thoại mời ở MAN_HINH_12. (2) Mở đường dẫn từ log trên MAN_HINH_03, đặt mật khẩu. (3) Đăng nhập ở MAN_HINH_01.
- Kết quả mong đợi: Danh sách nhân viên hiện "Đã mời", sau kích hoạt hiện "Đang hoạt động". Đăng nhập xong vào MAN_HINH_05.
- Kiểm thử tự động: Tự động giao diện
- Lát: L4

### KICHBAN_KIEMTHU_14: Độ dài mật khẩu khi kích hoạt
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_06
- Chức năng: CHUC_NANG_04
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên được mời
- Điều kiện ban đầu và dữ liệu: Đường dẫn kích hoạt còn hạn của `moi.nhanvien03@vcomm.test`.
- Các bước: (1) Kích hoạt với mật khẩu 9 ký tự `MatKhau@9`. (2) Kích hoạt với mật khẩu 10 ký tự `MatKhau@10`.
- Kết quả mong đợi: Bước 1 bị từ chối "Mật khẩu phải có ít nhất 10 ký tự.", đường dẫn vẫn còn dùng được. Bước 2 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_15: Mời nhân viên khi không đủ quyền
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_06
- Chức năng: CHUC_NANG_04
- Loại: Phân quyền
- Vai trò thực hiện: Thủ kho (`thukho.bd@vcomm.test`); quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Email `moi.nhanvien04@vcomm.test`.
- Các bước: (1) Thủ kho gọi API_25 trong VCR. (2) Quản trị VCR gọi API_25 với `X-Company-Id` là VCT.
- Kết quả mong đợi: Cả hai bị từ chối (`403`). Không tạo tài khoản.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_16: Đường dẫn kích hoạt quanh mốc 72 giờ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_07
- Chức năng: CHUC_NANG_04
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên được mời
- Điều kiện ban đầu và dữ liệu: Hai lời mời gửi lúc 2026-11-09 08:00 cho `moi.nhanvien05@vcomm.test`, `moi.nhanvien06@vcomm.test`. Đồng hồ giả lập.
- Các bước: (1) Đặt đồng hồ 2026-11-12 07:59, kích hoạt nhân viên 05. (2) Đặt đồng hồ 2026-11-12 08:01, kích hoạt nhân viên 06.
- Kết quả mong đợi: Bước 1 thành công. Bước 2 bị từ chối "Đường dẫn kích hoạt đã hết hạn hoặc đã được dùng."
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_17: Dùng lại đường dẫn kích hoạt và gửi lại lời mời
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_07
- Chức năng: CHUC_NANG_04
- Loại: Sai
- Vai trò thực hiện: Nhân viên được mời; quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: `moi.nhanvien05@vcomm.test` đã kích hoạt; `moi.nhanvien06@vcomm.test` có đường dẫn hết hạn.
- Các bước: (1) Dùng lại đường dẫn của nhân viên 05. (2) Quản trị gọi API_26 gửi lại cho nhân viên 06. (3) Nhân viên 06 dùng đường dẫn mới.
- Kết quả mong đợi: Bước 1 bị từ chối "Đường dẫn kích hoạt đã hết hạn hoặc đã được dùng.", mật khẩu không đổi. Bước 3 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_18: Mời vào VCT một email đã có tài khoản ở VCR
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_08
- Chức năng: CHUC_NANG_04
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCT (`quantri.vct@vcomm.test`)
- Điều kiện ban đầu và dữ liệu: `phuc.le@vcomm.test` đang hoạt động ở VCR. Đếm số dòng bảng `users`.
- Các bước: (1) Gọi API_25 mời `phuc.le@vcomm.test` vào VCT. (2) Đếm lại bảng `users`. (3) `phuc.le` đăng nhập bằng mật khẩu cũ, gọi API_14.
- Kết quả mong đợi: Số tài khoản không đổi. Có thêm một dòng `user_company_memberships` cho VCT. API_14 liệt kê cả VCR và VCT.
- Kiểm thử tự động: Tự động API
- Lát: L4

## CHUC_NANG_05: Nhập nhân viên từ tệp Excel

### KICHBAN_KIEMTHU_19: Tệp 10 dòng có 2 dòng trùng email
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_09
- Chức năng: CHUC_NANG_05
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Tệp `nhap_10_dong.xlsx` theo mẫu API_28: email `nhap.nv01@vcomm.test` đến `nhap.nv08@vcomm.test`; dòng 9 trùng email dòng 2, dòng 10 trùng email dòng 5. Chốt ở lát L4: trùng trong cùng tệp thì dòng sau lỗi; email đã có tài khoản ở công ty khác thì thêm vào công ty (như CHUC_NANG_04); đã thuộc công ty này thì lỗi "Nhân viên đã thuộc công ty này.".
- Các bước: (1) Gọi API_27 với tệp. (2) Tải `errorFileUrl`.
- Kết quả mong đợi: `invited` = 8, `failed` = 2. Tệp lỗi có đúng dòng 9 và dòng 10 kèm lý do. Có 8 tài khoản "Đã mời".
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_20: Tệp 1.000 dòng và 1.001 dòng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_09
- Chức năng: CHUC_NANG_05
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Tệp sinh tự động 1.000 dòng và 1.001 dòng, email `nhap.lon0001@vcomm.test` trở đi, dưới 5 MB.
- Các bước: (1) Nhập tệp 1.000 dòng. (2) Nhập tệp 1.001 dòng.
- Kết quả mong đợi: Bước 1: `invited` = 1.000. Bước 2: từ chối cả tệp "Tệp vượt quá 1.000 dòng.", không tạo tài khoản nào.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_21: Tệp sai loại, sai mẫu, quá kích thước, sai vai trò
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_09
- Chức năng: CHUC_NANG_05
- Loại: Bảo mật
- Vai trò thực hiện: Quản trị công ty VCR; thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tệp `.csv`; tệp văn bản đổi đuôi thành `.xlsx`; tệp `.xlsx` thiếu cột email; tệp `.xlsx` 6 MB.
- Các bước: (1) Quản trị nhập lần lượt bốn tệp. (2) Thủ kho nhập tệp `nhap_10_dong.xlsx`.
- Kết quả mong đợi: Bốn tệp bị từ chối cả tệp ("Tệp không đúng mẫu." hoặc lỗi kích thước), không lưu tệp gốc. Thủ kho nhận `403`.
- Kiểm thử tự động: Tự động API
- Lát: L4

### KICHBAN_KIEMTHU_22: Nhập tệp và tải tệp lỗi trên giao diện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_09
- Chức năng: CHUC_NANG_05
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Tệp `nhap_10_dong.xlsx` như KICHBAN_KIEMTHU_19 (email đổi sang `nhap.gd01@vcomm.test` trở đi).
- Các bước: (1) Mở hộp thoại nhập Excel ở MAN_HINH_12, tải tệp mẫu. (2) Chọn tệp, xác nhận. (3) Tải tệp lỗi.
- Kết quả mong đợi: Màn hình hiện 8 thành công, 2 lỗi. Tệp lỗi tải về được, có 2 dòng.
- Kiểm thử tự động: Tự động giao diện
- Lát: L4

## CHUC_NANG_06: Đăng nhập bằng mật khẩu và đặt lại mật khẩu

### KICHBAN_KIEMTHU_23: Sai 5 lần liên tiếp, lần thứ 6 nhập đúng vẫn bị khóa
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_10
- Chức năng: CHUC_NANG_06
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tài khoản chưa có lần sai nào. Mật khẩu sai `SaiMatKhau@01`.
- Các bước: (1) Gọi API_01 với mật khẩu sai 5 lần. (2) Gọi API_01 với mật khẩu đúng.
- Kết quả mong đợi: Lần 1 đến 5 nhận `401`. Lần 6 nhận `423 ACCOUNT_LOCKED`, `retryAfterSeconds` khoảng 900. `users.login_locked_until` được đặt.
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_24: Ngưỡng 5 lần và mốc 15 phút
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_10
- Chức năng: CHUC_NANG_06
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đồng hồ giả lập.
- Các bước: (1) Sai 4 lần rồi nhập đúng. (2) Sai 3 lần, đúng 1 lần, sai 2 lần, rồi nhập đúng. (3) Sai 5 lần lúc 10:00, nhập đúng lúc 10:14:59. (4) Nhập đúng lúc 10:15:00.
- Kết quả mong đợi: Bước 1, 2 đăng nhập thành công. Bước 3 nhận `423`. Bước 4 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_25: Thông báo sai và thông báo khóa trên màn hình đăng nhập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_10, TIEUCHI_NGHIEMTHU_11
- Chức năng: CHUC_NANG_06
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tài khoản chưa có lần sai nào.
- Các bước: (1) Trên MAN_HINH_01 nhập tên không tồn tại `khongco@vcomm.test`. (2) Nhập đúng tên, sai mật khẩu 5 lần. (3) Nhập đúng mật khẩu.
- Kết quả mong đợi: Bước 1, 2 hiện cùng thông báo "Thông tin đăng nhập không đúng.". Bước 3 hiện "Tài khoản tạm khóa, thử lại sau 15 phút."
- Kiểm thử tự động: Tự động giao diện
- Lát: L1

### KICHBAN_KIEMTHU_26: Cùng thông báo khi sai tên đăng nhập hoặc sai mật khẩu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_11
- Chức năng: CHUC_NANG_06
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: `phuc.le@vcomm.test` tồn tại; `khongco@vcomm.test` không tồn tại.
- Các bước: (1) Gọi API_01 với `khongco@vcomm.test`. (2) Gọi API_01 với `phuc.le@vcomm.test`, sai mật khẩu.
- Kết quả mong đợi: Hai kết quả giống nhau hoàn toàn: `401 UNAUTHENTICATED`, cùng `message` "Thông tin đăng nhập không đúng.", không có trường khác biệt.
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_27: Quên mật khẩu với email không tồn tại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_11
- Chức năng: CHUC_NANG_06
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: `khongco@vcomm.test` không tồn tại.
- Các bước: (1) Gọi API_12 với `khongco@vcomm.test`. (2) Gọi API_12 với `phuc.le@vcomm.test`.
- Kết quả mong đợi: Cả hai trả `204`. Log email chỉ có thư cho `phuc.le@vcomm.test`.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_28: Đặt lại mật khẩu thu hồi các phiên cũ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_12
- Chức năng: CHUC_NANG_06
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Hai phiên A, B đăng nhập bằng mật khẩu.
- Các bước: (1) Gọi API_12, lấy đường dẫn từ log. (2) Gọi API_13 với mật khẩu mới `MatKhauMoi@12`. (3) Phiên A, B gọi API_14. (4) Phiên B gọi API_09. (5) Đăng nhập bằng mật khẩu cũ, rồi mật khẩu mới.
- Kết quả mong đợi: Bước 3, 4 nhận `401`. Bước 5: mật khẩu cũ bị từ chối, mật khẩu mới thành công.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_29: Đặt lại mật khẩu trên hai trình duyệt
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_12
- Chức năng: CHUC_NANG_06
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Hai ngữ cảnh trình duyệt riêng, cùng đăng nhập.
- Các bước: (1) Ngữ cảnh 1 đăng xuất, dùng MAN_HINH_04 đặt lại mật khẩu. (2) Ngữ cảnh 2 tải lại MAN_HINH_05.
- Kết quả mong đợi: Ngữ cảnh 2 bị chuyển về MAN_HINH_01.
- Kiểm thử tự động: Tự động giao diện
- Lát: L5

### KICHBAN_KIEMTHU_30: Đường dẫn đặt lại mật khẩu hết hạn và dùng lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_12
- Chức năng: CHUC_NANG_06
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Hai đường dẫn đặt lại tạo lúc 09:00. Đồng hồ giả lập.
- Các bước: (1) Lúc 09:59 dùng đường dẫn thứ nhất. (2) Dùng lại đường dẫn thứ nhất. (3) Lúc 10:01 dùng đường dẫn thứ hai.
- Kết quả mong đợi: Bước 1 thành công. Bước 2, 3 bị từ chối; mật khẩu giữ theo bước 1.
- Kiểm thử tự động: Tự động API
- Lát: L5

## CHUC_NANG_07: Đăng nhập bằng Google, Microsoft

### KICHBAN_KIEMTHU_31: Đăng nhập Google, Microsoft bằng email chưa được mời
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_13
- Chức năng: CHUC_NANG_07
- Loại: Sai
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Máy chủ OpenID Connect giả lập trả email đã xác minh `chuamoi@vcomm.test`; tài khoản `vohieuhoa@vcomm.test` đã vô hiệu hóa.
- Các bước: (1) Đi qua API_04, API_05 với `provider` = `google`, email `chuamoi@vcomm.test`. (2) Lặp lại với `microsoft`. (3) Lặp lại với email `vohieuhoa@vcomm.test`.
- Kết quả mong đợi: Cả ba bị từ chối "Email này chưa được cấp quyền truy cập. Liên hệ quản trị.". Không có phiên. Số dòng `users`, `user_identities` không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_32: Phản hồi đăng nhập liên kết không hợp lệ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_13
- Chức năng: CHUC_NANG_07
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Máy chủ OpenID Connect giả lập; email `phuc.le@vcomm.test`.
- Các bước: (1) Gọi API_05 với `state` khác giá trị đã cấp. (2) Token có email chưa xác minh. (3) Token có chữ ký sai. (4) Token có `nonce` sai.
- Kết quả mong đợi: Cả bốn bị từ chối, không tạo phiên, không gắn cách đăng nhập mới.
- Kiểm thử tự động: Tự động API
- Lát: L6

## CHUC_NANG_08: Đăng nhập bằng số điện thoại

### KICHBAN_KIEMTHU_33: Một tài khoản đăng nhập bằng ba cách
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14
- Chức năng: CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test` (số điện thoại `+84900000004`)
- Điều kiện ban đầu và dữ liệu: Máy chủ OpenID Connect giả lập trả email `phuc.le@vcomm.test`. `SMS_DRIVER=log`.
- Các bước: (1) Đăng nhập bằng API_01. (2) Đăng nhập Google qua API_04, API_05. (3) Gọi API_02, lấy mã từ log, gọi API_03. (4) Sau mỗi lần gọi API_14.
- Kết quả mong đợi: Ba lần đều thành công, API_14 trả cùng mã tài khoản. Lần Google đầu tiên thêm một dòng `user_identities`.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_34: Giới hạn mã OTP qua SMS
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14
- Chức năng: CHUC_NANG_08
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test` (số `+84900000005`)
- Điều kiện ban đầu và dữ liệu: Đồng hồ giả lập; Redis trống.
- Các bước: (1) Gửi mã, nhập đúng lúc 4 phút 59 giây. (2) Gửi mã, nhập đúng lúc 5 phút 1 giây. (3) Gửi mã, nhập sai 5 lần rồi nhập đúng. (4) Gửi mã lần thứ 5, rồi lần thứ 6 trong cùng một giờ.
- Kết quả mong đợi: Bước 1 thành công. Bước 2, 3 bị từ chối "Mã không đúng hoặc đã hết hạn.". Bước 4: lần 5 được gửi, lần 6 nhận "Bạn đã yêu cầu quá nhiều mã, thử lại sau." và không có SMS trong log.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_35: Gửi mã cho số điện thoại chưa gắn tài khoản
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14
- Chức năng: CHUC_NANG_08
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Số `+84900000999` không gắn tài khoản.
- Các bước: (1) Gọi API_02 với số này. (2) Gọi API_03 với mã bất kỳ `123456`.
- Kết quả mong đợi: Bước 1 trả `204` giống số có thật, không có SMS trong log. Bước 2 bị từ chối, không tạo tài khoản.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_36: Đăng nhập với nhà cung cấp thật
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_13, TIEUCHI_NGHIEMTHU_14, TIEUCHI_NGHIEMTHU_46, TIEUCHI_NGHIEMTHU_47
- Chức năng: CHUC_NANG_07, CHUC_NANG_08, CHUC_NANG_24
- Loại: Đúng
- Vai trò thực hiện: Người dùng cùng AI, tại điểm xem trước lát L6
- Điều kiện ban đầu và dữ liệu: Có mã ứng dụng Google, Microsoft, Zalo và nhà cung cấp SMS ở môi trường thử nghiệm. Tài khoản Google, Zalo, số điện thoại thử của người dùng, không dùng tài khoản khách hàng.
- Các bước: (1) Lặp lại KICHBAN_KIEMTHU_31, 33, 112, 113, 114, 115 trên MAN_HINH_01, MAN_HINH_06 với nhà cung cấp thật.
- Kết quả mong đợi: Kết quả như các kịch bản tự động tương ứng.
- Kiểm thử tự động: Thủ công – cần tài khoản và mã ứng dụng thật, không tự động hóa được trong kiểm thử liên tục
- Lát: L6

## CHUC_NANG_09: Xác thực hai lớp

### KICHBAN_KIEMTHU_37: Gán vai trò có quyền nhạy cảm thì lần đăng nhập sau bắt buộc mã OTP
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_15
- Chức năng: CHUC_NANG_09, CHUC_NANG_13
- Loại: Đúng
- Vai trò thực hiện: Quản trị tập đoàn (gán); nhân viên `nguoilap.vcr@vcomm.test` (đăng nhập)
- Điều kiện ban đầu và dữ liệu: Nhân viên chưa bật xác thực hai lớp. Vai trò hệ thống "Quản lý tỷ giá" (nhạy cảm) thay cho vai trò kế toán vì vai trò kế toán thuộc MODULE_06.
- Các bước: (1) Gán "Quản lý tỷ giá" phạm vi VCR qua API_34. (2) Nhân viên đăng nhập bằng API_01. (3) Gọi API_14 trước khi xác thực hai lớp. (4) Đăng ký qua API_07, API_08 bằng mã TOTP sinh từ bí mật trả về, rồi gọi API_06.
- Kết quả mong đợi: Bước 2 trả `mfaRequired: true`. Bước 3 nhận `401 MFA_REQUIRED`. Bước 4 thành công, trả 10 mã dự phòng một lần, phiên được đánh dấu đã xác thực hai lớp.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_38: Gán vai trò không có quyền nhạy cảm
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_15
- Chức năng: CHUC_NANG_09
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `moi.nhanvien01@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Vai trò riêng VCR "Xem nhân viên thử" chỉ có quyền không nhạy cảm.
- Các bước: (1) Gán vai trò. (2) Nhân viên đăng nhập.
- Kết quả mong đợi: `mfaRequired: false`, vào thẳng được trang chủ.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_39: Màn hình đăng ký xác thực hai lớp lần đầu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_15
- Chức năng: CHUC_NANG_09
- Loại: Đúng
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tài khoản bắt buộc xác thực hai lớp, chưa đăng ký.
- Các bước: (1) Đăng nhập ở MAN_HINH_01. (2) Trên MAN_HINH_02 nhập mã TOTP sinh trong kiểm thử. (3) Đăng xuất, đăng nhập lại.
- Kết quả mong đợi: Bước 1 chuyển sang MAN_HINH_02 dạng đăng ký. Bước 2 hiện 10 mã dự phòng rồi vào MAN_HINH_05. Bước 3 hiện MAN_HINH_02 dạng nhập mã.
- Kiểm thử tự động: Tự động giao diện
- Lát: L5

### KICHBAN_KIEMTHU_40: Dùng một mã dự phòng hai lần
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_16
- Chức năng: CHUC_NANG_09
- Loại: Sai
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đã đăng ký, giữ 10 mã dự phòng.
- Các bước: (1) Đăng nhập, gọi API_06 với mã dự phòng thứ 1. (2) Đăng xuất, đăng nhập, dùng lại mã thứ 1. (3) Dùng mã thứ 2.
- Kết quả mong đợi: Bước 1 thành công. Bước 2 bị từ chối "Mã xác thực không đúng.". Bước 3 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L5

## CHUC_NANG_10: Hồ sơ cá nhân

### KICHBAN_KIEMTHU_41: Tắt xác thực hai lớp khi đang bắt buộc
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_17
- Chức năng: CHUC_NANG_10
- Loại: Sai
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đã đăng nhập, đã xác thực hai lớp. Chốt ở lát L5: endpoint tắt là `POST /me/mfa/disable` (tài liệu `17` dòng API_08).
- Các bước: (1) Gọi endpoint tắt xác thực hai lớp.
- Kết quả mong đợi: Bị từ chối "Tài khoản của bạn bắt buộc xác thực hai lớp.". Bảng `mfa_factors` không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_42: Nút tắt xác thực hai lớp bị vô hiệu khi bắt buộc
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_17
- Chức năng: CHUC_NANG_10
- Loại: Sai
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_41.
- Các bước: (1) Mở thẻ "Xác thực hai lớp" trên MAN_HINH_06.
- Kết quả mong đợi: Nút tắt bị vô hiệu, có dòng giải thích bắt buộc.
- Kiểm thử tự động: Tự động giao diện
- Lát: L5

### KICHBAN_KIEMTHU_43: Nhân viên tự bật thì tắt được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_17
- Chức năng: CHUC_NANG_10
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Không có quyền nhạy cảm; tự bật xác thực hai lớp qua API_07, API_08.
- Các bước: (1) Tắt xác thực hai lớp. (2) Đăng nhập lại.
- Kết quả mong đợi: Bước 1 thành công. Bước 2 trả `mfaRequired: false`.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_44: Thu hồi một phiên trong danh sách
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_18
- Chức năng: CHUC_NANG_10
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Phiên A (web), phiên B (giả lập ứng dụng kho, `client_type` = `warehouse_app`).
- Các bước: (1) Phiên A gọi API_18 `GET /me/sessions`. (2) Phiên A gọi `DELETE /me/sessions/{B}`. (3) Phiên B gọi API_14 và API_09. (4) Phiên A gọi API_14.
- Kết quả mong đợi: Bước 1 liệt kê 2 phiên kèm thiết bị, địa chỉ IP, thời điểm. Bước 3 nhận `401`. Bước 4 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_45: Thu hồi phiên của người khác
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_18
- Chức năng: CHUC_NANG_10
- Loại: Phân quyền
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Mã phiên của `phuc.le@vcomm.test`.
- Các bước: (1) Gọi `DELETE /me/sessions/{mã phiên của phuc.le}`.
- Kết quả mong đợi: `404 NOT_FOUND`. Phiên của `phuc.le` vẫn dùng được.
- Kiểm thử tự động: Tự động API
- Lát: L5

### KICHBAN_KIEMTHU_46: Thu hồi phiên trên giao diện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_18
- Chức năng: CHUC_NANG_10
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Hai ngữ cảnh trình duyệt cùng đăng nhập.
- Các bước: (1) Ngữ cảnh 1 mở thẻ "Phiên đăng nhập" trên MAN_HINH_06, thu hồi phiên của ngữ cảnh 2, xác nhận. (2) Ngữ cảnh 2 bấm vào hộp duyệt.
- Kết quả mong đợi: Ngữ cảnh 2 bị chuyển về MAN_HINH_01.
- Kiểm thử tự động: Tự động giao diện
- Lát: L5

## CHUC_NANG_11: Chuyển công ty

### KICHBAN_KIEMTHU_47: Chuyển qua lại VCR, VCT không đăng nhập lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_19
- Chức năng: CHUC_NANG_11
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Thuộc VCR (mặc định) và VCT. Một phiên đăng nhập.
- Các bước: (1) Gọi API_14 không có `X-Company-Id`. (2) Gọi API_14, API_19 với `X-Company-Id` là VCT. (3) Gọi lại với VCR.
- Kết quả mong đợi: Không lần nào gọi API_01. Bước 1 trả công ty đang chọn VCR. Bước 2 trả VCT và quyền của VCT. Bước 3 trả VCR. Cùng một phiên.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_48: Chuyển công ty trên thanh trên cùng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_19
- Chức năng: CHUC_NANG_11
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_47.
- Các bước: (1) Đăng nhập, mở MAN_HINH_05. (2) Chọn VCT ở thanh trên cùng. (3) Chọn lại VCR.
- Kết quả mong đợi: Trang chủ đổi lưới mini app theo công ty. Không hiện MAN_HINH_01.
- Kiểm thử tự động: Tự động giao diện
- Lát: L2

### KICHBAN_KIEMTHU_49: Chuyển sang công ty không thuộc về
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_19
- Chức năng: CHUC_NANG_11
- Loại: Phân quyền
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chỉ thuộc VCR.
- Các bước: (1) Gọi API_14 với `X-Company-Id` là VCT.
- Kết quả mong đợi: `403` "Bạn không thuộc công ty này.".
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_50: Kế toán ở VCR, chỉ xem ở VCT, lập chứng từ ở VCT
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_20
- Chức năng: CHUC_NANG_11
- Loại: Phân quyền
- Vai trò thực hiện: Nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Vai trò "Kế toán thử" ở VCR có quyền lập chứng từ thử; vai trò "Chỉ xem thử" ở VCT chỉ có quyền xem. Chốt ở lát L2: MODULE_06 chưa có nên dùng quyền `platform.user.view` và API_24 thay cho quyền lập chứng từ; chạy lại bằng API chứng từ khi xây MODULE_06.
- Các bước: (1) Với `X-Company-Id` là VCT, gọi kiểm tra quyền lập chứng từ thử. (2) Gọi API_14 với VCT.
- Kết quả mong đợi: Bước 1 nhận `403 FORBIDDEN`. Bước 2 không có quyền lập chứng từ thử.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_51: Lập chứng từ ở VCR được phép
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_20
- Chức năng: CHUC_NANG_11
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_50.
- Các bước: (1) Với `X-Company-Id` là VCR, gọi kiểm tra quyền lập chứng từ thử.
- Kết quả mong đợi: Được phép.
- Kiểm thử tự động: Tự động API
- Lát: L2

## CHUC_NANG_12: Quản lý vai trò

### KICHBAN_KIEMTHU_52: Quản trị VCR thêm quyền mình không có
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_21
- Chức năng: CHUC_NANG_12
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Vai trò riêng VCR "Hỗ trợ thử". Quyền `platform.company.manage` quản trị VCR không có.
- Các bước: (1) Gọi API_35, xem `grantableByMe` của quyền này. (2) Gọi API_36 `PUT /roles/{id}/permissions` thêm quyền này.
- Kết quả mong đợi: Bước 1 trả `false`. Bước 2 bị từ chối "Bạn không thể cấp quyền mình không có.", vai trò không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_53: Thêm quyền trong phạm vi được cấp
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_21
- Chức năng: CHUC_NANG_12
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR; quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Vai trò "Hỗ trợ thử".
- Các bước: (1) Quản trị VCR thêm `platform.user.view`. (2) Quản trị tập đoàn thêm `platform.company.manage` vào một vai trò dùng chung thử.
- Kết quả mong đợi: Cả hai thành công, `version` tăng.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_54: Ô quyền không cấp được bị vô hiệu trên ma trận
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_21
- Chức năng: CHUC_NANG_12
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Vai trò "Hỗ trợ thử".
- Các bước: (1) Mở MAN_HINH_14, chọn vai trò. (2) Thử đánh dấu ô `platform.company.manage`.
- Kết quả mong đợi: Ô bị vô hiệu, không đánh dấu được.
- Kiểm thử tự động: Tự động giao diện
- Lát: L2

### KICHBAN_KIEMTHU_55: Bỏ quyền khỏi vai trò có hiệu lực ngay
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_22
- Chức năng: CHUC_NANG_12
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `moi.nhanvien01@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Nhân viên có vai trò "Xem nhân viên thử" (quyền `platform.user.view`) phạm vi VCR. Quyền đã nằm trong lưu đệm Redis.
- Các bước: (1) Nhân viên gọi API_24. (2) Quản trị bỏ `platform.user.view` khỏi vai trò. (3) Nhân viên gọi lại API_24 bằng cùng phiên, không đăng nhập lại.
- Kết quả mong đợi: Bước 1 trả `200`. Bước 3 trả `403 FORBIDDEN`.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_56: Bỏ quyền khi người dùng còn quyền đó qua vai trò khác
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_22
- Chức năng: CHUC_NANG_12
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `moi.nhanvien01@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Nhân viên có hai vai trò cùng chứa `platform.user.view`.
- Các bước: (1) Bỏ quyền khỏi một vai trò. (2) Nhân viên gọi API_24.
- Kết quả mong đợi: Vẫn `200`.
- Kiểm thử tự động: Tự động API
- Lát: L2

## CHUC_NANG_13: Gán vai trò

### KICHBAN_KIEMTHU_57: Thủ kho VCR-BD chỉ thấy dữ liệu VCR-BD trong danh sách
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_23
- Chức năng: CHUC_NANG_13
- Loại: Phân quyền
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Vai trò thủ kho gán phạm vi chi nhánh VCR-BD. Bản ghi kho thử: 3 bản ghi ở VCR-BD, 2 bản ghi ở VCR-HCM. Chốt ở lát L2: MODULE_03 chưa có nên dùng danh sách nhân viên (API_24, API_29) lọc theo chi nhánh mặc định, quyền `platform.user.view`; kịch bản chạy lại bằng API kho khi xây MODULE_03.
- Các bước: (1) Gọi API danh sách bản ghi kho thử. (2) Gọi lại với bộ lọc chi nhánh VCR-HCM.
- Kết quả mong đợi: Bước 1 trả đúng 3 bản ghi VCR-BD. Bước 2 trả danh sách rỗng hoặc bị từ chối, không có bản ghi VCR-HCM.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_58: Thủ kho VCR-BD lấy bản ghi VCR-HCM theo mã
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_23
- Chức năng: CHUC_NANG_13
- Loại: Phân quyền
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_57; mã một bản ghi VCR-HCM.
- Các bước: (1) Gọi API chi tiết với mã bản ghi VCR-HCM.
- Kết quả mong đợi: `404 NOT_FOUND`, giống bản ghi không tồn tại.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_59: Phạm vi công ty thấy dữ liệu mọi chi nhánh
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_23
- Chức năng: CHUC_NANG_13
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `moi.nhanvien02@vcomm.test` có cùng vai trò thủ kho gán phạm vi công ty VCR
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_57.
- Các bước: (1) Gọi API danh sách bản ghi kho thử.
- Kết quả mong đợi: Trả 5 bản ghi của VCR-BD và VCR-HCM.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_60: Lần gán kết thúc hôm nay thì ngày mai hết quyền
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_24
- Chức năng: CHUC_NANG_13
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `moi.nhanvien01@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đồng hồ giả lập 2026-11-09 10:00 giờ Việt Nam. Gán "Xem nhân viên thử" `validFrom` = 2026-11-01, `validTo` = 2026-11-09.
- Các bước: (1) Lúc 2026-11-09 23:59:59 nhân viên gọi API_24. (2) Lúc 2026-11-10 00:00:01 gọi lại bằng cùng phiên.
- Kết quả mong đợi: Bước 1 trả `200`. Bước 2 trả `403`, kể cả khi quyền đã nằm trong lưu đệm Redis.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_61: Ngày kết thúc trước ngày bắt đầu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_24
- Chức năng: CHUC_NANG_13
- Loại: Sai
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: `validFrom` = 2026-11-10, `validTo` = 2026-11-09.
- Các bước: (1) Gọi API_34.
- Kết quả mong đợi: `400` "Ngày kết thúc phải sau ngày bắt đầu.". Không tạo lần gán.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_62: Quản trị VCR gán vai trò phạm vi VCT hoặc tập đoàn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_25
- Chức năng: CHUC_NANG_13
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Nhân viên `nhanvien.haicongty@vcomm.test`; chi nhánh VCT-HN.
- Các bước: (1) Gọi API_34 phạm vi công ty VCT. (2) Phạm vi chi nhánh VCT-HN. (3) Phạm vi tập đoàn.
- Kết quả mong đợi: Cả ba bị từ chối "Bạn không thể gán vai trò ngoài công ty của mình.". Không có lần gán mới, không có sự kiện `core.role_assignment.changed`.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_63: Quản trị VCR gán vai trò trong công ty mình
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_25
- Chức năng: CHUC_NANG_13
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Nhân viên `moi.nhanvien02@vcomm.test`.
- Các bước: (1) Gán phạm vi công ty VCR. (2) Gán phạm vi chi nhánh VCR-BD.
- Kết quả mong đợi: Cả hai thành công, có sự kiện `core.role_assignment.changed`.
- Kiểm thử tự động: Tự động API
- Lát: L2

### KICHBAN_KIEMTHU_64: Không có endpoint đăng nhập thay nhân viên khác
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_26
- Chức năng: CHUC_NANG_13
- Loại: Bảo mật
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Ứng dụng `apps/api` khởi động trong kiểm thử.
- Các bước: (1) Liệt kê mọi endpoint đã đăng ký. (2) So với danh sách API_01 đến API_48 của tài liệu `17`. (3) Kiểm tra không endpoint nào nhận mã nhân viên khác và trả phiên, token hoặc cookie phiên.
- Kết quả mong đợi: Không có endpoint ngoài danh sách. Chỉ API_01, API_03, API_05, API_06, API_09 tạo hoặc đổi phiên, và chỉ cho chính người xác thực.
- Kiểm thử tự động: Tự động API
- Lát: L2 (chạy lại ở mọi lát sau)

### KICHBAN_KIEMTHU_65: Rà soát màn hình không có chức năng đăng nhập thay
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_26
- Chức năng: CHUC_NANG_13
- Loại: Bảo mật
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Ứng dụng chạy đủ MAN_HINH_01 đến MAN_HINH_18.
- Các bước: (1) Mở MAN_HINH_12, MAN_HINH_13 và menu Nền tảng. (2) Tìm nút hoặc thao tác "đăng nhập thay", "xem dưới quyền".
- Kết quả mong đợi: Không có.
- Kiểm thử tự động: Thủ công – rà soát bằng mắt, chạy ở lát L8 khi đủ màn hình
- Lát: L8

## CHUC_NANG_14: Trang chủ mini app

### KICHBAN_KIEMTHU_66: Hai nhân viên khác quyền thấy trang chủ khác nhau
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_27
- Chức năng: CHUC_NANG_14
- Loại: Đúng
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`; nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Thủ kho có `platform.access`, `inventory.access`. `phuc.le` có `platform.access`, `purchasing.access`.
- Các bước: (1) Mỗi người đăng nhập và gọi API_19.
- Kết quả mong đợi: Thủ kho nhận đúng `platform`, `inventory`. `phuc.le` nhận đúng `platform`, `purchasing`. Thứ tự theo `sort_order`.
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_67: So sánh trang chủ trên giao diện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_27
- Chức năng: CHUC_NANG_14
- Loại: Đúng
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`; quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như dữ liệu thử.
- Các bước: (1) Mỗi người đăng nhập trên MAN_HINH_01, xem MAN_HINH_05.
- Kết quả mong đợi: Lưới mini app của mỗi người khớp kết quả API_19 của người đó.
- Kiểm thử tự động: Tự động giao diện
- Lát: L1

### KICHBAN_KIEMTHU_68: Nhân viên không có quyền truy cập mini app nào
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_27
- Chức năng: CHUC_NANG_14
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `khongquyen.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chỉ có vai trò không chứa quyền `<app>.access` nào.
- Các bước: (1) Gọi API_19. (2) Mở MAN_HINH_05.
- Kết quả mong đợi: `apps` rỗng. Màn hình hiện "Bạn chưa được cấp quyền dùng ứng dụng nào. Liên hệ quản trị.".
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_69: Trang chủ theo công ty đang chọn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_27
- Chức năng: CHUC_NANG_14
- Loại: Phân quyền
- Vai trò thực hiện: Nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Có `finance.access` ở VCR, không có ở VCT.
- Các bước: (1) Gọi API_19 với VCR. (2) Gọi với VCT.
- Kết quả mong đợi: Bước 1 có `finance`. Bước 2 không có `finance`.
- Kiểm thử tự động: Tự động API
- Lát: L2

## CHUC_NANG_15: Cấu hình chính sách duyệt

### KICHBAN_KIEMTHU_70: Ngưỡng cấp sau nhỏ hơn cấp trước, thiếu người thay thế
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_28
- Chức năng: CHUC_NANG_15
- Loại: Sai
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chính sách cho `platform.test_document`, VND.
- Các bước: (1) Gọi API_37 với cấp 1 ngưỡng 50.000.000, cấp 2 ngưỡng 30.000.000. (2) Gọi API_37 với cấp 2 không có người thay thế.
- Kết quả mong đợi: Bước 1 bị từ chối "Ngưỡng của cấp sau phải lớn hơn cấp trước.". Bước 2 bị từ chối "Mỗi cấp phải có người duyệt thay thế.". Không lưu chính sách.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_71: Hai cấp có ngưỡng bằng nhau
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_28
- Chức năng: CHUC_NANG_15
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Cấp 1 ngưỡng 50.000.000, cấp 2 ngưỡng 50.000.000.
- Các bước: (1) Gọi API_37.
- Kết quả mong đợi: Bị từ chối "Ngưỡng của cấp sau phải lớn hơn cấp trước.".
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_72: Lưu chính sách hợp lệ thay chính sách cũ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_28
- Chức năng: CHUC_NANG_15
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chính sách thử cũ hiệu lực từ 2026-11-01. Chính sách mới: các cấp 0, 50.000.000, 500.000.000; `effectiveFrom` = 2026-11-15.
- Các bước: (1) Lưu trên MAN_HINH_15. (2) Gọi API_37 `GET`.
- Kết quả mong đợi: Lưu thành công. Chính sách cũ kết thúc 2026-11-14. Ngày 2026-11-15 chỉ có một chính sách hiệu lực.
- Kiểm thử tự động: Tự động giao diện
- Lát: L7

### KICHBAN_KIEMTHU_73: Cấu hình chính sách ngoài quyền
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_28
- Chức năng: CHUC_NANG_15
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách hợp lệ như KICHBAN_KIEMTHU_72.
- Các bước: (1) Quản trị VCR gọi API_37 với `X-Company-Id` là VCT. (2) `phuc.le` gọi API_37 trong VCR.
- Kết quả mong đợi: Cả hai bị từ chối (`403`).
- Kiểm thử tự động: Tự động API
- Lát: L7

## CHUC_NANG_16: Gửi duyệt và xử lý yêu cầu duyệt

### KICHBAN_KIEMTHU_74: Chứng từ 80 triệu đồng qua cấp 1 rồi cấp 2
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_29
- Chức năng: CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`; cấp 1 `phuc.le@vcomm.test` (trưởng phòng); cấp 2 `giamdoc.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt thử. Chứng từ thử `TD-VCR-2026-000001`, 80.000.000 VND.
- Các bước: (1) Mini app thử gọi API_38. (2) Cấp 1 gọi API_41 đồng ý. (3) Cấp 2 gọi API_41 đồng ý.
- Kết quả mong đợi: Bước 1 tạo đúng 2 bước (cấp 1, cấp 2), không có cấp 3. Sau bước 2: `currentLevelNo` = 2. Sau bước 3: trạng thái đã duyệt, có sự kiện `core.approval.completed` với `status` đã duyệt.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_75: Quyết định sai cấp hoặc không phải người duyệt
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_29
- Chức năng: CHUC_NANG_16
- Loại: Phân quyền
- Vai trò thực hiện: `giamdoc.vcr@vcomm.test`; thủ kho `thukho.bd@vcomm.test`; quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Yêu cầu 80.000.000 VND đang ở cấp 1.
- Các bước: (1) Cấp 2 gọi API_41 đồng ý. (2) Thủ kho gọi API_41. (3) Quản trị VCR gọi API_41.
- Kết quả mong đợi: Cả ba nhận `403 FORBIDDEN`. Yêu cầu vẫn ở cấp 1.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_76: Giá trị quanh ngưỡng cấp 2 và cấp 3
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_30
- Chức năng: CHUC_NANG_16
- Loại: Giá trị biên
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt thử. Ba chứng từ thử: 49.999.999; 50.000.000; 500.000.000 VND.
- Các bước: (1) Gửi duyệt từng chứng từ qua API_38.
- Kết quả mong đợi: 49.999.999 có 1 bước. 50.000.000 có 2 bước. 500.000.000 có 3 bước.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_77: Chứng từ 2.000 USD quy đổi theo tỷ giá ngày lập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_31
- Chức năng: CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tỷ giá hạch toán USD sang VND ngày 2026-11-09 là 26.300. Chứng từ 2.000 USD, ngày lập 2026-11-09.
- Các bước: (1) Gọi API_38.
- Kết quả mong đợi: `201`, `amountInPolicyCurrency` = `52600000.0000`, `exchangeRate` = `26300.00000000`, có cấp 1 và cấp 2.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_78: Giá trị quy đổi đúng bằng ngưỡng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_31
- Chức năng: CHUC_NANG_16
- Loại: Giá trị biên
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tỷ giá hạch toán USD sang VND ngày 2026-11-10 là 25.000. Chứng từ 2.000 USD và 1.999,99 USD, ngày lập 2026-11-10.
- Các bước: (1) Gửi duyệt hai chứng từ.
- Kết quả mong đợi: 2.000 USD (50.000.000 VND) có 2 bước. 1.999,99 USD (49.999.750 VND) có 1 bước.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_79: Không có tỷ giá ngày lập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_31
- Chức năng: CHUC_NANG_16
- Loại: Sai
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chỉ có tỷ giá ngày 2026-11-09. Chứng từ 2.000 USD ngày lập 2026-11-11. Thêm một tỷ giá loại bán (không phải hạch toán) ngày 2026-11-11.
- Các bước: (1) Gọi API_38.
- Kết quả mong đợi: `409 BUSINESS_RULE` "Chưa có tỷ giá hạch toán ngày lập chứng từ.". Không tạo yêu cầu.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_80: Trưởng phòng tự lập chứng từ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_32
- Chức năng: CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Người lập `phuc.le@vcomm.test` (trưởng phòng Mua hàng)
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt thử. Chứng từ 80.000.000 VND do `phuc.le` lập.
- Các bước: (1) Gọi API_38.
- Kết quả mong đợi: Bước cấp 1 giao cho `thaythe.vcr@vcomm.test`, `isSubstitute` = `true`. Cấp 2 giao `giamdoc.vcr@vcomm.test`.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_81: Người lập tự duyệt qua API
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_32
- Chức năng: CHUC_NANG_16
- Loại: Phân quyền
- Vai trò thực hiện: `phuc.le@vcomm.test`; `giamdoc.vcr@vcomm.test` khi là người lập
- Điều kiện ban đầu và dữ liệu: Yêu cầu của KICHBAN_KIEMTHU_80. Chứng từ 80.000.000 VND thứ hai do `giamdoc.vcr` lập.
- Các bước: (1) `phuc.le` gọi API_41 trên yêu cầu của mình. (2) Gửi duyệt chứng từ thứ hai, cấp 1 đồng ý. (3) `giamdoc.vcr` gọi API_41 trên yêu cầu của mình.
- Kết quả mong đợi: Bước 1, 3 nhận `403 FORBIDDEN`. Ở bước 2, cấp 2 đã giao cho `thaythe.vcr@vcomm.test`.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_82: Rút lại khi cấp 1 chưa quyết định
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_33
- Chức năng: CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Yêu cầu 80.000.000 VND đang ở cấp 1.
- Các bước: (1) Gọi API_42. (2) Gửi duyệt lại cùng chứng từ.
- Kết quả mong đợi: Bước 1: trạng thái "Đã rút". Bước 2: tạo yêu cầu mới.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_83: Rút lại sau khi cấp 1 đồng ý hoặc không phải người lập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_33
- Chức năng: CHUC_NANG_16
- Loại: Sai
- Vai trò thực hiện: Người lập `nguoilap.vcr@vcomm.test`; cấp 1 `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Yêu cầu 80.000.000 VND, cấp 1 đã đồng ý. Yêu cầu khác đang ở cấp 1.
- Các bước: (1) Người lập gọi API_42 trên yêu cầu đã qua cấp 1. (2) `phuc.le` gọi API_42 trên yêu cầu đang ở cấp 1.
- Kết quả mong đợi: Bước 1: `409 BUSINESS_RULE` "Không thể rút lại vì đã có cấp duyệt.". Bước 2: `403`. Hai yêu cầu không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_84: Từ chối ở cấp 2 và mini app sở hữu nhận sự kiện
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_34
- Chức năng: CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Cấp 1 `phuc.le@vcomm.test`; cấp 2 `giamdoc.vcr@vcomm.test`; người lập `nguoilap.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Yêu cầu 80.000.000 VND. Bộ nhận sự kiện thử đóng vai mini app sở hữu `platform.test_document`.
- Các bước: (1) Cấp 1 đồng ý. (2) Cấp 2 từ chối, ý kiến "Giá cao hơn báo giá". (3) Chạy tác vụ đẩy outbox. (4) Người lập gửi duyệt lại cùng chứng từ.
- Kết quả mong đợi: Yêu cầu "Bị từ chối". Bộ nhận thử nhận đúng một sự kiện `core.approval.completed` với `status` bị từ chối, đúng `documentId`. Bước 4 tạo yêu cầu mới.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_85: Từ chối thiếu lý do và quyết định trên yêu cầu đã kết thúc
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_34
- Chức năng: CHUC_NANG_16
- Loại: Sai
- Vai trò thực hiện: Cấp 1 `phuc.le@vcomm.test`; cấp 2 `giamdoc.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Yêu cầu A đang ở cấp 1. Yêu cầu B đã bị từ chối.
- Các bước: (1) Cấp 1 từ chối A với ý kiến rỗng. (2) Cấp 2 gọi API_41 trên B.
- Kết quả mong đợi: Bước 1: `400` "Vui lòng nhập lý do từ chối.", A không đổi. Bước 2: `409 BUSINESS_RULE`.
- Kiểm thử tự động: Tự động API
- Lát: L7

## CHUC_NANG_17: Hộp duyệt

### KICHBAN_KIEMTHU_86: Hộp duyệt gom chứng từ chờ từ VCR và VCT
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_35
- Chức năng: CHUC_NANG_17
- Loại: Đúng
- Vai trò thực hiện: Người duyệt `duyet.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Thuộc VCR và VCT; là người duyệt cấp 1 của chính sách thử ở cả hai công ty. 2 yêu cầu chờ ở VCR, 1 ở VCT, gửi lúc khác nhau.
- Các bước: (1) Gọi API_39 không lọc. (2) Gọi với `companyId` là VCT.
- Kết quả mong đợi: Bước 1 trả 3 yêu cầu, sắp theo thời điểm gửi. Bước 2 trả 1 yêu cầu.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_87: Duyệt trên màn hình rộng 360 điểm ảnh
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_35
- Chức năng: CHUC_NANG_17
- Loại: Đúng
- Vai trò thực hiện: Người duyệt `duyet.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_86. Khung nhìn trình duyệt 360 × 780 điểm ảnh.
- Các bước: (1) Mở MAN_HINH_07. (2) Đồng ý một yêu cầu VCR. (3) Từ chối một yêu cầu VCT, nhập lý do.
- Kết quả mong đợi: Danh sách hiện dạng thẻ, có cả hai công ty, không cuộn ngang. Nút Đồng ý, Từ chối bấm được. Sau thao tác còn 1 yêu cầu.
- Kiểm thử tự động: Tự động giao diện
- Lát: L7

### KICHBAN_KIEMTHU_88: Duyệt trên điện thoại thật
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_35
- Chức năng: CHUC_NANG_17
- Loại: Đúng
- Vai trò thực hiện: Người dùng, tại điểm xem trước lát L7
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_86.
- Các bước: (1) Mở hộp duyệt trên điện thoại của người dùng. (2) Duyệt một yêu cầu.
- Kết quả mong đợi: Đọc được, bấm được, duyệt thành công.
- Kiểm thử tự động: Thủ công – cần thiết bị thật và đánh giá của người dùng
- Lát: L7

### KICHBAN_KIEMTHU_89: Không xem được yêu cầu không liên quan
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_35
- Chức năng: CHUC_NANG_17
- Loại: Phân quyền
- Vai trò thực hiện: Thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Yêu cầu chờ `duyet.haicongty@vcomm.test`.
- Các bước: (1) Gọi API_39. (2) Gọi API_40 với mã yêu cầu đó.
- Kết quả mong đợi: Bước 1 không có yêu cầu đó. Bước 2 nhận `404 NOT_FOUND`.
- Kiểm thử tự động: Tự động API
- Lát: L7

## CHUC_NANG_18: Nhắc và chuyển duyệt quá hạn

### KICHBAN_KIEMTHU_90: Nhắc khi quá 4 giờ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_36
- Chức năng: CHUC_NANG_18
- Loại: Giá trị biên
- Vai trò thực hiện: Tác vụ nền; người duyệt cấp 1 `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Thời hạn cấp 1 là 4 giờ. Yêu cầu gửi lúc 2026-11-09 08:00. Đồng hồ giả lập.
- Các bước: (1) Đặt đồng hồ 11:59, chạy tác vụ kiểm tra quá hạn. (2) Đặt 12:01, chạy tác vụ. (3) Đặt 12:16, chạy tác vụ.
- Kết quả mong đợi: Bước 1 không có thông báo nhắc. Bước 2 có đúng 1 thông báo nhắc cho `phuc.le`. Bước 3 không có nhắc thêm. MAN_HINH_07 đánh dấu "Quá hạn".
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_91: Chuyển người thay thế khi quá 8 giờ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_36
- Chức năng: CHUC_NANG_18
- Loại: Giá trị biên
- Vai trò thực hiện: Tác vụ nền
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_90.
- Các bước: (1) Đặt 15:59, chạy tác vụ. (2) Đặt 16:01, chạy tác vụ. (3) `phuc.le` gọi API_41. (4) `thaythe.vcr@vcomm.test` gọi API_41 đồng ý.
- Kết quả mong đợi: Bước 1 chưa chuyển. Bước 2 chuyển cấp 1 sang `thaythe.vcr`, báo cả hai người, có dòng nhật ký. Bước 3 nhận `403`. Bước 4 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L7

### KICHBAN_KIEMTHU_92: Người thay thế cũng là người lập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_36
- Chức năng: CHUC_NANG_18
- Loại: Giá trị biên
- Vai trò thực hiện: Tác vụ nền
- Điều kiện ban đầu và dữ liệu: Chứng từ do `thaythe.vcr@vcomm.test` lập, cấp 1 giao `phuc.le`. Gửi lúc 08:00.
- Các bước: (1) Đặt đồng hồ 16:01, chạy tác vụ.
- Kết quả mong đợi: Không chuyển. Quản trị công ty VCR nhận thông báo.
- Kiểm thử tự động: Tự động API
- Lát: L7

## CHUC_NANG_19: Khóa, mở khóa, vô hiệu hóa nhân viên

### KICHBAN_KIEMTHU_93: Vô hiệu hóa người duyệt còn chứng từ chờ khi chưa chọn người nhận
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_37
- Chức năng: CHUC_NANG_19
- Loại: Sai
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: `giamdoc.vcr@vcomm.test` có 1 bước duyệt đang chờ.
- Các bước: (1) Gọi API_31. (2) Gọi API_32 với `handover` rỗng.
- Kết quả mong đợi: Bước 1 liệt kê bước duyệt đang chờ. Bước 2: `409 BUSINESS_RULE` "Cần chọn người nhận bàn giao trước khi vô hiệu hóa.". Trạng thái tài khoản không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_94: Vô hiệu hóa kèm bàn giao
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_37
- Chức năng: CHUC_NANG_19
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_93. Người nhận `thaythe.vcr@vcomm.test`.
- Các bước: (1) Chọn người nhận trên MAN_HINH_13, xác nhận vô hiệu hóa.
- Kết quả mong đợi: Tài khoản "Đã vô hiệu hóa". Bước duyệt chuyển cho `thaythe.vcr`. Có sự kiện `core.user.disabled`.
- Kiểm thử tự động: Tự động giao diện
- Lát: L8

### KICHBAN_KIEMTHU_95: Trưởng phòng không có chứng từ chờ, tự vô hiệu hóa, sai vai trò
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_37
- Chức năng: CHUC_NANG_19
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: `phuc.le@vcomm.test` là trưởng phòng, không có bước duyệt chờ.
- Các bước: (1) Quản trị vô hiệu hóa `phuc.le` không bàn giao. (2) Quản trị tự vô hiệu hóa chính mình. (3) Thủ kho gọi API_32 cho `phuc.le`.
- Kết quả mong đợi: Bước 1: `409 BUSINESS_RULE` (thiếu người nhận phòng ban). Bước 2: `403` "Bạn không thể khóa tài khoản của chính mình.". Bước 3: `403`.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_96: Phiên cũ hết hiệu lực ngay sau vô hiệu hóa
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_38
- Chức năng: CHUC_NANG_19
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `moi.nhanvien01@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Nhân viên chỉ thuộc VCR, có 2 phiên, không có việc cần bàn giao. Token truy cập còn hạn.
- Các bước: (1) Quản trị gọi API_32. (2) Hai phiên gọi API_14 ngay. (3) Gọi API_09. (4) Đăng nhập lại.
- Kết quả mong đợi: Bước 2, 3 nhận `401`. Bước 4 bị từ chối.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_97: Vô hiệu hóa ở một trong hai công ty
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_38
- Chức năng: CHUC_NANG_19
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `nhanvien.haicongty@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Thuộc VCR và VCT, đang đăng nhập.
- Các bước: (1) Quản trị VCR vô hiệu hóa nhân viên ở VCR. (2) Nhân viên gọi API_14 với VCR. (3) Gọi API_14 với VCT.
- Kết quả mong đợi: Tài khoản vẫn "Đang hoạt động". Bước 2 nhận `403` "Bạn không thuộc công ty này.". Bước 3 thành công.
- Kiểm thử tự động: Tự động API
- Lát: L8

## CHUC_NANG_20: Dãy số chứng từ

### KICHBAN_KIEMTHU_98: Lưu song song 50 lần nhận số liên tiếp không trùng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_39
- Chức năng: CHUC_NANG_20
- Loại: Đúng
- Vai trò thực hiện: Kiểm thử tự động (giả lập 50 người dùng)
- Điều kiện ban đầu và dữ liệu: Dãy số `platform.test_document` của VCR: tiền tố `TD`, đặt lại theo năm, 6 chữ số, chưa cấp số nào năm 2026. PostgreSQL thật.
- Các bước: (1) Mở 50 giao dịch song song, mỗi giao dịch gọi API_44 rồi lưu chứng từ thử. (2) Lặp lại toàn bộ 3 lần trên cơ sở dữ liệu mới.
- Kết quả mong đợi: Mỗi lần có đúng 50 số khác nhau từ `TD-VCR-2026-000001` đến `TD-VCR-2026-000050`, không thiếu, không trùng.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_99: Đặt lại số theo năm, theo tháng, không bao giờ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_39
- Chức năng: CHUC_NANG_20
- Loại: Giá trị biên
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Ba dãy số thử: theo năm, theo tháng, không bao giờ; mỗi dãy đã cấp số 000123. Đồng hồ giả lập.
- Các bước: (1) Lấy số lúc 2026-11-30 23:59. (2) Lấy số lúc 2026-12-01 00:01. (3) Lấy số lúc 2027-01-01 00:01.
- Kết quả mong đợi: Theo tháng: số 000001 ở bước 2 và bước 3. Theo năm: bước 2 tiếp 000125, bước 3 về 000001 với kỳ 2027. Không bao giờ: tăng liên tục.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_100: Cấu hình dãy số sai hoặc ngoài quyền
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_39
- Chức năng: CHUC_NANG_20
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Dãy số thử của VCR, VCT.
- Các bước: (1) Quản trị VCR đặt tiền tố `td`. (2) Quản trị VCR sửa dãy số của VCT. (3) `phuc.le` gọi API_43 `PATCH`.
- Kết quả mong đợi: Bước 1: `400` "Tiền tố chỉ gồm chữ in hoa và chữ số.". Bước 2, 3 bị từ chối. Dãy số không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_101: Lưu lỗi thì số không bị dùng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_40
- Chức năng: CHUC_NANG_20
- Loại: Đúng
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Số đã cấp gần nhất `TD-VCR-2026-000010`.
- Các bước: (1) Mở giao dịch, lấy số, gây lỗi khi lưu chứng từ thử, giao dịch hủy. (2) Lưu chứng từ tiếp theo thành công.
- Kết quả mong đợi: Chứng từ ở bước 2 nhận `TD-VCR-2026-000011`.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_102: Lỗi xen kẽ khi lưu song song
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_40
- Chức năng: CHUC_NANG_20
- Loại: Giá trị biên
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Dãy số mới.
- Các bước: (1) Chạy 50 giao dịch song song, 10 giao dịch được chọn ngẫu nhiên gây lỗi khi lưu.
- Kết quả mong đợi: 40 chứng từ lưu thành công mang số 000001 đến 000040, liên tục, không trùng.
- Kiểm thử tự động: Tự động API
- Lát: L8

## CHUC_NANG_21: Tiền tệ và tỷ giá

### KICHBAN_KIEMTHU_103: Nhập trùng tỷ giá
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_41
- Chức năng: CHUC_NANG_21
- Loại: Sai
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Ngày 2026-11-09, USD sang VND, loại hạch toán, nguồn nhập tay, 26.300.
- Các bước: (1) Gọi API_45 `POST`. (2) Gọi lại cùng ngày, cặp tiền tệ, loại, nguồn, giá trị 26.310.
- Kết quả mong đợi: Bước 1 thành công. Bước 2 bị từ chối "Đã có tỷ giá cho ngày, cặp tiền tệ, loại và nguồn này.", tỷ giá giữ 26.300.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_104: Khác một thành phần và giá trị không dương
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_41
- Chức năng: CHUC_NANG_21
- Loại: Giá trị biên
- Vai trò thực hiện: Quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đã có tỷ giá của KICHBAN_KIEMTHU_103.
- Các bước: (1) Nhập cùng ngày, cặp, nguồn, loại bán. (2) Nhập cùng ngày, cặp, loại, nguồn ngân hàng. (3) Nhập ngày 2026-11-10. (4) Nhập giá trị 0. (5) Nhập giá trị -1.
- Kết quả mong đợi: Bước 1, 2, 3 thành công. Bước 4, 5 bị từ chối "Tỷ giá phải lớn hơn 0.".
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_105: Nhập, xem tỷ giá theo vai trò
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_41
- Chức năng: CHUC_NANG_21
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị tập đoàn; quản trị công ty VCR; nhân viên `phuc.le@vcomm.test`; chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Tỷ giá EUR sang VND ngày 2026-11-09.
- Các bước: (1) Mỗi vai trò gọi API_45 `POST`. (2) Mỗi vai trò gọi API_45 `GET`.
- Kết quả mong đợi: `POST`: quản trị tập đoàn thành công; quản trị VCR, nhân viên nhận `403`; chưa đăng nhập nhận `401`. `GET`: mọi vai trò đã đăng nhập xem được.
- Kiểm thử tự động: Tự động API
- Lát: L8

## CHUC_NANG_22: Đổi ngôn ngữ giao diện

### KICHBAN_KIEMTHU_106: Mọi màn hình hiện tiếng Anh
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_42
- Chức năng: CHUC_NANG_22
- Loại: Đúng
- Vai trò thực hiện: Quản trị tập đoàn (thấy đủ màn hình); nhân viên được mời (MAN_HINH_03)
- Điều kiện ban đầu và dữ liệu: Dữ liệu thử đủ cho mọi màn hình, kể cả trạng thái rỗng và lỗi.
- Các bước: (1) Chọn tiếng Anh trên MAN_HINH_01. (2) Lần lượt mở MAN_HINH_01 đến MAN_HINH_18, các hộp thoại và thông báo lỗi. (3) Trên mỗi màn hình kiểm tra chữ do hệ thống sinh, bỏ qua dữ liệu người dùng nhập (tên công ty, họ tên).
- Kết quả mong đợi: Không có chữ tiếng Việt có dấu, không có khóa dịch còn thô. Ngôn ngữ giữ sau khi tải lại trang và sau đăng nhập lại.
- Kiểm thử tự động: Tự động giao diện
- Lát: L8

### KICHBAN_KIEMTHU_107: Tệp dịch đủ khóa, thông báo lỗi API theo ngôn ngữ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_42
- Chức năng: CHUC_NANG_22
- Loại: Giá trị biên
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Tệp dịch `vi`, `en` trong `packages/i18n`.
- Các bước: (1) So tập khóa của hai tệp. (2) Gọi API_01 sai mật khẩu với `Accept-Language: en`. (3) Gọi API_15 đổi `locale` thành `en`, gọi một API lỗi không kèm header.
- Kết quả mong đợi: Hai tệp có cùng tập khóa, không giá trị rỗng. Bước 2, 3 trả `message` tiếng Anh.
- Kiểm thử tự động: Tự động API
- Lát: L1 (chạy lại ở mọi lát)

## CHUC_NANG_23: Nhật ký thao tác

### KICHBAN_KIEMTHU_108: Mọi thao tác ghi có dòng nhật ký trước và sau
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_43
- Chức năng: CHUC_NANG_23
- Loại: Đúng
- Vai trò thực hiện: Kiểm thử tự động
- Điều kiện ban đầu và dữ liệu: Các kịch bản có thao tác ghi thành công từ TIEUCHI_NGHIEMTHU_01 đến TIEUCHI_NGHIEMTHU_41, TIEUCHI_NGHIEMTHU_46, TIEUCHI_NGHIEMTHU_47.
- Các bước: (1) Sau mỗi thao tác ghi thành công, đọc `audit_events` theo `entity_type`, `entity_id`, `request_id`. (2) Sau mỗi lần đăng nhập thành công, thất bại, đọc dòng `login`. (3) Sau KICHBAN_KIEMTHU_91, đọc dòng chuyển người duyệt.
- Kết quả mong đợi: Mỗi thao tác có đúng một dòng, đủ người làm, công ty, hành động, `before_data` (trừ tạo mới), `after_data`. Không chứa mật khẩu, mã OTP, token.
- Kiểm thử tự động: Tự động API
- Lát: L8 (hàm kiểm tra dùng chung viết ở L1, áp dụng từ L1)

### KICHBAN_KIEMTHU_109: Không có API sửa hoặc xóa nhật ký
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_44
- Chức năng: CHUC_NANG_23
- Loại: Bảo mật
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Một dòng nhật ký bất kỳ.
- Các bước: (1) Liệt kê endpoint dưới `/audit-events`. (2) Gọi `PUT`, `PATCH`, `DELETE` tới `/audit-events/{id}`.
- Kết quả mong đợi: Chỉ có `GET`. Các lệnh còn lại nhận `404` hoặc `405`. Dòng nhật ký không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L8

### KICHBAN_KIEMTHU_110: Tra cứu nhật ký theo phạm vi
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_44
- Chức năng: CHUC_NANG_23
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; quản trị tập đoàn; nhân viên `phuc.le@vcomm.test`; quản lý tỷ giá
- Điều kiện ban đầu và dữ liệu: Có dòng nhật ký của VCR và VCT.
- Các bước: (1) Quản trị VCR gọi API_47 danh sách. (2) Quản trị VCR gọi API_47 chi tiết một dòng VCT. (3) Quản trị tập đoàn gọi danh sách. (4) Nhân viên, quản lý tỷ giá gọi danh sách.
- Kết quả mong đợi: Bước 1 chỉ có dòng VCR. Bước 2 nhận `404`. Bước 3 có cả VCR và VCT. Bước 4 nhận `403`.
- Kiểm thử tự động: Tự động API
- Lát: L8

## Yêu cầu phi chức năng: Hiệu năng

### KICHBAN_KIEMTHU_111: Đăng nhập và kiểm tra quyền với 200 người dùng đồng thời
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_45
- Chức năng: Phi chức năng
- Loại: Hiệu năng
- Vai trò thực hiện: Kiểm thử tải
- Điều kiện ban đầu và dữ liệu: 200 tài khoản giả `tai.nv001@vcomm.test` đến `tai.nv200@vcomm.test`, không bắt buộc xác thực hai lớp. Môi trường và công cụ theo tài liệu `20` mục 2.
- Các bước: (1) Khởi động 200 người dùng ảo đồng thời trong 10 phút. (2) Mỗi người gọi API_01, rồi lặp API_14 và API_24 (endpoint có kiểm tra quyền). (3) Đo thời gian trả lời phía máy chủ.
- Kết quả mong đợi: Phân vị 95 của API_01 dưới 200 mili giây; phân vị 95 của API_14, API_24 dưới 200 mili giây. Tỷ lệ lỗi bằng 0.
- Kiểm thử tự động: Thủ công – chạy công cụ kiểm thử tải theo lệnh, không chạy trong mỗi lần kiểm thử hồi quy
- Lát: L8

## CHUC_NANG_24: Liên kết và đăng nhập bằng Zalo

### KICHBAN_KIEMTHU_112: Đăng nhập Zalo chưa liên kết
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_46
- Chức năng: CHUC_NANG_24
- Loại: Sai
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Máy chủ OAuth 2.0 Zalo giả lập trả mã định danh `zalo-thu-0001`, chưa gắn tài khoản nào.
- Các bước: (1) Đi qua API_04, API_05 với `provider` = `zalo`, `mode` = `login`.
- Kết quả mong đợi: Bị từ chối "Tài khoản Zalo này chưa được liên kết. Đăng nhập bằng cách khác rồi liên kết trong hồ sơ cá nhân.". Không tạo tài khoản, không tạo phiên.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_113: Liên kết Zalo từ hồ sơ rồi đăng nhập
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_46
- Chức năng: CHUC_NANG_24
- Loại: Đúng
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test`; quản lý tỷ giá `tygia@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Zalo giả lập trả `zalo-thu-0001` cho thủ kho, `zalo-thu-0002` cho quản lý tỷ giá (bắt buộc xác thực hai lớp).
- Các bước: (1) Mỗi người đăng nhập bằng mật khẩu, gọi API_04 `mode` = `link`, API_05. (2) Đăng xuất. (3) Đăng nhập bằng Zalo.
- Kết quả mong đợi: Bước 1: API_17 hiện liên kết Zalo. Bước 3: thủ kho vào thẳng MAN_HINH_05, cùng mã tài khoản; quản lý tỷ giá nhận `mfaRequired: true`.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_114: Liên kết tài khoản Zalo đã gắn với nhân viên khác
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_47
- Chức năng: CHUC_NANG_24
- Loại: Sai
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: `zalo-thu-0001` đã gắn với `thukho.bd@vcomm.test`.
- Các bước: (1) `phuc.le` liên kết Zalo, giả lập trả `zalo-thu-0001`.
- Kết quả mong đợi: Bị từ chối "Tài khoản Zalo này đã được liên kết với tài khoản khác.". Liên kết của thủ kho không đổi.
- Kiểm thử tự động: Tự động API
- Lát: L6

### KICHBAN_KIEMTHU_115: Hủy liên kết Zalo khi là cách đăng nhập duy nhất
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_47
- Chức năng: CHUC_NANG_24
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên `chizalo.vcr@vcomm.test`; thủ kho `thukho.bd@vcomm.test`
- Điều kiện ban đầu và dữ liệu: `chizalo.vcr` chỉ có cách đăng nhập Zalo `zalo-thu-0003` (chuẩn bị trực tiếp trong cơ sở dữ liệu kiểm thử). Thủ kho có mật khẩu và Zalo.
- Các bước: (1) `chizalo.vcr` đăng nhập Zalo, gọi API_17 `DELETE` liên kết Zalo. (2) Thủ kho hủy liên kết Zalo. (3) Thủ kho gọi `DELETE /me/identities/{liên kết của chizalo.vcr}`.
- Kết quả mong đợi: Bước 1 bị từ chối "Bạn cần giữ ít nhất một cách đăng nhập.". Bước 2 thành công. Bước 3 nhận `404`.
- Kiểm thử tự động: Tự động API
- Lát: L6

## Kiểm tra bảo mật phần C chung

### KICHBAN_KIEMTHU_116: Gọi mọi API cần đăng nhập khi chưa đăng nhập
- Tiêu chí nghiệm thu: Không gắn tiêu chí; kiểm tra bảo mật phần C mục 3
- Chức năng: Mọi chức năng
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập; token truy cập hết hạn
- Điều kiện ban đầu và dữ liệu: Danh sách endpoint của tài liệu `17` trừ endpoint công khai.
- Các bước: (1) Gọi từng endpoint không có cookie, không có token. (2) Gọi với token truy cập quá 15 phút (đồng hồ giả lập).
- Kết quả mong đợi: Mọi lần nhận `401 UNAUTHENTICATED`, không lộ dữ liệu.
- Kiểm thử tự động: Tự động API
- Lát: L1 (thêm endpoint mới ở mỗi lát)

### KICHBAN_KIEMTHU_117: Ma trận phân quyền theo từng vai trò và từng công ty
- Tiêu chí nghiệm thu: Không gắn tiêu chí; kiểm tra bảo mật phần C mục 3
- Chức năng: Mọi chức năng
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị tập đoàn; quản trị công ty VCR; quản lý tỷ giá; nhân viên
- Điều kiện ban đầu và dữ liệu: Ma trận tài liệu `22` mục 4. Mã bản ghi của VCR và VCT cho từng loại dữ liệu.
- Các bước: (1) Mỗi vai trò gọi mọi endpoint quản trị trong công ty mình. (2) Quản trị VCR gọi với mã bản ghi của VCT. (3) Nhân viên gọi API_18, API_40 với mã của người khác.
- Kết quả mong đợi: Kết quả khớp ma trận: ô "Không" nhận `403`; bản ghi ngoài phạm vi nhận `404`.
- Kiểm thử tự động: Tự động API
- Lát: L2 (thêm endpoint mới ở mỗi lát)

### KICHBAN_KIEMTHU_118: Dữ liệu đầu vào độc hại
- Tiêu chí nghiệm thu: Không gắn tiêu chí; kiểm tra bảo mật phần C mục 4
- Chức năng: CHUC_NANG_01, CHUC_NANG_02, CHUC_NANG_04, CHUC_NANG_23
- Loại: Bảo mật
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Chuỗi `' OR 1=1 --`; chuỗi `<script>alert(1)</script>`; chuỗi 10.000 ký tự; trường thừa `isAdmin`.
- Các bước: (1) Gửi các chuỗi vào tên công ty, tên chi nhánh, họ tên khi mời, tham số `q` của API_24, API_47. (2) Mở MAN_HINH_09, MAN_HINH_12 xem dữ liệu đã lưu.
- Kết quả mong đợi: Chuỗi quá dài và trường thừa nhận `400`. Chuỗi chèn truy vấn không đổi kết quả lọc. Chuỗi chèn mã hiện nguyên văn, không chạy.
- Kiểm thử tự động: Tự động API
- Lát: L3

### KICHBAN_KIEMTHU_119: Phiên, đăng xuất, token làm mới dùng lại, chống giả mạo yêu cầu
- Tiêu chí nghiệm thu: Không gắn tiêu chí; kiểm tra bảo mật phần C mục 5
- Chức năng: CHUC_NANG_06, CHUC_NANG_10
- Loại: Bảo mật
- Vai trò thực hiện: Nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Một phiên web.
- Các bước: (1) Xem thuộc tính cookie phiên. (2) Gọi API_09, rồi gọi lại API_09 bằng token làm mới cũ. (3) Gọi thao tác ghi API_15 không có `X-CSRF-Token`. (4) Gọi API_10, rồi dùng lại cookie cũ.
- Kết quả mong đợi: Cookie có `HttpOnly`, `Secure`, `SameSite=Lax`. Bước 2: lần dùng lại bị từ chối và cả chuỗi phiên bị thu hồi. Bước 3 bị từ chối. Bước 4: cookie cũ nhận `401`.
- Kiểm thử tự động: Tự động API
- Lát: L1

### KICHBAN_KIEMTHU_120: Giới hạn số yêu cầu của API không cần đăng nhập
- Tiêu chí nghiệm thu: Không gắn tiêu chí; kiểm tra bảo mật phần C mục 5
- Chức năng: CHUC_NANG_06, CHUC_NANG_08
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Một địa chỉ IP thử; đồng hồ giả lập.
- Các bước: (1) Gọi API_12 20 lần trong một phút. (2) Gọi lần thứ 21. (3) Sang phút sau gọi lại.
- Kết quả mong đợi: 20 lần đầu trả `204`. Lần 21 nhận `429 RATE_LIMITED`. Bước 3 trả `204`.
- Kiểm thử tự động: Tự động API
- Lát: L1

## CHUC_NANG_25: Cài đặt tích hợp (CONG_VIEC_03)

Nguồn giả trong kiểm thử: eSMS.vn, nhà cung cấp OAuth, S3 thay bằng nguồn giả (`apps/api/test/setup-database.ts`), không gọi mạng ngoài (CONG_VIEC_03 mục 12).

### KICHBAN_KIEMTHU_121: Chỉ quản trị tập đoàn mở được Cài đặt tích hợp
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_49
- Chức năng: CHUC_NANG_25
- Loại: Phân quyền
- Vai trò thực hiện: Quản trị tập đoàn `quantri.tapdoan@vcomm.test`; quản trị công ty `quantri.vcr@vcomm.test`; nhân viên `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chưa có cài đặt tích hợp.
- Các bước: (1) Quản trị công ty, nhân viên gọi `GET /integration-settings`, `PUT /integration-settings` với `google.client_id`, `POST /integration-settings/test` (API_49). (2) Quản trị tập đoàn gọi `GET /integration-settings`.
- Kết quả mong đợi: Bước 1 mọi lần nhận `403`, không có dòng `integration_settings` mới. Bước 2 trả `200` kèm `callbackUrls.google` kết thúc bằng `/api/v1/auth/oauth/google/callback`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-integrations.test.ts`
- Lát: L6a

### KICHBAN_KIEMTHU_122: Khóa bí mật không trả đầy đủ qua API, nhật ký, cơ sở dữ liệu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_48
- Chức năng: CHUC_NANG_25
- Loại: Bảo mật
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Client secret thử `GOCSPX-bi-mat-google-rat-dai-9876`.
- Các bước: (1) `PUT /integration-settings` với `google.client_id` = `123.apps.googleusercontent.com`, `google.client_secret` = khóa thử. (2) Đọc kết quả, cột `plain_value`, `secret_value` của `core.integration_settings`. (3) Đọc `after_data` của nhật ký `integration_settings.update`.
- Kết quả mong đợi: Kết quả có `google.client_secret` với `secret: true`, `value: null`, `lastFour: "9876"`; không chuỗi nào chứa khóa đầy đủ; `google.client_id` trả giá trị thường. `plain_value` trống, `secret_value` không chứa chữ của khóa. Nhật ký không chứa khóa đầy đủ, chỉ có `••••9876`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-integrations.test.ts`
- Lát: L6a

### KICHBAN_KIEMTHU_123: Để trống, xóa khóa và hiệu lực ngay không cần khởi động lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_48
- Chức năng: CHUC_NANG_25
- Loại: Giá trị biên
- Vai trò thực hiện: Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Đã lưu khóa ở KICHBAN_KIEMTHU_122; eSMS giả trả danh sách Zalo OA `4097311281936189049` "VComm".
- Các bước: (1) Lưu `google.client_secret` = "" và `google.client_id` = "". (2) Lưu với `clear` = [`google.client_secret`]. (3) Lưu khóa lạ `khong.co`. (4) Gọi `POST /integration-settings/test` khi chưa có khóa eSMS. (5) Lưu `esms.api_key`, `esms.secret_key`, gọi lại kiểm tra ngay, không khởi động lại máy chủ. (6) Cho eSMS giả trả lỗi, gọi lại kiểm tra. (7) Gọi `GET /integration-settings/deliveries`. (8) Quản trị công ty gọi `POST /integration-settings/test-message`. (9) Gửi thử tới số "abc". (10) Gửi thử tới `0909000111` khi chưa có Brandname, rồi sau khi lưu Brandname "VCOMM".
- Kết quả mong đợi: Bước 1: khóa bí mật vẫn `lastFour: "9876"`, `google.client_id` thành chưa cài. Bước 2: khóa bí mật thành chưa cài. Bước 3 nhận `400`. Bước 4: `ok: false`, `message: "esmsMissing"`. Bước 5: `ok: true`, có Zalo OA. Bước 6: `ok: false`. Bước 7 trả `200`. Bước 8 nhận `403`. Bước 9 nhận `400`. Bước 10: lần đầu `message: "esmsMissing"`; lần sau `ok: true`, `message: "testSent"`, eSMS giả nhận một tin tới `+84909000111`, nhật ký gửi tin mới nhất có mục đích `test`, trạng thái đã gửi.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-integrations.test.ts`
- Lát: L6a

## CHUC_NANG_08, CHUC_NANG_07: Mã OTP đa kênh, cách đăng nhập theo cài đặt (CONG_VIEC_03)

### KICHBAN_KIEMTHU_124: Mã OTP gửi SMS khi chưa cài ZNS, gửi Zalo rồi SMS khi đã cài
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_51
- Chức năng: CHUC_NANG_08, CHUC_NANG_25
- Loại: Đúng
- Vai trò thực hiện: Chưa đăng nhập; quản trị tập đoàn (cài đặt)
- Điều kiện ban đầu và dữ liệu: `phuc.le@vcomm.test` có số `+84901234567`. Chưa cài eSMS.
- Các bước: (1) Gọi API_54; gọi API_02 với `0901234567`. (2) Cài `esms.api_key`, `esms.secret_key`, `esms.brandname` = `VCOMM`; gọi API_54; gọi API_02 với số chưa gắn tài khoản `0999999999` và với `abc`. (3) Gọi API_02 với `0901234567`. (4) Cài `esms.oa_id`, `esms.template.login_otp` = `205644`; gọi lại API_02. (5) Đọc `core.message_deliveries` mục đích `login_otp`.
- Kết quả mong đợi: Bước 1: API_54 trả `{ password: true, phone: false, google: false, microsoft: false, zalo: false }`; API_02 trả `204`, không gửi tin, nhật ký ghi `skipped`. Bước 2: API_54 có `phone: true`; số chưa gắn tài khoản trả `204` không gửi; `abc` nhận `400`. Bước 3: gửi SMS (không có mã OA, mẫu tin), Brandname `VCOMM`. Bước 4: gửi đa kênh với OA `4097311281936189049`, mẫu `205644`. Bước 5: kênh lần lượt `sms`, `sms`, `zns_sms`; số điện thoại hiện `+8490***4567`; không dòng nào chứa mã OTP.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-login.test.ts`
- Lát: L6b

### KICHBAN_KIEMTHU_125: Nhập mã OTP sai, dùng lại, quá số lần
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14, TIEUCHI_NGHIEMTHU_51
- Chức năng: CHUC_NANG_08
- Loại: Giá trị biên
- Vai trò thực hiện: Chưa đăng nhập
- Điều kiện ban đầu và dữ liệu: Đã cài eSMS (KICHBAN_KIEMTHU_124); bảng `otp_codes` trống.
- Các bước: (1) Gửi mã, nhập mã sai. (2) Nhập mã đúng. (3) Nhập lại mã vừa dùng. (4) Gửi mã mới, nhập sai 5 lần rồi nhập đúng. (5) Gửi mã 5 lần rồi lần thứ 6 trong cùng một giờ.
- Kết quả mong đợi: Bước 1 nhận `401` "Mã không đúng hoặc đã hết hạn.". Bước 2 trả `200`, đúng mã tài khoản của `phuc.le`. Bước 3, 4 nhận `401`. Bước 5: 5 lần đầu `204`, lần 6 nhận `429` "Bạn đã yêu cầu quá nhiều mã, thử lại sau.".
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-login.test.ts`
- Lát: L6b

### KICHBAN_KIEMTHU_126: Nút đăng nhập theo cài đặt, Microsoft theo tenant, kích hoạt bằng Google
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_13, TIEUCHI_NGHIEMTHU_48
- Chức năng: CHUC_NANG_07, CHUC_NANG_04, CHUC_NANG_25
- Loại: Bảo mật
- Vai trò thực hiện: Chưa đăng nhập; quản trị công ty `quantri.vcr@vcomm.test` (mời)
- Điều kiện ban đầu và dữ liệu: Nhà cung cấp OAuth giả lập. Chưa cài Google.
- Các bước: (1) Gọi API_04 `google` khi chưa cài; gọi API_04 với nhà cung cấp `facebook`. (2) Cài Google ở API_49, đi qua API_04, API_05 ngay, không khởi động lại. (3) Gọi API_05 với `state` sai; nhà cung cấp trả lỗi đổi mã. (4) Cài Microsoft, tenant để trống (`organizations`); nhà cung cấp giả trả email `phuc.le@vcomm.test` không được tin (tài khoản thuộc tenant khác tenant đã cài); rồi trả cùng email được tin (tenant của công ty). (5) Mời `kichhoat.google@vcomm.test`; kích hoạt bằng Google (`mode=activate`) với tài khoản Google email khác; rồi với đúng email; rồi dùng lại đường dẫn; rồi đăng nhập Google.
- Kết quả mong đợi: Bước 1 chuyển về `/dang-nhap?loi=oauthNotConfigured` và `loi=notFound`. Bước 2 chuyển tới nhà cung cấp (lưu xong có hiệu lực ngay). Bước 3 về `loi=oauthFailed`, không tạo phiên. Bước 4: lần đầu về `loi=providerNotLinked`, không gắn theo email; lần sau đăng nhập được. Bước 5: email khác về `/kich-hoat?token=...&loi=activationEmailMismatch`, tài khoản vẫn "Đã mời"; đúng email về `/dang-nhap?kichHoat=google`, tài khoản "Đang hoạt động"; dùng lại nhận `loi=activationInvalid`; đăng nhập Google thành công.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-login.test.ts`
- Lát: L6b, L6c

## CHUC_NANG_26: Thông báo Zalo ZNS (CONG_VIEC_03)

### KICHBAN_KIEMTHU_127: Mỗi sự kiện duyệt gửi đúng một tin ZNS theo mẫu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_50
- Chức năng: CHUC_NANG_26, CHUC_NANG_16, CHUC_NANG_18
- Loại: Đúng
- Vai trò thực hiện: Người lập `lap.zns@vcomm.test` (tạo trong kiểm thử, vai trò Nhân viên ở VCR, số `+84922222222`); người duyệt `phuc.le@vcomm.test` (số `+84911111111`)
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `platform.test_document` ở VCR một cấp: người duyệt `phuc.le`, thay thế `quantri.vcr`, thời hạn 4 giờ. Đồng hồ giả lập.
- Các bước: (1) Chưa cài mẫu tin: gửi chứng từ 1.000.000 VND, đẩy outbox. (2) Cài khóa eSMS, OA, mẫu `approval_assigned` = 301, `approval_reminder` = 302, `approval_completed` = 303; gửi chứng từ 80.000.000 VND, đẩy outbox hai lần. (3) Người duyệt từ chối "Thiếu báo giá", đẩy outbox. (4) Gửi chứng từ lúc 8:00, chạy kiểm tra quá hạn lúc 12:30, đẩy outbox.
- Kết quả mong đợi: Bước 1: không có tin ZNS; người duyệt vẫn có thông báo trong ứng dụng. Bước 2: người duyệt nhận đúng một tin mẫu 301 với `document_type` "Chứng từ thử", `amount` "80.000.000 VND", `requester` "Ngô Văn Lập", `result` "Chờ duyệt". Bước 3: người lập nhận đúng một tin mẫu 303 với `result` "Bị từ chối". Bước 4: người duyệt nhận đúng một tin mẫu 302.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-zns.test.ts`
- Lát: L9

### KICHBAN_KIEMTHU_128: eSMS lỗi hoặc người nhận không có số điện thoại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_50
- Chức năng: CHUC_NANG_26
- Loại: Sai
- Vai trò thực hiện: Như KICHBAN_KIEMTHU_127
- Điều kiện ban đầu và dữ liệu: Đã cài mẫu tin (KICHBAN_KIEMTHU_127). eSMS giả trả lỗi `101: Authorize Failed`.
- Các bước: (1) Gửi chứng từ 3.000.000 VND, đẩy outbox hai lần. (2) Đọc dòng `message_deliveries` mục đích `approval.assigned` mới nhất. (3) Người duyệt đồng ý. (4) Xóa số điện thoại của người duyệt, gửi chứng từ 4.000.000 VND, đẩy outbox.
- Kết quả mong đợi: Bước 1: chỉ một lần gọi gửi, không gửi lại khi đẩy outbox lần hai. Bước 2: `status = failed`, `error = 101: Authorize Failed`. Bước 3: yêu cầu "Đã duyệt" (luồng duyệt không bị chặn). Bước 4: không gửi tin nào.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-zns.test.ts`
- Lát: L9

## CHUC_NANG_27, CHUC_NANG_28, CHUC_NANG_29: Mẫu đề xuất, đề xuất, in PDF (CONG_VIEC_03)

Dữ liệu chung: người lập `lap.dexuat@vcomm.test` "Trịnh Thị Đề Xuất", người ngoài `nguoi.ngoai@vcomm.test` (tạo trong kiểm thử, vai trò Nhân viên ở VCR); người duyệt `phuc.le@vcomm.test`; quản trị `quantri.vcr@vcomm.test`. Chính sách duyệt của từng mẫu một cấp: người duyệt `phuc.le`, thay thế `quantri.vcr`.

### KICHBAN_KIEMTHU_129: Mẫu và đề xuất sai kiểu, thiếu trường bắt buộc
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_52
- Chức năng: CHUC_NANG_27, CHUC_NANG_28
- Loại: Sai
- Vai trò thực hiện: Người lập; quản trị công ty
- Điều kiện ban đầu và dữ liệu: Chưa có mẫu đề xuất ở VCR.
- Các bước: (1) Người lập gọi `POST /proposal-templates/defaults`. (2) Quản trị gọi lại hai lần. (3) Quản trị tạo mẫu `XX` có hai trường cùng mã `a`, trường thứ hai kiểu danh sách chọn không có lựa chọn, giá trị duyệt là trường chữ `a`; tạo mẫu trùng mã `PC`. (4) Người lập lưu nháp phiếu chi với `amount` = "mười triệu", `payment_method` = "Séc", `due_date` = "2026-13-40". (5) Lưu nháp đúng kiểu thiếu người nhận tiền, lý do; gửi duyệt. (6) Lưu `amount` = "12500000.5" (VND).
- Kết quả mong đợi: Bước 1 nhận `403`. Bước 2: lần đầu tạo MS, PC, TU kèm loại chứng từ `platform.proposal_vcr_pc`... và dãy số tiền tố PC, số kế tiếp `PC-VCR-2026-000001`; lần sau vẫn 3 mẫu. Bước 3: `400` tại đúng `fields.1.key`, `fields.1.options`, `amountField`; mẫu trùng mã nhận `code` "Mã mẫu đã có trong công ty.". Bước 4: `400` tại `values.amount`, `values.payment_method`, `values.due_date` "Giá trị không hợp lệ.". Bước 5: nháp tạo được (`proposalNo` trống); gửi nhận `400` tại `values.recipient`, `values.reason` "Vui lòng nhập thông tin này.". Bước 6: `400` tại `values.amount`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-proposals.test.ts`
- Lát: L10a

### KICHBAN_KIEMTHU_130: Gửi đề xuất nhận số, đi qua chính sách duyệt, giữ bản chụp mẫu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_53
- Chức năng: CHUC_NANG_28, CHUC_NANG_27, CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Người lập; người duyệt; quản trị công ty
- Điều kiện ban đầu và dữ liệu: 3 mẫu có sẵn (KICHBAN_KIEMTHU_129).
- Các bước: (1) Lập đề nghị tạm ứng 5.000.000 VND, gửi khi chưa có chính sách duyệt; tạo chính sách rồi gửi lại. (2) Lập phiếu chi 12.500.000 VND đủ trường, gửi; người duyệt xem yêu cầu duyệt; người lập sửa đề xuất. (3) Người duyệt đồng ý "Đồng ý". (4) Quản trị sửa mẫu PC (tên "Phiếu chi (mới)", còn một trường); xem lại phiếu chi đã gửi. (5) Lập đề nghị mua sắm 2 dòng (8.000.000 và 1.200.000), gửi, rút. (6) Người lập, quản trị xem danh sách `scope=mine`, `scope=company`.
- Kết quả mong đợi: Bước 1: lần đầu `409`, đề xuất vẫn Nháp, số không bị dùng; lần sau số `TU-VCR-2026-000001`. Bước 2: số `PC-VCR-2026-000001`, `status: pending`, `canWithdraw: true`; yêu cầu duyệt có cùng số, giá trị 12.500.000, mã chứng từ là đề xuất; sửa nhận `409`. Bước 3: đề xuất "Đã duyệt". Bước 4: đề xuất vẫn tên mẫu "Phiếu đề nghị chi" với 6 trường. Bước 5: giá trị duyệt 9.200.000; sau rút "Đã rút". Bước 6: người lập thấy 4 đề xuất của mình, `scope=company` nhận `403`; quản trị thấy 4 đề xuất toàn công ty.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-proposals.test.ts`
- Lát: L10a

### KICHBAN_KIEMTHU_131: Tệp đính kèm sai loại, quá lớn, quá số lượng, người ngoài tải
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_54
- Chức năng: CHUC_NANG_28
- Loại: Bảo mật
- Vai trò thực hiện: Người lập; người ngoài; người duyệt
- Điều kiện ban đầu và dữ liệu: Phiếu chi nháp 1.000.000 VND; tệp PDF thử bắt đầu bằng `%PDF-1.4`.
- Các bước: (1) Tải lên `ghi-chu.txt`. (2) Tải lên `hoa-don.pdf` có nội dung HTML. (3) Tải lên PDF lớn hơn 10 MB. (4) Tải lên `Hóa đơn GTGT số 123.pdf`. (5) Người ngoài tải lên tệp cho đề xuất này. (6) Tải lên thêm 9 tệp, rồi tệp thứ 11. (7) Người lập tải tệp; người ngoài tải tệp. (8) Gửi đề xuất; người duyệt tải tệp; người lập xóa tệp.
- Kết quả mong đợi: Bước 1 nhận `400`. Bước 2 nhận `400` tại `file` "Chỉ nhận tệp PDF, JPG, PNG, XLSX, DOCX.". Bước 3 nhận `400` tại `file` "Tệp vượt quá 10 MB.". Bước 4 trả `201`, giữ tên tiếng Việt, loại `application/pdf`. Bước 5 nhận `404`. Bước 6: 9 tệp `201`, tệp thứ 11 nhận `409`. Bước 7: người lập `200` kèm `Content-Disposition` tên UTF-8; người ngoài `404`. Bước 8: người duyệt `200`; xóa tệp nhận `409`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-proposals.test.ts`
- Lát: L10a

### KICHBAN_KIEMTHU_132: In đề xuất PDF tiếng Việt đúng dấu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_55
- Chức năng: CHUC_NANG_29
- Loại: Đúng
- Vai trò thực hiện: Người lập; người ngoài
- Điều kiện ban đầu và dữ liệu: Phiếu chi `PC-VCR-2026-000001` đã duyệt và đề nghị mua sắm "Mua máy in" (KICHBAN_KIEMTHU_130). Công cụ `pdftotext` để đọc chữ trong tệp.
- Các bước: (1) Người lập gọi API_53 cho hai đề xuất. (2) Người ngoài gọi API_53 cho phiếu chi. (3) Đọc chữ trong tệp PDF bằng `pdftotext -layout`. (4) Mở tệp PDF bằng trình xem, kiểm tra bằng mắt.
- Kết quả mong đợi: Bước 1: `200`, `application/pdf`, tệp bắt đầu bằng `%PDF-`. Bước 2 nhận `404`. Bước 3: phiếu chi có "Công ty Cổ phần VComm Bán lẻ Miền Nam", "PHIẾU ĐỀ NGHỊ CHI", "PC-VCR-2026-000001", "Người nhận tiền", "Nhà hàng Sen", "12.500.000 VND", "Các cấp duyệt", "Lê Văn Phúc", "Đã duyệt", "Đồng ý"; đề nghị mua sắm có "Hàng hóa, dịch vụ cần mua", "Hộp mực". Bước 4: chữ tiếng Việt đúng dấu, bảng không tràn trang.
- Kiểm thử tự động: Tự động API – `apps/api/test/c3-proposals.test.ts` (bước 3 chỉ chạy khi máy có `pdftotext`); bước 4 thủ công tại điểm báo lát L10b
- Lát: L10b

## MODULE_02 Sản phẩm và Nhà bán (phần Sản phẩm, CONG_VIEC_04)

Dữ liệu chung: công ty VCR (`testIds.retailCompany`), VCT (`testIds.tradingCompany`); đơn vị tính có sẵn của database migration 0003; ngành hàng, sản phẩm tạo trong từng tệp kiểm thử. Công ty đang làm việc chọn bằng header `X-Company-Id`. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_30: Ngành hàng và đơn vị tính (CONG_VIEC_04)

### KICHBAN_KIEMTHU_133: Chỉ quản trị tập đoàn sửa ngành hàng, đơn vị tính
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_56
- Chức năng: CHUC_NANG_30
- Loại: Phân quyền
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test` (không có quyền mini app Sản phẩm); Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Đơn vị tính có sẵn.
- Các bước: (1) Nhân viên gọi `GET /catalog/categories`. (2) Quản trị công ty gọi `GET /catalog/categories`. (3) Quản trị công ty gọi `POST /catalog/categories` mã `XX`, `POST /catalog/units` mã `CUON`. (4) Quản trị công ty gọi `GET /catalog/units`.
- Kết quả mong đợi: Bước 1 nhận `403`. Bước 2 trả `200`. Bước 3 nhận `403` cả hai lần. Bước 4 có `CAI`, `THUNG`, `KG`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-categories.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_134: Tối đa 4 cấp; trùng mã, vòng, vừa lô vừa serial bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_56
- Chức năng: CHUC_NANG_30
- Loại: Sai, giá trị biên
- Vai trò thực hiện: Quản trị tập đoàn `quantri.tapdoan@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chưa có ngành hàng.
- Các bước: (1) Tạo `dt` (serial, bảo hành 12 tháng), rồi `DTDD`, `DTTM`, `DTCC` lần lượt là con. (2) Tạo `DTQ` con của `DTCC`. (3) Tạo lại `DT`. (4) Tạo `TP` bật cả lô và serial. (5) Sửa `DT` có cha là `DTTM`. (6) Tạo `GD`, `GDBEP` con của `GD`; chuyển `DTDD` (nhánh 3 cấp) vào dưới `GDBEP`. (7) Chuyển `DTTM` vào dưới `GD`; xem danh sách.
- Kết quả mong đợi: Bước 1: mã đổi thành `DT`, cấp 1; `DTCC` cấp 4. Bước 2: `400`, chỉ trường `parentId` "Ngành hàng tối đa 4 cấp.". Bước 3: `code` "Mã ngành hàng đã có.". Bước 4: chỉ trường `tracksSerials`. Bước 5: `parentId` "Không chọn được ngành hàng con của chính nó làm ngành hàng cha.". Bước 6: `parentId` "Ngành hàng tối đa 4 cấp.". Bước 7: `DTTM` cấp 2, `DTCC` cấp 3.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-categories.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_135: Ngành hàng đã có sản phẩm; ngừng dùng, dùng lại; sai phiên bản
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_56
- Chức năng: CHUC_NANG_30
- Loại: Sai
- Vai trò thực hiện: Quản trị tập đoàn `quantri.tapdoan@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Ngành hàng `MP` có một sản phẩm (chèn thẳng vào cơ sở dữ liệu).
- Các bước: (1) Tạo `MPKD` con của `MP`. (2) Đổi mã `MP` thành `MPX`. (3) Ngừng dùng `MP`. (4) Dùng lại với phiên bản cũ, rồi với phiên bản mới. (5) Đọc nhật ký thao tác của `MP`.
- Kết quả mong đợi: Bước 1: `parentId` "Ngành hàng này đã có sản phẩm nên không thêm được ngành hàng con.". Bước 2: `code` "Ngành hàng đã có sản phẩm, không đổi được mã.". Bước 3: `status: inactive`, `productCount: 1`. Bước 4: lần đầu `409`, lần sau `active`. Bước 5: `category.create`, `category.deactivate`, `category.activate`, mini app `catalog`. Không có API xóa ngành hàng.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-categories.test.ts`
- Lát: L1

Kiểm thử bổ sung không có mã kịch bản (`c4-categories.test.ts`, "đơn vị tính: trùng mã bị từ chối; thêm, sửa, ngừng dùng"): tạo đơn vị `cai` bị từ chối "Mã đơn vị tính đã có."; tạo `cuon` thành `CUON`, sửa tên, ngừng dùng.

## CHUC_NANG_31, CHUC_NANG_32: Sản phẩm, biến thể, mã hàng, mã vạch, ảnh (CONG_VIEC_04)

Dữ liệu chung: ngành hàng `DT` (serial, 12 tháng) → `DTDD`; `AO` → `AOTH`. Sản phẩm điện thoại: 2 thuộc tính Màu (Đen, Trắng), Dung lượng (128GB, 256GB), đơn vị cơ sở Cái, đơn vị quy đổi Hộp hệ số 1, mã vạch `8930000000011` ở biến thể đầu.

### KICHBAN_KIEMTHU_136: Hai thuộc tính phân loại sinh 4 biến thể; công ty khác không đọc được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_57
- Chức năng: CHUC_NANG_31, CHUC_NANG_32
- Loại: Đúng, phân quyền
- Vai trò thực hiện: Nhân viên `thukho.bd@vcomm.test` (không có quyền mini app Sản phẩm); Quản trị công ty `quantri.vcr@vcomm.test`; Quản trị tập đoàn `quantri.tapdoan@vcomm.test` (làm việc ở VCT)
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung.
- Các bước: (1) Nhân viên gọi `GET /catalog/products`. (2) Quản trị VCR tạo sản phẩm điện thoại, trọng lượng `0,25`. (3) Tạo áo thun không phân loại, mã vạch `8930000000028`. (4) Quản trị tập đoàn với `X-Company-Id` = VCT đọc chi tiết, danh sách, sửa sản phẩm điện thoại.
- Kết quả mong đợi: Bước 1 nhận `403`. Bước 2: `201`, mã `DTDD-00001`, `weightKg` `0.25`; biến thể `DTDD-00001-01` đến `DTDD-00001-04`; mã vạch ở biến thể đầu. Bước 3: mã `AOTH-00001`, một biến thể mã `AOTH-00001`. Bước 4: chi tiết `404`, danh sách `total` 0, sửa `404`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-products.test.ts`
- Lát: L2

### KICHBAN_KIEMTHU_137: Sửa sản phẩm: bỏ biến thể, chuyển mã vạch, sai phiên bản
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_57
- Chức năng: CHUC_NANG_31, CHUC_NANG_32
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Sản phẩm điện thoại ở KICHBAN_KIEMTHU_136.
- Các bước: (1) Sửa tên, giữ 3 biến thể đầu, chuyển mã vạch sang biến thể thứ hai. (2) Gửi lại với phiên bản cũ. (3) Ngừng bán sản phẩm. (4) Tìm sản phẩm đang bán theo `VPhone`.
- Kết quả mong đợi: Bước 1: `200`; trạng thái biến thể `active`, `active`, `active`, `inactive`; mã vạch ở biến thể thứ hai. Bước 2: `409`. Bước 3: `inactive`. Bước 4: `total` 0.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-products.test.ts`
- Lát: L2

## CHUC_NANG_32: Trùng mã hàng, mã vạch, đơn vị sai (CONG_VIEC_04)

### KICHBAN_KIEMTHU_138: Trùng mã hàng, mã vạch, đơn vị sai bị từ chối, chỉ ra đúng dòng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_58
- Chức năng: CHUC_NANG_32
- Loại: Sai
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`; Quản trị tập đoàn `quantri.tapdoan@vcomm.test` (VCT)
- Điều kiện ban đầu và dữ liệu: Sản phẩm ở KICHBAN_KIEMTHU_136.
- Các bước: (1) Tạo áo thun dùng lại mã vạch `8930000000028`. (2) Tạo với mã hàng `aoth-00001`. (3) Đơn vị quy đổi Cái hệ số 2 (trùng đơn vị cơ sở) và Thùng hệ số 0. (4) Chọn ngành hàng `AO` (có ngành hàng con). (5) Điện thoại có biến thể trùng tổ hợp và biến thể giá trị `Xanh` không có trong thuộc tính. (6) Quản trị tập đoàn tạo ở VCT áo thun cùng mã vạch `8930000000028`.
- Kết quả mong đợi: Bước 1: `400` chỉ `variants.0.barcodes.0.barcode` "Mã vạch đã có trong công ty.". Bước 2: chỉ `variants.0.sku` "Mã hàng đã có trong công ty.". Bước 3: `units.0.unitId`, `units.1.factor`. Bước 4: `categoryId` "Chỉ chọn ngành hàng cuối cùng (không có ngành hàng con).". Bước 5: `variants.1.optionValues`, `variants.2.optionValues`. Bước 6: `201`, mã `AOTH-00001` (mã vạch, mã hàng chỉ duy nhất trong công ty).
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-products.test.ts`
- Lát: L2

## CHUC_NANG_31: Ảnh, tìm kiếm (CONG_VIEC_04)

### KICHBAN_KIEMTHU_139: Ảnh sai loại, quá 5 MB, quá 10 ảnh; công ty khác không tải được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_63
- Chức năng: CHUC_NANG_31
- Loại: Sai, bảo mật
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`; Quản trị tập đoàn `quantri.tapdoan@vcomm.test` (VCT)
- Điều kiện ban đầu và dữ liệu: Áo thun cổ tròn ở VCR; tệp PNG thử (chữ ký `89 50 4E 47`).
- Các bước: (1) Tải lên `anh.png` có nội dung chữ. (2) Tải lên PNG lớn hơn 5 MB. (3) Tải lên `Áo thun mặt trước.png`. (4) Tải thêm 9 ảnh, rồi ảnh thứ 11. (5) Xem danh sách sản phẩm; tải ảnh qua `?companyId=`. (6) Quản trị tập đoàn ở VCT tải ảnh đó. (7) Đặt ảnh thứ tư làm ảnh đại diện; xóa ảnh đầu.
- Kết quả mong đợi: Bước 1: `file` "Chỉ nhận ảnh JPG, PNG, WEBP.". Bước 2: `file` "Ảnh vượt quá 5 MB.". Bước 3: `201`, giữ tên tiếng Việt, `image/png`. Bước 4: 9 ảnh `201`, ảnh 11 nhận `409`. Bước 5: `imageId` là ảnh đầu; tải về `200`, `image/png`. Bước 6: `404`. Bước 7: `204`, ảnh thứ tư lên đầu; xóa `204`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-products.test.ts`
- Lát: L2

### KICHBAN_KIEMTHU_140: Tìm không dấu, theo mã vạch, mã hàng; danh sách 10.000 sản phẩm
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_64
- Chức năng: CHUC_NANG_31
- Loại: Đúng, hiệu năng
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Sản phẩm của các kịch bản trên; thêm 10.000 sản phẩm thử chèn thẳng vào cơ sở dữ liệu.
- Các bước: (1) Tìm `ao thun`. (2) Tìm `8930000000028`. (3) Tìm `dtdd-00001-02`. (4) Chèn 10.000 sản phẩm; đo thời gian `GET /catalog/products?pageSize=20`.
- Kết quả mong đợi: Bước 1: đúng một kết quả "Áo thun cổ tròn". Bước 2: `total` 1. Bước 3: sản phẩm `DTDD-00001`. Bước 4: `total` trên 10.000; dưới 500 mili giây (đo trên máy chạy kiểm thử).
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-products.test.ts`
- Lát: L2

## CHUC_NANG_33: Nhập sản phẩm từ Excel (CONG_VIEC_04)

Dữ liệu chung: ngành hàng `AO` → `AOTH`; `SUA` (theo dõi lô).

### KICHBAN_KIEMTHU_141: Tệp mẫu; gộp dòng thành sản phẩm có phân loại; dòng lỗi có trong tệp lỗi
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_59
- Chức năng: CHUC_NANG_33
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tệp 5 dòng: 2 dòng `AOTH-TRON` (Màu Đen, Trắng; Cỡ M; thuế `8%`; `THUNG=24`); "Sữa tươi 1 lít" (`SUA`, Hộp, thuế 5, trọng lượng `1,05`); dòng mã ngành hàng `KHONGCO`; dòng mã vạch trùng dòng sữa.
- Các bước: (1) Tải tệp mẫu `GET /catalog/product-imports/template`. (2) Nhập tệp. (3) Đọc tệp dòng lỗi. (4) Xem chi tiết hai sản phẩm đã nhập.
- Kết quả mong đợi: Bước 1: dòng đầu đúng 17 cột mẫu. Bước 2: `201`, `createdProducts` 2, `createdVariants` 3, `failedRows` 2, lỗi ở dòng 5 (chứa "Mã ngành hàng") và dòng 6 ("Mã vạch đã có trong công ty."). Bước 3: cột đầu "Dòng", cột cuối là lý do. Bước 4: `AOTH-TRON` thuế `8`, phân loại Màu (Đen, Trắng), Cỡ (M), mã hàng `AOTH-TRON-01`, `AOTH-TRON-02`; sữa mã `SUA-00001`, theo dõi lô, trọng lượng `1.05`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-import-links.test.ts`
- Lát: L3

### KICHBAN_KIEMTHU_142: 2.000 dòng trong 30 giây; sai mẫu, quá 2.000 dòng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_59
- Chức năng: CHUC_NANG_33
- Loại: Giá trị biên, hiệu năng
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tệp 2.000 dòng áo thun, mỗi dòng một mã vạch khác nhau.
- Các bước: (1) Nhập tệp chỉ có cột "Cột lạ". (2) Nhập tệp 2.001 dòng. (3) Nhập tệp 2.000 dòng, đo thời gian.
- Kết quả mong đợi: Bước 1: `file` "Tệp không đúng mẫu.". Bước 2: bị từ chối tại `file`. Bước 3: `createdProducts` 2.000, `failedRows` 0, `errorFileUrl` trống; dưới 30 giây.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-import-links.test.ts`
- Lát: L3

## CHUC_NANG_34: Liên kết, sao chép sản phẩm giữa công ty (CONG_VIEC_04)

### KICHBAN_KIEMTHU_143: Sao chép, liên kết, gợi ý theo mã vạch; thiếu quyền ở công ty kia
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_60
- Chức năng: CHUC_NANG_34
- Loại: Đúng, phân quyền
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test` (chỉ có quyền ở VCR); Quản trị tập đoàn `quantri.tapdoan@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Sản phẩm `AOTH-TRON` ở VCR (KICHBAN_KIEMTHU_141).
- Các bước: (1) Quản trị VCR sao chép sang VCT. (2) Quản trị tập đoàn sao chép sang chính VCR. (3) Quản trị tập đoàn sao chép sang VCT; đọc sản phẩm mới ở VCT. (4) Xem liên kết từ VCR và từ VCT. (5) Liên kết thêm biến thể đã liên kết với VCT. (6) Bỏ một liên kết; xem gợi ý theo mã vạch; liên kết theo gợi ý hệ số `2`; xem từ VCT. (7) Quản trị VCR liên kết biến thể còn lại với biến thể ở VCT.
- Kết quả mong đợi: Bước 1: `403`. Bước 2: `400`. Bước 3: `201`; sản phẩm `AOTH-TRON` cùng phân loại, biến thể `AOTH-TRON-01`, `AOTH-TRON-02` kèm mã vạch, 1 đơn vị quy đổi. Bước 4: từ VCR hai liên kết tới "VComm Thương mại" hệ số `1`; từ VCT thấy "VComm Bán lẻ Miền Nam". Bước 5: `409`. Bước 6: bỏ liên kết `204`; một gợi ý mã vạch `8930000001001`; liên kết `factor` `2`; từ VCT hệ số `0.5`. Bước 7: `403`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-import-links.test.ts`
- Lát: L3

## CHUC_NANG_35, CHUC_NANG_36: Kênh bán, nhóm khách hàng, bảng giá (CONG_VIEC_04)

Dữ liệu chung: sản phẩm "Nước suối 500ml" (ngành hàng `NUOC`, đơn vị cơ sở Chai, Thùng hệ số 24) ở VCR. Người duyệt `phuc.le@vcomm.test`.

Kiểm thử bổ sung không có mã kịch bản (`c4-prices.test.ts`, mục "API_60: kênh bán, nhóm khách hàng"): nhân viên gọi `POST /catalog/sales-channels/defaults` nhận `403`; quản trị công ty gọi hai lần, lần đầu tạo `BAN_LE`, `BAN_SI`, `NOI_BO`, `SAN_VCOMM`, lần sau vẫn 4 kênh; nhóm khách `VIP` tạo được, tạo trùng nhận `code` "Mã đã có trong công ty.", sửa tên tăng phiên bản.

### KICHBAN_KIEMTHU_144: Bảng giá đang dùng không trùng; ngừng dùng rồi tạo được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_61
- Chức năng: CHUC_NANG_35, CHUC_NANG_36
- Loại: Sai, phân quyền
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`; Nhân viên `thukho.bd@vcomm.test` (không có quyền mini app Sản phẩm)
- Điều kiện ban đầu và dữ liệu: Kênh có sẵn, nhóm khách `VIP` ở trên.
- Các bước: (1) Tạo bảng giá chung `CHUNG`; tạo `CHUNG2` cũng chung. (2) Tạo `LE` (kênh Bán lẻ), `VIP` (nhóm VIP), `LE_VIP` (cả hai), `USD` (tiền tệ USD). (3) Tạo `LE2` kênh Bán lẻ. (4) Ngừng dùng `LE`; tạo lại `LE2`; dùng lại `LE`. (5) Nhân viên tạo bảng giá.
- Kết quả mong đợi: Bước 1: `CHUNG` `201`, kênh, nhóm trống, tiền tệ `VND`; `CHUNG2` `400` tại `channelId` "Đã có bảng giá đang dùng cùng kênh, nhóm khách hàng, tiền tệ.". Bước 2: đều tạo được. Bước 3: `400`. Bước 4: ngừng dùng được; `LE2` `201`; dùng lại `LE` nhận `409`. Bước 5: `403`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-prices.test.ts`
- Lát: L4

### KICHBAN_KIEMTHU_145: Tra giá theo thứ tự ưu tiên, theo ngày, theo đơn vị quy đổi
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_61
- Chức năng: CHUC_NANG_36, CHUC_NANG_37
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Bảng giá ở KICHBAN_KIEMTHU_144; chưa có chính sách duyệt `catalog.price_change` (giá ghi ngay khi gửi phiếu).
- Các bước: (1) Tra giá khi chưa có giá. (2) Gửi phiếu: `CHUNG` 5.000 hôm nay và 6.000 sau 10 ngày; `LE2` 5.500; `VIP` 4.500; `LE_VIP` 4.000. (3) Tra giá không kênh, nhóm; tại ngày +10, +9; kênh Bán lẻ; nhóm VIP; cả hai; kênh Bán sỉ. (4) Tra giá đơn vị Thùng; gửi phiếu Thùng 110.000 ở `CHUNG`; tra lại. (5) `GET /catalog/price-lists/{CHUNG}/prices?date=<ngày +10>`.
- Kết quả mong đợi: Bước 1: `404`. Bước 3: `CHUNG` 5.000; 6.000 hiệu lực ngày +10; 5.000; `LE2` 5.500; `VIP` 4.500; `LE_VIP` 4.000; Bán sỉ dùng `CHUNG`. Bước 4: 120.000 `fromBaseUnit: true`; sau phiếu 110.000 `fromBaseUnit: false`. Bước 5: có dòng 6.000 và dòng Thùng 110.000.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-prices.test.ts`
- Lát: L4

## CHUC_NANG_37: Phiếu điều chỉnh giá (CONG_VIEC_04)

### KICHBAN_KIEMTHU_146: Đổi giá ngay hoặc sau duyệt; từ chối, rút không đổi giá; lịch sử giữ giá cũ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_62
- Chức năng: CHUC_NANG_37, CHUC_NANG_36, CHUC_NANG_16
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test` (người lập); người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Bảng giá `CHUNG` có giá ở KICHBAN_KIEMTHU_145.
- Các bước: (1) Lập phiếu hiệu lực hôm qua, gửi; xóa phiếu. (2) Lập phiếu có dòng lặp và dòng đơn vị Kg (không thuộc sản phẩm). (3) Chưa có chính sách: gửi phiếu 7.000 hiệu lực ngày +20. (4) Tạo chính sách duyệt `catalog.price_change` một cấp (người duyệt `phuc.le`, thay thế `quantri.vcr`). (5) Gửi phiếu 8.000; tra giá; ngừng dùng `CHUNG`; người duyệt đồng ý, đẩy outbox. (6) Gửi phiếu 9.000, người duyệt từ chối. (7) Gửi phiếu 9.500, rút. (8) Xem lịch sử giá Chai; danh sách phiếu Đã duyệt; sửa phiếu đã gửi.
- Kết quả mong đợi: Bước 1: `effectiveFrom` "Ngày hiệu lực không được trước hôm nay."; xóa `204`. Bước 2: `lines.1.unitId` "Mặt hàng và đơn vị bị lặp.", `lines.2.variantId` "Giá trị không hợp lệ.". Bước 3: `approved`, không có yêu cầu duyệt, giá hiện hành lúc lập 6.000, số `DCG-VCR-<năm>-0000xx`; giá ngày +20 là 7.000. Bước 4: `201`. Bước 5: `pending`, `canWithdraw: true`, giá vẫn 7.000; ngừng dùng bảng giá nhận `409` thông báo có "chờ duyệt"; sau duyệt phiếu `approved`, giá 8.000. Bước 6: phiếu `rejected`. Bước 7: phiếu `withdrawn`, giá vẫn 8.000. Bước 8: lịch sử 8.000, 7.000, 6.000, 5.000; 8 phiếu Đã duyệt; sửa phiếu đã gửi nhận `409`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c4-prices.test.ts`
- Lát: L4

Kiểm thử bổ sung không có mã kịch bản (`c4-prices.test.ts`, "nhập dòng phiếu từ Excel"): tệp 4 dòng gọi `POST /catalog/price-changes/import-lines?priceListId=`; một dòng đúng `NUOC-00001` Thùng 100.000 kèm giá hiện hành 110.000; dòng 3, 4, 5 (mã hàng không có, đơn vị Kg, giá chữ) trả lỗi.

## MODULE_03 Kho (phần web, CONG_VIEC_05)

Dữ liệu chung: công ty sở hữu kho VCR (`testIds.retailCompany`), công ty chủ hàng VCT (`testIds.tradingCompany`); chi nhánh VCR-BD (`testIds.binhDuongWarehouse`), trụ sở (`testIds.headOfficeBranch`); đơn vị tính có sẵn của database migration 0003; ngành hàng, sản phẩm, kho, Thủ kho, Quản lý kho tạo trong từng tệp kiểm thử (Thủ kho gán ở phạm vi chi nhánh, Quản lý kho VCT gán ở phạm vi công ty VCT). Chính sách duyệt thử: một cấp, người duyệt `phuc.le@vcomm.test`, thay thế `quantri.vcr@vcomm.test`; sau khi quyết định thì đẩy outbox. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_38: Kho, vị trí, công ty chủ hàng (CONG_VIEC_05)

### KICHBAN_KIEMTHU_147: Kho thuộc chi nhánh, nhiều công ty chủ hàng; quyền chi nhánh khác không thấy kho; vị trí, cài đặt
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_65
- Chức năng: CHUC_NANG_38
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`; Thủ kho chi nhánh VCR-BD; Thủ kho trụ sở; Quản lý kho VCT; Nhân viên VCR (vai trò Nhân viên)
- Điều kiện ban đầu và dữ liệu: Chưa có kho.
- Các bước: (1) Thủ kho VCR-BD tạo kho `kho-bd` (chi nhánh VCR-BD, có vị trí, chủ hàng thêm VCT). (2) Quản trị công ty tạo kho đó; tạo lại cùng mã; tạo kho mã `KHAC` ở chi nhánh không thuộc công ty. (3) Thủ kho VCR-BD, Thủ kho trụ sở xem danh sách kho; Thủ kho trụ sở xem chi tiết kho. (4) Quản lý kho VCT xem danh sách kho (công ty VCT), thêm vị trí. (5) Nhân viên VCR xem danh sách kho. (6) Thêm vị trí `a-01-01`, `A-01-02`; thêm `A-01-03`, `A-01-01`. (7) Sửa tên, bỏ VCT với phiên bản 1; gửi lại phiên bản 1; ngừng dùng. (8) Đọc, sửa cài đặt giữ hàng 48 giờ; Thủ kho sửa cài đặt.
- Kết quả mong đợi: Bước 1: `403`. Bước 2: `201`, mã `KHO-BD`, `canOperate`, `canManage` đúng, chủ hàng VCR và VCT; lần hai `code` "Mã kho đã có trong công ty."; lần ba lỗi chỉ ở `branchId`. Bước 3: Thủ kho VCR-BD thấy kho (`canOperate: true`); Thủ kho trụ sở danh sách rỗng, chi tiết `404`. Bước 4: thấy kho với `canOperate: false`, `canManage: false`; thêm vị trí `403`. Bước 5: `403`. Bước 6: mã thành `A-01-01`, `A-01-02`; lần hai `locations.1.code` "Mã vị trí đã có trong kho."; `locationCount` 2. Bước 7: chủ hàng chỉ còn VCR; lần hai `409`; trạng thái `inactive`. Bước 8: mặc định `{ reservationHours: 72, version: 0 }`, sau sửa `{ 48, 1 }`; Thủ kho `403`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-warehouses.test.ts`
- Lát: L0

## CHUC_NANG_39, CHUC_NANG_40: Phiếu kho, tồn kho, giá vốn, thẻ kho (CONG_VIEC_05)

Dữ liệu chung: kho `BD1` (không vị trí, chủ hàng VCR, VCT), `BD2` (vị trí `A-01`, `A-02`) ở chi nhánh VCR-BD; sản phẩm Nước suối (đơn vị cơ sở Chai, Thùng hệ số 24), Sữa hộp (theo lô), Điện thoại (theo serial) của VCR; Nước của VCT. Thủ kho gán ở VCR-BD lập phiếu.

### KICHBAN_KIEMTHU_148: Nhập khác có duyệt; giá vốn bình quân qua hai lần nhập; xuất theo giá vốn; thẻ kho chỉ thêm
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_66
- Chức năng: CHUC_NANG_39, CHUC_NANG_40, CHUC_NANG_16
- Loại: Đúng
- Vai trò thực hiện: Thủ kho (lập); người duyệt `phuc.le@vcomm.test`; Quản trị công ty (xem)
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `inventory.receipt_other`; chưa có chính sách `inventory.issue_other`.
- Các bước: (1) Gửi phiếu nhập 10 Thùng đơn giá 240.000; xem tồn; duyệt. (2) Gửi nhập 60 Chai giá 12.000 và nhập 1.000 Chai giá 1; duyệt phiếu đầu, từ chối phiếu sau. (3) Gửi phiếu xuất 100 Chai dùng nội bộ. (4) Xem thẻ kho hôm nay. (5) Sửa thẳng một dòng `inventory.movements` trong cơ sở dữ liệu.
- Kết quả mong đợi: Bước 1: `pending`, số `NK-VCR-<năm>-000001`, dòng 10 Thùng = 240 Chai; trước duyệt tồn 0; sau duyệt tồn 240, giá vốn 10.000, giá trị 2.400.000; Thủ kho xem phiếu `posted`, `totalValue` trống. Bước 2: phiếu sau `rejected`; tồn 300, giá vốn 10.400, giá trị 3.120.000. Bước 3: ghi sổ ngay `posted`, giá trị dòng 1.040.000; tồn 200, giá trị 2.080.000, khả dụng 200. Bước 4: đầu kỳ 0; biến động (240, 240), (60, 300), (-100, 200); cuối kỳ 200, 2.080.000. Bước 5: cơ sở dữ liệu báo lỗi.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_149: Xuất quá tồn; phiếu chờ duyệt giữ hàng; hai phiếu đồng thời xuất món hàng cuối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_67
- Chức năng: CHUC_NANG_40, CHUC_NANG_43
- Loại: Sai, đồng thời
- Vai trò thực hiện: Thủ kho; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Tồn Nước 200 Chai ở KICHBAN_KIEMTHU_148.
- Các bước: (1) Gửi xuất 9 Thùng (216 Chai). (2) Tạo chính sách `inventory.issue_other`; gửi xuất 150 Chai; xem tồn. (3) Gửi xuất 60 Chai. (4) Rút phiếu 150 Chai; xem tồn. (5) Lập hai phiếu xuất 150 Chai, gửi đồng thời. (6) Duyệt phiếu được gửi; xem tồn; đếm dòng tồn âm.
- Kết quả mong đợi: Bước 1: `400`, `lines.0.quantity` "Không đủ hàng trong kho.". Bước 2: `pending`; tồn 200, đang giữ 150, khả dụng 50. Bước 3: `lines.0.quantity` "Không đủ hàng khả dụng (một phần đang được giữ).". Bước 4: `withdrawn`; đang giữ 0, khả dụng 200. Bước 5: một `201`, một `409`; đang giữ 150. Bước 6: tồn 50, đang giữ 0; không có dòng tồn âm.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_150: Gợi ý lô hết hạn trước; lô khác phải có lý do; lô hết hạn chỉ xuất khi hủy hàng hết hạn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_68
- Chức năng: CHUC_NANG_40
- Loại: Đúng, sai
- Vai trò thực hiện: Thủ kho; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt nhập khác, xuất khác ở KICHBAN_KIEMTHU_148, 149.
- Các bước: (1) Lưu phiếu nhập Sữa không số lô, hạn dùng. (2) Nhập lô `L-HET` (hạn 2020-01-01), `L-SOM` (2098-01-01), `L-MUON` (2099-01-01), mỗi lô 10 Hộp; duyệt. (3) Gửi nhập `L-SOM` hạn 2098-06-01. (4) Xem gợi ý lô. (5) Gửi xuất 2 Hộp lô `L-MUON` không lý do. (6) Gửi xuất lô `L-HET` có lý do, lý do dùng nội bộ. (7) Gửi xuất hủy hàng hết hạn 10 Hộp `L-HET`; gửi xuất 2 Hộp `L-MUON` có lý do; duyệt cả hai. (8) Xem chi tiết tồn.
- Kết quả mong đợi: Bước 1: `lines.0.lotNo`, `lines.0.expiresOn` "Vui lòng nhập thông tin này.". Bước 3: `lines.0.expiresOn` "Lô đã có với hạn dùng khác.". Bước 4: thứ tự `L-HET` (hết hạn, không gợi ý), `L-SOM` (gợi ý), `L-MUON`. Bước 5: `lines.0.lotOverrideReason` "Chọn lô khác lô gợi ý phải ghi lý do.". Bước 6: `lines.0.lotId` "Lô đã hết hạn dùng.". Bước 7: phiếu hủy `pending`. Bước 8: còn `L-SOM` 10, `L-MUON` 8.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_151: Serial nhập, xuất đích danh; serial sai số lượng, trùng, không có trong kho; kho có vị trí bắt buộc vị trí
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_68
- Chức năng: CHUC_NANG_40
- Loại: Đúng, sai
- Vai trò thực hiện: Thủ kho; người duyệt `phuc.le@vcomm.test`; Quản trị công ty (xem)
- Điều kiện ban đầu và dữ liệu: Kho `BD2` có vị trí.
- Các bước: (1) Lưu nhập 2 Điện thoại một serial. (2) Lưu nhập vào `BD2` không vị trí. (3) Nhập `IMEI-1` giá 5.000.000 vị trí `A-01`, `IMEI-2` giá 5.200.000 vị trí `A-02`; duyệt. (4) Gửi nhập lại `IMEI-1` vào `BD1`. (5) Gửi xuất `IMEI-1` ở vị trí `A-02`. (6) Gửi xuất `IMEI-2` ở `A-02`; duyệt. (7) Xem chi tiết tồn `BD2`. (8) Đối chiếu serial của dòng phiếu với serial được gắn trong cơ sở dữ liệu.
- Kết quả mong đợi: Bước 1: `lines.0.serials` "Số serial phải bằng số lượng theo đơn vị cơ sở.". Bước 2: `lines.0.locationId` "Vui lòng nhập thông tin này.". Bước 3: tồn 2, giá vốn 5.100.000. Bước 4: `lines.0.serials` "Serial đã có trong kho.". Bước 5: `lines.0.serials` "Serial không có trong kho, vị trí này.". Bước 6: giá trị dòng 5.200.000, serial `IMEI-2`. Bước 7: chỉ còn `IMEI-1` ở `A-01` giá 5.000.000. Bước 8: mỗi dòng `document_line_serials` gắn đúng serial cùng số.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_152: Phiếu chỉ chứa hàng của công ty chủ hàng; chủ hàng khác chỉ xem tồn của mình; điều chỉnh tăng giảm
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_65
- Chức năng: CHUC_NANG_38, CHUC_NANG_39, CHUC_NANG_40
- Loại: Sai, phân quyền
- Vai trò thực hiện: Thủ kho VCR-BD; Quản lý kho VCT (phạm vi công ty VCT)
- Điều kiện ban đầu và dữ liệu: Kho `BD1` nhận hàng VCT; `BD2` không nhận.
- Các bước: (1) Lưu phiếu VCR chứa Nước của VCT. (2) Lưu phiếu chủ hàng VCT vào `BD2`. (3) Thủ kho gửi phiếu nhập 5 Chai Nước của VCT vào `BD1` (VCT chưa có chính sách duyệt). (4) Quản lý kho VCT xem tồn, xem phiếu vừa nhập, xem một phiếu xuất của VCR. (5) Gửi phiếu điều chỉnh Nước VCR: -10 Chai, +1 Thùng.
- Kết quả mong đợi: Bước 1: `lines.0.variantId` "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán.". Bước 2: `companyId` "Kho không nhận hàng của công ty này.". Bước 3: `posted`, công ty "VComm Thương mại", số `NK-VCT-...`. Bước 4: tồn chỉ một dòng của VCT, 5; phiếu VCT `200`; phiếu VCR `404`. Bước 5: `posted`; tồn 64, giá vốn 10.400.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_153: Ghi sổ phiếu 200 dòng; danh sách 50.000 dòng tồn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_74
- Chức năng: CHUC_NANG_39, CHUC_NANG_40
- Loại: Hiệu năng
- Vai trò thực hiện: Thủ kho; Quản trị công ty
- Điều kiện ban đầu và dữ liệu: Chèn thẳng 50.000 biến thể của sản phẩm Nước; chưa có chính sách duyệt điều chỉnh.
- Các bước: (1) Lập phiếu điều chỉnh 200 dòng (mỗi dòng +1 Chai, đơn giá 1.000), đo thời gian gửi. (2) Chèn dòng giá vốn cho 50.000 biến thể; đo thời gian `GET /inventory/stock?warehouseId=` trang đầu.
- Kết quả mong đợi: Bước 1: `posted` dưới 2 giây. Bước 2: `total` từ 50.000, dưới 500 mili giây.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-documents.test.ts`
- Lát: L1

## CHUC_NANG_41: Chuyển kho hai bước (CONG_VIEC_05)

### KICHBAN_KIEMTHU_154: Duyệt rồi xuất: kho nguồn giảm, hàng đang vận chuyển; nhận thiếu sinh biên bản; kho không nhận chủ hàng bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_69
- Chức năng: CHUC_NANG_41, CHUC_NANG_16
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Thủ kho kho nguồn (chi nhánh VCR-BD); Thủ kho kho đích (trụ sở); người duyệt `phuc.le@vcomm.test`; Quản trị công ty
- Điều kiện ban đầu và dữ liệu: Kho `NGUON` (VCR-BD, không vị trí) có 100 Chai Nước giá 1.000, 10 Hộp Sữa lô `LS-1`, Điện thoại `CK-1`, `CK-2` giá 3.000.000; kho `DICH` (trụ sở, vị trí `K-01`); kho `KHAC` của VCT không nhận hàng VCR.
- Các bước: (1) Lưu phiếu chuyển sang `KHAC`; xem danh sách kho đích. (2) Tạo chính sách `inventory.transfer`; gửi phiếu `NGUON` → `DICH` gồm 30 Chai, 4 Hộp lô `LS-1`, 2 Điện thoại; xem tồn nguồn. (3) Duyệt; xem phiếu, tồn. (4) Thủ kho đích xác nhận xuất; Thủ kho nguồn xác nhận xuất; xem phiếu, tồn, trạng thái serial; xuất lại. (5) Thủ kho nguồn nhận không dòng; Thủ kho đích nhận 28 Chai, đủ Sữa, 1 Điện thoại không ghi serial; rồi nhận 1 Điện thoại `CK-2`. (6) Xem biên bản bằng Thủ kho và Quản trị công ty; xem tồn kho đích, lô, serial. (7) Thủ kho nguồn gửi phiếu nhập lại serial `CK-1` (đang vận chuyển). (8) Thủ kho đích tìm mặt hàng của VCT (`GET /inventory/items?companyId=<VCT>`).
- Kết quả mong đợi: Bước 1: `destinationWarehouseId` "Kho không nhận hàng của công ty này."; kho đích gồm `DICH`, `NGUON`. Bước 2: `pending`, số `CK-VCR-...`, `canShip: false`; tồn 100, đang giữ 30, khả dụng 70. Bước 3: `posted`, `canShip: true`; tồn nguồn vẫn 100. Bước 4: Thủ kho đích `404`; sau xuất `in_transit`, Thủ kho đích `canReceive: true`; tồn nguồn 70, đang giữ 0; `CK-1`, `CK-2` `in_transit`; xuất lại `409`. Bước 5: lần đầu `400`; lần hai `lines.2.serials` "Số serial phải bằng số lượng theo đơn vị cơ sở."; lần ba `received`. Bước 6: biên bản chênh lệch -2 và -1; giá trị trống với Thủ kho, -2.000 và -3.000.000 với Quản trị công ty; tồn đích Nước 28 giá vốn 1.000, Điện thoại 1 giá 3.000.000, Sữa lô `LS-1` vị trí `K-01` 4; `CK-1` còn `in_transit`, `CK-2` `in_stock`. Bước 7: `lines.0.serials` "Serial đã có trong kho.". Bước 8: `403`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-transfers.test.ts`
- Lát: L2

## CHUC_NANG_42: Kiểm kê (CONG_VIEC_05)

Dữ liệu chung: kho `KK1` (VCR-BD) có 100 Chai Nước giá 1.000, 20 Hộp Sữa lô `KK-L1`, Điện thoại `KK-P1`, `KK-P2` giá 2.000.000.

### KICHBAN_KIEMTHU_155: Kiểm theo ngành hàng: trong phạm vi bị khóa, ngoài phạm vi vẫn ghi sổ; kết thúc sinh phiếu điều chỉnh, ghi người chịu trách nhiệm
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_70
- Chức năng: CHUC_NANG_42, CHUC_NANG_40
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chưa có chính sách duyệt điều chỉnh.
- Các bước: (1) Lập kiểm kê phạm vi ngành hàng Nước; bắt đầu. (2) Gửi xuất 1 Chai Nước; gửi xuất 2 Hộp Sữa. (3) Kết thúc khi chưa đếm. (4) Ghi số đếm 97. (5) Kết thúc, người chịu trách nhiệm `thukho.bd@vcomm.test`. (6) Xem phiếu điều chỉnh, tồn. (7) Gửi xuất 1 Chai Nước; hủy kiểm kê đã kết thúc. (8) Lập kiểm kê danh sách sản phẩm Sữa, bắt đầu; ghi số đếm 3 cho dòng mới Sữa không lô; hủy kiểm kê.
- Kết quả mong đợi: Bước 1: `draft`, 0 dòng; sau bắt đầu `counting`, số `KK-VCR-...`, 1 dòng sổ sách 100, giá vốn 1.000. Bước 2: Nước `409` "Mặt hàng đang kiểm kê, chưa ghi sổ được."; Sữa `posted`. Bước 3: `409`. Bước 4: chênh lệch -3, giá trị -3.000. Bước 5: `201`, `finished`, phiếu `DCK-VCR-...`. Bước 6: phiếu `posted`, lý do `stocktake`, `canEdit: false`, dòng -3, người chịu trách nhiệm đúng, bồi thường 3.000; tồn 97. Bước 7: `posted`; hủy nhận `409`. Bước 8: dòng chụp có lô `KK-L1`; ghi số đếm nhận `counts.0.lotId` "Hàng theo lô: ghi số đếm theo lô đã có; lô mới nhập bằng phiếu nhập khác."; hủy thành `cancelled`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-stocktakes.test.ts`
- Lát: L3

### KICHBAN_KIEMTHU_156: Kiểm theo danh sách sản phẩm có serial: thiếu, thừa serial; có chính sách thì tồn chỉ đổi sau duyệt
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_70
- Chức năng: CHUC_NANG_42, CHUC_NANG_16
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `inventory.adjustment`.
- Các bước: (1) Lập kiểm kê danh sách sản phẩm Điện thoại; bắt đầu. (2) Ghi số đếm 2 không serial. (3) Ghi số đếm 2, serial `KK-P1`, `KK-P3`; kết thúc. (4) Xem phiếu điều chỉnh, serial trong kho. (5) Duyệt; xem serial, tồn.
- Kết quả mong đợi: Bước 1: dòng sổ sách 2, theo dõi serial. Bước 2: `400`. Bước 3: `201`. Bước 4: phiếu `pending`, dòng (-1, `KK-P2`), (1, `KK-P3`); serial trong kho vẫn `KK-P1`, `KK-P2`. Bước 5: serial trong kho `KK-P1`, `KK-P3`; tồn 2.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-stocktakes.test.ts`
- Lát: L3

## CHUC_NANG_43, CHUC_NANG_44, CHUC_NANG_45: Giữ hàng, tồn an toàn, in tem (CONG_VIEC_05)

Dữ liệu chung: kho `GH1` (VCR-BD, vị trí `G-01` "Kệ G", `G-02`) có 10 Hộp Bánh quy bơ (mã vạch `8936000000017`) ở `G-01`; Thủ kho gán ở VCR-BD.

### KICHBAN_KIEMTHU_157: Không giữ quá tồn khả dụng; hết hạn tự nhả; gia hạn, nhả tay ghi nhật ký; hàng giữ cho phiếu kho không nhả tay
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_71
- Chức năng: CHUC_NANG_43
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Thủ kho; Quản trị công ty `quantri.vcr@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Cài đặt giữ hàng mặc định 72 giờ.
- Các bước: (1) Thủ kho giữ 1 Hộp. (2) Quản trị công ty giữ 8 Hộp ghi chú "Khách hẹn lấy"; giữ thêm 3; xem tồn. (3) Gia hạn 24 giờ; nhả; đọc nhật ký thao tác. (4) Giữ 5 Hộp, đặt hạn giữ về quá khứ, chạy tác vụ nhả hàng hết hạn; xem tồn, danh sách đã nhả. (5) Chèn hàng giữ nguồn `inventory.document`; nhả tay.
- Kết quả mong đợi: Bước 1: `403`. Bước 2: `201`, `sourceNo` "Khách hẹn lấy", hạn sau 71 đến 72 giờ; lần hai "Không đủ hàng khả dụng (một phần đang được giữ)."; tồn 10, đang giữ 8, khả dụng 2. Bước 3: hạn mới thêm 24 giờ; `released`; nhật ký `reservation.create`, `reservation.extend`, `reservation.release`. Bước 4: tác vụ nhả 1; đang giữ 0, khả dụng 10; 2 hàng giữ đã nhả. Bước 5: `409`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-reservations.test.ts`
- Lát: L4

### KICHBAN_KIEMTHU_158: Dưới tối thiểu có cảnh báo, số gợi ý đúng; tối đa nhỏ hơn tối thiểu bị từ chối; thông báo hằng ngày
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_72
- Chức năng: CHUC_NANG_44
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Thủ kho; Quản trị công ty
- Điều kiện ban đầu và dữ liệu: Tồn khả dụng Bánh quy 9 (sau KICHBAN_KIEMTHU_157).
- Các bước: (1) Đặt tối thiểu 20, tối đa 10. (2) Thủ kho đặt 20, 50. (3) Quản trị công ty đặt 20, 50; xem cảnh báo. (4) Thủ kho xem tồn kho. (5) Chạy tác vụ thông báo; đọc thông báo của quản trị công ty. (6) Đặt tối thiểu 5; xem cảnh báo.
- Kết quả mong đợi: Bước 1: `400`. Bước 2: `403`. Bước 3: khả dụng 9, dưới tối thiểu, gợi ý 41; cảnh báo có một dòng gợi ý 41. Bước 4: `minimum` 20, `belowMinimum: true`. Bước 5: số người nhận lớn hơn 0; thông báo `inventory_stock_alert` dữ liệu `{ warehouse: "Kho giữ hàng", count: 1 }`. Bước 6: cảnh báo rỗng.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-reservations.test.ts`
- Lát: L4

### KICHBAN_KIEMTHU_159: Mã Code 128 đúng cấu trúc; tem sản phẩm, tem vị trí ra PDF đúng khổ, đúng số trang
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_73
- Chức năng: CHUC_NANG_45
- Loại: Đúng
- Vai trò thực hiện: Quản trị công ty
- Điều kiện ban đầu và dữ liệu: Kho `GH1` có 2 vị trí đang dùng.
- Các bước: (1) Kiểm bảng mẫu vạch Code 128: 106 mẫu đầu mỗi mẫu tổng 11 mô-đun; mã hóa chuỗi "Hi". (2) Tải tem sản phẩm Bánh quy 3 bản. (3) Tải tem vị trí kho `GH1`.
- Kết quả mong đợi: Bước 1: đúng; "Hi" ra chuỗi độ rộng bắt đầu B, `H`, `i`, ký tự kiểm tra 84, dừng. Bước 2: `200`, `application/pdf`, bắt đầu `%PDF`, 3 trang, `MediaBox` 141,73 × 85,03 điểm (50 × 30 mm). Bước 3: 2 trang. Quét mã vạch bằng máy quét, xem bằng mắt: chưa làm.
- Kiểm thử tự động: Tự động API – `apps/api/test/c5-reservations.test.ts`
- Lát: L4

## MODULE_07 Khách hàng và Đối tác (phần tối thiểu, CONG_VIEC_06)

Dữ liệu chung: công ty con VCR (`testIds.retailCompany`), VCT (`testIds.tradingCompany`, mã số thuế `0109876543`); Quản trị công ty VCR `quantri.vcr@vcomm.test`; tạo trong tệp kiểm thử: Quản lý đối tác `doitac.vct@vcomm.test` (vai trò `partner_manager` ở VCT), Thủ kho `thukho.doitac@vcomm.test` (`warehouse_keeper` ở VCR), Nhân viên `nhanvien.doitac@vcomm.test` (`employee` ở VCR). Đối tác mẫu: tổ chức "Công ty TNHH Bao Bì Xanh", mã số thuế `0301234567`, một người liên hệ, một tài khoản ngân hàng. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_46, CHUC_NANG_47: Đối tác dùng chung, đối tác nội bộ (CONG_VIEC_06)

### KICHBAN_KIEMTHU_160: Mã số thuế bắt buộc, đúng định dạng, không trùng; kiểm trùng trả đối tác có sẵn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_75
- Chức năng: CHUC_NANG_46
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; Quản lý đối tác VCT; Thủ kho VCR; Nhân viên VCR
- Điều kiện ban đầu và dữ liệu: Chưa có đối tác bên ngoài.
- Các bước: (1) Quản trị công ty thêm tổ chức không có mã số thuế; thêm hộ kinh doanh "Hộ kinh doanh Tạp hóa Bé Ba" không có mã số thuế; thêm tổ chức mã số thuế `03012345`. (2) Thủ kho thêm đối tác mẫu; Nhân viên xem danh sách đối tác. (3) Quản trị công ty thêm đối tác mẫu. (4) Quản lý đối tác VCT thêm đối tác cùng mã số thuế, tên khác. (5) Quản lý đối tác VCT kiểm trùng `taxCode=0301234567`, `taxCode=0399999999`. (6) Quản trị công ty thêm "Chi nhánh Bao Bì Xanh" mã số thuế `0301234567-001`.
- Kết quả mong đợi: Bước 1: `400`, lỗi chỉ ở `taxCode` ("Vui lòng nhập thông tin này." với hai lần đầu). Bước 2: `403`, `403`. Bước 3: `201`, mã dạng `DT` + 6 số, `internalCompanyId: null`, `canManage: true`; người liên hệ, tài khoản ngân hàng đúng như gửi. Bước 4: `taxCode` "Mã số thuế đã có ở đối tác khác trong tập đoàn.". Bước 5: trả `{ id, code, name }` của đối tác bước 3; mã chưa có trả `partner: null`. Bước 6: `201` (đơn vị phụ thuộc là đối tác riêng).
- Kiểm thử tự động: Tự động API – `apps/api/test/c6-partners.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_161: Công ty khác thấy, sửa đối tác chung; sửa ghi nhật ký trước, sau; ngừng giao dịch không xóa
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_76
- Chức năng: CHUC_NANG_46
- Loại: Đúng, phân quyền, đồng thời
- Vai trò thực hiện: Quản trị công ty VCR; Quản lý đối tác VCT; Thủ kho VCR
- Điều kiện ban đầu và dữ liệu: Quản trị công ty VCR thêm "Công ty Cổ phần Gạo Ngon" mã số thuế `0302222222`.
- Các bước: (1) Quản lý đối tác VCT tìm "gao ngon" (không dấu). (2) Thủ kho VCR xem chi tiết. (3) Quản lý đối tác VCT sửa tên thành "Công ty Cổ phần Gạo Rất Ngon" với phiên bản 1. (4) Quản trị công ty VCR sửa lại với phiên bản 1. (5) Đọc nhật ký thao tác của đối tác. (6) Quản trị công ty ngừng giao dịch (phiên bản 2); tìm theo mã số thuế với `status=inactive`; giao dịch lại (phiên bản 3).
- Kết quả mong đợi: Bước 1: danh sách chỉ có đối tác vừa thêm. Bước 2: thấy đối tác, `canManage: false`. Bước 3: `200`, tên mới, `version` 2. Bước 4: `409`. Bước 5: hai dòng theo thứ tự: `partner.create` công ty VCR, `afterData.name` "Công ty Cổ phần Gạo Ngon"; `partner.update` công ty VCT, `beforeData.name` "Công ty Cổ phần Gạo Ngon", `afterData.name` "Công ty Cổ phần Gạo Rất Ngon". Bước 6: trạng thái `inactive`; tìm thấy 1 đối tác (không bị xóa); giao dịch lại trạng thái `active`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c6-partners.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_162: Mỗi công ty con đang hoạt động có đúng một đối tác nội bộ, không sửa được thông tin chung
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_77
- Chức năng: CHUC_NANG_47
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Công ty con VCR, VCT đang hoạt động.
- Các bước: (1) Xem danh sách `role=internal` hai lần; đếm đối tác nội bộ theo công ty trong cơ sở dữ liệu. (2) Xem chi tiết đối tác nội bộ của VCT. (3) Sửa đối tác nội bộ VCT; ngừng giao dịch đối tác đó. (4) Thêm đối tác bên ngoài mã số thuế `0109876543`. (5) Đổi tên ngắn công ty VCT thành "VComm TM" trong cơ sở dữ liệu; xem chi tiết; xem danh sách đối tác nội bộ; xem lại chi tiết.
- Kết quả mong đợi: Bước 1: đối tác nội bộ của đúng VCR, VCT; mỗi công ty đúng 1 dòng sau hai lần đồng bộ. Bước 2: mã số thuế `0109876543`, loại tổ chức, `canManage: false`. Bước 3: `409 BUSINESS_RULE` "Đối tác nội bộ lấy thông tin từ công ty, sửa ở màn hình Công ty."; ngừng giao dịch `409`. Bước 4: `taxCode` "Mã số thuế đã có ở đối tác khác trong tập đoàn.". Bước 5: chi tiết trả ngay tên ngắn "VComm TM"; nhật ký `partner.sync` người làm trống (hệ thống), trước "VComm Thương mại", sau "VComm TM".
- Kiểm thử tự động: Tự động API – `apps/api/test/c6-partners.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_163: Cá nhân bắt buộc số Căn cước công dân; danh sách chỉ hiện 3 số cuối; xem đầy đủ cần quyền và ghi nhật ký
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_78
- Chức năng: CHUC_NANG_46
- Loại: Đúng, sai, phân quyền, bảo mật
- Vai trò thực hiện: Quản trị công ty VCR; Quản lý đối tác VCT; Thủ kho VCR
- Điều kiện ban đầu và dữ liệu: Số Căn cước công dân giả `079090012345`.
- Các bước: (1) Quản trị công ty thêm cá nhân "Nguyễn Văn An" không có số Căn cước công dân; với số 11 chữ số `07909001234`. (2) Quản lý đối tác VCT thêm cá nhân với số `079090012345`, điện thoại `0912345678`. (3) Quản trị công ty thêm "Người khác" cùng số. (4) Quản trị công ty xem danh sách `kind=individual`; đọc nhật ký `partner.create` của đối tác. (5) Quản lý đối tác VCT gọi `identity`. (6) Quản trị công ty xem chi tiết, gọi `identity`; Thủ kho, Quản trị công ty kiểm trùng `citizenId=079090012345`; Quản trị công ty gọi `identity` của một tổ chức. (7) Quản trị công ty sửa tên thành "Nguyễn Văn An Bình", gửi `citizenId` trống, phiên bản 1. (8) Đọc nhật ký `partner.view_identity`.
- Kết quả mong đợi: Bước 1: `citizenId` "Vui lòng nhập thông tin này."; lần hai lỗi chỉ ở `citizenId`. Bước 2: `201`, `citizenIdMasked` `*********345`, `canViewIdentity: false`; nội dung trả về không chứa số đầy đủ. Bước 3: `citizenId` "Số Căn cước công dân đã có ở đối tác khác trong tập đoàn.". Bước 4: danh sách không chứa số đầy đủ, dòng đầu `*********345`; nhật ký thêm không chứa số đầy đủ. Bước 5: `403`. Bước 6: `canViewIdentity: true`; `{ citizenId: "079090012345" }`; Thủ kho kiểm trùng `403`, Quản trị công ty nhận đúng đối tác. Bước 7: tên mới, vẫn `*********345` (giữ số đã lưu). Bước 8: đúng một dòng, công ty VCR.
- Kiểm thử tự động: Tự động API – `apps/api/test/c6-partners.test.ts`
- Lát: L0

## CHUC_NANG_48: Hồ sơ đối tác của công ty (CONG_VIEC_06)

### KICHBAN_KIEMTHU_164: Hồ sơ riêng từng công ty; phải chọn khách hàng hoặc nhà cung cấp; hạn mức không âm; nhóm khách, người phụ trách thuộc công ty
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_79
- Chức năng: CHUC_NANG_48
- Loại: Đúng, sai, phân quyền, đồng thời
- Vai trò thực hiện: Quản trị công ty VCR; Quản lý đối tác VCT
- Điều kiện ban đầu và dữ liệu: Đối tác "Công ty TNHH Nông Sản Việt" mã số thuế `0303333333`; nhóm khách hàng "Khách sỉ" ở VCR và ở VCT (chèn thẳng vào `catalog.customer_groups`). Hồ sơ mẫu: khách hàng, 30 ngày, hạn mức `50000000`, nhóm khách VCR, nhân viên phụ trách đầu tiên của danh sách chọn, ghi chú "Giao buổi sáng", phiên bản 0.
- Các bước: (1) Quản trị công ty tải danh sách chọn hồ sơ. (2) Lưu hồ sơ mẫu với: không khách hàng, không nhà cung cấp; hạn mức `-1`; 366 ngày; nhóm khách của VCT; nhân viên phụ trách chỉ thuộc VCT. (3) Quản lý đối tác VCT lưu hồ sơ mẫu ở VCT. (4) Quản trị công ty lưu hồ sơ mẫu; lưu lại cùng phiên bản 0; lọc `role=customer`; Thủ kho VCR xem chi tiết đối tác. (5) Quản lý đối tác VCT xem chi tiết đối tác; lọc `role=customer` ở VCT. (6) Quản trị công ty lưu hồ sơ cho đối tác nội bộ của chính VCR. (7) Đọc nhật ký loại đối tượng `partner_profile`.
- Kết quả mong đợi: Bước 1: nhóm khách hàng chỉ có "Khách sỉ" của VCR. Bước 2: `400`, `400`, `400`; lỗi chỉ ở `customerGroupId`; lỗi chỉ ở `ownerUserId`. Bước 3: `403`. Bước 4: `200`, hồ sơ công ty VCR, khách hàng, hạn mức `50000000`, nhóm "Khách sỉ", 30 ngày, `version` 1, `currency` "VND"; lần hai `409`; danh sách chỉ có đối tác này; Thủ kho thấy khách hàng nhưng `creditLimit: null`, `creditLimitHidden: true`. Bước 5: `profile: null`, `isCustomer: false`; tổng 0. Bước 6: lỗi chỉ ở `partnerId`. Bước 7: đúng một dòng `partner_profile.save`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c6-partners.test.ts`
- Lát: L1

## MODULE_04 Mua hàng (phần 1: Mua hàng trong nước, CONG_VIEC_07)

Dữ liệu chung: công ty con VCR (`testIds.retailCompany`), VCT (`testIds.tradingCompany`); Quản trị tập đoàn `quantri.tapdoan@vcomm.test`, Quản trị công ty VCR `quantri.vcr@vcomm.test`, người duyệt `phuc.le@vcomm.test`; tạo trong tệp kiểm thử: Nhân viên mua hàng `muahang.vcr@vcomm.test` (vai trò `purchaser` ở VCR), `muahang.vct@vcomm.test` (`purchaser` ở VCT), Thủ kho `thukho.mua@vcomm.test` (`warehouse_keeper` gán ở chi nhánh VCR-BD), Thủ kho `thukho.hcm.mua@vcomm.test` (`warehouse_keeper` gán ở chi nhánh VCR-HCM). Kho `BDM` "Kho mua BD" của chi nhánh VCR-BD, không dùng vị trí. Mặt hàng của VCR: "Nước suối mua" (đơn vị cơ sở chai, thùng = 24 chai, thuế suất 10%), "Gạo mua" (kg, 5%), "Sữa tươi kiểm tra" (hộp, theo lô, ngành hàng `THUCM` cần kiểm tra chất lượng), "Điện thoại mua" (cái, theo serial); mặt hàng của VCT "Nước của VCT". Đối tác: "Công ty TNHH Nước Sạch Miền Nam" mã số thuế `0310000001` có hồ sơ nhà cung cấp ở VCR; "Công ty Khách Hàng Lẻ" `0310000002` chỉ là khách hàng. Các kịch bản chạy nối tiếp trong một tệp (dung sai 5% đặt ở KICHBAN_KIEMTHU_168 dùng tiếp ở KICHBAN_KIEMTHU_169, KICHBAN_KIEMTHU_170). Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_49: Bảng giá mua (CONG_VIEC_07)

### KICHBAN_KIEMTHU_165: Giá chồng hiệu lực bị từ chối; giá gợi ý theo ngày, số lượng tối thiểu; nhà cung cấp chưa có hồ sơ bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_80
- Chức năng: CHUC_NANG_49
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Nhân viên mua hàng VCR, VCT; Thủ kho VCR-BD
- Điều kiện ban đầu và dữ liệu: Giá mẫu: "Nước Sạch Miền Nam", "Nước suối mua", đơn vị thùng, đơn giá `96000`, hiệu lực từ 2026-01-01, không thời hạn.
- Các bước: (1) Thủ kho thêm giá mẫu. (2) Nhân viên mua hàng thêm giá mẫu với nhà cung cấp "Công ty Khách Hàng Lẻ"; với đơn vị kg. (3) Thêm giá mẫu. (4) Thêm giá `95000` cùng số lượng tối thiểu 0, hiệu lực từ 2026-06-01. (5) Thêm giá số lượng tối thiểu 10, `90000`; sửa giá mẫu hiệu lực đến 2099-12-30 (phiên bản 1); thêm giá `99000` hiệu lực từ 2099-12-31. (6) Tra giá gợi ý hôm nay với 5 thùng, 10 thùng; ngày 2099-12-31 với 1 thùng; ngày 2025-12-31. (7) Ngừng dùng giá 10 thùng; tra lại 10 thùng; xem danh sách đang dùng của nhà cung cấp. (8) Nhân viên mua hàng VCT xem danh sách ở VCT; sửa giá mẫu ở VCT. (9) Nhân viên mua hàng VCR tải danh sách chọn.
- Kết quả mong đợi: Bước 1: `403`. Bước 2: lỗi chỉ ở `supplierId` "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty."; lỗi chỉ ở `unitId`. Bước 3: `201`, tên nhà cung cấp, đơn vị "Thùng", `minQuantity` "0", `unitPrice` "96000", `active`. Bước 4: lỗi chỉ ở `validFrom` "Đã có giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu trùng thời gian hiệu lực.". Bước 5: `201`; `validTo` 2099-12-30, `version` 2; `201`. Bước 6: "96000"; "90000"; "99000"; `null`. Bước 7: `inactive`; "96000"; tổng 2. Bước 8: tổng 0; `404`. Bước 9: tiền tệ VND, nhà cung cấp chỉ "Nước Sạch Miền Nam", kho `BDM`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L0

## CHUC_NANG_50, CHUC_NANG_51: Đề nghị mua, đơn mua (CONG_VIEC_07)

### KICHBAN_KIEMTHU_166: Đề nghị mua đi luồng duyệt; đơn từ đề nghị đã duyệt không vượt giá trị duyệt ngay, vượt thì chờ duyệt; đặt quá số còn lại bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_81
- Chức năng: CHUC_NANG_50, CHUC_NANG_51
- Loại: Đúng, sai, phân quyền, luồng duyệt
- Vai trò thực hiện: Thủ kho VCR-BD; Nhân viên mua hàng VCR; người duyệt
- Điều kiện ban đầu và dữ liệu: Quản trị công ty VCR lập chính sách duyệt `purchasing.requisition`, `purchasing.order`: một cấp từ 0 đồng, người duyệt `phuc.le@vcomm.test`, người thay thế quản trị công ty VCR.
- Các bước: (1) Nhân viên mua hàng lập đề nghị có dòng nước suối với đơn vị kg. (2) Thủ kho lập đề nghị: 10 thùng nước suối, giá ước tính `96000`, nhà cung cấp đề xuất "Nước Sạch Miền Nam"; 100 kg gạo, `20000`; gửi duyệt. (3) Nhân viên mua hàng lập đơn 10 thùng từ dòng nước của đề nghị đang chờ duyệt. (4) Người duyệt duyệt; Nhân viên mua hàng xem đề nghị; lọc `openOnly=true`. (5) Lập đơn 6 thùng × `95000` từ dòng nước; gửi; xem đề nghị. (6) Lập đơn 5 thùng từ dòng nước. (7) Lập đơn 4 thùng × `97000` từ dòng nước, gửi; người duyệt từ chối; xem đơn, xem đề nghị. (8) Lập đơn trực tiếp 1 thùng × `1000`, gửi. (9) Thủ kho lập đơn; xem đơn bước 8.
- Kết quả mong đợi: Bước 1: `400`. Bước 2: `201`, nháp, giá trị ước tính "2960000", dòng nước `baseQuantity` "240", đã đặt "0", `canEdit: true`; gửi: chờ duyệt, số bắt đầu `DNM`. Bước 3: lỗi chỉ ở `lines.0.requisitionLineId`. Bước 4: `approved`, `canOrder: true`; tổng 1. Bước 5: `201`, nháp, tổng "570000", thuế "57000"; gửi: `approved`, `approvalRequestId: null`, số bắt đầu `DMH`; đã đặt "144". Bước 6: `lines.0.quantity` "Vượt số lượng còn lại của dòng đề nghị mua.". Bước 7: chờ duyệt kèm yêu cầu duyệt; sau từ chối `rejected`, `canEdit: true`; đã đặt vẫn "144". Bước 8: chờ duyệt. Bước 9: `403`; `canEdit: false`, `canClose: false`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_167: Sửa tăng giá trị hoặc đổi nhà cung cấp về chờ duyệt; sửa giảm giữ trạng thái; đóng đơn; công ty khác không xem được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_82, TIEUCHI_NGHIEMTHU_86
- Chức năng: CHUC_NANG_51
- Loại: Đúng, sai, phân quyền, luồng duyệt
- Vai trò thực hiện: Nhân viên mua hàng VCR, VCT; người duyệt; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt của KICHBAN_KIEMTHU_166.
- Các bước: (1) Lập đơn 10 thùng × `96000`, ghi chú "Giao trong tuần"; gửi; người duyệt duyệt; xem đơn. (2) Sửa dòng còn 8 thùng. (3) Sửa thêm dòng 3 thùng × `96000`; người duyệt duyệt; xem đơn. (4) Quản trị công ty thêm "Nhà cung cấp thứ hai" mã số thuế `0310000003`, lập hồ sơ nhà cung cấp; sửa đơn đổi sang nhà cung cấp này, giữ dòng; người duyệt duyệt. (5) Nhân viên mua hàng VCT xem chi tiết đơn, xem danh sách đơn, đóng đơn ở VCT. (6) Nhân viên mua hàng VCR đóng đơn, lý do "Nhà cung cấp hết hàng". (7) Đọc nhật ký thao tác của đơn.
- Kết quả mong đợi: Bước 1: `approved`, `canClose: true`, dòng còn nhận được "240". Bước 2: `200`, `approved`, tổng "768000". Bước 3: chờ duyệt, tổng "1056000"; sau duyệt `approved`, giữ số đơn. Bước 4: chờ duyệt, nhà cung cấp "Nhà cung cấp thứ hai". Bước 5: `404`; tổng 0; `409`. Bước 6: `closed`, lý do đóng đúng, `canEdit: false`, `canClose: false`, còn nhận được "0". Bước 7: theo thứ tự `purchase_order.create`, `purchase_order.submit`, `purchase_order.update`, `purchase_order.update`, `purchase_order.submit`, `purchase_order.update`, `purchase_order.submit`, `purchase_order.close`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L1

## CHUC_NANG_52: Phiếu nhập mua, kiểm tra chất lượng (CONG_VIEC_07)

### KICHBAN_KIEMTHU_168: Dung sai nhận vượt; đơn chưa duyệt, đã đóng không nhận; giá nhập theo đơn; đơn nhận đủ; thủ kho chi nhánh khác không nhận
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_83, TIEUCHI_NGHIEMTHU_86
- Chức năng: CHUC_NANG_52
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên mua hàng VCR; Thủ kho VCR-BD; Thủ kho VCR-HCM
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt của KICHBAN_KIEMTHU_166 (đơn mua gửi xong thì người duyệt duyệt).
- Các bước: (1) Quản trị công ty đặt dung sai nhận vượt 5% (phiên bản 0). (2) Lập, duyệt đơn: 10 thùng nước × `96000`; 50 kg gạo × `20000`, thuế 5%. (3) Thủ kho VCR-HCM xem đơn cần nhận; lập, gửi phiếu nhập 1 thùng. Thủ kho VCR-BD xem đơn cần nhận. (4) Thủ kho VCR-BD lập phiếu nhập 11 thùng. (5) Lập, gửi phiếu nhập 6 thùng; Quản trị công ty xem tồn nước suối ở kho `BDM`. (6) Nhân viên mua hàng sửa dòng nước còn 5 thùng. (7) Nhập 4,5 thùng; xem đơn; nhập 50 kg gạo; xem đơn. (8) Nhập thêm 1 kg gạo; lập đơn nháp 1 thùng rồi nhập theo đơn đó. (9) Lập, duyệt đơn 2 thùng; nhập 1 thùng; đóng đơn lý do "Nhà cung cấp giao thiếu"; nhập thêm 1 thùng. (10) Thủ kho lập phiếu loại `purchase_receipt` qua `POST /inventory/documents`.
- Kết quả mong đợi: Bước 2: `approved`, dòng nước còn nhận được "252". Bước 3: danh sách rỗng; `403` hoặc `404`; danh sách có đơn. Bước 4: lỗi chỉ ở `lines.0.quantity` "Vượt số còn nhận được của đơn mua (đã tính dung sai).". Bước 5: `201`, `purchase_receipt`, `posted`, số bắt đầu `NM`, nhà cung cấp, số đơn gốc; tồn 144 chai, giá vốn bình quân 4.000 (96.000 / 24), giá trị 576.000. Bước 6: lỗi chỉ ở `lines.0.quantity` "Số lượng nhỏ hơn số đã nhận.". Bước 7: `201`, đơn vẫn `approved`; `201`, đơn `received`, dòng nước đã nhận "252", còn nhận được "0", 3 phiếu liên quan. Bước 8: "Đơn mua chưa duyệt hoặc đã đóng, không nhận hàng được."; `409`. Bước 9: `201`; `closed`; `409`. Bước 10: `400`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L2

### KICHBAN_KIEMTHU_169: Hàng cần kiểm tra chưa vào tồn khi chờ kiểm; ghi sổ phần đạt; phần không đạt không tính đã nhận
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_84
- Chức năng: CHUC_NANG_52
- Loại: Đúng, sai
- Vai trò thực hiện: Thủ kho VCR-BD; Nhân viên mua hàng VCR; Quản trị công ty VCR (xem giá trị)
- Điều kiện ban đầu và dữ liệu: Dung sai 5% từ KICHBAN_KIEMTHU_168; đơn đã duyệt 100 hộp "Sữa tươi kiểm tra" × `10000`, thuế 5%.
- Các bước: (1) Thủ kho lập, gửi phiếu nhập 100 hộp, lô `L-SUA-01`, hạn dùng 2099-01-01. (2) Xem tồn sữa; xem đơn. (3) Đóng đơn. (4) Ghi kết quả 10 hộp không đạt, không lý do. (5) Ghi kết quả 10 hộp không đạt, lý do "Hộp móp, rò rỉ". (6) Đọc giá trị dòng phiếu, tồn sữa; xem đơn. (7) Ghi kết quả lần hai với phiên bản mới.
- Kết quả mong đợi: Bước 1: `quality_check`, `canQualityCheck: true`, dòng `requiresQualityCheck: true`. Bước 2: tồn 0; đã nhận "0", còn nhận được "5" (105 − 100 đang chờ kiểm). Bước 3: "Đơn mua còn phiếu nhập nháp hoặc chờ kiểm tra, chưa đóng được.". Bước 4: lỗi chỉ ở `lines.0.rejectionReason` "Vui lòng nhập thông tin này.". Bước 5: `201`, `posted`, `canQualityCheck: false`, dòng `rejectedBaseQuantity` "10", lý do đúng. Bước 6: giá trị dòng "900000"; tồn 90 hộp, giá vốn 10.000; đã nhận "90", còn nhận được "15". Bước 7: `409`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L2

## CHUC_NANG_53: Phiếu trả hàng nhà cung cấp (CONG_VIEC_07)

### KICHBAN_KIEMTHU_170: Trả theo giá phiếu nhập gốc, giá vốn bình quân phần còn lại tính lại; trả quá số đã nhập, serial chưa nhập bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_85
- Chức năng: CHUC_NANG_53
- Loại: Đúng, sai, giá trị biên
- Vai trò thực hiện: Thủ kho VCR-BD; Quản trị công ty VCR (xem giá trị, Thủ kho không có `inventory.cost.view`)
- Điều kiện ban đầu và dữ liệu: Đơn A 10 thùng nước × `96000`, đơn B 10 thùng × `120000`, cả hai đã duyệt và nhận đủ; đọc giá trị, số lượng tồn nước suối trước khi trả.
- Các bước: (1) Lập phiếu trả 11 thùng từ phiếu nhập của đơn A, gửi; xóa nháp. (2) Lập, gửi phiếu trả 1 thùng từ cùng dòng; đọc giá trị dòng phiếu trả, tồn nước suối; xem đơn A. (3) Lập phiếu trả 10 thùng từ cùng dòng, gửi. (4) Lập, duyệt đơn 2 cái "Điện thoại mua" × `5000000`; nhận serial `IMEI-M1`, `IMEI-M2`. (5) Lập phiếu trả 1 cái serial `IMEI-KHAC`. (6) Lập, gửi phiếu trả 1 cái serial `IMEI-M2`; đọc giá trị dòng.
- Kết quả mong đợi: Bước 1: lỗi chỉ ở `lines.0.quantity` "Vượt số đã nhập còn trả được của phiếu nhập gốc.". Bước 2: `purchase_return`, `posted`, số bắt đầu `TNCC`, số phiếu nhập gốc; giá trị dòng "96000"; giá trị tồn giảm đúng 96.000, số lượng giảm 24 chai, giá vốn bình quân = giá trị còn lại / số còn lại; đơn A đã trả "24". Bước 3: `400` (còn trả được 9 thùng). Bước 4: phiếu nhập `posted`. Bước 5: lỗi ở `lines.0.serials`. Bước 6: `posted`, serial `IMEI-M2`, giá trị dòng "5000000".
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`

### KICHBAN_KIEMTHU_171: Đơn đã duyệt bị từ chối duyệt lại; không đổi kho nhận; giảm về đúng số đã nhận thì nhận đủ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_82, TIEUCHI_NGHIEMTHU_84
- Chức năng: CHUC_NANG_51, CHUC_NANG_52
- Loại: Đúng, sai
- Vai trò thực hiện: Nhân viên mua hàng VCR; Thủ kho VCR-BD; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt đơn mua cấp 1; đơn 4 thùng nước × `96000` đã duyệt, đã nhận 2 thùng; kho thứ hai `BDM2` của chi nhánh VCR-BD
- Các bước: (1) Sửa đơn đổi kho nhận sang `BDM2`. (2) Sửa tăng lên 6 thùng; người duyệt từ chối; xem đơn; nhận thêm 1 thùng. (3) Sửa về 2 thùng. (4) Đơn khác 3 thùng đã duyệt, sửa lên 5 thùng, bị từ chối, đóng đơn. (5) Đơn có sữa (ngành cần kiểm tra) và nước, nhận đủ; ghi không đạt 1 thùng ở dòng nước.
- Kết quả mong đợi: Bước 1: lỗi chỉ ở `warehouseId`. Bước 2: `pending`; sau từ chối `rejected`, `canClose`, `canEdit` đúng; nhận thêm `409`. Bước 3: `received`. Bước 4: `closed`. Bước 5: phiếu `quality_check`; lỗi chỉ ở `lines.1.rejectedQuantity`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c7-purchasing.test.ts`
- Lát: L2

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

Dữ liệu chung: công ty con VCR (`testIds.retailCompany`), VCT (`testIds.tradingCompany`); Quản trị tập đoàn `quantri.tapdoan@vcomm.test`, Quản trị công ty VCR `quantri.vcr@vcomm.test`, người duyệt `phuc.le@vcomm.test`; tạo trong tệp kiểm thử: Nhân viên bán hàng `banhang.vcr@vcomm.test` (vai trò `salesperson` ở VCR), `banhang.vct@vcomm.test` (`salesperson` ở VCT), Thủ kho `thukho.ban@vcomm.test` (`warehouse_keeper` gán ở chi nhánh VCR-BD), Thủ kho `thukho.hcm.ban@vcomm.test` (`warehouse_keeper` gán ở chi nhánh VCR-HCM). Kho `BDB` "Kho bán BD" của chi nhánh VCR-BD, không dùng vị trí. Mặt hàng của VCR: "Nước suối bán" (đơn vị cơ sở chai, thùng = 24 chai, thuế suất 10%; tồn đầu 960 chai giá vốn 4.000), "Nước chưa có giá" (chai, không có giá), "Điện thoại bán" (cái, theo serial; tồn đầu 3 cái `IMEI-B1` đến `IMEI-B3` giá vốn 5.000.000). Kênh "Bán lẻ" (`BAN_LE`, tạo từ kênh mặc định); nhóm khách "Khách sỉ" (`SI`); bảng giá `CHUNG` gồm thuế (nước 6.600 một chai, điện thoại 7.700.000 một cái), bảng giá `SI` chưa thuế cho nhóm "Khách sỉ" (nước 5.000 một chai). Đối tác: "Đại lý Sỉ Phú Thọ" mã số thuế `0320000001` (khách hàng nhóm "Khách sỉ", hạn mức công nợ 1.000.000, 30 ngày); "Cửa hàng Lẻ An Bình" `0320000002` (khách hàng, hạn mức trống); "Nhà cung cấp không bán" `0320000003` (chỉ là nhà cung cấp). Các kịch bản tự động chạy nối tiếp trong một tệp (chính sách duyệt, cài đặt chiết khấu đặt ở KICHBAN_KIEMTHU_173 dùng tiếp ở KICHBAN_KIEMTHU_174, KICHBAN_KIEMTHU_175). Kịch bản thủ công dùng cùng dữ liệu, nạp bằng cách chạy các bước chuẩn bị của tệp kiểm thử hoặc nhập tay trên môi trường phát triển. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_54: Đơn bán, giá theo bảng giá (CONG_VIEC_08)

### KICHBAN_KIEMTHU_172: Giá theo kênh, nhóm khách; mặt hàng chưa có giá, đối tác chưa là khách bị từ chối; người mua không lấy hóa đơn lập được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_87
- Chức năng: CHUC_NANG_54
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung.
- Các bước: (1) Nhân viên bán hàng tra giá 1 thùng nước, kênh "Bán lẻ", không chọn khách; chọn "Đại lý Sỉ Phú Thọ". (2) Lập đơn có dòng "Nước chưa có giá". (3) Lập đơn với khách "Nhà cung cấp không bán". (4) Lập đơn không khách, tên người mua "Anh Tuấn", 2 thùng nước. (5) Lập đơn khách "Đại lý Sỉ Phú Thọ", 1 thùng nước. (6) Thủ kho lập đơn; xem chi tiết đơn bước 4.
- Kết quả mong đợi: Bước 1: `price` "158400", bảng giá `CHUNG`, `includesVat: true`, thuế suất "10"; `price` "120000", bảng giá `SI`, `includesVat: false`. Bước 2: lỗi chỉ ở `lines.0.variantId`. Bước 3: lỗi chỉ ở `customerId` "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty.". Bước 4: `201`, `customerId: null`, người mua "Anh Tuấn", tổng gồm thuế "316800", chưa thuế "288000", thuế "28800"; dòng giá bảng giá "158400", gồm thuế, số lượng cơ sở "48". Bước 5: chưa thuế "120000", thuế "12000", tổng "132000". Bước 6: `403`; `canEdit: false`, `canSubmit: false`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c8-sales.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_173: Không ngoại lệ xác nhận ngay và giữ hàng; chiết khấu vượt mức, dưới giá vốn, vượt hạn mức chờ duyệt; từ chối nhả hàng giữ; không đủ hàng không gửi được; hủy nhả hàng; công ty khác không xem được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88, TIEUCHI_NGHIEMTHU_89, TIEUCHI_NGHIEMTHU_92
- Chức năng: CHUC_NANG_54, CHUC_NANG_55
- Loại: Đúng, sai, giá trị biên, phân quyền, luồng duyệt
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng VCR, VCT; người duyệt
- Điều kiện ban đầu và dữ liệu: Quản trị công ty VCR lập chính sách duyệt `sales.order`: một cấp từ 0 đồng, người duyệt `phuc.le@vcomm.test`, người thay thế quản trị công ty VCR; đặt chiết khấu tay tối đa 5% (phiên bản 0).
- Các bước: (1) Gửi đơn "Cửa hàng Lẻ An Bình" 2 thùng nước chiết khấu 5% (đúng bằng mức tối đa); xem tồn nước. (2) Gửi đơn 1 thùng chiết khấu 10%; người duyệt duyệt; xem đơn. (3) Đặt mức tối đa 60% (phiên bản 1); gửi đơn 1 thùng chiết khấu 50% (3.000 chưa thuế một chai < giá vốn 4.000); người duyệt từ chối; xem đơn, tồn. (4) Gửi đơn "Đại lý Sỉ Phú Thọ" 9 thùng (1.188.000 gồm thuế > hạn mức 1.000.000); người lập rút. (5) Gửi đơn cùng khách 7 thùng (924.000). (6) Gửi đơn cùng khách 1 thùng (132.000). (7) Gửi đơn 50 thùng. (8) Hủy đơn bước 1; xem tồn. (9) Nhân viên bán hàng VCT xem đơn bước 1 và danh sách đơn ở VCT.
- Kết quả mong đợi: Bước 1: `confirmed`, không ngoại lệ, số bắt đầu `DBH`; tồn 960, giữ 48, khả dụng 912. Bước 2: `pending`, ngoại lệ `discount` dòng 1; sau duyệt `confirmed`. Bước 3: `pending`, ngoại lệ `below_cost` dòng 1; sau từ chối `rejected`, `canEdit: true`, số giữ giảm 24. Bước 4: `pending`, ngoại lệ `credit_limit` không gắn dòng; sau rút `withdrawn`. Bước 5: `confirmed`. Bước 6: ngoại lệ `credit_limit` (đơn đã xác nhận chưa giao tính vào dư nợ). Bước 7: lỗi chỉ ở `lines.0.quantity` "Không đủ hàng khả dụng (một phần đang được giữ).". Bước 8: `cancelled`, số giữ giảm 48. Bước 9: `404`; tổng 0.
- Kiểm thử tự động: Tự động API – `apps/api/test/c8-sales.test.ts`
- Lát: L0

## CHUC_NANG_56: Phiếu xuất giao hàng (CONG_VIEC_08)

### KICHBAN_KIEMTHU_174: Giao nhiều lần không vượt số đặt, theo giá vốn bình quân, dùng hàng đã giữ; giao đủ thì đơn đã giao đủ; đơn đã giao không hủy, chỉ đóng; thủ kho chi nhánh khác không giao
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_89, TIEUCHI_NGHIEMTHU_90, TIEUCHI_NGHIEMTHU_92
- Chức năng: CHUC_NANG_54, CHUC_NANG_56
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD; Thủ kho VCR-HCM; Quản trị công ty VCR (xem giá trị, Thủ kho không có `inventory.cost.view`)
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt, cài đặt chiết khấu của KICHBAN_KIEMTHU_173; đơn "Cửa hàng Lẻ An Bình" 3 thùng nước đã xác nhận.
- Các bước: (1) Thủ kho VCR-HCM xem đơn bán cần giao; lập, gửi phiếu xuất 1 thùng. Thủ kho VCR-BD xem đơn bán cần giao. (2) Thủ kho VCR-BD lập, gửi phiếu xuất 1 thùng; xem số giữ; Quản trị công ty đọc giá trị dòng phiếu. (3) Nhân viên bán hàng xem đơn; hủy đơn. (4) Lập phiếu xuất 3 thùng (còn 2). (5) Lập, gửi phiếu xuất 2 thùng; xem đơn; giao thêm 1 thùng. (6) Đơn khác 2 thùng: giao 1 thùng; đóng đơn lý do "Khách đổi ý"; xem số giữ; giao thêm 1 thùng. (7) Lập đơn nháp 1 thùng rồi giao theo đơn đó. (8) Thủ kho lập phiếu loại `sales_issue` qua `POST /inventory/documents`.
- Kết quả mong đợi: Bước 1: danh sách rỗng; `403` hoặc `404`; danh sách có đơn. Bước 2: `201`, `sales_issue`, `posted`, số bắt đầu `XBH`, khách "Cửa hàng Lẻ An Bình", số đơn gốc; số giữ giảm 24; giá trị dòng "96000" (24 chai × 4.000). Bước 3: `confirmed`, `canCancel: false`, `canClose: true`; hủy `409`. Bước 4: lỗi chỉ ở `lines.0.quantity` "Vượt số còn phải giao của đơn bán.". Bước 5: `201`; đơn `delivered`, đã giao "72", 2 phiếu liên quan; giao thêm `409`. Bước 6: `201`; `closed`; số giữ giảm 24; giao thêm `409`. Bước 7: `409`. Bước 8: `400`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c8-sales.test.ts`
- Lát: L1

## CHUC_NANG_57: Phiếu nhận hàng trả lại (CONG_VIEC_08)

### KICHBAN_KIEMTHU_175: Nhập lại theo giá vốn phiếu xuất gốc; trả quá số đã giao, serial chưa giao bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_91
- Chức năng: CHUC_NANG_57
- Loại: Đúng, sai, giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD; Quản trị công ty VCR (xem giá trị)
- Điều kiện ban đầu và dữ liệu: Đơn "Cửa hàng Lẻ An Bình" 2 cái "Điện thoại bán" đã xác nhận; Thủ kho giao serial `IMEI-B1`, `IMEI-B2`.
- Các bước: (1) Lập phiếu trả 3 cái serial `IMEI-B1`, `IMEI-B2`, `IMEI-B3`. (2) Lập phiếu trả 1 cái serial `IMEI-B3` (chưa giao). (3) Lập phiếu trả 1 cái serial `IMEI-B2`, lý do "Lỗi màn hình"; gửi; Quản trị công ty đọc giá trị dòng; xem tồn điện thoại; Nhân viên bán hàng xem đơn. (4) Lập phiếu trả 2 cái serial `IMEI-B1`, `IMEI-B2`; gửi.
- Kết quả mong đợi: Bước 1: có lỗi ở `lines.0.serials`. Bước 2: lỗi chỉ ở `lines.0.serials`. Bước 3: `201`; gửi: `sales_return`, `posted`, số bắt đầu `NTL`, số phiếu xuất gốc; giá trị dòng "5000000"; tồn 2 cái; dòng đơn đã trả "1". Bước 4: `400` (còn trả được 1 cái).
- Kiểm thử tự động: Tự động API – `apps/api/test/c8-sales.test.ts`
- Lát: L1

## Kịch bản thủ công của MODULE_05 (CONG_VIEC_08)

### KICHBAN_KIEMTHU_176: Lập, gửi đơn bán trên trình duyệt; giá đổi theo khách, kênh; xem ngoại lệ, đã giao
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_87, TIEUCHI_NGHIEMTHU_88
- Chức năng: CHUC_NANG_54, CHUC_NANG_55
- Loại: Đúng, giao diện
- Vai trò thực hiện: Nhân viên bán hàng VCR; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; mini app Nền tảng, Bán hàng, backend đang chạy; chính sách duyệt, chiết khấu tối đa 5% như KICHBAN_KIEMTHU_173.
- Các bước: (1) Nhân viên bán hàng mở `/sales`. (2) "Lập đơn bán": để trống khách, nhập tên người mua; thêm "Nước suối bán" đơn vị thùng. (3) Chọn khách "Đại lý Sỉ Phú Thọ". (4) Đổi dòng sang "Nước chưa có giá"; lưu. (5) Bỏ dòng đó, nhập chiết khấu 10%, lưu, bấm "Gửi". (6) Quản trị công ty mở `/sales/orders`, bấm "Cài đặt", đổi chiết khấu tay tối đa; Nhân viên bán hàng mở lại `/sales/orders`. (7) Xem trên điện thoại (chiều rộng 375 điểm ảnh).
- Kết quả mong đợi: Bước 1: chuyển tới `/sales/orders`, chỉ có mục menu "Đơn bán"; không thấy nút "Cài đặt". Bước 2: ô "Tên người mua" hiện; dòng hiện "Giá 158.400 ₫ theo bảng giá CHUNG (gồm thuế)". Bước 3: ô tên người mua ẩn; giá đổi sang 120.000 ₫ bảng giá SI (chưa thuế); "Tổng gồm thuế (tạm tính)" tính lại. Bước 4: dòng hiện "Chưa có giá trong bảng giá cho kênh, nhóm khách này."; lỗi "Chưa có giá cho mặt hàng này." dưới dòng. Bước 5: chuyển tới chi tiết, "Đã lưu đơn bán."; sau gửi nhãn "Chờ duyệt", khối "Ngoại lệ cần duyệt" có "Chiết khấu vượt mức (dòng 1): 10% > 5%". Bước 6: lưu được, "Đã lưu."; Nhân viên bán hàng không thấy nút "Cài đặt". Bước 7: bảng chuyển thành thẻ, dòng hàng xếp dọc, không cuộn ngang.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0

### KICHBAN_KIEMTHU_177: Giá trị biên chiết khấu tay, cài đặt bán hàng, dữ liệu gửi lên
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88
- Chức năng: CHUC_NANG_54, CHUC_NANG_55
- Loại: Giá trị biên, sai
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; công ty chưa có cài đặt bán hàng.
- Các bước: (1) Đọc `GET /sales/settings`. (2) `PUT /sales/settings` với `maxManualDiscountPercent` lần lượt "100.01", "-1", "5.555", "5,5" (phiên bản 0). (3) Lưu lại với phiên bản 0. (4) Lập đơn có dòng chiết khấu "100", "100.01", "", 0 dòng, 201 dòng, `quantity` "0", tên người mua 201 ký tự, trường lạ `price`. (5) Với mức tối đa "5.5": gửi đơn có dòng chiết khấu 5,5% và đơn chiết khấu 5,6%.
- Kết quả mong đợi: Bước 1: `{ maxManualDiscountPercent: "0", version: 0 }`. Bước 2: `400` lỗi ở `maxManualDiscountPercent` với ba giá trị đầu; "5,5" lưu thành "5.5", phiên bản 1. Bước 3: `409 CONFLICT_VERSION`. Bước 4: "100" lập được (đơn giá 0; gửi sinh ngoại lệ chiết khấu, dưới giá vốn); "100.01" `400`; "" thành 0; 0 dòng, 201 dòng, số lượng 0, tên 201 ký tự, trường lạ đều `400`. Bước 5: 5,5% xác nhận ngay (bằng mức tối đa); 5,6% `pending`, ngoại lệ `discount`.
- Kiểm thử tự động: Thủ công – gọi API bằng công cụ gọi API
- Lát: L0

### KICHBAN_KIEMTHU_178: Biên hạn mức công nợ; che hạn mức công nợ, giá vốn trong diễn giải ngoại lệ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88, TIEUCHI_NGHIEMTHU_92
- Chức năng: CHUC_NANG_54
- Loại: Giá trị biên, phân quyền, bảo mật
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `sales.order` một cấp; khách "Đại lý Sỉ Phú Thọ" hạn mức 1.000.000, chưa có đơn nào.
- Các bước: (1) Gửi đơn khách "Đại lý Sỉ Phú Thọ" có tổng gồm thuế đúng 1.000.000 (ví dụ lập dòng đơn vị chai để ra đúng số). (2) Gửi đơn cùng khách 1 chai. (3) Gửi đơn khách "Cửa hàng Lẻ An Bình" (hạn mức trống) 30 thùng; đơn người mua không lấy hóa đơn 1 thùng. (4) Gửi đơn chiết khấu 50% (dưới giá vốn) với chiết khấu tối đa 60%. (5) Nhân viên bán hàng, Thủ kho, Quản trị công ty lần lượt xem chi tiết đơn bước 2, bước 4 qua API và trên trình duyệt.
- Kết quả mong đợi: Bước 1: `confirmed` (bằng hạn mức không vượt). Bước 2: `pending`, ngoại lệ `credit_limit`. Bước 3: không có ngoại lệ `credit_limit` (hạn mức trống, không có khách thì không kiểm). Bước 4: `pending`, ngoại lệ `below_cost`. Bước 5: Nhân viên bán hàng, Thủ kho thấy loại ngoại lệ, `detail` là chuỗi trống, giao diện không hiện số; Quản trị công ty (có `crm.profile.manage`, `inventory.cost.view`) thấy "<dư nợ sau đơn> > 1000000" và "<giá một đơn vị cơ sở> < 4000".
- Kiểm thử tự động: Thủ công – gọi API và kiểm tra trên trình duyệt
- Lát: L0

### KICHBAN_KIEMTHU_179: Phân quyền từng vai trò của mini app Bán hàng và phiếu giao hàng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_92
- Chức năng: CHUC_NANG_54, CHUC_NANG_55, CHUC_NANG_56, CHUC_NANG_57
- Loại: Phân quyền
- Vai trò thực hiện: Nhân viên bán hàng VCR, VCT; Thủ kho VCR-BD; Quản lý kho; người dùng chỉ có vai trò Nhân viên (không quyền Bán hàng); Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Đơn A của VCR do Nhân viên bán hàng VCR lập, đang chờ duyệt; đơn B đã xác nhận.
- Các bước: (1) Người không có quyền Bán hàng gọi `GET /sales/orders`, mở `/sales`. (2) Thủ kho VCR-BD gọi `GET /sales/orders`, `GET /sales/settings`, `GET /sales/price`, `GET /sales/items?search=nuoc`, `PUT /sales/settings`, `POST /sales/orders/{B}/cancel`. (3) Nhân viên bán hàng VCR gọi `PUT /sales/settings`, `POST /inventory/sales-issues` theo đơn B, `GET /inventory/sales-orders`. (4) Quản trị công ty VCR rút đơn A (không phải người lập). (5) Nhân viên bán hàng VCT gọi `GET`, `PATCH`, `POST .../cancel`, `POST .../close` đơn B với `X-Company-Id` VCT, và với `X-Company-Id` VCR. (6) Quản lý kho gán ở VCR-BD gọi `GET /inventory/sales-orders`, lập, gửi phiếu xuất theo đơn B.
- Kết quả mong đợi: Bước 1: `403`; trang "Bạn không có quyền xem trang này". Bước 2: `200`, `200`, `403`, `403`, `403`, `403`. Bước 3: `403`, `403` hoặc `404`, danh sách rỗng hoặc `403`. Bước 4: `403`. Bước 5: `404`, `404`, `409 CONFLICT_VERSION` hoặc `404`; với VCR `403` (không được gán ở VCR). Bước 6: có đơn B; lập, gửi được.
- Kiểm thử tự động: Thủ công – gọi API bằng công cụ gọi API
- Lát: L0, L1

### KICHBAN_KIEMTHU_180: Giao hàng, nhận hàng trả lại trên trình duyệt (mini app Kho)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_90, TIEUCHI_NGHIEMTHU_91
- Chức năng: CHUC_NANG_56, CHUC_NANG_57
- Loại: Đúng, giao diện
- Vai trò thực hiện: Thủ kho VCR-BD; Nhân viên bán hàng VCR
- Điều kiện ban đầu và dữ liệu: Đơn đã xác nhận có 2 thùng nước, 1 hộp hàng theo lô (hai lô hạn khác nhau), 1 điện thoại; kho có vị trí và kho không dùng vị trí.
- Các bước: (1) Thủ kho mở `/inventory/documents`, bấm "Giao hàng theo đơn bán". (2) Chọn đơn; nhập 1 thùng nước, chọn lô, nhập serial; "Lưu nháp". (3) Ở chi tiết phiếu nháp: kiểm nút; bấm "Xóa nháp"; lập lại, bấm "Gửi". (4) Bấm "Nhận hàng trả lại" ở phiếu đã ghi sổ; nhập lý do, số trả 1 chai nước, chọn serial điện thoại; "Lưu nháp", "Gửi". (5) Bấm liên kết "Đơn bán" ở phiếu xuất; xem chi tiết đơn. (6) Mở `/inventory/sales-returns/new` không có `issueId`.
- Kết quả mong đợi: Bước 1: trang "Giao hàng theo đơn bán", danh sách chọn đơn. Bước 2: mỗi dòng hiện "Đặt <số> <đơn vị>, còn phải giao <số> <đơn vị>"; lô gợi ý hết hạn trước được chọn sẵn; chỉ dòng có số giao vào phiếu; mở chi tiết phiếu nháp. Bước 3: chỉ có "Xóa nháp", "Gửi" (không "Sửa"); xóa xong "Đã xóa phiếu nháp."; gửi xong trạng thái đã ghi sổ, số `XBH`, có "Khách hàng", "Đơn bán". Bước 4: trang "Nhận hàng trả lại: <số phiếu xuất>", câu "Hàng trả nhập lại theo giá vốn trên phiếu xuất gốc."; ô số trả theo đơn vị cơ sở; gửi xong số `NTL`, "Phiếu xuất gốc" liên kết về phiếu xuất. Bước 5: mở MAN_HINH_43; cột "Đã giao" hiện số đã giao, "đã trả 1"; khối "Phiếu kho liên quan" có hai phiếu. Bước 6: "Chọn phiếu xuất giao hàng để nhận hàng trả lại.".
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L1

### KICHBAN_KIEMTHU_181: Khóa đồng thời khi gửi đơn, giao hàng, nhận hàng trả lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88, TIEUCHI_NGHIEMTHU_89, TIEUCHI_NGHIEMTHU_90, TIEUCHI_NGHIEMTHU_91
- Chức năng: CHUC_NANG_54, CHUC_NANG_56, CHUC_NANG_57
- Loại: Đồng thời, giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng VCR (hai phiên); Thủ kho VCR-BD (hai phiên)
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `sales.order` một cấp; khách hạn mức 1.000.000 chưa có đơn; kho còn khả dụng 30 thùng nước.
- Các bước: (1) Hai phiên gửi cùng lúc hai đơn nháp cùng khách, mỗi đơn 600.000. (2) Hai phiên gửi cùng lúc hai đơn, mỗi đơn 20 thùng. (3) Hai phiên gửi cùng lúc hai phiếu xuất nháp, mỗi phiếu 2 thùng, theo đơn còn phải giao 3 thùng. (4) Hai phiên gửi cùng lúc hai phiếu trả nháp, mỗi phiếu 1 cái, theo dòng phiếu xuất đã giao 1 cái. (5) Hai phiên gửi cùng lúc hai đơn có cùng hai mặt hàng nhưng thứ tự dòng ngược nhau.
- Kết quả mong đợi: Bước 1: đơn gửi sau có ngoại lệ `credit_limit` (hồ sơ khách bị khóa khi gửi). Bước 2: một đơn được, đơn kia lỗi "Không đủ hàng khả dụng (một phần đang được giữ).". Bước 3: một phiếu ghi sổ, phiếu kia lỗi "Vượt số còn phải giao của đơn bán." (khóa đơn bán). Bước 4: một phiếu ghi sổ, phiếu kia lỗi "Vượt số đã giao còn trả được của phiếu xuất gốc." (khóa dòng phiếu xuất gốc). Bước 5: cả hai xử lý xong, không khóa chéo (giữ hàng, dùng hàng giữ theo thứ tự mã mặt hàng).
- Kiểm thử tự động: Thủ công – chạy tập lệnh gọi API song song
- Lát: L0, L1

### KICHBAN_KIEMTHU_182: Hủy, đóng đơn theo trạng thái; phiếu xuất nháp chặn hủy, đóng; giữ hàng khi sửa, gửi lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_89, TIEUCHI_NGHIEMTHU_90
- Chức năng: CHUC_NANG_54, CHUC_NANG_56
- Loại: Đúng, sai, giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD
- Điều kiện ban đầu và dữ liệu: Chính sách duyệt `sales.order` một cấp; chiết khấu tối đa 5%.
- Các bước: (1) Hủy đơn nháp; hủy đơn bị từ chối. (2) Đơn bị từ chối: sửa giảm chiết khấu về 5%, gửi lại; xem số giữ. (3) Đơn đã xác nhận 2 thùng: Thủ kho lập phiếu xuất nháp 1 thùng (chưa gửi); Nhân viên bán hàng hủy đơn, xem nút trên chi tiết. (4) Thủ kho gửi phiếu nháp; lập thêm phiếu nháp 1 thùng; Nhân viên bán hàng đóng đơn. (5) Thủ kho xóa phiếu nháp; Nhân viên bán hàng đóng đơn với lý do trống, rồi lý do "Khách đổi ý". (6) Hủy, đóng đơn đã giao đủ, đã hủy.
- Kết quả mong đợi: Bước 1: `cancelled`. Bước 2: về nháp khi sửa; gửi lại `confirmed`, không ngoại lệ; giữ hàng lại đúng số của đơn. Bước 3: `409` "Đơn bán đã có phiếu xuất giao hàng hoặc không ở trạng thái hủy được; hãy đóng đơn."; không có "Hủy đơn", "Đóng đơn". Bước 4: `409` "Đơn bán còn phiếu xuất giao hàng nháp, chưa đóng được."; nút "Đóng đơn" ẩn. Bước 5: lý do trống `400`; `closed`, nhả phần giữ còn lại. Bước 6: hủy `409`; đóng `409 CONFLICT_VERSION`.
- Kiểm thử tự động: Thủ công – gọi API và kiểm tra trên trình duyệt
- Lát: L0, L1

### KICHBAN_KIEMTHU_183: Trả một phần theo đơn vị cơ sở; hai phiếu trả gửi đồng thời; che giá vốn trong ngoại lệ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88, TIEUCHI_NGHIEMTHU_91
- Chức năng: CHUC_NANG_55, CHUC_NANG_57
- Loại: Đúng, sai, giá trị biên, đồng thời
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD; Quản trị VCR
- Điều kiện ban đầu và dữ liệu: Nước suối đơn vị cơ sở chai, thùng 24 chai, giá vốn 4.000 một chai; chiết khấu tối đa 60%.
- Các bước: (1) Đơn 1 thùng, giao 1 thùng. (2) Lập phiếu trả 5 chai, gửi. (3) Lập hai phiếu trả 15 chai, gửi cùng lúc. (4) Đơn 1 thùng chiết khấu 50%, gửi; Nhân viên bán hàng và Quản trị xem chi tiết đơn. (5) Thủ kho mở dòng của một đơn nháp và của đơn ở bước 1 qua `GET /inventory/sales-orders/{id}`.
- Kết quả mong đợi: Bước 2: phiếu trả 5 chai, giá trị 20.000. Bước 3: một phiếu ghi sổ, phiếu kia `400` "vượt số đã giao"; tổng đã trả 20 chai. Bước 4: ngoại lệ dưới giá vốn; Nhân viên bán hàng không thấy diễn giải, Quản trị thấy giá bán và giá vốn. Bước 5: đơn nháp `404`; đơn đã giao `200`.
- Ghi chú THAY_DOI_09 (CONG_VIEC_13): từ khi có công nợ, giao hàng và trả hàng ở kịch bản này còn sinh khoản phải thu, khoản giảm phải thu (QUYTAC_NGHIEPVU_86); kịch bản không kiểm hạn mức nên kết quả không đổi.
- Kiểm thử tự động: `apps/api/test/c8-sales.test.ts`
- Lát: L0, L1

### KICHBAN_KIEMTHU_184: Dư nợ tạm tính trừ hàng khách trả; đơn chờ duyệt không tính
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88
- Chức năng: CHUC_NANG_55, CHUC_NANG_57
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng VCR; Thủ kho VCR-BD
- Điều kiện ban đầu và dữ liệu: Khách mới, hạn mức 250.000, số ngày được nợ 30; nước suối giá chung 6.600 gồm thuế một chai, thùng 24 chai.
- Các bước: (1) Đơn 1 thùng (158.400), gửi, giao đủ. (2) Đơn 1 thùng nữa, gửi. (3) Khách trả 12 chai (79.200). (4) Đơn 1 thùng, gửi.
- Kết quả mong đợi: Bước 1: `confirmed`. Bước 2: `pending`, ngoại lệ `credit_limit` (316.800 > 250.000). Bước 4: `confirmed`, không ngoại lệ (79.200 + 158.400 = 237.600; đơn chờ duyệt ở bước 2 không tính).
- Ghi chú THAY_DOI_09 (CONG_VIEC_13): dư nợ tính theo QUYTAC_NGHIEPVU_92 thay QUYTAC_NGHIEPVU_69: bước 1 sinh phải thu 158.400, bước 3 sinh khoản giảm 79.200 trừ vào phiếu xuất gốc; số dư công nợ 79.200 cộng đơn đang gửi 158.400 = 237.600, kết quả không đổi. Hàng đã giao nay tính theo số còn nợ, không còn giới hạn theo số ngày được nợ.
- Kiểm thử tự động: `apps/api/test/c8-sales.test.ts`
- Lát: L0, L1

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

Dữ liệu chung: công ty bán VCR (`testIds.retailCompany`, tên ngắn "VComm Bán lẻ Miền Nam"), công ty mua VCT (`testIds.tradingCompany`, "VComm Thương mại"); Quản trị tập đoàn `quantri.tapdoan@vcomm.test` (thao tác bên VCT), Quản trị công ty VCR `quantri.vcr@vcomm.test`; tạo trong tệp kiểm thử: Thủ kho `thukho.noibo@vcomm.test` (`warehouse_keeper` gán ở chi nhánh Bình Dương của VCR), Nhân viên bán hàng VCT `banhang.vct.noibo@vcomm.test` (`salesperson` ở VCT, không có quyền Mua hàng). Kho `NBB` "Kho bán nội bộ" (VCR, kho xuất) và `NBM` "Kho nhận VCT" (cùng chi nhánh, công ty chủ hàng gồm VCT, kho nhận), không dùng vị trí. Mặt hàng VCR: "Bánh nội bộ" (cái; tồn đầu 500 cái giá vốn 6.000), "Bánh chưa liên kết" (cái; 10 cái), "Máy nội bộ" (cái, theo serial; `MAY-01` đến `MAY-03` giá vốn 2.000.000); mặt hàng VCT: "Bánh nội bộ hộp" (hộp), "Máy nội bộ nhận" (cái, serial). Liên kết: một hộp VCT bằng 12 cái VCR; máy hệ số 1; mọi sản phẩm thuế suất 10%. Kênh "Nội bộ" (`NOI_BO`) và "Bán lẻ" (`BAN_LE`) của VCR tạo từ kênh mặc định; bảng giá `NB` chưa thuế kênh Nội bộ (bánh 10.000 một cái, máy 3.000.000), bảng giá `LE` gồm thuế (bánh 15.000). Hồ sơ: VCT là khách hàng ở VCR, VCR là nhà cung cấp ở VCT (đối tác nội bộ tự đồng bộ). Các kịch bản tự động chạy nối tiếp trong một tệp; công ty VCT chưa có chính sách duyệt `purchasing.order` cho tới KICHBAN_KIEMTHU_190. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_58, CHUC_NANG_59: Chứng từ đối ứng (CONG_VIEC_09)

### KICHBAN_KIEMTHU_185: Đơn bán nội bộ: sai kênh, thiếu liên kết bị từ chối; xác nhận sinh đơn mua đối ứng đúng mặt hàng, số lượng, giá; chưa duyệt đơn mua thì chưa giao; bên mua xác nhận chọn kho
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_93, TIEUCHI_NGHIEMTHU_95
- Chức năng: CHUC_NANG_58, CHUC_NANG_60
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị công ty VCR; Quản trị tập đoàn (ở VCT); Thủ kho VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung.
- Các bước: (1) Quản trị VCR lập đơn bán cho khách VCT, kênh "Bán lẻ", 24 cái bánh. (2) Lập đơn kênh Nội bộ với "Bánh chưa liên kết". (3) Lập đơn kênh Nội bộ 24 cái bánh, gửi. (4) Quản trị tập đoàn xem đơn mua đối ứng ở VCT. (5) Thủ kho lập phiếu xuất giao hàng 1 cái theo đơn bán. (6) Quản trị tập đoàn sửa đơn mua đối ứng. (7) Xác nhận đơn mua đối ứng, kho nhận `NBM`. (8) Thủ kho lập lại phiếu xuất bước 5.
- Kết quả mong đợi: Bước 1: lỗi chỉ ở `channelId` "Đơn bán cho công ty con phải dùng kênh bán Nội bộ.". Bước 2: lỗi chỉ ở `lines.0.variantId` "Mặt hàng chưa liên kết với sản phẩm của công ty bên kia.". Bước 3: `confirmed`, `isInternal: true`, `isCounterpart: false`, `counterpart` là VComm Thương mại, chưa có số, `counterpart_pending`. Bước 4: `counterpart_pending`, nhà cung cấp "Công ty Cổ phần VComm Bán lẻ Miền Nam", `warehouseId: null`, `isCounterpart: true`, `canConfirmCounterpart: true`, `canEdit: false`, `canSubmit: false`, tổng chưa thuế "240000", thuế "24000", `counterpart.documentNo` bằng số đơn bán; một dòng "Bánh nội bộ hộp", đơn vị hộp, số lượng "2", đơn giá "120000", thuế suất "10". Bước 5: `409` "Đơn mua đối ứng của công ty mua chưa được duyệt, chưa giao được.". Bước 6: `409`. Bước 7: `approved` (chưa có chính sách duyệt), kho `NBM`, số bắt đầu `DMH`. Bước 8: `201`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_186: Đơn mua nội bộ: giá theo bảng giá Nội bộ bên bán, không sửa tay; duyệt sinh đơn bán đối ứng; bên bán xác nhận giữ hàng, giao được ngay; bên bán từ chối thì đơn mua đóng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_94
- Chức năng: CHUC_NANG_59
- Loại: Đúng, sai
- Vai trò thực hiện: Quản trị tập đoàn (ở VCT); Quản trị công ty VCR; Thủ kho VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung.
- Các bước: (1) Quản trị tập đoàn tra giá nhà cung cấp VCR, "Bánh nội bộ hộp", đơn vị hộp. (2) Lập đơn mua 3 hộp, đơn giá nhập tay 1, thuế suất 0. (3) Gửi. (4) Quản trị VCR xem đơn bán đối ứng. (5) Xác nhận đơn bán đối ứng, kho xuất `NBB`; xem số giữ. (6) Thủ kho lập phiếu xuất 1 cái theo đơn bán đó. (7) Lập, gửi đơn mua khác 1 hộp; Quản trị VCR từ chối đơn bán đối ứng với lý do "Hết hàng"; xem đơn mua.
- Kết quả mong đợi: Bước 1: `{ unitPrice: "120000.0000", priceId: null, internal: { vatRate: "10" } }`. Bước 2: `201`, dòng đơn giá "120000", thuế suất "10". Bước 3: `approved`, `isInternal: true`, `canEdit: false`, `counterpart` là VComm Bán lẻ Miền Nam, `counterpart_pending`. Bước 4: `counterpart_pending`, `warehouseId: null`, `isCounterpart: true`, `canConfirmCounterpart: true`, `canEdit: false`, `canCancel: false`, chưa thuế "360000"; dòng "Bánh nội bộ", đơn vị cái, số lượng "36", giá bảng giá "10000". Bước 5: `confirmed`, số bắt đầu `DBH`, kho `NBB`; số giữ tăng 36. Bước 6: `201`. Bước 7: đơn bán `cancelled`, `counterpartRejectedReason` "Hết hàng"; đơn mua `closed`, lý do đóng "Bên bán từ chối: Hết hàng".
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_187: Kết thúc hai bên: bên mua từ chối thì đơn bán hủy, nhả hàng giữ; bên bán hủy thì đơn mua đóng; đóng đơn mua thì đơn bán đã giao một phần đóng; công ty khác, người không có quyền không xem, không xác nhận được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_97
- Chức năng: CHUC_NANG_58, CHUC_NANG_59
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; Quản trị tập đoàn (ở VCT); Nhân viên bán hàng VCT; Thủ kho VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung.
- Các bước: (1) Quản trị VCR gửi đơn bán nội bộ 12 cái; xem số giữ. (2) Nhân viên bán hàng VCT từ chối đơn mua đối ứng. (3) Quản trị VCR mở đơn mua đối ứng (ở VCR). (4) Quản trị tập đoàn từ chối với lý do "Không cần"; xem đơn bán, số giữ. (5) Gửi đơn bán nội bộ 12 cái khác, hủy; xem đơn mua đối ứng. (6) Quản trị tập đoàn lập, gửi đơn mua 2 hộp; Quản trị VCR xác nhận đơn bán đối ứng kho `NBB`; Thủ kho lập phiếu xuất nháp 12 cái. (7) Quản trị tập đoàn đóng đơn mua, lý do "Đủ dùng". (8) Thủ kho gửi phiếu xuất; Quản trị tập đoàn đóng đơn mua lần nữa; xem đơn bán, số giữ.
- Kết quả mong đợi: Bước 1: số giữ tăng 12. Bước 2: `403`. Bước 3: `404`. Bước 4: đơn mua `closed`; đơn bán `cancelled`, lý do "Bên mua từ chối: Không cần"; số giữ về như trước bước 1. Bước 5: đơn bán `cancelled`; đơn mua `closed`, lý do "Bên bán hủy đơn bán đối ứng". Bước 7: `409` (còn phiếu xuất nháp). Bước 8: phiếu `posted`; đơn mua `closed`; đơn bán `closed`, lý do "Bên mua đóng đơn mua đối ứng: Đủ dùng"; số giữ giảm 12 (phần còn giữ được nhả).
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L0

## CHUC_NANG_60, CHUC_NANG_61: Giao, nhận hàng nội bộ, biên bản chênh lệch (CONG_VIEC_09)

### KICHBAN_KIEMTHU_188: Xuất giao hàng nội bộ sinh phiếu nhập chờ nhận đúng mặt hàng, số lượng, đơn giá, serial; nhận vượt, serial không xuất bị từ chối; nhận đủ thì đơn mua nhận đủ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_95
- Chức năng: CHUC_NANG_60
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; Quản trị tập đoàn (ở VCT); Thủ kho VCR; Nhân viên bán hàng VCT
- Điều kiện ban đầu và dữ liệu: Đơn bán nội bộ 24 cái bánh và 2 máy; bên mua xác nhận kho `NBM` (duyệt ngay); Thủ kho lập, gửi phiếu xuất 24 cái và máy `MAY-01`, `MAY-02`.
- Các bước: (1) Quản trị tập đoàn xem phiếu nhập sinh từ phiếu xuất (ở VCT). (2) Nhân viên bán hàng VCT (không có quyền nhập mua tại kho nhận) gọi nhận phiếu đó. (3) Nhận dòng bánh 3 hộp, dòng máy 2 với serial `MAY-01`, `MAY-03`. (4) Nhận dòng bánh 2 hộp, dòng máy `MAY-01`, `MAY-02`. (5) Xem tồn VCT ở kho `NBM`, đơn mua. (6) Nhận lần nữa.
- Kết quả mong đợi: Bước 1: loại `purchase_receipt`, trạng thái `in_transit`, công ty VCT, kho `NBM`, `canReceiveInternal: true`; `internalReceipt` có số phiếu xuất, "VComm Bán lẻ Miền Nam", dòng bánh xuất "2" không serial, dòng máy xuất "2" serial `MAY-01`, `MAY-02`; dòng bánh: "Bánh nội bộ hộp", đơn vị hộp, số lượng "2", đơn giá "120000". Bước 2: `403` hoặc `404`. Bước 3: lỗi `lines.0.receivedQuantity` "Số nhận vượt số đã xuất." và `lines.1.serials` "Serial không có trong phiếu xuất gốc.". Bước 4: `posted`, số bắt đầu `NM`, `canReceiveInternal: false`. Bước 5: bánh hộp tồn 2, máy tồn 2; đơn mua `received`. Bước 6: `409`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_189: Nhận thiếu phải ghi lý do, sinh biên bản ở công ty bán; nhập lại kho ghi sổ phiếu trả; ghi tổn thất đóng biên bản; mỗi biên bản xử lý một lần; giá trị chỉ hiện cho người xem được giá vốn
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_96
- Chức năng: CHUC_NANG_60, CHUC_NANG_61
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Quản trị tập đoàn (ở VCT); Thủ kho VCR; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_188: phiếu xuất 24 cái bánh (phiếu nhập 2 hộp chờ nhận); sau đó phiếu xuất 1 máy `MAY-03`.
- Các bước: (1) Nhận 1 hộp, không ghi lý do. (2) Nhận 1 hộp, lý do "Rách thùng". (3) Quản trị tập đoàn xem danh sách biên bản ở VCT; Thủ kho xem biên bản "Chờ xử lý" ở VCR; Quản trị VCR xem. (4) Thủ kho xử lý "Nhập lại kho", ghi chú "Hàng về lại kho"; xem phiếu trả, tồn bánh ở `NBB`. (5) Xử lý lại biên bản đó "Ghi tổn thất". (6) Phiếu nhập máy: nhận 0, lý do "Thất lạc". (7) Xem biên bản mới; Thủ kho "Ghi tổn thất", ghi chú "Ghi tổn thất".
- Kết quả mong đợi: Bước 1: lỗi chỉ ở `shortageReason` "Nhận thiếu phải ghi lý do.". Bước 2: `posted`. Bước 3: VCT nhận danh sách rỗng; Thủ kho thấy một biên bản: số phiếu xuất, công ty mua "VComm Thương mại", số thiếu "12" (cái), `value: null`, lý do "Rách thùng", `open`, `canResolve: true`; Quản trị VCR thấy `value` "72000". Bước 4: `201`; biên bản `returned`, có `returnDocumentId`, `canResolve: false`; phiếu trả loại `sales_return`, `posted`; tồn bánh tăng 12. Bước 5: `409`. Bước 6: `posted`, không có dòng. Bước 7: một biên bản số thiếu "1", serial `MAY-03`, giá trị "2000000" (Quản trị VCR); sau xử lý `written_off`, ghi chú "Ghi tổn thất", `returnDocumentId: null`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_190: Đơn mua nội bộ không lập phiếu nhập mua thường; bên bán hủy khi đơn mua đối ứng chờ duyệt thì yêu cầu duyệt bị rút; bên mua rút đơn đối ứng thì đơn bán hủy, nhả hàng giữ
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_95, TIEUCHI_NGHIEMTHU_97
- Chức năng: CHUC_NANG_58, CHUC_NANG_60
- Loại: Sai, luồng duyệt
- Vai trò thực hiện: Quản trị tập đoàn (ở VCT); Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; từ bước 3 VCT có chính sách duyệt `purchasing.order` một cấp từ 0 đồng, người duyệt Nhân viên bán hàng VCT, người thay thế Quản trị tập đoàn.
- Các bước: (1) Quản trị tập đoàn lập, gửi đơn mua nội bộ 1 hộp; xem danh sách đơn mua chờ nhận (`GET /inventory/purchase-orders`). (2) Lập phiếu nhập mua thường theo đơn đó. (3) Lập chính sách duyệt; Quản trị VCR gửi đơn bán nội bộ 12 cái; Quản trị tập đoàn xác nhận đơn mua đối ứng kho `NBM`. (4) Quản trị VCR hủy đơn bán; xem đơn mua, yêu cầu duyệt. (5) Lặp bước 3; Quản trị tập đoàn rút đơn mua đối ứng; xem hai đơn, số giữ.
- Kết quả mong đợi: Bước 1: `approved`; danh sách không có đơn này. Bước 2: `409` "Đơn mua nội bộ chỉ nhận theo phiếu nhập sinh từ phiếu xuất của công ty bán.". Bước 3: đơn mua `pending`, `canWithdraw: true`. Bước 4: đơn bán `cancelled`; đơn mua `closed`; yêu cầu duyệt `withdrawn`. Bước 5: rút `201`; đơn mua `closed`, lý do "Bên mua rút đơn mua đối ứng"; đơn bán `cancelled`, cùng lý do; số giữ giảm 12.
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L0, L1

## Kịch bản thủ công của giao dịch nội bộ (CONG_VIEC_09)

### KICHBAN_KIEMTHU_191: Chứng từ đối ứng trên trình duyệt: nhãn Nội bộ, chứng từ đối ứng, xác nhận, từ chối; giá nội bộ khóa sửa; máy tính và điện thoại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_98
- Chức năng: CHUC_NANG_58, CHUC_NANG_59
- Loại: Đúng, sai, giao diện
- Vai trò thực hiện: Quản trị công ty VCR; Quản trị tập đoàn (ở VCT)
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; mini app Nền tảng, Bán hàng, Mua hàng, backend đang chạy.
- Các bước: (1) Quản trị VCR lập đơn bán khách VCT, kênh Nội bộ, 24 cái bánh, gửi; xem chi tiết. (2) Quản trị tập đoàn chọn công ty VCT, mở `/purchasing/orders`, lọc "Chờ xác nhận nội bộ", mở đơn. (3) Bấm "Xác nhận" khi chưa chọn kho; chọn kho nhận rồi bấm "Xác nhận". (4) Mở `/purchasing/orders/new`, chọn nhà cung cấp VCR, thêm "Bánh nội bộ hộp". (5) Lưu, gửi đơn; Quản trị VCR mở đơn bán đối ứng ở `/sales/orders`. (6) Nhập lý do, bấm "Từ chối"; Quản trị tập đoàn xem lại đơn mua. (7) Lặp bước 1, 2, 5 trên điện thoại (chiều rộng 375 điểm ảnh).
- Kết quả mong đợi: Bước 1: thẻ có nhãn "Nội bộ" và "Đơn mua đối ứng của VComm Thương mại: chưa có số (Chờ xác nhận nội bộ)". Bước 2: nhãn trạng thái "Chờ xác nhận nội bộ", kho nhận trống, không có nút "Sửa"; thẻ "Sinh từ đơn bán của VComm Bán lẻ Miền Nam: <số>", câu hướng dẫn, ô "Kho nhận", nút "Xác nhận", ô "Lý do từ chối", nút "Từ chối". Bước 3: nút "Xác nhận" bị khóa khi chưa chọn kho; sau xác nhận đơn "Đã duyệt", có số, khối xác nhận ẩn; đơn bán hiện số đơn mua, "Đã duyệt". Bước 4: khối "Nhà cung cấp nội bộ: giá theo bảng giá kênh Nội bộ của công ty bán, không sửa được."; đơn giá 120.000 chỉ đọc, thuế suất 10% khóa. Bước 5: đơn bán "Chờ xác nhận nội bộ", ô "Kho xuất", không có nút "Sửa đơn bán", "Hủy đơn". Bước 6: đơn bán "Đã hủy", khối "Đã từ chối: <lý do>"; đơn mua "Đã đóng", lý do đóng "Bên bán từ chối: <lý do>". Bước 7: khối đối ứng, ô, nút xếp dọc, không cuộn ngang.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0

### KICHBAN_KIEMTHU_192: Nhận hàng nội bộ và biên bản chênh lệch trên trình duyệt (mini app Kho); máy tính và điện thoại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_98
- Chức năng: CHUC_NANG_60, CHUC_NANG_61
- Loại: Đúng, sai, giao diện, phân quyền
- Vai trò thực hiện: Quản trị tập đoàn (ở VCT); Thủ kho VCR; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_191 bước 1 đến 3; Thủ kho VCR đã lập, gửi phiếu xuất 24 cái bánh và 1 máy `MAY-01`.
- Các bước: (1) Quản trị tập đoàn (VCT) mở `/inventory/documents`, mở phiếu nhập mua "Đang vận chuyển". (2) Đổi số nhận bánh thành 3, bỏ chọn serial máy, bấm "Xác nhận nhận hàng". (3) Đổi số nhận bánh thành 1, không ghi lý do, bấm "Xác nhận nhận hàng"; ghi lý do "Rách thùng", bấm lại. (4) Thủ kho VCR mở menu Kho, mục "Chênh lệch giao nội bộ". (5) Nhập ghi chú, bấm "Nhập lại kho" ở biên bản bánh; đổi lọc "Đã nhập lại kho", bấm "Phiếu trả". (6) Bấm "Ghi tổn thất" ở biên bản máy. (7) Quản trị VCR mở cùng màn hình. (8) Lặp bước 1, 4 trên điện thoại (chiều rộng 375 điểm ảnh).
- Kết quả mong đợi: Bước 1: dòng "Phiếu xuất của bên bán" (VComm Bán lẻ Miền Nam: <số phiếu xuất>); khối "Nhận hàng nội bộ": dòng bánh "Đã xuất 2 Hộp", ô số nhận 2; dòng máy ô chọn serial `MAY-01` đã chọn. Bước 2: lỗi "Số nhận vượt số đã xuất." dưới ô bánh; khi bỏ serial, ô "Lý do nhận thiếu" hiện. Bước 3: lỗi "Nhận thiếu phải ghi lý do." dưới ô lý do; sau đó "Đã nhận hàng nội bộ.", phiếu "Đã ghi sổ" có số, khối nhận ẩn. Bước 4: bảng biên bản "Chờ xử lý": bánh thiếu 12 cái, máy thiếu 1 kèm `MAY-01`, phiếu xuất → VComm Thương mại: <số phiếu nhập>, lý do, giá trị "—". Bước 5: "Đã nhập lại kho."; biên bản hiện người xử lý, ghi chú, liên kết "Phiếu trả" mở phiếu nhận hàng trả lại đã ghi sổ. Bước 6: "Đã ghi tổn thất.". Bước 7: cột giá trị hiện số tiền. Bước 8: bảng chuyển thành thẻ, ô, nút xếp dọc, không cuộn ngang. Quản trị tập đoàn khi chọn công ty VCT không thấy biên bản của VCR.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L1

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

Dữ liệu chung: công ty VCR (`testIds.retailCompany`); Quản trị công ty VCR `quantri.vcr@vcomm.test`, Quản trị tập đoàn `quantri.tapdoan@vcomm.test`, người duyệt `phuc.le@vcomm.test`; tạo trong tệp kiểm thử: Nhân viên bán hàng `banhang.km@vcomm.test` (`salesperson`, gán ở công ty), Thủ kho `thukho.km@vcomm.test` (`warehouse_keeper` gán ở chi nhánh Bình Dương); kho "Kho khuyến mãi" `KMW` tồn đầu 1.000 cái mỗi mặt hàng: "Bánh khuyến mãi" (giá vốn 9.000), "Kẹo khuyến mãi" (10.000), "Quà tặng khuyến mãi" (3.000), thuế suất 10%; bảng giá `CHUNG` gồm thuế: bánh 11.000, kẹo 22.000, quà 5.500 một cái; kênh mặc định `BAN_LE`, `BAN_SI`, `NOI_BO`; nhóm khách `VIP`, khách "Cửa hàng thân thiết" thuộc nhóm `VIP`. Chiết khấu tay tối đa 0%. Trừ KICHBAN_KIEMTHU_193, công ty không có chính sách duyệt `sales.promotion` (chương trình chạy ngay khi gửi); cuối mỗi kịch bản dừng mọi chương trình đang chạy.

## CHUC_NANG_62: Chương trình khuyến mãi (CONG_VIEC_12)

### KICHBAN_KIEMTHU_193: Lập ba loại, thiếu dữ liệu bị từ chối; nhân viên bán hàng không lập được; gửi duyệt, từ chối sửa lại, duyệt thì chạy; đang chạy chỉ dừng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_99
- Chức năng: CHUC_NANG_62
- Loại: Đúng, sai, phân quyền, luồng duyệt
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng; người duyệt
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; từ bước 4 có chính sách duyệt `sales.promotion` một cấp từ 0 đồng, người duyệt `phuc.le@vcomm.test`, người thay thế Quản trị công ty VCR.
- Các bước: (1) Quản trị VCR lập chương trình giảm theo sản phẩm không có mặt hàng; mua X tặng Y thiếu mặt hàng tặng, số lượng tặng. (2) Nhân viên bán hàng lập chương trình giảm theo đơn. (3) Nhân viên bán hàng xem danh sách. (4) Quản trị VCR lập "Giảm bánh" (bánh 10%, kênh bán lẻ, ngân sách 1.000.000), gửi. (5) Người duyệt từ chối; xem chương trình. (6) Sửa thành bánh 8%, không chọn kênh; gửi lại; người duyệt duyệt. (7) Sửa chương trình đang chạy. (8) Dừng kèm lý do "Đổi kế hoạch".
- Kết quả mong đợi: Bước 1: `400`, lỗi chỉ ở `items`; lỗi ở `giftQuantity`, `giftVariantId`. Bước 2: `403`. Bước 3: `200`. Bước 4: lưu `draft`, đúng loại, mặt hàng, kênh; gửi thì `pending`, số bắt đầu `KM`. Bước 5: `rejected`, `canEdit: true`. Bước 6: sửa về `draft`, kênh rỗng; duyệt xong `active`, `canEdit: false`, `canStop: true`. Bước 7: `409`. Bước 8: `stopped`, `stoppedReason` "Đổi kế hoạch", `canStop: false`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L0

## CHUC_NANG_63, CHUC_NANG_64: Áp khuyến mãi vào đơn bán, giới hạn (CONG_VIEC_12)

### KICHBAN_KIEMTHU_194: Dòng chọn phần trăm cao nhất, trừ trước chiết khấu tay; theo đơn chọn mức lớn nhất, có trần; mua 3 tặng 1 thêm đúng số suất
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_100
- Chức năng: CHUC_NANG_63
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR (chương trình); Nhân viên bán hàng (đơn)
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; chương trình đang chạy: "Bánh 10%", "Bánh 15%" (giảm theo sản phẩm); "Đơn từ 200 nghìn giảm 10%" (trần 15.000), "Đơn từ 200 nghìn giảm 5%" (giảm theo đơn); "Mua 3 kẹo tặng 1 quà".
- Các bước: (1) Nhân viên bán hàng lập đơn kênh bán lẻ, 10 cái bánh, chiết khấu tay 2%. (2) Lập đơn 10 cái bánh chiết khấu 2% và 7 cái kẹo.
- Kết quả mong đợi: Bước 1: một dòng, chương trình "Bánh 15%", phần trăm 15, đơn giá 9.163 (11.000 × 85% × 98%), thành tiền 91.630, không phải hàng tặng. Bước 2: ba dòng; tổng trước giảm theo đơn 245.630; 10% = 24.563 bị trần 15.000, 5% = 12.282, chọn "Đơn từ 200 nghìn giảm 10%"; tổng phần giảm theo đơn của hai dòng hàng bán đúng 15.000; dòng 3 quà 2 cái, đơn giá 0, thành tiền 0, hàng tặng, chương trình "Mua 3 kẹo tặng 1 quà"; tổng đơn 230.630.
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_195: Sai kênh, sai nhóm khách, ngoài thời gian, đã dừng, kênh Nội bộ thì không áp
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_101
- Chức năng: CHUC_NANG_63
- Loại: Sai, giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; chương trình "Kẹo VIP bán sỉ" (kẹo 20%, kênh bán sỉ, nhóm `VIP`), "Kẹo tháng sau" (kẹo 30%, từ 2026-12-01 đến 2026-12-31).
- Các bước: (1) Lập đơn 1 cái kẹo kênh bán sỉ, khách "Cửa hàng thân thiết". (2) Như bước 1, kênh bán lẻ. (3) Kênh bán sỉ, người mua không lấy hóa đơn. (4) Như bước 1, ngày đơn 2026-12-05. (5) Lập chương trình "Kẹo mọi kênh" (kẹo 5%, không chọn kênh); lập đơn kênh Nội bộ, người mua "Thử". (6) Dừng "Kẹo VIP bán sỉ"; lặp bước 1.
- Kết quả mong đợi: Bước 1: dòng có chương trình "Kẹo VIP bán sỉ". Bước 2, 3: không có chương trình. Bước 4: "Kẹo tháng sau" (30% cao hơn 20%). Bước 5: không có chương trình. Bước 6: "Kẹo mọi kênh".
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_196: Hết ngân sách không áp vào đơn mới; gửi đơn vượt ngân sách bị từ chối, lưu lại thì tính lại; suất tặng không quá số suất còn lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_102
- Chức năng: CHUC_NANG_64, CHUC_NANG_63
- Loại: Sai, giá trị biên, đồng thời
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; chương trình "Bánh ngân sách" (bánh 10%, tức 1.100 một cái; ngân sách 20.000).
- Các bước: (1) Lập hai đơn nháp, mỗi đơn 10 cái bánh. (2) Gửi đơn thứ nhất; xem chương trình. (3) Gửi đơn thứ hai. (4) Lưu lại đơn thứ hai không đổi dòng; gửi. (5) Lập chương trình "Kẹo tặng 3 suất" (mua 1 kẹo tặng 1 quà, tối đa 3 suất); lập, gửi đơn 2 cái kẹo. (6) Lập đơn 5 cái kẹo.
- Kết quả mong đợi: Bước 1: cả hai đơn có chương trình "Bánh ngân sách" (lúc lưu mỗi đơn còn đủ ngân sách). Bước 2: `confirmed`; đã dùng `usedAmount` 11.000. Bước 3: `409` "Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi.". Bước 4: dòng không còn chương trình; gửi `confirmed`. Bước 5: `confirmed`. Bước 6: dòng tặng 1 cái (còn 1 suất).
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_197: Khuyến mãi làm giá dưới giá vốn không sinh ngoại lệ; chiết khấu tay vượt mức vẫn sinh ngoại lệ; dòng tặng được giữ hàng, giao hàng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_103
- Chức năng: CHUC_NANG_63
- Loại: Đúng, sai, luồng kho
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng; Thủ kho
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; chương trình "Bánh giảm sâu" (bánh 50%), "Mua bánh tặng quà" (mua 2 bánh tặng 1 quà).
- Các bước: (1) Lập, gửi đơn 2 cái bánh. (2) Lập, gửi đơn 1 cái kẹo chiết khấu tay 10%. (3) Xem số giữ hàng của quà theo đơn bước 1. (4) Thủ kho lập phiếu xuất giao hàng đủ mọi dòng (gồm dòng tặng) của đơn bước 1, gửi; xem đơn.
- Kết quả mong đợi: Bước 1: đơn giá 5.500 gồm thuế thấp hơn giá vốn 9.000 nhưng do khuyến mãi: `confirmed`, không có ngoại lệ; có dòng tặng 1 cái quà. Bước 2: ngoại lệ `discount`. Bước 3: đang giữ 1 cái. Bước 4: phiếu `201`, ghi sổ `posted`; đơn `delivered`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_198: Dòng tặng của chương trình này không làm đủ điều kiện mua của chương trình khác; mua X tặng Y không nhận ngân sách; tặng theo tồn còn lại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_100, TIEUCHI_NGHIEMTHU_99
- Chức năng: CHUC_NANG_63, CHUC_NANG_62
- Loại: Sai, giá trị biên
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; dừng mọi chương trình; chương trình "Mua 2 bánh tặng 2 kẹo", "Mua 2 kẹo tặng 1 quà". Tồn quà ở kho `KMW` còn dưới 1.200 cái sau các kịch bản trước.
- Các bước: (1) Lập đơn 2 cái bánh. (2) Lập chương trình mua X tặng Y "Sai ngân sách" có ngân sách 100.000. (3) Dừng mọi chương trình; lập "Mua 1 kẹo tặng 600 quà"; lập đơn 2 cái kẹo. (4) Gửi đơn bước 3.
- Kết quả mong đợi: Bước 1: chỉ một dòng tặng: kẹo 2 cái (dòng tặng kẹo không làm đơn đủ điều kiện "Mua 2 kẹo tặng 1 quà"). Bước 2: `400`, lỗi chỉ ở `budgetAmount`. Bước 3: tính được 2 suất nhưng kho chỉ đủ 1 suất: dòng tặng 600 cái quà; `giftShortages` là `[{ promotionName: "Mua 1 kẹo tặng 600 quà", missingSets: 1 }]`. Bước 4: `confirmed`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c12-promotions.test.ts`
- Lát: L1

## Kịch bản thủ công của khuyến mãi (CONG_VIEC_12)

### KICHBAN_KIEMTHU_199: Chương trình khuyến mãi và khuyến mãi trên đơn bán trên trình duyệt (máy tính)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_104
- Chức năng: CHUC_NANG_62, CHUC_NANG_63, CHUC_NANG_64
- Loại: Đúng, sai, giao diện, phân quyền
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Dữ liệu như phần dữ liệu chung (tạo trên môi trường phát triển); mini app Nền tảng, Bán hàng, backend đang chạy; không có chính sách duyệt `sales.promotion`.
- Các bước: (1) Quản trị VCR mở mini app Bán hàng, menu "Khuyến mãi"; bấm "Lập chương trình". (2) Chọn loại "Giảm theo sản phẩm", bấm "Lưu" khi chưa thêm mặt hàng. (3) Thêm "Bánh khuyến mãi" giảm 10, ngân sách 20.000, lưu; bấm "Gửi duyệt". (4) Lập chương trình "Mua X tặng Y": mua 3 kẹo, tặng 1 quà, số suất tối đa 10; lưu, gửi duyệt. (5) Nhân viên bán hàng mở "Khuyến mãi", mở một chương trình. (6) Nhân viên bán hàng lập đơn kênh bán lẻ: 10 cái bánh, 3 cái kẹo; xem chú thích dưới tổng tạm tính; lưu. (7) Bấm "Sửa đơn bán". (8) Quản trị VCR mở lại danh sách "Khuyến mãi"; lọc "Đang chạy"; mở "Giảm bánh", nhập lý do, bấm "Dừng chương trình".
- Kết quả mong đợi: Bước 1: danh sách cột Số, Tên chương trình, Loại, Thời gian, Đã dùng, Trạng thái; biểu mẫu có Kênh bán áp dụng, Nhóm khách áp dụng kèm gợi ý. Bước 2: lỗi "Vui lòng nhập thông tin này." ở khối mặt hàng. Bước 3: "Đã lưu chương trình."; sau gửi trạng thái "Đang chạy", có số `KM…`, nút "Dừng chương trình". Bước 4: không có ô ngân sách; dòng "Mua 3 Cái … tặng 1 Cái …"; "Đã tặng 0 / 10 suất". Bước 5: xem được, không có nút "Lập chương trình", "Sửa", "Dừng chương trình". Bước 6: chú thích "Khuyến mãi đang chạy tự áp khi lưu (giảm theo dòng, theo đơn, hàng tặng); tổng tạm tính chưa gồm khuyến mãi."; chi tiết đơn: dòng bánh "<tên chương trình>: giảm 10%", dòng quà nhãn "Hàng tặng" kèm tên chương trình, thành tiền 0. Bước 7: biểu mẫu chỉ có dòng bánh, kẹo, không có dòng tặng. Bước 8: "Đã dừng chương trình."; khối "Đã dừng: <lý do>"; danh sách lọc đúng trạng thái.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0, L1

### KICHBAN_KIEMTHU_200: Khuyến mãi trên điện thoại; cảnh báo thiếu suất tặng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_104
- Chức năng: CHUC_NANG_62, CHUC_NANG_63
- Loại: Giao diện
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_199; chương trình "Mua 1 kẹo tặng 600 quà" đang chạy, tồn quà ở kho xuất dưới 1.200 cái.
- Các bước: (1) Mở trình duyệt chiều rộng 375 điểm ảnh; Quản trị VCR mở danh sách "Khuyến mãi", lập chương trình giảm theo đơn. (2) Mở chi tiết một chương trình. (3) Nhân viên bán hàng lập đơn 2 cái kẹo, lưu; xem chi tiết đơn.
- Kết quả mong đợi: Bước 1: bảng chuyển thành thẻ; ô ngưỡng, phần trăm, giảm tối đa xếp dọc; không cuộn ngang. Bước 2: thẻ thông tin, nút xếp gọn, không cuộn ngang. Bước 3: khối cảnh báo "Mua 1 kẹo tặng 600 quà: thiếu 1 suất tặng do kho xuất không đủ hàng tặng."; dòng tặng 600 cái; bảng dòng chuyển thành thẻ, nhãn "Hàng tặng" hiện đủ.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L1

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

Dữ liệu chung: công ty VCR (`testIds.retailCompany`); Quản trị công ty VCR `quantri.vcr@vcomm.test`, Quản trị tập đoàn `quantri.tapdoan@vcomm.test`, người duyệt `phuc.le@vcomm.test`; tạo trong tệp kiểm thử: Kế toán `ketoan.cn@vcomm.test` (`accountant`, gán ở công ty), Nhân viên bán hàng `banhang.cn@vcomm.test` (`salesperson`, gán ở công ty), Thủ kho `thukho.cn@vcomm.test` (`warehouse_keeper`, gán ở chi nhánh Bình Dương). Kho "Kho công nợ" `CNW` tồn đầu 1.000 cái "Hàng công nợ A" giá vốn 8.000, thuế suất 10%; bảng giá `CHUNG` gồm thuế 11.000 một cái; kênh mặc định `BAN_LE`. Đối tác "Khách công nợ" (khách hàng, được nợ 30 ngày), "Nhà cung cấp công nợ" (nhà cung cấp, được nợ 15 ngày). Công ty không có chính sách duyệt đơn bán, đơn mua (gửi là xác nhận, duyệt ngay). Các kịch bản tự động chạy nối tiếp trong một tệp, kịch bản sau dùng số liệu của kịch bản trước. Đường dẫn API có tiền tố `/api/v1`.

## CHUC_NANG_65: Quỹ (CONG_VIEC_13)

### KICHBAN_KIEMTHU_201: Thêm quỹ tiền mặt, ngân hàng; thiếu thông tin ngân hàng, trùng mã bị từ chối; nhân viên bán hàng không quản lý được quỹ; sửa, ngừng dùng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_105
- Chức năng: CHUC_NANG_65
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Kế toán VCR; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; công ty chưa có quỹ.
- Các bước: (1) Kế toán thêm quỹ `TM` "Quỹ tiền mặt", tiền mặt, số dư đầu 1.000.000. (2) Thêm quỹ `NH` loại ngân hàng không có tên ngân hàng, số tài khoản. (3) Thêm quỹ mã `tm`. (4) Nhân viên bán hàng thêm quỹ; xem danh sách quỹ. (5) Kế toán thêm quỹ `NH` "Ngân hàng A" đủ thông tin ngân hàng. (6) Sửa quỹ `NH`: tên "Tài khoản Ngân hàng A", số dư đầu 500.000, ngừng dùng. (7) Xem danh sách quỹ.
- Kết quả mong đợi: Bước 1: `201`, số dư đầu và số dư hiện tại 1.000.000, `active`, `hasPostings: false`, `canManage: true`. Bước 2: `400`, lỗi ở `bankName`, `accountNo`. Bước 3: `400` tại `code` "Mã quỹ đã có trong công ty.". Bước 4: `403` cả hai. Bước 5: `201`. Bước 6: tên mới, số dư đầu 500.000, `inactive`. Bước 7: thứ tự `TM`, `NH` (đang dùng trước).
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L0

## CHUC_NANG_66: Sổ công nợ (CONG_VIEC_13)

### KICHBAN_KIEMTHU_202: Giao hàng tăng phải thu có hạn; trả hàng trừ vào phiếu gốc; đơn không có khách không sinh công nợ; nhập mua tăng phải trả; trả hàng nhà cung cấp giảm phải trả
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_106
- Chức năng: CHUC_NANG_66
- Loại: Đúng, giá trị biên, phân quyền
- Vai trò thực hiện: Nhân viên bán hàng; Thủ kho; Quản trị công ty VCR; Kế toán
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_201.
- Các bước: (1) Nhân viên bán hàng lập, gửi đơn 10 cái cho "Khách công nợ"; Thủ kho giao 4 cái. (2) Kế toán xem chi tiết công nợ phải thu của khách. (3) Thủ kho nhận hàng trả lại 1 cái từ phiếu xuất. (4) Xem lại chi tiết. (5) Đơn 1 cái không có khách (người mua "Khách lẻ"), giao 1 cái; đếm khoản công nợ. (6) Quản trị lập đơn mua 10 cái giá 8.000 chưa thuế, thuế 10% của "Nhà cung cấp công nợ", gửi (duyệt ngay); Thủ kho nhập đủ 10, rồi trả 2 cái. (7) Kế toán xem công nợ phải trả của nhà cung cấp. (8) Kế toán, Nhân viên bán hàng xem danh sách công nợ phải thu.
- Kết quả mong đợi: Bước 2: một khoản tăng `sales_issue` số phiếu xuất, 44.000, còn 44.000, hạn = hôm nay + 30 ngày. Bước 4: số dư 33.000, trả trước 0, chưa đến hạn 33.000; khoản giảm `sales_return` 11.000, còn 0, không có hạn, trừ 11.000 vào phiếu xuất. Bước 5: số khoản công nợ không đổi. Bước 7: số dư 70.400; khoản tăng `purchase_receipt` 88.000, còn 70.400, hạn = hôm nay + 15 ngày. Bước 8: Kế toán thấy một đối tác số dư 33.000, chưa đến hạn 33.000, quá hạn trên 90 ngày 0; Nhân viên bán hàng `403`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_203: Số dư đầu kỳ còn nợ quá hạn vào nhóm trên 90 ngày; trả trước đầu kỳ tự trừ nợ cũ nhất; đã trừ thì không xóa; đối tác sai phía bị từ chối
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_109
- Chức năng: CHUC_NANG_66
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Kế toán; Nhân viên bán hàng
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_202.
- Các bước: (1) Kế toán nhập số dư đầu kỳ phải thu còn nợ "HD-CU-01" ngày 2026-01-01, hạn 2026-02-01, 50.000. (2) Xem danh sách phải thu chỉ đối tác quá hạn; tìm "khong-co". (3) Nhập trả trước đầu kỳ phải trả "UT-01" 20.000 cho nhà cung cấp; xóa khoản đó. (4) Nhập phải thu cho nhà cung cấp (sai phía). (5) Nhập còn nợ không có hạn thanh toán. (6) Nhân viên bán hàng nhập số dư đầu kỳ. (7) Kế toán nhập "HD-CU-02" 1.000 hạn hôm nay, rồi xóa. (8) Chọn đối tác phía phải thu, tìm "công nợ".
- Kết quả mong đợi: Bước 1: `201`; số dư 83.000, chưa đến hạn 33.000, quá hạn trên 90 ngày 50.000; khoản `opening`, `canDelete: true`. Bước 2: có khách, quá hạn trên 90 ngày 50.000; tìm không thấy: danh sách rỗng. Bước 3: số dư phải trả 50.400, trả trước 0; khoản "UT-01" còn 0, `canDelete: false`; xóa bị từ chối "Khoản số dư đầu kỳ đã được trừ nợ hoặc đang được chọn trên phiếu thu chi, không xóa được.". Bước 4: `400` tại `partnerId` "Đối tác không phải khách hàng của công ty.". Bước 5: `400` tại `dueDate`. Bước 6: `403`. Bước 7: xóa xong số dư về 83.000. Bước 8: trả về khách công nợ.
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L0

## CHUC_NANG_67: Phiếu thu, phiếu chi (CONG_VIEC_13)

### KICHBAN_KIEMTHU_204: Thu không chọn chứng từ trừ cũ nhất trước, thừa thành trả trước; khoản nợ mới tự trừ trả trước; chọn chứng từ thì trừ đúng chứng từ; vượt số còn lại, vượt số tiền bị từ chối; quỹ có phiếu không sửa số dư đầu
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_105, TIEUCHI_NGHIEMTHU_107
- Chức năng: CHUC_NANG_65, CHUC_NANG_67
- Loại: Đúng, sai, giá trị biên
- Vai trò thực hiện: Kế toán; Nhân viên bán hàng; Thủ kho
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_203; khách đang nợ "HD-CU-01" 50.000 (quá hạn) và phiếu xuất 33.000.
- Các bước: (1) Kế toán lập phiếu thu tiền khách 100.000 quỹ `TM`, không chọn chứng từ, gửi. (2) Xem công nợ khách, số dư quỹ. (3) Giao thêm 1 cái (11.000) theo đơn mới; xem công nợ. (4) Giao thêm 2 cái (22.000); xem chứng từ còn nợ. (5) Lập phiếu thu 20.000 chọn phiếu xuất còn nợ với số trừ 16.001. (6) Lập phiếu thu 5.000 chọn số trừ 10.000. (7) Lập phiếu thu 20.000 chọn phiếu xuất số trừ 10.000, gửi. (8) Sửa số dư đầu quỹ `TM` thành 2.000.000. (9) Xem sổ quỹ hôm nay.
- Kết quả mong đợi: Bước 1: `posted`, số bắt đầu `PT`, phần trả trước 17.000; trừ "HD-CU-01" 50.000 rồi phiếu xuất 33.000. Bước 2: số dư −17.000, trả trước 17.000; quỹ 1.100.000. Bước 3: số dư −6.000, trả trước 6.000. Bước 4: trả trước 0, một chứng từ còn nợ 16.000. Bước 5: `400` tại `lines.0.amount` "Số trừ vượt số còn nợ của chứng từ.". Bước 6: `400` tại `amount` "Tổng số trừ vượt số tiền phiếu.". Bước 7: `posted`, trả trước 10.000, chứng từ đã trừ 10.000 còn 6.000; số dư khách −4.000, trả trước 10.000. Bước 8: `400` tại `openingBalance` "Quỹ đã có phiếu thu chi, không sửa được số dư đầu.". Bước 9: số dư đầu kỳ 1.000.000, cuối kỳ 1.120.000, 2 dòng.
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_205: Phiếu chi chờ duyệt, duyệt xong mới ghi sổ; vượt số dư quỹ thì bị từ chối kèm lý do; rút; hoàn tiền không vượt trả trước; không có quyền không lập được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_108
- Chức năng: CHUC_NANG_67
- Loại: Đúng, sai, phân quyền, luồng duyệt
- Vai trò thực hiện: Kế toán; Nhân viên bán hàng; Quản trị công ty VCR; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_204; Quản trị VCR tạo chính sách duyệt `finance.payment` một cấp từ 0 đồng, người duyệt `phuc.le@vcomm.test`, người thay thế Quản trị VCR. Phải trả nhà cung cấp còn 50.400.
- Các bước: (1) Nhân viên bán hàng lập phiếu chi. (2) Kế toán lập phiếu trả tiền nhà cung cấp 30.000, không chọn chứng từ, gửi; xem số dư quỹ. (3) Người duyệt duyệt; xem phiếu, công nợ, quỹ. (4) Lập phiếu chi 5.000.000, gửi; người duyệt duyệt; xem phiếu. (5) Lập phiếu chi 1.000, gửi, rút. (6) Lập phiếu hoàn tiền cho khách 10.001. (7) Lập phiếu hoàn tiền cho khách 4.000, gửi, người duyệt duyệt; xem công nợ khách. (8) Lập phiếu nhà cung cấp hoàn tiền 1 (nhà cung cấp không có trả trước). (9) Lọc danh sách loại trả tiền nhà cung cấp.
- Kết quả mong đợi: Bước 1: `403`. Bước 2: `pending`, số bắt đầu `PC`, `canWithdraw: true`; số dư quỹ chưa đổi. Bước 3: `posted`, phần trả trước 0; phải trả còn 20.400; quỹ giảm 30.000. Bước 4: `rejected`, `postError` `insufficientFundBalance` (giao diện hiện "Số dư quỹ không đủ."), `canEdit: true`. Bước 5: `withdrawn`. Bước 6: `400` tại `amount` "Số tiền hoàn vượt tiền trả trước đang còn.". Bước 7: `posted`; khách số dư 0, trả trước 6.000. Bước 8: `400` tại `amount` như bước 6. Bước 9: 3 phiếu.
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L1

## CHUC_NANG_68: Dư nợ thật cho kiểm hạn mức (CONG_VIEC_13)

### KICHBAN_KIEMTHU_206: Đơn bán vượt hạn mức theo số dư công nợ cộng phần chưa giao thì sinh ngoại lệ; khách trả tiền thì hết vượt; khoản đầu kỳ đang được chọn không xóa được; đối tác không quan hệ không xem được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_109
- Chức năng: CHUC_NANG_66, CHUC_NANG_68
- Loại: Đúng, giá trị biên, sai, phân quyền dữ liệu
- Vai trò thực hiện: Quản trị công ty VCR; Nhân viên bán hàng; Kế toán
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_205; đơn 10 cái của KICHBAN_KIEMTHU_202 còn 6 cái chưa giao (66.000); số dư công nợ khách 0 (còn nợ 6.000, trả trước 6.000).
- Các bước: (1) Quản trị đặt hạn mức công nợ của khách 80.000. (2) Nhân viên bán hàng lập, gửi đơn 3 cái (33.000). (3) Kế toán thu 60.000 của khách, không chọn chứng từ. (4) Nhân viên bán hàng lập, gửi đơn 3 cái nữa. (5) Kế toán nhập số dư đầu kỳ còn nợ "HD-CU-03" 1.000 hạn hôm nay; lập phiếu thu nháp chọn khoản đó; xóa khoản đó. (6) Tạo một đối tác không có hồ sơ, không có công nợ ở VCR; Kế toán xem chi tiết công nợ của đối tác đó.
- Kết quả mong đợi: Bước 2: ngoại lệ `credit_limit` (66.000 + 33.000 > 80.000); chưa có chính sách duyệt đơn bán nên đơn xác nhận, thêm 33.000 chưa giao. Bước 4: không có ngoại lệ (số dư −60.000 + chưa giao 99.000 = 39.000; cộng 33.000 không vượt 80.000). Bước 5: trước khi lập phiếu `canDelete: true`; xóa sau khi lập phiếu nháp trả `409`. Bước 6: `404`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c13-debts.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_209: Ghi tổn thất hàng thiếu nội bộ giảm phải thu của phiếu xuất đúng giá trị phần thiếu theo giá đơn bán; bên mua không có phải trả cho phần không nhận
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_106
- Chức năng: CHUC_NANG_66, CHUC_NANG_61
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Thủ kho VCR (bên bán); Quản trị tập đoàn (bên mua VCT)
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung của giao dịch nội bộ (CONG_VIEC_09); chạy sau KICHBAN_KIEMTHU_185 đến KICHBAN_KIEMTHU_190 trong cùng tệp: một phiếu xuất nội bộ 1 máy bị thất lạc toàn bộ, biên bản chênh lệch đã được Thủ kho VCR "Ghi tổn thất".
- Các bước: (1) Đọc biên bản ở trạng thái đã ghi tổn thất. (2) Đọc khoản công nợ nguồn `internal_write_off` của biên bản và khoản tăng phải thu của phiếu xuất gốc. (3) Đọc khoản công nợ của phiếu nhập nội bộ bên VCT.
- Kết quả mong đợi: Bước 1: đúng một biên bản. Bước 2: khoản giảm bằng toàn bộ phải thu của phiếu xuất (phần thiếu là cả phiếu), còn lại 0, gắn khoản tăng của phiếu xuất gốc; phiếu xuất hết nợ. Bước 3: không có khoản công nợ (phiếu nhập không nhận gì nên không phát sinh phải trả).
- Kiểm thử tự động: Tự động API – `apps/api/test/c9-internal-trade.test.ts`
- Lát: L1

## Kịch bản thủ công của công nợ (CONG_VIEC_13)

### KICHBAN_KIEMTHU_207: Quỹ, công nợ, phiếu thu chi trên trình duyệt (máy tính)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_110
- Chức năng: CHUC_NANG_65, CHUC_NANG_66, CHUC_NANG_67
- Loại: Đúng, sai, giao diện, phân quyền
- Vai trò thực hiện: Kế toán; Nhân viên bán hàng; người duyệt
- Điều kiện ban đầu và dữ liệu: Dữ liệu như phần dữ liệu chung (tạo trên môi trường phát triển); mini app Nền tảng, Tài chính – Kế toán, Kho, Bán hàng, backend đang chạy; đã giao hàng cho "Khách công nợ" ít nhất hai phiếu; có chính sách duyệt `finance.payment`.
- Các bước: (1) Kế toán mở mini app Tài chính – Kế toán từ trang chủ mini app. (2) Menu "Quỹ": bấm "Thêm quỹ", chọn loại "Ngân hàng", bấm "Lưu" khi chưa nhập tên ngân hàng; nhập đủ, lưu; mở quỹ, xem sổ quỹ, đổi khoảng ngày. (3) Menu "Công nợ": xem thẻ "Phải thu", "Phải trả"; gõ tìm; chọn "Chỉ đối tác quá hạn". (4) Mở khách; bấm "Nhập số dư đầu kỳ", nhập khoản còn nợ quá hạn, lưu; xóa một khoản số dư đầu kỳ chưa trừ. (5) Bấm "Lập phiếu thu": xem loại, khách chọn sẵn, bảng chứng từ còn nợ; nhập số tiền, bấm "Chia lại từ cũ nhất"; nhập số trừ vượt số còn nợ, lưu. (6) Sửa số trừ đúng, lưu, bấm "Gửi". (7) Lập phiếu "Trả tiền nhà cung cấp" vượt số dư quỹ, gửi; người duyệt duyệt ở Hộp duyệt; mở lại phiếu. (8) Bấm "Sửa", giảm số tiền, lưu, gửi lại; người duyệt duyệt. (9) Nhân viên bán hàng mở `/finance`.
- Kết quả mong đợi: Bước 1: menu Công nợ, Phiếu thu chi, Quỹ; mở trang Công nợ. Bước 2: lỗi "Vui lòng nhập thông tin này." dưới ô tên ngân hàng; "Đã lưu quỹ."; sổ quỹ có số dư đầu kỳ, cuối kỳ, số phiếu liên kết sang phiếu. Bước 3: cột số dư, trả trước, các nhóm tuổi nợ, dòng "Tổng cộng"; số quá hạn tô màu lỗi; lọc đúng. Bước 4: "Đã lưu số dư đầu kỳ."; khoản mới hiện "quá hạn <số> ngày"; "Đã xóa số dư đầu kỳ.". Bước 5: "Trả trước đang còn"; số trừ chia từ chứng từ cũ nhất; dòng "Tổng trừ … · Trả trước …"; lỗi "Số trừ vượt số còn nợ của chứng từ." dưới bảng. Bước 6: "Đã lưu phiếu."; "Đã ghi sổ."; số `PT…`, bảng "Chứng từ đã trừ". Bước 7: sau duyệt phiếu "Bị từ chối", khối "Duyệt xong nhưng không ghi sổ được: Số dư quỹ không đủ. Sửa phiếu rồi gửi lại.". Bước 8: "Đã gửi duyệt."; sau duyệt "Đã ghi sổ", số `PC…` giữ nguyên. Bước 9: "Bạn không có quyền xem trang này".
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0, L1

### KICHBAN_KIEMTHU_208: Quỹ, công nợ, phiếu thu chi trên điện thoại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_110
- Chức năng: CHUC_NANG_65, CHUC_NANG_66, CHUC_NANG_67
- Loại: Giao diện
- Vai trò thực hiện: Kế toán
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_207 sau bước 8.
- Các bước: (1) Mở trình duyệt chiều rộng 375 điểm ảnh; mở "Công nợ", đổi thẻ, mở một khách. (2) Mở "Phiếu thu chi", bấm "Lập phiếu", chọn khách có nhiều chứng từ còn nợ, nhập số trừ. (3) Mở chi tiết một phiếu bị từ chối do không ghi sổ được. (4) Mở "Quỹ", thêm quỹ ngân hàng; mở chi tiết quỹ xem sổ quỹ.
- Kết quả mong đợi: Bước 1: bảng chuyển thành thẻ, nhãn cột hiện đủ; thẻ phía, lọc xuống dòng; không cuộn ngang. Bước 2: ô biểu mẫu xếp dọc; mỗi chứng từ một thẻ có ô số trừ nhập được; nút "Chia lại từ cũ nhất" bấm được. Bước 3: khối lý do hiện đủ, nút xếp gọn. Bước 4: ô ngân hàng xếp dọc; sổ quỹ thành thẻ; không cuộn ngang.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0, L1

## MODULE_06 Tài chính – Kế toán (phần 2: Kế toán tổng hợp, CONG_VIEC_14)

Dữ liệu chung: công ty VCR (`testIds.retailCompany`) chế độ Thông tư 99/2025, tiền tệ đồng Việt Nam; Quản trị công ty VCR `quantri.vcr@vcomm.test`, Quản trị tập đoàn `quantri.tapdoan@vcomm.test`, người duyệt `phuc.le@vcomm.test`; tạo trong tệp kiểm thử: Kế toán trưởng `ketoantruong.kt@vcomm.test` (`chief_accountant`, gán ở công ty), Nhân viên bán hàng `banhang.kt@vcomm.test` (`salesperson`, gán ở công ty), Thủ kho `thukho.kt@vcomm.test` (`warehouse_keeper`, gán ở chi nhánh Bình Dương). Kho "Kho kế toán" `KTW` có phiếu nhập tồn đầu kỳ 1.000 cái "Hàng công nợ A" giá vốn 8.000 (ghi sổ trước khi khởi tạo kế toán), thuế suất 10%; bảng giá `CHUNG` gồm thuế 11.000 một cái; kênh `BAN_LE`. Đối tác "Khách công nợ" (khách hàng, được nợ 30 ngày), "Nhà cung cấp công nợ" (nhà cung cấp, được nợ 15 ngày). Công ty không có chính sách duyệt đơn bán, đơn mua. Các kịch bản tự động chạy nối tiếp trong một tệp, kịch bản sau dùng số liệu của kịch bản trước. Đường dẫn API có tiền tố `/api/v1`. Bút toán ghi dạng "số hiệu tài khoản Nợ / Có".

## CHUC_NANG_69, CHUC_NANG_70: Khởi tạo, tài khoản, định khoản (CONG_VIEC_14)

### KICHBAN_KIEMTHU_210: Khởi tạo theo Thông tư 99/2025 nạp tài khoản, tạo bút toán cho chứng từ đã ghi sổ; tài khoản chi tiết đúng quy tắc số hiệu, nhận định khoản của tài khoản cha; đổi chế độ khi có bút toán bị từ chối; không có quyền không khởi tạo được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_111
- Chức năng: CHUC_NANG_69, CHUC_NANG_70
- Loại: Đúng, sai, phân quyền
- Vai trò thực hiện: Kế toán trưởng; Nhân viên bán hàng; Quản trị tập đoàn
- Điều kiện ban đầu và dữ liệu: Dữ liệu chung; công ty chưa khởi tạo kế toán.
- Các bước: (1) Kế toán trưởng xem trạng thái khởi tạo. (2) Nhân viên bán hàng khởi tạo. (3) Kế toán trưởng khởi tạo; xem danh sách tài khoản. (4) Đọc bút toán của phiếu nhập tồn đầu kỳ. (5) Quản trị tập đoàn đổi chế độ kế toán của VCR sang Thông tư 133. (6) Kế toán trưởng khởi tạo lần nữa. (7) Thêm tài khoản chi tiết dưới 131 số hiệu `1411`; số hiệu `131`. (8) Thêm `1311` "Phải thu khách hàng trong nước"; xem định khoản. (9) Ngừng dùng tài khoản 632. (10) Đổi tên `1311`, giữ đang dùng.
- Kết quả mong đợi: Bước 1: `initialized: false`, `canSetup: true`. Bước 2: `403`. Bước 3: `201`, `initialized: true`, `regime` `TT99_2025`, `lockedThrough: null`; 184 tài khoản. Bước 4: 156 Nợ 8.000.000 / 3388 Có 8.000.000. Bước 5: lỗi tại `accountingRegime` "Công ty đã có bút toán, không đổi được chế độ kế toán.". Bước 6: `409`. Bước 7: `400` tại `code` cả hai. Bước 8: `201`; 131 `postable: false`; vai trò `receivable` dùng 1311. Bước 9: `400` tại `status`. Bước 10: `200`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L0

## CHUC_NANG_71: Bút toán tự sinh (CONG_VIEC_14)

### KICHBAN_KIEMTHU_211: Xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, xuất làm quà tặng, phiếu thu sinh bút toán cân đúng tài khoản; đổi định khoản áp dụng cho chứng từ sau
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_112
- Chức năng: CHUC_NANG_70, CHUC_NANG_71
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng; Thủ kho; Quản trị công ty VCR; Kế toán trưởng
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_210 (phải thu dùng 1311).
- Các bước: (1) Nhân viên bán hàng lập, gửi đơn 10 cái cho "Khách công nợ"; Thủ kho giao 4 cái; đọc bút toán và đối tác của dòng phải thu. (2) Thủ kho nhận hàng trả lại 1 cái. (3) Quản trị lập đơn mua 10 cái giá 8.000 chưa thuế, thuế 10%; Thủ kho nhập đủ 10. (4) Thủ kho trả nhà cung cấp 2 cái. (5) Quản trị lập, gửi phiếu xuất khác lý do quà tặng 1 cái. (6) Kế toán trưởng thêm quỹ tiền mặt `TM`, lập, gửi phiếu thu tiền khách 20.000. (7) Thêm tài khoản chi tiết 5111 dưới 511; Thủ kho giao thêm 1 cái của đơn bước 1. (8) Đọc lại bút toán của phiếu xuất bước 1.
- Kết quả mong đợi: Bước 1: 1311 Nợ 44.000; 511 Có 40.000; 33311 Có 4.000; 632 Nợ 32.000; 156 Có 32.000; dòng 1311 gắn "Khách công nợ". Bước 2: 521 Nợ 10.000; 33311 Nợ 1.000; 1311 Có 11.000; 156 Nợ 8.000; 632 Có 8.000. Bước 3: 156 Nợ 80.000; 1331 Nợ 8.000; 331 Có 88.000. Bước 4: 331 Nợ 17.600; 156 Có 16.000; 1331 Có 1.600. Bước 5: 6418 Nợ 8.000 / 156 Có 8.000. Bước 6: phiếu `posted`; 111 Nợ 20.000 / 1311 Có 20.000. Bước 7: dòng doanh thu 5111 Có 10.000. Bước 8: dòng doanh thu vẫn 511 Có 40.000.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L0

### KICHBAN_KIEMTHU_217: Dòng đơn có tiền lẻ giao nhiều lần: công nợ và bút toán mỗi lần làm tròn đến đồng theo lũy kế, tổng các lần bằng tiền dòng làm tròn, phải thu khớp sổ cái
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_112
- Chức năng: CHUC_NANG_71, CHUC_NANG_66
- Loại: Giá trị biên
- Vai trò thực hiện: Nhân viên bán hàng; Thủ kho
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_214; THAY_DOI_10 (công nợ làm tròn theo đơn vị tiền tệ).
- Các bước: (1) Nhân viên bán hàng lập, gửi đơn 3 cái cho "Khách công nợ", chiết khấu 0,25% (tổng dòng 32.917,5). (2) Thủ kho giao 3 lần, mỗi lần 1 cái. (3) Đọc khoản công nợ và dòng phải thu của bút toán từng phiếu xuất.
- Kết quả mong đợi: Bước 3: công nợ ba phiếu lần lượt 10.973, 10.972, 10.973 (tổng 32.918 bằng tổng dòng làm tròn); dòng 1311 Nợ của mỗi bút toán bằng đúng khoản công nợ của phiếu đó.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L1

## CHUC_NANG_72: Phiếu kế toán (CONG_VIEC_14)

### KICHBAN_KIEMTHU_212: Lệch Nợ Có, dòng ghi cả hai bên, số lẻ bị từ chối; chưa có chính sách thì ghi sổ ngay, cấp số; có chính sách thì chờ duyệt; đã ghi sổ không sửa; không có quyền không lập được
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_113
- Chức năng: CHUC_NANG_72
- Loại: Đúng, sai, giá trị biên, phân quyền, luồng duyệt
- Vai trò thực hiện: Kế toán trưởng; Nhân viên bán hàng; Quản trị công ty VCR; người duyệt `phuc.le@vcomm.test`
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_211; chưa có chính sách duyệt `accounting.journal`.
- Các bước: (1) Kế toán trưởng lập phiếu ngày 2026-10-01: 111 Nợ 100 / 41111 Có 90. (2) Lập phiếu dòng 111 Nợ 100, Có 100 và dòng 41111 Nợ 0, Có 0. (3) Lập phiếu 111 Nợ 100,5 / 41111 Có 100,5. (4) Nhân viên bán hàng lập phiếu. (5) Kế toán trưởng lập, gửi phiếu "Số dư đầu kỳ" ngày 2026-10-01: 111 Nợ 5.000.000 / 41111 Có 5.000.000. (6) Sửa phiếu bước 5. (7) Quản trị tạo chính sách duyệt `accounting.journal` một cấp từ 0 đồng, người duyệt `phuc.le@vcomm.test`; Kế toán trưởng lập, gửi phiếu ngày 2026-10-20: 6428 Nợ 100.000 / 111 Có 100.000. (8) Người duyệt duyệt; xem phiếu. (9) Lập, gửi phiếu ngày 2026-10-25: 111 Nợ 300.000 / 711 Có 300.000; người duyệt duyệt. (10) Lọc danh sách nguồn phiếu kế toán, trạng thái đã ghi sổ.
- Kết quả mong đợi: Bước 1: `400` tại `lines` "Tổng Nợ phải bằng tổng Có.". Bước 2: `400` tại `lines.0.debit`, `lines.1.debit`. Bước 3: `400` tại `lines.0.debit`, `lines.1.debit` (đồng Việt Nam không có số lẻ). Bước 4: `403`. Bước 5: `posted`, số bắt đầu `PKT`, tổng 5.000.000, `canEdit: false`. Bước 6: `409`. Bước 7: `pending`, `canWithdraw: true`. Bước 8: `posted`. Bước 10: 3 phiếu.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L1

## CHUC_NANG_73: Khóa sổ, sổ sách (CONG_VIEC_14)

### KICHBAN_KIEMTHU_213: Khóa tháng 10 kết chuyển chi phí, thu nhập sang 911, lãi sang 4212; chứng từ ngày trong kỳ khóa bị từ chối; tháng chưa kết thúc không khóa; mở lại xóa kết chuyển
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_114
- Chức năng: CHUC_NANG_71, CHUC_NANG_73
- Loại: Đúng, sai, giá trị biên, phân quyền
- Vai trò thực hiện: Kế toán trưởng; Nhân viên bán hàng; Quản trị công ty VCR
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_212; tháng 10/2026 đã kết thúc; bút toán tháng 10: phiếu số dư đầu kỳ, chi phí 6428 100.000, thu nhập 711 300.000; các chứng từ khác ngày hôm nay (tháng 11).
- Các bước: (1) Kế toán trưởng xem kỳ. (2) Nhân viên bán hàng khóa tháng 2026-10. (3) Kế toán trưởng khóa tháng 2026-10; xem bút toán kết chuyển. (4) Lập phiếu kế toán ngày 2026-10-31. (5) Quản trị lập, gửi phiếu nhập khác ngày 2026-10-15. (6) Khóa tháng 2026-11. (7) Mở lại; xem bút toán kết chuyển. (8) Khóa lại tháng 2026-10.
- Kết quả mong đợi: Bước 1: `lockedThrough: null`, `nextMonth` `2026-10`, `canClose: true`, `canReopen: false`. Bước 2: `403`. Bước 3: `201`, `lockedThrough` `2026-10-31`, `nextMonth` `2026-11`, `canClose: false`, `canReopen: true`; bút toán kết chuyển: 911 Nợ 100.000 / 6428 Có 100.000; 711 Nợ 300.000 / 911 Có 300.000; 911 Nợ 200.000 / 4212 Có 200.000. Bước 4: "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.". Bước 5: `409`. Bước 6: `409` (tháng chưa kết thúc). Bước 7: `lockedThrough: null`, `nextMonth` `2026-10`; không còn bút toán kết chuyển. Bước 8: `lockedThrough` `2026-10-31`.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L1

### KICHBAN_KIEMTHU_214: Bảng cân đối số phát sinh cân ở mọi cột, cộng dồn lên tài khoản cha; sổ cái tiền mặt đúng số dư lũy kế, tài khoản đối ứng
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_115
- Chức năng: CHUC_NANG_73
- Loại: Đúng, giá trị biên
- Vai trò thực hiện: Kế toán trưởng
- Điều kiện ban đầu và dữ liệu: Sau KICHBAN_KIEMTHU_213 (tháng 10 đã khóa).
- Các bước: (1) Xem bảng cân đối số phát sinh từ 2026-11-01 đến hôm nay. (2) Xem sổ cái tài khoản 111 từ 2026-10-01 đến hôm nay.
- Kết quả mong đợi: Bước 1: tổng dư đầu Nợ bằng dư đầu Có, phát sinh Nợ bằng phát sinh Có, dư cuối Nợ bằng dư cuối Có; 111 dư đầu Nợ 5.200.000; 421 (cấp 0) và 4212 (cấp 1) dư đầu Có 200.000; 131 phát sinh Nợ 55.000 (cộng từ 1311). Bước 2: số dư đầu 0; phát sinh Nợ 5.320.000, Có 100.000; số dư cuối 5.220.000; bốn dòng với tài khoản đối ứng và số dư: 41111 5.000.000; 6428 4.900.000; 711 5.200.000; 1311 5.220.000.
- Kiểm thử tự động: Tự động API – `apps/api/test/c14-ledger.test.ts`
- Lát: L1

## Kịch bản thủ công của kế toán tổng hợp (CONG_VIEC_14)

### KICHBAN_KIEMTHU_215: Hệ thống tài khoản, bút toán, sổ sách trên trình duyệt (máy tính)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_116
- Chức năng: CHUC_NANG_69 đến CHUC_NANG_73
- Loại: Đúng, sai, giao diện, phân quyền
- Vai trò thực hiện: Kế toán trưởng; Kế toán; Nhân viên bán hàng; người duyệt
- Điều kiện ban đầu và dữ liệu: Dữ liệu như phần dữ liệu chung (tạo trên môi trường phát triển); công ty chưa khởi tạo kế toán, đã có phiếu kho, phiếu thu chi ghi sổ trong tháng trước; mini app Nền tảng, Tài chính – Kế toán, Kho, backend đang chạy; có chính sách duyệt `accounting.journal`.
- Các bước: (1) Kế toán trưởng mở mini app Tài chính – Kế toán, menu "Hệ thống tài khoản". (2) Bấm "Khởi tạo kế toán". (3) Thẻ "Tài khoản": bấm "Thêm chi tiết" trên 131, nhập số hiệu `141`, lưu; sửa thành `1311`, lưu. (4) Thẻ "Định khoản mặc định": đổi tài khoản của "Chi phí hàng xuất làm quà tặng". (5) Menu "Bút toán": lọc nguồn "Phiếu kho"; mở một bút toán, bấm "Mở chứng từ gốc". (6) Bấm "Lập phiếu kế toán": nhập hai dòng lệch, xem "Chênh lệch", lưu; sửa cho cân, lưu, bấm "Gửi". (7) Người duyệt duyệt ở Hộp duyệt; mở lại phiếu. (8) Menu "Sổ sách": thẻ "Bảng cân đối số phát sinh" tháng trước; thẻ "Sổ cái" chọn 111, bấm một số bút toán. (9) Thẻ "Khóa sổ": bấm "Khóa sổ tháng …", xác nhận; lập phiếu kế toán ngày trong tháng vừa khóa. (10) Bấm "Mở lại tháng …", xác nhận. (11) Kế toán mở "Hệ thống tài khoản", "Sổ sách"; Nhân viên bán hàng mở `/finance`.
- Kết quả mong đợi: Bước 1: "Công ty chưa khởi tạo kế toán. Chế độ kế toán của công ty: Thông tư 99/2025/TT-BTC.", nút "Khởi tạo kế toán". Bước 2: "Đã khởi tạo kế toán."; dòng chế độ; cây tài khoản thụt lề theo cấp. Bước 3: lỗi số hiệu dưới ô; "Đã lưu tài khoản."; 131 đổi sang "Tổng hợp". Bước 4: "Đã đổi định khoản.". Bước 5: bút toán của phiếu kho đã có; mở đúng phiếu kho. Bước 6: "Tổng Nợ … · Tổng Có …", "Chênh lệch …"; lỗi "Tổng Nợ phải bằng tổng Có."; "Đã lưu phiếu kế toán."; "Đã gửi duyệt.". Bước 7: "Đã ghi sổ", số `PKT…`. Bước 8: dòng "Tổng cộng" hai bên bằng nhau; sổ cái có số dư đầu kỳ, số dư lũy kế kèm "Nợ" hoặc "Có", tài khoản đối ứng; số bút toán mở MAN_HINH_51. Bước 9: hộp xác nhận; "Đã khóa sổ."; "Đã khóa sổ đến" đổi; lỗi "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.". Bước 10: "Đã mở lại sổ.". Bước 11: Kế toán không thấy "Khởi tạo kế toán", "Thêm chi tiết", nút khóa sổ, ô chọn định khoản chỉ hiện chữ; Nhân viên bán hàng thấy "Bạn không có quyền xem trang này".
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0, L1

### KICHBAN_KIEMTHU_216: Hệ thống tài khoản, bút toán, sổ sách trên điện thoại
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_116
- Chức năng: CHUC_NANG_69 đến CHUC_NANG_73
- Loại: Giao diện
- Vai trò thực hiện: Kế toán trưởng; người duyệt
- Điều kiện ban đầu và dữ liệu: Như KICHBAN_KIEMTHU_215 sau bước 8.
- Các bước: (1) Mở trình duyệt chiều rộng 375 điểm ảnh; mở "Hệ thống tài khoản", đổi thẻ, bấm "Thêm chi tiết". (2) Mở "Bút toán", đổi lọc; bấm "Lập phiếu kế toán", thêm dòng, nhập số. (3) Người duyệt từ chối một phiếu kế toán; mở chi tiết phiếu đó. (4) Mở "Sổ sách": bảng cân đối, sổ cái, thẻ "Khóa sổ".
- Kết quả mong đợi: Bước 1: bảng chuyển thành thẻ, nhãn cột hiện đủ; ô biểu mẫu xếp dọc; không cuộn ngang. Bước 2: lọc xuống dòng; mỗi dòng phiếu một thẻ, ô Nợ, Có nhập được; tổng, chênh lệch hiện đủ. Bước 3: nhãn "Bị từ chối", nút "Sửa", "Gửi" xếp gọn. Bước 4: bảng cân đối, sổ cái thành thẻ; nút khóa sổ, hộp xác nhận vừa màn hình; không cuộn ngang.
- Kiểm thử tự động: Thủ công – kiểm tra trên trình duyệt
- Lát: L0, L1
