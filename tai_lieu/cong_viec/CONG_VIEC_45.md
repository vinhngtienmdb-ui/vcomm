# CONG_VIEC_45: Nhập khẩu và phân bổ chi phí mua hàng (MODULE_04, phần 2)

- Mô tả: Đơn mua nhập khẩu bằng ngoại tệ, nhập kho quy đổi theo tỷ giá, tờ khai hải quan và các khoản thuế, chi phí nhập khẩu, phân bổ thuế và chi phí vào giá vốn hàng nhập, bút toán theo Thông tư 99/2025/TT-BTC, Thông tư 133/2016/TT-BTC.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả và bản mẫu.
- Nguồn: tài liệu `04` mục 3 ý 3 ("giao dịch ngoại tệ và chi phí nhập khẩu phân bổ vào giá vốn"); tài liệu `05` (Mua hàng: "nhập khẩu bằng ngoại tệ, phân bổ chi phí nhập khẩu"); phần tách từ CONG_VIEC_07 (đặc tả CONG_VIEC_07 mục 2); quyết định của người dùng ngày 2026-11-11 (mục 3).
- Mức: Lớn. Lý do: nghiệp vụ mới, đổi cách tính giá vốn, bút toán mới, sửa schema Mua hàng, Kho, Tài chính.

## 1. Mục tiêu

Công ty con nhập khẩu hàng bằng ngoại tệ: đơn mua lập bằng ngoại tệ và đi luồng duyệt có quy đổi; hàng nhập kho ghi theo tiền tệ công ty; thuế trên tờ khai hải quan và chi phí vận chuyển, bảo hiểm, phí khác được phân bổ vào giá vốn của đúng mặt hàng nhập; sổ kế toán ghi đúng tài khoản thuế nhập khẩu, thuế giá trị gia tăng hàng nhập khẩu.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_160, CHUC_NANG_161.

Ngoài phạm vi (công việc sau, cần cấp mã riêng):

- Phiếu chi bằng ngoại tệ, chênh lệch tỷ giá khi trả nợ nhà cung cấp nước ngoài (515, 635), đánh giá lại số dư ngoại tệ cuối kỳ (MODULE_06; quyết định người dùng 2026-11-11, mục 3 ý 1).
- Phiếu chi nộp thuế cho cơ quan hải quan: dùng phiếu kế toán nhập tay có sẵn (CONG_VIEC_14) để ghi Nợ 3333, 33312 / Có 112 cho tới khi có công việc riêng.
- Tờ khai bổ sung, sửa số thuế sau khi đã ghi sổ: dùng phiếu kế toán nhập tay; sửa giá trị tồn kho sau ghi sổ là công việc sau.
- Đặt cọc, trả trước cho nhà cung cấp nước ngoài; thư tín dụng.
- Phân bổ chi phí cho đơn mua trong nước (chỉ áp dụng cho tờ khai nhập khẩu).
- Kết nối hệ thống hải quan điện tử (VNACCS) để lấy tờ khai tự động.

## 3. Quyết định nghiệp vụ của người dùng (2026-11-11)

1. Công nợ nhà cung cấp nước ngoài ghi bằng tiền tệ công ty theo tỷ giá ngày nhập kho, lưu kèm số ngoại tệ và tỷ giá để đối chiếu.
2. Chi phí về sau khi hàng đã nhập kho: lập chứng từ phân bổ bất kỳ lúc nào; phần ứng với hàng còn tồn cộng vào giá trị tồn kho, phần ứng với hàng đã xuất ghi vào giá vốn hàng bán.
3. Tiêu thức phân bổ chọn theo từng khoản chi phí: theo giá trị hoặc theo số lượng (mặc định theo giá trị). Thuế nhập khẩu, thuế tiêu thụ đặc biệt, thuế bảo vệ môi trường gắn thẳng từng dòng tờ khai, không phân bổ.
4. Thuế trên tờ khai: hệ thống tính gợi ý theo trị giá, tỷ giá tính thuế, thuế suất từng dòng; người lập sửa cho khớp số trên tờ khai đã thông quan.

## 4. Căn cứ pháp luật

