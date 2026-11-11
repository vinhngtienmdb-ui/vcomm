# CONG_VIEC_51: Điểm thưởng phần 1 (MODULE_11)

- Mô tả: Sổ cái điểm ghi một chiều; tích điểm khi đơn VComm hoàn tất; đổi điểm trừ vào đơn; hạn dùng điểm theo từng lần tích; hạng thành viên theo chi tiêu năm dương lịch; cấu hình theo giai đoạn; chống gian lận cơ bản; hạch toán nghĩa vụ điểm. Trên ứng dụng VComm (`apps/mobile-vcomm`) và web quản trị (`apps/web-crm`).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả.
- Nguồn: tài liệu `04` (mục 63), `05` (mục 2.3), `01` (rủi ro ví điện tử); quyết định của người dùng ngày 2026-11-11 (mục 17); CONG_VIEC_23 (tài khoản người mua), CONG_VIEC_24 (đặt hàng, hủy, trả hàng, hoàn tất), CONG_VIEC_25 (thanh toán, hoàn tiền, bút toán), CONG_VIEC_26 (mẫu ví, giao dịch ví một chiều); CONG_VIEC_49 (ví mua sắm, đang làm song song).
- Mức: Lớn (module mới, schema mới `loyalty`, sửa cách đặt hàng, hoàn tiền, hoàn tất đơn).

## 1. Mục tiêu

Tăng mua lặp lại trên VComm bằng điểm thưởng: người mua tích điểm từ đơn hoàn tất, dùng điểm trừ tiền đơn sau, có hạng thành viên theo chi tiêu; VComm kiểm soát được chi phí và nghĩa vụ điểm.

## 2. Phạm vi

Trong phạm vi:
- Chương trình điểm theo giai đoạn (từ ngày, đến ngày): tỷ lệ tích, giá trị quy đổi một điểm, giới hạn đổi, mức đổi tối thiểu, hạn dùng, trần điểm.
- Bảng hạng thành viên: mức chi tiêu năm, hệ số nhân điểm tích.
- Sổ cái điểm: lô điểm (mỗi lần tích, cộng tay), bút toán điểm chỉ thêm.
- Tích điểm khi đơn VComm hoàn tất; điểm dự kiến khi đặt.
- Đổi điểm trừ vào đơn thường khi đặt; hoàn điểm khi hủy đơn, khi nhận hàng trả.
- Hết hạn điểm, nhắc trước 30 ngày; xét hạng.
- Chống gian lận cơ bản: trần điểm, người mua thử không tích, khóa ví điểm, điều chỉnh tay qua duyệt, danh sách cảnh báo bất thường.
- Hạch toán tích, dùng, hết hạn, điều chỉnh; báo cáo nghĩa vụ điểm.

Ngoài phạm vi: cửa hàng liên kết quét QR tích, đổi điểm, nhà bán, cửa hàng mua điểm, đối soát liên minh (MODULE_12, công việc sau); đổi quà, voucher bằng điểm; tích điểm cho đơn bán ngoài VComm; chuyển, tặng, nạp, rút điểm (không làm, rủi ro ví điện tử); thông báo đẩy về điện thoại; quyền lợi hạng khác hệ số tích.

## 3. Phân biệt với phần đã có (không trùng)

| Đối tượng | Bản chất | Nguồn |
|---|---|---|
| Ví hoa hồng | Tiền thật của người hưởng hoa hồng, rút về ngân hàng | CONG_VIEC_26 (giữ nguyên) |
| Ví mua sắm | Tiền hoàn mua chung của người mua, dùng trả đơn, không hết hạn | CONG_VIEC_49 (đang làm) |
| Điểm thưởng (mới) | Điểm do công ty vận hành sàn phát hành, có hạn, không quy ra tiền mặt, chỉ trừ vào đơn trong giới hạn | Công việc này |

