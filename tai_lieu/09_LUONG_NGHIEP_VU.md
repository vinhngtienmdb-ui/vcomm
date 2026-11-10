# 09. LUỒNG NGHIỆP VỤ

- Mô tả: Quy trình chính, phụ, ngoại lệ; điều kiện bắt đầu, kết thúc; trạng thái và chuyển trạng thái.
- Phiên bản: 1.7
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_08 (2026-11-10): thêm luồng của MODULE_05 Bán hàng phần 1 (Luồng 9 đến Luồng 11); CONG_VIEC_09 (2026-11-10): thêm luồng giao dịch nội bộ của MODULE_05 phần 2 (Luồng 12 đến Luồng 15), trạng thái đơn bán, đơn mua đối ứng; CONG_VIEC_12 (2026-11-10): thêm luồng khuyến mãi của MODULE_05 phần 3 (Luồng 16, Luồng 17), trạng thái chương trình khuyến mãi; CONG_VIEC_13 (2026-11-10): thêm luồng công nợ của MODULE_06 phần 1 (Luồng 18 đến Luồng 21), trạng thái phiếu thu, phiếu chi; Luồng 9 bước 4 kiểm hạn mức theo dư nợ thật (QUYTAC_NGHIEPVU_92, THAY_DOI_09); Luồng 15 ghi tổn thất giảm phải thu; CONG_VIEC_14 (2026-11-10): thêm luồng kế toán tổng hợp của MODULE_06 phần 2 (Luồng 22 đến Luồng 25), trạng thái phiếu kế toán, trạng thái kỳ kế toán; CONG_VIEC_15 (2026-11-10): thêm luồng báo cáo tài chính của MODULE_06 phần 3 (Luồng 26); CONG_VIEC_16 (2026-11-10): thêm luồng hóa đơn điện tử của MODULE_06 phần 4 (Luồng 27, Luồng 28), trạng thái hóa đơn điện tử, trạng thái việc chờ xử lý hóa đơn trả hàng

## MODULE_01 Nền tảng

### Luồng 1. Mời và kích hoạt nhân viên

- Bắt đầu: quản trị công ty nhập thông tin nhân viên (hoặc nhập tệp Excel).
- Các bước:
  1. Quản trị nhập họ tên, ít nhất một trong email, số điện thoại, tên đăng nhập; chọn chi nhánh, phòng ban mặc định; chọn vai trò.
  2. Hệ thống tạo tài khoản trạng thái "Đã mời", gửi đường dẫn kích hoạt qua email hoặc SMS.
  3. Nhân viên mở đường dẫn, đặt mật khẩu (hoặc liên kết Google, Microsoft).
  4. Tài khoản chuyển sang "Đang hoạt động".
- Ngoại lệ: đường dẫn hết hạn (QUYTAC_NGHIEPVU_06) thì quản trị gửi lại; email, số điện thoại trùng (QUYTAC_NGHIEPVU_05) thì báo lỗi, không tạo; một dòng Excel lỗi thì bỏ qua dòng đó, báo danh sách dòng lỗi.
- Kết thúc: nhân viên đăng nhập được.

### Luồng 2. Đăng nhập

- Bắt đầu: nhân viên mở trang đăng nhập.
- Các bước:
  1. Chọn cách đăng nhập: mật khẩu, Google, Microsoft, số điện thoại.
  2. Hệ thống xác minh (QUYTAC_NGHIEPVU_07, QUYTAC_NGHIEPVU_08).
  3. Nếu bắt buộc xác thực hai lớp (QUYTAC_NGHIEPVU_09): nhập mã OTP; chưa đăng ký thì đăng ký ngay.
  4. Mở công ty mặc định, hiện trang chủ mini app (QUYTAC_NGHIEPVU_16).
- Ngoại lệ: sai mật khẩu 5 lần thì khóa 15 phút; tài khoản bị khóa hoặc vô hiệu hóa thì từ chối, không nói rõ lý do cụ thể.
- Kết thúc: có phiên làm việc.

### Luồng 3. Chuyển công ty

- Bắt đầu: nhân viên thuộc từ 2 công ty chọn công ty khác ở thanh trên cùng.
- Các bước: hệ thống nạp quyền của nhân viên ở công ty đó (QUYTAC_NGHIEPVU_13), hiện lại trang chủ.
- Kết thúc: mọi thao tác sau đó tính theo công ty mới.

### Luồng 4. Gán vai trò

- Bắt đầu: quản trị mở chi tiết nhân viên.
- Các bước:
  1. Chọn vai trò, phạm vi (tập đoàn, công ty, chi nhánh), ngày bắt đầu, ngày kết thúc nếu có.
  2. Hệ thống kiểm tra QUYTAC_NGHIEPVU_14.
  3. Vai trò có quyền nhạy cảm thì bật bắt buộc xác thực hai lớp (QUYTAC_NGHIEPVU_09).
  4. Quyền mới có hiệu lực ngay ở lần thao tác tiếp theo của nhân viên.
- Kết thúc: lần gán được ghi nhật ký.

### Luồng 5. Duyệt chứng từ

- Bắt đầu: người lập gửi duyệt một chứng từ từ mini app sở hữu.
- Các bước:
  1. Hệ thống tìm chính sách có hiệu lực (QUYTAC_NGHIEPVU_17), quy đổi giá trị nếu là ngoại tệ (QUYTAC_NGHIEPVU_19), xác định các cấp phải qua (QUYTAC_NGHIEPVU_18).
  2. Với mỗi cấp, xác định người duyệt; nếu là người lập thì dùng người thay thế (QUYTAC_NGHIEPVU_20).
  3. Tạo yêu cầu trạng thái "Chờ duyệt", báo người duyệt cấp 1.
  4. Người duyệt đồng ý thì chuyển cấp tiếp theo; hết cấp thì "Đã duyệt".
  5. Báo mini app sở hữu chứng từ (QUYTAC_NGHIEPVU_25).
- Ngoại lệ:
  - Một cấp từ chối thì "Bị từ chối" (QUYTAC_NGHIEPVU_22).
  - Người lập rút lại khi cấp 1 chưa quyết định thì "Đã rút" (QUYTAC_NGHIEPVU_23).
  - Quá thời hạn thì nhắc, rồi chuyển người thay thế (QUYTAC_NGHIEPVU_21).
  - Không có tỷ giá ngày lập thì không gửi được (QUYTAC_NGHIEPVU_19).
- Kết thúc: yêu cầu ở trạng thái "Đã duyệt", "Bị từ chối" hoặc "Đã rút".

Trạng thái yêu cầu duyệt:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Người lập gửi duyệt | Chờ duyệt |
| Chờ duyệt | Cấp cuối đồng ý | Đã duyệt |
| Chờ duyệt | Một cấp từ chối | Bị từ chối |
| Chờ duyệt | Người lập rút lại khi cấp 1 chưa quyết định | Đã rút |

