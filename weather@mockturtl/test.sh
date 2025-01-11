#!/bin/bash
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
cp -arf files/weather@mockturtl/* ~/.local/share/cinnamon/applets/weather@mockturtl/
cd ..
# ./cinnamon-spices-makepot weather@mockturtl
cd $PWD
dbus-send --type=method_call --print-reply --dest=org.Cinnamon /org/Cinnamon org.Cinnamon.ReloadXlet string:'weather@mockturtl' string:'APPLET'