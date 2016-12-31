#! /bin/bash

x1=${SHELLTOOLS_STATE}
if [ "$x1" == "" ]
then
  x1=0
fi

dt=$SHELLTOOLS_DT
if [ "$dt" == "" ]
then
  dt=1
fi

x2=$( cat /proc/net/dev | grep $1 | awk '{ print $2}' )
d=$(expr $x2 - $x1 )
r=$(expr $d / $dt )
rk=$(expr $r / 1024 )
x2m=$(expr $x2 / 1073741824 )
dk=$(expr $d / 1024 )

x1=$x2

echo  ${x1}
echo "$1: ${x2m} GB / ${rk} KBps"
