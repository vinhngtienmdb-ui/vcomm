# 26. TRIỂN KHAI

- Mô tả: Môi trường, các bước triển khai, quy trình quay lui chung, dựng máy ảo, biên bản triển khai.
- Phiên bản: 0.3
- Ngày cập nhật: 2026-11-23
- Trạng thái: Bản nháp (CONG_VIEC_76 đợt 2; chưa tạo tài nguyên, chưa triển khai lần nào)
- Thay đổi theo: CONG_VIEC_76, THAY_DOI_40 (nền tảng triển khai đợt đầu; chỉ môi trường thật); THAY_DOI_42 (2026-11-23): bỏ Railway; api, worker, web, Redis chạy bằng Docker Compose trên một máy ảo Oracle Cloud Always Free; Supabase gói miễn phí; cổng vào Cloudflare Tunnel; sao lưu trước mỗi lần triển khai và hằng ngày lên R2

## 1. Môi trường

| Môi trường | Địa chỉ | Cách triển khai | Người phê duyệt |
|---|---|---|---|
| Phát triển | `http://localhost:3000` | Docker Compose ở gốc dự án, `pnpm dev` (tài liệu `18` mục 5) | Không áp dụng |
| Thử nghiệm (staging) | Không dựng (người dùng quyết định 2026-11-18) | Không áp dụng | Không áp dụng |
| Thật | `https://erp.vcomm.vn` (web quản trị, mọi mini app theo đường dẫn), `https://api.vcomm.vn` (API, webhook, trang trả về cổng thanh toán, trang chia sẻ), `https://app.vcomm.vn`, `https://kho.vcomm.vn`, `https://ipos.vcomm.vn` (bản web ứng dụng, Cloudflare Pages); `vcomm.vn`, `www.vcomm.vn` chuyển hướng sang `app.vcomm.vn` | Luồng GitHub Actions "Triển khai" (môi trường GitHub `production`, người dùng duyệt mỗi lần) | Người dùng, mỗi lần |

- Mini app theo đường dẫn (`/catalog`, `/inventory`…) trên cùng tên miền web (tài liệu `12` mục 3a).
- Không có môi trường thử nghiệm: mọi lần triển khai đi thẳng vào dữ liệu thật; sao lưu trước mỗi lần là bắt buộc; luồng triển khai, quay lui được kiểm trên compose cục bộ trong CI (`kiem-tra-anh.yml`), không thử lỗi trên dữ liệu thật.
- Không dùng tên miền tạm.

### 1.1 Thành phần

| Thành phần | Nơi chạy | Cấu hình |
|---|---|---|
| Máy ảo | Oracle Cloud Always Free, Ampere A1 (arm64) 4 nhân, 24 GB, Ubuntu 24.04, vùng Singapore | Dựng bằng `infra/vm/cai-dat-may-ao.sh` (mục 5); không mở cổng vào nào |
| API | Docker Compose dịch vụ `api`, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-api:<phiên bản>` (arm64) | 1 bản, `BACKGROUND_JOBS=disabled`, hệ thống tệp chỉ đọc, giới hạn 2 GB |
| Tác vụ nền | Dịch vụ `worker`, cùng ảnh | 1 bản, `BACKGROUND_JOBS=enabled`, giới hạn 2 GB |
| 12 mini app web | Dịch vụ `web`, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-web:<phiên bản>` | 1 bản, giới hạn 4 GB |
| Redis | Dịch vụ `redis`, `redis:7.4.11-alpine` (ghim digest) | Chỉ trong mạng Docker, lưu xuống ổ (appendonly) |
| Cổng vào | Dịch vụ `cloudflared` 2026.10.2 (ghim digest), Cloudflare Tunnel | `erp.vcomm.vn` → `web:3000`, `api.vcomm.vn` → `api:4000`, `ssh.vcomm.vn` → SSH của máy (Cloudflare Access) |
| Cơ sở dữ liệu | Supabase gói miễn phí, dự án `vcomm-production` (mã `xbtrauxpqmgqwjktcwqd`, `ap-southeast-1`, PostgreSQL 17) | Supavisor chế độ phiên cổng 5432; Data API tắt; không có sao lưu tự động, không có PITR |
| Lưu tệp đính kèm | Supabase Storage qua giao thức S3, bucket riêng tư `vcomm-tep` | `STORAGE_DRIVER=s3` (mục 1.3) |
| Gửi email | Hộp thư doanh nghiệp qua SMTP (CONG_VIEC_77) | Mục 1.3 |
| Bản web ứng dụng di động | Cloudflare Pages | Lát sau |
| DNS, chứng chỉ, chống tấn công | Cloudflare (gói Free) | Chứng chỉ do Cloudflare cấp; máy ảo không cần chứng chỉ |
| Bản sao lưu | Cloudflare R2, bucket riêng tư `vcomm-sao-luu`: `production/` (trước triển khai), `hang-ngay/` (hằng ngày, giữ 30 bản) | Mã hóa bằng khóa công khai age; khóa riêng do người dùng giữ |

