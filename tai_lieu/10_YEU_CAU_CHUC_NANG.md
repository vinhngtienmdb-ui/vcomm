# 10. YÊU CẦU CHỨC NĂNG

- Mô tả: Đặc tả yêu cầu chức năng và yêu cầu phi chức năng, có mã định danh.
- Phiên bản: 2.6
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_03 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm CHUC_NANG_30 đến CHUC_NANG_37 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm CHUC_NANG_38 đến CHUC_NANG_45 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm CHUC_NANG_46 đến CHUC_NANG_48 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm CHUC_NANG_49 đến CHUC_NANG_53 của MODULE_04; CONG_VIEC_08 (2026-11-10): thêm CHUC_NANG_54 đến CHUC_NANG_57 của MODULE_05; CONG_VIEC_09 (2026-11-10): thêm CHUC_NANG_58 đến CHUC_NANG_61 của MODULE_05 (giao dịch nội bộ); CONG_VIEC_12 (2026-11-10): thêm CHUC_NANG_62 đến CHUC_NANG_64 của MODULE_05 (khuyến mãi); CHUC_NANG_54 thêm khuyến mãi trên dòng đơn bán; CONG_VIEC_13 (2026-11-10): thêm CHUC_NANG_65 đến CHUC_NANG_68 của MODULE_06 (công nợ); CHUC_NANG_54 kiểm hạn mức công nợ theo dư nợ thật (THAY_DOI_09); CHUC_NANG_61 ghi tổn thất giảm phải thu; CONG_VIEC_14 (2026-11-10): thêm CHUC_NANG_69 đến CHUC_NANG_73 của MODULE_06 (kế toán tổng hợp); CHUC_NANG_01 từ chối đổi chế độ kế toán khi công ty đã có bút toán; CONG_VIEC_15 (2026-11-10): thêm CHUC_NANG_74, CHUC_NANG_75 của MODULE_06 (báo cáo tài chính); CHUC_NANG_69 thêm đánh dấu tài khoản chi tiết dài hạn; CONG_VIEC_16 (2026-11-10): thêm CHUC_NANG_76 đến CHUC_NANG_79 của MODULE_06 (hóa đơn điện tử); CONG_VIEC_17 (2026-11-10): thêm CHUC_NANG_80 đến CHUC_NANG_83 của MODULE_06 (hoa hồng đội kinh doanh); CHUC_NANG_70 thêm hai vai trò định khoản; CONG_VIEC_18 (2026-11-10): thêm CHUC_NANG_84 đến CHUC_NANG_87 của MODULE_06 (đối soát ngân hàng)

## MODULE_01 Nền tảng

Quy ước chung cho mọi chức năng của MODULE_01:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23).
- Phân quyền kiểm tra phía máy chủ theo QUYTAC_NGHIEPVU_12; không có quyền thì trả thông báo "Bạn không có quyền thực hiện thao tác này."
- Thông báo hiển thị theo ngôn ngữ nhân viên chọn.

### CHUC_NANG_01: Quản lý công ty
- Mục đích: Tạo, sửa, ngừng hoạt động công ty trong cây tập đoàn.
- Người sử dụng: Quản trị tập đoàn.
- Điều kiện thực hiện: Có quyền `platform.company.manage` phạm vi tập đoàn.
- Dữ liệu đầu vào: Công ty mẹ, mã, tên pháp lý, tên ngắn, mã số thuế, địa chỉ, điện thoại, email, tiền tệ hạch toán (mặc định VND), chế độ kế toán (mặc định Thông tư 99/2025; công ty nhỏ và vừa được chọn Thông tư 133), tháng bắt đầu năm tài chính (mặc định 1).
- Quy trình xử lý: Kiểm tra trùng mã, mã số thuế; kiểm tra không tạo vòng khi đổi công ty mẹ; lưu.
- Kết quả đầu ra: Công ty mới trên cây tập đoàn; danh sách công ty dạng cây.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_01
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_01, QUYTAC_NGHIEPVU_02, QUYTAC_NGHIEPVU_03, QUYTAC_NGHIEPVU_04
- Trường hợp ngoại lệ: Ngừng hoạt động công ty còn chi nhánh đang hoạt động thì từ chối.
- Phân quyền: Chỉ quản trị tập đoàn.
- Thông báo lỗi: "Mã công ty đã tồn tại." · "Mã số thuế đã được dùng cho công ty khác." · "Không thể chọn công ty con làm công ty mẹ." · "Công ty còn chi nhánh đang hoạt động."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_01, TIEUCHI_NGHIEMTHU_02, TIEUCHI_NGHIEMTHU_03
- Bổ sung CONG_VIEC_14: đổi chế độ kế toán khi công ty đã có bút toán thì từ chối, lỗi tại `accountingRegime` "Công ty đã có bút toán, không đổi được chế độ kế toán."; đã khởi tạo kế toán nhưng chưa có bút toán thì bỏ khởi tạo (QUYTAC_NGHIEPVU_93, CHUC_NANG_69).

### CHUC_NANG_02: Quản lý chi nhánh
- Mục đích: Tạo, sửa, ngừng hoạt động chi nhánh của một công ty.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.branch.manage` trong công ty.
- Dữ liệu đầu vào: Mã, tên, loại (trụ sở, văn phòng, kho, cửa hàng, khác), tỉnh thành, địa chỉ, điện thoại.
- Quy trình xử lý: Kiểm tra trùng mã trong công ty; lưu.
- Kết quả đầu ra: Chi nhánh mới; danh sách chi nhánh lọc theo loại, trạng thái.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_02
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_02, QUYTAC_NGHIEPVU_03
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Quản trị công ty chỉ thao tác trong công ty mình.
- Thông báo lỗi: "Mã chi nhánh đã tồn tại trong công ty."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_04

### CHUC_NANG_03: Quản lý phòng ban
- Mục đích: Tạo, sửa, ngừng hoạt động phòng ban dạng cây; chỉ định trưởng phòng.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.department.manage` trong công ty.
- Dữ liệu đầu vào: Phòng ban cha, mã, tên, trưởng phòng (nhân viên thuộc công ty).
- Quy trình xử lý: Kiểm tra trùng mã, không tạo vòng, trưởng phòng thuộc công ty; lưu.
- Kết quả đầu ra: Cây phòng ban của công ty.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_03
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_02, QUYTAC_NGHIEPVU_03, QUYTAC_NGHIEPVU_04
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Quản trị công ty chỉ thao tác trong công ty mình.
- Thông báo lỗi: "Mã phòng ban đã tồn tại trong công ty." · "Không thể chọn phòng ban con làm phòng ban cha." · "Trưởng phòng phải là nhân viên của công ty."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_05

### CHUC_NANG_04: Mời và kích hoạt nhân viên
- Mục đích: Đưa nhân viên mới vào hệ thống.
- Người sử dụng: Quản trị công ty (mời), nhân viên (kích hoạt).
- Điều kiện thực hiện: Có quyền `platform.user.invite` trong công ty.
- Dữ liệu đầu vào: Họ tên; email hoặc số điện thoại (bắt buộc một trong hai, THAY_DOI_07); tên đăng nhập (không bắt buộc); chi nhánh mặc định; phòng ban; chức danh; vai trò ban đầu.
- Quy trình xử lý: Theo luồng 1 tài liệu `09`. Nhân viên đã có tài khoản ở công ty khác thì thêm vào công ty này, không tạo tài khoản mới.
- Kết quả đầu ra: Tài khoản "Đã mời"; đường dẫn kích hoạt gửi qua email hoặc SMS; sau kích hoạt là "Đang hoạt động".
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_04, YCAU_NGHIEPVU_07
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_05, QUYTAC_NGHIEPVU_06, QUYTAC_NGHIEPVU_07
- Trường hợp ngoại lệ: Đường dẫn hết hạn hoặc đã dùng thì hiện thông báo, quản trị gửi lại.
- Phân quyền: Quản trị công ty chỉ mời vào công ty mình.
- Thông báo lỗi: "Email đã được dùng cho tài khoản khác." · "Số điện thoại đã được dùng cho tài khoản khác." · "Đường dẫn kích hoạt đã hết hạn hoặc đã được dùng." · "Mật khẩu phải có ít nhất 10 ký tự."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_06, TIEUCHI_NGHIEMTHU_07, TIEUCHI_NGHIEMTHU_08

### CHUC_NANG_05: Nhập nhân viên từ tệp Excel
- Mục đích: Mời nhiều nhân viên một lần.
- Người sử dụng: Quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.user.invite` trong công ty.
- Dữ liệu đầu vào: Tệp Excel theo mẫu tải về từ hệ thống; tối đa 1.000 dòng.
- Quy trình xử lý: Kiểm tra từng dòng như CHUC_NANG_04; dòng đúng thì mời, dòng lỗi thì bỏ qua.
- Kết quả đầu ra: Số dòng thành công, số dòng lỗi; tệp danh sách dòng lỗi kèm lý do.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_18
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_05
- Trường hợp ngoại lệ: Tệp sai mẫu hoặc quá 1.000 dòng thì từ chối cả tệp.
- Phân quyền: Như CHUC_NANG_04.
- Thông báo lỗi: "Tệp không đúng mẫu." · "Tệp vượt quá 1.000 dòng."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_09

### CHUC_NANG_06: Đăng nhập bằng mật khẩu và đặt lại mật khẩu
- Mục đích: Nhân viên đăng nhập bằng tên đăng nhập hoặc email và mật khẩu; đặt lại khi quên.
- Người sử dụng: Mọi nhân viên.
- Điều kiện thực hiện: Tài khoản "Đang hoạt động".
- Dữ liệu đầu vào: Tên đăng nhập hoặc email; mật khẩu.
- Quy trình xử lý: Theo luồng 2 tài liệu `09`. Đặt lại mật khẩu: nhập email hoặc số điện thoại, nhận đường dẫn dùng một lần hết hạn sau 1 giờ, đặt mật khẩu mới, thu hồi mọi phiên cũ.
- Kết quả đầu ra: Phiên làm việc; mở công ty mặc định.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_07, QUYTAC_NGHIEPVU_10
- Trường hợp ngoại lệ: Sai 5 lần liên tiếp thì khóa 15 phút. Yêu cầu đặt lại cho email không tồn tại vẫn hiện cùng thông báo thành công.
- Phân quyền: Không cần quyền.
- Thông báo lỗi: "Thông tin đăng nhập không đúng." · "Tài khoản tạm khóa, thử lại sau 15 phút."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_10, TIEUCHI_NGHIEMTHU_11, TIEUCHI_NGHIEMTHU_12

### CHUC_NANG_07: Đăng nhập bằng Google, Microsoft
- Mục đích: Đăng nhập bằng tài khoản email công ty.
- Người sử dụng: Mọi nhân viên có email công ty.
- Điều kiện thực hiện: Email trả về đã gắn với tài khoản "Đang hoạt động".
- Dữ liệu đầu vào: Kết quả xác thực OpenID Connect từ Google hoặc Microsoft.
- Quy trình xử lý: Lần đầu: gắn cách đăng nhập vào tài khoản có cùng email. Các lần sau: tìm theo mã định danh của nhà cung cấp.
- Kết quả đầu ra: Phiên làm việc.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_08
- Trường hợp ngoại lệ: Email chưa được mời thì từ chối.
- Phân quyền: Không cần quyền.
- Thông báo lỗi: "Email này chưa được cấp quyền truy cập. Liên hệ quản trị."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_13

### CHUC_NANG_08: Đăng nhập bằng số điện thoại
- Mục đích: Nhân viên không có email công ty đăng nhập bằng mã OTP qua Zalo hoặc SMS (THAY_DOI_08).
- Người sử dụng: Nhân viên kho, cửa hàng.
- Điều kiện thực hiện: Số điện thoại gắn với tài khoản "Đang hoạt động".
- Dữ liệu đầu vào: Số điện thoại; mã OTP 6 chữ số.
- Quy trình xử lý: Gửi mã OTP hiệu lực 5 phút; tối đa 5 lần nhập sai mỗi mã; tối đa 5 lần gửi mỗi giờ cho một số. Mã gửi qua eSMS.vn theo kênh đa kênh: Zalo ZNS trước, không được thì SMS; chưa cài mẫu tin ZNS mã OTP thì gửi SMS (QUYTAC_NGHIEPVU_32). Chưa cài eSMS thì thẻ "Số điện thoại" ẩn trên MAN_HINH_01.
- Kết quả đầu ra: Phiên làm việc.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_10, QUYTAC_NGHIEPVU_32
- Trường hợp ngoại lệ: Số chưa gắn với tài khoản thì vẫn hiện "Đã gửi mã" nhưng không gửi.
- Phân quyền: Không cần quyền.
- Thông báo lỗi: "Mã không đúng hoặc đã hết hạn." · "Bạn đã yêu cầu quá nhiều mã, thử lại sau."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14, TIEUCHI_NGHIEMTHU_51

### CHUC_NANG_09: Xác thực hai lớp
- Mục đích: Bảo vệ tài khoản có quyền nhạy cảm.
- Người sử dụng: Nhân viên có quyền nhạy cảm; nhân viên tự bật.
- Điều kiện thực hiện: Đã đăng nhập bước một.
- Dữ liệu đầu vào: Mã từ ứng dụng xác thực (TOTP) hoặc mã OTP qua SMS, email.
- Quy trình xử lý: Bắt buộc theo QUYTAC_NGHIEPVU_09; chưa đăng ký thì đăng ký ngay sau bước một; cấp 10 mã dự phòng dùng một lần.
- Kết quả đầu ra: Phiên được đánh dấu đã xác thực hai lớp.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_06
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_09
- Trường hợp ngoại lệ: Mất thiết bị: dùng mã dự phòng hoặc quản trị đặt lại xác thực hai lớp.
- Phân quyền: Đặt lại xác thực hai lớp của người khác cần quyền `platform.user.reset_mfa`.
- Thông báo lỗi: "Mã xác thực không đúng."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_15, TIEUCHI_NGHIEMTHU_16

### CHUC_NANG_10: Hồ sơ cá nhân
- Mục đích: Nhân viên tự quản lý thông tin đăng nhập và tùy chọn.
- Người sử dụng: Mọi nhân viên.
- Điều kiện thực hiện: Đã đăng nhập.
- Dữ liệu đầu vào: Ngôn ngữ (tiếng Việt, tiếng Anh); mật khẩu cũ và mới; bật, tắt xác thực hai lớp; liên kết Google, Microsoft, Zalo; thu hồi phiên.
- Quy trình xử lý: Lưu tùy chọn; đổi mật khẩu thì thu hồi các phiên khác; không tắt được xác thực hai lớp khi đang bắt buộc.
- Kết quả đầu ra: Giao diện đổi ngôn ngữ ngay; danh sách phiên đang đăng nhập (thiết bị, địa chỉ IP, thời điểm).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05, YCAU_NGHIEPVU_06, YCAU_NGHIEPVU_17
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_07, QUYTAC_NGHIEPVU_09
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Chỉ hồ sơ của chính mình.
- Thông báo lỗi: "Mật khẩu hiện tại không đúng." · "Tài khoản của bạn bắt buộc xác thực hai lớp."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_17, TIEUCHI_NGHIEMTHU_18

### CHUC_NANG_11: Chuyển công ty
- Mục đích: Nhân viên thuộc nhiều công ty làm việc với công ty khác.
- Người sử dụng: Nhân viên thuộc từ 2 công ty.
- Điều kiện thực hiện: Đã đăng nhập; thuộc công ty đích.
- Dữ liệu đầu vào: Công ty đích; tùy chọn đặt làm mặc định.
- Quy trình xử lý: Theo luồng 3 tài liệu `09`.
- Kết quả đầu ra: Trang chủ của công ty đích; quyền theo công ty đích.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_07
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_13
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Chỉ công ty nhân viên thuộc về.
- Thông báo lỗi: "Bạn không thuộc công ty này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_19, TIEUCHI_NGHIEMTHU_20

### CHUC_NANG_12: Quản lý vai trò
- Mục đích: Tạo, sửa, ngừng dùng vai trò và chọn quyền cho vai trò.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.role.manage`.
- Dữ liệu đầu vào: Mã, tên tiếng Việt, tên tiếng Anh, mô tả, danh sách quyền (ma trận theo mini app).
- Quy trình xử lý: Vai trò dùng chung tập đoàn chỉ quản trị tập đoàn tạo; vai trò hệ thống không xóa, không sửa mã.
- Kết quả đầu ra: Vai trò và ma trận quyền.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_08
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_01, QUYTAC_NGHIEPVU_14
- Trường hợp ngoại lệ: Sửa quyền của vai trò đang được gán thì quyền mới áp dụng ngay cho mọi người có vai trò đó.
- Phân quyền: Quản trị công ty chỉ thêm quyền mình có.
- Thông báo lỗi: "Mã vai trò đã tồn tại." · "Không thể thay đổi vai trò hệ thống." · "Bạn không thể cấp quyền mình không có."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_21, TIEUCHI_NGHIEMTHU_22

### CHUC_NANG_13: Gán vai trò
- Mục đích: Cấp quyền cho nhân viên trong một phạm vi.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.role.assign`.
- Dữ liệu đầu vào: Nhân viên, vai trò, phạm vi (tập đoàn, công ty, chi nhánh), ngày bắt đầu, ngày kết thúc.
- Quy trình xử lý: Theo luồng 4 tài liệu `09`.
- Kết quả đầu ra: Lần gán vai trò; danh sách vai trò của nhân viên theo công ty.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_07, YCAU_NGHIEPVU_08
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_09, QUYTAC_NGHIEPVU_11, QUYTAC_NGHIEPVU_12, QUYTAC_NGHIEPVU_13, QUYTAC_NGHIEPVU_14, QUYTAC_NGHIEPVU_15
- Trường hợp ngoại lệ: Ngày kết thúc trước ngày bắt đầu thì từ chối.
- Phân quyền: Quản trị công ty chỉ gán phạm vi công ty mình hoặc chi nhánh của công ty mình.
- Thông báo lỗi: "Ngày kết thúc phải sau ngày bắt đầu." · "Bạn không thể gán vai trò ngoài công ty của mình."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_23, TIEUCHI_NGHIEMTHU_24, TIEUCHI_NGHIEMTHU_25, TIEUCHI_NGHIEMTHU_26

### CHUC_NANG_14: Trang chủ mini app
- Mục đích: Điểm vào chung của mọi mini app.
- Người sử dụng: Mọi nhân viên.
- Điều kiện thực hiện: Đã đăng nhập.
- Dữ liệu đầu vào: Công ty đang chọn.
- Quy trình xử lý: Lấy các mini app có quyền `<app>.access` (QUYTAC_NGHIEPVU_16), sắp theo thứ tự cấu hình; lấy số việc chờ của từng mini app.
- Kết quả đầu ra: Lưới mini app (biểu tượng, tên theo ngôn ngữ, số việc chờ); thanh trên cùng gồm chuyển mini app, chuyển công ty, thông báo, hộp duyệt, hồ sơ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_09
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_16
- Trường hợp ngoại lệ: Không có mini app nào thì hiện "Bạn chưa được cấp quyền dùng ứng dụng nào. Liên hệ quản trị."
- Phân quyền: Theo quyền của nhân viên.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_27

### CHUC_NANG_15: Cấu hình chính sách duyệt
- Mục đích: Đặt các cấp duyệt theo hạn mức cho từng loại chứng từ.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.approval_policy.manage`.
- Dữ liệu đầu vào: Loại chứng từ; tiền tệ so ngưỡng; ngày hiệu lực; mỗi cấp: thứ tự, ngưỡng, người duyệt (vai trò, nhân viên cụ thể hoặc trưởng phòng của người lập), người duyệt thay thế, thời hạn xử lý (giờ).
- Quy trình xử lý: Ngưỡng tăng dần theo thứ tự cấp; bắt buộc có người duyệt thay thế; chính sách mới có hiệu lực từ ngày chọn, chính sách cũ tự kết thúc ngày trước đó.
- Kết quả đầu ra: Chính sách đang hiệu lực và lịch sử chính sách.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_10, YCAU_NGHIEPVU_11
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_17, QUYTAC_NGHIEPVU_20, QUYTAC_NGHIEPVU_21
- Trường hợp ngoại lệ: Yêu cầu đang chờ giữ nguyên chính sách lúc gửi.
- Phân quyền: Quản trị công ty chỉ trong công ty mình.
- Thông báo lỗi: "Ngưỡng của cấp sau phải lớn hơn cấp trước." · "Mỗi cấp phải có người duyệt thay thế."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_28

### CHUC_NANG_16: Gửi duyệt và xử lý yêu cầu duyệt
- Mục đích: Đưa chứng từ của mọi mini app qua các cấp duyệt.
- Người sử dụng: Người lập (qua mini app sở hữu), người duyệt.
- Điều kiện thực hiện: Loại chứng từ cần duyệt; công ty có chính sách hiệu lực.
- Dữ liệu đầu vào: Loại chứng từ, mã chứng từ, số chứng từ, giá trị, tiền tệ, ngày lập; quyết định đồng ý hoặc từ chối kèm ý kiến.
- Quy trình xử lý: Theo luồng 5 tài liệu `09`.
- Kết quả đầu ra: Yêu cầu duyệt và các bước; sự kiện báo mini app sở hữu khi kết thúc.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_10, YCAU_NGHIEPVU_11
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_17, QUYTAC_NGHIEPVU_18, QUYTAC_NGHIEPVU_19, QUYTAC_NGHIEPVU_20, QUYTAC_NGHIEPVU_22, QUYTAC_NGHIEPVU_23, QUYTAC_NGHIEPVU_24, QUYTAC_NGHIEPVU_25
- Trường hợp ngoại lệ: Từ chối bắt buộc nhập ý kiến.
- Phân quyền: Chỉ người duyệt của cấp hiện tại quyết định được; chỉ người lập rút lại được.
- Thông báo lỗi: "Chưa có chính sách duyệt cho loại chứng từ này." · "Chưa có tỷ giá hạch toán ngày lập chứng từ." · "Chứng từ đang chờ duyệt." · "Không thể rút lại vì đã có cấp duyệt." · "Vui lòng nhập lý do từ chối."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_29, TIEUCHI_NGHIEMTHU_30, TIEUCHI_NGHIEMTHU_31, TIEUCHI_NGHIEMTHU_32, TIEUCHI_NGHIEMTHU_33, TIEUCHI_NGHIEMTHU_34

### CHUC_NANG_17: Hộp duyệt
- Mục đích: Một nơi xem và duyệt mọi chứng từ đang chờ mình.
- Người sử dụng: Người duyệt.
- Điều kiện thực hiện: Đã đăng nhập.
- Dữ liệu đầu vào: Bộ lọc công ty, mini app, loại chứng từ, quá hạn.
- Quy trình xử lý: Liệt kê yêu cầu đang chờ nhân viên ở cấp hiện tại, mọi công ty nhân viên thuộc về; mở chi tiết chứng từ ở mini app sở hữu; đồng ý, từ chối ngay trong hộp.
- Kết quả đầu ra: Danh sách sắp theo thời điểm gửi, đánh dấu quá hạn.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_12
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_20, QUYTAC_NGHIEPVU_21
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Chỉ yêu cầu chờ chính nhân viên.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_35

### CHUC_NANG_18: Nhắc và chuyển duyệt quá hạn
- Mục đích: Không để chứng từ chờ quá lâu.
- Người sử dụng: Hệ thống (tác vụ nền mỗi 15 phút).
- Điều kiện thực hiện: Có yêu cầu đang chờ.
- Dữ liệu đầu vào: Thời điểm cấp hiện tại bắt đầu; thời hạn xử lý của cấp.
- Quy trình xử lý: Quá thời hạn: gửi nhắc người duyệt (một lần). Quá gấp đôi thời hạn: chuyển cấp đó sang người duyệt thay thế, báo cả hai người.
- Kết quả đầu ra: Thông báo nhắc; bước duyệt đổi người duyệt, ghi nhật ký.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_11
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_21
- Trường hợp ngoại lệ: Người thay thế cũng là người lập thì không chuyển, báo quản trị công ty.
- Phân quyền: Không áp dụng.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_36

