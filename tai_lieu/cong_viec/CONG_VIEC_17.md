# CONG_VIEC_17: Hoa hồng đội kinh doanh (MODULE_06, phần 5)

- Mô tả: Gán đơn bán cho nhân viên hưởng hoa hồng theo cài đặt công ty; ghi phát sinh hoa hồng khi thu tiền (bán lẻ: khi giao hàng); mức theo ngành hàng, kênh bán; hệ số theo phần trăm đạt chỉ tiêu tháng; chốt bảng hoa hồng tháng qua luồng duyệt, hạch toán; hoàn tiền sau khi chốt trừ vào kỳ sau.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Đã lập trình lát L0, L1 và sửa lỗi rà soát; nội dung khớp mã ngày 2026-11-10.
- Nguồn: tài liệu `04` mục 6, `05` mục 2.1 (hoa hồng đội kinh doanh theo đơn mua của khách phụ trách, quy tắc gán cấu hình được); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Nhân viên kinh doanh biết hoa hồng của mình theo tiền đã thu; kế toán chốt hoa hồng tháng đúng chính sách, có duyệt và bút toán, không tính tay.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_80 đến CHUC_NANG_83.

Ngoài phạm vi:
- Hoa hồng cộng tác viên (MODULE_10), nhà bán, cửa hàng liên kết (MODULE_07); hoa hồng nhiều tầng (tài liệu `05` mục 4).
- Chi trả hoa hồng (qua lương ở MODULE_08 Nhân sự; nhân viên chưa là đối tác nên chưa lập phiếu chi được); khấu trừ thuế thu nhập cá nhân.
- Đơn bán, phiếu thu đã ghi sổ trước ngày bắt đầu tính hoa hồng (không tính lùi).
- Nhân viên tự xem hoa hồng của mình ngoài mini app Tài chính – Kế toán.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_42 | Tính, chốt, hạch toán hoa hồng đội kinh doanh theo tiền đã thu, chính sách từng công ty | Kế toán, Kế toán trưởng, Nhân viên kinh doanh |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_80 | Cài đặt hoa hồng của công ty: bật, ngày bắt đầu, cách gán đơn, cách kết hợp ngành hàng và kênh, mức mặc định, bảng mức, hệ số kênh, bậc hệ số theo phần trăm đạt chỉ tiêu; chỉ tiêu tiền thu tháng từng nhân viên | YCAU_NGHIEPVU_42 |
| CHUC_NANG_81 | Gán nhân viên hưởng hoa hồng cho đơn bán khi gửi lần đầu | YCAU_NGHIEPVU_42 |
| CHUC_NANG_82 | Ghi phát sinh hoa hồng mỗi lần trừ nợ: phiếu thu trừ nợ phiếu xuất giao hàng (kể cả khoản trả trước tự trừ khi giao hàng), phiếu chi hoàn tiền trừ khoản giảm nợ của phiếu nhận hàng trả lại; bán lẻ khi giao hàng, khi nhận hàng trả lại; xem phát sinh theo nhân viên, khoảng ngày | YCAU_NGHIEPVU_42 |
| CHUC_NANG_83 | Bảng hoa hồng tháng: lập, bỏ bảng nháp, gửi duyệt, ghi sổ (bút toán chi phí hoa hồng, phải trả người lao động), rút, bị từ chối lập lại | YCAU_NGHIEPVU_42 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_108 | Cài đặt theo công ty, do người có quyền `finance.commission.setup` sửa: bật; ngày bắt đầu (bắt buộc khi bật); cách gán: nhân viên phụ trách khách (hồ sơ khách tại công ty) hoặc người lập đơn; cách kết hợp: "bảng ngành hàng và kênh" (mỗi ô ngành hàng, kênh một phần trăm; không có ô thì lấy mức của ngành hàng cho mọi kênh, rồi mức mặc định) hoặc "kênh nhân hệ số" (phần trăm theo ngành hàng, không có thì mức mặc định, nhân hệ số của kênh, kênh không khai hệ số là 1; kết quả làm tròn 4 chữ số lẻ). Ngành hàng tra theo ngành hàng của sản phẩm, không có mức thì theo ngành hàng cha gần nhất (tối đa 10 cấp). Phần trăm từ 0 đến 100, hệ số từ 0 đến 10, tối đa 4 chữ số lẻ. Mỗi cặp ngành hàng, kênh (hoặc mọi kênh) một mức. Bậc hệ số chỉ tiêu: 1 đến 20 bậc (từ phần trăm đạt, hệ số), bậc đầu từ 0, không trùng phần trăm bắt đầu; nhân viên không có chỉ tiêu tháng thì hệ số 1. Chỉ tiêu: tiền thu chưa thuế của tháng, lớn hơn 0, cho nhân viên đang làm việc tại công ty; để trống là không có chỉ tiêu | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_109 | Khi gửi đơn bán (công ty đang bật, ngày đơn không trước ngày bắt đầu, đơn chưa có nhân viên hưởng), hệ thống gán nhân viên hưởng hoa hồng theo cách gán; khách không có nhân viên phụ trách thì đơn không có nhân viên hưởng; đơn không có khách (bán lẻ) luôn gán cho người lập đơn; đơn bán cho công ty con trong tập đoàn, đơn đối ứng nội bộ không gán (quyết định người dùng 2026-11-10). Đơn đã gán giữ nhân viên khi gửi lại. Đổi cài đặt không đổi đơn đã gán | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_110 | Phát sinh hoa hồng ghi trong cùng giao dịch trừ nợ hoặc ghi sổ phiếu kho, theo từng dòng đơn (cộng mọi dòng phiếu của cùng dòng đơn), cố định mức tại lúc ghi: (a) mỗi lần trừ nợ giữa khoản phải thu của phiếu xuất giao hàng (đơn có nhân viên hưởng) và khoản giảm nợ của phiếu thu khách hàng, kể cả khoản trả trước tự trừ khi phiếu xuất ghi sổ: số tiền trừ (gồm thuế) chia cho các dòng đơn theo phần còn phải thu của từng dòng (tiền gồm thuế của dòng trên phiếu xuất, trừ hàng trả đã trừ vào nợ của phiếu xuất này, trừ phần đã thu ở các lần trước), không vượt phần còn của dòng; quy về tiền chưa thuế theo tỷ lệ của dòng; ngày phát sinh là ngày muộn hơn giữa ngày phiếu thu và ngày phiếu xuất (thu trước giao sau); (b) phiếu chi hoàn tiền trừ vào khoản giảm nợ của phiếu nhận hàng trả lại: ghi âm theo các dòng của phiếu trả, ngày muộn hơn giữa ngày phiếu chi và ngày phiếu trả; (c) đơn không có khách: phiếu xuất giao hàng ghi sổ là đã thu toàn bộ, phiếu nhận hàng trả lại ghi âm, ngày phát sinh là ngày phiếu kho. Trả hàng trừ vào phần chưa thu không phát sinh hoa hồng. Công ty chưa bật, đơn không có nhân viên hưởng, ngày phát sinh trước ngày bắt đầu: không ghi. Tiền chưa thuế, tiền hoa hồng (tiền chưa thuế × phần trăm) làm tròn theo đơn vị tiền tệ công ty. Sửa cài đặt không tính lại phát sinh đã ghi | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_111 | Bảng hoa hồng lập theo tháng, mỗi lần một bảng: đang có bảng nháp hoặc chờ duyệt thì không lập bảng mới. Tháng lập được là tháng sau tháng của bảng gần nhất đang dùng (không tính bảng bị từ chối, đã rút), nhưng không trước tháng của phát sinh sớm nhất chưa vào bảng (tháng không có phát sinh bị bỏ qua, không có bảng); chỉ lập tháng đã kết thúc. Bảng gồm mọi phát sinh chưa vào bảng nào có ngày đến hết tháng (phát sinh có ngày của tháng đã chốt, như hoàn tiền về sau, vào bảng kỳ sau). Mỗi nhân viên: tổng tiền chưa thuế (cơ sở), hoa hồng trước hệ số, chỉ tiêu của tháng, phần trăm đạt = cơ sở / chỉ tiêu × 100 (4 chữ số lẻ), hệ số của bậc có "từ phần trăm" lớn nhất không vượt phần trăm đạt, hoa hồng = hoa hồng trước hệ số × hệ số, làm tròn theo đơn vị tiền tệ công ty (có thể âm khi hoàn tiền vượt). Bỏ bảng nháp: phát sinh trả về chưa vào bảng | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_112 | Bảng hoa hồng đi luồng duyệt: loại chứng từ `finance.commission`, giá trị duyệt là trị tuyệt đối của tổng hoa hồng, ngày chứng từ là ngày cuối tháng, dãy số `HH` tự tạo khi gửi lần đầu; chưa có chính sách duyệt thì ghi sổ ngay khi gửi. Ghi sổ (công ty đã khởi tạo kế toán): bút toán nguồn `commission`, số là số bảng, Nợ chi phí hoa hồng (vai trò định khoản `commission_expense`, mặc định 6411 Thông tư 99/2025, 6421 Thông tư 133) / Có phải trả người lao động (`staff_payable`, mặc định 334); tổng âm thì đảo bên; ngày bút toán là ngày cuối tháng, tháng đã khóa sổ thì ngày sau ngày khóa sổ (bảng không chặn khóa sổ các tháng sau); thiếu định khoản của một trong hai vai trò thì không ghi sổ được. Công ty chưa khởi tạo kế toán: bảng vẫn ghi sổ, bút toán lập khi khởi tạo kế toán. Duyệt xong mà không ghi sổ được: bảng "Bị từ chối" kèm lý do. Bị từ chối, rút: phát sinh trả về chưa vào bảng, lập lại được. Chỉ người lập rút được. Đã ghi sổ không sửa, không xóa | YCAU_NGHIEPVU_42 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `finance.commission.view` | Xem phát sinh, bảng hoa hồng | Không |
| `finance.commission.manage` | Lập, gửi, rút bảng hoa hồng | Không |
| `finance.commission.setup` | Sửa cài đặt, bảng mức, chỉ tiêu | Có |

