# CONG_VIEC_73: Mua hàng tại cửa hàng, thanh toán trong ứng dụng VComm (MODULE_09, MODULE_11, MODULE_12, MODULE_14, MODULE_06, MODULE_16)

- Mô tả: Khách mua tại cửa hàng tập đoàn hoặc cửa hàng liên kết chọn điểm và trả tiền ngay trong ứng dụng VComm qua cổng thanh toán. Hai cách: cửa hàng quét mã thanh toán động trên ứng dụng khách, hoặc khách quét mã QR thanh toán của cửa hàng. Công ty vận hành sàn thu tiền một nơi, chuyển hằng ngày cho công ty sở hữu cửa hàng hoặc cửa hàng liên kết sau khi trừ phí sàn và phí cổng. VComm lập hóa đơn điện tử thay cửa hàng liên kết theo ủy nhiệm. Mở Open API đơn chờ thanh toán và webhook để phần mềm bán hàng (iPOS sau này) dùng.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-17
- Trạng thái: Người dùng duyệt đặc tả, bản mẫu và 16 điểm AI đề xuất (mục 19) ngày 2026-11-17. Người dùng duyệt phần bổ sung API hoàn tiền, tra trạng thái cho iPOS (CONG_VIEC_74) ngày 2026-11-17. Người dùng duyệt cho iPOS gọi thẳng service đơn chờ trong backend và chừa khoản trừ phí thuê bao iPOS trong bảng chuyển tiền (THAY_DOI_39) ngày 2026-11-17; phần bổ sung (QUYTAC_NGHIEPVU_575, 585, mục 15) là cách thực hiện quyết định đó. Viết mã sau khi CONG_VIEC_72 vào `main`.
- Nhánh: `chuc-nang/CONG_VIEC_73-mua-hang-tai-cua-hang`.
- Nguồn: yêu cầu người dùng 2026-11-17; quyết định người dùng 2026-11-17 (mục 17); CONG_VIEC_53 (bán tại quầy, điểm tại quầy), CONG_VIEC_55 (cửa hàng liên kết), CONG_VIEC_67 (Open API cửa hàng liên kết), CONG_VIEC_25, 32, 33 đến 42 (cổng thanh toán), CONG_VIEC_16 (hóa đơn điện tử), CONG_VIEC_19 (đối soát thu hộ cổng), CONG_VIEC_51 (sổ cái điểm, nợ nội bộ), CONG_VIEC_72 (Smart OTP).
- Mức: Lớn (nhiều module; đổi quy trình, cấu trúc dữ liệu, API đã duyệt; nghiệp vụ tài chính mới).
- Thay đổi: THAY_DOI_38.
- Phụ thuộc: CONG_VIEC_72 phải hợp nhất vào `main` trước khi viết mã (dùng khóa Smart OTP trên máy, khóa dùng điểm sau khôi phục).
- Mã do phiên điều phối cấp ngày 2026-11-17: YCAU_NGHIEPVU_205 đến 208, QUYTAC_NGHIEPVU_573 đến 592, CHUC_NANG_247 đến 251, TIEUCHI_NGHIEMTHU_546 đến 559, KICHBAN_KIEMTHU_750 đến 767, MAN_HINH_276 đến 282, API_327 đến 334, database migration 0161 đến 0164, Luồng 67.

## 1. Mục tiêu

- Khách mua tại cửa hàng dùng điểm và trả tiền bằng một thao tác trên ứng dụng VComm, không phải đọc mã Smart OTP cho thu ngân.
- Cửa hàng liên kết nhận tiền khách trả qua VComm hằng ngày, có hóa đơn điện tử lập sẵn.
- Công ty vận hành sàn biết chính xác tiền thu hộ, phí, tiền phải chuyển của từng người nhận mỗi ngày; hạch toán tự động ở cả hai công ty.
- Phần mềm bán hàng của cửa hàng (iPOS sau này) gọi được Open API để tạo đơn chờ thanh toán và nhận kết quả.

## 2. Phạm vi

Trong phạm vi:
- Mã thanh toán động trên ứng dụng VComm (sinh từ khóa Smart OTP, không cần mạng), thay việc khách đọc mã Smart OTP và thay mã thành viên HMAC của cách 2 (CONG_VIEC_55) sau thời hạn chuyển đổi.
- Đơn chờ thanh toán tại cửa hàng dùng chung cho:
  - Quầy bán hàng cửa hàng tập đoàn (`web-retail`, CONG_VIEC_53).
  - Cổng cửa hàng liên kết (`web-affiliate`, CONG_VIEC_55).
  - Open API cửa hàng liên kết (CONG_VIEC_67).
- Luồng 1: cửa hàng quét mã động → ứng dụng khách hiện đơn → khách chọn điểm, voucher, cổng → thanh toán.
- Luồng 2: cửa hàng hiện mã QR thanh toán → khách quét bằng ứng dụng → ứng dụng hiện đơn → khách chọn điểm, voucher, cổng → thanh toán.
- Thanh toán qua cổng VNPAY trước; các cổng khác của khung (MoMo, ZaloPay, PayOS) bật theo khung khi người dùng yêu cầu.
- Thu hộ một nơi (công ty vận hành sàn), chia tiền: phí sàn (tỷ lệ phần trăm theo cửa hàng) và phí cổng về công ty vận hành sàn, phần còn lại chuyển cho người nhận theo ngày.
- Bảng chuyển tiền thu hộ ngày cho từng người nhận; kế toán ghi đã chuyển.
- Hạch toán ở công ty vận hành sàn và ở công ty sở hữu cửa hàng tập đoàn.
- Hóa đơn điện tử ủy nhiệm: VComm lập thay cửa hàng liên kết cho mọi giao dịch thanh toán trong ứng dụng.
- Open API: tạo đơn chờ thanh toán, gắn mã động của khách, tra, hủy; webhook báo kết quả.
- Công tắc thu hộ theo từng cửa hàng liên kết, mặc định tắt.

Ngoài phạm vi:
- Ứng dụng iPOS (người dùng tách thành công việc riêng sau CONG_VIEC_73).
- Hoàn tiền tự động qua API hoàn tiền của cổng: hoàn tay bằng chuyển khoản như CONG_VIEC_25.
- Chia tiền tự động tại cổng (tài khoản con).
- Kết hợp trong cùng một đơn phần trả trong ứng dụng với tiền mặt, chuyển khoản tại quầy.
- Bán khi mất mạng (giữ quyết định của CONG_VIEC_53).
- Trả hàng một phần ở cửa hàng liên kết (giữ CONG_VIEC_55: chỉ hủy toàn bộ).
- Khách chưa có tài khoản VComm: bán như hiện nay, không tích tạm theo số điện thoại.
- Tra cứu pháp lý về trung gian thanh toán và ủy nhiệm lập hóa đơn: người dùng tự xác nhận hồ sơ (mục 20).

## 3. Hiện trạng và phần đổi

| Nội dung | Hiện nay | Sau CONG_VIEC_73 |
|---|---|---|
| Dùng điểm tại quầy tập đoàn | Khách đọc mã Smart OTP 6 số, thu ngân nhập | Thu ngân quét mã động; nhập 6 số giữ làm dự phòng |
| Thanh toán tại quầy tập đoàn | Tiền mặt, chuyển khoản VietQR, điểm | Thêm phương thức "Ứng dụng VComm": khách trả toàn bộ phần còn lại trên ứng dụng |
| Cổng cửa hàng liên kết, cách 1 | Khách quét QR, chọn điểm, voucher, xác nhận; trả tiền trực tiếp cho cửa hàng | Cửa hàng bật thu hộ: khách trả phần còn lại trong ứng dụng; tắt thu hộ: như cũ |
| Cổng cửa hàng liên kết, cách 2 | Mã thành viên HMAC 60 giây, khách chọn điểm trước khi hiện mã, hoàn tất ngay | Mã động; sau khi quét, khách chọn điểm, voucher trên ứng dụng và trả tiền (nếu thu hộ bật). Mã thành viên cũ còn nhận trong thời hạn chuyển đổi của CONG_VIEC_72 |
| Open API cửa hàng liên kết | Tích, đổi điểm; không thanh toán | Thêm đơn chờ thanh toán, chuỗi QR, gắn mã động, webhook |
| Tiền của cửa hàng liên kết | Khách trả thẳng cho cửa hàng | Phần trả trong ứng dụng: công ty vận hành sàn thu hộ, chuyển theo ngày |
| Hóa đơn điện tử của cửa hàng liên kết | Cửa hàng tự lập | VComm lập thay theo ủy nhiệm cho giao dịch thanh toán trong ứng dụng |
| Đối soát tuần cửa hàng liên kết | Tiền điểm, voucher, phí dịch vụ, phí tin OTP | Giữ nguyên; tiền thu hộ đối soát riêng theo ngày (mục 5, QUYTAC_NGHIEPVU_585) |
| Cổng thanh toán | Chỉ cho đơn VComm | Thêm đơn chờ thanh toán tại cửa hàng; cùng tài khoản cổng của công ty vận hành sàn |

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_205: Khách mua tại cửa hàng tập đoàn và cửa hàng liên kết chọn số điểm dùng và thanh toán trong ứng dụng VComm, theo hai luồng: cửa hàng quét mã động của khách, hoặc khách quét mã QR thanh toán của cửa hàng.
- YCAU_NGHIEPVU_206: Công ty vận hành sàn thu tiền một nơi, giữ phí sàn và phí cổng, chuyển phần còn lại hằng ngày cho công ty sở hữu cửa hàng tập đoàn hoặc cửa hàng liên kết; hạch toán đúng ở các công ty liên quan.
- YCAU_NGHIEPVU_207: VComm lập hóa đơn điện tử thay cửa hàng liên kết theo ủy nhiệm cho giao dịch thanh toán trong ứng dụng.
- YCAU_NGHIEPVU_208: Phần mềm bán hàng của cửa hàng liên kết tạo đơn chờ thanh toán qua Open API và nhận kết quả qua webhook.
- CHUC_NANG_247: Mã thanh toán động trên ứng dụng VComm.
- CHUC_NANG_248: Đơn chờ thanh toán tại cửa hàng: tạo, gắn khách (quét mã động hoặc khách quét QR), khách chọn điểm, voucher, cổng, thanh toán, hoàn tất, hết hạn, hủy; trên quầy tập đoàn và cổng cửa hàng liên kết.
- CHUC_NANG_249: Open API đơn chờ thanh toán và webhook kết quả.
- CHUC_NANG_250: Thu hộ, phí sàn, phí cổng, bảng chuyển tiền ngày, hạch toán.
- CHUC_NANG_251: Hóa đơn điện tử ủy nhiệm cho cửa hàng liên kết.

