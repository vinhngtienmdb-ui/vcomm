# CONG_VIEC_08: Bán hàng (MODULE_05, phần 1)

- Mô tả: Đơn bán giá theo bảng giá kênh, nhóm khách; duyệt khi có ngoại lệ; giữ hàng khi gửi đơn; phiếu xuất giao hàng theo đơn, giao nhiều lần; trả hàng bán gắn đơn gốc.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Bán hàng); quyết định của người dùng ngày 2026-11-09 (nghiệp vụ Bán hàng) và ngày 2026-11-10 (chia công việc, chiết khấu tay, giá tối thiểu, dư nợ tạm tính) trong tài liệu `02`.

## 1. Mục tiêu

Công ty con bán hàng có kiểm soát: giá lấy đúng bảng giá theo kênh, nhóm khách; đơn chỉ phải duyệt khi có ngoại lệ (chiết khấu tay vượt mức, bán dưới giá vốn, vượt hạn mức công nợ); hàng được giữ ngay khi gửi đơn để không bán trùng; kho giao theo đơn nhiều lần; khách trả hàng gắn đúng đơn gốc.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_54 đến CHUC_NANG_57.

Ngoài phạm vi (công việc sau):
- Khuyến mãi (giảm theo sản phẩm, theo đơn, mua X tặng Y).
- Giao vận GHN, GHTK, Viettel Post; mỗi lần giao một hóa đơn điện tử (cùng MODULE_06).
- Giao dịch nội bộ giữa công ty con (bán nội bộ sinh phiếu nhập chờ công ty mua nhận).
- Dư nợ thật theo thanh toán (MODULE_06 thay cách tính tạm ở QUYTAC_NGHIEPVU_69).
- Đơn bán ngoại tệ; CONG_VIEC_08 chỉ bán bằng tiền tệ của công ty.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_34 | Lập đơn bán đúng giá bảng giá theo kênh, nhóm khách; đơn chỉ duyệt khi có ngoại lệ; hàng được giữ khi gửi đơn | Nhân viên bán hàng, quản lý |
| YCAU_NGHIEPVU_35 | Kho giao hàng theo đơn, giao nhiều lần; khách trả hàng gắn đơn gốc, trả một phần | Thủ kho, Bán hàng, Kế toán |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_54 | Đơn bán: khách hàng (hoặc người mua không lấy hóa đơn), kênh bán, kho xuất, dòng hàng giá theo bảng giá, chiết khấu tay; gửi, duyệt khi có ngoại lệ, hủy, đóng; theo dõi đã giao, đã trả | YCAU_NGHIEPVU_34 |
| CHUC_NANG_55 | Cài đặt bán hàng theo công ty: mức chiết khấu tay tối đa không cần duyệt | YCAU_NGHIEPVU_34 |
| CHUC_NANG_56 | Phiếu xuất giao hàng theo đơn bán, giao nhiều lần, dùng hàng đã giữ | YCAU_NGHIEPVU_35 |
| CHUC_NANG_57 | Phiếu nhận hàng trả lại theo phiếu xuất giao hàng gốc, trả một phần | YCAU_NGHIEPVU_35 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_67 | Đơn bán thuộc công ty; khách là đối tác có hồ sơ khách hàng đang dùng ở công ty, hoặc để trống (người mua không lấy hóa đơn, ghi tên người mua nếu có). Kho xuất là kho đang dùng nhận hàng của công ty. Giá dòng tra theo bảng giá của công ty với kênh bán của đơn và nhóm khách của hồ sơ khách tại ngày đơn (QUYTAC_NGHIEPVU_42, 43); không có giá thì không lập được dòng. Giá gồm hay chưa gồm thuế theo bảng giá; thuế suất theo sản phẩm | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_68 | Chiết khấu tay theo phần trăm từng dòng (0 đến 100). Đơn có ngoại lệ phải đi luồng duyệt (loại chứng từ `sales.order`; chưa có chính sách duyệt thì xác nhận ngay như các chứng từ khác): chiết khấu dòng vượt mức chiết khấu tay tối đa của công ty (mặc định 0%); giá sau chiết khấu chưa thuế quy về đơn vị cơ sở thấp hơn giá vốn bình quân hiện hành tại kho xuất; vượt hạn mức công nợ. Không có ngoại lệ thì xác nhận ngay | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_69 | Dư nợ tạm tính của khách (đến khi có MODULE_06): giá trị gồm thuế phần chưa giao của các đơn đã xác nhận, cộng giá trị gồm thuế đã giao trong số ngày được nợ gần nhất của hồ sơ khách. Dư nợ cộng giá trị đơn đang gửi vượt hạn mức công nợ thì là ngoại lệ. Hạn mức để trống là không giới hạn; khách để trống không kiểm | YCAU_NGHIEPVU_34 |
| QUYTAC_NGHIEPVU_70 | Gửi đơn thì giữ hàng ngay tại kho xuất theo tổng số lượng cơ sở từng mặt hàng (không đủ hàng khả dụng thì không gửi được); thời hạn giữ theo cài đặt kho của công ty. Bị từ chối, rút, hủy, đóng thì nhả phần còn giữ; giao hàng dùng phần đang giữ trước | YCAU_NGHIEPVU_34, 35 |
| QUYTAC_NGHIEPVU_71 | Phiếu xuất giao hàng chỉ theo đơn đã xác nhận chưa đóng; tổng đã giao mỗi dòng không vượt số đặt; xuất theo giá vốn bình quân tại kho; giao đủ mọi dòng thì đơn chuyển "Đã giao đủ". Đơn đã có giao hàng không hủy được, chỉ đóng (phần chưa giao hủy) | YCAU_NGHIEPVU_35 |
| QUYTAC_NGHIEPVU_72 | Phiếu nhận hàng trả lại lập từ phiếu xuất giao hàng đã ghi sổ; tổng trả mỗi dòng không vượt số đã giao trừ số đã trả; nhập lại theo giá vốn trên phiếu xuất gốc; hàng serial chỉ trả serial đã giao; lô theo dòng gốc. Phiếu xuất giao hàng, phiếu nhận hàng trả lại có chứng từ gốc nên không đi luồng duyệt | YCAU_NGHIEPVU_35 |

