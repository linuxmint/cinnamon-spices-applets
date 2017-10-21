#!/usr/bin/python

from sys import argv
from os import system
from pipes import quote

if (len(argv) != 2):
    exit(1)

command = "ps aux | grep 'play -q' | grep %s | awk '{print $2}' | xargs -r kill -9" % (quote(argv[1]))

system(command)
