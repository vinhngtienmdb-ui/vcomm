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

### THAY_DOI_04: Mở rộng phạm vi theo đối chiếu repo V-com-ERP – 2026-11-09
- Lý do: Người dùng yêu cầu đối chiếu chức năng của nguồn mã riêng V-com-ERP với dự án mới và chọn phương án rộng hơn cho từng nhóm. Bảng đối chiếu 85 nhóm chức năng (phiên con, 2026-11-09): 29 đã có, 20 có một phần, 36 chưa có. Người dùng chọn thêm toàn bộ các nhóm dưới đây.
- Nội dung thay đổi:

| Module | Chức năng thêm vào phạm vi | Nguồn tham khảo trong V-com-ERP |
|---|---|---|
| MODULE_01 Nền tảng | Thông báo qua Zalo ZNS (duyệt, nhắc quá hạn); biểu mẫu đề xuất tự do (phiếu chi, tạm ứng, mua sắm) đi qua luồng duyệt, mẫu in PDF | `src/services/znsService.ts`; trình ký nhiều cấp (MOD-21) |
| MODULE_02 Sản phẩm và Nhà bán | Hiệu suất, chế tài nhà bán; nhiều nhân viên trong một nhà bán; công bố thông tin sản phẩm, truy xuất nguồn gốc | MOD-07, MOD-09; `specs/012-vn-legal-compliance` |
| MODULE_06 Tài chính – Kế toán | Tài sản cố định, khấu hao, công cụ dụng cụ; khóa sổ theo kỳ; kê khai thuế giá trị gia tăng, thu nhập doanh nghiệp; đối chiếu sao kê ngân hàng, nhận chuyển khoản tự đối chiếu (SePay), đối soát thu hộ COD; khấu trừ thuế thu nhập cá nhân trên hoa hồng; IFRS 15 | `tt99Service.ts`, `bankReconciliationService.ts`, `sepayService.ts`, `commissionWithholdingService.ts`; `specs/007`, `009`, `021` |
| MODULE_07 Khách hàng và Đối tác | Chăm sóc khách hàng: phiếu hỗ trợ có thời hạn xử lý, tổng đài, hộp thư đa kênh; khách hàng tiềm năng, cơ hội, chiến dịch tự động | MOD-05, MOD-06; `specs/010-crm-loyalty-sla` |
| MODULE_08 Nhân sự | Tiếp nhận nhân viên mới, đào tạo, khen thưởng – kỷ luật; cổng tự phục vụ nhân viên | MOD-03, MOD-04; `payrollEngine.ts` |
| MODULE_09 Sàn thương mại điện tử | Nghĩa vụ thuế của sàn với nhà bán, ủy nhiệm lập hóa đơn thay nhà bán; giữ tiền đảm bảo, ví và rút tiền nhà bán; minh bạch thông tin sàn, bảo vệ thương hiệu, bảo vệ dữ liệu cá nhân; quảng cáo nội bộ; tìm kiếm toàn văn | `escrowService.ts`, `einvoiceService.ts`; `specs/025`, `027`, `028`, `030`; MOD-15, MOD-17 |
| MODULE_10 Cộng đồng | KOL, KOC, hoa hồng theo ngành hàng | MOD-14 |
| MODULE_13 Văn phòng số (mới) | Công việc, quy trình, công văn, chữ ký số, kho hợp đồng, bảng tin nội bộ | MOD-20 đến MOD-24 |
| MODULE_14 Bán lẻ tại quầy và trạm giao hàng (mới) | Bán hàng tại quầy (POS) cho cửa hàng, siêu thị tập đoàn tự vận hành; trạm giao hàng O2O; kế hoạch mua theo ngân sách (Open-to-Buy) | MOD-12, MOD-16; `specs/018-o2o-tach-hai-san-pham` |
| MODULE_15 Phân tích dữ liệu (mới) | Báo cáo quản trị toàn tập đoàn | MOD-01 |
| MODULE_16 Mở rộng kinh doanh (mới) | Dropship; Open API cho đối tác; trợ lý AI; quản lý sản xuất | MOD-07 (Dropship); `vcomm_ai_integration_guide.md` |

