# MA TRẬN GIAI ĐOẠN: ĐẦU VÀO – XỬ LÝ – ĐẦU RA – TIÊU CHÍ

Mỗi giai đoạn: đầu vào → kiểm tra đầu vào → xử lý → kiểm tra kết quả → đầu ra → phê duyệt và chuyển giai đoạn.

## Tổng hợp

| Giai đoạn | Đầu vào chính | Đầu ra chính | Điều kiện chuyển tiếp |
|---|---|---|---|
| 01 Ý tưởng | Vấn đề, nhu cầu | Định nghĩa sản phẩm | Vấn đề và mục tiêu rõ |
| 02 Phạm vi | Định nghĩa sản phẩm | Phạm vi | Ranh giới sản phẩm rõ |
| 03 Nghiệp vụ | Phạm vi | Đặc tả nghiệp vụ | Nghiệp vụ đầy đủ |
| 04 Yêu cầu | Đặc tả nghiệp vụ | Yêu cầu chức năng | Triển khai và kiểm thử được |
| 05 Kiến trúc | Yêu cầu | Kiến trúc | Đáp ứng yêu cầu |
| 06 Giao diện | Yêu cầu, luồng nghiệp vụ, vai trò | Đặc tả giao diện, hệ thống thiết kế, bản mẫu | Bản mẫu được duyệt |
| 07 Dữ liệu và API | Yêu cầu, kiến trúc | Đặc tả dữ liệu và API | Hợp đồng API rõ |
| 08 Môi trường AI | Toàn bộ đặc tả | Môi trường phát triển | AI đủ ngữ cảnh |
| 09 Xây dựng | Công việc đã duyệt | Phần mềm chạy được | Có kiểm thử tự động, đạt tự rà soát mã |
| 10 Kiểm thử | Phần mềm chạy được | Kết quả kiểm thử | Đạt chất lượng |
| 11 Nghiệm thu và phát hành | Bản đã kiểm thử | Phiên bản được duyệt | Được nghiệm thu |
| 12 Triển khai | Phiên bản được duyệt | Hệ thống chạy phiên bản mới | Xác nhận sau triển khai đạt |
| 13 Vận hành | Hệ thống thực tế, phản hồi | Cải tiến | Có kiểm soát thay đổi |

## 01. Xác định ý tưởng

- **Đầu vào:** ý tưởng ban đầu, vấn đề, nhu cầu người dùng hoặc tổ chức, bối cảnh, thông tin hiện có.
- **Tiêu chí đầu vào:** xác định được vấn đề, đối tượng liên quan, mục tiêu sơ bộ. Chưa xác định được vấn đề thì không chuyển tiếp.
- **Xử lý:** phân tích vấn đề, xác định mục tiêu, đối tượng sử dụng, giá trị, kết quả cần đạt.
- **Đầu ra (04):** tên sản phẩm, tuyên bố sản phẩm, vấn đề, mục tiêu, đối tượng sử dụng, giá trị, kết quả mong muốn, yêu cầu cấp cao, giới hạn ban đầu.
- **Tiêu chí đầu ra:** rõ ràng, không mâu thuẫn, diễn đạt ngắn gọn được, dùng làm cơ sở phân tích nghiệp vụ được, không chứa yêu cầu kỹ thuật chưa xác định.

## 02. Xác định phạm vi

- **Đầu vào:** tổng quan dự án, mục tiêu, đối tượng sử dụng, yêu cầu ban đầu.
- **Tiêu chí đầu vào:** mục tiêu tương đối rõ, có đối tượng sử dụng, vấn đề, kết quả mong muốn.
- **Xử lý:** xác định phạm vi trong (chức năng bắt buộc, ưu tiên, để sau; đối tượng dữ liệu; người dùng), phạm vi ngoài (chức năng chưa làm, hệ thống chưa tích hợp, yêu cầu không thuộc phiên bản hiện tại), giới hạn phiên bản.
- **Đầu ra (05):** phạm vi sản phẩm, phạm vi chức năng, phạm vi ngoài, phạm vi phiên bản, danh sách ưu tiên.
- **Tiêu chí đầu ra:** trả lời được sản phẩm làm gì, không làm gì, phiên bản hiện tại gồm gì, chức năng nào ưu tiên, ranh giới ở đâu. Không tồn tại chức năng "không rõ thuộc phạm vi hay không". AI không được tự mở rộng phạm vi.

