#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://live.btvradio.bg/classic-fm.mp3 &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Classic FM" "Радио Classic FM ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://live.btvradio.bg/classic-fm.mp3 &

notify-send -t 5000 -i "multimedia-audio-player" "Радио Classic FM" "Радио Classic FM ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
