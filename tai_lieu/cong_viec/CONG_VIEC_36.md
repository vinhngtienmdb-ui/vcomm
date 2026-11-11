# CONG_VIEC_36: Cổng chuyển khoản ngân hàng và VietQR (MODULE_09)

- Mô tả: Người mua chuyển khoản thẳng vào tài khoản ngân hàng của công ty vận hành sàn theo thông tin và mã VietQR do VComm tự sinh, không qua cổng trung gian. Tiền về được ghi nhận khi đối soát ngân hàng (CONG_VIEC_18) ghép được giao dịch, hoặc khi kế toán xác nhận tay trên web.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã nghiệm thu, chờ phát hành (người dùng nghiệm thu 2026-11-11); trước khi phát hành phải thử với tài khoản thử nghiệm của nhà cung cấp.
- Mức: Vừa. Nhánh: `chuc-nang/CONG_VIEC_36-cong-chuyen-khoan-vietqr` (tách từ `chuc-nang/CONG_VIEC_32-khung-nhieu-cong-thanh-toan`).
- Nguồn: người dùng yêu cầu 2026-11-11 tích hợp "chuyển khoản" và "VietQR" (gộp một cổng vì cùng cơ chế); khung CONG_VIEC_32; quyết định của người dùng ngày 2026-11-11 (mục 13).

## 1. Phạm vi

Trong phạm vi: CHUC_NANG_150.

- Mã cổng `bank_transfer`, phương thức `bank_transfer_vietqr` (sort_order 40, mặc định tắt).
- Lớp kết nối `apps/api/src/marketplace/payments/gateways/bank-transfer-gateway.ts`: thông tin chuyển khoản, chuỗi mã QR theo chuẩn VietQR (EMVCo, NAPAS).
- Tự ghép tiền vào từ đối soát ngân hàng; kế toán xác nhận tay trên trang chi tiết đơn VComm (web-crm, MAN_HINH_88).
- Ứng dụng di động vẽ mã QR từ chuỗi VietQR (MAN_HINH_99).

Ngoài phạm vi: lấy giao dịch trực tiếp từ ngân hàng (vẫn qua dịch vụ trung gian của CONG_VIEC_18); thời hạn thanh toán riêng cho chuyển khoản; tự hoàn tiền khi người mua chuyển thừa, chuyển trùng.

## 2. Chức năng

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_150 | Thanh toán đơn VComm bằng chuyển khoản ngân hàng kèm mã VietQR; tự ghi nhận khi đối soát ngân hàng ghép được giao dịch; kế toán xác nhận tay | Theo CONG_VIEC_25, CONG_VIEC_32 |

## 3. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_240: Mở thanh toán trả ngân hàng, số tài khoản, tên chủ tài khoản, số tiền, nội dung chuyển khoản là số tham chiếu của lần thanh toán, và chuỗi mã QR VietQR động: trường 38 gồm mã NAPAS `A000000727`, mã ngân hàng 6 số (BIN), số tài khoản, dịch vụ `QRIBFTTA`; trường 53 `704`; 54 số tiền; 58 `VN`; 62.08 nội dung; 63 CRC-16/CCITT-FALSE. Cổng chỉ được coi là đã cấu hình khi có đủ bốn biến môi trường, mã ngân hàng đúng 6 số, số tài khoản chỉ chữ và số, tối đa 19 ký tự.
- QUYTAC_NGHIEPVU_241: Tiền vào lưu qua đối soát ngân hàng tự ghép với lần thanh toán khi: quỹ có số tài khoản (chỉ so chữ số) trùng số tài khoản nhận chuyển khoản; giao dịch thuộc công ty của đơn; số tiền bằng số tiền lần thanh toán; nội dung chứa số tham chiếu, không phân biệt hoa thường, không liền chữ hoặc số khác ở hai bên; lần thanh toán đang chờ; ra đúng một lần thanh toán. Ghép trước khi xét phiếu thu chi. Ghép được thì giao dịch ngân hàng "Đã ghép" với lần thanh toán đó, lần thanh toán ghi nhận như kết quả cổng (QUYTAC_NGHIEPVU_166: một lần, bút toán thu tiền, đơn Chờ giao); mã giao dịch ghi là mã tham chiếu của ngân hàng, không có thì mã giao dịch của dịch vụ. Giao dịch đã ghép với đơn VComm không bỏ ghép được. Ghi nhận lỗi (kỳ kế toán khóa) thì giao dịch vẫn lưu, để chưa ghép.
- QUYTAC_NGHIEPVU_242: Người có quyền `marketplace.payment.manage` xác nhận tay một lần thanh toán chuyển khoản đang chờ trên trang chi tiết đơn, nhập mã giao dịch ngân hàng; số tiền ghi nhận là số tiền của lần thanh toán; ghi nhật ký thao tác. Lần thanh toán đã ghi nhận thì từ chối (409). Giao dịch ngân hàng tương ứng (nếu có) kế toán xử lý bên đối soát ngân hàng.
- QUYTAC_NGHIEPVU_243: Thời hạn thanh toán giữ 15 phút như các cổng khác. Tiền về sau khi đơn tự hủy hoặc đơn đã thu từ lần thanh toán khác thì vẫn ghi nhận và lập việc chờ hoàn tiền (theo khung). Chuyển lần nữa cho lần thanh toán đã ghi nhận thì giao dịch để chưa ghép cho kế toán xử lý.
- QUYTAC_NGHIEPVU_244: Cổng không nhận kết quả qua đường dẫn chung `/api/v1/public/payments/bank_transfer/notify`: mọi yêu cầu bị từ chối (403), đếm, ghi lại như sai chữ ký.

