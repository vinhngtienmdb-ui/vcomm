# 11. TIÊU CHÍ NGHIỆM THU

- Mô tả: Tiêu chí nghiệm thu cho từng chức năng, đánh dấu Bắt buộc hoặc Mong muốn.
- Phiên bản: 2.14
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm TIEUCHI_NGHIEMTHU_56 đến TIEUCHI_NGHIEMTHU_64 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_65 đến TIEUCHI_NGHIEMTHU_74 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_75 đến TIEUCHI_NGHIEMTHU_79 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_80 đến TIEUCHI_NGHIEMTHU_86 của MODULE_04; CONG_VIEC_08 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_87 đến TIEUCHI_NGHIEMTHU_92 của MODULE_05; CONG_VIEC_09 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_93 đến TIEUCHI_NGHIEMTHU_98 của MODULE_05 (giao dịch nội bộ); CONG_VIEC_12 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_99 đến TIEUCHI_NGHIEMTHU_104 của MODULE_05 (khuyến mãi); CONG_VIEC_13 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_105 đến TIEUCHI_NGHIEMTHU_110 của MODULE_06 (công nợ); CONG_VIEC_14 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_111 đến TIEUCHI_NGHIEMTHU_116 của MODULE_06 (kế toán tổng hợp); CONG_VIEC_15 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_117 đến TIEUCHI_NGHIEMTHU_120 của MODULE_06 (báo cáo tài chính); CONG_VIEC_16 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_121 đến TIEUCHI_NGHIEMTHU_126 của MODULE_06 (hóa đơn điện tử); CONG_VIEC_17 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_127 đến TIEUCHI_NGHIEMTHU_131 của MODULE_06 (hoa hồng đội kinh doanh); CONG_VIEC_18 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_132 đến TIEUCHI_NGHIEMTHU_138 của MODULE_06 (đối soát ngân hàng); CONG_VIEC_19 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_139 đến TIEUCHI_NGHIEMTHU_144 của MODULE_06 (đối soát thu hộ); CONG_VIEC_20 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_145 đến TIEUCHI_NGHIEMTHU_150 của MODULE_06 (báo cáo tài chính hợp nhất); sửa sau rà soát: TIEUCHI_NGHIEMTHU_147 thêm trả trước nội bộ, số dư ngược chiều; TIEUCHI_NGHIEMTHU_148 thêm đối tác của điều chỉnh tay; CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm TIEUCHI_NGHIEMTHU_151 đến TIEUCHI_NGHIEMTHU_156 của MODULE_07 (gán khách hàng cho nhân viên kinh doanh); CONG_VIEC_23 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_163 đến TIEUCHI_NGHIEMTHU_168 của MODULE_09 (tài khoản người mua); CONG_VIEC_27 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_169 đến TIEUCHI_NGHIEMTHU_174 (đội kinh doanh nhiều cấp); CONG_VIEC_24 (2026-11-11): thêm TIEUCHI_NGHIEMTHU_175 đến TIEUCHI_NGHIEMTHU_183 của MODULE_09 (đặt hàng trên VComm); CONG_VIEC_25 (2026-11-11): thêm TIEUCHI_NGHIEMTHU_184 đến TIEUCHI_NGHIEMTHU_190 của MODULE_09 (thanh toán đơn người mua); CONG_VIEC_26 (2026-11-11): thêm TIEUCHI_NGHIEMTHU_216 đến TIEUCHI_NGHIEMTHU_222 của MODULE_09 (hoa hồng theo đơn và ví hoa hồng; 222 phí rút tiền theo THAY_DOI_17); CONG_VIEC_43 (2026-11-11), THAY_DOI_18: thêm TIEUCHI_NGHIEMTHU_274 đến TIEUCHI_NGHIEMTHU_277 (sửa theo mô hình B2C); đánh dấu TIEUCHI_NGHIEMTHU_127 đến TIEUCHI_NGHIEMTHU_131 (CONG_VIEC_17) đã bỏ, TIEUCHI_NGHIEMTHU_151 đến TIEUCHI_NGHIEMTHU_156 (CONG_VIEC_21) đã tắt

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
| TIEUCHI_NGHIEMTHU_46 | CHUC_NANG_24 | Đăng nhập bằng Zalo chưa liên kết thì bị từ chối, không tạo tài khoản; sau khi liên kết từ hồ sơ cá nhân thì đăng nhập được | Hai lần đăng nhập Zalo thử, trước và sau liên kết | Bắt buộc |
| TIEUCHI_NGHIEMTHU_47 | CHUC_NANG_24 | Liên kết một tài khoản Zalo đã gắn với nhân viên khác thì bị từ chối; hủy liên kết khi Zalo là cách đăng nhập duy nhất thì bị từ chối | Hai trường hợp | Bắt buộc |
| TIEUCHI_NGHIEMTHU_48 | CHUC_NANG_25 | Khóa bí mật không bao giờ trả đầy đủ qua API hoặc ghi vào nhật ký; lưu xong có hiệu lực ngay không cần khởi động lại | Gọi API, đọc nhật ký, đăng nhập thử | Bắt buộc |
| TIEUCHI_NGHIEMTHU_49 | CHUC_NANG_25 | Chỉ quản trị tập đoàn xem, sửa được Cài đặt tích hợp | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_50 | CHUC_NANG_26 | Mỗi lần có chứng từ chờ duyệt, nhắc quá hạn, có kết quả duyệt, người nhận có số điện thoại nhận đúng một tin ZNS theo mẫu đã cài; ZNS lỗi thì luồng duyệt vẫn chạy và có ghi lỗi | Kiểm thử tự động với nguồn giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_51 | CHUC_NANG_08 | Mã OTP gửi qua kênh đa kênh Zalo rồi SMS; chưa cài ZNS thì gửi SMS | Kiểm thử tự động với nguồn giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_52 | CHUC_NANG_27, CHUC_NANG_28 | Lập đề xuất thiếu trường bắt buộc hoặc sai kiểu bị từ chối, chỉ ra đúng trường | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_53 | CHUC_NANG_28 | Gửi đề xuất nhận số tự động, đi qua chính sách duyệt với giá trị đúng; duyệt xong đề xuất chuyển "Đã duyệt"; sửa mẫu sau khi gửi không đổi đề xuất đã gửi | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_54 | CHUC_NANG_28 | Tệp sai loại, quá 10 MB, quá 10 tệp bị từ chối; người không xem được đề xuất không tải được tệp | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_55 | CHUC_NANG_29 | Tệp PDF có tên công ty, số đề xuất, các trường, bảng chi tiết, các cấp duyệt; tiếng Việt đúng dấu | Mở tệp PDF | Bắt buộc |
| TIEUCHI_NGHIEMTHU_45 | Phi chức năng | Đăng nhập và kiểm tra quyền dưới 200 mili giây ở phân vị 95 với 200 người dùng đồng thời | Kiểm thử tải | Mong muốn |

## MODULE_02 Sản phẩm và Nhà bán (phần Sản phẩm, CONG_VIEC_04)

