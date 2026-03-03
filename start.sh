#!/bin/bash
# Daiyly dev server — runs from /tmp to avoid monorepo Metro scan
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="/tmp/daiyly-dev"

echo "Syncing source files..."
mkdir -p "$DEST"
rsync -a --delete --exclude='.expo' --exclude='node_modules' "$SRC/" "$DEST/"

# Symlink node_modules so expo can find it
if [ ! -L "$DEST/node_modules" ]; then
  ln -s "$SRC/node_modules" "$DEST/node_modules"
fi

echo "Starting Expo from $DEST"
cd "$DEST" && npx expo start "$@"
