#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

rtmpdump -r "rtmp://nodeb.gocaster.net:1935/CGL/_definst_/" -W "http://iphone.fmstreams.com/jwplayer/player.swf" -p "http://city.bg/live/" -y "mp4:TODAYFM_TEST2" -b "0" | vlc --meta-title "City" - &

notify-send -t 5000 -i "multimedia-video-player" "City" "City ще стартира след скунди.\n\n Приятно гледане!" &

else

rtmpdump -r "rtmp://nodeb.gocaster.net:1935/CGL/_definst_/" -W "http://iphone.fmstreams.com/jwplayer/player.swf" -p "http://city.bg/live/" -y "mp4:TODAYFM_TEST2" -b "0" | vlc --meta-title "City" - &

notify-send -t 5000 -i "multimedia-video-player" "City" "City ще стартира след скунди.\n\n Приятно гледане!" &

fi 

exit 0