Dữ liệu mẫu: công ty VCR (VComm Bán lẻ Miền Nam), VCT (VComm Thương mại); tài khoản thử theo tài liệu `18` mục 5. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_56 | CHUC_NANG_30 | Chỉ quản trị tập đoàn sửa được ngành hàng, đơn vị tính; ngành hàng quá 4 cấp, trùng mã, xóa khi có sản phẩm bị từ chối | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_57 | CHUC_NANG_31, CHUC_NANG_32 | Tạo sản phẩm có 2 thuộc tính phân loại sinh đủ biến thể với mã hàng đúng quy tắc; sản phẩm của công ty A không đọc, sửa được từ công ty B | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_58 | CHUC_NANG_32 | Mã hàng, mã vạch trùng trong công ty bị từ chối, chỉ ra đúng dòng; hệ số quy đổi sai bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_59 | CHUC_NANG_33 | Nhập 2.000 dòng trong 30 giây; dòng lỗi có trong tệp lỗi kèm lý do, dòng đúng được nhập | Kiểm thử tự động | Bắt buộc |
| TIEUCHI_NGHIEMTHU_60 | CHUC_NANG_34 | Sao chép sản phẩm sang công ty khác tạo đủ biến thể, đơn vị, mã vạch và liên kết; người không có quyền ở công ty đích bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_61 | CHUC_NANG_35, CHUC_NANG_36 | Tạo hai bảng giá đang dùng trùng công ty, kênh, nhóm khách, tiền tệ bị từ chối; tra giá chọn đúng bảng giá theo thứ tự ưu tiên và đúng giá theo ngày | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_62 | CHUC_NANG_37 | Phiếu điều chỉnh giá: có chính sách duyệt thì giá chỉ đổi sau khi duyệt; không có chính sách thì đổi ngay khi gửi; bị từ chối, rút thì giá không đổi; lịch sử giá giữ giá cũ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_63 | CHUC_NANG_31 | Ảnh sai loại, quá 5 MB, quá 10 ảnh bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_64 | CHUC_NANG_31 | Tìm "ao thun" ra sản phẩm "Áo thun"; danh sách 10.000 sản phẩm trả trang đầu dưới 500 ms | Kiểm thử tự động | Mong muốn |

Ghi chú TIEUCHI_NGHIEMTHU_56: hệ thống không có chức năng xóa ngành hàng (QUYTAC_NGHIEPVU_37); vế "xóa khi có sản phẩm bị từ chối" kiểm tra bằng việc không có API xóa, ngành hàng đã có sản phẩm không nhận ngành hàng con, không đổi được mã.

## MODULE_03 Kho (phần web, CONG_VIEC_05)

Dữ liệu mẫu: công ty sở hữu kho VCR (VComm Bán lẻ Miền Nam), công ty chủ hàng VCT (VComm Thương mại); kho thuộc chi nhánh VCR-BD; tài khoản thử theo tài liệu `18` mục 5. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_65 | CHUC_NANG_38 | Kho thuộc chi nhánh; người chỉ có quyền chi nhánh khác không thấy, không thao tác kho; nhân viên công ty chủ hàng chỉ thấy tồn của công ty mình; phiếu chứa sản phẩm của công ty khác chủ hàng bị từ chối | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_66 | CHUC_NANG_39, CHUC_NANG_40 | Nhập khác có duyệt: tồn, giá vốn chỉ đổi sau khi duyệt; giá vốn bình quân đúng công thức qua hai lần nhập giá khác nhau; thẻ kho đúng tồn sau từng biến động | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_67 | CHUC_NANG_40 | Xuất quá tồn khả dụng bị từ chối; hai phiếu xuất đồng thời món hàng cuối cùng chỉ một phiếu ghi sổ; tồn không bao giờ âm | Kiểm thử tự động | Bắt buộc |
| TIEUCHI_NGHIEMTHU_68 | CHUC_NANG_40 | Gợi ý lô hết hạn trước; chọn lô khác không có lý do bị từ chối; lô hết hạn không xuất được; serial trùng, serial không có trong kho bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_69 | CHUC_NANG_41 | Chuyển kho: sau xuất, tồn kho nguồn giảm, hàng đang vận chuyển, kho đích chưa tăng; nhận thiếu sinh biên bản chênh lệch đúng số lượng, giá trị; chuyển sang kho không nhận hàng của công ty chủ hàng bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_70 | CHUC_NANG_42 | Trong lúc kiểm kê, phiếu ghi sổ vào mặt hàng đang kiểm bị từ chối, mặt hàng ngoài phạm vi vẫn ghi được; kết thúc sinh phiếu điều chỉnh đúng chênh lệch, duyệt xong tồn bằng số đếm | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_71 | CHUC_NANG_43 | Không giữ quá tồn khả dụng; giữ hết hạn tự nhả; gia hạn, nhả tay ghi nhật ký thao tác | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_72 | CHUC_NANG_44 | Hàng dưới tối thiểu xuất hiện trong cảnh báo với số gợi ý đúng; tối đa nhỏ hơn tối thiểu bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_73 | CHUC_NANG_45 | Tem PDF đúng khổ, mã vạch đọc được, đủ số tem yêu cầu | Kiểm thử tự động, xem bằng mắt | Mong muốn |
| TIEUCHI_NGHIEMTHU_74 | CHUC_NANG_39 | Danh sách tồn kho 50.000 dòng tồn trả trang đầu dưới 500 ms; ghi sổ phiếu 200 dòng dưới 2 giây | Kiểm thử tự động | Mong muốn |

Ghi chú TIEUCHI_NGHIEMTHU_73: kiểm thử tự động kiểm tra cấu trúc mã Code 128, khổ trang, số trang; vế "mã vạch đọc được" (quét thử bằng máy quét, xem bằng mắt) chưa làm.

## MODULE_07 Khách hàng và Đối tác (phần tối thiểu, CONG_VIEC_06)

Dữ liệu mẫu: công ty con VCR (VComm Bán lẻ Miền Nam), VCT (VComm Thương mại); đối tác, số Căn cước công dân, mã số thuế giả lập. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_75 | CHUC_NANG_46 | Mã số thuế, số Căn cước công dân trùng trong tập đoàn bị từ chối kèm đối tác có sẵn; mã số thuế sai định dạng bị từ chối; tổ chức, hộ kinh doanh thiếu mã số thuế bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_76 | CHUC_NANG_46 | Người có quyền ở công ty A thêm đối tác, công ty B thấy cùng đối tác; sửa ghi nhật ký trước, sau; ngừng giao dịch không xóa | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_77 | CHUC_NANG_47 | Mỗi công ty con đang hoạt động có đúng một đối tác nội bộ; sửa thông tin chung của đối tác nội bộ bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_78 | CHUC_NANG_46 | Danh sách chỉ hiện 3 số cuối Căn cước công dân; xem đầy đủ cần quyền và ghi nhật ký | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_79 | CHUC_NANG_48 | Hồ sơ của công ty A không đọc được từ công ty B; không chọn khách hàng hay nhà cung cấp bị từ chối; hạn mức âm, nhóm khách công ty khác bị từ chối | Gọi API | Bắt buộc |

## MODULE_07 Khách hàng và Đối tác (phần 2: Gán khách hàng cho nhân viên kinh doanh, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): kiểm thử `c21-customer-assignment` đã xóa; phần còn dùng kiểm ở TIEUCHI_NGHIEMTHU_275. Mã đã cấp không dùng lại.

