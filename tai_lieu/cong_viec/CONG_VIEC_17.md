# CONG_VIEC_17: Hoa hồng đội kinh doanh (MODULE_06, phần 5)

- Mô tả: Gán đơn bán cho nhân viên hưởng hoa hồng theo cài đặt công ty; ghi phát sinh hoa hồng khi thu tiền (bán lẻ: khi giao hàng); mức theo ngành hàng, kênh bán; hệ số theo phần trăm đạt chỉ tiêu tháng; chốt bảng hoa hồng tháng qua luồng duyệt, hạch toán; hoàn tiền sau khi chốt trừ vào kỳ sau.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp, chờ người dùng xác nhận thiết kế.
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
| CHUC_NANG_82 | Ghi phát sinh hoa hồng khi phiếu thu trừ nợ phiếu xuất giao hàng, khi phiếu chi hoàn tiền trả hàng; bán lẻ khi giao hàng, khi nhận hàng trả lại; xem phát sinh theo nhân viên, tháng | YCAU_NGHIEPVU_42 |
| CHUC_NANG_83 | Bảng hoa hồng tháng: lập, gửi duyệt, ghi sổ (bút toán chi phí hoa hồng, phải trả người lao động), rút, bị từ chối lập lại | YCAU_NGHIEPVU_42 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_108 | Cài đặt theo công ty: bật, ngày bắt đầu (bắt buộc khi bật); cách gán: nhân viên phụ trách khách (hồ sơ khách tại công ty) hoặc người lập đơn; cách kết hợp: "bảng ngành hàng và kênh" (mỗi ô ngành hàng, kênh một phần trăm; không có ô thì lấy mức của ngành hàng cho mọi kênh, rồi mức mặc định) hoặc "kênh nhân hệ số" (phần trăm theo ngành hàng, không có thì mặc định, nhân hệ số của kênh, kênh không khai hệ số là 1). Ngành hàng tra theo ngành hàng của sản phẩm, không có mức thì theo ngành hàng cha gần nhất. Phần trăm từ 0 đến 100, hệ số từ 0 đến 10. Bậc hệ số chỉ tiêu: danh sách (từ phần trăm đạt, hệ số), bậc đầu từ 0; nhân viên không có chỉ tiêu tháng thì hệ số 1 | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_109 | Khi gửi đơn bán lần đầu (công ty đang bật, ngày đơn không trước ngày bắt đầu), hệ thống gán nhân viên hưởng hoa hồng theo cách gán; khách không có nhân viên phụ trách thì đơn không có nhân viên hưởng. Gửi lại giữ nhân viên đã gán. Đổi cài đặt không đổi đơn đã gán | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_110 | Phát sinh hoa hồng ghi trong cùng giao dịch ghi sổ, theo từng dòng hàng, cố định mức tại lúc ghi: (a) phiếu thu khách hàng trừ nợ phiếu xuất giao hàng của đơn có nhân viên hưởng: số tiền trừ (gồm thuế) chia cho các dòng của phiếu xuất theo tiền gồm thuế, quy về tiền chưa thuế theo tỷ lệ của dòng, ngày phát sinh là ngày phiếu thu; (b) phiếu chi hoàn tiền trừ vào khoản giảm nợ của phiếu nhận hàng trả lại: ghi âm theo các dòng của phiếu trả; (c) đơn không có khách: phiếu xuất giao hàng ghi sổ là đã thu toàn bộ, phiếu nhận hàng trả lại ghi âm, ngày phát sinh là ngày phiếu kho. Trả hàng trừ vào phần chưa thu không phát sinh hoa hồng. Tiền hoa hồng = tiền chưa thuế × phần trăm, làm tròn theo đơn vị tiền tệ công ty | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_111 | Bảng hoa hồng lập theo tháng, lần lượt từ tháng có phát sinh sớm nhất chưa chốt; chỉ lập tháng đã kết thúc. Bảng gồm mọi phát sinh chưa vào bảng nào có ngày đến hết tháng (phát sinh của tháng đã chốt về sau, như hoàn tiền, vào bảng kỳ sau). Mỗi nhân viên: tổng tiền chưa thuế đã thu (cơ sở), hoa hồng trước hệ số, chỉ tiêu tháng, phần trăm đạt = cơ sở / chỉ tiêu, hệ số theo bậc, hoa hồng = hoa hồng trước hệ số × hệ số (có thể âm khi hoàn tiền vượt) | YCAU_NGHIEPVU_42 |
| QUYTAC_NGHIEPVU_112 | Bảng hoa hồng đi luồng duyệt (loại chứng từ `finance.commission`, giá trị duyệt là tổng hoa hồng, dãy số `HH`; chưa có chính sách thì ghi sổ ngay khi gửi). Ghi sổ: bút toán Nợ chi phí hoa hồng (vai trò định khoản mới `commission_expense`, mặc định 6411 Thông tư 99/2025, 6421 Thông tư 133) / Có phải trả người lao động (vai trò mới `staff_payable`, mặc định 334), ngày cuối tháng; kỳ đã khóa sổ thì không gửi được. Bị từ chối, rút: phát sinh trả về chưa vào bảng, lập lại được. Đã ghi sổ không sửa | YCAU_NGHIEPVU_42 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `finance.commission.view` | Xem phát sinh, bảng hoa hồng | Không |
| `finance.commission.manage` | Lập, gửi, rút bảng hoa hồng | Không |
| `finance.commission.setup` | Sửa cài đặt, bảng mức, chỉ tiêu | Có |

