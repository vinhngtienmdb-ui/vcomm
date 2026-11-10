# 09. LUỒNG NGHIỆP VỤ

- Mô tả: Quy trình chính, phụ, ngoại lệ; điều kiện bắt đầu, kết thúc; trạng thái và chuyển trạng thái.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_08 (2026-11-10): thêm luồng của MODULE_05 Bán hàng phần 1 (Luồng 9 đến Luồng 11)

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
