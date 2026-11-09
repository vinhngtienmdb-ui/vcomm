# MẪU TÀI LIỆU

Mỗi tệp tài liệu mở đầu bằng:

```markdown
# <SỐ>. <TÊN TÀI LIỆU>

- Mô tả: <một câu mô tả mục đích>
- Phiên bản: <x.y>
- Ngày cập nhật: <YYYY-MM-DD>
- Trạng thái: Bản nháp | Chờ phê duyệt | Đã phê duyệt | Đang cập nhật (chỉ dùng cho tài liệu ghi liên tục như `02`, `03`, `25`)
```

Điểm chưa xác định ghi dạng: `**CHƯA XÁC ĐỊNH:** <nội dung cần người dùng xác nhận>`.

## Danh sách tài liệu

| Tài liệu | Nội dung |
|---|---|
| `01_KE_HOACH_TONG_THE.md` | Kế hoạch tổng thể |
| `02_NHAT_KY_DU_AN.md` | Nhật ký dự án theo ngày |
| `03_DANH_SACH_CONG_VIEC.md` | Danh sách công việc, đề xuất chờ phê duyệt |
| `04_TONG_QUAN_DU_AN.md` | Tổng quan dự án |
| `05_PHAM_VI.md` | Phạm vi trong và phạm vi ngoài |
| `06_YEU_CAU_NGHIEP_VU.md` | Yêu cầu nghiệp vụ |
| `07_QUY_TAC_NGHIEP_VU.md` | Quy tắc nghiệp vụ |
| `08_VAI_TRO_NGUOI_DUNG.md` | Vai trò và quyền hạn người dùng |
| `09_LUONG_NGHIEP_VU.md` | Luồng nghiệp vụ |
| `10_YEU_CAU_CHUC_NANG.md` | Đặc tả yêu cầu chức năng |
| `11_TIEU_CHI_NGHIEM_THU.md` | Tiêu chí nghiệm thu |
| `12_KIEN_TRUC_HE_THONG.md` | Kiến trúc hệ thống |
| `13_CONG_NGHE_SU_DUNG.md` | Công nghệ sử dụng |
| `14_DAC_TA_GIAO_DIEN.md` | Đặc tả giao diện |
| `15_HE_THONG_THIET_KE.md` | Quy tắc thiết kế giao diện thống nhất |
| `16_CO_SO_DU_LIEU.md` | Thiết kế cơ sở dữ liệu |
| `17_DAC_TA_API.md` | Đặc tả API |
| `18_QUY_TAC_PHAT_TRIEN_AI.md` | Quy tắc phát triển dành cho AI, quy ước Git, nguồn mã riêng của người dùng, cách chạy ứng dụng để xem trước (lệnh, cổng, tài khoản thử, dữ liệu giả) |
| `19_CHI_DAN_HE_THONG_AI.md` | Chỉ dẫn hệ thống cho AI |
| `20_KE_HOACH_KIEM_THU.md` | Kế hoạch kiểm thử |
| `21_KICH_BAN_KIEM_THU.md` | Kịch bản kiểm thử |
| `22_BAO_MAT.md` | Dữ liệu nhạy cảm, phân quyền, khóa bí mật, kết quả kiểm tra bảo mật, rủi ro đã chấp nhận, sự cố bảo mật |
| `23_LICH_SU_PHIEN_BAN.md` | Lịch sử phiên bản, phương án quay lui của từng phiên bản |
| `24_YEU_CAU_THAY_DOI.md` | Sổ quản lý yêu cầu thay đổi |
| `25_KET_QUA_KIEM_THU.md` | Kết quả kiểm thử và danh sách lỗi |
| `26_TRIEN_KHAI.md` | Môi trường, các bước triển khai, quy trình quay lui chung, biên bản triển khai |
| `27_MA_TRAN_TRUY_VET.md` | Ma trận truy vết: yêu cầu → chức năng → tiêu chí nghiệm thu → kịch bản kiểm thử → mã nguồn → kết quả |

## index.md

```markdown
# MỤC LỤC BỘ TÀI LIỆU THIẾT KẾ

- Dự án: <tên dự án>
- Ngày cập nhật: <YYYY-MM-DD>

| Số | Tệp | Tên tài liệu | Mô tả | Giai đoạn | Trạng thái |
|---|---|---|---|---|---|
| 01 | [01_KE_HOACH_TONG_THE.md](01_KE_HOACH_TONG_THE.md) | Kế hoạch tổng thể | Giai đoạn, mốc, tiến độ dự án | Toàn dự án | Bản nháp |
| 02 | [02_NHAT_KY_DU_AN.md](02_NHAT_KY_DU_AN.md) | Nhật ký dự án | Ghi nhận công việc theo ngày | Toàn dự án | Đang cập nhật |
| ... | | | | | |
```

