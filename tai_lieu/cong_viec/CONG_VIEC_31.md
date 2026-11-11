# CONG_VIEC_31: Kết nối đơn vị vận chuyển Giao Hàng Tiết Kiệm (GHTK) (MODULE_09)

- Mô tả: Thêm GHTK (mã `ghtk`) vào khung đơn vị vận chuyển chung của CONG_VIEC_24: tạo vận đơn có tiền thu hộ, hủy, tra chi tiết, tìm theo số đơn, webhook trạng thái, ánh xạ trạng thái sang giai đoạn của khung.
- Mức: Vừa (lớp kết nối mới trong module đã có; không đổi API, màn hình; thêm một giá trị mã đơn vị vận chuyển).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 trong phiên CONG_VIEC_31. Chờ nghiệm thu.
- Nguồn: yêu cầu của người dùng ngày 2026-11-11 (phiên chính CONG_VIEC_25 mở phiên con); CONG_VIEC_24 (khung đơn vị vận chuyển, QUYTAC_NGHIEPVU_160, 162).
- Nhánh: `chuc-nang/CONG_VIEC_31-giao-van-ghtk`, tách từ `chuc-nang/CONG_VIEC_24-dat-hang-vcomm`.

## 1. Mục tiêu

Nhân viên VComm giao đơn VComm qua GHTK như GHN; trạng thái vận đơn GHTK cập nhật đơn VComm theo đúng quy tắc của khung.

## 2. Phạm vi

Trong phạm vi:
- Lớp kết nối `apps/api/src/marketplace/carriers/ghtk-carrier.ts` cài đặt `CarrierAdapter`; đăng ký trong `carrier-registry.ts`; tên trong `carrierNames`.
- Thông tin kết nối, địa chỉ lấy hàng ở biến môi trường (`.env.example`).
- Webhook qua đường dẫn chung API_128 `/public/carriers/ghtk/webhook/{khóa}`.
- Hàm `shipmentDetail()` của lớp kết nối GHTK trả tiền thu hộ của vận đơn và tiền thu hộ đã thu để CONG_VIEC_25 dùng cho đối soát COD.
- Mã `vnpost`, `viettel_post`, `jt` được thêm vào danh sách mã (dòng dùng chung giữa các phiên); chưa có lớp kết nối thì trả về chưa cấu hình.

Ngoài phạm vi: logic đối soát COD, hạch toán phí (CONG_VIEC_25); tính phí trước khi giao (API phí của GHTK); giao một phần, trả một phần (tag 17, 18 của GHTK); mã địa chỉ lấy hàng theo từng kho; đơn vị vận chuyển khác.

## 3. Yêu cầu nghiệp vụ và chức năng

