# CONG_VIEC_49: Cộng đồng phần 1 (MODULE_10)

- Mô tả: Cộng tác viên (gồm nhãn KOL, KOC) chia sẻ đường dẫn sản phẩm nhận hoa hồng; thưởng giới thiệu bạn bè một lần; mua chung bậc giá theo tổng số lượng, trả trước, hoàn tiền dư vào ví mua sắm; bảng tin cộng đồng mở (bài đăng, đánh giá đã mua hàng, bình luận, thích) có hậu kiểm. Trên ứng dụng VComm (`apps/mobile-vcomm`) và web quản trị (`apps/web-crm`).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Bản nháp, chờ người dùng duyệt cổng đặc tả.
- Nguồn: tài liệu `04`, `05` (mục 2.2, 2.4); THAY_DOI_14, 16, 17; quyết định của người dùng ngày 2026-11-11 (mục 17); CONG_VIEC_23 (tài khoản người mua, giới thiệu), CONG_VIEC_24 (đặt hàng), CONG_VIEC_25 (thanh toán, hoàn tiền), CONG_VIEC_26 (hoa hồng theo đơn, ví hoa hồng), CONG_VIEC_27 (đội kinh doanh).
- Mức: Lớn (module mới, dữ liệu mới, sửa cách đặt hàng, thanh toán, hoa hồng).

## 1. Mục tiêu

Dùng sức lan truyền của cộng đồng người mua để tăng đơn VComm: người có ảnh hưởng chia sẻ sản phẩm và mở nhóm mua chung, người mua mời bạn bè, người mua chia sẻ trải nghiệm trên bảng tin.

## 2. Phân biệt với phần đã có (không trùng)

| Đối tượng | Gắn với khách | Hoa hồng | Nguồn |
|---|---|---|---|
| Người giới thiệu | Vĩnh viễn (khách đăng ký bằng mã của người đó) | Phần "giới thiệu" trên mọi đơn của khách | CONG_VIEC_23, 26 (giữ nguyên) |
| Nhân viên kinh doanh | Qua người giới thiệu là nhân viên | Phần đội kinh doanh nhiều cấp theo chức danh | CONG_VIEC_27, 26 (giữ nguyên) |
| Cộng tác viên (mới) | Không gắn khách; theo lượt bấm đường dẫn sản phẩm trong 7 ngày hoặc theo nhóm mua chung do mình mở | Phần thứ sáu "cộng tác viên" trên dòng đơn của sản phẩm đó, độc lập với hai phần trên | Công việc này |
| Thưởng giới thiệu bạn bè (mới) | Dùng quan hệ giới thiệu đã có | Một khoản cố định, một lần cho mỗi người được giới thiệu, khi đơn đầu tiên đạt điều kiện hoàn tất | Công việc này |

Một người có thể vừa là người giới thiệu, vừa là nhân viên kinh doanh, vừa là cộng tác viên; mỗi vai trò nhận phần của mình theo quy tắc riêng.

## 3. Phạm vi

Trong phạm vi:
- Cộng tác viên: đăng ký trên ứng dụng, duyệt trên web, nhãn KOL, KOC, tạm ngừng; mã cộng tác viên; đường dẫn sản phẩm; ghi nhận lượt bấm; hoa hồng cộng tác viên (mức thứ sáu trong thiết lập hoa hồng sản phẩm); thống kê của tôi.
- Thưởng giới thiệu bạn bè: cài đặt, cộng ví hoa hồng, hạch toán; màn hình Mời bạn bè.
- Mua chung: cài đặt bậc giá theo biến thể; mở nhóm (cộng tác viên, KOL, KOC trên ứng dụng; nhân viên VComm trên web); tham gia bằng đơn trả trước; chốt nhóm, sửa giá theo bậc đạt được, hoàn tiền dư; hủy nhóm khi không đạt mốc tối thiểu.
- Ví mua sắm: nhận tiền hoàn của mua chung, dùng trả đơn VComm sau; không nạp, không rút, không chuyển.
- Bảng tin: bài đăng có ảnh, gắn sản phẩm; bài đánh giá gắn dòng đơn đã giao (nhãn "Đã mua hàng", điểm sao hiện ở trang sản phẩm); bài của VComm, ghim; bình luận một cấp; thích; báo cáo vi phạm; kiểm duyệt (ẩn, hiện lại, khóa quyền đăng); từ cấm; công tắc tắt đăng bài, bình luận.

