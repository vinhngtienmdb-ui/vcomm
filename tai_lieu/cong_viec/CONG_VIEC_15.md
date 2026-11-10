# CONG_VIEC_15: Báo cáo tài chính (MODULE_06, phần 3)

- Mô tả: Báo cáo tình hình tài chính, Báo cáo kết quả hoạt động kinh doanh theo mẫu của chế độ kế toán từng công ty, lập từ sổ cái; xem trên màn hình, xuất Excel, PDF.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (báo cáo tài chính từng công ty); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02` (phạm vi gồm báo cáo tài chính; tách ngắn hạn, dài hạn theo tài khoản chi tiết; Thông tư 133 cho chọn mẫu B01a-DNN hoặc B01b-DNN; xem màn hình, xuất Excel, PDF); Thông tư 99/2025/TT-BTC Điều 17, Phụ lục IV; Thông tư 133/2016/TT-BTC Điều 81.

## 1. Mục tiêu

Kế toán trưởng lập báo cáo tài chính đúng mẫu bất kỳ lúc nào, không phải tổng hợp tay từ sổ cái.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_74, CHUC_NANG_75.

Ngoài phạm vi: báo cáo lưu chuyển tiền tệ, thuyết minh báo cáo tài chính; báo cáo hợp nhất tập đoàn; mẫu doanh nghiệp không hoạt động liên tục; nộp báo cáo điện tử cho cơ quan thuế; lãi trên cổ phiếu (nhập tay ngoài hệ thống).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_40 | Lập báo cáo tình hình tài chính, báo cáo kết quả hoạt động kinh doanh theo mẫu của chế độ kế toán từng công ty từ số liệu sổ cái | Kế toán trưởng, Ban giám đốc |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_74 | Báo cáo tình hình tài chính tại một ngày (cột số cuối kỳ, số đầu năm), mẫu theo chế độ (Thông tư 99/2025: B01-DN; Thông tư 133/2016: B01a-DNN hoặc B01b-DNN) | YCAU_NGHIEPVU_40 |
| CHUC_NANG_75 | Báo cáo kết quả hoạt động kinh doanh cho một khoảng ngày (cột kỳ này, cùng kỳ năm trước), mẫu B02-DN hoặc B02-DNN; xem, xuất Excel, PDF cả hai báo cáo; đánh dấu tài khoản chi tiết dài hạn | YCAU_NGHIEPVU_40 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_99 | Mỗi chỉ tiêu có mã số, tên, cách lấy số liệu theo hướng dẫn lập của chế độ: số dư Nợ hoặc Có cuối kỳ của tài khoản (bù trừ trong tài khoản), số dư Nợ hoặc Có theo từng đối tác với tài khoản lưỡng tính (phải thu, phải trả), số ghi âm với dự phòng, hao mòn; phát sinh Nợ hoặc Có trong kỳ có hoặc loại tài khoản đối ứng; tổng, hiệu các chỉ tiêu khác. Tài khoản trong công thức gồm cả tài khoản chi tiết của nó | YCAU_NGHIEPVU_40 |
| QUYTAC_NGHIEPVU_100 | Báo cáo lập được cả khi kỳ chưa khóa sổ: số dư tài khoản doanh thu, chi phí, xác định kết quả chưa kết chuyển được cộng vào lợi nhuận chưa phân phối năm nay; chỉ tiêu kết quả kinh doanh lấy phát sinh của tài khoản doanh thu, chi phí trong kỳ, không tính bút toán kết chuyển. Tổng tài sản bằng tổng nguồn vốn | YCAU_NGHIEPVU_40 |
| QUYTAC_NGHIEPVU_101 | Kế toán đánh dấu tài khoản chi tiết là dài hạn: số dư của tài khoản đó vào chỉ tiêu dài hạn tương ứng (phải thu, trả trước, phải trả, vay, doanh thu chờ phân bổ...), còn lại vào chỉ tiêu ngắn hạn. Chỉ tiêu cần thông tin hệ thống chưa có (tương đương tiền, dự phòng đầu tư nắm giữ đến ngày đáo hạn, chi phí đi vay...) bằng 0 kèm ghi chú | YCAU_NGHIEPVU_40 |
| QUYTAC_NGHIEPVU_102 | Số đầu năm là số dư cuối ngày trước ngày đầu năm tài chính (theo tháng bắt đầu năm tài chính của công ty) chứa ngày báo cáo; cùng kỳ năm trước là khoảng ngày lùi một năm. Tiền làm tròn theo đơn vị tiền tệ công ty | YCAU_NGHIEPVU_40 |

## 5. Vai trò và quyền

Dùng quyền `finance.ledger.view` (xem, xuất báo cáo) và `finance.ledger.setup` (đánh dấu tài khoản dài hạn).

## 6. Luồng nghiệp vụ

- Luồng 26: Kế toán trưởng chọn báo cáo, mẫu, ngày (hoặc khoảng ngày) → hệ thống tính từ sổ cái → xem, xuất Excel hoặc PDF.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_53 | Báo cáo tài chính | Chọn báo cáo (tình hình tài chính, kết quả kinh doanh), mẫu (Thông tư 133: B01a-DNN, B01b-DNN), ngày hoặc khoảng ngày; bảng chỉ tiêu (mã số, tên, ghi chú, hai cột số liệu); nút "Xuất Excel", "Xuất PDF". Màn hình Hệ thống tài khoản thêm ô "Dài hạn" cho tài khoản chi tiết |

## 8. Dữ liệu và API

- Database migration `0012_financial_statements.sql`: cột `accounting.accounts.is_long_term`.
- Mẫu báo cáo khai báo trong mã (`apps/api/src/accounting/statement-templates.ts`).
- API_90 `/finance/statements` (xem, xuất).

## 9. Điều kiện đặc biệt

Không có.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_117 | Báo cáo tình hình tài chính đúng mẫu theo chế độ, số liệu đúng cách lấy; tổng tài sản bằng tổng nguồn vốn khi kỳ chưa khóa và đã khóa sổ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_118 | Báo cáo kết quả kinh doanh đúng mẫu, doanh thu thuần, giá vốn, lợi nhuận đúng; khớp lợi nhuận chưa phân phối tăng trong kỳ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_119 | Tài khoản chi tiết đánh dấu dài hạn vào đúng chỉ tiêu dài hạn; Thông tư 133 chọn được B01a-DNN, B01b-DNN | Bắt buộc |
| TIEUCHI_NGHIEMTHU_120 | Xuất Excel, PDF đúng số liệu; MAN_HINH_53 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_218 trở đi, ghi trong tài liệu `21`; kiểm thử tự động `apps/api/test/c15-statements.test.ts`.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện: Excel dùng `write-excel-file`, PDF dùng `pdfmake` đã có.

## 13. Thành phần không được thay đổi

Bút toán, sổ cái, khóa sổ (CONG_VIEC_14).

## 14. Các lát và điểm xem trước

- L0: mẫu, bộ tính, API xem, MAN_HINH_53, đánh dấu dài hạn. Điểm xem trước: hai báo cáo trên dữ liệu phát triển.
- L1: xuất Excel, PDF.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Nguồn mẫu biểu và điểm chưa xác minh

- Thông tư 99/2025/TT-BTC: Điều 17 (danh mục mẫu) tra được; Phụ lục IV (biểu mẫu, cách lập) lấy từ bản chép kèm Thông tư và tài liệu tập huấn của Bộ Tài chính, một phần từ hướng dẫn thứ cấp; phải đối chiếu bản gốc trước khi phát hành.
- Thông tư 133/2016/TT-BTC: mã số, tên, cách lấy số liệu theo Điều 81.

Giới hạn đã biết (rà soát 2026-11-10):
- Kỳ chưa khóa sổ, số dư chưa kết chuyển của mọi tài khoản loại 5 đến 9 (của mọi năm) cộng vào 4212 như khóa sổ thật; lãi năm trước nằm ở 4212 đến khi kế toán chuyển 4212 sang 4211.
- Chỉ tiêu "phát sinh có đối ứng" tính cả số tiền của dòng khi trong cùng bút toán có một dòng đối ứng khớp; bút toán nhiều Nợ nhiều Có không tách theo cặp đối ứng.
- Màn hình MAN_HINH_53 mặc định "Từ ngày" là 01/01, không theo tháng bắt đầu năm tài chính của công ty.
