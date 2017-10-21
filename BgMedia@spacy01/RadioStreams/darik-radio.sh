#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://darikradio.by.host.bg:8000/S2-128 &

notify-send -t 5000 -i "multimedia-audio-player" "Дарик радио" "Дарик радио ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://darikradio.by.host.bg:8000/S2-128 &

notify-send -t 5000 -i "multimedia-audio-player" "Дарик радио" "Дарик радио ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
