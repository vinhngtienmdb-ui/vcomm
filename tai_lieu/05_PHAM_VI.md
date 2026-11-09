# 05. PHẠM VI

- Mô tả: Phạm vi sản phẩm, phạm vi chức năng, phạm vi ngoài, phạm vi từng phiên bản và thứ tự ưu tiên.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt

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
| Nền tảng | Công ty, chi nhánh, phòng ban; người dùng; đăng nhập bằng mật khẩu, Google, Microsoft, số điện thoại; xác thực hai lớp; vai trò và phân quyền theo phạm vi tập đoàn, công ty, chi nhánh; trang chủ mini app; duyệt chứng từ theo hạn mức; đánh số chứng từ; tiền tệ và tỷ giá; nhật ký thao tác | 1 |
| Sản phẩm và Nhà bán | Ngành hàng, sản phẩm, biến thể, mã hàng (SKU), thuộc tính, bảng giá; lô và hạn dùng; số serial, IMEI, bảo hành; duyệt sản phẩm của nhà bán; hợp đồng và biểu phí nhà bán | 2 |
| Kho | Nhiều kho, vị trí kệ; nhập, xuất, chuyển kho liên vùng; kiểm kê; tồn kho theo thời gian thực; tồn an toàn; quét mã vạch trên ứng dụng kho | 3 |
| Mua hàng | Đề nghị mua, đơn mua, nhận hàng; nhập khẩu bằng ngoại tệ, phân bổ chi phí nhập khẩu | 4 |
| Bán hàng | Đơn bán đa kênh; khuyến mãi; trả hàng; giao vận; giao dịch nội bộ giữa công ty con tự sinh đơn mua phía bên kia | 4 |
| Tài chính – Kế toán | Hệ thống tài khoản Thông tư 200; bút toán tự động từ chứng từ; thu chi; công nợ; chênh lệch tỷ giá; hóa đơn điện tử; đối soát nhà bán, cửa hàng, cổng thanh toán; hoa hồng cộng tác viên và đội kinh doanh; báo cáo tài chính từng công ty và hợp nhất | 5 |
| Khách hàng và Đối tác | Hồ sơ khách hàng, nhà cung cấp, nhà bán, cửa hàng liên kết; gán khách hàng cho nhân viên kinh doanh; ứng dụng nhân viên kinh doanh | 6 |
| Nhân sự | Hồ sơ nhân viên, hợp đồng; chấm công, nghỉ phép; tính lương gồm hoa hồng, bảo hiểm xã hội, thuế thu nhập cá nhân; tuyển dụng; đánh giá hiệu suất (KPI) | 6 |

### 2.2 Sàn thương mại điện tử (giai đoạn 2)

- Công ty tự bán và nhà bán bên ngoài bán trên cùng một giỏ hàng; đơn tách theo nhà bán và kho.
- Thanh toán qua cổng VNPay, MoMo, ZaloPay và khi nhận hàng; giao hàng qua GHN, GHTK, Viettel Post.
- Phí sàn: phần trăm trên đơn, gói thành viên, phí dịch vụ cộng thêm; cho phép miễn phí giai đoạn đầu.
- Cộng tác viên một tầng; mua chung; bảng tin cộng đồng có đánh giá đã mua hàng; giới thiệu bạn bè thưởng một lần.

### 2.3 Điểm thưởng và cửa hàng liên kết (giai đoạn 3)

- Điểm chung liên minh do công ty phát hành; nhà bán và cửa hàng mua điểm để tặng khách, được công ty trả tiền khi khách dùng điểm tại họ.
- Dùng điểm để đổi quà, voucher và trừ trực tiếp khi thanh toán, có giới hạn phần trăm giá trị đơn.
- Giá trị điểm và thời hạn điểm cấu hình được.
- Mã QR động tại quầy, hạn mức theo cửa hàng, cảnh báo giao dịch bất thường.

## 3. Phạm vi ngoài

| Nội dung | Lý do |
|---|---|
| Chuyển dữ liệu từ phần mềm cũ | Chưa có dữ liệu cũ; chỉ cần nhập danh mục bằng Excel |
| Tự xây cổng thanh toán, ví điện tử | Dùng đối tác có giấy phép |
| Tự xây hệ thống hóa đơn điện tử | Tích hợp nhà cung cấp có API |
| Tự xây dịch vụ vận chuyển | Tích hợp đơn vị vận chuyển |
| Hoa hồng cộng tác viên nhiều tầng | Rủi ro bị coi là kinh doanh đa cấp |
| Ngôn ngữ ngoài tiếng Việt và tiếng Anh | Chưa có nhu cầu |

## 4. Phạm vi phiên bản

| Phiên bản | Nội dung |
|---|---|
| 0.1 | Mini app Nền tảng |
| 0.2 | Sản phẩm và Nhà bán, Kho, ứng dụng kho |
| 0.3 | Mua hàng, Bán hàng, giao dịch nội bộ |
| 0.4 | Tài chính – Kế toán |
| 0.5 | Khách hàng và Đối tác, Nhân sự, ứng dụng nhân viên kinh doanh |
| 1.0 | Hệ thống quản trị doanh nghiệp chạy thật cho mọi công ty con |
| 2.x | Sàn thương mại điện tử cộng đồng |
| 3.x | Điểm thưởng và cửa hàng liên kết |

## 5. Danh sách ưu tiên

1. Nền tảng (mọi mini app phụ thuộc).
2. Sản phẩm và Kho (dữ liệu gốc cho mua bán, kế toán).
3. Mua hàng, Bán hàng.
4. Tài chính – Kế toán.
5. Khách hàng và Đối tác, Nhân sự.
6. Sàn thương mại điện tử.
7. Điểm thưởng và cửa hàng liên kết. Mô hình dữ liệu điểm được thiết kế từ giai đoạn 1.

## 6. Ranh giới

- Mọi chức năng không có trong mục 2 thuộc phạm vi ngoài cho đến khi người dùng phê duyệt qua tài liệu `24`.
- Phạm vi chi tiết của từng mini app được xác định ở giai đoạn 03, 04 cho mini app đó.
