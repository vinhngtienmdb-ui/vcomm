# CONG_VIEC_24: Đặt hàng trên VComm (MODULE_09, phần lõi 2)

- Mô tả: Người mua xem hàng đăng bán, cho vào giỏ, đặt hàng giao tận nơi trên ứng dụng VComm; VComm giao qua đơn vị vận chuyển (GHN đầu tiên), nhận yêu cầu trả hàng trong 7 ngày; đơn tự hoàn tất làm cơ sở hoa hồng.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (không làm bản mẫu riêng, xem trước từng lát). Chờ nghiệm thu.
- Nguồn: THAY_DOI_14; quyết định của người dùng ngày 2026-11-11 trong tài liệu `02`; CONG_VIEC_23 (tài khoản người mua), CONG_VIEC_27 (đội kinh doanh); CONG_VIEC_04, 05, 08, 12 (sản phẩm, bảng giá, kho, đơn bán, khuyến mãi).

## 1. Mục tiêu

Người mua tự đặt hàng của VComm trên ứng dụng; mỗi đơn có trạng thái rõ đến khi hoàn tất để tính hoa hồng (CONG_VIEC_26).

## 2. Phạm vi

Trong phạm vi:
- Cài đặt bán hàng VComm: kênh bán, kho xuất, phí giao hàng, mức miễn phí giao hàng, kích thước gói hàng mặc định.
- Đăng bán từng sản phẩm, mô tả cho người mua.
- Danh mục tỉnh, xã hai cấp; sổ địa chỉ của người mua.
- Danh sách hàng, tìm kiếm, chi tiết sản phẩm, giỏ hàng.
- Đặt hàng (thanh toán khi nhận hàng), đơn của tôi, hủy đơn.
- Người mua thử: khi chưa mở đặt hàng, chỉ người mua thử đặt được.
- Khung đơn vị vận chuyển chung; kết nối GHN: tạo vận đơn, hủy vận đơn, nhận trạng thái qua webhook, tra lại trạng thái.
- Quản trị đơn VComm trên web: danh sách, chi tiết, giao cho đơn vị vận chuyển, hủy.
- Trả hàng trong 7 ngày: yêu cầu trên ứng dụng, duyệt, từ chối, nhận hàng trả lại.
- Tự hoàn tất đơn.