Ngoài phạm vi: hoa hồng theo ngành hàng, chương trình riêng cho KOL, KOC (CONG_VIEC sau, MODULE_10 phần 2); thông báo đẩy về điện thoại; nhắn tin giữa người dùng; theo dõi người dùng; video; nạp, rút, chuyển ví mua sắm; nhà bán bên ngoài.

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_78: Người mua được đăng ký làm cộng tác viên; VComm duyệt, gắn nhãn KOL, KOC.
- YCAU_NGHIEPVU_79: Cộng tác viên chia sẻ đường dẫn sản phẩm và nhận hoa hồng trên đơn phát sinh từ đường dẫn, không ảnh hưởng hoa hồng giới thiệu, đội kinh doanh.
- YCAU_NGHIEPVU_80: Người giới thiệu nhận thưởng một lần khi bạn được mời có đơn đầu tiên đạt điều kiện.
- YCAU_NGHIEPVU_81: Mua chung: nhóm do cộng tác viên, KOL, KOC hoặc VComm mở; giá theo bậc tổng số lượng; trả trước toàn bộ; chốt giá theo bậc đạt được, hoàn tiền dư; không đạt mốc tối thiểu thì hủy nhóm.
- YCAU_NGHIEPVU_82: Tiền hoàn của mua chung vào ví mua sắm của người mua, dùng trả đơn sau.
- YCAU_NGHIEPVU_83: Bảng tin cộng đồng mở: người mua đăng bài, bình luận, thích; đánh giá đã mua hàng.
- YCAU_NGHIEPVU_84: VComm hậu kiểm nội dung: báo cáo vi phạm, ẩn, khóa quyền đăng, từ cấm, tắt toàn hệ thống.
- YCAU_NGHIEPVU_85: Không dùng.

