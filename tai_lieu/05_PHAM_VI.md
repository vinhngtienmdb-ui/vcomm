# 05. PHẠM VI

- Mô tả: Phạm vi sản phẩm, phạm vi chức năng, phạm vi ngoài, phạm vi từng phiên bản và thứ tự ưu tiên.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); THAY_DOI_03 (2026-11-09); THAY_DOI_04 (2026-11-09)

## 1. Phạm vi sản phẩm

VComm gồm ba khối, ra mắt lần lượt:

| Khối | Gồm | Ra mắt |
|---|---|---|
| Hệ thống quản trị doanh nghiệp | 8 mini app: Nền tảng, Sản phẩm và Nhà bán, Kho, Mua hàng, Bán hàng, Tài chính – Kế toán, Khách hàng và Đối tác, Nhân sự; ứng dụng kho; ứng dụng nhân viên kinh doanh | Giai đoạn 1 |
| Sàn thương mại điện tử cộng đồng | Trang quản lý cho nhà bán; ứng dụng người mua; cộng tác viên; mua chung; bảng tin cộng đồng; giới thiệu bạn bè | Giai đoạn 2 |
| Điểm thưởng và cửa hàng liên kết | Ví điểm, hạng thành viên, đối soát liên minh, chống gian lận; công cụ cho cửa hàng liên kết quét mã QR tích và đổi điểm | Giai đoạn 3 |

## 2. Phạm vi chức năng

### 2.1 Hệ thống quản trị doanh nghiệp (giai đoạn 1)

| Mini app | Chức năng bắt buộc | Thứ tự |
|---|---|---|
| Nền tảng | Công ty, chi nhánh, phòng ban; người dùng; đăng nhập bằng mật khẩu, Google, Microsoft, Zalo, số điện thoại; xác thực hai lớp; vai trò và phân quyền theo phạm vi tập đoàn, công ty, chi nhánh; trang chủ mini app; duyệt chứng từ theo hạn mức; đánh số chứng từ; tiền tệ và tỷ giá; nhật ký thao tác | 1 |
| Sản phẩm và Nhà bán | Ngành hàng, sản phẩm, biến thể, mã hàng (SKU), thuộc tính, bảng giá; lô và hạn dùng; số serial, IMEI, bảo hành; duyệt sản phẩm của nhà bán; xác thực nhà bán qua VNeID, bắt buộc trước khi mở bán; hợp đồng và biểu phí nhà bán | 2 |
| Kho | Nhiều kho, vị trí kệ; nhập, xuất, chuyển kho liên vùng; kiểm kê; tồn kho theo thời gian thực; tồn an toàn; quét mã vạch trên ứng dụng kho | 3 |
| Mua hàng | Đề nghị mua, đơn mua, nhận hàng; nhập khẩu bằng ngoại tệ, phân bổ chi phí nhập khẩu | 4 |
| Bán hàng | Đơn bán đa kênh; khuyến mãi; trả hàng; giao vận; giao dịch nội bộ giữa công ty con tự sinh đơn mua phía bên kia | 4 |
| Tài chính – Kế toán | Hệ thống tài khoản Thông tư 99/2025 (Thông tư 133 cho công ty con nhỏ và vừa); bút toán tự động từ chứng từ; thu chi; công nợ; chênh lệch tỷ giá; hóa đơn điện tử; đối soát nhà bán, cửa hàng, cổng thanh toán; hoa hồng cộng tác viên và đội kinh doanh; báo cáo tài chính từng công ty và hợp nhất | 5 |
| Khách hàng và Đối tác | Hồ sơ khách hàng, nhà cung cấp, nhà bán, cửa hàng liên kết; gán khách hàng cho nhân viên kinh doanh; ứng dụng nhân viên kinh doanh | 6 |
| Nhân sự | Hồ sơ nhân viên, hợp đồng; chấm công, nghỉ phép; tính lương gồm hoa hồng, bảo hiểm xã hội, thuế thu nhập cá nhân; tuyển dụng; đánh giá hiệu suất (KPI) | 6 |

### 2.2 Sàn thương mại điện tử (giai đoạn 2)

- Công ty tự bán và nhà bán bên ngoài bán trên cùng một giỏ hàng; đơn tách theo nhà bán và kho.
- Thanh toán qua cổng VNPay, MoMo, ZaloPay và khi nhận hàng; giao hàng qua GHN, GHTK, Viettel Post.
- Phí sàn: phần trăm trên đơn, gói thành viên, phí dịch vụ cộng thêm; cho phép miễn phí giai đoạn đầu.
- Người mua, nhà bán đăng nhập được bằng Zalo; người mua đăng ký nhanh bằng Zalo.
- Cộng tác viên một tầng; mua chung; bảng tin cộng đồng có đánh giá đã mua hàng; giới thiệu bạn bè thưởng một lần.

### 2.3 Điểm thưởng và cửa hàng liên kết (giai đoạn 3)

- Điểm chung liên minh do công ty phát hành; nhà bán và cửa hàng mua điểm để tặng khách, được công ty trả tiền khi khách dùng điểm tại họ.
- Dùng điểm để đổi quà, voucher và trừ trực tiếp khi thanh toán, có giới hạn phần trăm giá trị đơn.
- Giá trị điểm và thời hạn điểm cấu hình được.
- Cửa hàng liên kết đăng nhập được bằng Zalo.
- Mã QR động tại quầy, hạn mức theo cửa hàng, cảnh báo giao dịch bất thường.

