#!/usr/bin/env bash
# Triển khai VComm lên máy ảo môi trường thật qua SSH (CONG_VIEC_76, THAY_DOI_42, tài liệu 26 mục 2).
# Dùng chung cho GitHub Actions (.github/workflows/trien-khai.yml, sao-luu-hang-ngay.yml) và máy phiên AI.
# Chỉ chạy khi người dùng đã duyệt lần triển khai này.
#
# Cách dùng: infra/scripts/deploy.sh <bước>; thứ tự khi triển khai:
#   check-tag      tag tồn tại, chứa mọi bản vá khẩn cấp đã triển khai (infra/emergency-patches.txt)
#   build          build, đẩy hai ảnh cho kiến trúc của máy đang chạy (luồng chạy trên máy Arm: linux/arm64)
#   record         đọc VCOMM_VERSION đang chạy trên máy ảo, ghi vào PREVIOUS_VERSION_FILE
#   backup         pg_dump, mã hóa age, tải lên R2 (bắt buộc trước migration)
#   sync           chép tệp compose của nhánh main lên máy ảo
#   migrate        kéo ảnh mới, chạy database migration bằng ảnh mới
#   release        đổi VCOMM_VERSION, khởi động lại, chờ kiểm tra sống; lỗi thì tự về phiên bản trước
#   verify         gọi địa chỉ công khai
#   rollback       về ROLLBACK_VERSION
#   prune-backups  giữ BACKUP_KEEP bản mới nhất trong BACKUP_PREFIX (luồng sao lưu hằng ngày)
#
# Biến môi trường (không ghi giá trị bí mật vào mã):
#   VERSION                     mã phiên bản (tag v<VERSION>)
#   IMAGE_REPOSITORY            ví dụ ghcr.io/vinhngtienmdb-ui
#   DATABASE_URL                (bí mật) Supabase, Supavisor chế độ phiên
#   BACKUP_AGE_RECIPIENT, BACKUP_BUCKET, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID (bí mật), R2_SECRET_ACCESS_KEY (bí mật)
#   BACKUP_PREFIX               thư mục trên R2: production (trước triển khai) hoặc hang-ngay; BACKUP_KEEP số bản giữ (mặc định 30)
#   DEPLOY_SSH_HOST             tên SSH qua Cloudflare Tunnel, ví dụ ssh.vcomm.vn
#   DEPLOY_SSH_USER             mặc định trien-khai
#   DEPLOY_SSH_KEY_FILE         tệp khóa riêng SSH của người dùng triển khai
#   DEPLOY_SSH_KNOWN_HOSTS_FILE tệp known_hosts ghim khóa máy ảo
#   CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET (bí mật) service token Cloudflare Access cho SSH
#   DEPLOY_DIRECTORY            thư mục trên máy ảo, mặc định /opt/vcomm
#   DEPLOY_COMPOSE_FILES, DEPLOY_WAIT_TIMEOUT, DEPLOY_SKIP_PULL, DEPLOY_SSH_HOST=local: chỉ dùng khi kiểm thử luồng trong CI
#   PUBLIC_API_URL, PUBLIC_WEB_URL
set -euo pipefail

step="${1:-}"
previous_file="${PREVIOUS_VERSION_FILE:-tam_thoi/phien-ban-truoc-trien-khai.txt}"
deploy_directory="${DEPLOY_DIRECTORY:-/opt/vcomm}"
compose_files="${DEPLOY_COMPOSE_FILES:--f compose.production.yml}"
wait_timeout="${DEPLOY_WAIT_TIMEOUT:-300}"
cloudflared_image="cloudflare/cloudflared:2026.10.2@sha256:0e56c13c7058fcef9c4f0e7d83372f82330548dbf8f8b366f3d8b506526d93b2"

fail() { echo "DỪNG: $*" >&2; exit 1; }
need() { for name in "$@"; do [ -n "${!name:-}" ] || fail "thiếu biến $name"; done; }
image() { echo "${IMAGE_REPOSITORY}/vcomm-$1:$2"; }

