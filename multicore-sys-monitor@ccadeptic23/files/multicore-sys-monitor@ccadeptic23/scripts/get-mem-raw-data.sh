#!/usr/bin/env bash
p=1024
total=0
used=0
free=0
shared=0
buffers=0
cache=0
available=0
swapTotal=0
swapUsed=0

while IFS=' ' read -r name value unit
do
    [[ "$name" =~ ^SUnreclaim ]] && break
    [[ "$name" =~ ^MemTotal ]] && total=$(($p * $value))
    [[ "$name" =~ ^MemFree ]] && free=$(($p * $value))
    [[ "$name" =~ ^MemAvailable ]] && available=$(($p * $value))
    [[ "$name" =~ ^Buffers ]] && buffers=$(($p * $value))
    [[ "$name" =~ ^Cached ]] && cache=$(($p * $value))
    [[ "$name" =~ ^SwapTotal ]] && swapTotal=$(($p * $value))
    [[ "$name" =~ ^SwapFree ]] && swapUsed=$((swapTotal - $p * $value))
    [[ "$name" =~ ^Shmem ]] && shared=$(($p * $value))
    [[ "$name" =~ ^SReclaimable ]] && cache=$((cache + $p * $value))
    used=$((total - available))
done < /proc/meminfo
echo -n "$total $used $free $shared $buffers $cache $available $swapTotal $swapUsed"
exit 0
