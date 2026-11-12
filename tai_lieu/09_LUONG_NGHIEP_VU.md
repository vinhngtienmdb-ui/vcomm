# 09. LUỒNG NGHIỆP VỤ

- Mô tả: Quy trình chính, phụ, ngoại lệ; điều kiện bắt đầu, kết thúc; trạng thái và chuyển trạng thái.
- Phiên bản: 1.21
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đã phê duyệt
- Thay đổi theo: CONG_VIEC_08 (2026-11-10): thêm luồng của MODULE_05 Bán hàng phần 1 (Luồng 9 đến Luồng 11); CONG_VIEC_09 (2026-11-10): thêm luồng giao dịch nội bộ của MODULE_05 phần 2 (Luồng 12 đến Luồng 15), trạng thái đơn bán, đơn mua đối ứng; CONG_VIEC_12 (2026-11-10): thêm luồng khuyến mãi của MODULE_05 phần 3 (Luồng 16, Luồng 17), trạng thái chương trình khuyến mãi; CONG_VIEC_13 (2026-11-10): thêm luồng công nợ của MODULE_06 phần 1 (Luồng 18 đến Luồng 21), trạng thái phiếu thu, phiếu chi; Luồng 9 bước 4 kiểm hạn mức theo dư nợ thật (QUYTAC_NGHIEPVU_92, THAY_DOI_09); Luồng 15 ghi tổn thất giảm phải thu; CONG_VIEC_14 (2026-11-10): thêm luồng kế toán tổng hợp của MODULE_06 phần 2 (Luồng 22 đến Luồng 25), trạng thái phiếu kế toán, trạng thái kỳ kế toán; CONG_VIEC_15 (2026-11-10): thêm luồng báo cáo tài chính của MODULE_06 phần 3 (Luồng 26); CONG_VIEC_16 (2026-11-10): thêm luồng hóa đơn điện tử của MODULE_06 phần 4 (Luồng 27, Luồng 28), trạng thái hóa đơn điện tử, trạng thái việc chờ xử lý hóa đơn trả hàng; CONG_VIEC_17 (2026-11-10): thêm luồng hoa hồng đội kinh doanh của MODULE_06 phần 5 (Luồng 29), trạng thái bảng hoa hồng; CONG_VIEC_18 (2026-11-10): thêm luồng đối soát ngân hàng của MODULE_06 phần 6 (Luồng 30), trạng thái giao dịch ngân hàng; CONG_VIEC_19 (2026-11-10): thêm luồng đối soát thu hộ của MODULE_06 phần 7 (Luồng 31), trạng thái bảng đối soát thu hộ; CONG_VIEC_20 (2026-11-10): thêm luồng báo cáo tài chính hợp nhất của MODULE_06 phần 8 (Luồng 32), trạng thái bảng hợp nhất; sửa sau rà soát: gửi tính lại và lưu số, đối tác của điều chỉnh tay; CONG_VIEC_21 (2026-11-10), THAY_DOI_12: thêm luồng giao, chuyển khách hàng cho nhân viên kinh doanh của MODULE_07 phần 2 (Luồng 33), trạng thái phiếu giao khách; CONG_VIEC_23 (2026-11-10): thêm luồng 35 (đăng ký người mua qua giới thiệu, đánh dấu nhân viên kinh doanh); CONG_VIEC_27 (2026-11-10): thêm luồng 36 (xây dựng đội kinh doanh nhiều cấp); CONG_VIEC_24 (2026-11-11): thêm luồng 37 (đặt hàng trên VComm, giao qua đơn vị vận chuyển, trả hàng, hoàn tất), trạng thái đơn VComm, trạng thái yêu cầu trả hàng; CONG_VIEC_25 (2026-11-11): thêm luồng 38 (thanh toán đơn người mua, hoàn tiền), trạng thái Chờ thanh toán của đơn VComm, trạng thái lần thanh toán, việc hoàn tiền; CONG_VIEC_26 (2026-11-11): thêm luồng 39 (hoa hồng theo đơn, ví hoa hồng, rút tiền), trạng thái hoa hồng của đơn, yêu cầu rút tiền; CONG_VIEC_43 (2026-11-11), THAY_DOI_18: thêm luồng 40 (đơn bán dịch vụ lập tay), luồng 41 (giao dịch nội bộ dịch vụ); Luồng 9, 10, 12, 13, 14 bổ sung; đánh dấu Luồng 29 (CONG_VIEC_17) đã bỏ, Luồng 33 (CONG_VIEC_21) đã tắt; CONG_VIEC_50 (2026-11-11): thêm Luồng 49 xem và xuất báo cáo quản trị của MODULE_15; CONG_VIEC_53 (2026-11-11), THAY_DOI_24: thêm luồng 43 (bán, trả hàng, đóng ca tại quầy của MODULE_14 phần 1), trạng thái ca thu ngân; phần điểm tại quầy chưa làm, chờ CONG_VIEC_51; CONG_VIEC_49 (2026-11-11), THAY_DOI_22: thêm luồng 44 (cộng đồng: cộng tác viên, thưởng giới thiệu, mua chung, ví mua sắm, khóa và chặn ví, bảng tin và kiểm duyệt; luồng con 44.1 đến 44.5), trạng thái hồ sơ cộng tác viên, nhóm mua chung, đơn mua chung, bài đăng và bình luận; CONG_VIEC_58 (2026-11-12): thêm Luồng 55 kế hoạch mua theo ngân sách của MODULE_14 phần 3 (lập, duyệt kế hoạch; kiểm tra ngân sách khi lập, gửi duyệt đơn mua; phiếu điều chỉnh), trạng thái kế hoạch ngân sách mua, phiếu điều chỉnh ngân sách; CONG_VIEC_57 (2026-11-12): thêm luồng 53 (đơn VComm nhận tại trạm hoặc trạm giao: đặt đơn có trạm, soạn, sẵn sàng, giao tại trạm, trạm giao, hết hạn giữ, đóng ca, trả hàng tại trạm của MODULE_14 phần 2), trạng thái đơn của trạm (thêm Sẵn sàng nhận); CONG_VIEC_55 (2026-11-11): thêm Luồng 51 cửa hàng liên kết của MODULE_12 phần 1, trạng thái giao dịch liên kết, voucher liên kết, bảng đối soát tuần; CONG_VIEC_59 (2026-11-12): thêm Luồng 56 chữ ký số, kho hợp đồng của MODULE_13 phần 2 (luồng con 56a đến 56e: cài đặt, trình ký tài liệu, hợp đồng mua, công văn đi ký số, hợp đồng lao động ký số), trạng thái phiên ký, người ký, hợp đồng, phụ lục hợp đồng

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

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): người lập đơn là Kế toán, Kế toán trưởng hoặc quản trị (Nhân viên bán hàng chỉ xem). Đơn lập tay chỉ gồm dịch vụ, trừ khi công ty bật cài đặt cho phép lập đơn bán tay có hàng hóa; dòng dịch vụ không giữ hàng, đơn xác nhận thì giao ngay (Luồng 40).

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

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): danh sách đơn chờ giao chỉ gồm đơn có hàng hóa; dòng dịch vụ không hiện, không lập tay phiếu xuất (Luồng 40).

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

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): giao dịch nội bộ chỉ gồm dịch vụ, trừ khi công ty bán bật cài đặt cho phép lập đơn bán tay có hàng hóa; giao, nhận dịch vụ theo Luồng 41.

- Bắt đầu: công ty A lập đơn bán cho khách là đối tác nội bộ của công ty B (Luồng 9).
- Các bước:
  1. Chọn kênh "Nội bộ" (`NOI_BO`), kho xuất; mọi mặt hàng phải có liên kết với sản phẩm của B, hai công ty cùng tiền tệ, B có hồ sơ nhà cung cấp cho A (QUYTAC_NGHIEPVU_73); sai thì không lưu, không gửi được.
  2. Gửi như Luồng 9 (giữ hàng, ngoại lệ, duyệt). Khi đơn "Đã xác nhận" (ngay hoặc sau duyệt), hệ thống sinh đơn mua đối ứng ở B trong cùng giao dịch: "Chờ xác nhận nội bộ", chưa có kho, chưa có số; mặt hàng, số lượng quy theo liên kết; giá chưa thuế, thuế suất theo dòng đơn bán (QUYTAC_NGHIEPVU_74, QUYTAC_NGHIEPVU_75).
  3. Người có `purchasing.order.manage` ở B mở đơn mua đối ứng, chọn kho nhận, xác nhận: đơn về nháp, người xác nhận thành người lập, gửi luồng duyệt đơn mua (Luồng 5; chưa có chính sách duyệt thì duyệt ngay).
  4. Đơn mua đối ứng "Đã duyệt": A giao được (Luồng 14). Trước đó phiếu xuất giao hàng theo đơn bán bị từ chối.
- Ngoại lệ: B từ chối kèm lý do, rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt: đơn mua đóng, đơn bán của A kết thúc theo Luồng 15.
- Kết thúc: đơn bán "Đã xác nhận", đơn mua đối ứng "Đã duyệt".

### Luồng 13. Công ty mua khởi tạo đơn mua nội bộ

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): như Luồng 12; mặt hàng hàng hóa bị từ chối ở dòng khi công ty bán tắt cài đặt; dịch vụ không giữ hàng khi bên bán xác nhận.

- Bắt đầu: công ty B lập đơn mua với nhà cung cấp là đối tác nội bộ của công ty A.
- Các bước:
  1. Thêm mặt hàng: giá chưa thuế, thuế suất tự lấy theo bảng giá kênh "Nội bộ" của A (tra qua API_73), khóa sửa; A phải có kênh Nội bộ và hồ sơ khách hàng cho B; cùng tiền tệ; mọi mặt hàng có liên kết (QUYTAC_NGHIEPVU_73, QUYTAC_NGHIEPVU_75).
  2. Gửi duyệt như đơn mua thường (QUYTAC_NGHIEPVU_63). Khi đơn "Đã duyệt", hệ thống sinh đơn bán đối ứng ở A trong cùng giao dịch: "Chờ xác nhận nội bộ", kênh Nội bộ, chưa có kho, chưa có số; mặt hàng, số lượng quy theo liên kết; giá chưa thuế, thuế suất theo đơn mua, không tra lại bảng giá.
  3. Người có `sales.order.manage` ở A chọn kho xuất, xác nhận: đơn về nháp, người xác nhận thành người lập, gửi như Luồng 9 (giữ hàng, ngoại lệ, duyệt).
  4. Đơn bán "Đã xác nhận": A giao được ngay (đơn mua khởi tạo đã duyệt).
- Ngoại lệ: không đủ hàng khả dụng khi xác nhận thì báo lỗi, đơn giữ "Chờ xác nhận nội bộ". A từ chối kèm lý do, rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt: đơn bán hủy, đơn mua của B đóng theo Luồng 15. Đơn mua đã có đơn bán đối ứng không sửa được.
- Kết thúc: đơn bán đối ứng "Đã xác nhận", hàng đang giữ.

### Luồng 14. Giao, nhận hàng nội bộ

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): chỉ áp dụng cho giao dịch nội bộ hàng hóa (công ty bán bật cài đặt). Dịch vụ không xuất kho, không phiếu nhập chờ nhận, không biên bản chênh lệch (Luồng 41).

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

## MODULE_06 Tài chính – Kế toán (phần 5: Hoa hồng đội kinh doanh, CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): Luồng 29 không còn; hoa hồng chỉ theo đơn VComm (Luồng 39, CONG_VIEC_26). Nội dung dưới đây giữ để tra cứu.

### Luồng 29. Gán nhân viên hưởng, ghi phát sinh, chốt bảng hoa hồng tháng

- Bắt đầu: Kế toán trưởng đã lưu cài đặt hoa hồng của công ty ("Cài đặt hoa hồng" thẻ "Cài đặt": bật, ngày bắt đầu, cách gán, cách kết hợp, mức mặc định, mức theo ngành hàng, hệ số kênh, bậc hệ số) và chỉ tiêu tháng (thẻ "Chỉ tiêu") (QUYTAC_NGHIEPVU_108).
- Các bước:
  1. Nhân viên bán hàng gửi đơn bán. Hệ thống gán nhân viên hưởng hoa hồng theo cách gán (QUYTAC_NGHIEPVU_109).
  2. Thủ kho ghi sổ phiếu xuất giao hàng. Đơn không có khách: ghi phát sinh ngay theo các dòng đơn của phiếu. Khách đã trả trước: khoản trả trước tự trừ vào khoản phải thu mới, ghi phát sinh (QUYTAC_NGHIEPVU_110).
  3. Kế toán ghi sổ phiếu thu khách hàng trừ nợ phiếu xuất; mỗi lần trừ nợ ghi phát sinh theo dòng đơn, chia theo phần còn phải thu của từng dòng.
  4. Khách trả hàng đã thanh toán, kế toán ghi sổ phiếu chi hoàn tiền: phát sinh âm. Trả hàng trừ vào phần chưa thu: không phát sinh.
  5. Kế toán xem thẻ "Phát sinh" của "Hoa hồng".
  6. Sau khi tháng kết thúc, kế toán mở thẻ "Bảng hoa hồng", bấm "Lập bảng tháng <tháng>": bảng nháp gom phát sinh chưa vào bảng có ngày đến hết tháng, tính theo nhân viên (QUYTAC_NGHIEPVU_111).
  7. Kế toán mở bảng, bấm "Gửi": cấp số `HH…`, gửi duyệt; chưa có chính sách duyệt thì ghi sổ ngay (QUYTAC_NGHIEPVU_112).
  8. Người duyệt duyệt: bảng ghi sổ, lập bút toán Nợ chi phí hoa hồng / Có phải trả người lao động.
- Ngoại lệ:
  - Bảng nháp chưa đúng: bấm "Bỏ bảng nháp", phát sinh trả về, lập lại.
  - Bị từ chối, người lập rút: phát sinh trả về, lập lại bảng tháng đó.
  - Đang có bảng nháp hoặc chờ duyệt: "Đang có bảng hoa hồng nháp hoặc chờ duyệt; xử lý bảng đó trước."; tháng chưa kết thúc hoặc không phải tháng tiếp theo: "Chỉ lập được bảng của tháng tiếp theo đã kết thúc.".
  - Thiếu định khoản `commission_expense` hoặc `staff_payable`: gửi báo "Chưa có định khoản cho chi phí hoa hồng hoặc phải trả người lao động; kế toán trưởng khai ở Hệ thống tài khoản."; nếu xảy ra khi duyệt xong thì bảng "Bị từ chối" kèm lý do.
  - Tháng của bảng đã khóa sổ: bút toán lấy ngày sau ngày khóa sổ.
  - Phát sinh có ngày của tháng đã chốt (hoàn tiền về sau): vào bảng kỳ sau.
  - Công ty chưa bật, đơn không có nhân viên hưởng, ngày phát sinh trước ngày bắt đầu: không ghi phát sinh.
- Kết thúc: bảng "Đã ghi sổ", phát sinh ghi số bảng, bút toán chi phí hoa hồng. Chi trả cho nhân viên ngoài phạm vi (qua lương ở MODULE_08).

