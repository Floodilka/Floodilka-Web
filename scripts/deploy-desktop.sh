#!/usr/bin/env bash
set -euo pipefail

# Deploy desktop builds
# Usage: ./scripts/deploy-desktop.sh <canary|stable> [--mac] [--win] [--skip-build]
#
# Platforms:
#   --mac         Deploy macOS builds (DMG + auto-update ZIP)
#   --win         Deploy Windows builds (EXE installer + auto-update nupkg)
#   If no platform flags given, deploys all platforms.
#
# Examples:
#   ./scripts/deploy-desktop.sh canary              # build & deploy all platforms
#   ./scripts/deploy-desktop.sh canary --mac        # macOS only
#   ./scripts/deploy-desktop.sh canary --win        # Windows only
#   ./scripts/deploy-desktop.sh canary --mac --win  # explicit both
#   ./scripts/deploy-desktop.sh canary --skip-build # deploy existing builds

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
DIST_DIR="$FRONTEND_DIR/dist-electron"

# --- Parse args ---
CHANNEL=""
SKIP_BUILD=false
DEPLOY_MAC=false
DEPLOY_WIN=false

for arg in "$@"; do
    case "$arg" in
        canary) CHANNEL="canary" ;;
        stable) CHANNEL="stable" ;;
        --skip-build) SKIP_BUILD=true ;;
        --mac) DEPLOY_MAC=true ;;
        --win) DEPLOY_WIN=true ;;
    esac
done

if [ -z "$CHANNEL" ]; then
    echo "Usage: $0 <canary|stable> [--mac] [--win] [--skip-build]"
    exit 1
fi

# Default: deploy all if no platform specified
if [ "$DEPLOY_MAC" = false ] && [ "$DEPLOY_WIN" = false ]; then
    DEPLOY_MAC=true
    DEPLOY_WIN=true
fi

# --- Config per channel ---
if [ "$CHANNEL" = "canary" ]; then
    SERVER="floodilka-stage"
    DOMAIN="stage.floodilka.com"
else
    SERVER="floodilka"
    DOMAIN="floodilka.com"
fi

REMOTE_BASE="/srv/frontend/desktop/updates"
VERSION=$(node -p "require('$FRONTEND_DIR/package.json').version")

PLATFORMS=""
[ "$DEPLOY_MAC" = true ] && PLATFORMS="${PLATFORMS} mac"
[ "$DEPLOY_WIN" = true ] && PLATFORMS="${PLATFORMS} win"

echo ""
echo "🚀 Deploy Desktop v${VERSION} (${CHANNEL}) → ${DOMAIN}"
echo "   Platforms:${PLATFORMS}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- Build ---
if [ "$SKIP_BUILD" = false ]; then
    echo "🔨 Building desktop app (${CHANNEL})..."
    cd "$FRONTEND_DIR"

    # Compile electron source
    BUILD_CHANNEL="$CHANNEL" pnpm electron:compile

    # Build platform targets (separate runs because Windows needs npmRebuild=false)
    if [ "$DEPLOY_MAC" = true ]; then
        echo "  → macOS..."
        BUILD_CHANNEL="$CHANNEL" ./node_modules/.bin/electron-builder --config electron-builder.config.cjs --mac
    fi
    if [ "$DEPLOY_WIN" = true ]; then
        echo "  → Windows..."
        BUILD_CHANNEL="$CHANNEL" ./node_modules/.bin/electron-builder --config electron-builder.config.cjs --win --x64 --config.npmRebuild=false
    fi
    cd "$ROOT_DIR"
else
    echo "⏭️  Skipping build (--skip-build)"
fi

echo ""
echo "📦 Checking build artifacts..."

# --- Prepare staging directory ---
STAGING="$DIST_DIR/_deploy"
rm -rf "$STAGING"
mkdir -p "$STAGING"