### CHUC_NANG_19: Khóa, mở khóa, vô hiệu hóa nhân viên
- Mục đích: Chặn truy cập tạm thời hoặc khi nghỉ việc.
- Người sử dụng: Quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.user.manage` trong công ty.
- Dữ liệu đầu vào: Nhân viên; lý do; người nhận bàn giao cho từng việc (khi vô hiệu hóa).
- Quy trình xử lý: Khóa: chặn đăng nhập, thu hồi phiên. Vô hiệu hóa: theo luồng 6 tài liệu `09`. Nhân viên thuộc nhiều công ty: vô hiệu hóa ở một công ty chỉ gỡ khỏi công ty đó; gỡ khỏi công ty cuối cùng thì tài khoản "Đã vô hiệu hóa".
- Kết quả đầu ra: Trạng thái tài khoản mới; việc đã chuyển cho người nhận.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_13
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_26, QUYTAC_NGHIEPVU_27
- Trường hợp ngoại lệ: Không tự khóa, tự vô hiệu hóa chính mình.
- Phân quyền: Quản trị công ty chỉ trong công ty mình.
- Thông báo lỗi: "Cần chọn người nhận bàn giao trước khi vô hiệu hóa." · "Bạn không thể khóa tài khoản của chính mình."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_37, TIEUCHI_NGHIEMTHU_38

### CHUC_NANG_20: Dãy số chứng từ
- Mục đích: Cấu hình và cấp số chứng từ tự động.
- Người sử dụng: Quản trị công ty (cấu hình); mini app (lấy số).
- Điều kiện thực hiện: Có quyền `platform.number_sequence.manage` để cấu hình.
- Dữ liệu đầu vào: Loại chứng từ, tiền tố, kiểu đặt lại (năm, tháng, không), số chữ số.
- Quy trình xử lý: Theo luồng 7 tài liệu `09`.
- Kết quả đầu ra: Số chứng từ dạng `PN-VCR-2026-000123`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_14
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_28
- Trường hợp ngoại lệ: Đổi tiền tố chỉ áp dụng cho số cấp sau đó.
- Phân quyền: Quản trị công ty chỉ trong công ty mình.
- Thông báo lỗi: "Tiền tố chỉ gồm chữ in hoa và chữ số."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_39, TIEUCHI_NGHIEMTHU_40

### CHUC_NANG_21: Tiền tệ và tỷ giá
- Mục đích: Cung cấp tỷ giá cho duyệt chứng từ và kế toán.
- Người sử dụng: Quản lý tỷ giá; hệ thống (lấy tự động mỗi sáng).
- Điều kiện thực hiện: Có quyền `platform.exchange_rate.manage` để nhập tay.
- Dữ liệu đầu vào: Ngày, tiền tệ nguồn, tiền tệ đích, loại (mua, bán, chuyển khoản, hạch toán), nguồn, giá trị.
- Quy trình xử lý: Theo luồng 8 tài liệu `09`.
- Kết quả đầu ra: Bảng tỷ giá theo ngày; tra cứu tỷ giá của một ngày.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_15
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_29
- Trường hợp ngoại lệ: Lấy tự động lỗi thì báo quản lý tỷ giá.
- Phân quyền: Chỉ quản lý tỷ giá, quản trị tập đoàn sửa được; mọi nhân viên xem được.
- Thông báo lỗi: "Tỷ giá phải lớn hơn 0." · "Đã có tỷ giá cho ngày, cặp tiền tệ, loại và nguồn này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_41

### CHUC_NANG_22: Đổi ngôn ngữ giao diện
- Mục đích: Dùng hệ thống bằng tiếng Việt hoặc tiếng Anh.
- Người sử dụng: Mọi nhân viên.
- Điều kiện thực hiện: Không cần đăng nhập ở trang đăng nhập; sau đăng nhập lưu theo hồ sơ.
- Dữ liệu đầu vào: Ngôn ngữ.
- Quy trình xử lý: Mọi chữ trên giao diện, thông báo lỗi, email, SMS theo ngôn ngữ đã chọn.
- Kết quả đầu ra: Giao diện đổi ngôn ngữ không cần tải lại dữ liệu.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_17
- Quy tắc nghiệp vụ: Không có.
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Không cần quyền.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_42

### CHUC_NANG_23: Nhật ký thao tác
- Mục đích: Lưu và tra cứu ai làm gì, lúc nào.
- Người sử dụng: Hệ thống (ghi); quản trị (tra cứu).
- Điều kiện thực hiện: Có quyền `platform.audit.view` để tra cứu.
- Dữ liệu đầu vào: Bộ lọc người làm, mini app, đối tượng, hành động, khoảng thời gian.
- Quy trình xử lý: Ghi một dòng cho mỗi thao tác ghi dữ liệu và mỗi lần đăng nhập thành công, thất bại; tra cứu có phân trang.
- Kết quả đầu ra: Danh sách nhật ký; chi tiết dữ liệu trước và sau.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_16
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_30
- Trường hợp ngoại lệ: Không có.
- Phân quyền: Quản trị tập đoàn xem toàn tập đoàn; quản trị công ty xem công ty mình.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_43, TIEUCHI_NGHIEMTHU_44

### CHUC_NANG_24: Liên kết và đăng nhập bằng Zalo
- Mục đích: Nhân viên đăng nhập bằng tài khoản Zalo đã liên kết.
- Người sử dụng: Mọi nhân viên.
- Điều kiện thực hiện: Liên kết: đã đăng nhập bằng cách khác, tài khoản "Đang hoạt động". Đăng nhập: tài khoản Zalo đã được liên kết.
- Dữ liệu đầu vào: Kết quả ủy quyền OAuth 2.0 từ Zalo (mã định danh người dùng Zalo, tên, ảnh đại diện).
- Quy trình xử lý: Liên kết: từ hồ sơ cá nhân bấm "Liên kết Zalo", đồng ý trên Zalo, hệ thống lưu mã định danh Zalo vào tài khoản. Đăng nhập: bấm "Đăng nhập bằng Zalo", tìm tài khoản theo mã định danh Zalo, tiếp tục luồng 2 tài liệu `09` (xác thực hai lớp nếu bắt buộc). Hủy liên kết: từ hồ sơ cá nhân.
- Kết quả đầu ra: Phiên làm việc; trạng thái liên kết Zalo trong hồ sơ cá nhân.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_08
- Trường hợp ngoại lệ: Tài khoản Zalo đã liên kết với nhân viên khác thì từ chối liên kết. Hủy liên kết khi Zalo là cách đăng nhập duy nhất thì từ chối.
- Phân quyền: Chỉ liên kết, hủy liên kết cho chính mình.
- Thông báo lỗi: "Tài khoản Zalo này chưa được liên kết. Đăng nhập bằng cách khác rồi liên kết trong hồ sơ cá nhân." · "Tài khoản Zalo này đã được liên kết với tài khoản khác." · "Bạn cần giữ ít nhất một cách đăng nhập."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_46, TIEUCHI_NGHIEMTHU_47

### CHUC_NANG_25: Cài đặt tích hợp
- Mục đích: Quản trị tập đoàn tự nhập mã ứng dụng Google, Microsoft, Zalo và khóa eSMS.vn (SMS, Zalo ZNS) mà không cần sửa mã, không cần khởi động lại.
- Người sử dụng: Quản trị tập đoàn.
- Điều kiện thực hiện: Có quyền `platform.integration.manage` (nhạy cảm) phạm vi tập đoàn.
- Dữ liệu đầu vào: Google: Client ID, Client secret. Microsoft: Application (client) ID, Client secret, tenant (để trống là `organizations`). Zalo: App ID, Secret key. eSMS.vn: API key, Secret key, Brandname SMS, mã Zalo OA (OAID), chế độ thử, mã mẫu ZNS cho mã OTP đăng nhập, có chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt.
- Quy trình xử lý: Lưu khóa bí mật đã mã hóa; ô khóa bí mật để trống thì giữ giá trị cũ, muốn xóa phải chọn "Xóa khóa"; ô giá trị thường để trống thì xóa. Ghi nhật ký thao tác chỉ với 4 ký tự cuối của khóa bí mật. Nút "Kiểm tra kết nối eSMS" gọi eSMS.vn bằng khóa đã lưu và liệt kê Zalo OA của tài khoản. Hiện đường dẫn chuyển hướng cần khai báo ở Google, Microsoft, Zalo và 50 tin gửi gần nhất.
- Kết quả đầu ra: Cài đặt có hiệu lực ngay ở lần gọi nhà cung cấp tiếp theo; MAN_HINH_01 hiện nút đăng nhập của nhà cung cấp đã cài đủ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_19
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_31
- Trường hợp ngoại lệ: Khóa cài đặt không có trong danh sách thì từ chối. Kiểm tra kết nối khi chưa nhập API key, Secret key thì báo chưa cài.
- Phân quyền: Chỉ quản trị tập đoàn.
- Thông báo lỗi: "Bạn không có quyền thực hiện thao tác này." · "Chưa nhập API key, Secret key của eSMS." · "Kết nối eSMS thất bại." kèm lỗi nhà cung cấp.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_48, TIEUCHI_NGHIEMTHU_49

### CHUC_NANG_26: Thông báo Zalo ZNS
- Mục đích: Người duyệt, người lập nhận thông báo duyệt qua Zalo.
- Người sử dụng: Hệ thống (gửi khi đẩy sự kiện outbox); người nhận là mọi nhân viên có số điện thoại.
- Điều kiện thực hiện: Đã cài API key, Secret key, mã Zalo OA và mã mẫu tin của sự kiện (CHUC_NANG_25); người nhận đang hoạt động, có số điện thoại.
- Dữ liệu đầu vào: Thông báo trong ứng dụng loại có chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt (CHUC_NANG_16, CHUC_NANG_18). Tham số mẫu tin: `document_no`, `document_type`, `amount` (dạng `80.000.000 VND`), `requester`, `result`.
- Quy trình xử lý: Sau khi giao dịch duyệt ghi xong, mỗi thông báo gửi đúng một tin ZNS theo mẫu của sự kiện; ghi nhật ký gửi tin (số điện thoại che giữa). Gửi lỗi chỉ ghi trạng thái lỗi, không gửi lại để tránh trùng.
- Kết quả đầu ra: Tin Zalo ZNS; dòng nhật ký gửi tin xem ở MAN_HINH_19.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_20
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_32
- Trường hợp ngoại lệ: Chưa cài mẫu tin hoặc người nhận không có số điện thoại thì bỏ qua, thông báo trong ứng dụng vẫn có. eSMS lỗi thì luồng duyệt vẫn chạy.
- Phân quyền: Không áp dụng.
- Thông báo lỗi: Không có (lỗi ghi ở nhật ký gửi tin).
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_50

### CHUC_NANG_27: Mẫu đề xuất
- Mục đích: Quản trị tạo mẫu đề xuất (phiếu chi, tạm ứng, mua sắm...) để nhân viên lập đề xuất.
- Người sử dụng: Quản trị tập đoàn, quản trị công ty.
- Điều kiện thực hiện: Có quyền `platform.proposal_template.manage` trong công ty.
- Dữ liệu đầu vào: Mã mẫu (chữ in hoa và số, tối đa 10 ký tự, dùng làm tiền tố số đề xuất), tên tiếng Việt, tên tiếng Anh, mô tả, tiền tệ, danh sách trường (1 đến 30 trường; mỗi trường: mã, nhãn, kiểu chữ, đoạn văn, số, tiền, ngày, danh sách chọn, bảng chi tiết; bắt buộc hay không; lựa chọn; cột của bảng), trường giá trị duyệt, trạng thái đang dùng hoặc ngừng dùng.
- Quy trình xử lý: Tạo mẫu thì tạo kèm loại chứng từ cần duyệt `platform.proposal_<mã công ty>_<mã mẫu>` và dãy số chứng từ (tiền tố là mã mẫu, đặt lại theo năm, 6 chữ số). Nút "Thêm 3 mẫu có sẵn" tạo Phiếu đề nghị chi (PC), Đề nghị tạm ứng (TU), Đề nghị mua sắm (MS); gọi lại không tạo trùng. Giá trị duyệt là trường tiền được chọn, hoặc tổng cột thành tiền (`amount`) của bảng chi tiết. Sửa mẫu không đổi đề xuất đã lập.
- Kết quả đầu ra: Danh sách mẫu kèm trạng thái và nhãn đã có hay chưa có chính sách duyệt.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_21
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_33
- Trường hợp ngoại lệ: Mẫu chưa có chính sách duyệt thì nhân viên lập nháp được nhưng chưa gửi được.
- Phân quyền: Quản trị công ty chỉ trong công ty mình.
- Thông báo lỗi: "Mã mẫu đã có trong công ty." · "Giá trị không hợp lệ." (mã trường trùng, danh sách chọn thiếu lựa chọn, trường giá trị duyệt không phải trường tiền).
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_52

### CHUC_NANG_28: Lập và gửi đề xuất
- Mục đích: Nhân viên lập đề xuất theo mẫu, đính kèm chứng từ gốc, gửi đi duyệt.
- Người sử dụng: Mọi nhân viên (người lập); người duyệt, quản trị (xem).
- Điều kiện thực hiện: Có quyền `platform.proposal.create` trong công ty; mẫu đang dùng.
- Dữ liệu đầu vào: Mẫu, tiêu đề, giá trị các trường theo mẫu; tệp đính kèm.
- Quy trình xử lý: Lưu nháp kiểm tra kiểu từng trường; gửi duyệt kiểm thêm trường bắt buộc, cấp số đề xuất từ dãy số chứng từ và gửi yêu cầu duyệt (CHUC_NANG_16) với giá trị duyệt trong cùng một giao dịch; lỗi thì số không bị dùng. Duyệt xong, bị từ chối hoặc rút ở luồng duyệt thì trạng thái đề xuất đổi theo. Danh sách "Đề xuất của tôi"; người quản lý mẫu xem thêm "Toàn công ty".
- Kết quả đầu ra: Đề xuất kèm số `<mã mẫu>-<mã công ty>-<kỳ>-<số thứ tự>` (ví dụ `PC-VCR-2026-000001`), trạng thái, tiến trình duyệt, tệp đính kèm.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_21
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_33, QUYTAC_NGHIEPVU_34, QUYTAC_NGHIEPVU_35, QUYTAC_NGHIEPVU_36, QUYTAC_NGHIEPVU_28
- Trường hợp ngoại lệ: Sửa, xóa, thêm, xóa tệp khi đề xuất không còn Nháp thì từ chối. Rút được khi cấp 1 chưa quyết định (QUYTAC_NGHIEPVU_23). Tiền VND không có phần lẻ.
- Phân quyền: Chỉ người lập sửa, xóa, gửi, rút. Người xem được đề xuất theo QUYTAC_NGHIEPVU_36; người khác nhận "Không tìm thấy".
- Thông báo lỗi: "Vui lòng nhập thông tin này." · "Giá trị không hợp lệ." · "Chỉ sửa được đề xuất đang ở trạng thái nháp." · "Chưa có chính sách duyệt cho loại chứng từ này." · "Mỗi đề xuất có tối đa 10 tệp đính kèm." · "Tệp vượt quá 10 MB." · "Chỉ nhận tệp PDF, JPG, PNG, XLSX, DOCX."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_52, TIEUCHI_NGHIEMTHU_53, TIEUCHI_NGHIEMTHU_54

### CHUC_NANG_29: In đề xuất PDF
- Mục đích: In đề xuất để lưu hồ sơ, trình ký giấy.
- Người sử dụng: Người xem được đề xuất (QUYTAC_NGHIEPVU_36).
- Điều kiện thực hiện: Đã đăng nhập; xem được đề xuất.
- Dữ liệu đầu vào: Đề xuất.
- Quy trình xử lý: Dựng tệp PDF theo một bố cục chuẩn cho mọi mẫu: tên công ty, tên mẫu, số đề xuất, ngày, trạng thái, các trường, bảng chi tiết, giá trị duyệt, các cấp duyệt (người duyệt, quyết định, ý kiến, thời điểm). Không tải tài nguyên ngoài.
- Kết quả đầu ra: Tệp PDF tiếng Việt đúng dấu, mở ngay trên trình duyệt.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_21
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_36
- Trường hợp ngoại lệ: Đề xuất nháp in được, số hiện "(chưa gửi)".
- Phân quyền: Như xem đề xuất.
- Thông báo lỗi: "Không tìm thấy dữ liệu hoặc bạn không có quyền xem."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_55

## Yêu cầu phi chức năng của MODULE_01

| Nhóm | Yêu cầu |
|---|---|
| Hiệu năng | Đăng nhập, kiểm tra quyền trả lời dưới 200 mili giây ở phân vị 95 với 200 người dùng đồng thời; quyền lưu đệm, xóa đệm khi đổi vai trò |
| Bảo mật | Mật khẩu băm argon2id; bí mật xác thực hai lớp mã hóa bằng AWS KMS; chỉ lưu bản băm token làm mới; cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`; mọi kết nối qua HTTPS |
| Phiên | Token truy cập sống 15 phút; token làm mới theo QUYTAC_NGHIEPVU_10 |
| Giao diện | Dùng được trên màn hình từ 360 điểm ảnh |
| Ngôn ngữ | Mọi chuỗi giao diện nằm trong tệp dịch tiếng Việt, tiếng Anh |
| Lưu trữ | Nhật ký thao tác giữ tối thiểu 10 năm |

## MODULE_02 Sản phẩm và Nhà bán (phần Sản phẩm, CONG_VIEC_04)

Quy ước chung cho mọi chức năng của MODULE_02:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23), mini app `catalog`.
- Mọi API cần quyền `catalog.access` trong công ty đang làm việc; quyền chi tiết kiểm tra phía máy chủ. Dữ liệu của công ty khác trả "Không tìm thấy dữ liệu hoặc bạn không có quyền xem." như không tồn tại.
- Sửa dữ liệu gửi kèm phiên bản; khác phiên bản hiện tại thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền, hệ số lưu dạng số thập phân, trao đổi dạng chuỗi.

### CHUC_NANG_30: Ngành hàng và đơn vị tính
- Mục đích: Quản lý cây ngành hàng và danh mục đơn vị tính dùng chung tập đoàn.
- Người sử dụng: Quản trị tập đoàn (sửa); người có quyền vào mini app Sản phẩm (xem).
- Điều kiện thực hiện: Xem: `catalog.access`. Thêm, sửa, ngừng dùng: `catalog.category.manage` gán ở phạm vi tập đoàn.
- Dữ liệu đầu vào: Ngành hàng: ngành hàng cha, mã (2 đến 6 chữ in hoa hoặc số), tên tiếng Việt, tên tiếng Anh, theo dõi (không, lô và hạn dùng, serial), số tháng bảo hành (0 đến 120). Đơn vị tính: mã (chữ in hoa, số, gạch dưới, tối đa 10 ký tự), tên tiếng Việt, tên tiếng Anh.
- Quy trình xử lý: Kiểm tra trùng mã, cấp không quá 4 (tính cả nhánh con khi đổi ngành hàng cha), không tạo vòng, ngành hàng cha chưa có sản phẩm, không bật cùng lúc lô và serial; lưu; đổi ngành hàng cha thì tính lại cấp cả nhánh. Ngừng dùng, dùng lại thay cho xóa.
- Kết quả đầu ra: Cây ngành hàng kèm cấp, số sản phẩm, số ngành hàng con; danh sách đơn vị tính (có sẵn 14 đơn vị: Cái, Chiếc, Hộp, Thùng, Gói, Chai, Lon, Bộ, Kilôgam, Gam, Lít, Mililít, Mét, Mét vuông).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_22, YCAU_NGHIEPVU_23
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_37
- Trường hợp ngoại lệ: Ngành hàng ngừng dùng không chọn được cho sản phẩm mới; sản phẩm đã có giữ nguyên.
- Phân quyền: Chỉ quản trị tập đoàn sửa; quản trị công ty, Quản lý sản phẩm chỉ xem.
- Thông báo lỗi: "Mã ngành hàng đã có." · "Ngành hàng tối đa 4 cấp." · "Không chọn được ngành hàng con của chính nó làm ngành hàng cha." · "Ngành hàng này đã có sản phẩm nên không thêm được ngành hàng con." · "Ngành hàng đã có sản phẩm, không đổi được mã." · "Không theo dõi đồng thời lô và serial." · "Mã đơn vị tính đã có."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_56

### CHUC_NANG_31: Quản lý sản phẩm
- Mục đích: Lập và duy trì sản phẩm của công ty đủ thông tin cho Kho, Mua hàng, Bán hàng.
- Người sử dụng: Quản lý sản phẩm, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Xem: `catalog.product.view`. Thêm, sửa, ngừng bán, ảnh: `catalog.product.manage` trong công ty.
- Dữ liệu đầu vào: Ngành hàng lá, mã sản phẩm (để trống thì tự sinh), tên, mô tả, thương hiệu, xuất xứ, thuế suất, theo dõi lô hoặc serial, số tháng bảo hành, đơn vị cơ sở, trọng lượng (kg), thể tích (m³) của đơn vị cơ sở, thông số (tối đa 50 cặp tên, giá trị); ảnh JPG, PNG, WEBP.
- Quy trình xử lý: Chọn ngành hàng thì điền sẵn theo dõi, bảo hành của ngành hàng; kiểm tra theo quy tắc; lưu sản phẩm cùng biến thể, đơn vị, mã vạch (CHUC_NANG_32) trong một giao dịch. Tìm theo tên không dấu (cột `search_text`), mã sản phẩm, đúng mã hàng hoặc mã vạch; lọc ngành hàng, trạng thái; phân trang. Ảnh: kiểm tra đuôi tệp và chữ ký đầu tệp, tối đa 5 MB, 10 ảnh; ảnh đầu tiên là ảnh đại diện, chọn lại được; xóa ảnh.
- Kết quả đầu ra: Danh sách sản phẩm (ảnh đại diện, mã, tên, ngành hàng, đơn vị cơ sở, số biến thể đang bán, trạng thái, ngày cập nhật); chi tiết sản phẩm.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_22, YCAU_NGHIEPVU_23
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_38
- Trường hợp ngoại lệ: Ngừng bán thay cho xóa; bán lại được. Ngành hàng của sản phẩm đã ngừng dùng thì sản phẩm vẫn lưu được với ngành hàng đó.
- Phân quyền: Trong công ty đang làm việc; sản phẩm công ty khác trả "Không tìm thấy".
- Thông báo lỗi: "Chỉ chọn ngành hàng cuối cùng (không có ngành hàng con)." · "Mã sản phẩm đã có trong công ty." · "Không theo dõi đồng thời lô và serial." · "Chỉ nhận ảnh JPG, PNG, WEBP." · "Ảnh vượt quá 5 MB." · "Mỗi sản phẩm tối đa 10 ảnh."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_57, TIEUCHI_NGHIEMTHU_63, TIEUCHI_NGHIEMTHU_64

### CHUC_NANG_32: Biến thể, mã hàng, đơn vị quy đổi, mã vạch
- Mục đích: Mỗi biến thể có mã hàng riêng; mỗi đơn vị có hệ số và mã vạch.
- Người sử dụng: Quản lý sản phẩm, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `catalog.product.manage` trong công ty.
- Dữ liệu đầu vào: Tối đa 3 thuộc tính phân loại, mỗi thuộc tính tối đa 30 giá trị; danh sách biến thể (giá trị phân loại, mã hàng để trống thì tự sinh, đang bán hay ngừng bán, tối đa 20 mã vạch mỗi biến thể kèm đơn vị); tối đa 5 đơn vị quy đổi kèm hệ số.
- Quy trình xử lý: Giao diện tạo biến thể theo tổ hợp giá trị phân loại. Kiểm tra: biến thể khớp thuộc tính, không trùng tổ hợp, không quá 200; không phân loại thì đúng một biến thể; đơn vị quy đổi đang dùng, không trùng đơn vị cơ sở, hệ số lớn hơn 0; mã hàng, mã vạch không trùng trong sản phẩm và trong công ty; mã vạch thuộc đơn vị của sản phẩm. Sinh mã sản phẩm từ bộ đếm theo công ty và tiền tố, bỏ qua số đã bị dùng bằng mã nhập tay. Biến thể bị bỏ chuyển ngừng bán; mã vạch chuyển được giữa hai biến thể của cùng sản phẩm.
- Kết quả đầu ra: Biến thể kèm mã hàng, mã vạch; đơn vị quy đổi.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_23
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_39, QUYTAC_NGHIEPVU_40
- Trường hợp ngoại lệ: Lỗi chỉ ra đúng dòng biến thể, đúng dòng mã vạch, đúng dòng đơn vị.
- Phân quyền: Như CHUC_NANG_31.
- Thông báo lỗi: "Mã hàng đã có trong công ty." · "Mã vạch đã có trong công ty." · "Đơn vị tính không hợp lệ hoặc bị trùng." · "Biến thể không khớp thuộc tính phân loại." · "Biến thể bị trùng." · "Bị trùng." (tên, giá trị thuộc tính phân loại) · "Giá trị không hợp lệ." (hệ số)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_57, TIEUCHI_NGHIEMTHU_58

### CHUC_NANG_33: Nhập sản phẩm từ Excel
- Mục đích: Lập nhiều sản phẩm một lần.
- Người sử dụng: Quản lý sản phẩm, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `catalog.product.manage` trong công ty.
- Dữ liệu đầu vào: Tệp `.xlsx` theo mẫu tải về (17 cột: Mã sản phẩm, Tên sản phẩm, Mã ngành hàng, Mã đơn vị cơ sở, Thuế suất, Theo dõi, Bảo hành (tháng), Thương hiệu, Xuất xứ, Trọng lượng (kg), Thể tích (m3), Đơn vị quy đổi, Phân loại 1 đến 3, Mã hàng, Mã vạch); tối đa 2.000 dòng, 5 MB; mỗi dòng một biến thể.
- Quy trình xử lý: Kiểm tra dòng tiêu đề đúng mẫu. Gộp các dòng cùng mã sản phẩm (để trống mã thì cùng tên) thành một sản phẩm, thông tin chung lấy ở dòng đầu; phân loại ghi dạng "Màu: Đen"; đơn vị quy đổi dạng "THUNG=24; HOP=6"; theo dõi để trống thì theo ngành hàng; thuế suất 0, 5, 8, 10, KCT, KKKNT (để trống là 10). Mỗi sản phẩm kiểm tra và lưu trong giao dịch riêng như CHUC_NANG_31, 32; sản phẩm lỗi thì mọi dòng của sản phẩm đó vào tệp lỗi, sản phẩm đúng vẫn được nhập.
- Kết quả đầu ra: Số sản phẩm, số biến thể đã nhập, số dòng lỗi; danh sách dòng lỗi kèm lý do (chỉ ra cột hoặc dòng biến thể); tệp dòng lỗi (cột "Dòng", các cột gốc, "Lý do").
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_23
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_38, QUYTAC_NGHIEPVU_39, QUYTAC_NGHIEPVU_40
- Trường hợp ngoại lệ: Sai mẫu, quá 2.000 dòng, quá 5 MB thì từ chối cả tệp.
- Phân quyền: Trong công ty đang làm việc.
- Thông báo lỗi: "Tệp không đúng mẫu." · "Tệp vượt quá 5 MB." · "Không tìm thấy mã này." kèm tên cột · theo CHUC_NANG_31, 32. Quá 2.000 dòng hiện "Tệp vượt quá 1.000 dòng." (thông báo dùng chung với nhập nhân viên, sai số dòng).
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_59

### CHUC_NANG_34: Liên kết, sao chép sản phẩm giữa công ty
- Mục đích: Biết sản phẩm tương ứng ở công ty con khác để giao dịch nội bộ.
- Người sử dụng: Người có quyền quản lý sản phẩm ở cả hai công ty (thường là quản trị tập đoàn).
- Điều kiện thực hiện: Xem liên kết: `catalog.product.view`. Gợi ý: `catalog.product.view` ở cả hai công ty. Liên kết, bỏ liên kết, sao chép: `catalog.product.manage` ở cả hai công ty.
- Dữ liệu đầu vào: Liên kết: biến thể bên này, biến thể bên kia, hệ số (mặc định 1). Sao chép: công ty đích.
- Quy trình xử lý: Liên kết: kiểm tra hai biến thể khác công ty, mỗi biến thể chưa liên kết với công ty kia; lưu một chiều, đọc cả hai chiều (hệ số nghịch đảo khi đọc từ bên kia). Gợi ý: biến thể của công ty đích có cùng mã vạch, chưa liên kết. Sao chép: tạo sản phẩm mới ở công ty đích gồm thông tin chung, đơn vị, biến thể đang bán, mã vạch; giữ mã nếu chưa bị dùng; rồi liên kết từng biến thể hệ số 1, trong một giao dịch.
- Kết quả đầu ra: Danh sách liên kết của sản phẩm (mã hàng, công ty, sản phẩm tương ứng, hệ số); sản phẩm mới ở công ty đích.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_24
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_41
- Trường hợp ngoại lệ: Sản phẩm không còn biến thể đang bán thì không sao chép.
- Phân quyền: Thiếu quyền ở công ty bên kia thì từ chối.
- Thông báo lỗi: "Chọn công ty khác công ty đang làm việc." · "Biến thể đã liên kết với một biến thể của công ty đó." · "Bạn không có quyền thực hiện thao tác này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_60

### CHUC_NANG_35: Kênh bán và nhóm khách hàng
- Mục đích: Danh mục kênh bán, nhóm khách hàng của công ty để đặt bảng giá.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn (sửa); người có quyền xem giá (xem).
- Điều kiện thực hiện: Xem: `catalog.price.view`. Thêm, sửa, ngừng dùng: `catalog.price.manage` trong công ty.
- Dữ liệu đầu vào: Mã (chữ in hoa, số, gạch dưới, tối đa 20 ký tự, không đổi sau khi tạo), tên.
- Quy trình xử lý: Kiểm tra trùng mã trong công ty; lưu. Nút "Thêm kênh có sẵn" thêm các kênh còn thiếu: Bán sỉ (`BAN_SI`), Bán lẻ (`BAN_LE`), Sàn VComm (`SAN_VCOMM`), Nội bộ (`NOI_BO`); bấm lại không tạo trùng. Không có kênh sàn ngoài (quyết định ngày 2026-11-09).
- Kết quả đầu ra: Danh sách kênh bán, nhóm khách hàng kèm trạng thái.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_25
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_42
- Trường hợp ngoại lệ: Ngừng dùng thay cho xóa.
- Phân quyền: Trong công ty đang làm việc.
- Thông báo lỗi: "Mã đã có trong công ty."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_61

### CHUC_NANG_36: Bảng giá, tra giá, lịch sử giá
- Mục đích: Đặt giá bán theo kênh, nhóm khách hàng, ngày; tra giá khi bán.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn (sửa); Quản lý sản phẩm và người có quyền xem giá (xem); MODULE_05 (tra giá).
- Điều kiện thực hiện: Xem, tra giá: `catalog.price.view`. Thêm, sửa, ngừng dùng bảng giá: `catalog.price.manage`.
- Dữ liệu đầu vào: Bảng giá: mã, tên, kênh bán (tùy chọn), nhóm khách hàng (tùy chọn), tiền tệ (mặc định VND), gồm thuế hay không; sửa chỉ đổi tên, gồm thuế. Xem giá: ngày, từ khóa. Tra giá: biến thể, đơn vị, kênh, nhóm khách, tiền tệ, ngày.
- Quy trình xử lý: Kiểm tra trùng mã, kênh và nhóm khách đang dùng của công ty, tiền tệ đang dùng, không trùng bảng giá đang dùng (cả khi dùng lại bảng giá đã ngừng). Xem giá hiện hành tại một ngày của mọi mặt hàng có giá trong bảng; lịch sử giá một biến thể và đơn vị (kèm số phiếu điều chỉnh). Tra giá theo QUYTAC_NGHIEPVU_42, QUYTAC_NGHIEPVU_43.
- Kết quả đầu ra: Danh sách bảng giá; bảng giá hiện hành; lịch sử giá; kết quả tra giá (bảng giá, gồm thuế hay không, giá, ngày hiệu lực, có phải quy đổi từ đơn vị cơ sở không).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_25
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_42, QUYTAC_NGHIEPVU_43, QUYTAC_NGHIEPVU_44
- Trường hợp ngoại lệ: Không có giá ở mọi bảng giá phù hợp thì tra giá báo chưa có giá. Giá không sửa trực tiếp, chỉ qua CHUC_NANG_37. Bảng giá còn phiếu điều chỉnh giá chờ duyệt thì không ngừng dùng được (QUYTAC_NGHIEPVU_44).
- Phân quyền: Trong công ty đang làm việc.
- Thông báo lỗi: "Đã có bảng giá đang dùng cùng kênh, nhóm khách hàng, tiền tệ." · "Mã đã có trong công ty." · "Chưa có giá cho mặt hàng này." · "Bảng giá còn phiếu điều chỉnh giá chờ duyệt; duyệt xong hoặc rút phiếu trước khi ngừng dùng."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_61

### CHUC_NANG_37: Phiếu điều chỉnh giá
- Mục đích: Thay đổi giá có kiểm soát, qua luồng duyệt.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn (lập); người duyệt theo chính sách (duyệt ở MAN_HINH_08); người có quyền xem giá (xem).
- Điều kiện thực hiện: Xem: `catalog.price.view`. Lập, sửa, xóa, gửi, rút: `catalog.price.manage` (nhạy cảm), chỉ người lập.
- Dữ liệu đầu vào: Bảng giá đang dùng, ngày hiệu lực, ghi chú, các dòng (biến thể của công ty, đơn vị là đơn vị cơ sở hoặc đơn vị quy đổi của sản phẩm, giá mới; 1 đến 5.000 dòng); hoặc nhập dòng từ Excel 3 cột Mã hàng, Mã đơn vị, Giá (tối đa 2.000 dòng, 5 MB; trả các dòng đọc được kèm giá hiện hành để xem lại, không lưu).
- Quy trình xử lý: Lưu nháp kèm giá hiện hành tại ngày hiệu lực của từng dòng. Gửi: kiểm tra ngày hiệu lực không trước hôm nay, bảng giá còn đang dùng; cấp số `DCG-<mã công ty>-<năm>-<6 chữ số>` và gửi yêu cầu duyệt (CHUC_NANG_16) giá trị 0 trong cùng giao dịch; không có chính sách duyệt thì phiếu "Đã duyệt" và ghi giá ngay. Yêu cầu duyệt kết thúc thì phiếu đổi theo; duyệt thì ghi các dòng vào lịch sử giá.
- Kết quả đầu ra: Danh sách phiếu (số, bảng giá, ngày hiệu lực, số dòng, trạng thái, người lập, ngày lập) lọc theo trạng thái; chi tiết phiếu kèm giá hiện hành, giá mới, liên kết tới yêu cầu duyệt.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_25
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_44, QUYTAC_NGHIEPVU_43, QUYTAC_NGHIEPVU_23, QUYTAC_NGHIEPVU_28
- Trường hợp ngoại lệ: Bị từ chối, rút thì giá không đổi. Duyệt sau ngày hiệu lực thì giá hiệu lực từ ngày duyệt.
- Phân quyền: Chỉ người lập sửa, xóa, gửi, rút; người khác nhận "Bạn không có quyền thực hiện thao tác này.".
- Thông báo lỗi: "Ngày hiệu lực không được trước hôm nay." · "Mặt hàng và đơn vị bị lặp." · "Giá trị không hợp lệ." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Không tìm thấy mã này." (nhập Excel)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_62

## Yêu cầu phi chức năng của MODULE_02 (phần Sản phẩm)

| Nhóm | Yêu cầu |
|---|---|
| Hiệu năng | Danh sách 10.000 sản phẩm trả trang đầu dưới 500 mili giây; nhập 2.000 dòng Excel trong 30 giây |
| Tìm kiếm | Tìm tên sản phẩm không phân biệt dấu tiếng Việt, không cần extension PostgreSQL |
| Bảo mật | Kiểm tra chữ ký đầu tệp ảnh; giới hạn kích thước tệp tải lên; dữ liệu tách theo công ty |

