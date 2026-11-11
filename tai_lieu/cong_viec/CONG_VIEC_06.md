# CONG_VIEC_06: Danh mục đối tác dùng chung tập đoàn (MODULE_07, phần tối thiểu)

- Mô tả: Đối tác tổ chức, hộ kinh doanh, cá nhân dùng chung tập đoàn; người liên hệ, tài khoản ngân hàng; công ty con là đối tác nội bộ; hồ sơ khách hàng, nhà cung cấp riêng từng công ty.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Khách hàng và Đối tác); quyết định của người dùng ngày 2026-11-09 (đối tác chung tập đoàn, hồ sơ riêng từng công ty, công ty con là đối tác) và ngày 2026-11-10 (định danh, quyền sửa) trong tài liệu `02`.

## 1. Mục tiêu

Một danh mục đối tác duy nhất cho cả tập đoàn để Mua hàng, Bán hàng, Kế toán của mọi công ty con dùng chung: không lập trùng cùng một doanh nghiệp, biết ngay đối tác là công ty con nào trong tập đoàn (giao dịch nội bộ), và mỗi công ty giữ điều kiện giao dịch riêng của mình với đối tác đó.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_46 đến CHUC_NANG_48.

Ngoài phạm vi:
- Tra cứu thông tin doanh nghiệp theo mã số thuế (làm cùng hóa đơn điện tử, MODULE_06).
- Khách hàng tiềm năng, cơ hội, chiến dịch, phiếu hỗ trợ, ứng dụng nhân viên kinh doanh (phần còn lại của MODULE_07).
- Nhà bán, cửa hàng liên kết (công việc riêng).
- Công nợ, số dư (MODULE_06); nhập đối tác từ Excel (công việc sau).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_30 | Danh mục đối tác dùng chung tập đoàn, không trùng, định danh theo mã số thuế hoặc số Căn cước công dân; công ty con là đối tác nội bộ | Mua hàng, Bán hàng, Kế toán mọi công ty |
| YCAU_NGHIEPVU_31 | Mỗi công ty có hồ sơ riêng với đối tác: là khách hàng, nhà cung cấp, điều khoản thanh toán, hạn mức công nợ, nhóm khách, nhân viên phụ trách | Bán hàng, Mua hàng, Kế toán |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_46 | Quản lý đối tác dùng chung: thông tin chung, người liên hệ, tài khoản ngân hàng, trạng thái; kiểm trùng | YCAU_NGHIEPVU_30 |
| CHUC_NANG_47 | Đối tác nội bộ tự đồng bộ từ danh sách công ty con | YCAU_NGHIEPVU_30 |
| CHUC_NANG_48 | Hồ sơ đối tác của công ty: khách hàng, nhà cung cấp, điều khoản thanh toán, hạn mức công nợ, nhóm khách hàng, nhân viên phụ trách | YCAU_NGHIEPVU_31 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_56 | Đối tác thuộc một trong ba loại: tổ chức, hộ kinh doanh (bắt buộc mã số thuế 10 số hoặc 10 số kèm "-" và 3 số chi nhánh, duy nhất trong tập đoàn), cá nhân (số Căn cước công dân 12 số nếu khách cung cấp, duy nhất trong tập đoàn). Cá nhân không cung cấp số Căn cước công dân thì không lập đối tác; bán hàng dùng người mua không lấy hóa đơn (quyết định ngày 2026-11-10) | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_57 | Người có quyền quản lý đối tác ở bất kỳ công ty nào được thêm, sửa thông tin chung; mọi thay đổi ghi nhật ký thao tác kèm dữ liệu trước, sau. Không xóa đối tác, chỉ ngừng giao dịch; đối tác ngừng giao dịch không chọn được trên chứng từ mới | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_58 | Mỗi công ty con đang hoạt động là một đối tác nội bộ, đồng bộ tên, mã số thuế, địa chỉ từ danh sách công ty; thông tin chung của đối tác nội bộ chỉ sửa ở màn hình công ty | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_59 | Số Căn cước công dân là dữ liệu cá nhân: danh sách che, chỉ hiện 3 số cuối; xem đầy đủ cần quyền xem dữ liệu cá nhân đối tác, mỗi lần xem ghi nhật ký thao tác | YCAU_NGHIEPVU_30 |
| QUYTAC_NGHIEPVU_60 | Hồ sơ đối tác của công ty: đánh dấu khách hàng, nhà cung cấp (ít nhất một), số ngày được nợ (0 đến 365), hạn mức công nợ theo tiền tệ công ty (để trống: không giới hạn), nhóm khách hàng của công ty, nhân viên phụ trách là nhân viên công ty; trạng thái riêng từng công ty. Công ty khác không xem được hồ sơ của nhau | YCAU_NGHIEPVU_31 |

## 5. Dữ liệu liên quan

Database migration `0005_crm.sql`, schema `crm`:

