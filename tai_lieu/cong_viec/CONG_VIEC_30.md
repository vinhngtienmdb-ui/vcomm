# CONG_VIEC_30: Kết nối đơn vị vận chuyển J&T Express (MODULE_09)

- Mô tả: Thêm J&T Express (mã `jt`) vào khung đơn vị vận chuyển của CONG_VIEC_24: tạo vận đơn có tiền thu hộ, hủy, tra hành trình, tra theo số đơn, nhận webhook.
- Mức quy mô: Vừa (thêm lớp kết nối vào khung có sẵn; không màn hình mới, không API mới, không đổi kiến trúc).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11. Đã nghiệm thu 2026-11-11, chờ phát hành (trước khi phát hành phải thử với tài khoản thử nghiệm của hãng).
- Nguồn: yêu cầu của người dùng ngày 2026-11-11 (phiên chính CONG_VIEC_25 mở phiên con); CONG_VIEC_24 (QUYTAC_NGHIEPVU_159, 160, 162).
- Nhánh: `chuc-nang/CONG_VIEC_30-giao-van-jt`, tách từ `chuc-nang/CONG_VIEC_24-dat-hang-vcomm`.

## 1. Mục tiêu

Nhân viên VComm giao đơn VComm cho J&T Express như GHN; trạng thái đơn tự cập nhật theo hành trình J&T.

## 2. Phạm vi

Trong phạm vi:

- Lớp kết nối `apps/api/src/marketplace/carriers/jt-carrier.ts` cài đặt `CarrierAdapter`; đăng ký trong `carrier-registry.ts`; tên trong `carrierNames`.
- Webhook qua đường dẫn chung `/public/carriers/jt/webhook/{key}`.
- Database migration `0042_carrier_jt.sql`; mã `carrierCodes` gồm năm đơn vị (dùng chung với các phiên VNPost, Viettel Post, GHTK).
- Sửa nhỏ khung chung (người dùng đồng ý ngày 2026-11-11): `cancelShipment` nhận thêm số đơn (J&T bắt buộc khi hủy); hàm tùy chọn `webhookReply` để đơn vị vận chuyển tự định dạng nội dung trả lời webhook; registry trả "chưa cấu hình" cho mã chưa có lớp kết nối.

Ngoài phạm vi: đối soát COD, hạch toán phí (CONG_VIEC_25); bảng ánh xạ địa chỉ riêng của J&T; in vận đơn; tính phí trước khi giao; nhiều kiện một đơn; xác minh chữ ký `digest` của webhook J&T (trạng thái luôn tra lại nên không cần).

## 3. Yêu cầu nghiệp vụ

- YCAU_NGHIEPVU_50 (CONG_VIEC_24), thêm đơn vị vận chuyển J&T.
- CHUC_NANG_132: Kết nối J&T Express vào khung đơn vị vận chuyển: tạo vận đơn có tiền thu hộ, hủy, tra hành trình, tra theo số đơn, nhận webhook.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_190: J&T Express là một đơn vị trong khung QUYTAC_NGHIEPVU_160. Thông tin kết nối chỉ ở biến môi trường: `JT_API_ACCOUNT`, `JT_PRIVATE_KEY`, `JT_CUSTOMER_CODE`, `JT_CUSTOMER_PASSWORD` (mật khẩu gốc do bưu cục cấp), `JT_WEBHOOK_KEY` (≥ 24 ký tự), `JT_BASE_URL` (trống: môi trường thử nghiệm `https://demoopenapi.jtexpress.vn`; môi trường thật `https://ylopenapi.jtexpress.vn`), điểm lấy hàng `JT_SENDER_NAME`, `JT_SENDER_PHONE`, `JT_SENDER_PROVINCE`, `JT_SENDER_WARD`, `JT_SENDER_ADDRESS`. Thiếu một biến (trừ `JT_BASE_URL`) hoặc khóa webhook ngắn thì J&T "chưa cấu hình", không giao được. Đơn vị trong danh sách mã nhưng chưa có lớp kết nối cũng "chưa cấu hình".
- QUYTAC_NGHIEPVU_191: Tạo vận đơn J&T (`order/addOrder`): mã đơn của bên gửi `txlogisticId` = số đơn bán; lấy hàng tại điểm lấy hàng (`serviceType` 1), giao tận nơi (`deliveryType` 1); cước VComm trả theo hợp đồng (`payType` PP_PM); tiền thu hộ `codMoney` = tiền thu hộ của đơn (QUYTAC_NGHIEPVU_160); không mua bảo hiểm; giá trị hàng = tổng tiền hàng, tối đa 30.000.000 đồng; loại hàng "hàng hóa" (bm000010), gói EXPRESS. Địa chỉ người nhận gửi tên tỉnh, tên phường/xã hai cấp hiện có (`prov`, `area`), không gửi cấp huyện, cờ `selfAddress` = 1 để J&T tự ánh xạ. Khối lượng (kg, hai chữ số thập phân), kích thước theo QUYTAC_NGHIEPVU_160. Phí ghi trên vận đơn = cước (`inquiryFee`) + phí thu hộ (`codFee`). J&T từ chối thì đơn giữ Chờ giao, báo nhân viên.
- QUYTAC_NGHIEPVU_192: Trạng thái vận đơn J&T là mã quét có thời gian muộn nhất trong hành trình (`logistics/trace`), bỏ qua mã 121 (Hoàn tất); chưa có lần quét thì là 103 (Đã đặt). Ánh xạ sang giai đoạn của khung: 103, 104 chờ lấy hàng; 105 đã hủy; 10, 20, 30, 50, 92, 94, 106, 109, 110, 112, 116, 172, 200 đã lấy hàng; 100, 113 đã giao; 117, 173 đã hoàn hàng; 118, 120 và mã chưa biết cần nhân viên xem (ghi lịch sử, không đổi trạng thái đơn, không ghi sổ phiếu xuất). Hủy vận đơn (`order/cancelOrder`) gửi số đơn và mã vận đơn.
- QUYTAC_NGHIEPVU_193: Tra lại khi chưa rõ kết quả tạo vận đơn: gọi tra hành trình theo `txlogisticId` = số đơn. J&T trả thành công có vận đơn: ghi nhận; thành công không có vận đơn: bỏ chỗ giữ để giao lại; lỗi: giữ chỗ, nhân viên kiểm tra trên trang J&T.
- QUYTAC_NGHIEPVU_194: Webhook J&T: J&T gửi dạng form `bizContent=<JSON>`; chỉ nhận khi đúng khóa trên đường dẫn; mã vận đơn lấy từ `billCode`; trạng thái luôn tra lại từ J&T; trả lời `{"code":"1","msg":"success","data":"applied"|"ignored"}` để J&T không gửi lại.

