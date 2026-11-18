# 26. TRIỂN KHAI

- Mô tả: Môi trường, các bước triển khai, quy trình quay lui chung, biên bản triển khai.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-18
- Trạng thái: Bản nháp (CONG_VIEC_76 lát L1; chưa tạo tài nguyên, chưa triển khai lần nào)
- Thay đổi theo: CONG_VIEC_76, THAY_DOI_40 (đổi nền tảng triển khai đợt đầu sang Supabase, Railway, Cloudflare)

## 1. Môi trường

| Môi trường | Địa chỉ | Cách triển khai | Người phê duyệt |
|---|---|---|---|
| Phát triển | `http://localhost:3000` | Docker Compose, `pnpm dev` (tài liệu `18` mục 5) | Không áp dụng |
| Thử nghiệm (staging) | `https://staging.<tên miền>` (web), `https://api.staging.<tên miền>` (API), `https://app.staging.<tên miền>`, `https://kho.staging.<tên miền>`, `https://ipos.staging.<tên miền>` (bản web ứng dụng) — **CHƯA XÁC ĐỊNH:** tên miền | Luồng GitHub Actions "Triển khai", môi trường `staging` | Người dùng, mỗi lần |
| Thật | Như thử nghiệm, bỏ `staging.` | Luồng GitHub Actions "Triển khai", môi trường `production` (người dùng bấm duyệt trên GitHub) | Người dùng, mỗi lần |

### 1.1 Thành phần mỗi môi trường

| Thành phần | Nơi chạy | Thử nghiệm | Thật |
|---|---|---|---|
| Cơ sở dữ liệu | Supabase Postgres 17, vùng Singapore | Dự án `vcomm-staging`, gói Pro, compute Micro, sao lưu hằng ngày giữ 7 ngày | Dự án `vcomm-production`, compute Small, sao lưu hằng ngày 7 ngày và PITR 7 ngày |
| API, tác vụ nền | Railway vùng Singapore, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-api:<phiên bản>` | Dịch vụ `api` 1 bản, `BACKGROUND_JOBS=enabled`, volume lưu tệp đính kèm | `api` 2 bản (`BACKGROUND_JOBS=disabled`), `worker` 1 bản |
| 12 mini app web | Railway, ảnh `ghcr.io/vinhngtienmdb-ui/vcomm-web:<phiên bản>` | Dịch vụ `web` 1 bản | `web` 2 bản |
| Redis | Railway, dịch vụ `redis`, chỉ trong mạng riêng | 1 bản | 1 bản |
| Bản web ứng dụng di động | Cloudflare Pages | Ba dự án Pages | Ba dự án Pages |
| DNS, chứng chỉ | Cloudflare (gói Free) | | |
| Bản sao lưu trước triển khai | Cloudflare R2, bucket riêng tư `vcomm-sao-luu`, mã hóa bằng khóa age của người dùng | Thư mục `staging/` | Thư mục `production/` |

### 1.2 Cấu hình dịch vụ Railway

| Dịch vụ | Kiểm tra sống | Cổng | Biến khác thường |
|---|---|---|---|
| `api` | `/api/v1/auth/methods` | 4000 (`API_PORT=4000`) | Tài liệu `cong_viec/CONG_VIEC_76.md` mục 7, 20.7 |
| `worker` (thật) | Không | Không công khai | Như `api`, `BACKGROUND_JOBS=enabled` |
| `web` | `/dang-nhap` | `PORT` do Railway cấp | Không cần biến (địa chỉ API đặt lúc build: `http://api.railway.internal:4000`) |

- Kho ảnh riêng tư: Railway cần thông tin đăng nhập kho ảnh GitHub (token chỉ quyền đọc gói) đặt một lần ở cài đặt dịch vụ.
- Chuỗi kết nối cơ sở dữ liệu: Supavisor chế độ phiên (cổng 5432), không dùng chế độ giao dịch (bộ chạy migration giữ khóa mức phiên); kiểm chứng chỉ máy chủ bằng chứng chỉ gốc Supabase đặt ở `infra/certificates/supabase-ca.crt` (`sslmode=verify-full&sslrootcert=/app/infra/certificates/supabase-ca.crt`).