## 03. Phân tích nghiệp vụ

- **Đầu vào:** phạm vi sản phẩm, phạm vi chức năng, danh sách người dùng, thông tin và quy trình nghiệp vụ hiện có.
- **Tiêu chí đầu vào:** xác định được đối tượng nghiệp vụ, nhóm người dùng, phạm vi và mục tiêu nghiệp vụ.
- **Xử lý:** phân tích người dùng (nhóm, vai trò, trách nhiệm, quyền hạn); quy trình (chính, phụ, ngoại lệ, điều kiện bắt đầu, điều kiện kết thúc); quy tắc (điều kiện, ràng buộc, công thức, trạng thái, chuyển trạng thái, ngoại lệ); dữ liệu nghiệp vụ (đầu vào, đầu ra, bắt buộc, tùy chọn, quan hệ); phụ thuộc.
- **Đầu ra (06, 07, 08, 09):** yêu cầu nghiệp vụ, quy tắc nghiệp vụ, vai trò người dùng, luồng nghiệp vụ, đối tượng nghiệp vụ, trạng thái nghiệp vụ, quy tắc ngoại lệ.
- **Tiêu chí đầu ra:** bao phủ toàn bộ nghiệp vụ trong phạm vi; không còn quy tắc quan trọng chưa xác định; xác định được người thực hiện, điều kiện, kết quả, ngoại lệ; không mâu thuẫn nội bộ.

## 04. Đặc tả yêu cầu

- **Đầu vào:** tài liệu `06`, `07`, `08`, `09`.
- **Tiêu chí đầu vào:** nghiệp vụ đủ rõ để chuyển thành yêu cầu chức năng; mâu thuẫn nghiệp vụ đã được giải quyết.
- **Xử lý:** chuyển thành yêu cầu chức năng, yêu cầu phi chức năng, yêu cầu người dùng, yêu cầu hệ thống, tiêu chí nghiệm thu.
- **Đầu ra (10, 11, 27):** mỗi chức năng có mã, tên, mục đích, người sử dụng, điều kiện thực hiện, dữ liệu đầu vào, quy trình xử lý, kết quả đầu ra, quy tắc nghiệp vụ, ngoại lệ, phân quyền, thông báo lỗi, tiêu chí nghiệm thu. Ma trận truy vết có đủ cột yêu cầu, quy tắc, chức năng, tiêu chí nghiệm thu.
- **Tiêu chí đầu ra:** hiểu được mà không cần suy đoán; lập trình, kiểm thử, nghiệm thu được; có tiêu chí đúng sai; mỗi tiêu chí nghiệm thu được đánh dấu Bắt buộc hoặc Mong muốn; không phụ thuộc kiến thức ngầm của người viết; mọi yêu cầu nghiệp vụ trong phạm vi đều truy được tới ít nhất một chức năng và một tiêu chí nghiệm thu trong tài liệu `27`. Chức năng chưa đủ rõ để kiểm tra kết quả thì không được xây dựng.

## 05. Thiết kế kiến trúc hệ thống

