# CONG_VIEC_53: Bán lẻ tại quầy phần 1 (MODULE_14)

- Mô tả: Bán hàng tại quầy cho cửa hàng tập đoàn tự vận hành: cửa hàng, quầy, ca thu ngân; quét mã vạch, giá theo bảng giá kênh Bán lẻ, khuyến mãi, giảm giá tay trong mức; thanh toán tiền mặt, chuyển khoản VietQR, nhiều phương thức; in hóa đơn bán lẻ; trừ kho, giá vốn, bút toán qua module đã có; trả hàng theo hóa đơn; hóa đơn điện tử khởi tạo từ máy tính tiền; tích, đổi điểm cho khách có tài khoản VComm.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng duyệt đặc tả và bản mẫu ngày 2026-11-11; L1 đạt; đang lập trình lát L2.
- Mức: Lớn (module mới, mini app mới, sửa cấu trúc dữ liệu của bán hàng, tài chính, hóa đơn điện tử).
- Nhánh: `chuc-nang/CONG_VIEC_53-ban-le-tai-quay`.
- Nguồn: tài liệu `01` mục 4 (MODULE_14), `05` mục 3 (MODULE_14), `05` mục 5 (phiên bản 5.x); quyết định của người dùng ngày 2026-11-11 (mục 17).

## 1. Mục tiêu

Thu ngân bán được một đơn tại quầy trong dưới một phút: quét hàng, nhận tiền, in hóa đơn. Mỗi giao dịch tự trừ kho, ghi giá vốn, bút toán, hóa đơn điện tử; cuối ca tiền đếm được đối chiếu với hệ thống và vào quỹ mà kế toán không phải nhập tay.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_186 đến CHUC_NANG_189.

Ngoài phạm vi:
- Bán khi mất mạng (người dùng chọn luôn có mạng). Mất mạng: màn hình báo, chặn thanh toán.
- Trạm giao hàng O2O, kế hoạch mua theo ngân sách (công việc sau của MODULE_14).
- Thanh toán thẻ qua máy cà thẻ, ví điện tử, cổng thanh toán tại quầy.
- Nộp tiền từ két về quỹ tổng, chuyển tiền giữa quỹ (làm bằng chứng từ quỹ hiện có của mini app Tài chính – Kế toán).
- Trả hàng ở cửa hàng khác cửa hàng đã bán; đổi hàng như một nghiệp vụ riêng (đổi hàng = trả hàng + bán mới).
- Ngăn kéo đựng tiền điều khiển bằng máy in, màn hình hiển thị cho khách.
- Gửi hóa đơn điện tử khởi tạo từ máy tính tiền qua MISA meInvoice (chỉ bộ giả lập; MISA thêm khi có tài liệu API, mục 16).
- Đối soát tự động giao dịch chuyển khoản với sao kê (dùng đối soát ngân hàng CONG_VIEC_18 như hiện có).

## 3. Yêu cầu nghiệp vụ

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_105 | Khai báo cửa hàng bán lẻ (chi nhánh loại cửa hàng, kho bán, kênh bán, quỹ nhận tiền, số ngày được trả hàng) và các quầy thu ngân | Quản trị công ty, Cửa hàng trưởng |
| YCAU_NGHIEPVU_106 | Ca thu ngân: mở ca với tiền đầu ca, đóng ca đếm tiền, đối chiếu với số hệ thống tính, xử lý tiền lệch | Thu ngân, Cửa hàng trưởng, Kế toán |
| YCAU_NGHIEPVU_107 | Bán hàng tại quầy: quét mã vạch, tìm hàng, giá theo bảng giá kênh Bán lẻ, khuyến mãi đã duyệt, giảm giá tay trong mức cho phép | Thu ngân |
| YCAU_NGHIEPVU_108 | Thanh toán tiền mặt, chuyển khoản, kết hợp nhiều phương thức; in hóa đơn bán lẻ; hóa đơn điện tử khởi tạo từ máy tính tiền cho mọi giao dịch | Thu ngân, Khách mua |
| YCAU_NGHIEPVU_109 | Mỗi giao dịch tại quầy tự trừ kho, ghi giá vốn, doanh thu, thuế, tiền vào quỹ qua module Kho, Tài chính – Kế toán đã có | Kế toán, Thủ kho |
| YCAU_NGHIEPVU_110 | Trả hàng theo hóa đơn bán lẻ trong thời hạn, hoàn tiền, nhập lại kho | Thu ngân, Cửa hàng trưởng |
| YCAU_NGHIEPVU_111 | Khách có tài khoản VComm được tích điểm và dùng điểm trừ tiền ngay tại quầy | Khách mua, Thu ngân |