- CHUC_NANG_133: Kết nối GHTK vào khung đơn vị vận chuyển: tạo vận đơn có tiền thu hộ theo địa chỉ hai cấp, hủy, tra chi tiết, tìm theo số đơn, webhook, ánh xạ trạng thái. Thuộc CHUC_NANG_117.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_195: Kết nối GHTK (theo QUYTAC_NGHIEPVU_160):
  - Thông tin kết nối: `GHTK_API_TOKEN`, `GHTK_CLIENT_SOURCE` (header `Token`, `X-Client-Source`), `GHTK_WEBHOOK_KEY` (ít nhất 24 ký tự), `GHTK_BASE_URL` (để trống là môi trường thử nghiệm `https://services-staging.ghtklab.com`; môi trường thật `https://services.giaohangtietkiem.vn`). Địa chỉ lấy hàng: `GHTK_PICK_NAME`, `GHTK_PICK_TEL`, `GHTK_PICK_ADDRESS`, `GHTK_PICK_PROVINCE`, `GHTK_PICK_WARD` bắt buộc; `GHTK_PICK_ADDRESS_ID` không bắt buộc, có thì GHTK ưu tiên. Thiếu biến bắt buộc hoặc khóa ngắn: GHTK chưa cấu hình.
  - Tạo vận đơn: mã đơn của bên gửi `order.id` là số đơn VComm; người nhận chỉ trả tiền thu hộ (`is_freeship = 1`, `pick_money` = tiền thu hộ của khung, đã gồm phí giao); giá trị khai báo `value` = tổng tiền hàng (quyết định của người dùng 2026-11-11); địa chỉ hai cấp: gửi tên tỉnh, tên xã, địa chỉ đầy đủ, `hamlet` = "Khác", không gửi quận, huyện (quyết định của người dùng 2026-11-11); khối lượng tính bằng kg; phí lấy từ `order.fee`.
  - Ánh xạ trạng thái GHTK sang giai đoạn của khung: chờ lấy hàng 1, 2, 8, 12, 123, 128; đã lấy hàng 3, 4, 9, 10, 20, 45, 49, 410; đã giao 5, 6; hoàn hàng 11, 21; đã hủy -1; cần chú ý 7, 13, 127 và mọi mã chưa biết. Mã do người lấy, giao hàng báo (123, 45) chưa phải trạng thái chính thức nên không ghi sổ phiếu xuất, không chuyển Đã giao. Mã chưa biết không coi là đã lấy hàng.
  - Tiền thu hộ đã thu: GHTK không có trường riêng; ghi bằng `pick_money` khi trạng thái là 5 hoặc 6, ngược lại để trống.
  - Hủy chỉ được khi GHTK ở trạng thái 1, 2, 12; GHTK từ chối thì khung báo không hủy được.
  - Sai token (GHTK trả 403 không nội dung), lỗi máy chủ, hết thời gian chờ: coi là không trả lời (khung giữ chỗ vận đơn, nhân viên tra lại theo số đơn).

## 5. Vai trò và quyền

Không đổi so với CONG_VIEC_24.

## 6. Luồng nghiệp vụ

Luồng 37 của CONG_VIEC_24, nhân viên chọn đơn vị GHTK khi giao.

## 7. Màn hình

Không thêm màn hình. MAN_HINH_86 (cài đặt bán hàng) tự hiện GHTK trong danh sách đơn vị vận chuyển; MAN_HINH_88 (chi tiết đơn VComm) chọn được GHTK khi đã bật.

## 8. Dữ liệu và API

- Database migration `database/migrations/0043_carrier_ghtk.sql`: ràng buộc mã `marketplace.carriers` nhận `ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk`; thêm dòng `ghtk` (tắt).
- `packages/contracts`: `carrierCodes = ["ghn", "vnpost", "viettel_post", "jt", "ghtk"]`.
- Không thêm API. Dùng lại API_123 (`PUT /marketplace/carriers/ghtk`), API_127 (giao, tra lại vận đơn), API_128 (webhook).
- API GHTK được gọi:

| Việc | API GHTK |
|---|---|
| Tạo vận đơn | `POST /services/shipment/order` |
| Chi tiết theo mã vận đơn hoặc số đơn | `GET /services/shipment/v2/{mã}` |
| Hủy | `POST /services/shipment/cancel/{mã vận đơn}` |
| Webhook (GHTK gọi VComm) | `POST` dạng form: `label_id`, `partner_id`, `status_id`, `action_time`, `reason_code`, `reason`, `weight`, `fee`, `return_part_package` |

## 9. Điều kiện đặc biệt

Viết theo tài liệu công khai của GHTK (api.ghtk.vn, truy cập 2026-11-11). Các điểm chưa xác minh, phải thử với tài khoản GHTK môi trường thử nghiệm trước khi phát hành:

1. Quận, huyện: bản tiếng Anh ghi `district` bắt buộc, bản tiếng Việt ghi không bắt buộc; tài liệu chưa nhắc địa chỉ hai cấp sau 01/07/2025. GHTK nhận tên địa chỉ, không bắt buộc mã địa chỉ riêng. Nếu GHTK từ chối khi thiếu quận, huyện: dừng, báo người dùng chọn phương án.
2. Có `pick_address_id` thì có bỏ được các trường `pick_*` không (hiện gửi cả hai).
3. Tra theo số đơn bằng `v2/{số đơn}` (tài liệu ghi nhận cả hai loại mã) hay phải dùng tiền tố `partner_id:` như API hủy.
4. GHTK không ký webhook; tham số `hash` trên đường dẫn do bên nhận tự đặt. VComm dùng khóa trên đường dẫn như GHN, trạng thái luôn tra lại.
5. Lấy `X-Client-Source` ở đâu trên trang khách hàng GHTK (tài liệu chỉ ghi "mã shop hoặc mã đối tác").
6. Trường `pick_money` trong chi tiết sau khi giao một phần (không dùng giao một phần nên không áp dụng hiện tại).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_212 | Lớp kết nối GHTK (giả lập): cấu hình đúng từ biến môi trường; tạo vận đơn đúng thông tin (tiền thu hộ, giá trị khai báo, địa chỉ hai cấp, địa chỉ lấy hàng); từ chối, sai token, không trả lời phân loại đúng; chi tiết có tiền thu hộ; tìm theo số đơn; hủy; ánh xạ trạng thái đúng QUYTAC_NGHIEPVU_195 | Bắt buộc | KICHBAN_KIEMTHU_352 |
| TIEUCHI_NGHIEMTHU_213 | Giao đơn VComm qua GHTK (giả lập): webhook dạng form sai khóa bị từ chối; trạng thái tra lại từ GHTK; mã người lấy, giao hàng báo không đổi đơn; lấy hàng ghi sổ phiếu xuất; giao thành công; nhận trùng không đổi kết quả | Bắt buộc | KICHBAN_KIEMTHU_353 |
| TIEUCHI_NGHIEMTHU_214 | Hủy đơn chờ lấy hàng hủy vận đơn GHTK; GHTK hủy thì đơn hủy; hoàn hàng nhập lại kho, đơn hủy; mất phản hồi khi tạo thì tra lại theo số đơn rồi ghi nhận | Bắt buộc | KICHBAN_KIEMTHU_354 |

TIEUCHI_NGHIEMTHU_215, KICHBAN_KIEMTHU_355 chưa dùng (dự phòng cho lần thử với tài khoản GHTK môi trường thử nghiệm).

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_352 đến 354: tự động, `apps/api/test/c31-carrier-ghtk.test.ts` (máy chủ GHTK giả lập theo tài liệu công khai).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện; gọi GHTK bằng `fetch` có thời gian chờ 15 giây. Dùng lại toàn bộ khung `ShipmentsService`, `CarrierAdapter`, `CarrierFailure`.

## 13. Thành phần không được thay đổi

`ShipmentsService`, giao diện `CarrierAdapter`, kết nối GHN, API, màn hình; mã CONG_VIEC_25.

## 14. Các lát và điểm xem trước

- L1 (một lát): lớp kết nối, đăng ký, database migration, kiểm thử. Điểm xem trước: kết quả kiểm thử tự động (không có giao diện mới).

## 15. Kết quả kiểm thử

| Lần | Ngày | Phạm vi | Kết quả |
|---|---|---|---|
| 1 | 2026-11-11 | `c31-carrier-ghtk.test.ts` | 3/3 đạt (KICHBAN_KIEMTHU_352 đến 354) |
| 1 | 2026-11-11 | `c24-marketplace-orders.test.ts` | 12/12 đạt (sửa kỳ vọng danh sách đơn vị vận chuyển có thêm GHTK) |
| 1 | 2026-11-11 | Kiểm thử hồi quy `pnpm --filter api test` | 327/327 đạt (41 tệp) |
| 1 | 2026-11-11 | Kiểm tra kiểu `api`, `web-crm` | Đạt |