## 4. Vai trò và quyền

Không thêm quyền. Xác nhận tay: `marketplace.payment.manage`. Đối soát ngân hàng: quyền của CONG_VIEC_18.

## 5. Biến môi trường

| Biến | Nội dung |
|---|---|
| `BANK_TRANSFER_BANK_BIN` | Mã ngân hàng 6 số theo NAPAS (ví dụ Vietcombank 970436) |
| `BANK_TRANSFER_BANK_NAME` | Tên ngân hàng hiện cho người mua |
| `BANK_TRANSFER_ACCOUNT_NUMBER` | Số tài khoản nhận; phải trùng số tài khoản của quỹ ngân hàng đã kết nối đối soát |
| `BANK_TRANSFER_ACCOUNT_NAME` | Tên chủ tài khoản |

## 6. Dữ liệu, API, giao diện

- Database migration `0054_payment_bank_transfer.sql`: thêm phương thức `bank_transfer_vietqr`; thêm cột `finance.bank_transactions.marketplace_payment_id` (tham chiếu `marketplace.payments`), ràng buộc "Đã ghép" có đúng một trong phiếu thu chi hoặc lần thanh toán, mỗi lần thanh toán ghép tối đa một giao dịch.
- API mới (phiên chính cấp mã khi hợp nhất): `POST /api/v1/marketplace/orders/:id/transfer-received` thân `{ reference, bankTransactionNo }`, trả chi tiết đơn (như API_133 ghi đã thu tiền thu hộ).
- API_127 chi tiết đơn VComm thêm `canConfirmTransfer`. API_99 giao dịch ngân hàng thêm `marketplacePayment { reference, documentNo }`; `autoMatched` đúng cho cả ghép với đơn VComm. API_100 bỏ ghép: từ chối giao dịch đã ghép với đơn VComm.
- Giao diện: MAN_HINH_88 thêm khối "Xác nhận đã nhận chuyển khoản"; MAN_HINH_58 hiện "Đơn VComm … · lần thanh toán …", ẩn nút bỏ ghép; MAN_HINH_99 vẽ mã QR từ `qrData` khi cổng không cấp ảnh.
- Thư viện mới (người dùng duyệt ngày 2026-11-11): `react-native-qrcode-svg` 6.3.26, `react-native-svg` 15.16.0 (giấy phép MIT; bản theo danh sách tương thích của Expo; chọn bản phát hành trước 2026-10-01, tránh loạt bản phát hành dồn dập tháng 11).

## 7. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_246 | Mở thanh toán trả đủ thông tin chuyển khoản; chuỗi VietQR đúng cấu trúc, CRC đúng; thiếu hoặc sai biến môi trường thì cổng chưa cấu hình | Bắt buộc | KICHBAN_KIEMTHU_391 |
| TIEUCHI_NGHIEMTHU_247 | Tự ghép đúng QUYTAC_NGHIEPVU_241; sai số tiền, sai nội dung, quỹ khác không ghép; ghi nhận một lần; không bỏ ghép được; đường dẫn chung bị từ chối | Bắt buộc | KICHBAN_KIEMTHU_392 |
| TIEUCHI_NGHIEMTHU_248 | Kế toán xác nhận tay một lần, có nhật ký; người không có quyền bị từ chối; số tham chiếu không thuộc đơn trả 404 | Bắt buộc | KICHBAN_KIEMTHU_393 |
| TIEUCHI_NGHIEMTHU_249 | Tiền về sau khi đơn tự hủy vẫn ghi nhận, lập việc chờ hoàn tiền | Bắt buộc | KICHBAN_KIEMTHU_394 |

## 8. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_391 đến 394: tự động, `apps/api/test/c36-payment-bank-transfer.test.ts`. Mẫu CRC lấy từ chuỗi công khai của gói mã nguồn mở `sunary/vietqr` (CRC `BE74`); dùng bộ giả lập ngân hàng của CONG_VIEC_18, không gọi máy chủ thật.
- `apps/api/test/c25-payment-methods.test.ts` (KICHBAN_KIEMTHU_321): dùng bản trên nhánh nền (người dùng duyệt phương án A: chỉ so phương thức cổng `cod`, `vnpay`).

## 9. Kết quả kiểm thử (2026-11-11)

