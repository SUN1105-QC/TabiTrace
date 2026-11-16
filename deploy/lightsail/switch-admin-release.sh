#!/usr/bin/env bash
# 只切换 API / Web；切换前停止 API 写入并作最终备份，保留 MySQL、Worker 实例与旧镜像。
set -Eeuo pipefail
release=${1:?release required}
previous=${2:?previous web release required}
prev_backend=${3:?previous API release required}
[[ "$release" =~ ^admin-[0-9]{8}-[a-f0-9]{8,12}$ ]]
[[ "$previous" =~ ^[a-z0-9-]+$ && "$prev_backend" =~ ^[a-z0-9-]+$ ]]
base=/srv/sunows/apps/tabi
envf="$base/shared/.env"
test "$(cat "$base/shared/current-release.txt")" = "$previous"
grep -q ADMIN_BUILD_SUCCESS "$base/releases/$release-build.log"
for service in api web worker; do sudo docker image inspect "tabitrace-$service:$release" >/dev/null; done
cd "$base/releases/$release"
c=(sudo env "RELEASE_TAG=$release" docker compose --env-file "$envf" -f compose.production.yml)
q(){ sudo docker exec tabi-mysql-1 sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root -Nse "$1" tabitrace' sh "$1"; }
test "$(q "SELECT COUNT(*) FROM video_projects WHERE status IN ('QUEUED','PROCESSING','RENDERING')")" = 0
test "$(q 'SELECT COUNT(*) FROM flyway_schema_history WHERE success=0')" = 0
test "$(q 'SELECT MAX(version+0) FROM flyway_schema_history WHERE success=1')" = 24
# 若演练与切换间跨过到期日，停止发布，不能无提示让旧数据失效。
test "$(q 'SELECT COUNT(*) FROM trips WHERE DATE_ADD(created_at,INTERVAL 1 MONTH)<=UTC_TIMESTAMP(6)')" = 0
mysql_id=$(sudo docker inspect --format '{{.Id}}' tabi-mysql-1)
worker_id=$(sudo docker inspect --format '{{.Id}}' tabi-worker-1)
rollback(){
  echo ADMIN_SWITCH_FAILED_ROLLING_BACK_APPLICATIONS
  cd "$base/releases/$prev_backend"
  sudo env "RELEASE_TAG=$prev_backend" docker compose --env-file "$envf" -f compose.production.yml up -d --no-deps --wait --wait-timeout 300 api || true
  cd "$base/releases/$previous"
  sudo env "RELEASE_TAG=$previous" docker compose --env-file "$envf" -f compose.production.yml up -d --no-deps --wait --wait-timeout 180 web || true
  printf '%s\n' "$previous" > "$base/shared/current-release.txt"
  echo "Database migrations are retained. Final pre-migration backup: ${backup:-not-created}"
}
trap rollback ERR
"${c[@]}" stop api
# API 已停止接收写入；若最后一刻有用户排队任务，恢复旧 API，等待任务结束再发布。
test "$(q "SELECT COUNT(*) FROM video_projects WHERE status IN ('QUEUED','PROCESSING','RENDERING')")" = 0
umask 077
backups="$base/shared/backups"
mkdir -p "$backups"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
prefix="$backups/$stamp-before-$release"
cp "$envf" "$prefix.env"
sudo docker inspect tabi-web-1 tabi-api-1 tabi-worker-1 tabi-mysql-1 --format '{{.Name}} {{.Config.Image}} {{.Image}} {{.Id}} {{.State.StartedAt}}' > "$prefix.images.txt"
backup="$prefix.sql.gz"
sudo docker exec tabi-mysql-1 sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF tabitrace' | gzip > "$backup"
test -s "$backup"; gzip -t "$backup"
printf 'VERIFIED_FINAL_BACKUP %s %s\n' "$backup" "$(stat -c %s "$backup")"
before=$(q "SELECT CONCAT((SELECT COUNT(*) FROM trips),':',(SELECT COUNT(*) FROM photos),':',(SELECT COUNT(*) FROM video_projects))")
before_users=$(q 'SELECT COUNT(*) FROM users')
existing_admin=$(q "SELECT COUNT(*) FROM users WHERE email='sunqingchuan1105@gmail.com'")
"${c[@]}" up -d --no-deps --wait --wait-timeout 300 api
curl -fsS --retry 5 --retry-delay 2 --max-time 15 http://127.0.0.1:18080/actuator/health
test "$(q 'SELECT MAX(version+0) FROM flyway_schema_history WHERE success=1')" = 26
test "$(q "SELECT CONCAT((SELECT COUNT(*) FROM trips),':',(SELECT COUNT(*) FROM photos),':',(SELECT COUNT(*) FROM video_projects))")" = "$before"
test "$(q 'SELECT COUNT(*) FROM users')" = "$((before_users + 1 - existing_admin))"
test "$(q "SELECT COUNT(*) FROM users WHERE role='ADMIN'")" = 1
"${c[@]}" up -d --no-deps --wait --wait-timeout 180 web
curl -fsS --retry 5 --retry-delay 2 --max-time 15 http://127.0.0.1:13000/health
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:13000/admin)" = 200
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/api/v1/admin/overview)" = 401
test "$(sudo docker inspect --format '{{.Id}}' tabi-mysql-1)" = "$mysql_id"
test "$(sudo docker inspect --format '{{.Id}}' tabi-worker-1)" = "$worker_id"
printf '%s\n' "$release" > "$base/shared/current-release.txt"
trap - ERR
q "SELECT 'AFTER',(SELECT MAX(version+0) FROM flyway_schema_history WHERE success=1),(SELECT COUNT(*) FROM users),(SELECT COUNT(*) FROM trips),(SELECT COUNT(*) FROM photos),(SELECT COUNT(*) FROM video_projects)"
sudo docker inspect tabi-web-1 tabi-api-1 tabi-worker-1 tabi-mysql-1 --format '{{.Name}} {{.Config.Image}} restarts={{.RestartCount}}'
echo ADMIN_SWITCH_SUCCESS
