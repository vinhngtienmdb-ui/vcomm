# CONG_VIEC_22: Phần Kinh doanh của ứng dụng VComm (MODULE_07)

- Mô tả: Làm lại công việc ứng dụng nhân viên kinh doanh theo mô hình B2C (THAY_DOI_14, THAY_DOI_26). Không còn ứng dụng riêng: mở rộng mục Kinh doanh của ứng dụng VComm với chi tiết khách, chia sẻ sản phẩm kèm mã giới thiệu, ghi chú chăm sóc và lịch hẹn có nhắc trong ứng dụng, doanh số theo tháng. Ẩn chức năng ghé thăm khách.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đang thực hiện. Người dùng duyệt đặc tả và bản mẫu MAN_HINH_196 đến 201 ngày 2026-11-12.
- Nguồn: THAY_DOI_14, THAY_DOI_16, THAY_DOI_26, THAY_DOI_28; CONG_VIEC_23, 24, 26, 27 (đã phát hành 0.3.0); quyết định của người dùng ngày 2026-11-11 (câu hỏi trong phiên CONG_VIEC_22).
- Nhánh: `chuc-nang/CONG_VIEC_22-kinh-doanh-vcomm` (mới, tạo từ `main` 453d3ed). Nhánh cũ `chuc-nang/CONG_VIEC_22-ung-dung-kinh-doanh` không dùng lại: L0 đến L4 của nhánh cũ đã có trong `main`, CONG_VIEC_23 đã thay `apps/mobile-sales` bằng `apps/mobile-vcomm`.

## 0. Đối chiếu bản cũ (phiên bản 0.1) với `main`

| Phần bản cũ | Hiện trạng trên `main` | Xử lý |
|---|---|---|
| Ứng dụng `apps/mobile-sales` | Đã thay bằng `apps/mobile-vcomm` (CONG_VIEC_23) | Bỏ; làm trong mục Kinh doanh của ứng dụng VComm |
| API_112 đăng nhập ứng dụng bằng token | Ứng dụng VComm, ứng dụng kho đang dùng | Giữ nguyên |
| Khách của tôi (CHUC_NANG_100) | Đã có danh sách khách phụ trách, khách của cấp dưới (CONG_VIEC_23, 27; MAN_HINH_78, 84) | Giữ; thêm chi tiết khách (CHUC_NANG_204) |
| API_113 tóm tắt đối tác B2B | Còn, theo `crm.partners` | Không dùng cho khách người mua; giữ cho web-crm |
| Đơn bán trên ứng dụng (CHUC_NANG_101) | Ứng dụng cũ đã gỡ | Bỏ: không tạo đơn hộ khách (THAY_DOI_14); thay bằng chia sẻ sản phẩm |
| Hoa hồng của tôi (CHUC_NANG_102, API_115) | Đã gỡ ở CONG_VIEC_43 | Bỏ; ví hoa hồng (CONG_VIEC_26) thay thế |
| Ghé thăm khách (CHUC_NANG_103, API_114, MAN_HINH_72, bảng `crm.visits`) | Còn, theo đối tác B2B | Ẩn, giữ bảng và mã (THAY_DOI_26) |

## 1. Mục tiêu

Nhân viên kinh doanh và người quản lý chăm sóc khách người mua ngay trên ứng dụng VComm: xem chi tiết từng khách, gửi sản phẩm kèm mã giới thiệu, ghi lại lần chăm sóc, hẹn lần sau và được nhắc, theo dõi doanh số tháng của mình và của nhánh.

## 2. Phạm vi

Trong phạm vi:
- Chi tiết khách trên ứng dụng VComm (nhân viên phụ trách, cấp trên trong nhánh).
- Chia sẻ đường dẫn sản phẩm có mã giới thiệu của người chia sẻ.
- Ghi chú chăm sóc có ngày hẹn; danh sách hẹn; nhắc hẹn bằng thông báo trong ứng dụng; mục Thông báo trên ứng dụng VComm.
- Doanh số của tôi theo tháng; người quản lý xem doanh số từng người trong nhánh.
- Ẩn ghé thăm khách trên web-crm; API từ chối ghi mới.

