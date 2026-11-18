# 26. TRIỂN KHAI

- Mô tả: Môi trường, các bước triển khai, quy trình quay lui chung, biên bản triển khai.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-18
- Trạng thái: Bản nháp (CONG_VIEC_76; chưa tạo tài nguyên, chưa triển khai lần nào)
- Thay đổi theo: CONG_VIEC_76, THAY_DOI_40 (nền tảng triển khai đợt đầu Supabase, Railway, Cloudflare; người dùng quyết định 2026-11-18: chỉ dựng môi trường thật, không dựng môi trường thử nghiệm riêng)

## 1. Môi trường

| Môi trường | Địa chỉ | Cách triển khai | Người phê duyệt |
|---|---|---|---|
| Phát triển | `http://localhost:3000` | Docker Compose, `pnpm dev` (tài liệu `18` mục 5) | Không áp dụng |
| Thử nghiệm (staging) | Không dựng ở đợt đầu (người dùng quyết định 2026-11-18) | Không áp dụng | Không áp dụng |
| Thật | `https://erp.vcomm.vn` (web quản trị, mọi mini app theo đường dẫn), `https://api.vcomm.vn` (API, webhook, trang trả về cổng thanh toán, trang chia sẻ, tệp liên kết ứng dụng), `https://app.vcomm.vn`, `https://kho.vcomm.vn`, `https://ipos.vcomm.vn` (bản web ứng dụng); `https://vcomm.vn`, `https://www.vcomm.vn` chuyển hướng sang `app.vcomm.vn` (quy tắc chuyển hướng của Cloudflare, người dùng chọn 2026-11-18) | Luồng GitHub Actions "Triển khai", môi trường GitHub `production` (người dùng bấm duyệt trên GitHub mỗi lần) | Người dùng, mỗi lần |

- Mini app theo đường dẫn (`/catalog`, `/inventory`…) trên cùng tên miền web, đúng tài liệu `12` mục 3a (dùng chung cookie phiên, CSRF).
- Không có môi trường thử nghiệm: mọi lần triển khai đi thẳng vào dữ liệu thật; sao lưu trước mỗi lần là bắt buộc; thử lỗi luồng triển khai (migration lỗi, phục hồi) làm trên cơ sở dữ liệu tạm, không làm trên cơ sở dữ liệu thật.

### 1.1 Thành phần

| Thành phần | Nơi chạy | Cấu hình |
|---|---|---|
| Cơ sở dữ liệu | Supabase Postgres 17, vùng Singapore, dự án `vcomm-production` | Gói Pro, compute Small, sao lưu hằng ngày giữ 7 ngày, PITR 7 ngày, Data API tắt |
| API | Railway vùng Singapore, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-api:<phiên bản>`, dịch vụ `api` | 2 bản, `BACKGROUND_JOBS=disabled` |
| Tác vụ nền | Cùng ảnh, dịch vụ `worker` | 1 bản, `BACKGROUND_JOBS=enabled`, không có tên miền công khai |
| 12 mini app web | Railway, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-web:<phiên bản>`, dịch vụ `web` | 2 bản |
| Redis | Railway, dịch vụ `redis` | 1 bản, chỉ trong mạng riêng |
| Lưu tệp đính kèm | Supabase Storage qua giao thức S3, bucket riêng tư `vcomm-tep` (CONG_VIEC_79, phát hành 0.14.1) | `STORAGE_DRIVER=s3`; mục 1.3 |
| Gửi email | Hộp thư doanh nghiệp có sẵn qua SMTP (CONG_VIEC_77, phát hành 0.14.1), không dùng dịch vụ gửi email bên ngoài | Mục 1.3 |
| Bản web ứng dụng di động | Cloudflare Pages | Ba dự án Pages |
| DNS, chứng chỉ | Cloudflare (gói Free) | Bật proxy cho `erp`, `api` |
| Bản sao lưu trước triển khai | Cloudflare R2, bucket riêng tư `vcomm-sao-luu`, thư mục `production/` | Mã hóa bằng khóa công khai age; khóa riêng do người dùng giữ |

### 1.2 Cấu hình dịch vụ Railway

| Dịch vụ | Kiểm tra sống | Cổng | Biến |
|---|---|---|---|
| `api` | `/api/v1/auth/methods` | 4000 (`API_PORT=4000`) | Đặc tả CONG_VIEC_76 mục 7, 20.7, 26 |
| `worker` | Không | Không công khai | Như `api`, `BACKGROUND_JOBS=enabled` |
| `web` | `/dang-nhap` | `PORT` do Railway cấp | Không cần biến (địa chỉ API đặt lúc build: `http://api.railway.internal:4000`) |

