# CONG_VIEC_03: Hoàn thiện mini app Nền tảng

- Mô tả: Đăng nhập Google, Microsoft, Zalo, số điện thoại; Cài đặt tích hợp; thông báo Zalo ZNS; đề xuất theo mẫu, đính kèm, in PDF.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang thực hiện. Người dùng yêu cầu AI tự làm tiếp, không dừng ở điểm xem trước, chỉ hỏi điểm chưa rõ.
- Nguồn: lát L6, L9, L10 tách từ CONG_VIEC_02; THAY_DOI_04, THAY_DOI_08.

## 1. Mục tiêu

Nhân viên đăng nhập bằng tài khoản Google, Microsoft, Zalo hoặc mã OTP qua Zalo, SMS; nhận thông báo duyệt qua Zalo; lập đề xuất (phiếu chi, tạm ứng, mua sắm...) theo mẫu, đính kèm chứng từ gốc, đi qua luồng duyệt và in PDF. Quản trị tập đoàn tự nhập mã ứng dụng, khóa nhà cung cấp, không cần sửa mã hoặc khởi động lại.

## 2. Phạm vi

Trong phạm vi:
- CHUC_NANG_07, 08, 24 (đã duyệt, tài liệu `10`); CHUC_NANG_08 sửa theo THAY_DOI_08.
- CHUC_NANG_25 Cài đặt tích hợp; CHUC_NANG_26 Thông báo Zalo ZNS; CHUC_NANG_27 Mẫu đề xuất; CHUC_NANG_28 Lập và gửi đề xuất; CHUC_NANG_29 In đề xuất PDF.

Ngoài phạm vi: ghi nhận đề xuất đã duyệt vào sổ kế toán (thuộc MODULE_06); thiết kế mẫu in riêng cho từng mẫu đề xuất; gửi email thật.

## 3. Yêu cầu nghiệp vụ

| Mã | Yêu cầu | Người cần | Nguồn |
|---|---|---|---|
| YCAU_NGHIEPVU_19 | Quản trị tập đoàn tự nhập mã ứng dụng đăng nhập, khóa nhà cung cấp gửi tin mà không cần sửa mã | Quản trị tập đoàn | THAY_DOI_08 |
| YCAU_NGHIEPVU_20 | Người duyệt, người lập nhận thông báo duyệt qua Zalo | Mọi nhân viên | THAY_DOI_04 |
| YCAU_NGHIEPVU_21 | Nhân viên lập đề xuất theo mẫu do quản trị tạo, đính kèm chứng từ gốc, đi qua luồng duyệt, in được | Mọi nhân viên, quản trị công ty | THAY_DOI_04 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_31 | Khóa bí mật của nhà cung cấp mã hóa khi lưu; API, giao diện, nhật ký chỉ hiện 4 ký tự cuối; để trống khi lưu thì giữ giá trị cũ | YCAU_NGHIEPVU_19 |
| QUYTAC_NGHIEPVU_32 | Tin Zalo ZNS gửi qua eSMS.vn khi nhân viên có số điện thoại và mẫu tin của sự kiện đã cài đặt; gửi lỗi không chặn nghiệp vụ, ghi nhật ký gửi tin; mã OTP gửi Zalo trước, không được thì SMS | YCAU_NGHIEPVU_20, YCAU_NGHIEPVU_05 |
| QUYTAC_NGHIEPVU_33 | Mỗi mẫu đề xuất là một loại chứng từ cần duyệt của công ty; giá trị duyệt là trường tiền được chỉ định hoặc tổng cột thành tiền của bảng chi tiết; đề xuất đã gửi giữ bản chụp mẫu, sửa mẫu sau đó không đổi đề xuất đã gửi | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_34 | Trạng thái đề xuất: Nháp → Chờ duyệt → Đã duyệt hoặc Bị từ chối; Chờ duyệt → Đã rút. Chỉ sửa, xóa khi Nháp. Số đề xuất cấp từ dãy số chứng từ khi gửi | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_35 | Tệp đính kèm: tối đa 10 tệp mỗi đề xuất, mỗi tệp 10 MB; chỉ PDF, JPG, PNG, XLSX, DOCX (kiểm tra cả nội dung tệp); thêm, xóa khi Nháp; chỉ người xem được đề xuất mới tải được | YCAU_NGHIEPVU_21 |
| QUYTAC_NGHIEPVU_36 | Người xem được đề xuất: người lập; người được giao duyệt hoặc đã duyệt; người có quyền quản lý mẫu đề xuất của công ty | YCAU_NGHIEPVU_21 |