Trạng thái bảng hoa hồng:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Lập bảng | Nháp (`draft`) |
| Nháp | Bỏ bảng nháp | (Xóa bảng; phát sinh trả về chưa vào bảng) |
| Nháp | Gửi, có chính sách duyệt | Chờ duyệt (`pending`) |
| Nháp | Gửi, chưa có chính sách duyệt | Đã ghi sổ (`posted`) |
| Chờ duyệt | Duyệt xong, ghi sổ được | Đã ghi sổ |
| Chờ duyệt | Duyệt xong, không ghi sổ được | Bị từ chối (`rejected`) kèm lý do; phát sinh trả về |
| Chờ duyệt | Từ chối | Bị từ chối; phát sinh trả về |
| Chờ duyệt | Người lập rút | Đã rút (`withdrawn`); phát sinh trả về |

## MODULE_06 Tài chính – Kế toán (phần 6: Đối soát ngân hàng, CONG_VIEC_18)

### Luồng 30. Nhận giao dịch ngân hàng, ghép với phiếu thu chi, đối chiếu số dư

- Bắt đầu: Kế toán trưởng mở "Kết nối ngân hàng", bấm "Kết nối" ở quỹ ngân hàng, chọn dịch vụ trung gian, bấm "Lưu"; sao chép khóa xác thực (chỉ hiện một lần) và địa chỉ webhook, khai vào trang quản trị của dịch vụ (QUYTAC_NGHIEPVU_113).
- Các bước:
  1. Dịch vụ trung gian gửi webhook `POST /api/v1/public/bank-webhooks/<mã kết nối>` kèm tiêu đề `Authorization: Apikey <khóa>`. Hệ thống kiểm khóa, kết nối đang bật, dữ liệu, số tài khoản (QUYTAC_NGHIEPVU_113, QUYTAC_NGHIEPVU_114).
  2. Hệ thống lưu giao dịch (trùng mã giao dịch thì không lưu lại), ghi lần nhận cuối, trả `{"success": true}`.
  3. Hệ thống thử tự ghép với phiếu thu chi đã ghi sổ (QUYTAC_NGHIEPVU_115). Ghép được: giao dịch "Đã ghép", "Tự ghép".
  4. Tiền vào chưa ghép: hệ thống gợi ý khách hàng theo số đơn bán, mã khách hàng, mã số thuế (QUYTAC_NGHIEPVU_116).
  5. Kế toán mở "Giao dịch ngân hàng" (mặc định lọc "Chưa ghép") và xử lý từng giao dịch:
     - "Lập phiếu thu": chọn hoặc giữ khách gợi ý, bấm "Xác nhận lập phiếu thu". Hệ thống lập, gửi phiếu thu; phiếu ghi sổ thì giao dịch "Đã ghép"; phiếu chờ duyệt thì giao dịch ghép khi phiếu ghi sổ.
     - "Ghép tay": chọn một phiếu trong danh sách phiếu đủ điều kiện, bấm "Ghép" (QUYTAC_NGHIEPVU_117).
     - "Bỏ qua": nhập lý do (phí ngân hàng, chuyển khoản nội bộ đã lập phiếu riêng...).
  6. Kế toán lập phiếu thu chi cho khoản chưa có chứng từ theo chức năng đã có; phiếu ghi sổ thì hệ thống thử ghép lại (QUYTAC_NGHIEPVU_115).
  7. Cuối kỳ, kế toán chọn quỹ, khoảng ngày; ô đối chiếu hiện số dư sổ, số dư ngân hàng, chênh lệch, giao dịch chưa ghép hai chiều, số giao dịch bỏ qua, phiếu chưa có giao dịch.
- Ngoại lệ:
  - Sai khóa, kết nối không có hoặc đang tắt: 401, không lưu. Dữ liệu sai: 400. Khác số tài khoản của quỹ: 409. Webhook đúng khóa không bị giới hạn tần suất; quá 20 lần sai khóa mỗi phút từ một địa chỉ IP: 429.
  - Nhiều phiếu hoặc nhiều giao dịch cùng thỏa điều kiện: không tự ghép, kế toán ghép tay.
  - Ghép sai: "Bỏ ghép" đưa giao dịch về "Chưa ghép", phiếu không đổi. Bỏ qua nhầm: "Thôi bỏ qua".
  - Phiếu thu lập từ gợi ý bị sửa (quỹ, số tiền, loại, ngày) không còn khớp giao dịch: khi ghi sổ không ghép với giao dịch đó, bỏ liên kết; giao dịch xét tự ghép như thường.
  - Lần xác nhận trước gửi lỗi, còn phiếu nháp: xác nhận lại đặt lại phiếu nháp theo khách vừa chọn rồi gửi lại.
  - Phiếu thu lập từ gợi ý bị từ chối hoặc rút: giao dịch vẫn "Chưa ghép"; kế toán lập lại phiếu thu, ghép tay hoặc bỏ qua.
  - Dịch vụ không gửi số dư (bộ giả lập): ô đối chiếu hiện "Dịch vụ chưa gửi số dư", không có chênh lệch.
- Kết thúc: mọi giao dịch trong kỳ "Đã ghép" hoặc "Bỏ qua" có lý do; chênh lệch số dư bằng 0 hoặc đã giải thích được.

Trạng thái giao dịch ngân hàng:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Nhận webhook, tự ghép được | Đã ghép (`matched`), người ghép trống |
| (Chưa có) | Nhận webhook, không tự ghép được | Chưa ghép (`unmatched`) |
| Chưa ghép | Phiếu thu chi đủ điều kiện ghi sổ; phiếu thu lập từ gợi ý ghi sổ | Đã ghép |
| Chưa ghép | Ghép tay | Đã ghép, người ghép là người thao tác |
| Chưa ghép | Bỏ qua kèm lý do | Bỏ qua (`ignored`) |
| Đã ghép | Bỏ ghép | Chưa ghép; phiếu không đổi |
| Bỏ qua | Thôi bỏ qua | Chưa ghép |

## MODULE_06 Tài chính – Kế toán (phần 7: Đối soát thu hộ COD, cổng thanh toán, CONG_VIEC_19)

### Luồng 31. Đối soát thu hộ COD, cổng thanh toán

- Bắt đầu: Kế toán trưởng mở "Đối soát thu hộ", thẻ "Đơn vị thu hộ", bấm "Thêm đơn vị thu hộ", chọn đối tác có hồ sơ khách hàng (nhà vận chuyển, cổng thanh toán), loại "Thu COD" hoặc "Cổng thanh toán", bấm "Lưu" (QUYTAC_NGHIEPVU_118).
- Các bước:
  1. Đơn vị thu hộ gửi bảng đối soát (đơn đã thu, tiền thu hộ, phí). Kế toán bấm "Tải tệp mẫu", chép dữ liệu vào mẫu chung.
  2. Kế toán bấm "Nhập tệp", chọn đơn vị thu hộ, nhập số bảng của đơn vị, ngày bảng, chọn tệp, bấm "Nhập tệp". Tệp sai mẫu hoặc có ô sai: từ chối cả tệp, báo từng dòng, cột (QUYTAC_NGHIEPVU_118).
  3. Hệ thống lưu bảng nháp, ghép từng dòng với đơn bán theo số đơn, tính tổng tiền thu hộ, tổng phí, thực nhận; mở chi tiết bảng. Dòng lỗi (không tìm thấy đơn, đơn đã hủy, mã trùng, mã đã dùng) và cảnh báo (tiền thu hộ thiếu hoặc thừa so với số khách còn nợ) hiện trên từng dòng (QUYTAC_NGHIEPVU_119).
  4. Kế toán sửa lỗi bằng "Bỏ dòng" hoặc "Nhập lại tệp" (thay toàn bộ dòng).
  5. Kế toán bấm "Gửi": cấp số `DST…`, gửi duyệt theo chính sách duyệt loại `finance.collection_statement`; chưa có chính sách thì ghi sổ ngay (QUYTAC_NGHIEPVU_122).
  6. Người duyệt duyệt: hệ thống ghi sổ: trừ nợ khách theo đơn (thừa thành trả trước), lập khoản phải thu của đơn vị thu hộ bằng thực nhận, bút toán Nợ 1388 / Có 131, Nợ phí thu hộ / Có 1388; khoản trừ nợ khách ghi phát sinh hoa hồng như phiếu thu (QUYTAC_NGHIEPVU_120, QUYTAC_NGHIEPVU_121).
  7. Đơn vị thu hộ chuyển tiền về ngân hàng: kế toán lập phiếu thu khách hàng cho đối tác của đơn vị thu hộ, số tiền thực nhận; phiếu ghi sổ trừ vào khoản phải thu của đơn vị, bút toán Nợ tiền gửi / Có 1388; đối soát ngân hàng tự ghép giao dịch với phiếu (Luồng 30, QUYTAC_NGHIEPVU_115).
- Ngoại lệ:
  - Còn dòng lỗi: không gửi được, "Bảng đối soát còn dòng lỗi; bỏ dòng hoặc nhập lại tệp.".
  - Mã vận đơn đã có trong bảng chờ duyệt hoặc đã ghi sổ của cùng đơn vị: dòng lỗi "Mã đã có ở bảng khác".
  - Số bảng đã có với đơn vị (bảng chưa bị từ chối, chưa rút): "Số bảng đối soát đã có với đơn vị thu hộ này."; đơn vị thu hộ ngừng dùng: không nhập được.
  - Bị từ chối, người gửi rút: sửa (nhập lại, bỏ dòng) rồi gửi lại, giữ số bảng.
  - Duyệt xong mà không ghi sổ được (kỳ đã khóa sổ, dòng mới bị lỗi vì bảng khác đã dùng mã, thiếu định khoản): bảng "Bị từ chối" kèm lý do; kỳ đã khóa thì nhập lại với ngày bảng khác.
  - Bảng nháp nhập nhầm, chưa gửi lần nào: "Bỏ bảng nháp".
  - Thực nhận âm (phí lớn hơn tiền thu hộ): giảm khoản phải thu của đơn vị thu hộ.
  - Bảng đã ghi sổ sai: không hủy được; lập phiếu kế toán điều chỉnh.
- Kết thúc: bảng "Đã ghi sổ"; đơn đã thu không còn nợ (hoặc còn phần thiếu, hoặc khách có tiền trả trước); khoản phải thu của đơn vị thu hộ được trừ khi tiền về.

Trạng thái bảng đối soát thu hộ:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Nhập tệp | Nháp (`draft`) |
| Nháp (chưa gửi lần nào) | Bỏ bảng nháp | (Xóa bảng và dòng) |
| Nháp, Bị từ chối, Đã rút | Nhập lại, bỏ dòng | Giữ trạng thái |
| Nháp, Bị từ chối, Đã rút | Gửi, có chính sách duyệt | Chờ duyệt (`pending`) |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt | Đã ghi sổ (`posted`) |
| Chờ duyệt | Duyệt xong, ghi sổ được | Đã ghi sổ |
| Chờ duyệt | Duyệt xong, không ghi sổ được | Bị từ chối (`rejected`) kèm lý do |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người gửi rút | Đã rút (`withdrawn`) |

## MODULE_06 Tài chính – Kế toán (phần 8: Báo cáo tài chính hợp nhất, CONG_VIEC_20)

### Luồng 32. Lập báo cáo tài chính hợp nhất

- Bắt đầu: các công ty trong tập đoàn đã ghi sổ đủ trong kỳ. Kế toán trưởng có vai trò gán ở phạm vi tập đoàn mở "Báo cáo hợp nhất"; xem danh sách thành viên: công ty khác đồng tiền với công ty gốc, chưa khởi tạo kế toán hiện nhãn "Không hợp nhất" kèm lý do (QUYTAC_NGHIEPVU_123).
- Các bước:
  1. Thẻ "Xem nhanh cộng gộp" (không bắt buộc): chọn B01-DN hoặc B02-DN, từ ngày, đến ngày; hệ thống cộng gộp sổ cái các thành viên theo mã Thông tư 99, chưa loại trừ (QUYTAC_NGHIEPVU_124).
  2. Thẻ "Bảng hợp nhất": nhập từ ngày, đến ngày, bấm "Lập bảng hợp nhất". Hệ thống tạo bảng nháp, tính ngay: chốt danh sách thành viên, lập bút toán loại trừ công nợ nội bộ, trả trước nội bộ, doanh thu và giá vốn nội bộ, ước tính lãi chưa thực hiện, ghi cảnh báo chênh lệch công nợ; mở chi tiết bảng (QUYTAC_NGHIEPVU_125 đến QUYTAC_NGHIEPVU_128).
  3. Kế toán trưởng xem thẻ "Tình hình tài chính", "Kết quả kinh doanh" (cột cộng gộp, loại trừ, hợp nhất), thẻ "Bút toán loại trừ"; đối chiếu cảnh báo chênh lệch công nợ nội bộ với công ty liên quan.
  4. Thẻ "Lãi chưa thực hiện": bấm "Sửa" dòng cần sửa, nhập số dùng và lý do, bấm "Lưu"; hoặc "Dùng số ước tính" (QUYTAC_NGHIEPVU_127).
  5. Thẻ "Bút toán loại trừ": bấm "Thêm điều chỉnh tay", nhập diễn giải, các dòng mã tài khoản Thông tư 99, công ty (không bắt buộc), đối tác (bắt buộc với tài khoản lấy số dư theo đối tác như 131, 331), Nợ, Có (ví dụ Nợ 411 / Có 221 loại trừ khoản đầu tư vào công ty con), bấm "Lưu"; "Xóa" điều chỉnh tay khi nhập sai.
  6. Sổ các công ty thay đổi: bấm "Tính lại"; hệ thống lấy số mới, giữ số đã sửa và điều chỉnh tay.
  7. Bấm "Gửi": hệ thống tính lại theo sổ hiện tại, lưu số báo cáo, cấp số `HN…`, gửi duyệt theo chính sách duyệt loại `finance.consolidation` của công ty gốc; chưa có chính sách thì chốt số ngay (QUYTAC_NGHIEPVU_128).
  8. Người duyệt xem số đã lưu lúc gửi, duyệt: bảng "Đã ghi sổ" (đã chốt số) với số đó.
  9. Bấm xuất "Tình hình tài chính", "Kết quả kinh doanh" dạng Excel hoặc PDF (được ở mọi trạng thái; bảng đã chốt xuất số đã chốt).
- Ngoại lệ:
  - Không có quyền ở phạm vi tập đoàn: "Bạn không có quyền thực hiện thao tác này.", không thấy mục menu "Báo cáo hợp nhất".
  - Kỳ đã có bảng không bị từ chối, không rút (khi lập bảng hoặc gửi lại bảng bị từ chối, đã rút): "Kỳ này đã có bảng hợp nhất đang dùng."; mở bảng đó để tính lại.
  - Không có thành viên hợp nhất được: "Tập đoàn chưa có công ty nào hợp nhất được (cùng đồng tiền, đã khởi tạo kế toán).".
  - Công nợ, trả trước nội bộ hai bên lệch: chỉ loại trừ phần nhỏ hơn, hiện cảnh báo; kế toán đối chiếu, sửa sổ công ty rồi tính lại hoặc thêm điều chỉnh tay.
  - Bị từ chối, người gửi rút: sửa, tính lại rồi gửi lại, giữ số bảng.
  - Duyệt xong mà không chốt được (thiếu định khoản của thành viên): bảng "Bị từ chối" kèm lý do.
  - Bảng nháp lập nhầm, chưa gửi lần nào: "Bỏ bảng nháp" (xóa bảng, bút toán loại trừ, số đã sửa).
  - Bảng đã chốt số sai: không sửa, không tính lại; lập bảng mới cho kỳ khác hoặc điều chỉnh ở sổ công ty.
