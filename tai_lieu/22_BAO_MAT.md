# 22. BẢO MẬT

- Mô tả: Dữ liệu nhạy cảm, điểm tiếp nhận dữ liệu, xác thực, ma trận phân quyền, khóa bí mật, kết quả kiểm tra, rủi ro đã chấp nhận, sự cố bảo mật.
- Phiên bản: 1.9
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): MODULE_02 phần Sản phẩm; CONG_VIEC_05 (2026-11-10): MODULE_03 Kho phần web; CONG_VIEC_06 (2026-11-10): MODULE_07 Khách hàng và Đối tác phần tối thiểu; CONG_VIEC_07 (2026-11-10): MODULE_04 Mua hàng phần 1; CONG_VIEC_08 (2026-11-10): MODULE_05 Bán hàng phần 1; CONG_VIEC_09 (2026-11-10): MODULE_05 phần 2 Giao dịch nội bộ; CONG_VIEC_12 (2026-11-10): MODULE_05 phần 3 Khuyến mãi
- Cập nhật giai đoạn 07: gắn mã API vào điểm tiếp nhận dữ liệu

Phạm vi hiện tại: MODULE_01 Nền tảng; MODULE_02 phần Sản phẩm (CONG_VIEC_04); MODULE_03 Kho phần web (CONG_VIEC_05); MODULE_07 Khách hàng và Đối tác phần tối thiểu (CONG_VIEC_06); MODULE_04 Mua hàng phần 1 (CONG_VIEC_07); MODULE_05 Bán hàng phần 1 (CONG_VIEC_08); MODULE_05 phần 2 Giao dịch nội bộ (CONG_VIEC_09); MODULE_05 phần 3 Khuyến mãi (CONG_VIEC_12). Các module sau bổ sung vào cùng tài liệu.

## 1. Dữ liệu nhạy cảm

| Dữ liệu | Loại | Cách lưu trữ | Vai trò được truy cập |
|---|---|---|---|
| Mật khẩu | Xác thực | Băm bằng argon2id | Không ai đọc được |
| Bí mật ứng dụng xác thực hai lớp (TOTP) | Xác thực | Mã hóa bằng khóa AWS KMS | Chỉ máy chủ khi kiểm tra mã |
| Mã dự phòng xác thực hai lớp (bảng `mfa_backup_codes`) | Xác thực | Băm bằng argon2id, dùng một lần | Không ai đọc được |
| Mã OTP đăng nhập bằng số điện thoại qua Zalo, SMS (bảng `otp_codes`, CONG_VIEC_03) | Xác thực | Băm SHA-256, lưu cơ sở dữ liệu, hết hạn 5 phút; sai 5 lần thì hủy; không ghi vào nhật ký gửi tin | Không ai đọc được |
| Token làm mới, đường dẫn kích hoạt, đường dẫn đặt lại mật khẩu | Xác thực | Chỉ lưu bản băm SHA-256 | Không ai đọc được |
| Email, số điện thoại, họ tên nhân viên | Cá nhân | Thường, cơ sở dữ liệu mã hóa khi lưu (Aurora) | Chính nhân viên; quản trị công ty của họ; quản trị tập đoàn |
| Địa chỉ IP, thiết bị trong phiên và nhật ký | Cá nhân | Thường, mã hóa khi lưu | Chính nhân viên (phiên của mình); quản trị xem nhật ký |
| Mã số thuế công ty | Tổ chức | Thường | Mọi nhân viên của công ty |
| Tỷ giá | Tài chính | Thường | Mọi nhân viên xem; quản lý tỷ giá sửa |
| Thông tin định danh nhà bán từ VNeID (họ tên, số định danh, ngày sinh; thông tin tổ chức) | Cá nhân, tổ chức | Mã hóa khi lưu; lưu lịch sử khai thác; không chia sẻ cho bên khác (Nghị định 69/2024/NĐ-CP Điều 18 khoản 6, 7 sửa đổi bởi Nghị định 320/2026/NĐ-CP) | Chi tiết xác định ở MODULE_02 (THAY_DOI_02) |
| Khóa bí mật hệ thống (xem mục 5) | Khóa bí mật | AWS Secrets Manager | Chỉ ứng dụng khi chạy |
| Khóa bí mật nhà cung cấp trong Cài đặt tích hợp (client secret Google, Microsoft, Zalo; API key, Secret key eSMS.vn) | Khóa bí mật | Bảng `integration_settings`, mã hóa AES-256-GCM bằng `apps/api/src/common/secret-box.ts` (khóa mã hóa như bí mật TOTP); API, giao diện, nhật ký thao tác chỉ có 4 ký tự cuối (QUYTAC_NGHIEPVU_31) | Chỉ máy chủ khi gọi nhà cung cấp; quản trị tập đoàn nhập, thay, xóa nhưng không đọc lại được |
| Nhật ký gửi tin (bảng `message_deliveries`) | Cá nhân | Số điện thoại che giữa (`+8490***4567`); không lưu nội dung mã OTP | Quản trị tập đoàn (MAN_HINH_19) |
| Nội dung đề xuất, tệp đính kèm (chứng từ gốc) | Tài chính, chứng từ | Cơ sở dữ liệu; tệp lưu AWS S3 (`STORAGE_DRIVER=s3`) hoặc thư mục cục bộ khi phát triển, theo khóa lưu trữ do hệ thống sinh | Người lập; người được giao duyệt hoặc đã duyệt; người có quyền `platform.proposal_template.manage` của công ty (QUYTAC_NGHIEPVU_36) |
| Giá bán, bảng giá, phiếu điều chỉnh giá (CONG_VIEC_04) | Kinh doanh | Cơ sở dữ liệu schema `catalog`; lịch sử giá chỉ thêm | Người có quyền `catalog.price.view` của công ty xem; chỉ người có quyền nhạy cảm `catalog.price.manage` lập phiếu |
| Sản phẩm, ảnh sản phẩm (CONG_VIEC_04) | Kinh doanh | Cơ sở dữ liệu schema `catalog`; ảnh lưu S3 hoặc thư mục cục bộ theo khóa `products/<công ty>/<sản phẩm>/<mã ngẫu nhiên>` | Người có quyền `catalog.product.view` của công ty |
| Giá vốn, giá trị tồn kho, giá trị phiếu kho, biên bản chênh lệch, tiền bồi thường (CONG_VIEC_05) | Tài chính | Cơ sở dữ liệu schema `inventory`; API trả trống khi người xem không có quyền | Người có quyền nhạy cảm `inventory.cost.view` tại kho (mọi chủ hàng) hoặc ở công ty chủ hàng (hàng của công ty đó) |
| Tồn kho, phiếu kho, thẻ kho (CONG_VIEC_05) | Kinh doanh | Cơ sở dữ liệu schema `inventory`; thẻ kho chỉ thêm | Người có quyền kho tại kho; nhân viên công ty chủ hàng có `inventory.stock.view` chỉ thấy hàng của công ty mình |
| Số Căn cước công dân của đối tác cá nhân (CONG_VIEC_06) | Cá nhân | Cột `crm.partners.citizen_id`, lưu nguyên văn trong cơ sở dữ liệu mã hóa khi lưu (Aurora); chưa mã hóa cột (làm sau cùng giải pháp khóa ở mục 5). Danh sách, chi tiết, kết quả thêm, sửa chỉ trả dạng che `*********` + 3 số cuối; nhật ký thêm, sửa chỉ ghi 3 số cuối | Người có quyền nhạy cảm `crm.partner.identity.view` ở công ty đang làm việc xem số đầy đủ qua `GET /crm/partners/{id}/identity`, mỗi lần xem ghi nhật ký `partner.view_identity` (QUYTAC_NGHIEPVU_59) |
| Đối tác: tên, mã số thuế, địa chỉ, điện thoại, email, người liên hệ, tài khoản ngân hàng (CONG_VIEC_06) | Tổ chức, cá nhân | Cơ sở dữ liệu schema `crm`; dùng chung tập đoàn | Người có `crm.partner.view` ở bất kỳ công ty nào; sửa: `crm.partner.manage` |
| Hồ sơ đối tác của công ty: hạn mức công nợ, số ngày được nợ, nhân viên phụ trách (CONG_VIEC_06) | Tài chính, kinh doanh | Bảng `crm.partner_profiles` theo công ty | Xem: người có `crm.partner.view` của chính công ty đó; lập, sửa: quyền nhạy cảm `crm.profile.manage`. Công ty khác không đọc được |
| Giá mua, bảng giá mua, giá trị đề nghị mua, đơn mua (CONG_VIEC_07) | Kinh doanh | Cơ sở dữ liệu schema `purchasing` theo công ty | Người có quyền Mua hàng của chính công ty (Thủ kho có `purchasing.order.view` thấy đơn giá trên đơn mua); công ty khác nhận `404` |
| Giá nhập, giá trị dòng phiếu nhập mua, phiếu trả hàng (CONG_VIEC_07) | Tài chính | `inventory.document_lines.unit_cost`, `cost_value` | Như giá vốn: `inventory.cost.view` (API trả trống khi không có quyền) |
| Giá bán, chiết khấu, giá trị đơn bán (CONG_VIEC_08) | Kinh doanh | Cơ sở dữ liệu schema `sales` theo công ty | Người có `sales.order.view` hoặc `sales.order.manage` của chính công ty (Thủ kho có `sales.order.view` thấy giá trên đơn bán); công ty khác nhận `404` |
| Diễn giải ngoại lệ đơn bán: dư nợ tạm tính, hạn mức công nợ, giá vốn bình quân (CONG_VIEC_08) | Tài chính | Cột `sales.orders.exceptions` (`jsonb`) | Lưu đầy đủ; API_77 chỉ trả diễn giải `credit_limit` cho người có `crm.profile.manage`, diễn giải `below_cost` cho người có `inventory.cost.view`; người khác nhận loại ngoại lệ, diễn giải trống |
| Giá trị dòng phiếu xuất giao hàng, phiếu nhận hàng trả lại (CONG_VIEC_08) | Tài chính | `inventory.document_lines.unit_cost`, `cost_value` | Như giá vốn: `inventory.cost.view` (API trả trống khi không có quyền) |
| Chứng từ đối ứng nội bộ, giá nội bộ, biên bản chênh lệch giao nhận nội bộ (CONG_VIEC_09) | Kinh doanh, tài chính | Schema `sales`, `purchasing` theo công ty; bảng `inventory.internal_discrepancies` thuộc công ty bán | Mỗi công ty chỉ thấy chứng từ của mình; chứng từ bên kia chỉ hiện tên công ty, số, trạng thái; giá trị biên bản như giá vốn (`inventory.cost.view`) |
| Chương trình khuyến mãi: ngân sách, đã dùng, điều kiện (CONG_VIEC_12) | Kinh doanh | Bảng `sales.promotions`, `sales.promotion_items`, `sales.promotion_channels`, `sales.promotion_customer_groups` theo công ty; đã dùng tính từ `sales.order_lines` | `sales.promotion.view` hoặc `sales.promotion.manage` trong công ty; không đánh dấu nhạy cảm |