| Văn bản                                           | Điều khoản                                 | Nội dung dùng                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Luật Thuế giá trị gia tăng số 48/2024/QH15        | Điều 7 khoản 1 điểm b                      | Giá tính thuế hàng nhập khẩu "là trị giá tính thuế nhập khẩu theo quy định của pháp luật về thuế xuất khẩu, thuế nhập khẩu cộng với thuế nhập khẩu cộng với các khoản thuế là thuế nhập khẩu bổ sung theo quy định của pháp luật (nếu có), cộng với thuế tiêu thụ đặc biệt (nếu có) và cộng với thuế bảo vệ môi trường" (QUYTAC_NGHIEPVU_287) |
| Luật Thuế giá trị gia tăng số 48/2024/QH15        | Điều 4 khoản 2                             | Tổ chức nhập khẩu hàng hóa chịu thuế giá trị gia tăng là người nộp thuế                                                                                                                                                                                                                                                                       |
| Thông tư 99/2025/TT-BTC, Thông tư 133/2016/TT-BTC | Hệ thống tài khoản (đã nạp ở CONG_VIEC_14) | 156, 632, 331, 1331, 3332, 3333, 33312, 33381 (Thông tư 133: 3338)                                                                                                                                                                                                                                                                            |

Hạch toán chi tiết theo phần hướng dẫn tài khoản (phụ lục) của Thông tư 99/2025/TT-BTC chưa đối chiếu được nguyên văn trong phiên này; định khoản ở mục 9 theo nguyên tắc giá gốc hàng tồn kho gồm giá mua, thuế không được hoàn lại, chi phí vận chuyển, bảo hiểm. Kế toán trưởng cần xác nhận định khoản trước nghiệm thu (rủi ro "Sai sót hóa đơn, thuế" ở tài liệu `01` mục 6).

## 5. Yêu cầu nghiệp vụ và chức năng

| Mã               | Yêu cầu                                                                                                                                                         | Người cần                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| YCAU_NGHIEPVU_56 | Đặt mua nhà cung cấp nước ngoài bằng ngoại tệ; giá trị duyệt quy đổi theo tỷ giá; nhập kho, công nợ ghi theo tiền tệ công ty                                    | Mua hàng, quản lý, kế toán |
| YCAU_NGHIEPVU_57 | Ghi tờ khai hải quan của lô nhập khẩu, thuế nhập khẩu, thuế tiêu thụ đặc biệt, thuế bảo vệ môi trường, thuế giá trị gia tăng hàng nhập khẩu theo từng dòng hàng | Mua hàng, kế toán          |
| YCAU_NGHIEPVU_58 | Chi phí vận chuyển, bảo hiểm, phí khác và thuế không được hoàn của lô nhập khẩu vào giá vốn đúng mặt hàng, kể cả khi chi phí về sau khi hàng đã bán             | Kế toán                    |

| Mã            | Chức năng                                                                                                                                                                                 | Yêu cầu                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| CHUC_NANG_160 | Đơn mua nhập khẩu bằng ngoại tệ; nhập kho quy đổi theo tỷ giá hạch toán; tờ khai hải quan: dòng hàng theo đơn mua, tỷ giá tính thuế, thuế gợi ý sửa được, ghi sổ                          | YCAU_NGHIEPVU_56, YCAU_NGHIEPVU_57 |
| CHUC_NANG_161 | Chi phí nhập khẩu theo tờ khai: nhà cung cấp dịch vụ, khoản chi phí, tiêu thức; xem trước phân bổ; ghi sổ phân bổ thuế, chi phí vào giá vốn (phần tồn) và giá vốn hàng bán (phần đã xuất) | YCAU_NGHIEPVU_57, YCAU_NGHIEPVU_58 |

## 6. Quy tắc nghiệp vụ

