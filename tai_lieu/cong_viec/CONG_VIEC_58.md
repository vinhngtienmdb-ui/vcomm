# CONG_VIEC_58: Bán lẻ phần 3 (MODULE_14): kế hoạch mua theo ngân sách (Open-to-Buy)

- Mô tả: Lập kế hoạch ngân sách mua theo ngành hàng, kho, tháng; theo dõi số còn được mua; đơn mua vượt ngân sách đi luồng duyệt riêng; phiếu điều chỉnh ngân sách có duyệt. Đặt trong mini app Mua hàng (`web-purchasing`).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đặc tả, bản mẫu đã duyệt 2026-11-12; đang lập trình L0.
- Mức: Lớn (nghiệp vụ mới, bảng mới, quyền mới, loại chứng từ duyệt mới, đổi hành vi gửi duyệt đơn mua đang dùng).
- Nhánh: `chuc-nang/CONG_VIEC_58-mua-theo-ngan-sach` tách từ `origin/main`.
- Nguồn: tài liệu `24` THAY_DOI_04 (MODULE_14: kế hoạch mua theo ngân sách); tài liệu `01`, `05` (MODULE_14); CONG_VIEC_07 (đơn mua, luồng duyệt); quyết định của người dùng ngày 2026-11-12 (mục 16).

## 1. Mục tiêu

Phòng mua hàng chỉ đặt hàng trong ngân sách đã duyệt cho từng ngành hàng, kho, tháng; ban điều hành thấy ngay số đã dùng, số còn được mua; đơn vượt ngân sách phải qua cấp duyệt cao hơn.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_207 đến CHUC_NANG_209.