- Kết thúc: bảng đã chốt số; số báo cáo hợp nhất không đổi khi sổ các công ty thay đổi sau đó; không có bút toán nào ghi vào sổ các công ty.

Trạng thái bảng hợp nhất:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Lập bảng hợp nhất | Nháp (`draft`) |
| Nháp (chưa gửi lần nào) | Bỏ bảng nháp | (Xóa bảng, bút toán, dòng lãi) |
| Nháp, Bị từ chối, Đã rút | Tính lại, sửa lãi chưa thực hiện, thêm, xóa điều chỉnh tay | Giữ trạng thái |
| Nháp, Bị từ chối, Đã rút | Gửi, có chính sách duyệt | Chờ duyệt (`pending`) |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt | Đã chốt số (`posted`, nhãn "Đã ghi sổ") |
| Chờ duyệt | Duyệt xong, chốt được | Đã chốt số |
| Chờ duyệt | Duyệt xong, không chốt được | Bị từ chối (`rejected`) kèm lý do |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người gửi rút | Đã rút (`withdrawn`) |

## MODULE_07 Khách hàng và Đối tác (phần 2: Gán khách hàng cho nhân viên kinh doanh, CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): Luồng 33 không còn; người có quyền xem đối tác, đơn bán xem mọi đối tác, đơn bán của công ty; nhân viên phụ trách sửa bằng tay trên hồ sơ đối tác. Nội dung dưới đây giữ để tra cứu.

### Luồng 33. Giao, chuyển khách hàng cho nhân viên kinh doanh

- Bắt đầu: trưởng phòng (khách, nhân viên trong phòng mình quản lý) hoặc người có quyền `crm.customer.assign` (mọi khách, mọi nhân viên của công ty) cần giao khách chưa có người phụ trách hoặc chuyển khách sang nhân viên khác (nhân viên nghỉ việc, đổi địa bàn) (QUYTAC_NGHIEPVU_131).
- Các bước:
  1. Mở mini app Khách hàng và Đối tác, mục menu "Giao khách hàng", bấm "Lập phiếu giao khách".
  2. Chọn nhân viên nhận, nhập lý do; tìm khách (tên, mã, mã số thuế, điện thoại), bấm "Thêm" từng khách (hiện nhân viên đang phụ trách); bấm "Lưu" (phiếu nháp). Khách ngoài phạm vi giao, khách đã do nhân viên nhận phụ trách báo lỗi tại từng khách.
  3. Bấm "Gửi": hệ thống khóa hồ sơ các khách, kiểm lại phạm vi, ghi nhân viên phụ trách lúc gửi, cấp số `GK…`, gửi duyệt theo chính sách duyệt loại `crm.customer_assignment` của công ty; chưa có chính sách thì áp dụng ngay (QUYTAC_NGHIEPVU_132).
  4. Người duyệt duyệt phiếu.
  5. Hệ thống áp dụng: kiểm nhân viên nhận còn làm việc, mỗi khách còn đúng nhân viên phụ trách lúc gửi và còn giao dịch; đổi nhân viên phụ trách trong hồ sơ, đóng dòng lịch sử cũ, mở dòng mới kèm số phiếu; báo cho nhân viên nhận và nhân viên cũ (QUYTAC_NGHIEPVU_133).
  6. Nhân viên nhận thấy khách trong danh sách đối tác (lọc "Khách của tôi"), chọn được khách khi lập đơn bán; nhân viên cũ không còn thấy khách (trừ đơn mình lập hoặc hưởng hoa hồng).
- Luồng phụ:
  - Nhân viên bán hàng thêm đối tác mới: hệ thống tự lập hồ sơ khách hàng do mình phụ trách, thanh toán ngay, hạn mức 0 (QUYTAC_NGHIEPVU_135).
  - Nhân viên bán hàng nhập mã số thuế, số Căn cước công dân trùng đối tác đã có trong tập đoàn mà công ty chưa có hồ sơ: bấm "Nhận làm khách của tôi"; hệ thống lập hồ sơ như trên (QUYTAC_NGHIEPVU_135).
  - Người có quyền quản lý hồ sơ đặt nhân viên phụ trách cho khách chưa có trên hồ sơ đối tác; ghi lịch sử (QUYTAC_NGHIEPVU_134).
- Ngoại lệ:
  - Không phải trưởng phòng và không có quyền giao khách: không thấy nút "Lập phiếu giao khách"; mở trang lập phiếu báo "Bạn không phải trưởng phòng và không có quyền giao khách.".
  - Trong lúc chờ duyệt có khách đổi nhân viên phụ trách (phiếu khác áp dụng trước, hồ sơ được đặt người phụ trách) hoặc ngừng giao dịch: phiếu "Bị từ chối" kèm "Khách đã đổi: …"; người lập bỏ khách đó, sửa rồi gửi lại (giữ số phiếu).
  - Nhân viên nhận ngừng làm việc ở công ty trong lúc chờ duyệt: phiếu "Bị từ chối" kèm "Nhân viên nhận đã ngừng làm việc ở công ty.".
  - Không có chính sách duyệt mà áp dụng không được: báo lỗi, phiếu giữ nguyên trạng thái trước khi gửi.
  - Bị từ chối, người gửi rút: sửa (phiếu về nháp), gửi lại, giữ số phiếu.
  - Phiếu nháp lập nhầm, chưa gửi lần nào: "Bỏ phiếu nháp".
  - Đổi, bỏ nhân viên phụ trách trên hồ sơ khi khách đã có người phụ trách: "Khách đã có nhân viên phụ trách; đổi nhân viên bằng phiếu giao khách.".
  - Đối tác đã có hồ sơ tại công ty do người khác phụ trách: nhân viên không tự nhận được, đề nghị trưởng phòng hoặc người có quyền giao khách lập phiếu.
- Kết thúc: phiếu "Đã áp dụng"; khách có nhân viên phụ trách mới, lịch sử phụ trách ghi đủ; đơn bán đã gán nhân viên hưởng hoa hồng giữ nguyên, đơn gửi sau gán theo nhân viên mới.

Trạng thái phiếu giao khách:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Lưu phiếu mới | Nháp (`draft`) |
| Nháp (chưa gửi lần nào) | Bỏ phiếu nháp | (Xóa phiếu) |
| Nháp, Bị từ chối, Đã rút | Sửa | Nháp |
| Nháp, Bị từ chối, Đã rút | Gửi, có chính sách duyệt | Chờ duyệt (`pending`) |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt, áp dụng được | Đã áp dụng (`applied`) |
| Nháp, Bị từ chối, Đã rút | Gửi, chưa có chính sách duyệt, áp dụng không được | Giữ trạng thái (báo lỗi) |
| Chờ duyệt | Duyệt xong, áp dụng được | Đã áp dụng |
| Chờ duyệt | Duyệt xong, áp dụng không được | Bị từ chối (`rejected`) kèm lý do |
| Chờ duyệt | Từ chối | Bị từ chối |
| Chờ duyệt | Người gửi rút | Đã rút (`withdrawn`) |

## MODULE_09 Sàn thương mại điện tử (phần lõi 1: Tài khoản người mua, CONG_VIEC_23)

### Luồng 35. Đăng ký người mua qua giới thiệu, đánh dấu nhân viên kinh doanh

1. Người giới thiệu mở Tài khoản trên ứng dụng VComm, chia sẻ đường dẫn `<địa chỉ ứng dụng>/r/<số điện thoại>` hoặc đọc mã (số điện thoại).
2. Khách mở đường dẫn: màn hình đăng ký có mã giới thiệu điền sẵn. Khách nhập số điện thoại, bấm Gửi mã.
3. Hệ thống kiểm số chưa có tài khoản, gửi OTP qua SMS (eSMS).
4. Khách nhập OTP, họ tên, mật khẩu, bấm Tạo tài khoản. Hệ thống kiểm mã giới thiệu trước, rồi mã OTP; tạo tài khoản, ghi người giới thiệu và lịch sử; trả phiên ứng dụng.
5. Quản trị công ty vận hành sàn mở web-crm, Người mua VComm, chọn tài khoản, chọn phòng ban, bấm Đánh dấu nhân viên kinh doanh.
6. Người được đánh dấu thấy phần Kinh doanh trên ứng dụng: khách mình phụ trách là những người mình đang là người giới thiệu.

Nhánh: mã giới thiệu sai thì báo lỗi ở ô mã, khách sửa rồi gửi lại với cùng mã OTP. Số đã có tài khoản thì báo và gợi ý đăng nhập. Khách không có mã vẫn đăng ký được, sau đó tự nhập mã một lần ở Tài khoản. Quản trị đổi người giới thiệu kèm lý do.

## MODULE_09 Sàn thương mại điện tử (phần lõi 1b: Đội kinh doanh nhiều cấp, CONG_VIEC_27)

### Luồng 36. Xây dựng đội kinh doanh nhiều cấp

1. Quản trị công ty vận hành sàn mở web-crm, Đội kinh doanh; gắn loại cho phòng ban: Khối kinh doanh, Vùng, Phòng kinh doanh.
2. Quản trị đánh dấu Giám đốc Kinh doanh vào Khối, bổ nhiệm làm quản lý Khối.
3. Giám đốc Kinh doanh mở ứng dụng VComm, Kinh doanh, Đề xuất thay đổi đội: thêm người (số điện thoại) vào một Vùng trong nhánh; bổ nhiệm người đó làm quản lý Vùng.
4. Quản trị mở Đề xuất đội kinh doanh, duyệt: thay đổi áp dụng ngay, người đề xuất nhận thông báo.
5. Lặp lại cho Trưởng phòng, Nhân viên. Người quản lý xem Đội của tôi và khách của từng cấp dưới.

Nhánh: điều kiện không còn đúng lúc duyệt (người đề xuất không còn quản lý, người được đề xuất đã chuyển đi) thì báo lỗi, đề xuất vẫn chờ để quản trị từ chối. Quản trị có thể thay đổi trực tiếp không qua đề xuất.

## MODULE_09 Sàn thương mại điện tử (phần lõi 2: Đặt hàng trên VComm, CONG_VIEC_24)

### Luồng 37. Đặt hàng, giao hàng, trả hàng, hoàn tất đơn VComm

- Bắt đầu: quản trị công ty vận hành sàn đã cài đặt bán hàng VComm (kênh bán, kho xuất, phí), bật đơn vị vận chuyển, đăng bán sản phẩm (web-crm).
- Các bước:
  1. Người mua mở ứng dụng VComm, thẻ Cửa hàng, xem sản phẩm, chọn phân loại, số lượng, thêm vào giỏ (QUYTAC_NGHIEPVU_155, 157).
  2. Người mua mở Giỏ hàng, chọn dòng, bấm "Đặt hàng"; chọn hoặc thêm địa chỉ nhận (QUYTAC_NGHIEPVU_156); xem tiền hàng, phí giao hàng, tổng thanh toán khi nhận hàng; bấm "Đặt hàng" (QUYTAC_NGHIEPVU_158). Đơn ở Chờ giao, hàng được giữ.
  3. Nhân viên VComm mở Đơn VComm, chọn đơn vị vận chuyển, bấm "Giao cho đơn vị vận chuyển": phiếu xuất nháp lập, vận đơn tạo, đơn Chờ lấy hàng (QUYTAC_NGHIEPVU_159, 160).
  4. Đơn vị vận chuyển báo trạng thái qua webhook (hoặc nhân viên bấm "Tra lại vận đơn"): lấy hàng thì phiếu xuất ghi sổ, đơn Đang giao; giao thành công thì đơn Đã giao.
  5. Trong 7 ngày, người mua có thể gửi yêu cầu trả hàng (dòng, số lượng, lý do, ảnh); nhân viên duyệt hoặc từ chối; người mua gửi hàng về; nhân viên bấm "Đã nhận hàng trả" (phiếu nhận hàng trả lại ghi sổ) hoặc "Không nhận được hàng" (QUYTAC_NGHIEPVU_161).
  6. Hết 7 ngày, không còn yêu cầu chờ duyệt hoặc đã duyệt: việc nền chuyển đơn sang Hoàn tất, lưu giá trị hoàn tất (QUYTAC_NGHIEPVU_162).
- Nhánh: người mua hoặc nhân viên hủy ở Chờ giao, Chờ lấy hàng (hủy vận đơn trước); đơn vị vận chuyển hủy vận đơn trước khi lấy hàng thì đơn hủy; giao thất bại, hàng hoàn về thì phiếu nhận hàng trả lại ghi sổ, đơn hủy; bất thường, mất hàng thì ghi lịch sử, đơn giữ trạng thái.
- Ngoại lệ: thông báo ở tài liệu `07` mục CONG_VIEC_24.
- Kết thúc: đơn Hoàn tất (cơ sở hoa hồng, CONG_VIEC_26) hoặc Đã hủy.

Trạng thái đơn VComm:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua đặt hàng | Chờ giao (`awaiting_shipment`) |
| Chờ giao | Nhân viên giao cho đơn vị vận chuyển | Chờ lấy hàng (`awaiting_pickup`) |
| Chờ giao, Chờ lấy hàng | Người mua, nhân viên hủy; đơn vị vận chuyển hủy vận đơn (từ Chờ lấy hàng) | Đã hủy (`cancelled`) |
| Chờ lấy hàng | Đơn vị vận chuyển lấy hàng | Đang giao (`shipping`) |
| Chờ lấy hàng, Đang giao | Giao thành công | Đã giao (`delivered`) |
| Đang giao | Hàng hoàn về | Đã hủy |
| Đang giao | Bất thường, hư hỏng, mất hàng | Giữ trạng thái (ghi lịch sử) |
| Đã giao | Qua 7 ngày, không còn yêu cầu trả hàng đang xử lý | Hoàn tất (`completed`) |

Trạng thái yêu cầu trả hàng:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua gửi | Chờ duyệt (`pending`) |
| Chờ duyệt | Người mua rút | Đã rút (`withdrawn`) |
| Chờ duyệt | Nhân viên duyệt | Đã duyệt (`approved`) |
| Chờ duyệt | Nhân viên từ chối | Từ chối (`rejected`) |
| Đã duyệt | Nhân viên nhận hàng trả | Đã nhận hàng trả (`received`) |
| Đã duyệt | Nhân viên báo không nhận được hàng | Không nhận được hàng (`not_received`) |

## MODULE_09 Sàn thương mại điện tử (phần lõi 3: Thanh toán đơn người mua, CONG_VIEC_25)

### Luồng 38. Thanh toán, đối soát tiền thu, hoàn tiền đơn VComm

