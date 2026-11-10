# 09. LUỒNG NGHIỆP VỤ

- Mô tả: Quy trình chính, phụ, ngoại lệ; điều kiện bắt đầu, kết thúc; trạng thái và chuyển trạng thái.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_08 (2026-11-10): thêm luồng của MODULE_05 Bán hàng phần 1 (Luồng 9 đến Luồng 11); CONG_VIEC_09 (2026-11-10): thêm luồng giao dịch nội bộ của MODULE_05 phần 2 (Luồng 12 đến Luồng 15), trạng thái đơn bán, đơn mua đối ứng; CONG_VIEC_12 (2026-11-10): thêm luồng khuyến mãi của MODULE_05 phần 3 (Luồng 16, Luồng 17), trạng thái chương trình khuyến mãi

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
  4. Hệ thống tính ngoại lệ: chiết khấu vượt mức, dưới giá vốn, vượt hạn mức công nợ theo dư nợ tạm tính (QUYTAC_NGHIEPVU_68, QUYTAC_NGHIEPVU_69).
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
