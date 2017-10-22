#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall vlc &
sleep 2

cvlc http://149.13.0.81/radio1rock.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Радио 1 рок" "Радио 1 рок ще стартира след скунди.\n\n Приятно слушане!" &

else

cvlc http://149.13.0.81/radio1rock.ogg &

notify-send -t 5000 -i "multimedia-audio-player" "Радио 1" "Радио 1 рок ще стартира след скунди.\n\n Приятно слушане!" &

fi

exit 0
