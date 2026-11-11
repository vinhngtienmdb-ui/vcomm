# CONG_VIEC_55: Cửa hàng liên kết phần 1 (MODULE_12)

- Mô tả: Cửa hàng ngoài tập đoàn ký hợp đồng liên kết với công ty vận hành sàn; khách tích, đổi điểm tại quầy bằng mã QR động (cửa hàng hiện hoặc khách hiện) hoặc số điện thoại kèm xác nhận trên ứng dụng VComm; voucher do cửa hàng hoặc công ty phát hành; đối soát hằng tuần có bù trừ, hạn mức nợ; hạch toán; báo cáo cửa hàng, cảnh báo bất thường. Cổng cửa hàng mới (`apps/web-affiliate`), màn hình quản trị trong `apps/web-crm`, màn hình khách trong `apps/mobile-vcomm`.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả và bản mẫu.
- Nguồn: tài liệu `04` (cửa hàng liên kết là cửa hàng ngoài hệ thống; điểm đối soát được với từng đối tác), `05` mục 2.3 (cửa hàng mua điểm tặng khách, được trả tiền khi khách dùng điểm; đăng nhập Zalo; mã QR động tại quầy; hạn mức theo cửa hàng; cảnh báo giao dịch bất thường), `12` mục 1 (cổng cửa hàng trên web, máy tính bảng), THAY_DOI_01 (cửa hàng đăng nhập bằng Zalo); CONG_VIEC_51 (sổ cái điểm, hạng, chống gian lận, nguồn chứng từ chung, nợ nội bộ); quyết định của người dùng ngày 2026-11-11 (mục 17).
- Mức: Lớn (module mới, schema mới `affiliate`, ứng dụng web mới, sửa ràng buộc schema `loyalty`, `finance`, `accounting`, thêm thư viện).
- Phụ thuộc: CONG_VIEC_51 (sổ cái điểm) có trong bản phát hành 0.5.0. Chỉ lập trình sau khi 0.5.0 vào `main`.

## 1. Mục tiêu

Khách VComm tích và dùng điểm khi mua tại cửa hàng liên kết; cửa hàng có thêm khách quay lại; công ty vận hành sàn kiểm soát được rủi ro tiền điểm với từng cửa hàng qua hạn mức, đối soát tuần và hạch toán.

## 2. Phạm vi

Trong phạm vi:
- Hợp đồng cửa hàng liên kết với đối tác ngoài tập đoàn (`crm.partners` không phải công ty con): tỷ lệ tích riêng, tỷ lệ phí dịch vụ, hạn mức nợ, trần mỗi giao dịch, hạn thanh toán; nhiều điểm bán; tài khoản chủ cửa hàng, thu ngân.
- Giao dịch tại quầy: tích điểm, dùng điểm, dùng voucher trong một giao dịch; ba cách định danh khách: mã QR động của cửa hàng, mã QR động của khách, số điện thoại kèm xác nhận trên ứng dụng.
- Hủy giao dịch trước khi chốt tuần.
- Voucher ba loại: cửa hàng phát hành đổi bằng điểm, cửa hàng tặng miễn phí, công ty phát hành dùng tại mọi cửa hàng; mọi voucher qua duyệt.
- Đối soát hằng tuần có bù trừ; cửa hàng xác nhận hoặc khiếu nại; công nợ; chặn tích khi vượt hạn mức hoặc quá hạn thanh toán.
- Hạch toán ở công ty vận hành sàn.
- Báo cáo cửa hàng (cổng cửa hàng), báo cáo và cảnh báo bất thường (công ty).

Ngoài phạm vi: cửa hàng của công ty con trong tập đoàn (dùng bán lẻ tại quầy CONG_VIEC_53); khách chưa có tài khoản VComm (không tích tạm theo số điện thoại); trả hàng một phần; kết nối phần mềm bán hàng của cửa hàng qua API; thông báo đẩy về điện thoại; nhà bán trên sàn mua điểm (MODULE_09, công việc sau); thanh toán tiền hóa đơn của khách qua VComm (khách trả tiền cho cửa hàng như thường lệ).

## 3. Phân biệt với phần đã có (không trùng)

| Đối tượng | Bản chất | Nguồn |
|---|---|---|
| Bán lẻ tại quầy | Quầy của công ty con trong tập đoàn, có kho, hóa đơn, kế toán của công ty con; điểm qua `LoyaltyLedgerService` | CONG_VIEC_53 (giữ nguyên) |
| Sổ cái điểm, chương trình, hạng | Ví điểm, lô, bút toán chỉ thêm, giai đoạn, hạng | CONG_VIEC_51 (dùng lại, thêm nguồn chứng từ) |
| Khuyến mãi đơn bán | Chương trình giảm giá áp vào đơn bán của công ty | CONG_VIEC_12 (giữ nguyên) |
| Cửa hàng liên kết (mới) | Cửa hàng ngoài tập đoàn; VComm không ghi doanh thu bán hàng của cửa hàng, chỉ ghi tiền điểm, voucher, phí | Công việc này |

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_118: Công ty vận hành sàn quản lý cửa hàng liên kết: hợp đồng, điểm bán, tài khoản chủ cửa hàng và thu ngân.
- YCAU_NGHIEPVU_119: Khách VComm tích điểm khi mua tại cửa hàng liên kết theo tỷ lệ của cửa hàng; cửa hàng trả tiền điểm tích cho công ty.
- YCAU_NGHIEPVU_120: Khách dùng điểm trừ tiền hóa đơn tại cửa hàng liên kết, khách tự xác nhận; công ty trả cửa hàng tiền điểm khách dùng.
- YCAU_NGHIEPVU_121: Cửa hàng và công ty phát hành voucher (đổi bằng điểm hoặc miễn phí), có duyệt; khách nhận trên ứng dụng, dùng tại quầy.
- YCAU_NGHIEPVU_122: Đối soát hằng tuần có bù trừ với từng cửa hàng; cửa hàng xác nhận; hạn mức nợ, quá hạn thì chặn tích.
- YCAU_NGHIEPVU_123: Tiền điểm, voucher, phí, bù trừ với cửa hàng liên kết được hạch toán.
- YCAU_NGHIEPVU_124: Cửa hàng xem báo cáo của mình; công ty xem báo cáo toàn bộ cửa hàng và cảnh báo giao dịch bất thường.

