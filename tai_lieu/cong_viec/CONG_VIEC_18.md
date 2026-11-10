# CONG_VIEC_18: Đối soát ngân hàng (MODULE_06, phần 6)

- Mô tả: Nhận giao dịch ngân hàng qua dịch vụ trung gian chọn theo từng công ty (webhook), tự ghép với phiếu thu chi đã ghi sổ của quỹ ngân hàng; tiền vào chưa có phiếu thu thì gợi ý khách hàng, kế toán xác nhận tạo phiếu thu; đối chiếu số dư sổ sách với ngân hàng.
- Phiên bản: 0.3
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng xác nhận thiết kế ngày 2026-11-10; đã lập trình lát L0, L1; bản 0.3 sửa đặc tả khớp mã sau rà soát (commit b3ffdd5).
- Nguồn: tài liệu `04` mục 6, `05` mục 2.1; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Kế toán không nhập tay sao kê; biết ngay khoản tiền nào đã có chứng từ, khoản nào chưa; số dư quỹ ngân hàng trên sổ khớp ngân hàng.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_84 đến CHUC_NANG_87.

Ngoài phạm vi:
- Thu hộ COD, cổng thanh toán (CONG_VIEC_19).
- Lấy sao kê trực tiếp từ ngân hàng (Open Banking), nhập tệp sao kê.
- Tự tạo phiếu chi, phiếu chi phí cho tiền ra (phí ngân hàng, chuyển khoản nội bộ): kế toán lập phiếu theo chức năng đã có rồi ghép.
- Tạo mã QR thanh toán cho đơn bán.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_43 | Nhận giao dịch ngân hàng tự động, ghép với chứng từ thu chi, đối chiếu số dư | Kế toán, Kế toán trưởng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_84 | Kết nối ngân hàng cho quỹ ngân hàng: chọn dịch vụ trung gian (bộ giả lập, SePay), khóa xác thực, địa chỉ webhook, bật tắt, gửi giao dịch thử | YCAU_NGHIEPVU_43 |
| CHUC_NANG_85 | Nhận giao dịch qua webhook, chống trùng; tự ghép với phiếu thu chi đã ghi sổ | YCAU_NGHIEPVU_43 |
| CHUC_NANG_86 | Xử lý giao dịch chưa ghép: gợi ý khách hàng cho tiền vào, xác nhận tạo phiếu thu; ghép tay; bỏ qua có lý do; bỏ ghép, thôi bỏ qua (cùng một thao tác) | YCAU_NGHIEPVU_43 |
| CHUC_NANG_87 | Đối chiếu quỹ ngân hàng theo khoảng ngày: số dư ngân hàng, số dư sổ, chênh lệch, danh sách chưa ghép hai phía | YCAU_NGHIEPVU_43 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_113: Mỗi quỹ ngân hàng có tối đa một kết nối; quỹ ngừng dùng không tạo được kết nối mới. Hệ thống sinh khóa xác thực, chỉ hiện đủ một lần khi tạo hoặc đổi khóa; sau đó chỉ hiện bốn ký tự cuối; khóa lưu mã hóa; đổi khóa thì khóa cũ hết hiệu lực. Webhook gửi khóa trong tiêu đề `Authorization: Apikey <khóa>`; sai khóa, kết nối không có hoặc đang tắt trả lỗi 401, không lưu dữ liệu.
- QUYTAC_NGHIEPVU_114: Giao dịch trùng mã giao dịch của dịch vụ trên cùng kết nối chỉ lưu một lần và vẫn trả thành công. Số tiền tối đa 16 chữ số phần nguyên, 4 chữ số lẻ, ngoài giới hạn trả 400; ký tự rỗng trong chữ bị bỏ. Số tài khoản chỉ so khi webhook và quỹ đều có. Nội dung giao dịch đã lưu không sửa, không xóa; lưu kèm dữ liệu webhook gốc.
- QUYTAC_NGHIEPVU_115: Tự ghép khi có đúng một phiếu thu chi đã ghi sổ, cùng quỹ, cùng chiều (tiền vào: thu khách, nhà cung cấp hoàn tiền; tiền ra: chi nhà cung cấp, hoàn tiền khách), cùng số tiền, ngày phiếu cách ngày giao dịch không quá 3 ngày, chưa ghép giao dịch khác; đồng thời phiếu đó chỉ hợp với đúng giao dịch này trong các giao dịch chưa ghép (duy nhất ở cả hai phía). Nhiều phiếu hoặc nhiều giao dịch thỏa thì không tự ghép, kế toán ghép tay. Phiếu ghi sổ sau giao dịch cũng được thử ghép lại.
- QUYTAC_NGHIEPVU_116: Gợi ý khách cho tiền vào chưa ghép, chỉ trong đối tác là khách hàng của công ty, theo thứ tự: số đơn bán trong nội dung chuyển khoản (nội dung có từ 6 chữ, số trở lên; đơn đã có số, không bị hủy); mã khách hàng đứng riêng trong nội dung; mã số thuế. Mỗi bậc chỉ gợi ý khi ra đúng một khách. Kế toán xác nhận (sửa được khách, số tiền không sửa; cần thêm quyền `finance.payment.manage`) thì hệ thống lập phiếu thu khách hàng của quỹ, ngày giao dịch, ghi chú nội dung chuyển khoản, theo luồng duyệt phiếu thu đã có; phiếu ghi sổ thì giao dịch chuyển sang đã ghép, nhưng chỉ khi phiếu còn khớp quỹ, số tiền, loại phiếu thu khách hàng và ngày lệch tối đa 3 ngày; phiếu bị sửa không còn khớp thì bỏ liên kết, giao dịch xét tự ghép như thường. Phiếu thu đang chờ duyệt thì không lập lại. Còn phiếu nháp của lần xác nhận trước (gửi lỗi) thì xác nhận lại đặt phiếu nháp theo khách vừa chọn rồi gửi lại. Hai lần xác nhận cùng lúc chỉ một lần gắn được phiếu; lần còn lại trả 409, phiếu nháp vừa lập bị xóa.
- QUYTAC_NGHIEPVU_117: Ghép tay với phiếu đã ghi sổ, cùng quỹ, cùng chiều, cùng số tiền, chưa ghép, không giới hạn lệch ngày; danh sách chọn tối đa 20 phiếu, ngày gần ngày giao dịch trước. Bỏ qua cần lý do; không bỏ qua được khi phiếu thu lập từ gợi ý đang chờ duyệt. Bỏ ghép và thôi bỏ qua (cùng một thao tác) đưa giao dịch về chưa ghép, không đổi phiếu. Một phiếu ghép tối đa một giao dịch.