- CHUC_NANG_171: Cộng tác viên và thưởng giới thiệu bạn bè.
- CHUC_NANG_172: Mua chung.
- CHUC_NANG_173: Ví mua sắm.
- CHUC_NANG_174: Bảng tin cộng đồng và kiểm duyệt.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_324 Cộng tác viên: người mua đang hoạt động gửi đăng ký (đồng ý điều khoản cộng tác viên, kênh chia sẻ chính 0 đến 200 ký tự); mỗi người một hồ sơ. Trạng thái: Chờ duyệt → Đã duyệt hoặc Từ chối (lý do 1 đến 500 ký tự; người mua gửi lại được) ; Đã duyệt → Tạm ngừng (lý do) → Đã duyệt. Người có `marketplace.buyer.manage` tại công ty vận hành sàn duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn (không nhãn, KOL, KOC; chỉ cộng tác viên đã duyệt). Duyệt lần đầu cấp mã cộng tác viên 8 ký tự (chữ in hoa, chữ số, bỏ 0, O, 1, I), không đổi. Mọi thao tác theo phiên bản, ghi lịch sử, báo người mua bằng thông báo trong ứng dụng.
- QUYTAC_NGHIEPVU_325 Đường dẫn và lượt bấm: đường dẫn `<địa chỉ ứng dụng>/p/<mã sản phẩm>?ctv=<mã cộng tác viên>`. Người mua đã đăng nhập mở đường dẫn thì ghi lượt bấm (người mua, cộng tác viên, sản phẩm, thời điểm bấm gần nhất; một dòng cho mỗi bộ ba, bấm lại cập nhật thời điểm); chưa đăng nhập thì ứng dụng giữ mã và ghi khi đăng nhập, đăng ký xong trong cùng lần mở. Không ghi khi: mã không tồn tại, cộng tác viên không ở trạng thái Đã duyệt, người mở là chính cộng tác viên, sản phẩm không đăng bán. Mỗi người mua tối đa 200 lượt ghi mỗi ngày.
- QUYTAC_NGHIEPVU_326 Hoa hồng cộng tác viên: thiết lập hoa hồng sản phẩm (QUYTAC_NGHIEPVU_200) thêm mức "cộng tác viên" (mặc định 0); điều kiện tổng mức áp dụng cho cả sáu mức. Lúc đặt đơn, mỗi dòng không phải quà tặng: đơn thuộc nhóm mua chung do cộng tác viên mở thì người hưởng là người mở nhóm; ngược lại là cộng tác viên có lượt bấm gần nhất với sản phẩm đó trong 168 giờ trước lúc đặt. Người hưởng phải đang Đã duyệt và khác người mua. Phần này chụp vào đơn và tính, cộng ví hoa hồng như các phần khác (QUYTAC_NGHIEPVU_202), độc lập với phần giới thiệu, đội kinh doanh. Tạm ngừng không làm mất phần đã chụp vào đơn.
- QUYTAC_NGHIEPVU_327 Thưởng giới thiệu bạn bè: cài đặt của công ty vận hành sàn (bật, tắt; mức thưởng 1 đến 10.000.000 đồng; giá trị hoàn tất tối thiểu ≥ 0) do người có `marketplace.order.manage` sửa, theo phiên bản. Đơn đặt chụp người giới thiệu của người mua lúc đặt. Khi đơn chuyển Hoàn tất: chương trình đang bật, đơn có người giới thiệu, giá trị hoàn tất ≥ mức tối thiểu, người mua chưa từng làm phát sinh thưởng thì cộng mức thưởng hiện tại vào ví hoa hồng của người giới thiệu đã chụp (giao dịch "thưởng giới thiệu", gắn đơn). Mỗi người được giới thiệu phát sinh tối đa một lần thưởng. Hạch toán như hoa hồng (Nợ chi phí hoa hồng / Có phải trả hoa hồng), số bút toán `<số đơn>-TG`.
- QUYTAC_NGHIEPVU_328 Cài đặt mua chung: theo biến thể đang bán (QUYTAC_NGHIEPVU_155), người có `marketplace.order.manage` cài: bật, tắt; 1 đến 5 bậc, mỗi bậc "từ tổng số lượng N" (nguyên, bậc 1 ≥ 2, tăng dần) và đơn giá gồm thuế (> 0, giảm dần; bậc 1 không cao hơn giá bán hiện tại); thời hạn nhóm tối đa 1 đến 168 giờ; số lượng tối đa mỗi người mỗi nhóm 1 đến 999. Theo phiên bản. Nhóm chụp cài đặt lúc mở nên sửa cài đặt không đổi nhóm đang mở.
- QUYTAC_NGHIEPVU_329 Mở nhóm: cộng tác viên Đã duyệt (gồm KOL, KOC) trên ứng dụng, tối đa 5 nhóm đang mở mỗi người; người có `marketplace.order.manage` trên web. Chọn biến thể đang bật mua chung và thời hạn (1 giờ đến thời hạn tối đa). Nhóm: Đang mở → Thành công hoặc Thất bại; người có `marketplace.order.manage` hủy nhóm đang mở (lý do) thì xử lý như Thất bại. Mỗi nhóm có đường dẫn chia sẻ.
- QUYTAC_NGHIEPVU_330 Tham gia nhóm: nhóm Đang mở, chưa hết hạn, chưa mở đặt hàng thì như QUYTAC_NGHIEPVU_158. Đơn một dòng (biến thể của nhóm), số lượng cộng các đơn chưa hủy của người đó trong nhóm không vượt số tối đa mỗi người; đơn giá bậc 1, không khuyến mãi; phí giao hàng như đơn thường tại lúc đặt. Trả trước toàn bộ: phương thức trực tuyến đang bật, ví mua sắm, hoặc ví mua sắm cộng phương thức trực tuyến; không thanh toán khi nhận hàng. Đơn Chờ thanh toán (giữ hàng, hạn 15 phút, QUYTAC_NGHIEPVU_165), thu đủ thì sang Chờ chốt nhóm. Số lượng của nhóm = tổng số lượng các đơn Chờ chốt nhóm. Người mua hủy được đơn Chờ chốt nhóm khi nhóm còn mở (lý do): nhả hàng, hoàn toàn bộ tiền đã thu vào ví mua sắm.
- QUYTAC_NGHIEPVU_331 Chốt nhóm: việc nền mỗi phút xét nhóm hết hạn. Đơn còn Chờ thanh toán thì hủy (bên hủy hệ thống, lý do "Nhóm mua chung đã kết thúc"). Số lượng nhóm < N bậc 1: nhóm Thất bại, hủy mọi đơn (lý do "Nhóm mua chung không đủ số lượng"), nhả hàng, hoàn toàn bộ tiền đã thu vào ví mua sắm. Ngược lại nhóm Thành công, giá chốt = đơn giá bậc có N lớn nhất không vượt số lượng nhóm; mỗi đơn: sửa đơn giá dòng đơn bán thành giá chốt, tính lại tiền hàng (phí giao hàng giữ nguyên), cộng phần đã thu dư vào ví mua sắm (giao dịch "chênh lệch mua chung"), đơn sang Chờ giao. Mọi người tham gia nhận thông báo kết quả. Một nhóm lỗi không chặn nhóm khác. Hoàn tiền vào ví mua sắm không lập việc chờ hoàn ngân hàng.
- QUYTAC_NGHIEPVU_332 Ví mua sắm: mỗi người mua một ví, tách ví hoa hồng; số dư ≥ 0, chỉ đổi qua giao dịch ví (hoàn mua chung, chênh lệch mua chung, trả đơn, hoàn lại khi hủy đơn) có khóa dòng ví; không sửa, xóa giao dịch; không nạp, rút, chuyển; không hết hạn. Khi đặt mọi đơn VComm người mua chọn dùng ví: trừ tối đa tổng thanh toán của đơn, phần còn lại theo phương thức đã chọn (đơn thường: thanh toán khi nhận hàng hoặc trực tuyến; ví đủ trả toàn bộ thì không cần phương thức khác). Phần trả bằng ví ghi đã thu ngay trong sổ thanh toán đơn. Đơn bị hủy: phần trả bằng ví hoàn về ví; phần trực tuyến của đơn thường theo QUYTAC_NGHIEPVU_168. Hạch toán: số dư ví là tiền người mua trả trước trên phải thu khách hàng (131, không đối tác) nên trả bằng ví, hoàn vào ví không sinh bút toán mới; tiền trực tuyến vẫn hạch toán khi cổng báo thành công.
- QUYTAC_NGHIEPVU_333 Bài đăng: người mua đang hoạt động, không bị khóa đăng, công tắc đăng bài đang bật; nội dung 1 đến 2.000 ký tự, 0 đến 5 ảnh (JPEG, PNG, kiểm theo nội dung tệp, tối đa 5 MB), gắn 0 đến 3 sản phẩm đang bán. Bài đánh giá: gắn một dòng đơn của chính mình (không phải quà tặng) ở đơn Đã giao hoặc Hoàn tất, 1 đến 5 sao; mỗi dòng đơn một đánh giá; nhãn "Đã mua hàng"; trang sản phẩm hiện điểm trung bình, số đánh giá đang hiện. Bài của VComm do người có `marketplace.community.manage` đăng trên web, nhãn "VComm", ghim tối đa 3 bài. Bảng tin: bài ghim trước, còn lại mới nhất trước; lọc theo sản phẩm. Tác giả xóa bài của mình (ẩn vĩnh viễn), không sửa.
- QUYTAC_NGHIEPVU_334 Bình luận, thích, giới hạn: bình luận một cấp 1 đến 1.000 ký tự, không ảnh, khi công tắc bình luận bật và không bị khóa; tác giả xóa được. Thích bài: bật, tắt, mỗi người một lần mỗi bài. Mỗi người tối đa 10 bài, 100 bình luận mỗi ngày (giờ Việt Nam). Từ cấm: danh sách tối đa 500 cụm từ (không phân biệt hoa thường, dấu); bài, bình luận chứa từ cấm bị từ chối với thông báo chung.
- QUYTAC_NGHIEPVU_335 Báo cáo và kiểm duyệt: người dùng báo cáo bài, bình luận của người khác (lý do: quảng cáo rác, lừa đảo, xúc phạm, nội dung cấm, khác; mô tả 0 đến 500 ký tự), mỗi người một lần mỗi nội dung. Nội dung có từ 5 báo cáo chờ xử lý tự ẩn tạm. Người có `marketplace.community.manage`: ẩn (lý do), hiện lại, bỏ qua báo cáo; khóa đăng bài và bình luận của tài khoản 1 đến 365 ngày hoặc vĩnh viễn (lý do), mở khóa; sửa từ cấm; bật, tắt đăng bài, bình luận của người mua (tắt thì nội dung cũ vẫn hiện). Tác giả nhận thông báo khi nội dung bị ẩn, tài khoản bị khóa. Mọi thao tác ghi nhật ký.