- CHUC_NANG_193: Quản lý cửa hàng liên kết (web quản trị) và cửa hàng của tôi, nhân viên (cổng cửa hàng).
- CHUC_NANG_194: Tích, đổi điểm tại quầy bằng mã QR động, số điện thoại kèm xác nhận trên ứng dụng; hủy giao dịch.
- CHUC_NANG_195: Voucher liên kết: tạo, duyệt, nhận, dùng.
- CHUC_NANG_196: Đối soát tuần, công nợ, hạch toán, báo cáo cửa hàng, cảnh báo bất thường.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_392 Cửa hàng liên kết: một hợp đồng cho một đối tác `crm.partners` đang hoạt động, không phải đối tác nội bộ (`company_id` trống); thuộc công ty vận hành sàn. Mã `CH…`. Trường: số hợp đồng, ngày hiệu lực, ngày hết hạn (trống: không thời hạn), tỷ lệ tích (0,1 đến 20 % tiền tính tích), tỷ lệ phí dịch vụ (0 đến 20 % tiền công ty phải trả do điểm khách dùng, mặc định 0), hạn mức nợ (đồng, > 0), trần mỗi giao dịch (tiền hóa đơn, đồng, > 0), hạn thanh toán bảng đối soát (1 đến 30 ngày, mặc định 7), số ngày tự xác nhận (1 đến 7, mặc định 3). Trạng thái: nháp, đang hoạt động, tạm ngưng (kèm lý do), đã chấm dứt. Chỉ cửa hàng đang hoạt động, trong thời hạn hợp đồng mới giao dịch được. Sửa tỷ lệ, hạn mức áp dụng cho giao dịch lập sau khi sửa. Điểm bán: tên, địa chỉ, trạng thái hoạt động hoặc ngưng; một cửa hàng ít nhất một điểm bán. Người có `affiliate.manage` cài đặt.
- QUYTAC_NGHIEPVU_393 Tài khoản cửa hàng: người có `affiliate.manage` mời chủ cửa hàng bằng số điện thoại (SMS chứa đường dẫn kích hoạt, hiệu lực 72 giờ); chủ cửa hàng mời thu ngân bằng số điện thoại và gán một hoặc nhiều điểm bán. Đăng nhập cổng cửa hàng bằng số điện thoại và OTP, hoặc Zalo sau khi liên kết từ hồ sơ (THAY_DOI_01). Một người có thể là khách VComm và thành viên cửa hàng. Vai trò: chủ cửa hàng (mọi thao tác của cửa hàng, mọi điểm bán), thu ngân (giao dịch, xem giao dịch hôm nay tại điểm bán được gán). Chủ khóa, mở thu ngân; công ty khóa, mở chủ. Cửa hàng tạm ngưng, chấm dứt: thành viên vẫn đăng nhập xem báo cáo, đối soát, không giao dịch được.
- QUYTAC_NGHIEPVU_394 Giao dịch tại quầy (số `LK…`): thu ngân nhập tiền hóa đơn (> 0, ≤ trần mỗi giao dịch); khách có thể dùng một voucher và dùng điểm. Thứ tự: tiền giảm voucher (QUYTAC_NGHIEPVU_402) → tiền sau voucher → tiền điểm (QUYTAC_NGHIEPVU_399) → khách trả cửa hàng = tiền sau voucher − tiền điểm → điểm tích tính trên tiền khách trả (QUYTAC_NGHIEPVU_398). Chốt giai đoạn chương trình, hạng, hệ số tại thời điểm hoàn tất (giờ Việt Nam). Trạng thái: chờ khách xác nhận, hoàn tất, khách từ chối, hết hạn, đã hủy. Một giao dịch chờ xác nhận hết hạn sau 3 phút (cách 1) hoặc 5 phút (cách 3).
- QUYTAC_NGHIEPVU_395 Cách 1, mã QR động của cửa hàng: thu ngân nhập tiền hóa đơn, cổng cửa hàng hiện mã QR chứa mã giao dịch ngẫu nhiên (128 bit, lưu băm, dùng một lần, hết hạn 3 phút). Khách quét bằng ứng dụng VComm, thấy tên cửa hàng, điểm bán, tiền hóa đơn, voucher dùng được, số điểm tối đa dùng được, điểm dự kiến tích; chọn voucher, số điểm (mặc định 0), bấm Xác nhận hoặc Từ chối. Cổng cửa hàng tự cập nhật kết quả.
- QUYTAC_NGHIEPVU_396 Cách 2, mã QR động của khách: ứng dụng VComm hiện mã thành viên ký HMAC-SHA256 (khóa dẫn xuất từ `MFA_SECRET_KEY`, như mã chấm công CONG_VIEC_47) gồm mã người mua, số điểm khách cho phép dùng (mặc định 0, khách nhập trước khi hiện mã), mã voucher khách chọn (nếu có), thời điểm; hiệu lực 60 giây, dùng một lần (lưu chuỗi đã dùng). Thu ngân nhập tiền hóa đơn rồi quét bằng camera (thư viện `jsQR`) hoặc máy quét cầm tay; giao dịch hoàn tất ngay, điểm dùng = nhỏ hơn giữa số khách cho phép và số tối đa dùng được. Mã không chứa tên, số điện thoại.
- QUYTAC_NGHIEPVU_397 Cách 3, số điện thoại kèm xác nhận trên ứng dụng: thu ngân nhập tiền hóa đơn và số điện thoại; không có tài khoản người mua đang hoạt động với số đó thì báo "Số điện thoại chưa có tài khoản VComm". Có thì tạo giao dịch chờ xác nhận; khách mở ứng dụng VComm thấy yêu cầu ở trang chủ và mục Cửa hàng liên kết, xác nhận như cách 1. Cổng cửa hàng không hiện tên đầy đủ, chỉ hiện tên đã che (ví dụ "Ng*** H***"). Một số điện thoại tối đa 1 yêu cầu chờ; một thu ngân tối đa 10 yêu cầu bị từ chối hoặc hết hạn mỗi giờ (vượt thì khóa cách 3 của thu ngân đó 1 giờ).
- QUYTAC_NGHIEPVU_398 Tích điểm tại cửa hàng liên kết: điểm = phần nguyên của (tiền khách trả × tỷ lệ tích của cửa hàng × hệ số hạng ÷ giá trị một điểm của giai đoạn); áp trần mỗi đơn, trần tháng của giai đoạn (tính chung với đơn VComm, bán tại quầy); một lô, hạn dùng theo giai đoạn tính từ ngày giao dịch; tiền điểm tích = điểm × giá trị một điểm (cửa hàng phải trả). Không tích, ghi lý do: người mua thử, ví khóa, tài khoản ngưng, không có giai đoạn, điểm bằng 0, cửa hàng vượt hạn mức nợ, cửa hàng có bảng đối soát quá hạn thanh toán. Dư nợ = phải thu còn mở của bảng đối soát + (tiền điểm tích − tiền công ty phải trả) của giao dịch chưa chốt, không âm; dư nợ cộng tiền điểm tích của giao dịch này vượt hạn mức thì không tích. Bị chặn tích vẫn dùng điểm, voucher được. Chi tiêu tại cửa hàng liên kết không tính vào chi tiêu xét hạng (mục 18).
- QUYTAC_NGHIEPVU_399 Dùng điểm tại cửa hàng liên kết: như QUYTAC_NGHIEPVU_348 (giai đoạn hiệu lực, ví không khóa, điểm ≥ mức tối thiểu, ≤ số dư lô còn hạn); tiền điểm = điểm × giá trị một điểm, làm tròn xuống đến đồng, ≤ tỷ lệ đổi tối đa × tiền sau voucher. Trừ điểm khi giao dịch hoàn tất. Công ty phải trả cửa hàng tiền điểm.
- QUYTAC_NGHIEPVU_400 Hủy giao dịch: chủ cửa hàng hủy toàn bộ giao dịch hoàn tất kèm lý do (1 đến 500 ký tự) khi tuần của giao dịch chưa chốt đối soát. Hoàn điểm đã dùng vào đúng lô (lô hết hạn thêm 30 ngày, như QUYTAC_NGHIEPVU_349); trừ lại điểm đã tích, số dư không đủ thì trừ hết số dư, cửa hàng vẫn trả tiền điểm tích đã phát hành (phần thiếu ghi vào bảng đối soát); voucher đã dùng trả lại cho khách nếu còn hạn. Tuần đã chốt: không hủy được, công ty xử lý bằng phiếu điều chỉnh điểm (CONG_VIEC_51) và khiếu nại đối soát. Thông báo trong ứng dụng cho khách.
- QUYTAC_NGHIEPVU_401 Voucher liên kết: loại phát hành (cửa hàng đổi bằng điểm; cửa hàng miễn phí; công ty); giảm số tiền hoặc phần trăm (1 đến 100 %, có mức giảm tối đa); tiền hóa đơn tối thiểu; tổng số lượng; số lượng mỗi khách (mặc định 1); giá điểm (chỉ loại đổi bằng điểm, ≥ 1); thời gian nhận (từ, đến); hạn dùng sau khi nhận (1 đến 90 ngày, không quá ngày kết thúc nhận cộng hạn dùng); phạm vi dùng: voucher cửa hàng dùng tại mọi điểm bán của cửa hàng đó; voucher công ty dùng tại mọi cửa hàng hoặc các cửa hàng được chọn. Chủ cửa hàng tạo voucher cửa hàng; người có `affiliate.manage` tạo voucher công ty. Mọi voucher gửi duyệt qua luồng duyệt chứng từ của công ty vận hành sàn (loại chứng từ `affiliate.voucher`, giá trị = tổng số lượng × mức giảm tối đa; người lập không tự duyệt). Trạng thái: nháp, chờ duyệt, đã duyệt (chưa tới ngày nhận), đang phát, tạm dừng, đã kết thúc, bị từ chối, đã rút. Đã duyệt thì chỉ sửa được tạm dừng, tiếp tục, giảm tổng số lượng (không dưới số đã nhận).
- QUYTAC_NGHIEPVU_402 Nhận và dùng voucher: khách nhận trên ứng dụng VComm (trong thời gian nhận, còn số lượng, chưa đủ số mỗi khách; loại đổi bằng điểm trừ điểm ngay, nguồn chứng từ `affiliate_voucher`). Voucher của khách: mã, hạn dùng, trạng thái chưa dùng, đã dùng, hết hạn. Dùng tại quầy: chọn khi xác nhận (cách 1, 3) hoặc chọn trước khi hiện mã thành viên (cách 2); điều kiện: đúng cửa hàng, còn hạn, tiền hóa đơn ≥ tối thiểu. Tiền giảm = số tiền hoặc phần trăm × tiền hóa đơn (tối đa mức giảm tối đa, không vượt tiền hóa đơn). Voucher đổi bằng điểm hết hạn chưa dùng không hoàn điểm (mục 18). Tiền phải trả cho cửa hàng: voucher đổi bằng điểm: giá điểm × giá trị một điểm lúc nhận (khi dùng); voucher công ty: tiền giảm (khi dùng); voucher cửa hàng miễn phí: không có.
- QUYTAC_NGHIEPVU_403 Đối soát tuần: việc nền 1 giờ sáng thứ Hai (giờ Việt Nam) lập bảng đối soát tuần trước (thứ Hai đến Chủ nhật) cho mỗi cửa hàng có giao dịch (số `DS…`). Số liệu: tiền điểm tích (A), tiền điểm khách dùng gồm voucher đổi bằng điểm (B), tiền voucher công ty (C), phí dịch vụ = làm tròn (B × tỷ lệ phí) (D), thuế giá trị gia tăng của phí = làm tròn (D × thuế suất cài đặt, mặc định 10 %) (E); số còn lại = A + D + E − B − C (dương: cửa hàng phải trả; âm: công ty phải trả). Trạng thái: chờ cửa hàng xác nhận, đã xác nhận (chủ cửa hàng xác nhận hoặc tự xác nhận khi quá số ngày tự xác nhận), khiếu nại (chủ cửa hàng ghi lý do 1 đến 1.000 ký tự; người có `affiliate.manage` trả lời và chốt lại, có thể kèm phiếu điều chỉnh tiền với lý do), đã thanh toán. Khi xác nhận: ghi công nợ một khoản với đối tác theo số còn lại (phải thu, hạn = ngày xác nhận + hạn thanh toán; hoặc phải trả), thu chi qua phiếu thu, phiếu chi CONG_VIEC_13; công nợ về 0 thì bảng chuyển đã thanh toán. Quá hạn: phải thu của bảng đối soát còn mở sau hạn thanh toán.
- QUYTAC_NGHIEPVU_404 Hạch toán ở công ty vận hành sàn (đối tác là cửa hàng; bút toán tự sinh): tích Nợ 131 / Có 3388 theo tiền điểm tích, ngày giao dịch; dùng điểm, dùng voucher đổi bằng điểm Nợ 3388 theo giá trị lúc tích của lô / Có 331 tiền phải trả cửa hàng, chênh lệch Nợ hoặc Có 641; voucher công ty Nợ 641 / Có 331; hủy giao dịch ghi ngược. Khi xác nhận bảng đối soát: phí Nợ 331 / Có 511 (vai trò `affiliate_fee_revenue`), 3331; bù trừ Nợ 331 / Có 131 bằng số nhỏ hơn giữa tổng phải thu và tổng phải trả của bảng; điều chỉnh tiền khi trả lời khiếu nại Nợ hoặc Có 641 với 131 hoặc 331. Nhận điểm voucher đổi bằng điểm: như dùng điểm nhưng Có 3387 (doanh thu chưa thực hiện, vai trò `affiliate_voucher_deferred`); khi khách dùng voucher Nợ 3387 / Có 331; hết hạn chưa dùng Nợ 3387 / Có 641 (mục 18). Trong tuần chưa chốt, công nợ chi tiết theo đối tác chưa có; báo cáo cửa hàng hiện số tạm tính.
- QUYTAC_NGHIEPVU_405 Báo cáo và cảnh báo: cổng cửa hàng: theo ngày, tuần, tháng, điểm bán: số giao dịch, tiền hóa đơn, điểm tích, tiền điểm tích, điểm dùng, tiền điểm dùng, voucher dùng, số khách, khách mới (lần đầu giao dịch tại cửa hàng); dư nợ, hạn mức còn lại. Công ty: cùng chỉ tiêu theo cửa hàng; cảnh báo (chỉ cảnh báo, không tự chặn), tính trong 7 ngày gần nhất: một khách ≥ 3 giao dịch tại cùng cửa hàng trong một ngày; giao dịch có tiền hóa đơn ≥ 80 % trần mỗi giao dịch chiếm ≥ 30 % số giao dịch của cửa hàng; tỷ lệ hủy của cửa hàng ≥ 20 % (cửa hàng có ≥ 10 giao dịch); thu ngân có ≥ 10 yêu cầu cách 3 bị từ chối hoặc hết hạn trong một ngày. Dư nợ ≥ 80 % hạn mức: cảnh báo cho chủ cửa hàng và công ty.

