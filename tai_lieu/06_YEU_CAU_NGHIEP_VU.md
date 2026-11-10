# 06. YÊU CẦU NGHIỆP VỤ

- Mô tả: Yêu cầu nghiệp vụ theo module, có mã định danh.
- Phiên bản: 2.0
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm YCAU_NGHIEPVU_22 đến YCAU_NGHIEPVU_25 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm YCAU_NGHIEPVU_26 đến YCAU_NGHIEPVU_29 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm YCAU_NGHIEPVU_30, YCAU_NGHIEPVU_31 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm YCAU_NGHIEPVU_32, YCAU_NGHIEPVU_33 của MODULE_04; CONG_VIEC_08 (2026-11-10): thêm YCAU_NGHIEPVU_34, YCAU_NGHIEPVU_35 của MODULE_05; CONG_VIEC_09 (2026-11-10): thêm YCAU_NGHIEPVU_36 của MODULE_05 (giao dịch nội bộ); CONG_VIEC_12 (2026-11-10): thêm YCAU_NGHIEPVU_37 của MODULE_05 (khuyến mãi), đối tượng chương trình khuyến mãi, trường khuyến mãi trên dòng đơn bán; CONG_VIEC_13 (2026-11-10): thêm YCAU_NGHIEPVU_38 của MODULE_06 (công nợ phải thu, phải trả), đối tượng quỹ, khoản công nợ, trừ nợ, phiếu thu chi

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

## MODULE_03 Kho (phần web, CONG_VIEC_05)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_26 | Nhiều kho thuộc chi nhánh, có hoặc không có vị trí kệ; một kho chứa hàng của nhiều công ty con | Quản lý kho, quản trị công ty | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 (tài liệu `02`, Kho chứa hàng nhiều công ty) |
| YCAU_NGHIEPVU_27 | Tồn kho chính xác theo thời gian thực theo công ty chủ hàng, lô và hạn dùng, serial, vị trí; không âm; có giá vốn và thẻ kho | Thủ kho, Kế toán, Bán hàng | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 |
| YCAU_NGHIEPVU_28 | Nhập, xuất không có chứng từ gốc, chuyển kho, kiểm kê có kiểm soát: duyệt, biên bản chênh lệch, quy trách nhiệm | Quản lý kho, Ban giám đốc, Kế toán | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 |
| YCAU_NGHIEPVU_29 | Giữ hàng cho đơn đã xác nhận; cảnh báo hàng dưới tồn an toàn và gợi ý bổ sung; in tem mã vạch | Bán hàng, Mua hàng, Thủ kho | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 |

## MODULE_07 Khách hàng và Đối tác (phần tối thiểu, CONG_VIEC_06)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_30 | Danh mục đối tác dùng chung tập đoàn, không trùng, định danh theo mã số thuế hoặc số Căn cước công dân; công ty con là đối tác nội bộ | Mua hàng, Bán hàng, Kế toán mọi công ty | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |
| YCAU_NGHIEPVU_31 | Mỗi công ty có hồ sơ riêng với đối tác: là khách hàng, nhà cung cấp, điều khoản thanh toán, hạn mức công nợ, nhóm khách, nhân viên phụ trách | Bán hàng, Mua hàng, Kế toán | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09 |

