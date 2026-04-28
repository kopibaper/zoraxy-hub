#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Zoraxy Agent — Remote Installer
# One-liner: curl -fsSL https://raw.githubusercontent.com/kopibaper/zoraxy-hub/master/agent-go/remote-install.sh | bash
#
# Environment variables (all optional — prompted interactively if missing):
#   ZORAXY_API_KEY        – API key for ZoraxyHub (zhub_ak_...)
#   ZORAXY_LISTEN_ADDR    – Listen address (default: 0.0.0.0)
#   ZORAXY_LISTEN_PORT    – Listen port    (default: 9191)
#   ZORAXY_HOST           – Zoraxy web UI host (default: localhost)
#   ZORAXY_PORT           – Zoraxy web UI port (default: 8000)
#   ZORAXY_USERNAME       – Zoraxy admin username (default: admin)
#   ZORAXY_PASSWORD       – Zoraxy admin password
#   ZORAXY_DATA_DIR       – Zoraxy data directory (default: /opt/zoraxy)
#   ZORAXY_DOCKER_ENABLED – Enable Docker management (true/false, default: true)
#   ZORAXY_DOCKER_NAME    – Docker container name (default: zoraxy)
#   ZORAXY_AGENT_VERSION  – Specific version tag (default: latest)
#   ZORAXY_NONINTERACTIVE – Set to 1 to skip all prompts
#
# Flags:
#   --uninstall   Remove the agent completely
#   --upgrade     Upgrade binary only, keep config
#   --version X   Install specific version
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────
readonly INSTALL_DIR="/opt/zoraxy-agent"
readonly SERVICE_NAME="zoraxy-agent"
readonly GITHUB_REPO="kopibaper/zoraxy-hub"
readonly BINARY_NAME="zoraxy-agent"
readonly CONFIG_FILE="agent.json"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# ── Colors ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' DIM='' RESET=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { printf "${BLUE}[INFO]${RESET}  %s\n" "$*"; }
success() { printf "${GREEN}[OK]${RESET}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${RESET}  %s\n" "$*"; }
error()   { printf "${RED}[ERROR]${RESET} %s\n" "$*" >&2; }
fatal()   { error "$@"; exit 1; }
step()    { printf "\n${BOLD}${CYAN}── %s${RESET}\n" "$*"; }

banner() {
  printf "\n"
  printf "${BOLD}${CYAN}"
  printf "  ╔══════════════════════════════════════════╗\n"
  printf "  ║       Zoraxy Agent Installer v2.0        ║\n"
  printf "  ║   Remote VPS management for ZoraxyHub    ║\n"
  printf "  ╚══════════════════════════════════════════╝\n"
  printf "${RESET}\n"
}

# ── Privilege escalation ─────────────────────────────────────────────────────
ensure_root() {
  if [[ $EUID -ne 0 ]]; then
    fatal "This installer requires root privileges. Run with:\n  curl -fsSL <url> | sudo bash"
  fi
}

# ── Architecture detection ───────────────────────────────────────────────────
detect_arch() {
  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64)   echo "amd64" ;;
    aarch64|arm64)   echo "arm64" ;;
    *)               fatal "Unsupported architecture: $arch (only amd64 and arm64 are supported)" ;;
  esac
}

# ── OS detection ─────────────────────────────────────────────────────────────
detect_os() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux)  echo "linux" ;;
    *)      fatal "Unsupported OS: $os (only Linux is supported)" ;;
  esac
}

# ── Download helper with retry ───────────────────────────────────────────────
download() {
  local url="$1" dest="$2" retries=3 attempt=0

  while (( attempt < retries )); do
    attempt=$((attempt + 1))
    if command -v curl &>/dev/null; then
      if curl -fsSL --connect-timeout 15 --max-time 120 -o "$dest" "$url" 2>/dev/null; then
        return 0
      fi
    elif command -v wget &>/dev/null; then
      if wget -q --timeout=15 -O "$dest" "$url" 2>/dev/null; then
        return 0
      fi
    else
      fatal "Neither curl nor wget found. Install one and retry."
    fi

    if (( attempt < retries )); then
      warn "Download attempt $attempt/$retries failed, retrying in 3s..."
      sleep 3
    fi
  done

  fatal "Failed to download: $url (after $retries attempts)"
}

