#!/usr/bin/env bash
# Chép bản sao lưu database lên Google Drive (dùng rclone). Chạy trên server.
#
#   ./backup-gdrive.sh                 nén bản sao lưu mới nhất trong data/backups/ rồi đưa lên Drive
#   ./backup-gdrive.sh --all           đưa lên mọi bản trong data/backups/ mà Drive chưa có
#   ./backup-gdrive.sh --list          xem các bản đang có trên Drive
#   ./backup-gdrive.sh --get NGÀY      tải 1 bản về restore/, vd: --get 2026-11-23
#   ./backup-gdrive.sh --install-cron  tự chạy mỗi tuần, 3:30 sáng Chủ nhật (giờ server)
#   ./backup-gdrive.sh --check         kiểm tra rclone + kết nối Drive
#
# Cấu hình (tùy chọn) trong .env cạnh file này:
#   GDRIVE_REMOTE=gdrive:quanly-don-backup   tên remote rclone + thư mục trên Drive
#   GDRIVE_KEEP_DAYS=365                     bản cũ hơn số ngày này bị xóa khỏi Drive
# Cài đặt lần đầu: xem DEPLOY.md, mục "Sao lưu lên Google Drive".
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$APP_DIR/.env"
LOCAL_DIR="$APP_DIR/data/backups"
LOG_FILE="$APP_DIR/backup-gdrive.log"

env_get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r"' || true; }
REMOTE="$(env_get GDRIVE_REMOTE)"; REMOTE="${REMOTE:-gdrive:quanly-don-backup}"
KEEP_DAYS="$(env_get GDRIVE_KEEP_DAYS)"; KEEP_DAYS="${KEEP_DAYS:-365}"

log()  { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die()  { log "LỖI: $*" >&2; exit 1; }

need_rclone() {
  command -v rclone >/dev/null || die "Chưa cài rclone. Chạy: sudo -v ; curl https://rclone.org/install.sh | sudo bash"
  rclone listremotes 2>/dev/null | grep -qx "${REMOTE%%:*}:" ||
    die "rclone chưa có remote '${REMOTE%%:*}'. Chạy: rclone config (xem DEPLOY.md)"
}

# nén 1 file .db → .db.gz rồi đưa lên Drive (bỏ qua nếu Drive đã có bản cùng tên)
upload() {
  local src="$1" name tmp
  name="$(basename "$src").gz"
  if rclone lsf "$REMOTE/$name" 2>/dev/null | grep -qx "$name"; then
    log "Drive đã có $name, bỏ qua"
    return 0
  fi
  tmp="$(mktemp -d)"
  gzip -c -n -9 "$src" >"$tmp/$name"
  gzip -t "$tmp/$name" || { rm -rf "$tmp"; die "File nén $name bị lỗi"; }
  rclone copyto "$tmp/$name" "$REMOTE/$name" --retries 5 --low-level-retries 10 ||
    { rm -rf "$tmp"; die "Không đưa được $name lên Drive"; }
  log "Đã đưa lên Drive: $name ($(du -h "$tmp/$name" | cut -f1), gốc $(du -h "$src" | cut -f1))"
  rm -rf "$tmp"
}

cleanup_remote() {
  # xóa hẳn (không vào thùng rác Drive) các bản cũ hơn KEEP_DAYS ngày
  rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" --include 'don-*.db.gz' --drive-use-trash=false 2>/dev/null &&
    log "Giữ trên Drive các bản trong $KEEP_DAYS ngày gần nhất"
}

local_files() { ls -1 "$LOCAL_DIR"/don-????-??-??.db 2>/dev/null | sort; }

cmd_run() {
  need_rclone
  local latest
  latest="$(local_files | tail -n1)"
  [[ -n $latest ]] || die "Không thấy bản sao lưu nào trong $LOCAL_DIR (web có đang chạy không?)"
  upload "$latest"
  cleanup_remote
}

cmd_all() {
  need_rclone
  local f n=0
  while read -r f; do [[ -n $f ]] && { upload "$f"; n=$((n + 1)); }; done < <(local_files)
  ((n)) || die "Không thấy bản sao lưu nào trong $LOCAL_DIR"
  cleanup_remote
}

cmd_list() {
  need_rclone
  rclone lsl "$REMOTE" --include 'don-*.db.gz' | sort -k4
  echo "Thư mục: $REMOTE   ($(rclone size "$REMOTE" --include 'don-*.db.gz' 2>/dev/null | tr '\n' ' '))"
}

cmd_get() {
  need_rclone
  local d="${1:-}" name out
  [[ $d =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "Ghi ngày dạng YYYY-MM-DD, vd: $0 --get 2026-11-23"
  name="don-$d.db.gz"
  out="$APP_DIR/restore"
  mkdir -p "$out"
  rclone copyto "$REMOTE/$name" "$out/$name" || die "Drive không có $name. Xem: $0 --list"
  gzip -d -f "$out/$name"
  log "Đã tải về $out/don-$d.db"
  echo "Khôi phục: docker compose down → cp $out/don-$d.db data/don.db → rm -f data/don.db-wal data/don.db-shm → sudo chown 1000:1000 data/don.db → docker compose up -d"
}

cmd_check() {
  need_rclone
  rclone mkdir "$REMOTE" || die "Không tạo được thư mục $REMOTE trên Drive"
  rclone about "${REMOTE%%:*}:" 2>/dev/null | sed 's/^/  /' || true
  log "OK: rclone kết nối được Google Drive, sẽ lưu vào $REMOTE"
  log "Bản sao lưu trên server: $(local_files | wc -l) file trong $LOCAL_DIR"
}

cmd_install_cron() {
  local line="30 3 * * 0 $APP_DIR/backup-gdrive.sh >> $LOG_FILE 2>&1"
  { crontab -l 2>/dev/null | grep -v 'backup-gdrive.sh' || true; echo "$line"; } | crontab -
  log "Đã cài lịch: mỗi tuần, 3:30 sáng Chủ nhật. Log: $LOG_FILE"
  crontab -l | grep backup-gdrive.sh
}

case "${1:-}" in
  "")             cmd_run ;;
  --all)          cmd_all ;;
  --list)         cmd_list ;;
  --get)          cmd_get "${2:-}" ;;
  --check)        cmd_check ;;
  --install-cron) cmd_install_cron ;;
  -h|--help)      sed -n '2,14p' "$0" ;;
  *)              die "Không rõ lệnh: $1 (xem $0 --help)" ;;
esac