| Bảng | Nội dung chính |
|---|---|
| `crm.partners` | Loại, mã đối tác tự sinh (`DT` + 6 số), tên, tên ngắn, mã số thuế, số Căn cước công dân, địa chỉ, điện thoại, email, công ty nội bộ (để trống: đối tác bên ngoài), chuỗi tìm kiếm không dấu, trạng thái, phiên bản |
| `crm.partner_contacts` | Đối tác, họ tên, chức vụ, điện thoại, email, liên hệ chính |
| `crm.partner_bank_accounts` | Đối tác, ngân hàng, số tài khoản, chủ tài khoản, chi nhánh, tài khoản mặc định |
| `crm.partner_profiles` | Công ty, đối tác, là khách hàng, là nhà cung cấp, số ngày được nợ, hạn mức công nợ, nhóm khách hàng, nhân viên phụ trách, ghi chú, trạng thái, phiên bản |

## 6. Giao diện liên quan

Mini app mới `apps/web-crm`, đường dẫn `/crm`, cổng phát triển 3003 (`CRM_ORIGIN`).

| Mã | Màn hình | Ghi chú |
|---|---|---|
| MAN_HINH_36 | Danh sách đối tác | Tìm không dấu theo tên, mã, mã số thuế, điện thoại; lọc loại, khách hàng, nhà cung cấp của công ty đang chọn, nội bộ; thêm đối tác (kiểm trùng ngay khi gõ mã số thuế) |
| MAN_HINH_37 | Chi tiết đối tác | Thông tin chung, người liên hệ, tài khoản ngân hàng; hồ sơ của công ty đang chọn; lịch sử |

## 7. API liên quan

| Mã | Endpoint | Nội dung |
|---|---|---|
| API_71 | `/crm/partners` (kèm `/{id}`, `/{id}/deactivate`, `/{id}/activate`, `/{id}/identity`, `/lookup`) | Danh sách, chi tiết, thêm, sửa, ngừng giao dịch, xem số Căn cước công dân, kiểm trùng |
| API_72 | `/crm/partners/{id}/profile` | Hồ sơ đối tác của công ty đang chọn |

## 8. Phân quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `crm.access` | Công ty | Không | (đã có) |
| `crm.partner.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác, Thủ kho |
| `crm.partner.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác |
| `crm.partner.identity.view` | Công ty | Có | Quản trị tập đoàn, quản trị công ty |
| `crm.profile.manage` | Công ty | Có (hạn mức công nợ) | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý đối tác" (`partner_manager`): `crm.access`, `crm.partner.view`, `crm.partner.manage`.

## 9. Điều kiện đặc biệt

- Kiểm mã số thuế theo định dạng: 10 số, hoặc dạng chi nhánh 10 số, dấu "-", 3 số. Chữ số kiểm tra chưa kiểm (cần xác nhận quy tắc chính thức trước khi áp dụng; tra cứu mã số thuế làm cùng hóa đơn điện tử).
- Số Căn cước công dân lưu nguyên văn trong cơ sở dữ liệu, không trả về trong danh sách; cấp mã hóa cột để sau cùng giải pháp khóa của tài liệu `22`.
- Đồng bộ đối tác nội bộ khi khởi động API và khi thêm, sửa công ty (sự kiện outbox `core.company.changed` nếu đã có; chưa có thì gọi khi khởi động và khi đọc danh mục).

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_75 | CHUC_NANG_46 | Mã số thuế, số Căn cước công dân trùng trong tập đoàn bị từ chối kèm đối tác có sẵn; mã số thuế sai định dạng bị từ chối; tổ chức, hộ kinh doanh thiếu mã số thuế bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_76 | CHUC_NANG_46 | Người có quyền ở công ty A thêm đối tác, công ty B thấy cùng đối tác; sửa ghi nhật ký trước, sau; ngừng giao dịch không xóa | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_77 | CHUC_NANG_47 | Mỗi công ty con đang hoạt động có đúng một đối tác nội bộ; sửa thông tin chung của đối tác nội bộ bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_78 | CHUC_NANG_46 | Danh sách chỉ hiện 3 số cuối Căn cước công dân; xem đầy đủ cần quyền và ghi nhật ký | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_79 | CHUC_NANG_48 | Hồ sơ của công ty A không đọc được từ công ty B; không chọn khách hàng hay nhà cung cấp bị từ chối; hạn mức âm, nhóm khách công ty khác bị từ chối | Gọi API | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_160 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Khóa ngoại từ `crm` chỉ trỏ vào `crm`, `core`; nhóm khách hàng (`catalog.customer_groups`) kiểm bằng truy vấn đọc, không đặt khóa ngoại sang schema khác module.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0005, quyền, vai trò, `apps/web-crm`; đối tác dùng chung, người liên hệ, tài khoản ngân hàng, đối tác nội bộ, che Căn cước công dân | MAN_HINH_36, 37; API_71 | TIEUCHI_NGHIEMTHU_75 đến 78 |
| L1 | Hồ sơ đối tác của công ty | MAN_HINH_37; API_72 | TIEUCHI_NGHIEMTHU_79 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
