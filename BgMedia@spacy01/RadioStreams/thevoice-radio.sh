#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc rtsp://31.13.217.76:1935/rtplive/thevoiceradio_live.stream &

notify-send -t 5000 -i "multimedia-audio-player" "Радио The Voice" "Радио The Voice ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc rtsp://31.13.217.76:1935/rtplive/thevoiceradio_live.stream &

notify-send -t 5000 -i "multimedia-audio-player" "Радио The Voice" "Радио The Voice ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
