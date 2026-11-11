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

### THAY_DOI_06: Quản trị công ty có quyền truy cập mọi mini app – 2026-11-09
- Lý do: Theo QUYTAC_NGHIEPVU_14, quản trị công ty không cấp được quyền mình không có. Vai trò Quản trị công ty chỉ có quyền `platform`, nên không gán được vai trò nghiệp vụ (Thủ kho, Mua hàng…) cho nhân viên công ty mình (phát hiện ở lát L2).
- Nội dung thay đổi: Vai trò hệ thống Quản trị công ty có thêm quyền `<mini app>.access` của mọi mini app, gồm cả Tài chính – Kế toán và Nhân sự (quyền nhạy cảm).
- Thành phần bị ảnh hưởng: tài liệu `08` mục 1 (dòng Quản trị công ty); `22` ma trận phân quyền; danh mục vai trò hệ thống trong mã.
- Dữ liệu bị ảnh hưởng: bảng `core.role_permissions` của vai trò `company_admin` (đồng bộ khi khởi động).
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: trang chủ của quản trị công ty hiện mọi mini app.
- Quyền bị ảnh hưởng: quản trị công ty truy cập được mọi mini app trong công ty mình và gán được vai trò có các quyền này.
- Ảnh hưởng chức năng cũ: quản trị công ty đang có vai trò bị bật bắt buộc xác thực hai lớp khi được gán lại (QUYTAC_NGHIEPVU_09, vai trò có quyền nhạy cảm).
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_52 đến 61, 66 đến 69; thêm kịch bản quản trị công ty gán vai trò Thủ kho.
- Mức quy mô: Vừa (đổi phân quyền vai trò hệ thống).
- Rủi ro: quản trị công ty có quyền rộng hơn; giảm thiểu bằng bắt buộc xác thực hai lớp và nhật ký thao tác.
- Trạng thái: Đã phê duyệt 2026-11-09.

### THAY_DOI_07: Tài khoản phải có email hoặc số điện thoại – 2026-11-09
- Lý do: Tài khoản chỉ có tên đăng nhập không nhận được đường dẫn kích hoạt, đặt lại mật khẩu (phát hiện ở lát L4).
- Nội dung thay đổi: QUYTAC_NGHIEPVU_05 đổi thành: tài khoản phải có email hoặc số điện thoại; tên đăng nhập là định danh thêm, không bắt buộc. Email, số điện thoại, tên đăng nhập duy nhất toàn hệ thống (giữ nguyên).
- Thành phần bị ảnh hưởng: tài liệu `07` QUYTAC_NGHIEPVU_05; `10` CHUC_NANG_04 (dữ liệu đầu vào, thông báo lỗi); `16` ràng buộc bảng `users` (kiểm tra ở tầng ứng dụng, không đổi database migration đã chạy).
- Dữ liệu bị ảnh hưởng: không có dữ liệu thật; dữ liệu thử đều có email.
- API bị ảnh hưởng: API_25, API_27, API_29 từ chối khi thiếu cả email và số điện thoại.
- Giao diện bị ảnh hưởng: gợi ý ô nhập ở ngăn kéo mời, sửa nhân viên.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_12 đến 21; thêm trường hợp mời chỉ bằng tên đăng nhập bị từ chối.
- Mức quy mô: Nhỏ.
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-09.

### THAY_DOI_08: Màn hình Cài đặt tích hợp, mã OTP qua Zalo ZNS – 2026-11-09
- Lý do: Người dùng yêu cầu viết sẵn kết nối Google, Microsoft, Zalo, SMS, ZNS; mã ứng dụng và khóa nhà cung cấp do người dùng nhập sau trong phần cài đặt. Người dùng chọn gửi mã OTP đăng nhập qua Zalo ZNS trước, không được thì gửi SMS.
- Nội dung thay đổi:
  - Thêm chức năng Cài đặt tích hợp: quản trị tập đoàn nhập mã ứng dụng Google, Microsoft, Zalo, khóa eSMS.vn, Zalo ZNS (mã mẫu tin theo từng sự kiện). Khóa bí mật mã hóa khi lưu, chỉ hiện 4 ký tự cuối, có hiệu lực ngay, ghi nhật ký. Thay cho việc đặt các khóa này trong biến môi trường (tài liệu `22`).
  - CHUC_NANG_08: mã OTP gửi qua Zalo ZNS trước; ZNS chưa cài đặt hoặc gửi lỗi thì gửi SMS qua eSMS.vn.
- Thành phần bị ảnh hưởng: tài liệu `10` (chức năng mới, CHUC_NANG_08), `11`, `14` (màn hình mới), `16` (bảng cài đặt), `17` (API mới), `22` (quản lý khóa bí mật), `27`.
- Dữ liệu bị ảnh hưởng: thêm bảng cài đặt tích hợp trong schema `core` (database migration mới); không đổi bảng đã có.
- API bị ảnh hưởng: thêm API đọc, lưu cài đặt tích hợp; không đổi API đã có.
- Giao diện bị ảnh hưởng: thêm màn hình Cài đặt tích hợp trong menu Quản trị hệ thống.
- Quyền bị ảnh hưởng: thêm quyền `platform.integration.manage` (nhạy cảm), chỉ quản trị tập đoàn.
- Ảnh hưởng chức năng cũ: tỷ giá Vietcombank, email không đổi.
- Kiểm thử cần thực hiện: kịch bản mới cho cài đặt tích hợp, OTP qua ZNS và SMS.
- Mức quy mô: Lớn (gộp trong CONG_VIEC_03).
- Rủi ro: lộ khóa bí mật nếu mã hóa sai; giảm thiểu bằng mã hóa AES-256-GCM như khóa TOTP, không trả khóa đầy đủ qua API.
- Trạng thái: Đã phê duyệt 2026-11-09.

