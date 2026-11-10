# CONG_VIEC_09: Giao dịch nội bộ giữa công ty con (MODULE_05, phần 2)

- Mô tả: Đơn bán nội bộ sinh đơn mua đối ứng ở công ty mua và ngược lại; bên kia xác nhận theo luồng duyệt riêng; xuất giao hàng sinh phiếu nhập chờ bên mua nhận; nhận thiếu lập biên bản chênh lệch để bên bán xử lý.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ. Bản 0.2 sửa cho khớp mã đã làm (giá đơn bán đối ứng, đường dẫn tra giá nội bộ, chặn nhập mua thường đơn nội bộ, rút, không duyệt đơn đối ứng, người lập đơn đối ứng, biên bản dòng nhận 0, dung sai làm tròn khi nhận đủ).
- Nguồn: tài liệu `04` mục ràng buộc 1 (giao dịch nội bộ tự sinh chứng từ hai phía); tài liệu `05` mục 2.1 (Bán hàng), phiên bản 0.3; quyết định của người dùng ngày 2026-11-09 (khởi tạo từ phía nào cũng được, chứng từ đối ứng chờ bên kia xác nhận, xuất kho sinh phiếu nhập chờ bên mua nhận, giá nội bộ theo bảng giá kênh "Nội bộ" của công ty bán, liên kết sản phẩm giữa công ty, chuyển hàng giữa công ty con luôn là mua bán nội bộ) và ngày 2026-11-10 (xác nhận theo duyệt riêng, biên bản chênh lệch, ngoại lệ như đơn thường) trong tài liệu `02`.

## 1. Mục tiêu

Hai công ty con mua bán với nhau chỉ nhập liệu một lần ở bên khởi tạo; bên kia nhận chứng từ đối ứng để xác nhận; hàng xuất ở bên bán tự thành phiếu nhập chờ ở bên mua; số giao, số nhận khớp nhau, phần lệch có biên bản và người xử lý.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_58 đến CHUC_NANG_61.