Ngoài phạm vi:
- Công thức bán lẻ đầy đủ (doanh số kế hoạch, tồn cuối kỳ kế hoạch, tồn đầu kỳ).
- Ngân sách theo nhà cung cấp, theo ngành hàng cấp 2 trở xuống.
- Giữ chỗ ngân sách cho đơn đang chờ duyệt, đề nghị mua.
- Nhập kế hoạch từ Excel (làm sau nếu người dùng yêu cầu).
- Ngân sách gộp nhiều công ty (mỗi công ty một kế hoạch).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_143 | Lập kế hoạch ngân sách mua theo ngành hàng cấp 1, kho, tháng cho một công ty | Trưởng phòng mua hàng |
| YCAU_NGHIEPVU_144 | Kế hoạch ngân sách phải được duyệt theo luồng duyệt dùng chung mới có hiệu lực | Giám đốc, kế toán trưởng |
| YCAU_NGHIEPVU_145 | Xem số ngân sách, đã dùng, còn được mua theo ngành hàng, kho, tháng, quý, năm | Trưởng phòng mua hàng, ban điều hành |
| YCAU_NGHIEPVU_146 | Khi lập đơn mua biết đơn có vượt ngân sách không | Nhân viên mua hàng |
| YCAU_NGHIEPVU_147 | Đơn mua vượt ngân sách hoặc chưa có ngân sách phải qua luồng duyệt riêng, cấp cao hơn | Giám đốc |
| YCAU_NGHIEPVU_148 | Điều chỉnh tăng, giảm, chuyển ngân sách giữa kỳ bằng phiếu có duyệt, giữ lịch sử | Trưởng phòng mua hàng, giám đốc |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_207 | Kế hoạch ngân sách mua: lập, sửa, gửi duyệt, rút, hủy; bảng nhập ngành hàng × kho × tháng | YCAU_NGHIEPVU_143, 144 |
| CHUC_NANG_208 | Phiếu điều chỉnh ngân sách: tăng, giảm, chuyển giữa các ô; gửi duyệt; áp vào ngân sách khi duyệt | YCAU_NGHIEPVU_148 |
| CHUC_NANG_209 | Theo dõi số còn được mua; kiểm tra ngân sách khi lập, gửi duyệt đơn mua; chuyển luồng duyệt "đơn mua vượt ngân sách" | YCAU_NGHIEPVU_145, 146, 147 |

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_442: Ô ngân sách. Một ô = công ty + ngành hàng cấp 1 + kho của công ty + tháng (năm, tháng). Số tiền theo đồng tiền hạch toán của công ty (`core.companies.base_currency`), không âm, tối đa 4 chữ số lẻ, hiển thị làm tròn theo đồng tiền.
- QUYTAC_NGHIEPVU_443: Kế hoạch ngân sách. Một kế hoạch thuộc một công ty, có tháng bắt đầu, tháng kết thúc (cùng năm hoặc nối năm, tối đa 12 tháng), danh sách ô với số tiền. Trạng thái: Nháp → Chờ duyệt → Đã duyệt; Bị từ chối, Đã rút quay về sửa được; Đã hủy (chỉ từ Nháp, Bị từ chối, Đã rút). Kế hoạch đã duyệt không sửa, chỉ điều chỉnh bằng phiếu (QUYTAC_NGHIEPVU_448).
- QUYTAC_NGHIEPVU_444: Không trùng kỳ. Trong một công ty, các kế hoạch chưa hủy (khác Nháp, Bị từ chối, Đã rút, Đã hủy) không được có tháng trùng nhau. Kiểm tra khi gửi duyệt.
- QUYTAC_NGHIEPVU_445: Duyệt kế hoạch. Gửi duyệt qua luồng duyệt dùng chung, loại chứng từ `purchasing.budget_plan`, số tiền = tổng các ô. Chưa có chính sách duyệt hiệu lực thì không gửi được (báo "Chưa có chính sách duyệt kế hoạch ngân sách mua"); ngân sách không tự duyệt. Người lập rút được khi cấp 1 chưa quyết định.
- QUYTAC_NGHIEPVU_446: Đã dùng của một ô = tổng giá trị chưa thuế giá trị gia tăng của các dòng đơn mua thuộc ô (ngành hàng cấp 1 của sản phẩm, kho nhận của đơn, tháng của ngày đơn), quy đổi về đồng tiền hạch toán theo tỷ giá hạch toán ngày đơn (cách quy đổi như QUYTAC_NGHIEPVU_19), với:
  - đơn Đã duyệt, Đã nhận đủ: giá trị dòng;
  - đơn Đã đóng (đóng sớm): số đã nhận đạt đã ghi sổ × đơn giá dòng (quy về đơn vị cơ sở);
  - đơn Nháp, Chờ duyệt, Bị từ chối, Đã rút, Chờ bên bán xác nhận: không tính;
  - đơn từng được duyệt rồi sửa tăng giá trị, đang chờ duyệt lại (hoặc lần duyệt lại bị từ chối, bị rút): tính giá trị dòng hiện tại nhân tỷ lệ tổng lần duyệt gần nhất / tổng hiện tại, tức tổng của đơn không vượt số đã duyệt.
  - Hàng trả nhà cung cấp không làm giảm số đã dùng.