- **Đầu vào:** yêu cầu chức năng, yêu cầu phi chức năng, yêu cầu nghiệp vụ, tiêu chí nghiệm thu, ràng buộc kỹ thuật.
- **Tiêu chí đầu vào:** xác định được hệ thống cần làm gì, quy mô, yêu cầu bảo mật, hiệu năng, tích hợp, giới hạn kỹ thuật.
- **Xử lý:** tìm và phân tích giải pháp có sẵn theo mục 16 của SKILL.md (dự án mẫu, framework, thư viện, mã nguồn riêng của người dùng), chờ người dùng quyết định; thiết kế kiến trúc tổng thể (frontend, backend, cơ sở dữ liệu, API, xác thực, phân quyền, lưu trữ tệp, ghi log, giám sát, sao lưu); chọn công nghệ (ngôn ngữ, framework, hệ quản trị cơ sở dữ liệu, thư viện, công cụ xây dựng, công cụ kiểm thử, môi trường triển khai); kiến trúc bảo mật theo phần A của mục 17 trong SKILL.md, tích hợp, triển khai; cấu trúc thư mục theo phần 2 của [CAU_TRUC_THU_MUC.md](CAU_TRUC_THU_MUC.md).
- **Đầu ra (12, 13, 22):** tài liệu kiến trúc, công nghệ sử dụng, kiến trúc thành phần, kiến trúc bảo mật (dữ liệu nhạy cảm, điểm tiếp nhận dữ liệu, xác thực, ma trận phân quyền), kiến trúc triển khai, cấu trúc thư mục, ràng buộc kỹ thuật.
- **Tiêu chí đầu ra:** đáp ứng yêu cầu nghiệp vụ và phi chức năng; mở rộng được, bảo trì được, ổn định, bảo mật, tích hợp được, sao lưu và phục hồi được; có phương án triển khai; không còn quyết định kiến trúc quan trọng chưa xác định.

## 06. Thiết kế giao diện

- **Đầu vào:** yêu cầu chức năng, vai trò người dùng, luồng nghiệp vụ, kiến trúc, yêu cầu thiết kế.
- **Tiêu chí đầu vào:** biết ai sử dụng, cần thực hiện gì, dữ liệu nào hiển thị, quyền nào được thao tác.
- **Xử lý:** theo mục 15 của SKILL.md và [THIET_KE_GIAO_DIEN.md](THIET_KE_GIAO_DIEN.md): 06.1 kiến trúc thông tin → 06.2 khung giao diện → 06.3 hệ thống thiết kế → 06.4 bản mẫu. Bước nào áp dụng cho mức nào theo mục 15; mỗi bước áp dụng có phê duyệt của người dùng.
- **Đầu ra (14, 15, bản mẫu):** danh sách màn hình, sơ đồ điều hướng, bảng vai trò – màn hình, đặc tả màn hình, hệ thống thiết kế, bản mẫu đã duyệt, cột màn hình trong tài liệu `27`.
- **Tiêu chí đầu ra:** mọi chức năng cần giao diện trong phạm vi có màn hình thực hiện; mọi vai trò có màn hình mở đầu; mỗi màn hình đủ trạng thái có dữ liệu, rỗng, đang tải, lỗi, không có quyền; đạt danh sách rà soát giao diện; bản mẫu chỉ dùng giá trị trong tài liệu `15`; người dùng đã duyệt các bước áp dụng theo mức. Giao diện phải dựa trên nghiệp vụ và quyền người dùng.

## 07. Thiết kế dữ liệu và API

- **Đầu vào:** đối tượng nghiệp vụ, yêu cầu chức năng, quy tắc nghiệp vụ, kiến trúc, đặc tả giao diện.
- **Tiêu chí đầu vào:** xác định được đối tượng dữ liệu, quan hệ, quy tắc dữ liệu, nhu cầu truy xuất và trao đổi dữ liệu.
- **Xử lý:**
  - Dữ liệu: bảng, trường, kiểu dữ liệu, khóa chính, khóa ngoại, quan hệ, ràng buộc, chỉ mục, trạng thái, lịch sử thay đổi, chính sách xóa dữ liệu.
  - API: endpoint, phương thức, dữ liệu gửi lên, dữ liệu trả về, xác thực, phân quyền, kiểm tra dữ liệu đầu vào, xử lý lỗi, phân trang, lọc, sắp xếp, quản lý phiên bản.
  - Bổ sung mã API vào đặc tả từng màn hình trong tài liệu `14`.