## 5. Quy tắc nghiệp vụ

### QUYTAC_NGHIEPVU_573 – Phạm vi áp dụng và công tắc

- Cửa hàng tập đoàn (`retail.stores`): thêm "Nhận thanh toán qua ứng dụng VComm" (mặc định tắt) và "Phí sàn" (0 đến 10 %, hai chữ số thập phân). Người có quyền cài đặt cửa hàng (MAN_HINH_166) bật được khi công ty vận hành sàn đã bật cổng VNPAY.
- Cửa hàng liên kết (hợp đồng, MAN_HINH_178): thêm "Thu hộ qua ứng dụng" (mặc định tắt), "Phí thu hộ" (0 đến 10 %), tài khoản ngân hàng nhận tiền (chọn trong tài khoản ngân hàng của đối tác, CONG_VIEC_06), dữ liệu ủy nhiệm hóa đơn (QUYTAC_NGHIEPVU_588). Chỉ người có `affiliate.manage` sửa. Bật thu hộ khi có tài khoản nhận tiền; ghi nhật ký thao tác.
- Hộp xác nhận khi bật thu hộ cửa hàng liên kết lần đầu: "Thu hộ tiền của cửa hàng có thể là hoạt động trung gian thanh toán. Chỉ bật khi hồ sơ pháp lý đã được xác nhận." Người bật phải đánh dấu đã đọc.
- Thu hộ tắt: luồng 1, 2 vẫn chạy để tích, dùng điểm, voucher; khách trả phần còn lại trực tiếp cho cửa hàng như CONG_VIEC_55.

### QUYTAC_NGHIEPVU_574 – Mã thanh toán động

- Chỉ có trên ứng dụng điện thoại đã kích hoạt Smart OTP (CONG_VIEC_72). Muốn hiện mã phải mở Smart OTP (mã khóa hoặc sinh trắc học).
- Nội dung: 18 chữ số = mã thanh toán của thiết bị (12 chữ số ngẫu nhiên; ứng dụng xin qua API_327 lần đầu mở Mã thanh toán sau mỗi lần kích hoạt, chuyển Smart OTP; mã gắn với lần kích hoạt nên kích hoạt lại, chuyển máy thì mã cũ hết hiệu lực; xin lại thì mã cũ hết hiệu lực; không chứa số điện thoại, tên) + mã TOTP 6 số hiện tại của Smart OTP.
- Ứng dụng hiện cùng lúc mã QR và mã vạch Code 128 của 18 chữ số, kèm 18 chữ số chia nhóm để nhập tay; đổi mỗi 30 giây, không cần mạng; tăng độ sáng màn hình khi hiện mã.
- Máy chủ kiểm: tìm thiết bị theo 12 số đầu (lưu băm HMAC-SHA256), kiểm 6 số cuối như Smart OTP: bước 30 giây, lệch một bước, mỗi bước dùng một lần, sai dùng chung bộ đếm sai của tài khoản (5 lần khóa 15 phút). 12 số đầu không khớp thiết bị nào: báo "Mã không hợp lệ", tính vào giới hạn quét sai của thu ngân, khóa API (QUYTAC_NGHIEPVU_592).
- Khóa dùng điểm sau khôi phục Smart OTP: vẫn định danh được khách, tích điểm, trả tiền; không dùng điểm (ứng dụng báo thời điểm hết khóa).
- Mã thành viên HMAC cũ của cách 2: còn nhận đến hết thời hạn chuyển đổi của người mua (QUYTAC_NGHIEPVU_561), sau đó cổng cửa hàng, Open API trả "Mã thành viên cũ không còn dùng, khách mở Mã thanh toán".
- Khách chưa kích hoạt Smart OTP: ứng dụng dẫn sang kích hoạt; tại quầy vẫn tích điểm bằng số điện thoại như hiện nay.

### QUYTAC_NGHIEPVU_575 – Đơn chờ thanh toán

- Số `TT…` (dãy chung). Nội dung cố định khi tạo: nơi bán (quầy và ca của cửa hàng tập đoàn, hoặc điểm bán của cửa hàng liên kết), nguồn (`retail_counter`: quầy tập đoàn; `merchant_portal`: cổng cửa hàng; `open_api`: khóa API; `ipos`: ứng dụng iPOS của CONG_VIEC_74), người tạo (thu ngân của quầy, cổng hoặc iPOS; hoặc khóa API), tiền hóa đơn, dòng hàng (cửa hàng tập đoàn: bắt buộc, lấy từ giỏ; iPOS: bắt buộc, lấy từ hóa đơn iPOS; cổng cửa hàng, Open API: không bắt buộc), mã đơn của đối tác (Open API) hoặc mã hóa đơn iPOS, cách thu (trong ứng dụng hoặc tại quầy).
- Cửa hàng tập đoàn: giá, khuyến mãi tính như bán tại quầy khi tạo; giữ hàng tại kho bán theo số lượng (CONG_VIEC_05) đến khi hoàn tất, hết hạn hoặc hủy; tiền thay đổi so với lúc xem thì báo như hiện nay.
- Hạn: 10 phút kể từ khi tạo. Trạng thái: chờ khách, chờ thanh toán (khách đã bấm thanh toán), hoàn tất, hết hạn, đã hủy, khách từ chối.
- Thu ngân, chủ cửa hàng, khóa API hủy được đơn khi chưa hoàn tất. Đóng ca bị chặn khi ca còn đơn chờ thanh toán.
- Giới hạn: mỗi quầy tập đoàn một đơn chờ (còn đơn chờ trong hạn thì báo "Quầy đang có đơn chờ khách thanh toán"; đơn quá hạn mà việc nền chưa đóng thì đóng luôn khi tạo đơn mới); mỗi thu ngân cửa hàng liên kết (cổng hoặc iPOS) ba đơn chờ; mỗi khóa API theo giới hạn tần suất hiện có.
- Mỗi lần tạo mang khóa yêu cầu duy nhất; gửi lại cùng khóa trả đơn đã tạo.

### QUYTAC_NGHIEPVU_576 – Luồng 1: cửa hàng quét mã động

- Thu ngân (hoặc phần mềm qua Open API) tạo đơn chờ rồi quét mã động bằng máy quét, camera hoặc nhập 18 số.
- Mã đúng: đơn gắn khách; cổng cửa hàng hiện tên khách đã che, hạng; ứng dụng khách đang mở màn hình mã (hoặc mở trong 10 phút) tự hiện đơn (hỏi máy chủ mỗi 2 giây) kèm thông báo trong ứng dụng.
- Một đơn gắn một khách; quét mã khác khi đã gắn khách thì báo "Đơn đã có khách".

### QUYTAC_NGHIEPVU_577 – Luồng 2: khách quét mã QR thanh toán

- Màn hình cửa hàng (quầy, cổng cửa hàng, phần mềm của cửa hàng) hiện mã QR chứa đường dẫn `https://<miền ứng dụng>/tt/<mã>`; mã ngẫu nhiên 128 bit, lưu băm, hết hạn cùng đơn.
- Khách quét bằng ứng dụng VComm (màn hình quét có sẵn của MAN_HINH_181) hoặc camera điện thoại (mở ứng dụng qua liên kết; chưa cài thì trang hướng dẫn cài ứng dụng).
- Khách đầu tiên mở đơn được gắn vào đơn; người khác mở báo "Đơn đang được khách khác thanh toán".

### QUYTAC_NGHIEPVU_578 – Khách chọn điểm, voucher, cổng

- Ứng dụng hiện: tên cửa hàng, điểm bán hoặc quầy, dòng hàng (nếu có), tiền hóa đơn, voucher dùng được, số điểm tối thiểu, tối đa, cổng thanh toán đang bật, điểm dự kiến tích.
- Giới hạn điểm giữ như hiện nay: cửa hàng tập đoàn theo `quoteRedemption` (QUYTAC_NGHIEPVU_379); cửa hàng liên kết theo QUYTAC_NGHIEPVU_399 (sau voucher). Không thêm giới hạn theo cửa hàng.
- Dùng điểm lớn hơn 0 phải mở Smart OTP trên máy (luồng 1 đã mở khi hiện mã; luồng 2 hỏi mở khi bấm thanh toán). Khách chưa kích hoạt: trong thời hạn chuyển đổi được dùng điểm như cách 1 hiện nay; hết hạn phải kích hoạt.
- Tiền còn lại = tiền hóa đơn − voucher − tiền điểm. Bằng 0: bấm "Xác nhận", hoàn tất ngay, không qua cổng.
- Đơn cách thu "tại quầy" hoặc cửa hàng tắt thu hộ: chỉ chọn điểm, voucher, bấm "Xác nhận"; khách trả phần còn lại tại quầy. Đơn hoàn tất ngay khi khách bấm "Xác nhận" (ghi giao dịch `LK…` với điểm, voucher như cách 1 của CONG_VIEC_55); cửa hàng tự thu phần còn lại; khách không trả thì cửa hàng hủy đơn để hoàn điểm, voucher (người dùng quyết định 2026-11-17).
- Khách bấm "Từ chối": đơn chuyển khách từ chối, nhả giữ hàng.

