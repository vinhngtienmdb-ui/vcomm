# 22. BẢO MẬT

- Mô tả: Dữ liệu nhạy cảm, điểm tiếp nhận dữ liệu, xác thực, ma trận phân quyền, khóa bí mật, kết quả kiểm tra, rủi ro đã chấp nhận, sự cố bảo mật.
- Phiên bản: 2.17
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); THAY_DOI_04, THAY_DOI_08 qua CONG_VIEC_03 (2026-11-09); CONG_VIEC_04 (2026-11-09): MODULE_02 phần Sản phẩm; CONG_VIEC_05 (2026-11-10): MODULE_03 Kho phần web; CONG_VIEC_06 (2026-11-10): MODULE_07 Khách hàng và Đối tác phần tối thiểu; CONG_VIEC_07 (2026-11-10): MODULE_04 Mua hàng phần 1; CONG_VIEC_08 (2026-11-10): MODULE_05 Bán hàng phần 1; CONG_VIEC_09 (2026-11-10): MODULE_05 phần 2 Giao dịch nội bộ; CONG_VIEC_12 (2026-11-10): MODULE_05 phần 3 Khuyến mãi; CONG_VIEC_13 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 1 (công nợ); CONG_VIEC_14 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 2 (kế toán tổng hợp); CONG_VIEC_15 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 3 (báo cáo tài chính); CONG_VIEC_16 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 4 (hóa đơn điện tử); CONG_VIEC_17 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 5 (hoa hồng đội kinh doanh); CONG_VIEC_18 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 6 (đối soát ngân hàng); CONG_VIEC_19 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 7 (đối soát thu hộ); CONG_VIEC_20 (2026-11-10): MODULE_06 Tài chính – Kế toán phần 8 (báo cáo tài chính hợp nhất; sửa sau rà soát: công ty, đối tác của điều chỉnh tay, danh sách đối tác các thành viên); CONG_VIEC_21 (2026-11-10), THAY_DOI_12: MODULE_07 Khách hàng và Đối tác phần 2 (gán khách hàng cho nhân viên kinh doanh: phân quyền theo nhân viên phụ trách, quyền mới, khóa đồng thời); CONG_VIEC_23 (2026-11-10): điểm tiếp nhận, ma trận phân quyền, kết quả rà soát bảo mật tài khoản người mua; CONG_VIEC_27 (2026-11-10): ma trận phân quyền đội kinh doanh, kết quả rà soát bảo mật; CONG_VIEC_24 (2026-11-11): dữ liệu địa chỉ người nhận, ảnh trả hàng, thông tin kết nối GHN; điểm tiếp nhận API_123 đến API_129, webhook vận chuyển; ma trận phân quyền đặt hàng trên VComm; CONG_VIEC_25 (2026-11-11): dữ liệu tài khoản nhận hoàn tiền của người mua, thông tin kết nối VNPAY; điểm tiếp nhận API_130 đến API_133, IPN và trang trả về VNPAY; ma trận phân quyền thanh toán, hoàn tiền; CONG_VIEC_26 (2026-11-11): dữ liệu ví hoa hồng, giao dịch ví, yêu cầu rút tiền (tài khoản nhận, thuế, phí); điểm tiếp nhận API_134 đến API_136; ma trận phân quyền hoa hồng, ví, rút tiền; CONG_VIEC_43 (2026-11-11), THAY_DOI_18: bỏ dữ liệu, điểm tiếp nhận, ma trận hoa hồng đội kinh doanh cũ (CONG_VIEC_17); tắt giao khách, phạm vi xem theo nhân viên phụ trách (CONG_VIEC_21); quyền đơn bán mới (Nhân viên bán hàng bỏ `sales.order.manage`; Kế toán, Kế toán trưởng thêm `sales.access`, `sales.order.view`, `sales.order.manage`); điểm tiếp nhận `GET /crm/visit-options`, trường `kind`, `allowManualGoodsOrders`; ma trận sửa theo mô hình B2C; CONG_VIEC_50 (2026-11-11): MODULE_15 Báo cáo quản trị phần 1: dữ liệu báo cáo quản trị, điểm tiếp nhận API_170 đến API_175, ma trận phân quyền báo cáo quản trị; CONG_VIEC_49 (2026-11-11), THAY_DOI_22: dữ liệu, điểm tiếp nhận (API_162 đến API_169, ảnh bài đăng), quyền `marketplace.community.manage`, ma trận phân quyền cộng đồng, khóa và chặn ví, giới hạn tần suất; CONG_VIEC_53 (2026-11-11): ma trận phân quyền bán lẻ tại quầy MODULE_14 phần 1 (phạm vi chi nhánh cửa hàng, khóa yêu cầu chống ghi trùng, không lưu dữ liệu thẻ, VietQR chỉ là chuỗi thanh toán, chứng từ quỹ ghi sổ ngay); CONG_VIEC_58 (2026-11-12): MODULE_14 phần 3 kế hoạch mua theo ngân sách: dữ liệu ngân sách mua, điểm tiếp nhận API_235 đến API_240, quyền `purchasing.budget.view`, `purchasing.budget.manage`, ma trận phân quyền ngân sách mua, khóa theo công ty khi gửi duyệt
- Cập nhật giai đoạn 07: gắn mã API vào điểm tiếp nhận dữ liệu

Phạm vi hiện tại: MODULE_01 Nền tảng; MODULE_02 phần Sản phẩm (CONG_VIEC_04); MODULE_03 Kho phần web (CONG_VIEC_05); MODULE_07 Khách hàng và Đối tác phần tối thiểu (CONG_VIEC_06); MODULE_04 Mua hàng phần 1 (CONG_VIEC_07); MODULE_05 Bán hàng phần 1 (CONG_VIEC_08); MODULE_05 phần 2 Giao dịch nội bộ (CONG_VIEC_09); MODULE_05 phần 3 Khuyến mãi (CONG_VIEC_12); MODULE_06 Tài chính – Kế toán phần 1 (CONG_VIEC_13); MODULE_06 phần 2 Kế toán tổng hợp (CONG_VIEC_14); MODULE_06 phần 3 Báo cáo tài chính (CONG_VIEC_15); MODULE_06 phần 4 Hóa đơn điện tử (CONG_VIEC_16); MODULE_06 phần 5 Hoa hồng đội kinh doanh (CONG_VIEC_17); MODULE_06 phần 6 Đối soát ngân hàng (CONG_VIEC_18); MODULE_06 phần 7 Đối soát thu hộ (CONG_VIEC_19); MODULE_06 phần 8 Báo cáo tài chính hợp nhất (CONG_VIEC_20); MODULE_07 phần 2 Gán khách hàng cho nhân viên kinh doanh (CONG_VIEC_21); MODULE_15 phần 1 Báo cáo quản trị (CONG_VIEC_50). Các module sau bổ sung vào cùng tài liệu.

## 1. Dữ liệu nhạy cảm

| Dữ liệu | Loại | Cách lưu trữ | Vai trò được truy cập |
|---|---|---|---|
| Mật khẩu | Xác thực | Băm bằng argon2id | Không ai đọc được |
| Bí mật ứng dụng xác thực hai lớp (TOTP) | Xác thực | Mã hóa bằng khóa AWS KMS | Chỉ máy chủ khi kiểm tra mã |
| Mã dự phòng xác thực hai lớp (bảng `mfa_backup_codes`) | Xác thực | Băm bằng argon2id, dùng một lần | Không ai đọc được |
| Mã OTP đăng nhập bằng số điện thoại qua Zalo, SMS (bảng `otp_codes`, CONG_VIEC_03) | Xác thực | Băm SHA-256, lưu cơ sở dữ liệu, hết hạn 5 phút; sai 5 lần thì hủy; không ghi vào nhật ký gửi tin | Không ai đọc được |
| Token làm mới, đường dẫn kích hoạt, đường dẫn đặt lại mật khẩu | Xác thực | Chỉ lưu bản băm SHA-256 | Không ai đọc được |
| Email, số điện thoại, họ tên nhân viên | Cá nhân | Thường, cơ sở dữ liệu mã hóa khi lưu (Aurora) | Chính nhân viên; quản trị công ty của họ; quản trị tập đoàn |
| Địa chỉ IP, thiết bị trong phiên và nhật ký | Cá nhân | Thường, mã hóa khi lưu | Chính nhân viên (phiên của mình); quản trị xem nhật ký |
| Mã số thuế công ty | Tổ chức | Thường | Mọi nhân viên của công ty |
| Tỷ giá | Tài chính | Thường | Mọi nhân viên xem; quản lý tỷ giá sửa |
| Thông tin định danh nhà bán từ VNeID (họ tên, số định danh, ngày sinh; thông tin tổ chức) | Cá nhân, tổ chức | Mã hóa khi lưu; lưu lịch sử khai thác; không chia sẻ cho bên khác (Nghị định 69/2024/NĐ-CP Điều 18 khoản 6, 7 sửa đổi bởi Nghị định 320/2026/NĐ-CP) | Chi tiết xác định ở MODULE_02 (THAY_DOI_02) |
| Khóa bí mật hệ thống (xem mục 5) | Khóa bí mật | AWS Secrets Manager | Chỉ ứng dụng khi chạy |
| Khóa bí mật nhà cung cấp trong Cài đặt tích hợp (client secret Google, Microsoft, Zalo; API key, Secret key eSMS.vn) | Khóa bí mật | Bảng `integration_settings`, mã hóa AES-256-GCM bằng `apps/api/src/common/secret-box.ts` (khóa mã hóa như bí mật TOTP); API, giao diện, nhật ký thao tác chỉ có 4 ký tự cuối (QUYTAC_NGHIEPVU_31) | Chỉ máy chủ khi gọi nhà cung cấp; quản trị tập đoàn nhập, thay, xóa nhưng không đọc lại được |
| Nhật ký gửi tin (bảng `message_deliveries`) | Cá nhân | Số điện thoại che giữa (`+8490***4567`); không lưu nội dung mã OTP | Quản trị tập đoàn (MAN_HINH_19) |
| Nội dung đề xuất, tệp đính kèm (chứng từ gốc) | Tài chính, chứng từ | Cơ sở dữ liệu; tệp lưu AWS S3 (`STORAGE_DRIVER=s3`) hoặc thư mục cục bộ khi phát triển, theo khóa lưu trữ do hệ thống sinh | Người lập; người được giao duyệt hoặc đã duyệt; người có quyền `platform.proposal_template.manage` của công ty (QUYTAC_NGHIEPVU_36) |
| Giá bán, bảng giá, phiếu điều chỉnh giá (CONG_VIEC_04) | Kinh doanh | Cơ sở dữ liệu schema `catalog`; lịch sử giá chỉ thêm | Người có quyền `catalog.price.view` của công ty xem; chỉ người có quyền nhạy cảm `catalog.price.manage` lập phiếu |
| Sản phẩm, ảnh sản phẩm (CONG_VIEC_04) | Kinh doanh | Cơ sở dữ liệu schema `catalog`; ảnh lưu S3 hoặc thư mục cục bộ theo khóa `products/<công ty>/<sản phẩm>/<mã ngẫu nhiên>` | Người có quyền `catalog.product.view` của công ty |
| Giá vốn, giá trị tồn kho, giá trị phiếu kho, biên bản chênh lệch, tiền bồi thường (CONG_VIEC_05) | Tài chính | Cơ sở dữ liệu schema `inventory`; API trả trống khi người xem không có quyền | Người có quyền nhạy cảm `inventory.cost.view` tại kho (mọi chủ hàng) hoặc ở công ty chủ hàng (hàng của công ty đó) |
| Tồn kho, phiếu kho, thẻ kho (CONG_VIEC_05) | Kinh doanh | Cơ sở dữ liệu schema `inventory`; thẻ kho chỉ thêm | Người có quyền kho tại kho; nhân viên công ty chủ hàng có `inventory.stock.view` chỉ thấy hàng của công ty mình |
| Hồ sơ nhân sự: số căn cước, hộ chiếu, tài khoản ngân hàng, mã số thuế, số sổ bảo hiểm xã hội, giấy phép lao động, số định danh người phụ thuộc (CONG_VIEC_46) | Cá nhân (cơ bản theo Nghị định 356/2025/NĐ-CP Điều 3) | Mã hóa AES-256-GCM ở máy chủ (`secret-box`), 4 ký tự cuối để che, HMAC kiểm trùng số giấy tờ | `hr.identity.view` hiện từng trường (ghi nhật ký); chính người lao động |
| Ảnh căn cước, giấy khám sức khỏe, văn bằng, văn bản đồng ý (CONG_VIEC_46) | Cá nhân nhạy cảm (Nghị định 356/2025/NĐ-CP Điều 4 khoản 1 điểm d, i) | Tệp trên S3 (SSE) hoặc thư mục cục bộ khi phát triển, khóa do hệ thống sinh | Tải: `hr.identity.view` (ghi nhật ký); danh sách tệp: `hr.employee.view` |
| Mức lương, phụ cấp, hợp đồng lao động (CONG_VIEC_46) | Tài chính cá nhân | Cơ sở dữ liệu schema `hr` | `hr.contract.manage` của công ty; chính người lao động (hợp đồng đã ký) |
| Vị trí GPS, địa chỉ IP tại lượt chấm công; giờ vào, ra, nghỉ, lý do nghỉ (CONG_VIEC_47) | Cá nhân (Nghị định 356/2025/NĐ-CP Điều 3; vị trí là dữ liệu nhạy cảm theo Điều 4 khi theo dõi người) | Cơ sở dữ liệu schema `hr`; tọa độ chỉ lưu tại lượt chấm, không theo dõi liên tục | API không trả tọa độ, IP cho bất kỳ ai; người xem lượt chấm chỉ thấy cách xác thực, địa điểm, khoảng cách tới địa điểm |
| Tệp chứng từ nghỉ ốm, thai sản, văn bản đồng ý làm thêm giờ, tệp đơn giải trình (CONG_VIEC_47) | Cá nhân nhạy cảm (sức khỏe) | Tệp qua `FILE_STORAGE`, khóa do hệ thống sinh | Người có `hr.leave.manage` hoặc `hr.attendance.manage`; người lập; tải ghi nhật ký |
| Hồ sơ ứng viên: họ tên, email, điện thoại, nơi ở, trình độ, kinh nghiệm, lương mong muốn, thư giới thiệu, sơ yếu lý lịch (CONG_VIEC_54) | Cá nhân cơ bản của người dự tuyển (Luật 91/2025/QH15 Điều 25 khoản 1) | Cơ sở dữ liệu schema `hr`; tệp trên S3 (SSE) hoặc thư mục cục bộ, khóa do hệ thống sinh; không thu giới tính, ngày sinh, số giấy tờ; tự khử nhận dạng theo thời hạn (QUYTAC_NGHIEPVU_388) | `hr.recruitment.manage` của công ty của tin; người phỏng vấn được giao (lát L1) |
| Bằng chứng đồng ý của ứng viên: nguyên văn điều khoản, thời điểm, địa chỉ IP, trình duyệt, tệp bằng chứng (CONG_VIEC_54) | Cá nhân | Bảng `hr.candidate_consents`; xóa cùng ứng viên | `hr.recruitment.manage` |
| Số Căn cước công dân của đối tác cá nhân (CONG_VIEC_06) | Cá nhân | Cột `crm.partners.citizen_id`, lưu nguyên văn trong cơ sở dữ liệu mã hóa khi lưu (Aurora); chưa mã hóa cột (làm sau cùng giải pháp khóa ở mục 5). Danh sách, chi tiết, kết quả thêm, sửa chỉ trả dạng che `*********` + 3 số cuối; nhật ký thêm, sửa chỉ ghi 3 số cuối | Người có quyền nhạy cảm `crm.partner.identity.view` ở công ty đang làm việc xem số đầy đủ qua `GET /crm/partners/{id}/identity`, mỗi lần xem ghi nhật ký `partner.view_identity` (QUYTAC_NGHIEPVU_59) |
| Đối tác: tên, mã số thuế, địa chỉ, điện thoại, email, người liên hệ, tài khoản ngân hàng (CONG_VIEC_06) | Tổ chức, cá nhân | Cơ sở dữ liệu schema `crm`; dùng chung tập đoàn | Người có `crm.partner.view` ở bất kỳ công ty nào; sửa: `crm.partner.manage` |
| Hồ sơ đối tác của công ty: hạn mức công nợ, số ngày được nợ, nhân viên phụ trách (CONG_VIEC_06) | Tài chính, kinh doanh | Bảng `crm.partner_profiles` theo công ty | Xem: người có `crm.partner.view` của chính công ty đó; lập, sửa: quyền nhạy cảm `crm.profile.manage`. Công ty khác không đọc được |
| Giá mua, bảng giá mua, giá trị đề nghị mua, đơn mua (CONG_VIEC_07) | Kinh doanh | Cơ sở dữ liệu schema `purchasing` theo công ty | Người có quyền Mua hàng của chính công ty (Thủ kho có `purchasing.order.view` thấy đơn giá trên đơn mua); công ty khác nhận `404` |
| Giá nhập, giá trị dòng phiếu nhập mua, phiếu trả hàng (CONG_VIEC_07) | Tài chính | `inventory.document_lines.unit_cost`, `cost_value` | Như giá vốn: `inventory.cost.view` (API trả trống khi không có quyền) |
| Giá bán, chiết khấu, giá trị đơn bán (CONG_VIEC_08) | Kinh doanh | Cơ sở dữ liệu schema `sales` theo công ty | Người có `sales.order.view` hoặc `sales.order.manage` của chính công ty (Thủ kho có `sales.order.view` thấy giá trên đơn bán); công ty khác nhận `404` |
| Diễn giải ngoại lệ đơn bán: dư nợ (từ CONG_VIEC_13 tính theo công nợ thật, QUYTAC_NGHIEPVU_92), hạn mức công nợ, giá vốn bình quân (CONG_VIEC_08) | Tài chính | Cột `sales.orders.exceptions` (`jsonb`) | Lưu đầy đủ; API_77 chỉ trả diễn giải `credit_limit` cho người có `crm.profile.manage`, diễn giải `below_cost` cho người có `inventory.cost.view`; người khác nhận loại ngoại lệ, diễn giải trống |
| Giá trị dòng phiếu xuất giao hàng, phiếu nhận hàng trả lại (CONG_VIEC_08) | Tài chính | `inventory.document_lines.unit_cost`, `cost_value` | Như giá vốn: `inventory.cost.view` (API trả trống khi không có quyền) |
| Chứng từ đối ứng nội bộ, giá nội bộ, biên bản chênh lệch giao nhận nội bộ (CONG_VIEC_09) | Kinh doanh, tài chính | Schema `sales`, `purchasing` theo công ty; bảng `inventory.internal_discrepancies` thuộc công ty bán | Mỗi công ty chỉ thấy chứng từ của mình; chứng từ bên kia chỉ hiện tên công ty, số, trạng thái; giá trị biên bản như giá vốn (`inventory.cost.view`) |
| Chương trình khuyến mãi: ngân sách, đã dùng, điều kiện (CONG_VIEC_12) | Kinh doanh | Bảng `sales.promotions`, `sales.promotion_items`, `sales.promotion_channels`, `sales.promotion_customer_groups` theo công ty; đã dùng tính từ `sales.order_lines` | `sales.promotion.view` hoặc `sales.promotion.manage` trong công ty; không đánh dấu nhạy cảm |
| Quỹ, số dư quỹ, công nợ phải thu, phải trả, phiếu thu chi (CONG_VIEC_13) | Tài chính | Schema `finance` theo công ty (`funds`, `debt_items`, `debt_allocations`, `payments`, `payment_lines`) | Người có quyền `finance.*` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404`; quyền không đánh dấu nhạy cảm. Số tài khoản ngân hàng của quỹ hiện cho người xem quỹ |
| Hệ thống tài khoản, bút toán, sổ cái, bảng cân đối số phát sinh, kỳ khóa sổ (CONG_VIEC_14) | Tài chính | Schema `accounting` theo công ty (`settings`, `accounts`, `posting_rules`, `journals`, `journal_lines`) | Người có quyền `finance.ledger.*`, `finance.journal.manage`, `finance.period.close` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404`. Bút toán lộ doanh thu, giá vốn, lãi lỗ cho người có `finance.ledger.view` (Kế toán có sẵn) |
| Báo cáo tình hình tài chính, kết quả hoạt động kinh doanh; tệp Excel, PDF xuất ra (CONG_VIEC_15) | Tài chính | Không lưu; tính khi xem từ schema `accounting` theo công ty; tệp trả thẳng cho người xem, không lưu trên máy chủ | `finance.ledger.view` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; tệp đã tải ra nằm ngoài kiểm soát của hệ thống |
| Mật khẩu kết nối nhà cung cấp hóa đơn điện tử (CONG_VIEC_16) | Khóa bí mật | Cột `finance.einvoice_settings.secret_value`, mã hóa AES-256-GCM bằng `apps/api/src/common/secret-box.ts` (khóa như Cài đặt tích hợp); không trả về qua API (4 ký tự cuối chỉ cho người có `finance.einvoice.setup`); nhật ký thao tác ghi `••••` và `passwordChanged`, không ghi mật khẩu; không lưu trong lần gửi | Chỉ máy chủ khi gọi nhà cung cấp; người có `finance.einvoice.setup` nhập, thay nhưng không đọc lại được |
| Mã truy cập MISA meInvoice (CONG_VIEC_16) | Khóa bí mật | Chỉ trong bộ nhớ tiến trình API, theo khóa băm của công ty và thông tin kết nối, tối đa 12 giờ; không lưu cơ sở dữ liệu, không ghi log | Chỉ máy chủ |
| Hóa đơn điện tử: người mua (tên, mã số thuế, địa chỉ), dòng hàng, số tiền, tệp PDF, XML; lần gửi (CONG_VIEC_16) | Tài chính, tổ chức | Bảng `finance.einvoices`, `einvoice_lines`, `einvoice_attempts`, `einvoice_return_tasks` theo công ty; tệp lưu `bytea` | `finance.einvoice.view` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404`; tệp gửi cho nhà cung cấp, cơ quan thuế theo quy định |
| Cài đặt hoa hồng, chỉ tiêu, phát sinh, bảng hoa hồng theo nhân viên (CONG_VIEC_17) | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); bảng đã xóa (database migration 0061). Nội dung cũ: Tài chính, thu nhập của nhân viên | Schema `finance` theo công ty (`commission_settings`, `commission_rates`, `commission_channel_factors`, `commission_targets`, `commission_events`, `commission_statements`, `commission_statement_lines`); cột `sales.orders.commission_user_id` | `finance.commission.view` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404`; sửa cài đặt, chỉ tiêu cần `finance.commission.setup` (nhạy cảm). Người có quyền xem thấy hoa hồng, chỉ tiêu của mọi nhân viên trong công ty |
| Khóa xác thực webhook ngân hàng (CONG_VIEC_18) | Khóa bí mật | Cột `finance.bank_connections.secret_value`, mã hóa AES-256-GCM bằng `apps/api/src/common/secret-box.ts` (khóa như Cài đặt tích hợp); trả đủ một lần trong kết quả tạo kết nối hoặc đổi khóa; sau đó chỉ trả bốn ký tự cuối (`secret_hint`); nhật ký thao tác chỉ ghi `secretChanged`, không ghi khóa | Người có `finance.bank.setup` thấy khóa một lần khi tạo, đổi; máy chủ giải mã khi kiểm webhook |
| Giao dịch ngân hàng: số tiền, nội dung chuyển khoản (có thể chứa tên, số tài khoản người chuyển), mã tham chiếu, số dư tài khoản, dữ liệu webhook gốc (CONG_VIEC_18) | Tài chính | Bảng `finance.bank_transactions` theo công ty; không sửa, không xóa | `finance.bank.view` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404`; dữ liệu gốc không trả qua API |
| Bảng đối soát thu hộ: đơn vị thu hộ, số đơn bán, khách, tiền thu hộ, phí; công nợ của khách và đơn vị thu hộ (CONG_VIEC_19) | Tài chính | Bảng `finance.collection_statements`, `finance.collection_statement_lines`, `finance.collectors` theo công ty; bảng đã ghi sổ không sửa, không xóa; không lưu tệp Excel gốc | `finance.collection.view` gán ở phạm vi tập đoàn hoặc công ty của chính công ty; công ty khác nhận `404` |
| Báo cáo tài chính hợp nhất: số liệu sổ cái nhiều công ty (B01-DN, B02-DN cộng gộp, hợp nhất), công nợ nội bộ theo đối tác, doanh thu, lãi gộp hàng bán nội bộ; tệp Excel, PDF xuất ra (CONG_VIEC_20) | Tài chính | Bảng `finance.consolidations` (số báo cáo đã chốt dạng JSON), `finance.consolidation_entries`, `finance.consolidation_profit_lines` theo công ty gốc; số chưa chốt tính khi xem từ schema `accounting`, `inventory`, `sales` của các thành viên; tệp trả thẳng cho người xem, không lưu trên máy chủ | `finance.consolidation.view`, `finance.consolidation.manage` gán ở phạm vi tập đoàn; quyền ở phạm vi công ty không mở được; tập đoàn khác nhận `404` |
| Nhân viên phụ trách khách hàng, lịch sử phụ trách, phiếu giao khách (lý do, khách, nhân viên cũ, mới) (CONG_VIEC_21) | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); bảng giữ để tra cứu, không còn API đọc, ghi; nhân viên phụ trách vẫn ở hồ sơ đối tác. Nội dung cũ: Kinh doanh, nhân sự | Cột `crm.partner_profiles.owner_user_id`; bảng `crm.partner_owner_history`, `crm.customer_assignments`, `crm.customer_assignment_lines` theo công ty | Đối tác, đơn bán, lịch sử chỉ trong phạm vi xem (QUYTAC_NGHIEPVU_129); phiếu: người có `crm.customer.assign` xem mọi phiếu, người khác phiếu mình lập, mình gửi, giao cho mình |
| Địa chỉ nhận hàng, tên, số điện thoại người nhận; đơn VComm, ảnh trả hàng của người mua (CONG_VIEC_24) | Cá nhân | Schema `marketplace`; ảnh ở kho tệp (`return-requests/<người mua>/`); người mua chỉ đọc dữ liệu của mình, quản trị cần `marketplace.order.view` tại công ty vận hành sàn; địa chỉ, số điện thoại gửi sang đơn vị vận chuyển khi giao | Theo chính sách lưu đơn bán |
| Thông tin kết nối GHN: token, mã cửa hàng, khóa webhook (CONG_VIEC_24) | Khóa bí mật | Biến môi trường `GHN_API_TOKEN`, `GHN_SHOP_ID`, `GHN_WEBHOOK_KEY` (ít nhất 24 ký tự), không lưu trong cơ sở dữ liệu, không trả qua API (chỉ trả đã có kết nối hay chưa) | Đổi khi lộ |
| Tài khoản nhận hoàn tiền của người mua: ngân hàng, số tài khoản, tên chủ tài khoản; lần thanh toán, kết quả cổng gửi về (CONG_VIEC_25) | Cá nhân, tài chính | Schema `marketplace` (`buyer_bank_accounts`, `payments`, `payment_notifications`, `refunds`); người mua chỉ đọc, sửa tài khoản của mình; tài khoản ngân hàng của người mua chỉ hiện cho người có `marketplace.payment.manage` tại công ty vận hành sàn (MAN_HINH_98), không có trong chi tiết đơn của quản trị; không lưu thông tin thẻ (người mua nhập thẻ trên trang VNPAY) | Theo chính sách lưu đơn bán |
| Thông tin kết nối VNPAY: mã website, khóa bí mật (CONG_VIEC_25) | Khóa bí mật | Biến môi trường `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, `VNPAY_PAYMENT_URL`; không lưu trong cơ sở dữ liệu, không trả qua API (chỉ trả đã có kết nối hay chưa) | Đổi khi lộ |
| Hoa hồng của đơn, ví hoa hồng, giao dịch ví, yêu cầu rút tiền (tài khoản nhận chụp lại, thuế, phí, mã giao dịch ngân hàng) (CONG_VIEC_26) | Cá nhân, tài chính | Schema `marketplace` (`order_commissions`, `wallets`, `wallet_transactions`, `withdrawals`); người dùng chỉ đọc ví, yêu cầu của mình (theo người đăng nhập, không nhận mã người dùng từ bên ngoài); yêu cầu rút tiền kèm tài khoản nhận chỉ hiện cho người có `marketplace.payment.manage` tại công ty vận hành sàn (MAN_HINH_102); hoa hồng của đơn (tên, số điện thoại người hưởng) cần `marketplace.order.view`; người quản lý chỉ thấy tổng hoa hồng của cấp dưới trong nhánh, không thấy lịch sử ví | Không xóa; theo chính sách lưu chứng từ kế toán |
| Báo cáo quản trị: doanh số, giá vốn, lãi gộp, tồn kho, công nợ theo tuổi nợ, hoa hồng, ví của nhiều công ty trong tập đoàn; tệp Excel xuất ra (CONG_VIEC_50) | Tài chính, kinh doanh | Không lưu; tính khi xem từ schema `inventory`, `sales`, `finance`, `marketplace`; tệp trả thẳng, không lưu trên máy chủ; mỗi lần xuất ghi nhật ký thao tác | Người có `analytics.access` và quyền của nhóm báo cáo: phạm vi tập đoàn xem mọi công ty của tập đoàn, phạm vi công ty xem công ty đó; công nợ (`analytics.debt.view`), hoa hồng và ví (`analytics.commission.view`) là quyền nhạy cảm; người hưởng hoa hồng chỉ hiện họ tên, không hiện số điện thoại, tài khoản ngân hàng |
| Hồ sơ cộng tác viên, lượt bấm, thưởng giới thiệu; ví mua sắm, giao dịch ví mua sắm, chặn ví (lý do); bài đăng, ảnh, bình luận, báo cáo vi phạm, khóa tài khoản cộng đồng (CONG_VIEC_49, THAY_DOI_22) | Cá nhân, tài chính, nội dung người dùng | Schema `marketplace` (`collaborators`, `collaborator_clicks`, `collaborator_click_log`, `referral_bonuses`, `shopping_wallets`, `shopping_wallet_transactions`, `wallet_blocks`, `wallet_block_history`, `posts`, `post_images`, `post_comments`, `content_reports`, `community_bans`); ảnh ở kho tệp (`community/…`); người mua chỉ đọc dữ liệu của mình trừ bảng tin công khai cho người đã đăng nhập; số điện thoại người được mời che; người báo cáo không lộ cho tác giả | Không xóa; bài, bình luận xóa mềm |
| Kế hoạch ngân sách mua, ô ngân sách, phiếu điều chỉnh (lý do), số đã dùng, số còn được mua theo ngành hàng, kho, tháng; ảnh chụp ô vượt ngân sách của đơn mua (CONG_VIEC_58) | Kinh doanh | Bảng `purchasing.budget_plans`, `purchasing.budget_lines`, `purchasing.budget_adjustments`, `purchasing.budget_adjustment_lines`, cột `purchasing.orders.budget_snapshot` theo công ty; xem cần `purchasing.budget.view` hoặc `purchasing.budget.manage` (ảnh chụp, cảnh báo của đơn theo quyền đơn mua); không có dữ liệu cá nhân ngoài người lập |