| Mã                  | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Yêu cầu                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| QUYTAC_NGHIEPVU_285 | Đơn mua đánh dấu "Nhập khẩu" chọn tiền tệ bất kỳ đang dùng (mặc định tiền tệ công ty); đơn không nhập khẩu giữ tiền tệ công ty. Đơn nhập khẩu: thuế suất dòng là "Không kê khai" (thuế giá trị gia tăng tính trên tờ khai); không gợi ý giá từ bảng giá mua khi khác tiền tệ công ty; luôn đi luồng duyệt (không áp dụng ngoại lệ duyệt ngay của QUYTAC_NGHIEPVU_63), giá trị duyệt quy đổi theo QUYTAC_NGHIEPVU_19. Nhà cung cấp nội bộ không lập đơn nhập khẩu. Đã có phiếu nhập thì không đổi tiền tệ, không bỏ đánh dấu                                                                                                                                                                                                                                                                                                   | YCAU_NGHIEPVU_56                   |
| QUYTAC_NGHIEPVU_286 | Phiếu nhập mua theo đơn ngoại tệ lấy tỷ giá hạch toán (`accounting`, ưu tiên nhập tay) của ngày phiếu, từ tiền tệ đơn sang tiền tệ công ty, lưu trên phiếu khi gửi; không có tỷ giá thì không gửi được. Giá nhập bằng đơn giá dòng đơn mua quy về đơn vị cơ sở nhân tỷ giá. Công nợ phải trả ghi bằng tiền tệ công ty kèm số ngoại tệ và tỷ giá; trả hàng nhà cung cấp dùng tỷ giá của phiếu nhập gốc                                                                                                                                                                                                                                                                                                                                                                                                                         | YCAU_NGHIEPVU_56                   |
| QUYTAC_NGHIEPVU_287 | Tờ khai thuộc một đơn mua nhập khẩu đã duyệt hoặc đã nhận đủ; số tờ khai không trùng trong công ty. Mỗi dòng gắn một dòng đơn mua; tổng số lượng khai của một dòng đơn mua trên các tờ khai chưa hủy không vượt số đặt. Trị giá tính thuế theo tiền tệ đơn (gợi ý số lượng nhân đơn giá, sửa được); trị giá tính thuế quy đổi bằng trị giá nhân tỷ giá tính thuế ghi trên tờ khai, làm tròn theo đơn vị nhỏ nhất của tiền tệ công ty. Gợi ý: thuế nhập khẩu bằng trị giá quy đổi nhân thuế suất nhập khẩu; thuế tiêu thụ đặc biệt, thuế bảo vệ môi trường nhập số tiền; thuế giá trị gia tăng bằng (trị giá quy đổi cộng thuế nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường) nhân thuế suất giá trị gia tăng (Luật 48/2024/QH15 Điều 7 khoản 1 điểm b). Người lập sửa được từng số thuế; số đã sửa khác gợi ý được đánh dấu | YCAU_NGHIEPVU_57                   |
| QUYTAC_NGHIEPVU_288 | Ghi sổ tờ khai: ngày ghi sổ không thuộc kỳ đã khóa sổ; mỗi dòng đơn mua có số đã nhận (đã ghi sổ kho, trừ đã trả) không nhỏ hơn tổng số khai của các tờ khai đã ghi sổ của dòng đó cộng tờ khai này. Tờ khai đã ghi sổ không sửa, không xóa. Ghi sổ tờ khai sinh bút toán thuế, phân bổ thuế nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường của dòng vào giá vốn theo QUYTAC_NGHIEPVU_291; thuế giá trị gia tăng hàng nhập khẩu ghi thuế được khấu trừ, không vào giá vốn                                                                                                                                                                                                                                                                                                                                                    | YCAU_NGHIEPVU_57, YCAU_NGHIEPVU_58 |
| QUYTAC_NGHIEPVU_289 | Chứng từ chi phí nhập khẩu thuộc một tờ khai đã ghi sổ của công ty; một nhà cung cấp dịch vụ (đối tác có hồ sơ nhà cung cấp ở công ty), số hóa đơn, ngày chứng từ, tiền tệ (ngoại tệ thì lấy tỷ giá hạch toán ngày chứng từ như QUYTAC_NGHIEPVU_286). Mỗi khoản: loại (vận chuyển quốc tế, bảo hiểm, vận chuyển nội địa, phí hải quan và lưu kho bãi, khác), diễn giải, tiền chưa thuế lớn hơn 0, thuế suất giá trị gia tăng, tiêu thức (theo giá trị, theo số lượng). Ghi sổ: kỳ chưa khóa; sinh công nợ phải trả nhà cung cấp dịch vụ (gồm thuế, theo tiền tệ công ty) và bút toán; đã ghi sổ không sửa, không xóa. Không đi luồng duyệt (có hóa đơn gốc), giống phiếu nhập mua                                                                                                                                             | YCAU_NGHIEPVU_58                   |
| QUYTAC_NGHIEPVU_290 | Phân bổ một khoản chi phí (tiền chưa thuế theo tiền tệ công ty) cho các dòng tờ khai: theo giá trị là tỷ lệ trị giá tính thuế quy đổi; theo số lượng là tỷ lệ số lượng theo đơn vị cơ sở. Làm tròn từng phần theo đơn vị nhỏ nhất của tiền tệ công ty, phần chênh lệch làm tròn cộng vào dòng có phần lớn nhất để tổng các phần bằng đúng số tiền khoản chi phí. Thuế nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường không phân bổ, thuộc đúng dòng tờ khai                                                                                                                                                                                                                                                                                                                                                                  | YCAU_NGHIEPVU_58                   |
| QUYTAC_NGHIEPVU_291 | Số tiền vào giá vốn của một dòng tờ khai chia phần tồn và phần đã xuất tại thời điểm ghi sổ, tại kho nhận của đơn mua, cho công ty: hàng theo dõi serial: phần tồn theo số serial nhập từ dòng đơn mua đó còn trong kho trên số lượng khai, cộng đều vào giá đích danh của các serial đó; hàng không theo dõi serial: phần tồn theo tỷ lệ nhỏ hơn giữa 1 và tồn hiện tại của mặt hàng tại kho trên số lượng khai. Phần tồn cộng vào giá trị tồn kho (giá vốn bình quân tính lại, thẻ kho ghi dòng điều chỉnh giá trị số lượng 0); phần còn lại ghi giá vốn hàng bán. Kiểm kê đang đếm mặt hàng thì không ghi sổ được (QUYTAC_NGHIEPVU_53)                                                                                                                                                                                     | YCAU_NGHIEPVU_58                   |