remote() {
  # Chạy lệnh trên máy ảo qua SSH; SSH đi qua Cloudflare Tunnel, xác thực Cloudflare Access bằng service token.
  # DEPLOY_SSH_HOST=local: chạy ngay trên máy này (chỉ để kiểm thử luồng trong CI với compose cục bộ).
  if [ "${DEPLOY_SSH_HOST:-}" = "local" ]; then bash -c "$*"; return; fi
  need DEPLOY_SSH_HOST DEPLOY_SSH_KEY_FILE DEPLOY_SSH_KNOWN_HOSTS_FILE CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET
  ssh -i "$DEPLOY_SSH_KEY_FILE" \
    -o UserKnownHostsFile="$DEPLOY_SSH_KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes -o BatchMode=yes \
    -o ProxyCommand="docker run -i --rm -e TUNNEL_SERVICE_TOKEN_ID -e TUNNEL_SERVICE_TOKEN_SECRET $cloudflared_image access ssh --hostname %h" \
    "${DEPLOY_SSH_USER:-trien-khai}@${DEPLOY_SSH_HOST}" "$@"
}
export TUNNEL_SERVICE_TOKEN_ID="${CF_ACCESS_CLIENT_ID:-}" TUNNEL_SERVICE_TOKEN_SECRET="${CF_ACCESS_CLIENT_SECRET:-}"

compose() {
  # docker compose trên máy ảo, trong thư mục triển khai; tham số thêm truyền nguyên vẹn.
  remote "cd '$deploy_directory' && docker compose $compose_files $*"
}

running_version() {
  remote "sed -n 's/^VCOMM_VERSION=//p' '$deploy_directory/.env'"
}

set_version() {
  # Đổi VCOMM_VERSION trong .env trên máy ảo (giữ quyền 600).
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "phiên bản không hợp lệ: $1"
  remote "sed -i 's/^VCOMM_VERSION=.*/VCOMM_VERSION=$1/' '$deploy_directory/.env' && grep -q '^VCOMM_VERSION=$1\$' '$deploy_directory/.env'"
}

start_version() {
  # Kéo ảnh, khởi động lại theo phiên bản $1, chờ mọi dịch vụ qua kiểm tra sống (tối đa 5 phút).
  # Gọi trong "if" ở bước release nên set -e không có hiệu lực: nối bằng && để dừng ở lệnh lỗi đầu tiên.
  # DEPLOY_SKIP_PULL=1 chỉ dùng khi kiểm thử với ảnh build cục bộ.
  set_version "$1" && { [ "${DEPLOY_SKIP_PULL:-}" = "1" ] || compose pull --quiet; } && compose up -d --wait --wait-timeout "$wait_timeout" --remove-orphans
}

