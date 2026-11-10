# CONG_VIEC_27: Đội kinh doanh nhiều cấp (MODULE_09, phần lõi 1b)

- Mô tả: Đội kinh doanh của sàn VComm có bốn chức danh (Giám đốc Kinh doanh, Giám đốc Vùng, Trưởng phòng kinh doanh, Nhân viên kinh doanh) theo cây đơn vị kinh doanh (phòng ban) của công ty vận hành sàn; người quản lý xem nhánh của mình trên ứng dụng VComm và đề xuất thay đổi đội; quản trị thay đổi trực tiếp và duyệt đề xuất trên web-crm.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-10 (không làm bản mẫu riêng, xem trước từng lát). Đã làm L0 đến L3, sửa lỗi rà soát độc lập; chờ nghiệm thu.
- Nguồn: THAY_DOI_16; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`; CONG_VIEC_23 (đánh dấu nhân viên kinh doanh, THAY_DOI_15).

## 1. Mục tiêu

Biết chính xác ai thuộc đội kinh doanh, chức danh, cấp trên của từng người: căn cứ quyền xem và hoa hồng nhiều cấp theo cơ cấu tổ chức (CONG_VIEC_26).

## 2. Phạm vi

Trong phạm vi:
- Gắn loại đơn vị kinh doanh (Khối kinh doanh, Vùng, Phòng kinh doanh) cho phòng ban của công ty vận hành sàn.
- Chức danh suy ra từ vị trí; chuỗi cấp trên; chuyển đơn vị; bổ nhiệm, bỏ quản lý đơn vị; lịch sử.
- Ứng dụng: chức danh, đơn vị của tôi; đội của tôi (cây cấp dưới, số khách), khách của từng cấp dưới (thông tin đầy đủ); đề xuất thêm người, chuyển đơn vị, bổ nhiệm quản lý, đưa ra khỏi đội; rút đề xuất.
- Web-crm: đội kinh doanh (cây đơn vị, loại đơn vị, quản lý, thành viên, chức danh; chuyển, bổ nhiệm); duyệt, từ chối đề xuất.

Ngoài phạm vi: doanh số, hoa hồng của cấp dưới (hiện khi có đơn, CONG_VIEC_24, CONG_VIEC_26); tạo, đổi tên phòng ban (dùng màn hình phòng ban có sẵn của mini app Nền tảng).

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_49: Đội kinh doanh nhiều cấp bậc chức danh, phân quyền và hoa hồng khác nhau theo chức danh.
- CHUC_NANG_109: Cây đơn vị kinh doanh, chức danh, chuỗi cấp trên.
- CHUC_NANG_110: Quản trị đội kinh doanh trên web (chuyển đơn vị, bổ nhiệm quản lý, lịch sử).
- CHUC_NANG_111: Đội của tôi trên ứng dụng (xem nhánh, khách của cấp dưới).
- CHUC_NANG_112: Đề xuất thay đổi đội trên ứng dụng, duyệt trên web.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_148: Đơn vị kinh doanh là phòng ban đang hoạt động của công ty vận hành sàn được gắn loại Khối kinh doanh, Vùng hoặc Phòng kinh doanh. Thứ bậc Khối > Vùng > Phòng: đơn vị kinh doanh con phải có loại thấp hơn đơn vị kinh doanh cha gần nhất (được thiếu cấp giữa, ví dụ Phòng ngay dưới Khối). Bỏ loại hoặc đổi loại không được làm sai thứ bậc của đơn vị con và không được khi đơn vị kinh doanh còn thành viên đội kinh doanh (gắn loại lần đầu cho phòng ban đang có người thì được).
- QUYTAC_NGHIEPVU_149: Thành viên đội kinh doanh là tài khoản được đánh dấu nhân viên kinh doanh, thuộc đúng một đơn vị kinh doanh. Chức danh suy ra từ vị trí: quản lý (người quản lý của phòng ban) một Khối là Giám đốc Kinh doanh, một Vùng là Giám đốc Vùng, một Phòng là Trưởng phòng kinh doanh; còn lại là Nhân viên kinh doanh. Chỉ thành viên thuộc chính đơn vị đó được bổ nhiệm làm quản lý; mỗi người quản lý tối đa một đơn vị.
- QUYTAC_NGHIEPVU_150: Chuỗi cấp trên của một thành viên: đi từ đơn vị của người đó lên các đơn vị kinh doanh cha, lấy người quản lý của từng đơn vị kinh doanh (bỏ chính người đó, người không còn là thành viên đội, người không thuộc chính đơn vị đó); phòng ban ngừng hoạt động coi là nút trung gian không phải đơn vị kinh doanh. Nhánh của một người quản lý: mọi thành viên thuộc đơn vị mình quản lý và các đơn vị kinh doanh con, trừ chính mình. Hoa hồng đội kinh doanh (CONG_VIEC_26) chia theo chức danh trong chuỗi; chức danh thiếu thì người có chức danh cao hơn gần nhất trong chuỗi nhận (người quản lý tự phụ trách khách nhận cả phần các chức danh dưới mình).
- QUYTAC_NGHIEPVU_151: Quyền xem trên ứng dụng: thành viên xem khách mình phụ trách; người quản lý xem thêm danh sách cấp dưới trong nhánh (họ tên, chức danh, đơn vị, số khách) và khách của từng cấp dưới với thông tin đầy đủ.
- QUYTAC_NGHIEPVU_152: Quản trị (quyền `marketplace.buyer.manage` tại công ty vận hành sàn) thay đổi trực tiếp: gắn loại đơn vị, đánh dấu (chọn đơn vị kinh doanh), chuyển đơn vị, bổ nhiệm, bỏ quản lý, bỏ đánh dấu; Giám đốc Kinh doanh đầu tiên do quản trị đặt. Chuyển đơn vị người đang quản lý thì bỏ quản lý đơn vị cũ. Bỏ đánh dấu người đang quản lý thì bỏ quản lý. Người đã thuộc đội không đánh dấu lại được (dùng chuyển đơn vị). Mọi thay đổi ghi lịch sử (người làm, thời điểm, đề xuất nếu có).
- QUYTAC_NGHIEPVU_153: Đề xuất (người quản lý trên ứng dụng): thêm người (tài khoản đang hoạt động chưa là thành viên đội, tìm theo số điện thoại) vào đơn vị trong nhánh; chuyển cấp dưới sang đơn vị khác trong nhánh; bổ nhiệm cấp dưới làm quản lý một đơn vị con trong nhánh; đưa cấp dưới ra khỏi đội. Lý do 1 đến 500 ký tự. Mỗi người chỉ có một đề xuất chờ duyệt; mỗi người đề xuất tối đa 20 đề xuất mỗi ngày; đề xuất thêm người chưa duyệt chỉ hiện tên, số điện thoại đã che cho người đề xuất. Người đề xuất rút được khi chờ duyệt. Quản trị duyệt thì áp dụng (kiểm lại điều kiện; không còn đúng thì báo “Đề xuất không còn đúng với đội hiện tại”, đề xuất vẫn chờ để quản trị từ chối) hoặc từ chối kèm ghi chú. Kết quả báo cho người đề xuất bằng thông báo trong ứng dụng.

## 5. Vai trò và quyền

Không thêm quyền: quản trị dùng `marketplace.buyer.manage`, `marketplace.buyer.view`; thành viên đội dùng API người mua, phạm vi theo QUYTAC_NGHIEPVU_151.

## 6. Luồng nghiệp vụ

Luồng 36: quản trị gắn loại cho các phòng ban (Khối, Vùng, Phòng) → đánh dấu Giám đốc Kinh doanh vào Khối, bổ nhiệm quản lý Khối → Giám đốc Kinh doanh đề xuất trên ứng dụng thêm Giám đốc Vùng vào Vùng, bổ nhiệm → quản trị duyệt → Giám đốc Vùng đề xuất thêm Trưởng phòng, nhân viên… → quản lý xem đội của tôi, khách của cấp dưới.

## 7. Màn hình

Web-crm:
- MAN_HINH_81 Đội kinh doanh: cây phòng ban của công ty vận hành sàn, loại đơn vị, quản lý, thành viên (chức danh); gắn loại, chuyển, bổ nhiệm, bỏ quản lý.
- MAN_HINH_82 Đề xuất đội kinh doanh: lọc trạng thái; duyệt, từ chối.
- Sửa MAN_HINH_80: chọn đơn vị kinh doanh khi đánh dấu; hiện chức danh, chuỗi cấp trên.

Ứng dụng:
- Sửa MAN_HINH_78 Kinh doanh: chức danh, đơn vị của tôi; khách tôi phụ trách.
- MAN_HINH_83 Đội của tôi (người quản lý): cấp dưới theo đơn vị.
- MAN_HINH_84 Khách của một cấp dưới.
- MAN_HINH_85 Đề xuất: lập đề xuất, danh sách đề xuất của tôi, rút.

## 8. Dữ liệu và API

- Database migration 0024: `core.departments.sales_unit_type` (`division`, `region`, `team`); `marketplace.sales_flag_history` thêm hành động `move`, `appoint`, `unappoint` và cột đề xuất; `marketplace.sales_team_proposals`.
- API_120 quản trị đội: `GET /marketplace/sales-team`; `PUT /marketplace/sales-units/{departmentId}`; `PUT /marketplace/sales-units/{departmentId}/manager`; `POST /marketplace/buyers/{id}/sales-move`.
- API_121 đề xuất: `GET`, `POST /buyer/sales/proposals`; `POST /buyer/sales/proposals/{id}/withdraw`; `GET /marketplace/sales-proposals`; `POST /marketplace/sales-proposals/{id}/approve`, `/reject`.
- API_122 đội của tôi: `GET /buyer/sales/team`; `GET /buyer/sales/members/{userId}/customers`; `/buyer/me` thêm chức danh, đơn vị.

## 9. Điều kiện đặc biệt

Hoa hồng nhiều cấp chỉ theo cơ cấu tổ chức (cây đơn vị), không theo cây giới thiệu (Nghị định 40/2018/NĐ-CP).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_169 | Gắn loại đơn vị đúng thứ bậc; chức danh suy ra đúng; chuỗi cấp trên đúng kể cả khi thiếu cấp | Bắt buộc | KICHBAN_KIEMTHU_302, 303 |
| TIEUCHI_NGHIEMTHU_170 | Quản trị đánh dấu vào đơn vị kinh doanh, chuyển đơn vị, bổ nhiệm, bỏ quản lý, bỏ đánh dấu; lịch sử | Bắt buộc | KICHBAN_KIEMTHU_303, 304 |
| TIEUCHI_NGHIEMTHU_171 | Người quản lý xem đúng nhánh, khách của cấp dưới; không xem được ngoài nhánh; nhân viên không xem đội | Bắt buộc | KICHBAN_KIEMTHU_305 |
| TIEUCHI_NGHIEMTHU_172 | Đề xuất đúng phạm vi nhánh; một đề xuất chờ mỗi người; rút; duyệt áp dụng, kiểm lại; từ chối; thông báo | Bắt buộc | KICHBAN_KIEMTHU_306, 307 |
| TIEUCHI_NGHIEMTHU_173 | Ứng dụng: chức danh, đội của tôi, khách của cấp dưới, đề xuất chạy được trên bản xem trước web khổ điện thoại | Bắt buộc | KICHBAN_KIEMTHU_308 |
| TIEUCHI_NGHIEMTHU_174 | MAN_HINH_81, MAN_HINH_82 hiển thị đúng trên máy tính và điện thoại | Mong muốn | KICHBAN_KIEMTHU_309 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_302 đến 307: tự động, `apps/api/test/c27-sales-team.test.ts`.
- KICHBAN_KIEMTHU_308, 309: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng `core.departments` (cây, `manager_user_id`), thông báo trong ứng dụng (`common/notifications.ts`).

## 13. Thành phần không được thay đổi

Màn hình, API phòng ban của mini app Nền tảng; phạm vi xem theo phòng ban của CONG_VIEC_21.

## 14. Các lát và điểm xem trước

- L0: database migration, API_120, chức danh, chuỗi cấp trên. Điểm xem trước: gọi thử API.
- L1: web-crm MAN_HINH_81, sửa MAN_HINH_80.
- L2: ứng dụng: chức danh, đội của tôi, khách của cấp dưới (API_122).
- L3: đề xuất trên ứng dụng, duyệt trên web (API_121, MAN_HINH_82, MAN_HINH_85).

## 15. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_148 đến 153 có kiểm thử tự động (KICHBAN_KIEMTHU_302 đến 307) |
| Đúng giao diện | Đạt: xem trước ứng dụng khổ iPhone 13, web-crm máy tính và điện thoại không cuộn ngang, không lỗi trình duyệt (KICHBAN_KIEMTHU_308, 309) |
| Đã xử lý lỗi | Đạt: lỗi nghiệp vụ có thông báo riêng; xác nhận trước thao tác áp dụng ngay; ứng dụng tải riêng từng phần |
| Đã kiểm thử, có kết quả trong tài liệu `25`, đạt cổng kiểm thử | Đạt: c27-sales-team 7/7, toàn bộ 312/312; không còn lỗi Nghiêm trọng, Cao |
| Không phá vỡ chức năng cũ | Đạt: kiểm thử cũ đạt; c23 thêm bước gắn loại Phòng kinh doanh cho phòng ban dùng trong KICHBAN_KIEMTHU_299 (người dùng cho phép 2026-11-10); không sửa mini app Nền tảng |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt: TIEUCHI_NGHIEMTHU_169 đến 173; mong muốn TIEUCHI_NGHIEMTHU_174 đạt |
| Đạt cổng bảo mật | Đạt: lỗi Cao, Trung bình của rà soát đã sửa; không thêm thư viện; gitleaks trong CI chưa chạy do tài khoản GitHub lỗi thanh toán |
| Đã tự rà soát mã, dọn dẹp | Đạt: rà soát độc lập, sửa ở commit 09086c5; tệp tạm trong `tam_thoi/CONG_VIEC_27/` (Git bỏ qua) |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Đạt: 06 đến 11, 14, 16, 17, 21, 22, 27, mục lục |

## 16. Giới hạn đã biết

- Mini app Nền tảng đổi cha, người quản lý phòng ban không kiểm thứ bậc Khối > Vùng > Phòng; thành viên ở đơn vị không còn hoạt động hiện riêng trên MAN_HINH_81 để quản trị chuyển.
- Đề xuất chờ của người bị bỏ đánh dấu không tự hủy; duyệt báo không còn đúng, quản trị từ chối.
- Doanh số, hoa hồng của cấp dưới hiện ở CONG_VIEC_24, CONG_VIEC_26.
