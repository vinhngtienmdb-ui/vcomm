# CONG_VIEC_63: Mở rộng kinh doanh phần 3 – Trợ lý AI (MODULE_16)

- Mô tả: Trợ lý AI cho nhân viên nội bộ: hỏi đáp số liệu kinh doanh bằng lời (chỉ đọc, qua các dịch vụ đã có, đúng quyền của người hỏi) và soạn nháp nội dung sản phẩm để nhân viên sửa, tự lưu. Quản trị công ty bật từng tính năng, đặt hạn mức chi phí tháng và số lượt mỗi người mỗi ngày. Che dữ liệu cá nhân trước khi gửi ra mô hình; lưu hội thoại 90 ngày; đánh giá đúng, sai; nhật ký token, chi phí từng lượt.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-17
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả, bản mẫu giao diện, chia lát.
- Mức: Lớn (chức năng mới, dịch vụ ngoài mới, thư viện mới, dữ liệu cá nhân ra nước ngoài, thêm quyền).
- Nhánh: `chuc-nang/CONG_VIEC_63-tro-ly-ai`.
- Nguồn: tài liệu `01` mục 4 (MODULE_16), `04` mục 8 dòng 12, `05` mục 1 (MODULE_16), `24` THAY_DOI_04 (nguồn tham khảo `vcomm_ai_integration_guide.md` của V-com-ERP, chưa đọc được – mục 16); quyết định của người dùng ngày 2026-11-17 (mục 17).
- Các phần khác của MODULE_16: Open API (CONG_VIEC_61, 66), Dropship (CONG_VIEC_62); quản lý sản xuất bỏ theo THAY_DOI_30.

## 1. Mục tiêu

Nhân viên hỏi số liệu bằng câu tiếng Việt thay vì tự mở và lọc nhiều báo cáo; nhân viên phụ trách sản phẩm có bản nháp mô tả nhanh hơn. Công ty kiểm soát được ai dùng, tốn bao nhiêu, dữ liệu nào ra ngoài.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_226 đến CHUC_NANG_229, ba lát L1 đến L3 (mục 19). Chỉ ứng dụng web cho nhân viên.

Ngoài phạm vi:

- Người mua, nhà bán, đối tác dùng trợ lý (người dùng chọn chỉ nhân viên nội bộ ở bản đầu).
- Trợ lý ghi dữ liệu (tạo đơn, duyệt, sửa giá…): trợ lý chỉ đọc và soạn nháp; người dùng tự bấm lưu ở màn hình nghiệp vụ hiện có.
- Truy vấn cơ sở dữ liệu tự do (SQL do mô hình viết), đọc tệp đính kèm, hỏi đáp tài liệu nội bộ tải lên, tìm kiếm theo nghĩa (vector).
- Gợi ý trả lời khách (chăm sóc khách hàng chưa làm), gợi ý sản phẩm cho người mua.
- Ứng dụng di động, ứng dụng kho.
- Sinh, sửa ảnh sản phẩm; dịch nội dung sang tiếng Anh.
- Dữ liệu nhân sự, lương: không có công cụ đọc.

## 3. Yêu cầu nghiệp vụ

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_177 | Nhân viên hỏi bằng lời về doanh số, tồn kho, công nợ, hoa hồng, đơn bán, sản phẩm; nhận câu trả lời ghi rõ lấy từ báo cáo nào, khoảng thời gian nào; chỉ trong phạm vi dữ liệu người hỏi được xem | Nhân viên có quyền xem các báo cáo, dữ liệu đó |
| YCAU_NGHIEPVU_178 | Nhân viên phụ trách sản phẩm nhờ AI soạn nháp mô tả sản phẩm, mô tả đăng bán, điểm nổi bật; sửa rồi tự lưu như hiện nay | Nhân viên quản lý sản phẩm |
| YCAU_NGHIEPVU_179 | Quản trị công ty bật, tắt từng tính năng; đặt hạn mức chi phí mỗi tháng của công ty và số lượt mỗi người mỗi ngày; vượt hạn mức tháng thì khóa đến tháng sau và báo quản trị | Quản trị công ty |
| YCAU_NGHIEPVU_180 | Điện thoại, email, số định danh, số tài khoản được che trước khi gửi ra mô hình; người dùng đọc và xác nhận thông báo xử lý dữ liệu cá nhân trước lần dùng đầu; công ty có hồ sơ chuyển dữ liệu ra nước ngoài | Quản trị công ty, Nhân viên |
| YCAU_NGHIEPVU_181 | Hội thoại lưu 90 ngày; người hỏi xem lại, xóa hội thoại của mình; quản trị chỉ xem thống kê, không xem nội dung | Nhân viên, Quản trị công ty |
| YCAU_NGHIEPVU_182 | Người dùng đánh giá đúng, sai từng câu trả lời; công ty theo dõi token, chi phí từng lượt | Nhân viên, Quản trị công ty |
| YCAU_NGHIEPVU_183 | Đổi nhà cung cấp, mô hình mà không sửa chức năng nghiệp vụ; kiểm thử không gọi dịch vụ thật | Quản trị hệ thống, đội phát triển |

## 4. Chức năng