## 6. Vai trò và quyền

- Quyền mới `marketplace.community.manage` (nhạy cảm): kiểm duyệt bảng tin, đăng bài VComm, từ cấm, công tắc.
- Dùng lại `marketplace.buyer.manage` (duyệt cộng tác viên, gắn nhãn), `marketplace.buyer.view` (xem), `marketplace.order.manage` (thưởng giới thiệu, mua chung), `marketplace.order.view` (xem nhóm).
- Quản trị tập đoàn, quản trị công ty có sẵn quyền mới. Chỉ dùng tại công ty vận hành sàn.
- Người mua dùng API người mua, chỉ thấy hồ sơ cộng tác viên, ví, đơn của chính mình; bảng tin công khai cho người mua đã đăng nhập.

## 7. Luồng nghiệp vụ

- Luồng cộng tác viên: đăng ký → duyệt (mã) → chia sẻ đường dẫn → người mua bấm (ghi lượt) → đặt trong 7 ngày (chụp phần cộng tác viên) → đơn hoàn tất (cộng ví hoa hồng) → rút tiền như CONG_VIEC_26.
- Luồng thưởng giới thiệu: người được giới thiệu đặt đơn (chụp người giới thiệu) → đơn hoàn tất đạt mức → cộng thưởng một lần.
- Luồng mua chung: VComm cài bậc giá → cộng tác viên mở nhóm, chia sẻ → người mua đặt đơn trả trước (Chờ thanh toán → Chờ chốt nhóm) → hết hạn: đạt mốc thì sửa giá, hoàn dư vào ví mua sắm, đơn Chờ giao, giao như đơn thường; không đạt thì hủy, hoàn toàn bộ vào ví mua sắm.
- Luồng bảng tin: đăng bài, bình luận → người khác báo cáo → đủ 5 báo cáo thì ẩn tạm → VComm ẩn hoặc hiện lại, khóa tài khoản vi phạm.

