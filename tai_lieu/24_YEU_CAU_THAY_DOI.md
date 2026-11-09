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