# --- macOS artifacts ---
if [ "$DEPLOY_MAC" = true ]; then
    echo ""
    echo "🍎 macOS artifacts:"

    DMG_ARM64="$DIST_DIR/floodilka-${CHANNEL}-${VERSION}-arm64.dmg"
    DMG_X64="$DIST_DIR/floodilka-${CHANNEL}-${VERSION}-x64.dmg"
    ZIP_ARM64="$DIST_DIR/floodilka-${CHANNEL}-${VERSION}-arm64.zip"
    ZIP_X64="$DIST_DIR/floodilka-${CHANNEL}-${VERSION}-x64.zip"

    for f in "$DMG_ARM64" "$DMG_X64" "$ZIP_ARM64" "$ZIP_X64"; do
        if [ ! -f "$f" ]; then
            echo "  ❌ Missing: $(basename "$f")"
            exit 1
        fi
        echo "  ✅ $(basename "$f") ($(du -h "$f" | cut -f1))"
    done

    mkdir -p "$STAGING/${CHANNEL}/darwin/arm64"
    mkdir -p "$STAGING/${CHANNEL}/darwin/x64"

    # Landing download files (top-level)
    cp "$DMG_ARM64" "$STAGING/latest-arm64-mac.dmg"
    cp "$DMG_X64" "$STAGING/latest-mac.dmg"

    # Auto-update files (per-arch)
    cp "$ZIP_ARM64" "$STAGING/${CHANNEL}/darwin/arm64/"
    cp "$ZIP_X64" "$STAGING/${CHANNEL}/darwin/x64/"

    # Generate RELEASES.json for each architecture
    PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    BASE_URL="https://${DOMAIN}/desktop/updates/${CHANNEL}/darwin"

    cat > "$STAGING/${CHANNEL}/darwin/arm64/RELEASES.json" <<EOF
{"url":"${BASE_URL}/arm64/floodilka-${CHANNEL}-${VERSION}-arm64.zip","name":"${VERSION}","notes":"","pub_date":"${PUB_DATE}"}
EOF

    cat > "$STAGING/${CHANNEL}/darwin/x64/RELEASES.json" <<EOF
{"url":"${BASE_URL}/x64/floodilka-${CHANNEL}-${VERSION}-x64.zip","name":"${VERSION}","notes":"","pub_date":"${PUB_DATE}"}
EOF
fi

