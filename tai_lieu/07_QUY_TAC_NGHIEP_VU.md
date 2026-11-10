# 07. QUY TẮC NGHIỆP VỤ

- Mô tả: Điều kiện, ràng buộc, công thức, trạng thái và ngoại lệ, có mã định danh.
- Phiên bản: 2.0
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm QUYTAC_NGHIEPVU_37 đến QUYTAC_NGHIEPVU_44 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm QUYTAC_NGHIEPVU_45 đến QUYTAC_NGHIEPVU_55 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm QUYTAC_NGHIEPVU_56 đến QUYTAC_NGHIEPVU_60 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm QUYTAC_NGHIEPVU_61 đến QUYTAC_NGHIEPVU_66 của MODULE_04, quyết định AI tự đưa ra trong phạm vi đặc tả; CONG_VIEC_08 (2026-11-10): thêm QUYTAC_NGHIEPVU_67 đến QUYTAC_NGHIEPVU_72 của MODULE_05, quyết định AI tự đưa ra trong phạm vi đặc tả; CONG_VIEC_09 (2026-11-10): thêm QUYTAC_NGHIEPVU_73 đến QUYTAC_NGHIEPVU_78 của MODULE_05 (giao dịch nội bộ), quyết định AI tự đưa ra; CONG_VIEC_12 (2026-11-10): thêm QUYTAC_NGHIEPVU_79 đến QUYTAC_NGHIEPVU_84 của MODULE_05 (khuyến mãi), quyết định AI tự đưa ra, quyết định của người dùng về hàng tặng; CONG_VIEC_13 (2026-11-10): thêm QUYTAC_NGHIEPVU_85 đến QUYTAC_NGHIEPVU_92 của MODULE_06 (công nợ), quyết định AI tự đưa ra, quyết định của người dùng về ghi tổn thất nội bộ; QUYTAC_NGHIEPVU_77 bổ sung giảm phải thu khi ghi tổn thất; QUYTAC_NGHIEPVU_69 thay bằng QUYTAC_NGHIEPVU_92 theo THAY_DOI_09

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
| QUYTAC_NGHIEPVU_44 | Giá chỉ thay đổi qua phiếu điều chỉnh giá: Nháp → Chờ duyệt → Đã duyệt (ghi giá vào lịch sử) hoặc Bị từ chối; Chờ duyệt → Đã rút. Chỉ người lập sửa, xóa, gửi khi Nháp; rút khi cấp 1 chưa quyết định. Ngày hiệu lực không trước ngày gửi; duyệt xong sau ngày hiệu lực thì giá có hiệu lực từ ngày duyệt. Phiếu đi qua chính sách duyệt của loại chứng từ "Phiếu điều chỉnh giá" (`catalog.price_change`) với giá trị duyệt 0; công ty chưa có chính sách duyệt hiệu lực cho loại chứng từ này thì ghi giá ngay khi gửi. Số phiếu cấp từ dãy số chứng từ khi gửi; công ty chưa cài dãy số thì tạo dãy tiền tố `DCG`, đặt lại theo năm, 6 chữ số. Bảng giá còn phiếu chờ duyệt thì không ngừng dùng được (quyết định ngày 2026-11-09) | YCAU_NGHIEPVU_25 |

## MODULE_03 Kho (phần web, CONG_VIEC_05)

### Kho, quyền, tồn kho

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_45 | Kho thuộc một chi nhánh của một công ty (công ty sở hữu kho), một chi nhánh nhiều kho; mã kho 1 đến 20 ký tự chữ in hoa, số, gạch ngang, gạch dưới, duy nhất trong công ty; mã vị trí 1 đến 30 ký tự (thêm dấu chấm), duy nhất trong kho. Kho có danh sách công ty chủ hàng được gửi hàng (luôn gồm công ty sở hữu kho); bỏ một công ty chủ hàng chỉ khi công ty đó không còn tồn trong kho. Kho bật tắt vị trí kệ, chỉ đổi được khi kho không còn tồn; kho có vị trí thì mọi dòng tồn có vị trí. Không xóa kho, vị trí; chỉ ngừng dùng khi không còn tồn | YCAU_NGHIEPVU_26 |
| QUYTAC_NGHIEPVU_46 | Nhân viên được gán quyền kho ở chi nhánh sở hữu kho (hoặc phạm vi công ty sở hữu kho, tập đoàn bao trùm) thao tác mọi hàng trong kho. Nhân viên công ty chủ hàng có quyền xem tồn ở phạm vi công ty chỉ xem tồn, phiếu của công ty mình tại kho đó. Phiếu kho thuộc công ty chủ hàng: đánh số, chính sách duyệt, hạch toán theo công ty chủ hàng; một phiếu chỉ chứa hàng của một công ty chủ hàng; sản phẩm trên phiếu là sản phẩm đang bán của công ty chủ hàng | YCAU_NGHIEPVU_26, YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_47 | Tồn lưu theo đơn vị cơ sở của sản phẩm, theo kho, công ty chủ hàng, biến thể, lô, vị trí. Không cho tồn âm: mọi lần ghi sổ khóa dòng tồn và kiểm đủ hàng. Hàng theo dõi lô: mỗi dòng nhập có số lô, hạn dùng (bắt buộc khi sản phẩm theo dõi lô), ngày sản xuất; lô đã có thì hạn dùng phải trùng; dòng xuất chọn lô. Hàng theo dõi serial: số lượng nguyên theo đơn vị cơ sở, số serial bằng số lượng, mỗi đơn vị một serial duy nhất trong công ty chủ hàng, serial chỉ ở một nơi tại một thời điểm; serial đã xuất được nhập lại | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_48 | Giá vốn bình quân gia quyền di động tính theo kho và công ty chủ hàng cho từng biến thể: nhập có giá thì giá vốn mới = (giá trị tồn + giá trị nhập) / (số lượng tồn + số lượng nhập), giá trị nhập = số lượng × đơn giá theo đơn vị của dòng; xuất, điều chỉnh giảm lấy giá vốn hiện hành (xuất hết thì lấy toàn bộ giá trị còn lại); điều chỉnh tăng không ghi đơn giá thì lấy giá vốn hiện hành; hàng serial lấy giá đích danh của từng serial. Tiền lưu 4 chữ số lẻ, hiển thị theo tiền tệ công ty (VND) | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_49 | Thẻ kho ghi mọi biến động: thời điểm, phiếu, lô, vị trí, số lượng tăng giảm, giá vốn, giá trị, tồn sau biến động (của biến thể tại kho cho công ty chủ hàng). Thẻ kho chỉ thêm, không sửa, không xóa (trigger cơ sở dữ liệu chặn); sai thì lập phiếu khác để điều chỉnh | YCAU_NGHIEPVU_27 |

