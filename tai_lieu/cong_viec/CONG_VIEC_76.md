# CONG_VIEC_76: Hạ tầng AWS, môi trường thử nghiệm, môi trường thật và quy trình triển khai

- Mô tả: Viết hạ tầng bằng AWS CDK (vùng Singapore), đóng gói ứng dụng thành ảnh container chip Arm, dựng môi trường thử nghiệm (staging, dữ liệu giả) rồi môi trường thật giai đoạn 1; quy trình triển khai từ tag (GitHub Actions dùng OIDC) gồm sao lưu, database migration, quay lui; lập tài liệu `26`.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-18
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả và các lựa chọn ở mục 16. Chưa viết mã, chưa tạo tài nguyên AWS.
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
- Từ máy phiên AI: cùng một tệp lệnh `infra/scripts/deploy.sh <môi trường> <tag>`, dùng khóa trong cài đặt môi trường phiên (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=ap-southeast-1`). Đã kiểm: máy phiên có Docker. Chỉ chạy sau khi người dùng duyệt lần triển khai đó. Khóa này chỉ có quyền nhận vai trò triển khai (mục 9).
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
