# CONG_VIEC_21: Gán khách hàng cho nhân viên kinh doanh (MODULE_07)

- Mô tả: Nhân viên kinh doanh chỉ xem khách hàng mình phụ trách và đơn bán của các khách đó; trưởng phòng xem, giao khách của nhân viên trong phòng; giao, chuyển khách bằng phiếu giao khách theo chính sách duyệt của công ty; lưu lịch sử phụ trách.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng xác nhận thiết kế ngày 2026-11-10.
- Nguồn: tài liệu `05` mục 2.1 (gán khách hàng cho nhân viên kinh doanh); THAY_DOI_12; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Mỗi khách hàng của công ty có một nhân viên phụ trách rõ ràng; nhân viên chỉ làm việc với khách của mình; chuyển khách có kiểm soát và truy được lịch sử.

## 2. Phạm vi

Trong phạm vi:
- Phạm vi xem khách hàng và đơn bán theo nhân viên phụ trách, theo phòng ban.
- Phiếu giao khách (giao lần đầu, chuyển khách) theo chính sách duyệt.
- Lịch sử phụ trách của từng khách.
- Bộ lọc "Khách của tôi", lọc theo nhân viên phụ trách.

Ngoài phạm vi: ứng dụng nhân viên kinh doanh (công việc sau); tự chia khách theo vùng, theo luật; chuyển khách khi nhân viên nghỉ việc tự động (làm bằng phiếu giao khách).

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_46: Gán khách hàng cho nhân viên kinh doanh; nhân viên chỉ làm việc với khách mình phụ trách; chuyển khách có duyệt, có lịch sử.
- CHUC_NANG_96: Phạm vi xem khách hàng, đơn bán theo nhân viên phụ trách và phòng ban.
- CHUC_NANG_97: Phiếu giao khách: lập, gửi duyệt, rút, áp dụng.
- CHUC_NANG_98: Lịch sử phụ trách; lọc khách theo nhân viên phụ trách.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_129: Người có quyền `crm.customer.view_all` (gán ở bất kỳ phạm vi nào trong công ty) xem mọi đối tác, đơn bán của công ty như hiện nay. Người không có quyền này (vai trò Nhân viên bán hàng) chỉ xem:
  - đối tác có hồ sơ khách hàng tại công ty mà nhân viên phụ trách là mình, hoặc là nhân viên thuộc phòng mình quản lý;
  - đơn bán có khách thuộc danh sách trên, đơn mình lập, đơn mình hưởng hoa hồng.
  Danh sách chọn khách khi lập đơn bán chỉ gồm khách mình được xem. Kiểm tra trùng mã số thuế, số Căn cước công dân khi thêm đối tác vẫn tìm trong toàn bộ danh mục (chỉ trả mã và tên).
- QUYTAC_NGHIEPVU_130: Phòng mình quản lý: các phòng (đang hoạt động) của công ty có trưởng phòng là mình và mọi phòng con các cấp. Nhân viên trong phòng: thành viên đang hoạt động của công ty thuộc các phòng đó.
- QUYTAC_NGHIEPVU_131: Phiếu giao khách gồm: lý do (bắt buộc), nhân viên nhận (thành viên đang hoạt động của công ty), danh sách khách (1 đến 500 khách hàng đang hoạt động của công ty, không trùng, khác nhân viên nhận). Ai được lập:
  - người có quyền `crm.customer.assign`: mọi khách hàng, mọi nhân viên nhận;
  - trưởng phòng: khách đang do nhân viên trong phòng mình quản lý (kể cả mình) phụ trách, nhân viên nhận trong phòng mình quản lý.
