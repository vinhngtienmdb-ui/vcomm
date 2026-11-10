# CONG_VIEC_14: Kế toán tổng hợp (MODULE_06, phần 2)

- Mô tả: Hệ thống tài khoản theo chế độ kế toán từng công ty; định khoản mặc định sửa được; bút toán tự sinh từ phiếu kho, phiếu thu chi, ghi tổn thất hàng thiếu nội bộ; phiếu kế toán nhập tay qua luồng duyệt; khóa sổ, kết chuyển theo tháng; sổ cái, bảng cân đối số phát sinh.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ. Bản 0.2 sửa cho khớp mã đã làm (mục 18): chế độ kế toán lấy từ trường có sẵn của công ty, không có bảng chọn riêng; tài khoản chi tiết thêm được dưới tài khoản đã có bút toán; vai trò định khoản, tài khoản mặc định từng chế độ; làm tròn theo tiền tệ công ty; điều kiện khóa sổ, mở lại; phiếu kế toán duyệt xong mà kỳ đã khóa; endpoint.
- Nguồn: tài liệu `05` mục 2.1 (Tài chính – Kế toán: hệ thống tài khoản Thông tư 99/2025, Thông tư 133 cho công ty con nhỏ và vừa; bút toán tự động từ chứng từ); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Mỗi công ty con có sổ kế toán đúng chế độ của mình; nghiệp vụ kho, thu chi tự thành bút toán, kế toán chỉ lập bút toán điều chỉnh; cuối tháng kết chuyển, khóa sổ, xem sổ cái và bảng cân đối số phát sinh.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_69 đến CHUC_NANG_73.

