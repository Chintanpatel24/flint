#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="Chintanpatel24"
REPO_NAME="flint"
REPO_BRANCH="${FLINT_BRANCH:-main}"
REPO_ARCHIVE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${REPO_BRANCH}.tar.gz"

FLINT_HOME="${FLINT_HOME:-$HOME/.flint}"
FLINT_APP="$FLINT_HOME/app"
FLINT_SOURCE_CACHE="$FLINT_HOME/source"
FLINT_BIN="$FLINT_HOME/bin"

BOLD=''
DIM=''
GREEN=''
YELLOW=''
RED=''
NC=''
if [ -t 1 ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  NC='\033[0m'
fi

say() { printf "%b\n" "$*"; }
step() { say "${BOLD}[$1/8]${NC} $2"; }
ok() { say "      OK  $1"; }
warn() { say "      WARN  $1"; }
fail() { say "${RED}ERROR:${NC} $1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

print_header() {
  say ""
  say "Flint Desktop Installer"
  say "Local-first knowledge base with AI"
  say ""
}

check_node() {
  step 1 "Checking Node.js"
  have node || fail "Node.js 18+ is required. Install it from https://nodejs.org and run this installer again."
  have npm || fail "npm is required and should be installed with Node.js."

  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if [ "$node_major" -lt 18 ]; then
    fail "Node.js 18+ is required. Found $(node -v)."
  fi

  ok "Node.js $(node -v)"
  ok "npm $(npm -v)"
}

check_python() {
  step 2 "Checking Python"
  PYTHON_CMD=""
  if have python3; then
    PYTHON_CMD="python3"
  elif have python; then
    PYTHON_CMD="python"
  fi

  if [ -z "$PYTHON_CMD" ]; then
    warn "Python 3 was not found. The note app will install, but the AI agent will be unavailable."
  else
    ok "$($PYTHON_CMD --version 2>&1)"
  fi
}

resolve_source() {
  step 3 "Preparing source"

  local_dir=""
  if [ -n "${FLINT_SOURCE_DIR:-}" ] && [ -f "$FLINT_SOURCE_DIR/package.json" ]; then
    local_dir="$FLINT_SOURCE_DIR"
  elif [ -f "./package.json" ] && [ -d "./src" ] && [ -d "./electron" ] && grep -q '"name"[[:space:]]*:[[:space:]]*"flint"' ./package.json; then
    local_dir="$(pwd)"
  fi

  rm -rf "$FLINT_SOURCE_CACHE"
  mkdir -p "$FLINT_HOME"

  if [ -n "$local_dir" ]; then
    ok "Using local source at $local_dir"
    mkdir -p "$FLINT_SOURCE_CACHE"
    (
      cd "$local_dir"
      tar --exclude='./node_modules' --exclude='./dist' --exclude='./dist_electron' --exclude='./.git' -cf - .
    ) | (
      cd "$FLINT_SOURCE_CACHE"
      tar -xf -
    )
    return
  fi

  tmp_dir="$(mktemp -d)"
  archive="$tmp_dir/flint.tar.gz"
  if have curl; then
    curl -fsSL "$REPO_ARCHIVE_URL" -o "$archive"
  elif have wget; then
    wget -qO "$archive" "$REPO_ARCHIVE_URL"
  else
    fail "curl or wget is required to download Flint from GitHub."
  fi

  mkdir -p "$FLINT_SOURCE_CACHE"
  tar -xzf "$archive" --strip-components=1 -C "$FLINT_SOURCE_CACHE"
  rm -rf "$tmp_dir"
  ok "Downloaded ${REPO_OWNER}/${REPO_NAME} (${REPO_BRANCH})"
}

prepare_install_dir() {
  step 4 "Preparing installation"
  mkdir -p "$FLINT_APP" "$FLINT_BIN"
  rm -rf "$FLINT_APP" "$FLINT_HOME/.build"
  mkdir -p "$FLINT_APP"
  ok "Install directory ready at $FLINT_HOME"
}

build_frontend() {
  step 5 "Building Flint"
  BUILD_DIR="$FLINT_HOME/.build"
  rm -rf "$BUILD_DIR"
  mkdir -p "$BUILD_DIR"
  (
    cd "$FLINT_SOURCE_CACHE"
    tar --exclude='./node_modules' --exclude='./dist' --exclude='./dist_electron' --exclude='./.git' -cf - .
  ) | (
    cd "$BUILD_DIR"
    tar -xf -
  )

  cd "$BUILD_DIR"
  if [ -f package-lock.json ]; then
    npm ci --loglevel=error || npm install --loglevel=error
  else
    npm install --loglevel=error
  fi
  npm run build

  [ -f "$BUILD_DIR/dist/index.html" ] || fail "Build failed because dist/index.html was not created."
  ok "Frontend build complete"
}

install_agent() {
  step 6 "Installing AI agent files"
  mkdir -p "$FLINT_HOME/agent" "$FLINT_APP/agent"
  if [ -d "$BUILD_DIR/agent" ]; then
    rm -rf "$FLINT_HOME/agent" "$FLINT_APP/agent"
    mkdir -p "$FLINT_HOME/agent" "$FLINT_APP/agent"
    cp -R "$BUILD_DIR/agent/." "$FLINT_HOME/agent/"
    cp -R "$BUILD_DIR/agent/." "$FLINT_APP/agent/"
    ok "Agent files copied"
  else
    warn "No agent directory found in source."
  fi

  if [ -n "${PYTHON_CMD:-}" ] && [ -f "$FLINT_HOME/agent/requirements.txt" ]; then
    "$PYTHON_CMD" -m venv "$FLINT_HOME/venv" || { warn "Could not create Python venv. AI agent will not be available."; return; }
    printf "      Installing base Python packages...\n"
    "$FLINT_HOME/venv/bin/pip" install -q flask flask-cors requests \
      || { warn "Python packages were not installed. The app still opens; install agent requirements manually for AI."; return; }
    printf "      Installing llama-cpp-python (using pre-built binary if available, may take a few minutes)...\n"
    "$FLINT_HOME/venv/bin/pip" install --prefer-binary "llama-cpp-python>=0.2.90" \
      || warn "llama-cpp-python was not installed. Basic note features remain available; local AI inference will not work."
    ok "Python packages installed"
  fi
}

install_desktop_app() {
  step 7 "Installing desktop app"
  cp "$BUILD_DIR/electron/main.cjs" "$FLINT_APP/main.cjs"
  cp -R "$BUILD_DIR/dist" "$FLINT_APP/dist"
  [ -f "$BUILD_DIR/public/flint-logo.png" ] && cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_APP/icon.png"

  cat > "$FLINT_APP/package.json" <<'JSON'
{
  "name": "flint-desktop",
  "version": "2.1.0",
  "private": true,
  "main": "main.cjs",
  "devDependencies": {
    "electron": "^42.4.0"
  }
}
JSON

  cd "$FLINT_APP"
  npm install --omit=optional --loglevel=error
  [ -x "$FLINT_APP/node_modules/.bin/electron" ] || fail "Electron was not installed. Flint must run as a desktop app, so no localhost fallback was created."
  ok "Electron desktop runtime installed"
}

create_launchers() {
  step 8 "Creating launchers"

  cat > "$FLINT_BIN/flint" <<LAUNCHER
#!/usr/bin/env bash
set -e
FLINT_APP="$FLINT_APP"
if [ ! -x "\$FLINT_APP/node_modules/.bin/electron" ]; then
  echo "Flint desktop runtime is missing. Reinstall with: curl -fsSL https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/install.sh | bash" >&2
  exit 1
fi
exec "\$FLINT_APP/node_modules/.bin/electron" "\$FLINT_APP" "\$@"
LAUNCHER
  chmod +x "$FLINT_BIN/flint"

  cat > "$FLINT_BIN/flint-agent" <<AGENT
#!/usr/bin/env bash
set -e
VENV_PYTHON="$FLINT_HOME/venv/bin/python3"
if [ -x "\$VENV_PYTHON" ]; then
  exec "\$VENV_PYTHON" "$FLINT_HOME/agent/agent.py" "\$@"
fi
PYTHON_CMD=""
command -v python3 >/dev/null 2>&1 && PYTHON_CMD="python3"
[ -z "\$PYTHON_CMD" ] && command -v python >/dev/null 2>&1 && PYTHON_CMD="python"
[ -n "\$PYTHON_CMD" ] || { echo "Python 3 is required for the Flint AI agent." >&2; exit 1; }
exec "\$PYTHON_CMD" "$FLINT_HOME/agent/agent.py" "\$@"
AGENT
  chmod +x "$FLINT_BIN/flint-agent"

  if [ -d "$HOME/.local/share/applications" ] || mkdir -p "$HOME/.local/share/applications"; then
    icon_path="$FLINT_APP/icon.png"
    cat > "$HOME/.local/share/applications/flint.desktop" <<DESKTOP
[Desktop Entry]
Name=Flint
Comment=Local-first knowledge base with AI
Exec=$FLINT_BIN/flint %U
Icon=$icon_path
Type=Application
Categories=Office;Utility;TextEditor;
Keywords=notes;markdown;knowledge;ai;
StartupNotify=true
Terminal=false
StartupWMClass=Flint
DESKTOP
    chmod +x "$HOME/.local/share/applications/flint.desktop"
    update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
    ok "Application menu entry created"
  fi

  case ":$PATH:" in
    *":$FLINT_BIN:"*) ok "Command available as flint" ;;
    *)
      profile_file="$HOME/.profile"
      printf '\n# Flint\nexport PATH="$HOME/.flint/bin:$PATH"\n' >> "$profile_file"
      warn "Added $FLINT_BIN to PATH in $profile_file. Open a new terminal or run: export PATH=\"$FLINT_BIN:\$PATH\""
      ;;
  esac
}

cleanup() {
  rm -rf "${BUILD_DIR:-}" 2>/dev/null || true
}

main() {
  print_header
  check_node
  check_python
  resolve_source
  prepare_install_dir
  build_frontend
  install_agent
  install_desktop_app
  create_launchers
  cleanup

  say ""
  say "${GREEN}Flint installed successfully.${NC}"
  say "Open it from your app launcher or run:"
  say "  $FLINT_BIN/flint"
  say ""
  say "For full local AI, install Ollama and run: ollama pull llama3.2"
}

main "$@"