- `c36-payment-bank-transfer`: 4/4 đạt.
- Hồi quy `pnpm --filter api test`: 47 tệp, 337/337 đạt; sau khi hợp nhất nhánh nền có cổng MoMo (CONG_VIEC_33): 48 tệp, 340/340 đạt.
- `pnpm typecheck`, `pnpm lint`: đạt.
- `pnpm audit --audit-level=high`: không có lỗ hổng Cao, Nghiêm trọng; 2 lỗ hổng Trung bình có sẵn từ trước (`glob`, `minimatch` qua `expo` → `@expo/cli`), không do thư viện mới.
- Giao diện (MAN_HINH_88, 58, 99): chưa xem trên trình duyệt, điện thoại; cần người dùng xem khi nghiệm thu.

## 10. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_240 đến 244 (mục 3).
- `10`: CHUC_NANG_150.
- `11`: TIEUCHI_NGHIEMTHU_246 đến 249.
- `13`: `react-native-qrcode-svg` 6.3.26, `react-native-svg` 15.16.0 (mobile-vcomm).
- `16`: cột `finance.bank_transactions.marketplace_payment_id`, ràng buộc `bank_transactions_matched_check`, chỉ mục `bank_transactions_marketplace_payment_idx`; phương thức `bank_transfer_vietqr`.
- `17`: endpoint xác nhận tay (cấp mã API); trường mới của API_127, API_99; lỗi mới `bankTransactionMarketplaceLinked`, `bankTransferNotPending`.
- `21`: KICHBAN_KIEMTHU_391 đến 394.
- `22`: số tài khoản nhận chỉ ở biến môi trường; chuỗi QR sinh tại máy chủ, không gửi dịch vụ ngoài; đường dẫn chung của cổng từ chối mọi yêu cầu.
- `25`: kết quả mục 9.
- `27`: CHUC_NANG_150 → TIEUCHI_NGHIEMTHU_246 đến 249 → KICHBAN_KIEMTHU_391 đến 394 → `bank-transfer-gateway.ts`, `bank-transfer.service.ts`, `bank-reconciliation.service.ts`.

## 11. Thành phần không được thay đổi

Luồng ghi nhận của khung (`payments.service.ts`: chỉ tách phần ghi nhận thành hàm `record` dùng chung, hành vi VNPAY và đường dẫn chung không đổi); luồng ghép phiếu thu chi, gợi ý khách của CONG_VIEC_18; hoa hồng (CONG_VIEC_26).

## 12. Giới hạn đã biết, điểm chưa xác minh

- Cấu trúc VietQR theo tài liệu công khai của thư viện mã nguồn mở và mẫu có CRC kiểm được; chưa đối chiếu bản đặc tả NAPAS chính thức. Trước phát hành: quét mã QR thật bằng ứng dụng của vài ngân hàng với tài khoản nhận thật.
- Ngân hàng có thể cắt hoặc đổi nội dung chuyển khoản; khi đó kế toán xác nhận tay.
- Tự ghép cần kết nối đối soát ngân hàng (SePay) cho quỹ có số tài khoản nhận; cách SePay gửi khóa chưa thử với tài khoản thật (giới hạn của CONG_VIEC_18).
- Xác nhận tay không liên kết giao dịch ngân hàng: giao dịch đó kế toán bỏ qua có lý do bên đối soát. Bút toán thu tiền ghi ngày xác nhận.
- Số dư sổ của quỹ trong đối chiếu (API_101) chỉ tính phiếu thu chi; tiền đơn VComm ghi bằng bút toán nên không vào số dư sổ của quỹ (như VNPAY trước đây).

## 13. Quyết định của người dùng (2026-11-11)

- Giao dịch ngân hàng ghép với đơn VComm: thêm liên kết bằng database migration riêng, hiện "Đã ghép" (vượt giới hạn "chỉ INSERT" của hướng dẫn chung).
- Mã QR trên ứng dụng: thêm thư viện vẽ QR.
- Thời hạn thanh toán: giữ 15 phút.
- Xác nhận tay: nút trên trang chi tiết đơn, nhập mã giao dịch ngân hàng.

## 14. Kết quả đối chiếu định nghĩa hoàn thành

- Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu: Đạt (TIEUCHI_NGHIEMTHU_246 đến 249).
- Đúng giao diện: chờ người dùng xem (dùng thành phần, biến có sẵn; không thêm giá trị tài liệu `15`).
- Đã xử lý lỗi: Đạt (thông báo tiếng Việt, tiếng Anh).
- Đã kiểm thử: Đạt (mục 9).
- Không phá vỡ chức năng cũ: Đạt (hồi quy toàn bộ).
- Cổng bảo mật: Đạt (mục 9; quét khóa bí mật bằng gitleaks trong CI).
- Tự rà soát mã, dọn dẹp: Đạt.
- Tài liệu `27` và tài liệu liên quan: ghi trong mục 10, phiên chính cập nhật khi hợp nhất.