## 7. Vai trò và quyền

| Quyền                      | Phạm vi | Nhạy cảm | Vai trò mặc định                                                                 |
| -------------------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| `purchasing.import.view`   | Công ty | Không    | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Kế toán, Kế toán trưởng |
| `purchasing.import.manage` | Công ty | Không    | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Kế toán, Kế toán trưởng |

- Lập đơn nhập khẩu dùng quyền `purchasing.order.manage` có sẵn.
- Kế toán, Kế toán trưởng được thêm `purchasing.access` để mở mini app Mua hàng; menu chỉ hiện mục có quyền.
- Phiếu nhập mua theo đơn nhập khẩu dùng quyền `inventory.purchase.receive` có sẵn.

## 8. Luồng nghiệp vụ

1. Nhân viên mua hàng lập đơn mua, đánh dấu "Nhập khẩu", chọn tiền tệ, nhập đơn giá ngoại tệ; gửi; đơn đi luồng duyệt với giá trị quy đổi.
2. Thủ kho nhận hàng theo đơn như hiện nay; khi gửi phiếu, hệ thống lấy tỷ giá hạch toán ngày phiếu, ghi sổ kho bằng tiền tệ công ty, sinh công nợ, bút toán.
3. Nhân viên mua hàng hoặc kế toán lập tờ khai từ đơn mua: số, ngày đăng ký, tỷ giá tính thuế, dòng hàng; hệ thống gợi ý thuế; sửa khớp tờ khai; ghi sổ khi hàng của các dòng đã nhập kho.
4. Khi nhận hóa đơn vận chuyển, bảo hiểm, phí: lập chứng từ chi phí nhập khẩu chọn tờ khai, nhập các khoản, chọn tiêu thức, xem trước phân bổ, ghi sổ.
5. Kế toán trả nợ nhà cung cấp dịch vụ bằng phiếu chi có sẵn; nộp thuế bằng phiếu kế toán nhập tay (mục 2).

Ngoại lệ: thiếu tỷ giá ngày phiếu thì không gửi phiếu nhập, báo người có quyền quản lý tỷ giá nhập tỷ giá (MAN_HINH_17); hàng chưa nhập đủ số khai thì không ghi sổ tờ khai; kỳ đã khóa thì không ghi sổ.

Trạng thái tờ khai và chứng từ chi phí: `draft` (Nháp) → `posted` (Đã ghi sổ); nháp hủy được thành `cancelled` (Đã hủy), không xóa cứng (tài liệu `19` mục 3 ý 2).

## 9. Định khoản

Vai trò tài khoản mới (định khoản mặc định sửa được ở cài đặt kế toán, CONG_VIEC_14):

