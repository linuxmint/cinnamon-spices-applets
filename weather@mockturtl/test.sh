#!/bin/bash
source ./build.sh
cp -rf ./* ~/.local/share/cinnamon/applets/weather@mockturtl/
export DISPLAY=:0; cinnamon --replace &