Ngoài phạm vi: thanh toán trực tuyến, công tắc mở đặt hàng cho mọi người mua, hoàn tiền, đối soát COD, hạch toán phí giao hàng (CONG_VIEC_25); hoa hồng, ví (CONG_VIEC_26); mã giảm giá; đơn vị vận chuyển khác GHN; hàng quản lý theo lô, serial; bán theo đơn vị tính khác đơn vị cơ sở; đánh giá sản phẩm; thông báo đẩy về điện thoại.

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_50: Người mua tự đặt hàng của VComm trên ứng dụng VComm, giao tận nơi qua đơn vị vận chuyển, trả hàng trong 7 ngày; đơn hoàn tất khi hết hạn trả hàng.
- CHUC_NANG_113: Cài đặt bán hàng VComm và đăng bán sản phẩm.
- CHUC_NANG_114: Danh mục tỉnh, xã hai cấp và sổ địa chỉ của người mua.
- CHUC_NANG_115: Danh sách hàng, chi tiết sản phẩm, giỏ hàng trên ứng dụng.
- CHUC_NANG_116: Đặt hàng, đơn của tôi, hủy đơn; người mua thử.
- CHUC_NANG_117: Khung đơn vị vận chuyển, kết nối GHN, giao đơn và theo dõi vận đơn.
- CHUC_NANG_118: Trả hàng trong 7 ngày.
- CHUC_NANG_119: Tự hoàn tất đơn.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_154: Cài đặt bán hàng VComm thuộc công ty vận hành sàn: kênh bán (của công ty đó), kho xuất (kho của công ty đó), phí giao hàng mỗi đơn (≥ 0), mức giá trị hàng được miễn phí giao hàng (để trống: không miễn), kích thước gói mặc định (dài, rộng, cao cm; khối lượng tối thiểu g). Chưa có kênh bán hoặc kho thì ứng dụng không hiện hàng.
- QUYTAC_NGHIEPVU_155: Sản phẩm hiện trên ứng dụng khi: thuộc công ty vận hành sàn, đã duyệt, đang hoạt động, được bật đăng bán, ngành hàng không quản lý lô, serial, có ít nhất một biến thể đang hoạt động có giá đơn vị cơ sở trong bảng giá áp dụng cho kênh bán VComm (cách tìm giá như đơn bán, không nhóm khách) ở ngày hôm nay. Biến thể không có giá thì không bán. Còn hàng = số có thể bán (tồn trừ giữ hàng) tại kho xuất > 0. Giá hiện cho người mua là giá gồm thuế giá trị gia tăng; khuyến mãi theo sản phẩm đang chạy trên kênh VComm được áp như đơn bán.
- QUYTAC_NGHIEPVU_156: Sổ địa chỉ: tối đa 10 địa chỉ; mỗi địa chỉ có tên người nhận (1 đến 100 ký tự), số điện thoại di động Việt Nam, tỉnh, xã thuộc tỉnh đó (danh mục hai cấp từ 01/07/2025), địa chỉ chi tiết (1 đến 200 ký tự); đúng một địa chỉ mặc định khi sổ có địa chỉ. Đơn lưu bản sao địa chỉ lúc đặt; sửa, xóa địa chỉ trong sổ không đổi đơn đã đặt.
- QUYTAC_NGHIEPVU_157: Giỏ hàng của người mua lưu trên máy chủ, tối đa 50 dòng, mỗi dòng một biến thể, số lượng nguyên 1 đến 999. Giỏ hiện giá, còn hàng theo hiện tại; dòng không còn bán được hiện "Ngừng bán" và không đặt được.
- QUYTAC_NGHIEPVU_158: Đặt hàng: chỉ người mua thử được đặt cho đến khi mở đặt hàng ở CONG_VIEC_25; người mua đang hoạt động; chọn các dòng giỏ còn bán được và một địa chỉ trong sổ; thanh toán khi nhận hàng. Hệ thống tính lại giá, khuyến mãi; phí giao hàng = 0 nếu tổng tiền hàng (sau khuyến mãi, gồm thuế) ≥ mức miễn phí, ngược lại bằng phí cài đặt; tạo đơn bán của công ty vận hành sàn (kênh VComm, kho xuất, không gắn khách hàng, tên người mua là tên người nhận) và gửi ngay; đơn có ngoại lệ cần duyệt hoặc thiếu hàng thì không tạo, báo người mua. Giá người mua thấy khác giá tính lại thì báo "Giá đã thay đổi" kèm giá mới, người mua đặt lại. Mỗi người mua tối đa 20 lần đặt mỗi ngày. Đặt xong, các dòng đã đặt rời khỏi giỏ.
- QUYTAC_NGHIEPVU_159: Trạng thái đơn VComm: Chờ giao (đã giữ hàng) → Chờ lấy hàng (đã tạo vận đơn) → Đang giao (đơn vị vận chuyển đã lấy hàng: ghi sổ phiếu xuất giao hàng toàn đơn từ hàng giữ) → Đã giao (giao thành công; lưu thời điểm) → Hoàn tất. Người mua, nhân viên VComm hủy được ở Chờ giao, Chờ lấy hàng (hủy vận đơn trước; đơn vị vận chuyển từ chối hủy thì không hủy); hủy thì nhả hàng giữ, hủy đơn bán. Giao thất bại, đơn vị vận chuyển hoàn hàng về (trạng thái hoàn hàng xong) thì ghi sổ phiếu nhận hàng trả lại toàn bộ phần đã xuất, đơn VComm Đã hủy (lý do hoàn hàng), đơn bán đóng. Trạng thái bất thường, mất hàng của đơn vị vận chuyển hiện cho nhân viên, đơn giữ trạng thái đến khi đơn vị vận chuyển báo tiếp.
- QUYTAC_NGHIEPVU_160: Đơn vị vận chuyển: khung chung, mỗi đơn vị bật hoặc tắt; thông tin kết nối (token, mã cửa hàng, khóa webhook) chỉ ở biến môi trường. Giao đơn: nhân viên chọn một đơn vị đang bật; khối lượng = tổng khối lượng sản phẩm × số lượng (thiếu khối lượng thì dùng khối lượng tối thiểu), kích thước theo cài đặt; tiền thu hộ = tổng tiền hàng + phí giao hàng; người nhận trả phí vận chuyển cho VComm qua tiền thu hộ, VComm trả phí cho đơn vị vận chuyển. Webhook chỉ nhận khi đúng khóa trên đường dẫn; trạng thái chỉ đổi theo kết quả tra lại vận đơn từ đơn vị vận chuyển; nhận trùng không đổi kết quả. Giao đơn ghi vận đơn chờ xác nhận trước khi gọi đơn vị vận chuyển; không rõ kết quả thì nhân viên tra lại vận đơn (theo số đơn) trước khi giao lại hoặc hủy. Đơn bán, phiếu kho của đơn VComm chỉ xử lý từ màn hình Đơn VComm.
- QUYTAC_NGHIEPVU_161: Trả hàng: người mua gửi yêu cầu trong 7 ngày (168 giờ) từ thời điểm Đã giao; chọn dòng, số lượng (không vượt số đã giao trừ số đã yêu cầu ở các yêu cầu chưa bị từ chối), lý do (danh sách: hàng lỗi, sai hàng, không đúng mô tả, khác) và mô tả 1 đến 500 ký tự, 0 đến 5 ảnh (JPEG, PNG, tối đa 5 MB mỗi ảnh). Mỗi đơn một yêu cầu đang xử lý. Người mua rút được khi chờ duyệt. VComm duyệt (người mua gửi hàng về theo hướng dẫn) hoặc từ chối kèm ghi chú; yêu cầu đã duyệt: kho bấm "Đã nhận hàng trả" (ghi sổ phiếu nhận hàng trả lại theo dòng, số lượng của yêu cầu) hoặc "Không nhận được hàng" kèm ghi chú (kết thúc, không nhập kho). Kết quả báo cho người mua bằng thông báo trong ứng dụng.
- QUYTAC_NGHIEPVU_162: Đơn Đã giao tự chuyển Hoàn tất khi đã qua 7 ngày từ thời điểm Đã giao và không có yêu cầu trả hàng chờ duyệt hoặc đã duyệt chưa kết thúc; kiểm mỗi giờ. Giá trị hoàn tất = tổng tiền hàng gồm thuế của đơn trừ phần hàng trả đã nhận (không gồm phí giao hàng); trả hết thì giá trị 0, đơn vẫn Hoàn tất. Đơn Hoàn tất không đổi được nữa.

