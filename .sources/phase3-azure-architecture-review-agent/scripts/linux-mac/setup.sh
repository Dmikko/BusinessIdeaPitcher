#!/usr/bin/env bash
# Architecture Review Agent - One-click setup script for Linux / macOS.
# Creates a .venv virtual environment, installs dependencies,
# and copies .env.template to .env if it doesn't exist.
#
# Usage:
#   chmod +x scripts/linux-mac/setup.sh
#   bash scripts/linux-mac/setup.sh

set -euo pipefail

# Go up 2 levels: scripts/linux-mac -> scripts -> project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=== Architecture Review Agent Setup ==="
echo ""

# ── 1. Check Python ──────────────────────────────────────────────────────────
PYTHON=""
for candidate in python3 python; do
    if command -v "$candidate" &>/dev/null; then
        ver=$("$candidate" --version 2>&1)
        major=$("$candidate" -c "import sys; print(sys.version_info.major)")
        minor=$("$candidate" -c "import sys; print(sys.version_info.minor)")
        if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
            PYTHON="$candidate"
            echo "[OK] Found $ver"
            break
        else
            echo "[WARN] $ver found but Python 3.11+ is required."
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "[ERROR] Python 3.11+ is required but was not found on PATH."
    echo "        Install from https://www.python.org/downloads/"
    exit 1
fi

# ── 2. Check VS Code and install Microsoft Foundry extension ────────────────
echo ""
if command -v code &>/dev/null; then
    echo "[OK] VS Code found"
    echo "[..] Installing Microsoft Foundry extension..."
    
    extensionId="TeamsDevApp.vscode-ai-foundry"
    if code --list-extensions 2>/dev/null | grep -q "$extensionId"; then
        echo "[OK] Microsoft Foundry extension already installed."
    else
        if code --install-extension "$extensionId" --force 2>&1; then
            echo "[OK] Microsoft Foundry extension installed successfully."
            echo "     Reload VS Code to activate the extension."
        else
            echo "[WARN] Failed to install Microsoft Foundry extension."
            echo "       Install manually: https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.vscode-ai-foundry"
        fi
    fi
else
    echo "[WARN] VS Code not found on PATH. Install manually from: https://code.visualstudio.com/"
    echo "       Microsoft Foundry extension: https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.vscode-ai-foundry"
fi

# ── 3. Create .venv ──────────────────────────────────────────────────────────
if [ -d ".venv" ]; then
    echo "[OK] Virtual environment already exists at .venv/"
else
    echo "[..] Creating virtual environment (.venv)..."
    "$PYTHON" -m venv .venv
    echo "[OK] Created .venv/"
fi

# ── 4. Activate & install dependencies ────────────────────────────────────────
echo "[..] Activating virtual environment..."
# shellcheck disable=SC1091
source .venv/bin/activate

echo "[..] Upgrading pip..."
python -m pip install --upgrade pip --quiet

echo "[..] Installing dependencies from requirements.txt..."
python -m pip install -r requirements.txt

echo "[OK] Dependencies installed."

# ── 5. Copy .env.template → .env (if needed) ─────────────────────────────────
if [ ! -f ".env" ]; then
    if [ -f ".env.template" ]; then
        cp .env.template .env
        echo "[OK] Created .env from .env.template - edit it with your settings."
    else
        echo "[WARN] No .env.template found. Create a .env file manually."
    fi
else
    echo "[OK] .env already exists."
fi

# ── 6. Create output directory ─────────────────────────────────────────────────────────────
if [ ! -d "output" ]; then
    mkdir -p output
    echo "[OK] Created output/ directory"
else
    echo "[OK] output/ directory already exists."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Setup Complete ==="
echo ""
echo "To activate the environment in future sessions:"
echo "  source .venv/bin/activate"
echo ""
echo "Quick start (CLI):"
echo "  python run_local.py examples/ecommerce.yaml"
echo ""
echo "Quick start (Web UI):"
echo "  bash scripts/linux-mac/dev.sh"
echo ""
