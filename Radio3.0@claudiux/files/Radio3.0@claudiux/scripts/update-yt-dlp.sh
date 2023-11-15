#!/bin/bash

OLDOWNBIN="$HOME/bin"
OLDYTDLP="$OLDOWNBIN/yt-dlp"
OWNBIN="$HOME/.local/bin"
YTDLP="$OWNBIN/yt-dlp"

[ -d $OWNBIN ] || mkdir -p $OWNBIN

[ -f $OLDYTDLP ] && mv -f $OLDYTDLP $YTDLP

[ -e $YTDLP ] || {
  wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O $YTDLP
  chmod +x $YTDLP
  exit 1
}

$YTDLP -U
exit 0
