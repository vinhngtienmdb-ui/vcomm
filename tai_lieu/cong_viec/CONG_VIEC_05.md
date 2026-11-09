# CONG_VIEC_05: Mini app Kho (MODULE_03, phần web)

- Mô tả: Kho, vị trí kệ, công ty chủ hàng; tồn kho theo lô, serial; giá vốn bình quân; phiếu nhập khác, xuất khác, điều chỉnh qua duyệt; chuyển kho hai bước; kiểm kê; giữ hàng; tồn an toàn; thẻ kho; in tem.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Kho), tài liệu `12` (ứng dụng kho); quyết định của người dùng ngày 2026-11-09 (tài liệu `02`, mục Quyết định: Kho MODULE_03, Kho chứa hàng nhiều công ty).

## 1. Mục tiêu

Mỗi kho biết chính xác, theo thời gian thực, đang có bao nhiêu hàng của từng công ty chủ hàng, theo lô và hạn dùng hoặc serial, ở vị trí nào, giá vốn bao nhiêu. Mọi thay đổi tồn đi qua phiếu kho, ghi thẻ kho không sửa xóa được; phiếu không có chứng từ gốc phải được duyệt. Đây là dữ liệu gốc để Mua hàng nhập kho, Bán hàng giữ hàng và xuất kho, Kế toán hạch toán giá vốn.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_38 đến CHUC_NANG_45 (mục 3) trên mini app web `/inventory`, giao diện dùng được trên điện thoại (quét mã vạch bằng máy quét gõ phím).

