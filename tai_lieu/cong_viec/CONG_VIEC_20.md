# CONG_VIEC_20: Báo cáo tài chính hợp nhất (MODULE_06, phần 8)

- Mô tả: Lập bảng hợp nhất theo kỳ cho tập đoàn: cộng gộp số liệu sổ cái các công ty cùng đồng tiền hạch toán, tự lập bút toán loại trừ công nợ nội bộ, doanh thu và giá vốn bán nội bộ, lãi chưa thực hiện trong hàng tồn kho (ước tính, sửa được), điều chỉnh tay; lập B01-DN, B02-DN hợp nhất; gửi duyệt, đã duyệt giữ nguyên số; xuất Excel, PDF.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng xác nhận thiết kế ngày 2026-11-10; đã lập trình lát L0.
- Nguồn: tài liệu `04` mục 6, `05` mục 2.1 (báo cáo hợp nhất); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Ban điều hành tập đoàn có báo cáo tình hình tài chính và kết quả kinh doanh của cả tập đoàn như một đơn vị, không bị thổi phồng bởi mua bán, công nợ giữa các công ty trong tập đoàn.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_92 đến CHUC_NANG_95.

Ngoài phạm vi:
- Tỷ lệ sở hữu dưới 100%, lợi ích cổ đông không kiểm soát, lợi thế thương mại, công ty liên doanh, liên kết.
- Quy đổi báo cáo công ty khác đồng tiền hạch toán.
- Báo cáo lưu chuyển tiền tệ, thuyết minh hợp nhất.
- Lãi chưa thực hiện của kỳ trước chuyển sang (chỉ xét hàng mua nội bộ trong kỳ).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_45 | Lập báo cáo tài chính hợp nhất của tập đoàn theo kỳ, loại trừ giao dịch nội bộ, có duyệt | Kế toán trưởng tập đoàn, Ban điều hành |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_92 | Phạm vi hợp nhất: công ty mẹ và các công ty con; công ty bị loại (khác đồng tiền, chưa khởi tạo kế toán) hiện kèm lý do | YCAU_NGHIEPVU_45 |
| CHUC_NANG_93 | Bảng hợp nhất theo kỳ: cộng gộp số dư, phát sinh theo mã tài khoản; bút toán loại trừ tự động (công nợ nội bộ, doanh thu và giá vốn nội bộ, lãi chưa thực hiện trong tồn kho) | YCAU_NGHIEPVU_45 |
| CHUC_NANG_94 | Sửa số lãi chưa thực hiện ước tính từng mặt hàng; bút toán điều chỉnh tay (ví dụ loại trừ khoản đầu tư vào công ty con với vốn chủ sở hữu); tính lại | YCAU_NGHIEPVU_45 |
| CHUC_NANG_95 | B01-DN, B02-DN hợp nhất (cột cộng gộp, loại trừ, hợp nhất); gửi duyệt, đã duyệt giữ nguyên số; xuất Excel, PDF | YCAU_NGHIEPVU_45 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_123: Tập đoàn là công ty gốc (không có công ty cha) của công ty đang chọn. Thành viên: công ty gốc và mọi công ty con các cấp đã khởi tạo kế toán, cùng đồng tiền hạch toán với công ty gốc. Công ty khác đồng tiền, chưa khởi tạo kế toán bị loại, hiện lý do. Coi như sở hữu 100%.
- QUYTAC_NGHIEPVU_124: Cộng gộp theo mã tài khoản của Thông tư 99; công ty theo Thông tư 133 ghép theo mã cùng số, riêng 6421 vào 641, 6422 vào 642 (bảng ánh xạ trong mã). Số liệu từng công ty tính như báo cáo tài chính của công ty (kể cả đã hay chưa khóa sổ).
- QUYTAC_NGHIEPVU_125: Loại trừ công nợ nội bộ: số dư cuối kỳ của tài khoản phải thu, phải trả, phải thu khác, phải trả khác có đối tác là công ty thành viên; loại trừ theo từng cặp công ty phần nhỏ hơn của hai bên (Nợ phải trả / Có phải thu); phần chênh hiện cảnh báo để kế toán đối chiếu, điều chỉnh tay.
- QUYTAC_NGHIEPVU_126: Loại trừ doanh thu, giá vốn nội bộ trong kỳ: doanh thu thuần của phiếu xuất bán (trừ nhận hàng trả lại) cho khách là công ty thành viên: Nợ 511 / Có 632.
- QUYTAC_NGHIEPVU_127: Lãi chưa thực hiện: mỗi công ty mua, mỗi mặt hàng mua nội bộ trong kỳ: số lượng còn tồn cuối kỳ (tối đa bằng số đã mua nội bộ trong kỳ) × lãi gộp mỗi đơn vị của bên bán (doanh thu thuần trừ giá vốn trên số lượng bán nội bộ mặt hàng đó trong kỳ, không âm): Nợ 632 / Có 156. Kế toán trưởng sửa được số từng dòng khi bảng còn nháp.
- QUYTAC_NGHIEPVU_128: Bảng hợp nhất theo kỳ (từ ngày, đến ngày), trạng thái nháp, chờ duyệt, đã duyệt, bị từ chối, đã rút; mỗi kỳ một bảng đang dùng. Tính lại lấy số mới từ sổ các công ty, giữ số đã sửa tay. Duyệt theo chính sách duyệt của công ty gốc; đã duyệt thì lưu số báo cáo, không tính lại.

