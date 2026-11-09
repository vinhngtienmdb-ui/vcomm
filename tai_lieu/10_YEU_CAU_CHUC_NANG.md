# 10. YÊU CẦU CHỨC NĂNG

- Mô tả: Đặc tả yêu cầu chức năng và yêu cầu phi chức năng, có mã định danh.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_03 (2026-11-09)

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
- Dữ liệu đầu vào: Họ tên; ít nhất một trong email, số điện thoại, tên đăng nhập; chi nhánh mặc định; phòng ban; chức danh; vai trò ban đầu.
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
- Mục đích: Nhân viên không có email công ty đăng nhập bằng mã OTP qua SMS.
- Người sử dụng: Nhân viên kho, cửa hàng.
- Điều kiện thực hiện: Số điện thoại gắn với tài khoản "Đang hoạt động".
- Dữ liệu đầu vào: Số điện thoại; mã OTP 6 chữ số.
- Quy trình xử lý: Gửi mã OTP hiệu lực 5 phút; tối đa 5 lần nhập sai mỗi mã; tối đa 5 lần gửi mỗi giờ cho một số.
- Kết quả đầu ra: Phiên làm việc.
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_05
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_10
- Trường hợp ngoại lệ: Số chưa gắn với tài khoản thì vẫn hiện "Đã gửi mã" nhưng không gửi.
- Phân quyền: Không cần quyền.
- Thông báo lỗi: "Mã không đúng hoặc đã hết hạn." · "Bạn đã yêu cầu quá nhiều mã, thử lại sau."
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_14

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

## Yêu cầu phi chức năng của MODULE_01

| Nhóm | Yêu cầu |
|---|---|
| Hiệu năng | Đăng nhập, kiểm tra quyền trả lời dưới 200 mili giây ở phân vị 95 với 200 người dùng đồng thời; quyền lưu đệm, xóa đệm khi đổi vai trò |
| Bảo mật | Mật khẩu băm argon2id; bí mật xác thực hai lớp mã hóa bằng AWS KMS; chỉ lưu bản băm token làm mới; cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`; mọi kết nối qua HTTPS |
| Phiên | Token truy cập sống 15 phút; token làm mới theo QUYTAC_NGHIEPVU_10 |
| Giao diện | Dùng được trên màn hình từ 360 điểm ảnh |
| Ngôn ngữ | Mọi chuỗi giao diện nằm trong tệp dịch tiếng Việt, tiếng Anh |
| Lưu trữ | Nhật ký thao tác giữ tối thiểu 10 năm |

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