### QUYTAC_NGHIEPVU_579 – Thanh toán qua cổng

- Bấm "Thanh toán": trừ điểm, voucher ngay (như đặt hàng dùng điểm); tạo lần thanh toán ở sổ thanh toán với số tham chiếu duy nhất; mở cổng như đơn VComm (trang cổng hoặc ứng dụng ví).
- Cổng báo thành công đúng số tiền: hoàn tất đơn (QUYTAC_NGHIEPVU_580, 581) trong cùng giao dịch cơ sở dữ liệu ghi nhận tiền. Thất bại: khách thử lại trong hạn.
- Hết hạn chưa thanh toán: hoàn điểm đúng lô, trả voucher, nhả giữ hàng.
- Cổng báo thành công sau khi đơn hết hạn hoặc bị hủy: ghi nhận tiền, lập việc chờ hoàn tiền cho khách (lý do "thanh toán sau khi hủy", như QUYTAC_NGHIEPVU_168), báo thu ngân.
- Trang trả về ứng dụng chỉ để hiển thị; kết quả chỉ nhận qua thông báo có chữ ký của cổng.

### QUYTAC_NGHIEPVU_580 – Hoàn tất ở cửa hàng tập đoàn

- Ghi hóa đơn bán lẻ như QUYTAC_NGHIEPVU_374 với dòng thanh toán mới "Ứng dụng VComm" (số tiền đã thu qua cổng) và dòng điểm (nếu có); tiêu thụ hàng đã giữ; hóa đơn điện tử khởi tạo từ máy tính tiền như hiện nay do công ty sở hữu cửa hàng lập.
- Dòng "Ứng dụng VComm" không vào tiền của ca khi đóng ca.
- Ghi sổ không được (kỳ kế toán khóa, lỗi dữ liệu): đơn chuyển "Đã thu, lỗi ghi sổ", báo Cửa hàng trưởng; người có `retail.shift.manage` bấm "Ghi lại" hoặc "Hủy và hoàn tiền" (lập việc chờ hoàn tiền).
- Màn hình quầy tự hiện "Đã thanh toán" và in hóa đơn bán lẻ.

### QUYTAC_NGHIEPVU_581 – Hoàn tất ở cửa hàng liên kết

- Ghi giao dịch `LK…` như QUYTAC_NGHIEPVU_394 (voucher, điểm, tích điểm, cách `buyer_qr` hoặc `merchant_qr`, nguồn `portal` hoặc `open_api`), thêm tiền thu hộ, phí thu hộ, phí cổng của giao dịch.
- Lập hóa đơn điện tử ủy nhiệm (QUYTAC_NGHIEPVU_588, 589) khi giao dịch có thu hộ.
- Cổng cửa hàng hiện kết quả tức thời; Open API gửi webhook (QUYTAC_NGHIEPVU_591).

### QUYTAC_NGHIEPVU_582 – Tích điểm

- Giữ như hiện nay: cửa hàng tập đoàn tích trên tổng phải trả, sổ cái tự trừ phần điểm (QUYTAC_NGHIEPVU_379); cửa hàng liên kết tích trên tiền khách trả sau voucher, điểm (QUYTAC_NGHIEPVU_398). Phần trả qua ứng dụng tích như tiền mặt, không có hệ số thưởng riêng.

### QUYTAC_NGHIEPVU_583 – Hủy, trả hàng, hoàn tiền, hoàn điểm

- Cửa hàng tập đoàn: trả hàng theo QUYTAC_NGHIEPVU_377 (hoàn, thu hồi điểm theo tỷ lệ). Phần tiền đã trả qua ứng dụng: hoàn tiền mặt tại quầy hoặc chuyển khoản tay; giá trị hoàn bằng ứng dụng không trừ vào bảng chuyển tiền đã lập.
- Cửa hàng liên kết: chủ cửa hàng hủy toàn bộ trước khi chốt tuần đối soát điểm (QUYTAC_NGHIEPVU_400). Có thu hộ: lập việc chờ hoàn tiền cho khách (kế toán công ty vận hành sàn chuyển khoản tay); ghi ngược thu hộ, phí; nếu tiền của giao dịch đã vào bảng chuyển tiền đã lập thì trừ vào bảng chuyển tiền tiếp theo của cửa hàng (QUYTAC_NGHIEPVU_585).
- Hủy giao dịch có hóa đơn ủy nhiệm: lập việc chờ xử lý hóa đơn (hủy, điều chỉnh) như CONG_VIEC_53.

### QUYTAC_NGHIEPVU_584 – Phí sàn và phí cổng

- Phí sàn = làm tròn đến đồng (tiền thu qua ứng dụng × tỷ lệ phí sàn của cửa hàng tại thời điểm thanh toán). Tiền điểm không tính phí sàn.
- Phí cổng: theo biểu phí công ty vận hành sàn cài cho từng phương thức của cổng (tỷ lệ phần trăm và số tiền cố định mỗi giao dịch), chốt tại thời điểm thanh toán. Chênh lệch với phí thực tế trên tệp đối soát cổng (CONG_VIEC_19) do công ty vận hành sàn chịu hoặc hưởng.
- Phí cổng trừ vào phần của người nhận.

### QUYTAC_NGHIEPVU_585 – Bảng chuyển tiền thu hộ ngày

- Việc nền 1 giờ sáng (giờ Việt Nam) lập bảng cho ngày hôm trước, mỗi người nhận một bảng (số `CT…`): người nhận là công ty sở hữu cửa hàng tập đoàn hoặc cửa hàng liên kết có giao dịch thu hộ, hoặc có số mang sang.
- Số liệu: tiền thu hộ (G), phí sàn (H), thuế giá trị gia tăng của phí sàn (I, thuế suất cài đặt, mặc định 10 %), phí cổng (K), ghi ngược giao dịch đã hủy thuộc bảng trước (L), số mang sang từ bảng trước (M, âm hoặc 0). khoản trừ khác (N, gồm phí thuê bao iPOS theo THAY_DOI_39). Tiền chuyển = G − H − I − K − L + M − N.
- Khoản trừ khác (N): CONG_VIEC_73 chỉ lập bảng `instore.payout_deductions` và cộng vào công thức; các dòng N (phí thuê bao iPOS) và bút toán của chúng do CONG_VIEC_74 lát L7 ghi. Chưa có dòng thì N = 0.
- Tiền chuyển âm: bảng ghi 0, số âm mang sang bảng sau.
- Không bù trừ với bảng đối soát điểm tuần: hai bảng độc lập (người dùng có thể đổi, mục 19). Thu hộ của cửa hàng liên kết không cộng vào bảng tuần.
- Trạng thái: chờ chuyển, đã chuyển. Kế toán công ty vận hành sàn chuyển khoản tới tài khoản nhận tiền rồi ghi đã chuyển (ngày, số giao dịch ngân hàng); hệ thống lập phiếu chi. Bảng chờ chuyển quá 2 ngày làm việc: cảnh báo trên trang chủ của kế toán.
- Cửa hàng liên kết xem bảng của mình trên cổng cửa hàng (MAN_HINH_282); công ty sở hữu cửa hàng tập đoàn xem trong mini app Tài chính – Kế toán.

### QUYTAC_NGHIEPVU_586 – Dư nợ và hạn mức cửa hàng liên kết

- Dư nợ (QUYTAC_NGHIEPVU_398, THAY_DOI_36) trừ thêm tiền thu hộ chờ chuyển (các bảng chờ chuyển và giao dịch chưa vào bảng, sau phí), không âm.

### QUYTAC_NGHIEPVU_587 – Hạch toán thu hộ

Kế toán trưởng xác nhận tài khoản trước lát L4.
- Công ty vận hành sàn:
  - Cổng báo thành công: Nợ tiền gửi ngân hàng nhận tiền cổng (như CONG_VIEC_25) / Có phải trả người nhận: cửa hàng liên kết 331 (đối tượng là cửa hàng); công ty tập đoàn 336 phải trả nội bộ (đối tượng là công ty sở hữu).
  - Lập bảng chuyển tiền: Nợ 331 hoặc 336 / Có 511 (phí sàn, vai trò mới `instore_fee_revenue`), Có 3331 (thuế); Nợ 331 hoặc 336 / Có 6418 (phí cổng thu lại).
  - Ghi đã chuyển: Nợ 331 hoặc 336 / Có tiền gửi ngân hàng (phiếu chi).
  - Hủy, hoàn tiền: ghi ngược.
- Công ty sở hữu cửa hàng tập đoàn:
  - Hóa đơn bán lẻ: dòng "Ứng dụng VComm" Nợ 136 phải thu nội bộ (đối tượng công ty vận hành sàn) / Có phải thu không đối tượng.
  - Lập bảng chuyển tiền: Nợ 641 chi phí bán hàng, Nợ 1331 / Có 136 (phí sàn, phí cổng).
  - Ghi đã chuyển: Nợ tiền gửi ngân hàng / Có 136 (phiếu thu, tự sinh cùng lúc với phiếu chi của công ty vận hành sàn).
- Hóa đơn phí sàn: công ty vận hành sàn lập một hóa đơn điện tử mỗi tháng cho mỗi người nhận, tổng phí sàn trong tháng (mục 19).

### QUYTAC_NGHIEPVU_588 – Ủy nhiệm hóa đơn: dữ liệu và điều kiện

