#!/bin/sh
# wait-for-mongo.sh

set -e

until nc -z ${MONGODB_HOST:-mongo} ${MONGODB_PORT:-27017}; do
  echo "Waiting for MongoDB to be ready..."
  sleep 2
done

echo "MongoDB is ready!"
exec "$@" 