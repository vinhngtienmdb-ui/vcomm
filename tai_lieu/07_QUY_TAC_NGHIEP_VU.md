# 07. QUY TẮC NGHIỆP VỤ

- Mô tả: Điều kiện, ràng buộc, công thức, trạng thái và ngoại lệ, có mã định danh.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09)

## MODULE_01 Nền tảng

### Tổ chức

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_01 | Chỉ quản trị tập đoàn được tạo công ty và tạo vai trò dùng chung toàn tập đoàn | YCAU_NGHIEPVU_01, YCAU_NGHIEPVU_08 |
| QUYTAC_NGHIEPVU_02 | Mã công ty và mã số thuế duy nhất trong toàn tập đoàn; mã chi nhánh, mã phòng ban duy nhất trong một công ty | YCAU_NGHIEPVU_01, YCAU_NGHIEPVU_02, YCAU_NGHIEPVU_03 |
| QUYTAC_NGHIEPVU_03 | Không xóa công ty, chi nhánh, phòng ban; chỉ chuyển sang ngừng hoạt động. Không ngừng hoạt động công ty còn chi nhánh đang hoạt động | YCAU_NGHIEPVU_01, YCAU_NGHIEPVU_02, YCAU_NGHIEPVU_03 |
| QUYTAC_NGHIEPVU_04 | Cây công ty và cây phòng ban không được tạo vòng | YCAU_NGHIEPVU_01, YCAU_NGHIEPVU_03 |

### Tài khoản và đăng nhập

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_05 | Tài khoản phải có email hoặc số điện thoại; tên đăng nhập là định danh thêm, không bắt buộc (THAY_DOI_07). Email, số điện thoại, tên đăng nhập duy nhất toàn hệ thống | YCAU_NGHIEPVU_04, YCAU_NGHIEPVU_05 |
| QUYTAC_NGHIEPVU_06 | Đường dẫn kích hoạt dùng một lần, hết hạn sau 72 giờ; quản trị gửi lại được | YCAU_NGHIEPVU_04 |
| QUYTAC_NGHIEPVU_07 | Mật khẩu tối thiểu 10 ký tự. Sai 5 lần liên tiếp thì khóa đăng nhập 15 phút | YCAU_NGHIEPVU_05 |
| QUYTAC_NGHIEPVU_08 | Đăng nhập Google, Microsoft chỉ được khi email trả về đã gắn với một tài khoản đang hoạt động. Đăng nhập Zalo chỉ được khi tài khoản Zalo đã được nhân viên liên kết từ hồ sơ cá nhân sau khi kích hoạt. Không tự tạo tài khoản bằng Google, Microsoft, Zalo | YCAU_NGHIEPVU_05 |
| QUYTAC_NGHIEPVU_09 | Nhân viên có ít nhất một quyền nhạy cảm còn hiệu lực thì bắt buộc xác thực hai lớp; hệ thống tự bật khi gán vai trò có quyền đó | YCAU_NGHIEPVU_06 |
| QUYTAC_NGHIEPVU_10 | Phiên làm việc trên web hết hạn sau 30 ngày không dùng; trên ứng dụng kho, ứng dụng kinh doanh sau 90 ngày | YCAU_NGHIEPVU_05 |
| QUYTAC_NGHIEPVU_11 | Không có chức năng quản trị đăng nhập thay hoặc xem hệ thống dưới quyền nhân viên khác | YCAU_NGHIEPVU_08 |

### Phân quyền

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_12 | Một thao tác trên dữ liệu của công ty C, chi nhánh B được phép khi nhân viên có quyền đó qua một lần gán vai trò còn hiệu lực với phạm vi: tập đoàn; hoặc công ty C; hoặc chi nhánh B | YCAU_NGHIEPVU_07, YCAU_NGHIEPVU_08 |
| QUYTAC_NGHIEPVU_13 | Vai trò được gán riêng cho từng công ty; quyền ở công ty này không có hiệu lực ở công ty khác, trừ gán phạm vi tập đoàn | YCAU_NGHIEPVU_07 |
| QUYTAC_NGHIEPVU_14 | Quản trị công ty chỉ gán được vai trò trong phạm vi công ty mình, và không gán được quyền mình không có | YCAU_NGHIEPVU_08 |
| QUYTAC_NGHIEPVU_15 | Lần gán vai trò hết hiệu lực từ ngày sau ngày kết thúc | YCAU_NGHIEPVU_08 |
| QUYTAC_NGHIEPVU_16 | Mini app chỉ hiện trên trang chủ khi nhân viên có quyền `<app>.access` trong công ty đang chọn | YCAU_NGHIEPVU_09 |