Tệp trên máy ảo, thư mục `/opt/vcomm` (chủ: người dùng `trien-khai`): `compose.production.yml` (luồng triển khai chép từ `infra/compose/` của nhánh `main`), `.env` (quyền 600, mục 1.3), `certificates/supabase-ca.crt` (chứng chỉ gốc Supabase, công khai).

### 1.2 Giới hạn và rủi ro của nền tảng miễn phí (người dùng chấp nhận 2026-11-23)

| Rủi ro | Ảnh hưởng | Biện pháp |
|---|---|---|
| Oracle thu hồi máy Always Free "nhàn rỗi" (CPU, mạng, bộ nhớ thấp trong 7 ngày); người dùng giữ tài khoản miễn phí, không thêm tải giả | Hệ thống dừng, mất máy | Khôi phục mục 3.1: dựng máy mới bằng `infra/vm/cai-dat-may-ao.sh`, `.env` (người dùng giữ bản riêng), triển khai lại phiên bản đang dùng; dữ liệu nằm ở Supabase, tệp ở Supabase Storage, Redis chỉ có hàng đợi |
| Dung lượng Ampere A1 ở Singapore thường hết | Không tạo được máy mới ngay khi cần khôi phục | Thử lại theo giờ; ghi thời gian ngừng vào biên bản |
| Một máy duy nhất, một bản mỗi dịch vụ | Gián đoạn ngắn (khoảng 10 đến 30 giây) khi triển khai; hỏng máy là dừng hệ thống | Người dùng chấp nhận gián đoạn ngắn (2026-11-23); khôi phục mục 3.1 |
| Supabase gói miễn phí: 500 MB cơ sở dữ liệu, 1 GB lưu tệp, tệp tối đa 50 MB, tạm dừng dự án khi không hoạt động 7 ngày, không sao lưu, không PITR | Đầy dung lượng; mất dữ liệu nếu không có bản sao lưu | Sao lưu trước triển khai và hằng ngày lên R2; theo dõi dung lượng hằng tuần; nâng gói khi gần đầy |
| Lịch GitHub Actions của kho công khai tự tắt sau 60 ngày không có commit | Mất sao lưu hằng ngày | Kiểm tra luồng "Sao lưu hằng ngày" mỗi tháng; bật lại khi bị tắt |

### 1.3 Biến môi trường (`/opt/vcomm/.env`)

Mẫu đầy đủ: `infra/compose/env.production.example` (không có giá trị bí mật). Biến `NODE_ENV=production`, `API_PORT`, `REDIS_URL`, `BACKGROUND_JOBS` đặt sẵn trong tệp compose.