Thông báo lỗi mới (vi): "Cửa hàng chưa hoạt động hoặc hợp đồng hết hạn."; "Tiền hóa đơn vượt trần mỗi giao dịch."; "Mã QR không hợp lệ hoặc đã hết hạn."; "Số điện thoại chưa có tài khoản VComm."; "Số điện thoại này đang có yêu cầu chờ xác nhận."; "Giao dịch đã hết hạn chờ xác nhận."; "Tuần của giao dịch đã chốt đối soát, không hủy được."; "Voucher không dùng được cho giao dịch này."; "Voucher đã hết số lượng hoặc bạn đã nhận đủ."

## 6. Vai trò và quyền

Quyền mới (mini app `crm`, chỉ dùng tại công ty vận hành sàn):
- `affiliate.view`: xem cửa hàng liên kết, giao dịch, voucher, đối soát, báo cáo, cảnh báo.
- `affiliate.manage`: tạo, sửa hợp đồng, điểm bán, mời, khóa chủ cửa hàng, tạm ngưng, chấm dứt; tạo, gửi duyệt voucher công ty; trả lời khiếu nại đối soát.

Quản trị tập đoàn, quản trị công ty có sẵn hai quyền. Duyệt voucher theo chính sách duyệt của công ty vận hành sàn. Thành viên cửa hàng không có vai trò trong công ty; quyền theo vai trò thành viên cửa hàng (chủ, thu ngân), chỉ thấy dữ liệu cửa hàng mình (thu ngân: điểm bán được gán). Người mua chỉ thấy giao dịch, voucher của mình. Kế toán có quyền công nợ (CONG_VIEC_13) lập phiếu thu, phiếu chi với cửa hàng.

