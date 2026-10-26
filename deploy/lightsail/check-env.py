#!/usr/bin/env python3
"""Validate required production configuration without displaying secret values."""
import os
import pathlib
import sys
from urllib.parse import urlparse

filename = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/srv/sunows/apps/tabi/shared/.env')
if not filename.is_file():
    sys.exit('Missing server env file; run prepare.sh first')
if filename.stat().st_mode & 0o077:
    sys.exit('Server env permissions must be 0600')
values = {}
for line in filename.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
required = ['APP_URL','DB_PASSWORD','MYSQL_ROOT_PASSWORD','JWT_SECRET','R2_ENDPOINT','R2_ACCESS_KEY','R2_SECRET_KEY','R2_BUCKET','R2_PUBLIC_BASE_URL','MAIL_FROM_ADDRESS']
provider = values.get('MAIL_PROVIDER', 'smtp')
if provider == 'resend':
    required += ['RESEND_API_KEY']
elif provider == 'smtp':
    required += ['MAIL_HOST','MAIL_USERNAME','MAIL_PASSWORD']
else:
    sys.exit('MAIL_PROVIDER must be smtp or resend')
problems = [key+': missing' for key in required if not values.get(key)]
for key in ['APP_URL','R2_ENDPOINT','R2_PUBLIC_BASE_URL']:
    if values.get(key):
        url = urlparse(values[key])
        if url.scheme != 'https' or not url.hostname or url.hostname in ['localhost','127.0.0.1'] or url.hostname.endswith('.invalid'):
            problems.append(key+': requires a valid public HTTPS URL')
for key in ['DB_PASSWORD','MYSQL_ROOT_PASSWORD','JWT_SECRET']:
    if len(values.get(key, '')) < 32:
        problems.append(key+': requires at least 32 characters')
if problems:
    sys.exit('Production configuration is incomplete:\n'+'\n'.join('- '+p for p in problems))
print('Required production configuration is present (credential validity requires live verification)')