Kế toán: xem, quản lý. Kế toán trưởng, Quản trị công ty, Quản trị tập đoàn: cả ba. Loại chứng từ mới `finance.commission` (Bảng hoa hồng, cần duyệt, dãy số `HH`). API trước hết cần `finance.access` hoặc `finance.commission.view` trong công ty đang chọn; quyền chi tiết phải gán ở phạm vi tập đoàn hoặc công ty.

## 6. Luồng nghiệp vụ

- Luồng 29 (tài liệu `09`): Nhân viên gửi đơn → gán nhân viên hưởng → giao hàng → kế toán ghi sổ phiếu thu trừ nợ (hoặc khoản trả trước tự trừ khi giao) → phát sinh hoa hồng → sau khi tháng kết thúc kế toán lập bảng hoa hồng → gửi → duyệt → ghi sổ, bút toán.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_56 | Hoa hồng | Thẻ "Bảng hoa hồng": tháng tiếp theo cần chốt, nút "Lập bảng tháng ..."; danh sách (tháng, số, trạng thái, tổng hoa hồng); chi tiết: từng nhân viên (tiền chưa thuế, hoa hồng trước hệ số, chỉ tiêu, phần trăm đạt, hệ số, hoa hồng), gửi, bỏ bảng nháp, rút. Thẻ "Phát sinh": lọc khoảng ngày; dòng (ngày, nhân viên, nguồn kèm số chứng từ, đơn, mặt hàng, tiền chưa thuế, mức, hoa hồng, bảng) |
| MAN_HINH_57 | Cài đặt hoa hồng | Thẻ "Cài đặt": bật, ngày bắt đầu, cách gán, cách kết hợp, mức mặc định, mức theo ngành hàng (kênh chỉ khi kết hợp kiểu bảng), hệ số kênh (chỉ khi kênh nhân hệ số), bậc hệ số; thẻ "Chỉ tiêu": tháng, nhân viên, chỉ tiêu tiền thu chưa thuế |