Ngoài phạm vi (công việc sau):
- Trả hàng nội bộ (bên mua trả lại bên bán).
- Hóa đơn, công nợ nội bộ, loại trừ khi hợp nhất (MODULE_06).
- Giao dịch nội bộ bằng ngoại tệ; hai công ty phải cùng tiền tệ.
- Khuyến mãi (CONG_VIEC sau).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_36 | Mua bán giữa công ty con tự sinh chứng từ hai phía, bên kia xác nhận; hàng giao, hàng nhận khớp nhau, lệch có biên bản | Bán hàng, Mua hàng, Thủ kho, Kế toán các công ty con |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_58 | Đơn bán cho khách là công ty con: khi xác nhận sinh đơn mua đối ứng chờ công ty mua xác nhận (chọn kho nhận, đi luồng duyệt đơn mua) hoặc từ chối | YCAU_NGHIEPVU_36 |
| CHUC_NANG_59 | Đơn mua của nhà cung cấp là công ty con: giá theo bảng giá kênh "Nội bộ" của công ty bán; khi duyệt sinh đơn bán đối ứng chờ công ty bán xác nhận (chọn kho xuất, kiểm ngoại lệ, giữ hàng) hoặc từ chối | YCAU_NGHIEPVU_36 |
| CHUC_NANG_60 | Phiếu xuất giao hàng nội bộ sinh phiếu nhập chờ nhận ở công ty mua; thủ kho bên mua nhận theo số thực nhận | YCAU_NGHIEPVU_36 |
| CHUC_NANG_61 | Biên bản chênh lệch giao nhận nội bộ: bên bán xử lý nhập lại kho bên bán hoặc ghi tổn thất | YCAU_NGHIEPVU_36 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_73 | Đơn bán là nội bộ khi khách là đối tác nội bộ (đối tác gắn công ty con, QUYTAC_NGHIEPVU_58); đơn mua là nội bộ khi nhà cung cấp là đối tác nội bộ. Đơn nội bộ: kênh bán phải là kênh mã `NOI_BO` của công ty bán; mỗi mặt hàng phải có liên kết sản phẩm với công ty bên kia (QUYTAC_NGHIEPVU_41), thiếu liên kết thì không gửi được; hai công ty phải cùng tiền tệ | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_74 | Chứng từ đối ứng sinh khi chứng từ bên khởi tạo được xác nhận (đơn bán) hoặc được duyệt (đơn mua), ở trạng thái "Chờ xác nhận nội bộ", chưa có kho, chưa có số, ngày đơn bằng ngày đơn khởi tạo; dòng thứ tự như chứng từ khởi tạo. Mặt hàng quy theo liên kết sản phẩm, số lượng theo đơn vị cơ sở bên kia (nhân hệ số liên kết). Bên kia (người có quyền quản lý đơn bán hoặc đơn mua của công ty đó) chọn kho rồi xác nhận; người xác nhận trở thành người lập đơn đối ứng ở công ty mình (rút được yêu cầu duyệt của mình): đơn mua đối ứng đi luồng duyệt đơn mua; đơn bán đối ứng đi luồng gửi đơn bán (kiểm ngoại lệ, giữ hàng, QUYTAC_NGHIEPVU_68 đến 70). Bên kia từ chối (ghi lý do), rút đơn đối ứng đang chờ duyệt, hoặc đơn đối ứng không được duyệt thì đơn đối ứng kết thúc (đơn bán hủy, đơn mua đóng) và chứng từ khởi tạo kết thúc theo QUYTAC_NGHIEPVU_78 với lý do tương ứng | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_75 | Giá nội bộ: dòng đơn mua nội bộ khởi tạo lấy giá chưa thuế từ bảng giá kênh `NOI_BO` của công ty bán theo nhóm khách của hồ sơ công ty mua tại công ty bán, tại ngày đơn (QUYTAC_NGHIEPVU_42, 43): tra theo mặt hàng liên kết, đơn vị cơ sở của công ty bán (bảng giá gồm thuế thì trừ thuế theo thuế suất sản phẩm bên bán), quy về đơn vị dòng đơn mua theo hệ số liên kết, làm tròn 4 chữ số; thuế suất theo sản phẩm bên bán. Giá, thuế suất nhập tay bị thay; không có giá thì không lập được dòng. Đơn mua đối ứng sinh từ đơn bán lấy tiền chưa thuế của dòng đơn bán (sau chiết khấu) chia số lượng bên mua, làm tròn 4 chữ số; thuế suất theo dòng bên bán. Đơn bán đối ứng sinh từ đơn mua lấy giá chưa thuế, thuế suất theo dòng đơn mua (đơn mua đã tra bảng giá kênh Nội bộ khi lập), không tra lại bảng giá, không chiết khấu | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_76 | Đơn bán nội bộ chỉ giao khi đơn mua đối ứng đã duyệt. Phiếu xuất giao hàng nội bộ khi ghi sổ sinh phiếu nhập mua ở công ty mua, kho nhận của đơn mua, trạng thái "Chờ nhận", đơn giá theo đơn mua; lô, hạn dùng, serial theo phiếu xuất. Thủ kho bên mua nhận: số nhận mỗi dòng không vượt số xuất, hàng serial chỉ nhận serial đã xuất, chọn vị trí nếu kho dùng vị trí; mọi dòng phải có số nhận; ghi sổ số thực nhận (không qua kiểm tra chất lượng, không qua luồng duyệt), phiếu lấy số khi nhận; dòng nhận 0 bỏ khỏi phiếu. Đơn mua nội bộ không lập được phiếu nhập mua thường, không hiện trong danh sách đơn chờ nhận; chỉ nhận theo phiếu nhập sinh từ phiếu xuất. Đơn mua "Đã nhận đủ" khi mọi dòng nhận đủ, cho phép lệch làm tròn 0,0005 đơn vị cơ sở | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_77 | Nhận thiếu thì phải ghi lý do; mỗi dòng xuất thiếu sinh một biên bản chênh lệch thuộc công ty bán (một phiếu nhập, một dòng xuất có tối đa một biên bản; dòng nhận 0 thì biên bản không có dòng nhập): số thiếu theo đơn vị cơ sở bên bán, giá trị theo giá vốn trên phiếu xuất tỷ lệ với số thiếu, serial chưa nhận, lý do của bên nhận. Bên bán (người có quyền xuất giao hàng tại kho xuất) xem, xử lý một lần; giá trị chỉ hiện cho người xem được giá vốn: "Nhập lại kho" sinh và ghi sổ phiếu nhận hàng trả lại vào kho xuất theo giá vốn phiếu xuất (QUYTAC_NGHIEPVU_72); "Ghi tổn thất" chỉ đóng biên bản, ghi chú không bắt buộc (hạch toán tổn thất làm cùng MODULE_06) | YCAU_NGHIEPVU_36 |
| QUYTAC_NGHIEPVU_78 | Một bên hủy, đóng, từ chối, rút đơn đối ứng hoặc đơn đối ứng không được duyệt thì bên kia kết thúc phần chưa giao với lý do nêu bên và thao tác (ví dụ "Bên mua từ chối: <lý do>", "Bên bán hủy đơn bán đối ứng"): đơn bán chưa có phiếu xuất thì hủy, đã có thì đóng, nhả hàng giữ; đơn mua chưa nhận đủ, chưa đóng thì đóng. Yêu cầu duyệt còn chờ của bên kia được rút. Bên bán còn phiếu xuất giao hàng nháp thì không kết thúc được. Đơn đối ứng không sửa dòng được, khi "Chờ xác nhận nội bộ" chỉ chọn kho, xác nhận hoặc từ chối; đơn mua nội bộ khởi tạo đã có đơn bán đối ứng cũng không sửa được | YCAU_NGHIEPVU_36 |