## 2. Điểm tiếp nhận dữ liệu từ bên ngoài

| Điểm | Loại | Kiểm tra đầu vào | Yêu cầu xác thực |
|---|---|---|---|
| Đăng nhập mật khẩu, gửi mã OTP, đặt lại mật khẩu, kích hoạt (API_01, API_02, API_03, API_11, API_12, API_13) | API | Định dạng email, số điện thoại E.164, độ dài; giới hạn số lần thử theo địa chỉ IP và theo tài khoản | Không |
| Phản hồi đăng nhập Zalo (API_05) | Tích hợp (OAuth 2.0) | Kiểm tra `state`, mã PKCE; lấy mã định danh người dùng Zalo từ API Zalo bằng token vừa nhận | Không |
| Phản hồi đăng nhập Google, Microsoft (API_05) | Tích hợp (OpenID Connect) | Kiểm tra `state` với cookie đã ký, mã PKCE; token nhận trực tiếp từ nhà cung cấp qua kênh máy chủ – máy chủ nên không kiểm chữ ký token (CONG_VIEC_03 mục 12); chỉ dùng email đã xác minh; Microsoft chỉ tin email khi cài tenant cụ thể của công ty | Không |
| Mọi API quản trị và hồ sơ cá nhân của MODULE_01 | API | Lược đồ kiểm tra kiểu, độ dài, giá trị cho phép phía máy chủ | Có |
| Nhập nhân viên từ tệp Excel (API_27) | Tải tệp lên | Chỉ `.xlsx`, tối đa 5 MB, tối đa 1.000 dòng; đổi tên tệp; xử lý trong bộ nhớ, không lưu tệp gốc | Có |
| Gửi duyệt, quyết định duyệt (API_38, API_41, API_42) | API nội bộ, API | Lược đồ kiểm tra; mã chứng từ phải thuộc công ty của người gọi | Có |
| Lấy tỷ giá tự động | Tích hợp | Giá trị số dương, đủ cặp tiền tệ; lỗi thì không ghi | Không áp dụng (hệ thống gọi ra) |
| Cách đăng nhập khả dụng (API_54) | API | Không nhận dữ liệu; chỉ trả cờ đúng, sai, không trả mã ứng dụng | Không |
| Cài đặt tích hợp (API_49) | API | Chỉ nhận khóa cài đặt trong danh sách khai báo, giá trị tối đa 2.000 ký tự; trường thừa bị từ chối | Có, quyền nhạy cảm `platform.integration.manage` phạm vi tập đoàn |
| Mẫu đề xuất, đề xuất (API_50, API_51) | API | Lược đồ zod cho mẫu; giá trị đề xuất kiểm tra theo kiểu từng trường của bản chụp mẫu (số, tiền, ngày, danh sách chọn, chữ tối đa 500 ký tự, đoạn văn tối đa 5.000 ký tự, bảng chi tiết tối đa 100 dòng); chỉ giữ trường có trong mẫu | Có |
| Tải tệp đính kèm lên (API_52) | Tải tệp lên | Một tệp mỗi lần; tối đa 10 MB, 10 tệp mỗi đề xuất; đuôi `pdf`, `jpg`, `jpeg`, `png`, `xlsx`, `docx` và chữ ký đầu tệp phải khớp đuôi; tên tệp thay ký tự `\`, `/`, xuống dòng, dấu nháy kép bằng `_`, giữ tối đa 200 ký tự cuối; khóa lưu trữ do hệ thống sinh, không dùng tên tệp người dùng; tải về kèm `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` | Có |
| Mọi API mini app Sản phẩm (API_55 đến API_62) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn phải là UUID; giới hạn số phần tử (3 thuộc tính phân loại, 200 biến thể, 5 đơn vị quy đổi, 20 mã vạch mỗi biến thể, 5.000 dòng mỗi phiếu điều chỉnh giá) | Có, `catalog.access` và quyền chi tiết |
| Tải ảnh sản phẩm lên (API_57) | Tải tệp lên | Một tệp mỗi lần; tối đa 5 MB (multer cắt ở 10 MB), 10 ảnh mỗi sản phẩm; đuôi `jpg`, `jpeg`, `png`, `webp` và chữ ký đầu tệp phải khớp (`FF D8 FF`, `89 50 4E 47`, `RIFF....WEBP`); loại nội dung lưu theo loại đã kiểm; tên tệp thay `\`, `/`, xuống dòng, dấu nháy kép bằng `_`, giữ tối đa 200 ký tự cuối; khóa lưu trữ do hệ thống sinh; tải về kèm `X-Content-Type-Options: nosniff`, `Cache-Control: private` | Có |
| Nhập sản phẩm, nhập dòng phiếu điều chỉnh giá từ Excel (API_58, API_62) | Tải tệp lên | Chỉ `.xlsx` đọc bằng `read-excel-file`; tối đa 5 MB (multer cắt ở 10 MB), 2.000 dòng; dòng tiêu đề phải đúng mẫu; xử lý trong bộ nhớ, không lưu tệp gốc; tệp lỗi trả về dạng `data:` | Có |
| Mọi API mini app Kho (API_63 đến API_70) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, danh sách `variantIds` phải là UUID; số lượng, tiền dạng chuỗi tối đa 12 (số lượng) hoặc 16 (tiền) chữ số phần nguyên, 4 chữ số lẻ; giới hạn số phần tử (1.000 dòng mỗi phiếu, 5.000 serial mỗi dòng, 500 vị trí mỗi lần thêm, 5.000 dòng đếm mỗi lần, 500 bản tem); không nhận tệp tải lên | Có, `inventory.access` hoặc `inventory.stock.view` và quyền chi tiết tại kho |
| Mọi API mini app Khách hàng và Đối tác (API_71, API_72) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, `customerGroupId`, `ownerUserId` phải là UUID; mã số thuế `^[0-9]{10}(-[0-9]{3})?$`, số Căn cước công dân `^[0-9]{12}$`, email đúng định dạng, số tài khoản 4 đến 30 ký tự chữ, số, `-`; độ dài tên 300, địa chỉ 500, ghi chú 1.000 ký tự; tối đa 50 người liên hệ, 20 tài khoản ngân hàng; từ khóa tìm tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; hạn mức công nợ tối đa 16 chữ số phần nguyên, 4 chữ số lẻ, không âm; không nhận tệp tải lên | Có, `crm.access` hoặc `crm.partner.view` và quyền chi tiết ở công ty đang làm việc |
| Mọi API mini app Mua hàng, nhập mua, trả hàng nhà cung cấp (API_73 đến API_76) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, mã nhà cung cấp, mặt hàng, đơn vị, kho, dòng phải là UUID; số lượng chuỗi tối đa 12 chữ số phần nguyên, tiền tối đa 16, 4 chữ số lẻ; dung sai 0 đến 100, 2 chữ số lẻ; tối đa 200 dòng mỗi chứng từ, 1.000 serial mỗi dòng; từ khóa tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; lý do 500, ghi chú 1.000 ký tự; không nhận tệp tải lên | Có, `purchasing.access`, `purchasing.order.view` hoặc `purchasing.requisition.create` (API_73 đến API_75); quyền vào mini app Kho và `inventory.purchase.receive` tại kho (API_76) |
| Mọi API mini app Bán hàng, giao hàng, nhận hàng trả lại (API_77 đến API_79) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã định danh trong đường dẫn, mã khách, kênh, kho, mặt hàng, đơn vị, lô, vị trí, dòng phải là UUID; số lượng chuỗi tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, lớn hơn 0; chiết khấu 0 đến 100, 2 chữ số lẻ; tối đa 200 dòng mỗi chứng từ, 1.000 serial mỗi dòng (100 ký tự mỗi serial); từ khóa tối đa 100 ký tự, ký tự `%`, `_`, `\` được thoát trong `LIKE`; tên người mua 200, địa chỉ giao 500, lý do 500, ghi chú 1.000 ký tự; giá dòng không nhận từ người dùng mà tra theo bảng giá phía máy chủ; không nhận tệp tải lên | Có, `sales.access` hoặc `sales.order.view` (API_77, API_78); quyền vào mini app Kho và `inventory.sales.issue` tại kho (API_79) |
| API giao dịch nội bộ (API_80 đến API_82) | API | Lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, kho, dòng, vị trí là UUID; lý do từ chối 1 đến 500 ký tự; số nhận từ 0, tối đa 12 chữ số phần nguyên, 4 chữ số lẻ; tối đa 200 dòng, 5.000 serial mỗi dòng (100 ký tự mỗi serial); lý do thiếu, ghi chú tối đa 500 ký tự; `action` chỉ `return`, `write_off`; phiên bản số nguyên dương | Có |
| API khuyến mãi (API_83) | API | Lược đồ zod `savePromotionSchema`, `stopPromotionSchema`, `promotionListQuerySchema` trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, mặt hàng, kênh, nhóm khách là UUID; tên 1 đến 200 ký tự, ghi chú tối đa 1.000, lý do dừng 1 đến 500; tối đa 500 mặt hàng, 50 kênh, 50 nhóm khách; phần trăm lớn hơn 0 đến 100; số tiền, số lượng dạng chuỗi số dương; máy chủ kiểm mặt hàng, kênh (không phải Nội bộ), nhóm khách thuộc công ty, đang dùng | Có |
| API công nợ (API_84 đến API_86) | API | Lược đồ zod `saveFundSchema`, `fundLedgerQuerySchema`, `debtSummaryQuerySchema`, `debtPartnerQuerySchema`, `openDebtQuerySchema`, `financePartnerQuerySchema`, `saveOpeningDebtSchema`, `paymentListQuerySchema`, `savePaymentSchema`, `versionSchema` trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, đối tác, quỹ, khoản công nợ là UUID; tiền dạng chuỗi tối đa 12 chữ số phần nguyên, 4 chữ số lẻ; mã quỹ 20, tên 200, số chứng từ 50, ghi chú, nội dung 500 ký tự; tối đa 500 dòng chứng từ mỗi phiếu; từ khóa tối đa 100 ký tự; máy chủ kiểm đối tác có hồ sơ đúng phía, quỹ, khoản công nợ thuộc công ty và đối tác; không nhận tệp tải lên | Có, `finance.access` hoặc `finance.debt.view` và quyền chi tiết |
| API kế toán tổng hợp (API_87 đến API_89) | API | Lược đồ zod `saveAccountSchema`, `updateAccountSchema`, `updatePostingRuleSchema`, `journalListQuerySchema`, `saveJournalSchema`, `versionSchema`, `closePeriodSchema`, `ledgerRangeQuerySchema` trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, tài khoản, đối tác là UUID; vai trò định khoản so với danh mục cố định (khác thì `404`); số hiệu 3 đến 20 chữ số hoặc chữ cái, tên 200, diễn giải 500, diễn giải dòng 300 ký tự; 2 đến 200 dòng mỗi phiếu; tiền dạng chuỗi tối đa 12 chữ số phần nguyên, 4 chữ số lẻ, máy chủ từ chối số lẻ hơn đơn vị tiền tệ; tháng `YYYY-MM`; máy chủ kiểm tài khoản, đối tác thuộc công ty; không nhận tệp tải lên | Có, `finance.access` hoặc `finance.ledger.view` và quyền chi tiết |
| API báo cáo tài chính (API_90); `isLongTerm` của API_87 | API | Lược đồ zod `statementQuerySchema` trong `packages/contracts`, trường thừa bị từ chối; `kind`, `format` so với danh sách cố định; `from`, `to` là ngày `YYYY-MM-DD`; `form` tối đa 20 ký tự, chỉ dùng để chọn trong các mẫu của chế độ; `isLongTerm` kiểu đúng sai trong `updateAccountSchema`; chỉ đọc, không nhận tệp tải lên | Có, `finance.access` hoặc `finance.ledger.view`; xem, xuất cần `finance.ledger.view` |
| API hóa đơn điện tử (API_91, API_92) | API | Lược đồ zod `updateEinvoiceSettingsSchema`, `einvoiceListQuerySchema`, `einvoiceReturnQuerySchema`, `recordBuyerInvoiceSchema`, `replaceEinvoiceSchema` trong `packages/contracts`, lược đồ `version` trong bộ điều khiển; trường thừa bị từ chối; mã trong đường dẫn là UUID; `format` chỉ `pdf`, `xml`; nhà cung cấp, môi trường, trạng thái so với danh sách cố định; ký hiệu khớp `^[CK][0-9]{2}T[A-Z]{2}$`; mã số thuế người mua 10 chữ số hoặc 10 chữ số, gạch ngang, 3 chữ số; độ dài tên 300, địa chỉ 500, lý do 500, mật khẩu 200, từ khóa 100 ký tự; từ khóa tìm kiếm thoát `%`, `_`; không nhận tệp tải lên | Có, `finance.access` hoặc `finance.einvoice.view` và quyền chi tiết |
| API hoa hồng (API_93, API_94) | Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); endpoint trả `404`. Nội dung cũ: API | Lược đồ zod `updateCommissionSettingsSchema`, `commissionTargetsQuerySchema`, `saveCommissionTargetsSchema`, `commissionEventsQuerySchema`, `createCommissionStatementSchema` trong `packages/contracts`, lược đồ `version` trong bộ điều khiển; trường thừa bị từ chối; mã trong đường dẫn, ngành hàng, kênh, nhân viên là UUID; phần trăm 0 đến 100, hệ số 0 đến 10, tối đa 4 chữ số lẻ; tháng `YYYY-MM`; giới hạn số dòng (bậc 20, mức 2.000, hệ số kênh 200, chỉ tiêu 500, trang 100); phía máy chủ kiểm ngành hàng tồn tại, kênh thuộc công ty, nhân viên là thành viên đang làm việc của công ty | Có, `finance.access` hoặc `finance.commission.view` trong công ty đang làm việc; quyền chi tiết kiểm trong service |
| Webhook giao dịch ngân hàng (API_98, CONG_VIEC_18) | Tích hợp (dịch vụ trung gian gọi vào), API công khai | Đường dẫn chứa mã kết nối (UUID); khóa trong tiêu đề `Authorization: Apikey <khóa>`; lược đồ zod định dạng SePay (`id` tối đa 100 ký tự, ngày giờ đúng mẫu, chiều `in`, `out`, số tiền lớn hơn 0 tối đa 16 chữ số phần nguyên, nội dung tối đa 1.000 ký tự, mã tham chiếu 100, số tài khoản 50; bỏ ký tự rỗng `\u0000` trong chữ và dữ liệu gốc); trường khác bỏ qua; số tài khoản phải khớp quỹ; thân giới hạn theo mặc định của bộ đọc JSON (100 KB) | Không đăng nhập; xác thực bằng khóa của kết nối; đúng khóa không giới hạn tần suất, sai khóa tối đa 20 lần mỗi phút mỗi địa chỉ IP |
| API đối soát ngân hàng (API_95 đến API_97, API_99 đến API_101) | API | Lược đồ zod `saveBankConnectionSchema`, `simulateBankTransactionSchema`, `bankTransactionListQuerySchema`, `confirmBankReceiptSchema`, `matchBankTransactionSchema`, `ignoreBankTransactionSchema`, `bankVersionSchema`, `bankReconciliationQuerySchema` trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn, quỹ, khách, phiếu là UUID; dịch vụ, chiều, trạng thái so với danh sách cố định; số tiền tối đa 16 chữ số phần nguyên, 4 chữ số lẻ; nội dung thử 500, lý do bỏ qua 500, tìm kiếm 100 ký tự; trang 100 dòng; ký tự `%`, `_`, `\` trong tìm kiếm được thoát | Có, `finance.access`, `finance.bank.view` hoặc `finance.bank.setup`; quyền chi tiết theo tài liệu `08` mục 23 |
| Nhập bảng đối soát thu hộ từ tệp Excel (API_103, CONG_VIEC_19) | Tải tệp lên | Một tệp ở trường `file`; tối đa 5 MB (multer cắt ở 10 MB), 5.000 dòng; đọc trang đầu bằng `read-excel-file`, chỉ giá trị ô, không chạy công thức; tiêu đề phải đúng mẫu; từng ô kiểm kiểu, độ dài (mã, số đơn 100 ký tự; tiền không âm, tối đa 16 chữ số phần nguyên, số lẻ theo tiền tệ; ngày có thật); có ô sai thì từ chối cả tệp; xử lý trong bộ nhớ, không lưu tệp gốc; các trường khác theo lược đồ zod `importCollectionStatementSchema` (trường thừa bị từ chối) | Có, `finance.collection.manage` |
| API đối soát thu hộ (API_102, API_104, API_105) | API | Lược đồ zod `saveCollectorSchema`, `collectionStatementListQuerySchema`, thân `{ version }` trong `packages/contracts` và bộ điều khiển, trường thừa bị từ chối; mã trong đường dẫn, đối tác, đơn vị là UUID; loại, trạng thái so với danh sách cố định; trang 100 dòng | Có, `finance.access`, `finance.collection.view` hoặc `finance.collection.setup`; quyền chi tiết theo tài liệu `08` mục 25 |
| API báo cáo tài chính hợp nhất (API_106 đến API_109, CONG_VIEC_20) | API | Lược đồ zod `consolidationPreviewQuerySchema`, `createConsolidationSchema`, `consolidationVersionSchema`, `saveConsolidationProfitSchema`, `consolidationManualEntrySchema` trong `packages/contracts`, lược đồ xuất (`kind`, `format`) và `version` của xóa điều chỉnh tay trong bộ điều khiển; trường thừa bị từ chối; ngày `YYYY-MM-DD`; tiền không âm, tối đa 16 chữ số phần nguyên, 4 số lẻ; lý do, diễn giải tối đa 500 ký tự; điều chỉnh tay 2 đến 20 dòng, mã tài khoản 3 đến 10 ký tự, phải khớp tài khoản thành viên; công ty, đối tác của dòng là UUID, công ty phải là thành viên, đối tác phải tồn tại; mã trong đường dẫn là UUID, số bút toán là số nguyên | Có, `finance.access`, `finance.consolidation.view` hoặc `finance.consolidation.manage`; quyền ở phạm vi tập đoàn theo tài liệu `08` mục 27, 28 |
| API gán khách hàng (API_110, API_111, CONG_VIEC_21); lọc `owner` của API_71 | Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11); endpoint trả `404`, bỏ lọc `owner`. Nội dung cũ: API | Lược đồ zod `customerAssignmentListQuerySchema`, `saveCustomerAssignmentSchema` (`reason` 1 đến 500 ký tự, `partnerIds` 1 đến 500 UUID không trùng), `versionSchema`, `partnerListQuerySchema.owner` (`mine` hoặc UUID) trong `packages/contracts`, trường thừa bị từ chối; mã trong đường dẫn kiểm UUID (`UuidPipe`); nhân viên nhận, từng khách kiểm thuộc công ty, trong phạm vi giao trong service | Có, `crm.access` hoặc `crm.partner.view`; quyền giao khách, trưởng phòng, phạm vi xem theo tài liệu `08` mục 29, 30 |
| Phản hồi nhà cung cấp hóa đơn điện tử (MISA meInvoice, bộ giả lập) | Tích hợp (hệ thống gọi ra) | Chỉ đọc số, mã của cơ quan thuế, mã giao dịch, mã lỗi, tệp PDF, XML (base64) của đúng mã tham chiếu, mã giao dịch; JSON lỗi coi là lỗi; câu chữ lỗi của nhà cung cấp lưu như văn bản, giao diện hiện dạng văn bản | Không áp dụng (hệ thống gọi ra) |
| Gửi tin qua eSMS.vn (mã OTP, Zalo ZNS, kiểm tra kết nối) | Tích hợp | Chỉ đọc mã kết quả, mã tin, lỗi; gửi lỗi không chặn nghiệp vụ | Không áp dụng (hệ thống gọi ra) |
| API đặt hàng trên VComm (API_123 đến API_127, API_129, CONG_VIEC_24) | API | Lược đồ zod trong `packages/contracts` (`updateStoreSettingsSchema`, `updateListingSchema`, `cartLineSchema`, `buyerAddressSchema`, `buyerOrderPlaceSchema`, `cancelMarketplaceOrderSchema`, `shipMarketplaceOrderSchema`, `createReturnRequestSchema`, `returnDecisionSchema`, `returnRejectSchema`), mã UUID qua `UuidPipe`; ảnh trả hàng kiểm theo nội dung tệp (JPEG, PNG), tối đa 5 MB (multer cắt ở 6 MB) | Có (ảnh sản phẩm đang bán API_124 không cần) |
| Webhook trạng thái vận đơn (API_128, CONG_VIEC_24) | Tích hợp (đơn vị vận chuyển gọi vào), API công khai | Khóa trên đường dẫn so sánh thời gian cố định; sai khóa trả `403` và đếm theo địa chỉ IP (`carrier-webhook-unauthorized`, quá giới hạn `429`); đúng khóa không chịu giới hạn chung; chỉ đọc mã vận đơn (chữ, số 4 đến 40 ký tự) rồi tra lại trạng thái từ GHN, không tin trạng thái trong nội dung; mỗi lần nhận ghi bảng `carrier_webhook_events` | Khóa webhook |
| Phản hồi GHN (tạo, hủy, tra vận đơn) (CONG_VIEC_24) | Tích hợp (hệ thống gọi ra) | Thời gian chờ 15 giây; chỉ đọc mã vận đơn, phí, trạng thái, kết quả hủy; lỗi không làm đổi trạng thái đơn | Token, mã cửa hàng trong tiêu đề |
| API thanh toán, hoàn tiền (API_130, API_131, API_133, CONG_VIEC_25) | API | Lược đồ zod trong `packages/contracts` (`updatePaymentMethodSchema`, `updateOrderingOpenSchema`, `buyerOrderPlaceSchema` thêm `paymentMethod`, `buyerBankAccountSchema`, `refundListQuerySchema`, `completeRefundSchema`, `recordCodCollectedSchema`), mã UUID qua `UuidPipe`; số tiền thanh toán luôn tính ở máy chủ | Phiên web (quản trị), token ứng dụng (người mua) |
| Kết quả VNPAY gửi về: IPN, trang trả về (API_132, CONG_VIEC_25) | Tích hợp (cổng thanh toán gọi vào), API công khai | Kiểm chữ ký HMAC SHA512 các tham số `vnp_` sắp xếp theo tên, so sánh thời gian cố định (`timingSafeEqual`), đúng mã website; số tiền phải bằng số tiền của lần thanh toán; mỗi lần thanh toán ghi nhận một lần trong giao dịch có khóa dòng; sai chữ ký trả `97` và đếm theo địa chỉ IP (`vnpay-ipn-invalid`, quá giới hạn `429`, không ghi lại); chỉ lưu tham số `vnp_` dạng chuỗi (tối đa 30 tham số, mỗi giá trị 255 ký tự); lỗi khi ghi nhận trả `99` để cổng gửi lại; trang trả về chỉ hiển thị, không ghi nhận tiền, giới hạn theo địa chỉ IP (`vnpay-return`), nội dung thoát ký tự HTML, `Cache-Control: no-store` | Không (chữ ký bằng khóa bí mật) |
| Phản hồi GHN chi tiết đơn: ngày thu tiền người mua (CONG_VIEC_25) | Tích hợp (hệ thống gọi ra) | Chỉ đọc `cod_collect_date`; ngày không đọc được hoặc trước năm 2000 coi như chưa thu; ghi đã thu một lần bằng tiền thu hộ của đơn (không lấy số tiền từ GHN) | Token, mã cửa hàng trong tiêu đề |
| API hoa hồng, ví, rút tiền (API_134 đến API_136, CONG_VIEC_26) | API | Lược đồ zod trong `packages/contracts` (`productCommissionSchema`, `commissionSettingsSchema`, `withdrawalFeeRulesSchema`, `buyerWalletQuerySchema`, `createWithdrawalSchema` số đồng nguyên, `withdrawalVersionSchema`, `rejectWithdrawalSchema`, `payWithdrawalSchema`, `withdrawalListQuerySchema`, `withdrawalTaxReportQuerySchema`), mã UUID qua `UuidPipe`; số dư, thuế, phí, thực nhận luôn tính ở máy chủ | Phiên web (quản trị), token ứng dụng (người dùng) |
| API báo cáo quản trị (API_170 đến API_175, CONG_VIEC_50) | API | Lược đồ zod `strict` trong `packages/contracts` (`analyticsSalesQuerySchema`, `analyticsInventoryQuerySchema`, `analyticsDebtQuerySchema`, `analyticsCommissionQuerySchema`, `analyticsOverviewQuerySchema`): `companyIds` là danh sách UUID (tối đa 100), `channelId`, `warehouseId` là UUID, `groupBy`, `side`, `format` trong danh sách cho phép, ngày `YYYY-MM-DD`; tham số thừa bị từ chối; truy vấn Drizzle `sql` có tham số, không ghép chuỗi | Có (phiên web) |
| Trang tuyển dụng công khai: danh sách, chi tiết tin, nộp hồ sơ (API_204, CONG_VIEC_54) | API công khai, tải tệp lên | Lược đồ zod `careersListQuerySchema`, `careersApplySchema` trong `packages/contracts`, trường thừa (kể cả giới tính, ngày sinh) bị từ chối; mã tin là UUID; họ tên tối đa 200, email, điện thoại Việt Nam 10 số hoặc dạng quốc tế, thư giới thiệu tối đa 2.000 ký tự; ô đồng ý tuyển dụng bắt buộc, không đánh sẵn; phiên bản điều khoản phải là bản hiện hành; một tệp `resume` PDF hoặc DOCX, tối đa 10 MB (multer cắt ở 20 MB), chữ ký đầu tệp phải khớp đuôi, khóa lưu trữ do hệ thống sinh; tin không công khai, đã đóng, quá hạn, của công ty ngừng hoạt động trả `404` chung; lưu tệp trước, ghi cơ sở dữ liệu trong giao dịch, lỗi thì xóa tệp. Không giới hạn số yêu cầu theo IP (`@NoRateLimit()`, THAY_DOI_23, rủi ro ở mục 8) | Không |
| Trang trả lời đề nghị nhận việc (`/job-offer-responses/{mã}`, API_203, CONG_VIEC_54) | API công khai | Mã đúng mẫu 43 ký tự base64url, tra theo mã băm SHA-256; mã sai, hết hạn, đã hủy, đã gửi lại thư, ứng viên đã xóa trả `404` như nhau; lược đồ `offerAnswerSchema` (`accepted`, ghi chú tối đa 500); trả lời một lần (khóa dòng `FOR UPDATE`), lần hai `409`; ghi IP, trình duyệt; giữ giới hạn 20 yêu cầu mỗi phút mỗi IP | Không (mã liên kết dùng một lần) |
| Mọi API tuyển dụng, ứng viên, đánh giá hiệu suất (API_200 đến API_203, API_205, CONG_VIEC_54) | API, tải tệp lên | Lược đồ zod trong `packages/contracts/src/recruitment.ts`, trường thừa bị từ chối; mã trong đường dẫn là UUID; mô tả tin chữ thường, từ chối HTML; tệp bằng chứng đồng ý PDF, JPG, PNG tối đa 10 MB, kiểm chữ ký đầu tệp; tải xuống `no-store`, `nosniff` | Có |
| API cộng đồng (API_162 đến API_169, CONG_VIEC_49) | API; tệp ảnh do người dùng tải lên | Lược đồ zod `strict` trong `packages/contracts` (`submitCollaboratorSchema`, `collaboratorClickSchema`, `collaboratorReasonSchema`, `collaboratorLabelSchema`, `referralBonusSettingsSchema`, `groupBuySettingsSchema`, `openGroupBuySchema`, `cancelGroupBuySchema`, `shoppingWalletSettingsSchema`, `walletBlockSchema`, `createPostSchema`, `createCommentSchema`, `createReportSchema`, `hideContentSchema`, `createBanSchema`, `communitySettingsSchema`, `officialPostSchema`, `pinPostSchema` và lược đồ truy vấn); UUID qua `UuidPipe`; ảnh kiểm theo nội dung tệp (JPEG, PNG, tối đa 5 MB); số tiền ví, giá chốt, hoa hồng luôn tính ở máy chủ | Phiên web (quản trị), token ứng dụng (người dùng) |
| API ngân sách mua (API_235 đến API_240, CONG_VIEC_58) | API | Lược đồ zod `strict` trong `packages/contracts/src/purchasing-budgets.ts` (`saveBudgetPlanSchema`, `saveBudgetAdjustmentSchema`, `budgetListQuerySchema`, `openToBuyQuerySchema`, `cellOrdersQuerySchema`, `budgetCheckSchema`, `versionSchema`): tháng `YYYY-MM`, ngày `YYYY-MM-DD`, mã UUID, số tiền tối đa 16 chữ số phần nguyên, 4 chữ số lẻ (kế hoạch không âm, điều chỉnh khác 0), ghi chú, lý do tối đa 500 ký tự, tối đa 3.000 ô, 200 dòng phiếu, 200 dòng đơn; ngành hàng, kho, biến thể, đơn kiểm thuộc công ty đang làm việc | Đăng nhập, `X-Company-Id`, quyền theo ma trận |

## 3. Xác thực và phiên đăng nhập

- Cách xác thực: mật khẩu; Google Workspace, Microsoft 365 (OpenID Connect); Zalo (OAuth 2.0, chỉ tài khoản đã liên kết); số điện thoại kèm mã OTP. Xác thực hai lớp bằng TOTP hoặc mã OTP qua SMS, email; bắt buộc theo QUYTAC_NGHIEPVU_09.
- Thời hạn phiên đăng nhập: token truy cập 15 phút; token làm mới 30 ngày (web), 90 ngày (ứng dụng kho, ứng dụng kinh doanh); token làm mới đổi mới mỗi lần dùng, phát hiện dùng lại token cũ thì thu hồi cả chuỗi phiên.
- Lưu phiên trên web: cookie `HttpOnly`, `Secure`, `SameSite=Lax`; thao tác ghi kèm chống giả mạo yêu cầu (CSRF token).
- Giới hạn số lần thử: mật khẩu sai 5 lần liên tiếp khóa 15 phút; mã OTP sai 5 lần thì hủy mã; gửi mã OTP tối đa 5 lần mỗi giờ mỗi số; mọi API không cần đăng nhập giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP. Ngoại lệ THAY_DOI_23: API_204 trang tuyển dụng công khai (`/careers`) không giới hạn theo IP (người dùng chấp nhận rủi ro, mục 8).
- Đăng nhập bằng nhà cung cấp (CONG_VIEC_03): OpenID Connect (Google, Microsoft) và Zalo OAuth v4 đều dùng PKCE (S256) và `state` ngẫu nhiên; `state`, `code_verifier`, chế độ, người liên kết lưu trong cookie `vc_oauth` `HttpOnly`, `SameSite=Lax`, đường dẫn `/api/v1/auth/oauth`, ký bằng khóa ký token truy cập, hết hạn 10 phút; phản hồi không khớp cookie thì từ chối. Liên kết tài khoản cần phiên đăng nhập còn hiệu lực đã qua xác thực hai lớp. Không tự tạo tài khoản (QUYTAC_NGHIEPVU_08). Sau đăng nhập bằng nhà cung cấp hoặc mã OTP vẫn qua bước xác thực hai lớp khi tài khoản bắt buộc.
- Gửi mã OTP luôn trả cùng kết quả dù số có tài khoản hay không; số lần gửi đếm cả với số không có tài khoản để không lộ số nào có tài khoản. Máy chưa cài eSMS chỉ in mã thử ra log khi không phải môi trường thật.
- In đề xuất PDF: `pdfmake` chặn mọi đường dẫn ngoài (`setUrlAccessPolicy` luôn từ chối) và chỉ cho đọc tệp trong thư mục phông của gói.

## 4. Ma trận phân quyền

Vai trò theo tài liệu `08`. Mọi API kiểm tra quyền phía máy chủ và lọc dữ liệu theo phạm vi ngay trong câu truy vấn (QUYTAC_NGHIEPVU_12).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý tỷ giá | Nhân viên | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_01 Quản lý công ty | Được | Không | Không | Không | Không |
| CHUC_NANG_02 Quản lý chi nhánh | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_03 Quản lý phòng ban | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_04, CHUC_NANG_05 Mời, nhập nhân viên | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08 Đăng nhập | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Xác thực hai lớp (của mình) | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Đặt lại xác thực hai lớp người khác | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_10 Hồ sơ cá nhân | Được | Được | Được | Được | Có |
| CHUC_NANG_11 Chuyển công ty | Được | Được | Được | Được | Có |
| CHUC_NANG_12 Quản lý vai trò | Được, cả vai trò dùng chung | Vai trò riêng công ty mình | Không | Không | Không |
| CHUC_NANG_13 Gán vai trò | Mọi phạm vi | Công ty mình, chi nhánh của công ty mình; xem danh sách vai trò để chọn (THAY_DOI_05) | Không | Không | Không |
| CHUC_NANG_14 Trang chủ mini app | Được | Được | Được | Được | Có |
| CHUC_NANG_15 Chính sách duyệt | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_16, CHUC_NANG_17 Duyệt chứng từ, hộp duyệt | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Có |
| CHUC_NANG_19 Khóa, vô hiệu hóa nhân viên | Được | Trong công ty mình, trừ chính mình | Không | Không | Không |
| CHUC_NANG_20 Dãy số chứng từ | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_21 Tỷ giá (sửa) | Được | Không | Được | Không | Không |
| CHUC_NANG_21 Tỷ giá (xem) | Được | Được | Được | Được | Không |
| CHUC_NANG_22 Đổi ngôn ngữ | Được | Được | Được | Được | Có |
| CHUC_NANG_23 Nhật ký thao tác | Toàn tập đoàn | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_25 Cài đặt tích hợp (gồm nhật ký gửi tin) | Được (quyền ở phạm vi tập đoàn) | Không | Không | Không | Không |
| CHUC_NANG_27 Mẫu đề xuất | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_28 Lập, sửa, gửi, rút đề xuất | Được | Được | Được | Được | Có |
| CHUC_NANG_28, CHUC_NANG_29 Xem, tải tệp, in PDF đề xuất của người khác | Được (quản lý mẫu đề xuất) | Trong công ty mình (quản lý mẫu đề xuất) | Khi được giao duyệt hoặc đã duyệt | Khi được giao duyệt hoặc đã duyệt | Không |

### Ma trận phân quyền MODULE_02 phần Sản phẩm (CONG_VIEC_04)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `catalog.access` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.category.manage` | Tập đoàn (chỉ có hiệu lực khi gán ở phạm vi tập đoàn) | Không | Quản trị tập đoàn |
| `catalog.product.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.product.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý sản phẩm |
| `catalog.price.manage` | Công ty | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý sản phẩm" (`catalog_manager`): `catalog.access`, `catalog.product.view`, `catalog.product.manage`, `catalog.price.view`. Loại chứng từ mới `catalog.price_change` "Phiếu điều chỉnh giá" (cần duyệt).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý sản phẩm | Nhân viên | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_30 Ngành hàng, đơn vị tính (xem) | Được | Được | Được | Không | Không |
| CHUC_NANG_30 Ngành hàng, đơn vị tính (sửa) | Được (quyền ở phạm vi tập đoàn) | Không | Không | Không | Không |
| CHUC_NANG_31, CHUC_NANG_32, CHUC_NANG_33 Sản phẩm, nhập Excel | Được | Trong công ty mình | Trong công ty được gán | Không | Không |
| CHUC_NANG_34 Liên kết, sao chép giữa công ty | Khi có `catalog.product.manage` ở cả hai công ty | Như bên trái | Như bên trái | Không | Không |
| CHUC_NANG_35 Kênh bán, nhóm khách (sửa) | Được | Trong công ty mình | Không (chỉ xem qua API) | Không | Không |
| CHUC_NANG_36 Bảng giá (xem, tra giá) | Được | Trong công ty mình | Trong công ty được gán | Không | Không |
| CHUC_NANG_36 Bảng giá (sửa) | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_37 Lập, sửa, gửi, rút phiếu điều chỉnh giá | Được | Trong công ty mình | Không | Không | Có (chỉ người lập sửa, xóa, gửi, rút) |
| CHUC_NANG_37 Duyệt phiếu điều chỉnh giá | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt, QUYTAC_NGHIEPVU_20) |

Ranh giới và kiểm soát riêng:
- Dữ liệu theo công ty: mọi truy vấn sản phẩm, biến thể, ảnh, mã vạch, kênh, nhóm khách, bảng giá, phiếu có điều kiện `company_id` của công ty đang làm việc; sản phẩm, ảnh, bảng giá, phiếu của công ty khác trả `404 NOT_FOUND` như không tồn tại (KICHBAN_KIEMTHU_136, KICHBAN_KIEMTHU_139). Sản phẩm nhà bán (`seller_id` khác trống) không trả qua API sản phẩm của công ty. Mã hàng, mã vạch chỉ duy nhất trong công ty nên không lộ dữ liệu công ty khác qua lỗi trùng.
- Ảnh qua thẻ `img` nhận `?companyId=` thay header; máy chủ vẫn kiểm tra nhân viên thuộc công ty đó và có `catalog.product.view`.
- Liên kết, bỏ liên kết, sao chép giữa công ty: kiểm tra `catalog.product.manage` ở cả công ty đang làm việc và công ty bên kia; gợi ý theo mã vạch kiểm tra `catalog.product.view` ở cả hai công ty (QUYTAC_NGHIEPVU_41).
- Ngành hàng, đơn vị tính dùng chung: quyền sửa chỉ tính khi gán ở phạm vi tập đoàn, quản trị công ty không tự cấp được.
- Giá chỉ đổi qua phiếu điều chỉnh giá (QUYTAC_NGHIEPVU_44): không có API sửa, xóa bảng `catalog.prices`; giá chỉ ghi khi gửi (công ty chưa có chính sách duyệt) hoặc khi nhận sự kiện duyệt xong; quyền lập phiếu là quyền nhạy cảm; người lập không tự duyệt. Bảng `catalog.prices` chưa có trigger chặn sửa, xóa ở tầng cơ sở dữ liệu.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `catalog` (dữ liệu trước và sau).

### Ma trận phân quyền MODULE_03 Kho (CONG_VIEC_05)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `inventory.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `inventory.access` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.warehouse.manage` | Công ty (thêm kho, cài đặt); công ty hoặc chi nhánh (sửa kho, vị trí) | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.stock.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.cost.view` | Công ty, chi nhánh | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.document.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |
| `inventory.stocktake.manage` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |
| `inventory.reservation.manage` (gồm tồn an toàn) | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Quản lý kho |

