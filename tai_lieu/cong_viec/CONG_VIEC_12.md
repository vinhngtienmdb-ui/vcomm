# CONG_VIEC_12: Khuyến mãi (MODULE_05, phần 3)

- Mô tả: Chương trình khuyến mãi giảm theo sản phẩm, giảm theo đơn, mua X tặng Y; điều kiện kênh, nhóm khách, thời gian; duyệt trước khi chạy; giới hạn ngân sách, số suất; tự áp dụng vào đơn bán.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Bán hàng: khuyến mãi); quyết định của người dùng ngày 2026-11-09 (khuyến mãi giảm theo sản phẩm, theo đơn, mua X tặng Y, điều kiện kênh, nhóm khách, thời gian) và ngày 2026-11-10 (cộng dồn, duyệt, ngoại lệ dưới giá vốn, giới hạn) trong tài liệu `02`.

## 1. Mục tiêu

Bộ phận kinh doanh khai báo chương trình khuyến mãi một lần, được duyệt rồi tự áp dụng đúng vào đơn bán thỏa điều kiện; người bán không phải tính tay; chương trình dừng khi hết thời gian, hết ngân sách hoặc hết suất.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_62 đến CHUC_NANG_64.

Ngoài phạm vi (công việc sau):
- Mã giảm giá (voucher), điểm thưởng (MODULE_11).
- Khuyến mãi trên sàn VComm (MODULE_09).
- Hạch toán chi phí khuyến mãi (MODULE_06).
- Khuyến mãi theo ngành hàng (chương trình chọn từng mặt hàng).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_37 | Khai báo chương trình khuyến mãi có điều kiện, được duyệt, tự áp dụng vào đơn bán, có giới hạn ngân sách, số suất | Quản lý kinh doanh, Nhân viên bán hàng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_62 | Chương trình khuyến mãi: loại (giảm theo sản phẩm, giảm theo đơn, mua X tặng Y), thời gian, kênh, nhóm khách, ngân sách, số suất; lập, sửa, gửi duyệt, rút, dừng | YCAU_NGHIEPVU_37 |
| CHUC_NANG_63 | Tự áp dụng khuyến mãi vào đơn bán khi lưu: giảm từng dòng, giảm theo đơn, thêm dòng hàng tặng | YCAU_NGHIEPVU_37 |
| CHUC_NANG_64 | Theo dõi đã dùng của chương trình (tiền đã giảm, số suất đã tặng), dừng áp dụng khi hết | YCAU_NGHIEPVU_37 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_79 | Chương trình thuộc công ty, có thời gian hiệu lực (từ ngày, đến ngày), kênh bán áp dụng (để trống: mọi kênh trừ kênh Nội bộ), nhóm khách áp dụng (để trống: mọi khách, kể cả người mua không lấy hóa đơn). Loại giảm theo sản phẩm: danh sách mặt hàng, mỗi mặt hàng một phần trăm giảm. Loại giảm theo đơn: ngưỡng tổng đơn gồm thuế, phần trăm giảm, mức giảm tối đa (để trống: không giới hạn). Loại mua X tặng Y: mặt hàng mua, số lượng mua (đơn vị cơ sở), mặt hàng tặng, số lượng tặng mỗi suất (đơn vị cơ sở) | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_80 | Chương trình đi luồng duyệt (loại chứng từ `sales.promotion`; chưa có chính sách duyệt thì hiệu lực ngay như các chứng từ khác). Sửa khi nháp, bị từ chối, đã rút. Chương trình đang chạy chỉ dừng được (ghi lý do), không sửa | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_81 | Áp dụng khi lưu đơn bán: chương trình đang chạy, ngày đơn trong thời gian hiệu lực, kênh và nhóm khách của đơn thỏa điều kiện, còn ngân sách, còn suất. Đơn bán nội bộ không áp dụng khuyến mãi. Mỗi dòng hàng chỉ một khuyến mãi theo sản phẩm, chọn phần trăm cao nhất; phần trăm khuyến mãi trừ trên giá bảng giá trước chiết khấu tay. Tổng đơn sau giảm theo sản phẩm đạt ngưỡng thì áp tối đa một khuyến mãi theo đơn, chọn số tiền giảm lớn nhất; tiền giảm chia cho các dòng (trừ dòng hàng tặng) theo tỷ lệ thành tiền gồm thuế. Mua X tặng Y tính riêng: số suất bằng phần nguyên của tổng số lượng mặt hàng mua chia số lượng mua; dòng hàng tặng giá 0, không sửa tay, tự tạo lại mỗi lần lưu | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_82 | Đã dùng của chương trình tính từ đơn bán đang chờ duyệt, đã xác nhận, đã giao đủ, đã đóng: tiền đã giảm (gồm thuế) và số suất đã tặng. Ngân sách (tổng tiền giảm tối đa, gồm thuế) và số suất tối đa để trống là không giới hạn. Lưu đơn chỉ áp chương trình còn đủ ngân sách, đủ suất cho đơn đó; gửi đơn khóa chương trình và kiểm lại, không còn đủ thì không gửi được, người bán lưu lại đơn để tính lại | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_83 | Phần giảm do khuyến mãi đã duyệt và dòng hàng tặng không tính ngoại lệ dưới giá vốn; giá so với giá vốn là giá sau chiết khấu tay, trước khuyến mãi. Chiết khấu tay vẫn kiểm mức tối đa như cũ (QUYTAC_NGHIEPVU_68). Dòng hàng tặng được giữ hàng, giao hàng, trả hàng như dòng thường | YCAU_NGHIEPVU_37 |
| QUYTAC_NGHIEPVU_84 | Chương trình hết thời gian thì không áp vào đơn lưu sau đó; đơn đã lưu giữ khuyến mãi đã áp cho đến khi lưu lại | YCAU_NGHIEPVU_37 |