Ngoài phạm vi:
- Ứng dụng kho Expo cho điện thoại, máy quét cầm tay Android (công việc sau, dùng lại API của công việc này).
- Nhập kho từ đơn mua, kiểm tra chất lượng khi nhận, xuất kho cho đơn bán, trả hàng (MODULE_04, MODULE_05 gọi dịch vụ kho của công việc này).
- Chuyển hàng giữa công ty con (luôn là mua bán nội bộ, MODULE_04, MODULE_05).
- Hạch toán bút toán kho (MODULE_06); trừ bồi thường vào lương (MODULE_08).
- Hàng của nhà bán gửi kho công ty (làm cùng phần Nhà bán).
- Phương pháp giá vốn khác bình quân gia quyền di động (dữ liệu chừa chỗ).
- Chuyển vị trí trong cùng kho (công việc sau).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_26 | Nhiều kho thuộc chi nhánh, có hoặc không có vị trí kệ; một kho chứa hàng của nhiều công ty con | Quản lý kho, quản trị công ty |
| YCAU_NGHIEPVU_27 | Tồn kho chính xác theo thời gian thực theo công ty chủ hàng, lô và hạn dùng, serial, vị trí; không âm; có giá vốn và thẻ kho | Thủ kho, Kế toán, Bán hàng |
| YCAU_NGHIEPVU_28 | Nhập, xuất không có chứng từ gốc, chuyển kho, kiểm kê có kiểm soát: duyệt, biên bản chênh lệch, quy trách nhiệm | Quản lý kho, Ban giám đốc, Kế toán |
| YCAU_NGHIEPVU_29 | Giữ hàng cho đơn đã xác nhận; cảnh báo hàng dưới tồn an toàn và gợi ý bổ sung; in tem mã vạch | Bán hàng, Mua hàng, Thủ kho |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_38 | Quản lý kho, vị trí kệ, danh sách công ty chủ hàng của kho; cài đặt kho theo công ty | YCAU_NGHIEPVU_26 |
| CHUC_NANG_39 | Xem tồn kho theo kho, chủ hàng, sản phẩm, lô, serial, vị trí; thẻ kho; giá vốn bình quân | YCAU_NGHIEPVU_27 |
| CHUC_NANG_40 | Phiếu nhập khác, phiếu xuất khác qua luồng duyệt; chọn lô gợi ý hết hạn trước, serial | YCAU_NGHIEPVU_27, 28 |
| CHUC_NANG_41 | Phiếu chuyển kho hai bước: xuất, đang vận chuyển, nhận; biên bản chênh lệch | YCAU_NGHIEPVU_28 |
| CHUC_NANG_42 | Kiểm kê toàn kho hoặc từng phần, khóa mặt hàng đang kiểm, phiếu điều chỉnh qua duyệt, quy trách nhiệm bồi thường | YCAU_NGHIEPVU_28 |
| CHUC_NANG_43 | Giữ hàng theo kho và sản phẩm, tự nhả khi hết hạn, gia hạn, nhả tay | YCAU_NGHIEPVU_29 |
| CHUC_NANG_44 | Tồn an toàn tối thiểu, tối đa theo sản phẩm và kho; cảnh báo, gợi ý số lượng mua hoặc chuyển | YCAU_NGHIEPVU_29 |
| CHUC_NANG_45 | In tem mã vạch sản phẩm, tem vị trí ra PDF khổ tem nhiệt | YCAU_NGHIEPVU_29 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_45 | Kho thuộc một chi nhánh của một công ty (công ty sở hữu kho), một chi nhánh nhiều kho; mã kho duy nhất trong công ty. Kho có danh sách công ty chủ hàng được gửi hàng (mặc định công ty sở hữu kho). Kho bật tắt vị trí kệ; kho có vị trí thì mọi dòng tồn có vị trí. Không xóa kho, vị trí; chỉ ngừng dùng khi không còn tồn | YCAU_NGHIEPVU_26 |
| QUYTAC_NGHIEPVU_46 | Nhân viên được gán quyền kho ở chi nhánh sở hữu kho (hoặc phạm vi công ty, tập đoàn bao trùm) thao tác mọi hàng trong kho. Nhân viên công ty chủ hàng chỉ xem tồn của công ty mình. Phiếu kho thuộc công ty chủ hàng: đánh số, chính sách duyệt, hạch toán theo công ty chủ hàng; một phiếu chỉ chứa hàng của một công ty chủ hàng; sản phẩm trên phiếu là sản phẩm của công ty chủ hàng | YCAU_NGHIEPVU_26, 28 |
| QUYTAC_NGHIEPVU_47 | Tồn lưu theo đơn vị cơ sở của sản phẩm, theo kho, công ty chủ hàng, biến thể, lô, vị trí. Không cho tồn âm: mọi lần ghi sổ khóa dòng tồn và kiểm đủ hàng. Hàng theo dõi lô: mỗi dòng nhập có số lô, hạn dùng (bắt buộc khi ngành hàng theo dõi lô), ngày sản xuất. Hàng theo dõi serial: số lượng nguyên theo đơn vị cơ sở, mỗi đơn vị một serial duy nhất trong công ty chủ hàng, serial chỉ ở một nơi tại một thời điểm | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_48 | Giá vốn bình quân gia quyền di động tính theo kho và công ty chủ hàng cho từng biến thể: nhập có giá thì giá vốn mới = (giá trị tồn + giá trị nhập) / (số lượng tồn + số lượng nhập); xuất, điều chỉnh giảm lấy giá vốn hiện hành; hàng serial lấy giá đích danh của từng serial. Tiền lưu 4 chữ số lẻ, hiển thị theo tiền tệ công ty (VND) | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_49 | Thẻ kho ghi mọi biến động: ngày, phiếu, loại, số lượng tăng giảm, giá vốn, giá trị, tồn sau biến động. Thẻ kho chỉ thêm, không sửa, không xóa; sai thì lập phiếu khác để điều chỉnh | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_50 | Phiếu nhập khác, xuất khác, điều chỉnh, chuyển kho: Nháp → Chờ duyệt → Đã duyệt (ghi sổ ngay) hoặc Bị từ chối; Chờ duyệt → Đã rút. Giá trị duyệt là tổng giá trị theo giá vốn (nhập khác theo đơn giá nhập). Công ty chủ hàng chưa có chính sách duyệt hiệu lực cho loại phiếu thì ghi sổ ngay khi gửi. Số phiếu cấp khi gửi. Khi gửi phiếu làm giảm tồn, hàng được giữ cho phiếu đến khi ghi sổ, bị từ chối hoặc rút | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_51 | Xuất hàng theo lô: hệ thống gợi ý lô hết hạn trước, lô không có hạn dùng thì nhập trước xuất trước; chọn lô khác gợi ý phải ghi lý do; không xuất lô đã hết hạn (trừ phiếu xuất hủy hàng, loại lý do "Hủy hàng hết hạn") | YCAU_NGHIEPVU_27 |
| QUYTAC_NGHIEPVU_52 | Chuyển kho chỉ trong cùng công ty chủ hàng, kho đích nhận hàng của công ty đó. Sau duyệt: kho nguồn xác nhận xuất (trừ tồn, hàng sang trạng thái đang vận chuyển, giữ nguyên giá vốn), kho đích xác nhận nhận theo số thực nhận. Nhận thiếu, thừa lập biên bản chênh lệch ghi số lượng, giá trị; phần thiếu ghi người chịu trách nhiệm và tiền bồi thường (mặc định bằng giá trị thiếu) trên biên bản, Tài chính – Kế toán hạch toán tổn thất từ biên bản (quyết định ngày 2026-11-10). Hàng đang vận chuyển tính vào tồn của công ty, không tính vào tồn khả dụng của kho nào | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_53 | Kiểm kê toàn kho hoặc từng phần (theo ngành hàng, vị trí, danh sách sản phẩm) của một công ty chủ hàng. Bắt đầu kiểm thì chụp số tồn sổ sách và khóa các mặt hàng, vị trí trong phạm vi: không ghi sổ phiếu khác vào chúng đến khi kết thúc. Kết thúc: chênh lệch sinh phiếu điều chỉnh đi luồng duyệt; dòng thiếu ghi người chịu trách nhiệm và số tiền bồi thường (mặc định bằng giá trị thiếu, sửa được) | YCAU_NGHIEPVU_28 |
| QUYTAC_NGHIEPVU_54 | Tồn khả dụng = tồn thực − hàng đang giữ. Giữ hàng theo kho, công ty chủ hàng, biến thể, số lượng, nguồn (đơn bán, phiếu kho), hạn giữ; không giữ quá tồn khả dụng. Giữ cho đơn bán tự nhả sau số giờ cài đặt theo công ty chủ hàng (mặc định 72 giờ); người có quyền gia hạn, nhả tay được; giữ cho phiếu kho không có hạn | YCAU_NGHIEPVU_29 |
| QUYTAC_NGHIEPVU_55 | Tồn an toàn đặt theo kho, công ty chủ hàng, biến thể: tối thiểu, tối đa (tối đa không nhỏ hơn tối thiểu). Tồn khả dụng cộng hàng đang chuyển đến dưới tối thiểu thì cảnh báo trên màn hình và thông báo hằng ngày cho người có quyền quản lý kho; số gợi ý bổ sung = tối đa − (tồn khả dụng + đang chuyển đến) | YCAU_NGHIEPVU_29 |