### THAY_DOI_09: Dư nợ thật thay dư nợ tạm tính khi kiểm hạn mức công nợ – 2026-11-10
- Lý do: QUYTAC_NGHIEPVU_69 dùng dư nợ tạm tính "đến khi có MODULE_06". CONG_VIEC_13 làm công nợ phải thu; người dùng quyết định đổi sang công nợ thật (tài liệu `02`, 2026-11-10).
- Nội dung thay đổi: QUYTAC_NGHIEPVU_69 được thay bằng QUYTAC_NGHIEPVU_92: dư nợ = số dư công nợ phải thu của khách (trả trước làm giảm) cộng giá trị gồm thuế phần chưa giao của các đơn khác của khách đã xác nhận. Bỏ phần "đã giao trong số ngày được nợ gần nhất" và "trừ hàng trả lại" (đã nằm trong công nợ thật).
- Thành phần bị ảnh hưởng: tài liệu `07` QUYTAC_NGHIEPVU_69; `10` CHUC_NANG_54 (kiểm ngoại lệ đơn bán); `21` KICHBAN_KIEMTHU_183, 184; `27`.
- Dữ liệu bị ảnh hưởng: không đổi dữ liệu đơn bán; công nợ của phiếu xuất đã ghi sổ được tính lại khi chạy database migration.
- API bị ảnh hưởng: API_77 (ngoại lệ vượt hạn mức công nợ khi gửi đơn).
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: khách đã trả tiền thì không còn bị tính vào dư nợ; giao hàng quá số ngày được nợ mà chưa trả vẫn bị tính (trước đây không tính).
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_183, 184 cập nhật dữ liệu theo công nợ thật (sửa kiểm thử đã có, theo phiếu này); kịch bản mới của CONG_VIEC_13.
- Mức quy mô: Lớn (gộp trong CONG_VIEC_13).
- Rủi ro: đơn đang chờ duyệt có thể đổi kết quả kiểm ngoại lệ ở lần gửi sau; thấp vì chưa phát hành.
- Trạng thái: Đã phê duyệt 2026-11-10 (người dùng chọn đổi dư nợ tạm tính sang công nợ thật); đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_10: Công nợ làm tròn theo đơn vị tiền tệ công ty – 2026-11-10
- Lý do: rà soát CONG_VIEC_14 phát hiện công nợ (CONG_VIEC_13) lưu 4 chữ số lẻ trong khi sổ cái 131, 331 làm tròn đến đồng, nên hai bên lệch vài đồng (ví dụ giao 3 lần mỗi lần một phần ba dòng đơn). Người dùng chọn làm tròn công nợ đến đồng (tài liệu `02`, 2026-11-10).
- Nội dung thay đổi: QUYTAC_NGHIEPVU_86: tiền công nợ của mỗi phiếu kho làm tròn theo đơn vị nhỏ nhất của tiền tệ công ty, tính theo số lượng lũy kế của từng dòng đơn (làm tròn lũy kế sau trừ làm tròn lũy kế trước) để tổng các lần giao, nhận, trả đúng bằng tiền dòng đơn; bút toán dùng cùng cách tính. Phiếu thu chi, số dư đầu kỳ không nhận số lẻ hơn đơn vị tiền tệ.
- Thành phần bị ảnh hưởng: tài liệu `07` QUYTAC_NGHIEPVU_86, 88, 90; `16` (hàm `finance.inventory_amounts`, `finance.line_share`, `finance.company_minor_units` trong database migration 0011); `17` API_85, API_86 (lỗi số tiền lẻ); `21`, `27`.
- Dữ liệu bị ảnh hưởng: khoản công nợ đã tạo trước giữ nguyên; chưa có dữ liệu thật.
- API bị ảnh hưởng: API_85 (số dư đầu kỳ), API_86 (phiếu thu chi) từ chối số tiền lẻ hơn đơn vị tiền tệ.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: công nợ của từng lần giao có thể chênh tối đa 1 đồng so với cách tính cũ; tổng theo dòng đơn đúng bằng tiền dòng đơn.
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_201 đến 206, 209; thêm KICHBAN_KIEMTHU_217.
- Mức quy mô: Vừa (gộp trong CONG_VIEC_14).
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_11: Đơn bán không có khách vẫn lập hóa đơn điện tử – 2026-11-10
- Lý do: Nghị định 254/2026/NĐ-CP Điều 9 bắt buộc lập hóa đơn khi chuyển giao quyền sở hữu hàng hóa, mỗi lần giao hàng một hóa đơn; người mua không cung cấp thông tin thì hóa đơn ghi người mua không cung cấp tên, địa chỉ, mã số thuế (Phụ lục, điểm 4.b). Người dùng chọn lập hóa đơn cho mọi phiếu xuất giao hàng (tài liệu `02`, 2026-11-10).
- Nội dung thay đổi: đơn bán để trống khách nghĩa là "người mua không cung cấp thông tin" (thay cho "người mua không lấy hóa đơn"); phiếu xuất giao hàng của đơn này vẫn lập hóa đơn điện tử, ghi tên người mua nếu có. Bán cho công ty con trong tập đoàn cũng lập hóa đơn như bán thường.
- Thành phần bị ảnh hưởng: tài liệu `07` QUYTAC_NGHIEPVU_56, 67, 79 (câu chữ); `16` (chú thích `sales.orders.customer_id`, `inventory.documents.partner_id`); `14` (nhãn trên màn hình đơn bán nếu có); CONG_VIEC_16.
- Dữ liệu bị ảnh hưởng: không đổi cấu trúc; phiếu xuất đã ghi sổ trước khi bật hóa đơn điện tử không lập hóa đơn lùi.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: câu chữ "người mua không lấy hóa đơn" đổi thành "người mua không cung cấp thông tin".
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: khuyến mãi, công nợ, bút toán không đổi.
- Kiểm thử cần thực hiện: kịch bản của CONG_VIEC_16 (đơn không có khách lập hóa đơn); hồi quy CONG_VIEC_08, 12.
- Mức quy mô: Nhỏ (gộp trong CONG_VIEC_16).
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_12: Nhân viên bán hàng chỉ xem khách mình phụ trách – 2026-11-10
- Lý do: gán khách hàng cho nhân viên kinh doanh (tài liệu `05` mục 2.1, MODULE_07). Người dùng chọn: nhân viên chỉ xem khách của mình; trưởng phòng xem, giao khách theo phòng ban; giao, chuyển khách theo chính sách duyệt; đơn đã gán nhân viên hưởng hoa hồng giữ nguyên (tài liệu `02`, 2026-11-10).
- Nội dung thay đổi: thêm quyền xem mọi khách hàng và đơn bán của công ty; vai trò Nhân viên bán hàng không có quyền này nên chỉ thấy khách mình phụ trách (hoặc của nhân viên trong phòng mình quản lý) và đơn bán của các khách đó, đơn mình lập, đơn mình hưởng hoa hồng. Đổi nhân viên phụ trách của khách đã có phụ trách phải qua phiếu giao khách (không sửa trực tiếp trên hồ sơ).
- Thành phần bị ảnh hưởng: tài liệu `07` QUYTAC_NGHIEPVU_60 (hồ sơ đối tác), quy tắc xem đơn bán; `08` (vai trò Nhân viên bán hàng); `10`, `14`, `17`, `22`; CONG_VIEC_06, CONG_VIEC_08, CONG_VIEC_17.
- Dữ liệu bị ảnh hưởng: thêm bảng lịch sử phụ trách, phiếu giao khách; hồ sơ đã có nhân viên phụ trách được ghi lịch sử bắt đầu từ ngày cập nhật hồ sơ gần nhất.
- API bị ảnh hưởng: danh sách, chi tiết đối tác, đơn bán lọc theo phạm vi xem; sửa hồ sơ không đổi được nhân viên phụ trách đã có.
- Giao diện bị ảnh hưởng: danh sách đối tác, đơn bán; hồ sơ đối tác (ô nhân viên phụ trách, lịch sử).
- Quyền bị ảnh hưởng: thêm quyền xem mọi khách hàng, đơn bán và quyền giao khách; gán cho mọi vai trò hệ thống đang xem đối tác hoặc đơn bán, trừ Nhân viên bán hàng.
- Ảnh hưởng chức năng cũ: hoa hồng không đổi (đơn đã gán giữ nhân viên); kế toán, kho, mua hàng xem như cũ.
- Kiểm thử cần thực hiện: kịch bản của CONG_VIEC_21; hồi quy CONG_VIEC_06, 08, 17.
- Mức quy mô: Lớn (gộp trong CONG_VIEC_21).
- Rủi ro: trung bình (vai trò tự tạo đang có quyền xem đối tác sẽ không còn thấy mọi khách cho tới khi được thêm quyền mới; database migration thêm quyền mới vào vai trò tự tạo đang có `crm.partner.view` hoặc `sales.order.view`).
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_13: Ghé thăm khách và hoa hồng của tôi trong ứng dụng nhân viên kinh doanh – 2026-11-10
- Lý do: người dùng chọn phạm vi bản đầu của ứng dụng nhân viên kinh doanh gồm ghé thăm khách và hoa hồng của tôi (tài liệu `02`, 2026-11-10); hai chức năng này chưa có trong tài liệu `05`.
- Nội dung thay đổi: thêm chức năng ghi lượt ghé thăm khách (bắt buộc vị trí GPS, 0 đến 3 ảnh chụp tại chỗ, ghi chú bắt buộc) trên ứng dụng; trưởng phòng, quản lý xem lịch sử ghé thăm trên web-crm và ứng dụng theo phạm vi xem của CONG_VIEC_21. Thêm quyền xem hoa hồng của chính mình (phát sinh, bảng tháng) cho vai trò Nhân viên bán hàng.
- Thành phần bị ảnh hưởng: tài liệu `05` (bổ sung phạm vi MODULE_07), `06`, `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`; CONG_VIEC_17 (đọc phát sinh, bảng hoa hồng), CONG_VIEC_21 (phạm vi xem).
- Dữ liệu bị ảnh hưởng: thêm bảng lượt ghé thăm, ảnh ghé thăm; không đổi dữ liệu cũ.
- API bị ảnh hưởng: thêm API ghé thăm, hoa hồng của tôi, đăng nhập cho ứng dụng di động; API cũ không đổi hợp đồng.
- Giao diện bị ảnh hưởng: ứng dụng mới `apps/mobile-sales`; web-crm thêm màn hình ghé thăm và thẻ ghé thăm trên chi tiết đối tác.
- Quyền bị ảnh hưởng: thêm quyền ghi ghé thăm, xem hoa hồng của chính mình cho vai trò Nhân viên bán hàng.
- Ảnh hưởng chức năng cũ: không đổi cách tính hoa hồng, phạm vi xem.
- Kiểm thử cần thực hiện: kịch bản của CONG_VIEC_22; hồi quy CONG_VIEC_17, 21.
- Mức quy mô: Lớn (gộp trong CONG_VIEC_22).
- Rủi ro: trung bình (lưu vị trí, ảnh là dữ liệu cá nhân của nhân viên và khách; cần tài liệu `22`).
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_14: Mô hình kinh doanh B2C qua sàn VComm, giới thiệu khách và hoa hồng theo đơn – 2026-11-10
- Lý do: người dùng bổ sung mô hình kinh doanh (tài liệu `02`, 2026-11-10): khách hàng tự đăng ký tài khoản trên ứng dụng sàn VComm (ứng dụng cho người mua), gắn với tài khoản giới thiệu cấp trên qua đường dẫn hoặc mã giới thiệu là số điện thoại; tài khoản nhân viên kinh doanh là tài khoản thường được đánh dấu để cấp quyền; hoa hồng đến từ việc khách mua hàng; nhân viên kinh doanh chỉ bán B2C, không tạo đơn giùm khách (khách tự đặt trên ứng dụng VComm); các công ty nội bộ chỉ bán dịch vụ cho nhau, không bán hàng hóa; chỉ VComm là sàn bán hàng hóa; hoa hồng chi trả khi đơn hoàn tất (sau 7 ngày trả hàng).
- Nội dung thay đổi (quyết định của người dùng 2026-11-10):
  - Hoa hồng chỉ tính cho người giới thiệu trực tiếp của khách (một cấp). Thay bằng quyết định bổ sung cùng ngày bên dưới.
  - Bổ sung (người dùng, 2026-11-10): hai loại hoa hồng, mỗi loại thiết lập riêng:
    - hoa hồng giới thiệu cho người giới thiệu trực tiếp của khách;
    - hoa hồng đội kinh doanh nhiều cấp theo cơ cấu tổ chức (cấp 1 là nhân viên kinh doanh phụ trách khách, các cấp trên là người quản lý theo phòng ban), không theo cây giới thiệu.
    - Nhân viên kinh doanh giới thiệu khách thì nhận cả hai loại.
    - Tỷ lệ đặt theo từng sản phẩm, mỗi sản phẩm chọn tính theo phần trăm hoặc số tiền cố định trên mỗi đơn vị.
    - Đăng ký bằng số điện thoại và mã OTP qua SMS.
    - Đơn của người mua có thanh toán trực tuyến và thanh toán khi nhận hàng (COD); VComm tự đối soát COD với bên giao vận.
    - Khung cổng thanh toán chung cho mọi cổng (ví điện tử MoMo, VNPAY, SePay, PayOS..., mã QR, chuyển khoản ngân hàng, thẻ Visa, Mastercard), bật tắt riêng từng cổng và từng phương thức.
  - Đơn hoàn tất (hết 7 ngày trả hàng) thì hoa hồng cộng vào ví của người giới thiệu; người được hưởng tự tạo yêu cầu rút tiền về tài khoản ngân hàng.
  - Không làm ứng dụng nhân viên kinh doanh riêng: phần kinh doanh gộp vào ứng dụng VComm, tài khoản được đánh dấu nhân viên kinh doanh thấy thêm phần kinh doanh.
  - Làm phần lõi MODULE_09 trước (tài khoản người mua tự đăng ký, giới thiệu, đánh dấu nhân viên kinh doanh, đơn của người mua, hoa hồng vào ví, rút tiền); sửa các công việc đã làm bằng công việc riêng sau.