## 5. Dữ liệu liên quan

Database migration `0042_carrier_jt.sql` (ba dòng giống hệt các phiên VNPost, Viettel Post, GHTK ở hai dòng ràng buộc):

- Ràng buộc `marketplace.carriers.code` gồm `ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk`.
- Thêm dòng `jt` (mặc định tắt).

Không thêm bảng, cột. Trạng thái vận đơn lưu mã quét J&T (ví dụ `106`) trong `marketplace.shipments.carrier_status`.

## 6. Giao diện liên quan

Dùng lại MAN_HINH_86 (bật, tắt J&T; trạng thái cấu hình), MAN_HINH_88 (chọn J&T khi giao, tra lại vận đơn, hủy). Không đổi mã giao diện, không thêm chuỗi hiển thị.

## 7. API liên quan

Dùng lại API_123 (`PUT /marketplace/carriers/jt`), API_127 (`carrierCode: "jt"`), API_128 (`POST /public/carriers/jt/webhook/{key}`; nội dung trả lời của J&T theo QUYTAC_NGHIEPVU_194; GHN giữ `{ result }`).

## 8. Phân quyền

Không đổi: `marketplace.order.manage` giao, hủy, tra lại; webhook công khai xác thực bằng khóa.

## 9. Điều kiện đặc biệt

- Viết theo tài liệu công khai trên J&T Open Platform Việt Nam (`open.jtexpress.vn`, tài liệu nằm trong mã trang, phần lớn tiếng Trung). Kiểm thử tự động dùng máy chủ giả lập; không gọi máy chủ thật.
- Trước khi phát hành phải thử với tài khoản J&T môi trường thử nghiệm do người dùng cấp các điểm chưa xác minh ở mục 16.

## 10. Tiêu chí nghiệm thu