## 7. Luồng nghiệp vụ

Luồng 51 (cửa hàng liên kết): công ty tạo đối tác, hợp đồng, điểm bán → mời chủ cửa hàng → chủ kích hoạt, mời thu ngân → thu ngân nhập tiền hóa đơn, định danh khách (cách 1, 2, 3) → khách xác nhận (cách 1, 3) → hoàn tất: dùng voucher, trừ điểm, tích điểm (nếu trong hạn mức, không quá hạn), bút toán → (hủy trước khi chốt tuần) → thứ Hai lập bảng đối soát tuần → cửa hàng xác nhận hoặc khiếu nại → công nợ, bù trừ → phiếu thu hoặc phiếu chi → đã thanh toán. Nhánh voucher: chủ cửa hàng hoặc công ty tạo → duyệt → khách nhận (trừ điểm nếu đổi bằng điểm) → dùng tại quầy.

## 8. Màn hình

Cổng cửa hàng (`apps/web-affiliate`, máy tính bảng, điện thoại, máy tính; đăng nhập như MAN_HINH_01 với số điện thoại, Zalo):
- MAN_HINH_174 Quầy tích đổi điểm: chọn điểm bán, nhập tiền hóa đơn, ba cách (Hiện mã QR, Quét mã khách, Số điện thoại); màn hình chờ, kết quả (tiền giảm voucher, tiền điểm, khách trả, điểm tích hoặc lý do không tích); giao dịch hôm nay; chủ cửa hàng hủy giao dịch.
- MAN_HINH_175 Voucher của cửa hàng (chủ): danh sách theo trạng thái, tạo, sửa nháp, gửi duyệt, rút, tạm dừng, tiếp tục; số đã nhận, đã dùng.
- MAN_HINH_176 Báo cáo và đối soát (chủ): thẻ Báo cáo (chỉ tiêu theo kỳ, điểm bán; dư nợ, hạn mức còn lại), thẻ Đối soát (danh sách bảng tuần, chi tiết giao dịch, xác nhận, khiếu nại, công nợ, thanh toán), thẻ Giao dịch (tìm, lọc).
- MAN_HINH_177 Cửa hàng của tôi (chủ): thông tin hợp đồng (chỉ xem), điểm bán, nhân viên (mời, gán điểm bán, khóa, mở).

