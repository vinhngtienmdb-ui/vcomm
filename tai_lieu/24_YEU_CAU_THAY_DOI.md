# 24. YÊU CẦU THAY ĐỔI

- Mô tả: Sổ quản lý yêu cầu thay đổi sau khi tài liệu đã được phê duyệt.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

### THAY_DOI_01: Đăng nhập bằng Zalo – 2026-11-09
- Lý do: Người dùng yêu cầu cho phép đăng nhập bằng tài khoản Zalo.
- Nội dung thay đổi:
  - Người mua, nhà bán, cửa hàng liên kết, nhân viên nội bộ đăng nhập được bằng Zalo (Zalo Login của Zalo for Developers).
  - Nhân viên nội bộ (MODULE_01): chỉ liên kết Zalo với tài khoản đã kích hoạt, từ hồ sơ cá nhân; không tự tạo tài khoản bằng Zalo, cùng nguyên tắc QUYTAC_NGHIEPVU_08. Lý do: Zalo không bảo đảm trả về email để đối chiếu với tài khoản đã mời.
  - Người mua (MODULE_09): đăng ký nhanh bằng Zalo, tạo tài khoản mới. Nhà bán (MODULE_09), cửa hàng liên kết (MODULE_12): quy tắc chi tiết xác định khi phân tích nghiệp vụ module đó.
- Thành phần bị ảnh hưởng:
  - Tài liệu đã phê duyệt: `04` mục 8 (thêm Zalo vào yêu cầu cấp cao), `05` mục 2.1, 2.2, 2.3; `06` YCAU_NGHIEPVU_05; `07` QUYTAC_NGHIEPVU_08; `10` thêm CHUC_NANG_24 "Liên kết và đăng nhập bằng Zalo", sửa CHUC_NANG_10 (liên kết Zalo trong hồ sơ cá nhân); `11` thêm tiêu chí nghiệm thu; `12` mục 3 (thêm Zalo vào đăng nhập liên kết); `13` (cách gọi API Zalo); `22` mục 2, 3, 5 (điểm tiếp nhận, khóa bí mật ứng dụng Zalo); `27`.
  - Tài liệu đang chờ duyệt: `14` (MAN_HINH_01 thêm nút Zalo, MAN_HINH_06 thêm liên kết Zalo).
- Dữ liệu bị ảnh hưởng: `core.user_identities.provider` thêm giá trị `zalo` (tài liệu `16`, bản nháp).
- API bị ảnh hưởng: thêm API bắt đầu đăng nhập Zalo và API nhận phản hồi; chưa có API nào đang chạy.
- Giao diện bị ảnh hưởng: MAN_HINH_01, MAN_HINH_06.
- Quyền bị ảnh hưởng: Không đổi ma trận phân quyền.
- Ảnh hưởng chức năng cũ: Không có mã nguồn đang chạy. Các cách đăng nhập khác giữ nguyên.
- Kiểm thử cần thực hiện: theo tài liệu `27`, các dòng của CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08, CHUC_NANG_10 và tiêu chí mới của CHUC_NANG_24 (liên kết, đăng nhập, Zalo chưa liên kết bị từ chối với nhân viên, hủy liên kết).
- Mức quy mô: Vừa đối với MODULE_01 (chức năng mới trong một module, thêm giá trị dữ liệu, không đổi kiến trúc).
- **CHƯA XÁC ĐỊNH:** đã có tài khoản Zalo Official Account hoặc ứng dụng trên Zalo for Developers của công ty chưa.
- Trạng thái: Đã phê duyệt 2026-11-09

### THAY_DOI_02: Xác thực nhà bán qua VNeID – 2026-11-09
- Lý do: Người dùng yêu cầu xác thực danh tính nhà bán bằng tài khoản định danh điện tử VNeID.
- Nội dung thay đổi:
  - Nhà bán cá nhân, hộ kinh doanh xác thực bằng tài khoản định danh điện tử cá nhân; nhà bán doanh nghiệp xác thực bằng tài khoản định danh điện tử của tổ chức.
  - Bắt buộc: nhà bán chưa xác thực thì không được đăng sản phẩm, không mở bán.
  - Căn cứ pháp lý đã tra cứu:
    - Nghị định 69/2024/NĐ-CP, Điều 18 khoản 5 được sửa đổi bởi Nghị định 320/2026/NĐ-CP (hiệu lực từ 28/9/2026): "Cơ quan, tổ chức có nhu cầu sử dụng dịch vụ xác thực điện tử thực hiện kết nối với hệ thống định danh và xác thực điện tử thông qua tổ chức cung cấp dịch vụ xác thực điện tử theo phương án, quy trình đã được Cơ quan quản lý, vận hành hệ thống định danh và xác thực điện tử phê duyệt." VComm là doanh nghiệp, không thuộc nhóm được kết nối trực tiếp, nên phải qua một tổ chức cung cấp dịch vụ xác thực điện tử.
    - Nghị định 69/2024/NĐ-CP, Điều 19 khoản 3: việc xác thực "phải được sự đồng ý của chủ thể danh tính điện tử thông qua việc xác nhận trên Ứng dụng định danh quốc gia, tin nhắn SMS qua số điện thoại chính chủ hoặc các hình thức xác nhận khác theo quy định."
    - Nghị định 69/2024/NĐ-CP, Điều 18 khoản 6, khoản 7 được sửa đổi bởi Nghị định 320/2026/NĐ-CP: phải lưu trữ, cung cấp lịch sử khai thác, sử dụng thông tin; không được chia sẻ kết quả xác thực cho bên khác, trừ khi chủ thể dữ liệu yêu cầu hoặc pháp luật có quy định khác.
