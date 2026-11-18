#!/usr/bin/env bash
# Triển khai một phiên bản VComm lên một môi trường (CONG_VIEC_76, tài liệu 26 mục 2).
# Dùng chung cho GitHub Actions (.github/workflows/trien-khai.yml) và máy phiên AI. Chỉ chạy khi người dùng đã duyệt lần triển khai này.
#
# Cách dùng: infra/scripts/deploy.sh <bước> ; các bước theo thứ tự:
#   check-tag      kiểm tag chứa mọi bản vá khẩn cấp đã triển khai (infra/emergency-patches.txt)
#   build          build, đẩy hai ảnh lên kho ảnh (cần docker đã đăng nhập kho ảnh)
#   record         ghi ảnh đang chạy của từng dịch vụ vào tệp PREVIOUS_IMAGES_FILE
#   backup         pg_dump, mã hóa bằng age, tải lên bucket sao lưu
#   migrate        chạy database migration bằng ảnh mới
#   seed           nạp dữ liệu thử (chỉ môi trường staging)
#   release        đổi ảnh của dịch vụ sang VERSION, chờ triển khai xong
#   verify         kiểm tra sau triển khai
#   rollback       đổi ảnh về ROLLBACK_VERSION
#
# Biến môi trường (không ghi giá trị bí mật vào mã):
#   DEPLOY_ENVIRONMENT        staging | production
#   VERSION                   mã phiên bản, ví dụ 0.14.0 (tag v0.14.0)
#   IMAGE_REPOSITORY          ví dụ ghcr.io/vinhngtienmdb-ui ; ảnh: <kho>/vcomm-api:<phiên bản>, <kho>/vcomm-web:<phiên bản>
#   DATABASE_URL              (bí mật) Supavisor chế độ phiên của môi trường
#   RAILWAY_TOKEN             (bí mật) token dự án Railway của môi trường
#   RAILWAY_ENVIRONMENT_ID, RAILWAY_SERVICE_API_ID, RAILWAY_SERVICE_WEB_ID, RAILWAY_SERVICE_WORKER_ID (worker để trống ở staging)
#   BACKUP_AGE_RECIPIENT      khóa công khai age của người dùng
#   BACKUP_BUCKET, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID (bí mật), R2_SECRET_ACCESS_KEY (bí mật)
#   PUBLIC_API_URL, PUBLIC_WEB_URL   địa chỉ công khai, không có dấu / cuối
#   PREVIOUS_IMAGES_FILE      tệp ghi ảnh trước khi đổi (mặc định tam_thoi/anh-truoc-trien-khai.txt)
set -euo pipefail

step="${1:-}"
railway_api="https://backboard.railway.com/graphql/v2"
previous_file="${PREVIOUS_IMAGES_FILE:-tam_thoi/anh-truoc-trien-khai.txt}"

fail() { echo "DỪNG: $*" >&2; exit 1; }
need() { for name in "$@"; do [ -n "${!name:-}" ] || fail "thiếu biến $name"; done; }

need DEPLOY_ENVIRONMENT
case "$DEPLOY_ENVIRONMENT" in staging | production) ;; *) fail "DEPLOY_ENVIRONMENT phải là staging hoặc production" ;; esac

image() { echo "${IMAGE_REPOSITORY}/vcomm-$1:$2"; }

railway() {
  # $1: câu truy vấn GraphQL, $2: biến dạng JSON. Lỗi GraphQL thì dừng.
  local body response
  body=$(jq -cn --arg query "$1" --argjson variables "$2" '{query: $query, variables: $variables}')
  response=$(curl -sS --fail-with-body -X POST "$railway_api" -H "Content-Type: application/json" -H "Project-Access-Token: ${RAILWAY_TOKEN}" --data "$body")
  if [ "$(jq '.errors // [] | length' <<<"$response")" != "0" ]; then fail "Railway trả lỗi: $(jq -c '.errors' <<<"$response")"; fi
  echo "$response"
}

services() {
  # Dịch vụ dùng ảnh api, web của môi trường: "mã dịch vụ:loại ảnh".
  echo "${RAILWAY_SERVICE_API_ID}:api"
  [ -n "${RAILWAY_SERVICE_WORKER_ID:-}" ] && echo "${RAILWAY_SERVICE_WORKER_ID}:api"
  echo "${RAILWAY_SERVICE_WEB_ID}:web"
}

current_image() {
  railway 'query($serviceId: String!, $environmentId: String!) { serviceInstance(serviceId: $serviceId, environmentId: $environmentId) { source { image } } }' \
    "$(jq -cn --arg serviceId "$1" --arg environmentId "$RAILWAY_ENVIRONMENT_ID" '{serviceId: $serviceId, environmentId: $environmentId}')" | jq -r '.data.serviceInstance.source.image // ""'
}

