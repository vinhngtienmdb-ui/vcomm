# CONG_VIEC_50: Báo cáo quản trị phần 1 (MODULE_15)

- Mô tả: Mini app Báo cáo quản trị (`web-analytics`) cho toàn tập đoàn, chỉ đọc dữ liệu đã có: doanh số bán hàng (theo kênh, công ty, sản phẩm, thời gian, gồm đơn VComm), tồn kho và luân chuyển, công nợ phải thu, phải trả theo tuổi nợ, hoa hồng và ví; lọc theo công ty con trong phạm vi quyền; xuất Excel.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đặc tả đã duyệt 2026-11-11; đang làm bản mẫu giao diện.
- Mức: Lớn (module mới, mini app mới, quyền mới, dữ liệu nhiều công ty).
- Nhánh: `chuc-nang/CONG_VIEC_50-bao-cao-quan-tri` tách từ `origin/main`.
- Nguồn: tài liệu `01` mục 4 (MODULE_15), `05` mục 2 (MODULE_15 Báo cáo quản trị toàn tập đoàn); quyết định của người dùng ngày 2026-11-11 (mục 16).

## 1. Mục tiêu

Ban điều hành tập đoàn và lãnh đạo từng công ty xem nhanh tình hình bán hàng, hàng tồn, công nợ, hoa hồng trên cùng một nơi, số liệu khớp với sổ của các module nghiệp vụ, không phải tự gộp bảng tính.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_175 đến CHUC_NANG_177; mini app mới `apps/web-analytics`; bốn quyền xem báo cáo.