- QUYTAC_NGHIEPVU_447: Số còn được mua = ngân sách đã duyệt của ô + điều chỉnh đã duyệt − đã dùng. Có thể âm (khi đơn được duyệt qua luồng vượt ngân sách).
- QUYTAC_NGHIEPVU_448: Phiếu điều chỉnh. Thuộc một kế hoạch đã duyệt; mỗi dòng: ô (ngành hàng, kho, tháng trong kỳ kế hoạch), số tăng hoặc giảm. Chuyển ngân sách = một dòng giảm, một dòng tăng (có thể khác tháng). Bắt buộc lý do. Gửi duyệt loại chứng từ `purchasing.budget_adjustment`, số tiền = tổng số tăng. Khi duyệt xong, áp vào ô (ô chưa có thì tạo với ngân sách gốc 0). Trạng thái như kế hoạch.
- QUYTAC_NGHIEPVU_449: Không giảm dưới số đã dùng. Dòng giảm làm ngân sách của ô nhỏ hơn số đã dùng tại thời điểm gửi duyệt thì bị từ chối; khi phiếu được duyệt mà điều kiện không còn đúng (đơn mới được duyệt trong lúc chờ) thì vẫn áp, số còn được mua có thể âm, ghi nhật ký.
- QUYTAC_NGHIEPVU_450: Công ty chưa áp dụng ngân sách tháng đó. Tháng của ngày đơn không thuộc kế hoạch đã duyệt nào của công ty thì đơn mua không kiểm tra ngân sách, đi luồng duyệt như hiện nay.
- QUYTAC_NGHIEPVU_451: Kiểm tra khi lập, sửa đơn mua. Màn hình đơn mua hiện theo từng ô mà đơn chạm tới: ngân sách, đã dùng (không gồm chính đơn này), giá trị đơn trong ô, còn lại sau đơn; ô vượt hoặc chưa có ngân sách (trong tháng đã áp dụng) có cảnh báo. Chỉ cảnh báo, không chặn lưu.
- QUYTAC_NGHIEPVU_452: Chuyển luồng duyệt khi gửi duyệt. Khi gửi duyệt (lần đầu hoặc duyệt lại theo QUYTAC_NGHIEPVU_63), nếu có ít nhất một ô mà giá trị đơn trong ô lớn hơn số còn được mua của ô (không tính chính đơn), hoặc ô chưa có ngân sách trong tháng đã áp dụng, thì đơn gửi duyệt loại chứng từ `purchasing.order_over_budget` thay cho `purchasing.order`, kể cả đơn đang được miễn duyệt (lấy từ đề nghị mua đã duyệt). Chưa có chính sách duyệt hiệu lực cho `purchasing.order_over_budget` thì không gửi được (báo lỗi), không duyệt ngay. Kết quả duyệt xử lý như đơn mua thường (đơn đối ứng nội bộ, nhận hàng không đổi). Yêu cầu duyệt lưu ảnh chụp số vượt từng ô để người duyệt xem.
- QUYTAC_NGHIEPVU_453: Quyền. `purchasing.budget.view` xem kế hoạch, phiếu, số còn được mua; `purchasing.budget.manage` lập, sửa, gửi, rút, hủy kế hoạch và phiếu điều chỉnh (gán ở tập đoàn hoặc công ty). Người lập, sửa đơn mua (`purchasing.order.manage`) thấy cảnh báo ngân sách của đơn mình mà không cần `purchasing.budget.view`. Dữ liệu lọc theo công ty đang làm việc (QUYTAC_NGHIEPVU_12).

## 5. Vai trò và quyền

| Quyền | Tên | Nhạy cảm |
|---|---|---|
| `purchasing.budget.view` | Xem ngân sách mua | Không |
| `purchasing.budget.manage` | Lập, điều chỉnh ngân sách mua | Không |

Vai trò hệ thống thêm quyền (không bớt quyền cũ): Nhân viên mua hàng thêm `purchasing.budget.view`. Quản trị công ty, Quản trị tập đoàn có cả hai quyền `purchasing.budget.view`, `purchasing.budget.manage`. `purchasing.budget.manage` không gán sẵn cho vai trò nghiệp vụ; quản trị gán cho trưởng phòng mua hàng bằng vai trò tự tạo. Tài khoản thử `phuc.le@vcomm.test` được gán thêm trong dữ liệu thử.

Loại chứng từ duyệt mới (`core.document_types`, mini app `purchasing`): `purchasing.budget_plan` (Kế hoạch ngân sách mua), `purchasing.budget_adjustment` (Điều chỉnh ngân sách mua), `purchasing.order_over_budget` (Đơn mua vượt ngân sách). Chính sách duyệt cấu hình ở MAN_HINH_15 như các loại khác.

## 6. Luồng nghiệp vụ (Luồng 55)