Dữ liệu mẫu: công ty con VCR; trưởng phòng kinh doanh, nhân viên bán hàng ở phòng con và ở phòng khác, kế toán; khách hàng, đơn bán, đối tác giả lập. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_151 | CHUC_NANG_96 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: Nhân viên không có quyền xem mọi khách chỉ thấy khách mình (và phòng mình quản lý) phụ trách, đơn bán của các khách đó, đơn mình lập, đơn mình hưởng hoa hồng; mở khách, đơn khác nhận 404; người có quyền xem như cũ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_152 | CHUC_NANG_96, CHUC_NANG_97 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: Trưởng phòng xem khách của nhân viên phòng mình và phòng con, giao khách trong phòng; không giao được khách, nhân viên ngoài phòng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_153 | CHUC_NANG_97 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: Phiếu giao khách theo chính sách duyệt; không có chính sách thì áp dụng ngay; rút, gửi lại; khách đổi nhân viên hoặc nhân viên nhận ngừng làm việc trong lúc chờ duyệt thì phiếu bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_154 | CHUC_NANG_97, CHUC_NANG_98 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: Áp dụng đổi nhân viên phụ trách, ghi lịch sử, báo nhân viên; đơn đã gán hoa hồng giữ nhân viên cũ, đơn gửi sau gán nhân viên mới | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_155 | CHUC_NANG_96, CHUC_NANG_98 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: Hồ sơ chỉ đặt nhân viên phụ trách khi chưa có; nhân viên bán hàng thêm đối tác mới hoặc nhận đối tác có sẵn thì tự có hồ sơ khách hàng do mình phụ trách, hạn mức 0; lịch sử hiện đúng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_156 | CHUC_NANG_96 đến CHUC_NANG_98 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_275. Nội dung cũ: MAN_HINH_64, MAN_HINH_65 và phần sửa MAN_HINH_36, MAN_HINH_37 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Trình duyệt | Mong muốn |

## MODULE_04 Mua hàng (phần 1: Mua hàng trong nước, CONG_VIEC_07)

Dữ liệu mẫu: công ty con VCR, VCT; kho Bình Dương của VCR; nhà cung cấp, mặt hàng, giá giả lập. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_80 | CHUC_NANG_49 | Giá mua chồng hiệu lực bị từ chối; giá gợi ý đúng theo ngày và số lượng tối thiểu; nhà cung cấp chưa có hồ sơ nhà cung cấp bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_81 | CHUC_NANG_50, CHUC_NANG_51 | Đề nghị mua đi luồng duyệt; đơn từ đề nghị đã duyệt không vượt giá trị thì duyệt ngay, vượt thì chờ duyệt; đặt quá số lượng đề nghị còn lại bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_82 | CHUC_NANG_51 | Đơn đã duyệt sửa tăng giá trị hoặc đổi nhà cung cấp về chờ duyệt; sửa giảm giữ trạng thái; giảm số lượng dưới số đã nhận bị từ chối; đóng đơn hủy phần chưa nhận | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_83 | CHUC_NANG_52 | Nhận vượt dung sai bị từ chối; nhận trong dung sai được; đơn chưa duyệt, đã đóng không nhận được; giá nhập bằng đơn giá đơn mua quy về đơn vị cơ sở | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_84 | CHUC_NANG_52 | Hàng cần kiểm tra chất lượng chưa vào tồn khi chờ kiểm; ghi sổ đúng phần đạt; phần không đạt không tính đã nhận | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_85 | CHUC_NANG_53 | Trả hàng xuất đúng đơn giá phiếu nhập gốc, giá vốn bình quân phần còn lại tính lại đúng; trả quá số đã nhập bị từ chối; trả serial chưa nhập ở phiếu gốc bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_86 | CHUC_NANG_51 | Nhân viên công ty khác không xem được đơn mua; thủ kho chi nhánh khác không nhận hàng vào kho không thuộc chi nhánh mình | Gọi API | Bắt buộc |

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

Dữ liệu mẫu: công ty con VCR, VCT; kho bán Bình Dương của VCR; khách hàng, mặt hàng, bảng giá giả lập. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_87 | CHUC_NANG_54 | Giá dòng lấy đúng bảng giá theo kênh, nhóm khách; mặt hàng không có giá bị từ chối; khách chưa có hồ sơ khách hàng bị từ chối; người mua không lấy hóa đơn lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_88 | CHUC_NANG_54, CHUC_NANG_55 | Không ngoại lệ thì xác nhận ngay; chiết khấu vượt mức, dưới giá vốn, vượt hạn mức công nợ thì chờ duyệt kèm đúng ngoại lệ; duyệt thì xác nhận, từ chối thì nhả hàng giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_89 | CHUC_NANG_54 | Gửi đơn giữ hàng; không đủ hàng khả dụng không gửi được; hủy, đóng nhả phần còn giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_90 | CHUC_NANG_56 | Giao nhiều lần không vượt số đặt; xuất theo giá vốn bình quân; giao đủ thì đơn "Đã giao đủ"; đơn chưa xác nhận, đã đóng không giao được; đơn đã giao không hủy được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_91 | CHUC_NANG_57 | Trả hàng nhập lại theo giá vốn phiếu xuất gốc; trả quá số đã giao, serial chưa giao bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_92 | CHUC_NANG_54 | Công ty khác không xem được đơn bán; thủ kho chi nhánh khác không giao từ kho không thuộc chi nhánh mình | Gọi API | Bắt buộc |

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

Dữ liệu mẫu: công ty bán VCR, công ty mua VCT; mặt hàng liên kết giả lập (một hộp bên VCT bằng 12 cái bên VCR), mặt hàng serial, bảng giá kênh Nội bộ của VCR. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_93 | CHUC_NANG_58 | Đơn bán nội bộ xác nhận thì sinh đúng đơn mua đối ứng (mặt hàng, số lượng quy theo liên kết, giá); thiếu liên kết, sai kênh không gửi được; bên mua xác nhận đi luồng duyệt; từ chối thì đơn bán hủy, nhả hàng giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_94 | CHUC_NANG_59 | Đơn mua nội bộ lấy giá bảng giá "Nội bộ" bên bán, không sửa tay; duyệt thì sinh đơn bán đối ứng; bên bán xác nhận kiểm ngoại lệ, giữ hàng; từ chối thì đơn mua đóng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_95 | CHUC_NANG_60 | Chưa duyệt đơn mua đối ứng thì không giao; xuất ghi sổ sinh phiếu nhập chờ nhận đúng mặt hàng, số lượng, đơn giá, serial; nhận vượt, serial không xuất bị từ chối; nhận đủ thì đơn mua "Đã nhận đủ" | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_96 | CHUC_NANG_61 | Nhận thiếu sinh biên bản đúng số, giá trị; nhập lại kho ghi sổ phiếu trả vào kho xuất; ghi tổn thất đóng biên bản; mỗi biên bản xử lý một lần | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_97 | CHUC_NANG_58, CHUC_NANG_59 | Hủy, đóng một bên thì bên kia đóng phần chưa giao; công ty thứ ba không xem được chứng từ; người không có quyền ở công ty bên kia không xác nhận được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_98 | CHUC_NANG_58 đến CHUC_NANG_61 | Giao diện hiện nhãn nội bộ, liên kết chứng từ đối ứng, nút xác nhận, từ chối, form nhận hàng, danh sách biên bản trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

