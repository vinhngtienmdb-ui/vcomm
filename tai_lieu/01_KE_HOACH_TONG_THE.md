# 01. KẾ HOẠCH TỔNG THỂ

- Mô tả: Mục tiêu, phạm vi phiên bản, tiến độ giai đoạn, danh sách module, mốc phát hành, rủi ro.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-17
- Trạng thái: Đang cập nhật
- Thay đổi theo: CONG_VIEC_71 (2026-11-17): cập nhật trạng thái giai đoạn, module, mốc phát hành theo tài liệu `03`, `23`; bỏ quản lý sản xuất khỏi phạm vi theo THAY_DOI_30; THAY_DOI_39 qua CONG_VIEC_74 (2026-11-17): thêm MODULE_17 iPOS, trạng thái CONG_VIEC_74 đợt 1

## 1. Mục tiêu dự án

Xây dựng VComm: hệ thống quản trị doanh nghiệp (ERP) tập trung cho tập đoàn, sàn thương mại điện tử cộng đồng và điểm thưởng dùng chung với cửa hàng liên kết. Chi tiết: tài liệu `04`.

## 2. Phạm vi phiên bản hiện tại

- Phiên bản phát hành gần nhất: 0.11.0 (2026-11-16). Đã phát hành 0.1.0 đến 0.11.0 (tài liệu `23`); chưa triển khai phiên bản nào lên môi trường thật.
- Phiên bản tiếp theo: **CHƯA XÁC ĐỊNH**. Công việc còn trong danh sách: CONG_VIEC_63 trợ lý AI (MODULE_16), chưa bắt đầu (tài liệu `03`).
- Phạm vi đầy đủ: tài liệu `05`.

## 3. Tiến độ theo giai đoạn

| Giai đoạn | Tài liệu đầu ra | Trạng thái | Ngày phê duyệt |
|---|---|---|---|
| 01 Xác định ý tưởng | 04 | Đã phê duyệt | 2026-11-09 |
| 02 Xác định phạm vi | 05 | Đã phê duyệt | 2026-11-09 |
| 03 Phân tích nghiệp vụ | 06, 07, 08, 09 | Đã phê duyệt cho phần của các công việc đã phát hành (MODULE_01 đến MODULE_16) | 2026-11-09 (MODULE_01); các module khác theo từng công việc (tài liệu `02`, `03`) |
| 04 Đặc tả yêu cầu | 10, 11, 27 | Đã phê duyệt cho phần của các công việc đã phát hành | 2026-11-09 (MODULE_01); các module khác theo từng công việc |
| 05 Kiến trúc hệ thống | 12, 13, 22 | Đã phê duyệt cho phần của các công việc đã phát hành | 2026-11-09 (MODULE_01); các module khác theo từng công việc |
| 06 Giao diện | 14, 15, bản mẫu | Đã phê duyệt cho phần của các công việc đã phát hành | 2026-11-09 (MODULE_01); các module khác theo từng công việc |
| 07 Dữ liệu và API | 16, 17 | Đã phê duyệt cho phần của các công việc đã phát hành | 2026-11-09 (MODULE_01); các module khác theo từng công việc |
| 08 Chuẩn bị môi trường AI | 18, 19 | Đã phê duyệt | 2026-11-09 |
| 09 Xây dựng theo module | Mã nguồn | Đang thực hiện: đã xây các phần phát hành ở 0.1.0 đến 0.11.0; CONG_VIEC_63 chưa bắt đầu; CONG_VIEC_74 (MODULE_17 iPOS) đợt 1 đã lập trình lát L0 đến L7, chờ nghiệm thu | |
| 10 Kiểm thử | 20, 21, 22, 25 | Đang thực hiện theo từng công việc (tài liệu `25`) | |
| 11 Nghiệm thu và phát hành | 23 | Đang thực hiện: đã phát hành 0.1.0 đến 0.11.0 | |
| 12 Triển khai | 26 | Chưa bắt đầu: chưa triển khai phiên bản nào; tài liệu `26` chưa lập | |
| 13 Vận hành và cải tiến | 24 | Chưa bắt đầu | |

Giai đoạn 03 đến 07 làm cho từng module, từng công việc trước khi xây dựng, bắt đầu từ MODULE_01.

## 4. Danh sách module

