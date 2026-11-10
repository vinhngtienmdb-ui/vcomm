# CONG_VIEC_14: Kế toán tổng hợp (MODULE_06, phần 2)

- Mô tả: Hệ thống tài khoản theo chế độ kế toán từng công ty; định khoản mặc định sửa được; bút toán tự sinh từ phiếu kho, phiếu thu chi; phiếu kế toán nhập tay qua luồng duyệt; khóa sổ, kết chuyển theo tháng; sổ cái, bảng cân đối số phát sinh.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
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
| CHUC_NANG_69 | Khởi tạo kế toán của công ty: chọn chế độ, nạp hệ thống tài khoản, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ trước đó; thêm, sửa, ngừng dùng tài khoản chi tiết | YCAU_NGHIEPVU_39 |
| CHUC_NANG_70 | Định khoản mặc định theo vai trò tài khoản (phải thu khách hàng, doanh thu, thuế đầu ra...), kế toán đổi tài khoản theo công ty | YCAU_NGHIEPVU_39 |
| CHUC_NANG_71 | Bút toán tự sinh khi ghi sổ phiếu kho, phiếu thu chi, ghi tổn thất hàng thiếu nội bộ | YCAU_NGHIEPVU_39 |
| CHUC_NANG_72 | Phiếu kế toán nhập tay (bút toán tổng hợp, số dư đầu kỳ tài khoản) qua luồng duyệt | YCAU_NGHIEPVU_39 |
| CHUC_NANG_73 | Khóa sổ theo tháng (kết chuyển doanh thu, chi phí sang xác định kết quả, kết quả sang lợi nhuận chưa phân phối), mở lại; sổ cái, bảng cân đối số phát sinh | YCAU_NGHIEPVU_39 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_93 | Mỗi công ty chọn một chế độ kế toán: Thông tư 99/2025/TT-BTC hoặc Thông tư 133/2016/TT-BTC. Khởi tạo nạp hệ thống tài khoản cấp 1, cấp 2 của chế độ (tài khoản hệ thống, không xóa, không đổi số hiệu). Đổi chế độ chỉ được khi công ty chưa có bút toán. Kế toán thêm tài khoản chi tiết dưới tài khoản bất kỳ: số hiệu bắt đầu bằng số hiệu tài khoản cha, dài hơn, duy nhất trong công ty; tính chất số dư theo tài khoản cha. Chỉ tài khoản không có tài khoản con đang dùng mới nhận bút toán. Tài khoản đã có bút toán không xóa, chỉ ngừng dùng | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_94 | Định khoản mặc định theo vai trò (bảng ở mục 8); kế toán đổi tài khoản của từng vai trò cho công ty, tài khoản phải nhận bút toán được; thay đổi áp dụng cho bút toán sinh sau đó | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_95 | Bút toán tự sinh trong cùng giao dịch ghi sổ chứng từ, ngày bút toán là ngày chứng từ, gắn đối tác với dòng phải thu, phải trả. Công ty chưa khởi tạo kế toán thì không sinh. Chứng từ ghi sổ vào ngày thuộc kỳ đã khóa bị từ chối (QUYTAC_NGHIEPVU_97). Tổng Nợ bằng tổng Có; dòng số tiền 0 bỏ qua | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_96 | Phiếu kế toán nhập tay: ngày, diễn giải, ít nhất hai dòng (tài khoản nhận bút toán, đối tác nếu cần, Nợ hoặc Có lớn hơn 0); tổng Nợ bằng tổng Có. Đi luồng duyệt (loại chứng từ `accounting.journal`, giá trị duyệt là tổng Nợ; chưa có chính sách thì ghi sổ ngay). Gửi lần đầu cấp số (`PKT`…). Sửa khi nháp, bị từ chối, đã rút; đã ghi sổ không sửa (điều chỉnh bằng phiếu khác) | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_97 | Khóa sổ theo tháng, lần lượt từ tháng sớm nhất chưa khóa: hệ thống tạo bút toán kết chuyển số dư cuối tháng của các tài khoản doanh thu, thu nhập, chi phí sang tài khoản xác định kết quả kinh doanh, rồi kết quả sang lợi nhuận chưa phân phối năm nay; ghi ngày khóa sổ đến cuối tháng đó. Sau khi khóa, không ghi sổ chứng từ nào (kho, thu chi, phiếu kế toán) có ngày trong kỳ đã khóa. Mở lại chỉ tháng khóa gần nhất, cần quyền mở sổ; mở lại xóa bút toán kết chuyển của tháng đó | YCAU_NGHIEPVU_39 |
| QUYTAC_NGHIEPVU_98 | Bảng cân đối số phát sinh theo khoảng ngày: mỗi tài khoản có số dư đầu kỳ, phát sinh Nợ, phát sinh Có, số dư cuối kỳ (Nợ hoặc Có theo dấu; tài khoản lưỡng tính hiện cả hai bên theo chi tiết đối tác), cộng dồn lên tài khoản cha; tổng Nợ bằng tổng Có ở mọi cột. Sổ cái của một tài khoản: số dư đầu, từng dòng bút toán (ngày, số, diễn giải, tài khoản đối ứng, Nợ, Có), số dư lũy kế | YCAU_NGHIEPVU_39 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa |
|---|---|
| `finance.ledger.view` | Xem tài khoản, bút toán, sổ cái, bảng cân đối số phát sinh |
| `finance.ledger.setup` | Khởi tạo kế toán, sửa tài khoản, định khoản mặc định |
| `finance.journal.manage` | Lập, sửa, gửi, rút phiếu kế toán |
| `finance.period.close` | Khóa sổ, mở lại sổ |

