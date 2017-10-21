#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://149.13.0.80/nrj_low.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Energy радио" "Energy радио ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://149.13.0.80/nrj_low.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Energy радио" "Energy радио ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
