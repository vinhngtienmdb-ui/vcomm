# CONG_VIEC_20: Báo cáo tài chính hợp nhất (MODULE_06, phần 8)

- Mô tả: Lập bảng hợp nhất theo kỳ cho tập đoàn: cộng gộp số liệu sổ cái các công ty cùng đồng tiền hạch toán, tự lập bút toán loại trừ công nợ nội bộ, doanh thu và giá vốn bán nội bộ, lãi chưa thực hiện trong hàng tồn kho (ước tính, sửa được), điều chỉnh tay; lập B01-DN, B02-DN hợp nhất; gửi duyệt, đã duyệt giữ nguyên số; xuất Excel, PDF.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã nghiệm thu 2026-11-10, chờ phát hành.
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
- QUYTAC_NGHIEPVU_124: Cộng gộp theo mã tài khoản của Thông tư 99, mẫu B01-DN, B02-DN Thông tư 99; công ty theo Thông tư 133 ghép theo mã cùng số, riêng các mã bắt đầu bằng 6421 vào 641, 6422 vào 642, 3385 vào 3386, 3386 vào 344, 1386 vào 244, 2281 vào 222 (phần đuôi giữ nguyên; bảng ánh xạ `consolidatedCode` trong mã). Số liệu từng công ty tính như báo cáo tài chính của công ty (bút toán đã ghi sổ, kể cả kỳ đã hay chưa khóa sổ). Chỉ tiêu lấy số dư Nợ, số dư Có (không theo đối tác) tính theo từng công ty rồi cộng, không bù trừ số dư ngược chiều giữa các công ty (ví dụ thuế phải nộp của công ty này giữ ở chỉ tiêu 314, thuế nộp thừa của công ty kia giữ ở chỉ tiêu 163); báo cáo từng công ty không đổi. Lợi nhuận chưa kết chuyển cộng vào tài khoản lợi nhuận chưa phân phối của thành viên đứng đầu (công ty gốc khi được hợp nhất). Tháng bắt đầu năm tài chính, số lẻ tiền tệ theo công ty gốc. Điều chỉnh tay ghi theo mã Thông tư 99; mỗi dòng chọn được công ty thành viên (có chọn thì lấy tài khoản của công ty đó, không chọn thì lấy tài khoản của thành viên đứng đầu trước) và đối tác; tài khoản mà B01-DN lấy số dư theo đối tác (các mã trong công thức số dư theo đối tác của mẫu Thông tư 99, như 131, 331) bắt buộc chọn đối tác.
- QUYTAC_NGHIEPVU_125: Loại trừ công nợ nội bộ: số dư đến hết ngày cuối kỳ theo từng tài khoản, đối tác là công ty thành viên khác: phải thu 131, 1388, 136 (chỉ số dư Nợ) và phải trả 331, 3388, 336 (chỉ số dư Có), kể cả tài khoản chi tiết; loại trừ theo từng cặp công ty phần nhỏ hơn của tổng phải thu bên này và tổng phải trả bên kia (Nợ phải trả / Có phải thu, chia lần lượt theo từng tài khoản, đối tác); hai bên lệch nhau thì hiện cảnh báo (phải thu, phải trả, chênh lệch) để kế toán đối chiếu, điều chỉnh tay. Trả trước nội bộ xử lý cùng cách theo chiều ngược lại: phải thu dư Có (người mua trả tiền trước, ví dụ 131 dư Có theo đối tác là thành viên) với phải trả dư Nợ (trả trước cho người bán, ví dụ 331 dư Nợ), loại trừ phần nhỏ hơn bằng bút toán "Loại trừ trả trước nội bộ" Nợ phải thu / Có phải trả; lệch thì cảnh báo như công nợ (phải thu là số dư Có, phải trả là số dư Nợ, số dương).
- QUYTAC_NGHIEPVU_126: Loại trừ doanh thu, giá vốn nội bộ trong kỳ: theo từng cặp công ty bán, công ty mua, doanh thu thuần trên bút toán đã ghi sổ trong kỳ của phiếu xuất giao hàng (tài khoản vai trò `revenue`) trừ phiếu nhận hàng trả lại (tài khoản vai trò `sales_return`) cho đối tác là công ty thành viên: Nợ tài khoản doanh thu / Có tài khoản giá vốn (vai trò `cogs`) của bên bán (511 / 632); số âm thì ghi ngược lại.
- QUYTAC_NGHIEPVU_127: Lãi chưa thực hiện: mỗi công ty mua, mỗi mặt hàng mua nội bộ trong kỳ: số lượng còn tồn cuối kỳ (tối đa bằng số đã mua nội bộ trong kỳ) × lãi gộp mỗi đơn vị, tính trên phần bên mua thực nhận theo đơn vị của bên mua, không âm: (doanh thu − giá vốn) ÷ số nhận, trong đó doanh thu = giá nhập nội bộ (đơn giá phiếu nhập) × số nhận, giá vốn = giá vốn dòng xuất của bên bán × giá trị đã nhận ÷ giá trị đã xuất (giao thiếu không làm tăng lãi mỗi đơn vị). Bên mua mua cùng mặt hàng từ nhiều bên bán: tồn cuối kỳ (tối đa tổng số đã mua nội bộ trong kỳ) phân bổ cho từng bên bán theo tỷ lệ số đã mua. Kết quả làm tròn theo số lẻ tiền tệ của công ty gốc. Hàng mua nội bộ là phiếu nhập mua đối ứng đã ghi sổ, ngày phiếu trong kỳ; số tồn cuối kỳ là tồn mọi kho của bên mua đến hết ngày cuối kỳ (giờ Việt Nam). Nợ giá vốn (vai trò `cogs`) / Có hàng hóa (vai trò `goods`) của bên mua (632 / 156), gộp một bút toán. Người có quyền lập bảng sửa được số từng dòng (không âm, bắt buộc lý do) hoặc trở lại số ước tính khi bảng còn sửa được.
- QUYTAC_NGHIEPVU_128: Bảng hợp nhất theo kỳ (từ ngày, đến ngày), trạng thái nháp (`draft`), chờ duyệt (`pending`), đã chốt số (`posted`, nhãn giao diện "Đã ghi sổ"), bị từ chối (`rejected`), đã rút (`withdrawn`); mỗi kỳ (cùng từ ngày, đến ngày) một bảng không bị từ chối, không rút. Lập bảng là tính ngay. Tính lại lấy số mới từ sổ các công ty, chốt lại danh sách thành viên, lập lại bút toán loại trừ tự động, giữ số lãi chưa thực hiện đã sửa tay và điều chỉnh tay. Sửa, tính lại, gửi khi bảng nháp, bị từ chối, đã rút; bỏ được bảng nháp chưa gửi lần nào. Gửi: lần đầu cấp số theo dãy `HN` của công ty gốc, gửi lại giữ số; duyệt theo chính sách duyệt loại `finance.consolidation` của công ty gốc (giá trị duyệt là tổng tài sản hợp nhất, chỉ tiêu 280; ngày chứng từ là đến ngày); chưa có chính sách thì chốt số ngay. Gửi tự tính lại theo sổ hiện tại rồi lưu số báo cáo B01-DN, B02-DN vào bảng ngay lúc gửi (người duyệt thấy đúng số sẽ chốt); bảng chờ duyệt và đã chốt hiện số lưu lúc gửi; duyệt xong chuyển đã chốt số với số đã lưu, sau đó không tính lại, không sửa; duyệt xong mà không chốt được thì bảng về bị từ chối kèm lý do. Lập bảng, gửi lại bảng bị từ chối hoặc đã rút khi kỳ đã có bảng khác không bị từ chối, không rút: báo "Kỳ này đã có bảng hợp nhất đang dùng.". Chỉ người gửi lần gần nhất rút bảng chờ duyệt.

