# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

## 2026-11-09

### Công việc đã thực hiện

- Phát hành phiên bản 0.2.0 (CONG_VIEC_03): tài liệu 23, hợp nhất nhánh `phat-hanh/v0.2.0` (pull request số 24), kiểm thử lại 156/156 đạt trên commit hợp nhất `ffcbde3`. Tag `v0.2.0` chờ người dùng tạo trên GitHub vì môi trường của AI không được phép đẩy tag. Chưa triển khai: chưa chọn hạ tầng, chưa có khóa nhà cung cấp.
- CONG_VIEC_03: Người dùng nghiệm thu. Bổ sung theo yêu cầu khi nghiệm thu: nút "Gửi thử tin" ở MAN_HINH_19 (API `POST /integration-settings/test-message`), đếm ngược 60 giây cho nút gửi lại mã ở MAN_HINH_01, lời thông báo Zalo theo đặc tả. Hợp nhất pull request số 21 vào `main` (commit `5f4eb6c`), kiểm thử lại 156/156 đạt trên commit hợp nhất. Chưa phát hành, chưa triển khai.
- CONG_VIEC_03: Xong lát L6, L9, L10 trên nhánh `chuc-nang/CONG_VIEC_03-hoan-thien-nen-tang` (pull request số 21). L6: màn hình Cài đặt tích hợp (MAN_HINH_19), đăng nhập số điện thoại qua eSMS (Zalo trước, SMS sau), Google, Microsoft, Zalo, liên kết tài khoản ở hồ sơ, kích hoạt bằng Google, Microsoft. L9: Zalo ZNS cho chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt. L10: mẫu đề xuất (MAN_HINH_20, 3 mẫu có sẵn), đề xuất (MAN_HINH_21), tệp đính kèm trên S3, in PDF; người duyệt xem nội dung đề xuất ở MAN_HINH_08. Kiểm thử 155/155 đạt trên bản giả lập nhà cung cấp. Thêm thư viện pdfmake 0.3.12 (MIT), @aws-sdk/client-s3 3.1156.0 (Apache-2.0). Cập nhật tài liệu 06, 07, 10, 11, 14, 16, 17, 21, 22, 27 trên nhánh. Tự rà soát mã sửa 8 điểm, đối chiếu tài liệu sửa thêm 3 lỗi.
- Vấn đề tồn đọng sau CONG_VIEC_03: chưa thử với eSMS, Google, Microsoft, Zalo, S3 thật (chờ người dùng nhập khóa); khóa mã hóa trong Cài đặt tích hợp dùng biến `MFA_SECRET_KEY`, chưa dùng AWS KMS; chưa có tác vụ dọn bảng `otp_codes`, `message_deliveries`; một số chỗ đặc tả lệch mã chờ người dùng quyết định (phông PDF, nút gửi thử tin, đếm ngược gửi lại mã, lời thông báo Zalo).
- CONG_VIEC_03: Lập công việc hoàn thiện mini app Nền tảng gồm lát L6, L9, L10; lập THAY_DOI_08 (màn hình Cài đặt tích hợp, mã OTP qua Zalo ZNS).
- Phát hành phiên bản 0.1.0 (CONG_VIEC_01, CONG_VIEC_02, LOI_02): tài liệu 23, hợp nhất nhánh `phat-hanh/v0.1.0` (pull request số 18), kiểm thử lại 120/120 đạt trên commit hợp nhất `cd5ed97`. Tag `v0.1.0` do người dùng tạo trên GitHub vì môi trường của AI không được phép đẩy tag. Chưa triển khai lên môi trường nào.
- LOI_02: Sửa trên nhánh `sua-loi/LOI_02-gioi-han-yeu-cau-theo-ip` (pull request số 15): giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho mỗi API không cần đăng nhập, đếm trên Redis; kiểm thử 120/120 đạt. AI tự quyết: đếm riêng từng API để trang đăng nhập không bị chặn vì người dùng gọi quên mật khẩu; Redis lỗi thì cho qua.
- CONG_VIEC_02: Người dùng nghiệm thu các lát L1 đến L5, L7, L8. Trước nghiệm thu: rà soát tiếng Anh 24 màn hình, sửa tên vai trò, tên loại chứng từ, ký hiệu tiền theo ngôn ngữ; thêm kiểm thử bảo mật KICHBAN_KIEMTHU_118, 119; đo tải sơ bộ KICHBAN_KIEMTHU_111. Toàn bộ 119/119 kiểm thử đạt. Lập tài liệu 25 với LOI_01 (đăng nhập chưa đạt mốc 200 ms dưới tải), LOI_02 (chưa giới hạn số yêu cầu theo địa chỉ IP).
- CONG_VIEC_02: Xong lát L8 (dãy số chứng từ, tỷ giá, nhật ký thao tác, thông báo, vô hiệu hóa kèm bàn giao, đặt lại xác thực hai lớp; API_31 đến 33, 43 đến 48; MAN_HINH_16, 17, 18; nút Lịch sử ở MAN_HINH_09 đến 17); kiểm thử tích hợp 107/107 đạt. Không thêm thư viện. AI tự quyết trong phạm vi đặc tả: kỳ theo tháng trong số chứng từ viết `202611`, không đặt lại thì bỏ phần kỳ; bàn giao chỉ gồm bước duyệt giao đích danh và chức trưởng phòng, bước giao theo vai trò không cần bàn giao; vô hiệu hóa kết thúc vai trò của nhân viên trong công ty bị gỡ; người nhận bàn giao không được là người lập chứng từ; tỷ giá dùng chung tập đoàn, nguồn gồm nhập tay và Vietcombank; ghi nhật ký cả lần đăng nhập thất bại (chỉ quản trị tập đoàn thấy); tác vụ nền tạo trước partition nhật ký 3 tháng; thông báo hiển thị theo ngôn ngữ đang chọn.
- CONG_VIEC_02: Làm phần lấy tỷ giá tự động của CHUC_NANG_21: đọc bảng tỷ giá công khai của Vietcombank lúc 8:30 sáng giờ Việt Nam; tỷ giá chuyển khoản dùng làm tỷ giá hạch toán; nguồn lỗi thì thông báo người có quyền nhập tỷ giá; khi quy đổi chứng từ, tỷ giá nhập tay được ưu tiên. Kiểm thử tích hợp 111/111 đạt. Máy chủ API trên môi trường thật cần được phép gọi ra `portal.vietcombank.com.vn`.
- Vấn đề tồn đọng sau L8: nhân viên bị vô hiệu hóa vẫn có thể là người duyệt đích danh trong chính sách duyệt đang hiệu lực, chứng từ mới sẽ chờ người đó tới khi quá hạn và chuyển người thay thế.
- CONG_VIEC_02: Xong lát L7 (chính sách duyệt, gửi duyệt, hộp duyệt, chi tiết, rút lại, nhắc và chuyển quá hạn, đẩy outbox; API_37 đến 42; MAN_HINH_07, 08, 15); kiểm thử tích hợp 81/81 đạt. Thêm BullMQ 6.4.2, ioredis 5.11.1 (MIT), chọn bản phát hành trên hai tuần. Lát L6 vẫn bị chặn. PR #4 đã hợp nhất vào nhánh CONG_VIEC_01 thay vì main; mở PR #10 vào main, hợp nhất sau khi xong L8 và nghiệm thu. AI tự quyết trong phạm vi đặc tả: người duyệt theo vai trò bị thay bằng người thay thế khi người lập là người duy nhất giữ vai trò; chính sách mới không được bắt đầu trước hoặc cùng ngày chính sách đã có; người đã nhận thông báo về yêu cầu vẫn xem được yêu cầu sau khi bị chuyển; gửi duyệt qua HTTP chỉ cho chứng từ thử ngoài môi trường thật.
- CONG_VIEC_02: Xong lát L5 (xác thực hai lớp TOTP, mã dự phòng, quên và đặt lại mật khẩu, hồ sơ cá nhân, phiên đăng nhập; API_06 đến 08, 12, 13, 15 đến 18; MAN_HINH_02, 04, 06); kiểm thử tích hợp 68/68 đạt. Thêm thư viện otpauth 9.6.0, qrcode-generator 2.0.4 (MIT). AI tự quyết trong phạm vi đặc tả: thêm `POST /me/mfa/disable`, `POST /me/mfa/backup-codes` cho các nút đã có trên MAN_HINH_06; LoginResponse thêm `mfaEnrolled`; sai mã 5 lần trong một phiên thì thu hồi phiên; bí mật TOTP mã hóa bằng khóa trong biến môi trường cho tới khi có AWS KMS.
- Vấn đề tồn đọng: mã OTP qua SMS, email cho xác thực hai lớp và giới hạn số lần gọi theo địa chỉ IP (tài liệu 22) cần Redis và nhà cung cấp gửi tin, làm cùng lát L6; chưa chống dùng lại một mã TOTP trong cùng 30 giây.
- CONG_VIEC_02: Xong lát L4 (mời, kích hoạt, nhập Excel, khóa, mở khóa, sửa nhân viên; API_11, API_25 đến API_30; MAN_HINH_03, 12, 13); kiểm thử tích hợp 58/58 đạt. Thêm thư viện read-excel-file 9.3.14 và write-excel-file 4.1.1 (MIT). AI tự quyết trong phạm vi đặc tả: trùng định danh trong cùng tệp Excel thì dòng sau lỗi; tài khoản có sẵn nhận theo định danh ưu tiên email, số điện thoại, tên đăng nhập; tệp dòng lỗi trả dạng data URL, không lưu máy chủ; API_11 thêm GET thông tin kích hoạt cho MAN_HINH_03.
- CONG_VIEC_02: Xong lát L3 (công ty, chi nhánh, phòng ban; API_20 đến 23; MAN_HINH_09, 10, 11); kiểm thử tích hợp 44/44 đạt. AI tự quyết trong phạm vi đặc tả: người tạo công ty được thêm làm thành viên công ty mới để chọn được công ty đó (CHUC_NANG_11); ngừng hoạt động phòng ban không chặn khi còn phòng ban con vì đặc tả chưa có quy tắc này.
- CONG_VIEC_02: Xong lát L2 (vai trò, ma trận quyền, gán vai trò theo phạm vi, lọc theo chi nhánh); kiểm thử tích hợp 29/29 đạt. Lập THAY_DOI_05.
- CONG_VIEC_02: Xong lát L1 (đăng nhập bằng mật khẩu, phiên, trang chủ mini app); kiểm thử tích hợp 9/9 đạt; CI đạt; pull request số 4.
- CONG_VIEC_01: Thu thập yêu cầu qua ba đợt hỏi đáp với người dùng; lập tài liệu tổng thể trên Claude Docs "VComm – Nền tảng TMĐT cộng đồng & Loyalty"; lập bản nháp kiến trúc, đặc tả mini app Nền tảng và mô hình dữ liệu schema `core` (pull request số 1, nhánh `docs/platform-spec`).
- CONG_VIEC_01: Áp dụng quy trình Vibecoding_Flow; chuyển các bản nháp sang bộ tài liệu đánh số trong `tai_lieu/`.