- Bắt đầu: máy chủ có thông tin kết nối VNPAY ở biến môi trường; quản trị (`marketplace.order.manage`) bật phương thức thanh toán, bật "Mở đặt hàng" ở Cài đặt bán hàng VComm (QUYTAC_NGHIEPVU_163, 164).
- Các bước:
  1. Người mua đặt hàng như Luồng 37, chọn phương thức thanh toán đang bật (QUYTAC_NGHIEPVU_158). Thanh toán khi nhận hàng: đơn Chờ giao như Luồng 37. Thanh toán trực tuyến: đơn Chờ thanh toán, giữ hàng, hạn 15 phút (QUYTAC_NGHIEPVU_165).
  2. Ứng dụng mở trang VNPAY (tạo lần thanh toán mới); người mua trả tiền trên trang VNPAY; VNPAY chuyển người mua về trang kết quả (chỉ hiển thị) có liên kết mở lại đơn.
  3. VNPAY gửi kết quả (IPN): đúng chữ ký, đúng số tiền thì ghi lần thanh toán thành công, tiền đã thu, bút toán tiền thu; đơn chuyển Chờ giao (QUYTAC_NGHIEPVU_166, 169).
  4. Giao hàng như Luồng 37; phiếu xuất ghi sổ có bút toán phí giao hàng, hóa đơn điện tử có dòng "Phí giao hàng" (QUYTAC_NGHIEPVU_169). Đơn COD: GHN báo đã thu tiền người mua thì ghi đã thu; hoặc kế toán ghi tay "Đã thu COD" (QUYTAC_NGHIEPVU_167).
  5. Đơn đã thu bị hủy, hoặc kho nhận hàng trả: lập việc chờ hoàn tiền; ứng dụng nhắc người mua nhập tài khoản nhận hoàn tiền (QUYTAC_NGHIEPVU_168).
  6. Kế toán mở Hoàn tiền (web-crm), chuyển khoản theo tài khoản người mua, bấm "Đã hoàn tiền" (mã giao dịch, ngày); bút toán hoàn tiền; người mua nhận thông báo.
- Nhánh: thanh toán không thành công thì người mua bấm "Thanh toán lại" trong thời hạn (tối đa 10 lần); quá hạn chưa thu thì việc nền hủy đơn, nhả hàng; người mua tự hủy đơn Chờ thanh toán; tiền về sau khi đơn đã hủy hoặc trả trùng thì lập việc chờ hoàn.
- Ngoại lệ: thông báo ở tài liệu `07` mục CONG_VIEC_25; IPN sai chữ ký trả `97`, không tìm thấy `01`, sai số tiền `04`, đã xác nhận `02`.
- Kết thúc: đơn Đã thu (tiếp Luồng 37) hoặc Đã hủy; việc hoàn tiền Đã hoàn.

Trạng thái đơn VComm (bổ sung Luồng 37):

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua đặt hàng, thanh toán trực tuyến | Chờ thanh toán (`awaiting_payment`) |
| Chờ thanh toán | Cổng báo thành công đúng số tiền | Chờ giao (`awaiting_shipment`) |
| Chờ thanh toán | Người mua hủy; quá hạn thanh toán (bên hủy: hệ thống) | Đã hủy (`cancelled`) |

Trạng thái lần thanh toán:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua mở trang thanh toán | Chờ kết quả (`pending`) |
| Chờ kết quả | IPN báo thành công | Thành công (`succeeded`) |
| Chờ kết quả | IPN báo không thành công | Không thành công (`failed`) |

Trạng thái việc hoàn tiền:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Hủy đơn đã thu; tiền về sau khi hủy; trả trùng; nhận hàng trả | Chờ hoàn (`pending`) |
| Chờ hoàn | Kế toán ghi "Đã hoàn tiền" | Đã hoàn (`completed`) |

## MODULE_09 Sàn thương mại điện tử (phần lõi 4: Hoa hồng theo đơn và ví hoa hồng, CONG_VIEC_26)

### Luồng 39. Hoa hồng theo đơn, ví hoa hồng, rút tiền

- Bắt đầu: quản trị (`marketplace.order.manage`) thiết lập hoa hồng sản phẩm ở Đăng bán (MAN_HINH_101), cài đặt hoa hồng chung ở Cài đặt bán hàng VComm (MAN_HINH_86) (QUYTAC_NGHIEPVU_200, 204, 205).
- Các bước:
  1. Người mua có người giới thiệu đặt hàng như Luồng 37, 38. Trong cùng giao dịch đặt hàng, hệ thống chốt người hưởng, mức hoa hồng của từng dòng hàng (giới thiệu; đội kinh doanh theo chức danh khi người giới thiệu là nhân viên kinh doanh) (QUYTAC_NGHIEPVU_201).
  2. Trong khi đơn chưa hoàn tất: chi tiết đơn trên web hiện hoa hồng ước tính (MAN_HINH_88); ví của người hưởng hiện hoa hồng đang chờ (QUYTAC_NGHIEPVU_203).
  3. Đơn chuyển Hoàn tất (Luồng 37): tính hoa hồng theo hàng thực bán, cộng ví mỗi người hưởng một giao dịch, bút toán hoa hồng (QUYTAC_NGHIEPVU_202, 207).
  4. Người hưởng mở Ví hoa hồng trên ứng dụng (MAN_HINH_103), bấm "Rút tiền", nhập số tiền, xem thuế dự kiến, gửi yêu cầu (MAN_HINH_104); số dư trừ ngay (QUYTAC_NGHIEPVU_204, 205).
  5. Kế toán (`marketplace.payment.manage`) mở Rút tiền hoa hồng (MAN_HINH_102), duyệt (chốt thuế, số thực nhận); người dùng nhận thông báo (QUYTAC_NGHIEPVU_206).
  6. Kế toán chuyển khoản số thực nhận, ghi đã chi (mã giao dịch ngân hàng, ngày chi); bút toán chi trả, thuế; người dùng nhận thông báo (QUYTAC_NGHIEPVU_206, 207).
  7. Hằng tháng kế toán xem bảng kê thuế thu nhập cá nhân đã khấu trừ để kê khai ngoài hệ thống (QUYTAC_NGHIEPVU_205).
- Nhánh: người dùng rút lại yêu cầu chờ duyệt, hoặc kế toán từ chối (lý do), thì số tiền cộng lại ví; đơn bị hủy thì hoa hồng của đơn bỏ; người quản lý xem tổng hoa hồng đã nhận, đang chờ của từng cấp dưới ở Đội của tôi (MAN_HINH_83).
- Ngoại lệ: thông báo ở tài liệu `07` mục CONG_VIEC_26.
- Kết thúc: hoa hồng đã cộng ví; yêu cầu rút tiền Đã chi, Bị từ chối hoặc Đã rút lại.

Trạng thái hoa hồng của đơn:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua đặt đơn có người giới thiệu, sản phẩm đã thiết lập hoa hồng | Chờ (`pending`) |
| Chờ | Đơn hoàn tất | Đã cộng ví (`credited`) |

Đơn hủy thì dòng hoa hồng chờ giữ nguyên nhưng không hiện, không tính, không cộng ví.

Trạng thái yêu cầu rút tiền:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người dùng gửi yêu cầu (trừ số dư) | Chờ duyệt (`pending`) |
| Chờ duyệt | Người dùng rút lại (cộng lại số dư) | Đã rút lại (`cancelled`) |
| Chờ duyệt | Kế toán từ chối (cộng lại số dư) | Bị từ chối (`rejected`) |
| Chờ duyệt | Kế toán duyệt (chốt thuế, số thực nhận) | Đã duyệt (`approved`) |
| Đã duyệt | Kế toán ghi đã chi | Đã chi (`paid`) |

## Sửa theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

### Luồng 40. Đơn bán dịch vụ lập tay

- Bắt đầu: Kế toán (hoặc Kế toán trưởng, quản trị) mở "Lập đơn bán" ở mini app Bán hàng.
- Các bước:
  1. Lập đơn như Luồng 9; chỉ chọn mặt hàng dịch vụ (QUYTAC_NGHIEPVU_276).
  2. Gửi: kiểm lại mặt hàng; dòng dịch vụ không giữ hàng; ngoại lệ, duyệt như Luồng 9.
  3. Đơn "Đã xác nhận" (ngay hoặc sau duyệt): trong cùng giao dịch, hệ thống lập và ghi sổ một phiếu xuất dịch vụ (ngày xác nhận, số `XBH`, không ghi thẻ kho, không giá vốn) cho phần dịch vụ chưa giao; đơn chuyển "Đã giao đủ" khi mọi dòng đã đủ.
  4. Ghi sổ phiếu dịch vụ chạy như phiếu xuất thường: khoản phải thu, hóa đơn điện tử (khi công ty bật), bút toán Nợ phải thu / Có doanh thu cung cấp dịch vụ / Có thuế đầu ra.
- Ngoại lệ: đơn có hàng hóa khi cài đặt tắt: báo "Đơn bán lập tay chỉ gồm mặt hàng dịch vụ. Hàng hóa bán qua sàn VComm.", không lưu, không gửi. Kỳ ngày xác nhận đã khóa sổ: không xác nhận được. Đơn có cả hàng hóa (khi bật cài đặt): dịch vụ giao ngay, hàng hóa giao theo Luồng 10.
- Kết thúc: đơn "Đã giao đủ"; có công nợ, hóa đơn, bút toán; đơn có phiếu dịch vụ không hủy được (luật hiện có).

### Luồng 41. Giao dịch nội bộ dịch vụ

- Bắt đầu: công ty A lập đơn bán dịch vụ cho công ty B (Luồng 12), hoặc B lập đơn mua dịch vụ với A (Luồng 13).
- Các bước:
  1. Lập, gửi, sinh chứng từ đối ứng, bên kia xác nhận như Luồng 12, 13; mọi mặt hàng là dịch vụ (QUYTAC_NGHIEPVU_277); không giữ hàng.
  2. Khi đủ hai điều kiện đơn bán của A "Đã xác nhận" và đơn mua của B "Đã duyệt", trong cùng giao dịch hệ thống lập, ghi sổ phiếu xuất dịch vụ ở A và phiếu nhập dịch vụ ở B (không ghi thẻ kho, không phiếu nhập chờ nhận, không biên bản chênh lệch).
  3. Đơn bán "Đã giao đủ", đơn mua "Đã nhận đủ". A có khoản phải thu, hóa đơn điện tử, bút toán doanh thu dịch vụ; B có khoản phải trả, bút toán Nợ chi phí dịch vụ mua vào (6427 theo Thông tư 99, 6422 theo Thông tư 133) / Nợ thuế đầu vào / Có phải trả người bán.
- Ngoại lệ: hàng hóa trong giao dịch nội bộ khi công ty bán tắt cài đặt: báo "Giao dịch nội bộ chỉ gồm mặt hàng dịch vụ." tại dòng. Từ chối, hủy, kết thúc hai bên như Luồng 15a.
- Kết thúc: hai đơn đã giao, đã nhận đủ; công nợ hai bên khớp nhau.

Trạng thái bổ sung (CONG_VIEC_43):

| Từ | Sự kiện | Sang |
|---|---|---|
| Đơn bán Đã xác nhận | Phiếu xuất dịch vụ tự lập làm mọi dòng đủ số đặt (đơn chỉ dịch vụ; nội bộ thì khi đơn mua đối ứng đã duyệt) | Đã giao đủ |
| Đơn mua đối ứng nội bộ Đã duyệt | Phiếu nhập dịch vụ tự lập làm mọi dòng đủ số đặt | Đã nhận đủ |

Không còn trạng thái của bảng hoa hồng (Luồng 29) và phiếu giao khách (Luồng 33).

## MODULE_14 Bán lẻ tại quầy và trạm giao hàng (phần 1: Bán lẻ tại quầy, CONG_VIEC_53)

### Luồng 43. Bán, trả hàng, đóng ca tại quầy

- Bắt đầu: quản trị (`retail.setup`) đã cài đặt cửa hàng, quầy (MAN_HINH_166; QUYTAC_NGHIEPVU_368); kế toán đã khai ký hiệu hóa đơn máy tính tiền của năm khi công ty bật hóa đơn điện tử (QUYTAC_NGHIEPVU_378). Thu ngân (`retail.sale` tại chi nhánh của cửa hàng) mở màn hình Bán hàng (MAN_HINH_161).
- Các bước mở ca:
  1. Chưa có ca thì màn hình hiện phần mở ca (MAN_HINH_162): chọn cửa hàng, quầy đang hoạt động, xem gợi ý tiền cuối ca trước của quầy, nhập tiền đầu ca; khác gợi ý thì ghi chú (QUYTAC_NGHIEPVU_369).
  2. Hệ thống tạo ca "Đang mở"; tiền đầu ca không lập chứng từ quỹ.
- Các bước bán:
  1. Thu ngân quét mã vạch, serial hoặc gõ mã, tên rồi nhấn Enter; khớp đúng một mặt hàng thì thêm 1 đơn vị, quét lại cộng số lượng; hàng theo serial quét từng serial (QUYTAC_NGHIEPVU_370).
  2. Máy chủ tính giỏ: giá kênh của cửa hàng, khuyến mãi, hàng tặng, giảm tay (F4) trong mức, thuế, phải trả (QUYTAC_NGHIEPVU_371). Thu ngân nhập người mua lấy hóa đơn khi khách yêu cầu (F2) (QUYTAC_NGHIEPVU_372).
  3. Thu ngân bấm "Thanh toán" (F9): chọn tiền mặt (gợi ý mệnh giá, tiền thừa), chuyển khoản (mã VietQR, xác nhận đã nhận, mã giao dịch) hoặc kết hợp; bấm "Xác nhận thanh toán" (QUYTAC_NGHIEPVU_373).
  4. Trong một giao dịch, hệ thống tính lại tổng, ghi hóa đơn bán lẻ, đơn bán bán lẻ đã xác nhận, phiếu xuất đã ghi sổ (giá vốn, lô hết hạn trước, serial), bút toán, hóa đơn điện tử khởi tạo từ máy tính tiền (số cấp tại quầy, mã tra cứu) (QUYTAC_NGHIEPVU_374, 378).
  5. Màn hình hiện số hóa đơn; thu ngân bấm "In hóa đơn" (khổ 80 mm, MAN_HINH_167), "Đơn mới". Hóa đơn điện tử gửi nền đến cơ quan thuế qua nhà cung cấp trong ngày.
- Các bước trả hàng:
  1. Người có `retail.return`, có ca đang mở, bấm "Trả hàng" (MAN_HINH_164), quét mã QR hoặc gõ số hóa đơn bán lẻ; hệ thống kiểm cùng cửa hàng, trong hạn, cửa hàng có nhận trả (QUYTAC_NGHIEPVU_376).
  2. Chọn dòng, số trả (serial đã bán), lý do; hệ thống tính tiền hoàn theo tỷ lệ.
  3. Chọn hoàn tiền mặt từ ca (không vượt tiền mặt hệ thống tính của ca) hoặc chuyển khoản (người nhận, mã giao dịch), bấm "Xác nhận trả hàng".
  4. Trong một giao dịch, hệ thống ghi phiếu trả hàng bán lẻ, phiếu nhận hàng trả lại đã ghi sổ vào kho bán theo giá vốn lúc xuất, bút toán trả hàng, việc chờ xử lý hóa đơn điện tử cho kế toán (QUYTAC_NGHIEPVU_377); in phiếu trả hàng.
- Các bước đóng ca:
  1. Thu ngân (hoặc người có `retail.shift.manage`) mở "Đóng ca" (MAN_HINH_162): xem tổng theo phương thức (thu bán, hoàn trả hàng, thực thu), tiền mặt hệ thống tính; đếm tiền (bảng đếm theo mệnh giá không bắt buộc), nhập tiền đếm được, lý do khi lệch (QUYTAC_NGHIEPVU_375).
  2. Hệ thống đóng ca, lập và ghi sổ ngay theo từng quỹ: phiếu thu bán lẻ, phiếu chi hoàn tiền bán lẻ, phiếu chi thiếu tiền (1388, người mở ca chịu) hoặc phiếu thu thừa tiền (3381); bút toán đưa phải thu không đối tượng của ca về 0.
  3. Thu ngân in biên bản đóng ca; kế toán xem ca, chứng từ quỹ ở Ca thu ngân (MAN_HINH_165) và mini app Tài chính – Kế toán.
