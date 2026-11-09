# 11. TIÊU CHÍ NGHIỆM THU

- Mô tả: Tiêu chí nghiệm thu cho từng chức năng, đánh dấu Bắt buộc hoặc Mong muốn.
- Phiên bản: 1.4
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): thêm TIEUCHI_NGHIEMTHU_56 đến TIEUCHI_NGHIEMTHU_64 của MODULE_02; CONG_VIEC_05 (2026-11-10): thêm TIEUCHI_NGHIEMTHU_65 đến TIEUCHI_NGHIEMTHU_74 của MODULE_03

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