| Vai trò                                           | Thông tư 99 | Thông tư 133 |
| ------------------------------------------------- | ----------- | ------------ |
| `import_duty` Thuế nhập khẩu                      | 3333        | 3333         |
| `excise_tax` Thuế tiêu thụ đặc biệt               | 3332        | 3332         |
| `environmental_tax` Thuế bảo vệ môi trường        | 33381       | 3338         |
| `import_vat` Thuế giá trị gia tăng hàng nhập khẩu | 33312       | 33312        |

| Chứng từ                          | Bút toán                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phiếu nhập mua theo đơn nhập khẩu | Nợ `goods` 156 / Có `payable` 331 (đối tác nhà cung cấp) theo tiền tệ công ty; không có dòng thuế đầu vào                                              |
| Trả hàng nhà cung cấp nước ngoài  | Nợ `payable` / Có `goods` theo tỷ giá phiếu nhập gốc                                                                                                   |
| Tờ khai ghi sổ                    | Nợ `goods` (phần tồn), Nợ `cogs` 632 (phần đã xuất) / Có `import_duty`, Có `excise_tax`, Có `environmental_tax`; Nợ `vat_input` 1331 / Có `import_vat` |
| Chứng từ chi phí ghi sổ           | Nợ `goods` (phần tồn), Nợ `cogs` (phần đã xuất), Nợ `vat_input` / Có `payable` (nhà cung cấp dịch vụ)                                                  |

Số chứng từ: tờ khai dùng số tờ khai hải quan; chứng từ chi phí dùng dãy số mới `purchasing.landed_cost` (tiền tố `CPNK`).

## 10. Màn hình

| Mã                    | Màn hình                   | Đường dẫn                              | Mô tả                                                                                                                                                                                            |
| --------------------- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MAN_HINH_110          | Tờ khai nhập khẩu          | `/purchasing/import-declarations`      | Danh sách lọc trạng thái, nhà cung cấp, đơn mua; nút "Lập tờ khai" (chọn đơn mua nhập khẩu)                                                                                                      |
| MAN_HINH_111          | Chi tiết tờ khai           | `/purchasing/import-declarations/[id]` | Đầu tờ khai, bảng dòng: trị giá, thuế từng loại (gợi ý, đánh dấu đã sửa), tổng; nút "Lưu", "Ghi sổ", "Hủy"; sau ghi sổ: bảng phân bổ (vào tồn, vào giá vốn hàng bán), chứng từ chi phí liên quan |
| MAN_HINH_112          | Chi phí nhập khẩu          | `/purchasing/landed-costs`             | Danh sách lọc trạng thái, tờ khai, nhà cung cấp dịch vụ; nút "Lập chứng từ chi phí"                                                                                                              |
| MAN_HINH_113          | Chi tiết chi phí nhập khẩu | `/purchasing/landed-costs/[id]`        | Đầu chứng từ, bảng khoản chi phí (loại, tiền, thuế suất, tiêu thức), "Xem trước phân bổ" theo dòng tờ khai; nút "Lưu", "Ghi sổ", "Hủy"                                                           |
| MAN_HINH_40, 41 (sửa) | Đơn mua                    |                                        | Ô "Nhập khẩu", "Tiền tệ"; tiền hiện kèm mã tiền tệ; giá trị quy đổi; khối "Tờ khai nhập khẩu" ở chi tiết                                                                                         |
| MAN_HINH_32 (sửa)     | Chi tiết phiếu kho         |                                        | Phiếu nhập, trả theo đơn ngoại tệ hiện "Tỷ giá", giá trị ngoại tệ; dòng điều chỉnh giá trị ở thẻ kho                                                                                             |

Menu Mua hàng thêm "Tờ khai nhập khẩu", "Chi phí nhập khẩu" (quyền `purchasing.import.view`) sau "Đơn mua". Bản mẫu: `tai_lieu/ban_mau/MAN_HINH_110_TO_KHAI_NHAP_KHAU.html` đến `MAN_HINH_113_CHI_TIET_CHI_PHI_NHAP_KHAU.html`.

## 11. Dữ liệu và API