### Quyết định

- Phát hành phiên bản 0.2.0; chưa có khóa eSMS, Google, Microsoft, Zalo (đăng ký sau); hạ tầng triển khai chưa quyết – người quyết định: người dùng.
- Nghiệm thu CONG_VIEC_03 trên bản giả lập nhà cung cấp và hợp nhất vào `main`; thử với eSMS, Google, Microsoft, Zalo, S3 thật khi có khóa – người quyết định: người dùng.
- PDF giữ phông Roboto; làm thêm nút gửi thử tin và đếm ngược gửi lại mã; lời thông báo Zalo theo đặc tả – người quyết định: người dùng.
- CONG_VIEC_03, AI tự quyết trong phạm vi đặc tả: Microsoft chỉ tự gắn tài khoản theo email khi cài tenant riêng của công ty (mã GUID hoặc tên miền), tenant chung phải liên kết từ hồ sơ trước; Zalo luôn phải liên kết từ hồ sơ trước; mỗi mẫu đề xuất là một loại chứng từ cần duyệt riêng của công ty, dãy số tiền tố là mã mẫu; đề xuất giữ bản chụp mẫu khi lập; giá trị duyệt là trường tiền được chọn hoặc tổng thành tiền bảng chi tiết; PDF dùng phông Roboto có sẵn trong pdfmake (đủ dấu tiếng Việt) thay Noto Sans; ZNS gửi lỗi không gửi lại để tránh trùng; vai trò Quản lý tỷ giá là vai trò bổ sung nên không có quyền lập đề xuất riêng.
- CONG_VIEC_03: AI tự làm tiếp không chờ điểm xem trước; viết sẵn kết nối Google, Microsoft, Zalo, SMS, ZNS, mã ứng dụng nhập sau; làm luôn lát L9, L10 – người quyết định: người dùng.
- Mã ứng dụng và khóa nhà cung cấp nhập ở màn hình Cài đặt tích hợp (THAY_DOI_08); nhà cung cấp SMS là eSMS.vn – người quyết định: người dùng.
- Zalo ZNS gửi khi có chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt cho người lập, và mã OTP đăng nhập (ZNS trước, SMS sau) – người quyết định: người dùng.
- Đề xuất: quản trị tự tạo mẫu đề xuất với các trường khai báo, có sẵn 3 mẫu phiếu chi, tạm ứng, mua sắm; cho đính kèm tệp lưu trên S3; in PDF theo bố cục chuẩn của hệ thống bằng thư viện pdfmake (MIT) – người quyết định: người dùng.
- Phát hành phiên bản 0.1.0 – người quyết định: người dùng.
- Nghiệm thu LOI_02 và hợp nhất vào `main`; LOI_01 giữ mức băm mật khẩu, đo lại trên môi trường thử nghiệm – người quyết định: người dùng.
- Sửa LOI_02 ngay bằng Redis – người quyết định: người dùng.
- Nghiệm thu CONG_VIEC_02 (lát L1 đến L5, L7, L8) và hợp nhất vào `main`; lát L6, L9, L10 tách thành công việc sau – người quyết định: người dùng.
- Lấy tỷ giá tự động mỗi sáng từ Vietcombank (CHUC_NANG_21) – người quyết định: người dùng.
- Phê duyệt THAY_DOI_07: tài khoản phải có email hoặc số điện thoại – người quyết định: người dùng.
- Phê duyệt THAY_DOI_06: vai trò Quản trị công ty có quyền truy cập mọi mini app, kể cả Tài chính – Kế toán, Nhân sự – người quyết định: người dùng.
- Cho phép AI tự hợp nhất, đóng, chuyển trạng thái PR qua `.claude/settings.json`, và tự quyết các điểm đặc tả chưa rõ, ghi vào nhật ký – người quyết định: người dùng.
- Hợp nhất sổ dùng chung và các nhánh vào `main` do AI thực hiện khi người dùng yêu cầu "tự động hợp nhất và kiểm thử"; thao tác nào bị hệ thống chặn thì người dùng tự bấm – người quyết định: người dùng.
- Phê duyệt THAY_DOI_05: người có quyền gán vai trò xem được danh sách vai trò (API_36 `GET /roles`) – người quyết định: người dùng.
- CONG_VIEC_02: Bỏ dừng chờ phản hồi ở điểm xem trước của từng lát; AI tự làm tiếp các lát L2 đến L8 theo kế hoạch đã duyệt, vẫn chụp màn hình và báo kết quả sau mỗi lát. Lát L6, L9 vẫn bị chặn; nghiệm thu, hợp nhất vào `main` và triển khai vẫn do người dùng thực hiện – người quyết định: người dùng.
- Tên sản phẩm: VComm – người quyết định: người dùng.
- Thứ tự ra mắt: hệ thống quản trị doanh nghiệp (ERP) → sàn thương mại điện tử → loyalty và cửa hàng liên kết – người quyết định: người dùng.
- Tự xây dựng 100%, không dùng nền ERP có sẵn – người quyết định: người dùng.
- Mỗi phân hệ ERP là một mini app có giao diện riêng, dùng chung cơ sở dữ liệu – người quyết định: người dùng.
- Hoa hồng đội kinh doanh gồm cả hoa hồng từ đơn mua của khách hàng; quy tắc gán đơn cho nhân viên cấu hình được – người quyết định: người dùng.
- Áp dụng quy trình Vibecoding_Flow cho dự án; làm lại tài liệu theo bộ tài liệu đánh số – người quyết định: người dùng.
- Phê duyệt tài liệu `04` Tổng quan dự án và `05` Phạm vi; giai đoạn 01, 02 đạt cổng kiểm soát – người quyết định: người dùng.
- Phê duyệt tài liệu `06` đến `09` của MODULE_01 và 7 quy tắc do AI đề xuất; giai đoạn 03 của MODULE_01 đạt cổng kiểm soát – người quyết định: người dùng.
- Phê duyệt tài liệu `10`, `11`, `27` của MODULE_01 và 7 nội dung do AI đề xuất; giai đoạn 04 của MODULE_01 đạt cổng kiểm soát – người quyết định: người dùng.
- Chọn Drizzle ORM làm thư viện truy cập cơ sở dữ liệu, AWS CDK làm công cụ hạ tầng bằng mã – người quyết định: người dùng.
- Phê duyệt tài liệu `12`, `13`, `22` và danh sách thư viện cho MODULE_01 (chọn read-excel-file thay exceljs); giai đoạn 05 của MODULE_01 đạt cổng kiểm soát – người quyết định: người dùng.
- Phê duyệt bước 06.1 (18 màn hình MAN_HINH_01 đến 18) của MODULE_01 – người quyết định: người dùng.
- Phê duyệt bước 06.2 (khung giao diện thang xám 18 màn hình) của MODULE_01 – người quyết định: người dùng.
- Chọn phương án C "Thân thiện" (xanh lục bảo #047857, phông Nunito Sans) cho nhận diện VComm, bước 06.3 – người quyết định: người dùng.
- Phê duyệt bản mẫu bước 06.4 và tài liệu `14`, `15`; giai đoạn 06 của MODULE_01 đạt cổng kiểm soát – người quyết định: người dùng.
- Phê duyệt tài liệu `16`, `17` (gồm thời gian lưu giữ dữ liệu và giữ API phiên bản cũ 6 tháng); giai đoạn 07 của MODULE_01 đạt cổng kiểm soát – người quyết định: người dùng.
- Phê duyệt THAY_DOI_03: chế độ kế toán mặc định Thông tư 99/2025, cho phép Thông tư 133 với công ty con nhỏ và vừa (Thông tư 200 đã hết hiệu lực) – người quyết định: người dùng.
- Dùng nguồn mã riêng V-com-ERP theo phương án 3: tham khảo nghiệp vụ, viết lại theo kiến trúc đã duyệt – người quyết định: người dùng.
- Ghim TypeScript 6.0.3 – người quyết định: người dùng.
- Phê duyệt tài liệu `18`, `19` và kế hoạch 8 lát của CONG_VIEC_02; giai đoạn 08 đạt cổng kiểm soát – người quyết định: người dùng.
- Áp dụng 3 cách giảm chi phí AWS giai đoạn 1 – người quyết định: người dùng.
- Gửi OTP qua Zalo ZNS trước, SMS thương hiệu dự phòng – người quyết định: người dùng.
- Liên hệ Trung tâm RAR về xác thực VNeID để sau, khi làm MODULE_02 – người quyết định: người dùng.
- Nghiệm thu CONG_VIEC_01 (bộ tài liệu giai đoạn 01 đến 08 cho MODULE_01, cấu hình monorepo) – người quyết định: người dùng.
- Bắt đầu CONG_VIEC_02 trên nhánh `chuc-nang/CONG_VIEC_02-mini-app-nen-tang` tạo từ nhánh CONG_VIEC_01 thay vì từ `main` (lệch mục 14 của quy trình) vì PR #2, #3 chưa hợp nhất; chuyển gốc về `main` sau khi hợp nhất – người quyết định: người dùng.
- Phê duyệt THAY_DOI_04: mở rộng phạm vi theo đối chiếu V-com-ERP (bổ sung 7 module, thêm MODULE_13 đến MODULE_16), chia thêm phiên bản – người quyết định: người dùng.
- Phê duyệt THAY_DOI_01 (đăng nhập bằng Zalo cho người mua, nhà bán, cửa hàng liên kết, nhân viên; nhân viên chỉ liên kết sau khi kích hoạt) và THAY_DOI_02 (bắt buộc xác thực nhà bán cá nhân và doanh nghiệp qua VNeID, kết nối qua tổ chức cung cấp dịch vụ xác thực điện tử) – người quyết định: người dùng.
- Các quyết định chi tiết khác ghi tại tài liệu `04` và `05`.

### Thay đổi

- `tai_lieu/02_NHAT_KY_DU_AN.md`, `tai_lieu/03_DANH_SACH_CONG_VIEC.md`: tạo mới.
- `tai_lieu/24_YEU_CAU_THAY_DOI.md`: tạo mới với THAY_DOI_01, THAY_DOI_02; thêm THAY_DOI_03.
- Tài liệu 13: thêm phân tích V-com-ERP, ước tính chi phí AWS, tra cứu nhà cung cấp VNeID, OTP, Zalo (thực hiện bằng phiên con).
- Thư mục gốc: 8 tệp cấu hình monorepo và `.claude/launch.json`.
- `tai_lieu/06` đến `09`: lập cho MODULE_01 (nhánh `chuc-nang/CONG_VIEC_01-bo-tai-lieu-khoi-tao`).
- `tai_lieu/10`, `11`, `27`: lập cho MODULE_01; kiểm tra bao phủ đầy đủ.
- `tai_lieu/12`, `13`: rà soát theo tài liệu `10`; `tai_lieu/22`: lập phần A cho MODULE_01.

### Vấn đề tồn đọng

- Chưa chốt đối tác ngân hàng hoặc ví điện tử – trạng thái: chờ xác nhận.
- Chưa có ý kiến luật sư về điểm thưởng, cộng tác viên, dữ liệu cá nhân – trạng thái: chờ xác nhận.
- Kế toán trưởng chưa chọn phương pháp tính giá vốn cho từng công ty con – trạng thái: chờ xác nhận.
- Chưa có Zalo Official Account và ứng dụng trên developers.zalo.me; chặn lát L6 – trạng thái: chờ người dùng đăng ký.
- Chưa liên hệ Trung tâm RAR (tổ chức cung cấp dịch vụ xác thực điện tử) – trạng thái: để đến MODULE_02.
- Chưa chọn nhà cung cấp SMS – trạng thái: chờ xác nhận.