Ngoài phạm vi (phần sau của MODULE_15 hoặc chưa có dữ liệu):
- Biểu đồ, bảng điều khiển tùy chỉnh, báo cáo tự định nghĩa, gửi báo cáo định kỳ qua thư.
- Báo cáo mua hàng, nhân sự, lương, cộng đồng, điểm thưởng.
- Công nợ theo tuổi nợ tại một ngày trong quá khứ (sổ công nợ chỉ lưu số còn lại hiện tại).
- Quy đổi số liệu công ty khác đồng tiền hạch toán.
- Bảng tổng hợp lưu sẵn (bảng tính trước, materialized view): chỉ làm khi kiểm thử hiệu năng cho thấy cần.
- Phí giao hàng của đơn VComm (doanh thu dịch vụ giao hàng, không phải doanh số hàng hóa).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_86 | Xem doanh số hàng đã giao theo kênh, công ty, sản phẩm, thời gian, gồm đơn VComm; có giá vốn, lãi gộp; tổng tập đoàn không đếm bán nội bộ | Ban điều hành, giám đốc công ty, trưởng phòng kinh doanh |
| YCAU_NGHIEPVU_87 | Xem tồn kho và luân chuyển hàng (đầu kỳ, nhập, xuất, cuối kỳ, vòng quay) theo công ty, kho, sản phẩm | Ban điều hành, quản lý kho |
| YCAU_NGHIEPVU_88 | Xem công nợ phải thu, phải trả theo tuổi nợ của mọi công ty | Ban điều hành, kế toán trưởng |
| YCAU_NGHIEPVU_89 | Xem hoa hồng đã ghi có, đang chờ, rút tiền, số dư ví của người hưởng | Ban điều hành, kế toán trưởng |
| YCAU_NGHIEPVU_90 | Lọc theo công ty trong phạm vi quyền (tập đoàn xem mọi công ty, công ty xem công ty mình); xuất Excel đúng số đang xem | Mọi người xem báo cáo |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_175 | Mini app Báo cáo quản trị: phạm vi xem theo quyền, bộ lọc công ty, khoảng ngày, trang tổng quan chỉ tiêu chính, xuất Excel, nhật ký xuất | YCAU_NGHIEPVU_90 |
| CHUC_NANG_176 | Báo cáo bán hàng (doanh số, giá vốn, lãi gộp theo kênh, công ty, sản phẩm, thời gian) và báo cáo tồn kho, luân chuyển | YCAU_NGHIEPVU_86, 87 |
| CHUC_NANG_177 | Báo cáo công nợ theo tuổi nợ (phải thu, phải trả) và báo cáo hoa hồng, ví | YCAU_NGHIEPVU_88, 89 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_336: Phạm vi xem. Mỗi báo cáo cần quyền truy cập mini app (`analytics.access`) và quyền của nhóm báo cáo (mục 5), xét trong công ty đang chọn. Quyền gán ở phạm vi tập đoàn: xem mọi công ty của tập đoàn (công ty gốc của công ty đang chọn và mọi công ty con các cấp, cách xác định như QUYTAC_NGHIEPVU_123). Quyền gán ở phạm vi công ty: chỉ xem công ty đó. Quyền gán ở phạm vi chi nhánh không có hiệu lực với báo cáo quản trị (báo cáo theo công ty). Bộ lọc công ty chỉ liệt kê công ty được xem, mặc định chọn tất cả; yêu cầu chứa công ty ngoài phạm vi bị từ chối (lỗi không có quyền), không trả số liệu một phần. Quyền xét riêng từng nhóm: người được xem bán hàng ở phạm vi tập đoàn nhưng chỉ được xem công nợ ở phạm vi công ty thì báo cáo công nợ chỉ có công ty đó.
- QUYTAC_NGHIEPVU_337: Doanh số theo hàng đã giao. Doanh số trong kỳ = phiếu xuất giao hàng (`sales_issue`) đã ghi sổ có ngày phiếu trong kỳ trừ phiếu nhận hàng trả lại (`sales_return`) đã ghi sổ có ngày phiếu trong kỳ (hàng trả trừ vào kỳ nhận trả, không sửa kỳ bán). Số tiền chưa thuế giá trị gia tăng tính bằng đúng hàm chia số tiền của bút toán doanh thu (`finance.inventory_amounts`), nên tổng doanh số mỗi công ty khớp số ghi tài khoản doanh thu của các phiếu đó. Giá vốn = giá trị xuất kho đã ghi sổ của dòng phiếu (như bút toán giá vốn); phiếu dịch vụ không có giá vốn. Lãi gộp = doanh số − giá vốn; tỷ lệ lãi gộp = lãi gộp ÷ doanh số (doanh số bằng 0 thì để trống). Số lượng theo đơn vị cơ sở. Hàng tặng có doanh số 0, vẫn tính số lượng, giá vốn. Đơn VComm là đơn bán sinh từ đơn người mua trên ứng dụng VComm; không tính đơn của tài khoản người mua thử; phí giao hàng không tính. Kênh là kênh bán của đơn bán; đơn VComm thuộc kênh bán đã chọn trong cài đặt bán hàng VComm.
- QUYTAC_NGHIEPVU_338: Bán nội bộ. Dòng bán cho khách hàng là đối tác nội bộ (đối tác gắn một công ty) thuộc cùng tập đoàn là bán nội bộ. Số liệu từng công ty gồm cả bán nội bộ, có cột "Trong đó bán nội bộ". Dòng tổng có hai số: "Cộng các công ty" và "Tổng loại trừ nội bộ" (trừ phần bán cho công ty thuộc tập đoàn, kể cả công ty không nằm trong bộ lọc). Áp dụng tương tự cho công nợ: cột "Trong đó nội bộ" là công nợ với đối tác nội bộ.
- QUYTAC_NGHIEPVU_339: Tiền tệ. Số tiền của từng công ty theo đồng tiền hạch toán của công ty đó. Dòng tổng chỉ cộng các công ty cùng đồng tiền hạch toán với công ty gốc; công ty khác đồng tiền vẫn hiện dòng riêng, ghi chú "Không cộng vào tổng (khác đồng tiền)". Làm tròn theo số lẻ của đồng tiền.
- QUYTAC_NGHIEPVU_340: Tồn kho và luân chuyển theo công ty chủ hàng, kho, sản phẩm (biến thể), lấy từ thẻ kho (`inventory.movements`), ngày theo giờ Việt Nam như thẻ kho: tồn đầu kỳ = cộng biến động trước từ ngày; nhập trong kỳ = biến động tăng; xuất trong kỳ = biến động giảm (số dương); tồn cuối kỳ = đầu kỳ + nhập − xuất; mỗi chỉ tiêu có số lượng và giá trị. Giá vốn hàng bán trong kỳ = giá vốn theo QUYTAC_NGHIEPVU_337. Vòng quay hàng tồn kho = giá vốn hàng bán trong kỳ ÷ giá trị tồn bình quân ((tồn đầu kỳ + tồn cuối kỳ) ÷ 2); số ngày tồn kho = số ngày của kỳ ÷ vòng quay; tồn bình quân hoặc giá vốn bằng 0 thì để trống. Chuyển kho là xuất của kho đi, nhập của kho đến; xem gộp theo công ty thì cột nhập, xuất gồm cả hai phần đó, tồn cuối kỳ của công ty không đổi.
- QUYTAC_NGHIEPVU_341: Công nợ theo tuổi nợ dùng nguyên cách tính của sổ công nợ (QUYTAC_NGHIEPVU_91) tại ngày hôm nay: số dư, chưa đến hạn, quá hạn 1 đến 30, 31 đến 60, 61 đến 90, trên 90 ngày, trả trước; xem theo công ty (phải thu, phải trả) hoặc theo đối tác của các công ty đã chọn. Không có khoảng ngày.
- QUYTAC_NGHIEPVU_342: Hoa hồng và ví thuộc công ty có đơn VComm (công ty vận hành VComm). Trong kỳ: hoa hồng đã ghi có (theo thời điểm ghi có) theo loại phần hưởng (giới thiệu, nhân viên, trưởng nhóm, giám đốc vùng, giám đốc) và theo người hưởng; yêu cầu rút tiền đã chi (theo ngày chi): số tiền, thuế thu nhập cá nhân khấu trừ, phí, thực nhận. Tại hôm nay: hoa hồng đang chờ (đơn chưa hoàn tất), yêu cầu rút đang chờ duyệt, tổng số dư ví. Người hưởng hiện họ tên, không hiện số điện thoại, tài khoản ngân hàng.
- QUYTAC_NGHIEPVU_343: Giới hạn và xuất. Báo cáo theo kỳ bắt buộc từ ngày, đến ngày; từ ngày không sau đến ngày; tối đa 366 ngày; mặc định từ đầu tháng đến hôm nay. Bảng chi tiết (theo sản phẩm, đối tác, người hưởng) hiện tối đa 500 dòng xếp theo số tiền giảm dần, dòng tổng luôn tính trên toàn bộ dữ liệu, có ghi chú khi bị cắt. Xuất Excel cùng bộ lọc, đúng số trên màn hình, tối đa 20.000 dòng (vượt thì báo thu hẹp bộ lọc). Mỗi lần xuất ghi nhật ký thao tác (người xuất, báo cáo, bộ lọc). Báo cáo chỉ đọc, không ghi dữ liệu nghiệp vụ.