| Mã | Chức năng | Yêu cầu | Màn hình | API | Lát |
|---|---|---|---|---|---|
| CHUC_NANG_226 | Nền trợ lý: lớp kết nối mô hình trung lập (Anthropic, giả lập), che dữ liệu cá nhân, kiểm hạn mức, ghi nhật ký lượt; cài đặt công ty; thông báo xử lý dữ liệu cá nhân | YCAU_NGHIEPVU_179, 180, 182, 183 | MAN_HINH_244 | API_273, API_278 | L1 |
| CHUC_NANG_227 | Hỏi đáp số liệu: hội thoại, gọi công cụ đọc dữ liệu theo quyền người hỏi, trả lời dạng dòng chảy, ghi nguồn | YCAU_NGHIEPVU_177, 180 | MAN_HINH_242 | API_274, API_275 | L2 |
| CHUC_NANG_228 | Soạn nháp nội dung sản phẩm | YCAU_NGHIEPVU_178 | MAN_HINH_243 | API_277 | L3 |
| CHUC_NANG_229 | Lịch sử, xóa hội thoại, tự xóa sau 90 ngày; đánh giá đúng, sai; thống kê sử dụng, chi phí | YCAU_NGHIEPVU_181, 182 | MAN_HINH_242, MAN_HINH_245 | API_274, API_276, API_279 | L2, L3 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| QUYTAC_NGHIEPVU_510 | Tính năng dùng được khi đủ bốn điều kiện: (1) máy chủ đã cấu hình nhà cung cấp (biến môi trường); (2) công ty bật tính năng đó; (3) hạn mức tháng của công ty lớn hơn 0 (mặc định 0 là tắt) và chưa dùng hết; (4) người dùng có quyền của tính năng và đã xác nhận thông báo xử lý dữ liệu cá nhân phiên bản hiện hành. Thiếu điều kiện nào thì nút trợ lý ẩn (1, 2, 4 khi không có quyền) hoặc hiện lý do (3, 4 khi chưa xác nhận) |
| QUYTAC_NGHIEPVU_511 | Cài đặt công ty: bật Hỏi đáp số liệu, bật Soạn nội dung sản phẩm (mặc định tắt cả hai); hạn mức tháng bằng USD (0 đến 10.000, hai chữ số thập phân, mặc định 0); số lượt mỗi người mỗi ngày (1 đến 500, mặc định 30); sửa dùng khóa lạc quan `version`, ghi nhật ký thao tác |
| QUYTAC_NGHIEPVU_512 | Chi phí một lượt = token đầu vào × đơn giá đầu vào + token đọc bộ nhớ đệm × đơn giá đọc đệm + token ghi đệm × đơn giá ghi đệm + token đầu ra × đơn giá đầu ra; đơn giá USD mỗi triệu token theo mô hình, cấu hình bằng biến môi trường (mục 15). Lượt gồm mọi lần gọi mô hình để trả lời một câu hỏi (kể cả các vòng gọi công cụ) |
| QUYTAC_NGHIEPVU_513 | Kỳ hạn mức là tháng dương lịch theo giờ Việt Nam. Trước mỗi lượt: tổng chi phí tháng của công ty ≥ hạn mức thì từ chối `409 AI_QUOTA_EXCEEDED` tới ngày 1 tháng sau; số lượt hôm nay của người dùng ≥ giới hạn thì `409 AI_DAILY_LIMIT` tới 0 giờ hôm sau. Lượt đang chạy được làm hết dù vượt (mỗi lượt có trần token, mục 15). Lần đầu tổng chi phí tháng vượt hạn mức: gửi thông báo trong ứng dụng cho người có `ai.settings.manage` của công ty, mỗi tháng một lần. Quản trị tăng hạn mức thì mở lại ngay |
| QUYTAC_NGHIEPVU_514 | Che dữ liệu cá nhân trước khi gửi mô hình, áp cho câu hỏi người dùng, kết quả công cụ, dữ liệu sản phẩm: (a) theo tên trường trong kết quả công cụ: mọi trường điện thoại, email, số định danh (CCCD, CMND, hộ chiếu), số tài khoản ngân hàng thay bằng nhãn `[ĐIỆN THOẠI]`, `[EMAIL]`, `[SỐ ĐỊNH DANH]`, `[SỐ TÀI KHOẢN]`; (b) theo mẫu trong văn bản tự do: số điện thoại Việt Nam (di động, cố định, có hoặc không `+84`, có dấu cách, chấm, gạch), email, dãy 9 hoặc 12 chữ số đứng riêng, dãy 6 đến 19 chữ số đứng sau các từ "số tài khoản", "STK", "tài khoản số". Che một chiều, không khôi phục; câu trả lời hiển thị nhãn che. Tên người, địa chỉ không che (mục 16) |
| QUYTAC_NGHIEPVU_515 | Thông báo xử lý dữ liệu cá nhân có số phiên bản; người dùng xác nhận một lần cho mỗi phiên bản (lưu thời điểm). Nội dung tối thiểu: dữ liệu nào được gửi, gửi tới nhà cung cấp nào ở nước nào, đã che gì, lưu bao lâu, nhà cung cấp không dùng để huấn luyện mô hình (theo điều khoản thương mại của nhà cung cấp – mục 16), quyền xóa hội thoại. Đổi nhà cung cấp hoặc nội dung thì tăng phiên bản, mọi người xác nhận lại |
| QUYTAC_NGHIEPVU_516 | Công cụ đọc dữ liệu của hỏi đáp (chỉ đọc, gọi dịch vụ hiện có bằng chính tác nhân `Actor` của người hỏi, kể cả công ty đang chọn): báo cáo bán hàng, tồn kho, công nợ, hoa hồng, tổng quan (MODULE_15); danh sách, chi tiết đơn bán; danh sách, chi tiết sản phẩm; tồn theo biến thể, kho. Công cụ chỉ đưa vào yêu cầu khi người hỏi có quyền xem tương ứng; dịch vụ vẫn tự kiểm quyền, phạm vi công ty, chi nhánh như màn hình hiện có. Không có công cụ ghi; không có công cụ nhân sự, lương, người mua, điểm thưởng |
| QUYTAC_NGHIEPVU_517 | Mỗi kết quả công cụ cắt tối đa 50 dòng và 20.000 ký tự (báo cho mô hình số dòng bị bỏ); mỗi lượt tối đa 8 lần gọi công cụ; quá thì dừng và trả lời với dữ liệu đã có. Công cụ lỗi quyền, lỗi kiểm tra đầu vào trả về mô hình dạng lỗi để mô hình nói với người dùng, không lộ dữ liệu ngoài quyền |
| QUYTAC_NGHIEPVU_518 | Câu trả lời hỏi đáp: tiếng Việt (theo ngôn ngữ giao diện), ghi nguồn cho mỗi số liệu (tên báo cáo hoặc màn hình, khoảng ngày, công ty); dưới câu trả lời hiện danh sách công cụ đã gọi kèm tham số để người dùng mở đúng màn hình kiểm tra. Không có công cụ phù hợp thì nói không trả lời được, không đoán số. Mô hình từ chối (`refusal`) thì hiện "Trợ lý không trả lời câu hỏi này" |
| QUYTAC_NGHIEPVU_519 | Hội thoại thuộc một người dùng và một công ty; chỉ người tạo xem, tiếp tục, xóa. Mỗi người một lượt đang chạy tại một thời điểm (`409 AI_BUSY`). Tối đa 40 tin nhắn mỗi hội thoại; dài hơn thì yêu cầu mở hội thoại mới. Tin nhắn lưu bản đã che (đúng như gửi mô hình) và câu trả lời, danh sách công cụ đã gọi (tên, tham số), không lưu kết quả công cụ |
| QUYTAC_NGHIEPVU_520 | Tác vụ nền hằng ngày xóa hẳn tin nhắn, đánh giá kèm theo, hội thoại có tin nhắn cuối quá 90 ngày. Người dùng xóa hội thoại thì xóa hẳn ngay. Nhật ký lượt (token, chi phí, không nội dung) giữ 24 tháng để thống kê, đối chiếu hóa đơn nhà cung cấp |
| QUYTAC_NGHIEPVU_521 | Đánh giá: người hỏi chọn Đúng hoặc Sai cho câu trả lời của mình, Sai kèm lý do chọn sẵn (sai số liệu, không đúng ý, thiếu dữ liệu, khác) và ghi chú tùy chọn tối đa 500 ký tự; đổi được, một đánh giá mỗi câu trả lời. Thống kê chỉ đếm số Đúng, Sai theo lý do; không ai ngoài người hỏi đọc được ghi chú, nội dung |
| QUYTAC_NGHIEPVU_522 | Soạn nội dung sản phẩm: đầu vào là dữ liệu đang có trên biểu mẫu sản phẩm (tên, danh mục, thương hiệu, xuất xứ, đơn vị, biến thể, thuộc tính, mô tả cũ) cùng giọng văn (Chuyên nghiệp, Thân thiện, Ngắn gọn), độ dài (Ngắn khoảng 80 từ, Vừa khoảng 200 từ, Dài khoảng 400 từ), từ khóa muốn nhắc (tối đa 10). Kết quả có cấu trúc: mô tả sản phẩm, mô tả đăng bán (tối đa 5.000 ký tự), 3 đến 6 điểm nổi bật. Không bịa thông số không có trong đầu vào (ghi "[cần bổ sung]"). Kết quả chỉ điền vào biểu mẫu khi người dùng bấm Dùng; lưu qua chức năng sản phẩm hiện có |
| QUYTAC_NGHIEPVU_523 | Soạn nội dung cần cả `ai.product_content.use` và quyền sửa sản phẩm hiện có của công ty; chỉ sản phẩm của công ty (không sản phẩm của nhà bán). Lần lưu sản phẩm sau khi dùng nội dung AI ghi thêm "có nội dung do AI soạn" vào nhật ký thao tác |

