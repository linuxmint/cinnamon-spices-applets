#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

vlc "http://ios.cdn.bg:2006/fls/bonair.stream/playlist.m3u8" --meta-title "On Air" &

notify-send -t 5000 -i "multimedia-video-player" "On Air" "On Air ще стартира след скунди.\n\n Приятно гледане!" &

else

vlc "http://ios.cdn.bg:2006/fls/bonair.stream/playlist.m3u8" --meta-title "On Air"&

notify-send -t 5000 -i "multimedia-video-player" "On Air" "On Air ще стартира след скунди.\n\n Приятно гледане!" &

fi

exit 0
