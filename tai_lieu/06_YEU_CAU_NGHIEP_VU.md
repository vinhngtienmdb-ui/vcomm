# 06. YÊU CẦU NGHIỆP VỤ

- Mô tả: Yêu cầu nghiệp vụ theo module, có mã định danh.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09)

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