# ── Fetch latest release tag from GitHub ─────────────────────────────────────
get_latest_version() {
  local tmp
  tmp=$(mktemp)
  if command -v curl &>/dev/null; then
    curl -fsSL --connect-timeout 10 "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" -o "$tmp" 2>/dev/null || true
  elif command -v wget &>/dev/null; then
    wget -q --timeout=10 -O "$tmp" "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null || true
  fi

  local tag
  # Parse tag_name from JSON without jq dependency
  tag=$(grep -oP '"tag_name"\s*:\s*"\K[^"]+' "$tmp" 2>/dev/null || true)
  rm -f "$tmp"

  if [[ -z "$tag" ]]; then
    # Fallback: try releases list for agent-specific tags
    tmp=$(mktemp)
    if command -v curl &>/dev/null; then
      curl -fsSL --connect-timeout 10 "https://api.github.com/repos/${GITHUB_REPO}/releases" -o "$tmp" 2>/dev/null || true
    elif command -v wget &>/dev/null; then
      wget -q --timeout=10 -O "$tmp" "https://api.github.com/repos/${GITHUB_REPO}/releases" 2>/dev/null || true
    fi
    tag=$(grep -oP '"tag_name"\s*:\s*"\K[^"]+' "$tmp" 2>/dev/null | head -1 || true)
    rm -f "$tmp"
  fi

  if [[ -z "$tag" ]]; then
    fatal "Could not determine latest release version. Specify one with --version or ZORAXY_AGENT_VERSION"
  fi

  echo "$tag"
}

# ── Generate API key ─────────────────────────────────────────────────────────
generate_api_key() {
  local hex
  if command -v openssl &>/dev/null; then
    hex=$(openssl rand -hex 32)
  elif [[ -r /dev/urandom ]]; then
    hex=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  else
    fatal "Cannot generate API key: no openssl or /dev/urandom available"
  fi
  echo "zhub_ak_${hex}"
}

# ── Prompt helper (respects ZORAXY_NONINTERACTIVE) ───────────────────────────
prompt_value() {
  local var_name="$1" prompt_text="$2" default_value="${3:-}" is_secret="${4:-false}"
  local current_value="${!var_name:-}"

  # If already set via env, use it
  if [[ -n "$current_value" ]]; then
    if [[ "$is_secret" == "true" ]]; then
      printf "  ${DIM}%-24s${RESET} %s\n" "$prompt_text:" "********"
    else
      printf "  ${DIM}%-24s${RESET} %s\n" "$prompt_text:" "$current_value"
    fi
    return
  fi

  # Non-interactive mode: use default
  if [[ "${ZORAXY_NONINTERACTIVE:-0}" == "1" ]]; then
    if [[ -n "$default_value" ]]; then
      eval "$var_name='$default_value'"
      printf "  ${DIM}%-24s${RESET} %s ${DIM}(default)${RESET}\n" "$prompt_text:" "$default_value"
      return
    else
      fatal "Required value '$var_name' not set and running in non-interactive mode"
    fi
  fi

  # Interactive prompt
  local input
  if [[ "$is_secret" == "true" ]]; then
    if [[ -n "$default_value" ]]; then
      printf "  ${BOLD}%s${RESET} [${DIM}%s${RESET}]: " "$prompt_text" "********"
    else
      printf "  ${BOLD}%s${RESET}: " "$prompt_text"
    fi
    read -rs input </dev/tty
    printf "\n"
  else
    if [[ -n "$default_value" ]]; then
      printf "  ${BOLD}%s${RESET} [${DIM}%s${RESET}]: " "$prompt_text" "$default_value"
    else
      printf "  ${BOLD}%s${RESET}: " "$prompt_text"
    fi
    read -r input </dev/tty
  fi

  eval "$var_name='${input:-$default_value}'"
}