## 01_KE_HOACH_TONG_THE.md

```markdown
## 1. Mục tiêu dự án

## 2. Phạm vi phiên bản hiện tại

## 3. Tiến độ theo giai đoạn

| Giai đoạn | Tài liệu đầu ra | Trạng thái | Ngày phê duyệt |
|---|---|---|---|
| 01 Xác định ý tưởng | 04 | Chưa bắt đầu | |
| ... đến 13 | | | |

## 4. Danh sách module

| Mã module | Tên module | Chức năng chính | Thứ tự xây dựng | Trạng thái |
|---|---|---|---|---|
| MODULE_01 | <tên> | CHUC_NANG_<số>, ... | 1 | Chưa bắt đầu |

## 5. Mốc phát hành

| Phiên bản | Nội dung | Ngày dự kiến | Trạng thái |
|---|---|---|---|

## 6. Rủi ro và phương án xử lý
```

## 02_NHAT_KY_DU_AN.md

Ngày mới nhất ở trên cùng.

```markdown
## YYYY-MM-DD
### Công việc đã thực hiện
- CONG_VIEC_<số>: <nội dung>
### Quyết định
- <quyết định> – người quyết định: <người dùng>
### Thay đổi
- <tệp hoặc thành phần>: <nội dung thay đổi>
### Vấn đề tồn đọng
- <vấn đề> – trạng thái: <chờ xác nhận / đang xử lý>
```

Sự cố khẩn cấp ghi thêm trong ngày phát sinh:

```markdown
### Sự cố LOI_<số> – <HH:MM>
- Hiện tượng:
- Phạm vi ảnh hưởng: <người dùng, dữ liệu, chức năng>
- Phiên bản đang chạy:
- Nguyên nhân trực tiếp:
- Xử lý: Quay lui | Sửa lỗi khẩn cấp phiên bản <x.y.z>
- Thời điểm khắc phục:
- Nguyên nhân gốc và biện pháp phòng ngừa đề xuất:
```

## 03_DANH_SACH_CONG_VIEC.md

Trạng thái: Chưa bắt đầu, Đang thực hiện, Cần sửa, Bị chặn, Đã nghiệm thu, chờ phát hành, Hoàn thành. Tài liệu này là sổ dùng chung, ghi theo mục 4 của SKILL.md.

```markdown
## Đang thực hiện

| Mã | Công việc | Module | Mức quy mô | Ưu tiên | Trạng thái | Nhánh | Ngày bắt đầu | Kết quả mong đợi (mức Nhỏ) | Định nghĩa hoàn thành | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|

## Chờ phê duyệt (đề xuất của AI)

| Mã | Đề xuất | Lý do | Ảnh hưởng | Quyết định |
|---|---|---|---|---|

## Hoàn thành

| Mã | Công việc | Ngày hoàn thành | Phiên bản | Định nghĩa hoàn thành |
|---|---|---|---|---|
```

Kết quả đối chiếu định nghĩa hoàn thành (mục 10 của SKILL.md) ghi ở cột "Định nghĩa hoàn thành" (và trong đặc tả công việc nếu có), dạng: "Đạt toàn bộ" hoặc "Đạt, trừ: <mục> – Không áp dụng – <lý do>". Bằng chứng: tài liệu `25` (kiểm thử, bảo mật phần B, C, tự rà soát mã, dọn dẹp), `27`; khi chuyển dòng sang bảng "Hoàn thành" thì giữ nguyên cột này.

## 10_YEU_CAU_CHUC_NANG.md (mỗi chức năng)

```markdown
### CHUC_NANG_<số>: <tên chức năng>
- Mục đích:
- Người sử dụng:
- Điều kiện thực hiện:
- Dữ liệu đầu vào:
- Quy trình xử lý:
- Kết quả đầu ra:
- Yêu cầu nghiệp vụ: YCAU_NGHIEPVU_<số>
- Quy tắc nghiệp vụ: QUYTAC_NGHIEPVU_<số>
- Trường hợp ngoại lệ:
- Phân quyền:
- Thông báo lỗi:
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_<số>
```

## 11_TIEU_CHI_NGHIEM_THU.md (mỗi tiêu chí)