- QUYTAC_NGHIEPVU_132: Phiếu giao khách trạng thái nháp, chờ duyệt, đã áp dụng, bị từ chối, đã rút; số theo dãy `GK` của công ty. Gửi: duyệt theo chính sách loại `crm.customer_assignment` của công ty (giá trị duyệt 0); chưa có chính sách thì áp dụng ngay. Chỉ người gửi rút được phiếu chờ duyệt; phiếu bị từ chối, đã rút sửa và gửi lại được.
- QUYTAC_NGHIEPVU_133: Áp dụng: mỗi khách, nhân viên phụ trách lúc áp dụng phải trùng nhân viên phụ trách lúc gửi; khác thì không áp dụng phiếu, phiếu về bị từ chối kèm danh sách khách đã đổi. Áp dụng đổi nhân viên phụ trách trong hồ sơ, đóng dòng lịch sử cũ, mở dòng mới (từ thời điểm áp dụng, kèm phiếu), báo cho nhân viên cũ và nhân viên nhận. Đơn bán đã gán nhân viên hưởng hoa hồng giữ nguyên; đơn gửi sau thời điểm áp dụng gán theo nhân viên mới.
- QUYTAC_NGHIEPVU_135: Người không có quyền `crm.customer.view_all` thêm đối tác mới (hoặc thêm khi đối tác chưa có hồ sơ tại công ty) thì hệ thống tự lập hồ sơ khách hàng tại công ty: là khách hàng, nhân viên phụ trách là người thêm, thanh toán ngay (0 ngày), hạn mức công nợ 0 (bán nợ phải qua duyệt ngoại lệ hạn mức); ghi lịch sử. Người có quyền quản lý hồ sơ sửa điều khoản sau.
- QUYTAC_NGHIEPVU_134: Sửa hồ sơ đối tác: được đặt nhân viên phụ trách khi khách chưa có nhân viên phụ trách (ghi lịch sử); khách đã có nhân viên phụ trách thì chỉ đổi, bỏ được bằng phiếu giao khách. Hồ sơ đã có nhân viên phụ trách trước công việc này được ghi lịch sử từ thời điểm cập nhật hồ sơ gần nhất.

## 5. Vai trò và quyền

| Quyền | Vai trò hệ thống có sẵn |
|---|---|
| `crm.customer.view_all` Xem mọi khách hàng, đơn bán của công ty | Quản trị tập đoàn, Quản trị công ty, Thủ kho, Quản lý kho, Nhân viên mua hàng, Kế toán, Kế toán trưởng, Quản lý đối tác |
| `crm.customer.assign` Giao, chuyển khách hàng cho nhân viên | Quản trị tập đoàn, Quản trị công ty |

Vai trò tự tạo đang có `crm.partner.view` hoặc `sales.order.view` được database migration thêm `crm.customer.view_all` để không đổi hành vi. Trưởng phòng không cần quyền riêng để giao khách trong phòng, nhưng cần `crm.access`.

## 6. Luồng nghiệp vụ

Luồng 33: trưởng phòng hoặc người có quyền giao khách lập phiếu giao khách (chọn khách, nhân viên nhận, lý do) → gửi → duyệt theo chính sách (không có chính sách thì áp dụng ngay) → áp dụng: đổi nhân viên phụ trách, ghi lịch sử, báo nhân viên → nhân viên nhận thấy khách trong danh sách của mình.

## 7. Màn hình

- MAN_HINH_64 Danh sách phiếu giao khách (web-crm): lọc trạng thái; nút lập phiếu.
- MAN_HINH_65 Phiếu giao khách: chọn khách (tìm, lọc theo nhân viên phụ trách hiện tại), nhân viên nhận, lý do; gửi, rút, bỏ phiếu nháp; trạng thái, lý do từ chối.
- Sửa MAN_HINH_36: thêm lọc "Khách của tôi", lọc nhân viên phụ trách, cột nhân viên phụ trách.
- Sửa MAN_HINH_37: ô nhân viên phụ trách chỉ chọn được khi chưa có; thẻ lịch sử phụ trách.

## 8. Dữ liệu và API

