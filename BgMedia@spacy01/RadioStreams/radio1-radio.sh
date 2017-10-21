#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://149.13.0.81/radio1.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Радио 1" "Радио 1 ще стартира след скунди.\n\n Приятно слушане!" &

else

clc http://149.13.0.81/radio1.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Радио 1" "Радио 1 ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