- Thành phần bị ảnh hưởng: tài liệu `01` (thứ tự module), `04` đến `11`, `12` (ứng dụng `apps/mobile-sales` thành phần kinh doanh của ứng dụng VComm), `14`, `16`, `17`, `22`; CONG_VIEC_08 (đơn bán: không dùng cho nhân viên kinh doanh bán B2C), CONG_VIEC_09 (giao dịch nội bộ hàng hóa không còn dùng; nội bộ chỉ bán dịch vụ), CONG_VIEC_17 (hoa hồng theo tiền thu, bảng tháng, chỉ tiêu thay bằng hoa hồng theo đơn hoàn tất vào ví), CONG_VIEC_20 (loại trừ doanh thu, giá vốn hàng hóa nội bộ, lãi chưa thực hiện không còn phát sinh), CONG_VIEC_21 (khách thuộc người giới thiệu thay cho giao khách), CONG_VIEC_22 (dừng ứng dụng riêng; dùng lại API đăng nhập bằng token, ghé thăm, tóm tắt khách).
- Dữ liệu bị ảnh hưởng: thêm tài khoản người mua, quan hệ giới thiệu, ví, giao dịch ví, yêu cầu rút tiền; dữ liệu cũ chưa có trên môi trường thật.
- API bị ảnh hưởng: thêm API đăng ký, giới thiệu, ví, rút tiền, đơn của người mua; API cũ đánh giá lại theo từng công việc sửa.
- Giao diện bị ảnh hưởng: ứng dụng VComm cho người mua (mới), phần kinh doanh trong ứng dụng; web quản trị ví, rút tiền.
- Quyền bị ảnh hưởng: đánh dấu tài khoản nhân viên kinh doanh; quyền duyệt rút tiền.
- Ảnh hưởng chức năng cũ: như mục thành phần bị ảnh hưởng; xử lý bằng các công việc sửa riêng, có phiếu thay đổi riêng khi đổi hành vi đã nghiệm thu.
- Kiểm thử cần thực hiện: kịch bản của các công việc mới; hồi quy CONG_VIEC_08, 09, 17, 20, 21 khi sửa.
- Mức quy mô: Lớn.
- Rủi ro: cao (đổi mô hình kinh doanh; ví tiền của người dùng cần kiểm soát chặt; hoa hồng một cấp để tránh rủi ro bán hàng đa cấp, cần kiểm tra pháp lý về khấu trừ thuế thu nhập cá nhân trên hoa hồng và chương trình giới thiệu).
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_15: Tài khoản được đánh dấu nhân viên kinh doanh không có quyền bán B2B – 2026-11-10
- Lý do: người dùng quyết định ngày 2026-11-10 khi nghiệm thu CONG_VIEC_23: nhân viên kinh doanh không bán B2B nên bỏ phần quyền này. Vai trò hệ thống Nhân viên bán hàng có quyền lập đơn bán, sửa đối tác (B2B); QUYTAC_NGHIEPVU_144 đang gán vai trò này khi đánh dấu.
- Nội dung thay đổi: đánh dấu nhân viên kinh doanh chỉ thêm tài khoản vào công ty vận hành sàn với phòng ban (căn cứ hoa hồng nhiều cấp theo cơ cấu tổ chức), không gán vai trò Nhân viên bán hàng; bỏ đánh dấu bỏ phòng ban, ngừng thành viên do đánh dấu tạo khi không còn vai trò nào, trả lại phòng ban cũ cho thành viên có sẵn. Quyền xem hoa hồng của mình thêm ở CONG_VIEC_26.
- Thành phần bị ảnh hưởng: QUYTAC_NGHIEPVU_144; CHUC_NANG_108; TIEUCHI_NGHIEMTHU_166; KICHBAN_KIEMTHU_299; tài liệu `07`, `08`, `16`, `22`, `27`; CONG_VIEC_23.
- Dữ liệu bị ảnh hưởng: bỏ cột `marketplace.buyer_accounts.sales_role_assignment_id` (migration 0023 chưa phát hành).
- API bị ảnh hưởng: không đổi hợp đồng API_119.
- Giao diện bị ảnh hưởng: câu xác nhận bỏ đánh dấu trên MAN_HINH_80.
- Quyền bị ảnh hưởng: tài khoản được đánh dấu không còn quyền của vai trò Nhân viên bán hàng.
- Ảnh hưởng chức năng cũ: không (CONG_VIEC_23 chưa phát hành). Bỏ hẳn bán B2B của các công việc cũ (CONG_VIEC_08, 21) xử lý ở công việc sửa riêng theo THAY_DOI_14.
- Kiểm thử cần thực hiện: KICHBAN_KIEMTHU_299 sửa theo hành vi mới (người dùng cho phép qua quyết định này); hồi quy toàn bộ.
- Mức quy mô: Vừa.
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-10; đã thực hiện trên nhánh CONG_VIEC_23 (commit eeaf0e9), chờ phát hành; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_16: Đội kinh doanh nhiều cấp bậc chức danh – 2026-11-10
- Lý do: người dùng bổ sung ngày 2026-11-10: đội ngũ kinh doanh có các chức danh Giám đốc Kinh doanh, Giám đốc Vùng, Trưởng phòng kinh doanh, Nhân viên kinh doanh, phân quyền và hoa hồng khác nhau.
- Nội dung thay đổi (quyết định của người dùng 2026-11-10):
  - Quan hệ cấp trên theo cây phòng ban của công ty vận hành sàn (khối, vùng, phòng); người quản lý từng đơn vị mang chức danh tương ứng; cấp trên của một người là quản lý các đơn vị chứa đơn vị của người đó.
  - Hoa hồng đội kinh doanh tính theo chức danh; chuỗi cấp trên thiếu chức danh nào thì phần của chức danh đó cộng cho người có chức danh cao hơn gần nhất; người quản lý tự phụ trách khách nhận cả phần của các chức danh dưới mình.
  - Quyền xem trên ứng dụng: nhân viên xem khách, hoa hồng của mình; quản lý xem cấp dưới trong nhánh, khách (thông tin đầy đủ), doanh số, hoa hồng của từng người.
  - Thêm người vào đội, đặt chức danh, đổi đơn vị: quản lý đề xuất trên ứng dụng, quản trị công ty vận hành sàn duyệt trên web.
