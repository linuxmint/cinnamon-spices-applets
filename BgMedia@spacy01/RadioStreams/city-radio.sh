#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://149.13.0.81:8000/city.ogg

notify-send -t 5000 -i "multimedia-audio-player" "City радио" "City радио ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://149.13.0.81:8000/city.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "City радио" "City радио ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