### Luồng 6. Nhân viên nghỉ việc

- Bắt đầu: quản trị chọn vô hiệu hóa tài khoản.
- Các bước:
  1. Hệ thống liệt kê chứng từ đang chờ nhân viên duyệt và phòng ban nhân viên đang làm trưởng phòng.
  2. Quản trị chọn người nhận bàn giao cho từng mục (QUYTAC_NGHIEPVU_27).
  3. Hệ thống chuyển các mục, khóa tài khoản, thu hồi mọi phiên (QUYTAC_NGHIEPVU_26).
- Kết thúc: tài khoản "Đã vô hiệu hóa"; không còn việc chờ nhân viên đó.

Trạng thái tài khoản:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Quản trị mời | Đã mời |
| Đã mời | Nhân viên kích hoạt | Đang hoạt động |
| Đang hoạt động | Quản trị khóa | Bị khóa |
| Bị khóa | Quản trị mở khóa | Đang hoạt động |
| Đang hoạt động, Bị khóa | Quản trị vô hiệu hóa sau bàn giao | Đã vô hiệu hóa |

### Luồng 7. Lấy số chứng từ

- Bắt đầu: mini app lưu một chứng từ mới.
- Các bước: trong cùng giao dịch lưu chứng từ, lấy số tiếp theo của dãy (công ty, loại, kỳ); chưa có dãy cho kỳ thì tạo với số 1.
- Ngoại lệ: lưu chứng từ lỗi thì số không bị dùng (QUYTAC_NGHIEPVU_28).

### Luồng 8. Cập nhật tỷ giá

- Bắt đầu: mỗi sáng, hoặc quản lý tỷ giá nhập tay.
- Các bước: lấy tỷ giá từ nguồn, ghi theo QUYTAC_NGHIEPVU_29; lỗi nguồn thì báo quản lý tỷ giá để nhập tay.
- Kết thúc: có tỷ giá ngày hôm đó.

## MODULE_05 Bán hàng (phần 1, CONG_VIEC_08)

### Luồng 9. Lập, gửi đơn bán

- Bắt đầu: Nhân viên bán hàng (hoặc quản trị) mở "Lập đơn bán" ở mini app Bán hàng.
- Các bước:
  1. Chọn khách hàng (đối tác có hồ sơ khách hàng ở công ty) hoặc để trống, ghi tên người mua; chọn kênh bán, kho xuất, ngày đơn.
  2. Thêm mặt hàng; hệ thống tra giá theo bảng giá với kênh, nhóm khách, ngày đơn (QUYTAC_NGHIEPVU_67); nhập số lượng, chiết khấu tay nếu có; lưu nháp (dòng không có giá bị từ chối).
  3. Gửi: hệ thống cấp số (`DBH`), khóa hồ sơ khách, giữ hàng tại kho xuất theo tổng số lượng cơ sở từng mặt hàng (QUYTAC_NGHIEPVU_70); không đủ hàng khả dụng thì báo lỗi, đơn giữ nháp.
  4. Hệ thống tính ngoại lệ: chiết khấu vượt mức, dưới giá vốn, vượt hạn mức công nợ theo dư nợ (QUYTAC_NGHIEPVU_68; từ CONG_VIEC_13 theo QUYTAC_NGHIEPVU_92 thay QUYTAC_NGHIEPVU_69, THAY_DOI_09).
  5. Không có ngoại lệ, hoặc công ty chưa có chính sách duyệt `sales.order`: đơn "Đã xác nhận". Có ngoại lệ: gửi luồng duyệt (Luồng 5) với tổng gồm thuế, đơn "Chờ duyệt" kèm danh sách ngoại lệ.
  6. Duyệt xong: đơn "Đã xác nhận". Từ chối hoặc người lập rút: đơn "Bị từ chối", "Đã rút", nhả hàng giữ; sửa được, sửa xong về nháp, gửi lại tính lại ngoại lệ và giữ hàng.
- Ngoại lệ: hủy đơn nháp, bị từ chối, đã rút, đã xác nhận chưa có phiếu xuất giao hàng thì nhả hàng giữ; đơn đã có phiếu xuất chỉ đóng được (Luồng 10).
- Kết thúc: đơn "Đã xác nhận", hàng đang giữ cho đơn.

### Luồng 10. Giao hàng theo đơn bán

- Bắt đầu: Thủ kho mở "Giao hàng theo đơn bán" ở mini app Kho.
- Các bước:
  1. Chọn đơn đã xác nhận có kho xuất người dùng có quyền `inventory.sales.issue`; hệ thống hiện từng dòng số đặt, số còn phải giao.
  2. Nhập số giao lần này cho dòng có hàng, chọn lô (gợi ý hết hạn trước), vị trí, serial; lưu nháp (kiểm sớm không vượt số còn phải giao).
  3. Gửi: khóa đơn, kiểm đơn còn đã xác nhận, tổng đã giao không vượt số đặt (QUYTAC_NGHIEPVU_71); dùng phần đang giữ của đơn; kiểm đủ hàng, lô, serial như phiếu kho; cấp số (`XBH`); ghi sổ theo giá vốn bình quân; không đi luồng duyệt.
  4. Giao đủ mọi dòng: đơn "Đã giao đủ", phần giữ còn sót đánh dấu đã dùng. Chưa đủ: giao tiếp nhiều lần.
- Ngoại lệ: người có `sales.order.manage` đóng đơn đã giao một phần kèm lý do (không còn phiếu xuất nháp): phần chưa giao hủy, nhả hàng giữ còn lại.
- Kết thúc: đơn "Đã giao đủ" hoặc "Đã đóng".

### Luồng 11. Nhận hàng trả lại

- Bắt đầu: khách trả hàng; Thủ kho mở phiếu xuất giao hàng đã ghi sổ, bấm "Nhận hàng trả lại".
- Các bước:
  1. Nhập ngày, lý do; mỗi dòng gốc nhập số trả theo đơn vị cơ sở (hàng serial chọn serial đã giao); lưu nháp.
  2. Gửi: khóa dòng phiếu xuất gốc, kiểm tổng trả không vượt số đã giao trừ số đã trả (QUYTAC_NGHIEPVU_72); cấp số (`NTL`); ghi sổ nhập lại theo giá vốn phiếu xuất gốc, lô, vị trí của dòng gốc.
- Kết thúc: hàng vào lại tồn; số đã trả hiện ở dòng đơn bán; trạng thái đơn không đổi.