## 8. Màn hình

Ứng dụng VComm:
- MAN_HINH_132 Cộng tác viên: đăng ký (điều khoản), trạng thái, mã, nhãn; thống kê (lượt bấm, số đơn, hoa hồng cộng tác viên đang chờ, đã cộng); nút chia sẻ đường dẫn ở trang sản phẩm (sửa MAN_HINH_91).
- MAN_HINH_133 Mời bạn bè: đường dẫn, mã giới thiệu, mức thưởng hiện tại, danh sách người đã mời (tên, số che, ngày đăng ký, trạng thái thưởng).
- MAN_HINH_134 Mua chung: danh sách nhóm đang mở (ảnh, tên, bậc giá, số lượng hiện tại, còn lại bao lâu), chi tiết nhóm (thanh tiến độ theo bậc, tham gia, chia sẻ), mở nhóm (cộng tác viên), nhóm của tôi; đặt đơn mua chung dùng lại MAN_HINH_93 với chọn ví mua sắm.
- MAN_HINH_135 Ví mua sắm: số dư, lịch sử; chọn dùng ví ở MAN_HINH_93.
- MAN_HINH_136 Bảng tin (thẻ mới): danh sách bài, đăng bài (ảnh, gắn sản phẩm), viết đánh giá từ chi tiết đơn, chi tiết bài với bình luận, thích, báo cáo; điểm đánh giá ở MAN_HINH_91.

Web-crm:
- MAN_HINH_137 Cộng tác viên: danh sách (lọc trạng thái, nhãn, tìm số điện thoại), chi tiết (duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn, lịch sử, thống kê); thẻ Thưởng giới thiệu (cài đặt); sửa MAN_HINH thiết lập hoa hồng sản phẩm thêm mức cộng tác viên.
- MAN_HINH_138 Mua chung: cài đặt theo biến thể (bậc giá), danh sách nhóm (lọc trạng thái), chi tiết nhóm (đơn tham gia, số lượng, giá chốt), mở nhóm, hủy nhóm.
- MAN_HINH_139 Kiểm duyệt cộng đồng: hàng chờ báo cáo, nội dung đã ẩn, tài khoản bị khóa, bài VComm (đăng, ghim), từ cấm, công tắc.

## 9. Dữ liệu và API (dự kiến; chi tiết trình ở cổng dữ liệu và API)

