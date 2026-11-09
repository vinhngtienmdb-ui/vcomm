# 01. KẾ HOẠCH TỔNG THỂ

- Mô tả: Mục tiêu, phạm vi phiên bản, tiến độ giai đoạn, danh sách module, mốc phát hành, rủi ro.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp

## 1. Mục tiêu dự án

Xây dựng VComm: hệ thống quản trị doanh nghiệp (ERP) tập trung cho tập đoàn, sàn thương mại điện tử cộng đồng và điểm thưởng dùng chung với cửa hàng liên kết. Chi tiết: tài liệu `04`.

## 2. Phạm vi phiên bản hiện tại

Phiên bản 0.1: mini app Nền tảng (MODULE_01). Chi tiết: tài liệu `05` mục 4.

## 3. Tiến độ theo giai đoạn

| Giai đoạn | Tài liệu đầu ra | Trạng thái | Ngày phê duyệt |
|---|---|---|---|
| 01 Xác định ý tưởng | 04 | Đã phê duyệt | 2026-11-09 |
| 02 Xác định phạm vi | 05 | Đã phê duyệt | 2026-11-09 |
| 03 Phân tích nghiệp vụ | 06, 07, 08, 09 | Đã phê duyệt (MODULE_01) | 2026-11-09 |
| 04 Đặc tả yêu cầu | 10, 11, 27 | Chờ phê duyệt (MODULE_01) | |
| 05 Kiến trúc hệ thống | 12, 13, 22 | Bản nháp 12, 13 (lập trước, rà soát lại sau giai đoạn 04) | |
| 06 Giao diện | 14, 15, bản mẫu | Chưa bắt đầu | |
| 07 Dữ liệu và API | 16, 17 | Bản nháp 16 schema `core` (rà soát lại sau giai đoạn 04) | |
| 08 Chuẩn bị môi trường AI | 18, 19 | Chưa bắt đầu | |
| 09 Xây dựng theo module | Mã nguồn | Chưa bắt đầu | |
| 10 Kiểm thử | 20, 21, 22, 25 | Chưa bắt đầu | |
| 11 Nghiệm thu và phát hành | 23 | Chưa bắt đầu | |
| 12 Triển khai | 26 | Chưa bắt đầu | |
| 13 Vận hành và cải tiến | 24 | Chưa bắt đầu | |

Giai đoạn 03, 04 làm lần lượt cho từng module theo thứ tự xây dựng, bắt đầu từ MODULE_01.

## 4. Danh sách module

| Mã module | Tên module | Chức năng chính | Thứ tự xây dựng | Trạng thái |
|---|---|---|---|---|
| MODULE_01 | Nền tảng | Tổ chức, đăng nhập, phân quyền, trang chủ mini app, duyệt chứng từ, đánh số chứng từ, tỷ giá, nhật ký thao tác | 1 | Chưa bắt đầu |
| MODULE_02 | Sản phẩm và Nhà bán | Ngành hàng, sản phẩm, biến thể, lô, serial, bảng giá, nhà bán | 2 | Chưa bắt đầu |
| MODULE_03 | Kho | Kho, vị trí, nhập, xuất, chuyển, kiểm kê, ứng dụng kho | 3 | Chưa bắt đầu |
| MODULE_04 | Mua hàng | Đề nghị mua, đơn mua, nhận hàng, nhập khẩu | 4 | Chưa bắt đầu |
| MODULE_05 | Bán hàng | Đơn bán đa kênh, khuyến mãi, trả hàng, giao dịch nội bộ | 4 | Chưa bắt đầu |
| MODULE_06 | Tài chính – Kế toán | Bút toán, công nợ, tỷ giá, hóa đơn điện tử, đối soát, hoa hồng, báo cáo hợp nhất | 5 | Chưa bắt đầu |
| MODULE_07 | Khách hàng và Đối tác | Khách hàng, nhà cung cấp, cửa hàng liên kết, ứng dụng nhân viên kinh doanh | 6 | Chưa bắt đầu |
| MODULE_08 | Nhân sự | Hồ sơ, hợp đồng, chấm công, lương, tuyển dụng, đánh giá hiệu suất | 6 | Chưa bắt đầu |
| MODULE_09 | Sàn thương mại điện tử | Trang nhà bán, ứng dụng người mua, giỏ hàng, thanh toán, giao hàng | 7 | Chưa bắt đầu |
| MODULE_10 | Cộng đồng | Cộng tác viên, mua chung, bảng tin, giới thiệu bạn bè | 8 | Chưa bắt đầu |
| MODULE_11 | Điểm thưởng | Sổ cái điểm, hạng thành viên, đối soát liên minh, chống gian lận | 9 | Chưa bắt đầu |
| MODULE_12 | Cửa hàng liên kết | Quét mã QR tích và đổi điểm, voucher, báo cáo cửa hàng | 9 | Chưa bắt đầu |

## 5. Mốc phát hành

| Phiên bản | Nội dung | Ngày dự kiến | Trạng thái |
|---|---|---|---|
| 0.1 | MODULE_01 | **CHƯA XÁC ĐỊNH** | Chưa bắt đầu |
| 1.0 | MODULE_01 đến MODULE_08 | Tháng thứ 9 kể từ khi bắt đầu (ước lượng) | Chưa bắt đầu |
| 2.0 | MODULE_09, MODULE_10 | Tháng thứ 15 (ước lượng) | Chưa bắt đầu |
| 3.0 | MODULE_11, MODULE_12 | Tháng thứ 20 (ước lượng) | Chưa bắt đầu |

Các mốc tháng là ước lượng ban đầu, chốt lại sau giai đoạn 04 của từng module.

## 6. Rủi ro và phương án xử lý

| Rủi ro | Mức | Phương án |
|---|---|---|
| Khối lượng tự xây lớn so với nguồn lực | Cao | Xây nhỏ – kiểm tra – tiếp tục; kiểm thử tự động từ đầu; kế toán trưởng rà soát nghiệp vụ; lập trình viên nhiều kinh nghiệm rà soát mã |
| Điểm thưởng dùng như tiền bị coi là ví điện tử | Cao | Hợp tác ngân hàng hoặc ví có giấy phép; không cho nạp, rút, chuyển điểm giữa người dùng; giới hạn phần trăm đơn |
| Cộng tác viên, giới thiệu bạn bè bị coi là đa cấp | Trung bình | Hoa hồng một tầng; thưởng giới thiệu một lần; hoa hồng đội kinh doanh chỉ cho nhân viên |
| Dữ liệu cá nhân lưu ở nước ngoài | Trung bình | Xin ý kiến luật sư sớm; tách dữ liệu khách hàng để có thể chuyển về đám mây trong nước |
| Đăng ký sàn thương mại điện tử với Bộ Công Thương | Thấp | Chuẩn bị hồ sơ trước giai đoạn 2 |
| Sai sót hóa đơn, thuế | Trung bình | Tích hợp nhà cung cấp hóa đơn điện tử có API |