## 4. Chức năng

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_186 | Cửa hàng, quầy, ca thu ngân: cài đặt cửa hàng và quầy; mở ca, đóng ca, đối chiếu tiền mặt; lập chứng từ quỹ, bút toán tiền lệch khi đóng ca; danh sách, chi tiết ca | YCAU_NGHIEPVU_105, YCAU_NGHIEPVU_106 |
| CHUC_NANG_187 | Bán hàng tại quầy: tìm, quét hàng; giá kênh, khuyến mãi, giảm giá tay; khách lẻ hoặc tài khoản VComm, thông tin người mua lấy hóa đơn; thanh toán nhiều phương thức, VietQR, tiền thừa; ghi đơn bán, phiếu xuất, giá vốn, bút toán; in hóa đơn bán lẻ; danh sách, chi tiết, in lại | YCAU_NGHIEPVU_107, YCAU_NGHIEPVU_108, YCAU_NGHIEPVU_109 |
| CHUC_NANG_188 | Trả hàng theo hóa đơn bán lẻ: tìm hóa đơn, chọn hàng, số lượng; hoàn tiền mặt hoặc chuyển khoản; phiếu nhận hàng trả lại, bút toán, việc chờ xử lý hóa đơn; in phiếu trả hàng | YCAU_NGHIEPVU_110, YCAU_NGHIEPVU_109 |
| CHUC_NANG_189 | Hóa đơn điện tử khởi tạo từ máy tính tiền (ký hiệu theo năm, cấp số và mã tại quầy, in trên hóa đơn bán lẻ, gửi dữ liệu nền); tích, đổi, hoàn điểm cho khách VComm | YCAU_NGHIEPVU_108, YCAU_NGHIEPVU_111 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_368 | Cửa hàng bán lẻ gắn một chi nhánh loại "Cửa hàng" (`store`) đang hoạt động của công ty; mỗi chi nhánh tối đa một cửa hàng. Kho bán: kho đang hoạt động thuộc chi nhánh đó, công ty được để hàng, không quản lý vị trí (quyết định người dùng 2026-11-11). Kênh bán: kênh đang hoạt động của công ty, mặc định `BAN_LE`, không được là `NOI_BO`. Quỹ tiền mặt: quỹ loại tiền mặt đang hoạt động, bắt buộc. Quỹ chuyển khoản: quỹ loại ngân hàng đang hoạt động, không bắt buộc; có thì phải có mã ngân hàng VietQR (6 chữ số, theo danh sách ngân hàng của NAPAS) và tên chủ tài khoản (in hoa không dấu, 1 đến 50 ký tự). Số ngày được trả hàng 0 đến 90, mặc định 7 (0 là không nhận trả). Chân hóa đơn bán lẻ tối đa 300 ký tự. Quầy: mã 1 đến 20 ký tự `A-Z0-9_` duy nhất trong cửa hàng, tên 1 đến 100 ký tự. Ngừng cửa hàng, ngừng quầy khi không còn ca đang mở. Không xóa cửa hàng, quầy | YCAU_NGHIEPVU_105 |
| QUYTAC_NGHIEPVU_369 | Mở ca: người có quyền bán tại chi nhánh của cửa hàng chọn quầy đang hoạt động, nhập tiền đầu ca (0 đến 1.000.000.000, làm tròn theo đơn vị tiền tệ của công ty). Mỗi quầy và mỗi người cùng lúc tối đa một ca đang mở. Màn hình gợi ý tiền cuối ca của ca đóng gần nhất ở quầy; tiền đầu ca khác số đó phải ghi ghi chú (1 đến 500 ký tự). Tiền đầu ca không phát sinh chứng từ quỹ (tiền vẫn thuộc quỹ tiền mặt của cửa hàng) | YCAU_NGHIEPVU_106 |
| QUYTAC_NGHIEPVU_370 | Bán, trả hàng chỉ thực hiện trong ca đang mở của chính người thao tác, tại quầy của ca đó, ngày chứng từ là ngày hiện tại theo giờ Việt Nam. Cửa hàng, quầy đã ngừng, kỳ kế toán đã khóa, kho đang khóa kiểm kê thì chặn. Mặt hàng: biến thể đang bán loại hàng hóa của công ty (dịch vụ bán qua đơn bán dịch vụ, quyết định người dùng 2026-11-11), tìm theo mã vạch, mã, tên, serial; quét mã vạch khớp đúng một biến thể thì thêm 1 đơn vị (đơn vị gắn với mã vạch nếu có, không thì đơn vị cơ sở), quét lại thì cộng số lượng. Tối đa 200 dòng một hóa đơn, số lượng lớn hơn 0. Hàng hóa phải đủ tồn khả dụng tại kho bán (không bán âm). Hàng theo lô: hệ thống tự xuất lô hết hạn trước, bỏ lô đã hết hạn. Hàng theo serial: thu ngân quét từng serial còn trong kho bán (quyết định người dùng 2026-11-11) | YCAU_NGHIEPVU_107 |
| QUYTAC_NGHIEPVU_371 | Giá: bảng giá theo kênh của cửa hàng, nhóm khách để trống, ngày hiện tại (`lookupPrice`); mặt hàng không có giá thì không bán được. Khuyến mãi: chương trình đã duyệt, đang hiệu lực áp tự động như đơn bán (giảm theo hàng, giảm theo đơn, mua tặng; suất tặng giới hạn theo tồn kho bán), kiểm ngân sách, số suất khi thanh toán. Giảm giá tay: phần trăm theo dòng, từ 0 đến mức tối đa trong cài đặt bán hàng của công ty; vượt mức thì chặn (không gửi duyệt). Giá sau khuyến mãi và giảm tay của hàng hóa thấp hơn giá vốn bình quân tại kho bán thì chặn. Dòng tặng không giảm tay. Giá, khuyến mãi tính lại ở máy chủ khi thanh toán; tổng khác số thu ngân đã thấy thì báo, không ghi | YCAU_NGHIEPVU_107 |
| QUYTAC_NGHIEPVU_372 | Khách: khách lẻ (mặc định) hoặc tài khoản VComm tìm theo số điện thoại (tài khoản người mua đang hoạt động; hiện tên, hạng, điểm). Người mua lấy hóa đơn ghi tên (1 đến 200 ký tự), mã số thuế (10 hoặc 14 ký tự dạng `0123456789-001`, không bắt buộc), địa chỉ (bắt buộc khi có mã số thuế), số định danh cá nhân (12 chữ số, không bắt buộc); không có thì hóa đơn ghi người mua không cung cấp thông tin. Bán tại quầy không phát sinh công nợ khách hàng | YCAU_NGHIEPVU_107, YCAU_NGHIEPVU_108 |
| QUYTAC_NGHIEPVU_373 | Thanh toán: một hoặc nhiều dòng, mỗi dòng một phương thức: tiền mặt, chuyển khoản (cửa hàng có quỹ chuyển khoản), điểm (QUYTAC_NGHIEPVU_379). Tổng các dòng không phải tiền mặt không vượt số phải trả; tiền mặt khách đưa được vượt phần còn lại, tiền thừa trả khách bằng tiền mặt = tổng đã đưa − số phải trả; tổng đã đưa nhỏ hơn số phải trả thì chặn. Chuyển khoản: màn hình hiện mã VietQR (mã ngân hàng, số tài khoản, số tiền, nội dung là số hóa đơn bán lẻ), thu ngân xác nhận đã nhận tiền, có thể ghi mã giao dịch ngân hàng (tối đa 50 ký tự). Mỗi lần thanh toán mang khóa yêu cầu duy nhất do máy tạo; gửi lại cùng khóa trả về hóa đơn đã ghi, không ghi trùng | YCAU_NGHIEPVU_108 |
| QUYTAC_NGHIEPVU_374 | Ghi nhận trong một giao dịch cơ sở dữ liệu: hóa đơn bán lẻ (số `BL`), đơn bán kênh của cửa hàng không khách hàng, đã xác nhận, đánh dấu bán lẻ (số `DBH`), phiếu xuất giao hàng đã ghi sổ tại kho bán (số `XBH`, giá vốn bình quân), bút toán phiếu xuất (Nợ phải thu không đối tượng / Có doanh thu / Có thuế giá trị gia tăng đầu ra; Nợ giá vốn / Có hàng hóa), hóa đơn điện tử (QUYTAC_NGHIEPVU_378), điểm (QUYTAC_NGHIEPVU_379). Lỗi ở bất kỳ bước nào thì không ghi gì. Hóa đơn bán lẻ đã ghi không sửa, không hủy; sai thì trả hàng | YCAU_NGHIEPVU_109 |
| QUYTAC_NGHIEPVU_375 | Đóng ca: người mở ca hoặc người có quyền quản lý ca của cửa hàng nhập tiền mặt đếm được. Tiền mặt hệ thống tính = tiền đầu ca + tiền mặt thu (đã trừ tiền thừa) − tiền mặt hoàn trả hàng. Lệch khác 0 bắt buộc lý do (1 đến 500 ký tự). Đóng ca lập và ghi sổ ngay, theo từng quỹ, các chứng từ quỹ không đối tượng ngày đóng ca: phiếu thu bán lẻ (tổng tiền thu bán, mỗi quỹ một phiếu), phiếu chi hoàn tiền bán lẻ (tổng tiền hoàn, mỗi quỹ một phiếu), phiếu chi thiếu tiền (Nợ phải thu khác 1388 chi tiết người mở ca / Có tiền mặt) hoặc phiếu thu thừa tiền (Nợ tiền mặt / Có tài sản thừa chờ giải quyết 3381); số tiền 0 thì không lập. Bút toán phiếu thu bán lẻ: Nợ tiền mặt hoặc tiền gửi ngân hàng / Có phải thu không đối tượng; phiếu chi hoàn tiền: ngược lại. Ca đã đóng không sửa, không mở lại | YCAU_NGHIEPVU_106, YCAU_NGHIEPVU_109 |
| QUYTAC_NGHIEPVU_376 | Trả hàng: tìm hóa đơn bán lẻ theo số (gõ hoặc quét mã trên hóa đơn in) của cùng cửa hàng, ngày bán cách ngày hiện tại không quá số ngày được trả hàng của cửa hàng. Mỗi dòng trả không vượt số đã bán trừ số đã trả. Lý do trả 1 đến 500 ký tự. Tiền hoàn mỗi dòng = tổng tiền của dòng bán (đã gồm khuyến mãi, giảm tay, phân bổ giảm theo đơn) × số lượng trả / số lượng bán, làm tròn theo đơn vị tiền tệ; trả hết dòng thì lấy phần còn lại. Dòng tặng trả được, tiền hoàn 0. Cần quyền trả hàng | YCAU_NGHIEPVU_110 |
| QUYTAC_NGHIEPVU_377 | Hoàn tiền trả hàng: phần đã trả bằng điểm hoàn lại điểm trước (theo tỷ lệ phần điểm trên tổng thanh toán của hóa đơn), phần còn lại hoàn bằng tiền mặt từ ca đang mở hoặc chuyển khoản (ghi số tài khoản, ngân hàng người nhận, mã giao dịch; thu ngân xác nhận đã chuyển). Ghi trong một giao dịch: phiếu trả hàng bán lẻ (số `TL`), phiếu nhận hàng trả lại đã ghi sổ vào kho bán theo giá vốn lúc xuất (`returnAsSystem`), bút toán trả hàng, việc chờ xử lý hóa đơn điện tử như CONG_VIEC_16 (QUYTAC_NGHIEPVU_106), thu hồi điểm đã tích theo tỷ lệ hàng trả | YCAU_NGHIEPVU_110 |
| QUYTAC_NGHIEPVU_378 | Hóa đơn điện tử khởi tạo từ máy tính tiền: công ty đang bật hóa đơn điện tử (CONG_VIEC_16) thì mọi hóa đơn bán lẻ có ngày từ ngày bắt đầu lập một hóa đơn điện tử loại khởi tạo từ máy tính tiền trong cùng giao dịch. Ký hiệu khai theo năm, riêng cho máy tính tiền (`C`, 2 số cuối năm, `M`, 2 chữ cái in hoa); năm chưa khai thì chặn bán, báo cần khai ký hiệu. Số hóa đơn cấp liên tục theo ký hiệu tại quầy; mã của cơ quan thuế do người bán tạo theo cấu trúc quy định, in trên hóa đơn bán lẻ cùng ký hiệu, số, đường dẫn tra cứu. Dữ liệu hóa đơn gửi cơ quan thuế qua nhà cung cấp bằng tác vụ nền như CONG_VIEC_16, trong ngày. Người mua, dòng hàng, thuế suất, tổng tiền như QUYTAC_NGHIEPVU_104. Trả hàng xử lý như QUYTAC_NGHIEPVU_106. **Chưa xác minh** cấu trúc mã, ký hiệu, thời hạn gửi theo Nghị định 254/2026/NĐ-CP, Thông tư 91/2026/TT-BTC (mục 16) | YCAU_NGHIEPVU_108 |
| QUYTAC_NGHIEPVU_379 | Điểm tại quầy (theo sổ cái điểm của CONG_VIEC_51): khách VComm được dùng điểm trừ tiền như một phương thức thanh toán, trong số dư khả dụng và giới hạn của CONG_VIEC_51; được tích điểm theo tiền thực trả (không tính phần trả bằng điểm) khi hóa đơn bán lẻ ghi xong; trả hàng thì hoàn điểm đã dùng, thu hồi điểm đã tích theo tỷ lệ (QUYTAC_NGHIEPVU_377). Tỷ lệ quy đổi, mức tích, hạng, chống gian lận theo CONG_VIEC_51. Nguồn chứng từ điểm: `retail.sale`, `retail.return` | YCAU_NGHIEPVU_111 |

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Phạm vi gán | Nhạy cảm |
|---|---|---|---|
| `retail.access` | Vào mini app Bán lẻ | Tập đoàn, công ty, chi nhánh | Không |
| `retail.sale` | Mở ca, bán, đóng ca của mình, xem hóa đơn bán lẻ của cửa hàng | Công ty, chi nhánh | Không |
| `retail.return` | Trả hàng theo hóa đơn bán lẻ | Công ty, chi nhánh | Không |
| `retail.shift.manage` | Xem mọi ca, đóng ca của người khác | Công ty, chi nhánh | Không |
| `retail.setup` | Cài đặt cửa hàng, quầy | Tập đoàn, công ty | Không |