Dữ liệu mẫu: công ty VCR; bảng giá chung gồm thuế (bánh 11.000, kẹo 22.000, quà 5.500 một cái, thuế 10%), giá vốn bánh 9.000; kênh bán lẻ, bán sỉ, Nội bộ; nhóm khách VIP giả lập. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_99 | CHUC_NANG_62 | Lập chương trình ba loại đúng dữ liệu; gửi duyệt, duyệt thì chạy, từ chối thì sửa được; đang chạy chỉ dừng được; người không có quyền không lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_100 | CHUC_NANG_63 | Giảm theo sản phẩm chọn phần trăm cao nhất, trừ trước chiết khấu tay; giảm theo đơn khi đạt ngưỡng, chọn mức lớn nhất, có trần; mua X tặng Y thêm đúng số suất, dòng tặng giá 0, dòng tặng không tính là hàng mua, kho thiếu hàng tặng thì tặng theo tồn còn lại | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_101 | CHUC_NANG_63 | Không áp khi sai kênh, sai nhóm khách, ngoài thời gian, chương trình chưa chạy hoặc đã dừng, đơn bán nội bộ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_102 | CHUC_NANG_64 | Hết ngân sách, hết suất thì không áp vào đơn mới; gửi đơn vượt ngân sách bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_103 | CHUC_NANG_63 | Phần giảm do khuyến mãi, dòng hàng tặng không sinh ngoại lệ dưới giá vốn; chiết khấu tay vẫn kiểm; dòng hàng tặng được giữ hàng, giao hàng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_104 | CHUC_NANG_62, CHUC_NANG_63 | Giao diện danh sách, soạn chương trình; đơn bán hiện khuyến mãi, dòng tặng trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

Dữ liệu mẫu: công ty VCR; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000, giá mua chưa thuế 8.000; "Khách công nợ" được nợ 30 ngày, "Nhà cung cấp công nợ" được nợ 15 ngày; quỹ tiền mặt số dư đầu 1.000.000. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_105 | CHUC_NANG_65 | Quỹ: thêm, sửa, ngừng dùng; số dư đầu chỉ sửa khi chưa có phiếu; số dư hiện tại, sổ quỹ đúng sau thu, chi | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_106 | CHUC_NANG_66 | Ghi sổ phiếu xuất giao hàng, nhận hàng trả lại, nhập mua (phần đạt kiểm tra chất lượng), trả hàng nhà cung cấp tạo đúng khoản công nợ (giá trị gồm thuế, hạn thanh toán); trả hàng trừ vào phiếu gốc; đơn không có khách không sinh công nợ; phiếu cũ được tính lại | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_107 | CHUC_NANG_67 | Phiếu thu trừ nợ theo chứng từ chọn; không chọn thì trừ cũ nhất trước; phần thừa thành trả trước và tự trừ vào khoản nợ sau; vượt số còn lại, vượt số tiền phiếu bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_108 | CHUC_NANG_67 | Phiếu chi qua luồng duyệt, duyệt xong mới ghi sổ; vượt số dư quỹ thì không ghi sổ, phiếu về bị từ chối kèm lý do; hoàn tiền không vượt trả trước; nhân viên không có quyền không lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_109 | CHUC_NANG_66, CHUC_NANG_68 | Số dư đầu kỳ; danh sách công nợ, tuổi nợ, quá hạn đúng; đơn bán kiểm hạn mức theo dư nợ thật | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_110 | CHUC_NANG_65 đến CHUC_NANG_67 | Màn hình MAN_HINH_46 đến MAN_HINH_49 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 2: Kế toán tổng hợp, CONG_VIEC_14)

Dữ liệu mẫu: công ty VCR chế độ Thông tư 99/2025, tiền tệ đồng Việt Nam; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000, giá vốn 8.000, giá mua chưa thuế 8.000; tồn đầu 1.000 cái nhập trước khi khởi tạo kế toán; "Khách công nợ", "Nhà cung cấp công nợ". Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_111 | CHUC_NANG_69, CHUC_NANG_70 | Khởi tạo theo chế độ của công ty nạp đủ tài khoản (Thông tư 99/2025: 184), tạo bút toán cho chứng từ đã ghi sổ; thêm tài khoản chi tiết đúng quy tắc số hiệu, nhận định khoản của tài khoản cha; tài khoản hệ thống không ngừng dùng; đổi chế độ khi đã có bút toán, khởi tạo lần hai bị từ chối; người không có quyền không khởi tạo được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_112 | CHUC_NANG_70, CHUC_NANG_71 | Phiếu xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, nhập xuất khác, điều chỉnh, phiếu thu chi sinh bút toán cân, đúng tài khoản, đúng số tiền, gắn đối tác; đổi định khoản áp dụng cho chứng từ sau, bút toán cũ giữ nguyên | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_113 | CHUC_NANG_72 | Phiếu kế toán lệch Nợ Có, ghi cả hai bên, số lẻ hơn đơn vị tiền tệ bị từ chối; chưa có chính sách thì ghi sổ ngay, cấp số; có chính sách thì chờ duyệt, duyệt xong ghi sổ; đã ghi sổ không sửa; người không có quyền không lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_114 | CHUC_NANG_71, CHUC_NANG_73 | Khóa sổ tạo bút toán kết chuyển đúng (loại 5 đến 8 sang 911, kết quả sang 4212); chứng từ có ngày trong kỳ khóa bị từ chối; tháng chưa kết thúc không khóa được; người không có quyền không khóa được; mở lại tháng gần nhất xóa kết chuyển | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_115 | CHUC_NANG_73 | Bảng cân đối số phát sinh cân ở mọi cột, cộng dồn lên tài khoản cha; sổ cái đúng số dư lũy kế, tài khoản đối ứng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_116 | CHUC_NANG_69 đến CHUC_NANG_73 | Màn hình MAN_HINH_50 đến MAN_HINH_52 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 3: Báo cáo tài chính, CONG_VIEC_15)

Dữ liệu mẫu: công ty VCR chế độ Thông tư 99/2025, tiền tệ đồng Việt Nam, năm tài chính bắt đầu tháng 1; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000, giá vốn 8.000; "Khách công nợ", "Nhà cung cấp công nợ"; công ty thương mại chuyển sang Thông tư 133. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_117 | CHUC_NANG_74 | Báo cáo tình hình tài chính đúng mẫu theo chế độ, số liệu đúng cách lấy (phải thu theo đối tác, lợi nhuận năm nay gồm phần chưa kết chuyển, số đầu năm); tổng tài sản bằng tổng nguồn vốn khi kỳ chưa khóa và đã khóa sổ; người không có quyền không xem được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_118 | CHUC_NANG_75 | Báo cáo kết quả kinh doanh đúng mẫu, doanh thu, giảm trừ doanh thu, doanh thu thuần, giá vốn, lợi nhuận đúng; khớp lợi nhuận chưa phân phối tăng trong kỳ; không đổi sau khóa sổ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_119 | CHUC_NANG_74, CHUC_NANG_75 | Tài khoản chi tiết đánh dấu dài hạn vào đúng chỉ tiêu dài hạn; tài khoản của chế độ không đánh dấu được; Thông tư 133 chọn được B01a-DNN, B01b-DNN, kết quả B02-DNN | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_120 | CHUC_NANG_74, CHUC_NANG_75 | Xuất Excel, PDF đúng số liệu, đúng loại tệp; MAN_HINH_53 (và ô "Dài hạn" ở MAN_HINH_50) đạt danh sách rà soát giao diện trên máy tính và điện thoại | Gọi API, trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 4: Hóa đơn điện tử, CONG_VIEC_16)

