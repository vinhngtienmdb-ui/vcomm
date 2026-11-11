# CONG_VIEC_28: Kết nối đơn vị vận chuyển VNPost (MODULE_09)

- Mô tả: Thêm Bưu điện Việt Nam (VNPost, hệ thống MyVNPost; mã `vnpost`) vào khung đơn vị vận chuyển chung của CONG_VIEC_24: tạo vận đơn có tiền thu hộ, hủy, tra vận đơn, tìm theo số đơn, nhận trạng thái qua webhook, đọc tiền thu hộ cho đối soát.
- Mức: Vừa (chức năng mới trong một module; thêm giá trị mã đơn vị vận chuyển, không đổi API, không đổi màn hình).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (tra mã địa chỉ theo tên; người gửi ở biến môi trường; không kiểm chữ ký RSA của webhook; ánh xạ trạng thái như mục 4). Chờ nghiệm thu.
- Nguồn: yêu cầu của người dùng ngày 2026-11-11 qua phiên chính CONG_VIEC_25 ("tích hợp giao vận của vnpost, viettel, j&t, ghtk"); khung CONG_VIEC_24 (QUYTAC_NGHIEPVU_159, 160).
- Nhánh: `chuc-nang/CONG_VIEC_28-giao-van-vnpost` (tách từ `chuc-nang/CONG_VIEC_24-dat-hang-vcomm`).

## 1. Mục tiêu

Nhân viên VComm giao đơn VComm qua VNPost như qua GHN; trạng thái vận đơn VNPost tự cập nhật đơn VComm.

## 2. Phạm vi

Trong phạm vi:
- Lớp kết nối `apps/api/src/marketplace/carriers/vnpost-carrier.ts` cài đặt `CarrierAdapter`; đăng ký trong `carrier-registry.ts`; tên trong `carrierNames`.
- Tra mã tỉnh, xã riêng của VNPost theo tên địa chỉ hai cấp của đơn.
- Webhook qua đường dẫn chung API_128.
- Đọc tiền thu hộ của vận đơn (hàm `cashOnDelivery`) cho CONG_VIEC_25.

Ngoài phạm vi: đối soát COD, hạch toán phí (CONG_VIEC_25); kiểm chữ ký RSA của webhook; dịch vụ cộng thêm khác thu hộ; tính cước trước khi giao; in vận đơn; hiệu chỉnh đơn; đơn quốc tế; màn hình mới.

## 3. Yêu cầu nghiệp vụ và chức năng