Web quản trị (`apps/web-crm`, nhóm menu "Cửa hàng liên kết"):
- MAN_HINH_178 Cửa hàng liên kết: danh sách (tìm, lọc trạng thái, dư nợ), tạo từ đối tác, chi tiết (hợp đồng, điểm bán, thành viên, mời chủ, tạm ngưng, chấm dứt, dư nợ).
- MAN_HINH_179 Voucher liên kết: mọi voucher (lọc loại, cửa hàng, trạng thái), tạo voucher công ty, gửi duyệt; chi tiết có trạng thái duyệt.
- MAN_HINH_180 Đối soát và giao dịch liên kết: thẻ Đối soát (bảng tuần mọi cửa hàng, khiếu nại, trả lời, điều chỉnh), thẻ Giao dịch, thẻ Báo cáo, thẻ Cảnh báo bất thường.

Ứng dụng (`apps/mobile-vcomm`):
- MAN_HINH_181 Cửa hàng liên kết: quét mã cửa hàng (camera), xác nhận giao dịch (voucher, số điểm, điểm dự kiến); mã thành viên của tôi (QR động, nhập số điểm cho phép, chọn voucher); yêu cầu chờ xác nhận; ưu đãi cửa hàng liên kết (danh sách voucher, nhận); voucher của tôi; lịch sử giao dịch tại cửa hàng.
- Sửa trang chủ ứng dụng: thẻ yêu cầu chờ xác nhận khi có; sửa MAN_HINH_151 Điểm của tôi: bút toán nguồn cửa hàng liên kết hiện tên cửa hàng.

## 9. Dữ liệu và API

Schema mới `affiliate` (tài liệu `12` mục 2; khóa ngoại tới `core`, `crm`, `loyalty`). Tiền `numeric(18,4)`; điểm `integer`.

Database migration 0102 (`0102_affiliate_merchants.sql`):
- `affiliate.merchants`: `id`, `code` (`CH…`), `company_id` (công ty vận hành sàn), `partner_id` (duy nhất), `contract_no`, `starts_on`, `ends_on`, `earn_percent`, `fee_percent`, `credit_limit`, `transaction_cap`, `payment_term_days`, `auto_confirm_days`, `status` (`draft`, `active`, `suspended`, `terminated`), `status_reason`, người, thời điểm tạo, sửa, `version`.
- `affiliate.outlets`: `id`, `merchant_id`, `name`, `address`, `status`.
- `affiliate.members`: `id`, `merchant_id`, `user_id`, `role` (`owner`, `cashier`), `status` (`invited`, `active`, `locked`), `invited_by`, thời điểm; duy nhất (`merchant_id`, `user_id`). `affiliate.member_outlets` (`member_id`, `outlet_id`).
- `affiliate.invitations`: `member_id`, `token_hash`, `expires_at`, `used_at`.
- `core.sessions.client_type` thêm `affiliate_portal` (gồm mọi giá trị trên `main` mới nhất).
- Quyền `affiliate.view`, `affiliate.manage`; dãy số `CH`.

Database migration 0103 (`0103_affiliate_transactions.sql`):
- `affiliate.transactions`: `id`, `document_no` (`LK…`), `merchant_id`, `outlet_id`, `cashier_user_id`, `buyer_user_id`, `method` (`merchant_qr`, `buyer_qr`, `phone`), `status` (`pending`, `completed`, `declined`, `expired`, `cancelled`), `token_hash`, `expires_at`, `bill_amount`, `voucher_code_id`, `voucher_discount`, `redeemed_points`, `redeemed_amount`, `paid_amount`, `earned_points`, `earned_amount`, `skip_reason`, `phase_id`, `tier_id`, `multiplier`, `point_value`, `earn_percent`, `settlement_id`, `cancel_reason`, `cancelled_by`, thời điểm tạo, hoàn tất, hủy.
- `affiliate.used_member_codes` (chuỗi mã thành viên đã dùng, khóa chính băm, `expires_at`).
- `loyalty`: thêm nguồn chứng từ `affiliate_transaction`, `affiliate_voucher` vào ràng buộc `source_type` của `loyalty.lots`, `loyalty.entries`, `loyalty.document_points` (gồm mọi giá trị trên `main` mới nhất); `LoyaltyLedgerService.earnWithin` nhận thêm tỷ lệ tích thay thế và cờ không cộng chi tiêu.

