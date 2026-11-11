# CONG_VIEC_07: Mua hàng trong nước (MODULE_04, phần 1)

- Mô tả: Bảng giá mua theo nhà cung cấp, đề nghị mua, đơn mua có duyệt, nhận hàng theo đơn mua (chờ kiểm tra chất lượng, dung sai nhận vượt), trả hàng nhà cung cấp theo phiếu nhập gốc.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Mua hàng); quyết định của người dùng ngày 2026-11-09 (nghiệp vụ Mua hàng) và ngày 2026-11-10 (chia công việc, kiểm tra chất lượng, giá trả hàng) trong tài liệu `02`.

## 1. Mục tiêu

Công ty con mua hàng trong nước có kiểm soát: đề nghị mua được duyệt trước khi đặt; đơn mua đi luồng duyệt có sẵn; kho nhận hàng đúng đơn, không nhận vượt dung sai; hàng cần kiểm tra chất lượng chỉ vào tồn khi đạt; trả hàng nhà cung cấp đúng giá đã nhập.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_49 đến CHUC_NANG_53.

Ngoài phạm vi (công việc sau):
- Nhập khẩu: lô nhập khẩu, tờ khai, thuế theo tờ khai, phân bổ chi phí, đơn mua ngoại tệ (CONG_VIEC sau của MODULE_04). CONG_VIEC_07 chỉ nhận đơn mua bằng tiền tệ của công ty.
- Hóa đơn mua, so khớp ba bên, lịch thanh toán, đặt cọc (làm cùng MODULE_06).
- Giao dịch nội bộ giữa công ty con (làm cùng MODULE_05).
- Mua sắm không lưu kho (dùng mẫu đề xuất có sẵn).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_32 | Đề nghị mua hàng trong danh mục được duyệt trước khi đặt; đơn mua có duyệt, sửa tăng giá trị hoặc đổi nhà cung cấp thì duyệt lại; giá mua gợi ý theo bảng giá nhà cung cấp | Mua hàng, quản lý |
| YCAU_NGHIEPVU_33 | Kho nhận hàng theo đơn mua, không vượt dung sai; hàng cần kiểm tra chất lượng chỉ vào tồn khi đạt; trả hàng nhà cung cấp theo phiếu nhập gốc | Thủ kho, Mua hàng, Kế toán |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_49 | Bảng giá mua theo nhà cung cấp: mặt hàng, đơn vị mua, đơn giá, số lượng tối thiểu, hiệu lực | YCAU_NGHIEPVU_32 |
| CHUC_NANG_50 | Đề nghị mua: mặt hàng, số lượng, ngày cần, kho nhận, nhà cung cấp đề xuất; đi luồng duyệt | YCAU_NGHIEPVU_32 |
| CHUC_NANG_51 | Đơn mua: nhà cung cấp, kho nhận, dòng hàng, thuế suất, ngày giao dự kiến; duyệt, duyệt lại, đóng đơn; theo dõi đã nhận, đã trả | YCAU_NGHIEPVU_32 |
| CHUC_NANG_52 | Phiếu nhập mua theo đơn mua: dung sai nhận vượt, chờ kiểm tra chất lượng, ghi sổ phần đạt, biên bản phần không đạt | YCAU_NGHIEPVU_33 |
| CHUC_NANG_53 | Phiếu trả hàng nhà cung cấp theo phiếu nhập mua gốc, xuất theo giá trên phiếu nhập gốc | YCAU_NGHIEPVU_33 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_61 | Bảng giá mua thuộc công ty, theo nhà cung cấp (đối tác có hồ sơ nhà cung cấp ở công ty), mặt hàng, đơn vị mua; không có hai giá cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu có hiệu lực chồng nhau. Dòng đơn mua lấy giá có hiệu lực tại ngày đơn với số lượng tối thiểu lớn nhất không vượt số lượng đặt; sửa được | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_62 | Đề nghị mua chỉ chứa mặt hàng đang bán của công ty; gửi đi luồng duyệt (loại chứng từ `purchasing.requisition`, chưa có chính sách duyệt thì duyệt ngay). Đơn mua tạo từ dòng đề nghị đã duyệt; một dòng đề nghị đặt nhiều lần đến hết số lượng | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_63 | Đơn mua bắt buộc đi luồng duyệt (loại `purchasing.order`), trừ khi mọi dòng tạo từ đề nghị mua đã duyệt và tổng giá trị không vượt giá trị ước tính của các dòng đề nghị đó. Đơn đã duyệt sửa làm tăng tổng giá trị hoặc đổi nhà cung cấp thì về chờ duyệt lại; sửa không tăng giá trị thì giữ trạng thái. Không giảm số lượng dòng dưới số đã nhận | YCAU_NGHIEPVU_32 |
| QUYTAC_NGHIEPVU_64 | Nhận hàng chỉ theo đơn mua đã duyệt chưa đóng; tổng đã nhận của mỗi dòng không vượt số đặt cộng dung sai nhận vượt phần trăm cài đặt theo công ty (mặc định 0). Giá nhập là đơn giá dòng đơn mua chưa gồm thuế giá trị gia tăng quy về đơn vị cơ sở. Đơn nhận đủ mọi dòng tự chuyển "Đã nhận đủ"; người có quyền đóng đơn còn thiếu, phần chưa nhận hủy | YCAU_NGHIEPVU_33 |
| QUYTAC_NGHIEPVU_65 | Mặt hàng thuộc ngành hàng đánh dấu cần kiểm tra chất lượng: phiếu nhập mua chuyển "Chờ kiểm tra", chưa ghi sổ kho. Kiểm xong nhập số lượng đạt từng dòng; phần đạt ghi sổ kho, phần không đạt ghi biên bản kèm lý do, không tính vào số đã nhận của đơn mua | YCAU_NGHIEPVU_33 |
| QUYTAC_NGHIEPVU_66 | Trả hàng nhà cung cấp lập từ phiếu nhập mua đã ghi sổ; tổng trả mỗi dòng không vượt số đã nhập; xuất kho theo đơn giá trên phiếu nhập gốc (hàng serial trả đúng serial đã nhập), giá vốn bình quân của phần còn lại tính lại. Phiếu nhập mua, phiếu trả hàng có chứng từ gốc nên không đi luồng duyệt | YCAU_NGHIEPVU_33 |