## 5. Vai trò và quyền

| Vai trò | Quyền |
|---|---|
| Kế toán trưởng có phạm vi tập đoàn | Xem, lập, tính lại, sửa, gửi bảng hợp nhất (`finance.consolidation.view`, `finance.consolidation.manage`) |
| Quản trị tập đoàn | Như trên |

Quyền chỉ có hiệu lực khi được gán ở phạm vi tập đoàn. Vai trò hệ thống Kế toán trưởng, Quản trị tập đoàn có sẵn hai quyền; Quản trị công ty không có. `finance.consolidation.manage` là quyền nhạy cảm. Xem trước cộng gộp, danh sách, chi tiết, xuất cần một trong hai quyền; lập, tính lại, sửa, gửi, rút, bỏ bảng nháp cần `finance.consolidation.manage`.

## 6. Luồng nghiệp vụ

Luồng 32 (tài liệu `09`): các công ty ghi sổ đủ trong kỳ → lập bảng hợp nhất kỳ → xem cộng gộp, loại trừ, cảnh báo chênh lệch công nợ → sửa lãi chưa thực hiện, thêm điều chỉnh tay → tính lại → gửi duyệt → đã chốt số. Xuất Excel, PDF được ở mọi trạng thái (bảng đã chốt xuất số đã chốt).

