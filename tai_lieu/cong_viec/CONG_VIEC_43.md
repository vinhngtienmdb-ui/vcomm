# CONG_VIEC_43: Sửa các công việc đã nghiệm thu theo mô hình B2C (THAY_DOI_18)

- Mô tả: Sửa CONG_VIEC_08, 09, 17, 21 theo THAY_DOI_14 (bán hàng hóa chỉ qua sàn VComm, công ty nội bộ chỉ bán dịch vụ cho nhau, hoa hồng theo đơn vào ví).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng quyết định hướng sửa và thiết kế ngày 2026-11-11 (tài liệu `02`). Đang thực hiện.
- Nguồn: THAY_DOI_14, THAY_DOI_18; CONG_VIEC_08, 09, 17, 20, 21 (đã nghiệm thu, chưa phát hành).

## 1. Mục tiêu

Hệ thống chạy đúng mô hình B2C: hàng hóa chỉ bán qua sàn VComm; giữa các công ty nội bộ chỉ bán dịch vụ; không còn hoa hồng theo tiền thu và giao khách thủ công.

## 2. Phạm vi

Trong phạm vi:
- Loại sản phẩm Hàng hóa hoặc Dịch vụ; dịch vụ không theo dõi tồn kho.
- CONG_VIEC_09: giao dịch nội bộ chỉ cho mặt hàng dịch vụ.
- CONG_VIEC_17: xóa hẳn hoa hồng đội kinh doanh cũ (mã, màn hình, quyền, bảng dữ liệu, kiểm thử).
- CONG_VIEC_21: tắt giao khách; bỏ giới hạn xem theo người phụ trách.
- CONG_VIEC_08: đơn bán tay chỉ gồm dịch vụ; Kế toán lập đơn bán dịch vụ; Nhân viên bán hàng không lập đơn bán.

Ngoài phạm vi: CONG_VIEC_20 giữ nguyên (loại trừ hàng hóa nội bộ bằng 0 khi không phát sinh); xóa dữ liệu giao khách, giao dịch nội bộ đã có; hoa hồng theo đơn VComm (CONG_VIEC_26) không đổi.

## 3. Yêu cầu chức năng

- CHUC_NANG_157: Loại sản phẩm Hàng hóa, Dịch vụ; đơn bán, giao dịch nội bộ dịch vụ không qua kho.
- CHUC_NANG_158: Gỡ hoa hồng đội kinh doanh cũ; tắt giao khách; giới hạn đơn bán tay.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_275: Sản phẩm có loại Hàng hóa (mặc định) hoặc Dịch vụ. Dịch vụ không theo dõi tồn kho, lô, số serial; không lập tay phiếu nhập, xuất, giữ hàng, kiểm kê. Ngoại lệ (quyết định người dùng 2026-11-11): hệ thống tự lập phiếu xuất, phiếu nhập dịch vụ không ghi thẻ kho để chạy công nợ, hóa đơn, bút toán (QUYTAC_NGHIEPVU_276, 277). Đổi loại chỉ khi sản phẩm chưa phát sinh tồn kho, chứng từ kho.
- QUYTAC_NGHIEPVU_276: Đơn bán lập tay (không sinh từ đơn VComm) chỉ gồm mặt hàng dịch vụ; đơn bán hàng hóa chỉ sinh từ đơn VComm. Cài đặt công ty "Cho phép lập đơn bán tay có hàng hóa" (mặc định tắt; quyết định người dùng 2026-11-11) bật lại khả năng này khi cần, ví dụ dữ liệu thử. Dòng dịch vụ khi đơn xác nhận thì coi là đã giao đủ: hệ thống tự lập và ghi sổ một phiếu xuất dịch vụ (không ghi thẻ kho, không giá vốn) để công nợ, hóa đơn điện tử, bút toán doanh thu chạy như đơn đã giao (quyết định người dùng 2026-11-11: dùng phiếu xuất không ghi thẻ kho).
- QUYTAC_NGHIEPVU_277: Giao dịch nội bộ (CONG_VIEC_09) chỉ gồm mặt hàng dịch vụ; giữ luồng đơn bán nội bộ sinh đơn mua đối ứng, bên kia xác nhận. Không xuất kho, không phiếu nhập chờ, không biên bản chênh lệch. Đơn mua đối ứng gồm dịch vụ khi bên mua xác nhận thì coi là đã nhận đủ: hệ thống tự lập, ghi sổ phiếu nhập dịch vụ không ghi thẻ kho; bút toán Nợ chi phí quản lý doanh nghiệp (6427 theo TT99, 6422 theo TT133, kế toán đổi được định khoản) / Nợ thuế đầu vào / Có phải trả người bán. Giao dịch nội bộ hàng hóa vẫn được khi công ty bán bật cài đặt cho phép lập đơn bán tay có hàng hóa (mặc định tắt; người dùng đồng ý 2026-11-11).
- QUYTAC_NGHIEPVU_278: Không còn hoa hồng đội kinh doanh theo tiền thu, bảng tháng, chỉ tiêu (CONG_VIEC_17); hoa hồng chỉ theo đơn VComm (CONG_VIEC_26).
- QUYTAC_NGHIEPVU_279: Không còn giao khách cho nhân viên kinh doanh. Người có quyền xem đối tác, đơn bán xem mọi đối tác, đơn bán của công ty. Người phụ trách trên hồ sơ đối tác vẫn sửa được bằng tay; phiếu giao khách, nhận khách, lịch sử phụ trách không còn trên giao diện, API.