case "$step" in
  check-tag)
    need VERSION
    git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null || fail "không có tag v${VERSION}"
    if [ -f infra/emergency-patches.txt ]; then
      while read -r patch_tag; do
        [ -z "$patch_tag" ] || [ "${patch_tag#\#}" != "$patch_tag" ] && continue
        git merge-base --is-ancestor "$patch_tag" "v${VERSION}" || fail "tag v${VERSION} không chứa bản vá khẩn cấp $patch_tag"
      done < infra/emergency-patches.txt
    fi
    echo "Tag v${VERSION} đạt"
    ;;
  build)
    need VERSION IMAGE_REPOSITORY
    # Mã ứng dụng lấy từ tag; Dockerfile lấy từ infra/docker hiện tại (nhánh main).
    workdir=$(mktemp -d)
    git archive "v${VERSION}" | tar -x -C "$workdir"
    rm -rf "${workdir:?}/infra" && cp -r infra "$workdir/infra" && cp .dockerignore "$workdir/.dockerignore"
    commit=$(git rev-parse --short "v${VERSION}^{commit}")
    for kind in api web; do
      docker build -f "$workdir/infra/docker/$kind.Dockerfile" -t "$(image "$kind" "$VERSION")" -t "$(image "$kind" "$VERSION-$commit")" \
        --label "org.opencontainers.image.version=$VERSION" --label "org.opencontainers.image.revision=$commit" "$workdir"
      docker push "$(image "$kind" "$VERSION")"
      docker push "$(image "$kind" "$VERSION-$commit")"
    done
    rm -rf "${workdir:?}"
    ;;
  record)
    mkdir -p "$(dirname "$previous_file")"
    running_version > "$previous_file"
    echo "Phiên bản đang chạy: $(cat "$previous_file")"
    ;;
  backup)
    need VERSION DATABASE_URL BACKUP_AGE_RECIPIENT BACKUP_BUCKET CLOUDFLARE_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
    prefix="${BACKUP_PREFIX:-production}"
    if [ "$prefix" = "hang-ngay" ]; then name="$prefix/$(date -u +%Y%m%dT%H%M%SZ).dump.age"; else name="$prefix/truoc-${VERSION}-$(date -u +%Y%m%dT%H%M%SZ).dump.age"; fi
    # pg_dump bản 17 khớp Supabase; mã hóa trước khi rời máy chạy, không ghi tệp chưa mã hóa ra đĩa.
    # Gắn chứng chỉ gốc Supabase cùng đường dẫn như trong ảnh api để sslrootcert trong DATABASE_URL dùng chung được.
    docker run --rm -e DATABASE_URL -v "$PWD/infra/certificates:/app/infra/certificates:ro" postgres:17 sh -c 'pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL"' \
      | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" \
      | AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto \
        aws s3 cp - "s3://${BACKUP_BUCKET}/${name}" --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
    echo "Đã sao lưu: ${BACKUP_BUCKET}/${name}"
    if [ -n "${GITHUB_ENV:-}" ]; then echo "BACKUP_DONE=1" >> "$GITHUB_ENV"; fi
    ;;
  prune-backups)
    need BACKUP_BUCKET CLOUDFLARE_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_PREFIX
    keep="${BACKUP_KEEP:-30}"
    export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
    endpoint="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
    # Tên tệp có thời điểm UTC nên thứ tự tên là thứ tự thời gian; xóa các bản cũ hơn KEEP bản mới nhất.
    aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" --endpoint-url "$endpoint" | awk '{print $4}' | grep '\.dump\.age$' | sort | head -n "-$keep" \
      | while read -r old; do aws s3 rm "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/$old" --endpoint-url "$endpoint"; done
    echo "Giữ $keep bản mới nhất trong ${BACKUP_PREFIX}/"
    ;;
  sync)
    # Tệp compose trên máy ảo luôn theo nhánh main; .env, chứng chỉ không chép (đặt sẵn trên máy).
    remote "cat > '$deploy_directory/compose.production.yml'" < infra/compose/compose.production.yml
    echo "Đã chép compose.production.yml"
    ;;
  migrate)
    need VERSION
    # Luôn sao lưu trước migration (quyết định của người dùng 2026-11-18; Supabase gói miễn phí không tự sao lưu).
    [ "${BACKUP_DONE:-}" = "1" ] || fail "phải sao lưu (bước backup) trước khi chạy migration"
    [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "phiên bản không hợp lệ: $VERSION"
    # Biến môi trường của lệnh thắng giá trị trong .env khi compose thay biến: dùng ảnh mới mà chưa đổi .env.
    remote "cd '$deploy_directory' && export VCOMM_VERSION=$VERSION && { [ \"\${DEPLOY_SKIP_PULL:-}\" = 1 ] || docker compose $compose_files pull --quiet api; } && docker compose $compose_files run --rm --no-deps api node apps/api/dist/database/run-migrations.js"
    ;;
  seed)
    fail "không nạp dữ liệu thử trên môi trường thật"
    ;;
  release)
    need VERSION
    previous=$(running_version)
    if start_version "$VERSION"; then
      echo "Đang chạy phiên bản $VERSION"
    else
      echo "Phiên bản $VERSION không qua kiểm tra sống; về phiên bản $previous" >&2
      [ -n "$previous" ] && start_version "$previous"
      fail "triển khai $VERSION lỗi, đã về $previous"
    fi
    ;;
  verify)
    need PUBLIC_API_URL PUBLIC_WEB_URL
    for url in "${PUBLIC_API_URL}/api/v1/auth/methods" "${PUBLIC_WEB_URL}/dang-nhap"; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url")
      [ "$code" = "200" ] || fail "$url trả mã $code"
      echo "$url: 200"
    done
    ;;
  rollback)
    need ROLLBACK_VERSION IMAGE_REPOSITORY
    remote "for ref in '$(image api "$ROLLBACK_VERSION")' '$(image web "$ROLLBACK_VERSION")'; do docker image inspect \$ref >/dev/null 2>&1 || docker manifest inspect \$ref >/dev/null 2>&1 || exit 1; done" \
      || fail "không có ảnh phiên bản $ROLLBACK_VERSION; chưa đổi gì"
    start_version "$ROLLBACK_VERSION"
    echo "Đã về phiên bản $ROLLBACK_VERSION"
    ;;
  *)
    fail "bước không hợp lệ: '${step}' (check-tag, build, record, backup, prune-backups, sync, migrate, release, verify, rollback)"
    ;;
esac