## 5. Vai trò và quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `sales.promotion.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.promotion.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |

## 6. Luồng nghiệp vụ

1. Người có quyền quản lý khuyến mãi lập chương trình, gửi duyệt; duyệt xong chương trình chạy.
2. Nhân viên bán hàng lập đơn bán như cũ; khi lưu, hệ thống tự áp khuyến mãi theo dòng, theo đơn, thêm dòng hàng tặng.
3. Gửi đơn: kiểm lại ngân sách, suất; đơn đi tiếp luồng ngoại lệ, giữ hàng như cũ.
4. Người quản lý xem đã dùng của chương trình, dừng khi cần.

## 7. Màn hình

| Mã | Màn hình | Mô tả |
|---|---|---|
| MAN_HINH_45 | Khuyến mãi | Mini app Bán hàng; danh sách chương trình lọc trạng thái; lập, sửa, gửi duyệt, rút, dừng; đã dùng |
| MAN_HINH_42, 43 (sửa) | Đơn bán | Dòng có khuyến mãi hiện tên chương trình, phần trăm giảm; dòng hàng tặng; tiền giảm theo đơn |

## 8. Dữ liệu và API

- Database migration `0009_promotions.sql`: `sales.promotions`, `sales.promotion_items` (mặt hàng giảm theo sản phẩm), `sales.promotion_channels`, `sales.promotion_customer_groups`; dòng đơn bán thêm `promotion_id`, `promotion_percent`, `order_promotion_id`, `order_discount_amount`, `promotion_discount_net`, `is_gift`.
- Đã dùng tính từ dòng đơn bán, không lưu trùng.

| Mã | Đường dẫn | Mô tả |
|---|---|---|
| API_83 | `/sales/promotions` | Chương trình khuyến mãi: danh sách, chi tiết, lập, sửa, gửi, rút, dừng |

## 9. Điều kiện đặc biệt

- Không thêm thư viện. Dùng lại luồng duyệt, dãy số chứng từ, tra giá, tính tiền đơn bán có sẵn.

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_99 | CHUC_NANG_62 | Lập chương trình ba loại đúng dữ liệu; gửi duyệt, duyệt thì chạy, từ chối thì sửa được; đang chạy chỉ dừng được; người không có quyền không lập được | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_100 | CHUC_NANG_63 | Giảm theo sản phẩm chọn phần trăm cao nhất, trừ trước chiết khấu tay; giảm theo đơn khi đạt ngưỡng, chọn mức lớn nhất, có trần; mua X tặng Y thêm đúng số suất, dòng tặng giá 0 | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_101 | CHUC_NANG_63 | Không áp khi sai kênh, sai nhóm khách, ngoài thời gian, chương trình chưa chạy hoặc đã dừng, đơn bán nội bộ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_102 | CHUC_NANG_64 | Hết ngân sách, hết suất thì không áp vào đơn mới; gửi đơn vượt ngân sách bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_103 | CHUC_NANG_63 | Phần giảm do khuyến mãi, dòng hàng tặng không sinh ngoại lệ dưới giá vốn; chiết khấu tay vẫn kiểm; dòng hàng tặng được giữ hàng, giao hàng | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_104 | CHUC_NANG_62, 63 | Giao diện danh sách, soạn chương trình; đơn bán hiện khuyến mãi, dòng tặng trên máy tính và điện thoại | Trình duyệt | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_193 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Bán hàng ghi `sales`; khóa ngoại từ `sales` chỉ trỏ vào `sales`, `core`, `catalog`, `crm`.
- Tính khuyến mãi trong service đơn bán khi lưu, cùng giao dịch.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của các công việc đã nghiệm thu, trừ phần sửa ghi ở mục 7, 8.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Database migration 0009, quyền, chương trình khuyến mãi, duyệt, dừng | MAN_HINH_45; API_83 | TIEUCHI_NGHIEMTHU_99 |
| L1 | Áp dụng vào đơn bán, hàng tặng, ngân sách, suất, ngoại lệ | MAN_HINH_42, 43 | TIEUCHI_NGHIEMTHU_100 đến 104 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
