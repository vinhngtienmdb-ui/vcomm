# CONG_VIEC_29: Kết nối Viettel Post vào khung đơn vị vận chuyển (MODULE_09)

- Mô tả: Thêm Viettel Post (mã `viettel_post`) vào khung đơn vị vận chuyển chung của CONG_VIEC_24: tạo vận đơn có tiền thu hộ, hủy vận đơn, nhận trạng thái qua webhook.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Mức quy mô: Vừa (chức năng mới trong MODULE_09, thêm giá trị mã đơn vị vận chuyển, không đổi kiến trúc).
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11. Đã nghiệm thu 2026-11-11, chờ phát hành (trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của Viettel Post, mục 4). Sau nghiệm thu, người dùng quyết định ngày 2026-11-11 tự ghi đã thu COD khi Viettel Post báo giao thành công (THAY_DOI_20; làm trên nhánh `gop/giao-van`).
- Nguồn: yêu cầu của người dùng ngày 2026-11-11 (phiên CONG_VIEC_25 mở phiên con); khung đơn vị vận chuyển của CONG_VIEC_24 (QUYTAC_NGHIEPVU_159, 160; CHUC_NANG_117).
- Nhánh: `chuc-nang/CONG_VIEC_29-giao-van-viettel-post`, tách từ `chuc-nang/CONG_VIEC_24-dat-hang-vcomm`.

## 1. Mục tiêu

Nhân viên VComm giao đơn VComm cho Viettel Post như giao cho GHN; trạng thái vận đơn cập nhật tự động.

## 2. Phạm vi

Trong phạm vi:
- Lớp kết nối Viettel Post cài đặt giao diện chung `CarrierAdapter`; thông tin kết nối ở biến môi trường.
- Webhook trạng thái qua đường dẫn chung `/public/carriers/viettel_post/webhook/{key}`.
- Bổ sung tùy chọn vào khung chung cho đơn vị vận chuyển không có API tra vận đơn (không đổi hành vi GHN).

Ngoài phạm vi: đối soát số tiền thu hộ Viettel Post chuyển trả (chỉ ghi đã thu theo trạng thái giao thành công, THAY_DOI_20); tính cước trước khi giao; in nhãn; đổi thông tin đơn sau khi tạo; duyệt hoàn, phát tiếp (UpdateOrder loại 2, 3); quản lý kho hàng trên Viettel Post.

## 3. Tìm giải pháp có sẵn

- Mã dự án: dùng lại toàn bộ khung CONG_VIEC_24 (`carrier.ts`, `carrier-registry.ts`, `shipments.service.ts`, webhook, màn hình MAN_HINH_86, 88).
- Thư viện: không cần; gọi API bằng `fetch`, so sánh khóa bằng `node:crypto`. Không thêm thư viện.

## 4. Tài liệu API của Viettel Post và điểm chưa xác minh

Nguồn: trang tài liệu công khai `https://partner2.viettelpost.vn` (đọc ngày 2026-11-11). Môi trường thử nghiệm `https://partnerdev.viettelpost.vn`, môi trường thật `https://partner.viettelpost.vn`; xác thực bằng header `Token`.

| API | Dùng cho |
|---|---|
| `POST /v2/order/createOrderNlp` | Tạo vận đơn theo địa chỉ chi tiết dạng văn bản (không cần mã địa chỉ riêng của Viettel Post) |
| `POST /v2/order/UpdateOrder` (`TYPE` 4) | Hủy vận đơn khi Viettel Post chưa nhận hàng (trạng thái nhỏ hơn 200) |
| Webhook hành trình | Viettel Post gửi `{ DATA: { ORDER_NUMBER, ORDER_REFERENCE, ORDER_STATUS, MONEY_COLLECTION, MONEY_TOTAL, ... }, TOKEN }` |

Tài liệu công khai không có API tra trạng thái vận đơn và không có API tìm vận đơn theo mã đơn của bên gửi; chức năng "Đồng bộ hành trình" trên trang đối tác chỉ gửi lại webhook.