## 5. Vai trò và quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `sales.access` | Công ty | Không | (đã có) |
| `sales.order.view` | Công ty (chi nhánh dùng được) | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho |
| `sales.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.sales.issue` | Chi nhánh sở hữu kho | Không | Thủ kho, Quản lý kho, quản trị công ty |

Vai trò hệ thống mới "Nhân viên bán hàng" (`salesperson`): `sales.access`, `sales.order.view`, `sales.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view`.

## 6. Luồng nghiệp vụ

1. Nhân viên bán hàng lập đơn: chọn khách (hoặc để trống), kênh, kho xuất; thêm mặt hàng, giá tự lấy theo bảng giá; nhập chiết khấu tay nếu có; gửi.
2. Hệ thống giữ hàng; không có ngoại lệ thì xác nhận ngay, có ngoại lệ thì gửi duyệt kèm danh sách ngoại lệ.
3. Thủ kho chọn đơn đã xác nhận, lập phiếu xuất giao hàng (lô, serial, vị trí), gửi; giao nhiều lần đến hết.
4. Khách trả hàng: thủ kho lập phiếu nhận hàng trả lại từ phiếu xuất gốc.

## 7. Màn hình

| Mã | Màn hình | Mô tả |
|---|---|---|
| MAN_HINH_42 | Đơn bán | Mini app Bán hàng; danh sách lọc trạng thái, khách; cài đặt chiết khấu tay tối đa |
| MAN_HINH_43 | Chi tiết, soạn đơn bán | Khách, kênh, kho, dòng hàng giá theo bảng giá, chiết khấu; ngoại lệ cần duyệt; đã giao, đã trả, phiếu kho liên quan; gửi, hủy, đóng |
| MAN_HINH_31, 32 (sửa) | Phiếu kho của mini app Kho | Thêm phiếu xuất giao hàng (chọn đơn bán), phiếu nhận hàng trả lại (chọn phiếu xuất gốc) |

