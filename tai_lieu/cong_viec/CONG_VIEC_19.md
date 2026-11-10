# CONG_VIEC_19: Đối soát thu hộ COD, cổng thanh toán (MODULE_06, phần 7)

- Mô tả: Khai đơn vị thu hộ (nhà vận chuyển thu COD, cổng thanh toán); nhập bảng đối soát từ tệp Excel theo mẫu chung; ghép từng dòng với đơn bán; ghi sổ thì trừ nợ khách theo đơn, chuyển thành nợ của đơn vị thu hộ, phí vào chi phí bán hàng; tiền đơn vị thu hộ chuyển về ngân hàng lập phiếu thu của đơn vị thu hộ và được đối soát ngân hàng tự ghép.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp, chờ người dùng xác nhận thiết kế.
- Nguồn: tài liệu `04` mục 6, `05` mục 2.1; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02` (làm cả COD, cổng thanh toán; nhập từ tệp theo mẫu chung; phí vào chi phí bán hàng; ghi nhận khách đã trả khi ghi sổ bảng đối soát; chênh lệch cho ghi sổ kèm cảnh báo; duyệt theo chính sách duyệt công ty).

## 1. Mục tiêu

Kế toán biết đơn nào đơn vị thu hộ đã thu, phí bao nhiêu, đơn vị thu hộ còn nợ bao nhiêu; công nợ khách, hoa hồng theo tiền đã thu đúng mà không nhập tay từng đơn.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_88 đến CHUC_NANG_91.

Ngoài phạm vi:
- Kết nối API trực tiếp với nhà vận chuyển, cổng thanh toán; đọc tệp riêng của từng đơn vị (thêm khi có tệp thật).
- Hoàn tiền, khiếu nại giao dịch (số thu hộ âm), phí vận chuyển thu riêng không gắn đơn.
- Hóa đơn phí của đơn vị thu hộ (thuế giá trị gia tăng đầu vào của phí).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_44 | Đối soát tiền đơn vị thu hộ (COD, cổng thanh toán) đã thu với đơn bán, ghi nhận phí, theo dõi tiền đơn vị thu hộ còn phải trả | Kế toán, Kế toán trưởng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_88 | Đơn vị thu hộ: chọn đối tác (phải có hồ sơ khách hàng của công ty), loại (thu COD, cổng thanh toán), ngừng dùng | YCAU_NGHIEPVU_44 |
| CHUC_NANG_89 | Bảng đối soát: tải tệp mẫu, nhập tệp Excel (số bảng của đơn vị, ngày, các dòng), ghép dòng với đơn bán, cảnh báo, sửa bằng nhập lại hoặc bỏ dòng | YCAU_NGHIEPVU_44 |
| CHUC_NANG_90 | Gửi bảng đối soát theo chính sách duyệt; ghi sổ: trừ nợ khách theo đơn, nợ đơn vị thu hộ, bút toán; rút, bị từ chối sửa gửi lại, bỏ bảng nháp | YCAU_NGHIEPVU_44 |
| CHUC_NANG_91 | Xem bảng đối soát theo đơn vị, trạng thái, khoảng ngày; tổng thu hộ, phí, thực nhận | YCAU_NGHIEPVU_44 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_118: Mẫu chung, trang đầu, dòng 1 là tiêu đề: Mã vận đơn hoặc mã giao dịch (bắt buộc, tối đa 100 ký tự), Số đơn bán (bắt buộc), Tiền thu hộ (không âm), Phí (không âm), Ngày thu (không bắt buộc). Tối đa 5.000 dòng. Thực nhận = tổng tiền thu hộ − tổng phí.
- QUYTAC_NGHIEPVU_119: Lỗi chặn gửi: không tìm thấy đơn bán của công ty, đơn đã hủy, mã trùng trong bảng, mã đã có trong bảng khác (chưa bị từ chối, đã rút) của cùng đơn vị. Cảnh báo không chặn: tiền thu hộ khác số khách còn nợ của đơn (thiếu thì đơn còn nợ phần thiếu; thừa thì thành tiền trả trước của khách).
- QUYTAC_NGHIEPVU_120: Ghi sổ: mỗi dòng có khách thì lập khoản giảm nợ của khách, trừ trước vào các phiếu xuất giao hàng của đơn đó, phần thừa là trả trước; đơn không có khách chỉ có bút toán. Lập khoản tăng nợ của đơn vị thu hộ bằng thực nhận (trừ tiền trả trước của đơn vị nếu có). Khoản trừ nợ khách tính là tiền đã thu cho hoa hồng (CONG_VIEC_17).
- QUYTAC_NGHIEPVU_121: Bút toán ngày bảng đối soát: Nợ phải thu đơn vị thu hộ (1388, chi tiết đối tác) / Có phải thu khách hàng (131, chi tiết khách) theo từng dòng; Nợ chi phí thu hộ (6418 theo Thông tư 99, 6421 theo Thông tư 133) / Có 1388 phần phí. Vai trò định khoản sửa được.
- QUYTAC_NGHIEPVU_122: Bảng đã ghi sổ không sửa, không xóa. Duyệt theo chính sách duyệt công ty (loại chứng từ `finance.collection_statement`); không có chính sách thì ghi sổ ngay khi gửi.

## 5. Vai trò và quyền

| Vai trò | Quyền |
|---|---|
| Kế toán | Xem, nhập, gửi, rút, bỏ bảng nháp (`finance.collection.view`, `finance.collection.manage`) |
| Kế toán trưởng, Quản trị công ty | Như kế toán; khai đơn vị thu hộ (`finance.collection.setup`) |

## 6. Luồng nghiệp vụ

Luồng 31 (tài liệu `09`): khai đơn vị thu hộ → nhận tệp đối soát từ đơn vị → nhập tệp, sửa lỗi → gửi (duyệt nếu có chính sách) → ghi sổ → tiền về ngân hàng: lập phiếu thu của đơn vị thu hộ (đối soát ngân hàng tự ghép theo số tiền thực nhận).

## 7. Màn hình

- MAN_HINH_60 Đối soát thu hộ: danh sách bảng (đơn vị, số bảng, ngày, tổng thu hộ, phí, thực nhận, trạng thái), nhập tệp, tải mẫu; thẻ Đơn vị thu hộ.
- MAN_HINH_61 Chi tiết bảng đối soát: thông tin, tổng, các dòng (mã, đơn bán, khách, tiền thu hộ, phí, số còn nợ của đơn khi nhập, lỗi, cảnh báo), bỏ dòng, nhập lại, gửi, rút, bỏ bảng nháp.

## 8. Dữ liệu và API

- `finance.collectors`, `finance.collection_statements`, `finance.collection_statement_lines`; nguồn công nợ, nguồn bút toán `collection_statement`; vai trò định khoản `collector_receivable`, `collection_fee`.
- API_102 đơn vị thu hộ; API_103 bảng đối soát (danh sách, nhập tệp, tải mẫu); API_104 chi tiết, bỏ dòng, gửi, rút, bỏ bảng nháp; API_105 tệp mẫu.

## 9. Điều kiện đặc biệt

Tệp chỉ đọc giá trị ô, không chạy công thức; tối đa 5 MB.

## 10. Tiêu chí nghiệm thu

Lập sau khi người dùng xác nhận thiết kế (TIEUCHI_NGHIEMTHU_139 trở đi).

## 11. Kịch bản kiểm thử

Lập sau khi người dùng xác nhận thiết kế (KICHBAN_KIEMTHU_261 trở đi).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện (đọc Excel bằng thư viện đang dùng cho nhập sản phẩm). Trừ nợ qua `DebtsService.matchCredit`, `matchDebit`; bút toán qua `ledger.record`; duyệt qua `approvals.submitWithin`.

## 13. Thành phần không được thay đổi

Ghi sổ phiếu kho, phiếu thu chi, bút toán đã có. Thay đổi nhỏ: hoa hồng tính thêm khoản giảm nợ nguồn `collection_statement` như phiếu thu.

## 14. Các lát và điểm xem trước

- L0: đơn vị thu hộ, nhập tệp, ghép đơn, lỗi, cảnh báo, xem bảng. Điểm xem trước: nhập tệp mẫu trên dữ liệu phát triển.
- L1: gửi, duyệt, ghi sổ, công nợ, bút toán, hoa hồng; phiếu thu đơn vị thu hộ ghép ngân hàng.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