1. Trưởng phòng mua hàng lập kế hoạch (chọn kỳ, nhập bảng ngành hàng × kho × tháng) → gửi duyệt → luồng duyệt dùng chung → Đã duyệt: ngân sách có hiệu lực.
2. Nhân viên mua hàng lập đơn mua → thấy cảnh báo ngân sách theo ô → gửi duyệt → trong ngân sách: luồng `purchasing.order` (hoặc miễn duyệt như hiện nay); vượt: luồng `purchasing.order_over_budget`.
3. Đơn được duyệt → số đã dùng tăng; đơn đóng sớm → chỉ còn tính phần đã nhận.
4. Cần thêm ngân sách → phiếu điều chỉnh → duyệt → áp vào ô.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_204 | Danh sách kế hoạch ngân sách mua | Lọc trạng thái, năm; cột số, kỳ, tổng ngân sách, đã dùng, còn được mua, trạng thái; nút lập |
| MAN_HINH_205 | Chi tiết, sửa kế hoạch ngân sách mua | Kỳ, ghi chú; bảng hàng = ngành hàng × kho, cột = tháng, ô nhập số tiền, tổng hàng, tổng cột; gửi duyệt, rút, hủy; khi đã duyệt hiện ngân sách sau điều chỉnh, đã dùng, còn lại từng ô; danh sách phiếu điều chỉnh |
| MAN_HINH_206 | Số còn được mua | Bộ lọc năm, kỳ (tháng, quý, năm), ngành hàng, kho; bảng ngân sách, điều chỉnh, đã dùng, còn được mua, tỷ lệ đã dùng; ô âm tô màu cảnh báo; nhấn ô xem các đơn đã tính |
| MAN_HINH_207 | Danh sách phiếu điều chỉnh ngân sách | Lọc trạng thái, kế hoạch; cột số, kế hoạch, tổng tăng, tổng giảm, lý do, trạng thái |
| MAN_HINH_208 | Chi tiết, sửa phiếu điều chỉnh ngân sách | Kế hoạch, lý do; dòng ô, số tăng/giảm, ngân sách hiện tại, đã dùng, sau điều chỉnh; gửi duyệt, rút, hủy |
| MAN_HINH_209 | Khối cảnh báo ngân sách trong đơn mua (MAN_HINH đơn mua hiện có) | Bảng các ô đơn chạm tới, nhãn "Vượt ngân sách"/"Chưa có ngân sách"; thông báo đơn sẽ đi luồng duyệt vượt ngân sách |

## 8. Dữ liệu và API

Database migration:
- 0116: bảng `purchasing.budget_plans` (công ty, số chứng từ, tháng bắt đầu, kết thúc, trạng thái, `approval_request_id`, ghi chú, phiên bản, người lập, thời điểm), `purchasing.budget_lines` (kế hoạch, ngành hàng, kho, tháng, số tiền gốc, số điều chỉnh đã duyệt; duy nhất kế hoạch + ngành hàng + kho + tháng); quyền, loại chứng từ, dãy số chứng từ.
- 0117: bảng `purchasing.budget_adjustments`, `purchasing.budget_adjustment_lines`.
- 0118: cột `budget_snapshot jsonb` của đơn mua (ảnh chụp ô vượt khi gửi duyệt); chỉ mục `purchasing.orders (company_id, order_date) WHERE status IN ('approved', 'received', 'closed')`.

| Mã | Phương thức, đường dẫn | Mô tả |
|---|---|---|
| API_235 | `GET`, `POST /purchasing/budget-plans`; `GET`, `PATCH /purchasing/budget-plans/{id}` | Danh sách, lập, xem, sửa kế hoạch |
| API_236 | `POST /purchasing/budget-plans/{id}/submit`, `/withdraw`, `/cancel` | Gửi duyệt, rút, hủy kế hoạch |
| API_237 | `GET`, `POST /purchasing/budget-adjustments`; `GET`, `PATCH /purchasing/budget-adjustments/{id}` | Danh sách, lập, xem, sửa phiếu điều chỉnh |
| API_238 | `POST /purchasing/budget-adjustments/{id}/submit`, `/withdraw`, `/cancel` | Gửi duyệt, rút, hủy phiếu |
| API_239 | `GET /purchasing/open-to-buy?year=&period=&categoryId=&warehouseId=`; `GET /purchasing/open-to-buy/orders?categoryId=&warehouseId=&month=` | Số còn được mua; các đơn đã tính vào một ô |
| API_240 | `POST /purchasing/orders/budget-check` | Kiểm tra ngân sách cho đơn đang lập (dòng, kho, ngày, đồng tiền, mã đơn khi sửa); trả các ô và cờ vượt. Chi tiết đơn mua (API_75) thêm `budgetCheck` |