Database migration 0104 (`0104_affiliate_vouchers.sql`):
- `affiliate.vouchers`: `id`, `code` (`VL…`), `issuer` (`merchant_points`, `merchant_free`, `company`), `merchant_id` (trống khi công ty), `title_vi`, `title_en`, `discount_kind` (`amount`, `percent`), `discount_value`, `max_discount`, `min_bill`, `total_quantity`, `per_buyer_limit`, `points_price`, `claim_from`, `claim_to`, `valid_days`, `status`, `approval_request_id`, `claimed_count`, `used_count`, người, thời điểm, `version`. `affiliate.voucher_merchants` (voucher công ty dùng tại cửa hàng được chọn; trống: mọi cửa hàng).
- `affiliate.voucher_codes`: `id`, `voucher_id`, `buyer_user_id`, `code` (ngẫu nhiên), `points_paid`, `point_value`, `claimed_at`, `expires_at`, `status` (`unused`, `used`, `expired`), `transaction_id`.
- Loại chứng từ duyệt `affiliate.voucher`; dãy số `VL`.

Database migration 0105 (`0105_affiliate_settlements.sql`):
- `affiliate.settlements`: `id`, `document_no` (`DS…`), `merchant_id`, `week_start`, `earned_amount`, `redeemed_amount`, `company_voucher_amount`, `shortfall_amount`, `fee_amount`, `fee_tax_rate`, `fee_tax_amount`, `adjustment_amount`, `net_amount`, `status` (`awaiting_confirmation`, `confirmed`, `disputed`, `paid`), `confirm_due_at`, `confirmed_by` (trống khi tự xác nhận), `confirmed_at`, `dispute_reason`, `resolution_note`, `debt_item_id`; duy nhất (`merchant_id`, `week_start`).
- `finance.debt_items.source_type` thêm `affiliate_settlement`; `accounting.journals.source_type` thêm `affiliate_transaction`, `affiliate_voucher`, `affiliate_settlement` (gồm mọi giá trị trên `main` mới nhất); vai trò định khoản `affiliate_receivable` (131), `affiliate_payable` (331), `affiliate_fee_revenue` (5113), `affiliate_fee_tax` (33311), `affiliate_voucher_deferred` (3387); dùng lại `loyalty_expense`, `loyalty_liability`.

API (tiền tố `/api/v1`):
- API_206 cửa hàng liên kết (công ty; `affiliate.view`, `affiliate.manage`): `GET /affiliate/merchants`, `POST /affiliate/merchants`, `GET /affiliate/merchants/{id}`, `PUT /affiliate/merchants/{id}` (có `version`), `POST /affiliate/merchants/{id}/activate`, `/suspend`, `/terminate`, `POST /affiliate/merchants/{id}/outlets`, `PUT /affiliate/outlets/{id}`, `POST /affiliate/merchants/{id}/owner-invitations`, `POST /affiliate/members/{id}/lock`, `/unlock`.
- API_207 cổng cửa hàng, cửa hàng của tôi: `POST /merchant-portal/invitations/{token}/accept`, `GET /merchant-portal/me` (cửa hàng, vai trò, điểm bán), `GET|POST /merchant-portal/members`, `PUT /merchant-portal/members/{id}` (điểm bán), `POST /merchant-portal/members/{id}/lock`, `/unlock`. Điểm bán chỉ công ty thêm (mục 18).
- API_208 giao dịch tại quầy: `POST /merchant-portal/transactions` (`outletId`, `billAmount`, `method`, `phone` hoặc `memberCode`) → giao dịch chờ hoặc hoàn tất, mã QR (cách 1); `GET /merchant-portal/transactions/{id}` (trạng thái); `GET /merchant-portal/transactions` (lọc ngày, điểm bán, trạng thái); `POST /merchant-portal/transactions/{id}/cancel`.
- API_209 người mua: `POST /buyer/affiliate/scan` (mã QR cửa hàng → thông tin giao dịch, voucher dùng được, điểm tối đa, điểm dự kiến); `GET /buyer/affiliate/pending`; `POST /buyer/affiliate/transactions/{id}/confirm` (`voucherCodeId`, `points`), `/decline`; `POST /buyer/affiliate/member-code` (`points`, `voucherCodeId`) → chuỗi mã, hạn; `GET /buyer/affiliate/transactions`.
- API_210 voucher (cổng cửa hàng và công ty): `GET|POST /merchant-portal/vouchers`, `PUT /merchant-portal/vouchers/{id}`, `POST .../{id}/submit`, `/withdraw`, `/pause`, `/resume`; `GET|POST /affiliate/vouchers`, `PUT /affiliate/vouchers/{id}`, cùng các thao tác.
- API_211 voucher người mua: `GET /buyer/affiliate/vouchers` (đang phát), `POST /buyer/affiliate/vouchers/{id}/claim`, `GET /buyer/affiliate/my-vouchers`.
- API_212 đối soát: `GET /merchant-portal/settlements`, `GET /merchant-portal/settlements/{id}`, `POST .../{id}/confirm`, `POST .../{id}/dispute`; `GET /affiliate/settlements`, `GET /affiliate/settlements/{id}`, `POST /affiliate/settlements/{id}/resolve` (ghi chú, điều chỉnh tiền, lý do).
- API_213 báo cáo, cảnh báo: `GET /merchant-portal/report?from=&to=&outletId=&groupBy=day|week|month`; `GET /affiliate/report?from=&to=&merchantId=`; `GET /affiliate/alerts?kind=same_buyer_burst|near_cap|cancel_rate|phone_declines`.

