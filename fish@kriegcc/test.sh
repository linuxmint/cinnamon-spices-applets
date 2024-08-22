#!/bin/bash
# Source of this script with a bit of explanation, see .typescript-declarations/README.md

UUID="fish@kriegcc"

# exit immediately if any command within the script exits with a non-zero status
set -e

echo "Running build..."
npm run build || { echo "Build failed. Exiting."; exit 1; }
echo "Build completed successfully."

# Comment out these lines if you don't want to wipe the applet folder
rm -rf ~/.local/share/cinnamon/applets/$UUID/
mkdir ~/.local/share/cinnamon/applets/$UUID/
# --------------------------------------------------
cp -rf files/$UUID/* ~/.local/share/cinnamon/applets/$UUID/
export DISPLAY=:0; cinnamon --replace &