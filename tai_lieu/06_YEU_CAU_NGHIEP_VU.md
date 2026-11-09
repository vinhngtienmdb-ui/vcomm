# 06. YÊU CẦU NGHIỆP VỤ

- Mô tả: Yêu cầu nghiệp vụ theo module, có mã định danh.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm YCAU_NGHIEPVU_22 đến YCAU_NGHIEPVU_25 của MODULE_02

## MODULE_01 Nền tảng

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_01 | Quản lý tập đoàn và các công ty con dạng cây; mỗi công ty có mã số thuế, tiền tệ hạch toán, chế độ kế toán, tháng bắt đầu năm tài chính | Quản trị tập đoàn | Tài liệu `04` mục 8.1 |
| YCAU_NGHIEPVU_02 | Quản lý chi nhánh của từng công ty theo loại: trụ sở, văn phòng, kho, cửa hàng | Quản trị công ty | Tài liệu `05` mục 2.1 |
| YCAU_NGHIEPVU_03 | Quản lý phòng ban dạng cây trong từng công ty, có trưởng phòng | Quản trị công ty | Tài liệu `05` mục 2.1 |
| YCAU_NGHIEPVU_04 | Mời nhân viên vào hệ thống, nhân viên tự kích hoạt tài khoản | Quản trị công ty, nhân viên | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_05 | Đăng nhập bằng mật khẩu, Google Workspace, Microsoft 365, Zalo hoặc số điện thoại kèm mã OTP; một tài khoản dùng được nhiều cách | Mọi nhân viên | Đợt hỏi đáp 2026-11-09; THAY_DOI_01 |
| YCAU_NGHIEPVU_06 | Bắt buộc xác thực hai lớp với người có quyền nhạy cảm | Quản trị tập đoàn | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_07 | Một nhân viên thuộc nhiều công ty, có vai trò riêng ở từng công ty, chuyển công ty không phải đăng nhập lại | Nhân viên làm cho nhiều công ty | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_08 | Phân quyền theo vai trò, gán trong phạm vi tập đoàn, công ty hoặc chi nhánh, có thể có thời hạn | Quản trị tập đoàn, quản trị công ty | Tài liệu `04` mục 8.2 |
| YCAU_NGHIEPVU_09 | Trang chủ hiện các mini app nhân viên được dùng trong công ty đang chọn, kèm số việc chờ xử lý | Mọi nhân viên | Tài liệu `04` mục 8.2 |
| YCAU_NGHIEPVU_10 | Duyệt chứng từ của mọi mini app theo hạn mức cấu hình cho từng công ty và loại chứng từ | Người lập, người duyệt, quản trị công ty | Tài liệu `04` mục 8.5 |
| YCAU_NGHIEPVU_11 | Mỗi cấp duyệt có người duyệt thay thế; chứng từ chờ quá hạn được nhắc rồi chuyển người thay thế | Người duyệt, quản trị công ty | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_12 | Hộp duyệt chung cho mọi chứng từ đang chờ, dùng được trên điện thoại | Người duyệt | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_13 | Khi nhân viên nghỉ việc: khóa tài khoản, bàn giao việc chờ duyệt và vị trí trưởng phòng cho người khác | Quản trị công ty | Đợt hỏi đáp 2026-11-09 |
| YCAU_NGHIEPVU_14 | Đánh số chứng từ tự động theo công ty, loại chứng từ, kỳ | Mọi mini app | Tài liệu `05` mục 2.1 |
| YCAU_NGHIEPVU_15 | Quản lý tiền tệ và tỷ giá theo ngày, theo loại, theo nguồn | Kế toán | Tài liệu `04` mục 8.3 |
| YCAU_NGHIEPVU_16 | Ghi nhật ký mọi thao tác ghi dữ liệu và đăng nhập; tra cứu được | Quản trị tập đoàn, quản trị công ty | Tài liệu `05` mục 2.1 |
| YCAU_NGHIEPVU_17 | Giao diện tiếng Việt và tiếng Anh, mỗi nhân viên tự chọn | Mọi nhân viên | Tài liệu `04` mục 8.8 |
| YCAU_NGHIEPVU_18 | Quản trị nhập danh sách nhân viên bằng tệp Excel | Quản trị công ty | Tài liệu `05` mục 3 |
| YCAU_NGHIEPVU_19 | Quản trị tập đoàn tự nhập mã ứng dụng đăng nhập, khóa nhà cung cấp gửi tin mà không cần sửa mã | Quản trị tập đoàn | THAY_DOI_08 |
| YCAU_NGHIEPVU_20 | Người duyệt, người lập nhận thông báo duyệt qua Zalo | Mọi nhân viên | THAY_DOI_04 |
| YCAU_NGHIEPVU_21 | Nhân viên lập đề xuất theo mẫu do quản trị tạo, đính kèm chứng từ gốc, đi qua luồng duyệt, in được | Mọi nhân viên, quản trị công ty | THAY_DOI_04 |

## MODULE_02 Sản phẩm và Nhà bán (phần Sản phẩm, CONG_VIEC_04)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_22 | Mỗi công ty con quản lý danh mục sản phẩm của mình, phân loại theo một cây ngành hàng chung của tập đoàn | Quản lý sản phẩm, quản trị tập đoàn | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 (tài liệu `02`) |
| YCAU_NGHIEPVU_23 | Sản phẩm có biến thể, nhiều đơn vị tính quy đổi, nhiều mã vạch, theo dõi lô và hạn dùng hoặc serial theo ngành hàng; nhập hàng loạt từ Excel | Quản lý sản phẩm, Kho, Bán hàng | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 |
| YCAU_NGHIEPVU_24 | Giao dịch giữa công ty con biết sản phẩm tương ứng ở công ty bên kia | Kế toán, Mua hàng, Bán hàng | Quyết định của người dùng 2026-11-09 |
| YCAU_NGHIEPVU_25 | Giá bán theo công ty, kênh bán, nhóm khách hàng, hiệu lực theo ngày; thay đổi giá được duyệt và lưu lịch sử | Ban giám đốc, Bán hàng | Tài liệu `04` yêu cầu cấp cao 4; quyết định của người dùng 2026-11-09 |