# ── Prompt yes/no ────────────────────────────────────────────────────────────
prompt_yn() {
  local prompt_text="$1" default="${2:-y}"
  if [[ "${ZORAXY_NONINTERACTIVE:-0}" == "1" ]]; then
    [[ "$default" == "y" ]] && return 0 || return 1
  fi

  local yn_hint
  [[ "$default" == "y" ]] && yn_hint="Y/n" || yn_hint="y/N"
  printf "  ${BOLD}%s${RESET} [%s]: " "$prompt_text" "$yn_hint"
  local answer
  read -r answer </dev/tty
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[Yy] ]]
}

# ── Write config file ───────────────────────────────────────────────────────
write_config() {
  local api_key="$1" listen_addr="$2" listen_port="$3"
  local zoraxy_host="$4" zoraxy_port="$5" zoraxy_user="$6" zoraxy_pass="$7"
  local data_dir="$8" docker_enabled="$9" docker_name="${10}"

  cat > "${INSTALL_DIR}/${CONFIG_FILE}" <<JSONEOF
{
  "apiKey": "${api_key}",
  "listenAddr": "${listen_addr}",
  "listenPort": ${listen_port},
  "tls": {
    "cert": "",
    "key": ""
  },
  "zoraxy": {
    "host": "${zoraxy_host}",
    "port": ${zoraxy_port},
    "username": "${zoraxy_user}",
    "password": "${zoraxy_pass}"
  },
  "zoraxyDataDir": "${data_dir}",
  "docker": {
    "enabled": ${docker_enabled},
    "containerName": "${docker_name}"
  }
}
JSONEOF

  chmod 600 "${INSTALL_DIR}/${CONFIG_FILE}"
}

# ── Write systemd service ───────────────────────────────────────────────────
write_service() {
  cat > "$SERVICE_FILE" <<'SVCEOF'
[Unit]
Description=Zoraxy Agent - Remote VPS management for ZoraxyHub
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zoraxy-agent
ExecStart=/opt/zoraxy-agent/zoraxy-agent
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=zoraxy-agent

[Install]
WantedBy=multi-user.target
SVCEOF
}

# ══════════════════════════════════════════════════════════════════════════════
# UNINSTALL
# ══════════════════════════════════════════════════════════════════════════════
do_uninstall() {
  banner
  step "Uninstalling Zoraxy Agent"

  ensure_root

  info "Stopping service..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true

  info "Removing service file..."
  rm -f "$SERVICE_FILE"
  systemctl daemon-reload 2>/dev/null || true

  info "Removing installation directory..."
  rm -rf "$INSTALL_DIR"

  success "Zoraxy Agent has been completely removed."
  printf "\n"
  exit 0
}

# ══════════════════════════════════════════════════════════════════════════════
# UPGRADE
# ══════════════════════════════════════════════════════════════════════════════
do_upgrade() {
  banner
  step "Upgrading Zoraxy Agent"

  ensure_root

  local os arch version binary_url tmp_binary
  os=$(detect_os)
  arch=$(detect_arch)

  if [[ -n "${ZORAXY_AGENT_VERSION:-}" ]]; then
    version="$ZORAXY_AGENT_VERSION"
  else
    info "Fetching latest version..."
    version=$(get_latest_version)
  fi

  info "Target version: $version"
  info "Architecture:   ${os}/${arch}"

  binary_url="https://github.com/${GITHUB_REPO}/releases/download/${version}/${BINARY_NAME}-${os}-${arch}"
  tmp_binary=$(mktemp)

  step "Downloading binary"
  info "URL: $binary_url"
  download "$binary_url" "$tmp_binary"

  # Verify it's actually an ELF binary
  if ! file "$tmp_binary" 2>/dev/null | grep -qi "elf"; then
    # Might not have 'file' command, check first bytes
    local magic
    magic=$(head -c 4 "$tmp_binary" | od -An -tx1 | tr -d ' ')
    if [[ "$magic" != "7f454c46" ]]; then
      rm -f "$tmp_binary"
      fatal "Downloaded file is not a valid Linux binary. Check the release URL."
    fi
  fi

  step "Installing binary"
  info "Stopping service..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true

  mkdir -p "$INSTALL_DIR"
  mv "$tmp_binary" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  info "Starting service..."
  systemctl start "$SERVICE_NAME" 2>/dev/null || warn "Service not started (may need config first)"

  success "Upgraded to $version"
  printf "\n"
  printf "  ${DIM}Status:${RESET}  systemctl status %s\n" "$SERVICE_NAME"
  printf "  ${DIM}Logs:${RESET}    journalctl -u %s -f\n" "$SERVICE_NAME"
  printf "\n"
  exit 0
}

