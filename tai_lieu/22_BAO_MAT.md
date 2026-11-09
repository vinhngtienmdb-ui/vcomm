# 22. BẢO MẬT

- Mô tả: Dữ liệu nhạy cảm, điểm tiếp nhận dữ liệu, xác thực, ma trận phân quyền, khóa bí mật, kết quả kiểm tra, rủi ro đã chấp nhận, sự cố bảo mật.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): MODULE_02 phần Sản phẩm
- Cập nhật giai đoạn 07: gắn mã API vào điểm tiếp nhận dữ liệu

Phạm vi hiện tại: MODULE_01 Nền tảng; MODULE_02 phần Sản phẩm (CONG_VIEC_04). Các module sau bổ sung vào cùng tài liệu.

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