## MODULE_03 Kho (phần web, CONG_VIEC_05)

Quy ước chung cho mọi chức năng của MODULE_03:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23), mini app `inventory`.
- Mọi API cần `inventory.access` hoặc `inventory.stock.view` trong công ty đang làm việc; quyền chi tiết kiểm tra phía máy chủ theo chi nhánh sở hữu kho (QUYTAC_NGHIEPVU_46). Kho, phiếu, kiểm kê ngoài phạm vi trả "Không tìm thấy dữ liệu hoặc bạn không có quyền xem." như không tồn tại.
- Sửa dữ liệu gửi kèm phiên bản; khác phiên bản hiện tại thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Số lượng, tiền lưu dạng số thập phân 4 chữ số lẻ, trao đổi dạng chuỗi, nhận dấu phẩy hoặc dấu chấm. Người không có `inventory.cost.view` nhận giá vốn, giá trị là trống.
- Ô tìm mặt hàng nhận chuỗi từ máy quét mã vạch gõ phím kèm Enter: tìm đúng mã vạch, đúng mã hàng hoặc tên không dấu trong sản phẩm của công ty chủ hàng; trả đơn vị khớp mã vạch.

### CHUC_NANG_38: Kho, vị trí kệ, công ty chủ hàng, cài đặt kho
- Mục đích: Khai báo kho thuộc chi nhánh, vị trí kệ, các công ty được gửi hàng vào kho, số giờ giữ hàng mặc định.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn, Quản lý kho.
- Điều kiện thực hiện: Xem: quyền kho tại kho, hoặc `inventory.stock.view` ở công ty chủ hàng. Thêm kho, sửa cài đặt giữ hàng: `inventory.warehouse.manage` ở phạm vi công ty. Sửa kho, vị trí, ngừng dùng: `inventory.warehouse.manage` tại kho.
- Dữ liệu đầu vào: Kho: chi nhánh của công ty đang làm việc, mã (1 đến 20 ký tự chữ in hoa, số, `-`, `_`), tên, địa chỉ, dùng vị trí kệ, danh sách công ty chủ hàng (tối đa 50). Vị trí: một lần tối đa 500 vị trí, mã (1 đến 30 ký tự chữ in hoa, số, `-`, `_`, `.`), tên. Cài đặt: số giờ giữ hàng 1 đến 720.
- Quy trình xử lý: Mã đổi thành chữ in hoa; kiểm tra chi nhánh đang hoạt động thuộc công ty, mã kho không trùng trong công ty, công ty chủ hàng đang hoạt động; luôn thêm công ty sở hữu kho vào danh sách chủ hàng. Sửa: không bỏ được chủ hàng còn tồn, không đổi cài đặt vị trí khi kho còn tồn. Ngừng dùng kho, vị trí khi không còn tồn; dùng lại được. Cài đặt giữ hàng lưu theo công ty, chưa cài thì 72 giờ.
- Kết quả đầu ra: Danh sách kho (mã, tên, chi nhánh, công ty sở hữu, công ty chủ hàng, số vị trí đang dùng, trạng thái, thao tác được hay chỉ xem, quản lý được hay không); danh sách vị trí; cài đặt.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_26
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_45, QUYTAC_NGHIEPVU_46, QUYTAC_NGHIEPVU_54
- Trường hợp ngoại lệ: Không có chức năng xóa kho, vị trí. Kho ngừng dùng không lập được phiếu mới.
- Phân quyền: Người chỉ có quyền ở chi nhánh khác không thấy kho; nhân viên công ty chủ hàng thấy kho để xem tồn, không thao tác.
- Thông báo lỗi: "Mã kho đã có trong công ty." · "Mã vị trí đã có trong kho." (chỉ ra đúng dòng) · "Công ty chủ hàng còn tồn trong kho, không bỏ được." · "Kho còn tồn, không đổi được cài đặt vị trí kệ." · "Kho còn tồn, không ngừng dùng được." · "Vị trí còn tồn, không ngừng dùng được."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_65

### CHUC_NANG_39: Tồn kho, thẻ kho, giá vốn bình quân
- Mục đích: Biết theo thời gian thực đang có bao nhiêu hàng của từng công ty chủ hàng, ở lô, serial, vị trí nào, giá vốn bao nhiêu; xem lịch sử biến động.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn; nhân viên công ty chủ hàng có quyền xem tồn.
- Điều kiện thực hiện: `inventory.access` tại kho (mọi chủ hàng), hoặc `inventory.stock.view` ở công ty chủ hàng (hàng của công ty mình). Giá vốn, giá trị: `inventory.cost.view` tại kho, hoặc ở công ty chủ hàng cho hàng của công ty đó.
- Dữ liệu đầu vào: Tồn kho: kho, công ty chủ hàng, ngành hàng, từ khóa (tên không dấu, đúng mã hàng, đúng mã vạch), chỉ hàng còn tồn (mặc định có), trang (tối đa 100 dòng, mặc định 50). Chi tiết: biến thể, kho, công ty chủ hàng. Thẻ kho: kho, công ty chủ hàng, biến thể, từ ngày, đến ngày.
- Quy trình xử lý: Tồn khả dụng = tồn thực − hàng đang giữ; đang chuyển đến = tổng số lượng phiếu chuyển kho đang vận chuyển tới kho. Thẻ kho tính ngày theo giờ Việt Nam: tồn đầu kỳ là tồn sau của biến động cuối trước kỳ, tồn cuối kỳ là tồn sau của biến động cuối trong kỳ; giá trị là tổng giá trị biến động; tối đa 5.000 biến động một lần xem.
- Kết quả đầu ra: Dòng tồn (kho, công ty chủ hàng, mã hàng, tên, đơn vị cơ sở, tồn thực, đang giữ, khả dụng, đang chuyển đến, giá vốn, giá trị, tối thiểu, dưới tồn an toàn); chi tiết theo lô và hạn dùng, vị trí, serial (kèm giá vốn đích danh), hàng đang giữ; thẻ kho (thời điểm, số phiếu, loại phiếu, lô, vị trí, số lượng, giá vốn, giá trị, tồn sau).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_27
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_46, QUYTAC_NGHIEPVU_47, QUYTAC_NGHIEPVU_48, QUYTAC_NGHIEPVU_49, QUYTAC_NGHIEPVU_54
- Trường hợp ngoại lệ: Từ ngày sau đến ngày bị từ chối.
- Phân quyền: Như điều kiện thực hiện; kho ngoài phạm vi trả "Không tìm thấy".
- Thông báo lỗi: "Giá trị không hợp lệ." (khoảng ngày)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_66, TIEUCHI_NGHIEMTHU_74

### CHUC_NANG_40: Phiếu nhập khác, xuất khác, điều chỉnh
- Mục đích: Thay đổi tồn không có chứng từ gốc có kiểm soát qua luồng duyệt.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn (lập); người duyệt theo chính sách (duyệt ở MAN_HINH_08).
- Điều kiện thực hiện: Xem: như CHUC_NANG_39. Lập, sửa, xóa, gửi, rút, gợi ý lô: `inventory.document.manage` tại kho; sửa, xóa, gửi, rút chỉ người lập.
- Dữ liệu đầu vào: Loại phiếu, kho, công ty chủ hàng, ngày, lý do (nhập khác: tồn đầu kỳ, phát hiện thừa, quà tặng biếu, khác; xuất khác: dùng nội bộ, quà tặng biếu, hư hỏng, hủy hàng hết hạn, khác; điều chỉnh: kiểm kê, hư hỏng, phát hiện thừa, khác), diễn giải, ghi chú; 1 đến 1.000 dòng (biến thể, đơn vị, số lượng khác 0 (âm chỉ ở phiếu điều chỉnh), đơn giá (bắt buộc ở phiếu nhập khác, theo đơn vị của dòng), lô (dòng nhập: số lô, ngày sản xuất, hạn dùng; dòng xuất: chọn lô), lý do đổi lô, vị trí, serial).
- Quy trình xử lý: Lưu nháp: kiểm tra kho đang dùng nhận công ty chủ hàng, lý do đúng loại phiếu, mặt hàng đang bán của công ty chủ hàng, đơn vị của sản phẩm, vị trí theo cài đặt kho, lô và serial theo cách theo dõi của sản phẩm, số serial bằng số lượng đơn vị cơ sở. Gửi: kiểm tra đủ tồn theo lô, vị trí; đủ tồn khả dụng; lô còn hạn (QUYTAC_NGHIEPVU_51); lô khác gợi ý có lý do; serial đúng trạng thái; lô nhập đã có thì hạn dùng phải trùng. Trong một giao dịch: giữ hàng cho dòng giảm, cấp số `<tiền tố>-<mã công ty>-<năm>-<6 chữ số>`, gửi yêu cầu duyệt (CHUC_NANG_16) với giá trị duyệt theo QUYTAC_NGHIEPVU_50; chưa có chính sách duyệt thì ghi sổ ngay. Duyệt xong thì ghi sổ qua sổ kho (tạo lô, cập nhật tồn, giá vốn, serial, thẻ kho), đánh dấu hàng giữ đã dùng; từ chối, rút thì nhả hàng giữ. Gợi ý lô: các lô còn tồn sắp theo hạn dùng tăng dần, không hạn dùng xếp sau, đánh dấu lô hết hạn và lô gợi ý.
- Kết quả đầu ra: Danh sách phiếu (số, loại, ngày, kho, kho đích, công ty chủ hàng, lý do, trạng thái, số dòng, tổng giá trị, người lập) lọc theo loại, trạng thái, kho, phân trang; chi tiết phiếu kèm dòng, giá trị đã ghi sổ, liên kết yêu cầu duyệt; in tem sản phẩm của phiếu.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_27, YCAU_NGHIEPVU_28
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_46, QUYTAC_NGHIEPVU_47, QUYTAC_NGHIEPVU_48, QUYTAC_NGHIEPVU_49, QUYTAC_NGHIEPVU_50, QUYTAC_NGHIEPVU_51, QUYTAC_NGHIEPVU_23, QUYTAC_NGHIEPVU_28
- Trường hợp ngoại lệ: Hai phiếu đồng thời xuất món hàng cuối cùng: một phiếu bị từ chối "Không đủ hàng khả dụng". Mặt hàng đang kiểm kê không ghi sổ được. Phiếu điều chỉnh sinh từ kiểm kê không sửa, không xóa.
- Phân quyền: Chỉ người lập sửa, xóa, gửi, rút; người khác nhận "Bạn không có quyền thực hiện thao tác này.".
- Thông báo lỗi: "Kho không nhận hàng của công ty này." · "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán." · "Không đổi loại phiếu, kho, công ty chủ hàng của phiếu đã lập." · "Không đủ hàng trong kho." · "Không đủ hàng khả dụng (một phần đang được giữ)." · "Lô đã hết hạn dùng." · "Lô đã có với hạn dùng khác." · "Chọn lô khác lô gợi ý phải ghi lý do." · "Sản phẩm không theo dõi lô." · "Số serial phải bằng số lượng theo đơn vị cơ sở." · "Serial bị lặp." · "Serial đã có trong kho." · "Serial không có trong kho, vị trí này." · "Sản phẩm không theo dõi serial." · "Mặt hàng đang kiểm kê, chưa ghi sổ được." · "Chỉ sửa được chứng từ đang ở trạng thái nháp."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_65, TIEUCHI_NGHIEMTHU_66, TIEUCHI_NGHIEMTHU_67, TIEUCHI_NGHIEMTHU_68, TIEUCHI_NGHIEMTHU_74

### CHUC_NANG_41: Phiếu chuyển kho hai bước
- Mục đích: Chuyển hàng giữa hai kho của cùng công ty chủ hàng, biết hàng đang trên đường và chênh lệch khi nhận.
- Người sử dụng: Thủ kho, Quản lý kho kho nguồn (lập, xuất), kho đích (nhận); người duyệt theo chính sách.
- Điều kiện thực hiện: Lập, gửi, rút, xuất: `inventory.document.manage` tại kho nguồn. Nhận: `inventory.document.manage` tại kho đích.
- Dữ liệu đầu vào: Như CHUC_NANG_40 (lý do "Chuyển kho") cộng kho đích. Nhận: mọi dòng có số thực nhận theo đơn vị cơ sở, vị trí đích (kho đích có vị trí), serial nhận được; ghi chú.
- Quy trình xử lý: Danh sách kho đích là kho đang dùng nhận hàng của công ty chủ hàng. Gửi như CHUC_NANG_40; duyệt xong (hoặc không có chính sách) phiếu chờ xuất. Xuất: ghi sổ giảm ở kho nguồn, serial sang đang vận chuyển, lưu giá trị xuất, hàng giữ của phiếu đã dùng; phiếu Đang vận chuyển. Nhận: ghi sổ tăng ở kho đích theo số thực nhận với giá vốn lúc xuất (serial giữ giá đích danh), giữ lô; dòng nhận khác số xuất lập biên bản chênh lệch (số xuất, số nhận, chênh lệch, giá trị = chênh lệch × giá vốn lúc xuất, ghi chú); phiếu Đã nhận.
- Kết quả đầu ra: Phiếu kèm trạng thái, nút xuất (kho nguồn), nhận (kho đích); biên bản chênh lệch; đang chuyển đến trong tồn kho của kho đích.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_28
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_50, QUYTAC_NGHIEPVU_52
- Trường hợp ngoại lệ: Xuất lại phiếu đã xuất, nhận phiếu chưa xuất bị từ chối. Chênh lệch chỉ ghi biên bản; hệ thống không tự lập phiếu điều chỉnh.
- Phân quyền: Người không có quyền tại kho nguồn không xuất được; không có quyền tại kho đích không nhận được.
- Thông báo lỗi: "Kho không nhận hàng của công ty này." · "Phiếu chuyển kho chưa được duyệt hoặc đã xuất." · "Phiếu chuyển kho không ở trạng thái đang vận chuyển." · "Serial không có trong phiếu chuyển kho." · "Số serial phải bằng số lượng theo đơn vị cơ sở." · như CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_69

### CHUC_NANG_42: Kiểm kê
- Mục đích: Đối chiếu tồn thực tế với sổ sách, điều chỉnh chênh lệch có duyệt và quy trách nhiệm.
- Người sử dụng: Quản lý kho, quản trị công ty, quản trị tập đoàn; người duyệt phiếu điều chỉnh.
- Điều kiện thực hiện: Xem: `inventory.access` tại kho. Lập, bắt đầu, nhập số đếm, kết thúc, hủy: `inventory.stocktake.manage` tại kho.
- Dữ liệu đầu vào: Kho, công ty chủ hàng, phạm vi (toàn kho; ngành hàng; vị trí khi kho có vị trí; danh sách sản phẩm) và danh sách mã phạm vi, ghi chú. Số đếm theo đơn vị cơ sở theo dòng, hoặc dòng mới (biến thể, lô, vị trí); serial đếm được với hàng serial. Kết thúc: người chịu trách nhiệm, tiền bồi thường theo dòng.
- Quy trình xử lý: Bắt đầu: cấp số `KK`, chụp tồn sổ sách các dòng tồn lớn hơn 0 trong phạm vi kèm giá vốn bình quân (kiểm theo danh sách sản phẩm thì mặt hàng hết tồn vẫn có dòng); từ đây mặt hàng trong phạm vi bị khóa (QUYTAC_NGHIEPVU_53). Nhập số đếm nhiều lần. Kết thúc khi mọi dòng có số đếm: tính chênh lệch (hàng serial theo danh sách serial thiếu, thừa), lập phiếu điều chỉnh lý do "Kiểm kê" gắn kiểm kê, dòng thiếu kèm người chịu trách nhiệm và tiền bồi thường (mặc định số thiếu × giá vốn lúc chụp), rồi gửi phiếu như CHUC_NANG_40; gửi lỗi thì kiểm kê về Đang đếm. Hủy khi Nháp hoặc Đang đếm.
- Kết quả đầu ra: Danh sách kiểm kê (số, kho, công ty chủ hàng, phạm vi, trạng thái, số dòng, số dòng đã đếm); chi tiết dòng (tồn sổ sách, số đếm, chênh lệch, giá trị chênh lệch); liên kết phiếu điều chỉnh.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_28
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_53, QUYTAC_NGHIEPVU_50, QUYTAC_NGHIEPVU_48
- Trường hợp ngoại lệ: Không có chênh lệch thì không sinh phiếu. Phiếu điều chỉnh ghi sổ được vào mặt hàng đang khóa của chính kiểm kê đó.
- Phân quyền: Thủ kho không có quyền kiểm kê.
- Thông báo lỗi: "Kiểm kê đã bắt đầu." · "Kiểm kê không ở trạng thái đang đếm." · "Còn dòng chưa có số đếm." · "Hàng theo lô: ghi số đếm theo lô đã có; lô mới nhập bằng phiếu nhập khác." · "Số serial phải bằng số lượng theo đơn vị cơ sở." · "Serial bị lặp." · "Kho không nhận hàng của công ty này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_70

### CHUC_NANG_43: Giữ hàng
- Mục đích: Dành hàng cho đơn, phiếu đã xác nhận để không bán, xuất trùng.
- Người sử dụng: Quản lý kho, quản trị công ty, quản trị tập đoàn; phiếu kho (tự động); MODULE_05 (đơn bán, qua dịch vụ trong API).
- Điều kiện thực hiện: Xem: `inventory.access` tại kho. Giữ thủ công, gia hạn, nhả: `inventory.reservation.manage` tại kho.
- Dữ liệu đầu vào: Giữ thủ công: kho, công ty chủ hàng, biến thể, số lượng lớn hơn 0 (đơn vị cơ sở), ghi chú (lưu làm số nguồn). Gia hạn: số giờ 1 đến 720.
- Quy trình xử lý: Khóa dòng giá vốn của mặt hàng, kiểm tồn khả dụng, lưu hàng giữ; giữ thủ công có hạn theo cài đặt giữ hàng của công ty chủ hàng. Gia hạn cộng thêm số giờ vào hạn giữ (hoặc từ bây giờ nếu đã quá hạn). Nhả tay đổi sang Đã nhả. Tác vụ nền mỗi 5 phút nhả hàng giữ đã hết hạn.
- Kết quả đầu ra: Danh sách hàng giữ lọc theo trạng thái, kho (mã hàng, số lượng, nguồn, số nguồn, hạn giữ, người tạo).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_29
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_54
- Trường hợp ngoại lệ: Hàng giữ cho phiếu kho không có hạn, không gia hạn, không nhả tay; nhả khi phiếu bị từ chối, rút; đã dùng khi ghi sổ hoặc xuất chuyển kho.
- Phân quyền: Thủ kho không giữ, nhả được.
- Thông báo lỗi: "Không đủ hàng khả dụng (một phần đang được giữ)." · "Hàng giữ cho phiếu kho chỉ nhả khi phiếu bị từ chối hoặc rút." · "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán." · "Kho không nhận hàng của công ty này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_71

### CHUC_NANG_44: Tồn an toàn, cảnh báo, gợi ý bổ sung
- Mục đích: Biết sớm hàng sắp thiếu và số cần mua hoặc chuyển.
- Người sử dụng: Quản lý kho, quản trị công ty, quản trị tập đoàn; Mua hàng (nhận thông báo khi có quyền).
- Điều kiện thực hiện: Xem, cảnh báo: `inventory.access` tại kho. Đặt, xóa mức tồn an toàn: `inventory.reservation.manage` tại kho.
- Dữ liệu đầu vào: Kho, công ty chủ hàng, biến thể, tối thiểu, tối đa (không âm, tối đa không nhỏ hơn tối thiểu).
- Quy trình xử lý: Lưu hoặc thay mức theo kho, công ty chủ hàng, biến thể. Dưới tồn an toàn khi tồn khả dụng + đang chuyển đến < tối thiểu; số gợi ý theo QUYTAC_NGHIEPVU_55. Tác vụ nền 7 giờ sáng giờ Việt Nam gửi mỗi kho một thông báo trong ứng dụng "<tên kho>: <số> mặt hàng dưới tồn an toàn" cho người có quyền `inventory.reservation.manage` ở tập đoàn, công ty sở hữu kho, chi nhánh của kho.
- Kết quả đầu ra: Danh sách mức tồn an toàn (tối thiểu, tối đa, khả dụng, đang chuyển đến, dưới tồn an toàn, số gợi ý); danh sách cảnh báo; cột tối thiểu và dấu dưới tồn an toàn trong tồn kho.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_29
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_55
- Trường hợp ngoại lệ: Mặt hàng chưa đặt mức thì không cảnh báo.
- Phân quyền: Thủ kho xem cột tối thiểu trong tồn kho, không đặt mức.
- Thông báo lỗi: "Giá trị không hợp lệ." (tối đa nhỏ hơn tối thiểu) · "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán." · "Kho không nhận hàng của công ty này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_72

### CHUC_NANG_45: In tem mã vạch
- Mục đích: In tem dán sản phẩm, tem vị trí kệ để quét bằng máy quét.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Tem sản phẩm: `inventory.access` tại ít nhất một kho nhận hàng của công ty chủ hàng. Tem vị trí: `inventory.access` tại kho.
- Dữ liệu đầu vào: Tem sản phẩm: công ty chủ hàng, danh sách biến thể, số bản mỗi biến thể (1 đến 500). Tem vị trí: kho.
- Quy trình xử lý: Tạo PDF bằng `pdfmake`, mỗi tem một trang khổ 50 × 30 mm, mã vạch Code 128 bộ B vẽ trực tiếp. Tem sản phẩm: tên sản phẩm, mã hàng và giá trị phân loại, mã vạch của đơn vị cơ sở (không có thì mã hàng). Tem vị trí: tên kho, tên vị trí, mã vị trí, mọi vị trí đang dùng. Ký tự ngoài ASCII được bỏ dấu hoặc thay bằng `-`.
- Kết quả đầu ra: Tệp PDF `tem-san-pham.pdf`, `tem-vi-tri.pdf` mở ngay trên trình duyệt. Nút in ở MAN_HINH_28 (tem vị trí), MAN_HINH_29 và MAN_HINH_32 (tem sản phẩm).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_29
- Quy tắc nghiệp vụ: Không có
- Trường hợp ngoại lệ: Kho chưa có vị trí đang dùng thì không in tem vị trí.
- Phân quyền: Như điều kiện thực hiện.
- Thông báo lỗi: "Kho chưa có vị trí đang dùng để in tem." · "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_73

## Yêu cầu phi chức năng của MODULE_03 (phần web)

| Nhóm | Yêu cầu |
|---|---|
| Hiệu năng | Danh sách tồn kho 50.000 dòng trả trang đầu dưới 500 mili giây; ghi sổ phiếu 200 dòng dưới 2 giây |
| Đồng thời | Ghi sổ khóa dòng giá vốn rồi dòng tồn theo thứ tự cố định; giữ hàng khóa dòng giá vốn; tồn không âm (ràng buộc cơ sở dữ liệu) |
| Toàn vẹn | Thẻ kho chỉ thêm (trigger cơ sở dữ liệu); số lượng, tiền `numeric(20,4)`, tính giá vốn trong cơ sở dữ liệu |
| Giao diện | Dùng được trên điện thoại; nhận máy quét mã vạch gõ phím |

## MODULE_07 Khách hàng và Đối tác (phần tối thiểu, CONG_VIEC_06)

Quy ước chung cho mọi chức năng của MODULE_07 phần tối thiểu:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23), mini app `crm`, loại đối tượng `partner` hoặc `partner_profile`.
- Mọi API cần `crm.access` hoặc `crm.partner.view` trong công ty đang làm việc; quyền chi tiết kiểm tra phía máy chủ ở phạm vi công ty đang làm việc.
- Sửa dữ liệu gửi kèm phiên bản; khác phiên bản hiện tại thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Danh mục đối tác dùng chung tập đoàn, không lọc theo công ty; hồ sơ đối tác, cờ khách hàng, nhà cung cấp lấy theo công ty đang làm việc.

### CHUC_NANG_46: Quản lý đối tác dùng chung
- Mục đích: Một danh mục đối tác cho cả tập đoàn, không lập trùng cùng một doanh nghiệp, cá nhân.
- Người sử dụng: Quản lý đối tác, quản trị công ty, quản trị tập đoàn (thêm, sửa); Thủ kho và người có `crm.partner.view` (xem).
- Điều kiện thực hiện: Xem, tìm, kiểm trùng theo mã số thuế: `crm.partner.view`. Kiểm trùng theo số Căn cước công dân: `crm.partner.manage` (tránh dò tìm danh tính). Thêm, sửa, ngừng giao dịch, cho giao dịch lại: `crm.partner.manage`. Xem đầy đủ số Căn cước công dân: `crm.partner.identity.view` (nhạy cảm).
- Dữ liệu đầu vào: Loại (tổ chức, hộ kinh doanh, cá nhân), tên (tối đa 300 ký tự), tên ngắn, mã số thuế (10 số hoặc 10 số, `-`, 3 số), số Căn cước công dân (12 số), địa chỉ, điện thoại, email; tối đa 50 người liên hệ (họ tên, chức vụ, điện thoại, email, liên hệ chính); tối đa 20 tài khoản ngân hàng (ngân hàng, số tài khoản 4 đến 30 ký tự chữ, số, `-`, chủ tài khoản, chi nhánh, mặc định). Danh sách: từ khóa, loại, vai trò với công ty đang chọn (khách hàng, nhà cung cấp, nội bộ), trạng thái, trang (tối đa 100 dòng, mặc định 20).
- Quy trình xử lý: Kiểm tra tổ chức, hộ kinh doanh có mã số thuế; cá nhân có số Căn cước công dân, không nhận số Căn cước công dân cho tổ chức, hộ kinh doanh; mã số thuế, số Căn cước công dân không trùng trong tập đoàn. Thêm: sinh mã `DT` + 6 số; ghi đối tác, người liên hệ, tài khoản ngân hàng, nhật ký trong một giao dịch. Sửa: thay toàn bộ người liên hệ, tài khoản ngân hàng; cá nhân để trống số Căn cước công dân thì giữ số đã lưu; nhật ký ghi dữ liệu trước, sau (số Căn cước công dân chỉ ghi 3 số cuối). Ngừng giao dịch, cho giao dịch lại đổi trạng thái, không xóa. Tìm không dấu theo tên, tên ngắn, mã số thuế, điện thoại; đúng mã đối tác, đúng mã số thuế, đúng số điện thoại. Kiểm trùng khi rời ô mã số thuế, số Căn cước công dân trả đối tác có sẵn (mã, tên). Xem đầy đủ số Căn cước công dân ghi nhật ký mỗi lần.
- Kết quả đầu ra: Danh sách (mã, tên, tên ngắn, loại, mã số thuế hoặc số Căn cước công dân đã che, điện thoại, nội bộ, khách hàng, nhà cung cấp của công ty đang chọn, trạng thái) sắp đang giao dịch trước, theo tên; chi tiết kèm người liên hệ, tài khoản ngân hàng, hồ sơ của công ty đang chọn, phiên bản, được sửa hay không, được xem số Căn cước công dân hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_30
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_56, QUYTAC_NGHIEPVU_57, QUYTAC_NGHIEPVU_59
- Trường hợp ngoại lệ: Không có chức năng xóa đối tác. Đối tác nội bộ không sửa, không đổi trạng thái được (CHUC_NANG_47). Hai người thêm cùng mã số thuế hoặc số Căn cước công dân đồng thời: một người nhận lỗi trùng đúng trường (ràng buộc duy nhất của cơ sở dữ liệu).
- Phân quyền: Người không có `crm.partner.manage` không thấy nút thêm, sửa, ngừng giao dịch; gọi API nhận 403.
- Thông báo lỗi: "Vui lòng nhập thông tin này." (mã số thuế, số Căn cước công dân) · "Giá trị không hợp lệ." (định dạng) · "Mã số thuế đã có ở đối tác khác trong tập đoàn." · "Số Căn cước công dân đã có ở đối tác khác trong tập đoàn."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_75, TIEUCHI_NGHIEMTHU_76, TIEUCHI_NGHIEMTHU_78

### CHUC_NANG_47: Đối tác nội bộ
- Mục đích: Biết ngay đối tác là công ty con nào trong tập đoàn để giao dịch nội bộ.
- Người sử dụng: Hệ thống (tự đồng bộ); mọi người có `crm.partner.view` (xem).
- Điều kiện thực hiện: Chạy mỗi lần đọc danh sách đối tác.
- Dữ liệu đầu vào: Danh sách công ty con (có công ty mẹ) đang hoạt động: tên pháp lý, tên ngắn, mã số thuế, địa chỉ.
- Quy trình xử lý: Công ty con đã có đối tác nội bộ: cập nhật tên, tên ngắn, mã số thuế, địa chỉ, trạng thái khi khác. Chưa có: đối tác bên ngoài trùng mã số thuế được gắn thành đối tác nội bộ (loại tổ chức); không có thì thêm đối tác nội bộ mới. Công ty con ngừng hoạt động: đối tác nội bộ ngừng giao dịch. Mã số thuế công ty con trùng một đối tác khác đã gắn: bỏ qua công ty đó, ghi cảnh báo vào log, không chặn danh sách.
- Kết quả đầu ra: Mỗi công ty con đang hoạt động có đúng một đối tác nội bộ, hiện nhãn "Nội bộ"; lọc được theo vai trò nội bộ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_30
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_58
- Trường hợp ngoại lệ: Công ty con chưa khai mã số thuế vẫn là đối tác nội bộ. Mã số thuế của công ty con không dùng được cho đối tác bên ngoài.
- Phân quyền: Không ai sửa thông tin chung, trạng thái của đối tác nội bộ trong mini app Đối tác; sửa ở màn hình Công ty (MAN_HINH_09).
- Thông báo lỗi: "Đối tác nội bộ lấy thông tin từ công ty, sửa ở màn hình Công ty."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_77

