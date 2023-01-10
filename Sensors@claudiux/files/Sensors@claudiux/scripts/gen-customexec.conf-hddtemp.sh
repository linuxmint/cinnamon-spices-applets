#!/bin/bash
Gsm=($(lsblk | grep -v -e '├─' -e '└─' -e 'NAME' | awk '{print $1}'))

Titems=${#Gsm[@]}

Count=0
echo '[Service]'
echo 'ExecStart='
printf "ExecStart=/usr/bin/hddtemp -dF "
while [ $Count -lt $Titems ];do
IFS="
"
CSmrt=($(smartctl --info '/dev/'${Gsm[Count]} |
grep -e 'SMART support' -e 'Device Model' -e 'User Capacity' | 
cut -d: -f2 |
sed  -e 's/^ //m;s/^    //m;s/^   //m' |
cut -d "[" -f2 | 
sed 's/\]//m'))

Dtmp=${CSmrt[3]}

if [ "$Dtmp" == "Enabled"  ] ; then
if [ 'XX'"$(smartctl -A '/dev/'${Gsm[Count]} | grep ' Temperature_Celsius')" != 'XX'  ];then
printf "/dev/${Gsm[Count]} "
fi;fi;

Count=$((Count+1))
unset CSmrt
done;
printf "\n" 
