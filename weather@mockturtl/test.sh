#!/bin/bash
source ./build.sh
echo $PWD
cp -rf files/weather@mockturtl/* ~/.local/share/cinnamon/applets/weather@mockturtl/
export DISPLAY=:0; cinnamon --replace &