## 5. Vai trò và quyền

| Quyền | Tên | Nhạy cảm |
|---|---|---|
| `analytics.access` | Truy cập mini app Báo cáo quản trị | Không |
| `analytics.sales.view` | Xem báo cáo bán hàng | Không |
| `analytics.inventory.view` | Xem báo cáo tồn kho và luân chuyển | Không |
| `analytics.debt.view` | Xem báo cáo công nợ | Có |
| `analytics.commission.view` | Xem báo cáo hoa hồng và ví | Có |

Vai trò hệ thống có sẵn quyền (bổ sung, không bớt quyền cũ):

| Vai trò | Quyền báo cáo quản trị |
|---|---|
| Quản trị tập đoàn | Cả năm quyền |
| Quản trị công ty | Cả năm quyền (gán ở phạm vi công ty nên chỉ xem công ty mình) |
| Kế toán trưởng | Cả năm quyền |
| Kế toán | `analytics.access`, `analytics.debt.view`, `analytics.commission.view` |
| Quản lý kho | `analytics.access`, `analytics.inventory.view` |

Các vai trò khác không có sẵn; quản trị gán thêm bằng vai trò tự tạo.

## 6. Luồng nghiệp vụ

Người dùng mở ô "Báo cáo quản trị" trên trang chủ → trang tổng quan (chỉ tiêu theo quyền) → chọn báo cáo → chọn công ty, khoảng ngày, cách nhóm → xem → xuất Excel.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_140 | Tổng quan báo cáo quản trị | Thẻ chỉ tiêu theo quyền: doanh số, lãi gộp, giá trị tồn cuối kỳ, phải thu (trong đó quá hạn), phải trả, hoa hồng đã ghi có; bảng doanh số theo công ty; liên kết sang từng báo cáo |
| MAN_HINH_141 | Báo cáo bán hàng | Bộ lọc công ty, khoảng ngày, kênh, chỉ đơn VComm; nhóm theo công ty, kênh, sản phẩm, ngày, tháng; bảng doanh số, số lượng, giá vốn, lãi gộp, tỷ lệ, trong đó bán nội bộ; dòng tổng hai số; xuất Excel |
| MAN_HINH_142 | Báo cáo tồn kho và luân chuyển | Bộ lọc công ty, kho, khoảng ngày; nhóm theo công ty, kho, sản phẩm; bảng đầu kỳ, nhập, xuất, cuối kỳ (số lượng, giá trị), giá vốn hàng bán, vòng quay, số ngày tồn; xuất Excel |
| MAN_HINH_143 | Báo cáo công nợ theo tuổi nợ | Thẻ phải thu, phải trả; xem theo công ty hoặc đối tác; cột tuổi nợ, trả trước, trong đó nội bộ; xuất Excel |
| MAN_HINH_144 | Báo cáo hoa hồng và ví | Thẻ chỉ tiêu; bảng theo loại phần hưởng, theo người hưởng; bảng rút tiền đã chi; xuất Excel |