Chưa xác minh (phải thử với tài khoản môi trường thử nghiệm của Viettel Post trước khi phát hành):
- Viettel Post nhận diện đúng địa chỉ hai cấp dạng văn bản "địa chỉ chi tiết, xã, tỉnh" (tài liệu nêu có hỗ trợ địa chỉ mới hai cấp).
- Mã dịch vụ (`ORDER_SERVICE`) áp dụng cho hợp đồng của VComm.
- Định dạng thật của webhook: `ORDER_STATUS` là số, `ORDER_REFERENCE` là số đơn VComm đã gửi trong `ORDER_NUMBER` khi tạo, `TOKEN` là khóa khai báo trên trang cấu hình webhook.
- Mã lỗi 206 (mã đơn đã tồn tại) khi tạo trùng với `CHECK_UNIQUE`; phản hồi lỗi có `error: true`.
- Ý nghĩa các trạng thái 201, 503 trong thực tế vận hành.

## 5. Yêu cầu chức năng

- CHUC_NANG_131: Kết nối Viettel Post: tạo vận đơn có tiền thu hộ, hủy vận đơn, nhận trạng thái qua webhook đã xác thực.

## 6. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_185: Viettel Post không có API tra vận đơn: trạng thái vận đơn lấy từ nội dung webhook chỉ khi đúng cả khóa trên đường dẫn và `TOKEN` trong nội dung (so sánh an toàn, cùng giá trị `VIETTEL_POST_WEBHOOK_KEY`); sai một trong hai thì từ chối như sai khóa. Nút "Tra lại vận đơn" với Viettel Post báo không hỗ trợ. Đây là ngoại lệ của QUYTAC_NGHIEPVU_160 (trạng thái chỉ đổi theo kết quả tra lại), người dùng đồng ý ngày 2026-11-11. Webhook Viettel Post không có ngày thu tiền thu hộ, nên khi webhook đã xác thực báo giao thành công (giai đoạn `delivered`), đơn thu tiền khi nhận hàng (COD) có tiền thu hộ lớn hơn 0 và chưa ghi đã thu thì tự ghi đã thu bằng tiền thu hộ của đơn, ngày thu là thời điểm hệ thống nhận webhook; đơn không COD hoặc đã ghi đã thu thì không ghi; webhook lặp không ghi lần hai (theo QUYTAC_NGHIEPVU_167 của CONG_VIEC_25; THAY_DOI_20, người dùng quyết định ngày 2026-11-11).
- QUYTAC_NGHIEPVU_186: Ánh xạ trạng thái Viettel Post sang giai đoạn của khung:

  | Giai đoạn | Mã trạng thái |
  |---|---|
  | Chờ lấy hàng | 100, 102, 103, 104 |
  | Đã lấy hàng (ghi sổ phiếu xuất) | 105, 200, 202, 300, 400, 500, 502, 505, 506, 507, 508, 509, 515, 550 |
  | Giao thành công | 501 |
  | Hoàn hàng xong | 504 |
  | Đơn vị vận chuyển hủy | 101, 107, 201 |
  | Cần chú ý (chỉ ghi lịch sử, không đổi đơn) | 503 và mọi mã khác |

- QUYTAC_NGHIEPVU_187: Tạo vận đơn Viettel Post: mã đơn của bên gửi là số đơn VComm, có kiểm tra trùng; địa chỉ người nhận gửi dạng văn bản "địa chỉ chi tiết, xã, tỉnh" theo danh mục hai cấp; người gửi (tên, số điện thoại, địa chỉ lấy hàng) và mã dịch vụ lấy từ biến môi trường; thu hộ tiền hàng không thu cước (`ORDER_PAYMENT` 3) với tiền thu hộ bằng tiền thu hộ của đơn (QUYTAC_NGHIEPVU_160), tiền thu hộ bằng 0 thì không thu hộ (`ORDER_PAYMENT` 1); phí vận đơn là `MONEY_TOTAL` Viettel Post trả về; cho xem hàng, không cho thử.
- QUYTAC_NGHIEPVU_188: Tạo vận đơn Viettel Post không rõ kết quả (không trả lời, lỗi máy chủ, báo mã đơn đã tồn tại): giữ chỗ vận đơn, không bỏ chỗ giữ khi tra lại; khi webhook mang mã vận đơn chưa có trong hệ thống và `ORDER_REFERENCE` trùng số đơn VComm của vận đơn đang chờ xác nhận thì ghi nhận vận đơn (mã, phí) rồi áp trạng thái.
- QUYTAC_NGHIEPVU_189: Thông tin kết nối Viettel Post chỉ ở biến môi trường; token là token dài hạn (hạn 1 năm, người dùng thay khi hết hạn); thiếu biến hoặc khóa webhook ngắn hơn 24 ký tự thì Viettel Post ở trạng thái chưa cấu hình, không bật được. Hủy vận đơn bằng UpdateOrder loại 4; Viettel Post từ chối (đã nhận hàng) thì không hủy đơn.