# --- Windows artifacts (Squirrel) ---
if [ "$DEPLOY_WIN" = true ]; then
    echo ""
    echo "🪟 Windows artifacts (Squirrel):"

    # Squirrel generates: Setup.exe, .nupkg, RELEASES
    WIN_SETUP="$DIST_DIR/floodilka-${CHANNEL}-${VERSION}-x64.exe"
    WIN_RELEASES="$DIST_DIR/RELEASES"

    # Find nupkg (name varies by electron-builder-squirrel-windows)
    WIN_NUPKG=$(find "$DIST_DIR" -maxdepth 1 -name '*.nupkg' | head -1)

    if [ ! -f "$WIN_SETUP" ]; then
        echo "  ❌ Missing: $(basename "$WIN_SETUP")"
        exit 1
    fi
    echo "  ✅ $(basename "$WIN_SETUP") ($(du -h "$WIN_SETUP" | cut -f1))"

    if [ ! -f "$WIN_RELEASES" ]; then
        echo "  ❌ Missing: RELEASES"
        exit 1
    fi
    echo "  ✅ RELEASES"

    if [ -z "$WIN_NUPKG" ] || [ ! -f "$WIN_NUPKG" ]; then
        echo "  ❌ Missing: .nupkg"
        exit 1
    fi
    echo "  ✅ $(basename "$WIN_NUPKG") ($(du -h "$WIN_NUPKG" | cut -f1))"

    mkdir -p "$STAGING/${CHANNEL}/win32/x64"

    # Landing download file (top-level)
    cp "$WIN_SETUP" "$STAGING/Floodilka.exe"

    # Squirrel auto-update files
    cp "$WIN_SETUP" "$STAGING/${CHANNEL}/win32/x64/"
    cp "$WIN_RELEASES" "$STAGING/${CHANNEL}/win32/x64/"
    cp "$WIN_NUPKG" "$STAGING/${CHANNEL}/win32/x64/"

    # Copy delta nupkg if it exists
    for f in "$DIST_DIR"/*-delta.nupkg; do
        [ -f "$f" ] && cp "$f" "$STAGING/${CHANNEL}/win32/x64/" && echo "  ✅ $(basename "$f") (delta)"
    done

    # Generate RELEASES.json for manual version check (used by updater.ts)
    PUB_DATE=${PUB_DATE:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}

    cat > "$STAGING/${CHANNEL}/win32/x64/RELEASES.json" <<EOF
{"url":"","name":"${VERSION}","notes":"","pub_date":"${PUB_DATE}"}
EOF
fi

echo ""
echo "📋 Staged files:"
find "$STAGING" -type f | sort | while read -r f; do
    echo "  $(echo "$f" | sed "s|$STAGING/||")"
done

# --- Upload ---
echo ""
echo "📂 Creating remote directories..."
REMOTE_DIRS="$REMOTE_BASE"
[ "$DEPLOY_MAC" = true ] && REMOTE_DIRS="$REMOTE_DIRS ${REMOTE_BASE}/${CHANNEL}/darwin/arm64 ${REMOTE_BASE}/${CHANNEL}/darwin/x64"
[ "$DEPLOY_WIN" = true ] && REMOTE_DIRS="$REMOTE_DIRS ${REMOTE_BASE}/${CHANNEL}/win32/x64"
ssh "$SERVER" "mkdir -p $REMOTE_DIRS"

if [ "$DEPLOY_MAC" = true ]; then
    echo ""
    echo "🧹 Cleaning old macOS versions..."
    ssh "$SERVER" "find ${REMOTE_BASE}/${CHANNEL}/darwin/arm64 -name '*.zip' -delete 2>/dev/null; find ${REMOTE_BASE}/${CHANNEL}/darwin/x64 -name '*.zip' -delete 2>/dev/null" || true

    echo "⬆️  Uploading macOS files..."
    scp "$STAGING/latest-arm64-mac.dmg" "$SERVER:${REMOTE_BASE}/"
    scp "$STAGING/latest-mac.dmg" "$SERVER:${REMOTE_BASE}/"
    scp "$STAGING/${CHANNEL}/darwin/arm64/RELEASES.json" "$SERVER:${REMOTE_BASE}/${CHANNEL}/darwin/arm64/"
    scp "$STAGING/${CHANNEL}/darwin/arm64/floodilka-${CHANNEL}-${VERSION}-arm64.zip" "$SERVER:${REMOTE_BASE}/${CHANNEL}/darwin/arm64/"
    scp "$STAGING/${CHANNEL}/darwin/x64/RELEASES.json" "$SERVER:${REMOTE_BASE}/${CHANNEL}/darwin/x64/"
    scp "$STAGING/${CHANNEL}/darwin/x64/floodilka-${CHANNEL}-${VERSION}-x64.zip" "$SERVER:${REMOTE_BASE}/${CHANNEL}/darwin/x64/"
fi

if [ "$DEPLOY_WIN" = true ]; then
    echo ""
    echo "🧹 Cleaning old Windows versions..."
    ssh "$SERVER" "find ${REMOTE_BASE}/${CHANNEL}/win32/x64 -type f -delete 2>/dev/null" || true

    echo "⬆️  Uploading Windows files..."
    scp "$STAGING/Floodilka.exe" "$SERVER:${REMOTE_BASE}/"

    for f in "$STAGING/${CHANNEL}/win32/x64/"*; do
        [ -f "$f" ] && scp "$f" "$SERVER:${REMOTE_BASE}/${CHANNEL}/win32/x64/"
    done
fi

# --- Summary ---
echo ""
echo "🎉 Done!"
echo ""

if [ "$DEPLOY_MAC" = true ]; then
    echo "📥 macOS downloads:"
    echo "  https://${DOMAIN}/desktop/updates/latest-arm64-mac.dmg"
    echo "  https://${DOMAIN}/desktop/updates/latest-mac.dmg"
    echo ""
    echo "🔄 macOS auto-update:"
    echo "  https://${DOMAIN}/desktop/updates/${CHANNEL}/darwin/arm64/RELEASES.json"
    echo "  https://${DOMAIN}/desktop/updates/${CHANNEL}/darwin/x64/RELEASES.json"
fi

if [ "$DEPLOY_WIN" = true ]; then
    [ "$DEPLOY_MAC" = true ] && echo ""
    echo "📥 Windows download:"
    echo "  https://${DOMAIN}/desktop/updates/Floodilka.exe"
    echo ""
    echo "🔄 Windows auto-update (Squirrel):"
    echo "  https://${DOMAIN}/desktop/updates/${CHANNEL}/win32/x64/RELEASES"
fi

# Cleanup
rm -rf "$STAGING"