```markdown
| Mã | Chức năng | Nội dung tiêu chí | Cách kiểm tra | Loại |
|---|---|---|---|---|
| TIEUCHI_NGHIEMTHU_<số> | CHUC_NANG_<số> | <khi … thì …> | <thao tác và kết quả mong đợi> | Bắt buộc / Mong muốn |
```

## 20_KE_HOACH_KIEM_THU.md

```markdown
## 1. Phạm vi kiểm thử
## 2. Loại kiểm thử áp dụng
| Loại | Công cụ | Lệnh chạy | Áp dụng cho |
|---|---|---|---|
| Kiểm thử đơn vị | | | |
| Kiểm thử tích hợp | | | |
| Kiểm thử đầu cuối | | | |
| Kiểm tra bảo mật (mục 17) | | | |
## 3. Môi trường và dữ liệu kiểm thử
## 4. Tiêu chí bắt đầu và kết thúc kiểm thử
```

## 21_KICH_BAN_KIEM_THU.md (mỗi kịch bản)

```markdown
### KICHBAN_KIEMTHU_<số>: <tên kịch bản>
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_<số>
- Loại: Đúng | Sai | Giá trị biên | Phân quyền | Bảo mật
- Vai trò thực hiện:
- Điều kiện ban đầu:
- Các bước:
- Kết quả mong đợi:
- Kiểm thử tự động: <tệp kiểm thử> | Thủ công – <lý do>
```

## 14_DAC_TA_GIAO_DIEN.md

```markdown
## 1. Danh sách màn hình và điều hướng
| Mã | Tên màn hình | Chức năng (10) | Vai trò được truy cập (08) | Mở từ | Bản mẫu |
|---|---|---|---|---|---|
| MAN_HINH_01 | <tên> | CHUC_NANG_<số> | <vai trò> | <menu hoặc MAN_HINH_<số>> | [MAN_HINH_01_<TEN>.html](ban_mau/MAN_HINH_01_<TEN>.html) |

Sơ đồ điều hướng: <sơ đồ dạng danh sách lồng nhau hoặc mermaid>

## 2. Bảng vai trò – màn hình
| Màn hình | <vai trò 1> | <vai trò 2> |
|---|---|---|
| MAN_HINH_01 | Xem, Sửa | Xem |

## 3. Đặc tả từng màn hình
### MAN_HINH_<số>: <tên màn hình>
- Mục đích:
- Chức năng thực hiện: CHUC_NANG_<số>
- Bố cục: <các vùng và thứ tự>
- Dữ liệu hiển thị: <trường dữ liệu, nguồn nghiệp vụ>
- Thành phần: <mô tả; tên thành phần trong tài liệu `15` bổ sung sau bước 06.3>
- API: <mã endpoint trong tài liệu `17`, bổ sung ở giai đoạn 07>
- Thao tác: <thao tác> → <kết quả>
- Trạng thái: có dữ liệu / rỗng / đang tải / lỗi / không có quyền – <cách hiển thị>
- Thông báo: <thành công, thất bại, xác nhận>
- Quyền hiển thị: <thành phần nào ẩn với vai trò nào>
- Responsive: <thay đổi bố cục theo điểm ngắt>
- Trạng thái phê duyệt: Bản nháp | Đã phê duyệt <YYYY-MM-DD>
```

## 15_HE_THONG_THIET_KE.md

```markdown
## 1. Nhận diện thương hiệu
- Logo:
- Phương án đã chọn: <phương án và ngày duyệt>

## 2. Bảng màu
| Tên biến | Giá trị | Mục đích | Tương phản với nền |
|---|---|---|---|
| mau-chinh | #<mã> | Nút chính, liên kết | <tỷ lệ> |
| mau-phu | | | |
| mau-nen | | | |
| mau-chu | | | |
| mau-thanh-cong / mau-canh-bao / mau-loi / mau-thong-tin | | | |

## 3. Kiểu chữ
- Phông chữ: <tên, nguồn, đã kiểm tra tiếng Việt có dấu>

| Tên biến | Cỡ chữ | Độ đậm | Chiều cao dòng | Dùng cho |
|---|---|---|---|---|

## 4. Khoảng cách, bo góc, đổ bóng
- Thang khoảng cách: <ví dụ 4, 8, 12, 16, 24, 32>
- Bo góc:
- Đổ bóng:

## 5. Điểm ngắt responsive
| Tên | Độ rộng | Thay đổi chính |
|---|---|---|

## 6. Thành phần dùng chung
| Thành phần | Biến thể | Trạng thái | Ghi chú sử dụng |
|---|---|---|---|
| Nút | chính, phụ, nguy hiểm | thường, di chuột, đang chọn, vô hiệu, đang xử lý | |
| Ô nhập | | thường, lỗi, vô hiệu | |
| Bảng, thông báo, hộp thoại xác nhận, trạng thái rỗng, trạng thái đang tải | | | |
```