### CHUC_NANG_48: Hồ sơ đối tác của công ty
- Mục đích: Mỗi công ty giữ điều kiện giao dịch riêng với đối tác dùng chung.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Xem: `crm.partner.view` (hồ sơ của công ty đang chọn). Lập, sửa, tải danh sách chọn: `crm.profile.manage` (nhạy cảm).
- Dữ liệu đầu vào: Là khách hàng, là nhà cung cấp, số ngày được nợ (0 đến 365), hạn mức công nợ (không âm, 4 chữ số lẻ; để trống là không giới hạn), nhóm khách hàng, nhân viên phụ trách, ghi chú (tối đa 1.000 ký tự), trạng thái, phiên bản (0 khi lập mới).
- Quy trình xử lý: Kiểm tra chọn ít nhất khách hàng hoặc nhà cung cấp; đối tác không phải chính công ty đang chọn; nhóm khách hàng đang dùng của công ty đang chọn; nhân viên phụ trách đang làm ở công ty đang chọn. Lập mới hoặc ghi đè theo phiên bản; ghi nhật ký dữ liệu trước, sau. Danh sách chọn gồm nhóm khách hàng đang dùng, nhân viên đang làm của công ty.
- Kết quả đầu ra: Hồ sơ (khách hàng, nhà cung cấp, số ngày được nợ, hạn mức, nhóm khách hàng, nhân viên phụ trách, ghi chú, trạng thái, phiên bản) trong chi tiết đối tác; cờ khách hàng, nhà cung cấp trong danh sách và bộ lọc.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_31
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_60
- Trường hợp ngoại lệ: Công ty khác không đọc được hồ sơ của công ty A (chi tiết trả hồ sơ trống). Đối tác nội bộ của chính công ty đang chọn không lập được hồ sơ.
- Phân quyền: Quản lý đối tác không có `crm.profile.manage`, gọi API nhận 403.
- Thông báo lỗi: "Giá trị không hợp lệ." (không chọn vai trò, số ngày, hạn mức, nhóm khách hàng, nhân viên phụ trách) · "Không lập hồ sơ đối tác cho chính công ty đang chọn."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_79

## Yêu cầu phi chức năng của MODULE_07 (phần tối thiểu)

| Nhóm | Yêu cầu |
|---|---|
| Tìm kiếm | Tìm tên không phân biệt dấu tiếng Việt, không cần extension PostgreSQL |
| Toàn vẹn | Mã số thuế, số Căn cước công dân, đối tác nội bộ duy nhất (ràng buộc cơ sở dữ liệu); khóa ngoại từ `crm` chỉ trỏ vào `crm`, `core` |
| Bảo mật | Số Căn cước công dân che trong danh sách, chi tiết, nhật ký thêm, sửa; xem đầy đủ cần quyền nhạy cảm và ghi nhật ký |
| Giao diện | Dùng được trên điện thoại |

## MODULE_04 Mua hàng (phần 1: Mua hàng trong nước, CONG_VIEC_07)