MAN_HINH_145 chưa dùng (giữ trong dải, không cấp cho màn hình khác).

## 8. Dữ liệu và API

Không thêm bảng nghiệp vụ. Database migration:
- 0083: dòng `core.apps` của mini app `analytics`; chỉ mục phục vụ báo cáo: `inventory.documents (company_id, type, document_date) WHERE status = 'posted'`, `inventory.movements (company_id, moved_at)`, `marketplace.order_commissions (credited_at) WHERE status = 'credited'`.
- 0084, 0085: chưa dùng.

| Mã | Phương thức, đường dẫn | Mô tả |
|---|---|---|
| API_170 | `GET /api/v1/analytics/scope` | Công ty được xem theo từng nhóm báo cáo, đồng tiền, công ty gốc |
| API_171 | `GET /api/v1/analytics/sales` | Báo cáo bán hàng (`companyIds`, `from`, `to`, `groupBy`, `channelId`, `marketplaceOnly`, `format=xlsx`) |
| API_172 | `GET /api/v1/analytics/inventory` | Báo cáo tồn kho và luân chuyển (`companyIds`, `warehouseId`, `from`, `to`, `groupBy`, `format=xlsx`) |
| API_173 | `GET /api/v1/analytics/debts` | Công nợ theo tuổi nợ (`companyIds`, `side`, `groupBy`, `format=xlsx`) |
| API_174 | `GET /api/v1/analytics/commissions` | Hoa hồng và ví (`from`, `to`, `groupBy`, `format=xlsx`) |
| API_175 | `GET /api/v1/analytics/overview` | Chỉ tiêu tổng quan theo quyền (`companyIds`, `from`, `to`) |

## 9. Điều kiện đặc biệt

