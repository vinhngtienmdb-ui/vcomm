# 10. YÊU CẦU CHỨC NĂNG

- Mô tả: Đặc tả yêu cầu chức năng và yêu cầu phi chức năng, có mã định danh.
- Phiên bản: 1.4
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_03 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm CHUC_NANG_30 đến CHUC_NANG_37 của MODULE_02

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
