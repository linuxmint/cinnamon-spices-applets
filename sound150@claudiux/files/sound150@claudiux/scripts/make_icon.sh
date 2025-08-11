#!/usr/bin/env bash
path=$1
[[ -z $path ]] && exit 1
bn=$(basename $path)
rndpart="${bn:9}"
#~ DEBUG=true # DEBUGGING

ICONDIR=$XDG_RUNTIME_DIR/sound150/icons
TMPDIR=$XDG_RUNTIME_DIR/sound150/tmp
[[ -d ${ICONDIR} ]] || mkdir -p ${ICONDIR}
[[ -d ${TMPDIR} ]] && rm -f ${TMPDIR}/* || mkdir -p ${TMPDIR}

[[ -f ${ICONDIR}/R3SongArt${rndpart} ]] && exit 0

sleep 1

size=$(wc -c <"$path")
[[ $size -eq 0 ]] && exit 0

[[ -x /usr/bin/identify ]] && {
        width=$(/usr/bin/identify -format "%w" $path)
        height=$(/usr/bin/identify -format "%h" $path)
        #~ [[ $DEBUG == true ]] && echo "$width x $height" >> $HOME/sound150.log # DEBUGGING
        #~ [[ $DEBUG == true ]] && echo "$width x $height" # DEBUGGING
        [[ $width -gt $height ]] && {
                cropsize=$(( width-height ))
                cropsize=$(( cropsize/2 ))
                /usr/bin/convert $path -crop +$cropsize +repage -crop -$cropsize ${TMPDIR}/R3SongArt${rndpart}
                mv ${TMPDIR}/R3SongArt${rndpart} ${ICONDIR}/R3SongArt${rndpart}
        }
        sleep 0.5
}
exit 0