Quy ước chung cho mọi chức năng của MODULE_04 phần 1:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23): mini app `purchasing`, loại đối tượng `supplier_price`, `purchasing_settings`, `requisition`, `purchase_order`; phiếu nhập mua, phiếu trả hàng ghi ở mini app `inventory`, loại đối tượng `stock_document` (thêm hành động `stock_document.quality_check`).
- API Mua hàng cần `purchasing.access`, `purchasing.order.view` hoặc `purchasing.requisition.create` trong công ty đang làm việc; quyền chi tiết kiểm tra phía máy chủ. `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh nào của công ty cũng dùng được trong công ty đó; quyền Mua hàng khác cần lần gán ở phạm vi tập đoàn hoặc công ty. Phiếu nhập mua, phiếu trả hàng cần `inventory.purchase.receive` tại kho (QUYTAC_NGHIEPVU_46).
- Sửa dữ liệu gửi kèm phiên bản; khác phiên bản hiện tại thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền tệ là tiền tệ của công ty; đơn giá chưa gồm thuế giá trị gia tăng; số lượng, tiền `numeric(20,4)`.
- Số đã nhận, đã trả của dòng đơn mua tính từ phiếu kho (đọc chéo module), không lưu trùng.

### CHUC_NANG_49: Bảng giá mua theo nhà cung cấp
- Mục đích: Gợi ý đúng đơn giá đã thỏa thuận với nhà cung cấp khi lập đơn mua.
- Người sử dụng: Nhân viên mua hàng, quản trị công ty, quản trị tập đoàn (thêm, sửa); Thủ kho và người có quyền Mua hàng khác (xem).
- Điều kiện thực hiện: Xem, tra giá gợi ý, tải danh sách chọn, tìm mặt hàng: một trong `purchasing.price.manage`, `purchasing.requisition.create`, `purchasing.order.view`, `purchasing.order.manage`. Thêm, sửa, ngừng dùng, dùng lại: `purchasing.price.manage`.
- Dữ liệu đầu vào: Nhà cung cấp, mặt hàng (biến thể đang bán của công ty), đơn vị mua (đơn vị cơ sở hoặc đơn vị quy đổi của sản phẩm), số lượng tối thiểu (mặc định 0; tối đa 12 chữ số phần nguyên, 4 chữ số lẻ), đơn giá chưa thuế (bắt buộc, không âm; tối đa 16 chữ số phần nguyên, 4 chữ số lẻ), mã hàng nhà cung cấp (tối đa 50 ký tự), hiệu lực từ (bắt buộc), hiệu lực đến (trống: không thời hạn; không trước ngày bắt đầu). Danh sách: nhà cung cấp, trạng thái, từ khóa (đúng mã hàng, tên không dấu, đúng mã hàng nhà cung cấp), trang (tối đa 100 dòng, mặc định 20). Tra giá: nhà cung cấp, mặt hàng, đơn vị, số lượng, ngày (mặc định hôm nay).
- Quy trình xử lý: Kiểm nhà cung cấp là đối tác đang giao dịch có hồ sơ nhà cung cấp đang dùng ở công ty; mặt hàng, đơn vị hợp lệ. Khóa theo (công ty, nhà cung cấp, mặt hàng, đơn vị) trong giao dịch rồi kiểm không có giá đang dùng khác cùng số lượng tối thiểu chồng hiệu lực; ghi giá, nhật ký. Ngừng dùng đổi trạng thái; dùng lại kiểm lại như khi lưu. Tra giá: giá đang dùng có hiệu lực tại ngày, số lượng tối thiểu lớn nhất không vượt số lượng; cùng mức thì lấy giá bắt đầu hiệu lực muộn nhất.
- Kết quả đầu ra: Danh sách giá (nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu, đơn giá, mã hàng nhà cung cấp, hiệu lực, trạng thái, phiên bản) sắp đang dùng trước, theo tên nhà cung cấp, mã hàng, số lượng tối thiểu; giá gợi ý (đơn giá, mã giá; không có: trống); danh sách chọn (nhà cung cấp có hồ sơ nhà cung cấp, kho nhận hàng của công ty, tiền tệ).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_32
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_61
- Trường hợp ngoại lệ: Không xóa giá, chỉ ngừng dùng. Hai người lưu giá chồng hiệu lực cùng lúc: người sau nhận lỗi chồng hiệu lực. Giá của công ty khác không xem, không sửa được (404).
- Phân quyền: Người không có `purchasing.price.manage` không thấy nút thêm, sửa, ngừng dùng; gọi API nhận 403.
- Thông báo lỗi: "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty." · "Đã có giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu trùng thời gian hiệu lực." · "Giá trị không hợp lệ." (đơn vị, số, ngày)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_80

### CHUC_NANG_50: Đề nghị mua
- Mục đích: Bộ phận cần hàng đề nghị mua, được duyệt trước khi đặt.
- Người sử dụng: Nhân viên mua hàng, Thủ kho, quản trị công ty, quản trị tập đoàn (lập); Nhân viên mua hàng, quản trị (đóng, lập đơn mua từ đề nghị).
- Điều kiện thực hiện: Xem danh sách, chi tiết: `purchasing.requisition.create` hoặc `purchasing.order.manage`. Lập, sửa, gửi: `purchasing.requisition.create`; sửa, gửi, rút chỉ người lập. Đóng: `purchasing.order.manage`.
- Dữ liệu đầu vào: Kho nhận (kho đang dùng nhận hàng của công ty), ngày cần, lý do (tối đa 500 ký tự), 1 đến 200 dòng: mặt hàng đang bán của công ty, đơn vị, số lượng lớn hơn 0, đơn giá ước tính (không bắt buộc, mặc định 0), nhà cung cấp đề xuất (đối tác có hồ sơ nhà cung cấp), ghi chú (tối đa 300 ký tự). Danh sách: trạng thái, "Còn đặt được", từ khóa (đúng số, lý do), trang.
- Quy trình xử lý: Kiểm kho, mặt hàng, đơn vị, nhà cung cấp; quy số lượng về đơn vị cơ sở; lưu nháp. Sửa khi nháp, bị từ chối, đã rút: thay toàn bộ dòng, về nháp. Gửi: cấp số theo dãy `purchasing.requisition` (chưa cấu hình thì tự tạo dãy tiền tố `DNM`, đặt lại theo năm, 6 chữ số), gửi luồng duyệt với giá trị ước tính; chưa có chính sách duyệt thì duyệt ngay. Nghe `core.approval.completed` để chuyển đã duyệt, bị từ chối, đã rút. Rút khi chờ duyệt và cấp 1 chưa quyết định. Đóng đề nghị đã duyệt. Số đã đặt từng dòng tính từ dòng đơn mua (QUYTAC_NGHIEPVU_62).
- Kết quả đầu ra: Danh sách (số, lý do, kho nhận, ngày cần, số dòng, giá trị ước tính, người lập, trạng thái) mới lập trước; chi tiết kèm dòng (đã đặt theo đơn vị cơ sở), phiên bản, được sửa, được rút, được lập đơn mua hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_32
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_62
- Trường hợp ngoại lệ: Đề nghị chưa duyệt, đã đóng hoặc của công ty khác không đặt được (lỗi ở dòng đơn mua). Thủ kho gán ở chi nhánh vẫn lập được.
- Phân quyền: Người không phải người lập sửa, gửi, rút nhận 403; không có `purchasing.order.manage` không thấy nút "Đóng đề nghị", "Lập đơn mua".
- Thông báo lỗi: "Giá trị không hợp lệ." (kho, đơn vị) · "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty." · "Chỉ sửa được chứng từ đang ở trạng thái nháp."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_81

### CHUC_NANG_51: Đơn mua
- Mục đích: Đặt hàng nhà cung cấp có kiểm soát giá trị; theo dõi đã nhận, đã trả.
- Người sử dụng: Nhân viên mua hàng, quản trị công ty, quản trị tập đoàn (lập, sửa, gửi, đóng); Thủ kho (xem).
- Điều kiện thực hiện: Xem: `purchasing.order.view` hoặc `purchasing.order.manage`. Lập, sửa, gửi, đóng: `purchasing.order.manage`. Rút: người lập. Sửa cài đặt dung sai: `purchasing.settings.manage`.
- Dữ liệu đầu vào: Nhà cung cấp, kho nhận, ngày đơn, ngày giao dự kiến, ghi chú (tối đa 1.000 ký tự), 1 đến 200 dòng: mã dòng (khi sửa, giữ dòng cũ), mặt hàng, đơn vị, số lượng, đơn giá chưa thuế (giao diện gợi ý theo CHUC_NANG_49), thuế suất (0, 5, 8, 10, không chịu thuế, không kê khai; giao diện lấy theo sản phẩm, sửa được), dòng đề nghị mua. Cài đặt: dung sai nhận vượt 0 đến 100 (2 chữ số lẻ), phiên bản (0 khi chưa có). Danh sách: trạng thái, nhà cung cấp, từ khóa (đúng số, tên nhà cung cấp), chỉ đơn đã duyệt, trang.
- Quy trình xử lý: Kiểm nhà cung cấp, kho, mặt hàng, đơn vị. Dòng từ đề nghị: đề nghị đã duyệt của công ty, cùng mặt hàng, tổng đặt không vượt số còn lại (khóa dòng đề nghị). Dòng đã có phiếu nhập: không bỏ, không đổi mặt hàng, đơn vị, không giảm dưới số đã nhận cộng đang chờ kiểm. Tính thành tiền, tổng chưa thuế, thuế; lưu nháp. Gửi: cấp số theo dãy `purchasing.order` (chưa cấu hình thì tự tạo tiền tố `DMH`); miễn duyệt hoặc gửi luồng duyệt theo QUYTAC_NGHIEPVU_63, chưa có chính sách thì duyệt ngay; khi duyệt lưu tổng và nhà cung cấp đã duyệt. Sửa đơn nháp, bị từ chối, đã rút (về nháp) hoặc đã duyệt (giữ đã duyệt; tăng tổng hoặc đổi nhà cung cấp thì tự gửi duyệt lại, giữ số đơn). Đóng đơn đã duyệt kèm lý do: phần chưa nhận hủy. Ghi sổ phiếu nhập mua làm mọi dòng đủ số đặt thì đơn tự chuyển "Đã nhận đủ".
- Kết quả đầu ra: Danh sách (số, nhà cung cấp, kho nhận, ngày đơn, ngày giao dự kiến, tổng chưa thuế, thuế, trạng thái, người lập) mới lập trước; chi tiết: dòng kèm hệ số, đã nhận, đã trả, còn nhận được (đơn vị cơ sở, đã cộng dung sai, chỉ khi đơn đã duyệt), phiếu kho liên quan (nhập mua, trả hàng), lý do đóng, phiên bản, được sửa, gửi, rút, đóng hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_32
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_61, QUYTAC_NGHIEPVU_62, QUYTAC_NGHIEPVU_63, QUYTAC_NGHIEPVU_64
- Trường hợp ngoại lệ: Còn phiếu nhập nháp hoặc chờ kiểm tra thì chưa đóng được. Đơn bị từ chối, đã rút không giữ số lượng của đề nghị. Đơn của công ty khác không xem được (404).
- Phân quyền: Thủ kho chỉ xem; gọi lập, sửa nhận 403. Không có `purchasing.settings.manage` không thấy nút "Cài đặt".
- Thông báo lỗi: "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty." · "Vượt số lượng còn lại của dòng đề nghị mua." · "Số lượng nhỏ hơn số đã nhận." · "Dòng đã có phiếu nhập, không bỏ hoặc đổi mặt hàng, đơn vị được." · "Đơn mua còn phiếu nhập nháp hoặc chờ kiểm tra, chưa đóng được." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Giá trị không hợp lệ."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_81, TIEUCHI_NGHIEMTHU_82, TIEUCHI_NGHIEMTHU_86

### CHUC_NANG_52: Phiếu nhập mua theo đơn mua, kiểm tra chất lượng
- Mục đích: Kho nhận đúng hàng của đơn mua, không vượt dung sai; hàng cần kiểm tra chỉ vào tồn khi đạt.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `inventory.purchase.receive` tại kho nhận của đơn mua; sửa, gửi, xóa nháp chỉ người lập (xóa nháp dùng API_65 nên cần thêm `inventory.document.manage`).
- Dữ liệu đầu vào: Đơn mua đã duyệt, ngày phiếu, ghi chú, 1 đến 200 dòng: dòng đơn mua, số thực nhận theo đơn vị của dòng đơn, số lô, ngày sản xuất, hạn dùng, vị trí, serial (tối đa 1.000). Kết quả kiểm tra: từng dòng số không đạt theo đơn vị của dòng (hàng serial: danh sách serial không đạt), lý do không đạt (tối đa 500 ký tự), phiên bản.
- Quy trình xử lý: Danh sách đơn đã duyệt nhận vào kho người dùng có quyền (tối đa 50, ngày giao dự kiến sớm trước); dòng đơn kèm số còn nhận được (đã trừ đã nhận, đang chờ kiểm, cộng dung sai) và có cần kiểm tra chất lượng không. Lập nháp: mặt hàng, đơn vị, đơn giá lấy từ dòng đơn; kho, công ty chủ hàng, nhà cung cấp lấy từ đơn; lý do "Nhập mua theo đơn <số đơn>"; báo sớm khi vượt số còn nhận được. Gửi: khóa đơn mua, kiểm đơn còn đã duyệt và dung sai, kiểm lô, hạn, serial, vị trí như phiếu kho; cấp số theo dãy `inventory.purchase_receipt` (tiền tố `NM`); không đi luồng duyệt. Không có dòng cần kiểm tra: ghi sổ ngay với giá nhập = đơn giá dòng đơn quy về đơn vị cơ sở, cập nhật trạng thái đơn. Có: cả phiếu chuyển "Chờ kiểm tra chất lượng", chưa ghi sổ. Ghi kết quả: phần đạt ghi sổ (giá trị theo tỷ lệ phần đạt), serial không đạt bỏ khỏi dòng, số không đạt và lý do (kèm serial) ghi vào dòng; ghi người, thời điểm kiểm; cập nhật trạng thái đơn.
- Kết quả đầu ra: Phiếu kho loại `purchase_receipt` kèm nhà cung cấp, số đơn mua gốc, số không đạt, lý do từng dòng, được kiểm tra chất lượng, được trả hàng hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_33
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_64, QUYTAC_NGHIEPVU_65
- Trường hợp ngoại lệ: Không lập phiếu nhập mua ở màn hình phiếu kho thường (loại `purchase_receipt` qua API_65 bị từ chối). Hai phiếu cùng nhận một dòng: gửi khóa đơn mua nên phiếu sau kiểm lại dung sai. Phần không đạt không tính đã nhận, đơn vẫn nhận tiếp được.
- Phân quyền: Thủ kho chi nhánh khác không thấy đơn, không nhận vào kho không thuộc chi nhánh mình (403 hoặc 404).
- Thông báo lỗi: "Đơn mua chưa duyệt hoặc đã đóng, không nhận hàng được." · "Vượt số còn nhận được của đơn mua (đã tính dung sai)." · "Phiếu không ở trạng thái chờ kiểm tra chất lượng." · "Vui lòng nhập thông tin này." (lý do không đạt) · "Serial không có trong kho, vị trí này." (serial không đạt không thuộc dòng) · "Giá trị không hợp lệ." (số không đạt vượt số nhận) · lỗi phiếu kho theo CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_83, TIEUCHI_NGHIEMTHU_84, TIEUCHI_NGHIEMTHU_86

### CHUC_NANG_53: Phiếu trả hàng nhà cung cấp
- Mục đích: Trả hàng lỗi cho nhà cung cấp đúng giá đã nhập.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `inventory.purchase.receive` tại kho của phiếu nhập gốc; sửa, gửi chỉ người lập.
- Dữ liệu đầu vào: Phiếu nhập mua gốc đã ghi sổ, ngày phiếu, lý do (bắt buộc, tối đa 500 ký tự), ghi chú, 1 đến 200 dòng: dòng phiếu nhập gốc, số trả theo đơn vị của dòng gốc, serial (hàng serial).
- Quy trình xử lý: Lấy mặt hàng, đơn vị, lô, vị trí từ dòng gốc; đơn giá = giá trị đã ghi sổ của dòng gốc / số đã nhập (phần đạt) × hệ số đơn vị; serial phải thuộc dòng gốc. Gửi: khóa dòng gốc, tổng đã trả (phiếu đã ghi sổ) cộng lần này không vượt số đã nhập phần đạt; kiểm đủ hàng, serial như phiếu kho; cấp số theo dãy `inventory.purchase_return` (tiền tố `TNCC`); không đi luồng duyệt; ghi sổ xuất theo giá trị = số trả × đơn giá gốc (trả làm tồn về 0 thì xuất toàn bộ giá trị còn lại; không vượt giá trị tồn); giá vốn bình quân phần còn lại tính lại.
- Kết quả đầu ra: Phiếu kho loại `purchase_return` kèm nhà cung cấp, số phiếu nhập gốc; số đã trả hiện ở dòng đơn mua.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_33
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_66
- Trường hợp ngoại lệ: Phiếu nhập nháp, chờ kiểm tra không trả được. Trả quá số còn trả được báo khi gửi.
- Phân quyền: Như CHUC_NANG_52.
- Thông báo lỗi: "Chỉ trả hàng từ phiếu nhập mua đã ghi sổ." · "Vượt số đã nhập còn trả được của phiếu nhập gốc." · "Serial không có trong kho, vị trí này." · lỗi phiếu kho theo CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_85

## Yêu cầu phi chức năng của MODULE_04 (phần 1)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Số đã nhận, đã trả không lưu trùng, tính từ phiếu kho; gửi phiếu nhập khóa đơn mua, gửi phiếu trả khóa dòng phiếu gốc; chồng hiệu lực giá mua kiểm trong giao dịch có khóa; khóa ngoại từ `purchasing` chỉ trỏ vào `purchasing`, `core`, `catalog`, `crm` |
| Ranh giới module | Mua hàng chỉ ghi schema `purchasing`; phiếu nhập mua, trả hàng do module Kho ghi (đọc đơn mua); trạng thái "Đã nhận đủ" cập nhật qua `PurchaseOrdersService` trong giao dịch ghi sổ |
| Giao diện | Dùng được trên điện thoại |

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

Quy ước chung cho mọi chức năng của MODULE_05 phần 1:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23): mini app `sales`, loại đối tượng `sales_order` (`sales_order.create`, `.update`, `.submit`, `.cancel`, `.close`), `sales_settings` (`sales_settings.update`); phiếu xuất giao hàng, phiếu nhận hàng trả lại ghi ở mini app `inventory`, loại đối tượng `stock_document` (`stock_document.create`, `.submit`, `.delete`).
- API Bán hàng cần `sales.access` hoặc `sales.order.view` trong công ty đang làm việc; quyền chi tiết kiểm tra phía máy chủ. `sales.order.view` gán ở chi nhánh nào của công ty cũng dùng được trong công ty đó; quyền Bán hàng khác cần lần gán ở phạm vi tập đoàn hoặc công ty. Phiếu xuất giao hàng, phiếu nhận hàng trả lại cần `inventory.sales.issue` tại kho (QUYTAC_NGHIEPVU_46).
- Sửa dữ liệu gửi kèm phiên bản; khác phiên bản hiện tại thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền tệ là tiền tệ của công ty; số lượng, tiền `numeric(20,4)`.
- Số đã giao, đã trả của dòng đơn bán tính từ phiếu kho (đọc chéo module), không lưu trùng.

### CHUC_NANG_54: Đơn bán
- Mục đích: Bán hàng đúng giá bảng giá, chỉ duyệt khi có ngoại lệ, giữ hàng ngay khi gửi để không bán trùng; theo dõi đã giao, đã trả.
- Người sử dụng: Nhân viên bán hàng, quản trị công ty, quản trị tập đoàn (lập, sửa, gửi, hủy, đóng); Thủ kho (xem).
- Điều kiện thực hiện: Xem danh sách, chi tiết, danh sách chọn: `sales.order.view` hoặc `sales.order.manage`. Tra giá, tìm mặt hàng, lập, sửa, gửi, hủy, đóng: `sales.order.manage`. Rút: người lập, có `sales.order.manage`.
- Dữ liệu đầu vào: Khách hàng (trống: người mua không lấy hóa đơn), tên người mua (tối đa 200 ký tự), kênh bán, kho xuất, ngày đơn, địa chỉ giao (tối đa 500 ký tự), ghi chú (tối đa 1.000 ký tự), 1 đến 200 dòng: mặt hàng, đơn vị, số lượng lớn hơn 0 (tối đa 12 chữ số phần nguyên, 4 chữ số lẻ), chiết khấu tay phần trăm (0 đến 100, 2 chữ số lẻ, mặc định 0). Đóng: lý do (1 đến 500 ký tự), phiên bản. Hủy: phiên bản. Danh sách: trạng thái, khách hàng, từ khóa (đúng số đơn, tên khách hoặc tên người mua chứa từ khóa), trang (tối đa 100 dòng, mặc định 20).
- Quy trình xử lý: Kiểm khách là đối tác đang giao dịch có hồ sơ khách hàng đang dùng ở công ty, kênh đang dùng của công ty, kho đang dùng nhận hàng của công ty, mặt hàng, đơn vị hợp lệ. Mỗi dòng tra giá theo kênh, nhóm khách của hồ sơ khách tại ngày đơn (QUYTAC_NGHIEPVU_67); đơn giá sau chiết khấu = giá bảng giá × (1 − chiết khấu/100); bảng giá gồm thuế thì thành tiền là tổng gồm thuế, tiền chưa thuế = tổng / (1 + thuế suất); bảng giá chưa thuế thì ngược lại; lưu nháp kèm nhóm khách. Sửa khi nháp, bị từ chối, đã rút: thay toàn bộ dòng, về nháp, bỏ yêu cầu duyệt cũ, xóa ngoại lệ. Gửi đơn nháp: cấp số theo dãy `sales.order` (chưa cấu hình thì tự tạo tiền tố `DBH`, đặt lại theo năm, 6 chữ số) ở lần gửi đầu; khóa đơn, khóa hồ sơ khách; giữ hàng (QUYTAC_NGHIEPVU_70); tính ngoại lệ (QUYTAC_NGHIEPVU_68, QUYTAC_NGHIEPVU_69); có ngoại lệ thì gửi luồng duyệt với tổng gồm thuế, chưa có chính sách thì xác nhận ngay. Nghe `core.approval.completed` để chuyển đã xác nhận, bị từ chối, đã rút (từ chối, rút thì nhả hàng giữ). Hủy đơn nháp, bị từ chối, đã rút, đã xác nhận chưa có phiếu xuất giao hàng: nhả hàng giữ. Đóng đơn đã xác nhận kèm lý do: nhả hàng giữ còn lại, phần chưa giao hủy.
- Kết quả đầu ra: Danh sách (số, khách hoặc người mua, kênh, kho xuất, ngày đơn, tổng chưa thuế, thuế, tổng gồm thuế, trạng thái, người lập) mới lập trước; chi tiết: dòng kèm bảng giá, giá bảng giá, gồm thuế hay chưa, chiết khấu, đơn giá sau chiết khấu, thuế suất, tiền, đã giao, đã trả (đơn vị cơ sở); ngoại lệ (loại, dòng, diễn giải; diễn giải vượt hạn mức chỉ trả cho người có `crm.profile.manage`, diễn giải dưới giá vốn chỉ trả cho người có `inventory.cost.view`, người khác nhận chuỗi trống); phiếu kho liên quan (xuất giao hàng theo đơn và nhận hàng trả lại từ các phiếu đó); lý do đóng; phiên bản; được sửa, gửi, rút, hủy, đóng hay không. Danh sách chọn: khách hàng (kèm nhóm khách), kênh, kho xuất, tiền tệ. Giá gợi ý: giá, mã bảng giá, gồm thuế hay chưa, thuế suất của sản phẩm.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_34
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_67, QUYTAC_NGHIEPVU_68, QUYTAC_NGHIEPVU_69, QUYTAC_NGHIEPVU_70, QUYTAC_NGHIEPVU_71
- Trường hợp ngoại lệ: Đơn đã có phiếu xuất giao hàng (kể cả nháp) không hủy được, chỉ đóng. Còn phiếu xuất nháp thì chưa đóng được (nút "Đóng đơn" ẩn). Đơn của công ty khác không xem được (404).
- Phân quyền: Thủ kho chỉ xem; gọi lập, sửa nhận 403. Không có `sales.settings.manage` không thấy nút "Cài đặt".
- Thông báo lỗi: "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty." · "Chưa có giá cho mặt hàng này." · "Không đủ hàng khả dụng (một phần đang được giữ)." · "Đơn bán đã có phiếu xuất giao hàng hoặc không ở trạng thái hủy được; hãy đóng đơn." · "Đơn bán còn phiếu xuất giao hàng nháp, chưa đóng được." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Giá trị không hợp lệ." (kênh, kho, đơn vị, số, chiết khấu)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_87, TIEUCHI_NGHIEMTHU_88, TIEUCHI_NGHIEMTHU_89, TIEUCHI_NGHIEMTHU_90, TIEUCHI_NGHIEMTHU_92
- Bổ sung CONG_VIEC_12: khi lưu, khuyến mãi tự áp theo CHUC_NANG_63; dòng đơn thêm trường khuyến mãi, dòng hàng tặng; gửi đơn kiểm giới hạn khuyến mãi (CHUC_NANG_64).
- Bổ sung CONG_VIEC_13 (THAY_DOI_09): ngoại lệ vượt hạn mức công nợ tính theo dư nợ thật (CHUC_NANG_68, QUYTAC_NGHIEPVU_92) thay dư nợ tạm tính (QUYTAC_NGHIEPVU_69).

### CHUC_NANG_55: Cài đặt bán hàng
- Mục đích: Công ty đặt mức chiết khấu tay tối đa không cần duyệt.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Xem: `sales.order.view`, `sales.order.manage` hoặc `sales.settings.manage`. Sửa: `sales.settings.manage`.
- Dữ liệu đầu vào: Chiết khấu tay tối đa (0 đến 100, 2 chữ số lẻ; trống là 0), phiên bản (0 khi chưa có).
- Quy trình xử lý: Kiểm phiên bản; lưu (chưa có thì thêm, có thì sửa), ghi nhật ký kèm giá trị trước.
- Kết quả đầu ra: Mức chiết khấu tay tối đa, phiên bản (chưa có: "0", 0).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_34
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_68
- Trường hợp ngoại lệ: Đổi mức không tính lại ngoại lệ của đơn đã gửi.
- Phân quyền: Người không có `sales.settings.manage` sửa nhận 403.
- Thông báo lỗi: "Giá trị không hợp lệ." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_88

### CHUC_NANG_56: Phiếu xuất giao hàng theo đơn bán
- Mục đích: Kho giao đúng hàng của đơn bán, giao nhiều lần, dùng hàng đã giữ.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `inventory.sales.issue` tại kho xuất của đơn bán; gửi, xóa nháp chỉ người lập.
- Dữ liệu đầu vào: Đơn bán đã xác nhận, ngày phiếu, ghi chú (tối đa 1.000 ký tự), 1 đến 200 dòng: dòng đơn bán, số giao theo đơn vị của dòng đơn, lô, lý do chọn lô khác gợi ý (tối đa 200 ký tự), vị trí, serial (tối đa 1.000).
- Quy trình xử lý: Danh sách đơn đã xác nhận xuất từ kho người dùng có quyền (tối đa 50, ngày đơn sớm trước; tìm theo số đơn, tên khách, tên người mua); dòng đơn kèm số đặt, số còn phải giao theo đơn vị của dòng. Lập nháp: mặt hàng, đơn vị lấy từ dòng đơn; kho, công ty chủ hàng, khách lấy từ đơn; lý do "Bán hàng", diễn giải "Giao hàng theo đơn <số đơn>"; kiểm như phiếu kho; báo sớm khi vượt số còn phải giao. Gửi: khóa phiếu, khóa đơn, kiểm đơn còn đã xác nhận và tổng đã giao (phiếu đã ghi sổ) cộng lần này không vượt số đặt; dùng phần đang giữ của đơn cho từng mặt hàng; kiểm đủ hàng khả dụng, lô, hạn, serial, vị trí như phiếu kho; cấp số theo dãy `inventory.sales_issue` (tiền tố `XBH`); không đi luồng duyệt; ghi sổ xuất theo giá vốn bình quân; giao đủ mọi dòng thì đơn chuyển "Đã giao đủ", phần giữ còn sót đánh dấu đã dùng.
- Kết quả đầu ra: Phiếu kho loại `sales_issue` kèm khách hàng, số đơn bán gốc, được nhận hàng trả lại hay không; số đã giao hiện ở dòng đơn bán.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_35
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_70, QUYTAC_NGHIEPVU_71
- Trường hợp ngoại lệ: Không lập phiếu xuất giao hàng ở màn hình phiếu kho thường (loại `sales_issue` qua API_65 bị từ chối). Phiếu nháp không sửa, chỉ gửi hoặc xóa. Hai phiếu cùng giao một dòng: gửi khóa đơn nên phiếu sau kiểm lại số còn phải giao.
- Phân quyền: Thủ kho chi nhánh khác không thấy đơn, không giao từ kho không thuộc chi nhánh mình (403 hoặc 404).
- Thông báo lỗi: "Đơn bán chưa xác nhận hoặc đã đóng, không giao hàng được." · "Vượt số còn phải giao của đơn bán." · "Không đủ hàng khả dụng (một phần đang được giữ)." · "Giá trị không hợp lệ." (dòng đơn) · lỗi phiếu kho theo CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_90, TIEUCHI_NGHIEMTHU_92

### CHUC_NANG_57: Phiếu nhận hàng trả lại
- Mục đích: Nhận hàng khách trả, gắn đúng đơn gốc, nhập lại đúng giá vốn đã xuất.
- Người sử dụng: Thủ kho, Quản lý kho, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `inventory.sales.issue` tại kho của phiếu xuất gốc; gửi, xóa nháp chỉ người lập.
- Dữ liệu đầu vào: Phiếu xuất giao hàng gốc đã ghi sổ, ngày phiếu, lý do (bắt buộc, tối đa 500 ký tự), ghi chú, 1 đến 200 dòng: dòng phiếu xuất gốc, số trả theo đơn vị cơ sở của mặt hàng (trả được một phần của dòng giao theo đơn vị quy đổi), serial (hàng serial).
- Quy trình xử lý: Lấy mặt hàng, lô, vị trí từ dòng gốc, đơn vị là đơn vị cơ sở; đơn giá = giá trị đã ghi sổ của dòng gốc / số đã giao theo đơn vị cơ sở; serial phải thuộc dòng gốc; lý do mã "Khách trả hàng"; khách hàng theo phiếu gốc. Gửi: khóa dòng gốc, tổng đã trả (phiếu đã ghi sổ) cộng lần này không vượt số đã giao; kiểm serial, lô như phiếu kho; cấp số theo dãy `inventory.sales_return` (tiền tố `NTL`); không đi luồng duyệt; ghi sổ nhập theo đơn giá gốc.
- Kết quả đầu ra: Phiếu kho loại `sales_return` kèm khách hàng, số phiếu xuất gốc; số đã trả hiện ở dòng đơn bán.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_35
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_72
- Trường hợp ngoại lệ: Phiếu xuất nháp không trả được. Trả quá số còn trả được báo khi gửi. Trả hàng không đổi trạng thái đơn bán.
- Phân quyền: Như CHUC_NANG_56.
- Thông báo lỗi: "Chỉ nhận hàng trả lại từ phiếu xuất giao hàng đã ghi sổ." · "Vượt số đã giao còn trả được của phiếu xuất gốc." · "Serial không có trong kho, vị trí này." (serial không thuộc dòng gốc) · lỗi phiếu kho theo CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_91

## Yêu cầu phi chức năng của MODULE_05 (phần 1)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Số đã giao, đã trả không lưu trùng, tính từ phiếu kho; gửi đơn khóa đơn và hồ sơ khách; gửi phiếu xuất khóa đơn bán; gửi phiếu trả khóa dòng phiếu xuất gốc; kiểm hàng khả dụng khi gửi phiếu đọc trong giao dịch; khóa ngoại từ `sales` chỉ trỏ vào `sales`, `core`, `catalog`, `crm` |
| Ranh giới module | Bán hàng chỉ ghi schema `sales`; giữ hàng ghi qua `ReservationsService` của module Kho; phiếu xuất giao hàng, nhận hàng trả lại do module Kho ghi (đọc đơn bán); trạng thái "Đã giao đủ" cập nhật qua `SalesOrdersService` trong giao dịch ghi sổ |
| Giao diện | Dùng được trên điện thoại |

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

Quy ước chung cho mọi chức năng của MODULE_05 phần 2:
- Mọi thao tác ghi dữ liệu ghi một dòng nhật ký thao tác (CHUC_NANG_23): `sales_order.counterpart_confirm`, `.counterpart_reject` (mini app `sales`); `purchase_order.counterpart_confirm`, `.counterpart_reject` (mini app `purchasing`); `stock_document.receive_internal`, `internal_discrepancy.resolve` (mini app `inventory`). Chứng từ bên kia sinh, kết thúc theo chứng từ khởi tạo trong cùng giao dịch, lý do ghi trên chứng từ.
- Không thêm quyền (tài liệu `08` mục 12). Mỗi bên chỉ xem, thao tác chứng từ của công ty đang làm việc; chứng từ đối ứng chỉ hiện tên công ty bên kia, số, trạng thái.
- Xác nhận, từ chối, nhận hàng, xử lý biên bản gửi kèm phiên bản; khác phiên bản hoặc chứng từ không còn ở trạng thái chờ thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Bán hàng ghi `sales`, Mua hàng ghi `purchasing`, Kho ghi `inventory`; sinh, kết thúc chứng từ bên kia qua service của module sở hữu (`InternalTradeService` nối hai module).

### CHUC_NANG_58: Đơn bán nội bộ sinh đơn mua đối ứng
- Mục đích: Công ty bán nhập đơn một lần; công ty mua nhận đơn mua đối ứng để xác nhận, đi luồng duyệt của mình.
- Người sử dụng: Nhân viên bán hàng công ty bán (lập, gửi); Nhân viên mua hàng công ty mua (xác nhận, từ chối); quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Đơn bán: như CHUC_NANG_54. Xác nhận, từ chối đơn mua đối ứng: `purchasing.order.manage` ở công ty mua, đơn "Chờ xác nhận nội bộ".
- Dữ liệu đầu vào: Đơn bán như CHUC_NANG_54, khách là đối tác nội bộ. Xác nhận: kho nhận, phiên bản. Từ chối: lý do (1 đến 500 ký tự), phiên bản.
- Quy trình xử lý: Khi lưu và khi gửi kiểm điều kiện nội bộ (QUYTAC_NGHIEPVU_73). Đơn bán chuyển "Đã xác nhận" (ngay khi gửi hoặc khi duyệt xong): sinh đơn mua đối ứng ở công ty mua, "Chờ xác nhận nội bộ", nhà cung cấp là đối tác nội bộ của công ty bán, chưa có kho, chưa có số, ngày đơn theo đơn bán; mỗi dòng: mặt hàng liên kết, đơn vị cơ sở bên mua, số lượng = số lượng cơ sở × hệ số liên kết, đơn giá = tiền chưa thuế của dòng đơn bán / số lượng bên mua (làm tròn 4 chữ số), thuế suất theo dòng đơn bán; hai đơn trỏ nhau. Xác nhận: kiểm kho nhận của công ty, ghi kho, về nháp, người xác nhận thành người lập, gửi luồng duyệt đơn mua (QUYTAC_NGHIEPVU_63; chưa có chính sách thì duyệt ngay, cấp số `DMH`). Từ chối: đơn mua đóng, ghi lý do từ chối; đơn bán kết thúc theo QUYTAC_NGHIEPVU_78. Rút, không duyệt đơn mua đối ứng: đóng, đơn bán kết thúc theo.
- Kết quả đầu ra: Chi tiết đơn bán, đơn mua thêm: nội bộ hay không, là đơn đối ứng hay không, chứng từ đối ứng (tên công ty, số, trạng thái), lý do bên kia từ chối, được xác nhận đơn đối ứng hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_36
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_73, QUYTAC_NGHIEPVU_74, QUYTAC_NGHIEPVU_75, QUYTAC_NGHIEPVU_78
- Trường hợp ngoại lệ: Đơn mua đối ứng không sửa dòng được (409). Đơn bán nội bộ chưa có đơn mua đối ứng đã duyệt thì không giao được. Kho nhận không thuộc công ty, ngừng dùng: lỗi ô kho.
- Phân quyền: Người không có `purchasing.order.manage` ở công ty mua xác nhận, từ chối nhận 403. Công ty bán không xem được đơn mua của công ty mua (404).
- Thông báo lỗi: "Đơn bán cho công ty con phải dùng kênh bán Nội bộ." · "Công ty bên kia chưa có hồ sơ đối tác đang dùng cho công ty này (khách hàng ở công ty bán, nhà cung cấp ở công ty mua)." · "Hai công ty dùng tiền tệ khác nhau, chưa giao dịch nội bộ được." · "Mặt hàng chưa liên kết với sản phẩm của công ty bên kia." · "Đơn mua đối ứng của công ty mua chưa được duyệt, chưa giao được." · "Giá trị không hợp lệ." (kho)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_93, TIEUCHI_NGHIEMTHU_97, TIEUCHI_NGHIEMTHU_98

### CHUC_NANG_59: Đơn mua nội bộ sinh đơn bán đối ứng
- Mục đích: Công ty mua đặt hàng công ty con khác đúng giá nội bộ; công ty bán nhận đơn bán đối ứng để xác nhận, giữ hàng.
- Người sử dụng: Nhân viên mua hàng công ty mua (lập, gửi); Nhân viên bán hàng công ty bán (xác nhận, từ chối); quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Đơn mua: như CHUC_NANG_51. Xác nhận, từ chối đơn bán đối ứng: `sales.order.manage` ở công ty bán, đơn "Chờ xác nhận nội bộ".
- Dữ liệu đầu vào: Đơn mua như CHUC_NANG_51, nhà cung cấp là đối tác nội bộ (đơn giá, thuế suất gửi lên bị thay). Xác nhận: kho xuất, phiên bản. Từ chối: lý do (1 đến 500 ký tự), phiên bản.
- Quy trình xử lý: Khi lưu kiểm điều kiện nội bộ (QUYTAC_NGHIEPVU_73), lấy giá chưa thuế, thuế suất theo bảng giá kênh Nội bộ của công ty bán (QUYTAC_NGHIEPVU_75); tra giá gợi ý qua API_73 trả thêm `internal.vatRate`. Đơn mua chuyển "Đã duyệt": sinh đơn bán đối ứng ở công ty bán, "Chờ xác nhận nội bộ", khách là đối tác nội bộ của công ty mua, kênh Nội bộ, nhóm khách theo hồ sơ, chưa có kho, chưa có số; mỗi dòng: mặt hàng liên kết, đơn vị cơ sở bên bán, số lượng quy theo liên kết, giá chưa thuế = thành tiền dòng đơn mua / số lượng bên bán (làm tròn 4 chữ số), thuế suất theo đơn mua, không chiết khấu. Xác nhận: kiểm kho, ghi kho, về nháp, người xác nhận thành người lập, gửi như CHUC_NANG_54 (cấp số `DBH`, giữ hàng, ngoại lệ, duyệt). Từ chối: đơn bán hủy, ghi lý do; đơn mua đóng theo. Rút, không duyệt đơn bán đối ứng: hủy, đơn mua đóng theo.
- Kết quả đầu ra: Như CHUC_NANG_58; trên form đơn mua, nhà cung cấp nội bộ thì đơn giá, thuế suất chỉ đọc kèm chú thích.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_36
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_73, QUYTAC_NGHIEPVU_74, QUYTAC_NGHIEPVU_75, QUYTAC_NGHIEPVU_78
- Trường hợp ngoại lệ: Không có giá nội bộ thì không lưu được dòng. Không đủ hàng khả dụng khi xác nhận: báo lỗi theo dòng, đơn giữ "Chờ xác nhận nội bộ". Đơn mua đã có đơn bán đối ứng không sửa được. Đơn bán đối ứng "Chờ xác nhận nội bộ" không hủy được, chỉ từ chối.
- Phân quyền: Người không có `sales.order.manage` ở công ty bán xác nhận, từ chối nhận 403.
- Thông báo lỗi: "Công ty bán chưa có kênh bán Nội bộ đang dùng." · "Chưa có giá cho mặt hàng này." · "Không đủ hàng khả dụng (một phần đang được giữ)." · thông báo nội bộ như CHUC_NANG_58
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_94, TIEUCHI_NGHIEMTHU_97, TIEUCHI_NGHIEMTHU_98

### CHUC_NANG_60: Giao, nhận hàng nội bộ
- Mục đích: Hàng xuất ở công ty bán tự thành phiếu nhập chờ nhận ở công ty mua; bên mua chỉ nhập số thực nhận.
- Người sử dụng: Thủ kho công ty bán (xuất); Thủ kho công ty mua (nhận); Quản lý kho, quản trị.
- Điều kiện thực hiện: Xuất: như CHUC_NANG_56, thêm đơn mua đối ứng đã duyệt. Nhận: `inventory.purchase.receive` tại kho nhận, phiếu "Chờ nhận".
- Dữ liệu đầu vào: Nhận: mọi dòng của phiếu (1 đến 200): số thực nhận theo đơn vị cơ sở bên mua (0 trở lên, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ), vị trí, serial đã nhận (tối đa 5.000); lý do thiếu (tối đa 500 ký tự, bắt buộc khi nhận thiếu); phiên bản.
- Quy trình xử lý: Lập, gửi phiếu xuất giao hàng theo đơn bán nội bộ kiểm đơn mua đối ứng "Đã duyệt". Ghi sổ phiếu xuất: sinh phiếu nhập mua `in_transit` ở công ty mua, kho nhận của đơn mua, nguồn đơn mua, nhà cung cấp là đối tác nội bộ của công ty bán, trỏ phiếu xuất; mỗi dòng ghép dòng đơn mua cùng số thứ tự với dòng đơn bán: mặt hàng bên mua, đơn vị cơ sở, số lượng = số xuất cơ sở × hệ số liên kết, đơn giá = đơn giá dòng đơn mua quy về đơn vị cơ sở, lô, ngày sản xuất, hạn dùng theo dòng xuất, trỏ dòng xuất. Nhận: kiểm đủ dòng, không vượt số xuất, serial thuộc serial đã xuất, thiếu phải có lý do; bỏ dòng nhận 0; kiểm như phiếu kho (vị trí, lô); khóa phiếu; cấp số theo dãy `inventory.purchase_receipt` của công ty mua; ghi sổ, cập nhật số đã nhận của đơn mua (nhận đủ, cho phép lệch 0,0005 thì "Đã nhận đủ"); dòng thiếu sinh biên bản (CHUC_NANG_61).
- Kết quả đầu ra: Chi tiết phiếu kho thêm: phiếu xuất gốc (số, tên công ty bán); khi chờ nhận: số xuất, serial xuất từng dòng; được nhận hàng nội bộ hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_36
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_76, QUYTAC_NGHIEPVU_77
- Trường hợp ngoại lệ: Đơn mua nội bộ không lập phiếu nhập mua thường, không hiện trong danh sách đơn chờ nhận. Phiếu đã nhận thì nhận lại bị từ chối. Nhận 0 mọi dòng: phiếu ghi sổ không có dòng, mọi dòng sinh biên bản.
- Phân quyền: Thủ kho không có quyền tại kho nhận (kể cả thủ kho công ty bán) không nhận được.
- Thông báo lỗi: "Đơn mua đối ứng của công ty mua chưa được duyệt, chưa giao được." · "Phiếu nhập nội bộ không ở trạng thái chờ nhận." · "Số nhận vượt số đã xuất." · "Serial không có trong phiếu xuất gốc." · "Nhận thiếu phải ghi lý do." · "Phải nhập số nhận cho mọi dòng của phiếu." · "Đơn mua nội bộ chỉ nhận theo phiếu nhập sinh từ phiếu xuất của công ty bán." · lỗi phiếu kho theo CHUC_NANG_40
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_95, TIEUCHI_NGHIEMTHU_98

### CHUC_NANG_61: Biên bản chênh lệch giao nhận nội bộ
- Mục đích: Phần hàng giao thiếu có biên bản ở công ty bán và người xử lý.
- Người sử dụng: Thủ kho, Quản lý kho công ty bán; quản trị.
- Điều kiện thực hiện: `inventory.sales.issue` tại kho xuất của biên bản, công ty đang làm việc là công ty bán.
- Dữ liệu đầu vào: Danh sách: trạng thái (chờ xử lý, đã nhập lại kho, đã ghi tổn thất). Xử lý: cách xử lý (nhập lại kho, ghi tổn thất), ghi chú (tối đa 500 ký tự, không bắt buộc), phiên bản.
- Quy trình xử lý: Khi nhận thiếu, mỗi dòng xuất thiếu sinh một biên bản: công ty, kho xuất, phiếu xuất, dòng xuất, phiếu nhập, dòng nhập (trống khi nhận 0), mặt hàng bên bán, số thiếu = số xuất cơ sở × tỷ lệ thiếu (làm tròn 4 chữ số), giá trị = giá vốn dòng xuất × tỷ lệ thiếu, serial đã xuất chưa nhận, lý do bên nhận. Danh sách: biên bản của công ty tại các kho người dùng có quyền, mới trước, tối đa 500. Xử lý: giữ biên bản (kiểm "Chờ xử lý", phiên bản), ghi cách xử lý, ghi chú, người, thời điểm; nhập lại kho thì lập, ghi sổ phiếu nhận hàng trả lại theo phiếu xuất gốc (CHUC_NANG_57) với số thiếu, serial chưa nhận, lý do "Hàng thiếu khi giao nội bộ: <lý do>", lưu phiếu trả vào biên bản; lỗi thì xóa phiếu nháp, trả biên bản về "Chờ xử lý".
- Kết quả đầu ra: Danh sách: mặt hàng (mã, tên, kho), số thiếu (đơn vị cơ sở), serial, phiếu xuất, công ty mua, phiếu nhập, lý do, thời điểm, giá trị (chỉ người có `inventory.cost.view` tại kho hoặc công ty; người khác nhận trống), trạng thái, người xử lý, ghi chú, phiếu trả, được xử lý hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_36
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_77
- Trường hợp ngoại lệ: Biên bản đã xử lý thì xử lý lần nữa bị từ chối (409). Công ty mua không thấy biên bản.
- Phân quyền: Không có `inventory.sales.issue` tại kho xuất: danh sách không có biên bản của kho đó, xử lý nhận 403 (không có quyền vào kho thì 404).
- Thông báo lỗi: "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất." · lỗi phiếu nhận hàng trả lại theo CHUC_NANG_57
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_96, TIEUCHI_NGHIEMTHU_98
- Bổ sung CONG_VIEC_13: "Ghi tổn thất" giảm phải thu của công ty mua đúng giá trị phần thiếu theo giá đơn bán, trừ trước vào phiếu xuất gốc, cùng giao dịch đóng biên bản (CHUC_NANG_66, QUYTAC_NGHIEPVU_86, quyết định của người dùng 2026-11-10).

## Yêu cầu phi chức năng của MODULE_05 (phần 2)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Sinh, kết thúc chứng từ đối ứng, sinh phiếu nhập chờ nhận trong cùng giao dịch với chứng từ khởi tạo; hai đơn trỏ nhau bằng mã, không khóa ngoại khác schema (kiểm trong service); nhận hàng khóa phiếu nhập theo phiên bản; xử lý biên bản giữ biên bản trước khi nhập lại kho |
| Ranh giới module | Bán hàng ghi `sales`, Mua hàng ghi `purchasing`, Kho ghi `inventory`; `InternalTradeService` (module Bán hàng) đăng ký móc nối vào `SalesOrdersService`, `PurchaseOrdersService` khi khởi động |
| Giao diện | Dùng được trên điện thoại |

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

Quy ước chung cho mọi chức năng của MODULE_05 phần 3:
- Thao tác ghi chương trình ghi nhật ký thao tác (CHUC_NANG_23): mini app `sales`, loại đối tượng `promotion` (`promotion.create`, `.update`, `.submit`, `.stop`); rút ghi ở yêu cầu duyệt (Luồng 5). Áp khuyến mãi vào đơn bán ghi theo nhật ký của đơn bán (`sales_order.create`, `.update`).
- Quyền `sales.promotion.view`, `sales.promotion.manage` gán ở phạm vi tập đoàn hoặc công ty (tài liệu `08` mục 13). Chương trình chỉ xem, thao tác trong công ty đang làm việc; chương trình công ty khác trả 404.
- Sửa, dừng gửi kèm phiên bản; khác phiên bản thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền gồm thuế, tiền tệ của công ty; tiền, số lượng `numeric(20,4)`, phần trăm 2 chữ số lẻ. Đã dùng tính từ dòng đơn bán, không lưu trùng.

### CHUC_NANG_62: Chương trình khuyến mãi
- Mục đích: Bộ phận kinh doanh khai báo chương trình một lần, được duyệt rồi mới chạy, dừng khi cần.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn (lập, sửa, gửi duyệt, rút, dừng); Nhân viên bán hàng (xem).
- Điều kiện thực hiện: Xem danh sách, chi tiết, lựa chọn kênh, nhóm khách: `sales.promotion.view` hoặc `sales.promotion.manage`. Lập, sửa, gửi duyệt, dừng: `sales.promotion.manage`. Rút: người lập, có `sales.promotion.manage`, chương trình chờ duyệt, cấp duyệt đầu chưa quyết định. Tìm mặt hàng (API_77 `/sales/items`): `sales.order.manage` hoặc `sales.promotion.manage`.
- Dữ liệu đầu vào: Tên (1 đến 200 ký tự), loại (giảm theo sản phẩm, giảm theo đơn, mua X tặng Y), từ ngày, đến ngày (không trước từ ngày), kênh (tối đa 50), nhóm khách (tối đa 50), ghi chú (tối đa 1.000 ký tự). Giảm theo sản phẩm: 1 đến 500 mặt hàng không trùng, mỗi mặt hàng phần trăm giảm lớn hơn 0 đến 100. Giảm theo đơn: ngưỡng tổng đơn gồm thuế (bắt buộc, từ 0), phần trăm giảm (bắt buộc, lớn hơn 0 đến 100), mức giảm tối đa (lớn hơn 0, trống: không giới hạn). Mua X tặng Y: mặt hàng mua, số lượng mua, mặt hàng tặng, số lượng tặng mỗi suất (bắt buộc, số lượng lớn hơn 0, đơn vị cơ sở), số suất tối đa (số nguyên lớn hơn 0, trống: không giới hạn). Ngân sách gồm thuế (lớn hơn 0, trống: không giới hạn; chỉ giảm theo sản phẩm, giảm theo đơn). Sửa: phiên bản. Dừng: lý do (1 đến 500 ký tự), phiên bản. Danh sách: trạng thái.
- Quy trình xử lý: Kiểm mặt hàng là mặt hàng đang bán của công ty (biến thể, sản phẩm đang dùng), kênh đang dùng của công ty không phải kênh Nội bộ, nhóm khách đang dùng của công ty; mua X tặng Y có ngân sách thì lỗi ô ngân sách. Lưu nháp chỉ giữ trường của loại đã chọn, thay toàn bộ mặt hàng, kênh, nhóm khách. Sửa khi nháp, bị từ chối, đã rút: về nháp, bỏ liên kết yêu cầu duyệt cũ. Gửi: cấp số theo dãy `sales.promotion` (chưa cấu hình thì tự tạo tiền tố `KM`) ở lần gửi đầu; gửi luồng duyệt với giá trị là ngân sách (trống thì 0); chưa có chính sách duyệt thì "Đang chạy" ngay, có thì "Chờ duyệt". Nghe `core.approval.completed`: duyệt xong thì "Đang chạy", từ chối thì "Bị từ chối", rút thì "Đã rút". Rút: rút yêu cầu duyệt, chương trình "Đã rút". Dừng: chương trình đang chạy chuyển "Đã dừng", ghi lý do, người, thời điểm.
- Kết quả đầu ra: Danh sách (số, tên, loại, từ ngày, đến ngày, trạng thái, đã dùng: tiền đã giảm, số suất đã tặng, ngân sách, số suất tối đa, người lập) mới lập trước, tối đa 500. Chi tiết thêm: kênh, nhóm khách, mặt hàng (mã, tên, phần trăm), ngưỡng, phần trăm, mức giảm tối đa, mặt hàng mua, tặng (mã, tên, số lượng, đơn vị cơ sở), ghi chú, yêu cầu duyệt, lý do dừng, tiền tệ, phiên bản, được sửa, gửi, rút, dừng hay không. Lựa chọn: kênh đang dùng (trừ Nội bộ), nhóm khách đang dùng, tiền tệ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_37
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_79, QUYTAC_NGHIEPVU_80, QUYTAC_NGHIEPVU_84
- Trường hợp ngoại lệ: Chương trình đang chạy, chờ duyệt, đã dừng không sửa, gửi được (409). Dừng chương trình không đang chạy hoặc sai phiên bản: 409. Chương trình đã dừng không chạy lại được.
- Phân quyền: Nhân viên bán hàng lập, sửa, gửi, dừng nhận 403; người không phải người lập rút nhận 403.
- Thông báo lỗi: "Vui lòng nhập thông tin này." (thiếu mặt hàng, ngưỡng, phần trăm, mặt hàng mua, tặng, số lượng) · "Giá trị không hợp lệ." (mặt hàng ngừng bán, kênh, nhóm khách, phần trăm, đến ngày trước từ ngày, mặt hàng trùng, ngân sách cho mua X tặng Y) · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất." · "Bạn không có quyền thực hiện thao tác này."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_99, TIEUCHI_NGHIEMTHU_104

### CHUC_NANG_63: Tự áp dụng khuyến mãi vào đơn bán
- Mục đích: Người bán không tính tay; đơn bán thỏa điều kiện tự được giảm, tự có hàng tặng.
- Người sử dụng: Nhân viên bán hàng, quản trị (lập, sửa đơn bán).
- Điều kiện thực hiện: Lập, sửa đơn bán (CHUC_NANG_54), `sales.order.manage`.
- Dữ liệu đầu vào: Đơn bán như CHUC_NANG_54 (không gửi dòng hàng tặng; dòng tặng do hệ thống tạo).
- Quy trình xử lý: Sau khi tra giá dòng, trong cùng giao dịch lưu đơn: bỏ qua nếu khách là đối tác nội bộ. Lấy chương trình đang chạy của công ty, ngày đơn trong thời gian hiệu lực, có kênh của đơn (hoặc không giới hạn kênh và kênh không phải Nội bộ), có nhóm khách của đơn (hoặc không giới hạn nhóm khách); đã dùng không tính đơn đang lưu. Giảm theo sản phẩm, giảm theo đơn, mua X tặng Y tính theo QUYTAC_NGHIEPVU_81, QUYTAC_NGHIEPVU_82. Mỗi dòng ghi chương trình theo sản phẩm (dòng tặng: chương trình tặng), phần trăm, chương trình theo đơn, phần giảm theo đơn gồm thuế, tổng giảm do khuyến mãi gồm thuế, là dòng tặng, số suất; đơn ghi suất tặng thiếu (tên chương trình, số suất thiếu) khi kho xuất không đủ hàng tặng; đơn giá, tiền chưa thuế, thuế, thành tiền sau khuyến mãi; tổng đơn cộng từ dòng. Gửi đơn: khóa chương trình đơn đã áp, kiểm lại ngân sách, số suất (CHUC_NANG_64); ngoại lệ dưới giá vốn so giá trước khuyến mãi, bỏ qua dòng tặng (QUYTAC_NGHIEPVU_83); giữ hàng, giao hàng, trả hàng dòng tặng như dòng thường.
- Kết quả đầu ra: Dòng chi tiết đơn bán thêm: là hàng tặng, tên chương trình theo sản phẩm (hoặc chương trình tặng), phần trăm khuyến mãi, tên chương trình theo đơn, phần giảm theo đơn của dòng; đơn thêm danh sách suất tặng thiếu.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_37
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_81, QUYTAC_NGHIEPVU_83, QUYTAC_NGHIEPVU_84
- Trường hợp ngoại lệ: Chương trình hết thời gian, đã dừng thì đơn lưu sau đó không áp; đơn đã lưu giữ khuyến mãi đến khi lưu lại. Mặt hàng tặng ngừng bán thì không thêm dòng tặng. Kho xuất không đủ hàng tặng thì tặng theo tồn còn lại, ghi suất thiếu trên đơn (quyết định của người dùng); không đủ một suất thì không có dòng tặng.
- Phân quyền: Như CHUC_NANG_54.
- Thông báo lỗi: như CHUC_NANG_54. Cảnh báo ở chi tiết đơn: "<chương trình>: thiếu <số> suất tặng do kho xuất không đủ hàng tặng."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_100, TIEUCHI_NGHIEMTHU_101, TIEUCHI_NGHIEMTHU_103, TIEUCHI_NGHIEMTHU_104

### CHUC_NANG_64: Theo dõi đã dùng, dừng khi hết
- Mục đích: Chương trình không vượt ngân sách, số suất; người quản lý thấy đã dùng bao nhiêu.
- Người sử dụng: Quản trị công ty, quản trị tập đoàn; Nhân viên bán hàng (xem).
- Điều kiện thực hiện: Xem: như CHUC_NANG_62. Kiểm giới hạn: tự động khi lưu, gửi đơn bán.
- Dữ liệu đầu vào: Không nhập thêm.
- Quy trình xử lý: Đã dùng = tổng trên dòng đơn bán của các đơn chờ duyệt, đã xác nhận, đã giao đủ, đã đóng: tiền đã giảm (phần giảm theo sản phẩm của dòng không phải hàng tặng cộng phần giảm theo đơn) và số suất đã tặng (QUYTAC_NGHIEPVU_82). Khi lưu đơn, chương trình không đủ ngân sách, số suất còn lại được xử lý theo QUYTAC_NGHIEPVU_82. Khi gửi đơn, khóa các chương trình đơn đã áp theo thứ tự mã, cộng đã dùng của các đơn khác với đơn này; vượt ngân sách hoặc số suất thì từ chối gửi.
- Kết quả đầu ra: "Đã giảm <tiền> / <ngân sách hoặc ∞>" hoặc "Đã tặng <số> / <số suất tối đa hoặc ∞> suất" ở danh sách, chi tiết chương trình.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_37
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_82
- Trường hợp ngoại lệ: Đơn bị từ chối, rút, hủy không còn tính vào đã dùng. Hai đơn gửi đồng thời cùng chương trình: khóa chương trình nên đơn sau kiểm lại.
- Phân quyền: Như CHUC_NANG_62.
- Thông báo lỗi: "Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi." (409)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_102

## Yêu cầu phi chức năng của MODULE_05 (phần 3)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Áp khuyến mãi trong cùng giao dịch lưu đơn; gửi đơn khóa chương trình đã áp trước khi kiểm giới hạn; đã dùng tính từ dòng đơn bán, không lưu trùng; khóa ngoại từ `sales` chỉ trỏ vào `sales`, `core`, `catalog` |
| Ranh giới module | Tính khuyến mãi ở `promotion-pricing.ts` (chỉ đọc chương trình), gọi từ `SalesOrdersService`; dùng lại luồng duyệt, dãy số chứng từ, tra giá, giữ hàng có sẵn |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

Quy ước chung cho mọi chức năng của MODULE_06 phần 1:
- Thao tác ghi nhật ký thao tác (CHUC_NANG_23): mini app `finance`, loại đối tượng `fund` (`fund.create`, `.update`), `debt_item` (`debt.opening.create`, `debt.opening.delete`), `payment` (`payment.create`, `.update`, `.submit`, `.withdraw`). Công nợ tự phát sinh ghi theo nhật ký của phiếu kho.
- Quyền `finance.*` chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (tài liệu `08` mục 14). Mọi API trước hết cần `finance.access` hoặc `finance.debt.view` ở công ty đang chọn. Dữ liệu chỉ xem, thao tác trong công ty đang làm việc; của công ty khác trả 404.
- Sửa gửi kèm phiên bản; khác phiên bản thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền gồm thuế, tiền tệ của công ty, `numeric(20,4)`; số trả về dạng chuỗi bỏ số 0 thừa. So sánh tiền cho phép sai số làm tròn 0,00005.

### CHUC_NANG_65: Quỹ
- Mục đích: Biết số tiền đang có ở từng quỹ tiền mặt, tài khoản ngân hàng; xem thu, chi theo ngày.
- Người sử dụng: Kế toán, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: Danh sách: `finance.debt.view`, `finance.fund.manage` hoặc `finance.payment.manage`. Chi tiết, sổ quỹ: `finance.debt.view` hoặc `finance.fund.manage`. Thêm, sửa, ngừng dùng: `finance.fund.manage`.
- Dữ liệu đầu vào: Mã (1 đến 20 ký tự), tên (1 đến 200 ký tự), loại (tiền mặt, ngân hàng), tên ngân hàng (tối đa 200 ký tự), số tài khoản (tối đa 50), chủ tài khoản (tối đa 200), số dư đầu (không âm, 4 chữ số lẻ, mặc định 0), trạng thái (đang dùng, ngừng dùng), phiên bản khi sửa. Sổ quỹ: từ ngày, đến ngày.
- Quy trình xử lý: Kiểm ngân hàng có tên ngân hàng, số tài khoản; mã không trùng trong công ty (không phân biệt hoa thường). Tiền mặt bỏ thông tin ngân hàng khi lưu. Sửa: khóa quỹ, kiểm phiên bản; quỹ có phiếu chờ duyệt hoặc đã ghi sổ thì không đổi được số dư đầu (QUYTAC_NGHIEPVU_85). Số dư hiện tại = số dư đầu + phiếu thu đã ghi sổ − phiếu chi đã ghi sổ. Sổ quỹ: số dư đầu kỳ = số dư đầu + phiếu đã ghi sổ trước từ ngày; các phiếu đã ghi sổ trong khoảng theo ngày, thời điểm ghi sổ (tối đa 5.000 dòng); số dư lũy kế; số dư cuối kỳ.
- Kết quả đầu ra: Danh sách (mã, tên, loại, thông tin ngân hàng, số dư đầu, số dư hiện tại, trạng thái, đã có phiếu ghi sổ hay không, tiền tệ, phiên bản, được quản lý hay không), quỹ đang dùng trước, theo mã. Sổ quỹ: quỹ, khoảng ngày, số dư đầu kỳ, dòng (ngày, số phiếu, loại, đối tác, thu, chi, số dư), số dư cuối kỳ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_38
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_85
- Trường hợp ngoại lệ: Quỹ ngừng dùng không hiện ở biểu mẫu phiếu mới; phiếu chờ duyệt dùng quỹ đã ngừng dùng thì không ghi sổ được.
- Phân quyền: Người không có `finance.fund.manage` thêm, sửa nhận 403; không thấy nút "Thêm quỹ", "Sửa".
- Thông báo lỗi: "Vui lòng nhập thông tin này." (tên ngân hàng, số tài khoản khi loại ngân hàng) · "Mã quỹ đã có trong công ty." · "Quỹ đã có phiếu thu chi, không sửa được số dư đầu." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_105, TIEUCHI_NGHIEMTHU_110

### CHUC_NANG_66: Sổ công nợ
- Mục đích: Biết mỗi đối tác còn nợ hoặc đã trả trước bao nhiêu, theo chứng từ nào, quá hạn bao lâu.
- Người sử dụng: Kế toán, quản trị công ty, quản trị tập đoàn; Thủ kho (gián tiếp: ghi sổ phiếu kho sinh công nợ).
- Điều kiện thực hiện: Danh sách, chi tiết đối tác: `finance.debt.view`. Chứng từ còn nợ: `finance.debt.view` hoặc `finance.payment.manage`. Chọn đối tác: `finance.debt.view`, `finance.payment.manage` hoặc `finance.debt.manage`. Nhập, xóa số dư đầu kỳ: `finance.debt.manage`. Phát sinh tự động: khi phiếu kho ghi sổ.
- Dữ liệu đầu vào: Danh sách: phía (phải thu, phải trả), từ khóa (tên không dấu hoặc mã đối tác, tối đa 100 ký tự), chỉ đối tác quá hạn. Số dư đầu kỳ: đối tác, phía, loại (còn nợ, trả trước), số chứng từ (1 đến 50 ký tự), ngày, hạn thanh toán (bắt buộc với còn nợ, không trước ngày chứng từ), số tiền (lớn hơn 0), ghi chú (tối đa 500 ký tự).
- Quy trình xử lý: Phiếu kho ghi sổ gọi móc nối của module Tài chính trong cùng giao dịch: tính giá trị gồm thuế (hàm `finance.inventory_debt_amount`), tạo khoản tăng hoặc giảm nợ, trừ nợ (QUYTAC_NGHIEPVU_86, QUYTAC_NGHIEPVU_87). Biên bản chênh lệch nội bộ ghi tổn thất (CHUC_NANG_61) gọi móc nối trong cùng giao dịch đóng biên bản: tạo khoản giảm phải thu của công ty mua theo giá đơn bán của phần thiếu, trừ trước vào phiếu xuất gốc. Số dư đầu kỳ: kiểm đối tác là khách hàng (phải thu) hoặc nhà cung cấp (phải trả) theo hồ sơ của công ty; khóa công nợ của đối tác; tạo khoản, tự trừ (QUYTAC_NGHIEPVU_90). Xóa: chỉ khoản số dư đầu kỳ chưa trừ nợ, chưa được chọn trên phiếu thu chi. Danh sách: đối tác có khoản còn số còn lại, sắp số dư giảm dần (tối đa 1.000), kèm dòng tổng; tuổi nợ theo QUYTAC_NGHIEPVU_91.
- Kết quả đầu ra: Danh sách: tiền tệ, đối tác (mã, tên), số dư, trả trước, chưa đến hạn, quá hạn 1 đến 30, 31 đến 60, 61 đến 90, trên 90 ngày; tổng. Chi tiết đối tác: đối tác, phía, số dư, trả trước, tuổi nợ, được nhập số dư đầu kỳ, được lập phiếu; khoản (số chứng từ, nguồn, loại phiếu thu chi, ngày, hạn, số tiền, còn lại, số ngày quá hạn, ghi chú, được xóa, các lần trừ nợ: chứng từ bên kia, số tiền, ngày), mới trước, tối đa 1.000. Chứng từ còn nợ: trả trước đang còn; khoản tăng còn lại, cũ nhất trước. Chọn đối tác: tối đa 20 (mã, tên).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_38
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_86, QUYTAC_NGHIEPVU_87, QUYTAC_NGHIEPVU_90, QUYTAC_NGHIEPVU_91
- Trường hợp ngoại lệ: Đơn bán không có khách, phiếu giá trị 0 không phát sinh công nợ. Đối tác không có hồ sơ và không có công nợ ở công ty đang chọn: chi tiết trả 404. Phiếu kho ghi sổ trước khi nâng cấp được tính lại khi chạy database migration.
- Phân quyền: Nhân viên bán hàng, Thủ kho xem công nợ nhận 403; không có `finance.debt.manage` thì không thấy "Nhập số dư đầu kỳ", nút "Xóa".
- Thông báo lỗi: "Đối tác không phải khách hàng của công ty." · "Đối tác không phải nhà cung cấp của công ty." · "Vui lòng nhập thông tin này." (hạn thanh toán) · "Khoản số dư đầu kỳ đã được trừ nợ hoặc đang được chọn trên phiếu thu chi, không xóa được."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_106, TIEUCHI_NGHIEMTHU_109, TIEUCHI_NGHIEMTHU_110

### CHUC_NANG_67: Phiếu thu, phiếu chi
- Mục đích: Thu tiền khách, trả tiền nhà cung cấp, hoàn tiền; trừ đúng chứng từ; phiếu chi được duyệt trước khi chi.
- Người sử dụng: Kế toán, quản trị công ty, quản trị tập đoàn; người duyệt phiếu chi.
- Điều kiện thực hiện: Tùy chọn, danh sách, chi tiết: `finance.debt.view` hoặc `finance.payment.manage`. Lập, sửa, gửi: `finance.payment.manage`. Rút: người lập, có `finance.payment.manage`, phiếu chờ duyệt.
- Dữ liệu đầu vào: Loại (thu tiền khách hàng, trả tiền nhà cung cấp, hoàn tiền cho khách hàng, nhà cung cấp hoàn tiền), đối tác, quỹ, ngày, số tiền (lớn hơn 0), nội dung (tối đa 500 ký tự), tối đa 500 dòng chứng từ trừ (khoản tăng nợ, số trừ lớn hơn 0; chỉ với thu tiền khách hàng, trả tiền nhà cung cấp), phiên bản khi sửa, gửi. Danh sách: loại, trạng thái, đối tác.
- Quy trình xử lý: Lưu: kiểm đối tác đúng phía, quỹ của công ty đang dùng, chứng từ là khoản tăng còn nợ của đối tác ở phía đó, không trùng, không vượt số còn lại, tổng không vượt số tiền; hoàn tiền không vượt trả trước đang còn (QUYTAC_NGHIEPVU_88). Sửa khi nháp, bị từ chối, đã rút (về nháp, xóa lý do không ghi sổ được); đã cấp số thì không đổi giữa phiếu thu và phiếu chi. Gửi: cấp số theo dãy `finance.receipt` (tự tạo tiền tố `PT`) hoặc `finance.payment` (`PC`) ở lần gửi đầu; phiếu chi gửi luồng duyệt với số tiền, chưa có chính sách thì ghi sổ ngay; phiếu thu ghi sổ ngay (QUYTAC_NGHIEPVU_89). Ghi sổ: khóa công nợ của đối tác, khóa quỹ, kiểm lại quỹ đang dùng, số dư quỹ (phiếu chi), số còn lại, trả trước; tạo khoản giảm nợ (thu, trả) hoặc tăng nợ (hoàn tiền), trừ nợ; đánh dấu đã ghi sổ. Nghe `core.approval.completed` loại `finance.payment`: duyệt xong thì ghi sổ, lỗi nghiệp vụ thì phiếu "Bị từ chối" kèm khóa lỗi; từ chối, rút thì chuyển tương ứng.
- Kết quả đầu ra: Tùy chọn: quỹ đang dùng (mã, tên, loại, số dư), tiền tệ. Danh sách (số, loại, ngày, đối tác, quỹ, số tiền, trạng thái), ngày mới trước, tối đa 500. Chi tiết: thông tin, yêu cầu duyệt, lý do không ghi sổ được (khi bị từ chối), chứng từ sẽ trừ (chưa ghi sổ) hoặc đã trừ (đã ghi sổ) kèm số trừ, phần thành trả trước, người lập, thời điểm ghi sổ, phiên bản, được sửa, gửi, rút hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_38
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_87, QUYTAC_NGHIEPVU_88, QUYTAC_NGHIEPVU_89
- Trường hợp ngoại lệ: Phiếu đã ghi sổ không sửa, không hủy. Phiếu thu không ghi sổ được thì báo lỗi, giữ trạng thái trước khi gửi. Phiếu chi duyệt xong không ghi sổ được thì về "Bị từ chối" kèm lý do. Hai phiếu ghi sổ đồng thời cùng đối tác hoặc cùng quỹ chạy tuần tự.
- Phân quyền: Không có `finance.payment.manage` lập, sửa, gửi nhận 403; người không phải người lập rút nhận 403.
- Thông báo lỗi: "Đối tác không phải khách hàng của công ty." · "Đối tác không phải nhà cung cấp của công ty." · "Giá trị không hợp lệ." (quỹ, chứng từ, đổi loại sau khi cấp số) · "Quỹ đã ngừng dùng." · "Số trừ vượt số còn nợ của chứng từ." · "Tổng số trừ vượt số tiền phiếu." · "Số tiền hoàn vượt tiền trả trước đang còn." · "Số dư quỹ không đủ." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_107, TIEUCHI_NGHIEMTHU_108, TIEUCHI_NGHIEMTHU_110

### CHUC_NANG_68: Dư nợ thật cho kiểm hạn mức công nợ của đơn bán
- Mục đích: Đơn bán kiểm hạn mức công nợ theo số khách còn nợ thật thay cho dư nợ tạm tính.
- Người sử dụng: Nhân viên bán hàng, quản trị (gửi đơn bán); người duyệt đơn bán.
- Điều kiện thực hiện: Gửi đơn bán (CHUC_NANG_54), khách có hạn mức công nợ.
- Dữ liệu đầu vào: Không nhập thêm.
- Quy trình xử lý: Khi tính ngoại lệ lúc gửi đơn: dư nợ = số dư công nợ phải thu của khách ở công ty (khoản tăng còn lại − khoản giảm còn lại) + giá trị gồm thuế phần chưa giao của các đơn khác của khách đã xác nhận; dư nợ + tổng gồm thuế của đơn vượt hạn mức thì ngoại lệ vượt hạn mức (QUYTAC_NGHIEPVU_92).
- Kết quả đầu ra: Ngoại lệ `credit_limit` trên đơn bán như cũ; diễn giải "<dư nợ sau đơn> > <hạn mức>" chỉ trả cho người có `crm.profile.manage`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_38
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_92 (thay QUYTAC_NGHIEPVU_69, THAY_DOI_09)
- Trường hợp ngoại lệ: Khách trả tiền, trả trước làm giảm dư nợ ngay; hàng khách trả lại làm giảm qua khoản giảm nợ. Hạn mức trống, đơn không có khách thì không kiểm.
- Phân quyền: Như CHUC_NANG_54.
- Thông báo lỗi: Như CHUC_NANG_54.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_109

## Yêu cầu phi chức năng của MODULE_06 (phần 1)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Công nợ phát sinh trong cùng giao dịch ghi sổ phiếu kho; mọi thay đổi công nợ của một đối tác ở một phía chạy tuần tự (khóa theo công ty, phía, đối tác); ghi sổ phiếu thu chi khóa công nợ trước, quỹ sau; số dư quỹ, số dư công nợ tính từ dữ liệu, không lưu trùng; tiền `numeric`; khóa ngoại từ `finance` chỉ trỏ vào `finance`, `core`, `crm` |
| Ranh giới module | Module Kho gọi công nợ qua móc nối `postedHooks` (ghi sổ phiếu kho), `writtenOffHooks` (ghi tổn thất biên bản nội bộ) đăng ký lúc khởi động; đơn bán chỉ đọc số dư công nợ qua biểu thức `receivableBalance` (`apps/api/src/finance/receivable-balance.ts`); dùng lại luồng duyệt, dãy số chứng từ có sẵn |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 2: Kế toán tổng hợp, CONG_VIEC_14)

Quy ước chung cho mọi chức năng của MODULE_06 phần 2:
- Thao tác ghi nhật ký thao tác (CHUC_NANG_23): mini app `finance`, loại đối tượng `ledger` (`ledger.setup`), `account` (`account.create`, `.update`), `posting_rule` (`posting_rule.update`), `journal` (`journal.create`, `.update`, `.submit`, `.withdraw`), `ledger_period` (`period.close`, `period.reopen`). Bút toán tự sinh ghi theo nhật ký của chứng từ gốc.
- Quyền `finance.*` chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty (tài liệu `08` mục 16). Mọi API trước hết cần `finance.access` hoặc `finance.ledger.view` ở công ty đang chọn. Dữ liệu của công ty khác trả 404.
- Sửa gửi kèm phiên bản; khác phiên bản thì báo "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất.".
- Tiền `numeric(20,4)`, tiền tệ của công ty; bút toán làm tròn theo số chữ số lẻ của tiền tệ công ty; số trả về dạng chuỗi bỏ số 0 thừa.
- Công ty chưa khởi tạo kế toán: các thao tác khác khởi tạo báo "Công ty chưa khởi tạo kế toán.".

### CHUC_NANG_69: Khởi tạo kế toán, hệ thống tài khoản
- Mục đích: Công ty có hệ thống tài khoản đúng chế độ kế toán; chứng từ đã ghi sổ có bút toán; kế toán mở tài khoản chi tiết.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn; Kế toán (xem).
- Điều kiện thực hiện: Trạng thái khởi tạo: `finance.ledger.view` hoặc `finance.ledger.setup`. Khởi tạo, thêm, sửa tài khoản: `finance.ledger.setup`. Xem tài khoản: `finance.ledger.view`, `finance.ledger.setup` hoặc `finance.journal.manage`.
- Dữ liệu đầu vào: Khởi tạo: không nhập (chế độ lấy từ công ty). Thêm tài khoản chi tiết: tài khoản cha, số hiệu (3 đến 20 chữ số hoặc chữ cái), tên (1 đến 200 ký tự). Sửa: tên, trạng thái (đang dùng, ngừng dùng), phiên bản.
- Quy trình xử lý: Khởi tạo: khóa công ty; đã có cài đặt thì từ chối; ghi cài đặt; nạp tài khoản của chế độ `accounting_regime` của công ty (`charts.ts`), đánh dấu tài khoản hệ thống; ghi định khoản mặc định (CHUC_NANG_70); tạo bút toán cho phiếu kho trạng thái đã ghi sổ (trừ chuyển kho), phiếu thu chi đã ghi sổ, biên bản nội bộ đã ghi tổn thất, theo thứ tự ghi sổ, không kiểm khóa sổ. Thêm chi tiết: tài khoản cha thuộc công ty, đang dùng; số hiệu bắt đầu bằng số hiệu cha, dài hơn, chưa có trong công ty; tính chất theo cha; định khoản đang dùng tài khoản cha chuyển sang tài khoản mới (QUYTAC_NGHIEPVU_93). Sửa: khóa tài khoản, kiểm phiên bản; ngừng dùng chỉ với tài khoản chi tiết, không nằm trong định khoản, không còn con đang dùng. Đổi chế độ kế toán ở CHUC_NANG_01: đã có bút toán thì từ chối; đã khởi tạo, chưa có bút toán thì xóa định khoản, tài khoản, cài đặt.
- Kết quả đầu ra: Trạng thái: đã khởi tạo hay chưa, chế độ, tên chế độ, đã khóa sổ đến, được khởi tạo hay không. Tài khoản: số hiệu, tên, tài khoản cha, tính chất, là tài khoản hệ thống, trạng thái, nhận bút toán được, đã có bút toán, phiên bản, được sửa; theo số hiệu.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_39
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_93
- Trường hợp ngoại lệ: Tài khoản cha đã ngừng dùng, của công ty khác: lỗi tại tài khoản cha. Tài khoản đã có bút toán vẫn thêm chi tiết được; bút toán cũ giữ ở tài khoản cha.
- Phân quyền: Không có `finance.ledger.setup` khởi tạo, thêm, sửa nhận 403; không thấy nút "Khởi tạo kế toán", "Thêm chi tiết", "Sửa".
- Thông báo lỗi: "Công ty đã khởi tạo kế toán." · "Số hiệu tài khoản chi tiết phải bắt đầu bằng số hiệu tài khoản cha và dài hơn." · "Số hiệu tài khoản đã có trong công ty." · "Tài khoản của chế độ kế toán không ngừng dùng được." · "Tài khoản đang dùng trong định khoản mặc định." · "Tài khoản còn tài khoản chi tiết đang dùng." · "Công ty đã có bút toán, không đổi được chế độ kế toán." (CHUC_NANG_01) · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_111, TIEUCHI_NGHIEMTHU_116
- Bổ sung CONG_VIEC_15: sửa tài khoản nhận thêm "Dài hạn" (`isLongTerm`, không bắt buộc) với `finance.ledger.setup`; chỉ tài khoản chi tiết do kế toán mở, tài khoản của chế độ thì lỗi tại `isLongTerm` "Chỉ đánh dấu dài hạn cho tài khoản chi tiết do kế toán mở."; danh sách tài khoản trả thêm `isLongTerm` (QUYTAC_NGHIEPVU_101, CHUC_NANG_75).

### CHUC_NANG_70: Định khoản mặc định
- Mục đích: Bút toán tự sinh ghi đúng tài khoản công ty muốn dùng.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn; Kế toán (xem).
- Điều kiện thực hiện: Xem: `finance.ledger.view` hoặc `finance.ledger.setup`. Đổi: `finance.ledger.setup`.
- Dữ liệu đầu vào: Vai trò (một trong 20 vai trò: 18 vai trò ở đặc tả `cong_viec/CONG_VIEC_14.md` mục 8, `commission_expense`, `staff_payable` thêm ở CONG_VIEC_17), tài khoản.
- Quy trình xử lý: Khởi tạo ghi tài khoản mặc định của chế độ cho mọi vai trò. Đổi: vai trò phải có trong danh mục; tài khoản thuộc công ty, đang dùng, không có con đang dùng; ghi người, thời điểm sửa (QUYTAC_NGHIEPVU_94). Bút toán sinh sau đó dùng tài khoản mới; bút toán cũ không đổi.
- Kết quả đầu ra: Danh sách theo thứ tự vai trò: vai trò, mô tả, tài khoản (số hiệu, tên), được đổi hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_39
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_94
- Trường hợp ngoại lệ: Thêm tài khoản chi tiết dưới tài khoản đang dùng trong định khoản thì định khoản tự chuyển sang tài khoản chi tiết.
- Phân quyền: Không có `finance.ledger.setup` đổi nhận 403; ô chọn chỉ hiện chữ.
- Thông báo lỗi: "Tài khoản không nhận bút toán (đã ngừng dùng hoặc có tài khoản chi tiết)."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_111, TIEUCHI_NGHIEMTHU_112

### CHUC_NANG_71: Bút toán tự sinh
- Mục đích: Nghiệp vụ kho, thu chi tự thành bút toán, kế toán không nhập lại.
- Người sử dụng: Thủ kho, Kế toán (gián tiếp: ghi sổ chứng từ); Kế toán, Kế toán trưởng (xem bút toán).
- Điều kiện thực hiện: Ghi sổ phiếu kho (trừ chuyển kho), phiếu thu chi; ghi tổn thất biên bản chênh lệch nội bộ; công ty đã khởi tạo kế toán.
- Dữ liệu đầu vào: Không nhập thêm.
- Quy trình xử lý: Phiếu kho, phiếu thu chi, biên bản nội bộ gọi móc nối của module kế toán trong cùng giao dịch ghi sổ (`postedHooks`, `writtenOffHooks`). Đọc cài đặt kế toán có khóa dòng chia sẻ; ngày thuộc kỳ đã khóa thì từ chối (QUYTAC_NGHIEPVU_97). Tính số tiền theo vai trò: xuất giao hàng, nhận hàng trả lại theo tiền chưa thuế, thuế của dòng đơn bán tỷ lệ số lượng; nhập mua theo giá đơn mua phần đạt kiểm tra chất lượng, trả hàng nhà cung cấp theo giá đơn mua; giá vốn, hàng hóa theo giá trị ghi sổ kho; phiếu thu chi theo số tiền phiếu; ghi tổn thất theo giá đơn bán phần thiếu (Nợ giảm trừ doanh thu, Nợ thuế đầu ra / Có phải thu). Làm tròn đến đơn vị tiền tệ công ty theo lũy kế từng dòng đơn bằng hàm `finance.inventory_amounts` dùng chung với công nợ (THAY_DOI_10); thuế là phần chênh lệch. Đổi vai trò sang tài khoản theo định khoản; bỏ dòng 0; kiểm tổng Nợ bằng tổng Có; ghi bút toán "Đã ghi sổ", số chứng từ gốc, ngày chứng từ (ghi tổn thất: ngày ghi tổn thất), đối tác ở dòng phải thu, phải trả (QUYTAC_NGHIEPVU_95). Bút toán theo chứng từ: đặc tả mục 8.
- Kết quả đầu ra: Bút toán nguồn `inventory_document`, `payment`, `internal_write_off`; mỗi chứng từ một bút toán.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_39
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_94, QUYTAC_NGHIEPVU_95, QUYTAC_NGHIEPVU_97
- Trường hợp ngoại lệ: Công ty chưa khởi tạo: không sinh, chứng từ vẫn ghi sổ. Kỳ đã khóa: phiếu kho không gửi được, chứng từ không ghi sổ. Phiếu kho, phiếu chi, phiếu kế toán duyệt xong rơi vào kỳ khóa: về "Bị từ chối" kèm lý do (phiếu kho nhả hàng giữ). Bút toán lệch hoặc thiếu định khoản: lỗi máy chủ, chứng từ không ghi sổ.
- Phân quyền: Như quyền ghi sổ chứng từ gốc; không cần quyền kế toán.
- Thông báo lỗi: "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_112, TIEUCHI_NGHIEMTHU_114

### CHUC_NANG_72: Phiếu kế toán
- Mục đích: Kế toán lập bút toán điều chỉnh, số dư đầu kỳ tài khoản; phiếu được duyệt trước khi ghi sổ.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị công ty, quản trị tập đoàn; người duyệt phiếu kế toán.
- Điều kiện thực hiện: Danh sách, chi tiết bút toán: `finance.ledger.view` hoặc `finance.journal.manage`. Lập, sửa, gửi: `finance.journal.manage`. Rút: người lập, có `finance.journal.manage`, phiếu chờ duyệt, cấp duyệt đầu chưa quyết định.
- Dữ liệu đầu vào: Ngày, diễn giải (1 đến 500 ký tự), 2 đến 200 dòng (tài khoản, đối tác không bắt buộc, Nợ, Có dạng chuỗi tối đa 4 chữ số lẻ, diễn giải dòng tối đa 300 ký tự), phiên bản khi sửa, gửi. Danh sách: nguồn, trạng thái, từ ngày, đến ngày.
- Quy trình xử lý: Lưu: công ty đã khởi tạo; ngày không thuộc kỳ đã khóa; mỗi dòng ghi đúng một bên lớn hơn 0, không lẻ hơn đơn vị tiền tệ; tài khoản thuộc công ty, nhận bút toán được; đối tác có hồ sơ ở công ty, bắt buộc với tài khoản bắt đầu bằng 131, 331; tổng Nợ bằng tổng Có (QUYTAC_NGHIEPVU_96). Ghi sổ kiểm lại kỳ và tài khoản còn nhận bút toán. Sửa khi nháp, bị từ chối, đã rút (về nháp, xóa lý do không ghi sổ được, thay toàn bộ dòng). Gửi: kiểm lại kỳ; cấp số theo dãy `accounting.journal` (tự tạo tiền tố `PKT`) ở lần gửi đầu; gửi luồng duyệt với tổng Nợ; chưa có chính sách thì ghi sổ ngay. Nghe `core.approval.completed` loại `accounting.journal`: duyệt xong thì ghi sổ, kỳ đã khóa thì "Bị từ chối" kèm khóa lỗi; từ chối, rút thì chuyển tương ứng.
- Kết quả đầu ra: Danh sách (số, ngày, nguồn, diễn giải, tổng tiền, trạng thái), ngày mới trước, tối đa 500. Chi tiết: thông tin, chứng từ gốc, tiền tệ, dòng (tài khoản, đối tác, Nợ, Có, diễn giải), yêu cầu duyệt, lý do không ghi sổ được, người lập, phiên bản, được sửa, gửi, rút hay không.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_39
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_96
- Trường hợp ngoại lệ: Bút toán tự sinh, kết chuyển không sửa, không gửi. Phiếu đã ghi sổ không sửa.
- Phân quyền: Không có `finance.journal.manage` lập, sửa, gửi nhận 403; không thấy "Lập phiếu kế toán"; người không phải người lập rút nhận 403.
- Thông báo lỗi: "Mỗi dòng ghi một bên Nợ hoặc Có, lớn hơn 0." · "Giá trị không hợp lệ." (số lẻ, đối tác) · "Vui lòng nhập thông tin này." (đối tác của dòng 131, 331) · "Tài khoản không nhận bút toán (đã ngừng dùng hoặc có tài khoản chi tiết)." · "Tổng Nợ phải bằng tổng Có." · "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ." · "Công ty chưa khởi tạo kế toán." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_113, TIEUCHI_NGHIEMTHU_116

### CHUC_NANG_73: Khóa sổ, sổ cái, bảng cân đối số phát sinh
- Mục đích: Cuối tháng kết chuyển kết quả, chặn sửa số liệu tháng đã chốt; xem số dư, phát sinh từng tài khoản.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn; Kế toán (xem).
- Điều kiện thực hiện: Xem kỳ: `finance.ledger.view` hoặc `finance.period.close`. Khóa sổ, mở lại: `finance.period.close`. Bảng cân đối số phát sinh, sổ cái: `finance.ledger.view`.
- Dữ liệu đầu vào: Khóa sổ: tháng (`YYYY-MM`). Mở lại: không nhập. Bảng cân đối, sổ cái: từ ngày, đến ngày; sổ cái thêm tài khoản.
- Quy trình xử lý: Kỳ: tháng tiếp theo là tháng sau ngày khóa, chưa khóa lần nào thì tháng của bút toán đã ghi sổ sớm nhất; được khóa khi tháng đó đã kết thúc. Khóa sổ: tháng gửi lên phải là tháng tiếp theo, được khóa; khóa dòng cài đặt, kiểm ngày khóa chưa đổi; không còn phiếu kế toán chờ duyệt, phiếu kho (trừ chuyển kho) chờ duyệt, chờ kiểm tra chất lượng, đang đi đường, phiếu chi chờ duyệt có ngày đến hết tháng; tính số dư lũy kế đến cuối tháng; tài khoản 521 kết chuyển sang tài khoản doanh thu trước; từng tài khoản loại 5 đến 8 còn số dư (trừ 911) kết chuyển sang 911; số dư 911 chuyển sang 4212; ghi bút toán `KC-YYYY-MM` nguồn `closing` ngày cuối tháng, dòng theo số hiệu tài khoản; ghi ngày khóa (QUYTAC_NGHIEPVU_97). Mở lại: khóa dòng cài đặt; xóa bút toán kết chuyển ngày bằng ngày khóa; ngày khóa lùi về ngày của bút toán kết chuyển trước đó (không có thì trống). Bảng cân đối: số dư đầu kỳ từ bút toán trước từ ngày, phát sinh trong khoảng; tài khoản lưỡng tính có đối tác tách theo đối tác; cộng dồn lên cha; tổng theo tài khoản cấp cao nhất (QUYTAC_NGHIEPVU_98). Sổ cái: tài khoản và tài khoản chi tiết; số dư đầu; dòng theo ngày, thời điểm tạo, số dòng (tối đa 10.000) kèm tài khoản đối ứng (các tài khoản bên kia trong cùng bút toán); số dư lũy kế theo bên Nợ (âm là dư Có); tổng phát sinh, số dư cuối kỳ tính trên toàn khoảng ngày.
- Kết quả đầu ra: Kỳ: đã khóa đến, tháng tiếp theo, tháng khóa gần nhất, được khóa, được mở lại. Bảng cân đối: tiền tệ, dòng (số hiệu, tên, cấp, dư đầu Nợ, dư đầu Có, phát sinh Nợ, phát sinh Có, dư cuối Nợ, dư cuối Có) chỉ tài khoản có số, dòng tổng. Sổ cái: tài khoản, số dư đầu kỳ, dòng (ngày, số, diễn giải, tài khoản, tài khoản đối ứng, đối tác, Nợ, Có, số dư), tổng phát sinh, số dư cuối kỳ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_39
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_97, QUYTAC_NGHIEPVU_98
- Trường hợp ngoại lệ: Tháng chưa kết thúc, sai thứ tự, chưa có bút toán: không khóa được. Chưa khóa lần nào: không mở lại được. Từ ngày sau đến ngày: lỗi tại đến ngày.
- Phân quyền: Không có `finance.period.close` khóa, mở lại nhận 403; không thấy nút "Khóa sổ tháng …", "Mở lại tháng …".
- Thông báo lỗi: "Không khóa được tháng này (khóa lần lượt từng tháng đã kết thúc)." · "Còn phiếu kế toán chờ duyệt trong kỳ." · "Còn phiếu kho hoặc phiếu chi đang chờ (duyệt, kiểm tra chất lượng, nhận hàng nội bộ) có ngày trong kỳ." · "Công ty chưa khởi tạo kế toán." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_114, TIEUCHI_NGHIEMTHU_115, TIEUCHI_NGHIEMTHU_116

## Yêu cầu phi chức năng của MODULE_06 (phần 2)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Bút toán tự sinh trong cùng giao dịch ghi sổ chứng từ; tổng Nợ bằng tổng Có ở mọi bút toán; kiểm khóa sổ đọc cài đặt có khóa dòng chia sẻ, khóa sổ và mở lại khóa dòng cài đặt, nên ghi sổ và khóa sổ chạy tuần tự; tiền `numeric`; khóa ngoại từ `accounting` chỉ trỏ vào `accounting`, `core`, `crm` |
| Ranh giới module | Module Kho, phiếu thu chi gọi kế toán qua móc nối `postedHooks` (phiếu kho, phiếu thu chi), `writtenOffHooks` (ghi tổn thất biên bản nội bộ) đăng ký lúc khởi động; module Tổ chức gọi `beforeRegimeChange` (`apps/api/src/accounting/regime-guard.ts`) khi đổi chế độ; dùng lại luồng duyệt, dãy số chứng từ có sẵn |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 3: Báo cáo tài chính, CONG_VIEC_15)

Quy ước chung cho mọi chức năng của MODULE_06 phần 3:
- Chỉ đọc, không ghi dữ liệu, không ghi nhật ký thao tác; đánh dấu dài hạn ghi nhật ký `account.update` của CHUC_NANG_69.
- Quyền như MODULE_06 phần 2 (tài liệu `08` mục 16, 18): API trước hết cần `finance.access` hoặc `finance.ledger.view` ở công ty đang chọn; xem, xuất báo cáo cần `finance.ledger.view`.
- Số liệu lấy từ bút toán đã ghi sổ (`posted`) của công ty đang chọn; mẫu theo chế độ kế toán của công ty (`core.companies.accounting_regime`), khai báo trong `apps/api/src/accounting/statement-templates.ts`.
- Tiền trả về dạng chuỗi, làm tròn theo số chữ số lẻ của tiền tệ công ty, bỏ số 0 thừa.
- Công ty chưa khởi tạo kế toán: báo "Công ty chưa khởi tạo kế toán.".

### CHUC_NANG_74: Báo cáo tình hình tài chính
- Mục đích: Kế toán trưởng có báo cáo tình hình tài chính đúng mẫu tại một ngày bất kỳ, không tổng hợp tay từ sổ cái.
- Người sử dụng: Kế toán trưởng, Kế toán, quản trị công ty, quản trị tập đoàn.
- Điều kiện thực hiện: `finance.ledger.view`; công ty đã khởi tạo kế toán.
- Dữ liệu đầu vào: Ngày báo cáo; mẫu (Thông tư 133: B01a-DNN mặc định hoặc B01b-DNN; Thông tư 99/2025 chỉ có B01-DN; mẫu không thuộc chế độ thì lỗi tại `form`).
- Quy trình xử lý: Đọc tài khoản của công ty, tính dài hạn của từng tài khoản (đánh dấu hoặc nằm dưới tài khoản đánh dấu). Tính số dư cuối ngày theo tài khoản, đối tác; số dư tài khoản loại 5 đến 9 chuyển vào tài khoản của vai trò `retained_earnings` (QUYTAC_NGHIEPVU_100). Mỗi chỉ tiêu tính theo công thức: số dư Nợ, số dư Có của nhóm tài khoản; số dư Nợ, Có theo từng đối tác; số dư bù trừ (chỉ tiêu nguồn vốn, chỉ tiêu ghi âm đổi dấu); tổng, hiệu chỉ tiêu khác, tính sau chỉ tiêu thành phần. Tài khoản trong công thức gồm tài khoản chi tiết; khớp nhiều số hiệu thì thuộc số hiệu dài nhất (QUYTAC_NGHIEPVU_99). Chỉ tiêu ngắn hạn có chỉ tiêu dài hạn tương ứng chỉ lấy tài khoản không dài hạn; chỉ tiêu dài hạn lấy cùng công thức trên tài khoản dài hạn (QUYTAC_NGHIEPVU_101). Cột "Số đầu năm" tính như trên tại ngày trước ngày đầu năm tài chính chứa ngày báo cáo (QUYTAC_NGHIEPVU_102). Làm tròn theo tiền tệ công ty.
- Kết quả đầu ra: Loại, mẫu, tên báo cáo, các mẫu chọn được, chế độ, công ty (tên, mã số thuế, địa chỉ), tiền tệ, hai cột ("Số cuối kỳ" tại ngày báo cáo, "Số đầu năm" tại ngày trước đầu năm tài chính), dòng chỉ tiêu (mã số, tên, cấp, ghi chú cách lấy số liệu, số cuối kỳ, số đầu năm) theo thứ tự của mẫu. Tổng tài sản bằng tổng nguồn vốn (B01-DN: 280 = 440; B01a-DNN: 200 = 500; B01b-DNN: 300 = 600).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_40
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_99, QUYTAC_NGHIEPVU_100, QUYTAC_NGHIEPVU_101, QUYTAC_NGHIEPVU_102
- Trường hợp ngoại lệ: Kỳ chưa khóa sổ hoặc đã khóa sổ cho cùng số liệu. Chỉ tiêu cần thông tin hệ thống chưa có bằng 0 hoặc mặc định vào chỉ tiêu ngắn hạn, kèm ghi chú.
- Phân quyền: Không có `finance.ledger.view` nhận 403; không thấy mục menu "Báo cáo tài chính".
- Thông báo lỗi: "Công ty chưa khởi tạo kế toán." · "Giá trị không hợp lệ." (ngày, loại báo cáo)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_117, TIEUCHI_NGHIEMTHU_119, TIEUCHI_NGHIEMTHU_120

### CHUC_NANG_75: Báo cáo kết quả hoạt động kinh doanh; xuất Excel, PDF; tài khoản dài hạn
- Mục đích: Kế toán trưởng có báo cáo kết quả hoạt động kinh doanh đúng mẫu cho khoảng ngày bất kỳ; xuất cả hai báo cáo ra Excel, PDF; tách số dư dài hạn theo tài khoản chi tiết.
- Người sử dụng: Kế toán trưởng, Kế toán, quản trị công ty, quản trị tập đoàn (xem, xuất); Kế toán trưởng, quản trị (đánh dấu dài hạn).
- Điều kiện thực hiện: Xem, xuất: `finance.ledger.view`. Đánh dấu dài hạn: `finance.ledger.setup` (CHUC_NANG_69).
- Dữ liệu đầu vào: Kết quả kinh doanh: từ ngày, đến ngày. Xuất: báo cáo, ngày (khoảng ngày), mẫu như khi xem, định dạng (`xlsx`, `pdf`). Đánh dấu dài hạn: tài khoản chi tiết, "Dài hạn".
- Quy trình xử lý: Kết quả kinh doanh: tính phát sinh Nợ, Có của từng tài khoản trong khoảng ngày, chỉ bút toán đã ghi sổ, không tính bút toán kết chuyển: bút toán `closing` và bút toán có dòng trên tài khoản xác định kết quả 911 hoặc tài khoản chi tiết của nó (QUYTAC_NGHIEPVU_100). Chỉ tiêu có đối ứng 911 lấy phát sinh thuần của tài khoản (doanh thu: Có trừ Nợ; chi phí: Nợ trừ Có); giảm trừ doanh thu đối ứng 521 lấy phát sinh thuần Nợ của 521; chỉ tiêu có tài khoản đối ứng khác lấy phát sinh một bên của dòng có tài khoản bên kia của cùng bút toán thuộc danh sách đối ứng; tổng, hiệu tính sau. Cột "Cùng kỳ năm trước" tính trên khoảng ngày lùi một năm, ngày cuối tháng giữ là ngày cuối tháng (QUYTAC_NGHIEPVU_102). Chỉ tiêu thành phần làm tròn theo tiền tệ công ty trước khi cộng. Xuất: tính như khi xem; Excel một trang tính tên là mẫu (tên công ty, tên báo cáo kèm mẫu, kỳ, đơn vị tính, bảng "Chỉ tiêu", "Mã số", hai cột số định dạng `#,##0`); PDF khổ A4 (tên công ty, mã số thuế, địa chỉ, "Mẫu số …", tên báo cáo, kỳ, đơn vị tính, bảng, ô ký "Người lập biểu", "Kế toán trưởng", "Người đại diện theo pháp luật"). Tên tệp `<mẫu>-<đến ngày>.xlsx` hoặc `.pdf`; Excel tải về, PDF mở trong trình duyệt. Đánh dấu dài hạn: sửa tài khoản chi tiết ở CHUC_NANG_69 (QUYTAC_NGHIEPVU_101).
- Kết quả đầu ra: Như CHUC_NANG_74 với mẫu B02-DN (Thông tư 99/2025) hoặc B02-DNN (Thông tư 133), hai cột "Kỳ này", "Cùng kỳ năm trước" (từ ngày, đến ngày). Tệp Excel, PDF.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_40
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_99, QUYTAC_NGHIEPVU_100, QUYTAC_NGHIEPVU_101, QUYTAC_NGHIEPVU_102
- Trường hợp ngoại lệ: Từ ngày sau đến ngày: lỗi tại đến ngày. Thiếu từ ngày: lỗi tại từ ngày. Khoảng ngày chứa ngày khóa sổ cho cùng số liệu như trước khi khóa. Tài khoản của chế độ không đánh dấu dài hạn được.
- Phân quyền: Không có `finance.ledger.view` xem, xuất nhận 403. Không có `finance.ledger.setup` không thấy "Sửa" ở MAN_HINH_50.
- Thông báo lỗi: "Ngày kết thúc phải sau ngày bắt đầu." · "Công ty chưa khởi tạo kế toán." · "Chỉ đánh dấu dài hạn cho tài khoản chi tiết do kế toán mở." · "Giá trị không hợp lệ."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_118, TIEUCHI_NGHIEMTHU_119, TIEUCHI_NGHIEMTHU_120