Vai trò hệ thống mới: Thu ngân (`cashier`: `retail.access`, `retail.sale`); Cửa hàng trưởng (`store_manager`: thêm `retail.return`, `retail.shift.manage`). Kế toán, Kế toán trưởng: thêm `retail.access`, `retail.shift.manage` (xem ca, đối chiếu). Quản trị công ty, Quản trị tập đoàn: tất cả. Quyền gán ở phạm vi chi nhánh chỉ có hiệu lực tại cửa hàng của chi nhánh đó. Phiếu kho, chứng từ quỹ, bút toán, hóa đơn điện tử sinh ra xem ở mini app Kho, Tài chính – Kế toán theo quyền hiện có.

## 7. Luồng nghiệp vụ

- Luồng 43 (tài liệu `09`): bán, trả hàng, đóng ca tại quầy.
- Luồng bán: Thu ngân mở ca → quét hàng → (tìm khách VComm, nhập người mua lấy hóa đơn) → thanh toán (tiền mặt, VietQR, điểm) → hệ thống ghi hóa đơn bán lẻ, đơn bán, phiếu xuất, bút toán, hóa đơn điện tử, điểm → in hóa đơn bán lẻ.
- Luồng trả hàng: Thu ngân có quyền trả hàng tìm hóa đơn → chọn hàng, số lượng, lý do → hoàn điểm, hoàn tiền → hệ thống ghi phiếu trả hàng bán lẻ, phiếu nhận hàng trả lại, bút toán, việc chờ xử lý hóa đơn điện tử → in phiếu trả hàng.
- Luồng đóng ca: Thu ngân đếm tiền → nhập tiền đếm được, lý do lệch → hệ thống lập phiếu thu, phiếu chi theo quỹ, ghi sổ → in biên bản đóng ca.