Chi tiết đơn bán (MAN_HINH_43; bản 0.1 ghi nhầm MAN_HINH_39) hiện "Hưởng hoa hồng"; thẻ "Phát sinh" có ô lọc nhân viên (sửa bổ sung sau rà soát).

## 8. Dữ liệu và API

- Database migration `0015_commissions.sql` (lát L0): `sales.orders.commission_user_id`; schema `finance`: `commission_settings`, `commission_rates` (công ty, ngành hàng, kênh, phần trăm), `commission_channel_factors`, `commission_targets` (công ty, nhân viên, tháng, tiền), `commission_events` (theo dòng đơn, có dấu), `commission_statements`, `commission_statement_lines`.
- Database migration `0016_commission_postings.sql` (lát L1): nguồn bút toán `commission` trong `accounting.journals.source_type`; định khoản mặc định `commission_expense` (6411 Thông tư 99/2025, 6421 Thông tư 133), `staff_payable` (334) cho công ty đã khởi tạo kế toán.
- Database migration `0017_commission_line_basis.sql` (sửa sau rà soát): cột `commission_events.gross_amount` (tiền gồm thuế đã thu của dòng). Chi tiết: tài liệu `16` mục 17.
- Module `apps/api/src/commission`; móc nối `DebtsService.allocatedHooks` (mới, gọi sau mỗi lần trừ nợ), `StockDocumentsService.postedHooks`; gán nhân viên hưởng trong giao dịch gửi đơn bán (`assignCommissionUser`); bút toán bằng `commissionDraft` (`apps/api/src/accounting/postings.ts`).
- API_93 `GET`, `PUT /finance/commission-settings`; `GET /finance/commission-targets?month=`, `PUT /finance/commission-targets`. API_94 `GET /finance/commissions/events`; `GET`, `POST /finance/commissions/statements`; `GET /finance/commissions/statements/{id}`; `POST /finance/commissions/statements/{id}/submit`, `/withdraw`; `DELETE /finance/commissions/statements/{id}` (bỏ bảng nháp). Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE` (khóa thông báo ở tài liệu `17` mục 3l).

## 9. Điều kiện đặc biệt

Không có.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_127 | Cài đặt, bảng mức, hệ số, bậc, chỉ tiêu đúng kiểm tra; chỉ người có quyền cài đặt sửa được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_128 | Đơn gán đúng nhân viên theo cách gán, giữ khi gửi lại | Bắt buộc |
| TIEUCHI_NGHIEMTHU_129 | Phát sinh đúng khi thu tiền (chia theo dòng, tiền chưa thuế, mức theo ngành hàng, kênh, hai cách kết hợp), hoàn tiền ghi âm, bán lẻ khi giao, trả hàng chưa thu không phát sinh | Bắt buộc |
| TIEUCHI_NGHIEMTHU_130 | Bảng tháng đúng cơ sở, phần trăm đạt, hệ số, tổng; lần lượt theo tháng; phát sinh muộn vào kỳ sau; duyệt, ghi sổ, bút toán đúng; bị từ chối lập lại được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_131 | MAN_HINH_56, 57 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_234 đến KICHBAN_KIEMTHU_242 tự động (`apps/api/test/c17-commissions.test.ts`); KICHBAN_KIEMTHU_243 (máy tính), KICHBAN_KIEMTHU_244 (điện thoại) thủ công trên trình duyệt; ghi trong tài liệu `21`.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Phát sinh ghi qua móc nối trong giao dịch trừ nợ (`DebtsService.allocatedHooks`) và ghi sổ phiếu kho (`StockDocumentsService.postedHooks`); module Công nợ, Kho không phụ thuộc module hoa hồng.

## 13. Thành phần không được thay đổi

Ghi sổ phiếu kho, phiếu thu chi, công nợ, bút toán đã có (chỉ thêm móc nối sau trừ nợ, vai trò định khoản mới, nguồn bút toán `commission`, lập bút toán cho bảng đã ghi sổ khi khởi tạo kế toán).

## 14. Các lát và điểm xem trước

- L0: cài đặt, bảng mức, chỉ tiêu, gán đơn, phát sinh, xem phát sinh. Điểm xem trước: thu tiền đơn trên dữ liệu phát triển thấy phát sinh.
- L1: bảng hoa hồng tháng, duyệt, ghi sổ, bút toán, hoàn tiền kỳ sau.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Giới hạn đã biết (rà soát 2026-11-10)

- Sửa cài đặt sau khi đã ghi phát sinh không tính lại phát sinh (mức cố định tại lúc ghi).
- Chi trả hoa hồng ngoài phạm vi (qua lương ở MODULE_08); bút toán chỉ ghi phải trả người lao động.
- Giá trị duyệt là trị tuyệt đối của tổng hoa hồng: bảng âm (hoàn tiền vượt) vẫn qua duyệt.
- Tháng tiếp theo bỏ qua tháng không có phát sinh; tháng đó không có bảng.
- Phiếu chi hoàn tiền được trừ vào khoản giảm nợ cũ nhất còn mở, có thể là khoản trả trước thay vì phiếu nhận hàng trả lại; khi đó không ghi phát sinh âm.
- Khoản giảm nợ của số dư đầu kỳ không phát sinh hoa hồng.
- Với cách gán nhân viên phụ trách khách, đơn không có khách không có nhân viên hưởng; chỉ cách gán người lập đơn tính hoa hồng cho bán lẻ.
- Đơn bán nội bộ phát sinh hoa hồng như đơn bán thường.
- Tháng của bảng đã khóa sổ: bút toán lấy ngày sau ngày khóa sổ, không phải ngày cuối tháng.