Ngoài phạm vi:
- Báo cáo tài chính (CONG_VIEC_15, làm ngay sau).
- Hóa đơn điện tử; thuế giá trị gia tăng theo hóa đơn; tờ khai thuế.
- Ngoại tệ, chênh lệch tỷ giá; tài sản cố định, khấu hao, công cụ dụng cụ; tiền lương; hợp nhất báo cáo.
- Đối tượng chi tiết ngoài đối tác (bộ phận, vụ việc, hợp đồng).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_39 | Ghi sổ kế toán kép theo chế độ kế toán từng công ty; bút toán tự sinh từ nghiệp vụ; điều chỉnh bằng phiếu kế toán; khóa sổ theo kỳ; xem sổ cái, bảng cân đối số phát sinh | Kế toán, Kế toán trưởng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_69 | Khởi tạo kế toán của công ty theo chế độ kế toán của công ty: nạp hệ thống tài khoản, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ trước đó; thêm tài khoản chi tiết, sửa tên, ngừng dùng | YCAU_NGHIEPVU_39 |
| CHUC_NANG_70 | Định khoản mặc định theo vai trò tài khoản (phải thu khách hàng, doanh thu, thuế đầu ra...), kế toán trưởng đổi tài khoản theo công ty | YCAU_NGHIEPVU_39 |
| CHUC_NANG_71 | Bút toán tự sinh khi ghi sổ phiếu kho, phiếu thu chi, ghi tổn thất hàng thiếu nội bộ | YCAU_NGHIEPVU_39 |
| CHUC_NANG_72 | Phiếu kế toán nhập tay (bút toán tổng hợp, số dư đầu kỳ tài khoản) qua luồng duyệt | YCAU_NGHIEPVU_39 |
| CHUC_NANG_73 | Khóa sổ theo tháng (kết chuyển doanh thu, chi phí sang xác định kết quả, kết quả sang lợi nhuận chưa phân phối), mở lại; sổ cái, bảng cân đối số phát sinh | YCAU_NGHIEPVU_39 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_93 | Chế độ kế toán là trường `accounting_regime` có sẵn của công ty (Thông tư 99/2025/TT-BTC `TT99_2025` hoặc Thông tư 133/2016/TT-BTC `TT133`), đổi ở quản lý công ty (API_20); không có bảng chọn chế độ riêng. Khởi tạo kế toán nạp hệ thống tài khoản của chế độ (tài khoản hệ thống, không ngừng dùng, không đổi số hiệu, được đổi tên). Đổi chế độ: công ty đã có bút toán thì từ chối; đã khởi tạo nhưng chưa có bút toán thì bỏ khởi tạo (xóa tài khoản, định khoản, cài đặt) để khởi tạo lại theo chế độ mới. Kế toán trưởng thêm tài khoản chi tiết dưới tài khoản đang dùng bất kỳ, kể cả tài khoản đã có bút toán: số hiệu 3 đến 20 chữ số hoặc chữ cái, bắt đầu bằng số hiệu tài khoản cha, dài hơn, duy nhất trong công ty; tính chất số dư theo tài khoản cha. Định khoản đang dùng tài khoản cha chuyển sang tài khoản chi tiết mới; bút toán cũ giữ ở tài khoản cha và vẫn cộng vào số dư của cha. Chỉ tài khoản đang dùng, không có tài khoản con đang dùng mới nhận bút toán. Tài khoản chi tiết ngừng dùng được khi không nằm trong định khoản mặc định và không còn tài khoản con đang dùng; không xóa tài khoản | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_94 | Định khoản mặc định theo vai trò (bảng ở mục 8); kế toán trưởng đổi tài khoản của từng vai trò cho công ty, tài khoản phải nhận bút toán được; thay đổi áp dụng cho bút toán sinh sau đó | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_95 | Bút toán tự sinh trong cùng giao dịch ghi sổ chứng từ, ngày bút toán là ngày chứng từ (ghi tổn thất hàng thiếu nội bộ: ngày ghi tổn thất), số bút toán là số chứng từ gốc, gắn đối tác với dòng phải thu, phải trả. Công ty chưa khởi tạo kế toán thì không sinh. Chứng từ sinh bút toán mà ngày thuộc kỳ đã khóa thì bị từ chối (QUYTAC_NGHIEPVU_97); phiếu chuyển kho không sinh bút toán nên không bị chặn. Số tiền làm tròn theo số chữ số lẻ của tiền tệ công ty (đồng Việt Nam: 0): tổng gồm thuế làm tròn trước, tiền chưa thuế làm tròn, thuế là phần còn lại. Tổng Nợ bằng tổng Có; dòng số tiền 0 bỏ qua | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_96 | Phiếu kế toán nhập tay: ngày, diễn giải (1 đến 500 ký tự), 2 đến 200 dòng (tài khoản nhận bút toán được, đối tác có hồ sơ ở công ty nếu cần, diễn giải dòng, Nợ hoặc Có lớn hơn 0, không ghi cả hai bên); số tiền không lẻ hơn đơn vị nhỏ nhất của tiền tệ công ty; tổng Nợ bằng tổng Có. Ngày thuộc kỳ đã khóa thì không lập, sửa, gửi được. Đi luồng duyệt (loại chứng từ `accounting.journal`, giá trị duyệt là tổng Nợ; chưa có chính sách thì ghi sổ ngay khi gửi). Gửi lần đầu cấp số (`PKT`…), gửi lại giữ số. Sửa khi nháp, bị từ chối, đã rút (về nháp); người lập rút được khi chờ duyệt và cấp duyệt đầu chưa quyết định. Duyệt xong mà kỳ đã khóa thì phiếu về "Bị từ chối" kèm lý do. Đã ghi sổ không sửa (điều chỉnh bằng phiếu khác) | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_97 | Khóa sổ theo tháng, lần lượt: tháng tiếp theo là tháng sau tháng đã khóa; chưa khóa lần nào thì tháng của bút toán đã ghi sổ sớm nhất. Chỉ khóa tháng đã kết thúc (ngày cuối tháng trước hôm nay). Còn phiếu kế toán chờ duyệt có ngày đến hết tháng thì không khóa được. Khóa sổ tạo bút toán kết chuyển số `KC-YYYY-MM`, ngày cuối tháng: số dư lũy kế đến cuối tháng của từng tài khoản loại 5 đến 8 (kể cả 521, trừ tài khoản xác định kết quả) kết chuyển trực tiếp sang tài khoản xác định kết quả kinh doanh (911); số dư của 911 chuyển sang lợi nhuận chưa phân phối năm nay (4212): dư Có là lãi, dư Nợ là lỗ; ghi ngày khóa sổ đến cuối tháng. Sau khi khóa, không ghi sổ chứng từ sinh bút toán (kho, thu chi, ghi tổn thất, phiếu kế toán) có ngày trong kỳ đã khóa. Mở lại chỉ tháng khóa gần nhất, cần quyền khóa sổ: xóa bút toán kết chuyển của tháng đó, lùi ngày khóa về lần khóa trước (chưa có thì bỏ ngày khóa) | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_98 | Bảng cân đối số phát sinh theo khoảng ngày: mỗi tài khoản có số dư đầu kỳ, phát sinh Nợ, phát sinh Có, số dư cuối kỳ (Nợ hoặc Có theo dấu; tài khoản lưỡng tính hiện cả hai bên theo chi tiết đối tác), cộng dồn lên tài khoản cha; tổng Nợ bằng tổng Có ở mọi cột. Sổ cái của một tài khoản (gồm tài khoản chi tiết): số dư đầu, từng dòng bút toán (ngày, số, diễn giải, tài khoản đối ứng, Nợ, Có), số dư lũy kế. Chỉ tính bút toán đã ghi sổ | YCAU_NGHIEPVU_39 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `finance.ledger.view` | Xem tài khoản, bút toán, sổ cái, bảng cân đối số phát sinh | Không |
| `finance.ledger.setup` | Khởi tạo kế toán, thêm, sửa tài khoản, đổi định khoản mặc định | Không |
| `finance.journal.manage` | Lập, sửa, gửi, rút phiếu kế toán | Không |
| `finance.period.close` | Khóa sổ, mở lại sổ | Có |