## 5. Dữ liệu liên quan

Database migration `0002_cong_viec_03.sql` (tài liệu `16` bổ sung):
- `core.integration_settings`: khóa cài đặt (`google.client_id`...), giá trị thường hoặc giá trị bí mật đã mã hóa, người sửa, thời điểm sửa.
- `core.otp_codes`: số điện thoại, mã băm, hết hạn, số lần nhập sai, đã dùng.
- `core.message_deliveries`: kênh (ZNS, đa kênh), mục đích, số điện thoại (che giữa), mẫu tin, trạng thái, mã tin eSMS, lỗi.
- `core.proposal_templates`: công ty, mã, tên, mô tả, loại chứng từ, danh sách trường (JSON), trường giá trị duyệt, tiền tệ, trạng thái, phiên bản.
- `core.proposals`: công ty, mẫu, bản chụp mẫu, loại chứng từ, số đề xuất, tiêu đề, giá trị các trường (JSON), giá trị duyệt, tiền tệ, trạng thái, yêu cầu duyệt, người lập, thời điểm.
- `core.attachments`: đối tượng sở hữu, tên tệp, loại, kích thước, khóa lưu trữ, người tải lên.
- `core.user_identities.provider_subject` của `phone_otp` là số điện thoại dạng +84.

## 6. Giao diện liên quan

| Mã | Màn hình | Ghi chú |
|---|---|---|
| MAN_HINH_01 | Đăng nhập | Nút Google, Microsoft, Zalo; thẻ "Số điện thoại" nhập mã OTP. Nút ẩn khi nhà cung cấp chưa cài đặt |
| MAN_HINH_06 | Hồ sơ cá nhân | Liên kết, hủy liên kết Google, Microsoft, Zalo |
| MAN_HINH_19 | Cài đặt tích hợp | Mới. Nhóm Google, Microsoft, Zalo, eSMS (SMS, ZNS); nút gửi thử tin |
| MAN_HINH_20 | Mẫu đề xuất | Mới. Danh sách mẫu; ngăn kéo tạo, sửa mẫu, khai báo trường |
| MAN_HINH_21 | Đề xuất | Mới. Đề xuất của tôi; lập, sửa nháp, gửi, rút; đính kèm; xem chi tiết kèm tiến trình duyệt; tải PDF |
| MAN_HINH_08 | Chi tiết yêu cầu duyệt | Hiện nội dung đề xuất, tệp đính kèm, nút tải PDF khi chứng từ là đề xuất |

Bản mẫu HTML không lập riêng: người dùng yêu cầu làm tiếp không chờ duyệt bản mẫu; giao diện dùng thành phần và biến của tài liệu `15`.

## 7. API liên quan

API_02 đến API_05, API_17 (đã duyệt). Mới: API_49 Cài đặt tích hợp; API_50 Mẫu đề xuất; API_51 Đề xuất; API_52 Tệp đính kèm; API_53 In đề xuất PDF; API_54 Danh sách cách đăng nhập khả dụng (công khai, cho MAN_HINH_01). Chi tiết trong tài liệu `17`.

## 8. Phân quyền

| Quyền | Nhạy cảm | Vai trò mặc định |
|---|---|---|
| `platform.integration.manage` | Có | Quản trị tập đoàn |
| `platform.proposal_template.manage` | Không | Quản trị tập đoàn, quản trị công ty |
| `platform.proposal.create` | Không | Mọi vai trò có sẵn |

## 9. Điều kiện đặc biệt

- Đăng nhập Google, Microsoft theo OpenID Connect có PKCE và `state`; lấy email đã xác minh từ token trả về trực tiếp qua kênh máy chủ – máy chủ. Microsoft dùng tenant `organizations` (tài khoản công ty) trừ khi cài đặt khác.
- Zalo OAuth v4 có PKCE; mã định danh lấy từ `graph.zalo.me`.
- `state`, `code_verifier` lưu cookie HttpOnly ký bằng khóa máy chủ, hết hạn 10 phút.
- Sau đăng nhập bằng nhà cung cấp vẫn qua bước xác thực hai lớp khi tài khoản bắt buộc.
- Tệp đính kèm lưu S3 khi có cấu hình `STORAGE_DRIVER=s3`; máy phát triển, kiểm thử lưu thư mục cục bộ.