| Biến | Giá trị | Bí mật |
|---|---|---|
| `VCOMM_VERSION` | Phiên bản đang chạy, luồng triển khai đặt | Không |
| `VCOMM_IMAGE_REPOSITORY` | `ghcr.io/vinhngtienmdb-ui` | Không |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token của tunnel `vcomm-production` | Có |
| `DATABASE_URL` | Supavisor chế độ phiên, `sslmode=verify-full&sslrootcert=/app/infra/certificates/supabase-ca.crt` | Có |
| `ACCESS_TOKEN_SECRET`, `MFA_SECRET_KEY` | Sinh ngẫu nhiên một lần, không sinh lại | Có |
| `WEB_ORIGIN`, `SHARE_PUBLIC_URL`, `VCOMM_WEB_URL`, `APP_WEB_ORIGINS` | `https://erp.vcomm.vn`; `https://api.vcomm.vn`; `https://app.vcomm.vn`; `https://app.vcomm.vn,https://kho.vcomm.vn,https://ipos.vcomm.vn` | Không |
| `EMAIL_DRIVER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_FROM` | `smtp`; máy chủ, cổng của hộp thư doanh nghiệp; `SMTP_SECURE` để trống | Không |
| `SMTP_PASSWORD` | Mật khẩu ứng dụng của tài khoản gửi | Có |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_SERVER_SIDE_ENCRYPTION`, `AWS_REGION` | `s3`; `vcomm-tep`; `https://xbtrauxpqmgqwjktcwqd.storage.supabase.co/storage/v1/s3`; `true`; trống; `ap-southeast-1` | Không |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Khóa S3 của Supabase Storage | Có |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`; `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` | Tài khoản VNPAY; địa chỉ cổng, `https://api.vcomm.vn/api/v1/public/payments/vnpay/return` | Có; Không |
| `LOYALTY_PARTNER_SIMULATOR`, `AI_PROVIDER` | Trống | Không |

### 1.4 Biến của luồng GitHub Actions

| Môi trường GitHub | Bí mật | Biến thường |
|---|---|---|
| `production` (người dùng duyệt mỗi lần, chỉ nhánh `main`) | `DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `DEPLOY_SSH_KEY` (khóa riêng của người dùng `trien-khai`), `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` (service token Cloudflare Access cho SSH) | `DEPLOY_SSH_HOST=ssh.vcomm.vn`, `DEPLOY_SSH_KNOWN_HOSTS` (khóa máy ảo), `BACKUP_BUCKET=vcomm-sao-luu`, `BACKUP_AGE_RECIPIENT`, `CLOUDFLARE_ACCOUNT_ID`, `PUBLIC_API_URL=https://api.vcomm.vn`, `PUBLIC_WEB_URL=https://erp.vcomm.vn` |
| `production-sao-luu` (không người duyệt, chạy theo lịch) | `DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `BACKUP_BUCKET`, `BACKUP_AGE_RECIPIENT`, `CLOUDFLARE_ACCOUNT_ID` |
| Biến của kho | | `SAO_LUU_HANG_NGAY=bat` khi đã đủ khóa, cơ sở dữ liệu |

Ảnh trên GHCR: đặt gói `vcomm-api`, `vcomm-web` ở chế độ công khai (kho mã đã công khai, ảnh không chứa khóa) để máy ảo kéo ảnh không cần đăng nhập; nếu giữ riêng tư thì đăng nhập `ghcr.io` trên máy ảo một lần bằng token chỉ quyền đọc gói.

## 2. Các bước triển khai

Tệp lệnh: `infra/scripts/deploy.sh`; luồng: `.github/workflows/trien-khai.yml` (chạy tay từ nhánh `main`, máy chạy Arm của GitHub, nhập phiên bản và hành động).

Điều kiện: phiên bản có tag và có trong tài liệu `23`; người dùng duyệt lần triển khai.

1. Kiểm tag (`check-tag`): tag tồn tại, chứa mọi tag trong `infra/emergency-patches.txt`.
2. Build ảnh arm64 (`build`, bỏ qua nếu ảnh của phiên bản đã có): mã ứng dụng từ tag, Dockerfile từ `infra/docker` của `main`; đẩy `vcomm-api`, `vcomm-web` nhãn `<phiên bản>` và `<phiên bản>-<commit>`.
3. Quét lỗ hổng hai ảnh bằng Trivy: lỗ hổng HIGH, CRITICAL đã có bản vá thì dừng.
4. Ghi phiên bản đang chạy (`record`, đọc `VCOMM_VERSION` trên máy ảo) để quay lui.
5. Sao lưu (`backup`, bắt buộc): `pg_dump` bản 17 dạng custom, mã hóa bằng age, tải lên R2 `production/truoc-<phiên bản>-<thời điểm>.dump.age`. Lỗi thì dừng. Tệp lệnh từ chối bước migration nếu chưa sao lưu.
6. Chép tệp compose (`sync`) từ `infra/compose/compose.production.yml` lên `/opt/vcomm`.
7. Database migration (`migrate`): kéo ảnh `api` mới, chạy `docker compose run --rm --no-deps api node apps/api/dist/database/run-migrations.js` bằng ảnh mới (bản cũ vẫn chạy). Lỗi thì dừng; tệp lỗi đã hoàn tác.
8. Đổi phiên bản (`release`): đặt `VCOMM_VERSION`, kéo ảnh, `docker compose up -d --wait` (chờ mọi dịch vụ qua kiểm tra sống, tối đa 5 phút). Không qua thì tự đặt lại phiên bản trước, khởi động lại và báo lỗi. Gián đoạn ngắn trong lúc đổi container.
9. Kiểm tra sau triển khai (`verify`): `GET https://api.vcomm.vn/api/v1/auth/methods`, `GET https://erp.vcomm.vn/dang-nhap` trả 200; người thực hiện kiểm thêm: đăng nhập, mở mini app, log không có lỗi mới trong 10 phút (`docker compose logs` trên máy ảo); kiểm tra bảo mật phần D.
10. Ghi biên bản mục 4, ghi nhật ký tài liệu `02` (qua phiên điều phối).