- Database migration `0067_import_orders.sql`: `purchasing.orders` thêm `is_import`; `inventory.documents` thêm `exchange_rate`, `currency` (phiếu nhập, trả theo đơn ngoại tệ); `finance.debt_items` thêm `currency`, `foreign_amount`, `exchange_rate` (chỉ hiển thị, đối chiếu); sửa `finance.inventory_amounts`, `finance.inventory_debt_amount` nhân tỷ giá của phiếu.
- Database migration `0068_import_declarations.sql`: `purchasing.import_declarations`, `purchasing.import_declaration_lines`; `inventory.documents` thêm loại `cost_adjustment` (phiếu điều chỉnh giá trị do Kho ghi, nguồn là tờ khai hoặc chứng từ chi phí, không sinh bút toán riêng); `inventory.document_lines` thêm `expensed_value` (phần vào giá vốn hàng bán); `accounting.journals` thêm nguồn `import_declaration`, `landed_cost`; vai trò tài khoản mới.
- Database migration `0069_landed_costs.sql`: `purchasing.landed_costs`, `purchasing.landed_cost_lines`, `purchasing.landed_cost_allocations` (kết quả phân bổ theo khoản, dòng tờ khai); `finance.debt_items` thêm nguồn `landed_cost`; dãy số `purchasing.landed_cost`.
- Ranh giới module: Mua hàng ghi `purchasing`; Kho ghi phiếu điều chỉnh giá trị qua `StockLedgerService` (thêm cách ghi tăng giảm giá trị không đổi số lượng); Tài chính ghi công nợ qua `DebtsService`; Kế toán ghi bút toán qua `LedgerService`; mọi bước trong cùng giao dịch ghi sổ.

| Mã           | Đường dẫn                                                              | Mô tả                                                                                   |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| API_140      | `/purchasing/import-declarations`                                      | Danh sách, lập, đọc, sửa nháp, hủy nháp tờ khai; dòng đơn mua còn khai được; gợi ý thuế |
| API_141      | `/purchasing/import-declarations/{id}/post` (và `/allocation-preview`) | Xem trước phân bổ, ghi sổ tờ khai                                                       |
| API_142      | `/purchasing/landed-costs`                                             | Danh sách, lập, đọc, sửa nháp, hủy nháp chứng từ chi phí                                |
| API_143      | `/purchasing/landed-costs/{id}/post` (và `/allocation-preview`)        | Xem trước phân bổ, ghi sổ chứng từ chi phí                                              |
| API_75 (sửa) | `/purchasing/orders`                                                   | Thêm `isImport`, `currency`, giá trị quy đổi khi đọc                                    |

## 12. Tiêu chí nghiệm thu

| Mã                    | Chức năng                    | Tiêu chí                                                                                                                                                                                                                                                                           | Cách kiểm tra      | Mức      |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------- |
| TIEUCHI_NGHIEMTHU_282 | CHUC_NANG_160                | Đơn nhập khẩu ngoại tệ luôn đi luồng duyệt, giá trị duyệt quy đổi đúng; phiếu nhập ghi sổ kho theo tỷ giá hạch toán ngày phiếu; thiếu tỷ giá không gửi được; công nợ, bút toán theo tiền tệ công ty kèm ngoại tệ; trả hàng theo tỷ giá phiếu gốc; đơn trong nước không đổi hành vi | Gọi API            | Bắt buộc |
| TIEUCHI_NGHIEMTHU_283 | CHUC_NANG_160                | Thuế gợi ý đúng công thức QUYTAC_NGHIEPVU_287 (gồm thuế giá trị gia tăng tính trên trị giá cộng các thuế); sửa số thuế được và đánh dấu; khai vượt số đặt, trùng số tờ khai bị từ chối                                                                                             | Gọi API            | Bắt buộc |
| TIEUCHI_NGHIEMTHU_284 | CHUC_NANG_160, CHUC_NANG_161 | Ghi sổ tờ khai khi hàng chưa nhập đủ, kỳ đã khóa bị từ chối; sau ghi sổ giá vốn bình quân tăng đúng phần tồn, phần đã xuất vào 632, serial cộng đúng giá đích danh; bút toán đúng tài khoản ở công ty Thông tư 99 và công ty Thông tư 133; tờ khai đã ghi sổ không sửa được        | Gọi API            | Bắt buộc |
| TIEUCHI_NGHIEMTHU_285 | CHUC_NANG_161                | Phân bổ theo giá trị, theo số lượng đúng tỷ lệ, tổng các phần bằng đúng số tiền khoản chi phí; chi phí ngoại tệ quy đổi đúng; ghi sổ sinh công nợ nhà cung cấp dịch vụ gồm thuế và bút toán đúng; tờ khai chưa ghi sổ không chọn được                                              | Gọi API            | Bắt buộc |
| TIEUCHI_NGHIEMTHU_286 | CHUC_NANG_160, CHUC_NANG_161 | Nhân viên công ty khác không xem, không ghi sổ được tờ khai, chứng từ chi phí; người không có `purchasing.import.manage` không lập, không ghi sổ được; Thủ kho không thấy menu nhập khẩu                                                                                           | Gọi API, giao diện | Bắt buộc |