| Mã                    | Tiêu chí                                                                                                                                                                                                         | Mức      | Kịch bản            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------- |
| TIEUCHI_NGHIEMTHU_208 | J&T hiện trong danh sách đơn vị vận chuyển, chỉ "đã cấu hình" khi đủ biến môi trường; tạo vận đơn ký đúng, địa chỉ hai cấp không có cấp huyện, tiền thu hộ, điểm lấy hàng, phí; J&T từ chối thì đơn giữ Chờ giao | Bắt buộc | KICHBAN_KIEMTHU_348 |
| TIEUCHI_NGHIEMTHU_209 | Webhook J&T sai khóa bị từ chối; trạng thái theo tra lại hành trình; lấy hàng ghi sổ phiếu xuất; giao thành công; bỏ qua mã Hoàn tất; nhận trùng không đổi kết quả; trả lời `code` 1                             | Bắt buộc | KICHBAN_KIEMTHU_349 |
| TIEUCHI_NGHIEMTHU_210 | Hủy đơn chờ lấy hàng gửi số đơn và mã vận đơn; J&T hủy thì đơn hủy; vấn đề, mã lạ chỉ ghi lịch sử; hoàn hàng nhập lại kho, đơn hủy                                                                               | Bắt buộc | KICHBAN_KIEMTHU_350 |
| TIEUCHI_NGHIEMTHU_211 | Chưa rõ kết quả tạo vận đơn: tra theo số đơn ghi nhận vận đơn, không có thì bỏ chỗ giữ, J&T lỗi thì giữ chỗ                                                                                                      | Bắt buộc | KICHBAN_KIEMTHU_351 |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_348 đến 351: tự động, `apps/api/test/c30-carrier-jt.test.ts`. Máy chủ J&T giả lập kiểm `digest` = base64(md5(bizContent + privateKey)), mật khẩu nghiệp vụ = MD5(mật khẩu gốc + `jadada369t3`) viết hoa (khớp ví dụ trong tài liệu J&T), trả hành trình do kiểm thử đặt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện: `fetch` có thời gian chờ 15 giây, `node:crypto`. Lỗi J&T (`code` khác 1) là "từ chối"; không trả lời, lỗi máy chủ là "không rõ kết quả" như GHN.

## 13. Thành phần không được thay đổi

Hành vi GHN; trạng thái đơn VComm, ghi sổ phiếu kho (QUYTAC_NGHIEPVU_159); mã CONG_VIEC_25.

## 14. Các lát và điểm xem trước

- L1 (một lát): khung, lớp kết nối, webhook, kiểm thử – người dùng xem kết quả kiểm thử tự động và nội dung yêu cầu gửi J&T trong kiểm thử (không có giao diện mới) – chờ nghiệm thu.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

| Mục                                             | Kết quả                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu    | Đạt: QUYTAC_NGHIEPVU_190 đến 194 có kiểm thử tự động                                                                                                           |
| Đúng giao diện                                  | Không áp dụng: không đổi giao diện; MAN_HINH_86, 88 đọc danh sách đơn vị vận chuyển từ API                                                                     |
| Đã xử lý lỗi                                    | Đạt: từ chối, không trả lời, thiếu cấu hình, mã quét lạ, tra theo số đơn lỗi                                                                                   |
| Đã kiểm thử, đạt cổng kiểm thử                  | Đạt: c30-carrier-jt 4/4; toàn bộ 328/328 (mục 17)                                                                                                              |
| Không phá vỡ chức năng cũ                       | Đạt: kiểm thử CONG_VIEC_24 đạt; một kiểm thử cũ đổi so sánh danh sách đúng một GHN thành "có GHN" vì danh sách nay có J&T (người dùng xác nhận khi nghiệm thu) |
| Đạt tiêu chí nghiệm thu bắt buộc                | Đạt trên máy chủ giả lập: TIEUCHI_NGHIEMTHU_208 đến 211                                                                                                        |
| Đạt cổng bảo mật                                | Đạt: không thêm thư viện, không có khóa bí mật trong mã (mục 17)                                                                                               |
| Đã tự rà soát mã, dọn dẹp                       | Đạt                                                                                                                                                            |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Ghi trong mục 18 để phiên chính cập nhật khi hợp nhất (phiên con không sửa tài liệu đánh số)                                                                   |

## 16. Điểm chưa xác minh (thử với tài khoản J&T môi trường thử nghiệm trước khi phát hành)

1. Địa chỉ: J&T có nhận tên tỉnh, phường/xã hai cấp chuẩn (ví dụ "Thành phố Hà Nội", "Phường Ba Đình") với `selfAddress` = 1 không. Ví dụ của J&T dùng tên ngắn ("Hồ Chí Minh") và xã kèm mã riêng ("Phường Nguyễn Thái Bình-028QQ107"). Nếu bị từ chối: cần bảng ánh xạ sang danh mục J&T (API `online/pca`), làm công việc riêng.
2. Tra theo số đơn: tra hành trình với `txlogisticId`, `billCodes` rỗng có trả vận đơn không.
3. Mã quét: tài liệu có hai bộ mã không khớp (ví dụ 110 là "hàng đến" hoặc "kiện có vấn đề"); ánh xạ nhận cả hai.
4. Phí: `inquiryFee` có gồm `codFee` không (đang cộng hai khoản).
5. `payType` PP_PM (VComm trả cước theo tháng) đúng với hợp đồng của VComm không.
6. Webhook: J&T có đẩy hành trình vào đường dẫn có khóa không, nội dung có `billCode` không; nội dung trả lời `code` 1 có được chấp nhận không. Khóa nằm trên đường dẫn nên có thể xuất hiện trong nhật ký máy chủ trung gian.
7. Tiền thu hộ đã thu: API tra hành trình của J&T không trả số tiền thu hộ đã thu; lớp kết nối không có trường này cho CONG_VIEC_25.