Thứ tự database migration: migration chạy trước khi đổi phiên bản, nên mỗi tệp migration phải tương thích ngược với mã phiên bản đang chạy (tài liệu `23` ghi riêng từng phiên bản).

Lần đầu (một lần): dựng máy ảo (mục 5) → tạo tunnel, bản ghi DNS, Cloudflare Access (mục 5.2) → điền `.env`, chứng chỉ gốc → triển khai 0.14.1 theo bước 1 đến 9 (bước 4 trả rỗng) → chạy lệnh khởi tạo một lần của CONG_VIEC_78 trên máy ảo: `cd /opt/vcomm && docker compose -f compose.production.yml run --rm --no-deps api node apps/api/dist/database/bootstrap.js --company-code=<mã> --legal-name="<tên pháp lý>" --short-name="<tên ngắn>" --tax-code=<mã số thuế> --admin-email=<email> --admin-name="<họ tên>"` (cấp lại đường dẫn: `--reissue-link --admin-email=<email>`) → quản trị kích hoạt qua email, đăng nhập, tạo công ty thử nghiệm riêng để tự kiểm.

## 3. Quy trình quay lui chung

| Tình huống | Cách làm |
|---|---|
| Bản mới không qua kiểm tra sống | Bước 8 tự về phiên bản trước; sửa lỗi rồi triển khai lại |
| Lỗi sau khi bản mới chạy, migration tương thích ngược | Chạy luồng "Triển khai" với hành động `quay-lui`, phiên bản = phiên bản cũ ghi ở bước 4 (tệp lệnh kiểm ảnh tồn tại trước khi đổi); làm theo phương án quay lui của phiên bản trong tài liệu `23` |
| Dữ liệu sai | Khi người dùng đồng ý: giải mã bản sao lưu bước 5 bằng khóa riêng age của người dùng, `pg_restore` vào dự án Supabase mới (hoặc dự án hiện tại sau khi làm trống), đổi `DATABASE_URL`, quay lui phiên bản |

Sau khi quay lui: làm theo skill mục 8 bước 11 (cấp mã lỗi, ghi tài liệu `23`, `24`).