## 5. Vai trò và quyền

Không thêm quyền, vai trò. Dùng `sales.order.manage` (xác nhận, từ chối đơn bán đối ứng), `purchasing.order.manage` (đơn mua đối ứng), `inventory.purchase.receive` tại kho nhận (nhận hàng nội bộ), `inventory.sales.issue` tại kho xuất (xử lý biên bản chênh lệch).

## 6. Luồng nghiệp vụ

Bên bán khởi tạo:
1. Công ty A lập đơn bán cho khách là công ty B, kênh "Nội bộ"; gửi; xác nhận (ngay hoặc sau duyệt ngoại lệ).
2. Hệ thống sinh đơn mua đối ứng ở B, "Chờ xác nhận nội bộ".
3. B chọn kho nhận, xác nhận; đơn mua đi luồng duyệt của B; duyệt xong A mới giao được.

Bên mua khởi tạo:
1. Công ty B lập đơn mua với nhà cung cấp là công ty A; giá tự lấy theo bảng giá "Nội bộ" của A; gửi duyệt.
2. Duyệt xong, hệ thống sinh đơn bán đối ứng ở A, "Chờ xác nhận nội bộ".
3. A chọn kho xuất, xác nhận; đơn bán kiểm ngoại lệ, giữ hàng như đơn thường.

Giao nhận:
1. Thủ kho A lập phiếu xuất giao hàng theo đơn bán nội bộ, gửi; hệ thống sinh phiếu nhập "Chờ nhận" ở kho nhận của B.
2. Thủ kho B nhận theo số thực nhận; nhận thiếu thì sinh biên bản chênh lệch ở A.
3. A xử lý biên bản: nhập lại kho hoặc ghi tổn thất.

## 7. Màn hình

| Mã | Màn hình | Mô tả |
|---|---|---|
| MAN_HINH_44 | Biên bản chênh lệch nội bộ | Mini app Kho; danh sách biên bản của công ty bán lọc trạng thái; xử lý nhập lại kho hoặc ghi tổn thất |
| MAN_HINH_43 (sửa) | Chi tiết đơn bán | Nhãn "Nội bộ", liên kết đơn mua đối ứng; đơn "Chờ xác nhận nội bộ": chọn kho xuất, xác nhận, từ chối |
| MAN_HINH_40, 41 (sửa) | Đơn mua | Nhà cung cấp nội bộ: giá tự lấy, khóa sửa; chi tiết có nhãn "Nội bộ", liên kết đơn bán đối ứng; "Chờ xác nhận nội bộ": chọn kho nhận, xác nhận, từ chối |
| MAN_HINH_31, 32 (sửa) | Phiếu kho | Phiếu nhập nội bộ "Chờ nhận": nhập số thực nhận, serial, vị trí, lý do thiếu |

## 8. Dữ liệu và API

- Database migration `0008_internal_trade.sql`:
  - `sales.orders`: thêm `counterpart_order_id` (đơn mua đối ứng, kiểm trong service), `is_counterpart` (đơn sinh từ đơn mua), `counterpart_rejected_reason`; trạng thái thêm `counterpart_pending`; `warehouse_id` cho phép trống khi `counterpart_pending`, `cancelled`, `closed`.
  - `purchasing.orders`: thêm `counterpart_order_id`, `is_counterpart`, `counterpart_rejected_reason`; trạng thái thêm `counterpart_pending`; `warehouse_id` cho phép trống như trên.
  - `inventory.documents`: phiếu nhập mua nội bộ dùng trạng thái `in_transit` (đã có) cho "Chờ nhận", `source_type` `purchasing.order`; thêm `counterpart_document_id` (phiếu xuất gốc bên bán). `inventory.document_lines`: thêm `counterpart_line_id` (dòng xuất gốc).
  - Bảng mới `inventory.internal_discrepancies` (công ty bán, kho xuất, phiếu xuất, dòng xuất, phiếu nhập, dòng nhập có thể trống khi dòng nhận 0, mặt hàng, số thiếu, giá trị, serial, lý do, trạng thái `open`/`returned`/`written_off`, phiếu nhận hàng trả lại, ghi chú, người và thời điểm xử lý); duy nhất theo (phiếu nhập, dòng xuất).