- Dữ liệu trong hợp đồng cửa hàng liên kết: tên người bán, mã số thuế, địa chỉ, phương pháp tính thuế (khấu trừ: hóa đơn giá trị gia tăng; trực tiếp hoặc hộ kinh doanh: hóa đơn bán hàng), thuế suất mặc định, số văn bản ủy nhiệm, ngày hiệu lực, ngày hết hạn (trống: không thời hạn), tệp văn bản ủy nhiệm (PDF, tối đa 10 MB), ký hiệu hóa đơn riêng của cửa hàng theo năm.
- Lập bằng tài khoản nhà cung cấp hóa đơn của công ty vận hành sàn (CONG_VIEC_16), hóa đơn ghi người bán là cửa hàng, có dòng "Hóa đơn lập theo ủy nhiệm số … ngày …".
- Loại hóa đơn: hóa đơn điện tử có mã của cơ quan thuế lập thường (không dùng hóa đơn khởi tạo từ máy tính tiền vì gắn với đăng ký của chính người bán) (mục 19).
- Thiếu dữ liệu hoặc ủy nhiệm hết hiệu lực: vẫn bán, ghi việc chờ lập hóa đơn; khi đủ dữ liệu, người có `affiliate.manage` bấm "Lập bù".

### QUYTAC_NGHIEPVU_589 – Ủy nhiệm hóa đơn: nội dung

- Lập cho mọi giao dịch cửa hàng liên kết có thu hộ, ngay khi hoàn tất, gửi nền như hóa đơn hiện có.
- Dòng hàng: dòng do Open API gửi (tên, đơn vị, số lượng, đơn giá, thuế suất); không có thì một dòng "Hàng hóa, dịch vụ theo giao dịch số LK…" với thuế suất mặc định.
- Voucher cửa hàng phát hành: chiết khấu thương mại giảm trên hóa đơn. Tiền điểm, voucher công ty phát hành: phương thức thanh toán, không giảm doanh thu (kế toán trưởng xác nhận).
- Người mua: khách vãng lai mặc định; khách nhập tên, mã số thuế, địa chỉ trên ứng dụng trước khi thanh toán nếu cần hóa đơn có thông tin người mua.
- Khách xem, tải hóa đơn trong lịch sử giao dịch trên ứng dụng.

### QUYTAC_NGHIEPVU_590 – Open API đơn chờ thanh toán

- Khóa API phạm vi `loyalty.member` của cửa hàng liên kết (CONG_VIEC_67); thêm phạm vi `instore.checkout` do người có `affiliate.manage` gán.
- Tạo đơn: `partnerCheckoutCode` (duy nhất theo cửa hàng), `outletId`, `billAmount`, `lines` (không bắt buộc), `payCode` (luồng 1, không bắt buộc). Không có `payCode` thì trả chuỗi QR, đường dẫn thanh toán (luồng 2).
- Gắn mã động sau khi tạo: `POST …/{partnerCheckoutCode}/pay-code`.
- Tra trạng thái theo `partnerCheckoutCode` hoặc số `TT…`; liệt kê theo trạng thái, khoảng thời gian, điểm bán (tối đa 100 dòng mỗi trang). Phần mềm cửa hàng dùng tra trạng thái khi chưa nhận webhook (ví dụ hỏi mỗi 3 giây khi đang chờ khách, tối đa theo giới hạn tần suất của khóa).
- Hủy đơn chưa thanh toán: `POST …/cancel` (lý do 1 đến 500 ký tự); hoàn điểm, trả voucher, nhả giữ hàng. Khách đã mở cổng mà cổng báo thành công sau khi hủy: xử lý như QUYTAC_NGHIEPVU_579 (lập việc chờ hoàn tiền), gửi webhook `refund.completed` khi đã hoàn.
- Hủy đơn đã thanh toán và hoàn tiền: `POST …/refund` (lý do 1 đến 500 ký tự, khóa yêu cầu). Chỉ hủy toàn bộ, khi tuần đối soát điểm của giao dịch chưa chốt (QUYTAC_NGHIEPVU_400); làm như chủ cửa hàng hủy trên cổng (QUYTAC_NGHIEPVU_583): hoàn điểm, trả voucher, trừ lại điểm đã tích, ghi ngược thu hộ và phí vào bảng chuyển tiền tiếp theo, lập việc chờ hoàn tiền cho khách (kế toán chuyển khoản tay), lập việc chờ xử lý hóa đơn ủy nhiệm. Tuần đã chốt: trả `409 affiliateWeekClosed`, cửa hàng khiếu nại theo cách hiện có. Thu hộ tắt (khách trả tại quầy): chỉ hủy giao dịch điểm, không lập việc hoàn tiền; cửa hàng tự trả tiền cho khách.
- Trạng thái hoàn tiền trong kết quả tra: `none`, `pending` (chờ kế toán chuyển), `completed` (kèm ngày hoàn); webhook `refund.completed` khi kế toán ghi đã hoàn.
- Trả hàng một phần qua API: ngoài phạm vi (giữ CONG_VIEC_55).
- Kết quả: trạng thái, số `TT…`, số `LK…` khi hoàn tất, trạng thái hoàn tiền, trạng thái hủy, tiền hóa đơn, voucher, điểm, tiền thu hộ, phí, hóa đơn điện tử (ký hiệu, số, mã tra cứu khi có).

### QUYTAC_NGHIEPVU_591 – Webhook

- Mỗi khóa API có tối đa một địa chỉ nhận (HTTPS), khóa ký riêng (cấp, cấp lại hiện một lần).
- Sự kiện: `checkout.completed`, `checkout.expired`, `checkout.cancelled`, `checkout.declined`, `transaction.cancelled`, `refund.completed`.
- Gửi POST JSON, tiêu đề `X-VComm-Signature` = HMAC-SHA256(khóa ký, thời điểm + "." + thân), `X-VComm-Timestamp`, `X-VComm-Event-Id`. Đối tác trả 2xx trong 10 giây là thành công.
- Thất bại: thử lại sau 1, 5, 30 phút, 2, 6, 24 giờ; hết lượt thì dừng, ghi nhật ký. Chủ cửa hàng, người có `affiliate.manage` xem nhật ký gửi, gửi lại, gửi thử.
- Đối tác vẫn tra được trạng thái bằng API (webhook chỉ để báo sớm).

### QUYTAC_NGHIEPVU_592 – Chống gian lận và nhật ký

- Quét mã động sai: mỗi thu ngân, khóa API tối đa 10 lần mỗi giờ; vượt thì khóa quét mã động 1 giờ.
- Mở đường dẫn QR sai hoặc hết hạn: giới hạn theo người mua 20 lần mỗi giờ.
- Cảnh báo bất thường hiện có của CONG_VIEC_55 tính cả giao dịch thu hộ; thêm: một khách có từ 3 lần thanh toán sau khi đơn hết hạn hoặc bị hủy trong 7 ngày.
- Nhật ký thao tác: bật, tắt thu hộ; sửa phí; sửa dữ liệu ủy nhiệm; ghi đã chuyển; cấp, cấp lại khóa ký webhook; lập bù hóa đơn. Không ghi mã động, khóa ký.

## 6. Vai trò và quyền

| Thao tác | Quyền |
|---|---|
| Tạo, hủy đơn chờ ở quầy tập đoàn | `retail.sale` (đã có) |
| Bật nhận thanh toán qua ứng dụng, phí sàn của cửa hàng tập đoàn | Quyền cài đặt cửa hàng hiện có (MAN_HINH_166) |
| Tạo, hủy đơn chờ ở cổng cửa hàng liên kết | Thu ngân, chủ cửa hàng (vai trò cổng) |
| Bật thu hộ, phí thu hộ, tài khoản nhận tiền, dữ liệu ủy nhiệm, lập bù hóa đơn | `affiliate.manage` (đã có) |
| Biểu phí cổng | `finance.instore.manage` (mới, nhạy cảm; gán mặc định Kế toán trưởng, Quản trị công ty tại công ty vận hành sàn) |
| Xem bảng chuyển tiền | `finance.instore.view` (mới; Kế toán, Kế toán trưởng); cổng: chủ cửa hàng |
| Ghi đã chuyển | `finance.instore.manage` |
| Webhook của khóa API | `affiliate.manage`; cổng: chủ cửa hàng |
| Khách thanh toán | Người mua đã đăng nhập |

## 7. Luồng nghiệp vụ (Luồng 67)

1. Quản trị bật thu hộ, phí cho cửa hàng; công ty vận hành sàn đã bật VNPAY và biểu phí cổng.
2. Luồng 1: thu ngân lập giỏ hoặc nhập tiền → "Thanh toán qua ứng dụng" → quét mã động → ứng dụng khách hiện đơn → khách chọn điểm, voucher, cổng → trả trên VNPAY → cổng báo thành công → hệ thống ghi hóa đơn bán lẻ hoặc giao dịch `LK…`, hóa đơn điện tử → quầy hiện "Đã thanh toán", in phiếu.
3. Luồng 2: như luồng 1 nhưng màn hình cửa hàng hiện mã QR, khách quét bằng ứng dụng.
4. Open API: phần mềm cửa hàng tạo đơn → hiện QR hoặc quét mã động → nhận webhook `checkout.completed`.
5. 1 giờ sáng: lập bảng chuyển tiền ngày → kế toán chuyển khoản → ghi đã chuyển → bút toán hai bên.
6. Cuối tháng: hóa đơn phí sàn cho từng người nhận.
7. Hủy, trả hàng: hoàn điểm, lập việc chờ hoàn tiền, ghi ngược thu hộ vào bảng sau, xử lý hóa đơn.

## 8. Màn hình

