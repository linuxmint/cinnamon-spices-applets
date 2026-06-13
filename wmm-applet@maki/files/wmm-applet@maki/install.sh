#!/bin/bash

# ==========================================================
# WMM - Wallpaper Master Manager
# Interactive installer and dependency checker
# ==========================================================

# Colors for the checklist
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No color

APPLET_DIR="$HOME/.local/share/cinnamon/applets/wmm-applet@maki"
CACHE_DIR="$HOME/.cache/wmm"

# ----------------------------------------------------------
# Verify that Cinnamon is installed
# ----------------------------------------------------------
if ! command -v cinnamon &> /dev/null; then
    echo -e "${RED}ERROR: Cinnamon is not installed on this system.${NC}"
    echo "WMM is an applet exclusively for the Cinnamon desktop."
    echo "Please install Cinnamon before running this installer."
    exit 1
fi
echo -e "${GREEN}Cinnamon detected.${NC}"

# ----------------------------------------------------------
# Dependencies that the script can install safely
# ----------------------------------------------------------
declare -A DEPENDENCIES
DEPENDENCIES=(
    ["Python 3"]="python3 --version|python3"
    ["Pillow (Python Imaging)"]="python3 -c 'from PIL import Image'|python3-pillow"
    ["NumPy (Python scientific computing)"]="python3 -c 'import numpy'|python3-numpy"
    ["Libnotify (notifications)"]="command -v notify-send|libnotify-bin"
)

# System dependencies (should already be present with Cinnamon, only verified)
declare -A SYSTEM_DEPENDENCIES
SYSTEM_DEPENDENCIES=(
    ["PyGObject (GTK bindings)"]="python3 -c 'import gi; gi.require_version(\"Gtk\", \"3.0\")'"
    ["GTK 3.0 Introspection"]="python3 -c 'import gi; gi.require_version(\"Gtk\", \"3.0\")'"
    ["GLib 2.0 Introspection"]="python3 -c 'import gi; gi.require_version(\"GLib\", \"2.0\")'"
    ["GetText"]="command -v xgettext"
    ["Zenity (dialogs)"]="command -v zenity"
    ["pkill (signals)"]="command -v pkill"
)

# ----------------------------------------------------------
# Function to verify a dependency
# ----------------------------------------------------------
check_dep() {
    local test_cmd="$1"
    if eval "$test_cmd" &> /dev/null; then
        echo 1 # Installed
    else
        echo 0 # Not installed
    fi
}

# ----------------------------------------------------------
# Function to display the checklist
# ----------------------------------------------------------
print_checklist() {
    local installed_count=0
    local missing_count=0
    echo -e "\nDependency status:"
    # Installable dependencies
    for dep_name in "${!DEPENDENCIES[@]}"; do
        test_cmd="${DEPENDENCIES[$dep_name]%%|*}"
        status=$(check_dep "$test_cmd")
        if [ "$status" -eq 1 ]; then
            echo -e "  ${GREEN}[✔]${NC} $dep_name"
            ((installed_count++))
        else
            echo -e "  ${RED}[✘]${NC} $dep_name"
            ((missing_count++))
        fi
    done
    # System dependencies (verification only)
    for dep_name in "${!SYSTEM_DEPENDENCIES[@]}"; do
        test_cmd="${SYSTEM_DEPENDENCIES[$dep_name]}"
        status=$(check_dep "$test_cmd")
        if [ "$status" -eq 1 ]; then
            echo -e "  ${GREEN}[✔]${NC} $dep_name (system)"
            ((installed_count++))
        else
            echo -e "  ${RED}[✘]${NC} $dep_name (system - required for Cinnamon)"
            ((missing_count++))
        fi
    done
    echo -e "\n${GREEN}$installed_count installed${NC}, ${RED}$missing_count missing${NC}"
    return $missing_count
}