- Nhánh: thanh toán, trả hàng gửi lại cùng khóa yêu cầu (mạng chập chờn, bấm hai lần) thì trả về chứng từ đã ghi, không ghi trùng; người quản lý ca đóng ca của thu ngân vắng mặt; khách VComm dùng điểm, tích điểm, hoàn điểm khi trả hàng: chưa làm, chờ CONG_VIEC_51 (lát L6; QUYTAC_NGHIEPVU_379).
- Ngoại lệ: mất mạng thì màn hình báo, chặn thanh toán; giá, khuyến mãi đổi so với lúc xem thì báo tổng mới, không ghi; thiếu tiền, chuyển khoản vượt số phải trả, giảm tay vượt mức, dưới giá vốn, thiếu tồn, serial thiếu, năm chưa khai ký hiệu máy tính tiền, kỳ kế toán khóa, kho khóa kiểm kê thì chặn, không ghi gì; thông báo ở tài liệu `07` mục CONG_VIEC_53.
- Kết thúc: ca "Đã đóng"; mọi hóa đơn, phiếu trả của ca có phiếu kho, bút toán, hóa đơn điện tử; tiền đã vào quỹ bằng chứng từ quỹ đã ghi sổ.

Trạng thái ca thu ngân:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Thu ngân mở ca tại quầy chưa có ca mở | Đang mở (`open`) |
| Đang mở | Bán, trả hàng | Đang mở |
| Đang mở | Người mở ca hoặc người quản lý ca đóng ca (lập chứng từ quỹ) | Đã đóng (`closed`) |

Ca đã đóng không sửa, không mở lại. Hóa đơn bán lẻ, phiếu trả hàng bán lẻ không có trạng thái (ghi xong là hoàn tất, không sửa, không hủy).

## MODULE_14 Bán lẻ tại quầy và trạm giao hàng (phần 2: Trạm giao hàng O2O, CONG_VIEC_57)

### Luồng 53. Đơn VComm nhận tại trạm hoặc trạm giao

- Bắt đầu: quản trị (`retail.setup`) của công ty vận hành sàn đã cài đặt trạm cho cửa hàng hoặc điểm giao nhận: bật nhận tại trạm hoặc trạm giao, thông tin hiện cho khách, số ngày giữ hàng; trạm giao có xã được giao, phí giao, mức miễn phí (MAN_HINH_191; QUYTAC_NGHIEPVU_418 đến 420). Người mua mở màn hình Đặt hàng trên ứng dụng VComm (MAN_HINH_192).
- Các bước đặt hàng:
  1. Người mua chọn hàng, chọn địa chỉ trong sổ địa chỉ (bắt buộc), chọn cách nhận "Giao qua đơn vị vận chuyển", "Nhận tại trạm" hoặc "Trạm giao tận nơi" (QUYTAC_NGHIEPVU_421).
  2. Với cách nhận của trạm, hệ thống hiện trạm đang bật cách nhận đó, kho trạm đủ tồn khả dụng cho mọi dòng (gồm hàng tặng), trạm giao chỉ khi có xã của địa chỉ; cùng xã, cùng tỉnh trước, lọc theo tỉnh. Không trạm nào đủ hàng thì chỉ cho chọn đơn vị vận chuyển.
  3. Người mua chọn trạm; hệ thống tính giá, khuyến mãi theo kênh VComm, phí giao (nhận tại trạm bằng 0; trạm giao theo cài đặt trạm) (QUYTAC_NGHIEPVU_422).
  4. Người mua chọn thanh toán trực tuyến đang bật hoặc "Thanh toán khi nhận tại trạm" (không có thanh toán khi nhận hàng qua đơn vị vận chuyển) (QUYTAC_NGHIEPVU_423), bấm "Đặt hàng".
  5. Hệ thống ghi đơn có cách nhận, trạm, kho xuất là kho trạm; giữ hàng tại kho trạm (kho trạm không còn đủ thì chặn, báo chọn trạm khác); báo nhân viên có `retail.o2o` của trạm (QUYTAC_NGHIEPVU_422, 429). Đơn trả trước chờ thanh toán, quá hạn 15 phút thì hủy như hiện có; thanh toán xong thì đơn Chờ soạn hàng.
- Các bước nhận tại trạm:
  1. Nhân viên trạm (`retail.o2o` tại chi nhánh của trạm) mở Đơn trực tuyến (MAN_HINH_188), bấm "In phiếu soạn hàng", soạn hàng, bấm "Đã soạn xong" (QUYTAC_NGHIEPVU_424).
  2. Hệ thống chuyển đơn Sẵn sàng nhận, cấp mã nhận hàng 6 số (không trùng trong trạm), hạn giữ đến 23 giờ 59 của ngày thứ N; hàng vẫn giữ tại kho trạm; báo người mua trong ứng dụng và Zalo ZNS (không gửi mã) (QUYTAC_NGHIEPVU_425, 429).
  3. Người mua xem mã 6 số, mã QR trong chi tiết đơn (MAN_HINH_193), đến trạm đưa mã.
  4. Nhân viên mở Giao cho khách (MAN_HINH_189), quét hoặc nhập mã, xem dòng hàng, số còn phải thu; đơn chưa thu đủ thì thu tiền mặt, VietQR hoặc kết hợp trong ca đang mở của chính mình tại quầy của trạm; bấm "Giao cho khách" (F9) (QUYTAC_NGHIEPVU_426).
  5. Trong một giao dịch, hệ thống lập và ghi sổ phiếu xuất giao hàng tại kho trạm (dùng hàng giữ, giá vốn, bút toán như đơn VComm), ghi đã thu của đơn, khoản thu tại trạm gắn ca, đơn Đã giao; nhân viên in phiếu giao hàng khổ 80 mm. Hóa đơn điện tử theo luồng đơn VComm hiện có.
- Các bước trạm giao tận nơi:
  1. Đơn Sẵn sàng nhận: Cửa hàng trưởng (người có `retail.o2o`) bấm "Giao cho nhân viên" chọn nhân viên có `retail.o2o.deliver`, hoặc nhân viên giao tự nhận ở Đơn tôi đang giao (MAN_HINH_190) (QUYTAC_NGHIEPVU_427).
  2. Nhân viên giao bấm "Nhận đi giao"; đơn chưa thu tiền thì phải có ca đang mở của mình tại quầy của trạm. Đơn Đang giao; báo người mua.
  3. Giao thành công: nhân viên nhập mã khách đọc hoặc quét mã QR, thu tiền vào ca của mình như bước 4 của nhận tại trạm; hệ thống ghi như bước 5, đơn Đã giao. Phiếu xuất ghi sổ lúc này, không ghi khi nhân viên mang hàng đi.
  4. Không giao được: nhân viên chọn lý do (khách vắng, khách từ chối nhận, sai địa chỉ, khác kèm ghi chú); đơn về Sẵn sàng nhận, cộng số lần giao, bỏ nhân viên giao, ghi lịch sử; khách từ chối nhận hoặc đủ 3 lần không thành công thì hủy, báo người mua.
- Các bước hết hạn giữ (việc nền mỗi giờ): đơn Sẵn sàng nhận còn 24 giờ tới hạn giữ thì nhắc người mua một lần; quá hạn giữ thì hệ thống hủy, nhả giữ hàng, mã hết hiệu lực, lập việc hoàn phần đã thu trực tuyến, báo người mua. Đơn Đang giao không tự hủy (QUYTAC_NGHIEPVU_428).
- Các bước đóng ca: tiền mặt thu đơn trực tuyến (đã trừ tiền thừa) cộng vào tiền mặt hệ thống tính; phiếu thu theo quỹ gồm cả khoản thu đơn trực tuyến; biên bản đóng ca có dòng "Thu đơn trực tuyến" (QUYTAC_NGHIEPVU_431; Luồng 43).
- Các bước trả hàng:
  1. Người mua gửi yêu cầu trả hàng như Luồng 37; nhân viên vận hành duyệt; thông báo duyệt và chi tiết đơn ghi trạm của đơn (tên, địa chỉ, giờ mở cửa) là nơi mang hàng trả (QUYTAC_NGHIEPVU_430).
  2. Người mua mang hàng đến trạm; nhân viên trạm (`retail.o2o`) mở Nhận hàng trả (MAN_HINH_194), bấm "Đã nhận hàng trả".
  3. Trong một giao dịch, hệ thống ghi sổ phiếu nhận hàng trả lại vào kho trạm theo giá vốn lúc xuất, lập việc chờ hoàn tiền theo luồng hoàn tiền VComm, yêu cầu Đã nhận hàng trả, báo người mua.
  4. Người mua không mang hàng đến: nhân viên vận hành sàn kết thúc yêu cầu bằng "Không nhận được hàng" (không nhập kho).
- Nhánh: khách hủy, nhân viên trạm hủy (lý do) khi Chờ soạn hàng hoặc Sẵn sàng nhận (đơn Đang giao kết thúc bằng giao thành công hoặc không giao được); hủy thì nhả giữ hàng, mã hết hiệu lực, hoàn phần đã thu (QUYTAC_NGHIEPVU_424). Nhân viên vận hành sàn xem đơn của trạm, lọc theo cách nhận, trạm; không giao cho đơn vị vận chuyển, không hủy, không nhận hàng trả thay trạm (QUYTAC_NGHIEPVU_431).
- Ngoại lệ: trạm hết hàng, tắt cách nhận lúc đặt thì chặn, báo chọn trạm khác; đơn mua chung chỉ giao qua đơn vị vận chuyển; mã sai thì báo, sai 5 lần khóa nhập mã đơn đó 15 phút; đơn chưa thu tiền mà không có ca đang mở của chính người giao tại quầy của trạm thì chặn; thông báo ở tài liệu `07` mục CONG_VIEC_57.
- Kết thúc: đơn Đã giao rồi Hoàn tất như Luồng 37 (tồn kho trạm giảm, giá vốn, doanh thu, tiền thu tại trạm vào quỹ qua đóng ca), hoặc Đã hủy (hàng nhả về tồn khả dụng của kho trạm, tiền đã thu trực tuyến có việc hoàn tiền).

Trạng thái đơn của trạm (bổ sung trạng thái đơn VComm ở Luồng 37):

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua đặt đơn có trạm, thanh toán khi nhận tại trạm | Chờ soạn hàng (`awaiting_shipment`) |
| (Chưa có) | Người mua đặt đơn có trạm, thanh toán trực tuyến | Chờ thanh toán (`awaiting_payment`), thanh toán xong thì Chờ soạn hàng |
| Chờ soạn hàng | Nhân viên trạm bấm "Đã soạn xong" (cấp mã, hạn giữ) | Sẵn sàng nhận (`ready_for_pickup`) |
| Sẵn sàng nhận | Giao tại trạm bằng mã, thu tiền (nhận tại trạm) | Đã giao (`delivered`) |
| Sẵn sàng nhận | Nhân viên giao nhận đi giao (trạm giao) | Đang giao (`shipping`) |
| Đang giao | Giao thành công bằng mã, thu tiền | Đã giao |
| Đang giao | Không giao được, chưa đủ 3 lần, khách không từ chối | Sẵn sàng nhận |
| Đang giao | Không giao được do khách từ chối nhận hoặc lần thứ 3 | Đã hủy (`cancelled`) |
| Chờ soạn hàng, Sẵn sàng nhận | Người mua hủy; nhân viên trạm hủy (lý do) | Đã hủy |
| Sẵn sàng nhận | Quá hạn giữ (việc nền) | Đã hủy |
| Đã giao | Qua 7 ngày, không còn yêu cầu trả hàng đang xử lý | Hoàn tất (`completed`) |

Đơn của trạm không qua Chờ lấy hàng (`awaiting_pickup`), không có vận đơn. Yêu cầu trả hàng của đơn của trạm dùng trạng thái như Luồng 37; "Đã nhận hàng trả" do trạm ghi.

## MODULE_08 Nhân sự (phần 2: Ca làm, chấm công, nghỉ phép, tăng ca, bảng công tháng, CONG_VIEC_47)

### Luồng 46. Chấm công, nghỉ phép, tăng ca, chốt bảng công tháng

- Bắt đầu: quản trị tập đoàn khai báo ngày lễ năm; nhân sự công ty (`hr.attendance.manage`) khai báo ca, lịch tuần mặc định, lịch phòng ban, cài đặt chấm công, địa điểm chấm công (GPS, mạng công ty, mã QR động), mã chấm công của hồ sơ; nhân sự (`hr.leave.manage`) chọn chế độ phép, nhập số dư phép ban đầu (MAN_HINH_120, 123; QUYTAC_NGHIEPVU_302 đến 304, 307, 308).
- Các bước:
  1. Trưởng phòng hoặc nhân sự xếp ca tuần tới; người lao động xem lịch ca trên Chấm công của tôi (MAN_HINH_120, 122; QUYTAC_NGHIEPVU_303).
  2. Hằng ngày người lao động bấm Vào ca, Ra ca trên điện thoại (hoặc quét mã QR tại địa điểm) hoặc chấm máy; nhân sự nhập tệp máy chấm công, ghi thủ công khi cần; hệ thống tính công ngày (MAN_HINH_121, 122; QUYTAC_NGHIEPVU_304, 305).
  3. Quên chấm, đi công tác: người lao động lập đơn giải trình → luồng duyệt → lượt giải trình, công cập nhật (QUYTAC_NGHIEPVU_306).
  4. Nghỉ: người lao động xem số dư, lập đơn nghỉ → luồng duyệt → công các ngày ghi nghỉ, sổ phép trừ; nhân sự ghi nhận nghỉ ốm, thai sản kèm giấy tờ, có hiệu lực ngay (MAN_HINH_122, 123; QUYTAC_NGHIEPVU_309).
  5. Tăng ca: trưởng phòng lập phiếu → người lao động đồng ý trên ứng dụng (hoặc tự lập) → luồng duyệt → hôm đó chấm công → giờ tăng ca tính theo thời gian có mặt (MAN_HINH_124, 122; QUYTAC_NGHIEPVU_310).
  6. Đầu tháng sau nhân sự (`hr.timesheet.manage`) rà soát bảng công, mở xác nhận có hạn → người lao động xác nhận hoặc giải trình → nhân sự sửa dữ liệu, trả lời → hết hạn hệ thống tự xác nhận (MAN_HINH_125, 122; QUYTAC_NGHIEPVU_311).
  7. Nhân sự chốt bảng công: khóa dữ liệu tháng, trừ phép tháng không đủ 50% công, thanh toán phép người nghỉ việc, phát `hr.timesheet.closed`; CONG_VIEC_48 tính lương từ dòng bảng công.
- Nhánh: sai sau khi chốt mà bảng lương kỳ đó chưa chốt thì nhân sự mở lại (lý do), sửa, chốt lại; người lao động không đồng ý tăng ca thì phiếu kết thúc; người không có tài khoản thì nhân sự ghi nhận tăng ca kèm văn bản đồng ý.
- Ngoại lệ: vượt giới hạn giờ tăng ca, vượt số dư phép, trùng đơn, ghi dữ liệu tháng đã chốt, chấm ngoài địa điểm hoặc mã QR hết hạn: thông báo ở tài liệu `07` mục CONG_VIEC_47.
- Kết thúc: bảng công tháng đã chốt, là đầu vào tính lương.