Thứ tự trừ trên một đơn (quyết định người dùng): điểm trước, ví mua sắm sau, phần còn lại theo phương thức thanh toán. Đơn mua chung không dùng điểm, vẫn tích điểm khi hoàn tất. Công việc này làm phần điểm trên `main`; nhánh nào hợp nhất sau ghép công thức tiền phải trả (mục 9).

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_91: Mọi biến động điểm ghi vào sổ cái một chiều, không sửa, không xóa; số dư luôn bằng tổng bút toán.
- YCAU_NGHIEPVU_92: Người mua tích điểm theo đơn VComm hoàn tất (giá trị thực bán); đơn hủy không có điểm; hàng trả trước khi hoàn tất không được tính.
- YCAU_NGHIEPVU_93: Người mua dùng điểm trừ trực tiếp vào đơn khi đặt, trong giới hạn của giai đoạn; hủy, trả hàng thì hoàn điểm theo tỷ lệ.
- YCAU_NGHIEPVU_94: Điểm có hạn dùng theo từng lần tích; hết hạn tự trừ; báo trước cho người mua.
- YCAU_NGHIEPVU_95: Người mua có hạng thành viên theo chi tiêu năm dương lịch; hạng cao tích nhiều điểm hơn.
- YCAU_NGHIEPVU_96: VComm hạn chế gian lận điểm: trần điểm, khóa ví, điều chỉnh tay có duyệt, cảnh báo bất thường.
- YCAU_NGHIEPVU_97: Chi phí và nghĩa vụ điểm được hạch toán; kế toán xem được số dư nghĩa vụ.