## 6. Vai trò và quyền

| Quyền | Mini app | Phạm vi gán | Nhạy cảm | Gán sẵn |
|---|---|---|---|---|
| `ai.chat.use` | Nền tảng | Công ty | Không | Quản trị tập đoàn, Quản trị công ty |
| `ai.product_content.use` | Nền tảng | Công ty | Không | Quản trị tập đoàn, Quản trị công ty |
| `ai.settings.manage` | Nền tảng | Công ty | Có | Quản trị tập đoàn, Quản trị công ty |
| `ai.usage.view` | Nền tảng | Công ty | Không | Quản trị tập đoàn, Quản trị công ty |

Vai trò khác: quản trị công ty tự gán `ai.chat.use`, `ai.product_content.use` cho vai trò hoặc người cần dùng (mặc định không gán, để công ty chủ động kiểm soát chi phí).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Có `ai.chat.use` | Có `ai.product_content.use` và quyền sửa sản phẩm | Có `ai.usage.view` |
|---|---|---|---|---|---|
| CHUC_NANG_226 Sửa cài đặt | Mọi công ty | Công ty mình | Không | Không | Không |
| CHUC_NANG_227 Hỏi đáp | Có | Có | Có, dữ liệu theo quyền của mình | Không | Không |
| CHUC_NANG_228 Soạn nội dung | Có | Có | Không | Có | Không |
| CHUC_NANG_229 Hội thoại, đánh giá | Chỉ của mình | Chỉ của mình | Chỉ của mình | — | Không |
| CHUC_NANG_229 Thống kê | Mọi công ty | Công ty mình | Không | Không | Công ty được gán (không nội dung) |

## 7. Luồng nghiệp vụ

Luồng 60 (trợ lý AI):

```mermaid
flowchart LR
  A[Quản trị bật tính năng, nhập hạn mức MAN_HINH_244] --> B[Nhân viên mở trợ lý MAN_HINH_242]
  B --> C{Đã xác nhận thông báo?}
  C -- Chưa --> D[Hộp thông báo, bấm Đồng ý] --> E
  C -- Rồi --> E{Còn hạn mức tháng, lượt hôm nay?}
  E -- Không --> F[Báo đã hết, ngày mở lại]
  E -- Có --> G[Che dữ liệu câu hỏi, gửi mô hình kèm công cụ theo quyền]
  G --> H{Mô hình gọi công cụ?}
  H -- Có --> I[Gọi dịch vụ hiện có bằng Actor người hỏi, cắt, che kết quả] --> G
  H -- Không --> J[Trả lời dòng chảy, nguồn, công cụ đã gọi]
  J --> K[Ghi nhật ký lượt: token, chi phí]
  K --> L{Tổng tháng vượt hạn mức lần đầu?}
  L -- Có --> M[Thông báo quản trị]
  J --> N[Người dùng đánh giá Đúng, Sai]
```

Soạn nội dung: Biểu mẫu sản phẩm → Soạn bằng AI (MAN_HINH_243) → chọn giọng, độ dài, từ khóa → kiểm hạn mức (như trên) → kết quả ba phần → Dùng (điền biểu mẫu) hoặc Viết lại → người dùng bấm Lưu của biểu mẫu.

Ngoại lệ: nhà cung cấp lỗi, quá tải, hết thời gian → báo "Trợ lý tạm thời không phản hồi, thử lại sau", ghi nhật ký lượt trạng thái lỗi (chi phí theo token đã báo, nếu có); người dùng rời trang giữa lượt → máy chủ vẫn hoàn tất, lưu câu trả lời để xem lại.

## 8. Màn hình

