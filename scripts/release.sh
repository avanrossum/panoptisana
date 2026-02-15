#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════════════════════
# Panoptisana Release Script
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.5.0
# If no version provided, uses current version in package.json
# ══════════════════════════════════════════════════════════════════════════════

cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_step() {
  echo -e "${GREEN}▶${NC} $1"
}

echo_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

echo_error() {
  echo -e "${RED}✖${NC} $1"
}

# Check required environment variables for notarization
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo_error "Missing required environment variables:"
  echo "  APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID"
  echo "Add these to your ~/.zshrc or ~/.zprofile"
  exit 1
fi

# Check gh is authenticated
if ! gh auth status &>/dev/null; then
  echo_error "GitHub CLI not authenticated. Run: gh auth login"
  exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Use provided version or current version
if [ -n "$1" ]; then
  VERSION="$1"
  echo_step "Bumping version: $CURRENT_VERSION → $VERSION"
  npm version "$VERSION" --no-git-tag-version
else
  VERSION="$CURRENT_VERSION"
  echo_step "Using current version: $VERSION"
fi

TAG="v${VERSION}"

# Pre-release checklist
echo ""
echo -e "${YELLOW}Pre-release checklist:${NC}"
echo "  □ CHANGELOG.md updated with v$VERSION changes"
echo "  □ ROADMAP.md version history updated"
echo "  □ All changes committed"
echo ""
echo "This will:"
echo "  1. Build Panoptisana v$VERSION (signed & notarized)"
echo "  2. Create git tag $TAG"
echo "  3. Push release to avanrossum/asana-list"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo_warn "Aborted"
  exit 1
fi

# Lint and test
echo_step "Running lint..."
npm run lint || { echo_error "Lint failed. Fix errors before releasing."; exit 1; }

echo_step "Running tests..."
npm test || { echo_error "Tests failed. Fix failures before releasing."; exit 1; }

# Clean previous build artifacts
echo_step "Cleaning previous build..."
rm -rf dist/*.dmg dist/*.zip dist/*.yml dist/*.yaml dist/mac dist/mac-arm64 2>/dev/null || true

# Build
echo_step "Building app (this may take a few minutes for notarization)..."
npm run build

# Find the built artifacts
DMG_FILE=$(ls -1 dist/*.dmg 2>/dev/null | head -1)
ZIP_FILE=$(ls -1 dist/*.zip 2>/dev/null | head -1)
YML_FILE=$(ls -1 dist/latest-mac.yml 2>/dev/null | head -1)

if [ -z "$DMG_FILE" ]; then
  echo_error "No DMG found in dist/"
  exit 1
fi

echo_step "Built: $DMG_FILE"

# Git tag
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo_warn "Tag $TAG already exists, skipping tag creation"
else
  echo_step "Creating git tag $TAG..."
  git add package.json package-lock.json
  git commit -m "Release $TAG" || echo_warn "Nothing to commit"
  git tag "$TAG"
  git push origin "$TAG" || echo_warn "Could not push tag (maybe no remote?)"
fi

# Create release notes from CHANGELOG.md
echo_step "Publishing to avanrossum/asana-list..."

NOTES_FILE=$(mktemp)
trap "rm -f $NOTES_FILE" EXIT

CHANGELOG_NOTES=""
if [ -f "CHANGELOG.md" ]; then
  # Extract the current version's section from CHANGELOG.md
  CHANGELOG_NOTES=$(awk -v ver="$VERSION" '
    BEGIN { printing=0 }
    $0 ~ "^## \\[" ver "\\]" { printing=1; next }
    /^## \[/ { if (printing) exit }
    printing { print }
  ' CHANGELOG.md)
fi

if [ -n "$CHANGELOG_NOTES" ]; then
  cat > "$NOTES_FILE" << EOF
# What's New in $TAG

$CHANGELOG_NOTES
EOF
else
  cat > "$NOTES_FILE" << EOF
## Panoptisana $TAG

Maintenance release.
EOF
fi

# Build file list
FILES_TO_UPLOAD="$DMG_FILE"
if [ -n "$ZIP_FILE" ]; then
  FILES_TO_UPLOAD="$FILES_TO_UPLOAD $ZIP_FILE"
fi
if [ -n "$YML_FILE" ]; then
  FILES_TO_UPLOAD="$FILES_TO_UPLOAD $YML_FILE"
fi

# Create release
gh release create "$TAG" \
  --repo avanrossum/asana-list \
  --title "Panoptisana $TAG" \
  --notes-file "$NOTES_FILE" \
  $FILES_TO_UPLOAD

echo ""
echo -e "${GREEN}✔ Released Panoptisana $TAG${NC}"
echo "  https://github.com/avanrossum/asana-list/releases/tag/$TAG"
