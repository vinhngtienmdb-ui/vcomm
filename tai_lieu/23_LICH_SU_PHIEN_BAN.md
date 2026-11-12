# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Các phiên bản đã phát hành, nội dung và phương án quay lui riêng của từng phiên bản.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đang cập nhật

## Phiên bản 0.7.0 – 2026-11-12 – Chờ phát hành

- Chức năng mới:
  - Cửa hàng liên kết phần 1 (MODULE_12, ứng dụng mới `apps/web-affiliate`, CONG_VIEC_55, THAY_DOI_27, THAY_DOI_29): hợp đồng cửa hàng liên kết với đối tác ngoài tập đoàn (tỷ lệ tích, phí dịch vụ, hạn mức nợ, trần mỗi giao dịch, hạn thanh toán), điểm bán, chủ cửa hàng và thu ngân kích hoạt lời mời bằng số điện thoại và mã OTP; tích, dùng điểm và voucher tại quầy bằng mã QR động của cửa hàng, mã QR động của khách hoặc số điện thoại kèm xác nhận trên ứng dụng VComm; hủy giao dịch trước khi chốt tuần; voucher ba loại qua duyệt; đối soát tuần có bù trừ, công nợ, chặn tích khi vượt hạn mức hoặc quá hạn; hạch toán ở công ty vận hành sàn; báo cáo cửa hàng, cảnh báo bất thường; danh sách giao dịch và nguồn bút toán riêng (THAY_DOI_29); đăng nhập Zalo cho cổng cửa hàng.
  - Open API cho đối tác lát L1, L2 (MODULE_16 phần 1, CONG_VIEC_61): khóa API theo công ty và đối tác (bảng `core.api_keys`, chỉ lưu SHA-256), phạm vi quyền, danh sách IP, giới hạn tần suất theo khóa, xác thực khóa API; nhật ký từng lần gọi (xóa sau 90 ngày lúc 2 giờ); API sản phẩm, giá, tồn; đơn bán qua API (mã đơn của đối tác, chống gửi trùng).
- Ghép giữa các công việc: luồng OAuth dùng chung (Zalo) nhận thêm `app=merchant` để quay về cổng cửa hàng (CONG_VIEC_55); danh mục quyền, `app.module.ts`, `packages/contracts`, khóa dịch, tác vụ nền gộp giữ cả hai phía.
- Thay đổi dữ liệu, database migration theo thứ tự chạy: `0102` đến `0105` (schema `affiliate`; `0103`, `0104` định nghĩa lại ràng buộc `source_type` của `loyalty.lots`, `loyalty.entries`, `loyalty.document_points`, `loyalty.refund_links`; `0105` định nghĩa lại `finance.debt_items_source_type_check` và `accounting.journals_source_type_check`), `0128` đến `0130` (khóa API, nhật ký gọi API, cột đơn bán qua API trên `sales.orders`). Các ràng buộc dùng chung chỉ bị định nghĩa lại trong CONG_VIEC_55, giá trị là tập rộng hơn bản trên `main` (`0101`, `0069`, `0087`, `0088`), nên không cần database migration đặt lại ràng buộc (số `0144` dành riêng không dùng). `0102` đến `0105` có số nhỏ hơn `0109` đến `0119` đã có trong 0.6.0: cơ chế database migration chạy mọi tệp chưa có trong `public.schema_migrations` theo thứ tự tên, nên cơ sở dữ liệu đã chạy tới `0119` vẫn chạy `0102` đến `0105`; đã thử cả hai cách (cơ sở dữ liệu của 0.6.0 rồi chạy phần mới, và cơ sở dữ liệu mới chạy từ đầu) cho cùng 911 ràng buộc kiểm tra, không thiếu giá trị nào của `main`. Số `0106` đến `0108`, `0112`, `0115`, `0120` đến `0127` không có tệp trong phiên bản này.
- Thay đổi API: thêm API theo tài liệu `17` của CONG_VIEC_55 (API_206 đến API_213) và CONG_VIEC_61 (API_255 đến API_264, gồm điểm tiếp nhận công khai xác thực bằng khóa API); tương thích ngược.
- Ứng dụng mới: `apps/web-affiliate` (cổng cửa hàng liên kết, cổng 3013).
- Thư viện mới: `jsqr` 1.4.0 (đọc mã QR từ camera ở `apps/web-affiliate`, CONG_VIEC_55); `expo-camera` ~58.0.14 thêm vào `apps/mobile-vcomm` (quét mã QR cửa hàng, cùng phiên bản đã dùng ở `apps/mobile-warehouse`).
- Biến môi trường mới: không có. `MFA_SECRET_KEY` (đã có) nay còn là nguồn dẫn xuất khóa HMAC ký mã QR động của cửa hàng và mã thành viên (CONG_VIEC_55). Khóa API chỉ lưu SHA-256 và 8 ký tự đầu, không cần khóa bí mật.
- Rủi ro:
  - `MFA_SECRET_KEY` bắt buộc trên môi trường thật (ít nhất 32 ký tự); thiếu thì không tạo, không kiểm được mã QR động tại quầy cửa hàng liên kết. Đổi giá trị làm mất hiệu lực mã đang hiện (mã sống 30 đến 60 giây).
  - Lọc IP của Open API dựa vào `trust proxy` 1: môi trường thật cần đúng một proxy tin cậy đặt `X-Forwarded-For`, nếu không đối tác có thể giả IP hoặc danh sách IP không có tác dụng; kiểm khi triển khai.
  - Quét camera mã QR (cổng cửa hàng và ứng dụng VComm) chưa thử trên điện thoại thật.
  - Pháp lý điểm thưởng (CONG_VIEC_51) vẫn áp dụng cho điểm tại cửa hàng liên kết: chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư.
