#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

rtmpdump -r "http://ios.cdn.bg:2020/fls" -a "fls" -f "WIN 11,5,502,149" -p "http://cdn.bg/live/8W5GA2ujvB" -W "http://cdn.bg/eflash/jwplayer510/player.swf" -y "bnt.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c" -b "0" - | vlc --meta-title "БНТ" - &

notify-send -t 5000 -i "multimedia-video-player" "БНТ" "БНТ ще стартира след скунди.\n\n Приятно гледане!" &

else

rtmpdump -r "http://ios.cdn.bg:2020/fls" -a "fls" -f "WIN 11,5,502,149" -p "http://cdn.bg/live/8W5GA2ujvB" -W "http://cdn.bg/eflash/jwplayer510/player.swf" -y "bnt.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c" -b "0" - | vlc --meta-title "БНТ" - &

notify-send -t 5000 -i "multimedia-video-player" "БНТ" "БНТ ще стартира след скунди.\n\n Приятно гледане!" &


fi

exit 0