Service: `AffiliateTransactionsService` gọi `LoyaltyLedgerService` (`quoteRedemption`, `redeemWithin`, `earnWithin`, `cancelWithin`) trong giao dịch của mình, nguồn `affiliate_transaction`; mã QR thành viên dùng lại cách ký của `AttendanceLocationsService`; duyệt voucher dùng `ApprovalRequestsService` (sự kiện `core.approval.completed`); công nợ dùng service công nợ CONG_VIEC_13; bút toán dùng `LedgerService`; việc nền (`apps/api/src/jobs/background-jobs.ts`): hết hạn giao dịch chờ (mỗi phút), hết hạn voucher của khách, lập bảng đối soát 1 giờ thứ Hai, tự xác nhận, cảnh báo dư nợ.

Giao diện: `apps/web-affiliate` (Next.js như các mini app, cổng 3013, `jsQR` đọc camera); `apps/web-crm` trang `/affiliate/merchants`, `/affiliate/merchants/[id]`, `/affiliate/vouchers`, `/affiliate/settlements`; `apps/mobile-vcomm` màn hình `cua-hang-lien-ket.tsx` (dùng `expo-camera` có sẵn), sửa trang chủ, `diem-thuong.tsx`. Chuỗi trong `packages/i18n`, lược đồ trong `packages/contracts`.

## 10. Điều kiện đặc biệt

- Điểm vẫn không quy ra tiền mặt cho khách; tiền chỉ chảy giữa công ty và cửa hàng. Cần ý kiến luật sư như CONG_VIEC_51 trước khi phát hành lên môi trường thật.
- Thư viện mới `jsqr` 1.4.0 (Apache-2.0; người dùng duyệt ngày 2026-11-11; bản cuối năm 2021, không còn cập nhật tích cực: chỉ giải mã ảnh, không gọi mạng, rủi ro thấp). Ghi vào tài liệu `13`.
- Mã QR, mã thành viên không chứa dữ liệu cá nhân; cổng cửa hàng không thấy số dư điểm, tên đầy đủ, số điện thoại của khách.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_368 | Hợp đồng chỉ cho đối tác ngoài; trạng thái, thời hạn chặn giao dịch; sửa tỷ lệ áp cho giao dịch sau; phân quyền `affiliate.view`, `affiliate.manage` | Bắt buộc | KICHBAN_KIEMTHU_533 |
| TIEUCHI_NGHIEMTHU_369 | Mời chủ, chủ mời thu ngân, gán điểm bán; đăng nhập số điện thoại, Zalo; thu ngân chỉ thấy điểm bán được gán; cửa hàng không thấy dữ liệu cửa hàng khác | Bắt buộc | KICHBAN_KIEMTHU_534, KICHBAN_KIEMTHU_535 |
| TIEUCHI_NGHIEMTHU_370 | Cách 1: mã QR dùng một lần, hết hạn 3 phút; khách xác nhận, từ chối; cổng cửa hàng cập nhật | Bắt buộc | KICHBAN_KIEMTHU_536 |
| TIEUCHI_NGHIEMTHU_371 | Cách 2: mã thành viên hết hạn 60 giây, dùng một lần, chữ ký sai bị từ chối; điểm dùng không vượt số khách cho phép | Bắt buộc | KICHBAN_KIEMTHU_537 |
| TIEUCHI_NGHIEMTHU_372 | Cách 3: số chưa có tài khoản báo lỗi; một yêu cầu chờ mỗi số; tên đã che; giới hạn từ chối mỗi giờ | Bắt buộc | KICHBAN_KIEMTHU_538 |
| TIEUCHI_NGHIEMTHU_373 | Tích đúng số điểm (tỷ lệ cửa hàng, hệ số, trần đơn, trần tháng, tính trên tiền khách trả); chặn tích khi vượt hạn mức, quá hạn thanh toán, vẫn dùng điểm được; dùng điểm đúng giới hạn | Bắt buộc | KICHBAN_KIEMTHU_539, KICHBAN_KIEMTHU_540 |
| TIEUCHI_NGHIEMTHU_374 | Hủy trước khi chốt tuần: hoàn điểm đúng lô, trừ lại điểm tích (thiếu thì trừ hết số dư), trả voucher; sau khi chốt không hủy được | Bắt buộc | KICHBAN_KIEMTHU_541 |
| TIEUCHI_NGHIEMTHU_375 | Voucher ba loại qua duyệt, người lập không tự duyệt; nhận đúng giới hạn, trừ điểm; dùng đúng điều kiện, tiền giảm đúng; hết hạn | Bắt buộc | KICHBAN_KIEMTHU_542, KICHBAN_KIEMTHU_543 |
| TIEUCHI_NGHIEMTHU_376 | Bảng đối soát tuần đúng số liệu A đến E và số còn lại; xác nhận, tự xác nhận, khiếu nại, trả lời; công nợ, thanh toán chuyển đã thanh toán | Bắt buộc | KICHBAN_KIEMTHU_544 |
| TIEUCHI_NGHIEMTHU_377 | Bút toán tích, dùng điểm (chênh lệch), voucher, phí, thuế, bù trừ, hủy đúng tài khoản; khớp báo cáo nghĩa vụ điểm | Bắt buộc | KICHBAN_KIEMTHU_545 |
| TIEUCHI_NGHIEMTHU_378 | Báo cáo cửa hàng, báo cáo công ty khớp giao dịch; bốn loại cảnh báo bất thường; cảnh báo dư nợ 80 % | Bắt buộc | KICHBAN_KIEMTHU_546 |
| TIEUCHI_NGHIEMTHU_379 | Cổng cửa hàng, web quản trị, ứng dụng chạy được (máy tính bảng, điện thoại, máy tính); quét camera trên Safari iPhone, Chrome Android | Bắt buộc | KICHBAN_KIEMTHU_546 (phần thủ công) |

## 12. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_533 đến 546: tự động, `apps/api/test/c55-*.test.ts`.
- KICHBAN_KIEMTHU_546 phần giao diện: thủ công trên trình duyệt, điện thoại thật (quét camera), kèm kiểm thử quyền tự động.

