# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

## 2026-11-09

### Công việc đã thực hiện

- CONG_VIEC_02: Xong lát L4 (mời, kích hoạt, nhập Excel, khóa, mở khóa, sửa nhân viên; API_11, API_25 đến API_30; MAN_HINH_03, 12, 13); kiểm thử tích hợp 58/58 đạt. Thêm thư viện read-excel-file 9.3.14 và write-excel-file 4.1.1 (MIT). AI tự quyết trong phạm vi đặc tả: trùng định danh trong cùng tệp Excel thì dòng sau lỗi; tài khoản có sẵn nhận theo định danh ưu tiên email, số điện thoại, tên đăng nhập; tệp dòng lỗi trả dạng data URL, không lưu máy chủ; API_11 thêm GET thông tin kích hoạt cho MAN_HINH_03.
- Vấn đề tồn đọng: nhân viên chỉ có tên đăng nhập (không email, số điện thoại) không nhận được đường dẫn kích hoạt; cần quyết định cách giao đường dẫn.
- CONG_VIEC_02: Xong lát L3 (công ty, chi nhánh, phòng ban; API_20 đến 23; MAN_HINH_09, 10, 11); kiểm thử tích hợp 44/44 đạt. AI tự quyết trong phạm vi đặc tả: người tạo công ty được thêm làm thành viên công ty mới để chọn được công ty đó (CHUC_NANG_11); ngừng hoạt động phòng ban không chặn khi còn phòng ban con vì đặc tả chưa có quy tắc này.
- CONG_VIEC_02: Xong lát L2 (vai trò, ma trận quyền, gán vai trò theo phạm vi, lọc theo chi nhánh); kiểm thử tích hợp 29/29 đạt. Lập THAY_DOI_05.
- CONG_VIEC_02: Xong lát L1 (đăng nhập bằng mật khẩu, phiên, trang chủ mini app); kiểm thử tích hợp 9/9 đạt; CI đạt; pull request số 4.
- CONG_VIEC_01: Thu thập yêu cầu qua ba đợt hỏi đáp với người dùng; lập tài liệu tổng thể trên Claude Docs "VComm – Nền tảng TMĐT cộng đồng & Loyalty"; lập bản nháp kiến trúc, đặc tả mini app Nền tảng và mô hình dữ liệu schema `core` (pull request số 1, nhánh `docs/platform-spec`).
- CONG_VIEC_01: Áp dụng quy trình Vibecoding_Flow; chuyển các bản nháp sang bộ tài liệu đánh số trong `tai_lieu/`.

### Quyết định

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
