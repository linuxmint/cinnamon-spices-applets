#!/bin/bash
# ./build.sh
#source ./build3_0.sh
#rm -rf ~/.local/share/cinnamon/applets/weather@mockturtl/
#mkdir ~/.local/share/cinnamon/applets/weather@mockturtl/
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"

# Save current dir for convenience
path=${PWD}

cd $DIR
cp -rf files/weather@mockturtl/* ~/.local/share/cinnamon/applets/weather@mockturtl/
cd ..
./cinnamon-spices-makepot weather@mockturtl
cd $PWD
export DISPLAY=:0; cinnamon --replace &