Mini app Mua hàng nghe `core.approval.completed` của `purchasing.budget_plan`, `purchasing.budget_adjustment`, `purchasing.order_over_budget`.

## 9. Điều kiện đặc biệt

- Kiểm tra ngân sách khi gửi duyệt đơn mua chạy trong cùng giao dịch gửi duyệt, khóa các dòng ngân sách liên quan (`FOR UPDATE`) để hai đơn gửi cùng lúc không cùng lọt trong ngân sách.
- Tính đã dùng trong một truy vấn có tham số; điều kiện công ty nằm trong truy vấn.
- Không đổi kết quả luồng duyệt đơn mua của công ty chưa lập ngân sách (QUYTAC_NGHIEPVU_450).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_412 | Lập, sửa kế hoạch: ô ngành hàng cấp 1 × kho × tháng; kiểm tra kỳ tối đa 12 tháng, số không âm, ngành hàng không phải cấp 1 bị từ chối | Bắt buộc | KICHBAN_KIEMTHU_585 |
| TIEUCHI_NGHIEMTHU_413 | Gửi duyệt kế hoạch qua luồng `purchasing.budget_plan`; chưa có chính sách thì báo lỗi; trùng tháng với kế hoạch khác bị từ chối; rút, hủy đúng trạng thái | Bắt buộc | KICHBAN_KIEMTHU_586, 587 |
| TIEUCHI_NGHIEMTHU_414 | Đã dùng tính đúng theo trạng thái đơn (đã duyệt, nhận đủ, đóng sớm tính phần đã nhận, đơn chờ duyệt không tính), chưa thuế, quy đổi tỷ giá | Bắt buộc | KICHBAN_KIEMTHU_588 |
| TIEUCHI_NGHIEMTHU_415 | Số còn được mua theo tháng, quý, năm, ngành hàng, kho đúng; xem các đơn đã tính của một ô | Bắt buộc | KICHBAN_KIEMTHU_589 |
| TIEUCHI_NGHIEMTHU_416 | Đơn mua hiện cảnh báo ô vượt, ô chưa có ngân sách; không chặn lưu | Bắt buộc | KICHBAN_KIEMTHU_590 |
| TIEUCHI_NGHIEMTHU_417 | Gửi duyệt đơn vượt (kể cả đơn miễn duyệt, duyệt lại) đi luồng `purchasing.order_over_budget`; trong ngân sách hoặc tháng chưa áp dụng đi luồng cũ; chưa có chính sách vượt thì báo lỗi; hai đơn được duyệt ngay khi gửi (công ty chưa có chính sách duyệt đơn mua) gửi đồng thời, mỗi đơn vừa đủ phần còn lại: một đơn duyệt ngay, đơn kia đi luồng vượt ngân sách (đơn chờ duyệt không giữ chỗ ngân sách, QUYTAC_NGHIEPVU_446) | Bắt buộc | KICHBAN_KIEMTHU_591, 592 |
| TIEUCHI_NGHIEMTHU_418 | Phiếu điều chỉnh tăng, giảm, chuyển; duyệt xong áp đúng vào ô; giảm dưới số đã dùng bị từ chối khi gửi | Bắt buộc | KICHBAN_KIEMTHU_593 |
| TIEUCHI_NGHIEMTHU_419 | Phân quyền: không có quyền bị 403; dữ liệu công ty khác 404; nhật ký thao tác đủ | Bắt buộc | KICHBAN_KIEMTHU_594 |
| TIEUCHI_NGHIEMTHU_420 | Chức năng đơn mua cũ không đổi khi công ty chưa có ngân sách (kiểm thử CONG_VIEC_07, 09 đạt) | Bắt buộc | KICHBAN_KIEMTHU_595 |
| TIEUCHI_NGHIEMTHU_421 | Giao diện MAN_HINH_204 đến 209 đúng bản mẫu, đạt danh sách rà soát giao diện | Bắt buộc | KICHBAN_KIEMTHU_596 |