Trạng thái kỳ bảng công:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Mở bảng công tháng lần đầu hoặc ghi dữ liệu thuộc tháng | Đang mở (`open`) |
| Đang mở | Nhân sự mở xác nhận (tháng đã kết thúc) | Đang xác nhận (`confirming`) |
| Đang mở, Đang xác nhận | Nhân sự chốt (không còn giải trình chờ trả lời) | Đã chốt (`closed`) |
| Đã chốt | Nhân sự mở lại khi bảng lương chưa chốt | Đang mở |

Trạng thái phiếu tăng ca: Chờ đồng ý → (đồng ý) Chờ duyệt → Đã duyệt; Chờ đồng ý → (không đồng ý) Người lao động không đồng ý; Chờ duyệt → Bị từ chối hoặc Đã rút; Chờ đồng ý, Đã duyệt → Đã hủy. Chưa có chính sách duyệt thì gửi xong là Đã duyệt.
## MODULE_08 Nhân sự (phần 3: Lương, CONG_VIEC_48)

### Luồng 47. Tính, duyệt, trả lương tháng

- Bắt đầu: bảng công tháng của công ty đã chốt (CONG_VIEC_47); nhân sự có `hr.payroll.manage` mở "Bảng lương".
- Các bước:
  1. Một lần đầu: quản trị tập đoàn nhập bộ tham số pháp luật theo ngày hiệu lực; nhân sự công ty chọn vùng cho chi nhánh, nhóm chi phí phòng ban, loại phụ cấp; khai lương đóng bảo hiểm, cách tính thuế cho nhân viên; hợp đồng mới chọn loại phụ cấp (QUYTAC_NGHIEPVU_312 đến 315).
  2. Lập bảng lương tháng: hệ thống tính từng nhân viên có hợp đồng đã ký trong tháng từ hợp đồng, phụ lục, bảng công, hồ sơ lương, tham số hiệu lực ngày cuối tháng (QUYTAC_NGHIEPVU_316 đến 320).
  3. Nhân sự xem cảnh báo, thêm thưởng, tạm ứng (khoản nhập tay); bảng lương tính lại (QUYTAC_NGHIEPVU_321).
  4. Gửi duyệt: hệ thống tính lại, kiểm bảng công đã chốt, kỳ kế toán mở, công ty đã khởi tạo kế toán, không còn cảnh báo chặn; cấp số `BL`; đi luồng duyệt chung loại `hr.payroll` (QUYTAC_NGHIEPVU_322).
  5. Duyệt xong: khóa mở lại bảng công tháng; ghi bút toán trích lương ngày cuối tháng; thông báo chuông và email phiếu lương cho nhân viên (QUYTAC_NGHIEPVU_323).
  6. Kế toán chi lương; nhân sự ghi "Đã trả lương" (ngày, quỹ): bút toán Nợ 334 / Có quỹ.
- Ngoại lệ: bảng công chưa chốt, chi nhánh chưa chọn vùng, thực lĩnh âm, chưa khởi tạo kế toán, kỳ đã khóa: không gửi được. Bị từ chối, đã rút: sửa, tính lại, gửi lại. Nháp hủy được (lý do). Đã duyệt không sửa, không hủy; sai thì điều chỉnh bằng khoản nhập tay tháng sau. Kỳ cuối tháng khóa sổ sau khi gửi: bút toán ghi ngày duyệt. Email lỗi: gửi lại.
- Kết thúc: bảng lương "Đã trả"; có bút toán trích lương, trả lương; nhân viên xem phiếu lương trong "Hồ sơ của tôi".

Trạng thái (CONG_VIEC_48):

| Từ | Sự kiện | Sang |
|---|---|---|
| Nháp, Bị từ chối, Đã rút | Gửi duyệt (có chính sách duyệt) | Chờ duyệt |
| Nháp, Bị từ chối, Đã rút | Gửi duyệt (không có chính sách duyệt) | Đã duyệt |
| Chờ duyệt | Duyệt, từ chối, rút | Đã duyệt, Bị từ chối, Đã rút |
| Nháp, Bị từ chối, Đã rút | Hủy (lý do) | Đã hủy |
| Đã duyệt | Ghi đã trả lương | Đã trả |
## MODULE_15 Phân tích dữ liệu (phần 1: Báo cáo quản trị, CONG_VIEC_50)

### Luồng 49. Xem và xuất báo cáo quản trị

- Bắt đầu: người có quyền truy cập mini app Báo cáo quản trị (`analytics.access`) mở ô "Báo cáo quản trị" trên trang chủ.
- Các bước:
  1. Trang tổng quan (MAN_HINH_140) hiện thẻ chỉ tiêu của các nhóm báo cáo người dùng được xem: doanh số, giá trị tồn cuối kỳ, phải thu, phải trả, hoa hồng đã ghi có (QUYTAC_NGHIEPVU_336).
  2. Người dùng chọn báo cáo (bán hàng, tồn kho và luân chuyển, công nợ theo tuổi nợ, hoa hồng và ví); hệ thống chỉ liệt kê công ty được xem của nhóm đó: quyền gán ở phạm vi tập đoàn xem mọi công ty của tập đoàn, phạm vi công ty xem công ty đó.
  3. Chọn công ty, khoảng ngày (bắt buộc với báo cáo theo kỳ, tối đa 366 ngày), cách nhóm, bộ lọc phụ (kênh, chỉ đơn VComm, kho, phải thu hoặc phải trả) rồi xem (QUYTAC_NGHIEPVU_343).
  4. Hệ thống tính từ dữ liệu đã có, cùng cách tính của các module: doanh số theo hàng đã giao (QUYTAC_NGHIEPVU_337, 338), tồn kho theo thẻ kho (QUYTAC_NGHIEPVU_340), tuổi nợ theo sổ công nợ tại hôm nay (QUYTAC_NGHIEPVU_341), hoa hồng và ví (QUYTAC_NGHIEPVU_342); dòng tổng chỉ cộng công ty cùng đồng tiền với công ty gốc (QUYTAC_NGHIEPVU_339).
  5. Xuất Excel: tệp cùng bộ lọc, đủ dòng; hệ thống ghi nhật ký thao tác.
- Ngoại lệ: không có quyền nhóm báo cáo hoặc chọn công ty ngoài phạm vi: từ chối (không có quyền); khoảng ngày đảo hoặc quá 366 ngày, ngày không có thật: báo tại ô đến ngày hoặc từ ngày; quá 20.000 dòng khi xuất: báo "Quá 20.000 dòng. Hãy thu hẹp bộ lọc rồi xuất lại."; bảng trên 500 dòng: hiện 500 dòng đầu kèm ghi chú, dòng tổng tính trên toàn bộ.
- Kết thúc: người dùng xem hoặc tải báo cáo; không có dữ liệu nghiệp vụ nào bị ghi, không có trạng thái mới.

## MODULE_11 Điểm thưởng (CONG_VIEC_51)

### Luồng 42. Điểm thưởng

- Bắt đầu: quản trị (`loyalty.manage`) cài giai đoạn, bảng hạng (MAN_HINH_146).
- Các bước:
  1. Người mua đặt đơn VComm (Luồng 37, 38): chốt giai đoạn, hạng; bật "Dùng điểm" thì trừ điểm ngay, tiền thu hộ hoặc tiền cổng trừ tiền điểm (MAN_HINH_93; QUYTAC_NGHIEPVU_346, 348).
  2. Đơn hủy (người mua, nhân viên, hết hạn thanh toán, hoàn hàng): hoàn điểm vào đúng lô, không tích (QUYTAC_NGHIEPVU_349).
  3. Kho nhận hàng trả: hoàn điểm theo tỷ lệ, tiền hoàn trừ phần tiền điểm.
  4. Đơn Hoàn tất: tích điểm (lô có hạn), cộng chi tiêu, tính lại hạng, bút toán (QUYTAC_NGHIEPVU_347, 351, 355).
  5. Bán tại quầy (CONG_VIEC_53): dùng, tích ngay; trả hàng: hoàn điểm đã dùng, trừ lại điểm đã tích, thiếu quy tiền trừ vào tiền hoàn.
  6. Việc nền 0 giờ 10 phút: hết hạn lô, nhắc trước 30 ngày, chuyển năm chi tiêu, xét hạng (QUYTAC_NGHIEPVU_350, 351).
- Nhánh: quản trị khóa, mở ví (MAN_HINH_147); lập phiếu điều chỉnh → duyệt → ghi sổ hoặc Không ghi sổ được (MAN_HINH_148); xem cảnh báo (MAN_HINH_149), nghĩa vụ điểm (MAN_HINH_150).
- Kết thúc: điểm người mua xem ở MAN_HINH_151, 152.
## MODULE_12 Cửa hàng liên kết (phần 1, CONG_VIEC_55)

### Luồng 51. Cửa hàng liên kết

- Bắt đầu: quản trị (`affiliate.manage`) tạo cửa hàng từ đối tác ngoài tập đoàn, nhập hợp đồng, điểm bán, kích hoạt, mời chủ cửa hàng (MAN_HINH_178; QUYTAC_NGHIEPVU_392, 393).
- Các bước:
  1. Chủ cửa hàng kích hoạt tài khoản, mời thu ngân, gán điểm bán (MAN_HINH_177).
  2. Thu ngân chọn điểm bán, nhập tiền hóa đơn, định danh khách (MAN_HINH_174): hiện mã QR cửa hàng (cách 1), quét mã thành viên của khách (cách 2) hoặc nhập số điện thoại (cách 3) (QUYTAC_NGHIEPVU_394 đến 397).
  3. Cách 1, 3: khách xác nhận trên ứng dụng (MAN_HINH_181), chọn voucher, số điểm; từ chối hoặc hết hạn thì giao dịch kết thúc không ghi gì. Cách 2: hoàn tất ngay.
  4. Hoàn tất: dùng voucher, trừ điểm, tích điểm nếu trong hạn mức và không có bảng quá hạn, bút toán (QUYTAC_NGHIEPVU_398, 399, 402, 404).
  5. Chủ cửa hàng hủy giao dịch khi tuần chưa chốt (QUYTAC_NGHIEPVU_400).
  6. 1 giờ sáng thứ Hai: lập bảng đối soát tuần trước (QUYTAC_NGHIEPVU_403).
  7. Chủ cửa hàng xác nhận (hoặc tự xác nhận) hoặc khiếu nại; công ty trả lời, chốt lại (MAN_HINH_176, 180).
  8. Xác nhận: ghi công nợ, bù trừ, bút toán phí; kế toán lập phiếu thu hoặc phiếu chi (Luồng 18, 19); công nợ về 0 thì bảng Đã thanh toán.
- Nhánh voucher: chủ cửa hàng (MAN_HINH_175) hoặc quản trị (MAN_HINH_179) tạo → duyệt → đang phát → khách nhận trên ứng dụng (trừ điểm nếu đổi bằng điểm) → dùng tại quầy hoặc hết hạn (QUYTAC_NGHIEPVU_401, 402).
- Ngoại lệ: cửa hàng tạm ngưng, chấm dứt, hết hợp đồng thì không giao dịch; vượt hạn mức hoặc quá hạn thanh toán thì không tích, vẫn dùng điểm; cảnh báo bất thường, dư nợ ≥ 80 % (QUYTAC_NGHIEPVU_405).
- Kết thúc: bảng đối soát Đã thanh toán; báo cáo ở MAN_HINH_176, 180.
- Trạng thái: theo tài liệu `07` mục MODULE_12 (giao dịch liên kết, voucher liên kết, bảng đối soát tuần).

## MODULE_10 Cộng đồng (phần 1: Cộng tác viên, thưởng giới thiệu, mua chung, ví mua sắm, bảng tin, CONG_VIEC_49)

### Luồng 44. Cộng đồng: cộng tác viên, thưởng giới thiệu, mua chung, ví mua sắm, bảng tin

CONG_VIEC_49 (gồm THAY_DOI_22) chỉ được cấp một số luồng (Luồng 44) nên các luồng của công việc gộp thành năm luồng con 44.1 đến 44.5.

- Bắt đầu: quản trị công ty vận hành sàn thiết lập mức hoa hồng cộng tác viên ở Thiết lập hoa hồng sản phẩm (MAN_HINH_101), cài đặt thưởng giới thiệu (MAN_HINH_137 thẻ Thưởng giới thiệu), cài đặt mua chung theo biến thể (MAN_HINH_138) (QUYTAC_NGHIEPVU_326 đến 328).
- Luồng con 44.1 Cộng tác viên:
  1. Người mua mở Cộng tác viên (MAN_HINH_132), đồng ý điều khoản, nhập kênh chia sẻ, gửi đăng ký; hồ sơ Chờ duyệt (QUYTAC_NGHIEPVU_324).
  2. Quản trị (`marketplace.buyer.manage`) mở Cộng tác viên trên web (MAN_HINH_137), duyệt (cấp mã lần đầu) hoặc từ chối (lý do); người mua nhận thông báo; bị từ chối thì sửa và gửi lại.
  3. Cộng tác viên mở trang sản phẩm (MAN_HINH_91), bấm "Chia sẻ sản phẩm" lấy đường dẫn `/r/<mã giới thiệu>?sp=<mã sản phẩm>&ctv=<mã>` (THAY_DOI_28; không có mã giới thiệu thì `/p/<mã sản phẩm>?ctv=<mã>`).
  4. Người mua khác mở đường dẫn: đã đăng nhập thì ghi lượt bấm ngay; chưa đăng nhập thì ứng dụng giữ mã, ghi sau khi đăng nhập, đăng ký (QUYTAC_NGHIEPVU_325).
  5. Người mua đặt đơn có sản phẩm đó trong 168 giờ từ lần bấm gần nhất: hệ thống chụp phần "cộng tác viên" cho cộng tác viên của lượt bấm gần nhất, độc lập với phần giới thiệu, đội kinh doanh (QUYTAC_NGHIEPVU_326).
  6. Đơn hoàn tất (Luồng 37): phần cộng tác viên tính và cộng ví hoa hồng như Luồng 39; cộng tác viên rút tiền như Luồng 39.
  7. Quản trị tạm ngừng (lý do), khôi phục, gắn nhãn KOL, KOC; tạm ngừng thì không ghi lượt bấm mới, không có phần trên đơn mới, phần đã chụp giữ nguyên.
- Luồng con 44.2 Thưởng giới thiệu bạn bè:
  1. Người được giới thiệu đặt đơn: hệ thống chụp người giới thiệu vào đơn (QUYTAC_NGHIEPVU_327).
  2. Đơn chuyển Hoàn tất: chương trình đang bật, giá trị hoàn tất đạt mức tối thiểu, người được giới thiệu chưa từng phát sinh thưởng thì cộng mức thưởng hiện tại vào ví hoa hồng người giới thiệu, lập bút toán `<số đơn>-TG`.
  3. Người giới thiệu xem Mời bạn bè (MAN_HINH_133): mức thưởng hiện tại, người đã mời và trạng thái thưởng (đã thưởng, đơn đang xử lý, chưa đạt điều kiện, chưa có đơn).