Bản mẫu: `tai_lieu/ban_mau/CONG_VIEC_73_UNG_DUNG.html` (ứng dụng VComm), `tai_lieu/ban_mau/CONG_VIEC_73_QUAY_VA_CONG_CUA_HANG.html` (quầy tập đoàn, cổng cửa hàng), `tai_lieu/ban_mau/CONG_VIEC_73_QUAN_TRI.html` (web quản trị).

| Mã | Tên | Nơi | Ghi chú |
|---|---|---|---|
| MAN_HINH_276 | Mã thanh toán | Ứng dụng VComm | Từ trang chủ (nút "Thanh toán tại cửa hàng"), MAN_HINH_151; mở Smart OTP trước |
| MAN_HINH_277 | Thanh toán tại cửa hàng | Ứng dụng VComm | Đơn, voucher, điểm, cổng, thông tin hóa đơn, kết quả; dùng cho cả hai luồng |
| MAN_HINH_278 | Thanh toán qua ứng dụng tại quầy | Quầy tập đoàn (`web-retail`) | Hộp thoại từ bước thanh toán MAN_HINH_161: quét mã động hoặc hiện QR, chờ, kết quả |
| MAN_HINH_279 | Thu hộ và ủy nhiệm hóa đơn | Web quản trị (`web-crm`), thẻ trong chi tiết cửa hàng liên kết | Công tắc, phí, tài khoản nhận, dữ liệu ủy nhiệm, ký hiệu |
| MAN_HINH_280 | Biểu phí cổng tại cửa hàng | Web quản trị (`web-finance`) | Theo phương thức của cổng |
| MAN_HINH_281 | Bảng chuyển tiền thu hộ | Web quản trị (`web-finance`) | Danh sách, chi tiết, ghi đã chuyển |
| MAN_HINH_282 | Tiền thu hộ | Cổng cửa hàng (`web-affiliate`) | Bảng chuyển tiền của cửa hàng, giao dịch, hóa đơn |

Sửa màn hình đã có:
- MAN_HINH_161 Bán hàng tại quầy: phương thức "Ứng dụng VComm"; dòng điểm: nút "Quét mã thanh toán" thay ô nhập 6 số (ô nhập giữ làm dự phòng).
- MAN_HINH_166 Cài đặt cửa hàng: công tắc, phí sàn.
- MAN_HINH_163 Hóa đơn bán lẻ, MAN_HINH_167 Mẫu in: dòng thanh toán "Ứng dụng VComm".
- MAN_HINH_174 Quầy tích đổi điểm (cổng): thẻ "Hiện mã QR" và "Quét mã khách" thêm dòng tiền khách trả qua ứng dụng, trạng thái chờ thanh toán; quét mã động.
- MAN_HINH_181 Cửa hàng liên kết (ứng dụng): khung 2 chuyển sang MAN_HINH_276; khung 1 chuyển sang MAN_HINH_277.
- MAN_HINH_231, 232 Kết nối phần mềm: khối "Webhook" (địa chỉ, khóa ký, gửi thử, nhật ký gửi); phạm vi `instore.checkout`.
- MAN_HINH_98 Hoàn tiền: thêm nguồn "Thanh toán tại cửa hàng".
- MAN_HINH_180 Đối soát liên kết: liên kết sang bảng chuyển tiền thu hộ của cùng cửa hàng.

## 9. Dữ liệu

| Database migration | Bảng, cột | Nội dung |
|---|---|---|
| 0161 (L1) | Schema mới `instore` | |
| 0161 (L1) | `instore.checkouts` | `id`, `document_no` (`TT…`), `operator_company_id`, `kind` (`retail`, `affiliate`), `store_id` hoặc `merchant_id` và `outlet_id`, `register_id`, `shift_id`, `source` (`retail_counter`, `merchant_portal`, `open_api`, `ipos`), `created_by_user_id` hoặc `api_key_id`, `partner_checkout_code` (Open API, iPOS), `ipos_invoice_id` (trống, khóa ngoại thêm ở CONG_VIEC_74), `idempotency_key`, `bill_amount`, `lines` (jsonb), `collect_in_app`, `qr_token_hash`, `buyer_user_id`, `points`, `points_amount`, `voucher_code_id`, `voucher_amount`, `amount_due`, `status`, `expires_at`, `retail_sale_id`, `affiliate_transaction_id`, `platform_fee_percent`, `platform_fee`, `gateway_fee`, `payout_id`, `buyer_invoice_info` (jsonb), thời điểm; ràng buộc theo `kind`; chỉ mục duy nhất (`merchant_id`, `partner_checkout_code`) |
| 0161 (L1) | `marketplace.payments` | `order_id` cho phép trống; thêm `checkout_id`; ràng buộc đúng một trong hai |
| 0161 (L1) | `marketplace.refunds` | thêm `checkout_id`; lý do thêm `instore_cancelled` |
| 0161 (L1) | `core.smart_otp_devices` (CONG_VIEC_72 chuyển bảng sang `core`) | thêm `pay_code_prefix_hash` (duy nhất), `pay_code_issued_for` (thời điểm kích hoạt mà mã gắn với) |
| 0161 (L1) | `instore.attempt_failures` | `subject` (`scan:<thu ngân hoặc khóa API>`, `claim:<người mua>`), `failed_at`: đếm lần sai trong 60 phút (QUYTAC_NGHIEPVU_592) |
| 0162 (L2) | `retail.stores` | `app_payment_enabled`, `platform_fee_percent` |
| 0162 (L2) | `retail.sale_payments`, `retail.return_refunds` | `method` thêm `vcomm_app` (định nghĩa lại ràng buộc theo `main` mới nhất) |
| 0163 (L4) | `affiliate.merchants` | `collection_enabled`, `collection_fee_percent`, `payout_bank_account_id` |
| 0163 (L4) | `instore.gateway_fee_rates` | `company_id`, `method`, `percent`, `fixed_amount`, `effective_from` |
| 0163 (L4) | `instore.payouts` | `document_no` (`CT…`), `operator_company_id`, `recipient_kind`, `recipient_company_id` hoặc `merchant_id`, `business_date`, G, H, I, K, L, M, N, `amount`, `status`, `transferred_on`, `bank_transaction_no`, bút toán, phiếu chi, phiếu thu; duy nhất (người nhận, ngày) |
| 0163 (L4) | `instore.payout_deductions` | `id`, `payout_id` (trống khi chưa vào bảng), người nhận, `business_date`, `kind` (`ipos_subscription`), `amount` (> 0), `reference_id`, `note`; chỉ mục (người nhận, `business_date`). Dòng do CONG_VIEC_74 ghi |
| 0163 (L4) | `affiliate.transactions` | `collected_amount`, `platform_fee`, `gateway_fee`, `checkout_id`; `source` thêm `ipos` |
| 0163 (L4) | `affiliate.api_keys` | `webhook_url`, `webhook_secret_encrypted`; bảng `affiliate.webhook_deliveries` |
| 0164 (L6) | `affiliate.merchant_einvoice_mandates` | dữ liệu QUYTAC_NGHIEPVU_588, tệp, ký hiệu theo năm |
| 0164 (L6) | `finance.einvoices` | `source_document_id` cho phép trống; thêm `affiliate_transaction_id`, `mandate_id`; ràng buộc đúng một nguồn; chỉ mục duy nhất hóa đơn gốc theo giao dịch |
| 0164 (L6) | `finance.einvoice_series` | thêm `merchant_id` (ký hiệu riêng theo cửa hàng) |

Nguồn chứng từ mới cho bút toán: `instore_checkout`, `instore_payout`. Vai trò tài khoản mới: `instore_fee_revenue`, `instore_payable_internal`, `instore_receivable_internal`.

## 10. API

Ứng dụng VComm (người mua):

| Mã | Phương thức, đường dẫn | Mô tả |
|---|---|---|
| API_327 | `POST /buyer/instore/pay-code` (cấp mã thanh toán của thiết bị); `GET /buyer/instore/checkouts/pending`; `POST /buyer/instore/checkouts/claim` (`token`); `GET /buyer/instore/checkouts/{id}`; `POST /buyer/instore/checkouts/{id}/pay` (`points`, `voucherCodeId`, `method`, `invoiceInfo`, `smartOtp`); `POST /buyer/instore/checkouts/{id}/decline` | Đơn đang chờ mình (luồng 1), nhận đơn từ QR (luồng 2), xem, thanh toán (trả hướng dẫn cổng hoặc hoàn tất ngay), từ chối. Cấp mã thanh toán chỉ cho thiết bị đang giữ Smart OTP, không cho bản web; không sửa API_199 của CONG_VIEC_72 |

Nhân viên, cổng cửa hàng (gốc `/api/v1`):

| Mã | Phương thức, đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| API_328 | `POST /retail/checkouts`; `GET /retail/checkouts/{id}`; `POST /retail/checkouts/{id}/pay-code`; `POST /retail/checkouts/{id}/cancel`; `POST /retail/checkouts/{id}/retry-posting` | `retail.sale`; ghi lại: `retail.shift.manage` | Đơn chờ ở quầy tập đoàn |
| API_329 | `POST /merchant-portal/checkouts`; `GET …/{id}`; `POST …/{id}/pay-code`; `POST …/{id}/cancel` | Thu ngân, chủ cửa hàng | Đơn chờ ở cổng cửa hàng |
| API_331 | `PUT /affiliate/api-keys/{id}/webhook`; `POST …/webhook/rotate-secret`, `…/webhook/test`; `GET …/webhook/deliveries`; `POST /affiliate/webhook-deliveries/{id}/resend`; tương ứng ở `/merchant-portal/api-keys/…` | `affiliate.manage`; cổng: chủ cửa hàng | Webhook |
| API_332 | `PATCH /affiliate/merchants/{id}/collection`; `GET`, `PUT /finance/instore/gateway-fees` | `affiliate.manage`; `finance.instore.manage` | Cài đặt thu hộ, biểu phí cổng. Công tắc, phí của cửa hàng tập đoàn đi theo API cài đặt cửa hàng hiện có |
| API_333 | `GET /finance/instore/payouts`, `GET …/{id}`, `POST …/{id}/transferred`; `GET /merchant-portal/payouts`, `GET …/{id}` | `finance.instore.view`, `finance.instore.manage`; cổng: chủ cửa hàng | Bảng chuyển tiền |
| API_334 | `GET`, `PUT /affiliate/merchants/{id}/einvoice-mandate`; `POST …/einvoice-mandate/file`; `POST /affiliate/transactions/{id}/einvoice` (lập bù) | `affiliate.manage` | Ủy nhiệm hóa đơn |