## 5. Vai trò và quyền

| Vai trò | Quyền |
|---|---|
| Kế toán trưởng có phạm vi tập đoàn | Xem, lập, tính lại, sửa, gửi bảng hợp nhất (`finance.consolidation.view`, `finance.consolidation.manage`) |
| Quản trị tập đoàn | Như trên |

Quyền chỉ có hiệu lực khi được gán ở phạm vi tập đoàn.

## 6. Luồng nghiệp vụ

Luồng 32 (tài liệu `09`): các công ty ghi sổ đủ trong kỳ → lập bảng hợp nhất kỳ → xem cộng gộp, loại trừ, cảnh báo chênh lệch công nợ → sửa lãi chưa thực hiện, thêm điều chỉnh tay → tính lại → gửi duyệt → đã duyệt: xuất Excel, PDF.

## 7. Màn hình

- MAN_HINH_62 Hợp nhất: danh sách bảng theo kỳ, lập bảng; phạm vi thành viên.
- MAN_HINH_63 Chi tiết bảng hợp nhất: thẻ Báo cáo (B01-DN, B02-DN cột cộng gộp, loại trừ, hợp nhất), thẻ Loại trừ (bút toán tự động, chênh lệch công nợ), thẻ Lãi chưa thực hiện (sửa số), thẻ Điều chỉnh tay; gửi, rút, tính lại, xuất.

## 8. Dữ liệu và API

- `finance.consolidations` (tập đoàn, kỳ, trạng thái, số liệu báo cáo đã chốt), `finance.consolidation_entries` (bút toán loại trừ, điều chỉnh: loại, tài khoản Nợ, Có, số tiền, công ty liên quan), `finance.consolidation_profit_lines` (lãi chưa thực hiện từng mặt hàng: số ước tính, số sửa).
- API_106 phạm vi, danh sách, lập; API_107 chi tiết, tính lại, báo cáo; API_108 sửa lãi chưa thực hiện, điều chỉnh tay; API_109 gửi, rút, xuất.

## 9. Điều kiện đặc biệt

Số liệu đọc từ sổ cái các công ty tại thời điểm tính; bảng hợp nhất không ghi bút toán vào sổ công ty con.

## 10. Tiêu chí nghiệm thu

Lập sau khi người dùng xác nhận thiết kế (TIEUCHI_NGHIEMTHU_145 trở đi).

## 11. Kịch bản kiểm thử

Lập sau khi người dùng xác nhận thiết kế (KICHBAN_KIEMTHU_270 trở đi).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại cách tính, mẫu báo cáo, xuất Excel, PDF của CONG_VIEC_15 (tách phần đọc số liệu để nhận số cộng gộp); duyệt qua `approvals.submitWithin`.

## 13. Thành phần không được thay đổi

Báo cáo tài chính từng công ty (CONG_VIEC_15) cho kết quả như cũ; không ghi bút toán vào sổ các công ty.

## 14. Các lát và điểm xem trước

- L0: phạm vi, quyền tập đoàn, cộng gộp B01-DN, B02-DN chưa loại trừ. Điểm xem trước: báo cáo cộng gộp hai công ty trên dữ liệu phát triển.
- L1: bảng hợp nhất theo kỳ, loại trừ tự động, lãi chưa thực hiện, điều chỉnh tay, cột loại trừ.
- L2: gửi duyệt, chốt số, xuất Excel, PDF.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