- CHUC_NANG_178: Chương trình điểm theo giai đoạn và bảng hạng (web).
- CHUC_NANG_179: Sổ cái điểm: tích khi hoàn tất, hết hạn, nhắc hạn, hạng; điểm của tôi trên ứng dụng.
- CHUC_NANG_180: Đổi điểm khi đặt hàng; hoàn điểm khi hủy, trả hàng.
- CHUC_NANG_181: Quản trị điểm: tra cứu ví điểm, khóa, điều chỉnh có duyệt, cảnh báo bất thường, hạch toán, báo cáo nghĩa vụ điểm.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_344 Sổ cái: mỗi người mua một ví điểm (tạo khi có bút toán đầu tiên). Bút toán điểm: loại (tích theo đơn, dùng cho đơn, hoàn điểm đơn, hết hạn, điều chỉnh cộng, điều chỉnh trừ), số điểm khác 0 (số nguyên; cộng dương, trừ âm), số dư sau, đơn hoặc phiếu điều chỉnh, lô điểm, thời điểm. Chỉ thêm, không sửa, không xóa (trigger cơ sở dữ liệu chặn). Mọi bút toán khóa dòng ví điểm; số dư ≥ 0. Lô điểm: mỗi lần cộng (tích, điều chỉnh cộng) là một lô có số điểm, số còn lại, hạn dùng, giá trị một điểm lúc cộng; dùng, hết hạn, điều chỉnh trừ lấy từ lô hạn sớm nhất trước (cùng hạn: lô cũ trước).
- QUYTAC_NGHIEPVU_345 Giai đoạn chương trình: từ ngày, đến ngày (trống: không thời hạn), không chồng lấn nhau; tham số: tỷ lệ tích (0 đến 100 % giá trị tích), giá trị một điểm (đồng, > 0), tỷ lệ đổi tối đa (0 đến 100 % tiền hàng), mức đổi tối thiểu (điểm, ≥ 1), hạn dùng (1 đến 60 tháng, mặc định 12), trần điểm mỗi đơn, trần điểm mỗi người mỗi tháng (trống: không trần). Giai đoạn chưa bắt đầu sửa, xóa được; đã bắt đầu chỉ sửa được ngày kết thúc (không trước hôm nay). Không có giai đoạn hiệu lực thì không tích, không đổi điểm. Người có `loyalty.manage` cài đặt.
- QUYTAC_NGHIEPVU_346 Chốt khi đặt: đơn VComm lưu giai đoạn hiệu lực tại ngày đặt (giờ Việt Nam), hạng và hệ số của người mua lúc đặt; điểm dự kiến = phần nguyên của (tiền hàng gồm thuế − tiền điểm dùng) × tỷ lệ tích × hệ số ÷ giá trị một điểm, áp trần mỗi đơn. Sửa giai đoạn, bảng hạng không đổi đơn đã đặt.
- QUYTAC_NGHIEPVU_347 Tích khi hoàn tất (trong giao dịch chuyển đơn Hoàn tất): giá trị tích = giá trị hoàn tất (QUYTAC_NGHIEPVU_162) − tiền điểm đã dùng còn lại sau hoàn (không âm); điểm = phần nguyên của giá trị tích × tỷ lệ tích × hệ số ÷ giá trị một điểm của giai đoạn đã chốt; áp trần mỗi đơn rồi trần tháng (tổng điểm tích theo đơn của người đó trong tháng hoàn tất, giờ Việt Nam). Một lô mỗi đơn, hạn dùng = ngày hoàn tất + số tháng hạn dùng của giai đoạn. Không tích (ghi lý do trên đơn) khi: người mua thử, ví điểm bị khóa, tài khoản ngưng hoạt động, điểm bằng 0. Đơn mua chung (CONG_VIEC_49) tích như đơn thường.
- QUYTAC_NGHIEPVU_348 Đổi điểm khi đặt đơn thường (không áp dụng đơn mua chung): người mua nhập số điểm; điều kiện: có giai đoạn hiệu lực, ví không khóa, điểm ≥ mức tối thiểu, ≤ số dư, tiền điểm = điểm × giá trị một điểm của giai đoạn, làm tròn xuống đến đồng, ≤ tỷ lệ đổi tối đa × tiền hàng gồm thuế (không tính phí giao hàng). Trừ điểm ngay khi đặt (bút toán dùng cho đơn). Tiền phải trả = tiền hàng + phí giao hàng − tiền điểm (rồi trừ ví mua sắm khi CONG_VIEC_49 hợp nhất); đơn thanh toán khi nhận hàng: tiền thu hộ là tiền phải trả; đơn trực tuyến: số tiền gửi cổng là tiền phải trả. Xem trước trả về số dư, số điểm tối đa dùng được, tiền điểm; số điểm người mua thấy khác lúc đặt thì báo "Giá đã thay đổi".
- QUYTAC_NGHIEPVU_349 Hoàn điểm: hủy đơn (người mua, nhân viên, hết hạn thanh toán, hoàn hàng về) hoàn toàn bộ điểm đã dùng còn lại vào đúng các lô đã lấy; lô đã hết hạn được hạn mới = hôm nay + 30 ngày. Kho nhận hàng trả: điểm hoàn = làm tròn (điểm đã dùng × giá trị hàng trả ÷ tiền hàng gồm thuế của đơn), không vượt điểm còn lại; tiền hoàn tiền mặt (QUYTAC_NGHIEPVU_168) = giá trị hàng trả − tiền điểm tương ứng, không âm. Thông báo trong ứng dụng.
- QUYTAC_NGHIEPVU_350 Hết hạn: việc nền hằng ngày (0 giờ 10 phút giờ Việt Nam) ghi bút toán hết hạn cho mỗi lô đã quá hạn còn điểm (mỗi lần tối đa 1.000 lô). Lô còn điểm, hạn trong 30 ngày tới: thông báo trong ứng dụng một lần mỗi lô.
- QUYTAC_NGHIEPVU_351 Hạng thành viên: bảng hạng (tên tiếng Việt, tiếng Anh, mức chi tiêu tối thiểu một năm, hệ số tích 1 đến 5, thứ tự); hạng thấp nhất mức 0. Chi tiêu năm = tổng giá trị hoàn tất các đơn hoàn tất trong năm dương lịch (giờ Việt Nam). Hạng hiện tại = hạng cao hơn giữa hạng theo chi tiêu năm trước và hạng theo chi tiêu năm nay; tính lại khi đơn hoàn tất và ngày 1/1 (việc nền); lưu lịch sử đổi hạng; lên hạng thì thông báo. Mặc định: Thành viên 0, Bạc 5.000.000, Vàng 20.000.000, Kim cương 50.000.000 đồng; hệ số 1; 1,2; 1,5; 2.
- QUYTAC_NGHIEPVU_352 Khóa ví điểm: người có `loyalty.manage` khóa, mở ví điểm của người mua kèm lý do (1 đến 500 ký tự); lưu lịch sử. Ví khóa hoặc tài khoản người dùng ngưng hoạt động: không tích, không đổi; đơn đã đặt vẫn hoàn điểm khi hủy, trả hàng; điểm vẫn hết hạn.
- QUYTAC_NGHIEPVU_353 Điều chỉnh tay: phiếu điều chỉnh (số `DD`…, người mua, cộng hoặc trừ, số điểm 1 đến 10.000.000, lý do 1 đến 500 ký tự) do người có `loyalty.manage` lập, gửi duyệt qua luồng duyệt chứng từ (loại chứng từ `loyalty.adjustment`, giá trị = điểm × giá trị một điểm của giai đoạn hiện hành; người lập không tự duyệt, QUYTAC_NGHIEPVU_20). Được duyệt thì ghi sổ: cộng tạo lô với hạn theo giai đoạn hiện hành (không có giai đoạn: 12 tháng) và giá trị một điểm hiện hành; trừ không vượt số dư lúc duyệt (thiếu thì không ghi, báo lỗi, phiếu giữ trạng thái chờ ghi sổ để lập lại). Trạng thái: nháp, chờ duyệt, đã ghi sổ, bị từ chối, đã rút.
- QUYTAC_NGHIEPVU_354 Cảnh báo bất thường (chỉ cảnh báo, không tự chặn), tính trong 90 ngày gần nhất: nhiều người mua (≥ 3) dùng cùng số điện thoại nhận hoặc cùng địa chỉ giao (tỉnh, xã, địa chỉ chi tiết chuẩn hóa chữ thường, bỏ khoảng trắng thừa); người mua có ≥ 5 đơn và tỷ lệ đơn hủy hoặc có hàng trả ≥ 50%; người mua đổi điểm ≥ 5 đơn trong một ngày. Danh sách hiện người mua, loại cảnh báo, số liệu, đường dẫn tới ví điểm.
- QUYTAC_NGHIEPVU_355 Hạch toán (công ty vận hành sàn đã khởi tạo kế toán; bút toán tự sinh): tích điểm Nợ chi phí bán hàng (641, vai trò `loyalty_expense`) / Có phải trả khác (3388, vai trò `loyalty_liability`) theo giá trị lô (điểm × giá trị một điểm lúc tích), ngày hoàn tất. Đơn hoàn tất có dùng điểm: Nợ 3388 theo giá trị lúc tích của các lô đã dùng còn lại / Có phải thu khách hàng (131) tiền điểm còn lại; chênh lệch ghi Nợ hoặc Có 641. Hết hạn: Nợ 3388 / Có 641 theo giá trị lúc tích. Điều chỉnh cộng như tích; điều chỉnh trừ như hết hạn; ngày ghi sổ. Báo cáo nghĩa vụ điểm theo tháng: phát hành, dùng, hết hạn, điều chỉnh, số dư cuối (số điểm và giá trị lúc tích).