## 2. Điểm tiếp nhận dữ liệu từ bên ngoài

| Điểm | Loại | Kiểm tra đầu vào | Yêu cầu xác thực |
|---|---|---|---|
| Đăng nhập mật khẩu, gửi mã OTP, đặt lại mật khẩu, kích hoạt (API_01, API_02, API_03, API_11, API_12, API_13) | API | Định dạng email, số điện thoại E.164, độ dài; giới hạn số lần thử theo địa chỉ IP và theo tài khoản | Không |
| Phản hồi đăng nhập Zalo (API_05) | Tích hợp (OAuth 2.0) | Kiểm tra `state`, mã PKCE; lấy mã định danh người dùng Zalo từ API Zalo bằng token vừa nhận | Không |
| Phản hồi đăng nhập Google, Microsoft (API_05) | Tích hợp (OpenID Connect) | Kiểm tra `state` với cookie đã ký, mã PKCE; token nhận trực tiếp từ nhà cung cấp qua kênh máy chủ – máy chủ nên không kiểm chữ ký token (CONG_VIEC_03 mục 12); chỉ dùng email đã xác minh; Microsoft chỉ tin email khi cài tenant cụ thể của công ty | Không |
| Mọi API quản trị và hồ sơ cá nhân của MODULE_01 | API | Lược đồ kiểm tra kiểu, độ dài, giá trị cho phép phía máy chủ | Có |
| Nhập nhân viên từ tệp Excel (API_27) | Tải tệp lên | Chỉ `.xlsx`, tối đa 5 MB, tối đa 1.000 dòng; đổi tên tệp; xử lý trong bộ nhớ, không lưu tệp gốc | Có |
| Gửi duyệt, quyết định duyệt (API_38, API_41, API_42) | API nội bộ, API | Lược đồ kiểm tra; mã chứng từ phải thuộc công ty của người gọi | Có |
| Lấy tỷ giá tự động | Tích hợp | Giá trị số dương, đủ cặp tiền tệ; lỗi thì không ghi | Không áp dụng (hệ thống gọi ra) |
| Cách đăng nhập khả dụng (API_54) | API | Không nhận dữ liệu; chỉ trả cờ đúng, sai, không trả mã ứng dụng | Không |
| Cài đặt tích hợp (API_49) | API | Chỉ nhận khóa cài đặt trong danh sách khai báo, giá trị tối đa 2.000 ký tự; trường thừa bị từ chối | Có, quyền nhạy cảm `platform.integration.manage` phạm vi tập đoàn |
| Mẫu đề xuất, đề xuất (API_50, API_51) | API | Lược đồ zod cho mẫu; giá trị đề xuất kiểm tra theo kiểu từng trường của bản chụp mẫu (số, tiền, ngày, danh sách chọn, chữ tối đa 500 ký tự, đoạn văn tối đa 5.000 ký tự, bảng chi tiết tối đa 100 dòng); chỉ giữ trường có trong mẫu | Có |
| Tải tệp đính kèm lên (API_52) | Tải tệp lên | Một tệp mỗi lần; tối đa 10 MB, 10 tệp mỗi đề xuất; đuôi `pdf`, `jpg`, `jpeg`, `png`, `xlsx`, `docx` và chữ ký đầu tệp phải khớp đuôi; tên tệp thay ký tự `\`, `/`, xuống dòng, dấu nháy kép bằng `_`, giữ tối đa 200 ký tự cuối; khóa lưu trữ do hệ thống sinh, không dùng tên tệp người dùng; tải về kèm `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` | Có |
| Mọi API mini app Sản phẩm (API_55 đến API_62) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn phải là UUID; giới hạn số phần tử (3 thuộc tính phân loại, 200 biến thể, 5 đơn vị quy đổi, 20 mã vạch mỗi biến thể, 5.000 dòng mỗi phiếu điều chỉnh giá) | Có, `catalog.access` và quyền chi tiết |
| Tải ảnh sản phẩm lên (API_57) | Tải tệp lên | Một tệp mỗi lần; tối đa 5 MB (multer cắt ở 10 MB), 10 ảnh mỗi sản phẩm; đuôi `jpg`, `jpeg`, `png`, `webp` và chữ ký đầu tệp phải khớp (`FF D8 FF`, `89 50 4E 47`, `RIFF....WEBP`); loại nội dung lưu theo loại đã kiểm; tên tệp thay `\`, `/`, xuống dòng, dấu nháy kép bằng `_`, giữ tối đa 200 ký tự cuối; khóa lưu trữ do hệ thống sinh; tải về kèm `X-Content-Type-Options: nosniff`, `Cache-Control: private` | Có |
| Nhập sản phẩm, nhập dòng phiếu điều chỉnh giá từ Excel (API_58, API_62) | Tải tệp lên | Chỉ `.xlsx` đọc bằng `read-excel-file`; tối đa 5 MB (multer cắt ở 10 MB), 2.000 dòng; dòng tiêu đề phải đúng mẫu; xử lý trong bộ nhớ, không lưu tệp gốc; tệp lỗi trả về dạng `data:` | Có |
| Mọi API mini app Kho (API_63 đến API_70) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, danh sách `variantIds` phải là UUID; số lượng, tiền dạng chuỗi tối đa 12 (số lượng) hoặc 16 (tiền) chữ số phần nguyên, 4 chữ số lẻ; giới hạn số phần tử (1.000 dòng mỗi phiếu, 5.000 serial mỗi dòng, 500 vị trí mỗi lần thêm, 5.000 dòng đếm mỗi lần, 500 bản tem); không nhận tệp tải lên | Có, `inventory.access` hoặc `inventory.stock.view` và quyền chi tiết tại kho |
| Mọi API mini app Khách hàng và Đối tác (API_71, API_72) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, `customerGroupId`, `ownerUserId` phải là UUID; mã số thuế `^[0-9]{10}(-[0-9]{3})?$`, số Căn cước công dân `^[0-9]{12}$`, email đúng định dạng, số tài khoản 4 đến 30 ký tự chữ, số, `-`; độ dài tên 300, địa chỉ 500, ghi chú 1.000 ký tự; tối đa 50 người liên hệ, 20 tài khoản ngân hàng; từ khóa tìm tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; hạn mức công nợ tối đa 16 chữ số phần nguyên, 4 chữ số lẻ, không âm; không nhận tệp tải lên | Có, `crm.access` hoặc `crm.partner.view` và quyền chi tiết ở công ty đang làm việc |
| Mọi API mini app Mua hàng, nhập mua, trả hàng nhà cung cấp (API_73 đến API_76) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, mã nhà cung cấp, mặt hàng, đơn vị, kho, dòng phải là UUID; số lượng chuỗi tối đa 12 chữ số phần nguyên, tiền tối đa 16, 4 chữ số lẻ; dung sai 0 đến 100, 2 chữ số lẻ; tối đa 200 dòng mỗi chứng từ, 1.000 serial mỗi dòng; từ khóa tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; lý do 500, ghi chú 1.000 ký tự; không nhận tệp tải lên | Có, `purchasing.access`, `purchasing.order.view` hoặc `purchasing.requisition.create` (API_73 đến API_75); quyền vào mini app Kho và `inventory.purchase.receive` tại kho (API_76) |
| Mọi API mini app Bán hàng, giao hàng, nhận hàng trả lại (API_77 đến API_79) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, mã khách, kênh, kho, mặt hàng, đơn vị, lô, vị trí, dòng phải là UUID; số lượng chuỗi tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, lớn hơn 0; chiết khấu 0 đến 100, 2 chữ số lẻ; tối đa 200 dòng mỗi chứng từ, 1.000 serial mỗi dòng (100 ký tự mỗi serial); từ khóa tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; tên người mua 200, địa chỉ giao 500, lý do 500, ghi chú 1.000 ký tự; giá dòng không nhận từ người dùng mà tra theo bảng giá phía máy chủ; không nhận tệp tải lên | Có, `sales.access` hoặc `sales.order.view` (API_77, API_78); quyền vào mini app Kho và `inventory.sales.issue` tại kho (API_79) |
| API giao dịch nội bộ (API_80 đến API_82) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, kho, dòng, vị trí là UUID; lý do từ chối 1 đến 500 ký tự; số nhận từ 0, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ; tối đa 200 dòng, 5.000 serial mỗi dòng (100 ký tự mỗi serial); lý do thiếu, ghi chú tối đa 500 ký tự; `action` chỉ `return`, `write_off`; phiên bản số nguyên dương | Có |
| API khuyến mãi (API_83) | API | Lược đồ zod `savePromotionSchema`, `stopPromotionSchema`, `promotionListQuerySchema` trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, mặt hàng, kênh, nhóm khách là UUID; tên 1 đến 200 ký tự, ghi chú tối đa 1.000, lý do dừng 1 đến 500; tối đa 500 mặt hàng, 50 kênh, 50 nhóm khách; phần trăm lớn hơn 0 đến 100; số tiền, số lượng dạng chuỗi số dương; máy chủ kiểm mặt hàng, kênh (không phải Nội bộ), nhóm khách thuộc công ty, đang dùng | Có |
| Gửi tin qua eSMS.vn (mã OTP, Zalo ZNS, kiểm tra kết nối) | Tích hợp | Chỉ đọc mã kết quả, mã tin, lỗi; gửi lỗi không chặn nghiệp vụ | Không áp dụng (hệ thống gọi ra) |

## 3. Xác thực và phiên đăng nhập

- Cách xác thực: mật khẩu; Google Workspace, Microsoft 365 (OpenID Connect); Zalo (OAuth 2.0, chỉ tài khoản đã liên kết); số điện thoại kèm mã OTP. Xác thực hai lớp bằng TOTP hoặc mã OTP qua SMS, email; bắt buộc theo QUYTAC_NGHIEPVU_09.
- Thời hạn phiên đăng nhập: token truy cập 15 phút; token làm mới 30 ngày (web), 90 ngày (ứng dụng kho, ứng dụng kinh doanh); token làm mới đổi mới mỗi lần dùng, phát hiện dùng lại token cũ thì thu hồi cả chuỗi phiên.
- Lưu phiên trên web: cookie `HttpOnly`, `Secure`, `SameSite=Lax`; thao tác ghi kèm chống giả mạo yêu cầu (CSRF token).
- Giới hạn số lần thử: mật khẩu sai 5 lần liên tiếp khóa 15 phút; mã OTP sai 5 lần thì hủy mã; gửi mã OTP tối đa 5 lần mỗi giờ mỗi số; mọi API không cần đăng nhập giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP.
- Đăng nhập bằng nhà cung cấp (CONG_VIEC_03): OpenID Connect (Google, Microsoft) và Zalo OAuth v4 đều dùng PKCE (S256) và `state` ngẫu nhiên; `state`, `code_verifier`, chế độ, người liên kết lưu trong cookie `vc_oauth` `HttpOnly`, `SameSite=Lax`, đường dẫn `/api/v1/auth/oauth`, ký bằng khóa ký token truy cập, hết hạn 10 phút; phản hồi không khớp cookie thì từ chối. Liên kết tài khoản cần phiên đăng nhập còn hiệu lực đã qua xác thực hai lớp. Không tự tạo tài khoản (QUYTAC_NGHIEPVU_08). Sau đăng nhập bằng nhà cung cấp hoặc mã OTP vẫn qua bước xác thực hai lớp khi tài khoản bắt buộc.
- Gửi mã OTP luôn trả cùng kết quả dù số có tài khoản hay không; số lần gửi đếm cả với số không có tài khoản để không lộ số nào có tài khoản. Máy chưa cài eSMS chỉ in mã thử ra log khi không phải môi trường thật.
- In đề xuất PDF: `pdfmake` chặn mọi đường dẫn ngoài (`setUrlAccessPolicy` luôn từ chối) và chỉ cho đọc tệp trong thư mục phông của gói.

## 4. Ma trận phân quyền

Vai trò theo tài liệu `08`. Mọi API kiểm tra quyền phía máy chủ và lọc dữ liệu theo phạm vi ngay trong câu truy vấn (QUYTAC_NGHIEPVU_12).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý tỷ giá | Nhân viên | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_01 Quản lý công ty | Được | Không | Không | Không | Không |
| CHUC_NANG_02 Quản lý chi nhánh | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_03 Quản lý phòng ban | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_04, CHUC_NANG_05 Mời, nhập nhân viên | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08 Đăng nhập | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Xác thực hai lớp (của mình) | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Đặt lại xác thực hai lớp người khác | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_10 Hồ sơ cá nhân | Được | Được | Được | Được | Có |
| CHUC_NANG_11 Chuyển công ty | Được | Được | Được | Được | Có |
| CHUC_NANG_12 Quản lý vai trò | Được, cả vai trò dùng chung | Vai trò riêng công ty mình | Không | Không | Không |
| CHUC_NANG_13 Gán vai trò | Mọi phạm vi | Công ty mình, chi nhánh của công ty mình; xem danh sách vai trò để chọn (THAY_DOI_05) | Không | Không | Không |
| CHUC_NANG_14 Trang chủ mini app | Được | Được | Được | Được | Có |
| CHUC_NANG_15 Chính sách duyệt | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_16, CHUC_NANG_17 Duyệt chứng từ, hộp duyệt | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Có |
| CHUC_NANG_19 Khóa, vô hiệu hóa nhân viên | Được | Trong công ty mình, trừ chính mình | Không | Không | Không |
| CHUC_NANG_20 Dãy số chứng từ | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_21 Tỷ giá (sửa) | Được | Không | Được | Không | Không |
| CHUC_NANG_21 Tỷ giá (xem) | Được | Được | Được | Được | Không |
| CHUC_NANG_22 Đổi ngôn ngữ | Được | Được | Được | Được | Có |
| CHUC_NANG_23 Nhật ký thao tác | Toàn tập đoàn | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_25 Cài đặt tích hợp (gồm nhật ký gửi tin) | Được (quyền ở phạm vi tập đoàn) | Không | Không | Không | Không |
| CHUC_NANG_27 Mẫu đề xuất | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_28 Lập, sửa, gửi, rút đề xuất | Được | Được | Được | Được | Có |
| CHUC_NANG_28, CHUC_NANG_29 Xem, tải tệp, in PDF đề xuất của người khác | Được (quản lý mẫu đề xuất) | Trong công ty mình (quản lý mẫu đề xuất) | Khi được giao duyệt hoặc đã duyệt | Khi được giao duyệt hoặc đã duyệt | Không |

### Ma trận phân quyền MODULE_02 phần Sản phẩm (CONG_VIEC_04)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `catalog.access` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.category.manage` | Tập đoàn (chỉ có hiệu lực khi gán ở phạm vi tập đoàn) | Không | Quản trị tập đoàn |
| `catalog.product.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.product.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.manage` | Công ty | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý sản phẩm" (`catalog_manager`): `catalog.access`, `catalog.product.view`, `catalog.product.manage`, `catalog.price.view`. Loại chứng từ mới `catalog.price_change` "Phiếu điều chỉnh giá" (cần duyệt).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý sản phẩm | Nhân viên | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_30 Ngành hàng, đơn vị tính (xem) | Được | Được | Được | Không | Không |
| CHUC_NANG_30 Ngành hàng, đơn vị tính (sửa) | Được (quyền ở phạm vi tập đoàn) | Không | Không | Không | Không |
| CHUC_NANG_31, CHUC_NANG_32, CHUC_NANG_33 Sản phẩm, nhập Excel | Được | Trong công ty mình | Trong công ty được gán | Không | Không |
| CHUC_NANG_34 Liên kết, sao chép giữa công ty | Khi có `catalog.product.manage` ở cả hai công ty | Như bên trái | Như bên trái | Không | Không |
| CHUC_NANG_35 Kênh bán, nhóm khách (sửa) | Được | Trong công ty mình | Không (chỉ xem qua API) | Không | Không |
| CHUC_NANG_36 Bảng giá (xem, tra giá) | Được | Trong công ty mình | Trong công ty được gán | Không | Không |
| CHUC_NANG_36 Bảng giá (sửa) | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_37 Lập, sửa, gửi, rút phiếu điều chỉnh giá | Được | Trong công ty mình | Không | Không | Có (chỉ người lập sửa, xóa, gửi, rút) |
| CHUC_NANG_37 Duyệt phiếu điều chỉnh giá | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt, QUYTAC_NGHIEPVU_20) |