Kế toán: xem, quản lý. Kế toán trưởng, Quản trị công ty, Quản trị tập đoàn: cả ba. Loại chứng từ mới `finance.commission` (Bảng hoa hồng, cần duyệt, dãy số `HH`).

## 6. Luồng nghiệp vụ

- Luồng 29: Nhân viên gửi đơn → gán nhân viên hưởng → giao hàng → kế toán ghi sổ phiếu thu trừ nợ → phát sinh hoa hồng → cuối tháng kế toán lập bảng hoa hồng → duyệt → ghi sổ, bút toán.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_56 | Hoa hồng | Thẻ "Bảng hoa hồng": danh sách tháng, trạng thái; nút "Lập bảng tháng ..."; chi tiết: từng nhân viên (cơ sở, hoa hồng trước hệ số, chỉ tiêu, phần trăm đạt, hệ số, hoa hồng), gửi, rút. Thẻ "Phát sinh": lọc nhân viên, khoảng ngày; dòng (ngày, chứng từ, đơn, mặt hàng, tiền chưa thuế, phần trăm, hoa hồng, bảng) |
| MAN_HINH_57 | Cài đặt hoa hồng | Bật, ngày bắt đầu, cách gán, cách kết hợp, mức mặc định, bảng mức theo ngành hàng (và kênh), hệ số kênh, bậc hệ số; thẻ "Chỉ tiêu": nhân viên, tháng, tiền thu |

Màn hình chi tiết đơn bán (MAN_HINH_39) hiện "Nhân viên hưởng hoa hồng".

## 8. Dữ liệu và API

- Database migration `0015_commissions.sql`: `sales.orders.commission_user_id`; schema `finance`: `commission_settings`, `commission_rates` (công ty, ngành hàng, kênh, phần trăm), `commission_channel_factors`, `commission_targets` (công ty, nhân viên, tháng, tiền), `commission_events` (theo dòng hàng, có dấu), `commission_statements`, `commission_statement_lines`.
- API_93 `/finance/commission-settings` (cài đặt, bảng mức, hệ số, chỉ tiêu); API_94 `/finance/commissions` (phát sinh, bảng hoa hồng: lập, gửi, rút).

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

KICHBAN_KIEMTHU_234 trở đi, ghi trong tài liệu `21`; kiểm thử tự động `apps/api/test/c17-commissions.test.ts`.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Phát sinh ghi qua hàm gọi sau ghi sổ của phiếu thu chi, phiếu kho (như công nợ, bút toán).

## 13. Thành phần không được thay đổi

Ghi sổ phiếu kho, phiếu thu chi, công nợ, bút toán đã có (chỉ thêm hàm gọi sau ghi sổ, vai trò định khoản mới).

## 14. Các lát và điểm xem trước

- L0: cài đặt, bảng mức, chỉ tiêu, gán đơn, phát sinh, xem phát sinh. Điểm xem trước: thu tiền đơn trên dữ liệu phát triển thấy phát sinh.
- L1: bảng hoa hồng tháng, duyệt, ghi sổ, bút toán, hoàn tiền kỳ sau.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
