#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

rtmpdump -r "rtmp://46.10.150.113:80/alpha" -a "alpha" -f "WIN 11,5,502,149" -W "http://www.btv.bg/static/bg/shared/app/flowplayer/flowplayer.rtmp-3.2.13.swf" -p "http://www.btv.bg/live/" -y "alpha" --quiet | vlc --meta-title "бТВ" - &

notify-send -t 5000 -i "multimedia-video-player" "бТВ" "бТВ ще стартира след скунди.\n\n Приятно гледане!" &

else

rtmpdump -r "rtmp://46.10.150.113:80/alpha" -a "alpha" -f "WIN 11,5,502,149" -W "http://www.btv.bg/static/bg/shared/app/flowplayer/flowplayer.rtmp-3.2.13.swf" -p "http://www.btv.bg/live/" -y "alpha" --quiet | vlc --meta-title "бТВ" - &

notify-send -t 5000 -i "multimedia-video-player" "бТВ" "бТВ ще стартира след скунди.\n\n Приятно гледане!" &

fi

exit 0