## 13. Ràng buộc kỹ thuật

Thêm một thư viện `jsqr` (mục 10). Dùng lại: `LoyaltyLedgerService` (CONG_VIEC_51), cách ký mã QR động (CONG_VIEC_47), đăng nhập số điện thoại, Zalo (CONG_VIEC_03), luồng duyệt chứng từ, dãy số chứng từ, công nợ, phiếu thu chi (CONG_VIEC_13), bút toán tự sinh (CONG_VIEC_14), thông báo trong ứng dụng, việc nền, `qrcode-generator` (vẽ mã QR), `expo-camera` (ứng dụng VComm).

## 14. Thành phần không được thay đổi

Sổ cái điểm, công thức tích, đổi của đơn VComm, bán tại quầy (CONG_VIEC_51, 53): chỉ thêm nguồn chứng từ, tham số tỷ lệ tích thay thế và cờ không cộng chi tiêu (giá trị mặc định giữ nguyên hành vi cũ). Công nợ, phiếu thu chi (CONG_VIEC_13): chỉ thêm nguồn công nợ. Đăng nhập: chỉ thêm loại phiên `affiliate_portal`.

## 15. Các lát và điểm xem trước

- L0: database migration 0102; ứng dụng `web-affiliate` khung, đăng nhập; quản lý cửa hàng, điểm bán, mời chủ, thu ngân (API_206, 207; MAN_HINH_177, 178). Xem trước: tạo cửa hàng trên web quản trị, chủ kích hoạt, mời thu ngân.
- L1: database migration 0103; giao dịch ba cách, xác nhận trên ứng dụng, hủy; bút toán tích, dùng (API_208, 209; MAN_HINH_174, 181). Xem trước: tích, đổi điểm thử bằng hai trình duyệt và ứng dụng.
- L2: database migration 0104; voucher ba loại, duyệt, nhận, dùng (API_210, 211; MAN_HINH_175, 179; MAN_HINH_181 phần ưu đãi). Xem trước: tạo, duyệt, nhận, dùng voucher.
- L3: database migration 0105; đối soát tuần, xác nhận, khiếu nại, công nợ, hạn mức, quá hạn, bút toán phí, bù trừ (API_212; MAN_HINH_176 thẻ Đối soát, MAN_HINH_180 thẻ Đối soát). Xem trước: chạy việc nền lập bảng, xác nhận, lập phiếu thu.
- L4: báo cáo, cảnh báo (API_213; MAN_HINH_176 thẻ Báo cáo, MAN_HINH_180 thẻ Báo cáo, Cảnh báo).

## 16. Điểm chưa xác định

- Ý kiến luật sư về điểm thưởng (như CONG_VIEC_51); chặn phát hành lên môi trường thật, không chặn xây dựng.
- Hợp đồng mẫu với cửa hàng liên kết (điều khoản hạn mức, đối soát, phí) do bộ phận pháp chế soạn; không chặn xây dựng.

## 17. Quyết định của người dùng (2026-11-11)

1. Cửa hàng liên kết là đối tác ngoài tập đoàn; công ty con dùng bán lẻ tại quầy CONG_VIEC_53.
2. Cửa hàng trả sau tiền điểm tích theo kỳ đối soát, trong hạn mức.
3. Định danh khách: mã QR động của cửa hàng (khách quét), mã QR động của khách (cửa hàng quét), số điện thoại kèm xác nhận trên ứng dụng VComm.
4. Cổng cửa hàng web đọc mã QR bằng camera qua thư viện `jsQR`.
5. Tỷ lệ tích riêng theo từng cửa hàng; vẫn nhân hệ số hạng, áp trần, giá trị một điểm, hạn dùng của giai đoạn chung.
6. Đối soát hằng tuần, bù trừ hai chiều.
7. Voucher cả ba loại: cửa hàng phát hành đổi bằng điểm, cửa hàng tặng miễn phí, công ty phát hành dùng tại mọi cửa hàng.
8. Mọi voucher qua duyệt của công ty vận hành sàn.
9. Chặn tích khi vượt hạn mức nợ hoặc có bảng đối soát quá hạn thanh toán; dùng điểm vẫn được.
10. Một đối tác nhiều điểm bán; công ty mời chủ, chủ thêm thu ngân.
11. Phí dịch vụ theo hợp đồng (mặc định 0 %) trừ vào tiền điểm dùng khi đối soát, ghi doanh thu dịch vụ.
12. Hủy toàn bộ giao dịch trước khi chốt tuần; sau đó công ty điều chỉnh tay.
13. Chỉ khách có tài khoản VComm mới tích, đổi.
14. Hạch toán theo phương án 131 / 3388, 3388 / 331, 641 / 331, 331 / 511, 3331, bù trừ 331 / 131.

## 18. Quyết định AI đề xuất, chờ người dùng xác nhận

1. Chi tiêu tại cửa hàng liên kết không tính vào chi tiêu xét hạng (doanh thu không thuộc tập đoàn).
2. Voucher đổi bằng điểm hết hạn chưa dùng không hoàn điểm; điểm khách bỏ ra ghi doanh thu chưa thực hiện (3387) khi nhận, chuyển sang phải trả cửa hàng khi dùng, sang giảm chi phí khi hết hạn.
3. Hóa đơn điện tử cho phí dịch vụ: kế toán lập theo cách hiện có của công ty; phần 1 không tự lập hóa đơn.
4. Chỉ công ty thêm, ngưng điểm bán (chủ cửa hàng không tự thêm) để kiểm soát địa điểm.
5. Thời gian chờ xác nhận 3 phút (cách 1), 5 phút (cách 3); mã thành viên 60 giây; tự xác nhận đối soát sau 3 ngày; hạn thanh toán 7 ngày; thuế suất phí 10 %.
6. Cổng cửa hàng là ứng dụng web mới `apps/web-affiliate` (kiến trúc tài liệu `12` mục 1 đã có khối cửa hàng liên kết).