## MODULE_04 Mua hàng (phần 1: Mua hàng trong nước, CONG_VIEC_07)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_32 | Đề nghị mua hàng trong danh mục được duyệt trước khi đặt; đơn mua có duyệt, sửa tăng giá trị hoặc đổi nhà cung cấp thì duyệt lại; giá mua gợi ý theo bảng giá nhà cung cấp | Mua hàng, quản lý | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |
| YCAU_NGHIEPVU_33 | Kho nhận hàng theo đơn mua, không vượt dung sai; hàng cần kiểm tra chất lượng chỉ vào tồn khi đạt; trả hàng nhà cung cấp theo phiếu nhập gốc | Thủ kho, Mua hàng, Kế toán | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_34 | Lập đơn bán đúng giá bảng giá theo kênh, nhóm khách; đơn chỉ duyệt khi có ngoại lệ (chiết khấu tay vượt mức, bán dưới giá vốn, vượt hạn mức công nợ); hàng được giữ khi gửi đơn | Nhân viên bán hàng, quản lý | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |
| YCAU_NGHIEPVU_35 | Kho giao hàng theo đơn, giao nhiều lần; khách trả hàng gắn đơn gốc, trả một phần | Thủ kho, Bán hàng, Kế toán | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_36 | Mua bán giữa công ty con tự sinh chứng từ hai phía, bên kia xác nhận; hàng giao, hàng nhận khớp nhau, lệch có biên bản | Bán hàng, Mua hàng, Thủ kho, Kế toán các công ty con | Tài liệu `04` mục ràng buộc 1; tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_37 | Khai báo chương trình khuyến mãi (giảm theo sản phẩm, giảm theo đơn, mua X tặng Y) có điều kiện kênh, nhóm khách, thời gian, được duyệt, tự áp dụng vào đơn bán, có giới hạn ngân sách, số suất | Quản lý kinh doanh, Nhân viên bán hàng | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-09, 2026-11-10 (tài liệu `02`) |

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_38 | Theo dõi công nợ phải thu, phải trả theo đối tác và theo từng chứng từ (hạn thanh toán, quá hạn); thu, chi tiền qua quỹ có số dư; trả trước, hoàn tiền | Kế toán, Quản lý kinh doanh, Quản lý mua hàng | Tài liệu `05` mục 2.1; quyết định của người dùng 2026-11-10 (tài liệu `02`); THAY_DOI_09 |

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
| Kho | Mã (duy nhất trong công ty), tên, địa chỉ, dùng vị trí kệ, trạng thái | Thuộc một chi nhánh của công ty sở hữu kho; có danh sách công ty chủ hàng, nhiều vị trí |
| Vị trí kệ | Mã (duy nhất trong kho), tên, trạng thái | Thuộc một kho |
| Lô | Số lô, ngày sản xuất, hạn dùng | Thuộc một biến thể của công ty chủ hàng |
| Serial | Số serial (duy nhất trong công ty chủ hàng), trạng thái (trong kho, đang vận chuyển, đã xuất), giá vốn đích danh | Thuộc một biến thể; ở một kho, một vị trí tại một thời điểm |
| Tồn kho | Số lượng theo đơn vị cơ sở | Theo kho, công ty chủ hàng, biến thể, lô, vị trí |
| Giá vốn | Số lượng, giá trị, giá vốn bình quân | Theo kho, công ty chủ hàng, biến thể |
| Phiếu kho | Loại (nhập khác, xuất khác, điều chỉnh, chuyển kho), số phiếu, ngày, lý do, trạng thái, người lập; các dòng (biến thể, đơn vị, số lượng, đơn giá, lô, vị trí, serial, số thực nhận, người chịu trách nhiệm, tiền bồi thường) | Thuộc công ty chủ hàng, một kho (chuyển kho có kho đích); có một yêu cầu duyệt khi gửi |
| Thẻ kho | Thời điểm, phiếu, số lượng tăng giảm, giá vốn, giá trị, tồn sau | Theo kho, công ty chủ hàng, biến thể; chỉ thêm |
| Biên bản chênh lệch chuyển kho | Số xuất, số nhận, chênh lệch, giá trị, ghi chú | Thuộc một dòng phiếu chuyển kho |
| Kiểm kê | Số kiểm kê, phạm vi (toàn kho, ngành hàng, vị trí, danh sách sản phẩm), trạng thái; các dòng (tồn sổ sách, số đếm, serial đếm được, người chịu trách nhiệm, tiền bồi thường) | Thuộc công ty chủ hàng, một kho; sinh một phiếu điều chỉnh khi kết thúc |
| Hàng giữ | Số lượng, nguồn, hạn giữ, trạng thái (đang giữ, đã nhả, đã dùng) | Theo kho, công ty chủ hàng, biến thể |
| Tồn an toàn | Tối thiểu, tối đa | Theo kho, công ty chủ hàng, biến thể |
| Đối tác | Mã (`DT` + 6 số), loại (tổ chức, hộ kinh doanh, cá nhân), tên, tên ngắn, mã số thuế, số Căn cước công dân, địa chỉ, điện thoại, email, trạng thái | Dùng chung tập đoàn; đối tác nội bộ gắn với một công ty con; có nhiều người liên hệ, tài khoản ngân hàng, hồ sơ theo công ty |
| Người liên hệ của đối tác | Họ tên, chức vụ, điện thoại, email, liên hệ chính | Thuộc một đối tác |
| Tài khoản ngân hàng của đối tác | Ngân hàng, số tài khoản, chủ tài khoản, chi nhánh, mặc định | Thuộc một đối tác |
| Hồ sơ đối tác của công ty | Là khách hàng, là nhà cung cấp, số ngày được nợ, hạn mức công nợ, ghi chú, trạng thái | Một công ty với một đối tác; có nhóm khách hàng, nhân viên phụ trách của công ty |
| Giá mua của nhà cung cấp | Nhà cung cấp, mặt hàng, đơn vị mua, số lượng tối thiểu, đơn giá chưa thuế, mã hàng nhà cung cấp, hiệu lực từ, đến, trạng thái | Thuộc công ty; nhà cung cấp là đối tác có hồ sơ nhà cung cấp ở công ty |
| Cài đặt mua hàng | Dung sai nhận vượt (phần trăm, mặc định 0) | Một bản mỗi công ty |
| Đề nghị mua | Số (`DNM`…), kho nhận, ngày cần, lý do, trạng thái (nháp, chờ duyệt, đã duyệt, bị từ chối, đã rút, đã đóng); các dòng (mặt hàng, đơn vị, số lượng, đơn giá ước tính, nhà cung cấp đề xuất, ghi chú) | Thuộc công ty; mỗi dòng được đặt qua một hoặc nhiều dòng đơn mua |
| Đơn mua | Số (`DMH`…), nhà cung cấp, kho nhận, ngày đơn, ngày giao dự kiến, tiền tệ của công ty, ghi chú, tổng chưa thuế, thuế, trạng thái (chờ xác nhận nội bộ, nháp, chờ duyệt, đã duyệt, bị từ chối, đã rút, đã nhận đủ, đã đóng), lý do đóng, đơn bán đối ứng, là đơn đối ứng hay không, lý do bên kia từ chối; các dòng (mặt hàng, đơn vị, số lượng, đơn giá chưa thuế, thuế suất, thành tiền) | Thuộc công ty; dòng có thể lấy từ dòng đề nghị mua; số đã nhận, đã trả tính từ phiếu kho; nhà cung cấp nội bộ thì có một đơn bán đối ứng ở công ty bán |
| Phiếu nhập mua | Như phiếu kho; nhà cung cấp, đơn mua gốc, trạng thái thêm "Chờ kiểm tra chất lượng", "Chờ nhận" (nội bộ), số không đạt và lý do từng dòng, người và thời điểm kiểm, phiếu xuất gốc bên bán (nội bộ) | Phiếu kho của công ty đặt đơn ở kho nhận của đơn; mỗi dòng gắn một dòng đơn mua; phiếu nhập nội bộ mỗi dòng gắn một dòng phiếu xuất giao hàng gốc |
| Phiếu trả hàng nhà cung cấp | Như phiếu kho; nhà cung cấp, phiếu nhập mua gốc, lý do | Mỗi dòng gắn một dòng phiếu nhập mua gốc |
| Cài đặt bán hàng | Chiết khấu tay tối đa không cần duyệt (phần trăm, mặc định 0) | Một bản mỗi công ty |
| Đơn bán | Số (`DBH`…), khách hàng (trống: người mua không lấy hóa đơn, kèm tên người mua), kênh bán, nhóm khách lúc lập, kho xuất, ngày đơn, địa chỉ giao, ghi chú, tiền tệ của công ty, tổng chưa thuế, thuế, tổng gồm thuế, ngoại lệ cần duyệt, trạng thái (chờ xác nhận nội bộ, nháp, chờ duyệt, đã xác nhận, bị từ chối, đã rút, đã giao đủ, đã hủy, đã đóng), lý do đóng, đơn mua đối ứng, là đơn đối ứng hay không, lý do bên kia từ chối; các dòng (mặt hàng, đơn vị, số lượng, bảng giá, giá bảng giá, giá gồm thuế hay chưa, chiết khấu tay phần trăm, đơn giá sau chiết khấu, thuế suất, tiền chưa thuế, thuế, tổng; khuyến mãi theo sản phẩm và phần trăm, khuyến mãi theo đơn và phần giảm chia vào dòng, tổng giảm do khuyến mãi gồm thuế, là dòng hàng tặng hay không, số suất tặng) | Thuộc công ty; khách là đối tác có hồ sơ khách hàng ở công ty; hàng giữ theo nguồn `sales.order`; số đã giao, đã trả tính từ phiếu kho; khách nội bộ thì có một đơn mua đối ứng ở công ty mua; dòng tham chiếu chương trình khuyến mãi đã áp; đơn ghi suất tặng thiếu (chương trình, số suất) khi kho xuất không đủ hàng tặng |
| Phiếu xuất giao hàng | Như phiếu kho; khách hàng, đơn bán gốc | Phiếu kho của công ty bán ở kho xuất của đơn; mỗi dòng gắn một dòng đơn bán |
| Phiếu nhận hàng trả lại | Như phiếu kho; khách hàng, phiếu xuất giao hàng gốc, lý do | Mỗi dòng gắn một dòng phiếu xuất giao hàng gốc |
| Biên bản chênh lệch giao nhận nội bộ | Số thiếu (đơn vị cơ sở bên bán), giá trị theo giá vốn phiếu xuất, serial chưa nhận, lý do bên nhận, trạng thái (chờ xử lý, đã nhập lại kho, đã ghi tổn thất), ghi chú, người và thời điểm xử lý | Thuộc công ty bán, kho xuất; gắn một dòng phiếu xuất giao hàng và một phiếu nhập mua nội bộ; có phiếu nhận hàng trả lại khi nhập lại kho |
| Chương trình khuyến mãi | Số (`KM`…), tên, loại (giảm theo sản phẩm, giảm theo đơn, mua X tặng Y), từ ngày, đến ngày, kênh áp dụng, nhóm khách áp dụng, mặt hàng và phần trăm giảm (giảm theo sản phẩm), ngưỡng tổng đơn gồm thuế, phần trăm, mức giảm tối đa (giảm theo đơn), mặt hàng mua, số lượng mua, mặt hàng tặng, số lượng tặng mỗi suất (mua X tặng Y), ngân sách gồm thuế, số suất tối đa, ghi chú, trạng thái (nháp, chờ duyệt, đang chạy, bị từ chối, đã rút, đã dừng), lý do dừng; đã dùng (tiền đã giảm, số suất đã tặng) | Thuộc công ty; đã dùng tính từ dòng đơn bán chờ duyệt, đã xác nhận, đã giao đủ, đã đóng |
| Quỹ | Mã (duy nhất trong công ty), tên, loại (tiền mặt, ngân hàng), tên ngân hàng, số tài khoản, chủ tài khoản, số dư đầu, trạng thái (đang dùng, ngừng dùng); số dư hiện tại tính từ phiếu thu chi đã ghi sổ | Thuộc công ty; tiền tệ của công ty; có nhiều phiếu thu chi |
| Khoản công nợ | Phía (phải thu, phải trả), hướng (tăng nợ, giảm nợ), nguồn (số dư đầu kỳ, xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, phiếu thu chi), số chứng từ, ngày chứng từ, hạn thanh toán (khoản tăng nợ), số tiền gồm thuế, số còn lại, ghi chú | Thuộc công ty, một đối tác; sinh từ một phiếu kho đã ghi sổ, một phiếu thu chi đã ghi sổ hoặc nhập tay (số dư đầu kỳ); khoản giảm do trả hàng gắn khoản tăng của phiếu gốc |
| Trừ nợ | Số tiền, thời điểm | Ghép một khoản giảm nợ với một khoản tăng nợ cùng công ty, đối tác, phía |
| Phiếu thu, phiếu chi | Số (`PT`…, `PC`…), loại (thu tiền khách hàng, trả tiền nhà cung cấp, hoàn tiền cho khách hàng, nhận tiền nhà cung cấp hoàn), đối tác, quỹ, ngày, số tiền, nội dung, trạng thái (nháp, chờ duyệt, đã ghi sổ, bị từ chối, đã rút), lý do không ghi sổ được, thời điểm ghi sổ; các chứng từ chọn trừ (khoản tăng nợ, số trừ) | Thuộc công ty; phiếu chi có một yêu cầu duyệt khi gửi; ghi sổ sinh một khoản công nợ |