Ranh giới và kiểm soát riêng:
- Dữ liệu theo công ty: mọi truy vấn sản phẩm, biến thể, ảnh, mã vạch, kênh, nhóm khách, bảng giá, phiếu có điều kiện `company_id` của công ty đang làm việc; sản phẩm, ảnh, bảng giá, phiếu của công ty khác trả `404 NOT_FOUND` như không tồn tại (KICHBAN_KIEMTHU_136, KICHBAN_KIEMTHU_139). Sản phẩm nhà bán (`seller_id` khác trống) không trả qua API sản phẩm của công ty. Mã hàng, mã vạch chỉ duy nhất trong công ty nên không lộ dữ liệu công ty khác qua lỗi trùng.
- Ảnh qua thẻ `img` nhận `?companyId=` thay header; máy chủ vẫn kiểm tra nhân viên thuộc công ty đó và có `catalog.product.view`.
- Liên kết, bỏ liên kết, sao chép giữa công ty: kiểm tra `catalog.product.manage` ở cả công ty đang làm việc và công ty bên kia; gợi ý theo mã vạch kiểm tra `catalog.product.view` ở cả hai công ty (QUYTAC_NGHIEPVU_41).
- Ngành hàng, đơn vị tính dùng chung: quyền sửa chỉ tính khi gán ở phạm vi tập đoàn, quản trị công ty không tự cấp được.
- Giá chỉ đổi qua phiếu điều chỉnh giá (QUYTAC_NGHIEPVU_44): không có API sửa, xóa bảng `catalog.prices`; giá chỉ ghi khi gửi (công ty chưa có chính sách duyệt) hoặc khi nhận sự kiện duyệt xong; quyền lập phiếu là quyền nhạy cảm; người lập không tự duyệt. Bảng `catalog.prices` chưa có trigger chặn sửa, xóa ở tầng cơ sở dữ liệu.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `catalog` (dữ liệu trước và sau).

