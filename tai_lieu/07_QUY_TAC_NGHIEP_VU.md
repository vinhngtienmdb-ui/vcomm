# 07. QUY TẮC NGHIỆP VỤ

- Mô tả: Điều kiện, ràng buộc, công thức, trạng thái và ngoại lệ, có mã định danh.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm QUYTAC_NGHIEPVU_37 đến QUYTAC_NGHIEPVU_44 của MODULE_02

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

## MODULE_02 Sản phẩm và Nhà bán (phần Sản phẩm, CONG_VIEC_04)

### Ngành hàng, sản phẩm

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_37 | Ngành hàng dùng chung tập đoàn, tối đa 4 cấp; mã ngành hàng 2 đến 6 ký tự chữ in hoa, số, duy nhất, dùng làm tiền tố mã hàng. Ngành hàng có cài đặt mặc định: theo dõi lô và hạn dùng, theo dõi serial (gồm IMEI), số tháng bảo hành (0 đến 120). Không có chức năng xóa ngành hàng; chỉ ngừng dùng hoặc dùng lại. Ngành hàng đã có sản phẩm không đổi được mã, không nhận ngành hàng con. Đổi ngành hàng cha thì tính lại cấp của cả nhánh, không tạo vòng | YCAU_NGHIEPVU_22 |
| QUYTAC_NGHIEPVU_38 | Sản phẩm thuộc một công ty, một ngành hàng lá (không có ngành hàng con). Khi tạo, cách theo dõi lô, serial, bảo hành lấy theo ngành hàng; người dùng sửa được trên sản phẩm. Lô và serial không bật cùng lúc. Thuế suất giá trị gia tăng: 0%, 5%, 8%, 10%, không chịu thuế, không kê khai nộp thuế. Không xóa sản phẩm, chỉ ngừng bán | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_39 | Sản phẩm có tối đa 3 thuộc tính phân loại (ví dụ Màu, Kích cỡ), mỗi thuộc tính tối đa 30 giá trị, tối đa 200 biến thể. Sản phẩm không phân loại có đúng một biến thể. Mã hàng của sản phẩm tự sinh `<mã ngành hàng>-<5 chữ số>` theo công ty và ngành hàng; biến thể `<mã sản phẩm>-<2 chữ số>`, sản phẩm một biến thể dùng luôn mã sản phẩm; sửa được; duy nhất trong công ty. Biến thể bị bỏ khỏi sản phẩm chuyển ngừng bán, không xóa | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_40 | Mỗi sản phẩm có một đơn vị cơ sở (đơn vị tồn kho) và tối đa 5 đơn vị quy đổi với hệ số so với đơn vị cơ sở (lớn hơn 0, tối đa 4 chữ số thập phân). Mã vạch gắn với biến thể và đơn vị; một biến thể nhiều mã vạch; mã vạch duy nhất trong công ty (công ty khác được dùng cùng mã vạch). Không đổi đơn vị cơ sở, hệ số khi sản phẩm đã phát sinh giao dịch (kiểm khi có MODULE_03) | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_41 | Liên kết biến thể của hai công ty khác nhau, mỗi biến thể có tối đa một liên kết với mỗi công ty khác; hệ số quy đổi đơn vị cơ sở bên kia so với bên này (mặc định 1; đọc từ phía bên kia là nghịch đảo). Người liên kết, bỏ liên kết phải có quyền quản lý sản phẩm ở cả hai công ty. Sao chép sản phẩm sang công ty khác tạo sản phẩm mới ở công ty đích và tự liên kết từng biến thể đang bán với hệ số 1; mã sản phẩm, mã hàng đã có ở công ty đích thì hệ thống sinh mã khác, mã vạch đã có thì bỏ | YCAU_NGHIEPVU_24 |

### Giá bán

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_42 | Bảng giá thuộc một công ty, gắn tùy chọn một kênh bán và một nhóm khách hàng, một tiền tệ, đánh dấu giá gồm hay chưa gồm thuế giá trị gia tăng; kênh, nhóm khách hàng, tiền tệ không đổi sau khi tạo. Không có hai bảng giá đang dùng trùng công ty, kênh, nhóm khách hàng, tiền tệ. Chọn bảng giá khi bán theo thứ tự: trùng cả kênh và nhóm khách; chỉ trùng nhóm khách; chỉ trùng kênh; bảng giá chung (không kênh, không nhóm). Bảng giá ưu tiên hơn chưa có giá của mặt hàng thì xét bảng kế tiếp | YCAU_NGHIEPVU_25 |
| QUYTAC_NGHIEPVU_43 | Giá đặt theo biến thể và đơn vị tính, kèm ngày hiệu lực; giá hiện hành tại một ngày là giá có ngày hiệu lực gần nhất không sau ngày đó (cùng ngày thì lấy giá ghi sau). Đơn vị không có giá riêng thì lấy giá đơn vị cơ sở nhân hệ số. Lịch sử giá không sửa, không xóa | YCAU_NGHIEPVU_25 |
| QUYTAC_NGHIEPVU_44 | Giá chỉ thay đổi qua phiếu điều chỉnh giá: Nháp → Chờ duyệt → Đã duyệt (ghi giá vào lịch sử) hoặc Bị từ chối; Chờ duyệt → Đã rút. Chỉ người lập sửa, xóa, gửi khi Nháp; rút khi cấp 1 chưa quyết định. Ngày hiệu lực không trước ngày gửi; duyệt xong sau ngày hiệu lực thì giá có hiệu lực từ ngày duyệt. Phiếu đi qua chính sách duyệt của loại chứng từ "Phiếu điều chỉnh giá" (`catalog.price_change`) với giá trị duyệt 0; công ty chưa có chính sách duyệt hiệu lực cho loại chứng từ này thì ghi giá ngay khi gửi. Số phiếu cấp từ dãy số chứng từ khi gửi; công ty chưa cài dãy số thì tạo dãy tiền tố `DCG`, đặt lại theo năm, 6 chữ số | YCAU_NGHIEPVU_25 |

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