Thông báo lỗi mới (vi): "Chưa có chương trình điểm đang hiệu lực."; "Số điểm dùng không hợp lệ (dưới mức tối thiểu, vượt số dư hoặc vượt giới hạn của đơn)."; "Ví điểm đang bị khóa."; "Giai đoạn chồng lấn với giai đoạn khác."; "Giai đoạn đã bắt đầu, chỉ sửa được ngày kết thúc."; "Số dư điểm không đủ để ghi điều chỉnh trừ."

## 6. Vai trò và quyền

Quyền mới (mini app `crm`, chỉ dùng tại công ty vận hành sàn):
- `loyalty.view`: xem chương trình, ví điểm, sổ cái, phiếu điều chỉnh, cảnh báo, báo cáo nghĩa vụ.
- `loyalty.manage`: cài giai đoạn, bảng hạng; khóa, mở ví; lập, gửi duyệt, rút phiếu điều chỉnh.

Quản trị tập đoàn, quản trị công ty có sẵn hai quyền; giao cho nhân viên qua vai trò tùy chỉnh. Duyệt phiếu điều chỉnh theo chính sách duyệt của công ty vận hành sàn. Người mua chỉ xem ví điểm của mình. `marketplace.order.view` thấy điểm trên đơn VComm.

## 7. Luồng nghiệp vụ