## 8. Dữ liệu và API

- Database migration `0007_sales.sql`: schema `sales` (`settings`, `orders`, `order_lines`); thêm loại phiếu `sales_issue`, `sales_return`, lý do `sale`, `sales_return` vào `inventory.documents`.
- Số đã giao, đã trả của dòng đơn bán tính từ phiếu kho, không lưu trùng.

| Mã | Đường dẫn | Mô tả |
|---|---|---|
| API_77 | `/sales/orders` | Đơn bán: lập, sửa, gửi, rút, hủy, đóng; tra giá dòng; danh sách chọn |
| API_78 | `/sales/settings` | Cài đặt bán hàng |
| API_79 | `/inventory/sales-orders`, `/inventory/sales-issues`, `/inventory/sales-returns` | Đơn bán chờ giao, phiếu xuất giao hàng, phiếu nhận hàng trả lại |

## 9. Điều kiện đặc biệt

- Giữ hàng dùng `ReservationsService` có sẵn, nguồn `sales.order`; giao hàng giảm phần giữ tương ứng.
- Dư nợ tạm tính thay bằng dư nợ thật khi làm MODULE_06.

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_87 | CHUC_NANG_54 | Giá dòng lấy đúng bảng giá theo kênh, nhóm khách; mặt hàng không có giá bị từ chối; khách chưa có hồ sơ khách hàng bị từ chối; người mua không lấy hóa đơn lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_88 | CHUC_NANG_54, 55 | Không ngoại lệ thì xác nhận ngay; chiết khấu vượt mức, dưới giá vốn, vượt hạn mức công nợ thì chờ duyệt kèm đúng ngoại lệ; duyệt thì xác nhận, từ chối thì nhả hàng giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_89 | CHUC_NANG_54 | Gửi đơn giữ hàng; không đủ hàng khả dụng không gửi được; hủy, đóng nhả phần còn giữ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_90 | CHUC_NANG_56 | Giao nhiều lần không vượt số đặt; xuất theo giá vốn bình quân; giao đủ thì đơn "Đã giao đủ"; đơn chưa xác nhận, đã đóng không giao được; đơn đã giao không hủy được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_91 | CHUC_NANG_57 | Trả hàng nhập lại theo giá vốn phiếu xuất gốc; trả quá số đã giao, serial chưa giao bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_92 | CHUC_NANG_54 | Công ty khác không xem được đơn bán; thủ kho chi nhánh khác không giao từ kho không thuộc chi nhánh mình | Gọi API | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_172 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Bán hàng ghi `sales`; phiếu xuất giao hàng, phiếu nhận hàng trả lại do module Kho ghi (đọc đơn bán). Khóa ngoại từ `sales` chỉ trỏ vào `sales`, `core`, `catalog`, `crm`.
- Dùng lại tra giá của bảng giá, luồng duyệt, dãy số chứng từ, sổ kho, giữ hàng có sẵn.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu, trừ phần sửa ghi ở mục 7, 8.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0007, quyền, vai trò, `apps/web-sales` (`/sales`, cổng 3005); đơn bán, ngoại lệ, duyệt, giữ hàng, hủy, đóng; cài đặt | MAN_HINH_42, 43; API_77, API_78 | TIEUCHI_NGHIEMTHU_87, 88, 89, 92 |
| L1 | Phiếu xuất giao hàng, phiếu nhận hàng trả lại | MAN_HINH_31, 32; API_79 | TIEUCHI_NGHIEMTHU_90, 91, 92 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
