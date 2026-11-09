# CONG_VIEC_04: Mini app Sản phẩm (MODULE_02, phần Sản phẩm)

- Mô tả: Ngành hàng, đơn vị tính, sản phẩm, biến thể, mã hàng, mã vạch, lô và serial theo ngành hàng, ảnh, nhập Excel, liên kết sản phẩm giữa công ty; kênh bán, nhóm khách hàng, bảng giá, điều chỉnh giá qua duyệt.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Nguồn: tài liệu `05` mục 2.1 (Sản phẩm và Nhà bán), tài liệu `04` mục yêu cầu cấp cao 4; quyết định của người dùng ngày 2026-11-09 (tài liệu `02`).

## 1. Mục tiêu

Mỗi công ty con có danh mục sản phẩm của mình, phân loại theo cây ngành hàng chung của tập đoàn, đủ thông tin để Kho, Mua hàng, Bán hàng dùng: mã hàng, biến thể, đơn vị tính quy đổi, mã vạch, cách theo dõi lô và serial, thuế suất, ảnh; và có bảng giá theo kênh bán, nhóm khách hàng, hiệu lực theo ngày, thay đổi giá có kiểm soát.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_30 đến CHUC_NANG_37 (mục 3, tài liệu `10` bổ sung).

Ngoài phạm vi:
- Phần Nhà bán: xác thực VNeID, hợp đồng, biểu phí, duyệt sản phẩm nhà bán, hiệu suất và chế tài nhà bán (công việc sau).
- Tồn kho, lô và serial thực tế (MODULE_03 Kho); giá mua, giá vốn (MODULE_04, MODULE_06); khuyến mãi (MODULE_05).
- Sản phẩm combo, bộ quà tặng; công bố thông tin sản phẩm, truy xuất nguồn gốc (THAY_DOI_04, làm cùng phần Nhà bán).
- Đồng bộ sản phẩm lên Shopee, Lazada, TikTok Shop.

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_22 | Mỗi công ty con quản lý danh mục sản phẩm của mình, phân loại theo một cây ngành hàng chung của tập đoàn | Quản lý sản phẩm, quản trị tập đoàn |
| YCAU_NGHIEPVU_23 | Sản phẩm có biến thể, nhiều đơn vị tính quy đổi, nhiều mã vạch, theo dõi lô và hạn dùng hoặc serial theo ngành hàng; nhập hàng loạt từ Excel | Quản lý sản phẩm, Kho, Bán hàng |
| YCAU_NGHIEPVU_24 | Giao dịch giữa công ty con biết sản phẩm tương ứng ở công ty bên kia | Kế toán, Mua hàng, Bán hàng |
| YCAU_NGHIEPVU_25 | Giá bán theo công ty, kênh bán, nhóm khách hàng, hiệu lực theo ngày; thay đổi giá được duyệt và lưu lịch sử | Ban giám đốc, Bán hàng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_30 | Quản lý cây ngành hàng và danh mục đơn vị tính dùng chung tập đoàn | YCAU_NGHIEPVU_22, 23 |
| CHUC_NANG_31 | Quản lý sản phẩm: thông tin chung, thuế suất, cách theo dõi lô, serial, bảo hành, thông số, ảnh, trạng thái | YCAU_NGHIEPVU_22, 23 |
| CHUC_NANG_32 | Biến thể, mã hàng tự sinh, đơn vị tính quy đổi, mã vạch | YCAU_NGHIEPVU_23 |
| CHUC_NANG_33 | Nhập sản phẩm từ Excel | YCAU_NGHIEPVU_23 |
| CHUC_NANG_34 | Liên kết sản phẩm tương ứng giữa công ty, sao chép sản phẩm sang công ty khác | YCAU_NGHIEPVU_24 |
| CHUC_NANG_35 | Danh mục kênh bán (có sẵn Bán sỉ, Bán lẻ, Sàn VComm, Nội bộ) và nhóm khách hàng của công ty | YCAU_NGHIEPVU_25 |
| CHUC_NANG_36 | Bảng giá, tra giá hiện hành và lịch sử giá | YCAU_NGHIEPVU_25 |
| CHUC_NANG_37 | Phiếu điều chỉnh giá qua luồng duyệt | YCAU_NGHIEPVU_25 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_37 | Ngành hàng dùng chung tập đoàn, tối đa 4 cấp; mã ngành hàng 2 đến 6 ký tự chữ in hoa, số, duy nhất, dùng làm tiền tố mã hàng. Ngành hàng có cài đặt mặc định: theo dõi lô và hạn dùng, theo dõi serial (gồm IMEI), số tháng bảo hành. Không xóa ngành hàng đã có sản phẩm hoặc ngành hàng con; chỉ ngừng dùng | YCAU_NGHIEPVU_22 |
| QUYTAC_NGHIEPVU_38 | Sản phẩm thuộc một công ty, một ngành hàng lá (không có ngành hàng con). Khi tạo, cách theo dõi lô, serial, bảo hành lấy theo ngành hàng; người dùng sửa được trên sản phẩm. Lô và serial không bật cùng lúc. Thuế suất giá trị gia tăng: 0%, 5%, 8%, 10%, không chịu thuế, không kê khai nộp thuế. Không xóa sản phẩm, chỉ ngừng bán | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_39 | Sản phẩm có tối đa 3 thuộc tính phân loại (ví dụ Màu, Kích cỡ), mỗi thuộc tính tối đa 30 giá trị, tối đa 200 biến thể. Sản phẩm không phân loại có đúng một biến thể. Mã hàng của sản phẩm tự sinh `<mã ngành hàng>-<5 chữ số>` theo công ty và ngành hàng; biến thể `<mã sản phẩm>-<2 chữ số>`, sản phẩm một biến thể dùng luôn mã sản phẩm; sửa được; duy nhất trong công ty | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_40 | Mỗi sản phẩm có một đơn vị cơ sở (đơn vị tồn kho) và tối đa 5 đơn vị quy đổi với hệ số so với đơn vị cơ sở (lớn hơn 0, tối đa 4 chữ số thập phân). Mã vạch gắn với biến thể và đơn vị; một biến thể nhiều mã vạch; mã vạch duy nhất trong công ty. Không đổi đơn vị cơ sở, hệ số khi sản phẩm đã phát sinh giao dịch (kiểm khi có MODULE_03) | YCAU_NGHIEPVU_23 |
| QUYTAC_NGHIEPVU_41 | Liên kết biến thể của hai công ty khác nhau, mỗi biến thể có tối đa một liên kết với mỗi công ty khác; hệ số quy đổi đơn vị cơ sở bên kia so với bên này (mặc định 1). Người liên kết phải có quyền quản lý sản phẩm ở cả hai công ty. Sao chép sản phẩm sang công ty khác tạo sản phẩm mới ở công ty đích và tự liên kết từng biến thể | YCAU_NGHIEPVU_24 |
| QUYTAC_NGHIEPVU_42 | Bảng giá thuộc một công ty, gắn tùy chọn một kênh bán và một nhóm khách hàng, một tiền tệ, đánh dấu giá gồm hay chưa gồm thuế giá trị gia tăng. Không có hai bảng giá đang dùng trùng công ty, kênh, nhóm khách hàng, tiền tệ. Chọn bảng giá khi bán theo thứ tự: trùng cả kênh và nhóm khách; chỉ trùng nhóm khách; chỉ trùng kênh; bảng giá chung (không kênh, không nhóm) | YCAU_NGHIEPVU_25 |
| QUYTAC_NGHIEPVU_43 | Giá đặt theo biến thể và đơn vị tính, kèm ngày hiệu lực; giá hiện hành tại một ngày là giá có ngày hiệu lực gần nhất không sau ngày đó. Đơn vị không có giá riêng thì lấy giá đơn vị cơ sở nhân hệ số. Lịch sử giá không sửa, không xóa | YCAU_NGHIEPVU_25 |
| QUYTAC_NGHIEPVU_44 | Giá chỉ thay đổi qua phiếu điều chỉnh giá: Nháp → Chờ duyệt → Đã duyệt (ghi giá vào lịch sử) hoặc Bị từ chối; Chờ duyệt → Đã rút. Ngày hiệu lực không trước ngày gửi. Phiếu đi qua chính sách duyệt của loại chứng từ "Phiếu điều chỉnh giá" với giá trị duyệt 0; công ty chưa có chính sách duyệt hiệu lực cho loại chứng từ này thì ghi giá ngay khi gửi. Số phiếu cấp từ dãy số chứng từ khi gửi. Bảng giá còn phiếu chờ duyệt thì không ngừng dùng được (quyết định ngày 2026-11-09) | YCAU_NGHIEPVU_25 |