## 8. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_161 | Bán hàng tại quầy | Toàn màn hình, tối ưu máy tính và máy tính bảng ngang. Thanh trên: cửa hàng, quầy, thu ngân, ca (giờ mở), trạng thái mạng, nút "Trả hàng", "Đóng ca". Trái: ô quét, tìm hàng (luôn nhận bàn phím), bảng giỏ (hàng, đơn vị, số lượng tăng giảm, giá, giảm tay, khuyến mãi, thành tiền, xóa dòng), dòng tặng. Phải: khách (khách lẻ / tìm số điện thoại), người mua lấy hóa đơn, tổng tiền hàng, khuyến mãi, giảm tay, thuế, phải trả; nút "Thanh toán" (F9). Hộp thoại thanh toán: phương thức, số tiền, tiền khách đưa gợi ý mệnh giá, tiền thừa, mã VietQR, điểm; nút "Xác nhận thanh toán". Sau khi ghi: số hóa đơn, nút "In hóa đơn", "Đơn mới". Chưa mở ca thì hiện phần mở ca |
| MAN_HINH_162 | Mở ca, đóng ca | Mở ca: chọn cửa hàng, quầy, tiền đầu ca, gợi ý tiền cuối ca trước, ghi chú. Đóng ca: tổng hợp theo phương thức (bán, hoàn, tiền thừa), tiền mặt hệ thống tính, ô tiền đếm được (có bảng đếm theo mệnh giá), lệch, lý do; nút "Đóng ca", "In biên bản đóng ca" |
| MAN_HINH_163 | Hóa đơn bán lẻ | Danh sách lọc cửa hàng, quầy, ca, ngày, thu ngân, khách, tìm số; chi tiết: dòng hàng, khuyến mãi, thanh toán, người mua, đơn bán, phiếu xuất, hóa đơn điện tử, điểm, các lần trả; nút "In lại", "Trả hàng" |
| MAN_HINH_164 | Trả hàng | Ô tìm, quét số hóa đơn; bảng dòng (đã bán, đã trả, còn trả được, số trả, tiền hoàn), lý do, cách hoàn (điểm tự tính, tiền mặt, chuyển khoản), tổng hoàn; nút "Xác nhận trả hàng", "In phiếu trả hàng" |
| MAN_HINH_165 | Ca thu ngân | Danh sách lọc cửa hàng, quầy, thu ngân, trạng thái, ngày, chỉ ca lệch, ca mở quá 24 giờ; chi tiết: giờ mở, đóng, tiền đầu ca, tổng theo phương thức, tiền hệ thống tính, đếm được, lệch, lý do, chứng từ quỹ đã lập, hóa đơn trong ca; nút "Đóng ca" (quyền quản lý ca) |
| MAN_HINH_166 | Cài đặt cửa hàng | Danh sách cửa hàng; ngăn kéo thêm, sửa: chi nhánh, kho, kênh, quỹ tiền mặt, quỹ chuyển khoản, mã ngân hàng VietQR, chủ tài khoản, số ngày trả hàng, chân hóa đơn, trạng thái; danh sách quầy của cửa hàng, thêm, sửa, ngừng |
| MAN_HINH_167 | Mẫu in hóa đơn bán lẻ | Khổ giấy 80 mm, in bằng hộp thoại in của trình duyệt: tên, mã số thuế, địa chỉ công ty, cửa hàng; số hóa đơn, ngày giờ, quầy, thu ngân; dòng hàng, khuyến mãi, tổng, thuế, thanh toán, tiền thừa; người mua; ký hiệu, số hóa đơn điện tử, mã của cơ quan thuế, đường dẫn tra cứu; điểm tích, số dư; mã QR số hóa đơn; chân hóa đơn. Cùng khuôn cho phiếu trả hàng, biên bản đóng ca |