- Luồng con 44.3 Mua chung:
  1. Cộng tác viên Đã duyệt mở nhóm trên ứng dụng (MAN_HINH_134, tối đa 5 nhóm đang mở), hoặc quản trị (`marketplace.order.manage`) mở trên web (MAN_HINH_138): chọn biến thể đang bật mua chung, thời hạn; nhóm chụp bậc giá (QUYTAC_NGHIEPVU_329). Người mở chia sẻ đường dẫn nhóm.
  2. Người mua xem nhóm, bấm "Tham gia nhóm", đặt đơn một dòng giá bậc 1 (MAN_HINH_93), trả trước bằng phương thức trực tuyến, ví mua sắm hoặc cả hai; không có thanh toán khi nhận hàng (QUYTAC_NGHIEPVU_330).
  3. Đơn Chờ thanh toán (giữ hàng, hạn 15 phút); thu đủ (hoặc ví trả đủ) thì sang Chờ chốt nhóm; số lượng nhóm cộng thêm.
  4. Khi nhóm còn mở, người mua hủy được đơn Chờ chốt nhóm (lý do): nhả hàng, hoàn toàn bộ tiền đã thu vào ví mua sắm.
  5. Hết hạn, việc nền mỗi phút chốt nhóm (QUYTAC_NGHIEPVU_331): đơn còn Chờ thanh toán bị hủy; đạt mốc bậc 1 thì nhóm Thành công, sửa đơn giá theo bậc đạt được, hoàn phần dư vào ví mua sắm, đơn sang Chờ giao và giao như Luồng 37; không đạt thì nhóm Thất bại, hủy mọi đơn, hoàn toàn bộ vào ví mua sắm. Người tham gia nhận thông báo kết quả.
  6. Người mở nhóm là cộng tác viên Đã duyệt nhận phần cộng tác viên trên các đơn của nhóm, tính trên giá chốt khi đơn hoàn tất.
- Luồng con 44.4 Ví mua sắm, khóa và chặn ví (THAY_DOI_22):
  1. Tiền hoàn, chênh lệch mua chung cộng vào ví mua sắm; người mua xem số dư, lịch sử ở Ví mua sắm (MAN_HINH_135) (QUYTAC_NGHIEPVU_332).
  2. Khi đặt đơn (MAN_HINH_93), người mua chọn "Dùng ví mua sắm": trừ tối đa tổng thanh toán; phần còn lại theo phương thức đã chọn; đơn bị hủy thì phần ví hoàn về ví.
  3. Quản trị (`marketplace.order.manage`) khóa ví mua sắm toàn hệ thống ở thẻ Ví mua sắm của MAN_HINH_138: không ai dùng số dư trả đơn; tiền hoàn vẫn vào ví (QUYTAC_NGHIEPVU_390).
  4. Kế toán (`marketplace.payment.manage`) chặn ví mua sắm hoặc ví hoa hồng của một người mua ở chi tiết người mua (MAN_HINH_80), nhập lý do; người dùng nhận thông báo. Chặn ví hoa hồng: yêu cầu rút tiền chờ duyệt tự bị từ chối, tiền về lại ví hoa hồng; không tạo yêu cầu mới; yêu cầu đã duyệt chưa chi không ghi được đã chi cho đến khi gỡ chặn (QUYTAC_NGHIEPVU_391).
- Luồng con 44.5 Bảng tin và kiểm duyệt:
  1. Người mua mở thẻ Bảng tin (MAN_HINH_136), đăng bài (ảnh, gắn sản phẩm) hoặc viết đánh giá từ chi tiết đơn đã giao; bài hiện ngay (QUYTAC_NGHIEPVU_333, 334).
  2. Người khác bình luận, thích, báo cáo vi phạm; nội dung có từ 5 báo cáo chờ xử lý tự ẩn tạm (QUYTAC_NGHIEPVU_335).
  3. Người kiểm duyệt (`marketplace.community.manage`) mở Kiểm duyệt cộng đồng (MAN_HINH_139): ẩn (lý do, báo tác giả) hoặc hiện lại, bỏ qua báo cáo; khóa đăng bài và bình luận của tài khoản vi phạm (giao diện chọn 7 ngày, 30 ngày hoặc vĩnh viễn; API nhận 1 đến 365 ngày), mở khóa.
  4. Người kiểm duyệt đăng, ghim bài VComm; sửa từ cấm; bật, tắt đăng bài, bình luận của người mua.
- Nhánh: hồ sơ cộng tác viên bị từ chối thì người mua gửi lại; nhân viên hủy nhóm đang mở (lý do) thì xử lý như thất bại, nhóm Đã hủy; tác giả xóa bài, bình luận của mình; người bị khóa vẫn xem bảng tin.
- Ngoại lệ: thông báo ở tài liệu `07` mục CONG_VIEC_49.
- Kết thúc: hoa hồng cộng tác viên, thưởng giới thiệu đã cộng ví hoa hồng; nhóm mua chung Thành công, Thất bại hoặc Đã hủy, tiền dư hoặc toàn bộ đã hoàn vào ví mua sắm; nội dung vi phạm đã ẩn, tài khoản vi phạm đã khóa.

Trạng thái hồ sơ cộng tác viên:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Người mua gửi đăng ký | Chờ duyệt (`pending`) |
| Chờ duyệt | Quản trị duyệt (cấp mã lần đầu) | Đã duyệt (`approved`) |
| Chờ duyệt | Quản trị từ chối (lý do) | Từ chối (`rejected`) |
| Từ chối | Người mua gửi lại | Chờ duyệt (`pending`) |
| Đã duyệt | Quản trị tạm ngừng (lý do) | Tạm ngừng (`suspended`) |
| Tạm ngừng | Quản trị khôi phục | Đã duyệt (`approved`) |

Trạng thái nhóm mua chung:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Cộng tác viên hoặc quản trị mở nhóm | Đang mở (`open`) |
| Đang mở | Hết hạn, số lượng đạt mốc bậc 1 | Thành công (`succeeded`) |
| Đang mở | Hết hạn, số lượng dưới mốc bậc 1 | Thất bại (`failed`) |
| Đang mở | Quản trị hủy nhóm (lý do) | Đã hủy (`cancelled`) |

Trạng thái đơn VComm của nhóm mua chung (bổ sung Luồng 37, 38):

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Đặt đơn tham gia nhóm còn phải trả trực tuyến | Chờ thanh toán (`awaiting_payment`) |
| (Chưa có) | Đặt đơn tham gia nhóm, ví mua sắm trả đủ | Chờ chốt nhóm (`awaiting_group`) |
| Chờ thanh toán | Cổng báo thu đủ | Chờ chốt nhóm (`awaiting_group`) |
| Chờ thanh toán | Quá hạn thanh toán; hoặc nhóm kết thúc | Đã hủy (`cancelled`), phần đã trả hoàn vào ví mua sắm |
| Chờ chốt nhóm | Người mua hủy khi nhóm còn mở | Đã hủy (`cancelled`), hoàn toàn bộ vào ví mua sắm |
| Chờ chốt nhóm | Nhóm Thành công (sửa giá, hoàn dư vào ví mua sắm) | Chờ giao (`awaiting_shipment`), tiếp tục như Luồng 37 |
| Chờ chốt nhóm | Nhóm Thất bại hoặc Đã hủy | Đã hủy (`cancelled`), hoàn toàn bộ vào ví mua sắm |

Trạng thái bài đăng, bình luận:

| Trạng thái | Sự kiện | Trạng thái sau |
|---|---|---|
| (Chưa có) | Tác giả đăng | Đang hiện (`visible`) |
| Đang hiện | Đủ 5 báo cáo chờ xử lý | Tự ẩn tạm (`auto_hidden`) |
| Đang hiện, Tự ẩn tạm | Người kiểm duyệt ẩn (lý do) | Đã ẩn (`hidden`) |
| Tự ẩn tạm, Đã ẩn | Người kiểm duyệt hiện lại (bỏ qua báo cáo chờ xử lý) | Đang hiện (`visible`) |
| Đang hiện, Tự ẩn tạm, Đã ẩn | Tác giả xóa | Đã xóa (`deleted`) |
## MODULE_04 Mua hàng (phần 2: Nhập khẩu và phân bổ chi phí, CONG_VIEC_45)

### Luồng 50. Nhập khẩu, tờ khai, chi phí vào giá vốn

- Bắt đầu: Nhân viên mua hàng lập đơn mua, đánh dấu "Nhập khẩu", chọn tiền tệ.
- Các bước:
  1. Gửi đơn: luôn đi luồng duyệt, giá trị quy đổi theo tỷ giá hạch toán (QUYTAC_NGHIEPVU_285, QUYTAC_NGHIEPVU_19).
  2. Thủ kho nhận hàng như Luồng nhập mua; khi gửi, hệ thống lấy tỷ giá hạch toán ngày phiếu, ghi sổ kho, công nợ, bút toán theo tiền tệ công ty (QUYTAC_NGHIEPVU_286).
  3. Nhân viên mua hàng hoặc kế toán lập tờ khai từ đơn: số, ngày, tỷ giá tính thuế, dòng hàng; thuế gợi ý, sửa khớp tờ khai (QUYTAC_NGHIEPVU_287).
  4. Kế toán ghi sổ tờ khai khi hàng đã nhập đủ: thuế vào giá vốn (phần tồn) hoặc giá vốn hàng bán (phần đã xuất), bút toán thuế (QUYTAC_NGHIEPVU_288, QUYTAC_NGHIEPVU_291).
  5. Khi có hóa đơn vận chuyển, bảo hiểm, phí: lập chứng từ chi phí theo tờ khai, xem trước phân bổ, ghi sổ (QUYTAC_NGHIEPVU_289 đến QUYTAC_NGHIEPVU_291).
  6. Kế toán trả nhà cung cấp dịch vụ bằng phiếu chi có sẵn; nộp thuế bằng phiếu kế toán nhập tay.
- Ngoại lệ: thiếu tỷ giá ngày phiếu, ngày chứng từ: không gửi, không lưu; hàng chưa nhập đủ số khai, kỳ đã khóa, kiểm kê đang đếm: không ghi sổ; tờ khai chưa ghi sổ: không lập chứng từ chi phí.
- Kết thúc: giá vốn mặt hàng nhập gồm giá mua quy đổi, thuế không được hoàn, chi phí phân bổ; công nợ nhà cung cấp, nhà cung cấp dịch vụ; bút toán đầy đủ.

| Từ | Sự kiện | Sang |
|---|---|---|
| Tờ khai, chứng từ chi phí Nháp | Ghi sổ | Đã ghi sổ |
| Tờ khai, chứng từ chi phí Nháp | Hủy | Đã hủy |

## MODULE_14 Bán lẻ tại quầy và trạm giao hàng (phần 3: Kế hoạch mua theo ngân sách, CONG_VIEC_58)

### Luồng 55. Kế hoạch mua theo ngân sách (Open-to-Buy)

- Bắt đầu: người có `purchasing.budget.manage` (trưởng phòng mua hàng) mở "Kế hoạch ngân sách" trong mini app Mua hàng.
- Các bước:
  1. Trưởng phòng mua hàng lập kế hoạch: chọn kỳ (từ tháng, đến tháng, tối đa 12 tháng), nhập bảng ngành hàng cấp 1 × kho × tháng (MAN_HINH_205), lưu nháp (QUYTAC_NGHIEPVU_442, 443).
  2. Gửi duyệt: hệ thống kiểm tra kỳ không trùng kế hoạch chờ duyệt, đã duyệt khác, cấp số `NSM`, gửi luồng duyệt dùng chung loại chứng từ `purchasing.budget_plan` với số tiền = tổng các ô (QUYTAC_NGHIEPVU_444, 445).
  3. Người duyệt duyệt hết các cấp: kế hoạch Đã duyệt, ngân sách các tháng trong kỳ có hiệu lực.
  4. Nhân viên mua hàng lập, sửa đơn mua: khối "Ngân sách mua" (MAN_HINH_209) hiện từng ô đơn chạm tới (ngân sách, đã dùng không gồm đơn này, giá trị đơn, còn lại sau đơn) và cảnh báo ô vượt hoặc chưa có ngân sách; không chặn lưu (QUYTAC_NGHIEPVU_451).
  5. Gửi duyệt đơn mua: trong cùng giao dịch, hệ thống tính lại theo ô; trong ngân sách thì đi luồng `purchasing.order` (hoặc miễn duyệt như hiện nay); vượt hoặc chưa có ngân sách thì đi luồng `purchasing.order_over_budget`, lưu ảnh chụp các ô vượt (QUYTAC_NGHIEPVU_452). Tháng của ngày đơn không thuộc kế hoạch đã duyệt nào thì không kiểm tra (QUYTAC_NGHIEPVU_450).
  6. Đơn được duyệt: số đã dùng của ô tăng; đơn đóng sớm chỉ còn tính phần đã nhận; đơn chờ duyệt không giữ chỗ ngân sách (QUYTAC_NGHIEPVU_446).
  7. Theo dõi số còn được mua (MAN_HINH_206) theo tháng, quý, năm, ngành hàng, kho; nhấn ô xem các đơn đã tính (QUYTAC_NGHIEPVU_447).
  8. Cần thêm hoặc chuyển ngân sách: trưởng phòng mua hàng lập phiếu điều chỉnh của kế hoạch đã duyệt (dòng tăng, giảm, lý do), gửi duyệt loại chứng từ `purchasing.budget_adjustment` (số `DCNS`, số tiền = tổng số tăng); duyệt xong hệ thống áp vào ô, ô chưa có thì tạo với ngân sách gốc 0 (QUYTAC_NGHIEPVU_448, 449).
- Ngoại lệ: chưa có chính sách duyệt kế hoạch, phiếu hoặc đơn vượt ngân sách: không gửi được, báo lỗi, chứng từ giữ trạng thái cũ; kỳ trùng: từ chối khi gửi; dòng giảm làm ô nhỏ hơn số đã dùng: từ chối khi gửi, còn nếu điều kiện chỉ sai lúc duyệt thì vẫn áp, ghi nhật ký; người lập rút khi cấp 1 chưa quyết định; bị từ chối, đã rút: sửa rồi gửi lại hoặc hủy; hai đơn gửi duyệt cùng lúc: hệ thống giữ khóa theo công ty, đơn sau tính cả đơn trước nếu đơn trước đã được duyệt ngay.
- Kết thúc: kế hoạch Đã duyệt hoặc Đã hủy; phiếu điều chỉnh Đã duyệt (đã áp vào ô) hoặc Đã hủy; đơn mua đi đúng luồng duyệt.

| Từ | Sự kiện | Sang |
|---|---|---|
| Kế hoạch, phiếu điều chỉnh Nháp, Bị từ chối, Đã rút | Sửa | Nháp |
| Kế hoạch, phiếu điều chỉnh Nháp, Bị từ chối, Đã rút | Gửi duyệt (có chính sách; kế hoạch có ô, không trùng tháng; phiếu không giảm dưới số đã dùng) | Chờ duyệt |
| Kế hoạch, phiếu điều chỉnh Chờ duyệt | Duyệt hết các cấp | Đã duyệt (phiếu: áp vào ô) |
| Kế hoạch, phiếu điều chỉnh Chờ duyệt | Từ chối | Bị từ chối |
| Kế hoạch, phiếu điều chỉnh Chờ duyệt | Người lập rút khi cấp 1 chưa quyết định | Đã rút |
| Kế hoạch, phiếu điều chỉnh Nháp, Bị từ chối, Đã rút | Hủy | Đã hủy |
| Đơn mua Nháp, Bị từ chối, Đã rút (hoặc đơn đã duyệt sửa tăng giá trị) | Gửi duyệt khi có ô vượt hoặc chưa có ngân sách trong tháng đã áp dụng | Chờ duyệt theo luồng `purchasing.order_over_budget`; kết quả duyệt như đơn mua thường |