Trạng thái đơn bán:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Lập đơn | Nháp |
| Nháp | Gửi, không có ngoại lệ hoặc chưa có chính sách duyệt | Đã xác nhận |
| Nháp | Gửi, có ngoại lệ | Chờ duyệt |
| Chờ duyệt | Duyệt xong | Đã xác nhận |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người lập rút (cấp 1 chưa quyết định) | Đã rút |
| Bị từ chối, Đã rút | Sửa | Nháp |
| Nháp, Bị từ chối, Đã rút, Đã xác nhận (chưa có phiếu xuất) | Hủy | Đã hủy |
| Đã xác nhận | Ghi sổ phiếu xuất làm mọi dòng đủ số đặt | Đã giao đủ |
| Đã xác nhận | Đóng kèm lý do | Đã đóng |

## MODULE_05 Bán hàng (phần 2: Giao dịch nội bộ, CONG_VIEC_09)

### Luồng 12. Công ty bán khởi tạo đơn bán nội bộ

- Bắt đầu: công ty A lập đơn bán cho khách là đối tác nội bộ của công ty B (Luồng 9).
- Các bước:
  1. Chọn kênh "Nội bộ" (`NOI_BO`), kho xuất; mọi mặt hàng phải có liên kết với sản phẩm của B, hai công ty cùng tiền tệ, B có hồ sơ nhà cung cấp cho A (QUYTAC_NGHIEPVU_73); sai thì không lưu, không gửi được.
  2. Gửi như Luồng 9 (giữ hàng, ngoại lệ, duyệt). Khi đơn "Đã xác nhận" (ngay hoặc sau duyệt), hệ thống sinh đơn mua đối ứng ở B trong cùng giao dịch: "Chờ xác nhận nội bộ", chưa có kho, chưa có số; mặt hàng, số lượng quy theo liên kết; giá chưa thuế, thuế suất theo dòng đơn bán (QUYTAC_NGHIEPVU_74, QUYTAC_NGHIEPVU_75).
  3. Người có `purchasing.order.manage` ở B mở đơn mua đối ứng, chọn kho nhận, xác nhận: đơn về nháp, người xác nhận thành người lập, gửi luồng duyệt đơn mua (Luồng 5; chưa có chính sách duyệt thì duyệt ngay).
  4. Đơn mua đối ứng "Đã duyệt": A giao được (Luồng 14). Trước đó phiếu xuất giao hàng theo đơn bán bị từ chối.
- Ngoại lệ: B từ chối kèm lý do, rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt: đơn mua đóng, đơn bán của A kết thúc theo Luồng 15.
- Kết thúc: đơn bán "Đã xác nhận", đơn mua đối ứng "Đã duyệt".

### Luồng 13. Công ty mua khởi tạo đơn mua nội bộ

- Bắt đầu: công ty B lập đơn mua với nhà cung cấp là đối tác nội bộ của công ty A.
- Các bước:
  1. Thêm mặt hàng: giá chưa thuế, thuế suất tự lấy theo bảng giá kênh "Nội bộ" của A (tra qua API_73), khóa sửa; A phải có kênh Nội bộ và hồ sơ khách hàng cho B; cùng tiền tệ; mọi mặt hàng có liên kết (QUYTAC_NGHIEPVU_73, QUYTAC_NGHIEPVU_75).
  2. Gửi duyệt như đơn mua thường (QUYTAC_NGHIEPVU_63). Khi đơn "Đã duyệt", hệ thống sinh đơn bán đối ứng ở A trong cùng giao dịch: "Chờ xác nhận nội bộ", kênh Nội bộ, chưa có kho, chưa có số; mặt hàng, số lượng quy theo liên kết; giá chưa thuế, thuế suất theo đơn mua, không tra lại bảng giá.
  3. Người có `sales.order.manage` ở A chọn kho xuất, xác nhận: đơn về nháp, người xác nhận thành người lập, gửi như Luồng 9 (giữ hàng, ngoại lệ, duyệt).
  4. Đơn bán "Đã xác nhận": A giao được ngay (đơn mua khởi tạo đã duyệt).
- Ngoại lệ: không đủ hàng khả dụng khi xác nhận thì báo lỗi, đơn giữ "Chờ xác nhận nội bộ". A từ chối kèm lý do, rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt: đơn bán hủy, đơn mua của B đóng theo Luồng 15. Đơn mua đã có đơn bán đối ứng không sửa được.
- Kết thúc: đơn bán đối ứng "Đã xác nhận", hàng đang giữ.

### Luồng 14. Giao, nhận hàng nội bộ

- Bắt đầu: đơn bán nội bộ "Đã xác nhận", đơn mua bên kia "Đã duyệt".
- Các bước:
  1. Thủ kho A lập, gửi phiếu xuất giao hàng theo đơn bán (Luồng 10). Ghi sổ xong, hệ thống sinh phiếu nhập mua "Chờ nhận" ở kho nhận của đơn mua của B trong cùng giao dịch: mặt hàng, số lượng quy theo liên kết (đơn vị cơ sở bên B), đơn giá theo đơn mua, lô, hạn dùng theo phiếu xuất (QUYTAC_NGHIEPVU_76). Hàng đang trên đường không thuộc tồn kho bên nào.
  2. Thủ kho B (quyền `inventory.purchase.receive` tại kho nhận) mở phiếu nhập, nhập số thực nhận từng dòng (không vượt số xuất), chọn serial đã nhận trong số serial đã xuất, vị trí nếu kho dùng vị trí; nhận thiếu phải ghi lý do.
  3. Xác nhận nhận hàng: cấp số phiếu nhập mua của B, ghi sổ số thực nhận (dòng nhận 0 bỏ khỏi phiếu), không kiểm tra chất lượng, không đi luồng duyệt; số đã nhận của đơn mua cập nhật; nhận đủ mọi dòng thì đơn mua "Đã nhận đủ".
  4. Dòng nhận thiếu: hệ thống sinh biên bản chênh lệch ở A (Luồng 15b).
- Ngoại lệ: đơn mua nội bộ không lập được phiếu nhập mua thường. Phiếu đã nhận rồi không nhận lại được.
- Kết thúc: phiếu nhập đã ghi sổ; biên bản chờ xử lý nếu thiếu.

### Luồng 15. Kết thúc hai bên, xử lý biên bản chênh lệch

a) Kết thúc hai bên (QUYTAC_NGHIEPVU_78):
- Bắt đầu: một bên hủy, đóng, từ chối, rút đơn đối ứng, hoặc đơn đối ứng không được duyệt.
- Các bước: trong cùng giao dịch, chứng từ bên kia kết thúc với lý do nêu bên và thao tác: đơn bán chưa có phiếu xuất thì hủy, đã có thì đóng, nhả hàng giữ; đơn mua chưa nhận đủ, chưa đóng thì đóng; yêu cầu duyệt còn chờ của bên kia được rút.
- Ngoại lệ: bên bán còn phiếu xuất giao hàng nháp thì không kết thúc được; xóa hoặc gửi phiếu nháp trước.
- Kết thúc: cả hai chứng từ đã hủy hoặc đã đóng.