## 5. Vai trò và quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `purchasing.access` | Công ty | Không | (đã có) |
| `purchasing.price.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.requisition.create` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.purchase.receive` | Chi nhánh sở hữu kho | Không | Thủ kho, Quản lý kho, quản trị công ty |

Vai trò hệ thống mới "Nhân viên mua hàng" (`purchaser`): `purchasing.access`, các quyền `purchasing.*` trừ cài đặt, `crm.access`, `crm.partner.view`, `crm.partner.manage`.

## 6. Luồng nghiệp vụ

1. Nhân viên mua hàng hoặc thủ kho lập đề nghị mua, gửi duyệt.
2. Nhân viên mua hàng lập đơn mua (từ đề nghị đã duyệt hoặc trực tiếp), giá gợi ý từ bảng giá mua, gửi; đơn đi luồng duyệt hoặc duyệt ngay theo QUYTAC_NGHIEPVU_63.
3. Thủ kho chọn đơn mua đã duyệt, lập phiếu nhập mua với số thực nhận, lô, serial, vị trí; gửi. Không cần kiểm tra: ghi sổ ngay. Cần kiểm tra: chờ kiểm tra, nhập kết quả, ghi sổ phần đạt.
4. Hàng lỗi phát hiện sau: thủ kho lập phiếu trả hàng từ phiếu nhập mua gốc.

## 7. Màn hình

| Mã | Màn hình | Mô tả |
|---|---|---|
| MAN_HINH_38 | Bảng giá mua | Mini app Mua hàng; lọc nhà cung cấp, mặt hàng; thêm, sửa, ngừng dùng giá |
| MAN_HINH_39 | Đề nghị mua | Danh sách, chi tiết, lập, gửi duyệt; xem đã đặt bao nhiêu |
| MAN_HINH_40 | Đơn mua | Danh sách lọc trạng thái, nhà cung cấp; lập từ đề nghị hoặc trực tiếp; cài đặt dung sai nhận vượt |
| MAN_HINH_41 | Chi tiết đơn mua | Dòng hàng, đã nhận, đã trả, phiếu nhập liên quan; gửi, sửa, đóng đơn |
| MAN_HINH_31, 32 (sửa) | Phiếu kho của mini app Kho | Thêm loại phiếu nhập mua (chọn đơn mua), phiếu trả nhà cung cấp (chọn phiếu nhập mua); nhập kết quả kiểm tra chất lượng |
| MAN_HINH_22 (sửa) | Ngành hàng | Thêm ô "Cần kiểm tra chất lượng khi nhập mua" |

## 8. Dữ liệu và API

- Database migration `0006_purchasing.sql`: schema `purchasing` (`settings`, `supplier_prices`, `requisitions`, `requisition_lines`, `orders`, `order_lines`); thêm loại phiếu `purchase_receipt`, `purchase_return` và trạng thái `quality_check` vào `inventory.documents`; cột kết quả kiểm tra, dòng gốc vào `inventory.document_lines`; cột `requires_quality_check` vào `catalog.categories`.
- Số lượng đã nhận, đã trả của dòng đơn mua tính từ phiếu kho (đọc chéo module), không lưu trùng.

| Mã | Đường dẫn | Mô tả |
|---|---|---|
| API_73 | `/purchasing/supplier-prices` | Bảng giá mua; tra giá gợi ý |
| API_74 | `/purchasing/requisitions` | Đề nghị mua |
| API_75 | `/purchasing/orders` | Đơn mua: lập, sửa, gửi, đóng; dòng còn nhận được; cài đặt dung sai `/purchasing/settings` |
| API_76 | `/inventory/documents` (loại `purchase_receipt`, `purchase_return`), `/inventory/documents/{id}/quality-check` | Phiếu nhập mua, phiếu trả nhà cung cấp, kết quả kiểm tra chất lượng |

## 9. Điều kiện đặc biệt

- Tiền tệ đơn mua là tiền tệ của công ty; đơn ngoại tệ làm cùng nhập khẩu.
- Đơn giá dòng đơn mua chưa gồm thuế giá trị gia tăng; thuế suất lấy theo sản phẩm, sửa được.
- Phiếu nhập mua dùng sổ kho có sẵn (`StockLedgerService`): giá vốn bình quân gia quyền di động, lô, serial, vị trí.

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_80 | CHUC_NANG_49 | Giá mua chồng hiệu lực bị từ chối; giá gợi ý đúng theo ngày và số lượng tối thiểu; nhà cung cấp chưa có hồ sơ nhà cung cấp bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_81 | CHUC_NANG_50, 51 | Đề nghị mua đi luồng duyệt; đơn từ đề nghị đã duyệt không vượt giá trị thì duyệt ngay, vượt thì chờ duyệt; đặt quá số lượng đề nghị còn lại bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_82 | CHUC_NANG_51 | Đơn đã duyệt sửa tăng giá trị hoặc đổi nhà cung cấp về chờ duyệt; sửa giảm giữ trạng thái; giảm số lượng dưới số đã nhận bị từ chối; đóng đơn hủy phần chưa nhận | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_83 | CHUC_NANG_52 | Nhận vượt dung sai bị từ chối; nhận trong dung sai được; đơn chưa duyệt, đã đóng không nhận được; giá nhập bằng đơn giá đơn mua quy về đơn vị cơ sở | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_84 | CHUC_NANG_52 | Hàng cần kiểm tra chất lượng chưa vào tồn khi chờ kiểm; ghi sổ đúng phần đạt; phần không đạt không tính đã nhận | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_85 | CHUC_NANG_53 | Trả hàng xuất đúng đơn giá phiếu nhập gốc, giá vốn bình quân phần còn lại tính lại đúng; trả quá số đã nhập bị từ chối; trả serial chưa nhập ở phiếu gốc bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_86 | CHUC_NANG_51 | Nhân viên công ty khác không xem được đơn mua; thủ kho chi nhánh khác không nhận hàng vào kho không thuộc chi nhánh mình | Gọi API | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_165 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Mỗi module chỉ ghi schema của mình: Mua hàng ghi `purchasing`; phiếu nhập mua, phiếu trả hàng do module Kho ghi (đọc đơn mua). Khóa ngoại từ `purchasing` chỉ trỏ vào `purchasing`, `core`, `catalog`, `crm`.
- Dùng lại luồng duyệt, dãy số chứng từ, sổ kho, giữ hàng có sẵn.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu, trừ phần sửa ghi ở mục 7, 8.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0006, quyền, vai trò, `apps/web-purchasing` (`/purchasing`, cổng 3004); bảng giá mua | MAN_HINH_38; API_73 | TIEUCHI_NGHIEMTHU_80 |
| L1 | Đề nghị mua; đơn mua, duyệt, duyệt lại, đóng đơn, cài đặt dung sai | MAN_HINH_39, 40, 41; API_74, API_75 | TIEUCHI_NGHIEMTHU_81, 82, 86 |
| L2 | Phiếu nhập mua, kiểm tra chất lượng; phiếu trả hàng nhà cung cấp; ô cần kiểm tra ở ngành hàng | MAN_HINH_31, 32, 22; API_76 | TIEUCHI_NGHIEMTHU_83, 84, 85 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