- Database migration 0079 (cộng tác viên, thưởng giới thiệu): `marketplace.collaborators`, `collaborator_history`, `collaborator_clicks`; `product_commissions.collaborator`; `order_commissions.share` thêm `collaborator`; `marketplace.orders.referrer_user_id`; `marketplace.referral_bonus_settings`; `wallet_transactions.kind` thêm `referral_bonus`.
- Database migration 0080 (ví mua sắm): `marketplace.shopping_wallets`, `shopping_wallet_transactions`; sổ thanh toán đơn thêm phần trả bằng ví.
- Database migration 0081 (mua chung): `marketplace.group_buy_settings`, `group_buy_tiers`, `group_buys`; `marketplace.orders.group_buy_id`, trạng thái `awaiting_group`.
- Database migration 0082 (bảng tin): `marketplace.posts`, `post_images`, `post_products`, `post_comments`, `post_likes`, `content_reports`, `community_bans`, `community_settings` (công tắc, từ cấm); quyền `marketplace.community.manage`.
- API_162 cộng tác viên, mời bạn bè (người mua); API_163 cộng tác viên, thưởng giới thiệu (quản trị); API_164 mua chung (người mua); API_165 mua chung (quản trị); API_166 ví mua sắm; API_167 bảng tin (người mua); API_168 kiểm duyệt (quản trị); API_169 ảnh bài đăng.
- Việc nền mỗi phút: chốt nhóm mua chung.

## 10. Điều kiện đặc biệt và rủi ro

- Ví mua sắm giữ tiền của người mua: có thể bị coi là ví điện tử cần giấy phép trung gian thanh toán. Người dùng chọn ví mua sắm ngày 2026-11-11 khi đã được cảnh báo. Không phát hành lên môi trường thật trước khi có ý kiến luật sư (bổ sung vào mục CHƯA XÁC ĐỊNH của tài liệu `04`).
- Bảng tin mở cho người dùng đăng bài, bình luận có thể thuộc diện mạng xã hội phải có giấy phép. Có công tắc tắt đăng bài, bình luận của người mua; không phát hành phần mở trước khi có ý kiến luật sư.
- Cộng tác viên một tầng, không hoa hồng theo cây (tài liệu `05` mục 3).
- Chưa đối chiếu điều khoản văn bản pháp luật trong phiên này.

## 11. Tiêu chí nghiệm thu

| Mã | Nội dung | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_311 | Đăng ký, duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn cộng tác viên đúng trạng thái, quyền, phiên bản; cấp mã khi duyệt lần đầu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_312 | Lượt bấm đường dẫn ghi đúng điều kiện; đơn trong 168 giờ chụp phần cộng tác viên của lượt gần nhất; tự mua, quá hạn, chưa duyệt không có phần; phần giới thiệu, đội kinh doanh không đổi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_313 | Thưởng giới thiệu cộng một lần đúng mức, đúng người, có bút toán; không thưởng khi tắt, dưới mức, đã thưởng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_314 | Cài đặt mua chung kiểm đúng bậc giá; mở nhóm đúng người, giới hạn 5 nhóm; nhóm chụp cài đặt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_315 | Tham gia nhóm: trả trước, giá bậc 1, giới hạn mỗi người, không COD; hủy khi nhóm mở hoàn vào ví | Bắt buộc |
| TIEUCHI_NGHIEMTHU_316 | Chốt nhóm: thành công sửa giá theo bậc, hoàn dư vào ví, đơn Chờ giao, hoa hồng tính trên giá chốt; thất bại hủy, hoàn toàn bộ; đơn chưa thanh toán bị hủy | Bắt buộc |
| TIEUCHI_NGHIEMTHU_317 | Ví mua sắm: số dư không âm, trả đơn một phần hoặc toàn bộ, hoàn về ví khi hủy, không có cách rút; đồng thời không trừ quá số dư | Bắt buộc |
| TIEUCHI_NGHIEMTHU_318 | Bảng tin: đăng bài, ảnh, gắn sản phẩm, đánh giá chỉ cho dòng đơn đã giao của mình, bình luận, thích, giới hạn ngày, từ cấm, công tắc | Bắt buộc |
| TIEUCHI_NGHIEMTHU_319 | Báo cáo, tự ẩn ở 5 báo cáo, ẩn, hiện lại, khóa, mở khóa; người bị khóa không đăng được; thông báo tác giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_320 | Giao diện ứng dụng và web đạt danh sách rà soát giao diện, chuỗi trong tệp dịch vi, en | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_464 đến 475 (đúng, sai, biên, từng vai trò), lập ở cổng kiểm thử: 464 cộng tác viên trạng thái; 465 lượt bấm và phần cộng tác viên; 466 thưởng giới thiệu; 467 cài đặt mua chung; 468 mở nhóm; 469 tham gia nhóm; 470 chốt nhóm thành công; 471 chốt nhóm thất bại, hết hạn thanh toán; 472 ví mua sắm và đồng thời; 473 bài đăng, đánh giá; 474 bình luận, thích, giới hạn, từ cấm; 475 báo cáo, kiểm duyệt, phân quyền công ty.