## Yêu cầu phi chức năng của MODULE_06 (phần 3)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Chỉ đọc bút toán đã ghi sổ; số liệu không đổi trước và sau khóa sổ; tổng tài sản bằng tổng nguồn vốn |
| Ranh giới module | Thuộc module kế toán (`apps/api/src/accounting`); đọc `accounting.accounts`, `accounting.journals`, `accounting.journal_lines`, `accounting.posting_rules`, `core.companies`; mẫu báo cáo khai báo trong mã, không có bảng cấu hình |
| Thư viện | Không thêm thư viện: Excel dùng `write-excel-file`, PDF dùng `pdfmake` có sẵn; PDF chỉ đọc phông chữ đi kèm `pdfmake`, chặn tải tài nguyên theo URL |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 4: Hóa đơn điện tử, CONG_VIEC_16)

Quy ước chung cho mọi chức năng của MODULE_06 phần 4:
- Quyền (tài liệu `08` mục 19, 20): API trước hết cần `finance.access` hoặc `finance.einvoice.view` ở công ty đang chọn; quyền chi tiết phải gán ở phạm vi tập đoàn hoặc công ty. Dữ liệu công ty khác trả `404`.
- Thao tác ghi dùng khóa lạc quan (`version`); ghi nhật ký thao tác: `einvoice_settings.update`, `einvoice_settings.test`, `einvoice.resend`, `einvoice.adjust_return`, `einvoice.buyer_return_invoice`, `einvoice.replace`. Nhật ký không chứa mật khẩu nhà cung cấp.
- Gọi nhà cung cấp ngoài giao dịch cơ sở dữ liệu, qua lớp kết nối chung (`apps/api/src/einvoice/providers/provider.ts`): bộ giả lập hoặc MISA meInvoice.
- Tiền trả về dạng chuỗi, bỏ số 0 thừa.