- Không tính lại khác đi: doanh số dùng `finance.inventory_amounts`, giá vốn dùng giá trị xuất kho đã ghi sổ, tuổi nợ dùng cùng biểu thức của sổ công nợ (tách thành hàm dùng chung, sổ công nợ không đổi kết quả), tồn kho theo thẻ kho, hoa hồng theo bảng hoa hồng đơn và ví.
- Hiệu năng: lọc theo công ty và khoảng ngày nằm trong truy vấn; chỉ mục ở mục 8; giới hạn 366 ngày, 500 dòng hiện, 20.000 dòng xuất. Mục tiêu: mỗi báo cáo trả về dưới 3 giây với 1.000.000 dòng thẻ kho, 200.000 dòng phiếu.
- Mini app `web-analytics`: đường dẫn `/analytics`, cổng phát triển 3009, biến `ANALYTICS_ORIGIN` ở `web-platform` (cổng 3007 đã dùng cho Nhân sự, 3008 để trống cho phiên Cộng đồng chạy song song).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_321 | Phạm vi xem đúng quyền: tập đoàn xem mọi công ty, công ty chỉ xem công ty mình, chi nhánh không xem được; công ty ngoài phạm vi bị từ chối; menu, thẻ chỉ tiêu theo quyền từng nhóm | Bắt buộc | KICHBAN_KIEMTHU_476, 477 |
| TIEUCHI_NGHIEMTHU_322 | Doanh số theo hàng đã giao trừ hàng trả theo kỳ, chưa thuế; tổng doanh số, giá vốn từng công ty khớp số ghi tài khoản doanh thu, giá vốn của các phiếu; lãi gộp, tỷ lệ đúng | Bắt buộc | KICHBAN_KIEMTHU_478 |
| TIEUCHI_NGHIEMTHU_323 | Nhóm theo công ty, kênh, sản phẩm, ngày, tháng đúng; gồm đơn VComm, lọc riêng đơn VComm; không tính người mua thử, phí giao hàng | Bắt buộc | KICHBAN_KIEMTHU_479 |
| TIEUCHI_NGHIEMTHU_324 | Bán nội bộ, công nợ nội bộ tách cột; tổng loại trừ nội bộ đúng; công ty khác đồng tiền không cộng vào tổng | Bắt buộc | KICHBAN_KIEMTHU_480 |
| TIEUCHI_NGHIEMTHU_325 | Tồn đầu, nhập, xuất, cuối kỳ khớp thẻ kho; tồn cuối kỳ đến hôm nay khớp tồn hiện tại; vòng quay, số ngày tồn đúng, để trống khi chia cho 0 | Bắt buộc | KICHBAN_KIEMTHU_481 |
| TIEUCHI_NGHIEMTHU_326 | Tuổi nợ phải thu, phải trả từng công ty khớp sổ công nợ; xem theo đối tác đúng | Bắt buộc | KICHBAN_KIEMTHU_482 |
| TIEUCHI_NGHIEMTHU_327 | Hoa hồng ghi có theo phần hưởng, người hưởng, đang chờ, rút tiền đã chi (thuế, phí, thực nhận), số dư ví khớp dữ liệu hoa hồng và ví | Bắt buộc | KICHBAN_KIEMTHU_483 |
| TIEUCHI_NGHIEMTHU_328 | Khoảng ngày bắt buộc, tối đa 366 ngày; bảng cắt 500 dòng có ghi chú, tổng trên toàn bộ; Excel đúng số trên màn hình, ghi nhật ký xuất; báo cáo không ghi dữ liệu nghiệp vụ; thời gian phản hồi đạt mục tiêu (Mong muốn) | Bắt buộc | KICHBAN_KIEMTHU_484, 485 |

## 11. Kịch bản kiểm thử