| Mã | Tên | Mini app | Nội dung | Bản mẫu |
|---|---|---|---|---|
| MAN_HINH_242 | Ngăn trợ lý AI | Mọi mini app web (nút ở thanh trên, dùng chung `packages/ui`) | Ngăn bên phải: danh sách hội thoại của tôi (90 ngày), hội thoại đang mở, ô hỏi, câu hỏi gợi ý; câu trả lời dòng chảy kèm "Dữ liệu từ" (công cụ đã gọi, liên kết màn hình); nút Đúng, Sai; số lượt còn hôm nay; hộp thông báo xử lý dữ liệu cá nhân lần đầu; trạng thái hết hạn mức, tắt, lỗi | `ban_mau/MAN_HINH_242_TRO_LY_AI.html` |
| MAN_HINH_243 | Soạn nội dung sản phẩm bằng AI | Sản phẩm (ngăn kéo trong biểu mẫu sản phẩm) | Chọn giọng văn, độ dài, từ khóa; xem trước ba phần; Dùng từng phần hoặc tất cả, Viết lại; nhắc kiểm tra "[cần bổ sung]" | `ban_mau/MAN_HINH_243_SOAN_NOI_DUNG_AI.html` |
| MAN_HINH_244 | Cài đặt trợ lý AI | Nền tảng (menu Trợ lý AI) | Bật, tắt từng tính năng; hạn mức tháng USD (kèm quy đổi tham khảo VND theo tỷ giá hiện có); lượt mỗi người mỗi ngày; mô hình đang dùng (chỉ đọc); thông báo xử lý dữ liệu cá nhân (chỉ đọc, phiên bản) | `ban_mau/MAN_HINH_244_CAI_DAT_TRO_LY_AI.html` |
| MAN_HINH_245 | Thống kê sử dụng trợ lý AI | Nền tảng | Chi phí tháng / hạn mức, theo ngày; số lượt, token theo tính năng; số người dùng; xếp hạng người dùng theo số lượt, chi phí (không nội dung); tỷ lệ Đúng, Sai theo lý do; lọc tháng | `ban_mau/MAN_HINH_245_THONG_KE_TRO_LY_AI.html` |

MAN_HINH_246 đến 249 không dùng, trả phiên điều phối.

## 9. Dữ liệu

Schema mới `ai`.

| Database migration | Bảng, cột | Nội dung |
|---|---|---|
| 0136 (L1) | `ai.settings` | `company_id` (khóa chính), `chat_enabled`, `product_content_enabled` (mặc định `false`), `monthly_budget_usd` (`numeric(9,2)`, 0 đến 10.000, mặc định 0), `daily_turns_per_user` (1 đến 500, mặc định 30), `quota_notified_month` (`date`, tháng đã báo vượt), `updated_by`, `updated_at`, `version` |
| 0136 (L1) | `ai.notice_acknowledgements` | (`user_id`, `notice_version`) khóa chính, `acknowledged_at` |
| 0136 (L1) | `ai.usage_events` | `id` (`bigserial`), `company_id`, `user_id`, `feature` (`chat`, `product_content`), `conversation_id` (trống được, không khóa ngoại để giữ sau khi xóa hội thoại), `product_id` (trống được), `provider`, `model`, `input_tokens`, `cache_read_tokens`, `cache_write_tokens`, `output_tokens`, `tool_calls` (số lần), `cost_usd` (`numeric(12,6)`), `status` (`ok`, `refusal`, `error`, `max_tokens`), `duration_ms`, `created_at`. Chỉ mục (`company_id`, `created_at`), (`user_id`, `created_at`). Không có nội dung |
| 0136 (L1) | `core.permissions` | Bốn quyền mục 6; gán Quản trị tập đoàn, Quản trị công ty theo cách các database migration trước |
| 0137 (L2) | `ai.conversations` | `id`, `company_id`, `user_id`, `title` (≤ 100 ký tự, lấy từ câu hỏi đầu đã che), `message_count`, `last_message_at`, `created_at`. Chỉ mục (`user_id`, `company_id`, `last_message_at`) |
| 0137 (L2) | `ai.messages` | `id`, `conversation_id` (xóa theo hội thoại), `role` (`user`, `assistant`), `content` (đã che, ≤ 20.000 ký tự), `tool_calls` (`jsonb`: tên, tham số; không kết quả), `status` (`ok`, `refusal`, `error`, `max_tokens`), `usage_event_id`, `created_at` |
| 0137 (L2) | `ai.feedback` | `message_id` (khóa chính, xóa theo tin nhắn), `user_id`, `rating` (`up`, `down`), `reason` (`wrong_figures`, `not_relevant`, `missing_data`, `other`; bắt buộc khi `down`), `note` (≤ 500), `updated_at` |
| 0138 | Dự phòng | Chưa dùng; trả phiên điều phối nếu không cần |
| 0139 | Dự phòng | Như trên |

Thống kê Đúng, Sai đếm từ `ai.feedback` còn giữ (90 ngày, mục 16); nhật ký lượt không chứa đánh giá.

## 10. API

Gốc `/api/v1`, đăng nhập như hiện có, theo công ty đang chọn (`X-Company-Id`).

