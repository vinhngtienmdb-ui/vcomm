# CONG_VIEC_76: Hạ tầng AWS, môi trường thử nghiệm, môi trường thật và quy trình triển khai

- Mô tả: Viết hạ tầng bằng AWS CDK (vùng Singapore), đóng gói ứng dụng thành ảnh container chip Arm, dựng môi trường thử nghiệm (staging, dữ liệu giả) rồi môi trường thật giai đoạn 1; quy trình triển khai từ tag (GitHub Actions dùng OIDC) gồm sao lưu, database migration, quay lui; lập tài liệu `26`.
- Phiên bản: 0.5
- Ngày cập nhật: 2026-11-18
- Trạng thái: Đang thực hiện lát L1. Người dùng duyệt phương án Supabase + Railway + Cloudflare (mục 21), phiếu THAY_DOI_40 (mục 22); ngày 2026-11-18 người dùng chọn chỉ dựng môi trường thật, tên miền `erp`, `api`, `app`, `kho`, `ipos`.vcomm.vn (mục 26, thay mục 20.4, 25 và mọi nội dung về môi trường thử nghiệm). Chưa tạo tài nguyên. Điểm chặn mở cho người dùng ngoài: mục 26.3; điểm chặn A1 đến A3 tách thành CONG_VIEC_77, 78, 79, phát hành 0.14.1 trước lần triển khai đầu (mục 27).
- Thay đổi so với 0.2: ghi quyết định (mục 21), nội dung THAY_DOI_40 (mục 22), tiêu chí nghiệm thu và kịch bản chờ cấp mã (mục 23), kết quả lát L1 (mục 24). Mục 4 đến 10, 12, 13, 16, 18 giữ làm phương án AWS cho giai đoạn sau.
- Mức: Lớn (thành phần hạ tầng mới, thư mục mới ở gốc dự án, thư viện mới, chạm tới bảo mật và mọi module khi triển khai).
- Nhánh: `chuc-nang/CONG_VIEC_76-ha-tang-aws`.
- Nguồn: yêu cầu của người dùng ngày 2026-11-18 (tự kiểm trên môi trường thật, làm đúng kiến trúc đã duyệt); tài liệu `12` mục 1 điểm 9, mục 4, mục 5; tài liệu `13` mục 1, mục 5; tài liệu `22` mục 5; tài liệu `23`.
- Phiên bản triển khai đầu tiên: 0.14.0 (đang dựng: CONG_VIEC_72 Smart OTP, CONG_VIEC_73 mua hàng tại cửa hàng, CONG_VIEC_74 iPOS đợt 1, CONG_VIEC_75).

## 1. Mục tiêu

Người dùng mở được VComm trên Internet bằng tên miền thật, đăng nhập tài khoản thử và tự kiểm các chức năng trên môi trường thử nghiệm; sau đó có môi trường thật giai đoạn 1 dựng cùng một mã hạ tầng. Mỗi lần triển khai chạy cùng một quy trình, có sao lưu ngay trước, database migration đúng thứ tự, kiểm tra sau triển khai và quay lui được.

## 2. Phạm vi

Trong phạm vi:
1. Mã hạ tầng AWS CDK (TypeScript) cho hai môi trường tách riêng: thử nghiệm, thật.
2. Ảnh container chip Arm cho backend và các mini app web.
3. Phân phối ứng dụng di động cho người thử (bản web, bản Android cài trực tiếp).
4. Quy trình triển khai từ tag: GitHub Actions (OIDC sang AWS) và từ máy phiên AI.
5. Sao lưu trước triển khai, database migration, quay lui, kiểm tra sau triển khai.
6. Giám sát tối thiểu: log CloudWatch, cảnh báo lỗi gửi email.
7. Tài liệu `26` (môi trường, các bước triển khai, quay lui chung, biên bản).

Ngoài phạm vi (đề xuất công việc riêng khi cần):
1. Gửi email thật qua Amazon SES: mã hiện chỉ ghi email ra log (`apps/api/src/common/outbound-messages.ts`, lớp `LogOutboundMessages` duy nhất). Môi trường thật cần công việc riêng (mục 16 câu 3).
2. Amazon OpenSearch, Amazon SQS/SNS: mã chưa dùng (tìm sản phẩm chạy trên PostgreSQL; outbox đẩy cho nơi nhận trong tiến trình, `apps/api/src/common/outbox.service.ts`). Không dựng, tránh tốn chi phí; dựng khi có công việc dùng tới.
3. Sentry: chưa có trong mã; giai đoạn 1 dùng log và cảnh báo CloudWatch.
4. Đưa ứng dụng lên App Store, Google Play.
5. Đổi cách xác thực, nghiệp vụ, API của ứng dụng.

## 3. Hiện trạng mã liên quan đến triển khai (đã khảo sát 2026-11-18)

| Thành phần | Hiện trạng | Hệ quả khi triển khai |
|---|---|---|
| Backend `apps/api` | NestJS, build `tsc` ra `dist/`, chạy `node dist/main.js`, cổng `API_PORT` (4000). Tiền tố `/api/v1`, riêng `/s/:productId`, `/.well-known/*` ở gốc | Cần tên miền API riêng cho trang chia sẻ, tệp liên kết ứng dụng, webhook, trang trả về của cổng thanh toán |
| Tác vụ nền | BullMQ, chạy trong tiến trình API (`apps/api/src/jobs/background-jobs.ts`), tắt bằng `BACKGROUND_JOBS=disabled` | Tách được dịch vụ `worker` bằng cùng ảnh, không sửa mã |
| Database migration | `node dist/database/run-migrations.js`, đọc `database/migrations` theo đường dẫn tương đối (`../../../../database/migrations`), khóa `pg_advisory_lock`, mỗi tệp một giao dịch. 129 tệp trên `main`, 0.14.0 thêm 0158 đến 0173 | Ảnh phải giữ cấu trúc thư mục monorepo; chạy một lần trước khi đổi phiên bản dịch vụ |
| Dữ liệu thử | `node dist/database/seed.js`, từ chối khi `NODE_ENV=production` | Chỉ chạy ở môi trường thử nghiệm |
| Kết nối cơ sở dữ liệu | Chỉ đọc `DATABASE_URL` (`apps/api/src/database/database.module.ts`) | Bí mật Aurora là JSON; ghép chuỗi trong tệp khởi động của ảnh (mục 5.3) |
| Redis | `REDIS_URL` (BullMQ, giới hạn số lần thử) | ElastiCache có mã hóa đường truyền dùng `rediss://` |
| Lưu tệp | `STORAGE_DRIVER=s3`, `S3_BUCKET`, `AWS_REGION`, quyền IAM | Vai trò của task có quyền đọc ghi bucket |
| Email | Chỉ ghi log | Môi trường thử nghiệm: đọc đường dẫn kích hoạt trong CloudWatch; môi trường thật: chặn (mục 2) |
| SMS, Zalo ZNS | eSMS, khóa nhập ở Cài đặt tích hợp (lưu cơ sở dữ liệu, mã hóa bằng `MFA_SECRET_KEY`); chưa cài thì mã OTP ghi log khi `NODE_ENV` khác `production` | Môi trường thử nghiệm thử được không cần eSMS |
| `NODE_ENV` | `production` thì: cookie có cờ Secure; tắt bộ giả lập hóa đơn điện tử, ký số; không in mã OTP; không nạp dữ liệu thử | Môi trường thử nghiệm đặt `NODE_ENV=staging` (mục 16 câu 9) |
| Mini app web | 12 ứng dụng Next.js 16.4.5: `web-platform` (gốc `/`) chuyển tiếp tới 11 mini app (`/catalog`, `/inventory`, `/crm`, `/purchasing`, `/sales`, `/finance`, `/retail`, `/merchant`, `/hr`, `/analytics`, `/office`) và `/api/v1` tới backend. Địa chỉ chuyển tiếp đọc lúc build (`rewrites`) | Địa chỉ nội bộ phải giống nhau ở mọi môi trường để một ảnh dùng cho cả hai môi trường |
| Điểm kiểm tra sống | Chưa có endpoint riêng | Dùng `GET /api/v1/auth/methods` (công khai, có đọc cơ sở dữ liệu); web dùng `GET /` |
| Ứng dụng di động | `mobile-vcomm`, `mobile-warehouse` (Expo SDK 58), `mobile-ipos` (0.14.0, Android, thư viện gốc máy in Sunmi, Bluetooth, TCP). Địa chỉ API đọc `EXPO_PUBLIC_API_URL` lúc build. Chưa có `eas.json` | iPOS không chạy được trên Expo Go, bắt buộc bản dựng riêng |
| CI | `.github/workflows/ci.yml` (kiểm tra kiểu, lint, kiểm thử), `gan-tag-phat-hanh.yml` (gắn tag) | Thêm luồng triển khai riêng, không đổi hai luồng cũ |

## 4. Thành phần cần chạy và cách đóng gói

| Thành phần | Ảnh container | Dịch vụ ECS Fargate (Arm) | Thử nghiệm | Thật giai đoạn 1 |
|---|---|---|---|---|
| Backend API | `vcomm-api` (Node 22, `apps/api/dist`, `database/migrations`, `node_modules` sản xuất) | `api`, sau ALB, `BACKGROUND_JOBS=disabled` ở môi trường thật | 1 task 0,5 vCPU, 1 GB, chạy luôn tác vụ nền (`BACKGROUND_JOBS=enabled`) | 2 task 0,5 vCPU, 1 GB, 2 vùng sẵn sàng |
| Tác vụ nền | Cùng ảnh `vcomm-api` | `worker`, không nhận yêu cầu từ ngoài | Gộp vào `api` | 2 task 0,5 vCPU, 1 GB |
| Database migration, dữ liệu thử | Cùng ảnh `vcomm-api`, lệnh khác | Task chạy một lần (`ecs run-task`) | Migration mỗi lần triển khai; dữ liệu thử lần đầu | Chỉ migration |
| 12 mini app web | `vcomm-web` (12 ứng dụng đã build, một tiến trình khởi động chạy 12 `next start` cổng 3000 đến 3013) | `web`, sau ALB, chỉ cổng 3000 nhận yêu cầu | 1 task 1 vCPU, 3 GB | 2 task 1 vCPU, 3 GB |
| Bản web ứng dụng VComm, ứng dụng kho, iPOS | Không dùng container: `expo export --platform web` | S3 + CloudFront | Có | Có (nếu người dùng muốn) |
| Bản Android | EAS Build hồ sơ `preview` (tệp APK cài trực tiếp) | Không áp dụng | VComm, kho, iPOS | Theo kế hoạch phát hành ứng dụng (ngoài phạm vi) |
| Bản iOS | Cần tài khoản Apple Developer | Không áp dụng | Để sau (mục 16 câu 6) | Ngoài phạm vi |

- Ảnh build cho `linux/arm64`, gắn nhãn bằng mã phiên bản (`0.14.0`) và mã commit; lưu ở Amazon ECR, quét lỗ hổng khi đẩy lên.
- Mỗi task chạy người dùng không phải root, hệ thống tệp gốc chỉ đọc (trừ thư mục tạm), log JSON ra CloudWatch.
- Tên nội bộ dùng ECS Service Connect: mini app gọi `http://api.vcomm.internal:4000`, giống nhau ở mọi môi trường, nên ảnh `vcomm-web` build một lần dùng cho cả hai môi trường.

## 5. Hạ tầng AWS

### 5.1 Tài khoản, vùng, ngăn xếp CDK

- Vùng `ap-southeast-1`. Đề xuất hai tài khoản AWS riêng cho thử nghiệm và thật trong AWS Organizations (mục 16 câu 1).
- Thư mục mã: `infra/` (gói pnpm `infra`). Mỗi môi trường một bộ ngăn xếp, tên có tiền tố môi trường (`VComm-Staging-*`, `VComm-Production-*`); cấu hình kích thước trong một tệp cấu hình theo môi trường.