### Phiếu kho, chuyển kho, kiểm kê

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_50 | Phiếu nhập khác, xuất khác, điều chỉnh: Nháp → Chờ duyệt → Đã ghi sổ hoặc Bị từ chối; Chờ duyệt → Đã rút. Phiếu chuyển kho: Nháp → Chờ duyệt → Đã duyệt chờ xuất (trạng thái `posted`) → Đang vận chuyển → Đã nhận; Chờ duyệt → Bị từ chối, Đã rút. Chỉ người lập sửa, xóa, gửi khi Nháp (không đổi loại phiếu, kho, công ty chủ hàng); rút khi cấp 1 chưa quyết định. Giá trị duyệt là tổng giá trị: dòng có đơn giá theo đơn giá, dòng khác theo giá vốn bình quân hiện hành. Công ty chủ hàng chưa có chính sách duyệt hiệu lực cho loại phiếu thì ghi sổ ngay khi gửi (phiếu chuyển kho sang Đã duyệt chờ xuất). Số phiếu cấp khi gửi; công ty chưa cài dãy số thì tạo dãy tiền tố `NK`, `XK`, `DCK`, `CK`, đặt lại theo năm, 6 chữ số. Khi gửi phiếu làm giảm tồn, hàng được giữ cho phiếu đến khi ghi sổ (chuyển kho: khi xuất), bị từ chối hoặc rút | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_51 | Xuất hàng theo lô: hệ thống gợi ý lô hết hạn trước, lô không có hạn dùng thì nhập trước xuất trước; chọn lô khác gợi ý phải ghi lý do; không xuất lô đã hết hạn, trừ phiếu xuất lý do "Hủy hàng hết hạn" và phiếu điều chỉnh lý do "Kiểm kê". Kiểm tra lô khi gửi phiếu, không kiểm lại khi ghi sổ sau duyệt | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_52 | Chuyển kho chỉ trong cùng công ty chủ hàng, kho đích khác kho nguồn, đang dùng, nhận hàng của công ty đó. Sau duyệt: người có quyền lập phiếu ở kho nguồn xác nhận xuất (trừ tồn, serial sang trạng thái đang vận chuyển, giữ nguyên giá vốn), người có quyền lập phiếu ở kho đích xác nhận nhận theo số thực nhận (đơn vị cơ sở) cho mọi dòng, chọn vị trí khi kho đích có vị trí, serial nhận phải có trong phiếu. Nhận khác số xuất lập biên bản chênh lệch ghi số lượng, giá trị theo giá vốn lúc xuất. Phần thiếu ghi người chịu trách nhiệm và tiền bồi thường (mặc định bằng giá trị thiếu), Tài chính – Kế toán hạch toán tổn thất từ biên bản (quyết định ngày 2026-11-10). Hàng đang vận chuyển không tính vào tồn khả dụng của kho nào; hiển thị là "đang chuyển đến" của kho đích | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_53 | Kiểm kê toàn kho hoặc từng phần (theo ngành hàng, vị trí, danh sách sản phẩm) của một công ty chủ hàng: Nháp → Đang đếm → Đã kết thúc; Nháp, Đang đếm → Đã hủy. Bắt đầu kiểm thì cấp số (dãy `KK`), chụp số tồn sổ sách và khóa các mặt hàng (theo vị trí khi dòng có vị trí) trong phạm vi: không ghi sổ phiếu khác vào chúng đến khi kết thúc hoặc hủy. Số đếm theo đơn vị cơ sở, ghi nhiều lần; hàng có thực tế mà sổ sách không có thì thêm dòng; hàng theo lô ghi số đếm theo lô đã có (lô mới nhập bằng phiếu nhập khác). Kết thúc khi mọi dòng có số đếm: chênh lệch sinh phiếu điều chỉnh (lý do kiểm kê) và gửi ngay theo luồng duyệt; dòng thiếu ghi người chịu trách nhiệm và số tiền bồi thường (mặc định bằng giá trị thiếu, sửa được). Gửi phiếu điều chỉnh không được thì kiểm kê trở lại Đang đếm | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_54 | Tồn khả dụng = tồn thực − hàng đang giữ. Giữ hàng theo kho, công ty chủ hàng, biến thể, số lượng, nguồn (phiếu kho, giữ thủ công, sau này đơn bán), hạn giữ; không giữ quá tồn khả dụng. Giữ thủ công và giữ cho đơn bán tự nhả sau số giờ cài đặt theo công ty chủ hàng (1 đến 720, mặc định 72 giờ); người có quyền gia hạn (1 đến 720 giờ), nhả tay được; giữ cho phiếu kho không có hạn, không nhả tay | YCAU_NGHIEPVU_29 |
| QUYTAC_NGHIEPVU_55 | Tồn an toàn đặt theo kho, công ty chủ hàng, biến thể: tối thiểu, tối đa (không âm, tối đa không nhỏ hơn tối thiểu). Tồn khả dụng cộng hàng đang chuyển đến dưới tối thiểu thì cảnh báo trên màn hình và thông báo lúc 7 giờ sáng hằng ngày cho người có quyền `inventory.reservation.manage` ở tập đoàn, công ty sở hữu kho hoặc chi nhánh của kho; số gợi ý bổ sung = tối đa − (tồn khả dụng + đang chuyển đến) | YCAU_NGHIEPVU_29 |

## MODULE_07 Khách hàng và Đối tác (phần tối thiểu, CONG_VIEC_06)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_56 | Đối tác thuộc một trong ba loại: tổ chức, hộ kinh doanh (bắt buộc mã số thuế 10 số hoặc 10 số kèm "-" và 3 số chi nhánh, duy nhất trong tập đoàn; mã số thuế đơn vị phụ thuộc là đối tác riêng), cá nhân (bắt buộc số Căn cước công dân 12 số, duy nhất trong tập đoàn; không nhập mã số thuế thay số Căn cước công dân). Cá nhân không cung cấp số Căn cước công dân thì không lập đối tác; bán hàng dùng người mua không lấy hóa đơn (quyết định ngày 2026-11-10). Mã đối tác tự sinh `DT` + 6 số. Chữ số kiểm tra của mã số thuế chưa kiểm | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_57 | Người có quyền quản lý đối tác ở bất kỳ công ty nào được thêm, sửa thông tin chung (gồm người liên hệ, tài khoản ngân hàng); mọi thay đổi ghi nhật ký thao tác kèm dữ liệu trước, sau. Không xóa đối tác, chỉ ngừng giao dịch, cho giao dịch lại; đối tác ngừng giao dịch không chọn được trên chứng từ mới | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_58 | Mỗi công ty con đang hoạt động là một đối tác nội bộ, đồng bộ tên, tên ngắn, mã số thuế, địa chỉ từ danh sách công ty (đối tác bên ngoài trùng mã số thuế được gắn thành đối tác nội bộ); công ty con ngừng hoạt động thì đối tác nội bộ ngừng giao dịch. Thông tin chung, trạng thái của đối tác nội bộ chỉ sửa ở màn hình công ty. Công ty không lập hồ sơ đối tác với chính mình | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_59 | Số Căn cước công dân là dữ liệu cá nhân: danh sách, chi tiết che, chỉ hiện 3 số cuối; xem đầy đủ cần quyền xem dữ liệu cá nhân đối tác, mỗi lần xem ghi nhật ký thao tác. Nhật ký thêm, sửa đối tác không chứa số đầy đủ. Sửa đối tác cá nhân để trống số Căn cước công dân thì giữ số đã lưu | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_60 | Hồ sơ đối tác của công ty: đánh dấu khách hàng, nhà cung cấp (ít nhất một), số ngày được nợ (0 đến 365), hạn mức công nợ theo tiền tệ công ty (không âm; để trống: không giới hạn), nhóm khách hàng đang dùng của công ty, nhân viên phụ trách là nhân viên đang làm ở công ty; trạng thái riêng từng công ty. Công ty khác không xem được hồ sơ của nhau | YCAU_NGHIEPVU_31 |