Dữ liệu mẫu: công ty VCR, tiền tệ đồng Việt Nam; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000; "Hàng hóa đơn B" thuế 10%, giá bán gồm thuế 12.000; khách "Khách công nợ" có mã số thuế; đơn không có khách; nhà cung cấp là bộ giả lập và máy chủ giả MISA meInvoice. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_121 | CHUC_NANG_76 | Cài đặt theo công ty: bật cần đủ thông tin, mật khẩu mã hóa không hiện lại (chỉ 4 ký tự cuối), ký hiệu đúng định dạng theo năm; chỉ người có quyền cài đặt sửa được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_122 | CHUC_NANG_77 | Phiếu xuất giao hàng ghi sổ lập đúng một hóa đơn, nội dung đúng (người bán, người mua kể cả đơn không có khách, dòng, thuế suất, đơn giá làm tròn, tổng theo thuế suất); tổng thanh toán bằng tiền công nợ của phiếu | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_123 | CHUC_NANG_77 | Gửi nền nhận số liên tục, mã của cơ quan thuế, PDF; lỗi tạm thời tự gửi lại không lập trùng; không biết kết quả thì tra trước khi gửi lại; lỗi dữ liệu dừng chờ kế toán gửi lại; thiếu ký hiệu thì lỗi cài đặt; quá hạn báo kế toán | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_124 | CHUC_NANG_78 | Trả hàng: điều chỉnh giảm đúng số âm, tham chiếu hóa đơn gốc; ghi được hóa đơn trả hàng của người mua có mã số thuế; hóa đơn gốc chưa phát hành thì chờ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_125 | CHUC_NANG_79 | Thay thế đúng điều kiện (không thay hóa đơn đã điều chỉnh, đã bị thay thế), tham chiếu hóa đơn bị thay thế; trả hàng sau đó tham chiếu hóa đơn thay thế | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_126 | CHUC_NANG_76, CHUC_NANG_77 | Lớp kết nối MISA meInvoice gửi đúng định dạng, xử lý phản hồi, lỗi trên máy chủ giả; MAN_HINH_54, MAN_HINH_55 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Gọi API, trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 5: Hoa hồng đội kinh doanh, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): kiểm thử `c17-commissions` đã xóa. Mã đã cấp không dùng lại.

Dữ liệu mẫu: công ty VCR, tiền tệ đồng Việt Nam; ngành hàng "HHT"; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000; "Hàng hoa hồng B" thuế 10%, giá bán gồm thuế 12.000; kênh "Bán lẻ"; khách "Khách công nợ", "Khách có người phụ trách"; đơn không có khách. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_127 | CHUC_NANG_80 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_274. Nội dung cũ: Cài đặt, bảng mức, hệ số kênh, bậc, chỉ tiêu đúng kiểm tra; chỉ người có quyền cài đặt sửa được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_128 | CHUC_NANG_81 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_274. Nội dung cũ: Đơn gán đúng nhân viên theo cách gán, giữ khi gửi lại; đổi cài đặt không đổi đơn đã gán | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_129 | CHUC_NANG_82 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_274. Nội dung cũ: Phát sinh đúng khi thu tiền (chia theo phần còn phải thu của từng dòng đơn, tiền chưa thuế, mức theo ngành hàng, kênh, hai cách kết hợp), thu trước giao sau, hoàn tiền ghi âm, bán lẻ khi giao, trả hàng chưa thu không phát sinh | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_130 | CHUC_NANG_83 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_274. Nội dung cũ: Bảng tháng đúng cơ sở, phần trăm đạt, hệ số, tổng; lần lượt theo tháng; phát sinh muộn vào kỳ sau; bỏ bảng nháp, bị từ chối lập lại được; duyệt, ghi sổ, bút toán đúng (kể cả tổng âm) | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_131 | CHUC_NANG_80, CHUC_NANG_82, CHUC_NANG_83 | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); không còn kiểm; thay bằng TIEUCHI_NGHIEMTHU_274. Nội dung cũ: MAN_HINH_56, MAN_HINH_57 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_06 Tài chính – Kế toán (phần 6: Đối soát ngân hàng, CONG_VIEC_18)

Dữ liệu mẫu: công ty VCR, tiền tệ đồng Việt Nam; quỹ ngân hàng "Vietcombank" (số tài khoản 0071 000 123 456), "ACB"; khách "Khách ngân hàng", "Khách thứ hai"; nhà cung cấp "Nhà cung cấp ngân hàng"; webhook theo định dạng SePay. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_132 | CHUC_NANG_84, CHUC_NANG_85 | Chỉ người có quyền cài đặt tạo, sửa kết nối; khóa sinh tự động, hiện đủ một lần, lưu mã hóa; đổi khóa thì khóa cũ hết hiệu lực; quỹ ngừng dùng không tạo được kết nối; webhook sai khóa, kết nối không có hoặc đang tắt bị từ chối (401) | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_133 | CHUC_NANG_85 | Giao dịch nhận đúng ngày giờ Việt Nam, chiều, số tiền, nội dung, lưu dữ liệu gốc; trùng mã chỉ lưu một lần và vẫn trả thành công; dữ liệu sai bị từ chối (400); số tài khoản khác quỹ bị từ chối (409) | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_134 | CHUC_NANG_84, CHUC_NANG_85 | Tự ghép đúng QUYTAC_NGHIEPVU_115: cùng quỹ, cùng chiều, cùng số tiền, lệch tối đa 3 ngày, duy nhất ở cả hai phía; phiếu ghi sổ sau giao dịch cũng được ghép; bộ giả lập đi đúng luồng này | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_135 | CHUC_NANG_86 | Gợi ý khách đúng thứ tự số đơn bán, mã khách, mã số thuế; nhiều khách hoặc tiền ra thì không gợi ý; kế toán xác nhận thì lập phiếu thu khách hàng của quỹ, ngày giao dịch, ghi chú nội dung, theo luồng duyệt phiếu thu, ghép khi phiếu ghi sổ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_136 | CHUC_NANG_86 | Ghép tay chỉ với phiếu đủ điều kiện; một phiếu ghép tối đa một giao dịch; bỏ qua cần lý do; bỏ ghép đưa về chưa ghép, không đổi phiếu; mỗi thao tác có nhật ký; người không có quyền bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_137 | CHUC_NANG_87 | Đối chiếu quỹ theo khoảng ngày: số dư sổ đến ngày cuối, số dư ngân hàng gần nhất (khi dịch vụ gửi), chênh lệch, số giao dịch chưa ghép hai chiều, số bỏ qua, danh sách phiếu chưa có giao dịch | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_138 | CHUC_NANG_84 đến CHUC_NANG_87 | MAN_HINH_58, MAN_HINH_59 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Trình duyệt | Mong muốn |

## MODULE_06 Tài chính – Kế toán (phần 7: Đối soát thu hộ COD, cổng thanh toán, CONG_VIEC_19)