- Thành phần bị ảnh hưởng:
  - Tài liệu đã phê duyệt: `04` mục 8 (thêm yêu cầu cấp cao), `05` mục 2.1 (MODULE_02 Sản phẩm và Nhà bán) và mục 2.2 (sàn); `12` mục 3 (thêm tích hợp tổ chức cung cấp dịch vụ xác thực điện tử); `13` (nhà cung cấp dịch vụ); `22` mục 1, 2, 5 (dữ liệu định danh nhà bán, điểm tiếp nhận, khóa bí mật); `01` mục 6 (rủi ro phụ thuộc nhà cung cấp, chi phí).
  - Không ảnh hưởng MODULE_01. Chi tiết nghiệp vụ lập khi phân tích MODULE_02.
- Dữ liệu bị ảnh hưởng: schema `catalog` (chưa thiết kế): trạng thái xác thực nhà bán, kết quả xác thực, lịch sử khai thác thông tin.
- API bị ảnh hưởng: Chưa có.
- Giao diện bị ảnh hưởng: trang quản lý nhà bán (chưa thiết kế).
- Quyền bị ảnh hưởng: Thêm quyền xem kết quả xác thực nhà bán cho vai trò kiểm duyệt nhà bán (xác định ở MODULE_02).
- Ảnh hưởng chức năng cũ: Không có.
- Kiểm thử cần thực hiện: Lập khi phân tích MODULE_02.
- Mức quy mô: Lớn (thêm tích hợp bên ngoài, thêm dữ liệu cá nhân nhạy cảm).
- **CHƯA XÁC ĐỊNH:** chọn tổ chức cung cấp dịch vụ xác thực điện tử nào; chi phí mỗi lượt xác thực; thời gian ký hợp đồng và được phê duyệt phương án kết nối.
- Trạng thái: Đã phê duyệt 2026-11-09

### THAY_DOI_03: Chuyển chế độ kế toán từ Thông tư 200 sang Thông tư 99/2025 – 2026-11-09
- Lý do: Thông tư 99/2025/TT-BTC (Bộ Tài chính, ban hành 27/10/2025, còn hiệu lực) Điều 31 khoản 1: "Thông tư này có hiệu lực thi hành kể từ ngày 01/01/2026 và áp dụng cho năm tài chính bắt đầu từ hoặc sau ngày 01/01/2026. Thông tư này thay thế cho các Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính hướng dẫn chế độ kế toán doanh nghiệp (trừ trường hợp quy định tại khoản 2 Điều này)…". Lựa chọn "Thông tư 200" do AI đưa ra ở đợt hỏi đáp ngày 2026-11-09 là sai. Phát hiện khi đọc nguồn mã riêng V-com-ERP (đã dùng Thông tư 99/2025).
- Đối chiếu trạng thái văn bản ngày 2026-11-09:

| Văn bản | Tình trạng hiệu lực | Ghi chú |
|---|---|---|
| Thông tư 200/2014/TT-BTC | Hết hiệu lực toàn bộ | Bị thay thế bởi Thông tư 99/2025/TT-BTC, trừ nội dung kế toán cổ phần hóa doanh nghiệp nhà nước nêu tại Điều 31 khoản 2 Thông tư 99/2025 |
| Thông tư 99/2025/TT-BTC | Còn hiệu lực, từ 01/01/2026 | Áp dụng cho năm tài chính bắt đầu từ hoặc sau 01/01/2026. Điều 31 khoản 3: doanh nghiệp vừa và nhỏ "được lựa chọn áp dụng Thông tư này", phải nhất quán tối thiểu một kỳ kế toán năm |
| Thông tư 133/2016/TT-BTC | Hết hiệu lực một phần | Văn bản tra cứu không ghi rõ phần nào hết hiệu lực; cần đối chiếu bản trên Công báo trước khi chốt. Điều 3 khoản 1 cho doanh nghiệp nhỏ và vừa chọn chế độ kế toán doanh nghiệp "và các văn bản sửa đổi, bổ sung hoặc thay thế", nay là Thông tư 99/2025 |

- Nội dung thay đổi: Chế độ kế toán mặc định của mọi công ty con là Thông tư 99/2025. Giữ lựa chọn Thông tư 133 cho công ty con là doanh nghiệp nhỏ và vừa nếu kế toán trưởng chọn. Thông tư 99/2025 Điều 31 khoản 3 cho doanh nghiệp vừa và nhỏ được lựa chọn áp dụng Thông tư 99/2025.
- Thành phần bị ảnh hưởng: tài liệu `04` mục 8.3; `05` mục 2.1 (Tài chính – Kế toán); `06` YCAU_NGHIEPVU_01; `10` CHUC_NANG_01 (giá trị mặc định); `16` cột `core.companies.accounting_regime`; MODULE_06 (hệ thống tài khoản, mẫu báo cáo) khi phân tích.
- Dữ liệu bị ảnh hưởng: `core.companies.accounting_regime` đổi tập giá trị thành `TT99_2025`, `TT133`; mặc định `TT99_2025`. Chưa có dữ liệu thật.
- API bị ảnh hưởng: API_20 (giá trị cho phép của trường chế độ kế toán).
- Giao diện bị ảnh hưởng: MAN_HINH_09 (hiển thị "Thông tư 99/2025").
- Quyền bị ảnh hưởng: Không có.
- Ảnh hưởng chức năng cũ: Không có mã nguồn đang chạy.
- Kiểm thử cần thực hiện: TIEUCHI_NGHIEMTHU_01, TIEUCHI_NGHIEMTHU_02 (tạo công ty với chế độ kế toán mặc định).
- Mức quy mô: Vừa.
- Trạng thái: Đã phê duyệt 2026-11-09