Open API (khóa phạm vi `instore.checkout`, gốc `/api/v1/open/affiliate`):

| Mã | Phương thức, đường dẫn | Mô tả |
|---|---|---|
| API_330 | `POST /checkouts`; `POST /checkouts/{partnerCheckoutCode}/pay-code`; `GET /checkouts`, `GET /checkouts/{partnerCheckoutCode}` (hoặc số `TT…`); `POST /checkouts/{partnerCheckoutCode}/cancel` (chưa thanh toán); `POST /checkouts/{partnerCheckoutCode}/refund` (đã thanh toán: hủy toàn bộ, hoàn tiền) | QUYTAC_NGHIEPVU_590 |

Kết quả cổng thanh toán: dùng đường dẫn nhận kết quả chung hiện có; bộ xử lý tìm lần thanh toán theo số tham chiếu rồi rẽ theo đơn VComm hoặc đơn chờ tại cửa hàng.

## 11. Dùng lại mã đã có

| Việc | Mã dùng lại | Thay đổi |
|---|---|---|
| Smart OTP, kiểm mã | `loyalty/smart-otp.service.ts` (bản sau CONG_VIEC_72) | Thêm tìm thiết bị theo mã thanh toán |
| Cổng thanh toán | `marketplace/payments/*` (khung, VNPAY, đường dẫn nhận kết quả, việc chờ hoàn tiền) | Sổ thanh toán nhận đơn chờ tại cửa hàng |
| Bán tại quầy | `retail` (ghi hóa đơn bán lẻ, giá, khuyến mãi, hóa đơn máy tính tiền) | Tách hàm ghi để gọi từ bộ xử lý kết quả cổng |
| Giữ hàng | `inventory` giữ hàng | Nguồn giữ mới `instore_checkout` |
| Giao dịch, voucher, đối soát cửa hàng liên kết | `affiliate/transactions.service.ts`, `vouchers.service.ts`, `settlements.service.ts`, `postings.ts` | Giao dịch nhận thêm thu hộ; dư nợ trừ thu hộ chờ chuyển |
| Open API | `open-api/api-key.guard.ts`, nhật ký gọi | Phạm vi mới |
| Hóa đơn điện tử | `einvoice` (lập, gửi nền, bộ giả lập, việc chờ xử lý) | Nguồn giao dịch cửa hàng liên kết, người bán theo ủy nhiệm |
| Bút toán, phiếu thu chi, nợ nội bộ | `accounting`, `finance` | Nguồn chứng từ mới |
| Việc nền | `jobs` | Lập bảng chuyển tiền, gửi webhook, hết hạn đơn |
| Quét mã | `jsQR` (đã duyệt, CONG_VIEC_55), `expo-camera` | Không thêm thư viện |
| Vẽ mã | `qrcode-generator` (đã có) | Mã vạch Code 128 tự vẽ bằng SVG theo bảng mã chuẩn (khoảng 100 dòng) |

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_73 – 2026-11-17

- Nguồn đã tìm: mã nguồn dự án; nguồn riêng V-com-ERP (phiên điều phối đọc: không có mã iPOS; có nguyên mẫu `/api/ipos/*`, `/api/openapi/*`, mô tả xác thực QR TOTP 30 giây, webhook `pickup.completed`, đối soát thu hộ T+1; không có tệp LICENSE, chất lượng thấp).

| Ứng viên | Nguồn | Giấy phép | Tương thích | Công sức |
|---|---|---|---|---|
| Khung cổng, sổ thanh toán, Smart OTP, giao dịch cửa hàng liên kết, hóa đơn điện tử của dự án | Dự án | Của dự án | Đầy đủ | Trung bình |
| Nguyên mẫu V-com-ERP | Nguồn riêng | Không có tệp giấy phép | Khác kiến trúc | Chỉ tham khảo ý (webhook, đối soát T+1) |
| Thư viện vẽ mã vạch (`jsbarcode`) | npm | MIT | Được | Thấp, nhưng thêm phụ thuộc cho một loại mã |
| Chia tiền tại cổng | Nhà cung cấp cổng | Hợp đồng | Chưa xác minh | Ngoài phạm vi |

- Đề xuất: dùng mã của dự án; tự vẽ Code 128 bằng SVG, không thêm thư viện. Người dùng muốn dùng `jsbarcode` thì duyệt thêm thư viện.

## 13. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_546 | Mã động: chỉ hiện sau khi mở Smart OTP; đổi mỗi 30 giây, không cần mạng; QR và Code 128 cùng nội dung; máy chủ nhận bước hiện tại, lệch một bước, mỗi bước một lần; sai 5 lần khóa 15 phút; không chứa thông tin cá nhân | Bắt buộc |
| TIEUCHI_NGHIEMTHU_547 | Đơn chờ: tạo đúng nội dung, khóa yêu cầu không tạo trùng, hạn 10 phút, giữ hàng và nhả khi hết hạn, hủy, từ chối; giới hạn đơn chờ; chặn đóng ca khi còn đơn chờ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_548 | Luồng 1: quét mã động gắn khách, ứng dụng tự hiện đơn; một đơn một khách | Bắt buộc |
| TIEUCHI_NGHIEMTHU_549 | Luồng 2: QR mở đúng đơn trên ứng dụng; người thứ hai bị chặn; mã hết hạn bị chặn | Bắt buộc |
| TIEUCHI_NGHIEMTHU_550 | Khách chọn điểm, voucher trong giới hạn hiện có; cần mở Smart OTP khi dùng điểm; khóa dùng điểm sau khôi phục; trả hết bằng điểm hoàn tất ngay | Bắt buộc |
| TIEUCHI_NGHIEMTHU_551 | Thanh toán qua cổng: chỉ nhận kết quả có chữ ký, đúng số tiền, một lần; hết hạn hoàn điểm, voucher; thanh toán sau hết hạn lập việc chờ hoàn tiền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_552 | Cửa hàng tập đoàn: hóa đơn bán lẻ, đơn bán, phiếu xuất, bút toán, hóa đơn máy tính tiền, điểm đúng; dòng "Ứng dụng VComm" không vào tiền ca; lỗi ghi sổ chuyển trạng thái chờ xử lý | Bắt buộc |
| TIEUCHI_NGHIEMTHU_553 | Cửa hàng liên kết: giao dịch `LK…` đúng tiền thu hộ, phí; thu hộ tắt thì như cũ; công tắc mặc định tắt, có xác nhận khi bật | Bắt buộc |
| TIEUCHI_NGHIEMTHU_554 | Phí sàn, phí cổng, bảng chuyển tiền ngày đúng công thức (gồm khoản trừ khác N), mang số âm sang, ghi ngược hủy; ghi đã chuyển lập phiếu chi, phiếu thu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_555 | Bút toán hai công ty đúng tài khoản; hóa đơn phí sàn tháng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_556 | Dư nợ cửa hàng liên kết trừ tiền thu hộ chờ chuyển | Bắt buộc |
| TIEUCHI_NGHIEMTHU_557 | Hóa đơn ủy nhiệm: đúng người bán, ký hiệu riêng, dòng ủy nhiệm, dòng hàng, điểm là phương thức thanh toán; thiếu dữ liệu ghi việc chờ, lập bù được; hủy giao dịch tạo việc chờ xử lý hóa đơn | Bắt buộc |
| TIEUCHI_NGHIEMTHU_558 | Open API và webhook: tạo, gắn mã, tra trạng thái, hủy chưa thanh toán, hủy đã thanh toán và hoàn tiền (chỉ khi tuần chưa chốt), trạng thái hoàn tiền; webhook có chữ ký, thử lại theo lịch, gửi lại, gửi thử; phạm vi khóa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_559 | Giao diện ứng dụng, quầy, cổng, quản trị chạy được trên bản xem trước; phân quyền từng màn hình | Bắt buộc |

## 14. Kịch bản kiểm thử

