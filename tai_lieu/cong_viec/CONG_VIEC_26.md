# CONG_VIEC_26: Hoa hồng theo đơn và ví hoa hồng (MODULE_09, phần lõi 4)

- Mô tả: Thiết lập hoa hồng từng sản phẩm (giới thiệu, bốn chức danh đội kinh doanh); chốt người hưởng khi đặt đơn; cộng ví khi đơn hoàn tất theo tiền hàng thực bán; ví hoa hồng trên ứng dụng; yêu cầu rút tiền, kế toán duyệt chi, khấu trừ thuế thu nhập cá nhân, phí rút tiền (THAY_DOI_17); hạch toán.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-11 (không làm bản mẫu riêng, xem trước từng lát). Chờ nghiệm thu (pull request #76; kiểm thử 338/338, kết quả ở tài liệu `25`).
- Nguồn: THAY_DOI_14, THAY_DOI_16, THAY_DOI_17 (phí rút tiền, lát L5); quyết định người dùng 2026-11-11 (tài liệu `02`); CONG_VIEC_23 (người giới thiệu, nhân viên phụ trách), CONG_VIEC_27 (chức danh, chuỗi cấp trên), CONG_VIEC_24 (đơn hoàn tất), CONG_VIEC_25 (tài khoản ngân hàng người mua, bút toán).

## 1. Mục tiêu

Người giới thiệu và đội kinh doanh nhận hoa hồng đúng theo từng đơn hoàn tất, xem được trên ứng dụng, rút về tài khoản ngân hàng; VComm kiểm soát chi trả và thuế.

## 2. Phạm vi

Trong phạm vi: thiết lập hoa hồng từng sản phẩm; cài đặt chung (thuế thu nhập cá nhân, mức rút tối thiểu, bảng phí rút tiền); chốt người hưởng, mức hoa hồng khi đặt đơn; tính, cộng ví khi đơn hoàn tất; ví (số dư, hoa hồng đang chờ, lịch sử); yêu cầu rút tiền, duyệt, từ chối, ghi đã chi; phí rút tiền; bút toán; người quản lý xem hoa hồng của cấp dưới.

Ngoài phạm vi: chi trả tự động qua ngân hàng; quyết toán thuế cuối năm, chứng từ khấu trừ thuế (kế toán làm ngoài hệ thống, hệ thống cung cấp bảng kê); thay đổi CONG_VIEC_17 (hoa hồng đơn bán B2B cũ, xử lý ở công việc sửa riêng).

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_52: Người giới thiệu và đội kinh doanh nhiều cấp nhận hoa hồng theo đơn VComm hoàn tất vào ví, rút về tài khoản ngân hàng có duyệt chi và khấu trừ thuế.
- CHUC_NANG_134: Thiết lập hoa hồng từng sản phẩm, cài đặt chung (gồm bảng phí rút tiền).
- CHUC_NANG_135: Chốt người hưởng khi đặt đơn; tính và cộng ví khi đơn hoàn tất.
- CHUC_NANG_136: Ví hoa hồng trên ứng dụng; hoa hồng của cấp dưới.
- CHUC_NANG_137: Yêu cầu rút tiền, duyệt chi, khấu trừ thuế, phí rút tiền, bảng kê.
- CHUC_NANG_138: Hạch toán hoa hồng, chi trả, thuế, phí rút tiền.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_200: Thiết lập hoa hồng từng sản phẩm (bắt buộc; sản phẩm chưa thiết lập thì không có hoa hồng): một cách tính cho cả sản phẩm, phần trăm hoặc số tiền cố định trên mỗi đơn vị cơ sở; năm mức: giới thiệu, Nhân viên kinh doanh, Trưởng phòng kinh doanh, Giám đốc Vùng, Giám đốc Kinh doanh (không âm; phần trăm tổng năm mức không quá 100%; số tiền không vượt giá bán; số tiền cố định chỉ đặt khi sản phẩm đã có giá, bổ sung sau rà soát). Sửa thiết lập chỉ áp dụng cho đơn đặt sau.
- QUYTAC_NGHIEPVU_201: Người hưởng chốt lúc đặt đơn: hoa hồng giới thiệu cho người giới thiệu của người mua lúc đặt (QUYTAC_NGHIEPVU_143); hoa hồng đội kinh doanh khi người giới thiệu đang là nhân viên kinh doanh (nhân viên phụ trách, QUYTAC_NGHIEPVU_145): người phụ trách và chuỗi cấp trên lúc đặt đơn (QUYTAC_NGHIEPVU_150). Mỗi chức danh: người trong chuỗi có chức danh đó nhận; thiếu thì người có chức danh cao hơn gần nhất trong chuỗi nhận; không có ai cao hơn thì không ai nhận phần đó; các chức danh thấp hơn chức danh của người phụ trách thì người phụ trách nhận. Nhân viên kinh doanh tự giới thiệu khách nhận cả hoa hồng giới thiệu và phần đội. Người mua không có người giới thiệu thì đơn không có hoa hồng.
- QUYTAC_NGHIEPVU_202: Tính khi đơn hoàn tất: phần trăm × tiền hàng chưa thuế giá trị gia tăng sau khuyến mãi của dòng (không tính quà tặng, phí giao hàng) theo phần số lượng không trả; số tiền cố định × số lượng không trả; làm tròn đến đồng. Cộng vào ví từng người hưởng (một giao dịch ví mỗi đơn mỗi người). Đơn hủy thì hoa hồng của đơn bỏ.
- QUYTAC_NGHIEPVU_203: Ví: số dư = tổng cộng trừ tổng rút; hoa hồng đang chờ = ước tính của đơn chưa hoàn tất (theo tiền hàng hiện tại). Người dùng chỉ xem ví của mình; người quản lý xem tổng hoa hồng đã nhận, đang chờ của từng cấp dưới trong nhánh.
- QUYTAC_NGHIEPVU_204: Rút tiền: số tiền từ mức tối thiểu (mặc định 100.000 đồng, cấu hình được) đến số dư; cần tài khoản ngân hàng đã lưu (MAN_HINH_100); một yêu cầu đang chờ mỗi người; tạo yêu cầu thì trừ số dư ngay (giữ tiền); từ chối hoặc người dùng rút lại thì cộng lại.
- QUYTAC_NGHIEPVU_205: Thuế thu nhập cá nhân: tổng số tiền các yêu cầu đã duyệt (kể cả đã chi) của người đó trong cùng tháng duyệt (giờ Việt Nam) cộng số tiền yêu cầu đang xét vượt ngưỡng (mặc định 5.000.000 đồng; THAY_DOI_19) thì khấu trừ theo tỷ lệ (mặc định 10%) trên toàn bộ số tiền; ngưỡng, tỷ lệ cấu hình được; số thuế, số thực nhận chốt khi kế toán duyệt; bảng kê thuế đã khấu trừ theo tháng.
- QUYTAC_NGHIEPVU_206: Duyệt chi: người có `marketplace.payment.manage` duyệt (chốt thuế, phí, số thực nhận) hoặc từ chối (lý do); sau khi chuyển khoản ghi đã chi (mã giao dịch ngân hàng, ngày); báo người dùng bằng thông báo trong ứng dụng. Bổ sung sau rà soát: không tự duyệt, từ chối, ghi đã chi yêu cầu của chính mình; ngày chi không trước ngày duyệt.
- QUYTAC_NGHIEPVU_207: Hạch toán (công ty đã khởi tạo kế toán): đơn hoàn tất Nợ chi phí hoa hồng / Có phải trả hoa hồng (3388); ghi đã chi Nợ 3388 số tiền yêu cầu / Có tiền gửi ngân hàng số thực nhận / Có thuế thu nhập cá nhân phải nộp (3335) số thuế / Có thu nhập khác (711) số phí rút tiền (QUYTAC_NGHIEPVU_208).

- QUYTAC_NGHIEPVU_208 (THAY_DOI_17): Phí rút tiền: hai bảng phí trong cài đặt chung, cộng dồn; bảng trống thì không thu. Bảng theo lần rút: từ lần thứ N trong tháng thu phí cố định; lấy mức có N lớn nhất không vượt thứ tự lần rút. Đếm lần rút theo tháng dương lịch (giờ Việt Nam) theo ngày tạo yêu cầu, không tính yêu cầu bị từ chối hoặc đã rút lại. Bảng theo số tiền: từ mức số tiền, phí cố định cộng phần trăm số tiền; phần phần trăm có mức tối thiểu, mức tối đa (có thể trống). Phí trừ vào thực nhận: thực nhận = số tiền − thuế − phí; thuế vẫn tính trên toàn bộ số tiền. Phí dự kiến khi gửi, chốt khi duyệt; thuế cộng phí vượt số tiền thì từ chối tạo, từ chối duyệt. Hạch toán Có thu nhập khác (711, vai trò định khoản `other_income`), không thuế giá trị gia tăng.

## 5. Vai trò và quyền

- `marketplace.order.manage`: thiết lập hoa hồng sản phẩm, cài đặt chung (gồm bảng phí rút tiền).
- `marketplace.payment.manage`: danh sách rút tiền, duyệt, từ chối, ghi đã chi, bảng kê thuế.
- Người mua, nhân viên kinh doanh: ví của mình; người quản lý: hoa hồng của cấp dưới.

## 6. Luồng nghiệp vụ

Luồng 39: quản trị thiết lập hoa hồng sản phẩm → người mua đặt đơn (chốt người hưởng, mức) → đơn hoàn tất (tính theo hàng thực bán, cộng ví, bút toán) → người hưởng yêu cầu rút → kế toán duyệt (thuế) → chuyển khoản, ghi đã chi (bút toán) → thông báo.

## 7. Màn hình

Web-crm:
- MAN_HINH_101 Thiết lập hoa hồng sản phẩm (từ màn hình Đăng bán): cách tính, năm mức.
- Sửa MAN_HINH_86: cài đặt hoa hồng chung (ngưỡng thuế, tỷ lệ, mức rút tối thiểu, bảng phí rút tiền).
- MAN_HINH_102 Rút tiền hoa hồng: lọc trạng thái, duyệt, từ chối, ghi đã chi; bảng kê thuế theo tháng.
- Sửa MAN_HINH_88: hoa hồng của đơn (người hưởng, phần, số tiền).

Ứng dụng:
- MAN_HINH_103 Ví hoa hồng: số dư, đang chờ, lịch sử (đơn, rút), rút tiền.
- MAN_HINH_104 Yêu cầu rút tiền: số tiền, tài khoản nhận, thuế, phí dự kiến.
- Sửa MAN_HINH_83 Đội của tôi (thẻ trong MAN_HINH_78 Kinh doanh): hoa hồng từng cấp dưới.
- Sửa MAN_HINH_76 Tài khoản: nút Ví hoa hồng.

## 8. Dữ liệu và API

- Database migration 0044 (`0044_marketplace_commission_settings.sql`): `marketplace.product_commissions`, `marketplace.commission_settings`.
- Database migration 0045 (`0045_marketplace_order_commissions.sql`): `marketplace.order_commissions` (dòng × phần × người hưởng), `marketplace.wallets`, `marketplace.wallet_transactions`.
- Database migration 0046 (`0046_marketplace_withdrawals.sql`): `marketplace.withdrawals`; `marketplace.wallet_transactions` thêm `withdrawal_id`.
- Database migration 0047 (`0047_marketplace_commission_postings.sql`): nguồn bút toán `marketplace_commission`, `marketplace_withdrawal`; vai trò định khoản `commission_payable` (3388), `personal_income_tax` (3335).
- Database migration 0048 (`0048_marketplace_withdrawal_fees.sql`, THAY_DOI_17): `marketplace.commission_settings.withdrawal_fees`; `marketplace.withdrawals.fee_amount`, ràng buộc thực nhận + thuế + phí = số tiền; vai trò định khoản `other_income` (711).
- API_134 thiết lập hoa hồng sản phẩm, cài đặt chung (quản trị; cài đặt chung thêm `withdrawalFees`).
- API_135 ví, lịch sử, hoa hồng cấp dưới (ứng dụng; phần rút tiền thêm `withdrawalFees`, `withdrawalsThisMonth`, `approvedThisMonth` theo THAY_DOI_19).
- API_136 rút tiền (ứng dụng: tạo, rút lại; quản trị: danh sách, duyệt, từ chối, ghi đã chi, bảng kê thuế; yêu cầu, bảng kê thêm `feeAmount`).

## 9. Điều kiện đặc biệt

Mức hoa hồng, thuế là dữ liệu tiền của người dùng: mọi thay đổi số dư qua giao dịch ví có khóa dòng ví; không sửa, không xóa giao dịch ví.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_216 | Thiết lập hoa hồng sản phẩm đúng ràng buộc; sản phẩm chưa thiết lập không có hoa hồng; sửa chỉ áp dụng đơn sau | Bắt buộc | KICHBAN_KIEMTHU_356 |
| TIEUCHI_NGHIEMTHU_217 | Chốt người hưởng đúng: giới thiệu, đội theo chức danh, thiếu chức danh, người quản lý tự phụ trách, người giới thiệu không phải nhân viên | Bắt buộc | KICHBAN_KIEMTHU_357 |
| TIEUCHI_NGHIEMTHU_218 | Hoàn tất cộng ví đúng số tiền (phần trăm, cố định, trừ hàng trả); đơn hủy không có hoa hồng; ví, đang chờ đúng | Bắt buộc | KICHBAN_KIEMTHU_358 |
| TIEUCHI_NGHIEMTHU_219 | Rút tiền: tối thiểu, số dư, một yêu cầu chờ, giữ tiền, từ chối cộng lại; thuế trên ngưỡng; ghi đã chi; phân quyền | Bắt buộc | KICHBAN_KIEMTHU_359 |
| TIEUCHI_NGHIEMTHU_220 | Bút toán hoa hồng, chi trả, thuế đúng tài khoản | Bắt buộc | KICHBAN_KIEMTHU_360 |
| TIEUCHI_NGHIEMTHU_221 | Web, ứng dụng chạy được (máy tính, khổ điện thoại); người quản lý xem hoa hồng cấp dưới | Bắt buộc | KICHBAN_KIEMTHU_361 |
| TIEUCHI_NGHIEMTHU_222 | Phí rút tiền: hai bảng cộng dồn, bảng trống không thu; đếm lần rút đúng; phí dự kiến khi gửi, chốt khi duyệt; thực nhận = số tiền − thuế − phí; thuế cộng phí vượt số tiền bị từ chối; bút toán Có 711 | Bắt buộc | KICHBAN_KIEMTHU_362 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_356 đến 360: tự động, `apps/api/test/c26-*.test.ts`.
- KICHBAN_KIEMTHU_362: tự động, `apps/api/test/c26-withdrawal-fees.test.ts`.
- KICHBAN_KIEMTHU_361: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại: chuỗi cấp trên `SalesTeam` (CONG_VIEC_27), hoàn tất đơn `completeDue` (CONG_VIEC_24), tài khoản ngân hàng người mua (CONG_VIEC_25), bút toán tự sinh (CONG_VIEC_14), thông báo trong ứng dụng.

## 13. Thành phần không được thay đổi

Hoa hồng đơn bán B2B của CONG_VIEC_17; luồng đơn VComm, thanh toán, hoàn tiền của CONG_VIEC_24, 25 (chỉ thêm bước chốt người hưởng khi đặt và cộng ví khi hoàn tất).

## 14. Các lát và điểm xem trước

- L0: database migration, thiết lập hoa hồng sản phẩm, cài đặt chung (API_134; MAN_HINH_101, sửa 86).
- L1: chốt người hưởng khi đặt, tính và cộng ví khi hoàn tất, hoa hồng của đơn trên web (sửa MAN_HINH_88).
- L2: ví trên ứng dụng, hoa hồng cấp dưới (API_135; MAN_HINH_103, sửa đội của tôi).
- L3: rút tiền, duyệt chi, thuế, bảng kê (API_136; MAN_HINH_102, 104).
- L4: bút toán hoa hồng, chi trả, thuế.
- L5 (THAY_DOI_17): phí rút tiền theo lần rút trong tháng và theo số tiền (database migration 0048; QUYTAC_NGHIEPVU_208; sửa API_134 đến API_136, MAN_HINH_86, 102 đến 104); bổ sung sau rà soát: không tự xử lý yêu cầu của chính mình, ngày chi không trước ngày duyệt, hoa hồng cố định chỉ đặt khi sản phẩm đã có giá.
