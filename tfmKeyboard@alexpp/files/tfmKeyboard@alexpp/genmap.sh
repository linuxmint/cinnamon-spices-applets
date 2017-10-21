#!/bin/bash

RunDir="$( cd "$( dirname "$0" )" && pwd )"
RunScript=`basename "$0"`
RunExcept="$RunDir/$RunScript"

if [[ ! -e "pattern.map" ]]; then
	echo "Error: pattern.map needed !"
	exit 66
fi
if [[ $# -lt 12 ]]; then
	echo "Error $*"
	echo "Usage $0 <file> <keyF1>...<keyF12>"
	exit $#
fi

out=$1
shift

cat pattern.map | grep "{KEY1}" | sed "s/{KEY1}/$1/g" >$out.map; shift
cat pattern.map | grep "{KEY2}" | sed "s/{KEY2}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY3}" | sed "s/{KEY3}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY4}" | sed "s/{KEY4}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY5}" | sed "s/{KEY5}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY6}" | sed "s/{KEY6}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY7}" | sed "s/{KEY7}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY8}" | sed "s/{KEY8}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY9}" | sed "s/{KEY9}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY10}" | sed "s/{KEY10}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY11}" | sed "s/{KEY11}/$1/g" >>$out.map; shift
cat pattern.map | grep "{KEY12}" | sed "s/{KEY12}/$1/g" >>$out.map