## 7. Màn hình

- MAN_HINH_62 Báo cáo tài chính hợp nhất: phạm vi thành viên (lý do bị loại); thẻ "Bảng hợp nhất" (danh sách bảng theo kỳ, lập bảng), thẻ "Xem nhanh cộng gộp" (B01-DN, B02-DN cộng gộp chưa loại trừ theo khoảng ngày).
- MAN_HINH_63 Chi tiết bảng hợp nhất: thẻ thông tin (trạng thái, số, thành viên, thời điểm tính lại, cảnh báo chênh lệch công nợ nội bộ); gửi, rút, xuất, tính lại, bỏ bảng nháp; thẻ "Tình hình tài chính", "Kết quả kinh doanh" (cột cộng gộp, loại trừ, hợp nhất, cột so sánh cộng gộp), thẻ "Bút toán loại trừ" (bút toán tự động, lãi chưa thực hiện, điều chỉnh tay; thêm, xóa điều chỉnh tay), thẻ "Lãi chưa thực hiện" (sửa số).

## 8. Dữ liệu và API

- `finance.consolidations` (tập đoàn, kỳ, số, trạng thái, thành viên lúc tính lại, cảnh báo chênh lệch công nợ, số liệu báo cáo lưu lúc gửi), `finance.consolidation_entries` (bút toán công nợ nội bộ, doanh thu và giá vốn nội bộ, điều chỉnh tay: loại, công ty, tài khoản, đối tác, Nợ, Có), `finance.consolidation_profit_lines` (lãi chưa thực hiện từng mặt hàng: số ước tính, số sửa, lý do); bút toán lãi chưa thực hiện không lưu, tính từ các dòng lãi khi xem.
- API_106 phạm vi, xem trước cộng gộp, danh sách, lập; API_107 chi tiết (kèm báo cáo), tính lại, bỏ bảng nháp; API_108 sửa lãi chưa thực hiện, thêm, xóa điều chỉnh tay; API_109 gửi, rút, xuất.

## 9. Điều kiện đặc biệt

Số liệu đọc từ sổ cái các công ty tại thời điểm tính; bảng hợp nhất không ghi bút toán vào sổ công ty con.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_145 | Chỉ người có quyền ở phạm vi tập đoàn xem, lập; thành viên đúng; công ty khác đồng tiền, chưa khởi tạo kế toán bị loại kèm lý do | Bắt buộc | KICHBAN_KIEMTHU_270 |
| TIEUCHI_NGHIEMTHU_146 | Cộng gộp B01-DN, B02-DN theo mã Thông tư 99, công ty Thông tư 133 ghép mã; tổng tài sản bằng tổng nguồn vốn; báo cáo từng công ty không đổi | Bắt buộc | KICHBAN_KIEMTHU_271 |
| TIEUCHI_NGHIEMTHU_147 | Loại trừ công nợ nội bộ, trả trước nội bộ phần nhỏ hơn, cảnh báo chênh lệch; số dư ngược chiều của các công ty không bù trừ khi cộng gộp; loại trừ doanh thu thuần, giá vốn bán nội bộ; lãi chưa thực hiện ước tính đúng theo đơn vị bên mua; báo cáo hợp nhất cân | Bắt buộc | KICHBAN_KIEMTHU_272, 277 |
| TIEUCHI_NGHIEMTHU_148 | Sửa lãi chưa thực hiện cần lý do, giữ khi tính lại; điều chỉnh tay phải cân, đúng mã tài khoản, tài khoản lấy số dư theo đối tác phải chọn đối tác; xóa điều chỉnh tay | Bắt buộc | KICHBAN_KIEMTHU_273 |
| TIEUCHI_NGHIEMTHU_149 | Gửi theo chính sách duyệt của công ty gốc (không có thì chốt ngay); rút, gửi lại giữ số; đã chốt giữ nguyên số, không sửa; xuất Excel, PDF | Bắt buộc | KICHBAN_KIEMTHU_274, 275 |
| TIEUCHI_NGHIEMTHU_150 | MAN_HINH_62, 63 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang, không lỗi trình duyệt | Mong muốn | KICHBAN_KIEMTHU_276 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_270, 271, 277: tự động, `apps/api/test/c20-consolidation.test.ts`.
- KICHBAN_KIEMTHU_272 đến 275: tự động, `apps/api/test/c20-consolidation-eliminations.test.ts`.
- KICHBAN_KIEMTHU_276: thủ công trên trình duyệt (`tam_thoi/CONG_VIEC_20/xem_l0.js`, `xem_l1.js`, `xem_l2.js`): phạm vi, cộng gộp, lập bảng, điều chỉnh tay, gửi chốt số; khổ 1360 và 375 điểm ảnh. Xuất Excel, PDF kiểm ở KICHBAN_KIEMTHU_274.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại cách tính, mẫu báo cáo, xuất Excel, PDF của CONG_VIEC_15 (tách phần đọc số liệu để nhận số cộng gộp); duyệt qua `approvals.submitWithin`.