- Thành phần bị ảnh hưởng: CONG_VIEC_23 (đã nghiệm thu, chưa phát hành: đánh dấu nhân viên kinh doanh thêm chức danh; khách phụ trách; phần Kinh doanh trên ứng dụng); CONG_VIEC_26 (hoa hồng đội kinh doanh theo chức danh); tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`.
- Dữ liệu bị ảnh hưởng: thêm chức danh, đề xuất thay đổi đội kinh doanh; dùng `core.departments` (cây đơn vị, người quản lý).
- API bị ảnh hưởng: API_118, API_119 mở rộng; thêm API đội kinh doanh.
- Giao diện bị ảnh hưởng: MAN_HINH_78, MAN_HINH_80; thêm màn hình đội của tôi, đề xuất, duyệt đề xuất.
- Quyền bị ảnh hưởng: phạm vi xem theo nhánh của người quản lý.
- Ảnh hưởng chức năng cũ: không (CONG_VIEC_23 chưa phát hành).
- Kiểm thử cần thực hiện: kịch bản mới của công việc; hồi quy c23.
- Mức quy mô: Lớn.
- Rủi ro: trung bình (quyền xem dữ liệu khách theo nhánh; hoa hồng nhiều cấp chỉ theo cơ cấu tổ chức, không theo cây giới thiệu).
- Trạng thái: Đã phê duyệt 2026-11-10; đã phát hành trong phiên bản 0.3.0 (2026-11-11).


### THAY_DOI_17: Phí rút tiền hoa hồng cấu hình được – 2026-11-11
- Lý do: người dùng bổ sung ngày 2026-11-11: thu phí rút tiền, cấu hình động theo số lần rút trong tháng hoặc theo số tiền.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11):
  - Hai bảng phí, cộng dồn: bảng theo lần rút trong tháng (từ lần thứ N thu số tiền cố định) và bảng theo số tiền (từ mức số tiền: phí cố định cộng phần trăm, phần phần trăm có mức tối thiểu, tối đa). Phí = phí theo lần + phí theo số tiền; bảng để trống thì không thu.
  - Số lần rút đếm theo tháng dương lịch, không tính yêu cầu bị từ chối hoặc người dùng đã rút lại.
  - Phí trừ vào thực nhận: thực nhận = số tiền yêu cầu − thuế − phí; thuế vẫn tính trên toàn bộ số tiền yêu cầu. Phí dự kiến hiện khi gửi yêu cầu, chốt khi kế toán duyệt.
  - Hạch toán phí vào thu nhập khác (711), không thuế giá trị gia tăng: ghi đã chi Nợ 3388 / Có ngân hàng / Có 3335 / Có 711.
  - Làm trong CONG_VIEC_26 (thêm lát L5), trình nghiệm thu cả công việc một lần.
- Thành phần bị ảnh hưởng: CONG_VIEC_26 (đang thực hiện): QUYTAC_NGHIEPVU_204 đến 207, thêm QUYTAC_NGHIEPVU_208; CHUC_NANG_134, 137, 138; tài liệu `07`, `10`, `11`, `14`, `16`, `17`, `21`, `27`.
- Dữ liệu bị ảnh hưởng: cài đặt hoa hồng thêm bảng phí rút tiền; yêu cầu rút tiền thêm số phí; định khoản thêm thu nhập khác.
- API bị ảnh hưởng: API_134 (cài đặt chung thêm bảng phí), API_135 (ví thêm bảng phí, số lần rút trong tháng), API_136 (yêu cầu rút có phí).
- Giao diện bị ảnh hưởng: sửa MAN_HINH_86 (bảng phí), MAN_HINH_102, MAN_HINH_104 (phí dự kiến, thực nhận).
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không (CONG_VIEC_26 chưa nghiệm thu).
- Kiểm thử cần thực hiện: thêm KICHBAN_KIEMTHU_362; chạy lại KICHBAN_KIEMTHU_359, 360.
- Mức quy mô: Vừa.
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-11; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_18: Sửa các công việc đã nghiệm thu theo mô hình B2C (THAY_DOI_14) – 2026-11-11
- Lý do: THAY_DOI_14 đổi mô hình kinh doanh sang bán B2C qua sàn VComm; các công việc nội bộ, B2B đã nghiệm thu cần sửa theo.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11):
  - CONG_VIEC_09 giao dịch nội bộ: chỉ cho mặt hàng dịch vụ; không xuất kho, không phiếu nhập chờ, không biên bản chênh lệch hàng; giữ luồng đơn bán nội bộ sinh đơn mua đối ứng.
  - CONG_VIEC_17 hoa hồng đội kinh doanh theo tiền thu, bảng tháng, chỉ tiêu: xóa hẳn chức năng (mã, menu, quyền, bảng dữ liệu; dữ liệu chưa có trên môi trường thật), thay bằng hoa hồng theo đơn của CONG_VIEC_26.
  - CONG_VIEC_21 giao khách cho nhân viên kinh doanh: tắt (ẩn giao diện, API từ chối tạo mới); khách của người mua thuộc người giới thiệu (CONG_VIEC_23).
  - CONG_VIEC_08 đơn bán: chặn tạo đơn bán tay có mặt hàng hàng hóa; đơn bán hàng hóa chỉ sinh từ đơn VComm; kế toán vẫn lập đơn bán dịch vụ.
  - CONG_VIEC_20 báo cáo hợp nhất: giữ nguyên.
- Thành phần bị ảnh hưởng: CONG_VIEC_08, 09, 17, 21 (đã nghiệm thu, chưa phát hành); tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`.
- Dữ liệu bị ảnh hưởng: xóa bảng hoa hồng cũ của CONG_VIEC_17; đánh dấu mặt hàng dịch vụ.
- API bị ảnh hưởng: bỏ API hoa hồng cũ; API giao khách, đơn bán, giao dịch nội bộ thêm điều kiện.
- Giao diện bị ảnh hưởng: bỏ màn hình hoa hồng cũ; ẩn giao khách; đơn bán, giao dịch nội bộ chỉ chọn mặt hàng hợp lệ.
- Quyền bị ảnh hưởng: bỏ quyền `finance.commission.*`; quyền giao khách không còn dùng.
- Ảnh hưởng chức năng cũ: như trên (các công việc chưa phát hành).
- Kiểm thử cần thực hiện: kịch bản mới của CONG_VIEC_43; hồi quy toàn bộ; kiểm thử của CONG_VIEC_17 bỏ theo chức năng (người dùng đồng ý xóa chức năng).
- Mức quy mô: Lớn.
- Rủi ro: trung bình (xóa chức năng, đổi quyền xem).
- Trạng thái: Đã phê duyệt 2026-11-11 (thiết kế chi tiết chờ xác nhận trong đặc tả CONG_VIEC_43); đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_19: Ngưỡng thuế thu nhập cá nhân khi rút hoa hồng cộng dồn theo tháng – 2026-11-11
- Lý do: rà soát CONG_VIEC_26: xét ngưỡng thuế từng lần rút thì người nhận chia nhỏ yêu cầu dưới ngưỡng để không bị khấu trừ.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11): khi duyệt, xét ngưỡng trên tổng số tiền các yêu cầu đã duyệt (kể cả đã chi) của người đó trong cùng tháng duyệt (giờ Việt Nam) cộng số tiền yêu cầu đang duyệt; vượt ngưỡng thì khấu trừ theo tỷ lệ trên toàn bộ số tiền yêu cầu đang duyệt. Thuế dự kiến khi gửi yêu cầu tính theo cùng cách với tháng hiện tại. Giữ từ chối khi thực nhận bằng 0.
- Thành phần bị ảnh hưởng: CONG_VIEC_26 (đã nghiệm thu, chưa phát hành): QUYTAC_NGHIEPVU_205; tài liệu `07`, `11`, `21`.
- Dữ liệu, API, giao diện, quyền: không đổi cấu trúc; câu hướng dẫn thuế trên ứng dụng.
- Ảnh hưởng chức năng cũ: số thuế với người rút nhiều lần trong tháng.
- Kiểm thử cần thực hiện: bổ sung kịch bản cộng dồn vào KICHBAN_KIEMTHU_359; chạy lại c26-*.
- Mức quy mô: Nhỏ.
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-11; đã thực hiện 2026-11-11 (commit `399018b`), người dùng nghiệm thu khi yêu cầu hợp nhất 2026-11-11; đã phát hành trong phiên bản 0.3.0 (2026-11-11).