Mini app mới `apps/web-retail`, đường dẫn `/retail`, cổng phát triển 3012, biến `RETAIL_ORIGIN` ở `web-platform`. Menu: Bán hàng, Hóa đơn bán lẻ, Trả hàng, Ca thu ngân, Cài đặt cửa hàng (hiện theo quyền).

## 9. Dữ liệu

Schema mới `retail` (đứng sau `core`, `catalog`, `inventory`, `sales`, `finance`; khóa ngoại chỉ trỏ vào các schema này và `core`).

- `0094_retail_setup.sql`: `core.apps` dòng `retail`; loại chứng từ `retail.sale` (`BL`), `retail.return` (`TL`); bảng `retail.stores` (công ty, chi nhánh duy nhất, kho, kênh, quỹ tiền mặt, quỹ chuyển khoản, mã ngân hàng VietQR, chủ tài khoản, số ngày trả hàng, chân hóa đơn, trạng thái, phiên bản), `retail.registers` (cửa hàng, mã, tên, trạng thái), `retail.shifts` (công ty, cửa hàng, quầy, người mở, giờ mở, tiền đầu ca, ghi chú mở, trạng thái mở/đã đóng, người đóng, giờ đóng, tiền hệ thống tính, đếm được, lệch, lý do; chỉ mục duy nhất một ca mở mỗi quầy, mỗi người).
- `0095_retail_sales.sql`: `sales.orders` thêm `is_retail`, `buyer_tax_code`, `buyer_address`, `buyer_identity_no`; `retail.sales` (công ty, cửa hàng, quầy, ca, số, ngày giờ, người bán, tài khoản VComm, người mua, đơn bán, phiếu xuất, tiền hàng, khuyến mãi, giảm tay, thuế, phải trả, đã đưa, tiền thừa, khóa yêu cầu duy nhất theo quầy), `retail.sale_payments` (hóa đơn, phương thức `cash`/`bank_transfer`/`points`, số tiền, quỹ, mã giao dịch, số điểm).
- `0096_retail_returns.sql`: `retail.returns` (hóa đơn gốc, ca, số, ngày, lý do, phiếu nhận hàng trả lại, tiền hoàn, người nhận chuyển khoản), `retail.return_lines`, `retail.return_refunds` (phương thức, số tiền, quỹ, mã giao dịch, số điểm); `finance.payments`: thêm loại `retail_receipt`, `retail_refund`, `cash_shortage`, `cash_surplus`, cho phép đối tượng trống với các loại này, thêm `source_type`, `source_id` (ca thu ngân), `staff_user_id` (thiếu tiền); vai trò định khoản `staff_receivable` (1388), dùng lại `surplus_pending` (3381).
- `0097_retail_einvoice_points.sql`: `finance.einvoice_series` thêm `kind` (`standard`, `cash_register`), ràng buộc định dạng theo loại, duy nhất theo công ty, năm, loại; `finance.einvoices` thêm `origin` (`standard`, `cash_register`), `tax_authority_code` cấp tại chỗ; liên kết điểm của hóa đơn bán lẻ, trả hàng (tùy thiết kế CONG_VIEC_51, chốt ở lát L6).

Chi tiết cột, chỉ mục ghi vào tài liệu `16` khi lập trình từng lát.

## 10. API