Kiểm tra kiểm thử bắt lỗi: chuyển mã 123 sang "đã lấy hàng" thì KICHBAN_KIEMTHU_352, 353 thất bại (đã khôi phục).

## 16. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_195 có kiểm thử tự động; phân quyền dùng lại của CONG_VIEC_24 |
| Đúng giao diện | Không áp dụng: không đổi giao diện; danh sách đơn vị vận chuyển tự hiện GHTK |
| Đã xử lý lỗi | Đạt: từ chối, sai token, không trả lời, mã trạng thái chưa biết đều có xử lý |
| Đã kiểm thử, đạt cổng kiểm thử | Đạt: mục 15; toàn bộ 327/327; không có lỗi Nghiêm trọng, Cao. CI trên GitHub chưa chạy do tài khoản lỗi thanh toán Actions |
| Không phá vỡ chức năng cũ | Đạt: GHN không đổi; kiểm thử C24 đạt |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt (giả lập): TIEUCHI_NGHIEMTHU_212 đến 214 |
| Đạt cổng bảo mật | Đạt: không thêm thư viện; token, khóa ở biến môi trường, `.env.example` để trống; khóa webhook so sánh an toàn thời gian; trạng thái luôn tra lại từ GHTK; quét khóa bí mật trên commit không có phát hiện |
| Đã tự rà soát mã, dọn dẹp | Đạt |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Chờ phiên chính: các dòng cần thêm ở mục 17 |

## 17. Các dòng cần thêm vào tài liệu dùng chung (phiên chính cập nhật khi hợp nhất)

- Tài liệu `07`: QUYTAC_NGHIEPVU_195 (nội dung mục 4).
- Tài liệu `10`: CHUC_NANG_133 (mục 3), thuộc MODULE_09, nguồn CONG_VIEC_31.
- Tài liệu `11`: TIEUCHI_NGHIEMTHU_212 đến 214 (mục 10).
- Tài liệu `16`: `marketplace.carriers.code` nhận thêm `vnpost`, `viettel_post`, `jt`, `ghtk` (database migration 0043); dòng `ghtk`.
- Tài liệu `17`: API_123 `PUT /marketplace/carriers/{code}` nhận mã `ghtk`; API_128 nhận webhook GHTK dạng form (`label_id`).
- Tài liệu `21`: KICHBAN_KIEMTHU_352 đến 354 (mục 11).
- Tài liệu `22`: biến môi trường `GHTK_API_TOKEN`, `GHTK_CLIENT_SOURCE`, `GHTK_WEBHOOK_KEY` là khóa bí mật; webhook GHTK xác thực bằng khóa trên đường dẫn (GHTK không ký), khóa có thể xuất hiện trong nhật ký máy chủ trung gian.
- Tài liệu `25`: kết quả mục 15.
- Tài liệu `27`: CHUC_NANG_133 → QUYTAC_NGHIEPVU_195 → TIEUCHI_NGHIEMTHU_212 đến 214 → KICHBAN_KIEMTHU_352 đến 354 → `apps/api/src/marketplace/carriers/ghtk-carrier.ts`, `carrier-registry.ts`, `apps/api/test/c31-carrier-ghtk.test.ts`.

## 18. Giới hạn đã biết

- Viết theo tài liệu công khai, kiểm thử bằng máy chủ giả lập; các điểm chưa xác minh ở mục 9 phải thử với tài khoản GHTK môi trường thử nghiệm trước khi phát hành.
- Một địa chỉ lấy hàng chung (biến môi trường), chưa theo từng kho.
- Ghi chú trên lịch sử đơn hiện mã số trạng thái GHTK (ví dụ "GHTK: 13"), chưa có tên trạng thái.
- `carrierNames` có tên tạm cho `vnpost`, `viettel_post`, `jt`; khi hợp nhất các phiên kết nối khác cần giữ một bản tên.