### CHUC_NANG_76: Cài đặt hóa đơn điện tử của công ty
- Mục đích: Mỗi công ty tự chọn nhà cung cấp, loại hóa đơn, ký hiệu; thông tin kết nối được giữ bí mật.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn (sửa); Kế toán (xem).
- Điều kiện thực hiện: Xem: `finance.einvoice.view` hoặc `finance.einvoice.setup`. Sửa, kiểm tra kết nối: `finance.einvoice.setup`.
- Dữ liệu đầu vào: Bật; ngày bắt đầu; nhà cung cấp (`simulator`, `misa`); môi trường (`test`, `production`); loại hóa đơn (có mã, không mã); ký hiệu mẫu số (`1`, `2`); mã ứng dụng (tối đa 100 ký tự), mã số thuế (tối đa 20), tên đăng nhập (tối đa 100), mật khẩu (tối đa 200; để trống là giữ); tình huống giả lập (chỉ bộ giả lập); danh sách ký hiệu theo năm (tối đa 20 năm, năm 2000 đến 2099).
- Quy trình xử lý: Kiểm tra theo QUYTAC_NGHIEPVU_103 (bộ giả lập ở môi trường thật, ngày bắt đầu khi bật, ký hiệu trùng năm, sai năm, sai loại, thông tin kết nối MISA, ký hiệu của năm bắt đầu), báo lỗi tại từng trường. Mã hóa mật khẩu mới bằng `common/secret-box` (AES-256-GCM). Lưu cài đặt, thay toàn bộ ký hiệu theo năm; hóa đơn "Lỗi cài đặt" chưa có ký hiệu mà năm đã có ký hiệu thì chuyển "Chờ gửi" với ký hiệu đó. Kiểm tra kết nối: dùng cài đặt đã lưu, gọi `testConnection` của nhà cung cấp (bộ giả lập luôn được; MISA lấy mã truy cập mới rồi đọc danh sách mẫu hóa đơn của năm).
- Kết quả đầu ra: Cài đặt (mật khẩu không trả; 4 ký tự cuối chỉ trả cho người có `finance.einvoice.setup`), ký hiệu theo năm, `simulatorAllowed`, `canSetup`, `version`. Kiểm tra kết nối: `{ ok, message }`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_41
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_103
- Trường hợp ngoại lệ: Chưa lưu cài đặt: xem trả giá trị mặc định (chưa bật, bộ giả lập ngoài môi trường thật, MISA ở môi trường thật; thử nghiệm; có mã; mẫu số 1); kiểm tra kết nối báo "Công ty chưa cài đặt hóa đơn điện tử.".
- Phân quyền: Không có `finance.einvoice.setup` sửa, kiểm tra kết nối nhận 403; màn hình chỉ xem, không có nút "Lưu", "Kiểm tra kết nối"; không thấy mục menu "Cài đặt hóa đơn điện tử".
- Thông báo lỗi: "Không dùng bộ giả lập ở môi trường thật." · "Vui lòng nhập thông tin này." · "Mỗi năm chỉ một ký hiệu." · "Hai số sau chữ đầu phải là hai số cuối của năm." · "Ký hiệu bắt đầu bằng C cho hóa đơn có mã, K cho hóa đơn không mã." · "Khai ký hiệu cho năm của ngày bắt đầu." · "Giá trị không hợp lệ." · "Công ty chưa cài đặt hóa đơn điện tử." · "Nhà cung cấp từ chối thông tin kết nối (mã ứng dụng, mã số thuế, tên đăng nhập, mật khẩu)." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_121, TIEUCHI_NGHIEMTHU_126

### CHUC_NANG_77: Lập hóa đơn khi giao hàng; gửi nền; gửi lại; tải PDF, XML; cảnh báo quá hạn
- Mục đích: Mỗi lần giao hàng có hóa đơn điện tử gửi cơ quan thuế đúng hạn mà không ai lập tay.
- Người sử dụng: Thủ kho (ghi sổ phiếu xuất, gián tiếp); Kế toán, Kế toán trưởng, quản trị (xem, gửi lại).
- Điều kiện thực hiện: Lập: công ty đang bật, ngày phiếu không trước ngày bắt đầu. Xem, tải tệp: `finance.einvoice.view`. Gửi lại: `finance.einvoice.manage`.
- Dữ liệu đầu vào: Phiếu xuất giao hàng đã ghi sổ. Danh sách: trạng thái, chỉ quá hạn, từ ngày, đến ngày, từ khóa (người mua, mã số thuế, số hóa đơn, số phiếu; tối đa 100 ký tự), trang. Gửi lại: `version`.
- Quy trình xử lý: Lập: móc nối `postedHooks` của phiếu kho gọi trong giao dịch ghi sổ, lập hóa đơn theo QUYTAC_NGHIEPVU_104 (dòng tính bằng `finance.line_share` như công nợ), hạn gửi là ngày làm việc tiếp theo. Gửi nền: tác vụ `einvoice-send` mỗi 30 giây gửi theo QUYTAC_NGHIEPVU_105 (giữ chỗ, ghi lần gửi, gọi ngoài giao dịch, thời gian chờ 30 giây; mọi lần sau lần đầu tra trạng thái theo mã tham chiếu trước; tải PDF, XML khi phát hành, giới hạn 30 giây; chỉ ghi kết quả của lần gửi mới nhất, không đổi hóa đơn đã phát hành; lỗi một hóa đơn không dừng cả lượt). Gửi lại: chỉ hóa đơn "Lỗi", "Lỗi cài đặt", "Chờ gửi lại", "Bị từ chối", không có lần gửi chưa xong dưới 10 phút; nhà cung cấp có thể đang giữ hóa đơn (có số, lần gần nhất lỗi tạm thời hoặc không rõ kết quả) thì giữ nội dung; "Bị từ chối" lập lại với mã tham chiếu mới; còn lại lấy lại nhà cung cấp, ký hiệu, loại, mẫu số, người bán theo cài đặt hiện tại; gửi ngay rồi trả chi tiết. Quá hạn: tác vụ `einvoice-overdue` mỗi giờ, trong một giao dịch, theo ngày Việt Nam, đánh dấu đã báo và gửi thông báo `einvoice_overdue` (số hóa đơn quá hạn, đường dẫn `/finance/einvoices?overdue=true`) cho người có `finance.einvoice.manage` của công ty.
- Kết quả đầu ra: Danh sách (ngày, ký hiệu, số, người mua, tổng thanh toán, tiền tệ, loại, trạng thái, quá hạn, đã bị thay thế, số phiếu kho) theo ngày hóa đơn mới nhất, 20 dòng mỗi trang (tối đa 100). Chi tiết: thêm nhà cung cấp, mẫu số, có mã hay không, mã của cơ quan thuế, mã tham chiếu, người bán, người mua, tiền chưa thuế, tiền thuế, ghi chú, lỗi gần nhất, hạn gửi, thời điểm phát hành, phiếu kho, hóa đơn liên quan, dòng, tổng theo thuế suất, 50 lần gửi gần nhất, có PDF, XML, `canManage`. Tệp PDF (mở trong trình duyệt), XML (tải về), tên `<ký hiệu>-<số>.pdf` hoặc `.xml`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_41
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_104, QUYTAC_NGHIEPVU_105
- Trường hợp ngoại lệ: Năm chưa có ký hiệu: "Lỗi cài đặt". Nhà cung cấp trên hóa đơn khác cài đặt hiện tại: "Lỗi" với "Nhà cung cấp hóa đơn điện tử chưa sẵn sàng hoặc đã đổi trong cài đặt.". Không tải được tệp sau khi phát hành: vẫn "Đã phát hành", không có nút tải, không tự tải lại. Màn hình chỉ hiện "Gửi lại" với "Lỗi", "Lỗi cài đặt", "Chờ gửi lại"; hóa đơn "Bị từ chối" gửi lại được qua API.
- Phân quyền: Không có `finance.einvoice.view` nhận 403, không thấy mục menu "Hóa đơn điện tử". Không có `finance.einvoice.manage` không thấy "Gửi lại".
- Thông báo lỗi: "Chỉ gửi lại được hóa đơn lỗi, lỗi cài đặt, đang chờ gửi lại hoặc bị từ chối." · "Hóa đơn đang được gửi; thử lại sau ít phút." · "Công ty chưa cài đặt hóa đơn điện tử." · "Chưa khai ký hiệu hóa đơn cho năm của hóa đơn." · "Chưa có tệp của hóa đơn này." · "Nhà cung cấp không phản hồi trong thời gian chờ." · "Nhà cung cấp từ chối yêu cầu." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_122, TIEUCHI_NGHIEMTHU_123, TIEUCHI_NGHIEMTHU_126

### CHUC_NANG_78: Hóa đơn khi trả hàng
- Mục đích: Phiếu nhận hàng trả lại được xử lý hóa đơn đúng quy định, không bị bỏ sót.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị.
- Điều kiện thực hiện: Xem: `finance.einvoice.view`. Xử lý: `finance.einvoice.manage`; việc "Chờ xử lý"; hóa đơn gốc hiện hành "Đã phát hành".
- Dữ liệu đầu vào: Danh sách: trạng thái việc (`open`, `adjusted`, `buyer_invoice`, không chọn là tất cả). Điều chỉnh giảm: `version`. Hóa đơn của người mua: ký hiệu (tối đa 20 ký tự, không bắt buộc), số (1 đến 20 ký tự), ngày, `version`.
- Quy trình xử lý: Ghi sổ phiếu nhận hàng trả lại (móc nối `postedHooks`) tạo việc khi phiếu xuất gốc có hóa đơn gốc. Hóa đơn gốc hiện hành theo chuỗi thay thế. Điều chỉnh giảm: lập hóa đơn `adjustment` theo QUYTAC_NGHIEPVU_106 (dòng của phiếu trả tính bằng `finance.line_share` theo lũy kế các lần trả, ghi âm), gửi ngay, trả chi tiết hóa đơn mới. Hóa đơn của người mua: kiểm người mua có mã số thuế, lưu ký hiệu, số, ngày; trả lại toàn bộ danh sách việc.
- Kết quả đầu ra: Việc (phiếu nhận hàng trả lại, ngày, người mua, mã số thuế, tiền hàng trả gồm thuế, tiền tệ, hóa đơn gốc hiện hành và trạng thái, hóa đơn điều chỉnh, hóa đơn của người mua, `canResolve`), mới nhất trước, tối đa 500.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_41
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_106
- Trường hợp ngoại lệ: Phiếu xuất gốc không có hóa đơn (trước ngày bắt đầu, công ty chưa bật): không tạo việc. Hóa đơn gốc chưa phát hành: việc chờ.
- Phân quyền: Không có `finance.einvoice.manage` nhận 403, không thấy nút xử lý.
- Thông báo lỗi: "Hóa đơn gốc chưa phát hành; chờ hóa đơn gốc phát hành rồi xử lý." · "Việc trả hàng này đã được xử lý." · "Chỉ ghi hóa đơn trả hàng của người mua là tổ chức có mã số thuế." · "Công ty chưa cài đặt hóa đơn điện tử." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_124

### CHUC_NANG_79: Hóa đơn thay thế; danh sách, tra cứu hóa đơn
- Mục đích: Sửa sai thông tin người mua bằng hóa đơn thay thế; tra cứu hóa đơn theo trạng thái, ngày, người mua, phiếu xuất.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị.
- Điều kiện thực hiện: Thay thế: `finance.einvoice.manage`; hóa đơn "Đã phát hành", không phải hóa đơn điều chỉnh, chưa bị thay thế, chưa có hóa đơn điều chỉnh, không có hóa đơn thay thế khác chưa "Lỗi", "Bị từ chối". Tra cứu: `finance.einvoice.view`.
- Dữ liệu đầu vào: Tên người mua (1 đến 300 ký tự), mã số thuế (10 chữ số hoặc 10 chữ số, gạch ngang, 3 chữ số; không bắt buộc), địa chỉ (tối đa 500 ký tự, không bắt buộc), lý do (1 đến 500 ký tự), `version`. Tra cứu: như danh sách ở CHUC_NANG_77.
- Quy trình xử lý: Khóa hóa đơn bị thay thế, kiểm điều kiện QUYTAC_NGHIEPVU_107; chép dòng, số tiền; lập hóa đơn `replacement` ngày hôm nay, ghi chú là lý do, tham chiếu hóa đơn bị thay thế; gửi ngay; trả chi tiết hóa đơn mới. Khi hóa đơn thay thế "Đã phát hành" (gửi ngay hoặc gửi nền) mới ghi `replaced_by_id` vào hóa đơn bị thay thế.
- Kết quả đầu ra: Hóa đơn thay thế; mục "Hóa đơn liên quan" ở hai hóa đơn; hóa đơn cũ có nhãn "Đã bị thay thế" khi hóa đơn thay thế đã phát hành.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_41
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_107
- Trường hợp ngoại lệ: Hóa đơn đã thay thế muốn sửa tiếp: thay hóa đơn thay thế. Trả hàng sau khi thay thế: điều chỉnh tham chiếu hóa đơn thay thế.
- Phân quyền: Không có `finance.einvoice.manage` nhận 403, không thấy nút "Lập hóa đơn thay thế".
- Thông báo lỗi: "Không thay thế hóa đơn điều chỉnh." · "Hóa đơn chưa phát hành." · "Hóa đơn đã bị thay thế; thay thế hóa đơn thay thế." · "Hóa đơn đã có hóa đơn điều chỉnh; lần sau xử lý bằng điều chỉnh." · "Hóa đơn đang có hóa đơn thay thế chưa phát hành." · "Giá trị không hợp lệ." (mã số thuế) · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_125