b) Xử lý biên bản chênh lệch (QUYTAC_NGHIEPVU_77):
- Bắt đầu: Thủ kho A (quyền `inventory.sales.issue` tại kho xuất) mở "Chênh lệch giao nội bộ" ở mini app Kho, lọc "Chờ xử lý".
- Các bước: nhập ghi chú nếu cần, chọn "Nhập lại kho" (lập, ghi sổ phiếu nhận hàng trả lại vào kho xuất theo giá vốn phiếu xuất, serial chưa nhận) hoặc "Ghi tổn thất" (chỉ đóng biên bản).
- Ngoại lệ: biên bản đã xử lý thì từ chối lần xử lý sau; nhập lại kho không ghi sổ được thì biên bản trở lại "Chờ xử lý".
- Bổ sung CONG_VIEC_13: "Ghi tổn thất" giảm phải thu của công ty mua đúng giá trị phần thiếu theo giá đơn bán, trừ trước vào phiếu xuất gốc, cùng giao dịch đóng biên bản; "Nhập lại kho" giảm phải thu qua phiếu nhận hàng trả lại (Luồng 18, QUYTAC_NGHIEPVU_86).
- Kết thúc: biên bản "Đã nhập lại kho" hoặc "Đã ghi tổn thất".

Trạng thái đơn đối ứng (đơn bán, đơn mua sinh tự động):

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Chứng từ khởi tạo bên kia được xác nhận (đơn bán) hoặc được duyệt (đơn mua) | Chờ xác nhận nội bộ |
| Chờ xác nhận nội bộ | Chọn kho, xác nhận | Nháp, rồi gửi ngay theo luồng của chứng từ (đơn bán: Đã xác nhận hoặc Chờ duyệt; đơn mua: Đã duyệt hoặc Chờ duyệt) |
| Chờ xác nhận nội bộ | Từ chối kèm lý do | Đơn bán: Đã hủy; đơn mua: Đã đóng |
| Chờ duyệt | Từ chối duyệt hoặc người lập rút | Đơn bán: Đã hủy; đơn mua: Đã đóng |
| Chờ xác nhận nội bộ, Chờ duyệt, Đã xác nhận, Đã duyệt | Chứng từ bên kia kết thúc | Đơn bán: Đã hủy (chưa có phiếu xuất) hoặc Đã đóng; đơn mua: Đã đóng |

Trạng thái phiếu nhập mua nội bộ: (mới, khi ghi sổ phiếu xuất) → Chờ nhận → (nhận hàng) Đã ghi sổ. Trạng thái biên bản chênh lệch: Chờ xử lý → Đã nhập lại kho hoặc Đã ghi tổn thất.

## MODULE_05 Bán hàng (phần 3: Khuyến mãi, CONG_VIEC_12)

### Luồng 16. Lập, duyệt, dừng chương trình khuyến mãi

- Bắt đầu: người có `sales.promotion.manage` mở "Khuyến mãi" ở mini app Bán hàng, bấm "Lập chương trình".
- Các bước:
  1. Nhập tên, loại, từ ngày, đến ngày, kênh áp dụng (không chọn: mọi kênh trừ Nội bộ), nhóm khách áp dụng (không chọn: mọi khách); theo loại: mặt hàng và phần trăm giảm; hoặc ngưỡng tổng đơn gồm thuế, phần trăm, mức giảm tối đa; hoặc mặt hàng mua, số lượng mua, mặt hàng tặng, số lượng tặng mỗi suất. Ngân sách (giảm theo sản phẩm, theo đơn) hoặc số suất tối đa (mua X tặng Y). Lưu nháp (QUYTAC_NGHIEPVU_79).
  2. Gửi duyệt: cấp số (`KM`) lần đầu; gửi luồng duyệt (Luồng 5) loại `sales.promotion` với giá trị là ngân sách; chương trình "Chờ duyệt". Chưa có chính sách duyệt: chương trình "Đang chạy" ngay (QUYTAC_NGHIEPVU_80).
  3. Duyệt xong: "Đang chạy". Từ chối: "Bị từ chối". Người lập rút khi cấp duyệt đầu chưa quyết định: "Đã rút". Bị từ chối, đã rút thì sửa (về nháp), gửi lại.
  4. Chương trình đang chạy: xem đã dùng (tiền đã giảm, số suất đã tặng so với giới hạn); dừng kèm lý do khi cần.
- Ngoại lệ: chương trình đang chạy không sửa được, chỉ dừng; chương trình đã dừng không chạy lại được (lập chương trình mới).
- Kết thúc: chương trình "Đang chạy" hoặc "Đã dừng".

### Luồng 17. Áp khuyến mãi vào đơn bán

- Bắt đầu: Nhân viên bán hàng lưu đơn bán (lập hoặc sửa, Luồng 9).
- Các bước:
  1. Hệ thống tra giá từng dòng như cũ (QUYTAC_NGHIEPVU_67). Đơn bán nội bộ, đơn kênh Nội bộ thì bỏ qua khuyến mãi.
  2. Lấy chương trình đang chạy của công ty có ngày đơn trong thời gian hiệu lực, đúng kênh, đúng nhóm khách (QUYTAC_NGHIEPVU_81, QUYTAC_NGHIEPVU_84).
  3. Giảm theo sản phẩm: mỗi dòng chọn phần trăm cao nhất, trừ trên giá bảng giá trước chiết khấu tay; chương trình không đủ ngân sách còn lại cho cả đơn thì bỏ, các dòng chọn lại.
  4. Giảm theo đơn: tổng gồm thuế sau bước 3 đạt ngưỡng thì chọn chương trình có tiền giảm lớn nhất (có trần, còn đủ ngân sách); chia vào các dòng có thành tiền theo tỷ lệ thành tiền gồm thuế, phần dư dồn dòng cuối có thành tiền.
  5. Mua X tặng Y: mỗi chương trình tính số suất từ tổng số lượng cơ sở mặt hàng mua (không đếm dòng tặng), không quá số suất còn lại, không quá số suất đủ hàng tặng tại kho xuất (thiếu thì tặng phần đủ hàng, ghi suất thiếu trên đơn để hiện cảnh báo); thêm dòng hàng tặng giá 0.
  6. Ghi dòng, tổng đơn. Dòng hàng tặng cũ bị thay mỗi lần lưu.
  7. Gửi đơn (Luồng 9): khóa các chương trình đơn đã áp, kiểm lại ngân sách, số suất cùng các đơn khác (QUYTAC_NGHIEPVU_82); giữ hàng gồm dòng tặng; ngoại lệ dưới giá vốn tính trên giá trước khuyến mãi, bỏ qua dòng tặng (QUYTAC_NGHIEPVU_83).