Dữ liệu mẫu: công ty VCR, tiền tệ đồng Việt Nam; đơn vị thu hộ "Giao hàng nhanh thử" (thu COD); khách "Khách công nợ"; hàng thuế 10%, giá gồm thuế 11.000; đơn bán đã giao 10 cái (110.000), 5 cái (55.000), đơn bán lẻ không có khách; tệp Excel theo mẫu chung. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_139 | CHUC_NANG_88 | Chỉ người có quyền khai đơn vị thu hộ; đối tác phải có hồ sơ khách hàng; không khai trùng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_140 | CHUC_NANG_89, CHUC_NANG_91 | Nhập tệp theo mẫu chung: sai mẫu, sai ô bị từ chối kèm dòng, cột; ghép đơn theo số; lỗi chặn, cảnh báo chênh lệch, tổng đúng; bỏ dòng, nhập lại, trùng số bảng, bỏ bảng nháp | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_141 | CHUC_NANG_90 | Còn dòng lỗi không gửi được; ghi sổ trừ nợ khách theo đơn, thừa thành trả trước, đơn không có khách chỉ có bút toán; nợ đơn vị thu hộ bằng thực nhận (âm thì giảm nợ); bút toán đúng tài khoản; bảng đã ghi sổ không sửa | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_142 | CHUC_NANG_90 | Khoản trừ nợ của bảng đối soát tính hoa hồng như phiếu thu | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_143 | CHUC_NANG_90 | Có chính sách duyệt thì chờ duyệt, người gửi rút, gửi lại giữ số, duyệt xong ghi sổ; tiền đơn vị chuyển về lập phiếu thu trừ nợ đơn vị thu hộ, hạch toán 1388 | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_144 | CHUC_NANG_88 đến CHUC_NANG_91 | MAN_HINH_60, MAN_HINH_61 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Trình duyệt | Mong muốn |

## MODULE_06 Tài chính – Kế toán (phần 8: Báo cáo tài chính hợp nhất, CONG_VIEC_20)

Dữ liệu mẫu: tập đoàn VComm (công ty gốc chưa khởi tạo kế toán), công ty con VCR (Thông tư 99/2025) và VCT (Thông tư 133), tiền tệ đồng Việt Nam; VCR bán cho VCT 24 cái bánh (giá vốn 6.000, giá bán chưa thuế 10.000 mỗi cái) là 2 hộp bên VCT; VCT trả VCR 100.000, VCR chưa ghi nhận. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_145 | CHUC_NANG_92 | Chỉ người có quyền ở phạm vi tập đoàn xem, lập; thành viên đúng; công ty khác đồng tiền, chưa khởi tạo kế toán bị loại kèm lý do | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_146 | CHUC_NANG_93, CHUC_NANG_95 | Cộng gộp B01-DN, B02-DN theo mã Thông tư 99, công ty Thông tư 133 ghép mã; tổng tài sản bằng tổng nguồn vốn; báo cáo từng công ty không đổi | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_147 | CHUC_NANG_93 | Loại trừ công nợ nội bộ, trả trước nội bộ phần nhỏ hơn, cảnh báo chênh lệch; số dư ngược chiều của các công ty không bù trừ khi cộng gộp; loại trừ doanh thu thuần, giá vốn bán nội bộ; lãi chưa thực hiện ước tính đúng theo đơn vị bên mua; báo cáo hợp nhất cân | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_148 | CHUC_NANG_94 | Sửa lãi chưa thực hiện cần lý do, giữ khi tính lại; điều chỉnh tay phải cân, đúng mã tài khoản, tài khoản lấy số dư theo đối tác phải chọn đối tác; xóa điều chỉnh tay | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_149 | CHUC_NANG_95 | Gửi theo chính sách duyệt của công ty gốc (không có thì chốt ngay); rút, gửi lại giữ số; đã chốt giữ nguyên số, không sửa; xuất Excel, PDF | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_150 | CHUC_NANG_92 đến CHUC_NANG_95 | MAN_HINH_62, MAN_HINH_63 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Trình duyệt | Mong muốn |

## MODULE_09 Sàn thương mại điện tử (phần lõi 1: Tài khoản người mua, CONG_VIEC_23)

Dữ liệu mẫu: công ty vận hành sàn VCR, phòng ban "Kinh doanh sàn"; người mua 0911000001, 0911000002, 0911000003 tự đăng ký.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_163 | CHUC_NANG_104 | Đăng ký bằng số điện thoại và OTP: đúng giới hạn OTP, mã đăng ký không dùng để đăng nhập, số đã có tài khoản bị từ chối, mã giới thiệu đúng QUYTAC_NGHIEPVU_142, đăng ký xong có phiên ứng dụng 90 ngày | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_164 | CHUC_NANG_105 | Đăng nhập bằng mật khẩu, bằng OTP; quên mật khẩu thu hồi phiên cũ; làm mới đồng thời cùng một token thì thu hồi chuỗi; các đường dẫn đăng nhập dùng chung bộ đếm số lần gọi; ứng dụng về màn hình đăng nhập khi phiên bị từ chối, giữ phiên khi mất mạng hoặc máy chủ bận | Gọi API; ứng dụng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_165 | CHUC_NANG_106, CHUC_NANG_107 | Người tôi giới thiệu che số điện thoại; nhập mã sau đăng ký chỉ một lần, không tự giới thiệu, không chọn người mình đã giới thiệu; quản trị đổi người giới thiệu bắt buộc lý do, kiểm phiên bản, có lịch sử; chưa chọn công ty vận hành sàn thì chưa quản trị được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_166 | CHUC_NANG_108 | Đánh dấu, bỏ đánh dấu cấp, gỡ đúng phòng ban, thành viên công ty, không cấp vai trò Nhân viên bán hàng (THAY_DOI_15); khách tôi phụ trách đúng QUYTAC_NGHIEPVU_145; không đổi công ty vận hành sàn khi còn nhân viên được đánh dấu; người mua không vào được mini app quản trị | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_167 | CHUC_NANG_104 đến CHUC_NANG_106, CHUC_NANG_108 | Ứng dụng: đường dẫn giới thiệu, đăng ký, đăng nhập (mật khẩu, OTP), quên mật khẩu, tài khoản, chia sẻ, người tôi giới thiệu, phần Kinh doanh chạy được trên bản xem trước web khổ điện thoại, không lỗi trình duyệt | Trình duyệt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_168 | CHUC_NANG_107, CHUC_NANG_108 | MAN_HINH_79, MAN_HINH_80 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Trình duyệt | Mong muốn |

## MODULE_09 Sàn thương mại điện tử (phần lõi 1b: Đội kinh doanh nhiều cấp, CONG_VIEC_27)

Dữ liệu mẫu: công ty vận hành sàn VCR; Khối Kinh doanh, Vùng Miền Nam (dưới Khối), Phòng Kinh doanh 1 (dưới Vùng), Phòng Kinh doanh Trực tiếp (dưới Khối); người mua 0922000001 đến 0922000005.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_169 | CHUC_NANG_109 | Gắn loại đơn vị đúng thứ bậc; chức danh suy ra đúng; chuỗi cấp trên đúng kể cả khi thiếu cấp | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_170 | CHUC_NANG_110 | Quản trị đánh dấu vào đơn vị kinh doanh, chuyển đơn vị, bổ nhiệm, bỏ quản lý, bỏ đánh dấu; lịch sử | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_171 | CHUC_NANG_111 | Người quản lý xem đúng nhánh, khách của cấp dưới; không xem được ngoài nhánh; nhân viên không xem đội | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_172 | CHUC_NANG_112 | Đề xuất đúng phạm vi nhánh; một đề xuất chờ mỗi người; rút; duyệt áp dụng, kiểm lại; từ chối; thông báo | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_173 | CHUC_NANG_111, CHUC_NANG_112 | Ứng dụng: chức danh, đội của tôi, khách của cấp dưới, đề xuất chạy được trên bản xem trước web khổ điện thoại | Trình duyệt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_174 | CHUC_NANG_110, CHUC_NANG_112 | MAN_HINH_81, MAN_HINH_82 hiển thị đúng trên máy tính và điện thoại | Trình duyệt | Mong muốn |