- **Đầu ra (16, 17, cập nhật 14, 22):** lược đồ cơ sở dữ liệu, sơ đồ quan hệ, đặc tả API, quy tắc kiểm tra dữ liệu, mô hình lỗi, quy tắc truy cập dữ liệu; dữ liệu nhạy cảm và điểm tiếp nhận dữ liệu theo phần A của mục 17 trong SKILL.md.
- **Tiêu chí đầu ra:** bao phủ toàn bộ dữ liệu cần thiết; không có dữ liệu dư thừa không mục đích; quan hệ rõ; có kiểm tra dữ liệu; có quy tắc bảo toàn dữ liệu; API có hợp đồng rõ; phân quyền truy cập dữ liệu được xác định.

## 08. Chuẩn bị môi trường AI

- **Đầu vào:** toàn bộ tài liệu đã phê duyệt.
- **Tiêu chí đầu vào:** tài liệu quan trọng đầy đủ, nhất quán, có phiên bản, được phê duyệt, không còn mâu thuẫn.
- **Xử lý:** thiết lập ngữ cảnh AI, chỉ dẫn hệ thống AI, quy tắc phát triển AI, quy tắc viết mã, kho mã nguồn, chiến lược nhánh, môi trường phát triển, môi trường kiểm thử, công cụ kiểm thử, quy trình build và triển khai tự động nếu có, nguồn mã riêng của người dùng dùng cho mục 16, cách chạy ứng dụng để xem trước theo phần 5 của [DIEM_XEM_TRUOC.md](DIEM_XEM_TRUOC.md), `CLAUDE.md` cho từng phần theo phần 4 của [CAU_TRUC_THU_MUC.md](CAU_TRUC_THU_MUC.md).
- **Đầu ra (18, 19):** quy tắc phát triển AI, chỉ dẫn hệ thống AI, môi trường sẵn sàng lập trình.
- **Tiêu chí đầu ra:** AI hiểu được sản phẩm, phạm vi, nghiệp vụ, kiến trúc, dữ liệu, tiêu chuẩn mã, cách kiểm thử, giới hạn quyền hạn của mình.

## 09. Xây dựng

- **Đầu vào:** yêu cầu đã duyệt, kiến trúc, đặc tả giao diện, cơ sở dữ liệu, API, quy tắc phát triển AI, đặc tả công việc.
- **Tiêu chí đầu vào:** công việc có mục tiêu, phạm vi, đầu vào, đầu ra, tiêu chí nghiệm thu, ràng buộc; không phụ thuộc thông tin chưa xác định.
- **Xử lý:** theo chu trình tại mục 6 của SKILL.md, bước 1 đến 7.
- **Đầu ra:** mã nguồn, database migration nếu có, API, giao diện, kiểm thử tự động, cột mã nguồn và kiểm thử tự động trong tài liệu `27`, tài liệu được cập nhật.
- **Tiêu chí đầu ra:** đúng yêu cầu, kiến trúc, tiêu chuẩn mã, quy tắc nghiệp vụ, quy tắc bảo mật; có kiểm thử; đạt danh sách tự rà soát mã; commit trên nhánh đúng quy ước; không gây lỗi chức năng hiện có; không có thay đổi ngoài phạm vi.

## 10. Kiểm thử và kiểm soát chất lượng