- Ngoại lệ: gửi đơn khi chương trình đã hết ngân sách hoặc hết suất thì báo "Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi.", đơn giữ nháp; người bán lưu lại để tính lại.
- Kết thúc: đơn mang khuyến mãi đã áp; đã dùng của chương trình tăng khi đơn chờ duyệt, xác nhận, giao, đóng; đơn bị từ chối, rút, hủy thì không còn tính vào đã dùng.

Trạng thái chương trình khuyến mãi:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Lập | Nháp |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt | Đang chạy |
| Nháp, Bị từ chối, Đã rút | Gửi, có chính sách duyệt | Chờ duyệt |
| Chờ duyệt | Duyệt xong | Đang chạy |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người lập rút (cấp 1 chưa quyết định) | Đã rút |
| Bị từ chối, Đã rút | Sửa | Nháp |
| Đang chạy | Dừng kèm lý do | Đã dừng |

## MODULE_06 Tài chính – Kế toán (phần 1: Công nợ phải thu, phải trả, CONG_VIEC_13)

### Luồng 18. Công nợ tự phát sinh

- Bắt đầu: Thủ kho ghi sổ phiếu xuất giao hàng, phiếu nhận hàng trả lại, phiếu nhập mua (ghi sổ ngay hoặc sau kiểm tra chất lượng), phiếu trả hàng nhà cung cấp (Luồng 10, Luồng 11; mua hàng ở MODULE_04).
- Các bước:
  1. Trong cùng giao dịch ghi sổ, hệ thống tính giá trị công nợ gồm thuế theo đơn bán, đơn mua của phần đã giao, đã nhận đạt kiểm tra chất lượng, đã trả (QUYTAC_NGHIEPVU_86). Phiếu không có đối tác (người mua không lấy hóa đơn) hoặc giá trị 0 thì dừng.
  2. Khóa công nợ của đối tác ở phía đó (phải thu với phiếu bán, phải trả với phiếu mua).
  3. Phiếu xuất giao hàng, nhập mua: tạo khoản tăng nợ, hạn thanh toán = ngày phiếu + số ngày được nợ của hồ sơ đối tác; tự trừ vào trả trước còn lại cũ nhất.
  4. Phiếu nhận hàng trả lại, trả hàng nhà cung cấp: tạo khoản giảm nợ, trừ trước vào khoản tăng của phiếu gốc, phần còn lại trừ các khoản tăng cũ nhất; còn thừa là trả trước (QUYTAC_NGHIEPVU_87).
- Ngoại lệ: tạo công nợ lỗi thì phiếu kho không ghi sổ. Biên bản chênh lệch nội bộ ghi tổn thất cũng tạo khoản giảm phải thu như bước 4 (Luồng 15).
- Kết thúc: khoản công nợ hiện ở MAN_HINH_47, MAN_HINH_48.

### Luồng 19. Thu tiền khách hàng

- Bắt đầu: Kế toán mở "Phiếu thu chi", bấm "Lập phiếu" (hoặc "Lập phiếu thu" ở chi tiết công nợ khách).
- Các bước:
  1. Chọn loại "Thu tiền khách hàng", quỹ, ngày, số tiền, khách hàng. Hệ thống hiện trả trước đang còn và các chứng từ còn nợ, cũ nhất trước.
  2. Kế toán nhập số trừ từng chứng từ, hoặc bấm "Chia lại từ cũ nhất", hoặc để trống (tự trừ cũ nhất trước khi ghi sổ). Lưu nháp (QUYTAC_NGHIEPVU_88).
  3. Gửi: cấp số `PT` lần đầu, ghi sổ ngay (QUYTAC_NGHIEPVU_89): khóa công nợ của khách, khóa quỹ, kiểm lại số còn lại; tạo khoản giảm nợ, trừ chứng từ đã chọn (hoặc cũ nhất trước); phần thừa là trả trước; số dư quỹ tăng.
- Ngoại lệ: số trừ vượt số còn nợ của chứng từ, tổng trừ vượt số tiền phiếu thì không lưu được; lúc gửi chứng từ đã bị trừ bởi phiếu khác thì báo lỗi, phiếu giữ trạng thái trước khi gửi để sửa.
- Kết thúc: phiếu "Đã ghi sổ".

### Luồng 20. Trả tiền nhà cung cấp

- Bắt đầu: Kế toán lập phiếu loại "Trả tiền nhà cung cấp" (hoặc "Lập phiếu chi" ở chi tiết công nợ nhà cung cấp).
- Các bước:
  1. Chọn quỹ, ngày, số tiền, nhà cung cấp, chứng từ trừ như Luồng 19 bước 1, 2.
  2. Gửi: cấp số `PC` lần đầu; gửi luồng duyệt (Luồng 5) loại `finance.payment` với giá trị là số tiền; phiếu "Chờ duyệt". Chưa có chính sách duyệt thì ghi sổ ngay như phiếu thu.
  3. Người lập rút khi cấp duyệt đầu chưa quyết định: "Đã rút". Từ chối: "Bị từ chối".
  4. Duyệt xong: ghi sổ; kiểm quỹ đang dùng, số dư quỹ đủ, số còn nợ của chứng từ (QUYTAC_NGHIEPVU_88); số dư quỹ giảm, công nợ giảm.
- Ngoại lệ: duyệt xong mà không ghi sổ được (số dư quỹ không đủ, số còn nợ đã đổi, quỹ đã ngừng dùng) thì phiếu về "Bị từ chối", chi tiết phiếu hiện "Duyệt xong nhưng không ghi sổ được: <lý do> Sửa phiếu rồi gửi lại.". Bị từ chối, đã rút thì sửa (về nháp), gửi lại; số đã cấp giữ nguyên.
- Kết thúc: phiếu "Đã ghi sổ".

### Luồng 21. Hoàn tiền

- Bắt đầu: đối tác có trả trước đang còn (thu thừa, trả thừa, hàng trả lại sau khi đã thanh toán).
- Các bước:
  1. Kế toán lập phiếu "Hoàn tiền cho khách hàng" (phiếu chi) hoặc "Nhà cung cấp hoàn tiền" (phiếu thu); số tiền không vượt trả trước đang còn ở phía đó.
  2. Gửi: phiếu hoàn tiền cho khách đi như Luồng 20 (duyệt, kiểm số dư quỹ); phiếu nhà cung cấp hoàn ghi sổ ngay như Luồng 19.
  3. Ghi sổ: kiểm lại trả trước; tạo khoản tăng nợ (hạn thanh toán bằng ngày phiếu), tự trừ vào trả trước cũ nhất.
- Ngoại lệ: vượt trả trước thì không lưu được ("Số tiền hoàn vượt tiền trả trước đang còn."); lúc ghi sổ trả trước đã giảm thì như ngoại lệ của Luồng 19, Luồng 20.
- Kết thúc: trả trước của đối tác giảm; số dư quỹ đổi theo.