## 5. Vai trò và quyền

| Vai trò | Quyền |
|---|---|
| Kế toán | Xem giao dịch, đối chiếu; ghép, bỏ ghép, bỏ qua, xác nhận tạo phiếu thu |
| Kế toán trưởng | Như kế toán; cài đặt kết nối ngân hàng |
| Quản trị công ty, quản trị tập đoàn | Như kế toán trưởng (có sẵn cả ba quyền mới) |

Quyền mới: `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup` (nhạy cảm). Xác nhận lập phiếu thu từ gợi ý cần thêm `finance.payment.manage`.

## 6. Luồng nghiệp vụ

Luồng 30 (tài liệu `09`): dịch vụ gửi webhook → kiểm khóa → lưu giao dịch (chống trùng) → tự ghép → còn chưa ghép thì kế toán xử lý (xác nhận phiếu thu gợi ý, ghép tay, bỏ qua) → đối chiếu số dư cuối kỳ.

## 7. Màn hình

- MAN_HINH_58 Giao dịch ngân hàng: lọc quỹ, khoảng ngày, trạng thái (chưa ghép, đã ghép, bỏ qua; mặc định chưa ghép), chiều, tìm nội dung; mỗi dòng có nút xử lý; ô đối chiếu số dư phía trên, chỉ hiện khi chọn một quỹ ("Đến ngày" trống là hôm nay, "Từ ngày" trống là đầu tháng của ngày cuối; danh sách phiếu chưa có giao dịch tối đa 100 phiếu).
- MAN_HINH_59 Kết nối ngân hàng: danh sách quỹ ngân hàng (đang dùng, hoặc ngừng dùng đã có kết nối), trạng thái kết nối, địa chỉ webhook, khóa, gửi giao dịch thử (bộ giả lập); người chỉ có quyền xem mở đường dẫn thì chỉ xem.