| Mã | Đường dẫn | Nội dung |
|---|---|---|
| API_192 | `GET /retail/options`; `GET`, `POST /retail/stores`; `GET`, `PATCH /retail/stores/{id}`; `POST /retail/stores/{id}/registers`; `PATCH /retail/registers/{id}` | Cửa hàng, quầy |
| API_193 | `GET /retail/shifts`; `GET /retail/shifts/current`; `POST /retail/shifts`; `GET /retail/shifts/{id}`; `POST /retail/shifts/{id}/close` | Ca thu ngân |
| API_194 | `GET /retail/items?registerId=&barcode=` hoặc `&q=` | Tìm, quét hàng tại quầy: biến thể, đơn vị, giá kênh, tồn khả dụng |
| API_195 | `POST /retail/quote` | Tính giỏ: giá, khuyến mãi, suất tặng, giảm tay, thuế, tổng; kiểm giới hạn |
| API_196 | `POST /retail/sales`; `GET /retail/sales`; `GET /retail/sales/{id}` | Thanh toán và ghi hóa đơn bán lẻ; danh sách; chi tiết kèm dữ liệu in |
| API_197 | `GET /retail/sales/{id}/returnable`; `POST /retail/returns`; `GET /retail/returns`; `GET /retail/returns/{id}` | Trả hàng |
| API_198 | `GET /retail/customers?phone=` | Tra tài khoản VComm tại quầy (tên che một phần, hạng, điểm khả dụng) |
| API_199 | Dành cho điểm tại quầy (lát L6) nếu CONG_VIEC_51 cần đường dẫn riêng | Điểm |

`PUT /finance/einvoice-settings` (API_92) nhận thêm ký hiệu máy tính tiền theo năm (lát L5). Lỗi quy tắc trả `409 BUSINESS_RULE`, khóa thông báo trong tài liệu `17`.

## 11. Dùng lại mã đã có

| Việc | Mã dùng lại | Thay đổi cần thiết |
|---|---|---|
| Giá, khuyến mãi | `lookupPrice`, `applyPromotions`, `lineAmounts` | Thêm `SalesOrdersService.quoteRetail`, `placeRetailWithin` (theo mẫu `quoteMarketplace`, `placeMarketplaceWithin`: không khách hàng, giảm tay trong mức, chặn dưới giá vốn, xác nhận ngay, chạy `confirmedHooks` cho dòng dịch vụ) |
| Trừ kho, giá vốn | `SalesDeliveriesService`, `StockDocumentsService.postDocument`, `StockLedgerService` | Thêm `SalesDeliveriesService.issueWithinAsSystem` (tạo và ghi sổ phiếu xuất trong giao dịch của bên gọi); trả hàng dùng `returnAsSystem` |
| Bút toán phiếu kho | `inventoryDraft`, `LedgerService` | Không đổi |
| Chứng từ quỹ khi đóng ca | `PaymentsService`, `paymentDraft`, `fundBalance` | Thêm `PaymentsService.recordWithin` cho bốn loại mới (không đối tượng, ghi sổ ngay, không trừ nợ); `paymentDraft` định khoản bốn loại mới |
| Hóa đơn điện tử | `EinvoicesService.recordDelivery`, `insertInvoice`, bộ giả lập, tác vụ gửi nền | Loại khởi tạo từ máy tính tiền: ký hiệu riêng, cấp số và mã tại chỗ; bộ giả lập nhận hóa đơn có số sẵn |
| Khách VComm | `marketplace.buyer_accounts`, `core.users.phone`, `localPhone` | Chỉ đọc |
| Điểm | Service của CONG_VIEC_51 | Chờ CONG_VIEC_51 hợp nhất |
| Số chứng từ | `NumberSequencesService`, `ensureSequence` | Không đổi |
| Giao diện | `packages/ui` (AppShell, Drawer, ConfirmDialog, Field, StatusBadge, StatusViews, format), `qrcode-generator` 2.0.4 (đã dùng ở `web-platform`) cho mã VietQR và mã QR trên hóa đơn in | Không thêm thư viện |

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_53 – 2026-11-11

- Yêu cầu cần đáp ứng: YCAU_NGHIEPVU_105 đến 111.
- Nguồn đã tìm: mã nguồn dự án (khảo sát module bán hàng, kho, tài chính, hóa đơn điện tử, VComm); tìm kiếm công cộng trên web. Chưa xem nguồn riêng `V-com-ERP` (tài liệu `18` mục 4).
- Từ khóa đã dùng: "open source point of sale typescript github", "vietqr npm generate EMVCo string napas".

| Ứng viên | Nguồn | Giấy phép | Tương thích công nghệ | Công sức điều chỉnh |
|---|---|---|---|---|
| Mã đơn bán, kho, tài chính, hóa đơn điện tử của dự án | Dự án | Của dự án | Đầy đủ | Thấp |
| Phần mềm bán hàng nguồn mở viết bằng TypeScript (FinOpenPOS, react-point-of-sale, open-pos, simpos) | GitHub | Một số GPL-3.0, còn lại chưa kiểm | Có cơ sở dữ liệu, kho, kế toán riêng, trùng chức năng ERP đã có; phần lớn ít người dùng | Cao |
| Thư viện tạo chuỗi VietQR (`vietqr-ts`, `napas-qr`, `vn-qr-pay`) | npm | Chưa kiểm | Được | Thấp, nhưng thêm phụ thuộc ít người dùng cho khoảng 60 dòng mã (chuẩn EMVCo, CRC16) |

- Phương án:
  1. Dùng lại nguyên trạng: không có ứng viên đáp ứng (POS nguồn mở không nối được kho, kế toán của dự án).
  2. Dùng lại có điều chỉnh: mã của dự án (mục 11).
  3. Tham khảo cách làm, tự viết: chuỗi VietQR theo đặc tả công khai của NAPAS, mã QR vẽ bằng `qrcode-generator` đã có.
  4. Tự viết mới hoàn toàn: không cần.
- Đề xuất: phương án 2 kết hợp 3 – không thêm thư viện, dùng toàn bộ luồng kho, kế toán, hóa đơn đã nghiệm thu.
- Quyết định của người dùng: phương án 2 kết hợp 3 (duyệt cùng đặc tả) – 2026-11-11.