## 5. Dữ liệu liên quan

Database migration `0003_catalog.sql`, schema `catalog` (tài liệu `16` bổ sung):

| Bảng | Nội dung chính |
|---|---|
| `catalog.categories` | Cha, mã, tên tiếng Việt, tiếng Anh, cấp, theo dõi lô, theo dõi serial, tháng bảo hành, trạng thái, phiên bản |
| `catalog.units` | Mã, tên tiếng Việt, tiếng Anh, trạng thái (dùng chung tập đoàn) |
| `catalog.code_counters` | Công ty, tiền tố, số tiếp theo (sinh mã hàng) |
| `catalog.products` | Công ty, nhà bán sở hữu (để trống: hàng của công ty; dùng ở phần Nhà bán), trạng thái duyệt (dùng ở phần Nhà bán), ngành hàng, mã, tên, mô tả, thương hiệu, xuất xứ, thuế suất, theo dõi lô, theo dõi serial, tháng bảo hành, đơn vị cơ sở, trọng lượng (kg), thể tích (m³) của đơn vị cơ sở, thuộc tính phân loại (JSON), thông số (JSON), trạng thái, phiên bản, người tạo, người sửa |
| `catalog.product_units` | Sản phẩm, đơn vị, hệ số quy đổi |
| `catalog.variants` | Sản phẩm, công ty, mã hàng, giá trị phân loại (JSON), trạng thái |
| `catalog.barcodes` | Công ty, biến thể, đơn vị, mã vạch (duy nhất theo công ty) |
| `catalog.variant_links` | Biến thể nguồn, biến thể đích (khác công ty), hệ số |
| `catalog.sales_channels` | Công ty, mã, tên, trạng thái |
| `catalog.customer_groups` | Công ty, mã, tên, trạng thái |
| `catalog.price_lists` | Công ty, mã, tên, kênh, nhóm khách hàng, tiền tệ, gồm thuế, trạng thái |
| `catalog.prices` | Bảng giá, biến thể, đơn vị, giá, ngày hiệu lực, phiếu điều chỉnh giá (chỉ thêm) |
| `catalog.product_images` | Sản phẩm, tên tệp, loại, kích thước, khóa lưu trữ, thứ tự |
| `catalog.price_changes` | Công ty, bảng giá, số phiếu, ngày hiệu lực, ghi chú, trạng thái, yêu cầu duyệt, người lập, phiên bản |
| `catalog.price_change_lines` | Phiếu, biến thể, đơn vị, giá mới, giá hiện hành lúc lập |