## 8. Dữ liệu và API

- `finance.bank_connections` (quỹ, dịch vụ, khóa mã hóa, bật tắt, lần nhận cuối).
- `finance.bank_transactions` (kết nối, quỹ, mã giao dịch dịch vụ, ngày giờ, chiều, số tiền, nội dung, mã tham chiếu, số dư sau giao dịch nếu có, trạng thái, phiếu ghép, khách gợi ý, lý do bỏ qua, dữ liệu gốc).
- API_95 đến API_101 (tài liệu `17` mục 2m, 3m): API_95 xem kết nối; API_96 lưu kết nối; API_97 gửi giao dịch thử; API_98 webhook công khai `POST /api/v1/public/bank-webhooks/:connectionId`; API_99 danh sách giao dịch; API_100 xử lý giao dịch (danh sách phiếu ghép tay, xác nhận phiếu thu, ghép, bỏ qua, bỏ ghép hoặc thôi bỏ qua); API_101 đối chiếu.

## 9. Điều kiện đặc biệt

- Định dạng SePay theo tài liệu công khai (https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook): trường `id`, `transactionDate`, `transferType` (in, out), `transferAmount`, `accumulated`, `content`, `referenceCode`, `accountNumber`; trả 200 `{"success": true}`. Cách gửi khóa xác thực phải kiểm lại với tài khoản thật trước phát hành.
- Số tài khoản trong webhook khác số tài khoản của quỹ thì từ chối (409); chỉ so khi webhook và quỹ đều có số tài khoản.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_132 | Chỉ người có quyền cài đặt tạo, sửa kết nối; khóa sinh tự động, hiện đủ một lần, lưu mã hóa; đổi khóa thì khóa cũ hết hiệu lực; webhook sai khóa, kết nối không có hoặc đang tắt bị từ chối (401) | Bắt buộc | KICHBAN_KIEMTHU_246, 247 |
| TIEUCHI_NGHIEMTHU_133 | Giao dịch nhận đúng ngày giờ Việt Nam, chiều, số tiền, nội dung; trùng mã chỉ lưu một lần và vẫn trả thành công; dữ liệu sai bị từ chối (400); số tài khoản khác quỹ bị từ chối (409) | Bắt buộc | KICHBAN_KIEMTHU_247, 259 |
| TIEUCHI_NGHIEMTHU_134 | Tự ghép đúng QUYTAC_NGHIEPVU_115: cùng quỹ, cùng chiều, cùng số tiền, lệch tối đa 3 ngày, duy nhất ở cả hai phía; phiếu ghi sổ sau giao dịch cũng được ghép; bộ giả lập đi đúng luồng này | Bắt buộc | KICHBAN_KIEMTHU_248 đến 251 |
| TIEUCHI_NGHIEMTHU_135 | Gợi ý khách đúng thứ tự số đơn bán, mã khách, mã số thuế; nhiều khách hoặc tiền ra thì không gợi ý; kế toán xác nhận thì lập phiếu thu khách hàng của quỹ, ngày giao dịch, ghi chú nội dung, theo luồng duyệt phiếu thu, ghép khi phiếu ghi sổ | Bắt buộc | KICHBAN_KIEMTHU_252, 253, 257, 258 |
| TIEUCHI_NGHIEMTHU_136 | Ghép tay chỉ với phiếu đủ điều kiện; một phiếu ghép tối đa một giao dịch; bỏ qua cần lý do; bỏ ghép đưa về chưa ghép, không đổi phiếu; mỗi thao tác có nhật ký; người không có quyền bị từ chối | Bắt buộc | KICHBAN_KIEMTHU_254 |
| TIEUCHI_NGHIEMTHU_137 | Đối chiếu quỹ theo khoảng ngày: số dư sổ đến ngày cuối, số dư ngân hàng gần nhất (khi dịch vụ gửi), chênh lệch, số giao dịch chưa ghép hai chiều, số bỏ qua, danh sách phiếu chưa có giao dịch | Bắt buộc | KICHBAN_KIEMTHU_255 |
| TIEUCHI_NGHIEMTHU_138 | MAN_HINH_58, 59 hiển thị đúng trên máy tính và điện thoại, không cuộn ngang trang, không lỗi trình duyệt | Mong muốn | KICHBAN_KIEMTHU_256 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_246 đến 255: tự động, tệp `apps/api/test/c18-bank-reconciliation.test.ts`.
- KICHBAN_KIEMTHU_257 đến 259 (sửa sau rà soát độc lập): tự động, cùng tệp: phiếu nháp cũ gửi lại theo khách vừa chọn (257); phiếu nháp bị sửa số tiền không ghép, bỏ liên kết (258); số tiền ngoài giới hạn trả 400, bỏ ký tự rỗng, gửi thử số tiền 0 bị từ chối (259).
- KICHBAN_KIEMTHU_256: thủ công trên trình duyệt (tệp `tam_thoi/CONG_VIEC_18/xem_l0.js`, `xem_l1.js`): kết nối bộ giả lập, gửi thử, tự ghép, lập phiếu thu từ gợi ý, ghép tay, bỏ qua, ô đối chiếu; khổ 1360 và 375 điểm ảnh. Đạt ngày 2026-11-10.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Khóa mã hóa bằng `common/secret-box`. Ghép lại khi phiếu ghi sổ qua `PaymentsService.postedHooks`. Webhook công khai không cần phiên; kích thước nội dung giới hạn theo mặc định 100 KB của bộ đọc JSON và độ dài từng trường (nội dung 1.000, mô tả 2.000, mã tham chiếu 100, số tài khoản 50 ký tự).