## 13. Thành phần không được thay đổi

Báo cáo tài chính từng công ty (CONG_VIEC_15) cho kết quả như cũ; không ghi bút toán vào sổ các công ty.

## 14. Các lát và điểm xem trước

- L0: phạm vi, quyền tập đoàn, cộng gộp B01-DN, B02-DN chưa loại trừ. Điểm xem trước: báo cáo cộng gộp hai công ty trên dữ liệu phát triển.
- L1: bảng hợp nhất theo kỳ, loại trừ tự động, lãi chưa thực hiện, điều chỉnh tay, cột loại trừ.
- L2: gửi duyệt, chốt số, xuất Excel, PDF.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

- Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu: Đạt (TIEUCHI_NGHIEMTHU_145 đến 149; quyền chỉ hiệu lực ở phạm vi tập đoàn).
- Đúng giao diện: Đạt (thành phần, biến dùng chung đã có; máy tính và điện thoại 375 điểm ảnh không cuộn ngang). Không có bản mẫu riêng, theo cách làm các màn hình Tài chính trước.
- Đã xử lý lỗi: Đạt (thông báo tiếng Việt, tiếng Anh; lỗi từng ô của điều chỉnh tay; lỗi ghi sổ hiện câu đã dịch).
- Đã kiểm thử: Đạt (tài liệu `25`, lần kiểm thử 2026-11-10 – CONG_VIEC_20).
- Không phá vỡ chức năng cũ: Đạt (hồi quy toàn bộ; báo cáo tài chính từng công ty dùng chung phần đọc số liệu mới, kết quả không đổi).
- Tiêu chí nghiệm thu bắt buộc: Đạt.
- Cổng bảo mật: Đạt (không lỗ hổng thư viện; không khóa bí mật trong commit; không lỗ hổng Nghiêm trọng, Cao còn lại).
- Tự rà soát mã, dọn dẹp: Đạt (rà soát độc lập, đã sửa các mục phát hiện; tệp tạm trong `tam_thoi/`; bảng nháp thử trên dữ liệu phát triển đã xóa).
- Tài liệu `27` và tài liệu liên quan: Đạt.

## 16. Giới hạn đã biết

- Cột so sánh (số đầu năm, cùng kỳ năm trước) chỉ là số cộng gộp, chưa loại trừ.
- Lãi chưa thực hiện chỉ xét hàng mua nội bộ trong kỳ; lãi chưa thực hiện của kỳ trước chưa chuyển sang; ước tính khi giá vốn bình quân.
- Không loại trừ tự động khoản đầu tư vào công ty con với vốn chủ sở hữu; làm bằng điều chỉnh tay.
- Chênh lệch công nợ nội bộ chỉ cảnh báo, không tự xử lý.
- Thuế giá trị gia tăng của giao dịch nội bộ không loại trừ.
- Bù trừ công nợ, trả trước nội bộ chỉ xét theo từng chiều: một đối tác vừa dư Nợ vừa dư Có ở các tài khoản khác nhau của cùng cặp công ty không được bù trừ chéo giữa hai chiều.
- Công ty Thông tư 133 ghi khoản đầu tư ở 228, 2288 không được ghép sang mã đầu tư Thông tư 99 tương ứng, ngoài các mã trong bảng ánh xạ.
