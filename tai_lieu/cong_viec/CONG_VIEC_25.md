# CONG_VIEC_25: Thanh toán đơn người mua (MODULE_09, phần lõi 3)

- Mô tả: Khung cổng thanh toán chung bật tắt từng cổng, từng phương thức; kết nối VNPAY; đơn chờ thanh toán 15 phút; sổ thanh toán của đơn VComm (không công nợ); hoàn tiền do kế toán chuyển khoản; hạch toán tiền thu, phí giao hàng; công tắc mở đặt hàng cho mọi người mua.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (không làm bản mẫu riêng, xem trước từng lát). Lát đối soát COD tạm dừng chờ người dùng lấy tài liệu API đối soát của GHN. Đang thực hiện.
- Nguồn: THAY_DOI_14; quyết định của người dùng ngày 2026-11-11 trong tài liệu `02`; CONG_VIEC_24 (đơn VComm), CONG_VIEC_14 (bút toán), CONG_VIEC_16 (hóa đơn điện tử).

## 1. Mục tiêu

Người mua trả tiền trực tuyến hoặc khi nhận hàng; VComm biết chính xác đơn nào đã thu tiền, đã hoàn tiền, để mở đặt hàng cho mọi người mua và tính hoa hồng (CONG_VIEC_26).

## 2. Phạm vi

Trong phạm vi:
- Khung cổng thanh toán: danh sách cổng, phương thức của từng cổng, bật tắt; thanh toán khi nhận hàng là một phương thức; thông tin kết nối ở biến môi trường.
- VNPAY: QR VNPAY, thẻ ATM nội địa, thẻ quốc tế; tạo đường dẫn thanh toán, nhận kết quả từ máy chủ VNPAY (IPN) có kiểm chữ ký, số tiền; trang kết quả trả về ứng dụng.
- Đơn thanh toán trực tuyến: trạng thái Chờ thanh toán, giữ hàng 15 phút, thanh toán lại, tự hủy khi quá hạn.
- Sổ thanh toán đơn VComm: lần thanh toán, tiền đã thu, đã hoàn; đơn gắn tài khoản người mua trên ứng dụng, không tạo đối tác, không công nợ.
- Hoàn tiền: việc chờ hoàn khi hủy đơn đã thu tiền, khi nhận hàng trả; tài khoản ngân hàng của người mua trên ứng dụng; kế toán ghi "Đã hoàn tiền".
- Hạch toán: tiền thu trực tuyến vào ngân hàng; phí giao hàng là doanh thu cung cấp dịch vụ, thuế 10%, lên hóa đơn điện tử; hoàn tiền.
- Công tắc mở đặt hàng cho mọi người mua.

