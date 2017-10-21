#!/bin/bash

RunDir="$( cd "$( dirname "$0" )" && pwd )"
RunScript=`basename "$0"`
RunExcept="$RunDir/$RunScript"

if [[ -e "pattern.map" ]]; then
	exit 0
fi

xmodmap -pke | grep -E " (67|68|69|70|71|72|73|74|75|76|95|96) " > normal.map

sed -r 's/\= F([0-9][0-9]?) /\= {KEY\1} /g' <normal.map >pattern.map

./genmap.sh 'diff' 1 2 3 4 5 6 7 8 9 F10 F11 F12
./genmap.sh 'divin' v 1 6 8 5 4 7 2 9 F10 F11 F12
#cat pattern.map

