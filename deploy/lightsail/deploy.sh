#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
env_file=/srv/sunows/apps/tabi/shared/.env
python3 "$root/deploy/lightsail/check-env.py" "$env_file"
cd "$root"
export RELEASE_TAG
RELEASE_TAG=$(git rev-parse --short=12 HEAD)
compose=(sudo env "RELEASE_TAG=$RELEASE_TAG" docker compose --env-file "$env_file" -f compose.production.yml)
"${compose[@]}" config --quiet
for service in web api worker; do
  "${compose[@]}" build --pull "$service"
done
# Capture the running database before API startup can apply new Flyway migrations.
# Existing images remain available for application rollback; never remove data volumes.
mysql_id=$("${compose[@]}" ps --status running -q mysql)
if [[ -n "$mysql_id" ]]; then
  backup_dir=/srv/sunows/apps/tabi/shared/backups
  umask 077
  mkdir -p "$backup_dir"
  backup_file="$backup_dir/$(date -u +%Y%m%dT%H%M%SZ)-before-$RELEASE_TAG.sql.gz"
  "${compose[@]}" exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers --no-tablespaces --set-gtid-purged=OFF tabitrace' | gzip > "$backup_file"
  test -s "$backup_file"
  gzip -t "$backup_file"
  printf '\nPre-migration backup: %s\n' "$backup_file"
fi
"${compose[@]}" up -d --wait --wait-timeout 300
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:18080/actuator/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:13000/health
"${compose[@]}" ps
printf '\nApplication checks passed. Configure the Nginx site and TLS using README.md.\n'