## Phân tích giải pháp có sẵn (trong đặc tả công việc; ở giai đoạn 05 của dự án mới: trong tài liệu `13`)

```markdown
### Phân tích giải pháp có sẵn – <CONG_VIEC_<số> hoặc Giai đoạn 05> – <YYYY-MM-DD>
- Yêu cầu cần đáp ứng: YCAU_NGHIEPVU_<số>, QUYTAC_NGHIEPVU_<số>, CHUC_NANG_<số>
- Nguồn đã tìm: <nguồn riêng của người dùng>, <nguồn công cộng>
- Từ khóa đã dùng:

| Ứng viên | Nguồn | Giấy phép | Cập nhật gần nhất | Tương thích công nghệ | Bảo mật | Công sức điều chỉnh |
|---|---|---|---|---|---|---|
| <tên> | <đường dẫn> | | | | | Thấp / Trung bình / Cao |

| Mã yêu cầu hoặc quy tắc | <ứng viên 1> | <ứng viên 2> |
|---|---|---|
| YCAU_NGHIEPVU_<số> | Đáp ứng / Đáp ứng một phần / Không đáp ứng | |

- Phương án:
  1. Dùng lại nguyên trạng: <ứng viên>
  2. Dùng lại có điều chỉnh: <ứng viên, phần cần điều chỉnh>
  3. Tham khảo cách làm, tự viết: <ứng viên>
  4. Tự viết mới hoàn toàn
- Đề xuất: <phương án> – lý do:
- Quyết định của người dùng: <phương án> – <YYYY-MM-DD>
```

## Đặc tả một công việc (trong tài liệu `03`, hoặc `tai_lieu/cong_viec/CONG_VIEC_<số>.md` khi dài)

```markdown
### CONG_VIEC_<số>: <tên công việc>
1. Mục tiêu
2. Phạm vi
3. Yêu cầu nghiệp vụ
4. Quy tắc nghiệp vụ
5. Dữ liệu liên quan
6. Giao diện liên quan
7. API liên quan
8. Phân quyền
9. Điều kiện đặc biệt
10. Tiêu chí nghiệm thu
11. Kịch bản kiểm thử
12. Ràng buộc kỹ thuật
13. Thành phần không được thay đổi
14. Các lát và điểm xem trước: <lát> – <người dùng xem gì, thử thao tác nào> – <phản hồi, ngày>
15. Kết quả đối chiếu định nghĩa hoàn thành
```

## 22_BAO_MAT.md

