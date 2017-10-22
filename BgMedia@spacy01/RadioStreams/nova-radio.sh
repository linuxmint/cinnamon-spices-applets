#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://stream81.metacast.eu/nova.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Нова радио" "Нова радио ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://stream81.metacast.eu/nova.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Нова радио" "Нова радио ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