### 3.1 Khôi phục khi mất máy ảo (bị thu hồi, hỏng)

1. Tạo máy ảo mới (mục 5.1), chạy `infra/vm/cai-dat-may-ao.sh` với khóa công khai của người dùng `trien-khai`.
2. Chép `.env` (bản người dùng giữ riêng) và chứng chỉ gốc vào `/opt/vcomm`.
3. Cập nhật `DEPLOY_SSH_KNOWN_HOSTS` theo khóa máy mới.
4. Chạy luồng "Triển khai" với phiên bản đang dùng (ảnh đã có, không build lại; migration không có tệp mới). Tunnel dùng lại token cũ nên không đổi DNS.
5. Kiểm tra sau triển khai; ghi biên bản, thời gian ngừng.

## 4. Biên bản triển khai

Chưa triển khai lần nào.

| Ngày giờ | Phiên bản | Môi trường | Người phê duyệt | Các bước đã làm | Kiểm tra bảo mật phần D | Kết quả |
|---|---|---|---|---|---|---|

## 5. Dựng máy ảo, Cloudflare

### 5.1 Máy ảo Oracle (người dùng làm, hoặc phiên con khi được duyệt)

1. Oracle Cloud → Compute → Create instance: vùng Singapore, ảnh Ubuntu 24.04 (aarch64), hình dạng VM.Standard.A1.Flex 4 OCPU 24 GB, ổ khởi động 100 GB, gắn khóa SSH của người dùng (chỉ dùng cho lần dựng đầu).
2. Mạng ảo (VCN): danh sách bảo mật không có quy tắc vào nào (xóa quy tắc cổng 22 sau khi chạy xong bước 3), quy tắc ra cho phép mọi nơi.
3. Đăng nhập lần đầu bằng khóa của người dùng, chạy: `sudo bash cai-dat-may-ao.sh "<khóa công khai của người dùng trien-khai>"`. Tệp lệnh làm: cập nhật hệ thống; cập nhật bảo mật tự động, tự khởi động lại lúc 3 giờ khi cần; múi giờ Việt Nam, đồng bộ giờ; ufw chặn mọi kết nối vào (chỉ cho SSH từ mạng Docker cho cloudflared); SSH chỉ khóa, không cho root; Docker Engine và plugin compose; swap 4 GB; người dùng `trien-khai` (nhóm docker, khóa bị khóa mật khẩu); thư mục `/opt/vcomm`, `.env` rỗng quyền 600.
4. Sau khi tunnel chạy và SSH qua `ssh.vcomm.vn` dùng được: xóa quy tắc cổng 22 ở danh sách bảo mật VCN (bước 2).

Lưu ý: người dùng trong nhóm docker có quyền tương đương root trên máy; khóa riêng của `trien-khai` chỉ nằm trong biến bí mật GitHub.

### 5.2 Cloudflare (sau khi `vcomm.vn` ở trạng thái Active)

1. Zero Trust → Networks → Tunnels → tạo tunnel `vcomm-production` (loại cloudflared), lấy token, ghi vào `CLOUDFLARE_TUNNEL_TOKEN` trong `.env`.
2. Public hostnames của tunnel: `erp.vcomm.vn` → `http://web:3000`; `api.vcomm.vn` → `http://api:4000`; `ssh.vcomm.vn` → `ssh://host.docker.internal:22`.
3. Zero Trust → Access → Applications: ứng dụng tự quản lý cho `ssh.vcomm.vn`, chính sách: (a) Service Auth cho service token `github-actions-trien-khai` (lấy Client ID, Client Secret ghi vào bí mật GitHub `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`); (b) email của người dùng.
4. Rules → Redirect Rules: `vcomm.vn/*`, `www.vcomm.vn/*` → `https://app.vcomm.vn/$1` (302 đến khi có trang giới thiệu).
5. SSL/TLS: chế độ Full (strict) (tunnel đã mã hóa); bật Always Use HTTPS.