## 13. Ràng buộc kỹ thuật

- Dùng lại: đặt hàng, giữ hàng, cổng thanh toán, hủy đơn (CONG_VIEC_24, 25); chụp và cộng hoa hồng, ví hoa hồng, bút toán (CONG_VIEC_26); kiểm ảnh theo nội dung tệp (trả hàng); thông báo trong ứng dụng; việc nền.
- Tiền `numeric`, làm tròn đến đồng; mọi thao tác ví khóa dòng ví.
- Mọi truy vấn lọc theo công ty vận hành sàn; người mua chỉ thấy dữ liệu của mình (trừ bảng tin công khai).

## 14. Thành phần không được thay đổi

Cách tính hoa hồng giới thiệu, đội kinh doanh; luồng rút tiền, thuế, phí; luồng hoàn tiền ngân hàng của đơn thường; trạng thái, hành vi của đơn không mua chung.

## 15. Các lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L1 | Migration 0079; cộng tác viên, lượt bấm, phần cộng tác viên, thưởng giới thiệu; MAN_HINH_132, 133, 137 | Đăng ký, duyệt, đặt đơn qua đường dẫn, thấy phần cộng tác viên; thưởng sau hoàn tất |
| L2 | Migration 0080, 0081; ví mua sắm, mua chung; MAN_HINH_134, 135, 138 | Mở nhóm, tham gia, chốt thành công và thất bại, ví |
| L3 | Migration 0082; bảng tin, kiểm duyệt; MAN_HINH_136, 139 | Đăng bài, đánh giá, báo cáo, ẩn, khóa |

Mỗi lát: kiểm thử tự động API, ảnh chụp ứng dụng (bản web của Expo) và web-crm.

## 16. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.

## 17. Quyết định của người dùng

- 2026-11-11: cộng tác viên theo đường dẫn sản phẩm, 7 ngày từ lần bấm cuối, mức hoa hồng thứ sáu, độc lập với giới thiệu và đội kinh doanh, không gắn khách, tự mua không có hoa hồng.
- 2026-11-11: thưởng giới thiệu bạn bè một lần vào ví hoa hồng khi đơn đầu tiên của người được giới thiệu hoàn tất và đạt giá trị tối thiểu; cài đặt bật tắt, mức thưởng, giá trị tối thiểu; màn hình Mời bạn bè.
- 2026-11-11: mua chung do quản trị, nhân viên VComm, KOL, KOC hoặc cộng tác viên mở; bậc giá theo tổng số lượng cấu hình được; bắt buộc trả trước 100%; kết phiên hoàn tiền dư vào ví; dưới mốc tối thiểu thì hủy nhóm.
- 2026-11-11: tiền dư, tiền hoàn mua chung vào ví mua sắm riêng (đã được cảnh báo rủi ro ví điện tử).
- 2026-11-11: cộng tác viên đăng ký trên ứng dụng, VComm duyệt trên web, gắn nhãn KOL, KOC; chỉ cộng tác viên đã duyệt nhận hoa hồng cộng tác viên.
- 2026-11-11: VComm cài bậc giá theo biến thể, người mở nhóm chỉ chọn sản phẩm và thời hạn, trả trước theo giá bậc đầu, chốt theo bậc đạt; người mở nhóm là cộng tác viên nhận hoa hồng cộng tác viên.
- 2026-11-11: bảng tin mạng xã hội mở (bài đăng tự do kèm sản phẩm, bình luận, thích, đánh giá đã mua); hiện ngay, hậu kiểm, báo vi phạm, khóa có thời hạn, từ cấm, công tắc tắt toàn hệ thống (đã được cảnh báo rủi ro giấy phép mạng xã hội).

## 18. Giới hạn đã biết

- Hai rủi ro pháp lý ở mục 10 chặn phát hành lên môi trường thật cho đến khi có ý kiến luật sư.