Luồng điểm thưởng (số luồng trong tài liệu `09` do phiên cha cấp, không có trong dải mã dành riêng): quản trị cài giai đoạn, bảng hạng → người mua đặt đơn (chốt giai đoạn, hạng; có thể dùng điểm, trừ ngay) → hủy: hoàn điểm → trả hàng nhận về: hoàn điểm theo tỷ lệ → đơn Hoàn tất: tích điểm (lô có hạn), tính lại hạng, bút toán → hết hạn: trừ lô, bút toán; nhắc trước 30 ngày → 1/1 xét hạng. Nhánh: quản trị khóa ví; lập phiếu điều chỉnh → duyệt → ghi sổ.

## 8. Màn hình

Web (`apps/web-crm`, nhóm menu "Điểm thưởng"):
- MAN_HINH_146 Chương trình điểm: danh sách giai đoạn (đang hiệu lực, sắp tới, đã kết thúc), thêm, sửa; bảng hạng.
- MAN_HINH_147 Ví điểm: danh sách người mua (tìm số điện thoại, tên; lọc hạng, đang khóa), chi tiết (số dư, hạng, chi tiêu năm nay, năm trước, lô điểm, sổ cái, lịch sử hạng, lịch sử khóa), khóa, mở.
- MAN_HINH_148 Điều chỉnh điểm: danh sách phiếu, lập, gửi duyệt, rút; chi tiết có trạng thái duyệt.
- MAN_HINH_149 Cảnh báo bất thường: danh sách theo loại.
- MAN_HINH_150 Nghĩa vụ điểm: bảng theo tháng (phát hành, dùng, hết hạn, điều chỉnh, số dư cuối), số dư hiện tại.
- Sửa MAN_HINH_88 (chi tiết đơn VComm): điểm đã dùng, tiền điểm, điểm hoàn, điểm dự kiến hoặc đã tích, lý do không tích.

Ứng dụng (`apps/mobile-vcomm`):
- MAN_HINH_151 Điểm của tôi: số dư, giá trị quy đổi hiện hành, điểm sắp hết hạn, lịch sử bút toán.
- MAN_HINH_152 Hạng thành viên: hạng hiện tại, chi tiêu năm nay, mức cần để lên hạng, bảng hạng và hệ số.
- Sửa MAN_HINH_93 Đặt hàng: khối "Dùng điểm" (số dư, tối đa dùng được, nhập số điểm hoặc dùng tối đa, tiền điểm); điểm dự kiến tích.
- Sửa MAN_HINH_96 Chi tiết đơn: điểm đã dùng, điểm hoàn, điểm dự kiến hoặc đã tích.
- Sửa MAN_HINH_76 Tài khoản: thẻ điểm (số dư, hạng) mở MAN_HINH_151.

## 9. Dữ liệu và API (sơ bộ, chi tiết ở bước thiết kế dữ liệu và API)

- Database migration 0086: schema `loyalty`; `loyalty.program_phases`, `loyalty.tiers` (nạp bốn hạng mặc định); quyền `loyalty.view`, `loyalty.manage`.
- Database migration 0087: `loyalty.accounts` (ví điểm: số dư, hạng, khóa), `loyalty.lots`, `loyalty.entries` (trigger chặn sửa, xóa), `loyalty.tier_history`, `loyalty.lock_history`.
- Database migration 0088: `loyalty.order_points` (đơn, giai đoạn, hạng, hệ số, điểm dùng, tiền điểm, điểm hoàn, điểm tích, lý do không tích); `marketplace.orders.points_amount` (tiền điểm, ≥ 0); nguồn bút toán, vai trò định khoản `loyalty_expense` (641), `loyalty_liability` (3388).
- Database migration 0089: `loyalty.adjustments`; loại chứng từ `loyalty.adjustment`, dãy số `DD`.
- API_176 chương trình: giai đoạn, bảng hạng (quản trị).
- API_177 điểm của tôi, hạng (người mua).
- API_178 đặt hàng dùng điểm: sửa API_126 (xem trước, đặt, chi tiết đơn).
- API_179 ví điểm (quản trị): danh sách, chi tiết, sổ cái, khóa, mở.
- API_180 phiếu điều chỉnh: danh sách, lập, gửi duyệt, rút, chi tiết; ghi sổ khi được duyệt.
- API_181 cảnh báo bất thường.
- API_182 báo cáo nghĩa vụ điểm.
- API_183: dự phòng.
- Việc nền: hết hạn, nhắc hạn (hằng ngày), xét hạng (1/1).

