#!/usr/bin/env bash
# 构建及隔离迁移演练，不切换现有服务。发布包可来自经许可的提交或带哈希的快照。
set -Eeuo pipefail
release=${1:?release required}
sha=${2:?archive SHA256 required}
[[ "$release" =~ ^admin-[0-9]{8}-[a-f0-9]{8,12}$ && "$sha" =~ ^[a-f0-9]{64}$ ]]
base=/srv/sunows/apps/tabi
envf="$base/shared/.env"
stage="$base/releases/$release"
test ! -e "$stage"
printf '%s  %s\n' "$sha" "$stage.tar.gz" | sha256sum --check
python3 - "$stage.tar.gz" <<'PY'
import sys,tarfile,pathlib
with tarfile.open(sys.argv[1]) as archive:
    for member in archive.getmembers():
        p=pathlib.PurePosixPath(member.name)
        if p.is_absolute() or '..' in p.parts or member.issym() or member.islnk():
            raise SystemExit('Unsafe release archive')
PY
mkdir "$stage"
tar --no-same-owner --no-same-permissions -xzf "$stage.tar.gz" -C "$stage"
cp "$base/releases/$release-RELEASE_MANIFEST.json" "$stage/RELEASE_MANIFEST.json"
cd "$stage"
python3 deploy/lightsail/check-env.py "$envf"
c=(sudo env "RELEASE_TAG=$release" docker compose --env-file "$envf" -f compose.production.yml)
"${c[@]}" config --quiet

# 先备份正式库，再在无端口、无生产存储配置的临时 MySQL 中演练 V25 / V26。
umask 077
backups="$base/shared/backups"
mkdir -p "$backups"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backups/$stamp-rehearsal-$release.sql.gz"
sudo docker exec tabi-mysql-1 sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF tabitrace' | gzip > "$backup"
test -s "$backup"; gzip -t "$backup"
printf 'VERIFIED_REHEARSAL_BACKUP %s %s\n' "$backup" "$(stat -c %s "$backup")"
name="tabi-migration-$release"
credentials="$backups/.migration-$release.env"
printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_DATABASE=tabitrace\n' "$(openssl rand -hex 32)" > "$credentials"
test -z "$(sudo docker ps -aq --filter "name=^/$name$")"
cid=''
cleanup(){
  if [[ -n "$cid" ]]; then
    test "$(sudo docker inspect --format '{{index .Config.Labels "tabi.migration-check"}}' "$cid")" = "$release"
    sudo docker rm -f -v "$cid" >/dev/null
  fi
  rm -f -- "$credentials"
}
trap cleanup EXIT
cid=$(sudo docker run -d --name "$name" --label "tabi.migration-check=$release" --memory=768m --env-file "$credentials" mysql:8.4)
ready=0
for i in $(seq 1 90); do
  if sudo docker exec "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -Nse "SELECT 1" tabitrace' >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1
gzip -dc "$backup" | sudo docker exec -i "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root tabitrace'
before=$(sudo docker exec "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -Nse "SELECT COUNT(*) FROM trips" tabitrace')
for file in backend/api/src/main/resources/db/migration/V25__administrator_and_account_limits.sql backend/api/src/main/resources/db/migration/V26__admin_management_modules.sql; do
  sudo docker exec -i "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root tabitrace' < "$file"
done
sudo docker exec "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -Nse "SELECT (SELECT COUNT(*) FROM users WHERE role='\''ADMIN'\''),(SELECT COUNT(*) FROM trips),(SELECT COUNT(*) FROM photos),(SELECT COUNT(*) FROM video_projects),(SELECT COUNT(*) FROM admin_registration_defaults)" tabitrace'
after=$(sudo docker exec "$cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -Nse "SELECT COUNT(*) FROM trips" tabitrace')
test "$before" = "$after"
cleanup; cid=''; trap - EXIT
echo ADMIN_MIGRATION_REHEARSAL_SUCCESS

# Worker 源码本轮未变，保留运行实例，只为现有镜像加发布标签。
worker_image=$(sudo docker inspect --format '{{.Image}}' tabi-worker-1)
sudo docker tag "$worker_image" "tabitrace-worker:$release"
"${c[@]}" build api
"${c[@]}" build web
for service in api web worker; do sudo docker image inspect "tabitrace-$service:$release" --format "$service {{.Id}}"; done
echo ADMIN_BUILD_SUCCESS