## 5. Dữ liệu liên quan

Database migration `0004_inventory.sql`, schema `inventory` (tài liệu `16` bổ sung):

| Bảng | Nội dung chính |
|---|---|
| `inventory.settings` | Công ty, số giờ giữ hàng mặc định (72) |
| `inventory.warehouses` | Công ty sở hữu, chi nhánh, mã, tên, địa chỉ, dùng vị trí kệ, trạng thái, phiên bản |
| `inventory.warehouse_owners` | Kho, công ty chủ hàng được gửi hàng |
| `inventory.locations` | Kho, mã vị trí, tên, trạng thái |
| `inventory.lots` | Công ty chủ hàng, biến thể, số lô, ngày sản xuất, hạn dùng |
| `inventory.serials` | Công ty chủ hàng, biến thể, số serial, kho, vị trí, trạng thái (trong kho, đang vận chuyển, đã xuất), giá vốn |
| `inventory.balances` | Kho, công ty chủ hàng, biến thể, lô, vị trí, số lượng (đơn vị cơ sở) |
| `inventory.costs` | Kho, công ty chủ hàng, biến thể, số lượng, giá trị, giá vốn bình quân |
| `inventory.documents` | Công ty chủ hàng, kho, kho đích (chuyển kho), loại, số phiếu, ngày, lý do, trạng thái, yêu cầu duyệt, nguồn (để trống: không có chứng từ gốc), kiểm kê nguồn, người lập, ngày xuất, ngày nhận, phiên bản |
| `inventory.document_lines` | Phiếu, biến thể, đơn vị, số lượng, số lượng đơn vị cơ sở, đơn giá, lô (số lô, hạn dùng khi nhập), vị trí, vị trí đích, lý do đổi lô, số thực nhận (chuyển kho), người chịu trách nhiệm, tiền bồi thường (điều chỉnh từ kiểm kê) |
| `inventory.document_line_serials` | Dòng phiếu, serial |
| `inventory.movements` | Thẻ kho (chỉ thêm): kho, công ty chủ hàng, biến thể, lô, vị trí, serial, số lượng có dấu, giá vốn, giá trị, tồn sau, phiếu, dòng, thời điểm |
| `inventory.transfer_discrepancies` | Biên bản chênh lệch chuyển kho: phiếu, dòng, số xuất, số nhận, chênh lệch, giá trị, ghi chú |
| `inventory.stocktakes`, `inventory.stocktake_lines` | Kiểm kê: công ty chủ hàng, kho, phạm vi, trạng thái; dòng: biến thể, lô, vị trí, tồn sổ sách, số đếm, chênh lệch, người chịu trách nhiệm, tiền bồi thường |
| `inventory.reservations` | Kho, công ty chủ hàng, biến thể, số lượng, nguồn (loại, mã), hạn giữ, trạng thái (đang giữ, đã nhả, đã dùng) |
| `inventory.stock_levels` | Kho, công ty chủ hàng, biến thể, tối thiểu, tối đa |