| Mã | Nội dung | Tiêu chí | Loại |
|---|---|---|---|
| KICHBAN_KIEMTHU_750 | Mã động đúng, lệch một bước, dùng lại, sai 5 lần, thiết bị đã chuyển, khách đang khóa dùng điểm | 546 | Tự động |
| KICHBAN_KIEMTHU_751 | Mã thành viên cũ trong và sau thời hạn chuyển đổi | 546 | Tự động |
| KICHBAN_KIEMTHU_752 | Tạo đơn chờ quầy: giá, khuyến mãi, giữ hàng, trùng khóa, quầy đã có đơn chờ, ca đóng | 547 | Tự động |
| KICHBAN_KIEMTHU_753 | Hết hạn, hủy, từ chối: nhả giữ hàng, hoàn điểm, voucher | 547 | Tự động |
| KICHBAN_KIEMTHU_754 | Luồng 1: quét đúng, đơn đã có khách, quét sai vượt giới hạn | 548 | Tự động |
| KICHBAN_KIEMTHU_755 | Luồng 2: nhận đơn, người thứ hai, mã hết hạn, giới hạn mở sai | 549 | Tự động |
| KICHBAN_KIEMTHU_756 | Chọn điểm: dưới tối thiểu, vượt tối đa, có voucher, không mở Smart OTP, khách chưa kích hoạt trong và sau thời hạn, trả hết bằng điểm | 550 | Tự động |
| KICHBAN_KIEMTHU_757 | Kết quả cổng: sai chữ ký, sai số tiền, gửi trùng, thất bại rồi thử lại, thành công sau hết hạn | 551 | Tự động |
| KICHBAN_KIEMTHU_758 | Hoàn tất tập đoàn: chứng từ, tồn kho, bút toán, hóa đơn máy tính tiền, tiền ca; kỳ khóa rồi ghi lại; hủy và hoàn tiền | 552 | Tự động |
| KICHBAN_KIEMTHU_759 | Hoàn tất cửa hàng liên kết: thu hộ bật, tắt; cách thu tại quầy; phân quyền cổng | 553 | Tự động |
| KICHBAN_KIEMTHU_760 | Bảng chuyển tiền: nhiều giao dịch, phí, thuế, hủy sau khi lập, số âm mang sang, khoản trừ khác N (dòng thử trong bảng khoản trừ), ghi đã chuyển, lập trùng ngày | 554 | Tự động |
| KICHBAN_KIEMTHU_761 | Bút toán hai công ty, hóa đơn phí tháng | 555 | Tự động |
| KICHBAN_KIEMTHU_762 | Dư nợ trừ thu hộ chờ chuyển, xét hạn mức tích điểm | 556 | Tự động |
| KICHBAN_KIEMTHU_763 | Hóa đơn ủy nhiệm: đủ dữ liệu, thiếu, hết hiệu lực, lập bù, dòng từ API, một dòng mặc định, hủy | 557 | Tự động |
| KICHBAN_KIEMTHU_764 | Open API: phạm vi khóa, tạo, mã đối tác trùng, gắn mã động, tra theo mã đối tác và số `TT…`, liệt kê, hủy chưa thanh toán, hủy khi cổng đang xử lý, hoàn tiền đã thanh toán (tuần chưa chốt, đã chốt, thu hộ tắt, gửi trùng khóa), trạng thái hoàn tiền | 558 | Tự động |
| KICHBAN_KIEMTHU_765 | Webhook: chữ ký, thử lại theo lịch, dừng sau hết lượt, gửi lại, gửi thử, đổi khóa ký | 558 | Tự động |
| KICHBAN_KIEMTHU_766 | Phân quyền: thu ngân, chủ cửa hàng, `affiliate.manage`, `finance.instore.*`, người mua khác | 559 | Tự động |
| KICHBAN_KIEMTHU_767 | Giao diện: ứng dụng (mã, đơn, kết quả), quầy, cổng, quản trị trên bản xem trước | 559 | Thủ công, ảnh xem trước |

## 15. Ràng buộc kỹ thuật

- Ghi nhận tiền, hoàn tất đơn, ghi hóa đơn bán lẻ hoặc giao dịch `LK…`, điểm, bút toán trong một giao dịch cơ sở dữ liệu; khóa đơn `FOR UPDATE`.
- Mã thanh toán của thiết bị: lưu băm HMAC-SHA256 với khóa máy chủ; ứng dụng giữ trong bộ nhớ an toàn cùng khóa Smart OTP.
- Khóa ký webhook mã hóa bằng `secret-box` hiện có.
- Ứng dụng hỏi trạng thái mỗi 2 giây khi đang mở màn hình mã hoặc đơn; dừng khi rời màn hình.
- Số tiền làm tròn đến đồng; mọi giờ theo giờ Việt Nam.
- Không thêm thư viện (mục 12).
- Service dùng chung trong backend (người dùng duyệt 2026-11-17 cho CONG_VIEC_74 gọi thẳng, không qua khóa Open API): `InstoreCheckoutService` với `create`, `attachPayCode`, `get`, `list`, `cancel`, `refund`, nhận tác nhân thống nhất (thu ngân quầy, thành viên cổng, khóa API, thu ngân iPOS kèm điểm bán `affiliate.outlets`). Controller của quầy, cổng, Open API và iPOS chỉ kiểm quyền rồi gọi service; quy tắc nghiệp vụ, khóa yêu cầu, giới hạn đơn chờ nằm trong service. Webhook là cách báo cho phần mềm ngoài; iPOS trong backend nhận kết quả qua sự kiện nội bộ `instore.checkout.*` (cùng nội dung webhook).

## 16. Thành phần không được thay đổi

- Luồng đặt hàng VComm và thanh toán đơn VComm.
- Cách 3 (số điện thoại kèm xác nhận) của cửa hàng liên kết.
- Bán tại quầy bằng tiền mặt, chuyển khoản VietQR; hóa đơn máy tính tiền của công ty tập đoàn.
- Bảng đối soát điểm tuần, công thức A đến F của cửa hàng liên kết.
- Quy tắc xác thực của CONG_VIEC_72 (chỉ đọc, dùng lại).

## 17. Quyết định của người dùng (2026-11-17)

| Câu | Quyết định |
|---|---|
| Áp cho | Cửa hàng tập đoàn (quầy CONG_VIEC_53), cửa hàng liên kết dùng iPOS, cửa hàng liên kết dùng cổng VComm và Open API |
| Thanh toán | Trong ứng dụng VComm qua cổng đã có; VNPAY làm trước |
| iPOS | Xây mới dạng ứng dụng riêng, thuê bao theo cửa hàng, tách công việc riêng sau CONG_VIEC_73; CONG_VIEC_73 chỉ làm phía VComm iPOS cần (Open API đơn chờ, QR, webhook, thu hộ, hóa đơn ủy nhiệm) |
| Hai luồng | Cho cả ba loại cửa hàng |
| Ai chọn điểm (luồng 1) | Khách chọn trên ứng dụng |
| Tiền về đâu | Thu một nơi (công ty vận hành sàn) rồi chia: phí về công ty vận hành sàn, phần còn lại về công ty sở hữu cửa hàng hoặc cửa hàng liên kết; áp chung cả hai loại |
| Phí, kỳ chuyển | Phí tỷ lệ phần trăm theo cửa hàng; chuyển theo ngày; tiền chuyển = thu hộ − phí sàn − phí cổng |
| Hóa đơn | Cửa hàng tập đoàn như CONG_VIEC_53; VComm lập thay cửa hàng liên kết theo ủy nhiệm bằng tài khoản nhà cung cấp hóa đơn của VComm, ký hiệu riêng mỗi cửa hàng, lập cho mọi giao dịch thanh toán trong ứng dụng; thiếu dữ liệu vẫn bán, ghi việc chờ lập bù |
| Điểm trên hóa đơn | Phương thức thanh toán (kế toán trưởng xác nhận) |
| Hủy có hóa đơn | Ghi việc chờ xử lý hóa đơn |
| Công tắc thu hộ | Theo cửa hàng, mặc định tắt đến khi người dùng xác nhận hồ sơ pháp lý |
| Dư nợ | Tiền thu hộ chờ chuyển trừ vào dư nợ |
| Hủy trước chốt tuần | Hoàn tiền tay |
| Mã động | Sinh từ Smart OTP, QR và Code 128; giữ nhập 6 số làm dự phòng; mã thành viên cũ còn nhận trong thời hạn chuyển đổi |
| Quy tắc điểm, tích điểm | Giữ như hiện có |
| Trả hàng tập đoàn | Hoàn tiền mặt hoặc chuyển khoản tay |
| Mất mạng, khách chưa có ứng dụng | Giữ như hiện nay |
| Open API cho iPOS | Tra trạng thái, hủy đơn chưa thanh toán, hủy toàn bộ đơn đã thanh toán kèm hoàn tiền; trả một phần hàng cho đơn trả bằng ứng dụng để sau, ngoài phạm vi |

## 18. Các lát và điểm xem trước

Viết mã sau khi CONG_VIEC_72 hợp nhất vào `main`.

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L0 | Đặc tả, bản mẫu (lần này) | Người dùng duyệt |
| L1 | Database migration 0161; mã thanh toán động (ứng dụng, kiểm ở máy chủ); khung đơn chờ, sổ thanh toán nhận đơn chờ; API_327 | Ứng dụng hiện mã thanh toán; gọi thử kiểm mã |
| L2 | Database migration 0162; quầy tập đoàn luồng 1, 2 (API_328, MAN_HINH_278, sửa 161, 166); ứng dụng MAN_HINH_277; VNPAY môi trường thử nghiệm hoặc bộ giả lập | Bán tại quầy, khách trả trên ứng dụng, in hóa đơn |
| L3 | Quét mã động thay nhập 6 số khi dùng điểm tại quầy (cách thu tại quầy) | Dùng điểm tại quầy bằng quét mã |
| L4 | Database migration 0163; thu hộ cửa hàng liên kết trên cổng (API_329, 332, sửa 174, MAN_HINH_279, 280); phí; dư nợ | Cổng cửa hàng bán qua ứng dụng, giao dịch có thu hộ |
| L5 | Bảng chuyển tiền ngày, hạch toán hai công ty, hóa đơn phí tháng (API_333, MAN_HINH_281, 282) | Lập bảng, ghi đã chuyển, xem sổ cái |
| L6 | Database migration 0164; hóa đơn ủy nhiệm (API_334, MAN_HINH_279 phần ủy nhiệm) | Giao dịch có hóa đơn ủy nhiệm trên bộ giả lập |
| L7 | Open API đơn chờ, webhook (API_330, 331, sửa 231, 232) | Gọi thử API, nhận webhook ở máy nhận thử |

### Kết quả lát L1 (2026-11-17)