### Duyệt chứng từ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_17 | Mỗi công ty và loại chứng từ có tối đa một chính sách duyệt có hiệu lực tại một ngày | YCAU_NGHIEPVU_10 |
| QUYTAC_NGHIEPVU_18 | Chứng từ phải qua lần lượt mọi cấp có ngưỡng nhỏ hơn hoặc bằng giá trị chứng từ, từ cấp thấp đến cấp cao | YCAU_NGHIEPVU_10 |
| QUYTAC_NGHIEPVU_19 | Chứng từ bằng ngoại tệ quy đổi sang tiền tệ của chính sách theo tỷ giá hạch toán ngày lập chứng từ để so ngưỡng. Không có tỷ giá ngày đó thì không gửi duyệt được | YCAU_NGHIEPVU_10, YCAU_NGHIEPVU_15 |
| QUYTAC_NGHIEPVU_20 | Người lập không được duyệt chứng từ của chính mình. Khi người duyệt của một cấp là người lập, cấp đó chuyển cho người duyệt thay thế đã cấu hình | YCAU_NGHIEPVU_10, YCAU_NGHIEPVU_11 |
| QUYTAC_NGHIEPVU_21 | Mỗi cấp duyệt có thời hạn xử lý (giờ) cấu hình được. Quá thời hạn thì nhắc người duyệt; quá thêm một thời hạn nữa thì chuyển cho người duyệt thay thế | YCAU_NGHIEPVU_11 |
| QUYTAC_NGHIEPVU_22 | Một cấp từ chối thì cả yêu cầu bị từ chối. Người lập sửa và gửi lại thành yêu cầu mới | YCAU_NGHIEPVU_10 |
| QUYTAC_NGHIEPVU_23 | Người lập được rút lại yêu cầu khi cấp 1 chưa quyết định | YCAU_NGHIEPVU_10 |
| QUYTAC_NGHIEPVU_24 | Mỗi chứng từ chỉ có một yêu cầu duyệt đang chờ tại một thời điểm | YCAU_NGHIEPVU_10 |
| QUYTAC_NGHIEPVU_25 | Duyệt xong hoặc bị từ chối thì báo cho mini app sở hữu chứng từ; Nền tảng không sửa chứng từ | YCAU_NGHIEPVU_10 |

### Nghỉ việc

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_26 | Vô hiệu hóa tài khoản thì khóa đăng nhập và thu hồi mọi phiên ngay | YCAU_NGHIEPVU_13 |
| QUYTAC_NGHIEPVU_27 | Không vô hiệu hóa được khi nhân viên còn chứng từ chờ mình duyệt hoặc đang là trưởng phòng, cho đến khi quản trị chọn người nhận bàn giao | YCAU_NGHIEPVU_13 |

### Đánh số, tỷ giá, nhật ký

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_28 | Số chứng từ dạng `<tiền tố>-<mã công ty>-<kỳ>-<số thứ tự>`; đặt lại theo năm, tháng hoặc không bao giờ; không trùng, không nhảy số khi lỗi | YCAU_NGHIEPVU_14 |
| QUYTAC_NGHIEPVU_29 | Mỗi ngày, cặp tiền tệ, loại, nguồn chỉ có một tỷ giá; tỷ giá lớn hơn 0 | YCAU_NGHIEPVU_15 |
| QUYTAC_NGHIEPVU_30 | Nhật ký thao tác chỉ thêm, không sửa, không xóa; giữ tối thiểu 10 năm | YCAU_NGHIEPVU_16 |

### Tích hợp và thông báo qua Zalo (CONG_VIEC_03)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_31 | Khóa bí mật của nhà cung cấp mã hóa khi lưu; API, giao diện, nhật ký chỉ hiện 4 ký tự cuối; để trống khi lưu thì giữ giá trị cũ | YCAU_NGHIEPVU_19 |
| QUYTAC_NGHIEPVU_32 | Tin Zalo ZNS gửi qua eSMS.vn khi nhân viên có số điện thoại và mẫu tin của sự kiện đã cài đặt; gửi lỗi không chặn nghiệp vụ, ghi nhật ký gửi tin; mã OTP gửi Zalo trước, không được thì SMS | YCAU_NGHIEPVU_20, YCAU_NGHIEPVU_05 |

### Đề xuất (CONG_VIEC_03)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_33 | Mỗi mẫu đề xuất là một loại chứng từ cần duyệt của công ty; giá trị duyệt là trường tiền được chỉ định hoặc tổng cột thành tiền của bảng chi tiết; đề xuất đã gửi giữ bản chụp mẫu, sửa mẫu sau đó không đổi đề xuất đã gửi | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_34 | Trạng thái đề xuất: Nháp → Chờ duyệt → Đã duyệt hoặc Bị từ chối; Chờ duyệt → Đã rút. Chỉ sửa, xóa khi Nháp. Số đề xuất cấp từ dãy số chứng từ khi gửi | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_35 | Tệp đính kèm: tối đa 10 tệp mỗi đề xuất, mỗi tệp 10 MB; chỉ PDF, JPG, PNG, XLSX, DOCX (kiểm tra cả nội dung tệp); thêm, xóa khi Nháp; chỉ người xem được đề xuất mới tải được | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_36 | Người xem được đề xuất: người lập; người được giao duyệt hoặc đã duyệt; người có quyền quản lý mẫu đề xuất của công ty | YCAU_NGHIEPVU_21 |

## Quy tắc do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Mã | Nội dung đề xuất |
|---|---|
| QUYTAC_NGHIEPVU_03 | Vế sau: không ngừng hoạt động công ty còn chi nhánh đang hoạt động |
| QUYTAC_NGHIEPVU_08 | Đăng nhập Google, Microsoft không tự tạo tài khoản mới |
| QUYTAC_NGHIEPVU_14 | Vế sau: quản trị công ty không gán được quyền mình không có |
| QUYTAC_NGHIEPVU_21 | Mốc chuyển người thay thế = gấp đôi thời hạn xử lý |
| QUYTAC_NGHIEPVU_27 | Chặn vô hiệu hóa đến khi bàn giao xong |
| Tài liệu `08` | Thêm vai trò hệ thống "Quản lý tỷ giá" |
| Tài liệu `09` luồng 1 | Nhập Excel: dòng lỗi bị bỏ qua, các dòng đúng vẫn được tạo |

## Điểm chưa xác định

- Đã xác định theo THAY_DOI_08 (CONG_VIEC_03): nhà cung cấp gửi mã OTP là eSMS.vn (Zalo ZNS trước, không được thì SMS); dùng SMS thương hiệu, tên thương hiệu (Brandname) nhập ở Cài đặt tích hợp.
- **CHƯA XÁC ĐỊNH:** nguồn tỷ giá tự động.