### THAY_DOI_20: Tự ghi đã thu COD khi Viettel Post báo giao thành công – 2026-11-11
- Lý do: gộp các đơn vị vận chuyển (pull request #82): webhook Viettel Post không gửi ngày thu tiền hộ nên đơn COD giao qua Viettel Post không tự ghi đã thu COD.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11): khi webhook Viettel Post báo giao thành công đơn COD, tự ghi đã thu COD, ngày thu là thời điểm nhận webhook; webhook lặp không ghi lần hai.
- Thành phần bị ảnh hưởng: CONG_VIEC_29 (đã nghiệm thu, chưa phát hành): đặc tả, quy tắc, kịch bản kiểm thử; `shipments.service.ts`.
- Dữ liệu, API, giao diện, quyền: không đổi.
- Ảnh hưởng chức năng cũ: không; GHN và các đơn vị khác giữ cách cũ.
- Kiểm thử cần thực hiện: kịch bản giao thành công đơn COD, đơn không COD, webhook lặp; chạy lại toàn bộ kiểm thử API.
- Mức quy mô: Nhỏ.
- Rủi ro: ngày thu ghi sổ có thể sớm hơn ngày Viettel Post chuyển tiền; đối soát thu hộ (CONG_VIEC_19) vẫn đối chiếu số tiền thật.
- Trạng thái: Đã phê duyệt 2026-11-11; đã thực hiện 2026-11-11 (commit `af6df92`, pull request #82), chờ phát hành.

### THAY_DOI_21: Loại phụ cấp cho dòng phụ cấp của hợp đồng, phụ lục – 2026-11-11
- Lý do: CONG_VIEC_48 (lương) cần biết loại từng khoản phụ cấp để tính bảo hiểm xã hội, thuế thu nhập cá nhân (khoản nào tính, khoản nào miễn).
- Nội dung thay đổi (quyết định của người dùng 2026-11-11): dòng phụ cấp của hợp đồng, phụ lục (CONG_VIEC_46) có thêm loại phụ cấp chọn từ danh mục; bắt buộc khi lập hoặc sửa mới, dữ liệu cũ được để trống.
- Thành phần bị ảnh hưởng: CONG_VIEC_46 (chờ nghiệm thu, chưa phát hành): QUYTAC_NGHIEPVU_297, 300; CHUC_NANG_163; MAN_HINH_118; API_147, 148; bảng `hr.contract_allowances` (thêm cột `allowance_type_id` cho phép trống).
- Dữ liệu, API, giao diện, quyền: thêm cột, thêm trường; tương thích dữ liệu cũ.
- Ảnh hưởng chức năng cũ: lập, sửa phụ cấp phải chọn loại.
- Kiểm thử cần thực hiện: `c46-contracts` (cập nhật), kiểm thử lương của CONG_VIEC_48.
- Mức quy mô: Vừa; làm trong CONG_VIEC_48 (database migration 0076).
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-11.

### THAY_DOI_22: Chặn rút tiền ví hoa hồng theo từng tài khoản – 2026-11-11
- Lý do: quyết định của người dùng khi duyệt CONG_VIEC_49 (ví mua sắm có rủi ro bị coi là ví điện tử): cần chặn rút tiền theo từng tài khoản cho cả ví mua sắm (CONG_VIEC_49) và ví hoa hồng.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11, chốt chi tiết trong CONG_VIEC_49):
  - Khóa ví mua sắm toàn hệ thống: không thanh toán bằng ví; mua hàng, mua chung vẫn chạy, tiền hoàn vẫn cộng vào ví và giữ đến khi mở khóa.
  - Chặn theo từng tài khoản, riêng từng ví, không liên thông: chặn ví mua sắm thì không dùng số dư trả đơn; chặn ví hoa hồng thì không tạo yêu cầu rút.
  - Khi chặn ví hoa hồng: yêu cầu rút đang chờ duyệt tự bị từ chối; yêu cầu đã duyệt chưa chi bị khóa ghi đã chi đến khi gỡ chặn.
  - Quyền chặn: `marketplace.payment.manage`; lý do 1 đến 500 ký tự; lưu lịch sử; gửi thông báo cho người dùng.
  - Mã cấp thêm ngoài dải CONG_VIEC_49: QUYTAC_NGHIEPVU_390 (khóa ví mua sắm toàn hệ thống), QUYTAC_NGHIEPVU_391 (chặn ví theo tài khoản), TIEUCHI_NGHIEMTHU_367, KICHBAN_KIEMTHU_532; dữ liệu trong database migration 0080; API gộp vào API_166 và sửa hành vi API_136.
- Thành phần bị ảnh hưởng: CONG_VIEC_26 (đã phát hành 0.3.0): rút tiền ví hoa hồng (CHUC_NANG_137, API_136); quản trị web-crm.
- Dữ liệu, API, giao diện, quyền: thêm dữ liệu chặn rút theo tài khoản; API rút tiền trả lỗi nghiệp vụ khi bị chặn.
- Ảnh hưởng chức năng cũ: tài khoản không bị chặn giữ nguyên hành vi.
- Kiểm thử cần thực hiện: kịch bản chặn, bỏ chặn, gửi yêu cầu khi bị chặn; hồi quy c26-*.
- Mức quy mô: Vừa; làm trong CONG_VIEC_49.
- Rủi ro: thấp.
- Trạng thái: Đã phê duyệt 2026-11-11.

### THAY_DOI_23: Bỏ giới hạn yêu cầu theo IP cho API nộp hồ sơ ứng tuyển công khai – 2026-11-11
- Lý do: CONG_VIEC_54 (tuyển dụng): người dùng không muốn chặn ứng viên nộp hồ sơ vì giới hạn theo IP (nhiều ứng viên dùng chung mạng).
- Nội dung thay đổi (quyết định của người dùng 2026-11-11): API_204 `/careers` (trang tuyển dụng công khai chung tập đoàn) không áp giới hạn yêu cầu theo IP (tài liệu 22 mục 3, LOI_02), không OTP, không giới hạn số lần nộp. Các API công khai khác giữ nguyên giới hạn.
- Thành phần bị ảnh hưởng: tài liệu 22 mục 3 (ngoại lệ cho API_204); CONG_VIEC_54.
- Dữ liệu, API, giao diện, quyền: không đổi API khác.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: API_204 nhận nhiều yêu cầu liên tiếp từ cùng IP; API công khai khác vẫn bị giới hạn.
- Mức quy mô: Nhỏ; làm trong CONG_VIEC_54.
- Rủi ro (người dùng chấp nhận): hồ sơ rác hàng loạt, đầy kho lưu tệp đính kèm, tốn tài nguyên máy chủ; giảm thiểu đề xuất trong tài liệu 22 (giới hạn kích thước, loại tệp, theo dõi dung lượng).
- Trạng thái: Đã phê duyệt 2026-11-11.

### THAY_DOI_24: Bán lẻ tại quầy dùng lại hóa đơn điện tử, quỹ, đơn bán – 2026-11-11
- Lý do: CONG_VIEC_53 (bán lẻ tại quầy) cần mở rộng hành vi đã duyệt của các công việc đã phát hành 0.3.0.
- Nội dung thay đổi (quyết định của người dùng 2026-11-11):
  - CONG_VIEC_16 (hóa đơn điện tử): thêm loại hóa đơn khởi tạo từ máy tính tiền; hóa đơn bán lẻ tại quầy luôn dùng loại này.
  - CONG_VIEC_13 (quỹ, công nợ): thêm chứng từ quỹ không gắn đối tượng: thu bán lẻ (`retail_receipt`), chi trả lại bán lẻ (`retail_refund`), thiếu quỹ (`cash_shortage`, hạch toán 1388), thừa quỹ (`cash_surplus`, hạch toán 3381); tiền vào quỹ bằng phiếu thu tổng khi đóng ca.
  - CONG_VIEC_08 (bán hàng): đơn bán có cờ bán lẻ (`is_retail`) và thông tin người mua lấy hóa đơn.
- Thành phần bị ảnh hưởng: CONG_VIEC_08, 13, 16; tài liệu 07, 10, 16, 17 phần liên quan.
- Dữ liệu, API, giao diện, quyền: thêm cột, giá trị loại chứng từ; không đổi hành vi cũ.
- Ảnh hưởng chức năng cũ: không; đơn và chứng từ cũ giữ nguyên.
- Kiểm thử cần thực hiện: kiểm thử của CONG_VIEC_53; hồi quy c8-*, c13-*, c16-*.
- Mức quy mô: Vừa; làm trong CONG_VIEC_53.
- Rủi ro: chưa đối chiếu nguyên văn quy định hóa đơn khởi tạo từ máy tính tiền (phải tra trước lát hóa đơn).
- Trạng thái: Đã phê duyệt 2026-11-11.