| Mã | Kịch bản | Tiêu chí |
|---|---|---|
| KICHBAN_KIEMTHU_476 | Người có quyền phạm vi tập đoàn, công ty, chi nhánh lần lượt gọi API_170, 171: số công ty trả về; gọi với công ty ngoài phạm vi bị 403 | TIEUCHI_NGHIEMTHU_321 |
| KICHBAN_KIEMTHU_477 | Người chỉ có quyền bán hàng: API công nợ, hoa hồng, tồn kho bị 403; tổng quan chỉ có chỉ tiêu bán hàng; quyền xét riêng từng nhóm | TIEUCHI_NGHIEMTHU_321 |
| KICHBAN_KIEMTHU_478 | Hai đơn bán, giao một phần, trả một phần (trả trong kỳ sau), hàng tặng, phiếu dịch vụ: doanh số, giá vốn từng kỳ; so với tổng phát sinh tài khoản doanh thu, giá vốn của bút toán các phiếu | TIEUCHI_NGHIEMTHU_322 |
| KICHBAN_KIEMTHU_479 | Đơn bán thường và đơn VComm (một đơn của người mua thử) ở hai kênh: nhóm theo công ty, kênh, sản phẩm, ngày, tháng; lọc chỉ đơn VComm | TIEUCHI_NGHIEMTHU_323 |
| KICHBAN_KIEMTHU_480 | Công ty A bán cho công ty B trong tập đoàn và cho khách ngoài; công ty khác đồng tiền: cột nội bộ, tổng loại trừ, ghi chú khác đồng tiền; công nợ nội bộ | TIEUCHI_NGHIEMTHU_324 |
| KICHBAN_KIEMTHU_481 | Nhập mua, xuất bán, chuyển kho, điều chỉnh qua nhiều ngày: tồn đầu, nhập, xuất, cuối kỳ theo kho, công ty; so với thẻ kho và tồn hiện tại; vòng quay; kỳ không phát sinh | TIEUCHI_NGHIEMTHU_325 |
| KICHBAN_KIEMTHU_482 | Công nợ phải thu, phải trả nhiều hạn thanh toán, trả trước, đã trừ một phần: so với API sổ công nợ (API_85) từng công ty; theo đối tác | TIEUCHI_NGHIEMTHU_326 |
| KICHBAN_KIEMTHU_483 | Đơn VComm có hoa hồng ghi có, đơn đang chờ, rút tiền đã chi có thuế và phí, rút tiền đang chờ: số theo phần hưởng, người hưởng, rút tiền, số dư ví | TIEUCHI_NGHIEMTHU_327 |
| KICHBAN_KIEMTHU_484 | Thiếu ngày, từ ngày sau đến ngày, 367 ngày bị từ chối đúng ô; trên 500 dòng có ghi chú cắt và tổng đúng; số dòng các bảng nghiệp vụ không đổi sau khi gọi báo cáo | TIEUCHI_NGHIEMTHU_328 |
| KICHBAN_KIEMTHU_485 | Xuất Excel từng báo cáo: đọc lại tệp, số khớp JSON; nhật ký thao tác có dòng xuất; đo thời gian phản hồi với dữ liệu sinh số lượng lớn | TIEUCHI_NGHIEMTHU_328 |

## 12. Ràng buộc kỹ thuật

- Backend: module mới `apps/api/src/analytics`, chỉ đọc; truy vấn Drizzle `sql` có tham số, không ghép chuỗi; điều kiện phạm vi công ty nằm trong truy vấn.
- Xuất Excel bằng `write-excel-file` đã có; không thêm thư viện.
- Giao diện: mini app mới theo khung `web-finance` (`AppShell`, chuyển công ty, tệp dịch `packages/i18n`, thành phần `packages/ui`).
- Kiểm thử tích hợp Vitest với PostgreSQL thật: `apps/api/test/c50-*.test.ts`.

## 13. Thành phần không được thay đổi