- **Đầu vào:** mã nguồn, tiêu chí nghiệm thu, kịch bản kiểm thử, quy tắc nghiệp vụ, yêu cầu bảo mật.
- **Tiêu chí đầu vào:** chức năng đã lập trình xong, có kịch bản kiểm thử, tiêu chí nghiệm thu, môi trường kiểm thử.
- **Xử lý:** theo mục 7 của SKILL.md và các bước trong [KIEM_THU_VA_TRIEN_KHAI.md](KIEM_THU_VA_TRIEN_KHAI.md). Kiểm thử chức năng; nghiệp vụ; giao diện (bố cục, thao tác, responsive, trạng thái, thông báo); tích hợp; phân quyền theo từng vai trò; dữ liệu (kiểm tra đầu vào, toàn vẹn, quan hệ, trùng lặp, mất dữ liệu); bảo mật theo phần C của mục 17; hiệu năng khi cần; hồi quy.
- **Đầu ra (20, 21, 22, 25, 27):** kết quả kiểm thử, danh sách lỗi, kết quả hồi quy, đánh giá chất lượng, kết quả kiểm tra bao phủ.
- **Tiêu chí đầu ra:** đạt cổng kiểm thử tại mục 7 của SKILL.md (bao gồm cổng bảo mật); mọi lỗi còn lại có quyết định xử lý.

## 11. Nghiệm thu và phát hành phiên bản

- **Đầu vào:** bản đã kiểm thử, kết quả kiểm thử (tài liệu `25`), tiêu chí nghiệm thu, trạng thái lỗi.
- **Tiêu chí đầu vào:** đạt cổng kiểm thử tại mục 7 của SKILL.md; tài liệu đã cập nhật.
- **Xử lý:** theo chu trình tại mục 6 của SKILL.md, bước 8 và 9.
- **Đầu ra (23):** phiên bản được duyệt, mã phiên bản, ghi chú phát hành, phương án quay lui riêng của phiên bản.
- **Tiêu chí đầu ra:** được nghiệm thu; có mã phiên bản, ngày phát hành, danh sách thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích, phương án quay lui riêng của phiên bản. Phiên bản chưa hợp nhất, chưa gắn tag hoặc chưa kiểm thử không phải phiên bản hoàn thành.

## 12. Triển khai lên môi trường

- **Đầu vào:** phiên bản được duyệt đã gắn tag, hướng dẫn triển khai (tài liệu `26`), cấu hình môi trường đích, phê duyệt triển khai của người dùng.
- **Tiêu chí đầu vào:** đạt điều kiện bắt đầu tại mục 8 của SKILL.md.
- **Xử lý:** theo mục 8 của SKILL.md và các bước trong [KIEM_THU_VA_TRIEN_KHAI.md](KIEM_THU_VA_TRIEN_KHAI.md).
- **Đầu ra (26):** gói phát hành, hệ thống chạy phiên bản mới, biên bản triển khai.
- **Tiêu chí đầu ra:** hệ thống chạy đúng phiên bản; chức năng chính và chức năng vừa thay đổi hoạt động; không có lỗi mới trong log; biên bản triển khai đầy đủ; truy xuất được phiên bản đang chạy về commit.

## 13. Vận hành và cải tiến

- **Đầu vào:** hệ thống thực tế, phản hồi người dùng, log lỗi, dữ liệu hiệu năng, sự kiện bảo mật, yêu cầu thay đổi.
- **Tiêu chí đầu vào:** mọi yêu cầu thay đổi được ghi nhận và phân loại trong tài liệu `24`; mọi lỗi được ghi nhận trong tài liệu `25`.
- **Xử lý:** theo dõi lỗi, hiệu năng; kiểm tra bảo mật định kỳ theo phần E của mục 17; sao lưu, phục hồi; phân tích; xếp ưu tiên và mức quy mô; thay đổi theo quy trình quản lý thay đổi; sự cố khẩn cấp theo mục 13 của SKILL.md; kiểm thử; phát hành; triển khai; rà soát.
- **Đầu ra (24 và tài liệu liên quan):** sửa lỗi, cải tiến, chức năng mới đã được duyệt, tài liệu, yêu cầu, kiến trúc được cập nhật.
- **Tiêu chí đầu ra:** mọi thay đổi có lý do, phạm vi, đánh giá ảnh hưởng, được kiểm thử, được ghi nhận phiên bản, không làm mất kiểm soát hệ thống.