```markdown
## 1. Dữ liệu nhạy cảm
| Dữ liệu | Loại | Cách lưu trữ | Vai trò được truy cập |
|---|---|---|---|
| Mật khẩu | Xác thực | Băm bằng <thuật toán> | Không ai đọc được |
| <dữ liệu> | Cá nhân / Tài chính / Khóa bí mật | Mã hóa / Băm / Thường | |

## 2. Điểm tiếp nhận dữ liệu từ bên ngoài
| Điểm | Loại | Kiểm tra đầu vào | Yêu cầu xác thực |
|---|---|---|---|
| <API hoặc biểu mẫu> | API / Biểu mẫu / Tải tệp lên / Tích hợp | | Có / Không |

## 3. Xác thực và phiên đăng nhập
- Cách xác thực:
- Thời hạn phiên đăng nhập:
- Giới hạn số lần thử:

## 4. Ma trận phân quyền
| Chức năng hoặc API | <vai trò 1> | <vai trò 2> | Chỉ dữ liệu của chính mình |
|---|---|---|---|
| CHUC_NANG_<số> | Được / Không | | Có / Không |

## 5. Quản lý khóa bí mật
| Khóa | Nơi lưu | Môi trường | Ngày đổi gần nhất | Trạng thái |
|---|---|---|---|---|
| <tên khóa> | | | | Đang dùng / Đã thu hồi (còn trong lịch sử Git, đã cấu hình bỏ qua khi quét) |

## 6. Kết quả kiểm tra phần E (vận hành)
Kết quả phần B, C ghi trong tài liệu `25`; phần D ghi trong biên bản tài liệu `26`.
### <YYYY-MM-DD> – Kiểm tra định kỳ
- Quét thư viện phụ thuộc: <lệnh> – <số lỗ hổng theo mức độ>
- Quét khóa bí mật toàn bộ lịch sử Git: <lệnh> – <kết quả>
- Log bất thường:
- Bản sao lưu được bảo vệ:
- Rủi ro đã chấp nhận hết hạn:
- Lỗ hổng phát hiện: LOI_<số> – <mức độ> – <quyết định>

## 7. Sự cố bảo mật
### <YYYY-MM-DD HH:MM> – LOI_<số> hoặc <mô tả ngắn nếu không cần sửa mã>
- Loại sự cố:
- Dữ liệu và người dùng bị ảnh hưởng:
- Khoảng thời gian bị ảnh hưởng:
- Khóa bí mật đã thu hồi và tạo mới:
- Xử lý:
- Quyết định thông báo (người dùng quyết định):

## 8. Rủi ro đã chấp nhận
| Lỗ hổng | Thư viện | Mức độ | Lý do chưa sửa | Biện pháp giảm thiểu | Người chấp nhận | Hạn xem lại | Trạng thái |
|---|---|---|---|---|---|---|---|
| LOI_<số> | | Cao | Chưa có bản vá | | <người dùng> | <YYYY-MM-DD> | Đang chấp nhận / Đã sửa <ngày> / Hết hạn |

Thư viện có bản vá thì đóng dòng bằng việc sửa (trạng thái "Đã sửa"). Dòng "Hết hạn" không còn được tính là đã xử lý trong cổng bảo mật cho tới khi người dùng gia hạn.
```

## 23_LICH_SU_PHIEN_BAN.md (mỗi phiên bản)

```markdown
## Phiên bản <x.y.z> – <YYYY-MM-DD> – Đã phát hành | Đã thu hồi
- Chức năng mới:
- Lỗi đã sửa:
- Thay đổi dữ liệu:
- Thay đổi API:
- Rủi ro:
- Khả năng tương thích:
- Công việc gộp trong phiên bản: CONG_VIEC_<số>, LOI_<số>
- Tag: <tag phiên bản> (gắn trên commit hợp nhất vào `main` sau khi kiểm thử lại đạt, hoặc trên nhánh khẩn cấp)
- Phương án quay lui riêng của phiên bản: <bước quay lui mã nguồn; cách đảo ngược hoặc khôi phục từng database migration; dữ liệu cần sao lưu thêm>
```

## 24_YEU_CAU_THAY_DOI.md (mỗi yêu cầu)

```markdown
### THAY_DOI_<số>: <tên thay đổi> – <YYYY-MM-DD>
- Lý do:
- Nội dung thay đổi:
- Thành phần bị ảnh hưởng:
- Dữ liệu bị ảnh hưởng:
- API bị ảnh hưởng:
- Giao diện bị ảnh hưởng:
- Quyền bị ảnh hưởng:
- Ảnh hưởng chức năng cũ:
- Kiểm thử cần thực hiện:
- Trạng thái: Chờ phê duyệt | Đã phê duyệt | Từ chối | Đã phát hành <v<x.y.z>> | Đã triển khai
```

## 25_KET_QUA_KIEM_THU.md (mỗi lần kiểm thử)

```markdown
## Lần kiểm thử <YYYY-MM-DD> – <CONG_VIEC_<số>, LOI_<số> hoặc phiên bản v<x.y.z>>
- Phạm vi: <chức năng mới, chức năng hồi quy>
- Môi trường:
- Lệnh đã chạy:
- Kết quả: <số đạt> đạt / <số không đạt> không đạt / <tổng số> kịch bản
- Tiêu chí nghiệm thu: TIEUCHI_NGHIEMTHU_<số> – Đạt | Không đạt
- Kiểm tra bảo mật phần B, C: <lệnh quét thư viện, quét khóa bí mật và kết quả; C3 đến C6: Đạt | Không áp dụng – lý do; OWASP Top 10: nhóm đã kiểm tra>
- Tự rà soát mã và dọn dẹp (lần kiểm thử cuối của công việc): Đạt | <mục chưa đạt>; còn giữ: <tệp hoặc dữ liệu> – lý do

### Danh sách lỗi
| Mã lỗi | Mô tả | Mức độ | Kịch bản liên quan | Quyết định xử lý | Trạng thái |
|---|---|---|---|---|---|

- Kết luận cổng kiểm thử: Đạt | Không đạt
```