| Mã | Phương thức, đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| API_273 | `GET /ai/me`, `POST /ai/me/acknowledge` | Đăng nhập | Trạng thái của tôi: tính năng dùng được và lý do nếu không (QUYTAC_NGHIEPVU_510), lượt còn hôm nay, công ty đã hết hạn mức tháng chưa (không trả số tiền cho người không có `ai.usage.view`), phiên bản thông báo và nội dung, đã xác nhận chưa; xác nhận thông báo (`noticeVersion`) |
| API_274 | `GET /ai/conversations`, `GET /ai/conversations/{id}`, `DELETE /ai/conversations/{id}` | `ai.chat.use` | Danh sách hội thoại của tôi (phân trang 20), chi tiết kèm tin nhắn, đánh giá; xóa hẳn |
| API_275 | `POST /ai/conversations/messages` | `ai.chat.use` | Gửi câu hỏi (`conversationId` trống thì tạo hội thoại mới; `content` 1 đến 2.000 ký tự). Kết quả dòng sự kiện máy chủ (`text/event-stream`): `conversation`, `tool` (tên công cụ đang gọi, để hiện "Đang xem báo cáo bán hàng…"), `delta` (chữ), `done` (mã tin nhắn, trạng thái, lượt còn), `error` (mã lỗi). Lỗi trước khi bắt đầu dòng trả mã HTTP thường: `409 AI_QUOTA_EXCEEDED`, `409 AI_DAILY_LIMIT`, `409 AI_BUSY`, `409 AI_NOTICE_REQUIRED`, `403 AI_FEATURE_DISABLED`, `503 AI_NOT_CONFIGURED` |
| API_276 | `PUT /ai/messages/{id}/feedback`, `DELETE /ai/messages/{id}/feedback` | `ai.chat.use`, tin nhắn của mình | Đánh giá Đúng, Sai (QUYTAC_NGHIEPVU_521); bỏ đánh giá |
| API_277 | `POST /ai/product-content` | `ai.product_content.use` và quyền sửa sản phẩm | Đầu vào: `productId` (trống khi sản phẩm chưa lưu) và dữ liệu biểu mẫu, `tone`, `length`, `keywords[]`. Kết quả JSON: `description`, `listingDescription`, `highlights[]`, `missing[]` (thông số cần bổ sung), `remainingTurns`. Lỗi hạn mức như API_275 |
| API_278 | `GET`, `PATCH /ai/settings` | Xem: `ai.settings.manage` hoặc `ai.usage.view`; sửa: `ai.settings.manage` | Cài đặt công ty (QUYTAC_NGHIEPVU_511) kèm `provider`, `model` đang cấu hình (chỉ đọc), `configured` (máy chủ có khóa chưa; không trả khóa), phiên bản thông báo |
| API_279 | `GET /ai/usage` | `ai.usage.view` hoặc `ai.settings.manage` | Thống kê theo tháng (`month=YYYY-MM`): tổng chi phí, hạn mức, theo ngày, theo tính năng, theo người dùng (tên, số lượt, token, chi phí), số Đúng, Sai theo lý do; xuất Excel dùng cách hiện có của báo cáo |
| API_280 | Dự phòng | — | Trả phiên điều phối nếu không cần |

Mã lỗi thêm vào tài liệu `17` mục 1: `409 AI_QUOTA_EXCEEDED`, `409 AI_DAILY_LIMIT`, `409 AI_BUSY`, `409 AI_NOTICE_REQUIRED`, `403 AI_FEATURE_DISABLED`, `503 AI_NOT_CONFIGURED`, `502 AI_PROVIDER_ERROR`.

## 11. Dùng lại mã đã có

| Việc | Mã dùng lại | Thay đổi cần thiết |
|---|---|---|
| Dữ liệu báo cáo | `analytics/*-report.service.ts`, `overview.service.ts`, `analytics-scope.service.ts` (`report(actor, query)`) | Không sửa; công cụ gọi với `Actor` người hỏi, đầu vào kiểm bằng lược đồ `zod` hiện có của báo cáo |
| Đơn bán, sản phẩm, tồn | `SalesOrdersService.list`, `detail`; `ProductsService.list`, `detail`; `StockService.list`, `detail` | Không sửa |
| Kiểm quyền | `PermissionService` | Hàm lấy tập quyền của người hỏi để lọc công cụ |
| Giới hạn | `common/rate-limiter.ts` | Không dùng cho hạn mức (đếm từ `ai.usage_events`); khóa "một lượt mỗi người" dùng Redis (`SET NX` có hạn 3 phút) |
| Nhật ký thao tác | `common/audit.service.ts` | Sửa cài đặt; ghi "có nội dung do AI soạn" khi lưu sản phẩm |
| Thông báo trong ứng dụng | `common/notifications.ts` | Báo vượt hạn mức |
| Tỷ giá tham khảo | `settings/exchange-rates.service.ts` | Quy đổi USD sang VND để hiển thị |
| Tác vụ nền | `jobs/background-jobs.ts` | Thêm `ai-conversation-retention` (`30 1 * * *`, giờ Việt Nam) |
| Xuất Excel | `analytics/analytics-export.ts` | Bảng thống kê sử dụng |
| Giao diện | `packages/ui` (AppShell, Drawer, Field, StatusBadge, StatusViews, format) | AppShell thêm chỗ đặt nút, ngăn trợ lý; không thêm thư viện giao diện. Hiển thị câu trả lời dạng văn bản có xuống dòng, danh sách, bảng đơn giản; không hiển thị HTML |

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_63 – 2026-11-17

- Yêu cầu cần đáp ứng: YCAU_NGHIEPVU_177 đến 183.
- Nguồn đã tìm: mã nguồn dự án (không có tích hợp mô hình ngôn ngữ nào); nguồn riêng V-com-ERP (chưa đọc được, mục 16); thư viện, dịch vụ công cộng.

| Ứng viên | Nguồn | Giấy phép | Tương thích | Công sức |
|---|---|---|---|---|
| `@anthropic-ai/sdk` 1.4.0 (phát hành 2026-11-02) | npm, Anthropic | Apache-2.0 (đã đọc tệp `LICENSE` trong gói); phụ thuộc: `standardwebhooks` MIT, `json-schema-to-ts` MIT, `@opentelemetry/api` Apache-2.0 | TypeScript, Node.js; có dòng chảy, gọi công cụ, kết quả có cấu trúc, lớp lỗi có kiểu | Thấp. Người dùng đã chọn (2026-11-17) |
| Vercel AI SDK (`ai`) | npm | Chưa xác minh | Nhiều nhà cung cấp | Không dùng: người dùng chọn SDK chính hãng, lớp trung lập tự viết mỏng |
| Microsoft Presidio | GitHub | MIT | Python, không hỗ trợ sẵn tiếng Việt, thêm dịch vụ | Không dùng; tự viết bộ che bằng mẫu và tên trường (TypeScript, một tệp) |
| pgvector | PostgreSQL, RDS | Chưa xác minh | Có trên RDS | Không cần (không hỏi đáp tài liệu) |
| Hạ tầng dự án: báo cáo, quyền, Redis, BullMQ, thông báo, nhật ký thao tác, `packages/ui` | Dự án | Của dự án | Đầy đủ | Thấp |

- Phương án: dùng lại có điều chỉnh (hạ tầng dự án) + thư viện `@anthropic-ai/sdk` + tự viết lớp trung lập, bộ che, công cụ.
- Thư viện mới: chỉ `@anthropic-ai/sdk` 1.4.0 cho `apps/api` (chọn bản mới nhất đã phát hành ít nhất hai tuần; bản 1.9.0 mới ra 2026-11-16). Chờ người dùng duyệt cùng đặc tả.
- Dịch vụ trả phí mới: API Anthropic, trả theo token; công ty tự đặt hạn mức (mặc định 0, không phát sinh khi chưa bật).