## 13. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_349 | Cài đặt cửa hàng, quầy đúng điều kiện (chi nhánh cửa hàng, kho của chi nhánh, kênh, quỹ, VietQR, số ngày trả); chỉ người có quyền cài đặt sửa được; không ngừng khi còn ca mở | Bắt buộc |
| TIEUCHI_NGHIEMTHU_350 | Mở ca: một ca mở mỗi quầy, mỗi người; tiền đầu ca khác gợi ý phải có ghi chú; không có ca thì không bán, không trả được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_351 | Quét mã vạch, tìm hàng thêm đúng biến thể, đơn vị; giá đúng bảng giá kênh; khuyến mãi áp như đơn bán, kiểm ngân sách, suất; giảm tay trong mức, vượt mức và dưới giá vốn bị chặn; thiếu tồn bị chặn | Bắt buộc |
| TIEUCHI_NGHIEMTHU_352 | Thanh toán tiền mặt, chuyển khoản VietQR, kết hợp; tiền thừa đúng; thiếu tiền bị chặn; gửi lại cùng khóa không ghi trùng; tổng thay đổi so với lúc xem thì báo, không ghi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_353 | Mỗi hóa đơn bán lẻ ghi đủ đơn bán, phiếu xuất đã ghi sổ, tồn kho giảm, giá vốn, bút toán đúng tài khoản; lỗi một bước thì không ghi gì; không phát sinh công nợ khách hàng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_354 | Đóng ca: tiền hệ thống tính đúng; lệch bắt buộc lý do; phiếu thu, phiếu chi theo quỹ, bút toán thiếu, thừa đúng; sau đóng ca phải thu không đối tượng của ca về 0; số dư quỹ khớp tiền đếm được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_355 | Trả hàng: đúng cửa hàng, thời hạn, số lượng còn trả; tiền hoàn đúng tỷ lệ; nhập lại kho đúng giá vốn lúc xuất; bút toán, việc chờ xử lý hóa đơn đúng; hoàn tiền mặt trừ vào ca | Bắt buộc |
| TIEUCHI_NGHIEMTHU_356 | Hóa đơn điện tử khởi tạo từ máy tính tiền: lập cho mọi hóa đơn bán lẻ khi công ty bật; ký hiệu riêng theo năm; số liên tục; in trên hóa đơn bán lẻ; gửi nền qua bộ giả lập; thiếu ký hiệu thì chặn bán | Bắt buộc |
| TIEUCHI_NGHIEMTHU_357 | Khách VComm: tra theo số điện thoại; dùng điểm trừ tiền trong số dư; tích điểm sau khi bán; trả hàng hoàn, thu hồi điểm đúng tỷ lệ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_358 | MAN_HINH_161 đến 167 đạt danh sách rà soát giao diện trên máy tính và máy tính bảng ngang (MAN_HINH_163, 165, 166 thêm điện thoại); thao tác bán đủ bằng bàn phím và máy quét; quyền kiểm ở máy chủ; không thấy dữ liệu công ty, cửa hàng ngoài phạm vi; hóa đơn in khổ 80 mm đọc đủ tiếng Việt | Bắt buộc |

## 14. Kịch bản kiểm thử

KICHBAN_KIEMTHU_510 đến KICHBAN_KIEMTHU_521, ghi trong tài liệu `21` khi lập trình từng lát:

| Mã | Kịch bản | Tiêu chí | Cách |
|---|---|---|---|
| KICHBAN_KIEMTHU_510 | Cài đặt cửa hàng, quầy: hợp lệ, chi nhánh không phải cửa hàng, kho chi nhánh khác, kênh nội bộ, quỹ sai loại, mã ngân hàng sai, không có quyền, ngừng khi còn ca | 349 | Tự động |
| KICHBAN_KIEMTHU_511 | Mở ca: hợp lệ, quầy đã có ca, người đã có ca ở quầy khác, ghi chú khi lệch gợi ý, phạm vi chi nhánh | 350 | Tự động |
| KICHBAN_KIEMTHU_512 | Quét, tìm hàng, giá kênh, không có giá, đơn vị theo mã vạch | 351 | Tự động |
| KICHBAN_KIEMTHU_513 | Khuyến mãi, giảm tay biên (đúng mức, vượt 0,01), dưới giá vốn, thiếu tồn, suất tặng | 351 | Tự động |
| KICHBAN_KIEMTHU_514 | Thanh toán tiền mặt, chuyển khoản, kết hợp, thiếu tiền, chuyển khoản vượt, gửi trùng khóa, tổng đổi | 352 | Tự động |
| KICHBAN_KIEMTHU_515 | Ghi sổ: đơn bán, phiếu xuất, tồn kho, giá vốn, bút toán, không công nợ; lỗi giữa chừng không ghi gì; kỳ khóa | 353 | Tự động |
| KICHBAN_KIEMTHU_516 | Đóng ca: không lệch, thiếu, thừa, thiếu lý do, chứng từ quỹ, bút toán, số dư quỹ, đóng ca người khác có, không có quyền | 354 | Tự động |
| KICHBAN_KIEMTHU_517 | Trả hàng: trong hạn, quá hạn, cửa hàng khác, vượt số còn trả, trả hai lần, dòng tặng, tiền hoàn tỷ lệ, tiền mặt, chuyển khoản, không có quyền | 355 | Tự động |
| KICHBAN_KIEMTHU_518 | Hóa đơn máy tính tiền: lập, số liên tục, thiếu ký hiệu chặn, công ty không bật, gửi nền bộ giả lập, trả hàng tạo việc chờ | 356 | Tự động |
| KICHBAN_KIEMTHU_519 | Điểm: tra khách, dùng điểm, vượt số dư, tích sau bán, trả hàng hoàn và thu hồi | 357 | Tự động |
| KICHBAN_KIEMTHU_520 | Phân quyền, đa công ty: người công ty khác, chi nhánh khác không thấy cửa hàng, ca, hóa đơn | 358 | Tự động |
| KICHBAN_KIEMTHU_521 | Giao diện: bán bằng bàn phím và máy quét giả lập, in khổ 80 mm, máy tính, máy tính bảng ngang, điện thoại cho màn hình danh sách | 358 | Thủ công và Playwright |