- Bên Bán hàng gọi `PurchaseOrdersService` để sinh, đóng đơn mua đối ứng và ngược lại; mỗi module chỉ ghi schema của mình.

| Mã | Đường dẫn | Mô tả |
|---|---|---|
| API_80 | `/sales/orders/{id}/counterpart-confirm`, `/sales/orders/{id}/counterpart-reject` | Xác nhận (chọn kho xuất), từ chối đơn bán đối ứng |
| API_81 | `/purchasing/orders/{id}/counterpart-confirm`, `/purchasing/orders/{id}/counterpart-reject`; tra giá nội bộ qua `/purchasing/supplier-prices/lookup` (API_73, trả thêm `internal.vatRate` khi nhà cung cấp nội bộ) | Xác nhận (chọn kho nhận), từ chối đơn mua đối ứng; tra giá nội bộ |
| API_82 | `/inventory/internal-receipts/{id}/receive`, `/inventory/internal-discrepancies`, `/inventory/internal-discrepancies/{id}/resolve` | Nhận hàng nội bộ; biên bản chênh lệch, xử lý |

## 9. Điều kiện đặc biệt

- Đối tác nội bộ cần hồ sơ khách hàng (ở công ty bán) và hồ sơ nhà cung cấp (ở công ty mua) như đối tác thường; hạn mức công nợ nội bộ dùng như đơn thường.
- Hàng trên đường (đã xuất bên bán, chưa nhận bên mua) không thuộc tồn kho bên nào.

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_93 | CHUC_NANG_58 | Đơn bán nội bộ xác nhận thì sinh đúng đơn mua đối ứng (mặt hàng, số lượng quy theo liên kết, giá); thiếu liên kết, sai kênh không gửi được; bên mua xác nhận đi luồng duyệt; từ chối thì đơn bán hủy, nhả hàng giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_94 | CHUC_NANG_59 | Đơn mua nội bộ lấy giá bảng giá "Nội bộ" bên bán, không sửa tay; duyệt thì sinh đơn bán đối ứng; bên bán xác nhận kiểm ngoại lệ, giữ hàng; từ chối thì đơn mua đóng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_95 | CHUC_NANG_60 | Chưa duyệt đơn mua đối ứng thì không giao; xuất ghi sổ sinh phiếu nhập chờ nhận đúng mặt hàng, số lượng, đơn giá, serial; nhận vượt, serial không xuất bị từ chối; nhận đủ thì đơn mua "Đã nhận đủ" | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_96 | CHUC_NANG_61 | Nhận thiếu sinh biên bản đúng số, giá trị; nhập lại kho ghi sổ phiếu trả vào kho xuất; ghi tổn thất đóng biên bản; mỗi biên bản xử lý một lần | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_97 | CHUC_NANG_58, 59 | Hủy, đóng một bên thì bên kia đóng phần chưa giao; công ty thứ ba không xem được chứng từ; người không có quyền ở công ty bên kia không xác nhận được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_98 | CHUC_NANG_58 đến 61 | Giao diện hiện nhãn nội bộ, liên kết chứng từ đối ứng, nút xác nhận, từ chối, form nhận hàng, danh sách biên bản trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_185 đến KICHBAN_KIEMTHU_190 tự động (`apps/api/test/c9-internal-trade.test.ts`); KICHBAN_KIEMTHU_191, KICHBAN_KIEMTHU_192 thủ công trên trình duyệt (tài liệu `21`).

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Bán hàng ghi `sales`, Mua hàng ghi `purchasing`, Kho ghi `inventory`; sinh, đổi chứng từ bên kia qua service của module sở hữu, trong cùng giao dịch cơ sở dữ liệu.
- Dùng lại tra giá, luồng duyệt, dãy số chứng từ, sổ kho, giữ hàng, liên kết sản phẩm, đối tác nội bộ có sẵn.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu, trừ phần sửa ghi ở mục 7, 8.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0008; nhận diện đơn nội bộ, giá nội bộ; sinh chứng từ đối ứng hai chiều; xác nhận, từ chối; hủy, đóng hai bên | MAN_HINH_40, 41, 43; API_80, API_81 | TIEUCHI_NGHIEMTHU_93, 94, 97 |
| L1 | Xuất giao hàng nội bộ sinh phiếu nhập chờ nhận; nhận hàng; biên bản chênh lệch, xử lý | MAN_HINH_31, 32, 44; API_82 | TIEUCHI_NGHIEMTHU_95, 96, 98 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