- Khả năng tương thích: tương thích ngược với 0.6.0; database migration thêm schema, bảng, cột (có mặc định cho dữ liệu cũ) và mở rộng ràng buộc kiểm tra.
- Công việc gộp trong phiên bản: CONG_VIEC_55 (pull request #120), CONG_VIEC_61 lát L1, L2 (#134); THAY_DOI_27, THAY_DOI_29. Thứ tự hợp nhất: 55, 61. Không gộp CONG_VIEC_52, 56, 59, 60.
- Đánh lại số mục tài liệu trùng khi gộp: không cần (các mục của CONG_VIEC_55 không đánh số, mã định danh của hai công việc không trùng dải).
- Kiểm thử trên nhánh phát hành: `pnpm typecheck` 18/18 đạt, `pnpm lint` 4/4 đạt, khóa dịch khớp 7872 khóa; kiểm thử API toàn bộ một tiến trình (`--no-file-parallelism`) 120 tệp, 633 kiểm thử đạt.
- Tag: `v0.7.0` trên commit hợp nhất nhánh `phat-hanh/v0.7.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.6.0`; gỡ ứng dụng `apps/web-affiliate` khỏi máy chủ.
  - Database migration: bản 0.6.0 không đọc schema `affiliate`, bảng `core.api_keys`, nhật ký gọi API, cột đơn bán qua API; giữ nguyên khi quay lui mã. Ràng buộc kiểm tra đã mở rộng (`0103` đến `0105`) chỉ thêm giá trị nên bản 0.6.0 vẫn ghi được. Trước khi quay lui: thu hồi mọi khóa API đang dùng và báo đối tác; chốt và đối soát hết giao dịch cửa hàng liên kết, báo cửa hàng tạm dừng (bản 0.6.0 không có cổng cửa hàng). Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.7.0.
  - Ứng dụng VComm trên điện thoại: bản phát hành kèm `expo-camera` là bản dựng mới; quay lui bằng bản dựng của 0.6.0 trên kho ứng dụng hoặc cập nhật qua mạng.

## Phiên bản 0.6.0 – 2026-11-12 – Chờ phát hành

- Chức năng mới:
  - Kế hoạch mua theo ngân sách (MODULE_14 phần 3, mini app `apps/web-purchasing`, CONG_VIEC_58): kế hoạch ngân sách theo ngành hàng cấp 1, kho, tháng qua luồng duyệt; số đã dùng, số còn được mua theo tháng, quý, năm; cảnh báo ngân sách trong đơn mua, đơn vượt hoặc chưa có ngân sách phải duyệt; phiếu điều chỉnh tăng, giảm, chuyển ngân sách có duyệt.
  - Trạm giao hàng O2O (MODULE_14 phần 2, CONG_VIEC_57): cửa hàng bán lẻ hoặc điểm giao nhận làm trạm; đơn VComm nhận tại trạm hoặc trạm giao tận nơi, chọn trạm đủ hàng, giữ hàng ở kho trạm; mã nhận hàng 6 số và QR, thu tiền trong ca; nhân viên giao hàng trạm; nhắc và tự hủy khi quá hạn giữ; trạm nhận hàng trả về.
  - Kinh doanh trên ứng dụng VComm (MODULE_07 phần 3, CONG_VIEC_22, THAY_DOI_26, THAY_DOI_28): ẩn ghé thăm khách; chi tiết khách; chia sẻ sản phẩm kèm mã giới thiệu; ghi chú chăm sóc, hẹn, nhắc hẹn lúc 7 giờ, mục Thông báo; doanh số của tôi và của nhánh theo người phụ trách lúc đặt đơn.
  - Bán lẻ tại quầy lát L6 (MODULE_14, CONG_VIEC_53): tích điểm tại quầy bằng số điện thoại, dùng điểm tại quầy bằng mã Smart OTP (mã 30 giây gắn một thiết bị trong ứng dụng VComm), hoàn điểm khi trả hàng, theo sổ cái điểm của CONG_VIEC_51.
- Ghép giữa các công việc: đơn VComm có cách nhận (`fulfillment_mode`), trạm (`station_id`), phương thức Thanh toán khi nhận tại trạm (CONG_VIEC_57) và nhân viên phụ trách lúc đặt đơn (`sales_staff_user_id`, CONG_VIEC_22) cùng ghi trong `snapshot()` của `commissions.service.ts`; đơn mua chung chỉ giao qua đơn vị vận chuyển.
- Thay đổi dữ liệu, database migration theo thứ tự chạy: `0109` đến `0111` (trạm giao hàng O2O; `0110` định nghĩa lại `marketplace.orders_cod_amount_method_check`, `0111` định nghĩa lại `marketplace.orders_status_check` thêm `ready_for_pickup`), `0113`, `0114` (ghi chú chăm sóc, cột `marketplace.orders.sales_staff_user_id`, chỉ thêm cột, chỉ mục), `0116` đến `0118` (ngân sách mua), `0119` (điểm tại quầy, Smart OTP; định nghĩa lại `core.otp_codes_purpose_check` thêm `smart_otp`). Mỗi ràng buộc kiểm tra chỉ bị định nghĩa lại một lần trong bản gộp, giá trị là tập rộng hơn bản trước, nên không cần database migration đặt lại ràng buộc (số `0120` dành riêng không dùng). Số `0102` đến `0108`, `0112`, `0115` không có tệp trong phiên bản này.
- Thay đổi API: thêm API theo tài liệu `17` của CONG_VIEC_58 (API_235 đến API_240), CONG_VIEC_57 (API_220 đến API_227), CONG_VIEC_22 (API_228 đến API_231), CONG_VIEC_53 lát L6 (API_198, API_199); `POST /buyer/orders/preview`, `POST /buyer/orders` nhận thêm `fulfillmentMode` (mặc định `carrier`), `stationId` (tương thích ngược); API_114 (ghé thăm khách) từ chối ghi mới; API_75 (đơn mua) trả thêm `budgetCheck`, `budgetSnapshot`.
- Thư viện mới: `expo-clipboard` ~58.0.4 (sao chép trên ứng dụng VComm, CONG_VIEC_22), `otpauth` 9.6.0 (tạo mã Smart OTP trên ứng dụng VComm, CONG_VIEC_53); đều ở `apps/mobile-vcomm`.
- Biến môi trường mới: không có.
- Rủi ro:
  - Phương thức "Thanh toán khi nhận tại trạm" (`pay_at_station`) được `0110` cài sẵn ở trạng thái tắt; quản trị sàn phải bật trong danh sách phương thức thanh toán sau khi cài đặt trạm, nếu không người mua chỉ trả trực tuyến khi nhận tại trạm.
  - Smart OTP: mã SMS kích hoạt dùng mẫu tin nhắn OTP dùng chung (mục đích `smart_otp`), chưa có mẫu riêng đăng ký với nhà mạng; cần kiểm tra mẫu tin với nhà cung cấp SMS trước khi dùng thật.
  - Pháp lý điểm thưởng (CONG_VIEC_51) vẫn áp dụng cho điểm tại quầy: chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư.
  - Ngân sách mua: đơn chờ duyệt không giữ chỗ ngân sách (quy tắc người dùng chọn).
- Khả năng tương thích: tương thích ngược với 0.5.0; database migration thêm bảng, cột (đều có mặc định cho dữ liệu cũ) và mở rộng ràng buộc kiểm tra.
- Công việc gộp trong phiên bản: CONG_VIEC_58 (pull request #123), CONG_VIEC_57 (#118), CONG_VIEC_22 (#122), CONG_VIEC_53 lát L6 (#125); THAY_DOI_26, THAY_DOI_28. Thứ tự hợp nhất: 58, 57, 22, 53. Không gộp CONG_VIEC_52, 55, 56.
- Đánh lại số mục tài liệu trùng khi gộp (chỉ đổi số): tài liệu `08` mục 52, 53 (trạm giao hàng, trước là 50, 51); tài liệu `14` mục 78, 79 (trạm giao hàng, trước là 75, 76), mục 80 (Kinh doanh trên ứng dụng VComm, trước là 75); tài liệu `16` mục 39 (database migration 0113, 0114, trước là 38); tài liệu `17` mục 3zg (Kinh doanh trên ứng dụng VComm, trước là 3zf); tài liệu `27` mục 36 (bao phủ CONG_VIEC_22, trước là 35).
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.6.0` trên commit hợp nhất nhánh `phat-hanh/v0.6.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.5.0`.
  - Database migration: bản 0.5.0 không đọc bảng, cột mới (trạm, ghi chú chăm sóc, ngân sách mua, `loyalty.smart_otp_devices`, `retail.sales.loyalty_user_id`, `marketplace.orders.fulfillment_mode`, `station_id`, `sales_staff_user_id`); giữ nguyên khi quay lui mã. Ràng buộc kiểm tra đã mở rộng (`0110`, `0111`, `0119`) chỉ thêm giá trị nên bản 0.5.0 vẫn ghi được. Trước khi quay lui: tắt phương thức `pay_at_station`, xử lý hết đơn của trạm đang ở trạng thái `ready_for_pickup` (bản 0.5.0 không hiển thị, không chuyển được trạng thái này). Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.6.0.
  - Ứng dụng VComm trên điện thoại: bản phát hành kèm `expo-clipboard`, `otpauth` là bản dựng mới; quay lui bằng bản dựng của 0.5.0 trên kho ứng dụng hoặc cập nhật qua mạng.

## Phiên bản 0.5.0 – 2026-11-11 – Chờ phát hành

- Chức năng mới:
  - Nhân sự phần 4 (MODULE_08, mini app `apps/web-hr`, CONG_VIEC_54): nhu cầu tuyển dụng qua luồng duyệt, tin tuyển dụng, trang tuyển dụng công khai, ứng viên, phỏng vấn, đề nghị nhận việc, lưu giữ dữ liệu ứng viên; đánh giá hiệu suất (mẫu, kỳ, phiếu, hiệu chỉnh, công bố).
  - Điểm thưởng phần 1 (MODULE_11, CONG_VIEC_51): chương trình theo giai đoạn, sổ cái điểm, lô điểm có hạn dùng, hạng thành viên, dùng điểm khi đặt đơn VComm, hoàn điểm khi hủy, trả hàng, điều chỉnh qua luồng duyệt, cảnh báo bất thường, nghĩa vụ điểm, bút toán điểm.
  - Cộng đồng phần 1 (MODULE_10, CONG_VIEC_49, THAY_DOI_22): cộng tác viên một tầng, thưởng giới thiệu bạn bè, mua chung, ví mua sắm (khóa toàn hệ thống, chặn từng tài khoản), bảng tin, đánh giá đã mua, kiểm duyệt.
  - Nhập khẩu (MODULE_04 phần 2, CONG_VIEC_45): đơn mua ngoại tệ, nhập kho quy đổi tỷ giá, tờ khai hải quan, thuế nhập khẩu, phân bổ chi phí vào giá vốn, bút toán.
  - Bán lẻ tại quầy phần 1, lát L0 đến L5 (MODULE_14, mini app `apps/web-retail`, CONG_VIEC_53, THAY_DOI_24): cửa hàng, quầy, ca thu ngân, bán hàng, hóa đơn bán lẻ, trả hàng, tiền mặt, chứng từ quỹ, hóa đơn điện tử từ máy tính tiền. Lát L6 (điểm thưởng tại quầy) chưa có, không thuộc phiên bản này.
- Ghép giữa các công việc: tiền người mua phải trả = tiền hàng + phí giao hàng − tiền điểm − phần ví mua sắm; điểm trừ trước, ví mua sắm trả phần còn lại; đơn mua chung không dùng điểm; hoàn tiền trả hàng: phần điểm trước, tiền mặt, rồi phần ví (CONG_VIEC_51 mục 19).
- Lỗi đã sửa: LOI_08 (nhật ký thao tác ghi thời điểm bằng `clock_timestamp()`, giữ đúng thứ tự nhiều thao tác trong một giao dịch).
- Thay đổi dữ liệu, database migration theo thứ tự chạy: `0067` đến `0069` (nhập khẩu), `0079` đến `0082` (cộng đồng), `0084` (nguồn bút toán nhập khẩu), `0086` đến `0089` (điểm thưởng), `0094` đến `0097` (bán lẻ tại quầy), `0098` đến `0100` (tuyển dụng, đánh giá), `0101` (phát hành: đặt lại ràng buộc `accounting.journals_source_type_check` bằng hợp của mọi nguồn bút toán, vì `0079`, `0084`, `0088` mỗi tệp định nghĩa lại theo nhánh riêng). Các tệp số nhỏ hơn `0083` vẫn được chạy vì trình chạy database migration ghi nhận theo tên tệp.
- Thay đổi API: thêm API theo tài liệu `17` của CONG_VIEC_45, 49, 51, 53, 54; `POST /buyer/orders/preview`, `POST /buyer/orders` nhận thêm `pointsToRedeem`, `useShoppingWallet`, `groupBuyId` (đều có mặc định, tương thích); xem trước đơn trả thêm `loyalty`, `pointsAmount`, `expectedPoints`, `shoppingWallet`, `walletAmount`, `payable`.
- Thư viện mới: không thêm thư viện bên ngoài; mini app `apps/web-retail` dùng các thư viện, phiên bản đã có (`next`, `next-intl`, `qrcode-generator` 2.0.4).
- Biến môi trường mới: `RETAIL_ORIGIN` ở `apps/web-platform` (địa chỉ mini app Bán lẻ, mặc định `http://localhost:3012`).
- Rủi ro:
  - Pháp lý CONG_VIEC_49: ví mua sắm có thể bị coi là ví điện tử cần giấy phép trung gian thanh toán; bảng tin mở có thể thuộc diện mạng xã hội cần giấy phép. Chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư (người dùng xác nhận 2026-11-11).
  - Pháp lý CONG_VIEC_51: điểm thưởng cần ý kiến luật sư (rủi ro bị coi là ví điện tử); chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư.
  - Nhập khẩu: định khoản theo phụ lục Thông tư 99/2025/TT-BTC chưa đối chiếu nguyên văn; phải đối chiếu trước khi dùng thật.
  - Bán lẻ: đối soát ngân hàng chưa tự ghép chuyển khoản VietQR với phiếu thu bán lẻ; tiền đầu ca chưa lập chứng từ quỹ; chưa có điểm thưởng tại quầy (L6).
  - Tuyển dụng: trang tuyển dụng công khai không giới hạn theo IP (THAY_DOI_23, rủi ro đã chấp nhận ở tài liệu `22` mục 8).
- Khả năng tương thích: tương thích ngược với 0.4.0; database migration thêm schema `loyalty`, `retail`, bảng, cột, và đặt lại ràng buộc kiểm tra theo tập giá trị rộng hơn.
- Công việc gộp trong phiên bản: CONG_VIEC_54 (pull request #105), CONG_VIEC_51 (#103), CONG_VIEC_49 (#97), CONG_VIEC_45 (#85), CONG_VIEC_53 lát L0 đến L5 (#100); LOI_08; THAY_DOI_22, 23, 24. Thứ tự hợp nhất: 54, 51, 49, 45, 53.
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.5.0` trên commit hợp nhất nhánh `phat-hanh/v0.5.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.4.0`.
  - Database migration: bản 0.4.0 không đọc schema `loyalty`, `retail`, bảng mới của tuyển dụng, đánh giá, cộng đồng, nhập khẩu; giữ nguyên khi quay lui mã. Ràng buộc kiểm tra đã mở rộng (`0068`, `0069`, `0079`, `0081`, `0096`, `0101`) chỉ thêm giá trị nên bản 0.4.0 vẫn ghi được. Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.5.0.
  - Dữ liệu cần sao lưu thêm: tệp sơ yếu lý lịch, bằng chứng đồng ý của ứng viên, ảnh bài đăng bảng tin trong thư mục hoặc bucket lưu tệp.

## Phiên bản 0.4.0 – 2026-11-11 – Đã phát hành

- Chức năng mới:
  - Ứng dụng kho trên điện thoại `apps/mobile-warehouse` (CONG_VIEC_44): nhận hàng mua, xuất giao hàng, nhập, xuất khác, chuyển kho, kiểm kê bằng máy quét hoặc camera; đếm cộng dồn, đếm mù (cả web).
  - Nhân sự (MODULE_08, mini app `apps/web-hr`): hồ sơ nhân sự, giấy tờ mã hóa, người phụ thuộc, quá trình công tác, hợp đồng, phụ lục, nghỉ việc, nhắc hết hạn (CONG_VIEC_46); ca làm, chấm công (nhập tệp, ghi tay, ứng dụng GPS, mạng công ty, mã QR động), nghỉ phép, tăng ca, bảng công tháng (CONG_VIEC_47); bảng lương, bảo hiểm, thuế thu nhập cá nhân, bút toán lương, phiếu lương (CONG_VIEC_48, THAY_DOI_21).
  - Báo cáo quản trị toàn tập đoàn, mini app `apps/web-analytics` (CONG_VIEC_50): bán hàng, tồn kho, công nợ, hoa hồng và ví, tổng quan.
  - Khung nhiều cổng thanh toán và 10 cổng: MoMo, SePay, PayOS, chuyển khoản VietQR, BIDV, Ecopay, GPay, Google Pay, Apple Pay, ZaloPay (CONG_VIEC_32 đến 42). Đơn vị vận chuyển VNPost, Viettel Post, J&T, GHTK (CONG_VIEC_28 đến 31, THAY_DOI_20). Theo quyết định của người dùng 2026-11-11: phát hành ở trạng thái tắt; mỗi cổng, đơn vị chỉ bật được khi đã cấu hình khóa, và chỉ bật trên môi trường thật sau khi đã thử với tài khoản thử nghiệm của nhà cung cấp.
- Lỗi đã sửa: LOI_06 (sự kiện đơn VComm cùng giao dịch đảo thứ tự); LOI_07 (ngày duyệt bảng lương ghi theo đồng hồ cơ sở dữ liệu, lệch đồng hồ ứng dụng).
- Thay đổi dữ liệu: database migration `0040` đến `0043` (đơn vị vận chuyển), `0050` đến `0060` (cổng thanh toán), `0064` (kiểm kê), `0070` đến `0078` (Nhân sự), `0083` (báo cáo quản trị). Các tệp số nhỏ hơn `0063` của 0.3.0 vẫn được chạy vì trình chạy database migration ghi nhận theo tên tệp.
- Thay đổi API: thêm API theo tài liệu `17` (API_137 đến 139, 144 đến 161, 170 đến 175, API của cổng thanh toán, đơn vị vận chuyển); `GET /inventory/sales-orders` thêm trường `warehouseId` (tương thích).
- Thư viện mới: `expo-camera` (ứng dụng kho), `qrcode-generator` 2.0.4 (web-hr), `react-native-qrcode-svg` 6.3.26, `react-native-svg` 15.16.0 (ứng dụng VComm, cổng chuyển khoản).
- Biến môi trường mới: khóa kết nối từng cổng thanh toán (`MOMO_*`, `SEPAY_*`, `PAYOS_*`, `BANK_TRANSFER_*`, `BIDV_*`, `ECOPAY_*`, `GPAY_*`, `ZALOPAY_*`) và đơn vị vận chuyển (`VNPOST_*`, `VIETTEL_POST_*`, `JT_*`, `GHTK_*`); thiếu biến thì cổng, đơn vị không bật được.
- Rủi ro:
  - Cổng thanh toán, đơn vị vận chuyển chỉ thử trên bản giả lập; phải thử với tài khoản thử nghiệm của nhà cung cấp trước khi bật thật.
  - Nhân sự: thời hạn lưu, xóa hồ sơ người đã nghỉ chưa quy định (phải xử lý trước khi triển khai MODULE_08 lên môi trường thật); mức tham số pháp luật (lương cơ sở, lương tối thiểu vùng, giảm trừ gia cảnh) phải đối chiếu Công báo trước khi dùng thật; người dùng chấp nhận rủi ro giả vị trí GPS khi chấm công.
  - Ứng dụng kho chưa thử camera trên điện thoại thật.
  - 2 lỗ hổng Trung bình đã biết trong `@expo/cli` (rủi ro đã chấp nhận).
- Khả năng tương thích: tương thích ngược với 0.3.0; database migration chỉ thêm schema, bảng, cột.
- Công việc gộp trong phiên bản: CONG_VIEC_28 đến 42, 44, 46, 47, 48, 50; LOI_06, LOI_07; THAY_DOI_20, 21.
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.4.0` trên commit hợp nhất nhánh `phat-hanh/v0.4.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.3.0`.
  - Database migration: bản 0.3.0 không đọc schema `hr`, bảng mới của cổng, đơn vị vận chuyển, báo cáo; giữ nguyên khi quay lui mã. Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.4.0.
  - Dữ liệu cần sao lưu thêm: tệp giấy tờ nhân sự, tệp hợp đồng đã ký trong thư mục hoặc bucket lưu tệp.

## Phiên bản 0.3.0 – 2026-11-11 – Đã phát hành

- Chức năng mới:
  - Sản phẩm (CONG_VIEC_04): ngành hàng, đơn vị tính, sản phẩm, biến thể, mã vạch, ảnh; nhập Excel; liên kết, sao chép giữa công ty; kênh bán, nhóm khách, bảng giá, phiếu điều chỉnh giá.
  - Kho (CONG_VIEC_05): kho, vị trí, chủ hàng; phiếu nhập, xuất, điều chỉnh; tồn, lô, serial, giá vốn, thẻ kho; chuyển kho, kiểm kê, giữ hàng, tồn an toàn, in tem.
  - Đối tác (CONG_VIEC_06), Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08), Giao dịch nội bộ giữa công ty con (CONG_VIEC_09), Khuyến mãi (CONG_VIEC_12), Công nợ (CONG_VIEC_13).
  - Kế toán tổng hợp (CONG_VIEC_14), báo cáo tài chính theo Thông tư 99, Thông tư 133 (CONG_VIEC_15), hóa đơn điện tử (CONG_VIEC_16), đối soát ngân hàng (CONG_VIEC_18), đối soát thu hộ (CONG_VIEC_19), báo cáo tài chính hợp nhất (CONG_VIEC_20).
  - Mô hình B2C (THAY_DOI_14): tài khoản người mua VComm, giới thiệu (CONG_VIEC_23); đội kinh doanh nhiều cấp (CONG_VIEC_27); đặt hàng trên VComm, giao vận GHN (CONG_VIEC_24); thanh toán VNPAY, COD, hoàn tiền (CONG_VIEC_25); hoa hồng theo đơn, ví hoa hồng, rút tiền, thuế thu nhập cá nhân cộng dồn theo tháng, phí rút tiền (CONG_VIEC_26, THAY_DOI_17, THAY_DOI_19).
  - Sửa các công việc đã nghiệm thu theo mô hình B2C (CONG_VIEC_43, THAY_DOI_18): bỏ hoa hồng đội kinh doanh cũ (CONG_VIEC_17), tắt gán khách (CONG_VIEC_21), chặn đơn bán tay có hàng hóa theo cài đặt công ty, chứng từ dịch vụ không ghi thẻ kho, giao dịch nội bộ chỉ cho dịch vụ.
  - Ứng dụng: 6 mini app web mới (`web-catalog`, `web-inventory`, `web-purchasing`, `web-sales`, `web-finance`, `web-crm`), ứng dụng VComm (`mobile-vcomm`, Expo SDK 58).
- Lỗi đã sửa: LOI_03 (phiếu kho đồng thời tranh hàng khả dụng trả `400` thống nhất), LOI_04 (danh sách chỉ nhận phản hồi của lần tải mới nhất, CONG_VIEC_10), LOI_05 (giới hạn thời gian bước chuẩn bị kiểm thử, CONG_VIEC_11).
- Thay đổi dữ liệu: database migration `0003_catalog.sql` đến `0031_marketplace_shipping_fee_document.sql`, `0044` đến `0048` (hoa hồng, ví, rút tiền), `0061` đến `0063` (CONG_VIEC_43). Số `0032` đến `0043`, `0049` đến `0060` dành cho khung cổng thanh toán và các cổng chưa phát hành; trình chạy database migration chạy mọi tệp chưa có trong `public.schema_migrations` theo thứ tự tên nên các tệp số nhỏ hơn phát hành sau vẫn được chạy.
- Thay đổi API: thêm API theo tài liệu `17` của các module trên; API của 0.2.0 giữ nguyên.
- Thư viện mới: Next.js 16.4.5, next-intl 4.14.9, React 19.3.1 cho các mini app mới; Expo SDK 58, React Native 0.88.1, expo-router, expo-secure-store, expo-image-picker, react-native-web cho ứng dụng VComm.
- Biến môi trường mới: `APP_WEB_ORIGINS`; `GHN_API_TOKEN`, `GHN_SHOP_ID`, `GHN_WEBHOOK_KEY`, `GHN_BASE_URL`; `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`.
- Không gồm trong phiên bản: khung nhiều cổng thanh toán và các cổng CONG_VIEC_32 đến 42 (phải thử với tài khoản thử nghiệm của nhà cung cấp trước khi phát hành); đơn vị vận chuyển VNPost, Viettel Post, J&T, GHTK (CONG_VIEC_28 đến 31, đang làm). Mã của ứng dụng nhân viên kinh doanh (CONG_VIEC_22, tạm dừng theo THAY_DOI_14) có trong mã nguồn vì công việc sau xây trên nó.
- Rủi ro:
  - GHN, VNPAY, hóa đơn điện tử, ngân hàng chỉ thử trên bản giả lập; phải nhập khóa và thử trên môi trường thử nghiệm trước môi trường thật.
  - Số lượng database migration lớn (32 tệp); phải sao lưu trước khi chạy.
  - LOI_01 còn mở; 2 lỗ hổng Trung bình đã biết trong `@expo/cli` (rủi ro đã chấp nhận, tài liệu `22`).
- Khả năng tương thích: tương thích ngược với 0.2.0; database migration chỉ thêm schema, bảng, cột, không xóa dữ liệu của 0.2.0.
- Công việc gộp trong phiên bản: CONG_VIEC_04 đến 21, 23 đến 27, 43; LOI_03; CONG_VIEC_10 (LOI_04), CONG_VIEC_11 (LOI_05).
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.3.0` trên commit hợp nhất nhánh `phat-hanh/v0.3.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.2.0`.
  - Database migration: bản 0.2.0 không đọc schema, bảng mới nên giữ nguyên khi quay lui mã. Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.3.0 (không xóa tay từng bảng vì các module có khóa ngoại chéo).
  - Dữ liệu cần sao lưu thêm: thư mục hoặc bucket lưu ảnh sản phẩm, tệp đính kèm, tệp hóa đơn điện tử.

## Phiên bản 0.2.0 – 2026-11-09 – Đã phát hành

- Chức năng mới (CONG_VIEC_03, hoàn thiện MODULE_01):
  - Cài đặt tích hợp (MAN_HINH_19): nhập mã ứng dụng Google, Microsoft, Zalo và khóa eSMS.vn trên giao diện, khóa bí mật mã hóa, kiểm tra kết nối, gửi thử tin, nhật ký gửi tin;
  - đăng nhập bằng số điện thoại (mã OTP qua Zalo ZNS, không được thì SMS), Google, Microsoft, Zalo; liên kết, hủy liên kết ở hồ sơ; kích hoạt tài khoản bằng Google, Microsoft;
  - Zalo ZNS cho chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt;
  - mẫu đề xuất do quản trị công ty tạo, 3 mẫu có sẵn (phiếu đề nghị chi, đề nghị tạm ứng, đề nghị mua sắm) (MAN_HINH_20);
  - đề xuất theo mẫu, gửi duyệt qua luồng duyệt có sẵn, tệp đính kèm (tối đa 10 tệp, 10 MB), in PDF (MAN_HINH_21); người duyệt xem nội dung đề xuất ở MAN_HINH_08.
- Lỗi đã sửa: không có lỗi đã cấp mã.
- Thay đổi dữ liệu: database migration `database/migrations/0002_cong_viec_03.sql` thêm 6 bảng (`integration_settings`, `otp_codes`, `message_deliveries`, `proposal_templates`, `proposals`, `attachments`), không sửa bảng cũ. Khi khởi động, API đồng bộ thêm 3 quyền (`platform.integration.manage`, `platform.proposal_template.manage`, `platform.proposal.create`) vào vai trò có sẵn.
- Thay đổi API: thêm API_02 đến API_05, API_49 đến API_54 (tài liệu `17`); API cũ giữ nguyên.
- Thư viện mới: pdfmake 0.3.12 (MIT), @aws-sdk/client-s3 3.1156.0 (Apache-2.0).
- Biến môi trường mới: `STORAGE_DRIVER` (`local` hoặc `s3`), `STORAGE_DIRECTORY`, `S3_BUCKET`, `AWS_REGION`. Bỏ `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, `ZALO_APP_*`, `SMS_DRIVER` (chuyển sang Cài đặt tích hợp).
- Rủi ro:
  - Chưa thử với eSMS, Google, Microsoft, Zalo, S3 thật; chỉ thử trên bản giả lập. Phải nhập khóa và thử trên môi trường thử nghiệm trước môi trường thật.
  - Khóa trong Cài đặt tích hợp mã hóa bằng `MFA_SECRET_KEY`; đổi khóa này thì phải nhập lại mọi khóa tích hợp và đăng ký lại xác thực hai lớp.
  - Môi trường thật phải đặt `STORAGE_DRIVER=s3`; để `local` thì tệp đính kèm mất khi thay máy chủ.
  - Chưa có tác vụ dọn bảng `otp_codes`, `message_deliveries`.
  - LOI_01 còn mở.
- Khả năng tương thích: tương thích ngược với 0.1.0; dữ liệu, API cũ không đổi.
- Công việc gộp trong phiên bản: CONG_VIEC_03.
- Tag: `v0.2.0` trên commit hợp nhất nhánh `phat-hanh/v0.2.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.1.0`.
  - Database migration `0002_cong_viec_03.sql`: bản 0.1.0 không đọc các bảng mới nên có thể giữ nguyên khi quay lui mã. Chỉ xóa khi cần: sao lưu, rồi `DROP TABLE core.attachments, core.proposals, core.proposal_templates, core.message_deliveries, core.otp_codes, core.integration_settings;` và xóa dòng `0002_cong_viec_03.sql` khỏi `public.schema_migrations`.
  - Dữ liệu cần sao lưu thêm: thư mục hoặc bucket lưu tệp đính kèm; các dòng loại chứng từ `platform.proposal_*` và dãy số, chính sách duyệt của chúng do mẫu đề xuất tạo ra (giữ lại không ảnh hưởng 0.1.0).

## Phiên bản 0.1.0 – 2026-11-09 – Đã phát hành

- Chức năng mới: mini app Nền tảng (MODULE_01) trừ phần đăng nhập Google, Microsoft, Zalo, số điện thoại:
  - đăng nhập mật khẩu, phiên, xác thực hai lớp TOTP và mã dự phòng, quên và đặt lại mật khẩu, hồ sơ cá nhân;
  - công ty, chi nhánh, phòng ban; mời, kích hoạt, nhập Excel, khóa, vô hiệu hóa kèm bàn giao nhân viên;
  - vai trò, ma trận quyền, gán vai trò theo tập đoàn, công ty, chi nhánh;
  - chính sách duyệt theo hạn mức, hộp duyệt, nhắc và chuyển duyệt quá hạn;
  - dãy số chứng từ, tiền tệ và tỷ giá (lấy tự động từ Vietcombank lúc 8:30 sáng), nhật ký thao tác, thông báo trong ứng dụng;
  - giao diện tiếng Việt, tiếng Anh (MAN_HINH_01 đến 18).
- Lỗi đã sửa: LOI_02 (giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập).
- Thay đổi dữ liệu: database migration `database/migrations/0001_core.sql` tạo schema `core` (29 bảng, partition nhật ký thao tác tháng 11, 12/2026) và dữ liệu khởi tạo (tiền tệ, mini app). API tự tạo trước partition nhật ký 3 tháng khi khởi động và mỗi ngày.
- Thay đổi API: API_01, API_06 đến API_48 dưới `/api/v1` (tài liệu `17`). API_02 đến API_05 chưa có.
- Rủi ro:
  - LOI_01 còn mở: đăng nhập dưới tải 200 người dùng đồng thời chưa đạt mốc 200 ms trên máy phát triển; cần đo lại trên môi trường thử nghiệm.
  - Cần Redis cho tác vụ nền và giới hạn số yêu cầu; không có Redis thì tác vụ nền không chạy, giới hạn đếm riêng từng tiến trình.
  - Máy chủ API cần gọi ra `portal.vietcombank.com.vn`; không gọi được thì quản lý tỷ giá nhận thông báo và nhập tay.
  - Khóa `MFA_SECRET_KEY`, `ACCESS_TOKEN_SECRET` của môi trường thật phải tạo mới, khác máy phát triển.
- Khả năng tương thích: phiên bản đầu tiên, không có phiên bản trước.
- Công việc gộp trong phiên bản: CONG_VIEC_01, CONG_VIEC_02, LOI_02.
- Tag: `v0.1.0` trên commit hợp nhất nhánh `phat-hanh/v0.1.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: phiên bản đầu tiên nên quay lui là gỡ bản triển khai (dừng API, web), không có phiên bản cũ để chạy lại.
  - Database migration `0001_core.sql`: sao lưu toàn bộ cơ sở dữ liệu ngay trước khi chạy; quay lui bằng `DROP SCHEMA core CASCADE` và xóa dòng `0001_core.sql` khỏi `public.schema_migrations`, chỉ làm khi chưa có dữ liệu thật hoặc đã sao lưu và người dùng đồng ý.
  - Dữ liệu cần sao lưu thêm: không có.