## 5. Vai trò và quyền

Quyền mới:
- `marketplace.order.view`: xem đơn VComm, yêu cầu trả hàng.
- `marketplace.order.manage`: giao đơn, hủy đơn, duyệt, từ chối, nhận hàng trả, cài đặt bán hàng, đăng bán, đánh dấu người mua thử.

Quản trị tập đoàn, quản trị công ty có sẵn hai quyền; giao cho nhân viên qua vai trò tùy chỉnh. Chỉ dùng tại công ty vận hành sàn. Người mua dùng API người mua, chỉ thấy giỏ, địa chỉ, đơn của chính mình.

## 6. Luồng nghiệp vụ

Luồng 37: quản trị cài đặt bán hàng, đăng bán sản phẩm → người mua thêm địa chỉ, cho hàng vào giỏ, đặt hàng (đơn bán tự gửi, giữ hàng) → nhân viên VComm giao cho GHN (vận đơn) → GHN lấy hàng (phiếu xuất ghi sổ) → giao thành công → trong 7 ngày người mua có thể yêu cầu trả hàng, VComm duyệt, kho nhận hàng trả → hết 7 ngày, không còn yêu cầu đang xử lý: đơn Hoàn tất. Nhánh: hủy trước khi lấy hàng; giao thất bại, hoàn hàng.

## 7. Màn hình

Web-crm:
- MAN_HINH_86 Cài đặt bán hàng VComm: kênh, kho, phí, mức miễn phí, kích thước gói; danh sách đơn vị vận chuyển (bật, tắt, trạng thái cấu hình).
- MAN_HINH_87 Đăng bán: danh sách sản phẩm của công ty vận hành sàn (tìm, lọc đã đăng hoặc chưa), bật tắt, sửa mô tả cho người mua; lý do không hiện (chưa có giá, quản lý lô, serial, chưa duyệt).
- MAN_HINH_88 Đơn VComm: danh sách (lọc trạng thái, tìm số đơn, số điện thoại), chi tiết (dòng, địa chỉ, vận đơn, lịch sử trạng thái), giao cho đơn vị vận chuyển, tra lại vận đơn, hủy.
- MAN_HINH_89 Yêu cầu trả hàng: danh sách, chi tiết (ảnh), duyệt, từ chối, đã nhận hàng trả, không nhận được hàng.
- Sửa MAN_HINH_80 (chi tiết người mua): đánh dấu, bỏ đánh dấu người mua thử.

