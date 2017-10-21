#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://live.btvradio.bg/btv-radio.mp3 &

notify-send -t 5000 -i "multimedia-audio-player" "бТВ радио" "бТВ радио ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://live.btvradio.bg/btv-radio.mp3 &

notify-send -t 5000 -i "multimedia-audio-player" "бТВ радио" "бТВ радио ще стартира след скунди.\n\n Приятно слушане!"  > /dev/null &

fi

exit 0