Ảnh sản phẩm lưu bảng `catalog.product_images` (mỗi module chỉ ghi vào schema của mình), nội dung tệp dùng lưu trữ tệp của CONG_VIEC_03. Loại chứng từ mới `catalog.price_change` "Phiếu điều chỉnh giá" (dãy số tiền tố `DCG`).

## 6. Giao diện liên quan

Mini app mới `apps/web-catalog`, đường dẫn `/catalog`, khung trang và thành phần dùng chung đưa vào `packages/ui` (tài liệu `12` mục 6).

| Mã | Màn hình | Ghi chú |
|---|---|---|
| MAN_HINH_22 | Ngành hàng và đơn vị tính | Cây ngành hàng (thêm, sửa, ngừng dùng, cài đặt lô, serial, bảo hành); thẻ Đơn vị tính |
| MAN_HINH_23 | Danh sách sản phẩm | Tìm theo tên, mã hàng, mã vạch; lọc ngành hàng, trạng thái; thêm; nhập Excel |
| MAN_HINH_24 | Chi tiết sản phẩm | Thẻ Thông tin, Biến thể và mã vạch, Đơn vị tính, Ảnh, Giá, Liên kết công ty; sao chép sang công ty khác |
| MAN_HINH_25 | Kênh bán và nhóm khách hàng | Hai thẻ; nút thêm kênh có sẵn (Bán sỉ, Bán lẻ, Sàn VComm, Nội bộ); không có sàn ngoài theo quyết định ngày 2026-11-09 |
| MAN_HINH_26 | Bảng giá | Danh sách bảng giá; xem giá hiện hành tại một ngày; lịch sử giá một biến thể |
| MAN_HINH_27 | Phiếu điều chỉnh giá | Danh sách, lập phiếu (chọn biến thể hoặc nhập Excel), gửi duyệt, rút; liên kết tới MAN_HINH_08 |

