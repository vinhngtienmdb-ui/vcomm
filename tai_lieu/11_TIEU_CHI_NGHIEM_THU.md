# 11. TIÊU CHÍ NGHIỆM THU

- Mô tả: Tiêu chí nghiệm thu cho từng chức năng, đánh dấu Bắt buộc hoặc Mong muốn.
- Phiên bản: 2.5
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm TIEUCHI_NGHIEMTHU_56 đến TIEUCHI_NGHIEMTHU_64 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_65 đến TIEUCHI_NGHIEMTHU_74 của MODULE_03; CONG_VIEC_06 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_75 đến TIEUCHI_NGHIEMTHU_79 của MODULE_07; CONG_VIEC_07 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_80 đến TIEUCHI_NGHIEMTHU_86 của MODULE_04; CONG_VIEC_08 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_87 đến TIEUCHI_NGHIEMTHU_92 của MODULE_05; CONG_VIEC_09 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_93 đến TIEUCHI_NGHIEMTHU_98 của MODULE_05 (giao dịch nội bộ); CONG_VIEC_12 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_99 đến TIEUCHI_NGHIEMTHU_104 của MODULE_05 (khuyến mãi); CONG_VIEC_13 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_105 đến TIEUCHI_NGHIEMTHU_110 của MODULE_06 (công nợ); CONG_VIEC_14 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_111 đến TIEUCHI_NGHIEMTHU_116 của MODULE_06 (kế toán tổng hợp); CONG_VIEC_15 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_117 đến TIEUCHI_NGHIEMTHU_120 của MODULE_06 (báo cáo tài chính); CONG_VIEC_16 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_121 đến TIEUCHI_NGHIEMTHU_126 của MODULE_06 (hóa đơn điện tử); CONG_VIEC_17 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_127 đến TIEUCHI_NGHIEMTHU_131 của MODULE_06 (hoa hồng đội kinh doanh); CONG_VIEC_18 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_132 đến TIEUCHI_NGHIEMTHU_138 của MODULE_06 (đối soát ngân hàng)

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

Dữ liệu mẫu: công ty VCR, tiền tệ đồng Việt Nam; ngành hàng "HHT"; "Hàng công nợ A" thuế 10%, giá bán gồm thuế 11.000; "Hàng hoa hồng B" thuế 10%, giá bán gồm thuế 12.000; kênh "Bán lẻ"; khách "Khách công nợ", "Khách có người phụ trách"; đơn không có khách. Không dùng dữ liệu thật.

| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_127 | CHUC_NANG_80 | Cài đặt, bảng mức, hệ số kênh, bậc, chỉ tiêu đúng kiểm tra; chỉ người có quyền cài đặt sửa được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_128 | CHUC_NANG_81 | Đơn gán đúng nhân viên theo cách gán, giữ khi gửi lại; đổi cài đặt không đổi đơn đã gán | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_129 | CHUC_NANG_82 | Phát sinh đúng khi thu tiền (chia theo phần còn phải thu của từng dòng đơn, tiền chưa thuế, mức theo ngành hàng, kênh, hai cách kết hợp), thu trước giao sau, hoàn tiền ghi âm, bán lẻ khi giao, trả hàng chưa thu không phát sinh | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_130 | CHUC_NANG_83 | Bảng tháng đúng cơ sở, phần trăm đạt, hệ số, tổng; lần lượt theo tháng; phát sinh muộn vào kỳ sau; bỏ bảng nháp, bị từ chối lập lại được; duyệt, ghi sổ, bút toán đúng (kể cả tổng âm) | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_131 | CHUC_NANG_80, CHUC_NANG_82, CHUC_NANG_83 | MAN_HINH_56, MAN_HINH_57 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

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