### 1.3 Biến môi trường của dịch vụ `api`, `worker`

Danh sách đầy đủ: đặc tả CONG_VIEC_76 mục 7, 26, 27. Biến email, kho tệp theo CONG_VIEC_77 (pull request #213), CONG_VIEC_79 (pull request #215).

| Biến | Giá trị | Bí mật |
|---|---|---|
| `NODE_ENV` | `production` | Không |
| `API_PORT` | `4000` | Không |
| `DATABASE_URL` | Supavisor chế độ phiên, `sslmode=verify-full&sslrootcert=/app/infra/certificates/supabase-ca.crt` | Có |
| `REDIS_URL` | Biến tham chiếu của dịch vụ `redis` (mạng riêng) | Có |
| `ACCESS_TOKEN_SECRET`, `MFA_SECRET_KEY` | Sinh ngẫu nhiên một lần, không sinh lại | Có |
| `BACKGROUND_JOBS` | `api`: `disabled`; `worker`: `enabled` | Không |
| `WEB_ORIGIN`, `SHARE_PUBLIC_URL`, `VCOMM_WEB_URL`, `APP_WEB_ORIGINS` | `https://erp.vcomm.vn`; `https://api.vcomm.vn`; `https://app.vcomm.vn`; `https://app.vcomm.vn,https://kho.vcomm.vn,https://ipos.vcomm.vn` | Không |
| `EMAIL_DRIVER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM` | `smtp`; máy chủ, cổng (465 hoặc 587) của hộp thư doanh nghiệp; tài khoản gửi; địa chỉ gửi (ví dụ `VComm <khong-tra-loi@vcomm.vn>`) | Không |
| `SMTP_SECURE` (không bắt buộc) | Để trống: cổng 465 dùng TLS ngay, cổng khác bắt buộc STARTTLS (CONG_VIEC_77) | Không |
| `SMTP_PASSWORD` | Mật khẩu ứng dụng của tài khoản gửi | Có |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `AWS_REGION` | `s3`; `vcomm-tep` (bắt buộc khi `STORAGE_DRIVER=s3`); `https://<mã dự án>.storage.supabase.co/storage/v1/s3`; `true`; `ap-southeast-1` | Không |
| `S3_SERVER_SIDE_ENCRYPTION` (không bắt buộc) | Để trống: không gửi tiêu đề mã hóa khi có `S3_ENDPOINT` (Supabase Storage tự mã hóa khi lưu); giá trị `AES256` hoặc `none` (CONG_VIEC_79) | Không |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Khóa S3 của Supabase Storage | Có |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`; `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` | Tài khoản VNPAY; địa chỉ cổng, `https://api.vcomm.vn/api/v1/public/payments/vnpay/return` | Có; Không |
| `LOYALTY_PARTNER_SIMULATOR`, `AI_PROVIDER` | Trống | Không |

- Kho ảnh riêng tư: Railway cần thông tin đăng nhập kho ảnh GitHub (token chỉ quyền đọc gói) đặt một lần ở cài đặt dịch vụ.
- Chuỗi kết nối cơ sở dữ liệu: Supavisor chế độ phiên (cổng 5432), không dùng chế độ giao dịch (bộ chạy migration giữ khóa mức phiên); kiểm chứng chỉ máy chủ bằng chứng chỉ gốc Supabase đặt ở `infra/certificates/supabase-ca.crt` (`sslmode=verify-full&sslrootcert=/app/infra/certificates/supabase-ca.crt`).

## 2. Các bước triển khai

Tệp lệnh: `infra/scripts/deploy.sh`; luồng: `.github/workflows/trien-khai.yml` (chạy tay từ nhánh `main`, nhập phiên bản, hành động; môi trường GitHub `production` chờ người dùng duyệt).

Điều kiện: phiên bản có tag và có trong tài liệu `23`; người dùng duyệt lần triển khai.

1. Kiểm tag (`check-tag`): tag tồn tại, chứa mọi tag trong `infra/emergency-patches.txt`.
2. Build ảnh (`build`, bỏ qua nếu ảnh của phiên bản đã có): mã ứng dụng lấy từ tag, Dockerfile lấy từ `infra/docker` của `main`; đẩy `vcomm-api`, `vcomm-web` nhãn `<phiên bản>` và `<phiên bản>-<commit>`.
2a. Quét lỗ hổng hai ảnh bằng Trivy (luồng GitHub Actions): lỗ hổng HIGH, CRITICAL đã có bản vá thì dừng, chưa chạm cơ sở dữ liệu. Chạy từ máy phiên: chạy `trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 <ảnh>` trước bước 4.
3. Ghi ảnh đang chạy (`record`) của từng dịch vụ, in ra log để quay lui.
4. Sao lưu (`backup`, bắt buộc): `pg_dump` bản 17 dạng custom, mã hóa bằng age, tải lên R2 `production/truoc-<phiên bản>-<thời điểm>.dump.age`. Lỗi thì dừng. Tệp lệnh từ chối bước migration nếu chưa sao lưu.
5. Database migration (`migrate`): chạy `node apps/api/dist/database/run-migrations.js` bằng ảnh mới. Lỗi thì dừng; tệp lỗi đã hoàn tác, bản cũ vẫn chạy.
6. Đổi ảnh (`release`): kiểm ảnh tồn tại cho mọi dịch vụ trước, rồi đổi `api`, `worker`, `web` và chờ từng dịch vụ triển khai xong (tối đa 15 phút mỗi dịch vụ). Railway giữ bản cũ chạy đến khi bản mới qua kiểm tra sống.
7. Bản web ứng dụng di động lên Cloudflare Pages: **CHƯA LÀM** (lát L2).
8. Kiểm tra sau triển khai (`verify`): `GET https://api.vcomm.vn/api/v1/auth/methods` và `GET https://erp.vcomm.vn/dang-nhap` trả 200; người thực hiện kiểm thêm: đăng nhập, mở mini app, log không có lỗi mới trong 10 phút; kiểm tra bảo mật phần D.
9. Ghi biên bản mục 4, ghi nhật ký tài liệu `02` (qua phiên điều phối).

Lần đầu (một lần): tạo tài nguyên (đặc tả CONG_VIEC_76 mục 20.10) → triển khai 0.14.1 theo các bước 1 đến 8 → chạy lệnh khởi tạo một lần của CONG_VIEC_78 (pull request #214) → quản trị tập đoàn mở đường dẫn kích hoạt trong email, đặt mật khẩu, đăng nhập → tạo công ty thử nghiệm riêng để tự kiểm.

Lệnh khởi tạo chạy trong dịch vụ `api` để dùng đúng biến của môi trường (`DATABASE_URL`, `WEB_ORIGIN`, biến SMTP): `railway ssh --service api --environment production`, rồi:

```
node apps/api/dist/database/bootstrap.js --company-code=<mã> --legal-name="<tên pháp lý>" --short-name="<tên ngắn>" --tax-code=<mã số thuế> --admin-email=<email quản trị> --admin-name="<họ tên>"
```

`--tax-code` không bắt buộc. Đường dẫn kích hoạt hết hạn hoặc thất lạc: `node apps/api/dist/database/bootstrap.js --reissue-link --admin-email=<email quản trị>`. Người dùng cung cấp giá trị các tham số; AI chạy khi người dùng duyệt.

Thứ tự database migration: migration chạy trước khi đổi ảnh, nên mỗi tệp migration phải tương thích ngược với mã phiên bản đang chạy (tài liệu `23` ghi riêng từng phiên bản).

## 3. Quy trình quay lui chung

| Tình huống | Cách làm |
|---|---|
| Bản mới không qua kiểm tra sống | Railway giữ bản cũ; sửa lỗi rồi triển khai lại |
| Lỗi sau khi bản mới chạy, migration tương thích ngược | Chạy luồng "Triển khai" với hành động `quay-lui`, phiên bản = phiên bản cũ ghi ở bước 3; làm theo phương án quay lui của phiên bản trong tài liệu `23` |
| Dữ liệu sai | Khi người dùng đồng ý: PITR của Supabase về thời điểm trước triển khai, hoặc giải mã bản sao lưu bước 4 bằng khóa riêng của người dùng và `pg_restore` vào dự án Supabase mới, đổi `DATABASE_URL`; quay lui ảnh |

Sau khi quay lui: làm theo skill mục 8 bước 11 (cấp mã lỗi, ghi tài liệu `23`, `24`).

## 4. Biên bản triển khai

Chưa triển khai lần nào.

| Ngày giờ | Phiên bản | Môi trường | Người phê duyệt | Các bước đã làm | Kiểm tra bảo mật phần D | Kết quả |
|---|---|---|---|---|---|---|
