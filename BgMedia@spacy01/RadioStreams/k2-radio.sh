#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://stream.radiok2.bg:8000/rk2-high &

notify-send -t 5000 -i "multimedia-audio-player" "Радио К-2" "Радио К-2 ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://stream.radiok2.bg:8000/rk2-high &

notify-send -t 5000 -i "multimedia-audio-player" "Радио К-2" "Радио К-2 ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
