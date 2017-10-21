#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://193.108.24.6:8000/melody &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Melody" "Радио Melody ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://193.108.24.6:8000/melody &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Melody" "Радио Melody ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
