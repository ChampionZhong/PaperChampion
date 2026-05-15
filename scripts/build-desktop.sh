#!/usr/bin/env bash
# PaperChampion Desktop build script for macOS.
# 1. Package the Python backend with PyInstaller.
# 2. Install Tauri frontend dependencies.
# 3. Build the Tauri .dmg bundle.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCH="${1:-$(uname -m)}"

echo "========================================"
echo " PaperChampion Desktop Build"
echo " Platform: macOS ($ARCH)"
echo " Root: $ROOT"
echo "========================================"

# --- Step 1: Package backend with PyInstaller. ---
echo ""
echo ">>> [1/4] Building Python backend with PyInstaller..."

cd "$ROOT"

if ! command -v pyinstaller &>/dev/null; then
    echo "  Installing PyInstaller..."
    pip install pyinstaller
fi

pyinstaller --clean --noconfirm paperchampion-server.spec

echo "  Backend binary: dist/paperchampion-server"
ls -lh dist/paperchampion-server

# --- Step 2: Place the sidecar binary. ---
echo ""
echo ">>> [2/4] Placing sidecar binary..."

TAURI_BIN="$ROOT/src-tauri/binaries"
mkdir -p "$TAURI_BIN"

# Tauri sidecars require a platform suffix.
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    SUFFIX="aarch64-apple-darwin"
else
    SUFFIX="x86_64-apple-darwin"
fi

cp dist/paperchampion-server "$TAURI_BIN/paperchampion-server-$SUFFIX"
chmod +x "$TAURI_BIN/paperchampion-server-$SUFFIX"
echo "  Sidecar: $TAURI_BIN/paperchampion-server-$SUFFIX"

# --- Step 3: Build frontend. ---
echo ""
echo ">>> [3/4] Building frontend..."

cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
    echo "  Installing frontend dependencies..."
    npm install
fi

# Install Tauri JS dependencies.
npm install --save @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-shell 2>/dev/null || true

npm run build
echo "  Frontend dist: $ROOT/frontend/dist"

# --- Step 4: Tauri build ---
echo ""
echo ">>> [4/4] Building Tauri app..."

cd "$ROOT"

if ! command -v cargo &>/dev/null; then
    echo "ERROR: Rust/Cargo is not installed. Install from https://rustup.rs/"
    exit 1
fi

cd "$ROOT/src-tauri"
cargo tauri build

echo ""
echo "========================================"
echo " BUILD COMPLETE"
echo " Output: src-tauri/target/release/bundle/"
echo "========================================"
ls -la target/release/bundle/dmg/ 2>/dev/null || echo "  (Check target/release/bundle/ for output)"