Trạng thái phiếu thu, phiếu chi:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Lập | Nháp |
| Nháp, Bị từ chối, Đã rút | Sửa | Nháp |
| Nháp, Bị từ chối, Đã rút | Gửi phiếu thu, hoặc phiếu chi khi chưa có chính sách duyệt, ghi sổ được | Đã ghi sổ |
| Nháp, Bị từ chối, Đã rút | Gửi phiếu thu, không ghi sổ được | Giữ trạng thái cũ, báo lỗi |
| Nháp, Bị từ chối, Đã rút | Gửi phiếu chi, có chính sách duyệt | Chờ duyệt |
| Chờ duyệt | Duyệt xong, ghi sổ được | Đã ghi sổ |
| Chờ duyệt | Duyệt xong, không ghi sổ được | Bị từ chối (kèm lý do) |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người lập rút (cấp 1 chưa quyết định) | Đã rút |

## MODULE_06 Tài chính – Kế toán (phần 2: Kế toán tổng hợp, CONG_VIEC_14)

### Luồng 22. Khởi tạo kế toán của công ty

- Bắt đầu: quản trị tập đoàn đã đặt chế độ kế toán của công ty ở quản lý công ty (Thông tư 99/2025 mặc định, hoặc Thông tư 133). Kế toán trưởng mở "Hệ thống tài khoản".
- Các bước:
  1. Màn hình hiện "Công ty chưa khởi tạo kế toán. Chế độ kế toán của công ty: <chế độ>." và nút "Khởi tạo kế toán".
  2. Kế toán trưởng bấm "Khởi tạo kế toán". Trong một giao dịch, hệ thống khóa công ty, ghi cài đặt kế toán, nạp hệ thống tài khoản của chế độ, định khoản mặc định (QUYTAC_NGHIEPVU_93, QUYTAC_NGHIEPVU_94), tạo bút toán cho mọi phiếu kho, phiếu thu chi đã ghi sổ và biên bản nội bộ đã ghi tổn thất của công ty theo thứ tự ghi sổ.
  3. Kế toán trưởng thêm tài khoản chi tiết ("Thêm chi tiết" trên dòng tài khoản cha): định khoản đang dùng tài khoản cha chuyển sang tài khoản mới.
  4. Kế toán trưởng đổi tài khoản của vai trò ở thẻ "Định khoản mặc định" khi cần.
  5. Kế toán lập phiếu kế toán số dư đầu kỳ các tài khoản (Luồng 24).
- Ngoại lệ: khởi tạo lần hai báo "Công ty đã khởi tạo kế toán."; số hiệu sai quy tắc, trùng thì báo dưới ô. Đổi chế độ ở quản lý công ty khi đã có bút toán: báo "Công ty đã có bút toán, không đổi được chế độ kế toán."; đã khởi tạo nhưng chưa có bút toán: hệ thống bỏ khởi tạo, kế toán trưởng khởi tạo lại.
- Kết thúc: "Đã khởi tạo kế toán."; cây tài khoản, định khoản hiện ở MAN_HINH_50.

### Luồng 23. Bút toán tự sinh

- Bắt đầu: Thủ kho ghi sổ phiếu kho (Luồng 10, Luồng 11; MODULE_03, MODULE_04); Kế toán ghi sổ phiếu thu chi (Luồng 19 đến Luồng 21); bên bán ghi tổn thất biên bản chênh lệch nội bộ (Luồng 15).
- Các bước:
  1. Trong cùng giao dịch ghi sổ, hệ thống đọc cài đặt kế toán của công ty (khóa dòng chia sẻ). Chưa khởi tạo thì dừng.
  2. Ngày chứng từ thuộc kỳ đã khóa thì từ chối cả lần ghi sổ (QUYTAC_NGHIEPVU_97).
  3. Tính số tiền theo vai trò (doanh thu, thuế, giá vốn, phải thu...), làm tròn đến đơn vị tiền tệ công ty theo lũy kế từng dòng đơn, cùng cách với công nợ (THAY_DOI_10); đổi vai trò sang tài khoản theo định khoản của công ty (QUYTAC_NGHIEPVU_95).
  4. Bỏ dòng 0, kiểm tổng Nợ bằng tổng Có, ghi bút toán "Đã ghi sổ" số chứng từ gốc, gắn đối tác vào dòng phải thu, phải trả.
- Ngoại lệ: kỳ đã khóa thì chứng từ không gửi, không ghi sổ được, báo "Ngày chứng từ thuộc kỳ kế toán đã khóa sổ."; phiếu chi duyệt xong rơi vào kỳ khóa thì về "Bị từ chối" kèm lý do (Luồng 20); phiếu kho duyệt xong rơi vào kỳ khóa thì về "Bị từ chối", nhả hàng giữ. Phiếu chuyển kho không sinh bút toán. Ghi tổn thất hàng thiếu nội bộ ghi giảm doanh thu, thuế đầu ra, phải thu.
- Kết thúc: bút toán hiện ở MAN_HINH_51 với nguồn "Phiếu kho", "Phiếu thu chi" hoặc "Ghi tổn thất hàng thiếu nội bộ".

### Luồng 24. Phiếu kế toán

- Bắt đầu: Kế toán mở "Bút toán", bấm "Lập phiếu kế toán".
- Các bước:
  1. Nhập ngày, diễn giải, các dòng (tài khoản, đối tác, diễn giải dòng, Nợ hoặc Có); màn hình hiện tổng Nợ, tổng Có, chênh lệch. Lưu nháp (QUYTAC_NGHIEPVU_96).
  2. Gửi: cấp số `PKT` lần đầu; gửi luồng duyệt (Luồng 5) loại `accounting.journal` với giá trị là tổng Nợ; phiếu "Chờ duyệt". Chưa có chính sách duyệt thì ghi sổ ngay.
  3. Người lập rút khi cấp duyệt đầu chưa quyết định: "Đã rút". Từ chối: "Bị từ chối".
  4. Duyệt xong: kiểm kỳ chưa khóa, ghi sổ.
- Ngoại lệ: lệch Nợ Có, dòng ghi cả hai bên, số lẻ hơn đơn vị tiền tệ, tài khoản không nhận bút toán, dòng 131, 331 thiếu đối tác thì không lưu được; ngày thuộc kỳ đã khóa thì không lưu, gửi được; duyệt xong mà kỳ đã khóa thì phiếu về "Bị từ chối", chi tiết hiện "Duyệt xong nhưng không ghi sổ được: Ngày chứng từ thuộc kỳ kế toán đã khóa sổ. Sửa phiếu rồi gửi lại.".
- Kết thúc: phiếu "Đã ghi sổ"; phiếu đã ghi sổ không sửa.

Trạng thái phiếu kế toán:

| Từ | Sự kiện | Sang |
|---|---|---|
| (mới) | Lập | Nháp |
| Nháp, Bị từ chối, Đã rút | Sửa | Nháp |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt | Đã ghi sổ |
| Nháp, Bị từ chối, Đã rút | Gửi, có chính sách duyệt | Chờ duyệt |
| Chờ duyệt | Duyệt xong, kỳ chưa khóa | Đã ghi sổ |
| Chờ duyệt | Duyệt xong, kỳ đã khóa | Bị từ chối (kèm lý do) |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người lập rút (cấp 1 chưa quyết định) | Đã rút |

### Luồng 25. Khóa sổ, mở lại sổ

- Bắt đầu: tháng đã kết thúc; Kế toán trưởng mở "Sổ sách".
- Các bước:
  1. Thẻ "Bảng cân đối số phát sinh": chọn từ ngày, đến ngày của tháng, kiểm tổng Nợ bằng tổng Có (QUYTAC_NGHIEPVU_98).
  2. Thẻ "Khóa sổ": màn hình hiện "Đã khóa sổ đến", "Tháng tiếp theo cần khóa".
  3. Bấm "Khóa sổ tháng <tháng>", xác nhận. Hệ thống khóa dòng cài đặt, kiểm tháng đúng thứ tự, đã kết thúc, không còn phiếu kế toán, phiếu kho, phiếu chi đang chờ có ngày trong tháng; tạo bút toán kết chuyển (521 sang doanh thu trước, rồi sang 911, kết quả sang 4212) `KC-YYYY-MM` ngày cuối tháng; ghi ngày khóa sổ (QUYTAC_NGHIEPVU_97).
  4. Cần sửa số liệu tháng đã khóa: bấm "Mở lại tháng <tháng>" (tháng khóa gần nhất), xác nhận. Hệ thống xóa bút toán kết chuyển của tháng, lùi ngày khóa về lần khóa trước.
- Ngoại lệ: tháng chưa kết thúc, không đúng thứ tự: báo "Không khóa được tháng này (khóa lần lượt từng tháng đã kết thúc)."; còn phiếu chờ: báo "Còn phiếu kế toán chờ duyệt trong kỳ." hoặc "Còn phiếu kho hoặc phiếu chi đang chờ (duyệt, kiểm tra chất lượng, nhận hàng nội bộ) có ngày trong kỳ.".
- Kết thúc: "Đã khóa sổ." hoặc "Đã mở lại sổ."; chứng từ có ngày trong kỳ khóa không ghi sổ được.

Trạng thái kỳ kế toán (theo tháng):

| Từ | Sự kiện | Sang |
|---|---|---|
| Đang mở | Khóa sổ (tháng tiếp theo, đã kết thúc, không còn chứng từ đang chờ) | Đã khóa |
| Đã khóa (tháng khóa gần nhất) | Mở lại | Đang mở |

## MODULE_06 Tài chính – Kế toán (phần 3: Báo cáo tài chính, CONG_VIEC_15)

### Luồng 26. Lập, xuất báo cáo tài chính

- Bắt đầu: công ty đã khởi tạo kế toán (Luồng 22). Kế toán trưởng mở "Báo cáo tài chính".
- Các bước:
  1. Khi cần tách ngắn hạn, dài hạn: Kế toán trưởng mở "Hệ thống tài khoản", thêm tài khoản chi tiết (ví dụ 3312 dưới 331), bấm "Sửa", chọn ô "Dài hạn", lưu (QUYTAC_NGHIEPVU_101).
  2. Ở "Báo cáo tài chính", chọn thẻ "Tình hình tài chính" và "Tại ngày", hoặc thẻ "Kết quả kinh doanh" và "Từ ngày", "Đến ngày". Công ty theo Thông tư 133 chọn mẫu B01a-DNN hoặc B01b-DNN.
  3. Hệ thống tính từ bút toán đã ghi sổ: tình hình tài chính lấy số dư cuối ngày báo cáo và cuối ngày trước đầu năm tài chính; kết quả kinh doanh lấy phát sinh trong kỳ và cùng kỳ năm trước, không tính bút toán kết chuyển; số dư doanh thu, chi phí chưa kết chuyển cộng vào lợi nhuận chưa phân phối năm nay (QUYTAC_NGHIEPVU_99, QUYTAC_NGHIEPVU_100, QUYTAC_NGHIEPVU_102).
  4. Màn hình hiện bảng chỉ tiêu (mã số, tên, cách lấy số liệu, hai cột số).
  5. Bấm "Xuất Excel" (tải tệp) hoặc "Xuất PDF" (mở ở thẻ mới).
- Ngoại lệ: công ty chưa khởi tạo kế toán: "Công ty chưa khởi tạo kế toán."; từ ngày sau đến ngày: màn hình báo "Chọn ngày hợp lệ; từ ngày không sau đến ngày." và không gọi API; đánh dấu dài hạn tài khoản của chế độ: "Chỉ đánh dấu dài hạn cho tài khoản chi tiết do kế toán mở.".
- Kết thúc: báo cáo hiện trên màn hình hoặc tệp Excel, PDF; không lưu báo cáo trong hệ thống.

## MODULE_06 Tài chính – Kế toán (phần 4: Hóa đơn điện tử, CONG_VIEC_16)

### Luồng 27. Lập, gửi hóa đơn điện tử khi giao hàng

- Bắt đầu: Kế toán trưởng đã lưu cài đặt hóa đơn điện tử của công ty ("Cài đặt hóa đơn điện tử": bật, ngày bắt đầu, nhà cung cấp, thông tin kết nối, loại hóa đơn, ký hiệu mẫu số, ký hiệu theo năm; bấm "Kiểm tra kết nối" để thử thông tin đã lưu) (QUYTAC_NGHIEPVU_103).
- Các bước:
  1. Thủ kho ghi sổ phiếu xuất giao hàng. Trong cùng giao dịch ghi sổ, hệ thống lập hóa đơn gốc "Chờ gửi" với nội dung cố định (QUYTAC_NGHIEPVU_104); năm của hóa đơn chưa có ký hiệu thì "Lỗi cài đặt".
  2. Tác vụ nền `einvoice-send` (mỗi 30 giây) lấy tối đa 20 hóa đơn đến giờ gửi; với mỗi hóa đơn ghi lần gửi, giữ chỗ, rồi gọi nhà cung cấp ngoài giao dịch (QUYTAC_NGHIEPVU_105).
  3. Nhà cung cấp lập, ký số từ xa, gửi cơ quan thuế, trả số hóa đơn và mã của cơ quan thuế. Hệ thống ghi kết quả lần gửi, chuyển "Đã phát hành", lưu tệp PDF, XML.
  4. Kế toán mở "Hóa đơn điện tử" xem danh sách, chi tiết; bấm "Tải PDF", "Tải XML".