- CHUC_NANG_130: Kết nối VNPost: tạo vận đơn có tiền thu hộ, hủy, tra vận đơn, tìm theo số đơn, webhook trạng thái, đọc tiền thu hộ. Thuộc YCAU_NGHIEPVU_50; mở rộng CHUC_NANG_117.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_180: VNPost dùng chung khung đơn vị vận chuyển (QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường: tài khoản MyVNPost (tên đăng nhập, mật khẩu, mã khách hàng), mã hợp đồng (không bắt buộc), mã dịch vụ chuyển phát, khóa webhook (ít nhất 24 ký tự), người gửi (tên, số điện thoại, địa chỉ chi tiết, tên tỉnh, tên xã). Thiếu một mục bắt buộc thì VNPost "chưa cấu hình", không bật được. Token đăng nhập giữ trong bộ nhớ; VNPost trả 401, 403 thì lấy token mới và gọi lại một lần.
- QUYTAC_NGHIEPVU_181: VNPost bắt buộc mã tỉnh, mã xã của VNPost (khác mã Tổng cục Thống kê), mã quận huyện là `VNPOST`. Hệ thống tải danh mục tỉnh, xã hai cấp của VNPost (giữ 24 giờ), tìm mã theo tên tỉnh, tên xã của đơn và của người gửi: so tên đầy đủ (đổi "TP.", "P.", "X." thành "Thành phố", "Phường", "Xã"), rồi tên bỏ loại, rồi tên bỏ dấu; chỉ nhận khi đúng một kết quả. Không có hoặc nhiều kết quả thì VNPost coi là từ chối, không gửi yêu cầu tạo vận đơn, đơn giữ Chờ giao.
- QUYTAC_NGHIEPVU_182: Ánh xạ trạng thái MyVNPost sang giai đoạn của khung: chờ lấy hàng 1, 2, 3, 4, 5; đã lấy hàng 6, 7, 10, 11, 12, 13, 15, 16, 17, 18, 24; đã giao 14, 21; hoàn hàng xong 19; đã hủy 9, 22, 29; còn lại (8, 20, 23, 28 và mã chưa biết) hiện cho nhân viên, đơn giữ trạng thái.
- QUYTAC_NGHIEPVU_183: Tạo vận đơn: bên gửi là chủ đơn (`type = GUI`), tạo đơn ngay (`orderCreationStatus = 1`), mã đơn của bên gửi là số đơn bán VComm; tiền thu hộ (QUYTAC_NGHIEPVU_160) gửi qua dịch vụ cộng thêm `GTG021`, thuộc tính `PROP0018`; tiền thu hộ bằng 0 thì không gửi dịch vụ cộng thêm. Mã vận đơn là số hiệu bưu gửi (`itemCode`); không có số hiệu bưu gửi thì coi là chưa rõ kết quả, nhân viên tra lại theo số đơn.
- QUYTAC_NGHIEPVU_184: Hủy vận đơn theo ID gốc (tra từ mã vận đơn). Chỉ kết quả `00` là đã hủy. Kết quả `02` (chờ xử lý) và các kết quả khác là chưa hủy: đơn VComm giữ nguyên; VNPost hủy xong thì webhook đưa đơn về Đã hủy theo QUYTAC_NGHIEPVU_159.

## 5. Vai trò và quyền

Không thêm quyền; dùng `marketplace.order.view`, `marketplace.order.manage` (CONG_VIEC_24).

## 6. Luồng nghiệp vụ

Luồng 37 (CONG_VIEC_24), bước "giao cho đơn vị vận chuyển": nhân viên chọn VNPost.

## 7. Màn hình

Không thêm màn hình. Dùng lại MAN_HINH_86 (danh sách đơn vị vận chuyển hiện thêm VNPost, bật, tắt) và MAN_HINH_88 (chọn VNPost khi giao đơn). Không thêm chuỗi dịch: tên đơn vị lấy từ `carrierNames` ở máy chủ.

## 8. Dữ liệu và API

- Database migration `0040_carrier_vnpost.sql`: đổi ràng buộc `marketplace.carriers.code` thành `ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk` (giống các phiên kết nối khác); thêm dòng `vnpost` (tắt).
- `packages/contracts`: `carrierCodes = ["ghn", "vnpost", "viettel_post", "jt", "ghtk"]`. Mã chưa có lớp kết nối trả "chưa cấu hình".
- Không thêm API; dùng lại API_123 (`PUT /marketplace/carriers/vnpost`), API_127 (giao, tra lại, hủy), API_128 (`POST /public/carriers/vnpost/webhook/{key}`).
- API VNPost dùng (môi trường thử nghiệm `https://my-uat.vnpost.vn/MYVNP_API`, môi trường thật `https://connect-my.vnpost.vn`): `POST /GetAccessToken`, `GET /getNewProvinceAll`, `GET /getNewCommuneAll`, `POST /CreateOrder`, `GET /getOrder` (type 1 theo số hiệu bưu gửi, type 2 theo mã đơn của bên gửi), `POST /orderCancel`. Header `token`.
- Biến môi trường (thêm vào `.env.example`, để trống): `VNPOST_USERNAME`, `VNPOST_PASSWORD`, `VNPOST_CUSTOMER_CODE`, `VNPOST_CONTRACT_CODE`, `VNPOST_SERVICE_CODE`, `VNPOST_WEBHOOK_KEY`, `VNPOST_SENDER_NAME`, `VNPOST_SENDER_PHONE`, `VNPOST_SENDER_ADDRESS`, `VNPOST_SENDER_PROVINCE`, `VNPOST_SENDER_WARD`, `VNPOST_BASE_URL`.
- Cho CONG_VIEC_25: `VnpostCarrier.cashOnDelivery(mã vận đơn)` trả `{ status, codAmount, codPaid, paymentStatus, fee }` từ `getOrder`; `codPaid` đúng khi trạng thái 21 "Đã trả tiền COD". Không đổi giao diện chung `CarrierAdapter`.

## 9. Điều kiện đặc biệt và điểm chưa xác minh

Viết theo tài liệu công khai "VNPost API Documentation" (`https://my-uat.vnpost.vn/static/`, đọc ngày 2026-11-11). Kiểm thử tự động dùng máy chủ MyVNPost giả lập. **Trước khi phát hành phải thử với tài khoản VNPost môi trường thử nghiệm** các điểm chưa xác minh:

1. Tên trong danh mục `getNewProvinceAll`, `getNewCommuneAll` có khớp tên trong danh mục tỉnh, xã của VComm theo cách so ở QUYTAC_NGHIEPVU_181; trường mã tỉnh của xã là `provinceCode` hay `districtCode` (tài liệu ghi `provinceCode`, ví dụ ghi `districtCode`; mã đọc cả hai).
2. Thuộc tính `PROP0019`, `PROP0020` của dịch vụ `GTG021` (đang gửi `null`); giá trị `sendType = "1"`, `vehicle = "BO"`, `deliveryRequire = "1"`, `deliveryTime = "N"`, `isBroken = "0"` lấy theo ví dụ của tài liệu.
3. `CreateOrder` trả `itemCode` ngay khi tạo; dạng kết quả `getOrder` (ví dụ là danh sách nhóm `{ results: [...] }`, mã đọc được cả đơn lẻ, danh sách); `getOrder` khi không có đơn trả gì (mã coi danh sách rỗng hoặc lỗi 400 là không có).
4. Hạn dùng của token; nội dung phản hồi VNPost chờ từ webhook (hệ thống trả `200 { result }`).
5. Webhook: VNPost chỉ gọi về đường dẫn, địa chỉ IP đã được VNPost đưa vào danh sách cho phép; người dùng gửi yêu cầu cho VNPost kèm đường dẫn `https://<tên miền>/api/v1/public/carriers/vnpost/webhook/<VNPOST_WEBHOOK_KEY>`. Khóa webhook nằm trên đường dẫn nên có thể xuất hiện trong nhật ký máy chủ trung gian (như GHN).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_200 | Thiếu biến môi trường thì chưa cấu hình, không bật được; token lấy lại khi hết hạn; tìm đúng mã tỉnh, xã của VNPost theo tên; trùng tên, không có tên bị từ chối, không tạo vận đơn | Bắt buộc | KICHBAN_KIEMTHU_340 |
| TIEUCHI_NGHIEMTHU_201 | Ánh xạ trạng thái đúng QUYTAC_NGHIEPVU_182; đọc mã vận đơn từ webhook; hủy `00`, `02`, `01` đúng QUYTAC_NGHIEPVU_184; tìm theo số đơn; đọc tiền thu hộ, đã trả COD | Bắt buộc | KICHBAN_KIEMTHU_341 |
| TIEUCHI_NGHIEMTHU_202 | Giao đơn VComm qua VNPost (giả lập): vận đơn đúng người nhận, mã địa chỉ, số đơn, khối lượng, tiền thu hộ; webhook sai khóa bị từ chối; trạng thái theo tra lại; lấy hàng ghi sổ phiếu xuất; giao thành công; nhận trùng không đổi kết quả | Bắt buộc | KICHBAN_KIEMTHU_342 |
| TIEUCHI_NGHIEMTHU_203 | Hủy đơn chờ lấy hàng hủy vận đơn; VNPost chờ xử lý hủy thì đơn giữ nguyên; VNPost hủy thì đơn hủy; hoàn hàng nhập lại kho; mất phản hồi khi tạo thì tra lại theo số đơn, không tạo trùng | Bắt buộc | KICHBAN_KIEMTHU_343 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_340 đến 343: tự động, `apps/api/test/c28-carrier-vnpost.test.ts` (máy chủ MyVNPost giả lập).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện; gọi VNPost bằng `fetch` có thời gian chờ 15 giây. Dùng lại toàn bộ `ShipmentsService` (giữ chỗ vận đơn, phiếu xuất nháp, áp trạng thái, webhook).

## 13. Thành phần không được thay đổi

Giao diện chung `CarrierAdapter`, `ShipmentsService`, `carrier-webhook.controller.ts`, kết nối GHN, mã CONG_VIEC_25.

Thay đổi ngoài lớp kết nối: một dòng kiểm thử của CONG_VIEC_24 (`c24-marketplace-orders.test.ts`, KICHBAN_KIEMTHU_310) đổi từ "danh sách đơn vị vận chuyển chỉ có GHN" thành "danh sách có GHN", vì danh sách có thêm VNPost.

## 14. Các lát và điểm xem trước

Một lát (không có giao diện mới): lớp kết nối, đăng ký, database migration, kiểm thử. Xem trước: MAN_HINH_86 hiện VNPost "chưa cấu hình" khi thiếu biến môi trường.

## 15. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- `07`: QUYTAC_NGHIEPVU_180 đến 184 (nội dung mục 4).
- `10`: CHUC_NANG_130 (mục 3), thuộc MODULE_09, YCAU_NGHIEPVU_50.
- `11`: TIEUCHI_NGHIEMTHU_200 đến 203 (mục 10).
- `16`: database migration 0040: ràng buộc `marketplace.carriers.code` thêm `vnpost`, `viettel_post`, `jt`, `ghtk`; dòng `vnpost`.
- `17`: API_123, API_128 nhận mã `vnpost`; danh sách API VNPost đã dùng (mục 8).
- `21`: KICHBAN_KIEMTHU_340 đến 343 (mục 11).
- `22`: thông tin kết nối VNPost chỉ ở biến môi trường; không ghi mật khẩu, token vào nhật ký; webhook xác thực bằng khóa trên đường dẫn, so sánh thời gian cố định, trạng thái luôn tra lại; chưa kiểm chữ ký RSA (người dùng quyết định ngày 2026-11-11).
- `25`: kết quả kiểm thử (mục 16).
- `27`: YCAU_NGHIEPVU_50 → CHUC_NANG_130 → QUYTAC_NGHIEPVU_180 đến 184 → TIEUCHI_NGHIEMTHU_200 đến 203 → KICHBAN_KIEMTHU_340 đến 343 → `vnpost-carrier.ts`, `c28-carrier-vnpost.test.ts`.
- `02`: quyết định của người dùng ngày 2026-11-11: tra mã địa chỉ VNPost theo tên (không thêm bảng đối chiếu); người gửi ở biến môi trường; không kiểm chữ ký RSA webhook; mã 22 là đã hủy, mã 28 hiện cho nhân viên.

## 16. Kết quả kiểm thử và đối chiếu định nghĩa hoàn thành

Chạy ngày 2026-11-11 trên PostgreSQL, Redis cục bộ:
- `c28-carrier-vnpost.test.ts`: 4/4 đạt (KICHBAN_KIEMTHU_340 đến 343).
- `c24-marketplace-orders.test.ts`: 12/12 đạt (sau khi đổi một dòng như mục 13).
- Toàn bộ `pnpm --filter api test`: 328/328 đạt, 41 tệp.
- `pnpm --filter api typecheck`: đạt.

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_180 đến 184 có kiểm thử tự động; không thêm quyền |
| Đúng giao diện | Không áp dụng: không có màn hình mới; MAN_HINH_86, 88 lấy danh sách đơn vị vận chuyển từ máy chủ |
| Đã xử lý lỗi | Đạt: VNPost từ chối, không trả lời, không có số hiệu bưu gửi, hủy chờ xử lý, không tìm được mã địa chỉ đều có xử lý riêng |
| Đã kiểm thử, đạt cổng kiểm thử | Đạt với máy chủ giả lập; chưa thử với VNPost thật (mục 9) |
| Không phá vỡ chức năng cũ | Đạt: kiểm thử hồi quy 328/328 |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt: TIEUCHI_NGHIEMTHU_200 đến 203 |
| Đạt cổng bảo mật | Đạt: không thêm thư viện; không có khóa bí mật trong mã, `.env.example` để trống; mật khẩu, token VNPost không ghi vào nhật ký, thông báo lỗi; webhook so khóa thời gian cố định, trạng thái luôn tra lại. Chưa chạy gitleaks (máy không có công cụ; CI chạy khi mở pull request) |
| Đã tự rà soát mã, dọn dẹp | Đạt: tệp tạm ở thư mục nháp của phiên, không nằm trong dự án |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Chưa: theo phân công, phiên chính cập nhật các tài liệu dùng chung khi hợp nhất (mục 15) |