## 7. API liên quan

| Mã | Endpoint | Nội dung |
|---|---|---|
| API_55 | `/catalog/categories`, `/catalog/units` | Ngành hàng, đơn vị tính |
| API_56 | `/catalog/products` | Danh sách, chi tiết, tạo, sửa sản phẩm kèm biến thể, đơn vị, mã vạch |
| API_57 | `/catalog/products/{id}/images`, `/catalog/product-images/{id}`, `/catalog/product-images/{id}/primary` | Tải lên, xem, đặt ảnh đại diện, xóa ảnh sản phẩm |
| API_58 | `/catalog/product-imports/template`, `/catalog/product-imports` | Tệp mẫu, nhập Excel |
| API_59 | `/catalog/products/{id}/links`, `/catalog/products/{id}/link-suggestions`, `/catalog/variant-links`, `/catalog/products/{id}/copy` | Liên kết biến thể giữa công ty, gợi ý theo mã vạch, sao chép sản phẩm |
| API_60 | `/catalog/sales-channels` (kèm `/defaults`), `/catalog/customer-groups` | Kênh bán, nhóm khách hàng |
| API_61 | `/catalog/price-lists`, `/catalog/price-lists/{id}/prices`, `/catalog/price-lists/{id}/history`, `/catalog/prices/lookup` | Bảng giá, giá hiện hành, lịch sử giá, tra giá |
| API_62 | `/catalog/price-changes` (kèm `/import-template`, `/import-lines`, `/{id}/submit`, `/{id}/withdraw`) | Phiếu điều chỉnh giá |

