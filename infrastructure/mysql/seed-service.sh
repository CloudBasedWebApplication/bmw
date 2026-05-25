#!/bin/sh
set -eu

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

validate_identifier() {
  name="$1"
  value="$2"
  case "$value" in
    *[!A-Za-z0-9_]*)
      echo "$name must contain only letters, digits, and underscores: $value" >&2
      exit 1
      ;;
  esac
}

escape_sql_string() {
  printf "%s" "$1" | sed "s/'/''/g"
}

require_env MYSQL_HOST
require_env ROOT_PASSWORD
require_env APP_USER
require_env APP_PASSWORD
require_env APP_DATABASE
require_env SEED_FILE

validate_identifier APP_DATABASE "$APP_DATABASE"

if [ ! -f "$SEED_FILE" ]; then
  echo "Seed file does not exist: $SEED_FILE" >&2
  exit 1
fi

app_user=$(escape_sql_string "$APP_USER")
app_password=$(escape_sql_string "$APP_PASSWORD")

MYSQL_PWD="$ROOT_PASSWORD" mysql -h "$MYSQL_HOST" -u root < "$SEED_FILE"

MYSQL_PWD="$ROOT_PASSWORD" mysql -h "$MYSQL_HOST" -u root <<SQL
SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'NO_BACKSLASH_ESCAPES');
CREATE USER IF NOT EXISTS '${app_user}'@'%' IDENTIFIED BY '${app_password}';
ALTER USER '${app_user}'@'%' IDENTIFIED BY '${app_password}';
GRANT ALL PRIVILEGES ON \`${APP_DATABASE}\`.* TO '${app_user}'@'%';
FLUSH PRIVILEGES;
SQL