| Mã module | Tên module | Chức năng chính | Thứ tự xây dựng | Trạng thái |
|---|---|---|---|---|
| MODULE_01 | Nền tảng | Tổ chức, đăng nhập, phân quyền, trang chủ mini app, duyệt chứng từ, đánh số chứng từ, tỷ giá, nhật ký thao tác | 1 | Đã phát hành một phần: v0.1.0 (CONG_VIEC_02), v0.2.0 (CONG_VIEC_03); chưa triển khai |
| MODULE_02 | Sản phẩm và Nhà bán | Ngành hàng, sản phẩm, biến thể, lô, serial, bảng giá, nhà bán | 2 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_04, phần Sản phẩm); chưa triển khai |
| MODULE_03 | Kho | Kho, vị trí, nhập, xuất, chuyển, kiểm kê, ứng dụng kho | 3 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_05), v0.4.0 (CONG_VIEC_44, ứng dụng kho); chưa triển khai |
| MODULE_04 | Mua hàng | Đề nghị mua, đơn mua, nhận hàng, nhập khẩu | 4 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_07), v0.5.0 (CONG_VIEC_45, nhập khẩu); chưa triển khai |
| MODULE_05 | Bán hàng | Đơn bán đa kênh, khuyến mãi, trả hàng, giao dịch nội bộ | 4 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_08, 09, 12, 43); chưa triển khai |
| MODULE_06 | Tài chính – Kế toán | Bút toán, công nợ, tỷ giá, hóa đơn điện tử, đối soát, hoa hồng, báo cáo hợp nhất | 5 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_13 đến 20, 43), v0.4.0 (CONG_VIEC_48, bút toán lương), v0.8.0 (CONG_VIEC_56); chưa triển khai |
| MODULE_07 | Khách hàng và Đối tác | Khách hàng, nhà cung cấp, cửa hàng liên kết, ứng dụng nhân viên kinh doanh | 6 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_06, 21, 43), v0.6.0 (CONG_VIEC_22); chưa triển khai |
| MODULE_08 | Nhân sự | Hồ sơ, hợp đồng, chấm công, lương, tuyển dụng, đánh giá hiệu suất | 6 | Đã phát hành một phần: v0.4.0 (CONG_VIEC_46, 47, 48), v0.5.0 (CONG_VIEC_54); chưa triển khai |
| MODULE_09 | Sàn thương mại điện tử | Trang nhà bán, ứng dụng người mua, giỏ hàng, thanh toán, giao hàng | 7 | Đã phát hành một phần: v0.3.0 (CONG_VIEC_23 đến 27), v0.4.0 (CONG_VIEC_28 đến 42), v0.11.0 (CONG_VIEC_68); chưa triển khai |
| MODULE_10 | Cộng đồng | Cộng tác viên, mua chung, bảng tin, giới thiệu bạn bè | 8 | Đã phát hành một phần: v0.5.0 (CONG_VIEC_49); chưa triển khai |
| MODULE_11 | Điểm thưởng | Sổ cái điểm, hạng thành viên, đối soát liên minh, chống gian lận | 9 | Đã phát hành một phần: v0.5.0 (CONG_VIEC_51), v0.10.0 (CONG_VIEC_60), v0.11.0 (CONG_VIEC_65); chưa triển khai |
| MODULE_12 | Cửa hàng liên kết | Quét mã QR tích và đổi điểm, voucher, báo cáo cửa hàng | 9 | Đã phát hành một phần: v0.7.0 (CONG_VIEC_55), v0.10.0 (CONG_VIEC_67); chưa triển khai |
| MODULE_13 | Văn phòng số | Công việc, quy trình, công văn, chữ ký số, kho hợp đồng, bảng tin nội bộ | 10 | Đã phát hành một phần: v0.8.0 (CONG_VIEC_52), v0.9.0 (CONG_VIEC_59); chưa triển khai |
| MODULE_14 | Bán lẻ tại quầy và trạm giao hàng | Bán hàng tại quầy, trạm giao hàng O2O, kế hoạch mua theo ngân sách | 11 | Đã phát hành một phần: v0.5.0, v0.6.0 (CONG_VIEC_53), v0.6.0 (CONG_VIEC_57, 58); chưa triển khai |
| MODULE_15 | Phân tích dữ liệu | Báo cáo quản trị toàn tập đoàn | 12 | Đã phát hành một phần: v0.4.0 (CONG_VIEC_50); chưa triển khai |
| MODULE_16 | Mở rộng kinh doanh | Dropship, Open API, trợ lý AI (quản lý sản xuất đã bỏ theo THAY_DOI_30) | 12 | Đã phát hành một phần: v0.7.0 (CONG_VIEC_61), v0.9.0 (CONG_VIEC_66), v0.11.0 (CONG_VIEC_62); trợ lý AI (CONG_VIEC_63) chưa bắt đầu; CONG_VIEC_64 đã hủy; chưa triển khai |
| MODULE_17 | iPOS | Ứng dụng bán hàng thuê bao cho cửa hàng liên kết: gói, thuê bao theo điểm bán, thu phí, bán tại quầy, ca, tồn kho đơn giản, báo cáo, đối soát trong ERP (THAY_DOI_39) | 13 | Đang thực hiện: CONG_VIEC_74 đợt 1 đã lập trình xong lát L0 đến L7, chờ nghiệm thu (in thật trên Sunmi T2, máy in Bluetooth, máy in mạng LAN, ngắt mạng thử trên máy thật khi nghiệm thu); đợt 2 (khuyến mãi, nhà cung cấp, bán nợ, bàn và món, màn hình phụ, tên miền riêng) chưa cấp mã; chưa phát hành |

"Đã phát hành một phần": đã phát hành các công việc nêu (tài liệu `03`, `23`). Mức hoàn thành so với toàn bộ chức năng của module ở tài liệu `05` chưa đối chiếu từng chức năng: **CHƯA XÁC ĐỊNH**.

## 5. Mốc phát hành

