#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
shared=/srv/sunows/apps/tabi/shared
mkdir -p "$shared"
chmod 0700 "$shared"
python3 - "$root/deploy/lightsail/.env.example" "$shared/.env" <<'PY'
import os, pathlib, secrets, sys
template, target = map(pathlib.Path, sys.argv[1:])
if target.exists():
    print('Existing server env preserved')
else:
    text = template.read_text()
    for key in ['DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'JWT_SECRET']:
        text = text.replace(key+'=\n', key+'='+secrets.token_hex(32)+'\n')
    fd = os.open(target, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(text)
    print('Server-only env created; DB and JWT secrets generated without printing values')
PY