Tạm dừng: đối soát COD với GHN qua API (chờ tài liệu API của GHN).
Ngoài phạm vi: cổng MoMo, SePay, PayOS và hoàn tiền tự động qua cổng (thêm sau theo khung); hoa hồng, ví (CONG_VIEC_26).

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_51: Người mua VComm thanh toán trực tuyến qua cổng thanh toán hoặc khi nhận hàng; VComm theo dõi tiền thu, hoàn tiền theo từng đơn và mở đặt hàng cho mọi người mua.
- CHUC_NANG_120: Khung cổng thanh toán, bật tắt cổng và phương thức; mở đặt hàng.
- CHUC_NANG_121: Thanh toán trực tuyến VNPAY, chờ thanh toán, tự hủy.
- CHUC_NANG_122: Sổ thanh toán đơn VComm, hoàn tiền.
- CHUC_NANG_123: Hạch toán tiền thu, phí giao hàng, hoàn tiền; hóa đơn phí giao hàng.
- CHUC_NANG_124: Đối soát COD với GHN (tạm dừng).

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_163: Phương thức thanh toán có mã, cổng, tên, bật tắt. Thanh toán khi nhận hàng (`cod`) và các phương thức của VNPAY (`vnpay_qr`, `vnpay_atm`, `vnpay_card`). Phương thức của cổng chỉ bật được khi cổng có thông tin kết nối ở biến môi trường. Người mua chỉ thấy, chỉ chọn được phương thức đang bật.
- QUYTAC_NGHIEPVU_164: Mở đặt hàng: công tắc trong cài đặt bán hàng VComm, người có quyền quản lý đơn VComm bật hoặc tắt; chỉ bật được khi có ít nhất một phương thức đang bật. Đang mở thì mọi người mua đặt được; đang đóng thì chỉ người mua thử (QUYTAC_NGHIEPVU_158).
- QUYTAC_NGHIEPVU_165: Đơn thanh toán trực tuyến: tạo ở trạng thái Chờ thanh toán, giữ hàng hết hạn sau 15 phút. Người mua mở thanh toán (tạo lần thanh toán mới, số tham chiếu duy nhất) được nhiều lần trong thời hạn. Cổng báo thành công đúng số tiền, đơn còn Chờ thanh toán thì ghi đã thu, giữ hàng không hết hạn, đơn chuyển Chờ giao. Quá hạn chưa thu thì việc nền (mỗi phút) hủy đơn, nhả hàng. Cổng báo thành công sau khi đơn đã hủy thì ghi tiền thu và lập việc chờ hoàn tiền. Người mua tự hủy đơn Chờ thanh toán được.
- QUYTAC_NGHIEPVU_166: Kết quả từ cổng chỉ nhận khi đúng chữ ký; số tiền phải bằng tổng thanh toán của đơn; mỗi lần thanh toán chỉ ghi nhận một lần (nhận trùng trả lời đã xác nhận). Trang kết quả trả về ứng dụng chỉ để hiển thị, không ghi nhận tiền.
- QUYTAC_NGHIEPVU_167: Sổ thanh toán đơn VComm: mỗi đơn có tiền phải thu (tổng thanh toán), tiền đã thu, tiền đã hoàn; trạng thái thanh toán Chưa thu, Đã thu, Chờ hoàn, Đã hoàn một phần, Đã hoàn. Đơn COD ghi đã thu khi đối soát COD (tạm dừng: kế toán ghi tay "Đã thu COD" kèm số phiên GHN). Không phát sinh công nợ đối tác.
- QUYTAC_NGHIEPVU_168: Hoàn tiền: đơn đã thu bị hủy thì hoàn toàn bộ tiền đã thu; kho nhận hàng trả thì hoàn phần tiền hàng trả (tiền dòng gồm thuế theo tỷ lệ số lượng; phí giao hàng không hoàn). Việc chờ hoàn có số tiền, lý do; người mua nhập tài khoản ngân hàng (ngân hàng, số tài khoản, tên chủ tài khoản) trên ứng dụng; kế toán chuyển khoản rồi ghi "Đã hoàn tiền" kèm mã giao dịch ngân hàng, ngày. Báo người mua bằng thông báo trong ứng dụng.
- QUYTAC_NGHIEPVU_169: Hạch toán (công ty đã khởi tạo kế toán): thu trực tuyến Nợ tiền gửi ngân hàng (1121) / Có phải thu khách hàng (131, không đối tác); thu COD Nợ 1121 / Có 131; giao hàng có phí giao hàng: Nợ 131 / Có doanh thu cung cấp dịch vụ (5113), thuế giá trị gia tăng đầu ra (33311) 10%, cùng ngày phiếu xuất; hoàn tiền Nợ 131 / Có 1121. Hóa đơn điện tử của phiếu xuất có thêm dòng "Phí giao hàng".

## 5. Vai trò và quyền

- `marketplace.order.manage`: bật tắt phương thức, mở đặt hàng.
- Quyền mới `marketplace.payment.manage`: ghi "Đã hoàn tiền", ghi "Đã thu COD" (Kế toán, quản trị công ty, quản trị tập đoàn); `marketplace.order.view` xem sổ thanh toán, việc chờ hoàn.

## 6. Luồng nghiệp vụ

Luồng 38: quản trị bật phương thức, mở đặt hàng → người mua chọn VNPAY khi đặt (đơn Chờ thanh toán) → mở trang VNPAY, trả tiền → VNPAY báo kết quả (IPN) → đơn Chờ giao, sổ thanh toán Đã thu → giao hàng (bút toán phí giao hàng, hóa đơn) → trả hàng hoặc hủy → việc chờ hoàn → người mua nhập tài khoản → kế toán chuyển khoản, ghi Đã hoàn tiền. Nhánh: quá 15 phút chưa trả, đơn tự hủy.

## 7. Màn hình

Web-crm:
- Sửa MAN_HINH_86: phương thức thanh toán (bật tắt theo cổng), công tắc mở đặt hàng.
- Sửa MAN_HINH_88: phương thức, trạng thái thanh toán, lần thanh toán, việc hoàn tiền của đơn; ghi "Đã thu COD".
- MAN_HINH_98 Hoàn tiền: danh sách việc chờ hoàn, tài khoản người mua, ghi "Đã hoàn tiền".

