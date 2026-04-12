#!/usr/bin/env sh

set -eu

echo "Syncing Configurator/ -> ${MINIO_BUCKET:-configurator-images}/configurator"
echo "Syncing Webshop/ -> ${MINIO_BUCKET:-configurator-images}/webshop"

docker compose run --rm minio-init