## 11. Kịch bản kiểm thử

| Mã | Kịch bản | Tiêu chí |
|---|---|---|
| KICHBAN_KIEMTHU_585 | Lập kế hoạch 3 tháng, 2 ngành hàng, 2 kho; sửa; 13 tháng, số âm, ngành hàng cấp 2, kho công ty khác bị từ chối đúng ô | TIEUCHI_NGHIEMTHU_412 |
| KICHBAN_KIEMTHU_586 | Gửi duyệt khi chưa có chính sách: lỗi; có chính sách: chờ duyệt, duyệt xong Đã duyệt; từ chối, rút quay về sửa được | TIEUCHI_NGHIEMTHU_413 |
| KICHBAN_KIEMTHU_587 | Kế hoạch thứ hai trùng một tháng với kế hoạch đã duyệt bị từ chối khi gửi; hủy kế hoạch nháp | TIEUCHI_NGHIEMTHU_413 |
| KICHBAN_KIEMTHU_588 | Đơn nháp, chờ duyệt, đã duyệt, nhận đủ, đóng sớm sau nhận một phần, đơn USD, đơn có trả hàng: số đã dùng từng ô | TIEUCHI_NGHIEMTHU_414 |
| KICHBAN_KIEMTHU_589 | API_239 theo tháng, quý, năm; lọc ngành hàng, kho; danh sách đơn của ô | TIEUCHI_NGHIEMTHU_415 |
| KICHBAN_KIEMTHU_590 | API_240 với đơn trong ngân sách, vượt một ô, ô chưa có, tháng chưa áp dụng; khi sửa đơn không tính chính đơn | TIEUCHI_NGHIEMTHU_416 |
| KICHBAN_KIEMTHU_591 | Gửi duyệt đơn trong ngân sách (luồng cũ), vượt (luồng vượt), đơn miễn duyệt vượt, duyệt lại sau sửa tăng giá trị vượt; chưa có chính sách vượt: lỗi | TIEUCHI_NGHIEMTHU_417 |
| KICHBAN_KIEMTHU_592 | Công ty chưa có chính sách duyệt đơn mua: hai đơn được duyệt ngay khi gửi, gửi đồng thời, mỗi đơn vừa đủ phần còn lại của ô: một đơn duyệt ngay, đơn kia đi luồng `purchasing.order_over_budget` (đơn chờ duyệt không giữ chỗ ngân sách, QUYTAC_NGHIEPVU_446) | TIEUCHI_NGHIEMTHU_417 |
| KICHBAN_KIEMTHU_593 | Phiếu tăng, giảm, chuyển khác tháng; duyệt xong số ô đúng; giảm dưới đã dùng bị từ chối | TIEUCHI_NGHIEMTHU_418 |
| KICHBAN_KIEMTHU_594 | Người không có `purchasing.budget.view`, `.manage` gọi API_235 đến 239: 403; mã công ty khác: 404; nhật ký thao tác | TIEUCHI_NGHIEMTHU_419 |
| KICHBAN_KIEMTHU_595 | Chạy lại kiểm thử đơn mua, giao dịch nội bộ hiện có với công ty không có ngân sách | TIEUCHI_NGHIEMTHU_420 |
| KICHBAN_KIEMTHU_596 | Mở từng màn hình bằng tài khoản thử, so bản mẫu, chạy danh sách rà soát giao diện | TIEUCHI_NGHIEMTHU_421 |

## 12. Ràng buộc kỹ thuật

- Backend trong `apps/api/src/purchasing` (tệp mới `budgets.service.ts`, `budget-adjustments.service.ts`, `open-to-buy.ts`); `orders.service.ts` chỉ thêm bước kiểm tra trong `sendForApproval` và trường `budgetCheck`.
- Dùng lại `ApprovalRequestsService.submitWithin`, dãy số chứng từ, nhật ký thao tác, quy đổi tỷ giá như luồng duyệt.
- Giao diện trong `apps/web-purchasing`, thành phần `packages/ui`, chuỗi `packages/i18n`. Không thêm thư viện.
- Kiểm thử tích hợp Vitest với PostgreSQL thật: `apps/api/test/c58-*.test.ts`.