## 13. Kịch bản kiểm thử

KICHBAN_KIEMTHU_428 đến KICHBAN_KIEMTHU_433 (tài liệu `21`, ghi qua phiên cha):

| Mã                  | Tiêu chí              | Kịch bản                                                                                                        |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| KICHBAN_KIEMTHU_428 | TIEUCHI_NGHIEMTHU_282 | Đơn USD, duyệt quy đổi; nhập kho có, không có tỷ giá; công nợ kèm ngoại tệ; trả hàng; đơn trong nước giữ nguyên |
| KICHBAN_KIEMTHU_429 | TIEUCHI_NGHIEMTHU_283 | Gợi ý thuế từng loại, giá trị biên thuế suất 0; sửa số thuế; khai vượt; trùng số tờ khai                        |
| KICHBAN_KIEMTHU_430 | TIEUCHI_NGHIEMTHU_284 | Ghi sổ khi đã bán một phần: phần tồn, phần 632; chưa nhập đủ; kỳ khóa; kiểm kê đang đếm                         |
| KICHBAN_KIEMTHU_431 | TIEUCHI_NGHIEMTHU_284 | Hàng serial; bút toán công ty Thông tư 99 và Thông tư 133                                                       |
| KICHBAN_KIEMTHU_432 | TIEUCHI_NGHIEMTHU_285 | Hai khoản chi phí khác tiêu thức, làm tròn ba dòng; chi phí ngoại tệ; công nợ, bút toán                         |
| KICHBAN_KIEMTHU_433 | TIEUCHI_NGHIEMTHU_286 | Công ty khác, vai trò không có quyền, Thủ kho                                                                   |

## 14. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Tiền dùng `numeric`; làm tròn theo đơn vị nhỏ nhất của tiền tệ công ty bằng hàm có sẵn `finance.company_minor_units`.
- Dùng lại: luồng duyệt (quy đổi ngoại tệ có sẵn), bảng tỷ giá, dãy số chứng từ, sổ kho, khóa sổ (`period-guard`), sinh bút toán, công nợ.
- Khóa ngoại từ `purchasing` chỉ trỏ vào `purchasing`, `core`, `catalog`, `crm`.

## 15. Thành phần không được thay đổi

API, dữ liệu, giao diện của đơn mua trong nước, phiếu nhập mua, trả hàng theo đơn tiền tệ công ty, công nợ, bút toán hiện có, trừ phần sửa ghi ở mục 10, 11. Kiểm thử hồi quy toàn bộ `pnpm --filter api test`.

## 16. Các lát và điểm xem trước

| Lát | Nội dung                                                                                                                  | Màn hình, API                     | Tiêu chí                        |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| L0  | Database migration 0067; đơn nhập khẩu ngoại tệ, phiếu nhập và trả hàng theo tỷ giá, công nợ kèm ngoại tệ                 | MAN_HINH_40, 41, 32 (sửa); API_75 | TIEUCHI_NGHIEMTHU_282           |
| L1  | Database migration 0068; quyền; tờ khai, gợi ý thuế, ghi sổ, phân bổ thuế vào giá vốn, phiếu điều chỉnh giá trị, bút toán | MAN_HINH_110, 111; API_140, 141   | TIEUCHI_NGHIEMTHU_283, 284, 286 |
| L2  | Database migration 0069; chứng từ chi phí, phân bổ, công nợ nhà cung cấp dịch vụ, bút toán                                | MAN_HINH_112, 113; API_142, 143   | TIEUCHI_NGHIEMTHU_285, 286      |

Sau mỗi lát: chạy ứng dụng, chụp màn hình, gửi báo cáo ngắn cho phiên cha.

## 17. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
