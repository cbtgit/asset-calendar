#!/bin/sh
set -eu

release_dir=${1:-}
root=/opt/asset-calendar
releases="$root/releases"
current="$root/current"
service=asset-calendar
retention=3

[ -n "$release_dir" ] || { echo "release directory is required" >&2; exit 2; }
release_dir=$(realpath -e "$release_dir" 2>/dev/null) || { echo "release directory not found" >&2; exit 2; }

case "$release_dir" in
  "$releases"/*) ;;
  *) echo "release must be inside $releases" >&2; exit 2 ;;
esac

[ -d "$release_dir/dist" ] || { echo "missing dist" >&2; exit 2; }
[ -x "$release_dir/pocketbase" ] || { echo "missing executable pocketbase" >&2; exit 2; }
[ -d "$release_dir/pb_migrations" ] || { echo "missing pb_migrations" >&2; exit 2; }
[ -d "$release_dir/pb_hooks" ] || { echo "missing pb_hooks" >&2; exit 2; }

if [ -n "$(find "$release_dir" -type l -print -quit)" ]; then
  echo "release must not contain symlinks" >&2
  exit 2
fi

old_target=$(readlink "$current" 2>/dev/null || true)
chown -R assetcalendar:assetcalendar "$release_dir/pocketbase" "$release_dir/pb_migrations" "$release_dir/pb_hooks"
chmod 0755 "$release_dir/pocketbase"

systemctl stop "$service"
rollback() {
  if [ -n "$old_target" ]; then
    ln -sfn "$old_target" "$current"
  fi
  systemctl start "$service" || true
}
trap rollback EXIT INT TERM HUP

"$release_dir/pocketbase" migrate up \
  --dir="$root/shared/pb_data" \
  --migrationsDir="$release_dir/pb_migrations"

ln -sfn "$release_dir" "$current"
if ! systemctl start "$service"; then
  rollback
  trap - EXIT INT TERM HUP
  exit 1
fi

if ! curl --fail --silent --show-error --retry 30 --retry-connrefused --retry-delay 1 --max-time 10 \
  http://127.0.0.1:8090/api/health >/dev/null; then
  rollback
  trap - EXIT INT TERM HUP
  exit 1
fi

trap - EXIT INT TERM HUP
find "$releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk "NR > $retention {print \$2}" \
  | xargs -r rm -rf

echo "Activated $release_dir"