Quyền chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty. Vai trò Kế toán thêm `finance.ledger.view`, `finance.journal.manage`. Vai trò mới `chief_accountant` (Kế toán trưởng), phạm vi công ty: mọi quyền tài chính (`finance.access`, `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage`, bốn quyền mới) và `crm.access`, `crm.partner.view`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới. Loại chứng từ mới `accounting.journal` (Phiếu kế toán, cần duyệt, dãy số `PKT`).

## 6. Luồng nghiệp vụ

- Luồng 22 – Khởi tạo: quản trị tập đoàn đặt chế độ kế toán của công ty (quản lý công ty) → kế toán trưởng bấm "Khởi tạo kế toán" → hệ thống nạp tài khoản, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ → kế toán trưởng thêm tài khoản chi tiết, kế toán lập phiếu kế toán số dư đầu kỳ.
- Luồng 23 – Ghi sổ tự động: chứng từ kho, thu chi ghi sổ, biên bản nội bộ ghi tổn thất → bút toán sinh cùng giao dịch.
- Luồng 24 – Phiếu kế toán: kế toán lập → gửi → duyệt → ghi sổ.
- Luồng 25 – Khóa sổ: kế toán trưởng xem bảng cân đối số phát sinh tháng → khóa sổ → bút toán kết chuyển → kỳ khóa; mở lại tháng gần nhất khi cần.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_50 | Hệ thống tài khoản | Chưa khởi tạo: chế độ kế toán của công ty, nút "Khởi tạo kế toán". Đã khởi tạo: dòng chế độ kế toán; thẻ "Tài khoản": cây tài khoản (số hiệu, tên, tính chất, trạng thái), thêm tài khoản chi tiết, sửa tên, ngừng dùng; thẻ "Định khoản mặc định": nghiệp vụ, ô chọn tài khoản |
| MAN_HINH_51 | Bút toán | Danh sách bút toán (số, ngày, nguồn, diễn giải, số tiền, trạng thái), lọc nguồn, trạng thái, khoảng ngày; lập phiếu kế toán (bảng dòng tài khoản, đối tác, diễn giải dòng, Nợ, Có, tổng, chênh lệch); chi tiết bút toán, mở chứng từ gốc, sửa, gửi, rút |
| MAN_HINH_52 | Sổ sách | Thẻ "Bảng cân đối số phát sinh" (khoảng ngày), thẻ "Sổ cái" (chọn tài khoản, khoảng ngày), thẻ "Khóa sổ" (đã khóa đến, tháng tiếp theo cần khóa, khóa tháng tiếp theo, mở lại tháng gần nhất) |

## 8. Dữ liệu và API

