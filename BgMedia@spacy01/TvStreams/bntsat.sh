#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

rtmpdump -r "rtmp://edge11.cdn.bg:2020/fls" -a "fls/" -p "http://i.cdn.bg/live/ls4wHAbTmY" -y "bntW.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c" -b "0" - | vlc --meta-title "БНТ Свят" - &

notify-send -t 5000 -i "multimedia-video-player" "БНТ Свят" "БНТ Свят ще стартира след скунди.\n\n Приятно гледане!" &

else

rtmpdump -r "rtmp://edge11.cdn.bg:2020/fls" -a "fls/" -p "http://i.cdn.bg/live/ls4wHAbTmY" -y "bntW.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c" -b "0" - | vlc --meta-title "БНТ Свят" - &

notify-send -t 5000 -i "multimedia-video-player" "БНТ Свят" "БНТ Свят ще стартира след скунди.\n\n Приятно гледане!" &

fi

exit 0