Ứng dụng:
- MAN_HINH_90 Cửa hàng (thẻ mới): tìm kiếm, danh sách hàng (ảnh, tên, giá, hết hàng).
- MAN_HINH_91 Chi tiết sản phẩm: ảnh, giá, chọn biến thể, số lượng, mô tả, thêm vào giỏ.
- MAN_HINH_92 Giỏ hàng: dòng, số lượng, chọn dòng, tổng tạm tính.
- MAN_HINH_93 Đặt hàng: địa chỉ nhận, dòng, tiền hàng, phí giao hàng, tổng thanh toán, phương thức (khi nhận hàng), nút đặt.
- MAN_HINH_94 Sổ địa chỉ: danh sách, thêm, sửa, xóa, đặt mặc định (chọn tỉnh, xã có tìm kiếm).
- MAN_HINH_95 Đơn của tôi (thẻ mới): lọc trạng thái.
- MAN_HINH_96 Chi tiết đơn: trạng thái, vận đơn, dòng, tiền, hủy, yêu cầu trả hàng, xem yêu cầu.
- MAN_HINH_97 Yêu cầu trả hàng: chọn dòng, số lượng, lý do, mô tả, ảnh; rút yêu cầu.

## 8. Dữ liệu và API

- Database migration 0025:
  - `marketplace.provinces`, `marketplace.wards` (mã Tổng cục Thống kê, tên, loại; nạp từ bộ dữ liệu `thanglequoc/vietnamese-provinces-database`, giấy phép MIT).
  - `marketplace.store_settings` (công ty vận hành sàn).
  - `marketplace.listings` (sản phẩm, bật, mô tả, người, thời điểm).
  - `marketplace.buyer_addresses`; `marketplace.cart_lines`.
  - `marketplace.orders` (đơn bán, người mua, địa chỉ sao chép, phí giao hàng, tiền thu hộ, trạng thái, thời điểm Đã giao, Hoàn tất, giá trị hoàn tất, lý do hủy).
  - `marketplace.order_events` (lịch sử trạng thái).
  - `marketplace.carriers` (mã, bật); `marketplace.shipments` (đơn, đơn vị, mã vận đơn, trạng thái của đơn vị vận chuyển, phí, thời điểm); `marketplace.carrier_webhook_events` (nhận, kết quả).
  - `marketplace.return_requests`, `return_request_lines`, `return_request_images`.
  - `marketplace.buyer_accounts.is_test_buyer`.
  - Quyền `marketplace.order.view`, `marketplace.order.manage`; dãy số đơn bán dùng chung `sales.order`.
- API_123 cài đặt, đăng bán: `GET`, `PUT /marketplace/store-settings`; `GET /marketplace/listings`; `PUT /marketplace/listings/{productId}`; `PUT /marketplace/carriers/{code}`; `PUT /marketplace/buyers/{id}/test-buyer`.
- API_124 cửa hàng, giỏ hàng: `GET /buyer/shop/products`, `GET /buyer/shop/products/{id}`; `GET`, `PUT`, `DELETE /buyer/cart/lines`.
- API_125 địa chỉ: `GET /buyer/regions/provinces`, `GET /buyer/regions/provinces/{code}/wards`; `GET`, `POST /buyer/addresses`, `PUT`, `DELETE /buyer/addresses/{id}`, `POST /buyer/addresses/{id}/default`.
- API_126 đơn của người mua: `POST /buyer/orders/preview`, `POST /buyer/orders`; `GET /buyer/orders`, `GET /buyer/orders/{id}`; `POST /buyer/orders/{id}/cancel`.
- API_127 đơn VComm (quản trị): `GET /marketplace/orders`, `GET /marketplace/orders/{id}`; `POST /marketplace/orders/{id}/ship`, `/refresh-shipment`, `/cancel`.
- API_128 webhook vận chuyển: `POST /public/carriers/{code}/webhook/{key}`.
- API_129 trả hàng: `POST /buyer/orders/{id}/return-requests`, `POST /buyer/return-requests/{id}/withdraw`, `POST /buyer/return-requests/images`; `GET /marketplace/return-requests`, `GET /marketplace/return-requests/{id}`; `POST /marketplace/return-requests/{id}/approve`, `/reject`, `/receive`, `/not-received`.
- Việc nền mỗi giờ: hoàn tất đơn.