Loại chứng từ mới (dãy số tự tạo khi gửi lần đầu, đặt lại theo năm): `inventory.receipt_other` "Phiếu nhập khác" (`NK`), `inventory.issue_other` "Phiếu xuất khác" (`XK`), `inventory.adjustment` "Phiếu điều chỉnh kho" (`DCK`), `inventory.transfer` "Phiếu chuyển kho" (`CK`), `inventory.stocktake` "Phiếu kiểm kê" (`KK`, không duyệt). Phiếu chỉ ghi vào schema `inventory`; đọc sản phẩm, đơn vị từ `catalog`.

## 6. Giao diện liên quan

Mini app mới `apps/web-inventory`, đường dẫn `/inventory`, dùng khung trang `packages/ui`.

| Mã | Màn hình | Ghi chú |
|---|---|---|
| MAN_HINH_28 | Kho và vị trí | Danh sách kho; thêm, sửa kho, công ty chủ hàng, bật vị trí; danh sách vị trí; cài đặt giữ hàng |
| MAN_HINH_29 | Tồn kho | Lọc kho, công ty chủ hàng, ngành hàng; tìm theo tên, mã hàng, mã vạch; tồn thực, đang giữ, khả dụng, đang chuyển đến, giá vốn, giá trị; mở chi tiết lô, serial, vị trí |
| MAN_HINH_30 | Thẻ kho | Một biến thể tại một kho: tồn đầu kỳ, biến động, tồn cuối kỳ trong khoảng ngày |
| MAN_HINH_31 | Danh sách phiếu kho | Lọc loại, trạng thái, kho, ngày; lập phiếu mới |
| MAN_HINH_32 | Phiếu nhập khác, xuất khác, điều chỉnh | Lập phiếu (quét mã vạch thêm dòng), chọn lô gợi ý, serial, vị trí; gửi duyệt, rút; liên kết MAN_HINH_08 |
| MAN_HINH_33 | Phiếu chuyển kho | Lập, gửi duyệt; kho nguồn xác nhận xuất; kho đích nhập số thực nhận, xác nhận nhận; biên bản chênh lệch |
| MAN_HINH_34 | Kiểm kê | Lập phạm vi, bắt đầu (khóa), nhập số đếm (quét mã vạch), kết thúc sinh phiếu điều chỉnh, ghi người chịu trách nhiệm |
| MAN_HINH_35 | Giữ hàng và tồn an toàn | Thẻ Giữ hàng: danh sách, gia hạn, nhả; thẻ Tồn an toàn: đặt tối thiểu, tối đa, danh sách cảnh báo kèm số gợi ý |