Mọi cách tính, dữ liệu, API hiện có của Kho, Bán hàng, Tài chính – Kế toán, VComm. Riêng biểu thức tuổi nợ trong `finance/debts.service.ts` được tách ra hàm dùng chung, kết quả sổ công nợ giữ nguyên (kiểm thử CONG_VIEC_13 phải đạt). Danh mục quyền chỉ thêm, vai trò hệ thống chỉ thêm quyền.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Người dùng xem, thử | Phản hồi |
|---|---|---|---|
| L0 | Mini app `web-analytics`, ô trang chủ, quyền, database migration 0083, API_170, khung menu | Mở mini app bằng tài khoản quản trị tập đoàn và quản trị công ty: menu theo quyền, bộ lọc công ty | |
| L1 | Báo cáo bán hàng: API_171, MAN_HINH_141, xuất Excel | Xem doanh số dữ liệu thử theo từng cách nhóm, xuất Excel | |
| L2 | Tồn kho và luân chuyển: API_172, MAN_HINH_142 | Xem nhập xuất tồn theo kho, vòng quay | |
| L3 | Công nợ theo tuổi nợ: API_173, MAN_HINH_143 | So với sổ công nợ ở mini app Tài chính | |
| L4 | Hoa hồng và ví: API_174, MAN_HINH_144; tổng quan: API_175, MAN_HINH_140; kiểm thử hiệu năng | Xem tổng quan, hoa hồng | |

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.

## 16. Quyết định của người dùng

- 2026-11-11: doanh số tính theo hàng đã giao (phiếu xuất giao hàng đã ghi sổ trừ hàng trả lại), chưa thuế, kèm giá vốn, lãi gộp; mini app mới `web-analytics`; quyền riêng từng nhóm báo cáo (bán hàng, tồn kho, công nợ, hoa hồng và ví); tổng tập đoàn tách riêng và loại trừ bán nội bộ.
- 2026-11-11: duyệt đặc tả; vòng quay hàng tồn kho = giá vốn hàng bán ÷ tồn bình quân; quyền có sẵn cho vai trò hệ thống theo mục 5; chọn phương án 3 của phân tích giải pháp có sẵn.

## Phân tích giải pháp có sẵn – CONG_VIEC_50 – 2026-11-11

- Yêu cầu cần đáp ứng: YCAU_NGHIEPVU_86 đến 90.
- Nguồn đã tìm: mã nguồn dự án (sổ công nợ, thẻ kho, bút toán doanh thu, báo cáo hợp nhất, xuất Excel); nguồn riêng `V-com-ERP` (bản làm trước, không có tầng báo cáo dùng được với cấu trúc dữ liệu hiện tại); công cụ báo cáo mã nguồn mở (Metabase, Apache Superset).
- Từ khóa đã dùng: "open source BI dashboard PostgreSQL", "embedded reporting row level security".

| Ứng viên | Nguồn | Giấy phép | Tương thích công nghệ | Bảo mật | Công sức điều chỉnh |
|---|---|---|---|---|---|
| Hàm, biểu thức đã có trong dự án | Mã nguồn VComm | Của dự án | Hoàn toàn | Dùng phân quyền hiện có | Thấp |
| Metabase | metabase.com | AGPL (bản cộng đồng); nhúng có phân quyền theo dòng cần bản trả phí | Dịch vụ Java riêng, kết nối trực tiếp cơ sở dữ liệu | Phải dựng lại phân quyền công ty, vượt quyền đọc schema | Cao |
| Apache Superset | superset.apache.org | Apache 2.0 | Dịch vụ Python riêng | Phân quyền theo dòng phải cấu hình riêng, không dùng phiên VComm | Cao |

- Phương án: (1) dùng lại nguyên trạng không có; (2) dùng lại có điều chỉnh: Metabase hoặc Superset nhúng; (3) tham khảo cách làm, tự viết: dùng hàm, biểu thức đã có trong dự án; (4) tự viết mới hoàn toàn.
- Đề xuất: phương án 3. Lý do: yêu cầu bắt buộc số liệu tính đúng như các module (hàm có sẵn trong dự án), phân quyền theo phiên VComm và phạm vi công ty; công cụ BI ngoài thêm dịch vụ, phải dựng lại phân quyền, rủi ro lộ dữ liệu giữa công ty.
- Quyết định của người dùng: phương án 3 – 2026-11-11.