## 9. Điều kiện đặc biệt

- Kết nối GHN viết theo tài liệu công khai của GHN (tạo vận đơn theo địa chỉ hai cấp, hủy, tra vận đơn, webhook); kiểm thử tự động dùng máy chủ giả lập. Trước khi phát hành phải thử với tài khoản GHN môi trường thử nghiệm do người dùng cấp.
- Danh mục tỉnh, xã là dữ liệu danh mục (không phải dữ liệu thử), nạp cả trên môi trường thật.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_175 | Cài đặt bán hàng, đăng bán; chỉ sản phẩm đủ điều kiện hiện trên ứng dụng với giá, còn hàng đúng | Bắt buộc | KICHBAN_KIEMTHU_310 |
| TIEUCHI_NGHIEMTHU_176 | Danh mục tỉnh, xã đủ 34 tỉnh; sổ địa chỉ đúng giới hạn, xã thuộc tỉnh, một mặc định | Bắt buộc | KICHBAN_KIEMTHU_311 |
| TIEUCHI_NGHIEMTHU_177 | Giỏ hàng đúng giới hạn; đặt hàng tính đúng giá, khuyến mãi, phí giao hàng; tạo đơn bán, giữ hàng; thiếu hàng, giá đổi, chưa là người mua thử bị từ chối | Bắt buộc | KICHBAN_KIEMTHU_312, 313 |
| TIEUCHI_NGHIEMTHU_178 | Hủy đơn đúng trạng thái, nhả hàng giữ, hủy vận đơn; người mua chỉ thấy đơn của mình | Bắt buộc | KICHBAN_KIEMTHU_314 |
| TIEUCHI_NGHIEMTHU_179 | Giao cho GHN (giả lập): tạo vận đơn đúng thông tin; webhook sai khóa bị từ chối; lấy hàng ghi sổ phiếu xuất; giao thành công; hoàn hàng ghi sổ phiếu nhận hàng trả lại, đơn hủy; nhận trùng không đổi kết quả | Bắt buộc | KICHBAN_KIEMTHU_315, 316 |
| TIEUCHI_NGHIEMTHU_180 | Trả hàng: trong 7 ngày, số lượng không vượt, một yêu cầu đang xử lý; duyệt, từ chối, rút, nhận hàng trả, không nhận được hàng | Bắt buộc | KICHBAN_KIEMTHU_317 |
| TIEUCHI_NGHIEMTHU_181 | Tự hoàn tất đúng thời điểm, chờ yêu cầu trả hàng xong; giá trị hoàn tất trừ phần trả | Bắt buộc | KICHBAN_KIEMTHU_318 |
| TIEUCHI_NGHIEMTHU_182 | Ứng dụng: cửa hàng, chi tiết, giỏ, đặt hàng, sổ địa chỉ, đơn của tôi, trả hàng chạy được trên bản xem trước web khổ điện thoại | Bắt buộc | KICHBAN_KIEMTHU_319 |
| TIEUCHI_NGHIEMTHU_183 | MAN_HINH_86 đến MAN_HINH_89 hiển thị đúng trên máy tính và điện thoại | Mong muốn | KICHBAN_KIEMTHU_320 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_310 đến 318: tự động, `apps/api/test/c24-*.test.ts` (máy chủ GHN giả lập, đồng hồ kiểm thử).
- KICHBAN_KIEMTHU_319, 320: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại: `lookupPrice`, `applyPromotions`, `SalesOrdersService` (lập, gửi, hủy, đóng đơn), `ReservationsService`, `SalesDeliveriesService` (phiếu xuất, phiếu nhận hàng trả lại), lưu ảnh như ảnh sản phẩm, BullMQ, thông báo trong ứng dụng, bộ đếm giới hạn tần suất. Gọi GHN qua `fetch` có thời gian chờ.

## 13. Thành phần không được thay đổi

