#!/bin/bash
export DOCKER_BUILDKIT=1

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

pushd "$PROJECT_DIR"

docker build -t cloudmark-app -f docker/Dockerfile . && \
docker run -it --name cloudmark-container --rm \
  -p 3000:3000 \
  -v "$PROJECT_DIR:/app" \
  -v /app/node_modules \
  cloudmark-app

popd