## 15. Ràng buộc kỹ thuật

- Không thêm thư viện. VietQR tự tạo chuỗi theo chuẩn EMVCo của NAPAS (CRC16-CCITT), vẽ bằng `qrcode-generator`; in bằng `window.print` với CSS `@page { size: 80mm auto }`.
- Một giao dịch cơ sở dữ liệu cho mỗi lần thanh toán, trả hàng, đóng ca; khóa ca `FOR UPDATE`; chuẩn bị dãy số (`ensureSequence`) trước giao dịch.
- Mini app chỉ ghi schema `retail`; ghi `sales`, `inventory`, `finance` qua service của module đó.
- Máy chủ là nguồn đúng cho giá, khuyến mãi, tổng tiền; máy khách chỉ hiển thị.
- Màn hình bán: ô quét luôn nhận bàn phím sau mỗi thao tác; phím tắt F2 (tìm khách), F4 (giảm tay dòng đang chọn), F9 (thanh toán), Esc (đóng hộp thoại).

## 16. Điều kiện đặc biệt, điểm chưa xác minh

- Quy định hóa đơn điện tử khởi tạo từ máy tính tiền (điều kiện áp dụng, ký tự thứ tư `M` của ký hiệu, cấu trúc mã của cơ quan thuế do người bán tạo, thời hạn chuyển dữ liệu) chưa tra được nguyên văn Nghị định 254/2026/NĐ-CP, Thông tư 91/2026/TT-BTC ngày 2026-11-11. Nguồn thứ cấp (trang hướng dẫn của MISA, ihoadon) thống nhất chữ `M` ở ký tự thứ tư của ký hiệu 6 ký tự (ví dụ mẫu số 1, ký hiệu `C25MAA`), nhưng không thống nhất về văn bản áp dụng và độ dài mã của cơ quan thuế. Sẽ tra nguyên văn trước lát L5. Kế toán trưởng đối chiếu trước khi phát hành.
- MISA meInvoice cho hóa đơn máy tính tiền: chưa có tài liệu API; lát L5 chỉ làm bộ giả lập, hóa đơn chọn MISA báo "Lỗi cài đặt" với thông báo chưa hỗ trợ.
- Điểm phụ thuộc CONG_VIEC_51 (đang làm song song): lát L6 làm sau khi CONG_VIEC_51 hợp nhất vào `main`; nếu chưa kịp, trình người dùng chọn nghiệm thu L0 đến L5 trước.
- Thay đổi hành vi đã duyệt của CONG_VIEC_16 (loại hóa đơn mới), CONG_VIEC_13 (loại chứng từ quỹ không đối tượng), CONG_VIEC_08 (đơn bán lẻ): phiếu THAY_DOI_24 (phiên cha ghi vào tài liệu `24` trên `main`, pull request #101, ngày 2026-11-11).

## 17. Quyết định của người dùng (2026-11-11)

- Không bán khi mất mạng.
- Khách VComm tích và đổi điểm ngay tại quầy.
- Hóa đơn điện tử luôn khởi tạo từ máy tính tiền.
- Trả hàng theo hóa đơn thuộc phần 1.
- Tiền thu vào quỹ bằng phiếu thu tổng khi đóng ca.
- Tiền lệch khi đóng ca: ghi lý do và hạch toán (thiếu 1388, thừa 3381).
- Cho giảm giá tay trong mức tối đa của cài đặt bán hàng.
- Chuyển khoản: mã VietQR, thu ngân xác nhận.
- Quầy chỉ bán hàng hóa; hàng theo lô tự chọn lô hết hạn trước; hàng theo serial quét serial; kho bán không quản lý vị trí.
- Điểm xem trước L1 đạt, làm L2.

## 18. Thành phần không được thay đổi

Ghi sổ phiếu kho, sổ kho, công nợ, luồng duyệt, luồng đơn bán thường, đơn VComm, hóa đơn điện tử thường (chỉ thêm hàm, cột, loại mới; không đổi hành vi hiện có).

## 19. Các lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L0 | Bản mẫu MAN_HINH_161, 162, 164, 167 (HTML tĩnh) | Người dùng xem bố cục bán hàng, đóng ca, trả hàng, mẫu in – đã duyệt 2026-11-11 |
| L1 | Mini app `web-retail` cổng 3012, quyền, vai trò; cài đặt cửa hàng, quầy; mở ca, đóng ca (chưa lập chứng từ quỹ); danh sách ca | Tạo cửa hàng trên dữ liệu phát triển, mở ca, đóng ca – đạt 2026-11-11 |
| L2 | Bán hàng tiền mặt: quét, tìm, giá, khuyến mãi, giảm tay, ghi sổ đủ, in hóa đơn bán lẻ; danh sách, chi tiết hóa đơn | Bán một đơn bằng bàn phím, xem phiếu xuất, bút toán, bản in |
| L3 | Chuyển khoản VietQR, nhiều phương thức; đóng ca lập phiếu thu, phiếu chi, bút toán lệch | Bán kết hợp, đóng ca lệch, xem quỹ và sổ cái |
| L4 | Trả hàng theo hóa đơn | Trả một phần hóa đơn, xem nhập kho, bút toán, việc chờ hóa đơn |
| L5 | Hóa đơn điện tử khởi tạo từ máy tính tiền (bộ giả lập) | Bán có hóa đơn máy tính tiền in trên phiếu, xem hóa đơn ở mini app Tài chính |
| L6 | Tích, đổi điểm (sau CONG_VIEC_51) | Bán cho khách VComm dùng điểm, trả hàng hoàn điểm |

## 20. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
