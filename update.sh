#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="Chintanpatel24"
REPO_NAME="flint"
REPO_BRANCH="${FLINT_BRANCH:-main}"
INSTALLER_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/install.sh"
FLINT_HOME="${FLINT_HOME:-$HOME/.flint}"

BOLD=''
GREEN=''
NC=''
if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  NC='\033[0m'
fi

echo ""
echo -e "${BOLD}███████╗██╗     ██╗███╗   ██╗████████╗ "
echo -e "██╔════╝██║     ██║████╗  ██║╚══██╔══╝ "
echo -e "█████╗  ██║     ██║██╔██╗ ██║   ██║    "
echo -e "██╔══╝  ██║     ██║██║╚██╗██║   ██║    "
echo -e "██║     ███████╗██║██║ ╚████║   ██║    "
echo -e "╚═╝     ╚══════╝╚═╝╚═╝  ╚═══╝   ╚═╝    ${NC}"
echo ""

if [ ! -d "$FLINT_HOME/app" ]; then
  echo "Flint is not installed at $FLINT_HOME."
  echo "Install with:"
  echo "  curl -fsSL $INSTALLER_URL | bash"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If we are in a local repo, use the local install.sh
if [ -f "$SCRIPT_DIR/install.sh" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
  echo "[1/2] Updating from local source..."
  FLINT_SOURCE_DIR="$SCRIPT_DIR" bash "$SCRIPT_DIR/install.sh"
else
  echo "[1/2] Downloading latest installer..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$INSTALLER_URL" | bash
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$INSTALLER_URL" | bash
  else
    echo "ERROR: curl or wget is required to update Flint." >&2
    exit 1
  fi
fi

echo "[2/2] Update complete"
echo ""
echo -e "${GREEN}Flint has been updated successfully.${NC}"
echo "Run it from your app launcher or with:"
echo "  $FLINT_HOME/bin/flint"