## 17. Kết quả kiểm thử và bảo mật

Lần kiểm thử 2026-11-11, máy phát triển (PostgreSQL, Redis cục bộ; máy chủ J&T giả lập):

| Hạng mục              | Lệnh                                                                                                                                                                                                                      | Kết quả                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kiểm thử J&T          | `npx vitest run test/c30-carrier-jt.test.ts`                                                                                                                                                                              | Đạt 4/4 (KICHBAN_KIEMTHU_348 đến 351)                                                                                                                          |
| Kiểm thử CONG_VIEC_24 | `npx vitest run test/c24-marketplace-orders.test.ts`                                                                                                                                                                      | Đạt 12/12                                                                                                                                                      |
| Kiểm thử hồi quy      | `pnpm --filter api test`                                                                                                                                                                                                  | Đạt 328/328 (41 tệp)                                                                                                                                           |
| Kiểm tra kiểu         | `pnpm --filter api typecheck`                                                                                                                                                                                             | Đạt                                                                                                                                                            |
| Kiểm thử có bắt lỗi   | Cố ý bỏ việc bỏ qua mã 121; cố ý bỏ phí thu hộ khỏi phí                                                                                                                                                                   | Kiểm thử báo thất bại đúng chỗ; đã khôi phục mã                                                                                                                |
| C1 quét thư viện      | `pnpm audit --prod`                                                                                                                                                                                                       | 2 lỗ hổng Trung bình có sẵn (`glob`, `minimatch` trong công cụ dòng lệnh Expo của ứng dụng di động); công việc không đổi `pnpm-lock.yaml`, không thêm thư viện |
| C2 quét khóa bí mật   | Tìm mẫu khóa trong phần thay đổi (máy chưa có `gitleaks`; CI chạy `gitleaks`)                                                                                                                                             | Không có khóa thật; chỉ giá trị giả trong kiểm thử; `.env.example` để trống                                                                                    |
| C3 phân quyền         | Kiểm thử webhook sai khóa                                                                                                                                                                                                 | Bị từ chối 403; API quản trị dùng lại quyền của CONG_VIEC_24                                                                                                   |
| C4 dữ liệu đầu vào    | Mã vận đơn webhook kiểm bằng biểu thức; nội dung không phải JSON bị bỏ qua                                                                                                                                                | Đạt                                                                                                                                                            |
| C5 phiên đăng nhập    | Không áp dụng: không đổi đăng nhập, phiên                                                                                                                                                                                 |
| C6 OWASP              | A01 (khóa webhook so sánh an toàn), A02 (khóa ở biến môi trường, không ghi log), A03 (không ghép chuỗi SQL), A07 (giới hạn lần sai khóa có sẵn), A10 (chỉ gọi địa chỉ J&T trong biến môi trường); nhóm khác không áp dụng |

Không có lỗi Nghiêm trọng, Cao.

## 18. Nội dung cần thêm vào tài liệu chung (phiên chính cập nhật khi hợp nhất)

- Tài liệu `07`: QUYTAC_NGHIEPVU_190 đến 194 (mục 4).
- Tài liệu `10`: CHUC_NANG_132 (mục 3), thuộc MODULE_09.
- Tài liệu `11`: TIEUCHI_NGHIEMTHU_208 đến 211 (mục 10), Bắt buộc.
- Tài liệu `16`: database migration 0042 mở rộng ràng buộc `marketplace.carriers.code` (`ghn`, `vnpost`, `viettel_post`, `jt`, `ghtk`), thêm dòng `jt`; `marketplace.shipments.carrier_status` của J&T là mã quét.
- Tài liệu `17`: API_128 thêm `code` = `jt`, J&T gửi dạng form `bizContent`, nội dung trả lời `{"code":"1","msg":"success","data":"applied"|"ignored"}`; API_123, 127 nhận `jt`.
- Tài liệu `21`: KICHBAN_KIEMTHU_348 đến 351 (mục 10, 11), tự động.
- Tài liệu `22`: khóa bí mật mới `JT_PRIVATE_KEY`, `JT_CUSTOMER_PASSWORD`, `JT_WEBHOOK_KEY` (biến môi trường, không ghi log); điểm tiếp nhận API_128 cho J&T xác thực bằng khóa trên đường dẫn.
- Tài liệu `25`: kết quả mục 17.
- Tài liệu `27`: YCAU_NGHIEPVU_50 → CHUC_NANG_132 → TIEUCHI_NGHIEMTHU_208 đến 211 → KICHBAN_KIEMTHU_348 đến 351 → `apps/api/src/marketplace/carriers/jt-carrier.ts`, `carrier-registry.ts`, `shipments.service.ts`, `apps/api/test/c30-carrier-jt.test.ts`.