## 13. Thành phần không được thay đổi

Hành vi đơn mua, đề nghị mua, giao dịch nội bộ, nhập mua khi công ty chưa có kế hoạch ngân sách; dữ liệu, API đơn mua hiện có (chỉ thêm trường). Ràng buộc kiểm tra dùng chung không bị định nghĩa lại.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Người dùng xem, thử | Phản hồi |
|---|---|---|---|
| L0 | Database migration 0116, quyền, loại chứng từ; API_235, 236; MAN_HINH_204, 205 | Lập kế hoạch, gửi duyệt, duyệt ở mini app Nền tảng | |
| L1 | Tính đã dùng, API_239, MAN_HINH_206 | Xem số còn được mua với đơn mua dữ liệu thử | |
| L2 | Database migration 0118, API_240, kiểm tra khi gửi duyệt đơn mua, MAN_HINH_209 | Lập đơn vượt ngân sách, thấy cảnh báo, đi luồng duyệt vượt | |
| L3 | Database migration 0117, API_237, 238, MAN_HINH_207, 208 | Lập phiếu chuyển ngân sách, duyệt, xem số mới | |

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.

## 16. Quyết định của người dùng

- 2026-11-12: ô ngân sách = ngành hàng × kho × tháng; số còn được mua = ngân sách − đơn đã duyệt (không trừ tồn kế hoạch); vượt ngân sách thì cảnh báo khi lập và chuyển luồng duyệt riêng cấp cao; ô chưa có ngân sách coi như 0, công ty chưa lập ngân sách tháng đó thì không kiểm tra; quyền riêng lập, kế hoạch đi luồng duyệt dùng chung; điều chỉnh giữa kỳ bằng phiếu có duyệt; đặt trong mini app Mua hàng; giá trị chưa thuế, quy đổi đồng tiền hạch toán.
- 2026-11-12: duyệt đặc tả; đơn đóng sớm tính phần đã nhận, hàng trả nhà cung cấp không hoàn ngân sách; đơn vượt khi chưa có chính sách duyệt vượt ngân sách thì báo lỗi; chọn phương án 1 của phân tích giải pháp có sẵn.
- 2026-11-12: duyệt bản mẫu MAN_HINH_204 đến 209.
- 2026-11-12: duyệt L0, L1, L2 (giữ quy tắc đơn chờ duyệt không giữ chỗ ngân sách; menu phẳng).

## Phân tích giải pháp có sẵn – CONG_VIEC_58 – 2026-11-12

- Yêu cầu cần đáp ứng: YCAU_NGHIEPVU_143 đến 148.
- Nguồn đã tìm: mã nguồn dự án (luồng duyệt dùng chung `core.approval_policies`, đơn mua `purchasing.orders`, mẫu ngân sách khuyến mãi `sales.promotions.budget_amount`, ngành hàng `catalog.categories`); nguồn riêng V-com-ERP (MOD-12, chưa đọc mã: cấu trúc dữ liệu khác dự án); thư viện công cộng: không có thư viện ngân sách mua dùng được cho NestJS, Drizzle; phần mềm ERP mã nguồn mở (Odoo `account_budget`, ERPNext Budget) là cả hệ thống, không nhúng được.

| Ứng viên | Nguồn | Giấy phép | Tương thích công nghệ | Công sức điều chỉnh |
|---|---|---|---|---|
| 1. Tự xây trên luồng duyệt, đơn mua có sẵn | Dự án | Của dự án | Đầy đủ | Thấp: chỉ thêm bảng, service, màn hình |
| 2. Odoo `account_budget` | GitHub | LGPL-3.0 | Python, ORM riêng, không dùng được | Cao: chỉ tham khảo khái niệm |
| 3. ERPNext Budget | GitHub | GPL-3.0 | Python, Frappe, không dùng được | Cao: chỉ tham khảo (hành động khi vượt: Stop, Warn, Ignore) |

Đề xuất: phương án 1. Không thêm thư viện.