## MODULE_16 Mở rộng kinh doanh (phần 1: Open API cho đối tác, CONG_VIEC_61)

### Luồng 58. Open API cho đối tác

- Bắt đầu: quản trị công ty (`platform.api_key.manage`) cấp khóa ở MAN_HINH_224 cho đối tác hoặc phần mềm nội bộ; khóa hiện một lần, gửi đối tác.
- Các bước:
  1. Đối tác gọi `/api/v1/open/...` kèm `Authorization: Bearer <khóa>`.
  2. Máy chủ kiểm khóa, hạn dùng, đối tác còn giao dịch, IP, giới hạn mỗi phút, phạm vi; sai thì `401`, `403`, `429`; mọi lần gọi xác định được khóa ghi nhật ký gọi.
  3. Sản phẩm, giá, tồn: trả dữ liệu công ty, giá theo kênh và nhóm khách, tồn theo kho của khóa.
  4. Tạo đơn: mã đơn đối tác đã có thì trả đơn cũ; chưa có thì tạo đơn bán Nháp nguồn Open API.
  5. Nhân viên bán hàng kiểm tra đơn, gửi duyệt; đơn chạy luồng bán hàng hiện có.
  6. Đối tác tra trạng thái theo mã đơn; hủy khi đơn còn Nháp.
- Ngoại lệ: thu hồi khóa thì lần gọi kế tiếp `401`, đơn đã tạo giữ nguyên; công ty tắt cài đặt hàng hóa thì đơn có hàng hóa bị từ chối `409`.

| Từ | Sự kiện | Sang |
|---|---|---|
| Khóa Đang dùng | Qua ngày hạn dùng | Hết hạn |
| Khóa Hết hạn | Sửa hạn dùng | Đang dùng |
| Khóa Đang dùng, Hết hạn | Thu hồi | Đã thu hồi |
| Đơn Open API Nháp | Đối tác hủy | Đã hủy |
| Đơn Open API Nháp | Nhân viên gửi duyệt | Chờ duyệt hoặc Đã xác nhận (như đơn thường) |

### Luồng 62. Khách hàng do đối tác tạo, giao thẳng người nhận (CONG_VIEC_66)

- Bắt đầu: đối tác có khóa phạm vi `customer.write` gửi khách (API_289).
- Mã số thuế chưa có (căn cước trùng hồ sơ ngoài phạm vi: `409`): tạo hồ sơ "Do đối tác tạo" và hồ sơ khách ở công ty (nhóm của đối tác, hạn thanh toán 0 ngày). Đã có và dùng được: gắn vào phạm vi, chỉ trả mã. Đã ngừng, là công ty trong tập đoàn hoặc chỉ là nhà cung cấp: `409`, nhân viên xử lý.
- Đối tác gửi đơn (API_262) kèm `customerCode`, `recipient`: đơn bán Nháp ghi khách đó và người nhận; nhân viên kiểm, gửi duyệt như đơn thường.
- Phiếu xuất giao hàng hiện người nhận; ghi sổ phiếu xuất lập hóa đơn điện tử và công nợ theo khách trên đơn (luồng hiện có).
- Ngoại lệ: khách bị nhân viên ngừng dùng thì đơn mới với khách đó bị từ chối; đơn đã tạo giữ nguyên.
- Sơ đồ: `tai_lieu/cong_viec/CONG_VIEC_66.md` mục 7.

## MODULE_13 Văn phòng số (phần 2: chữ ký số, kho hợp đồng, CONG_VIEC_59)

### Luồng 56. Chữ ký số, trình ký, kho hợp đồng

Nguồn: `tai_lieu/cong_viec/CONG_VIEC_59.md` mục 5, 7, 10.

#### Luồng 56a. Cài đặt

- Bắt đầu: quản trị công ty (`office.signing.manage`) mở "Cài đặt ký số và hợp đồng" (MAN_HINH_217).
- Các bước:
  1. Chọn nhà cung cấp ký số (giai đoạn này: Bộ giả lập, chỉ ở môi trường thử), môi trường, nhập thông tin kết nối; kiểm tra kết nối rồi lưu (QUYTAC_NGHIEPVU_454).
  2. Khai chữ ký số công ty: nhập mã định danh của tổ chức tại nhà cung cấp, hệ thống lấy danh sách chứng thư, chọn một chứng thư có mã số thuế trùng mã số thuế công ty (QUYTAC_NGHIEPVU_456).
  3. Quản trị tập đoàn thêm chứng thư gốc tin cậy (tải tệp chứng thư) dùng khi kiểm tra chữ ký (QUYTAC_NGHIEPVU_461).
  4. Mỗi người ký khai tài khoản ký số của mình ở MAN_HINH_210: mã định danh, chọn chứng thư còn hiệu lực (QUYTAC_NGHIEPVU_455).
- Ngoại lệ: bộ giả lập ở môi trường chính thức bị từ chối; chủ thể chứng thư công ty không trùng mã số thuế thì không lưu; chứng thư hết hạn hoặc chưa đến hiệu lực không chọn được.
- Kết thúc: công ty có nhà cung cấp, chữ ký số công ty; người ký có tài khoản ký số.

#### Luồng 56b. Trình ký tài liệu

- Bắt đầu: nhân viên (`office.signing.use`) bấm "Trình ký tài liệu" ở MAN_HINH_210.
- Các bước:
  1. Tải PDF, nhập tiêu đề, ghi chú, hạn ký; thêm người ký (ví dụ Trưởng phòng thứ tự 1, Giám đốc thứ tự 2, chữ ký công ty thứ tự 3), chọn trang, góc (MAN_HINH_211); lưu nháp (QUYTAC_NGHIEPVU_458).
  2. Gửi: hệ thống kiểm người ký nội bộ có tài khoản ký số còn hiệu lực, công ty có chữ ký số; phiên sang đang ký; người thứ tự 1 nhận thông báo (QUYTAC_NGHIEPVU_459).
  3. Trưởng phòng mở MAN_HINH_212, bấm Ký số, xác nhận trên điện thoại; hệ thống hỏi kết quả mỗi 5 giây, nhận chữ ký, chèn vào tệp, lưu bản mới (QUYTAC_NGHIEPVU_457).
  4. Giám đốc ký tương tự; văn thư (`office.signing.company_seal`) đóng chữ ký công ty.
  5. Phiên đã ký xong; người lập tải tệp đã ký; phát sự kiện `office.signing.completed`.
- Ngoại lệ: người ký từ chối trên ứng dụng hoặc quá 5 phút thì lần ký thất bại, ký lại được; người ký bấm Từ chối (lý do) thì phiên bị từ chối; người lập hủy (lý do); qua hạn ký thì hết hạn; phiên bị từ chối, hủy, hết hạn thì sao chép thành phiên mới. Người lập nhắc người đang đến lượt tối đa một lần mỗi ngày; còn 2 ngày đến hạn ký thì hệ thống nhắc.
- Kết thúc: phiên đã ký xong, bị từ chối, đã hủy hoặc hết hạn.

| Từ | Sự kiện | Sang |
|---|---|---|
| Phiên Nháp | Sửa tệp, người ký | Nháp |
| Phiên Nháp | Gửi (người ký nội bộ có tài khoản ký số, công ty có chữ ký số khi cần) | Đang ký |
| Phiên Nháp, Đang ký | Người lập hủy (lý do) | Đã hủy |
| Phiên Đang ký | Người ký cuối cùng ký xong | Đã ký xong |
| Phiên Đang ký | Một người ký từ chối (lý do) | Bị từ chối |
| Phiên Đang ký | Qua hạn ký | Hết hạn |
| Người ký Chờ | Mọi người thứ tự nhỏ hơn đã ký | Đến lượt |
| Người ký Đến lượt | Chữ ký nhận về hợp lệ, chèn vào tệp | Đã ký |
| Người ký Đến lượt | Từ chối ký | Từ chối |
| Lần ký Đang chờ xác nhận | Nhận chữ ký / người ký từ chối trên ứng dụng / quá 5 phút / lỗi | Đã ký / Từ chối / Quá giờ / Thất bại |

#### Luồng 56c. Hợp đồng mua

- Bắt đầu: nhân viên mua hàng (`office.contract.create`) bấm "Lập hợp đồng" ở MAN_HINH_215.
- Các bước:
  1. Lập hợp đồng với nhà cung cấp (từ `crm.partners`), tải tệp nội dung PDF, trình duyệt (QUYTAC_NGHIEPVU_463, 464).
  2. Duyệt qua luồng duyệt chung loại chứng từ `office.contract`; công ty chưa có chính sách thì trưởng phòng của người phụ trách duyệt một cấp.
  3. Duyệt xong hợp đồng sang chờ ký; người phụ trách lập phiên ký từ tệp nội dung (chữ ký công ty, đại diện nhà cung cấp).
  4. Văn thư đóng chữ ký công ty; nhà cung cấp nhận thư, mở đường dẫn (MAN_HINH_213), ký số (QUYTAC_NGHIEPVU_460).
  5. Phiên ký xong: hợp đồng đã ký, ngày ký là ngày chữ ký cuối, tệp đã ký lưu vào hợp đồng; nhãn Đang hiệu lực theo ngày.
  6. Còn 30, 7 ngày đến hạn: người phụ trách, người có `office.contract.manage` nhận nhắc (QUYTAC_NGHIEPVU_467).
  7. Lập phụ lục gia hạn (duyệt, ký hoặc nhập bản đã ký; ngày hết hạn, giá trị của hợp đồng cập nhật) hoặc để hết hạn, thanh lý (ngày, lý do, tệp biên bản) (QUYTAC_NGHIEPVU_465).
- Ngoại lệ: bị từ chối hoặc người lập rút thì sửa, trình lại; phiên ký bị từ chối, hết hạn thì hợp đồng về chờ ký, lập phiên mới; hủy hợp đồng chờ ký thì hủy cả phiên ký. Hợp đồng ký ngoài hệ thống: "Nhập hợp đồng đã ký" (tệp đã ký, ngày ký) → đã ký ngay, không qua duyệt; tệp có chữ ký số thì lưu kết quả kiểm tra.
- Kết thúc: hợp đồng đã ký, đã thanh lý, đã chấm dứt hoặc đã hủy.

| Từ | Sự kiện | Sang |
|---|---|---|
| Hợp đồng Nháp, Bị từ chối, Đã rút | Trình (có tệp nội dung) | Chờ duyệt |
| Hợp đồng Chờ duyệt | Duyệt hết các cấp | Chờ ký |
| Hợp đồng Chờ duyệt | Từ chối | Bị từ chối |
| Hợp đồng Chờ duyệt | Người lập rút | Đã rút |
| Hợp đồng Chờ ký | Phiên ký xong | Đã ký |
| Hợp đồng Nháp, Bị từ chối, Đã rút, Chờ ký | Hủy (lý do; chờ ký thì hủy cả phiên ký) | Đã hủy |
| (mới) | Nhập hợp đồng đã ký | Đã ký |
| Hợp đồng Đã ký | Thanh lý / chấm dứt (ngày, lý do, tệp biên bản) | Đã thanh lý / Đã chấm dứt |
| Phụ lục Nháp, Bị từ chối, Đã rút | Trình | Chờ duyệt → Chờ ký → Đã ký (như hợp đồng, loại chứng từ `office.contract_appendix`) |

#### Luồng 56d. Công văn đi ký số

- Bắt đầu: công văn đi đã duyệt, văn thư (`office.document.clerk`) đã cấp số (Luồng của CONG_VIEC_52).
- Các bước:
  1. Văn thư chọn "Ký số" ở MAN_HINH_158 thay cho phát hành bằng bản quét; hệ thống lập phiên ký từ bản PDF đã cấp số (công văn soạn bằng tệp thì văn thư tải bản PDF đã cấp số): người ký của công văn thứ tự 1, chữ ký công ty thứ tự 2.
  2. Người ký ký số; văn thư đóng chữ ký công ty.
  3. Phiên xong: văn thư bấm Phát hành, không cần tải bản quét; bản đã ký là tệp của phiên.
- Ngoại lệ: phiên đang ký thì chưa phát hành; phiên bị từ chối, hủy, hết hạn thì văn thư chọn lại Ký số hoặc phát hành bằng bản quét như cũ; văn thư nhận thông báo khi phiên kết thúc.
- Kết thúc: công văn đã phát hành.

#### Luồng 56e. Hợp đồng lao động ký số

- Bắt đầu: hợp đồng lao động hoặc phụ lục đã duyệt (CONG_VIEC_46), người có `hr.contract.manage` chọn "Ký số" ở màn hình hợp đồng lao động của Nhân sự (MAN_HINH_118).
- Các bước:
  1. Tải tệp hợp đồng PDF, chọn người ký phía công ty (giám đốc), hạn ký.
  2. Hệ thống lập phiên ký: giám đốc, rồi người lao động (người dùng trong tập đoàn nếu có tài khoản và tài khoản ký số còn hiệu lực; ngược lại là đối tác bên ngoài với thư điện tử, số định danh cá nhân lấy từ hồ sơ).
  3. Giám đốc ký; người lao động ký trong hệ thống hoặc qua đường dẫn.
  4. Phiên xong: Nhân sự nhận sự kiện `office.signing.completed`, lưu tệp đã ký, chuyển hợp đồng sang đã ký như thao tác Ký hiện có (Văn phòng số không ghi vào schema `hr`).
- Ngoại lệ: đang ký số thì không xác nhận ký thủ công; hủy hợp đồng, phụ lục thì hủy phiên ký; Nhân sự không chuyển được thì báo người lập phiên.
- Kết thúc: hợp đồng lao động đã ký với tệp đã ký.

## MODULE_12 Cửa hàng liên kết (phần 2: tích, đổi điểm qua Open API, CONG_VIEC_67)

Luồng 63: người có `affiliate.manage` cấp khóa (MAN_HINH_231) → phần mềm cửa hàng gọi API kèm khóa → kiểm khóa, IP, phạm vi, tần suất, cửa hàng hoạt động, điểm bán → tra điểm (mã thành viên hoặc số điện thoại) → chọn cách: mã thành viên (hoàn tất ngay); số điện thoại (chờ khách xác nhận trên ứng dụng, phần mềm hỏi lại trạng thái); mã OTP (khách có Smart OTP đọc mã; chưa có thì phần mềm yêu cầu gửi SMS, ghi phí tin) → hoàn tất: voucher, trừ điểm, tích điểm (trong hạn mức), bút toán → hủy trước khi chốt tuần qua API hoặc cổng → thứ Hai lập bảng đối soát tuần gồm phí tin nhắn F.

Ngoại lệ: mã giao dịch đối tác đã có trả giao dịch cũ; mã OTP sai không lập giao dịch; Smart OTP sai 5 lần khóa 15 phút; vượt số tin mỗi ngày của khóa `429`.