Màn hình, API đơn bán, kho, sản phẩm, bảng giá đã có; luồng duyệt đơn bán của các kênh khác; hóa đơn điện tử, công nợ, bút toán khi ghi sổ phiếu kho.

## 14. Các lát và điểm xem trước

- L0: database migration, danh mục tỉnh xã, cài đặt bán hàng, đăng bán, người mua thử (API_123; MAN_HINH_86, 87, sửa 80).
- L1: cửa hàng, chi tiết, giỏ hàng, sổ địa chỉ trên ứng dụng (API_124, 125; MAN_HINH_90, 91, 92, 94).
- L2: đặt hàng, đơn của tôi, hủy; đơn VComm trên web (API_126, 127 phần xem, hủy; MAN_HINH_93, 95, 96, 88).
- L3: khung vận chuyển, GHN, webhook, giao, hoàn hàng (API_127 phần giao, API_128).
- L4: trả hàng, tự hoàn tất (API_129; MAN_HINH_89, 97).

## 15. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_154 đến 162 có kiểm thử tự động (KICHBAN_KIEMTHU_310 đến 318 và phần bổ sung sau rà soát) |
| Đúng giao diện | Đạt: ứng dụng xem trước bản web khổ iPhone 13; web-crm máy tính và điện thoại không cuộn ngang, không lỗi trình duyệt (KICHBAN_KIEMTHU_319, 320; `tam_thoi/CONG_VIEC_24/xem_l0.js` đến `xem_l4.js`) |
| Đã xử lý lỗi | Đạt: lỗi nghiệp vụ có thông báo riêng; giao GHN không rõ kết quả có bước tra lại; ghi sổ lỗi khi lấy hàng ghi lịch sử cho kho |
| Đã kiểm thử, có kết quả trong tài liệu `25`, đạt cổng kiểm thử | Đạt: c24-marketplace-orders 12/12; toàn bộ 324/324 (40 tệp); không còn lỗi Nghiêm trọng, Cao |
| Không phá vỡ chức năng cũ | Đạt: kiểm thử cũ đạt; module Kho tách bước ghi sổ phiếu nháp, hành vi gửi phiếu cũ không đổi; đơn bán, phiếu kho thường không bị ảnh hưởng |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt: TIEUCHI_NGHIEMTHU_175 đến 182; mong muốn TIEUCHI_NGHIEMTHU_183 đạt |
| Đạt cổng bảo mật | Đạt: lỗi Cao, Trung bình của rà soát đã sửa; không thêm thư viện; không có khóa bí mật trong mã (token GHN ở biến môi trường); gitleaks trong CI chưa chạy do tài khoản GitHub lỗi thanh toán |
| Đã tự rà soát mã, dọn dẹp | Đạt: rà soát độc lập, sửa ở commit d8e3f7c; tệp tạm trong `tam_thoi/CONG_VIEC_24/` (Git bỏ qua) |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Đạt: 06 đến 14, 16, 17, 21, 22, 27, mục lục |

## 16. Giới hạn đã biết

- Kết nối GHN viết theo tài liệu công khai, kiểm thử bằng máy chủ giả lập; trước khi phát hành phải thử với tài khoản GHN môi trường thử nghiệm (tạo vận đơn theo địa chỉ hai cấp, tra theo số đơn, hủy, webhook). Khóa webhook nằm trên đường dẫn (GHN không ký webhook) nên có thể xuất hiện trong nhật ký máy chủ trung gian.
- Kho xuất của VComm không được quản lý vị trí; hàng quản lý lô, serial chưa bán trên ứng dụng; bán theo đơn vị cơ sở.
- Ảnh trả hàng chỉ đính kèm trên bản web của ứng dụng; trên điện thoại cần thêm thư viện chọn ảnh (chờ người dùng quyết định).
- Danh sách cửa hàng tính giá từng biến thể khi tải; số sản phẩm đăng bán lớn sẽ chậm, cần tối ưu khi có số liệu thực.
- Trạng thái vận chuyển hiện là trạng thái nhận gần nhất; webhook đến trễ có thể ghi đè trạng thái hiển thị (không đổi trạng thái đơn).
- Phí giao hàng chỉ lưu trên đơn; hạch toán, thu COD, đối soát, hoàn tiền làm ở CONG_VIEC_25; hoa hồng theo đơn hoàn tất ở CONG_VIEC_26.
