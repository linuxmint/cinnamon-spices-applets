#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://193.108.24.21:8000/fresh &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Fresh" "Радио Fresh ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://193.108.24.21:8000/fresh &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Fresh" "Радио Fresh ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