## 13. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Lát |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_470 | Công ty mới: hai tính năng tắt, hạn mức 0; người có quyền không thấy dùng được (`GET /ai/me` nêu lý do); quản trị bật và nhập hạn mức thì dùng được; sửa cài đặt có nhật ký thao tác, xung đột `version` báo lỗi | Bắt buộc | L1 |
| TIEUCHI_NGHIEMTHU_471 | Che dữ liệu: các mẫu điện thoại, email, CCCD, CMND, số tài khoản trong câu hỏi và trong trường kết quả công cụ đều thành nhãn che trước khi tới lớp kết nối; số tiền, số đơn, mã sản phẩm không bị che nhầm | Bắt buộc | L1 |
| TIEUCHI_NGHIEMTHU_472 | Chưa xác nhận thông báo thì gửi câu hỏi nhận `409 AI_NOTICE_REQUIRED`; xác nhận xong dùng được; tăng phiên bản thông báo thì phải xác nhận lại | Bắt buộc | L1 |
| TIEUCHI_NGHIEMTHU_473 | Tổng chi phí tháng đạt hạn mức thì lượt mới nhận `409 AI_QUOTA_EXCEEDED`, quản trị nhận đúng một thông báo trong tháng; sang tháng sau hoặc tăng hạn mức thì dùng lại được; người dùng hết lượt hôm nay nhận `409 AI_DAILY_LIMIT`, người khác vẫn dùng được | Bắt buộc | L1 |
| TIEUCHI_NGHIEMTHU_474 | Mỗi lượt (thành công, từ chối, lỗi) có một dòng nhật ký lượt đúng token, chi phí theo đơn giá cấu hình, không có nội dung; kiểm thử chạy bằng bộ giả lập, không gọi mạng | Bắt buộc | L1 |
| TIEUCHI_NGHIEMTHU_475 | Hỏi đáp: người chỉ có quyền báo cáo tồn kho hỏi doanh số thì mô hình không được cấp công cụ bán hàng và trả lời không có quyền; người có quyền nhận số đúng bằng màn hình báo cáo cùng tham số; công ty khác không lộ dữ liệu | Bắt buộc | L2 |
| TIEUCHI_NGHIEMTHU_476 | Câu trả lời chạy dòng chảy, hiện "Dữ liệu từ" với công cụ, tham số đã gọi; quá 8 lần gọi công cụ thì dừng đúng; kết quả công cụ quá 50 dòng bị cắt có ghi chú | Bắt buộc | L2 |
| TIEUCHI_NGHIEMTHU_477 | Hội thoại chỉ người tạo xem, xóa được (người khác `404`); hai câu hỏi cùng lúc của một người thì câu sau `409 AI_BUSY`; tác vụ nền xóa hội thoại có tin nhắn cuối 91 ngày, giữ hội thoại 89 ngày; nhật ký lượt vẫn còn | Bắt buộc | L2 |
| TIEUCHI_NGHIEMTHU_478 | Đánh giá Đúng, Sai lưu, đổi, bỏ được; Sai thiếu lý do báo lỗi; người khác không đánh giá được tin nhắn không phải của mình | Bắt buộc | L2 |
| TIEUCHI_NGHIEMTHU_479 | Soạn nội dung: có đủ ba phần đúng giới hạn độ dài; thông số không có trong đầu vào thành "[cần bổ sung]" (theo bộ giả lập trả mẫu); người thiếu quyền sửa sản phẩm nhận `403`; sản phẩm của nhà bán nhận `404`; Dùng chỉ điền biểu mẫu, chưa lưu; lưu sau đó có ghi chú AI trong nhật ký thao tác | Bắt buộc | L3 |
| TIEUCHI_NGHIEMTHU_480 | Thống kê: tổng chi phí, lượt, token, Đúng, Sai khớp dữ liệu nhật ký; người có `ai.usage.view` không đọc được nội dung hội thoại qua bất kỳ API nào; xuất Excel | Bắt buộc | L3 |
| TIEUCHI_NGHIEMTHU_481 | MAN_HINH_242 đến 245 đủ trạng thái rỗng, đang tải, lỗi, không quyền, tắt, hết hạn mức; tiếng Việt và tiếng Anh; dùng được ở độ rộng 390 điểm ảnh | Bắt buộc | L1, L2, L3 |

## 14. Kịch bản kiểm thử