Vai trò Kế toán thêm `finance.ledger.view`, `finance.journal.manage`. Vai trò mới `chief_accountant` (Kế toán trưởng), phạm vi công ty: mọi quyền tài chính. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới. Loại chứng từ mới `accounting.journal` (Phiếu kế toán, cần duyệt).

## 6. Luồng nghiệp vụ

- Luồng 22 – Khởi tạo: Kế toán trưởng chọn chế độ → hệ thống nạp tài khoản, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ → kế toán thêm tài khoản chi tiết, lập phiếu kế toán số dư đầu kỳ.
- Luồng 23 – Ghi sổ tự động: chứng từ kho, thu chi ghi sổ → bút toán sinh cùng giao dịch.
- Luồng 24 – Phiếu kế toán: kế toán lập → gửi → duyệt → ghi sổ.
- Luồng 25 – Khóa sổ: kế toán trưởng xem bảng cân đối số phát sinh tháng → khóa sổ → bút toán kết chuyển → kỳ khóa.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_50 | Hệ thống tài khoản | Chưa khởi tạo: chọn chế độ, nút "Khởi tạo kế toán". Đã khởi tạo: cây tài khoản (số hiệu, tên, tính chất, trạng thái), thêm tài khoản chi tiết, sửa tên, ngừng dùng; thẻ "Định khoản mặc định": vai trò, tài khoản, đổi |
| MAN_HINH_51 | Bút toán | Danh sách bút toán (số, ngày, nguồn, diễn giải, tổng tiền, trạng thái), lọc nguồn, khoảng ngày; lập phiếu kế toán (bảng dòng tài khoản, đối tác, Nợ, Có, chênh lệch); chi tiết bút toán, chứng từ gốc, gửi, rút, sửa |
| MAN_HINH_52 | Sổ sách | Thẻ "Bảng cân đối số phát sinh" (khoảng ngày), thẻ "Sổ cái" (chọn tài khoản, khoảng ngày), thẻ "Khóa sổ" (đã khóa đến, khóa tháng tiếp theo, mở lại tháng gần nhất) |

## 8. Dữ liệu và API

- Database migration `0011_accounting.sql`, schema `accounting`: `settings` (chế độ, khóa sổ đến ngày), `accounts`, `posting_rules`, `journals`, `journal_lines`.
- Danh mục tài khoản và định khoản mặc định của hai chế độ khai báo trong mã (`apps/api/src/accounting/charts.ts`), lấy từ phụ lục hệ thống tài khoản của văn bản.
- Vai trò định khoản: phải thu khách hàng, phải trả nhà cung cấp, doanh thu bán hàng, giảm trừ doanh thu (hàng bán bị trả lại), thuế giá trị gia tăng đầu ra, thuế giá trị gia tăng đầu vào được khấu trừ, hàng hóa, giá vốn hàng bán, tiền mặt, tiền gửi ngân hàng, chi phí dùng nội bộ, chi phí quà tặng, chi phí hủy hỏng, tài sản thiếu chờ xử lý, tài sản thừa chờ giải quyết, nguồn số dư đầu kỳ hàng tồn, chi phí khác (ghi tổn thất hàng thiếu nội bộ), xác định kết quả kinh doanh, lợi nhuận chưa phân phối năm nay.
- API_87 `/finance/ledger/setup`, `/finance/accounts`, `/finance/posting-rules`; API_88 `/finance/journals`; API_89 `/finance/ledger/trial-balance`, `/finance/ledger/accounts/:id`, `/finance/ledger/periods`.

## 9. Điều kiện đặc biệt

- Kiểm khóa sổ trong cùng giao dịch ghi sổ chứng từ (đọc ngày khóa có khóa dòng).
- Khởi tạo tạo bút toán cho mọi chứng từ đã ghi sổ của công ty trong một giao dịch.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_111 | Khởi tạo đúng chế độ nạp đủ tài khoản; thêm tài khoản chi tiết đúng quy tắc số hiệu; đổi chế độ khi đã có bút toán bị từ chối | Bắt buộc |
| TIEUCHI_NGHIEMTHU_112 | Phiếu xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, nhập xuất khác, điều chỉnh, phiếu thu chi sinh bút toán cân, đúng tài khoản, đúng số tiền; đổi định khoản áp dụng cho chứng từ sau | Bắt buộc |
| TIEUCHI_NGHIEMTHU_113 | Phiếu kế toán lệch Nợ Có bị từ chối; qua luồng duyệt; đã ghi sổ không sửa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_114 | Khóa sổ tạo bút toán kết chuyển đúng; chứng từ có ngày trong kỳ khóa bị từ chối; mở lại tháng gần nhất | Bắt buộc |
| TIEUCHI_NGHIEMTHU_115 | Bảng cân đối số phát sinh cân ở mọi cột; sổ cái đúng số dư lũy kế | Bắt buộc |
| TIEUCHI_NGHIEMTHU_116 | MAN_HINH_50 đến MAN_HINH_52 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_210 trở đi, ghi trong tài liệu `21`; kiểm thử tự động `apps/api/test/c14-ledger.test.ts`.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện. Giao diện trong mini app `apps/web-finance`.
- Module Kho, phiếu thu chi gọi kế toán qua móc nối đăng ký lúc khởi động.

## 13. Thành phần không được thay đổi

Cách ghi sổ kho, giá vốn, công nợ (CONG_VIEC_13).

## 14. Các lát và điểm xem trước

- L0: database migration, quyền, khởi tạo, tài khoản, định khoản; bút toán tự sinh; MAN_HINH_50, danh sách bút toán. Điểm xem trước: khởi tạo trên dữ liệu phát triển, bút toán của phiếu đã có.
- L1: phiếu kế toán; khóa sổ, kết chuyển; sổ cái, bảng cân đối số phát sinh; MAN_HINH_51, 52. Điểm xem trước: khóa một tháng, bảng cân đối.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