- Database migration 0161: schema `instore`, `instore.checkouts`, `instore.attempt_failures`; mã thanh toán trên `core.smart_otp_devices`; `marketplace.payments`, `marketplace.refunds` nhận đơn chờ.
- Máy chủ: `apps/api/src/instore/pay-code.service.ts` (cấp mã, đọc mã 18 số, giới hạn quét sai), `checkouts.service.ts` (`InstoreCheckoutsService`: tạo, gắn khách bằng mã động hoặc QR, khách xem, từ chối, hủy, hết hạn; việc nền mỗi phút), `buyer-instore.controller.ts` (API_327 phần L1).
- Ứng dụng: MAN_HINH_276 `apps/mobile-vcomm/src/app/ma-thanh-toan.tsx`, `lib/pay-code.ts` (mã thanh toán, Code 128 bộ C vẽ bằng `react-native-svg` đã có); lối vào ở trang chủ.
- Kiểm thử: `apps/api/test/c73-instore-checkouts.test.ts` (KICHBAN_KIEMTHU_750; phần khung của 753 đến 755).
- Chưa làm ở L1 (theo kế hoạch): thanh toán qua cổng, chọn điểm, voucher (L2); nút "Quét mã cửa hàng" và tăng độ sáng màn hình (cần thư viện `expo-brightness`, chưa đề xuất thêm); MAN_HINH_277.

### Kết quả lát L2 (2026-11-17)

- Database migration 0162: `retail.stores` thêm `app_payment_enabled`, `platform_fee_percent` (0 đến 10); `retail.sale_payments` nhận phương thức `vcomm_app` và `checkout_id`; `instore.checkouts` thêm `sale_input`, `reserved_sale_id`, `paid_amount`, `paid_at`, `posting_error`, trạng thái `paid_unposted`.
- Máy chủ: `apps/api/src/retail/retail-checkouts.service.ts` (API_328: tạo đơn chờ từ giỏ và giữ hàng, gắn mã thanh toán, hủy, ghi lại hóa đơn; bộ xử lý loại `retail`); `InstoreCheckoutsService` thêm thanh toán (điểm, Smart OTP khi đơn mở từ mã QR, mở cổng), nhận kết quả cổng qua sổ thanh toán, hoàn tất trong điểm lưu giao dịch, hủy có hoàn tiền, chặn đóng ca khi còn đơn chờ; `RetailSalesService.recordWithin` ghi hóa đơn bán lẻ từ đơn chờ; API_327 thêm thanh toán.
- Giao diện quầy: MAN_HINH_278 `apps/web-retail/src/components/AppPaymentDialog.tsx`; nút "Thanh toán qua ứng dụng VComm" ở MAN_HINH_161; cài đặt cửa hàng (MAN_HINH_166) bật nhận thanh toán qua ứng dụng và phần trăm phí sàn.
- Ứng dụng: MAN_HINH_277 `apps/mobile-vcomm/src/app/thanh-toan-cua-hang/[id].tsx`; nút "Quét mã cửa hàng" (`quet-ma-cua-hang.tsx`, dùng `expo-camera` đã có); đường dẫn mã QR `tt/[token].tsx`; MAN_HINH_276 tự mở đơn khi thu ngân quét xong.
- Kiểm thử: `apps/api/test/c73-instore-retail.test.ts` (KICHBAN_KIEMTHU_752, 753, 756 đến 758; hai yêu cầu tạo đơn cùng lúc).
- Lệch so với đặc tả, cần người dùng biết:
  - Điểm bị trừ khi khách bấm thanh toán (gắn với số hóa đơn dành sẵn), hoàn lại khi đơn hết hạn, bị hủy hoặc cổng không thành công đến hết hạn.
  - Hạch toán phần tiền khách trả qua ứng dụng (phải thu nội bộ, bút toán nhận tiền cổng của công ty vận hành) làm ở L5; đến lúc đó khoản phải thu phần này còn treo chưa đối trừ.
  - Trả hàng hóa đơn có phần trả qua ứng dụng: hoàn phần tiền này vẫn làm tay; báo cáo ca chưa tách dòng "Qua ứng dụng VComm".
  - Voucher trên MAN_HINH_277 chưa làm (người dùng dời sang L4 cùng cửa hàng liên kết).
  - Nút tăng độ sáng màn hình ở MAN_HINH_276: lệnh cài `expo-brightness` bị hệ thống kiểm soát quyền của phiên con chặn; phiên điều phối cài theo yêu cầu người dùng, nút làm ở L3.

### Kết quả lát L3 (2026-11-17)

- Hóa đơn bán lẻ (API_196) nhận `customer.payCode` (18 số) thay `customer.smartOtp` khi dùng điểm; gửi cả hai bị từ chối. Máy chủ đọc mã như luồng 1 (giới hạn quét sai của thu ngân, bộ đếm sai Smart OTP của khách, mỗi bước 30 giây dùng một lần); mã của người khác báo "Mã thanh toán vừa quét không phải của khách đang chọn".
- MAN_HINH_161: dòng điểm mặc định là ô "Mã thanh toán của khách" cho máy quét (Enter của máy quét không gửi hộp thoại); nút "Khách không quét được mã: nhập mã Smart OTP 6 số" chuyển sang ô 6 số dự phòng và ngược lại.
- Khách vẫn được chọn bằng số điện thoại (F3) như trước. Không định danh khách bằng mã quét ở ô F3: mã chỉ dùng được một lần mỗi bước 30 giây, định danh xong thì khách phải đổi mã mới mới dùng được điểm.
- Kiểm thử: thêm vào `apps/api/test/c73-instore-retail.test.ts` (mã đúng, mã dùng lại, mã của khách khác, mã sai, gửi cả hai loại mã, ô 6 số dự phòng).
- Nút "Tăng độ sáng" trên MAN_HINH_276 (thư viện `expo-brightness` 58.0.2, người dùng duyệt, ghi tài liệu 13 mục 13): đặt độ sáng tối đa cho riêng màn hình ứng dụng, bấm lại hoặc rời màn hình thì trả độ sáng cũ; bản web không có nút.
- Người dùng chọn (2026-11-17): voucher trên MAN_HINH_277 làm ở L4 cùng cửa hàng liên kết, vì quầy tập đoàn chưa có voucher.

## 19. Điểm AI đề xuất cần người dùng duyệt

1. Đơn chờ hết hạn sau 10 phút; giữ hàng tại quầy tập đoàn trong thời gian chờ.
2. Mỗi quầy tập đoàn một đơn chờ; mỗi thu ngân cửa hàng liên kết ba đơn chờ.
3. Trong một đơn, phần trả trong ứng dụng là toàn bộ phần còn lại; không kết hợp với tiền mặt tại quầy.
4. Phí cổng tính theo biểu phí cài đặt tại thời điểm thanh toán; chênh lệch với phí thực tế do công ty vận hành sàn chịu hoặc hưởng (phí thực tế chỉ biết khi có tệp đối soát cổng).
5. Tiền điểm không tính phí sàn.
6. Bảng chuyển tiền ngày tách khỏi bảng đối soát điểm tuần, không bù trừ tự động. Phương án khác: trừ số cửa hàng còn nợ quá hạn của bảng tuần vào tiền chuyển ngày.
7. Tiền chuyển âm (do hủy) mang sang bảng sau, không đòi cửa hàng trả lại ngay.
8. Kế toán chuyển khoản tay rồi ghi đã chuyển; cảnh báo khi chờ quá 2 ngày làm việc.
9. Hóa đơn phí sàn lập một lần mỗi tháng cho mỗi người nhận (không lập theo ngày).
10. Hóa đơn ủy nhiệm dùng hóa đơn có mã của cơ quan thuế lập thường, không dùng hóa đơn khởi tạo từ máy tính tiền.
11. Voucher cửa hàng phát hành là chiết khấu trên hóa đơn; voucher công ty phát hành là phương thức thanh toán.
12. Dùng điểm trong luồng 2 cần mở Smart OTP; khách chưa kích hoạt trong thời hạn chuyển đổi vẫn dùng được như cách 1 hiện nay.
13. Lỗi ghi sổ sau khi đã thu tiền ở cửa hàng tập đoàn: trạng thái chờ xử lý, Cửa hàng trưởng ghi lại hoặc hủy và hoàn tiền.
14. Webhook thử lại 6 lần trong khoảng 32 giờ.
15. Tài khoản kế toán ở QUYTAC_NGHIEPVU_587 (331, 336, 136, 511, 6418, 641): kế toán trưởng xác nhận trước lát L4.
16. Tự vẽ mã vạch Code 128, không thêm thư viện.

## 20. Rủi ro và điểm chưa xác định

- Trung gian thanh toán: công ty vận hành sàn giữ tiền của cửa hàng liên kết. Phiên làm việc không tra cứu pháp lý. Không bật thu hộ cửa hàng liên kết trên môi trường thật khi người dùng chưa xác nhận hồ sơ pháp lý (công tắc mặc định tắt).
- Ủy nhiệm lập hóa đơn: người dùng xác nhận tính hợp lệ của việc dùng tài khoản nhà cung cấp hóa đơn của VComm và thủ tục thông báo với cơ quan thuế.
- VNPAY chưa thử với tài khoản môi trường thử nghiệm (giới hạn đã biết của CONG_VIEC_25); lát L2 dùng bộ giả lập nếu chưa có khóa.
- Phụ thuộc CONG_VIEC_72: nếu đặc tả CONG_VIEC_72 đổi cách lưu khóa Smart OTP trên máy, cập nhật QUYTAC_NGHIEPVU_574 trước khi làm L1.
- Ứng dụng iPOS: công việc riêng (CONG_VIEC_74), gọi service đơn chờ trong backend (mục 15); phí thuê bao iPOS trừ vào bảng chuyển tiền qua `instore.payout_deductions` do CONG_VIEC_74 ghi.