- Database migration `0011_accounting.sql`, schema `accounting`: `settings` (ngày khóa sổ; có dòng là đã khởi tạo; không lưu chế độ), `accounts`, `posting_rules`, `journals`, `journal_lines`.
- Danh mục tài khoản và định khoản mặc định của hai chế độ khai báo trong mã (`apps/api/src/accounting/charts.ts`): Thông tư 99/2025/TT-BTC (ban hành 27/10/2025, hiệu lực 01/01/2026) 184 tài khoản, lập từ bản chép Phụ lục II đã đối chiếu số lượng và các điểm thay đổi, phải so với bản gốc trước khi phát hành; Thông tư 133/2016/TT-BTC (hiệu lực 01/01/2017) 121 tài khoản, lập từ Điều 12 đến Điều 68.
- Vai trò định khoản và tài khoản mặc định (`apps/api/src/accounting/postings.ts`, `charts.ts`):

| Vai trò | Nghiệp vụ | Thông tư 99/2025 | Thông tư 133 |
|---|---|---|---|
| `receivable` | Phải thu khách hàng | 131 | 131 |
| `payable` | Phải trả nhà cung cấp | 331 | 331 |
| `revenue` | Doanh thu bán hàng | 511 | 5111 |
| `sales_return` | Hàng bán bị trả lại (giảm trừ doanh thu) | 521 | 5111 |
| `vat_output` | Thuế giá trị gia tăng đầu ra | 33311 | 33311 |
| `vat_input` | Thuế giá trị gia tăng đầu vào được khấu trừ | 1331 | 1331 |
| `goods` | Hàng hóa | 156 | 156 |
| `cogs` | Giá vốn hàng bán | 632 | 632 |
| `cash` | Tiền mặt (quỹ tiền mặt) | 111 | 1111 |
| `bank` | Tiền gửi ngân hàng (quỹ ngân hàng) | 112 | 1121 |
| `internal_use_expense` | Chi phí hàng xuất dùng nội bộ | 6422 | 6422 |
| `gift_expense` | Chi phí hàng xuất làm quà tặng | 6418 | 6421 |
| `disposal_expense` | Hàng hủy, hỏng, hết hạn | 632 | 632 |
| `shortage_pending` | Hàng thiếu chờ xử lý (xuất khác, kiểm kê thiếu) | 1381 | 1381 |
| `surplus_pending` | Hàng thừa chờ giải quyết (nhập khác, kiểm kê thừa) | 3381 | 3381 |
| `opening_offset` | Đối ứng nhập tồn kho đầu kỳ | 3388 | 3388 |
| `internal_shortage` | Hàng thiếu giao nội bộ ghi tổn thất | 1381 | 1381 |
| `income_summary` | Xác định kết quả kinh doanh | 911 | 911 |
| `retained_earnings` | Lợi nhuận chưa phân phối năm nay | 4212 | 4212 |

- Bút toán theo chứng từ: xuất giao hàng Nợ phải thu (gồm thuế) / Có doanh thu, Có thuế đầu ra; Nợ giá vốn / Có hàng hóa (giá trị ghi sổ kho). Nhận hàng trả lại: ngược lại, doanh thu thay bằng hàng bán bị trả lại. Nhập mua (phần đạt kiểm tra chất lượng, giá đơn mua): Nợ hàng hóa, Nợ thuế đầu vào / Có phải trả. Trả hàng nhà cung cấp: ngược lại. Nhập khác: Nợ hàng hóa / Có đối ứng tồn đầu kỳ (lý do tồn đầu kỳ) hoặc hàng thừa chờ giải quyết. Xuất khác: Nợ chi phí dùng nội bộ, quà tặng, hủy hỏng (hủy, hết hạn) hoặc hàng thiếu chờ xử lý (lý do khác) / Có hàng hóa. Điều chỉnh: phần thừa Nợ hàng hóa / Có hàng thừa; phần thiếu Nợ hàng thiếu / Có hàng hóa. Phiếu thu chi: quỹ đối ứng phải thu, phải trả của đối tác theo loại phiếu. Ghi tổn thất hàng thiếu nội bộ: Nợ hàng thiếu giao nội bộ / Có phải thu (giá đơn bán gồm thuế của phần thiếu).
- API_87 `GET`, `POST /finance/ledger/setup`; `GET`, `POST /finance/accounts`; `PATCH /finance/accounts/{id}`; `GET /finance/posting-rules`; `PUT /finance/posting-rules/{role}`. API_88 `GET`, `POST /finance/journals`; `GET`, `PATCH /finance/journals/{id}`; `POST /finance/journals/{id}/submit`, `/withdraw`. API_89 `GET /finance/ledger/periods`; `POST /finance/ledger/periods/close`, `/reopen`; `GET /finance/ledger/trial-balance?from=&to=`; `GET /finance/ledger/accounts/{id}?from=&to=`. Bộ điều khiển `apps/api/src/accounting/ledger.controller.ts`. API_20 (sửa công ty) thêm lỗi đổi chế độ kế toán khi đã có bút toán.

