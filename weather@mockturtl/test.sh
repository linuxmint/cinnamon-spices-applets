#!/bin/bash
source ./build.sh
source ./build3_0.sh
#rm -rf ~/.local/share/cinnamon/applets/weather@mockturtl/
#mkdir ~/.local/share/cinnamon/applets/weather@mockturtl/
cp -rf files/weather@mockturtl/* ~/.local/share/cinnamon/applets/weather@mockturtl/
export DISPLAY=:0; cinnamon --replace &