- Thành phần bị ảnh hưởng:
  - Tài liệu `04` mục 8 (yêu cầu cấp cao), `05` mục 1, 2, 3, 4, 5 (phạm vi, phạm vi ngoài, phiên bản, ưu tiên), `01` mục 4, 5, 6 (danh sách module, mốc, rủi ro), `13` mục 5 (chi phí hạ tầng tăng khi thêm module).
  - MODULE_01 đang làm: tài liệu `06`, `07`, `10`, `11`, `14`, `16`, `17`, `22`, `27` phải bổ sung yêu cầu, chức năng, màn hình, dữ liệu, API cho thông báo ZNS và biểu mẫu đề xuất; thêm lát vào CONG_VIEC_02 (sau L8). Các lát L1 đến L8 đã duyệt không đổi.
  - Các module khác chưa phân tích: phạm vi mới được dùng khi tới giai đoạn 03 của module đó.
- Dữ liệu bị ảnh hưởng: schema `core` thêm bảng mẫu đề xuất, đề xuất, nhật ký gửi ZNS (thiết kế ở giai đoạn 07 của phần bổ sung). Các schema khác chưa thiết kế.
- API bị ảnh hưởng: thêm API cho đề xuất và thông báo; không đổi API đã duyệt.
- Giao diện bị ảnh hưởng: thêm màn hình đề xuất, mẫu đề xuất; trang chủ thêm ô mini app Văn phòng số, Bán lẻ, Phân tích dữ liệu khi các module này được xây.
- Quyền bị ảnh hưởng: thêm quyền cho mini app mới; không đổi mô hình phân quyền.
- Ảnh hưởng chức năng cũ: không có mã nguồn đang chạy bị ảnh hưởng.
- Kiểm thử cần thực hiện: lập kịch bản mới cho phần bổ sung MODULE_01; các tiêu chí đã có không đổi.
- Mức quy mô: Lớn (module mới, nhiều module).
- Rủi ro: tổng khối lượng tăng khoảng gấp rưỡi; mốc phiên bản 1.0, 2.0, 3.0 trong tài liệu `01` phải ước lượng lại; nên chia thêm phiên bản thay vì làm cùng lúc.
- Trạng thái: Đã phê duyệt 2026-11-09 (chia thêm phiên bản; phần bổ sung MODULE_01 làm thành lát L9, L10)

### THAY_DOI_05: Cho người có quyền gán vai trò xem danh sách vai trò – 2026-11-09
- Lý do: MAN_HINH_13 cần danh sách vai trò để chọn khi gán (CHUC_NANG_13, quyền `platform.role.assign`), nhưng API_36 `GET /roles` chỉ cho quyền `platform.role.manage`. Người chỉ có quyền gán vai trò không mở được danh sách để chọn.
- Nội dung thay đổi: API_36 `GET /roles` cho phép người có `platform.role.manage` hoặc `platform.role.assign`; các thao tác tạo, sửa, đổi quyền vai trò vẫn chỉ cho `platform.role.manage`. Kết quả vai trò thêm trường `hasSensitive` để giao diện báo trước việc bật xác thực hai lớp (QUYTAC_NGHIEPVU_09).
- Thành phần bị ảnh hưởng: tài liệu `17` dòng API_36; tài liệu `22` ma trận phân quyền.
- Dữ liệu bị ảnh hưởng: không có.
- API bị ảnh hưởng: API_36 `GET /roles` (mở rộng quyền đọc, thêm một trường trả về; tương thích ngược).
- Giao diện bị ảnh hưởng: MAN_HINH_13 ngăn kéo "Gán vai trò".
- Quyền bị ảnh hưởng: người có `platform.role.assign` xem được tên và quyền của các vai trò trong công ty đang chọn.
- Ảnh hưởng chức năng cũ: không có.
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_52 đến 61 (đã chạy đạt trên nhánh CONG_VIEC_02).
- Mức quy mô: Nhỏ.
- Rủi ro: lộ danh sách quyền của vai trò cho người gán vai trò; mức thấp vì người gán vai trò đã thấy vai trò khi gán.
- Trạng thái: Đã phê duyệt 2026-11-09.