In tem là nút trên MAN_HINH_28 (tem vị trí), MAN_HINH_29 và MAN_HINH_32 (tem sản phẩm).

## 7. API liên quan

| Mã | Endpoint | Nội dung |
|---|---|---|
| API_63 | `/inventory/warehouses` (kèm `/{id}/deactivate`, `/{id}/activate`), `/inventory/warehouse-options`, `/inventory/warehouses/{id}/locations` (kèm `/{locationId}/deactivate`, `/{locationId}/activate`), `/inventory/settings` | Kho, vị trí, công ty chủ hàng, cài đặt |
| API_64 | `/inventory/stock`, `/inventory/stock/{variantId}/details`, `/inventory/stock-card` | Tồn kho, chi tiết lô, serial, vị trí, thẻ kho |
| API_65 | `/inventory/documents` (kèm `/{id}/submit`, `/{id}/withdraw`, `/lot-suggestions`), `/inventory/items` | Phiếu nhập khác, xuất khác, điều chỉnh; tìm mặt hàng theo mã vạch, mã hàng, tên |
| API_66 | `/inventory/transfer-destinations`, `/inventory/documents/{id}/ship`, `/inventory/documents/{id}/receive` | Kho đích, xuất, nhận phiếu chuyển kho; biên bản chênh lệch |
| API_67 | `/inventory/stocktakes` (kèm `/{id}/start`, `/{id}/counts`, `/{id}/finish`, `/{id}/cancel`), `/inventory/stocktake-options` | Kiểm kê |
| API_68 | `/inventory/reservations` (kèm `/{id}/extend`, `/{id}/release`) | Giữ hàng; dịch vụ giữ hàng trong API cho MODULE_05 |
| API_69 | `/inventory/stock-levels` (kèm `/{warehouseId}/{companyId}/{variantId}` để xóa), `/inventory/stock-alerts` | Tồn an toàn, cảnh báo |
| API_70 | `/inventory/labels/products`, `/inventory/labels/locations` | Tem PDF |

## 8. Phân quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `inventory.access` | Công ty, chi nhánh | Không | (đã có) Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.warehouse.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.stock.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.cost.view` | Công ty | Có | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.document.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.stocktake.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.reservation.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |

Vai trò hệ thống mới "Thủ kho" (`warehouse_keeper`): `inventory.access`, `inventory.stock.view`, `inventory.document.manage`. "Quản lý kho" (`warehouse_manager`): mọi quyền `inventory.*`. Quyền ở phạm vi chi nhánh áp dụng cho kho thuộc chi nhánh đó. Người không có `inventory.cost.view` không thấy giá vốn, giá trị.

## 9. Điều kiện đặc biệt