## 10. Tiêu chí nghiệm thu

TIEUCHI_NGHIEMTHU_13, 14, 46, 47 (đã duyệt) và:

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_48 | CHUC_NANG_25 | Khóa bí mật không bao giờ trả đầy đủ qua API hoặc ghi vào nhật ký; lưu xong có hiệu lực ngay không cần khởi động lại | Gọi API, đọc nhật ký, đăng nhập thử | Bắt buộc |
| TIEUCHI_NGHIEMTHU_49 | CHUC_NANG_25 | Chỉ quản trị tập đoàn xem, sửa được Cài đặt tích hợp | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_50 | CHUC_NANG_26 | Mỗi lần có chứng từ chờ duyệt, nhắc quá hạn, có kết quả duyệt, người nhận có số điện thoại nhận đúng một tin ZNS theo mẫu đã cài; ZNS lỗi thì luồng duyệt vẫn chạy và có ghi lỗi | Kiểm thử tự động với nguồn giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_51 | CHUC_NANG_08 | Mã OTP gửi qua kênh đa kênh Zalo rồi SMS; chưa cài ZNS thì gửi SMS | Kiểm thử tự động với nguồn giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_52 | CHUC_NANG_27, 28 | Lập đề xuất thiếu trường bắt buộc hoặc sai kiểu bị từ chối, chỉ ra đúng trường | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_53 | CHUC_NANG_28 | Gửi đề xuất nhận số tự động, đi qua chính sách duyệt với giá trị đúng; duyệt xong đề xuất chuyển "Đã duyệt"; sửa mẫu sau khi gửi không đổi đề xuất đã gửi | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_54 | CHUC_NANG_28 | Tệp sai loại, quá 10 MB, quá 10 tệp bị từ chối; người không xem được đề xuất không tải được tệp | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_55 | CHUC_NANG_29 | Tệp PDF có tên công ty, số đề xuất, các trường, bảng chi tiết, các cấp duyệt; tiếng Việt đúng dấu | Mở tệp PDF | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_31 đến 34, 112 đến 117 (đã có) và KICHBAN_KIEMTHU_121 đến 132 (tài liệu `21`).

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện OpenID Connect: trao đổi mã qua HTTPS bằng `fetch`, không cần kiểm chữ ký token vì token nhận trực tiếp từ nhà cung cấp.
- Thư viện mới: `pdfmake` (MIT, người dùng duyệt), `@aws-sdk/client-s3` (Apache-2.0) cho lưu trữ S3, phông Noto Sans (SIL Open Font License) cho PDF tiếng Việt.
- Kiểm thử không gọi mạng ngoài: nhà cung cấp OAuth, eSMS, S3 thay bằng nguồn giả.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện đã phát hành trong v0.1.0, trừ phần bổ sung ghi ở mục 6, 7.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L6a | Cài đặt tích hợp, kết nối eSMS (SMS, ZNS), nhật ký gửi tin | MAN_HINH_19; API_49 | TIEUCHI_NGHIEMTHU_48, 49 |
| L6b | Đăng nhập bằng số điện thoại (OTP đa kênh) | MAN_HINH_01; API_02, 03, 54 | TIEUCHI_NGHIEMTHU_14, 51 |
| L6c | Đăng nhập, liên kết Google, Microsoft, Zalo | MAN_HINH_01, 06; API_04, 05, 17 | TIEUCHI_NGHIEMTHU_13, 46, 47 |
| L9 | Thông báo duyệt qua Zalo ZNS | Không có màn hình mới | TIEUCHI_NGHIEMTHU_50 |
| L10a | Mẫu đề xuất, lập và gửi đề xuất, đính kèm | MAN_HINH_20, 21, 08; API_50, 51, 52 | TIEUCHI_NGHIEMTHU_52, 53, 54 |
| L10b | In đề xuất PDF | MAN_HINH_21, 08; API_53 | TIEUCHI_NGHIEMTHU_55 |

Người dùng bỏ dừng chờ ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