switch_images() {
  # Đổi ảnh mọi dịch vụ sang phiên bản $1 rồi chờ từng dịch vụ triển khai xong.
  local version="$1" entry service kind target
  for entry in $(services); do
    kind="${entry#*:}"
    docker manifest inspect "$(image "$kind" "$version")" >/dev/null 2>&1 || fail "không có ảnh $(image "$kind" "$version")"
  done
  for entry in $(services); do
    service="${entry%%:*}"; kind="${entry#*:}"; target="$(image "$kind" "$version")"
    echo "Đổi dịch vụ $service sang $target"
    railway 'mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input) }' \
      "$(jq -cn --arg serviceId "$service" --arg environmentId "$RAILWAY_ENVIRONMENT_ID" --arg image "$target" '{serviceId: $serviceId, environmentId: $environmentId, input: {source: {image: $image}}}')" >/dev/null
    railway 'mutation($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }' \
      "$(jq -cn --arg serviceId "$service" --arg environmentId "$RAILWAY_ENVIRONMENT_ID" '{serviceId: $serviceId, environmentId: $environmentId}')" >/dev/null
    wait_deployment "$service"
  done
}

wait_deployment() {
  # Railway giữ bản cũ chạy đến khi bản mới qua kiểm tra sống; chờ tối đa 15 phút.
  local service="$1" status="" deadline=$((SECONDS + 900))
  while [ $SECONDS -lt $deadline ]; do
    status=$(railway 'query($serviceId: String!, $environmentId: String!) { serviceInstance(serviceId: $serviceId, environmentId: $environmentId) { latestDeployment { status } } }' \
      "$(jq -cn --arg serviceId "$service" --arg environmentId "$RAILWAY_ENVIRONMENT_ID" '{serviceId: $serviceId, environmentId: $environmentId}')" | jq -r '.data.serviceInstance.latestDeployment.status')
    case "$status" in
      SUCCESS) echo "Dịch vụ $service: triển khai xong"; return 0 ;;
      FAILED | CRASHED | REMOVED) fail "dịch vụ $service triển khai lỗi ($status); bản cũ vẫn chạy nếu chưa qua kiểm tra sống" ;;
    esac
    sleep 15
  done
  fail "dịch vụ $service chưa xong sau 15 phút (trạng thái $status)"
}

run_api_image() {
  # Chạy một lệnh trong ảnh api phiên bản VERSION, nối cơ sở dữ liệu của môi trường.
  docker run --rm -e DATABASE_URL -e NODE_ENV="$1" "$(image api "$VERSION")" node "$2"
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
    # Mã ứng dụng lấy từ tag; Dockerfile lấy từ thư mục infra/docker hiện tại (nhánh main).
    workdir=$(mktemp -d)
    git archive "v${VERSION}" | tar -x -C "$workdir"
    rm -rf "$workdir/infra" && cp -r infra "$workdir/infra" && cp .dockerignore "$workdir/.dockerignore"
    commit=$(git rev-parse --short "v${VERSION}^{commit}")
    for kind in api web; do
      docker build -f "$workdir/infra/docker/$kind.Dockerfile" -t "$(image "$kind" "$VERSION")" -t "$(image "$kind" "$VERSION-$commit")" \
        --label "org.opencontainers.image.version=$VERSION" --label "org.opencontainers.image.revision=$commit" "$workdir"
      docker push "$(image "$kind" "$VERSION")"
      docker push "$(image "$kind" "$VERSION-$commit")"
    done
    rm -rf "$workdir"
    ;;
  record)
    need RAILWAY_TOKEN RAILWAY_ENVIRONMENT_ID RAILWAY_SERVICE_API_ID RAILWAY_SERVICE_WEB_ID
    mkdir -p "$(dirname "$previous_file")"
    : > "$previous_file"
    for entry in $(services); do echo "${entry%%:*} $(current_image "${entry%%:*}")" >> "$previous_file"; done
    cat "$previous_file"
    ;;
  backup)
    need VERSION DATABASE_URL BACKUP_AGE_RECIPIENT BACKUP_BUCKET CLOUDFLARE_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
    name="${DEPLOY_ENVIRONMENT}/truoc-${VERSION}-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
    # pg_dump bản 17 khớp Supabase; mã hóa trước khi rời máy chạy, không ghi tệp chưa mã hóa ra đĩa.
    docker run --rm -e DATABASE_URL postgres:17 sh -c 'pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL"' \
      | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" \
      | AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto \
        aws s3 cp - "s3://${BACKUP_BUCKET}/${name}" --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
    echo "Đã sao lưu: ${BACKUP_BUCKET}/${name}"
    ;;
  migrate)
    need VERSION IMAGE_REPOSITORY DATABASE_URL
    run_api_image "$DEPLOY_ENVIRONMENT" apps/api/dist/database/run-migrations.js
    ;;
  seed)
    need VERSION IMAGE_REPOSITORY DATABASE_URL
    [ "$DEPLOY_ENVIRONMENT" = "staging" ] || fail "không nạp dữ liệu thử trên môi trường thật"
    run_api_image staging apps/api/dist/database/seed.js
    ;;
  release)
    need VERSION IMAGE_REPOSITORY RAILWAY_TOKEN RAILWAY_ENVIRONMENT_ID RAILWAY_SERVICE_API_ID RAILWAY_SERVICE_WEB_ID
    switch_images "$VERSION"
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
    need ROLLBACK_VERSION IMAGE_REPOSITORY RAILWAY_TOKEN RAILWAY_ENVIRONMENT_ID RAILWAY_SERVICE_API_ID RAILWAY_SERVICE_WEB_ID
    switch_images "$ROLLBACK_VERSION"
    ;;
  *)
    fail "bước không hợp lệ: '${step}' (check-tag, build, record, backup, migrate, seed, release, verify, rollback)"
    ;;
esac
