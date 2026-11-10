# CONG_VIEC_13: Công nợ phải thu, phải trả (MODULE_06, phần 1)

- Mô tả: Quỹ tiền mặt, tài khoản ngân hàng của công ty; công nợ phải thu, phải trả tự phát sinh từ phiếu kho đã ghi sổ; số dư đầu kỳ; phiếu thu, phiếu chi trừ theo từng chứng từ, tiền thừa giữ làm trả trước, hoàn tiền; phiếu chi qua luồng duyệt; tuổi nợ; dư nợ thật cho kiểm hạn mức công nợ của đơn bán.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ. Bản 0.2 sửa cho khớp mã đã làm (mục 18); ghi tổn thất hàng thiếu nội bộ giảm phải thu theo quyết định của người dùng (mục 17): phiếu chi duyệt xong không ghi sổ được thì về "Bị từ chối" kèm lý do; phiếu không chọn chứng từ thì tự trừ cũ nhất trước khi ghi sổ; phiếu đã cấp số không đổi được giữa phiếu thu và phiếu chi; số dư đầu của quỹ khóa khi có phiếu chờ duyệt; quỹ ngừng dùng không ghi sổ được; tính lại phiếu cũ chỉ trừ khoản giảm vào phiếu gốc; quyền, vai trò, loại chứng từ.
- Nguồn: tài liệu `05` mục 2.1 (Tài chính – Kế toán: thu chi, công nợ); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02` (bắt đầu MODULE_06 bằng công nợ; phát sinh theo phiếu kho đã ghi sổ; trừ theo từng chứng từ; phiếu chi qua luồng duyệt, phiếu thu ghi sổ ngay; quỹ và chỉ tiền tệ công ty; số dư đầu kỳ và tính lại phiếu cũ; cho hoàn tiền); THAY_DOI_09 (dư nợ để kiểm hạn mức công nợ của đơn bán tính theo công nợ thật, thay QUYTAC_NGHIEPVU_69).

## 1. Mục tiêu

Kế toán biết chính xác mỗi khách hàng còn nợ bao nhiêu, theo chứng từ nào, quá hạn bao lâu; công ty còn nợ nhà cung cấp bao nhiêu; thu, chi tiền qua quỹ có số dư; đơn bán kiểm hạn mức công nợ theo nợ thật thay cho dư nợ tạm tính.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_65 đến CHUC_NANG_68; mini app Tài chính – Kế toán `apps/web-finance`, đường dẫn `/finance`.

Ngoài phạm vi (công việc sau):
- Hệ thống tài khoản, bút toán, sổ cái, báo cáo tài chính.
- Hóa đơn điện tử; công nợ theo hóa đơn.
- Ngoại tệ, chênh lệch tỷ giá; đối chiếu sao kê ngân hàng; nhận chuyển khoản tự đối chiếu.
- Thu chi không gắn đối tác (chi phí, thu khác), chuyển tiền giữa các quỹ.
- Thu tiền đơn bán lẻ không có khách hàng (người mua không lấy hóa đơn) – thuộc bán lẻ tại quầy (MODULE_14).
- Bù trừ công nợ phải thu với phải trả của cùng một đối tác.
- Hủy phiếu thu, phiếu chi đã ghi sổ.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_38 | Theo dõi công nợ phải thu, phải trả theo đối tác và theo từng chứng từ (hạn thanh toán, quá hạn); thu, chi tiền qua quỹ có số dư; trả trước, hoàn tiền | Kế toán, Quản lý kinh doanh, Quản lý mua hàng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_65 | Quỹ: danh mục quỹ tiền mặt, tài khoản ngân hàng của công ty; số dư đầu; số dư hiện tại; sổ quỹ (thu, chi theo ngày) | YCAU_NGHIEPVU_38 |
| CHUC_NANG_66 | Sổ công nợ: tự phát sinh từ phiếu kho đã ghi sổ (kể cả phiếu ghi sổ trước khi có module); số dư đầu kỳ theo chứng từ cũ; danh sách đối tác còn nợ theo phải thu, phải trả kèm tuổi nợ; chi tiết theo chứng từ và các lần trừ nợ | YCAU_NGHIEPVU_38 |
| CHUC_NANG_67 | Phiếu thu, phiếu chi: thu tiền khách hàng, trả tiền nhà cung cấp (trừ theo chứng từ chọn; không chọn thì tự trừ cũ nhất trước khi ghi sổ), hoàn tiền cho khách, nhận tiền nhà cung cấp hoàn; phiếu chi qua luồng duyệt | YCAU_NGHIEPVU_38 |
| CHUC_NANG_68 | Dư nợ thật cho kiểm hạn mức công nợ của đơn bán | YCAU_NGHIEPVU_38 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_85 | Quỹ thuộc công ty: mã (duy nhất trong công ty không phân biệt hoa thường, tối đa 20 ký tự), tên, loại (tiền mặt, ngân hàng; ngân hàng bắt buộc tên ngân hàng, số tài khoản; chủ tài khoản không bắt buộc), số dư đầu (không âm), trạng thái (đang dùng, ngừng dùng). Số dư đầu chỉ sửa được khi quỹ chưa có phiếu chờ duyệt hoặc đã ghi sổ. Số dư hiện tại = số dư đầu + tổng phiếu thu đã ghi sổ − tổng phiếu chi đã ghi sổ của quỹ. Quỹ ngừng dùng không chọn được cho phiếu mới; phiếu dùng quỹ đã ngừng dùng không ghi sổ được. Tiền tệ là tiền tệ công ty | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_86 | Công nợ phát sinh khi phiếu kho ghi sổ, theo đối tác của công ty: phiếu xuất giao hàng tăng phải thu của khách hàng trên đơn bán (giá trị gồm thuế theo đơn của phần đã giao); phiếu nhận hàng trả lại giảm phải thu (giá trị gồm thuế theo đơn của phần trả); phiếu nhập mua tăng phải trả nhà cung cấp khi ghi sổ (sau kiểm tra chất lượng nếu có; giá trị gồm thuế theo đơn mua của phần đạt kiểm tra chất lượng); phiếu trả hàng nhà cung cấp giảm phải trả (giá trị gồm thuế theo đơn mua của phần trả). Phiếu kho của giao dịch nội bộ phát sinh như phiếu thường. Biên bản chênh lệch giao nhận nội bộ được bên bán ghi tổn thất (QUYTAC_NGHIEPVU_77) thì giảm phải thu của công ty mua đúng giá trị gồm thuế theo đơn bán của phần thiếu (khoản giảm nguồn `internal_write_off`, số chứng từ là số phiếu xuất gốc, ngày ghi tổn thất), trừ trước vào khoản tăng của phiếu xuất gốc, chạy cùng giao dịch đóng biên bản; "Nhập lại kho" giảm phải thu qua phiếu nhận hàng trả lại. Hạn thanh toán của khoản tăng nợ = ngày chứng từ + số ngày được nợ trong hồ sơ đối tác của công ty lúc ghi sổ (không có hồ sơ: 0 ngày). Đơn bán không có khách hàng không phát sinh công nợ; giá trị 0 không phát sinh. Phiếu ghi sổ trước khi nâng cấp được tính lại một lần khi chạy database migration: khoản giảm chỉ trừ vào khoản tăng của phiếu gốc, phần còn lại giữ làm trả trước. Tiền làm tròn 4 chữ số lẻ | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_87 | Mỗi khoản công nợ là tăng nợ hoặc giảm nợ, có số tiền và số còn lại. Trừ nợ ghép một khoản giảm với một khoản tăng cùng đối tác, cùng công ty, cùng phía (phải thu hoặc phải trả), không vượt số còn lại của cả hai. Khoản giảm do trả hàng trừ trước vào khoản tăng của phiếu gốc, phần còn lại trừ các khoản tăng cũ nhất (theo hạn thanh toán, rồi ngày chứng từ). Khoản tăng mới tự trừ vào các khoản giảm còn lại cũ nhất theo ngày chứng từ (trả trước). Số dư công nợ của đối tác = tổng số còn lại của khoản tăng − tổng số còn lại của khoản giảm; tổng số còn lại của các khoản giảm là tiền trả trước | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_88 | Phiếu thu, phiếu chi thuộc công ty: loại (thu tiền khách hàng, trả tiền nhà cung cấp, hoàn tiền cho khách hàng, nhận tiền nhà cung cấp hoàn), đối tác (khách hàng hoặc nhà cung cấp theo hồ sơ đối tác của công ty, theo loại), quỹ đang dùng, ngày, số tiền (lớn hơn 0), nội dung. Thu tiền khách hàng, trả tiền nhà cung cấp là khoản giảm nợ: người lập chọn các chứng từ còn nợ và số trừ (giao diện chia sẵn cũ nhất trước đến hết số tiền); tổng trừ không vượt số tiền phiếu; mỗi dòng không vượt số còn lại; chứng từ không trùng. Khi ghi sổ: có chọn chứng từ thì trừ đúng các chứng từ đó, phần thừa là trả trước; không chọn chứng từ thì tự trừ các khoản tăng cũ nhất trước, phần thừa là trả trước. Hoàn tiền là khoản tăng nợ (hạn thanh toán bằng ngày phiếu), không vượt tiền trả trước đang còn của đối tác ở phía đó, tự trừ vào khoản trả trước cũ nhất. Phiếu chi không vượt số dư hiện tại của quỹ khi ghi sổ. Lúc ghi sổ kiểm lại quỹ đang dùng, số còn lại, trả trước, số dư quỹ (khóa công nợ của đối tác ở phía đó rồi khóa quỹ) | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_89 | Phiếu thu (thu tiền khách hàng, nhận tiền nhà cung cấp hoàn; loại chứng từ `finance.receipt`, không duyệt) ghi sổ ngay khi gửi; không ghi sổ được thì báo lỗi, phiếu giữ trạng thái trước khi gửi. Phiếu chi (trả tiền nhà cung cấp, hoàn tiền cho khách hàng) đi luồng duyệt (loại chứng từ `finance.payment`, giá trị duyệt là số tiền; chưa có chính sách duyệt thì ghi sổ ngay như phiếu thu); duyệt xong thì ghi sổ; không ghi sổ được (số dư quỹ, số còn nợ, trả trước đã đổi, quỹ đã ngừng dùng) thì phiếu về "Bị từ chối" kèm lý do để người lập sửa, gửi lại. Gửi lần đầu cấp số (`PT`… phiếu thu, `PC`… phiếu chi); số đã cấp giữ khi gửi lại; phiếu đã cấp số không đổi được giữa phiếu thu và phiếu chi. Sửa khi nháp, bị từ chối, đã rút; sửa xong phiếu về nháp. Người lập rút được khi chờ duyệt và cấp duyệt đầu chưa quyết định. Phiếu đã ghi sổ không sửa, không hủy | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_90 | Số dư đầu kỳ: người có quyền quản lý công nợ nhập theo từng chứng từ cũ (đối tác là khách hàng hoặc nhà cung cấp của công ty theo phía, phía phải thu hoặc phải trả, còn nợ hoặc trả trước, số chứng từ cũ tối đa 50 ký tự, ngày, hạn thanh toán bắt buộc với khoản còn nợ và không trước ngày chứng từ, số tiền lớn hơn 0, ghi chú). Khoản còn nợ mới tự trừ trả trước cũ nhất; khoản trả trước mới tự trừ các khoản còn nợ cũ nhất (QUYTAC_NGHIEPVU_87). Xóa được khi chưa trừ nợ và chưa được chọn trên phiếu thu chi nào | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_91 | Tuổi nợ tính trên số còn lại của các khoản tăng nợ theo hạn thanh toán so với ngày hiện tại (giờ Việt Nam): chưa đến hạn (hạn từ hôm nay trở đi), quá hạn 1 đến 30 ngày, 31 đến 60 ngày, 61 đến 90 ngày, trên 90 ngày | YCAU_NGHIEPVU_38 |
| QUYTAC_NGHIEPVU_92 | Dư nợ để kiểm hạn mức công nợ của đơn bán (thay QUYTAC_NGHIEPVU_69, THAY_DOI_09): số dư công nợ phải thu của khách (QUYTAC_NGHIEPVU_87, trả trước làm giảm) cộng giá trị gồm thuế phần chưa giao của các đơn khác của khách đã xác nhận. Dư nợ cộng tổng gồm thuế của đơn đang gửi vượt hạn mức thì là ngoại lệ (như QUYTAC_NGHIEPVU_68) | YCAU_NGHIEPVU_38 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa |
|---|---|
| `finance.access` | Vào mini app Tài chính – Kế toán (đã có) |
| `finance.debt.view` | Xem quỹ, sổ quỹ, công nợ, phiếu thu chi |
| `finance.fund.manage` | Thêm, sửa, ngừng dùng quỹ |
| `finance.debt.manage` | Nhập, xóa số dư đầu kỳ công nợ |
| `finance.payment.manage` | Lập, sửa, gửi, rút phiếu thu, phiếu chi |

- Bốn quyền mới không nhạy cảm, phải gán ở phạm vi tập đoàn hoặc công ty (gán ở chi nhánh không dùng được).
- Vai trò mới `accountant` (Kế toán), phạm vi công ty: `finance.access`, cả bốn quyền trên, `crm.access`, `crm.partner.view`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới.
- Loại chứng từ mới: `finance.receipt` (Phiếu thu, không duyệt), `finance.payment` (Phiếu chi, cần duyệt).

## 6. Luồng nghiệp vụ

- Luồng 18 – Công nợ tự phát sinh: Thủ kho ghi sổ phiếu xuất giao hàng, nhận hàng trả lại, nhập mua (hoặc kiểm tra chất lượng xong), trả hàng nhà cung cấp → hệ thống tạo khoản công nợ trong cùng giao dịch ghi sổ → tự trừ nợ theo QUYTAC_NGHIEPVU_87.
- Luồng 19 – Thu tiền khách hàng: Kế toán lập phiếu thu, chọn khách → hệ thống hiện chứng từ còn nợ, trả trước đang còn → kế toán nhập số trừ hoặc bấm "Chia lại từ cũ nhất", hoặc để trống (tự trừ cũ nhất trước khi ghi sổ) → lưu, gửi → ghi sổ, số dư quỹ tăng, công nợ giảm, phần thừa là trả trước.
- Luồng 20 – Trả tiền nhà cung cấp: Kế toán lập phiếu chi, chọn nhà cung cấp, chọn chứng từ → gửi → luồng duyệt → duyệt xong ghi sổ (kiểm số dư quỹ) → không ghi sổ được hoặc bị từ chối thì sửa, gửi lại.
- Luồng 21 – Hoàn tiền: Kế toán lập phiếu hoàn tiền cho khách (phiếu chi, qua duyệt) hoặc nhận tiền nhà cung cấp hoàn (phiếu thu), không vượt trả trước đang còn.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_46 | Quỹ | Danh sách quỹ (mã, tên, loại, số dư hiện tại, trạng thái), thêm; chi tiết quỹ: thông tin, sửa, ngừng dùng, sổ quỹ theo khoảng ngày (ngày, số phiếu, đối tác, thu, chi, số dư lũy kế; số dư đầu kỳ, cuối kỳ) |
| MAN_HINH_47 | Công nợ | Hai thẻ Phải thu, Phải trả; danh sách đối tác còn số dư hoặc trả trước (đối tác, số dư, trả trước, chưa đến hạn, quá hạn theo nhóm tuổi nợ) kèm dòng tổng cộng; tìm theo tên, mã; chỉ đối tác quá hạn |
| MAN_HINH_48 | Chi tiết công nợ đối tác | Tổng (số dư, trả trước, tuổi nợ); danh sách khoản công nợ (số chứng từ, loại, ngày, hạn, số tiền, còn lại, quá hạn bao nhiêu ngày) kèm các lần trừ nợ; nhập, xóa số dư đầu kỳ; nút "Lập phiếu thu" hoặc "Lập phiếu chi" mở sẵn đối tác |
| MAN_HINH_49 | Phiếu thu, phiếu chi | Danh sách (số, loại, ngày, đối tác, quỹ, số tiền, trạng thái), lọc loại, trạng thái; biểu mẫu: loại, quỹ (kèm số dư), ngày, số tiền, đối tác, trả trước đang còn, bảng chứng từ còn nợ có ô số trừ, nút "Chia lại từ cũ nhất", dòng tổng trừ và "Trả trước: …" hoặc "Không chọn chứng từ: tự trừ cũ nhất trước khi ghi sổ"; chi tiết: thông tin, lý do không ghi sổ được, chứng từ sẽ trừ hoặc đã trừ, sửa, gửi, rút, lịch sử |

Mini app Tài chính – Kế toán: menu Công nợ, Phiếu thu chi, Quỹ.

## 8. Dữ liệu và API

- Database migration `0010_finance.sql`, schema `finance`: `funds`, `debt_items`, `debt_allocations`, `payments` (có cột `post_error`), `payment_lines`; hàm `finance.inventory_debt_amount`; tính lại công nợ của phiếu kho đã ghi sổ.
- API_84 `/finance/funds` (danh sách, chi tiết, thêm, sửa, sổ quỹ); API_85 `/finance/debts`, `/finance/partners` (tổng theo đối tác, chi tiết đối tác, chứng từ còn nợ, chọn đối tác, nhập và xóa số dư đầu kỳ); API_86 `/finance/payments` (tùy chọn, danh sách, chi tiết, lập, sửa, gửi, rút).
- Sửa API_77: kiểm hạn mức công nợ theo QUYTAC_NGHIEPVU_92.

## 9. Điều kiện đặc biệt

- Ghi sổ phiếu kho và tạo công nợ cùng một giao dịch: tạo công nợ lỗi thì phiếu không ghi sổ.
- Mọi thay đổi công nợ của một đối tác ở một phía chạy tuần tự (khóa theo công ty, phía, đối tác đến hết giao dịch). Ghi sổ phiếu thu chi khóa công nợ của đối tác trước, rồi khóa quỹ, để tránh khóa chéo; số dư quỹ tính bằng câu lệnh riêng sau khi khóa quỹ, để hai phiếu chi ghi sổ đồng thời không làm quỹ âm.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_105 | Quỹ: thêm, sửa, ngừng dùng; số dư đầu chỉ sửa khi chưa có phiếu; số dư hiện tại, sổ quỹ đúng sau thu, chi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_106 | Ghi sổ phiếu xuất giao hàng, nhận hàng trả lại, nhập mua (phần đạt kiểm tra chất lượng), trả hàng nhà cung cấp tạo đúng khoản công nợ (giá trị gồm thuế, hạn thanh toán); trả hàng trừ vào phiếu gốc; đơn không có khách không sinh công nợ; phiếu cũ được tính lại | Bắt buộc |
| TIEUCHI_NGHIEMTHU_107 | Phiếu thu trừ nợ theo chứng từ chọn; không chọn thì trừ cũ nhất trước; phần thừa thành trả trước và tự trừ vào khoản nợ sau; vượt số còn lại, vượt số tiền phiếu bị từ chối | Bắt buộc |
| TIEUCHI_NGHIEMTHU_108 | Phiếu chi qua luồng duyệt, duyệt xong mới ghi sổ; vượt số dư quỹ thì không ghi sổ, phiếu về bị từ chối kèm lý do; hoàn tiền không vượt trả trước; nhân viên không có quyền không lập được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_109 | Số dư đầu kỳ; danh sách công nợ, tuổi nợ, quá hạn đúng; đơn bán kiểm hạn mức theo dư nợ thật | Bắt buộc |
| TIEUCHI_NGHIEMTHU_110 | Màn hình MAN_HINH_46 đến MAN_HINH_49 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_201 đến KICHBAN_KIEMTHU_206 tự động (`apps/api/test/c13-debts.test.ts`), KICHBAN_KIEMTHU_209 tự động (`apps/api/test/c9-internal-trade.test.ts`); KICHBAN_KIEMTHU_207 (trình duyệt máy tính), KICHBAN_KIEMTHU_208 (điện thoại) thủ công; ghi trong tài liệu `21`.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện. Mini app mới theo mẫu `apps/web-sales` (Next.js, cổng 3006, mini app Nền tảng chuyển tiếp `/finance` theo biến `FINANCE_ORIGIN`).
- Module Kho gọi công nợ qua móc nối `postedHooks` của `StockDocumentsService` và `writtenOffHooks` của `InternalReceiptsService` đăng ký lúc khởi động, không phụ thuộc vòng; đơn bán đọc dư nợ qua `apps/api/src/finance/receivable-balance.ts`.

## 13. Thành phần không được thay đổi

Cách ghi sổ kho, giá vốn; luồng duyệt chung; dữ liệu đơn bán, đơn mua.

## 14. Các lát và điểm xem trước

- L0: database migration, quyền, vai trò; quỹ; công nợ tự phát sinh, tính lại phiếu cũ; số dư đầu kỳ; mini app, MAN_HINH_46 đến MAN_HINH_48. Điểm xem trước: danh sách công nợ sau khi giao hàng.
- L1: phiếu thu, phiếu chi, trừ nợ, hoàn tiền, luồng duyệt; dư nợ thật cho đơn bán; MAN_HINH_49. Điểm xem trước: thu tiền, trả tiền, tuổi nợ.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng)

- Đơn bán không có khách hàng không phát sinh công nợ (không có đối tác để theo dõi).
- Phiếu chi không vượt số dư quỹ.
- Phiếu đã ghi sổ không sửa, không hủy; sai thì lập phiếu hoàn tiền hoặc phiếu ngược loại.
- Phiếu thu chi luôn gắn đối tác; thu chi khác, chuyển quỹ để công việc sau.
- Phiếu chi duyệt xong mà không ghi sổ được thì về "Bị từ chối" kèm lý do, không giữ "Chờ duyệt" (yêu cầu duyệt đã kết thúc, người lập không rút được nữa).
- Phiếu thu chi không chọn chứng từ thì tự trừ cũ nhất trước khi ghi sổ; có chọn thì chỉ trừ chứng từ đã chọn, phần thừa là trả trước.
- Phiếu đã cấp số không đổi giữa phiếu thu và phiếu chi (hai dãy số khác nhau).
- Số dư đầu của quỹ khóa khi quỹ có phiếu chờ duyệt hoặc đã ghi sổ.
- Hoàn tiền có hạn thanh toán bằng ngày phiếu.
- Tính lại phiếu cũ chỉ trừ khoản giảm vào khoản tăng của phiếu gốc; phần còn lại giữ làm trả trước, khoản tăng mới sau đó tự trừ vào.

## 17. Quyết định của người dùng (2026-11-10)

- Giao nội bộ thiếu, bên bán "Ghi tổn thất" biên bản chênh lệch thì giảm phải thu của công ty mua đúng giá trị phần thiếu theo giá đơn bán, để công nợ hai công ty khớp nhau (QUYTAC_NGHIEPVU_86; kiểm thử KICHBAN_KIEMTHU_209).

## 18. Chỗ sửa cho khớp mã (bản 0.2)

| Vị trí | Bản 0.1 | Mã đã làm (bản 0.2) |
|---|---|---|
| QUYTAC_NGHIEPVU_85 | Số dư đầu chỉ sửa khi quỹ chưa có phiếu ghi sổ | Khóa khi quỹ có phiếu chờ duyệt hoặc đã ghi sổ; mã quỹ không phân biệt hoa thường; quỹ ngừng dùng không ghi sổ được |
| QUYTAC_NGHIEPVU_86 | Không nêu biên bản chênh lệch nội bộ | Ghi tổn thất biên bản giảm phải thu bên bán (quyết định của người dùng, mục 17) |
| QUYTAC_NGHIEPVU_86 | Tính lại phiếu cũ theo QUYTAC_NGHIEPVU_87 | Khoản giảm của phiếu cũ chỉ trừ vào phiếu gốc, phần còn lại là trả trước |
| QUYTAC_NGHIEPVU_88 | Không đủ thì từ chối ghi sổ, phiếu chờ duyệt giữ nguyên để người lập rút, sửa | Phiếu thu: báo lỗi, phiếu giữ trạng thái trước khi gửi. Phiếu chi duyệt xong không ghi sổ được: về "Bị từ chối", lý do lưu ở cột `post_error` (khóa thông báo lỗi, giao diện dịch ra câu), người lập sửa, gửi lại |
| QUYTAC_NGHIEPVU_88 | Mặc định cũ nhất trước | Giao diện chia sẵn khi bấm "Chia lại từ cũ nhất"; không chọn chứng từ thì máy chủ tự trừ cũ nhất trước lúc ghi sổ |
| QUYTAC_NGHIEPVU_89 | Không nêu | Phiếu đã cấp số không đổi được giữa phiếu thu và phiếu chi; rút khi cấp duyệt đầu chưa quyết định |
| Mục 5 | Không nêu phạm vi gán, loại chứng từ phiếu thu | Quyền gán ở tập đoàn hoặc công ty; thêm loại chứng từ `finance.receipt` (Phiếu thu, không duyệt) |
| QUYTAC_NGHIEPVU_90 | Xóa được khi chưa trừ nợ | Thêm: chưa được chọn trên phiếu thu chi nào |
| Mục 9 | Khóa công nợ rồi khóa quỹ | Thêm: số dư quỹ tính sau khi khóa quỹ (sửa lỗi rà soát, commit 173a73b) |
| Mục 8 | API_85 không có chọn đối tác | Thêm `GET /finance/partners`; chi tiết công nợ chỉ cho đối tác có hồ sơ hoặc có công nợ với công ty đang chọn |