## 7. Vai trò và quyền

Không đổi: dùng `marketplace.order.view`, `marketplace.order.manage` của CONG_VIEC_24.

## 8. Màn hình

Dùng lại MAN_HINH_86 (danh sách đơn vị vận chuyển hiện thêm Viettel Post, trạng thái cấu hình) và MAN_HINH_88 (chọn Viettel Post khi giao, nút tra lại báo không hỗ trợ). Không sửa mã giao diện.

## 9. Dữ liệu và API

- Database migration `0041_carrier_viettel_post.sql`: mở rộng ràng buộc mã đơn vị vận chuyển (`ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk`, giống hệt các công việc kết nối VNPost, J&T, GHTK), thêm dòng `viettel_post` (tắt).
- `packages/contracts`: `carrierCodes = ["ghn", "vnpost", "viettel_post", "jt", "ghtk"]`. Đơn vị chưa có lớp kết nối hiện "Chưa cấu hình".
- API không đổi: API_123 (`PUT /marketplace/carriers/viettel_post`), API_127 (giao, tra lại, hủy), API_128 (`POST /public/carriers/viettel_post/webhook/{key}`).
- Khung chung (bổ sung tùy chọn, GHN không đổi): `CarrierAdapter.webhookReport` (đọc trạng thái từ webhook đã xác thực), `CarrierFailure` loại `unsupported` (lỗi `carrierLookupUnsupported`).
- Tiền thu hộ cho CONG_VIEC_25: Viettel Post không có API chi tiết đơn; tiền thu hộ (`MONEY_COLLECTION`, `MONEY_COLLECTION_ORIGIN` có giá trị từ trạng thái 200) chỉ có trong webhook. Nội dung webhook được lưu nguyên trong `marketplace.carrier_webhook_events.payload`; `WebhookReport.codAmount` trả tiền thu hộ của từng webhook để dùng khi làm đối soát. Ghi đã thu COD (THAY_DOI_20): `shipments.service.ts` đặt `codCollectedAt` bằng thời điểm nhận webhook (đồng hồ `CLOCK`) khi trạng thái trong webhook thuộc giai đoạn `delivered`; phần ghi đã thu dùng chung với GHN (ghi một lần, chỉ đơn COD).
- Biến môi trường (`.env.example`): `VIETTEL_POST_TOKEN`, `VIETTEL_POST_SERVICE_CODE`, `VIETTEL_POST_WEBHOOK_KEY`, `VIETTEL_POST_SENDER_NAME`, `VIETTEL_POST_SENDER_PHONE`, `VIETTEL_POST_SENDER_ADDRESS`, `VIETTEL_POST_BASE_URL` (để trống là môi trường thử nghiệm).
- Chuỗi giao diện mới: `errors.carrierLookupUnsupported` (vi, en).

## 10. Cấu hình trên Viettel Post (người dùng làm khi có tài khoản)