## MODULE_04 Mua hàng (phần 1: Mua hàng trong nước, CONG_VIEC_07)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_61 | Bảng giá mua thuộc công ty, theo nhà cung cấp (đối tác đang giao dịch có hồ sơ nhà cung cấp đang dùng ở công ty), mặt hàng, đơn vị mua; không có hai giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu có hiệu lực chồng nhau (giá ngừng dùng không tính; dùng lại thì kiểm lại). Dòng đơn mua lấy giá đang dùng có hiệu lực tại ngày đơn với số lượng tối thiểu lớn nhất không vượt số lượng đặt; sửa được | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_62 | Đề nghị mua chỉ chứa mặt hàng đang bán của công ty, kho nhận là kho đang dùng nhận hàng của công ty; gửi đi luồng duyệt (loại chứng từ `purchasing.requisition`, chưa có chính sách duyệt thì duyệt ngay). Đơn mua tạo từ dòng đề nghị đã duyệt; một dòng đề nghị đặt nhiều lần đến hết số lượng. Số đã đặt của dòng đề nghị = tổng dòng đơn mua chưa bị từ chối, chưa rút (đơn đã đóng chỉ tính phần đã nhận). Đề nghị đã duyệt đóng được; phần chưa đặt không đặt được nữa | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_63 | Đơn mua bắt buộc đi luồng duyệt (loại `purchasing.order`), trừ khi mọi dòng tạo từ đề nghị mua đã duyệt và tổng giá trị không vượt giá trị ước tính của các dòng đề nghị đó. Đơn đã duyệt sửa làm tăng tổng giá trị (so với lần duyệt gần nhất) hoặc đổi nhà cung cấp thì về chờ duyệt lại; sửa không tăng giá trị thì giữ trạng thái. Không giảm số lượng dòng dưới số đã nhận (gồm phần đang chờ kiểm tra); dòng đã có phiếu nhập không bỏ, không đổi mặt hàng, đơn vị | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_64 | Nhận hàng chỉ theo đơn mua đã duyệt chưa đóng; tổng đã nhận (đã ghi sổ phần đạt cộng đang chờ kiểm) của mỗi dòng không vượt số đặt cộng dung sai nhận vượt phần trăm cài đặt theo công ty (0 đến 100, mặc định 0). Giá nhập là đơn giá dòng đơn mua chưa gồm thuế giá trị gia tăng quy về đơn vị cơ sở. Đơn nhận đủ mọi dòng tự chuyển "Đã nhận đủ"; người có quyền đóng đơn còn thiếu kèm lý do, phần chưa nhận hủy; còn phiếu nhập nháp hoặc chờ kiểm tra thì chưa đóng được | YCAU_NGHIEPVU_33 |
| QUYTAC_NGHIEPVU_65 | Mặt hàng thuộc ngành hàng đánh dấu cần kiểm tra chất lượng: phiếu nhập mua chuyển "Chờ kiểm tra", chưa ghi sổ kho. Kiểm xong nhập kết quả từng dòng (số không đạt; hàng serial ghi serial không đạt); phần đạt ghi sổ kho, phần không đạt ghi biên bản kèm lý do trên dòng phiếu, không tính vào số đã nhận của đơn mua | YCAU_NGHIEPVU_33 |
| QUYTAC_NGHIEPVU_66 | Trả hàng nhà cung cấp lập từ phiếu nhập mua đã ghi sổ; tổng trả mỗi dòng không vượt số đã nhập (phần đạt); xuất kho theo đơn giá trên phiếu nhập gốc, cùng lô, vị trí của dòng gốc (hàng serial trả đúng serial đã nhập), giá vốn bình quân của phần còn lại tính lại. Phiếu nhập mua, phiếu trả hàng có chứng từ gốc nên không đi luồng duyệt | YCAU_NGHIEPVU_33 |

### Quyết định AI tự đưa ra trong phạm vi đặc tả (CONG_VIEC_07, 2026-11-10, chưa xác nhận)