### Ma trận phân quyền MODULE_03 Kho (CONG_VIEC_05)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `inventory.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `inventory.access` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.warehouse.manage` | Công ty (thêm kho, cài đặt); công ty hoặc chi nhánh (sửa kho, vị trí) | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.stock.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.cost.view` | Công ty, chi nhánh | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.document.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.stocktake.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.reservation.manage` (gồm tồn an toàn) | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |

Vai trò hệ thống mới "Thủ kho" (`warehouse_keeper`): `inventory.access`, `inventory.stock.view`, `inventory.document.manage`. "Quản lý kho" (`warehouse_manager`): mọi quyền `inventory.*`. Loại chứng từ mới cần duyệt: `inventory.receipt_other`, `inventory.issue_other`, `inventory.adjustment`, `inventory.transfer`; không duyệt: `inventory.stocktake`.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý kho | Thủ kho | Nhân viên công ty chủ hàng có `inventory.stock.view` | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_38 Thêm kho, cài đặt | Được | Trong công ty mình | Khi gán ở phạm vi công ty | Không | Không | Không |
| CHUC_NANG_38 Sửa kho, vị trí | Được | Kho của công ty mình | Kho trong phạm vi gán | Không | Không | Không |
| CHUC_NANG_39 Xem tồn, thẻ kho | Được | Kho của công ty mình (mọi chủ hàng); hàng công ty mình ở kho khác | Kho trong phạm vi gán | Kho trong phạm vi gán | Chỉ hàng của công ty mình | Không |
| CHUC_NANG_39 Xem giá vốn, giá trị | Được | Được | Được | Không | Khi có `inventory.cost.view` ở công ty mình | Không |
| CHUC_NANG_40, CHUC_NANG_41 Lập, gửi, rút phiếu; xuất, nhận chuyển kho | Được | Kho của công ty mình | Kho trong phạm vi gán | Kho trong phạm vi gán | Không (chỉ xem phiếu của công ty mình) | Có (chỉ người lập sửa, xóa, gửi, rút) |
| CHUC_NANG_40, CHUC_NANG_41 Duyệt phiếu kho | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt, QUYTAC_NGHIEPVU_20) |
| CHUC_NANG_42 Kiểm kê | Được | Kho của công ty mình | Kho trong phạm vi gán | Không | Không | Không |
| CHUC_NANG_43, CHUC_NANG_44 Giữ hàng, tồn an toàn | Được | Kho của công ty mình | Kho trong phạm vi gán | Chỉ xem | Không | Không |
| CHUC_NANG_45 In tem | Được | Được | Được | Được | Không | Không |