1. Lấy token dài hạn: API Login rồi `ownerconnect`, hoặc tạo token trên trang viettelpost.vn (mục cấu hình tài khoản) rồi `LoginVTP`.
2. Cấu hình webhook trên trang đối tác (mục Cấu hình tài khoản): đường dẫn `https://<máy chủ API>/api/v1/public/carriers/viettel_post/webhook/<VIETTEL_POST_WEBHOOK_KEY>`, Token = `VIETTEL_POST_WEBHOOK_KEY`. Webhook môi trường thật cần Viettel Post duyệt (gửi danh sách kiểm tra theo hướng dẫn của họ).
3. Viettel Post yêu cầu API nhận webhook trả lời dưới 1 giây.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_204 | Viettel Post chỉ bật được khi đủ biến môi trường; giao đơn tạo vận đơn đúng thông tin (địa chỉ hai cấp dạng văn bản, người gửi, thu hộ tiền hàng không thu cước, kiểm tra trùng); bị từ chối thì đơn giữ Chờ giao, không còn phiếu xuất nháp | Bắt buộc | KICHBAN_KIEMTHU_344 |
| TIEUCHI_NGHIEMTHU_205 | Webhook sai khóa đường dẫn, sai hoặc thiếu TOKEN bị từ chối; nhận hàng ghi sổ phiếu xuất; nhận trùng, đến muộn không đổi kết quả; giao thành công; tra lại báo không hỗ trợ; nội dung webhook (tiền thu hộ) được lưu; giao thành công đơn COD tự ghi đã thu một lần, ngày thu là thời điểm nhận webhook; đơn không COD không ghi đã thu (THAY_DOI_20) | Bắt buộc | KICHBAN_KIEMTHU_345 |
| TIEUCHI_NGHIEMTHU_206 | Hủy đơn chờ lấy hàng hủy vận đơn loại 4; Viettel Post hủy thì đơn hủy; đã nhận hàng thì không hủy được; hoàn hàng nhập lại kho, đơn hủy; 503 và mã lạ chỉ ghi lịch sử | Bắt buộc | KICHBAN_KIEMTHU_346 |
| TIEUCHI_NGHIEMTHU_207 | Tạo vận đơn không rõ kết quả hoặc báo trùng số đơn: giữ chỗ, không giao lại, tra lại không bỏ chỗ giữ; webhook mang đúng số đơn VComm thì ghi nhận vận đơn và áp trạng thái | Bắt buộc | KICHBAN_KIEMTHU_347 |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_344 đến 347: tự động, `apps/api/test/c29-carrier-viettel-post.test.ts`, máy chủ Viettel Post giả lập theo tài liệu công khai, không gọi máy chủ thật.

## 13. Thành phần không được thay đổi

Hành vi GHN; luồng đơn VComm của CONG_VIEC_24; mã thanh toán CONG_VIEC_25; màn hình.

## 14. Kết quả kiểm thử

| Lần | Kết quả |
|---|---|
| 2026-11-11 | `c29-carrier-viettel-post` 4/4 đạt; `c24-marketplace-orders` 12/12 đạt (đã sửa một câu kiểm tra danh sách đơn vị vận chuyển, người dùng đồng ý ngày 2026-11-11) |
| 2026-11-11 (hồi quy lần 1) | Toàn bộ API 327/328: KICHBAN_KIEMTHU_345 thất bại do lượt chạy bắt đầu trước khi sửa lỗi lưu `TOKEN` vào nhật ký webhook (lỗi tự rà soát phát hiện, đã sửa) |
| 2026-11-11 (hồi quy lần 2) | Toàn bộ API 328/328 đạt (41 tệp); kiểm tra kiểu đạt |
| 2026-11-11 (THAY_DOI_20, nhánh `gop/giao-van`) | KICHBAN_KIEMTHU_345 bổ sung ghi đã thu COD; toàn bộ API 349/349 đạt (56 tệp, sau khi gộp CONG_VIEC_28 đến 31); lint, kiểm tra kiểu đạt |

Sửa kiểm thử cũ: KICHBAN_KIEMTHU_310 so khớp nguyên danh sách đơn vị vận chuyển chỉ có GHN; database migration 0041 thêm Viettel Post nên đổi thành kiểm tra danh sách có dòng GHN đúng thông tin (`toContainEqual`).

## 15. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_185 đến 189 có kiểm thử tự động (KICHBAN_KIEMTHU_344 đến 347); quyền không đổi |
| Đúng giao diện | Không áp dụng: không sửa mã giao diện; MAN_HINH_86, 88 hiển thị danh sách đơn vị vận chuyển từ API |
| Đã xử lý lỗi | Đạt: từ chối, không trả lời, trùng số đơn, không hỗ trợ tra lại đều có thông báo riêng; không rõ kết quả thì giữ chỗ chờ webhook |
| Đã kiểm thử, đạt cổng kiểm thử | Đạt: 328/328 trên máy phát triển. CI trên GitHub không chạy được do tài khoản GitHub lỗi thanh toán (nhánh base cũng vậy) |
| Không phá vỡ chức năng cũ | Đạt: GHN và c24 đạt; phần thêm vào khung chung là tùy chọn |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt: TIEUCHI_NGHIEMTHU_204 đến 207 (trên máy chủ giả lập; thử với môi trường thử nghiệm của Viettel Post trước khi phát hành) |
| Đạt cổng bảo mật | Đạt: không thêm thư viện; không có khóa bí mật trong mã, commit (quét thủ công; gitleaks trong CI không chạy do lỗi thanh toán); webhook xác thực hai lớp, so sánh an toàn; khóa webhook không lưu vào cơ sở dữ liệu |
| Đã tự rà soát mã, dọn dẹp | Đạt: rà soát phát hiện và sửa lỗi lưu `TOKEN`; tệp tạm trong `tam_thoi/CONG_VIEC_29/` (Git bỏ qua). ESLint chưa chạy được vì dự án chưa có tệp cấu hình ESLint |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Chờ phiên chính: các dòng cần thêm ghi ở mục 16 (công việc không được sửa tài liệu dùng chung) |

