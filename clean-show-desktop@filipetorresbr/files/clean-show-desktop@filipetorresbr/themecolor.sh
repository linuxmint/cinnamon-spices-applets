#!/bin/bash
detect_theme_name=$(gsettings get org.cinnamon.theme name)

path1="/usr/share/themes/${detect_theme_name:1:-1}/cinnamon/cinnamon.css"
path2="/home/${USER}/.themes/${detect_theme_name:1:-1}/cinnamon/cinnamon.css"
path3="/home/${USER}/.local/share/themes/${detect_theme_name:1:-1}/cinnamon/cinnamon.css"
destination="/home/${USER}/.local/share/cinnamon/applets/clean-show-desktop@filipetorresbr/themecolor.txt"

if [ -e $path1 ];
then
    grep_theme_color=$(cat $path1 | grep "selection-background-color" -m 1)
    color=${grep_theme_color:31:-1}
    printf "%s%d%s %d%s %d" "rgba(" 0x${color:0:2} "," 0x${color:2:2} "," 0x${color:4:2} > ${destination}
    exit 1
elif [ -e $path2 ];
then
    grep_theme_color=$(cat $path2 | grep "selection-background-color" -m 1)
    printf "%s" ${color} > ${destination}
    color=${grep_theme_color:31:-1}
    printf "%s%d%s %d%s %d" "rgba(" 0x${color:0:2} "," 0x${color:2:2} "," 0x${color:4:2}  > ${destination}
    exit 1
else
    grep_theme_color=$(cat $path3 | grep "selection-background-color" -m 1)
    color=${grep_theme_color:31:-1}
    printf "%s%d%s %d%s %d" "rgba(" 0x${color:0:2} "," 0x${color:2:2} "," 0x${color:4:2}  > ${destination}
    exit 1
fi