## 5. Vai trò và quyền

- Bỏ quyền `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup`, `finance.commission.view_own`; bỏ loại chứng từ duyệt `finance.commission`.
- Bỏ quyền `crm.customer.view_all`, `crm.customer.assign`; bỏ loại chứng từ duyệt `crm.customer_assignment`.
- Nhân viên bán hàng (`salesperson`): bỏ `sales.order.manage` (vẫn xem đơn bán).
- Kế toán (`accountant`), Kế toán trưởng (`chief_accountant`): thêm `sales.access`, `sales.order.view`, `sales.order.manage`.

## 6. Dữ liệu

- Database migration 0061: xóa bảng `finance.commission_*`, cột `sales.orders.commission_user_id`, định khoản `staff_payable`, quyền, loại chứng từ của CONG_VIEC_17; xóa quyền, loại chứng từ giao khách (giữ bảng, dữ liệu giao khách cũ để tra cứu trong cơ sở dữ liệu).
- Database migration 0062: `catalog.products.kind` (`goods`, `service`, mặc định `goods`); cài đặt công ty cho phép lập đơn bán tay có hàng hóa (mặc định tắt).
- Bút toán cũ nguồn `commission` (nếu có) giữ nguyên trong sổ.

## 7. Màn hình

- Bỏ: Hoa hồng, Cài đặt hoa hồng (web-finance); Phiếu giao khách (web-crm); nút nhận khách, lịch sử phụ trách, lọc theo người phụ trách trên Đối tác.
- Sửa: Sản phẩm (chọn loại; dịch vụ ẩn lô, serial, cân nặng); Đơn bán (chỉ chọn dịch vụ; bỏ cột người hưởng hoa hồng); Đơn mua đối ứng (chỉ dịch vụ).

## 8. Các lát và điểm xem trước

- L0: xóa hoa hồng cũ (CONG_VIEC_17) – mã, quyền, màn hình, migration 0061 phần hoa hồng.
- L1: tắt giao khách, phạm vi xem như trước; quyền đơn bán Kế toán, Nhân viên bán hàng.
- L2: loại sản phẩm; đơn bán tay chỉ dịch vụ; giao dịch nội bộ chỉ dịch vụ.
- L3: phiếu xuất, phiếu nhập dịch vụ tự lập không ghi thẻ kho khi xác nhận; công nợ, hóa đơn, bút toán; định khoản chi phí dịch vụ mua vào.

## 9. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_274 | Không còn API, màn hình, quyền hoa hồng cũ; khởi tạo kế toán, đơn bán, công nợ chạy đúng khi không có hoa hồng cũ | Bắt buộc | KICHBAN_KIEMTHU_419 |
| TIEUCHI_NGHIEMTHU_275 | Không lập được phiếu giao khách, nhận khách; nhân viên bán hàng xem mọi đối tác, đơn bán; Nhân viên bán hàng không lập đơn bán, Kế toán lập được | Bắt buộc | KICHBAN_KIEMTHU_420 |
| TIEUCHI_NGHIEMTHU_276 | Đơn bán tay có hàng hóa bị từ chối; đơn chỉ dịch vụ xác nhận là đã giao, có hóa đơn, công nợ; đơn VComm hàng hóa vẫn chạy | Bắt buộc | KICHBAN_KIEMTHU_421 |
| TIEUCHI_NGHIEMTHU_277 | Giao dịch nội bộ chỉ dịch vụ: hàng hóa bị từ chối; đơn dịch vụ sinh đơn mua đối ứng, xác nhận là đã nhận, không phiếu kho | Bắt buộc | KICHBAN_KIEMTHU_422 |

## 10. Kiểm thử

- KICHBAN_KIEMTHU_419 đến 422: tự động, `apps/api/test/c43-*.test.ts`.
- Kiểm thử cũ theo chức năng bị xóa, tắt (người dùng đồng ý xóa, tắt chức năng): bỏ `c17-commissions`; sửa `c9-internal-trade`, `c21-customer-assignment`, `c22-sales-app`, `c19-collection-statements` theo chức năng bị xóa, tắt. Các kiểm thử lập đơn bán hàng hóa bằng tay (c8, c12 đến c16, c19, c20) chỉ thêm bước bật cài đặt "Cho phép lập đơn bán tay có hàng hóa" ở phần chuẩn bị, nội dung kiểm tra giữ nguyên (người dùng đồng ý 2026-11-11). Danh sách sửa ghi ở tài liệu `25`.

## 11. Ràng buộc

Không thêm thư viện. Không xóa dữ liệu giao khách, giao dịch nội bộ đã có. Không đổi CONG_VIEC_20, 24, 25, 26.
