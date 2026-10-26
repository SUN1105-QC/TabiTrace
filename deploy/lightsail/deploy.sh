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
"${compose[@]}" build --pull
"${compose[@]}" up -d --wait --wait-timeout 300
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:18080/actuator/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:13000/health
"${compose[@]}" ps
printf '\nApplication checks passed. Configure the Nginx site and TLS using README.md.\n'