## 26_TRIEN_KHAI.md

```markdown
## 1. Môi trường
| Môi trường | Địa chỉ | Cách triển khai | Người phê duyệt |
|---|---|---|---|
| Thử nghiệm (staging) | | | |
| Thật | | | |

## 2. Các bước triển khai
Dùng giống nhau cho môi trường thử nghiệm và môi trường thật. Ghi rõ thứ tự giữa database migration và triển khai mã, phù hợp với cách migration giữ tương thích.

1. Build từ tag: <lệnh>
2. Sao lưu môi trường đích, ngay trước khi triển khai: <lệnh hoặc thao tác>
3. <Database migration hoặc triển khai mã, theo thứ tự đã chọn>: <lệnh>
4. <Bước còn lại>: <lệnh>
5. Kiểm tra nhanh: <danh sách chức năng cần kiểm tra>

## 3. Quy trình quay lui chung
Phương án riêng của từng phiên bản ghi trong tài liệu `23`.

1. <bước quay lui mã nguồn về tag trước>
2. <bước khôi phục cơ sở dữ liệu từ bản sao lưu>

## 4. Biên bản triển khai
### <YYYY-MM-DD HH:MM> – Phiên bản <x.y.z> – <môi trường>
- Người phê duyệt:
- Commit và tag:
- Các bước đã thực hiện:
- Kiểm tra bản vá khẩn cấp đã có trong phiên bản:
- Kiểm tra bảo mật phần D: <quét lại, cấu hình môi trường, lỗ hổng phát hiện – quyết định> – Đạt | Không đạt
- Kết quả kiểm tra sau triển khai:
- Sự cố và xử lý:
- Kết luận: Thành công | Đã quay lui
```

## 27_MA_TRAN_TRUY_VET.md

Mỗi dòng là một tiêu chí nghiệm thu. Dùng mã đã có trong tài liệu nguồn, không đặt mã mới. Một yêu cầu có nhiều tiêu chí thì có nhiều dòng.

```markdown
## 1. Ma trận

| Yêu cầu nghiệp vụ (06) | Quy tắc (07) | Chức năng (10) | Màn hình (14) | Tiêu chí nghiệm thu (11) | Kịch bản kiểm thử (21) | Mã nguồn | Kiểm thử tự động | Kết quả gần nhất (25) | Phiên bản |
|---|---|---|---|---|---|---|---|---|---|
| YCAU_NGHIEPVU_<số> | QUYTAC_NGHIEPVU_<số> | CHUC_NANG_<số> | MAN_HINH_<số> hoặc Không có | TIEUCHI_NGHIEMTHU_<số> | KICHBAN_KIEMTHU_<số> | <tệp hoặc module> | <tệp kiểm thử> | Đạt / Không đạt / Chưa chạy – <YYYY-MM-DD> | <x.y.z> |

## 2. Kiểm tra bao phủ – <YYYY-MM-DD>

- Yêu cầu nghiệp vụ chưa có chức năng:
- Chức năng chưa có tiêu chí nghiệm thu:
- Chức năng cần giao diện nhưng chưa có màn hình:
- Tiêu chí nghiệm thu chưa có kịch bản kiểm thử:
- Kịch bản kiểm thử chưa có kiểm thử tự động: <kèm lý do nếu chỉ kiểm thử thủ công>
- Kịch bản chưa chạy hoặc kết quả Không đạt:
- Mã nguồn không truy được về yêu cầu nào:
- Kết luận: Đầy đủ | Còn thiếu <số> mục
```

Thời điểm cập nhật:
- Giai đoạn 04: điền cột yêu cầu, quy tắc, chức năng, tiêu chí nghiệm thu.
- Giai đoạn 06: điền cột màn hình.
- Khi viết tài liệu `21`: điền cột kịch bản kiểm thử.
- Giai đoạn 09: điền cột mã nguồn, kiểm thử tự động.
- Giai đoạn 10: điền kết quả cho các dòng thuộc phạm vi công việc, chạy kiểm tra bao phủ.
- Khi có yêu cầu thay đổi (tài liệu `24`): tra ma trận để xác định phạm vi ảnh hưởng và kiểm thử cần chạy lại.

## Các tài liệu còn lại

Mục lục nội dung lấy theo phần "Xử lý" và "Đầu ra" của giai đoạn tương ứng trong [GIAI_DOAN_VA_TIEU_CHI.md](GIAI_DOAN_VA_TIEU_CHI.md).
