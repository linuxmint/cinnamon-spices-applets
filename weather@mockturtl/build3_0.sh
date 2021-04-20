#!/bin/bash
# REQUIREMENTS:
# - typescript installed
# - sed

# Getting bash script file location
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"

# Save current dir for convenience
path=${PWD}

cd $DIR/src/3_0

echo Building 3.0...
cp promise-polyfill.js $DIR/files/weather@mockturtl/3.0/
tsc -p tsconfig.json
cd $DIR

for f in files/weather@mockturtl/3.0/*.js; do
    sed -i '/export {};/d' "$f"
done

cd $path