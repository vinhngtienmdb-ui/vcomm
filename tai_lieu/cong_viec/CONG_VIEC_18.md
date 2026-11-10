# CONG_VIEC_18: Đối soát ngân hàng (MODULE_06, phần 6)

- Mô tả: Nhận giao dịch ngân hàng qua dịch vụ trung gian chọn theo từng công ty (webhook), tự ghép với phiếu thu chi đã ghi sổ của quỹ ngân hàng; tiền vào chưa có phiếu thu thì gợi ý khách hàng, kế toán xác nhận tạo phiếu thu; đối chiếu số dư sổ sách với ngân hàng.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng xác nhận thiết kế ngày 2026-11-10; đã lập trình lát L0, L1.
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
| CHUC_NANG_86 | Xử lý giao dịch chưa ghép: gợi ý khách hàng cho tiền vào, xác nhận tạo phiếu thu; ghép tay; bỏ qua có lý do; bỏ ghép | YCAU_NGHIEPVU_43 |
| CHUC_NANG_87 | Đối chiếu quỹ ngân hàng theo khoảng ngày: số dư ngân hàng, số dư sổ, chênh lệch, danh sách chưa ghép hai phía | YCAU_NGHIEPVU_43 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_113: Mỗi quỹ ngân hàng có tối đa một kết nối. Hệ thống sinh khóa xác thực, chỉ hiện đủ một lần khi tạo hoặc đổi khóa; sau đó chỉ hiện bốn ký tự cuối; khóa lưu mã hóa. Webhook sai khóa, kết nối không có hoặc đang tắt trả lỗi 401, không lưu dữ liệu.
- QUYTAC_NGHIEPVU_114: Giao dịch trùng mã giao dịch của dịch vụ trên cùng kết nối chỉ lưu một lần và vẫn trả thành công. Giao dịch đã lưu không sửa, không xóa.
- QUYTAC_NGHIEPVU_115: Tự ghép khi có đúng một phiếu thu chi đã ghi sổ, cùng quỹ, cùng chiều (tiền vào: thu khách, nhà cung cấp hoàn tiền; tiền ra: chi nhà cung cấp, hoàn tiền khách), cùng số tiền, ngày phiếu cách ngày giao dịch không quá 3 ngày, chưa ghép giao dịch khác. Nhiều phiếu thỏa thì không tự ghép, hiện danh sách để chọn. Phiếu ghi sổ sau giao dịch cũng được thử ghép lại.
- QUYTAC_NGHIEPVU_116: Gợi ý khách cho tiền vào chưa ghép, theo thứ tự: số đơn bán trong nội dung chuyển khoản; mã khách hàng; mã số thuế. Kế toán xác nhận (sửa được khách, số tiền không sửa) thì hệ thống lập phiếu thu khách hàng của quỹ, ngày giao dịch, ghi chú nội dung chuyển khoản, theo luồng duyệt phiếu thu đã có; phiếu ghi sổ thì giao dịch chuyển sang đã ghép.
- QUYTAC_NGHIEPVU_117: Bỏ qua cần lý do; bỏ ghép đưa giao dịch về chưa ghép, không đổi phiếu. Một phiếu ghép tối đa một giao dịch.

## 5. Vai trò và quyền

| Vai trò | Quyền |
|---|---|
| Kế toán | Xem giao dịch, đối chiếu; ghép, bỏ ghép, bỏ qua, xác nhận tạo phiếu thu |
| Kế toán trưởng | Như kế toán; cài đặt kết nối ngân hàng |
| Quản trị công ty | Cài đặt kết nối ngân hàng |

Quyền mới: `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup`.

## 6. Luồng nghiệp vụ

Luồng 30 (tài liệu `09`): dịch vụ gửi webhook → kiểm khóa → lưu giao dịch (chống trùng) → tự ghép → còn chưa ghép thì kế toán xử lý (xác nhận phiếu thu gợi ý, ghép tay, bỏ qua) → đối chiếu số dư cuối kỳ.

## 7. Màn hình

- MAN_HINH_58 Giao dịch ngân hàng: lọc quỹ, khoảng ngày, trạng thái (chưa ghép, đã ghép, bỏ qua), chiều; mỗi dòng có nút xử lý; ô đối chiếu số dư phía trên.
- MAN_HINH_59 Kết nối ngân hàng: danh sách quỹ ngân hàng, trạng thái kết nối, địa chỉ webhook, khóa, gửi giao dịch thử (bộ giả lập).

## 8. Dữ liệu và API

- `finance.bank_connections` (quỹ, dịch vụ, khóa mã hóa, bật tắt, lần nhận cuối).
- `finance.bank_transactions` (kết nối, quỹ, mã giao dịch dịch vụ, ngày giờ, chiều, số tiền, nội dung, mã tham chiếu, số dư sau giao dịch nếu có, trạng thái, phiếu ghép, khách gợi ý, lý do bỏ qua, dữ liệu gốc).
- API_95 đến API_102: kết nối (xem, lưu, gửi thử), webhook công khai `POST /api/v1/public/bank-webhooks/:connectionId`, danh sách giao dịch, ghép, bỏ ghép, bỏ qua, xác nhận phiếu thu, đối chiếu.

## 9. Điều kiện đặc biệt

- Định dạng SePay theo tài liệu công khai (https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook): trường `id`, `transactionDate`, `transferType` (in, out), `transferAmount`, `accumulated`, `content`, `referenceCode`, `accountNumber`; trả 200 `{"success": true}`. Cách gửi khóa xác thực phải kiểm lại với tài khoản thật trước phát hành.
- Số tài khoản trong webhook khác số tài khoản của quỹ thì từ chối (409).

## 10. Tiêu chí nghiệm thu

Lập sau khi người dùng xác nhận thiết kế (TIEUCHI_NGHIEMTHU_132 trở đi).

## 11. Kịch bản kiểm thử

Lập sau khi người dùng xác nhận thiết kế (KICHBAN_KIEMTHU_246 trở đi).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Khóa mã hóa bằng `common/secret-box`. Ghép lại khi phiếu ghi sổ qua `PaymentsService.postedHooks`. Webhook công khai không cần phiên, giới hạn kích thước nội dung.

## 13. Thành phần không được thay đổi

Ghi sổ phiếu thu chi, công nợ, bút toán, luồng duyệt (chỉ dùng lại để lập phiếu thu).

## 14. Các lát và điểm xem trước

- L0: kết nối, webhook, bộ giả lập, lưu giao dịch, tự ghép, danh sách giao dịch. Điểm xem trước: gửi giao dịch thử thấy giao dịch tự ghép với phiếu thu.
- L1: gợi ý khách, xác nhận phiếu thu, ghép tay, bỏ qua, bỏ ghép, đối chiếu số dư.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