Ghép với CONG_VIEC_49: tiền phải trả = tiền hàng + phí giao hàng − `points_amount` − `wallet_amount`; hoàn tiền mặt khi trả hàng trừ phần điểm trước, rồi phần ví. Nhánh hợp nhất sau sửa công thức trong `refund-amounts.ts`, `marketplace-orders.service.ts`, kiểm thử của cả hai.

## 10. Điều kiện đặc biệt

- Điểm không quy ra tiền mặt, không chuyển, không rút; giới hạn phần trăm đơn theo giai đoạn (giảm rủi ro bị coi là ví điện tử, tài liệu `01` mục 6). Cần ý kiến luật sư trước khi phát hành lên môi trường thật (tài liệu `04`, điểm CHƯA XÁC ĐỊNH).
- Giá trị một điểm đổi theo giai đoạn (quyết định người dùng): điểm khách đang có đổi giá trị khi sang giai đoạn mới; nghĩa vụ ghi theo giá trị lúc tích, chênh lệch khi dùng vào 641.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_329 | Giai đoạn: không chồng lấn, đã bắt đầu chỉ sửa ngày kết thúc; bảng hạng hợp lệ; phân quyền | Bắt buộc | KICHBAN_KIEMTHU_486 |
| TIEUCHI_NGHIEMTHU_330 | Sổ cái chỉ thêm (sửa, xóa bị chặn); số dư = tổng bút toán = tổng lô còn lại; không âm | Bắt buộc | KICHBAN_KIEMTHU_487 |
| TIEUCHI_NGHIEMTHU_331 | Tích khi hoàn tất đúng số điểm (tỷ lệ, hệ số, trừ hàng trả, trừ tiền điểm, trần đơn, trần tháng); đơn hủy không tích; người mua thử, ví khóa không tích | Bắt buộc | KICHBAN_KIEMTHU_488, KICHBAN_KIEMTHU_489 |
| TIEUCHI_NGHIEMTHU_332 | Đổi điểm khi đặt: tối thiểu, số dư, giới hạn phần trăm, giai đoạn hiệu lực, ví khóa; tiền thu hộ, tiền cổng đúng; đơn mua chung không dùng điểm | Bắt buộc | KICHBAN_KIEMTHU_490 |
| TIEUCHI_NGHIEMTHU_333 | Hoàn điểm khi hủy (đúng lô, lô hết hạn thêm 30 ngày); khi nhận hàng trả theo tỷ lệ, tiền hoàn mặt trừ phần điểm | Bắt buộc | KICHBAN_KIEMTHU_491 |
| TIEUCHI_NGHIEMTHU_334 | Hết hạn đúng lô, lô sớm dùng trước; nhắc một lần trước 30 ngày | Bắt buộc | KICHBAN_KIEMTHU_492 |
| TIEUCHI_NGHIEMTHU_335 | Hạng theo chi tiêu năm trước và năm nay; lên hạng ngay; 1/1 xét lại; hệ số áp dụng theo hạng lúc đặt | Bắt buộc | KICHBAN_KIEMTHU_493 |
| TIEUCHI_NGHIEMTHU_336 | Khóa, mở ví; điều chỉnh tay qua duyệt, người lập không tự duyệt, trừ không vượt số dư; cảnh báo bất thường đúng ba loại | Bắt buộc | KICHBAN_KIEMTHU_494, KICHBAN_KIEMTHU_495 |
| TIEUCHI_NGHIEMTHU_337 | Bút toán tích, dùng (chênh lệch giá trị), hết hạn, điều chỉnh đúng tài khoản; báo cáo nghĩa vụ khớp sổ cái | Bắt buộc | KICHBAN_KIEMTHU_496 |
| TIEUCHI_NGHIEMTHU_338 | Web, ứng dụng chạy được (máy tính, khổ điện thoại); người mua chỉ thấy ví của mình | Bắt buộc | KICHBAN_KIEMTHU_497 |