## 13. Thành phần không được thay đổi

Ghi sổ phiếu thu chi, công nợ, bút toán, luồng duyệt (chỉ dùng lại để lập phiếu thu).

## 14. Các lát và điểm xem trước

- L0: kết nối, webhook, bộ giả lập, lưu giao dịch, tự ghép, danh sách giao dịch. Điểm xem trước: gửi giao dịch thử thấy giao dịch tự ghép với phiếu thu.
- L1: gợi ý khách, xác nhận phiếu thu, ghép tay, bỏ qua, bỏ ghép, đối chiếu số dư.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Giới hạn đã biết

- Điểm nhận webhook dùng chung giới hạn 20 yêu cầu mỗi phút cho mỗi địa chỉ IP của các API không cần đăng nhập; công ty nhiều giao dịch có thể bị dịch vụ gửi lại chậm (dịch vụ tự gửi lại khi nhận lỗi 429).
- Cách SePay gửi khóa (tiêu đề `Authorization: Apikey <khóa>`) và định dạng ngày giờ theo tài liệu công khai; phải thử với tài khoản SePay thật trước phát hành.
- Gợi ý khách chỉ tính một lần khi nhận giao dịch; khách, đơn bán tạo sau không làm đổi gợi ý (kế toán vẫn chọn được khách khác khi xác nhận).
- Số dư ngân hàng chỉ có khi dịch vụ gửi số dư sau giao dịch; bộ giả lập không gửi.
- Lập phiếu thu từ gợi ý khi công ty có chính sách duyệt phiếu thu: kiểm thử tự động chưa có kịch bản phiếu chờ duyệt (đã có trong mã: giao dịch giữ phiếu chờ duyệt, ghép khi phiếu ghi sổ).