Ranh giới và kiểm soát riêng:
- Phạm vi theo chi nhánh sở hữu kho (QUYTAC_NGHIEPVU_46): quyền tại kho tính từ lần gán ở tập đoàn, ở công ty sở hữu kho hoặc ở chi nhánh của kho (`warehousePermissions` trong `apps/api/src/inventory/inventory-context.ts`). Người chỉ có quyền ở chi nhánh khác nhận `404` như kho không tồn tại (KICHBAN_KIEMTHU_147). Danh sách tồn, phiếu, kiểm kê, hàng giữ, tồn an toàn lọc theo danh sách kho trong điều kiện của câu truy vấn.
- Công ty chủ hàng chỉ xem: nhân viên công ty chủ hàng không có quyền tại kho chỉ nhận dòng tồn, phiếu có `company_id` của công ty đang làm việc; không lập phiếu, không thao tác kho (KICHBAN_KIEMTHU_147, KICHBAN_KIEMTHU_152). Phiếu chỉ nhận sản phẩm của công ty chủ hàng; kho phải nhận hàng của công ty đó.
- Giá vốn là thông tin nhạy cảm: giá vốn, giá trị tồn, giá trị dòng phiếu, giá trị thẻ kho, giá vốn serial, giá trị biên bản chênh lệch, giá trị chênh lệch kiểm kê, tiền bồi thường trả `null` khi người xem không có `inventory.cost.view` (KICHBAN_KIEMTHU_148, KICHBAN_KIEMTHU_154). Giá trị duyệt vẫn gửi sang yêu cầu duyệt cho người duyệt.
- Chống tồn âm, đồng thời: sổ kho khóa dòng `costs` rồi dòng `balances` (`SELECT ... FOR UPDATE`) theo thứ tự khóa cố định (kho, chủ hàng, biến thể, lô, vị trí) trong giao dịch của phiếu; giữ hàng khóa dòng `costs` trước khi tính tồn khả dụng; cột `quantity` của `balances`, `costs` có ràng buộc không âm ở cơ sở dữ liệu (KICHBAN_KIEMTHU_149).
- Thẻ kho chỉ thêm: trigger `movements_append_only` chặn `UPDATE`, `DELETE` trên `inventory.movements` ở tầng cơ sở dữ liệu (KICHBAN_KIEMTHU_148); sai thì lập phiếu khác.
- Kiểm kê khóa mặt hàng đang đếm: sổ kho từ chối ghi vào mặt hàng (và vị trí) trong phạm vi kiểm kê đang đếm, trừ phiếu điều chỉnh của chính kiểm kê đó.
- Tem PDF: `pdfmake` chặn tải tài nguyên qua URL và chỉ đọc tệp phông trong thư mục phông của thư viện; nội dung tem chỉ gồm ký tự ASCII.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `inventory` (kho, vị trí, cài đặt, phiếu, xuất, nhận, kiểm kê, giữ hàng, tồn an toàn); ghi sổ sau duyệt và tác vụ nền nhả hàng giữ không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_07 Khách hàng và Đối tác (CONG_VIEC_06)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `crm.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `crm.partner.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác, Thủ kho |
| `crm.partner.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác |
| `crm.partner.identity.view` | Công ty | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty |
| `crm.profile.manage` | Công ty | Có (hạn mức công nợ; bắt buộc xác thực hai lớp) | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý đối tác" (`partner_manager`): `crm.access`, `crm.partner.view`, `crm.partner.manage`. Vai trò "Thủ kho" có thêm `crm.partner.view`.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý đối tác | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_46 Xem, tìm đối tác (số Căn cước công dân che) | Được | Được | Được | Được | Không |
| CHUC_NANG_46 Thêm, sửa, ngừng giao dịch đối tác bên ngoài | Được | Được | Được | Không | Không |
| CHUC_NANG_46 Xem đầy đủ số Căn cước công dân | Được, ghi nhật ký | Được, ghi nhật ký | Không | Không | Không |
| CHUC_NANG_47 Sửa đối tác nội bộ | Không (sửa ở màn hình Công ty) | Không | Không | Không | Không |
| CHUC_NANG_48 Lập, sửa hồ sơ đối tác của công ty | Được | Trong công ty mình | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Đối tác dùng chung tập đoàn: không lọc theo công ty; người có `crm.partner.manage` ở bất kỳ công ty nào sửa được thông tin chung (QUYTAC_NGHIEPVU_57), nhật ký ghi công ty của người sửa và dữ liệu trước, sau (KICHBAN_KIEMTHU_161). Không có API xóa đối tác.
- Số Căn cước công dân là dữ liệu cá nhân (QUYTAC_NGHIEPVU_59): không trả trong danh sách, chi tiết, kết quả thêm, sửa (KICHBAN_KIEMTHU_163 kiểm nội dung trả về không chứa số đầy đủ); nhật ký thêm, sửa thay số bằng `***` + 3 số cuối; xem đầy đủ cần quyền nhạy cảm, mỗi lần gọi ghi nhật ký `partner.view_identity` không kèm số; giao diện chỉ gọi khi người dùng bấm "Xem đầy đủ". Sửa đối tác cá nhân không cần xem số đầy đủ (để trống là giữ số cũ). Hạn mức công nợ chỉ trả cho người có quyền nhạy cảm `crm.profile.manage`; người khác nhận `creditLimitHidden: true`.
- Hồ sơ đối tác theo công ty: truy vấn hồ sơ luôn có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `profile: null`, bộ lọc khách hàng, nhà cung cấp chỉ theo hồ sơ của công ty mình (KICHBAN_KIEMTHU_164). Nhóm khách hàng, nhân viên phụ trách phải thuộc công ty đang làm việc.
- Đối tác nội bộ chỉ do hệ thống đồng bộ từ `core.companies`; API từ chối sửa, đổi trạng thái (KICHBAN_KIEMTHU_162).
- Kiểm trùng (`lookup`) trả mã, tên đối tác khi biết đúng mã số thuế (người có `crm.partner.view`) hoặc đúng số Căn cước công dân (chỉ người có `crm.partner.manage`, tránh dò tìm danh tính; KICHBAN_KIEMTHU_163); không trả số Căn cước công dân.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `crm` (thêm, sửa, ngừng giao dịch, giao dịch lại đối tác, lưu hồ sơ) và mỗi lần xem số Căn cước công dân; đồng bộ đối tác nội bộ không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_04 Mua hàng phần 1 (CONG_VIEC_07)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `purchasing.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `purchasing.price.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.requisition.create` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.purchase.receive` | Công ty, chi nhánh sở hữu kho | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

Vai trò hệ thống mới "Nhân viên mua hàng" (`purchaser`): `purchasing.access`, `purchasing.price.manage`, `purchasing.requisition.create`, `purchasing.order.view`, `purchasing.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`. Vai trò "Thủ kho" có thêm `inventory.purchase.receive`, `purchasing.access`, `purchasing.requisition.create`, `purchasing.order.view`. Loại chứng từ mới: `purchasing.requisition`, `purchasing.order` (cần duyệt); `inventory.purchase_receipt`, `inventory.purchase_return` (không cần duyệt, có chứng từ gốc).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên mua hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_49 Xem bảng giá mua | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_49 Thêm, sửa, ngừng dùng giá mua | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_50 Lập, sửa, gửi, rút đề nghị mua | Được | Trong công ty mình | Được | Được (gán ở chi nhánh vẫn dùng được) | Không | Có (sửa, gửi, rút chỉ người lập) |
| CHUC_NANG_50 Đóng đề nghị mua | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_51 Xem đơn mua | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_51 Lập, sửa, gửi, đóng đơn mua | Được | Trong công ty mình | Được | Không | Không | Có (rút chỉ người lập) |
| CHUC_NANG_51 Cài đặt dung sai | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_52, CHUC_NANG_53 Nhập mua, kiểm tra chất lượng, trả hàng | Được | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Có (sửa, gửi, xóa nháp chỉ người lập) |
| CHUC_NANG_50, CHUC_NANG_51 Duyệt đề nghị mua, đơn mua | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt) |

Ranh giới và kiểm soát riêng:
- Dữ liệu Mua hàng theo công ty: mọi truy vấn bảng giá, đề nghị, đơn mua có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `404`, danh sách trống, đóng đơn của công ty khác bị từ chối (KICHBAN_KIEMTHU_165, KICHBAN_KIEMTHU_167).
- Quyền theo chi nhánh: chỉ `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh được dùng trong cả công ty (thủ kho chi nhánh xem được mọi đơn mua của công ty, gồm đơn giá); quyền lập, sửa, đóng đơn, bảng giá, cài đặt cần lần gán ở tập đoàn hoặc công ty.
- Nhận hàng theo kho: phiếu nhập mua, trả hàng kiểm `inventory.purchase.receive` tại kho nhận của đơn hoặc kho của phiếu gốc; thủ kho chi nhánh khác không thấy đơn trong danh sách cần nhận, không lập phiếu (KICHBAN_KIEMTHU_168).
- Chống nhận vượt, trả vượt khi đồng thời: gửi phiếu nhập khóa dòng đơn mua (`FOR UPDATE`) rồi kiểm dung sai; gửi phiếu trả khóa dòng phiếu nhập gốc; giá mua kiểm chồng hiệu lực khi giữ khóa tư vấn.
- Phiếu mua không lập, không sửa qua API phiếu kho thường (`POST`, `PATCH /inventory/documents` từ chối loại `purchase_receipt`, `purchase_return`).
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `purchasing` (giá mua, cài đặt, đề nghị, đơn mua) và của phiếu nhập mua, trả hàng (lập, sửa, gửi, kiểm tra chất lượng); chuyển trạng thái sau duyệt, chuyển "Đã nhận đủ" không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_05 Bán hàng phần 1 (CONG_VIEC_08)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `sales.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `sales.order.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho |
| `sales.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.sales.issue` | Công ty, chi nhánh sở hữu kho | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