Vai trò hệ thống mới "Thủ kho" (`warehouse_keeper`): `inventory.access`, `inventory.stock.view`, `inventory.document.manage`. "Quản lý kho" (`warehouse_manager`): mọi quyền `inventory.*`. Loại chứng từ mới cần duyệt: `inventory.receipt_other`, `inventory.issue_other`, `inventory.adjustment`, `inventory.transfer`; không duyệt: `inventory.stocktake`.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý kho | Thủ kho | Nhân viên công ty chủ hàng có `inventory.stock.view` | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_38 Thêm kho, cài đặt | Được | Trong công ty mình | Khi gán ở phạm vi công ty | Không | Không | Không |
| CHUC_NANG_38 Sửa kho, vị trí | Được | Kho của công ty mình | Kho trong phạm vi gán | Không | Không | Không |
| CHUC_NANG_39 Xem tồn, thẻ kho | Được | Kho của công ty mình (mọi chủ hàng); hàng công ty mình ở kho khác | Kho trong phạm vi gán | Kho trong phạm vi gán | Chỉ hàng của công ty mình | Không |
| CHUC_NANG_39 Xem giá vốn, giá trị | Được | Được | Được | Không | Khi có `inventory.cost.view` ở công ty mình | Không |
| CHUC_NANG_40, CHUC_NANG_41 Lập, gửi, rút phiếu; xuất, nhận chuyển kho | Được | Kho của công ty mình | Kho trong phạm vi gán | Kho trong phạm vi gán | Không (chỉ xem phiếu của công ty mình) | Có (chỉ người lập sửa, xóa, gửi, rút) |
| CHUC_NANG_40, CHUC_NANG_41 Duyệt phiếu kho | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt, QUYTAC_NGHIEPVU_20) |
| CHUC_NANG_42 Kiểm kê | Được | Kho của công ty mình | Kho trong phạm vi gán | Không | Không | Không |
| CHUC_NANG_43, CHUC_NANG_44 Giữ hàng, tồn an toàn | Được | Kho của công ty mình | Kho trong phạm vi gán | Chỉ xem | Không | Không |
| CHUC_NANG_45 In tem | Được | Được | Được | Được | Không | Không |

Ranh giới và kiểm soát riêng:
- Phạm vi theo chi nhánh sở hữu kho (QUYTAC_NGHIEPVU_46): quyền tại kho tính từ lần gán ở tập đoàn, ở công ty sở hữu kho hoặc ở chi nhánh của kho (`warehousePermissions` trong `apps/api/src/inventory/inventory-context.ts`). Người chỉ có quyền ở chi nhánh khác nhận `404` như kho không tồn tại (KICHBAN_KIEMTHU_147). Danh sách tồn, phiếu, kiểm kê, hàng giữ, tồn an toàn lọc theo danh sách kho trong điều kiện của câu truy vấn.
- Công ty chủ hàng chỉ xem: nhân viên công ty chủ hàng không có quyền tại kho chỉ nhận dòng tồn, phiếu có `company_id` của công ty đang làm việc; không lập phiếu, không thao tác kho (KICHBAN_KIEMTHU_147, KICHBAN_KIEMTHU_152). Phiếu chỉ nhận sản phẩm của công ty chủ hàng; kho phải nhận hàng của công ty đó.
- Giá vốn là thông tin nhạy cảm: giá vốn, giá trị tồn, giá trị dòng phiếu, giá trị thẻ kho, giá vốn serial, giá trị biên bản chênh lệch, giá trị chênh lệch kiểm kê, tiền bồi thường trả `null` khi người xem không có `inventory.cost.view` (KICHBAN_KIEMTHU_148, KICHBAN_KIEMTHU_154). Giá trị duyệt vẫn gửi sang yêu cầu duyệt cho người duyệt.
- Chống tồn âm, đồng thời: sổ kho khóa dòng `costs` rồi dòng `balances` (`SELECT ... FOR UPDATE`) theo thứ tự khóa cố định (kho, chủ hàng, biến thể, lô, vị trí) trong giao dịch của phiếu; giữ hàng khóa dòng `costs` trước khi tính tồn khả dụng; cột `quantity` của `balances`, `costs` có ràng buộc không âm ở cơ sở dữ liệu (KICHBAN_KIEMTHU_149).
- Thẻ kho chỉ thêm: trigger `movements_append_only` chặn `UPDATE`, `DELETE` trên `inventory.movements` ở tầng cơ sở dữ liệu (KICHBAN_KIEMTHU_148); sai thì lập phiếu khác.
- Kiểm kê khóa mặt hàng đang đếm: sổ kho từ chối ghi vào mặt hàng (và vị trí) trong phạm vi kiểm kê đang đếm, trừ phiếu điều chỉnh của chính kiểm kê đó.
- Tem PDF: `pdfmake` chặn tải tài nguyên qua URL và chỉ đọc tệp phông trong thư mục phông của thư viện; nội dung tem chỉ gồm ký tự ASCII.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `inventory` (kho, vị trí, cài đặt, phiếu, xuất, nhận, kiểm kê, giữ hàng, tồn an toàn); ghi sổ sau duyệt và tác vụ nền nhả hàng giữ không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_07 Khách hàng và Đối tác (CONG_VIEC_06)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `crm.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `crm.partner.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác, Thủ kho |
| `crm.partner.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Quản lý đối tác |
| `crm.partner.identity.view` | Công ty | Có (bắt buộc xác thực hai lớp, QUYTAC_NGHIEPVU_09) | Quản trị tập đoàn, quản trị công ty |
| `crm.profile.manage` | Công ty | Có (hạn mức công nợ; bắt buộc xác thực hai lớp) | Quản trị tập đoàn, quản trị công ty |

Vai trò hệ thống mới "Quản lý đối tác" (`partner_manager`): `crm.access`, `crm.partner.view`, `crm.partner.manage`. Vai trò "Thủ kho" có thêm `crm.partner.view`.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý đối tác | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_46 Xem, tìm đối tác (số Căn cước công dân che) | Được | Được | Được | Được | Không |
| CHUC_NANG_46 Thêm, sửa, ngừng giao dịch đối tác bên ngoài | Được | Được | Được | Không | Không |
| CHUC_NANG_46 Xem đầy đủ số Căn cước công dân | Được, ghi nhật ký | Được, ghi nhật ký | Không | Không | Không |
| CHUC_NANG_47 Sửa đối tác nội bộ | Không (sửa ở màn hình Công ty) | Không | Không | Không | Không |
| CHUC_NANG_48 Lập, sửa hồ sơ đối tác của công ty | Được | Trong công ty mình | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Đối tác dùng chung tập đoàn: không lọc theo công ty; người có `crm.partner.manage` ở bất kỳ công ty nào sửa được thông tin chung (QUYTAC_NGHIEPVU_57), nhật ký ghi công ty của người sửa và dữ liệu trước, sau (KICHBAN_KIEMTHU_161). Không có API xóa đối tác.
- Số Căn cước công dân là dữ liệu cá nhân (QUYTAC_NGHIEPVU_59): không trả trong danh sách, chi tiết, kết quả thêm, sửa (KICHBAN_KIEMTHU_163 kiểm nội dung trả về không chứa số đầy đủ); nhật ký thêm, sửa thay số bằng `***` + 3 số cuối; xem đầy đủ cần quyền nhạy cảm, mỗi lần gọi ghi nhật ký `partner.view_identity` không kèm số; giao diện chỉ gọi khi người dùng bấm "Xem đầy đủ". Sửa đối tác cá nhân không cần xem số đầy đủ (để trống là giữ số cũ). Hạn mức công nợ chỉ trả cho người có quyền nhạy cảm `crm.profile.manage`; người khác nhận `creditLimitHidden: true`.
- Hồ sơ đối tác theo công ty: truy vấn hồ sơ luôn có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `profile: null`, bộ lọc khách hàng, nhà cung cấp chỉ theo hồ sơ của công ty mình (KICHBAN_KIEMTHU_164). Nhóm khách hàng, nhân viên phụ trách phải thuộc công ty đang làm việc.
- Đối tác nội bộ chỉ do hệ thống đồng bộ từ `core.companies`; API từ chối sửa, đổi trạng thái (KICHBAN_KIEMTHU_162).
- Kiểm trùng (`lookup`) trả mã, tên đối tác khi biết đúng mã số thuế (người có `crm.partner.view`) hoặc đúng số Căn cước công dân (chỉ người có `crm.partner.manage`, tránh dò tìm danh tính; KICHBAN_KIEMTHU_163); không trả số Căn cước công dân.
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `crm` (thêm, sửa, ngừng giao dịch, giao dịch lại đối tác, lưu hồ sơ) và mỗi lần xem số Căn cước công dân; đồng bộ đối tác nội bộ không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_04 Mua hàng phần 1 (CONG_VIEC_07)

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `purchasing.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `purchasing.price.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.requisition.create` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Thủ kho |
| `purchasing.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `purchasing.import.view` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Kế toán, Kế toán trưởng (CONG_VIEC_45) |
| `purchasing.import.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng, Kế toán, Kế toán trưởng (CONG_VIEC_45) |
| `inventory.purchase.receive` | Công ty, chi nhánh sở hữu kho | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