- Đồng thời: ghi sổ khóa dòng tồn, dòng giá vốn theo thứ tự cố định để không bế tắc; hai phiếu cùng xuất món hàng cuối cùng thì một phiếu bị từ chối với lý do không đủ hàng.
- Quét mã vạch: ô nhập nhận chuỗi từ máy quét gõ phím kèm Enter, tìm biến thể và đơn vị theo mã vạch của công ty chủ hàng.
- Tem PDF dùng `pdfmake` (đã có), khổ 50 × 30 mm, mã vạch Code 128.
- Tác vụ nền (BullMQ, đã có): nhả giữ hàng hết hạn mỗi 5 phút; thông báo cảnh báo tồn an toàn 7 giờ sáng giờ Việt Nam.
- Dịch vụ kho (ghi sổ, giữ hàng) viết để MODULE_04, MODULE_05 gọi trong giao dịch của mình (như dịch vụ duyệt của MODULE_01).

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_65 | CHUC_NANG_38 | Kho thuộc chi nhánh; người chỉ có quyền chi nhánh khác không thấy, không thao tác kho; nhân viên công ty chủ hàng chỉ thấy tồn của công ty mình; phiếu chứa sản phẩm của công ty khác chủ hàng bị từ chối | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_66 | CHUC_NANG_39, 40 | Nhập khác có duyệt: tồn, giá vốn chỉ đổi sau khi duyệt; giá vốn bình quân đúng công thức qua hai lần nhập giá khác nhau; thẻ kho đúng tồn sau từng biến động | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_67 | CHUC_NANG_40 | Xuất quá tồn khả dụng bị từ chối; hai phiếu xuất đồng thời món hàng cuối cùng chỉ một phiếu ghi sổ; tồn không bao giờ âm | Kiểm thử tự động | Bắt buộc |
| TIEUCHI_NGHIEMTHU_68 | CHUC_NANG_40 | Gợi ý lô hết hạn trước; chọn lô khác không có lý do bị từ chối; lô hết hạn không xuất được; serial trùng, serial không có trong kho bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_69 | CHUC_NANG_41 | Chuyển kho: sau xuất, tồn kho nguồn giảm, hàng đang vận chuyển, kho đích chưa tăng; nhận thiếu sinh biên bản chênh lệch đúng số lượng, giá trị; chuyển sang kho không nhận hàng của công ty chủ hàng bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_70 | CHUC_NANG_42 | Trong lúc kiểm kê, phiếu ghi sổ vào mặt hàng đang kiểm bị từ chối, mặt hàng ngoài phạm vi vẫn ghi được; kết thúc sinh phiếu điều chỉnh đúng chênh lệch, duyệt xong tồn bằng số đếm | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_71 | CHUC_NANG_43 | Không giữ quá tồn khả dụng; giữ hết hạn tự nhả; gia hạn, nhả tay ghi nhật ký thao tác | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_72 | CHUC_NANG_44 | Hàng dưới tối thiểu xuất hiện trong cảnh báo với số gợi ý đúng; tối đa nhỏ hơn tối thiểu bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_73 | CHUC_NANG_45 | Tem PDF đúng khổ, mã vạch đọc được, đủ số tem yêu cầu | Kiểm thử tự động, xem bằng mắt | Mong muốn |
| TIEUCHI_NGHIEMTHU_74 | CHUC_NANG_39 | Danh sách tồn kho 50.000 dòng tồn trả trang đầu dưới 500 ms; ghi sổ phiếu 200 dòng dưới 2 giây | Kiểm thử tự động | Mong muốn |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_147 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện: PDF dùng `pdfmake`, tác vụ nền dùng BullMQ (đã có).
- Số lượng `numeric(20,4)`, tiền `numeric(20,4)`; tính giá vốn trong cơ sở dữ liệu để không sai số.
- Khóa ngoại từ `inventory` chỉ trỏ vào `inventory`, `catalog`, `core`.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu (CONG_VIEC_01 đến CONG_VIEC_04).

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0004, quyền, vai trò; `apps/web-inventory`; kho, vị trí, chủ hàng, cài đặt | MAN_HINH_28; API_63 | TIEUCHI_NGHIEMTHU_65 (phần kho) |
| L1 | Phiếu nhập khác, xuất khác, điều chỉnh; ghi sổ, tồn, lô, serial, giá vốn, thẻ kho | MAN_HINH_29, 30, 31, 32; API_64, 65 | TIEUCHI_NGHIEMTHU_65 đến 68, 74 |
| L2 | Chuyển kho hai bước | MAN_HINH_33; API_66 | TIEUCHI_NGHIEMTHU_69 |
| L3 | Kiểm kê | MAN_HINH_34; API_67 | TIEUCHI_NGHIEMTHU_70 |
| L4 | Giữ hàng, tồn an toàn, cảnh báo, in tem | MAN_HINH_35; API_68, 69, 70 | TIEUCHI_NGHIEMTHU_71, 72, 73 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