## Đối tượng nghiệp vụ

| Đối tượng | Thuộc tính chính | Quan hệ |
|---|---|---|
| Công ty | Mã, tên pháp lý, tên ngắn, mã số thuế, tiền tệ hạch toán, chế độ kế toán, tháng bắt đầu năm tài chính, trạng thái | Có công ty mẹ; có nhiều chi nhánh, phòng ban |
| Chi nhánh | Mã, tên, loại, tỉnh thành, địa chỉ, trạng thái | Thuộc một công ty |
| Phòng ban | Mã, tên, trưởng phòng, trạng thái | Thuộc một công ty; có phòng ban cha |
| Nhân viên (người dùng) | Họ tên, tên đăng nhập, email, số điện thoại, ngôn ngữ, bắt buộc xác thực hai lớp, trạng thái | Thuộc nhiều công ty; có nhiều cách đăng nhập, nhiều lần gán vai trò |
| Vai trò | Mã, tên, công ty sở hữu (trống là dùng chung tập đoàn), danh sách quyền | Gán cho nhân viên trong một phạm vi |
| Quyền | Mã `<app>.<đối tượng>.<hành động>`, tên, nhạy cảm hay không | Thuộc một mini app |
| Chính sách duyệt | Công ty, loại chứng từ, tiền tệ so ngưỡng, ngày hiệu lực | Có nhiều cấp duyệt |
| Cấp duyệt | Thứ tự, ngưỡng, người duyệt, người duyệt thay thế, thời hạn xử lý | Thuộc một chính sách |
| Yêu cầu duyệt | Chứng từ, số chứng từ, giá trị, người lập, trạng thái | Theo một chính sách; có nhiều bước duyệt |
| Dãy số chứng từ | Công ty, loại chứng từ, kỳ, tiền tố, số tiếp theo | |
| Tỷ giá | Ngày, tiền tệ nguồn, tiền tệ đích, loại, nguồn, giá trị | |
| Nhật ký thao tác | Thời điểm, người làm, công ty, mini app, hành động, đối tượng, dữ liệu trước và sau | |
| Cài đặt tích hợp | Khóa cài đặt, giá trị thường hoặc giá trị bí mật, người sửa, thời điểm sửa | Dùng chung toàn tập đoàn |
| Nhật ký gửi tin | Kênh, mục đích, số điện thoại đã che, mẫu tin, trạng thái, lỗi | Gửi cho một nhân viên |
| Mẫu đề xuất | Mã, tên, mô tả, danh sách trường, trường giá trị duyệt, tiền tệ, trạng thái | Thuộc một công ty; là một loại chứng từ cần duyệt |
| Đề xuất | Số đề xuất, tiêu đề, giá trị các trường, giá trị duyệt, tiền tệ, trạng thái, người lập | Theo một mẫu (giữ bản chụp mẫu); có một yêu cầu duyệt khi gửi; có nhiều tệp đính kèm |
| Tệp đính kèm | Tên tệp, loại, kích thước, người tải lên | Thuộc một đề xuất |
| Ngành hàng | Mã (tiền tố mã hàng), tên tiếng Việt, tiếng Anh, cấp (1 đến 4), theo dõi lô và hạn dùng, theo dõi serial, số tháng bảo hành, trạng thái | Dùng chung tập đoàn; có ngành hàng cha; có nhiều sản phẩm |
| Đơn vị tính | Mã, tên tiếng Việt, tiếng Anh, trạng thái | Dùng chung tập đoàn |
| Sản phẩm | Mã, tên, mô tả, thương hiệu, xuất xứ, thuế suất giá trị gia tăng, theo dõi lô hoặc serial, số tháng bảo hành, đơn vị cơ sở, trọng lượng, thể tích, thuộc tính phân loại, thông số, trạng thái | Thuộc một công ty, một ngành hàng lá; có nhiều đơn vị quy đổi, biến thể, ảnh |
| Biến thể | Mã hàng, giá trị phân loại, trạng thái | Thuộc một sản phẩm; có nhiều mã vạch; liên kết với biến thể tương ứng ở công ty khác |
| Mã vạch | Mã vạch, đơn vị tính | Thuộc một biến thể; duy nhất trong công ty |
| Liên kết biến thể | Hệ số quy đổi đơn vị cơ sở | Nối hai biến thể của hai công ty khác nhau |
| Kênh bán, nhóm khách hàng | Mã, tên, trạng thái | Thuộc một công ty |
| Bảng giá | Mã, tên, kênh bán, nhóm khách hàng, tiền tệ, gồm thuế hay không, trạng thái | Thuộc một công ty; có lịch sử giá |
| Giá | Biến thể, đơn vị tính, giá, ngày hiệu lực | Thuộc một bảng giá; ghi từ một phiếu điều chỉnh giá |
| Phiếu điều chỉnh giá | Số phiếu, bảng giá, ngày hiệu lực, ghi chú, trạng thái, người lập; các dòng (biến thể, đơn vị, giá mới, giá hiện hành) | Thuộc một công ty; có một yêu cầu duyệt khi gửi |