| Ngăn xếp | Tài nguyên |
|---|---|
| `Account` | Nhà cung cấp OIDC của GitHub, vai trò triển khai cho GitHub Actions (chỉ tin nhánh `main` và môi trường GitHub tương ứng), vai trò triển khai cho phiên AI |
| `Network` | VPC 2 vùng sẵn sàng: mạng công khai (ALB; task ở môi trường thử nghiệm), mạng riêng có NAT (task ở môi trường thật), mạng cô lập (Aurora, Redis); điểm cuối dạng gateway cho S3 |
| `Data` | Khóa KMS của môi trường; Aurora PostgreSQL 16; ElastiCache; bucket S3 tệp đính kèm (chặn truy cập công khai, mã hóa KMS, giữ phiên bản); bí mật Secrets Manager |
| `Application` | ECR, cụm ECS, định nghĩa task, dịch vụ `api`, `worker`, `web`, ALB (HTTPS, chuyển HTTP sang HTTPS), chứng chỉ ACM, bản ghi DNS, lịch tắt bật môi trường thử nghiệm |
| `StaticWeb` | S3 + CloudFront cho bản web của ứng dụng di động |
| `Monitoring` | Nhóm log (giữ 30 ngày ở thử nghiệm, 365 ngày ở thật), cảnh báo CloudWatch (lỗi 5xx, độ trễ, task khởi động lại, CPU Aurora, bộ nhớ trống), chủ đề SNS gửi email cảnh báo |

### 5.2 Cấu hình từng môi trường

| Hạng mục | Thử nghiệm | Thật giai đoạn 1 |
|---|---|---|
| Aurora PostgreSQL 16 | Serverless v2, 0 đến 2 ACU, tự dừng sau 15 phút không dùng, 1 bản | 2 × db.t4g.medium (ghi + đọc dự phòng), 2 vùng sẵn sàng, Performance Insights |
| Sao lưu Aurora | Giữ 7 ngày | Giữ 35 ngày, phục hồi về thời điểm bất kỳ, chặn xóa (tài liệu `12` mục 5) |
| ElastiCache | Valkey (tương thích Redis) 1 × cache.t4g.micro, mã hóa đường truyền | 2 × cache.t4g.small, tự chuyển dự phòng |
| NAT | Không; task có địa chỉ công khai, nhóm bảo mật chỉ nhận từ ALB | 1 NAT gateway (tài liệu `13` mục 5) |
| Giờ chạy | Thứ Hai đến thứ Sáu, 7:00 đến 20:00 giờ Việt Nam (lịch đặt số task về 0); bật tay ngoài giờ bằng luồng GitHub Actions | Liên tục |
| Tên miền (ví dụ, chờ mục 16 câu 7) | `staging.<tên miền>` (web), `api.staging.<tên miền>` (API), `app.staging.<tên miền>`, `kho.staging.<tên miền>`, `ipos.staging.<tên miền>` (bản web ứng dụng) | Như trên, bỏ `staging.` |
| AWS WAF | Không | Bộ quy tắc AWS quản lý, giới hạn tần suất theo địa chỉ IP trên ALB |
| Bảo vệ khi xóa | Cho xóa | Chặn xóa ngăn xếp `Data`, giữ bucket, giữ bí mật |

### 5.3 Khóa bí mật, KMS

- Bí mật Aurora do Aurora quản lý trong Secrets Manager (JSON `host`, `port`, `dbname`, `username`, `password`), tự đổi mỗi 90 ngày (tài liệu `22` mục 5). ECS đưa từng khóa vào biến `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`; tệp khởi động của ảnh ghép thành `DATABASE_URL` (mã hóa ký tự đặc biệt, `sslmode=verify-full`, chứng chỉ gốc của Amazon RDS có trong ảnh) rồi chạy tiến trình. Không sửa mã ứng dụng; task khởi động lại sẽ lấy mật khẩu mới.
- Bí mật ứng dụng `vcomm/<môi trường>/app` (JSON), mã hóa bằng khóa KMS của môi trường:
  - CDK tự sinh một lần, không bao giờ sinh lại: `ACCESS_TOKEN_SECRET`, `MFA_SECRET_KEY` (khóa mã hóa Cài đặt tích hợp; đổi khóa này làm mất mọi khóa đã nhập ở Cài đặt tích hợp).
  - Người dùng tự nhập trên bảng điều khiển AWS (không dán vào trò chuyện): khóa cổng thanh toán, đơn vị vận chuyển, `ANTHROPIC_API_KEY` (bảng mục 7).
- Ứng dụng đọc S3 bằng vai trò IAM của task, không dùng khóa tĩnh.

## 6. Quy trình triển khai

### 6.1 Điều kiện

Theo skill mục 8: phiên bản có tag và có trong tài liệu `23`; người dùng phê duyệt triển khai cho môi trường cụ thể, cho lần đó. Môi trường thật chỉ triển khai tag đã chạy đạt trên môi trường thử nghiệm.

### 6.2 Các bước (giống nhau cho hai môi trường, ghi vào tài liệu `26`)

1. Lấy mã đúng tag; kiểm tra tag chứa mọi tag bản vá khẩn cấp đã triển khai (`git merge-base --is-ancestor`).
2. Build hai ảnh `linux/arm64` từ tag, dùng tệp Dockerfile ở `infra/docker` của `main` (mã hạ tầng không gắn với tag ứng dụng); đẩy lên ECR; dừng nếu quét ảnh có lỗ hổng Nghiêm trọng.
3. Ghi nhận phiên bản đang chạy (nhãn ảnh của từng dịch vụ) để quay lui.
4. Sao lưu: tạo bản chụp Aurora thủ công `vcomm-<môi trường>-truoc-<phiên bản>-<thời điểm>`, chờ hoàn tất.
5. Database migration: chạy task một lần bằng ảnh mới (`node apps/api/dist/database/run-migrations.js`), chờ kết thúc, lỗi thì dừng (bản cũ vẫn chạy, giao dịch của tệp lỗi đã hoàn tác).
6. Lần đầu ở môi trường thử nghiệm: chạy task nạp dữ liệu thử (`seed.js`). Luồng triển khai từ chối bước này ở môi trường thật.
7. Cập nhật dịch vụ `api`, `worker`, `web` sang nhãn ảnh mới (`cdk deploy` ngăn xếp `Application` với tham số phiên bản), ECS triển khai cuốn chiếu, tự quay về bản cũ khi task mới không qua kiểm tra sống (circuit breaker).
8. Tải bản web ứng dụng di động (build với `EXPO_PUBLIC_API_URL` của môi trường) lên S3, làm mới bộ nhớ đệm CloudFront.
9. Kiểm tra sau triển khai: `GET /api/v1/auth/methods` trả 200, trang đăng nhập tải được, đăng nhập tài khoản thử (môi trường thử nghiệm), không có lỗi 5xx mới trong log 10 phút; kiểm tra bảo mật phần D.
10. Ghi biên bản tài liệu `26` (qua nhánh `tai-lieu/...`) và gửi phiên điều phối nội dung ghi nhật ký.

### 6.3 Cách chạy

