# 21. KỊCH BẢN KIỂM THỬ

- Mô tả: Kịch bản kiểm thử cho từng tiêu chí nghiệm thu của MODULE_01 Nền tảng: đúng, sai, giá trị biên, từng vai trò.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Chờ phê duyệt

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
