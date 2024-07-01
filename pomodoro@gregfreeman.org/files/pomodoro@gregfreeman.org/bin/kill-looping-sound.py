#!/usr/bin/python3

from sys import argv
from os import system
from pipes import quote

if (len(argv) != 2):
    exit(1)

command = "ps aux | grep 'play' | grep %s | awk '{print $2}' | xargs -r kill -9" % (quote(argv[1]))

system(command)
