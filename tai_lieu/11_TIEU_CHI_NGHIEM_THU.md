# 11. TIÊU CHÍ NGHIỆM THU

- Mô tả: Tiêu chí nghiệm thu cho từng chức năng, đánh dấu Bắt buộc hoặc Mong muốn.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Chờ phê duyệt

## MODULE_01 Nền tảng

Dữ liệu mẫu dùng trong tiêu chí: tập đoàn VCG; công ty con VCR, VCT; chi nhánh VCR-HCM, VCR-BD (kho Bình Dương). Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_01 | CHUC_NANG_01 | Khi quản trị tập đoàn tạo VCR, VCT dưới VCG thì cây hiện đúng 3 công ty | Tạo 2 công ty, xem cây | Bắt buộc |
| TIEUCHI_NGHIEMTHU_02 | CHUC_NANG_01 | Khi tạo công ty trùng mã hoặc trùng mã số thuế thì bị từ chối kèm thông báo | Tạo công ty thứ hai trùng mã số thuế VCR | Bắt buộc |
| TIEUCHI_NGHIEMTHU_03 | CHUC_NANG_01 | Khi quản trị công ty gọi API tạo công ty thì bị từ chối | Gọi API bằng tài khoản quản trị VCR | Bắt buộc |
| TIEUCHI_NGHIEMTHU_04 | CHUC_NANG_02 | Khi quản trị VCR tạo chi nhánh cho VCT thì bị từ chối; tạo cho VCR thì thành công | Hai lần tạo | Bắt buộc |
| TIEUCHI_NGHIEMTHU_05 | CHUC_NANG_03 | Khi chọn phòng ban con làm phòng ban cha thì bị từ chối | Tạo A, B con của A; sửa A có cha là B | Bắt buộc |
| TIEUCHI_NGHIEMTHU_06 | CHUC_NANG_04 | Khi mời nhân viên thì nhận được đường dẫn; kích hoạt xong đăng nhập được | Mời bằng email thử, kích hoạt, đăng nhập | Bắt buộc |
| TIEUCHI_NGHIEMTHU_07 | CHUC_NANG_04 | Khi dùng đường dẫn kích hoạt sau 72 giờ hoặc lần thứ hai thì bị từ chối | Chỉnh đồng hồ thử; dùng lại đường dẫn | Bắt buộc |
| TIEUCHI_NGHIEMTHU_08 | CHUC_NANG_04 | Khi mời vào VCT một email đã có tài khoản ở VCR thì không tạo tài khoản mới mà thêm vào VCT | Mời, kiểm tra số tài khoản | Bắt buộc |
| TIEUCHI_NGHIEMTHU_09 | CHUC_NANG_05 | Khi nhập tệp 10 dòng có 2 dòng trùng email thì 8 dòng được mời, tệp lỗi liệt kê đúng 2 dòng | Nhập tệp mẫu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_10 | CHUC_NANG_06 | Khi nhập sai mật khẩu 5 lần liên tiếp thì lần thứ 6 bị khóa 15 phút, kể cả nhập đúng | Nhập sai 5 lần, nhập đúng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_11 | CHUC_NANG_06 | Khi sai tên đăng nhập hoặc sai mật khẩu thì cùng một thông báo | So sánh hai thông báo | Bắt buộc |
| TIEUCHI_NGHIEMTHU_12 | CHUC_NANG_06 | Khi đặt lại mật khẩu thì các phiên cũ bị thu hồi | Đăng nhập 2 trình duyệt, đặt lại ở một nơi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_13 | CHUC_NANG_07 | Khi đăng nhập Google bằng email chưa được mời thì bị từ chối, không tạo tài khoản | Đăng nhập bằng email thử chưa mời | Bắt buộc |
| TIEUCHI_NGHIEMTHU_14 | CHUC_NANG_08 | Cùng một tài khoản đăng nhập được bằng mật khẩu, Google và số điện thoại | Ba lần đăng nhập, cùng mã tài khoản | Bắt buộc |
| TIEUCHI_NGHIEMTHU_15 | CHUC_NANG_09 | Khi gán vai trò có quyền nhạy cảm thì lần đăng nhập sau bắt buộc mã OTP | Gán vai trò kế toán, đăng nhập lại | Bắt buộc |
| TIEUCHI_NGHIEMTHU_16 | CHUC_NANG_09 | Khi dùng một mã dự phòng hai lần thì lần thứ hai bị từ chối | Dùng lại mã | Bắt buộc |
| TIEUCHI_NGHIEMTHU_17 | CHUC_NANG_10 | Khi nhân viên bắt buộc xác thực hai lớp thì không tắt được | Thử tắt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_18 | CHUC_NANG_10 | Khi thu hồi một phiên trong danh sách thì thiết bị đó phải đăng nhập lại | Thu hồi, thao tác ở thiết bị đó | Bắt buộc |
| TIEUCHI_NGHIEMTHU_19 | CHUC_NANG_11 | Nhân viên thuộc VCR và VCT chuyển qua lại không phải đăng nhập lại | Chuyển công ty | Bắt buộc |
| TIEUCHI_NGHIEMTHU_20 | CHUC_NANG_11 | Nhân viên là kế toán ở VCR, chỉ xem ở VCT thì không lập được chứng từ kế toán khi đang ở VCT | Gọi API lập chứng từ ở VCT | Bắt buộc |
| TIEUCHI_NGHIEMTHU_21 | CHUC_NANG_12 | Khi quản trị VCR thêm vào vai trò một quyền mình không có thì bị từ chối | Thử thêm quyền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_22 | CHUC_NANG_12 | Khi bỏ một quyền khỏi vai trò thì người có vai trò đó mất quyền ngay ở thao tác tiếp theo | Bỏ quyền, thao tác lại | Bắt buộc |
| TIEUCHI_NGHIEMTHU_23 | CHUC_NANG_13 | Thủ kho gán phạm vi VCR-BD không xem được dữ liệu kho VCR-HCM qua API | Có kiểm thử tự động | Bắt buộc |
| TIEUCHI_NGHIEMTHU_24 | CHUC_NANG_13 | Lần gán có ngày kết thúc hôm nay thì ngày mai hết quyền | Chỉnh đồng hồ thử | Bắt buộc |
| TIEUCHI_NGHIEMTHU_25 | CHUC_NANG_13 | Quản trị VCR không gán được vai trò phạm vi VCT hoặc phạm vi tập đoàn | Gọi API gán | Bắt buộc |
| TIEUCHI_NGHIEMTHU_26 | CHUC_NANG_13 | Không có API hoặc màn hình nào cho phép đăng nhập thay nhân viên khác | Rà soát danh sách API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_27 | CHUC_NANG_14 | Trang chủ chỉ hiện mini app có quyền truy cập trong công ty đang chọn | Hai nhân viên khác quyền so sánh | Bắt buộc |
| TIEUCHI_NGHIEMTHU_28 | CHUC_NANG_15 | Khi cấu hình cấp sau có ngưỡng nhỏ hơn cấp trước hoặc thiếu người thay thế thì bị từ chối | Lưu cấu hình sai | Bắt buộc |
| TIEUCHI_NGHIEMTHU_29 | CHUC_NANG_16 | Với các cấp 0, 50 triệu, 500 triệu đồng: chứng từ 80 triệu đồng qua đúng cấp 1 và cấp 2 | Gửi duyệt, duyệt từng cấp | Bắt buộc |
| TIEUCHI_NGHIEMTHU_30 | CHUC_NANG_16 | Chứng từ 50 triệu đồng đúng bằng ngưỡng cấp 2 thì phải qua cấp 2 | Giá trị biên | Bắt buộc |
| TIEUCHI_NGHIEMTHU_31 | CHUC_NANG_16 | Chứng từ 2.000 USD quy đổi theo tỷ giá hạch toán ngày lập để chọn cấp; không có tỷ giá thì không gửi được | Hai trường hợp | Bắt buộc |
| TIEUCHI_NGHIEMTHU_32 | CHUC_NANG_16 | Trưởng phòng tự lập chứng từ thì cấp "trưởng phòng của người lập" chuyển cho người thay thế; người lập không duyệt được | Gửi duyệt, thử tự duyệt qua API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_33 | CHUC_NANG_16 | Người lập rút lại được khi cấp 1 chưa quyết định; sau khi cấp 1 đồng ý thì không rút được | Hai trường hợp | Bắt buộc |
| TIEUCHI_NGHIEMTHU_34 | CHUC_NANG_16 | Một cấp từ chối thì yêu cầu "Bị từ chối", mini app sở hữu nhận được sự kiện | Từ chối ở cấp 2 | Bắt buộc |
| TIEUCHI_NGHIEMTHU_35 | CHUC_NANG_17 | Hộp duyệt hiện chứng từ chờ từ cả VCR và VCT; duyệt được trên màn hình 360 điểm ảnh | Xem trên điện thoại | Bắt buộc |
| TIEUCHI_NGHIEMTHU_36 | CHUC_NANG_18 | Thời hạn 4 giờ: quá 4 giờ thì nhắc; quá 8 giờ thì chuyển người thay thế | Chỉnh đồng hồ thử | Bắt buộc |
| TIEUCHI_NGHIEMTHU_37 | CHUC_NANG_19 | Không vô hiệu hóa được nhân viên còn chứng từ chờ duyệt khi chưa chọn người nhận bàn giao | Thử vô hiệu hóa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_38 | CHUC_NANG_19 | Sau vô hiệu hóa, mọi phiên của nhân viên hết hiệu lực ngay | Thao tác bằng phiên cũ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_39 | CHUC_NANG_20 | Hai người lưu chứng từ cùng lúc nhận hai số liên tiếp, không trùng | Kiểm thử tự động song song 50 lần | Bắt buộc |
| TIEUCHI_NGHIEMTHU_40 | CHUC_NANG_20 | Lưu chứng từ lỗi thì số không bị dùng; chứng từ sau nhận đúng số đó | Gây lỗi khi lưu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_41 | CHUC_NANG_21 | Nhập trùng tỷ giá cùng ngày, cặp tiền tệ, loại, nguồn thì bị từ chối | Nhập hai lần | Bắt buộc |
| TIEUCHI_NGHIEMTHU_42 | CHUC_NANG_22 | Chuyển sang tiếng Anh thì mọi chữ trên các màn hình của MODULE_01 là tiếng Anh | Duyệt qua mọi màn hình | Bắt buộc |
| TIEUCHI_NGHIEMTHU_43 | CHUC_NANG_23 | Mọi thao tác ghi trong các tiêu chí trên đều có dòng nhật ký với dữ liệu trước và sau | Đối chiếu nhật ký | Bắt buộc |
| TIEUCHI_NGHIEMTHU_44 | CHUC_NANG_23 | Không có API sửa hoặc xóa nhật ký; quản trị VCR không xem được nhật ký VCT | Rà soát API; gọi API tra cứu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_45 | Phi chức năng | Đăng nhập và kiểm tra quyền dưới 200 mili giây ở phân vị 95 với 200 người dùng đồng thời | Kiểm thử tải | Mong muốn |