| Vị trí | Nội dung |
|---|---|
| QUYTAC_NGHIEPVU_62, QUYTAC_NGHIEPVU_63 | Công ty chưa có chính sách duyệt loại `purchasing.requisition` hoặc `purchasing.order` thì đề nghị mua, đơn mua duyệt ngay khi gửi (như phiếu kho, phiếu điều chỉnh giá của các module trước) |
| QUYTAC_NGHIEPVU_63 | Đơn mua miễn duyệt khi mọi dòng lấy từ dòng đề nghị mua đã duyệt và tổng chưa thuế không vượt giá trị ước tính (số lượng quy về đơn vị cơ sở × đơn giá ước tính của dòng đề nghị); đơn trực tiếp luôn qua luồng duyệt |
| QUYTAC_NGHIEPVU_63 | Đơn đã duyệt sửa làm tăng tổng chưa thuế hoặc đổi nhà cung cấp thì hệ thống tự gửi duyệt lại ngay khi lưu (giữ số đơn); điều kiện miễn duyệt áp dụng như lần gửi đầu |
| Tài liệu `08` | Thủ kho gán theo chi nhánh vẫn lập đề nghị mua, xem đơn mua của công ty: quyền `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh nào của công ty cũng dùng được; quyền Mua hàng khác cần gán ở phạm vi tập đoàn hoặc công ty |
| QUYTAC_NGHIEPVU_65 | Một phiếu nhập mua có ít nhất một dòng hàng cần kiểm tra chất lượng thì cả phiếu chờ kiểm, chưa ghi sổ dòng nào |
| CHUC_NANG_52, CHUC_NANG_53 | Phiếu nháp nhập mua, trả hàng trên giao diện chỉ gửi hoặc xóa; cần sửa thì xóa rồi lập lại từ đơn mua, phiếu nhập gốc |
| QUYTAC_NGHIEPVU_66 | Trả làm tồn của mặt hàng về 0 thì xuất toàn bộ giá trị tồn còn lại; không xuất quá giá trị tồn đang có (giá trị tồn không âm) |

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_67 | Đơn bán thuộc công ty; khách là đối tác đang giao dịch có hồ sơ khách hàng đang dùng ở công ty, hoặc để trống (người mua không lấy hóa đơn, ghi tên người mua nếu có). Kênh bán là kênh đang dùng của công ty; kho xuất là kho đang dùng nhận hàng của công ty. Giá dòng tra theo bảng giá của công ty với kênh bán của đơn và nhóm khách của hồ sơ khách tại ngày đơn (QUYTAC_NGHIEPVU_42, QUYTAC_NGHIEPVU_43; dòng không có giá theo đơn vị thì quy từ giá đơn vị cơ sở); không có giá thì không lập được dòng. Giá gồm hay chưa gồm thuế theo bảng giá; thuế suất theo sản phẩm | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_68 | Chiết khấu tay theo phần trăm từng dòng (0 đến 100, 2 chữ số lẻ). Đơn có ngoại lệ phải đi luồng duyệt (loại chứng từ `sales.order`, giá trị duyệt là tổng gồm thuế; chưa có chính sách duyệt thì xác nhận ngay như các chứng từ khác): chiết khấu dòng vượt mức chiết khấu tay tối đa của công ty (mặc định 0%); giá sau chiết khấu chưa thuế quy về đơn vị cơ sở thấp hơn giá vốn bình quân hiện hành tại kho xuất (chỉ khi kho đang có tồn mặt hàng đó); vượt hạn mức công nợ. Không có ngoại lệ thì xác nhận ngay. Ngoại lệ lưu trên đơn, hiện cho người duyệt và người xem đơn; diễn giải số của ngoại lệ vượt hạn mức chỉ hiện cho người có quyền xem hạn mức công nợ (`crm.profile.manage`), của ngoại lệ dưới giá vốn chỉ hiện cho người có quyền xem giá vốn (`inventory.cost.view`) | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_69 | Thay bằng QUYTAC_NGHIEPVU_92 theo THAY_DOI_09 (CONG_VIEC_13, 2026-11-10); nội dung cũ giữ để tra cứu: Dư nợ tạm tính của khách (đến khi có MODULE_06): giá trị gồm thuế phần chưa giao của các đơn khác của khách đã xác nhận, cộng giá trị gồm thuế đã giao (phiếu xuất giao hàng đã ghi sổ) có ngày phiếu trong số ngày được nợ gần nhất của hồ sơ khách, trừ giá trị gồm thuế (theo giá trên đơn) của hàng khách trả lại (phiếu nhận hàng trả lại đã ghi sổ) thuộc các phiếu xuất đó. Dư nợ cộng tổng gồm thuế của đơn đang gửi vượt hạn mức công nợ thì là ngoại lệ. Hạn mức để trống là không giới hạn; khách để trống không kiểm. Gửi đơn khóa hồ sơ khách để hai đơn cùng khách gửi đồng thời không cùng lọt hạn mức | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_70 | Gửi đơn thì giữ hàng ngay tại kho xuất theo tổng số lượng cơ sở từng mặt hàng, nguồn `sales.order` (không đủ hàng khả dụng thì không gửi được); thời hạn giữ theo cài đặt kho của công ty (chưa cài: 72 giờ). Bị từ chối, rút, hủy, đóng thì nhả phần còn giữ; giao hàng dùng phần đang giữ trước; giao đủ thì phần giữ còn sót đánh dấu đã dùng | YCAU_NGHIEPVU_34, YCAU_NGHIEPVU_35 |
| QUYTAC_NGHIEPVU_71 | Phiếu xuất giao hàng chỉ theo đơn đã xác nhận (chưa giao đủ, chưa hủy, chưa đóng); tổng đã giao (phiếu đã ghi sổ) cộng lần này mỗi dòng không vượt số đặt; xuất theo giá vốn bình quân tại kho; giao đủ mọi dòng thì đơn chuyển "Đã giao đủ". Đơn đã có phiếu xuất giao hàng (kể cả nháp) không hủy được, chỉ đóng kèm lý do (phần chưa giao hủy); còn phiếu xuất nháp thì chưa đóng được | YCAU_NGHIEPVU_35 |
| QUYTAC_NGHIEPVU_72 | Phiếu nhận hàng trả lại lập từ phiếu xuất giao hàng đã ghi sổ; tổng trả (phiếu đã ghi sổ) mỗi dòng không vượt số đã giao trừ số đã trả; số trả theo đơn vị cơ sở (trả được một phần của dòng giao theo đơn vị quy đổi); nhập lại theo giá vốn trên phiếu xuất gốc (giá trị đã ghi sổ của dòng gốc chia số đã giao theo đơn vị cơ sở); hàng serial chỉ trả serial đã giao ở dòng gốc; lô, vị trí theo dòng gốc. Phiếu xuất giao hàng, phiếu nhận hàng trả lại có chứng từ gốc nên không đi luồng duyệt | YCAU_NGHIEPVU_35 |

### Quyết định AI tự đưa ra trong phạm vi đặc tả (CONG_VIEC_08, 2026-11-10, chưa xác nhận)

| Vị trí | Nội dung |
|---|---|
| QUYTAC_NGHIEPVU_67 | Nhóm khách dùng tra giá lấy theo hồ sơ khách lúc lập, sửa đơn và lưu trên đơn; đổi nhóm khách sau đó không đổi giá đơn đã lập |
| QUYTAC_NGHIEPVU_68 | Ngoại lệ dưới giá vốn chỉ xét khi kho xuất đang có tồn và giá vốn bình quân của mặt hàng; sai số làm tròn 0,00005 |
| QUYTAC_NGHIEPVU_69 | Dư nợ tạm tính chỉ cộng đơn khác đã xác nhận (theo quyết định của người dùng ngày 2026-11-10); hàng khách trả lại trừ khỏi dư nợ tạm tính (người dùng quyết định ngày 2026-11-10); số ngày được nợ tính lùi từ ngày hệ thống |
| QUYTAC_NGHIEPVU_70 | Giữ hàng theo tổng số lượng cơ sở từng mặt hàng của đơn, không theo lô, vị trí; thủ kho chọn lô, vị trí khi lập phiếu xuất |
| Tài liệu `08` | Thủ kho gán theo chi nhánh vẫn xem đơn bán của công ty: quyền `sales.order.view` gán ở chi nhánh nào của công ty cũng dùng được; quyền Bán hàng khác cần gán ở phạm vi tập đoàn hoặc công ty |
| CHUC_NANG_56, CHUC_NANG_57 | Phiếu nháp xuất giao hàng, nhận hàng trả lại chỉ gửi hoặc xóa; cần sửa thì xóa rồi lập lại từ đơn bán, phiếu xuất gốc (như phiếu nhập mua, CONG_VIEC_07) |

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_73 | Đơn bán là nội bộ khi khách là đối tác nội bộ (đối tác gắn công ty con, QUYTAC_NGHIEPVU_58); đơn mua là nội bộ khi nhà cung cấp là đối tác nội bộ. Đơn nội bộ: kênh bán phải là kênh mã `NOI_BO` của công ty bán; mỗi mặt hàng phải có liên kết sản phẩm với công ty bên kia (QUYTAC_NGHIEPVU_41), thiếu liên kết thì không gửi được; hai công ty phải cùng tiền tệ | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_74 | Chứng từ đối ứng sinh khi chứng từ bên khởi tạo được xác nhận (đơn bán) hoặc được duyệt (đơn mua), ở trạng thái "Chờ xác nhận nội bộ", chưa có kho, chưa có số, ngày đơn bằng ngày đơn khởi tạo; dòng thứ tự như chứng từ khởi tạo. Mặt hàng quy theo liên kết sản phẩm, số lượng theo đơn vị cơ sở bên kia (nhân hệ số liên kết). Bên kia (người có quyền quản lý đơn bán hoặc đơn mua của công ty đó) chọn kho rồi xác nhận; người xác nhận trở thành người lập đơn đối ứng ở công ty mình (rút được yêu cầu duyệt của mình): đơn mua đối ứng đi luồng duyệt đơn mua; đơn bán đối ứng đi luồng gửi đơn bán (kiểm ngoại lệ, giữ hàng, QUYTAC_NGHIEPVU_68 đến 70). Bên kia từ chối (ghi lý do), rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt thì đơn đối ứng kết thúc (đơn bán hủy, đơn mua đóng) và chứng từ khởi tạo kết thúc theo QUYTAC_NGHIEPVU_78 với lý do tương ứng | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_75 | Giá nội bộ: dòng đơn mua nội bộ khởi tạo lấy giá chưa thuế từ bảng giá kênh `NOI_BO` của công ty bán theo nhóm khách của hồ sơ công ty mua tại công ty bán, tại ngày đơn (QUYTAC_NGHIEPVU_42, 43): tra theo mặt hàng liên kết, đơn vị cơ sở của công ty bán (bảng giá gồm thuế thì trừ thuế theo thuế suất sản phẩm bên bán), quy về đơn vị dòng đơn mua theo hệ số liên kết, làm tròn 4 chữ số; thuế suất theo sản phẩm bên bán. Giá, thuế suất nhập tay bị thay; không có giá thì không lập được dòng. Đơn mua đối ứng sinh từ đơn bán lấy tiền chưa thuế của dòng đơn bán (sau chiết khấu) chia số lượng bên mua, làm tròn 4 chữ số; thuế suất theo dòng bên bán. Đơn bán đối ứng sinh từ đơn mua lấy giá chưa thuế, thuế suất theo dòng đơn mua (đơn mua đã tra bảng giá kênh Nội bộ khi lập), không tra lại bảng giá, không chiết khấu | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_76 | Đơn bán nội bộ chỉ giao khi đơn mua đối ứng đã duyệt. Phiếu xuất giao hàng nội bộ khi ghi sổ sinh phiếu nhập mua ở công ty mua, kho nhận của đơn mua, trạng thái "Chờ nhận", đơn giá theo đơn mua; lô, hạn dùng, serial theo phiếu xuất. Thủ kho bên mua nhận: số nhận mỗi dòng không vượt số xuất, hàng serial chỉ nhận serial đã xuất, chọn vị trí nếu kho dùng vị trí; mọi dòng phải có số nhận; ghi sổ số thực nhận (không qua kiểm tra chất lượng, không qua luồng duyệt), phiếu lấy số khi nhận; dòng nhận 0 bỏ khỏi phiếu. Đơn mua nội bộ không lập được phiếu nhập mua thường, không hiện trong danh sách đơn chờ nhận; chỉ nhận theo phiếu nhập sinh từ phiếu xuất. Đơn mua "Đã nhận đủ" khi mọi dòng nhận đủ, cho phép lệch làm tròn 0,0005 đơn vị cơ sở | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_77 | Nhận thiếu thì phải ghi lý do; mỗi dòng xuất thiếu sinh một biên bản chênh lệch thuộc công ty bán (một phiếu nhập, một dòng xuất có tối đa một biên bản; dòng nhận 0 thì biên bản không có dòng nhập): số thiếu theo đơn vị cơ sở bên bán, giá trị theo giá vốn trên phiếu xuất tỷ lệ với số thiếu, serial chưa nhận, lý do của bên nhận. Bên bán (người có quyền xuất giao hàng tại kho xuất) xem, xử lý một lần; giá trị chỉ hiện cho người xem được giá vốn: "Nhập lại kho" sinh và ghi sổ phiếu nhận hàng trả lại vào kho xuất theo giá vốn phiếu xuất (QUYTAC_NGHIEPVU_72); "Ghi tổn thất" chỉ đóng biên bản, ghi chú không bắt buộc (hạch toán tổn thất làm cùng MODULE_06; từ CONG_VIEC_13 ghi tổn thất giảm phải thu của công ty mua theo QUYTAC_NGHIEPVU_86) | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_78 | Một bên hủy, đóng, từ chối, rút đơn đối ứng hoặc đơn đối ứng không được duyệt thì bên kia kết thúc phần chưa giao với lý do nêu bên và thao tác (ví dụ "Bên mua từ chối: <lý do>", "Bên bán hủy đơn bán đối ứng"): đơn bán chưa có phiếu xuất thì hủy, đã có thì đóng, nhả hàng giữ; đơn mua chưa nhận đủ, chưa đóng thì đóng. Yêu cầu duyệt còn chờ của bên kia được rút. Bên bán còn phiếu xuất giao hàng nháp thì không kết thúc được. Đơn đối ứng không sửa dòng được, khi "Chờ xác nhận nội bộ" chỉ chọn kho, xác nhận hoặc từ chối; đơn mua nội bộ khởi tạo đã có đơn bán đối ứng cũng không sửa được | YCAU_NGHIEPVU_36 |

### Quyết định AI tự đưa ra (CONG_VIEC_09, 2026-11-10, chưa xác nhận)

| Vị trí | Nội dung |
|---|---|
| QUYTAC_NGHIEPVU_73 | Điều kiện nội bộ kiểm khi lưu và khi gửi đơn: đơn bán cần kênh `NOI_BO`, công ty mua có hồ sơ nhà cung cấp đang dùng cho công ty bán; đơn mua cần công ty bán có kênh `NOI_BO` đang dùng và hồ sơ khách hàng đang dùng cho công ty mua; hai bên cùng tiền tệ; mọi mặt hàng có liên kết (đọc liên kết hai chiều) |
| QUYTAC_NGHIEPVU_74 | Người xác nhận đơn đối ứng trở thành người lập đơn ở công ty mình, để rút được yêu cầu duyệt của mình; trước khi xác nhận, người lập ghi theo người lập chứng từ khởi tạo |
| QUYTAC_NGHIEPVU_74 | Đơn đối ứng bị rút khi chờ duyệt, hoặc không được duyệt, thì kết thúc luôn (đơn bán hủy, đơn mua đóng), không sửa, gửi lại được; bên khởi tạo kết thúc theo. Đơn bán đối ứng "Chờ xác nhận nội bộ" không hủy được, chỉ từ chối |
| QUYTAC_NGHIEPVU_75 | Đơn bán đối ứng lấy giá chưa thuế, thuế suất theo dòng đơn mua (đơn mua đã tra bảng giá kênh Nội bộ khi lập), không tra lại bảng giá, để bảng giá đổi trong lúc đơn mua chờ duyệt không làm hỏng việc sinh đơn; giá bảng giá ghi bằng đơn giá đó, chiết khấu 0 |
| QUYTAC_NGHIEPVU_75 | Đơn giá dòng đơn mua đối ứng làm tròn 4 chữ số; tổng có thể lệch vài đồng lẻ so với đơn bán (ghi nhận ở tài liệu `22`) |
| QUYTAC_NGHIEPVU_76 | Dòng đơn bán và dòng đơn đối ứng cùng số thứ tự dòng; phiếu nhập nội bộ ghép dòng xuất với dòng đơn mua theo số thứ tự này, đơn vị là đơn vị cơ sở bên mua, đơn giá là đơn giá dòng đơn mua quy về đơn vị cơ sở |
| QUYTAC_NGHIEPVU_76 | Phiếu nhập "Chờ nhận" mang ngày phiếu xuất, người lập phiếu xuất; khi nhận lấy ngày nhận, cấp số phiếu nhập mua của công ty mua, ghi người và thời điểm nhận. Dòng nhận 0 bỏ khỏi phiếu; nhận 0 mọi dòng thì phiếu ghi sổ không có dòng |
| QUYTAC_NGHIEPVU_76 | Đơn mua nội bộ chỉ nhận theo phiếu nhập sinh từ phiếu xuất, không lập phiếu nhập mua thường; đơn mua "Đã nhận đủ" cho phép lệch làm tròn 0,0005 đơn vị cơ sở do quy đổi theo hệ số liên kết |
| QUYTAC_NGHIEPVU_77 | Biên bản dòng nhận 0 không có dòng nhập; một phiếu nhập, một dòng xuất có tối đa một biên bản. Ghi chú xử lý không bắt buộc. "Nhập lại kho" lập và ghi sổ phiếu nhận hàng trả lại bằng tài khoản người xử lý với lý do "Hàng thiếu khi giao nội bộ: <lý do bên nhận>"; không ghi sổ được thì xóa phiếu nháp, biên bản trở lại "Chờ xử lý" |
| QUYTAC_NGHIEPVU_78 | Khi một bên kết thúc, yêu cầu duyệt còn chờ của chứng từ bên kia được rút trong cùng giao dịch, không phát sự kiện hoàn tất duyệt; việc kết thúc chỉ lan một lần sang bên kia, không lan ngược |
| QUYTAC_NGHIEPVU_78 | Đơn mua nội bộ khởi tạo đã có đơn bán đối ứng không sửa được (kể cả khi đã duyệt), để hai bên không lệch số lượng, giá |

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_79 | Chương trình thuộc công ty, có thời gian hiệu lực (từ ngày, đến ngày), kênh bán áp dụng (để trống: mọi kênh trừ kênh Nội bộ), nhóm khách áp dụng (để trống: mọi khách, kể cả người mua không lấy hóa đơn). Loại giảm theo sản phẩm: danh sách mặt hàng, mỗi mặt hàng một phần trăm giảm. Loại giảm theo đơn: ngưỡng tổng đơn gồm thuế, phần trăm giảm, mức giảm tối đa (để trống: không giới hạn). Loại mua X tặng Y: mặt hàng mua, số lượng mua (đơn vị cơ sở), mặt hàng tặng, số lượng tặng mỗi suất (đơn vị cơ sở). Mặt hàng phải là mặt hàng đang bán của công ty; kênh là kênh đang dùng của công ty, không chọn được kênh Nội bộ; nhóm khách là nhóm đang dùng. Ngân sách (tổng tiền giảm tối đa, gồm thuế) chỉ khai cho giảm theo sản phẩm, giảm theo đơn; số suất tối đa chỉ khai cho mua X tặng Y (mua X tặng Y khai ngân sách thì bị từ chối) | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_80 | Chương trình đi luồng duyệt (loại chứng từ `sales.promotion`, giá trị duyệt là ngân sách, không có ngân sách thì 0; chưa có chính sách duyệt thì chạy ngay như các chứng từ khác). Gửi lần đầu cấp số (`KM`…). Duyệt xong thì "Đang chạy"; từ chối thì "Bị từ chối". Người lập rút được khi chờ duyệt và cấp duyệt đầu chưa quyết định. Sửa khi nháp, bị từ chối, đã rút; sửa xong chương trình về nháp. Chương trình đang chạy chỉ dừng được (ghi lý do), không sửa | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_81 | Áp dụng khi lưu đơn bán (lập, sửa): chương trình đang chạy, ngày đơn trong thời gian hiệu lực, kênh và nhóm khách của đơn thỏa điều kiện, còn ngân sách, còn suất (QUYTAC_NGHIEPVU_82). Đơn bán nội bộ (khách là đối tác nội bộ) và đơn kênh Nội bộ không áp khuyến mãi. Thứ tự tính: giảm theo sản phẩm, rồi giảm theo đơn, rồi mua X tặng Y. Mỗi dòng hàng chỉ một khuyến mãi theo sản phẩm, chọn phần trăm cao nhất (bằng nhau thì chương trình lập trước); đơn giá = giá bảng giá × (1 − phần trăm khuyến mãi) × (1 − chiết khấu tay). Tổng đơn gồm thuế sau giảm theo sản phẩm đạt ngưỡng thì áp tối đa một khuyến mãi theo đơn: tiền giảm = tổng × phần trăm, không quá mức giảm tối đa; chọn chương trình có tiền giảm lớn nhất. Tiền giảm theo đơn chia cho các dòng có thành tiền lớn hơn 0 theo tỷ lệ thành tiền gồm thuế, làm tròn 4 chữ số, phần dư dồn vào dòng cuối có thành tiền; dòng hàng tặng sinh sau nên không nhận phần giảm. Mua X tặng Y tính riêng từng chương trình: số suất bằng phần nguyên của tổng số lượng cơ sở mặt hàng mua trên các dòng không phải hàng tặng chia số lượng mua (dòng tặng của chương trình khác không tính); thêm một dòng hàng tặng theo đơn vị cơ sở, số lượng = số suất × số lượng tặng, giá 0, thuế suất theo sản phẩm; mặt hàng tặng ngừng bán thì không thêm dòng. Số suất không quá số suất còn lại của chương trình (QUYTAC_NGHIEPVU_82) và không quá số suất đủ hàng tặng tại kho xuất: tồn của mặt hàng tặng tại kho trừ phần đang giữ (trừ phần giữ của chính đơn này), trừ số lượng cơ sở mặt hàng đó đã có trên đơn (dòng mua, dòng tặng tính trước), chia số lượng tặng mỗi suất, lấy phần nguyên; thiếu hàng thì tặng phần đủ hàng và ghi suất thiếu (tên chương trình, số suất thiếu) trên đơn để hiện cảnh báo; không đủ một suất thì không thêm dòng tặng (quyết định của người dùng ngày 2026-11-10). Dòng hàng tặng không sửa tay, bỏ khỏi biểu mẫu sửa đơn, tự tạo lại mỗi lần lưu | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_82 | Đã dùng của chương trình tính từ dòng đơn bán của các đơn đang chờ duyệt, đã xác nhận, đã giao đủ, đã đóng: tiền đã giảm (gồm thuế; giảm theo sản phẩm trên dòng không phải hàng tặng cộng phần giảm theo đơn chia vào dòng) và số suất đã tặng. Ngân sách và số suất tối đa để trống là không giới hạn. Khi lưu, đã dùng không tính chính đơn đang lưu. Giảm theo sản phẩm: tổng giảm của chương trình trên đơn vượt ngân sách còn lại thì bỏ chương trình đó cho cả đơn, các dòng chọn lại chương trình khác. Giảm theo đơn: tiền giảm vượt ngân sách còn lại thì bỏ chương trình đó, xét chương trình khác. Mua X tặng Y: số suất không quá số suất còn lại, hết suất thì tặng phần suất còn lại (quyết định của người dùng, mục 16). Gửi đơn khóa các chương trình đơn đã áp và kiểm lại đã dùng của các đơn khác cộng đơn này; vượt ngân sách hoặc số suất thì không gửi được ("Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi."), người bán lưu lại đơn để tính lại | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_83 | Phần giảm do khuyến mãi đã duyệt (theo sản phẩm và theo đơn) và dòng hàng tặng không tính ngoại lệ dưới giá vốn; giá so với giá vốn là giá chưa thuế sau chiết khấu tay, trước khuyến mãi (tiền chưa thuế của dòng cộng phần giảm khuyến mãi quy về chưa thuế, chia số lượng cơ sở). Chiết khấu tay vẫn kiểm mức tối đa như cũ (QUYTAC_NGHIEPVU_68). Dòng hàng tặng được giữ hàng (cộng vào tổng số lượng cơ sở của mặt hàng), giao hàng, trả hàng như dòng thường | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_84 | Chương trình hết thời gian hoặc đã dừng thì không áp vào đơn lưu sau đó; đơn đã lưu giữ khuyến mãi đã áp cho đến khi lưu lại | YCAU_NGHIEPVU_37 |

### Quyết định AI tự đưa ra (CONG_VIEC_12)

Ngày 2026-11-10, chưa xác nhận.

| Vị trí | Nội dung |
|---|---|
| QUYTAC_NGHIEPVU_79 | Ngân sách tiền chỉ cho giảm theo sản phẩm, giảm theo đơn; số suất tối đa chỉ cho mua X tặng Y. Chương trình không chọn được kênh Nội bộ; không giới hạn kênh cũng không áp cho kênh Nội bộ |
| QUYTAC_NGHIEPVU_80 | Giá trị gửi duyệt là ngân sách (không có thì 0), ngày duyệt là ngày hệ thống. Sửa chương trình bị từ chối, đã rút thì về nháp, bỏ liên kết yêu cầu duyệt cũ; số đã cấp giữ nguyên khi gửi lại. Chỉ người lập rút được, khi cấp duyệt đầu chưa quyết định |
| QUYTAC_NGHIEPVU_81 | Thứ tự tính: giảm theo sản phẩm, giảm theo đơn, mua X tặng Y. Phần trăm bằng nhau thì chọn chương trình lập trước. Phần trăm khuyến mãi và chiết khấu tay nhân nối tiếp trên giá bảng giá |
| QUYTAC_NGHIEPVU_81 | Giảm theo đơn chia theo tỷ lệ thành tiền gồm thuế, làm tròn 4 chữ số; dòng thành tiền 0 không nhận phần giảm; phần dư dồn vào dòng cuối có thành tiền; tiền chưa thuế của dòng tính lại từ thành tiền sau giảm chia (1 + thuế suất) |
| QUYTAC_NGHIEPVU_81 | Mua X tặng Y chỉ đếm hàng mua trên dòng không phải hàng tặng, không đếm dòng tặng của chương trình khác. Dòng hàng tặng theo đơn vị cơ sở, không có bảng giá, giá 0, thuế suất theo sản phẩm; mặt hàng tặng ngừng bán thì không thêm dòng. Nhiều chương trình mua X tặng Y cùng thỏa thì áp tất cả |
| QUYTAC_NGHIEPVU_81 | Biểu mẫu sửa đơn không hiện dòng hàng tặng; tổng tạm tính trên biểu mẫu chưa gồm khuyến mãi, số đúng hiện ở chi tiết đơn sau khi lưu |
| QUYTAC_NGHIEPVU_82 | Khi lưu, đã dùng không tính chính đơn đang lưu. Giảm theo sản phẩm, giảm theo đơn không đủ ngân sách cho cả đơn thì bỏ chương trình, không giảm một phần. Tồn hàng tặng tính tại kho xuất của đơn lúc lưu (tồn trừ hàng đang giữ của chứng từ khác, trừ số lượng mặt hàng đó đã có trên đơn); suất thiếu lưu trên đơn, tính lại mỗi lần lưu. So sánh dung sai làm tròn 0,00005 |
| QUYTAC_NGHIEPVU_83 | Giá so với giá vốn: tiền chưa thuế của dòng cộng tổng giảm khuyến mãi (gồm thuế) quy về chưa thuế theo thuế suất dòng, chia số lượng cơ sở |
| Tài liệu `08` | Nhân viên bán hàng có `sales.promotion.view` (xem chương trình để tư vấn khách), không có `sales.promotion.manage`. Tìm mặt hàng `/sales/items` dùng được với `sales.order.manage` hoặc `sales.promotion.manage` |

### Quyết định của người dùng (CONG_VIEC_12, 2026-11-10)

- Kho xuất thiếu hàng tặng: tặng theo tồn còn lại, ghi suất thiếu trên đơn, chi tiết đơn hiện cảnh báo; đơn vẫn gửi được (QUYTAC_NGHIEPVU_81).
- Hết số suất tối đa: tặng phần suất còn lại (QUYTAC_NGHIEPVU_82).

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_85 | Quỹ thuộc công ty: mã (duy nhất trong công ty không phân biệt hoa thường, tối đa 20 ký tự), tên, loại (tiền mặt, ngân hàng; ngân hàng bắt buộc tên ngân hàng, số tài khoản; chủ tài khoản không bắt buộc), số dư đầu (không âm), trạng thái (đang dùng, ngừng dùng). Số dư đầu chỉ sửa được khi quỹ chưa có phiếu chờ duyệt hoặc đã ghi sổ. Số dư hiện tại = số dư đầu + tổng phiếu thu đã ghi sổ − tổng phiếu chi đã ghi sổ của quỹ. Quỹ ngừng dùng không chọn được cho phiếu mới; phiếu dùng quỹ đã ngừng dùng không ghi sổ được. Tiền tệ là tiền tệ công ty | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_86 | Công nợ phát sinh khi phiếu kho ghi sổ, theo đối tác của công ty: phiếu xuất giao hàng tăng phải thu của khách hàng trên đơn bán (giá trị gồm thuế theo đơn của phần đã giao); phiếu nhận hàng trả lại giảm phải thu (giá trị gồm thuế theo đơn của phần trả); phiếu nhập mua tăng phải trả nhà cung cấp khi ghi sổ (sau kiểm tra chất lượng nếu có; giá trị gồm thuế theo đơn mua của phần đạt kiểm tra chất lượng); phiếu trả hàng nhà cung cấp giảm phải trả (giá trị gồm thuế theo đơn mua của phần trả). Phiếu kho của giao dịch nội bộ phát sinh như phiếu thường. Biên bản chênh lệch giao nhận nội bộ được bên bán ghi tổn thất (QUYTAC_NGHIEPVU_77) thì giảm phải thu của công ty mua đúng giá trị gồm thuế theo đơn bán của phần thiếu (khoản giảm nguồn `internal_write_off`, số chứng từ là số phiếu xuất gốc, ngày ghi tổn thất), trừ trước vào khoản tăng của phiếu xuất gốc, chạy cùng giao dịch đóng biên bản; "Nhập lại kho" giảm phải thu qua phiếu nhận hàng trả lại. Hạn thanh toán của khoản tăng nợ = ngày chứng từ + số ngày được nợ trong hồ sơ đối tác của công ty lúc ghi sổ (không có hồ sơ: 0 ngày). Đơn bán không có khách hàng không phát sinh công nợ; giá trị 0 không phát sinh. Phiếu ghi sổ trước khi nâng cấp được tính lại một lần khi chạy database migration: khoản giảm chỉ trừ vào khoản tăng của phiếu gốc, phần còn lại giữ làm trả trước. Tiền làm tròn 4 chữ số lẻ | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_87 | Mỗi khoản công nợ là tăng nợ hoặc giảm nợ, có số tiền và số còn lại. Trừ nợ ghép một khoản giảm với một khoản tăng cùng đối tác, cùng công ty, cùng phía (phải thu hoặc phải trả), không vượt số còn lại của cả hai. Khoản giảm do trả hàng trừ trước vào khoản tăng của phiếu gốc, phần còn lại trừ các khoản tăng cũ nhất (theo hạn thanh toán, rồi ngày chứng từ). Khoản tăng mới tự trừ vào các khoản giảm còn lại cũ nhất theo ngày chứng từ (trả trước). Số dư công nợ của đối tác = tổng số còn lại của khoản tăng − tổng số còn lại của khoản giảm; tổng số còn lại của các khoản giảm là tiền trả trước | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_88 | Phiếu thu, phiếu chi thuộc công ty: loại (thu tiền khách hàng, trả tiền nhà cung cấp, hoàn tiền cho khách hàng, nhận tiền nhà cung cấp hoàn), đối tác (khách hàng hoặc nhà cung cấp theo hồ sơ đối tác của công ty, theo loại), quỹ đang dùng, ngày, số tiền (lớn hơn 0), nội dung. Thu tiền khách hàng, trả tiền nhà cung cấp là khoản giảm nợ: người lập chọn các chứng từ còn nợ và số trừ (giao diện chia sẵn cũ nhất trước đến hết số tiền); tổng trừ không vượt số tiền phiếu; mỗi dòng không vượt số còn lại; chứng từ không trùng. Khi ghi sổ: có chọn chứng từ thì trừ đúng các chứng từ đó, phần thừa là trả trước; không chọn chứng từ thì tự trừ các khoản tăng cũ nhất trước, phần thừa là trả trước. Hoàn tiền là khoản tăng nợ (hạn thanh toán bằng ngày phiếu), không vượt tiền trả trước đang còn của đối tác ở phía đó, tự trừ vào khoản trả trước cũ nhất. Phiếu chi không vượt số dư hiện tại của quỹ khi ghi sổ. Lúc ghi sổ kiểm lại quỹ đang dùng, số còn lại, trả trước, số dư quỹ (khóa công nợ của đối tác ở phía đó rồi khóa quỹ) | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_89 | Phiếu thu (thu tiền khách hàng, nhận tiền nhà cung cấp hoàn; loại chứng từ `finance.receipt`, không duyệt) ghi sổ ngay khi gửi; không ghi sổ được thì báo lỗi, phiếu giữ trạng thái trước khi gửi. Phiếu chi (trả tiền nhà cung cấp, hoàn tiền cho khách hàng) đi luồng duyệt (loại chứng từ `finance.payment`, giá trị duyệt là số tiền; chưa có chính sách duyệt thì ghi sổ ngay như phiếu thu); duyệt xong thì ghi sổ; không ghi sổ được (số dư quỹ, số còn nợ, trả trước đã đổi, quỹ đã ngừng dùng) thì phiếu về "Bị từ chối" kèm lý do để người lập sửa, gửi lại. Gửi lần đầu cấp số (`PT`… phiếu thu, `PC`… phiếu chi); số đã cấp giữ khi gửi lại; phiếu đã cấp số không đổi được giữa phiếu thu và phiếu chi. Sửa khi nháp, bị từ chối, đã rút; sửa xong phiếu về nháp. Người lập rút được khi chờ duyệt và cấp duyệt đầu chưa quyết định. Phiếu đã ghi sổ không sửa, không hủy | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_90 | Số dư đầu kỳ: người có quyền quản lý công nợ nhập theo từng chứng từ cũ (đối tác là khách hàng hoặc nhà cung cấp của công ty theo phía, phía phải thu hoặc phải trả, còn nợ hoặc trả trước, số chứng từ cũ tối đa 50 ký tự, ngày, hạn thanh toán bắt buộc với khoản còn nợ và không trước ngày chứng từ, số tiền lớn hơn 0, ghi chú). Khoản còn nợ mới tự trừ trả trước cũ nhất; khoản trả trước mới tự trừ các khoản còn nợ cũ nhất (QUYTAC_NGHIEPVU_87). Xóa được khi chưa trừ nợ và chưa được chọn trên phiếu thu chi nào | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_91 | Tuổi nợ tính trên số còn lại của các khoản tăng nợ theo hạn thanh toán so với ngày hiện tại (giờ Việt Nam): chưa đến hạn (hạn từ hôm nay trở đi), quá hạn 1 đến 30 ngày, 31 đến 60 ngày, 61 đến 90 ngày, trên 90 ngày | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_92 | Dư nợ để kiểm hạn mức công nợ của đơn bán (thay QUYTAC_NGHIEPVU_69, THAY_DOI_09): số dư công nợ phải thu của khách (QUYTAC_NGHIEPVU_87, trả trước làm giảm) cộng giá trị gồm thuế phần chưa giao của các đơn khác của khách đã xác nhận. Dư nợ cộng tổng gồm thuế của đơn đang gửi vượt hạn mức thì là ngoại lệ (như QUYTAC_NGHIEPVU_68) | YCAU_NGHIEPVU_38 |

### Quyết định AI tự đưa ra (CONG_VIEC_13)

Ngày 2026-11-10, chưa xác nhận.

| Vị trí | Nội dung |
|---|---|
| QUYTAC_NGHIEPVU_85 | Số dư đầu của quỹ khóa khi quỹ có phiếu chờ duyệt hoặc đã ghi sổ; mã quỹ duy nhất không phân biệt hoa thường; phiếu dùng quỹ đã ngừng dùng không ghi sổ được |
| QUYTAC_NGHIEPVU_86 | Đơn bán không có khách hàng không phát sinh công nợ. Hạn thanh toán lấy số ngày được nợ của hồ sơ đối tác lúc ghi sổ phiếu kho. Tính lại phiếu cũ chỉ trừ khoản giảm vào khoản tăng của phiếu gốc; phần còn lại giữ làm trả trước |
| QUYTAC_NGHIEPVU_87 | Khoản tăng cũ nhất xếp theo hạn thanh toán, rồi ngày chứng từ, rồi thời điểm tạo; khoản giảm cũ nhất xếp theo ngày chứng từ, rồi thời điểm tạo |
| QUYTAC_NGHIEPVU_88 | Phiếu không chọn chứng từ thì tự trừ cũ nhất trước khi ghi sổ; có chọn thì chỉ trừ chứng từ đã chọn, phần thừa là trả trước. Hoàn tiền có hạn thanh toán bằng ngày phiếu. Phiếu chi không vượt số dư quỹ. Phiếu thu chi luôn gắn đối tác |
| QUYTAC_NGHIEPVU_89 | Phiếu chi duyệt xong mà không ghi sổ được thì về "Bị từ chối" kèm lý do, không giữ "Chờ duyệt". Phiếu đã cấp số không đổi giữa phiếu thu và phiếu chi. Phiếu đã ghi sổ không sửa, không hủy; sai thì lập phiếu hoàn tiền hoặc phiếu ngược loại |
| QUYTAC_NGHIEPVU_90 | Khoản số dư đầu kỳ đang được chọn trên phiếu thu chi chưa ghi sổ cũng không xóa được |
| Tài liệu `08` | Quyền tài chính chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty; Kế toán có `crm.access`, `crm.partner.view` để xem đối tác |

### Quyết định của người dùng (CONG_VIEC_13, 2026-11-10)

- Giao nội bộ thiếu, bên bán "Ghi tổn thất" biên bản chênh lệch thì giảm phải thu của công ty mua đúng giá trị phần thiếu theo giá đơn bán, để công nợ hai công ty khớp nhau (QUYTAC_NGHIEPVU_86).

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