Ứng dụng:
- Sửa MAN_HINH_93: chọn phương thức thanh toán.
- MAN_HINH_99 Thanh toán: mở trang cổng, chờ kết quả, thời gian còn lại, thanh toán lại.
- Sửa MAN_HINH_96: trạng thái thanh toán, nút thanh toán khi Chờ thanh toán, hoàn tiền.
- MAN_HINH_100 Tài khoản nhận hoàn tiền (từ màn hình tài khoản).

## 8. Dữ liệu và API

- Database migration 0027: `marketplace.payment_methods`; `marketplace.store_settings.ordering_open`; `marketplace.orders` thêm phương thức, trạng thái thanh toán, hạn thanh toán, tiền đã thu, đã hoàn, trạng thái `awaiting_payment`; `marketplace.payments` (lần thanh toán); `marketplace.refunds`; `marketplace.buyer_bank_accounts`; quyền `marketplace.payment.manage`.
- API_130 phương thức, mở đặt hàng (quản trị).
- API_131 thanh toán của người mua: tạo lần thanh toán, xem; kết quả trả về.
- API_132 IPN VNPAY: `GET /public/payments/vnpay/ipn`.
- API_133 hoàn tiền: tài khoản ngân hàng người mua; danh sách, ghi đã hoàn (quản trị); ghi đã thu COD.

## 9. Điều kiện đặc biệt

- VNPAY viết theo đặc tả công khai phiên bản 2.1.0 (ký HMAC SHA512); kiểm thử tự động dùng giả lập. Trước khi phát hành phải thử với tài khoản môi trường thử nghiệm (sandbox) của VNPAY do người dùng cấp (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`).
- Không lưu thông tin thẻ; người mua nhập thẻ trên trang VNPAY.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_184 | Bật tắt phương thức theo cổng; mở đặt hàng chỉ khi có phương thức bật; người mua chỉ chọn phương thức đang bật | Bắt buộc | KICHBAN_KIEMTHU_321 |
| TIEUCHI_NGHIEMTHU_185 | Thanh toán VNPAY (giả lập): đường dẫn ký đúng; IPN sai chữ ký, sai số tiền bị từ chối; thành công ghi đã thu một lần, đơn Chờ giao; nhận trùng không đổi kết quả | Bắt buộc | KICHBAN_KIEMTHU_322 |
| TIEUCHI_NGHIEMTHU_186 | Chờ thanh toán 15 phút: quá hạn tự hủy, nhả hàng; trả sau khi hủy lập việc hoàn | Bắt buộc | KICHBAN_KIEMTHU_323 |
| TIEUCHI_NGHIEMTHU_187 | Hoàn tiền: hủy đơn đã thu, nhận hàng trả lập việc hoàn đúng số tiền; người mua nhập tài khoản; kế toán ghi đã hoàn; phân quyền | Bắt buộc | KICHBAN_KIEMTHU_324 |
| TIEUCHI_NGHIEMTHU_188 | Bút toán tiền thu, phí giao hàng, hoàn tiền đúng tài khoản; hóa đơn có dòng phí giao hàng | Bắt buộc | KICHBAN_KIEMTHU_325 |
| TIEUCHI_NGHIEMTHU_189 | Ứng dụng: chọn phương thức, thanh toán, thanh toán lại, tài khoản nhận hoàn tiền chạy được trên bản xem trước web khổ điện thoại; web hiện thanh toán, hoàn tiền | Bắt buộc | KICHBAN_KIEMTHU_326 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_321 đến 325: tự động, `apps/api/test/c25-*.test.ts` (VNPAY giả lập, đồng hồ kiểm thử).
- KICHBAN_KIEMTHU_326: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện (ký bằng `node:crypto`). Dùng lại: đơn VComm (CONG_VIEC_24), giữ hàng, bút toán tự sinh (CONG_VIEC_14), hóa đơn điện tử (CONG_VIEC_16), thông báo trong ứng dụng, BullMQ.

## 13. Thành phần không được thay đổi

Luồng đơn bán, công nợ, phiếu thu chi của các kênh khác; đơn COD hiện có của CONG_VIEC_24.

## 14. Các lát và điểm xem trước

- L0: database migration, phương thức thanh toán, mở đặt hàng, chọn phương thức khi đặt (API_130; sửa MAN_HINH_86, 93).
- L1: VNPAY, chờ thanh toán, tự hủy (API_131, 132; MAN_HINH_99, sửa 96).
- L2: đối soát COD với GHN – tạm dừng; tạm thời kế toán ghi "Đã thu COD".
- L3: hoàn tiền (API_133; MAN_HINH_98, 100).
- L4: bút toán, hóa đơn phí giao hàng.