## MODULE_09 Sàn thương mại điện tử (phần lõi 2: Đặt hàng trên VComm, CONG_VIEC_24)

Dữ liệu mẫu: công ty vận hành sàn VCR; kênh bán VComm; kho xuất không quản lý vị trí; kem dưỡng 250.000 (bảng giá kênh gồm thuế), xà phòng 40.000 chưa thuế (bảng giá chung, gồm thuế 44.000), sản phẩm chưa có giá, điện thoại quản lý serial; phí giao hàng 30.000, miễn phí từ 500.000; GHN giả lập.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_175 | CHUC_NANG_113 | Cài đặt bán hàng, đăng bán; chỉ sản phẩm đủ điều kiện hiện trên ứng dụng với giá gồm thuế, số có thể bán đúng; người mua thử | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_176 | CHUC_NANG_114 | Danh mục đủ 34 tỉnh; sổ địa chỉ tối đa 10, xã thuộc tỉnh, một mặc định | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_177 | CHUC_NANG_115, CHUC_NANG_116 | Giỏ hàng đúng giới hạn; đặt hàng tính đúng giá, phí giao hàng, miễn phí từ mức; lập đơn bán, giữ hàng không thời hạn; thiếu hàng, giá đổi, chưa là người mua thử, quá 20 lần mỗi ngày bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_178 | CHUC_NANG_116 | Hủy đơn đúng trạng thái, nhả hàng giữ, hủy vận đơn; người mua chỉ thấy đơn của mình | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_179 | CHUC_NANG_117 | Giao cho GHN (giả lập) tạo vận đơn đúng thông tin; webhook sai khóa bị từ chối; lấy hàng ghi sổ phiếu xuất; giao thành công; hoàn hàng nhập lại kho, đơn hủy; nhận trùng không đổi kết quả | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_180 | CHUC_NANG_118 | Trả hàng trong 7 ngày, số lượng không vượt, một yêu cầu đang xử lý; duyệt, từ chối, rút, nhận hàng trả, không nhận được hàng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_181 | CHUC_NANG_119 | Tự hoàn tất đúng thời điểm, chờ yêu cầu trả hàng xong; giá trị hoàn tất trừ phần trả đã nhận | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_182 | CHUC_NANG_114 đến CHUC_NANG_118 | Ứng dụng: cửa hàng, chi tiết, giỏ, đặt hàng, sổ địa chỉ, đơn của tôi, trả hàng chạy được trên bản xem trước web khổ điện thoại | Trình duyệt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_183 | CHUC_NANG_113, CHUC_NANG_116 đến CHUC_NANG_118 | MAN_HINH_86 đến MAN_HINH_89 hiển thị đúng trên máy tính và điện thoại | Trình duyệt | Mong muốn |

## MODULE_09 Sàn thương mại điện tử (phần lõi 3: Thanh toán đơn người mua, CONG_VIEC_25)

Dữ liệu mẫu: dữ liệu mẫu của CONG_VIEC_24; VNPAY giả lập (mã website, khóa bí mật thử nghiệm trong biến môi trường kiểm thử); đồng hồ kiểm thử; GHN giả lập có ngày thu tiền người mua; công ty vận hành sàn đã khởi tạo kế toán (Thông tư 99 và Thông tư 133).

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_184 | CHUC_NANG_120 | Bật tắt phương thức theo cổng (cổng chưa có kết nối không bật được); mở đặt hàng chỉ khi có phương thức bật, không tắt được phương thức cuối khi đang mở; người mua chỉ chọn phương thức đang bật | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_185 | CHUC_NANG_121 | Thanh toán VNPAY (giả lập): đường dẫn ký đúng; IPN sai chữ ký, sai số tiền bị từ chối; thành công ghi đã thu một lần, đơn Chờ giao; nhận trùng không đổi kết quả | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_186 | CHUC_NANG_121 | Chờ thanh toán 15 phút: quá hạn tự hủy, nhả hàng; trả sau khi hủy lập việc hoàn | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_187 | CHUC_NANG_122 | Hoàn tiền: hủy đơn đã thu, nhận hàng trả lập việc hoàn đúng số tiền; người mua nhập tài khoản; kế toán ghi đã hoàn; phân quyền | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_188 | CHUC_NANG_123 | Bút toán tiền thu, phí giao hàng, hoàn tiền đúng tài khoản; hóa đơn có dòng phí giao hàng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_189 | CHUC_NANG_120 đến CHUC_NANG_122 | Ứng dụng: chọn phương thức, thanh toán, thanh toán lại, tài khoản nhận hoàn tiền chạy được trên bản xem trước web khổ điện thoại; web hiện thanh toán, hoàn tiền | Trình duyệt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_190 | CHUC_NANG_124 | Đơn COD tự ghi đã thu khi GHN báo đã thu tiền người mua (webhook, tra lại vận đơn), ghi một lần; ghi tay "Đã thu COD" có phân quyền | Gọi API | Bắt buộc |

## MODULE_09 Sàn thương mại điện tử (phần lõi 4: Hoa hồng theo đơn và ví hoa hồng, CONG_VIEC_26)

Dữ liệu mẫu: dữ liệu mẫu của CONG_VIEC_24, CONG_VIEC_25, CONG_VIEC_27 (đội kinh doanh đủ bốn chức danh và đội thiếu chức danh); người mua có người giới thiệu thường, người giới thiệu là nhân viên kinh doanh, không có người giới thiệu; sản phẩm thiết lập phần trăm, số tiền cố định, chưa thiết lập; đồng hồ kiểm thử; công ty vận hành sàn đã khởi tạo kế toán.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_216 | CHUC_NANG_134 | Thiết lập hoa hồng sản phẩm đúng ràng buộc (tổng phần trăm, tổng số tiền cố định so giá bán), theo phiên bản; sản phẩm chưa thiết lập không có hoa hồng; sửa chỉ áp dụng đơn sau; cài đặt chung mặc định và sửa; phân quyền | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_217 | CHUC_NANG_135 | Chốt người hưởng đúng: giới thiệu, đội theo chức danh, thiếu chức danh, người quản lý tự phụ trách, người giới thiệu không phải nhân viên | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_218 | CHUC_NANG_135, CHUC_NANG_136 | Hoàn tất cộng ví đúng số tiền (phần trăm, cố định, trừ hàng trả), một giao dịch mỗi người mỗi đơn; đơn hủy không có hoa hồng; ví, đang chờ, hoa hồng cấp dưới đúng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_219 | CHUC_NANG_137 | Rút tiền: tối thiểu, số dư, tài khoản nhận, một yêu cầu đang chờ, giữ tiền, rút lại và từ chối cộng lại; thuế trên ngưỡng (cộng dồn số đã duyệt trong tháng, THAY_DOI_19) chốt khi duyệt; ghi đã chi; bảng kê; phân quyền | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_220 | CHUC_NANG_138 | Bút toán hoa hồng (Nợ chi phí hoa hồng / Có 3388), chi trả (Nợ 3388 / Có ngân hàng số thực nhận / Có 3335 số thuế) đúng tài khoản | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_221 | CHUC_NANG_134 đến CHUC_NANG_137 | Web (thiết lập hoa hồng, cài đặt chung, hoa hồng của đơn, rút tiền hoa hồng) và ứng dụng (ví, rút tiền, hoa hồng cấp dưới) chạy được trên máy tính và khổ điện thoại | Trình duyệt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_222 | CHUC_NANG_134, CHUC_NANG_137, CHUC_NANG_138 | Phí rút tiền (THAY_DOI_17): bảng theo lần rút trong tháng và bảng theo số tiền cộng dồn, bảng trống không thu; đếm lần rút không tính yêu cầu bị từ chối, đã rút lại; phí dự kiến khi gửi, chốt khi duyệt; thực nhận = số tiền − thuế − phí; thuế cộng phí vượt số tiền thì từ chối; bút toán Có 711 số phí | Gọi API | Bắt buộc |

