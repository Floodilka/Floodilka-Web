#!/usr/bin/env bash
set -euo pipefail

REMOTE="floodilka-stage"
REMOTE_DEVOPS="/var/www/floodilka/devops"
REMOTE_FRONTEND="/srv/frontend"
PLATFORM="linux/amd64"

SERVICES=(backend gateway media-proxy admin metrics)
IMAGES=(floodilka-backend floodilka-gateway floodilka-media-proxy floodilka-admin floodilka-metrics)

STACKS_BACKEND=(
  "backend /var/www/floodilka/devops/backend/compose.yaml"
  "gateway /var/www/floodilka/devops/gateway/compose.yaml"
  "media /var/www/floodilka/devops/media-proxy/compose.yaml"
  "admin /var/www/floodilka/devops/admin/compose.yaml"
  "metrics /var/www/floodilka/devops/metrics/compose.yaml"
)

FORCE_SERVICES=(
  "backend_api"
  "backend_worker"
  "gateway_gateway"
  "media_media"
  "admin_admin"
  "metrics_metrics"
)

usage() {
  echo "Usage: $0 <target> [services...]"
  echo ""
  echo "Targets:"
  echo "  all        - Build & deploy everything (backend + frontend)"
  echo "  backend    - Build & deploy backend services"
  echo "  frontend   - Build & deploy frontend"
  echo "  devops     - Sync devops configs only (no build)"
  echo ""
  echo "For 'backend', you can optionally specify which services to build:"
  echo "  $0 backend backend gateway"
  echo ""
  echo "Available services: ${SERVICES[*]}"
  exit 1
}

log() { echo -e "\033[1;34m==>\033[0m \033[1m$*\033[0m"; }
ok()  { echo -e "\033[1;32m==>\033[0m \033[1m$*\033[0m"; }
err() { echo -e "\033[1;31m==>\033[0m \033[1m$*\033[0m" >&2; }

build_image() {
  local service=$1
  local image=$2
  local context="$service"
  local dockerfile="$service/Dockerfile"

  log "Building $image ($service) for $PLATFORM..."

  if [[ "$service" == "admin" ]]; then
    docker build \
      --platform "$PLATFORM" \
      -t "$image:latest" \
      -f "$dockerfile" \
      --build-arg "BUILD_TIMESTAMP=$(date +%s)" \
      "$context"
  else
    docker build \
      --platform "$PLATFORM" \
      -t "$image:latest" \
      -f "$dockerfile" \
      "$context"
  fi

  ok "Built $image"
}

transfer_image() {
  local image=$1
  log "Transferring $image to $REMOTE..."
  docker save "$image:latest" | ssh "$REMOTE" "docker load"
  ok "Transferred $image"
}

sync_devops() {
  log "Syncing devops configs..."
  rsync -az devops/ "$REMOTE:$REMOTE_DEVOPS/"
  ok "Devops configs synced"
}

deploy_backend_stacks() {
  log "Deploying backend stacks..."
  for entry in "${STACKS_BACKEND[@]}"; do
    local stack=${entry%% *}
    local compose=${entry#* }
    ssh "$REMOTE" "docker stack deploy -c $compose $stack"
  done

  log "Force-updating services..."
  for svc in "${FORCE_SERVICES[@]}"; do
    ssh "$REMOTE" "docker service update --force --detach $svc" || true
  done

  ssh "$REMOTE" "docker container prune -f && docker image prune -f" || true
  ok "Backend deployed"
}

build_frontend() {
  log "Building frontend..."
  cd frontend

  local sha
  sha=$(git rev-parse --short HEAD)
  local timestamp
  timestamp=$(date +%s)

  export PUBLIC_PROJECT_ENV=stable
  export PUBLIC_BUILD_SHA="$sha"
  export PUBLIC_BUILD_NUMBER=0
  export PUBLIC_BUILD_TIMESTAMP="$timestamp"

  pnpm wasm:codegen
  pnpm generate:colors
  pnpm generate:masks
  pnpm generate:css-types
  npx lingui compile
  rm -rf dist
  npx rspack build --mode production
  npx tsx scripts/build-sw.mjs

  echo "{\"sha\":\"$sha\",\"buildNumber\":0,\"buildTimestamp\":\"$timestamp\"}" > dist/version.json

  cd ..
  ok "Frontend built"
}

deploy_frontend() {
  log "Syncing frontend dist..."
  rsync -az --delete --exclude='desktop/' frontend/dist/ "$REMOTE:$REMOTE_FRONTEND/"

  log "Deploying frontend stack..."
  ssh "$REMOTE" "docker stack deploy -c $REMOTE_DEVOPS/frontend/compose.yaml frontend"
  ok "Frontend deployed"
}

health_check() {
  local url=$1
  local name=$2
  if curl -sf --retry 3 --retry-delay 5 --retry-all-errors "$url" > /dev/null; then
    ok "$name: healthy"
  else
    err "$name: UNHEALTHY"
  fi
}

run_health_checks() {
  local target=$1
  log "Running health checks (waiting 15s)..."
  sleep 15

  if [[ "$target" == "all" || "$target" == "backend" ]]; then
    health_check "https://stage.floodilka.com/api/_health" "API"
    health_check "https://stage.floodilka.com/media/_health" "Media Proxy"
    health_check "https://gateway.stage.floodilka.com/_health" "Gateway"
  fi

  if [[ "$target" == "all" || "$target" == "frontend" ]]; then
    health_check "https://stage.floodilka.com/" "Frontend"
  fi
}

# --- Main ---

[[ $# -lt 1 ]] && usage
TARGET=$1
shift

cd "$(dirname "$0")"

case "$TARGET" in
  all)
    # Build backend images
    for i in "${!SERVICES[@]}"; do
      build_image "${SERVICES[$i]}" "${IMAGES[$i]}"
    done
    for i in "${!IMAGES[@]}"; do
      transfer_image "${IMAGES[$i]}"
    done

    # Build frontend
    build_frontend

    # Sync & deploy
    sync_devops
    deploy_backend_stacks
    deploy_frontend
    run_health_checks all
    ;;

  backend)
    # Optional: specify which services to build
    if [[ $# -gt 0 ]]; then
      BUILD_SERVICES=("$@")
    else
      BUILD_SERVICES=("${SERVICES[@]}")
    fi

    for svc in "${BUILD_SERVICES[@]}"; do
      # Find index
      for i in "${!SERVICES[@]}"; do
        if [[ "${SERVICES[$i]}" == "$svc" ]]; then
          build_image "${SERVICES[$i]}" "${IMAGES[$i]}"
          transfer_image "${IMAGES[$i]}"
          break
        fi
      done
    done

    sync_devops
    deploy_backend_stacks
    run_health_checks backend
    ;;

  frontend)
    build_frontend
    sync_devops
    deploy_frontend
    run_health_checks frontend
    ;;

  devops)
    sync_devops
    ok "Done — only configs synced, no services restarted"
    ;;

  *)
    usage
    ;;
esac

ok "Deploy complete!"
