#!/bin/bash
UUID="fish@kriegcc"
CURRENT_DIR=$(pwd)

# exit immediately if any command within the script exits with a non-zero status
set -e

echo "Running build..."
npm run build || { echo "Build failed. Exiting."; exit 1; }
echo "Build completed successfully."

# run "test-spice" script which copies this applet's files to the applet folder, see ../README.md
# note: this applet's folder name gets prefixed with `devtest-`
echo "Copying build to local applet folder..."
cd ..
./test-spice $UUID
cd "$CURRENT_DIR"
echo "Copy completed successfully."

export DISPLAY=:0; cinnamon --replace &