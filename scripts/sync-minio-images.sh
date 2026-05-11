#!/usr/bin/env sh

set -eu

echo "Syncing assets/configurator/ -> ${MINIO_BUCKET:-configurator-images}/configurator"
echo "Syncing assets/merch-shop/ -> ${MINIO_BUCKET:-configurator-images}/merch-shop"
echo "Syncing web/public/images/ -> ${MINIO_BUCKET:-configurator-images}/home"

docker compose run --rm minio-init