Ngoài phạm vi: tạo đơn hoặc giỏ hàng hộ khách; thông báo đẩy (cần đóng gói ứng dụng, làm sau); sửa, xóa ghi chú; xem địa chỉ giao hàng của khách; dùng khi mất mạng; chỉ tiêu doanh số.

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_138: Nhân viên kinh doanh, người quản lý chăm sóc khách người mua mình phụ trách hoặc trong nhánh trên ứng dụng VComm: xem chi tiết khách, ghi chú chăm sóc, hẹn và được nhắc.
- YCAU_NGHIEPVU_139: Nhân viên kinh doanh gửi sản phẩm cho khách bằng đường dẫn có mã giới thiệu; khách tự đặt hàng.
- YCAU_NGHIEPVU_140: Nhân viên kinh doanh, người quản lý theo dõi doanh số tháng của mình và của từng người trong nhánh.
- CHUC_NANG_204: Chi tiết khách và chia sẻ sản phẩm.
- CHUC_NANG_205: Ghi chú chăm sóc, lịch hẹn, nhắc hẹn trong ứng dụng.
- CHUC_NANG_206: Doanh số của tôi, doanh số nhánh.
- Sửa CHUC_NANG_103 (ghé thăm khách): ẩn theo THAY_DOI_26.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_432: Phạm vi khách trên ứng dụng: người gọi phải đang được đánh dấu nhân viên kinh doanh (không thì 403). Người gọi xem được một khách khi khách đó do chính mình phụ trách (QUYTAC_NGHIEPVU_145) hoặc do một người trong nhánh của mình phụ trách (QUYTAC_NGHIEPVU_150, 151). Ngoài phạm vi trả 404 (không lộ khách có tồn tại hay không). Phạm vi tính tại thời điểm gọi: khách đổi người giới thiệu thì người cũ không còn xem được.
- QUYTAC_NGHIEPVU_433: Chi tiết khách gồm: họ tên, số điện thoại (định dạng trong nước), ngày đăng ký, nhân viên phụ trách (họ tên, chức danh); số đơn và tổng tiền đơn hoàn tất (theo `completed_amount`, đã trừ trả hàng); số đơn đang xử lý; 10 đơn gần nhất (mã đơn, ngày đặt, tiền hàng, trạng thái); hoa hồng của chính người xem phát sinh từ đơn của khách này (đã cộng ví, đang chờ); 20 ghi chú chăm sóc gần nhất. Không hiện địa chỉ giao hàng, người nhận, chi tiết thanh toán, hạn mức. Không mở chi tiết đơn của khách.
- QUYTAC_NGHIEPVU_434: Chia sẻ sản phẩm: trên trang sản phẩm (MAN_HINH_91) có một nút "Chia sẻ sản phẩm" cho mọi tài khoản người mua, thay nút "Chia sẻ nhận hoa hồng" của CONG_VIEC_49 (quyết định của người dùng 2026-11-12: một nút, gộp cả hai mã; THAY_DOI_28). Đường dẫn `<địa chỉ ứng dụng>/r/<mã giới thiệu>?sp=<mã sản phẩm>`, cộng tác viên đã duyệt có thêm `&ctv=<mã cộng tác viên>`; không có mã giới thiệu thì dùng đường dẫn cộng tác viên `/p/<mã sản phẩm>?ctv=<mã>` (QUYTAC_NGHIEPVU_325). Bấm nút mở thẻ xem trước nội dung, Sao chép, Chia sẻ (bảng chia sẻ của máy; bản xem trước web dùng chia sẻ của trình duyệt hoặc sao chép). Người nhận chưa đăng nhập: mở đăng ký với mã điền sẵn; đăng ký hoặc đăng nhập xong trong cùng lần mở ứng dụng thì mở trang sản phẩm. Người nhận đã đăng nhập: mở thẳng trang sản phẩm; không đổi người giới thiệu (đổi người giới thiệu theo QUYTAC_NGHIEPVU_142, 143). Có mã cộng tác viên thì ghi lượt bấm như QUYTAC_NGHIEPVU_325 (chưa đăng nhập thì ghi sau khi đăng nhập). Sản phẩm không còn bán thì trang sản phẩm báo "Sản phẩm không còn bán." kèm nút Về trang chủ. Hoa hồng vẫn theo người giới thiệu của người mua lúc đặt (QUYTAC_NGHIEPVU_201) và lượt bấm cộng tác viên (QUYTAC_NGHIEPVU_326).
- QUYTAC_NGHIEPVU_435: Ghi chú chăm sóc: người xem được khách (QUYTAC_NGHIEPVU_432) ghi được. Gồm kênh (gọi điện, nhắn tin, gặp trực tiếp, khác), nội dung 1 đến 1.000 ký tự, ngày hẹn tiếp theo (tùy chọn, từ hôm nay đến 365 ngày sau, theo giờ Việt Nam). Thời điểm ghi do máy chủ ghi. Ghi chú không sửa, không xóa. Mọi người đang xem được khách thì xem được mọi ghi chú của khách, kể cả ghi chú của người phụ trách trước.
- QUYTAC_NGHIEPVU_436: Hẹn: mỗi ghi chú có ngày hẹn là một hẹn của người ghi. Hẹn ở trạng thái chờ cho tới khi người ghi bấm Đã xong (ghi thời điểm). Người ghi mất quyền xem khách thì hẹn vẫn giữ nhưng không còn hiện, không nhắc. Danh sách hẹn của tôi: quá hạn (ngày hẹn trước hôm nay), hôm nay, 7 ngày tới; sắp theo ngày hẹn.
- QUYTAC_NGHIEPVU_437: Nhắc hẹn: 07:00 hằng ngày (giờ Việt Nam) hệ thống tạo cho mỗi người có hẹn chờ đến hạn hoặc quá hạn (còn xem được khách, còn được đánh dấu nhân viên kinh doanh) một thông báo trong ứng dụng (`core.notifications`, loại `sales.follow_up_due`) ghi số hẹn hôm nay và số hẹn quá hạn, liên kết tới danh sách hẹn. Mỗi người tối đa một thông báo một ngày; chạy lại trong ngày không tạo trùng. Không gửi thư điện tử, tin nhắn, thông báo đẩy.
- QUYTAC_NGHIEPVU_438: Mục Thông báo trên ứng dụng VComm dùng API_48 (30 thông báo mới nhất của chính mình, số chưa đọc); bấm thông báo thì đánh dấu đã đọc và mở liên kết nếu liên kết thuộc ứng dụng. Biểu tượng mục Thông báo hiện số chưa đọc.
- QUYTAC_NGHIEPVU_439: Doanh số tháng của một nhân viên = tổng `completed_amount` của các đơn VComm hoàn tất trong tháng (theo `completed_at`, giờ Việt Nam) mà nhân viên đó là người phụ trách khách lúc đặt đơn (quyết định của người dùng 2026-11-12; khớp người hưởng hoa hồng, QUYTAC_NGHIEPVU_201). Khách đổi người phụ trách thì doanh số của các đơn đã đặt vẫn thuộc người cũ. Kèm số đơn hoàn tất, số khách có đơn hoàn tất, số đơn đang xử lý (chưa hoàn tất, chưa hủy) và tiền hàng của các đơn đó, tính tại thời điểm xem. Tiền làm tròn theo đơn vị tiền tệ của công ty vận hành sàn.
- QUYTAC_NGHIEPVU_440: Doanh số nhánh: người quản lý xem doanh số tháng của chính mình và của từng người trong nhánh (một dòng mỗi người, có tổng nhánh); nhân viên không có cấp dưới chỉ thấy của mình. Chọn tháng từ tháng đăng ký đánh dấu đầu tiên đến tháng hiện tại, tối đa 24 tháng gần nhất.
- QUYTAC_NGHIEPVU_441: Ẩn ghé thăm khách: web-crm bỏ menu Ghé thăm, MAN_HINH_72 trả về trang không tìm thấy, bỏ thẻ "Ghé thăm gần đây" trên MAN_HINH_37. `POST /crm/visits` trả 409 mã `BUSINESS_RULE`, thông báo "Chức năng ghé thăm khách đã tắt, không ghi được lượt mới." (mô hình lỗi tài liệu `17` không có mã riêng). API đọc giữ nguyên quyền, không còn giao diện dùng. Bảng `crm.visits`, ảnh, quyền `crm.visit.manage`, dịch vụ ghi lượt ở máy chủ giữ nguyên để có thể bật lại bằng phiếu thay đổi; mã giao diện ghé thăm trên web-crm gỡ (khôi phục từ lịch sử Git khi bật lại).