Các phiên bản đã phát hành (chi tiết, phương án quay lui: tài liệu `23`):

| Phiên bản | Nội dung chính | Ngày phát hành | Trạng thái |
|---|---|---|---|
| 0.1.0 | MODULE_01 (CONG_VIEC_01, 02) | 2026-11-09 | Đã phát hành, chưa triển khai |
| 0.2.0 | MODULE_01 hoàn thiện (CONG_VIEC_03) | 2026-11-09 | Đã phát hành, chưa triển khai |
| 0.3.0 | MODULE_02, 03, 04, 05, 06, 07; MODULE_09 phần lõi | 2026-11-11 | Đã phát hành, chưa triển khai |
| 0.4.0 | Đơn vị vận chuyển, cổng thanh toán (MODULE_09); ứng dụng kho; Nhân sự phần 1 đến 3; báo cáo quản trị phần 1 | 2026-11-11 | Đã phát hành, chưa triển khai |
| 0.5.0 | Nhập khẩu; Nhân sự phần 4; Cộng đồng phần 1; Điểm thưởng phần 1; Bán lẻ tại quầy L0 đến L5 | 2026-11-11 | Đã phát hành, chưa triển khai |
| 0.6.0 | Bán lẻ tại quầy L6; trạm giao hàng O2O; kế hoạch mua theo ngân sách; thành phần Kinh doanh của ứng dụng VComm | 2026-11-12 | Đã phát hành, chưa triển khai |
| 0.7.0 | Cửa hàng liên kết phần 1; Open API cho đối tác | 2026-11-12 | Đã phát hành, chưa triển khai |
| 0.8.0 | Văn phòng số phần 1; kế toán ngoại tệ và thuế hải quan | 2026-11-12 | Đã phát hành, chưa triển khai |
| 0.9.0 | Văn phòng số phần 2; Open API khách hàng do đối tác tạo | 2026-11-12 | Đã phát hành, chưa triển khai |
| 0.10.0 | Điểm thưởng phần 2; cửa hàng liên kết qua Open API | 2026-11-16 | Đã phát hành, chưa triển khai |
| 0.11.0 | Dropship; Điểm thưởng phần 3; chia sẻ sản phẩm lên mạng xã hội | 2026-11-16 | Đã phát hành, chưa triển khai |

Các mốc tiếp theo:

| Phiên bản | Nội dung | Ngày dự kiến | Trạng thái |
|---|---|---|---|
| Triển khai lần đầu | Đưa phiên bản đã phát hành lên môi trường thật (giai đoạn 12) | **CHƯA XÁC ĐỊNH** | Chưa bắt đầu |
| 1.0 | Hệ thống quản trị doanh nghiệp chạy thật cho mọi công ty con (tài liệu `05` mục 4) | **CHƯA XÁC ĐỊNH** | Chưa bắt đầu |
| Sau 1.0 | Phần còn lại của phạm vi tài liệu `05` mục 2 (gồm trợ lý AI, CONG_VIEC_63); thứ tự phiên bản **CHƯA XÁC ĐỊNH** | **CHƯA XÁC ĐỊNH** | Chưa bắt đầu |

Mốc ước lượng ban đầu (1.0 tháng thứ 9, 2.0 tháng thứ 15, 3.0 tháng thứ 20 kể từ khi bắt đầu) không còn dùng: THAY_DOI_04 làm tăng khối lượng khoảng gấp rưỡi và các module đã phát hành dần trong 0.x; mốc mới chưa được người dùng chốt.

## 6. Rủi ro và phương án xử lý

| Rủi ro | Mức | Phương án |
|---|---|---|
| Khối lượng tự xây lớn so với nguồn lực | Cao | Xây nhỏ – kiểm tra – tiếp tục; kiểm thử tự động từ đầu; kế toán trưởng rà soát nghiệp vụ; lập trình viên nhiều kinh nghiệm rà soát mã |
| Điểm thưởng dùng như tiền bị coi là ví điện tử | Cao | Hợp tác ngân hàng hoặc ví có giấy phép; không cho nạp, rút, chuyển điểm giữa người dùng; giới hạn phần trăm đơn |
| Cộng tác viên, giới thiệu bạn bè bị coi là đa cấp | Trung bình | Hoa hồng một tầng; thưởng giới thiệu một lần; hoa hồng đội kinh doanh chỉ cho nhân viên |
| Dữ liệu cá nhân lưu ở nước ngoài | Trung bình | Xin ý kiến luật sư sớm; tách dữ liệu khách hàng để có thể chuyển về đám mây trong nước |
| Đăng ký sàn thương mại điện tử với Bộ Công Thương | Thấp | Chuẩn bị hồ sơ trước giai đoạn 2 |
| Phụ thuộc tổ chức cung cấp dịch vụ xác thực điện tử cho VNeID: chi phí, thời gian được phê duyệt phương án kết nối | Trung bình | Chọn nhà cung cấp và ký hợp đồng trước khi phân tích MODULE_02 (THAY_DOI_02) |
| Sai sót hóa đơn, thuế | Trung bình | Tích hợp nhà cung cấp hóa đơn điện tử có API |
