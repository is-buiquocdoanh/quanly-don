#!/usr/bin/env bash
# Triển khai web quản lý đơn theo phiên bản (git tag). Chạy trên server.
#
#   ./deploy.sh --status    web đang chạy bản nào, có khỏe không
#   ./deploy.sh --list      các phiên bản trên GitHub + image đã build sẵn trên máy
#   ./deploy.sh v1.2.0      chạy đúng bản v1.2.0 (lên bản mới hoặc QUAY LẠI bản cũ)
#   ./deploy.sh             (thử nhanh) bản mới nhất của nhánh main, chưa cần tag
#   ./deploy.sh --clean     xóa image cũ, giữ bản đang chạy + 5 bản mới nhất
#
# Cấu trúc thư mục (APP_DIR = thư mục chứa file này, thường là ~/apps/quanly-don):
#   deploy.sh  docker-compose.yml  .env  data/  src/ (git clone)  backups-deploy/  deploy.log
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$APP_DIR/src"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="$APP_DIR/deploy.log"
BACKUP_DIR="$APP_DIR/backups-deploy"
IMAGE="quanly-don"
CONTAINER="quanly-don"
BRANCH="${DEPLOY_BRANCH:-main}"
KEEP_IMAGES=5
KEEP_DB_BACKUPS=10

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mLỖI:\033[0m %s\n' "$*" >&2; exit 1; }

compose() { docker compose --project-directory "$APP_DIR" -f "$APP_DIR/docker-compose.yml" "$@"; }
git_src() { git -C "$SRC_DIR" "$@"; }
image_exists() { docker image inspect "$IMAGE:$1" >/dev/null 2>&1; }
current_version() { grep -E '^APP_VERSION=' "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || true; }

set_version() {
  if grep -qE '^APP_VERSION=' "$ENV_FILE"; then
    sed -i "s|^APP_VERSION=.*|APP_VERSION=$1|" "$ENV_FILE"
  else
    printf '\nAPP_VERSION=%s\n' "$1" >>"$ENV_FILE"
  fi
}

check_setup() {
  command -v docker >/dev/null || die "Chưa cài Docker."
  [[ -d $SRC_DIR/.git ]] || die "Chưa có $SRC_DIR - xem DEPLOY.md mục 3 (git clone)."
  [[ -f $ENV_FILE ]] || die "Chưa có $ENV_FILE - copy từ src/deploy/.env.example."
  [[ -f $APP_DIR/docker-compose.yml ]] || die "Chưa có docker-compose.yml trong $APP_DIR."
}

fetch() {
  log "Lấy thông tin mới từ GitHub…"
  git_src fetch --quiet --tags --prune --prune-tags --force origin
}

is_healthy() { docker exec "$CONTAINER" wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; }

wait_healthy() {
  local i
  for i in $(seq 1 30); do
    is_healthy && return 0
    sleep 1
  done
  return 1
}

build_image() {
  local ref="$1" ver="$2" tmp commit
  commit="$(git_src rev-parse --short "$ref^{commit}")"
  tmp="$(mktemp -d)"
  log "Build image $IMAGE:$ver (commit $commit)…"
  if ! { git_src archive "$ref" server | tar -x -C "$tmp" &&
         docker build -t "$IMAGE:$ver" \
           --label "quanly-don.version=$ver" --label "quanly-don.commit=$commit" \
           "$tmp/server"; }; then
    rm -rf "$tmp"
    die "Build thất bại - web vẫn chạy bản cũ."
  fi
  rm -rf "$tmp"
}

# Chép database ra ngoài trước khi đổi phiên bản (web đã dừng nên file nhất quán).
backup_db() {
  local db="$APP_DIR/data/don.db" dst f
  [[ -f $db ]] || return 0
  mkdir -p "$BACKUP_DIR"
  dst="$BACKUP_DIR/$(date +%Y%m%d-%H%M%S)_truoc-$1"
  mkdir -p "$dst"
  for f in "$db" "$db-wal" "$db-shm"; do
    [[ -f $f ]] && cp -p "$f" "$dst/"
  done
  log "Đã sao lưu database → ${dst#"$APP_DIR"/}"
  # giữ lại KEEP_DB_BACKUPS bản mới nhất
  ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +$((KEEP_DB_BACKUPS + 1)) | xargs -r rm -rf
}

cmd_deploy() {
  local target="${1:-}" ref ver prev
  check_setup

  if [[ -z $target ]]; then
    fetch
    ref="origin/$BRANCH"
    ver="$BRANCH-$(git_src rev-parse --short "$ref")"
  else
    [[ $target =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$ ]] || die "Tên phiên bản không hợp lệ: $target"
    ver="$target"
    ref="refs/tags/$target"
    if ! image_exists "$ver"; then
      fetch
      git_src rev-parse -q --verify "$ref^{commit}" >/dev/null ||
        die "Không có phiên bản $target trên GitHub. Xem: $0 --list"
    fi
  fi

  prev="$(current_version)"
  if [[ $prev == "$ver" ]] && is_healthy; then
    log "Web đang chạy đúng bản $ver rồi, không cần làm gì."
    return 0
  fi

  if image_exists "$ver"; then
    log "Dùng image $IMAGE:$ver đã build sẵn (không cần build lại)."
  else
    build_image "$ref" "$ver"
  fi

  log "Chuyển ${prev:-(chưa có)} → $ver"
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  backup_db "$ver"
  set_version "$ver"
  compose up -d --remove-orphans

  log "Chờ web khởi động…"
  if wait_healthy; then
    echo "$(date '+%F %T')  ${prev:-none} -> $ver  OK" >>"$LOG_FILE"
    log "✅ Xong! Web đang chạy bản $ver"
  else
    echo "$(date '+%F %T')  ${prev:-none} -> $ver  LỖI, quay lại $prev" >>"$LOG_FILE"
    docker logs --tail 30 "$CONTAINER" >&2 || true
    if [[ -n $prev ]] && image_exists "$prev"; then
      warn "Bản $ver không khởi động được - tự quay lại $prev"
      set_version "$prev"
      compose up -d
      wait_healthy && die "Đã quay lại $prev. Xem log lỗi ở trên." \
                   || die "Quay lại $prev cũng lỗi! Chạy: cd $APP_DIR && docker compose logs web"
    fi
    die "Bản $ver không khởi động được. Xem log ở trên."
  fi
}

cmd_status() {
  local ver state img commit
  ver="$(current_version)"
  echo "Phiên bản  : ${ver:-(chưa deploy)}"
  if state="$(docker inspect -f '{{.State.Status}} từ {{.State.StartedAt}}' "$CONTAINER" 2>/dev/null)"; then
    img="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
    commit="$(docker image inspect -f '{{index .Config.Labels "quanly-don.commit"}}' "$img" 2>/dev/null || true)"
    echo "Container  : $state"
    echo "Image      : $img${commit:+ (commit $commit)}"
    if is_healthy; then echo "Sức khỏe   : ✅ OK"; else echo "Sức khỏe   : ❌ không phản hồi"; fi
  else
    echo "Container  : ❌ không chạy"
  fi
  echo "Tunnel     : $(docker inspect -f '{{.State.Status}}' quanly-don-tunnel 2>/dev/null || echo 'không chạy')"
  if [[ -f $LOG_FILE ]]; then
    echo; echo "Lần deploy gần đây:"; tail -n 5 "$LOG_FILE" | sed 's/^/  /'
  fi
}

cmd_list() {
  local cur t mark
  check_setup
  cur="$(current_version)"
  fetch || warn "Không kết nối được GitHub - danh sách có thể cũ."

  echo; echo "Phiên bản trên GitHub (mới nhất trước):"
  local found=0
  while read -r t; do
    [[ -z $t ]] && continue
    found=1
    mark=""
    image_exists "$t" && mark+="  [đã build sẵn]"
    [[ $t == "$cur" ]] && mark+="  ◀ đang chạy"
    printf '  %-12s %s%s\n' "$t" "$(git_src log -1 --format='%cs  %s' "$t" | cut -c1-60)" "$mark"
  done < <(git_src tag -l --sort=-v:refname | head -n 20)
  [[ $found == 1 ]] || echo "  (chưa có tag nào - tạo bằng: git tag v1.0.0 && git push origin v1.0.0)"

  echo; echo "Nhánh $BRANCH mới nhất:"
  printf '  %s-%s  %s\n' "$BRANCH" "$(git_src rev-parse --short "origin/$BRANCH")" \
    "$(git_src log -1 --format='%cs  %s' "origin/$BRANCH" | cut -c1-60)"

  echo; echo "Image đã build trên máy:"
  docker images "$IMAGE" --format '{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}' | sed 's/^/  /'
}

cmd_clean() {
  local cur
  cur="$(current_version)"
  log "Giữ bản đang chạy ($cur) + $KEEP_IMAGES image mới nhất, xóa phần còn lại…"
  docker images "$IMAGE" --format '{{.Tag}}' |   # docker liệt kê mới nhất trước
    grep -vxF "${cur:-__none__}" | tail -n +$((KEEP_IMAGES + 1)) |
    while read -r t; do docker rmi "$IMAGE:$t" >/dev/null && echo "  đã xóa $t"; done
  docker image prune -f >/dev/null
}

case "${1:-}" in
  --status|-s) cmd_status ;;
  --list|-l)   cmd_list ;;
  --clean)     cmd_clean ;;
  -h|--help)   sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' ;;
  -*)          die "Không hiểu tùy chọn $1 (xem $0 --help)" ;;
  *)           cmd_deploy "${1:-}" ;;
esac
