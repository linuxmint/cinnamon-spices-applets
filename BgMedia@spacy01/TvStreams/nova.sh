#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2
rtmpdump -r "rtmp://edge1.evolink.net:2010/fls" -a "fls/_definst_" -y "ntv_2.stream" -p "http://i.cdn.bg/live/" -T "N0v4TV6#2" -b "0" - | vlc --meta-title "Нова" - &

notify-send -t 5000 -i "multimedia-video-player" "Нова" "Нова ще стартира след скунди.\n\n Приятно гледане!" &

else
rtmpdump -r "rtmp://edge1.evolink.net:2010/fls" -a "fls/_definst_" -y "ntv_2.stream" -p "http://i.cdn.bg/live/" -T "N0v4TV6#2" -b "0" - | vlc --meta-title "Нова" - &

notify-send -t 5000 -i "multimedia-video-player" "Нова" "Нова ще стартира след скунди.\n\n Приятно гледане!" &

fi

exit 0