# ----------------------------------------------------------
# Function to install WMM files
# ----------------------------------------------------------
install_files() {
    echo -e "\nCreating directory structure and copying files..."
    SCRIPT_DIR="$(dirname "$0")"
    if [ ! -f "$SCRIPT_DIR/metadata.json" ] || [ ! -d "$SCRIPT_DIR/python" ]; then
        echo "ERROR: Project structure not found (missing metadata.json or python/)."
        echo "Make sure you run the script from the project root folder."
        exit 1
    fi
    mkdir -p "$APPLET_DIR/data" "$APPLET_DIR/python" "$APPLET_DIR/wmm_platform"
    mkdir -p "$CACHE_DIR/thumbnails"
    cp -r "$SCRIPT_DIR"/* "$APPLET_DIR/" || {
        echo "Error copying files. Do you have write permission on $APPLET_DIR?"
        exit 1
    }
    echo "Files copied successfully."

    # Clean up development files
    find "$APPLET_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
    find "$APPLET_DIR" -type f -name "*.pyc" -delete 2>/dev/null
    echo "Development files cleaned."

    # Generate platform configuration (detects OS and desktop)
    echo "Detecting platform..."
    python3 "$APPLET_DIR/wmm_platform/setup_core.py" || {
        echo "Warning: Could not detect platform. WMM may not work correctly."
    }

    # Compile and install translations
    echo "Installing translations..."
    shopt -s nullglob
    for po_file in "$SCRIPT_DIR"/po/*.po; do
        lang=$(basename "$po_file" .po)
        lang_dir="$HOME/.local/share/locale/$lang/LC_MESSAGES"
        mkdir -p "$lang_dir"
        msgfmt "$po_file" -o "$lang_dir/wmm-applet@maki.mo" || echo "Error compiling $po_file"
        echo "  Translation $lang installed."
    done
    shopt -u nullglob

    # Copy Nemo actions (only if Nemo is installed)
    if command -v nemo &> /dev/null; then
        echo "Installing Nemo actions..."
        mkdir -p "$HOME/.local/share/nemo/actions"
        cp "$SCRIPT_DIR/nemo_action/"*.nemo_action "$HOME/.local/share/nemo/actions/" 2>/dev/null && echo "Nemo actions installed." || echo "No Nemo actions found, skipping."

    else
        echo "Nemo not found, skipping Nemo actions."
    fi
}

# ----------------------------------------------------------
# SCRIPT START
# ----------------------------------------------------------
clear
echo "=============================================="
echo "  WMM - Wallpaper Multi-Monitor Manager"
echo "  Dependency Check"
echo "=============================================="

# First pass: show current status
print_checklist
missing=$?

if [ $missing -eq 0 ]; then
    install_files
    echo -e "\n=============================================="
    echo "  Installation completed successfully!"
    echo "  WMM has been installed at: $APPLET_DIR"
    echo "=============================================="
    echo -e "\nTo enable the applet, go to Cinnamon Applets settings and activate 'WMM Manager'."

    echo "Closing in 5 seconds..."
    sleep 5
    exit 0
fi

# If dependencies are missing, ask whether to install them
echo -e "\nDo you want to install the missing dependencies? (y/n)"
read -p "Option: " answer || true
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "Installation cancelled. No dependencies will be installed."
    echo "You can install them manually later."
    exit 1
fi

# Attempt to install the missing dependencies
echo -e "\nInstalling dependencies..."

# Detect package manager
if command -v apt &> /dev/null; then
    PKG_MANAGER="apt"
    INSTALL_CMD="sudo apt install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    INSTALL_CMD="sudo dnf install -y"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    INSTALL_CMD="sudo pacman -Sy --noconfirm"
    # Package name mapping for Arch
    declare -A PACMAN_MAP
    PACMAN_MAP=(
        ["python3"]="python"
        ["python3-pillow"]="python-pillow"
        ["python3-numpy"]="python-numpy"
        ["libnotify-bin"]="libnotify"
    )
else
    echo "Could not detect package manager."
    echo "Please install the packages listed above manually."
    exit 1
fi

# Build list of missing packages (from DEPENDENCIES only)
MISSING_PKGS=""
for dep_name in "${!DEPENDENCIES[@]}"; do
    test_cmd="${DEPENDENCIES[$dep_name]%%|*}"
    packages="${DEPENDENCIES[$dep_name]##*|}"
    status=$(check_dep "$test_cmd")
    if [ "$status" -eq 0 ]; then
        if [ "$PKG_MANAGER" = "pacman" ]; then
            for pkg in $packages; do
                MISSING_PKGS="$MISSING_PKGS ${PACMAN_MAP[$pkg]:-$pkg}"
            done
        else
            MISSING_PKGS="$MISSING_PKGS $packages"
        fi
    fi
done

# Install
if [ -n "$MISSING_PKGS" ]; then
    echo "Running: $INSTALL_CMD $MISSING_PKGS"
    $INSTALL_CMD $MISSING_PKGS
else
    echo "No pending packages."
fi

# Second pass: verify after installation
echo -e "\nVerifying dependencies after installation..."
print_checklist
missing=$?

if [ $missing -eq 0 ]; then
    echo "All dependencies have been successfully installed."
    install_files
    echo -e "\n=============================================="
    echo "  Installation completed successfully!"
    echo "  WMM has been installed at: $APPLET_DIR"
    echo "=============================================="
    echo -e "\nTo enable the applet, go to Cinnamon Applets settings and activate 'WMM Manager'."

    echo "Closing in 5 seconds..."
    sleep 5
    exit 0
else
    echo -e "\nSome dependencies could not be installed."
    echo "Check the error messages and try manually."
    exit 1
fi