## 8. Phân quyền

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `catalog.access` | Công ty | Không | (đã có) Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.category.manage` | Tập đoàn | Không | Quản trị tập đoàn |
| `catalog.product.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.product.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.manage` | Công ty | Có | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý sản phẩm" (`catalog_manager`): `catalog.access`, `catalog.product.view`, `catalog.product.manage`, `catalog.price.view`.

## 9. Điều kiện đặc biệt

- Ảnh: JPG, PNG, WEBP, mỗi ảnh tối đa 5 MB, tối đa 10 ảnh mỗi sản phẩm, kiểm tra nội dung tệp; ảnh đầu tiên là ảnh đại diện.
- Nhập Excel: tối đa 2.000 dòng mỗi lần, mỗi dòng một biến thể; dòng lỗi trả về tệp lỗi như nhập nhân viên (API_27); dòng đúng vẫn được nhập.
- Tiền: lưu chuỗi thập phân, số chữ số lẻ theo tiền tệ (VND 0).
- Tìm kiếm sản phẩm theo tên không phân biệt dấu tiếng Việt.
- Thiết kế sẵn cho các module sau (quyết định ngày 2026-11-09, tài liệu `02`): sản phẩm nhà bán chung bảng sản phẩm (cột nhà bán sở hữu, trạng thái duyệt; chưa có màn hình); trọng lượng, thể tích phục vụ phân bổ chi phí nhập khẩu (MODULE_04); kênh "Nội bộ" cho giá bán giữa công ty con (MODULE_05).

## 10. Tiêu chí nghiệm thu

| Mã | Chức năng | Tiêu chí | Cách kiểm tra | Mức |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_56 | CHUC_NANG_30 | Chỉ quản trị tập đoàn sửa được ngành hàng, đơn vị tính; ngành hàng quá 4 cấp, trùng mã, xóa khi có sản phẩm bị từ chối | Gọi API bằng từng vai trò | Bắt buộc |
| TIEUCHI_NGHIEMTHU_57 | CHUC_NANG_31, 32 | Tạo sản phẩm có 2 thuộc tính phân loại sinh đủ biến thể với mã hàng đúng quy tắc; sản phẩm của công ty A không đọc, sửa được từ công ty B | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_58 | CHUC_NANG_32 | Mã hàng, mã vạch trùng trong công ty bị từ chối, chỉ ra đúng dòng; hệ số quy đổi sai bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_59 | CHUC_NANG_33 | Nhập 2.000 dòng trong 30 giây; dòng lỗi có trong tệp lỗi kèm lý do, dòng đúng được nhập | Kiểm thử tự động | Bắt buộc |
| TIEUCHI_NGHIEMTHU_60 | CHUC_NANG_34 | Sao chép sản phẩm sang công ty khác tạo đủ biến thể, đơn vị, mã vạch và liên kết; người không có quyền ở công ty đích bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_61 | CHUC_NANG_35, 36 | Tạo hai bảng giá đang dùng trùng công ty, kênh, nhóm khách, tiền tệ bị từ chối; tra giá chọn đúng bảng giá theo thứ tự ưu tiên và đúng giá theo ngày | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_62 | CHUC_NANG_37 | Phiếu điều chỉnh giá: có chính sách duyệt thì giá chỉ đổi sau khi duyệt; không có chính sách thì đổi ngay khi gửi; bị từ chối, rút thì giá không đổi; lịch sử giá giữ giá cũ | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_63 | CHUC_NANG_31 | Ảnh sai loại, quá 5 MB, quá 10 ảnh bị từ chối | Gọi API | Bắt buộc |
| TIEUCHI_NGHIEMTHU_64 | CHUC_NANG_31 | Tìm "ao thun" ra sản phẩm "Áo thun"; danh sách 10.000 sản phẩm trả trang đầu dưới 500 ms | Kiểm thử tự động | Mong muốn |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_133 trở đi (tài liệu `21`), viết khi làm từng lát.

## 12. Ràng buộc kỹ thuật

- Không thêm thư viện: Excel dùng `read-excel-file`, `write-excel-file` (đã có), ảnh dùng lưu trữ tệp của CONG_VIEC_03.
- Tìm không dấu: cột `search_text` (tên, mã đã bỏ dấu, chữ thường) do API ghi; không cần extension PostgreSQL.
- Khóa ngoại từ `catalog` chỉ trỏ vào `catalog` và `core`.

## 13. Thành phần không được thay đổi

API, dữ liệu, giao diện của phiên bản 0.2.0. Riêng thành phần giao diện của `apps/web-platform` được chuyển sang `packages/ui` không đổi hành vi.

## 14. Các lát và điểm xem trước

| Lát | Nội dung | Màn hình, API | Tiêu chí |
|---|---|---|---|
| L0 | Chuyển khung trang, biểu mẫu, gọi API sang `packages/ui`; tạo `apps/web-catalog` | Trang chủ mini app mở được Sản phẩm | Hồi quy web-platform |
| L1 | Ngành hàng, đơn vị tính | MAN_HINH_22; API_55 | TIEUCHI_NGHIEMTHU_56 |
| L2 | Sản phẩm, biến thể, mã hàng, đơn vị, mã vạch, ảnh | MAN_HINH_23, 24; API_56, 57 | TIEUCHI_NGHIEMTHU_57, 58, 63, 64 |
| L3 | Nhập Excel; liên kết, sao chép giữa công ty | MAN_HINH_23, 24; API_58, 59 | TIEUCHI_NGHIEMTHU_59, 60 |
| L4 | Kênh bán, nhóm khách, bảng giá, phiếu điều chỉnh giá | MAN_HINH_25, 26, 27; API_60, 61, 62 | TIEUCHI_NGHIEMTHU_61, 62 |

Người dùng cho AI làm tiếp không dừng ở điểm xem trước; AI chụp màn hình và báo sau mỗi lát.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