Vai trò hệ thống mới "Nhân viên bán hàng" (`salesperson`): `sales.access`, `sales.order.view`, `sales.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view`. Vai trò "Thủ kho" có thêm `inventory.sales.issue`, `sales.access`, `sales.order.view`. Loại chứng từ mới: `sales.order` (cần duyệt khi có ngoại lệ); `inventory.sales_issue`, `inventory.sales_return` (không cần duyệt, có chứng từ gốc).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_54 Xem đơn bán | Được | Trong công ty mình | Được | Được (gán ở chi nhánh vẫn dùng được) | Không | Không |
| CHUC_NANG_54 Tra giá, lập, sửa, gửi, hủy, đóng đơn bán | Được | Trong công ty mình | Được | Không | Không | Có (rút chỉ người lập) |
| CHUC_NANG_54 Xem số trong diễn giải ngoại lệ hạn mức công nợ, giá vốn | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_55 Cài đặt chiết khấu tay tối đa | Được | Trong công ty mình | Không (xem được) | Không (xem được) | Không | Không |
| CHUC_NANG_56, CHUC_NANG_57 Giao hàng, nhận hàng trả lại | Được | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Có (gửi, xóa nháp chỉ người lập) |
| CHUC_NANG_54 Duyệt đơn bán có ngoại lệ | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt) |