# ══════════════════════════════════════════════════════════════════════════════
# INSTALL
# ══════════════════════════════════════════════════════════════════════════════
do_install() {
  banner
  ensure_root

  local os arch version
  os=$(detect_os)
  arch=$(detect_arch)

  info "Detected: ${os}/${arch}"

  # ── Check for existing installation ──────────────────────────────────────
  if [[ -f "${INSTALL_DIR}/${BINARY_NAME}" ]]; then
    warn "Zoraxy Agent is already installed at ${INSTALL_DIR}"
    if prompt_yn "Upgrade to latest version (keeps config)?" "y"; then
      do_upgrade "$@"
    fi
    printf "\n"
    info "Installation cancelled."
    exit 0
  fi

  # ── Resolve version ─────────────────────────────────────────────────────
  if [[ -n "${ZORAXY_AGENT_VERSION:-}" ]]; then
    version="$ZORAXY_AGENT_VERSION"
  elif [[ -n "${ARG_VERSION:-}" ]]; then
    version="$ARG_VERSION"
  else
    info "Fetching latest release version..."
    version=$(get_latest_version)
  fi

  info "Version: ${BOLD}${version}${RESET}"

  # ── Download binary ────────────────────────────────────────────────────
  local binary_url tmp_binary
  binary_url="https://github.com/${GITHUB_REPO}/releases/download/${version}/${BINARY_NAME}-${os}-${arch}"
  tmp_binary=$(mktemp)

  step "[1/5] Downloading binary"
  info "URL: $binary_url"
  download "$binary_url" "$tmp_binary"

  # Verify it's an ELF binary
  local magic
  magic=$(head -c 4 "$tmp_binary" | od -An -tx1 | tr -d ' ')
  if [[ "$magic" != "7f454c46" ]]; then
    rm -f "$tmp_binary"
    fatal "Downloaded file is not a valid Linux binary. The release may not contain pre-built binaries yet."
  fi
  success "Binary downloaded and verified"

  # ── Install binary ─────────────────────────────────────────────────────
  step "[2/5] Installing binary"
  mkdir -p "$INSTALL_DIR"
  mv "$tmp_binary" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
  success "Installed to ${INSTALL_DIR}/${BINARY_NAME}"

  # ── Configure ──────────────────────────────────────────────────────────
  step "[3/5] Configuration"

  if [[ -f "${INSTALL_DIR}/${CONFIG_FILE}" ]]; then
    info "Existing config found, keeping it"
  else
    printf "\n"
    info "Let's configure the agent. Press Enter to accept defaults.\n"

    # API Key
    if [[ -z "${ZORAXY_API_KEY:-}" ]]; then
      local generated_key
      generated_key=$(generate_api_key)
      if prompt_yn "Generate a random API key?" "y"; then
        ZORAXY_API_KEY="$generated_key"
        printf "\n"
        printf "  ${GREEN}Generated API key:${RESET}\n"
        printf "  ${BOLD}%s${RESET}\n" "$ZORAXY_API_KEY"
        printf "  ${DIM}Save this key — you'll need it in ZoraxyHub.${RESET}\n"
        printf "\n"
      else
        prompt_value ZORAXY_API_KEY "API Key (zhub_ak_...)" "" false
      fi
    else
      printf "  ${DIM}%-24s${RESET} %s\n" "API Key:" "${ZORAXY_API_KEY:0:20}..."
    fi

    # Agent listen settings
    prompt_value ZORAXY_LISTEN_ADDR "Listen address" "0.0.0.0" false
    prompt_value ZORAXY_LISTEN_PORT "Listen port" "9191" false

    printf "\n"
    info "Zoraxy connection settings:\n"

    # Zoraxy connection
    prompt_value ZORAXY_HOST     "Zoraxy host" "localhost" false
    prompt_value ZORAXY_PORT     "Zoraxy port" "8000" false
    prompt_value ZORAXY_USERNAME "Zoraxy username" "admin" false
    prompt_value ZORAXY_PASSWORD "Zoraxy password" "password" true

    # Data directory
    prompt_value ZORAXY_DATA_DIR "Zoraxy data directory" "/opt/zoraxy" false

    printf "\n"
    info "Docker settings:\n"

    # Docker
    if [[ -z "${ZORAXY_DOCKER_ENABLED:-}" ]]; then
      if command -v docker &>/dev/null; then
        if prompt_yn "Enable Docker management?" "y"; then
          ZORAXY_DOCKER_ENABLED="true"
        else
          ZORAXY_DOCKER_ENABLED="false"
        fi
      else
        info "Docker not detected, disabling Docker management"
        ZORAXY_DOCKER_ENABLED="false"
      fi
    fi

    if [[ "$ZORAXY_DOCKER_ENABLED" == "true" ]]; then
      prompt_value ZORAXY_DOCKER_NAME "Docker container name" "zoraxy" false
    else
      ZORAXY_DOCKER_NAME="${ZORAXY_DOCKER_NAME:-zoraxy}"
    fi

    printf "\n"

    # Write config
    write_config \
      "${ZORAXY_API_KEY}" \
      "${ZORAXY_LISTEN_ADDR}" \
      "${ZORAXY_LISTEN_PORT}" \
      "${ZORAXY_HOST}" \
      "${ZORAXY_PORT}" \
      "${ZORAXY_USERNAME}" \
      "${ZORAXY_PASSWORD}" \
      "${ZORAXY_DATA_DIR}" \
      "${ZORAXY_DOCKER_ENABLED}" \
      "${ZORAXY_DOCKER_NAME}"

    success "Config written to ${INSTALL_DIR}/${CONFIG_FILE}"
  fi

  # ── Install systemd service ────────────────────────────────────────────
  step "[4/5] Installing systemd service"
  write_service
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" 2>/dev/null
  success "Service installed and enabled"

  # ── Start service ──────────────────────────────────────────────────────
  step "[5/5] Starting service"
  if systemctl start "$SERVICE_NAME" 2>/dev/null; then
    sleep 1
    if systemctl is-active --quiet "$SERVICE_NAME"; then
      success "Service is running"
    else
      warn "Service started but may have exited. Check logs:"
      printf "  journalctl -u %s --no-pager -n 20\n" "$SERVICE_NAME"
    fi
  else
    warn "Failed to start service. Check config and logs:"
    printf "  journalctl -u %s --no-pager -n 20\n" "$SERVICE_NAME"
  fi

  # ── Summary ────────────────────────────────────────────────────────────
  printf "\n"
  printf "${BOLD}${GREEN}"
  printf "  ╔══════════════════════════════════════════╗\n"
  printf "  ║        Installation Complete!             ║\n"
  printf "  ╚══════════════════════════════════════════╝\n"
  printf "${RESET}\n"

  printf "  ${BOLD}Binary:${RESET}   %s/%s\n" "$INSTALL_DIR" "$BINARY_NAME"
  printf "  ${BOLD}Config:${RESET}   %s/%s\n" "$INSTALL_DIR" "$CONFIG_FILE"
  printf "  ${BOLD}Service:${RESET}  %s\n" "$SERVICE_NAME"
  printf "  ${BOLD}Port:${RESET}     %s\n" "${ZORAXY_LISTEN_PORT:-9191}"
  printf "\n"
  printf "  ${DIM}Commands:${RESET}\n"
  printf "    systemctl status %s     ${DIM}# Check status${RESET}\n" "$SERVICE_NAME"
  printf "    journalctl -u %s -f    ${DIM}# Follow logs${RESET}\n" "$SERVICE_NAME"
  printf "    systemctl restart %s    ${DIM}# Restart${RESET}\n" "$SERVICE_NAME"
  printf "    nano %s/%s       ${DIM}# Edit config${RESET}\n" "$INSTALL_DIR" "$CONFIG_FILE"
  printf "\n"

  if [[ "${ZORAXY_API_KEY:-}" == *"0123456789abcdef"* ]]; then
    printf "  ${YELLOW}${BOLD}⚠  WARNING: You are using the example API key!${RESET}\n"
    printf "  ${YELLOW}   Edit %s/%s and set your own apiKey,${RESET}\n" "$INSTALL_DIR" "$CONFIG_FILE"
    printf "  ${YELLOW}   then run: systemctl restart %s${RESET}\n" "$SERVICE_NAME"
    printf "\n"
  fi

  printf "  ${DIM}To uninstall:${RESET}\n"
  printf "    curl -fsSL https://raw.githubusercontent.com/%s/main/agent-go/remote-install.sh | bash -s -- --uninstall\n" "$GITHUB_REPO"
  printf "\n"
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN — Parse arguments and dispatch
# ══════════════════════════════════════════════════════════════════════════════
main() {
  local action="install"
  ARG_VERSION=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --uninstall|uninstall)
        action="uninstall"
        shift
        ;;
      --upgrade|upgrade)
        action="upgrade"
        shift
        ;;
      --version)
        ARG_VERSION="${2:-}"
        [[ -z "$ARG_VERSION" ]] && fatal "--version requires a value"
        ZORAXY_AGENT_VERSION="$ARG_VERSION"
        shift 2
        ;;
      --noninteractive|--non-interactive|-y)
        ZORAXY_NONINTERACTIVE=1
        shift
        ;;
      --help|-h)
        banner
        printf "Usage:\n"
        printf "  curl -fsSL <url> | bash                    Install (interactive)\n"
        printf "  curl -fsSL <url> | bash -s -- --uninstall  Uninstall\n"
        printf "  curl -fsSL <url> | bash -s -- --upgrade    Upgrade binary only\n"
        printf "  curl -fsSL <url> | bash -s -- --version X  Install specific version\n"
        printf "  curl -fsSL <url> | bash -s -- -y           Non-interactive (uses env vars)\n"
        printf "\n"
        printf "Environment variables:\n"
        printf "  ZORAXY_API_KEY         API key for ZoraxyHub\n"
        printf "  ZORAXY_LISTEN_ADDR     Listen address (default: 0.0.0.0)\n"
        printf "  ZORAXY_LISTEN_PORT     Listen port (default: 9191)\n"
        printf "  ZORAXY_HOST            Zoraxy web UI host (default: localhost)\n"
        printf "  ZORAXY_PORT            Zoraxy web UI port (default: 8000)\n"
        printf "  ZORAXY_USERNAME        Zoraxy admin username (default: admin)\n"
        printf "  ZORAXY_PASSWORD        Zoraxy admin password\n"
        printf "  ZORAXY_DATA_DIR        Zoraxy data directory (default: /opt/zoraxy)\n"
        printf "  ZORAXY_DOCKER_ENABLED  Enable Docker management (true/false)\n"
        printf "  ZORAXY_DOCKER_NAME     Docker container name (default: zoraxy)\n"
        printf "  ZORAXY_AGENT_VERSION   Specific version tag\n"
        printf "  ZORAXY_NONINTERACTIVE  Set to 1 to skip all prompts\n"
        printf "\n"
        printf "Non-interactive example:\n"
        printf "  ZORAXY_API_KEY=zhub_ak_abc123 ZORAXY_PASSWORD=mypass \\\\\n"
        printf "    curl -fsSL <url> | bash -s -- -y\n"
        printf "\n"
        exit 0
        ;;
      *)
        fatal "Unknown argument: $1 (use --help for usage)"
        ;;
    esac
  done

  case "$action" in
    install)   do_install "$@" ;;
    uninstall) do_uninstall "$@" ;;
    upgrade)   do_upgrade "$@" ;;
  esac
}

main "$@"
