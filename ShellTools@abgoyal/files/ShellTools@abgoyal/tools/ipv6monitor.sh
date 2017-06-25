#! /bin/bash

if [ $(ip address show | grep "inet6.*/128.*scope.*global" | wc -l) == "1" ]
then 
    echo "IPv6 tunnel: Up"; 
else 
    echo "IPv6 tunnel: Down$!"; 
fi
