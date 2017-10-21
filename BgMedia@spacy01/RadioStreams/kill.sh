#!/bin/sh

if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &

notify-send -t 5000 -i "editdelete" "Спиране" "Изпълнението е спряно." &

else

notify-send -t 5000 -i "editdelete" "Спиране" "Няма нищо за спиране." &

fi

exit 0