## 9. Điều kiện đặc biệt

- Kiểm khóa sổ trong cùng giao dịch ghi sổ chứng từ (đọc ngày khóa có khóa dòng chia sẻ); khóa sổ, mở lại khóa dòng cài đặt để chạy tuần tự với ghi sổ.
- Khởi tạo tạo bút toán cho mọi chứng từ đã ghi sổ của công ty trong một giao dịch, theo thứ tự ghi sổ, không kiểm khóa sổ.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_111 | Khởi tạo theo chế độ của công ty nạp đủ tài khoản, tạo bút toán cho chứng từ đã ghi sổ; thêm tài khoản chi tiết đúng quy tắc số hiệu, nhận định khoản của tài khoản cha; đổi chế độ khi đã có bút toán bị từ chối | Bắt buộc |
| TIEUCHI_NGHIEMTHU_112 | Phiếu xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, nhập xuất khác, điều chỉnh, phiếu thu chi sinh bút toán cân, đúng tài khoản, đúng số tiền; đổi định khoản áp dụng cho chứng từ sau | Bắt buộc |
| TIEUCHI_NGHIEMTHU_113 | Phiếu kế toán lệch Nợ Có, ghi cả hai bên, số lẻ hơn đơn vị tiền tệ bị từ chối; qua luồng duyệt; đã ghi sổ không sửa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_114 | Khóa sổ tạo bút toán kết chuyển đúng; chứng từ có ngày trong kỳ khóa bị từ chối; tháng chưa kết thúc không khóa được; mở lại tháng gần nhất | Bắt buộc |
| TIEUCHI_NGHIEMTHU_115 | Bảng cân đối số phát sinh cân ở mọi cột; sổ cái đúng số dư lũy kế | Bắt buộc |
| TIEUCHI_NGHIEMTHU_116 | MAN_HINH_50 đến MAN_HINH_52 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_210 đến KICHBAN_KIEMTHU_216, ghi trong tài liệu `21`: 210 đến 214 tự động (`apps/api/test/c14-ledger.test.ts`); 215 (máy tính), 216 (điện thoại) thủ công cho TIEUCHI_NGHIEMTHU_116.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện. Giao diện trong mini app `apps/web-finance`.
- Module Kho, phiếu thu chi gọi kế toán qua móc nối đăng ký lúc khởi động (`postedHooks`, `writtenOffHooks`). Module Tổ chức gọi `beforeRegimeChange` (`apps/api/src/accounting/regime-guard.ts`) khi đổi chế độ kế toán.

## 13. Thành phần không được thay đổi

Cách ghi sổ kho, giá vốn, công nợ (CONG_VIEC_13).

## 14. Các lát và điểm xem trước

- L0: database migration, quyền, khởi tạo, tài khoản, định khoản; bút toán tự sinh; MAN_HINH_50, danh sách bút toán. Điểm xem trước: khởi tạo trên dữ liệu phát triển, bút toán của phiếu đã có.
- L1: phiếu kế toán; khóa sổ, kết chuyển; sổ cái, bảng cân đối số phát sinh; MAN_HINH_51, 52. Điểm xem trước: khóa một tháng, bảng cân đối.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng)

- Dùng lại trường chế độ kế toán của công ty thay cho bảng chọn riêng, để một công ty chỉ có một nơi lưu chế độ.
- Cho thêm tài khoản chi tiết dưới tài khoản đã có bút toán; định khoản tự chuyển sang tài khoản chi tiết, để kế toán mở chi tiết sau khi đã phát sinh mà không phải sửa bút toán cũ.
- Tài khoản mặc định từng vai trò theo bảng mục 8; Thông tư 133 không có tài khoản 521 nên hàng bán bị trả lại ghi giảm 5111; hàng hủy, hỏng, hết hạn ghi vào giá vốn.
- Bút toán làm tròn theo tiền tệ công ty; công nợ (CONG_VIEC_13) vẫn giữ 4 chữ số lẻ.
- Khóa sổ chỉ tháng đã kết thúc, lần lượt; chặn khi còn phiếu kế toán chờ duyệt; kết chuyển thẳng từng tài khoản loại 5 đến 8 sang 911, không kết chuyển 521 qua 511 trước.
- Mở lại xóa bút toán kết chuyển, không giữ lịch sử kết chuyển cũ (nhật ký thao tác ghi lần mở lại).
- Phiếu kế toán duyệt xong mà kỳ đã khóa thì về "Bị từ chối" kèm lý do, như phiếu chi.
- Ghi tổn thất hàng thiếu nội bộ dùng vai trò riêng `internal_shortage` (mặc định 1381) thay cho chi phí khác.