| Mã | Tiêu chí | Kịch bản | Loại |
|---|---|---|---|
| KICHBAN_KIEMTHU_653 | 470 | Công ty mới đọc cài đặt mặc định; bật, đặt hạn mức; sửa với `version` cũ nhận `409`; nhật ký thao tác | Tích hợp |
| KICHBAN_KIEMTHU_654 | 470 | `GET /ai/me` với từng điều kiện thiếu (chưa cấu hình, tắt, hạn mức 0, không quyền) trả đúng lý do | Tích hợp |
| KICHBAN_KIEMTHU_655 | 471 | Bảng 30 chuỗi mẫu: điện thoại nhiều dạng, email, CCCD, CMND, STK; số tiền "48.600.000", số đơn "DB-2026-001502", mã vạch 13 số không bị che | Đơn vị |
| KICHBAN_KIEMTHU_656 | 471 | Bộ giả lập ghi lại yêu cầu: kết quả công cụ có trường `phone`, `email` của khách tới mô hình đã là nhãn che | Tích hợp |
| KICHBAN_KIEMTHU_657 | 472 | Gửi khi chưa xác nhận `409`; xác nhận; tăng phiên bản cấu hình thì `409` lại | Tích hợp |
| KICHBAN_KIEMTHU_658 | 473 | Hạn mức 0,10 USD, bộ giả lập trả token để mỗi lượt 0,06 USD: lượt 1, 2 chạy, lượt 3 `409`; một thông báo; đổi đồng hồ sang tháng sau dùng lại; tăng hạn mức dùng lại | Tích hợp |
| KICHBAN_KIEMTHU_659 | 473, 474 | Giới hạn 2 lượt mỗi ngày: lượt 3 `409 AI_DAILY_LIMIT`, người khác vẫn được; mỗi lượt một dòng nhật ký đúng chi phí; trạng thái `refusal`, `error` từ bộ giả lập cũng ghi | Tích hợp |
| KICHBAN_KIEMTHU_660 | 475 | Bộ giả lập yêu cầu gọi công cụ báo cáo bán hàng: so kết quả công cụ với `GET /analytics/sales` cùng tham số; người chỉ có quyền tồn kho: danh sách công cụ gửi mô hình không có báo cáo bán hàng | Tích hợp |
| KICHBAN_KIEMTHU_661 | 476 | Đọc dòng sự kiện: thứ tự `conversation`, `tool`, `delta`, `done`; bộ giả lập gọi công cụ 9 lần thì dừng ở 8; kết quả 120 dòng cắt còn 50 | Tích hợp |
| KICHBAN_KIEMTHU_662 | 477 | Người B đọc, xóa hội thoại của A `404`; hai yêu cầu song song `409 AI_BUSY`; tác vụ dọn với đồng hồ giả: 91 ngày xóa, 89 ngày giữ, nhật ký lượt còn | Tích hợp |
| KICHBAN_KIEMTHU_663 | 478 | Đánh giá Đúng, đổi Sai có lý do, Sai không lý do `422`, bỏ đánh giá; người khác `404` | Tích hợp |
| KICHBAN_KIEMTHU_664 | 479 | Soạn nội dung với bộ giả lập trả kết quả có cấu trúc; kiểm độ dài, "[cần bổ sung]"; thiếu quyền `403`; sản phẩm nhà bán `404`; lưu sản phẩm có cờ AI thì nhật ký thao tác ghi chú | Tích hợp |
| KICHBAN_KIEMTHU_665 | 480 | Tạo nhật ký lượt, đánh giá mẫu cho hai người, hai tính năng; so số liệu `GET /ai/usage`; người có `ai.usage.view` gọi API_274 với hội thoại người khác `404`; tải Excel | Tích hợp |
| KICHBAN_KIEMTHU_666 | 481 | Playwright với máy chủ dùng bộ giả lập: mở ngăn, xác nhận thông báo, hỏi, đánh giá; soạn nội dung, Dùng; cài đặt, thống kê; sáu trạng thái; đổi ngôn ngữ; 1360 và 390 điểm ảnh | Giao diện |

## 15. Ràng buộc kỹ thuật

- Lớp kết nối trung lập `apps/api/src/ai/model-client.ts`: giao diện `AiModelClient` (gửi tin nhắn kèm công cụ, nhận dòng chữ, lời gọi công cụ, token, lý do dừng; gọi lấy kết quả có cấu trúc). Hai cài đặt: `AnthropicModelClient` (dùng `@anthropic-ai/sdk`), `FakeModelClient` (kịch bản trả lời định trước, ghi lại yêu cầu để kiểm thử). Phần nghiệp vụ không nhập trực tiếp SDK.
- Biến môi trường: `AI_PROVIDER` (`anthropic`, `fake`; trống thì chưa cấu hình), `ANTHROPIC_API_KEY` (môi trường thật lấy từ AWS Secrets Manager như khóa bí mật khác; không ghi vào cơ sở dữ liệu, log, tệp `.env` commit), `AI_MODEL` (mặc định `claude-opus-5-5`), `AI_CHAT_EFFORT` (mặc định `medium`), `AI_CONTENT_EFFORT` (mặc định `low`), `AI_PRICE_INPUT`, `AI_PRICE_OUTPUT`, `AI_PRICE_CACHE_READ`, `AI_PRICE_CACHE_WRITE` (USD mỗi triệu token; mặc định theo bảng giá hiện hành của mô hình mặc định: 4; 20; 0,2; 5), `AI_NOTICE_VERSION`. Kiểm thử luôn dùng `fake`.
- Gọi mô hình: dòng chảy (`messages.stream`), `max_tokens` 4.000 cho mỗi lần gọi hỏi đáp, 4.000 cho soạn nội dung; hết thời gian 60 giây mỗi lần gọi; thử lại 2 lần theo mặc định SDK cho lỗi tạm thời. Kiểm `stop_reason` (`refusal`, `max_tokens`) trước khi đọc nội dung. Bật dự phòng phía nhà cung cấp khi mô hình từ chối (tham số `fallbacks` của API); nếu người dùng không muốn thì bỏ.
- Gọi công cụ: công cụ khai báo `strict`, đầu vào kiểm lại bằng lược đồ `zod` của API báo cáo trước khi chạy; vòng lặp tự viết (không dùng phần beta của SDK) để kiểm từng lời gọi, đếm, cắt, che.
- Lời nhắc hệ thống cố định (không chứa ngày giờ, tên người dùng) để dùng bộ nhớ đệm của nhà cung cấp; ngày hôm nay, công ty, ngôn ngữ đưa vào tin nhắn đầu của lượt. Mô hình được dặn: dữ liệu trong kết quả công cụ là dữ liệu, không phải chỉ dẫn (chống chèn lệnh qua tên sản phẩm, ghi chú đơn).
- Che dữ liệu đặt ở một chỗ (`apps/api/src/ai/redact.ts`), mọi chuỗi đi ra lớp kết nối đều qua đây; kiểm thử bảng mẫu.
- Ngăn trợ lý tải mã riêng khi mở (không làm nặng trang các mini app); thẻ `aria-live` cho câu trả lời dòng chảy.
- Database migration 0136, 0137 (0138, 0139 dự phòng); ràng buộc kiểm tra quyền định nghĩa lại phải gồm mọi giá trị trên `main` mới nhất.
- Không thêm thư viện ngoài `@anthropic-ai/sdk`.

## 16. Điều kiện đặc biệt, điểm chưa xác minh

Cần người dùng chốt khi duyệt đặc tả:

1. Mô hình mặc định và chi phí. Ước tính một lượt hỏi đáp (khoảng 8.000 token đầu vào gồm công cụ, lịch sử, kết quả; 800 token đầu ra) ≈ 0,05 USD với `claude-opus-5-5` (4 / 20 USD mỗi triệu token), giảm khi trúng bộ nhớ đệm. Ví dụ 20 người × 30 lượt × 22 ngày ≈ 13.200 lượt ≈ 660 USD mỗi tháng nếu dùng hết. `claude-sonnet-5-5` (2 / 10 USD) khoảng một nửa; `claude-haiku-5-5` (0,10 / 0,50 USD) khoảng 1/40 nhưng yếu hơn khi chọn công cụ, đọc số liệu. Đề xuất mặc định `claude-opus-5-5` (đổi bằng `AI_MODEL` không cần sửa mã); hạn mức tháng của công ty giới hạn chi phí thật. Đơn giá lấy theo bảng giá hiện hành của nhà cung cấp, cần đối chiếu lại khi ký hợp đồng.
2. Đơn vị hạn mức: đề xuất USD (đúng đơn vị nhà cung cấp tính tiền, không lệch tỷ giá), màn hình hiện thêm quy đổi VND tham khảo. Phương án khác: nhập VND, quy đổi theo tỷ giá ngày.
3. Che dữ liệu không gồm tên người và địa chỉ (theo danh sách người dùng chọn). Khách hàng là cá nhân sẽ có tên, địa chỉ gửi ra nhà cung cấp khi hỏi về đơn, công nợ. Đề xuất giữ như đã chọn và ghi rõ trong thông báo; phương án khác là che cả tên khách cá nhân (câu trả lời khó đọc hơn).
4. Hồ sơ chuyển dữ liệu ra nước ngoài, nội dung thông báo xử lý dữ liệu cá nhân: phiên này soạn bản nháp theo dữ liệu thực tế của hệ thống (loại dữ liệu, nơi nhận, thời gian lưu, biện pháp bảo vệ) ở tài liệu `22`; không tra cứu văn bản pháp luật theo quy định chung. Người dùng hoặc tư vấn pháp lý rà và hoàn thiện trước khi bật cho người dùng thật.
5. Điều khoản nhà cung cấp (không dùng dữ liệu API để huấn luyện, thời gian nhà cung cấp giữ dữ liệu, nơi xử lý): ghi theo điều khoản thương mại hiện hành của Anthropic; người dùng xác nhận theo hợp đồng thực tế khi đăng ký khóa.

Điểm khác:

- Chưa đọc `vcomm_ai_integration_guide.md` của V-com-ERP: phiên này không được cấp quyền gắn repo đó. Đặc tả không phụ thuộc tệp này; nếu người dùng muốn đối chiếu thì cấp quyền hoặc dán nội dung.
- Mã còn dư: MAN_HINH_246 đến 249, API_280, database migration 0138, 0139 trả phiên điều phối nếu đặc tả được duyệt như trên.
- Thống kê Đúng, Sai chỉ tính trên đánh giá còn giữ (90 ngày) vì đánh giá xóa theo tin nhắn.
- Khóa API Anthropic do người dùng đăng ký, nạp vào AWS Secrets Manager; cần thêm mục hướng dẫn trong tài liệu `28`. Xem trước dùng bộ giả lập; muốn thử với mô hình thật thì người dùng cấp khóa thử cho môi trường phát triển.
- Câu trả lời của mô hình có thể sai: giao diện ghi "Trợ lý có thể nhầm, kiểm tra ở màn hình nguồn" và luôn có liên kết tới báo cáo nguồn.

## 17. Quyết định của người dùng (2026-11-17)

| Câu hỏi | Quyết định |
|---|---|
| Người dùng | Nhân viên nội bộ |
| Việc trợ lý làm | Hỏi đáp dữ liệu chỉ đọc qua API có sẵn; viết nội dung sản phẩm cho nhân viên duyệt |
| Ghi dữ liệu | Chỉ đọc và soạn nháp, người dùng bấm lưu |
| Phân quyền | Cùng quyền dữ liệu với người hỏi, không SQL tự do |
| Nhà cung cấp | API trực tiếp của Anthropic, khóa riêng trong biến môi trường hoặc kho bí mật; lớp kết nối trung lập; bộ giả lập cho kiểm thử; SDK `@anthropic-ai/sdk` (kiểm giấy phép); mô hình cấu hình bằng biến môi trường |
| Chi phí | Hạn mức tiền mỗi tháng theo công ty, giới hạn lượt mỗi người mỗi ngày; vượt thì khóa đến kỳ sau, báo quản trị; mặc định 0 (tắt), quản trị tự nhập |
| Lưu hội thoại | 90 ngày; quản trị chỉ xem thống kê |
| Dữ liệu cá nhân | Che điện thoại, email, số định danh, số tài khoản; thông báo xử lý dữ liệu cá nhân; hồ sơ chuyển dữ liệu ra nước ngoài |
| Bật, tắt | Quản trị bật từng tính năng, quyền `ai.*` |
| Chất lượng | Nút Đúng, Sai; nhật ký token, chi phí từng lượt |

## 18. Thành phần không được thay đổi

- Cách tính, phạm vi quyền của báo cáo quản trị, đơn bán, sản phẩm, tồn kho (công cụ chỉ gọi).
- Luồng lưu sản phẩm hiện có (chỉ thêm cờ ghi nhật ký).
- Xác thực, phân quyền chung, thanh trên của mini app ngoài chỗ đặt nút trợ lý.

## 19. Các lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L1 | Database migration 0136; thư viện `@anthropic-ai/sdk`; lớp kết nối, bộ giả lập; che dữ liệu; hạn mức, nhật ký lượt, thông báo vượt; API_273, API_278; MAN_HINH_244; hộp thông báo xử lý dữ liệu cá nhân | Ảnh màn hình cài đặt (bật, hạn mức, chưa cấu hình); kết quả bảng kiểm thử che dữ liệu; bản nháp thông báo và hồ sơ chuyển dữ liệu (tài liệu `22`) |
| L2 | Database migration 0137; công cụ đọc dữ liệu; API_274 đến 276; ngăn trợ lý MAN_HINH_242 trong `packages/ui`; tác vụ xóa 90 ngày | Ảnh ngăn trợ lý với bộ giả lập: hỏi doanh số, câu trả lời có nguồn, đánh giá, hết hạn mức; nếu người dùng cấp khóa thử: vài câu hỏi thật trên dữ liệu thử |
| L3 | API_277, MAN_HINH_243 trong biểu mẫu sản phẩm; API_279, MAN_HINH_245; xuất Excel | Ảnh soạn nội dung trước và sau Dùng; ảnh thống kê |

## 20. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.