Ranh giới và kiểm soát riêng:
- Dữ liệu Bán hàng theo công ty: mọi truy vấn đơn bán, cài đặt có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `404`, danh sách trống; hủy, đóng đơn của công ty khác bị từ chối (KICHBAN_KIEMTHU_173, KICHBAN_KIEMTHU_179).
- Quyền theo chi nhánh: chỉ `sales.order.view` gán ở chi nhánh được dùng trong cả công ty (thủ kho chi nhánh xem được mọi đơn bán của công ty, gồm giá bán, chiết khấu); quyền lập, sửa, hủy, đóng, tra giá, cài đặt cần lần gán ở tập đoàn hoặc công ty (`apps/api/src/sales/sales-context.ts`).
- Giao hàng theo kho: phiếu xuất giao hàng, nhận hàng trả lại kiểm `inventory.sales.issue` tại kho xuất của đơn hoặc kho của phiếu gốc; thủ kho chi nhánh khác không thấy đơn trong danh sách cần giao, không lập phiếu (KICHBAN_KIEMTHU_174).
- Giá không do người dùng gửi: đơn giá dòng luôn tra theo bảng giá phía máy chủ khi lưu; người dùng chỉ gửi chiết khấu phần trăm, vượt mức thì phải duyệt.
- Che hạn mức công nợ, giá vốn: hạn mức công nợ là dữ liệu chỉ người có `crm.profile.manage` xem (CONG_VIEC_06), giá vốn chỉ người có `inventory.cost.view` xem; diễn giải ngoại lệ chứa các số này nên API_77 trả chuỗi trống cho người không có quyền tương ứng, giao diện chỉ hiện loại ngoại lệ (KICHBAN_KIEMTHU_178). Người duyệt đơn bán xem đơn qua MAN_HINH_43 cũng theo quyền của mình.
- Chống bán trùng, giao vượt, trả vượt khi đồng thời: gửi đơn khóa đơn (`FOR UPDATE`) và hồ sơ khách (hai đơn cùng khách không cùng lọt hạn mức), giữ hàng khóa dòng giá vốn theo thứ tự mã mặt hàng; gửi phiếu xuất khóa đơn bán rồi kiểm số còn phải giao, dùng hàng giữ theo thứ tự mã mặt hàng; gửi phiếu trả khóa các dòng phiếu xuất gốc bằng câu lệnh riêng (theo thứ tự mã) trước khi tính số đã trả; kiểm hàng khả dụng khi gửi phiếu đọc trong cùng giao dịch (KICHBAN_KIEMTHU_181).
- Phiếu bán hàng không lập, không sửa qua API phiếu kho thường (`POST`, `PATCH /inventory/documents` từ chối loại `sales_issue`, `sales_return`).
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `sales` (lập, sửa, gửi, hủy, đóng đơn; cài đặt) và của phiếu xuất giao hàng, nhận hàng trả lại (lập, gửi, xóa nháp); rút đơn ghi ở luồng duyệt (`approval_request.withdraw`); chuyển trạng thái sau duyệt, chuyển "Đã giao đủ" không ghi nhật ký riêng.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Đã sửa trong mã: diễn giải ngoại lệ ban đầu trả nguyên số hạn mức công nợ, dư nợ, giá vốn bình quân cho mọi người xem đơn (Nhân viên bán hàng, Thủ kho); nay che theo quyền như trên.
- Ghi nhận (đúng phạm vi vận hành kho): `GET /inventory/sales-orders`, `GET /inventory/sales-orders/{id}` lọc theo kho người dùng có `inventory.sales.issue`, không lọc theo công ty đang làm việc; kho dùng chung nhiều công ty chủ hàng thì thủ kho thấy đơn đã xác nhận của các công ty chủ hàng đó (đúng phạm vi vận hành kho, như nhập mua). Đã sửa: `GET /inventory/sales-orders/{id}` chỉ trả đơn đã xác nhận, đã giao đủ, đã đóng; đơn khác trả `404`.
- Không có mục rủi ro cao còn mở.

### Ma trận phân quyền giao dịch nội bộ MODULE_05 phần 2 (CONG_VIEC_09)

Không thêm quyền, vai trò, loại chứng từ. Mỗi bên dùng quyền của mình tại công ty mình (tài liệu `08` mục 12).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Nhân viên mua hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_58, CHUC_NANG_59 Xác nhận, từ chối đơn bán đối ứng | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_58, CHUC_NANG_59 Xác nhận, từ chối đơn mua đối ứng | Được | Trong công ty mình | Không | Được | Không | Không | Không |
| CHUC_NANG_60 Nhận hàng nội bộ | Được | Kho của công ty mình | Không | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Không |
| CHUC_NANG_61 Xem, xử lý biên bản chênh lệch | Được | Kho của công ty mình | Không | Không | Kho xuất trong phạm vi gán | Kho xuất trong phạm vi gán | Không |
| CHUC_NANG_61 Xem giá trị biên bản | Được | Trong công ty mình | Không | Không | Không | Được | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu hai công ty: xác nhận, từ chối, xem đơn chỉ trong công ty đang làm việc (`company_id`); công ty bán không mở được đơn mua của công ty mua (`404`, KICHBAN_KIEMTHU_187). Chứng từ đối ứng trong phản hồi chỉ có tên ngắn công ty, số, trạng thái. Biên bản chênh lệch chỉ trả cho công ty bán (công ty mua nhận danh sách rỗng, KICHBAN_KIEMTHU_189).
- Sinh, kết thúc chứng từ bên kia do hệ thống làm trong cùng giao dịch của thao tác hợp lệ ở bên khởi tạo, không kiểm quyền người gọi ở công ty bên kia; người gọi chỉ quyết định được chứng từ của công ty mình, bên kia vẫn phải xác nhận bằng quyền của họ.
- Giá không do người dùng gửi: đơn mua nội bộ bỏ đơn giá, thuế suất gửi lên, lấy theo bảng giá kênh Nội bộ bên bán; đơn đối ứng lấy giá theo chứng từ khởi tạo; đơn đối ứng và đơn mua nội bộ đã có đơn đối ứng không sửa được.
- Nhận hàng: số nhận không vượt số xuất, serial chỉ trong serial đã xuất; khóa phiếu theo phiên bản để không nhận hai lần; đơn mua nội bộ không nhập mua thường được (tránh nhập trùng).
- Biên bản: giữ biên bản (`status = 'open'`, đúng phiên bản) trước khi nhập lại kho để hai người không cùng nhập lại; giá trị chỉ trả cho người có `inventory.cost.view`.
- Nhật ký thao tác: `sales_order.counterpart_confirm`, `.counterpart_reject`, `purchase_order.counterpart_confirm`, `.counterpart_reject`, `stock_document.receive_internal`, `internal_discrepancy.resolve`; sinh, kết thúc chứng từ bên kia không ghi nhật ký riêng, lý do ghi trên chứng từ.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở.
- Ghi nhận, chưa sửa: hai bên hủy, đóng cùng lúc (ví dụ bên bán hủy đơn bán trong khi bên mua đóng đơn mua đối ứng) khóa hai đơn theo thứ tự ngược nhau, có thể khóa chéo; PostgreSQL hủy một giao dịch, người gọi nhận lỗi `500`, dữ liệu không hỏng, thao tác lại được.
- Ghi nhận, chưa sửa: đơn giá dòng đơn mua đối ứng làm tròn 4 chữ số (tiền chưa thuế dòng đơn bán chia số lượng bên mua), tổng đơn mua có thể lệch vài đồng lẻ so với đơn bán.
- Ghi nhận (đúng phạm vi vận hành kho): kho dùng chung nhiều công ty chủ hàng thì thủ kho có `inventory.purchase.receive` tại kho (kể cả thủ kho công ty bán) thấy và nhận được phiếu nhập nội bộ của công ty mua ở kho đó, như phiếu kho khác (QUYTAC_NGHIEPVU_46).
- Ghi nhận: giá bảng giá kênh Nội bộ của công ty bán hiện cho người lập đơn mua ở công ty mua (theo QUYTAC_NGHIEPVU_75). Trước khi xác nhận, đơn đối ứng hiện người lập là người lập chứng từ khởi tạo ở công ty kia (họ tên).
- Ghi nhận: "Nhập lại kho" giữ biên bản rồi lập, ghi sổ phiếu trả ở giao dịch riêng; lỗi thì trả biên bản về "Chờ xử lý", nhưng máy chủ dừng giữa chừng có thể để biên bản "Đã nhập lại kho" chưa có phiếu trả. Danh sách biên bản tối đa 500 dòng, chưa phân trang.