## 5. Vai trò và quyền

Không thêm quyền. Phần Kinh doanh dùng đánh dấu nhân viên kinh doanh và nhánh của CONG_VIEC_27 (QUYTAC_NGHIEPVU_145, 150, 151). Thông báo dùng API_48 (người đăng nhập). Chia sẻ sản phẩm: mọi tài khoản người mua có mã giới thiệu. Quyền `crm.visit.manage` không còn dùng trên giao diện.

## 6. Luồng nghiệp vụ

Luồng 54: nhân viên mở Kinh doanh → thấy hẹn hôm nay, doanh số tháng → mở một khách → xem đơn, hoa hồng từ khách, ghi chú cũ → gọi khách → ghi chú (kênh, nội dung, hẹn) → khi khách hỏi sản phẩm: mở sản phẩm → Chia sẻ → khách mở đường dẫn, tự đặt → 07:00 ngày hẹn nhận thông báo → mở danh sách hẹn → chăm sóc, bấm Đã xong. Người quản lý mở Doanh số nhánh → chọn một người → xem khách của người đó → mở chi tiết khách.

## 7. Màn hình (ứng dụng VComm, khổ điện thoại; bản xem trước web)

- Sửa MAN_HINH_78 Kinh doanh: thêm thẻ "Hẹn hôm nay" (số hẹn hôm nay, quá hạn; mở MAN_HINH_198), thẻ "Doanh số tháng này" (mở MAN_HINH_199); mỗi khách trong danh sách bấm mở MAN_HINH_196. MAN_HINH_84 (khách của cấp dưới) cũng mở MAN_HINH_196.
- MAN_HINH_196 Chi tiết khách: thông tin, nút Gọi, Ghi chú; số liệu đơn; đơn gần nhất; hoa hồng của tôi từ khách; ghi chú chăm sóc.
- MAN_HINH_197 Thêm ghi chú chăm sóc: kênh, nội dung, ngày hẹn (tùy chọn).
- MAN_HINH_198 Hẹn của tôi: nhóm Quá hạn, Hôm nay, 7 ngày tới; bấm mở khách; nút Đã xong.
- MAN_HINH_199 Doanh số: chọn tháng; doanh số của tôi; với người quản lý thêm bảng từng người trong nhánh và tổng nhánh, bấm một người mở khách của người đó (MAN_HINH_84).
- MAN_HINH_200 Thông báo: danh sách, chưa đọc in đậm; số chưa đọc trên biểu tượng đầu mục Trang chủ.
- MAN_HINH_201 Chia sẻ sản phẩm: nút Chia sẻ trên trang sản phẩm, bảng xem trước nội dung, sao chép, chia sẻ.
- Sửa web-crm: bỏ menu Ghé thăm, thẻ ghé thăm trên MAN_HINH_37 (MAN_HINH_72 ẩn).