## Yêu cầu phi chức năng của MODULE_06 (phần 4)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Hóa đơn gốc lập trong cùng giao dịch ghi sổ phiếu xuất (một phiếu một hóa đơn gốc, chỉ mục duy nhất); mã tham chiếu duy nhất chống lập trùng khi gửi lại; ghi lần gửi trước khi gọi; tổng thanh toán bằng tiền công nợ của phiếu; hóa đơn điều chỉnh, thay thế không đổi công nợ, bút toán |
| Tích hợp | Gọi nhà cung cấp ngoài giao dịch cơ sở dữ liệu; thời gian chờ 30 giây mỗi lần gọi, mỗi lần tải tệp, 20 giây mỗi yêu cầu HTTP tới MISA; lỗi nhà cung cấp không chặn ghi sổ phiếu kho; tác vụ nền hóa đơn chạy hàng đợi riêng `hoa-don-dien-tu`, không làm chậm tác vụ nền khác |
| Bảo mật | Mật khẩu nhà cung cấp mã hóa AES-256-GCM, không trả về (4 ký tự cuối chỉ cho người có quyền cài đặt), không ghi nhật ký; mã truy cập MISA chỉ giữ trong bộ nhớ, theo công ty và thông tin kết nối; bộ giả lập không dùng ở môi trường thật (tài liệu `22`) |
| Ranh giới module | Module `apps/api/src/einvoice` đăng ký móc nối `StockDocumentsService.postedHooks`; module Kho không phụ thuộc module hóa đơn; đọc `inventory`, `sales`, `crm`, `core`, hàm `finance.line_share`, `finance.inventory_amounts` |
| Thư viện | Không thêm thư viện: HTTP bằng `fetch` của Node.js, PDF của bộ giả lập bằng `pdfmake` có sẵn (`apps/api/src/common/pdf.ts`), mã hóa bằng `common/secret-box`, tác vụ nền bằng BullMQ có sẵn |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 5: Hoa hồng đội kinh doanh, CONG_VIEC_17)

Quy ước chung cho mọi chức năng của MODULE_06 phần 5:
- Quyền (tài liệu `08` mục 21, 22): API trước hết cần `finance.access` hoặc `finance.commission.view` ở công ty đang chọn; quyền chi tiết phải gán ở phạm vi tập đoàn hoặc công ty. Dữ liệu công ty khác trả `404`.
- Ghi nhật ký thao tác: `commission_settings.update`, `commission_targets.update`, `commission_statement.create`, `commission_statement.submit`, `commission_statement.withdraw`, `commission_statement.discard`.
- Tiền trả về dạng chuỗi, bỏ số 0 thừa; tiền tính làm tròn theo đơn vị tiền tệ công ty (`finance.company_minor_units`).

### CHUC_NANG_80: Cài đặt hoa hồng của công ty; chỉ tiêu tháng
- Mục đích: Mỗi công ty tự đặt chính sách hoa hồng đội kinh doanh và chỉ tiêu tháng của từng nhân viên.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn (sửa); Kế toán (xem).
- Điều kiện thực hiện: Xem: `finance.commission.view` hoặc `finance.commission.setup`. Sửa cài đặt, chỉ tiêu: `finance.commission.setup`.
- Dữ liệu đầu vào: Cài đặt: bật; ngày bắt đầu; cách gán (`customer_owner`, `order_creator`); cách kết hợp (`matrix`, `channel_factor`); mức mặc định (0 đến 100, tối đa 4 chữ số lẻ); bậc (1 đến 20 dòng: từ phần trăm đạt tối đa 4 chữ số phần nguyên, 2 chữ số lẻ; hệ số 0 đến 10, tối đa 4 chữ số lẻ); mức (tối đa 2.000 dòng: ngành hàng, kênh hoặc mọi kênh, phần trăm); hệ số kênh (tối đa 200 dòng: kênh, hệ số); `version`. Chỉ tiêu: tháng `YYYY-MM`; tối đa 500 dòng (nhân viên, tiền tối đa 16 chữ số phần nguyên, 4 chữ số lẻ; trống là bỏ chỉ tiêu).
- Quy trình xử lý: Kiểm theo QUYTAC_NGHIEPVU_108 (ngày bắt đầu khi bật; bậc sắp tăng dần, bậc đầu từ 0, không trùng; mức không trùng ngành hàng và kênh; ngành hàng tồn tại; kênh thuộc công ty), báo lỗi tại từng trường. Khóa cài đặt (`FOR UPDATE`), so `version`; lưu cài đặt, thay toàn bộ mức, hệ số kênh. Chỉ tiêu: nhân viên phải là thành viên đang làm việc của công ty; tiền trống thì xóa chỉ tiêu, có thì ghi đè.
- Kết quả đầu ra: Cài đặt, bậc, mức, hệ số kênh, ngành hàng đang dùng (dùng chung tập đoàn), kênh đang dùng của công ty, `canSetup`, `version`. Chỉ tiêu: tháng, nhân viên đang làm việc của công ty (họ tên, chỉ tiêu), `canSetup`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_42
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_108
- Trường hợp ngoại lệ: Chưa lưu cài đặt: xem trả giá trị mặc định (chưa bật, nhân viên phụ trách khách, bảng ngành hàng và kênh, mức mặc định 0, một bậc từ 0 hệ số 1, `version` 0).
- Phân quyền: Không có `finance.commission.setup` sửa nhận 403; màn hình chỉ xem, không có nút "Lưu"; không thấy mục menu "Cài đặt hoa hồng".
- Thông báo lỗi: "Vui lòng nhập thông tin này." · "Bậc đầu tiên phải bắt đầu từ 0%." · "Hai bậc trùng phần trăm bắt đầu." · "Ngành hàng và kênh này đã có mức." · "Giá trị không hợp lệ." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_127, TIEUCHI_NGHIEMTHU_131

### CHUC_NANG_81: Gán nhân viên hưởng hoa hồng cho đơn bán
- Mục đích: Đơn bán biết ai hưởng hoa hồng ngay khi gửi, không đổi về sau.
- Người sử dụng: Nhân viên bán hàng (gửi đơn, gián tiếp).
- Điều kiện thực hiện: Công ty đang bật; ngày đơn không trước ngày bắt đầu; đơn chưa có nhân viên hưởng.
- Dữ liệu đầu vào: Đơn bán được gửi (API_77 `submit`).
- Quy trình xử lý: Trong giao dịch gửi đơn, sau khi cấp số, hàm `assignCommissionUser` ghi `sales.orders.commission_user_id`: cách gán `order_creator` lấy người lập đơn; `customer_owner` lấy nhân viên phụ trách trong hồ sơ khách tại công ty (`crm.partner_profiles.owner_user_id`). Đơn đã gán giữ nguyên (QUYTAC_NGHIEPVU_109).
- Kết quả đầu ra: Nhân viên hưởng lưu trên đơn bán; API đơn bán chưa trả trường này.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_42
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_109
- Trường hợp ngoại lệ: Khách không có nhân viên phụ trách, đơn không có khách với cách gán nhân viên phụ trách khách: không gán. Công ty tắt hoặc ngày đơn trước ngày bắt đầu: không gán; gửi lại khi đủ điều kiện thì gán.
- Phân quyền: Theo quyền gửi đơn bán (`sales.order.manage`); không cần quyền hoa hồng.
- Thông báo lỗi: Không có.
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_128

### CHUC_NANG_82: Ghi phát sinh hoa hồng khi thu tiền; xem phát sinh
- Mục đích: Hoa hồng tính tự động theo tiền đã thu của từng dòng đơn.
- Người sử dụng: Kế toán (ghi sổ phiếu thu chi, gián tiếp); Thủ kho (ghi sổ phiếu kho, gián tiếp); Kế toán, Kế toán trưởng, quản trị (xem).
- Điều kiện thực hiện: Ghi: công ty đang bật, đơn có nhân viên hưởng, ngày phát sinh không trước ngày bắt đầu. Xem: `finance.commission.view`.
- Dữ liệu đầu vào: Lần trừ nợ phải thu; phiếu xuất giao hàng, phiếu nhận hàng trả lại đã ghi sổ. Xem: `userId`, `from`, `to`, `page`, `pageSize` (1 đến 100, mặc định 50).
- Quy trình xử lý: `CommissionsService` đăng ký móc nối `DebtsService.allocatedHooks` (gọi trong cùng giao dịch sau mỗi lần ghi `finance.debt_allocations`) và `StockDocumentsService.postedHooks`. Trừ nợ khoản phải thu của phiếu xuất giao hàng bằng phiếu thu `customer_receipt`: nguồn `receipt`, dương. Trừ khoản giảm nợ của phiếu nhận hàng trả lại bằng phiếu chi: nguồn `refund`, âm. Phiếu kho của đơn không có khách: `retail_delivery` dương, `retail_return` âm. Tiền gồm thuế, chưa thuế của từng dòng đơn trên phiếu tính bằng `finance.line_share` theo lũy kế như công nợ, cộng các dòng phiếu cùng dòng đơn. Chia số tiền trừ nợ theo phần còn phải thu của từng dòng, quy về tiền chưa thuế (QUYTAC_NGHIEPVU_110). Mức tính bằng `commissionPercent` (ngành hàng của sản phẩm, ngành hàng cha gần nhất, hai cách kết hợp). Ghi `finance.commission_events`; trùng chứng từ nguồn và dòng đơn thì bỏ qua. Xem: lọc theo công ty, nhân viên, khoảng ngày phát sinh; số chứng từ nguồn là số phiếu thu chi (thu tiền, hoàn tiền) hoặc số phiếu kho (bán lẻ).
- Kết quả đầu ra: Phát sinh theo dòng đơn. Danh sách (ngày, nhân viên, nguồn, số chứng từ nguồn, đơn, mặt hàng, tiền chưa thuế, phần trăm, hoa hồng, số bảng hoa hồng) theo ngày giảm dần, rồi thời điểm ghi giảm dần.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_42
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_108, QUYTAC_NGHIEPVU_110
- Trường hợp ngoại lệ: Trả hàng trừ vào phần chưa thu: không phát sinh. Dòng đã thu đủ không nhận thêm. Sửa cài đặt không tính lại phát sinh đã ghi. Phiếu chi hoàn tiền trừ vào khoản giảm nợ cũ nhất (có thể là khoản trả trước, không phải phiếu trả hàng) thì không ghi phát sinh âm. Số dư đầu kỳ không phát sinh hoa hồng.
- Phân quyền: Không có `finance.commission.view` xem nhận 403, không thấy mục menu "Hoa hồng". Ghi phát sinh không cần quyền hoa hồng.
- Thông báo lỗi: "Giá trị không hợp lệ." (bộ lọc)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_129, TIEUCHI_NGHIEMTHU_131

### CHUC_NANG_83: Bảng hoa hồng tháng
- Mục đích: Chốt hoa hồng tháng đúng chính sách, có duyệt và bút toán.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị (lập, bỏ, gửi, rút); người duyệt theo chính sách.
- Điều kiện thực hiện: Xem: `finance.commission.view`. Lập, bỏ bảng nháp, gửi: `finance.commission.manage`. Rút: người lập, bảng chờ duyệt có yêu cầu duyệt.
- Dữ liệu đầu vào: Lập: `month` (`YYYY-MM`). Gửi: `version`.
- Quy trình xử lý: Danh sách: 120 bảng mới nhất, tháng tiếp theo (`nextMonth`, QUYTAC_NGHIEPVU_111), `canCreate` (có quyền, không có bảng nháp, chờ duyệt, có tháng tiếp theo). Lập: khóa cài đặt của công ty (`FOR UPDATE`) để hai người lập cùng lúc không trùng; kiểm không có bảng nháp, chờ duyệt, tháng bằng tháng tiếp theo; gắn phát sinh chưa vào bảng có ngày đến hết tháng; tính dòng theo nhân viên, tổng. Bỏ bảng nháp: xóa bảng, dòng; phát sinh trả về. Gửi: tạo dãy số `HH` nếu chưa có; khóa bảng, so `version`, kiểm nháp; cấp số; tạo yêu cầu duyệt (`submitWithin`; giá trị là trị tuyệt đối của tổng, tiền tệ công ty, ngày cuối tháng); chưa có chính sách thì ghi sổ ngay trong cùng giao dịch. Nghe `core.approval.completed` loại `finance.commission`: duyệt thì ghi sổ (lỗi quy tắc thì `rejected` kèm khóa thông báo); từ chối, rút thì trả phát sinh. Ghi sổ: công ty đã khởi tạo kế toán thì kiểm định khoản hai vai trò, lập bút toán bằng `commissionDraft` và `LedgerService.record` (QUYTAC_NGHIEPVU_112); khởi tạo kế toán về sau lập bút toán cho bảng đã ghi sổ.
- Kết quả đầu ra: Bảng (tháng, số, trạng thái, tổng, lý do không ghi sổ được), dòng theo nhân viên (cơ sở, hoa hồng trước hệ số, chỉ tiêu, phần trăm đạt, hệ số, hoa hồng), số phát sinh, tiền tệ, `canManage`, `canWithdraw`, `version`; bút toán nguồn `commission`.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_42
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_111, QUYTAC_NGHIEPVU_112
- Trường hợp ngoại lệ: Tổng âm: bút toán đảo bên. Tháng đã khóa sổ: bút toán ngày sau ngày khóa sổ. Công ty chưa khởi tạo kế toán: ghi sổ không có bút toán đến khi khởi tạo.
- Phân quyền: Không có `finance.commission.manage` lập, bỏ, gửi, rút nhận 403, không thấy nút "Lập bảng tháng …", "Gửi", "Bỏ bảng nháp"; rút bảng của người khác nhận 403, không thấy nút "Rút".
- Thông báo lỗi: "Đang có bảng hoa hồng nháp hoặc chờ duyệt; xử lý bảng đó trước." · "Chỉ lập được bảng của tháng tiếp theo đã kết thúc." · "Chỉ sửa được chứng từ đang ở trạng thái nháp." · "Chưa có định khoản cho chi phí hoa hồng hoặc phải trả người lao động; kế toán trưởng khai ở Hệ thống tài khoản." · "Bạn không có quyền thực hiện thao tác này." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_130, TIEUCHI_NGHIEMTHU_131

## Yêu cầu phi chức năng của MODULE_06 (phần 5)

| Nhóm | Yêu cầu |
|---|---|
| Toàn vẹn | Phát sinh ghi trong cùng giao dịch trừ nợ, ghi sổ phiếu kho; chỉ mục duy nhất (nguồn, chứng từ nguồn, dòng đơn) chống ghi trùng; phát sinh vào nhiều nhất một bảng; mỗi tháng một bảng đang dùng (chỉ mục duy nhất có điều kiện); bảng đã ghi sổ không sửa |
| Ranh giới module | Module `apps/api/src/commission` đăng ký móc nối `DebtsService.allocatedHooks`, `StockDocumentsService.postedHooks`; module Công nợ, Kho không phụ thuộc module hoa hồng; module Bán hàng gọi hàm dùng chung `assignCommissionUser` (`commission-rules.ts`, không phụ thuộc dịch vụ khác); bút toán qua `commissionDraft`, `LedgerService.record` |
| Thư viện | Không thêm thư viện |
| Giao diện | Dùng được trên điện thoại |

## MODULE_06 Tài chính – Kế toán (phần 6: Đối soát ngân hàng, CONG_VIEC_18)

Quy ước chung cho mọi chức năng của MODULE_06 phần 6:
- Quyền (tài liệu `08` mục 23, 24): API cần đăng nhập trước hết cần `finance.access`, `finance.bank.view` hoặc `finance.bank.setup` ở công ty đang chọn; quyền chi tiết phải gán ở phạm vi tập đoàn hoặc công ty. Dữ liệu công ty khác trả `404`. Webhook không cần đăng nhập, xác thực bằng khóa của kết nối.
- Ghi nhật ký thao tác: `bank_connection.create`, `bank_connection.update` (không ghi khóa, chỉ ghi đã đổi khóa hay chưa), `bank_transaction.confirm_receipt`, `bank_transaction.match`, `bank_transaction.ignore`, `bank_transaction.reopen`.
- Tiền trả về dạng chuỗi, bỏ số 0 thừa. Ngày giao dịch tính theo giờ Việt Nam.
- Lưu, tự ghép, ghép tay giao dịch của một quỹ chạy tuần tự (khóa theo quỹ trong giao dịch cơ sở dữ liệu), để không ghép trùng.

### CHUC_NANG_84: Kết nối ngân hàng cho quỹ ngân hàng
- Mục đích: Mỗi quỹ ngân hàng nhận giao dịch tự động qua dịch vụ trung gian công ty chọn.
- Người sử dụng: Kế toán trưởng, quản trị công ty, quản trị tập đoàn (cài đặt); Kế toán (xem).
- Điều kiện thực hiện: Xem: `finance.bank.view` hoặc `finance.bank.setup`. Tạo, sửa, gửi giao dịch thử: `finance.bank.setup`. Gửi thử chỉ ngoài môi trường thật, với kết nối bộ giả lập.
- Dữ liệu đầu vào: Kết nối: dịch vụ (`simulator`, `sepay`), bật tắt, đổi khóa, `version` (`null` khi tạo). Giao dịch thử: chiều, số tiền (tối đa 16 chữ số phần nguyên, 4 chữ số lẻ), nội dung (tối đa 500 ký tự), ngày giao dịch (trống là hôm nay).
- Quy trình xử lý: Danh sách: quỹ ngân hàng đang dùng của công ty và quỹ ngừng dùng đã có kết nối, theo mã quỹ. Tạo: quỹ phải là quỹ ngân hàng của công ty, đang dùng; sinh khóa 24 byte ngẫu nhiên, lưu mã hóa bằng `common/secret-box`, lưu bốn ký tự cuối. Sửa: so `version`; đổi khóa thì sinh khóa mới thay khóa cũ (QUYTAC_NGHIEPVU_113). Gửi thử: tạo giao dịch như webhook (mã `SIM-…`, không có số dư) rồi lưu, tự ghép, gợi ý như CHUC_NANG_85, CHUC_NANG_86.
- Kết quả đầu ra: Danh sách quỹ (mã, tên, ngân hàng, số tài khoản, kết nối: dịch vụ, bật tắt, bốn ký tự cuối của khóa, đường dẫn webhook, lần nhận cuối, `version`), `canSetup`, `simulatorAllowed`. Lưu trả kết nối và khóa (chỉ khi tạo hoặc đổi khóa, khác thì `null`). Gửi thử trả giao dịch vừa lưu.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_43
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_113
- Trường hợp ngoại lệ: Quỹ ngừng dùng không tạo được kết nối mới. Môi trường thật không chọn được bộ giả lập, không gửi thử được.
- Phân quyền: Không có `finance.bank.setup` lưu, gửi thử nhận 403; màn hình chỉ xem, không có nút "Kết nối", "Sửa", "Gửi thử"; không thấy mục menu "Kết nối ngân hàng".
- Thông báo lỗi: "Quỹ đã ngừng dùng, không tạo được kết nối." · "Không dùng được bộ giả lập trên môi trường thật." · "Quỹ chưa kết nối bộ giả lập." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_132, TIEUCHI_NGHIEMTHU_134, TIEUCHI_NGHIEMTHU_138

### CHUC_NANG_85: Nhận giao dịch qua webhook; tự ghép với phiếu thu chi
- Mục đích: Giao dịch ngân hàng vào hệ thống ngay khi phát sinh, tự gắn với chứng từ đã có.
- Người sử dụng: Dịch vụ trung gian (gửi webhook); Kế toán, Kế toán trưởng, quản trị (xem danh sách).
- Điều kiện thực hiện: Webhook: kết nối tồn tại, đang bật, khóa đúng. Xem: `finance.bank.view`.
- Dữ liệu đầu vào: Webhook định dạng SePay: `id`, `transactionDate` (`YYYY-MM-DD HH:mm:ss` giờ Việt Nam), `transferType` (`in`, `out`), `transferAmount` (lớn hơn 0, tối đa 16 chữ số phần nguyên, 4 chữ số lẻ), `accumulated`, `content` (tối đa 1.000 ký tự) hoặc `description`, `referenceCode`, `accountNumber`. Danh sách: quỹ, trạng thái, chiều, từ ngày, đến ngày, tìm (nội dung, mã tham chiếu, số tiền; tối đa 100 ký tự), `page`, `pageSize` (1 đến 100, mặc định 20).
- Quy trình xử lý: Kiểm khóa, dữ liệu, số tài khoản (QUYTAC_NGHIEPVU_113, QUYTAC_NGHIEPVU_114). Trong một giao dịch cơ sở dữ liệu, khóa theo quỹ: lưu giao dịch (trùng mã giao dịch trên cùng kết nối thì bỏ qua), ghi lần nhận cuối, tự ghép theo QUYTAC_NGHIEPVU_115, gợi ý khách cho tiền vào (CHUC_NANG_86). `BankReconciliationService` đăng ký móc nối `PaymentsService.postedHooks`: phiếu thu chi của quỹ có kết nối ghi sổ thì thử ghép lại trong cùng giao dịch ghi sổ.
- Kết quả đầu ra: Webhook trả `200 {"success": true}`. Danh sách giao dịch theo thời điểm giảm dần: thời điểm, quỹ, chiều, số tiền, nội dung, mã tham chiếu, số dư sau giao dịch, trạng thái, phiếu đã ghép (số, loại, đối tác, ngày), tự ghép hay không, gợi ý, phiếu thu lập từ gợi ý, lý do bỏ qua, `version`; `canManage`, tiền tệ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_43
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_113, QUYTAC_NGHIEPVU_114, QUYTAC_NGHIEPVU_115
- Trường hợp ngoại lệ: Nhiều phiếu hoặc nhiều giao dịch cùng thỏa: không tự ghép. Webhook không có số tài khoản hoặc quỹ không có số tài khoản: không so số tài khoản.
- Phân quyền: Không có `finance.bank.view` xem danh sách nhận 403, không thấy mục menu "Giao dịch ngân hàng".
- Thông báo lỗi: "Khóa xác thực webhook không đúng hoặc kết nối đã tắt." (401) · "Dữ liệu giao dịch ngân hàng không hợp lệ." (400) · "Số tài khoản trong giao dịch khác số tài khoản của quỹ." (409) · "Giá trị không hợp lệ." (bộ lọc)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_132, TIEUCHI_NGHIEMTHU_133, TIEUCHI_NGHIEMTHU_134, TIEUCHI_NGHIEMTHU_138

### CHUC_NANG_86: Xử lý giao dịch chưa ghép
- Mục đích: Mọi giao dịch có chứng từ hoặc có lý do bỏ qua.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị.
- Điều kiện thực hiện: `finance.bank.manage`; lập phiếu thu cần thêm `finance.payment.manage`.
- Dữ liệu đầu vào: Lập phiếu thu: khách hàng, `version`. Ghép tay: phiếu thu chi, `version`. Bỏ qua: lý do (1 đến 500 ký tự), `version`. Bỏ ghép, thôi bỏ qua: `version`.
- Quy trình xử lý: Gợi ý khách khi nhận giao dịch theo QUYTAC_NGHIEPVU_116. Lập phiếu thu: giao dịch phải chưa ghép, tiền vào, chưa có phiếu thu chờ duyệt hoặc đã ghi sổ; còn phiếu nháp của lần trước thì đặt lại theo giao dịch và khách vừa chọn (`PaymentsService.update`), không thì lập phiếu thu khách hàng (`customer_receipt`) qua `PaymentsService.create` rồi gắn vào giao dịch với điều kiện `version` chưa đổi (lần xác nhận song song thua: xóa phiếu nháp vừa lập, trả `409`); gửi qua `PaymentsService.submit`; phiếu ghi sổ thì móc nối ghép giao dịch với phiếu khi phiếu còn khớp quỹ, số tiền, loại, ngày lệch tối đa 3 ngày, không khớp thì bỏ liên kết (QUYTAC_NGHIEPVU_116). Danh sách phiếu ghép tay: tối đa 20 phiếu đã ghi sổ, cùng quỹ, cùng chiều, cùng số tiền, chưa ghép, ngày gần ngày giao dịch trước. Ghép tay: khóa giao dịch (`FOR UPDATE`), khóa quỹ, kiểm lại điều kiện phiếu (QUYTAC_NGHIEPVU_117). Bỏ qua: ghi lý do, người, thời điểm. Bỏ ghép, thôi bỏ qua: về chưa ghép, xóa phiếu đã ghép, lý do; phiếu không đổi.
- Kết quả đầu ra: Giao dịch sau thao tác (như danh sách CHUC_NANG_85).
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_43
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_116, QUYTAC_NGHIEPVU_117
- Trường hợp ngoại lệ: Phiếu thu chờ duyệt: không bỏ qua, không lập lại được; giao dịch ghép khi phiếu ghi sổ. Phiếu thu bị từ chối, rút: lập lại được. Tiền ra không có gợi ý, không lập phiếu thu.
- Phân quyền: Không có `finance.bank.manage` nhận 403, không thấy cột thao tác.
- Thông báo lỗi: "Giao dịch không còn ở trạng thái chưa ghép." · "Giao dịch đang ở trạng thái chưa ghép." · "Chỉ lập phiếu thu cho tiền vào." · "Giao dịch đã có phiếu thu đang chờ duyệt hoặc đã ghi sổ." · "Phiếu không ghép được: phải đã ghi sổ, cùng quỹ, cùng chiều tiền, cùng số tiền và chưa ghép giao dịch khác." · "Vui lòng nhập thông tin này." · "Dữ liệu đã được người khác sửa. Tải lại để xem bản mới nhất."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_135, TIEUCHI_NGHIEMTHU_136, TIEUCHI_NGHIEMTHU_138

### CHUC_NANG_87: Đối chiếu quỹ ngân hàng theo khoảng ngày
- Mục đích: Biết số dư quỹ ngân hàng trên sổ có khớp ngân hàng không và khoản nào chưa khớp.
- Người sử dụng: Kế toán, Kế toán trưởng, quản trị.
- Điều kiện thực hiện: `finance.bank.view`.
- Dữ liệu đầu vào: Quỹ ngân hàng, từ ngày, đến ngày (từ ngày không sau đến ngày).
- Quy trình xử lý: Số dư sổ: số dư đầu của quỹ cộng phiếu thu chi đã ghi sổ đến hết ngày cuối. Số dư ngân hàng: số dư sau giao dịch của giao dịch gần nhất có số dư, ngày không sau ngày cuối. Chênh lệch: số dư ngân hàng trừ số dư sổ. Trong khoảng ngày: số giao dịch, tổng tiền chưa ghép theo chiều; số giao dịch bỏ qua; phiếu đã ghi sổ của quỹ chưa có giao dịch (tối đa 100 phiếu, theo ngày, số phiếu) và tổng số phiếu đó.
- Kết quả đầu ra: Quỹ, khoảng ngày, số dư sổ, số dư ngân hàng và thời điểm, chênh lệch, tiền vào chưa ghép, tiền ra chưa ghép, số bỏ qua, danh sách và số phiếu chưa có giao dịch, tiền tệ.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_43
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_115
- Trường hợp ngoại lệ: Dịch vụ không gửi số dư (bộ giả lập): số dư ngân hàng, chênh lệch là `null`.
- Phân quyền: Không có `finance.bank.view` nhận 403.
- Thông báo lỗi: "Giá trị không hợp lệ." (từ ngày sau đến ngày)
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_137, TIEUCHI_NGHIEMTHU_138

## Yêu cầu phi chức năng của MODULE_06 (phần 6)

| Nhóm | Yêu cầu |
|---|---|
| Bảo mật | Webhook công khai: khóa sinh ngẫu nhiên, lưu mã hóa AES-256-GCM, so sánh thời gian cố định; giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP; chỉ chấp nhận đúng số tài khoản của quỹ (tài liệu `22`) |
| Toàn vẹn | Chỉ mục duy nhất (kết nối, mã giao dịch của dịch vụ) chống lưu trùng; chỉ mục duy nhất phiếu đã ghép (một phiếu một giao dịch); ràng buộc đã ghép khi và chỉ khi có phiếu, bỏ qua khi và chỉ khi có lý do; khóa theo quỹ khi lưu, ghép |
| Ranh giới module | Module `apps/api/src/bank` đăng ký móc nối `PaymentsService.postedHooks`; module Tài chính (`apps/api/src/finance`) không phụ thuộc module ngân hàng; lập phiếu thu qua `PaymentsService.create`, `submit` (không đổi ghi sổ, công nợ, bút toán, luồng duyệt) |
| Thư viện | Không thêm thư viện |
| Giao diện | Dùng được trên điện thoại |

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| CHUC_NANG_05 | Giới hạn 1.000 dòng mỗi tệp Excel |
| CHUC_NANG_06 | Thêm đặt lại mật khẩu; đường dẫn hết hạn sau 1 giờ |
| CHUC_NANG_08 | Mã OTP 6 chữ số, hiệu lực 5 phút; tối đa 5 lần nhập sai, 5 lần gửi mỗi giờ |
| CHUC_NANG_09 | 10 mã dự phòng; quản trị đặt lại được xác thực hai lớp |
| CHUC_NANG_18 | Tác vụ kiểm tra quá hạn chạy mỗi 15 phút |
| CHUC_NANG_19 | Vô hiệu hóa ở một công ty chỉ gỡ khỏi công ty đó |
| Phi chức năng | Mốc 200 người dùng đồng thời |