Vai trò hệ thống mới "Nhân viên mua hàng" (`purchaser`): `purchasing.access`, `purchasing.price.manage`, `purchasing.requisition.create`, `purchasing.order.view`, `purchasing.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`. Vai trò "Thủ kho" có thêm `inventory.purchase.receive`, `purchasing.access`, `purchasing.requisition.create`, `purchasing.order.view`. Loại chứng từ mới: `purchasing.requisition`, `purchasing.order` (cần duyệt); `inventory.purchase_receipt`, `inventory.purchase_return` (không cần duyệt, có chứng từ gốc).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên mua hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_49 Xem bảng giá mua | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_49 Thêm, sửa, ngừng dùng giá mua | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_50 Lập, sửa, gửi, rút đề nghị mua | Được | Trong công ty mình | Được | Được (gán ở chi nhánh vẫn dùng được) | Không | Có (sửa, gửi, rút chỉ người lập) |
| CHUC_NANG_50 Đóng đề nghị mua | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_51 Xem đơn mua | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_51 Lập, sửa, gửi, đóng đơn mua | Được | Trong công ty mình | Được | Không | Không | Có (rút chỉ người lập) |
| CHUC_NANG_51 Cài đặt dung sai | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_52, CHUC_NANG_53 Nhập mua, kiểm tra chất lượng, trả hàng | Được | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Có (sửa, gửi, xóa nháp chỉ người lập) |
| CHUC_NANG_50, CHUC_NANG_51 Duyệt đề nghị mua, đơn mua | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt) |

Ranh giới và kiểm soát riêng:
- Dữ liệu Mua hàng theo công ty: mọi truy vấn bảng giá, đề nghị, đơn mua có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `404`, danh sách trống, đóng đơn của công ty khác bị từ chối (KICHBAN_KIEMTHU_165, KICHBAN_KIEMTHU_167).
- Quyền theo chi nhánh: chỉ `purchasing.requisition.create`, `purchasing.order.view` gán ở chi nhánh được dùng trong cả công ty (thủ kho chi nhánh xem được mọi đơn mua của công ty, gồm đơn giá); quyền lập, sửa, đóng đơn, bảng giá, cài đặt cần lần gán ở tập đoàn hoặc công ty.
- Nhận hàng theo kho: phiếu nhập mua, trả hàng kiểm `inventory.purchase.receive` tại kho nhận của đơn hoặc kho của phiếu gốc; thủ kho chi nhánh khác không thấy đơn trong danh sách cần nhận, không lập phiếu (KICHBAN_KIEMTHU_168).
- Chống nhận vượt, trả vượt khi đồng thời: gửi phiếu nhập khóa dòng đơn mua (`FOR UPDATE`) rồi kiểm dung sai; gửi phiếu trả khóa dòng phiếu nhập gốc; giá mua kiểm chồng hiệu lực khi giữ khóa tư vấn.
- Phiếu mua không lập, không sửa qua API phiếu kho thường (`POST`, `PATCH /inventory/documents` từ chối loại `purchase_receipt`, `purchase_return`).
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `purchasing` (giá mua, cài đặt, đề nghị, đơn mua) và của phiếu nhập mua, trả hàng (lập, sửa, gửi, kiểm tra chất lượng); chuyển trạng thái sau duyệt, chuyển "Đã nhận đủ" không ghi nhật ký riêng.

### Ma trận phân quyền MODULE_05 Bán hàng phần 1 (CONG_VIEC_08)

Sửa theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): `sales.order.manage` của vai trò Nhân viên bán hàng bỏ; Kế toán, Kế toán trưởng thêm `sales.access`, `sales.order.view`, `sales.order.manage` (ma trận mới cuối mục 4).