MAN_HINH_202, 203 để dự phòng.

## 8. Dữ liệu và API

- Database migration 0113 `marketplace.customer_care_notes`: `id`, `company_id` (công ty vận hành sàn), `buyer_user_id`, `author_user_id`, `channel` (`call`, `message`, `meeting`, `other`), `content` (1 đến 1.000 ký tự), `follow_up_on` (date, có thể trống), `follow_up_done_at`, `created_at`; kiểm tra `follow_up_done_at` chỉ có khi có `follow_up_on`. Chỉ mục theo khách và thời điểm; chỉ mục một phần theo người ghi và ngày hẹn cho hẹn chờ. Không sửa, không xóa (trừ cột đã xong).
- Database migration 0114: thêm cột `marketplace.orders.sales_staff_user_id` (người phụ trách khách lúc đặt đơn, có thể trống), ghi khi đặt đơn (sửa dịch vụ đặt hàng của CONG_VIEC_24, không đổi hợp đồng API); điền cho đơn cũ từ dòng hoa hồng phần `staff` của đơn nếu có; chỉ mục theo người phụ trách và `completed_at` cho đơn hoàn tất.
- API_228 `GET /buyer/sales/customers/:id`: chi tiết khách (QUYTAC_NGHIEPVU_432, 433).
- API_229 `POST /buyer/sales/customers/:id/notes`: thêm ghi chú (QUYTAC_NGHIEPVU_435). `GET /buyer/sales/customers/:id/notes?cursor=`: ghi chú cũ hơn.
- API_230 `GET /buyer/sales/follow-ups`: hẹn của tôi (QUYTAC_NGHIEPVU_436); `POST /buyer/sales/follow-ups/:noteId/done`: đánh dấu đã xong (chỉ người ghi).
- API_231 `GET /buyer/sales/revenue?month=YYYY-MM`: doanh số của tôi và nhánh (QUYTAC_NGHIEPVU_439, 440).
- API_48 dùng lại cho thông báo trên ứng dụng. API_232 đến 234 để dự phòng.
- Việc nền `marketplace-sales-follow-ups` (BullMQ, `0 7 * * *` giờ Việt Nam) tạo thông báo nhắc hẹn.
- Sửa API_114: `POST /crm/visits` trả 409 `BUSINESS_RULE` (QUYTAC_NGHIEPVU_441).