## 17. Quyết định của người dùng (2026-11-10)

- Chế độ kế toán chọn theo từng công ty (Thông tư 99/2025 hoặc Thông tư 133); hệ thống nạp sẵn danh mục; kế toán thêm tài khoản chi tiết; chưa phát sinh bút toán mới đổi được chế độ. Định khoản tự sinh có mặc định, sửa được theo công ty, áp dụng cho chứng từ sau. Doanh thu ghi nhận khi phiếu xuất giao hàng ghi sổ (tài liệu `02`).

## 18. Chỗ sửa cho khớp mã (bản 0.2)

| Vị trí | Bản 0.1 | Mã đã làm (bản 0.2) |
|---|---|---|
| QUYTAC_NGHIEPVU_93, CHUC_NANG_69, MAN_HINH_50 | Mỗi công ty chọn chế độ khi khởi tạo; màn hình có ô chọn chế độ | Chế độ lấy từ trường `accounting_regime` có sẵn của công ty, đổi ở quản lý công ty (API_20); không có bảng, ô chọn chế độ riêng. Đã khởi tạo, chưa có bút toán mà đổi chế độ thì bỏ khởi tạo |
| QUYTAC_NGHIEPVU_93 | Tài khoản chi tiết dưới tài khoản bất kỳ; tài khoản đã có bút toán chỉ ngừng dùng | Thêm được cả dưới tài khoản đã có bút toán; định khoản của tài khoản cha chuyển sang tài khoản con; bút toán cũ vẫn cộng vào cha. Tài khoản hệ thống không ngừng dùng; tài khoản trong định khoản hoặc còn con đang dùng không ngừng dùng được; không có xóa |
| Mục 8 | Vai trò "chi phí khác (ghi tổn thất hàng thiếu nội bộ)" | Vai trò `internal_shortage` "Hàng thiếu giao nội bộ ghi tổn thất", mặc định 1381; thêm bảng tài khoản mặc định từng chế độ |
| QUYTAC_NGHIEPVU_95 | Không nêu làm tròn | Làm tròn theo `minor_units` của tiền tệ công ty; tổng gồm thuế làm tròn trước, thuế là phần còn lại; chuyển kho không bị chặn khi kỳ khóa |
| QUYTAC_NGHIEPVU_96 | Không nêu số lẻ, giới hạn | Từ chối số lẻ hơn đơn vị tiền tệ; 2 đến 200 dòng; duyệt xong mà kỳ đã khóa thì về "Bị từ chối" (`post_error`) |
| QUYTAC_NGHIEPVU_97 | Lần lượt từ tháng sớm nhất chưa khóa; kết chuyển doanh thu, thu nhập, chi phí | Chỉ tháng đã kết thúc; chặn khi còn phiếu kế toán chờ duyệt trong kỳ; kết chuyển trực tiếp tài khoản loại 5 đến 8 (kể cả 521) sang 911, kết quả sang 4212; số `KC-YYYY-MM`. Mở lại lùi ngày khóa về lần khóa trước |
| Mục 5 | Không nêu nhạy cảm, phạm vi gán | `finance.period.close` nhạy cảm; quyền gán ở tập đoàn hoặc công ty; Kế toán trưởng có thêm `crm.access`, `crm.partner.view` |
| Mục 8 | API_87 đến API_89 nêu một phần đường dẫn | Đủ endpoint theo `ledger.controller.ts`; thêm lỗi đổi chế độ ở API_20 |
| Mục 8 | Nguồn danh mục "phụ lục hệ thống tài khoản của văn bản" | Thông tư 99/2025/TT-BTC lập từ bản chép Phụ lục II đã đối chiếu, chưa so bản gốc; Thông tư 133/2016/TT-BTC từ Điều 12 đến 68 |