Quyền mới (`apps/api/src/permissions/permission-catalog.ts`; `sales.access` đã có từ trước):

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `sales.order.view` | Công ty, chi nhánh | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng, Thủ kho |
| `sales.order.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên bán hàng |
| `sales.settings.manage` | Công ty | Không | Quản trị tập đoàn, quản trị công ty |
| `inventory.sales.issue` | Công ty, chi nhánh sở hữu kho | Không | Quản trị tập đoàn, quản trị công ty, Thủ kho, Quản lý kho |

Vai trò hệ thống mới "Nhân viên bán hàng" (`salesperson`): `sales.access`, `sales.order.view`, `sales.order.manage`, `crm.access`, `crm.partner.view`, `crm.partner.manage`, `catalog.access`, `catalog.price.view`. Vai trò "Thủ kho" có thêm `inventory.sales.issue`, `sales.access`, `sales.order.view`. Loại chứng từ mới: `sales.order` (cần duyệt khi có ngoại lệ); `inventory.sales_issue`, `inventory.sales_return` (không cần duyệt, có chứng từ gốc).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_54 Xem đơn bán | Được | Trong công ty mình | Được | Được (gán ở chi nhánh vẫn dùng được) | Không | Không |
| CHUC_NANG_54 Tra giá, lập, sửa, gửi, hủy, đóng đơn bán | Được | Trong công ty mình | Được | Không | Không | Có (rút chỉ người lập) |
| CHUC_NANG_54 Xem số trong diễn giải ngoại lệ hạn mức công nợ, giá vốn | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_55 Cài đặt chiết khấu tay tối đa | Được | Trong công ty mình | Không (xem được) | Không (xem được) | Không | Không |
| CHUC_NANG_56, CHUC_NANG_57 Giao hàng, nhận hàng trả lại | Được | Kho của công ty mình | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Có (gửi, xóa nháp chỉ người lập) |
| CHUC_NANG_54 Duyệt đơn bán có ngoại lệ | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt) |

Ranh giới và kiểm soát riêng:
- Dữ liệu Bán hàng theo công ty: mọi truy vấn đơn bán, cài đặt có điều kiện `company_id` của công ty đang làm việc; công ty khác nhận `404`, danh sách trống; hủy, đóng đơn của công ty khác bị từ chối (KICHBAN_KIEMTHU_173, KICHBAN_KIEMTHU_179).
- Quyền theo chi nhánh: chỉ `sales.order.view` gán ở chi nhánh được dùng trong cả công ty (thủ kho chi nhánh xem được mọi đơn bán của công ty, gồm giá bán, chiết khấu); quyền lập, sửa, hủy, đóng, tra giá, cài đặt cần lần gán ở tập đoàn hoặc công ty (`apps/api/src/sales/sales-context.ts`).
- Giao hàng theo kho: phiếu xuất giao hàng, nhận hàng trả lại kiểm `inventory.sales.issue` tại kho xuất của đơn hoặc kho của phiếu gốc; thủ kho chi nhánh khác không thấy đơn trong danh sách cần giao, không lập phiếu (KICHBAN_KIEMTHU_174).
- Giá không do người dùng gửi: đơn giá dòng luôn tra theo bảng giá phía máy chủ khi lưu; người dùng chỉ gửi chiết khấu phần trăm, vượt mức thì phải duyệt.
- Che hạn mức công nợ, giá vốn: hạn mức công nợ là dữ liệu chỉ người có `crm.profile.manage` xem (CONG_VIEC_06), giá vốn chỉ người có `inventory.cost.view` xem; diễn giải ngoại lệ chứa các số này nên API_77 trả chuỗi trống cho người không có quyền tương ứng, giao diện chỉ hiện loại ngoại lệ (KICHBAN_KIEMTHU_178). Người duyệt đơn bán xem đơn qua MAN_HINH_43 cũng theo quyền của mình.
- Chống bán trùng, giao vượt, trả vượt khi đồng thời: gửi đơn khóa đơn (`FOR UPDATE`) và hồ sơ khách (hai đơn cùng khách không cùng lọt hạn mức), giữ hàng khóa dòng giá vốn theo thứ tự mã mặt hàng; gửi phiếu xuất khóa đơn bán rồi kiểm số còn phải giao, dùng hàng giữ theo thứ tự mã mặt hàng; gửi phiếu trả khóa các dòng phiếu xuất gốc bằng câu lệnh riêng (theo thứ tự mã) trước khi tính số đã trả; kiểm hàng khả dụng khi gửi phiếu đọc trong cùng giao dịch (KICHBAN_KIEMTHU_181).
- Phiếu bán hàng không lập, không sửa qua API phiếu kho thường (`POST`, `PATCH /inventory/documents` từ chối loại `sales_issue`, `sales_return`).
- Nhật ký thao tác ghi mọi thao tác ghi của mini app `sales` (lập, sửa, gửi, hủy, đóng đơn; cài đặt) và của phiếu xuất giao hàng, nhận hàng trả lại (lập, gửi, xóa nháp); rút đơn ghi ở luồng duyệt (`approval_request.withdraw`); chuyển trạng thái sau duyệt, chuyển "Đã giao đủ" không ghi nhật ký riêng.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Đã sửa trong mã: diễn giải ngoại lệ ban đầu trả nguyên số hạn mức công nợ, dư nợ, giá vốn bình quân cho mọi người xem đơn (Nhân viên bán hàng, Thủ kho); nay che theo quyền như trên.
- Ghi nhận (đúng phạm vi vận hành kho): `GET /inventory/sales-orders`, `GET /inventory/sales-orders/{id}` lọc theo kho người dùng có `inventory.sales.issue`, không lọc theo công ty đang làm việc; kho dùng chung nhiều công ty chủ hàng thì thủ kho thấy đơn đã xác nhận của các công ty chủ hàng đó (đúng phạm vi vận hành kho, như nhập mua). Đã sửa: `GET /inventory/sales-orders/{id}` chỉ trả đơn đã xác nhận, đã giao đủ, đã đóng; đơn khác trả `404`.
- Không có mục rủi ro cao còn mở.

### Ma trận phân quyền giao dịch nội bộ MODULE_05 phần 2 (CONG_VIEC_09)

Không thêm quyền, vai trò, loại chứng từ. Mỗi bên dùng quyền của mình tại công ty mình (tài liệu `08` mục 12).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Nhân viên mua hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_58, CHUC_NANG_59 Xác nhận, từ chối đơn bán đối ứng | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_58, CHUC_NANG_59 Xác nhận, từ chối đơn mua đối ứng | Được | Trong công ty mình | Không | Được | Không | Không | Không |
| CHUC_NANG_60 Nhận hàng nội bộ | Được | Kho của công ty mình | Không | Không | Kho trong phạm vi gán | Kho trong phạm vi gán | Không |
| CHUC_NANG_61 Xem, xử lý biên bản chênh lệch | Được | Kho của công ty mình | Không | Không | Kho xuất trong phạm vi gán | Kho xuất trong phạm vi gán | Không |
| CHUC_NANG_61 Xem giá trị biên bản | Được | Trong công ty mình | Không | Không | Không | Được | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu hai công ty: xác nhận, từ chối, xem đơn chỉ trong công ty đang làm việc (`company_id`); công ty bán không mở được đơn mua của công ty mua (`404`, KICHBAN_KIEMTHU_187). Chứng từ đối ứng trong phản hồi chỉ có tên ngắn công ty, số, trạng thái. Biên bản chênh lệch chỉ trả cho công ty bán (công ty mua nhận danh sách rỗng, KICHBAN_KIEMTHU_189).
- Sinh, kết thúc chứng từ bên kia do hệ thống làm trong cùng giao dịch của thao tác hợp lệ ở bên khởi tạo, không kiểm quyền người gọi ở công ty bên kia; người gọi chỉ quyết định được chứng từ của công ty mình, bên kia vẫn phải xác nhận bằng quyền của họ.
- Giá không do người dùng gửi: đơn mua nội bộ bỏ đơn giá, thuế suất gửi lên, lấy theo bảng giá kênh Nội bộ bên bán; đơn đối ứng lấy giá theo chứng từ khởi tạo; đơn đối ứng và đơn mua nội bộ đã có đơn đối ứng không sửa được.
- Nhận hàng: số nhận không vượt số xuất, serial chỉ trong serial đã xuất; khóa phiếu theo phiên bản để không nhận hai lần; đơn mua nội bộ không nhập mua thường được (tránh nhập trùng).
- Biên bản: giữ biên bản (`status = 'open'`, đúng phiên bản) trước khi nhập lại kho để hai người không cùng nhập lại; giá trị chỉ trả cho người có `inventory.cost.view`.
- Nhật ký thao tác: `sales_order.counterpart_confirm`, `.counterpart_reject`, `purchase_order.counterpart_confirm`, `.counterpart_reject`, `stock_document.receive_internal`, `internal_discrepancy.resolve`; sinh, kết thúc chứng từ bên kia không ghi nhật ký riêng, lý do ghi trên chứng từ.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở.
- Ghi nhận, chưa sửa: hai bên hủy, đóng cùng lúc (ví dụ bên bán hủy đơn bán trong khi bên mua đóng đơn mua đối ứng) khóa hai đơn theo thứ tự ngược nhau, có thể khóa chéo; PostgreSQL hủy một giao dịch, người gọi nhận lỗi `500`, dữ liệu không hỏng, thao tác lại được.
- Ghi nhận, chưa sửa: đơn giá dòng đơn mua đối ứng làm tròn 4 chữ số (tiền chưa thuế dòng đơn bán chia số lượng bên mua), tổng đơn mua có thể lệch vài đồng lẻ so với đơn bán.
- Ghi nhận (đúng phạm vi vận hành kho): kho dùng chung nhiều công ty chủ hàng thì thủ kho có `inventory.purchase.receive` tại kho (kể cả thủ kho công ty bán) thấy và nhận được phiếu nhập nội bộ của công ty mua ở kho đó, như phiếu kho khác (QUYTAC_NGHIEPVU_46).
- Ghi nhận: giá bảng giá kênh Nội bộ của công ty bán hiện cho người lập đơn mua ở công ty mua (theo QUYTAC_NGHIEPVU_75). Trước khi xác nhận, đơn đối ứng hiện người lập là người lập chứng từ khởi tạo ở công ty kia (họ tên).
- Ghi nhận: "Nhập lại kho" giữ biên bản rồi lập, ghi sổ phiếu trả ở giao dịch riêng; lỗi thì trả biên bản về "Chờ xử lý", nhưng máy chủ dừng giữa chừng có thể để biên bản "Đã nhập lại kho" chưa có phiếu trả. Danh sách biên bản tối đa 500 dòng, chưa phân trang.

### Ma trận phân quyền khuyến mãi MODULE_05 phần 3 (CONG_VIEC_12)

Thêm quyền `sales.promotion.view`, `sales.promotion.manage` (không nhạy cảm, phạm vi công ty) và loại chứng từ duyệt `sales.promotion` (tài liệu `08` mục 13).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Nhân viên bán hàng | Thủ kho | Quản lý kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_62, CHUC_NANG_64 Xem chương trình, đã dùng | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_62 Lập, sửa, gửi duyệt, dừng chương trình | Được | Trong công ty mình | Không | Không | Không | Không |
| CHUC_NANG_62 Rút chương trình chờ duyệt | Được | Trong công ty mình | Không | Không | Không | Có (người lập) |
| CHUC_NANG_63 Khuyến mãi tự áp khi lưu đơn bán | Được | Trong công ty mình | Được | Không | Không | Không |
| Tìm mặt hàng `/sales/items` | Được | Trong công ty mình | Được | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: chương trình đọc, sửa, gửi, rút, dừng theo `company_id` của công ty đang làm việc (chương trình công ty khác trả `404`); mặt hàng, kênh, nhóm khách gửi lên phải thuộc công ty; khuyến mãi áp vào đơn chỉ lấy chương trình của công ty của đơn; mặt hàng tặng, tồn hàng tặng đọc theo công ty và kho xuất đã kiểm.
- Giá không do người dùng gửi: dòng đơn gửi lên không có trường khuyến mãi; phần trăm, tiền giảm, dòng hàng tặng do máy chủ tính; dòng tặng không sửa tay.
- Chương trình chỉ chạy sau khi đi luồng duyệt (hoặc công ty chưa có chính sách duyệt); chương trình đang chạy không sửa được, chỉ dừng.
- Giới hạn: gửi đơn khóa chương trình đã áp (`FOR UPDATE`, thứ tự theo mã) rồi kiểm ngân sách, số suất cùng các đơn khác, nên hai đơn gửi đồng thời không cùng vượt giới hạn.
- Ngoại lệ dưới giá vốn: chỉ bỏ qua phần giảm do khuyến mãi đã duyệt và dòng tặng; chiết khấu tay vẫn kiểm mức tối đa.
- Nhật ký thao tác: `promotion.create`, `.update`, `.submit`, `.stop`; rút ghi theo yêu cầu duyệt; áp khuyến mãi ghi theo `sales_order.create`, `.update`.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở.
- Ghi nhận, chưa sửa: giá trị gửi duyệt là ngân sách; chương trình không giới hạn ngân sách (hoặc mua X tặng Y) gửi với giá trị 0, nên chính sách duyệt chỉ có cấp từ mức tiền lớn hơn 0 sẽ không áp, chương trình chạy ngay. Công ty muốn duyệt mọi chương trình thì đặt cấp duyệt từ 0 đồng. Người dùng quyết định giữ cách này (2026-11-10).
- Ghi nhận, chưa sửa: lưu đơn đọc đã dùng, tồn hàng tặng không khóa; giới hạn chỉ chắc chắn khi gửi đơn (kiểm lại). Tồn hàng tặng giảm giữa lúc lưu và lúc gửi thì gửi đơn báo thiếu hàng ở dòng tặng, người bán lưu lại để tính lại.
- Ghi nhận (theo QUYTAC_NGHIEPVU_84): dừng chương trình không gỡ khuyến mãi khỏi đơn nháp đã lưu; đơn đó gửi vẫn giữ khuyến mãi nếu còn ngân sách, số suất.
- Đã sửa (commit 57bbcd0): rút chương trình ghi nhật ký `promotion.withdraw` trong cùng giao dịch; `maxGiftSets` tối đa 1.000.000.000, vượt thì trả lỗi kiểm tra dữ liệu `400` (KICHBAN_KIEMTHU_193).
- Ghi nhận: Nhân viên bán hàng xem được ngân sách, đã dùng của chương trình (để tư vấn khách); cảnh báo thiếu suất tặng cho biết gián tiếp tồn hàng tặng tại kho xuất, người bán vốn đã thấy lỗi thiếu hàng khi gửi đơn.

### Ma trận phân quyền công nợ MODULE_06 phần 1 (CONG_VIEC_13)

Thêm quyền `finance.debt.view`, `finance.fund.manage`, `finance.debt.manage`, `finance.payment.manage` (không nhạy cảm, chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty), vai trò Kế toán, loại chứng từ `finance.receipt` (không duyệt), `finance.payment` (cần duyệt) (tài liệu `08` mục 14, 15).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_65 Xem quỹ, sổ quỹ | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_65 Thêm, sửa, ngừng dùng quỹ | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_66 Xem công nợ, chi tiết đối tác | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_66 Nhập, xóa số dư đầu kỳ | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_66 Công nợ tự phát sinh khi ghi sổ phiếu kho | Được | Kho của công ty mình | Không | Không | Kho trong phạm vi gán | Không |
| CHUC_NANG_67 Lập, sửa, gửi phiếu thu chi | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_67 Rút phiếu chi chờ duyệt | Được | Trong công ty mình | Được | Không | Không | Có (người lập) |
| CHUC_NANG_67 Duyệt phiếu chi | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: quỹ, khoản công nợ, phiếu đọc, ghi theo `company_id` của công ty đang làm việc; đối tác phải có hồ sơ khách hàng hoặc nhà cung cấp ở công ty; khoản công nợ chọn trừ phải thuộc công ty, đúng đối tác, đúng phía; trừ nợ chỉ ghép hai khoản cùng công ty, đối tác, phía; chi tiết công nợ chỉ cho đối tác có hồ sơ hoặc có công nợ với công ty (khác thì `404`).
- Quyền tài chính kiểm bằng `requireFinancePermission`: quyền gán ở chi nhánh không mở được dữ liệu công nợ của cả công ty.
- Tiền không do người dùng quyết định ngoài số tiền phiếu và số trừ: giá trị công nợ từ phiếu kho tính phía máy chủ (`finance.inventory_debt_amount`); số dư quỹ, số còn lại, trả trước tính từ dữ liệu; tiền lưu `numeric(20,4)`.
- Khóa đồng thời: mọi thay đổi công nợ của một đối tác ở một phía khóa `pg_advisory_xact_lock` theo công ty, phía, đối tác; ghi sổ phiếu thu chi khóa công nợ trước, khóa quỹ (`FOR UPDATE`) sau, rồi mới tính số dư quỹ bằng câu lệnh riêng; ghi sổ kiểm lại mọi điều kiện, nên hai phiếu đồng thời không trừ quá số còn nợ, không làm quỹ âm. Sửa, gửi phiếu kiểm phiên bản trong câu khóa phiếu.
- Ghi tổn thất biên bản chênh lệch nội bộ giảm phải thu bên bán trong cùng giao dịch đóng biên bản (giữ biên bản `open` đúng phiên bản), giá trị tính theo giá đơn bán phía máy chủ, nên một biên bản chỉ sinh một khoản giảm.
- Phiếu chi chỉ ghi sổ sau luồng duyệt (hoặc công ty chưa có chính sách duyệt); phiếu đã ghi sổ không sửa, không hủy; khoản công nợ từ chứng từ không sửa, không xóa.
- Nhật ký thao tác: `fund.create`, `.update`; `debt.opening.create`, `.delete`; `payment.create`, `.update`, `.submit`, `.withdraw`.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở.
- Đã sửa (commit 173a73b): ghi sổ phiếu chi đọc số dư quỹ trước khi khóa quỹ, hai phiếu chi duyệt đồng thời có thể cùng qua kiểm số dư và làm quỹ âm (mức Cao); nay khóa quỹ rồi mới tính số dư. Xóa khoản số dư đầu kỳ đang được chọn trên phiếu thu chi trả lỗi máy chủ; nay trả `409` và không xóa. Chi tiết công nợ trả tên, mã của mọi đối tác dùng chung tập đoàn theo mã; nay chỉ đối tác có quan hệ với công ty. Lý do không ghi sổ lưu câu tiếng Việt; nay lưu khóa thông báo.
- Ghi nhận, chưa sửa (Thấp): so sánh tiền (số trừ, số dư quỹ, trả trước) và số dư lũy kế của sổ quỹ tính bằng số thực của JavaScript với sai số 0,00005; tiền đến 12 chữ số phần nguyên, 4 chữ số lẻ vượt độ chính xác của số thực, giá trị rất lớn có thể sai ở chữ số lẻ cuối khi so sánh, hiển thị sổ quỹ. Dữ liệu lưu, trừ nợ tính bằng `numeric` nên không sai số liệu gốc. Đề xuất: so sánh trong SQL hoặc dùng số thập phân chính xác.
- Đã sửa: tìm đối tác ở API_85 (`/finance/debts`, `/finance/partners`) theo mã nay so khớp đúng mã (chữ in hoa), không dùng `ILIKE`.
- Ghi nhận, chưa sửa (Thấp): ghi sổ phiếu chi sau khi duyệt và việc chuyển phiếu sang "Bị từ chối" do không ghi sổ được chạy trong xử lý sự kiện, không ghi dòng nhật ký thao tác riêng (chỉ có nhật ký của yêu cầu duyệt và `payment.submit`).
- Đã sửa: lập, sửa phiếu thu chi, số dư đầu kỳ chỉ nhận đối tác có hồ sơ đang giao dịch và đối tác chưa ngừng giao dịch (báo lỗi "chưa có hồ sơ đang dùng ở công ty").
- Ghi nhận, chưa sửa (nghiệp vụ): ngày phiếu không giới hạn; phiếu chi ghi ngày trong quá khứ chỉ kiểm số dư quỹ hiện tại, nên sổ quỹ theo ngày có thể hiện số dư lũy kế âm tại một ngày trước đó.
- Ghi nhận: bốn quyền tài chính không đánh dấu nhạy cảm; dữ liệu chỉ lộ trong công ty, theo quyền gán.

### Ma trận phân quyền kế toán tổng hợp MODULE_06 phần 2 (CONG_VIEC_14)

Thêm quyền `finance.ledger.view`, `finance.ledger.setup`, `finance.journal.manage` (không nhạy cảm), `finance.period.close` (nhạy cảm), chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty; vai trò Kế toán trưởng; Kế toán thêm `finance.ledger.view`, `finance.journal.manage`; loại chứng từ `accounting.journal` (cần duyệt) (tài liệu `08` mục 16, 17).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_69 Khởi tạo, thêm, sửa tài khoản | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_69 Xem tài khoản | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_70 Đổi định khoản mặc định | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_71 Bút toán tự sinh khi ghi sổ chứng từ | Được | Trong công ty mình | Được (phiếu thu chi) | Được (phiếu thu chi) | Không | Kho trong phạm vi gán | Không |
| CHUC_NANG_72 Xem bút toán; lập, sửa, gửi phiếu kế toán | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_72 Rút phiếu kế toán chờ duyệt | Được | Trong công ty mình | Được | Được | Không | Không | Có (người lập) |
| CHUC_NANG_72 Duyệt phiếu kế toán | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không |
| CHUC_NANG_73 Xem sổ cái, bảng cân đối, kỳ | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_73 Khóa sổ, mở lại sổ | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_01 Đổi chế độ kế toán của công ty | Được | Không | Không | Không | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: tài khoản, định khoản, bút toán, cài đặt đọc, ghi theo `company_id` của công ty đang làm việc; tài khoản cha, tài khoản dòng phiếu, tài khoản định khoản phải thuộc công ty; đối tác dòng phiếu phải có hồ sơ ở công ty; sổ cái tài khoản của công ty khác trả `404`.
- Quyền kiểm bằng `requireFinancePermission` (bao trùm công ty): quyền gán ở chi nhánh không mở được sổ kế toán.
- Số tiền bút toán tự sinh tính phía máy chủ từ đơn bán, đơn mua, giá trị ghi sổ kho, phiếu thu chi; người dùng chỉ nhập số tiền ở phiếu kế toán, phiếu này đi luồng duyệt (trừ khi công ty chưa có chính sách). Tổng Nợ bằng tổng Có kiểm ở máy chủ; cơ sở dữ liệu kiểm mỗi dòng một bên.
- Khóa sổ, mở lại là quyền nhạy cảm; khóa dòng `accounting.settings` (`FOR UPDATE`) chạy tuần tự với ghi sổ chứng từ (`FOR SHARE`), nên không có chứng từ lọt vào kỳ vừa khóa.
- Bút toán tự sinh, kết chuyển không sửa, không gửi qua API_88 (chỉ `manual`). Bút toán kết chuyển chỉ bị xóa khi mở lại.
- Nhật ký thao tác: `ledger.setup`; `account.create`, `.update`; `posting_rule.update`; `journal.create`, `.update`, `.submit`, `.withdraw`; `period.close`, `period.reopen`.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở. Đã kiểm: mọi endpoint kiểm quyền và giới hạn công ty; mọi truy vấn dùng tham số của Drizzle, không ghép chuỗi SQL; vai trò trong đường dẫn so với danh mục; không có tệp tải lên.
- Ghi nhận, chưa sửa (rủi ro nghiệp vụ, Trung bình): danh mục tài khoản Thông tư 99/2025/TT-BTC trong `apps/api/src/accounting/charts.ts` lập từ bản chép Phụ lục II, đã đối chiếu số lượng và các điểm thay đổi nhưng chưa so với bản gốc trên Công báo. Sai số hiệu, tên hoặc tính chất làm sai sổ kế toán và báo cáo tài chính (CONG_VIEC_15). Phải được kế toán trưởng so với bản gốc trước khi phát hành.
- Đã sửa (commit 4f6be5f, rà soát độc lập: 1 mục Cao, 6 mục Trung bình): khởi tạo tạo bút toán cho cả phiếu nhập nội bộ đang đi đường, sau đó không nhận hàng được (Cao); nay chỉ phiếu kho đã ghi sổ. Phiếu kho cần duyệt duyệt xong khi kỳ đã khóa làm xử lý sự kiện lỗi lặp lại; nay không gửi được khi ngày thuộc kỳ khóa, duyệt xong mà kỳ khóa thì bị từ chối, nhả hàng giữ. Khóa sổ khi còn phiếu kho, phiếu chi đang chờ có ngày trong kỳ; nay chặn. Khởi tạo chạy song song với ghi sổ chứng từ có thể sót bút toán; nay ghi sổ khóa chia sẻ dòng công ty khi chưa khởi tạo. Đổi chế độ chạy song song với ghi sổ; nay khóa dòng cài đặt. Phiếu kế toán ghi sổ vào tài khoản đã có tài khoản chi tiết hoặc ngừng dùng sau khi lập; nay kiểm lại khi ghi sổ, tài khoản 131, 331 bắt buộc đối tác. Sổ cái tính tổng, số dư cuối trên 10.000 dòng đầu; nay tính bằng SQL trên toàn khoảng. Công nợ 4 chữ số lẻ lệch phần lẻ với 131, 331; nay công nợ và bút toán làm tròn chung theo lũy kế (THAY_DOI_10, quyết định của người dùng). Phiếu thu chi, số dư đầu kỳ nhận số lẻ hơn đơn vị tiền tệ; nay từ chối.
- Ghi nhận, chưa sửa (Thấp): bảng cân đối, sổ cái cộng tiền trong mã bằng số thực của JavaScript (như sổ quỹ, CONG_VIEC_13); danh sách dòng sổ cái chỉ hiện 10.000 dòng đầu (tổng, số dư cuối vẫn đúng). Bảng cân đối không giới hạn khoảng ngày.
- Ghi nhận, chưa sửa (Thấp): khởi tạo kế toán tạo bút toán cho mọi chứng từ cũ trong một giao dịch, khóa dòng công ty suốt thời gian chạy; công ty nhiều chứng từ có thể làm ghi sổ chờ lâu.
- Ghi nhận, chưa sửa (Thấp): ghi sổ phiếu kế toán sau khi duyệt và việc chuyển phiếu sang "Bị từ chối" do kỳ đã khóa chạy trong xử lý sự kiện, không ghi dòng nhật ký thao tác riêng (như phiếu chi).
- Ghi nhận: phiếu chuyển kho không sinh bút toán; gửi bị chặn khi ngày thuộc kỳ khóa, nhưng chuyển kho cần duyệt mà duyệt xong sau khi khóa vẫn ghi sổ (không ảnh hưởng sổ kế toán).

### Ma trận phân quyền báo cáo tài chính MODULE_06 phần 3 (CONG_VIEC_15)

Không thêm quyền, vai trò (tài liệu `08` mục 18).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_74, CHUC_NANG_75 Xem, xuất Excel, PDF báo cáo tài chính | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_75 Đánh dấu tài khoản chi tiết dài hạn | Được | Trong công ty mình | Được | Không | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn của `StatementsService` lọc theo `company_id` của công ty đang làm việc (`actor.companyId`, lấy từ header `X-Company-Id` sau khi kiểm thành viên); không nhận mã công ty, mã tài khoản từ người dùng.
- Quyền kiểm bằng `requireFinancePermission` với `finance.ledger.view` (bao trùm công ty); quyền gán ở chi nhánh không xem được báo cáo.
- Chỉ đọc: API_90 không ghi dữ liệu, không ghi nhật ký thao tác. Đánh dấu dài hạn đi qua API_87 (`finance.ledger.setup`), ghi nhật ký `account.update`.
- Xuất tệp: `content-type` theo định dạng; `content-disposition` `attachment` với Excel, `inline` với PDF; tên tệp ghép từ mã mẫu (hằng trong mã) và ngày đã kiểm định dạng, không chứa dữ liệu người dùng nhập tự do. PDF chỉ đọc phông chữ trong thư mục của `pdfmake`, chặn tải tài nguyên theo URL.
- Không thêm thư viện phụ thuộc: dùng `write-excel-file`, `pdfmake` đã có.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10):
- Không có mục rủi ro cao còn mở. Đã kiểm: endpoint kiểm quyền và giới hạn công ty; truy vấn dùng tham số của Drizzle (`sql`, `sql.join`), không ghép chuỗi SQL; tham số truy vấn qua lược đồ zod; tài khoản của chế độ không đánh dấu dài hạn được (kiểm ở máy chủ).
- Ghi nhận, chưa sửa (rủi ro nghiệp vụ, Trung bình): mẫu B01-DN, B02-DN theo Thông tư 99/2025/TT-BTC (`apps/api/src/accounting/statement-templates.ts`) lập từ bản chép Phụ lục IV kèm Thông tư và tài liệu tập huấn của Bộ Tài chính, một phần từ hướng dẫn thứ cấp; Phụ lục IV chưa so với bản gốc trên Công báo; nhiều chỉ tiêu ghi chú "chưa xác minh" tài khoản nguồn. Cùng rủi ro với danh mục tài khoản Thông tư 99/2025 (mục CONG_VIEC_14 ở trên). Phải được kế toán trưởng so với bản gốc trước khi phát hành (đặc tả `cong_viec/CONG_VIEC_15.md` mục 16).
- Ghi nhận, chưa sửa (Thấp): bộ tính cộng tiền bằng số thực của JavaScript rồi làm tròn theo đơn vị tiền tệ (như bảng cân đối số phát sinh, CONG_VIEC_14).
- Ghi nhận, chưa sửa (Thấp): khoảng ngày của báo cáo kết quả kinh doanh không giới hạn; mỗi chỉ tiêu có tài khoản đối ứng chạy một truy vấn riêng, nên khoảng ngày dài trên công ty nhiều bút toán có thể chậm.
- Ghi nhận: báo cáo lộ doanh thu, giá vốn, lãi lỗ, tổng tài sản cho người có `finance.ledger.view` (Kế toán có sẵn), như sổ cái.

### Ma trận phân quyền hóa đơn điện tử MODULE_06 phần 4 (CONG_VIEC_16)

Quyền mới `finance.einvoice.view`, `finance.einvoice.manage`, `finance.einvoice.setup` (nhạy cảm) (tài liệu `08` mục 19, 20).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_76 Xem cài đặt | Được | Trong công ty mình | Được | Được (không thấy 4 ký tự cuối mật khẩu) | Không | Không | Không |
| CHUC_NANG_76 Sửa cài đặt, kiểm tra kết nối | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_77 đến CHUC_NANG_79 Xem hóa đơn, tải PDF, XML, xem việc trả hàng | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_77 đến CHUC_NANG_79 Gửi lại, điều chỉnh giảm, ghi hóa đơn của người mua, thay thế | Được | Trong công ty mình | Được | Được | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn lọc theo `company_id` của công ty đang làm việc (`actor.companyId`); hóa đơn, việc trả hàng của công ty khác trả `404`. Tác vụ nền xử lý theo từng hóa đơn với cài đặt của chính công ty đó.
- Quyền kiểm hai lớp: bộ điều khiển cần `finance.access` hoặc `finance.einvoice.view`; service kiểm quyền chi tiết bằng `requireFinancePermission` (bao trùm công ty; quyền gán ở chi nhánh không dùng được). `finance.einvoice.setup` là quyền nhạy cảm.
- Mật khẩu nhà cung cấp mã hóa AES-256-GCM bằng `common/secret-box`, không bao giờ trả về (chỉ 4 ký tự cuối cho người có quyền cài đặt), không ghi nhật ký thao tác, không lưu trong lần gửi. Mã truy cập MISA chỉ giữ trong bộ nhớ.
- Gọi nhà cung cấp ngoài giao dịch cơ sở dữ liệu, thời gian chờ 30 giây mỗi lần gọi, mỗi lần tải tệp; 20 giây mỗi yêu cầu HTTP tới MISA; giữ chỗ 10 phút, mã tham chiếu duy nhất chống lập trùng.
- Bộ giả lập bị từ chối khi `NODE_ENV=production` (lưu cài đặt báo lỗi); PDF của bộ giả lập ghi "BẢN GIẢ LẬP – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ".
- Địa chỉ MISA đổi được bằng biến môi trường `MISA_EINVOICE_BASE_URL` (dùng cho kiểm thử); không đặt biến này ở môi trường thật.
- Truy vấn dùng tham số của Drizzle (`sql`), không ghép chuỗi SQL; tệp trả `content-disposition` với tên ghép từ ký hiệu, số (giá trị do hệ thống, nhà cung cấp cấp).
- Không thêm thư viện phụ thuộc: `fetch` của Node.js, `pdfmake`, BullMQ đã có.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, gồm sửa lỗi rà soát commit ec4b79b):
- Không có mục rủi ro cao còn mở. Đã kiểm: endpoint kiểm quyền và giới hạn công ty; mật khẩu không lộ qua API, nhật ký, lần gửi; 4 ký tự cuối chỉ cho người có quyền cài đặt; không gửi chồng khi đang gọi nhà cung cấp; chỉ ghi kết quả lần gửi mới nhất, hóa đơn đã phát hành không bị ghi đè.
- Ghi nhận, chưa sửa (rủi ro nghiệp vụ, Cao trước khi bật ở môi trường thật): đường dẫn, tên trường API MISA meInvoice lấy từ nguồn thứ cấp; phải đối chiếu tài liệu chính thức và thử với tài khoản thử MISA trước khi phát hành (đặc tả `cong_viec/CONG_VIEC_16.md` mục 9, 16).
- Ghi nhận, chưa sửa (Trung bình): trường `SendTaxStatus` của MISA chưa được dùng, nên cơ quan thuế từ chối qua MISA chưa nhận ra là "Bị từ chối" (hiện "Chờ cấp mã") đến khi xác nhận giá trị của trường.
- Ghi nhận, chưa sửa (Thấp): tệp PDF, XML tải lỗi khi phát hành không được tự tải lại.
- Ghi nhận, chưa sửa (Thấp): dòng hóa đơn lấy bằng phép nối trong với dòng đơn bán (`documentItems`); dòng phiếu không có dòng đơn nguồn sẽ bị bỏ khỏi hóa đơn.
- Ghi nhận, chưa sửa (Thấp): tác vụ nền hóa đơn chạy một tác vụ một lúc trên hàng đợi riêng `hoa-don-dien-tu`, nên nhà cung cấp chậm làm chậm các hóa đơn khác trong lượt (không còn làm chậm tác vụ nền khác).
- Ghi nhận, chưa sửa (Thấp): ngày làm việc tiếp theo chỉ bỏ thứ Bảy, Chủ nhật, chưa tính ngày nghỉ lễ; hóa đơn có thể bị báo quá hạn sớm hoặc muộn quanh ngày lễ.
- Ghi nhận: bộ giả lập giữ hóa đơn đã nhận trong bộ nhớ tiến trình; khởi động lại API thì tra trạng thái không thấy và phát hành lại với số mới (chỉ ảnh hưởng môi trường không phải môi trường thật).

### Ma trận phân quyền hoa hồng đội kinh doanh MODULE_06 phần 5 (CONG_VIEC_17)

Đã bỏ theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): quyền `finance.commission.*` (gồm `finance.commission.view_own`), loại chứng từ `finance.commission` đã xóa khỏi mọi vai trò (database migration 0061). Nội dung dưới đây giữ để tra cứu.

Quyền mới `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup` (nhạy cảm) (tài liệu `08` mục 21, 22).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_80 Xem cài đặt, chỉ tiêu | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_80 Sửa cài đặt, chỉ tiêu | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_82, CHUC_NANG_83 Xem phát sinh, bảng hoa hồng | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_83 Lập, bỏ bảng nháp, gửi | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_83 Rút bảng chờ duyệt | Của mình | Của mình | Của mình | Của mình | Không | Không | Có (người lập) |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn lọc theo `company_id` của công ty đang làm việc (`actor.companyId`); bảng của công ty khác trả `404`. Ngành hàng dùng chung tập đoàn; kênh, nhân viên trong dữ liệu gửi lên được kiểm thuộc công ty.
- Quyền kiểm hai lớp: bộ điều khiển cần `finance.access` hoặc `finance.commission.view`; service kiểm quyền chi tiết bằng `requireFinancePermission` (bao trùm công ty; quyền gán ở chi nhánh không dùng được). `finance.commission.setup` là quyền nhạy cảm.
- Phát sinh ghi trong cùng giao dịch trừ nợ, ghi sổ phiếu kho; chỉ mục duy nhất chống ghi trùng; lập bảng khóa cài đặt của công ty chống lập trùng; bảng đã ghi sổ không sửa, không xóa; rút chỉ người lập.
- Truy vấn dùng tham số của Drizzle (`sql`, `sql.join`), không ghép chuỗi SQL.
- Không thêm thư viện phụ thuộc.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, gồm sửa lỗi rà soát commit 458d55d):
- Không có mục rủi ro cao còn mở. Đã kiểm: endpoint kiểm quyền và giới hạn công ty; ngành hàng, kênh, nhân viên gửi lên được kiểm ở máy chủ; không ghi trùng phát sinh; hàng trả trừ vào phần chưa thu không được tính hoa hồng; bảng của tháng đã khóa sổ không chặn các tháng sau.
- Ghi nhận: người có `finance.commission.view` (Kế toán có sẵn) thấy hoa hồng, chỉ tiêu của mọi nhân viên trong công ty; nhân viên chưa tự xem được hoa hồng của mình (ngoài phạm vi).
- Ghi nhận, chưa sửa (Trung bình): phiếu chi hoàn tiền được trừ vào khoản giảm nợ cũ nhất còn mở, có thể là khoản trả trước thay vì phiếu nhận hàng trả lại; khi đó không ghi phát sinh âm, hoa hồng của hàng trả không bị trừ.
- Ghi nhận, chưa sửa (Thấp): sửa cài đặt sau khi đã ghi phát sinh không tính lại phát sinh (mức cố định tại lúc ghi).
- Ghi nhận, chưa sửa (Thấp): khoản giảm nợ của số dư đầu kỳ trừ vào phiếu xuất không phát sinh hoa hồng.
- Đã sửa theo quyết định người dùng (2026-11-10): đơn không có khách gán cho người lập đơn; đơn bán cho công ty con trong tập đoàn, đơn đối ứng nội bộ không gán nhân viên hưởng.
- Người dùng quyết định giữ (2026-11-10): phiếu chi hoàn tiền trừ vào khoản có cũ nhất, có thể là tiền trả trước, khi đó hoa hồng của hàng trả không bị trừ lại.
- Ghi nhận: giá trị duyệt là trị tuyệt đối của tổng; bảng âm (hoàn tiền vượt) vẫn qua duyệt theo mức của trị tuyệt đối.
- Ghi nhận: tháng tiếp theo bỏ qua tháng không có phát sinh; tháng đó không có bảng.
- Ghi nhận: chi trả hoa hồng ngoài phạm vi (qua lương ở MODULE_08); bút toán chỉ ghi phải trả người lao động (334).
- Ghi nhận, chưa sửa (Thấp): bộ tính cộng tiền bằng số thực của JavaScript rồi làm tròn theo đơn vị tiền tệ (như công nợ, bảng cân đối số phát sinh).
- Đã sửa (Thấp): chi tiết đơn bán hiện nhân viên hưởng hoa hồng; màn hình phát sinh có ô lọc theo nhân viên.

### Ma trận phân quyền đối soát ngân hàng MODULE_06 phần 6 (CONG_VIEC_18)

Quyền mới `finance.bank.view`, `finance.bank.manage`, `finance.bank.setup` (nhạy cảm) (tài liệu `08` mục 23, 24).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_84 Xem kết nối | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_84 Tạo, sửa kết nối, đổi khóa, gửi thử | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_85, CHUC_NANG_87 Xem giao dịch, đối chiếu | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_86 Lập phiếu thu từ gợi ý, ghép tay, bỏ qua, bỏ ghép | Được | Trong công ty mình | Được | Được | Không | Không | Không |

Điểm nhận webhook công khai (API_98):
- Khóa xác thực: 24 byte sinh bằng `randomBytes` (32 ký tự base64url), riêng cho từng kết nối; lưu mã hóa AES-256-GCM bằng `common/secret-box`; chỉ trả một lần; đổi khóa thì khóa cũ hết hiệu lực ngay.
- So khóa bằng `timingSafeEqual` (thời gian cố định khi cùng độ dài). Kết nối không có, đang tắt, khóa sai đều trả cùng lỗi `401` để không lộ kết nối nào tồn tại; không lưu dữ liệu khi bị từ chối.
- Giới hạn tần suất (quyết định của người dùng ngày 2026-11-10): webhook đúng khóa không bị giới hạn, để công ty nhiều giao dịch không bị trả `429`; chỉ đếm lần sai khóa (kể cả kết nối không có, đang tắt) theo địa chỉ IP, chung cho mọi kết nối, tối đa 20 lần mỗi phút, vượt trả `429` (`RateLimiter`, khóa `bank-webhook-unauthorized`; Redis lỗi thì cho qua). Webhook không đi qua giới hạn chung của `AuthGuard` (`@OwnRateLimit()`).
- Số tài khoản trong webhook khác số tài khoản của quỹ thì từ chối (`409`), chặn dùng khóa của quỹ này để ghi giao dịch tài khoản khác.
- Trùng mã giao dịch trên cùng kết nối không lưu lại (chỉ mục duy nhất), nên dịch vụ gửi lại không tạo giao dịch trùng.
- Bộ giả lập (chọn làm dịch vụ, gửi giao dịch thử) bị chặn khi `NODE_ENV=production` (`bankSimulatorNotAllowed`).

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn của API cần đăng nhập lọc theo `company_id` của công ty đang làm việc; quỹ, giao dịch, phiếu của công ty khác trả `404` hoặc không ghép được. Webhook lấy công ty, quỹ từ kết nối, không từ dữ liệu gửi lên.
- Quyền kiểm hai lớp: bộ điều khiển cần `finance.access`, `finance.bank.view` hoặc `finance.bank.setup`; service kiểm quyền chi tiết bằng `requireFinancePermission`. Lập phiếu thu từ gợi ý kiểm thêm `finance.payment.manage` qua `PaymentsService`.
- Ghép, lưu giao dịch của một quỹ chạy tuần tự: khóa dòng quỹ (`finance.funds ... FOR UPDATE`) trước giao dịch ngân hàng, cùng thứ tự với ghi sổ phiếu thu chi để tránh khóa chết; ghép chỉ cập nhật giao dịch còn chưa ghép; thao tác xử lý khóa dòng giao dịch `FOR UPDATE` và so `version`; hai lần xác nhận lập phiếu thu cùng lúc không lập hai phiếu.
- Truy vấn dùng tham số của Drizzle (`sql`, `sql.join`), không ghép chuỗi SQL; mẫu tìm kiếm thoát `%`, `_`, `\`.
- Không thêm thư viện phụ thuộc.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, gồm sửa lỗi rà soát commit a7af42f, b3ffdd5):
- Không có mục rủi ro cao còn mở. Đã kiểm: khóa không trả lại qua API, không ghi nhật ký; webhook từ chối khóa sai, kết nối tắt, sai số tài khoản; quỹ ngừng dùng không tạo được kết nối mới; dữ liệu gốc lưu đúng thân webhook nhận được (bỏ ký tự rỗng); số tiền ngoài giới hạn bị từ chối `400`; phiếu thu lập từ gợi ý bị sửa không ghép nhầm giao dịch (đã sửa ở b3ffdd5).
- Ghi nhận: cách SePay gửi khóa (`Authorization: Apikey <khóa>`) và định dạng ngày giờ theo tài liệu công khai; phải thử với tài khoản SePay thật trước phát hành.
- Ghi nhận: webhook không có số tài khoản vẫn được nhận (chỉ so khi có).
- Ghi nhận, chưa sửa (Thấp): so độ dài khóa trước khi so nội dung, lộ được độ dài khóa (độ dài cố định 32 ký tự nên không có thông tin thêm).
- Đã sửa (commit 650cd8d): webhook đúng khóa không còn chịu giới hạn 20 yêu cầu mỗi phút chung của API không cần đăng nhập; chỉ lần sai khóa bị đếm.
- Ghi nhận: kẻ dò khóa từ nhiều địa chỉ IP mỗi địa chỉ được 20 lần mỗi phút; khóa 32 ký tự ngẫu nhiên nên dò không khả thi.
- Ghi nhận: thân webhook giới hạn theo mặc định 100 KB của bộ đọc JSON, chưa đặt giới hạn riêng.
- Ghi nhận: người có `finance.bank.view` (Kế toán có sẵn) thấy nội dung chuyển khoản, số dư tài khoản của mọi quỹ ngân hàng trong công ty.

### Ma trận phân quyền đối soát thu hộ MODULE_06 phần 7 (CONG_VIEC_19)

Quyền mới `finance.collection.view`, `finance.collection.manage`, `finance.collection.setup` (nhạy cảm); loại chứng từ `finance.collection_statement` (tài liệu `08` mục 25, 26).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Nhân viên bán hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_88 Xem đơn vị thu hộ | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_88 Thêm, sửa, ngừng dùng đơn vị thu hộ | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_89 Nhập tệp, nhập lại, bỏ dòng, bỏ bảng nháp | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_90 Gửi | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_90 Rút | Bảng mình gửi | Bảng mình gửi | Bảng mình gửi | Bảng mình gửi | Không | Không | Có (người gửi) |
| CHUC_NANG_91 Xem bảng đối soát | Được | Trong công ty mình | Được | Được | Không | Không | Không |

Quyền nhạy cảm: `finance.collection.setup` (khai đơn vị thu hộ quyết định đối tác nào nhận khoản phải thu thay khách; ghi sổ bảng làm giảm nợ khách, tăng nợ đơn vị).

Nhập tệp Excel:
- Giới hạn 5 MB kiểm sau khi nhận (multer cắt ở 10 MB, một tệp); tối đa 5.000 dòng dữ liệu; chỉ đọc giá trị ô, công thức không chạy (ô công thức lấy giá trị đã lưu).
- Ô sai bị từ chối cả tệp, báo lỗi theo dòng, cột; không chèn được dữ liệu ngoài năm cột mẫu.
- Mã vận đơn dạng số từ 16 chữ số bị từ chối (Excel đã làm tròn), tránh ghép nhầm mã.
- Tệp xử lý trong bộ nhớ, không lưu tệp gốc.

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn lọc theo `company_id` của công ty đang làm việc; đơn bán chỉ ghép trong công ty, không ghép đơn đối ứng nội bộ; bảng, đơn vị của công ty khác trả `404` hoặc bị từ chối.
- Quyền kiểm hai lớp: bộ điều khiển cần `finance.access`, `finance.collection.view` hoặc `finance.collection.setup`; service kiểm quyền chi tiết bằng `requireFinancePermission`. Tải tệp mẫu (API_105) chỉ kiểm lớp bộ điều khiển (tệp mẫu không chứa dữ liệu công ty).
- Rút chỉ người gửi lần gần nhất; duyệt theo chính sách duyệt công ty.
- Nhập, gửi, ghi sổ bảng của cùng đơn vị chạy lần lượt (khóa theo đơn vị); ghi sổ khóa bảng (`FOR UPDATE`), khóa công nợ khách và đơn vị theo thứ tự mã; so `version`.
- Truy vấn dùng tham số của Drizzle (`sql`, `sql.join`), không ghép chuỗi SQL.
- Không thêm thư viện phụ thuộc.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, gồm sửa lỗi rà soát độc lập commit 0480edc):
- Đã sửa: phiếu thu, phiếu chi hoàn tiền của đơn vị thu hộ hạch toán 1388; bảng nháp không còn làm bảng khác bị từ chối vì trùng mã; nhập, gửi, ghi sổ đồng thời của cùng đơn vị không còn tạo mã trùng; người gửi (không phải người lập) được rút.
- Ghi nhận: tệp Excel được giải nén toàn bộ trước khi kiểm số dòng; giới hạn 5 MB áp lên tệp nén (rủi ro chung với nhập sản phẩm, CONG_VIEC_19 mục 16).
- Ghi nhận: người có `finance.collection.view` (Kế toán có sẵn) thấy mọi bảng đối soát, số đơn, khách, tiền thu hộ của công ty.

### Ma trận phân quyền báo cáo tài chính hợp nhất MODULE_06 phần 8 (CONG_VIEC_20)

Quyền mới `finance.consolidation.view`, `finance.consolidation.manage` (nhạy cảm), chỉ có hiệu lực khi gán ở phạm vi tập đoàn; loại chứng từ `finance.consolidation` (tài liệu `08` mục 27, 28). "Kế toán trưởng (tập đoàn)": vai trò gán ở phạm vi tập đoàn.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng (tập đoàn) | Kế toán trưởng (công ty) | Kế toán | Nhân viên bán hàng, Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_92 Xem phạm vi hợp nhất | Được | Không | Được | Không | Không | Không | Không |
| CHUC_NANG_93 Xem nhanh cộng gộp, danh sách, chi tiết bảng | Được | Không | Được | Không | Không | Không | Không |
| CHUC_NANG_93 Lập, tính lại, bỏ bảng nháp | Được | Không | Được | Không | Không | Không | Không |
| CHUC_NANG_94 Sửa lãi chưa thực hiện, thêm, xóa điều chỉnh tay | Được | Không | Được | Không | Không | Không | Không |
| CHUC_NANG_95 Gửi | Được | Không | Được | Không | Không | Không | Không |
| CHUC_NANG_95 Rút | Bảng mình gửi | Không | Bảng mình gửi | Không | Không | Không | Có (người gửi) |
| CHUC_NANG_95 Xuất Excel, PDF | Được | Không | Được | Không | Không | Không | Không |

Quyền nhạy cảm: `finance.consolidation.manage` (lập, sửa số báo cáo hợp nhất của cả tập đoàn; điều chỉnh tay làm đổi số báo cáo đã duyệt).

Ranh giới và kiểm soát riêng:
- Quyền chỉ phạm vi tập đoàn: bộ điều khiển kiểm `finance.access`, `finance.consolidation.view` hoặc `finance.consolidation.manage` trong công ty đang làm việc; service kiểm lại quyền hợp nhất bằng `PermissionService.permissionsCovering` với phạm vi `group`, nên vai trò gán ở phạm vi công ty, chi nhánh (kể cả Kế toán trưởng công ty có sẵn hai quyền) không xem được số liệu các công ty khác.
- Số liệu nhiều công ty: người có quyền xem thấy số dư, phát sinh, công nợ và trả trước nội bộ theo đối tác, doanh thu và lãi gộp bán nội bộ, danh sách đối tác (tên) của mọi thành viên, kể cả công ty họ không có vai trò; đây là chủ ý của quyền phạm vi tập đoàn.
- Tách dữ liệu tập đoàn: tập đoàn xác định từ công ty đang làm việc (lên công ty gốc); mọi truy vấn bảng lọc theo `group_company_id`; bảng của tập đoàn khác trả `404`; số liệu chỉ đọc từ thành viên đã chốt ở lần tính lại gần nhất.
- Chỉ đọc sổ các công ty: không ghi vào schema `accounting`, `inventory`, `sales` của thành viên.
- Rút chỉ người gửi lần gần nhất; duyệt theo chính sách duyệt của công ty gốc. Bảng đã chốt lưu số, không tính lại, không sửa.
- Lập, tính lại, sửa, gửi, chốt trong giao dịch cơ sở dữ liệu, khóa bảng (`FOR UPDATE`), so `version`.
- Truy vấn dùng tham số của Drizzle (`sql`, `sql.join`), không ghép chuỗi SQL.
- Không thêm thư viện phụ thuộc.

Ghi nhận khi đối chiếu tài liệu với mã (2026-11-10):
- Nhật ký thao tác lập, tính lại, sửa lãi, điều chỉnh tay, bỏ bảng ghi theo công ty đang làm việc; gửi, rút ghi theo công ty gốc.
- Mục menu "Báo cáo hợp nhất" hiện theo `finance.consolidation.view` ở mọi phạm vi; người chỉ có quyền ở phạm vi công ty thấy mục menu nhưng nhận lỗi không có quyền.

### Ma trận phân quyền gán khách hàng cho nhân viên kinh doanh MODULE_07 phần 2 (CONG_VIEC_21)

Đã tắt theo THAY_DOI_18 (CONG_VIEC_43, 2026-11-11): quyền `crm.customer.view_all`, `crm.customer.assign`, loại chứng từ `crm.customer_assignment` đã xóa (database migration 0062); không còn phân quyền theo dữ liệu (chủ sở hữu) với đối tác, đơn bán, lượt ghé thăm: người có quyền xem đối tác, đơn bán xem mọi dữ liệu của công ty đang chọn. Nội dung dưới đây giữ để tra cứu.

Quyền mới `crm.customer.view_all` (có hiệu lực khi gán ở bất kỳ phạm vi nào trong công ty), `crm.customer.assign` (chỉ có hiệu lực khi gán ở phạm vi công ty hoặc tập đoàn), cả hai không nhạy cảm; loại chứng từ `crm.customer_assignment` (tài liệu `08` mục 29, 30). Theo THAY_DOI_12, vai trò Nhân viên bán hàng không có `crm.customer.view_all` nên thu hẹp phạm vi xem ngay khi phát hành; mọi vai trò hệ thống khác đang xem đối tác hoặc đơn bán, và vai trò tự tạo có `crm.partner.view` hoặc `sales.order.view` (database migration 0021), được thêm quyền để không đổi hành vi. "Trưởng phòng": người đang là trưởng phòng của phòng đang hoạt động, không có `crm.customer.assign`.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Trưởng phòng | Nhân viên bán hàng | Kế toán, Kế toán trưởng, Thủ kho, Nhân viên mua hàng, Quản lý đối tác | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|
| CHUC_NANG_96 Xem đối tác, đơn bán | Mọi khách, mọi đơn | Trong công ty mình | Khách, đơn của nhân viên phòng mình quản lý | Khách mình phụ trách, đơn của khách đó, đơn mình lập, đơn mình hưởng hoa hồng | Mọi khách, mọi đơn (theo quyền có sẵn) | Có (Nhân viên bán hàng, trưởng phòng) |
| CHUC_NANG_96 Lập, sửa, thao tác đơn bán | Được | Trong công ty mình | Đơn trong phạm vi (nếu có quyền bán hàng) | Đơn, khách trong phạm vi | Theo quyền có sẵn | Có |
| CHUC_NANG_97 Lập, sửa, gửi, bỏ phiếu giao khách | Được | Trong công ty mình | Khách, nhân viên phòng mình quản lý | Không | Không | Có (trưởng phòng) |
| CHUC_NANG_97 Xem phiếu giao khách | Mọi phiếu | Trong công ty mình | Phiếu mình lập, mình gửi, giao cho mình | Phiếu giao cho mình | Phiếu giao cho mình | Có |
| CHUC_NANG_97 Rút phiếu | Phiếu mình gửi | Phiếu mình gửi | Phiếu mình gửi | Không | Không | Có (người gửi) |
| CHUC_NANG_98 Xem lịch sử phụ trách | Được | Trong công ty mình | Khách trong phạm vi | Khách trong phạm vi | Được | Có (Nhân viên bán hàng, trưởng phòng) |
| CHUC_NANG_98 Nhận đối tác có sẵn làm khách của mình | Không (đã xem mọi khách) | Không | Nếu không có `crm.customer.view_all` và có `crm.partner.manage` | Được | Không | Có |

Ranh giới và kiểm soát riêng:
- Phân quyền theo dữ liệu (theo chủ sở hữu): điều kiện phạm vi là một biểu thức SQL dùng chung (`ownedCustomer`, `visibleOrder` trong `apps/api/src/crm/customer-scope.ts`) đặt trong câu truy vấn, không lọc sau khi đọc. Áp dụng cho danh sách, chi tiết đối tác, xem số Căn cước công dân, sửa hồ sơ, lịch sử phụ trách; tùy chọn, tra giá, danh sách, chi tiết, lập, sửa, gửi, rút, hủy, đóng đơn bán, xác nhận, từ chối đơn đối ứng. Đối tượng ngoài phạm vi trả `404` (không lộ là có tồn tại) (KICHBAN_KIEMTHU_278, KICHBAN_KIEMTHU_280, KICHBAN_KIEMTHU_283).
- Danh sách nhân viên của phạm vi tính lại mỗi yêu cầu từ `core.departments` (trưởng phòng, phòng con các cấp, chỉ phòng đang hoạt động) và `core.user_company_memberships` (thành viên đang hoạt động); đổi trưởng phòng, chuyển phòng có hiệu lực ngay.
- Tra giá với khách ngoài phạm vi không dùng nhóm khách của khách đó (không suy ra được nhóm khách); sửa đơn chỉ giữ được khách đang có trên chính đơn đó.
- Kiểm trùng mã số thuế, số Căn cước công dân vẫn tìm toàn danh mục, chỉ trả mã, tên (như CONG_VIEC_06) và `canClaim`; nhân viên biết đối tác có tồn tại nhưng không xem được chi tiết khi ngoài phạm vi. Nhận đối tác chỉ lập hồ sơ khi công ty chưa có hồ sơ; đối tác đã có hồ sơ do người khác phụ trách không tự nhận được.
- Hồ sơ tự lập khi nhân viên thêm, nhận đối tác có hạn mức công nợ 0, thanh toán ngay: bán nợ đi qua duyệt ngoại lệ hạn mức (QUYTAC_NGHIEPVU_68, QUYTAC_NGHIEPVU_92).
- Dữ liệu nhạy cảm: phiếu giao khách hiện tên khách, nhân viên phụ trách hiện tại, lúc gửi cho người lập, người gửi, nhân viên nhận; lịch sử phụ trách hiện tên nhân viên đã phụ trách. Không thêm dữ liệu cá nhân của khách; số Căn cước công dân vẫn theo QUYTAC_NGHIEPVU_59 trong phạm vi.
- Khóa đồng thời: gửi, áp dụng phiếu khóa phiếu (`FOR UPDATE`) rồi khóa hồ sơ các khách theo thứ tự `partner_id` (tránh khóa chéo giữa hai phiếu cùng khách); áp dụng so nhân viên phụ trách lúc gửi, khác thì không áp dụng; nhận đối tác dùng `ON CONFLICT DO NOTHING` trên khóa `(company_id, partner_id)` của hồ sơ; chỉ mục duy nhất có điều kiện bảo đảm mỗi khách tại mỗi công ty một dòng lịch sử đang mở. Sửa, gửi, bỏ phiếu so `version`.
- Đổi nhân viên phụ trách đã có chỉ qua phiếu giao khách (có duyệt nếu công ty đặt chính sách), không sửa trực tiếp trên hồ sơ (QUYTAC_NGHIEPVU_134).
- Nhật ký thao tác: `customer_assignment.create`, `update`, `discard`, `submit`, `withdraw`; `partner_profile.claim`; hồ sơ tự lập khi thêm đối tác nằm trong nhật ký `partner.create`. Áp dụng phiếu ghi lịch sử phụ trách, gửi thông báo trong ứng dụng.
- Truy vấn dùng tham số của Drizzle (`sql`, `sql.join`); tên cột đơn bán trong `visibleOrder` ghép bằng `sql.raw` từ bí danh bảng cố định trong mã, không từ dữ liệu người dùng.
- Không thêm thư viện phụ thuộc.

Ghi nhận khi đối chiếu tài liệu với mã (2026-11-10):
- Mục menu "Giao khách hàng" hiện theo `crm.partner.view`; người không phải trưởng phòng, không có quyền giao khách thấy danh sách phiếu giao cho mình, không thấy nút lập phiếu.
- Kiểm thử đã duyệt của CONG_VIEC_08, CONG_VIEC_12 đến CONG_VIEC_17, CONG_VIEC_19 thêm bước chuẩn bị `salespersonSeesAllCustomers` cho vai trò Nhân viên bán hàng quyền xem mọi khách (người dùng cho phép ngày 2026-11-10); chỉ trong cơ sở dữ liệu thử.

### Ma trận phân quyền tài khoản người mua MODULE_09 phần lõi 1 (CONG_VIEC_23)

Quyền mới `marketplace.buyer.view`, `marketplace.buyer.manage` (nhạy cảm) xét tại công ty vận hành sàn (tài liệu `08` mục 31, 32).

| Chức năng | Quản trị tập đoàn | Quản trị công ty vận hành sàn | Quản trị công ty khác | Nhân viên kinh doanh | Người mua | Chưa đăng nhập |
|---|---|---|---|---|---|---|
| CHUC_NANG_104, CHUC_NANG_105 Đăng ký, đăng nhập, quên mật khẩu | Được | Được | Được | Được | Được | Được (giới hạn số lần gọi) |
| CHUC_NANG_106 Tài khoản, người tôi giới thiệu (số che), nhập mã một lần | Được | Được | Được | Được | Được | Không |
| CHUC_NANG_108 Khách tôi phụ trách | Không | Không | Không | Được | Không | Không |
| CHUC_NANG_107 Chọn công ty vận hành sàn | Được | Không | Không | Không | Không | Không |
| CHUC_NANG_107, CHUC_NANG_108 Xem, đổi người giới thiệu, đánh dấu | Được | Được (còn là thành viên) | Không | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Điểm tiếp nhận công khai mới: `/buyer/register/otp`, `/buyer/register`, `/buyer/login`, `/buyer/login/otp`, `/buyer/login/otp/verify`, `/buyer/password-reset/otp`, `/buyer/password-reset`. Giới hạn theo địa chỉ IP; nhóm "login" (`/auth/login`, `/auth/app/login`, `/buyer/login`) và nhóm "otp-verify" (`/auth/otp/verify`, `/buyer/login/otp/verify`, `/buyer/register`, `/buyer/password-reset`) dùng chung bộ đếm.
- OTP: lưu bản băm SHA-256, tách mục đích, 5 lần gửi mỗi giờ mỗi số (mọi mục đích), 300 mã đăng ký mỗi giờ toàn hệ thống, mỗi lượt thử giữ trước bằng lệnh nguyên tử (đoán song song không vượt 5 lượt), dùng mã nguyên tử.
- Phiên: `vcomm_app` 90 ngày, xoay vòng; làm mới cùng token hai lần thì thu hồi chuỗi; phiên chưa nhập mã xác thực hai lớp không làm mới được; phiên web không làm mới qua đường dẫn ứng dụng.
- Người mua không thuộc công ty nên không qua được kiểm tra công ty của các API quản trị (`403`).
- Đánh dấu nhân viên kinh doanh không gán vai trò (THAY_DOI_15), ghi lại thành viên do mình tạo và phòng ban cũ; bỏ đánh dấu không gỡ vai trò, phòng ban do nhân sự gán.
- Khóa cặp tài khoản theo thứ tự khi gắn người giới thiệu (chống vòng do thao tác đồng thời); khóa dòng tài khoản người mua và kiểm phiên bản khi quản trị thao tác.
- Số điện thoại hiện cho người giới thiệu luôn che; số đầy đủ chỉ cho nhân viên kinh doanh (khách mình phụ trách) và quản trị.
- Nhật ký thao tác: `buyer.register`, `buyer.referrer.self`, `buyer.referrer.change`, `buyer.sales.flag`, `buyer.sales.unflag`, `marketplace.operator.set`, `password.reset`.
- Truy vấn dùng tham số của Drizzle; ô tìm kiếm thoát ký tự `%`, `_`. Không thêm thư viện phụ thuộc (ứng dụng bỏ `expo-location`, `expo-image-picker`).

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, rà soát độc lập; sửa ở commit 70b9c29):
- Đã sửa (Cao): làm mới phiên chưa nhập mã xác thực hai lớp để đếm lại số lần nhập sai mã.
- Đã sửa (Cao): bỏ đánh dấu gỡ cả vai trò, phòng ban do nhân sự gán, có thể ngừng thành viên của nhân viên có sẵn.
- Đã sửa (Trung bình): đoán mã OTP song song vượt 5 lượt; bơm SMS đăng ký tới số chưa có tài khoản (thêm giới hạn toàn hệ thống); lỗi 500 khi đánh dấu người có công ty mặc định đã ngừng; ứng dụng không hiện lỗi của ô không hiển thị.
- Đã sửa (Thấp): vòng giới thiệu do thao tác đồng thời; quản trị không còn là thành viên vẫn thao tác được; đặt lại mật khẩu bằng OTP cho tài khoản nhân viên có thư điện tử; đường dẫn xác minh mã chưa dùng chung bộ đếm; khách tự đặt lại người giới thiệu sau khi quản trị bỏ; ô tìm kiếm chưa thoát ký tự; chọn công ty vận hành sàn đồng thời trả lỗi 500; ứng dụng làm mới token ở đường dẫn đăng nhập, về đăng nhập khi khởi động lỗi tạm thời.
- Ghi nhận, chưa sửa (Thấp): đăng ký kiểm mã giới thiệu trước mã OTP nên phân biệt được số có tài khoản đang hoạt động; `register/otp` vốn báo số đã có tài khoản theo QUYTAC_NGHIEPVU_141.
- Ghi nhận, chưa sửa (Thấp): tin SMS mã đặt lại mật khẩu, mã đăng ký dùng chung mẫu tin mã đăng nhập của eSMS.
- Đã xử lý theo quyết định của người dùng (THAY_DOI_15): đánh dấu không còn gán vai trò Nhân viên bán hàng (quyền ghi đơn bán, đối tác B2B).
- Ghi nhận (Thấp): mục menu "Người mua VComm" theo quyền ở công ty đang chọn; người đang chọn công ty khác công ty vận hành sàn không thấy mục.
- Quét thư viện phụ thuộc: 2 lỗ hổng mức Trung bình trong `@expo/cli` (công cụ phát triển, không chạy trên môi trường thật), người dùng chấp nhận rủi ro có thời hạn (mục 8). Quét khóa bí mật: các dòng thêm mới không có khóa bí mật; gitleaks trong CI chưa chạy được do tài khoản GitHub lỗi thanh toán.

### Ma trận phân quyền đội kinh doanh MODULE_09 phần lõi 1b (CONG_VIEC_27)

| Chức năng | Quản trị công ty vận hành sàn, Quản trị tập đoàn | Giám đốc Kinh doanh, Giám đốc Vùng, Trưởng phòng | Nhân viên kinh doanh | Người mua |
|---|---|---|---|---|
| CHUC_NANG_109, CHUC_NANG_110 Xem, thay đổi đội trên web | Có (`marketplace.buyer.view`, `marketplace.buyer.manage`) | Không | Không | Không |
| CHUC_NANG_111 Xem cấp dưới, khách của cấp dưới | Không áp dụng | Trong nhánh mình quản lý | Không | Không |
| CHUC_NANG_112 Lập, rút đề xuất | Không áp dụng | Trong nhánh mình quản lý | Không | Không |
| CHUC_NANG_112 Duyệt, từ chối đề xuất | Có (`marketplace.buyer.manage`) | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Phạm vi theo nhánh tính lại mỗi yêu cầu từ cây phòng ban và người quản lý (chỉ người quản lý thuộc chính đơn vị); khách của người ngoài nhánh, của chính mình, của cấp trên trả `404`.
- Đề xuất chỉ nhắm cấp dưới trong nhánh, đơn vị trong cây con; không tự bổ nhiệm, không bổ nhiệm vào đơn vị mình đang quản lý. Duyệt kiểm lại trong cùng giao dịch dưới khóa đội và khóa dòng đề xuất.
- Chống dò thông tin: đề xuất thêm người dùng một thông báo cho không có tài khoản và đã trong đội; đề xuất chưa duyệt chỉ hiện tên, số điện thoại đã che cho người đề xuất; tối đa 20 đề xuất mỗi ngày mỗi người.
- Khóa: thay đổi đội lấy khóa tư vấn theo công ty trước, rồi mới khóa dòng (tránh khóa chết). Cây phòng ban có vòng không làm treo máy chủ.
- Nhật ký thao tác: `sales_unit.type`, `sales_unit.manager`, `buyer.sales.move`, `buyer.sales.flag`, `buyer.sales.unflag`; lịch sử đội có mã đề xuất.

Kết quả rà soát bảo mật phần thay đổi (2026-11-10, rà soát độc lập; sửa ở commit 09086c5):
- Đã sửa (Cao): đánh dấu lại người đã trong đội làm treo quản lý, mất phòng ban nhân sự; thứ tự khóa ngược gây khóa chết.
- Đã sửa (Trung bình): chuỗi cấp trên nhận người quản lý do mini app Nền tảng đặt mà không thuộc đơn vị; phòng ban ngừng hoạt động cắt cây; vòng lặp cây phòng ban; lịch sử thiếu nhãn, thiếu đề xuất; dò họ tên qua đề xuất thêm người; bổ nhiệm bị chặn vì quản lý phòng ban không phải đơn vị kinh doanh.
- Ghi nhận, chưa sửa (Thấp): mini app Nền tảng đổi cha, người quản lý phòng ban không lấy khóa đội, không kiểm thứ bậc Khối > Vùng > Phòng (không sửa mini app Nền tảng theo mục 13 đặc tả); đề xuất chờ của người bị bỏ đánh dấu không tự hủy (duyệt báo không còn đúng); lỗi trên MAN_HINH_81 hiện ở đầu trang.

### Ma trận phân quyền đặt hàng trên VComm MODULE_09 phần lõi 2 (CONG_VIEC_24)

| Chức năng | Quản trị công ty vận hành sàn, Quản trị tập đoàn | Nhân viên có `marketplace.order.view` | Người mua | Người mua thử |
|---|---|---|---|---|
| CHUC_NANG_113 Xem cài đặt, đăng bán | Có | Có | Không | Không |
| CHUC_NANG_113 Lưu cài đặt, bật tắt đơn vị vận chuyển, đăng bán, người mua thử | Có (`marketplace.order.manage`) | Không | Không | Không |
| CHUC_NANG_114, CHUC_NANG_115 Cửa hàng, giỏ hàng, sổ địa chỉ | Có (với tài khoản người mua của mình) | Có (như trên) | Của mình | Của mình |
| CHUC_NANG_116 Xem trước đơn | Có | Có | Có | Có |
| CHUC_NANG_116 Đặt hàng | Chỉ khi là người mua thử | Chỉ khi là người mua thử | Không (chưa mở đặt hàng) | Có |
| CHUC_NANG_116 Xem, hủy đơn của mình; CHUC_NANG_118 gửi, rút yêu cầu trả hàng | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_116, CHUC_NANG_117 Xem đơn VComm, yêu cầu trả hàng | Có | Có | Không | Không |
| CHUC_NANG_116 đến CHUC_NANG_118 Giao cho đơn vị vận chuyển, tra lại vận đơn, hủy đơn, duyệt, từ chối, nhận hàng trả | Có (`marketplace.order.manage`; giao đơn cần thêm `inventory.sales.issue` tại kho xuất) | Không | Không | Không |

Ranh giới và kiểm soát riêng:
- Đơn, địa chỉ, giỏ, yêu cầu trả hàng, ảnh của người khác trả `404` (không lộ là có tồn tại). Quản trị chỉ xem đơn của công ty vận hành sàn.
- Giá, khuyến mãi, phí luôn tính lại ở máy chủ khi đặt; tổng người mua gửi chỉ dùng để phát hiện giá đổi.
- Chứng từ kho của đơn VComm do hệ thống ghi sổ (lấy hàng, hoàn hàng, nhận hàng trả) không xét quyền kho của người dùng; người ghi là người đã giao đơn hoặc người bấm nhận hàng trả; nhật ký thao tác ghi đủ.
- Webhook không tin nội dung: trạng thái lấy từ tra lại vận đơn bằng token của VComm; nhận trùng không đổi kết quả vì mỗi chuyển trạng thái kiểm trạng thái hiện tại trong giao dịch có khóa dòng.
- Ảnh trả hàng kiểm theo nội dung tệp (chữ ký JPEG, PNG), không theo tên, tối đa 5 MB, tối đa 20 ảnh chưa gửi mỗi người mua mỗi ngày; ảnh phục vụ với `x-content-type-options: nosniff`.
- Token GHN ở biến môi trường; khóa webhook ít nhất 24 ký tự, gắn vào đường dẫn khai báo với GHN.

### Ma trận phân quyền thanh toán đơn người mua MODULE_09 phần lõi 3 (CONG_VIEC_25)

| Chức năng | Quản trị công ty vận hành sàn, Quản trị tập đoàn | Kế toán, Kế toán trưởng | Nhân viên có `marketplace.order.view` | Người mua |
|---|---|---|---|---|
| CHUC_NANG_120 Bật tắt phương thức, mở đặt hàng | Có (`marketplace.order.manage`) | Không | Không | Không |
| CHUC_NANG_120, CHUC_NANG_121 Chọn phương thức, thanh toán, hủy đơn Chờ thanh toán | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_122 Nhập tài khoản nhận hoàn tiền | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_121, CHUC_NANG_122 Xem trạng thái thanh toán, lần thanh toán của đơn | Có | Có | Có | Đơn của mình |
| CHUC_NANG_122 Xem việc hoàn tiền kèm tài khoản người mua, ghi đã hoàn | Có (`marketplace.payment.manage`) | Có | Không | Không |
| CHUC_NANG_124 Ghi tay đã thu tiền thu hộ | Có (`marketplace.payment.manage`) | Có | Không | Không |

Ranh giới và kiểm soát riêng:
- Đơn, tài khoản nhận hoàn tiền của người khác trả `404`; việc hoàn tiền của công ty khác trả `404`.
- Tiền chỉ ghi nhận qua IPN có chữ ký đúng hoặc API chi tiết đơn của đơn vị vận chuyển, hoặc người có `marketplace.payment.manage` ghi tay (có nhật ký kiểm tra); trang trả về không ghi nhận tiền.
- Khóa bí mật VNPAY chỉ ở biến môi trường, không ghi vào nhật ký, không trả qua API.
- Ghi đã hoàn, ghi đã thu theo phiên bản, ngày không sau hôm nay; ghi nhật ký kiểm tra `marketplace.refund.complete`, `marketplace.order.cod_collected`.

### Ma trận phân quyền hoa hồng, ví, rút tiền MODULE_09 phần lõi 4 (CONG_VIEC_26)

| Chức năng | Quản trị công ty vận hành sàn, Quản trị tập đoàn | Kế toán, Kế toán trưởng | Nhân viên có `marketplace.order.view` | Người dùng ứng dụng VComm |
|---|---|---|---|---|
| CHUC_NANG_134 Thiết lập hoa hồng sản phẩm, cài đặt hoa hồng chung, bảng phí | Có (`marketplace.order.manage`) | Xem | Xem | Không |
| CHUC_NANG_135 Xem hoa hồng của đơn | Có | Có | Có | Không |
| CHUC_NANG_136 Xem ví, lịch sử | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_136 Xem tổng hoa hồng của cấp dưới | Theo đội kinh doanh | Theo đội kinh doanh | Theo đội kinh doanh | Người quản lý: cấp dưới trong nhánh |
| CHUC_NANG_137 Gửi, rút lại yêu cầu rút tiền | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_137 Danh sách, duyệt, từ chối, ghi đã chi, bảng kê thuế | Có (`marketplace.payment.manage`), trừ yêu cầu của chính mình | Có, trừ yêu cầu của chính mình | Không | Không |

Ranh giới và kiểm soát riêng:
- Ví, yêu cầu rút tiền lấy theo người đăng nhập; yêu cầu của người khác trả `404`; yêu cầu của công ty khác trả `404`.
- Không duyệt, từ chối, ghi đã chi yêu cầu rút tiền của chính mình (`409` `withdrawalSelfDecision`), tách người hưởng và người chi.
- Số dư chỉ đổi qua giao dịch ví trong giao dịch cơ sở dữ liệu có khóa dòng ví (`FOR UPDATE`, cập nhật số dư cùng câu lệnh); số dư không âm (ràng buộc); yêu cầu rút khóa dòng yêu cầu trước khi đổi trạng thái; một yêu cầu đang chờ mỗi người (chỉ mục duy nhất); một giao dịch hoa hồng mỗi đơn mỗi người (chỉ mục duy nhất), hoàn tất chạy lại không cộng thêm.
- Giao dịch ví không có API sửa, xóa; hoàn lại số dư ghi giao dịch mới `withdrawal_reversal`.
- Thuế, phí, thực nhận chốt khi duyệt, ràng buộc thực nhận + thuế + phí = số tiền; ngày chi không sau hôm nay, không trước ngày duyệt; mọi thao tác quản trị theo phiên bản, ghi nhật ký kiểm tra `marketplace.product_commission.update`, `marketplace.commission_settings.update`, `marketplace.withdrawal.approve`, `.reject`, `.pay`.

### Ma trận phân quyền sửa theo mô hình B2C (THAY_DOI_18, CONG_VIEC_43)

Không thêm quyền. Quyền đã xóa: `finance.commission.view`, `finance.commission.manage`, `finance.commission.setup`, `finance.commission.view_own`, `crm.customer.view_all`, `crm.customer.assign`. Loại chứng từ đã xóa: `finance.commission`, `crm.customer_assignment`. Đổi vai trò hệ thống ở tài liệu `08` mục 39.

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán, Kế toán trưởng | Nhân viên bán hàng | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_54 Xem đơn bán, đối tác | Được | Trong công ty mình | Được (toàn công ty) | Được (toàn công ty) | Không |
| CHUC_NANG_54 Lập, sửa, gửi, hủy, đóng đơn bán; xác nhận đơn đối ứng | Được | Trong công ty mình | Được | Không (`403`) | Không |
| CHUC_NANG_55 Bật "Cho phép lập đơn bán tay có hàng hóa" | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_157 Phiếu xuất, phiếu nhập dịch vụ | Hệ thống tự lập trong giao dịch xác nhận đơn | – | – | – | – |
| Lọc nhân viên ở Ghé thăm (`GET /crm/visit-options`) | Được | Trong công ty mình | Theo `crm.access` hoặc `crm.partner.view` | Được | Không |

Điểm tiếp nhận dữ liệu bổ sung:
- API_56 trường `kind` (`goods`, `service`; lược đồ zod `enum`); API_78 trường `allowManualGoodsOrders` (`boolean`, tùy chọn); trường thừa vẫn bị từ chối.
- `GET /crm/visit-options` không nhận tham số; chỉ trả mã, họ tên nhân viên đang làm việc của công ty đang chọn.

Ranh giới và kiểm soát riêng:
- Mở rộng phạm vi xem: Nhân viên bán hàng thấy mọi đối tác, đơn bán, lượt ghé thăm của công ty (người dùng quyết định theo THAY_DOI_18); dữ liệu công ty khác vẫn tách theo `X-Company-Id`.
- Ràng buộc cơ sở dữ liệu chặn dịch vụ theo dõi lô, serial; phiếu dịch vụ chỉ là phiếu xuất giao hàng, phiếu nhập mua; thẻ kho, giữ hàng từ chối mặt hàng dịch vụ ở tầng service (chốt chặn cuối).
- Phiếu dịch vụ không lập tay qua API; chỉ lập trong giao dịch xác nhận đơn, kiểm kỳ khóa sổ.
- Cài đặt "Cho phép lập đơn bán tay có hàng hóa" là công tắc nghiệp vụ, cần `sales.settings.manage`, ghi nhật ký `sales_settings.update`.

### Ma trận phân quyền bán lẻ tại quầy MODULE_14 phần 1 (CONG_VIEC_53)

Quyền mới: `retail.access`, `retail.sale`, `retail.return`, `retail.shift.manage`, `retail.setup` (không quyền nào nhạy cảm); vai trò mới Thu ngân, Cửa hàng trưởng (tài liệu `08` mục 40, 41).

| Chức năng | Quản trị tập đoàn, Quản trị công ty | Cửa hàng trưởng | Thu ngân | Kế toán, Kế toán trưởng | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_186 Cài đặt cửa hàng, quầy | Được (`retail.setup` phạm vi công ty, tập đoàn) | Không (`403`) | Không (`403`) | Không | Không |
| CHUC_NANG_186 Mở ca, đóng ca | Được | Tại chi nhánh được gán | Tại chi nhánh được gán | Đóng ca (`retail.shift.manage`) | Thu ngân: chỉ ca của mình |
| CHUC_NANG_186 Xem mọi ca, đóng ca người khác | Được | Tại chi nhánh được gán | Không | Được | Không |
| CHUC_NANG_187 Tìm hàng, tính giỏ, thanh toán | Được, trong ca của mình | Trong ca của mình | Trong ca của mình | Không | Ca của người khác trả `404` |
| CHUC_NANG_187 Xem hóa đơn bán lẻ | Được | Tại chi nhánh được gán | Tại chi nhánh được gán | Được | Không |
| CHUC_NANG_188 Trả hàng | Được, trong ca của mình | Tại chi nhánh được gán, trong ca của mình | Không (`403`) | Không | Không |
| CHUC_NANG_189 Khai ký hiệu máy tính tiền | `finance.einvoice.setup` | Không | Không | Kế toán trưởng (`finance.einvoice.setup`) | Không |
| CHUC_NANG_189 Điểm tại quầy | Chưa làm, chờ CONG_VIEC_51 | – | – | – | – |

Điểm tiếp nhận dữ liệu bổ sung:
- API_192 đến API_197 (tài liệu `17` mục 2q, 3w): lược đồ zod trong `packages/contracts`, trường thừa bị từ chối; tiền là chuỗi số thập phân tối đa 4 chữ số lẻ; số lượng dòng giỏ, dòng trả tối đa 200, dòng thanh toán tối đa 5, serial tối đa 1.000 mỗi dòng; chuỗi tìm hàng tối đa 100 ký tự; mã quầy, mã ngân hàng VietQR, tên chủ tài khoản, mã số thuế, số định danh cá nhân kiểm theo biểu thức chính quy ở lược đồ và ràng buộc cơ sở dữ liệu.
- API_92 trường `cashRegisterSeries` (tối đa 20 dòng, ký hiệu khớp `^[CK][0-9]{2}M[A-Z]{2}$`).

Dữ liệu nhạy cảm:
- Thông tin người mua lấy hóa đơn (tên, mã số thuế, địa chỉ, số định danh cá nhân) chỉ ghi khi khách yêu cầu, lưu trên đơn bán bán lẻ, chỉ người xem được hóa đơn bán lẻ trong phạm vi thấy; số định danh cá nhân là dữ liệu cá nhân, không ghi vào nhật ký ứng dụng.
- Không lưu dữ liệu thẻ: quầy không nhận thanh toán thẻ, ví điện tử, cổng thanh toán (ngoài phạm vi CONG_VIEC_53). Chuyển khoản chỉ lưu số tiền, quỹ nhận, mã giao dịch ngân hàng do thu ngân nhập (tối đa 50 ký tự); hoàn chuyển khoản lưu chuỗi người nhận (ngân hàng, số tài khoản, tên; tối đa 300 ký tự).
- Mã VietQR chỉ là chuỗi thanh toán theo chuẩn EMVCo của NAPAS tạo ở máy khách từ số tài khoản của quỹ chuyển khoản, mã ngân hàng, số tiền, nội dung là số hóa đơn; không chứa khóa bí mật, không gọi dịch vụ ngân hàng; tiền chỉ ghi nhận khi thu ngân xác nhận đã nhận (đối soát sao kê qua CONG_VIEC_18).

Ranh giới và kiểm soát riêng:
- Phạm vi theo chi nhánh của cửa hàng: quyền gán ở chi nhánh chỉ có hiệu lực tại cửa hàng của chi nhánh đó; điều kiện phạm vi nằm trong truy vấn (`scopeCondition`); cửa hàng, ca, hóa đơn, phiếu trả ngoài phạm vi hoặc của công ty khác trả `404`; quyền cài đặt chỉ xét ở phạm vi công ty, tập đoàn.
- Bán, trả hàng chỉ trong ca đang mở của chính người gọi; ca bị khóa dòng `FOR UPDATE` trong giao dịch; kiểm lại quyền tại cửa hàng mỗi lần ghi.
- Khóa yêu cầu chống ghi trùng: mỗi lần thanh toán, trả hàng mang `clientKey` (UUID do máy tạo), duy nhất theo quầy (ràng buộc cơ sở dữ liệu); gửi lại cùng khóa trả chứng từ đã ghi của chính người gửi, không ghi lần hai.
- Máy chủ là nguồn đúng cho giá, khuyến mãi, tổng tiền, tiền hoàn; máy khách gửi tổng đã thấy (`expectedTotal`, `expectedRefund`), khác thì từ chối, không ghi.
- Chứng từ quỹ khi đóng ca ghi sổ ngay, không qua luồng duyệt, không có API lập, sửa, xóa; tiền thiếu ghi đích danh người mở ca (1388); tiền đầu ca, tiền đếm được, lệch, lý do ghi trên ca và nhật ký kiểm tra; ca đã đóng không sửa, không mở lại.
- Hóa đơn bán lẻ, phiếu trả hàng bán lẻ không sửa, không hủy; hoàn tiền mặt không vượt tiền mặt hệ thống tính của ca.
- Nhật ký kiểm tra: `retail_store.create`, `.update`, `retail_register.create`, `.update`, `retail_shift.open`, `.close`, `retail_sale.create`, `retail_return.create`.
### Ma trận phân quyền Nhân sự MODULE_08 phần 1 (CONG_VIEC_46)

Thêm quyền `hr.employee.view`, `hr.employee.manage`, `hr.identity.view`, `hr.contract.manage` (nhạy cảm, chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty), vai trò Quản lý nhân sự, Nhân viên nhân sự (tài liệu `08` mục 42).

| Chức năng | Quản trị tập đoàn, công ty | Quản lý nhân sự | Nhân viên nhân sự | Người chỉ có `hr.employee.view` | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_162 Xem hồ sơ đang làm (số che) | Được | Được | Được | Được | Có (hồ sơ liên kết, API_149) |
| CHUC_NANG_162 Xem hồ sơ đã nghỉ | Được | Được | Được | Không (`404`) | Không |
| CHUC_NANG_162 Hiện số giấy tờ, tải tệp giấy tờ | Được | Được | Không | Không | Có (số của mình) |
| CHUC_NANG_162 Lập, sửa hồ sơ, giấy tờ, người phụ thuộc, quá trình công tác, nghỉ việc | Được | Được | Được | Không | Không |
| CHUC_NANG_163 Hợp đồng, phụ lục; xem lương | Được | Được | Được | Xem không có lương | Có (hợp đồng đã ký của mình) |
| CHUC_NANG_163 Tải bản hợp đồng đã ký | Được | Được | Không | Không | Có |
| CHUC_NANG_164 Nhận nhắc hết hạn | Được | Được | Được | Không | Trưởng phòng trên hợp đồng nhận thông báo |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn lọc `company_id` của công ty đang chọn; hồ sơ thuộc công ty ký hợp đồng; công ty khác nhận `404`.
- Quyền nhân sự kiểm bằng `requireHrPermission` (bao trùm công ty): gán ở chi nhánh không mở được dữ liệu nhân sự.
- Dữ liệu cá nhân (Luật 91/2025/QH15; Nghị định 356/2025/NĐ-CP Điều 3, 4): số căn cước, hộ chiếu, tài khoản ngân hàng, mã số thuế, số sổ bảo hiểm xã hội, giấy phép lao động, số định danh người phụ thuộc mã hóa AES-256-GCM; nhật ký thao tác chỉ ghi dạng che; hiện, tải ghi nhật ký `employee.reveal`, `employee.reveal_own`, `employee.document.download`, `contract.download`, `contract.download_own`.
- Tệp giấy tờ, bản đã ký: khóa lưu trữ do hệ thống sinh, kiểm phần mở rộng và chữ ký đầu tệp, tối đa 10 MB, tải xuống `no-store`, `nosniff`; S3 mã hóa khi lưu (SSE).
- Không lưu chi tiết tình trạng sức khỏe; chỉ lưu tệp giấy khám sức khỏe (nhạy cảm). Ghi nhận văn bản đồng ý xử lý dữ liệu nhạy cảm; thiếu thì cảnh báo.
- Mức lương chỉ trả cho người có `hr.contract.manage` hoặc chính người lao động.
- Khóa đồng thời: lập, sửa hồ sơ khóa theo công ty (`pg_advisory_xact_lock`) để không trùng số giấy tờ, mã; gửi, ký hợp đồng khóa hồ sơ để kiểm chồng thời gian, giới hạn ký.

### Ma trận phân quyền Nhân sự MODULE_08 phần 2 (CONG_VIEC_47)

Thêm quyền `hr.attendance.view`, `hr.attendance.manage`, `hr.leave.manage`, `hr.timesheet.manage` (ba quyền sau nhạy cảm); vai trò Quản lý nhân sự, Nhân viên nhân sự có cả bốn (tài liệu `08` mục 43).

| Chức năng | Quản trị, nhân sự có quyền | Chỉ `hr.attendance.view` | Trưởng phòng | Chính mình |
|---|---|---|---|---|
| CHUC_NANG_165 Xem lưới công, lượt chấm (cách xác thực, khoảng cách; không trả tọa độ) | Được | Được | Phòng mình | Lượt của mình |
| CHUC_NANG_165 Ca, lịch, ngày lễ, địa điểm, nhập tệp, ghi thủ công, màn hình mã QR | `hr.attendance.manage` | Không | Xếp ca phòng mình | Không |
| CHUC_NANG_166 Ghi nhận nghỉ, sổ phép, loại nghỉ | `hr.leave.manage` | Xem | Xem, duyệt theo chính sách | Đơn, sổ phép của mình |
| CHUC_NANG_167 Phiếu tăng ca | Lập, kèm văn bản, hủy | Xem | Lập phòng mình | Lập, đồng ý, rút, hủy |
| CHUC_NANG_167 Bảng công: mở xác nhận, trả lời, chốt, mở lại | `hr.timesheet.manage` | Xem, xuất Excel | Xem phòng mình | Xác nhận, giải trình dòng của mình |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: mọi truy vấn lọc `company_id` của công ty đang chọn; hồ sơ, lượt, đơn công ty khác trả `404` hoặc không có trong danh sách.
- Mã QR động: HMAC-SHA256 trên mã địa điểm và khung 30 giây, khóa dẫn xuất từ `MFA_SECRET_KEY`; nhận khung hiện tại và liền trước; mã không chứa dữ liệu người dùng. Màn hình mã chỉ người có `hr.attendance.manage` mở.
- Lượt chấm ứng dụng chỉ cho chính người có hồ sơ liên kết; hai lượt cách nhau ít nhất 1 phút; địa chỉ IP lấy từ kết nối qua proxy tin cậy của ứng dụng.
- Giả vị trí GPS trên điện thoại không phát hiện được (ngoài phạm vi): công ty nên bật thêm mạng công ty hoặc mã QR cho địa điểm cần chặt; lượt lưu cách xác thực và độ chính xác để đối chiếu.
- Thông báo xin quyền vị trí hiện trước khi trình duyệt hỏi; không lấy vị trí khi chấm bằng mã QR hoặc mạng công ty.
- Khóa đồng thời: gửi đơn nghỉ, phiếu tăng ca khóa hồ sơ (`FOR UPDATE`); chốt kỳ khóa dòng kỳ; mọi ghi dữ liệu thuộc tháng kiểm kỳ đã chốt trong cùng giao dịch.
### Ma trận phân quyền ứng dụng kho (CONG_VIEC_44)

Quyền mới `inventory.stocktake.count` "Đếm kiểm kê" (công ty, chi nhánh; không nhạy cảm): Thủ kho (`warehouse_keeper`); Quản lý kho và quản trị có qua danh sách `inventory.*`.

| Chức năng | Quản trị tập đoàn, quản trị công ty | Quản lý kho | Thủ kho | Nhân viên không có quyền kho |
|---|---|---|---|---|
| CHUC_NANG_159 Đăng nhập ứng dụng kho | Được | Được | Được | Bị từ chối, phiên bị thu hồi |
| CHUC_NANG_159 Thao tác phiếu, nhận, xuất | Như web | Như web | Như web (kho trong phạm vi gán) | Không |
| CHUC_NANG_159 Cộng số đếm, xem lịch sử đếm | Được | Kho trong phạm vi gán | Kho trong phạm vi gán | Không |
| CHUC_NANG_159 Xem tồn sổ sách, chênh lệch kiểm kê | Được | Được | Không (đếm mù) | Không |

Ranh giới và kiểm soát riêng:
- Ứng dụng gửi token qua header Authorization, không dùng cookie nên không cần CSRF; token lưu bằng `expo-secure-store` (bản web: `sessionStorage`); không ghi log token.
- Mọi quyền kiểm ở máy chủ theo chi nhánh sở hữu kho; ứng dụng ẩn nút chỉ để dễ dùng.
- Cộng số đếm khóa dòng đợt kiểm kê, chỉ mục duy nhất dòng kiểm kê chống trùng dòng; lịch sử đếm chỉ thêm.
- Camera chỉ đọc mã, không lưu ảnh; quyền camera xin khi người dùng bấm nút camera.
### Ma trận phân quyền báo cáo quản trị MODULE_15 phần 1 (CONG_VIEC_50)

Quyền mới `analytics.access`, `analytics.sales.view`, `analytics.inventory.view`, `analytics.debt.view` (nhạy cảm), `analytics.commission.view` (nhạy cảm); gán ở phạm vi tập đoàn: mọi công ty của tập đoàn; phạm vi công ty: chỉ công ty đó; phạm vi chi nhánh: không có hiệu lực (tài liệu `08` mục 46, 47).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Kế toán trưởng | Kế toán | Quản lý kho | Nhân viên bán hàng, Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_175 Mở mini app, phạm vi xem, tổng quan (`analytics.access`) | Được | Trong công ty mình | Được | Được | Được | Không | Không |
| CHUC_NANG_176 Báo cáo bán hàng, xuất Excel (`analytics.sales.view`) | Được | Trong công ty mình | Được | Không | Không | Không | Không |
| CHUC_NANG_176 Báo cáo tồn kho và luân chuyển, xuất Excel (`analytics.inventory.view`) | Được | Trong công ty mình | Được | Không | Được | Không | Không |
| CHUC_NANG_177 Báo cáo công nợ theo tuổi nợ, xuất Excel (`analytics.debt.view`, nhạy cảm) | Được | Trong công ty mình | Được | Được | Không | Không | Không |
| CHUC_NANG_177 Báo cáo hoa hồng và ví, xuất Excel (`analytics.commission.view`, nhạy cảm) | Được | Trong công ty mình | Được | Được | Không | Không | Không |

Quyền nhạy cảm: `analytics.debt.view` (công nợ phải thu, phải trả theo đối tác của nhiều công ty), `analytics.commission.view` (thu nhập hoa hồng, rút tiền, thuế của từng người hưởng).

Ranh giới và kiểm soát riêng:
- Phạm vi xem: bộ điều khiển kiểm `analytics.access` trong công ty đang làm việc; service kiểm quyền của nhóm báo cáo bằng `PermissionService.permissionsCovering` với phạm vi `group`, rồi phạm vi `company` của công ty đang làm việc; quyền xét riêng từng nhóm. Điều kiện phạm vi công ty nằm trong truy vấn; `companyIds` hoặc `warehouseId` ngoài phạm vi trả `403` cho cả yêu cầu, không trả số liệu một phần.
- Chỉ đọc: không ghi dữ liệu nghiệp vụ, không phát sự kiện; báo cáo không có thao tác sửa, xóa.
- Nhật ký xuất: mỗi lần xuất Excel ghi nhật ký thao tác `analytics.<sales|inventory|debt|commission>.export` (người xuất, công ty, đối tượng `analytics_report`, bộ lọc, số dòng, địa chỉ IP, thiết bị).
- Không lộ dữ liệu cá nhân người hưởng: báo cáo hoa hồng và tệp Excel chỉ có họ tên người hưởng, không có số điện thoại, tài khoản ngân hàng.
- Giới hạn: khoảng ngày tối đa 366 ngày, bảng hiện tối đa 500 dòng, xuất tối đa 20.000 dòng (chống truy vấn quá tải).
- Truy vấn dùng tham số của Drizzle (`sql`), không ghép chuỗi SQL; dữ liệu đầu vào độc hại bị từ chối ở bước kiểm tra lược đồ (`400`), lỗi không trả chi tiết kỹ thuật.
- Không thêm thư viện phụ thuộc; xuất Excel bằng `write-excel-file` đã có.
### Ma trận phân quyền Nhân sự MODULE_08 phần 4: tuyển dụng, đánh giá hiệu suất (CONG_VIEC_54)

Thêm quyền `hr.recruitment.request` (không nhạy cảm), `hr.recruitment.manage`, `hr.review.manage` (nhạy cảm, chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty), thêm vào vai trò Quản lý nhân sự, Nhân viên nhân sự (tài liệu `08` mục 48); loại chứng từ `hr.recruitment_request`, `hr.job_offer` qua luồng duyệt chung.

| Chức năng | Quản trị tập đoàn, công ty | Quản lý nhân sự, Nhân viên nhân sự | Người chỉ có `hr.recruitment.request` | Người phỏng vấn, người chấm được giao | Chỉ dữ liệu của chính mình | Không đăng nhập |
|---|---|---|---|---|---|---|
| CHUC_NANG_190 Nhu cầu tuyển dụng | Được | Được | Nhu cầu của mình (người khác `404`) | Không | Không | Không |
| CHUC_NANG_190 Tin tuyển dụng | Được | Được | Không (`403`) | Không | Không | Không |
| CHUC_NANG_190 Trang tuyển dụng công khai, nộp hồ sơ | – | – | – | – | – | Được (tin công khai đang đăng) |
| CHUC_NANG_191 Ứng viên, tệp, đồng ý, giai đoạn, phỏng vấn, email, đề nghị, yêu cầu xóa, cài đặt lưu giữ | Được | Được | Không (`403`) | Không | Không | Không |
| CHUC_NANG_191 Xem ứng viên rút gọn, tải sơ yếu lý lịch, ghi phiếu phỏng vấn | Được | Được | Không | Người phỏng vấn: vòng được giao, chưa hủy (khác `404`) | Không | Không |
| CHUC_NANG_191 Trả lời đề nghị nhận việc | Ghi thay | Ghi thay | Không | Không | Không | Ứng viên có liên kết, một lần |
| CHUC_NANG_191 Lập hồ sơ nhân sự từ ứng viên | Được | Được (cần cả `hr.employee.manage`) | Không | Không | Không | Không |
| CHUC_NANG_192 Mẫu, kỳ, mọi phiếu, gán người chấm, hiệu chỉnh, chốt, công bố | Được | Được | Không | Không | Không | Không |
| CHUC_NANG_192 Đặt, chốt mục tiêu, chấm phiếu | Như người chấm | Như người chấm | Không | Người chấm: phiếu được giao (khác `404`) | Không | Không |
| CHUC_NANG_192 Lập mục tiêu, tự đánh giá, xem kết quả, xác nhận | Phiếu của mình | Phiếu của mình | Phiếu của mình | Phiếu của mình | Có (điểm người chấm chỉ sau công bố) | Không |

Ranh giới và kiểm soát riêng:
- Tách dữ liệu công ty: ứng viên thuộc công ty của tin (bên kiểm soát dữ liệu), không chia sẻ giữa công ty con; mọi truy vấn lọc `company_id` của công ty đang chọn; công ty khác nhận `404`. Quyền tuyển dụng, đánh giá kiểm bao trùm công ty trong service (gán ở chi nhánh không mở được).
- Tối thiểu hóa dữ liệu (Luật 91/2025/QH15 Điều 25 khoản 1 điểm a): trang công khai không thu giới tính, ngày sinh, số giấy tờ, ảnh; API công khai không trả mã nhu cầu, lương nội bộ, số lượng, người lập. Người phỏng vấn chỉ nhận họ tên, nơi ở, trình độ, kinh nghiệm, thư giới thiệu, sơ yếu lý lịch; không nhận email, điện thoại, mức lương.
- Đồng ý (Nghị định 356/2025/NĐ-CP Điều 6): hai ô đồng ý riêng không đánh sẵn; bằng chứng lưu nguyên văn điều khoản, phiên bản, ngôn ngữ, thời điểm, IP, trình duyệt (`hr.candidate_consents`); nhập tay bắt buộc tệp bằng chứng.
- Liên kết trả lời đề nghị: mã 32 byte ngẫu nhiên (`randomBytes`), chỉ lưu mã băm SHA-256 (`response_token_hash`, duy nhất); dùng một lần, mất hiệu lực sau hạn trả lời (cuối ngày giờ Việt Nam), khi đã trả lời, hủy, hết hạn, gửi lại thư; lịch sử email không lưu liên kết; khi xóa ứng viên mã băm bị xóa.
- Khử nhận dạng khi xóa ứng viên (QUYTAC_NGHIEPVU_388; Luật 91/2025/QH15 Điều 14 khoản 3): xóa tệp trên kho lưu trữ trước (lỗi thì giữ ứng viên ở hàng chờ, việc nền chạy lại, không lỗi khi tệp đã mất), rồi trong một giao dịch xóa họ tên, email, điện thoại, nơi ở, thư giới thiệu, lương mong muốn, ghi chú, nguyên văn điều khoản, IP, trình duyệt, nhận xét phỏng vấn, thân email, ghi chú đề nghị; không khôi phục; nhật ký ghi `candidate.erase` không kèm dữ liệu đã xóa. Ứng viên đã thành nhân viên không bị xóa (`409 candidateHired`), theo thời hạn lưu của hồ sơ nhân sự (RUIRO CONG_VIEC_46).
- Tệp: sơ yếu lý lịch PDF, DOCX; bằng chứng đồng ý PDF, JPG, PNG; tối đa 10 MB (kiểm ở service để báo lỗi theo ô, multer cắt ở 20 MB); kiểm chữ ký đầu tệp; khóa lưu trữ `hr/<công ty>/candidates/<mã ngẫu nhiên>`; tải xuống `no-store`, `nosniff`; S3 mã hóa khi lưu (SSE).
- Giới hạn yêu cầu: chỉ API_204 (`/careers`) bỏ giới hạn theo IP (THAY_DOI_23); `/job-offer-responses` và các API công khai khác giữ 20 yêu cầu mỗi phút mỗi IP.
- Khóa đồng thời: lập hồ sơ nhân sự từ ứng viên khóa nhu cầu (`FOR UPDATE`) để không vượt số lượng; trả lời đề nghị khóa dòng đề nghị.
- Mức lương (nhu cầu, đề nghị) chỉ trả cho người có `hr.recruitment.manage` hoặc người lập nhu cầu; điểm người chấm chỉ trả cho nhân viên sau công bố.

### Ma trận phân quyền cộng đồng MODULE_10 phần 1 (CONG_VIEC_49, THAY_DOI_22)

Quyền mới `marketplace.community.manage` (nhạy cảm; Quản trị tập đoàn, Quản trị công ty có sẵn). Vai trò, quyền dùng lại ở tài liệu `08` mục 49.

| Chức năng | Quản trị công ty vận hành sàn, Quản trị tập đoàn | Kế toán, Kế toán trưởng | Nhân viên có quyền xem tương ứng | Người dùng ứng dụng VComm |
|---|---|---|---|---|
| CHUC_NANG_171 Đăng ký cộng tác viên, lượt bấm, thống kê, Mời bạn bè | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_171 Xem cộng tác viên | Có (`marketplace.buyer.view`) | Không | Có | Không |
| CHUC_NANG_171 Duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn | Có (`marketplace.buyer.manage`) | Không | Không | Không |
| CHUC_NANG_171, CHUC_NANG_172, CHUC_NANG_173 Xem cài đặt thưởng giới thiệu, mua chung, nhóm, khóa ví | Có (`marketplace.order.view`) | Xem | Xem | Không |
| CHUC_NANG_171, CHUC_NANG_172, CHUC_NANG_173 Sửa cài đặt thưởng giới thiệu, mua chung; mở, hủy nhóm trên web; khóa ví mua sắm | Có (`marketplace.order.manage`) | Không | Không | Không |
| CHUC_NANG_172 Mở nhóm trên ứng dụng | Không áp dụng | Không áp dụng | Không áp dụng | Cộng tác viên Đã duyệt |
| CHUC_NANG_172, CHUC_NANG_173 Tham gia nhóm, xem ví mua sắm | Của mình | Của mình | Của mình | Của mình |
| CHUC_NANG_173 Xem trạng thái chặn ví | Có | Có (`marketplace.payment.manage`) | Có (`marketplace.buyer.view`) | Không (chỉ biết ví của mình bị chặn) |
| CHUC_NANG_173 Chặn, gỡ chặn ví | Có (`marketplace.payment.manage`) | Có | Không | Không |
| CHUC_NANG_174 Bảng tin, đăng bài, bình luận, thích, báo cáo | Như người dùng ứng dụng | Như người dùng ứng dụng | Như người dùng ứng dụng | Có; xóa nội dung của mình |
| CHUC_NANG_174 Kiểm duyệt, khóa tài khoản, bài VComm, từ cấm, công tắc | Có (`marketplace.community.manage`) | Không | Không | Không |

Điểm tiếp nhận dữ liệu bổ sung:
- Mọi thân yêu cầu kiểm bằng lược đồ zod `strict` (trường thừa bị từ chối); mã UUID qua `UuidPipe`; loại ví trên đường dẫn qua `z.enum`; đối tượng kiểm duyệt (`posts`, `comments`) qua `z.enum`.
- Ảnh bài đăng (API_169): multipart một tệp, giới hạn tải lên 6 MB ở tầng nhận, tối đa 5 MB khi lưu; loại xác định theo nội dung tệp (JPEG, PNG; dùng lại hàm kiểm ảnh trả hàng), không tin tên tệp, loại khai báo; lưu ở kho tệp với khóa do máy chủ sinh; trả ảnh với `x-content-type-options: nosniff`, `cache-control: private`.
- Nội dung bài, bình luận lưu nguyên văn, giới hạn độ dài; ứng dụng hiển thị dạng văn bản (React Native `Text`), không hiển thị HTML.

Ranh giới và kiểm soát riêng:
- Người mua: hồ sơ cộng tác viên, đơn ghi nhận, người được mời, ví mua sắm, dòng đơn chờ đánh giá lấy theo người đăng nhập, không nhận mã người dùng từ bên ngoài; xóa bài, bình luận của người khác trả `404`; đánh giá chỉ dòng đơn Đã giao, Hoàn tất của chính mình.
- Mời bạn bè che số điện thoại người được mời (QUYTAC_NGHIEPVU_146). Số điện thoại đầy đủ của cộng tác viên, người tham gia nhóm, tác giả nội dung bị báo cáo, người bị khóa chỉ hiện cho người có quyền tương ứng trên web-crm.
- Ảnh: ảnh của bài đang hiện chỉ người đã đăng nhập xem; ảnh chưa gắn bài, ảnh của bài bị ẩn, tự ẩn, đã xóa chỉ người tải lên xem (người khác `404`); người có `marketplace.community.manage` xem mọi ảnh qua `GET /marketplace/community/images/{id}`. Ảnh chỉ gắn được vào bài của chính người tải lên, mỗi ảnh một bài; tối đa 30 ảnh chưa gắn bài trong 24 giờ.
- Lượt bấm không đạt điều kiện vẫn trả `204` để không dò được mã cộng tác viên hợp lệ; mã cộng tác viên sinh bằng `crypto.randomInt`.
- Giới hạn tần suất: 200 lượt bấm, 10 bài, 100 bình luận mỗi người mỗi ngày (giờ Việt Nam); 5 nhóm đang mở mỗi cộng tác viên; đếm trong giao dịch có khóa dòng tài khoản người mua (`buyer_accounts ... FOR UPDATE`) hoặc hồ sơ cộng tác viên để gửi đồng thời không vượt giới hạn.
- Kiểm duyệt: mọi API quản trị bảng tin cần `marketplace.community.manage` tại công ty vận hành sàn; nội dung, bình luận của công ty khác trả `404`; báo cáo chỉ nội dung của người khác, mỗi người một lần (chỉ mục duy nhất); từ cấm so sánh sau khi bỏ dấu, chữ thường; người bị khóa, công tắc tắt bị chặn ở máy chủ cho cả đăng bài và bình luận; mọi thao tác kiểm duyệt ghi nhật ký kiểm tra.
- Ví mua sắm: số dư chỉ đổi qua giao dịch ví trong giao dịch cơ sở dữ liệu có khóa dòng ví (`SELECT … FOR UPDATE` trên `shopping_wallets`), số dư không âm (ràng buộc cơ sở dữ liệu và kiểm trước khi trừ); đặt đơn khóa dòng ví trước khi tính phần trả bằng ví nên hai đơn đồng thời không trừ quá số dư; hoàn tiền khóa dòng đơn; giao dịch ví không có API sửa, xóa; không có API nạp, rút, chuyển.
- Khóa ví toàn hệ thống (`marketplace.order.manage`) và chặn ví theo tài khoản (`marketplace.payment.manage`, lý do bắt buộc, theo phiên bản, lịch sử, nhật ký, thông báo người dùng) kiểm ở máy chủ khi đặt đơn dùng ví, tạo yêu cầu rút tiền, ghi đã chi; chặn ví hoa hồng tự từ chối yêu cầu chờ duyệt trong cùng giao dịch.
- Mua chung: đặt đơn tham gia khóa dòng nhóm; chốt nhóm khóa dòng nhóm, các đơn, chỉ xử lý nhóm còn mở nên chạy lại không chốt lần hai; tiền hoàn mua chung chỉ vào ví mua sắm của người mua đơn.
- Nhật ký kiểm tra: `marketplace.collaborator.*`, `marketplace.referral_bonus_settings.update`, `marketplace.group_buy_settings.update`, `marketplace.group_buy.cancel`, `marketplace.shopping_wallet_settings.update`, `marketplace.wallet_block.block`, `.unblock`, `marketplace.community.*`, `marketplace.community_settings.update`.
- Rủi ro pháp lý (ví điện tử, giấy phép mạng xã hội) chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư (CONG_VIEC_49 mục 10).

### Ma trận phân quyền ngân sách mua MODULE_14 phần 3 (CONG_VIEC_58)

Quyền mới `purchasing.budget.view`, `purchasing.budget.manage` (không nhạy cảm; gán ở phạm vi tập đoàn hoặc công ty; tài liệu `08` mục 50, 51). Loại chứng từ duyệt mới `purchasing.budget_plan`, `purchasing.budget_adjustment`, `purchasing.order_over_budget`.

| Quyền | Phạm vi | Nhạy cảm | Vai trò mặc định |
|---|---|---|---|
| `purchasing.budget.view` | Tập đoàn, công ty | Không | Quản trị tập đoàn, quản trị công ty, Nhân viên mua hàng |
| `purchasing.budget.manage` | Tập đoàn, công ty | Không | Quản trị tập đoàn, quản trị công ty (vai trò nghiệp vụ gán bằng vai trò tự tạo) |

| Chức năng | Endpoint | Quản trị tập đoàn | Quản trị công ty | Trưởng phòng mua hàng (vai trò tự tạo) | Nhân viên mua hàng | Thủ kho | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|---|---|
| CHUC_NANG_207 Xem kế hoạch, danh sách chọn | `GET /purchasing/budget-options`, `GET /purchasing/budget-plans`, `GET /purchasing/budget-plans/{id}` (API_235) | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_207 Lập, sửa kế hoạch | `POST /purchasing/budget-plans`, `PATCH /purchasing/budget-plans/{id}` (API_235) | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_207 Gửi duyệt, hủy kế hoạch | `POST /purchasing/budget-plans/{id}/submit`, `/cancel` (API_236) | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_207 Rút kế hoạch | `POST /purchasing/budget-plans/{id}/withdraw` (API_236) | Của mình | Của mình | Của mình | Không | Không | Có (người lập, cấp 1 chưa quyết định) |
| CHUC_NANG_208 Xem phiếu điều chỉnh | `GET /purchasing/budget-adjustments`, `GET /purchasing/budget-adjustments/{id}` (API_237) | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_208 Lập, sửa, gửi duyệt, hủy phiếu | `POST`, `PATCH /purchasing/budget-adjustments...`, `/submit`, `/cancel` (API_237, API_238) | Được | Trong công ty mình | Được | Không | Không | Không |
| CHUC_NANG_208 Rút phiếu | `POST /purchasing/budget-adjustments/{id}/withdraw` (API_238) | Của mình | Của mình | Của mình | Không | Không | Có (người lập, cấp 1 chưa quyết định) |
| CHUC_NANG_209 Số còn được mua, đơn của một ô | `GET /purchasing/open-to-buy`, `GET /purchasing/open-to-buy/orders` (API_239) | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_209 Kiểm tra ngân sách đơn đang lập, sửa | `POST /purchasing/orders/budget-check` (API_240) | Được | Trong công ty mình | Được | Được | Không | Không |
| CHUC_NANG_209 Khối ngân sách, ảnh chụp ô vượt ở chi tiết đơn | `GET /purchasing/orders/{id}` (API_75, `budgetCheck`, `budgetSnapshot`) | Được | Trong công ty mình | Khi có quyền đơn mua | Được | Được (`purchasing.order.view`) | Không |
| CHUC_NANG_207 đến CHUC_NANG_209 Duyệt kế hoạch, phiếu, đơn mua vượt ngân sách | API_41 (quyết định duyệt) | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Không (người lập không tự duyệt) |

Ranh giới và kiểm soát riêng:
- Vào mini app: bộ điều khiển kiểm `purchasing.access`, `purchasing.order.view` hoặc `purchasing.requisition.create` trong công ty đang làm việc; service kiểm quyền ngân sách. Mọi truy vấn kế hoạch, phiếu, ô, đơn có điều kiện `company_id` của công ty đang làm việc; mã của công ty khác trả `404` (KICHBAN_KIEMTHU_594).
- Đồng thời: gửi duyệt kế hoạch giữ khóa tư vấn theo công ty (`pg_advisory_xact_lock`) để hai kế hoạch trùng tháng không cùng được gửi; gửi duyệt đơn mua kiểm tra ngân sách trong cùng giao dịch, giữ khóa tư vấn theo công ty để hai đơn gửi cùng lúc không cùng lọt trong ngân sách (KICHBAN_KIEMTHU_592); sửa, gửi, hủy dùng khóa lạc quan `version`.
- Không tự duyệt: chưa có chính sách duyệt hiệu lực thì kế hoạch, phiếu, đơn vượt ngân sách không gửi được (không duyệt ngay); đơn vượt ngân sách không được miễn duyệt.
- Truy vấn dùng tham số của Drizzle (`sql`), không ghép chuỗi SQL; dữ liệu đầu vào sai bị từ chối ở bước kiểm tra lược đồ (`400`), lỗi không trả chi tiết kỹ thuật.
- Nhật ký thao tác: `budget_plan.create`, `.update`, `.submit`, `.withdraw`, `.cancel`; `budget_adjustment.create`, `.update`, `.submit`, `.withdraw`, `.cancel`, `.apply` (hệ thống, kèm dòng làm ô nhỏ hơn số đã dùng); `purchase_order.submit` ghi thêm `overBudget`, `exempt`.
- Không thêm thư viện phụ thuộc.

## 5. Quản lý khóa bí mật

| Khóa | Nơi lưu | Môi trường | Ngày đổi gần nhất | Trạng thái |
|---|---|---|---|---|
| Chuỗi kết nối cơ sở dữ liệu (tài khoản ứng dụng, quyền tối thiểu) | AWS Secrets Manager, tự đổi mỗi 90 ngày | Phát triển, thử nghiệm, thật (khác nhau) | Chưa tạo | Chưa tạo |
| Khóa ký token truy cập | AWS Secrets Manager | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa KMS mã hóa bí mật TOTP và khóa bí mật trong Cài đặt tích hợp (máy phát triển: biến `MFA_SECRET_KEY`, tối thiểu 32 ký tự) | AWS KMS | Từng môi trường | Chưa tạo | Chưa tạo |
| Mã ứng dụng Google, Microsoft, Zalo (client secret) | Cài đặt tích hợp (bảng `integration_settings`, mã hóa AES-256-GCM), quản trị tập đoàn nhập ở MAN_HINH_19 (THAY_DOI_08); không đặt trong biến môi trường | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa eSMS.vn (API key, Secret key) gửi SMS, Zalo ZNS | Cài đặt tích hợp như trên (THAY_DOI_08) | Từng môi trường | Chưa tạo | Chưa tạo |
| Thông tin kết nối MISA meInvoice (mã ứng dụng, tên đăng nhập, mật khẩu) của từng công ty (CONG_VIEC_16) | Bảng `finance.einvoice_settings`, mật khẩu mã hóa AES-256-GCM (khóa như Cài đặt tích hợp); Kế toán trưởng nhập ở MAN_HINH_55; không đặt trong biến môi trường | Từng môi trường, từng công ty | Chưa tạo | Chưa tạo |
| Khóa xác thực webhook ngân hàng của từng kết nối (CONG_VIEC_18) | Bảng `finance.bank_connections`, mã hóa AES-256-GCM (khóa như Cài đặt tích hợp); hệ thống sinh, Kế toán trưởng khai vào dịch vụ trung gian; đổi bằng "Đổi khóa xác thực" ở MAN_HINH_59; không đặt trong biến môi trường | Từng môi trường, từng quỹ | Chưa tạo | Chưa tạo |
| Thông tin truy cập AWS S3 lưu tệp đính kèm | Vai trò IAM, không dùng khóa tĩnh | Từng môi trường | Không áp dụng | Chưa tạo |
| Khóa gửi email (Amazon SES) | Vai trò IAM, không dùng khóa tĩnh | Từng môi trường | Không áp dụng | Chưa tạo |
| Token, mã cửa hàng GHN; khóa webhook vận chuyển (CONG_VIEC_24) | Biến môi trường `GHN_API_TOKEN`, `GHN_SHOP_ID`, `GHN_WEBHOOK_KEY` (môi trường thật: AWS Secrets Manager) | Từng môi trường (thử nghiệm dùng tài khoản thử nghiệm của GHN) | Chưa tạo | Chưa tạo |
| Mã website, khóa bí mật VNPAY (CONG_VIEC_25) | Biến môi trường `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` (môi trường thật: AWS Secrets Manager); `VNPAY_RETURN_URL`, `VNPAY_PAYMENT_URL`, `VCOMM_APP_LINK_BASE` không bí mật | Từng môi trường (thử nghiệm dùng tài khoản môi trường thử nghiệm của VNPAY) | Chưa tạo | Chưa tạo |

Máy phát triển dùng tệp `.env` không commit; kho mã có `.env.example` không chứa giá trị thật.

## 6. Kết quả kiểm tra phần E (vận hành)

Chưa vận hành.

## 7. Sự cố bảo mật

Chưa có.

## 8. Rủi ro đã chấp nhận

Chưa có.

- RUIRO CONG_VIEC_23 (người dùng chấp nhận 2026-11-10): 2 lỗ hổng mức Trung bình (glob GHSA, minimatch GHSA-g3hv-75wg-m249) trong `@expo/cli`, công cụ phát triển của Expo SDK 58, không chạy trên môi trường thật. Thời hạn: đến khi Expo phát hành bản sửa tương thích, rà lại mỗi lần nâng Expo, chậm nhất 2027-02-10. Biện pháp giảm thiểu: chỉ chạy công cụ trên máy phát triển, không đưa vào ảnh triển khai máy chủ.

- RUIRO CONG_VIEC_46 (người dùng quyết định 2026-11-11, chưa xử lý xong): hồ sơ người lao động đã nghỉ được giữ nguyên, khóa truy cập; Luật 91/2025/QH15 Điều 25 khoản 2 điểm c yêu cầu xóa, hủy dữ liệu khi chấm dứt hợp đồng, trừ thỏa thuận hoặc luật khác quy định. Biện pháp giảm thiểu: chỉ người có `hr.employee.manage` xem hồ sơ đã nghỉ; người dùng chốt thời hạn lưu với luật sư, đưa điều khoản lưu giữ vào mẫu hợp đồng; làm chức năng xóa, khử nhận dạng ở công việc sau. Thời hạn: trước khi triển khai MODULE_08 lên môi trường thật.
- RUIRO CONG_VIEC_47 (người dùng chấp nhận 2026-11-11): chấm công bằng GPS có thể bị giả vị trí bằng ứng dụng giả lập; hệ thống không ràng buộc thiết bị, không chụp ảnh. Biện pháp giảm thiểu: cấu hình địa điểm kết hợp mạng công ty hoặc mã QR động; lưu độ chính xác, cách xác thực để rà soát; trưởng phòng duyệt đơn giải trình. Thời hạn: xem lại khi có yêu cầu chấm công bằng khuôn mặt hoặc thiết bị.
- Ghi nhận (CONG_VIEC_47): vị trí GPS tại lượt chấm là dữ liệu cá nhân; doanh nghiệp cần thông báo mục đích, có đồng ý của người lao động (nội quy hoặc văn bản) trước khi bật chấm công GPS; đưa vào hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.
- RUIRO THAY_DOI_23 (người dùng chấp nhận 2026-11-11, CONG_VIEC_54): API_204 trang tuyển dụng công khai không giới hạn số yêu cầu theo IP, không OTP, không giới hạn số lần nộp. Rủi ro: hồ sơ rác hàng loạt, đầy kho lưu trữ tệp, tốn tài nguyên máy chủ, ứng viên giả mạo dữ liệu người khác. Biện pháp giảm thiểu: tệp tối đa 10 MB, chỉ PDF hoặc DOCX, kiểm chữ ký đầu tệp; lược đồ dữ liệu chặt (từ chối trường lạ); chỉ nhận cho tin đang đăng công khai, chưa quá hạn; nộp công khai không gộp vào ứng viên có sẵn, chỉ đánh dấu trùng; hồ sơ không trúng tuyển tự xóa sau 30 ngày; theo dõi dung lượng kho tệp và số hồ sơ mỗi ngày khi vận hành (tài liệu `26`). Các API công khai khác giữ giới hạn 20 yêu cầu mỗi phút. Thời hạn: rà lại sau 3 tháng vận hành hoặc khi có dấu hiệu lạm dụng.
- Ghi nhận (CONG_VIEC_46): đánh giá tác động xử lý dữ liệu cá nhân (Luật 91/2025/QH15 Điều 21; Nghị định 356/2025/NĐ-CP Điều 19) là nghĩa vụ của doanh nghiệp, cần lập hồ sơ gửi cơ quan chuyên trách trong 60 ngày kể từ khi bắt đầu xử lý; ngoài phạm vi phần mềm.

## Kiểm soát điểm thưởng (CONG_VIEC_51)

| Điểm tiếp nhận | Kiểm soát |
|---|---|
| API_176, API_179 đến API_182 (`/loyalty/*`) | Phiên nhân viên, CSRF; quyền `loyalty.view` hoặc `loyalty.manage` tại công ty vận hành sàn; nhật ký thao tác cho mọi thao tác ghi |
| API_177 (`/buyer/loyalty`) | Token người mua; chỉ dữ liệu của người gọi |
| API_178 (đặt đơn dùng điểm) | Điểm kiểm lại trên máy chủ trong giao dịch, khóa dòng ví điểm; không tin số điểm, tiền điểm từ ứng dụng |
| Sổ cái điểm | Trigger cơ sở dữ liệu chặn sửa, xóa bút toán; số dư không âm; điều chỉnh tay qua luồng duyệt, người lập không tự duyệt |
| Rủi ro pháp lý | Điểm không quy ra tiền mặt, không chuyển, không rút; giới hạn phần trăm đơn theo giai đoạn; chờ ý kiến luật sư trước khi phát hành lên môi trường thật (tài liệu `04`) |

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| Mục 2 | Tệp Excel tối đa 5 MB |
| Mục 3 | Đổi mới token làm mới mỗi lần dùng; giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập |
| Mục 5 | Gửi email qua Amazon SES; tự đổi mật khẩu cơ sở dữ liệu mỗi 90 ngày |

### Ma trận phân quyền Nhân sự MODULE_08 phần 3 – Lương (CONG_VIEC_48)

Thêm quyền `hr.payroll.view`, `hr.payroll.manage`, `hr.payroll.setup` (nhạy cảm, gán ở phạm vi tập đoàn hoặc công ty). Dữ liệu mới: mức lương đóng bảo hiểm, bảng lương, phiếu lương, cam kết 08/CK-TNCN (tài chính cá nhân).

| Chức năng | Quản trị tập đoàn | Quản trị công ty, Quản lý nhân sự | Nhân viên nhân sự | Kế toán trưởng | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_168 Tham số pháp luật | Được | Xem | Xem | Không | Không |
| CHUC_NANG_168 Thiết lập công ty, loại phụ cấp | Được | Được | Xem | Không | Không |
| CHUC_NANG_168 Hồ sơ lương nhân viên | Được | Được | Được | Không | Không |
| CHUC_NANG_169 Lập, tính, gửi, hủy bảng lương | Được | Được | Được | Không | Không |
| CHUC_NANG_169 Xem bảng lương, xuất Excel | Được | Được | Được | Được | Không |
| CHUC_NANG_170 Ghi đã trả lương | Được | Được | Được | Không | Không |
| CHUC_NANG_170 Phiếu lương | Được | Được | Được | Được | Có (API_161, phiếu người khác `404`) |

Ranh giới và kiểm soát riêng:
- Mọi truy vấn lọc `company_id` của công ty đang chọn; bảng lương công ty khác `404`.
- Nhật ký thao tác không ghi số tiền lương, lương đóng bảo hiểm (chỉ tháng, loại khoản, nội dung).
- Email phiếu lương chỉ gửi tới email cá nhân trong hồ sơ, sau khi giao dịch duyệt xong. Trình gửi `EMAIL_DRIVER=log` khi phát triển ghi nội dung email (có số tiền) ra log: chỉ dùng trên máy phát triển; môi trường thật dùng nhà cung cấp thật, không ghi nội dung.
- Bút toán lương ghi qua module Kế toán, kiểm kỳ đã khóa; kỳ cuối tháng đã khóa sau khi gửi duyệt thì bút toán ghi ngày duyệt.