## 12. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_486 đến 496: tự động, `apps/api/test/c51-*.test.ts`.
- KICHBAN_KIEMTHU_497: thủ công trên trình duyệt, kèm kiểm thử quyền tự động.

## 13. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại: hoàn tất đơn `completeDue` (CONG_VIEC_24), hủy đơn, `refundReturnedGoods`, hết hạn thanh toán (CONG_VIEC_25), luồng duyệt chứng từ (`ApprovalRequestsService`), dãy số chứng từ, bút toán tự sinh (`LedgerService`), thông báo trong ứng dụng, việc nền hiện có (`apps/api/src/jobs`).

## 14. Thành phần không được thay đổi

Ví hoa hồng, hoa hồng (CONG_VIEC_26); luồng trạng thái đơn VComm, vận chuyển (CONG_VIEC_24); cổng thanh toán (CONG_VIEC_25, 32 đến 42). Chỉ thêm: chốt điểm khi đặt, trừ tiền điểm vào tiền phải trả, hoàn điểm khi hủy, trả hàng, tích khi hoàn tất.

## 15. Các lát và điểm xem trước

- L0: database migration 0086, 0087; chương trình điểm, bảng hạng (API_176; MAN_HINH_146). Xem trước: cài giai đoạn trên web.
- L1: database migration 0088; sổ cái, tích khi hoàn tất, hạng, điểm dự kiến; điểm của tôi, hạng trên ứng dụng (API_177; MAN_HINH_151, 152; sửa 76, 88, 96). Xem trước: hoàn tất đơn thử, xem điểm trên ứng dụng.
- L2: đổi điểm khi đặt, hoàn khi hủy, trả hàng (API_178; sửa MAN_HINH_93, 96, 88). Xem trước: đặt đơn dùng điểm, hủy.
- L3: hết hạn, nhắc hạn, xét hạng 1/1; hạch toán; báo cáo nghĩa vụ (API_182; MAN_HINH_150).
- L4: database migration 0089; ví điểm quản trị, khóa, điều chỉnh có duyệt, cảnh báo (API_179 đến 181; MAN_HINH_147 đến 149).

## 16. Điểm chưa xác định

- Ý kiến luật sư về điểm thưởng (tài liệu `04`); chặn phát hành lên môi trường thật, không chặn xây dựng.

## 17. Quyết định của người dùng (2026-11-11)

1. Tích điểm khi đơn Hoàn tất, theo giá trị hoàn tất; lúc đặt hiện điểm dự kiến.
2. Tỷ lệ tích, giá trị một điểm, giới hạn đổi cấu hình theo từng giai đoạn; giai đoạn áp dụng theo ngày đặt đơn.
3. Giá trị quy đổi một điểm đổi theo giai đoạn.
4. Hạn dùng 12 tháng theo từng lần tích (cấu hình được).
5. Hạng theo năm dương lịch: lên hạng ngay khi chi tiêu năm nay đạt mốc, 1/1 xét lại; quyền lợi là hệ số nhân điểm tích.
6. Hoàn điểm khi hủy (lô hết hạn thêm 30 ngày) và khi trả hàng theo tỷ lệ.
7. Được dùng cả điểm và ví mua sắm trên một đơn, điểm trừ trước; đơn mua chung không dùng điểm, vẫn tích.
8. Chống gian lận: trần điểm, khóa ví điểm, điều chỉnh tay có duyệt, cảnh báo bất thường.
9. Hạch toán: chi phí bán hàng và phải trả khác (641 / 3388).