## 16. Dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- Tài liệu `07`: QUYTAC_NGHIEPVU_185 đến 189 (mục 6); ghi chú ở QUYTAC_NGHIEPVU_160: "ngoại lệ cho đơn vị vận chuyển không có API tra vận đơn: QUYTAC_NGHIEPVU_185".
- Tài liệu `10`: CHUC_NANG_131 – Kết nối Viettel Post (MODULE_09; CONG_VIEC_29; dùng API_123, 127, 128; MAN_HINH_86, 88).
- Tài liệu `11`: TIEUCHI_NGHIEMTHU_204 đến 207 (mục 11).
- Tài liệu `16`: database migration 0041 – ràng buộc `marketplace.carriers.code` gồm `ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk`; dòng `viettel_post`.
- Tài liệu `17`: API_123 nhận mã `viettel_post`; API_128 với Viettel Post: xác thực thêm `TOKEN` trong nội dung, trạng thái lấy từ nội dung (QUYTAC_NGHIEPVU_185); API_127 "tra lại vận đơn" với Viettel Post trả lỗi `carrierLookupUnsupported`.
- Tài liệu `21`: KICHBAN_KIEMTHU_344 đến 347 (mục 12).
- Tài liệu `22`: webhook Viettel Post xác thực hai lớp (khóa đường dẫn, TOKEN trong nội dung, so sánh an toàn, đếm lần sai theo địa chỉ IP); vì tin nội dung webhook nên lộ khóa cho phép giả trạng thái đơn — giữ khóa bí mật, thay khi nghi lộ; token Viettel Post chỉ ở biến môi trường, không ghi log.
- Tài liệu `24`: phiếu thay đổi cho ngoại lệ QUYTAC_NGHIEPVU_160 (QUYTAC_NGHIEPVU_185), người dùng đồng ý trong phiên ngày 2026-11-11; THAY_DOI_20 (tự ghi đã thu COD Viettel Post khi giao thành công, ngày thu là thời điểm nhận webhook) do phiên cha ghi.
- Tài liệu `25`: kết quả kiểm thử mục 14, 15.
- Tài liệu `27`: CHUC_NANG_131 → QUYTAC_NGHIEPVU_185 đến 189 → TIEUCHI_NGHIEMTHU_204 đến 207 → KICHBAN_KIEMTHU_344 đến 347 → `viettel-post-carrier.ts`, `c29-carrier-viettel-post.test.ts`.

## 17. Giới hạn đã biết

- Viết theo tài liệu công khai, kiểm thử bằng máy chủ giả lập; trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của Viettel Post (mục 4).
- Không tra lại được trạng thái: webhook bị mất thì đơn đứng ở trạng thái cũ; nhân viên dùng chức năng "Đồng bộ hành trình" trên trang đối tác Viettel Post để gửi lại webhook.
- Trạng thái vận chuyển hiện là trạng thái nhận gần nhất; webhook đến trễ có thể ghi đè trạng thái hiển thị (không đổi trạng thái đơn), như GHN.
- Ngày thu COD là thời điểm nhận webhook giao thành công, không phải ngày Viettel Post thực thu hoặc chuyển trả tiền; số tiền ghi đã thu là tiền thu hộ của đơn, không đối chiếu với `MONEY_COLLECTION` trong webhook (THAY_DOI_20).
- Token dài hạn hết hạn sau 1 năm: tạo vận đơn bị từ chối cho đến khi thay token.