### Ma trận phân quyền khuyến mãi MODULE_05 phần 3 (CONG_VIEC_12)

Thêm quyền `sales.promotion.view`, `sales.promotion.manage` (không nhạy cảm, phạm vi công ty) và loại chứng từ duyệt `sales.promotion` (tài liệu `08` mục 13).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_62, CHUC_NANG_64 Xem chương trình, đã dùng | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_62 Lập, sửa, gửi duyệt, dừng chương trình | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_62 Rút chương trình chờ duyệt | Được | Trong công ty mình | Không | Không | Không | Có (người lập) |
| CHUC_NANG_63 Khuyến mãi tự áp khi lưu đơn bán | Được | Trong công ty mình | Được | Không | Không | Không |
| Tìm mặt hàng `/sales/items` | Được | Trong công ty mình | Được | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: chương trình đọc, sửa, gửi, rút, dừng theo `company_id` của công ty đang làm việc (chương trình công ty khác trả `404`); mặt hàng, kênh, nhóm khách gửi lên phải thuộc công ty; khuyến mãi áp vào đơn chỉ lấy chương trình của công ty của đơn; mặt hàng tặng, tồn hàng tặng đọc theo công ty và kho xuất đã kiểm.
- Giá không do người dùng gửi: dòng đơn gửi lên không có trường khuyến mãi; phần trăm, tiền giảm, dòng hàng tặng do máy chủ tính; dòng tặng không sửa tay.
- Chương trình chỉ chạy sau khi đi luồng duyệt (hoặc công ty chưa có chính sách duyệt); chương trình đang chạy không sửa được, chỉ dừng.
- Giới hạn: gửi đơn khóa chương trình đã áp (`FOR UPDATE`, thứ tự theo mã) rồi kiểm ngân sách, số suất cùng các đơn khác, nên hai đơn gửi đồng thời không cùng vượt giới hạn.
- Ngoại lệ dưới giá vốn: chỉ bỏ qua phần giảm do khuyến mãi đã duyệt và dòng tặng; chiết khấu tay vẫn kiểm mức tối đa.
- Nhật ký thao tác: `promotion.create`, `.update`, `.submit`, `.stop`; rút ghi theo yêu cầu duyệt; áp khuyến mãi ghi theo `sales_order.create`, `.update`.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở.
- Ghi nhận, chưa sửa: giá trị gửi duyệt là ngân sách; chương trình không giới hạn ngân sách (hoặc mua X tặng Y) gửi với giá trị 0, nên chính sách duyệt chỉ có cấp từ mức tiền lớn hơn 0 sẽ không áp, chương trình chạy ngay. Công ty muốn duyệt mọi chương trình thì đặt cấp duyệt từ 0 đồng.
- Ghi nhận, chưa sửa: lưu đơn đọc đã dùng, tồn hàng tặng không khóa; giới hạn chỉ chắc chắn khi gửi đơn (kiểm lại). Tồn hàng tặng giảm giữa lúc lưu và lúc gửi thì gửi đơn báo thiếu hàng ở dòng tặng, người bán lưu lại để tính lại.
- Ghi nhận (theo QUYTAC_NGHIEPVU_84): dừng chương trình không gỡ khuyến mãi khỏi đơn nháp đã lưu; đơn đó gửi vẫn giữ khuyến mãi nếu còn ngân sách, số suất.
- Đã sửa (commit 57bbcd0): rút chương trình ghi nhật ký `promotion.withdraw` trong cùng giao dịch; `maxGiftSets` tối đa 1.000.000.000, vượt thì trả lỗi kiểm tra dữ liệu `400` (KICHBAN_KIEMTHU_193).
- Ghi nhận: Nhân viên bán hàng xem được ngân sách, đã dùng của chương trình (để tư vấn khách); cảnh báo thiếu suất tặng cho biết gián tiếp tồn hàng tặng tại kho xuất, người bán vốn đã thấy lỗi thiếu hàng khi gửi đơn.

## 5. Quản lý khóa bí mật

| Khóa | Nơi lưu | Môi trường | Ngày đổi gần nhất | Trạng thái |
|---|---|---|---|---|
| Chuỗi kết nối cơ sở dữ liệu (tài khoản ứng dụng, quyền tối thiểu) | AWS Secrets Manager, tự đổi mỗi 90 ngày | Phát triển, thử nghiệm, thật (khác nhau) | Chưa tạo | Chưa tạo |
| Khóa ký token truy cập | AWS Secrets Manager | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa KMS mã hóa bí mật TOTP và khóa bí mật trong Cài đặt tích hợp (máy phát triển: biến `MFA_SECRET_KEY`, tối thiểu 32 ký tự) | AWS KMS | Từng môi trường | Chưa tạo | Chưa tạo |
| Mã ứng dụng Google, Microsoft, Zalo (client secret) | Cài đặt tích hợp (bảng `integration_settings`, mã hóa AES-256-GCM), quản trị tập đoàn nhập ở MAN_HINH_19 (THAY_DOI_08); không đặt trong biến môi trường | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa eSMS.vn (API key, Secret key) gửi SMS, Zalo ZNS | Cài đặt tích hợp như trên (THAY_DOI_08) | Từng môi trường | Chưa tạo | Chưa tạo |
| Thông tin truy cập AWS S3 lưu tệp đính kèm | Vai trò IAM, không dùng khóa tĩnh | Từng môi trường | Không áp dụng | Chưa tạo |
| Khóa gửi email (Amazon SES) | Vai trò IAM, không dùng khóa tĩnh | Từng môi trường | Không áp dụng | Chưa tạo |

Máy phát triển dùng tệp `.env` không commit; kho mã có `.env.example` không chứa giá trị thật.

## 6. Kết quả kiểm tra phần E (vận hành)

Chưa vận hành.

## 7. Sự cố bảo mật

Chưa có.

## 8. Rủi ro đã chấp nhận

Chưa có.

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| Mục 2 | Tệp Excel tối đa 5 MB |
| Mục 3 | Đổi mới token làm mới mỗi lần dùng; giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập |
| Mục 5 | Gửi email qua Amazon SES; tự đổi mật khẩu cơ sở dữ liệu mỗi 90 ngày |