- GitHub Actions: luồng `.github/workflows/trien-khai.yml`, chạy tay (`workflow_dispatch`) với đầu vào tag và môi trường. Mỗi môi trường AWS là một môi trường GitHub (`staging`, `production`); môi trường `production` bắt buộc người dùng bấm duyệt trên GitHub cho từng lần chạy. Đăng nhập AWS bằng OIDC (`aws-actions/configure-aws-credentials`), vai trò chỉ tin kho `vinhngtienmdb-ui/vcomm` và đúng môi trường GitHub; không lưu khóa AWS dài hạn trong GitHub. Build Arm trên máy chạy Arm của GitHub (`ubuntu-24.04-arm`) nếu kho dùng được, nếu không thì `docker buildx` giả lập Arm (chậm hơn).
- Từ máy phiên AI: cùng một tệp lệnh `infra/scripts/deploy.sh <môi trường> <tag>`, dùng khóa trong cài đặt môi trường phiên (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=ap-southeast-1`). Đã kiểm: máy phiên có Docker (tiến trình nền Docker không tự chạy, phải bật `dockerd`). Chỉ chạy sau khi người dùng duyệt lần triển khai đó. Khóa này chỉ có quyền nhận vai trò triển khai (mục 9).
- Luồng phụ: `bat-tat-thu-nghiem.yml` bật hoặc tắt môi trường thử nghiệm ngoài giờ.

### 6.4 Quay lui

| Tình huống | Cách quay lui |
|---|---|
| Task mới không khởi động hoặc không qua kiểm tra sống | ECS tự quay về bản cũ (circuit breaker); không có migration mới thì xong |
| Lỗi sau khi bản mới đã chạy, migration tương thích ngược (thường gặp, tài liệu `23` ghi riêng từng phiên bản) | Chạy lại bước 7 với nhãn ảnh cũ đã ghi ở bước 3; giữ nguyên lược đồ; làm theo phương án quay lui của phiên bản trong tài liệu `23` |
| Dữ liệu sai do bản mới | Khi người dùng đồng ý: phục hồi bản chụp ở bước 4 (hoặc về thời điểm trước triển khai) thành cụm mới, đổi bí mật kết nối sang cụm mới, triển khai nhãn ảnh cũ; dữ liệu phát sinh sau bản chụp phải xử lý tay |
| Hạ tầng (`cdk deploy`) lỗi | CloudFormation tự hoàn tác ngăn xếp |

## 7. Biến môi trường và khóa bí mật theo môi trường

Đối chiếu `.env.example` và các biến mã đọc (`process.env`). Ký hiệu: B = bí mật (Secrets Manager), T = biến thường trong định nghĩa task, N = người dùng nhập ở Cài đặt tích hợp trên giao diện (không phải biến môi trường).

| Biến | Loại | Thử nghiệm | Thật |
|---|---|---|---|
| `NODE_ENV` | T | `staging` | `production` |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` (tệp khởi động ghép `DATABASE_URL`) | B | Bí mật Aurora | Bí mật Aurora |
| `REDIS_URL` | T | `rediss://<địa chỉ ElastiCache>:6379` | Như thử nghiệm, thêm token xác thực (chuyển sang B) |
| `API_PORT` | T | `4000` | `4000` |
| `ACCESS_TOKEN_SECRET`, `MFA_SECRET_KEY` | B | CDK sinh | CDK sinh, khác thử nghiệm |
| `WEB_ORIGIN` | T | `https://staging.<tên miền>` | `https://<tên miền>` |
| `APP_WEB_ORIGINS` | T | Địa chỉ bản web ứng dụng VComm, kho, iPOS | Như thử nghiệm theo tên miền thật |
| `SHARE_PUBLIC_URL` | T | `https://api.staging.<tên miền>` | `https://api.<tên miền>` |
| `VCOMM_WEB_URL`, `VCOMM_APP_LINK_BASE` | T | Bản web ứng dụng VComm; `vcomm://` | Như thử nghiệm |
| `APP_STORE_URL`, `GOOGLE_PLAY_URL`, `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS` | T | Trống | Khi phát hành ứng dụng |
| `BACKGROUND_JOBS` | T | `enabled` (một task) | `api`: `disabled`; `worker`: `enabled` |
| `STORAGE_DRIVER`, `S3_BUCKET`, `AWS_REGION` | T | `s3`, bucket của môi trường, `ap-southeast-1` | Như thử nghiệm |
| `SIGNING_SIMULATOR_DIRECTORY` | T | `/tmp/ky-so-gia-lap` (mất khi task khởi động lại, chứng thư giả lập sinh lại) | Không đặt (bộ giả lập bị chặn) |
| `LOYALTY_PARTNER_SIMULATOR` | T | `on` | Trống |
| `AI_PROVIDER` | T | `fake`; `anthropic` nếu người dùng cấp khóa thử | `anthropic` khi người dùng duyệt |
| `ANTHROPIC_API_KEY` | B | Trống hoặc khóa riêng của môi trường thử nghiệm | Khóa riêng |
| `AI_MODEL`, `AI_CHAT_EFFORT`, `AI_CONTENT_EFFORT`, `AI_PRICE_*`, `AI_NOTICE_VERSION` | T | Như `.env.example` | Như `.env.example` |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | B | Tài khoản thử nghiệm VNPAY (cần cho CONG_VIEC_73) | Tài khoản thật |
| `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` | T | Địa chỉ thử nghiệm VNPAY; API + `/api/v1/public/payments/vnpay/return` | Địa chỉ thật |
| `MOMO_*`, `PAYOS_*`, `SEPAY_*`, `ECOPAY_*`, `GPAY_*`, `ZALOPAY_*`, `BIDV_*` (khóa: B; địa chỉ: T) | B, T | Trống (phương thức không bật) trừ khi người dùng cấp tài khoản thử | Theo hợp đồng |
| `BANK_TRANSFER_*` | T | Trống hoặc số tài khoản thử | Tài khoản nhận tiền thật |
| `GHN_*`, `GHTK_*`, `VIETTEL_POST_*`, `VNPOST_*`, `JT_*` (token, mật khẩu, khóa webhook: B; địa chỉ người gửi, `*_BASE_URL`: T) | B, T | Trống hoặc tài khoản thử nghiệm của hãng (`*_BASE_URL` trống là môi trường thử của hãng) | Theo hợp đồng |
| `MISA_EINVOICE_BASE_URL` | T | Trống (dùng bộ giả lập hóa đơn hoặc tài khoản thử MISA) | Trống (địa chỉ thật theo cấu hình) |
| `APPROVAL_TEST_DOCUMENTS` | T | Không đặt (bật) | Không áp dụng (`NODE_ENV=production` đã tắt) |
| `API_ORIGIN`, `CATALOG_ORIGIN` đến `OFFICE_ORIGIN` (mini app) | Lúc build ảnh `vcomm-web` | `http://api.vcomm.internal:4000`, `http://localhost:30xx` | Giống thử nghiệm |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_SHARE_URL` | Lúc build ứng dụng | Địa chỉ thử nghiệm | Địa chỉ thật |
| Khóa eSMS (SMS, ZNS), mã ứng dụng Google, Microsoft, Zalo; thông tin MISA, ký số, webhook ngân hàng | N | Trống: mã OTP, đường dẫn ghi log CloudWatch; hoặc eSMS chế độ thử | Người dùng nhập |

## 8. Dịch vụ ngoài và bộ giả lập

| Dịch vụ | Thử nghiệm | Thật |
|---|---|---|
| eSMS (SMS, Zalo ZNS) | Không bắt buộc; chưa cài thì mã OTP ghi log. Có thể nhập khóa eSMS với chế độ thử | Bắt buộc (OTP, ba mẫu ZNS của CONG_VIEC_72, số tổng đài) |
| Email | Ghi log | Chặn: cần công việc gửi qua SES (mục 2) |
| VNPAY | Tài khoản môi trường thử nghiệm của VNPAY; khai địa chỉ IPN, trả về với VNPAY | Tài khoản thật |
| Cổng thanh toán khác, đơn vị vận chuyển | Tắt, hoặc tài khoản thử nếu người dùng có | Theo hợp đồng |
| MISA meInvoice | Bộ giả lập hóa đơn điện tử (`einvoice/providers/simulator.ts`); tài khoản thử MISA nếu có | Tài khoản thật; CONG_VIEC_73 còn chờ xác nhận của MISA |
| Ký số từ xa | Bộ giả lập | Chưa có nhà cung cấp thật |
| Đối tác liên minh điểm | Bộ giả lập (`LOYALTY_PARTNER_SIMULATOR=on`) | Đối tác thật |
| Trợ lý AI (Anthropic) | `fake`, hoặc khóa thử riêng | Khóa riêng, hạn mức theo CONG_VIEC_63 |
| Đăng nhập Google, Microsoft, Zalo | Không bắt buộc; khai địa chỉ gọi lại theo tên miền thử nghiệm nếu muốn thử | Khai theo tên miền thật |
| Expo EAS (bản Android) | Tài khoản Expo của người dùng | Như thử nghiệm |

## 9. Người dùng cần cung cấp

1. Tài khoản AWS: đề xuất hai tài khoản (thử nghiệm, thật) trong AWS Organizations; bật thanh toán, đặt ngân sách và cảnh báo chi phí (AWS Budgets) cho từng tài khoản.
2. Khởi tạo CDK một lần cho mỗi tài khoản: người dùng chạy trong AWS CloudShell lệnh `npx aws-cdk@<phiên bản> bootstrap aws://<mã tài khoản>/ap-southeast-1` (AI soạn lệnh chính xác ở lát L1). Không cần cấp quyền quản trị cho AI.
3. Người dùng IAM cho phiên AI (`vcomm-trien-khai-phien`), chỉ được nhận các vai trò `cdk-hnb659fds-*` do bước 2 tạo và vai trò triển khai do ngăn xếp `Account` tạo; tạo khóa truy cập, tự thêm vào cài đặt môi trường phiên (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=ap-southeast-1`). AI soạn sẵn chính sách IAM dạng JSON.
4. Tên miền và nơi quản lý DNS hiện tại. Đề xuất: tạo vùng Route 53 cho tên miền con (`staging.<tên miền>`, sau đó tên miền chính hoặc `app.<tên miền>`), người dùng thêm bản ghi NS ở nơi quản lý DNS hiện tại. Chứng chỉ ACM xác minh qua DNS, miễn phí, tự gia hạn.
5. Địa chỉ email nhận cảnh báo (SNS), xác nhận đăng ký qua thư.
6. GitHub: tạo hai môi trường `staging`, `production` trong cài đặt kho; `production` đặt người duyệt là người dùng. Xác nhận kho được dùng máy chạy Arm của GitHub.
7. Tài khoản Expo (EAS) để dựng bản Android; tùy chọn tài khoản Apple Developer (99 USD/năm) nếu thử iOS.
8. Tài khoản thử nghiệm VNPAY (để thử CONG_VIEC_73) và khóa của các dịch vụ khác muốn thử; tự nhập vào Secrets Manager hoặc Cài đặt tích hợp.
9. Phê duyệt từng lần triển khai, cho từng môi trường.

## 10. Ước tính chi phí hằng tháng

- Đơn giá theo yêu cầu vùng ap-southeast-1 lấy từ AWS Price List API ngày 2026-11-18: Fargate Arm 0,04045 USD/vCPU-giờ, 0,00442 USD/GB-giờ; Aurora PostgreSQL db.t4g.medium 0,114 USD/giờ, Serverless v2 0,20 USD/ACU-giờ, lưu trữ 0,11 USD/GB-tháng, 0,22 USD/triệu lượt đọc ghi; ElastiCache Valkey t4g.micro 0,0192, t4g.small 0,0384 USD/giờ; ALB 0,0252 USD/giờ, 0,008 USD/LCU-giờ; địa chỉ IPv4 công khai 0,005 USD/giờ. NAT gateway (khoảng 0,059 USD/giờ và 0,059 USD/GB), CloudWatch Logs (khoảng 0,70 USD/GB), WAF chưa kiểm lại, lấy theo giá tham khảo; lát L1 kiểm lại trước khi dựng.
- Một tháng 730 giờ; môi trường thử nghiệm chạy 286 giờ (13 giờ × 22 ngày). Lưu lượng, dung lượng log là giả định.

| Hạng mục | Thử nghiệm (USD) | Thật giai đoạn 1 (USD) |
|---|---|---|
| Fargate (thử nghiệm 1,5 vCPU, 4 GB × 286 giờ; thật 4 vCPU, 10 GB × 730 giờ) | ~22 | ~150 |
| Aurora (thử nghiệm Serverless v2 trung bình ~0,5 ACU khi chạy, tự dừng; thật 2 × db.t4g.medium, 30 GB, đọc ghi, sao lưu) | ~30 | ~183 |
| ElastiCache Valkey (thử nghiệm 1 × t4g.micro chạy liên tục; thật 2 × t4g.small) | ~14 | ~56 |
| ALB | ~21 | ~25 |
| NAT gateway | 0 | ~45 |
| Địa chỉ IPv4 công khai (ALB, task hoặc NAT) | ~10 | ~11 |
| Secrets Manager, KMS | ~3 | ~5 |
| CloudWatch log, cảnh báo | ~5 | ~20 |
| ECR, S3, CloudFront, Route 53 | ~3 | ~7 |
| AWS WAF | 0 | ~11 |
| **Cộng** | **~110** | **~515** |

- Thấp hơn tài liệu `13` mục 5 (thử nghiệm ~245, thật ~663 sau khi giảm) vì không dựng OpenSearch, SQS/SNS và gộp 12 mini app trong một dịch vụ (mục 16 câu 2). Nếu tách 12 mini app thành 12 dịch vụ (0,25 vCPU, 0,5 GB mỗi task), cộng thêm ~70 USD ở môi trường thật và ~10 USD ở môi trường thử nghiệm.
- Môi trường thử nghiệm chạy liên tục (không tắt ngoài giờ): ~200 USD.
- Ngoài AWS (không tính ở trên): tên miền; eSMS theo tin; Anthropic theo token; Apple Developer 99 USD/năm, Google Play 25 USD một lần khi phát hành ứng dụng; EAS miễn phí trong hạn mức bản dựng mỗi tháng.

## 11. Dùng lại mã đã có

| Mã có sẵn | Dùng cho |
|---|---|
| `apps/api` lệnh `build`, `start`, `db:migrate`, `db:seed` | Lệnh của ảnh và task một lần |
| `BACKGROUND_JOBS` | Tách dịch vụ `worker` không sửa mã |
| `STORAGE_DRIVER=s3` (`apps/api/src/common/file-storage.ts`) | Lưu tệp trên S3 |
| Khóa `pg_advisory_lock` trong bộ chạy migration | Chạy migration an toàn khi có nhiều task |
| `GET /api/v1/auth/methods` | Điểm kiểm tra sống của ALB |
| Bước cài đặt, ghim phiên bản hành động GitHub theo mã commit trong `.github/workflows/ci.yml` | Luồng triển khai dùng cùng cách |
| Bộ giả lập hóa đơn điện tử, ký số, đối tác liên minh điểm, mã OTP ghi log | Môi trường thử nghiệm không cần tài khoản thật |

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_76 – 2026-11-18

- Yêu cầu cần đáp ứng: tài liệu `12` mục 1 điểm 9, mục 4, mục 5; tài liệu `13` (ECS Fargate, Aurora, AWS CDK TypeScript); tài liệu `22` mục 5.
- Nguồn đã tìm: mã nguồn dự án (chưa có mã hạ tầng, Dockerfile); nguồn riêng của người dùng (V-com-ERP dùng Supabase, không có hạ tầng AWS); kho npm, GitHub.
- Từ khóa đã dùng: `aws-cdk-lib ecs fargate`, `ApplicationLoadBalancedFargateService`, `next.js docker arm64`, `github actions oidc aws`, `expo eas build internal distribution`; không chứa thông tin nghiệp vụ.

| Ứng viên | Nguồn | Giấy phép | Cập nhật gần nhất | Tương thích công nghệ | Bảo mật | Công sức điều chỉnh |
|---|---|---|---|---|---|---|
| AWS CDK `aws-cdk-lib` (thành phần L2, `ecs_patterns`) và `constructs` | npm | Apache 2.0 | 2.277.0 (2026-11-13); `constructs` 10.8.1 (2026-08-03) | TypeScript, đã chọn ở tài liệu `13` | Mặc định mã hóa, nhóm bảo mật tối thiểu; có `cdk-nag` để rà | Thấp |
| AWS CDK CLI `aws-cdk` | npm | Apache 2.0 | 2.1148.1 (2026-11-11) | Công cụ dòng lệnh | Không chạy trong ảnh | Thấp |
| SST, OpenNext, `cdk-nextjs` (Next.js trên Lambda, CloudFront) | GitHub | MIT | Đang phát triển | Không theo kiến trúc ECS Fargate đã duyệt; kết nối Aurora từ Lambda cần thêm proxy | Trung bình | Cao |
| Terraform | HashiCorp | BSL 1.1 | Đang phát triển | Ngôn ngữ khác, người dùng đã chọn CDK | Không áp dụng | Cao |
| `aws-actions/configure-aws-credentials`, `aws-actions/amazon-ecr-login` | GitHub | MIT | Đang phát triển | GitHub Actions, OIDC | Ghim theo mã commit | Thấp |
| `docker/setup-buildx-action`, `docker/build-push-action` | GitHub | Apache 2.0 | Đang phát triển | Build Arm | Ghim theo mã commit | Thấp |
| Expo EAS Build (dịch vụ) và `eas-cli` | expo.dev | Dịch vụ trả phí theo bậc, bậc miễn phí; `eas-cli` MIT | Đang phát triển | Expo SDK 58 | Ký ứng dụng do EAS giữ hoặc người dùng giữ | Thấp |
| `cdk-nag` (rà quy tắc bảo mật trong mã CDK) | npm | Apache 2.0 | Chưa kiểm phiên bản | CDK | Rà theo bộ quy tắc AWS Solutions | Thấp |

- Phương án:
  1. Dùng lại nguyên trạng: thành phần L2 của `aws-cdk-lib` (VPC, Aurora, ECS, ALB, ElastiCache mức L1), các hành động GitHub chính thức, EAS Build.
  2. Dùng lại có điều chỉnh: `ApplicationLoadBalancedFargateService` cho `api`, `web`; tự viết phần lịch tắt bật, task migration, tệp khởi động ghép chuỗi kết nối.
  3. Tham khảo cách làm, tự viết: không cần.
  4. Tự viết mới hoàn toàn bằng CloudFormation: không cần.
- Đề xuất: phương án 1 kết hợp 2. Thêm `cdk-nag` để kiểm bảo mật tự động khi `cdk synth` (chờ người dùng duyệt). Không dùng SST, Terraform vì lệch kiến trúc đã duyệt.
- Quyết định của người dùng: **CHƯA CÓ**.

Thư viện mới cần duyệt (gói `infra`, chỉ dùng lúc phát triển và triển khai, không vào ảnh chạy): `aws-cdk-lib` 2.277.0 (tài liệu `13` ghi 2.275.0, đề xuất nâng), `constructs` 10.8.1, `aws-cdk` 2.1148.1, `cdk-nag` (phiên bản kiểm khi duyệt). Kiểm thử dùng `vitest` sẵn có. Ảnh nền container: `node:22-bookworm-slim` (ghim theo mã băm).

## 13. Tiêu chí nghiệm thu (đề xuất, cấp mã TIEUCHI_NGHIEMTHU khi người dùng duyệt)

1. `cdk synth` cho hai môi trường đạt, không có cảnh báo `cdk-nag` mức lỗi chưa được người dùng chấp nhận; kiểm thử tự động của `infra` (kiểm cấu hình bằng `aws-cdk-lib/assertions`) đạt.
2. Hai ảnh build được cho `linux/arm64` từ tag 0.14.0; ảnh không chứa `.env`, khóa bí mật, mã kiểm thử; quét ảnh không có lỗ hổng Nghiêm trọng, Cao chưa xử lý.
3. Môi trường thử nghiệm: mở `https://staging.<tên miền>` bằng HTTPS, đăng nhập tài khoản thử, vào được 11 mini app; ứng dụng VComm bản web và bản Android gọi được API thử nghiệm; tải lên, tải xuống tệp đính kèm qua S3 đạt; tác vụ nền chạy (log có lượt chạy theo lịch).
4. Luồng triển khai chạy đủ 10 bước mục 6.2 trên môi trường thử nghiệm; có bản chụp trước triển khai; migration chạy đúng thứ tự, chạy lại lần hai không còn tệp mới.
5. Quay lui thử trên môi trường thử nghiệm: triển khai nhãn ảnh cũ thành công; phục hồi bản chụp thành cụm mới thành công (diễn tập).
6. Môi trường thử nghiệm tự tắt ngoài giờ và bật lại đúng lịch; bật tay được.
7. Không có khóa AWS dài hạn trong GitHub; vai trò OIDC chỉ nhận yêu cầu từ đúng kho và môi trường GitHub.
8. Kiểm tra bảo mật phần D đạt (cơ sở dữ liệu, Redis không có địa chỉ công khai; bucket chặn truy cập công khai; mã hóa khi lưu và khi truyền; nhóm bảo mật tối thiểu).
9. Tài liệu `26` có môi trường, các bước, quay lui chung, biên bản lần triển khai thử nghiệm đầu tiên.
10. Môi trường thật (lát L3): đạt tiêu chí 2 đến 8 tương ứng, chạy 2 task mỗi dịch vụ ở 2 vùng sẵn sàng, cảnh báo gửi tới email người dùng.

## 14. Ràng buộc kỹ thuật

- Không sửa mã ứng dụng, nghiệp vụ, API ở lát L1, L2; ảnh build từ tag nguyên trạng. Cần sửa mã ứng dụng (ví dụ cờ Secure của cookie ở môi trường thử nghiệm) thì đề xuất riêng.
- Mã hạ tầng không chứa giá trị bí mật, mã tài khoản AWS ghi trong cấu hình (không phải bí mật) hoặc lấy từ biến môi trường lúc chạy.
- Tên trong mã tiếng Anh, chú thích tiếng Việt (tài liệu `18` mục 3). Phiên bản thư viện ghi cố định.
- Mọi tài nguyên gắn nhãn `project=vcomm`, `environment=<môi trường>` để theo dõi chi phí.
- Không tạo tài nguyên AWS khi chưa có phê duyệt của người dùng cho lần đó.

## 15. Điều kiện đặc biệt, điểm chặn môi trường thật

1. Pháp lý điểm thưởng (CONG_VIEC_51) chặn triển khai lên môi trường thật cho đến khi có ý kiến luật sư (tài liệu `23` phiên bản 0.12.0, 0.13.0).
2. Tài liệu `12` mục 7: chưa xác định yêu cầu lưu trữ dữ liệu cá nhân trong nước; hạ tầng đặt ở Singapore. Cần người dùng xác nhận trước khi đưa dữ liệu thật lên.
3. CONG_VIEC_73 trước khi bật trên môi trường thật cần hồ sơ pháp lý thu hộ, xác nhận ủy nhiệm hóa đơn và MISA, xác nhận tài khoản kế toán, thử VNPAY môi trường thử nghiệm (tài liệu `03`).
4. CONG_VIEC_72 cần cài ba mẫu ZNS và số tổng đài trước khi triển khai.
5. Gửi email thật chưa có (mục 2).
6. Phiên bản 0.14.0 chưa có tag; lát L1 dựng hạ tầng thử nghiệm được trước, triển khai ứng dụng khi có tag.

## 16. Câu hỏi và lựa chọn chờ người dùng quyết định

| Số | Câu hỏi | Phương án đề xuất | Phương án khác |
|---|---|---|---|
| 1 | Tài khoản AWS | Hai tài khoản riêng (thử nghiệm, thật) trong AWS Organizations | Một tài khoản, tách bằng tên ngăn xếp và nhãn (rẻ công thiết lập, rủi ro thao tác nhầm lên môi trường thật cao hơn) |
| 2 | Đóng gói 12 mini app web | Một ảnh `vcomm-web`, một dịch vụ chạy 12 tiến trình Next.js trong một task (giai đoạn 1, đúng giả định "chung 1 image" ở tài liệu `13` mục 5); tách dịch vụ khi tải tăng. Lệch một phần quyết định kiến trúc 3 ("triển khai riêng"): mini app vẫn build riêng nhưng triển khai cùng lúc | 12 dịch vụ riêng (đúng nguyên văn quyết định 3, thêm ~70 USD/tháng ở môi trường thật, thêm 11 ảnh và thời gian build) |
| 3 | Gửi email thật | Mở công việc riêng (mức Vừa) thêm gửi qua Amazon SES trước khi lên môi trường thật; môi trường thử nghiệm đọc email trong log | Gộp vào CONG_VIEC_76 (sửa mã ứng dụng, phải đi qua phát hành) |
| 4 | Tác vụ nền | Môi trường thử nghiệm chạy trong task `api`; môi trường thật dịch vụ `worker` riêng, cùng ảnh | Thử nghiệm cũng tách `worker` (thêm ~4 USD) |
| 5 | Redis | ElastiCache Valkey (tương thích Redis, rẻ hơn 20%, BullMQ hỗ trợ) | ElastiCache Redis OSS như tài liệu `13` |
| 6 | Ứng dụng di động cho người thử | Bản web (S3 + CloudFront) cho VComm, kho, iPOS; bản Android APK qua EAS Build hồ sơ `preview` (bắt buộc với iPOS vì có thư viện gốc); iOS để sau. Thêm `eas.json` vào ba ứng dụng (không đổi mã chạy) | Dựng APK bằng Gradle trên GitHub Actions, không cần tài khoản Expo (công sức cao hơn, tự giữ khóa ký) |
| 7 | Tên miền, DNS | Người dùng cho biết tên miền và nơi quản lý DNS; ủy quyền tên miền con cho Route 53 | Chuyển toàn bộ DNS sang Route 53; hoặc tạm dùng tên miền mặc định của ALB, CloudFront (không có HTTPS đúng tên cho ALB, cookie và đăng nhập liên kết khó thử) |
| 8 | Vị trí mã | Thư mục mới `infra/` ở gốc (gói pnpm), tệp `.dockerignore` ở gốc, cập nhật tài liệu `12` mục 6, tài liệu `18` mục 6 | Đặt trong `apps/infra` (lệch nghĩa `apps/` là phần chạy của hệ thống) |
| 9 | `NODE_ENV` ở môi trường thử nghiệm | `staging`: bật bộ giả lập, mã OTP ghi log, nạp được dữ liệu thử; cookie phiên không có cờ Secure (mọi kết nối vẫn HTTPS, dữ liệu giả); đề xuất công việc nhỏ riêng thêm biến bật cờ Secure | `production`: mất bộ giả lập hóa đơn, ký số, không nạp được dữ liệu thử |
| 10 | Tài khoản cơ sở dữ liệu | Môi trường thử nghiệm dùng một tài khoản chủ cho ứng dụng và migration; môi trường thật quyết định ở lát L3 (ứng dụng tự tạo partition nhật ký thao tác nên cần quyền tạo bảng trong schema đó, tách tài khoản quyền tối thiểu cần khảo sát thêm) | Tách ngay hai tài khoản ở cả hai môi trường (thêm bước cấp quyền sau mỗi migration) |
| 11 | Giờ chạy môi trường thử nghiệm | Thứ Hai đến thứ Sáu, 7:00 đến 20:00 giờ Việt Nam | Chạy liên tục (~200 USD/tháng) |
| 12 | Thư viện mới | Duyệt `aws-cdk-lib` 2.277.0, `constructs` 10.8.1, `aws-cdk` 2.1148.1, `cdk-nag`; hành động GitHub `aws-actions/*`, `docker/*` ghim mã commit | Không dùng `cdk-nag`, rà bảo mật bằng tay |

## 17. Thành phần không được thay đổi

- Mã nguồn `apps/*`, `packages/*`, `database/migrations` (trừ thêm `eas.json` cho ứng dụng di động nếu chọn mục 16 câu 6).
- `.github/workflows/ci.yml`, `.github/workflows/gan-tag-phat-hanh.yml`.
- Tài liệu sổ dùng chung `02`, `03`, `24`, `25` (gửi phiên điều phối ghi).

## 18. Các lát và điểm xem trước

| Lát | Nội dung | Người dùng xem, thử | Phản hồi, ngày |
|---|---|---|---|
| L1 | Gói `infra` (CDK): ngăn xếp `Account`, `Network`, `Data`, `Application`, `StaticWeb`, `Monitoring` cho môi trường thử nghiệm; Dockerfile và tệp khởi động hai ảnh; kiểm thử `infra`; lệnh khởi tạo CDK và chính sách IAM cho người dùng; dựng môi trường thử nghiệm (khi được duyệt) và triển khai tag mới nhất có sẵn (0.13.1, hoặc 0.14.0 nếu đã có tag) bằng tay theo các bước mục 6.2 | Kết quả `cdk diff`; sau khi dựng: mở `https://staging.<tên miền>`, đăng nhập tài khoản thử, mở các mini app | |
| L2 | Luồng GitHub Actions `trien-khai.yml` (OIDC), `bat-tat-thu-nghiem.yml`, tệp lệnh `infra/scripts/deploy.sh`; sao lưu, migration, kiểm tra sau triển khai tự động; bản web ứng dụng di động lên S3 + CloudFront; `eas.json` và bản Android; diễn tập quay lui; tài liệu `26` | Bấm chạy luồng triển khai 0.14.0 lên môi trường thử nghiệm; cài APK VComm, iPOS; xem biên bản tài liệu `26` | |
| L3 | Môi trường thật giai đoạn 1: cấu hình kích thước, NAT, WAF, 2 vùng sẵn sàng, bảo vệ khi xóa, cảnh báo; tài khoản cơ sở dữ liệu; triển khai khi các điểm chặn mục 15 đã gỡ và người dùng duyệt | `cdk diff` môi trường thật; sau khi được duyệt: kiểm tra sau triển khai | |

Mã cần cấp khi người dùng duyệt đặc tả: TIEUCHI_NGHIEMTHU (10, theo mục 13), KICHBAN_KIEMTHU (khoảng 14: mỗi tiêu chí một kịch bản đúng, thêm kịch bản sai cho tiêu chí 4, 5, 7, 8). Không cần YCAU_NGHIEPVU, QUYTAC_NGHIEPVU, CHUC_NANG, MAN_HINH, API, database migration (không đổi nghiệp vụ, giao diện, dữ liệu). Tài liệu `26` lập mới ở lát L2.

## 19. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu (chưa viết mã).

## 20. Phương án Supabase + Cloudflare (người dùng chọn triển khai trước, 2026-11-18)

### 20.1 Quyết định của người dùng ngày 2026-11-18 và cách áp dụng

| Mục 16 | Quyết định | Áp dụng ở phương án mới |
|---|---|---|
| Câu 1 tài khoản AWS | Triển khai trước trên Supabase và Cloudflare; AWS để sau | Mục 20 thay mục 4 đến 10 cho đợt này |
| Câu 2 mini app | Chung một dịch vụ | Giữ: một ảnh `vcomm-web` chạy 12 tiến trình Next.js |
| Câu 3 email | Công việc riêng (SES) | Giữ là công việc riêng; nhà cung cấp email chọn lại khi làm (SES, Resend, hoặc khác), không còn gắn với AWS |
| Câu 4 tác vụ nền | Chung tiến trình API ở môi trường thử nghiệm | Giữ |
| Câu 5 Valkey | Duyệt | Không còn hợp (không có ElastiCache); thay bằng Redis của nền tảng chạy container hoặc Upstash (mục 20.3) |
| Câu 6 di động | Bản web + APK qua EAS Build | Giữ; bản web đặt trên Cloudflare Pages |
| Câu 7 tên miền | Chưa trả lời | Còn mở (mục 20.12 câu 5): Cloudflare cần quản lý DNS của cả tên miền |
| Câu 8 thư mục `infra/` | Duyệt | Giữ thư mục, nhưng chứa Dockerfile, cấu hình nền tảng, tệp lệnh triển khai; không có mã CDK |
| Câu 9 `NODE_ENV=staging` | Duyệt | Giữ |
| Câu 10 một tài khoản cơ sở dữ liệu | Duyệt | Giữ: vai trò `postgres` của Supabase |
| Câu 11 giờ chạy | Duyệt | Không áp dụng: nền tảng mới tính tiền theo mức dùng, tắt ngoài giờ làm mất lịch tác vụ nền; chạy liên tục |
| Câu 12 thư viện CDK | Duyệt | Không dùng ở đợt này |

### 20.2 Kết quả kiểm tra tương thích (2026-11-18)

1. Database migration trên PostgreSQL 17 (phiên bản dự án Supabase mới dùng): chạy toàn bộ 145 tệp của nhánh `phat-hanh/v0.14.0` trên `postgres:17`, bằng vai trò không phải SUPERUSER (chủ cơ sở dữ liệu, như vai trò `postgres` của Supabase): đạt cả 145 tệp. Kết quả: 17 schema, extension `citext` (extension "trusted", tạo được không cần SUPERUSER), không có bảng nào trong schema `public` ngoài `public.schema_migrations` do bộ chạy tạo.
2. Không chạy bộ kiểm thử tự động trên PostgreSQL 17 (CI vẫn chạy PostgreSQL 16). Lát L1 chạy thêm toàn bộ kiểm thử trên `postgres:17` một lần trước khi triển khai.
3. Kiểm thử cần SUPERUSER: chỉ `apps/api/test/c60-fraud.test.ts` dùng `SET session_replication_role`. Kiểm thử chạy trên PostgreSQL của CI, không chạy trên Supabase, nên không bị ảnh hưởng.
4. Bộ chạy migration dùng `pg_advisory_lock` mức phiên: phải nối qua kết nối trực tiếp hoặc Supavisor chế độ phiên (cổng 5432), không qua chế độ giao dịch (cổng 6543). Mã dùng `pg_advisory_xact_lock`, `FOR UPDATE SKIP LOCKED`, không dùng câu lệnh `SET` mức phiên, không dùng prepared statement có tên, nên ứng dụng chạy được qua Supavisor chế độ phiên.
5. Lưu tệp: `S3FileStorage` chỉ đặt `region`, không đặt `endpoint`, `forcePathStyle`, và luôn gửi `ServerSideEncryption: "AES256"`. Supabase Storage, Cloudflare R2 cần `endpoint` riêng (Supabase cần thêm `forcePathStyle`); R2 chưa xác nhận nhận tiêu đề này. Muốn dùng hai dịch vụ này phải sửa mã (mục 20.12 câu 3).
6. Mini app web: không có mã phía máy chủ đọc biến môi trường, không có `middleware`, `proxy`; mọi gọi API đi qua `rewrites` (đọc lúc build). Ảnh `vcomm-web` build một lần dùng được mọi môi trường nếu tên nội bộ của API giống nhau.

### 20.3 Ánh xạ thành phần

| Thành phần | AWS (mục 4, 5) | Phương án đề xuất | Phương án khác, rủi ro |
|---|---|---|---|
| PostgreSQL | Aurora PostgreSQL 16 | Supabase Postgres 17, vùng Singapore (`ap-southeast-1`), compute Micro (thử nghiệm), Small (thật). Ứng dụng và migration nối Supavisor chế độ phiên cổng 5432 (có IPv4, miễn phí); tắt Data API (PostgREST) vì không dùng và tránh lộ schema `public` | Kết nối trực tiếp (chỉ IPv6, hoặc mua IPv4 4 USD/tháng) |
| API NestJS, tác vụ nền | ECS Fargate | Dịch vụ container chạy liên tục ở Singapore, cùng thành phố với Supabase: **Railway** vùng Singapore (phiên điều phối có công cụ kết nối Railway) | Cloudflare Containers: GA tháng 4/2026 nhưng không chọn được Singapore (ràng buộc theo vùng lớn APAC, task khởi động lại có thể đổi nơi chạy), thiết kế ngủ khi rảnh, không bảo đảm chạy liên tục; mỗi yêu cầu API gọi cơ sở dữ liệu nhiều lần nên trễ cộng dồn; lịch BullMQ (0 giờ 10, mỗi 15 phút) có thể lỡ. Fly.io vùng Singapore: tương đương Railway |
| 12 mini app Next.js | ECS, ảnh `vcomm-web` | Chung ảnh `vcomm-web` trên Railway, cùng mạng riêng với API (`http://api.railway.internal:4000`) | Cloudflare Workers qua OpenNext (`@opennextjs/cloudflare` hỗ trợ Next.js từ 16.2.3): 12 Worker, thư viện mới, `rewrites` sang máy chủ ngoài cần thử từng ứng dụng; rẻ hơn, công sức Cao; để sau |
| Redis (BullMQ, giới hạn số lần thử) | ElastiCache Valkey | Redis của Railway (cùng mạng riêng, không ra Internet) | Upstash Redis gói cố định 250 MB (~10 USD/tháng; Upstash khuyên không dùng gói tính theo lệnh cho BullMQ vì BullMQ hỏi Redis liên tục) |
| Lưu tệp đính kèm | S3 | Thử nghiệm: ổ đĩa bền (volume) của Railway, `STORAGE_DRIVER=local`, không sửa mã. Thật: Supabase Storage qua giao thức S3 (cùng vùng Singapore với cơ sở dữ liệu, gói Pro có 100 GB) sau khi sửa mã mục 20.2 điểm 5 | Cloudflare R2 (không tốn phí truyền ra, gợi ý vùng APAC, không chọn được Singapore) |
| Bản web ứng dụng VComm, kho, iPOS | S3 + CloudFront | Cloudflare Pages (tệp tĩnh `expo export`) | |
| DNS, chứng chỉ, chống tấn công | Route 53, ACM, WAF | Cloudflare (gói miễn phí): DNS, chứng chỉ, proxy chống DDoS cho `staging.<tên miền>`, `api.staging.<tên miền>`; Railway cấp chứng chỉ cho tên miền riêng | Gói Cloudflare Pro (WAF có quy tắc quản lý) cho môi trường thật |
| Khóa bí mật | Secrets Manager, KMS | Biến bí mật của Railway (mã hóa khi lưu), biến bí mật của môi trường GitHub | |
| Sao lưu | Bản chụp Aurora | Supabase sao lưu hằng ngày (Pro, giữ 7 ngày); trước mỗi lần triển khai `pg_dump` (bản 17) từ GitHub Actions, mã hóa, lưu vào bucket riêng tư | PITR của Supabase (100 USD/tháng, 7 ngày) cho môi trường thật |
| Log, cảnh báo | CloudWatch | Log của Railway (giữ theo gói), cảnh báo email khi dịch vụ dừng của Railway; theo dõi trang `GET /api/v1/auth/methods` bằng Cloudflare Health Checks (gói trả phí) hoặc dịch vụ theo dõi ngoài | |

### 20.4 Hạ tầng từng môi trường

| Hạng mục | Thử nghiệm | Thật giai đoạn 1 |
|---|---|---|
| Supabase | Dự án `vcomm-staging`, gói Pro, compute Micro, vùng Singapore | Dự án riêng `vcomm-production`, compute Small, PITR 7 ngày (đề xuất), tổ chức Supabase bật xác thực hai lớp |
| Railway | Dự án `vcomm`, môi trường `staging`: dịch vụ `api` (1 bản, `BACKGROUND_JOBS=enabled`, volume tệp đính kèm), `web` (1 bản), `redis` | Môi trường `production` (cùng dự án hoặc dự án riêng): `api` 2 bản (`BACKGROUND_JOBS=disabled`), `worker` 1 bản, `web` 2 bản, `redis` |
| Cloudflare | Vùng DNS của tên miền; bản ghi `staging`, `api.staging` trỏ tới Railway (bật proxy); Pages: `app.staging`, `kho.staging`, `ipos.staging` | Như thử nghiệm, bỏ `staging.` |

### 20.5 Quy trình triển khai từ tag

Các bước giống mục 6.2, đổi nơi chạy:

1. Kiểm tag chứa mọi bản vá khẩn cấp đã triển khai.
2. Build hai ảnh `linux/amd64` từ tag bằng Dockerfile ở `infra/docker` của `main`, đẩy lên GitHub Container Registry (riêng tư), nhãn là mã phiên bản.
3. Ghi nhận nhãn ảnh đang chạy của từng dịch vụ.
4. Sao lưu: `pg_dump --format=custom` cơ sở dữ liệu Supabase, mã hóa bằng `age` khóa công khai của người dùng, lưu bucket riêng tư; lỗi thì dừng.
5. Database migration: chạy `node apps/api/dist/database/run-migrations.js` trong ảnh mới, từ GitHub Actions, nối Supavisor chế độ phiên; lỗi thì dừng.
6. Lần đầu ở môi trường thử nghiệm: nạp dữ liệu thử (`seed.js`); từ chối ở môi trường thật.
7. Đổi nhãn ảnh của dịch vụ `api`, `worker`, `web` trên Railway (API hoặc CLI của Railway), chờ triển khai xong và kiểm tra sống đạt (Railway giữ bản cũ chạy đến khi bản mới đạt kiểm tra sống).
8. Build bản web ứng dụng di động với `EXPO_PUBLIC_API_URL` của môi trường, tải lên Cloudflare Pages.
9. Kiểm tra sau triển khai như mục 6.2 bước 9.
10. Ghi biên bản tài liệu `26`.

- Chạy bằng GitHub Actions `trien-khai.yml` (chạy tay, đầu vào tag và môi trường; môi trường GitHub `production` bắt người dùng duyệt). Railway, Supabase, Cloudflare không nhận OIDC của GitHub: dùng token giới hạn phạm vi lưu trong biến bí mật của từng môi trường GitHub: token dự án Railway theo môi trường; chuỗi kết nối cơ sở dữ liệu; token API Cloudflare chỉ có quyền Pages của tài khoản. Không lưu khóa ở mã nguồn.
- Từ máy phiên AI: cùng tệp lệnh `infra/scripts/deploy.sh`, token đặt ở cài đặt môi trường phiên (người dùng tự thêm); chỉ chạy khi người dùng duyệt lần đó.

### 20.6 Quay lui

| Tình huống | Cách quay lui |
|---|---|
| Bản mới không qua kiểm tra sống | Railway giữ bản cũ chạy |
| Lỗi sau khi bản mới chạy, migration tương thích ngược | Đổi lại nhãn ảnh cũ (bước 7); theo phương án quay lui của phiên bản trong tài liệu `23` |
| Dữ liệu sai | Khi người dùng đồng ý: `pg_restore` bản sao lưu ở bước 4 vào dự án Supabase mới (hoặc phục hồi bản sao lưu hằng ngày, PITR), đổi chuỗi kết nối, triển khai nhãn ảnh cũ |

### 20.7 Biến môi trường

Giữ bảng mục 7, khác ở các dòng sau:

| Biến | Thử nghiệm | Thật |
|---|---|---|
| `DATABASE_URL` (bí mật, đặt thẳng, không ghép từ JSON) | Supavisor chế độ phiên của `vcomm-staging`, `sslmode=require` | Như thử nghiệm, dự án `vcomm-production` |
| `REDIS_URL` | `redis://` mạng riêng Railway (biến tham chiếu của dịch vụ `redis`) | Như thử nghiệm |
| `STORAGE_DRIVER`, `STORAGE_DIRECTORY` | `local`, đường dẫn volume Railway | `s3` sau khi sửa mã (mục 20.12 câu 3) |
| `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, biến địa chỉ máy chủ S3 (thêm khi sửa mã) | Không đặt | Bucket Supabase Storage, vùng `ap-southeast-1`, khóa S3 của Supabase (bí mật) |
| `API_ORIGIN` lúc build `vcomm-web` | `http://api.railway.internal:4000` | Như thử nghiệm |
| `API_PORT` | `4000` (Railway đặt `PORT`; khai báo cổng 4000 cho dịch vụ) | Như thử nghiệm |

Không còn: bí mật Aurora tách khóa, khóa KMS. `ACCESS_TOKEN_SECRET`, `MFA_SECRET_KEY` sinh ngẫu nhiên một lần (AI sinh trên máy phiên và đặt thẳng vào Railway qua API, không in ra) và không bao giờ sinh lại.

### 20.8 Ước tính chi phí hằng tháng (USD)

Giá tra ngày 2026-11-18 từ trang giá và bài tổng hợp, chưa kiểm trên tài khoản: Supabase Pro 25 (gồm 10 tín dụng compute: Micro 10, Small 15), PITR 7 ngày 100; Railway 20 mỗi vCPU-tháng, 10 mỗi GB RAM-tháng, 0,15 mỗi GB volume-tháng, 0,05 mỗi GB truyền ra; gói Hobby 5 (gồm 5 mức dùng), Pro 20 mỗi chỗ (gồm 20 mức dùng); Cloudflare gói miễn phí cho DNS, Pages; Upstash cố định 250 MB 10.

| Hạng mục | Thử nghiệm | Thật giai đoạn 1 |
|---|---|---|
| Supabase | 25 (Pro, Micro) | ~130 (Pro, Small, PITR 7 ngày); ~30 nếu không PITR |
| Railway: `api` (thử nghiệm ~0,5 GB, 0,1 vCPU trung bình; thật 2 × 1 GB) | ~7 | ~30 |
| Railway: `worker` | 0 | ~15 |
| Railway: `web` (~1,5 GB mỗi bản) | ~17 | ~40 |
| Railway: `redis`, volume, truyền ra | ~2 | ~5 |
| Railway gói (Pro 20, trừ vào mức dùng) | Mức dùng ~26 > 20 nên ~26 | ~90 |
| Cloudflare | 0 | 0 (Free) hoặc 20 (Pro, WAF) |
| Bucket sao lưu (R2, trong hạn mức miễn phí 10 GB) | 0 | 0 |
| **Cộng** | **~51** | **~140 không PITR; ~240 có PITR, ~260 thêm Cloudflare Pro** |

- Gói rẻ nhất cho thử nghiệm: Supabase Free (0, dừng dự án sau 7 ngày không dùng, không có sao lưu hằng ngày, 500 MB) + Railway Hobby (5) ~ 31 USD; không đề xuất vì dự án bị dừng và không có sao lưu.
- Ngoài: tên miền; eSMS; Anthropic; EAS; Apple Developer, Google Play khi phát hành.

### 20.9 Giới hạn gói và rủi ro

1. Supabase Pro: sao lưu hằng ngày giữ 7 ngày; 8 GB cơ sở dữ liệu kèm theo; Micro 1 GB RAM, 60 kết nối trực tiếp. Hiện 145 migration, dữ liệu giả nhỏ.
2. Railway: một volume chỉ gắn một bản chạy, nên `api` ở thử nghiệm chỉ 1 bản (đủ). Redis của Railway không có bản dự phòng: mất Redis thì mất hàng đợi đang chờ, lịch BullMQ tự tạo lại khi `worker` khởi động; dữ liệu nghiệp vụ nằm ở PostgreSQL. Môi trường thật nếu cần dự phòng thì chuyển Upstash gói cố định.
3. Dữ liệu lưu ở Singapore (Supabase, Railway): điểm chặn tài liệu `12` mục 7 không đổi.
4. Ba nhà cung cấp (Supabase, Railway, Cloudflare) thay vì một: nhiều tài khoản, nhiều token cần quản lý; ghi trong tài liệu `22` mục 5.
5. Cloudflare Containers không dùng cho API vì không đặt được ở Singapore và không bảo đảm chạy liên tục (mục 20.3); xem lại khi Cloudflare có ràng buộc vị trí theo thành phố.

### 20.10 Ai làm bước nào

| Bước | Người dùng | Phiên điều phối (có công cụ Supabase, Cloudflare, Railway) | Phiên CONG_VIEC_76 |
|---|---|---|---|
| Tạo tổ chức, tài khoản, thanh toán Supabase, Railway, Cloudflare | Làm | | |
| Chuyển máy chủ tên miền (NS) sang Cloudflare | Làm ở nơi mua tên miền | | Soạn hướng dẫn |
| Tạo dự án Supabase `vcomm-staging` (Singapore, Pro), tắt Data API | Duyệt | Làm sau khi người dùng duyệt (hoặc người dùng tự làm) | Soạn cấu hình cần chọn |
| Tạo dự án, dịch vụ, volume Railway; tên miền riêng; thông tin đăng nhập kho ảnh | Duyệt | Làm, hoặc phiên CONG_VIEC_76 làm qua token Railway | Soạn cấu hình (tài liệu `26` mục 1.2) |
| Bản ghi DNS, dự án Pages trên Cloudflare | Duyệt | Làm | Soạn danh sách bản ghi |
| Nhập khóa bí mật dịch vụ ngoài (VNPAY thử nghiệm) | Tự nhập ở Railway; không dán vào trò chuyện | | |
| Tạo môi trường GitHub `staging`, `production`, người duyệt; thêm token vào biến bí mật môi trường | Làm | | Soạn danh sách token và phạm vi quyền |
| Dockerfile, luồng GitHub Actions, tệp lệnh, tài liệu `26` | | | Làm (lát L1, L2) |
| Mỗi lần triển khai | Duyệt | | Chạy |

### 20.11 Lát (thay mục 18 cho đợt này)

| Lát | Nội dung | Người dùng xem, thử |
|---|---|---|
| L1 | `infra/docker` (hai Dockerfile, tệp khởi động 12 Next.js), `.dockerignore`; chạy toàn bộ kiểm thử trên PostgreSQL 17; build thử hai ảnh trên máy phiên; cấu hình Railway; tạo tài nguyên thử nghiệm (khi được duyệt); triển khai tag mới nhất có sẵn bằng tay theo mục 20.5 | Mở `https://staging.<tên miền>`, đăng nhập tài khoản thử, mở 11 mini app |
| L2 | `trien-khai.yml`, `infra/scripts/deploy.sh`, sao lưu `pg_dump`, migration, kiểm tra sau triển khai; bản web di động lên Pages; `eas.json`, APK; diễn tập quay lui; tài liệu `26` | Bấm chạy luồng triển khai 0.14.0; cài APK |
| L3 | Môi trường thật khi gỡ các điểm chặn mục 15 | `diff` cấu hình; kiểm tra sau triển khai |

Công việc riêng đề xuất: (a) gửi email thật; (b) lưu tệp qua dịch vụ S3 khác AWS (biến địa chỉ máy chủ, kiểu đường dẫn, bỏ tiêu đề mã hóa khi không hỗ trợ), mức Nhỏ, cần trước môi trường thật; (c) cờ Secure của cookie ở môi trường thử nghiệm.

### 20.12 Câu hỏi còn mở

| Số | Câu hỏi | Đề xuất | Khác |
|---|---|---|---|
| 1 | Nơi chạy API, tác vụ nền, 12 mini app | Railway vùng Singapore (cùng thành phố với Supabase, chạy liên tục, có Redis, volume) | Cloudflare Containers (rủi ro mục 20.3, 20.9 điểm 5); Fly.io Singapore |
| 2 | Redis | Redis của Railway | Upstash gói cố định 250 MB (~10 USD) |
| 3 | Lưu tệp | Thử nghiệm: volume Railway, không sửa mã; thật: Supabase Storage sau công việc sửa mã (b) | Mở công việc (b) ngay, thử nghiệm cũng dùng Supabase Storage hoặc R2 |
| 4 | Gói Supabase cho thử nghiệm | Pro (25 USD, không bị dừng, có sao lưu hằng ngày) | Free (bị dừng sau 7 ngày không dùng, không sao lưu) |
| 5 | Tên miền | Người dùng cho biết tên miền; chuyển NS sang Cloudflare (gói miễn phí). Cloudflare chỉ ủy quyền tên miền con ở gói Enterprise | Chưa có tên miền: tạm dùng địa chỉ `*.up.railway.app`, `*.pages.dev` (cookie, đăng nhập liên kết, webhook thử được, đổi sau) |
| 6 | Kho ảnh container | GitHub Container Registry riêng tư (không thêm tài khoản) | Railway tự build từ kho GitHub theo tag (không cần kho ảnh, nhưng build lại mỗi môi trường) |
| 7 | Sao lưu trước triển khai lưu ở đâu | Bucket R2 riêng tư, mã hóa bằng khóa `age` của người dùng | Bucket Supabase Storage riêng tư |
| 8 | Môi trường thật | Railway Pro, Supabase Small + PITR 7 ngày, Cloudflare Free; Cloudflare Pro khi mở cho người dùng ngoài | Không PITR (chỉ sao lưu hằng ngày 7 ngày) |

## 21. Quyết định của người dùng (2026-11-18, lần 2)

1. Triển khai đợt đầu trên Supabase + Railway + Cloudflare; AWS để sau. Phiếu THAY_DOI_40.
2. Môi trường thật: sao lưu hằng ngày giữ 7 ngày và bật PITR 7 ngày (~240 USD/tháng); chấp nhận giảm thời gian giữ sao lưu từ 35 xuống 7 ngày ở đợt này.
3. Dùng tên miền riêng ngay, chuyển DNS sang Cloudflare. Tên miền: `vcomm.vn` (mục 25).
5. Tạm tắt sao lưu tự động trước khi triển khai ở môi trường thử nghiệm (dữ liệu giả): tham số của luồng, mặc định tắt; môi trường thật luôn sao lưu, không tắt được. Supabase Pro vẫn sao lưu hằng ngày. R2 và khóa age chỉ cần khi lên môi trường thật.
4. Duyệt mọi đề xuất kỹ thuật còn lại ở mục 20.12: Railway vùng Singapore cho API, tác vụ nền, mini app; Redis của Railway; thử nghiệm lưu tệp trên volume Railway, thật dùng Supabase Storage sau công việc sửa mã nhỏ; Supabase Pro cho thử nghiệm; kho ảnh GitHub Container Registry riêng tư; sao lưu trước triển khai lên R2, mã hóa bằng age.

## 22. Phiếu THAY_DOI_40 (nội dung gửi phiên điều phối ghi tài liệu `24`)

- Tiêu đề: Đổi nền tảng triển khai đợt đầu từ AWS sang Supabase, Railway, Cloudflare; AWS để sau.
- Người yêu cầu, ngày: người dùng, 2026-11-18 (trả lời đặc tả CONG_VIEC_76).
- Nội dung: tài liệu `12` mục 2 điểm 9, mục 4, mục 5, mục 6 (thư mục `infra/`); tài liệu `13` mục 1 (cơ sở dữ liệu, Redis, lưu tệp, chạy ứng dụng, hạ tầng bằng mã, bí mật hệ thống, giám sát); tài liệu `22` mục 5 (nơi lưu khóa, token mới); tài liệu `18` mục 6 (thư mục `infra/`, tệp `.dockerignore`); lập tài liệu `26`.
- Lý do: người dùng muốn tự kiểm sớm, chi phí thấp (thử nghiệm ~51 so với ~110 USD/tháng).
- Ảnh hưởng: không đổi nghiệp vụ, API, dữ liệu, giao diện. Mã ứng dụng: lưu tệp qua dịch vụ S3 khác AWS cần sửa nhỏ trước môi trường thật (công việc riêng). Rủi ro: ba nhà cung cấp; Redis không có bản dự phòng; dữ liệu ở Singapore (điểm chặn tài liệu `12` mục 7 không đổi); thời gian giữ sao lưu giảm còn 7 ngày (người dùng chấp nhận).
- Kiểm thử cần: database migration và toàn bộ kiểm thử tự động trên PostgreSQL 17; kiểm tra sau triển khai theo tài liệu `26`.
- Mức: Lớn. Trạng thái: Đã phê duyệt (người dùng, 2026-11-18).

## 23. Tiêu chí nghiệm thu và kịch bản kiểm thử

Mã do phiên điều phối cấp ngày 2026-11-18: TIEUCHI_NGHIEMTHU_590 đến 601, KICHBAN_KIEMTHU_810 đến 826. Ghi ở tài liệu `11`, `21`, `27`.

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_590 | Hai ảnh build được từ tag; không chứa `.env`, khóa bí mật, mã nguồn kiểm thử; quét ảnh không còn lỗ hổng Nghiêm trọng, Cao chưa xử lý | Bắt buộc | KICHBAN_KIEMTHU_810 |
| TIEUCHI_NGHIEMTHU_591 | Toàn bộ database migration và kiểm thử tự động đạt trên PostgreSQL 17 | Bắt buộc | KICHBAN_KIEMTHU_811 |
| TIEUCHI_NGHIEMTHU_592 | Môi trường thật: HTTPS đúng tên miền (`erp.vcomm.vn`, `api.vcomm.vn`), đăng nhập quản trị tập đoàn, mở 11 mini app | Bắt buộc | KICHBAN_KIEMTHU_812 |
| TIEUCHI_NGHIEMTHU_593 | Bản web ứng dụng VComm, kho, iPOS (`app`, `kho`, `ipos.vcomm.vn`) gọi được API môi trường thật; APK Android cài và đăng nhập được | Bắt buộc | KICHBAN_KIEMTHU_813 |
| TIEUCHI_NGHIEMTHU_594 | Tệp đính kèm tải lên, tải xuống được, còn sau khi khởi động lại hoặc đổi bản chạy của dịch vụ `api` | Bắt buộc | KICHBAN_KIEMTHU_814 |
| TIEUCHI_NGHIEMTHU_595 | Tác vụ nền chạy theo lịch ở dịch vụ `worker`, không chạy trùng ở `api` | Bắt buộc | KICHBAN_KIEMTHU_815 |
| TIEUCHI_NGHIEMTHU_596 | Luồng triển khai chạy đủ bước; luôn có bản sao lưu mã hóa trước migration (không tắt được); migration chạy lại không còn tệp mới | Bắt buộc | KICHBAN_KIEMTHU_816, 822 |
| TIEUCHI_NGHIEMTHU_597 | Luồng chặn đúng: nạp dữ liệu thử bị từ chối; môi trường `production` cần người duyệt; migration khi chưa sao lưu bị từ chối; tag thiếu bản vá khẩn cấp thì dừng | Bắt buộc | KICHBAN_KIEMTHU_817, 823, 824 |
| TIEUCHI_NGHIEMTHU_598 | Quay lui: triển khai lại ảnh cũ; phục hồi bản sao lưu sang cơ sở dữ liệu khác | Bắt buộc | KICHBAN_KIEMTHU_818, 825 |
| TIEUCHI_NGHIEMTHU_599 | Bảo mật phần D: Data API tắt; Redis không ra Internet; khóa không có trong mã, log; token phạm vi tối thiểu; cookie có cờ Secure | Bắt buộc | KICHBAN_KIEMTHU_819, 826 |
| TIEUCHI_NGHIEMTHU_600 | Tài liệu `26` đủ môi trường, các bước, quay lui, biên bản | Bắt buộc | KICHBAN_KIEMTHU_820 |
| TIEUCHI_NGHIEMTHU_601 | Cấu hình môi trường thật: `NODE_ENV=production`, bộ giả lập tắt, `api` và `web` 2 bản, `worker` riêng, Supabase Small, PITR 7 ngày | Bắt buộc | KICHBAN_KIEMTHU_821 |

## 24. Lát L1 – kết quả (2026-11-18)

Đã làm (không tạo tài nguyên):
- `infra/docker/api.Dockerfile`: build `api` và gói phụ thuộc, cài lại chỉ thư viện chạy, bỏ mã nguồn, kiểm thử; giữ `apps/api/dist`, `database/migrations`; chạy bằng người dùng `node`.
- `infra/docker/web.Dockerfile`, `infra/docker/start-web.mjs`: build 12 mini app với `API_ORIGIN=http://api.railway.internal:4000`, một tiến trình khởi động 12 `next start` (Nền tảng nghe `PORT`, mini app khác nghe localhost đúng cổng mặc định); một mini app dừng thì dừng container.
- `.dockerignore` (không đưa `.env`, `.git`, tài liệu, thư mục build vào ảnh).
- `infra/scripts/deploy.sh`: các bước `check-tag`, `build`, `record`, `backup`, `migrate`, `seed`, `release`, `verify`, `rollback` (tài liệu `26` mục 2); `infra/emergency-patches.txt`.
- `.github/workflows/trien-khai.yml` (chạy tay từ `main`, môi trường GitHub `staging`/`production`), `.github/workflows/kiem-tra-anh.yml` (build thử hai ảnh khi đổi Dockerfile).
- Tài liệu `26` bản nháp; cập nhật tài liệu `12`, `13`, `18`, `22`, `index` theo THAY_DOI_40.

Kiểm tra:
- Tự kiểm tệp lệnh: `check-tag` đạt với `v0.13.1`; dừng khi tag thiếu bản vá khẩn cấp, khi tag không tồn tại; `seed` bị từ chối ở `production`; môi trường không hợp lệ bị từ chối.
- Build ảnh trên máy phiên: không làm được (proxy mạng của phiên dùng chứng chỉ riêng, không được phép chèn vào ảnh). Build kiểm bằng luồng `kiem-tra-anh.yml` trên GitHub Actions.
- Build `api` và gói phụ thuộc bằng `pnpm` trên mã `phat-hanh/v0.14.0`: đạt.
- Kiểm thử trên PostgreSQL 17: xem mục 24.1.

### 24.1 Kiểm thử trên PostgreSQL 17 (TIEUCHI_NGHIEMTHU_591, KICHBAN_KIEMTHU_811)

- 2026-11-18: mã nhánh `phat-hanh/v0.14.0` (commit `f439c11d`), `postgres:17` (17.12), `redis:7`, `vitest run` của `apps/api`: 177 tệp, 986 kiểm thử, đạt cả 986, 1384 giây. Chạy lại trên mã 0.14.1 trước lần triển khai đầu.
- Database migration 145 tệp trên PostgreSQL 17 bằng vai trò không phải SUPERUSER: đạt (mục 20.2).

### 24.2 Quét lỗ hổng ảnh (người dùng duyệt Trivy 2026-11-18)

- `aquasecurity/trivy-action` v0.36.0 (phát hành 2026-04-22, Apache 2.0) ghim mã commit `ed142fd0673e97e23eac54620cfb913e5ce36c25`; thêm vào `kiem-tra-anh.yml` (sau bước build) và `trien-khai.yml` (sau build, trước sao lưu, migration); `severity: HIGH,CRITICAL`, `ignore-unfixed: true`, `exit-code: 1`.
- Lần chạy đầu (commit `9cccd71d`): ảnh api bị chặn 10 lỗ hổng HIGH đã có bản vá, đều trong npm đi kèm ảnh nền `node:22` (`/usr/local/lib/node_modules/npm`: brace-expansion, ip-address, pacote, picomatch, sigstore, metavuln-calculator); mã ứng dụng và gói hệ điều hành Debian 12 có 0 lỗ hổng. Sửa: bỏ npm, npx, corepack ở tầng chạy của hai Dockerfile (commit `a6842bfd`).
- Lần chạy lại (commit `a6842bfd`, 2026-11-18): build ảnh api, web đạt; quét Trivy hai ảnh không còn lỗ hổng HIGH, CRITICAL đã có bản vá; kiểm nội dung ảnh đạt; nạp mô-đun bộ chạy migration trong ảnh api đạt. KICHBAN_KIEMTHU_810: Đạt. Kiểm tra kiểu, lint, kiểm thử, quét bảo mật của CI: đạt.

Chưa làm, chờ tài nguyên hoặc lát L2: chạy thật các bước `record`, `backup`, `migrate`, `release`, `verify` (cần tài khoản, token); bản web di động lên Cloudflare Pages; `eas.json`, APK.

## 25. Tên miền `vcomm.vn` (đề xuất ban đầu, đã thay bằng mục 26.1)

| Dùng cho | Thử nghiệm | Thật |
|---|---|---|
| Web quản trị, mọi mini app theo đường dẫn | `erp-staging.vcomm.vn` | `erp.vcomm.vn` |
| API, webhook, trang trả về cổng thanh toán, trang chia sẻ, tệp liên kết ứng dụng | `api-staging.vcomm.vn` | `api.vcomm.vn` |
| Bản web ứng dụng VComm | `app-staging.vcomm.vn` | `app.vcomm.vn` |
| Bản web ứng dụng kho | `kho-staging.vcomm.vn` | `kho.vcomm.vn` |
| Bản web iPOS | `ipos-staging.vcomm.vn` | `ipos.vcomm.vn` |
| Gốc `vcomm.vn`, `www` | Không dùng | Dành cho trang giới thiệu; tạm chuyển hướng sang `app.vcomm.vn` |

- Tên miền con một cấp, nối `-staging`: chứng chỉ miễn phí `*.vcomm.vn` (Universal SSL) của Cloudflare chỉ bao phủ một cấp; dạng `api.staging.vcomm.vn` cần Advanced Certificate Manager (trả phí) khi bật proxy.
- Mini app theo đường dẫn, không theo tên miền con: kiến trúc đã duyệt dùng chung tên miền, cookie phiên HttpOnly, CSRF (tài liệu `12` mục 3a); đổi sang tên miền con phải sửa mã và cookie.
- Biến theo tên miền ở môi trường thử nghiệm: `WEB_ORIGIN=https://erp-staging.vcomm.vn`, `SHARE_PUBLIC_URL=https://api-staging.vcomm.vn`, `VCOMM_WEB_URL=https://app-staging.vcomm.vn`, `APP_WEB_ORIGINS=https://app-staging.vcomm.vn,https://kho-staging.vcomm.vn,https://ipos-staging.vcomm.vn`, `VNPAY_RETURN_URL=https://api-staging.vcomm.vn/api/v1/public/payments/vnpay/return`; ứng dụng di động build với `EXPO_PUBLIC_API_URL=https://api-staging.vcomm.vn/api/v1`.

Đổi máy chủ tên miền (NS) của `vcomm.vn` sang Cloudflare (người dùng làm):
1. Cloudflare: Add a domain, nhập `vcomm.vn`, chọn gói Free; Cloudflare quét bản ghi DNS hiện có: đối chiếu với bản ghi đang dùng ở nhà đăng ký (đặc biệt MX, TXT của email) trước khi đổi để không mất email.
2. Ghi lại hai máy chủ tên miền Cloudflare cấp (dạng `xxx.ns.cloudflare.com`).
3. Ở nhà đăng ký tên miền `.vn` (trang quản lý tên miền của nhà đăng ký): tắt DNSSEC nếu đang bật; mục đổi máy chủ tên miền (DNS, nameserver), thay toàn bộ máy chủ cũ bằng hai máy chủ Cloudflare. Một số nhà đăng ký `.vn` yêu cầu tên miền đã đủ hồ sơ chủ thể với VNNIC mới cho đổi; nếu bị từ chối, liên hệ nhà đăng ký.
4. Chờ Cloudflare báo Active (thường vài giờ, có thể tới 24 đến 48 giờ). Sau đó bật lại DNSSEC từ Cloudflare nếu muốn (thêm bản ghi DS ở nhà đăng ký).
5. Báo phiên điều phối khi Active để tạo bản ghi cho các tên miền con.

## 26. Quyết định "chỉ môi trường thật" (người dùng, 2026-11-18)

Người dùng không dựng môi trường thử nghiệm riêng; dựng một môi trường thật ở chế độ thật từ đầu: `NODE_ENV=production`, dữ liệu thật, bộ giả lập tắt, sao lưu trước mỗi lần triển khai bắt buộc, PITR 7 ngày, Supabase Small, Railway Pro, `api` và `web` 2 bản, `worker` riêng. Nội dung về môi trường thử nghiệm ở mục 20 đến 25 không áp dụng cho đợt đầu.

### 26.1 Tên miền

| Dùng cho | Địa chỉ |
|---|---|
| Web quản trị, mọi mini app theo đường dẫn | `erp.vcomm.vn` |
| API, webhook, trang trả về cổng thanh toán, trang chia sẻ, tệp liên kết ứng dụng | `api.vcomm.vn` |
| Bản web ứng dụng VComm, kho, iPOS | `app.vcomm.vn`, `kho.vcomm.vn`, `ipos.vcomm.vn` |
| Gốc `vcomm.vn`, `www.vcomm.vn` | Chuyển hướng sang `app.vcomm.vn` (quy tắc chuyển hướng của Cloudflare; người dùng chọn 2026-11-18) |

Biến: `WEB_ORIGIN=https://erp.vcomm.vn`, `SHARE_PUBLIC_URL=https://api.vcomm.vn`, `VCOMM_WEB_URL=https://app.vcomm.vn`, `APP_WEB_ORIGINS=https://app.vcomm.vn,https://kho.vcomm.vn,https://ipos.vcomm.vn`, `VNPAY_RETURN_URL=https://api.vcomm.vn/api/v1/public/payments/vnpay/return`; ứng dụng di động build với `EXPO_PUBLIC_API_URL=https://api.vcomm.vn/api/v1`.

### 26.2 Thay đổi kéo theo

- Luồng `trien-khai.yml` chỉ còn môi trường `production`, luôn sao lưu, không có bước nạp dữ liệu thử; tệp lệnh vẫn nhận `staging` để dùng khi dựng lại môi trường thử nghiệm.
- Tiêu chí, kịch bản (mục 23) gộp về môi trường thật, giữ số mã: TIEUCHI_NGHIEMTHU_592 đến 595 nay kiểm trên môi trường thật; TIEUCHI_NGHIEMTHU_601 nay là cấu hình môi trường thật; không có mã bỏ không dùng. Kịch bản sai (migration lỗi, phục hồi) chạy trên cơ sở dữ liệu tạm, không chạy trên cơ sở dữ liệu thật.
- Chi phí: chỉ môi trường thật ~240 USD/tháng (Supabase Pro + Small + PITR ~130, Railway ~90, Cloudflare Free 0, R2 trong hạn mức miễn phí).
- Lát: L1 (đã làm) và L2 (bản web di động, APK, Pages) giữ; tạo tài nguyên, triển khai lần đầu làm ngay trên môi trường thật khi người dùng duyệt.
- Rủi ro: không có nơi thử trước; lỗi của phiên bản mới gặp trực tiếp trên dữ liệu thật; người dùng tự kiểm trên dữ liệu thật (nên tạo công ty riêng để thử, không trộn với công ty đang vận hành).

### 26.3 Điểm chặn và điều kiện trước khi mở cho người dùng ngoài

Phân hai mức: (A) chặn ngay cả lần triển khai đầu hoặc việc người dùng tự kiểm; (B) không chặn triển khai, nhưng phải xử lý hoặc người dùng chấp nhận trước khi mở cho người dùng ngoài.

| Số | Điểm | Mức | Ảnh hưởng | Đề xuất |
|---|---|---|---|---|
| 1 | Email chỉ ghi log (`LogOutboundMessages` là lớp duy nhất): đường dẫn kích hoạt, đặt lại mật khẩu, thư mời nằm trong log | A | Tạo nhân viên, quên mật khẩu không tới người nhận; ghi token vào log môi trường thật trái tài liệu `19` mục 3 điểm 5 | Công việc riêng gửi email thật (đã duyệt là việc riêng), làm trước lần triển khai đầu hoặc cùng 0.14.x |
| 2 | Không có cách tạo tổ chức và tài khoản quản trị đầu tiên trên môi trường thật (dữ liệu thử từ chối ở `production`) | A | Không đăng nhập được lần đầu | Công việc nhỏ: lệnh khởi tạo một lần (tập đoàn, quản trị tập đoàn, mật khẩu một lần buộc đổi), chạy bằng ảnh `api`; hoặc AI soạn câu lệnh SQL, người dùng duyệt (không khuyên: bỏ qua nhật ký thao tác, kiểm tra dữ liệu) |
| 3 | Lưu tệp: 2 bản `api` không dùng chung volume Railway; mã S3 chưa nhận địa chỉ máy chủ khác AWS | A | Tệp đính kèm mất hoặc lệch giữa hai bản | Công việc nhỏ sửa mã lưu tệp (Supabase Storage) trước lần đầu; hoặc tạm `api` 1 bản + volume đến khi sửa |
| 4 | Phiên bản 0.14.0 chưa có tag | A | Điều kiện triển khai | Phát hành 0.14.0 (hoặc triển khai 0.13.1 trước) |
| 5 | Pháp lý điểm thưởng (CONG_VIEC_51, chờ ý kiến luật sư) | B | Chức năng điểm thưởng | Tắt hoặc không công bố điểm thưởng đến khi có ý kiến |
| 6 | Lưu dữ liệu cá nhân ở Singapore (tài liệu `12` mục 7, chờ ý kiến luật sư) | B | Toàn hệ thống khi có dữ liệu cá nhân của người ngoài | Người dùng quyết định |
| 7 | CONG_VIEC_72 Smart OTP: người dùng thử trên điện thoại thật; cài ba mẫu ZNS, số tổng đài; khóa eSMS thật | B (A với đăng nhập bằng số điện thoại) | Đăng nhập người mua, xác thực giao dịch điểm | Nhập eSMS, ZNS trước khi thử |
| 8 | CONG_VIEC_74 iPOS: thử trên Sunmi T2, máy in, Bluetooth, ngắt mạng; cách phân phối ứng dụng (APK) | B | Cửa hàng liên kết dùng iPOS | Thử với APK lát L2 |
| 9 | CONG_VIEC_73: hồ sơ pháp lý thu hộ; ủy nhiệm lập hóa đơn và xác nhận của MISA; kế toán trưởng xác nhận tài khoản (QUYTAC_NGHIEPVU_587, 3388); ngày hóa đơn phí sàn; thử VNPAY | B | Mua hàng tại cửa hàng, thu hộ | Công tắc thu hộ giữ tắt; thử VNPAY: dùng tài khoản thử nghiệm VNPAY trên môi trường thật (đặt `VNPAY_PAYMENT_URL` sandbox) rồi đổi sang tài khoản thật |
| 10 | Hóa đơn điện tử: `NODE_ENV=production` chặn bộ giả lập | B | Lập hóa đơn (bán lẻ, phí sàn) báo chưa cấu hình đến khi có tài khoản MISA thật | Nhập tài khoản MISA thật từng công ty |
| 11 | Ký số từ xa: chỉ có bộ giả lập, bị chặn ở môi trường thật | B | Ký số hợp đồng Văn phòng số không dùng được | Chọn nhà cung cấp ký số (công việc sau) |
| 12 | Đối tác liên minh điểm: bộ giả lập tắt | B | Đổi điểm với đối tác | Khi có đối tác thật |
| 13 | CONG_VIEC_70: báo trước cửa hàng liên kết có phí mỗi tin OTP lớn hơn 0 | B | Hạn mức cửa hàng | Báo trước khi bật |
| 14 | Không có môi trường thử nghiệm | B | Lỗi phiên bản gặp trên dữ liệu thật | Người dùng đã chấp nhận; sao lưu, PITR bắt buộc |
| 15 | Đăng nhập Google, Microsoft, Zalo: khai địa chỉ gọi lại theo `erp.vcomm.vn`, `api.vcomm.vn` | B | Đăng nhập liên kết | Nhập ở Cài đặt tích hợp |

### 26.4 Khóa dịch vụ ngoài cần cho môi trường thật

| Dịch vụ | Nhập ở đâu | Bắt buộc khi nào |
|---|---|---|
| eSMS (SMS thương hiệu, Zalo ZNS, ba mẫu ZNS của CONG_VIEC_72) | Cài đặt tích hợp (sau khi đăng nhập) | Đăng nhập bằng số điện thoại, Smart OTP |
| Email (nhà cung cấp chọn ở công việc email) | Biến bí mật Railway | Điểm chặn 1 |
| VNPAY (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`) | Biến bí mật Railway dịch vụ `api`, `worker` | Thanh toán đơn |
| MISA meInvoice | Màn hình cài đặt hóa đơn điện tử của từng công ty | Lập hóa đơn |
| Đơn vị vận chuyển, cổng thanh toán khác | Biến bí mật Railway | Khi bật phương thức |
| Anthropic (`ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`) | Biến bí mật Railway | Khi bật trợ lý AI |
| Google, Microsoft, Zalo (đăng nhập liên kết) | Cài đặt tích hợp | Khi bật |

## 27. Quyết định ngày 2026-11-18 (lần 4)

1. Điểm chặn A1 đến A3 (mục 26.3) tách thành công việc riêng, phiên khác làm, phát hành 0.14.1 trước lần triển khai đầu; CONG_VIEC_76 không sửa mã các việc này:
   - CONG_VIEC_77: gửi email qua SMTP của hộp thư doanh nghiệp có sẵn, không dùng dịch vụ gửi email bên ngoài.
   - CONG_VIEC_78: lệnh khởi tạo một lần (tập đoàn, quản trị tập đoàn đầu tiên).
   - CONG_VIEC_79: lưu tệp trên Supabase Storage (giao thức S3, địa chỉ máy chủ, kiểu đường dẫn).
2. `vcomm.vn`, `www.vcomm.vn` chuyển hướng sang `app.vcomm.vn` bằng quy tắc chuyển hướng của Cloudflare.
3. Chỉ một môi trường thật. Người dùng tự kiểm bằng một công ty thử nghiệm riêng; chỉ mở cho người dùng ngoài khi danh sách B (mục 26.3) được xử lý hoặc chấp nhận.
4. Phiên bản triển khai đầu: 0.14.1 (thay 0.14.0).

Tên biến đề xuất cho CONG_VIEC_77, 79 (tài liệu `26` mục 1.3; hai việc đó chốt tên, CONG_VIEC_76 đối chiếu lại khi xong):
- Email: `EMAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (bí mật), `SMTP_FROM`.
- Kho tệp: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (bí mật; SDK AWS tự đọc hai biến này).

Bộ kiểm thử bản 0.14.0 trên PostgreSQL 17 (TIEUCHI_NGHIEMTHU_591): chạy lại trên mã 0.14.1 trước lần triển khai đầu.