## 2. Các bước triển khai

Dùng giống nhau cho môi trường thử nghiệm và môi trường thật. Tệp lệnh: `infra/scripts/deploy.sh`; luồng: `.github/workflows/trien-khai.yml` (chạy tay từ nhánh `main`, nhập phiên bản, môi trường, hành động).

Điều kiện: phiên bản có tag và có trong tài liệu `23`; người dùng duyệt lần triển khai cho môi trường đó; môi trường thật chỉ nhận phiên bản đã chạy đạt ở môi trường thử nghiệm.

1. Kiểm tag (`check-tag`): tag tồn tại, chứa mọi tag trong `infra/emergency-patches.txt`.
2. Build ảnh (`build`): mã ứng dụng lấy từ tag, Dockerfile lấy từ `infra/docker` của `main`; đẩy `vcomm-api`, `vcomm-web` nhãn `<phiên bản>` và `<phiên bản>-<commit>`. Môi trường thật không build lại, dùng ảnh đã chạy ở môi trường thử nghiệm.
3. Ghi ảnh đang chạy (`record`) của từng dịch vụ, in ra log để quay lui.
4. Sao lưu (`backup`): `pg_dump` bản 17 dạng custom, mã hóa bằng age, tải lên R2 `<môi trường>/truoc-<phiên bản>-<thời điểm>.dump.age`. Lỗi thì dừng.
5. Database migration (`migrate`): chạy `node apps/api/dist/database/run-migrations.js` bằng ảnh mới. Lỗi thì dừng; tệp lỗi đã hoàn tác, bản cũ vẫn chạy.
6. Dữ liệu thử (`seed`): chỉ môi trường thử nghiệm, chỉ lần đầu; tệp lệnh từ chối ở môi trường thật.
7. Đổi ảnh (`release`): kiểm ảnh tồn tại cho mọi dịch vụ trước, rồi đổi từng dịch vụ và chờ triển khai xong (tối đa 15 phút mỗi dịch vụ). Railway giữ bản cũ chạy đến khi bản mới qua kiểm tra sống.
8. Bản web ứng dụng di động lên Cloudflare Pages: **CHƯA LÀM** (lát L2).
9. Kiểm tra sau triển khai (`verify`): `GET <API>/api/v1/auth/methods` và `GET <web>/dang-nhap` trả 200; người thực hiện kiểm thêm: đăng nhập, mở mini app, log không có lỗi mới trong 10 phút; kiểm tra bảo mật phần D.
10. Ghi biên bản mục 4, ghi nhật ký tài liệu `02` (qua phiên điều phối).

Thứ tự database migration: migration chạy trước khi đổi ảnh, nên mỗi tệp migration phải tương thích ngược với mã phiên bản đang chạy (tài liệu `23` ghi riêng từng phiên bản).

## 3. Quy trình quay lui chung

| Tình huống | Cách làm |
|---|---|
| Bản mới không qua kiểm tra sống | Railway giữ bản cũ; sửa lỗi rồi triển khai lại |
| Lỗi sau khi bản mới chạy, migration tương thích ngược | Chạy luồng "Triển khai" với hành động `quay-lui`, phiên bản = phiên bản cũ ghi ở bước 3; làm theo phương án quay lui của phiên bản trong tài liệu `23` |
| Dữ liệu sai | Khi người dùng đồng ý: giải mã bản sao lưu bước 4 bằng khóa riêng của người dùng, `pg_restore` vào cơ sở dữ liệu mới (dự án Supabase mới) hoặc phục hồi PITR (môi trường thật), đổi `DATABASE_URL`, quay lui ảnh |

Sau khi quay lui: làm theo skill mục 8 bước 11 (cấp mã lỗi, ghi tài liệu `23`, `24`).

## 4. Biên bản triển khai

Chưa triển khai lần nào.

Mẫu:

| Ngày giờ | Phiên bản | Môi trường | Người phê duyệt | Các bước đã làm | Kiểm tra bảo mật phần D | Kết quả |
|---|---|---|---|---|---|---|
