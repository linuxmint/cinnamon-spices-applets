#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://193.108.24.21:8000/fmplus &

notify-send -t 5000 -i "multimedia-audio-player" "Радио ФМ+" "Радио ФМ+ ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://193.108.24.21:8000/fmplus &

notify-send -t 5000 -i "multimedia-audio-player" "Радио ФМ+" "Радио ФМ+ ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
