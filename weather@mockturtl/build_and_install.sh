#!/bin/bash
# Check for lint errors, webpack errors, then installs applet and restarts cinnamon
# REQUIREMENTS:
# - typescript installed
VERSION='3.8'

# Check for upstream changes and exit with code if detected
git fetch origin && [ "$(git rev-parse @)" = "$(git rev-parse @{u})" ] || { echo "Upstream changes detected. A git pull is required."; exit -3; }

# Resolve Symlinks
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"

echo 'Checking with Lint...'
# Run the npm lint command and capture its output
lint_output=$(npm run lint 2>&1)

# Use awk and sed to extract and clean the number of errors and warnings
errors=$(echo "$lint_output" | awk '/problems/ {print $4}' | sed 's/[()]//g')
warnings=$(echo "$lint_output" | awk '/problems/ {print $6}' | sed 's/[()]//g')

echo "Lint Errors: $errors"
echo "Lint Warnings: $warnings"

# Check if there are zero errors
if [ "$errors" -eq 0 ]; then

  # Run the npx webpack command and capture its output
  echo 'Running webpack....'
  webpack_output=$(npx webpack 2>&1)
  echo "Webpack: $webpack_output"

  # Check if the word 'successfully' is in the output
  if echo "$webpack_output" | grep -q "compiled successfully in"; then
      # Save current dir for convenience then run translations
      path=${PWD}
      cd ..
      echo "Creating translations..."
      ./cinnamon-spices-makepot weather@mockturtl
      cd $path
      echo "Installing applet..."
      cp --verbose files/weather@mockturtl/${VERSION}/weather-applet.js ~/.local/share/cinnamon/applets/weather\@mockturtl/${VERSION}/weather-applet.js
      echo "Restarting Cinnamon..."
      # Restart Cinnamon in the background without terminating the script
      nohup bash -c "export DISPLAY=:0; cinnamon --replace" > /dev/null 2>&1 &
      #cinnamon-looking-glass --logs & #TODO create command line parameter in Looking Glass to open logs tab
      cinnamon-looking-glass &
      echo "Build and installation successful."
      exit 0  # Exit the script
  else
      echo "Webpack Errors prevented compiling"
      exit -2
  fi
else
   echo "Lint Errors prevented compiling: $lint_output"
   exit -1
fi