- Database migration 0021: `crm.customer_assignments` (phiếu), `crm.customer_assignment_lines` (khách, nhân viên phụ trách lúc gửi), `crm.partner_owner_history` (công ty, khách, nhân viên, từ, đến, phiếu); chỉ mục `partner_profiles (company_id, owner_user_id)`; quyền, loại chứng từ `crm.customer_assignment`; ghi lịch sử cho hồ sơ đã có nhân viên phụ trách; thêm quyền xem mọi khách vào vai trò tự tạo.
- API_110 phiếu giao khách: danh sách, lập, chi tiết, sửa, bỏ, gửi, rút.
- API_111 lịch sử phụ trách của một khách.
- Sửa API của đối tác (danh sách, chi tiết, hồ sơ) và đơn bán (tùy chọn, danh sách, chi tiết, thao tác) theo QUYTAC_NGHIEPVU_129, 134.

## 9. Điều kiện đặc biệt

Thay đổi phạm vi xem áp dụng ngay khi phát hành cho vai trò Nhân viên bán hàng (THAY_DOI_12).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_151 | Nhân viên không có quyền xem mọi khách chỉ thấy khách mình (và phòng mình quản lý) phụ trách, đơn bán của các khách đó, đơn mình lập, đơn mình hưởng hoa hồng; mở khách, đơn khác nhận 404; người có quyền xem như cũ | Bắt buộc | KICHBAN_KIEMTHU_278, 279 |
| TIEUCHI_NGHIEMTHU_152 | Trưởng phòng xem khách của nhân viên phòng mình và phòng con, giao khách trong phòng; không giao được khách, nhân viên ngoài phòng | Bắt buộc | KICHBAN_KIEMTHU_280 |
| TIEUCHI_NGHIEMTHU_153 | Phiếu giao khách theo chính sách duyệt; không có chính sách thì áp dụng ngay; rút, gửi lại; khách đổi nhân viên trong lúc chờ duyệt thì phiếu bị từ chối | Bắt buộc | KICHBAN_KIEMTHU_281, 282 |
| TIEUCHI_NGHIEMTHU_154 | Áp dụng đổi nhân viên phụ trách, ghi lịch sử, báo nhân viên; đơn đã gán hoa hồng giữ nhân viên cũ, đơn gửi sau gán nhân viên mới | Bắt buộc | KICHBAN_KIEMTHU_283 |
| TIEUCHI_NGHIEMTHU_155 | Hồ sơ chỉ đặt nhân viên phụ trách khi chưa có; nhân viên bán hàng thêm đối tác mới thì tự có hồ sơ khách hàng do mình phụ trách, hạn mức 0; lịch sử hiện đúng | Bắt buộc | KICHBAN_KIEMTHU_284 |
| TIEUCHI_NGHIEMTHU_156 | MAN_HINH_64, 65 và phần sửa MAN_HINH_36, 37 hiển thị đúng trên máy tính và điện thoại | Mong muốn | KICHBAN_KIEMTHU_285 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_278 đến 284: tự động, `apps/api/test/c21-customer-assignment.test.ts`.
- KICHBAN_KIEMTHU_285: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Duyệt qua `approvals.submitWithin`; lọc phạm vi bằng một điều kiện SQL dùng chung cho đối tác và đơn bán.

## 13. Thành phần không được thay đổi

Quy tắc gán nhân viên hưởng hoa hồng (QUYTAC_NGHIEPVU_109); phạm vi xem của kế toán, kho, mua hàng.

## 14. Các lát và điểm xem trước

- L0: quyền mới, phạm vi xem đối tác và đơn bán, lọc "Khách của tôi". Điểm xem trước: đăng nhập nhân viên bán hàng chỉ thấy khách của mình.
- L1: phiếu giao khách, duyệt, áp dụng, lịch sử, báo nhân viên; MAN_HINH_64, 65, sửa MAN_HINH_37.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Giới hạn đã biết

Chưa có.