## Sửa theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

Dữ liệu mẫu: công ty con VCR, VTH (giao dịch nội bộ); sản phẩm hàng hóa và sản phẩm dịch vụ có giá bán, giá kênh Nội bộ; Nhân viên bán hàng, Kế toán, Kế toán trưởng; người mua VComm thử. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_274 | CHUC_NANG_158 | Không còn API, màn hình, quyền hoa hồng cũ; khởi tạo kế toán, đơn bán, công nợ chạy đúng khi không có hoa hồng cũ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_275 | CHUC_NANG_158 | Không lập được phiếu giao khách, nhận khách; nhân viên bán hàng xem mọi đối tác, đơn bán; Nhân viên bán hàng không lập đơn bán, Kế toán lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_276 | CHUC_NANG_157, CHUC_NANG_158 | Đơn bán tay có hàng hóa bị từ chối; đơn chỉ dịch vụ xác nhận là đã giao, có hóa đơn, công nợ; đơn VComm hàng hóa vẫn chạy | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_277 | CHUC_NANG_157 | Giao dịch nội bộ chỉ dịch vụ: hàng hóa bị từ chối; đơn dịch vụ sinh đơn mua đối ứng, xác nhận là đã nhận, không phiếu kho ghi thẻ kho | Gọi API | Bắt buộc |

## MODULE_08 Nhân sự (phần 1, CONG_VIEC_46)

Dữ liệu mẫu: công ty VCR, phòng ban có trưởng phòng; tài khoản Quản lý nhân sự, Nhân viên nhân sự, người chỉ xem hồ sơ, nhân viên có hồ sơ liên kết; người lao động thử (công dân Việt Nam, người nước ngoài, lao động chưa thành niên). Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_287 | CHUC_NANG_162 | Lập, sửa hồ sơ: mã tự cấp hoặc nhập tay không trùng; trường bắt buộc, định dạng căn cước, trùng căn cước bị chặn; dưới 15 tuổi bị chặn; liên kết tài khoản đúng QUYTAC_NGHIEPVU_293 | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_288 | CHUC_NANG_162 | Dữ liệu nhạy cảm lưu mã hóa; API trả dạng che khi không có `hr.identity.view`; hiện, tải tệp ghi nhật ký; công ty khác nhận `404`; người không có quyền nhận `403` | Gọi API, truy vấn cơ sở dữ liệu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_289 | CHUC_NANG_162 | Vị trí hiện tại đúng; quyết định đến ngày hiệu lực cập nhật thành viên công ty đúng một lần; không sửa quyết định đã hiệu lực | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_290 | CHUC_NANG_163 | Kiểm loại, 36 tháng, thử việc (số ngày, 85%), chồng thời gian, giới hạn ký xác định thời hạn và ngoại lệ, giấy phép lao động, đồng ý của người đại diện; qua luồng duyệt; ký cần tệp; đã ký không sửa | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_291 | CHUC_NANG_163 | Phụ lục chỉ cho hợp đồng đã ký còn hiệu lực; không có thời hạn; giá trị hiện hành đúng theo ngày; ký phụ lục đổi vị trí tạo quyết định công tác | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_292 | CHUC_NANG_164 | Nhắc đúng mốc, mỗi mốc một lần, đúng người nhận; hợp đồng có hợp đồng tiếp theo hoặc đã chấm dứt không nhắc; danh sách sắp hết hạn, nhãn quá 30 ngày đúng | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_293 | CHUC_NANG_162, CHUC_NANG_163 | Nghỉ việc chấm dứt hợp đồng, hủy hợp đồng chưa ký; hồ sơ đã nghỉ chỉ người có `hr.employee.manage` thấy; nhân viên xem đúng hồ sơ, hợp đồng của mình | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_294 | CHUC_NANG_162 đến CHUC_NANG_164 | MAN_HINH_114 đến MAN_HINH_119 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## MODULE_08 Nhân sự (phần 2, CONG_VIEC_47)

Dữ liệu mẫu: công ty VCR và VCT (cách ly); phòng ban có trưởng phòng; tài khoản nhân sự, người không quyền, người lao động có hồ sơ liên kết, lao động chưa thành niên, người không có tài khoản; ca hành chính, ca nửa ngày thứ bảy. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_295 | CHUC_NANG_165 | Ca, lịch tuần, xếp ca, ngày lễ: giới hạn 8/10 giờ ca, 48 giờ tuần (40 giờ chưa thành niên), thứ tự lấy ca dự kiến đúng; ngày lễ chung và riêng, ngày lễ người nước ngoài đúng đối tượng; không sửa ngày thuộc kỳ đã chốt | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_296 | CHUC_NANG_165 | Lượt chấm thủ công, nhập tệp (xem trước lỗi, bỏ trùng, kỳ đã chốt bị chặn); công ngày tính đúng giờ thực tế, ân hạn, muộn, sớm, thiếu lượt, vắng, giờ đêm, ca qua ngày; đơn giải trình qua luồng duyệt cập nhật công | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_297 | CHUC_NANG_165 | Chấm công ứng dụng: nhận khi đạt GPS hoặc IP hoặc mã QR còn hạn của địa điểm được phép, từ chối khi không đạt, mã QR quá hạn, giả mã; chỉ chấm cho chính mình; công ty khác nhận `404` | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_298 | CHUC_NANG_166 | Phép năm: số ngày theo chế độ, thâm niên, cộng dần mỗi tháng một lần, trừ tháng dưới 50%, phép tồn hết hạn đúng cài đặt, nghỉ trừ năm cũ trước, thanh toán khi nghỉ việc | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_299 | CHUC_NANG_166 | Đơn nghỉ: số ngày theo lịch (nửa ngày, ca nửa công, bỏ ngày lễ, nghỉ tuần), chặn trùng, vượt số dư, vượt số ngày theo luật; qua luồng duyệt; nhân sự ghi nhận có hiệu lực ngay; hủy hoàn số dư và tính lại công | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_300 | CHUC_NANG_167 | Tăng ca: cần đồng ý, qua luồng duyệt; chặn vượt 50% giờ ngày, 12 giờ ngày nghỉ, 40 giờ tháng, 200 hoặc 300 giờ năm, chưa thành niên; loại ngày và giờ đêm đúng; giờ được tính theo thời gian có mặt | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_301 | CHUC_NANG_167 | Bảng công tháng: dòng tổng hợp khớp công ngày; xác nhận, giải trình, tự xác nhận khi hết hạn; chốt đóng băng và chặn sửa dữ liệu tháng; mở lại bị chặn khi lương đã chốt; người lao động chỉ thấy dòng của mình; quyền, cách ly công ty đúng | Gọi API, việc nền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_302 | CHUC_NANG_165 đến CHUC_NANG_167 | MAN_HINH_120 đến MAN_HINH_125 đạt danh sách rà soát giao diện trên máy tính và điện thoại (MAN_HINH_122 ưu tiên điện thoại) | Trình duyệt | Bắt buộc |