## 9. Điều kiện đặc biệt

- Ghi chú chăm sóc có thể chứa dữ liệu cá nhân của khách: chỉ người trong phạm vi xem; không ghi nội dung ghi chú vào nhật ký thao tác (chỉ ghi mã ghi chú, khách, người ghi); bổ sung tài liệu `22`.
- Hoãn lập trình API_228 (phần đơn), API_231 tới khi `main` đã có bản 0.5.0 (PR #117, đổi đơn, thanh toán); hợp nhất `main` mới trước lát doanh số.
- Migration 0114 chỉ thêm cột, chỉ mục; không định nghĩa lại ràng buộc kiểm tra của `marketplace.orders` (CONG_VIEC_57, PR #118, migration 0110 định nghĩa lại `orders_cod_amount_method_check`, thêm `fulfillment_mode`, `station_id`, `warehouse_id`). Khi sửa dịch vụ đặt đơn, giữ phần của CONG_VIEC_57 nếu đã vào `main`.

## 10. Câu hỏi mở (chờ người dùng)

Không còn. Câu hỏi 1 (gán đơn khi tính doanh số) người dùng chọn người phụ trách lúc đặt đơn (2026-11-12).

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_402 | Chi tiết khách đúng phạm vi: khách của mình, của người trong nhánh xem được; ngoài phạm vi, không được đánh dấu nhận 404, 403 | Bắt buộc | KICHBAN_KIEMTHU_573 |
| TIEUCHI_NGHIEMTHU_403 | Chi tiết khách đúng số liệu (đơn hoàn tất, đang xử lý, 10 đơn gần nhất, hoa hồng của người xem) và không có địa chỉ, người nhận | Bắt buộc | KICHBAN_KIEMTHU_574 |
| TIEUCHI_NGHIEMTHU_404 | Ghi chú: kiểm kênh, độ dài, ngày hẹn; không sửa, xóa; người trong phạm vi xem được; nhật ký thao tác không chứa nội dung | Bắt buộc | KICHBAN_KIEMTHU_575 |
| TIEUCHI_NGHIEMTHU_405 | Hẹn của tôi đúng nhóm quá hạn, hôm nay, 7 ngày tới theo giờ Việt Nam; chỉ người ghi đánh dấu đã xong; mất phạm vi thì không hiện | Bắt buộc | KICHBAN_KIEMTHU_576 |
| TIEUCHI_NGHIEMTHU_406 | Nhắc hẹn tạo đúng một thông báo mỗi người mỗi ngày, đúng số; chạy lại không trùng; không nhắc người hết phạm vi | Bắt buộc | KICHBAN_KIEMTHU_577 |
| TIEUCHI_NGHIEMTHU_407 | Doanh số tháng đúng định nghĩa, đúng ranh giới tháng giờ Việt Nam, trừ trả hàng; nhánh đúng người, tổng khớp | Bắt buộc | KICHBAN_KIEMTHU_578, 579 |
| TIEUCHI_NGHIEMTHU_408 | Ghé thăm: ghi mới trả 409 `BUSINESS_RULE`; lượt đã có vẫn đọc được; web-crm không còn menu, trang, thẻ ghé thăm | Bắt buộc | KICHBAN_KIEMTHU_290, 291, 580 |
| TIEUCHI_NGHIEMTHU_409 | Đường dẫn chia sẻ: chưa đăng nhập đăng ký xong mở đúng sản phẩm; đã đăng nhập mở sản phẩm, không đổi người giới thiệu | Bắt buộc | KICHBAN_KIEMTHU_581 |
| TIEUCHI_NGHIEMTHU_410 | Ứng dụng: Kinh doanh, chi tiết khách, ghi chú, hẹn, doanh số, thông báo, chia sẻ chạy được trên bản xem trước web khổ 390 điểm ảnh | Bắt buộc | KICHBAN_KIEMTHU_582 |
| TIEUCHI_NGHIEMTHU_411 | Danh sách khách, chi tiết khách, doanh số nhánh trả lời dưới 1 giây với 1.000 khách, 20.000 đơn | Mong muốn | KICHBAN_KIEMTHU_583 |

## 12. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_573 đến 579, 583: tự động, `apps/api/test/c22-kinh-doanh-vcomm.test.ts`.
- KICHBAN_KIEMTHU_581: chia sẻ không đổi API (dùng lại đăng ký có mã giới thiệu, lượt bấm cộng tác viên đã có kiểm thử ở c23, c49); kiểm điều hướng bằng kịch bản Playwright trên bản xem trước web với API giả lập: đã đăng nhập mở thẳng sản phẩm; chưa đăng nhập vào đăng ký có mã, đăng nhập xong mở sản phẩm; sản phẩm ngừng bán báo đúng.
- TIEUCHI_NGHIEMTHU_408: kiểm bằng KICHBAN_KIEMTHU_290, 291 đã sửa (`apps/api/test/c22-sales-app.test.ts`); KICHBAN_KIEMTHU_580 kiểm thủ công web-crm không còn menu, trang, thẻ ghé thăm.
- KICHBAN_KIEMTHU_582: thủ công trên bản xem trước web của ứng dụng VComm khổ 390 điểm ảnh.
- KICHBAN_KIEMTHU_584 dự phòng.

Tiến độ: L0 xong (KICHBAN_KIEMTHU_573, 574, 290, 291 đạt; người dùng đồng ý 2026-11-12). L1 xong (KICHBAN_KIEMTHU_581 đạt trên bản xem trước).
- Sửa KICHBAN_KIEMTHU_290, 291 (ghé thăm): ghi mới bị từ chối; đọc giữ nguyên.

## 13. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng `Share`, `Linking` của React Native có sẵn. Thông báo trong ứng dụng dùng `core.notifications`, API_48. Việc nền dùng bộ lập lịch BullMQ có sẵn (`apps/api/src/jobs/background-jobs.ts`). Mã đặt trong `apps/api/src/marketplace` (phần đội kinh doanh), ghi vào schema `marketplace` và `core.notifications` như các việc nền có sẵn.

## 14. Thành phần không được thay đổi

Cách tính và người hưởng hoa hồng (CONG_VIEC_26); quy tắc người giới thiệu (QUYTAC_NGHIEPVU_142, 143); nhánh, chức danh (CONG_VIEC_27); API_112; dữ liệu `crm.visits`.

## 15. Các lát và điểm xem trước

- L0: ẩn ghé thăm; chi tiết khách (API_228, MAN_HINH_196; danh sách khách mở chi tiết). Xem trước: mở một khách trên ứng dụng.
- L1: chia sẻ sản phẩm (MAN_HINH_201; đường dẫn `/r/<mã>?sp=`).
- L2: ghi chú, hẹn (migration 0113; API_229, 230; MAN_HINH_197, 198; thẻ hẹn trên MAN_HINH_78).
- L3: nhắc hẹn (việc nền), mục Thông báo (MAN_HINH_200).
- L4: doanh số (migration 0114, API_231, MAN_HINH_199; thẻ doanh số trên MAN_HINH_78), sau khi hợp nhất `main` có bản 0.5.0.

## 16. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 17. Giới hạn đã biết

- Nhắc hẹn chỉ hiện khi mở ứng dụng; thông báo đẩy làm sau khi đóng gói ứng dụng.
- Sản phẩm chờ mở sau đăng ký chỉ giữ trong lần mở ứng dụng (như lượt bấm cộng tác viên); đóng ứng dụng giữa chừng thì về trang chủ.
- Tài liệu `09`, `10`, `14` (MAN_HINH_91) đã sửa theo THAY_DOI_28.