### 2.4 Phạm vi bổ sung theo THAY_DOI_04

| Module | Chức năng bổ sung |
|---|---|
| MODULE_01 Nền tảng | Thông báo qua Zalo ZNS; biểu mẫu đề xuất tự do (phiếu chi, tạm ứng, mua sắm) đi qua luồng duyệt, mẫu in PDF |
| MODULE_02 Sản phẩm và Nhà bán | Hiệu suất, chế tài nhà bán; nhiều nhân viên trong một nhà bán; công bố thông tin sản phẩm, truy xuất nguồn gốc |
| MODULE_06 Tài chính – Kế toán | Tài sản cố định, khấu hao, công cụ dụng cụ; khóa sổ theo kỳ; kê khai thuế giá trị gia tăng, thu nhập doanh nghiệp; đối chiếu sao kê ngân hàng, nhận chuyển khoản tự đối chiếu, đối soát thu hộ COD; khấu trừ thuế thu nhập cá nhân trên hoa hồng; IFRS 15 |
| MODULE_07 Khách hàng và Đối tác | Phiếu hỗ trợ có thời hạn xử lý, tổng đài, hộp thư đa kênh; khách hàng tiềm năng, cơ hội, chiến dịch tự động |
| MODULE_08 Nhân sự | Tiếp nhận nhân viên mới, đào tạo, khen thưởng – kỷ luật; cổng tự phục vụ nhân viên |
| MODULE_09 Sàn thương mại điện tử | Nghĩa vụ thuế của sàn với nhà bán, ủy nhiệm lập hóa đơn thay nhà bán; giữ tiền đảm bảo, ví và rút tiền nhà bán; minh bạch thông tin sàn, bảo vệ thương hiệu, bảo vệ dữ liệu cá nhân; quảng cáo nội bộ; tìm kiếm toàn văn |
| MODULE_10 Cộng đồng | KOL, KOC, hoa hồng theo ngành hàng |
| MODULE_13 Văn phòng số | Công việc, quy trình, công văn, chữ ký số, kho hợp đồng, bảng tin nội bộ |
| MODULE_14 Bán lẻ tại quầy và trạm giao hàng | Bán hàng tại quầy cho cửa hàng tập đoàn tự vận hành; trạm giao hàng O2O; kế hoạch mua theo ngân sách |
| MODULE_15 Phân tích dữ liệu | Báo cáo quản trị toàn tập đoàn |
| MODULE_16 Mở rộng kinh doanh | Dropship; Open API cho đối tác; trợ lý AI; quản lý sản xuất |

## 3. Phạm vi ngoài

| Nội dung | Lý do |
|---|---|
| Chuyển dữ liệu từ phần mềm cũ | Chưa có dữ liệu cũ; chỉ cần nhập danh mục bằng Excel |
| Tự xây cổng thanh toán, ví điện tử | Dùng đối tác có giấy phép |
| Tự xây hệ thống hóa đơn điện tử | Tích hợp nhà cung cấp có API |
| Tự xây dịch vụ vận chuyển | Tích hợp đơn vị vận chuyển |
| Hoa hồng cộng tác viên nhiều tầng | Rủi ro bị coi là kinh doanh đa cấp |
| Ngôn ngữ ngoài tiếng Việt và tiếng Anh | Chưa có nhu cầu |
| F2B2B, bán hàng qua livestream | Dự án V-com-ERP đã loại bỏ; không đưa vào THAY_DOI_04 |

## 4. Phạm vi phiên bản

| Phiên bản | Nội dung |
|---|---|
| 0.1 | Mini app Nền tảng (gồm thông báo ZNS, biểu mẫu đề xuất theo THAY_DOI_04) |
| 0.2 | Sản phẩm và Nhà bán, Kho, ứng dụng kho |
| 0.3 | Mua hàng, Bán hàng, giao dịch nội bộ |
| 0.4 | Tài chính – Kế toán |
| 0.5 | Khách hàng và Đối tác, Nhân sự, ứng dụng nhân viên kinh doanh |
| 1.0 | Hệ thống quản trị doanh nghiệp chạy thật cho mọi công ty con |
| 2.x | Sàn thương mại điện tử cộng đồng |
| 3.x | Điểm thưởng và cửa hàng liên kết |
| 4.x | Văn phòng số (MODULE_13) |
| 5.x | Bán lẻ tại quầy và trạm giao hàng (MODULE_14) |
| 6.x | Phân tích dữ liệu (MODULE_15), mở rộng kinh doanh (MODULE_16) |

## 5. Danh sách ưu tiên

1. Nền tảng (mọi mini app phụ thuộc).
2. Sản phẩm và Kho (dữ liệu gốc cho mua bán, kế toán).
3. Mua hàng, Bán hàng.
4. Tài chính – Kế toán.
5. Khách hàng và Đối tác, Nhân sự.
6. Sàn thương mại điện tử.
7. Điểm thưởng và cửa hàng liên kết. Mô hình dữ liệu điểm được thiết kế từ giai đoạn 1.
8. Văn phòng số.
9. Bán lẻ tại quầy và trạm giao hàng.
10. Phân tích dữ liệu, mở rộng kinh doanh.

## 6. Ranh giới

- Mọi chức năng không có trong mục 2 thuộc phạm vi ngoài cho đến khi người dùng phê duyệt qua tài liệu `24`.
- Phạm vi chi tiết của từng mini app được xác định ở giai đoạn 03, 04 cho mini app đó.