- Ngoại lệ:
  - Có số nhưng chưa có mã của cơ quan thuế: "Chờ cấp mã"; lần sau tra trạng thái theo mã tham chiếu.
  - Lỗi kết nối, lỗi máy chủ nhà cung cấp, hết thời gian chờ: "Chờ gửi lại", tự gửi lại sau 1, 5, 15, 60 phút rồi mỗi 60 phút; mọi lần sau lần đầu tra trạng thái theo mã tham chiếu trước, tra không thấy mới gửi, nên không lập trùng.
  - Lỗi dữ liệu, lỗi xác thực: "Lỗi" kèm lỗi gần nhất; kế toán sửa cài đặt hoặc dữ liệu rồi bấm "Gửi lại". "Lỗi cài đặt": khai ký hiệu của năm trong cài đặt thì hóa đơn tự về "Chờ gửi".
  - Cơ quan thuế từ chối: "Bị từ chối" kèm lý do; kế toán sửa rồi gửi lại qua API (lập lại với mã tham chiếu mới; màn hình chưa có nút "Gửi lại" cho trạng thái này).
  - Đang có lần gửi chưa xong (dưới 10 phút): "Gửi lại" báo "Hóa đơn đang được gửi; thử lại sau ít phút.".
  - Chưa "Đã phát hành" sau ngày làm việc tiếp theo ngày hóa đơn: nhãn "Quá hạn"; tác vụ nền `einvoice-overdue` (mỗi giờ) báo người có quyền quản lý hóa đơn của công ty, mỗi hóa đơn một lần; thông báo mở danh sách lọc hóa đơn quá hạn.
  - Công ty chưa bật hoặc ngày phiếu trước ngày bắt đầu: không lập hóa đơn.
- Kết thúc: hóa đơn "Đã phát hành" có số, mã của cơ quan thuế (hóa đơn có mã), tệp PDF, XML.

Trạng thái hóa đơn điện tử:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Ghi sổ phiếu xuất giao hàng; lập hóa đơn điều chỉnh, thay thế | Chờ gửi (`pending`); Lỗi cài đặt (`setup_error`) khi năm chưa có ký hiệu |
| Lỗi cài đặt | Lưu cài đặt có ký hiệu của năm; "Gửi lại" | Chờ gửi |
| Chờ gửi, Chờ gửi lại | Nhà cung cấp trả số và mã (hoặc số với hóa đơn không mã) | Đã phát hành (`issued`) |
| Chờ gửi, Chờ gửi lại | Nhà cung cấp trả số, chưa có mã | Chờ cấp mã (`awaiting_code`) |
| Chờ gửi, Chờ gửi lại, Chờ cấp mã | Lỗi tạm thời, hết thời gian chờ | Chờ gửi lại (`retrying`) |
| Chờ gửi, Chờ gửi lại, Chờ cấp mã | Lỗi dữ liệu, lỗi xác thực, nhà cung cấp đã đổi trong cài đặt | Lỗi (`failed`) |
| Chờ gửi, Chờ gửi lại, Chờ cấp mã | Cơ quan thuế từ chối | Bị từ chối (`rejected`) |
| Chờ cấp mã | Tra trạng thái có mã | Đã phát hành |
| Lỗi, Chờ gửi lại, Bị từ chối | "Gửi lại" | Chờ gửi, gửi ngay (Bị từ chối: mã tham chiếu mới) |
| Đã phát hành | Hóa đơn thay thế của nó phát hành | Đã phát hành, ghi "Đã bị thay thế"; kết quả gửi khác không đổi trạng thái "Đã phát hành" |

### Luồng 28. Xử lý hóa đơn khi trả hàng; hóa đơn thay thế

- Bắt đầu: Thủ kho ghi sổ phiếu nhận hàng trả lại của phiếu xuất có hóa đơn gốc; hoặc kế toán phát hiện hóa đơn đã phát hành sai thông tin người mua.
- Các bước (trả hàng):
  1. Ghi sổ phiếu nhận hàng trả lại tạo việc "Chờ xử lý" ở thẻ "Chờ xử lý trả hàng" của "Hóa đơn điện tử" (QUYTAC_NGHIEPVU_106).
  2. Hóa đơn gốc hiện hành chưa "Đã phát hành": dòng ghi "chờ hóa đơn gốc phát hành", không có nút xử lý.
  3. Kế toán bấm "Lập hóa đơn điều chỉnh giảm": hệ thống lập hóa đơn điều chỉnh ghi âm, tham chiếu hóa đơn gốc hiện hành, gửi ngay như Luồng 27; việc chuyển "Đã lập hóa đơn điều chỉnh".
  4. Hoặc bấm "Ghi hóa đơn trả hàng của người mua", nhập ký hiệu, số, ngày, bấm "Lưu": việc chuyển "Người mua lập hóa đơn trả hàng".
- Các bước (thay thế):
  1. Ở chi tiết hóa đơn "Đã phát hành" (không phải hóa đơn điều chỉnh, chưa bị thay thế, chưa có hóa đơn điều chỉnh), kế toán bấm "Lập hóa đơn thay thế", sửa tên, mã số thuế, địa chỉ người mua, nhập lý do, bấm "Lập hóa đơn thay thế" (QUYTAC_NGHIEPVU_107).
  2. Hệ thống lập hóa đơn thay thế cùng dòng hàng, gửi ngay như Luồng 27, mở chi tiết hóa đơn mới; khi hóa đơn thay thế "Đã phát hành", hóa đơn cũ ghi "Đã bị thay thế". Hóa đơn thay thế lỗi, bị từ chối thì hóa đơn cũ không bị đánh dấu và lập được hóa đơn thay thế mới; đang có hóa đơn thay thế khác chưa xong thì báo "Hóa đơn đang có hóa đơn thay thế chưa phát hành.".
- Ngoại lệ: hóa đơn gốc chưa phát hành: "Hóa đơn gốc chưa phát hành; chờ hóa đơn gốc phát hành rồi xử lý."; người mua không có mã số thuế: "Chỉ ghi hóa đơn trả hàng của người mua là tổ chức có mã số thuế."; việc đã xử lý: "Việc trả hàng này đã được xử lý."; thay thế hóa đơn đã có điều chỉnh, đã bị thay thế, hóa đơn điều chỉnh: thông báo ở tài liệu `07` (QUYTAC_NGHIEPVU_107).
- Kết thúc: việc trả hàng đã xử lý; hoặc hóa đơn thay thế được gửi. Công nợ, bút toán không đổi.

Trạng thái việc chờ xử lý hóa đơn trả hàng:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| Chờ xử lý (`open`) | Lập hóa đơn điều chỉnh giảm | Đã lập hóa đơn điều chỉnh (`adjusted`) |
| Chờ xử lý | Ghi hóa đơn trả hàng của người mua | Người mua lập hóa đơn trả hàng (`buyer_invoice`) |
